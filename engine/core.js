(() => {
  const THEMES = /*__THEMES_PLACEHOLDER__*/{};
  const THEME_KEYS = Object.keys(THEMES);
  const DEFAULT_THEME_KEY = THEME_KEYS[0] || 'Default';
  const BUILD_PROFILE = /*__BUILD_PROFILE__*/'ultra';
  const DEFAULT_PERF_MODE = /*__DEFAULT_PERF_MODE__*/'ultra';
  const LITE_STATIC_T = 2400;

  const STORAGE_THEME = 'agy_theme_v3';
  const STORAGE_BUBBLE = 'agy_bubble_v3';
  const STORAGE_INPUT = 'agy_input_v3';
  const STORAGE_DIMMING = 'agy_dimming_v3';
  const STORAGE_WP_ENABLED = 'agy_wp_enabled_v3';
  const STORAGE_CUSTOM_WP = 'agy_custom_wp_v3';
  const STORAGE_USER_AVATAR = 'agy_user_avatar_v3';
  const STORAGE_AGENT_AVATAR = 'agy_agent_avatar_v3';
  const STORAGE_GLASS_BLUR = 'agy_glass_blur_v3';
  const STORAGE_AVATAR_SIZE = 'agy_avatar_size_v3';
  const STORAGE_AVATAR_RADIUS = 'agy_avatar_radius_v3';
  const STORAGE_PERF_MODE = 'agy_perf_mode_v3';
  const STORAGE_INPUT_OPACITY = 'agy_input_opacity_v3';
  const STORAGE_USER_BUBBLE_OPACITY = 'agy_user_bubble_opacity_v3';
  const STORAGE_AI_BUBBLE_OPACITY = 'agy_ai_bubble_opacity_v3';

  function parseOptionalPct(raw) {
    if (raw === undefined || raw === null || raw === '' || raw === 'null') return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
  }

  function getMeanCssAlphaPct(cssBg, fallbackPct = 70) {
    if (!cssBg || typeof cssBg !== 'string') return fallbackPct;
    const re = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9]*\.?[0-9]+)\s*\)/gi;
    const vals = [];
    let m;
    while ((m = re.exec(cssBg)) !== null) {
      const a = parseFloat(m[1]);
      if (Number.isFinite(a)) vals.push(Math.min(1, Math.max(0, a)));
    }
    if (!vals.length) return fallbackPct;
    return Math.round((vals.reduce((acc, v) => acc + v, 0) / vals.length) * 100);
  }

  function scaleCssBgAlpha(cssBg, targetPct) {
    if (!cssBg || typeof cssBg !== 'string' || targetPct === null || targetPct === undefined) return cssBg;
    const re = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)/gi;
    const alphas = [];
    let m;
    while ((m = re.exec(cssBg)) !== null) {
      const a = parseFloat(m[4]);
      if (Number.isFinite(a)) alphas.push(Math.min(1, Math.max(0, a)));
    }
    if (!alphas.length) return cssBg;
    const targetA = Math.min(1, Math.max(0, targetPct / 100));
    const meanA = alphas.reduce((acc, v) => acc + v, 0) / alphas.length;
    const spanScale = (targetA <= 0.001 || targetA >= 0.999)
      ? 0
      : Math.min(
          1,
          meanA > 0.001 ? targetA / meanA : 1,
          (1 - meanA) > 0.001 ? (1 - targetA) / (1 - meanA) : 1
        );
    return cssBg.replace(re, (_full, r, g, b, aStr) => {
      const a = parseFloat(aStr);
      const nextA = targetA <= 0.001
        ? 0
        : targetA >= 0.999
        ? 1
        : Math.min(1, Math.max(0, targetA + (a - meanA) * spanScale));
      return `rgba(${r}, ${g}, ${b}, ${Number(nextA.toFixed(3))})`;
    });
  }

  function getRawInputCardBg(bubbleTheme, inputStyle) {
    return inputStyle === 'glass'
      ? (bubbleTheme.inputGlassBg || 'rgba(20, 15, 13, 0.52)')
      : inputStyle === 'double_gold'
      ? 'linear-gradient(145deg, rgba(44, 28, 20, 0.90) 0%, rgba(24, 15, 12, 0.92) 100%)'
      : (bubbleTheme.inputCardBg || 'rgba(28, 19, 16, 0.88)');
  }

  function resolveAssetUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    if (/^(data:|http:\/\/|https:\/\/|blob:)/i.test(raw)) return raw;
    const base = window.__AGY_ASSET_BASE_URL__ || '';
    return base ? `${base.replace(/\/$/, '')}/${raw.replace(/^\//, '')}` : raw;
  }

  function getEffectiveDpr(perfMode) {
    const raw = window.devicePixelRatio || 1;
    if (perfMode === 'lite') {
      return Math.min(1.5, Math.max(1, raw));
    }
    return Math.min(2, Math.max(1.25, raw));
  }

  const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  const INPUT_STYLES = {
    'sync': {
      label: 'Synced Ornament Frame',
      desc: 'Follows the active theme borders & decorative SVG ornament'
    },
    'double_gold': {
      label: 'Amber Gold Double Border',
      desc: 'Warm metallic double border with corner filigree'
    },
    'glass': {
      label: 'Translucent Crystal Glass',
      desc: 'Lets more of your background artwork shine through'
    },
    'minimal': {
      label: 'Minimal Clean',
      desc: 'Sleek subtle border without top decorative stickers'
    }
  };

  function getState() {
    const init = window.__AGY_INITIAL_CONFIG__ || {};
    const rawTheme = localStorage.getItem(STORAGE_THEME) || init.themeName || DEFAULT_THEME_KEY;
    const themeName = THEMES[rawTheme] ? rawTheme : DEFAULT_THEME_KEY;
    const rawBubble = localStorage.getItem(STORAGE_BUBBLE) || init.bubbleName || themeName;
    const bubbleName = THEMES[rawBubble] ? rawBubble : themeName;
    const inputStyle = localStorage.getItem(STORAGE_INPUT) || init.inputStyle || 'sync';
    const dimming = parseInt(localStorage.getItem(STORAGE_DIMMING) || (init.dimming !== undefined ? init.dimming : '69'), 10);
    const wpEnabled = localStorage.getItem(STORAGE_WP_ENABLED) !== null
      ? localStorage.getItem(STORAGE_WP_ENABLED) !== 'false'
      : (init.wpEnabled !== undefined ? init.wpEnabled : true);
    const customWp = localStorage.getItem(STORAGE_CUSTOM_WP) || init.customWp || '';
    const userAvatar = localStorage.getItem(STORAGE_USER_AVATAR) ?? init.userAvatar ?? '';
    const agentAvatar = localStorage.getItem(STORAGE_AGENT_AVATAR) ?? init.agentAvatar ?? '';
    const rawBlur = localStorage.getItem(STORAGE_GLASS_BLUR) ?? init.glassBlur;
    const glassBlur = rawBlur !== undefined && rawBlur !== null && rawBlur !== '' ? parseInt(rawBlur, 10) : 3;
    const rawAvSize = localStorage.getItem(STORAGE_AVATAR_SIZE) ?? init.avatarSize;
    const avatarSize = rawAvSize !== undefined && rawAvSize !== null && rawAvSize !== '' ? parseInt(rawAvSize, 10) : 32;
    const rawAvRad = localStorage.getItem(STORAGE_AVATAR_RADIUS) ?? init.avatarRadius;
    const avatarRadius = rawAvRad !== undefined && rawAvRad !== null && rawAvRad !== '' ? parseInt(rawAvRad, 10) : 50;
    const rawPerf = localStorage.getItem(STORAGE_PERF_MODE) || init.performanceMode || DEFAULT_PERF_MODE;
    const performanceMode = rawPerf === 'lite' ? 'lite' : 'ultra';
    const inputOpacity = parseOptionalPct(localStorage.getItem(STORAGE_INPUT_OPACITY) ?? init.inputOpacity);
    const userBubbleOpacity = parseOptionalPct(localStorage.getItem(STORAGE_USER_BUBBLE_OPACITY) ?? init.userBubbleOpacity);
    const aiBubbleOpacity = parseOptionalPct(localStorage.getItem(STORAGE_AI_BUBBLE_OPACITY) ?? init.aiBubbleOpacity);
    return { themeName, bubbleName, inputStyle, dimming, wpEnabled, customWp, userAvatar, agentAvatar, glassBlur, avatarSize, avatarRadius, performanceMode, inputOpacity, userBubbleOpacity, aiBubbleOpacity };
  }

  // Downscale user/agent avatar uploads to 192x192 WebP once so theme_config.json stays tiny
  function compressAvatarFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = 192;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const natW = img.naturalWidth || size;
          const natH = img.naturalHeight || size;
          const side = Math.min(natW, natH);
          const sx = Math.max(0, Math.floor((natW - side) / 2));
          const sy = Math.max(0, Math.floor((natH - side) / 2));
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          const out = canvas.toDataURL('image/webp', 0.88);
          callback(out && out.startsWith('data:image/webp') ? out : canvas.toDataURL('image/png'));
        } catch (e) {
          callback(String(reader.result || ''));
        }
      };
      img.onerror = () => callback(String(reader.result || ''));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  // Pre-bake L-shaped header/sidebar glass blur once per theme/dimming change to avoid per-frame GPU backdrop readback
  function syncPrebakedGlass(wpUrl, overlayRgb, overlayAlpha, tintBg, blurStr) {
    const shell = document.querySelector('.agy-shell');
    if (!wpUrl) {
      if (shell) shell.style.removeProperty('--agy-l-glass-bg');
      return;
    }
    const key = `${wpUrl.slice(0, 64)}|${wpUrl.length}|${overlayRgb}|${overlayAlpha.toFixed(3)}|${tintBg}|${blurStr}`;
    window.__AGY_BLUR_CACHE__ = window.__AGY_BLUR_CACHE__ || {};
    const cached = window.__AGY_BLUR_CACHE__[key];
    if (cached) {
      if (shell) shell.style.setProperty('--agy-l-glass-bg', 'url("' + cached + '")');
      return;
    }
    const img = new Image();
    if (!/^data:/i.test(wpUrl)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const w = 640;
        const h = Math.max(180, Math.round((img.naturalHeight || 1440) * (w / (img.naturalWidth || 2560))));
        window.__AGY_GLASS_ASPECT__ = w / h;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pxMatch = String(blurStr !== undefined ? blurStr : '3px').match(/(\d+(?:\.\d+)?)/);
        const scaledBlur = Math.max(0, Math.min(16, Math.round((pxMatch ? parseFloat(pxMatch[1]) : 3) * 0.75)));
        ctx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none';
        ctx.drawImage(img, -12, -12, w + 24, h + 24);
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(${overlayRgb}, ${overlayAlpha})`;
        ctx.fillRect(0, 0, w, h);
        if (tintBg) {
          ctx.fillStyle = tintBg;
          ctx.fillRect(0, 0, w, h);
        }
        const baked = canvas.toDataURL('image/webp', 0.85);
        const cache = window.__AGY_BLUR_CACHE__ || (window.__AGY_BLUR_CACHE__ = {});
        const oldKeys = Object.keys(cache);
        while (oldKeys.length >= 2) {
          delete cache[oldKeys.shift()];
        }
        cache[key] = baked;
        const curShell = document.querySelector('.agy-shell');
        if (curShell) {
          curShell.style.setProperty('--agy-l-glass-bg', 'url("' + baked + '")');
          if (typeof syncShellMetrics === 'function') syncShellMetrics();
        }
      } catch (e) {}
    };
    img.src = wpUrl;
  }

  function releaseVideoLayer(shell) {
    const old = document.getElementById('agy-custom-theme-video-layer');
    if (old) {
      const oldVid = old.querySelector('#agy-custom-theme-video');
      if (oldVid) {
        try {
          oldVid.pause();
          oldVid.removeAttribute('src');
          oldVid.load();
        } catch (_) {}
      }
      old.remove();
    }
    if (shell) delete shell.dataset.agyVideoReady;
  }

  function syncVideoWallpaper(st, mainTheme, overlayRgb, overlayAlpha, bgPosition) {
    const shell = document.querySelector('.agy-shell');
    const isLite = st.performanceMode === 'lite';
    const rawVideo = !st.customWp
      ? (mainTheme.videoWallpaper || '')
      : (st.customWp.startsWith('data:video/') || /\.(mp4|webm)(\?|$)/i.test(st.customWp) ? st.customWp : '');
    if (isLite || !shell || !st.wpEnabled || !rawVideo) {
      releaseVideoLayer(shell);
      stopEyeTrackingRig(false);
      return;
    }
    const videoUrl = resolveAssetUrl(rawVideo);
    if (!videoUrl) return;

    let layer = document.getElementById('agy-custom-theme-video-layer');
    if (!layer || layer.parentElement !== shell || !layer.querySelector('#agy-custom-theme-eye-canvas') || !layer.querySelector('video[crossorigin="anonymous"]') || layer.querySelector('#agy-custom-theme-video-scrim') || layer.querySelector('#agy-4k-sharpen')) {
      releaseVideoLayer(shell);
      layer = document.createElement('figure');
      layer.id = 'agy-custom-theme-video-layer';
      layer.innerHTML = `
        <video id="agy-custom-theme-video" crossorigin="anonymous" autoplay loop muted playsinline></video>
        <canvas id="agy-custom-theme-eye-canvas" width="1370" height="330"></canvas>
      `;
      shell.insertBefore(layer, shell.firstChild);
    }
    const vid = layer.querySelector('#agy-custom-theme-video');
    if (vid && !vid.dataset.agyEventsBound) {
      vid.dataset.agyEventsBound = '1';
      const ensurePlay = () => {
        if (document.hidden || getState().performanceMode === 'lite') return;
        vid.defaultMuted = true;
        vid.muted = true;
        vid.loop = true;
        if (vid.paused) vid.play().catch(() => {});
      };
      const markReady = () => {
        if (vid.readyState >= 2) {
          const sh = document.querySelector('.agy-shell');
          if (sh) sh.dataset.agyVideoReady = '1';
        }
      };
      const clearReady = () => {
        const sh = document.querySelector('.agy-shell');
        if (sh) delete sh.dataset.agyVideoReady;
      };
      vid.addEventListener('loadedmetadata', ensurePlay);
      vid.addEventListener('loadeddata', () => { ensurePlay(); markReady(); });
      vid.addEventListener('canplay', ensurePlay);
      vid.addEventListener('playing', markReady);
      vid.addEventListener('emptied', clearReady);
      vid.addEventListener('error', clearReady);
      vid.addEventListener('pause', () => {
        if (!document.hidden && getState().performanceMode !== 'lite' && document.getElementById('agy-custom-theme-video') === vid) {
          setTimeout(ensurePlay, 50);
        }
      });
    }
    if (vid && vid.getAttribute('data-src') !== videoUrl) {
      delete shell.dataset.agyVideoReady;
      vid.setAttribute('data-src', videoUrl);
      vid.crossOrigin = 'anonymous';
      vid.defaultMuted = true;
      vid.muted = true;
      vid.loop = true;
      vid.src = videoUrl;
      vid.load();
      if (!document.hidden) vid.play().catch(() => {});
    } else if (vid) {
      if (vid.readyState >= 2) shell.dataset.agyVideoReady = '1';
      if (vid.paused && !document.hidden) {
        vid.defaultMuted = true;
        vid.muted = true;
        vid.play().catch(() => {});
      }
    }
    layer.style.background = `rgb(${overlayRgb})`;
    if (vid) {
      vid.style.objectPosition = bgPosition;
      vid.style.opacity = String(Math.max(0, Math.min(1, 1 - overlayAlpha)).toFixed(4));
    }
    syncEyeTrackingRig(st, mainTheme, layer, vid, overlayRgb, overlayAlpha);
  }

  const MOUTH_REF_PROF = [183,182,182,181,181,181,181,182,182,182,184,184,187,189,193,194,199,204,209,210,214,216,219,221,222,218,199,207,214,215,218,220,222,225,226,227,226,227,227,226,225,227,230,231,235,235,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236,236];
  const MOUTH_REF_MEAN = MOUTH_REF_PROF.reduce((a, b) => a + b, 0) / MOUTH_REF_PROF.length;
  const MOUTH_REF_ZERO = MOUTH_REF_PROF.map(v => v - MOUTH_REF_MEAN);
  const MOUTH_REF_NORM = Math.sqrt(MOUTH_REF_ZERO.reduce((a, b) => a + b * b, 0)) || 1;

  function stopAvatarVfxRig() {
    if (window.__AGY_AV_RAF__) {
      cancelAnimationFrame(window.__AGY_AV_RAF__);
      window.__AGY_AV_RAF__ = 0;
    }
    if (window.__AGY_LITE_PAINT_RAF__) {
      cancelAnimationFrame(window.__AGY_LITE_PAINT_RAF__);
      window.__AGY_LITE_PAINT_RAF__ = 0;
    }
    document.querySelectorAll('.agy-avatar-vfx-canvas, .agy-ui-vfx-canvas, #agy-ios-sidebar-pill').forEach(el => el.remove());
    document.querySelectorAll('[data-agy-vfx-sb-host]').forEach(el => el.removeAttribute('data-agy-vfx-sb-host'));
    if (window.__AGY_AV_VFX__) {
      window.__AGY_AV_VFX__.uiMountedAt = 0;
      window.__AGY_AV_VFX__.uiMounted = null;
      window.__AGY_AV_VFX__.sbLastTargetKey = '';
      window.__AGY_AV_VFX__.sbTransitionUntil = 0;
      window.__AGY_AV_VFX__.sbPendingRow = null;
      window.__AGY_AV_VFX__.sbPendingHref = '';
      window.__AGY_AV_VFX__.sbActiveRow = null;
      window.__AGY_AV_VFX__.sbScrollerEl = null;
    }
  }

  function stopEyeTrackingRig(removeComposer = true) {
    if (window.__AGY_EYE_RAF__) {
      cancelAnimationFrame(window.__AGY_EYE_RAF__);
      window.__AGY_EYE_RAF__ = 0;
    }
    if (removeComposer !== false) {
      const trC = document.getElementById('agy-katana-tr-canvas');
      if (trC) trC.remove();
      const blC = document.getElementById('agy-katana-bl-canvas');
      if (blC) blC.remove();
    }
  }

  // --- Eclipse Katana Fusion Avatar VFX Engine (Synced with Silver Ink Starlight) ---
  function getAvatarVfxState() {
    if (!window.__AGY_AV_VFX__) {
      const initPerf = getState().performanceMode;
      window.__AGY_AV_VFX__ = {
        enabled: false,
        perfMode: initPerf,
        hasComposerKatana: false,
        userSrc: '',
        agentSrc: '',
        avSize: 32,
        avAgentSize: 30,
        userClip: null,
        agentClip: null,
        userUrlLoaded: '',
        agentUrlLoaded: '',
        boostMap: new WeakMap(),
        dpr: getEffectiveDpr(initPerf),
      };
    }
    return window.__AGY_AV_VFX__;
  }

  function cachePortraitClip(url, slotKey) {
    const ast = getAvatarVfxState();
    const loadedKey = slotKey === 'user' ? 'userUrlLoaded' : 'agentUrlLoaded';
    const clipKey = slotKey === 'user' ? 'userClip' : 'agentClip';
    if (!url) {
      ast[loadedKey] = '';
      ast[clipKey] = null;
      return;
    }
    if (ast[loadedKey] === url && ast[clipKey]) return;
    ast[loadedKey] = url;
    const im = new Image();
    if (!/^data:/i.test(url)) {
      im.crossOrigin = 'anonymous';
    }
    im.onload = () => {
      if (ast[loadedKey] !== url) return;
      const dim = 144;
      const c = document.createElement('canvas');
      c.width = dim;
      c.height = dim;
      const g = c.getContext('2d');
      if (!g) return;
      g.beginPath();
      g.arc(dim / 2, dim / 2, dim / 2 - 1, 0, Math.PI * 2);
      g.closePath();
      g.clip();
      const iw = im.naturalWidth || 128;
      const ih = im.naturalHeight || 128;
      const sc = Math.max(dim / iw, dim / ih);
      const dw = iw * sc;
      const dh = ih * sc;
      g.drawImage(im, (dim - dw) / 2, (dim - dh) / 2, dw, dh);
      ast[clipKey] = c;
      if (ast.perfMode === 'lite') {
        document.querySelectorAll('.agy-shell canvas.agy-avatar-vfx-canvas').forEach(el => {
          delete el.dataset.drawnOnce;
        });
        if (typeof scheduleLitePaint === 'function') scheduleLitePaint();
      }
    };
    im.src = url;
  }

  function ensureCoherentGrainTile() {
    const ast = getAvatarVfxState();
    if (ast.grainTile) return ast.grainTile;
    const est = window.__AGY_EYE_STATE__;
    if (est && est.coherentGrainTile) {
      ast.grainTile = est.coherentGrainTile;
      return ast.grainTile;
    }
    const gc = document.createElement('canvas');
    gc.width = 160;
    gc.height = 160;
    const gctx = gc.getContext('2d');
    let seed = 13371;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 420; i++) {
      const gx = rand() * 160;
      const gy = rand() * 160;
      const gr = 1.0 + rand() * 2.4;
      const col = rand() > 0.42 ? 'rgba(242, 247, 255, 0.84)' : 'rgba(160, 174, 196, 0.60)';
      for (const ox of [-160, 0, 160]) {
        for (const oy of [-160, 0, 160]) {
          if (gx + ox >= -8 && gx + ox <= 168 && gy + oy >= -8 && gy + oy <= 168) {
            gctx.fillStyle = col;
            gctx.beginPath();
            gctx.arc(gx + ox, gy + oy, gr, 0, Math.PI * 2);
            gctx.fill();
          }
        }
      }
    }
    for (let s = 0; s < 55; s++) {
      const sx = rand() * 160;
      const sy = rand() * 160;
      const len = 14 + rand() * 28;
      const ang = -0.14 + (rand() - 0.5) * 0.22;
      gctx.strokeStyle = rand() > 0.35 ? 'rgba(248, 250, 255, 0.58)' : 'rgba(15, 18, 26, 0.94)';
      gctx.lineWidth = 1.2 + rand() * 1.3;
      for (const ox of [-160, 0, 160]) {
        gctx.beginPath();
        gctx.moveTo(sx + ox, sy);
        gctx.lineTo(sx + ox + Math.cos(ang) * len, sy + Math.sin(ang) * len);
        gctx.stroke();
      }
    }
    ast.grainTile = gc;
    if (est) est.coherentGrainTile = gc;
    return gc;
  }

  function drawPinchedStar(ctx, scx, scy, rx, ry, waist, sw, fillCol, strokeCol, rotRad) {
    ctx.save();
    ctx.translate(scx, scy);
    if (rotRad) ctx.rotate(rotRad);
    ctx.beginPath();
    ctx.moveTo(-rx, 0);
    ctx.quadraticCurveTo(-waist, -waist, 0, -ry);
    ctx.quadraticCurveTo(waist, -waist, rx, 0);
    ctx.quadraticCurveTo(waist, waist, 0, ry);
    ctx.quadraticCurveTo(-waist, waist, -rx, 0);
    ctx.closePath();
    ctx.fillStyle = fillCol || '#ffffff';
    ctx.fill();
    if (sw > 0) {
      ctx.lineWidth = sw;
      ctx.strokeStyle = strokeCol || '#08090d';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDiamondShard(ctx, mx, my, sz, alpha, rotRad, isDark) {
    if (alpha <= 0.02 || sz <= 0.2) return;
    ctx.save();
    ctx.translate(mx, my);
    if (rotRad) ctx.rotate(rotRad);
    ctx.beginPath();
    if (isDark) {
      ctx.moveTo(-sz * 1.38, 0);
      ctx.lineTo(0, -sz * 0.76);
      ctx.lineTo(sz * 1.38, 0);
      ctx.lineTo(0, sz * 0.76);
      ctx.closePath();
      ctx.fillStyle = `rgba(8, 9, 13, ${alpha.toFixed(3)})`;
      ctx.fill();
      ctx.lineWidth = 1.05;
      ctx.strokeStyle = `rgba(248, 250, 255, ${(alpha * 0.94).toFixed(3)})`;
      ctx.stroke();
    } else {
      ctx.moveTo(-sz, 0);
      ctx.lineTo(0, -sz);
      ctx.lineTo(sz, 0);
      ctx.lineTo(0, sz);
      ctx.closePath();
      ctx.fillStyle = `rgba(248, 250, 255, ${(alpha * 0.96).toFixed(3)})`;
      ctx.fill();
      ctx.lineWidth = 0.85;
      ctx.strokeStyle = `rgba(8, 9, 13, ${(alpha * 0.88).toFixed(3)})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  function fillCurrentPathWithCharcoalGrain(ctx, nowMs, wBox, hBox, alpha1 = 0.92, alpha2 = 0.62) {
    const grainTile = ensureCoherentGrainTile();
    const gShift1X = (nowMs * 0.0095) % 160;
    const gShift1Y = (nowMs * 0.0028) % 160;
    const gShift2X = (160 - ((nowMs * 0.0052) % 160)) % 160;
    const gShift2Y = (nowMs * 0.0041) % 160;

    ctx.save();
    ctx.fillStyle = '#07080c';
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = alpha1;
    for (let gx = -160; gx < wBox + 160; gx += 160) {
      for (let gy = -160; gy < hBox + 160; gy += 160) {
        ctx.drawImage(grainTile, gx + gShift1X, gy + gShift1Y);
      }
    }
    ctx.globalAlpha = alpha2;
    for (let gx = -160; gx < wBox + 160; gx += 160) {
      for (let gy = -160; gy < hBox + 160; gy += 160) {
        ctx.drawImage(grainTile, gx + gShift2X, gy + gShift2Y);
      }
    }
    ctx.restore();
  }

  function buildCornerArcPolyline(x0, y0, x1, y1, r, corner, armH, armV, offset = 0) {
    const cr = Math.min(r, (x1 - x0) * 0.48, (y1 - y0) * 0.48);
    const ro = Math.max(1.0, cr + offset);
    const pts = [];
    let cx = 0, cy = 0, mid = [0, 0];
    if (corner === 'TR') {
      cx = x1 - cr; cy = y0 + cr;
      for (let i = 0; i <= 8; i++) pts.push([cx - armH * (1 - i / 8), y0 - offset]);
      for (let i = 1; i <= 12; i++) {
        const a = -Math.PI * 0.5 + (i / 12) * (Math.PI * 0.5);
        pts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]);
      }
      for (let i = 1; i <= 8; i++) pts.push([x1 + offset, cy + armV * (i / 8)]);
      mid = [cx + Math.cos(-Math.PI * 0.25) * ro, cy + Math.sin(-Math.PI * 0.25) * ro];
    } else if (corner === 'TL') {
      cx = x0 + cr; cy = y0 + cr;
      for (let i = 0; i <= 8; i++) pts.push([x0 - offset, cy + armV * (1 - i / 8)]);
      for (let i = 1; i <= 12; i++) {
        const a = Math.PI + (i / 12) * (Math.PI * 0.5);
        pts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]);
      }
      for (let i = 1; i <= 8; i++) pts.push([cx + armH * (i / 8), y0 - offset]);
      mid = [cx + Math.cos(Math.PI * 1.25) * ro, cy + Math.sin(Math.PI * 1.25) * ro];
    } else if (corner === 'BL') {
      cx = x0 + cr; cy = y1 - cr;
      for (let i = 0; i <= 8; i++) pts.push([cx + armH * (1 - i / 8), y1 + offset]);
      for (let i = 1; i <= 12; i++) {
        const a = Math.PI * 0.5 + (i / 12) * (Math.PI * 0.5);
        pts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]);
      }
      for (let i = 1; i <= 8; i++) pts.push([x0 - offset, cy - armV * (i / 8)]);
      mid = [cx + Math.cos(Math.PI * 0.75) * ro, cy + Math.sin(Math.PI * 0.75) * ro];
    } else {
      cx = x1 - cr; cy = y1 - cr;
      for (let i = 0; i <= 8; i++) pts.push([x1 + offset, cy - armV * (1 - i / 8)]);
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * (Math.PI * 0.5);
        pts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]);
      }
      for (let i = 1; i <= 8; i++) pts.push([cx - armH * (i / 8), y1 + offset]);
      mid = [cx + Math.cos(Math.PI * 0.25) * ro, cy + Math.sin(Math.PI * 0.25) * ro];
    }
    return { pts, mid };
  }

  function drawVariableWidthBoilingPolyline(ctx, pts, widthFn, nowMs, rimMargin, wBox, hBox) {
    const n = pts.length;
    if (n < 2) return;
    const outerL = [], outerR = [], innerL = [], innerR = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const pPrev = pts[Math.max(0, i - 1)];
      const pNext = pts[Math.min(n - 1, i + 1)];
      const dx = pNext[0] - pPrev[0];
      const dy = pNext[1] - pPrev[1];
      const mag = Math.max(1e-5, Math.hypot(dx, dy));
      const nx = -dy / mag;
      const ny = dx / mag;

      const boil = Math.sin(nowMs * 0.0028 + u * 8.0) * 0.42 + Math.cos(nowMs * 0.0041 + u * 13.0) * 0.26;
      const env = Math.pow(Math.sin(u * Math.PI), 0.55);
      const wCur = Math.max(0.2, widthFn(u));
      const hwOut = wCur * 0.5 + rimMargin * env;
      const hwIn = Math.max(0.2, (wCur * 0.68) * 0.5);

      const bx = pts[i][0] + nx * boil * env;
      const by = pts[i][1] + ny * boil * env;
      outerL.push([bx + nx * hwOut, by + ny * hwOut]);
      outerR.push([bx - nx * hwOut, by - ny * hwOut]);
      innerL.push([bx + nx * hwIn, by + ny * hwIn]);
      innerR.push([bx - nx * hwIn, by - ny * hwIn]);
    }

    ctx.beginPath();
    for (let i = 0; i < outerL.length; i++) {
      if (i === 0) ctx.moveTo(outerL[i][0], outerL[i][1]);
      else ctx.lineTo(outerL[i][0], outerL[i][1]);
    }
    for (let i = outerR.length - 1; i >= 0; i--) ctx.lineTo(outerR[i][0], outerR[i][1]);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < innerL.length; i++) {
      if (i === 0) ctx.moveTo(innerL[i][0], innerL[i][1]);
      else ctx.lineTo(innerL[i][0], innerL[i][1]);
    }
    for (let i = innerR.length - 1; i >= 0; i--) ctx.lineTo(innerR[i][0], innerR[i][1]);
    ctx.closePath();
    fillCurrentPathWithCharcoalGrain(ctx, nowMs, wBox, hBox);
  }

  function drawSlimRoundedArcBrush(ctx, x0, y0, x1, y1, r, corner, armH, armV, maxThick, nowMs, wBox, hBox) {
    const { pts, mid } = buildCornerArcPolyline(x0, y0, x1, y1, r, corner, armH, armV, 0.5);
    drawVariableWidthBoilingPolyline(ctx, pts, (u) => maxThick * Math.pow(Math.sin(u * Math.PI), 0.72), nowMs, 1.0, wBox, hBox);
    return mid;
  }

  function drawSlimBoilingBrushSegment(ctx, p0, ctrl, p1, maxThick, nowMs, wBox, hBox) {
    const pts = [];
    const steps = 36;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const mt = 1 - u;
      pts.push([
        mt * mt * p0[0] + 2 * mt * u * ctrl[0] + u * u * p1[0],
        mt * mt * p0[1] + 2 * mt * u * ctrl[1] + u * u * p1[1],
      ]);
    }
    drawVariableWidthBoilingPolyline(ctx, pts, (u) => maxThick * Math.pow(Math.sin(u * Math.PI), 0.72), nowMs, 1.05, wBox, hBox);
  }

  function buildAvArcPath(ctx, cx, cy, a0, a1, radFn, wFn) {
    const steps = 36;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = a0 + (a1 - a0) * u;
      const rr = radFn(u);
      const hw = wFn(u) * 0.5;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      left.push([cx + ca * (rr + hw), cy + sa * (rr + hw)]);
      right.push([cx + ca * (rr - hw), cy + sa * (rr - hw)]);
    }
    for (let i = 0; i < left.length; i++) {
      if (i === 0) ctx.moveTo(left[i][0], left[i][1]);
      else ctx.lineTo(left[i][0], left[i][1]);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      ctx.lineTo(right[i][0], right[i][1]);
    }
    ctx.closePath();
  }

  function drawAvOrbit3D(ctx, frontPass, cx, cy, rx, ry, tiltDeg, oy, r, phase, starScale) {
    const th = tiltDeg * (Math.PI / 180);
    const ct = Math.cos(th);
    const st = Math.sin(th);
    const evalPt = (deg) => {
      const a = deg * (Math.PI / 180);
      const lx = rx * Math.cos(a);
      const ly = ry * Math.sin(a);
      return { x: cx + lx * ct - ly * st, y: cy + oy + lx * st + ly * ct, z: Math.sin(a) };
    };
    ctx.save();
    ctx.beginPath();
    const startDeg = frontPass ? 0 : 180;
    for (let i = 0; i <= 36; i++) {
      const p = evalPt(startDeg + i * 5);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    if (frontPass) {
      ctx.lineWidth = r * 0.12;
      ctx.strokeStyle = 'rgba(7, 8, 12, 0.94)';
      ctx.stroke();
      ctx.lineWidth = r * 0.052;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    } else {
      ctx.lineWidth = r * 0.042;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.48)';
      ctx.stroke();
    }

    const headDeg = ((phase * 360) % 360 + 360) % 360;
    const trailSteps = 14;
    for (let k = 0; k < trailSteps; k++) {
      const u0 = k / trailSteps;
      const u1 = (k + 1) / trailSteps;
      const p0 = evalPt(headDeg - u0 * 58);
      const p1 = evalPt(headDeg - u1 * 58);
      const inFront = p0.z >= 0;
      if (inFront !== frontPass) continue;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineWidth = Math.max(0.9, r * (inFront ? 0.095 : 0.055) * (1 - u0 * 0.8));
      ctx.strokeStyle = `rgba(255, 255, 255, ${((1 - u0) ** 1.5 * (inFront ? 0.95 : 0.42)).toFixed(3)})`;
      ctx.stroke();
    }
    const hp = evalPt(headDeg);
    if ((hp.z >= 0) === frontPass) {
      const rxS = r * (frontPass ? 0.42 : 0.28) * starScale;
      const ryS = r * (frontPass ? 0.17 : 0.12) * starScale;
      drawPinchedStar(
        ctx, hp.x, hp.y, rxS, ryS, rxS * 0.11, r * 0.05,
        frontPass ? '#ffffff' : 'rgba(226, 232, 240, 0.72)', '#08090d', 0
      );
    }
    ctx.restore();
  }

  function drawEclipseKatanaAvatar(ctx, portraitClip, cssBox, r, tSec, role, boost) {
    const cx = cssBox * 0.5;
    const cy = cssBox * 0.5;
    const isAi = role === 'ai';
    const nowMs = tSec * 1000;
    const orbSpeed = isAi && boost > 1.25 ? 0.44 : 0.26;
    const orbPhase = (tSec * orbSpeed) % 1.0;
    const secondPhase = (orbPhase + 0.5) % 1.0;
    const tilt = isAi ? -19 : 19;

    ctx.clearRect(0, 0, cssBox, cssBox);

    // 1. Back 3D Orbit pass
    drawAvOrbit3D(ctx, false, cx, cy, r * 1.54, r * 0.86, tilt, r * 0.04, r, orbPhase, boost);
    if (isAi) {
      drawAvOrbit3D(ctx, false, cx, cy, r * 1.54, r * 0.86, tilt, r * 0.04, r, secondPhase, 0.76 * boost);
    }

    // 2. Portrait disc + high-contrast white/ink double bezel
    if (portraitClip) {
      ctx.drawImage(portraitClip, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#090d16';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.4, r * 0.068);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 3. True 5-Layer Composer Sumi-e Boiling Charcoal Blades & Thorns wrapping the Avatar!
    const deg2rad = Math.PI / 180;
    const slowBoil = (seedOff) => Math.sin(nowMs * 0.0026 + seedOff) * 0.045 + Math.cos(nowMs * 0.0041 + seedOff * 1.7) * 0.028;
    const arcs = isAi ? [
      { a0: 122 * deg2rad, a1: 392 * deg2rad, rBase: 1.09, wMax: 0.34, seed: 1.1 },
      { a0: -68 * deg2rad, a1: 72 * deg2rad, rBase: 1.16, wMax: 0.24, seed: 3.7 }
    ] : [
      { a0: -85 * deg2rad, a1: 205 * deg2rad, rBase: 1.09, wMax: 0.32, seed: 2.3 },
      { a0: 118 * deg2rad, a1: 248 * deg2rad, rBase: 1.15, wMax: 0.22, seed: 5.1 }
    ];

    // 3a. Outer White-Silver Katana Blade Shell
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    arcs.forEach((arc) => {
      const b1 = slowBoil(arc.seed);
      buildAvArcPath(
        ctx, cx, cy, arc.a0, arc.a1,
        (u) => r * (arc.rBase + 0.05 * Math.sin(u * Math.PI) + b1 * Math.sin(u * Math.PI * 2)),
        (u) => r * (0.045 + (arc.wMax + 0.11) * (Math.sin(u * Math.PI) ** 0.78))
      );
    });
    ctx.fill();

    // 3b. Rippling Jagged Sumi-e Ink-Flame Thorns along the Blade Spine (white rim + #08090d core)
    const mainArc = arcs[0];
    for (let t = 0; t < 7; t++) {
      const u = 0.14 + (t / 7.0) * 0.74;
      const ang = mainArc.a0 + (mainArc.a1 - mainArc.a0) * u;
      const rr = r * (mainArc.rBase + 0.08 + 0.04 * Math.sin(u * Math.PI));
      const tx = cx + Math.cos(ang) * rr;
      const ty = cy + Math.sin(ang) * rr;
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      const txDir = -ny;
      const tyDir = nx;
      const waveH = r * (0.16 + (t % 3) * 0.08) * (0.55 + 0.45 * Math.sin(nowMs * 0.0024 + t * 1.45)) * boost;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(tx - txDir * r * 0.18, ty - tyDir * r * 0.18);
      ctx.quadraticCurveTo(tx + nx * waveH, ty + ny * waveH, tx + txDir * r * 0.26 + nx * waveH * 0.85, ty + tyDir * r * 0.26 + ny * waveH * 0.85);
      ctx.quadraticCurveTo(tx + txDir * r * 0.08, ty + tyDir * r * 0.08, tx + txDir * r * 0.14, ty + tyDir * r * 0.14);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#08090d';
      ctx.beginPath();
      ctx.moveTo(tx - txDir * r * 0.13, ty - tyDir * r * 0.13);
      ctx.quadraticCurveTo(tx + nx * waveH * 0.72, ty + ny * waveH * 0.72, tx + txDir * r * 0.21 + nx * waveH * 0.62, ty + tyDir * r * 0.21 + ny * waveH * 0.62);
      ctx.quadraticCurveTo(tx + txDir * r * 0.05, ty + tyDir * r * 0.05, tx + txDir * r * 0.10, ty + tyDir * r * 0.10);
      ctx.closePath();
      ctx.fill();
    }

    // 3c. Inner Black Sumi-e Ink Blades + Clipped Dual-Layer Counter-Drifting Charcoal Stipple & Bristle Grain!
    const grainTile = ensureCoherentGrainTile();
    const gShift1X = (nowMs * 0.0095) % 160;
    const gShift1Y = (nowMs * 0.0028) % 160;
    const gShift2X = (160 - ((nowMs * 0.0052) % 160)) % 160;
    const gShift2Y = (nowMs * 0.0041) % 160;

    ctx.save();
    ctx.beginPath();
    arcs.forEach((arc) => {
      const b2 = slowBoil(arc.seed + 1.8);
      buildAvArcPath(
        ctx, cx, cy, arc.a0 + 0.05, arc.a1 - 0.05,
        (u) => r * (arc.rBase + 0.05 * Math.sin(u * Math.PI) + b2 * Math.cos(u * Math.PI * 2)),
        (u) => r * (0.015 + arc.wMax * (Math.sin(u * Math.PI) ** 0.82))
      );
    });
    ctx.fillStyle = '#07080c';
    ctx.fill();
    ctx.clip();

    const gScale = Math.max(0.45, cssBox / 135);
    ctx.scale(gScale, gScale);
    ctx.globalAlpha = 0.94;
    for (let gx = -160; gx < 220; gx += 160) {
      for (let gy = -160; gy < 220; gy += 160) {
        ctx.drawImage(grainTile, gx + gShift1X, gy + gShift1Y);
      }
    }
    ctx.globalAlpha = 0.64;
    for (let gx = -160; gx < 220; gx += 160) {
      for (let gy = -160; gy < 220; gy += 160) {
        ctx.drawImage(grainTile, gx + gShift2X, gy + gShift2Y);
      }
    }
    ctx.restore();

    // 4. Slow-Floating Rotating Black-Ink Diamond Shards with Crisp Silver Rims (identical to Composer!)
    for (let m = 0; m < 10; m++) {
      const phaseM = ((nowMs * 0.00024 + m * 0.1) % 1.0);
      const ang = mainArc.a0 + (mainArc.a1 - mainArc.a0) * phaseM;
      const dist = r * (1.16 + 0.24 * Math.sin(phaseM * Math.PI) + 0.08 * Math.sin(nowMs * 0.0021 + m * 2.7));
      const mx = cx + Math.cos(ang) * dist;
      const my = cy + Math.sin(ang) * dist;
      const sz = r * (0.08 + (m % 3) * 0.035) * (1.0 - phaseM * 0.35) * boost;
      const alphaM = Math.sin(phaseM * Math.PI) * 0.96;
      const rot = nowMs * 0.0014 * (m % 2 === 0 ? 1 : -1) + m;

      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(rot);
      ctx.beginPath();
      if (m % 3 !== 2) {
        ctx.moveTo(-sz * 1.4, 0);
        ctx.lineTo(0, -sz * 0.78);
        ctx.lineTo(sz * 1.4, 0);
        ctx.lineTo(0, sz * 0.78);
        ctx.closePath();
        ctx.fillStyle = `rgba(8, 9, 13, ${alphaM.toFixed(3)})`;
        ctx.fill();
        ctx.lineWidth = Math.max(0.8, r * 0.045);
        ctx.strokeStyle = `rgba(248, 250, 255, ${(alphaM * 0.94).toFixed(3)})`;
        ctx.stroke();
      } else {
        ctx.moveTo(-sz, 0);
        ctx.lineTo(0, -sz);
        ctx.lineTo(sz, 0);
        ctx.lineTo(0, sz);
        ctx.closePath();
        ctx.fillStyle = `rgba(248, 250, 255, ${(alphaM * 0.96).toFixed(3)})`;
        ctx.fill();
        ctx.lineWidth = Math.max(0.7, r * 0.04);
        ctx.strokeStyle = `rgba(8, 9, 13, ${(alphaM * 0.88).toFixed(3)})`;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Twin Concave Pinched-Waist Manga Starbursts on the Blade Hilt (matching Composer twin stars!)
    const cStarPulse = (0.95 + 0.08 * Math.sin(nowMs * 0.0018)) * boost;
    if (isAi) {
      drawPinchedStar(ctx, cx + r * 0.78, cy - r * 0.88, r * 0.72 * cStarPulse, r * 0.25 * cStarPulse, r * 0.06, r * 0.065);
      drawPinchedStar(ctx, cx + r * 0.34, cy - r * 1.04, r * 0.40 * cStarPulse, r * 0.16 * cStarPulse, r * 0.04, r * 0.055);
    } else {
      drawPinchedStar(ctx, cx - r * 0.76, cy - r * 0.86, r * 0.68 * cStarPulse, r * 0.24 * cStarPulse, r * 0.055, r * 0.065);
      drawPinchedStar(ctx, cx - r * 0.32, cy - r * 1.02, r * 0.38 * cStarPulse, r * 0.15 * cStarPulse, r * 0.038, r * 0.052);
    }

    // 6. Front pass of 3D Orbit & Pinched-Waist Comet Starburst
    drawAvOrbit3D(ctx, true, cx, cy, r * 1.54, r * 0.86, tilt, r * 0.04, r, orbPhase, boost);
    if (isAi) {
      drawAvOrbit3D(ctx, true, cx, cy, r * 1.54, r * 0.86, tilt, r * 0.04, r, secondPhase, 0.76 * boost);
    }
  }

  function isRectInBand(rect, vh, margin) {
    return rect.width > 0 && rect.height > 0 && rect.bottom >= -margin && rect.top <= vh + margin;
  }

  function syncAvatarVfxCanvases() {
    const ast = getAvatarVfxState();
    if (!ast.enabled) {
      stopAvatarVfxRig();
      return;
    }
    const vh = window.innerHeight || 960;
    const mountOn = (selector, role, corePx, posCssFn) => {
      document.querySelectorAll(`.agy-shell ${selector}`).forEach(host => {
        const hRect = host.getBoundingClientRect();
        let c = host.querySelector(':scope > canvas.agy-avatar-vfx-canvas');
        if (!isRectInBand(hRect, vh, 440)) {
          if (c) c.remove();
          return;
        }
        if (!c && !isRectInBand(hRect, vh, 360)) {
          return;
        }
        const boxPx = Math.round(corePx * 2.45);
        const padPx = (boxPx - corePx) / 2;
        const bufPx = Math.round(boxPx * ast.dpr);
        if (!c) {
          c = document.createElement('canvas');
          c.className = 'agy-avatar-vfx-canvas';
          host.appendChild(c);
        }
        c.dataset.role = role;
        c.dataset.corePx = String(corePx);
        c.dataset.boxPx = String(boxPx);
        if (c.width !== bufPx || c.height !== bufPx) {
          c.width = bufPx;
          c.height = bufPx;
          delete c.dataset.drawnOnce;
        }
        const css = posCssFn(boxPx, padPx);
        if (c.style.cssText !== css) {
          c.style.cssText = css;
        }
      });
    };

    if (ast.userSrc) {
      mountOn('[data-testid="user-message"]', 'user', ast.avSize, (boxPx, padPx) =>
        `position:absolute;right:${(4 - padPx).toFixed(1)}px;bottom:${(6 - padPx).toFixed(1)}px;width:${boxPx}px;height:${boxPx}px;pointer-events:none;z-index:6;`
      );
    } else {
      document.querySelectorAll('.agy-shell [data-testid="user-message"] > canvas.agy-avatar-vfx-canvas').forEach(el => el.remove());
    }

    if (ast.agentSrc) {
      mountOn('[data-testid="agent-response"]', 'ai', ast.avAgentSize, (boxPx, padPx) =>
        `position:absolute;left:${(12 - padPx).toFixed(1)}px;top:${(12 - padPx).toFixed(1)}px;width:${boxPx}px;height:${boxPx}px;pointer-events:none;z-index:6;`
      );
    } else {
      document.querySelectorAll('.agy-shell [data-testid="agent-response"] > canvas.agy-avatar-vfx-canvas').forEach(el => el.remove());
    }
  }

  // --- UI VFX Suite Engine (1B Bubble, 2F Sidebar, 3B-1 Header, 4A-2 Thinking) ---
  function ensureSuiteCanvas(host, cls, wCss, hCss, cssText, dpr) {
    let c = host.querySelector(`:scope > canvas.${cls.split(' ').join('.')}`);
    if (!c) {
      c = document.createElement('canvas');
      c.className = `agy-ui-vfx-canvas ${cls}`;
      host.appendChild(c);
    }
    const bw = Math.max(2, Math.round(wCss * dpr));
    const bh = Math.max(2, Math.round(hCss * dpr));
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
      delete c.dataset.drawnOnce;
    }
    c.dataset.wCss = String(Math.round(wCss));
    c.dataset.hCss = String(Math.round(hCss));
    if (c.style.cssText !== cssText) {
      c.style.cssText = cssText;
    }
    return c;
  }

  function findInnerUserBubbleEl(msgEl) {
    const explicit = msgEl.querySelector('.agy-user-bubble-frame') || msgEl.querySelector('.agy-user-bubble');
    if (explicit) return explicit;
    const pRect = msgEl.getBoundingClientRect();
    const cands = msgEl.querySelectorAll('div');
    let best = null;
    for (let i = 0; i < Math.min(20, cands.length); i++) {
      const d = cands[i];
      const r = d.getBoundingClientRect();
      if (r.width < 36 || r.height < 24 || r.width >= pRect.width - 8) continue;
      const cs = getComputedStyle(d);
      const rad = parseFloat(cs.borderRadius) || 0;
      const hasBg = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      if (hasBg || rad >= 6) {
        if (!best || r.width * r.height < best.area) {
          best = { el: d, area: r.width * r.height };
        }
      }
    }
    return best ? best.el : (msgEl.firstElementChild || msgEl);
  }

  function findSidebarScroller(shell) {
    if (!shell) return null;
    const row = shell.querySelector('.agy-sidebar-row');
    if (row) {
      return row.closest('.overflow-y-auto') || row.closest('.bg-sidebar');
    }
    return shell.querySelector('.bg-sidebar .overflow-y-auto');
  }

  function syncSidebarIosTargetPosition(activeSbRow, sbScroller, animate) {
    const ast = getAvatarVfxState();
    const sbPill = document.getElementById('agy-ios-sidebar-pill');
    const sbVfxC = document.getElementById('agy-vfx-2f-sidebar');
    if (!sbPill || !sbVfxC || !sbScroller || !sbScroller.isConnected) return false;
    if (!activeSbRow || !activeSbRow.isConnected) {
      sbPill.style.opacity = '0';
      sbVfxC.style.opacity = '0';
      ast.sbLastTargetKey = '';
      return false;
    }

    const rRect = activeSbRow.getBoundingClientRect();
    const scRect = sbScroller.getBoundingClientRect();
    const pillW = activeSbRow.offsetWidth || Math.round(rRect.width);
    const pillH = activeSbRow.offsetHeight || Math.round(rRect.height);
    if (pillW < 80 || pillH < 16) return false;

    const hostBox = (activeSbRow.offsetParent && sbScroller.contains(activeSbRow.offsetParent))
      ? activeSbRow.offsetParent
      : null;
    const hbRect = hostBox ? hostBox.getBoundingClientRect() : null;
    const trueLeft = hbRect ? (hbRect.left + activeSbRow.offsetLeft) : ((rRect.left + rRect.right - pillW) * 0.5);
    const trueTop = hbRect ? (hbRect.top + activeSbRow.offsetTop) : ((rRect.top + rRect.bottom - pillH) * 0.5);
    const pillX = Math.round(trueLeft - scRect.left - (sbScroller.clientLeft || 0) + sbScroller.scrollLeft);
    const pillY = Math.round(trueTop - scRect.top - (sbScroller.clientTop || 0) + sbScroller.scrollTop);
    const targetKey = `${pillX},${pillY},${pillW},${pillH}`;
    if (ast.sbLastTargetKey === targetKey && sbPill.dataset.iosReady === '1') {
      return false;
    }

    ast.sbLastTargetKey = targetKey;
    const nextT = `translate3d(${pillX}px, ${pillY}px, 0)`;
    const firstMount = sbPill.dataset.iosReady !== '1';
    if (firstMount || !animate) {
      sbPill.style.transition = 'none';
      sbVfxC.style.transition = 'none';
    }
    if (sbPill.style.width !== `${pillW}px`) sbPill.style.width = `${pillW}px`;
    if (sbPill.style.height !== `${pillH}px`) sbPill.style.height = `${pillH}px`;
    sbPill.style.transform = nextT;
    sbPill.style.opacity = '1';
    sbVfxC.style.transform = nextT;
    sbVfxC.style.opacity = '1';
    if (firstMount || !animate) {
      void sbPill.offsetWidth;
      sbPill.dataset.iosReady = '1';
      sbPill.style.transition = '';
      sbVfxC.style.transition = '';
    }
    return true;
  }

  function findActiveSidebarConversationEl(shell) {
    const ast = getAvatarVfxState();
    const vh = window.innerHeight || 960;
    if (performance.now() < (ast.sbLockUntil || 0)) {
      if (ast.sbPendingRow && ast.sbPendingRow.isConnected) {
        const pr = ast.sbPendingRow.getBoundingClientRect();
        if (pr.height >= 20 && pr.width >= 120) {
          return ast.sbPendingRow;
        }
      }
      if (ast.sbPendingHref) {
        const matched = Array.from(shell.querySelectorAll('.agy-sidebar-row')).find(row => {
          if (row.closest('#agy-custom-theme-modal-backdrop')) return false;
          const a = row.querySelector('a[href]');
          return a && a.getAttribute('href') === ast.sbPendingHref;
        });
        if (matched) {
          ast.sbPendingRow = matched;
          return matched;
        }
      }
    }

    const locPath = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '';
    if (locPath && locPath.startsWith('/c/')) {
      const exactRow = Array.from(shell.querySelectorAll('.agy-sidebar-row')).find(row => {
        if (row.closest('#agy-custom-theme-modal-backdrop')) return false;
        const a = row.querySelector('a[href]');
        return a && a.getAttribute('href') === locPath;
      });
      if (exactRow) {
        const er = exactRow.getBoundingClientRect();
        if (er.width >= 120 && er.height >= 22 && er.top >= 100 && er.bottom <= vh - 36) {
          return exactRow;
        }
      }
    }

    const titleBar = shell.querySelector('[class*="@container/titlebar"]');
    const titleSpan = titleBar ? (titleBar.querySelector('[data-testid="breadcrumb-segment"]') || titleBar.querySelector('span')) : null;
    const activeTitle = titleSpan ? (titleSpan.textContent || '').trim().toLowerCase() : '';

    // Primary: native Antigravity sidebar conversation rows (`div.agy-sidebar-row` wrapping `a[href^="/c/"]`)
    const rows = Array.from(shell.querySelectorAll('.agy-sidebar-row'));
    let best = null;
    let bestScore = -1;
    let firstTopLevelConv = null;
    let firstAnyConv = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.closest('#agy-custom-theme-modal-backdrop')) continue;
      const r = row.getBoundingClientRect();
      if (r.width < 120 || r.height < 22 || r.height > 48 || r.top < 100 || r.bottom > vh - 36) continue;

      const link = row.querySelector('a[href]');
      const href = link ? (link.getAttribute('href') || '') : '';
      if (href && !href.startsWith('/c/')) continue;

      if (!firstAnyConv) firstAnyConv = row;
      if (!firstTopLevelConv && !String(row.className).includes('pl-[30px]')) firstTopLevelConv = row;

      let score = 0;
      if (locPath && locPath.startsWith('/c/') && href === locPath) score += 200;
      if (link && (link.getAttribute('aria-current') === 'page' || link.dataset.active === 'true' || link.dataset.state === 'active')) score += 120;
      if (row.getAttribute('aria-current') === 'page' || row.dataset.active === 'true' || row.dataset.state === 'active') score += 120;

      if (score < 120) {
        const rowBg = getComputedStyle(row).backgroundColor || '';
        const linkBg = link ? (getComputedStyle(link).backgroundColor || '') : '';
        for (const bg of [rowBg, linkBg]) {
          const am = bg.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([0-9.]+)\)/);
          if ((bg && !bg.startsWith('rgba(') && bg !== 'transparent') || (am && parseFloat(am[1]) > 0.025)) {
            score += 70;
            break;
          }
        }
      }

      const txt = (row.textContent || '').trim().toLowerCase();
      if (activeTitle && activeTitle !== 'antigravity' && txt.includes(activeTitle.slice(0, Math.min(18, activeTitle.length)))) score += 90;
      if (row.querySelector('[class*="animate-"], svg[class*="animate-"]')) score += 35;

      if (score > bestScore && score >= 35) {
        bestScore = score;
        best = row;
      }
    }
    return best || firstTopLevelConv || firstAnyConv;
  }

  function mountUiVfxSuiteCanvases(force) {
    const ast = getAvatarVfxState();
    const suite = ast.uiSuite;
    const shell = document.querySelector('.agy-shell');
    if (!suite || !shell) return;
    const nowTs = performance.now();
    if (!force && ast.uiMountedAt && (nowTs - ast.uiMountedAt) < 420) return;
    ast.uiMountedAt = nowTs;

    const dpr = ast.dpr || 2;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 960;
    const shellRect = shell.getBoundingClientRect();

    // 1. Target 1B: Bong Bóng Chat (User Bubbles & AI Response Cards — Viewport Virtualized)
    const activeUserHosts = new Set();
    if (suite.bubble === '1B') {
      shell.querySelectorAll('[data-testid="user-message"]').forEach(msgEl => {
        const uRect = msgEl.getBoundingClientRect();
        const existing = msgEl.querySelector(':scope > canvas.agy-vfx-1b-user');
        if (!isRectInBand(uRect, vh, existing ? 440 : 360)) return;
        const bEl = findInnerUserBubbleEl(msgEl);
        const bRect = bEl.getBoundingClientRect();
        if (bRect.width < 32 || bRect.height < 20) return;
        const pad = 12;
        const relL = (bRect.left - uRect.left) - pad;
        const relT = (bRect.top - uRect.top) - pad;
        const cw = bRect.width + pad * 2;
        const ch = bRect.height + pad * 2;
        const rad = Math.max(8, Math.min(18, parseFloat(getComputedStyle(bEl).borderRadius) || 14));
        const css = `position:absolute;left:${relL.toFixed(1)}px;top:${relT.toFixed(1)}px;width:${cw.toFixed(1)}px;height:${ch.toFixed(1)}px;pointer-events:none;z-index:7;`;
        const c = ensureSuiteCanvas(msgEl, 'agy-vfx-1b-user', cw, ch, css, dpr);
        c.dataset.rad = String(rad);
        activeUserHosts.add(c);
      });

      shell.querySelectorAll('[data-testid="agent-response"]').forEach(aiEl => {
        const aRect = aiEl.getBoundingClientRect();
        const hasExisting = Boolean(aiEl.querySelector(':scope > canvas.agy-vfx-1b-ai-tr'));
        if (!isRectInBand(aRect, vh, hasExisting ? 440 : 360)) return;
        const trC = ensureSuiteCanvas(
          aiEl, 'agy-vfx-1b-ai-tr', 150, 84,
          'position:absolute;top:-12px;right:-12px;width:150px;height:84px;pointer-events:none;z-index:7;',
          dpr
        );
        const blC = ensureSuiteCanvas(
          aiEl, 'agy-vfx-1b-ai-bl', 150, 84,
          'position:absolute;bottom:-12px;left:-12px;width:150px;height:84px;pointer-events:none;z-index:7;',
          dpr
        );
        const tlC = ensureSuiteCanvas(
          aiEl, 'agy-vfx-1b-ai-tl', 128, 66,
          'position:absolute;top:-12px;left:-12px;width:128px;height:66px;pointer-events:none;z-index:4;',
          dpr
        );
        activeUserHosts.add(trC);
        activeUserHosts.add(blC);
        activeUserHosts.add(tlC);
      });
    }
    shell.querySelectorAll('canvas.agy-vfx-1b-user, canvas.agy-vfx-1b-ai-tr, canvas.agy-vfx-1b-ai-bl, canvas.agy-vfx-1b-ai-tl').forEach(el => {
      if (!activeUserHosts.has(el)) el.remove();
    });

    // 2. Target 2F: Sidebar Active Conversation Item (GPU-Composited Sliding Pill + Compact 2F Canvas)
    const activeSbRow = suite.sidebar === '2F' ? findActiveSidebarConversationEl(shell) : null;
    const sbScroller = suite.sidebar === '2F' ? findSidebarScroller(shell) : null;
    shell.querySelectorAll('.agy-sidebar-row > canvas.agy-vfx-2f-sidebar').forEach(c => c.remove());
    shell.querySelectorAll('[data-agy-vfx-sb-host]').forEach(prev => {
      if (prev !== activeSbRow) prev.removeAttribute('data-agy-vfx-sb-host');
    });
    if (activeSbRow) {
      activeSbRow.setAttribute('data-agy-vfx-sb-host', '1');
    }

    let sbPill = document.getElementById('agy-ios-sidebar-pill');
    let sbVfxC = document.getElementById('agy-vfx-2f-sidebar');
    if (suite.sidebar === '2F' && sbScroller) {
      if (getComputedStyle(sbScroller).position === 'static') {
        sbScroller.style.position = 'relative';
      }
      if (!sbPill || sbPill.parentElement !== sbScroller) {
        if (sbPill) sbPill.remove();
        sbPill = document.createElement('div');
        sbPill.id = 'agy-ios-sidebar-pill';
        sbPill.className = 'agy-ios-sidebar-pill';
        sbScroller.prepend(sbPill);
      }
      if (!sbVfxC || sbVfxC.parentElement !== sbScroller) {
        if (sbVfxC) sbVfxC.remove();
        sbVfxC = document.createElement('canvas');
        sbVfxC.id = 'agy-vfx-2f-sidebar';
        sbVfxC.className = 'agy-ui-vfx-canvas agy-vfx-2f-sidebar';
        sbScroller.appendChild(sbVfxC);
      }
      const baseW = (activeSbRow && activeSbRow.isConnected && activeSbRow.offsetWidth >= 80) ? activeSbRow.offsetWidth : 240;
      const baseH = (activeSbRow && activeSbRow.isConnected && activeSbRow.offsetHeight >= 16) ? activeSbRow.offsetHeight : 32;
      const cw = baseW + 12;
      const ch = baseH + 14;
      const bw = Math.round(cw * dpr);
      const bh = Math.round(ch * dpr);
      if (sbVfxC.width !== bw || sbVfxC.height !== bh) {
        sbVfxC.width = bw;
        sbVfxC.height = bh;
        delete sbVfxC.dataset.drawnOnce;
      }
      sbVfxC.dataset.wCss = String(cw);
      sbVfxC.dataset.hCss = String(ch);
      if (sbVfxC.style.width !== `${cw}px`) sbVfxC.style.width = `${cw}px`;
      if (sbVfxC.style.height !== `${ch}px`) sbVfxC.style.height = `${ch}px`;
      ast.sbScrollerEl = sbScroller;
      ast.sbActiveRow = activeSbRow;
      syncSidebarIosTargetPosition(activeSbRow, sbScroller, true);
    } else {
      ast.sbScrollerEl = null;
      ast.sbActiveRow = null;
      ast.sbLastTargetKey = '';
      if (sbPill) sbPill.remove();
      if (sbVfxC) sbVfxC.remove();
    }

    // 3. Target 3B-1: Top Header Horizon Seam
    let hdrC = document.getElementById('agy-vfx-3b1-header');
    const titleBar = suite.header === '3B-1' ? (shell.querySelector('[class*="@container/titlebar"]') || shell.querySelector('[data-main-content-header]')) : null;
    if (titleBar) {
      const tRect = titleBar.getBoundingClientRect();
      if (tRect.width > 120) {
        if (!hdrC || hdrC.parentElement !== shell) {
          if (hdrC) hdrC.remove();
          hdrC = document.createElement('canvas');
          hdrC.id = 'agy-vfx-3b1-header';
          hdrC.className = 'agy-ui-vfx-canvas agy-vfx-3b1-header';
          shell.appendChild(hdrC);
        }
        const cw = Math.round(tRect.width);
        const ch = 36;
        const bw = Math.round(cw * dpr);
        const bh = Math.round(ch * dpr);
        if (hdrC.width !== bw || hdrC.height !== bh) {
          hdrC.width = bw;
          hdrC.height = bh;
          delete hdrC.dataset.drawnOnce;
        }
        hdrC.dataset.wCss = String(cw);
        hdrC.dataset.hCss = String(ch);
        // Find rightmost coordinate of the title text
        let titleEndX = Math.min(200, cw * 0.35);
        const spans = titleBar.querySelectorAll('[data-testid="breadcrumb-segment"], span, h1, div');
        for (let i = 0; i < Math.min(20, spans.length); i++) {
          const sp = spans[i];
          if (sp.children.length > 0 && !sp.getAttribute('data-testid')) continue;
          const sr = sp.getBoundingClientRect();
          const txt = (sp.innerText || '').trim();
          if (txt.length >= 3 && sr.width > 20 && sr.left < tRect.left + tRect.width * 0.55) {
            titleEndX = Math.max(titleEndX, Math.min(cw * 0.48, (sr.right - tRect.left) + 14));
            break;
          }
        }
        const nextEndX = String(Math.round(titleEndX));
        if (hdrC.dataset.titleEndX !== nextEndX) {
          hdrC.dataset.titleEndX = nextEndX;
          delete hdrC.dataset.drawnOnce;
        }
        const css = `position:fixed;left:${Math.round(tRect.left)}px;top:${Math.round(tRect.bottom - 18)}px;width:${cw}px;height:${ch}px;pointer-events:none;z-index:44;`;
        if (hdrC.style.cssText !== css) hdrC.style.cssText = css;
      }
    } else if (hdrC) {
      hdrC.remove();
    }

    // 4. Target 4A-2: Thinking for 3s Bar (+ fallback top border corridor on latest AI card when idle)
    const activeThinkingCanvases = new Set();
    if (suite.thinking === '4A-2') {
      const tNodes = shell.querySelectorAll('span, div, button, p');
      const seenHosts = new Set();
      for (let i = 0; i < tNodes.length; i++) {
        const el = tNodes[i];
        if (el.children.length > 4) continue;
        if (el.closest('.bg-sidebar, #agy-custom-theme-modal-backdrop, [class*="@container/titlebar"]')) continue;
        const txt = (el.innerText || '').trim();
        if (!/^(Thinking|Thought)(\s+for\b|\.\.\.)?/i.test(txt) || txt.length > 42) continue;
        const txtRect = el.getBoundingClientRect();
        if (txtRect.width < 40 || txtRect.height < 12) continue;

        let pillHost = el;
        for (let depth = 0; depth < 4 && pillHost.parentElement; depth++) {
          const pr = pillHost.parentElement.getBoundingClientRect();
          if (pr.width >= 200 && pr.height >= 24 && pr.height <= 68 && pr.left >= (shellRect.left + 120)) {
            pillHost = pillHost.parentElement;
          } else {
            break;
          }
        }
        const hRect = pillHost.getBoundingClientRect();
        if (hRect.width < 200 || hRect.height > 72 || seenHosts.has(pillHost)) continue;
        if (!isRectInBand(hRect, vh, 360)) continue;
        seenHosts.add(pillHost);

        const corrLeft = Math.max(txtRect.right - hRect.left + 18, 170);
        const corrWidth = hRect.width - corrLeft - 24;
        if (corrWidth >= 90) {
          if (getComputedStyle(pillHost).position === 'static') pillHost.style.position = 'relative';
          const cTop = (hRect.height - 28) * 0.5;
          const css = `position:absolute;left:${corrLeft.toFixed(1)}px;top:${cTop.toFixed(1)}px;width:${corrWidth.toFixed(1)}px;height:28px;pointer-events:none;z-index:8;`;
          const thC = ensureSuiteCanvas(pillHost, 'agy-vfx-4a2-thinking', corrWidth, 28, css, dpr);
          activeThinkingCanvases.add(thC);
        }
      }

      // If no standalone Thinking pill is rendered right now, display 4A-2 gracefully in the top border corridor of the latest AI card
      if (activeThinkingCanvases.size === 0) {
        const aiList = shell.querySelectorAll('[data-testid="agent-response"]');
        if (aiList.length > 0) {
          const latestAi = aiList[aiList.length - 1];
          const aRect = latestAi.getBoundingClientRect();
          if (aRect.width > 340 && isRectInBand(aRect, vh, 360)) {
            const stripW = Math.min(300, aRect.width - 270);
            const stripLeft = Math.max(115, (aRect.width - stripW) * 0.5);
            const css = `position:absolute;left:${stripLeft.toFixed(1)}px;top:-13px;width:${stripW.toFixed(1)}px;height:26px;pointer-events:none;z-index:7;`;
            const fbC = ensureSuiteCanvas(latestAi, 'agy-vfx-4a2-thinking', stripW, 26, css, dpr);
            activeThinkingCanvases.add(fbC);
          }
        }
      }
    }
    shell.querySelectorAll('canvas.agy-vfx-4a2-thinking').forEach(el => {
      if (!activeThinkingCanvases.has(el)) el.remove();
    });
  }

  function renderUiVfxSuiteFrame(nowMs, staticOnly = false) {
    const ast = getAvatarVfxState();
    const suite = ast.uiSuite;
    const shell = document.querySelector('.agy-shell');
    if (!suite || !shell) return false;

    const sbVfxEl = document.getElementById('agy-vfx-2f-sidebar');
    if (!staticOnly && ast.sbTransitionUntil && nowMs < ast.sbTransitionUntil && (!sbVfxEl || sbVfxEl.dataset.drawnOnce === '1')) {
      return true;
    }

    if (!staticOnly) {
      mountUiVfxSuiteCanvases(false);
    }

    ast.uiFrameIdx = ((ast.uiFrameIdx || 0) + 1) & 1023;

    const dpr = ast.dpr || 1.25;
    const tSec = nowMs * 0.001;
    const ang = tSec * 2.6;
    const vh = window.innerHeight || 960;
    const pulse = 0.94 + 0.08 * Math.sin(ang);

    // 1B: User Message Bubbles
    shell.querySelectorAll('canvas.agy-vfx-1b-user').forEach(c => {
      if (staticOnly && c.dataset.drawnOnce === '1') return;
      if (!staticOnly && c.dataset.drawnOnce === '1' && (ast.uiFrameIdx % 2 === 1)) return;
      const rect = c.getBoundingClientRect();
      if (c.dataset.drawnOnce === '1' && (rect.width <= 0 || rect.bottom < -36 || rect.top > vh + 36)) return;
      c.dataset.drawnOnce = '1';
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const cw = Number(c.dataset.wCss) || 120;
      const ch = Number(c.dataset.hCss) || 56;
      const r = Number(c.dataset.rad) || 14;
      const pad = 12;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const mTR = drawSlimRoundedArcBrush(ctx, pad, pad, cw - pad, ch - pad, r, 'TR', Math.min(34, cw * 0.32), 13, 4.6, nowMs, cw, ch);
      const mBL = drawSlimRoundedArcBrush(ctx, pad, pad, cw - pad, ch - pad, r, 'BL', Math.min(32, cw * 0.30), 13, 4.4, nowMs + 420, cw, ch);

      drawPinchedStar(ctx, mTR[0], mTR[1], 10.5, 4.0, 1.1, 1.1, pulse);
      drawPinchedStar(ctx, mBL[0], mBL[1], 8.5, 3.3, 0.9, 1.0, pulse);

      const motes = [[cw - 7, 7, 0.0], [cw - 4, 21, 1.3], [7, ch - 7, 2.5], [19, ch - 5, 3.7]];
      motes.forEach(([mx0, my0, off], idx) => {
        const ph = (tSec * 0.42 + off * 0.17) % 1.0;
        const al = Math.sin(ph * Math.PI) * 0.92;
        drawDiamondShard(ctx, mx0 + Math.sin(ang + off) * 3.0, my0 - ph * 5.0, 2.1, al, ang + off, idx % 2 === 0);
      });
      ctx.restore();
    });

    // 1B: AI Response Card Corners (TR, BL, subtle TL)
    shell.querySelectorAll('canvas.agy-vfx-1b-ai-tr, canvas.agy-vfx-1b-ai-bl, canvas.agy-vfx-1b-ai-tl').forEach(c => {
      if (staticOnly && c.dataset.drawnOnce === '1') return;
      if (!staticOnly && c.dataset.drawnOnce === '1' && (ast.uiFrameIdx % 2 === 1)) return;
      const rect = c.getBoundingClientRect();
      if (c.dataset.drawnOnce === '1' && (rect.width <= 0 || rect.bottom < -36 || rect.top > vh + 36)) return;
      c.dataset.drawnOnce = '1';
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const cw = Number(c.dataset.wCss) || 150;
      const ch = Number(c.dataset.hCss) || 84;
      const pad = 12;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      if (c.classList.contains('agy-vfx-1b-ai-tr')) {
        const mTR = drawSlimRoundedArcBrush(ctx, -200, pad, cw - pad, 300, 14, 'TR', 102, 38, 5.2, nowMs, cw, ch);
        drawPinchedStar(ctx, mTR[0], mTR[1], 12.8, 4.8, 1.3, 1.2, pulse);
        for (let k = 0; k < 3; k++) {
          const ph = (tSec * 0.4 + k * 0.33) % 1.0;
          drawDiamondShard(ctx, cw - 7 - k * 14 + Math.sin(ang + k) * 3, pad - 5 - ph * 4, 2.2, Math.sin(ph * Math.PI) * 0.92, ang + k, k !== 1);
        }
      } else if (c.classList.contains('agy-vfx-1b-ai-bl')) {
        const mBL = drawSlimRoundedArcBrush(ctx, pad, -200, 300, ch - pad, 14, 'BL', 96, 36, 4.8, nowMs + 600, cw, ch);
        drawPinchedStar(ctx, mBL[0], mBL[1], 10.5, 4.0, 1.1, 1.1, pulse);
        for (let k = 0; k < 3; k++) {
          const ph = (tSec * 0.4 + k * 0.33 + 0.5) % 1.0;
          drawDiamondShard(ctx, pad + 8 + k * 14 + Math.cos(ang + k) * 3, ch - 7 + ph * 4, 2.1, Math.sin(ph * Math.PI) * 0.92, -ang + k, k !== 1);
        }
      } else {
        drawSlimRoundedArcBrush(ctx, pad, pad, 300, 300, 14, 'TL', 56, 20, 3.8, nowMs + 900, cw, ch);
      }
      ctx.restore();
    });

    // 2F: Sidebar Active Conversation Item (GPU-Composited Glide Pill + Compact 252x46 Canvas)
    if (suite.sidebar === '2F') {
      const curPath = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '';
      if (!ast.sbScrollerEl || !ast.sbScrollerEl.isConnected) {
        ast.sbScrollerEl = findSidebarScroller(shell);
      }
      if (!ast.sbActiveRow || !ast.sbActiveRow.isConnected || ast.sbLastPath !== curPath) {
        const liveTarget = findActiveSidebarConversationEl(shell);
        if (liveTarget && liveTarget !== ast.sbActiveRow) {
          shell.querySelectorAll('[data-agy-vfx-sb-host]').forEach(p => { if (p !== liveTarget) p.removeAttribute('data-agy-vfx-sb-host'); });
          liveTarget.setAttribute('data-agy-vfx-sb-host', '1');
          ast.sbActiveRow = liveTarget;
          syncSidebarIosTargetPosition(liveTarget, ast.sbScrollerEl, true);
        } else if (liveTarget) {
          syncSidebarIosTargetPosition(liveTarget, ast.sbScrollerEl, true);
        }
      }
      ast.sbLastPath = curPath;
    }

    const sbVfxC = document.getElementById('agy-vfx-2f-sidebar');
    if (suite.sidebar === '2F' && sbVfxC && !(staticOnly && sbVfxC.dataset.drawnOnce === '1')) {
      const ctx = sbVfxC.getContext('2d');
      if (ctx) {
        sbVfxC.dataset.drawnOnce = '1';
        const cw = Number(sbVfxC.dataset.wCss) || 252;
        const ch = Number(sbVfxC.dataset.hCss) || 46;
        const x0 = 6, y0 = 7, x1 = cw - 6, y1 = ch - 7;
        const midY = (y0 + y1) * 0.5;
        const rad = 9;
        const armH = Math.min(38, (x1 - x0) * 0.22);
        const armV = Math.max(4, (y1 - y0 - rad * 2) * 0.5);

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        // Connecting silver hairlines between U-caps
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.58)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x0 + armH * 0.85, y0); ctx.lineTo(x1 - armH * 0.85, y0);
        ctx.moveTo(x0 + armH * 0.85, y1); ctx.lineTo(x1 - armH * 0.85, y1);
        ctx.stroke();

        const tl = buildCornerArcPolyline(x0, y0, x1, y1, rad, 'TL', armH, armV, 0);
        const bl = buildCornerArcPolyline(x0, y0, x1, y1, rad, 'BL', armH, armV, 0);
        const leftU = tl.pts.slice().reverse().concat(bl.pts.slice().reverse().slice(1));

        const tr = buildCornerArcPolyline(x0, y0, x1, y1, rad, 'TR', armH, armV, 0);
        const br = buildCornerArcPolyline(x0, y0, x1, y1, rad, 'BR', armH, armV, 0);
        const rightU = tr.pts.concat(br.pts.slice(1));

        drawVariableWidthBoilingPolyline(ctx, leftU, (u) => 4.6 * Math.pow(Math.sin(u * Math.PI), 0.72), nowMs, 1.0, cw, ch);
        drawVariableWidthBoilingPolyline(ctx, rightU, (u) => 4.6 * Math.pow(Math.sin(u * Math.PI), 0.72), nowMs + 600, 1.0, cw, ch);

        // Compact vertical-oriented diamond stars on the U-cap midpoints
        drawPinchedStar(ctx, x0, midY, 5.8 * pulse, 9.5 * pulse, 0.9 * pulse, 1.0, '#ffffff', '#08090d', 0);
        drawPinchedStar(ctx, x1, midY, 5.8 * pulse, 9.5 * pulse, 0.9 * pulse, 1.0, '#ffffff', '#08090d', 0);

        // 4 Symmetrical gliding diamond beads along top & bottom silver rails
        const span = Math.max(20, (x1 - x0) * 0.5 - armH - 8);
        const offX = span * (0.5 + 0.5 * Math.sin(ang));
        for (const bx of [x0 + armH + 8 + offX, x1 - armH - 8 - offX]) {
          drawDiamondShard(ctx, bx, y0, 2.5, 0.94, 0, true);
          drawDiamondShard(ctx, bx, y1, 2.5, 0.94, 0, true);
        }
        ctx.restore();
      }
    }

    // 3B-1: Top Header Horizon Seam
    const hdrC = document.getElementById('agy-vfx-3b1-header');
    if (hdrC && !(staticOnly && hdrC.dataset.drawnOnce === '1')) {
      const ctx = hdrC.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        hdrC.dataset.drawnOnce = '1';
        const cw = Number(hdrC.dataset.wCss) || 800;
        const ch = Number(hdrC.dataset.hCss) || 36;
        const tEnd = Number(hdrC.dataset.titleEndX) || Math.min(200, cw * 0.35);
        const hy = ch * 0.5;

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);

        // Full-span architectural silver-on-ink horizon line
        ctx.strokeStyle = 'rgba(7, 8, 12, 0.72)';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(4, hy); ctx.lineTo(cw - 4, hy); ctx.stroke();
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.56)';
        ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.moveTo(4, hy); ctx.lineTo(cw - 4, hy); ctx.stroke();

        // 3 interlocking slim Sumi-e Boiling Charcoal Brush Blades
        const b1End = Math.min(cw * 0.52, tEnd + 16);
        const b2Start = Math.max(80, b1End - 26);
        const b2End = Math.max(b2Start + 80, cw * 0.68);
        const b3Start = Math.max(b2Start + 40, cw * 0.61);

        drawSlimBoilingBrushSegment(ctx, [8, hy], [(8 + b1End) * 0.5, hy - 1.4], [b1End, hy], 5.4, nowMs, cw, ch);
        drawSlimBoilingBrushSegment(ctx, [b2Start, hy], [(b2Start + b2End) * 0.5, hy + 1.6], [b2End, hy], 6.8, nowMs + 450, cw, ch);
        drawSlimBoilingBrushSegment(ctx, [b3Start, hy], [(b3Start + cw - 8) * 0.5, hy - 1.4], [cw - 8, hy], 5.8, nowMs + 900, cw, ch);

        // Twin Concave Starbursts at Title-Guard junction & Right Blade junction
        drawPinchedStar(ctx, b1End - 10, hy - 0.8, 18.0, 6.2, 1.6, 1.3, pulse);
        drawPinchedStar(ctx, b1End + 18, hy + 1.4, 10.5, 4.0, 1.0, 1.05, pulse);
        const rStarX = Math.max(b2End + 24, cw * 0.78);
        if (rStarX < cw - 30) {
          drawPinchedStar(ctx, rStarX, hy, 14.5, 5.0, 1.35, 1.15, pulse);
          drawPinchedStar(ctx, rStarX + 23, hy - 0.9, 8.8, 3.3, 0.9, 1.0, pulse);
        }

        // 12 Rotating Black-Ink Diamond Shards with Silver Rims
        for (let m = 0; m < 12; m++) {
          const ph = (tSec * 0.42 + m / 12) % 1.0;
          const mx = 28 + ph * Math.max(120, cw - 56);
          const my = hy + 5.2 + Math.sin(ph * Math.PI * 4 + m) * 4.5;
          const al = Math.sin(ph * Math.PI) * 0.94;
          drawDiamondShard(ctx, mx, my, 2.2 + (m % 2) * 0.5, al, ang + m * 0.9, m % 3 !== 2);
        }
        ctx.restore();
      }
    }

    // 4A-2: Thinking for 3s 3-Layer Braided Nebula Silk Wave
    shell.querySelectorAll('canvas.agy-vfx-4a2-thinking').forEach(c => {
      if (staticOnly && c.dataset.drawnOnce === '1') return;
      const rect = c.getBoundingClientRect();
      if (c.dataset.drawnOnce === '1' && (rect.width <= 0 || rect.bottom < -24 || rect.top > vh + 24)) return;
      c.dataset.drawnOnce = '1';
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      const cw = Number(c.dataset.wCss) || 320;
      const ch = Number(c.dataset.hCss) || 28;
      const gx0 = 14, gx1 = cw - 12, gy = ch * 0.5;
      if (gx1 <= gx0 + 30) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const nSteps = 72;
      const ptsW1 = [], ptsW2 = [], ptsMid = [];
      const amp = Math.min(9.5, ch * 0.36);
      for (let i = 0; i <= nSteps; i++) {
        const u = i / nSteps;
        const px = gx0 + u * (gx1 - gx0);
        const env = Math.pow(Math.sin(u * Math.PI), 1.05);
        const yTop = gy + Math.sin(u * Math.PI * 3.0 - ang * 1.6) * amp * env;
        const yBot = gy - Math.sin(u * Math.PI * 3.0 - ang * 1.6) * amp * env;
        const yMid = gy + Math.cos(u * Math.PI * 4.5 + ang * 1.6) * (amp * 0.55) * env;
        ptsW1.push([px, yTop]);
        ptsW2.push([px, yBot]);
        ptsMid.push([px, yMid]);
      }

      // Layer 1: Monochrome Nebula Mist pocket between yTop & yBot
      ctx.beginPath();
      for (let i = 0; i < ptsW1.length; i++) {
        if (i === 0) ctx.moveTo(ptsW1[i][0], ptsW1[i][1]);
        else ctx.lineTo(ptsW1[i][0], ptsW1[i][1]);
      }
      for (let i = ptsW2.length - 1; i >= 0; i--) ctx.lineTo(ptsW2[i][0], ptsW2[i][1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(226, 232, 240, 0.14)';
      ctx.fill();

      // Soft translucent charcoal mist inside pocket
      const grainTile = ensureCoherentGrainTile();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.28;
      const sx1 = (nowMs * 0.0095) % 160;
      const sy1 = (nowMs * 0.0028) % 160;
      for (let gx = -160; gx < cw + 160; gx += 160) {
        for (let gyTile = -160; gyTile < ch + 160; gyTile += 160) {
          ctx.drawImage(grainTile, gx + sx1, gyTile + sy1);
        }
      }
      ctx.restore();

      // Layer 2: Counter-oscillating Platinum Silver Filigree Waves
      for (const [pts, wLine, col] of [[ptsW2, 1.1, 'rgba(203, 213, 225, 0.78)'], [ptsW1, 1.5, '#ffffff']]) {
        ctx.strokeStyle = 'rgba(7, 8, 12, 0.88)';
        ctx.lineWidth = wLine + 1.3;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = wLine;
        ctx.stroke();
      }

      // Layer 3: Central Sumi-e Boiling Charcoal Silk Ribbon
      drawVariableWidthBoilingPolyline(ctx, ptsMid, (u) => 4.8 * Math.pow(Math.sin(u * Math.PI), 0.78), nowMs + 300, 1.0, cw, ch);

      // Silver Crescent-Star Emitter at left edge
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(gx0 - 2, gy, 7.2, -1.25, 1.25); ctx.stroke();
      drawPinchedStar(ctx, gx0, gy, 10.5, 4.0, 1.1, 1.0, pulse);

      // 4 Flowing Starlight Pearls & 8 Diamond Stardust Motes
      for (let k = 0; k < 4; k++) {
        const tu = ((tSec * 0.42 + k * 0.25) % 0.86) + 0.07;
        const envC = Math.pow(Math.sin(tu * Math.PI), 1.05);
        const sx = gx0 + tu * (gx1 - gx0);
        const sy = gy + Math.sin(tu * Math.PI * 3.0 - ang * 1.6) * amp * envC * (k % 2 === 0 ? 1 : -1);
        const sc = 0.65 + 0.35 * envC;
        drawPinchedStar(ctx, sx, sy, 10.5 * sc, 3.8 * sc, 1.0, 0.95, 1.0);
      }
      for (let m = 0; m < 8; m++) {
        const ph = (tSec * 0.42 + m * 0.125) % 1.0;
        const mx = gx0 + ph * (gx1 - gx0);
        const my = gy + Math.cos(ph * Math.PI * 4.5 + ang * 1.6) * (amp * 0.72) + Math.sin(m * 2.1) * 3.0;
        drawDiamondShard(ctx, mx, my, 1.9, Math.sin(ph * Math.PI) * 0.92, ang + m, m % 2 === 0);
      }
      ctx.restore();
    });
    return true;
  }

  function drawComposerKatanaCorners(nowMs, dyEst, burst, staticOnly, dprOverride) {
    const compEl = document.querySelector('.surface-composer');
    if (!compEl) return;

    const cDpr = dprOverride || 2;
    const ensureCompCanvas = (id, wCss, hCss, cssText) => {
      let canv = compEl.querySelector('#' + id);
      if (!canv) {
        canv = document.createElement('canvas');
        canv.id = id;
        compEl.appendChild(canv);
      }
      const bw = Math.max(2, Math.round(wCss * cDpr));
      const bh = Math.max(2, Math.round(hCss * cDpr));
      if (canv.width !== bw || canv.height !== bh) {
        canv.width = bw;
        canv.height = bh;
        delete canv.dataset.drawnOnce;
      }
      if (canv.style.cssText !== cssText) canv.style.cssText = cssText;
      return canv;
    };

    const trC = ensureCompCanvas(
      'agy-katana-tr-canvas', 257, 106,
      'position:absolute;top:-14px;right:-15px;width:257px;height:106px;pointer-events:none;z-index:35;'
    );
    const blC = ensureCompCanvas(
      'agy-katana-bl-canvas', 235, 102,
      'position:absolute;bottom:-14px;left:-14px;width:235px;height:102px;pointer-events:none;z-index:35;'
    );
    if (staticOnly && trC.dataset.drawnOnce === '1' && blC.dataset.drawnOnce === '1') {
      return;
    }

    const grainTile = ensureCoherentGrainTile();
    const gShift1X = (nowMs * 0.0095) % 160;
    const gShift1Y = (nowMs * 0.0028) % 160;
    const gShift2X = (160 - ((nowMs * 0.0052) % 160)) % 160;
    const gShift2Y = (nowMs * 0.0041) % 160;
    const bVal = burst || 0;
    const cStarPulse = (0.95 + 0.08 * Math.sin(nowMs * 0.0018)) * (1.0 + bVal * 0.28);
    const dyVal = Number.isFinite(dyEst) ? dyEst : 6.0;

    const drawBoilingCorner = (canv, isTR) => {
      if (staticOnly && canv.dataset.drawnOnce === '1') return;
      const cctx = canv.getContext('2d', { willReadFrequently: true });
      if (!cctx) return;
      canv.dataset.drawnOnce = '1';
      cctx.save();
      cctx.setTransform(cDpr, 0, 0, cDpr, 0, 0);
      cctx.clearRect(0, 0, isTR ? 257 : 235, isTR ? 106 : 102);

      const w1 = Math.sin(nowMs * 0.0014) * 2.4 + (dyVal - 6.0) * 0.14;
      const w2 = Math.cos(nowMs * 0.0017) * 2.2 - (dyVal - 6.0) * 0.12;
      const slowBoil = (seedOff) => Math.sin(nowMs * 0.0026 + seedOff) * 2.3 + Math.cos(nowMs * 0.0041 + seedOff * 1.7) * 1.4;

      const outerBlades = isTR ? [
        [18, 15, 98, 2.5 + w1, 204, 1.5 - w1 * 0.7, 122, 16.5, 55, 22],
        [88, 14, 158, 1.0 - w2, 246, 0.8 + w2 * 0.8, 184, 17.5, 124, 24],
        [208, 17, 243 + w1 * 0.6, 42, 254 - w2 * 0.7, 90, 236, 56, 220, 30]
      ] : [
        [216, 86, 136, 96.5 + w1, 34, 99.5 - w1 * 0.7, 114, 83.5, 178, 79],
        [150, 87, 82, 97.5 - w2, 5, 100.2 + w2 * 0.8, 66, 83.5, 120, 78],
        [26, 81, 6 + w1 * 0.6, 52, 2 - w2 * 0.7, 9, 15, 44, 24, 68]
      ];

      const innerBlades = isTR ? [
        [30, 15.5, 108, 4.8 + w1, 193, 3.8 - w1 * 0.7, 122, 16.2, 60, 20.5],
        [98, 14.5, 165, 3.4 - w2, 236, 2.8 + w2 * 0.8, 182, 16.8, 129, 22.5],
        [211, 19, 240 + w1 * 0.6, 44, 249 - w2 * 0.7, 81, 234, 53, 219, 29]
      ] : [
        [204, 85.5, 130, 94.5 + w1, 45, 96.8 - w1 * 0.7, 116, 84.2, 173, 80.5],
        [140, 86.5, 78, 95.5 - w2, 14, 97.8 + w2 * 0.8, 70, 84.2, 116, 79.5],
        [23.5, 79, 8.5 + w1 * 0.6, 52, 4.8 - w2 * 0.7, 16, 15.5, 45, 22.5, 66]
      ];

      cctx.fillStyle = '#ffffff';
      outerBlades.forEach((b, idx) => {
        const b1 = slowBoil(idx * 2.7);
        const b2 = slowBoil(idx * 4.9 + 1.2);
        cctx.beginPath();
        cctx.moveTo(b[0], b[1]);
        cctx.quadraticCurveTo(b[2] + b1 * 0.4, b[3] + b1 * 0.75, b[4] + b2 * 0.6, b[5] + b2 * 0.75);
        cctx.quadraticCurveTo(b[6] - b1 * 0.4, b[7] - b2 * 0.5, b[8], b[9]);
        cctx.closePath();
        cctx.fill();
      });

      for (let t = 0; t < 9; t++) {
        const u = 0.14 + (t / 9.0) * 0.78;
        const bRef = outerBlades[t % 2];
        const tx = (1 - u) * (1 - u) * bRef[0] + 2 * (1 - u) * u * bRef[2] + u * u * bRef[4];
        const ty = (1 - u) * (1 - u) * bRef[1] + 2 * (1 - u) * u * bRef[3] + u * u * bRef[5];
        const waveH = (3.2 + (t % 3) * 1.8) * (0.55 + 0.45 * Math.sin(nowMs * 0.0024 + t * 1.45));
        const dirY = isTR ? -1 : 1;
        const dirX = isTR ? 1 : -1;
        cctx.fillStyle = '#ffffff';
        cctx.beginPath();
        cctx.moveTo(tx - 6 * dirX, ty - dirY * 1.0);
        cctx.quadraticCurveTo(tx + 2 * dirX, ty + dirY * waveH, tx + 9 * dirX, ty + dirY * (waveH * 0.85));
        cctx.quadraticCurveTo(tx + 3 * dirX, ty + dirY * 0.5, tx + 5 * dirX, ty - dirY * 1.2);
        cctx.closePath();
        cctx.fill();
        cctx.fillStyle = '#08090d';
        cctx.beginPath();
        cctx.moveTo(tx - 4.5 * dirX, ty - dirY * 1.2);
        cctx.quadraticCurveTo(tx + 1.5 * dirX, ty + dirY * (waveH * 0.72), tx + 7.2 * dirX, ty + dirY * (waveH * 0.62));
        cctx.quadraticCurveTo(tx + 2.2 * dirX, ty + dirY * 0.2, tx + 3.5 * dirX, ty - dirY * 1.4);
        cctx.closePath();
        cctx.fill();
      }

      cctx.save();
      cctx.beginPath();
      innerBlades.forEach((b, idx) => {
        const b1 = slowBoil(idx * 3.8 + 0.6);
        const b2 = slowBoil(idx * 5.3 + 2.0);
        cctx.moveTo(b[0], b[1]);
        cctx.quadraticCurveTo(b[2] + b1 * 0.65, b[3] + b2 * 0.7, b[4] - b1 * 0.5, b[5] + b1 * 0.7);
        cctx.quadraticCurveTo(b[6] + b2 * 0.65, b[7] - b1 * 0.5, b[8], b[9]);
        cctx.closePath();
      });
      cctx.fillStyle = '#07080c';
      cctx.fill();
      cctx.clip();

      cctx.globalAlpha = 0.92;
      for (let gx = -160; gx < 280; gx += 160) {
        for (let gy = -160; gy < 140; gy += 160) {
          cctx.drawImage(grainTile, gx + gShift1X, gy + gShift1Y);
        }
      }
      cctx.globalAlpha = 0.62;
      for (let gx = -160; gx < 280; gx += 160) {
        for (let gy = -160; gy < 140; gy += 160) {
          cctx.drawImage(grainTile, gx + gShift2X, gy + gShift2Y);
        }
      }
      cctx.restore();

      for (let m = 0; m < 16; m++) {
        const phase = ((nowMs * 0.00022 + m * 0.0625) % 1.0);
        const bladeRef = innerBlades[m % 3];
        const mxBase = bladeRef[0] + (bladeRef[4] - bladeRef[0]) * phase;
        const myBase = bladeRef[1] + (bladeRef[5] - bladeRef[1]) * phase;
        const waveX = Math.sin(nowMs * 0.0021 + m * 3.7) * 5.5;
        const waveY = Math.cos(nowMs * 0.0025 + m * 2.3) * 4.8 + (isTR ? -4.5 : 4.5) * phase;
        const mx = mxBase + waveX;
        const my = myBase + waveY;
        const sz = (2.2 + (m % 4) * 1.15) * (1.0 - phase * 0.45);
        const alphaM = Math.sin(phase * Math.PI) * 0.96;
        const rot = nowMs * 0.0012 * (m % 2 === 0 ? 1 : -1) + m;

        cctx.save();
        cctx.translate(mx, my);
        cctx.rotate(rot);
        if (m % 3 !== 2) {
          cctx.beginPath();
          cctx.moveTo(-sz * 1.35, 0);
          cctx.lineTo(0, -sz * 0.75);
          cctx.lineTo(sz * 1.35, 0);
          cctx.lineTo(0, sz * 0.75);
          cctx.closePath();
          cctx.fillStyle = `rgba(8, 9, 13, ${alphaM.toFixed(3)})`;
          cctx.fill();
          cctx.lineWidth = 1.05;
          cctx.strokeStyle = `rgba(248, 250, 255, ${(alphaM * 0.92).toFixed(3)})`;
          cctx.stroke();
        } else {
          cctx.beginPath();
          cctx.moveTo(-sz, 0);
          cctx.lineTo(0, -sz);
          cctx.lineTo(sz, 0);
          cctx.lineTo(0, sz);
          cctx.closePath();
          cctx.fillStyle = `rgba(248, 250, 255, ${(alphaM * 0.95).toFixed(3)})`;
          cctx.fill();
          cctx.lineWidth = 0.85;
          cctx.strokeStyle = `rgba(8, 9, 13, ${(alphaM * 0.85).toFixed(3)})`;
          cctx.stroke();
        }
        cctx.restore();
      }

      const drawCornerStar = (scx, scy, rx, ry, waist, sw) => {
        const srx = rx * cStarPulse;
        const sry = ry * cStarPulse;
        cctx.beginPath();
        cctx.moveTo(scx - srx, scy);
        cctx.quadraticCurveTo(scx - waist, scy - waist, scx, scy - sry);
        cctx.quadraticCurveTo(scx + waist, scy - waist, scx + srx, scy);
        cctx.quadraticCurveTo(scx + waist, scy + waist, scx, scy + sry);
        cctx.quadraticCurveTo(scx - waist, scy + waist, scx - srx, scy);
        cctx.closePath();
        cctx.fillStyle = '#ffffff';
        cctx.fill();
        cctx.lineWidth = sw;
        cctx.strokeStyle = '#08090d';
        cctx.stroke();
      };

      if (isTR) {
        drawCornerStar(123, 13, 22.0, 9.5, 2.0, 1.6);
        drawCornerStar(177, 15, 42.0, 14.5, 3.2, 2.2);
      } else {
        drawCornerStar(118, 88, 18.0, 8.0, 1.8, 1.6);
        drawCornerStar(72, 87, 34.0, 12.5, 2.6, 2.2);
      }

      cctx.restore();
    };

    drawBoilingCorner(trC, true);
    drawBoilingCorner(blC, false);
  }

  function renderAvatarVfxFrame(nowMs, staticOnly = false) {
    const ast = getAvatarVfxState();
    if (!ast.enabled && !ast.uiSuite && !ast.hasComposerKatana) return false;
    const sbVfxEl = document.getElementById('agy-vfx-2f-sidebar');
    if (!staticOnly && ast.sbTransitionUntil && nowMs < ast.sbTransitionUntil && (!sbVfxEl || sbVfxEl.dataset.drawnOnce === '1')) {
      return true;
    }
    if (ast.enabled) {
      const canvases = document.querySelectorAll('.agy-shell canvas.agy-avatar-vfx-canvas');
      if (canvases.length) {
        const est = window.__AGY_EYE_STATE__;
        const mouseX = est ? est.mouseX : -9999;
        const mouseY = est ? est.mouseY : -9999;
        const recentHover = !staticOnly && est ? ((nowMs - (est.lastMoveTs || 0)) < 4000) : false;
        const isThinking = !staticOnly && Boolean(document.querySelector('.surface-composer button[aria-label*="Stop"], .surface-composer [data-testid*="stop"]'));
        const aiNodes = isThinking ? document.querySelectorAll('.agy-shell [data-testid="agent-response"]') : null;
        const lastAiEl = aiNodes && aiNodes.length ? aiNodes[aiNodes.length - 1] : null;
        const tSec = nowMs * 0.001;
        const vh = window.innerHeight || 960;

        canvases.forEach(c => {
          if (staticOnly && c.dataset.drawnOnce === '1') return;
          const rect = c.getBoundingClientRect();
          if (!staticOnly && c.dataset.drawnOnce === '1' && (rect.width <= 0 || rect.bottom < -36 || rect.top > vh + 36)) return;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          if (!ctx) return;
          c.dataset.drawnOnce = '1';

          const role = c.dataset.role || 'ai';
          const corePx = Number(c.dataset.corePx) || 32;
          const boxPx = Number(c.dataset.boxPx) || 78;
          const r = corePx * 0.5;
          let targetBoost = 1.0;

          if (!staticOnly) {
            if (role === 'ai' && lastAiEl && c.parentElement === lastAiEl) {
              targetBoost = 1.30;
            }
            if (recentHover) {
              const dx = mouseX - (rect.left + rect.width * 0.5);
              const dy = mouseY - (rect.top + rect.height * 0.5);
              if (dx * dx + dy * dy <= (corePx * 0.92) * (corePx * 0.92)) {
                targetBoost = Math.max(targetBoost, 1.25);
              }
            }
          }

          const prevBoost = ast.boostMap.get(c) || 1.0;
          const boost = staticOnly ? 1.0 : (prevBoost + (targetBoost - prevBoost) * 0.14);
          ast.boostMap.set(c, boost);

          ctx.save();
          ctx.setTransform(ast.dpr, 0, 0, ast.dpr, 0, 0);
          drawEclipseKatanaAvatar(ctx, role === 'ai' ? ast.agentClip : ast.userClip, boxPx, r, tSec, role, boost);
          ctx.restore();
        });
      }
    }
    if (ast.uiSuite) {
      renderUiVfxSuiteFrame(nowMs, staticOnly);
    }
    if (ast.hasComposerKatana && (staticOnly || !window.__AGY_EYE_RAF__)) {
      const est = window.__AGY_EYE_STATE__;
      drawComposerKatanaCorners(
        staticOnly ? LITE_STATIC_T : nowMs,
        est ? est.smoothDy : 6.0,
        staticOnly ? 0 : (est ? (est.starBurst || 0) : 0),
        staticOnly,
        ast.dpr
      );
    }
    return true;
  }

  function scheduleLitePaint() {
    const ast = getAvatarVfxState();
    if (ast.perfMode !== 'lite') return;
    if (!ast.enabled && !ast.uiSuite && !ast.hasComposerKatana) return;
    if (window.__AGY_LITE_PAINT_RAF__) return;
    window.__AGY_LITE_PAINT_RAF__ = requestAnimationFrame(() => {
      window.__AGY_LITE_PAINT_RAF__ = 0;
      const cur = getAvatarVfxState();
      if (cur.perfMode !== 'lite') return;
      if (cur.enabled) syncAvatarVfxCanvases();
      if (cur.uiSuite) mountUiVfxSuiteCanvases(true);
      renderAvatarVfxFrame(LITE_STATIC_T, true);
    });
  }

  function startUltraAvLoop() {
    if (window.__AGY_EYE_RAF__ || window.__AGY_AV_RAF__ || document.hidden) return;
    const loop = () => {
      const cur = getAvatarVfxState();
      if (document.hidden || cur.perfMode === 'lite' || window.__AGY_EYE_RAF__ || (!cur.enabled && !cur.uiSuite && !cur.hasComposerKatana)) {
        window.__AGY_AV_RAF__ = 0;
        return;
      }
      renderAvatarVfxFrame(performance.now(), false);
      window.__AGY_AV_RAF__ = requestAnimationFrame(loop);
    };
    window.__AGY_AV_RAF__ = requestAnimationFrame(loop);
  }

  function syncAvatarVfxState(st, mainTheme, effectiveUserAvatar, effectiveAgentAvatar, avSize, avAgentSize) {
    const ast = getAvatarVfxState();
    const prevPerf = ast.lastSyncPerf ?? ast.perfMode;
    const prevDpr = ast.lastSyncDpr ?? ast.dpr;
    ast.perfMode = st.performanceMode || DEFAULT_PERF_MODE;
    ast.enabled = Boolean(mainTheme && mainTheme.avatarVfx === 'eclipse_katana' && (effectiveUserAvatar || effectiveAgentAvatar));
    ast.uiSuite = (mainTheme && mainTheme.uiVfxSuite) ? mainTheme.uiVfxSuite : null;
    ast.hasComposerKatana = Boolean(mainTheme && (mainTheme.avatarVfx === 'eclipse_katana' || mainTheme.eyeTracking) && st.wpEnabled && st.inputStyle !== 'minimal');
    ast.userSrc = effectiveUserAvatar || '';
    ast.agentSrc = effectiveAgentAvatar || '';
    ast.avSize = avSize;
    ast.avAgentSize = avAgentSize;
    ast.dpr = getEffectiveDpr(ast.perfMode);
    ast.lastSyncPerf = ast.perfMode;
    ast.lastSyncDpr = ast.dpr;

    if (!ast.hasComposerKatana) {
      const trC = document.getElementById('agy-katana-tr-canvas');
      if (trC) trC.remove();
      const blC = document.getElementById('agy-katana-bl-canvas');
      if (blC) blC.remove();
    }

    if (prevPerf !== ast.perfMode || prevDpr !== ast.dpr) {
      document.querySelectorAll('.agy-avatar-vfx-canvas, .agy-ui-vfx-canvas, #agy-katana-tr-canvas, #agy-katana-bl-canvas').forEach(el => {
        delete el.dataset.drawnOnce;
      });
    }

    if (!ast.enabled && !ast.uiSuite && !ast.hasComposerKatana) {
      stopAvatarVfxRig();
      return;
    }

    if (ast.enabled) {
      cachePortraitClip(ast.userSrc, 'user');
      cachePortraitClip(ast.agentSrc, 'agent');
      syncAvatarVfxCanvases();
    } else {
      document.querySelectorAll('.agy-avatar-vfx-canvas').forEach(el => el.remove());
    }
    if (ast.uiSuite) {
      mountUiVfxSuiteCanvases(true);
    } else {
      document.querySelectorAll('.agy-ui-vfx-canvas, #agy-ios-sidebar-pill').forEach(el => el.remove());
      document.querySelectorAll('[data-agy-vfx-sb-host]').forEach(el => el.removeAttribute('data-agy-vfx-sb-host'));
    }

    if (ast.perfMode === 'lite') {
      if (window.__AGY_AV_RAF__) {
        cancelAnimationFrame(window.__AGY_AV_RAF__);
        window.__AGY_AV_RAF__ = 0;
      }
      scheduleLitePaint();
      return;
    }

    if (window.__AGY_LITE_PAINT_RAF__) {
      cancelAnimationFrame(window.__AGY_LITE_PAINT_RAF__);
      window.__AGY_LITE_PAINT_RAF__ = 0;
    }
    startUltraAvLoop();
  }

  function syncEyeTrackingRig(st, mainTheme, layer, vid, overlayRgb, overlayAlpha) {
    const eyeCanvas = layer ? layer.querySelector('#agy-custom-theme-eye-canvas') : null;
    if (st.performanceMode === 'lite' || !eyeCanvas || !vid || !st.wpEnabled || st.customWp || !mainTheme.eyeTracking || !mainTheme.eyeScleraMask) {
      stopEyeTrackingRig(st.performanceMode !== 'lite');
      if (eyeCanvas) eyeCanvas.style.display = 'none';
      return;
    }
    eyeCanvas.style.display = 'block';

    window.__AGY_EYE_STATE__ = window.__AGY_EYE_STATE__ || {
      mouseX: window.innerWidth * 0.5,
      mouseY: window.innerHeight * 0.45,
      lastMoveTs: 0,
      typeX: window.innerWidth * 0.5,
      typeY: window.innerHeight * 0.85,
      lastTypeTs: 0,
      virtualCol: 0,
      starBurst: 0,
      shockRing: 0,
      curX: 0,
      curY: 0,
      smoothDy: 0,
      smoothClose: 0,
      cacheKey: '',
      scleraImg: null,
      irisLImg: null,
      irisRImg: null,
      blinkImg: null,
      detCanvas: null,
      detCtx: null,
      profBuf: null,
      scoreBuf: null,
      lastVidTime: -1,
      lastNBright: 48,
      lastYLash: 73.0,
      overlayRgb: '6, 7, 10',
      overlayAlpha: 0
    };
    const est = window.__AGY_EYE_STATE__;
    est.overlayRgb = overlayRgb || mainTheme.overlayRgb || '6, 7, 10';
    est.overlayAlpha = Number.isFinite(overlayAlpha) ? overlayAlpha : 0;
    if (!est.profBuf) est.profBuf = new Float32Array(105);
    if (!est.scoreBuf) est.scoreBuf = new Float32Array(21);
    est.lastVidTime = -1;

    const scleraUrl = resolveAssetUrl(mainTheme.eyeScleraMask);
    const irisLUrl = resolveAssetUrl(mainTheme.eyeIrisLeft);
    const irisRUrl = resolveAssetUrl(mainTheme.eyeIrisRight);
    const blinkUrl = resolveAssetUrl(mainTheme.eyeBlinkMask);
    const newKey = `v17|${st.themeName}|${scleraUrl}|${irisLUrl}|${blinkUrl}`;
    if (est.cacheKey !== newKey) {
      est.cacheKey = newKey;
      const loadImg = (src) => {
        if (!src) return null;
        const im = new Image();
        if (!/^data:/i.test(src)) im.crossOrigin = 'anonymous';
        im.onload = () => { if (est.renderOnce) est.renderOnce(); };
        im.src = src;
        return im;
      };
      est.scleraImg = loadImg(scleraUrl);
      est.irisLImg = loadImg(irisLUrl);
      est.irisRImg = loadImg(irisRUrl);
      est.blinkImg = loadImg(blinkUrl);
    }

    if (!est.detCanvas || est.detCanvas.height !== 200) {
      est.detCanvas = document.createElement('canvas');
      est.detCanvas.width = 8;
      est.detCanvas.height = 200;
      est.detCtx = est.detCanvas.getContext('2d', { willReadFrequently: true });
    }

    const renderOnce = () => {
      const curLayer = document.getElementById('agy-custom-theme-video-layer');
      const curVid = document.getElementById('agy-custom-theme-video');
      const curCanvas = document.getElementById('agy-custom-theme-eye-canvas');
      if (getAvatarVfxState().perfMode === 'lite' || !curLayer || !curVid || !curCanvas || curCanvas.style.display === 'none') {
        return false;
      }

      const vw = curLayer.clientWidth || window.innerWidth;
      const vh = curLayer.clientHeight || window.innerHeight;
      const scale = Math.max(vw / 1920, vh / 1080);
      const offsetX = (vw - 1920 * scale) * 0.5;
      const offsetY = (vh - 1080 * scale) * 0.5;

      curCanvas.style.left = `${(offsetX + 620 * scale).toFixed(2)}px`;
      curCanvas.style.top = `${(offsetY + 348 * scale).toFixed(2)}px`;
      curCanvas.style.width = `${(685 * scale).toFixed(2)}px`;
      curCanvas.style.height = `${(165 * scale).toFixed(2)}px`;

      const now = performance.now();
      const eyeCx = offsetX + 962 * scale;
      const eyeCy = offsetY + 425 * scale;
      let targetX = 0;
      let targetY = 0;
      const isTypingActive = (now - (est.lastTypeTs || 0) < 2600) && ((est.lastTypeTs || 0) >= (est.lastMoveTs || 0) - 80);
      let lerpSpeed = 0.18;
      if (isTypingActive) {
        const rawNx = Math.max(-1, Math.min(1, ((est.typeX || eyeCx) - eyeCx) / Math.max(220, vw * 0.40)));
        const rawNy = Math.max(-1, Math.min(1, ((est.typeY || eyeCy) - eyeCy) / Math.max(160, vh * 0.40)));
        targetX = Math.sign(rawNx) * Math.pow(Math.abs(rawNx), 0.85) * 14.8;
        targetY = Math.sign(rawNy) * Math.pow(Math.abs(rawNy), 0.88) * 6.6;
        lerpSpeed = 0.24;
      } else if (now - est.lastMoveTs < 8000) {
        const rawNx = Math.max(-1, Math.min(1, (est.mouseX - eyeCx) / Math.max(220, vw * 0.42)));
        const rawNy = Math.max(-1, Math.min(1, (est.mouseY - eyeCy) / Math.max(160, vh * 0.42)));
        targetX = Math.sign(rawNx) * Math.pow(Math.abs(rawNx), 0.85) * 14.8;
        targetY = Math.sign(rawNy) * Math.pow(Math.abs(rawNy), 0.88) * 6.4;
      } else {
        targetX = Math.sin(now * 0.0008) * 2.2;
        targetY = Math.cos(now * 0.0006) * 1.0;
      }

      est.curX += (targetX - est.curX) * lerpSpeed;
      est.curY += (targetY - est.curY) * lerpSpeed;
      est.starBurst = (est.starBurst || 0) * 0.89;
      if (est.starBurst < 0.004) est.starBurst = 0;
      if (est.shockRing > 0) {
        est.shockRing += 0.044;
        if (est.shockRing > 1.0) est.shockRing = 0;
      }

      let dyEst = Number.isFinite(est.smoothDy) ? est.smoothDy : 0;
      let nBright = Number.isFinite(est.lastNBright) ? est.lastNBright : 48;
      let yLash = Number.isFinite(est.lastYLash) ? est.lastYLash : 73.0;

      if (curVid.readyState >= 2 && est.detCtx && curVid.currentTime !== est.lastVidTime) {
        try {
          est.lastVidTime = curVid.currentTime;
          // 1. Sample blink-immune Mouth/Chin strip (x: 935..985, y: 608..713 -> rows 0..104)
          est.detCtx.drawImage(curVid, 935, 608, 50, 105, 0, 0, 8, 105);
          // 2. Sample full Left Sclera vertical range (x: 706..717, y: 398..492 -> rows 105..198)
          est.detCtx.drawImage(curVid, 706, 398, 11, 94, 0, 105, 8, 94);

          const px = est.detCtx.getImageData(0, 0, 8, 199).data;
          const prof = est.profBuf;
          for (let r = 0; r < 105; r++) {
            let sum = 0;
            const rowOff = r * 32;
            for (let c = 0; c < 32; c += 4) {
              sum += px[rowOff + c] * 0.299 + px[rowOff + c + 1] * 0.587 + px[rowOff + c + 2] * 0.114;
            }
            prof[r] = sum * 0.125;
          }
          const scores = est.scoreBuf;
          let bestCand = 2;
          let bestSc = -2;
          for (let cand = 0; cand <= 20; cand++) {
            let mean = 0;
            for (let i = 0; i < 85; i++) mean += prof[cand + i];
            mean /= 85;
            let dot = 0;
            let normSq = 0;
            for (let i = 0; i < 85; i++) {
              const d = prof[cand + i] - mean;
              dot += d * MOUTH_REF_ZERO[i];
              normSq += d * d;
            }
            const sc = dot / (MOUTH_REF_NORM * Math.sqrt(normSq + 1e-5));
            scores[cand] = sc;
            if (sc > bestSc) {
              bestSc = sc;
              bestCand = cand;
            }
          }
          let sub = 0;
          if (bestCand > 0 && bestCand < 20) {
            const y1 = scores[bestCand - 1];
            const y2 = scores[bestCand];
            const y3 = scores[bestCand + 1];
            const denom = 2 * (2 * y2 - y1 - y3);
            if (Math.abs(denom) > 1e-5) {
              sub = Math.max(-0.5, Math.min(0.5, (y3 - y1) / denom));
            }
          }
          if (bestSc > 0.80) {
            dyEst = (bestCand - 2) + sub;
            est.smoothDy = dyEst;
          }

          // Scan Left Sclera vertical column using the EXACT current-frame dyEst (zero 1-frame lag!)
          const rBase = 105 + Math.max(0, Math.min(20, Math.round(4 + dyEst)));
          let countB = 0;
          let firstB = -1;
          for (let r = 0; r < 74; r++) {
            let sum = 0;
            const rowOff = (rBase + r) * 32;
            for (let c = 0; c < 32; c += 4) {
              sum += px[rowOff + c] * 0.299 + px[rowOff + c + 1] * 0.587 + px[rowOff + c + 2] * 0.114;
            }
            const rowLum = sum * 0.125;
            if (rowLum > 140.0) {
              countB++;
              if (firstB < 0) firstB = r;
            }
          }
          nBright = countB;
          yLash = firstB >= 0 ? (52.0 + firstB) : 140.0;
          est.lastNBright = nBright;
          est.lastYLash = yLash;
          est.smoothOpen = nBright < 20 ? 0 : (nBright < 45 ? 0.5 : 1);
        } catch (_) {}
      }

      const ctx = curCanvas.getContext('2d');
      if (ctx && est.scleraImg && est.scleraImg.complete && est.irisLImg && est.irisLImg.complete && est.irisRImg && est.irisRImg.complete) {
        ctx.clearRect(0, 0, 1370, 330);
        // Compute exact blink closure parameter `blinkT` in [0, 1]:
        // - nBright >= 45 -> blinkT = 0.0 (100% open, ZERO eyelash twitching on normal frames!)
        // - nBright <= 9  -> blinkT = 1.0 (100% closed on F447..F451)
        // - nBright <= 15 -> blinkT = 0.74 (F452..F453 opening slit, prevents static center-star flash!)
        let blinkT = 0.0;
        if (nBright >= 45) {
          blinkT = 0.0;
        } else if (nBright <= 9) {
          blinkT = 1.0;
        } else if (nBright <= 15) {
          blinkT = 0.74;
        } else {
          blinkT = Math.max(0.0, Math.min(1.0, (45.0 - nBright) / 38.0));
        }

        if (blinkT < 0.99) {
          const y0 = (2.0 + dyEst) * 2.0;
          const evalYLid = (x, t, isLeft) => {
            const yOpen = isLeft
              ? (55.5 + 0.0026 * Math.pow(x - 142.0, 2) + 0.062 * (x - 142.0))
              : (57.0 + 0.0026 * Math.pow(x - 175.0, 2) - 0.062 * (x - 175.0));
            const yClosed = isLeft
              ? (132.5 - 0.0042 * Math.pow(x - 160.0, 2) + 0.04 * (x - 160.0))
              : (134.0 - 0.0042 * Math.pow(x - 160.0, 2) - 0.04 * (x - 160.0));
            return (1.0 - t) * yOpen + t * yClosed;
          };

          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(est.scleraImg, 0, y0, 1370, 290);

          ctx.globalCompositeOperation = 'source-atop';
          const sx = 1.0 - Math.min(0.075, Math.abs(est.curX) * 0.0045);
          const dx2 = est.curX * 2.0;
          const dy2 = est.curY * 2.0;

          const lw = 580 * sx;
          const lx = 305 - 305 * sx + dx2;
          ctx.drawImage(est.irisLImg, lx, y0 + dy2, lw, 290);

          const rw = 580 * sx;
          const rx = 790 + (330 - 330 * sx) + dx2;
          ctx.drawImage(est.irisRImg, rx, y0 + dy2, rw, 290);

          const gx = dx2 * 1.28;
          const gy = dy2 * 1.28;
          const burst = est.starBurst || 0;
          const shock = est.shockRing || 0;
          const pulse = Math.min(1.35, 0.88 + 0.12 * Math.sin(now * 0.0045) + burst * 0.28);
          const starPulse = (0.90 + 0.16 * Math.sin(now * 0.0062)) * (1.0 + burst * 0.46);

          const drawCrystalOptics = (icx, scx, scy, yTop2x) => {
            const ccx = icx + dx2 * 0.62;
            const ccy = scy + 42 + dy2 * 0.55;
            ctx.save();
            ctx.translate(ccx, ccy);
            ctx.scale(1.85, 0.85);
            const cGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 38 + burst * 8);
            cGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.88, 0.38 * pulse).toFixed(3)})`);
            cGrad.addColorStop(0.55, `rgba(241, 245, 249, ${Math.min(0.45, 0.16 * pulse).toFixed(3)})`);
            cGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 38 + burst * 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const pxStar = scx + gx;
            const pyStar = scy + gy;

            // 1. Expanding Silver Iris Shockwave Ring on Click / Send Message
            if (shock > 0.005) {
              const ringR = 16 + shock * 78;
              const ringAlpha = Math.pow(1.0 - shock, 1.45) * 0.72;
              ctx.save();
              ctx.beginPath();
              ctx.arc(pxStar, pyStar, ringR, 0, Math.PI * 2);
              ctx.lineWidth = 2.2 + (1.0 - shock) * 2.4;
              ctx.strokeStyle = `rgba(248, 250, 252, ${ringAlpha.toFixed(3)})`;
              ctx.stroke();
              ctx.restore();
            }

            // 2. Supercharged Starlight Radial Bloom
            const bloomR = 54 * starPulse + burst * 28;
            const sGrad = ctx.createRadialGradient(pxStar, pyStar, 1, pxStar, pyStar, bloomR);
            sGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(0.95, 0.55 * starPulse).toFixed(3)})`);
            sGrad.addColorStop(0.35, `rgba(248, 250, 252, ${Math.min(0.52, 0.22 * starPulse).toFixed(3)})`);
            sGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = sGrad;
            ctx.beginPath();
            ctx.arc(pxStar, pyStar, bloomR, 0, Math.PI * 2);
            ctx.fill();

            // 3. 45-Degree Celestial Diamond Cross-Flare Needles on Click / Send / Typing Sparkle
            if (burst > 0.03) {
              const diagLen = (26 + burst * 36) * (0.9 + 0.1 * Math.sin(now * 0.02));
              const diagW = 2.2 + burst * 1.4;
              ctx.save();
              ctx.translate(pxStar, pyStar);
              ctx.rotate(Math.PI * 0.25);
              ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.92, burst * 0.85).toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(-diagLen, 0);
              ctx.quadraticCurveTo(-diagW, -diagW, 0, -diagLen);
              ctx.quadraticCurveTo(diagW, -diagW, diagLen, 0);
              ctx.quadraticCurveTo(diagW, diagW, 0, diagLen);
              ctx.quadraticCurveTo(-diagW, diagW, -diagLen, 0);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }

            // 4. Primary 4-Point Starlight Core
            const rayH = 74 * starPulse;
            const rayTop = 58 * starPulse;
            const rayBot = 74 * starPulse;
            const waist = 5.2 + burst * 1.8;

            ctx.beginPath();
            ctx.moveTo(pxStar - rayH, pyStar);
            ctx.quadraticCurveTo(pxStar - waist, pyStar - waist, pxStar, pyStar - rayTop);
            ctx.quadraticCurveTo(pxStar + waist, pyStar - waist, pxStar + rayH, pyStar);
            ctx.quadraticCurveTo(pxStar + waist, pyStar + waist, pxStar, pyStar + rayBot);
            ctx.quadraticCurveTo(pxStar - waist, pyStar + waist, pxStar - rayH, pyStar);
            ctx.closePath();

            ctx.lineWidth = 2.6;
            ctx.strokeStyle = 'rgba(12, 14, 20, 0.82)';
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            const d1R = 8.5 + burst * 3.0;
            const d1x = scx + dx2 * 1.38 - 44;
            const d1y = scy + dy2 * 1.38 + 34;
            const d1Grad = ctx.createRadialGradient(d1x, d1y, 0.5, d1x, d1y, d1R);
            d1Grad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
            d1Grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.60)');
            d1Grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = d1Grad;
            ctx.beginPath();
            ctx.arc(d1x, d1y, d1R, 0, Math.PI * 2);
            ctx.fill();

            const d2R = 6.0 + burst * 2.2;
            const d2x = scx + dx2 * 1.42 + 46;
            const d2y = scy + dy2 * 1.42 - 20;
            const d2Grad = ctx.createRadialGradient(d2x, d2y, 0.5, d2x, d2y, d2R);
            d2Grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
            d2Grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
            d2Grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = d2Grad;
            ctx.beginPath();
            ctx.arc(d2x, d2y, d2R, 0, Math.PI * 2);
            ctx.fill();

            const aoGrad = ctx.createLinearGradient(0, yTop2x - 4, 0, yTop2x + 36);
            aoGrad.addColorStop(0, 'rgba(4, 5, 9, 0.72)');
            aoGrad.addColorStop(0.45, 'rgba(6, 8, 14, 0.28)');
            aoGrad.addColorStop(1, 'rgba(6, 8, 14, 0)');
            ctx.fillStyle = aoGrad;
            ctx.fillRect(icx - 130, yTop2x - 4, 260, 42);
          };

          const yTopL2x = y0 + evalYLid(152.5, blinkT, true) * 2.0;
          const yTopR2x = y0 + evalYLid(165.0, blinkT, false) * 2.0;
          drawCrystalOptics(305, 316, y0 + 170, yTopL2x);
          drawCrystalOptics(790 + 330, 790 + 316, y0 + 174, yTopR2x);

          if (blinkT > 0.01) {
            // Clip upper eyeball along the anatomical morphing curve `evalYLid(x, blinkT)` (which bends from ︵ to ︶!)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = '#000000';
            for (const [xOff, isLeft, xStart, xEnd] of [[0, true, 68, 228], [790, false, 90, 249]]) {
              ctx.beginPath();
              ctx.moveTo(xOff + xStart * 2, 0);
              for (let x = xStart; x <= xEnd; x += 4) {
                ctx.lineTo(xOff + x * 2, y0 + evalYLid(x, blinkT, isLeft) * 2.0);
              }
              ctx.lineTo(xOff + xEnd * 2, 0);
              ctx.closePath();
              ctx.fill();
            }

            // Draw morphing vector eyelash arch & blades bending smoothly from ︵ to ︶ along `evalYLid(x, blinkT)`!
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgb(11, 12, 15)';
            const topPad = 5.2 * (1.0 - 0.35 * blinkT);
            const botPad = 1.6 + 1.4 * blinkT;
            const bladeScale = Math.max(0.25, 1.0 - 0.65 * blinkT);
            const bladesL = [
              [90, 105, -5.5, 6.2, 1.5], [106, 124, -8.5, 10.2, 2.2], [122, 138, -7.5, 9.5, 1.8],
              [137, 151, -5.0, 8.2, 1.2], [155, 169, 5.5, 7.8, -1.2], [171, 189, 8.5, 9.8, -1.8], [190, 209, 8.0, 9.2, -1.8]
            ];
            const bladesR = [
              [105, 118, -6.5, 7.0, -1.2], [116, 130, -7.5, 8.8, -1.5], [128, 143, -7.0, 9.2, -1.5],
              [144, 157, -4.5, 7.5, -1.0], [168, 183, 6.5, 8.0, 1.2], [184, 201, 8.5, 8.5, 1.8], [202, 222, 9.5, 7.2, 2.0]
            ];
            for (const [xOff, isLeft, xStart, xEnd, blades] of [[0, true, 76, 220, bladesL], [790, false, 98, 241, bladesR]]) {
              ctx.beginPath();
              for (let x = xStart; x <= xEnd; x += 4) {
                const py = y0 + (evalYLid(x, blinkT, isLeft) - topPad) * 2.0;
                if (x === xStart) ctx.moveTo(xOff + x * 2, py);
                else ctx.lineTo(xOff + x * 2, py);
              }
              for (let x = xEnd; x >= xStart; x -= 4) {
                const py = y0 + (evalYLid(x, blinkT, isLeft) + botPad) * 2.0;
                ctx.lineTo(xOff + x * 2, py);
              }
              ctx.closePath();
              ctx.fill();

              for (const [x0, x2, dxTip, dyTip, bend] of blades) {
                const by0 = evalYLid(x0, blinkT, isLeft);
                const by2 = evalYLid(x2, blinkT, isLeft);
                const xm = 0.5 * (x0 + x2);
                const ym = 0.5 * (by0 + by2);
                const xTip = xm + dxTip;
                const yTip = ym + dyTip * bladeScale;
                const cx1 = 0.55 * x0 + 0.45 * xTip + bend;
                const cy1 = 0.52 * by0 + 0.48 * yTip;
                const cx2 = 0.55 * x2 + 0.45 * xTip + bend * 0.7;
                const cy2 = 0.52 * by2 + 0.48 * yTip;
                ctx.beginPath();
                ctx.moveTo(xOff + x0 * 2, y0 + by0 * 2);
                ctx.quadraticCurveTo(xOff + cx1 * 2, y0 + cy1 * 2, xOff + xTip * 2, y0 + yTip * 2);
                ctx.quadraticCurveTo(xOff + cx2 * 2, y0 + cy2 * 2, xOff + x2 * 2, y0 + by2 * 2);
                ctx.closePath();
                ctx.fill();
              }
            }
          } else if (est.blinkImg && est.blinkImg.complete) {
            // Fully open eye (98% of video, blinkT === 0.0): draw locked 8x supersampled eyelashes at y0 with ZERO twitch!
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(est.blinkImg, 0, y0, 1370, 290);
          }

          if (est.overlayAlpha > 0.001) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(${est.overlayRgb || '6, 7, 10'}, ${est.overlayAlpha})`;
            ctx.fillRect(0, 0, 1370, 330);
          }

          ctx.restore();
        }
      }

      const astNow = getAvatarVfxState();
      if (astNow.hasComposerKatana) {
        drawComposerKatanaCorners(now, dyEst, est.starBurst || 0, false, astNow.dpr || 1.5);
      }

      if (window.__AGY_AV_RAF__) {
        cancelAnimationFrame(window.__AGY_AV_RAF__);
        window.__AGY_AV_RAF__ = 0;
      }
      renderAvatarVfxFrame(now, false);

      return true;
    };

    const startEyeLoop = () => {
      if (window.__AGY_EYE_RAF__ || document.hidden || getAvatarVfxState().perfMode === 'lite') return;
      const renderLoop = () => {
        if (document.hidden || !renderOnce()) {
          window.__AGY_EYE_RAF__ = 0;
          return;
        }
        window.__AGY_EYE_RAF__ = requestAnimationFrame(renderLoop);
      };
      window.__AGY_EYE_RAF__ = requestAnimationFrame(renderLoop);
    };

    est.renderOnce = renderOnce;
    est.startEyeLoop = startEyeLoop;
    renderOnce();
    startEyeLoop();
  }

  function applyTheme(overrides = {}) {
    const st = { ...getState(), ...overrides };
    try {
      localStorage.setItem(STORAGE_THEME, st.themeName);
      localStorage.setItem(STORAGE_BUBBLE, st.bubbleName);
      localStorage.setItem(STORAGE_INPUT, st.inputStyle);
      localStorage.setItem(STORAGE_DIMMING, String(st.dimming));
      localStorage.setItem(STORAGE_WP_ENABLED, String(st.wpEnabled));
      localStorage.setItem(STORAGE_PERF_MODE, st.performanceMode);
      if (overrides.customWp !== undefined) {
        localStorage.setItem(STORAGE_CUSTOM_WP, overrides.customWp);
      }
      if (overrides.userAvatar !== undefined) {
        localStorage.setItem(STORAGE_USER_AVATAR, overrides.userAvatar);
      }
      if (overrides.agentAvatar !== undefined) {
        localStorage.setItem(STORAGE_AGENT_AVATAR, overrides.agentAvatar);
      }
      if (overrides.glassBlur !== undefined) {
        localStorage.setItem(STORAGE_GLASS_BLUR, String(overrides.glassBlur));
      }
      if (overrides.avatarSize !== undefined) {
        localStorage.setItem(STORAGE_AVATAR_SIZE, String(overrides.avatarSize));
      }
      if (overrides.avatarRadius !== undefined) {
        localStorage.setItem(STORAGE_AVATAR_RADIUS, String(overrides.avatarRadius));
      }
      if (overrides.inputOpacity !== undefined) {
        if (overrides.inputOpacity === null) localStorage.removeItem(STORAGE_INPUT_OPACITY);
        else localStorage.setItem(STORAGE_INPUT_OPACITY, String(overrides.inputOpacity));
      }
      if (overrides.userBubbleOpacity !== undefined) {
        if (overrides.userBubbleOpacity === null) localStorage.removeItem(STORAGE_USER_BUBBLE_OPACITY);
        else localStorage.setItem(STORAGE_USER_BUBBLE_OPACITY, String(overrides.userBubbleOpacity));
      }
      if (overrides.aiBubbleOpacity !== undefined) {
        if (overrides.aiBubbleOpacity === null) localStorage.removeItem(STORAGE_AI_BUBBLE_OPACITY);
        else localStorage.setItem(STORAGE_AI_BUBBLE_OPACITY, String(overrides.aiBubbleOpacity));
      }
    } catch (e) {}

    if (window.agySaveThemeConfig) {
      try {
        window.agySaveThemeConfig(JSON.stringify(st));
      } catch (e) {}
    }

    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const bubbleTheme = THEMES[st.bubbleName] || mainTheme;
    const isLite = st.performanceMode === 'lite';
    const willUseVideo = Boolean(!isLite && st.wpEnabled && !st.customWp && mainTheme.videoWallpaper);
    const rawWp = st.customWp || ((isLite || willUseVideo) ? (mainTheme.liteWallpaper || mainTheme.wallpaper) : mainTheme.wallpaper) || '';
    const wpUrl = resolveAssetUrl(rawWp);

    const astSync = getAvatarVfxState();
    const prevPerf = astSync.perfMode;
    const prevDpr = astSync.dpr;
    astSync.perfMode = st.performanceMode;
    astSync.dpr = getEffectiveDpr(st.performanceMode);
    astSync.hasComposerKatana = Boolean(mainTheme && (mainTheme.avatarVfx === 'eclipse_katana' || mainTheme.eyeTracking) && st.wpEnabled && st.inputStyle !== 'minimal');
    if (prevPerf !== astSync.perfMode || prevDpr !== astSync.dpr) {
      document.querySelectorAll('.agy-avatar-vfx-canvas, .agy-ui-vfx-canvas, #agy-katana-tr-canvas, #agy-katana-bl-canvas').forEach(el => {
        delete el.dataset.drawnOnce;
      });
    }

    const oldLegacy = document.getElementById('antigravity-ho-ly-chibi-theme');
    if (oldLegacy) oldLegacy.remove();

    let styleEl = document.getElementById('antigravity-custom-theme-active');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'antigravity-custom-theme-active';
      document.head.appendChild(styleEl);
    }

    const overlayAlpha = mainTheme.clearBackdrop
      ? Math.min(0.92, Math.max(0.0, ((st.dimming - 10) / 82) * 0.85))
      : Math.min(0.92, Math.max(0.12, (st.dimming / 100) * 0.78));
    const overlayRgb = mainTheme.overlayRgb || '10, 7, 6';
    const bgPosition = mainTheme.bgPosition || 'center center';
    const secondaryGlowStop = mainTheme.secondaryGlow
      ? `, radial-gradient(circle at 22% 72%, ${mainTheme.secondaryGlow} 0%, transparent 55%)`
      : '';

    let bgLayers = '';
    if (wpUrl) {
      bgLayers = mainTheme.clearBackdrop
        ? `linear-gradient(180deg, rgba(${overlayRgb}, ${overlayAlpha}) 0%, rgba(${overlayRgb}, ${overlayAlpha}) 100%), url("${wpUrl}")`
        : `radial-gradient(circle at 75% 40%, ${mainTheme.glow} 0%, transparent 65%)${secondaryGlowStop}, linear-gradient(180deg, rgba(${overlayRgb}, ${overlayAlpha * 0.85}) 0%, rgba(${overlayRgb}, ${overlayAlpha}) 100%), url("${wpUrl}")`;
    } else {
      bgLayers = mainTheme.pureBg || `radial-gradient(circle at 75% 30%, ${mainTheme.glow} 0%, transparent 60%), linear-gradient(160deg, rgba(${overlayRgb}, 0.96) 0%, #070910 100%)`;
    }

    const wpCss = st.wpEnabled ? `
      .agy-shell {
        background-image: ${bgLayers} !important;
        background-size: cover !important;
        background-position: ${bgPosition} !important;
        background-repeat: no-repeat !important;
        image-rendering: auto !important;
      }
      .agy-shell[data-agy-video-ready="1"] {
        background-image: linear-gradient(180deg, #06070a 0%, #06070a 100%) !important;
      }
      .agy-sheet,
      .agy-inset-shell,
      .browser-hole-opaque,
      [data-main-content-body="true"],
      [data-side-panel-body="true"],
      [class*="agy-inset-shell"],
      [class*="--shell-canvas"],
      .agy-shell div.absolute.bottom-0.pointer-events-none,
      .agy-shell [class*="z-50"] .pointer-events-none.right-full,
      .agy-shell .bg-background:not(.settings-modal-container):not(.settings-modal-container *):not(#agy-custom-theme-modal-backdrop *) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      /* Browser split-pane hole cutout: keep wallpaper & L-glass visible outside [data-browser-hole] without covering live BrowserView */
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"]::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-image: ${bgLayers};
        background-size: cover;
        background-position: ${bgPosition};
        background-repeat: no-repeat;
        clip-path: var(--agy-hole-clip, none);
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] > :not([data-has-browser-hole="true"]):not([data-browser-hole]:not([data-browser-hole="false"])):not(.settings-modal-container),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] .browser-hole-opaque:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-pane-id]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-tiling-pane]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-main-content-header]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-side-panel-strip]:not([data-has-browser-hole="true"]) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] :is([data-main-content-body], [data-side-panel-body]):not([data-has-browser-hole="true"]) {
        box-shadow: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-split-sash] {
        background: rgba(56, 189, 248, 0.14) !important;
        background-image: none !important;
      }
      #agy-custom-theme-video-layer {
        position: absolute !important;
        inset: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 0 !important;
        pointer-events: none !important;
        overflow: hidden !important;
      }
      #agy-custom-theme-video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        display: block !important;
      }
      #agy-custom-theme-eye-canvas {
        position: absolute !important;
        pointer-events: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] #agy-custom-theme-video-layer {
        clip-path: var(--agy-hole-clip, none) !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"]:has(#agy-custom-theme-video-layer)::after {
        display: none !important;
      }
    ` : `
      .agy-shell {
        background: #111113 !important;
      }
    `;

    syncVideoWallpaper(st, mainTheme, overlayRgb, overlayAlpha, bgPosition);

    const defaultCornerSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M2 20 L2 6 Q2 2 6 2 L20 2' stroke='%23fbbf24' stroke-width='1.5' fill='none' opacity='0.65'/%3E%3Ccircle cx='6' cy='6' r='2' fill='%23fbbf24' opacity='0.75'/%3E%3C/svg%3E";
    const cornerFiligreeUrl = bubbleTheme.cornerSvg || defaultCornerSvg;

    const bubbleStickerCss = bubbleTheme.sticker ? (bubbleTheme.isOrnament ? `
      .group\\/user-input-step {
        padding-top: 18px !important;
      }
      .agy-user-bubble-frame::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: ${bubbleTheme.stickerRight}px;
        width: ${bubbleTheme.stickerW}px;
        height: ${bubbleTheme.stickerH}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 25;
        pointer-events: none;
        transition: transform 0.2s ease;
      }
    ` : `
      .group\\/user-input-step {
        padding-top: ${Math.max(36, Math.abs(bubbleTheme.stickerTop) + 8)}px !important;
      }
      .agy-user-bubble-frame::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: ${bubbleTheme.stickerRight}px;
        width: ${bubbleTheme.stickerW}px;
        height: ${bubbleTheme.stickerH}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        z-index: 25;
        pointer-events: none;
        transition: transform 0.2s ease;
      }
    `) : `
      .agy-user-bubble-frame::before { display: none !important; }
    `;

    const showInputSticker = st.inputStyle !== 'minimal' && bubbleTheme.sticker;
    const compStickerTop = bubbleTheme.composerStickerTop !== undefined ? bubbleTheme.composerStickerTop : bubbleTheme.stickerTop;
    const compStickerRight = bubbleTheme.composerStickerRight !== undefined ? bubbleTheme.composerStickerRight : 16;
    const compStickerW = bubbleTheme.composerStickerW || (bubbleTheme.stickerW + 8);
    const compStickerH = bubbleTheme.composerStickerH || (bubbleTheme.stickerH + 2);
    const compCornerUrl = bubbleTheme.composerCornerSvg || cornerFiligreeUrl;
    const compCornerBottom = bubbleTheme.composerCornerBottom !== undefined ? bubbleTheme.composerCornerBottom : 3;
    const compCornerLeft = bubbleTheme.composerCornerLeft !== undefined ? bubbleTheme.composerCornerLeft : 4;
    const compCornerW = bubbleTheme.composerCornerW || 16;
    const compCornerH = bubbleTheme.composerCornerH || 16;
    const compCornerTransform = bubbleTheme.composerCornerTransform || 'rotate(180deg)';
    const compCornerOpacity = bubbleTheme.composerCornerOpacity !== undefined ? bubbleTheme.composerCornerOpacity : 0.78;
    const inputStickerCss = showInputSticker ? (bubbleTheme.isOrnament ? `
      .surface-composer {
        margin-top: 16px !important;
        overflow: visible !important;
      }
      .surface-composer::before {
        content: "";
        position: absolute;
        top: ${compStickerTop}px;
        right: ${compStickerRight}px;
        width: ${compStickerW}px;
        height: ${compStickerH}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 30;
        pointer-events: none;
      }
      .surface-composer::after {
        content: "";
        position: absolute;
        bottom: ${compCornerBottom}px;
        left: ${compCornerLeft}px;
        width: ${compCornerW}px;
        height: ${compCornerH}px;
        background-image: url("${compCornerUrl}");
        background-size: contain;
        background-repeat: no-repeat;
        transform: ${compCornerTransform};
        z-index: 30;
        pointer-events: none;
        opacity: ${compCornerOpacity};
      }
    ` : `
      .surface-composer {
        margin-top: 28px !important;
        overflow: visible !important;
      }
      .surface-composer::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop - 4}px;
        right: 16px;
        width: ${bubbleTheme.stickerW + 6}px;
        height: ${bubbleTheme.stickerH + 6}px;
        background-image: url("${bubbleTheme.sticker}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        z-index: 30;
        pointer-events: none;
      }
      .surface-composer::after { display: none !important; }
    `) : `
      .surface-composer::before,
      .surface-composer::after { display: none !important; }
    `;

    const rawInputCardBg = getRawInputCardBg(bubbleTheme, st.inputStyle);
    const inputCardBg = scaleCssBgAlpha(rawInputCardBg, st.inputOpacity);
    const effInputOp = st.inputOpacity !== null ? st.inputOpacity : getMeanCssAlphaPct(rawInputCardBg, 56);
    const userBubbleBg = scaleCssBgAlpha(bubbleTheme.bg, st.userBubbleOpacity);
    const effUserOp = st.userBubbleOpacity !== null ? st.userBubbleOpacity : getMeanCssAlphaPct(bubbleTheme.bg, 68);
    const aiCardBgEffective = mainTheme.aiCardBg ? scaleCssBgAlpha(mainTheme.aiCardBg, st.aiBubbleOpacity) : '';
    const effAiOp = st.aiBubbleOpacity !== null ? st.aiBubbleOpacity : getMeanCssAlphaPct(mainTheme.aiCardBg, 76);

    const inputOuterBorder =
      st.inputStyle === 'double_gold'
        ? 'linear-gradient(135deg, #f59e0b 0%, rgba(217, 119, 6, 0.35) 50%, #fbbf24 100%)'
        : bubbleTheme.frameBg;

    const sidebarBg = mainTheme.sidebarBg || 'rgba(14, 10, 8, 0.68)';
    const sidebarHoverBg = mainTheme.sidebarHoverBg || 'rgba(255, 255, 255, 0.08)';
    const btnBg = mainTheme.btnBg || 'rgba(48, 30, 22, 0.62)';
    const modalBg = mainTheme.modalBg || 'rgba(14, 12, 12, 0.96)';
    const innerBubbleBorder = bubbleTheme.isScroll
      ? '2px solid #78350f'
      : (bubbleTheme.innerBorder || '1px solid rgba(255, 255, 255, 0.06)');

    const isLight = Boolean(mainTheme.isLight);
    const uiInk = mainTheme.uiTextColor || (isLight ? '#0f172a' : 'rgba(248, 250, 252, 0.96)');
    const uiMutedInk = mainTheme.uiMutedColor || (isLight ? '#334155' : 'rgba(241, 245, 249, 0.92)');
    const uiShadow = isLight ? 'none' : '0 1px 4px rgba(0, 0, 0, 0.92), 0 0 8px rgba(0, 0, 0, 0.68)';
    const pillBg = mainTheme.pillBg || (isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(6, 11, 24, 0.78)');
    const pillHoverBg = mainTheme.pillHoverBg || (isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(10, 18, 38, 0.92)');
    const pillText = mainTheme.pillTextColor || (isLight ? '#0f172a' : '#f8fafc');
    const pillBorder = mainTheme.pillBorder || (isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.16)');
    const preCodeBg = isLight ? `rgba(${overlayRgb}, 0.72)` : `rgba(${overlayRgb}, 0.56)`;

    const effectiveUserAvatar = resolveAssetUrl(st.userAvatar === 'none' ? '' : (st.userAvatar || mainTheme.userAvatar || ''));
    const effectiveAgentAvatar = resolveAssetUrl(st.agentAvatar === 'none' ? '' : (st.agentAvatar || mainTheme.agentAvatar || ''));
    const avSize = Math.min(52, Math.max(22, Number(st.avatarSize) || 32));
    const avAgentSize = Math.max(22, avSize - 2);
    const avRadius = Math.min(50, Math.max(0, Number.isFinite(Number(st.avatarRadius)) ? Number(st.avatarRadius) : 50));
    const useAvatarVfx = Boolean(mainTheme.avatarVfx === 'eclipse_katana');

    const avatarCss = `
      ${effectiveUserAvatar ? `
      .agy-shell [data-testid="user-message"] {
        position: relative !important;
        padding-right: ${avSize + (useAvatarVfx ? 20 : 10)}px !important;
      }
      .agy-shell [data-testid="user-message"]::after {
        content: "";
        position: absolute;
        right: ${useAvatarVfx ? '4px' : '0'};
        bottom: 6px;
        width: ${avSize}px;
        height: ${avSize}px;
        border-radius: ${avRadius}%;
        background-image: url("${effectiveUserAvatar}");
        background-size: cover;
        background-position: center;
        border: 1.5px solid ${mainTheme.primary};
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${mainTheme.glow};
        pointer-events: none;
      }
      .agy-shell [data-testid="user-message"]:has(> .agy-avatar-vfx-canvas)::after {
        display: none !important;
      }
      ` : ''}
      ${effectiveAgentAvatar ? `
      .agy-shell [data-testid="agent-response"] {
        position: relative !important;
        padding-left: ${avAgentSize + (useAvatarVfx ? 28 : 22)}px !important;
        min-height: ${avAgentSize + 20}px !important;
      }
      .agy-shell [data-testid="agent-response"]:has(> .agy-avatar-vfx-canvas),
      .agy-shell [data-testid="agent-response"]:has(> .agy-ui-vfx-canvas),
      .agy-shell [data-testid="user-message"]:has(> .agy-ui-vfx-canvas),
      .agy-shell .agy-user-bubble-frame:has(> .agy-ui-vfx-canvas) {
        overflow: visible !important;
      }
      .agy-shell [data-agy-vfx-sb-host="1"] {
        position: relative !important;
        overflow: visible !important;
      }
      .agy-shell [data-testid="agent-response"]::before {
        content: "";
        position: absolute;
        top: 12px;
        left: 12px;
        width: ${avAgentSize}px;
        height: ${avAgentSize}px;
        border-radius: ${avRadius}%;
        background-image: url("${effectiveAgentAvatar}");
        background-size: cover;
        background-position: center;
        border: 1.5px solid ${mainTheme.secondary || mainTheme.primary};
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${mainTheme.secondaryGlow || mainTheme.glow};
        pointer-events: none;
      }
      .agy-shell [data-testid="agent-response"]:has(> .agy-avatar-vfx-canvas)::before {
        display: none !important;
      }
      ` : ''}
    `;

    const sidebarEnhanceCss = (mainTheme.sidebarEnhanceText || isLight) ? `
      .agy-shell .bg-sidebar a,
      .agy-shell .bg-sidebar span,
      .agy-shell .bg-sidebar button {
        color: ${isLight ? uiInk : 'inherit'};
        text-shadow: ${isLight ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.88)'};
      }
      .agy-shell .bg-sidebar .text-muted-foreground,
      .agy-shell .bg-sidebar .text-secondary-foreground {
        color: ${uiMutedInk} !important;
      }
    ` : '';

    const aiCardCss = mainTheme.aiCardBg ? `
      /* Translucent reading card for AI responses (zero live backdrop-filter for max 120fps scroll) */
      .agy-shell [data-testid="agent-response"] {
        background: ${aiCardBgEffective} !important;
        ${isLight ? `color: ${uiInk} !important;` : ''}
        ${!isLight && effAiOp < 45 ? 'text-shadow: 0 1px 3px rgba(0, 0, 0, 0.88);' : ''}
        backdrop-filter: none !important;
        border: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)')} !important;
        border-radius: 14px !important;
        padding: 12px 16px !important;
        box-shadow: ${effAiOp <= 5 ? 'none' : (isLight ? '0 4px 14px rgba(15, 23, 42, 0.08)' : '0 4px 14px rgba(0, 0, 0, 0.28)')} !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-bleed,
      .agy-shell [data-testid="agent-response"] .md-table-host {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        margin-inline: 0 !important;
        left: auto !important;
        right: auto !important;
        transform: none !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll,
      .agy-shell [data-testid="agent-response"] :has(> table):not(.md-table-frame) {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 2px !important;
        box-sizing: border-box !important;
        /* Keep standard scrollbar-width: auto so Chromium does not disable ::-webkit-scrollbar */
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-frame {
        /* .md-table-frame sits INSIDE .md-table-scroll; forcing width:100% + overflow:hidden hid overflow from .md-table-scroll */
        width: fit-content !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        transform: none !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll::-webkit-scrollbar,
      .agy-shell [data-testid="agent-response"] :has(> table):not(.md-table-frame)::-webkit-scrollbar {
        height: 8px !important;
        display: block !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll::-webkit-scrollbar-track,
      .agy-shell [data-testid="agent-response"] :has(> table):not(.md-table-frame)::-webkit-scrollbar-track {
        background: ${isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)'} !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll::-webkit-scrollbar-thumb,
      .agy-shell [data-testid="agent-response"] :has(> table):not(.md-table-frame)::-webkit-scrollbar-thumb {
        background: ${isLight ? 'rgba(15, 23, 42, 0.34)' : 'rgba(148, 163, 184, 0.48)'} !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll::-webkit-scrollbar-thumb:hover,
      .agy-shell [data-testid="agent-response"] :has(> table):not(.md-table-frame)::-webkit-scrollbar-thumb:hover {
        background: ${isLight ? 'rgba(15, 23, 42, 0.54)' : 'rgba(148, 163, 184, 0.72)'} !important;
      }
      .agy-shell [data-testid="agent-response"] table {
        width: 100% !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        table-layout: auto !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] :is(th, td) {
        max-width: none !important;
        white-space: normal !important;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        padding: 8px 12px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(td, th) .inline-pill-wrap {
        min-width: 0 !important;
      }
      ${isLight ? `
      .agy-shell [data-main-content-body="true"],
      .agy-shell [data-testid="agent-response"] :is(p, li, span, code, h1, h2, h3, h4, strong, td, th) {
        color: ${uiInk};
      }
      ` : ''}
      .agy-shell [data-main-content-body="true"] h1,
      .agy-shell [data-main-content-body="true"] h2 {
        text-shadow: ${isLight ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.85)'};
      }
    ` : '';

    const useUnifiedGlass = Boolean(st.wpEnabled && wpUrl && mainTheme.unifiedGlass);
    if (useUnifiedGlass && typeof syncShellMetrics === 'function') {
      syncShellMetrics();
    }
    if (useUnifiedGlass) {
      const effectiveBlur = Number.isFinite(st.glassBlur) ? `${st.glassBlur}px` : (mainTheme.headerBlur || '3px');
      syncPrebakedGlass(wpUrl, overlayRgb, overlayAlpha, mainTheme.headerBg || '', effectiveBlur);
    } else {
      syncPrebakedGlass(null);
    }

    const sidePanelBgColor = mainTheme.aiCardBg || `rgba(${overlayRgb}, 0.72)`;
    const sidePanelCss = st.wpEnabled ? `
      /* Frosted pre-baked glass + dark/light reading scrim for right-side Artifact / Text / Diff split panels */
      body:not([data-has-browser-hole="true"]) .agy-shell [data-side-panel-body="true"]:not([data-has-browser-hole="true"]):not(:has([data-browser-hole]:not([data-browser-hole="false"]))) {
        background-color: ${sidePanelBgColor} !important;
        ${useUnifiedGlass ? `
        background-image: linear-gradient(180deg, ${sidePanelBgColor}, ${sidePanelBgColor}), var(--agy-l-glass-bg, none) !important;
        background-size: 100% 100%, var(--agy-glass-w, 100vw) var(--agy-glass-h, 100vh) !important;
        background-position: 0 0, calc(var(--agy-glass-x, 0px) - var(--agy-side-l, 0px)) calc(var(--agy-glass-y, 0px) - var(--agy-side-t, 0px)) !important;
        background-repeat: no-repeat !important;
        ` : ''}
        ${isLight ? `color: ${uiInk} !important;` : ''}
        backdrop-filter: none !important;
        border-left: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)')} !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      }
      body:not([data-has-browser-hole="true"]) .agy-shell [data-side-panel-body="true"]:not([data-has-browser-hole="true"]):not(:has([data-browser-hole]:not([data-browser-hole="false"]))) pre {
        background: ${preCodeBg} !important;
        border: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)')} !important;
        border-radius: 10px !important;
      }
      .agy-shell [data-side-panel-body="true"] :is(h1, h2, h3, h4) {
        ${isLight ? `color: ${uiInk} !important;` : ''}
        text-shadow: ${isLight ? 'none' : '0 1px 6px rgba(0, 0, 0, 0.85)'};
      }
    ` : '';

    const headerCss = mainTheme.headerBg ? `
      /* Frosted top titlebar & seamless L-shaped unified glass (zero live backdrop-filter) */
      ${useUnifiedGlass ? `
      .agy-shell {
        position: relative !important;
      }
      .agy-shell > div:first-of-type {
        position: relative !important;
        z-index: 3 !important;
      }
      .agy-shell > div:not(:first-of-type) {
        position: relative !important;
        z-index: 2 !important;
      }
      .agy-shell::before {
        content: "";
        position: absolute;
        top: var(--agy-hdr-h, 75px);
        left: 0;
        width: var(--agy-sidebar-w, 256px);
        bottom: 0;
        z-index: 1;
        pointer-events: none;
        background-color: ${mainTheme.headerBg};
        background-image: var(--agy-l-glass-bg, none);
        background-size: var(--agy-glass-w, 100vw) var(--agy-glass-h, 100vh);
        background-position: var(--agy-glass-x, 0px) calc(var(--agy-glass-y, 0px) - var(--agy-hdr-h, 75px));
        background-repeat: no-repeat;
        backdrop-filter: none !important;
      }
      .agy-shell:not([data-agy-hole-active="1"])::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: var(--agy-hdr-h, 75px);
        z-index: 1;
        pointer-events: none;
        background-color: ${mainTheme.headerBg};
        background-image: var(--agy-l-glass-bg, none);
        background-size: var(--agy-glass-w, 100vw) var(--agy-glass-h, 100vh);
        background-position: var(--agy-glass-x, 0px) var(--agy-glass-y, 0px);
        background-repeat: no-repeat;
        backdrop-filter: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] > div:first-of-type {
        background-color: ${mainTheme.headerBg} !important;
        background-image: var(--agy-l-glass-bg, none) !important;
        background-size: var(--agy-glass-w, 100vw) var(--agy-glass-h, 100vh) !important;
        background-position: var(--agy-glass-x, 0px) var(--agy-glass-y, 0px) !important;
        background-repeat: no-repeat !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [class*="@container/titlebar"] {
        background-color: ${mainTheme.headerBg} !important;
        background-image: var(--agy-l-glass-bg, none) !important;
        background-size: var(--agy-glass-w, 100vw) var(--agy-glass-h, 100vh) !important;
        background-position: calc(var(--agy-glass-x, 0px) - var(--agy-sidebar-w, 256px)) calc(var(--agy-glass-y, 0px) - 35px) !important;
        background-repeat: no-repeat !important;
      }
      .agy-shell [class*="@container/titlebar"] {
        background: transparent !important;
        backdrop-filter: none !important;
        border-bottom: 1px solid ${mainTheme.headerBorder || 'rgba(56, 189, 248, 0.10)'} !important;
      }
      ` : `
      .agy-shell [class*="@container/titlebar"] {
        background: ${mainTheme.headerBg} !important;
        backdrop-filter: none !important;
        border-bottom: 1px solid ${mainTheme.headerBorder || 'rgba(56, 189, 248, 0.15)'} !important;
      }
      `}
      .agy-shell [class*="@container/titlebar"] [data-testid="breadcrumb-segment"],
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] button,
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] span {
        color: ${uiInk} !important;
        text-shadow: ${uiShadow};
      }
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] button.border {
        background: ${isLight ? 'rgba(255, 255, 255, 0.56)' : 'rgba(6, 11, 24, 0.36)'} !important;
        border-color: ${pillBorder} !important;
      }
    ` : '';

    const sidebarOuterCss = useUnifiedGlass ? `
      .agy-shell aside,
      .agy-shell [data-sidebar="true"],
      .agy-shell .bg-sidebar {
        background: transparent !important;
        backdrop-filter: none !important;
      }
    ` : `
      .agy-shell aside,
      .agy-shell [data-sidebar="true"],
      .agy-shell .bg-sidebar {
        background: ${sidebarBg} !important;
        backdrop-filter: none !important;
      }
    `;

    styleEl.textContent = `
      ${wpCss}

      /* Translucent themed sidebar (unified via ::before when unifiedGlass is active) */
      ${sidebarOuterCss}
      .agy-shell .bg-sidebar .bg-sidebar,
      .agy-shell [data-sidebar="true"] .bg-sidebar,
      .agy-shell .bg-sidebar [class*="group/headerbtn"],
      .agy-shell .bg-sidebar [class*="group/section-header"] {
        background: transparent !important;
        backdrop-filter: none !important;
      }
      /* Preserve virtual list positioning; hide sticky headers only while scrolled */
      .agy-shell .bg-sidebar .agy-scrolled > .w-full.relative > .bg-sidebar[style*="position: sticky"] {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.14s ease !important;
      }
      .agy-shell .bg-sidebar [class*="group/headerbtn"]:hover,
      .agy-shell .bg-sidebar a:hover {
        background: ${sidebarHoverBg} !important;
      }
      ${(mainTheme.uiVfxSuite && mainTheme.uiVfxSuite.sidebar === '2F') ? `
      /* iPhone / iOS GPU-Composited Sidebar Tab Sliding Pill & 2F Frame (Zero Live Blur) */
      .agy-shell #agy-ios-sidebar-pill {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        z-index: 0 !important;
        pointer-events: none !important;
        border-radius: 9px !important;
        background: linear-gradient(180deg, rgba(38, 42, 54, 0.88) 0%, rgba(20, 23, 32, 0.93) 100%) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 4px 14px rgba(0, 0, 0, 0.42) !important;
        transition: transform 0.32s cubic-bezier(0.20, 0.96, 0.28, 1.0), opacity 0.18s ease !important;
        will-change: transform !important;
      }
      .agy-shell #agy-vfx-2f-sidebar {
        position: absolute !important;
        left: -6px !important;
        top: -7px !important;
        z-index: 6 !important;
        pointer-events: none !important;
        transition: transform 0.32s cubic-bezier(0.20, 0.96, 0.28, 1.0), opacity 0.18s ease !important;
        will-change: transform !important;
      }
      .agy-shell .agy-sidebar-row {
        position: relative !important;
        z-index: 2 !important;
        transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), color 0.18s ease !important;
      }
      .agy-shell .agy-sidebar-row.bg-sidebar-secondary,
      .agy-shell .agy-sidebar-row[data-agy-vfx-sb-host="1"],
      .agy-shell .agy-sidebar-row[data-agy-vfx-sb-host="1"]:hover,
      .agy-shell .agy-sidebar-row[data-agy-vfx-sb-host="1"] a:hover {
        background: transparent !important;
        background-color: transparent !important;
        --row-bg: transparent !important;
      }
      .agy-shell .agy-sidebar-row[data-agy-ios-pressed="1"],
      .agy-shell .agy-sidebar-row:active {
        transform: scale(0.968) !important;
        transition: transform 0.08s cubic-bezier(0.32, 0.72, 0, 1) !important;
      }
      .agy-shell .agy-sidebar-row:not([data-agy-vfx-sb-host="1"]):hover {
        transform: translateX(2.5px);
      }
      .agy-shell .agy-sidebar-row[data-agy-vfx-sb-host="1"] span,
      .agy-shell .agy-sidebar-row[data-agy-vfx-sb-host="1"] div {
        color: #ffffff !important;
        text-shadow: 0 0 10px rgba(248, 250, 255, 0.35), 0 1px 3px rgba(0, 0, 0, 0.9) !important;
      }
      ` : ''}
      ${sidebarEnhanceCss}
      ${aiCardCss}
      ${sidePanelCss}
      ${avatarCss}
      ${headerCss}

      /* "+ New Conversation" button glow */
      .agy-button-custom.border.border-border {
        background: ${btnBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
      }

      /* User Chat Bubble Double-Border Frame & Ornament */
      .agy-user-bubble-frame {
        background: ${bubbleTheme.frameBg} !important;
        border-radius: ${bubbleTheme.isScroll ? '6px' : '14px'} !important;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45), 0 0 12px ${bubbleTheme.glow} !important;
        position: relative !important;
        overflow: visible !important;
        padding: 1.2px !important;
      }

      .agy-user-bubble-frame::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: ${bubbleTheme.isOrnament ? '16px' : '14px'};
        height: ${bubbleTheme.isOrnament ? '16px' : '14px'};
        background-image: url("${cornerFiligreeUrl}");
        background-size: contain;
        background-repeat: no-repeat;
        pointer-events: none;
        opacity: ${bubbleTheme.isOrnament ? '0.85' : '0.65'};
      }

      .agy-user-bubble {
        background: ${userBubbleBg} !important;
        border-radius: ${bubbleTheme.isScroll ? '5px' : '13px'} !important;
        padding: 8px 16px !important;
        color: ${bubbleTheme.textColor} !important;
        border: ${innerBubbleBorder} !important;
        overflow: visible !important;
        font-weight: 450 !important;
        ${!isLight && effUserOp < 45 ? 'text-shadow: 0 1px 3px rgba(0, 0, 0, 0.88) !important;' : ''}
      }

      .agy-user-bubble * {
        color: ${bubbleTheme.textColor} !important;
      }
      ${(mainTheme.uiVfxSuite && mainTheme.uiVfxSuite.bubble === '1B') ? `
      .agy-user-bubble-frame::before,
      .agy-user-bubble-frame::after {
        display: none !important;
      }
      .agy-user-bubble-frame {
        background: transparent !important;
        border: 1.2px solid ${bubbleTheme.borderColor || 'rgba(248, 250, 252, 0.52)'} !important;
        padding: 0 !important;
        backdrop-filter: none !important;
      }
      .agy-user-bubble {
        background: ${userBubbleBg} !important;
        backdrop-filter: none !important;
        border: 1px solid rgba(248, 250, 252, 0.16) !important;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.88) !important;
      }
      ` : ''}

      /* Translucent Double-Border Input Composer */
      .surface-composer {
        background: transparent !important;
        border: 1.5px solid ${mainTheme.borderColor || 'rgba(248, 250, 252, 0.45)'} !important;
        border-radius: 16px !important;
        padding: 0 !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5), 0 0 14px ${bubbleTheme.glow} !important;
        position: relative !important;
      }
      .surface-composer:has(#agy-katana-tr-canvas)::before,
      .surface-composer:has(#agy-katana-bl-canvas)::after {
        display: none !important;
      }

      .surface-composer-card {
        background: ${inputCardBg} !important;
        ${!isLight && effInputOp < 35 ? 'text-shadow: 0 1px 3px rgba(0, 0, 0, 0.88);' : ''}
        backdrop-filter: none !important;
        border-radius: 14.5px !important;
        border: ${bubbleTheme.innerBorder || '1px solid rgba(255, 255, 255, 0.07)'} !important;
      }

      /* High-contrast pill badges for top composer bar (adaptive light/dark theme) */
      .surface-composer [data-testid="project-selector-trigger"],
      .surface-composer [data-testid="branch-pill-trigger"],
      .surface-composer [aria-label="Select Environment"],
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"] {
        background: ${pillBg} !important;
        color: ${pillText} !important;
        border: 1px solid ${pillBorder} !important;
        border-radius: 9999px !important;
        font-weight: 500 !important;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25) !important;
        margin: 1px 2px !important;
        transition: background-color 0.15s ease, border-color 0.15s ease !important;
      }
      .surface-composer [data-testid="branch-pill-trigger"],
      .surface-composer [aria-label="Select Environment"],
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button:not([data-testid="project-selector-trigger"]),
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"]:not([data-testid="project-selector-trigger"]) {
        padding-left: 8px !important;
        padding-right: 7px !important;
        gap: 4px !important;
      }
      .surface-composer [data-testid="project-selector-trigger"]:hover,
      .surface-composer [data-testid="branch-pill-trigger"]:hover,
      .surface-composer [aria-label="Select Environment"]:hover,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button:hover,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"]:hover {
        background: ${pillHoverBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        color: ${pillText} !important;
      }
      .surface-composer [data-testid="project-selector-trigger"] *,
      .surface-composer [data-testid="branch-pill-trigger"] *,
      .surface-composer [aria-label="Select Environment"] *,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button *,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"] * {
        color: ${pillText} !important;
      }
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] .ml-auto > * {
        background: ${pillBg} !important;
        color: ${pillText} !important;
        border-radius: 9999px !important;
        padding: 2px 8px !important;
      }

      ${bubbleStickerCss}
      ${inputStickerCss}

      @media (max-width: 640px) {
        .agy-user-bubble-frame::before,
        .surface-composer::before {
          transform: scale(0.78);
          transform-origin: bottom right;
        }
      }

      .settings-modal-container {
        background: ${modalBg} !important;
        border: 1px solid ${mainTheme.borderColor} !important;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.75), 0 0 24px ${mainTheme.glow} !important;
        backdrop-filter: none !important;
      }

      #agy-custom-theme-modal-dialog {
        background: ${modalBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px ${mainTheme.glow} !important;
      }
      #agy-custom-theme-modal-header {
        background: ${mainTheme.modalHeaderBg || 'rgba(22, 16, 14, 0.85)'} !important;
      }
      #agy-custom-theme-badge {
        color: ${mainTheme.primary} !important;
        border-color: ${mainTheme.borderColor} !important;
        background: ${mainTheme.glow} !important;
      }
      #agy-custom-theme-sidebar-btn svg {
        color: ${mainTheme.primary} !important;
      }
    `;

    syncAvatarVfxState(st, mainTheme, effectiveUserAvatar, effectiveAgentAvatar, avSize, avAgentSize);
    syncTitleBarOverlay(st);
    scheduleTitleBarSync(st);
  }

  function syncTitleBarOverlay(stOverride) {
    const st = stOverride || getState();
    const activeTh = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      try {
        window.electronNative.setTitleBarOverlay({
          color: st.wpEnabled ? '#00000000' : '#111114',
          symbolColor: (st.wpEnabled && activeTh.isLight) ? '#0f172a' : '#f8fafc'
        });
      } catch (e) {}
    }
  }

  function clearTitleBarTimers() {
    if (Array.isArray(window.__AGY_TBO_TIMERS__)) {
      window.__AGY_TBO_TIMERS__.forEach(id => clearTimeout(id));
    }
    window.__AGY_TBO_TIMERS__ = [];
  }

  function scheduleTitleBarSync(stOverride) {
    clearTitleBarTimers();
    const st = stOverride || getState();
    syncTitleBarOverlay(st);
    [300, 900, 2000, 4000, 7000].forEach(ms => {
      window.__AGY_TBO_TIMERS__.push(setTimeout(() => syncTitleBarOverlay(), ms));
    });
  }

  function removeCustomTheme() {
    clearTitleBarTimers();
    stopEyeTrackingRig();
    stopAvatarVfxRig();
    if (window.__AGY_CHAT_SCROLL_TMR__) {
      clearTimeout(window.__AGY_CHAT_SCROLL_TMR__);
      window.__AGY_CHAT_SCROLL_TMR__ = 0;
    }
    if (window.__AGY_SCROLL_AC__) {
      try { window.__AGY_SCROLL_AC__.abort(); } catch (e) {}
    }
    const styleEl = document.getElementById('antigravity-custom-theme-active');
    if (styleEl) styleEl.remove();
    const navBtn = document.getElementById('agy-custom-theme-sidebar-btn');
    if (navBtn) navBtn.remove();
    const settingsBtn = document.getElementById('agy-custom-theme-settings-btn');
    if (settingsBtn) settingsBtn.remove();
    const modal = document.getElementById('agy-custom-theme-modal-backdrop');
    if (modal) modal.remove();
    const shell = document.querySelector('.agy-shell');
    releaseVideoLayer(shell);
    const staleCursorCanvas = document.getElementById('agy-custom-theme-cursor-canvas');
    if (staleCursorCanvas) staleCursorCanvas.remove();
    if (shell) {
      delete shell.dataset.agyHoleActive;
      shell.style.removeProperty('--agy-hole-clip');
      shell.style.removeProperty('--agy-l-glass-bg');
    }
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      try {
        window.electronNative.setTitleBarOverlay({ color: '#111114', symbolColor: '#f8fafc' });
      } catch (e) {}
    }
  }

  window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__ = applyTheme;
  window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ = removeCustomTheme;
  window.__ANTIGRAVITY_OPEN_THEME_MODAL__ = openCustomThemeModal;

  applyTheme();

  function openCustomThemeModal() {
    let backdrop = document.getElementById('agy-custom-theme-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'agy-custom-theme-modal-backdrop';
      backdrop.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(10px);
      `;

      backdrop.innerHTML = `
        <div id="agy-custom-theme-modal-dialog" style="background: rgba(16, 12, 11, 0.97); border: 1.2px solid rgba(212, 148, 106, 0.35); border-radius: 18px; width: 100%; max-width: 900px; height: 86vh; max-height: 860px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(224, 142, 85, 0.25); font-family: system-ui, -apple-system, sans-serif;">
          <div id="agy-custom-theme-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 26px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(22, 16, 14, 0.85);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 17px; font-weight: 600; color: #f4f4f5; letter-spacing: -0.2px;">Custom Theme Studio</span>
              <span id="agy-custom-theme-badge" style="font-size: 11.5px; padding: 2.5px 9px; border-radius: 9999px; background: rgba(224, 142, 85, 0.2); color: #e08e55; font-weight: 500; border: 1px solid rgba(224, 142, 85, 0.3);">${THEME_KEYS.length} Preset${THEME_KEYS.length > 1 ? 's' : ''}</span>
            </div>
            <button id="agy-theme-modal-close-btn" type="button" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: #d4d4d8; cursor: pointer; width: 30px; height: 30px; border-radius: 8px; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">✕</button>
          </div>
          <div id="agy-theme-modal-body" style="flex: 1; overflow-y: auto; height: 100%;"></div>
        </div>
      `;

      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.style.display = 'none';
      });
      backdrop.querySelector('#agy-theme-modal-close-btn').addEventListener('click', () => {
        backdrop.style.display = 'none';
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.style.display !== 'none') {
          backdrop.style.display = 'none';
        }
      });
    }

    backdrop.style.display = 'flex';
    const body = backdrop.querySelector('#agy-theme-modal-body');
    renderThemePanels(body);
  }

  function renderThemePanels(container) {
    const st = getState();
    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const bubbleTheme = THEMES[st.bubbleName] || mainTheme;
    const initInputOp = st.inputOpacity !== null ? st.inputOpacity : getMeanCssAlphaPct(getRawInputCardBg(bubbleTheme, st.inputStyle), 56);
    const initUserOp = st.userBubbleOpacity !== null ? st.userBubbleOpacity : getMeanCssAlphaPct(bubbleTheme.bg, 68);
    const initAiOp = st.aiBubbleOpacity !== null ? st.aiBubbleOpacity : getMeanCssAlphaPct(mainTheme.aiCardBg, 76);
    const effUserAv = resolveAssetUrl(st.userAvatar === 'none' ? '' : (st.userAvatar || mainTheme.userAvatar || ''));
    const effAgentAv = resolveAssetUrl(st.agentAvatar === 'none' ? '' : (st.agentAvatar || mainTheme.agentAvatar || ''));
    const perfModes = [
      {
        mode: 'ultra',
        title: 'Ultra (High-End PC)',
        desc: '60 FPS live video wallpaper, eye-tracking, boiling ink composer & 60 FPS canvas VFX.',
        extra: BUILD_PROFILE === 'lite'
          ? 'Lite package: enables 60 FPS canvas VFX on static 1080p wallpaper (install Ultra package for live video).'
          : ''
      },
      {
        mode: 'lite',
        title: 'Lite (Low-End PC)',
        desc: 'Crisp static 1080p backdrop, 1-shot static VFX, 0 idle rAF loops, smooth iOS tab glide (~10–30 MB).',
        extra: ''
      }
    ];

    container.innerHTML = `
      <div id="agy-theme-scroll-container" style="padding: 24px 32px 48px 32px; max-width: 860px; margin: 0 auto; overflow-y: auto; height: 100%; color: #f4f4f5;">
        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mainTheme.cardBg || 'rgba(22, 16, 14, 0.72)'}; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 14.5px; font-weight: 600; color: #f4f4f5; margin-bottom: 2px;">Performance Edition</div>
              <div style="font-size: 12.5px; color: #a1a1aa;">Switch instantly between High-End Full VFX and Low-End Eco Mode without restarting.</div>
            </div>
            <span id="agy-perf-badge" style="font-size: 11.5px; padding: 3px 10px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: ${mainTheme.primary}; font-weight: 600;">${st.performanceMode === 'lite' ? 'Lite • Eco RAM' : 'Ultra • 60 FPS Live'}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${perfModes.map(pm => {
              const isSel = pm.mode === st.performanceMode;
              return `
                <div class="agy-perf-card" data-mode="${pm.mode}" style="border-radius: 10px; border: ${isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: ${isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)'}; padding: 12px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div>
                    <div style="font-size: 13.5px; font-weight: 600; color: #f4f4f5; margin-bottom: 3px;">${pm.title}</div>
                    <div style="font-size: 11.5px; color: #a1a1aa; line-height: 1.4;">${pm.desc}</div>
                    ${pm.extra ? `<div style="font-size: 11px; color: #71717a; margin-top: 4px; line-height: 1.35;">${pm.extra}</div>` : ''}
                  </div>
                  <div class="agy-card-check-slot" style="flex-shrink: 0; margin-top: 2px;">${isSel ? CHECK_SVG : ''}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mainTheme.cardBg || 'rgba(22, 16, 14, 0.72)'}; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 14.5px; font-weight: 600; color: #f4f4f5; margin-bottom: 2px;">Wallpaper, Pre-Baked Blur & Config</div>
              <div style="font-size: 12.5px; color: #a1a1aa;">Balance artwork clarity, 120fps pre-baked frosted glass blur, or share config JSON.</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #d4d4d8; cursor: pointer;">
                <input id="agy-wp-toggle" type="checkbox" ${st.wpEnabled ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Backdrop
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa;">
                Dim
                <input id="agy-dim-slider" type="range" min="15" max="92" value="${st.dimming}" style="width: 96px; cursor: pointer; accent-color: #ffffff; height: 5px;" />
                <span id="agy-dim-val" style="min-width: 32px; text-align: right;">${st.dimming}%</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa;">
                Blur
                <input id="agy-blur-slider" type="range" min="0" max="16" value="${st.glassBlur}" style="width: 78px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
                <span id="agy-blur-val" style="min-width: 30px; text-align: right;">${st.glassBlur}px</span>
              </label>
              <label style="padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Custom Image
                <input id="agy-wp-upload" type="file" accept="image/*" style="display: none;" />
              </label>
              <button id="agy-export-btn" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Export JSON
              </button>
              <button id="agy-import-toggle" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Import JSON
              </button>
              <button id="agy-reset-btn" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Reset
              </button>
            </div>
          </div>
          <div id="agy-import-box" style="display: none; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
            <textarea id="agy-import-text" rows="3" placeholder='Paste exported theme config JSON here (e.g. {"themeName":"WLOP Cosmic","dimming":45,...})' style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.35); color: #f4f4f5; border: 1px solid ${mainTheme.borderColor}; border-radius: 8px; padding: 8px 10px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <span id="agy-import-msg" style="font-size: 12px; color: #fca5a5;"></span>
              <button id="agy-import-apply" type="button" style="padding: 5px 12px; border-radius: 7px; background: ${mainTheme.primary}; color: #090d16; font-weight: 600; font-size: 12px; border: none; cursor: pointer;">Apply JSON</button>
            </div>
          </div>
        </div>

        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mainTheme.cardBg || 'rgba(22, 16, 14, 0.72)'}; border-radius: 12px; padding: 14px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #f4f4f5; margin-bottom: 2px;">Chat Surface Opacity</div>
              <div style="font-size: 12px; color: #a1a1aa;">Adjust background opacity of the chat input box, your chat bubble, and AI responses (0% = fully transparent, 100% = solid).</div>
            </div>
            <button id="agy-op-default-btn" type="button" style="padding: 4px 10px; border-radius: 7px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16); color: #d4d4d8; font-size: 11.5px; cursor: pointer; white-space: nowrap;">Default</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.07);">
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #d4d4d8;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>Chat Input</span>
                <span id="agy-op-input-val" style="color: ${mainTheme.primary}; font-weight: 600;">${initInputOp}%</span>
              </div>
              <input id="agy-op-input" type="range" min="0" max="100" value="${initInputOp}" style="width: 100%; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #d4d4d8;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>User Chat Bubble</span>
                <span id="agy-op-user-val" style="color: ${mainTheme.primary}; font-weight: 600;">${initUserOp}%</span>
              </div>
              <input id="agy-op-user" type="range" min="0" max="100" value="${initUserOp}" style="width: 100%; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #d4d4d8;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>AI Chat Bubble</span>
                <span id="agy-op-ai-val" style="color: ${mainTheme.primary}; font-weight: 600;">${initAiOp}%</span>
              </div>
              <input id="agy-op-ai" type="range" min="0" max="100" value="${initAiOp}" style="width: 100%; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
            </label>
          </div>
        </div>

        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mainTheme.cardBg || 'rgba(22, 16, 14, 0.72)'}; border-radius: 12px; padding: 14px 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #f4f4f5; margin-bottom: 2px;">Chat Avatars (User & AI Agent)</div>
              <div style="font-size: 12px; color: #a1a1aa;">Profile badges rendered beside chat messages (auto-compressed WebP).</div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="agy-user-av-preview" style="width: 30px; height: 30px; border-radius: ${st.avatarRadius}%; border: 1.5px solid ${mainTheme.primary}; background: rgba(255,255,255,0.06) ${effUserAv ? `url('${effUserAv}') center/cover no-repeat` : ''}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #a1a1aa;">${effUserAv ? '' : 'U'}</div>
                <label style="padding: 4px 10px; border-radius: 7px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                  User
                  <input id="agy-user-av-upload" type="file" accept="image/*" style="display: none;" />
                </label>
                <button id="agy-user-av-clear" type="button" style="padding: 4px 8px; border-radius: 7px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.14); color: #a1a1aa; font-size: 11.5px; cursor: pointer;">Off</button>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="agy-agent-av-preview" style="width: 30px; height: 30px; border-radius: ${st.avatarRadius}%; border: 1.5px solid ${mainTheme.secondary || mainTheme.primary}; background: rgba(255,255,255,0.06) ${effAgentAv ? `url('${effAgentAv}') center/cover no-repeat` : ''}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #a1a1aa;">${effAgentAv ? '' : 'AI'}</div>
                <label style="padding: 4px 10px; border-radius: 7px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                  Agent
                  <input id="agy-agent-av-upload" type="file" accept="image/*" style="display: none;" />
                </label>
                <button id="agy-agent-av-clear" type="button" style="padding: 4px 8px; border-radius: 7px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.14); color: #a1a1aa; font-size: 11.5px; cursor: pointer;">Off</button>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.07);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a1a1aa;">
              Size
              <input id="agy-av-size" type="range" min="22" max="52" value="${st.avatarSize}" style="width: 100px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
              <span id="agy-av-size-val" style="min-width: 34px;">${st.avatarSize}px</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a1a1aa;">
              Corner Radius
              <input id="agy-av-rad" type="range" min="0" max="50" value="${st.avatarRadius}" style="width: 100px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
              <span id="agy-av-rad-val" style="min-width: 34px;">${st.avatarRadius}%</span>
            </label>
          </div>
        </div>

        <div style="margin-bottom: 28px;">
          <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">User Chat Bubble</div>
          <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">Mix and match bubble frame & ornament independently from the active wallpaper.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${THEME_KEYS.map(name => {
              const th = THEMES[name];
              const isSelected = name === st.bubbleName;
              const stickerTop = th.isOrnament ? Math.round((th.stickerTop || 0) * 0.85) : Math.round((th.stickerTop || 0) * 0.74);
              const stickerW = Math.round((th.stickerW || 0) * 0.78);
              const stickerH = th.isOrnament ? Math.round((th.stickerH || 0) * 0.8) : Math.round((th.stickerH || 0) * 0.78);
              return `
                <div class="agy-bubble-card" data-name="${name}" style="position: relative; border-radius: 12px; border: ${isSelected ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: ${isSelected ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)'}; padding: 24px 18px 14px 18px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; min-height: 112px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div style="display: flex; justify-content: center; align-items: center; width: 100%; margin-top: 6px; margin-bottom: 10px;">
                    <div style="position: relative; width: 192px; height: 46px; padding: 1.2px; border-radius: ${th.isScroll ? '6px' : '12px'}; background: ${th.frameBg}; box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 10px ${th.glow};">
                      <div style="position: relative; width: 100%; height: 100%; background: ${th.bg}; border: ${th.innerBorder || '1px solid ' + th.borderColor}; border-radius: ${th.isScroll ? '4px' : '11px'}; display: flex; align-items: center; padding: 0 16px;">
                        ${th.sticker ? `<div style="position: absolute; top: ${stickerTop}px; right: 8px; width: ${stickerW}px; height: ${stickerH}px; background-image: url('${th.sticker}'); background-size: contain; background-position: ${th.isOrnament ? 'center' : 'bottom center'}; background-repeat: no-repeat; pointer-events: none;"></div>` : ''}
                        <span style="font-size: 13.5px; font-weight: 500; color: ${th.textColor};">Hello ✨</span>
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13.5px; font-weight: 500; color: #e4e4e7;">${name}</span>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="margin-bottom: 28px;">
          <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">Composer Style</div>
          <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">Customize the chat input frame without affecting keyboard shortcuts or attachments.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${Object.entries(INPUT_STYLES).map(([key, item]) => {
              const isSelected = key === st.inputStyle;
              const activeBubbleTh = THEMES[st.bubbleName] || mainTheme;
              const previewStickerStyle = activeBubbleTh.isOrnament
                ? 'top: -12px; right: 10px; width: 72px; height: 22px; background-position: center;'
                : 'top: -22px; right: 10px; width: 32px; height: 28px; background-position: bottom center;';
              const previewInnerBg = key === 'glass'
                ? (activeBubbleTh.inputGlassBg || 'rgba(20, 15, 13, 0.45)')
                : (activeBubbleTh.inputCardBg || 'rgba(26, 18, 15, 0.92)');
              return `
                <div class="agy-input-card" data-style="${key}" style="border-radius: 12px; border: ${isSelected ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: ${isSelected ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)'}; padding: 16px 18px; cursor: pointer; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div class="agy-input-preview-outer" style="position: relative; margin-top: 8px; padding: 1.5px; border-radius: 10px; background: ${key === 'double_gold' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : activeBubbleTh.frameBg};">
                    <div class="agy-input-preview-sticker" style="position: absolute; ${previewStickerStyle} background-image: url('${activeBubbleTh.sticker || ''}'); background-size: contain; background-repeat: no-repeat; display: ${key !== 'minimal' && activeBubbleTh.sticker ? 'block' : 'none'}; pointer-events: none;"></div>
                    <div class="agy-input-preview-inner" style="background: ${previewInnerBg}; border-radius: 9px; padding: 8px 12px; font-size: 12px; color: #a1a1aa; display: flex; justify-content: space-between; align-items: center;">
                      <span>Ask anything, @ to mention...</span>
                      <span class="agy-input-preview-turbo" style="color: ${activeBubbleTh.primary}; font-size: 11px;">Send →</span>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <div style="font-size: 13.5px; font-weight: 500; color: #e4e4e7;">${item.label}</div>
                      <div style="font-size: 11.5px; color: #a1a1aa;">${item.desc}</div>
                    </div>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">Theme Presets (${THEME_KEYS.length})</div>
          <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">Complete backdrop, palette, unified L-glass, and matching ornaments.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${THEME_KEYS.map(name => {
              const th = THEMES[name];
              const isSelected = name === st.themeName;
              const thumbUrl = resolveAssetUrl(th.liteWallpaper || th.wallpaper);
              const thumbBg = thumbUrl
                ? `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(14,12,12,0.85)), url('${thumbUrl}')`
                : (th.pureBg || th.bg);
              const thumbOrnamentStyle = th.isOrnament
                ? 'right: 10px; bottom: 8px; width: 76px; height: 24px; background-position: center;'
                : 'right: 12px; bottom: 4px; width: 42px; height: 38px; background-position: bottom center;';
              return `
                <div class="agy-preset-card" data-name="${name}" style="border-radius: 12px; border: ${isSelected ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: rgba(14, 12, 12, 0.82); overflow: hidden; cursor: pointer; display: flex; flex-direction: column; transition: border-color 0.15s ease;">
                  <div style="height: 68px; width: 100%; background-image: ${thumbBg}; background-size: cover; background-position: ${th.bgPosition || 'center'}; position: relative; display: flex; align-items: flex-end; padding: 8px 14px;">
                    ${th.sticker ? `<div style="position: absolute; ${thumbOrnamentStyle} background-image: url('${th.sticker}'); background-size: contain; background-repeat: no-repeat; pointer-events: none;"></div>` : ''}
                    <span style="font-size: 13.5px; font-weight: 600; color: #fff;">${name}</span>
                  </div>
                  <div style="padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: #a1a1aa;">${th.concept || ''}</span>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    function updateInputPreviews(bName) {
      const activeTh = THEMES[bName] || THEMES[DEFAULT_THEME_KEY];
      container.querySelectorAll('.agy-input-card').forEach(card => {
        const key = card.dataset.style;
        const outer = card.querySelector('.agy-input-preview-outer');
        if (outer) {
          outer.style.background = key === 'double_gold'
            ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
            : activeTh.frameBg;
        }
        const inner = card.querySelector('.agy-input-preview-inner');
        if (inner) {
          inner.style.background = key === 'glass'
            ? (activeTh.inputGlassBg || 'rgba(20, 15, 13, 0.45)')
            : (activeTh.inputCardBg || 'rgba(26, 18, 15, 0.92)');
        }
        const sticker = card.querySelector('.agy-input-preview-sticker');
        if (sticker) {
          if (key !== 'minimal' && activeTh.sticker) {
            sticker.style.display = 'block';
            sticker.style.backgroundImage = `url('${activeTh.sticker}')`;
            if (activeTh.isOrnament) {
              sticker.style.top = '-12px';
              sticker.style.width = '72px';
              sticker.style.height = '22px';
              sticker.style.backgroundPosition = 'center';
            } else {
              sticker.style.top = '-22px';
              sticker.style.width = '32px';
              sticker.style.height = '28px';
              sticker.style.backgroundPosition = 'bottom center';
            }
          } else {
            sticker.style.display = 'none';
          }
        }
        const turbo = card.querySelector('.agy-input-preview-turbo');
        if (turbo) {
          turbo.style.color = activeTh.primary;
        }
      });
    }

    const slider = container.querySelector('#agy-dim-slider');
    const valLabel = container.querySelector('#agy-dim-val');
    slider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      valLabel.textContent = v + '%';
      applyTheme({ dimming: v });
    });

    const wpToggle = container.querySelector('#agy-wp-toggle');
    wpToggle.addEventListener('change', (e) => {
      applyTheme({ wpEnabled: e.target.checked });
    });

    const wpUpload = container.querySelector('#agy-wp-upload');
    wpUpload.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        applyTheme({ customWp: reader.result, wpEnabled: true });
        const toggle = container.querySelector('#agy-wp-toggle');
        if (toggle) toggle.checked = true;
      };
      reader.readAsDataURL(file);
    });

    const userAvUpload = container.querySelector('#agy-user-av-upload');
    const userAvPreview = container.querySelector('#agy-user-av-preview');
    const userAvClear = container.querySelector('#agy-user-av-clear');
    const agentAvUpload = container.querySelector('#agy-agent-av-upload');
    const agentAvPreview = container.querySelector('#agy-agent-av-preview');
    const agentAvClear = container.querySelector('#agy-agent-av-clear');

    function syncAvPreview(el, url, fallbackText) {
      if (!el) return;
      if (url) {
        el.style.backgroundImage = `url("${url}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.style.backgroundImage = 'none';
        el.textContent = fallbackText;
      }
    }

    if (userAvUpload) {
      userAvUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAvatarFile(file, (dataUrl) => {
          applyTheme({ userAvatar: dataUrl });
          syncAvPreview(userAvPreview, dataUrl, 'U');
        });
      });
    }
    if (userAvClear) {
      userAvClear.addEventListener('click', () => {
        applyTheme({ userAvatar: 'none' });
        syncAvPreview(userAvPreview, '', 'U');
      });
    }
    if (agentAvUpload) {
      agentAvUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAvatarFile(file, (dataUrl) => {
          applyTheme({ agentAvatar: dataUrl });
          syncAvPreview(agentAvPreview, dataUrl, 'AI');
        });
      });
    }
    if (agentAvClear) {
      agentAvClear.addEventListener('click', () => {
        applyTheme({ agentAvatar: 'none' });
        syncAvPreview(agentAvPreview, '', 'AI');
      });
    }

    const blurSlider = container.querySelector('#agy-blur-slider');
    const blurLabel = container.querySelector('#agy-blur-val');
    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (blurLabel) blurLabel.textContent = v + 'px';
        applyTheme({ glassBlur: v });
      });
    }

    const avSizeSlider = container.querySelector('#agy-av-size');
    const avSizeVal = container.querySelector('#agy-av-size-val');
    if (avSizeSlider) {
      avSizeSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (avSizeVal) avSizeVal.textContent = v + 'px';
        applyTheme({ avatarSize: v });
      });
    }

    const avRadSlider = container.querySelector('#agy-av-rad');
    const avRadVal = container.querySelector('#agy-av-rad-val');
    if (avRadSlider) {
      avRadSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (avRadVal) avRadVal.textContent = v + '%';
        if (userAvPreview) userAvPreview.style.borderRadius = v + '%';
        if (agentAvPreview) agentAvPreview.style.borderRadius = v + '%';
        applyTheme({ avatarRadius: v });
      });
    }

    const opInputSlider = container.querySelector('#agy-op-input');
    const opInputVal = container.querySelector('#agy-op-input-val');
    const opUserSlider = container.querySelector('#agy-op-user');
    const opUserVal = container.querySelector('#agy-op-user-val');
    const opAiSlider = container.querySelector('#agy-op-ai');
    const opAiVal = container.querySelector('#agy-op-ai-val');
    const opDefaultBtn = container.querySelector('#agy-op-default-btn');

    const syncOpacitySlidersToState = () => {
      const cur = getState();
      const curMain = THEMES[cur.themeName] || THEMES[DEFAULT_THEME_KEY];
      const curBubble = THEMES[cur.bubbleName] || curMain;
      const inVal = cur.inputOpacity !== null ? cur.inputOpacity : getMeanCssAlphaPct(getRawInputCardBg(curBubble, cur.inputStyle), 56);
      const uVal = cur.userBubbleOpacity !== null ? cur.userBubbleOpacity : getMeanCssAlphaPct(curBubble.bg, 68);
      const aVal = cur.aiBubbleOpacity !== null ? cur.aiBubbleOpacity : getMeanCssAlphaPct(curMain.aiCardBg, 76);
      if (opInputSlider) opInputSlider.value = inVal;
      if (opInputVal) opInputVal.textContent = inVal + '%';
      if (opUserSlider) opUserSlider.value = uVal;
      if (opUserVal) opUserVal.textContent = uVal + '%';
      if (opAiSlider) opAiSlider.value = aVal;
      if (opAiVal) opAiVal.textContent = aVal + '%';
    };

    if (opInputSlider) {
      opInputSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (opInputVal) opInputVal.textContent = v + '%';
        applyTheme({ inputOpacity: v });
      });
    }
    if (opUserSlider) {
      opUserSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (opUserVal) opUserVal.textContent = v + '%';
        applyTheme({ userBubbleOpacity: v });
      });
    }
    if (opAiSlider) {
      opAiSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (opAiVal) opAiVal.textContent = v + '%';
        applyTheme({ aiBubbleOpacity: v });
      });
    }
    if (opDefaultBtn) {
      opDefaultBtn.addEventListener('click', () => {
        applyTheme({ inputOpacity: null, userBubbleOpacity: null, aiBubbleOpacity: null });
        syncOpacitySlidersToState();
      });
    }

    const exportBtn = container.querySelector('#agy-export-btn');
    const importToggle = container.querySelector('#agy-import-toggle');
    const importBox = container.querySelector('#agy-import-box');
    const importText = container.querySelector('#agy-import-text');
    const importApply = container.querySelector('#agy-import-apply');
    const importMsg = container.querySelector('#agy-import-msg');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = JSON.stringify(getState(), null, 2);
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(json).then(() => {
            exportBtn.textContent = 'Copied ✓';
            setTimeout(() => { exportBtn.textContent = 'Export JSON'; }, 1500);
          }).catch(() => {
            if (importBox && importText) {
              importBox.style.display = 'flex';
              importText.value = json;
              importText.select();
            }
          });
        } else if (importBox && importText) {
          importBox.style.display = 'flex';
          importText.value = json;
          importText.select();
        }
      });
    }
    if (importToggle && importBox) {
      importToggle.addEventListener('click', () => {
        importBox.style.display = importBox.style.display === 'none' ? 'flex' : 'none';
        if (importMsg) importMsg.textContent = '';
      });
    }
    if (importApply && importText) {
      importApply.addEventListener('click', () => {
        try {
          const parsed = JSON.parse(importText.value.trim());
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Config must be a JSON object');
          }
          const allowed = {};
          const keys = ['themeName', 'bubbleName', 'inputStyle', 'dimming', 'wpEnabled', 'customWp', 'userAvatar', 'agentAvatar', 'glassBlur', 'avatarSize', 'avatarRadius', 'performanceMode', 'inputOpacity', 'userBubbleOpacity', 'aiBubbleOpacity'];
          keys.forEach((k) => {
            if (parsed[k] !== undefined) allowed[k] = parsed[k];
          });
          applyTheme(allowed);
          renderThemePanels(container);
        } catch (err) {
          if (importMsg) importMsg.textContent = 'Invalid JSON: ' + err.message;
        }
      });
    }

    const perfBadge = container.querySelector('#agy-perf-badge');
    const syncPerfCards = (mode) => {
      if (perfBadge) {
        perfBadge.textContent = mode === 'lite' ? 'Lite • Eco RAM' : 'Ultra • 60 FPS Live';
      }
      container.querySelectorAll('.agy-perf-card').forEach(c => {
        const isSel = c.dataset.mode === mode;
        c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        c.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
        const slot = c.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
    };

    container.querySelectorAll('.agy-perf-card').forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.dataset.mode === 'lite' ? 'lite' : 'ultra';
        applyTheme({ performanceMode: mode });
        syncPerfCards(mode);
      });
    });

    const resetBtn = container.querySelector('#agy-reset-btn');
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_CUSTOM_WP);
      localStorage.removeItem(STORAGE_USER_AVATAR);
      localStorage.removeItem(STORAGE_AGENT_AVATAR);
      localStorage.removeItem(STORAGE_GLASS_BLUR);
      localStorage.removeItem(STORAGE_AVATAR_SIZE);
      localStorage.removeItem(STORAGE_AVATAR_RADIUS);
      localStorage.removeItem(STORAGE_THEME);
      localStorage.removeItem(STORAGE_BUBBLE);
      localStorage.removeItem(STORAGE_INPUT);
      localStorage.removeItem(STORAGE_DIMMING);
      localStorage.removeItem(STORAGE_WP_ENABLED);
      localStorage.removeItem(STORAGE_PERF_MODE);
      localStorage.removeItem(STORAGE_INPUT_OPACITY);
      localStorage.removeItem(STORAGE_USER_BUBBLE_OPACITY);
      localStorage.removeItem(STORAGE_AI_BUBBLE_OPACITY);
      applyTheme({
        themeName: DEFAULT_THEME_KEY,
        bubbleName: DEFAULT_THEME_KEY,
        inputStyle: 'sync',
        dimming: 69,
        wpEnabled: true,
        customWp: '',
        userAvatar: '',
        agentAvatar: '',
        glassBlur: 3,
        avatarSize: 32,
        avatarRadius: 50,
        performanceMode: DEFAULT_PERF_MODE,
        inputOpacity: null,
        userBubbleOpacity: null,
        aiBubbleOpacity: null
      });
      syncPerfCards(DEFAULT_PERF_MODE);
      syncOpacitySlidersToState();
      const defTh = THEMES[DEFAULT_THEME_KEY] || {};
      syncAvPreview(userAvPreview, resolveAssetUrl(defTh.userAvatar || ''), 'U');
      syncAvPreview(agentAvPreview, resolveAssetUrl(defTh.agentAvatar || ''), 'AI');
      if (userAvPreview) userAvPreview.style.borderRadius = '50%';
      if (agentAvPreview) agentAvPreview.style.borderRadius = '50%';
      if (slider) slider.value = 69;
      if (valLabel) valLabel.textContent = '69%';
      if (blurSlider) blurSlider.value = 3;
      if (blurLabel) blurLabel.textContent = '3px';
      if (avSizeSlider) avSizeSlider.value = 32;
      if (avSizeVal) avSizeVal.textContent = '32px';
      if (avRadSlider) avRadSlider.value = 50;
      if (avRadVal) avRadVal.textContent = '50%';
      if (wpToggle) wpToggle.checked = true;

      container.querySelectorAll('.agy-preset-card').forEach(c => {
        const isSel = c.dataset.name === DEFAULT_THEME_KEY;
        c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        const slot = c.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
      container.querySelectorAll('.agy-bubble-card').forEach(b => {
        const isSel = b.dataset.name === DEFAULT_THEME_KEY;
        b.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        b.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
        const slot = b.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
      container.querySelectorAll('.agy-input-card').forEach(c => {
        const isSel = c.dataset.style === 'sync';
        c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        c.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
        const slot = c.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
      updateInputPreviews(DEFAULT_THEME_KEY);
    });

    container.querySelectorAll('.agy-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        applyTheme({ themeName: name, bubbleName: name, customWp: '' });

        container.querySelectorAll('.agy-preset-card').forEach(c => {
          const isSel = c.dataset.name === name;
          c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          const slot = c.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        container.querySelectorAll('.agy-bubble-card').forEach(b => {
          const isSel = b.dataset.name === name;
          b.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          b.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
          const slot = b.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        updateInputPreviews(name);
        syncOpacitySlidersToState();
      });
    });

    container.querySelectorAll('.agy-bubble-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        applyTheme({ bubbleName: name });

        container.querySelectorAll('.agy-bubble-card').forEach(b => {
          const isSel = b.dataset.name === name;
          b.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          b.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
          const slot = b.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        updateInputPreviews(name);
        syncOpacitySlidersToState();
      });
    });

    container.querySelectorAll('.agy-input-card').forEach(card => {
      card.addEventListener('click', () => {
        const styleKey = card.dataset.style;
        applyTheme({ inputStyle: styleKey, inputOpacity: null });

        container.querySelectorAll('.agy-input-card').forEach(c => {
          const isSel = c.dataset.style === styleKey;
          c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          c.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
          const slot = c.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        syncOpacitySlidersToState();
      });
    });
  }

  function injectMainSidebarButton() {
    if (document.getElementById('agy-custom-theme-sidebar-btn')) return;

    const sidebar = document.querySelector('.bg-sidebar');
    if (!sidebar) return;

    const spans = Array.from(sidebar.querySelectorAll('span'));
    const customSpan = spans.find(s => s.textContent?.trim() === 'Customizations');
    if (!customSpan) return;

    const row = customSpan.closest('a, button, div[role="button"], .group\\/headerbtn') || customSpan.parentElement;
    if (!row || !row.parentNode) return;

    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-sidebar-btn';
    btn.type = 'button';
    btn.className = 'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer select-none';
    btn.style.cssText = 'text-align: left;';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Custom theme</span>
    `;

    row.parentNode.insertBefore(btn, row.nextSibling);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
  }

  function injectSettingsModalButton() {
    const modal = document.querySelector('.settings-modal-container');
    if (!modal || document.getElementById('agy-custom-theme-settings-btn')) return;

    const headers = Array.from(modal.querySelectorAll('h2, h3'));
    const appearanceHeader = headers.find(h => h.textContent?.trim() === 'Appearance');
    if (!appearanceHeader) return;

    let targetContainer = appearanceHeader.parentElement;
    while (targetContainer && !targetContainer.className.includes('justify-between') && targetContainer !== modal) {
      targetContainer = targetContainer.parentElement;
    }

    if (!targetContainer || !targetContainer.parentNode) return;

    Array.from(targetContainer.parentNode.children).forEach(child => {
      if (child.id === 'agy-custom-theme-settings-btn') child.remove();
    });

    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-settings-btn';
    btn.type = 'button';
    btn.className = 'select-none rounded px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer text-white';
    btn.style.cssText = 'background: linear-gradient(135deg, #e08e55 0%, #b45309 100%); border: 1px solid rgba(251, 191, 36, 0.4); box-shadow: 0 2px 10px rgba(224, 142, 85, 0.3); margin-top: 8px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span>Open Custom Theme Studio</span>
    `;

    targetContainer.parentNode.insertBefore(btn, targetContainer.nextSibling);

    btn.addEventListener('click', () => {
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
  }

  function hookSidebarScroll() {
    if (!window.__AGY_SCROLL_AC__) return;
    const scrollers = document.querySelectorAll('.agy-shell .bg-sidebar .overflow-y-auto');
    scrollers.forEach(sc => {
      if (sc.dataset.agyScrollBound) return;
      sc.dataset.agyScrollBound = '1';
      const sync = () => sc.classList.toggle('agy-scrolled', sc.scrollTop > 2);
      sync();
      sc.addEventListener('scroll', sync, { passive: true, signal: window.__AGY_SCROLL_AC__.signal });
    });
  }

  function syncShellMetrics() {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    const split = shell.querySelector('[data-testid="sidebar-split"]');
    const sidebarPane = split ? split.firstElementChild : null;
    const titleBar = shell.querySelector('[class*="@container/titlebar"]');
    const sw = sidebarPane ? Math.round(sidebarPane.getBoundingClientRect().width) : 0;
    const shellRect = shell.getBoundingClientRect();
    const hdrBottom = titleBar ? Math.round(titleBar.getBoundingClientRect().bottom - shellRect.top) : 35;
    shell.style.setProperty('--agy-sidebar-w', sw + 'px');
    shell.style.setProperty('--agy-hdr-h', hdrBottom + 'px');

    const shellW = Math.max(1, shellRect.width);
    const shellH = Math.max(1, shellRect.height);
    const imgAspect = window.__AGY_GLASS_ASPECT__ || (16 / 9);
    let glassW = shellW;
    let glassH = shellH;
    if (shellW / shellH > imgAspect) {
      glassW = shellW;
      glassH = shellW / imgAspect;
    } else {
      glassH = shellH;
      glassW = shellH * imgAspect;
    }
    const glassX = (shellW - glassW) * 0.5;
    const glassY = (shellH - glassH) * 0.5;
    shell.style.setProperty('--agy-glass-w', glassW.toFixed(2) + 'px');
    shell.style.setProperty('--agy-glass-h', glassH.toFixed(2) + 'px');
    shell.style.setProperty('--agy-glass-x', glassX.toFixed(2) + 'px');
    shell.style.setProperty('--agy-glass-y', glassY.toFixed(2) + 'px');

    const hasHoleAttr = document.body.getAttribute('data-has-browser-hole') === 'true';
    const holeEl = hasHoleAttr ? shell.querySelector('[data-browser-hole]:not([data-browser-hole="false"])') : null;
    if (holeEl) {
      if (window.__AGY_SHELL_RO__ && window.__AGY_HOLE_EL__ !== holeEl) {
        try { window.__AGY_SHELL_RO__.observe(holeEl); } catch (e) {}
        window.__AGY_HOLE_EL__ = holeEl;
      }
      const hRect = holeEl.getBoundingClientRect();
      if (hRect.width > 1 && hRect.height > 1) {
        const l = Math.max(0, Math.round(hRect.left - shellRect.left));
        const t = Math.max(0, Math.round(hRect.top - shellRect.top));
        const r = Math.max(l, Math.round(hRect.right - shellRect.left));
        const b = Math.max(t, Math.round(hRect.bottom - shellRect.top));
        shell.style.setProperty(
          '--agy-hole-clip',
          `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px ${t}px)`
        );
        shell.dataset.agyHoleActive = '1';
        delete shell.dataset.agySideGlass;
        return;
      }
    }
    window.__AGY_HOLE_EL__ = null;
    delete shell.dataset.agyHoleActive;
    shell.style.removeProperty('--agy-hole-clip');

    const sideBody = shell.querySelector('[data-side-panel-body="true"]');
    if (sideBody) {
      if (window.__AGY_SHELL_RO__ && window.__AGY_SIDE_EL__ !== sideBody) {
        try { window.__AGY_SHELL_RO__.observe(sideBody); } catch (e) {}
        window.__AGY_SIDE_EL__ = sideBody;
      }
      const sRect = sideBody.getBoundingClientRect();
      const hasContent = sideBody.children.length > 0;
      if (hasContent && sRect.width > 24 && sRect.height > 24 && sRect.left < shellRect.right - 8 && sRect.right > shellRect.left + 8) {
        const sl = Math.max(sw, Math.round(sRect.left - shellRect.left));
        const st = Math.max(hdrBottom, Math.round(sRect.top - shellRect.top));
        const sr = Math.min(Math.round(shellRect.width), Math.max(sl, Math.round(sRect.right - shellRect.left)));
        const sb = Math.min(Math.round(shellRect.height), Math.max(st, Math.round(sRect.bottom - shellRect.top)));
        if (sr - sl > 20 && sb - st > 20) {
          shell.style.setProperty('--agy-side-l', sl + 'px');
          shell.style.setProperty('--agy-side-t', st + 'px');
          shell.style.setProperty('--agy-side-r', sr + 'px');
          shell.style.setProperty('--agy-side-b', sb + 'px');
          shell.dataset.agySideGlass = '1';
          return;
        }
      }
    }
    delete shell.dataset.agySideGlass;
  }

  function hookChatScrollers() {
    if (!window.__AGY_SCROLL_AC__) return;
    const scrollers = document.querySelectorAll('.agy-shell .overflow-y-auto');
    scrollers.forEach(sc => {
      if (sc.closest('.bg-sidebar') || sc.dataset.agyChatScrollBound) return;
      sc.dataset.agyChatScrollBound = '1';
      const syncViewportVfx = () => {
        const ast = getAvatarVfxState();
        if (ast.enabled) syncAvatarVfxCanvases();
        if (ast.uiSuite) mountUiVfxSuiteCanvases(true);
        if (ast.perfMode === 'lite') scheduleLitePaint();
      };
      const onScroll = () => {
        const ast = getAvatarVfxState();
        const now = performance.now();
        if (ast.lastChatScrollSync && (now - ast.lastChatScrollSync) < 85) {
          if (!window.__AGY_CHAT_SCROLL_TMR__) {
            window.__AGY_CHAT_SCROLL_TMR__ = setTimeout(() => {
              window.__AGY_CHAT_SCROLL_TMR__ = 0;
              syncViewportVfx();
            }, 90);
          }
          return;
        }
        ast.lastChatScrollSync = now;
        syncViewportVfx();
      };
      sc.addEventListener('scroll', onScroll, { passive: true, signal: window.__AGY_SCROLL_AC__.signal });
    });
  }

  function hookShellMetrics() {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    if (!shell.dataset.agyTboMounted) {
      shell.dataset.agyTboMounted = '1';
      applyTheme();
      scheduleTitleBarSync();
    }
    if (!window.__AGY_SHELL_RO__ && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        syncShellMetrics();
        if (getAvatarVfxState().perfMode === 'lite') {
          scheduleLitePaint();
        }
      });
      ro.observe(shell);
      const sidebarPane = shell.querySelector('[data-testid="sidebar-split"]')?.firstElementChild;
      if (sidebarPane) ro.observe(sidebarPane);
      window.__AGY_SHELL_RO__ = ro;
    }
    syncShellMetrics();
  }

  function tick() {
    injectMainSidebarButton();
    injectSettingsModalButton();
    hookSidebarScroll();
    hookChatScrollers();
    hookShellMetrics();
    syncAvatarVfxCanvases();
    mountUiVfxSuiteCanvases(false);
    if (getAvatarVfxState().perfMode === 'lite') {
      scheduleLitePaint();
    }
    const vid = document.getElementById('agy-custom-theme-video');
    if (!document.hidden && getState().performanceMode !== 'lite' && vid && vid.paused && vid.readyState >= 2) {
      vid.defaultMuted = true;
      vid.muted = true;
      vid.play().catch(() => {});
    }
  }

  function scheduleTick() {
    if (window.__AGY_TICK_RAF__) return;
    window.__AGY_TICK_RAF__ = requestAnimationFrame(() => {
      window.__AGY_TICK_RAF__ = 0;
      tick();
    });
  }

  clearTitleBarTimers();
  stopEyeTrackingRig();
  if (window.__AGY_AV_RAF__) {
    cancelAnimationFrame(window.__AGY_AV_RAF__);
    window.__AGY_AV_RAF__ = 0;
  }
  if (window.__AGY_LITE_PAINT_RAF__) {
    cancelAnimationFrame(window.__AGY_LITE_PAINT_RAF__);
    window.__AGY_LITE_PAINT_RAF__ = 0;
  }
  if (window.__AGY_TICK_RAF__) {
    cancelAnimationFrame(window.__AGY_TICK_RAF__);
    window.__AGY_TICK_RAF__ = 0;
  }
  if (window.__AGY_SHELL_RO__) {
    try { window.__AGY_SHELL_RO__.disconnect(); } catch (e) {}
    window.__AGY_SHELL_RO__ = null;
  }
  if (window.__AGY_SCROLL_AC__) {
    try { window.__AGY_SCROLL_AC__.abort(); } catch (e) {}
  }
  window.__AGY_SCROLL_AC__ = new AbortController();
  const updateTypingGaze = (e) => {
    const est = window.__AGY_EYE_STATE__;
    if (!est) return;
    if (e && e.type === 'keydown') {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'CapsLock') return;
      if (e.key === 'Enter' && !e.shiftKey) {
        // Supernova Starburst on Message Send!
        est.starBurst = 1.35;
        est.shockRing = 0.01;
        est.virtualCol = 0;
        setTimeout(() => { if (window.__AGY_EYE_STATE__) window.__AGY_EYE_STATE__.lastTypeTs = 0; }, 340);
        return;
      }
      if (e.key === 'Backspace') {
        est.virtualCol = Math.max(0, (est.virtualCol || 0) - 1);
      } else if (e.key === 'Enter' && e.shiftKey) {
        est.virtualCol = 0;
      } else if (String(e.key || '').length === 1) {
        est.virtualCol = (est.virtualCol || 0) + 1;
      }
    }

    // Tier 1: Exact DOM Selection Caret Rect (`contenteditable` / Lexical / ProseMirror)
    let cx = 0;
    let cy = 0;
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(false);
        const rects = range.getClientRects();
        if (rects && rects.length > 0) {
          const r = rects[rects.length - 1];
          if (r && (r.left > 4 || r.top > 4)) {
            cx = r.right;
            cy = r.top + (r.height || 18) * 0.5;
          }
        }
        if (!cx && !cy) {
          const br = range.getBoundingClientRect();
          if (br && (br.left > 4 || br.top > 4)) {
            cx = br.right;
            cy = br.top + (br.height || 18) * 0.5;
          }
        }
      }
    } catch (_) {}

    // Tier 2: Active `<textarea>` / `<input>` or Composer Box Line Scan
    if (!cx && !cy) {
      const active = (e && e.target && e.target.getBoundingClientRect) ? e.target : document.activeElement;
      const compEl = (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable))
        ? active
        : document.querySelector('textarea, [contenteditable="true"], div.relative.flex.flex-col.rounded-lg.border');
      if (compEl && compEl.getBoundingClientRect) {
        const box = compEl.getBoundingClientRect();
        if (box.width > 20 && box.height > 10) {
          let charCount = est.virtualCol || 0;
          let lineIdx = 0;
          if (typeof compEl.value === 'string') {
            const pos = typeof compEl.selectionStart === 'number' ? compEl.selectionStart : compEl.value.length;
            const lines = compEl.value.slice(0, pos).split('\n');
            charCount = (lines[lines.length - 1] || '').length;
            lineIdx = lines.length - 1;
          } else if (compEl.innerText) {
            const lines = String(compEl.innerText).split('\n');
            charCount = (lines[lines.length - 1] || '').length;
            lineIdx = lines.length - 1;
          }
          const usableW = Math.max(120, box.width - 52);
          const pxAdv = charCount * 8.4;
          const wrapRow = lineIdx + Math.floor(pxAdv / usableW);
          cx = box.left + 22 + (pxAdv % usableW);
          cy = box.top + Math.min(Math.max(16, box.height - 14), 22 + wrapRow * 21);
        }
      }
    }

    if (cx > 0 && cy > 0) {
      est.typeX = cx;
      est.typeY = cy;
      est.lastTypeTs = performance.now();
      est.starBurst = Math.max(est.starBurst || 0, 0.34);
    }
  };

  window.addEventListener('mousemove', (e) => {
    if (window.__AGY_EYE_STATE__) {
      window.__AGY_EYE_STATE__.mouseX = e.clientX;
      window.__AGY_EYE_STATE__.mouseY = e.clientY;
      window.__AGY_EYE_STATE__.lastMoveTs = performance.now();
      if (!document.hidden && getAvatarVfxState().perfMode !== 'lite' && !window.__AGY_EYE_RAF__ && window.__AGY_EYE_STATE__.renderOnce) {
        window.__AGY_EYE_STATE__.renderOnce();
      }
    }
  }, { passive: true, signal: window.__AGY_SCROLL_AC__.signal });
  const clearIosPressedRows = () => {
    document.querySelectorAll('.agy-shell .agy-sidebar-row[data-agy-ios-pressed="1"]').forEach(el => {
      el.removeAttribute('data-agy-ios-pressed');
    });
  };
  const lockSidebarIosTarget = (row, isPointerPress) => {
    if (!row) return;
    const ast = getAvatarVfxState();
    if (!ast.uiSuite || ast.uiSuite.sidebar !== '2F') return;
    const now = performance.now();
    if (ast.sbPendingRow === row && now < (ast.sbLockUntil || 0)) {
      return;
    }
    if (isPointerPress) {
      clearIosPressedRows();
      row.setAttribute('data-agy-ios-pressed', '1');
      clearTimeout(window.__AGY_IOS_PRESS_TMR__);
      window.__AGY_IOS_PRESS_TMR__ = setTimeout(clearIosPressedRows, 140);
    }
    const shell = document.querySelector('.agy-shell');
    const link = row.querySelector('a[href]');
    const href = link ? (link.getAttribute('href') || '') : '';
    ast.sbPendingRow = row;
    ast.sbPendingHref = href;
    ast.sbLockUntil = now + 1800;
    ast.sbTransitionUntil = now + 340;
    if (shell) {
      shell.querySelectorAll('[data-agy-vfx-sb-host]').forEach(p => { if (p !== row) p.removeAttribute('data-agy-vfx-sb-host'); });
    }
    row.setAttribute('data-agy-vfx-sb-host', '1');
    const sbScroller = (ast.sbScrollerEl && ast.sbScrollerEl.isConnected) ? ast.sbScrollerEl : findSidebarScroller(shell);
    if (!document.getElementById('agy-ios-sidebar-pill') || !document.getElementById('agy-vfx-2f-sidebar')) {
      mountUiVfxSuiteCanvases(true);
    } else {
      ast.sbScrollerEl = sbScroller;
      ast.sbActiveRow = row;
      syncSidebarIosTargetPosition(row, sbScroller, true);
    }
    if (ast.perfMode === 'lite') {
      scheduleLitePaint();
    }
  };
  window.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    const row = e.target && e.target.closest ? e.target.closest('.agy-shell .agy-sidebar-row') : null;
    if (row) lockSidebarIosTarget(row, true);
  }, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('mousedown', (e) => {
    const est = window.__AGY_EYE_STATE__;
    if (est) {
      est.mouseX = e.clientX;
      est.mouseY = e.clientY;
      est.lastMoveTs = performance.now();
      const btn = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
      est.starBurst = Math.max(est.starBurst || 0, btn ? 1.30 : 0.88);
      est.shockRing = 0.01;
    }
    if (!e.button || e.button === 0) {
      const row = e.target && e.target.closest ? e.target.closest('.agy-shell .agy-sidebar-row') : null;
      if (row) lockSidebarIosTarget(row, true);
    }
  }, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('click', (e) => {
    const row = e.target && e.target.closest ? e.target.closest('.agy-shell .agy-sidebar-row') : null;
    if (row) lockSidebarIosTarget(row, false);
  }, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('pointerup', clearIosPressedRows, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('mouseup', clearIosPressedRows, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('keydown', updateTypingGaze, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('input', updateTypingGaze, { passive: true, capture: true, signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('load', () => scheduleTitleBarSync(), { signal: window.__AGY_SCROLL_AC__.signal });
  const resumeUltraLoopsIfNeeded = () => {
    const stNow = getState();
    if (document.hidden || stNow.performanceMode === 'lite') return;
    const v = document.getElementById('agy-custom-theme-video');
    if (v && v.paused) {
      v.defaultMuted = true;
      v.muted = true;
      v.play().catch(() => {});
    }
    const eyeC = document.getElementById('agy-custom-theme-eye-canvas');
    const est = window.__AGY_EYE_STATE__;
    if (v && eyeC && eyeC.style.display !== 'none' && est && est.startEyeLoop) {
      est.startEyeLoop();
    } else {
      startUltraAvLoop();
    }
  };
  window.addEventListener('focus', () => {
    syncTitleBarOverlay();
    resumeUltraLoopsIfNeeded();
  }, { signal: window.__AGY_SCROLL_AC__.signal });
  document.addEventListener('visibilitychange', () => {
    const v = document.getElementById('agy-custom-theme-video');
    if (document.hidden) {
      if (v && !v.paused) {
        try { v.pause(); } catch (_) {}
      }
      return;
    }
    syncTitleBarOverlay();
    resumeUltraLoopsIfNeeded();
  }, { signal: window.__AGY_SCROLL_AC__.signal });
  if (window.__AGY_CHAT_SCROLL_TMR__) {
    clearTimeout(window.__AGY_CHAT_SCROLL_TMR__);
    window.__AGY_CHAT_SCROLL_TMR__ = 0;
  }
  document.querySelectorAll('[data-agy-scroll-bound]').forEach(el => delete el.dataset.agyScrollBound);
  document.querySelectorAll('[data-agy-chat-scroll-bound]').forEach(el => delete el.dataset.agyChatScrollBound);
  document.querySelectorAll('[data-agy-tbo-mounted]').forEach(el => delete el.dataset.agyTboMounted);
  const staleBackdrop = document.getElementById('agy-custom-theme-modal-backdrop');
  if (staleBackdrop) staleBackdrop.remove();
  const staleSidebarBtn = document.getElementById('agy-custom-theme-sidebar-btn');
  if (staleSidebarBtn) staleSidebarBtn.remove();
  const staleSettingsBtn = document.getElementById('agy-custom-theme-settings-btn');
  if (staleSettingsBtn) staleSettingsBtn.remove();
  const staleCursorCanvas = document.getElementById('agy-custom-theme-cursor-canvas');
  if (staleCursorCanvas) staleCursorCanvas.remove();
  const staleIosPill = document.getElementById('agy-ios-sidebar-pill');
  if (staleIosPill) staleIosPill.remove();
  const staleSbVfx = document.getElementById('agy-vfx-2f-sidebar');
  if (staleSbVfx) staleSbVfx.remove();
  document.querySelectorAll('.agy-avatar-vfx-canvas, .agy-ui-vfx-canvas, #agy-katana-tr-canvas, #agy-katana-bl-canvas').forEach(el => el.remove());
  if (window.__AGY_AV_VFX__) {
    window.__AGY_AV_VFX__.sbLastTargetKey = '';
    window.__AGY_AV_VFX__.sbTransitionUntil = 0;
  }

  window.__AGY_HOLE_EL__ = null;
  if (window.__AGY_MODAL_OBSERVER__) {
    window.__AGY_MODAL_OBSERVER__.disconnect();
  }
  window.__AGY_MODAL_OBSERVER__ = new MutationObserver(scheduleTick);
  window.__AGY_MODAL_OBSERVER__.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-has-browser-hole', 'data-browser-hole']
  });
  tick();

  return 'Antigravity Custom Theme Engine Ready!';
})();
