<?php
/**
 * Plugin Name:       Docly
 * Plugin URI:        https://github.com/caseyjmilne/docly
 * Description:       Documentation management for WordPress.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Casey Milne
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       docly
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DOCLY_VERSION', '0.1.0' );
define( 'DOCLY_FILE', __FILE__ );
define( 'DOCLY_PATH', plugin_dir_path( __FILE__ ) );
define( 'DOCLY_URL', plugin_dir_url( __FILE__ ) );

/**
 * Option key storing the ID of the main Documentation page.
 */
define( 'DOCLY_OPTION_DOCS_PAGE', 'docly_docs_page_id' );

/**
 * Activation: ensure a "docs" page exists and store it as the main Documentation page.
 */
function docly_activate() {
	$page_id = (int) get_option( DOCLY_OPTION_DOCS_PAGE );

	// Reuse the stored page if it still exists and isn't trashed.
	if ( $page_id && 'page' === get_post_type( $page_id ) && 'trash' !== get_post_status( $page_id ) ) {
		return;
	}

	// Reuse an existing page with the "docs" slug if present.
	$existing = get_page_by_path( 'docs' );

	if ( $existing instanceof WP_Post ) {
		$page_id = $existing->ID;
	} else {
		$page_id = wp_insert_post(
			array(
				'post_title'   => __( 'Docs', 'docly' ),
				'post_name'    => 'docs',
				'post_content' => '',
				'post_status'  => 'publish',
				'post_type'    => 'page',
			)
		);
	}

	if ( $page_id && ! is_wp_error( $page_id ) ) {
		update_option( DOCLY_OPTION_DOCS_PAGE, (int) $page_id );
	}

	update_option( 'docly_version', DOCLY_VERSION );
}
register_activation_hook( __FILE__, 'docly_activate' );

/**
 * Deactivation: nothing destructive; leave the page and option in place.
 */
function docly_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'docly_deactivate' );

/**
 * Load translations.
 */
function docly_load_textdomain() {
	load_plugin_textdomain( 'docly', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
}
add_action( 'init', 'docly_load_textdomain' );

/**
 * Get the main Documentation page ID.
 *
 * @return int Page ID, or 0 if not set.
 */
function docly_get_docs_page_id() {
	return (int) get_option( DOCLY_OPTION_DOCS_PAGE, 0 );
}
