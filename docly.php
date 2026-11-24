<?php
/**
 * Plugin Name:       Docly
 * Plugin URI:        https://github.com/caseyjmilne/docly
 * Description:       Documentation management for WordPress.
 * Version:           0.1.0
 * Requires at least: 6.6
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
 * Option key and default for the docs layout max width (px).
 */
define( 'DOCLY_OPTION_MAX_WIDTH', 'docly_max_width' );
define( 'DOCLY_DEFAULT_MAX_WIDTH', 1200 );
define( 'DOCLY_MIN_MAX_WIDTH', 320 );
define( 'DOCLY_MAX_MAX_WIDTH', 3840 );

/**
 * Option key for the docs page background color. Empty = inherit from theme.
 */
define( 'DOCLY_OPTION_BG_COLOR', 'docly_bg_color' );

require_once DOCLY_PATH . 'includes/post-types.php';
require_once DOCLY_PATH . 'includes/positions.php';
require_once DOCLY_PATH . 'includes/rest.php';
require_once DOCLY_PATH . 'includes/admin.php';
require_once DOCLY_PATH . 'includes/template.php';

/**
 * Activation: register post types, ensure the main Docs page exists, flush rewrites.
 */
function docly_activate() {
	docly_register_post_type();
	docly_register_taxonomy();
	docly_ensure_docs_page();
	update_option( 'docly_version', DOCLY_VERSION );
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'docly_activate' );

/**
 * Ensure a "docs" page exists and store it as the main Documentation page.
 */
function docly_ensure_docs_page() {
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
}

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

/**
 * Get the docs layout max width in px, falling back to the default.
 *
 * @return int
 */
function docly_get_max_width() {
	return docly_sanitize_max_width( get_option( DOCLY_OPTION_MAX_WIDTH, DOCLY_DEFAULT_MAX_WIDTH ) );
}

/**
 * Sanitize a max width: whole px, clamped to a sane range; empty/invalid
 * values fall back to the default.
 *
 * @param mixed $value Raw value.
 * @return int
 */
function docly_sanitize_max_width( $value ) {
	$value = absint( $value );

	if ( ! $value ) {
		return DOCLY_DEFAULT_MAX_WIDTH;
	}

	return min( DOCLY_MAX_MAX_WIDTH, max( DOCLY_MIN_MAX_WIDTH, $value ) );
}

/**
 * Sanitize a background color: a hex color (#rgb, #rgba, #rrggbb or
 * #rrggbbaa), or empty to inherit the theme background.
 *
 * @param mixed $value Raw value.
 * @return string
 */
function docly_sanitize_bg_color( $value ) {
	$value = strtolower( trim( (string) $value ) );

	return preg_match( '/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/', $value ) ? $value : '';
}

/**
 * Get the docs page background color, or '' to inherit from the theme.
 *
 * @return string
 */
function docly_get_bg_color() {
	return docly_sanitize_bg_color( get_option( DOCLY_OPTION_BG_COLOR, '' ) );
}
