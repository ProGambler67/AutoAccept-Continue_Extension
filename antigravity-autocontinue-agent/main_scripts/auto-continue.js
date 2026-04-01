/**
 * Antigravity AutoContinue Agent v2.2 — Injected DOM Script
 *
 * Detects errors anywhere on the page, finds Retry buttons, counts down, clicks.
 * 
 * v2.2 fixes:
 *  - Scans ENTIRE body for error text (v2.1 was too narrow, missed errors)
 *  - Countdown wrapped in try/finally (never gets stuck)
 *  - No re-check during countdown (just count down and click)
 *  - Triple click dispatch (click + MouseEvent + PointerEvent)
 *  - NEVER types into chat
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;
    if (window.__autoContinueStart) return;

    const LOG_PREFIX = '[AutoContinue]';
    const log = (msg) => {
        try { console.log(`${LOG_PREFIX} ${msg}`); } catch (e) { }
    };
    log('Script v2.2 loaded');

    // =================================================================
    // ERROR PATTERNS
    // =================================================================

    const ERROR_PATTERNS = [
        // Antigravity agent termination (PRIMARY target)
        'agent terminated due to error',
        'agent execution terminated due to error',
        'terminated due to error',
        'agent has been terminated',

        // Server overload
        'server capacity',
        'server traffic too high',
        'server is overloaded',
        'servers are experiencing high traffic',
        'service unavailable',
        'temporarily unavailable',

        // Rate limiting
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

    // Text that means we should NOT match (false positive guards)
    const FALSE_POSITIVE_GUARDS = [
        'autocontinue',
        'auto continue',
        'auto accept',
        'error handling',
        'error detection',
        'catch error',
        'throw error',
        'console.error',
        'handle error',
        'error boundary'
    ];

    // =================================================================
    // DOM HELPERS
    // =================================================================

    function getAllRoots() {
        const roots = [document];
        try {
            const walk = (root) => {
                if (!root) return;
                const els = root.querySelectorAll ? root.querySelectorAll('*') : [];
                for (const el of els) {
                    if (el.shadowRoot) {
                        roots.push(el.shadowRoot);
                        walk(el.shadowRoot);
                    }
                }
            };
            walk(document);
        } catch (e) { }
        return roots;
    }

    function qAll(selector) {
        const results = [];
        const seen = new Set();
        for (const root of getAllRoots()) {
            try {
                for (const el of root.querySelectorAll(selector)) {
                    if (!seen.has(el)) {
                        seen.add(el);
                        results.push(el);
                    }
                }
            } catch (e) { }
        }
        return results;
    }

    function isVisible(el) {
        if (!el) return false;
        try {
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden';
        } catch (e) { return false; }
    }

    function getElText(el) {
        if (!el) return '';
        try {
            return ((el.textContent || '') + ' ' + (el.title || '') + ' ' +
                ((el.getAttribute && el.getAttribute('aria-label')) || '')).toLowerCase().replace(/\s+/g, ' ').trim();
        } catch (e) { return ''; }
    }

    function isUserTyping() {
        try {
            const a = document.activeElement;
            if (!a) return false;
            const tag = (a.tagName || '').toLowerCase();
            if (tag === 'textarea') return true;
            if (tag === 'input' && !['button', 'submit', 'checkbox', 'radio'].includes((a.type || '').toLowerCase())) return true;
            if (a.isContentEditable) return true;
        } catch (e) { }
        return false;
    }

    // =================================================================
    // ERROR DETECTION — scan the entire page
    // =================================================================

    function detectError() {
        // Strategy: scan the full body text for error patterns.
        // This is what v2.0 did and it WORKED.
        // But skip if the text contains code (false positive guard).

        const bodyText = (() => {
            try {
                return (document.body?.textContent || '').toLowerCase();
            } catch (e) { return ''; }
        })();

        if (!bodyText) return { found: false, pattern: '' };

        for (const pattern of ERROR_PATTERNS) {
            if (!bodyText.includes(pattern)) continue;

            // False positive check: is this pattern in code/docs context?
            // Count how many code indicators are near the pattern
            const patternIdx = bodyText.indexOf(pattern);
            // Get ~500 chars around the match for context
            const contextStart = Math.max(0, patternIdx - 250);
            const contextEnd = Math.min(bodyText.length, patternIdx + pattern.length + 250);
            const context = bodyText.slice(contextStart, contextEnd);

            // Skip if context looks like code
            const codeIndicators = ['function ', 'const ', 'let ', 'var ', 'import ', 'console.', '===', 'catch(', 'catch (', 'throw '];
            const codeHits = codeIndicators.filter(c => context.includes(c)).length;
            if (codeHits >= 3) continue;

            // Skip if context has our own UI text
            if (FALSE_POSITIVE_GUARDS.some(g => context.includes(g))) continue;

            log(`Error detected: "${pattern}"`);
            return { found: true, pattern };
        }

        return { found: false, pattern: '' };
    }

    // =================================================================
    // RETRY BUTTON FINDING
    // =================================================================

    const RETRY_BUTTON_PATTERNS = [
        { re: /\bretry\b/i, score: 100 },
        { re: /\btry\s*again\b/i, score: 95 },
        { re: /\bcontinue\s*generating\b/i, score: 90 },
        { re: /\bcontinue\b/i, score: 80 },
        { re: /\bregenerate\b/i, score: 75 },
        { re: /\bresend\b/i, score: 70 },
        { re: /\bresume\b/i, score: 65 }
    ];

    const BAD_BUTTON_RE = /\b(cancel|stop|reject|deny|block|disable|never|discard|delete|remove|close|dismiss|not now|abort|copy|debug|settings?|configure|manage|open|show)\b/i;

    function findRetryButtons() {
        const candidates = [];
        const seen = new Set();

        // Get ALL buttons from ALL roots (including shadow DOM)
        const buttons = qAll('button, [role="button"], a[role="button"]');

        for (const btn of buttons) {
            if (seen.has(btn)) continue;
            seen.add(btn);
            if (!isVisible(btn)) continue;

            // Skip our own UI
            try {
                if (btn.closest('#__ac-countdown-badge, #__ac-bg-overlay')) continue;
            } catch (e) { }

            // Skip status bar
            try {
                if (btn.closest('.statusbar, .part.statusbar, #workbench\\.parts\\.statusbar')) continue;
            } catch (e) { }

            // Skip workbench chrome UNLESS inside a dialog/notification
            try {
                const inDialog = !!btn.closest('[role="dialog"], .notification-toast, .notification-list-item, .monaco-dialog-box, .monaco-dialog-modal-block, [class*="notification"], [class*="toast"]');
                const inChrome = !!btn.closest('.titlebar, .menubar, .activitybar, .sidebar, .tabs-container, .editor-actions');
                if (inChrome && !inDialog) continue;
            } catch (e) { }

            const text = getElText(btn);
            if (!text) continue;

            // Skip buttons with bad keywords
            if (BAD_BUTTON_RE.test(text)) continue;

            // Skip our own UI buttons
            if (/autocontinue|auto.continue|auto.accept/i.test(text)) continue;

            // Match against retry patterns
            for (const rp of RETRY_BUTTON_PATTERNS) {
                if (rp.re.test(text)) {
                    // Bonus: buttons in dialog/notification get +50
                    let bonus = 0;
                    try {
                        if (btn.closest('[role="dialog"], .notification-toast, .notification-list-item, .monaco-dialog-box, .monaco-dialog-modal-block, [class*="notification"], [class*="toast"]')) {
                            bonus = 50;
                        }
                    } catch (e) { }

                    candidates.push({ btn, text: text.slice(0, 80), score: rp.score + bonus, label: rp.re.source.replace(/[\\\b]/g, '') });
                    break;
                }
            }
        }

        candidates.sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
            log(`Found ${candidates.length} retry button(s). Best: "${candidates[0].text}" (score=${candidates[0].score})`);
        }

        return candidates;
    }

    // =================================================================
    // CLICK BUTTON — triple dispatch for maximum reliability
    // =================================================================

    function clickBtn(btn, reason) {
        if (!btn) return false;
        try {
            if (!isVisible(btn)) {
                log(`Button not visible, skipping click`);
                return false;
            }

            const now = Date.now();
            // Guard: don't click the same button within 4 seconds
            try {
                const lastTs = Number(btn.getAttribute('data-ac-ts') || 0);
                if (lastTs > 0 && (now - lastTs) < 4000) {
                    log('Skipping click: too soon since last click on this button');
                    return false;
                }
            } catch (e) { }

            const rect = btn.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;

            // 1. Focus
            try { btn.focus(); } catch (e) { }

            // 2. Pointer events
            try {
                btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
            } catch (e) { }

            // 3. Mouse events
            try {
                btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
                btn.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
            } catch (e) { }

            // 4. Native click
            try { btn.click(); } catch (e) { }

            // Stamp
            try { btn.setAttribute('data-ac-ts', String(now)); } catch (e) { }

            log(`✓ CLICKED: "${getElText(btn).slice(0, 60)}" [${reason}]`);
            return true;
        } catch (e) {
            log(`Click error: ${e.message}`);
            return false;
        }
    }

    // =================================================================
    // COUNTDOWN BADGE UI
    // =================================================================

    const BADGE_ID = '__ac-countdown-badge';

    function showBadge(secs, pattern) {
        try {
            let el = document.getElementById(BADGE_ID);
            if (!el) {
                el = document.createElement('div');
                el.id = BADGE_ID;
                el.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:999998;' +
                    'background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid #00d4aa;' +
                    'border-radius:16px;padding:16px 24px;font-family:system-ui,sans-serif;' +
                    'color:#e6edf3;box-shadow:0 8px 32px rgba(0,212,170,0.3);pointer-events:none;' +
                    'user-select:none;min-width:180px;text-align:center;';
                (document.body || document.documentElement).appendChild(el);
            }
            const safe = (pattern || 'error').replace(/</g, '&lt;').slice(0, 50);
            el.innerHTML =
                '<div style="font-size:10px;color:#8b99a8;letter-spacing:1px;margin-bottom:6px;">⚡ AUTOCONTINUE</div>' +
                '<div style="font-size:11px;color:#ffb2ab;margin-bottom:10px;">' + safe + '</div>' +
                '<div style="font-size:48px;font-weight:800;background:linear-gradient(135deg,#00d4aa,#00e5bf);' +
                    '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;">' +
                    secs + '</div>' +
                '<div style="font-size:11px;color:#8b99a8;margin-top:6px;">Clicking Retry in ' + secs + 's</div>';
        } catch (e) { }
    }

    function hideBadge() {
        try { const el = document.getElementById(BADGE_ID); if (el) el.remove(); } catch (e) { }
    }

    // =================================================================
    // BACKGROUND OVERLAY
    // =================================================================

    const OV_ID = '__ac-bg-overlay';

    function showOverlay() {
        try {
            if (document.getElementById(OV_ID)) return;
            const el = document.createElement('div');
            el.id = OV_ID;
            el.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
                'background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;' +
                'align-items:center;justify-content:center;font-family:system-ui,sans-serif;' +
                'color:#e6edf3;pointer-events:none;user-select:none;backdrop-filter:blur(3px);';
            el.innerHTML =
                '<div style="text-align:center;max-width:440px;padding:32px;">' +
                '<div style="font-size:48px;margin-bottom:16px;animation:acP 2s ease-in-out infinite;">⚡</div>' +
                '<div style="font-size:22px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#00d4aa,#00e5bf);' +
                '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">AutoContinue — Background Mode</div>' +
                '<div style="font-size:13px;color:#8b99a8;margin-bottom:24px;">Scanning for errors and retrying automatically.</div>' +
                '<div style="display:flex;gap:20px;justify-content:center;">' +
                '<div style="text-align:center;padding:12px 20px;background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:12px;">' +
                '<div style="font-size:28px;font-weight:800;color:#00d4aa;" id="__ac-bg-r">0</div>' +
                '<div style="font-size:10px;color:#8b99a8;text-transform:uppercase;margin-top:4px;">Retries</div></div>' +
                '<div style="text-align:center;padding:12px 20px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.2);border-radius:12px;">' +
                '<div style="font-size:28px;font-weight:800;color:#f85149;" id="__ac-bg-e">0</div>' +
                '<div style="font-size:10px;color:#8b99a8;text-transform:uppercase;margin-top:4px;">Errors</div></div>' +
                '<div style="text-align:center;padding:12px 20px;background:rgba(210,153,34,0.08);border:1px solid rgba(210,153,34,0.2);border-radius:12px;">' +
                '<div style="font-size:28px;font-weight:800;color:#d29922;" id="__ac-bg-c">—</div>' +
                '<div style="font-size:10px;color:#8b99a8;text-transform:uppercase;margin-top:4px;">Countdown</div></div>' +
                '</div></div>' +
                '<style>@keyframes acP{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.05);opacity:.7}}</style>';
            (document.body || document.documentElement).appendChild(el);
            log('Overlay mounted');
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
        try { const el = document.getElementById(OV_ID); if (el) el.remove(); } catch (e) { }
    }

    // =================================================================
    // STATE
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
            _interval: null,
            _observer: null,
            _ovInterval: null,
            retryHistory: []
        };
    }

    // =================================================================
    // CORE TICK — called by observer + interval
    // =================================================================

    let _lastTickLog = 0;
    let _tickCount = 0;

    function tick(state) {
        if (!state.isRunning) return;
        if (state.countdownActive) return;

        const now = Date.now();
        if ((now - state.lastRetryAt) < state.retryCooldownMs) return;

        if (state.consecutiveRetries >= state.maxRetries) {
            if (!state.pausedForMaxRetries) {
                log(`Paused: ${state.maxRetries} consecutive retries`);
                state.pausedForMaxRetries = true;
            }
            const e = detectError();
            if (!e.found) {
                state.consecutiveRetries = 0;
                state.pausedForMaxRetries = false;
                log('Error cleared, unpaused');
            }
            return;
        }

        // NOTE: We do NOT check isUserTyping() here because in Antigravity
        // the editor is always a textarea/contentEditable and the check
        // would block ALL scanning permanently.

        _tickCount++;

        // 1. Detect error anywhere on the page
        const error = detectError();

        // Periodic logging (every 30s) to confirm scanning is alive
        if (now - _lastTickLog > 30000) {
            _lastTickLog = now;
            log(`Tick #${_tickCount}: scanning active, error=${error.found ? error.pattern : 'none'}`);
        }

        if (!error.found) {
            if (state.consecutiveRetries > 0 && (now - state.lastRetryAt) > 10000) {
                state.consecutiveRetries = 0;
                state.lastHandledSig = '';
                state.pausedForMaxRetries = false;
            }
            return;
        }

        // 2. Find retry buttons
        const buttons = findRetryButtons();
        if (buttons.length === 0) {
            // Log this once per error detection
            if (error.pattern !== state._lastNoButtonPattern) {
                log(`Error "${error.pattern}" found but no Retry button visible`);
                state._lastNoButtonPattern = error.pattern;
            }
            return;
        }

        // 3. Dedup
        const sig = error.pattern;
        if (sig === state.lastHandledSig && (now - state.lastRetryAt) < state.retryCooldownMs * 2) return;

        state.errorsDetected++;
        state.lastError = error.pattern;

        // 4. Start countdown and click
        doCountdownAndClick(state, error.pattern, buttons[0]);
    }

    // =================================================================
    // COUNTDOWN → CLICK (async, try/finally guarded)
    // =================================================================

    async function doCountdownAndClick(state, pattern, bestMatch) {
        const delay = state.retryDelaySeconds || 5;
        state.countdownActive = true;
        state.countdownSecondsLeft = delay;

        log(`⏱ Countdown: ${delay}s → click "${bestMatch.text}"`);

        try {
            showBadge(delay, pattern);

            for (let i = delay; i >= 1; i--) {
                if (!state.isRunning) {
                    log('Countdown cancelled: extension disabled');
                    return;
                }
                state.countdownSecondsLeft = i;
                showBadge(i, pattern);
                updateOverlay(state);
                log(`⏱ ${i}...`);

                await new Promise(r => setTimeout(r, 1000));
            }

            state.countdownSecondsLeft = 0;
            log('⏱ 0 — clicking now!');

            // Re-find buttons fresh (DOM may have changed)
            const freshButtons = findRetryButtons();
            const target = freshButtons.length > 0 ? freshButtons[0] : bestMatch;

            const ok = clickBtn(target.btn, 'countdown-complete');
            if (ok) {
                state.retries++;
                state.consecutiveRetries++;
                state.lastRetryAt = Date.now();
                state.lastRetryAction = target.label || 'retry';
                state.lastHandledSig = pattern;
                state.retryHistory.push({
                    at: new Date().toISOString(),
                    pattern,
                    action: target.label || 'retry',
                    n: state.consecutiveRetries
                });
                if (state.retryHistory.length > 50) state.retryHistory = state.retryHistory.slice(-50);
                log(`✓ Retry #${state.consecutiveRetries} complete`);
            } else {
                log('✗ Click did not succeed');
            }
        } catch (err) {
            log(`Countdown error: ${err.message || err}`);
        } finally {
            state.countdownActive = false;
            state.countdownSecondsLeft = 0;
            hideBadge();
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
            isRunning: !!s.isRunning,
            isBackgroundMode: !!s.isBackgroundMode,
            pausedForMaxRetries: !!s.pausedForMaxRetries,
            countdownActive: !!s.countdownActive,
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
        state.isBackgroundMode = !!config.isBackgroundMode;
        state.consecutiveRetries = 0;
        state.lastRetryAt = 0;
        state.lastError = '';
        state.lastHandledSig = '';
        state.countdownActive = false;
        state.countdownSecondsLeft = 0;
        state.pausedForMaxRetries = false;

        log(`STARTED v2.2: delay=${state.retryDelaySeconds}s cooldown=${state.retryCooldownMs}ms bg=${state.isBackgroundMode}`);

        // MutationObserver
        if (state._observer) try { state._observer.disconnect(); } catch (e) { }
        try {
            let lastT = 0;
            const obs = new MutationObserver(() => {
                if (!state.isRunning) return;
                const n = Date.now();
                if (n - lastT < 300) return;
                lastT = n;
                tick(state);
            });
            obs.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true });
            state._observer = obs;
            log('MutationObserver active');
        } catch (e) { log('Observer failed: ' + e.message); }

        // Poll fallback (500ms)
        state._interval = setInterval(() => {
            if (state.isRunning) tick(state);
        }, config.pollInterval || 500);
        log('Poll active (' + (config.pollInterval || 500) + 'ms)');

        // Background overlay
        if (state.isBackgroundMode) {
            showOverlay();
            state._ovInterval = setInterval(() => {
                if (state.isRunning && state.isBackgroundMode) updateOverlay(state);
            }, 500);
        } else {
            hideOverlay();
        }

        // Do an immediate scan
        tick(state);

        log('ACTIVE ✓');
    };

    window.__autoContinueStop = function () {
        const state = window.__autoContinueState;
        state.isRunning = false;
        state.countdownActive = false;
        state.countdownSecondsLeft = 0;
        if (state._interval) { clearInterval(state._interval); state._interval = null; }
        if (state._ovInterval) { clearInterval(state._ovInterval); state._ovInterval = null; }
        if (state._observer) { try { state._observer.disconnect(); } catch (e) { } state._observer = null; }
        hideBadge();
        hideOverlay();
        log('STOPPED. Retries: ' + state.retries + ' Errors: ' + state.errorsDetected);
    };

    log('v2.2 Ready');
})();
