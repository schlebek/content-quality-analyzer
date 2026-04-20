# Changelog

All notable changes to Content Quality Analyzer are documented in this file.

## [1.4.0] - 2026-04-20

### Added
- "Copy all fixes" button in Spelling Corrector results.
- SVG sparkline chart in Analysis History showing readability and AI-Friendly score trends.
- Client-side pagination (25 items/page) in Posts Overview admin page.
- Full JS i18n via `wp_localize_script()` — ~100 translated strings in `panel.i18n` / `admin.i18n`.
- New translation keys added to all 9 locales (de_DE, fr_FR, es_ES, it_IT, pt_BR, ru_RU, uk, nl_NL, cs_CZ).

### Changed
- Rewrote all 5 Gemini API prompts from Polish to language-neutral English; AI now responds in the same language as the input text.
- Replaced all inline `style=` attributes in JS render functions with proper CSS classes.
- Gutenberg sidebar rewritten from ES5 prototype-based class to functional component using `wp.element.useState` hooks.

### Fixed
- Removed `alert()` and `confirm()` dialogs — replaced with inline UI messages and two-click inline confirmation.

## [1.2.0] - 2026-04-20

### Changed
- WP.org compliance: replaced anonymous closures in hooks with named functions (`cqa_init`, `cqa_invalidate_cache`, `cqa_autoload`).
- WP.org compliance: removed `sslverify => false` from all `wp_remote_post()` and `wp_remote_get()` calls.
- WP.org compliance: added `sanitize_callback` to all `register_setting()` calls.
- WP.org compliance: replaced `@set_time_limit()` with conditional `function_exists()` check.
- Added `register_uninstall_hook()` pointing to `cqa_uninstall()` for clean option removal on delete.
- Added `register_activation_hook()` setting default options on first activation.
- Added full i18n support: `load_plugin_textdomain()` with 3-level locale fallback.
- All user-facing PHP strings wrapped in i18n functions (`__()`, `esc_html_e()`, `esc_attr_e()`).
- Added plugin header fields: Text Domain, Domain Path, Requires at least, Requires PHP, License, Plugin URI, Author URI.
- Fixed version constant mismatch (header vs `CQA_VERSION` constant now both `1.2.0`).
- Removed emoji from Plugin Name in header (kept in admin UI labels).

## [1.1.0] - 2025-12-01

### Added
- Analysis History section tracking readability and AI-friendly scores over time.
- TL;DR Generator producing a summary, key points, and one-liner.
- Rewrite Fragment tool with 3 AI-generated alternatives.
- Heading Structure analyzer (client-side, no API cost).
- Progress bar with per-step labels for "Analyze All".
- Cumulative API cost tracking displayed on the settings page.

## [1.0.0] - 2025-10-15

### Added
- Initial release.
- Spelling Corrector with inline fix/dismiss UI.
- Text Readability analysis (score, grade, reading time, 20+ metrics).
- AI-Friendly Check against 20 GEO/LLM criteria.
- Google Gemini API integration.
- Result caching via post meta with timestamp display.
- Works with Classic Editor and Block Editor (Gutenberg).
