/* global wp, tinymce */
(function ($) {
    'use strict';

    var panel = window.cqaPanel || {};
    var i18n  = panel.i18n || {};

    /* ── Editor helpers ───────────────────────────────────── */

    function isGutenberg() {
        return typeof wp !== 'undefined' && wp.data && !!wp.data.select('core/editor');
    }

    function isClassicEditor() {
        return typeof tinymce !== 'undefined' && tinymce.get('content') && !tinymce.get('content').isHidden();
    }

    function extractContent() {
        if (isGutenberg()) {
            return wp.data.select('core/editor').getEditedPostContent() || '';
        }
        if (isClassicEditor()) {
            return tinymce.get('content').getContent({ format: 'text' }) || '';
        }
        var ta = document.getElementById('content');
        return ta ? ta.value : '';
    }

    function getPostTitle() {
        if (isGutenberg()) {
            return wp.data.select('core/editor').getEditedPostAttribute('title') || '';
        }
        var t = document.getElementById('title');
        return t ? t.value : '';
    }

    /* ── HTML escaping ────────────────────────────────────── */

    function esc(str) {
        return $('<div>').text(String(str || '')).html();
    }

    /* ── Badge helper ─────────────────────────────────────── */

    function setBadge(id, text, cls) {
        var $b = $('#' + id);
        $b.text(text).attr('class', 'cqa-badge ' + cls).show();
    }

    /* ── Score circle (uses CSS custom property for color) ── */

    function scoreCircle(score, grade, color) {
        return '<div class="cqa-score-ring-wrap">'
            + '<div class="cqa-score-ring" style="--cqa-ring:' + color + '">'
            + '<span class="cqa-score-value">' + score + '</span>'
            + '<span class="cqa-score-suffix">/ 100</span>'
            + '</div>'
            + '<div class="cqa-score-grade" style="color:' + color + '">' + esc(grade) + '</div>'
            + '</div>';
    }

    function gradeColor(score) {
        if (score >= 80) return '#16a34a';
        if (score >= 65) return '#ca8a04';
        if (score >= 45) return '#ea580c';
        return '#dc2626';
    }

    /* ── Progress bar ─────────────────────────────────────── */

    function setProgress(fillId, pctId, labelId, pct, label) {
        $('#' + fillId).css('width', pct + '%');
        $('#' + pctId).text(Math.round(pct) + '%');
        if (labelId) $('#' + labelId).text(label || '');
    }

    /* ── AJAX helper ──────────────────────────────────────── */

    function ajaxPost(action, extra, success, fail) {
        var data = $.extend({ action: action, nonce: panel.nonce, post_id: panel.postId }, extra);
        return $.post(panel.ajaxUrl, data, function (res) {
            if (res.success) {
                success(res.data);
            } else {
                fail(res.data || i18n.unknownError || 'Unknown error');
            }
        }).fail(function () {
            fail(i18n.connectionError || 'Connection error.');
        });
    }

    /* ── Section accordion ────────────────────────────────── */

    $(document).on('click', '.cqa-toggle', function () {
        var key   = $(this).data('key');
        var $sec  = $('#cqa-section-' + key);
        var $body = $sec.find('.cqa-section-body');
        var $chev = $(this).find('.cqa-chevron');
        $body.slideToggle(200);
        $chev.text($body.is(':visible') ? '▾' : '▸');
    });

    /* ═══════════════════════════════════════════════════════
       SPELL CHECK
    ═══════════════════════════════════════════════════════ */

    function renderSpell(data) {
        var errors   = data.spelling_errors || [];
        var $list    = $('#cqa-spell-list');
        var $empty   = $('#cqa-spell-empty');
        var $actions = $('#cqa-spell-actions');

        $list.empty();
        $('#cqa-spell-copy-all').remove();

        if (!errors.length) {
            $empty.show();
            $actions.hide();
            setBadge('cqa-badge-spell', i18n.zeroErrors || '0 errors', 'badge-green');
            return;
        }

        $empty.hide();
        $actions.show();

        var typeColors = { ortografia: '#dc2626', gramatyka: '#d97706', interpunkcja: '#7c3aed', styl: '#0369a1',
                           spelling: '#dc2626', grammar: '#d97706', punctuation: '#7c3aed', style: '#0369a1' };

        $.each(errors, function (i, err) {
            var color = typeColors[err.type] || '#475569';
            var $row  = $('<div>').addClass('cqa-spell-row').attr({ 'data-wrong': err.wrong, 'data-correct': err.correct });

            var $top = $('<div>').addClass('cqa-spell-top').append(
                $('<label>').append(
                    $('<input type="checkbox">').addClass('cqa-spell-check').prop('checked', true),
                    ' ',
                    $('<span>').addClass('cqa-spell-wrong').text(err.wrong),
                    $('<span>').text(' → '),
                    $('<span>').addClass('cqa-spell-correct').text(err.correct)
                ),
                $('<span>').addClass('cqa-spell-type-badge').css('background', color).text(err.type || '')
            );

            $row.append($top);

            if (err.context) {
                $row.append($('<div>').addClass('cqa-spell-context').text('…' + err.context + '…'));
            }
            if (err.explanation) {
                $row.append($('<div>').addClass('cqa-spell-explanation').text(err.explanation));
            }

            $row.append(
                $('<div>').addClass('cqa-spell-btns').append(
                    $('<button type="button">').addClass('cqa-spell-go button').css('font-size', '11px').html('🔍 ' + (i18n.find || 'Find')),
                    $('<button type="button">').addClass('cqa-spell-fix button').css('font-size', '11px').html('✓ ' + (i18n.fix || 'Fix'))
                )
            );

            $list.append($row);
        });

        // Copy-all-fixes button
        var $copyAll = $('<button type="button" id="cqa-spell-copy-all">')
            .addClass('button cqa-copy-all-btn')
            .css('font-size', '11px')
            .html('📋 ' + (i18n.copyAllFixes || 'Copy all fixes'));
        $list.before($copyAll);

        var cls = errors.length > 10 ? 'badge-red' : (errors.length > 4 ? 'badge-orange' : 'badge-yellow');
        setBadge('cqa-badge-spell', errors.length + ' ' + (i18n.errorsLabel || 'errors'), cls);
    }

    $(document).on('click', '#cqa-spell-copy-all', function () {
        var lines = [];
        $('.cqa-spell-row').each(function () {
            var wrong   = $(this).data('wrong');
            var correct = $(this).data('correct');
            if (wrong && correct) lines.push(wrong + ' → ' + correct);
        });
        if (!lines.length) return;
        var text = lines.join('\n');
        var $btn = $(this);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
                $btn.text('✓ ' + (i18n.copied || 'Copied!'));
                setTimeout(function () { $btn.html('📋 ' + (i18n.copyAllFixes || 'Copy all fixes')); }, 2000);
            });
        }
    });

    function fixSpellInEditor(wrong, correct, $row) {
        var escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var regex   = new RegExp(escaped, 'i');
        var fixed   = false;

        if (isGutenberg()) {
            var dispatch = wp.data.dispatch('core/block-editor');
            var blocks   = wp.data.select('core/block-editor').getBlocks();
            fixed = fixInBlocks(blocks, wrong, correct, dispatch);
        } else if (isClassicEditor()) {
            var ed      = tinymce.get('content');
            var content = ed.getContent().replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '$1');
            if (regex.test(content)) {
                ed.setContent(content.replace(regex, correct));
                fixed = true;
            }
        }

        if (fixed) {
            $row.addClass('cqa-spell-fixed');
            setTimeout(function () {
                $row.slideUp(200, function () { $(this).remove(); checkSpellEmpty(); });
            }, 500);
        } else {
            $row.find('.cqa-spell-fix').text(i18n.notFound || 'Not found').prop('disabled', true);
        }
    }

    function fixInBlocks(blocks, wrong, correct, dispatch) {
        var escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var regex   = new RegExp(escaped, 'gi');
        var fixed   = false;

        $.each(blocks, function (i, block) {
            if (block.innerBlocks && block.innerBlocks.length) {
                if (fixInBlocks(block.innerBlocks, wrong, correct, dispatch)) fixed = true;
            }
            var attr = block.attributes || {};
            var html = attr.content || '';
            if (html && regex.test(html)) {
                dispatch.updateBlockAttributes(block.clientId, { content: html.replace(regex, correct) });
                fixed = true;
            }
        });
        return fixed;
    }

    function checkSpellEmpty() {
        if ($('#cqa-spell-list .cqa-spell-row:not(.cqa-spell-fixed)').length === 0) {
            $('#cqa-spell-list').empty();
            $('#cqa-spell-copy-all').remove();
            $('#cqa-spell-empty').show();
            $('#cqa-spell-actions').hide();
        }
    }

    $(document).on('click', '.cqa-spell-go', function () {
        var wrong = $(this).closest('.cqa-spell-row').data('wrong');
        if (!wrong) return;
        if (isGutenberg()) {
            var blocks   = wp.data.select('core/block-editor').getBlocks();
            var clientId = null;
            (function findBlock(bs) {
                $.each(bs, function (i, b) {
                    if (clientId) return;
                    if (b.innerBlocks && b.innerBlocks.length) findBlock(b.innerBlocks);
                    var html = (b.attributes || {}).content || '';
                    if (html.toLowerCase().indexOf(wrong.toLowerCase()) !== -1) clientId = b.clientId;
                });
            }(blocks));
            if (clientId) {
                wp.data.dispatch('core/block-editor').selectBlock(clientId);
            }
        }
    });

    $(document).on('click', '.cqa-spell-fix', function () {
        var $row = $(this).closest('.cqa-spell-row');
        fixSpellInEditor($row.data('wrong'), $row.data('correct'), $row);
    });

    $(document).on('click', '#cqa-spell-fix-all', function () {
        $('.cqa-spell-row:not(.cqa-spell-fixed)').each(function () {
            if ($(this).find('.cqa-spell-check').is(':checked')) {
                fixSpellInEditor($(this).data('wrong'), $(this).data('correct'), $(this));
            }
        });
    });

    $(document).on('click', '#cqa-spell-dismiss', function () {
        $('#cqa-section-spell').slideUp();
    });

    /* ═══════════════════════════════════════════════════════
       READABILITY
    ═══════════════════════════════════════════════════════ */

    function renderReadability(d) {
        var score = d.score || 0;
        var grade = d.grade || '?';
        var color = gradeColor(score);

        var html = '<div class="cqa-score-header">';
        html += scoreCircle(score, grade, color);
        html += '<div class="cqa-score-meta">'
            + '<div class="cqa-score-level">' + esc(d.reading_level || '') + '</div>'
            + '<div class="cqa-score-desc">' + esc(d.reading_level_description || '') + '</div>'
            + '<div class="cqa-score-reading-time">⏱ ' + (i18n.readingTime || 'Reading time:') + ' <strong>~' + esc(d.reading_time_minutes || '?') + ' min</strong></div>'
            + '</div></div>';

        var metrics = [
            { label: i18n.words         || 'Words',           val: d.word_count },
            { label: i18n.sentences     || 'Sentences',       val: d.sentence_count },
            { label: i18n.paragraphs    || 'Paragraphs',      val: d.paragraph_count },
            { label: i18n.avgSentence   || 'Avg. sentence',   val: d.avg_sentence_length   !== undefined ? d.avg_sentence_length + ' ' + (i18n.words || 'words').toLowerCase() : null },
            { label: i18n.longSentences || 'Long sentences',  val: d.long_sentences_count  !== undefined ? d.long_sentences_count  + ' (>30)' : null },
            { label: i18n.shortSentences|| 'Short sentences', val: d.short_sentences_count !== undefined ? d.short_sentences_count + ' (<8)'  : null },
            { label: i18n.passiveVoice  || 'Passive voice',   val: d.passive_voice_pct     !== undefined ? d.passive_voice_pct     + '%' : null },
            { label: i18n.complexWords  || 'Complex words',   val: d.complex_words_pct     !== undefined ? d.complex_words_pct     + '%' : null },
            { label: i18n.vocabulary    || 'Vocabulary',      val: d.vocabulary_richness },
            { label: i18n.headingsH23   || 'H2/H3 headings', val: d.heading_count !== undefined ? d.heading_count + ' (' + (d.heading_structure || '?') + ')' : null },
            { label: i18n.paraStructure || 'Para. structure', val: d.paragraph_structure },
            { label: i18n.connectives   || 'Connectives',     val: d.connective_words_quality },
            { label: i18n.logicalFlow   || 'Logical flow',    val: d.logical_flow_score    !== undefined ? d.logical_flow_score    + '/10' : null },
            { label: i18n.engagement    || 'Engagement',      val: d.emotional_engagement },
            { label: i18n.clarity       || 'Clarity',         val: d.clarity_score         !== undefined ? d.clarity_score         + '/10' : null },
            { label: i18n.conciseness   || 'Conciseness',     val: d.conciseness_score     !== undefined ? d.conciseness_score     + '/10' : null },
            { label: i18n.jargon        || 'Jargon',          val: d.jargon_density },
            { label: i18n.sentVariety   || 'Sent. variety',   val: d.sentence_variety },
        ];

        html += '<div class="cqa-metrics-grid">';
        $.each(metrics, function (i, m) {
            if (m.val === null || m.val === undefined) return;
            html += '<div class="cqa-metric-item"><span class="cqa-metric-label">' + esc(m.label) + ': </span>'
                + '<strong class="cqa-metric-value">' + esc(m.val) + '</strong></div>';
        });
        html += '</div>';

        if (d.strengths && d.strengths.length) {
            html += '<div class="cqa-result-section">'
                + '<div class="cqa-section-label cqa-section-label--green">' + (i18n.strengths || 'Strengths') + '</div>';
            $.each(d.strengths, function (i, s) {
                html += '<div class="cqa-strength-item">✅ ' + esc(s) + '</div>';
            });
            html += '</div>';
        }

        if (d.issues && d.issues.length) {
            html += '<div class="cqa-result-section">'
                + '<div class="cqa-section-label cqa-section-label--gray">' + (i18n.issuesLabel || 'Issues') + '</div>';
            $.each(d.issues, function (i, iss) {
                html += '<div class="cqa-issue-item cqa-issue-item--' + esc(iss.severity || 'low') + '">'
                    + '<div class="cqa-issue-desc">' + esc(iss.description) + '</div>'
                    + (iss.suggestion ? '<div class="cqa-issue-suggestion">💡 ' + esc(iss.suggestion) + '</div>' : '')
                    + '</div>';
            });
            html += '</div>';
        }

        if (d.top_improvements && d.top_improvements.length) {
            html += '<div class="cqa-result-section">'
                + '<div class="cqa-section-label cqa-section-label--gray">' + (i18n.topImprovements || 'Top improvements') + '</div>'
                + '<ol class="cqa-top-improvements">';
            $.each(d.top_improvements, function (i, imp) {
                html += '<li>' + esc(imp) + '</li>';
            });
            html += '</ol></div>';
        }

        $('#cqa-readability-results').html(html).slideDown(250);

        var bc = score >= 70 ? 'badge-green' : (score >= 50 ? 'badge-yellow' : (score >= 30 ? 'badge-orange' : 'badge-red'));
        setBadge('cqa-badge-readability', score + '/100 ' + grade, bc);
    }

    /* ═══════════════════════════════════════════════════════
       AI-FRIENDLY
    ═══════════════════════════════════════════════════════ */

    function renderAiFriendly(d) {
        var score    = d.score    || 0;
        var grade    = d.grade    || '?';
        var criteria = d.criteria || [];
        var summary  = d.summary  || '';
        var tops     = d.top_improvements || [];
        var color    = gradeColor(score);

        var html = '<div class="cqa-score-header">';
        html += scoreCircle(score, grade, color);
        html += '<div class="cqa-score-meta">';
        if (summary) {
            html += '<p style="font-size:12px; color:#475569; margin:0 0 8px; line-height:1.5;">' + esc(summary) + '</p>';
        }
        if (tops.length) {
            html += '<div class="cqa-section-label cqa-section-label--gray">' + (i18n.improvPriorities || 'Improvement priorities') + '</div>'
                + '<ol class="cqa-top-improvements">';
            $.each(tops, function (i, t) { html += '<li>' + esc(t) + '</li>'; });
            html += '</ol>';
        }
        html += '</div></div>';

        html += '<div class="cqa-criteria-grid">';
        $.each(criteria, function (i, c) {
            var icon = c.status === 'pass' ? '✅' : (c.status === 'warn' ? '⚠️' : '❌');
            html += '<div class="cqa-criterion cqa-criterion--' + esc(c.status || 'fail') + '">'
                + '<div class="cqa-criterion-label">' + icon + ' ' + esc(c.label || c.id) + '</div>'
                + (c.note ? '<div class="cqa-criterion-note">' + esc(c.note) + '</div>' : '')
                + '</div>';
        });
        html += '</div>';

        $('#cqa-aifriendly-results').html(html).slideDown(250);

        var bc = score >= 80 ? 'badge-green' : (score >= 60 ? 'badge-yellow' : (score >= 40 ? 'badge-orange' : 'badge-red'));
        setBadge('cqa-badge-aifriendly', score + '/100 ' + grade, bc);
    }

    /* ═══════════════════════════════════════════════════════
       HEADING ANALYSIS (client-side)
    ═══════════════════════════════════════════════════════ */

    function parseHeadings() {
        var headings = [];

        if (isGutenberg()) {
            var blocks = wp.data.select('core/block-editor').getBlocks();
            (function walk(bs) {
                $.each(bs, function (i, b) {
                    if (b.name === 'core/heading') {
                        headings.push({
                            level: b.attributes.level || 2,
                            text:  $('<div>').html(b.attributes.content || '').text(),
                        });
                    }
                    if (b.innerBlocks && b.innerBlocks.length) walk(b.innerBlocks);
                });
            }(blocks));
        } else {
            var raw = isClassicEditor()
                ? tinymce.get('content').getContent()
                : (document.getElementById('content') || {}).value || '';
            var $wrap = $('<div>').html(raw);
            $wrap.find('h1,h2,h3,h4,h5,h6').each(function () {
                headings.push({
                    level: parseInt(this.tagName.replace('H', ''), 10),
                    text:  $(this).text(),
                });
            });
        }

        return headings;
    }

    function analyzeHeadings(headings) {
        var issues  = [];
        var h1Count = 0;
        var h2Count = 0;
        var h3Count = 0;

        $.each(headings, function (i, h) {
            if (h.level === 1) h1Count++;
            if (h.level === 2) h2Count++;
            if (h.level === 3) h3Count++;
        });

        if (h1Count === 0) {
            issues.push({ type: 'warn', msg: i18n.headingNoH1 || 'No H1 heading.' });
        } else if (h1Count > 1) {
            issues.push({ type: 'fail', msg: (i18n.headingMultiH1 || 'More than one H1') + ' (' + h1Count + ').' });
        }

        if (h2Count === 0 && headings.length > 0) {
            issues.push({ type: 'warn', msg: i18n.headingNoH2 || 'No H2 headings — add sections.' });
        }

        for (var i = 1; i < headings.length; i++) {
            var diff = headings[i].level - headings[i - 1].level;
            if (diff > 1) {
                issues.push({ type: 'warn', msg: (i18n.headingSkipped || 'Skipped level after') + ' "' + (headings[i - 1].text.substring(0, 30) || '...') + '".' });
            }
        }

        var score = 100;
        $.each(issues, function (i, iss) {
            score -= iss.type === 'fail' ? 30 : 15;
        });
        score = Math.max(0, score);

        return { headings: headings, issues: issues, score: score, h1: h1Count, h2: h2Count, h3: h3Count };
    }

    function renderHeadings(result) {
        var score = result.score;
        var color = gradeColor(score);
        var $wrap = $('#cqa-headings-results');
        var grade = score >= 80 ? 'A' : (score >= 60 ? 'B' : (score >= 40 ? 'C' : 'D'));
        var cls   = score >= 80 ? 'badge-green' : (score >= 60 ? 'badge-yellow' : (score >= 40 ? 'badge-orange' : 'badge-red'));
        setBadge('cqa-badge-headings', 'H1:' + result.h1 + ' H2:' + result.h2 + ' H3:' + result.h3, cls);

        var html = '<div class="cqa-score-header">'
            + scoreCircle(score, grade, color)
            + '<div class="cqa-score-meta">';

        if (result.issues.length === 0) {
            html += '<p style="color:#16a34a; font-size:12px;">✅ ' + (i18n.headingOk || 'Heading structure is correct.') + '</p>';
        } else {
            $.each(result.issues, function (i, iss) {
                var ic   = iss.type === 'fail' ? '#dc2626' : '#d97706';
                var icon = iss.type === 'fail' ? '❌' : '⚠️';
                html += '<div style="font-size:12px; color:' + ic + '; margin-bottom:4px;">' + icon + ' ' + esc(iss.msg) + '</div>';
            });
        }

        html += '</div></div>';

        if (result.headings.length) {
            html += '<div class="cqa-heading-tree">';
            $.each(result.headings, function (i, h) {
                var indent = (h.level - 1) * 14;
                html += '<div style="padding:2px 0 2px ' + indent + 'px; font-size:11px; color:#1e293b; border-left:2px solid #e2e8f0;">'
                    + '<span style="color:#94a3b8; font-size:10px; margin-right:4px;">H' + h.level + '</span>'
                    + esc(h.text.substring(0, 60) || (i18n.noText || '(no text)'))
                    + '</div>';
            });
            html += '</div>';
        } else {
            html += '<p style="font-size:12px; color:#94a3b8;">' + (i18n.noHeadings || 'No headings found in content.') + '</p>';
        }

        $wrap.html(html);
    }

    $(document).on('click', '#cqa-btn-headings', function () {
        if (!isGutenberg() && !isClassicEditor() && !extractContent().trim()) {
            $('#cqa-headings-results').html('<p style="color:#94a3b8; font-size:12px;">' + (i18n.noContent || 'No content.') + '</p>');
            return;
        }
        var headings = parseHeadings();
        var result   = analyzeHeadings(headings);
        renderHeadings(result);
        $('#cqa-section-headings .cqa-section-body').slideDown(200);
    });

    /* ═══════════════════════════════════════════════════════
       TL;DR GENERATOR
    ═══════════════════════════════════════════════════════ */

    function renderTldr(d) {
        var html = '';

        if (d.one_line) {
            html += '<div class="cqa-one-liner">' + esc(d.one_line) + '</div>';
        }

        if (d.tldr) {
            html += '<div class="cqa-tldr-box">'
                + '<div class="cqa-tldr-label">TL;DR</div>'
                + '<div class="cqa-tldr-text">' + esc(d.tldr) + '</div>'
                + '</div>';
        }

        if (d.key_points && d.key_points.length) {
            html += '<div class="cqa-key-points-label">' + (i18n.keyPoints || 'Key points') + '</div>'
                + '<ul class="cqa-key-points-list">';
            $.each(d.key_points, function (i, p) {
                html += '<li>' + esc(p) + '</li>';
            });
            html += '</ul>';
        }

        if (d.tldr) {
            html += '<button type="button" class="button cqa-copy-tldr" style="margin-top:10px; font-size:11px;" data-text="' + esc(d.tldr) + '">📋 ' + (i18n.copyTldr || 'Copy TL;DR') + '</button>';
        }

        $('#cqa-tldr-output').html(html);
    }

    $(document).on('click', '#cqa-btn-tldr', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-tldr-status').text(i18n.noContent || 'No content.'); return; }

        $btn.prop('disabled', true).text(i18n.generating || 'Generating…');
        $('#cqa-tldr-status').text('');
        $('#cqa-tldr-output').html('');

        ajaxPost('cqa_generate_tldr', { content: content },
            function (data) {
                $btn.prop('disabled', false).text('📝 ' + ($('[data-btn-tldr]').text() || 'Generate TL;DR'));
                renderTldr(data);
                $('#cqa-section-tldr .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('📝 ' + ($('[data-btn-tldr]').text() || 'Generate TL;DR'));
                $('#cqa-tldr-status').text((i18n.errPrefix || 'Error: ') + err);
            }
        );
    });

    $(document).on('click', '.cqa-copy-tldr', function () {
        var text = $(this).data('text');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        $(this).text('✓ ' + (i18n.copied || 'Copied!'));
        var $btn = $(this);
        setTimeout(function () { $btn.text('📋 ' + (i18n.copyTldr || 'Copy TL;DR')); }, 2000);
    });

    /* ═══════════════════════════════════════════════════════
       REWRITE FRAGMENT
    ═══════════════════════════════════════════════════════ */

    function renderRewrite(d) {
        var html = '';

        if (d.improvements && d.improvements.length) {
            html += '<div class="cqa-improvements-notice">'
                + '<strong>' + (i18n.whatImproved || 'What was improved:') + '</strong> '
                + $.map(d.improvements, function (imp) { return esc(imp); }).join(' · ')
                + '</div>';
        }

        $.each(d.rewrites || [], function (i, rewrite) {
            html += '<div class="cqa-rewrite-panel">'
                + '<div class="cqa-rewrite-ver">' + (i18n.version || 'Version') + ' ' + (i + 1) + '</div>'
                + '<div class="cqa-rewrite-text">' + esc(rewrite) + '</div>'
                + '<button type="button" class="button cqa-rewrite-copy" style="font-size:11px;" data-text="' + esc(rewrite) + '">📋 ' + (i18n.copy || 'Copy') + '</button>'
                + '</div>';
        });

        $('#cqa-rewrite-output').html(html);
    }

    $(document).on('click', '#cqa-btn-rewrite', function () {
        var $btn     = $(this);
        var fragment = $('#cqa-rewrite-input').val().trim();
        var hint     = $('#cqa-rewrite-hint').val().trim();

        if (!fragment) { $('#cqa-rewrite-status').text(i18n.noContent || 'No content.'); return; }

        $btn.prop('disabled', true).text(i18n.rewriting || 'Rewriting…');
        $('#cqa-rewrite-status').text('');
        $('#cqa-rewrite-output').html('');

        ajaxPost('cqa_rewrite_fragment', { fragment: fragment, hint: hint },
            function (data) {
                $btn.prop('disabled', false).text('✏️ ' + ($('#cqa-btn-rewrite').attr('data-orig') || 'Rewrite fragment'));
                renderRewrite(data);
            },
            function (err) {
                $btn.prop('disabled', false).text('✏️ ' + ($('#cqa-btn-rewrite').attr('data-orig') || 'Rewrite fragment'));
                $('#cqa-rewrite-status').text((i18n.errPrefix || 'Error: ') + err);
            }
        );
    });

    $(document).on('click', '.cqa-rewrite-copy', function () {
        var text = $(this).data('text');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        $(this).text('✓ ' + (i18n.copied || 'Copied!'));
        var $btn = $(this);
        setTimeout(function () { $btn.text('📋 ' + (i18n.copy || 'Copy')); }, 2000);
    });

    /* ═══════════════════════════════════════════════════════
       HISTORY + SPARKLINE
    ═══════════════════════════════════════════════════════ */

    function buildSparkline(history) {
        var n = history.length;
        if (n < 2) return '';

        var W = 300, H = 80, pad = 20;

        function points(key) {
            var pts = [];
            $.each(history, function (i, e) {
                if (e[key] !== null && e[key] !== undefined) {
                    pts.push({ x: i, y: e[key] });
                }
            });
            return pts;
        }

        function toPath(pts) {
            if (!pts.length) return '';
            var d = '';
            $.each(pts, function (i, p) {
                var x = pad + (p.x / Math.max(n - 1, 1)) * (W - pad * 2);
                var y = H - pad - (p.y / 100) * (H - pad * 2);
                d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
            });
            return d;
        }

        var readPts = points('read_score');
        var aiPts   = points('ai_score');
        if (!readPts.length && !aiPts.length) return '';

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" class="cqa-sparkline">';

        // Grid lines
        $.each([25, 50, 75, 100], function (i, v) {
            var y = (H - pad - (v / 100) * (H - pad * 2)).toFixed(1);
            svg += '<line x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '" stroke="#e2e8f0" stroke-width="1"/>';
            svg += '<text x="' + (pad - 3) + '" y="' + (parseFloat(y) + 3) + '" font-size="8" fill="#94a3b8" text-anchor="end">' + v + '</text>';
        });

        if (readPts.length > 1) {
            svg += '<path d="' + toPath(readPts) + '" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            $.each(readPts, function (i, p) {
                var x = (pad + (p.x / Math.max(n - 1, 1)) * (W - pad * 2)).toFixed(1);
                var y = (H - pad - (p.y / 100) * (H - pad * 2)).toFixed(1);
                svg += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#6366f1"/>';
            });
        }

        if (aiPts.length > 1) {
            svg += '<path d="' + toPath(aiPts) + '" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
            $.each(aiPts, function (i, p) {
                var x = (pad + (p.x / Math.max(n - 1, 1)) * (W - pad * 2)).toFixed(1);
                var y = (H - pad - (p.y / 100) * (H - pad * 2)).toFixed(1);
                svg += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#0ea5e9"/>';
            });
        }

        svg += '</svg>';

        var legend = '<div class="cqa-sparkline-legend">';
        if (readPts.length > 1) legend += '<span class="cqa-sparkline-dot">' + (i18n.histRead || 'Readability') + '</span>';
        if (aiPts.length > 1)   legend += '<span class="cqa-sparkline-dot cqa-sparkline-dot--ai">' + (i18n.histAi || 'AI-Friendly') + '</span>';
        legend += '</div>';

        return '<div class="cqa-sparkline-wrap">' + svg + legend + '</div>';
    }

    function renderHistory(history) {
        var $wrap = $('#cqa-history-wrap');

        if (!history || !history.length) {
            $wrap.html('<p style="font-size:12px; color:#94a3b8;">' + (i18n.noHistory || 'No analysis history.') + '</p>');
            return;
        }

        var html = buildSparkline(history);

        html += '<table class="cqa-history-table">'
            + '<thead><tr>'
            + '<th>' + (i18n.histDate || 'Date') + '</th>'
            + '<th>' + (i18n.histSpell || 'Spelling errors') + '</th>'
            + '<th>' + (i18n.histRead || 'Readability') + '</th>'
            + '<th>' + (i18n.histAi || 'AI-Friendly') + '</th>'
            + '</tr></thead><tbody>';

        $.each(history, function (i, entry) {
            var readCell = entry.read_score !== null && entry.read_score !== undefined
                ? '<span style="color:' + gradeColor(entry.read_score) + '; font-weight:700;">' + entry.read_score + '/100 ' + (entry.read_grade || '') + '</span>'
                : '<span style="color:#94a3b8;">—</span>';
            var aiCell = entry.ai_score !== null && entry.ai_score !== undefined
                ? '<span style="color:' + gradeColor(entry.ai_score) + '; font-weight:700;">' + entry.ai_score + '/100 ' + (entry.ai_grade || '') + '</span>'
                : '<span style="color:#94a3b8;">—</span>';
            var spellCell = entry.spell_errors !== null && entry.spell_errors !== undefined
                ? (entry.spell_errors === 0
                    ? '<span style="color:#16a34a; font-weight:700;">0 ✓</span>'
                    : '<span style="color:#dc2626; font-weight:700;">' + entry.spell_errors + '</span>')
                : '<span style="color:#94a3b8;">—</span>';

            html += '<tr>'
                + '<td style="white-space:nowrap;">' + esc(entry.date || '') + '</td>'
                + '<td>' + spellCell + '</td>'
                + '<td>' + readCell + '</td>'
                + '<td>' + aiCell + '</td>'
                + '</tr>';
        });

        html += '</tbody></table>';
        $wrap.html(html);
    }

    /* ═══════════════════════════════════════════════════════
       INDIVIDUAL BUTTON HANDLERS
    ═══════════════════════════════════════════════════════ */

    $(document).on('click', '#cqa-btn-spell', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-spell-status').text(i18n.noContent || 'No content.'); return; }

        $btn.prop('disabled', true).text(i18n.checking || 'Checking…');
        $('#cqa-spell-status').text('');
        $('#cqa-spell-list').empty();
        $('#cqa-spell-empty, #cqa-spell-actions').hide();

        ajaxPost('cqa_spell_check', { content: content },
            function (data) {
                $btn.prop('disabled', false).text('🔍 ' + ($('#cqa-btn-spell').data('label') || 'Check spelling'));
                renderSpell(data);
                $('#cqa-section-spell .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('🔍 ' + ($('#cqa-btn-spell').data('label') || 'Check spelling'));
                $('#cqa-spell-status').text((i18n.errPrefix || 'Error: ') + err);
            }
        );
    });

    $(document).on('click', '#cqa-btn-readability', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-readability-status').text(i18n.noContent || 'No content.'); return; }

        $btn.prop('disabled', true).text(i18n.analyzing || 'Analyzing…');
        $('#cqa-readability-status').text('');
        $('#cqa-readability-results').hide().html('');

        ajaxPost('cqa_readability', { content: content },
            function (data) {
                $btn.prop('disabled', false).text('📊 ' + ($('#cqa-btn-readability').data('label') || 'Analyze readability'));
                renderReadability(data);
                $('#cqa-section-readability .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('📊 ' + ($('#cqa-btn-readability').data('label') || 'Analyze readability'));
                $('#cqa-readability-status').text((i18n.errPrefix || 'Error: ') + err);
            }
        );
    });

    $(document).on('click', '#cqa-btn-aifriendly', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-aifriendly-status').text(i18n.noContent || 'No content.'); return; }

        $btn.prop('disabled', true).text(i18n.analyzing || 'Analyzing…');
        $('#cqa-aifriendly-status').text('');
        $('#cqa-aifriendly-results').hide().html('');

        ajaxPost('cqa_ai_friendly', { content: content, post_title: getPostTitle() },
            function (data) {
                $btn.prop('disabled', false).text('🤖 ' + ($('#cqa-btn-aifriendly').data('label') || 'Check AI-Friendly'));
                renderAiFriendly(data);
                $('#cqa-section-aifriendly .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('🤖 ' + ($('#cqa-btn-aifriendly').data('label') || 'Check AI-Friendly'));
                $('#cqa-aifriendly-status').text((i18n.errPrefix || 'Error: ') + err);
            }
        );
    });

    /* ═══════════════════════════════════════════════════════
       ANALYZE ALL
    ═══════════════════════════════════════════════════════ */

    $(document).on('click', '#cqa-btn-all', function () {
        var content = extractContent();
        if (!content.trim()) {
            $('#cqa-all-progress').show();
            $('#cqa-all-label').text(i18n.noContentAlert || 'No content to analyze. Please add content to the post.');
            setTimeout(function () { $('#cqa-all-progress').hide(); }, 3000);
            return;
        }

        var $btn      = $(this);
        var $progress = $('#cqa-all-progress');
        var $cost     = $('#cqa-all-cost');

        $btn.prop('disabled', true).text(i18n.analyzing || 'Analyzing…');
        $progress.show();
        $cost.hide();

        var totalCost = 0;
        var steps = [
            { action: 'cqa_spell_check',  pct: 33, label: i18n.checkingSpelling || 'Checking spelling…',     render: renderSpell,       section: '#cqa-section-spell' },
            { action: 'cqa_readability',   pct: 66, label: i18n.analyzingRead    || 'Analyzing readability…', render: renderReadability,  section: '#cqa-section-readability' },
            { action: 'cqa_ai_friendly',   pct: 99, label: i18n.checkingAI       || 'Checking AI-Friendly…',  render: renderAiFriendly,   section: '#cqa-section-aifriendly' },
        ];

        setProgress('cqa-all-fill', 'cqa-all-pct', 'cqa-all-label', 0, i18n.preparing || 'Preparing…');

        function runStep(index) {
            if (index >= steps.length) {
                setProgress('cqa-all-fill', 'cqa-all-pct', 'cqa-all-label', 100, i18n.done || 'Done!');
                $btn.prop('disabled', false).text('✨ ' + ($('#cqa-btn-all').data('label') || 'Analyze all'));
                setTimeout(function () { $progress.hide(); }, 1500);
                if (totalCost > 0) {
                    $cost.text((i18n.costPrefix || 'Cost: $') + totalCost.toFixed(5)).show();
                }
                return;
            }

            var step = steps[index];
            setProgress('cqa-all-fill', 'cqa-all-pct', 'cqa-all-label', step.pct - 33, step.label);

            var extra = { content: content };
            if (step.action === 'cqa_ai_friendly') {
                extra.post_title = getPostTitle();
            }

            ajaxPost(step.action, extra,
                function (data) {
                    setProgress('cqa-all-fill', 'cqa-all-pct', 'cqa-all-label', step.pct, step.label);
                    step.render(data);
                    $(step.section + ' .cqa-section-body').slideDown(200);
                    if (data.api_cost) totalCost += parseFloat(data.api_cost);
                    runStep(index + 1);
                },
                function (err) {
                    console.warn('CQA step error:', err);
                    runStep(index + 1);
                }
            );
        }

        runStep(0);
    });

    /* ═══════════════════════════════════════════════════════
       INIT: LOAD CACHED RESULTS
    ═══════════════════════════════════════════════════════ */

    $(function () {
        // Store button labels for restoring after async ops
        $('#cqa-btn-spell').data('label', $('#cqa-btn-spell').text().replace(/^[^\s]+\s/, '').trim());
        $('#cqa-btn-readability').data('label', $('#cqa-btn-readability').text().replace(/^[^\s]+\s/, '').trim());
        $('#cqa-btn-aifriendly').data('label', $('#cqa-btn-aifriendly').text().replace(/^[^\s]+\s/, '').trim());
        $('#cqa-btn-all').data('label', $('#cqa-btn-all').text().replace(/^[^\s]+\s/, '').trim());

        if (panel.cachedSpell) {
            renderSpell(panel.cachedSpell);
        }
        if (panel.cachedRead) {
            renderReadability(panel.cachedRead);
            $('#cqa-readability-results').show();
        }
        if (panel.cachedAi) {
            renderAiFriendly(panel.cachedAi);
            $('#cqa-aifriendly-results').show();
        }
        if (panel.cachedHistory && panel.cachedHistory.length) {
            renderHistory(panel.cachedHistory);
        }
    });

}(jQuery));
