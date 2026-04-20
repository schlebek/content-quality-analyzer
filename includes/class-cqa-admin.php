<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class CQA_Admin {

	public function __construct() {
		add_action( 'admin_menu',            array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function register_menu(): void {
		add_menu_page(
			__( 'Content Quality Analyzer', 'content-quality-analyzer' ),
			__( 'Content Analyzer', 'content-quality-analyzer' ),
			'edit_posts',
			'content-quality-analyzer',
			array( $this, 'render_page' ),
			'dashicons-editor-spell',
			25
		);
	}

	public function enqueue( string $hook ): void {
		if ( strpos( $hook, 'content-quality-analyzer' ) === false ) return;

		wp_enqueue_style(  'cqa-admin', CQA_PLUGIN_URL . 'assets/css/cqa.css',      array(), CQA_VERSION );
		wp_enqueue_script( 'cqa-admin', CQA_PLUGIN_URL . 'assets/js/cqa-admin.js', array( 'jquery' ), CQA_VERSION, true );

		$api_key = CQA_Settings::api_key();
		$models  = array();
		if ( ! empty( $api_key ) ) {
			$models = ( new CQA_API() )->get_models();
		}

		$public_types = get_post_types( array( 'public' => true ), 'objects' );
		unset( $public_types['attachment'] );

		wp_localize_script( 'cqa-admin', 'cqaAdmin', array(
			'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
			'nonce'            => wp_create_nonce( 'cqa_nonce' ),
			'models'           => $models,
			'savedModel'       => CQA_Settings::model(),
			'totalCost'        => number_format( (float) get_option( 'cqa_api_total_cost', 0.0 ), 5 ),
			'canManageOptions' => current_user_can( 'manage_options' ),
			'publicPostTypes'  => array_values( array_map( static function ( $pt ) {
				return array(
					'name'  => $pt->name,
					'label' => $pt->label,
				);
			}, $public_types ) ),
			'i18n'             => array(
				'loading'          => __( 'Loading…', 'content-quality-analyzer' ),
				'errPrefix'        => __( 'Error: ', 'content-quality-analyzer' ),
				'unknownError'     => __( 'Unknown error', 'content-quality-analyzer' ),
				'connectionError'  => __( 'Connection error.', 'content-quality-analyzer' ),
				'posts'            => __( 'posts', 'content-quality-analyzer' ),
				'noPosts'          => __( 'No posts.', 'content-quality-analyzer' ),
				'noPostsFound'     => __( 'No posts found.', 'content-quality-analyzer' ),
				'colTitle'         => __( 'Title', 'content-quality-analyzer' ),
				'colType'          => __( 'Type', 'content-quality-analyzer' ),
				'colActions'       => __( 'Actions', 'content-quality-analyzer' ),
				'noTitle'          => __( '(no title)', 'content-quality-analyzer' ),
				'preview'          => __( 'Preview', 'content-quality-analyzer' ),
				'selectOneType'    => __( 'Please select at least one type.', 'content-quality-analyzer' ),
				'searching'        => __( 'Searching…', 'content-quality-analyzer' ),
				'enterApiKey'      => __( 'Please enter an API key.', 'content-quality-analyzer' ),
				'testing'          => __( 'Testing…', 'content-quality-analyzer' ),
				'connected'        => __( 'Connected! Models loaded.', 'content-quality-analyzer' ),
				'noModels'         => __( 'No models available', 'content-quality-analyzer' ),
				'done'             => __( 'Done!', 'content-quality-analyzer' ),
				'preparing'        => __( 'Preparing…', 'content-quality-analyzer' ),
				'checkingSpelling' => __( 'Checking spelling…', 'content-quality-analyzer' ),
				'analyzingRead'    => __( 'Analyzing readability…', 'content-quality-analyzer' ),
				'checkingAI'       => __( 'Checking AI-Friendly…', 'content-quality-analyzer' ),
				'batchStopped'     => __( 'Stopped by user.', 'content-quality-analyzer' ),
				'stepSpelling'     => __( 'spelling', 'content-quality-analyzer' ),
				'stepReadability'  => __( 'readability', 'content-quality-analyzer' ),
				'noSpellErrors'    => __( 'No spelling errors found.', 'content-quality-analyzer' ),
				'errorsLabel'      => __( 'errors', 'content-quality-analyzer' ),
				'improvPriorities' => __( 'Improvement priorities', 'content-quality-analyzer' ),
				'min'              => __( 'min', 'content-quality-analyzer' ),
				'wordsLabel'       => __( 'words', 'content-quality-analyzer' ),
				'confirmReset'     => __( 'Reset cost counter?', 'content-quality-analyzer' ),
				'resetConfirmYes'  => __( 'Yes, reset', 'content-quality-analyzer' ),
				'resetConfirmNo'   => __( 'Cancel', 'content-quality-analyzer' ),
				'pageOf'           => __( 'Page %1$d of %2$d', 'content-quality-analyzer' ),
			),
		) );
	}

	public function render_page(): void {
		$api_key    = CQA_Settings::api_key();
		$model      = CQA_Settings::model();
		$post_types = CQA_Settings::post_types();
		$total_cost = (float) get_option( 'cqa_api_total_cost', 0.0 );

		$public_types = get_post_types( array( 'public' => true ), 'objects' );
		unset( $public_types['attachment'] );

		$can_manage = current_user_can( 'manage_options' );
		?>
		<div class="cqa-app">

			<div class="cqa-app-header">
				<h1>✍️ <?php esc_html_e( 'Content Quality Analyzer', 'content-quality-analyzer' ); ?></h1>
				<span class="cqa-version-badge">v<?php echo esc_html( CQA_VERSION ); ?></span>
			</div>

			<div class="cqa-app-layout">

				<!-- Sidebar nav -->
				<nav class="cqa-app-nav">
					<a href="#tab-overview" class="cqa-tab-link active">📋 <?php esc_html_e( 'Overview', 'content-quality-analyzer' ); ?></a>
					<a href="#tab-analyze"  class="cqa-tab-link">🔍 <?php esc_html_e( 'Analyze post', 'content-quality-analyzer' ); ?></a>
					<a href="#tab-batch"    class="cqa-tab-link">⚡ <?php esc_html_e( 'Batch analysis', 'content-quality-analyzer' ); ?></a>
					<?php if ( $can_manage ) : ?>
					<a href="#tab-api"      class="cqa-tab-link">⚙️ <?php esc_html_e( 'API Configuration', 'content-quality-analyzer' ); ?></a>
					<a href="#tab-costs"    class="cqa-tab-link">💰 <?php esc_html_e( 'API Costs', 'content-quality-analyzer' ); ?></a>
					<?php endif; ?>
				</nav>

				<!-- Content area -->
				<div class="cqa-app-content">

					<!-- ══ TAB: OVERVIEW ═════════════════════════════ -->
					<div id="tab-overview" class="cqa-tab-panel active">
						<h2><?php esc_html_e( 'Posts overview', 'content-quality-analyzer' ); ?></h2>

						<?php if ( empty( $api_key ) && $can_manage ) : ?>
							<div class="cqa-notice-warn">
								<?php
								printf(
									/* translators: %s: strong tag with tab name */
									esc_html__( 'First configure your API key in the %s tab.', 'content-quality-analyzer' ),
									'<strong>' . esc_html__( 'API Configuration', 'content-quality-analyzer' ) . '</strong>'
								);
								?>
							</div>
						<?php endif; ?>

						<div class="cqa-card">
							<div class="cqa-flex-row">
								<select id="cqa-ov-type" class="cqa-select">
									<option value=""><?php esc_html_e( 'All types', 'content-quality-analyzer' ); ?></option>
									<?php foreach ( $public_types as $pt ) : ?>
										<option value="<?php echo esc_attr( $pt->name ); ?>">
											<?php echo esc_html( $pt->label ); ?>
										</option>
									<?php endforeach; ?>
								</select>
								<button type="button" id="cqa-ov-load-btn" class="button">
									📋 <?php esc_html_e( 'Load list', 'content-quality-analyzer' ); ?>
								</button>
								<span id="cqa-ov-status" class="cqa-status-info"></span>
							</div>
						</div>

						<div id="cqa-ov-table-wrap" style="margin-top:8px;"></div>
					</div>

					<!-- ══ TAB: ANALYZE ══════════════════════════════ -->
					<div id="tab-analyze" class="cqa-tab-panel">
						<h2><?php esc_html_e( 'Analyze post', 'content-quality-analyzer' ); ?></h2>

						<?php if ( empty( $api_key ) && $can_manage ) : ?>
							<div class="cqa-notice-warn">
								<?php
								printf(
									esc_html__( 'First configure your API key in the %s tab.', 'content-quality-analyzer' ),
									'<strong>' . esc_html__( 'API Configuration', 'content-quality-analyzer' ) . '</strong>'
								);
								?>
							</div>
						<?php endif; ?>

						<div class="cqa-card">
							<h3><?php esc_html_e( 'Select a post', 'content-quality-analyzer' ); ?></h3>
							<div class="cqa-flex-row">
								<input
									type="text"
									id="cqa-search-input"
									class="regular-text"
									placeholder="<?php esc_attr_e( 'Search post by title…', 'content-quality-analyzer' ); ?>"
									autocomplete="off"
								>
								<button type="button" id="cqa-search-btn" class="button">🔍 <?php esc_html_e( 'Search', 'content-quality-analyzer' ); ?></button>
							</div>
							<div id="cqa-search-results" style="margin-top:10px;"></div>
						</div>

						<div id="cqa-post-card" style="display:none;" class="cqa-card">
							<div id="cqa-post-info"></div>
							<div class="cqa-action-row">
								<button type="button" id="cqa-admin-btn-all"         class="button button-primary">✨ <?php esc_html_e( 'Analyze all', 'content-quality-analyzer' ); ?></button>
								<button type="button" id="cqa-admin-btn-spell"       class="button">🔤 <?php esc_html_e( 'Spelling', 'content-quality-analyzer' ); ?></button>
								<button type="button" id="cqa-admin-btn-readability" class="button">📊 <?php esc_html_e( 'Readability', 'content-quality-analyzer' ); ?></button>
								<button type="button" id="cqa-admin-btn-ai"          class="button">🤖 <?php esc_html_e( 'AI-Friendly', 'content-quality-analyzer' ); ?></button>
							</div>
							<div id="cqa-admin-progress" style="display:none;" class="cqa-admin-progress-wrap">
								<div class="cqa-progress-wrap">
									<div class="cqa-progress-bar">
										<div id="cqa-admin-fill" class="cqa-progress-fill"></div>
									</div>
									<span id="cqa-admin-pct" class="cqa-progress-pct">0%</span>
								</div>
								<div id="cqa-admin-label" class="cqa-progress-label"><?php esc_html_e( 'Analyzing…', 'content-quality-analyzer' ); ?></div>
							</div>
						</div>

						<div id="cqa-admin-results" style="display:none;" class="cqa-admin-results-outer">
							<div class="cqa-results-grid">
								<div class="cqa-card" id="cqa-admin-spell-panel" style="display:none;">
									<h3>🔤 <?php esc_html_e( 'Spelling Corrector', 'content-quality-analyzer' ); ?></h3>
									<div id="cqa-admin-spell-content"></div>
								</div>
								<div class="cqa-card" id="cqa-admin-read-panel" style="display:none;">
									<h3>📊 <?php esc_html_e( 'Text Readability', 'content-quality-analyzer' ); ?></h3>
									<div id="cqa-admin-read-content"></div>
								</div>
								<div class="cqa-card" id="cqa-admin-ai-panel" style="display:none;">
									<h3>🤖 <?php esc_html_e( 'AI-Friendly Check', 'content-quality-analyzer' ); ?></h3>
									<div id="cqa-admin-ai-content"></div>
								</div>
							</div>
						</div>
					</div>

					<!-- ══ TAB: BATCH ════════════════════════════════ -->
					<div id="tab-batch" class="cqa-tab-panel">
						<h2><?php esc_html_e( 'Batch analysis', 'content-quality-analyzer' ); ?></h2>

						<div class="cqa-card">
							<h3><?php esc_html_e( 'Post types to analyze', 'content-quality-analyzer' ); ?></h3>
							<div id="cqa-batch-types" class="cqa-checkbox-group">
								<?php foreach ( $public_types as $pt ) : ?>
									<label class="cqa-checkbox-label">
										<input
											type="checkbox"
											class="cqa-batch-type-cb"
											value="<?php echo esc_attr( $pt->name ); ?>"
											<?php checked( in_array( $pt->name, $post_types, true ) ); ?>
										>
										<?php echo esc_html( $pt->label ); ?>
										<span class="cqa-type-hint">(<?php echo esc_html( $pt->name ); ?>)</span>
									</label>
								<?php endforeach; ?>
							</div>
							<div class="cqa-action-row">
								<button type="button" id="cqa-batch-load-btn" class="button">
									📋 <?php esc_html_e( 'Load posts', 'content-quality-analyzer' ); ?>
								</button>
								<span id="cqa-batch-load-status" class="cqa-status-info"></span>
							</div>
						</div>

						<div id="cqa-batch-list-wrap" style="display:none;" class="cqa-card">
							<div class="cqa-flex-between cqa-batch-header">
								<h3 class="cqa-batch-count-title" id="cqa-batch-count"></h3>
								<div class="cqa-flex-row">
									<button type="button" id="cqa-batch-run-btn" class="button button-primary">
										⚡ <?php esc_html_e( 'Run analysis', 'content-quality-analyzer' ); ?>
									</button>
									<button type="button" id="cqa-batch-stop-btn" class="button" style="display:none;">
										⏹ <?php esc_html_e( 'Stop', 'content-quality-analyzer' ); ?>
									</button>
								</div>
							</div>
							<div id="cqa-batch-post-list" style="max-height:200px; overflow-y:auto; margin-bottom:10px;"></div>
						</div>

						<div id="cqa-batch-log" class="cqa-batch-log" style="display:none;"></div>
					</div>

					<?php if ( $can_manage ) : ?>

					<!-- ══ TAB: API CONFIG ════════════════════════════ -->
					<div id="tab-api" class="cqa-tab-panel">
						<h2><?php esc_html_e( 'Google Gemini API Configuration', 'content-quality-analyzer' ); ?></h2>

						<form method="post" action="options.php" id="cqa-settings-form">
							<?php settings_fields( 'cqa-group' ); ?>

							<div class="cqa-card">
								<h3><?php esc_html_e( 'API Key', 'content-quality-analyzer' ); ?></h3>
								<p class="cqa-hint">
									<?php
									printf(
										/* translators: %s: link to Google AI Studio */
										esc_html__( 'Get your API key from %s.', 'content-quality-analyzer' ),
										'<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio →</a>'
									);
									?>
								</p>
								<div class="cqa-field-row">
									<input
										type="password"
										id="cqa-api-key-input"
										name="cqa_api_key"
										value="<?php echo esc_attr( $api_key ); ?>"
										class="regular-text"
										placeholder="AIza..."
										autocomplete="new-password"
									>
									<button type="button" id="cqa-test-api-btn" class="button">
										🔌 <?php esc_html_e( 'Test connection', 'content-quality-analyzer' ); ?>
									</button>
									<span id="cqa-test-status" class="cqa-status"></span>
								</div>
							</div>

							<div class="cqa-card">
								<h3><?php esc_html_e( 'Gemini Model', 'content-quality-analyzer' ); ?></h3>
								<p class="cqa-hint"><?php esc_html_e( 'Click "Test connection" to load available models.', 'content-quality-analyzer' ); ?></p>
								<select name="cqa_model" id="cqa-model-select" class="regular-text">
									<?php if ( $model ) : ?>
										<option value="<?php echo esc_attr( $model ); ?>" selected>
											<?php echo esc_html( $model ); ?>
										</option>
									<?php else : ?>
										<option value=""><?php esc_html_e( '— load models →', 'content-quality-analyzer' ); ?></option>
									<?php endif; ?>
								</select>
								<p class="cqa-hint" style="margin-top:6px;">
									<?php esc_html_e( 'Flash = cheaper | Pro = better for long analyses', 'content-quality-analyzer' ); ?>
								</p>
							</div>

							<div class="cqa-card">
								<h3><?php esc_html_e( 'Post types to analyze', 'content-quality-analyzer' ); ?></h3>
								<div class="cqa-checkbox-group">
									<?php foreach ( $public_types as $pt ) : ?>
										<label class="cqa-checkbox-label">
											<input
												type="checkbox"
												name="cqa_post_types[]"
												value="<?php echo esc_attr( $pt->name ); ?>"
												<?php checked( in_array( $pt->name, $post_types, true ) ); ?>
											>
											<?php echo esc_html( $pt->label ); ?>
											<span class="cqa-type-hint">(<?php echo esc_html( $pt->name ); ?>)</span>
										</label>
									<?php endforeach; ?>
								</div>
							</div>

							<div class="cqa-submit-row">
								<button type="submit" class="button button-primary">
									💾 <?php esc_html_e( 'Save settings', 'content-quality-analyzer' ); ?>
								</button>
							</div>
						</form>
					</div>

					<!-- ══ TAB: COSTS ════════════════════════════════ -->
					<div id="tab-costs" class="cqa-tab-panel">
						<h2><?php esc_html_e( 'API Costs', 'content-quality-analyzer' ); ?></h2>

						<div class="cqa-card">
							<div class="cqa-flex-between">
								<div>
									<div class="cqa-cost-display">
										$<?php echo esc_html( number_format( $total_cost, 5 ) ); ?>
									</div>
									<div class="cqa-cost-subtitle"><?php esc_html_e( 'Total cost since last reset', 'content-quality-analyzer' ); ?></div>
								</div>
								<button type="button" id="cqa-reset-cost-btn" class="button">
									🗑️ <?php esc_html_e( 'Reset counter', 'content-quality-analyzer' ); ?>
								</button>
							</div>
						</div>

						<div class="cqa-card">
							<h3><?php esc_html_e( 'Estimated analysis costs (Gemini Flash)', 'content-quality-analyzer' ); ?></h3>
							<table class="widefat" style="margin-top:8px;">
								<thead>
									<tr>
										<th><?php esc_html_e( 'Analysis', 'content-quality-analyzer' ); ?></th>
										<th><?php esc_html_e( 'Tokens IN (est.)', 'content-quality-analyzer' ); ?></th>
										<th><?php esc_html_e( 'Tokens OUT (est.)', 'content-quality-analyzer' ); ?></th>
										<th><?php esc_html_e( 'Cost / analysis', 'content-quality-analyzer' ); ?></th>
									</tr>
								</thead>
								<tbody>
									<tr><td>🔤 <?php esc_html_e( 'Spelling corrector', 'content-quality-analyzer' ); ?></td><td>~2 000</td><td>~500</td><td>~$0.00025</td></tr>
									<tr><td>📊 <?php esc_html_e( 'Readability', 'content-quality-analyzer' ); ?></td><td>~2 500</td><td>~800</td><td>~$0.00043</td></tr>
									<tr><td>🤖 <?php esc_html_e( 'AI-Friendly', 'content-quality-analyzer' ); ?></td><td>~3 000</td><td>~1 200</td><td>~$0.00059</td></tr>
									<tr><td>✏️ <?php esc_html_e( 'Rewrite fragment', 'content-quality-analyzer' ); ?></td><td>~1 000</td><td>~600</td><td>~$0.00025</td></tr>
									<tr><td>📝 TL;DR</td><td>~2 000</td><td>~300</td><td>~$0.00024</td></tr>
									<tr style="font-weight:600;"><td>✨ <?php esc_html_e( 'Analyze all', 'content-quality-analyzer' ); ?></td><td>~7 500</td><td>~2 500</td><td>~$0.00127</td></tr>
								</tbody>
							</table>
							<p class="cqa-hint"><?php esc_html_e( 'Prices for Gemini 2.0 Flash: $0.075/1M IN, $0.30/1M OUT (free tier: no charges up to limit)', 'content-quality-analyzer' ); ?></p>
						</div>
					</div>

					<?php endif; ?>

				</div><!-- /.cqa-app-content -->
			</div><!-- /.cqa-app-layout -->
		</div><!-- /.cqa-app -->
		<?php
	}
}
