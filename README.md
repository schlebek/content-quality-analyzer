# Content Quality Analyzer

WordPress plugin for AI-powered content analysis: spelling correction, readability scoring, and AI-friendly content verification — powered by Google Gemini.

## Features

- **Spelling Corrector** — detects spelling, grammar, punctuation, and style errors; apply fixes individually or all at once
- **Text Readability** — score (0–100), grade (A–F), reading time, sentence complexity, vocabulary richness, and actionable improvement tips
- **AI-Friendly Check** — evaluates content against 20 GEO (Generative Engine Optimization) criteria for AI-powered search engines
- **Heading Structure** — client-side analysis of H2/H3 hierarchy (no API cost)
- **TL;DR Generator** — concise summary, key points, and one-liner for any article
- **Rewrite Fragment** — paste any text and get 3 AI-rewritten alternatives with improvement notes
- **Analysis History** — tracks readability and AI-friendly scores over time per post
- **Analyze All** — runs all AI analyses with one click; includes progress bar and cumulative API cost estimate

Results are cached in post meta — you only pay for new analyses.

## Requirements

- WordPress 6.0+
- PHP 7.4+
- Google Gemini API key ([get one at Google AI Studio](https://aistudio.google.com/))

## Installation

1. Upload the `content-quality-analyzer` folder to `/wp-content/plugins/`
2. Activate via **Plugins → Installed Plugins**
3. Go to **Content Analyzer** in the admin menu
4. Enter your **Google Gemini API key** and select a model
5. Choose which post types should show the analyzer metabox
6. Open any post or page — the **Content Quality Analyzer** metabox appears below the editor

## Usage

The plugin adds a metabox below the post editor. Each section can be expanded independently:

| Section | API cost | Description |
|---------|----------|-------------|
| Spelling Corrector | Yes | Finds up to 20 errors with inline fix UI |
| Text Readability | Yes | Full readability report with 20+ metrics |
| AI-Friendly Check | Yes | 20-criterion GEO score with pass/warn/fail |
| Heading Structure | **Free** | Client-side H2/H3 hierarchy check |
| TL;DR Generator | Yes | Summary + 5 key points + one-liner |
| Rewrite Fragment | Yes | 3 rewrite alternatives for any text fragment |
| Analysis History | **Free** | Chart of past scores for this post |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| API Key | — | Google Gemini API key (required) |
| Model | `gemini-2.0-flash` | Gemini model to use |
| Post Types | `post`, `page` | Post types that show the metabox |

## Available Models

| Model | Best for | Price (input / output per 1M tokens) |
|-------|----------|--------------------------------------|
| Gemini 2.0 Flash | **Recommended** — fast and affordable | $0.075 / $0.30 |
| Gemini 1.5 Flash | Lighter tasks | $0.075 / $0.30 |
| Gemini 1.5 Pro | Higher accuracy | $1.25 / $5.00 |

The plugin displays cumulative API cost on the settings page based on Google's published rates.

## AI-Friendly Check Criteria

The 20 GEO criteria evaluated:

| # | ID | Description |
|---|----|-------------|
| 1 | `h1_hierarchy` | Single H1, logical H2/H3 hierarchy |
| 2 | `paragraph_length` | Paragraphs 1–4 sentences, no walls of text |
| 3 | `logical_sections` | Clear thematic sections |
| 4 | `lists_tables` | Bullet/numbered lists or tables present |
| 5 | `answer_first` | Key answer at the top (inverted pyramid) |
| 6 | `semantic_coherence` | Consistent terminology |
| 7 | `language_variation` | Natural synonyms and linguistic variety |
| 8 | `plain_language` | No unexplained jargon |
| 9 | `short_sentences` | Sentences short and direct (<20 words) |
| 10 | `explicit_context` | Context stated directly, not implied |
| 11 | `information_density` | High info density, no filler phrases |
| 12 | `topic_completeness` | Comprehensive coverage of the main topic |
| 13 | `citations_sources` | Sources cited or data referenced |
| 14 | `emphasis_elements` | Bold text, TL;DR, or summary present |
| 15 | `multimedia_context` | Alt text and captions on images |
| 16 | `schema_signals` | FAQ, HowTo, step lists, definitions |
| 17 | `eeat_signals` | E-E-A-T: experience, expertise, authority, trust |
| 18 | `content_freshness` | Up-to-date information |
| 19 | `entity_richness` | Named entities: people, places, organisations |
| 20 | `data_statistics` | Concrete numbers, statistics, or research |

Score = `pass × 5 + warn × 2.5` (max 100).

## External Services

This plugin sends post content to the **Google Gemini API** (by Google LLC) for AI analysis. API calls are triggered only when you click an analysis button — never on save or page load.

- [Google Terms of Service](https://ai.google.dev/terms)
- [Google Privacy Policy](https://policies.google.com/privacy)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

GPL-2.0-or-later
