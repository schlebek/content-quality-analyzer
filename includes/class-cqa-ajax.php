<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class CQA_Ajax {

	public function __construct() {
		// Analysis — requires edit_posts
		add_action( 'wp_ajax_cqa_spell_check',     [ $this, 'spell_check' ] );
		add_action( 'wp_ajax_cqa_readability',      [ $this, 'readability' ] );
		add_action( 'wp_ajax_cqa_ai_friendly',      [ $this, 'ai_friendly' ] );
		add_action( 'wp_ajax_cqa_rewrite_fragment', [ $this, 'rewrite_fragment' ] );
		add_action( 'wp_ajax_cqa_generate_tldr',    [ $this, 'generate_tldr' ] );
		add_action( 'wp_ajax_cqa_search_posts',     [ $this, 'search_posts' ] );
		add_action( 'wp_ajax_cqa_overview_posts',   [ $this, 'overview_posts' ] );
		// Settings — requires manage_options
		add_action( 'wp_ajax_cqa_test_api',         [ $this, 'test_api' ] );
		add_action( 'wp_ajax_cqa_reset_cost',       [ $this, 'reset_cost' ] );
	}

	/* ── Auth helpers ─────────────────────────────────────── */

	private function verify_analyze(): void {
		if (
			! current_user_can( 'edit_posts' )
			|| ! wp_verify_nonce( wp_unslash( $_POST['nonce'] ?? '' ), 'cqa_nonce' )
		) {
			wp_send_json_error( __( 'Insufficient permissions.', 'content-quality-analyzer' ), 403 );
		}
	}

	private function verify_settings(): void {
		if (
			! current_user_can( 'manage_options' )
			|| ! wp_verify_nonce( wp_unslash( $_POST['nonce'] ?? '' ), 'cqa_nonce' )
		) {
			wp_send_json_error( __( 'Insufficient permissions.', 'content-quality-analyzer' ), 403 );
		}
	}

	/**
	 * Returns content from POST or, as fallback, from the post's DB content.
	 * Priority: JS editor → Elementor → post_content + ACF fields.
	 */
	private function resolve_content( int $post_id ): string {
		// 1. Content sent directly from the JS editor
		$content = isset( $_POST['content'] ) ? wp_unslash( $_POST['content'] ) : '';
		if ( ! empty( trim( $content ) ) ) {
			return $content;
		}
		if ( $post_id <= 0 ) {
			return '';
		}

		// 2. Elementor: content stored as JSON in _elementor_data meta
		$el_data = get_post_meta( $post_id, '_elementor_data', true );
		if ( ! empty( $el_data ) ) {
			$el_parsed = json_decode( $el_data, true );
			if ( is_array( $el_parsed ) ) {
				$text = $this->extract_elementor_text( $el_parsed );
				if ( ! empty( trim( $text ) ) ) {
					return $text;
				}
			}
		}

		// 3. Standard post_content (Gutenberg, Classic, Divi, WPBakery, etc.)
		$post         = get_post( $post_id );
		$base_content = $post ? $this->clean_builder_content( $post->post_content ) : '';

		// 4. ACF Advanced Custom Fields — append text fields to post_content
		if ( function_exists( 'get_fields' ) ) {
			$acf_values = get_fields( $post_id );
			if ( is_array( $acf_values ) ) {
				$acf_text = $this->extract_acf_text( $acf_values );
				if ( ! empty( trim( $acf_text ) ) ) {
					return trim( $base_content . "\n\n" . $acf_text );
				}
			}
		}

		return $base_content;
	}

	/**
	 * Recursively extract visible text from Elementor's JSON structure.
	 * Covers text-editor, heading, text, button, icon-box, accordion widgets, etc.
	 */
	private function extract_elementor_text( array $elements ): string {
		$texts = [];
		foreach ( $elements as $element ) {
			$settings = $element['settings'] ?? [];
			foreach ( [ 'editor', 'title', 'description', 'text', 'html', 'caption', 'content', 'link_text', 'heading' ] as $field ) {
				if ( ! empty( $settings[ $field ] ) && is_string( $settings[ $field ] ) ) {
					$extracted = trim( wp_strip_all_tags( $settings[ $field ] ) );
					if ( $extracted !== '' ) {
						$texts[] = $extracted;
					}
				}
			}
			if ( ! empty( $element['elements'] ) && is_array( $element['elements'] ) ) {
				$child = $this->extract_elementor_text( $element['elements'] );
				if ( $child !== '' ) {
					$texts[] = $child;
				}
			}
		}
		return implode( "\n\n", $texts );
	}

	/**
	 * Strip builder shortcode tags (Divi, WPBakery, Beaver Builder, etc.)
	 * while preserving the text content inside them.
	 */
	private function clean_builder_content( string $content ): string {
		// Remove shortcode tags like [et_pb_text ...] and [/et_pb_text]
		$content = preg_replace( '/\[\/?\w[\w-]*[^\[\]]*\]/s', ' ', $content );
		// Strip remaining HTML
		$content = wp_strip_all_tags( $content );
		// Decode HTML entities
		$content = html_entity_decode( $content, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		// Normalize whitespace
		$content = preg_replace( '/[ \t]+/', ' ', $content );
		$content = preg_replace( '/\n{3,}/', "\n\n", trim( $content ) );
		return $content;
	}

	/**
	 * Recursively extract readable text from ACF field values.
	 * Handles text, textarea, wysiwyg, groups, repeaters, and flexible content.
	 *
	 * @param mixed $data  Value from get_fields() — string, array, or nested structure.
	 */
	private function extract_acf_text( $data ): string {
		if ( is_string( $data ) ) {
			$stripped = trim( wp_strip_all_tags( html_entity_decode( $data, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );
			// Skip short values, pure numbers, URLs, serialized PHP, base64 blobs
			if (
				strlen( $stripped ) < 30
				|| is_numeric( $stripped )
				|| preg_match( '#^https?://#i', $stripped )
				|| preg_match( '/^a:\d+:\{/i', $stripped )
				|| preg_match( '/^[A-Za-z0-9+\/]{40,}={0,2}$/', $stripped )
			) {
				return '';
			}
			return $stripped;
		}

		if ( ! is_array( $data ) ) {
			return '';
		}

		$texts = [];
		foreach ( $data as $item ) {
			$text = $this->extract_acf_text( $item );
			if ( $text !== '' ) {
				$texts[] = $text;
			}
		}
		return implode( "\n\n", $texts );
	}

	/**
	 * Append a combined snapshot to the post's analysis history (max 10).
	 */
	private function append_history( int $post_id ): void {
		if ( $post_id <= 0 ) return;

		$spell_raw  = get_post_meta( $post_id, '_cqa_spell_cache',       true );
		$read_raw   = get_post_meta( $post_id, '_cqa_readability_cache',  true );
		$ai_raw     = get_post_meta( $post_id, '_cqa_aifriendly_cache',   true );

		$spell_data = $spell_raw ? json_decode( $spell_raw, true ) : null;
		$read_data  = $read_raw  ? json_decode( $read_raw,  true ) : null;
		$ai_data    = $ai_raw    ? json_decode( $ai_raw,    true ) : null;

		$entry = [
			'date'         => gmdate( 'Y-m-d H:i' ),
			'spell_errors' => $spell_data !== null ? count( $spell_data['spelling_errors'] ?? [] ) : null,
			'read_score'   => $read_data  !== null ? ( $read_data['score'] ?? null ) : null,
			'read_grade'   => $read_data  !== null ? ( $read_data['grade'] ?? null ) : null,
			'ai_score'     => $ai_data    !== null ? ( $ai_data['score']   ?? null ) : null,
			'ai_grade'     => $ai_data    !== null ? ( $ai_data['grade']   ?? null ) : null,
		];

		$history_raw = get_post_meta( $post_id, '_cqa_history', true );
		$history     = $history_raw ? json_decode( $history_raw, true ) : [];
		if ( ! is_array( $history ) ) $history = [];

		array_unshift( $history, $entry );
		$history = array_slice( $history, 0, 10 );

		update_post_meta( $post_id, '_cqa_history', wp_json_encode( $history ) );
	}

	/* ── Spell check ──────────────────────────────────────── */

	public function spell_check(): void {
		$this->verify_analyze();
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 120 );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		$content = $this->resolve_content( $post_id );

		if ( empty( trim( $content ) ) ) {
			wp_send_json_error( __( 'No content to check.', 'content-quality-analyzer' ) );
		}

		$api = new CQA_API();
		if ( ! $api->is_configured() ) {
			wp_send_json_error( __( 'Missing API key or model. Please configure the plugin.', 'content-quality-analyzer' ) );
		}

		$result = $api->spell_check( $content );

		if ( isset( $result['error'] ) ) {
			wp_send_json_error( $result['error'] );
		}

		if ( $post_id > 0 ) {
			update_post_meta( $post_id, '_cqa_spell_cache', wp_json_encode( $result ) );
			update_post_meta( $post_id, '_cqa_spell_date',  time() );
			$this->append_history( $post_id );
		}

		wp_send_json_success( $result );
	}

	/* ── Readability ──────────────────────────────────────── */

	public function readability(): void {
		$this->verify_analyze();
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 120 );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		$content = $this->resolve_content( $post_id );

		if ( empty( trim( $content ) ) ) {
			wp_send_json_error( __( 'No content to analyze.', 'content-quality-analyzer' ) );
		}

		$api = new CQA_API();
		if ( ! $api->is_configured() ) {
			wp_send_json_error( __( 'Missing API key or model. Please configure the plugin.', 'content-quality-analyzer' ) );
		}

		$result = $api->readability( $content );

		if ( isset( $result['error'] ) ) {
			wp_send_json_error( $result['error'] );
		}

		if ( $post_id > 0 ) {
			update_post_meta( $post_id, '_cqa_readability_cache', wp_json_encode( $result ) );
			update_post_meta( $post_id, '_cqa_readability_date',  time() );
			$this->append_history( $post_id );
		}

		wp_send_json_success( $result );
	}

	/* ── AI-Friendly ──────────────────────────────────────── */

	public function ai_friendly(): void {
		$this->verify_analyze();
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 120 );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		$content = $this->resolve_content( $post_id );
		$title   = sanitize_text_field( wp_unslash( $_POST['post_title'] ?? '' ) );

		if ( empty( $title ) && $post_id > 0 ) {
			$title = get_the_title( $post_id );
		}

		if ( empty( trim( $content ) ) ) {
			wp_send_json_error( __( 'No content to analyze.', 'content-quality-analyzer' ) );
		}

		$api = new CQA_API();
		if ( ! $api->is_configured() ) {
			wp_send_json_error( __( 'Missing API key or model. Please configure the plugin.', 'content-quality-analyzer' ) );
		}

		$result = $api->ai_friendly( $content, $title, $post_id );

		if ( isset( $result['error'] ) ) {
			wp_send_json_error( $result['error'] );
		}

		if ( $post_id > 0 ) {
			update_post_meta( $post_id, '_cqa_aifriendly_cache', wp_json_encode( $result ) );
			update_post_meta( $post_id, '_cqa_aifriendly_date',  time() );
			$this->append_history( $post_id );
		}

		wp_send_json_success( $result );
	}

	/* ── Rewrite fragment ─────────────────────────────────── */

	public function rewrite_fragment(): void {
		$this->verify_analyze();
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 120 );
		}

		$fragment = sanitize_textarea_field( wp_unslash( $_POST['fragment'] ?? '' ) );
		$hint     = sanitize_text_field( wp_unslash( $_POST['hint'] ?? '' ) );

		if ( empty( trim( $fragment ) ) ) {
			wp_send_json_error( __( 'No fragment to rewrite.', 'content-quality-analyzer' ) );
		}

		$api = new CQA_API();
		if ( ! $api->is_configured() ) {
			wp_send_json_error( __( 'Missing API key or model. Please configure the plugin.', 'content-quality-analyzer' ) );
		}

		$result = $api->rewrite_fragment( $fragment, $hint );

		if ( isset( $result['error'] ) ) {
			wp_send_json_error( $result['error'] );
		}

		wp_send_json_success( $result );
	}

	/* ── Generate TL;DR ───────────────────────────────────── */

	public function generate_tldr(): void {
		$this->verify_analyze();
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 120 );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		$content = $this->resolve_content( $post_id );

		if ( empty( trim( $content ) ) ) {
			wp_send_json_error( __( 'No content to summarize.', 'content-quality-analyzer' ) );
		}

		$api = new CQA_API();
		if ( ! $api->is_configured() ) {
			wp_send_json_error( __( 'Missing API key or model. Please configure the plugin.', 'content-quality-analyzer' ) );
		}

		$result = $api->generate_tldr( $content );

		if ( isset( $result['error'] ) ) {
			wp_send_json_error( $result['error'] );
		}

		wp_send_json_success( $result );
	}

	/* ── Test API key ─────────────────────────────────────── */

	public function test_api(): void {
		$this->verify_settings();

		$key = trim( sanitize_text_field( wp_unslash( $_POST['api_key'] ?? '' ) ) );
		if ( empty( $key ) ) {
			wp_send_json_error( __( 'Please provide an API key.', 'content-quality-analyzer' ) );
		}

		$api    = new CQA_API();
		$models = $api->get_models( $key );

		if ( empty( $models ) ) {
			wp_send_json_error( __( 'Invalid key or no models available — check your key permissions in Google AI Studio.', 'content-quality-analyzer' ) );
		}

		wp_send_json_success( [ 'models' => $models ] );
	}

	/* ── Search posts ─────────────────────────────────────── */

	public function search_posts(): void {
		$this->verify_analyze();

		$s     = sanitize_text_field( wp_unslash( $_POST['s'] ?? '' ) );
		$types = CQA_Settings::post_types();

		$query = new WP_Query( [
			's'              => $s,
			'post_type'      => $types,
			'post_status'    => 'publish',
			'posts_per_page' => 20,
			'fields'         => 'ids',
		] );

		$results = [];
		foreach ( $query->posts as $pid ) {
			$spell_d   = get_post_meta( $pid, '_cqa_spell_date',        true );
			$read_d    = get_post_meta( $pid, '_cqa_readability_date',  true );
			$ai_d      = get_post_meta( $pid, '_cqa_aifriendly_date',   true );
			$read_raw  = get_post_meta( $pid, '_cqa_readability_cache', true );
			$ai_raw    = get_post_meta( $pid, '_cqa_aifriendly_cache',  true );
			$read_data = $read_raw ? json_decode( $read_raw, true ) : null;
			$ai_data   = $ai_raw  ? json_decode( $ai_raw,  true ) : null;

			$results[] = [
				'id'         => $pid,
				'title'      => get_the_title( $pid ),
				'url'        => get_permalink( $pid ),
				'edit_url'   => get_edit_post_link( $pid, '' ),
				'type'       => get_post_type( $pid ),
				'spell_date' => $spell_d ? sprintf( __( '%s ago', 'content-quality-analyzer' ), human_time_diff( (int) $spell_d ) ) : null,
				'read_date'  => $read_d  ? sprintf( __( '%s ago', 'content-quality-analyzer' ), human_time_diff( (int) $read_d ) )  : null,
				'ai_date'    => $ai_d    ? sprintf( __( '%s ago', 'content-quality-analyzer' ), human_time_diff( (int) $ai_d ) )    : null,
				'read_score' => $read_data['score'] ?? null,
				'read_grade' => $read_data['grade'] ?? null,
				'ai_score'   => $ai_data['score']   ?? null,
				'ai_grade'   => $ai_data['grade']   ?? null,
			];
		}

		wp_send_json_success( $results );
	}

	/* ── Overview posts ───────────────────────────────────── */

	public function overview_posts(): void {
		$this->verify_analyze();

		// Support single post_type or post_types[] array
		$type_single = sanitize_key( wp_unslash( $_POST['post_type'] ?? '' ) );
		$type_multi  = isset( $_POST['post_types'] ) ? array_map( 'sanitize_key', (array) wp_unslash( $_POST['post_types'] ) ) : [];

		if ( ! empty( $type_multi ) ) {
			$types = $type_multi;
		} elseif ( $type_single ) {
			$types = [ $type_single ];
		} else {
			$types = CQA_Settings::post_types();
		}

		$query = new WP_Query( [
			'post_type'      => $types,
			'post_status'    => 'publish',
			'posts_per_page' => 200,
			'fields'         => 'ids',
			'orderby'        => 'date',
			'order'          => 'DESC',
		] );

		$results = [];
		foreach ( $query->posts as $pid ) {
			$read_raw   = get_post_meta( $pid, '_cqa_readability_cache', true );
			$ai_raw     = get_post_meta( $pid, '_cqa_aifriendly_cache',  true );
			$spell_raw  = get_post_meta( $pid, '_cqa_spell_cache',       true );
			$read_data  = $read_raw  ? json_decode( $read_raw,  true ) : null;
			$ai_data    = $ai_raw    ? json_decode( $ai_raw,    true ) : null;
			$spell_data = $spell_raw ? json_decode( $spell_raw, true ) : null;

			$read_d  = get_post_meta( $pid, '_cqa_readability_date', true );
			$ai_d    = get_post_meta( $pid, '_cqa_aifriendly_date',  true );
			$spell_d = get_post_meta( $pid, '_cqa_spell_date',        true );

			$results[] = [
				'id'           => $pid,
				'title'        => get_the_title( $pid ),
				'url'          => get_permalink( $pid ),
				'edit_url'     => get_edit_post_link( $pid, '' ),
				'type'         => get_post_type( $pid ),
				'read_score'   => $read_data  ? ( $read_data['score']  ?? null ) : null,
				'read_grade'   => $read_data  ? ( $read_data['grade']  ?? null ) : null,
				'ai_score'     => $ai_data    ? ( $ai_data['score']    ?? null ) : null,
				'ai_grade'     => $ai_data    ? ( $ai_data['grade']    ?? null ) : null,
				'spell_errors' => $spell_data ? count( $spell_data['spelling_errors'] ?? [] ) : null,
				'read_date'    => $read_d  ? sprintf( __( '%s ago', 'content-quality-analyzer' ), human_time_diff( (int) $read_d ) )  : null,
				'ai_date'      => $ai_d    ? sprintf( __( '%s ago', 'content-quality-analyzer' ), human_time_diff( (int) $ai_d ) )    : null,
				'spell_date'   => $spell_d ? sprintf( __( '%s ago', 'content-quality-analyzer' ), human_time_diff( (int) $spell_d ) ) : null,
			];
		}

		wp_send_json_success( $results );
	}

	/* ── Reset cost ───────────────────────────────────────── */

	public function reset_cost(): void {
		$this->verify_settings();
		update_option( 'cqa_api_total_cost', 0.0 );
		wp_send_json_success();
	}
}
