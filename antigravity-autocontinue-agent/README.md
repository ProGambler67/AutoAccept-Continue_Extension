# Antigravity AutoContinue Agent

**Automatic error detection and retry for Antigravity IDE.**

When Antigravity encounters "server traffic too high", rate limits, network errors, or agent execution failures — this extension automatically detects the error and sends a "continue" or "retry" action, keeping your workflow uninterrupted.

## Features

- 🔄 **Automatic Error Detection** — monitors 120+ error patterns (rate limits, server errors, connection failures, agent execution errors)
- ⚡ **Instant Retry** — clicks Continue/Retry buttons automatically or sends "continue" via chat input as fallback
- 🎛️ **Simple Control Panel** — toggle ON/OFF, view retry stats, configure settings
- 🔒 **Safety Guards** — cooldowns, max retry limits, user-typing detection, deduplication
- 🖥️ **Cross-Platform** — works on Windows 10, macOS, and Linux
- ⌨️ **Keyboard Shortcut** — `Ctrl+Shift+K` (macOS: `Cmd+Shift+K`) to toggle

## Installation

### From VSIX

```bash
cd antigravity-autocontinue-agent
npm install
npm run build:vsix
# Install the generated .vsix file in Antigravity
antigravity --install-extension antigravity-autocontinue-1.0.0.vsix
```

### Development

```bash
cd antigravity-autocontinue-agent
npm install
npm run compile
```

## Setup

1. **Enable CDP** — Launch Antigravity with `--remote-debugging-port=9000`
2. **Toggle ON** — Click the status bar item or press `Ctrl+Shift+K`
3. **Done** — The extension automatically detects and recovers from errors

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `autoContinue.cdpPort` | `9000` | CDP port for IDE connection |
| `autoContinue.pollInterval` | `500` | Polling interval (ms) for error detection |
| `autoContinue.maxRetries` | `50` | Max consecutive retries before pausing |
| `autoContinue.retryCooldownMs` | `3000` | Cooldown between retries (ms) |

## Commands

| Command | Description |
|---------|-------------|
| `AutoContinue: Toggle ON/OFF` | Enable/disable auto-retry |
| `AutoContinue: Open Control Panel` | Open the settings and stats panel |
| `AutoContinue: Copy Diagnostics` | Copy diagnostic info to clipboard |
| `AutoContinue: Open Output Log` | Show the extension output log |

## Error Patterns Detected

The extension detects 120+ error patterns including:

- **Rate Limiting**: "server traffic too high", "rate limit", "too many requests", "quota exceeded"
- **Server Errors**: "service unavailable", "server error", "internal server error", "server overloaded"
- **Network Issues**: "connection error", "network error", "request failed", "fetch failed"
- **HTTP Status Codes**: 429, 500, 502, 503 in error messages
- **Agent Errors**: "agent execution terminated", "generation stopped", "response interrupted"
- **Flow Interruption**: "continue generating", "try again", "something went wrong"
- **Antigravity-Specific**: "capacity constraints", "high demand", "model unavailable"

## Architecture

```
extension.js          → VS Code extension entry point (activation, toggle, control panel)
main_scripts/
  cdp-handler.js      → CDP WebSocket connection to IDE (port scanning, script injection)
  auto-continue.js    → Injected DOM script (MutationObserver + poll loop for error detection)
```

## License

MIT
