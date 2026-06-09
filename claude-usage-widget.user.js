// ==UserScript==
// @name         Claude Usage Widget
// @namespace    https://github.com/n6ufal/claude-usage-widget
// @version      3.0
// @description  Floating Claude usage monitor with Gruvbox theme - shows usage % and reset timer in minimized mode
// @author       Alif Naufal (n6ufal)
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @license      GPL-3.0
// ==/UserScript==
/*
 * Fetch engine, poll logic, and SPA navigation hooks adapted from
 * "Claude Inline Usage Tracker" by Niko
 * https://update.greasyfork.org/scripts/567949
 * Licensed under GNU General Public License v3.0
 *
 * This script is also licensed under GPL-3.0.
 * Full license: https://www.gnu.org/licenses/gpl-3.0.html
 */

(function () {
    'use strict';

    if (document.getElementById('cuw')) return;

    // ─── Config ────────────────────────────────────────────────────────────────
    const CONFIG = {
        POLL_MS: 60_000,
        HOVER_REFRESH_MS: 30_000,
        MIN_GAP_MS: 15_000,
        FETCH_TIMEOUT_MS: 10_000,
        WIDGET_WIDTH_PX: 130,
    };

    // ─── State ─────────────────────────────────────────────────────────────────
    let isCollapsed = true;

    const S = {
        org: null,
        flight: null,
        last: null,
        lastAt: 0,
        poll: 0,
    };

    const dom = {};
    const listeners = {};

    // ─── Fetch engine (Niko) ───────────────────────────────────────────────────

    function jget(url) {
        return fetch(url, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(CONFIG.FETCH_TIMEOUT_MS),
        }).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        });
    }

    async function orgId() {
        if (S.org) return S.org;
        const orgs = await jget('/api/organizations');
        S.org = orgs?.[0]?.uuid ?? null;
        if (!S.org) throw new Error('no org UUID');
        return S.org;
    }

    function fetchUsage(force) {
        const now = Date.now();
        if (!force && now - S.lastAt < CONFIG.MIN_GAP_MS) return Promise.resolve(S.last);
        if (S.flight) return S.flight;

        S.flight = (async () => {
            try {
                const id = await orgId();
                const d = await jget(`/api/organizations/${id}/usage`);
                if (d) { S.last = d; S.lastAt = Date.now(); }
                return S.last;
            } catch (e) {
                console.warn('[CUW]', e.message);
                S.org = null;
                return S.last;
            } finally {
                S.flight = null;
            }
        })();

        return S.flight;
    }

    // ─── Poll (Niko's self-healing tick) ──────────────────────────────────────

    function stopPoll() {
        if (S.poll) { clearTimeout(S.poll); S.poll = 0; }
    }

    function startPoll() {
        stopPoll();
        const tick = () => {
            if (document.hidden) { S.poll = 0; return; }
            refresh(false);
            S.poll = setTimeout(tick, CONFIG.POLL_MS);
        };
        S.poll = setTimeout(tick, CONFIG.POLL_MS);
    }

    async function refresh(force) {
        if (!force && document.hidden) return;
        const d = await fetchUsage(force);
        if (d) renderData(d);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function parseISO(iso) {
        if (!iso) return null;
        const ms = new Date(iso).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function clampPct(n) {
        return Math.min(100, Math.max(0, Math.round(+n || 0)));
    }

    function formatTimeRemaining(iso, mode) {
        const targetMs = parseISO(iso);
        if (targetMs === null) return mode === 'short' ? null : '';

        const diff = targetMs - Date.now();
        if (diff <= 0) return mode === 'short' ? '0m' : 'Resetting…';

        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        const s = Math.floor((diff % 60_000) / 1_000);

        if (mode === 'short') {
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        }
        if (h >= 24) return `Reset in ${Math.floor(h / 24)}d ${h % 24}h`;
        if (h > 0) return `Reset in ${h}h ${m}m`;
        return `Reset in ${m}m`;
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    let countdownTimer = null;

    function updateHeaderDisplay() {
        if (!dom.headerDisplay) return;
        const d5h = S.last?.five_hour;
        let text;

        if (!isCollapsed) {
            text = d5h ? `${clampPct(d5h.utilization)}%` : '—';
        } else {
            const pct = d5h ? `${clampPct(d5h.utilization)}%` : null;
            const time = d5h ? formatTimeRemaining(d5h.resets_at, 'short') : null;
            text = pct && time ? `${pct} · ${time}`
                : pct ? pct
                    : time ? time
                        : '—';
        }

        if (dom.headerDisplay.textContent !== text) dom.headerDisplay.textContent = text;
    }

    function manageCountdownTimer() {
        clearInterval(countdownTimer);
        countdownTimer = null;
        updateHeaderDisplay();
        if (!isCollapsed) return;

        const target = parseISO(S.last?.five_hour?.resets_at);
        if (!target || target <= Date.now()) return;

        countdownTimer = setInterval(() => {
            updateHeaderDisplay();
            const t = parseISO(S.last?.five_hour?.resets_at);
            if (!t || t <= Date.now()) { clearInterval(countdownTimer); countdownTimer = null; }
        }, 1_000);
    }

    function updateBar(valId, barId, resetId, pct, resetsAt) {
        const valEl = dom[valId];
        const barEl = dom[barId];
        const resetEl = dom[resetId];
        if (!valEl || !barEl || !resetEl) return;

        const pStr = pct + '%';
        if (valEl.textContent !== pStr) valEl.textContent = pStr;
        const sx = 'scaleX(' + (pct / 100) + ')';
        if (barEl.style.transform !== sx) barEl.style.transform = sx;

        const rStr = formatTimeRemaining(resetsAt, 'long');
        if (resetEl.textContent !== rStr) resetEl.textContent = rStr;
    }

    function renderData(d) {
        const rows = [
            ['five_hour', 'cuw-5h-val', 'cuw-5h-bar', 'cuw-5h-reset'],
            ['seven_day', 'cuw-7d-val', 'cuw-7d-bar', 'cuw-7d-reset'],
        ];
        for (const [key, valId, barId, resetId] of rows) {
            const b = d?.[key];
            if (!b) continue;
            updateBar(valId, barId, resetId, clampPct(b.utilization), b.resets_at ?? null);
        }
        manageCountdownTimer();
    }

    // ─── Collapse ──────────────────────────────────────────────────────────────

    function applyCollapseState() {
        if (!dom.body || !dom.header || !dom.toggle) return;
        dom.body.classList.toggle('hidden', isCollapsed);
        dom.header.classList.toggle('collapsed', isCollapsed);
        dom.toggle.textContent = isCollapsed ? '▸' : '▾';
        dom.toggle.setAttribute('aria-expanded', String(!isCollapsed));
        manageCountdownTimer();
    }

    function toggleExpand() {
        isCollapsed = !isCollapsed;
        applyCollapseState();
    }

    // ─── Drag ──────────────────────────────────────────────────────────────────

    function makeDraggable(widget) {
        let dragging = false, ox = 0, oy = 0;

        dom.header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'cuw-toggle') return;
            dragging = true;
            const r = widget.getBoundingClientRect();
            widget.style.left = r.left + 'px';
            widget.style.transform = 'none';
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
            widget.style.cursor = 'grabbing';
        });

        listeners.mouseMove = (e) => {
            if (!dragging) return;
            widget.style.top = (e.clientY - oy) + 'px';
            widget.style.bottom = 'auto';
            widget.style.left = (e.clientX - ox) + 'px';
            widget.style.right = 'auto';
        };
        listeners.mouseUp = () => {
            if (dragging) { dragging = false; widget.style.cursor = ''; }
        };

        document.addEventListener('mousemove', listeners.mouseMove);
        document.addEventListener('mouseup', listeners.mouseUp);
    }

    // ─── SPA navigation hooks (Niko) ──────────────────────────────────────────

    function patchHistory() {
        ['pushState', 'replaceState'].forEach(method => {
            const orig = history[method];
            history[method] = function () {
                const r = orig.apply(this, arguments);
                refresh(false);
                return r;
            };
        });
        window.addEventListener('popstate', () => refresh(false), { passive: true });
        window.addEventListener('hashchange', () => refresh(false), { passive: true });
    }

    // ─── Widget HTML + CSS ─────────────────────────────────────────────────────

    function buildWidget() {
        const widget = document.createElement('div');
        widget.id = 'cuw';
        widget.setAttribute('role', 'region');
        widget.setAttribute('aria-label', 'Claude usage monitor');

        widget.innerHTML = `
            <div id="cuw-header">
                <span id="cuw-title">Usage <span id="cuw-header-display" aria-live="polite">—</span></span>
                <button id="cuw-toggle"
                        aria-label="Toggle usage details"
                        aria-expanded="false"
                        title="Expand">▸</button>
            </div>
            <div id="cuw-body" aria-live="polite">
                <div class="cuw-row">
                    <span class="cuw-label">5 hours</span>
                    <span class="cuw-value" id="cuw-5h-val">—</span>
                </div>
                <div class="cuw-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                    <div class="cuw-fill" id="cuw-5h-bar"></div>
                </div>
                <div class="cuw-reset" id="cuw-5h-reset"></div>
                <div class="cuw-row" style="margin-top:6px">
                    <span class="cuw-label">7 days</span>
                    <span class="cuw-value" id="cuw-7d-val">—</span>
                </div>
                <div class="cuw-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                    <div class="cuw-fill" id="cuw-7d-bar"></div>
                </div>
                <div class="cuw-reset" id="cuw-7d-reset"></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #cuw {
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                contain: layout style paint;
                background: #1d2021;
                color: #ebdbb2;
                border: 1px solid #928374;
                border-radius: 10px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                font-size: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,.5);
                user-select: none;
                opacity: .95;
                transition: opacity .2s;
            }
            #cuw:hover { opacity: 1; }

            #cuw-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                background: #1d2021;
                border-radius: 10px 10px 0 0;
                border-bottom: 1px solid #928374;
                cursor: move;
            }
            #cuw-header.collapsed {
                border-radius: 10px;
                border-bottom: none;
            }
            #cuw-title {
                font-weight: 600;
                font-size: 11px;
                color: #a89984;
            }
            #cuw-header-display {
                font-weight: 700;
                font-size: 11px;
                margin-left: 4px;
                font-family: 'JetBrains Mono', 'SF Mono', monospace;
                color: #a89984;
            }
            #cuw-toggle {
                all: unset;
                cursor: pointer;
                font-size: 14px;
                line-height: 1;
                color: #a89984;
                padding: 0 2px;
            }
            #cuw-toggle:hover,
            #cuw-toggle:focus-visible { color: #ebdbb2; outline: none; }

            #cuw-body {
                padding: 6px 8px 8px;
                width: ${CONFIG.WIDGET_WIDTH_PX}px;
                overflow: hidden;
            }
            #cuw-body.hidden { display: none; }

            .cuw-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 3px;
            }
            .cuw-label {
                font-size: 10px;
                color: #a89984;
                text-transform: uppercase;
                letter-spacing: .5px;
            }
            .cuw-value {
                font-size: 13px;
                font-weight: 700;
                color: #a89984;
            }
            .cuw-bar {
                width: 100%;
                height: 6px;
                background: #3c3836;
                border-radius: 3px;
                overflow: hidden;
            }
            .cuw-fill {
                height: 100%;
                width: 100%;
                background: #a89984;
                border-radius: 3px;
                transform: scaleX(0);
                transform-origin: left;
                transition: transform .5s ease;
            }
            .cuw-reset {
                font-size: 9px;
                color: #a89984;
                text-align: right;
                margin-top: 2px;
                min-height: 12px;
            }
        `;

        return { widget, style };
    }

    // ─── Teardown ──────────────────────────────────────────────────────────────

    function destroy() {
        stopPoll();
        clearInterval(countdownTimer);
        countdownTimer = null;
        if (listeners.mouseMove) document.removeEventListener('mousemove', listeners.mouseMove);
        if (listeners.mouseUp) document.removeEventListener('mouseup', listeners.mouseUp);
        if (listeners.visChange) document.removeEventListener('visibilitychange', listeners.visChange);
    }

    // ─── Init ──────────────────────────────────────────────────────────────────

    function init() {
        const { widget, style } = buildWidget();
        document.head.appendChild(style);
        document.body.appendChild(widget);

        dom.widget = widget;
        dom.header = widget.querySelector('#cuw-header');
        dom.body = widget.querySelector('#cuw-body');
        dom.toggle = widget.querySelector('#cuw-toggle');
        dom.headerDisplay = widget.querySelector('#cuw-header-display');
        ['cuw-5h-val', 'cuw-5h-bar', 'cuw-5h-reset',
            'cuw-7d-val', 'cuw-7d-bar', 'cuw-7d-reset'].forEach(id => {
                dom[id] = widget.querySelector(`#${id}`);
            });

        dom.toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleExpand(); });
        dom.toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); }
        });

        widget.addEventListener('pointerenter', () => {
            if (Date.now() - S.lastAt > CONFIG.HOVER_REFRESH_MS) refresh(true);
        }, { passive: true });

        applyCollapseState();
        makeDraggable(widget);
        patchHistory();

        listeners.visChange = () => {
            if (document.hidden) stopPoll();
            else { refresh(true); startPoll(); }
        };
        document.addEventListener('visibilitychange', listeners.visChange, { passive: true });

        window.addEventListener('beforeunload', destroy, { once: true });

        refresh(true);
        startPoll();
    }

    init();

})();
