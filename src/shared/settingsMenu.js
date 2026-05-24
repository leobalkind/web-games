// =============================================================================
// SHARED SETTINGS MENU — gear icon, modal panel, system-level audio + a11y.
// =============================================================================
// Stores volume + a11y prefs in localStorage under `wg:settings:*` (NOT
// per-profile — these are system-wide). All 13 games hook in via
// `createSettingsMenu({ gameId, getControlsHelp })`. The module also exposes
// `getMasterGain()` so each game's audio engine can multiply its output by
// the user's chosen sfx/music volume (and 0 if muted).
//
//   import { createSettingsMenu, getMasterGain } from '.../settingsMenu.js';
//   const settings = createSettingsMenu({ gameId: 'bork-battle',
//     getControlsHelp: () => 'WASD move · MOUSE aim · CLICK fire' });
//   // ...in audio: const peak = baseGain * getMasterGain('sfx');
//
// The "Reset High Scores" button wipes ONLY `wg:hs:<gameId>` (and the
// profile-scoped variant `wg:p:<id>:hs:<gameId>`). It never touches profiles
// or other games' data.
//
// === Round 3C a11y additions ===
// - Large Text, Color-Blind, Captions toggles synced to body classes.
// - Focus trap inside modal + restore focus to opener on close.
// - aria-modal/role/aria-labelledby on the panel.
// - Global "?" hotkey opens controls help.
// - Live-region announcer (`announce(msg)`) for SR users (also used by killFeed).
// - `caption(text, ms)` shows on-screen subtitles when CAPTIONS is enabled —
//   no-op otherwise so games can safely call it on every SFX trigger.

import { ensureSharedStyles } from './_overlayStyles.js';
import { showTip } from './tutorialTip.js';
// Side-effect import: auto-mounts CRT overlay + ambience + modal transitions.
import { isCrtOn, setCrtOn, mountVisualPolish } from './visualPolish.js';
import { getShakeMul, setShakeMul } from './screenShake.js';

const K_MUSIC   = 'wg:settings:music';   // 0-100
const K_SFX     = 'wg:settings:sfx';     // 0-100
const K_MUTED   = 'wg:settings:muted';   // '0' | '1'
const K_RM      = 'wg:settings:reducedMotion'; // '0' | '1'
const K_FPS     = 'wg:settings:fps';     // '0' | '1'
const K_HC      = 'wg:settings:highContrast'; // '0' | '1'
const K_LT      = 'wg:settings:largeText';    // '0' | '1'
const K_CB      = 'wg:settings:colorBlind';   // '0' | '1'
const K_CAPS    = 'wg:settings:captions';     // '0' | '1'

const _read = (key, dflt) => {
  try { const v = localStorage.getItem(key); return v == null ? dflt : v; } catch { return dflt; }
};
const _write = (key, v) => { try { localStorage.setItem(key, String(v)); } catch {} };

// === Public reader for audio engines =========================================
// `kind` is 'sfx' (default) or 'music'. Returns 0..1 multiplier. 0 if muted.
export function getMasterGain(kind = 'sfx') {
  if (_read(K_MUTED, '0') === '1') return 0;
  const k = kind === 'music' ? K_MUSIC : K_SFX;
  const raw = _read(k, '70');
  const n = Math.max(0, Math.min(100, parseInt(raw, 10) || 0));
  return n / 100;
}

// Subscribe to settings changes so engines can react live.
const _listeners = new Set();
export function onSettingsChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
function _emit() { for (const fn of _listeners) { try { fn(getSnapshot()); } catch {} } }
export function getSnapshot() {
  return {
    music: parseInt(_read(K_MUSIC, '70'), 10) || 0,
    sfx: parseInt(_read(K_SFX, '70'), 10) || 0,
    muted: _read(K_MUTED, '0') === '1',
    reducedMotion: _read(K_RM, '0') === '1',
    showFps: _read(K_FPS, '0') === '1',
    highContrast: _read(K_HC, '0') === '1',
    largeText: _read(K_LT, '0') === '1',
    colorBlind: _read(K_CB, '0') === '1',
    captions: _read(K_CAPS, '0') === '1',
  };
}

