/* global wp */
(function () {
    'use strict';

    if (typeof wp === 'undefined' || !wp.plugins || !wp.editPost || !wp.element) {
        return;
    }

    var el             = wp.element.createElement;
    var useState       = wp.element.useState;
    var useEffect      = wp.element.useEffect;
    var registerPlugin = wp.plugins.registerPlugin;
    var PluginSidebar  = wp.editPost.PluginSidebar;
    var panel          = window.cqaPanel || {};
    var i18n           = panel.i18n || {};

    /* ── AJAX helper ──────────────────────────────────────── */

    function ajaxPost(action, extra, success, fail) {
        var data = Object.assign({ action: action, nonce: panel.nonce, post_id: panel.postId || 0 }, extra);
        var body = new URLSearchParams();
        Object.keys(data).forEach(function (k) { body.append(k, data[k]); });

        fetch(panel.ajaxUrl, { method: 'POST', body: body, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) success(res.data);
                else fail(res.data || (i18n.unknownError || 'Unknown error'));
            })
            .catch(function () { fail(i18n.connectionError || 'Connection error.'); });
    }

    function gradeColor(score) {
        if (score >= 80) return '#16a34a';
        if (score >= 65) return '#ca8a04';
        if (score >= 45) return '#ea580c';
        return '#dc2626';
    }

    function getContent() {
        try { return wp.data.select('core/editor').getEditedPostContent() || ''; } catch (e) { return ''; }
    }

    function getTitle() {
        try { return wp.data.select('core/editor').getEditedPostAttribute('title') || ''; } catch (e) { return ''; }
    }

    /* ── CqaSidebar functional component ─────────────────── */

    function CqaSidebar() {
        var _state = useState({
            loading:         false,
            loadingType:     '',
            readScore:       null,
            readGrade:       null,
            aiScore:         null,
            aiGrade:         null,
            spellErrors:     null,
            topImprovements: [],
            error:           '',
        });
        var state    = _state[0];
        var setState = _state[1];

        useEffect(function () {
            if (panel.cachedRead) {
                setState(function (s) { return Object.assign({}, s, {
                    readScore:       panel.cachedRead.score             || null,
                    readGrade:       panel.cachedRead.grade             || null,
                    topImprovements: panel.cachedRead.top_improvements  || [],
                }); });
            }
            if (panel.cachedAi) {
                setState(function (s) { return Object.assign({}, s, {
                    aiScore: panel.cachedAi.score || null,
                    aiGrade: panel.cachedAi.grade || null,
                }); });
            }
            if (panel.cachedSpell) {
                setState(function (s) { return Object.assign({}, s, {
                    spellErrors: (panel.cachedSpell.spelling_errors || []).length,
                }); });
            }
        }, []);

        function runSpell() {
            setState(function (s) { return Object.assign({}, s, { loading: true, loadingType: 'spell', error: '' }); });
            ajaxPost('cqa_spell_check', { content: getContent() },
                function (data) {
                    setState(function (s) { return Object.assign({}, s, { loading: false, spellErrors: (data.spelling_errors || []).length }); });
                },
                function (err) { setState(function (s) { return Object.assign({}, s, { loading: false, error: err }); }); }
            );
        }

        function runReadability() {
            setState(function (s) { return Object.assign({}, s, { loading: true, loadingType: 'read', error: '' }); });
            ajaxPost('cqa_readability', { content: getContent() },
                function (data) {
                    setState(function (s) { return Object.assign({}, s, {
                        loading:         false,
                        readScore:       data.score || null,
                        readGrade:       data.grade || null,
                        topImprovements: data.top_improvements || [],
                    }); });
                },
                function (err) { setState(function (s) { return Object.assign({}, s, { loading: false, error: err }); }); }
            );
        }

        function runAI() {
            setState(function (s) { return Object.assign({}, s, { loading: true, loadingType: 'ai', error: '' }); });
            ajaxPost('cqa_ai_friendly', { content: getContent(), post_title: getTitle() },
                function (data) {
                    setState(function (s) { return Object.assign({}, s, {
                        loading:  false,
                        aiScore:  data.score || null,
                        aiGrade:  data.grade || null,
                    }); });
                },
                function (err) { setState(function (s) { return Object.assign({}, s, { loading: false, error: err }); }); }
            );
        }

        function runAll() {
            var content = getContent();
            var title   = getTitle();
            setState(function (s) { return Object.assign({}, s, { loading: true, loadingType: 'all', error: '' }); });

            ajaxPost('cqa_spell_check', { content: content },
                function (d1) {
                    setState(function (s) { return Object.assign({}, s, { spellErrors: (d1.spelling_errors || []).length }); });
                    ajaxPost('cqa_readability', { content: content },
                        function (d2) {
                            setState(function (s) { return Object.assign({}, s, { readScore: d2.score, readGrade: d2.grade, topImprovements: d2.top_improvements || [] }); });
                            ajaxPost('cqa_ai_friendly', { content: content, post_title: title },
                                function (d3) {
                                    setState(function (s) { return Object.assign({}, s, { loading: false, aiScore: d3.score, aiGrade: d3.grade }); });
                                },
                                function (err) { setState(function (s) { return Object.assign({}, s, { loading: false, error: err }); }); }
                            );
                        },
                        function (err) { setState(function (s) { return Object.assign({}, s, { loading: false, error: err }); }); }
                    );
                },
                function (err) { setState(function (s) { return Object.assign({}, s, { loading: false, error: err }); }); }
            );
        }

        /* ── render helpers ── */

        function scoreBox(label, score, grade) {
            if (score === null || score === undefined) {
                return el('div', {
                    style: { marginBottom: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#94a3b8' },
                }, label + ': —');
            }
            var color = gradeColor(score);
            return el('div', {
                style: { marginBottom: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
            },
                el('span', { style: { fontSize: '12px', color: '#475569', fontWeight: '600' } }, label),
                el('span', { style: { fontSize: '16px', fontWeight: '800', color: color } }, score + '/100 ' + (grade || ''))
            );
        }

        var spellLabel = i18n.sidebarSpelling || 'Spelling';
        var spellBox = state.spellErrors !== null && state.spellErrors !== undefined
            ? el('div', {
                style: { marginBottom: '8px', padding: '8px 12px', background: state.spellErrors === 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
            },
                el('span', { style: { fontSize: '12px', color: '#475569', fontWeight: '600' } }, spellLabel),
                el('span', { style: { fontSize: '14px', fontWeight: '700', color: state.spellErrors === 0 ? '#16a34a' : '#dc2626' } },
                    state.spellErrors === 0 ? (i18n.sidebarNoErrors || '✓ No errors') : state.spellErrors + ' ' + (i18n.errorsLabel || 'errors')
                )
            )
            : el('div', {
                style: { marginBottom: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#94a3b8' },
            }, spellLabel + ': —');

        var btnBase = {
            padding: '7px 10px', border: '1px solid #d0d5dd', borderRadius: '6px',
            background: '#fff', cursor: state.loading ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: '600', opacity: state.loading ? '0.6' : '1',
        };
        var btnPrimary = Object.assign({}, btnBase, {
            display: 'block', width: '100%', marginBottom: '6px',
            background: '#4f46e5', color: '#fff', border: 'none',
            padding: '9px 12px', fontSize: '13px',
        });

        return el(PluginSidebar, {
            name:  'cqa-sidebar',
            title: i18n.sidebarTitle || 'Content Analyzer',
            icon:  'editor-spell',
        },
            el('div', { style: { padding: '12px 16px', fontFamily: 'system-ui,-apple-system,sans-serif' } },

                spellBox,
                scoreBox(i18n.histRead || 'Readability', state.readScore, state.readGrade),
                scoreBox('AI-Friendly', state.aiScore, state.aiGrade),

                state.topImprovements.length > 0 && el('div', {
                    style: { marginBottom: '12px', padding: '8px 12px', background: '#fffbeb', borderRadius: '6px' },
                },
                    el('div', { style: { fontSize: '10px', fontWeight: '700', color: '#92400e', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' } }, i18n.sidebarImprov || 'Improvement priorities'),
                    state.topImprovements.map(function (t, idx) {
                        return el('div', { key: idx, style: { fontSize: '11px', color: '#78350f', marginBottom: '2px' } }, (idx + 1) + '. ' + t);
                    })
                ),

                state.error && el('div', {
                    style: { marginBottom: '8px', padding: '6px 10px', background: '#fef2f2', borderRadius: '4px', fontSize: '11px', color: '#dc2626' },
                }, state.error),

                el('button', {
                    style:    btnPrimary,
                    onClick:  state.loading ? null : runAll,
                    disabled: state.loading,
                }, state.loading && state.loadingType === 'all' ? '⏳ ' + (i18n.analyzing || 'Analyzing…') : '✨ ' + (i18n.analyzeAll || 'Analyze all')),

                el('div', { style: { display: 'flex', gap: '4px', marginBottom: '8px' } },
                    el('button', {
                        style:    Object.assign({}, btnBase, { flex: '1', textAlign: 'center' }),
                        onClick:  state.loading ? null : runSpell,
                        disabled: state.loading,
                        title:    i18n.checkSpell || 'Check spelling',
                    }, state.loading && state.loadingType === 'spell' ? '…' : '🔤'),
                    el('button', {
                        style:    Object.assign({}, btnBase, { flex: '1', textAlign: 'center' }),
                        onClick:  state.loading ? null : runReadability,
                        disabled: state.loading,
                        title:    i18n.analyzeRead || 'Analyze readability',
                    }, state.loading && state.loadingType === 'read' ? '…' : '📊'),
                    el('button', {
                        style:    Object.assign({}, btnBase, { flex: '1', textAlign: 'center' }),
                        onClick:  state.loading ? null : runAI,
                        disabled: state.loading,
                        title:    i18n.checkAI || 'Check AI-Friendly',
                    }, state.loading && state.loadingType === 'ai' ? '…' : '🤖')
                ),

                panel.settingsUrl && el('div', { style: { textAlign: 'center' } },
                    el('a', { href: panel.settingsUrl, style: { fontSize: '11px', color: '#94a3b8', textDecoration: 'none' } }, i18n.sidebarSettings || 'Settings →')
                )
            )
        );
    }

    registerPlugin('cqa-sidebar', { render: CqaSidebar });

}());
