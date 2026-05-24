// =============================================================================
// DEPTH 3D — pseudo-3D depth utilities shared by every game.
//
// All effects are LIGHT-TOUCH — drop-in helpers that layer "fake depth" on top
// of existing 2D renderers without altering gameplay or breaking existing
// visuals. Reduced-motion (body.reduced-motion) tones down parallax and
// perspective tilts but KEEPS shadows + lighting for accessibility.
//
// Provided helpers:
//   - parallaxLayers({ canvas, layers })    Manages multi-layer scrolling BGs
//   - drawShadow(ctx, x, y, r, opts?)       Soft elliptical drop shadow
//   - depthSort(arr, accessor?)             Back-to-front sort (in place)
//   - perspectiveTransform(ctx, opts)       Apply ctx-matrix perspective tilt
//   - lightingOverlay(ctx, lights, ambAlpha)  N point-lights + ambient darkness
//   - fakeFog({ ctx, w, h, ... })           Radial distance fog
//   - verticalScroll({ ctx, foregroundY, backgroundY, scrollSpeed })  back-scroll
//   - htmlVignette()                        Static DOM vignette for DOM-first games
//   - htmlParallax({ host, layers })        DOM parallax (for DOM-first games)
//
// All canvas helpers are stateless — pass ctx + params + return values.
// parallaxLayers returns a controller with .render(camX, camY).
//
// Idempotent CSS injection via the single `<style id="wg-depth3d-styles">` tag.
// =============================================================================

let _stylesInjected = false;

export function isReducedMotion() {
  if (typeof document === 'undefined') return false;
  return !!(document.body && document.body.classList.contains('reduced-motion'));
}

function _ensureStyles() {
  if (_stylesInjected) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('wg-depth3d-styles')) { _stylesInjected = true; return; }
  const s = document.createElement('style');
  s.id = 'wg-depth3d-styles';
  s.textContent = `
    /* HTML vignette overlay — sits above gameplay canvas, below DOM UI */
    .wg-depth-vignette{position:fixed;inset:0;pointer-events:none;z-index:5;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.45) 100%);}
    body.reduced-motion .wg-depth-vignette{background:radial-gradient(ellipse at center,rgba(0,0,0,0) 65%,rgba(0,0,0,.35) 100%);}
    /* DOM parallax layers — absolutely positioned, transform via CSS var */
    .wg-depth-parallax{position:fixed;inset:0;pointer-events:none;z-index:1;overflow:hidden;}
    .wg-depth-parallax__layer{position:absolute;inset:0;will-change:transform;}
    body.reduced-motion .wg-depth-parallax__layer{transform:none!important;}
  `;
  document.head.appendChild(s);
  _stylesInjected = true;
}

