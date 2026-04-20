<?php
/**
 * Plugin Name:       Content Quality Analyzer
 * Plugin URI:        https://github.com/schlebek/content-quality-analyzer
 * Description:       AI-powered spelling corrector, readability analysis, and AI-friendly content verification powered by Google Gemini.
 * Version:           1.2.0
 * Author:            Stanisław Chlebek
 * Author URI:        https://github.com/schlebek
 * Text Domain:       content-quality-analyzer
 * Domain Path:       /languages
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'CQA_VERSION',    '1.2.0' );
define( 'CQA_PLUGIN_FILE', __FILE__ );
define( 'CQA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CQA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/* ---------------------------------------------------------------
   Autoloader
---------------------------------------------------------------- */

function cqa_autoload( string $class ): void {
	$map = [
		'CQA_Settings' => CQA_PLUGIN_DIR . 'includes/class-cqa-settings.php',
		'CQA_API'      => CQA_PLUGIN_DIR . 'includes/class-cqa-api.php',
		'CQA_Ajax'     => CQA_PLUGIN_DIR . 'includes/class-cqa-ajax.php',
		'CQA_Metabox'  => CQA_PLUGIN_DIR . 'includes/class-cqa-metabox.php',
		'CQA_Admin'    => CQA_PLUGIN_DIR . 'includes/class-cqa-admin.php',
	];
	if ( isset( $map[ $class ] ) ) {
		require_once $map[ $class ];
	}
}
spl_autoload_register( 'cqa_autoload' );

/* ---------------------------------------------------------------
   Lifecycle hooks
---------------------------------------------------------------- */

register_activation_hook( __FILE__, 'cqa_activate' );
function cqa_activate(): void {
	// Placeholder — no DB tables needed.
}

register_uninstall_hook( __FILE__, 'cqa_uninstall' );
function cqa_uninstall(): void {
	delete_option( 'cqa_api_key' );
	delete_option( 'cqa_model' );
	delete_option( 'cqa_post_types' );
	delete_option( 'cqa_api_total_cost' );
}

/* ---------------------------------------------------------------
   Init
---------------------------------------------------------------- */

add_action( 'plugins_loaded', 'cqa_init' );
function cqa_init(): void {
	new CQA_Ajax();
	new CQA_Metabox();
	new CQA_Admin();
}

add_action( 'admin_init', array( 'CQA_Settings', 'register' ) );

add_action( 'init', 'cqa_load_textdomain' );
function cqa_load_textdomain(): void {
	$rel_dir = dirname( plugin_basename( CQA_PLUGIN_FILE ) ) . '/languages';

	if ( load_plugin_textdomain( 'content-quality-analyzer', false, $rel_dir ) ) {
		return;
	}

	// Fallback: strip regional variant (e.g. de_DE_formal → de_DE → de).
	$locale = determine_locale();
	$parts  = explode( '_', $locale );
	if ( count( $parts ) > 2 ) {
		$base = $parts[0] . '_' . $parts[1];
		$file = CQA_PLUGIN_DIR . 'languages/content-quality-analyzer-' . $base . '.mo';
		if ( file_exists( $file ) ) {
			load_textdomain( 'content-quality-analyzer', $file );
			return;
		}
	}

	$lang_only = $parts[0];
	$file      = CQA_PLUGIN_DIR . 'languages/content-quality-analyzer-' . $lang_only . '.mo';
	if ( file_exists( $file ) ) {
		load_textdomain( 'content-quality-analyzer', $file );
	}
}

/* ---------------------------------------------------------------
   Invalidate analysis cache when post is saved
---------------------------------------------------------------- */

add_action( 'save_post', 'cqa_invalidate_cache' );
function cqa_invalidate_cache( int $post_id ): void {
	if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
		return;
	}
	foreach ( array( 'spell', 'readability', 'aifriendly' ) as $key ) {
		delete_post_meta( $post_id, "_cqa_{$key}_cache" );
		delete_post_meta( $post_id, "_cqa_{$key}_date" );
	}
}
