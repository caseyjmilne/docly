<?php
/**
 * Front-end template loading for the main Docs page.
 *
 * @package Docly
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Use the Docly template when viewing the main Docs page.
 *
 * @param string $template Template path WordPress resolved.
 * @return string
 */
function docly_template_include( $template ) {
	$page_id = docly_get_docs_page_id();

	if ( ! $page_id || ! is_page( $page_id ) ) {
		return $template;
	}

	// Allow themes to override with docly/docs.php.
	$theme_template = locate_template( 'docly/docs.php' );

	return $theme_template ? $theme_template : DOCLY_PATH . 'templates/docs.php';
}
add_filter( 'template_include', 'docly_template_include', 99 );

/**
 * Query arg used to select a doc on the main Docs page.
 *
 * Not "doc", because that is the post type's own query var and would
 * make WordPress load the single doc instead of the page.
 */
define( 'DOCLY_DOC_QUERY_ARG', 'docly' );

/**
 * Whether the current request is the main Docs page.
 *
 * @return bool
 */
function docly_is_docs_page() {
	$page_id = docly_get_docs_page_id();

	return $page_id && is_page( $page_id );
}

/**
 * Get the docs navigation: one headed section per doc group in position
 * order, each listing its docs in position order, then ungrouped docs last
 * (group => null, rendered without a heading). Empty groups are skipped.
 *
 * Each doc appears once, under the same group the Positioning board shows.
 *
 * @return array[] Each item: array( 'group' => WP_Term|null, 'docs' => WP_Post[] ).
 */
function docly_get_nav_sections() {
	$groups  = docly_get_ordered_groups();
	$docs    = docly_get_ordered_docs();
	$primary = docly_get_primary_groups( $docs, $groups );

	// Docs are already in position order, so bucketing keeps that order.
	$buckets = array();
	foreach ( $docs as $doc ) {
		$buckets[ $primary[ $doc->ID ] ][] = $doc;
	}

	$sections = array();
	foreach ( $groups as $group ) {
		if ( ! empty( $buckets[ $group->term_id ] ) ) {
			$sections[] = array(
				'group' => $group,
				'docs'  => $buckets[ $group->term_id ],
			);
		}
	}

	if ( ! empty( $buckets[0] ) ) {
		$sections[] = array(
			'group' => null,
			'docs'  => $buckets[0],
		);
	}

	return $sections;
}

/**
 * Flatten nav sections into a unique list of docs, in display order.
 *
 * @param array[] $sections From docly_get_nav_sections().
 * @return WP_Post[]
 */
function docly_get_docs( $sections ) {
	$docs = array();

	foreach ( $sections as $section ) {
		foreach ( $section['docs'] as $doc ) {
			$docs[ $doc->ID ] = $doc;
		}
	}

	return array_values( $docs );
}

/**
 * Resolve the doc to show: the one named in the query arg, else the first doc.
 *
 * @param WP_Post[] $docs Available docs.
 * @return WP_Post|null
 */
function docly_get_current_doc( $docs ) {
	if ( empty( $docs ) ) {
		return null;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only navigation.
	$slug = isset( $_GET[ DOCLY_DOC_QUERY_ARG ] ) ? sanitize_title( wp_unslash( $_GET[ DOCLY_DOC_QUERY_ARG ] ) ) : '';

	if ( $slug ) {
		foreach ( $docs as $doc ) {
			if ( $doc->post_name === $slug ) {
				return $doc;
			}
		}
	}

	return $docs[0];
}

/**
 * URL of a doc on the main Docs page.
 *
 * @param WP_Post $doc Doc post.
 * @return string
 */
function docly_get_doc_url( $doc ) {
	return add_query_arg( DOCLY_DOC_QUERY_ARG, $doc->post_name, get_permalink( docly_get_docs_page_id() ) );
}

/**
 * Enqueue front-end assets on the main Docs page.
 */
function docly_enqueue_docs_assets() {
	if ( ! docly_is_docs_page() ) {
		return;
	}

	wp_enqueue_style( 'docly-docs', DOCLY_URL . 'assets/docs.css', array(), DOCLY_VERSION );
	$css = sprintf( ':root { --docly-max-width: %dpx; }', docly_get_max_width() );

	$bg_color = docly_get_bg_color();
	if ( $bg_color ) {
		/*
		 * Block themes print theme.json styles like body { background-color: ... }
		 * (or :root :where(body)). body.docly-docs is more specific, and html is
		 * set too so the canvas matches. Only printed on the Docs page.
		 */
		$css .= sprintf(
			' html, html body.docly-docs { background-color: %1$s; background-image: none; }',
			$bg_color
		);
	}

	wp_add_inline_style( 'docly-docs', $css );

	wp_enqueue_script(
		'docly-docs',
		DOCLY_URL . 'assets/docs.js',
		array(),
		DOCLY_VERSION,
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);

	wp_localize_script(
		'docly-docs',
		'doclyDocs',
		array(
			'restUrl' => esc_url_raw( rest_url( 'wp/v2/doc/' ) ),
			'i18n'    => array(
				'error' => __( 'Sorry, this doc could not be loaded.', 'docly' ),
			),
		)
	);
}
add_action( 'wp_enqueue_scripts', 'docly_enqueue_docs_assets' );
