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
