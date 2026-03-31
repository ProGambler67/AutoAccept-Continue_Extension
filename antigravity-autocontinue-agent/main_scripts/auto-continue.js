/**
 * Antigravity AutoContinue Agent v2 — Injected DOM Script
 *
 * Bulletproof error detection + auto-retry engine for Antigravity IDE.
 * Detects server errors, rate limits, agent termination popups, and
 * automatically clicks the Retry / Continue button after a visible
 * countdown timer.
 *
 * KEY PRINCIPLES:
 *  1. NEVER type "continue" into the chat input — only click real buttons.
 *  2. Always wait 5 seconds (configurable) with a visible countdown before clicking.
 *  3. If the error disappears during countdown, cancel.
 *  4. Deduplicate — never click the same dialog twice.
 *  5. Work even when Antigravity is in the background / unfocused.
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;
    // Prevent double-injection
    if (window.__autoContinueStart) return;

    const log = (msg) => console.log(`[AutoContinue] ${msg}`);
    log('Script v2 loaded');

    // =================================================================
    // DOM UTILITIES
    // =================================================================

    const getDocuments = (root = document) => {
        let docs = [root];
        try {
            const iframes = root.querySelectorAll('iframe, frame');
            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc) docs.push(...getDocuments(iframeDoc));
                } catch (e) { }
            }
        } catch (e) { }
        return docs;
    };

    const getQueryRoots = (root, roots = []) => {
        if (!root) return roots;
        roots.push(root);
        try {
            const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
            for (const node of nodes) {
                if (node && node.shadowRoot) {
                    getQueryRoots(node.shadowRoot, roots);
                }
            }
        } catch (e) { }
        return roots;
    };

    const queryAll = (selector) => {
        const results = [];
        const seen = new Set();
        getDocuments().forEach(doc => {
            const roots = getQueryRoots(doc);
            roots.forEach(root => {
                try {
                    const nodes = Array.from(root.querySelectorAll(selector));
                    for (const node of nodes) {
                        if (!seen.has(node)) {
                            seen.add(node);
                            results.push(node);
                        }
                    }
                } catch (e) { }
            });
        });
        return results;
    };

    // =================================================================
    // ERROR DETECTION PATTERNS
    // =================================================================

    // Patterns that indicate a real error requiring retry (Antigravity-specific first)
    const ERROR_PATTERNS = [
        // Antigravity agent termination
        'agent execution terminated due to error',
        'terminated due to error',
        'agent has been terminated',
        'execution terminated',
        'agent stopped',
        'agent error',

        // Server capacity / overload
        'server capacity',
        'server traffic too high',
        'server is overloaded',
        'server overloaded',
        'server is busy',
        'at capacity',
        'over capacity',
        'experiencing high demand',
        'high demand',
        'temporarily overloaded',
        'temporarily unavailable',
        'service unavailable',
        'service temporarily unavailable',

        // Rate limiting
        'rate limit',
        'rate limited',
        'rate_limit',
        'too many requests',
        'throttled',
        'quota exceeded',
        'usage limit',
        'limit reached',
        'limit exceeded',

        // Server errors
        'internal server error',
        'server error',
        'bad gateway',
        'gateway timeout',

        // Connection/network errors
        'connection error',
        'connection lost',
        'connection reset',
        'connection refused',
        'connection timeout',
        'connection timed out',
        'network error',
        'network timeout',
        'request failed',
        'request timeout',
        'request timed out',
        'failed to fetch',

        // HTTP codes
        'error 429',
        'error 500',
        'error 502',
        'error 503',
        '429 too many',
        '500 internal',
        '502 bad gateway',
        '503 service',

        // Generation interruption
        'generation stopped',
        'response interrupted',
        'response was interrupted',
        'generation interrupted',
        'continue generating',

        // Generic retry-able errors
        'something went wrong',
        'an error occurred',
        'unexpected error',
        'could not process',
        'unable to process',
        'failed to generate',
        'failed to complete',
        'model unavailable',
        'model is currently',
        'capacity constraints',
        'please try again',
        'please retry',
        'try again'
    ];

    // Text that should NEVER trigger retry (false positive guards)
    const EXCLUSION_PATTERNS = [
        'autocontinue',
        'auto continue',
        'auto accept',
        'error handling',
        'error detection',
        'catch error',
        'throw error',
        'console.error',
        'error boundary',
        'onerror',
        '.catch(',
        'error.message',
        'error code',
        'handle error',
        'debug error'
    ];

    // =================================================================
    // UI CONTAINERS — where real Antigravity errors appear
    // =================================================================

    const ERROR_CONTAINER_SELECTORS = [
        '[role="dialog"]',
        '.notification-toast',
        '.notification-list-item',
        '.monaco-dialog-box',
        '.monaco-dialog-modal-block',
        '.interactive-session',
        '.chat-tool-response',
        '.chat-tool-call',
        '.chat-response',
        '[class*="error"]',
        '[class*="warning"]',
        '[class*="alert"]',
        '[class*="notification"]',
        '[class*="toast"]',
        '[class*="banner"]',
        '[class*="message"]',
        '[class*="response"]',
        '[class*="output"]',
        '.antigravity-agent-side-panel'
    ].join(', ');

    // =================================================================
    // BUTTON DETECTION
    // =================================================================

    const ACTION_NODE_SELECTOR = 'button, [role="button"], a[role="button"]';

    const NEGATIVE_KEYWORDS = [
        'cancel', 'stop', 'reject', 'deny', 'block',
        'disable', 'never', 'discard', 'delete', 'remove',
        'close', 'dismiss', 'no thanks', 'not now', 'abort'
    ];

    // Continue/Retry button text patterns (priority ordered)
    const RETRY_PATTERNS = [
        { pattern: /\bretry\b/i, priority: 100, label: 'retry' },
        { pattern: /\btry\s+again\b/i, priority: 95, label: 'try-again' },
        { pattern: /\bcontinue\s+generating\b/i, priority: 90, label: 'continue-generating' },
        { pattern: /\bcontinue\b/i, priority: 85, label: 'continue' },
        { pattern: /\bregenerate\b/i, priority: 80, label: 'regenerate' },
        { pattern: /\bresend\b/i, priority: 75, label: 'resend' },
        { pattern: /\bresubmit\b/i, priority: 70, label: 'resubmit' },
        { pattern: /\bresume\b/i, priority: 65, label: 'resume' },
        { pattern: /\bproceed\b/i, priority: 60, label: 'proceed' },
        { pattern: /\brestart\b/i, priority: 55, label: 'restart' }
    ];

    function getActionText(el) {
        const text = (el?.textContent || '').trim();
        const title = (el?.title || '').trim();
        const aria = (el?.getAttribute && el.getAttribute('aria-label') || '').trim();
        return `${text} ${title} ${aria}`.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function isNegativeAction(text) {
        return NEGATIVE_KEYWORDS.some(kw => text.includes(kw));
    }

    function isUserTyping() {
        const active = document.activeElement;
        if (!active) return false;
        const tag = (active.tagName || '').toLowerCase();
        if (tag === 'textarea') return true;
        if (tag === 'input') {
            const t = (active.type || '').toLowerCase();
            return !['button', 'submit', 'checkbox', 'radio'].includes(t);
        }
        return !!active.isContentEditable;
    }

    function isExcludedZone(el) {
        if (!el) return true;
        const t = getActionText(el);

        // Never click our own controls
        const controlBlocklist = ['autocontinue', 'auto continue', 'auto accept', 'toggle on/off', 'setup cdp'];
        if (controlBlocklist.some(kw => t.includes(kw))) return true;

        // Never click status bar
        const inStatusBar = !!el.closest('#workbench\\.parts\\.statusbar, .statusbar, .part.statusbar');
        if (inStatusBar) return true;

        // Never click workbench chrome UNLESS inside a dialog/prompt
        const inPromptContext = !!el.closest(
            '[role="dialog"], .notification-toast, .notification-list-item, .monaco-dialog-box, .monaco-dialog-modal-block, .interactive-session, .chat-tool-call, .chat-tool-response, [class*="tool-call"], [data-testid*="tool-call"]'
        );
        const inWorkbenchChrome = !!el.closest(
            '.titlebar, .menubar, .activitybar, .sidebar, .composite.title, .tabs-container, .editor-actions, .action-bar'
        );
        if (inWorkbenchChrome && !inPromptContext) return true;

        return false;
    }

    function isElementVisible(el) {
        if (!el) return false;
        try {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        } catch (e) {
            return false;
        }
    }

    // =================================================================
    // ERROR SCANNING ENGINE
    // =================================================================

    /**
     * Scan only UI containers (dialogs, toasts, notifications) for error patterns.
     * Returns { found, pattern, container, retryButton } or { found: false }.
     */
    function scanForErrors() {
        const containers = queryAll(ERROR_CONTAINER_SELECTORS);

        for (const container of containers) {
            if (!isElementVisible(container)) continue;

            let containerText;
            try {
                containerText = (container.textContent || '').toLowerCase();
            } catch (e) {
                continue;
            }

            // Skip if container text has exclusion patterns (code/documentation)
            const hasExclusion = EXCLUSION_PATTERNS.some(ex => containerText.includes(ex));
            if (hasExclusion) continue;

            // Check for code context — if 3+ code indicators, skip
            const codeIndicators = [
                'function ', 'const ', 'let ', 'var ', 'import ', 'export ',
                'class ', 'return ', 'throw ', 'catch (', 'catch(', '===',
                'console.log', 'console.error', '```', 'def ', 'print('
            ];
            const codeHits = codeIndicators.filter(ind => containerText.includes(ind)).length;
            if (codeHits >= 3) continue;

            // Match error patterns
            for (const pattern of ERROR_PATTERNS) {
                if (containerText.includes(pattern)) {
                    // Found an error! Now look for a retry button inside/near this container
                    const retryButton = findRetryButton(container);
                    return {
                        found: true,
                        pattern,
                        container,
                        retryButton,
                        containerSignature: containerText.slice(0, 200)
                    };
                }
            }
        }

        return { found: false, pattern: '', container: null, retryButton: null, containerSignature: '' };
    }

    /**
     * Find the best Retry/Continue button in or near the given error container.
     */
    function findRetryButton(errorContainer) {
        const searchRoots = [];

        // 1. Search within the error container first
        if (errorContainer) {
            searchRoots.push(errorContainer);
            // Walk up ancestors (the button might be a sibling of the error container)
            let node = errorContainer.parentElement;
            let depth = 0;
            while (node && depth < 8) {
                searchRoots.push(node);
                node = node.parentElement;
                depth++;
            }
        }

        // 2. Also search all dialog/toast containers globally
        const dialogContainers = queryAll(
            '[role="dialog"], .notification-toast, .notification-list-item, ' +
            '.monaco-dialog-box, .monaco-dialog-modal-block, .interactive-session, ' +
            '.chat-tool-call, .chat-tool-response, .antigravity-agent-side-panel'
        );
        searchRoots.push(...dialogContainers);

        // 3. Last resort: search entire body
        if (document.body) searchRoots.push(document.body);

        const candidates = [];
        const seen = new Set();

        for (const root of searchRoots) {
            if (!root) continue;
            try {
                const buttons = Array.from(root.querySelectorAll(ACTION_NODE_SELECTOR));
                for (const btn of buttons) {
                    if (seen.has(btn)) continue;
                    seen.add(btn);

                    const text = getActionText(btn);
                    if (!text) continue;
                    if (isNegativeAction(text)) continue;
                    if (isExcludedZone(btn)) continue;
                    if (!isElementVisible(btn)) continue;

                    // Match against retry patterns
                    for (const rp of RETRY_PATTERNS) {
                        if (rp.pattern.test(text)) {
                            candidates.push({
                                btn,
                                text,
                                priority: rp.priority,
                                label: rp.label,
                                // Bonus: prefer buttons close to the error container
                                nearError: searchRoots.indexOf(root) < 9
                            });
                            break;
                        }
                    }
                }
            } catch (e) { }
        }

        if (candidates.length === 0) return null;

        // Sort: near-error first, then by priority
        candidates.sort((a, b) => {
            if (a.nearError !== b.nearError) return a.nearError ? -1 : 1;
            return b.priority - a.priority;
        });

        return candidates[0];
    }

    /**
     * Actually click a button using both .click() and MouseEvent dispatch for reliability.
     */
    function clickButton(el, reason = '') {
        if (!el) return false;

        try {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;

            // Double-click guard
            const now = Date.now();
            const lastClickedAt = Number(el.getAttribute && el.getAttribute('data-ac-clicked-at') || 0);
            if (lastClickedAt > 0 && (now - lastClickedAt) < 3000) {
                return false;
            }

            // Click using both methods for maximum reliability
            if (typeof el.click === 'function') {
                el.click();
            }
            el.dispatchEvent(new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            }));

            try {
                el.setAttribute('data-ac-clicked-at', String(now));
            } catch (e) { }

            log(`Clicked "${getActionText(el).slice(0, 80)}" [${reason}]`);
            return true;
        } catch (e) {
            log(`Click failed: ${e.message}`);
            return false;
        }
    }

    // =================================================================
    // COUNTDOWN TIMER UI
    // =================================================================

    const COUNTDOWN_ID = '__autocontinue-countdown';

    function mountCountdownBadge(seconds, errorPattern) {
        removeCountdownBadge();

        const badge = document.createElement('div');
        badge.id = COUNTDOWN_ID;
        badge.style.cssText = [
            'position: fixed',
            'bottom: 60px',
            'right: 20px',
            'z-index: 999998',
            'background: linear-gradient(135deg, #1a1a2e, #16213e)',
            'border: 2px solid #00d4aa',
            'border-radius: 16px',
            'padding: 16px 24px',
            'font-family: "Segoe UI", system-ui, -apple-system, sans-serif',
            'color: #e6edf3',
            'box-shadow: 0 8px 32px rgba(0, 212, 170, 0.3), 0 0 60px rgba(0, 212, 170, 0.1)',
            'pointer-events: none',
            'user-select: none',
            'animation: acFadeIn 0.3s ease-out',
            'min-width: 200px',
            'text-align: center'
        ].join(';');

        badge.innerHTML = `
            <div style="font-size: 11px; color: #8b99a8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                ⚡ AutoContinue
            </div>
            <div style="font-size: 12px; color: #ffb2ab; margin-bottom: 12px; max-width: 220px; word-break: break-word;">
                ${escapeHtml(errorPattern).slice(0, 60)}
            </div>
            <div id="__ac-countdown-number" style="
                font-size: 48px;
                font-weight: 800;
                background: linear-gradient(135deg, #00d4aa, #00e5bf);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                line-height: 1;
                margin-bottom: 8px;
            ">${seconds}</div>
            <div style="font-size: 11px; color: #8b99a8;">
                Retrying in <span id="__ac-countdown-text">${seconds}</span>s...
            </div>
            <div style="margin-top: 10px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div id="__ac-countdown-bar" style="
                    height: 100%;
                    width: 100%;
                    background: linear-gradient(90deg, #00d4aa, #00e5bf);
                    border-radius: 2px;
                    transition: width 1s linear;
                "></div>
            </div>
            <style>
                @keyframes acFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        `;

        (document.body || document.documentElement).appendChild(badge);
    }

    function updateCountdownBadge(secondsLeft, totalSeconds) {
        const numEl = document.getElementById('__ac-countdown-number');
        const textEl = document.getElementById('__ac-countdown-text');
        const barEl = document.getElementById('__ac-countdown-bar');
        if (numEl) numEl.textContent = String(secondsLeft);
        if (textEl) textEl.textContent = String(secondsLeft);
        if (barEl) {
            const pct = Math.max(0, (secondsLeft / totalSeconds) * 100);
            barEl.style.width = pct + '%';
        }
    }

    function removeCountdownBadge() {
        const badge = document.getElementById(COUNTDOWN_ID);
        if (badge) badge.remove();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // =================================================================
    // BACKGROUND MODE OVERLAY
    // =================================================================

    const OVERLAY_ID = '__autocontinue-bg-overlay';

    function mountOverlay(state) {
        if (document.getElementById(OVERLAY_ID)) return;

        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'width: 100vw',
            'height: 100vh',
            'background: rgba(0, 0, 0, 0.85)',
            'z-index: 999999',
            'display: flex',
            'flex-direction: column',
            'align-items: center',
            'justify-content: center',
            'font-family: "Segoe UI", system-ui, -apple-system, sans-serif',
            'color: #e6edf3',
            'pointer-events: none',
            'user-select: none',
            'backdrop-filter: blur(3px)'
        ].join(';');

        overlay.innerHTML = `
            <div style="text-align:center; max-width:460px; padding:32px;">
                <div style="font-size:52px; margin-bottom:16px; animation: acPulse 2s ease-in-out infinite;">⚡</div>
                <div style="font-size:24px; font-weight:700; margin-bottom:8px;
                    background: linear-gradient(135deg, #00d4aa, #00e5bf);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    background-clip: text;">AutoContinue — Background Mode</div>
                <div style="font-size:13px; color: #8b99a8; margin-bottom:28px; line-height: 1.5;">
                    Scanning for errors continuously.<br/>
                    Errors are retried automatically after a 5s countdown.
                </div>
                <div style="display:flex; gap:24px; justify-content:center; margin-bottom:24px;">
                    <div style="text-align:center; padding: 12px 20px; background: rgba(0,212,170,0.08); border: 1px solid rgba(0,212,170,0.2); border-radius: 12px;">
                        <div style="font-size:32px; font-weight:800; color:#00d4aa;" id="__ac-bg-retries">0</div>
                        <div style="font-size:10px; color:#8b99a8; text-transform:uppercase; letter-spacing:0.8px; margin-top:4px;">Retries</div>
                    </div>
                    <div style="text-align:center; padding: 12px 20px; background: rgba(248,81,73,0.08); border: 1px solid rgba(248,81,73,0.2); border-radius: 12px;">
                        <div style="font-size:32px; font-weight:800; color:#f85149;" id="__ac-bg-errors">0</div>
                        <div style="font-size:10px; color:#8b99a8; text-transform:uppercase; letter-spacing:0.8px; margin-top:4px;">Errors</div>
                    </div>
                    <div style="text-align:center; padding: 12px 20px; background: rgba(210,153,34,0.08); border: 1px solid rgba(210,153,34,0.2); border-radius: 12px;">
                        <div style="font-size:32px; font-weight:800; color:#d29922;" id="__ac-bg-countdown">—</div>
                        <div style="font-size:10px; color:#8b99a8; text-transform:uppercase; letter-spacing:0.8px; margin-top:4px;">Next Retry</div>
                    </div>
                </div>
                <div style="font-size:11px; color:#555; padding:10px 18px;
                    border: 1px solid #1e2a3a; border-radius:8px; background: rgba(0,0,0,0.3);">
                    Press <kbd style="background:#1e2a3a; padding:2px 6px; border-radius:4px; color:#8b99a8;">Ctrl+Shift+B</kbd> to exit background mode
                </div>
            </div>
            <style>
                @keyframes acPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.7; } }
            </style>
        `;

        (document.body || document.documentElement).appendChild(overlay);
        log('Background mode overlay mounted');
    }

    function updateOverlayStats(state) {
        const retriesEl = document.getElementById('__ac-bg-retries');
        const errorsEl = document.getElementById('__ac-bg-errors');
        const countdownEl = document.getElementById('__ac-bg-countdown');
        if (retriesEl) retriesEl.textContent = String(state.retries || 0);
        if (errorsEl) errorsEl.textContent = String(state.errorsDetected || 0);
        if (countdownEl) {
            if (state.countdownSecondsLeft > 0) {
                countdownEl.textContent = state.countdownSecondsLeft + 's';
                countdownEl.style.color = '#d29922';
            } else {
                countdownEl.textContent = '—';
                countdownEl.style.color = '#d29922';
            }
        }
    }

    function dismountOverlay() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            overlay.remove();
            log('Background mode overlay removed');
        }
    }

    // =================================================================
    // COUNTDOWN + RETRY ENGINE
    // =================================================================

    /**
     * Called when an error is detected. Starts a countdown, then clicks retry.
     * If error disappears during countdown, cancels.
     */
    async function startRetryCountdown(state, scanResult) {
        if (state.countdownActive) return; // Already counting down
        if (!scanResult.found || !scanResult.retryButton) return;

        const delaySeconds = state.retryDelaySeconds || 5;
        const errorSig = scanResult.containerSignature || scanResult.pattern;

        // Check deduplication — don't retry the same error twice in quick succession
        if (errorSig === state.lastHandledSignature && (Date.now() - state.lastRetryAt) < state.retryCooldownMs * 2) {
            return;
        }

        state.countdownActive = true;
        state.countdownSecondsLeft = delaySeconds;
        state.errorsDetected++;
        state.lastError = scanResult.pattern;
        state.lastErrorDetectedAt = Date.now();

        log(`Error detected: "${scanResult.pattern}" — starting ${delaySeconds}s countdown`);

        // Mount countdown badge
        mountCountdownBadge(delaySeconds, scanResult.pattern);

        for (let i = delaySeconds; i > 0; i--) {
            if (!state.isRunning) {
                // Extension was disabled during countdown
                removeCountdownBadge();
                state.countdownActive = false;
                state.countdownSecondsLeft = 0;
                log('Countdown cancelled: extension disabled');
                return;
            }

            state.countdownSecondsLeft = i;
            updateCountdownBadge(i, delaySeconds);
            updateOverlayStats(state);

            await new Promise(r => setTimeout(r, 1000));

            // Re-check: did the error disappear?
            const recheck = scanForErrors();
            if (!recheck.found) {
                removeCountdownBadge();
                state.countdownActive = false;
                state.countdownSecondsLeft = 0;
                log('Countdown cancelled: error resolved on its own');
                // Reset consecutive retries since the error cleared
                state.consecutiveRetries = 0;
                state.lastHandledSignature = '';
                return;
            }
        }

        // Countdown finished — click the retry button
        state.countdownSecondsLeft = 0;
        updateCountdownBadge(0, delaySeconds);
        removeCountdownBadge();

        // Re-scan to get the freshest button reference (DOM may have changed)
        const finalScan = scanForErrors();
        if (finalScan.found && finalScan.retryButton) {
            const success = clickButton(finalScan.retryButton.btn, `auto-${finalScan.retryButton.label}`);
            if (success) {
                state.retries++;
                state.consecutiveRetries++;
                state.lastRetryAt = Date.now();
                state.lastRetryAction = finalScan.retryButton.label;
                state.lastHandledSignature = errorSig;
                state.retryHistory.push({
                    at: new Date().toISOString(),
                    pattern: finalScan.pattern,
                    action: finalScan.retryButton.label,
                    consecutive: state.consecutiveRetries
                });
                // Keep only last 50 entries
                if (state.retryHistory.length > 50) {
                    state.retryHistory = state.retryHistory.slice(-50);
                }
                log(`Retry #${state.consecutiveRetries}: clicked "${finalScan.retryButton.text.slice(0, 60)}" [${finalScan.retryButton.label}]`);
            }
        } else {
            log('Countdown finished but retry button is gone — skipping click');
        }

        state.countdownActive = false;
        updateOverlayStats(state);
    }

    // =================================================================
    // MAIN SCAN LOOP
    // =================================================================

    function runScan(state) {
        if (!state.isRunning) return;

        const now = Date.now();

        // Don't scan while countdown is active
        if (state.countdownActive) return;

        // Respect cooldown after a retry
        if ((now - state.lastRetryAt) < state.retryCooldownMs) return;

        // Check max consecutive retries
        if (state.consecutiveRetries >= state.maxRetries) {
            if (!state.pausedForMaxRetries) {
                log(`Paused: reached ${state.maxRetries} consecutive retries. Will resume when error clears.`);
                state.pausedForMaxRetries = true;
            }
            // Still scan to detect when error clears
            const check = scanForErrors();
            if (!check.found) {
                log('Error cleared. Resetting retry counter.');
                state.consecutiveRetries = 0;
                state.pausedForMaxRetries = false;
                state.lastHandledSignature = '';
            }
            return;
        }

        // Don't interfere while user is typing
        if (isUserTyping()) return;

        // Scan for errors
        const result = scanForErrors();

        if (!result.found) {
            // No error — reset consecutive retry counter after a safe period
            if (state.consecutiveRetries > 0 && (now - state.lastRetryAt) > 10000) {
                log(`Error cleared after ${state.consecutiveRetries} retries. Resetting counter.`);
                state.consecutiveRetries = 0;
                state.lastHandledSignature = '';
                state.pausedForMaxRetries = false;
            }
            return;
        }

        // Error found and we have a retry button — start countdown
        if (result.retryButton) {
            startRetryCountdown(state, result);
        } else {
            // Error found but no retry button — log it periodically
            if (!state._lastNoButtonLogAt || (now - state._lastNoButtonLogAt) > 10000) {
                log(`Error "${result.pattern}" detected but no retry/continue button found nearby.`);
                state._lastNoButtonLogAt = now;
            }
        }
    }

    // =================================================================
    // STATE AND PUBLIC API
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
            lastHandledSignature: '',
            lastErrorDetectedAt: 0,
            lastScanAt: 0,
            pausedForMaxRetries: false,
            pollInterval: 500,
            countdownActive: false,
            countdownSecondsLeft: 0,
            clickInterval: null,
            domObserver: null,
            overlayUpdateInterval: null,
            retryHistory: [],
            _lastNoButtonLogAt: 0
        };
    }

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

        // Stop previous run if already running
        if (state.isRunning) {
            log('Already running, restarting...');
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
        state.lastHandledSignature = '';
        state.lastErrorDetectedAt = 0;
        state.pausedForMaxRetries = false;
        state.countdownActive = false;
        state.countdownSecondsLeft = 0;
        state._lastNoButtonLogAt = 0;

        log(`Starting v2: delay=${state.retryDelaySeconds}s, maxRetries=${state.maxRetries}, cooldown=${state.retryCooldownMs}ms, poll=${state.pollInterval}ms`);

        // DOM MutationObserver for instant error detection
        if (state.domObserver) {
            try { state.domObserver.disconnect(); } catch (e) { }
            state.domObserver = null;
        }

        try {
            const observer = new MutationObserver(() => {
                if (!state.isRunning) return;
                const now = Date.now();
                // Throttle: max 1 scan per 200ms
                if (now - (state.lastScanAt || 0) < 200) return;
                state.lastScanAt = now;
                runScan(state);
            });

            observer.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: false
            });
            state.domObserver = observer;
            log('DOM observer started');
        } catch (e) {
            log(`DOM observer unavailable: ${e.message}`);
        }

        // Fallback poll loop
        state.clickInterval = setInterval(() => {
            if (state.isRunning) {
                runScan(state);
            }
        }, state.pollInterval);

        log(`Poll loop started (${state.pollInterval}ms)`);

        // Background mode overlay
        if (state.isBackgroundMode) {
            mountOverlay(state);
            state.overlayUpdateInterval = setInterval(() => {
                if (state.isRunning && state.isBackgroundMode) {
                    updateOverlayStats(state);
                }
            }, 500);
        } else {
            dismountOverlay();
        }

        log('AutoContinue v2 is ACTIVE' + (state.isBackgroundMode ? ' [BACKGROUND MODE]' : ''));
    };

    window.__autoContinueStop = function () {
        const state = window.__autoContinueState;
        state.isRunning = false;
        state.countdownActive = false;
        state.countdownSecondsLeft = 0;

        if (state.clickInterval) {
            clearInterval(state.clickInterval);
            state.clickInterval = null;
        }

        if (state.overlayUpdateInterval) {
            clearInterval(state.overlayUpdateInterval);
            state.overlayUpdateInterval = null;
        }

        if (state.domObserver) {
            try { state.domObserver.disconnect(); } catch (e) { }
            state.domObserver = null;
        }

        removeCountdownBadge();
        dismountOverlay();

        log(`Stopped. Total retries: ${state.retries}, errors detected: ${state.errorsDetected}`);
    };

    log('v2 Ready');
})();
