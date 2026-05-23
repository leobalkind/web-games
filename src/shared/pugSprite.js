// =============================================================================
// SHARED HIGH-DETAIL PUG SPRITE
//
// Canvas2D port of games/bork-battle/src/pugForms.js drawPugBase() — front-
// facing pug with 5-step shading, sphere lighting, drop ears w/ inner pink,
// jowls, deep wrinkles, big expressive eyes, paw pads, curly tail.
//
// Usage:
//   import { drawPug } from '../../src/shared/pugSprite.js';
//   drawPug(ctx, x, y, { size: 36, body: '#c8854a', mask: '#1a0d05' });
//
// Options:
//   size:       overall height in px (default 36) — internal coord is 16x16
//               normalized; size scales by `size / 36`.
//   body:       body color (hex string), default '#c8854a' (classic pug fawn)
//   mask:       face-mask color (hex string), default '#1a0d05'
//   ear:        ear outer color, default derived from body
//   tongueOut:  show tongue (default true)
//   tailVisible:show curly corkscrew tail (default true)
//   whiskers:   show whiskers (default false to reduce clutter at small sizes)
//   blink:      0..1 — 1 = closed eyes (for blinking animation)
//   helmet:     boolean — draw combat helmet on top of head
//   helmetColor:hex for helmet (default cyan)
//   chef:       boolean — draw chef hat (white puff)
//   hat:        boolean — draw simple cap
//   hatColor:   hex
//   alpha:      0..1 — overall alpha
//   rotation:   radians (rotates the whole pug)
//   facing:     'down' | 'up' (mirrors body subtly to suggest direction)
// =============================================================================

