const vscode = require('vscode');
const http = require('http');
const os = require('os');
const {
    buildRuntimeConfig,
    normalizeProcessingDelaySeconds,
    shouldAttemptNativeContinue
} = require('./main_scripts/recovery-core');

// State
let isEnabled = false;
let backgroundModeEnabled = false;
let pollTimer;
let statusBarItem;
let statusControlPanelItem;
let outputChannel;
let currentIDE = 'unknown';
let globalContext;
let cdpHandler;
let controlPanel = null;
let cdpPort = 9000;
let processingDelaySeconds = 5;
let pollInterval = 250;
let remotePollIntervalMs = 1000;
let cdpRescanIntervalMs = 1500;
let controlPanelRefreshIntervalMs = 2000;
let maxRetries = 50;
let retryCooldownMs = 5000;
let retryDelaySeconds = 5;
let enableNativeCommands = true;
let lastControlPanelStatePushTs = 0;
let cdpRefreshTimer;
let activePollingTimer;
let lastNativeCommandAttemptTs = 0;

const ENABLED_STATE_KEY = 'autocontinue-enabled';
const BACKGROUND_STATE_KEY = 'autocontinue-background';
const DEFAULT_CDP_PORT = 9000;

// Antigravity native continue/retry commands (from auto-accept-master)
const ANTIGRAVITY_CONTINUE_COMMANDS = [
    'antigravity.command.continueGenerating',
    'antigravity.continueGenerating',
    'antigravity.command.continue',
    'antigravity.agent.continue'
];

// =========================================================
// LOGGING
// =========================================================

function log(message) {
    try {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const logLine = `[${timestamp}] ${message}`;
        console.log(logLine);
        if (outputChannel) {
            outputChannel.appendLine(logLine);
        }
    } catch (e) {
        console.error('Logging failed:', e);
    }
}

function detectIDE() {
    const appName = vscode.env.appName || '';
    if (appName.toLowerCase().includes('antigravity')) return 'Antigravity';
    if (appName.toLowerCase().includes('cursor')) return 'Cursor';
    return 'VS Code';
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// =========================================================
// CDP PORT CHECK
// =========================================================

async function isCDPPortReady(port = cdpPort, timeoutMs = 1200) {
    return new Promise((resolve) => {
        const req = http.get({
            hostname: '127.0.0.1',
            port,
            path: '/json/version',
            timeout: timeoutMs
        }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

function normalizeCdpPort(value, fallback = DEFAULT_CDP_PORT) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const port = Math.trunc(parsed);
    if (port < 1 || port > 65535) return fallback;
    return port;
}

// =========================================================
// NATIVE COMMAND FALLBACK
// =========================================================

/**
 * Try to execute Antigravity's native continue/retry commands.
 * This is now an on-demand fallback only; never fire it on a blind timer.
 */
async function tryNativeContinueCommands(request = {}) {
    if (!enableNativeCommands) return false;
    if ((currentIDE || '').toLowerCase() !== 'antigravity') return false;

    const now = Date.now();
    const canAttempt = shouldAttemptNativeContinue({
        nativeContinueRequested: true,
        hasRetryButton: !!request.hasRetryButton,
        hasBusySignal: !!request.hasBusySignal,
        isAgentRunning: !!request.isAgentRunning,
        now,
        lastNativeAttemptTs: lastNativeCommandAttemptTs,
        retryCooldownMs
    });

    if (!canAttempt) return false;

    lastNativeCommandAttemptTs = now;

    let attempted = false;

    for (const cmd of ANTIGRAVITY_CONTINUE_COMMANDS) {
        try {
            await vscode.commands.executeCommand(cmd);
            attempted = true;
        } catch (e) {
            // Command may not exist — that's fine
        }
    }

    if (attempted) {
        log(`Native continue fallback executed${request.pattern ? ` for "${request.pattern}"` : ''}`);
    }

    return attempted;
}

// =========================================================
// ACTIVATION
// =========================================================

async function activate(context) {
    globalContext = context;
    console.log('AutoContinue Extension v2: Activating...');

    // Create status bar items
    try {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 97);
        statusBarItem.command = 'autocontinue.toggle';
        statusBarItem.text = '⚡ AC: OFF';
        statusBarItem.tooltip = 'Click to toggle AutoContinue error retry';
        context.subscriptions.push(statusBarItem);
        statusBarItem.show();

        statusControlPanelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 96);
        statusControlPanelItem.command = 'autocontinue.openControlPanel';
        statusControlPanelItem.text = '$(tools) AC Panel';
        statusControlPanelItem.tooltip = 'Open AutoContinue Control Panel';
        context.subscriptions.push(statusControlPanelItem);
        statusControlPanelItem.show();
    } catch (e) {
        console.error('Failed to create status bar items:', e);
    }

    try {
        // Load state
        isEnabled = context.globalState.get(ENABLED_STATE_KEY, false);
        backgroundModeEnabled = context.globalState.get(BACKGROUND_STATE_KEY, false);
        currentIDE = detectIDE();

        // Load configuration
        loadConfiguration();
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('autoContinue')) {
                loadConfiguration();
                log('Configuration reloaded');
                if (isEnabled) {
                    await startMonitoring();
                }
            }
        });

        // Create output channel
        outputChannel = vscode.window.createOutputChannel('AutoContinue Agent');
        context.subscriptions.push(outputChannel);

        log(`AutoContinue v2: Activating for ${currentIDE}...`);
        log(`Platform: ${process.platform} / ${os.arch()} / ${os.release()}`);

        // Initialize CDP handler
        try {
            const { CDPHandler } = require('./main_scripts/cdp-handler');
            cdpHandler = new CDPHandler(log);
            log('CDP handler initialized');
        } catch (err) {
            log(`Failed to initialize CDP handler: ${err.message}`);
        }

        // Update status bar
        updateStatusBar();

        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('autocontinue.toggle', () => handleToggle(context)),
            vscode.commands.registerCommand('autocontinue.toggleBackground', () => handleToggleBackground(context)),
            vscode.commands.registerCommand('autocontinue.openControlPanel', () => openControlPanel(context)),
            vscode.commands.registerCommand('autocontinue.copyDiagnostics', () => handleCopyDiagnostics()),
            vscode.commands.registerCommand('autocontinue.openOutputLog', () => {
                if (outputChannel) outputChannel.show(true);
            })
        );

        // Auto-start if was enabled
        if (isEnabled) {
            log('AutoContinue was enabled, starting...');
            await startMonitoring();
        }

        log('AutoContinue v2: Activation complete');
    } catch (error) {
        console.error('ACTIVATION FAILED:', error);
        log(`ACTIVATION FAILED: ${error.message}`);
    }
}

