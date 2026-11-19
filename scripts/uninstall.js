#!/usr/bin/env node
'use strict';

/**
 * Cleanly uninstalls Antigravity Custom Theme across Windows, macOS, and Linux:
 * 1. Removes OS auto-start registration (Startup .lnk / LaunchAgent / systemd unit).
 * 2. Stops the running theme_daemon.js process and deletes daemon.pid / silent-start.vbs.
 * 3. Calls window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__() on open CDP targets.
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PID_FILE = path.join(ROOT_DIR, 'daemon.pid');
const VBS_FILE = path.join(ROOT_DIR, 'silent-start.vbs');

function resolvePortFile() {
    if (process.env.AGY_PORT_FILE) return process.env.AGY_PORT_FILE;
    const home = os.homedir();
    let candidates;
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        candidates = [
            path.join(appData, 'antigravity', 'DevToolsActivePort'),
            path.join(appData, 'Antigravity', 'DevToolsActivePort'),
        ];
    } else if (process.platform === 'darwin') {
        const appSupport = path.join(home, 'Library', 'Application Support');
        candidates = [
            path.join(appSupport, 'antigravity', 'DevToolsActivePort'),
            path.join(appSupport, 'Antigravity', 'DevToolsActivePort'),
        ];
    } else {
        const xdg = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
        candidates = [
            path.join(xdg, 'antigravity', 'DevToolsActivePort'),
            path.join(xdg, 'Antigravity', 'DevToolsActivePort'),
        ];
    }
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

function stopDaemon() {
    if (!fs.existsSync(PID_FILE)) {
        console.log('[uninstall] No active daemon.pid found.');
        return;
    }
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    if (pid) {
        try {
            process.kill(pid, 'SIGTERM');
            console.log(`[uninstall] Stopped daemon PID ${pid}.`);
        } catch (_) {
            console.log(`[uninstall] Daemon PID ${pid} already exited.`);
        }
    }
    try {
        fs.unlinkSync(PID_FILE);
    } catch (_) {}
}

function removeAutoStart() {
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        const lnk = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'AntigravityCustomTheme.lnk');
        if (fs.existsSync(lnk)) {
            fs.unlinkSync(lnk);
            console.log(`[uninstall] Removed Windows Startup shortcut: ${lnk}`);
        }
        if (fs.existsSync(VBS_FILE)) {
            fs.unlinkSync(VBS_FILE);
            console.log(`[uninstall] Removed helper script: ${VBS_FILE}`);
        }
        return;
    }

    if (process.platform === 'darwin') {
        const label = 'io.antigravity.custom-theme';
        const plist = path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
        try {
            execSync(`launchctl bootout gui/$(id -u)/${label}`, { stdio: 'ignore' });
        } catch (_) {
            try {
                if (fs.existsSync(plist)) execSync(`launchctl unload "${plist}"`, { stdio: 'ignore' });
            } catch (_) {}
        }
        if (fs.existsSync(plist)) {
            fs.unlinkSync(plist);
            console.log(`[uninstall] Removed LaunchAgent plist: ${plist}`);
        }
        return;
    }

    const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    const unitName = 'antigravity-custom-theme.service';
    const unitPath = path.join(xdg, 'systemd', 'user', unitName);
    try {
        execSync(`systemctl --user disable --now ${unitName}`, { stdio: 'ignore' });
    } catch (_) {}
    if (fs.existsSync(unitPath)) {
        fs.unlinkSync(unitPath);
        try {
            execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
        } catch (_) {}
        console.log(`[uninstall] Removed systemd user unit: ${unitPath}`);
    }
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { timeout: 2000 }, (res) => {
            let body = '';
            res.on('data', (c) => {
                body += c;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

function cleanupPage(wsUrl) {
    return new Promise((resolve) => {
        if (typeof globalThis.WebSocket !== 'function') {
            resolve();
            return;
        }
        const ws = new globalThis.WebSocket(wsUrl);
        const timer = setTimeout(() => {
            try {
                ws.close();
            } catch (_) {}
            resolve();
        }, 2500);

        ws.addEventListener('open', () => {
            ws.send(
                JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: 'window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ && window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__();',
                    },
                })
            );
        });
        ws.addEventListener('message', (event) => {
            try {
                const msg = JSON.parse(String(event.data));
                if (msg.id === 1) {
                    clearTimeout(timer);
                    ws.close();
                    resolve();
                }
            } catch (_) {}
        });
        ws.addEventListener('error', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

async function clearOpenPages() {
    const portFile = resolvePortFile();
    if (!fs.existsSync(portFile)) {
        console.log('[uninstall] Antigravity is not running (no DevToolsActivePort).');
        return;
    }
    const port = parseInt(fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/)[0], 10);
    if (!Number.isFinite(port) || port <= 0) return;

    try {
        const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
        const pages = (Array.isArray(targets) ? targets : []).filter(
            (t) => t && t.type === 'page' && t.webSocketDebuggerUrl && String(t.url || '').includes('127.0.0.1')
        );
        for (const p of pages) {
            await cleanupPage(p.webSocketDebuggerUrl);
            console.log(`[uninstall] Cleared theme from page ${p.id}.`);
        }
    } catch (err) {
        console.log(`[uninstall] CDP cleanup skipped (${err.message}).`);
    }
}

async function main() {
    removeAutoStart();
    stopDaemon();
    await clearOpenPages();
    console.log('[uninstall] Done. Antigravity theme removed.');
}

main();