// Apply body-class side effects (idempotent — safe to call repeatedly).
function _applyBodyFlags() {
  const s = getSnapshot();
  document.body.classList.toggle('reduced-motion', s.reducedMotion);
  document.body.classList.toggle('high-contrast', s.highContrast);
  document.body.classList.toggle('show-fps', s.showFps);
  document.body.classList.toggle('large-text', s.largeText);
  // Hub uses class `colorblind` (no hyphen) and games use `color-blind`.
  // Toggle BOTH so any hub or game CSS rule applies uniformly.
  document.body.classList.toggle('color-blind', s.colorBlind);
  document.body.classList.toggle('colorblind', s.colorBlind);
  document.body.classList.toggle('captions', s.captions);
}

// Apply body flags as soon as the DOM is ready, even BEFORE the game opts in
// to `createSettingsMenu()`. Ensures the saved highContrast / largeText pref
// is honored from the first paint on every page (including the hub) rather
// than flickering after the gear button mounts.
if (typeof document !== 'undefined') {
  const apply = () => { try { _applyBodyFlags(); } catch {} };
  if (document.body) apply();
  else document.addEventListener('DOMContentLoaded', apply, { once: true });
}

// === Live-region announcer (for SR users) ====================================
// One singleton off-screen <div role="status" aria-live="polite"> that any
// module can write to via announce('Wave 3 starting'). Pattern is intentional:
// we don't want to add aria-live to every HUD element (chatty + duplicates).
let _liveEl = null;
function _ensureLive() {
  if (_liveEl) return _liveEl;
  _liveEl = document.createElement('div');
  _liveEl.id = 'wg-live-region';
  _liveEl.setAttribute('role', 'status');
  _liveEl.setAttribute('aria-live', 'polite');
  _liveEl.setAttribute('aria-atomic', 'true');
  // visually-hidden but available to assistive tech
  _liveEl.style.cssText = 'position:fixed;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;left:0;top:0;pointer-events:none;';
  document.body.appendChild(_liveEl);
  return _liveEl;
}
export function announce(text) {
  if (!text) return;
  const el = _ensureLive();
  // Flush + re-write so SRs re-announce identical text (else they'd be silent).
  el.textContent = '';
  setTimeout(() => { el.textContent = String(text); }, 30);
}

// === Captions ================================================================
// A bottom-center subtitle bar that paints when CAPTIONS toggle is on.
// `caption('MONSTER GROWL', 1200)` — auto-fades; safe to call when off (no-op
// visually, but always mirrors to the live region so SR users hear cues).
let _capEl = null;
let _capHide = 0;
function _ensureCaptionEl() {
  if (_capEl) return _capEl;
  _capEl = document.createElement('div');
  _capEl.id = 'wg-caption';
  _capEl.setAttribute('aria-hidden', 'true');  // live region handles SR; this is purely visual
  document.body.appendChild(_capEl);
  return _capEl;
}
export function caption(text, durationMs = 1500) {
  if (!text) return;
  // Always mirror to the SR live region so even players with captions off
  // who use a screen reader get the audio cue announced.
  announce(text);
  if (!getSnapshot().captions) return;
  const el = _ensureCaptionEl();
  el.textContent = String(text);
  el.classList.add('is-shown');
  clearTimeout(_capHide);
  _capHide = setTimeout(() => { el.classList.remove('is-shown'); }, Math.max(400, durationMs));
}