function loadConfiguration() {
    const config = vscode.workspace.getConfiguration('autoContinue');
    const configuredProcessingDelay = config.get('processingDelaySeconds');
    const legacyDelaySeconds = Math.max(1, Math.min(30, Number(config.get('retryDelaySeconds', 5)) || 5));
    const legacyCooldownMs = Math.max(0, Math.min(30000, Number(config.get('retryCooldownMs', legacyDelaySeconds * 1000)) || 0));
    const fallbackProcessingDelay = Math.max(legacyDelaySeconds, Math.round(legacyCooldownMs / 1000) || 0, 1);
    const runtimeConfig = buildRuntimeConfig(
        normalizeProcessingDelaySeconds(
            configuredProcessingDelay == null ? fallbackProcessingDelay : configuredProcessingDelay,
            fallbackProcessingDelay
        )
    );

    cdpPort = normalizeCdpPort(config.get('cdpPort', DEFAULT_CDP_PORT));
    processingDelaySeconds = runtimeConfig.processingDelaySeconds;
    pollInterval = runtimeConfig.pollIntervalMs;
    remotePollIntervalMs = runtimeConfig.remotePollIntervalMs;
    cdpRescanIntervalMs = runtimeConfig.cdpRescanIntervalMs;
    controlPanelRefreshIntervalMs = runtimeConfig.controlPanelRefreshIntervalMs;
    maxRetries = Math.max(1, Math.min(500, Number(config.get('maxRetries', 50)) || 50));
    retryCooldownMs = runtimeConfig.retryCooldownMs;
    retryDelaySeconds = runtimeConfig.retryDelaySeconds;
    enableNativeCommands = config.get('enableNativeCommands', true) !== false;
}

