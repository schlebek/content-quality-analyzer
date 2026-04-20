<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Gemini API wrapper for all analysis types.
 * Prompts are language-neutral — AI responds in the same language as the input text.
 */
class CQA_API {

	private string $api_key;
	private string $model;

	public function __construct() {
		$this->api_key = CQA_Settings::api_key();
		$this->model   = CQA_Settings::model();
	}

	public function is_configured(): bool {
		return $this->api_key !== '' && $this->model !== '';
	}

	private function url(): string {
		return "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->api_key}";
	}

	private function call( string $prompt, int $max_tokens = 4096, float $temp = 0.2 ): array {
		$resp = wp_remote_post( $this->url(), array(
			'headers' => array( 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array(
				'contents'         => array( array( 'parts' => array( array( 'text' => $prompt ) ) ) ),
				'generationConfig' => array( 'temperature' => $temp, 'maxOutputTokens' => $max_tokens ),
			) ),
			'timeout' => 120,
		) );

		if ( is_wp_error( $resp ) ) {
			return array( 'error' => 'Connection error: ' . $resp->get_error_message() );
		}

		$data = json_decode( wp_remote_retrieve_body( $resp ), true );

		if ( isset( $data['error'] ) ) {
			$msg = sanitize_text_field( $data['error']['message'] ?? 'Unknown error' );
			$msg = preg_replace( '/key[=:\s]+\S+/i', 'key=[HIDDEN]', $msg );
			return [ 'error' => 'API: ' . $msg ];
		}

		// Track cost
		if ( isset( $data['usageMetadata'] ) ) {
			$in     = (int) ( $data['usageMetadata']['promptTokenCount']     ?? 0 );
			$out    = (int) ( $data['usageMetadata']['candidatesTokenCount'] ?? 0 );
			$is_pro = stripos( $this->model, 'pro' ) !== false;
			$cost   = ( $in / 1e6 ) * ( $is_pro ? 1.25 : 0.075 )
			        + ( $out / 1e6 ) * ( $is_pro ? 5.0  : 0.30 );
			update_option( 'cqa_api_total_cost', (float) get_option( 'cqa_api_total_cost', 0.0 ) + $cost );
		}

		$raw = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
		$raw = preg_replace( '/^```(?:json)?\s*/i', '', trim( $raw ) );
		$raw = preg_replace( '/\s*```$/', '', $raw );
		preg_match( '/\{.*\}/s', $raw, $m );
		$json_str = $m[0] ?? '';
		$json_str = preg_replace( '/,\s*([\]}])/s', '$1', $json_str );
		$parsed   = json_decode( $json_str, true );

		if ( ! $parsed ) {
			return array( 'error' => 'Invalid JSON response from API.' );
		}

		return $parsed;
	}

	/* ── Spell check ──────────────────────────────────────── */

	public function spell_check( string $content ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		$prompt = "You are a language expert specializing in grammar, spelling, punctuation, and style.\n"
			. "Analyze the text below and identify up to 20 errors.\n"
			. "Respond ONLY in valid JSON (no markdown). Use the same language as the input text for all text values.\n\n"
			. 'Format: {"spelling_errors":['
			. '{"wrong":"incorrect form","correct":"corrected form",'
			. '"type":"spelling|grammar|punctuation|style",'
			. '"context":"sentence fragment max 100 chars",'
			. '"explanation":"brief explanation max 80 chars"}'
			. "]}\n"
			. "If no errors found, return: {\"spelling_errors\":[]}\n\n"
			. "TEXT:\n{$clean}";

		return $this->call( $prompt, 4096, 0.1 );
	}

	/* ── Readability analysis ─────────────────────────────── */

