/**
 * Antigravity AutoContinue Agent - Injected DOM Script
 * 
 * Bulletproof error detection + auto-retry engine.
 * Detects server errors, rate limits, network issues, and interrupted flows,
 * then automatically clicks Continue/Retry or sends a "continue" message.
 */
(function() {
    'use strict';

    if (typeof window === 'undefined') return;
    // Prevent double-injection
    if (window.__autoContinueStart) return;

    const log = (msg) => console.log(`[AutoContinue] ${msg}`);
    log('Script loaded');

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

    // Patterns that indicate a server/network error requiring retry
    const ERROR_PATTERNS = [
        // Server overload / rate limiting
        'server traffic too high',
        'rate limit',
        'rate limited',
        'rate_limit',
        'too many requests',
        'throttled',
        'quota exceeded',
        'usage limit',
        'request limit',
        'limit reached',
        'limit exceeded',

        // Server errors
        'service unavailable',
        'service temporarily unavailable',
        'server error',
        'internal server error',
        'server overloaded',
        'server is overloaded',
        'server is busy',
        'temporarily unavailable',
        'overloaded',
        'at capacity',
        'over capacity',

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
        'fetch failed',
        'failed to fetch',

        // HTTP status codes in error messages
        'error 429',
        'error 500',
        'error 502',
        'error 503',
        'status 429',
        'status 500',
        'status 502',
        'status 503',
        'http 429',
        'http 500',
        'http 502',
        'http 503',
        '429 too many',
        '500 internal',
        '502 bad gateway',
        '503 service',

        // Agent execution errors
        'agent execution terminated due to error',
        'terminated due to error',
        'execution error',
        'execution terminated',
        'agent error',
        'agent stopped',
        'generation stopped',
        'response interrupted',
        'response was interrupted',
        'generation interrupted',
        'output was cut off',
        'output truncated',

        // Flow interruption
        'continue generating',
        'try again',
        'please try again',
        'please retry',
        'something went wrong',
        'an error occurred',
        'unexpected error',
        'unknown error',

        // Antigravity/Claude-specific
        'could not process',
        'unable to process',
        'failed to generate',
        'failed to complete',
        'capacity constraints',
        'experiencing high demand',
        'high demand',
        'model is currently',
        'model unavailable',
        'temporarily overloaded',
        'bad gateway',
        'gateway timeout'
    ];

    // Patterns that should NOT trigger retry (false positives)
    const ERROR_EXCLUSION_PATTERNS = [
        'auto accept',
        'autocontinue',
        'auto continue',
        'error handling',
        'error detection',
        'try again later if',    // documentation text
        'catch error',
        'throw error',
        'console.error',
        'error boundary',
        'onerror',
        '.catch(',
        'error.message',
        'error code',
        'error log',
        'handle error',
        'debug error'
    ];

    // =================================================================
    // BUTTON/ACTION DETECTION
    // =================================================================

    const ACTION_NODE_SELECTOR = 'button, [role="button"], a[role="button"]';

    const NEGATIVE_KEYWORDS = [
        'cancel', 'stop', 'reject', 'deny', 'block',
        'disable', 'never', 'discard', 'delete', 'remove',
        'close', 'dismiss', 'no thanks', 'not now'
    ];

    // Continue/Retry button text patterns (priority ordered)
    const CONTINUE_PATTERNS = [
        { pattern: /\bcontinue\s+generating\b/i, priority: 100, label: 'continue-generating' },
        { pattern: /\bcontinue\b/i, priority: 90, label: 'continue' },
        { pattern: /\bretry\b/i, priority: 85, label: 'retry' },
        { pattern: /\btry\s+again\b/i, priority: 80, label: 'try-again' },
        { pattern: /\bregenerate\b/i, priority: 75, label: 'regenerate' },
        { pattern: /\bresend\b/i, priority: 70, label: 'resend' },
        { pattern: /\bresubmit\b/i, priority: 65, label: 'resubmit' },
        { pattern: /\bresume\b/i, priority: 60, label: 'resume' },
        { pattern: /\bproceed\b/i, priority: 55, label: 'proceed' },
        { pattern: /\brestart\b/i, priority: 50, label: 'restart' }
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

        // Never click our own controls or status bar items
        const controlBlocklist = ['autocontinue', 'auto continue', 'auto accept', 'toggle on/off', 'setup cdp'];
        if (controlBlocklist.some(kw => t.includes(kw))) return true;

        // Never click status bar
        const inStatusBar = !!el.closest('#workbench\\.parts\\.statusbar, .statusbar, .part.statusbar');
        if (inStatusBar) return true;

        // Never click workbench chrome (title bar, menu bar, sidebar, tabs) unless inside a prompt
        const inPromptContext = !!el.closest(
            '[role="dialog"], .notification-toast, .notification-list-item, .monaco-dialog-box, .monaco-dialog-modal-block, .interactive-session, .chat-tool-call, .chat-tool-response, [class*="tool-call"], [data-testid*="tool-call"]'
        );
        const inWorkbenchChrome = !!el.closest(
            '.titlebar, .menubar, .activitybar, .sidebar, .composite.title, .tabs-container, .editor-actions, .action-bar'
        );
        if (inWorkbenchChrome && !inPromptContext) return true;

        return false;
    }

    // =================================================================
    // ERROR SCANNING ENGINE
    // =================================================================

    function getVisibleBodyText() {
        const texts = [];
        for (const doc of getDocuments()) {
            try {
                const body = doc.body;
                if (body && body.textContent) {
                    texts.push(body.textContent.toLowerCase());
                }
            } catch (e) { }
        }
        return texts.join(' ');
    }

    function detectError(bodyText) {
        const text = bodyText || getVisibleBodyText();

        // Check exclusion patterns first — if the text is code/docs about errors, skip
        for (const excl of ERROR_EXCLUSION_PATTERNS) {
            // Only exclude if the exclusion pattern appears very close to the error pattern
            // This is a rough heuristic
        }

        for (const pattern of ERROR_PATTERNS) {
            if (text.includes(pattern)) {
                // Verify this isn't inside a code block or documentation reference
                // by checking if there's a matching error in a prominent UI element
                const errorInUI = findErrorInUIElements(pattern);
                if (errorInUI) {
                    return { found: true, pattern, element: errorInUI };
                }

                // Also match if the raw body text has the error very prominently
                // (long pages may have the error in non-UI text too, but check context)
                const contextWindow = getErrorContext(text, pattern);
                if (!isCodeOrDocContext(contextWindow)) {
                    return { found: true, pattern, element: null };
                }
            }
        }

        return { found: false, pattern: '', element: null };
    }

    function findErrorInUIElements(pattern) {
        // Search for the error text in prominent UI containers
        const uiSelectors = [
            '.notification-toast',
            '.notification-list-item',
            '[role="dialog"]',
            '.monaco-dialog-box',
            '.monaco-dialog-modal-block',
            '.chat-tool-response',
            '.chat-tool-call',
            '[class*="error"]',
            '[class*="warning"]',
            '[class*="alert"]',
            '[class*="message"]',
            '[class*="notification"]',
            '[class*="toast"]',
            '[class*="banner"]',
            '.interactive-session',
            '.chat-response',
            '[class*="response"]',
            '[class*="output"]',
            '.antigravity-agent-side-panel'
        ];

        for (const selector of uiSelectors) {
            const elements = queryAll(selector);
            for (const el of elements) {
                try {
                    const elText = (el.textContent || '').toLowerCase();
                    if (elText.includes(pattern)) {
                        // Make sure this element is visible
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            return el;
                        }
                    }
                } catch (e) { }
            }
        }

        return null;
    }

    function getErrorContext(text, pattern) {
        const idx = text.indexOf(pattern);
        if (idx < 0) return '';
        const start = Math.max(0, idx - 200);
        const end = Math.min(text.length, idx + pattern.length + 200);
        return text.slice(start, end);
    }

    function isCodeOrDocContext(context) {
        if (!context) return false;
        // If the context has strong code indicators, it's likely code/documentation
        const codeIndicators = [
            'function ', 'const ', 'let ', 'var ', 'import ', 'export ',
            'class ', 'return ', 'throw ', 'catch (', 'catch(', '===', '!==',
            'console.log', 'console.error', 'if (', 'if(',
            '```', 'def ', 'print(', 'raise ', 'except ', 'try:', 'catch:'
        ];
        const codeHits = codeIndicators.filter(ind => context.includes(ind)).length;
        return codeHits >= 3; // Strong code context needs 3+ indicators
    }

    // =================================================================
    // AUTO-CONTINUE ACTIONS
    // =================================================================

    function findContinueButton(errorElement) {
        // Search for continue/retry buttons near the error or globally in prompt containers
        const searchRoots = [];

        // 1. If we have an error element, search its ancestors for buttons
        if (errorElement) {
            let node = errorElement;
            let depth = 0;
            while (node && depth < 12) {
                searchRoots.push(node);
                node = node.parentElement;
                depth++;
            }
        }

        // 2. Also search all prompt containers globally
        const promptContainers = queryAll(
            '[role="dialog"], .notification-toast, .notification-list-item, ' +
            '.monaco-dialog-box, .monaco-dialog-modal-block, .interactive-session, ' +
            '.chat-tool-call, .chat-tool-response, [class*="tool-call"], ' +
            '[data-testid*="tool-call"], .antigravity-agent-side-panel'
        );
        searchRoots.push(...promptContainers);

        // 3. Search entire document as last resort
        searchRoots.push(document.body);

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

                    // Check visibility
                    const rect = btn.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) continue;

                    // Match against continue patterns
                    for (const cp of CONTINUE_PATTERNS) {
                        if (cp.pattern.test(text)) {
                            candidates.push({
                                btn,
                                text,
                                priority: cp.priority,
                                label: cp.label,
                                nearError: searchRoots.indexOf(root) < (errorElement ? 12 : 0)
                            });
                            break; // Only match first pattern per button
                        }
                    }
                }
            } catch (e) { }
        }

        if (candidates.length === 0) return null;

        // Sort by priority (highest first), prefer buttons near the error
        candidates.sort((a, b) => {
            if (a.nearError !== b.nearError) return a.nearError ? -1 : 1;
            return b.priority - a.priority;
        });

        return candidates[0];
    }

    function clickButton(el, reason = '') {
        if (!el) return false;

        try {
            const now = Date.now();
            const lastClickedAt = Number(el.getAttribute && el.getAttribute('data-ac-clicked-at') || 0);
            if (lastClickedAt > 0 && (now - lastClickedAt) < 2000) {
                return false; // Already clicked very recently
            }

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;

            // Click using both methods for reliability
            if (typeof el.click === 'function') {
                el.click();
            }
            el.dispatchEvent(new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
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

    function trySendContinueMessage() {
        // Last resort: find the chat input, type "continue", and submit
        const inputSelectors = [
            'textarea[class*="chat"]',
            'textarea[class*="input"]',
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="chat"]',
            'textarea[placeholder*="ask"]',
            'textarea[placeholder*="type"]',
            '.chat-input textarea',
            '.input-area textarea',
            '[class*="composer"] textarea',
            '[class*="message-input"] textarea',
            'textarea'
        ];

        for (const selector of inputSelectors) {
            const inputs = queryAll(selector);
            for (const input of inputs) {
                try {
                    const rect = input.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) continue;

                    // Check it's not in an excluded zone
                    if (isExcludedZone(input)) continue;

                    // Don't overwrite if user has typed something
                    if (input.value && input.value.trim().length > 0) continue;

                    // Focus and type "continue"
                    input.focus();
                    input.value = 'continue';

                    // Trigger React-compatible input events
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLTextAreaElement.prototype, 'value'
                    )?.set;
                    if (nativeInputValueSetter) {
                        nativeInputValueSetter.call(input, 'continue');
                    }
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));

                    // Brief delay then submit with Enter
                    setTimeout(() => {
                        try {
                            input.dispatchEvent(new KeyboardEvent('keydown', {
                                key: 'Enter', code: 'Enter', keyCode: 13,
                                which: 13, bubbles: true, cancelable: true
                            }));
                            input.dispatchEvent(new KeyboardEvent('keypress', {
                                key: 'Enter', code: 'Enter', keyCode: 13,
                                which: 13, bubbles: true, cancelable: true
                            }));
                            input.dispatchEvent(new KeyboardEvent('keyup', {
                                key: 'Enter', code: 'Enter', keyCode: 13,
                                which: 13, bubbles: true, cancelable: true
                            }));
                            log('Sent "continue" message via chat input');
                        } catch (e) {
                            log(`Submit keystroke failed: ${e.message}`);
                        }
                    }, 150);

                    return true;
                } catch (e) { }
            }
        }

        return false;
    }

    // =================================================================
    // MAIN SCAN LOOP
    // =================================================================

    function runScan(state) {
        if (!state.isRunning) return;

        const now = Date.now();

        // Respect cooldown
        if ((now - state.lastRetryAt) < state.retryCooldownMs) {
            return;
        }

        // Check max consecutive retries
        if (state.consecutiveRetries >= state.maxRetries) {
            if (!state.pausedForMaxRetries) {
                log(`Paused: reached ${state.maxRetries} consecutive retries. Will resume on next successful generation.`);
                state.pausedForMaxRetries = true;
            }
            // Still scan to detect when the error clears
            const bodyText = getVisibleBodyText();
            const error = detectError(bodyText);
            if (!error.found) {
                log('Error cleared. Resetting retry counter.');
                state.consecutiveRetries = 0;
                state.pausedForMaxRetries = false;
                state.lastErrorSignature = '';
            }
            return;
        }

        // Don't interfere while user is typing
        if (isUserTyping()) return;

        // Scan for errors
        const bodyText = getVisibleBodyText();
        const error = detectError(bodyText);

        if (!error.found) {
            // No error — if we had consecutive retries, reset them (success!)
            if (state.consecutiveRetries > 0 && (now - state.lastRetryAt) > 10000) {
                log(`Error cleared after ${state.consecutiveRetries} retries. Resetting counter.`);
                state.consecutiveRetries = 0;
                state.lastErrorSignature = '';
                state.pausedForMaxRetries = false;
            }
            return;
        }

        // Error found! Check if it's the same error we already handled
        const errorSignature = error.pattern + ':' + (error.element ? error.element.textContent?.slice(0, 100) : 'no-el');
        if (errorSignature === state.lastErrorSignature && (now - state.lastRetryAt) < state.retryCooldownMs * 2) {
            return; // Same error, wait longer before re-trying
        }

        state.errorsDetected++;
        state.lastError = error.pattern;
        state.lastErrorDetectedAt = now;
        log(`Error detected: "${error.pattern}"`);

        // Try to find and click a Continue/Retry button
        const continueBtn = findContinueButton(error.element);
        if (continueBtn) {
            if (clickButton(continueBtn.btn, `auto-${continueBtn.label}`)) {
                state.retries++;
                state.consecutiveRetries++;
                state.lastRetryAt = now;
                state.lastRetryAction = continueBtn.label;
                state.lastErrorSignature = errorSignature;
                log(`Retry #${state.consecutiveRetries}: clicked "${continueBtn.text.slice(0, 60)}" [${continueBtn.label}]`);
                return;
            }
        }

        // No button found — try sending "continue" as a chat message
        if (trySendContinueMessage()) {
            state.retries++;
            state.consecutiveRetries++;
            state.lastRetryAt = now;
            state.lastRetryAction = 'chat-continue';
            state.lastErrorSignature = errorSignature;
            log(`Retry #${state.consecutiveRetries}: sent "continue" via chat input`);
            return;
        }

        // Nothing worked — log it
        if (!state._lastNoActionLogAt || (now - state._lastNoActionLogAt) > 10000) {
            log(`Error "${error.pattern}" detected but no actionable continue/retry button found.`);
            state._lastNoActionLogAt = now;
        }
    }

    // =================================================================
    // STATE AND PUBLIC API
    // =================================================================

    if (!window.__autoContinueState) {
        window.__autoContinueState = {
            isRunning: false,
            sessionID: 0,
            retries: 0,
            errorsDetected: 0,
            consecutiveRetries: 0,
            maxRetries: 50,
            retryCooldownMs: 3000,
            lastRetryAt: 0,
            lastRetryAction: '',
            lastError: '',
            lastErrorSignature: '',
            lastErrorDetectedAt: 0,
            lastScanAt: 0,
            pausedForMaxRetries: false,
            pollInterval: 500,
            clickInterval: null,
            domObserver: null,
            _lastNoActionLogAt: 0
        };
    }

    window.__autoContinueGetStats = function() {
        const s = window.__autoContinueState;
        return {
            retries: s.retries || 0,
            errorsDetected: s.errorsDetected || 0,
            consecutiveRetries: s.consecutiveRetries || 0,
            lastError: s.lastError || '',
            lastRetryAction: s.lastRetryAction || '',
            lastRetryAt: s.lastRetryAt ? new Date(s.lastRetryAt).toISOString() : '',
            isRunning: s.isRunning,
            pausedForMaxRetries: s.pausedForMaxRetries || false
        };
    };

    window.__autoContinueStart = function(config) {
        const state = window.__autoContinueState;

        // Stop previous run if already running
        if (state.isRunning) {
            log('Already running, restarting...');
            window.__autoContinueStop();
        }

        state.isRunning = true;
        state.sessionID++;
        state.maxRetries = config.maxRetries || 50;
        state.retryCooldownMs = config.retryCooldownMs || 3000;
        state.pollInterval = config.pollInterval || 500;
        state.consecutiveRetries = 0;
        state.lastRetryAt = 0;
        state.lastRetryAction = '';
        state.lastError = '';
        state.lastErrorSignature = '';
        state.lastErrorDetectedAt = 0;
        state.pausedForMaxRetries = false;
        state._lastNoActionLogAt = 0;

        log(`Starting with maxRetries=${state.maxRetries}, cooldown=${state.retryCooldownMs}ms, poll=${state.pollInterval}ms`);

        // DOM MutationObserver for instant error detection
        if (state.domObserver) {
            try { state.domObserver.disconnect(); } catch (e) { }
            state.domObserver = null;
        }

        try {
            const observer = new MutationObserver(() => {
                if (!state.isRunning) return;
                const now = Date.now();
                // Throttle: max 1 scan per 150ms
                if (now - (state.lastScanAt || 0) < 150) return;
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
        log('AutoContinue is ACTIVE');
    };

    window.__autoContinueStop = function() {
        const state = window.__autoContinueState;
        state.isRunning = false;

        if (state.clickInterval) {
            clearInterval(state.clickInterval);
            state.clickInterval = null;
        }

        if (state.domObserver) {
            try { state.domObserver.disconnect(); } catch (e) { }
            state.domObserver = null;
        }

        log(`Stopped. Total retries: ${state.retries}, errors detected: ${state.errorsDetected}`);
    };

    log('Ready');
})();
