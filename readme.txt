=== Content Quality Analyzer ===
Contributors: schlebek
Tags: content, ai, spelling, readability, seo
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 1.2.0
Requires PHP: 7.4
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI-powered spelling corrector, readability analysis, and AI-friendly content check using Google Gemini.

== Description ==

Content Quality Analyzer adds a metabox to the post/page editor that helps you improve content quality using Google Gemini AI.

**Features:**

* **Spelling Corrector** — Detects spelling, grammar, punctuation, and style errors. Apply fixes individually or all at once.
* **Text Readability** — Score, grade, reading time, sentence complexity, vocabulary richness, and improvement tips.
* **AI-Friendly Check** — Evaluates content against 20 GEO (Generative Engine Optimization) criteria for AI-powered search engines.
* **Heading Structure** — Client-side analysis of H2/H3 hierarchy (no API cost).
* **TL;DR Generator** — Concise summary, key points, and one-liner for your article.
* **Rewrite Fragment** — Paste any text and get 3 AI-rewritten alternatives with improvement notes.
* **Analysis History** — Tracks readability and AI-friendly scores over time.
* **Analyze All** — Run all AI analyses with one click; progress bar and API cost estimate included.

Results are cached in post meta — you only pay for new analyses.

**External Services**

This plugin sends post content to the **Google Gemini API** (by Google LLC) for AI analysis.

* When used: only when you click an analysis button in the metabox — never on save or page load.
* Data sent: post content (HTML stripped), post title, author bio availability flag.
* [Google Terms of Service](https://ai.google.dev/terms)
* [Google Privacy Policy](https://policies.google.com/privacy)

== Installation ==

1. Upload the `content-quality-analyzer` folder to `/wp-content/plugins/`.
2. Activate via **Plugins > Installed Plugins**.
3. Go to **Content Analyzer** in the admin menu.
4. Enter your **Google Gemini API key** and select a model.
5. Choose which post types should display the analyzer metabox.
6. Open any post or page — find the **Content Quality Analyzer** metabox below the editor.

== Frequently Asked Questions ==

= Where do I get a Google Gemini API key? =

Visit [Google AI Studio](https://aistudio.google.com/) and create a free API key. The Gemini Flash models have a generous free tier.

= Which model should I use? =

`gemini-2.0-flash` is recommended — fast, affordable, and accurate for content analysis.

= Does this work with the Classic Editor? =

Yes. The metabox appears in both the Classic Editor and the Block Editor (Gutenberg).

= How is the API cost calculated? =

The plugin tracks cumulative token usage and displays an estimated USD cost on the settings page, based on Google's published per-million-token rates.

== Screenshots ==

1. The Content Quality Analyzer metabox with all sections collapsed.
2. Spelling Corrector — detected errors with inline fix buttons.
3. Text Readability — score, grade, and improvement suggestions.
4. AI-Friendly Check — 20 criteria with pass/warn/fail status.
5. Plugin settings page — API key and model selection.

== Changelog ==

= 1.2.0 =
* WP.org compliance: replaced anonymous closures in hooks with named functions.
* WP.org compliance: removed `sslverify => false` from all HTTP requests.
* WP.org compliance: added `sanitize_callback` to all `register_setting()` calls.
* WP.org compliance: replaced `@set_time_limit()` with `function_exists()` guard.
* Added `register_uninstall_hook()` for clean option removal on plugin delete.
* Added `register_activation_hook()` setting default options on first activation.
* Added full i18n support with `load_plugin_textdomain()` and locale fallback.
* Fixed version constant mismatch between plugin header and `CQA_VERSION`.

= 1.1.0 =
* Added Analysis History tracking readability and AI-friendly scores over time.
* Added TL;DR Generator.
* Added Rewrite Fragment tool with 3 AI alternatives.
* Added client-side Heading Structure analyzer.
* Progress bar with per-step labels for "Analyze All".
* Cumulative API cost tracking on the settings page.

= 1.0.0 =
* Initial release.
* Spelling Corrector, Text Readability, AI-Friendly Check (20 GEO criteria).
* Google Gemini API integration with result caching via post meta.

== Upgrade Notice ==

= 1.2.0 =
Security and compliance update — removes insecure HTTP options and adds clean uninstall support. Recommended for all users.
