<?php
/**
 * Admin settings page and setting registration.
 *
 * @package Docly
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register settings so they are readable/writable through the REST API (/wp/v2/settings).
 */
function docly_register_settings() {
	register_setting(
		'docly',
		DOCLY_OPTION_DOCS_PAGE,
		array(
			'type'              => 'integer',
			'description'       => __( 'Main Documentation page ID.', 'docly' ),
			'sanitize_callback' => 'absint',
			'show_in_rest'      => true,
			'default'           => 0,
		)
	);
}
add_action( 'init', 'docly_register_settings' );

/**
 * Add the top-level Docly admin page.
 */
function docly_add_admin_page() {
	add_menu_page(
		__( 'Docly', 'docly' ),
		__( 'Docly', 'docly' ),
		'manage_options',
		'docly',
		'docly_render_admin_page',
		'dashicons-book'
	);
}
add_action( 'admin_menu', 'docly_add_admin_page' );

/**
 * Render the mount point for the React app.
 */
function docly_render_admin_page() {
	echo '<div class="wrap"><div id="docly-admin-root"></div></div>';
}

/**
 * Enqueue the React settings app on the Docly admin page only.
 *
 * @param string $hook_suffix Current admin page hook.
 */
function docly_enqueue_admin_assets( $hook_suffix ) {
	if ( 'toplevel_page_docly' !== $hook_suffix ) {
		return;
	}

	$asset_file = DOCLY_PATH . 'build/index.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = require $asset_file;

	wp_enqueue_script(
		'docly-admin',
		DOCLY_URL . 'build/index.js',
		$asset['dependencies'],
		$asset['version'],
		true
	);

	wp_enqueue_style( 'wp-components' );
}
add_action( 'admin_enqueue_scripts', 'docly_enqueue_admin_assets' );
