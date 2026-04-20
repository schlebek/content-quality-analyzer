<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class CQA_Settings {

	public static function register(): void {
		register_setting( 'cqa-group', 'cqa_api_key', array(
			'sanitize_callback' => 'sanitize_text_field',
		) );
		register_setting( 'cqa-group', 'cqa_model', array(
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => 'gemini-2.0-flash',
		) );
		register_setting( 'cqa-group', 'cqa_post_types', array(
			'sanitize_callback' => array( self::class, 'sanitize_post_types' ),
		) );
		register_setting( 'cqa-group', 'cqa_api_total_cost', array(
			'sanitize_callback' => 'floatval',
		) );
	}

	public static function sanitize_post_types( $value ): array {
		if ( ! is_array( $value ) ) {
			return array();
		}
		return array_values( array_map( 'sanitize_key', $value ) );
	}

	public static function api_key(): string {
		return trim( (string) get_option( 'cqa_api_key', '' ) );
	}

	public static function model(): string {
		return trim( (string) get_option( 'cqa_model', 'gemini-2.0-flash' ) );
	}

	public static function post_types(): array {
		$v = get_option( 'cqa_post_types' );
		return ( is_array( $v ) && ! empty( $v ) ) ? $v : array( 'post', 'page' );
	}
}