function shade(hex, factor) {
  // hex must be '#rrggbb'
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  if (factor < 1) {
    r = Math.round(r * factor); g = Math.round(g * factor); b = Math.round(b * factor);
  } else {
    r = Math.min(255, Math.round(r + (255 - r) * (factor - 1)));
    g = Math.min(255, Math.round(g + (255 - g) * (factor - 1)));
    b = Math.min(255, Math.round(b + (255 - b) * (factor - 1)));
  }
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Native baseline canvas is roughly 32 wide × 60 tall in source coords (matches
// the pugForms.js source range -16..16 horizontally, -32..14 vertically).
// We treat `size` as the desired full height in px on canvas.
const SRC_H = 60;

export function drawPug(ctx, x, y, opts = {}) {
  const {
    size = 36,
    body = '#c8854a',
    mask = '#1a0d05',
    ear = null,
    tongueOut = true,
    tailVisible = true,
    whiskers = false,
    blink = 0,
    helmet = false,
    helmetColor = '#3a3a48',
    chef = false,
    hat = false,
    hatColor = '#ff3a3a',
    alpha = 1,
    rotation = 0,
    facing = 'down',
  } = opts;

  const scale = size / SRC_H;
  const earCol = ear || shade(body, 0.7);

  // 5-step body palette
  const bodyHi2 = shade(body, 1.32);
  const bodyHi = shade(body, 1.18);
  const bodyMid = body;
  const bodyShade = shade(body, 0.75);
  const bodyDeep = shade(body, 0.5);
  const earHi = shade(earCol, 1.4);
  const earMid = earCol;
  const earShade = shade(earCol, 0.6);
  const earInner = '#ff8aa8';
  const maskHi = shade(mask, 1.6);
  const maskMid = mask;
  const maskShade = shade(mask, 0.4);

  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(scale, scale);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (facing === 'up') ctx.scale(1, -1);

  // ---------- DROP SHADOW ----------
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 14, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 14, 11, 2, 0, 0, Math.PI * 2); ctx.fill();

  const rect = (rx, ry, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, w, h); };

  // ---------- CURLY CORKSCREW TAIL (behind body) ----------
  if (tailVisible) {
    rect(-13, -9, 2, 2, bodyMid);
    rect(-15, -8, 2, 2, bodyMid);
    rect(-16, -6, 2, 2, bodyMid);
    rect(-16, -4, 2, 2, bodyMid);
    rect(-14, -3, 2, 2, bodyMid);
    rect(-12, -4, 2, 2, bodyMid);
    rect(-14, -6, 1, 2, bodyShade);
    rect(-15, -5, 1, 1, bodyDeep);
    rect(-14, -8, 1, 1, bodyHi);
    rect(-13, -9, 1, 1, bodyHi2);
  }

  // ---------- BODY (rounded oval, 5-step shading) ----------
  rect(-11, -10, 22, 14, bodyMid);
  rect(-10, -10, 20, 2, bodyHi);
  rect(-8, -11, 16, 1, bodyHi2);
  rect(-11, -9, 1, 2, bodyShade);
  rect(-10, -10, 1, 1, bodyShade);
  rect(10, -9, 1, 2, bodyShade);
  rect(9, -10, 1, 1, bodyShade);
  rect(-11, 2, 22, 2, bodyShade);
  rect(-9, 4, 18, 1, bodyDeep);
  rect(-11, 3, 1, 1, bodyDeep);
  rect(10, 3, 1, 1, bodyDeep);
  rect(10, -8, 1, 8, bodyShade);
  rect(-2, -3, 4, 2, bodyHi);
  rect(-1, -2, 2, 1, bodyHi2);

  // ---------- LEGS (4 stubby with paw pads) ----------
  rect(-8, 4, 5, 6, bodyShade);
  rect(-7, 4, 1, 5, bodyMid);
  rect(-8, 9, 5, 1, bodyDeep);
  rect(-7, 10, 3, 1, '#000');
  rect(3, 4, 5, 6, bodyShade);
  rect(4, 4, 1, 5, bodyMid);
  rect(3, 9, 5, 1, bodyDeep);
  rect(4, 10, 3, 1, '#000');
  rect(-10, 4, 5, 6, bodyMid);
  rect(-10, 4, 1, 6, bodyHi);
  rect(-10, 9, 5, 1, bodyDeep);
  rect(-9, 10, 3, 1, '#000');
  rect(5, 4, 5, 6, bodyMid);
  rect(5, 4, 1, 6, bodyHi);
  rect(5, 9, 5, 1, bodyDeep);
  rect(6, 10, 3, 1, '#000');

  // ---------- HEAD ----------
  rect(-10, -26, 20, 16, bodyMid);
  rect(-8, -28, 16, 2, bodyMid);
  rect(-6, -29, 12, 1, bodyMid);
  rect(-8, -28, 14, 2, bodyHi);
  rect(-6, -29, 8, 1, bodyHi2);
  rect(-10, -26, 2, 6, bodyHi);
  rect(-10, -26, 1, 4, bodyHi2);
  rect(9, -24, 1, 12, bodyShade);
  rect(8, -22, 1, 8, bodyShade);
  rect(-7, -12, 14, 1, bodyDeep);
  rect(-10, -26, 1, 1, bodyShade);
  rect(9, -26, 1, 1, bodyShade);

  // jowls
  rect(-11, -16, 2, 5, bodyMid);
  rect(9, -16, 2, 5, bodyMid);
  rect(-11, -16, 1, 5, bodyShade);
  rect(10, -16, 1, 5, bodyShade);
  rect(-10, -12, 2, 1, bodyDeep);
  rect(8, -12, 2, 1, bodyDeep);

  // ---------- BLACK MASK on face ----------
  rect(-7, -23, 14, 1, maskMid);
  rect(-8, -22, 16, 5, maskMid);
  rect(-9, -19, 3, 4, maskMid);
  rect(6, -19, 3, 4, maskMid);
  rect(-9, -22, 1, 5, maskShade);
  rect(8, -22, 1, 5, maskShade);
  rect(-7, -17, 14, 1, maskShade);
  rect(-5, -22, 10, 1, maskHi);

  // ---------- FOREHEAD WRINKLES ----------
  rect(-5, -25, 10, 1, bodyDeep);
  rect(-5, -26, 10, 1, bodyShade);
  rect(-4, -24, 8, 1, bodyDeep);
  rect(0, -24, 1, 3, bodyDeep);
  rect(-1, -25, 1, 1, bodyShade);

  // ---------- DROP EARS ----------
  rect(-14, -26, 5, 9, earMid);
  rect(-14, -26, 5, 1, earHi);
  rect(-14, -26, 1, 9, earShade);
  rect(-12, -23, 2, 4, earInner);
  rect(-12, -23, 2, 1, shade(earInner, 0.7));
  rect(-14, -18, 5, 1, earShade);
  rect(-13, -17, 3, 1, shade(earShade, 0.6));

  rect(9, -26, 5, 9, earMid);
  rect(9, -26, 5, 1, earHi);
  rect(13, -26, 1, 9, earShade);
  rect(10, -23, 2, 4, earInner);
  rect(10, -23, 2, 1, shade(earInner, 0.7));
  rect(9, -18, 5, 1, earShade);
  rect(10, -17, 3, 1, shade(earShade, 0.6));

  rect(-11, -19, 1, 3, bodyDeep);
  rect(10, -19, 1, 3, bodyDeep);

  // ---------- EYES ----------
  if (blink < 0.8) {
    // sclera (whites)
    rect(-7, -21, 6, 6, '#fff');
    rect(-7, -21, 6, 1, '#ddddee');
    rect(-7, -16, 6, 1, '#bbbbcc');
    rect(-8, -19, 1, 3, '#ddddee');
    rect(1, -21, 6, 6, '#fff');
    rect(1, -21, 6, 1, '#ddddee');
    rect(1, -16, 6, 1, '#bbbbcc');
    rect(7, -19, 1, 3, '#ddddee');
    // pupils
    const eyeBlinkH = Math.max(1, Math.round(4 * (1 - blink)));
    rect(-6, -20, 4, eyeBlinkH, '#000');
    rect(2, -20, 4, eyeBlinkH, '#000');
    // double catchlight
    rect(-5, -20, 1, 1, '#fff');
    rect(-5, -19, 1, 1, '#cce');
    rect(3, -20, 1, 1, '#fff');
    rect(3, -19, 1, 1, '#cce');
  } else {
    // closed eyes (blink)
    rect(-7, -19, 6, 1, '#000');
    rect(1, -19, 6, 1, '#000');
  }

  // ---------- NOSE + MUZZLE ----------
  rect(-2, -15, 4, 2, '#000');
  rect(-1, -15, 1, 1, '#444');
  rect(-2, -13, 4, 1, '#1a1a1a');

  // ---------- MOUTH + TONGUE ----------
  if (tongueOut) {
    rect(-3, -12, 6, 2, '#ff5a82');
    rect(-3, -12, 6, 1, '#ff8aab');
    rect(0, -12, 1, 2, '#d8345f');
    rect(-3, -10, 6, 1, '#a82048');
  } else {
    rect(-2, -12, 4, 1, maskShade);
  }

  // ---------- WHISKERS ----------
  if (whiskers) {
    rect(-10, -13, 3, 1, '#aaa');
    rect(7, -13, 3, 1, '#aaa');
    rect(-10, -14, 2, 1, '#888');
    rect(8, -14, 2, 1, '#888');
  }

  // ---------- ACCESSORIES ----------
  if (helmet) {
    rect(-12, -32, 24, 5, helmetColor);
    rect(-12, -32, 24, 1, shade(helmetColor, 1.5));
    rect(-2, -34, 4, 2, helmetColor);  // crest
    rect(-12, -28, 24, 1, shade(helmetColor, 0.6));
    // strap
    rect(-12, -25, 1, 2, '#222');
    rect(11, -25, 1, 2, '#222');
  }
  if (chef) {
    rect(-9, -34, 18, 5, '#fff');
    rect(-9, -34, 18, 1, '#eee');
    rect(-6, -38, 12, 4, '#fff');
    rect(-4, -40, 8, 2, '#fff');
    rect(-9, -29, 18, 1, '#cccccc');
  }
  if (hat) {
    rect(-12, -30, 24, 3, hatColor);
    rect(-9, -33, 18, 3, hatColor);
    rect(-9, -33, 18, 1, shade(hatColor, 1.3));
  }

  ctx.restore();
}

