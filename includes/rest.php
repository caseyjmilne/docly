<?php
/**
 * REST endpoints for the Docly admin app.
 *
 * @package Docly
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register Docly REST routes.
 */
function docly_register_rest_routes() {
	register_rest_route(
		'docly/v1',
		'/structure',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'docly_rest_get_structure',
				'permission_callback' => 'docly_rest_can_manage',
			),
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => 'docly_rest_save_structure',
				'permission_callback' => 'docly_rest_can_manage',
				'args'                => array(
					'groups' => array(
						'type'     => 'array',
						'items'    => array( 'type' => 'integer' ),
						'required' => true,
					),
					'docs'   => array(
						'type'                 => 'object',
						'additionalProperties' => array(
							'type'  => 'array',
							'items' => array( 'type' => 'integer' ),
						),
						'required'             => true,
					),
					'moves'  => array(
						'type'    => 'array',
						'default' => array(),
						'items'   => array(
							'type'       => 'object',
							'properties' => array(
								'doc'  => array( 'type' => 'integer' ),
								'from' => array( 'type' => 'integer' ),
								'to'   => array( 'type' => 'integer' ),
							),
						),
					),
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'docly_register_rest_routes' );

/**
 * Permission check for Docly admin endpoints.
 *
 * @return bool
 */
function docly_rest_can_manage() {
	return current_user_can( 'manage_options' );
}

/**
 * Build the groups + docs structure for the Positioning tab.
 *
 * Each doc is listed once, under the first of its groups in group order
 * (0 = ungrouped).
 *
 * @return array
 */
function docly_get_structure() {
	$groups  = docly_get_ordered_groups();
	$docs    = docly_get_ordered_docs(
		array( 'post_status' => array( 'publish', 'future', 'draft', 'pending', 'private' ) )
	);
	$primary = docly_get_primary_groups( $docs, $groups );

	return array(
		'groups' => array_map(
			function ( $group ) {
				return array(
					'id'     => $group->term_id,
					'name'   => $group->name,
					'parent' => $group->parent,
				);
			},
			$groups
		),
		'docs'   => array_map(
			function ( $doc ) use ( $primary ) {
				return array(
					'id'     => $doc->ID,
					'title'  => get_the_title( $doc ),
					'status' => $doc->post_status,
					'group'  => $primary[ $doc->ID ],
				);
			},
			$docs
		),
	);
}

/**
 * GET /docly/v1/structure
 *
 * @return WP_REST_Response
 */
function docly_rest_get_structure() {
	return rest_ensure_response( docly_get_structure() );
}

/**
 * POST /docly/v1/structure
 *
 * Saves group positions, doc positions (index within their group) and
 * applies group moves: the old term is removed and the new term added.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response
 */
function docly_rest_save_structure( WP_REST_Request $request ) {
	$is_group = function ( $term_id ) {
		$term = get_term( $term_id, 'doc_group' );
		return $term instanceof WP_Term;
	};

	$can_edit_doc = function ( $doc_id ) {
		return 'doc' === get_post_type( $doc_id ) && current_user_can( 'edit_post', $doc_id );
	};

	foreach ( array_values( $request['groups'] ) as $index => $term_id ) {
		$term_id = absint( $term_id );

		if ( $is_group( $term_id ) ) {
			update_term_meta( $term_id, DOCLY_POSITION_META, $index );
		}
	}

	foreach ( $request['moves'] as $move ) {
		$doc_id = absint( $move['doc'] ?? 0 );
		$from   = absint( $move['from'] ?? 0 );
		$to     = absint( $move['to'] ?? 0 );

		if ( $from === $to || ! $can_edit_doc( $doc_id ) ) {
			continue;
		}

		if ( $from && $is_group( $from ) ) {
			wp_remove_object_terms( $doc_id, $from, 'doc_group' );
		}

		if ( $to && $is_group( $to ) ) {
			wp_add_object_terms( $doc_id, $to, 'doc_group' );
		}
	}

	foreach ( $request['docs'] as $doc_ids ) {
		foreach ( array_values( (array) $doc_ids ) as $index => $doc_id ) {
			$doc_id = absint( $doc_id );

			if ( $can_edit_doc( $doc_id ) ) {
				update_post_meta( $doc_id, DOCLY_POSITION_META, $index );
			}
		}
	}

	return rest_ensure_response( docly_get_structure() );
}
