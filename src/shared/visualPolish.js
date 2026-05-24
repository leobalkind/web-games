// =============================================================================
// VISUAL POLISH — global cosmetic layer auto-mounted with the settings menu.
//
// Provides three uniform polish wins across every game, all opt-in via the
// shared Settings panel:
//
//   1. CRT MODE (toggle: `wg:settings:crt`)
//      Fixed-position scanline + vignette overlay above gameplay, below all
//      buttons/modals. Pure CSS; one cheap fixed element.
//
//   2. SHAKE INTENSITY (slider: `wg:settings:shakeMul`)
//      Engine-side hook in screenShake.js. The settings panel slider writes
//      the storage key; engines call getShakeMul() at the add-site.
//
//   3. START-SCREEN AMBIENCE (always-on)
//      Slow drifting particles painted INTO any visible `.overlay` panel —
//      adds depth without slowing the game (paused while overlay hidden).
//
//   4. MODAL TRANSITIONS (always-on, no setting)
//      Auto fade+slide-in for `.overlay__panel` / shared modal panels via
//      a CSS class injected on first open.
//
// Side-effect import (mountVisualPolish auto-runs once per page):
//   import './visualPolish.js';   // OR call mountVisualPolish() explicitly
// =============================================================================

const K_CRT = 'wg:settings:crt';
const _read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };

let _mounted = false;
let _crtEl = null;
let _ambEl = null;
let _ambRaf = 0;

export function isCrtOn() { return _read(K_CRT, '0') === '1'; }
export function setCrtOn(on) {
  try { localStorage.setItem(K_CRT, on ? '1' : '0'); } catch {}
  applyCrt();
}

function applyCrt() {
  if (!_crtEl) return;
  _crtEl.style.display = isCrtOn() ? 'block' : 'none';
}

function ensureStyles() {
  if (document.getElementById('wg-polish-styles')) return;
  const s = document.createElement('style');
  s.id = 'wg-polish-styles';
  s.textContent = `
    /* CRT overlay — sits above gameplay but below buttons. */
    .wg-crt{position:fixed;inset:0;pointer-events:none;z-index:90;mix-blend-mode:multiply;display:none;}
    .wg-crt::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(0,0,0,.18) 0,rgba(0,0,0,.18) 1px,rgba(0,0,0,0) 2px,rgba(0,0,0,0) 3px);}
    .wg-crt::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%);}
    body.reduced-motion .wg-crt{display:none!important;}
    /* Start-overlay ambience — drifting glints painted by JS */
    /* z-index:0 + parent overlay__panel uses isolation:isolate so panel content stays on top */
    .wg-amb{position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:inherit;overflow:hidden;opacity:.85;}
    .wg-amb__c{position:absolute;width:100%;height:100%;display:block;mix-blend-mode:screen;}
    /* Marker class added to each panel that has ambience — promotes children */
    .wg-amb-host{isolation:isolate;}
    .wg-amb-host > *:not(.wg-amb){position:relative;z-index:1;}
    body.reduced-motion .wg-amb{display:none!important;}
    /* Modal/overlay__panel fade+slide on open */
    .overlay:not([hidden]) .overlay__panel,
    .wg-settings-modal.is-open .wg-settings-panel{animation:wgPanelIn .4s cubic-bezier(.3,1.4,.5,1);}
    @keyframes wgPanelIn{0%{opacity:0;transform:translateY(14px) scale(.96);}60%{opacity:1;transform:translateY(-2px) scale(1.01);}100%{opacity:1;transform:translateY(0) scale(1);}}
    body.reduced-motion .overlay__panel,body.reduced-motion .wg-settings-panel{animation:none!important;}
  `;
  document.head.appendChild(s);
}

// === Ambience: a thin canvas that overlays the visible .overlay__panel. ====
// We mount ONE absolute canvas per .overlay__panel encountered. It pauses
// when the overlay becomes hidden. Cheap (8 particles).
function attachAmbience(panel) {
  if (panel.dataset.wgAmb === '1') return;
  panel.dataset.wgAmb = '1';
  const wrap = document.createElement('div');
  wrap.className = 'wg-amb';
  const canvas = document.createElement('canvas');
  canvas.className = 'wg-amb__c';
  wrap.appendChild(canvas);
  // Insert behind content — make panel a stacking context via class, no inline mutation.
  const cs = getComputedStyle(panel);
  if (cs.position === 'static') panel.style.position = 'relative';
  panel.classList.add('wg-amb-host');
  panel.insertBefore(wrap, panel.firstChild);
  const ctx = canvas.getContext('2d');
  let parts = [];
  const seed = () => {
    parts = [];
    const w = canvas.width = panel.clientWidth;
    const h = canvas.height = panel.clientHeight;
    for (let i = 0; i < 14; i++) {
      parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 8,
        vy: -4 - Math.random() * 14,
        a: 0.15 + Math.random() * 0.35,
        c: Math.random() < 0.5 ? '76,201,240' : '255,210,63',
      });
    }
  };
  seed();
  const onResize = () => seed();
  window.addEventListener('resize', onResize);
  let last = performance.now();
  let running = true;
  const loop = (t) => {
    if (!running) return;
    if (panel.offsetParent === null) { _ambRaf = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const w = canvas.width; const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    _ambRaf = requestAnimationFrame(loop);
  };
  _ambRaf = requestAnimationFrame(loop);
  // Clean up if panel removed from DOM. We use one observer per ambient panel,
  // disconnect + cancel the raf + drop the resize listener the moment the panel
  // leaves the document — keeps memory flat across many start/restart cycles.
  const obs = new MutationObserver(() => {
    if (!document.body.contains(panel)) {
      running = false;
      try { cancelAnimationFrame(_ambRaf); } catch {}
      window.removeEventListener('resize', onResize);
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

function scanAmbience() {
  // Apply to every overlay__panel that is currently visible OR pre-mount so
  // they animate the moment they appear.
  document.querySelectorAll('.overlay__panel').forEach((p) => attachAmbience(p));
}

export function mountVisualPolish() {
  if (_mounted) return;
  _mounted = true;
  ensureStyles();
  // CRT element
  _crtEl = document.createElement('div');
  _crtEl.className = 'wg-crt';
  document.body.appendChild(_crtEl);
  applyCrt();
  // Ambience — try now and re-scan on DOM changes (catches late-built overlays)
  scanAmbience();
  try {
    const mo = new MutationObserver(() => scanAmbience());
    mo.observe(document.body, { childList: true, subtree: true });
  } catch {}
}

// Auto-mount on import. Idempotent.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountVisualPolish(), { once: true });
  } else {
    mountVisualPolish();
  }
}