	public function readability( string $content ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		$prompt = "You are a text readability expert. Perform a full readability analysis of the text below.\n"
			. "Respond ONLY in valid JSON (no markdown). Use the same language as the input text for all descriptive text values.\n\n"
			. "Required JSON fields:\n"
			. "score (0-100, 100=most readable), grade (A/B/C/D/F),\n"
			. "reading_level (plain-language label in the input language),\n"
			. "reading_level_description (for whom the text is suited, max 60 chars, in input language),\n"
			. "reading_time_minutes (decimal), word_count, sentence_count, paragraph_count,\n"
			. "avg_sentence_length (avg words per sentence),\n"
			. "long_sentences_count (sentences >30 words), short_sentences_count (sentences <8 words),\n"
			. "passive_voice_pct (0-100), complex_words_pct (words >3 syllables, 0-100),\n"
			. "vocabulary_richness (label in input language),\n"
			. "heading_count (number of H2/H3), heading_structure (label in input language),\n"
			. "paragraph_structure (label in input language),\n"
			. "connective_words_quality (label in input language),\n"
			. "logical_flow_score (1-10), emotional_engagement (label in input language),\n"
			. "clarity_score (1-10), conciseness_score (1-10),\n"
			. "jargon_density (label in input language),\n"
			. "sentence_variety (label in input language),\n"
			. "issues (max 8: [{\"category\",\"description\",\"suggestion\",\"severity\":\"low|medium|high\"}] — all text in input language),\n"
			. "strengths (max 5 strengths, string array in input language),\n"
			. "top_improvements (3 most important recommendations, string array in input language)\n\n"
			. "TEXT:\n{$clean}";

		return $this->call( $prompt, 4096, 0.2 );
	}

	/* ── AI-Friendly check ────────────────────────────────── */

	public function ai_friendly( string $content, string $title = '', int $post_id = 0 ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		// Detect site context
		$ctx_lines      = [];
		$has_author_bio = false;
		$has_faq        = strpos( $content, 'wp:rank-math/faq-block' ) !== false
		               || strpos( $content, 'rank-math/faq' )          !== false;

		if ( $post_id > 0 ) {
			if ( function_exists( 'get_multiple_authors' ) ) {
				foreach ( (array) get_multiple_authors( $post_id, false, false ) as $a ) {
					$bio = is_object( $a )
						? (string) ( method_exists( $a, 'get_field' ) ? $a->get_field( 'description' ) : ( $a->description ?? '' ) )
						: '';
					if ( trim( $bio ) !== '' ) {
						$has_author_bio = true;
						break;
					}
				}
				$ctx_lines[] = $has_author_bio
					? 'PublishPress Authors: author bio visible in widget outside the content.'
					: 'PublishPress Authors: no author bio.';
			} else {
				$post = get_post( $post_id );
				if ( $post && trim( get_the_author_meta( 'description', $post->post_author ) ) !== '' ) {
					$has_author_bio = true;
					$ctx_lines[]    = 'Post author has bio in WP profile (outside article content).';
				}
			}
		}

		if ( $has_faq ) {
			$ctx_lines[] = 'Rank Math FAQ block: FAQPage schema generated automatically.';
		}
		if ( defined( 'RANK_MATH_VERSION' ) || class_exists( 'RankMath' ) ) {
			$ctx_lines[] = 'Rank Math SEO active: Article and BreadcrumbList schema automatic.';
		}

		$ctx_block   = empty( $ctx_lines ) ? '' : "\n\nTECHNICAL CONTEXT (consider when scoring):\n"
		             . implode( "\n", array_map( fn( $c ) => '- ' . $c, $ctx_lines ) ) . "\n";
		$eeat_note   = $has_author_bio ? ' (bio outside content — score as pass)' : '';
		$schema_note = $has_faq        ? ' (FAQ via Rank Math — score as pass)' : '';

		$prompt = "You are a GEO (Generative Engine Optimization) and LLM-friendly content expert.\n"
			. "Analyze the text against 20 AI-friendly criteria and return ONLY valid JSON (no markdown).\n"
			. "Use the same language as the input text for all 'note' values and the 'summary' and 'top_improvements' fields.\n\n"
			. "CRITERIA (status: \"pass\"/\"warn\"/\"fail\" + note max 100 chars in input language):\n"
			. "1. h1_hierarchy — Single H1, logical H2/H3 hierarchy\n"
			. "2. paragraph_length — Paragraphs 1-4 sentences, no walls of text\n"
			. "3. logical_sections — Clearly defined thematic sections\n"
			. "4. lists_tables — Bullet/numbered lists or tables present\n"
			. "5. answer_first — Key answer at the top (inverted pyramid)\n"
			. "6. semantic_coherence — Consistent terminology and concepts\n"
			. "7. language_variation — Natural synonyms, linguistic variety\n"
			. "8. plain_language — No unexplained jargon\n"
			. "9. short_sentences — Sentences short and direct (<20 words)\n"
			. "10. explicit_context — Context stated directly, not implied\n"
			. "11. information_density — High info density, no filler phrases\n"
			. "12. topic_completeness — Comprehensive coverage of main topic\n"
			. "13. citations_sources — Sources cited or data referenced\n"
			. "14. emphasis_elements — Bold text, TL;DR or summary present\n"
			. "15. multimedia_context — Alt text and captions on images\n"
			. "16. schema_signals — FAQ, HowTo, step lists, definitions{$schema_note}\n"
			. "17. eeat_signals — E-E-A-T: experience, expertise, authority, trust{$eeat_note}\n"
			. "18. content_freshness — Up-to-date information, no outdated data\n"
			. "19. entity_richness — Rich use of entities: people, places, organizations, products\n"
			. "20. data_statistics — Concrete data, numbers, statistics or research results\n\n"
			. "Score = count(pass)×5 + count(warn)×2.5 (max 100)\n\n"
			. 'Format: {"score":85,"grade":"B","criteria":['
			. '{"id":"h1_hierarchy","label":"H1 Hierarchy","status":"pass","note":""}],'
			. '"summary":"2-3 sentence overall assessment in the input language",'
			. '"top_improvements":["improvement 1","improvement 2","improvement 3"]}'
			. $ctx_block . "\n"
			. ( $title ? "TITLE: {$title}\n\n" : '' )
			. "CONTENT:\n{$clean}";

		return $this->call( $prompt, 4096, 0.2 );
	}