// === FPS meter (lazily mounted when toggled on) ==============================
let _fpsEl = null, _fpsRaf = 0, _fpsFrames = 0, _fpsAt = 0;
function _ensureFpsMounted(show) {
  if (show) {
    if (!_fpsEl) {
      _fpsEl = document.createElement('div');
      _fpsEl.id = 'wg-fps-meter';
      document.body.appendChild(_fpsEl);
    }
    _fpsEl.style.display = 'block';
    const tick = (t) => {
      _fpsFrames++;
      if (t - _fpsAt >= 500) {
        const fps = Math.round((_fpsFrames * 1000) / (t - _fpsAt));
        _fpsEl.textContent = fps + ' FPS';
        _fpsFrames = 0; _fpsAt = t;
      }
      _fpsRaf = requestAnimationFrame(tick);
    };
    _fpsAt = performance.now();
    _fpsRaf = requestAnimationFrame(tick);
  } else {
    if (_fpsRaf) cancelAnimationFrame(_fpsRaf); _fpsRaf = 0;
    if (_fpsEl) _fpsEl.style.display = 'none';
  }
}

// === Per-game high-score reset ===============================================
function _resetGameScores(gameId) {
  const keys = [`wg:hs:${gameId}`, `wg:ach:${gameId}`];
  try {
    const activeId = localStorage.getItem('wg:profiles:active');
    if (activeId) keys.push(`wg:p:${activeId}:hs:${gameId}`);
    // Also scrub for ALL profiles, since the menu says "this game only" — we
    // don't want the score to magically reappear when switching profiles.
    const raw = localStorage.getItem('wg:profiles:list');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) for (const p of list) keys.push(`wg:p:${p.id}:hs:${gameId}`);
    }
  } catch {}
  for (const k of keys) { try { localStorage.removeItem(k); } catch {} }
}

