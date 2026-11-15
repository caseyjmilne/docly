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

<main id="docly-docs">
	<h1>DOCS</h1>
</main>

<?php wp_footer(); ?>
</body>
</html>