	/* ── Rewrite fragment ────────────────────────────────── */

	public function rewrite_fragment( string $fragment, string $hint = '' ): array {
		$clean     = mb_substr( $fragment, 0, 3000 );
		$hint_text = $hint ? "\nHint: {$hint}" : '';

		$prompt = "You are a content writing expert specializing in clear, AI-optimized writing.\n"
			. "Rewrite the text fragment below to be more readable, concise, and AI-friendly.\n"
			. "Preserve the original meaning and tone. Provide 3 alternative versions.\n"
			. "Use the same language as the input fragment for all output.\n"
			. "Respond ONLY in valid JSON (no markdown):\n"
			. '{"original":"original fragment","rewrites":["version 1","version 2","version 3"],'
			. '"improvements":["what was improved 1","what was improved 2","what was improved 3"]}'
			. $hint_text
			. "\n\nFRAGMENT:\n{$clean}";

		return $this->call( $prompt, 2048, 0.7 );
	}

	/* ── TL;DR generator ──────────────────────────────────── */

	public function generate_tldr( string $content ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		$prompt = "You are an expert at summarizing content concisely.\n"
			. "Generate a TL;DR for the article below.\n"
			. "Use the same language as the input text for all output.\n"
			. "Respond ONLY in valid JSON (no markdown):\n"
			. '{"tldr":"1-3 sentences, max 200 chars",'
			. '"key_points":["point 1","point 2","point 3","point 4","point 5"],'
			. '"one_line":"one sentence max 80 chars"}'
			. "\n\nCONTENT:\n{$clean}";

		return $this->call( $prompt, 1024, 0.3 );
	}

	/* ── Fetch available Gemini models ────────────────────── */

	public function get_models( string $key = '' ): array {
		$api_key = $key ?: $this->api_key;
		if ( empty( $api_key ) ) return [];

		$resp = wp_remote_get(
			'https://generativelanguage.googleapis.com/v1beta/models?key=' . rawurlencode( $api_key ),
			array( 'timeout' => 15 )
		);
		if ( is_wp_error( $resp ) ) return [];

		$body = json_decode( wp_remote_retrieve_body( $resp ), true );
		if ( empty( $body['models'] ) ) return [];

		$models = [];
		foreach ( $body['models'] as $m ) {
			if ( in_array( 'generateContent', $m['supportedGenerationMethods'] ?? [], true ) ) {
				$models[] = str_replace( 'models/', '', $m['name'] );
			}
		}
		return $models;
	}
}
