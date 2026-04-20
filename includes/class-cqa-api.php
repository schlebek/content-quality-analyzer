<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Gemini API wrapper for all 3 analysis types.
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
			return [ 'error' => 'Błąd połączenia: ' . $resp->get_error_message() ];
		}

		$data = json_decode( wp_remote_retrieve_body( $resp ), true );

		if ( isset( $data['error'] ) ) {
			$msg = sanitize_text_field( $data['error']['message'] ?? 'Nieznany błąd' );
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
			return [ 'error' => 'Niepoprawna odpowiedź JSON z API.' ];
		}

		return $parsed;
	}

	/* ── Spell check ──────────────────────────────────────── */

	public function spell_check( string $content ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		$prompt = "Jesteś ekspertem ortografii i gramatyki języka polskiego.\n"
			. "Przeanalizuj poniższy tekst i znajdź do 20 błędów: ortograficznych, interpunkcyjnych, gramatycznych i stylistycznych.\n"
			. "Odpowiedz TYLKO w formacie JSON (bez markdown):\n"
			. '{"spelling_errors":['
			. '{"wrong":"błędna forma","correct":"poprawna forma",'
			. '"type":"ortografia|gramatyka|interpunkcja|styl",'
			. '"context":"fragment zdania max 100 znaków",'
			. '"explanation":"krótkie wyjaśnienie max 80 znaków"}'
			. "]}\n"
			. "Jeśli brak błędów, zwróć: {\"spelling_errors\":[]}\n\n"
			. "TEKST:\n{$clean}";

		return $this->call( $prompt, 4096, 0.1 );
	}

	/* ── Readability analysis ─────────────────────────────── */

	public function readability( string $content ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		$prompt = "Jesteś ekspertem od analizy czytelności tekstów w języku polskim.\n"
			. "Przeprowadź pełną analizę czytelności poniższego tekstu.\n"
			. "Odpowiedz TYLKO w formacie JSON (bez markdown).\n\n"
			. "Wymagane pola JSON:\n"
			. "score (0-100, 100=max czytelny), grade (A/B/C/D/F),\n"
			. "reading_level (\"bardzo łatwy\"|\"łatwy\"|\"średni\"|\"trudny\"|\"bardzo trudny\"),\n"
			. "reading_level_description (dla kogo jest tekst, max 60 znaków),\n"
			. "reading_time_minutes (liczba dziesiętna), word_count, sentence_count, paragraph_count,\n"
			. "avg_sentence_length (śr. liczba słów w zdaniu),\n"
			. "long_sentences_count (zdania >30 słów), short_sentences_count (zdania <8 słów),\n"
			. "passive_voice_pct (0-100), complex_words_pct (słowa >3 sylaby, 0-100),\n"
			. "vocabulary_richness (\"uboga\"|\"średnia\"|\"bogata\"|\"bardzo bogata\"),\n"
			. "heading_count (liczba H2/H3), heading_structure (\"brak\"|\"słaba\"|\"dobra\"|\"bardzo dobra\"),\n"
			. "paragraph_structure (\"za krótkie\"|\"optymalna\"|\"za długie\"),\n"
			. "connective_words_quality (\"słabe\"|\"dobre\"|\"bardzo dobre\"),\n"
			. "logical_flow_score (1-10), emotional_engagement (\"niskie\"|\"średnie\"|\"wysokie\"),\n"
			. "clarity_score (1-10), conciseness_score (1-10),\n"
			. "jargon_density (\"brak\"|\"niska\"|\"średnia\"|\"wysoka\"),\n"
			. "sentence_variety (\"monotonna\"|\"umiarkowana\"|\"zróżnicowana\"),\n"
			. "issues (max 8: [{\"category\",\"description\",\"suggestion\",\"severity\":\"low|medium|high\"}]),\n"
			. "strengths (max 5 mocnych stron, tablica stringów),\n"
			. "top_improvements (3 najważniejsze rekomendacje, tablica stringów)\n\n"
			. "TEKST:\n{$clean}";

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
					? 'PublishPress Authors: bio autora widoczne w widgecie poza treścią.'
					: 'PublishPress Authors: brak bio autora.';
			} else {
				$post = get_post( $post_id );
				if ( $post && trim( get_the_author_meta( 'description', $post->post_author ) ) !== '' ) {
					$has_author_bio = true;
					$ctx_lines[]    = 'Autor wpisu ma bio w profilu WP (poza treścią artykułu).';
				}
			}
		}

		if ( $has_faq ) {
			$ctx_lines[] = 'Rank Math FAQ block: schema FAQPage generowana automatycznie.';
		}
		if ( defined( 'RANK_MATH_VERSION' ) || class_exists( 'RankMath' ) ) {
			$ctx_lines[] = 'Rank Math SEO aktywny: schema Article i BreadcrumbList automatyczne.';
		}

		$ctx_block   = empty( $ctx_lines ) ? '' : "\n\nKONTEKST TECHNICZNY (uwzględnij przy ocenie):\n"
		             . implode( "\n", array_map( fn( $c ) => '- ' . $c, $ctx_lines ) ) . "\n";
		$eeat_note   = $has_author_bio ? ' (bio poza treścią — oceń jako pass)' : '';
		$schema_note = $has_faq        ? ' (FAQ przez Rank Math — oceń jako pass)' : '';

		$prompt = "Jesteś ekspertem od GEO (Generative Engine Optimization) i LLM-friendly content.\n"
			. "Przeanalizuj tekst według 20 kryteriów AI-friendly i zwróć TYLKO JSON (bez markdown).\n\n"
			. "KRYTERIA (status: \"pass\"/\"warn\"/\"fail\" + note max 100 znaków):\n"
			. "1. h1_hierarchy — Jeden H1, logiczna hierarchia H2/H3\n"
			. "2. paragraph_length — Akapity 1-4 zdań, brak ścian tekstu\n"
			. "3. logical_sections — Wyraźnie wydzielone sekcje tematyczne\n"
			. "4. lists_tables — Listy punktowane/numerowane lub tabele\n"
			. "5. answer_first — Kluczowa odpowiedź na początku (odwrócona piramida)\n"
			. "6. semantic_coherence — Spójna terminologia i pojęcia\n"
			. "7. language_variation — Naturalne synonimy, różnorodność językowa\n"
			. "8. plain_language — Brak niewyjaśnionego żargonu\n"
			. "9. short_sentences — Zdania krótkie i bezpośrednie (<20 słów)\n"
			. "10. explicit_context — Kontekst wyrażony wprost, nie przez domysł\n"
			. "11. information_density — Wysoka gęstość informacji, brak pustych fraz\n"
			. "12. topic_completeness — Wyczerpujące pokrycie głównego tematu\n"
			. "13. citations_sources — Cytowania źródeł lub odniesienia do danych\n"
			. "14. emphasis_elements — Pogrubienia, TL;DR lub streszczenie na końcu\n"
			. "15. multimedia_context — Alt text i podpisy pod obrazami\n"
			. "16. schema_signals — FAQ, HowTo, listy kroków, definicje{$schema_note}\n"
			. "17. eeat_signals — Sygnały eksperta: doświadczenie, autorytet, wiarygodność{$eeat_note}\n"
			. "18. content_freshness — Aktualne informacje, brak przestarzałych danych\n"
			. "19. entity_richness — Bogate użycie encji: osoby, miejsca, organizacje, produkty\n"
			. "20. data_statistics — Konkretne dane, liczby, statystyki lub wyniki badań\n\n"
			. "Score = count(pass)×5 + count(warn)×2.5 (max 100)\n\n"
			. 'Format: {"score":85,"grade":"B","criteria":['
			. '{"id":"h1_hierarchy","label":"Hierarchia nagłówków","status":"pass","note":""},'
			. '{"id":"paragraph_length","label":"Długość akapitów","status":"warn","note":"sugestia"}],'
			. '"summary":"2-3 zdania ogólnej oceny po polsku",'
			. '"top_improvements":["poprawa 1","poprawa 2","poprawa 3"]}'
			. $ctx_block . "\n"
			. ( $title ? "TYTUŁ: {$title}\n\n" : '' )
			. "TREŚĆ:\n{$clean}";

		return $this->call( $prompt, 4096, 0.2 );
	}

	/* ── Rewrite fragment ────────────────────────────────── */

	public function rewrite_fragment( string $fragment, string $hint = '' ): array {
		$clean     = mb_substr( $fragment, 0, 3000 );
		$hint_text = $hint ? "\nWskazówka: {$hint}" : '';

		$prompt = "Jesteś ekspertem od pisania treści w języku polskim, zoptymalizowanych pod AI.\n"
			. "Przepisz poniższy fragment tak, aby był bardziej czytelny, zwięzły i AI-friendly.\n"
			. "Zachowaj sens i ton oryginału. Podaj 3 alternatywne wersje.\n"
			. "Odpowiedz TYLKO w formacie JSON (bez markdown):\n"
			. '{"original":"oryginalny fragment","rewrites":["wersja 1","wersja 2","wersja 3"],'
			. '"improvements":["co poprawiono 1","co poprawiono 2","co poprawiono 3"]}'
			. $hint_text
			. "\n\nFRAGMENT:\n{$clean}";

		return $this->call( $prompt, 2048, 0.7 );
	}

	/* ── TL;DR generator ──────────────────────────────────── */

	public function generate_tldr( string $content ): array {
		$clean = mb_substr( wp_strip_all_tags( $content ), 0, 8000 );

		$prompt = "Jesteś ekspertem od skracania i podsumowywania treści w języku polskim.\n"
			. "Wygeneruj TL;DR dla poniższego artykułu.\n"
			. "Odpowiedz TYLKO w formacie JSON (bez markdown):\n"
			. '{"tldr":"1-3 zdania, max 200 znaków",'
			. '"key_points":["punkt 1","punkt 2","punkt 3","punkt 4","punkt 5"],'
			. '"one_line":"jedno zdanie max 80 znaków"}'
			. "\n\nTREŚĆ:\n{$clean}";

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
