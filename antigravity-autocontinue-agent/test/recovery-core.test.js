const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildRuntimeConfig,
    detectBusyPattern,
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
