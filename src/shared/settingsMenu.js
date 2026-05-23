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
  };
}

// Apply body-class side effects (idempotent — safe to call repeatedly).
function _applyBodyFlags() {
  const s = getSnapshot();
  document.body.classList.toggle('reduced-motion', s.reducedMotion);
  document.body.classList.toggle('high-contrast', s.highContrast);
  document.body.classList.toggle('show-fps', s.showFps);
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

// === Styles (idempotent) =====================================================
let _stylesInjected = false;
function _ensureStyles() {
  if (_stylesInjected) return;
  ensureSharedStyles();
  const s = document.createElement('style');
  s.id = 'wg-settings-styles';
  s.textContent = `
    .wg-settings-btn,.wg-help-btn{position:fixed;top:calc(12px + env(safe-area-inset-top,0));z-index:220;width:40px;height:40px;border-radius:50%;border:2px solid #4cc9f0;background:rgba(10,7,22,.82);color:#4cc9f0;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s,box-shadow .12s;box-shadow:0 0 12px rgba(76,201,240,.3);-webkit-tap-highlight-color:transparent;font-family:'Press Start 2P',monospace}
    .wg-settings-btn{left:calc(12px + env(safe-area-inset-left,0))}
    .wg-help-btn{left:calc(60px + env(safe-area-inset-left,0));font-size:16px;border-color:#ffd23f;color:#ffd23f;box-shadow:0 0 12px rgba(255,210,63,.3)}
    .wg-settings-btn:hover,.wg-help-btn:hover{transform:scale(1.08)}
    .wg-settings-modal{position:fixed;inset:0;z-index:9000;background:rgba(10,7,22,.85);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s;font-family:'Press Start 2P',monospace}
    .wg-settings-modal.is-open{opacity:1;pointer-events:auto}
    .wg-settings-panel{background:linear-gradient(135deg,#1a0f2e,#2a1255);border:3px solid #4cc9f0;border-radius:8px;padding:22px 26px;width:88vw;max-width:420px;max-height:88vh;overflow:auto;color:#f8f5ff;box-shadow:0 0 0 3px #050310,0 0 40px rgba(76,201,240,.4);position:relative}
    .wg-settings-panel h2{font-size:.85rem;letter-spacing:.08em;color:#ffd23f;margin:0 0 14px;text-align:center}
    .wg-settings-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;font-size:.5rem;letter-spacing:.06em}
    .wg-settings-row label{flex:1;color:#c8c0e8}
    .wg-settings-row input[type=range]{flex:1;accent-color:#4cc9f0;max-width:180px}
    .wg-settings-row input[type=checkbox]{width:18px;height:18px;accent-color:#4cc9f0;cursor:pointer}
    .wg-settings-val{font-size:.5rem;color:#4cc9f0;min-width:34px;text-align:right}
    .wg-settings-btnrow{display:flex;flex-direction:column;gap:8px;margin-top:14px}
    .wg-settings-action{font-size:.55rem;letter-spacing:.06em;padding:10px 12px;border-radius:6px;cursor:pointer;background:rgba(0,0,0,.4);color:#f8f5ff;border:2px solid #4cc9f0;font-family:inherit;transition:transform .1s}
    .wg-settings-action:hover{transform:translateY(-1px)}
    .wg-settings-action--danger{border-color:#ff3a3a;color:#ff8080}
    .wg-settings-action--danger:hover{background:rgba(255,58,58,.15);color:#fff}
    .wg-settings-close{position:absolute;top:8px;right:10px;background:transparent;color:#c8c0e8;border:0;font-size:1.1rem;cursor:pointer;font-family:inherit;padding:4px 8px}
    .wg-settings-close:hover{color:#fff}
    .wg-settings-hr{border:0;border-top:1px solid rgba(76,201,240,.25);margin:14px 0 6px}
    .wg-settings-help{font-size:.45rem;color:#8a90b1;letter-spacing:.04em;text-align:center;margin:8px 0 0;line-height:1.4}
    #wg-fps-meter{position:fixed;bottom:calc(10px + env(safe-area-inset-bottom,0));right:calc(10px + env(safe-area-inset-right,0));z-index:215;background:rgba(10,7,22,.82);color:#5ef38c;border:1px solid #5ef38c;padding:4px 8px;border-radius:4px;font-family:'Press Start 2P',monospace;font-size:.5rem;letter-spacing:.06em;pointer-events:none;display:none}
    body.reduced-motion .wg-settings-modal,body.reduced-motion #wg-fps-meter{transition:none!important;animation:none!important}
    body.high-contrast .wg-settings-panel{border-color:#fff;box-shadow:0 0 0 3px #000}
    body.high-contrast button{outline:1px solid currentColor}
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
  _applyBodyFlags();
  _ensureFpsMounted(getSnapshot().showFps);
  mountVisualPolish();

  const gearBtn = document.createElement('button');
  gearBtn.type = 'button';
  gearBtn.className = 'wg-settings-btn';
  gearBtn.setAttribute('aria-label', 'Open settings');
  gearBtn.title = 'Settings';
  gearBtn.textContent = '⚙';

  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'wg-help-btn';
  helpBtn.setAttribute('aria-label', 'Show controls help');
  helpBtn.title = 'Controls help';
  helpBtn.textContent = '?';

  document.body.appendChild(gearBtn);
  document.body.appendChild(helpBtn);

  // === Modal ===
  const modal = document.createElement('div');
  modal.className = 'wg-settings-modal';
  modal.innerHTML = `
    <div class="wg-settings-panel" role="dialog" aria-label="Settings">
      <button class="wg-settings-close" aria-label="Close">✖</button>
      <h2>SETTINGS</h2>
      <div class="wg-settings-row">
        <label for="wg-set-music">MUSIC</label>
        <input id="wg-set-music" type="range" min="0" max="100" step="1">
        <span class="wg-settings-val" id="wg-set-music-val">70</span>
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-sfx">SFX</label>
        <input id="wg-set-sfx" type="range" min="0" max="100" step="1">
        <span class="wg-settings-val" id="wg-set-sfx-val">70</span>
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-mute">MUTE ALL</label>
        <input id="wg-set-mute" type="checkbox">
      </div>
      <hr class="wg-settings-hr">
      <div class="wg-settings-row">
        <label for="wg-set-rm">REDUCED MOTION</label>
        <input id="wg-set-rm" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-fps">SHOW FPS</label>
        <input id="wg-set-fps" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-hc">HIGH CONTRAST</label>
        <input id="wg-set-hc" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-crt">CRT SCANLINES</label>
        <input id="wg-set-crt" type="checkbox">
      </div>
      <div class="wg-settings-row">
        <label for="wg-set-shake">SHAKE</label>
        <input id="wg-set-shake" type="range" min="0" max="150" step="10">
        <span class="wg-settings-val" id="wg-set-shake-val">100</span>
      </div>
      <div class="wg-settings-btnrow">
        <button class="wg-settings-action" id="wg-set-controls">CONTROLS</button>
        <button class="wg-settings-action wg-settings-action--danger" id="wg-set-reset">RESET HIGH SCORES (this game)</button>
      </div>
      <p class="wg-settings-help">Press M to mute &middot; Settings are saved system-wide</p>
    </div>
  `;
  document.body.appendChild(modal);

  // Hydrate from storage
  const $music = modal.querySelector('#wg-set-music');
  const $sfx = modal.querySelector('#wg-set-sfx');
  const $mute = modal.querySelector('#wg-set-mute');
  const $rm = modal.querySelector('#wg-set-rm');
  const $fps = modal.querySelector('#wg-set-fps');
  const $hc = modal.querySelector('#wg-set-hc');
  const $musicVal = modal.querySelector('#wg-set-music-val');
  const $sfxVal = modal.querySelector('#wg-set-sfx-val');
  const $crt = modal.querySelector('#wg-set-crt');
  const $shake = modal.querySelector('#wg-set-shake');
  const $shakeVal = modal.querySelector('#wg-set-shake-val');
  const sync = () => {
    const s = getSnapshot();
    $music.value = s.music; $musicVal.textContent = s.music;
    $sfx.value = s.sfx; $sfxVal.textContent = s.sfx;
    $mute.checked = s.muted;
    $rm.checked = s.reducedMotion;
    $fps.checked = s.showFps;
    $hc.checked = s.highContrast;
    if ($crt) $crt.checked = isCrtOn();
    if ($shake) { const sm = Math.round(getShakeMul() * 100); $shake.value = sm; $shakeVal.textContent = sm; }
  };
  sync();

  const onMusic = (e) => { _write(K_MUSIC, e.target.value); $musicVal.textContent = e.target.value; _emit(); };
  const onSfx = (e) => { _write(K_SFX, e.target.value); $sfxVal.textContent = e.target.value; _emit(); };
  const onMute = (e) => { _write(K_MUTED, e.target.checked ? '1' : '0'); _emit(); };
  const onRm = (e) => { _write(K_RM, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); };
  const onFps = (e) => { _write(K_FPS, e.target.checked ? '1' : '0'); _applyBodyFlags(); _ensureFpsMounted(e.target.checked); _emit(); };
  const onHc = (e) => { _write(K_HC, e.target.checked ? '1' : '0'); _applyBodyFlags(); _emit(); };
  const onCrt = (e) => { setCrtOn(!!e.target.checked); };
  const onShake = (e) => { setShakeMul(e.target.value); $shakeVal.textContent = e.target.value; };
  $music.addEventListener('input', onMusic);
  $sfx.addEventListener('input', onSfx);
  $mute.addEventListener('change', onMute);
  $rm.addEventListener('change', onRm);
  $fps.addEventListener('change', onFps);
  $hc.addEventListener('change', onHc);
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
  });

  const open = () => { sync(); modal.classList.add('is-open'); };
  const close = () => { modal.classList.remove('is-open'); };
  modal.querySelector('.wg-settings-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  gearBtn.addEventListener('click', open);
  helpBtn.addEventListener('click', () => {
    let txt = '';
    try { txt = getControlsHelp() || ''; } catch {}
    showTip(txt || 'No help available.', 6500);
  });

  // Mute hotkey (M) — preserves the existing per-game muscle memory.
  const onKey = (e) => {
    if (e.repeat) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'm' || e.key === 'M') {
      const s = getSnapshot();
      _write(K_MUTED, s.muted ? '0' : '1');
      _emit();
      sync();
    } else if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      close();
    }
  };
  window.addEventListener('keydown', onKey);

  const inst = {
    open, close,
    destroy() {
      window.removeEventListener('keydown', onKey);
      gearBtn.remove(); helpBtn.remove(); modal.remove();
      if (_activeInstance === inst) _activeInstance = null;
    },
    element: gearBtn,
  };
  _activeInstance = inst;
  return inst;
}
