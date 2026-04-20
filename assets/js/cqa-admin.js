(function ($) {
    'use strict';

    var admin = window.cqaAdmin || {};
    var selectedPostId  = null;
    var selectedTitle   = '';

    /* ── Tab navigation ───────────────────────────────────── */

    $(document).on('click', '.cqa-tab-link', function (e) {
        e.preventDefault();
        var target = $(this).attr('href');
        $('.cqa-tab-link').removeClass('active');
        $('.cqa-tab-panel').removeClass('active');
        $(this).addClass('active');
        $(target).addClass('active');
    });

    /* ═══════════════════════════════════════════════════════
       OVERVIEW TAB
    ═══════════════════════════════════════════════════════ */

    var ovSortCol = 'title';
    var ovSortAsc = true;
    var ovData    = [];

    $(document).on('click', '#cqa-ov-load-btn', function () {
        var $btn    = $(this);
        var $status = $('#cqa-ov-status');
        var type    = $('#cqa-ov-type').val();

        $btn.prop('disabled', true).text('Ładuję…');
        $status.text('');
        $('#cqa-ov-table-wrap').html('');

        $.post(admin.ajaxUrl, {
            action:    'cqa_overview_posts',
            nonce:     admin.nonce,
            post_type: type,
        }, function (res) {
            $btn.prop('disabled', false).text('📋 Załaduj listę');
            if (!res.success) {
                $status.text('Błąd: ' + (res.data || 'nieznany'));
                return;
            }
            ovData = res.data || [];
            $status.text(ovData.length + ' wpisów');
            renderOverviewTable();
        }).fail(function () {
            $btn.prop('disabled', false).text('📋 Załaduj listę');
            $status.text('Błąd połączenia.');
        });
    });

    function renderOverviewTable() {
        if (!ovData.length) {
            $('#cqa-ov-table-wrap').html('<p style="color:#94a3b8; font-size:13px;">Brak wpisów.</p>');
            return;
        }

        var sorted = ovData.slice().sort(function (a, b) {
            var av = a[ovSortCol];
            var bv = b[ovSortCol];
            if (av === null || av === undefined) return ovSortAsc ? 1 : -1;
            if (bv === null || bv === undefined) return ovSortAsc ? -1 : 1;
            if (typeof av === 'string') return ovSortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
            return ovSortAsc ? av - bv : bv - av;
        });

        function th(col, label) {
            var arrow = ovSortCol === col ? (ovSortAsc ? ' ▲' : ' ▼') : '';
            return '<th class="cqa-ov-th" data-col="' + col + '" style="cursor:pointer; white-space:nowrap;">' + label + arrow + '</th>';
        }

        function scoreCell(score, grade) {
            if (score === null || score === undefined) return '<td style="color:#94a3b8; font-size:11px;">—</td>';
            var color = gradeColor(score);
            return '<td style="font-weight:700; color:' + color + ';">' + score + ' <small>' + esc(grade || '') + '</small></td>';
        }

        var html = '<div style="overflow-x:auto;">'
            + '<table class="widefat cqa-ov-table" style="font-size:12px;">'
            + '<thead><tr>'
            + th('title', 'Tytuł')
            + th('type',  'Typ')
            + th('spell_errors', '🔤 Błędy')
            + th('read_score',   '📊 Czytelność')
            + th('ai_score',     '🤖 AI-Friendly')
            + '<th>Akcje</th>'
            + '</tr></thead><tbody>';

        $.each(sorted, function (i, p) {
            var spellCell;
            if (p.spell_errors === null || p.spell_errors === undefined) {
                spellCell = '<td style="color:#94a3b8;">—</td>';
            } else {
                var sc = p.spell_errors === 0 ? '#16a34a' : (p.spell_errors > 5 ? '#dc2626' : '#d97706');
                spellCell = '<td style="font-weight:700; color:' + sc + ';">' + p.spell_errors + '</td>';
            }

            html += '<tr>'
                + '<td><a href="' + esc(p.edit_url || '#') + '">' + esc(p.title || '(bez tytułu)') + '</a></td>'
                + '<td style="color:#64748b;">' + esc(p.type) + '</td>'
                + spellCell
                + scoreCell(p.read_score, p.read_grade)
                + scoreCell(p.ai_score, p.ai_grade)
                + '<td style="white-space:nowrap;">'
                + '<a href="' + esc(p.url || '#') + '" target="_blank" rel="noopener" style="font-size:11px; margin-right:6px;">↗ Podgląd</a>'
                + '</td>'
                + '</tr>';
        });

        html += '</tbody></table></div>';
        $('#cqa-ov-table-wrap').html(html);
    }

    $(document).on('click', '.cqa-ov-th', function () {
        var col = $(this).data('col');
        if (ovSortCol === col) {
            ovSortAsc = !ovSortAsc;
        } else {
            ovSortCol = col;
            ovSortAsc = true;
        }
        renderOverviewTable();
    });

    /* ═══════════════════════════════════════════════════════
       BATCH TAB
    ═══════════════════════════════════════════════════════ */

    var batchQueue   = [];
    var batchStopped = false;

    $(document).on('click', '#cqa-batch-load-btn', function () {
        var $btn    = $(this);
        var $status = $('#cqa-batch-load-status');
        var types   = [];

        $('.cqa-batch-type-cb:checked').each(function () {
            types.push($(this).val());
        });

        if (!types.length) {
            $status.text('Zaznacz przynajmniej jeden typ.').css('color', '#dc2626');
            return;
        }

        $btn.prop('disabled', true).text('Ładuję…');
        $status.text('').css('color', '');

        var postData = { action: 'cqa_overview_posts', nonce: admin.nonce };
        $.each(types, function (i, t) { postData['post_types[' + i + ']'] = t; });

        $.post(admin.ajaxUrl, postData, function (res) {
            $btn.prop('disabled', false).text('📋 Załaduj wpisy');
            if (!res.success) {
                $status.text('Błąd: ' + (res.data || 'nieznany')).css('color', '#dc2626');
                return;
            }
            var posts = res.data || [];
            $status.text(posts.length + ' wpisów').css('color', '#64748b');

            batchQueue = posts;

            var listHtml = '';
            $.each(posts, function (i, p) {
                listHtml += '<div class="cqa-batch-post-item">'
                    + '<span class="cqa-batch-num">' + (i + 1) + '.</span>'
                    + '<span class="cqa-batch-title">' + esc(p.title || '(bez tytułu)') + '</span>'
                    + '<span class="cqa-batch-type">(' + esc(p.type) + ')</span>'
                    + '</div>';
            });

            $('#cqa-batch-count').text('Wpisy do analizy: ' + posts.length);
            $('#cqa-batch-post-list').html(listHtml);
            $('#cqa-batch-list-wrap').slideDown(200);
            $('#cqa-batch-run-btn').prop('disabled', posts.length === 0);
            $('#cqa-batch-log').hide().html('');
        }).fail(function () {
            $btn.prop('disabled', false).text('📋 Załaduj wpisy');
            $status.text('Błąd połączenia.').css('color', '#dc2626');
        });
    });

    $(document).on('click', '#cqa-batch-run-btn', function () {
        if (!batchQueue.length) return;
        batchStopped = false;
        $('#cqa-batch-run-btn').hide();
        $('#cqa-batch-stop-btn').show();
        $('#cqa-batch-log').show().html('');
        logBatch('⚡ Uruchomiono analizę ' + batchQueue.length + ' wpisów…', '#6366f1');
        batchRunNext(batchQueue, 0);
    });

    $(document).on('click', '#cqa-batch-stop-btn', function () {
        batchStopped = true;
        logBatch('⏹ Zatrzymano przez użytkownika.', '#dc2626');
        $('#cqa-batch-stop-btn').hide();
        $('#cqa-batch-run-btn').show();
    });

    function logBatch(msg, color) {
        var $log  = $('#cqa-batch-log');
        var time  = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        var $line = $('<div>').html(
            '<span style="color:#64748b; margin-right:8px;">' + esc(time) + '</span>'
            + '<span style="color:' + (color || '#e2e8f0') + ';">' + esc(msg) + '</span>'
        );
        $log.append($line);
        $log.scrollTop($log[0].scrollHeight);
    }

    function batchRunNext(queue, index) {
        if (batchStopped || index >= queue.length) {
            if (!batchStopped) {
                logBatch('✅ Zakończono! Przeanalizowano ' + queue.length + ' wpisów.', '#16a34a');
            }
            $('#cqa-batch-stop-btn').hide();
            $('#cqa-batch-run-btn').show();
            return;
        }

        var post   = queue[index];
        var postId = post.id;
        var title  = post.title || '(bez tytułu)';

        logBatch('[' + (index + 1) + '/' + queue.length + '] Analizuję: ' + title, '#94a3b8');

        var steps = [
            { action: 'cqa_spell_check',  label: 'pisownia' },
            { action: 'cqa_readability',   label: 'czytelność' },
            { action: 'cqa_ai_friendly',   label: 'AI-Friendly' },
        ];

        function runStep(si) {
            if (batchStopped) return;
            if (si >= steps.length) {
                logBatch('  ✓ Gotowe: ' + title, '#16a34a');
                // 3-second delay before next post
                setTimeout(function () {
                    batchRunNext(queue, index + 1);
                }, 3000);
                return;
            }

            var step = steps[si];
            var extra = { post_id: postId, content: '' };
            if (step.action === 'cqa_ai_friendly') extra.post_title = post.title || '';

            $.post(admin.ajaxUrl, $.extend({ action: step.action, nonce: admin.nonce }, extra), function (res) {
                if (batchStopped) return;
                if (res.success) {
                    logBatch('    ✓ ' + step.label + ' OK', '#16a34a');
                } else {
                    logBatch('    ✗ ' + step.label + ': ' + (res.data || 'błąd'), '#dc2626');
                }
                runStep(si + 1);
            }).fail(function () {
                if (batchStopped) return;
                logBatch('    ✗ ' + step.label + ': błąd połączenia', '#dc2626');
                runStep(si + 1);
            });
        }

        runStep(0);
    }

    /* ═══════════════════════════════════════════════════════
       API TEST + MODEL LOADING
    ═══════════════════════════════════════════════════════ */

    $(document).on('click', '#cqa-test-api-btn', function () {
        var $btn    = $(this);
        var $status = $('#cqa-test-status');
        var key     = $('#cqa-api-key-input').val().trim();

        if (!key) { $status.text('Podaj klucz API.').css('color', '#dc2626'); return; }

        $btn.prop('disabled', true).text('Testuję…');
        $status.text('').css('color', '');

        $.post(admin.ajaxUrl, {
            action:  'cqa_test_api',
            nonce:   admin.nonce,
            api_key: key,
        }, function (res) {
            $btn.prop('disabled', false).text('🔌 Testuj połączenie');
            if (!res.success) {
                $status.text('Błąd: ' + (res.data || 'Nieznany błąd')).css('color', '#dc2626');
                return;
            }
            $status.text('Połączono! Modele załadowane.').css('color', '#16a34a');
            populateModels(res.data.models || []);
        }).fail(function () {
            $btn.prop('disabled', false).text('🔌 Testuj połączenie');
            $status.text('Błąd połączenia.').css('color', '#dc2626');
        });
    });

    function populateModels(models) {
        var $sel    = $('#cqa-model-select');
        var current = admin.savedModel || '';
        $sel.empty();
        if (!models.length) {
            $sel.append('<option value="">Brak modeli</option>');
            return;
        }
        $.each(models, function (i, m) {
            $sel.append($('<option>').val(m).text(m).prop('selected', m === current));
        });
    }

    $(function () {
        if (admin.models && admin.models.length) {
            populateModels(admin.models);
        }
    });

    /* ═══════════════════════════════════════════════════════
       POST SEARCH (Analyze tab)
    ═══════════════════════════════════════════════════════ */

    var searchTimer = null;

    $(document).on('keyup', '#cqa-search-input', function () {
        clearTimeout(searchTimer);
        var q = $(this).val().trim();
        searchTimer = setTimeout(function () { doSearch(q); }, 350);
    });

    $(document).on('click', '#cqa-search-btn', function () {
        doSearch($('#cqa-search-input').val().trim());
    });

    function doSearch(q) {
        var $res = $('#cqa-search-results');
        $res.html('<span style="color:#64748b; font-size:13px;">Szukam…</span>');

        $.post(admin.ajaxUrl, {
            action: 'cqa_search_posts',
            nonce:  admin.nonce,
            s:      q,
        }, function (res) {
            if (!res.success || !res.data.length) {
                $res.html('<p style="color:#94a3b8; font-size:13px;">Nie znaleziono wpisów.</p>');
                return;
            }
            var html = '<div style="display:flex; flex-direction:column; gap:6px; max-height:300px; overflow-y:auto;">';
            $.each(res.data, function (i, p) {
                var badges = '';
                if (p.read_score !== null && p.read_score !== undefined) {
                    var rc = p.read_score >= 70 ? '#16a34a' : (p.read_score >= 50 ? '#ca8a04' : '#dc2626');
                    badges += '<span style="background:' + rc + '; color:#fff; padding:1px 6px; border-radius:999px; font-size:10px; font-weight:600;">📊 ' + p.read_score + ' ' + (p.read_grade || '') + '</span> ';
                }
                if (p.ai_score !== null && p.ai_score !== undefined) {
                    var ac = p.ai_score >= 80 ? '#16a34a' : (p.ai_score >= 60 ? '#ca8a04' : '#dc2626');
                    badges += '<span style="background:' + ac + '; color:#fff; padding:1px 6px; border-radius:999px; font-size:10px; font-weight:600;">🤖 ' + p.ai_score + ' ' + (p.ai_grade || '') + '</span>';
                }
                html += '<div class="cqa-search-item" data-id="' + p.id + '" data-title="' + $('<div>').text(p.title).html() + '" data-url="' + $('<div>').text(p.url).html() + '" data-edit="' + $('<div>').text(p.edit_url || '').html() + '">'
                    + '<div style="font-weight:600; font-size:13px; color:#1e293b;">' + $('<div>').text(p.title).html() + '</div>'
                    + '<div style="font-size:11px; color:#94a3b8; margin-top:2px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;">'
                    + '<span>' + $('<div>').text(p.type).html() + '</span>'
                    + (badges ? '&nbsp;' + badges : '')
                    + '</div></div>';
            });
            html += '</div>';
            $res.html(html);
        });
    }

    $(document).on('mouseenter', '.cqa-search-item', function () {
        $(this).css('background', '#f1f5f9');
    }).on('mouseleave', '.cqa-search-item', function () {
        $(this).css('background', '#fff');
    });

    $(document).on('click', '.cqa-search-item', function () {
        selectedPostId = $(this).data('id');
        selectedTitle  = $(this).data('title');
        var url        = $(this).data('url');
        var editUrl    = $(this).data('edit');

        $('#cqa-search-results').empty();
        $('#cqa-search-input').val(selectedTitle);

        var editLink = editUrl
            ? '<a href="' + $('<div>').text(editUrl).html() + '" class="button" style="font-size:11px; height:26px; line-height:24px; padding:0 10px;">✏️ Edytuj</a>'
            : '';

        $('#cqa-post-info').html(
            '<div class="cqa-flex-between">'
            + '<div>'
            + '<div class="cqa-post-meta">' + $('<div>').text(selectedTitle).html() + '</div>'
            + '<div class="cqa-post-url"><a href="' + $('<div>').text(url).html() + '" target="_blank" rel="noopener">' + $('<div>').text(url).html() + ' ↗</a></div>'
            + '</div>'
            + editLink
            + '</div>'
        );
        $('#cqa-post-card').slideDown(200);
        $('#cqa-admin-results').hide();
        clearAdminResults();
    });

    function clearAdminResults() {
        ['spell', 'read', 'ai'].forEach(function (k) {
            $('#cqa-admin-' + k + '-panel').hide();
            $('#cqa-admin-' + k + '-content').empty();
        });
    }

    /* ── Admin analysis buttons ───────────────────────────── */

    function esc(str) {
        return $('<div>').text(String(str || '')).html();
    }

    function gradeColor(score) {
        if (score >= 80) return '#16a34a';
        if (score >= 65) return '#ca8a04';
        if (score >= 45) return '#ea580c';
        return '#dc2626';
    }

    function scoreCircle(score, grade, color) {
        return '<div style="display:inline-flex; align-items:center; gap:12px; margin-bottom:12px;">'
            + '<div style="width:60px; height:60px; border-radius:50%; border:4px solid ' + color + '; '
            + 'display:flex; flex-direction:column; align-items:center; justify-content:center;">'
            + '<span style="font-size:18px; font-weight:800; color:' + color + '; line-height:1;">' + score + '</span>'
            + '<span style="font-size:9px; color:#94a3b8;">/100</span>'
            + '</div>'
            + '<div><span style="font-size:18px; font-weight:700; color:' + color + ';">' + esc(grade) + '</span></div>'
            + '</div>';
    }

    function setAdminProgress(pct, label) {
        var $p = $('#cqa-admin-progress');
        $p.show();
        $('#cqa-admin-fill').css('width', pct + '%');
        $('#cqa-admin-pct').text(Math.round(pct) + '%');
        $('#cqa-admin-label').text(label);
    }

    function ajaxAnalyze(action, extra, success, fail) {
        $.post(admin.ajaxUrl, $.extend({ action: action, nonce: admin.nonce, post_id: selectedPostId, content: '' }, extra),
            function (res) {
                if (res.success) success(res.data);
                else fail(res.data || 'Błąd API');
            }
        ).fail(function () { fail('Błąd połączenia.'); });
    }

    function renderAdminSpell(data) {
        var errors = data.spelling_errors || [];
        var $el    = $('#cqa-admin-spell-content');
        if (!errors.length) {
            $el.html('<p style="color:#16a34a; font-size:13px;">✅ Nie znaleziono błędów pisowni.</p>');
        } else {
            var html = '<div style="font-size:13px; color:#dc2626; margin-bottom:8px;"><strong>' + errors.length + ' błędów</strong></div><ul style="margin:0; padding-left:18px;">';
            $.each(errors, function (i, e) {
                html += '<li style="margin-bottom:5px; font-size:12px;">'
                    + '<strong style="color:#dc2626;">' + esc(e.wrong) + '</strong> → <strong style="color:#16a34a;">' + esc(e.correct) + '</strong>'
                    + ' <span style="color:#94a3b8;">(' + esc(e.type) + ')</span>'
                    + (e.context ? '<br><span style="color:#64748b;">…' + esc(e.context) + '…</span>' : '')
                    + '</li>';
            });
            html += '</ul>';
            $el.html(html);
        }
        $('#cqa-admin-spell-panel').show();
        $('#cqa-admin-results').show();
    }

    function renderAdminRead(data) {
        var score = data.score || 0;
        var grade = data.grade || '?';
        var color = gradeColor(score);
        var html  = scoreCircle(score, grade, color);
        html += '<div style="font-size:13px; color:#1e293b; font-weight:600; margin-bottom:4px;">' + esc(data.reading_level || '') + '</div>';
        html += '<div style="font-size:12px; color:#64748b; margin-bottom:10px;">' + esc(data.reading_level_description || '') + '</div>';
        html += '<div style="font-size:12px; color:#475569; margin-bottom:10px;">⏱ ~' + esc(data.reading_time_minutes || '?') + ' min | ' + esc(data.word_count || '?') + ' słów</div>';
        if (data.top_improvements && data.top_improvements.length) {
            html += '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Priorytety poprawy</div><ol style="margin:0; padding-left:18px; font-size:12px;">';
            $.each(data.top_improvements, function (i, t) { html += '<li>' + esc(t) + '</li>'; });
            html += '</ol>';
        }
        $('#cqa-admin-read-content').html(html);
        $('#cqa-admin-read-panel').show();
        $('#cqa-admin-results').show();
    }

    function renderAdminAi(data) {
        var score = data.score || 0;
        var grade = data.grade || '?';
        var color = gradeColor(score);
        var html  = scoreCircle(score, grade, color);
        if (data.summary) {
            html += '<p style="font-size:12px; color:#475569; margin:0 0 10px;">' + esc(data.summary) + '</p>';
        }
        if (data.top_improvements && data.top_improvements.length) {
            html += '<div style="font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom:4px;">Priorytety poprawy</div><ol style="margin:0; padding-left:18px; font-size:12px;">';
            $.each(data.top_improvements, function (i, t) { html += '<li>' + esc(t) + '</li>'; });
            html += '</ol>';
        }
        var pass = 0, warn = 0, fail = 0;
        $.each(data.criteria || [], function (i, c) {
            if (c.status === 'pass') pass++;
            else if (c.status === 'warn') warn++;
            else fail++;
        });
        html += '<div style="display:flex; gap:10px; margin-top:10px; font-size:12px;">'
            + '<span style="color:#16a34a;">✅ ' + pass + ' pass</span>'
            + '<span style="color:#d97706;">⚠️ ' + warn + ' warn</span>'
            + '<span style="color:#dc2626;">❌ ' + fail + ' fail</span>'
            + '</div>';
        $('#cqa-admin-ai-content').html(html);
        $('#cqa-admin-ai-panel').show();
        $('#cqa-admin-results').show();
    }

    function disableAdminBtns(disabled) {
        $('#cqa-admin-btn-all, #cqa-admin-btn-spell, #cqa-admin-btn-readability, #cqa-admin-btn-ai').prop('disabled', disabled);
    }

    $(document).on('click', '#cqa-admin-btn-spell', function () {
        if (!selectedPostId) return;
        disableAdminBtns(true);
        setAdminProgress(50, 'Sprawdzam pisownię…');
        ajaxAnalyze('cqa_spell_check', {},
            function (d) { setAdminProgress(100, 'Gotowe!'); renderAdminSpell(d); disableAdminBtns(false); setTimeout(function () { $('#cqa-admin-progress').hide(); }, 1200); },
            function (e) { setAdminProgress(0, 'Błąd: ' + e); disableAdminBtns(false); }
        );
    });

    $(document).on('click', '#cqa-admin-btn-readability', function () {
        if (!selectedPostId) return;
        disableAdminBtns(true);
        setAdminProgress(50, 'Analizuję czytelność…');
        ajaxAnalyze('cqa_readability', {},
            function (d) { setAdminProgress(100, 'Gotowe!'); renderAdminRead(d); disableAdminBtns(false); setTimeout(function () { $('#cqa-admin-progress').hide(); }, 1200); },
            function (e) { setAdminProgress(0, 'Błąd: ' + e); disableAdminBtns(false); }
        );
    });

    $(document).on('click', '#cqa-admin-btn-ai', function () {
        if (!selectedPostId) return;
        disableAdminBtns(true);
        setAdminProgress(50, 'Weryfikuję AI-Friendly…');
        ajaxAnalyze('cqa_ai_friendly', { post_title: selectedTitle },
            function (d) { setAdminProgress(100, 'Gotowe!'); renderAdminAi(d); disableAdminBtns(false); setTimeout(function () { $('#cqa-admin-progress').hide(); }, 1200); },
            function (e) { setAdminProgress(0, 'Błąd: ' + e); disableAdminBtns(false); }
        );
    });

    $(document).on('click', '#cqa-admin-btn-all', function () {
        if (!selectedPostId) return;
        disableAdminBtns(true);
        clearAdminResults();

        var steps = [
            { action: 'cqa_spell_check',  pct: 33, label: 'Sprawdzam pisownię…',     render: renderAdminSpell, extra: {} },
            { action: 'cqa_readability',   pct: 66, label: 'Analizuję czytelność…',   render: renderAdminRead,  extra: {} },
            { action: 'cqa_ai_friendly',   pct: 99, label: 'Weryfikuję AI-Friendly…', render: renderAdminAi,    extra: { post_title: selectedTitle } },
        ];

        setAdminProgress(0, 'Przygotowuję…');

        function runStep(i) {
            if (i >= steps.length) {
                setAdminProgress(100, 'Gotowe!');
                disableAdminBtns(false);
                setTimeout(function () { $('#cqa-admin-progress').hide(); }, 1500);
                return;
            }
            var s = steps[i];
            setAdminProgress(s.pct - 33, s.label);
            ajaxAnalyze(s.action, s.extra,
                function (d) { setAdminProgress(s.pct, s.label); s.render(d); runStep(i + 1); },
                function () { runStep(i + 1); }
            );
        }
        runStep(0);
    });

    /* ── Reset cost ───────────────────────────────────────── */

    $(document).on('click', '#cqa-reset-cost-btn', function () {
        if (!confirm('Zresetować licznik kosztów?')) return;
        var $btn = $(this);
        $btn.prop('disabled', true);
        $.post(admin.ajaxUrl, { action: 'cqa_reset_cost', nonce: admin.nonce }, function () {
            $btn.prop('disabled', false);
            location.reload();
        });
    });

}(jQuery));
