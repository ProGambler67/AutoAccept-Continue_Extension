/**
 * Antigravity AutoContinue Agent v2.1 — Injected DOM Script
 *
 * Detects Antigravity error/termination dialogs and clicks the Retry button
 * after a visible countdown timer.
 *
 * RULES:
 *  1. NEVER type into chat — only click real Retry/Continue buttons.
 *  2. Wait retryDelaySeconds with a visible countdown, then click.
 *  3. If no Retry button is found, do nothing.
 *  4. Robust: wrapped in try/finally, never leaves state stuck.
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;
    if (window.__autoContinueStart) return;

    const log = (msg) => console.log(`[AutoContinue] ${msg}`);
    log('Script v2.1 loaded');

    // =================================================================
    // DOM UTILITIES
    // =================================================================

    const queryAll = (selector) => {
        const results = [];
        const seen = new Set();
        try {
            const nodes = Array.from(document.querySelectorAll(selector));
            for (const node of nodes) {
                if (!seen.has(node)) {
                    seen.add(node);
                    results.push(node);
                }
            }
        } catch (e) { }
        // Also check shadow roots
        try {
            const allEls = document.querySelectorAll('*');
            for (const el of allEls) {
                if (el.shadowRoot) {
                    try {
                        const shadowNodes = Array.from(el.shadowRoot.querySelectorAll(selector));
                        for (const node of shadowNodes) {
                            if (!seen.has(node)) {
                                seen.add(node);
                                results.push(node);
                            }
                        }
                    } catch (e) { }
                }
            }
        } catch (e) { }
        return results;
    };

    // =================================================================
    // ERROR PATTERNS — only Antigravity termination/server errors
    // =================================================================

    const ERROR_PATTERNS = [
        // Antigravity agent termination (PRIMARY — this is what we mainly target)
        'agent terminated due to error',
        'agent execution terminated due to error',
        'terminated due to error',
        'agent has been terminated',

        // Server overload
        'server capacity',
        'server traffic too high',
        'server is overloaded',
        'server overloaded',
        'service unavailable',

        // Rate limiting (only the specific message forms)
        'rate limit exceeded',
        'too many requests',

        // Server errors
        'internal server error',
        'bad gateway',
        'gateway timeout',

        // Connection errors
        'connection error',
        'connection lost',

        // Generation interruption
        'continue generating',
        'generation interrupted',
        'response was interrupted',

        // Generic
        'something went wrong',
        'an error occurred'
    ];

    // =================================================================
    // FIND RETRY BUTTON — scan the entire visible page
    // =================================================================

    const RETRY_PATTERNS = [
        { re: /\bretry\b/i, priority: 100 },
        { re: /\btry\s*again\b/i, priority: 95 },
        { re: /\bcontinue\s*generating\b/i, priority: 90 },
        { re: /\bcontinue\b/i, priority: 80 },
        { re: /\bregenerate\b/i, priority: 75 },
        { re: /\bresend\b/i, priority: 70 },
        { re: /\bresume\b/i, priority: 65 }
    ];

    const NEGATIVE_RE = /\b(cancel|stop|reject|deny|block|disable|never|discard|delete|remove|close|dismiss|no thanks|not now|abort|copy|debug)\b/i;

    function getButtonText(el) {
        if (!el) return '';
        const text = (el.textContent || '').trim();
        const title = (el.title || '').trim();
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || '';
        return `${text} ${title} ${aria}`.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function isVisible(el) {
        if (!el) return false;
        try {
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            return true;
        } catch (e) { return false; }
    }

    function isInExcludedZone(el) {
        if (!el) return true;
        try {
            // Never click our own UI
            const t = getButtonText(el);
            if (/autocontinue|auto.continue|auto.accept/i.test(t)) return true;

            // Never click status bar
            if (el.closest('.statusbar, .part.statusbar, #workbench\\.parts\\.statusbar')) return true;

            // OK to click if inside a dialog/notification/toast
            if (el.closest('[role="dialog"], .notification-toast, .notification-list-item, .monaco-dialog-box, .monaco-dialog-modal-block')) {
                return false;
            }

            // Don't click workbench chrome (title bar, sidebar, tabs etc.)
            if (el.closest('.titlebar, .menubar, .activitybar, .sidebar, .tabs-container')) return true;

            return false;
        } catch (e) { return true; }
    }

    /**
     * Find ALL visible retry/continue buttons on the page.
     * Returns sorted array, best match first. Empty if none found.
     */
    function findAllRetryButtons() {
        const candidates = [];
        const seen = new Set();

        // Search broadly: all buttons and button-like elements
        const allButtons = queryAll('button, [role="button"], a[role="button"]');

        for (const btn of allButtons) {
            if (seen.has(btn)) continue;
            seen.add(btn);

            if (!isVisible(btn)) continue;
            if (isInExcludedZone(btn)) continue;

            const text = getButtonText(btn);
            if (!text) continue;
            if (NEGATIVE_RE.test(text)) continue;

            for (const rp of RETRY_PATTERNS) {
                if (rp.re.test(text)) {
                    // Bonus priority if the button is inside a dialog/notification
                    const inDialog = !!btn.closest('[role="dialog"], .notification-toast, .notification-list-item, .monaco-dialog-box, .monaco-dialog-modal-block');
                    candidates.push({
                        btn,
                        text: text.slice(0, 80),
                        priority: rp.priority + (inDialog ? 50 : 0),
                        label: text.replace(/\s+/g, '-').slice(0, 30)
                    });
                    break;
                }
            }
        }

        candidates.sort((a, b) => b.priority - a.priority);
        return candidates;
    }

    // =================================================================
    // DETECT ERROR — check if any visible UI element has error text
    // =================================================================

    /**
     * Scans notification / dialog / toast containers for error patterns.
     * Returns { found: boolean, pattern: string } 
     */
    function detectError() {
        // Scan specific UI containers where Antigravity shows errors
        const containers = queryAll(
            '[role="dialog"], .notification-toast, .notification-list-item, ' +
            '.monaco-dialog-box, .monaco-dialog-modal-block, ' +
            '[class*="notification"], [class*="toast"], [class*="alert"], ' +
            '[class*="error-message"], [class*="error-banner"]'
        );

        for (const container of containers) {
            if (!isVisible(container)) continue;
            try {
                const text = (container.textContent || '').toLowerCase();
                // Quick guard: skip containers with our own text
                if (text.includes('autocontinue')) continue;
                // Skip very large containers (likely the whole page, not a notification)
                if (text.length > 5000) continue;

                for (const pattern of ERROR_PATTERNS) {
                    if (text.includes(pattern)) {
                        return { found: true, pattern };
                    }
                }
            } catch (e) { }
        }

        // Also check the chat area for specific Antigravity error messages
        // (these appear inline in the conversation)
        const chatAreas = queryAll(
            '.interactive-session, .chat-response, .chat-tool-response, ' +
            '[class*="response"], .antigravity-agent-side-panel'
        );
        for (const area of chatAreas) {
            if (!isVisible(area)) continue;
            try {
                const text = (area.textContent || '').toLowerCase();
                if (text.includes('autocontinue')) continue;
                if (text.length > 10000) continue;

                // Only match the most critical Antigravity errors in chat
                const criticalPatterns = [
                    'agent terminated due to error',
                    'agent execution terminated due to error',
                    'terminated due to error',
                    'continue generating'
                ];
                for (const pattern of criticalPatterns) {
                    if (text.includes(pattern)) {
                        return { found: true, pattern };
                    }
                }
            } catch (e) { }
        }

        return { found: false, pattern: '' };
    }

    // =================================================================
    // CLICK BUTTON
    // =================================================================

    function clickRetryButton(btn, reason) {
        if (!btn) return false;
        try {
            if (!isVisible(btn)) return false;

            // Double-click guard
            const now = Date.now();
            const lastClick = Number(btn.getAttribute && btn.getAttribute('data-ac-ts') || 0);
            if (lastClick > 0 && (now - lastClick) < 4000) return false;

            // Focus the button first
            try { btn.focus(); } catch (e) { }

            // Method 1: native click
            try { btn.click(); } catch (e) { }

            // Method 2: MouseEvent
            try {
                const rect = btn.getBoundingClientRect();
                btn.dispatchEvent(new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                }));
            } catch (e) { }

            // Method 3: PointerEvent (some frameworks use this)
            try {
                const rect = btn.getBoundingClientRect();
                btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
                btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
            } catch (e) { }

            try { btn.setAttribute('data-ac-ts', String(now)); } catch (e) { }

            log(`CLICKED: "${getButtonText(btn).slice(0, 60)}" [${reason}]`);
            return true;
        } catch (e) {
            log(`Click failed: ${e.message}`);
            return false;
        }
    }

    // =================================================================
    // COUNTDOWN TIMER UI (floating badge)
    // =================================================================

    const BADGE_ID = '__ac-countdown-badge';

    function showCountdown(seconds, pattern) {
        try {
            let badge = document.getElementById(BADGE_ID);
            if (!badge) {
                badge = document.createElement('div');
                badge.id = BADGE_ID;
                badge.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:999998;' +
                    'background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #00d4aa;' +
                    'border-radius:16px;padding:16px 24px;font-family:system-ui,sans-serif;' +
                    'color:#e6edf3;box-shadow:0 8px 32px rgba(0,212,170,0.3);pointer-events:none;' +
                    'user-select:none;min-width:180px;text-align:center;';
                (document.body || document.documentElement).appendChild(badge);
            }
            badge.innerHTML =
                '<div style="font-size:10px;color:#8b99a8;letter-spacing:1px;margin-bottom:6px;">⚡ AUTOCONTINUE</div>' +
                '<div style="font-size:11px;color:#ffb2ab;margin-bottom:10px;max-width:200px;word-break:break-word;">' +
                    (pattern || 'error').slice(0, 50) + '</div>' +
                '<div style="font-size:48px;font-weight:800;background:linear-gradient(135deg,#00d4aa,#00e5bf);' +
                    '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;">' +
                    seconds + '</div>' +
                '<div style="font-size:11px;color:#8b99a8;margin-top:6px;">Clicking Retry in ' + seconds + 's</div>';
        } catch (e) { }
    }

    function hideCountdown() {
        try {
            const badge = document.getElementById(BADGE_ID);
            if (badge) badge.remove();
        } catch (e) { }
    }

    // =================================================================
    // BACKGROUND OVERLAY
    // =================================================================

    const OVERLAY_ID = '__ac-bg-overlay';

    function showOverlay(state) {
        try {
            if (document.getElementById(OVERLAY_ID)) return;
            const el = document.createElement('div');
            el.id = OVERLAY_ID;
            el.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
                'background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;' +
                'align-items:center;justify-content:center;font-family:system-ui,sans-serif;' +
                'color:#e6edf3;pointer-events:none;user-select:none;backdrop-filter:blur(3px);';
            el.innerHTML =
                '<div style="text-align:center;max-width:440px;padding:32px;">' +
                '<div style="font-size:48px;margin-bottom:16px;animation:acP 2s ease-in-out infinite;">⚡</div>' +
                '<div style="font-size:22px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#00d4aa,#00e5bf);' +
                    '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">AutoContinue — Background Mode</div>' +
                '<div style="font-size:13px;color:#8b99a8;margin-bottom:24px;">Scanning for errors. Retries happen automatically.</div>' +
                '<div style="display:flex;gap:20px;justify-content:center;">' +
                    '<div style="text-align:center;padding:12px 20px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:12px;">' +
                        '<div style="font-size:28px;font-weight:800;color:#00d4aa;" id="__ac-bg-r">0</div>' +
                        '<div style="font-size:10px;color:#8b99a8;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">Retries</div></div>' +
                    '<div style="text-align:center;padding:12px 20px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.2);border-radius:12px;">' +
                        '<div style="font-size:28px;font-weight:800;color:#f85149;" id="__ac-bg-e">0</div>' +
                        '<div style="font-size:10px;color:#8b99a8;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">Errors</div></div>' +
                    '<div style="text-align:center;padding:12px 20px;background:rgba(210,153,34,0.08);border:1px solid rgba(210,153,34,0.2);border-radius:12px;">' +
                        '<div style="font-size:28px;font-weight:800;color:#d29922;" id="__ac-bg-c">—</div>' +
                        '<div style="font-size:10px;color:#8b99a8;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;">Countdown</div></div>' +
                '</div>' +
                '<div style="margin-top:20px;font-size:11px;color:#555;padding:8px 16px;border:1px solid #1e2a3a;border-radius:8px;background:rgba(0,0,0,0.3);">' +
                    'Press <kbd style="background:#1e2a3a;padding:2px 6px;border-radius:4px;color:#8b99a8;">Ctrl+Shift+B</kbd> to exit</div>' +
                '</div>' +
                '<style>@keyframes acP{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.7}}</style>';
            (document.body || document.documentElement).appendChild(el);
            log('Background overlay mounted');
        } catch (e) { }
    }

    function updateOverlay(state) {
        try {
            const r = document.getElementById('__ac-bg-r');
            const e = document.getElementById('__ac-bg-e');
            const c = document.getElementById('__ac-bg-c');
            if (r) r.textContent = String(state.retries || 0);
            if (e) e.textContent = String(state.errorsDetected || 0);
            if (c) c.textContent = state.countdownSecondsLeft > 0 ? (state.countdownSecondsLeft + 's') : '—';
        } catch (e) { }
    }

    function hideOverlay() {
        try {
            const el = document.getElementById(OVERLAY_ID);
            if (el) el.remove();
            log('Background overlay removed');
        } catch (e) { }
    }

    // =================================================================
    // MAIN ENGINE
    // =================================================================

    if (!window.__autoContinueState) {
        window.__autoContinueState = {
            isRunning: false,
            isBackgroundMode: false,
            sessionID: 0,
            retries: 0,
            errorsDetected: 0,
            consecutiveRetries: 0,
            maxRetries: 50,
            retryCooldownMs: 5000,
            retryDelaySeconds: 5,
            lastRetryAt: 0,
            lastRetryAction: '',
            lastError: '',
            lastHandledSig: '',
            countdownActive: false,
            countdownSecondsLeft: 0,
            pausedForMaxRetries: false,
            pollInterval: 500,
            _interval: null,
            _observer: null,
            _overlayInterval: null,
            retryHistory: []
        };
    }

    /**
     * Core scan: detect error → find button → start countdown → click.
     * This is synchronous except when countdown is triggered.
     */
    function tick(state) {
        if (!state.isRunning) return;
        if (state.countdownActive) return; // Countdown in progress

        const now = Date.now();

        // Cooldown after last retry
        if ((now - state.lastRetryAt) < state.retryCooldownMs) return;

        // Max retries check
        if (state.consecutiveRetries >= state.maxRetries) {
            if (!state.pausedForMaxRetries) {
                log(`Paused: hit ${state.maxRetries} consecutive retries`);
                state.pausedForMaxRetries = true;
            }
            // Check if error cleared
            const check = detectError();
            if (!check.found) {
                state.consecutiveRetries = 0;
                state.pausedForMaxRetries = false;
                log('Error cleared, unpaused');
            }
            return;
        }

        // Don't interfere with typing
        try {
            const active = document.activeElement;
            if (active) {
                const tag = (active.tagName || '').toLowerCase();
                if (tag === 'textarea' || (tag === 'input' && !['button', 'submit', 'checkbox', 'radio'].includes((active.type || '').toLowerCase())) || active.isContentEditable) {
                    return;
                }
            }
        } catch (e) { }

        // Detect error
        const error = detectError();

        if (!error.found) {
            // Error cleared — reset consecutive counter after 10s of no errors
            if (state.consecutiveRetries > 0 && (now - state.lastRetryAt) > 10000) {
                log(`No errors for 10s. Resetting counter (was ${state.consecutiveRetries}).`);
                state.consecutiveRetries = 0;
                state.lastHandledSig = '';
                state.pausedForMaxRetries = false;
            }
            return;
        }

        // Find retry buttons
        const buttons = findAllRetryButtons();
        if (buttons.length === 0) {
            // Error detected but no retry button visible
            return;
        }

        // Deduplication — don't handle the exact same error within 2x cooldown
        const sig = error.pattern;
        if (sig === state.lastHandledSig && (now - state.lastRetryAt) < state.retryCooldownMs * 2) {
            return;
        }

        state.errorsDetected++;
        state.lastError = error.pattern;
        log(`Error: "${error.pattern}" | Found ${buttons.length} retry button(s): "${buttons[0].text}"`);

        // Start countdown then click
        doCountdownAndClick(state, error.pattern, buttons[0]);
    }

    /**
     * Countdown then click. Fully wrapped in try/finally.
     * Does NOT re-scan during countdown — just counts down and clicks.
     */
    async function doCountdownAndClick(state, pattern, bestButton) {
        const delay = state.retryDelaySeconds || 5;
        state.countdownActive = true;
        state.countdownSecondsLeft = delay;

        try {
            log(`Countdown: ${delay}s before clicking "${bestButton.text}"`);
            showCountdown(delay, pattern);

            for (let i = delay; i >= 1; i--) {
                if (!state.isRunning) {
                    log('Countdown cancelled: disabled');
                    return;
                }

                state.countdownSecondsLeft = i;
                showCountdown(i, pattern);
                updateOverlay(state);

                // Wait 1 second
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            state.countdownSecondsLeft = 0;
            log('Countdown finished. Clicking now...');

            // Re-find buttons fresh (DOM may have changed during countdown)
            const freshButtons = findAllRetryButtons();
            const target = freshButtons.length > 0 ? freshButtons[0] : bestButton;

            const clicked = clickRetryButton(target.btn, 'countdown-' + target.label);
            if (clicked) {
                state.retries++;
                state.consecutiveRetries++;
                state.lastRetryAt = Date.now();
                state.lastRetryAction = target.label;
                state.lastHandledSig = pattern;
                state.retryHistory.push({
                    at: new Date().toISOString(),
                    pattern: pattern,
                    action: target.label,
                    consecutive: state.consecutiveRetries
                });
                if (state.retryHistory.length > 50) {
                    state.retryHistory = state.retryHistory.slice(-50);
                }
                log(`✓ Retry #${state.consecutiveRetries}: "${target.text}" [${target.label}]`);
            } else {
                log(`✗ Click did not succeed on "${target.text}"`);
            }
        } catch (err) {
            log(`Countdown error: ${err.message}`);
        } finally {
            // ALWAYS reset — never leave stuck
            state.countdownActive = false;
            state.countdownSecondsLeft = 0;
            hideCountdown();
            updateOverlay(state);
        }
    }

    // =================================================================
    // PUBLIC API
    // =================================================================

    window.__autoContinueGetStats = function () {
        const s = window.__autoContinueState;
        return {
            retries: s.retries || 0,
            errorsDetected: s.errorsDetected || 0,
            consecutiveRetries: s.consecutiveRetries || 0,
            lastError: s.lastError || '',
            lastRetryAction: s.lastRetryAction || '',
            lastRetryAt: s.lastRetryAt ? new Date(s.lastRetryAt).toISOString() : '',
            isRunning: s.isRunning,
            isBackgroundMode: s.isBackgroundMode || false,
            pausedForMaxRetries: s.pausedForMaxRetries || false,
            countdownActive: s.countdownActive || false,
            countdownSecondsLeft: s.countdownSecondsLeft || 0,
            retryHistory: (s.retryHistory || []).slice(-10)
        };
    };

    window.__autoContinueStart = function (config) {
        const state = window.__autoContinueState;

        if (state.isRunning) {
            log('Restarting...');
            window.__autoContinueStop();
        }

        state.isRunning = true;
        state.sessionID++;
        state.maxRetries = config.maxRetries || 50;
        state.retryCooldownMs = config.retryCooldownMs || 5000;
        state.retryDelaySeconds = config.retryDelaySeconds || 5;
        state.pollInterval = config.pollInterval || 500;
        state.isBackgroundMode = !!config.isBackgroundMode;
        state.consecutiveRetries = 0;
        state.lastRetryAt = 0;
        state.lastRetryAction = '';
        state.lastError = '';
        state.lastHandledSig = '';
        state.countdownActive = false;
        state.countdownSecondsLeft = 0;
        state.pausedForMaxRetries = false;

        log(`Started: delay=${state.retryDelaySeconds}s cooldown=${state.retryCooldownMs}ms poll=${state.pollInterval}ms bg=${state.isBackgroundMode}`);

        // MutationObserver — instant detection
        if (state._observer) {
            try { state._observer.disconnect(); } catch (e) { }
        }
        try {
            let lastObsTick = 0;
            const obs = new MutationObserver(() => {
                if (!state.isRunning) return;
                const now = Date.now();
                if (now - lastObsTick < 300) return; // Throttle: max 1 per 300ms
                lastObsTick = now;
                tick(state);
            });
            obs.observe(document.documentElement || document.body, {
                childList: true, subtree: true, attributes: true
            });
            state._observer = obs;
            log('MutationObserver started');
        } catch (e) {
            log(`MutationObserver failed: ${e.message}`);
        }

        // Poll fallback
        state._interval = setInterval(() => {
            if (state.isRunning) tick(state);
        }, state.pollInterval);
        log(`Poll started (${state.pollInterval}ms)`);

        // Background overlay
        if (state.isBackgroundMode) {
            showOverlay(state);
            state._overlayInterval = setInterval(() => {
                if (state.isRunning && state.isBackgroundMode) updateOverlay(state);
            }, 500);
        } else {
            hideOverlay();
        }

        log('ACTIVE' + (state.isBackgroundMode ? ' [BG MODE]' : ''));
    };

    window.__autoContinueStop = function () {
        const state = window.__autoContinueState;
        state.isRunning = false;
        state.countdownActive = false;
        state.countdownSecondsLeft = 0;

        if (state._interval) { clearInterval(state._interval); state._interval = null; }
        if (state._overlayInterval) { clearInterval(state._overlayInterval); state._overlayInterval = null; }
        if (state._observer) { try { state._observer.disconnect(); } catch (e) { } state._observer = null; }

        hideCountdown();
        hideOverlay();
        log(`Stopped. Retries: ${state.retries}, Errors: ${state.errorsDetected}`);
    };

    log('v2.1 Ready');
})();
