<div align="center">

# Content Quality Analyzer

**AI-powered content quality plugin for WordPress**

Spelling correction · Readability scoring · GEO/AI-friendly analysis · Batch processing

[![Version](https://img.shields.io/badge/version-1.5.1-0073aa.svg)](CHANGELOG.md)
[![WordPress](https://img.shields.io/badge/WordPress-6.0%2B-21759b.svg)](https://wordpress.org/)
[![PHP](https://img.shields.io/badge/PHP-7.4%2B-8892bf.svg)](https://php.net/)
[![License](https://img.shields.io/badge/license-GPL--2.0--or--later-green.svg)](https://www.gnu.org/licenses/gpl-2.0.html)
[![Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini-4285f4.svg)](https://ai.google.dev/)

</div>

---

## Overview

Content Quality Analyzer adds an analysis metabox to the WordPress post editor and a dedicated admin panel. All analysis is powered by the Google Gemini API — enter your key, pick a model, and start analyzing.

Results are **cached in post meta** — you only pay for new or refreshed analyses.

---

## Features

### Per-post metabox

| Tool | API cost | What it does |
|------|:--------:|--------------|
| 🔤 **Spelling Corrector** | Yes | Detects up to 20 spelling, grammar, punctuation, and style errors. Apply fixes one by one or all at once. |
| 📊 **Text Readability** | Yes | Score 0–100, grade A–F, reading time, 20+ metrics (sentence length, passive voice, vocabulary richness…), and top improvement tips. |
| 🤖 **AI-Friendly Check** | Yes | Evaluates content against 20 GEO (Generative Engine Optimization) criteria. Scores each criterion pass / warn / fail with actionable notes. |
| 📑 **Heading Structure** | **Free** | Client-side H1/H2/H3 hierarchy validation — no API call. |
| 📝 **TL;DR Generator** | Yes | Summary, 5 key points, and a one-liner extracted from the article. |
| ✏️ **Rewrite Fragment** | Yes | Paste any text and receive 3 AI-rewritten alternatives with improvement notes. |
| 📈 **Analysis History** | **Free** | Sparkline chart of past readability and AI-Friendly scores for the post. |

### Admin panel

| Tab | Description |
|-----|-------------|
| 📋 Overview | Paginated list of all posts with their latest scores |
| 🔍 Analyze post | Search any post by title and run individual or full analyses |
| ⚡ Batch analysis | Run analyses across multiple post types at once |
| ⚙️ API Configuration | API key, model selection, post types |
| 💰 API Costs | Cumulative cost tracker with one-click reset |

---

## Requirements

- WordPress **6.0+**
- PHP **7.4+**
- Google Gemini API key — [get one free at Google AI Studio →](https://aistudio.google.com/)

---

## Installation

1. Upload the `content-quality-analyzer` folder to `/wp-content/plugins/`
2. Activate via **Plugins → Installed Plugins**
3. Open **Content Analyzer → API Configuration** in the admin menu
4. Paste your **Google Gemini API key** and click **Test connection**
5. Select a model and choose which post types should display the metabox
6. Open any post — the **Content Quality Analyzer** metabox appears below the editor

---

## Available Models

| Model | Best for | Generation |
|-------|----------|:----------:|
| `gemini-3.5-flash` | **Default** — highest quality & speed | Latest |
| `gemini-2.5-flash` | Fast and cost-effective | Stable |
| `gemini-2.5-pro` | Complex or very long content | Stable |
| `gemini-2.0-flash` | Budget option | Previous |

> Pricing: see [Google AI pricing page](https://ai.google.dev/pricing). A free tier is available for low-volume use.

---

## AI-Friendly Check — 20 GEO Criteria

Score = `pass × 5 + warn × 2.5` (max 100).

| # | Criterion | What is checked |
|---|-----------|-----------------|
| 1 | `h1_hierarchy` | Single H1 with logical H2/H3 structure |
| 2 | `paragraph_length` | Paragraphs 1–4 sentences, no walls of text |
| 3 | `logical_sections` | Clearly defined thematic sections |
| 4 | `lists_tables` | Bullet/numbered lists or tables present |
| 5 | `answer_first` | Key answer at the top (inverted pyramid) |
| 6 | `semantic_coherence` | Consistent terminology and concepts |
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
| 18 | `content_freshness` | Up-to-date information, no outdated data |
| 19 | `entity_richness` | Named entities: people, places, organisations, products |
| 20 | `data_statistics` | Concrete numbers, statistics, or research results |

---

## Page Builder & ACF Support

The plugin extracts readable text from all major content sources:

| Source | Method |
|--------|--------|
| **Gutenberg / Classic Editor** | Standard `post_content` |
| **Elementor** | Parses `_elementor_data` JSON — covers text, heading, icon-box, accordion, and more |
| **Divi / WPBakery / Beaver Builder** | Strips shortcode tags, preserves inner text |
| **ACF** (Advanced Custom Fields) | Appends text, textarea, and wysiwyg field values |

---

## Caching & Invalidation

- Results are stored in post meta (`_cqa_spell_cache`, `_cqa_readability_cache`, `_cqa_aifriendly_cache`).
- Cache timestamp is displayed next to each section header.
- Cache is **automatically cleared** when the post is saved — the next analysis always reflects the current content.

---

## External Services

This plugin sends post content to the **Google Gemini API** (by Google LLC) for AI analysis.  
API calls are triggered **only when you explicitly click an analysis button** — never automatically on save or page load.

- [Google AI Terms of Service](https://ai.google.dev/terms)
- [Google Privacy Policy](https://policies.google.com/privacy)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full history.

---

## License

[GPL-2.0-or-later](https://www.gnu.org/licenses/gpl-2.0.html)  
Copyright © Stanisław Chlebek
