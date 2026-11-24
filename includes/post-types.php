<?php
/**
 * Post type registration.
 *
 * @package Docly
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "doc" post type, shown under the Docly admin menu.
 */
function docly_register_post_type() {
	$labels = array(
		'name'                  => _x( 'Docs', 'post type general name', 'docly' ),
		'singular_name'         => _x( 'Doc', 'post type singular name', 'docly' ),
		'menu_name'             => _x( 'Docs', 'admin menu', 'docly' ),
		'add_new'               => __( 'Add New Doc', 'docly' ),
		'add_new_item'          => __( 'Add New Doc', 'docly' ),
		'edit_item'             => __( 'Edit Doc', 'docly' ),
		'new_item'              => __( 'New Doc', 'docly' ),
		'view_item'             => __( 'View Doc', 'docly' ),
		'view_items'            => __( 'View Docs', 'docly' ),
		'search_items'          => __( 'Search Docs', 'docly' ),
		'not_found'             => __( 'No docs found.', 'docly' ),
		'not_found_in_trash'    => __( 'No docs found in Trash.', 'docly' ),
		'all_items'             => __( 'All Docs', 'docly' ),
		'archives'              => __( 'Doc Archives', 'docly' ),
		'attributes'            => __( 'Doc Attributes', 'docly' ),
		'insert_into_item'      => __( 'Insert into doc', 'docly' ),
		'uploaded_to_this_item' => __( 'Uploaded to this doc', 'docly' ),
		'items_list'            => __( 'Docs list', 'docly' ),
		'items_list_navigation' => __( 'Docs list navigation', 'docly' ),
		'filter_items_list'     => __( 'Filter docs list', 'docly' ),
	);

	register_post_type(
		'doc',
		array(
			'labels'       => $labels,
			'public'       => true,
			'show_ui'      => true,
			'show_in_menu' => 'docly',
			'show_in_rest' => true,
			'has_archive'  => false,
			'rewrite'      => array( 'slug' => 'doc' ),
			'supports'     => array( 'title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'author' ),
		)
	);
}
add_action( 'init', 'docly_register_post_type' );

/**
 * Register the "doc_group" taxonomy, attached only to the doc post type.
 */
function docly_register_taxonomy() {
	$labels = array(
		'name'                       => _x( 'Doc Groups', 'taxonomy general name', 'docly' ),
		'singular_name'              => _x( 'Doc Group', 'taxonomy singular name', 'docly' ),
		'menu_name'                  => __( 'Doc Groups', 'docly' ),
		'all_items'                  => __( 'All Doc Groups', 'docly' ),
		'edit_item'                  => __( 'Edit Doc Group', 'docly' ),
		'view_item'                  => __( 'View Doc Group', 'docly' ),
		'update_item'                => __( 'Update Doc Group', 'docly' ),
		'add_new_item'               => __( 'Add New Doc Group', 'docly' ),
		'new_item_name'              => __( 'New Doc Group Name', 'docly' ),
		'parent_item'                => __( 'Parent Doc Group', 'docly' ),
		'parent_item_colon'          => __( 'Parent Doc Group:', 'docly' ),
		'search_items'               => __( 'Search Doc Groups', 'docly' ),
		'not_found'                  => __( 'No doc groups found.', 'docly' ),
		'no_terms'                   => __( 'No doc groups', 'docly' ),
		'back_to_items'              => __( '&larr; Go to Doc Groups', 'docly' ),
		'items_list'                 => __( 'Doc groups list', 'docly' ),
		'items_list_navigation'      => __( 'Doc groups list navigation', 'docly' ),
	);

	register_taxonomy(
		'doc_group',
		array( 'doc' ),
		array(
			'labels'            => $labels,
			'hierarchical'      => true,
			'public'            => true,
			'show_ui'           => true,
			'show_in_rest'      => true,
			'show_admin_column' => true,
			'rewrite'           => array( 'slug' => 'doc-group' ),
		)
	);
}
add_action( 'init', 'docly_register_taxonomy' );