// Compact baseline-sized pug — convenience wrapper for HUD/icon use.
export function drawPugMini(ctx, x, y, opts = {}) {
  drawPug(ctx, x, y, { size: 22, tongueOut: false, tailVisible: false, ...opts });
}

// A "monster" variant — same silhouette but red eyes + sharper details.
// Useful for backrooms-pug.
export function drawMonsterPug(ctx, x, y, opts = {}) {
  const body = opts.body || '#5a0d0d';
  const mask = opts.mask || '#1a0000';
  const size = opts.size || 60;
  drawPug(ctx, x, y, {
    ...opts,
    size,
    body,
    mask,
    ear: shade(body, 0.65),
    tongueOut: false,
    tailVisible: false,
  });
  // Overlay glowing red eyes
  const scale = size / SRC_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  ctx.fillStyle = '#ff3a3a';
  ctx.fillRect(-6, -20, 4, 4);
  ctx.fillRect(2, -20, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-5, -19, 1, 1);
  ctx.fillRect(3, -19, 1, 1);
  // teeth
  ctx.fillStyle = '#fff';
  ctx.fillRect(-3, -11, 1, 2);
  ctx.fillRect(-1, -11, 1, 2);
  ctx.fillRect(1, -11, 1, 2);
  ctx.fillRect(3, -11, 1, 2);
  ctx.restore();
}
