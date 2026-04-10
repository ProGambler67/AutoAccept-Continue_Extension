(function (root, factory) {
    const api = factory();

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.AutoContinueRecoveryCore = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const DEFAULT_PROCESSING_DELAY_SECONDS = 5;
    const FOREGROUND_SCAN_INTERVAL_MS = 250;
    const REMOTE_POLL_INTERVAL_MS = 1000;
    const CDP_RESCAN_INTERVAL_MS = 1500;
    const CONTROL_PANEL_REFRESH_INTERVAL_MS = 2000;

    const BUSY_PATTERNS = [
        "agent hasn't processed previous input",
        'agent hasnt processed previous input',
        'agent has not processed previous input',
        'previous input is still being processed',
        'previous input is still processing',
        'still processing previous input',
        'wait for the previous input to finish',
        'please wait for the current input to finish'
    ];

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeProcessingDelaySeconds(value, fallback = DEFAULT_PROCESSING_DELAY_SECONDS) {
        const numericFallback = Number.isFinite(Number(fallback))
            ? Math.trunc(Number(fallback))
            : DEFAULT_PROCESSING_DELAY_SECONDS;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return clamp(numericFallback, 1, 30);
        }
        return clamp(Math.trunc(parsed), 1, 30);
    }

    function buildRuntimeConfig(value) {
        const processingDelaySeconds = normalizeProcessingDelaySeconds(value, DEFAULT_PROCESSING_DELAY_SECONDS);

        return {
            processingDelaySeconds,
            retryDelaySeconds: processingDelaySeconds,
            retryCooldownMs: processingDelaySeconds * 1000,
            pollIntervalMs: FOREGROUND_SCAN_INTERVAL_MS,
            remotePollIntervalMs: REMOTE_POLL_INTERVAL_MS,
            cdpRescanIntervalMs: CDP_RESCAN_INTERVAL_MS,
            controlPanelRefreshIntervalMs: CONTROL_PANEL_REFRESH_INTERVAL_MS
        };
    }

    function normalizeText(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function detectBusyPattern(text) {
        const normalized = normalizeText(text);
        for (const pattern of BUSY_PATTERNS) {
            if (normalized.includes(pattern)) {
                return pattern;
            }
        }
        return '';
    }

    function shouldUseRemotePoll({ isBackgroundMode, documentHidden, visibilityState }) {
        if (isBackgroundMode) return true;
        if (documentHidden) return true;
        return visibilityState === 'hidden';
    }

    function shouldAttemptNativeContinue({
        nativeContinueRequested,
        hasRetryButton,
        hasBusySignal,
        isAgentRunning,
        now,
        lastNativeAttemptTs,
        retryCooldownMs
    }) {
        if (!nativeContinueRequested) return false;
        if (hasRetryButton) return false;
        if (hasBusySignal) return false;
        if (isAgentRunning) return false;

        const attemptNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
        const lastAttempt = Number.isFinite(Number(lastNativeAttemptTs)) ? Number(lastNativeAttemptTs) : 0;
        const cooldown = Math.max(1000, Number(retryCooldownMs) || 0);

        return (attemptNow - lastAttempt) >= cooldown;
    }

    return {
        BUSY_PATTERNS,
        DEFAULT_PROCESSING_DELAY_SECONDS,
        buildRuntimeConfig,
        detectBusyPattern,
        normalizeProcessingDelaySeconds,
        shouldAttemptNativeContinue,
        shouldUseRemotePoll
    };
});
