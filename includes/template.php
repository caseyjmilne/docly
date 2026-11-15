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
