// ==UserScript==
// @name         Claude Usage Widget
// @namespace    https://github.com/n6ufal/claude-usage-widget
// @version      3.1
// @description  Floating Claude usage monitor with Gruvbox theme - shows usage % and reset timer in minimized mode
// @author       Alif Naufal (n6ufal)
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @license      AGPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    if (document.getElementById('cuw')) return;

    const CHECK_INTERVAL_MS = 60000;
    const COLOR = '#a89984';

    let orgUUID = null;
    let countdownInterval = null;
    let currentResetISO = null;
    let currentPercentage = null;
    let isCollapsed = true;
    let fetchIntervalId = null;

    // ── Widget markup ────────────────────────────────────────────────────────

    const widget = document.createElement('div');
    widget.id = 'cuw';
    widget.innerHTML = `
        <div id="cuw-header">
            <span id="cuw-title">Usage <span id="cuw-header-display">—</span></span>
            <span id="cuw-toggle" title="Expand">▸</span>
        </div>
        <div id="cuw-body">
            <div class="cuw-row">
                <span class="cuw-label">5 hours</span>
                <span class="cuw-value" id="cuw-5h-val">—</span>
            </div>
            <div class="cuw-bar"><div class="cuw-fill" id="cuw-5h-bar"></div></div>
            <div class="cuw-reset" id="cuw-5h-reset"></div>
            <div class="cuw-row" style="margin-top:6px">
                <span class="cuw-label">7 days</span>
                <span class="cuw-value" id="cuw-7d-val">—</span>
            </div>
            <div class="cuw-bar"><div class="cuw-fill" id="cuw-7d-bar"></div></div>
            <div class="cuw-reset" id="cuw-7d-reset"></div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #cuw {
            position: fixed;
            bottom: 2px;
            right: 10px;
            z-index: 999999;
            background: #1d2021;
            color: #ebdbb2;
            border: 1px solid #928374;
            border-radius: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
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
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            color: #a89984;
            padding: 0 2px;
        }
        #cuw-toggle:hover { color: #ebdbb2; }
        #cuw-body {
            padding: 6px 8px 8px;
            width: 130px;
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
            width: 0%;
            background: #a89984;
            border-radius: 3px;
            transition: width .5s ease;
        }
        .cuw-reset {
            font-size: 9px;
            color: #a89984;
            text-align: right;
            margin-top: 2px;
            min-height: 12px;
        }
    `;

    // ── Formatting ───────────────────────────────────────────────────────────

    function formatCountdown(iso) {
        if (!iso) return null;
        const diff = new Date(iso).getTime() - Date.now();
        if (diff <= 0) return '0m';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }

    function formatResetLabel(iso) {
        if (!iso) return '';
        const diff = new Date(iso).getTime() - Date.now();
        if (diff <= 0) return 'Resetting...';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        if (h > 24) return `Reset in ${Math.floor(h / 24)}d ${h % 24}h`;
        if (h > 0)  return `Reset in ${h}h ${m}m`;
        return `Reset in ${m}m`;
    }

    // ── Header display ───────────────────────────────────────────────────────

    function updateHeaderDisplay() {
        const el = document.getElementById('cuw-header-display');
        if (!el) return;

        if (!isCollapsed) {
            el.textContent = currentPercentage !== null ? currentPercentage + '%' : '—';
            return;
        }

        const pctPart  = currentPercentage !== null ? currentPercentage + '%' : null;
        const timePart = formatCountdown(currentResetISO);

        if (pctPart && timePart) {
            el.textContent = `${pctPart} · ${timePart}`;
        } else if (pctPart) {
            el.textContent = pctPart;
        } else if (timePart) {
            el.textContent = timePart;
        } else {
            el.textContent = '—';
        }
    }

    // ── Countdown ticker ─────────────────────────────────────────────────────

    function manageCountdownTimer() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        updateHeaderDisplay();

        if (!isCollapsed) return;
        if (!currentResetISO || new Date(currentResetISO).getTime() <= Date.now()) return;

        countdownInterval = setInterval(() => {
            if (!document.getElementById('cuw')) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                return;
            }
            updateHeaderDisplay();
            if (!currentResetISO || new Date(currentResetISO).getTime() <= Date.now()) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
        }, 1000);
    }

    // ── Collapse / expand ────────────────────────────────────────────────────

    function applyCollapseState() {
        const body   = document.getElementById('cuw-body');
        const header = document.getElementById('cuw-header');
        const toggle = document.getElementById('cuw-toggle');
        if (!body || !header || !toggle) return;

        if (isCollapsed) {
            body.classList.add('hidden');
            header.classList.add('collapsed');
        } else {
            body.classList.remove('hidden');
            header.classList.remove('collapsed');
        }

        toggle.textContent = isCollapsed ? '▸' : '▾';
        manageCountdownTimer();
    }

    function toggleExpand() {
        isCollapsed = !isCollapsed;
        applyCollapseState();
    }

    // ── Bar row updater ──────────────────────────────────────────────────────

    function updateBar(valId, barId, resetId, utilization, resetsAt) {
        const valEl   = document.getElementById(valId);
        const barEl   = document.getElementById(barId);
        const resetEl = document.getElementById(resetId);
        if (!valEl || !barEl || !resetEl) return;

        const pct = Math.min(Math.max(utilization, 0), 100);
        valEl.textContent   = pct + '%';
        barEl.style.width   = pct + '%';
        resetEl.textContent = formatResetLabel(resetsAt);
    }

    // ── API ──────────────────────────────────────────────────────────────────

    async function getOrgUUID() {
        if (orgUUID) return orgUUID;
        const resp = await fetch('/api/organizations', {
            credentials: 'include',
            headers: { Accept: 'application/json' }
        });
        if (!resp.ok) throw new Error(`org fetch ${resp.status}`);
        const orgs = await resp.json();
        if (!Array.isArray(orgs) || !orgs.length) throw new Error('no orgs');
        orgUUID = orgs[0].uuid;
        return orgUUID;
    }

    async function fetchUsage() {
        if (!document.getElementById('cuw')) {
            if (fetchIntervalId) clearInterval(fetchIntervalId);
            return;
        }

        try {
            const uuid = await getOrgUUID();
            const resp = await fetch(`/api/organizations/${uuid}/usage`, {
                credentials: 'include',
                headers: { Accept: 'application/json' }
            });
            if (!resp.ok) throw new Error(`usage fetch ${resp.status}`);

            const data = await resp.json();

            const has5h = data?.five_hour?.utilization != null;
            const has7d = data?.seven_day?.utilization != null;

            if (!has5h && !has7d) {
                const el = document.getElementById('cuw-header-display');
                if (el) { el.textContent = 'API?'; }
                console.warn('[Claude Usage] Unexpected API shape:', data);
                return;
            }

            if (has5h) {
                currentPercentage = Math.min(Math.max(Math.round(data.five_hour.utilization), 0), 100);
                currentResetISO   = data.five_hour.resets_at ?? null;
                updateBar('cuw-5h-val', 'cuw-5h-bar', 'cuw-5h-reset', currentPercentage, currentResetISO);
                manageCountdownTimer();
            }

            if (has7d) {
                const pct7d = Math.min(Math.max(Math.round(data.seven_day.utilization), 0), 100);
                updateBar('cuw-7d-val', 'cuw-7d-bar', 'cuw-7d-reset', pct7d, data.seven_day.resets_at ?? null);
            }

        } catch (e) {
            console.log('[Claude Usage] Error:', e.message);
        }
    }

    // ── Drag ─────────────────────────────────────────────────────────────────

    function makeDraggable() {
        const header = document.getElementById('cuw-header');
        if (!header) return;
        let dragging = false, ox, oy;

        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'cuw-toggle') return;
            dragging = true;
            const r = widget.getBoundingClientRect();
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
            widget.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            widget.style.top    = (e.clientY - oy) + 'px';
            widget.style.bottom = 'auto';
            widget.style.left   = (e.clientX - ox) + 'px';
            widget.style.right  = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (dragging) { dragging = false; widget.style.cursor = ''; }
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    function init() {
        document.head.appendChild(style);
        document.body.appendChild(widget);

        document.getElementById('cuw-toggle')
            ?.addEventListener('click', (e) => { e.stopPropagation(); toggleExpand(); });

        applyCollapseState();
        makeDraggable();

        fetchUsage();
        fetchIntervalId = setInterval(fetchUsage, CHECK_INTERVAL_MS);
    }

    if (document.body) {
        init();
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }

})();