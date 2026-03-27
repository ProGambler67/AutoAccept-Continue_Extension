const vscode = require('vscode');
const http = require('http');
const os = require('os');

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
let pollInterval = 500;
let maxRetries = 50;
let retryCooldownMs = 3000;
let lastControlPanelStatePushTs = 0;
let cdpRefreshTimer;

const ENABLED_STATE_KEY = 'autocontinue-enabled';
const BACKGROUND_STATE_KEY = 'autocontinue-background';
const DEFAULT_CDP_PORT = 9000;

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
// ACTIVATION
// =========================================================

async function activate(context) {
    globalContext = context;
    console.log('AutoContinue Extension: Activating...');

    // Create status bar items
    try {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 97);
        statusBarItem.command = 'autocontinue.toggle';
        statusBarItem.text = '$(sync) AutoContinue: OFF';
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
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('autoContinue')) {
                loadConfiguration();
                log('Configuration reloaded');
            }
        });

        // Create output channel
        outputChannel = vscode.window.createOutputChannel('AutoContinue Agent');
        context.subscriptions.push(outputChannel);

        log(`AutoContinue: Activating for ${currentIDE}...`);

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

        log('AutoContinue: Activation complete');
    } catch (error) {
        console.error('ACTIVATION FAILED:', error);
        log(`ACTIVATION FAILED: ${error.message}`);
    }
}

function loadConfiguration() {
    const config = vscode.workspace.getConfiguration('autoContinue');
    cdpPort = normalizeCdpPort(config.get('cdpPort', DEFAULT_CDP_PORT));
    pollInterval = Math.max(100, Math.min(5000, Number(config.get('pollInterval', 500)) || 500));
    maxRetries = Math.max(1, Math.min(500, Number(config.get('maxRetries', 50)) || 50));
    retryCooldownMs = Math.max(500, Math.min(30000, Number(config.get('retryCooldownMs', 3000)) || 3000));
}

