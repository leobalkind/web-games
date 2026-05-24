// =============================================================================
// SHARED PARTICLE BURST — uniform damage/death sparkles for canvas games.
// =============================================================================
// Each game already has its own particle array. This module ADDS a tiny helper
// that produces a consistent-looking burst — same easing, fade, gravity feel.
// Games push the returned objects into their existing particle pool.
//
//   import { burst } from '.../particleBurst.js';
//   const p = burst(x, y, { count: 12, color: '#ff3aa1', kind: 'damage' });
//   for (const pt of p) particles.push(pt);
//
// Particles are plain objects: { x, y, vx, vy, life, max, size, color, gravity }
// Games tick them with their own loop:
//   pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += pt.gravity * dt;
//   pt.life -= dt; if (pt.life <= 0) remove;
// And draw them as small fading squares/circles.
//
// `kind`:
//   'damage' — fast outward spread, no gravity, bright
//   'death'  — slower, with gravity, debris feel
//   'sparkle'— very fast, tiny, no gravity (for collectibles)
// =============================================================================

import { getShakeMul } from './screenShake.js';

const TAU = Math.PI * 2;

// Mobile / low-power devices halve the particle count so canvas-heavy games
// (BORK BATTLE, PUGFORT, MUTATION LAB) keep 60fps on iPhone SE-class hardware.
// We detect once and cache. No game code changes required — every existing
// `burst()` call inherits the cheaper budget automatically.
let _lowPowerCache = null;
function _isLowPower() {
  if (_lowPowerCache !== null) return _lowPowerCache;
  try {
    if (typeof window === 'undefined') { _lowPowerCache = false; return false; }
    if (typeof window.__mcIsLowPower === 'boolean') {
      _lowPowerCache = window.__mcIsLowPower;
      return _lowPowerCache;
    }
    const touch = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const narrow = window.innerWidth < 768;
    let lowMem = false;
    try { const m = navigator.deviceMemory; lowMem = (typeof m === 'number') && m <= 2; } catch {}
    _lowPowerCache = (touch && narrow) || lowMem;
  } catch { _lowPowerCache = false; }
  return _lowPowerCache;
}

export function burst(x, y, opts = {}) {
  const count = opts.count || 10;
  const color = opts.color || '#ff3aa1';
  const kind = opts.kind || 'damage';
  const speedBase = opts.speed || (kind === 'damage' ? 200 : kind === 'sparkle' ? 320 : 130);
  const lifeBase = opts.life || (kind === 'damage' ? 0.35 : kind === 'sparkle' ? 0.5 : 0.7);
  const gravity = opts.gravity ?? (kind === 'death' ? 280 : 0);
  const sizeBase = opts.size || (kind === 'sparkle' ? 1.6 : 2.4);
  // Reduced motion still emits a TINY pop so feedback isn't lost, but smaller
  // and shorter. Mobile halves the count again on top of that.
  const mul = getShakeMul();
  const k = mul <= 0 ? 0.35 : Math.min(1, mul);
  const mobileScale = _isLowPower() ? 0.5 : 1;
  const n = Math.max(2, Math.round(count * (mul <= 0 ? 0.5 : 1) * mobileScale));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = speedBase * (0.5 + Math.random() * 0.7) * k;
    out.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (kind === 'death' ? 60 * k : 0),
      life: lifeBase * (0.7 + Math.random() * 0.6) * (mul <= 0 ? 0.7 : 1),
      max: lifeBase,
      size: sizeBase * (0.7 + Math.random() * 0.8),
      color,
      gravity,
    });
  }
  return out;
}

// Convenience: tick + draw helpers if a game wants to drop in a complete
// particle pool. Most games already have their own ticker — these are optional.
export function tickParticles(arr, dt) {
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    p.life -= dt;
    if (p.life <= 0) arr.splice(i, 1);
  }
}

export function drawParticles(ctx, arr) {
  for (const p of arr) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const s = p.size * (0.4 + a * 0.6);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}
