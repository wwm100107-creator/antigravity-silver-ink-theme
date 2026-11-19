# Antigravity Custom Theme Skill

Turn any wallpaper, aesthetic mood, or color palette into a live, 60fps custom theme inside **Antigravity** — packaged as both a standalone cross-platform CDP theme engine and a drop-in **AI Agent Skill** (`SKILL.md`).

> Give your AI agent an image + vibe ("cosmic violin gold on deep midnight", "cozy Kyoto matcha", "cyberpunk neon cyan"), and let it extract the palette, stage assets, compile the payload, and hot-reload your Antigravity UI cleanly without touching Electron app binaries.

## Features

- **Zero Live Blur Architecture (60fps Scroll):** Uses pre-baked offscreen canvas glass (`syncPrebakedGlass`) and gradient scrims instead of CSS `backdrop-filter: blur()`, preventing Electron/GPU scroll lag.
- **Unified L-Glass + Split-Browser Safe:** Automatically detects Antigravity's split embedded Chromium view (`data-has-browser-hole`) and cuts an `evenodd` `clip-path` window so embedded pages never get tinted or blurred.
- **Live Settings Modal:** Switch presets, upload custom wallpapers or **User / AI Agent circular avatars** (auto-compressed WebP), adjust scrim darkness, and persist choices to `theme_config.json`.
- **Light & Dark Glass Modes:** Supports both deep dark themes and daytime bright palettes (`isLight: true`) with adaptive ink, frosted pills, and titlebar controls.
- **Two Lightweight Sample Presets Included:**
  - `WLOP Cosmic` — 2K starlight wallpaper + custom SVG flourishes (`themes/assets/wlop_cosmic_2k.webp`)
  - `Midnight Obsidian` — Ultra-light zero-image pure-CSS gradient preset
- **Data/Engine Separation:** Add your own themes solely inside `themes/themes.json` + `themes/assets/` and compile via `scripts/build_payload.py`.
- **Cross-Platform Daemon (`daemon/theme_daemon.js`):** Windows, macOS, and Linux support using Node >= 22 built-in `WebSocket`, bounded `--max-old-space-size=48` heap, and local lazy asset streaming (`http://127.0.0.1:<port>`).

## Download Ready-to-Use Releases

