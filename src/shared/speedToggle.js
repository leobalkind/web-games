// SPEED TOGGLE — floating pill button that cycles 1x / 2x / 3x game speed.
// Caller multiplies its per-frame dt by the value passed to `onChange`.
// Keyboard shortcut: `T` cycles forward through speeds.
//
//   const speed = createSpeedToggle({ onChange: (m) => { mult = m; } });
//   ...
//   function tick(dt) { dt *= mult; ... }
//   speed.destroy();  // on game-quit
//
import { ensureSharedStyles } from './_overlayStyles.js';

const SPEEDS = [1, 2, 3];

export function createSpeedToggle({ onChange = () => {}, initial = 1, disabled = false } = {}) {
  ensureSharedStyles();
  let idx = Math.max(0, SPEEDS.indexOf(initial));
  if (idx < 0) idx = 0;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'wg-speed-toggle';
  btn.setAttribute('aria-label', 'Toggle game speed');
  btn.title = 'Toggle speed (T)';
  const render = () => {
    btn.textContent = SPEEDS[idx] + 'x';
    btn.dataset.speed = String(SPEEDS[idx]);
    btn.classList.toggle('is-disabled', !!disabled);
  };
  const apply = (newIdx) => {
    idx = ((newIdx % SPEEDS.length) + SPEEDS.length) % SPEEDS.length;
    render();
    try { onChange(SPEEDS[idx]); } catch (e) { /* swallow */ }
  };
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (disabled) return;
    apply(idx + 1);
  });
  const onKey = (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 't' || e.key === 'T') {
      if (disabled) return;
      e.preventDefault();
      apply(idx + 1);
    }
  };
  window.addEventListener('keydown', onKey);
  document.body.appendChild(btn);
  render();
  return {
    destroy() {
      window.removeEventListener('keydown', onKey);
      btn.remove();
    },
    setSpeed(mult) {
      const i = SPEEDS.indexOf(mult);
      if (i >= 0) apply(i);
    },
    setDisabled(d) {
      disabled = !!d;
      render();
    },
    getSpeed() { return SPEEDS[idx]; },
    element: btn,
  };
}