function updateStatusBar() {
    if (!statusBarItem) return;
    if (isEnabled && backgroundModeEnabled) {
        statusBarItem.text = '$(sync~spin) AutoContinue: BG';
        statusBarItem.tooltip = 'AutoContinue (Background Mode) — click to disable';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (isEnabled) {
        statusBarItem.text = '$(sync~spin) AutoContinue: ON';
        statusBarItem.tooltip = 'AutoContinue is active — click to disable';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        statusBarItem.text = '$(sync) AutoContinue: OFF';
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
        vscode.window.showInformationMessage('AutoContinue: Enabled — will auto-retry on errors');
    } else {
        log('AutoContinue: DISABLED');
        await stopMonitoring();
        vscode.window.showInformationMessage('AutoContinue: Disabled');
    }

    // Push state to control panel if open
    pushControlPanelState();
}

async function handleToggleBackground(context) {
    backgroundModeEnabled = !backgroundModeEnabled;
    await context.globalState.update(BACKGROUND_STATE_KEY, backgroundModeEnabled);
    updateStatusBar();

    if (backgroundModeEnabled) {
        log('Background mode: ENABLED');
        vscode.window.showInformationMessage('AutoContinue: Background mode enabled — overlay will cover the IDE panel');
        if (isEnabled) {
            await syncCDP(); // Re-sync to pass background mode flag
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

    // Periodic CDP keep-alive and re-injection
    pollTimer = setInterval(async () => {
        if (!isEnabled) return;
        await syncCDP();
        pushControlPanelState();
    }, 5000);

    log('Monitoring started');
}

async function syncCDP() {
    if (!cdpHandler || !isEnabled) return;

    try {
        await cdpHandler.start({
            cdpPort,
            maxRetries,
            retryCooldownMs,
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
            case 'saveCooldown': {
                const val = Math.max(500, Math.min(30000, Number(msg.value) || 3000));
                await vscode.workspace.getConfiguration('autoContinue').update('retryCooldownMs', val, vscode.ConfigurationTarget.Global);
                retryCooldownMs = val;
                log(`Retry cooldown saved: ${val}ms`);
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
                platform: process.platform,
                cdpPort,
                cdpReady,
                connectionCount,
                pollInterval,
                maxRetries,
                retryCooldownMs,
                stats: {
                    retries: stats.retries || 0,
                    errorsDetected: stats.errorsDetected || 0,
                    consecutiveRetries: stats.consecutiveRetries || 0,
                    lastError: stats.lastError || '',
                    lastRetryAt: stats.lastRetryAt || ''
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
    :root {
      --bg: #0a0e14;
      --panel: #111820;
      --panel-2: #161e2a;
      --txt: #e6edf3;
      --muted: #8b99a8;
      --accent: #00d4aa;
      --accent2: #00b894;
      --ok: #2ea043;
      --warn: #d29922;
      --bad: #f85149;
      --glow: rgba(0, 212, 170, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--txt);
      padding: 20px;
    }
    .wrap { max-width: 720px; margin: 0 auto; display: grid; gap: 14px; }

    .card {
      background: linear-gradient(165deg, var(--panel), var(--panel-2));
      border: 1px solid #1e2a3a;
      border-radius: 14px;
      padding: 16px;
      transition: border-color 0.2s;
    }
    .card:hover { border-color: #2a3a4e; }
    .card.glow { border-color: var(--accent); box-shadow: 0 0 20px var(--glow); }

    .header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 10px;
    }
    h1 {
      font-size: 20px; font-weight: 700;
      background: linear-gradient(135deg, var(--accent), #00e5bf);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle { color: var(--muted); font-size: 12px; margin-top: 4px; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .stat {
      border: 1px solid #1e2a3a; border-radius: 10px; padding: 12px;
      background: rgba(0,0,0,0.3);
    }
    .stat .k {
      color: var(--muted); font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.8px;
    }
    .stat .v { margin-top: 6px; font-size: 14px; font-weight: 600; word-break: break-word; }
    .stat .v.big { font-size: 28px; font-weight: 800; }
    .stat .v.accent { color: var(--accent); }
    .stat .v.warn { color: var(--warn); }
    .stat .v.bad { color: var(--bad); }

    .status-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700;
      letter-spacing: 0.5px; text-transform: uppercase;
    }
    .status-badge.on { background: rgba(0,212,170,0.15); color: var(--accent); }
    .status-badge.off { background: rgba(139,153,168,0.15); color: var(--muted); }

    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.on { background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 1.5s ease-in-out infinite; }
    .dot.off { background: var(--muted); }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    label { font-size: 12px; color: var(--muted); display: grid; gap: 4px; }
    input[type="number"] {
      width: 120px; padding: 8px 10px;
      background: rgba(0,0,0,0.4); border: 1px solid #1e2a3a; border-radius: 8px;
      color: var(--txt); font-size: 13px;
    }
    input[type="number"]:focus { outline: none; border-color: var(--accent); }

    button {
      border: 0; border-radius: 8px; padding: 10px 16px; font-size: 12px;
      font-weight: 600; color: #fff; cursor: pointer;
      transition: all 0.2s; letter-spacing: 0.3px;
    }
    button:hover { transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    button.primary { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #000; }
    button.secondary { background: #1e2a3a; }
    button.warn { background: #8a6517; }
    button:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    .cdp-status {
      padding: 10px 14px; border-radius: 10px; font-size: 12px;
      border: 1px solid #1e2a3a; background: rgba(0,0,0,0.3);
    }
    .cdp-status.ok { color: #a7f3b6; border-color: #1f6b37; }
    .cdp-status.bad { color: #ffb2ab; border-color: #8c2f2b; }

    .error-log {
      margin-top: 8px; padding: 10px; border-radius: 8px;
      background: rgba(248,81,73,0.08); border: 1px solid rgba(248,81,73,0.2);
      font-size: 12px; color: #ffb2ab; word-break: break-word;
      max-height: 120px; overflow-y: auto;
    }
    .error-log:empty { display: none; }

    .muted { color: var(--muted); font-size: 11px; }
  </style>
</head>
<body>
  <div class="wrap">

    <div class="card glow" id="mainCard">
      <div class="header">
        <div>
          <h1>⚡ AutoContinue Agent</h1>
          <div class="subtitle">Automatic error detection & retry for Antigravity</div>
        </div>
        <div id="statusBadge" class="status-badge off">
          <span class="dot off" id="statusDot"></span>
          <span id="statusLabel">OFF</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row" style="justify-content: space-between; margin-bottom: 12px;">
        <div class="row">
          <button class="primary" id="toggleBtn">Enable AutoContinue</button>
          <button class="secondary" id="toggleBgBtn">Background: OFF</button>
        </div>
        <button class="secondary" id="refreshBtn">Refresh</button>
      </div>
      <div id="cdpStatus" class="cdp-status">Checking CDP...</div>
    </div>

    <div class="card">
      <div class="grid">
        <div class="stat">
          <div class="k">Total Retries</div>
          <div class="v big accent" id="totalRetries">0</div>
        </div>
        <div class="stat">
          <div class="k">Errors Detected</div>
          <div class="v big" id="errorsDetected">0</div>
        </div>
        <div class="stat">
          <div class="k">Consecutive Retries</div>
          <div class="v" id="consecutiveRetries">0</div>
        </div>
        <div class="stat">
          <div class="k">CDP Connections</div>
          <div class="v" id="connections">0</div>
        </div>
        <div class="stat">
          <div class="k">Last Retry</div>
          <div class="v" id="lastRetry">-</div>
        </div>
        <div class="stat">
          <div class="k">IDE</div>
          <div class="v" id="ide">-</div>
        </div>
      </div>
    </div>

    <div class="card" id="errorCard" style="display:none;">
      <div class="stat" style="border:0; padding:0; background:transparent;">
        <div class="k">Last Error Detected</div>
        <div class="error-log" id="lastError"></div>
      </div>
    </div>

    <div class="card">
      <div class="k" style="margin-bottom: 10px;">Configuration</div>
      <div class="row" style="gap: 14px;">
        <label>CDP Port
          <input id="portInput" type="number" min="1" max="65535" step="1" />
        </label>
        <label>Max Retries
          <input id="maxRetriesInput" type="number" min="1" max="500" step="1" />
        </label>
        <label>Cooldown (ms)
          <input id="cooldownInput" type="number" min="500" max="30000" step="100" />
        </label>
      </div>
      <div class="row" style="margin-top: 10px;">
        <button class="secondary" id="savePort">Save Port</button>
        <button class="secondary" id="saveMaxRetries">Save Max Retries</button>
        <button class="secondary" id="saveCooldown">Save Cooldown</button>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <button class="secondary" id="copyDiagnostics">Copy Diagnostics</button>
        <button class="secondary" id="openOutputLog">Open Output Log</button>
      </div>
      <div class="muted" style="margin-top: 10px;">Last refresh: <span id="lastRefreshed">-</span></div>
      <div class="muted">Shortcut: <kbd>Ctrl+Shift+K</kbd> (toggle) | Platform: <span id="platform">-</span></div>
    </div>

  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const byId = (id) => document.getElementById(id);
    function post(type, payload = {}) { vscode.postMessage({ type, ...payload }); }

    function render(s) {
      // Status badge
      const badge = byId('statusBadge');
      const dot = byId('statusDot');
      const label = byId('statusLabel');
      const mainCard = byId('mainCard');
      const toggleBtn = byId('toggleBtn');

      const bgBtn = byId('toggleBgBtn');

      if (s.isEnabled && s.backgroundModeEnabled) {
        badge.className = 'status-badge on';
        dot.className = 'dot on';
        label.textContent = 'BG MODE';
        mainCard.classList.add('glow');
        toggleBtn.textContent = 'Disable AutoContinue';
        toggleBtn.className = 'button warn';
        toggleBtn.style.background = '#8a6517';
      } else if (s.isEnabled) {
        badge.className = 'status-badge on';
        dot.className = 'dot on';
        label.textContent = 'ACTIVE';
        mainCard.classList.add('glow');
        toggleBtn.textContent = 'Disable AutoContinue';
        toggleBtn.className = 'button warn';
        toggleBtn.style.background = '#8a6517';
      } else {
        badge.className = 'status-badge off';
        dot.className = 'dot off';
        label.textContent = 'OFF';
        mainCard.classList.remove('glow');
        toggleBtn.textContent = 'Enable AutoContinue';
        toggleBtn.className = 'button primary';
        toggleBtn.style.background = '';
      }

      if (s.backgroundModeEnabled) {
        bgBtn.textContent = 'Background: ON';
        bgBtn.style.background = '#1f6b37';
      } else {
        bgBtn.textContent = 'Background: OFF';
        bgBtn.style.background = '';
      }

      // CDP status
      const cdpEl = byId('cdpStatus');
      if (s.cdpReady) {
        cdpEl.textContent = 'CDP connected on port ' + s.cdpPort;
        cdpEl.className = 'cdp-status ok';
      } else {
        cdpEl.textContent = 'CDP not available on port ' + s.cdpPort + '. Launch IDE with --remote-debugging-port=' + s.cdpPort;
        cdpEl.className = 'cdp-status bad';
      }

      // Stats
      const stats = s.stats || {};
      byId('totalRetries').textContent = String(stats.retries || 0);
      byId('errorsDetected').textContent = String(stats.errorsDetected || 0);
      byId('consecutiveRetries').textContent = String(stats.consecutiveRetries || 0);
      byId('connections').textContent = String(s.connectionCount || 0);
      byId('ide').textContent = s.ide || '-';
      byId('platform').textContent = s.platform || '-';

      if (stats.lastRetryAt) {
        try {
          const d = new Date(stats.lastRetryAt);
          byId('lastRetry').textContent = d.toLocaleTimeString();
        } catch (e) {
          byId('lastRetry').textContent = stats.lastRetryAt;
        }
      } else {
        byId('lastRetry').textContent = '-';
      }

      // Error card
      const errorCard = byId('errorCard');
      const errorEl = byId('lastError');
      if (stats.lastError) {
        errorCard.style.display = '';
        errorEl.textContent = stats.lastError;
      } else {
        errorCard.style.display = 'none';
      }

      // Config inputs
      byId('portInput').value = String(s.cdpPort || 9000);
      byId('maxRetriesInput').value = String(s.maxRetries || 50);
      byId('cooldownInput').value = String(s.retryCooldownMs || 3000);

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
    byId('saveCooldown').addEventListener('click', () => post('saveCooldown', { value: Number(byId('cooldownInput').value) }));
    byId('copyDiagnostics').addEventListener('click', () => post('copyDiagnostics'));
    byId('openOutputLog').addEventListener('click', () => post('openOutputLog'));

    post('ready');
    setInterval(() => post('refresh'), 4000);
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
            'AutoContinue Agent Diagnostics',
            `generatedAt=${new Date().toISOString()}`,
            `ide=${currentIDE}`,
            `platform=${process.platform}`,
            `enabled=${isEnabled}`,
            `backgroundMode=${backgroundModeEnabled}`,
            `cdpPort=${cdpPort}`,
            `cdpReady=${cdpReady}`,
            `connectionCount=${cdpHandler ? cdpHandler.getConnectionCount() : 0}`,
            `pollInterval=${pollInterval}`,
            `maxRetries=${maxRetries}`,
            `retryCooldownMs=${retryCooldownMs}`,
            `stats.retries=${stats.retries || 0}`,
            `stats.errorsDetected=${stats.errorsDetected || 0}`,
            `stats.consecutiveRetries=${stats.consecutiveRetries || 0}`,
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
    if (cdpHandler) {
        cdpHandler.stop().catch(() => {});
    }
    log('AutoContinue: Deactivated');
}

module.exports = { activate, deactivate };