Download the pre-built package that fits your machine from [**GitHub Releases**](https://github.com/wwm100107-creator/antigravity-silver-ink-theme/releases/latest):

- **[Antigravity-SilverInk-Ultra.zip](https://github.com/wwm100107-creator/antigravity-silver-ink-theme/releases/latest/download/Antigravity-SilverInk-Ultra.zip)** (`~32.8 MB`) — High-End PC: 60 FPS live video wallpaper, eye-tracking, full 60 FPS canvas VFX & iOS tab glide
- **[Antigravity-SilverInk-Lite.zip](https://github.com/wwm100107-creator/antigravity-silver-ink-theme/releases/latest/download/Antigravity-SilverInk-Lite.zip)** (`~1.65 MB`) — Low-End / Eco RAM PC: Crisp 1080p static wallpaper, 1-shot crisp VFX (`0` idle `rAF` loops) & iOS tab glide

## Dual Editions: Ultra vs Lite

You can switch between **Ultra** and **Lite** live anytime inside **Custom Theme Studio → Performance Edition**, or share two dedicated pre-built ZIP releases with the community:

| Feature / Resource | **Ultra Edition (High-End PC)** | **Lite Edition (Low-End / Eco RAM)** |
|---|---|---|
| **Background** | 60 FPS Live Video Wallpaper | Crisp 1080p Static WebP (`ink_starlight_lite_1080p.webp`) |
| **Interactive Gaze** | Real-time Eye-Tracking & Blink Sync | Disabled (0 CPU/GPU idle overhead) |
| **UI & Composer VFX** | 60 FPS animated (`1B`, `2F`, `3B-1`, `4A-2`, Composer & Avatars) | Crisp **1-shot static canvas VFX** (`0` idle `rAF` loops) |
| **Sidebar Tab Switch** | iOS GPU-Composited Glide Pill | iOS GPU-Composited Glide Pill (identical!) |
| **Viewport Virtualization** | Off-screen canvases unmounted beyond `viewport ± 440px` | Off-screen canvases unmounted beyond `viewport ± 440px` |
| **Estimated Extra RAM** | Optimized GPU + Daemon (`~28–35 MB` Node daemon) | Minimal static buffers (`~25–40 MB` total overhead) |
| **Community ZIP Size** | `~32.8 MB` (`Antigravity-SilverInk-Ultra.zip`) | `~1.65 MB` (`Antigravity-SilverInk-Lite.zip`) |

### Package Both Community Releases

```bash
python scripts/package_releases.py
```

Outputs ready-to-share folders & `.zip` archives under gitignored `releases/`:
- `releases/Antigravity-SilverInk-Ultra.zip` (includes `INSTALL_WINDOWS.bat` / `UNINSTALL.bat` & full assets)
- `releases/Antigravity-SilverInk-Lite.zip` (includes `INSTALL_WINDOWS.bat` / `UNINSTALL.bat`, 1080p backdrop, no heavy `.mp4`/4K poster)

## Prerequisites

- **Antigravity** running with CDP debugging port active (`DevToolsActivePort`)
- **Node.js >= 22** (uses native `globalThis.WebSocket`, zero `npm install` needed)
- **Python 3.9+** (only needed when rebuilding presets; release ZIPs ship with `dist/theme_payload.js` pre-built)

## Quick Start

> **Easy Windows Install (from Release ZIP):** Extract the ZIP and double-click **`INSTALL_WINDOWS.bat`** (or `UNINSTALL.bat` to remove).

### 1. Build the Runtime Payload

```bash
# Default Ultra profile (includes video/eye-tracking support)
python scripts/build_payload.py --profile ultra

# Or Lite profile (strips video & eye-tracking metadata, defaults to Eco mode)
python scripts/build_payload.py --profile lite
```

This validates `themes/themes.json` + `themes/assets/*` and compiles them with `engine/core.js` into gitignored `dist/theme_payload.js` (~250 KB with lazy HTTP wallpaper loading).

### 2. Install & Run the Daemon

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-win.ps1
# Optional: force profile on first install (-Profile Ultra or -Profile Lite)
powershell -ExecutionPolicy Bypass -File scripts/install-win.ps1 -Profile Lite
```

Creates a hidden launcher in your Windows Startup folder (`AntigravityCustomTheme.lnk`) without hardcoding paths and attaches silently. Pass `-NoStartup` if you only want to run it for the current session.

**macOS / Linux (Bash):**

```bash
bash scripts/install-unix.sh
# Optional: specify --profile ultra or --profile lite
bash scripts/install-unix.sh install --profile lite
```

- On **macOS**, installs a `~/Library/LaunchAgents/io.antigravity.custom-theme.plist` LaunchAgent.
- On **Linux**, installs a `systemd --user` service (or falls back to `nohup`).
- Use `bash scripts/install-unix.sh --foreground` to run interactively in your terminal, or `stop` / `status`.

> **Platform Testing Note:** Windows (`install-win.ps1`, CDP hot-reload, uninstall) has been verified live against Antigravity on Windows 11. macOS (`launchd`) and Linux (`systemd --user`) scripts are implemented and shell-syntax verified, and welcome community runtime feedback across macOS/Linux setups (you can override `DevToolsActivePort` location anytime via `AGY_PORT_FILE=/path/to/DevToolsActivePort`).

### 3. Verify Live via CDP

```bash
node scripts/verify_cdp.js
```

### 4. Uninstall Cleanly

```bash
node scripts/uninstall.js
```

Removes auto-start shortcuts/services, stops the background daemon, and immediately restores Antigravity's default styling on open windows.

## Use as an Antigravity Skill (`SKILL.md`)

Copy or clone this repository into either:

- **Global skill directory:** `~/.gemini/config/skills/antigravity-custom-theme/`
- **Workspace skill directory:** `.agents/skills/antigravity-custom-theme/`

Once installed, simply prompt your Antigravity agent with an image and aesthetic preference (e.g., *"Use `antigravity-custom-theme` to build me a dark emerald studio Ghibli theme from this image"*). The agent reads `SKILL.md` + `references/theme-schema.md`, creates your preset in `themes/`, builds `dist/theme_payload.js`, and verifies it via `verify_cdp.js`.

## Repository Structure

```text
antigravity-custom-theme-skill/
├── SKILL.md                    # Agent skill definition & workflow
├── README.md
├── LICENSE                     # MIT
├── references/
│   └── theme-schema.md         # themes.json schema & DOM notes
├── themes/
│   ├── themes.json             # Sample theme presets
│   └── assets/                 # Wallpapers & SVG stickers/corners
├── engine/
│   └── core.js                 # Core injection engine (Zero Live Blur + UI)
├── daemon/
│   └── theme_daemon.js         # Cross-platform CDP injector & config persistence
├── scripts/
│   ├── build_payload.py        # Compiles themes.json + core.js -> dist/theme_payload.js
│   ├── install-win.ps1         # Windows Startup launcher setup
│   ├── install-unix.sh         # macOS LaunchAgent / Linux systemd user setup
│   ├── uninstall.js            # Clean cross-platform removal
│   └── verify_cdp.js           # Live CDP diagnostic & assertion check
└── dist/                       # Gitignored compiled runtime output
```

## License

MIT
