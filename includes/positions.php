<?php
/**
 * Position ordering for docs (post meta) and doc groups (term meta).
 *
 * @package Docly
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Meta key storing the sort position on docs and doc groups.
 */
define( 'DOCLY_POSITION_META', 'position' );

/**
 * Register position meta for docs and doc groups.
 */
function docly_register_position_meta() {
	$args = array(
		'type'              => 'integer',
		'single'            => true,
		'show_in_rest'      => true,
		'sanitize_callback' => 'absint',
	);

	register_post_meta(
		'doc',
		DOCLY_POSITION_META,
		$args + array(
			'description'   => __( 'Sort position within its doc group.', 'docly' ),
			'auth_callback' => function ( $allowed, $meta_key, $post_id ) {
				return current_user_can( 'edit_post', $post_id );
			},
		)
	);

	register_term_meta(
		'doc_group',
		DOCLY_POSITION_META,
		$args + array(
			'description'   => __( 'Sort position of the doc group.', 'docly' ),
			'auth_callback' => function () {
				return current_user_can( 'manage_categories' );
			},
		)
	);
}
add_action( 'init', 'docly_register_position_meta' );

/**
 * Give new docs a position at the end of the list.
 *
 * @param int $post_id Post ID.
 */
function docly_default_doc_position( $post_id ) {
	if ( metadata_exists( 'post', $post_id, DOCLY_POSITION_META ) ) {
		return;
	}

	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- single aggregate lookup.
	$max = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT MAX(CAST(pm.meta_value AS SIGNED)) FROM {$wpdb->postmeta} pm
			INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
			WHERE pm.meta_key = %s AND p.post_type = 'doc'",
			DOCLY_POSITION_META
		)
	);

	update_post_meta( $post_id, DOCLY_POSITION_META, null === $max ? 0 : (int) $max + 1 );
}
add_action( 'save_post_doc', 'docly_default_doc_position' );

/**
 * Give new doc groups a position at the end of the list.
 *
 * @param int $term_id Term ID.
 */
function docly_default_group_position( $term_id ) {
	$count = (int) wp_count_terms( array( 'taxonomy' => 'doc_group', 'hide_empty' => false ) );

	update_term_meta( $term_id, DOCLY_POSITION_META, max( 0, $count - 1 ) );
}
add_action( 'created_doc_group', 'docly_default_group_position' );

/**
 * Get all doc groups ordered by position, then name.
 *
 * @return WP_Term[]
 */
function docly_get_ordered_groups() {
	$terms = get_terms(
		array(
			'taxonomy'   => 'doc_group',
			'hide_empty' => false,
		)
	);

	if ( is_wp_error( $terms ) ) {
		return array();
	}

	$position = function ( $term ) {
		$value = get_term_meta( $term->term_id, DOCLY_POSITION_META, true );
		return '' === $value ? PHP_INT_MAX : (int) $value;
	};

	usort(
		$terms,
		function ( $a, $b ) use ( $position ) {
			return array( $position( $a ), strcasecmp( $a->name, $b->name ) )
				<=> array( $position( $b ), 0 );
		}
	);

	return $terms;
}

/**
 * Get docs ordered by position, then title.
 *
 * Docs without a position are included (they sort first, then by title).
 *
 * @param array $args Extra WP_Query args (e.g. post_status, tax_query).
 * @return WP_Post[]
 */
function docly_get_ordered_docs( $args = array() ) {
	return get_posts(
		array_merge(
			array(
				'post_type'      => 'doc',
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'no_found_rows'  => true,
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
				'meta_query'     => array(
					'relation'           => 'OR',
					'docly_position'     => array(
						'key'  => DOCLY_POSITION_META,
						'type' => 'NUMERIC',
					),
					'docly_no_position'  => array(
						'key'     => DOCLY_POSITION_META,
						'compare' => 'NOT EXISTS',
					),
				),
				'orderby'        => array(
					'docly_position' => 'ASC',
					'title'          => 'ASC',
				),
			),
			$args
		)
	);
}