// -----------------------------------------------------------------------------
// drawShadow — soft elliptical drop shadow under entities. Drawn BEFORE sprite.
// Reduced-motion: keep (it's accessibility-neutral).
// -----------------------------------------------------------------------------
export function drawShadow(ctx, x, y, radius, opts) {
  const o = opts || {};
  const alpha = o.alpha != null ? o.alpha : 0.35;
  const ratio = o.ratio != null ? o.ratio : 0.4;   // ellipse y/x ratio
  const color = o.color || '0,0,0';
  if (!ctx || !isFinite(x) || !isFinite(y) || radius <= 0) return;
  ctx.save();
  // Radial gradient — dark at center, transparent at edge
  try {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grd.addColorStop(0, `rgba(${color},${alpha})`);
    grd.addColorStop(0.6, `rgba(${color},${alpha * 0.55})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = grd;
  } catch {
    ctx.fillStyle = `rgba(${color},${alpha * 0.6})`;
  }
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * ratio, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// -----------------------------------------------------------------------------
// depthSort — back-to-front sort by y (default). Returns the same array.
// `accessor` returns the numeric sort key per entity (default `e.y`).
// -----------------------------------------------------------------------------
export function depthSort(entities, accessor) {
  if (!Array.isArray(entities) || entities.length < 2) return entities;
  const get = typeof accessor === 'function'
    ? accessor
    : (e) => (e && typeof e.y === 'number') ? e.y : 0;
  entities.sort((a, b) => get(a) - get(b));
  return entities;
}

// -----------------------------------------------------------------------------
// parallaxLayers — register N background layers; each draws into ctx with the
// effective camera offset (camX/Y * layer.speed). Use BEFORE world entities.
//
//   const par = parallaxLayers({
//     canvas, layers: [
//       { speed: 0.1, draw(ctx, ox, oy, w, h) { ... } },
//       { speed: 0.3, draw(ctx, ox, oy, w, h) { ... } },
//     ],
//   });
//   par.render(cameraX, cameraY);
//
// Reduced-motion: ignore camera offsets entirely (still draws layers).
// -----------------------------------------------------------------------------
export function parallaxLayers(opts) {
  const o = opts || {};
  const canvas = o.canvas || null;
  const layers = Array.isArray(o.layers) ? o.layers.slice() : [];
  const ctx = canvas ? canvas.getContext('2d') : null;
  return {
    add(layer) { if (layer && typeof layer.draw === 'function') layers.push(layer); },
    render(camX, camY) {
      if (!ctx) return;
      const reduce = isReducedMotion();
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      const cx = reduce ? 0 : (camX || 0);
      const cy = reduce ? 0 : (camY || 0);
      for (const l of layers) {
        if (!l || typeof l.draw !== 'function') continue;
        const sx = (l.speed || 0) * cx;
        const sy = (l.speed || 0) * cy;
        try { l.draw(ctx, sx, sy, w, h); } catch (e) { /* never break gameplay */ }
      }
    },
  };
}

// -----------------------------------------------------------------------------
// perspectiveTransform — apply a horizontal-tilt matrix to simulate looking
// down at the floor. `opts.tiltY` = vertical squish factor (0..1, 1 = none).
// `opts.skewX` = horizontal skew radians for a slight angled-floor feel.
// Reduced-motion: no-op (returns false).
// -----------------------------------------------------------------------------
export function perspectiveTransform(ctx, opts) {
  if (!ctx) return false;
  if (isReducedMotion()) return false;
  const o = opts || {};
  const tiltY = o.tiltY != null ? o.tiltY : 1;
  const skewX = o.skewX != null ? o.skewX : 0;
  const ox = o.originX || 0, oy = o.originY || 0;
  try {
    ctx.translate(ox, oy);
    ctx.transform(1, 0, skewX, tiltY, 0, 0);
    ctx.translate(-ox, -oy);
  } catch { return false; }
  return true;
}

// -----------------------------------------------------------------------------
// lightingOverlay — paint N point-light radial gradients + an optional ambient
// darkness layer (so unlit areas darken). Use AFTER world render.
//
//   lightingOverlay(ctx, [
//     { x, y, radius, color: '255,210,63', intensity: 1.0 },
//   ], 0.45)
//
// Reduced-motion: keep (it's atmospheric, not movement).
// -----------------------------------------------------------------------------
export function lightingOverlay(ctx, lights, ambientAlpha) {
  if (!ctx) return;
  const W = ctx.canvas.width / (window.devicePixelRatio || 1);
  const H = ctx.canvas.height / (window.devicePixelRatio || 1);
  ctx.save();
  // 1. Ambient darkness (multiply-blend so it darkens uniformly)
  const amb = Math.max(0, Math.min(1, ambientAlpha != null ? ambientAlpha : 0.4));
  if (amb > 0) {
    ctx.fillStyle = `rgba(0,0,0,${amb})`;
    ctx.fillRect(0, 0, W, H);
  }
  // 2. Punch lights through with 'lighter' so each light brightens the area
  if (Array.isArray(lights) && lights.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L) continue;
      const lx = L.x || 0, ly = L.y || 0, lr = L.radius || 100;
      const col = L.color || '255,210,120';
      const intensity = L.intensity != null ? L.intensity : 1;
      try {
        const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        grd.addColorStop(0, `rgba(${col},${0.55 * intensity})`);
        grd.addColorStop(0.5, `rgba(${col},${0.22 * intensity})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();
      } catch { /* skip bad light */ }
    }
  }
  ctx.restore();
}

