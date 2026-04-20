<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class CQA_Metabox {

	public function __construct() {
		add_action( 'add_meta_boxes',        array( $this, 'register' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function register(): void {
		$types = CQA_Settings::post_types();
		if ( empty( $types ) ) return;

		add_meta_box(
			'cqa-analyzer',
			__( 'Content Quality Analyzer', 'content-quality-analyzer' ),
			array( $this, 'render' ),
			$types,
			'advanced',
			'low'
		);
	}

	public function render( WP_Post $post ): void {
		$spell_raw  = get_post_meta( $post->ID, '_cqa_spell_cache',       true );
		$read_raw   = get_post_meta( $post->ID, '_cqa_readability_cache',  true );
		$ai_raw     = get_post_meta( $post->ID, '_cqa_aifriendly_cache',   true );
		$spell_date = get_post_meta( $post->ID, '_cqa_spell_date',         true );
		$read_date  = get_post_meta( $post->ID, '_cqa_readability_date',   true );
		$ai_date    = get_post_meta( $post->ID, '_cqa_aifriendly_date',    true );

		$spell_cache = $spell_raw ? json_decode( $spell_raw, true ) : null;
		$read_cache  = $read_raw  ? json_decode( $read_raw,  true ) : null;
		$ai_cache    = $ai_raw    ? json_decode( $ai_raw,    true ) : null;

		/* translators: %d: number of errors */
		$spell_badge = $spell_cache ? ( count( $spell_cache['spelling_errors'] ?? array() ) . ' ' . __( 'errors', 'content-quality-analyzer' ) ) : '';
		$read_badge  = $read_cache  ? ( ( $read_cache['score'] ?? '?' ) . '/100 ' . ( $read_cache['grade'] ?? '' ) ) : '';
		$ai_badge    = $ai_cache    ? ( ( $ai_cache['score']   ?? '?' ) . '/100 ' . ( $ai_cache['grade']   ?? '' ) ) : '';

		/* translators: %s: time difference (e.g. "5 minutes") */
		$ago = __( '%s ago', 'content-quality-analyzer' );
		?>
		<div id="cqa-panel" data-post-id="<?php echo esc_attr( $post->ID ); ?>">

			<!-- Analyze All -->
			<div class="cqa-topbar">
				<button type="button" id="cqa-btn-all" class="button button-primary cqa-btn-main">
					✨ <?php esc_html_e( 'Analyze all', 'content-quality-analyzer' ); ?>
				</button>
				<div id="cqa-all-progress" style="display:none;">
					<div class="cqa-progress-wrap">
						<div class="cqa-progress-bar"><div id="cqa-all-fill" class="cqa-progress-fill"></div></div>
						<span id="cqa-all-pct" class="cqa-progress-pct">0%</span>
					</div>
					<div id="cqa-all-label" class="cqa-progress-label"><?php esc_html_e( 'Preparing…', 'content-quality-analyzer' ); ?></div>
				</div>
				<span id="cqa-all-cost" class="cqa-cost-info" style="display:none;"></span>
			</div>

			<!-- Section 1: Spell Check -->
			<div class="cqa-section" id="cqa-section-spell">
				<div class="cqa-section-header cqa-toggle" data-key="spell">
					<div class="cqa-header-left">
						<span>🔤</span>
						<span><?php esc_html_e( 'Spelling Corrector', 'content-quality-analyzer' ); ?></span>
						<?php if ( $spell_badge ) : ?>
							<span class="cqa-badge <?php echo $spell_cache && empty( $spell_cache['spelling_errors'] ) ? 'badge-green' : 'badge-red'; ?>"
								id="cqa-badge-spell"><?php echo esc_html( $spell_badge ); ?></span>
						<?php else : ?>
							<span class="cqa-badge" id="cqa-badge-spell" style="display:none;"></span>
						<?php endif; ?>
						<?php if ( $spell_date ) : ?>
							<span class="cqa-cache-info"><?php printf( esc_html( $ago ), esc_html( human_time_diff( (int) $spell_date ) ) ); ?></span>
						<?php endif; ?>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<div class="cqa-action-bar">
						<button type="button" id="cqa-btn-spell" class="button button-secondary cqa-analyze-btn">
							🔍 <?php esc_html_e( 'Check spelling', 'content-quality-analyzer' ); ?>
						</button>
						<span id="cqa-spell-status" class="cqa-status"></span>
					</div>
					<div id="cqa-spell-empty" style="display:none;">
						<p class="cqa-empty-msg"><?php esc_html_e( 'No errors found. Text looks correct.', 'content-quality-analyzer' ); ?></p>
					</div>
					<div id="cqa-spell-list"></div>
					<div id="cqa-spell-actions" style="display:none;" class="cqa-spell-actions-bar">
						<button type="button" id="cqa-spell-fix-all" class="button button-primary cqa-analyze-btn">
							✓ <?php esc_html_e( 'Apply selected fixes', 'content-quality-analyzer' ); ?>
						</button>
						<button type="button" id="cqa-spell-dismiss" class="button cqa-analyze-btn">
							✕ <?php esc_html_e( 'Dismiss all', 'content-quality-analyzer' ); ?>
						</button>
					</div>
				</div>
			</div>

			<!-- Section 2: Readability -->
			<div class="cqa-section" id="cqa-section-readability">
				<div class="cqa-section-header cqa-toggle" data-key="readability">
					<div class="cqa-header-left">
						<span>📊</span>
						<span><?php esc_html_e( 'Text Readability', 'content-quality-analyzer' ); ?></span>
						<?php if ( $read_badge ) :
							$read_cls = isset( $read_cache['score'] ) ? ( $read_cache['score'] >= 70 ? 'badge-green' : ( $read_cache['score'] >= 50 ? 'badge-yellow' : 'badge-orange' ) ) : '';
						?>
							<span class="cqa-badge <?php echo esc_attr( $read_cls ); ?>"
								id="cqa-badge-readability"><?php echo esc_html( $read_badge ); ?></span>
						<?php else : ?>
							<span class="cqa-badge" id="cqa-badge-readability" style="display:none;"></span>
						<?php endif; ?>
						<?php if ( $read_date ) : ?>
							<span class="cqa-cache-info"><?php printf( esc_html( $ago ), esc_html( human_time_diff( (int) $read_date ) ) ); ?></span>
						<?php endif; ?>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<div class="cqa-action-bar">
						<button type="button" id="cqa-btn-readability" class="button button-secondary cqa-analyze-btn">
							📊 <?php esc_html_e( 'Analyze readability', 'content-quality-analyzer' ); ?>
						</button>
						<span id="cqa-readability-status" class="cqa-status"></span>
					</div>
					<div id="cqa-readability-results" style="display:none;"></div>
				</div>
			</div>

			<!-- Section 3: AI-Friendly -->
			<div class="cqa-section" id="cqa-section-aifriendly">
				<div class="cqa-section-header cqa-toggle" data-key="aifriendly">
					<div class="cqa-header-left">
						<span>🤖</span>
						<span><?php esc_html_e( 'AI-Friendly Check', 'content-quality-analyzer' ); ?></span>
						<?php if ( $ai_badge ) :
							$ai_cls = isset( $ai_cache['score'] ) ? ( $ai_cache['score'] >= 80 ? 'badge-green' : ( $ai_cache['score'] >= 60 ? 'badge-yellow' : ( $ai_cache['score'] >= 40 ? 'badge-orange' : 'badge-red' ) ) ) : '';
						?>
							<span class="cqa-badge <?php echo esc_attr( $ai_cls ); ?>"
								id="cqa-badge-aifriendly"><?php echo esc_html( $ai_badge ); ?></span>
						<?php else : ?>
							<span class="cqa-badge" id="cqa-badge-aifriendly" style="display:none;"></span>
						<?php endif; ?>
						<?php if ( $ai_date ) : ?>
							<span class="cqa-cache-info"><?php printf( esc_html( $ago ), esc_html( human_time_diff( (int) $ai_date ) ) ); ?></span>
						<?php endif; ?>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<div class="cqa-action-bar">
						<button type="button" id="cqa-btn-aifriendly" class="button button-secondary cqa-analyze-btn">
							🤖 <?php esc_html_e( 'Check AI-Friendly', 'content-quality-analyzer' ); ?>
						</button>
						<span id="cqa-aifriendly-status" class="cqa-status"></span>
					</div>
					<div id="cqa-aifriendly-results" style="display:none;"></div>
				</div>
			</div>

			<!-- Section 4: Heading Structure (client-side) -->
			<div class="cqa-section" id="cqa-section-headings">
				<div class="cqa-section-header cqa-toggle" data-key="headings">
					<div class="cqa-header-left">
						<span>📑</span>
						<span><?php esc_html_e( 'Heading Structure', 'content-quality-analyzer' ); ?></span>
						<span class="cqa-badge" id="cqa-badge-headings" style="display:none;"></span>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<div class="cqa-action-bar">
						<button type="button" id="cqa-btn-headings" class="button button-secondary cqa-analyze-btn">
							📑 <?php esc_html_e( 'Analyze headings', 'content-quality-analyzer' ); ?>
						</button>
					</div>
					<div id="cqa-headings-results"></div>
				</div>
			</div>

			<!-- Section 5: TL;DR Generator -->
			<div class="cqa-section" id="cqa-section-tldr">
				<div class="cqa-section-header cqa-toggle" data-key="tldr">
					<div class="cqa-header-left">
						<span>📝</span>
						<span><?php esc_html_e( 'TL;DR Generator', 'content-quality-analyzer' ); ?></span>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<div class="cqa-action-bar">
						<button type="button" id="cqa-btn-tldr" class="button button-secondary cqa-analyze-btn">
							📝 <?php esc_html_e( 'Generate TL;DR', 'content-quality-analyzer' ); ?>
						</button>
						<span id="cqa-tldr-status" class="cqa-status"></span>
					</div>
					<div id="cqa-tldr-output" class="cqa-tldr-output"></div>
				</div>
			</div>

			<!-- Section 6: Rewrite Fragment -->
			<div class="cqa-section" id="cqa-section-rewrite">
				<div class="cqa-section-header cqa-toggle" data-key="rewrite">
					<div class="cqa-header-left">
						<span>✏️</span>
						<span><?php esc_html_e( 'Rewrite Fragment', 'content-quality-analyzer' ); ?></span>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<p class="cqa-hint"><?php esc_html_e( 'Paste a text fragment to rewrite:', 'content-quality-analyzer' ); ?></p>
					<textarea id="cqa-rewrite-input" rows="4" class="cqa-textarea"
						placeholder="<?php esc_attr_e( 'Paste text fragment…', 'content-quality-analyzer' ); ?>"></textarea>
					<div class="cqa-rewrite-hint-wrap">
						<input type="text" id="cqa-rewrite-hint" class="cqa-input-full"
							placeholder="<?php esc_attr_e( 'Hint (optional): e.g. simplify sentences, add examples…', 'content-quality-analyzer' ); ?>">
					</div>
					<div class="cqa-action-bar cqa-action-bar-top">
						<button type="button" id="cqa-btn-rewrite" class="button button-secondary cqa-analyze-btn">
							✏️ <?php esc_html_e( 'Rewrite fragment', 'content-quality-analyzer' ); ?>
						</button>
						<span id="cqa-rewrite-status" class="cqa-status"></span>
					</div>
					<div id="cqa-rewrite-output" class="cqa-rewrite-panels"></div>
				</div>
			</div>

			<!-- Section 7: Analysis History -->
			<div class="cqa-section" id="cqa-section-history">
				<div class="cqa-section-header cqa-toggle" data-key="history">
					<div class="cqa-header-left">
						<span>📈</span>
						<span><?php esc_html_e( 'Analysis History', 'content-quality-analyzer' ); ?></span>
					</div>
					<span class="cqa-chevron">▾</span>
				</div>
				<div class="cqa-section-body">
					<div id="cqa-history-wrap"></div>
				</div>
			</div>

		</div><!-- /#cqa-panel -->
		<?php
	}

	public function enqueue( string $hook ): void {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) return;

		$screen = get_current_screen();
		if ( ! $screen || ! in_array( $screen->post_type, CQA_Settings::post_types(), true ) ) return;

		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;

		$spell_raw   = $post_id ? get_post_meta( $post_id, '_cqa_spell_cache',       true ) : '';
		$read_raw    = $post_id ? get_post_meta( $post_id, '_cqa_readability_cache',  true ) : '';
		$ai_raw      = $post_id ? get_post_meta( $post_id, '_cqa_aifriendly_cache',   true ) : '';
		$history_raw = $post_id ? get_post_meta( $post_id, '_cqa_history',            true ) : '';

		wp_enqueue_style(
			'cqa-admin',
			CQA_PLUGIN_URL . 'assets/css/cqa.css',
			array(),
			CQA_VERSION
		);

		wp_enqueue_script(
			'cqa-metabox',
			CQA_PLUGIN_URL . 'assets/js/cqa-metabox.js',
			array( 'jquery' ),
			CQA_VERSION,
			true
		);

		$localize = array(
			'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
			'nonce'         => wp_create_nonce( 'cqa_nonce' ),
			'postId'        => $post_id,
			'settingsUrl'   => admin_url( 'admin.php?page=content-quality-analyzer' ),
			'cachedSpell'   => $spell_raw   ? json_decode( $spell_raw,   true ) : null,
			'cachedRead'    => $read_raw    ? json_decode( $read_raw,    true ) : null,
			'cachedAi'      => $ai_raw      ? json_decode( $ai_raw,      true ) : null,
			'cachedHistory' => $history_raw ? json_decode( $history_raw, true ) : null,
		);

		wp_localize_script( 'cqa-metabox', 'cqaPanel', $localize );

		// Gutenberg Plugin Sidebar — only on block editor screens
		if ( $screen->is_block_editor() ) {
			wp_enqueue_script(
				'cqa-sidebar',
				CQA_PLUGIN_URL . 'assets/js/cqa-sidebar.js',
				array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-data', 'wp-components' ),
				CQA_VERSION,
				true
			);
		}
	}
}
