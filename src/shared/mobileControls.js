// =============================================================================
// UNIVERSAL MOBILE CONTROLS — drop-in touch overlay for every game.
//
// Auto-shows only on touch devices (or via forceShow()). Layouts:
//   wasd-mouse    virtual joystick (analog) + tap-to-aim/fire on canvas
//   wasd-only     joystick + right-side action buttons (no aim)
//   dpad-buttons  4-way d-pad + right-side action buttons (synth WASD keys)
//   single-tap    no on-screen movement; just a Back chip + optional buttons
//   platformer    LEFT/RIGHT buttons + big JUMP button (synth A/D + Space)
//   aim-fire      drag-anywhere = aim, second-finger tap = fire, + buttons
//
// The module dispatches REAL `KeyboardEvent`s for d-pad / platformer / extra
// button presses so any game that listens via `addEventListener('keydown')`
// works without modification — that's the easiest integration path.
//
// For analog joystick games (wasd-mouse / aim-fire / wasd-only) call
// `syncKeys(keys)` on a `Set` that the game already uses, OR pass `onMove`
// and read the analog vector directly.
//
// Returns: { destroy, setHidden, forceShow, getMove, syncKeys, vibrate }
// =============================================================================

let _stylesInjected = false;

function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  // -- Sizing rules (Mobile UX Final Pass) ----------------------------------
  // D-pad arrows ≥ 48×48 (was a ratio that could drop below 44px on small
  // phones); joystick uses clamp() so phones get a comfortable 140px+ and
  // tablets get up to 200px (better thumb reach when the device is held
  // sideways). Action buttons enforce a 56px minimum so every tap-target
  // exceeds the 44×44 baseline at any viewport.
  const css = `
.mc-root{position:fixed;inset:0;pointer-events:none;z-index:2000;user-select:none;-webkit-user-select:none;touch-action:none;font-family:'Press Start 2P',monospace;}
.mc-root *{-webkit-touch-callout:none;box-sizing:border-box;}
.mc-root.is-hidden{opacity:0;pointer-events:none!important;}
.mc-root.is-dim{opacity:0.3;}
/* joystick — bottom-left. clamp() picks a comfortable diameter across phones
   (min 140px) and tablets (up to 200px when the viewport is wider). */
.mc-stick{position:fixed;left:calc(20px + env(safe-area-inset-left,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));width:clamp(140px,34vw,170px);height:clamp(140px,34vw,170px);pointer-events:auto;touch-action:none;}
.mc-stick__base{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(76,201,240,.18),rgba(0,0,0,.55) 70%);border:2px solid rgba(76,201,240,.5);box-shadow:0 0 24px rgba(76,201,240,.3),inset 0 0 14px rgba(0,0,0,.5);transition:transform .12s ease;}
.mc-stick__thumb{position:absolute;left:50%;top:50%;width:42%;height:42%;margin-left:-21%;margin-top:-21%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ff3aa1 55%,#7a1450);box-shadow:0 4px 12px rgba(0,0,0,.5),0 0 18px rgba(255,58,161,.6);pointer-events:none;transition:transform .05s linear;}
.mc-stick.is-active .mc-stick__base{border-color:rgba(76,201,240,.95);box-shadow:0 0 30px rgba(76,201,240,.55),inset 0 0 14px rgba(0,0,0,.5);}
/* d-pad (4 arrow buttons) — bottom-left. Diameter clamp keeps tap zone large. */
.mc-dpad{position:fixed;left:calc(20px + env(safe-area-inset-left,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));width:clamp(160px,40vw,190px);height:clamp(160px,40vw,190px);pointer-events:none;}
.mc-dpad__btn{position:absolute;pointer-events:auto;width:34%;height:34%;min-width:48px;min-height:48px;background:rgba(20,20,40,.6);border:2px solid rgba(76,201,240,.6);border-radius:14px;color:#7be9ff;font-size:1.2rem;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent;transition:background .08s,box-shadow .08s,transform .08s;}
.mc-dpad__btn--up{top:0;left:33%;}
.mc-dpad__btn--down{bottom:0;left:33%;}
.mc-dpad__btn--left{left:0;top:33%;}
.mc-dpad__btn--right{right:0;top:33%;}
.mc-dpad__btn.is-active{background:rgba(76,201,240,.5);transform:scale(.9);box-shadow:0 0 22px rgba(76,201,240,.85);color:#fff;}
/* platformer L/R + jump */
.mc-platl,.mc-platr{position:fixed;bottom:calc(24px + env(safe-area-inset-bottom,0px));width:clamp(72px,20vw,100px);height:clamp(72px,20vw,100px);background:rgba(20,20,40,.6);border:2px solid rgba(76,201,240,.6);border-radius:18px;color:#7be9ff;font-size:1.6rem;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;transition:background .08s,box-shadow .08s,transform .08s;}
.mc-platl{left:calc(20px + env(safe-area-inset-left,0px));}
.mc-platr{left:calc(28px + clamp(72px,20vw,100px) + env(safe-area-inset-left,0px));}
.mc-platl.is-active,.mc-platr.is-active{background:rgba(76,201,240,.5);transform:scale(.9);box-shadow:0 0 22px rgba(76,201,240,.85);color:#fff;}
.mc-jump{position:fixed;right:calc(24px + env(safe-area-inset-right,0px));bottom:calc(60px + env(safe-area-inset-bottom,0px));width:clamp(96px,28vw,140px);height:clamp(96px,28vw,140px);border-radius:50%;background:linear-gradient(180deg,#ffd23f,#c89c20);color:#1a0d05;border:3px solid #fff0a0;font-weight:bold;font-size:1rem;letter-spacing:.05em;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 0 rgba(120,80,0,.8),0 0 24px rgba(255,210,63,.5);transition:box-shadow .08s,transform .08s;}
.mc-jump.is-active{transform:translateY(4px) scale(.95);box-shadow:0 2px 0 rgba(120,80,0,.8),0 0 30px rgba(255,210,63,.9);}
/* action buttons stack — bottom-right. min 56×56 so every tap target clears 44px. */
.mc-actions{position:fixed;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column-reverse;gap:10px;pointer-events:none;align-items:flex-end;}
.mc-btn{pointer-events:auto;min-width:clamp(56px,20vw,86px);min-height:clamp(56px,20vw,86px);padding:4px 8px;border-radius:18px;background:rgba(30,10,30,.65);border:2px solid #ff3aa1;color:#ffd2eb;font-family:'Press Start 2P',monospace;font-size:.55rem;letter-spacing:.05em;text-align:center;line-height:1.1;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 0 #5a0040,0 0 14px rgba(255,58,161,.35);transition:transform .08s,box-shadow .08s,background .08s;}
.mc-btn.is-active{transform:translateY(2px) scale(.9);background:rgba(255,58,161,.45);box-shadow:0 1px 0 #5a0040,0 0 28px rgba(255,58,161,1);color:#fff;}
.mc-btn--wide{min-width:clamp(96px,28vw,120px);}
/* fire button (aim-fire layout) — large, bottom-right, like jump */
.mc-fire{position:fixed;right:calc(24px + env(safe-area-inset-right,0px));bottom:calc(60px + env(safe-area-inset-bottom,0px));width:clamp(96px,26vw,130px);height:clamp(96px,26vw,130px);border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8,#ff3a3a 60%,#7a1414);color:#fff;border:3px solid #ffb0b0;font-weight:bold;font-size:.85rem;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 0 #5a0808,0 0 24px rgba(255,58,58,.55);transition:transform .08s,box-shadow .08s;}
.mc-fire.is-active{transform:translateY(4px) scale(.95);box-shadow:0 2px 0 #5a0808,0 0 30px rgba(255,58,58,.95);}
/* back chip — min 44×44 hit area via pseudo-element padding */
.mc-back{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));padding:10px 14px;min-width:44px;min-height:44px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid #4cc9f0;color:#7be9ff;font-family:'Press Start 2P',monospace;font-size:.55rem;text-decoration:none;pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;transition:opacity .4s ease;}
/* mute chip — top-right, sized 44×44 (was 38) */
.mc-mute{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));width:44px;height:44px;min-width:44px;min-height:44px;border-radius:50%;background:rgba(0,0,0,.6);border:1px solid #4cc9f0;color:#fff;font-size:1.1rem;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:opacity .4s ease;}
/* aim/fire — drag indicator on aim layouts (invisible by default) */
.mc-aim-pad{position:fixed;inset:0;pointer-events:none;}
/* === Tutorial bubble — mobile-only first-time hints === */
.mc-tut{position:fixed;left:50%;bottom:calc(220px + env(safe-area-inset-bottom,0px));transform:translateX(-50%) translateY(8px);z-index:2100;background:linear-gradient(135deg,#1a0f2e,#2a1255);border:2px solid #ffd23f;border-radius:10px;padding:10px 16px;color:#fff;font-family:'Press Start 2P',monospace;font-size:.5rem;letter-spacing:.06em;text-align:center;max-width:80vw;box-shadow:0 0 0 2px #050310,0 0 24px rgba(255,210,63,.5);opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;line-height:1.5;}
.mc-tut.is-shown{opacity:1;transform:translateX(-50%) translateY(0);}
.mc-tut__step{display:block;margin-top:6px;font-size:.42rem;letter-spacing:.14em;color:#4cc9f0;}
/* === Auto-hide chrome (gear/back/mute) on idle. Fades to .15 opacity after
       5s of no touch activity. Any touch re-shows. */
.mc-root.is-idle .mc-back,
.mc-root.is-idle .mc-mute{opacity:.15;}
.mc-root.is-idle .mc-back:hover,
.mc-root.is-idle .mc-mute:hover{opacity:1;}
/* When mc-root is idle, also fade settings/help/speed chrome (lives outside mc-root) */
body.mc-idle .wg-settings-btn,
body.mc-idle .wg-help-btn,
body.mc-idle .wg-speed-toggle{opacity:.15;transition:opacity .4s ease;}
body.mc-idle .wg-settings-btn:hover,
body.mc-idle .wg-help-btn:hover,
body.mc-idle .wg-speed-toggle:hover{opacity:1;}
/* === Tablet sizing — slightly bigger joysticks for wider thumb reach === */
@media (min-width:768px){
  .mc-stick,.mc-dpad{width:clamp(180px,28vw,220px);height:clamp(180px,28vw,220px);}
  .mc-btn{min-width:clamp(72px,16vw,100px);min-height:clamp(72px,16vw,100px);font-size:.6rem;}
  .mc-jump,.mc-fire{width:clamp(120px,22vw,160px);height:clamp(120px,22vw,160px);font-size:1rem;}
}
@media (max-width:540px){
  .mc-stick,.mc-dpad{width:clamp(130px,34vw,150px);height:clamp(130px,34vw,150px);}
  .mc-jump,.mc-fire{width:clamp(88px,24vw,120px);height:clamp(88px,24vw,120px);font-size:.7rem;}
  .mc-tut{bottom:calc(190px + env(safe-area-inset-bottom,0px));font-size:.45rem;padding:8px 12px;}
}
/* Landscape — pull controls toward bottom corners, narrow joystick */
@media (orientation:landscape) and (min-aspect-ratio:5/3){
  .mc-stick,.mc-dpad{bottom:14px;left:calc(14px + env(safe-area-inset-left,0px));}
  .mc-actions,.mc-jump,.mc-fire{bottom:14px;right:calc(14px + env(safe-area-inset-right,0px));}
  .mc-tut{bottom:calc(180px + env(safe-area-inset-bottom,0px));}
}
@media (hover:hover) and (pointer:fine) and (min-width:1025px){.mc-root:not(.is-force){display:none;}}
`;
  const tag = document.createElement('style');
  tag.id = 'mc-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