// -----------------------------------------------------------------------------
// fakeFog — distance fog as a radial gradient from screen center outward.
// Use AFTER world render for "depth haze" feel.
// -----------------------------------------------------------------------------
export function fakeFog(opts) {
  const o = opts || {};
  const ctx = o.ctx;
  if (!ctx) return;
  const w = o.w || ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = o.h || ctx.canvas.height / (window.devicePixelRatio || 1);
  const cx = o.cx != null ? o.cx : w / 2;
  const cy = o.cy != null ? o.cy : h / 2;
  const start = o.fogStart != null ? o.fogStart : 0.35;   // 0..1 of max radius
  const end = o.fogEnd != null ? o.fogEnd : 1.0;
  const color = o.fogColor || '0,0,0';
  const alpha = o.alpha != null ? o.alpha : 0.6;
  const maxR = Math.max(w, h) * 0.75;
  ctx.save();
  try {
    const grd = ctx.createRadialGradient(cx, cy, maxR * start, cx, cy, maxR * end);
    grd.addColorStop(0, `rgba(${color},0)`);
    grd.addColorStop(0.7, `rgba(${color},${alpha * 0.55})`);
    grd.addColorStop(1, `rgba(${color},${alpha})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  } catch { /* */ }
  ctx.restore();
}

// -----------------------------------------------------------------------------
// verticalScroll — for vertical scrollers (floor-lava), paint a slower-moving
// background based on the foreground's scroll amount. Returns the background
// offset Y so the caller can pass it to a draw callback.
// -----------------------------------------------------------------------------
export function verticalScroll(opts) {
  const o = opts || {};
  if (isReducedMotion()) return { backgroundY: 0 };
  const fg = o.foregroundY || 0;
  const speed = o.scrollSpeed != null ? o.scrollSpeed : 0.4;
  return { backgroundY: fg * speed };
}

// -----------------------------------------------------------------------------
// htmlVignette — for DOM-first games (pug-cafe, mutation-lab). Adds a fixed
// vignette overlay. Idempotent.
// -----------------------------------------------------------------------------
export function htmlVignette() {
  _ensureStyles();
  if (typeof document === 'undefined') return null;
  if (document.querySelector('.wg-depth-vignette')) return document.querySelector('.wg-depth-vignette');
  const el = document.createElement('div');
  el.className = 'wg-depth-vignette';
  document.body.appendChild(el);
  return el;
}

// -----------------------------------------------------------------------------
// htmlParallax — for DOM-first games. Creates fixed CSS layers translated via
// CSS transforms based on mouse position OR a custom driver.
//
//   const par = htmlParallax({ layers: [
//     { speed: 0.02, html: '<div style="..."></div>' },
//     { speed: 0.05, html: '...' },
//   ]});
//   // attaches mousemove listener; reduced-motion disables transforms.
// -----------------------------------------------------------------------------
export function htmlParallax(opts) {
  _ensureStyles();
  if (typeof document === 'undefined') return null;
  const o = opts || {};
  const layers = Array.isArray(o.layers) ? o.layers : [];
  const host = o.host || document.body;
  // Tear down any prior instance to avoid stacking on hot reload.
  host.querySelectorAll('.wg-depth-parallax').forEach((n) => n.remove());
  const wrap = document.createElement('div');
  wrap.className = 'wg-depth-parallax';
  const layerEls = [];
  for (const L of layers) {
    const el = document.createElement('div');
    el.className = 'wg-depth-parallax__layer';
    el.innerHTML = L.html || '';
    el.dataset.speed = String(L.speed || 0);
    wrap.appendChild(el);
    layerEls.push(el);
  }
  host.appendChild(wrap);
  let mx = 0, my = 0;
  const onMove = (e) => {
    if (isReducedMotion()) { mx = 0; my = 0; return; }
    const w = window.innerWidth, h = window.innerHeight;
    mx = ((e.clientX || 0) / w - 0.5) * 2;   // -1..1
    my = ((e.clientY || 0) / h - 0.5) * 2;
    for (const el of layerEls) {
      const sp = parseFloat(el.dataset.speed) || 0;
      el.style.transform = `translate(${-mx * sp * 40}px, ${-my * sp * 40}px)`;
    }
  };
  window.addEventListener('mousemove', onMove, { passive: true });
  return {
    el: wrap,
    destroy() {
      window.removeEventListener('mousemove', onMove);
      wrap.remove();
    },
  };
}
