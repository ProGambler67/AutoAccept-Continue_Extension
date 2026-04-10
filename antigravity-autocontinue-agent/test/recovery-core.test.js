const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildRuntimeConfig,
    detectBusyPattern,
    shouldQueueNativeContinueRequest,
    shouldUseRemotePoll,
    shouldAttemptNativeContinue
} = require('../main_scripts/recovery-core');

test('buildRuntimeConfig uses one processing delay while keeping scans fast', () => {
    const config = buildRuntimeConfig(7);

    assert.equal(config.processingDelaySeconds, 7);
    assert.equal(config.retryDelaySeconds, 7);
    assert.equal(config.retryCooldownMs, 7000);
    assert.equal(config.pollIntervalMs, 250);
    assert.equal(config.remotePollIntervalMs, 1000);
});

test('detectBusyPattern matches previous-input processing errors', () => {
    const pattern = detectBusyPattern("Agent hasn't processed previous input yet. Try again in a moment.");

    assert.equal(pattern, "agent hasn't processed previous input");
});

test('detectBusyPattern matches executor wording used by Antigravity', () => {
    const pattern = detectBusyPattern('[unknown] executor has not processed the previous input yet');

    assert.equal(pattern, 'executor has not processed the previous input yet');
});

test('shouldUseRemotePoll allows foreground polling when background mode is enabled', () => {
    assert.equal(
        shouldUseRemotePoll({ isBackgroundMode: true, documentHidden: false, visibilityState: 'visible' }),
        true
    );

    assert.equal(
        shouldUseRemotePoll({ isBackgroundMode: false, documentHidden: false, visibilityState: 'visible' }),
        false
    );

    assert.equal(
        shouldUseRemotePoll({ isBackgroundMode: false, documentHidden: true, visibilityState: 'hidden' }),
        true
    );
});

test('shouldAttemptNativeContinue only allows on-demand fallback when the agent is not busy', () => {
    const base = {
        nativeContinueRequested: true,
        hasRetryButton: false,
        hasBusySignal: false,
        isAgentRunning: false,
        now: 10_000,
        lastNativeAttemptTs: 1_000,
        retryCooldownMs: 5_000
    };

    assert.equal(shouldAttemptNativeContinue(base), true);
    assert.equal(shouldAttemptNativeContinue({ ...base, hasBusySignal: true }), false);
    assert.equal(shouldAttemptNativeContinue({ ...base, isAgentRunning: true }), false);
    assert.equal(shouldAttemptNativeContinue({ ...base, hasRetryButton: true }), false);
    assert.equal(shouldAttemptNativeContinue({ ...base, nativeContinueRequested: false }), false);
    assert.equal(shouldAttemptNativeContinue({ ...base, now: 5_500 }), false);
});

test('shouldQueueNativeContinueRequest deduplicates latched requests and backs off repeated sends', () => {
    const base = {
        pattern: 'servers are experiencing high traffic',
        nativeContinueRequested: false,
        nativeContinuePattern: '',
        lastNativeContinuePattern: '',
        lastNativeContinueAttemptAt: 0,
        now: 40_000,
        minRepeatMs: 30_000
    };

    assert.equal(shouldQueueNativeContinueRequest(base), true);
    assert.equal(shouldQueueNativeContinueRequest({ ...base, nativeContinueRequested: true, nativeContinuePattern: base.pattern }), false);
    assert.equal(shouldQueueNativeContinueRequest({ ...base, lastNativeContinuePattern: base.pattern, lastNativeContinueAttemptAt: 15_000 }), false);
    assert.equal(shouldQueueNativeContinueRequest({ ...base, lastNativeContinuePattern: base.pattern, lastNativeContinueAttemptAt: 9_000 }), true);
});