// === Focus trap helper (used by the settings modal) ==========================
// Returns a teardown fn that detaches the keydown listener AND restores focus
// to the opener element (if it's still in the DOM).
function _trapFocus(panelEl, opener) {
  const SELECTOR = [
    'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(panelEl.querySelectorAll(SELECTOR))
      .filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) { e.preventDefault(); panelEl.focus(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  panelEl.addEventListener('keydown', onKey);
  return () => {
    panelEl.removeEventListener('keydown', onKey);
    if (opener && document.contains(opener) && typeof opener.focus === 'function') {
      try { opener.focus(); } catch {}
    }
  };
}

// === Styles (idempotent) =====================================================
let _stylesInjected = false;
function _ensureStyles() {
  if (_stylesInjected) return;
  ensureSharedStyles();
  const s = document.createElement('style');
  s.id = 'wg-settings-styles';
  s.textContent = `
    .wg-settings-btn,.wg-help-btn{position:fixed;top:max(12px,env(safe-area-inset-top,12px));z-index:220;width:44px;height:44px;min-width:44px;min-height:44px;border-radius:50%;border:2px solid #4cc9f0;background:rgba(10,7,22,.82);color:#4cc9f0;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s,box-shadow .12s;box-shadow:0 0 12px rgba(76,201,240,.3);-webkit-tap-highlight-color:transparent;font-family:'Press Start 2P',monospace}
    .wg-settings-btn{left:max(12px,env(safe-area-inset-left,12px))}
    .wg-help-btn{left:calc(max(12px,env(safe-area-inset-left,12px)) + 52px);font-size:16px;border-color:#ffd23f;color:#ffd23f;box-shadow:0 0 12px rgba(255,210,63,.3)}
    .wg-settings-btn:hover,.wg-help-btn:hover{transform:scale(1.08)}
    .wg-settings-btn:focus-visible,.wg-help-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}
    .wg-settings-modal{position:fixed;inset:0;z-index:9000;background:rgba(10,7,22,.85);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;font-family:'Press Start 2P',monospace}
    .wg-settings-modal.is-open{opacity:1;pointer-events:auto}
    .wg-settings-panel{background:linear-gradient(135deg,#1a0f2e,#2a1255);border:3px solid #4cc9f0;border-radius:8px;padding:22px 26px;padding-bottom:max(22px,env(safe-area-inset-bottom,22px));width:88vw;max-width:420px;max-height:88vh;max-height:88dvh;overflow:auto;color:#f8f5ff;box-shadow:0 0 0 3px #050310,0 0 40px rgba(76,201,240,.4);position:relative;outline:none}
    /* gameId tag at the very top of the panel so the player always knows
       which game's settings they're editing. */
    .wg-settings-gametag{display:inline-block;font-size:.4rem;letter-spacing:.18em;color:#4cc9f0;background:rgba(76,201,240,.12);border:1px solid #4cc9f0;padding:3px 8px;border-radius:3px;margin:0 0 8px;text-transform:uppercase}
    .wg-settings-panel h2{font-size:.85rem;letter-spacing:.08em;color:#ffd23f;margin:0 0 14px;text-align:center}
    .wg-settings-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;font-size:.5rem;letter-spacing:.06em}
    .wg-settings-row label{flex:1;color:#c8c0e8}
    .wg-settings-row input[type=range]{flex:1;accent-color:#4cc9f0;max-width:180px;outline:none}
    /* Inner-glow on focused slider thumbs (works on -webkit / -moz / standard) */
    .wg-settings-row input[type=range]:focus{filter:drop-shadow(0 0 6px rgba(76,201,240,.85))}
    .wg-settings-row input[type=range]:focus::-webkit-slider-thumb{box-shadow:0 0 0 3px rgba(76,201,240,.35),inset 0 0 6px rgba(255,255,255,.6)}
    .wg-settings-row input[type=range]:focus::-moz-range-thumb{box-shadow:0 0 0 3px rgba(76,201,240,.35),inset 0 0 6px rgba(255,255,255,.6)}
    .wg-settings-row input[type=checkbox]{width:18px;height:18px;accent-color:#4cc9f0;cursor:pointer}
    /* Clear, visible focus ring on every focusable inside the modal. */
    .wg-settings-panel :focus-visible{outline:3px solid #4cc9f0;outline-offset:2px;border-radius:3px}
    .wg-settings-val{font-size:.5rem;color:#4cc9f0;min-width:34px;text-align:right}
    /* Master mute "switch": a 36x18 capsule with a 14x14 puck that slides + tints
       on toggle. Sits beside (and replaces) the plain checkbox visually but the
       input remains for accessibility / keyboard nav. */
    .wg-mute-switch{position:relative;display:inline-block;width:36px;height:18px;flex:0 0 auto}
    .wg-mute-switch input{position:absolute;inset:0;opacity:0;width:100%;height:100%;margin:0;cursor:pointer;z-index:2}
    .wg-mute-switch i{position:absolute;inset:0;background:rgba(0,0,0,.55);border:2px solid #2a2540;border-radius:999px;transition:background .18s,border-color .18s}
    .wg-mute-switch i::after{content:'';position:absolute;top:1px;left:1px;width:12px;height:12px;border-radius:50%;background:#c8c0e8;box-shadow:0 1px 2px rgba(0,0,0,.45);transition:transform .22s cubic-bezier(.34,1.56,.64,1),background .18s}
    .wg-mute-switch input:checked + i{background:rgba(255,58,58,.18);border-color:#ff3a3a}
    .wg-mute-switch input:checked + i::after{transform:translateX(18px);background:#ff3a3a;box-shadow:0 0 8px rgba(255,58,58,.65)}
    .wg-mute-switch input:focus + i{box-shadow:0 0 0 2px rgba(76,201,240,.45)}
    body.reduced-motion .wg-mute-switch i::after{transition:none!important}
    .wg-settings-btnrow{display:flex;flex-direction:column;gap:8px;margin-top:14px}
    .wg-settings-action{font-size:.55rem;letter-spacing:.06em;padding:10px 12px;border-radius:6px;cursor:pointer;background:rgba(0,0,0,.4);color:#f8f5ff;border:2px solid #4cc9f0;font-family:inherit;transition:transform .1s}
    .wg-settings-action:hover{transform:translateY(-1px)}
    /* More menacing reset button: pure-red border + warning glow (was #ff3a3a) */
    .wg-settings-action--danger{border-color:#ff0044;color:#ff8080;background:rgba(255,0,68,.06);box-shadow:0 0 0 0 rgba(255,0,68,0);transition:transform .1s,background .15s,box-shadow .2s,color .15s}
    .wg-settings-action--danger:hover{background:linear-gradient(180deg,rgba(255,48,80,.25),rgba(255,0,68,.15));color:#fff;box-shadow:0 0 16px rgba(255,0,68,.55);border-color:#ff3050}
    .wg-settings-close{position:absolute;top:8px;right:10px;background:transparent;color:#c8c0e8;border:0;font-size:1.1rem;cursor:pointer;font-family:inherit;padding:4px 8px}
    .wg-settings-close:hover{color:#fff}
    .wg-settings-hr{border:0;border-top:1px solid rgba(76,201,240,.25);margin:14px 0 6px}
    .wg-settings-sec{font-size:.42rem;letter-spacing:.18em;color:#8a90b1;margin:14px 0 2px;text-transform:uppercase}
    .wg-settings-help{font-size:.45rem;color:#8a90b1;letter-spacing:.04em;text-align:center;margin:8px 0 0;line-height:1.4}
    #wg-fps-meter{position:fixed;bottom:calc(10px + env(safe-area-inset-bottom,0));right:calc(10px + env(safe-area-inset-right,0));z-index:215;background:rgba(10,7,22,.82);color:#5ef38c;border:1px solid #5ef38c;padding:4px 8px;border-radius:4px;font-family:'Press Start 2P',monospace;font-size:.5rem;letter-spacing:.06em;pointer-events:none;display:none}
    body.reduced-motion .wg-settings-modal,body.reduced-motion #wg-fps-meter{transition:none!important;animation:none!important}
    /* === HIGH CONTRAST mode ===
       Pure-black backgrounds + white text + thick outlines on every focusable.
       Only kicks in when body.high-contrast is set. */
    body.high-contrast{color:#fff !important;background:#000 !important}
    body.high-contrast .wg-settings-panel{background:#000 !important;border-color:#fff !important;box-shadow:0 0 0 3px #fff,0 0 0 6px #000 !important}
    body.high-contrast .wg-settings-panel h2,
    body.high-contrast .wg-settings-row,
    body.high-contrast .wg-settings-row label,
    body.high-contrast .wg-settings-val,
    body.high-contrast .wg-settings-help,
    body.high-contrast .wg-settings-sec,
    body.high-contrast .wg-settings-gametag{color:#fff !important;text-shadow:1px 1px 0 #000,-1px 1px 0 #000,1px -1px 0 #000,-1px -1px 0 #000 !important}
    body.high-contrast .wg-settings-gametag{background:#000 !important;border-color:#fff !important}
    body.high-contrast .wg-settings-action,
    body.high-contrast .wg-settings-btn,
    body.high-contrast .wg-help-btn{outline:2px solid #fff;color:#fff !important;background:#000 !important;border-color:#fff !important}
    body.high-contrast .wg-settings-action--danger{background:#600 !important;border-color:#fff !important;color:#fff !important}
    body.high-contrast :focus-visible{outline:4px solid #ff0 !important;outline-offset:3px !important}
    body.high-contrast .wg-settings-row input[type=range]{accent-color:#fff !important}
    /* === LARGE TEXT mode ===
       Bumps every font-size by 1.25× via a relative cascade so layouts still
       breathe instead of clipping. */
    body.large-text{font-size:1.25em}
    body.large-text .hud-card,body.large-text .wg-feed__item,body.large-text .wg-grade,
    body.large-text .wg-settings-panel,body.large-text #tutorial-tip,body.large-text #wg-caption,
    body.large-text .overlay__panel{font-size:1.18em}
    /* === COLOR-BLIND mode ===
       Shape supplements colour. Where red/green is meaningful we add a
       distinguishing pseudo-glyph or border style. Class is hyphenated for
       clarity but legacy \`colorblind\` is also toggled (see _applyBodyFlags). */
    body.color-blind .wg-feed__item[style*="#5ef38c"]::before,
    body.color-blind .wg-feed__item[style*="rgb(94, 243, 140)"]::before{content:"\\25A0 "}
    body.color-blind .wg-feed__item[style*="#ff3a3a"]::before,
    body.color-blind .wg-feed__item[style*="rgb(255, 58, 58)"]::before{content:"\\25B2 "}
    body.color-blind .wg-feed__item[style*="#ffd23f"]::before,
    body.color-blind .wg-feed__item[style*="rgb(255, 210, 63)"]::before{content:"\\2605 "}
    body.color-blind .wg-grade__letter{text-decoration:underline}
    /* === CAPTIONS overlay ===
       Pinned bottom-centre; hidden until caption() fires. */
    #wg-caption{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0));transform:translateX(-50%) translateY(8px);z-index:230;padding:8px 16px;background:rgba(0,0,0,.85);border:2px solid #ffd23f;border-radius:6px;color:#ffd23f;font-family:'Press Start 2P',monospace;font-size:.6rem;letter-spacing:.1em;text-shadow:0 1px 0 #000;max-width:90vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s,transform .2s;box-shadow:0 0 16px rgba(255,210,63,.4)}
    #wg-caption.is-shown{opacity:1;transform:translateX(-50%) translateY(0)}
    body.reduced-motion #wg-caption{transition:opacity .08s linear}
    body.high-contrast #wg-caption{background:#000 !important;color:#fff !important;border-color:#fff !important}
  `;
  document.head.appendChild(s);
  _stylesInjected = true;
}

// === Constructor =============================================================
let _activeInstance = null;
export function createSettingsMenu({ gameId, getControlsHelp = () => '' } = {}) {
  if (!gameId) throw new Error('createSettingsMenu: gameId required');
  if (_activeInstance) _activeInstance.destroy();
  _ensureStyles();
  _ensureLive();
  _applyBodyFlags();
  _ensureFpsMounted(getSnapshot().showFps);
  mountVisualPolish();

  const gearBtn = document.createElement('button');
  gearBtn.type = 'button';
  gearBtn.className = 'wg-settings-btn';
  gearBtn.setAttribute('aria-label', 'Open settings');
  gearBtn.setAttribute('aria-haspopup', 'dialog');
  gearBtn.title = 'Settings';
  gearBtn.textContent = '⚙';

  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'wg-help-btn';
  helpBtn.setAttribute('aria-label', 'Show controls help');
  helpBtn.title = 'Controls help (?)';
  helpBtn.textContent = '?';

  document.body.appendChild(gearBtn);
  document.body.appendChild(helpBtn);

  // === Modal ===
  const modal = document.createElement('div');
  modal.className = 'wg-settings-modal';
  // Escape the gameId so a hostile string can't slip into the modal markup.
  const _gid = String(gameId).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
  modal.innerHTML = `
    <div class="wg-settings-panel" role="dialog" aria-modal="true" aria-labelledby="wg-settings-title" tabindex="-1">
      <button class="wg-settings-close" aria-label="Close settings">✖</button>
      <div style="text-align:center;"><span class="wg-settings-gametag" aria-label="Game">${_gid}</span></div>
      <h2 id="wg-settings-title">SETTINGS</h2>
      <div class="wg-settings-sec">Audio</div>
      <div class="wg-settings-row">
        <label for="wg-set-music">MUSIC</label>
        <input id="wg-set-music" type="range" min="0" max="100" step="1" aria-valuemin="0" aria-valuemax="100">
        <span class="wg-settings-val" id="wg-set-music-val" aria-hidden="true">70</span>
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-sfx">SFX</label>
        <input id="wg-set-sfx" type="range" min="0" max="100" step="1" aria-valuemin="0" aria-valuemax="100">
        <span class="wg-settings-val" id="wg-set-sfx-val" aria-hidden="true">70</span>
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-mute">MUTE ALL</label>
        <span class="wg-mute-switch"><input id="wg-set-mute" type="checkbox" aria-label="Mute all audio"><i></i></span>
      </div>
      <hr class="wg-settings-hr">
      <div class="wg-settings-sec">Accessibility</div>
      <div class="wg-settings-row">
        <label for="wg-set-rm">REDUCED MOTION</label>
        <input id="wg-set-rm" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-hc">HIGH CONTRAST</label>
        <input id="wg-set-hc" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-lt">LARGE TEXT</label>
        <input id="wg-set-lt" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-cb">COLOR-BLIND AID</label>
        <input id="wg-set-cb" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-caps">CAPTIONS</label>
        <input id="wg-set-caps" type="checkbox">
      </div>
      <hr class="wg-settings-hr">
      <div class="wg-settings-sec">Visuals</div>
      <div class="wg-settings-row">
        <label for="wg-set-fps">SHOW FPS</label>
        <input id="wg-set-fps" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-crt">CRT SCANLINES</label>
        <input id="wg-set-crt" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-shake">SHAKE</label>
        <input id="wg-set-shake" type="range" min="0" max="150" step="10" aria-valuemin="0" aria-valuemax="150">
        <span class="wg-settings-val" id="wg-set-shake-val" aria-hidden="true">100</span>
      </div>
      <div class="wg-settings-btnrow">
        <button class="wg-settings-action" id="wg-set-controls" type="button">CONTROLS</button>
        <button class="wg-settings-action wg-settings-action--danger" id="wg-set-reset" type="button">RESET HIGH SCORES (this game)</button>
      </div>
      <p class="wg-settings-help">Press M to mute &middot; ? for help &middot; Esc to close</p>
    </div>
  `;
  document.body.appendChild(modal);

  // Hydrate from storage
  const panel = modal.querySelector('.wg-settings-panel');
  const $music = modal.querySelector('#wg-set-music');
  const $sfx = modal.querySelector('#wg-set-sfx');
  const $mute = modal.querySelector('#wg-set-mute');
  const $rm = modal.querySelector('#wg-set-rm');
  const $fps = modal.querySelector('#wg-set-fps');
  const $hc = modal.querySelector('#wg-set-hc');
  const $lt = modal.querySelector('#wg-set-lt');
  const $cb = modal.querySelector('#wg-set-cb');
  const $caps = modal.querySelector('#wg-set-caps');
  const $musicVal = modal.querySelector('#wg-set-music-val');
  const $sfxVal = modal.querySelector('#wg-set-sfx-val');
  const $crt = modal.querySelector('#wg-set-crt');
  const $shake = modal.querySelector('#wg-set-shake');
  const $shakeVal = modal.querySelector('#wg-set-shake-val');
  const sync = () => {
    const s = getSnapshot();
    $music.value = s.music; $musicVal.textContent = s.music; $music.setAttribute('aria-valuenow', s.music);
    $sfx.value = s.sfx; $sfxVal.textContent = s.sfx; $sfx.setAttribute('aria-valuenow', s.sfx);
    $mute.checked = s.muted;
    $rm.checked = s.reducedMotion;
    $fps.checked = s.showFps;
    $hc.checked = s.highContrast;
    $lt.checked = s.largeText;
    $cb.checked = s.colorBlind;
    $caps.checked = s.captions;
    if ($crt) $crt.checked = isCrtOn();
    if ($shake) {
      const sm = Math.round(getShakeMul() * 100);
      $shake.value = sm; $shakeVal.textContent = sm; $shake.setAttribute('aria-valuenow', sm);
    }
  };
  sync();

  const onMusic = (e) => { _write(K_MUSIC, e.target.value); $musicVal.textContent = e.target.value; $music.setAttribute('aria-valuenow', e.target.value); _emit(); };
  const onSfx = (e) => { _write(K_SFX, e.target.value); $sfxVal.textContent = e.target.value; $sfx.setAttribute('aria-valuenow', e.target.value); _emit(); };
  const onMute = (e) => { _write(K_MUTED, e.target.checked ? '1' : '0'); _emit(); announce(e.target.checked ? 'Audio muted' : 'Audio unmuted'); };
  const onRm = (e) => { _write(K_RM, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); announce(e.target.checked ? 'Reduced motion on' : 'Reduced motion off'); };
  const onFps = (e) => { _write(K_FPS, e.target.checked ? '1' : '0'); _applyBodyFlags(); _ensureFpsMounted(e.target.checked); _emit(); };
  const onHc = (e) => { _write(K_HC, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); announce(e.target.checked ? 'High contrast on' : 'High contrast off'); };
  const onLt = (e) => { _write(K_LT, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); announce(e.target.checked ? 'Large text on' : 'Large text off'); };
  const onCb = (e) => { _write(K_CB, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); announce(e.target.checked ? 'Color-blind aid on' : 'Color-blind aid off'); };
  const onCaps = (e) => { _write(K_CAPS, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); announce(e.target.checked ? 'Captions on' : 'Captions off'); if (e.target.checked) caption('CAPTIONS READY', 1400); };
  const onCrt = (e) => { setCrtOn(!!e.target.checked); };
  const onShake = (e) => { setShakeMul(e.target.value); $shakeVal.textContent = e.target.value; $shake.setAttribute('aria-valuenow', e.target.value); };
  $music.addEventListener('input', onMusic);
  $sfx.addEventListener('input', onSfx);
  $mute.addEventListener('change', onMute);
  $rm.addEventListener('change', onRm);
  $fps.addEventListener('change', onFps);
  $hc.addEventListener('change', onHc);
  $lt.addEventListener('change', onLt);
  $cb.addEventListener('change', onCb);
  $caps.addEventListener('change', onCaps);
  if ($crt) $crt.addEventListener('change', onCrt);
  if ($shake) $shake.addEventListener('input', onShake);

  modal.querySelector('#wg-set-controls').addEventListener('click', () => {
    let txt = '';
    try { txt = getControlsHelp() || ''; } catch {}
    showTip(txt || 'No controls help available.', 6500);
    close();
  });
  modal.querySelector('#wg-set-reset').addEventListener('click', () => {
    if (!confirm('Reset high scores for THIS GAME only? Profiles are NOT affected.')) return;
    _resetGameScores(gameId);
    alert('High scores reset for ' + gameId + '.');
    announce('High scores reset');
  });

  // === Open / close with focus management + focus trap =======================
  let _opener = null;
  let _detachTrap = null;
  const open = (openerEl) => {
    sync();
    _opener = openerEl || document.activeElement || gearBtn;
    modal.classList.add('is-open');
    document.body.classList.add('wg-modal-open');
    // Defer focus so the modal becomes "visible" first (transition + screen
    // readers expect a focused dialog announcement).
    requestAnimationFrame(() => {
      const first = panel.querySelector('input,button,select,a[href],[tabindex]:not([tabindex="-1"])');
      if (first) try { first.focus(); } catch {}
      else panel.focus();
    });
    _detachTrap = _trapFocus(panel, _opener);
    announce('Settings opened');
  };
  const close = () => {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('wg-modal-open');
    if (_detachTrap) { _detachTrap(); _detachTrap = null; }
    _opener = null;
    announce('Settings closed');
  };
  modal.querySelector('.wg-settings-close').addEventListener('click', () => close());
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  gearBtn.addEventListener('click', () => open(gearBtn));
  helpBtn.addEventListener('click', () => {
    let txt = '';
    try { txt = getControlsHelp() || ''; } catch {}
    showTip(txt || 'No help available.', 6500);
  });

  // Mute hotkey (M), ? hotkey for help, Esc closes
  const onKey = (e) => {
    if (e.repeat) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      // Inside text inputs, still allow Escape to close.
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        close();
        return;
      }
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      const s = getSnapshot();
      _write(K_MUTED, s.muted ? '0' : '1');
      _emit();
      sync();
      announce(s.muted ? 'Audio unmuted' : 'Audio muted');
    } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      // Global "?" opens controls help anywhere
      e.preventDefault();
      helpBtn.click();
    } else if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      close();
    }
  };
  window.addEventListener('keydown', onKey);

  const inst = {
    open, close,
    destroy() {
      window.removeEventListener('keydown', onKey);
      if (_detachTrap) { try { _detachTrap(); } catch {} _detachTrap = null; }
      gearBtn.remove(); helpBtn.remove(); modal.remove();
      if (_activeInstance === inst) _activeInstance = null;
    },
    element: gearBtn,
  };
  _activeInstance = inst;
  return inst;
}