function updateStatusBar() {
    if (!statusBarItem) return;

    const connCount = cdpHandler ? cdpHandler.getConnectionCount() : 0;

    if (isEnabled && backgroundModeEnabled) {
        statusBarItem.text = `⚡ AC: BG [${connCount}]`;
        statusBarItem.tooltip = `AutoContinue Background Mode — ${connCount} target(s) connected\nProcessing wait: ${processingDelaySeconds}s\nClick to disable`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (isEnabled) {
        statusBarItem.text = `⚡ AC: ON [${connCount}]`;
        statusBarItem.tooltip = `AutoContinue Active — ${connCount} target(s) connected\nProcessing wait: ${processingDelaySeconds}s\nClick to disable`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = '⚡ AC: OFF';
        statusBarItem.tooltip = 'Click to enable AutoContinue error retry';
        statusBarItem.backgroundColor = undefined;
    }
}

// =========================================================
// TOGGLE
// =========================================================

async function handleToggle(context) {
    isEnabled = !isEnabled;
    await context.globalState.update(ENABLED_STATE_KEY, isEnabled);
    updateStatusBar();

    if (isEnabled) {
        log('AutoContinue: ENABLED');
        await startMonitoring();
        vscode.window.showInformationMessage(`AutoContinue: Enabled — will auto-retry with a ${processingDelaySeconds}s processing wait`);
    } else {
        log('AutoContinue: DISABLED');
        await stopMonitoring();
        vscode.window.showInformationMessage('AutoContinue: Disabled');
    }

    pushControlPanelState();
}

async function handleToggleBackground(context) {
    backgroundModeEnabled = !backgroundModeEnabled;
    await context.globalState.update(BACKGROUND_STATE_KEY, backgroundModeEnabled);
    updateStatusBar();

    if (backgroundModeEnabled) {
        log('Background mode: ENABLED');
        vscode.window.showInformationMessage('AutoContinue: Background mode enabled — overlay active');
        if (isEnabled) {
            await syncCDP();
        }
    } else {
        log('Background mode: DISABLED');
        vscode.window.showInformationMessage('AutoContinue: Background mode disabled');
        if (isEnabled) {
            await syncCDP();
        }
    }

    pushControlPanelState();
}

// =========================================================
// MONITORING
// =========================================================

async function startMonitoring() {
    if (pollTimer) clearInterval(pollTimer);
    if (cdpRefreshTimer) clearInterval(cdpRefreshTimer);
    if (activePollingTimer) clearInterval(activePollingTimer);

    if (!cdpHandler) {
        log('No CDP handler available');
        return;
    }

    // Check if CDP is available
    const cdpAvailable = await cdpHandler.isCDPAvailable(cdpPort);
    if (!cdpAvailable) {
        log(`CDP not available on port ${cdpPort}. AutoContinue will retry when CDP becomes available.`);
    }

    // Initial sync
    await syncCDP();

    // Fast CDP re-scan to find new targets and push config updates into running pages.
    cdpRefreshTimer = setInterval(async () => {
        if (!isEnabled) return;
        await syncCDP();
    }, cdpRescanIntervalMs);

    // Periodic control panel state push + status bar update
    pollTimer = setInterval(async () => {
        if (!isEnabled) return;
        updateStatusBar();
        pushControlPanelState();
    }, controlPanelRefreshIntervalMs);

    // Active polling from extension process — the core background mode fix.
    // This runs in Node.js (never throttled), calling into each CDP target
    // to detect errors and click retry buttons even when tabs are backgrounded.
    // It also handles any native-continue requests on demand.
    activePollingTimer = setInterval(async () => {
        if (!isEnabled || !cdpHandler) return;
        try {
            const results = await cdpHandler.pollAndRetry();
            const nativeRequest = Array.isArray(results)
                ? results.find((result) => result && result.requestNativeContinue)
                : null;

            if (nativeRequest) {
                const attempted = await tryNativeContinueCommands({
                    hasRetryButton: !!nativeRequest.buttonFound,
                    hasBusySignal: !!nativeRequest.busyPattern,
                    isAgentRunning: !!nativeRequest.isAgentRunning,
                    pattern: nativeRequest.pattern || nativeRequest.busyPattern || ''
                });
                if (attempted) {
                    await cdpHandler.acknowledgeNativeContinueRequest(
                        nativeRequest.targetId,
                        nativeRequest.pattern || nativeRequest.busyPattern || '',
                        Date.now()
                    );
                } else {
                    log(`Native continue request still pending for "${nativeRequest.pattern || nativeRequest.busyPattern || ''}"`);
                }
            }
        } catch (e) {
            // Silently ignore — individual target errors handled inside pollAndRetry
        }
    }, remotePollIntervalMs);
    log(`Active polling enabled (${remotePollIntervalMs}ms interval)`);

    log(`Monitoring started (CDP re-scan: ${cdpRescanIntervalMs}ms)`);
}

async function syncCDP() {
    if (!cdpHandler || !isEnabled) return;

    try {
        await cdpHandler.start({
            cdpPort,
            processingDelaySeconds,
            maxRetries,
            retryCooldownMs,
            retryDelaySeconds,
            pollInterval,
            isBackgroundMode: backgroundModeEnabled,
            quiet: true
        });
    } catch (err) {
        log(`CDP sync error: ${err.message}`);
    }
}

async function stopMonitoring() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (cdpRefreshTimer) {
        clearInterval(cdpRefreshTimer);
        cdpRefreshTimer = null;
    }
    if (activePollingTimer) {
        clearInterval(activePollingTimer);
        activePollingTimer = null;
    }
    if (cdpHandler) {
        await cdpHandler.stop();
    }
    log('Monitoring stopped');
}

// =========================================================
// CONTROL PANEL WEBVIEW
// =========================================================

