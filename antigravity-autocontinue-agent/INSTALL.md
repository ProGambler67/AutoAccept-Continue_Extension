# AutoContinue Agent — Installation Guide

Complete setup guide for someone starting with **only Antigravity installed**.

---

## Prerequisites

You need **Node.js** installed to build the extension. If you don't have it:

### Windows
1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** installer (`.msi`)
3. Run the installer — click Next through everything (defaults are fine)
4. Restart your terminal after install
5. Verify: open **PowerShell** and run:
   ```
   node --version
   npm --version
   ```
   Both should show version numbers.

### macOS
1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** installer (`.pkg`)
3. Run the installer
4. Verify: open **Terminal** and run:
   ```
   node --version
   npm --version
   ```

---

## Step 1: Get the Extension Files

Copy the entire `antigravity-autocontinue-agent` folder to your machine.

**Windows example:**
```
C:\Users\YourName\Desktop\antigravity-autocontinue-agent\
```

**macOS example:**
```
~/Desktop/antigravity-autocontinue-agent/
```

---

## Step 2: Install Dependencies

Open a terminal in the extension folder:

### Windows (PowerShell)
```powershell
cd "C:\Users\YourName\Desktop\antigravity-autocontinue-agent"
npm install
```

### macOS (Terminal)
```bash
cd ~/Desktop/antigravity-autocontinue-agent
npm install
```

You'll see packages installing. Wait for it to finish. Warnings are normal — errors are not.

---

## Step 3: Build the Extension

In the same terminal:

```
npm run compile
```

You should see:
```
dist/extension.js  156.9kb
Done in XXms
```

If you see this, the build succeeded. ✅

---

## Step 4: Package as VSIX

```
npx @vscode/vsce package --no-dependencies
```

> **Note:** If prompted to install `@vscode/vsce`, type `y` and press Enter.

This creates a file like `antigravity-autocontinue-1.0.0.vsix` in the folder.

---

## Step 5: Install in Antigravity

### Option A: Command Line

**Windows (PowerShell):**
```powershell
& "$env:LOCALAPPDATA\Programs\Antigravity\bin\antigravity.cmd" --install-extension "antigravity-autocontinue-1.0.0.vsix"
```

**macOS (Terminal):**
```bash
/Applications/Antigravity.app/Contents/Resources/app/bin/antigravity --install-extension antigravity-autocontinue-1.0.0.vsix
```

### Option B: Inside Antigravity UI
1. Open Antigravity
2. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (macOS)
3. Type: **Extensions: Install from VSIX...**
4. Browse to and select the `.vsix` file
5. Click **Install**
6. **Restart Antigravity** when prompted

---

## Step 6: Enable CDP (Required — One-Time Setup)

AutoContinue connects to Antigravity's internal browser via **Chrome DevTools Protocol (CDP)** on port 9000. You need to launch Antigravity with this flag.

### Windows

**Option 1: Desktop shortcut (recommended)**
1. Right-click your Antigravity desktop shortcut → **Properties**
2. In the **Target** field, add at the end: ` --remote-debugging-port=9000`
   
   Example:
   ```
   "C:\Users\YourName\AppData\Local\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9000
   ```
3. Click **OK**
4. Always launch Antigravity from this shortcut

**Option 2: PowerShell one-liner**
```powershell
& "$env:LOCALAPPDATA\Programs\Antigravity\Antigravity.exe" --remote-debugging-port=9000
```

### macOS

**Option 1: Terminal launch (recommended)**
```bash
open -a "Antigravity" --args --remote-debugging-port=9000
```

**Option 2: Create a launch script**
1. Open Terminal and run:
   ```bash
   echo '#!/bin/bash
   open -a "Antigravity" --args --remote-debugging-port=9000' > ~/Desktop/Launch-Antigravity-CDP.sh
   chmod +x ~/Desktop/Launch-Antigravity-CDP.sh
   ```
2. Double-click `Launch-Antigravity-CDP.sh` on your Desktop to launch

> **Important:** Antigravity must be **closed first**, then reopened with the CDP flag. If it's already running, close it and relaunch.

---

## Step 7: Activate AutoContinue

Once Antigravity is running with CDP enabled:

1. Look at the **bottom status bar** — you should see:
   - `$(sync) AutoContinue: OFF` 
   - `$(tools) AC Panel`

2. **Toggle ON** by either:
   - Clicking `AutoContinue: OFF` in the status bar, OR
   - Pressing `Ctrl+Shift+K` (Windows) / `Cmd+Shift+K` (macOS)

3. The status bar should now show: `AutoContinue: ON` with a spinning icon

4. **That's it!** The extension is now monitoring for errors and will auto-retry.

---

## Step 8: Open the Control Panel (Optional)

To see stats and configure settings:

1. Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (macOS)
2. Type: **AutoContinue: Open Control Panel**
3. You'll see:
   - ON/OFF toggle
   - Total retries, errors detected
   - CDP connection status
   - Configuration (port, max retries, cooldown)

---

## Troubleshooting

### "CDP not available on port 9000"
- Make sure you launched Antigravity with `--remote-debugging-port=9000`
- Close ALL Antigravity windows first, then relaunch with the flag
- Verify CDP is running: open a browser and go to `http://127.0.0.1:9000/json/version` — you should see JSON output

### Extension not showing in status bar
- Press `Ctrl+Shift+P` → type "AutoContinue" — if no commands appear, the extension didn't install
- Try reinstalling the VSIX (Step 5)
- Check the Output panel: View → Output → select "AutoContinue Agent" from dropdown

### "npm: command not found"
- Node.js is not installed. Follow the Prerequisites section above.

### Build fails
- Make sure you ran `npm install` first (Step 2)
- Try deleting `node_modules` and running `npm install` again

---

## Quick Reference

| Action | Windows | macOS |
|--------|---------|-------|
| Toggle AutoContinue | `Ctrl+Shift+K` | `Cmd+Shift+K` |
| Open Control Panel | `Ctrl+Shift+P` → "AutoContinue: Open Control Panel" | `Cmd+Shift+P` → "AutoContinue: Open Control Panel" |
| Launch with CDP | Add `--remote-debugging-port=9000` to Antigravity launch | `open -a "Antigravity" --args --remote-debugging-port=9000` |