function isTouchDevice() {
  // `?touch=1` query string is a manual-override for desktop QA — lets you
  // preview the mobile overlay without dev-tools touch emulation.
  try {
    if (location.search.indexOf('touch=1') !== -1) return true;
    if (location.search.indexOf('touch=0') !== -1) return false;
  } catch {}
  return ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    window.matchMedia('(pointer: coarse)').matches;
}

// Map our high-level button id -> the keyboard key/code most games listen for.
const KEY_MAP = {
  W: { key: 'w', code: 'KeyW' },
  A: { key: 'a', code: 'KeyA' },
  S: { key: 's', code: 'KeyS' },
  D: { key: 'd', code: 'KeyD' },
  ArrowUp:    { key: 'ArrowUp',    code: 'ArrowUp' },
  ArrowDown:  { key: 'ArrowDown',  code: 'ArrowDown' },
  ArrowLeft:  { key: 'ArrowLeft',  code: 'ArrowLeft' },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight' },
  Space:  { key: ' ', code: 'Space' },
  Shift:  { key: 'Shift', code: 'ShiftLeft' },
  E: { key: 'e', code: 'KeyE' },
  Q: { key: 'q', code: 'KeyQ' },
  R: { key: 'r', code: 'KeyR' },
  B: { key: 'b', code: 'KeyB' },
  T: { key: 't', code: 'KeyT' },
  F: { key: 'f', code: 'KeyF' },
  G: { key: 'g', code: 'KeyG' },
  X: { key: 'x', code: 'KeyX' },
  C: { key: 'c', code: 'KeyC' },
};

