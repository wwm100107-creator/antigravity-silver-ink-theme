#!/usr/bin/env node
'use strict';

/**
 * Non-destructive live CDP verifier for Antigravity Custom Theme.
 * Inspects injected DOM layers, Zero-Live-Blur compliance, composer pill contrast,
 * split-browser hole cutout state, and scroll/layout metrics on open Antigravity pages.
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

if (typeof globalThis.WebSocket !== 'function') {
    console.error('[verify-cdp] Node.js >= 22 is required.');
    process.exit(1);
}

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

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { timeout: 2500 }, (res) => {
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

function evaluatePage(wsUrl, expression) {
    return new Promise((resolve, reject) => {
        const ws = new globalThis.WebSocket(wsUrl);
        const timer = setTimeout(() => {
            try {
                ws.close();
            } catch (_) {}
            reject(new Error('CDP evaluation timeout'));
        }, 4000);

        ws.addEventListener('open', () => {
            ws.send(
                JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: { expression, returnByValue: true, awaitPromise: true },
                })
            );
        });
        ws.addEventListener('message', (event) => {
            try {
                const msg = JSON.parse(String(event.data));
                if (msg.id === 1) {
                    clearTimeout(timer);
                    ws.close();
                    if (msg.error) reject(new Error(msg.error.message));
                    else if (msg.result && msg.result.exceptionDetails) {
                        reject(new Error(msg.result.exceptionDetails.text || 'Runtime exception'));
                    } else {
                        resolve(msg.result && msg.result.result ? msg.result.result.value : null);
                    }
                }
            } catch (_) {}
        });
        ws.addEventListener('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

const INSPECT_EXPR = `(() => {
    const styleEl = document.getElementById('antigravity-custom-theme-active');
    const shellEl = document.querySelector('.agy-shell');
    const mainGrid = document.querySelector('div.flex.h-full.flex-col.overflow-hidden.relative > div.flex.flex-1.flex-row.overflow-hidden.relative');
    const projPill = document.querySelector('[data-testid="project-selector-trigger"]');
    const envPill = document.querySelector('[aria-label="Select Environment"]');
    const scrollers = Array.from(document.querySelectorAll('.overflow-y-auto, [data-main-content-body], [data-side-panel-body]'));
    const liveBlurScrollers = scrollers.filter((el) => /blur\\(/i.test(getComputedStyle(el).backdropFilter || ''));
    const shellBackdrop = shellEl ? (getComputedStyle(shellEl).backdropFilter || 'none') : 'none';
    const hasLiveBlurRule = /blur\\(/i.test(shellBackdrop) || liveBlurScrollers.length > 0;
    return {
        url: location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        themeActive: Boolean(styleEl),
        activeTheme: localStorage.getItem('agy_theme_v3') || null,
        shellFound: Boolean(shellEl),
        shellBgImagePresent: shellEl ? getComputedStyle(shellEl).backgroundImage !== 'none' : false,
        hasBrowserHole: document.body.dataset.hasBrowserHole || null,
        shellHoleActive: shellEl ? shellEl.getAttribute('data-agy-hole-active') : null,
        mainGridFound: Boolean(mainGrid),
        projectPillBg: projPill ? getComputedStyle(projPill).backgroundColor : null,
        envPillBg: envPill ? getComputedStyle(envPill).backgroundColor : null,
        scrollerCount: scrollers.length,
        liveBlurScrollerCount: liveBlurScrollers.length,
        hasLiveBlurRule,
        settingsTriggerPresent: Boolean(document.getElementById('agy-custom-theme-sidebar-btn')),
        composerPresent: Boolean(document.querySelector('div.relative.flex.flex-col.rounded-lg.border')),
    };
})()`;

async function main() {
    const portFile = resolvePortFile();
    if (!fs.existsSync(portFile)) {
        console.error(`[verify-cdp] DevToolsActivePort not found at: ${portFile}`);
        process.exit(1);
    }

    const port = parseInt(fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/)[0], 10);
    const targets = await fetchJson(`http://127.0.0.1:${port}/json`);
    const pages = (Array.isArray(targets) ? targets : []).filter(
        (t) => t && t.type === 'page' && t.webSocketDebuggerUrl && String(t.url || '').includes('127.0.0.1')
    );

    if (pages.length === 0) {
        console.error(`[verify-cdp] No Antigravity CDP page targets found on port ${port}.`);
        process.exit(1);
    }

    const results = [];
    for (const page of pages) {
        const report = await evaluatePage(page.webSocketDebuggerUrl, INSPECT_EXPR);
        results.push({ id: page.id, title: page.title, ...report });
    }

    console.log(JSON.stringify(results, null, 2));

    const themedPages = results.filter((r) => r.themeActive);
    if (themedPages.length === 0) {
        console.error('[verify-cdp] FAIL: #antigravity-custom-theme-active not active on any page.');
        process.exit(1);
    }
    if (themedPages.some((r) => r.hasLiveBlurRule)) {
        console.error('[verify-cdp] FAIL: Detected backdrop-filter blur rule in injected style.');
        process.exit(1);
    }
    console.log(`[verify-cdp] PASS: ${themedPages.length}/${results.length} page(s) themed with zero live blur.`);
}

main().catch((err) => {
    console.error(`[verify-cdp] Error: ${err.message}`);
    process.exit(1);
});
