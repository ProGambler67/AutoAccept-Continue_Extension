const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_PORT = 9000;
const DEFAULT_PORT_RANGE = 3;

function normalizePort(value, fallback = DEFAULT_BASE_PORT) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const port = Math.trunc(num);
    if (port < 1 || port > 65535) return fallback;
    return port;
}

function normalizePortRange(value, fallback = DEFAULT_PORT_RANGE) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const range = Math.trunc(num);
    if (range < 0 || range > 32) return fallback;
    return range;
}

// Load auto-continue.js script
let _autoContinueScript = null;
function getAutoContinueScript() {
    if (_autoContinueScript) return _autoContinueScript;

    const candidates = [
        path.join(__dirname, 'auto-continue.js'),
        path.join(__dirname, 'main_scripts', 'auto-continue.js'),
        path.join(__dirname, '..', 'main_scripts', 'auto-continue.js')
    ];

    for (const scriptPath of candidates) {
        if (fs.existsSync(scriptPath)) {
            _autoContinueScript = fs.readFileSync(scriptPath, 'utf8');
            return _autoContinueScript;
        }
    }

    throw new Error(`auto-continue.js not found. __dirname=${__dirname}`);
}

class CDPHandler {
    constructor(logger = console.log) {
        this.logger = logger;
        this.connections = new Map();
        this.isEnabled = false;
        this.msgId = 1;
        this._lastConfigHash = '';
        this.basePort = DEFAULT_BASE_PORT;
        this.portRange = DEFAULT_PORT_RANGE;
    }

    log(msg) {
        this.logger(`[CDP] ${msg}`);
    }

    getPortCandidates(basePort = this.basePort, portRange = this.portRange) {
        const base = normalizePort(basePort, DEFAULT_BASE_PORT);
        const range = normalizePortRange(portRange, DEFAULT_PORT_RANGE);
        const ports = [];
        for (let port = base - range; port <= base + range; port++) {
            if (port >= 1 && port <= 65535) {
                ports.push(port);
            }
        }
        return ports;
    }

    async getAvailablePorts(portCandidates = null) {
        const candidates = Array.isArray(portCandidates) && portCandidates.length > 0
            ? [...new Set(portCandidates.map(p => normalizePort(p, 0)).filter(p => p > 0))]
            : this.getPortCandidates();
        const available = [];
        for (const port of candidates) {
            try {
                const pages = await this._getPages(port);
                if (pages.length > 0) {
                    available.push(port);
                }
            } catch (e) { }
        }
        return available;
    }

    async isCDPAvailable(port = this.basePort, portRange = this.portRange) {
        const candidates = this.getPortCandidates(port, portRange);
        for (const p of candidates) {
            try {
                const pages = await this._getPages(p);
                if (pages.length > 0) return true;
            } catch (e) { }
        }
        return false;
    }

    async start(config) {
        this.isEnabled = true;
        this.basePort = normalizePort(config?.cdpPort, this.basePort);
        this.portRange = normalizePortRange(config?.cdpPortRange, this.portRange);
        const candidates = this.getPortCandidates(this.basePort, this.portRange);
        const candidateSet = new Set(candidates);

        // Close connections to ports no longer in range
        for (const [id, conn] of Array.from(this.connections.entries())) {
            const port = Number(String(id).split(':')[0]);
            if (!candidateSet.has(port)) {
                try { conn.ws.close(); } catch (e) { }
                this.connections.delete(id);
            }
        }

        const quiet = !!config?.quiet;
        const configHash = JSON.stringify({
            p: this.basePort,
            r: this.portRange,
            mr: config?.maxRetries || 50,
            cd: config?.retryCooldownMs || 3000
        });

        if (!quiet || this._lastConfigHash !== configHash) {
            this.log(`Scanning ports ${candidates[0]} to ${candidates[candidates.length - 1]}...`);
        }
        this._lastConfigHash = configHash;

        for (const port of candidates) {
            try {
                const pages = await this._getPages(port);
                if (pages.length > 0) {
                    const newTargets = pages.filter(p => !this.connections.has(`${port}:${p.id}`));
                    if (!quiet || newTargets.length > 0) {
                        this.log(`Port ${port}: ${pages.length} page(s) found`);
                    }
                    for (const page of pages) {
                        const id = `${port}:${page.id}`;
                        if (!this.connections.has(id)) {
                            await this._connect(id, page.webSocketDebuggerUrl);
                        }
                        await this._inject(id, config);
                    }
                }
            } catch (e) {
                // Port not available
            }
        }
    }

    async stop() {
        this.isEnabled = false;
        for (const [id, conn] of this.connections) {
            try {
                await this._evaluate(id, 'if(window.__autoContinueStop) window.__autoContinueStop()');
                conn.ws.close();
            } catch (e) { }
        }
        this.connections.clear();
    }

