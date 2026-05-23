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
  const css = `
.mc-root{position:fixed;inset:0;pointer-events:none;z-index:2000;user-select:none;-webkit-user-select:none;touch-action:none;font-family:'Press Start 2P',monospace;}
.mc-root *{-webkit-touch-callout:none;box-sizing:border-box;}
.mc-root.is-hidden{opacity:0;pointer-events:none!important;}
.mc-root.is-dim{opacity:0.3;}
/* joystick — bottom-left */
.mc-stick{position:fixed;left:calc(20px + env(safe-area-inset-left,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));width:min(34vw,150px);height:min(34vw,150px);pointer-events:auto;touch-action:none;}
.mc-stick__base{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%,rgba(76,201,240,.18),rgba(0,0,0,.55) 70%);border:2px solid rgba(76,201,240,.5);box-shadow:0 0 24px rgba(76,201,240,.3),inset 0 0 14px rgba(0,0,0,.5);}
.mc-stick__thumb{position:absolute;left:50%;top:50%;width:42%;height:42%;margin-left:-21%;margin-top:-21%;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ff3aa1 55%,#7a1450);box-shadow:0 4px 12px rgba(0,0,0,.5),0 0 18px rgba(255,58,161,.6);pointer-events:none;transition:transform .05s linear;}
.mc-stick.is-active .mc-stick__base{border-color:rgba(76,201,240,.95);box-shadow:0 0 30px rgba(76,201,240,.55),inset 0 0 14px rgba(0,0,0,.5);}
/* d-pad (4 arrow buttons) — bottom-left */
.mc-dpad{position:fixed;left:calc(20px + env(safe-area-inset-left,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));width:min(40vw,170px);height:min(40vw,170px);pointer-events:none;}
.mc-dpad__btn{position:absolute;pointer-events:auto;width:34%;height:34%;background:rgba(20,20,40,.6);border:2px solid rgba(76,201,240,.6);border-radius:14px;color:#7be9ff;font-size:1.2rem;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent;}
.mc-dpad__btn--up{top:0;left:33%;}
.mc-dpad__btn--down{bottom:0;left:33%;}
.mc-dpad__btn--left{left:0;top:33%;}
.mc-dpad__btn--right{right:0;top:33%;}
.mc-dpad__btn.is-active{background:rgba(76,201,240,.4);transform:scale(.92);box-shadow:0 0 16px rgba(76,201,240,.7);}
/* platformer L/R + jump */
.mc-platl,.mc-platr{position:fixed;bottom:calc(24px + env(safe-area-inset-bottom,0px));width:min(20vw,90px);height:min(20vw,90px);background:rgba(20,20,40,.6);border:2px solid rgba(76,201,240,.6);border-radius:18px;color:#7be9ff;font-size:1.6rem;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;}
.mc-platl{left:calc(20px + env(safe-area-inset-left,0px));}
.mc-platr{left:calc(28px + min(20vw,90px) + env(safe-area-inset-left,0px));}
.mc-platl.is-active,.mc-platr.is-active{background:rgba(76,201,240,.4);transform:scale(.92);box-shadow:0 0 16px rgba(76,201,240,.7);}
.mc-jump{position:fixed;right:calc(24px + env(safe-area-inset-right,0px));bottom:calc(60px + env(safe-area-inset-bottom,0px));width:min(28vw,130px);height:min(28vw,130px);border-radius:50%;background:linear-gradient(180deg,#ffd23f,#c89c20);color:#1a0d05;border:3px solid #fff0a0;font-weight:bold;font-size:1rem;letter-spacing:.05em;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 0 rgba(120,80,0,.8),0 0 24px rgba(255,210,63,.5);}
.mc-jump.is-active{transform:translateY(4px) scale(.95);box-shadow:0 2px 0 rgba(120,80,0,.8),0 0 30px rgba(255,210,63,.9);}
/* action buttons stack — bottom-right */
.mc-actions{position:fixed;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column-reverse;gap:8px;pointer-events:none;align-items:flex-end;}
.mc-btn{pointer-events:auto;min-width:min(20vw,78px);min-height:min(20vw,78px);padding:4px 8px;border-radius:18px;background:rgba(30,10,30,.65);border:2px solid #ff3aa1;color:#ffd2eb;font-family:'Press Start 2P',monospace;font-size:.55rem;letter-spacing:.05em;text-align:center;line-height:1.1;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 0 #5a0040,0 0 14px rgba(255,58,161,.35);}
.mc-btn.is-active{transform:translateY(2px) scale(.92);background:rgba(255,58,161,.35);box-shadow:0 2px 0 #5a0040,0 0 22px rgba(255,58,161,.85);}
.mc-btn--wide{min-width:min(28vw,110px);}
/* fire button (aim-fire layout) — large, bottom-right, like jump */
.mc-fire{position:fixed;right:calc(24px + env(safe-area-inset-right,0px));bottom:calc(60px + env(safe-area-inset-bottom,0px));width:min(26vw,120px);height:min(26vw,120px);border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff8,#ff3a3a 60%,#7a1414);color:#fff;border:3px solid #ffb0b0;font-weight:bold;font-size:.85rem;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 0 #5a0808,0 0 24px rgba(255,58,58,.55);}
.mc-fire.is-active{transform:translateY(4px) scale(.95);box-shadow:0 2px 0 #5a0808,0 0 30px rgba(255,58,58,.95);}
/* back chip */
.mc-back{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:calc(10px + env(safe-area-inset-left,0px));padding:6px 10px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid #4cc9f0;color:#7be9ff;font-family:'Press Start 2P',monospace;font-size:.55rem;text-decoration:none;pointer-events:auto;}
/* mute chip — top-right */
.mc-mute{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:calc(10px + env(safe-area-inset-right,0px));width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.6);border:1px solid #4cc9f0;color:#fff;font-size:1rem;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:pointer;}
/* aim/fire — drag indicator on aim layouts (invisible by default) */
.mc-aim-pad{position:fixed;inset:0;pointer-events:none;}
@media (max-width:540px){.mc-stick,.mc-dpad{width:34vw;height:34vw;}.mc-jump,.mc-fire{width:24vw;height:24vw;font-size:.7rem;}}
@media (orientation:landscape) and (min-aspect-ratio:5/3){.mc-stick,.mc-dpad{bottom:14px;left:calc(14px + env(safe-area-inset-left,0px));}.mc-actions,.mc-jump,.mc-fire{bottom:14px;right:calc(14px + env(safe-area-inset-right,0px));}}
@media (hover:hover) and (pointer:fine) and (min-width:1025px){.mc-root:not(.is-force){display:none;}}
`;
  const tag = document.createElement('style');
  tag.id = 'mc-styles';
  tag.textContent = css;
  document.head.appendChild(tag);
}

function isTouchDevice() {
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

function vibrate(ms) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch {}
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

function buildJoystick(root, state, onMove, syncKeysRef) {
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

function buildFireButton(root, state, onFire, getCanvas, onAim) {
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
  document.addEventListener('touchstart', (e) => {
    // Ignore touches on our UI elements
    if (e.target.closest && e.target.closest('.mc-root')) return;
    const t = e.touches[0];
    handle(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest && e.target.closest('.mc-root')) return;
    const t = e.touches[0];
    if (t) handle(t.clientX, t.clientY);
  }, { passive: true });
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

  // Build layout
  if (layout === 'wasd-mouse' || layout === 'wasd-only' || layout === 'aim-fire') {
    if (layout !== 'aim-fire') {
      // joystick on left
      buildJoystick(root, state, onMove, syncKeysRef);
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
    buildJoystick(root, state, onMove, syncKeysRef);  // joystick too — most aim-fire games still move w/ wasd
    buildFireButton(root, state, onFire, getCanvas, onAim);
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
    destroy() {
      mo?.disconnect();
      window.removeEventListener('resize', onResize);
      root.remove();
    },
  };
}

export default createMobileControls;
