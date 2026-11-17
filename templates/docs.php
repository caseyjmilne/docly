<?php
/**
 * Main Docs page template.
 *
 * Override by copying to yourtheme/docly/docs.php.
 *
 * @package Docly
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$docly_docs    = docly_get_docs();
$docly_current = docly_get_current_doc( $docly_docs );
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'docly-docs' ); ?>>
<?php wp_body_open(); ?>

<header id="docly-header" class="docly-header">
	<div class="docly-header__brand">
		<?php if ( has_custom_logo() ) : ?>
			<?php the_custom_logo(); ?>
		<?php else : ?>
			<p class="site-title">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a>
			</p>
		<?php endif; ?>
	</div>
</header>

<div class="docly-layout">
	<nav class="docly-nav" aria-label="<?php esc_attr_e( 'Documentation', 'docly' ); ?>">
		<?php if ( $docly_docs ) : ?>
			<ul class="docly-nav__list">
				<?php foreach ( $docly_docs as $docly_doc ) : ?>
					<?php $docly_is_current = $docly_current && $docly_current->ID === $docly_doc->ID; ?>
					<li class="docly-nav__item">
						<a
							class="docly-nav__link<?php echo $docly_is_current ? ' is-active' : ''; ?>"
							href="<?php echo esc_url( docly_get_doc_url( $docly_doc ) ); ?>"
							data-doc-id="<?php echo esc_attr( $docly_doc->ID ); ?>"
							data-doc-slug="<?php echo esc_attr( $docly_doc->post_name ); ?>"
							<?php echo $docly_is_current ? 'aria-current="page"' : ''; ?>
						><?php echo esc_html( get_the_title( $docly_doc ) ); ?></a>
					</li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>
	</nav>

	<main id="docly-docs" class="docly-main">
		<article
			id="docly-article"
			class="docly-article"
			<?php echo $docly_current ? 'data-doc-id="' . esc_attr( $docly_current->ID ) . '"' : ''; ?>
		>
			<?php if ( $docly_current ) : ?>
				<?php
				global $post;
				$post = $docly_current; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
				setup_postdata( $post );
				?>
				<h1 class="docly-article__title"><?php the_title(); ?></h1>
				<div class="docly-article__content"><?php the_content(); ?></div>
				<?php wp_reset_postdata(); ?>
			<?php else : ?>
				<p class="docly-empty"><?php esc_html_e( 'No docs have been published yet.', 'docly' ); ?></p>
			<?php endif; ?>
		</article>
	</main>
</div>

<?php wp_footer(); ?>
</body>
</html>
