// =============================================================================
// Shared on-screen touch controls — dual stick + ability button.
// Both BORK BATTLE and PUGFORT use this on mobile / touch devices.
//
// Usage:
//   const tc = createTouchControls({ enableAbility: true, abilityLabel: 'BORK' });
//   tc.getMove();    // { x, y } in [-1..1]
//   tc.getAim();     // { x, y } unit vector; null if right stick idle
//   tc.isFiring();   // true while right stick is deflected (or fire btn pressed)
//   tc.abilityDown;  // boolean (held)
//   tc.abilityJustPressed / abilityJustReleased — true once, cleared after read
// =============================================================================

function isTouchDevice() {
  return (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

function makeStick(id, side) {
  const wrap = document.createElement('div');
  wrap.className = `touch-stick touch-stick--${side}`;
  wrap.id = id;
  wrap.innerHTML = `
    <div class="touch-stick__base"></div>
    <div class="touch-stick__thumb"></div>
  `;
  return wrap;
}

export function createTouchControls(opts = {}) {
  const enabled = isTouchDevice();
  const abilityLabel = opts.abilityLabel || 'BORK';
  const enableAbility = opts.enableAbility !== false;
  const onAbility = opts.onAbility || null;

  const state = {
    move: { x: 0, y: 0 },
    aim: null,        // unit vector or null
    firing: false,    // right-stick deflected past dead zone
    abilityDown: false,
    abilityJustPressed: false,
    abilityJustReleased: false,
    enabled,
  };

  if (!enabled) {
    return {
      ...state,
      getMove: () => ({ x: 0, y: 0 }),
      getAim: () => null,
      isFiring: () => false,
      consumeAbilityPressed() { return false; },
      consumeAbilityReleased() { return false; },
      destroy() {},
    };
  }

  // Build DOM
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.id = 'touch-controls';

  const left = makeStick('touch-move', 'left');
  const right = makeStick('touch-aim', 'right');
  root.appendChild(left);
  root.appendChild(right);

  let abilityBtn = null;
  if (enableAbility) {
    abilityBtn = document.createElement('button');
    abilityBtn.type = 'button';
    abilityBtn.className = 'touch-ability';
    abilityBtn.id = 'touch-ability';
    abilityBtn.textContent = abilityLabel;
    root.appendChild(abilityBtn);
  }

  document.body.appendChild(root);

  // Per-stick tracking
  function bindStick(stickEl, isAim) {
    const base = stickEl.querySelector('.touch-stick__base');
    const thumb = stickEl.querySelector('.touch-stick__thumb');
    let activeTouchId = null;
    let centerX = 0, centerY = 0;
    const maxR = 60; // px from center
    const dead = 0.18;

    const start = (e) => {
      // Find a touch that started in the stick area
      const t = (e.changedTouches || [e])[0];
      if (activeTouchId !== null) return;
      activeTouchId = t.identifier ?? -1;
      const rect = base.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      move(t.clientX, t.clientY);
      e.preventDefault();
    };

    const moveById = (e) => {
      const list = e.changedTouches || [e];
      for (const t of list) {
        if ((t.identifier ?? -1) === activeTouchId) {
          move(t.clientX, t.clientY);
          e.preventDefault();
          return;
        }
      }
    };

    const endById = (e) => {
      const list = e.changedTouches || [e];
      for (const t of list) {
        if ((t.identifier ?? -1) === activeTouchId) {
          reset();
          e.preventDefault();
          return;
        }
      }
    };

    function move(clientX, clientY) {
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      thumb.style.transform = `translate(${dx}px, ${dy}px)`;
      // Normalize to [-1..1]
      const nx = dx / maxR;
      const ny = dy / maxR;
      const mag = Math.hypot(nx, ny);
      if (isAim) {
        if (mag < dead) {
          state.aim = null;
          state.firing = false;
        } else {
          // Normalize to unit vector (full strength regardless of deflection past dead)
          state.aim = { x: nx / mag, y: ny / mag };
          state.firing = true;
        }
      } else {
        if (mag < dead) {
          state.move = { x: 0, y: 0 };
        } else {
          // Scale magnitude to [0..1] after dead zone for analog feel
          const s = (mag - dead) / (1 - dead);
          state.move = { x: (nx / mag) * s, y: (ny / mag) * s };
        }
      }
      stickEl.classList.add('is-active');
    }

    function reset() {
      activeTouchId = null;
      thumb.style.transform = `translate(0px, 0px)`;
      if (isAim) {
        state.aim = null;
        state.firing = false;
      } else {
        state.move = { x: 0, y: 0 };
      }
      stickEl.classList.remove('is-active');
    }

    stickEl.addEventListener('touchstart', start, { passive: false });
    // Document-level move/end so finger leaving the stick element keeps tracking.
    document.addEventListener('touchmove', moveById, { passive: false });
    document.addEventListener('touchend', endById, { passive: false });
    document.addEventListener('touchcancel', endById, { passive: false });
  }

  bindStick(left, false);
  bindStick(right, true);

  if (abilityBtn) {
    const press = (e) => {
      if (!state.abilityDown) state.abilityJustPressed = true;
      state.abilityDown = true;
      abilityBtn.classList.add('is-active');
      if (onAbility) onAbility(true);
      e.preventDefault();
    };
    const release = (e) => {
      if (state.abilityDown) state.abilityJustReleased = true;
      state.abilityDown = false;
      abilityBtn.classList.remove('is-active');
      if (onAbility) onAbility(false);
      e.preventDefault();
    };
    abilityBtn.addEventListener('touchstart', press, { passive: false });
    abilityBtn.addEventListener('touchend', release, { passive: false });
    abilityBtn.addEventListener('touchcancel', release, { passive: false });
    // Mouse fallback for desktop testing
    abilityBtn.addEventListener('mousedown', press);
    abilityBtn.addEventListener('mouseup', release);
    abilityBtn.addEventListener('mouseleave', release);
  }

  // Block default scroll/zoom on the touch-controls layer
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  // Hide controls while overlays (start/end/evolve) are visible
  function syncVisibility() {
    const anyOverlay = !!document.querySelector(
      '.overlay:not([hidden]):not(.is-hidden)'
    );
    root.style.opacity = anyOverlay ? '0' : '1';
    root.style.pointerEvents = anyOverlay ? 'none' : 'auto';
    if (abilityBtn) abilityBtn.style.pointerEvents = anyOverlay ? 'none' : 'auto';
  }
  syncVisibility();
  const mo = new MutationObserver(syncVisibility);
  document.querySelectorAll('.overlay').forEach((el) =>
    mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] })
  );

  return {
    enabled,
    getMove: () => ({ x: state.move.x, y: state.move.y }),
    getAim: () => state.aim,
    isFiring: () => state.firing,
    get abilityDown() { return state.abilityDown; },
    consumeAbilityPressed() {
      const v = state.abilityJustPressed;
      state.abilityJustPressed = false;
      return v;
    },
    consumeAbilityReleased() {
      const v = state.abilityJustReleased;
      state.abilityJustReleased = false;
      return v;
    },
    destroy() {
      root.remove();
      mo.disconnect();
    },
  };
}