function dispatchKey(type, spec) {
  const ev = new KeyboardEvent(type, { key: spec.key, code: spec.code, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
}

// Track muted-vibration preference. If the user has muted audio, we also
// reduce haptic noise to a minimum (still emit micro-pulses so blind users
// keep tactile feedback, but skip mid-length ones).
function _vibrateEnabled() {
  try {
    // Respect reduced motion as a privacy/comfort signal — many users who
    // disable motion also dislike sudden vibrations during play.
    if (document.body && document.body.classList.contains('reduced-motion')) return false;
  } catch {}
  return true;
}
function vibrate(ms) {
  if (!_vibrateEnabled()) return;
  try { navigator.vibrate && navigator.vibrate(ms); } catch {}
}
// Variable-strength haptic feedback. Use 'tap' for buttons, 'press' for
// confirmations, 'success' for big wins, 'error' for misses. All respect
// the reduced-motion preference (see _vibrateEnabled).
function hapticFeedback(kind) {
  if (!_vibrateEnabled()) return;
  try {
    if (!navigator.vibrate) return;
    if (kind === 'tap') navigator.vibrate(15);
    else if (kind === 'press') navigator.vibrate(30);
    else if (kind === 'success') navigator.vibrate([30, 60, 30]);
    else if (kind === 'error') navigator.vibrate([80, 40, 80]);
    else if (typeof kind === 'number') navigator.vibrate(kind);
  } catch {}
}

// Add a press handler that fires once on touch-start and once on touch-end,
// with visual press-state. Returns a destroy fn.
function bindPress(el, onDown, onUp) {
  let pressed = false;
  const down = (e) => {
    if (pressed) return;
    pressed = true;
    el.classList.add('is-active');
    vibrate(20);
    onDown && onDown();
    e.preventDefault();
  };
  const up = (e) => {
    if (!pressed) return;
    pressed = false;
    el.classList.remove('is-active');
    onUp && onUp();
    if (e) e.preventDefault();
  };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up, { passive: false });
  el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
  return () => {
    el.removeEventListener('touchstart', down);
    el.removeEventListener('touchend', up);
    el.removeEventListener('touchcancel', up);
    el.removeEventListener('mousedown', down);
    el.removeEventListener('mouseup', up);
    el.removeEventListener('mouseleave', up);
  };
}

function buildJoystick(root, state, onMove, syncKeysRef, cleanupBag) {
  const wrap = document.createElement('div');
  wrap.className = 'mc-stick';
  wrap.innerHTML = '<div class="mc-stick__base"></div><div class="mc-stick__thumb"></div>';
  root.appendChild(wrap);
  const base = wrap.querySelector('.mc-stick__base');
  const thumb = wrap.querySelector('.mc-stick__thumb');
  let activeId = null, cx = 0, cy = 0;
  const dead = 0.18;
  // sync helper — pushes wasd into the optional keys Set + dispatches synth keys
  // for any that just transitioned.
  let prev = { w: false, a: false, s: false, d: false };
  function applyKeys(dx, dy, mag) {
    const target = {
      w: mag > dead && dy < -0.3,
      a: mag > dead && dx < -0.3,
      s: mag > dead && dy > 0.3,
      d: mag > dead && dx > 0.3,
    };
    const ks = syncKeysRef.current;
    for (const k of ['w','a','s','d']) {
      if (target[k] !== prev[k]) {
        if (target[k]) {
          if (ks) {
            if (ks.add) ks.add(k);
            else ks[k] = true;
          }
          dispatchKey('keydown', KEY_MAP[k.toUpperCase()]);
          dispatchKey('keydown', KEY_MAP[{ w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' }[k]]);
        } else {
          if (ks) {
            if (ks.delete) ks.delete(k);
            else ks[k] = false;
          }
          dispatchKey('keyup', KEY_MAP[k.toUpperCase()]);
          dispatchKey('keyup', KEY_MAP[{ w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' }[k]]);
        }
      }
    }
    prev = target;
  }
  function update(clientX, clientY) {
    const rect = base.getBoundingClientRect();
    const R = rect.width / 2;
    cx = rect.left + R; cy = rect.top + R;
    let dx = clientX - cx, dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > R) { dx = dx / dist * R; dy = dy / dist * R; }
    thumb.style.transform = `translate(${dx}px,${dy}px)`;
    const nx = dx / R, ny = dy / R;
    const mag = Math.hypot(nx, ny);
    if (mag < dead) {
      state.move.x = 0; state.move.y = 0; state.move.mag = 0;
      applyKeys(0, 0, 0);
    } else {
      const s = (mag - dead) / (1 - dead);
      state.move.x = nx / mag * s;
      state.move.y = ny / mag * s;
      state.move.mag = s;
      applyKeys(nx, ny, mag);
    }
    if (onMove) onMove(state.move.x, state.move.y, state.move.mag);
    wrap.classList.add('is-active');
  }
  function reset() {
    activeId = null;
    thumb.style.transform = 'translate(0,0)';
    state.move.x = 0; state.move.y = 0; state.move.mag = 0;
    applyKeys(0, 0, 0);
    if (onMove) onMove(0, 0, 0);
    wrap.classList.remove('is-active');
  }
  const start = (e) => {
    if (activeId !== null) return;
    const t = e.changedTouches[0];
    activeId = t.identifier;
    update(t.clientX, t.clientY);
    e.preventDefault();
  };
  const move = (e) => {
    for (const t of e.changedTouches) if (t.identifier === activeId) {
      update(t.clientX, t.clientY); e.preventDefault(); return;
    }
  };
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === activeId) {
      reset(); e.preventDefault(); return;
    }
  };
  wrap.addEventListener('touchstart', start, { passive: false });
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end, { passive: false });
  document.addEventListener('touchcancel', end, { passive: false });
  // Record removers so destroy() can untie these document-level listeners.
  if (cleanupBag) {
    cleanupBag.push(() => document.removeEventListener('touchmove', move));
    cleanupBag.push(() => document.removeEventListener('touchend', end));
    cleanupBag.push(() => document.removeEventListener('touchcancel', end));
  }
  return wrap;
}

function buildDpad(root, state, syncKeysRef, onButton) {
  const wrap = document.createElement('div');
  wrap.className = 'mc-dpad';
  const dirs = [
    { d: 'up',    keys: ['W', 'ArrowUp'],    label: '▲' },
    { d: 'down',  keys: ['S', 'ArrowDown'],  label: '▼' },
    { d: 'left',  keys: ['A', 'ArrowLeft'],  label: '◀' },
    { d: 'right', keys: ['D', 'ArrowRight'], label: '▶' },
  ];
  for (const dir of dirs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mc-dpad__btn mc-dpad__btn--${dir.d}`;
    btn.textContent = dir.label;
    wrap.appendChild(btn);
    bindPress(btn,
      () => {
        const ks = syncKeysRef.current;
        for (const k of dir.keys) {
          const spec = KEY_MAP[k];
          if (ks) {
            if (ks.add) ks.add(spec.key.toLowerCase());
            else ks[spec.key.toLowerCase()] = true;
          }
          dispatchKey('keydown', spec);
        }
        if (onButton) onButton(dir.d, true);
      },
      () => {
        const ks = syncKeysRef.current;
        for (const k of dir.keys) {
          const spec = KEY_MAP[k];
          if (ks) {
            if (ks.delete) ks.delete(spec.key.toLowerCase());
            else ks[spec.key.toLowerCase()] = false;
          }
          dispatchKey('keyup', spec);
        }
        if (onButton) onButton(dir.d, false);
      });
  }
  root.appendChild(wrap);
  return wrap;
}

function buildPlatformer(root, syncKeysRef) {
  const left = document.createElement('button');
  left.type = 'button';
  left.className = 'mc-platl';
  left.textContent = '◀';
  const right = document.createElement('button');
  right.type = 'button';
  right.className = 'mc-platr';
  right.textContent = '▶';
  const jump = document.createElement('button');
  jump.type = 'button';
  jump.className = 'mc-jump';
  jump.textContent = 'JUMP';
  root.appendChild(left); root.appendChild(right); root.appendChild(jump);
  const bindDir = (el, keys) => bindPress(el,
    () => {
      const ks = syncKeysRef.current;
      for (const k of keys) {
        const spec = KEY_MAP[k];
        if (ks) {
          if (ks.add) ks.add(spec.key.toLowerCase());
          else ks[spec.key.toLowerCase()] = true;
        }
        dispatchKey('keydown', spec);
      }
    },
    () => {
      const ks = syncKeysRef.current;
      for (const k of keys) {
        const spec = KEY_MAP[k];
        if (ks) {
          if (ks.delete) ks.delete(spec.key.toLowerCase());
          else ks[spec.key.toLowerCase()] = false;
        }
        dispatchKey('keyup', spec);
      }
    });
  bindDir(left,  ['A', 'ArrowLeft']);
  bindDir(right, ['D', 'ArrowRight']);
  bindDir(jump,  ['Space']);
}

function buildActions(root, buttons, syncKeysRef, onButton) {
  const wrap = document.createElement('div');
  wrap.className = 'mc-actions';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-btn' + (b.wide ? ' mc-btn--wide' : '');
    btn.textContent = b.label || b.id || '?';
    wrap.appendChild(btn);
    const spec = b.key ? KEY_MAP[b.key] : null;
    bindPress(btn,
      () => {
        if (spec) {
          const ks = syncKeysRef.current;
          if (ks) {
            if (ks.add) ks.add(spec.key.toLowerCase());
            else ks[spec.key.toLowerCase()] = true;
          }
          dispatchKey('keydown', spec);
        }
        if (onButton) onButton(b.id, true);
      },
      () => {
        if (spec) {
          const ks = syncKeysRef.current;
          if (ks) {
            if (ks.delete) ks.delete(spec.key.toLowerCase());
            else ks[spec.key.toLowerCase()] = false;
          }
          dispatchKey('keyup', spec);
        }
        if (onButton) onButton(b.id, false);
      });
  }
  root.appendChild(wrap);
}

function buildFireButton(root, state, onFire, getCanvas, onAim, cleanupBag) {
  // Big round FIRE — held = continuous fire
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mc-fire';
  btn.textContent = 'FIRE';
  root.appendChild(btn);
  bindPress(btn,
    () => {
      state.firing = true;
      if (onFire) onFire(true);
      // Synthesize a mousedown on the canvas centre so games that read
      // `canvas.addEventListener('mousedown')` start firing.
      const canvas = getCanvas && getCanvas();
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2, button: 0 }));
      }
    },
    () => {
      state.firing = false;
      if (onFire) onFire(false);
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
  // Aim: drag anywhere on screen (except UI) updates aim pos.
  // We forward `mousemove` events to the canvas so games using
  // `canvas.addEventListener('mousemove')` get free aim with no code changes.
  const handle = (clientX, clientY) => {
    state.aim.x = clientX; state.aim.y = clientY;
    if (onAim) onAim(clientX, clientY);
    const canvas = getCanvas && getCanvas();
    if (canvas) {
      canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }));
    }
  };
  const onTouchStart = (e) => {
    // Ignore touches on our UI elements
    if (e.target.closest && e.target.closest('.mc-root')) return;
    const t = e.touches[0];
    if (t) handle(t.clientX, t.clientY);
  };
  const onTouchMove = (e) => {
    if (e.target.closest && e.target.closest('.mc-root')) return;
    const t = e.touches[0];
    if (t) handle(t.clientX, t.clientY);
  };
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  if (cleanupBag) {
    cleanupBag.push(() => document.removeEventListener('touchstart', onTouchStart));
    cleanupBag.push(() => document.removeEventListener('touchmove', onTouchMove));
  }
}

function buildMuteButton(root) {
  // Find an existing mute button in the page; if present, hide it (we have
  // a unified one). Otherwise, build a small one.
  const existing = document.getElementById('mute-btn');
  if (existing && getComputedStyle(existing).display !== 'none') {
    // Existing mute button works — leave it; just style/hide our copy.
    return null;
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mc-mute';
  let muted = false;
  const storageKey = (window.__MC_MUTE_KEY__ || 'mc:muted');
  muted = localStorage.getItem(storageKey) === '1';
  btn.textContent = muted ? '🔇' : '🔊';
  btn.addEventListener('click', () => {
    muted = !muted;
    btn.textContent = muted ? '🔇' : '🔊';
    localStorage.setItem(storageKey, muted ? '1' : '0');
    // Best-effort sync with a sfx module if it exposes setMuted
    try { window.__mcSfx?.setMuted?.(muted); } catch {}
  });
  root.appendChild(btn);
  return btn;
}

function buildBackChip(root) {
  if (document.querySelector('.mc-back')) return;
  // Only add if there isn't already a back link in the page.
  const existing = document.querySelector('a[href*="../../index.html"], a[href*="../index.html"], a.back-link, a[href="/"]');
  if (existing) return;
  const a = document.createElement('a');
  a.className = 'mc-back';
  a.textContent = '◀ BACK';
  a.href = '../../index.html';
  root.appendChild(a);
}

// --- Mobile tutorial bubbles ------------------------------------------------
// First-time-on-mobile mini-walkthrough. Shows up to 3 short hints, one per
// session, on a 3-step rotation: JOYSTICK → BUTTONS → LONG-PRESS. Dismissed
// permanently after seen once (per device). Safe to call multiple times — only
// runs on touch devices and only if not previously shown.
const TUT_KEY = 'mc:mobile-tut-seen';
function showMobileTutorial(opts = {}) {
  if (typeof document === 'undefined') return;
  if (!isTouchDevice()) return;
  try {
    if (localStorage.getItem(TUT_KEY) === '1' && !opts.force) return;
  } catch {}
  injectStyles();
  const layout = opts.layout || 'wasd-mouse';
  // Per-layout steps so the hint actually matches what's on screen.
  const stepsByLayout = {
    'wasd-mouse':   ['USE THE JOYSTICK TO MOVE', 'TAP THE FIRE BUTTON TO SHOOT', 'LONG-PRESS TO PAUSE'],
    'wasd-only':    ['USE THE JOYSTICK TO MOVE', 'TAP BUTTONS FOR ACTIONS', 'LONG-PRESS TO PAUSE'],
    'aim-fire':     ['JOYSTICK MOVES · DRAG TO AIM', 'TAP THE FIRE BUTTON TO SHOOT', 'LONG-PRESS TO PAUSE'],
    'dpad-buttons': ['TAP ARROWS TO MOVE', 'TAP BUTTONS FOR ACTIONS', 'LONG-PRESS TO PAUSE'],
    'platformer':   ['◀ ▶ TO MOVE', 'TAP JUMP', 'LONG-PRESS TO PAUSE'],
    'single-tap':   ['TAP ANYWHERE TO PLAY', 'LONG-PRESS TO PAUSE'],
  };
  const steps = stepsByLayout[layout] || stepsByLayout['wasd-mouse'];
  const el = document.createElement('div');
  el.className = 'mc-tut';
  document.body.appendChild(el);
  let i = 0;
  const total = steps.length;
  const showStep = () => {
    if (i >= total) {
      el.classList.remove('is-shown');
      setTimeout(() => { try { el.remove(); } catch {} }, 350);
      try { localStorage.setItem(TUT_KEY, '1'); } catch {}
      return;
    }
    el.innerHTML = `${steps[i]}<span class="mc-tut__step">TIP ${i+1} / ${total} · TAP TO SKIP</span>`;
    requestAnimationFrame(() => el.classList.add('is-shown'));
    i++;
    setTimeout(() => {
      el.classList.remove('is-shown');
      setTimeout(showStep, 350);
    }, 3000);
  };
  // Tap dismisses immediately + persists.
  el.addEventListener('click', () => {
    i = total;
    try { localStorage.setItem(TUT_KEY, '1'); } catch {}
    el.classList.remove('is-shown');
    setTimeout(() => { try { el.remove(); } catch {} }, 350);
  });
  // Slight delay so the bubble doesn't compete with the game-start tutorial tip.
  setTimeout(showStep, opts.delayMs ?? 1200);
}

// --- Double-tap dash --------------------------------------------------------
// Detects two quick taps on a movement button (or joystick) and fires a custom
// 'mc:doubletap' event. Games can listen and apply a short speed boost without
// changing their per-frame movement logic.
function _wireDoubleTap(target, dirOrKey) {
  let _lastTap = 0;
  target.addEventListener('touchstart', () => {
    const now = Date.now();
    if (now - _lastTap < 280) {
      hapticFeedback('press');
      try {
        window.dispatchEvent(new CustomEvent('mc:doubletap', { detail: { dir: dirOrKey } }));
      } catch {}
      _lastTap = 0;
    } else {
      _lastTap = now;
    }
  }, { passive: true });
}

export function createMobileControls(opts = {}) {
  const layout = opts.layout || 'wasd-mouse';
  const buttons = Array.isArray(opts.buttons) ? opts.buttons : [];
  const onMove = opts.onMove;
  const onButton = opts.onButton;
  const onAim = opts.onAim;
  const onFire = opts.onFire;
  const getCanvas = opts.getCanvas || (() => document.querySelector('canvas'));
  const forceShow = !!opts.forceShow;

  injectStyles();

  const touch = isTouchDevice();
  const showByDefault = touch || forceShow;

  const root = document.createElement('div');
  root.className = 'mc-root';
  if (forceShow) root.classList.add('is-force');
  if (!showByDefault) root.classList.add('is-hidden');
  document.body.appendChild(root);

  const state = {
    move: { x: 0, y: 0, mag: 0 },
    aim: { x: 0, y: 0 },
    firing: false,
  };

  // Allow callers (and our internal builders) to mutate the keys Set later.
  const syncKeysRef = { current: opts.keys || null };
  // Collect every document-level event listener and observer we add so the
  // destroy() pass can untie them without leaking after a game restart.
  const cleanupBag = [];

  // Build layout
  if (layout === 'wasd-mouse' || layout === 'wasd-only' || layout === 'aim-fire') {
    if (layout !== 'aim-fire') {
      // joystick on left
      buildJoystick(root, state, onMove, syncKeysRef, cleanupBag);
    }
  } else if (layout === 'dpad-buttons') {
    buildDpad(root, state, syncKeysRef, onButton);
  } else if (layout === 'platformer') {
    buildPlatformer(root, syncKeysRef);
  }

  // Action buttons on right (for any layout except platformer which has JUMP)
  if (layout !== 'platformer' && buttons.length > 0) {
    buildActions(root, buttons, syncKeysRef, onButton);
  }

  // Fire button + drag-to-aim
  if (layout === 'aim-fire') {
    buildJoystick(root, state, onMove, syncKeysRef, cleanupBag);  // joystick too — most aim-fire games still move w/ wasd
    buildFireButton(root, state, onFire, getCanvas, onAim, cleanupBag);
  }

  buildMuteButton(root);
  buildBackChip(root);

  // Hide on overlay visibility — auto-detect a `.overlay` not hidden.
  let mo = null;
  function syncOverlay() {
    if (root.classList.contains('is-force')) {
      // Forced visible — never auto-hide.
      root.classList.remove('is-hidden');
      return;
    }
    const anyOverlay = !!document.querySelector('.overlay:not([hidden]):not(.is-hidden)');
    root.classList.toggle('is-hidden', anyOverlay || !touch);
  }
  syncOverlay();
  try {
    mo = new MutationObserver(syncOverlay);
    document.querySelectorAll('.overlay').forEach((el) =>
      mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }));
  } catch {}

  // Re-detect touch after resize (e.g. external keyboard connected on tablet).
  const onResize = () => {
    if (forceShow) return;
    const stillTouch = isTouchDevice();
    if (!stillTouch && window.innerWidth > 1024) {
      root.classList.add('is-hidden');
    } else {
      syncOverlay();
    }
  };
  window.addEventListener('resize', onResize);
  // Release any held synthetic key when the window loses focus (alt-tab, dock
  // pull, push notification banner) so the player isn't left walking forever.
  const onBlur = () => {
    if (!syncKeysRef.current) return;
    const ks = syncKeysRef.current;
    for (const k of ['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright',' ','shift','e','q','r','b','t','f','g','x','c']) {
      try {
        if (ks.delete) ks.delete(k);
        else if (ks[k] != null) ks[k] = false;
      } catch {}
    }
    // Also dispatch keyup for the common direction keys so listeners de-pre-press.
    for (const spec of [KEY_MAP.W, KEY_MAP.A, KEY_MAP.S, KEY_MAP.D,
                        KEY_MAP.ArrowUp, KEY_MAP.ArrowLeft, KEY_MAP.ArrowDown, KEY_MAP.ArrowRight,
                        KEY_MAP.Space]) {
      try { dispatchKey('keyup', spec); } catch {}
    }
    // Visually un-press any depressed buttons.
    root.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
  };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', () => { if (document.hidden) onBlur(); });

  // If we ever observe a `mouse` pointer (e.g. iPad with trackpad/mouse, or
  // a USB mouse plugged into Android), demote the overlay so the player isn't
  // stuck behind a joystick they don't need. Touch always wins back: any
  // subsequent `touchstart` re-shows the overlay via syncOverlay().
  let _seenMouse = false;
  const onPointerDown = (e) => {
    if (forceShow) return;
    if (e.pointerType === 'mouse' && !_seenMouse) {
      _seenMouse = true;
      root.classList.add('is-hidden');
    }
  };
  const onTouchStartReshow = () => {
    if (forceShow || !touch) return;
    if (_seenMouse) { _seenMouse = false; syncOverlay(); }
  };
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('touchstart', onTouchStartReshow, { passive: true });
  cleanupBag.push(() => window.removeEventListener('pointerdown', onPointerDown));
  cleanupBag.push(() => window.removeEventListener('touchstart', onTouchStartReshow));

  // Long-press anywhere outside the overlay UI → synthesise Escape (most games
  // bind Esc to pause). 650ms hold w/ <12px finger drift so we don't fire on
  // accidental thumb scuffs while moving the joystick.
  let _lpTimer = 0, _lpStartX = 0, _lpStartY = 0;
  const startLp = (e) => {
    if (!touch && !forceShow) return;
    // Skip our own UI + any HTML element interactive (buttons, inputs, links).
    if (e.target?.closest?.('.mc-root, button, a, input, textarea, select, .overlay__panel')) return;
    const t = e.touches?.[0]; if (!t) return;
    _lpStartX = t.clientX; _lpStartY = t.clientY;
    clearTimeout(_lpTimer);
    _lpTimer = setTimeout(() => {
      // Dispatch synth-Escape so pause-on-Escape games trigger their pause UI.
      try {
        const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        const evUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        window.dispatchEvent(evUp);
        vibrate(40);
      } catch {}
    }, 650);
  };
  const cancelLp = (e) => {
    if (!_lpTimer) return;
    const t = e.touches?.[0] || e.changedTouches?.[0];
    if (t && (Math.abs(t.clientX - _lpStartX) > 12 || Math.abs(t.clientY - _lpStartY) > 12)) {
      clearTimeout(_lpTimer); _lpTimer = 0;
    }
  };
  const endLp = () => { clearTimeout(_lpTimer); _lpTimer = 0; };
  document.addEventListener('touchstart', startLp, { passive: true });
  document.addEventListener('touchmove', cancelLp, { passive: true });
  document.addEventListener('touchend', endLp, { passive: true });
  document.addEventListener('touchcancel', endLp, { passive: true });
  cleanupBag.push(() => document.removeEventListener('touchstart', startLp));
  cleanupBag.push(() => document.removeEventListener('touchmove', cancelLp));
  cleanupBag.push(() => document.removeEventListener('touchend', endLp));
  cleanupBag.push(() => document.removeEventListener('touchcancel', endLp));

  // iOS Safari address-bar shifts → set a CSS var `--wg-vvh` to the actual
  // visualViewport height (in px) so games' layout can opt in via height:
  // calc(var(--wg-vvh) * 1px). Falls back gracefully if VV is unsupported.
  const onVv = () => {
    if (window.visualViewport) {
      const h = window.visualViewport.height;
      document.documentElement.style.setProperty('--wg-vvh', h + 'px');
    }
  };
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVv);
    window.visualViewport.addEventListener('scroll', onVv);
    onVv();
    cleanupBag.push(() => window.visualViewport.removeEventListener('resize', onVv));
    cleanupBag.push(() => window.visualViewport.removeEventListener('scroll', onVv));
  }

  // === IDLE-FADE chrome ====================================================
  // After 5s without any touch, dim the gear/back/mute icons to .15 opacity
  // so they don't compete with gameplay. Any touch re-shows them. Driven by
  // a single timer that resets on touchstart; mc-root + body classes flip
  // together so settings/help/speed buttons (outside mc-root) fade too.
  let _idleTimer = 0;
  const IDLE_MS = 5000;
  const armIdle = () => {
    clearTimeout(_idleTimer);
    root.classList.remove('is-idle');
    document.body.classList.remove('mc-idle');
    _idleTimer = setTimeout(() => {
      // Don't fade if an overlay is open or the joystick is being held.
      if (document.querySelector('.overlay:not([hidden]):not(.is-hidden)')) return;
      if (state.move.mag > 0) return;
      root.classList.add('is-idle');
      document.body.classList.add('mc-idle');
    }, IDLE_MS);
  };
  const onAnyTouch = () => armIdle();
  document.addEventListener('touchstart', onAnyTouch, { passive: true });
  document.addEventListener('touchmove', onAnyTouch, { passive: true });
  if (touch || forceShow) armIdle();
  cleanupBag.push(() => {
    clearTimeout(_idleTimer);
    document.removeEventListener('touchstart', onAnyTouch);
    document.removeEventListener('touchmove', onAnyTouch);
    root.classList.remove('is-idle');
    document.body.classList.remove('mc-idle');
  });

  // === SWIPE-UP-FROM-BOTTOM = pause =========================================
  // Alternative to long-press: a fast upward swipe that starts in the bottom
  // 8% of the viewport and travels > 80px in < 400ms fires synth-Escape
  // (most games bind Esc to pause). Skips when starting on our UI controls.
  let _swipeStart = null;
  const _onSwipeStart = (e) => {
    if (!touch && !forceShow) return;
    if (e.target?.closest?.('.mc-root, button, a, input, textarea, select, .overlay__panel')) return;
    const t = e.touches?.[0]; if (!t) return;
    if (t.clientY < window.innerHeight * 0.92) return;
    _swipeStart = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const _onSwipeEnd = (e) => {
    if (!_swipeStart) return;
    const t = e.changedTouches?.[0]; if (!t) { _swipeStart = null; return; }
    const dy = _swipeStart.y - t.clientY;
    const dx = Math.abs(t.clientX - _swipeStart.x);
    const dt = Date.now() - _swipeStart.t;
    _swipeStart = null;
    if (dt < 400 && dy > 80 && dx < 60) {
      try {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
        hapticFeedback('press');
      } catch {}
    }
  };
  document.addEventListener('touchstart', _onSwipeStart, { passive: true });
  document.addEventListener('touchend', _onSwipeEnd, { passive: true });
  cleanupBag.push(() => document.removeEventListener('touchstart', _onSwipeStart));
  cleanupBag.push(() => document.removeEventListener('touchend', _onSwipeEnd));

  // === DOUBLE-TAP joystick / d-pad → dash ==================================
  // Dispatches a 'mc:doubletap' event when the player double-taps the
  // joystick base or any d-pad arrow. Games with movement that want to
  // honour a dash can `addEventListener('mc:doubletap', ...)`. No effect on
  // games that don't subscribe — pure additive.
  const stickEl = root.querySelector('.mc-stick');
  if (stickEl) _wireDoubleTap(stickEl, 'stick');
  root.querySelectorAll('.mc-dpad__btn').forEach((btn) => {
    const dir = btn.className.match(/mc-dpad__btn--(\w+)/)?.[1] || '';
    _wireDoubleTap(btn, dir);
  });

  // Show one-time mobile tutorial after first show.
  if ((touch || forceShow) && !opts.disableTutorial) {
    showMobileTutorial({ layout });
  }

  return {
    enabled: showByDefault,
    state,
    getMove: () => state.move,
    isFiring: () => state.firing,
    getAim: () => state.aim,
    syncKeys(keys) { syncKeysRef.current = keys; },
    setHidden(h) { root.classList.toggle('is-hidden', !!h); },
    setDim(d) { root.classList.toggle('is-dim', !!d); },
    forceShow() { root.classList.remove('is-hidden'); root.classList.add('is-force'); },
    vibrate,
    haptic: hapticFeedback,
    showTutorial: (o) => showMobileTutorial({ layout, ...o }),
    destroy() {
      mo?.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', onBlur);
      // Untie every document-level listener we added (joystick + fire/aim).
      for (const fn of cleanupBag) { try { fn(); } catch {} }
      cleanupBag.length = 0;
      root.remove();
    },
  };
}

// Named helpers — let any module (even non-mobile-controls users) trigger
// haptic feedback or check whether they're on a touch device with the same
// rules the overlay uses internally.
export { hapticFeedback, vibrate, isTouchDevice, showMobileTutorial };

// === Performance hint ======================================================
// Lightweight detection used by games + visualPolish: returns true when
// running on a mobile/touch device that should render fewer particles, skip
// parallax, etc. Cached after first call. Exposed both as an export and on
// `window.__mcIsLowPower` (so legacy non-module code in HTML can read it).
let _lowPower = null;
export function isLowPowerDevice() {
  if (_lowPower !== null) return _lowPower;
  // 1. Touch + narrow viewport = phone — always low power.
  const touch = isTouchDevice();
  const narrow = (typeof window !== 'undefined' && window.innerWidth < 768);
  // 2. Device-memory API (Chrome): <= 2GB = low power.
  let lowMem = false;
  try { const m = navigator.deviceMemory; lowMem = (typeof m === 'number') && m <= 2; } catch {}
  // 3. Hardware concurrency: < 4 cores → low power.
  let lowCores = false;
  try { lowCores = (navigator.hardwareConcurrency || 8) < 4; } catch {}
  _lowPower = (touch && narrow) || lowMem || lowCores;
  try { if (typeof window !== 'undefined') window.__mcIsLowPower = _lowPower; } catch {}
  return _lowPower;
}

// Convenience: return a multiplier (1.0 desktop / 0.5 mobile) for particle
// counts so games can do `count = baseCount * particleScale()`. Wired into
// shared particleBurst.js so EVERY existing burst call gets a free
// mobile-perf bump without per-game code changes.
export function particleScale() {
  return isLowPowerDevice() ? 0.5 : 1;
}

export default createMobileControls;
