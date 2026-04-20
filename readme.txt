=== Content Quality Analyzer ===
Contributors: schlebek
Tags: content, ai, spelling, readability, seo
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI-powered spelling corrector, readability analysis, and AI-friendly content verification using Google Gemini.

== Description ==

Content Quality Analyzer adds a powerful metabox to your post/page editor that helps you improve content quality using Google Gemini AI.

**Features:**

* **Spelling Corrector** — Detects spelling, grammar, punctuation, and style errors. Apply fixes individually or all at once.
* **Text Readability** — Full readability analysis: score, grade, reading time, sentence complexity, vocabulary richness, and actionable improvement tips.
* **AI-Friendly Check** — Evaluates content against 20 GEO (Generative Engine Optimization) criteria. Ensures your content is well-structured for AI-powered search engines.
* **Heading Structure** — Client-side analysis of H2/H3 hierarchy in your content.
* **TL;DR Generator** — Generates a concise summary and key points for your article.
* **Rewrite Fragment** — Paste any text fragment and get 3 AI-rewritten alternatives with improvement notes.
* **Analysis History** — Tracks score changes over time (readability + AI-friendly) so you can see progress.
* **Analyze All** — Run all AI analyses with a single click; shows a progress bar and total API cost.

All AI analyses are powered by Google Gemini. Results are cached in post meta so you only pay for new analyses.

== Installation ==

1. Upload the `content-quality-analyzer` folder to `/wp-content/plugins/`.
2. Activate the plugin via **Plugins > Installed Plugins**.
3. Go to **Content Analyzer** in the admin menu.
4. Enter your **Google Gemini API key** and select a model.
5. Choose which post types should display the analyzer metabox.
6. Open any post/page and find the **Content Quality Analyzer** metabox below the editor.

== Frequently Asked Questions ==

= Where do I get a Google Gemini API key? =

Visit [Google AI Studio](https://aistudio.google.com/) and create a free API key. The Gemini Flash models have a generous free tier.

= Which model should I use? =

`gemini-2.0-flash` is recommended — fast, affordable, and accurate for content analysis.

= Is my content sent to Google? =

Yes. The plugin sends your post content to the Google Gemini API for analysis. Please review Google's [Terms of Service](https://ai.google.dev/terms) and [Privacy Policy](https://policies.google.com/privacy) before use.

= How is the cost calculated? =

The plugin tracks cumulative token usage and displays an estimated USD cost on the settings page. The calculation uses Google's published per-million-token rates.

= Can I use it with the Classic Editor? =

Yes. The metabox appears in both the Classic Editor and the Block Editor (Gutenberg).

== External Services ==

This plugin connects to the **Google Gemini API** to perform AI analysis of your content.

* **Service:** Google Generative Language API (Gemini)
* **Endpoint:** `https://generativelanguage.googleapis.com/`
* **When used:** Only when you click an analysis button or "Analyze All" in the Content Quality Analyzer metabox.
* **Data sent:** Post content text (stripped of HTML), post title (for AI-Friendly Check), and optionally author bio availability.
* **Google Terms of Service:** https://ai.google.dev/terms
* **Google Privacy Policy:** https://policies.google.com/privacy

No data is sent automatically on save or load — all API calls are user-initiated.

== Screenshots ==

1. The Content Quality Analyzer metabox with all sections collapsed.
2. Spelling Corrector showing detected errors with inline fix buttons.
3. Text Readability analysis with score, grade, and improvement suggestions.
4. AI-Friendly Check with 20 criteria and scores.
5. Plugin settings page with API key and model selection.

== Changelog ==

= 1.2.0 =
* WP.org compliance: named functions replacing anonymous closures in hooks.
* WP.org compliance: removed `sslverify => false` from all HTTP requests.
* WP.org compliance: added `sanitize_callback` to all `register_setting()` calls.
* WP.org compliance: added `register_uninstall_hook()` for clean removal.
* WP.org compliance: eliminated `@` error suppression operator.
* Added full i18n support with `load_plugin_textdomain()`.
* Added activation hook creating default options.
* Fixed version constant mismatch.

= 1.1.0 =
* Added Analysis History section tracking score progress over time.
* Added TL;DR Generator.
* Added Rewrite Fragment tool.
* Improved Heading Structure analysis (client-side, no API cost).
* Progress bar for "Analyze All" with per-step labels.
* API cost tracking displayed on settings page.

= 1.0.0 =
* Initial release.
* Spelling Corrector, Text Readability, AI-Friendly Check.
* Google Gemini API integration.
* Caching via post meta.

== Upgrade Notice ==

= 1.2.0 =
Recommended update: improves security, WP.org compliance, and adds i18n support.