function openControlPanel(context) {
    if (controlPanel) {
        controlPanel.reveal();
        return;
    }

    controlPanel = vscode.window.createWebviewPanel(
        'autocontinuePanel',
        'AutoContinue Control Panel',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    controlPanel.webview.html = getControlPanelHtml();

    controlPanel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
            case 'ready':
            case 'refresh':
                await pushControlPanelState();
                break;
            case 'toggleAuto':
                await handleToggle(context);
                break;
            case 'toggleBackground':
                await handleToggleBackground(context);
                break;
            case 'savePort': {
                const port = normalizeCdpPort(msg.port, cdpPort);
                await vscode.workspace.getConfiguration('autoContinue').update('cdpPort', port, vscode.ConfigurationTarget.Global);
                cdpPort = port;
                log(`CDP port saved: ${port}`);
                await pushControlPanelState();
                break;
            }
            case 'saveMaxRetries': {
                const val = Math.max(1, Math.min(500, Number(msg.value) || 50));
                await vscode.workspace.getConfiguration('autoContinue').update('maxRetries', val, vscode.ConfigurationTarget.Global);
                maxRetries = val;
                log(`Max retries saved: ${val}`);
                await pushControlPanelState();
                break;
            }
            case 'saveProcessingDelay': {
                const val = normalizeProcessingDelaySeconds(msg.value, processingDelaySeconds);
                await vscode.workspace.getConfiguration('autoContinue').update('processingDelaySeconds', val, vscode.ConfigurationTarget.Global);
                loadConfiguration();
                if (isEnabled) {
                    await syncCDP();
                }
                log(`Processing delay saved: ${val}s`);
                await pushControlPanelState();
                break;
            }
            case 'copyDiagnostics':
                await handleCopyDiagnostics();
                break;
            case 'openOutputLog':
                if (outputChannel) outputChannel.show(true);
                break;
        }
    });

    controlPanel.onDidDispose(() => {
        controlPanel = null;
    });

    context.subscriptions.push(controlPanel);
}

async function pushControlPanelState() {
    if (!controlPanel) return;

    const now = Date.now();
    if ((now - lastControlPanelStatePushTs) < 800) return;
    lastControlPanelStatePushTs = now;

    const cdpReady = cdpHandler ? await isCDPPortReady(cdpPort, 900) : false;
    const connectionCount = cdpHandler ? cdpHandler.getConnectionCount() : 0;
    const stats = cdpHandler ? await cdpHandler.getStats() : {};

    try {
        controlPanel.webview.postMessage({
            type: 'state',
            state: {
                isEnabled,
                backgroundModeEnabled,
                ide: currentIDE,
                platform: `${process.platform} / ${os.arch()}`,
                cdpPort,
                cdpReady,
                connectionCount,
                pollInterval,
                processingDelaySeconds,
                maxRetries,
                retryCooldownMs,
                retryDelaySeconds,
                enableNativeCommands,
                stats: {
                    retries: stats.retries || 0,
                    errorsDetected: stats.errorsDetected || 0,
                    consecutiveRetries: stats.consecutiveRetries || 0,
                    lastError: stats.lastError || '',
                    lastBusyPattern: stats.lastBusyPattern || '',
                    lastRetryAt: stats.lastRetryAt || '',
                    countdownActive: stats.countdownActive || false,
                    countdownSecondsLeft: stats.countdownSecondsLeft || 0,
                    waitingForPreviousInput: stats.waitingForPreviousInput || false,
                    busyAcks: stats.busyAcks || 0,
                    nativeContinueRequested: stats.nativeContinueRequested || false,
                    retryHistory: stats.retryHistory || []
                },
                lastRefreshedAt: new Date().toISOString()
            }
        });
    } catch (e) {
        log(`Panel state push failed: ${e.message}`);
    }
}

function getControlPanelHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :root {
      --bg: #0c0c0c;
      --surface: #141414;
      --surface-2: #1a1a1a;
      --border: #222;
      --border-hover: #333;
      --txt: #e0e0e0;
      --txt-secondary: #777;
      --accent: #00d4aa;
      --accent-dim: rgba(0, 212, 170, 0.08);
      --accent-glow: rgba(0, 212, 170, 0.12);
      --red: #e55;
      --red-dim: rgba(238, 85, 85, 0.08);
      --amber: #e0a030;
      --amber-dim: rgba(224, 160, 48, 0.08);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      background: var(--bg);
      color: var(--txt);
      padding: 24px 20px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .wrap {
      max-width: 640px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ── Cards ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 18px;
      transition: border-color 0.15s ease;
    }
    .card:hover { border-color: var(--border-hover); }
    .card.active { border-color: rgba(0,212,170,0.25); }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }

    .logo {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px;
      background: var(--accent-dim);
      border-radius: 8px;
      flex-shrink: 0;
    }

    h1 {
      font-size: 15px;
      font-weight: 600;
      color: var(--txt);
      letter-spacing: -0.2px;
    }
    h1 span {
      color: var(--txt-secondary);
      font-weight: 400;
      font-size: 12px;
      margin-left: 6px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .badge.on {
      background: var(--accent-dim);
      color: var(--accent);
    }
    .badge.off {
      background: rgba(119,119,119,0.1);
      color: var(--txt-secondary);
    }

    .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot.on {
      background: var(--accent);
      box-shadow: 0 0 6px var(--accent);
      animation: pulse 2s ease-in-out infinite;
    }
    .dot.off { background: #555; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

    /* ── Controls row ── */
    .controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    button {
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      color: var(--txt);
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    button:hover {
      border-color: var(--border-hover);
      background: #1e1e1e;
    }
    button:active { transform: scale(0.97); }
    button.primary {
      background: var(--accent);
      color: #000;
      border-color: transparent;
      font-weight: 600;
    }
    button.primary:hover {
      background: #00e5bf;
      border-color: transparent;
    }
    button.danger {
      background: rgba(238,85,85,0.12);
      border-color: rgba(238,85,85,0.2);
      color: var(--red);
    }
    button.danger:hover {
      background: rgba(238,85,85,0.18);
    }
    button:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    /* ── CDP pill ── */
    .cdp-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--txt-secondary);
    }
    .cdp-pill.ok {
      border-color: rgba(0,212,170,0.2);
      color: var(--accent);
    }
    .cdp-pill.bad {
      border-color: rgba(238,85,85,0.2);
      color: var(--red);
    }

    /* ── Stats grid ── */
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .stat-item {
      padding: 12px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      text-align: center;
    }
    .stat-label {
      font-size: 10px;
      font-weight: 500;
      color: var(--txt-secondary);
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 700;
      margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }
    .stat-value.accent { color: var(--accent); }
    .stat-value.sm { font-size: 13px; font-weight: 500; }

    /* ── Section labels ── */
    .section-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--txt-secondary);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
    }

    /* ── Toggle row ── */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .toggle-info h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--txt);
    }
    .toggle-info p {
      font-size: 11px;
      color: var(--txt-secondary);
      margin-top: 2px;
    }

    .toggle-btn {
      min-width: 56px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      text-align: center;
    }
    .toggle-btn.is-on {
      background: var(--accent-dim);
      border-color: rgba(0,212,170,0.2);
      color: var(--accent);
    }

    /* ── Config ── */
    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .config-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .config-item label {
      font-size: 10px;
      font-weight: 500;
      color: var(--txt-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .config-item input[type="number"] {
      width: 100%;
      padding: 7px 10px;
      font-family: inherit;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: var(--txt);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      transition: border-color 0.15s ease;
    }
    .config-item input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .config-item.wide {
      grid-column: 1 / -1;
    }
    .slider-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .slider-wrap input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
    }
    .slider-value {
      min-width: 52px;
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      color: var(--accent);
      font-variant-numeric: tabular-nums;
    }
    .config-hint {
      font-size: 11px;
      color: var(--txt-secondary);
      line-height: 1.4;
    }

    .save-row {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    /* ── Countdown card ── */
    .countdown-card {
      text-align: center;
      border-color: rgba(224,160,48,0.3) !important;
    }
    .countdown-number {
      font-size: 48px;
      font-weight: 700;
      color: var(--amber);
      line-height: 1;
      font-variant-numeric: tabular-nums;
      animation: cdPulse 1s ease-in-out infinite;
    }
    @keyframes cdPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .countdown-bar-track {
      margin-top: 12px;
      height: 3px;
      background: var(--surface-2);
      border-radius: 2px;
      overflow: hidden;
    }
    .countdown-bar-fill {
      height: 100%;
      background: var(--amber);
      border-radius: 2px;
      transition: width 1s linear;
    }

    /* ── History ── */
    .history-list {
      max-height: 180px;
      overflow-y: auto;
    }
    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 0;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    .history-item:last-child { border-bottom: none; }
    .history-time { color: var(--txt-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
    .history-pattern { color: var(--txt-secondary); font-size: 11px; margin-left: 6px; }
    .history-action {
      font-size: 10px;
      font-weight: 600;
      color: var(--accent);
      padding: 2px 8px;
      background: var(--accent-dim);
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }

    /* ── Error log ── */
    .error-log {
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--red-dim);
      border: 1px solid rgba(238,85,85,0.15);
      font-size: 12px;
      color: #f99;
      word-break: break-word;
      margin-top: 8px;
      max-height: 100px;
      overflow-y: auto;
    }
    .error-log:empty { display: none; }

    /* ── Footer ── */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .footer-meta {
      font-size: 11px;
      color: var(--txt-secondary);
    }
    .footer-meta kbd {
      font-family: inherit;
      background: var(--surface-2);
      padding: 1px 5px;
      border-radius: 4px;
      font-size: 10px;
      border: 1px solid var(--border);
    }

    /* ── Scrollbar ── */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    ::-webkit-scrollbar-thumb:hover { background: #444; }
  </style>
</head>
<body>
  <div class="wrap">

    <!-- Header -->
    <div class="card" id="mainCard">
      <div class="header">
        <div class="header-left">
          <div class="logo">⚡</div>
          <h1>AutoContinue<span>v2.3</span></h1>
        </div>
        <div id="statusBadge" class="badge off">
          <span class="dot off" id="statusDot"></span>
          <span id="statusLabel">OFF</span>
        </div>
      </div>
    </div>

    <!-- Countdown (hidden by default) -->
    <div class="card countdown-card" id="countdownCard" style="display:none;">
      <div class="section-label" style="margin-bottom:6px;">⚡ Retrying in…</div>
      <div class="countdown-number" id="countdownNumber">5</div>
      <div style="font-size:12px; color:var(--txt-secondary); margin-top:6px;">Auto-clicking retry button</div>
      <div class="countdown-bar-track">
        <div class="countdown-bar-fill" id="countdownBar" style="width:100%;"></div>
      </div>
    </div>

    <!-- Main controls -->
    <div class="card">
      <div class="controls">
        <button class="primary" id="toggleBtn" style="flex:1;">Enable AutoContinue</button>
        <button id="refreshBtn">↻</button>
      </div>
      <div id="cdpStatus" class="cdp-pill" style="margin-top:10px;">Checking CDP…</div>
    </div>

    <!-- Background mode -->
    <div class="card" id="bgCard">
      <div class="toggle-row">
        <div class="toggle-info">
          <h3>Background Mode</h3>
          <p>Overlay + silent retry when tab is not visible</p>
        </div>
        <button id="toggleBgBtn" class="toggle-btn">OFF</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="section-label">Statistics</div>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-label">Retries</div>
          <div class="stat-value accent" id="totalRetries">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Errors</div>
          <div class="stat-value" id="errorsDetected">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Consecutive</div>
          <div class="stat-value" id="consecutiveRetries">0</div>
        </div>
      </div>
      <div class="stats" style="margin-top:8px;">
        <div class="stat-item">
          <div class="stat-label">CDP</div>
          <div class="stat-value sm" id="connections">0</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Last Retry</div>
          <div class="stat-value sm" id="lastRetry">—</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Platform</div>
          <div class="stat-value sm" id="platform">—</div>
        </div>
      </div>
    </div>

    <!-- Retry History (hidden by default) -->
    <div class="card" id="historyCard" style="display:none;">
      <div class="section-label">Recent Retries</div>
      <div class="history-list" id="historyList"></div>
    </div>

    <!-- Last Error (hidden by default) -->
    <div class="card" id="errorCard" style="display:none;">
      <div class="section-label" id="errorLabel">Last Error</div>
      <div class="error-log" id="lastError"></div>
    </div>

    <!-- Configuration -->
    <div class="card">
      <div class="section-label">Configuration</div>
      <div class="config-grid">
        <div class="config-item">
          <label>CDP Port</label>
          <input id="portInput" type="number" min="1" max="65535" step="1" />
        </div>
        <div class="config-item">
          <label>Max Retries</label>
          <input id="maxRetriesInput" type="number" min="1" max="500" step="1" />
        </div>
        <div class="config-item wide">
          <label>Processing Wait</label>
          <div class="slider-wrap">
            <input id="processingDelayInput" type="range" min="1" max="30" step="1" />
            <div class="slider-value" id="processingDelayValue">5s</div>
          </div>
          <div class="config-hint">Fast scanning stays on. This only controls how long AutoContinue waits before retrying or sending a continue fallback.</div>
        </div>
      </div>
      <div class="save-row">
        <button id="savePort">Save Port</button>
        <button id="saveMaxRetries">Save Retries</button>
      </div>
    </div>

    <!-- Footer -->
    <div class="card">
      <div class="footer">
        <div class="controls">
          <button id="copyDiagnostics">Copy Diagnostics</button>
          <button id="openOutputLog">Output Log</button>
        </div>
        <div class="footer-meta">
          <kbd>⌘⇧K</kbd> toggle · IDE: <span id="ide">—</span>
        </div>
      </div>
      <div class="footer-meta" style="margin-top:8px;">Last refresh: <span id="lastRefreshed">—</span></div>
    </div>

  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const byId = (id) => document.getElementById(id);
    function post(type, payload = {}) { vscode.postMessage({ type, ...payload }); }

    function render(s) {
      const badge = byId('statusBadge');
      const dot = byId('statusDot');
      const label = byId('statusLabel');
      const mainCard = byId('mainCard');
      const toggleBtn = byId('toggleBtn');

      if (s.isEnabled && s.backgroundModeEnabled) {
        badge.className = 'badge on';
        dot.className = 'dot on';
        label.textContent = 'BG MODE';
        mainCard.classList.add('active');
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'danger';
        toggleBtn.style.cssText = 'flex:1;';
      } else if (s.isEnabled) {
        badge.className = 'badge on';
        dot.className = 'dot on';
        label.textContent = 'ACTIVE';
        mainCard.classList.add('active');
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'danger';
        toggleBtn.style.cssText = 'flex:1;';
      } else {
        badge.className = 'badge off';
        dot.className = 'dot off';
        label.textContent = 'OFF';
        mainCard.classList.remove('active');
        toggleBtn.textContent = 'Enable AutoContinue';
        toggleBtn.className = 'primary';
        toggleBtn.style.cssText = 'flex:1;';
      }

      const bgBtn = byId('toggleBgBtn');
      const bgCard = byId('bgCard');

      if (s.backgroundModeEnabled) {
        bgBtn.textContent = 'ON';
        bgBtn.className = 'toggle-btn is-on';
        bgCard.style.borderColor = 'rgba(0,212,170,0.2)';
      } else {
        bgBtn.textContent = 'OFF';
        bgBtn.className = 'toggle-btn';
        bgCard.style.borderColor = '';
      }

      // CDP status
      const cdpEl = byId('cdpStatus');
      if (s.cdpReady) {
        cdpEl.textContent = 'Port ' + s.cdpPort + ' · ' + s.connectionCount + ' target' + (s.connectionCount !== 1 ? 's' : '') + ' connected';
        cdpEl.className = 'cdp-pill ok';
      } else {
        cdpEl.textContent = 'CDP unavailable · port ' + s.cdpPort;
        cdpEl.className = 'cdp-pill bad';
      }

      // Countdown card
      const countdownCard = byId('countdownCard');
      const stats = s.stats || {};
      if (stats.countdownActive && stats.countdownSecondsLeft > 0) {
        countdownCard.style.display = '';
        byId('countdownNumber').textContent = String(stats.countdownSecondsLeft);
        const totalDelay = s.processingDelaySeconds || s.retryDelaySeconds || 5;
        const pct = Math.max(0, (stats.countdownSecondsLeft / totalDelay) * 100);
        byId('countdownBar').style.width = pct + '%';
      } else {
        countdownCard.style.display = 'none';
      }

      // Stats
      byId('totalRetries').textContent = String(stats.retries || 0);
      byId('errorsDetected').textContent = String(stats.errorsDetected || 0);
      byId('consecutiveRetries').textContent = String(stats.consecutiveRetries || 0);
      byId('connections').textContent = String(s.connectionCount || 0);
      byId('ide').textContent = s.ide || '—';
      byId('platform').textContent = s.platform || '—';

      if (stats.lastRetryAt) {
        try {
          byId('lastRetry').textContent = new Date(stats.lastRetryAt).toLocaleTimeString();
        } catch (e) {
          byId('lastRetry').textContent = stats.lastRetryAt;
        }
      } else {
        byId('lastRetry').textContent = '—';
      }

      // Retry history
      const historyCard = byId('historyCard');
      const historyList = byId('historyList');
      const history = Array.isArray(stats.retryHistory) ? stats.retryHistory : [];
      if (history.length > 0) {
        historyCard.style.display = '';
        historyList.innerHTML = history.slice().reverse().map(h => {
          let timeStr = '—';
          try { timeStr = new Date(h.at).toLocaleTimeString(); } catch(e) {}
          return '<div class="history-item">' +
            '<div><span class="history-time">' + timeStr + '</span>' +
            '<span class="history-pattern"> · ' + (h.pattern || '—').slice(0, 40) + '</span></div>' +
            '<span class="history-action">' + (h.action || 'retry') + '</span>' +
          '</div>';
        }).join('');
      } else {
        historyCard.style.display = 'none';
      }

      // Error card
      const errorCard = byId('errorCard');
      const errorLabel = byId('errorLabel');
      const errorEl = byId('lastError');
      if (stats.waitingForPreviousInput && stats.lastBusyPattern) {
        errorCard.style.display = '';
        errorLabel.textContent = 'Input Queue';
        errorEl.textContent = stats.lastBusyPattern + ' — waiting instead of sending another continue.';
      } else if (stats.lastError) {
        errorCard.style.display = '';
        errorLabel.textContent = 'Last Error';
        errorEl.textContent = stats.lastError;
      } else {
        errorCard.style.display = 'none';
      }

      // Config inputs — only update when user is NOT focused
      const activeId = document.activeElement ? document.activeElement.id : '';
      if (activeId !== 'portInput') byId('portInput').value = String(s.cdpPort || 9000);
      if (activeId !== 'maxRetriesInput') byId('maxRetriesInput').value = String(s.maxRetries || 50);
      if (activeId !== 'processingDelayInput') byId('processingDelayInput').value = String(s.processingDelaySeconds || 5);
      byId('processingDelayValue').textContent = String(s.processingDelaySeconds || 5) + 's';

      // Timestamps
      if (s.lastRefreshedAt) {
        try {
          byId('lastRefreshed').textContent = new Date(s.lastRefreshedAt).toLocaleTimeString();
        } catch (e) {
          byId('lastRefreshed').textContent = s.lastRefreshedAt;
        }
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'state') {
        render(msg.state || {});
      }
    });

    byId('toggleBtn').addEventListener('click', () => post('toggleAuto'));
    byId('toggleBgBtn').addEventListener('click', () => post('toggleBackground'));
    byId('refreshBtn').addEventListener('click', () => post('refresh'));
    byId('savePort').addEventListener('click', () => post('savePort', { port: Number(byId('portInput').value) }));
    byId('saveMaxRetries').addEventListener('click', () => post('saveMaxRetries', { value: Number(byId('maxRetriesInput').value) }));
    byId('processingDelayInput').addEventListener('input', () => {
      byId('processingDelayValue').textContent = String(byId('processingDelayInput').value) + 's';
    });
    byId('processingDelayInput').addEventListener('change', () => {
      post('saveProcessingDelay', { value: Number(byId('processingDelayInput').value) });
    });
    byId('copyDiagnostics').addEventListener('click', () => post('copyDiagnostics'));
    byId('openOutputLog').addEventListener('click', () => post('openOutputLog'));

    post('ready');
    setInterval(() => post('refresh'), 2000);
  </script>
</body>
</html>`;
}

// =========================================================
// DIAGNOSTICS
// =========================================================

async function handleCopyDiagnostics() {
    try {
        const cdpReady = await isCDPPortReady(cdpPort, 900);
        const stats = cdpHandler ? await cdpHandler.getStats() : {};
        const lines = [
            'AutoContinue Agent v2 Diagnostics',
            `generatedAt=${new Date().toISOString()}`,
            `ide=${currentIDE}`,
            `platform=${process.platform}`,
            `arch=${os.arch()}`,
            `enabled=${isEnabled}`,
            `backgroundMode=${backgroundModeEnabled}`,
            `cdpPort=${cdpPort}`,
            `cdpReady=${cdpReady}`,
            `connectionCount=${cdpHandler ? cdpHandler.getConnectionCount() : 0}`,
            `pollInterval=${pollInterval}`,
            `processingDelaySeconds=${processingDelaySeconds}`,
            `maxRetries=${maxRetries}`,
            `retryCooldownMs=${retryCooldownMs}`,
            `retryDelaySeconds=${retryDelaySeconds}`,
            `enableNativeCommands=${enableNativeCommands}`,
            `stats.retries=${stats.retries || 0}`,
            `stats.errorsDetected=${stats.errorsDetected || 0}`,
            `stats.consecutiveRetries=${stats.consecutiveRetries || 0}`,
            `stats.countdownActive=${stats.countdownActive || false}`,
            `stats.waitingForPreviousInput=${stats.waitingForPreviousInput || false}`,
            `stats.lastBusyPattern=${stats.lastBusyPattern || '-'}`,
            `stats.busyAcks=${stats.busyAcks || 0}`,
            `stats.nativeContinueRequested=${stats.nativeContinueRequested || false}`,
            `stats.lastError=${stats.lastError || '-'}`,
            `stats.lastRetryAt=${stats.lastRetryAt || '-'}`
        ];
        await vscode.env.clipboard.writeText(lines.join('\n'));
        log('Diagnostics copied to clipboard');
        vscode.window.showInformationMessage('AutoContinue: Diagnostics copied to clipboard.');
    } catch (err) {
        log(`Failed to copy diagnostics: ${err.message}`);
    }
}

// =========================================================
// DEACTIVATION
// =========================================================

function deactivate() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    if (cdpRefreshTimer) {
        clearInterval(cdpRefreshTimer);
        cdpRefreshTimer = null;
    }
    if (activePollingTimer) {
        clearInterval(activePollingTimer);
        activePollingTimer = null;
    }
    if (cdpHandler) {
        cdpHandler.stop().catch(() => {});
    }
    log('AutoContinue v2: Deactivated');
}

module.exports = { activate, deactivate };
