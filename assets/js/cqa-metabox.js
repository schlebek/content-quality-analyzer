/* global wp, tinymce */
(function ($) {
    'use strict';

    var panel = window.cqaPanel || {};

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

    /* ── Score circle ─────────────────────────────────────── */

    function scoreCircle(score, grade, color) {
        return '<div style="text-align:center; flex-shrink:0;">'
            + '<div style="width:72px; height:72px; border-radius:50%; border:5px solid ' + color + '; '
            + 'display:flex; flex-direction:column; align-items:center; justify-content:center; margin:0 auto 4px;">'
            + '<span style="font-size:22px; font-weight:800; color:' + color + '; line-height:1;">' + score + '</span>'
            + '<span style="font-size:9px; color:#94a3b8; line-height:1;">/ 100</span>'
            + '</div>'
            + '<div style="font-size:13px; font-weight:700; color:' + color + ';">' + esc(grade) + '</div>'
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
                fail(res.data || 'Nieznany błąd');
            }
        }).fail(function () {
            fail('Błąd połączenia z serwerem.');
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

        if (!errors.length) {
            $empty.show();
            $actions.hide();
            setBadge('cqa-badge-spell', '0 błędów', 'badge-green');
            return;
        }

        $empty.hide();
        $actions.show();

        var typeColors = { ortografia: '#dc2626', gramatyka: '#d97706', interpunkcja: '#7c3aed', styl: '#0369a1' };

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
                    $('<button type="button">').addClass('cqa-spell-go button').css('font-size', '11px').html('🔍 Znajdź'),
                    $('<button type="button">').addClass('cqa-spell-fix button').css('font-size', '11px').html('✓ Popraw')
                )
            );

            $list.append($row);
        });

        var cls = errors.length > 10 ? 'badge-red' : (errors.length > 4 ? 'badge-orange' : 'badge-yellow');
        setBadge('cqa-badge-spell', errors.length + ' błędów', cls);
    }

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
            $row.find('.cqa-spell-fix').text('Nie znaleziono').prop('disabled', true);
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

        var html = '<div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:14px;">';
        html += scoreCircle(score, grade, color);
        html += '<div style="flex:1; min-width:0;">'
            + '<div style="font-size:16px; font-weight:700; color:#1e293b; margin-bottom:2px;">' + esc(d.reading_level || '') + '</div>'
            + '<div style="font-size:12px; color:#64748b; margin-bottom:8px;">' + esc(d.reading_level_description || '') + '</div>'
            + '<div style="font-size:12px; color:#475569;">⏱ Czas czytania: <strong>~' + esc(d.reading_time_minutes || '?') + ' min</strong></div>'
            + '</div></div>';

        var metrics = [
            { label: 'Słów',               val: d.word_count },
            { label: 'Zdań',               val: d.sentence_count },
            { label: 'Akapitów',           val: d.paragraph_count },
            { label: 'Śr. dł. zdania',     val: d.avg_sentence_length   ? d.avg_sentence_length + ' słów' : null },
            { label: 'Długie zdania',      val: d.long_sentences_count  !== undefined ? d.long_sentences_count  + ' (>30 słów)' : null },
            { label: 'Krótkie zdania',     val: d.short_sentences_count !== undefined ? d.short_sentences_count + ' (<8 słów)'  : null },
            { label: 'Strona bierna',      val: d.passive_voice_pct     !== undefined ? d.passive_voice_pct     + '%' : null },
            { label: 'Trudne słowa',       val: d.complex_words_pct     !== undefined ? d.complex_words_pct     + '%' : null },
            { label: 'Słownictwo',         val: d.vocabulary_richness },
            { label: 'Nagłówki H2/H3',    val: d.heading_count         !== undefined ? d.heading_count + ' (' + (d.heading_structure || '?') + ')' : null },
            { label: 'Struktura akapitów', val: d.paragraph_structure },
            { label: 'Spójniki',           val: d.connective_words_quality },
            { label: 'Przepływ logiczny',  val: d.logical_flow_score    !== undefined ? d.logical_flow_score    + '/10' : null },
            { label: 'Zaangażowanie',      val: d.emotional_engagement },
            { label: 'Jasność',            val: d.clarity_score         !== undefined ? d.clarity_score         + '/10' : null },
            { label: 'Zwięzłość',          val: d.conciseness_score     !== undefined ? d.conciseness_score     + '/10' : null },
            { label: 'Żargon',             val: d.jargon_density },
            { label: 'Zróżnicowanie zdań', val: d.sentence_variety },
        ];

        html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:12px;">';
        $.each(metrics, function (i, m) {
            if (m.val === null || m.val === undefined) return;
            html += '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:5px; padding:5px 9px; font-size:11px;">'
                + '<span style="color:#64748b;">' + esc(m.label) + ': </span>'
                + '<strong style="color:#1e293b;">' + esc(m.val) + '</strong>'
                + '</div>';
        });
        html += '</div>';

        if (d.strengths && d.strengths.length) {
            html += '<div style="margin-bottom:10px;">'
                + '<div style="font-size:11px; font-weight:700; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Mocne strony</div>';
            $.each(d.strengths, function (i, s) {
                html += '<div style="font-size:12px; color:#166534; margin-bottom:2px;">✅ ' + esc(s) + '</div>';
            });
            html += '</div>';
        }

        if (d.issues && d.issues.length) {
            html += '<div style="margin-bottom:10px;">'
                + '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Problemy</div>';
            var sevColor = { high: '#dc2626', medium: '#d97706', low: '#64748b' };
            $.each(d.issues, function (i, iss) {
                var sc = sevColor[iss.severity] || '#64748b';
                html += '<div style="border-left:3px solid ' + sc + '; padding:6px 10px; background:#f8fafc; border-radius:0 4px 4px 0; margin-bottom:5px; font-size:12px;">'
                    + '<div style="font-weight:600; color:#1e293b;">' + esc(iss.description) + '</div>'
                    + (iss.suggestion ? '<div style="color:#64748b; margin-top:2px;">💡 ' + esc(iss.suggestion) + '</div>' : '')
                    + '</div>';
            });
            html += '</div>';
        }

        if (d.top_improvements && d.top_improvements.length) {
            html += '<div>'
                + '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">Top 3 priorytety poprawy</div>'
                + '<ol style="margin:0; padding-left:18px; font-size:12px; color:#475569;">';
            $.each(d.top_improvements, function (i, imp) {
                html += '<li style="margin-bottom:3px;">' + esc(imp) + '</li>';
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

        var html = '<div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:14px;">';
        html += scoreCircle(score, grade, color);
        html += '<div style="flex:1; min-width:0;">';
        if (summary) {
            html += '<p style="font-size:12px; color:#475569; margin:0 0 8px; line-height:1.5;">' + esc(summary) + '</p>';
        }
        if (tops.length) {
            html += '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Priorytety poprawy</div>'
                + '<ol style="margin:0; padding-left:18px; font-size:12px; color:#475569;">';
            $.each(tops, function (i, t) { html += '<li style="margin-bottom:2px;">' + esc(t) + '</li>'; });
            html += '</ol>';
        }
        html += '</div></div>';

        html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">';
        $.each(criteria, function (i, c) {
            var icon = c.status === 'pass' ? '✅' : (c.status === 'warn' ? '⚠️' : '❌');
            var bg   = c.status === 'pass' ? '#f0fdf4' : (c.status === 'warn' ? '#fffbeb' : '#fef2f2');
            var bdr  = c.status === 'pass' ? '#bbf7d0' : (c.status === 'warn' ? '#fde68a' : '#fecaca');
            html += '<div style="background:' + bg + '; border:1px solid ' + bdr + '; border-radius:6px; padding:6px 9px; font-size:11px;">'
                + '<div style="font-weight:600; color:#1e293b; margin-bottom:1px;">' + icon + ' ' + esc(c.label || c.id) + '</div>'
                + (c.note ? '<div style="color:#64748b; font-size:10px;">' + esc(c.note) + '</div>' : '')
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
        var issues   = [];
        var h1Count  = 0;
        var h2Count  = 0;
        var h3Count  = 0;

        $.each(headings, function (i, h) {
            if (h.level === 1) h1Count++;
            if (h.level === 2) h2Count++;
            if (h.level === 3) h3Count++;
        });

        if (h1Count === 0) {
            issues.push({ type: 'warn', msg: 'Brak nagłówka H1.' });
        } else if (h1Count > 1) {
            issues.push({ type: 'fail', msg: 'Więcej niż jeden H1 (' + h1Count + ').' });
        }

        if (h2Count === 0 && headings.length > 0) {
            issues.push({ type: 'warn', msg: 'Brak nagłówków H2 — dodaj sekcje.' });
        }

        // Check for skipped levels
        for (var i = 1; i < headings.length; i++) {
            var diff = headings[i].level - headings[i - 1].level;
            if (diff > 1) {
                issues.push({ type: 'warn', msg: 'Pominięty poziom po "' + (headings[i - 1].text.substring(0, 30) || '...') + '".' });
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
        var score  = result.score;
        var color  = gradeColor(score);
        var $wrap  = $('#cqa-headings-results');

        var grade  = score >= 80 ? 'A' : (score >= 60 ? 'B' : (score >= 40 ? 'C' : 'D'));
        var cls    = score >= 80 ? 'badge-green' : (score >= 60 ? 'badge-yellow' : (score >= 40 ? 'badge-orange' : 'badge-red'));
        setBadge('cqa-badge-headings', 'H1:' + result.h1 + ' H2:' + result.h2 + ' H3:' + result.h3, cls);

        var html = '<div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap; margin-bottom:10px;">'
            + scoreCircle(score, grade, color)
            + '<div style="flex:1; min-width:0;">';

        if (result.issues.length === 0) {
            html += '<p style="color:#16a34a; font-size:12px;">✅ Struktura nagłówków jest poprawna.</p>';
        } else {
            $.each(result.issues, function (i, iss) {
                var ic = iss.type === 'fail' ? '#dc2626' : '#d97706';
                var icon = iss.type === 'fail' ? '❌' : '⚠️';
                html += '<div style="font-size:12px; color:' + ic + '; margin-bottom:4px;">' + icon + ' ' + esc(iss.msg) + '</div>';
            });
        }

        html += '</div></div>';

        if (result.headings.length) {
            html += '<div class="cqa-heading-tree">';
            $.each(result.headings, function (i, h) {
                var indent = (h.level - 1) * 14;
                html += '<div style="padding:2px 0 2px ' + indent + 'px; font-size:11px; color:#1e293b; border-left:2px solid #e2e8f0; margin-left:' + (indent > 0 ? 0 : 0) + 'px;">'
                    + '<span style="color:#94a3b8; font-size:10px; margin-right:4px;">H' + h.level + '</span>'
                    + esc(h.text.substring(0, 60) || '(brak tekstu)')
                    + '</div>';
            });
            html += '</div>';
        } else {
            html += '<p style="font-size:12px; color:#94a3b8;">Nie znaleziono nagłówków w treści.</p>';
        }

        $wrap.html(html);
    }

    $(document).on('click', '#cqa-btn-headings', function () {
        if (!isGutenberg() && !isClassicEditor() && !extractContent().trim()) {
            $('#cqa-headings-results').html('<p style="color:#94a3b8; font-size:12px;">Brak treści.</p>');
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
            html += '<div style="background:#6366f1; color:#fff; border-radius:6px; padding:8px 12px; margin-bottom:10px; font-size:13px; font-weight:600;">'
                + esc(d.one_line)
                + '</div>';
        }

        if (d.tldr) {
            html += '<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px 14px; margin-bottom:10px;">'
                + '<div style="font-size:10px; font-weight:700; color:#16a34a; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:5px;">TL;DR</div>'
                + '<div style="font-size:13px; color:#166534; line-height:1.5;">' + esc(d.tldr) + '</div>'
                + '</div>';
        }

        if (d.key_points && d.key_points.length) {
            html += '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Kluczowe punkty</div>'
                + '<ul style="margin:0; padding-left:18px;">';
            $.each(d.key_points, function (i, p) {
                html += '<li style="font-size:12px; color:#1e293b; margin-bottom:4px;">' + esc(p) + '</li>';
            });
            html += '</ul>';
        }

        // Copy button
        if (d.tldr) {
            html += '<button type="button" class="button cqa-copy-tldr" style="margin-top:10px; font-size:11px;" data-text="' + esc(d.tldr) + '">📋 Kopiuj TL;DR</button>';
        }

        $('#cqa-tldr-output').html(html);
    }

    $(document).on('click', '#cqa-btn-tldr', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-tldr-status').text('Brak treści.'); return; }

        $btn.prop('disabled', true).text('Generuję…');
        $('#cqa-tldr-status').text('');
        $('#cqa-tldr-output').html('');

        ajaxPost('cqa_generate_tldr', { content: content },
            function (data) {
                $btn.prop('disabled', false).text('📝 Generuj TL;DR');
                renderTldr(data);
                $('#cqa-section-tldr .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('📝 Generuj TL;DR');
                $('#cqa-tldr-status').text('Błąd: ' + err);
            }
        );
    });

    $(document).on('click', '.cqa-copy-tldr', function () {
        var text = $(this).data('text');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () {
                // success
            });
        }
        $(this).text('✓ Skopiowano!');
        var $btn = $(this);
        setTimeout(function () { $btn.text('📋 Kopiuj TL;DR'); }, 2000);
    });

    /* ═══════════════════════════════════════════════════════
       REWRITE FRAGMENT
    ═══════════════════════════════════════════════════════ */

    function renderRewrite(d) {
        var html = '';

        if (d.improvements && d.improvements.length) {
            html += '<div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:8px 12px; margin-bottom:10px; font-size:11px;">'
                + '<strong style="color:#92400e;">Co poprawiono:</strong> '
                + $.map(d.improvements, function (imp) { return esc(imp); }).join(' · ')
                + '</div>';
        }

        html += '<div class="cqa-rewrite-panels">';

        $.each(d.rewrites || [], function (i, rewrite) {
            html += '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px;">'
                + '<div style="font-size:10px; font-weight:700; color:#6366f1; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Wersja ' + (i + 1) + '</div>'
                + '<div style="font-size:12px; color:#1e293b; line-height:1.6; margin-bottom:8px;">' + esc(rewrite) + '</div>'
                + '<button type="button" class="button cqa-rewrite-copy" style="font-size:11px;" data-text="' + esc(rewrite) + '">📋 Kopiuj</button>'
                + '</div>';
        });

        html += '</div>';

        $('#cqa-rewrite-output').html(html);
    }

    $(document).on('click', '#cqa-btn-rewrite', function () {
        var $btn     = $(this);
        var fragment = $('#cqa-rewrite-input').val().trim();
        var hint     = $('#cqa-rewrite-hint').val().trim();

        if (!fragment) { $('#cqa-rewrite-status').text('Wklej fragment tekstu.'); return; }

        $btn.prop('disabled', true).text('Przepisuję…');
        $('#cqa-rewrite-status').text('');
        $('#cqa-rewrite-output').html('');

        ajaxPost('cqa_rewrite_fragment', { fragment: fragment, hint: hint },
            function (data) {
                $btn.prop('disabled', false).text('✏️ Przepisz fragment');
                renderRewrite(data);
            },
            function (err) {
                $btn.prop('disabled', false).text('✏️ Przepisz fragment');
                $('#cqa-rewrite-status').text('Błąd: ' + err);
            }
        );
    });

    $(document).on('click', '.cqa-rewrite-copy', function () {
        var text = $(this).data('text');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        $(this).text('✓ Skopiowano!');
        var $btn = $(this);
        setTimeout(function () { $btn.text('📋 Kopiuj'); }, 2000);
    });

    /* ═══════════════════════════════════════════════════════
       HISTORY
    ═══════════════════════════════════════════════════════ */

    function renderHistory(history) {
        var $wrap = $('#cqa-history-wrap');

        if (!history || !history.length) {
            $wrap.html('<p style="font-size:12px; color:#94a3b8;">Brak historii analiz.</p>');
            return;
        }

        var html = '<table class="cqa-history-table">'
            + '<thead><tr>'
            + '<th>Data</th><th>Błędy pisowni</th><th>Czytelność</th><th>AI-Friendly</th>'
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
        if (!content.trim()) { $('#cqa-spell-status').text('Brak treści.'); return; }

        $btn.prop('disabled', true).text('Sprawdzam…');
        $('#cqa-spell-status').text('');
        $('#cqa-spell-list').empty();
        $('#cqa-spell-empty, #cqa-spell-actions').hide();

        ajaxPost('cqa_spell_check', { content: content },
            function (data) {
                $btn.prop('disabled', false).text('🔍 Sprawdź pisownię');
                renderSpell(data);
                $('#cqa-section-spell .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('🔍 Sprawdź pisownię');
                $('#cqa-spell-status').text('Błąd: ' + err);
            }
        );
    });

    $(document).on('click', '#cqa-btn-readability', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-readability-status').text('Brak treści.'); return; }

        $btn.prop('disabled', true).text('Analizuję…');
        $('#cqa-readability-status').text('');
        $('#cqa-readability-results').hide().html('');

        ajaxPost('cqa_readability', { content: content },
            function (data) {
                $btn.prop('disabled', false).text('📊 Analizuj czytelność');
                renderReadability(data);
                $('#cqa-section-readability .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('📊 Analizuj czytelność');
                $('#cqa-readability-status').text('Błąd: ' + err);
            }
        );
    });

    $(document).on('click', '#cqa-btn-aifriendly', function () {
        var $btn    = $(this);
        var content = extractContent();
        if (!content.trim()) { $('#cqa-aifriendly-status').text('Brak treści.'); return; }

        $btn.prop('disabled', true).text('Analizuję…');
        $('#cqa-aifriendly-status').text('');
        $('#cqa-aifriendly-results').hide().html('');

        ajaxPost('cqa_ai_friendly', { content: content, post_title: getPostTitle() },
            function (data) {
                $btn.prop('disabled', false).text('🤖 Sprawdź AI-Friendly');
                renderAiFriendly(data);
                $('#cqa-section-aifriendly .cqa-section-body').slideDown(200);
            },
            function (err) {
                $btn.prop('disabled', false).text('🤖 Sprawdź AI-Friendly');
                $('#cqa-aifriendly-status').text('Błąd: ' + err);
            }
        );
    });

    /* ═══════════════════════════════════════════════════════
       ANALYZE ALL
    ═══════════════════════════════════════════════════════ */

    $(document).on('click', '#cqa-btn-all', function () {
        var content = extractContent();
        if (!content.trim()) {
            alert('Brak treści do analizy. Dodaj treść do wpisu.');
            return;
        }

        var $btn      = $(this);
        var $progress = $('#cqa-all-progress');
        var $cost     = $('#cqa-all-cost');

        $btn.prop('disabled', true).text('Analizuję…');
        $progress.show();
        $cost.hide();

        var totalCost = 0;
        var steps = [
            { action: 'cqa_spell_check',  pct: 33, label: 'Sprawdzam pisownię…',     render: renderSpell,      section: '#cqa-section-spell' },
            { action: 'cqa_readability',   pct: 66, label: 'Analizuję czytelność…',   render: renderReadability, section: '#cqa-section-readability' },
            { action: 'cqa_ai_friendly',   pct: 99, label: 'Weryfikuję AI-Friendly…', render: renderAiFriendly,  section: '#cqa-section-aifriendly' },
        ];

        setProgress('cqa-all-fill', 'cqa-all-pct', 'cqa-all-label', 0, 'Przygotowuję…');

        function runStep(index) {
            if (index >= steps.length) {
                setProgress('cqa-all-fill', 'cqa-all-pct', 'cqa-all-label', 100, 'Gotowe!');
                $btn.prop('disabled', false).text('✨ Analizuj wszystko');
                setTimeout(function () { $progress.hide(); }, 1500);
                if (totalCost > 0) {
                    $cost.text('Koszt: $' + totalCost.toFixed(5)).show();
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