    async _getPages(port) {
        return new Promise((resolve, reject) => {
            const req = http.get({
                hostname: '127.0.0.1',
                port,
                path: '/json/list',
                timeout: 500
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const pages = JSON.parse(body);
                        const filtered = pages.filter(p => {
                            if (!p.webSocketDebuggerUrl) return false;
                            if (p.type !== 'page' && p.type !== 'webview') return false;
                            const url = (p.url || '').toLowerCase();
                            if (url.startsWith('devtools://') || url.startsWith('chrome-devtools://')) return false;
                            return true;
                        });
                        resolve(filtered);
                    } catch (e) {
                        resolve([]);
                    }
                });
            });
            req.on('error', () => resolve([]));
            req.on('timeout', () => {
                req.destroy();
                resolve([]);
            });
        });
    }

    async _connect(id, url) {
        return new Promise((resolve) => {
            const ws = new WebSocket(url);
            const timeout = setTimeout(() => {
                try { ws.terminate(); } catch (e) { }
                resolve(false);
            }, 3000);

            ws.on('open', () => {
                clearTimeout(timeout);
                this.connections.set(id, { ws, injected: false });
                this.log(`Connected to page ${id}`);
                resolve(true);
            });
            ws.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
            ws.on('close', () => {
                clearTimeout(timeout);
                this.connections.delete(id);
                this.log(`Disconnected from page ${id}`);
            });
        });
    }

    async _inject(id, config) {
        const conn = this.connections.get(id);
        if (!conn) return;

        const quiet = !!config?.quiet;

        try {
            // Check whether script is still present (webviews can reload)
            if (conn.injected) {
                try {
                    const existsRes = await this._evaluate(id, 'typeof window.__autoContinueStart === "function"');
                    const exists = !!existsRes?.result?.value;
                    if (!exists) {
                        conn.injected = false;
                        if (!quiet) {
                            this.log(`Script missing in ${id}; reinjecting...`);
                        }
                    }
                } catch (e) {
                    conn.injected = false;
                }
            }

            // Inject script when needed
            if (!conn.injected) {
                const script = getAutoContinueScript();
                if (!quiet) {
                    this.log(`Injecting auto-continue script into ${id} (${(script.length / 1024).toFixed(1)}KB)...`);
                }
                await this._safeEvaluate(id, script, 1);
                conn.injected = true;
                if (!quiet) {
                    this.log(`Script injected into ${id}`);
                }
            }

            // Check if running, start if not
            let isRunning = false;
            try {
                const runningRes = await this._safeEvaluate(id, '!!(window.__autoContinueState && window.__autoContinueState.isRunning)', 1);
                isRunning = !!runningRes?.result?.value;
            } catch (e) {
                isRunning = false;
            }

            if (!isRunning) {
                const configJson = JSON.stringify({
                    maxRetries: config.maxRetries || 50,
                    retryCooldownMs: config.retryCooldownMs || 3000,
                    pollInterval: config.pollInterval || 500,
                    isBackgroundMode: !!config.isBackgroundMode
                });
                if (!quiet) {
                    this.log(`Calling __autoContinueStart in ${id}`);
                }
                await this._safeEvaluate(id, `if(window.__autoContinueStart) window.__autoContinueStart(${configJson})`, 1);
            }
        } catch (e) {
            this.log(`Failed to inject into ${id}: ${e.message}`);
        }
    }

    async _safeEvaluate(id, expression, retries = 0) {
        let attempts = 0;
        while (true) {
            try {
                return await this._evaluate(id, expression);
            } catch (e) {
                if (attempts >= retries) throw e;
                attempts += 1;
                await new Promise(r => setTimeout(r, 120));
            }
        }
    }

    async _evaluate(id, expression) {
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== WebSocket.OPEN) return;

        return new Promise((resolve, reject) => {
            const currentId = this.msgId++;
            const timeout = setTimeout(() => {
                conn.ws.off('message', onMessage);
                reject(new Error('CDP Timeout'));
            }, 4500);

            const onMessage = (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id === currentId) {
                        conn.ws.off('message', onMessage);
                        clearTimeout(timeout);
                        resolve(msg.result);
                    }
                } catch (e) {}
            };

            conn.ws.on('message', onMessage);
            try {
                conn.ws.send(JSON.stringify({
                    id: currentId,
                    method: 'Runtime.evaluate',
                    params: { expression, userGesture: true, awaitPromise: true }
                }));
            } catch (e) {
                conn.ws.off('message', onMessage);
                clearTimeout(timeout);
                reject(e);
            }
        });
    }

    getConnectionCount() {
        return this.connections.size;
    }

    async getStats() {
        const stats = { retries: 0, errorsDetected: 0, lastError: '', lastRetryAt: '', consecutiveRetries: 0 };
        for (const [id] of this.connections) {
            try {
                const res = await this._evaluate(id, 'JSON.stringify(window.__autoContinueGetStats ? window.__autoContinueGetStats() : {})');
                if (res?.result?.value) {
                    const s = JSON.parse(res.result.value);
                    stats.retries += s.retries || 0;
                    stats.errorsDetected += s.errorsDetected || 0;
                    stats.consecutiveRetries = Math.max(stats.consecutiveRetries, s.consecutiveRetries || 0);
                    if (s.lastError) {
                        stats.lastError = s.lastError;
                    }
                    if (s.lastRetryAt) {
                        stats.lastRetryAt = s.lastRetryAt;
                    }
                }
            } catch (e) { }
        }
        return stats;
    }
}

module.exports = { CDPHandler };
