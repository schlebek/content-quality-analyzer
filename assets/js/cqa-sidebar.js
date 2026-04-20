/* global wp */
(function () {
    'use strict';

    if (typeof wp === 'undefined' || !wp.plugins || !wp.editPost || !wp.element) {
        return;
    }

    var el             = wp.element.createElement;
    var Component      = wp.element.Component;
    var registerPlugin = wp.plugins.registerPlugin;
    var PluginSidebar  = wp.editPost.PluginSidebar;
    var panel          = window.cqaPanel || {};

    /* ── AJAX helper (fetch-based, no jQuery dependency) ─── */

    function ajaxPost(action, extra, success, fail) {
        var data = Object.assign({ action: action, nonce: panel.nonce, post_id: panel.postId || 0 }, extra);
        var body = new URLSearchParams();
        Object.keys(data).forEach(function (k) { body.append(k, data[k]); });

        fetch(panel.ajaxUrl, { method: 'POST', body: body, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) success(res.data);
                else fail(res.data || 'Błąd');
            })
            .catch(function () { fail('Błąd połączenia.'); });
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

    /* ── CqaSidebar component ─────────────────────────────── */

    function CqaSidebar(props) {
        Component.call(this, props);
        this.state = {
            loading:         false,
            loadingType:     '',
            readScore:       null,
            readGrade:       null,
            aiScore:         null,
            aiGrade:         null,
            spellErrors:     null,
            topImprovements: [],
            error:           '',
        };
        this.runAll          = this.runAll.bind(this);
        this.runSpell        = this.runSpell.bind(this);
        this.runReadability  = this.runReadability.bind(this);
        this.runAI           = this.runAI.bind(this);
    }

    CqaSidebar.prototype = Object.create(Component.prototype);
    CqaSidebar.prototype.constructor = CqaSidebar;

    CqaSidebar.prototype.componentDidMount = function () {
        if (panel.cachedRead) {
            this.setState({
                readScore:       panel.cachedRead.score       || null,
                readGrade:       panel.cachedRead.grade       || null,
                topImprovements: panel.cachedRead.top_improvements || [],
            });
        }
        if (panel.cachedAi) {
            this.setState({
                aiScore: panel.cachedAi.score || null,
                aiGrade: panel.cachedAi.grade || null,
            });
        }
        if (panel.cachedSpell) {
            this.setState({
                spellErrors: (panel.cachedSpell.spelling_errors || []).length,
            });
        }
    };

    CqaSidebar.prototype.runSpell = function () {
        var self = this;
        self.setState({ loading: true, loadingType: 'spell', error: '' });
        ajaxPost('cqa_spell_check', { content: getContent() },
            function (data) {
                self.setState({ loading: false, spellErrors: (data.spelling_errors || []).length });
            },
            function (err) { self.setState({ loading: false, error: err }); }
        );
    };

    CqaSidebar.prototype.runReadability = function () {
        var self = this;
        self.setState({ loading: true, loadingType: 'read', error: '' });
        ajaxPost('cqa_readability', { content: getContent() },
            function (data) {
                self.setState({
                    loading:         false,
                    readScore:       data.score || null,
                    readGrade:       data.grade || null,
                    topImprovements: data.top_improvements || [],
                });
            },
            function (err) { self.setState({ loading: false, error: err }); }
        );
    };

    CqaSidebar.prototype.runAI = function () {
        var self = this;
        self.setState({ loading: true, loadingType: 'ai', error: '' });
        ajaxPost('cqa_ai_friendly', { content: getContent(), post_title: getTitle() },
            function (data) {
                self.setState({
                    loading:  false,
                    aiScore:  data.score || null,
                    aiGrade:  data.grade || null,
                });
            },
            function (err) { self.setState({ loading: false, error: err }); }
        );
    };

    CqaSidebar.prototype.runAll = function () {
        var self = this;
        var content = getContent();
        var title   = getTitle();
        self.setState({ loading: true, loadingType: 'all', error: '' });

        ajaxPost('cqa_spell_check', { content: content },
            function (d1) {
                self.setState({ spellErrors: (d1.spelling_errors || []).length });
                ajaxPost('cqa_readability', { content: content },
                    function (d2) {
                        self.setState({ readScore: d2.score, readGrade: d2.grade, topImprovements: d2.top_improvements || [] });
                        ajaxPost('cqa_ai_friendly', { content: content, post_title: title },
                            function (d3) {
                                self.setState({ loading: false, aiScore: d3.score, aiGrade: d3.grade });
                            },
                            function (err) { self.setState({ loading: false, error: err }); }
                        );
                    },
                    function (err) { self.setState({ loading: false, error: err }); }
                );
            },
            function (err) { self.setState({ loading: false, error: err }); }
        );
    };

    CqaSidebar.prototype.render = function () {
        var s    = this.state;
        var self = this;

        /* ── helpers ── */
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

        var spellBox = s.spellErrors !== null && s.spellErrors !== undefined
            ? el('div', {
                style: { marginBottom: '8px', padding: '8px 12px', background: s.spellErrors === 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
            },
                el('span', { style: { fontSize: '12px', color: '#475569', fontWeight: '600' } }, 'Pisownia'),
                el('span', { style: { fontSize: '14px', fontWeight: '700', color: s.spellErrors === 0 ? '#16a34a' : '#dc2626' } },
                    s.spellErrors === 0 ? '✓ Brak błędów' : s.spellErrors + ' błędów'
                )
            )
            : el('div', {
                style: { marginBottom: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px', color: '#94a3b8' },
            }, 'Pisownia: —');

        var btnBase = {
            padding: '7px 10px', border: '1px solid #d0d5dd', borderRadius: '6px',
            background: '#fff', cursor: s.loading ? 'not-allowed' : 'pointer',
            fontSize: '12px', fontWeight: '600', opacity: s.loading ? '0.6' : '1',
        };
        var btnPrimary = Object.assign({}, btnBase, {
            display: 'block', width: '100%', marginBottom: '6px',
            background: '#4f46e5', color: '#fff', border: 'none',
            padding: '9px 12px', fontSize: '13px',
        });

        return el(PluginSidebar, {
            name:  'cqa-sidebar',
            title: '✍️ Analizator Treści',
            icon:  'editor-spell',
        },
            el('div', { style: { padding: '12px 16px', fontFamily: 'system-ui,-apple-system,sans-serif' } },

                spellBox,
                scoreBox('Czytelność', s.readScore, s.readGrade),
                scoreBox('AI-Friendly', s.aiScore, s.aiGrade),

                s.topImprovements.length > 0 && el('div', {
                    style: { marginBottom: '12px', padding: '8px 12px', background: '#fffbeb', borderRadius: '6px' },
                },
                    el('div', { style: { fontSize: '10px', fontWeight: '700', color: '#92400e', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' } }, 'Priorytety poprawy'),
                    s.topImprovements.map(function (t, i) {
                        return el('div', { key: i, style: { fontSize: '11px', color: '#78350f', marginBottom: '2px' } }, (i + 1) + '. ' + t);
                    })
                ),

                s.error && el('div', {
                    style: { marginBottom: '8px', padding: '6px 10px', background: '#fef2f2', borderRadius: '4px', fontSize: '11px', color: '#dc2626' },
                }, s.error),

                el('button', {
                    style:    btnPrimary,
                    onClick:  s.loading ? null : self.runAll,
                    disabled: s.loading,
                }, s.loading && s.loadingType === 'all' ? '⏳ Analizuję…' : '✨ Analizuj wszystko'),

                el('div', { style: { display: 'flex', gap: '4px', marginBottom: '8px' } },
                    el('button', {
                        style:    Object.assign({}, btnBase, { flex: '1', textAlign: 'center' }),
                        onClick:  s.loading ? null : self.runSpell,
                        disabled: s.loading,
                        title:    'Sprawdź pisownię',
                    }, s.loading && s.loadingType === 'spell' ? '…' : '🔤'),
                    el('button', {
                        style:    Object.assign({}, btnBase, { flex: '1', textAlign: 'center' }),
                        onClick:  s.loading ? null : self.runReadability,
                        disabled: s.loading,
                        title:    'Analizuj czytelność',
                    }, s.loading && s.loadingType === 'read' ? '…' : '📊'),
                    el('button', {
                        style:    Object.assign({}, btnBase, { flex: '1', textAlign: 'center' }),
                        onClick:  s.loading ? null : self.runAI,
                        disabled: s.loading,
                        title:    'Sprawdź AI-Friendly',
                    }, s.loading && s.loadingType === 'ai' ? '…' : '🤖')
                ),

                panel.settingsUrl && el('div', { style: { textAlign: 'center' } },
                    el('a', { href: panel.settingsUrl, style: { fontSize: '11px', color: '#94a3b8', textDecoration: 'none' } }, '⚙️ Ustawienia →')
                )
            )
        );
    };

    registerPlugin('cqa-sidebar', {
        render: function () { return el(CqaSidebar, null); },
    });

}());
