// ==UserScript==
// @name         Claude Usage Widget
// @namespace    https://github.com/n6ufal/claude-usage-widget
// @version      2.0
// @description  Floating Claude usage monitor with Gruvbox theme - shows usage % and reset timer in minimized mode
// @author       Alif Naufal (n6ufal)
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    if (document.getElementById('cuw')) return;

    const CONFIG = {
        POLL_INTERVAL_MS:   60_000,
        FETCH_TIMEOUT_MS:   10_000,
        RETRY_DELAYS_MS:    [2_000, 5_000, 15_000],
        WIDGET_WIDTH_PX:    130,
    };

    let isCollapsed       = true;
    let currentPercentage = null;
    let currentResetISO   = null;

    let orgUUIDPromise    = null;
    let pollTimerId       = null;
    let countdownTimerId  = null;
    let retryCount        = 0;

    const dom = {};

    const listeners = {};

    function parseISO(iso) {
        if (!iso) return null;
        const ms = new Date(iso).getTime();
        return Number.isFinite(ms) ? ms : null;
    }

    function formatTimeRemaining(iso, mode = 'short') {
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

        if (h > 24) return `Reset in ${Math.floor(h / 24)}d ${h % 24}h`;
        if (h > 0)  return `Reset in ${h}h ${m}m`;
        return `Reset in ${m}m`;
    }

    function clampPct(n) {
        return Math.min(100, Math.max(0, Math.round(n)));
    }

    function getOrgUUID() {
        if (orgUUIDPromise) return orgUUIDPromise;

        orgUUIDPromise = (async () => {
            const signal = AbortSignal.timeout(CONFIG.FETCH_TIMEOUT_MS);
            const resp = await fetch('/api/organizations', {
                credentials: 'include',
                headers:     { Accept: 'application/json' },
                signal,
            });
            if (!resp.ok) throw new Error(`org fetch ${resp.status}`);
            const orgs = await resp.json();
            if (!Array.isArray(orgs) || !orgs.length) throw new Error('no orgs');
            return orgs[0].uuid;
        })().catch(err => {
            orgUUIDPromise = null;
            throw err;
        });

        return orgUUIDPromise;
    }

    async function fetchUsage() {
        try {
            const uuid   = await getOrgUUID();
            const signal = AbortSignal.timeout(CONFIG.FETCH_TIMEOUT_MS);
            const resp   = await fetch(`/api/organizations/${uuid}/usage`, {
                credentials: 'include',
                headers:     { Accept: 'application/json' },
                signal,
            });

            if (!resp.ok) throw new Error(`usage fetch ${resp.status}`);

            const data = await resp.json();
            const has5h = data?.five_hour?.utilization != null;
            const has7d = data?.seven_day?.utilization != null;

            if (!has5h && !has7d) {
                setErrorState('API?');
                return;
            }

            retryCount = 0;
            setErrorState(null);

            if (has5h) {
                currentPercentage = clampPct(data.five_hour.utilization);
                currentResetISO   = data.five_hour.resets_at ?? null;
                updateBar('cuw-5h-val', 'cuw-5h-bar', 'cuw-5h-reset',
                          currentPercentage, currentResetISO);
                manageCountdownTimer();
            }

            if (has7d) {
                updateBar('cuw-7d-val', 'cuw-7d-bar', 'cuw-7d-reset',
                          clampPct(data.seven_day.utilization),
                          data.seven_day.resets_at ?? null);
            }

        } catch (err) {
            handleFetchError(err);
        }
    }

    function handleFetchError(err) {
        console.warn('[CUW]', err.message);
        setErrorState('⚠');

        if (retryCount < CONFIG.RETRY_DELAYS_MS.length) {
            const delay = CONFIG.RETRY_DELAYS_MS[retryCount++];
            setTimeout(fetchUsage, delay);
        }
    }

    function setErrorState(token) {
        if (!dom.headerDisplay) return;
        if (token) {
            dom.headerDisplay.textContent = token;
            dom.headerDisplay.setAttribute('aria-label', 'Error fetching usage data');
        }
    }

    function updateBar(valId, barId, resetId, pct, resetsAt) {
        const valEl   = dom[valId]   ?? document.getElementById(valId);
        const barEl   = dom[barId]   ?? document.getElementById(barId);
        const resetEl = dom[resetId] ?? document.getElementById(resetId);
        if (!valEl || !barEl || !resetEl) return;

        valEl.textContent   = pct + '%';
        barEl.style.width   = pct + '%';
        resetEl.textContent = formatTimeRemaining(resetsAt, 'long');
    }

    function updateHeaderDisplay() {
        if (!dom.headerDisplay) return;

        let text;
        if (!isCollapsed) {
            text = currentPercentage !== null ? `${currentPercentage}%` : '—';
        } else {
            const pctPart  = currentPercentage !== null ? `${currentPercentage}%` : null;
            const timePart = formatTimeRemaining(currentResetISO, 'short');
            text = pctPart && timePart ? `${pctPart} · ${timePart}`
                 : pctPart             ? pctPart
                 : timePart            ? timePart
                 : '—';
        }

        if (dom.headerDisplay.textContent !== text) {
            dom.headerDisplay.textContent = text;
        }
    }

    function manageCountdownTimer() {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
        updateHeaderDisplay();

        if (!isCollapsed) return;

        const targetMs = parseISO(currentResetISO);
        if (!targetMs || targetMs <= Date.now()) return;

        countdownTimerId = setInterval(() => {
            updateHeaderDisplay();
            const t = parseISO(currentResetISO);
            if (!t || t <= Date.now()) {
                clearInterval(countdownTimerId);
                countdownTimerId = null;
            }
        }, 1_000);
    }

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

    function makeDraggable(widget) {
        let dragging = false;
        let ox = 0;
        let oy = 0;

        function onMouseDown(e) {
            if (e.target.id === 'cuw-toggle') return;
            dragging = true;
            const r  = widget.getBoundingClientRect();
            widget.style.left      = r.left + 'px';
            widget.style.transform = 'none';
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
            widget.style.cursor = 'grabbing';
        }

        listeners.onMouseMove = (e) => {
            if (!dragging) return;
            widget.style.top    = (e.clientY - oy) + 'px';
            widget.style.bottom = 'auto';
            widget.style.left   = (e.clientX - ox) + 'px';
            widget.style.right  = 'auto';
        };

        listeners.onMouseUp = () => {
            if (dragging) { dragging = false; widget.style.cursor = ''; }
        };

        dom.header.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', listeners.onMouseMove);
        document.addEventListener('mouseup',   listeners.onMouseUp);
    }

    function destroy() {
        clearInterval(pollTimerId);
        clearInterval(countdownTimerId);
        pollTimerId      = null;
        countdownTimerId = null;

        if (listeners.onMouseMove)
            document.removeEventListener('mousemove', listeners.onMouseMove);
        if (listeners.onMouseUp)
            document.removeEventListener('mouseup', listeners.onMouseUp);

        if (listeners.observer) {
            listeners.observer.disconnect();
            listeners.observer = null;
        }
    }

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

        return { widget, style };
    }

    function init() {
        const { widget, style } = buildWidget();
        document.head.appendChild(style);
        document.body.appendChild(widget);

        dom.widget        = widget;
        dom.header        = widget.querySelector('#cuw-header');
        dom.body          = widget.querySelector('#cuw-body');
        dom.toggle        = widget.querySelector('#cuw-toggle');
        dom.headerDisplay = widget.querySelector('#cuw-header-display');
        ['cuw-5h-val','cuw-5h-bar','cuw-5h-reset',
         'cuw-7d-val','cuw-7d-bar','cuw-7d-reset'].forEach(id => {
            dom[id] = widget.querySelector(`#${id}`);
        });

        dom.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleExpand();
        });

        dom.toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleExpand();
            }
        });

        applyCollapseState();
        makeDraggable(widget);

        listeners.observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                for (const node of m.removedNodes) {
                    if (node === widget || node.contains?.(widget)) {
                        destroy();
                        return;
                    }
                }
            }
        });
        listeners.observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener('pagehide', destroy, { once: true });

        fetchUsage();
        pollTimerId = setInterval(fetchUsage, CONFIG.POLL_INTERVAL_MS);
    }

    init();

})();