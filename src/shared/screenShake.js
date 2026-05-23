// =============================================================================
// SHARED SCREEN-SHAKE — uniform intensity + reduced-motion respect.
// =============================================================================
// Each game already has its own `shake(mag, dur)` style local function. This
// module provides a tiny helper that returns the CURRENT global intensity
// multiplier (0..1.5) based on user settings. Games multiply their `mag` arg
// by `getShakeMul()` to normalize feel across games.
//
//   import { getShakeMul, makeShaker } from '.../screenShake.js';
//   const shaker = makeShaker();
//   // on event:
//   shaker.add(6, 0.2);             // mag, dur — auto applies intensity mult
//   // each frame:
//   shaker.tick(dt);
//   const [sx, sy] = shaker.offset();
//   ctx.translate(sx, sy);
//
// Honors `body.reduced-motion` (set by settingsMenu) — shake mult goes to 0.
//
// The shake-INTENSITY user preference is keyed under `wg:settings:shakeMul`
// (0=off, 50=half, 100=normal, 150=extra). Default 100. Reduced-motion forces 0
// regardless of slider.
// =============================================================================

const K_SHAKE = 'wg:settings:shakeMul';
const _read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };

export function getShakeMul() {
  if (typeof document !== 'undefined' && document.body && document.body.classList.contains('reduced-motion')) return 0;
  const raw = parseInt(_read(K_SHAKE, '100'), 10);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0, Math.min(1.5, raw / 100));
}

export function setShakeMul(pct) {
  const n = Math.max(0, Math.min(150, parseInt(pct, 10) || 0));
  try { localStorage.setItem(K_SHAKE, String(n)); } catch {}
}

// Tiny reusable shaker that respects intensity. Games can opt-in OR keep their
// existing locals and just multiply by getShakeMul() at the add-site.
export function makeShaker() {
  let t = 0, m = 0;
  return {
    add(mag, dur) {
      const k = getShakeMul();
      m = Math.max(m, mag * k);
      t = Math.max(t, dur);
    },
    tick(dt) {
      if (t > 0) { t -= dt; if (t <= 0) { t = 0; m = 0; } }
    },
    offset() {
      if (t <= 0 || m <= 0) return [0, 0];
      const k = Math.min(1, t / 0.3);
      return [(Math.random() - 0.5) * m * 2 * k, (Math.random() - 0.5) * m * 2 * k];
    },
    reset() { t = 0; m = 0; },
    isShaking() { return t > 0 && m > 0; },
  };
}
