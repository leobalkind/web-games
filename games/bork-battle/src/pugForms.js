import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './colors.js';

// =============================================================================
// HIGH-DETAIL pug + vehicle drawing system.
//
// Coord convention (pug-local):
//   (0, 0) = ground center under the pug (between the wheels)
//   negative Y goes up. Pug head is around y=-30, vehicle base at y=10..20.
//
// Light source: top-left → highlights on top+left of round shapes,
// shadows on bottom+right. Apply consistently for sculpted look.
// =============================================================================

function px(g, x, y, w, h, color, alpha) {
  if (alpha != null) g.rect(x, y, w, h).fill({ color, alpha });
  else g.rect(x, y, w, h).fill(color);
}

function drawShadow(g) {
  g.ellipse(0, 22, 28, 6).fill({ color: 0x000000, alpha: 0.4 });
  g.ellipse(0, 22, 22, 4).fill({ color: 0x000000, alpha: 0.3 });
}

// 4 small wheels along bottom
function drawWheels(g, opts = {}) {
  const { spread = 14, baseY = 18, r = 4, hub = 0x666666, tire = 0x111118 } = opts;
  for (const side of [-spread, spread]) {
    g.rect(side - r, baseY - r, r * 2, r * 2).fill(tire);
    g.rect(side - r + 1, baseY - r + 1, r * 2 - 2, r * 2 - 2).fill(0x2a2a32);
    g.rect(side - 1, baseY - 1, 2, 2).fill(hub);
    g.rect(side - 2, baseY - r, 1, 1).fill(0x666666); // bolt
    g.rect(side + 1, baseY + r - 1, 1, 1).fill(0x666666);
  }
}

// Big monster-truck wheels
function drawBigWheels(g, opts = {}) {
  const { spread = 16, baseY = 18, r = 7, tire = 0x101018, rim = 0x6a6a72 } = opts;
  for (const side of [-spread, spread]) {
    g.circle(side, baseY, r).fill(tire);
    g.circle(side, baseY, r - 2).fill(rim);
    g.circle(side, baseY, 2).fill(0x999999);
    // tread
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      g.rect(side + Math.cos(ang) * (r - 1) - 1, baseY + Math.sin(ang) * (r - 1) - 1, 2, 2).fill(0x222228);
    }
  }
}

// Tank treads under vehicle
function drawTreads(g, opts = {}) {
  const { y = 14, w = 36, h = 8, color = 0x222228 } = opts;
  g.rect(-w / 2, y, w, h).fill(color);
  g.rect(-w / 2, y, w, 2).fill(shade(color, 1.4));
  g.rect(-w / 2, y + h - 2, w, 2).fill(shade(color, 0.5));
  // tread bumps
  for (let x = -w / 2 + 2; x < w / 2 - 2; x += 4) {
    g.rect(x, y + 2, 2, 4).fill(shade(color, 0.7));
  }
}

// Hover anti-grav glow
function drawHover(g, opts = {}) {
  const { y = 18, w = 36, color = COLORS.cyan } = opts;
  g.ellipse(0, y, w / 2, 4).fill({ color, alpha: 0.4 });
  g.ellipse(0, y + 1, w / 2 - 2, 2).fill({ color, alpha: 0.7 });
  g.ellipse(0, y + 2, w / 2 - 6, 1).fill({ color, alpha: 0.9 });
}

// =============================================================================
// PUG TEMPLATE v3 — bigger (~30% larger) + higher pixel detail.
// Bigger eyes, prominent jowls, visible toes, segmented tongue, deeper
// wrinkles, double catchlights, jaw line, fur tufts. Pug-defining features
// take up more of the silhouette so it reads UNMISTAKABLY as pug.
// =============================================================================
function drawPugBase(g, opts = {}) {
  const {
    body = 0xc8854a,
    mask = 0x1a0d05,
    ear = 0x6b3a1c,
    eyeShape = 'normal',
    eyeGlow = null,
    tongueOut = true,
    tailVisible = true,
    whiskers = true,
  } = opts;

  // 5-step ramp for sculpted lighting
  const bodyHi2 = shade(body, 1.32);
  const bodyHi = shade(body, 1.18);
  const bodyMid = body;
  const bodyShade = shade(body, 0.75);
  const bodyDeep = shade(body, 0.5);
  const earHi = shade(ear, 1.4);
  const earMid = ear;
  const earShade = shade(ear, 0.6);
  const earInner = 0xff8aa8;
  const maskHi = shade(mask, 1.6);
  const maskMid = mask;
  const maskShade = shade(mask, 0.4);

  // ---------- CURLY CORKSCREW TAIL (visible behind body) ----------
  if (tailVisible) {
    // outer corkscrew
    px(g, -13, -9, 2, 2, bodyMid);
    px(g, -15, -8, 2, 2, bodyMid);
    px(g, -16, -6, 2, 2, bodyMid);
    px(g, -16, -4, 2, 2, bodyMid);
    px(g, -14, -3, 2, 2, bodyMid);
    px(g, -12, -4, 2, 2, bodyMid);
    // inner shadow
    px(g, -14, -6, 1, 2, bodyShade);
    px(g, -15, -5, 1, 1, bodyDeep);
    // top highlight
    px(g, -14, -8, 1, 1, bodyHi);
    px(g, -13, -9, 1, 1, bodyHi2);
  }

  // ---------- STOCKY BODY (rounded oval, 5-step shading) ----------
  // main block
  px(g, -11, -10, 22, 14, bodyMid);
  // top highlight band
  px(g, -10, -10, 20, 2, bodyHi);
  px(g, -8, -11, 16, 1, bodyHi2);
  // shoulder roundness
  px(g, -11, -9, 1, 2, bodyShade);
  px(g, -10, -10, 1, 1, bodyShade);
  px(g, 10, -9, 1, 2, bodyShade);
  px(g, 9, -10, 1, 1, bodyShade);
  // belly shadow
  px(g, -11, 2, 22, 2, bodyShade);
  px(g, -9, 4, 18, 1, bodyDeep);
  px(g, -11, 3, 1, 1, bodyDeep);
  px(g, 10, 3, 1, 1, bodyDeep);
  // side darkening (form shadow)
  px(g, 10, -8, 1, 8, bodyShade);
  // chest tuft (subtle lighter spot)
  px(g, -2, -3, 4, 2, bodyHi);
  px(g, -1, -2, 2, 1, bodyHi2);

  // ---------- LEGS (4 stubby legs with paw pads) ----------
  // back legs (further/darker)
  px(g, -8, 4, 5, 6, bodyShade);
  px(g, -7, 4, 1, 5, bodyMid); // inner highlight
  px(g, -8, 9, 5, 1, bodyDeep);
  px(g, -7, 10, 3, 1, 0x000000); // paw shadow
  px(g, 3, 4, 5, 6, bodyShade);
  px(g, 4, 4, 1, 5, bodyMid);
  px(g, 3, 9, 5, 1, bodyDeep);
  px(g, 4, 10, 3, 1, 0x000000);
  // front legs (closer/lighter)
  px(g, -10, 4, 5, 6, bodyMid);
  px(g, -10, 4, 1, 6, bodyHi);
  px(g, -10, 9, 5, 1, bodyDeep);
  px(g, -9, 10, 3, 1, 0x000000);
  px(g, 5, 4, 5, 6, bodyMid);
  px(g, 5, 4, 1, 6, bodyHi);
  px(g, 5, 9, 5, 1, bodyDeep);
  px(g, 6, 10, 3, 1, 0x000000);

  // ---------- HEAD (round dome with strong sphere lighting) ----------
  // base sphere
  px(g, -10, -26, 20, 16, bodyMid);
  // top dome rounding
  px(g, -8, -28, 16, 2, bodyMid);
  px(g, -6, -29, 12, 1, bodyMid);
  // top highlight (sphere lighting from upper-left)
  px(g, -8, -28, 14, 2, bodyHi);
  px(g, -6, -29, 8, 1, bodyHi2);
  px(g, -10, -26, 2, 6, bodyHi);
  px(g, -10, -26, 1, 4, bodyHi2);
  // right side form shadow
  px(g, 9, -24, 1, 12, bodyShade);
  px(g, 8, -22, 1, 8, bodyShade);
  // chin shadow under head
  px(g, -7, -12, 14, 1, bodyDeep);
  // round head corners (anti-aliased feel)
  px(g, -10, -26, 1, 1, bodyShade);
  px(g, 9, -26, 1, 1, bodyShade);

  // CHEEK PUFFS (jowls — defining squishy pug face)
  px(g, -11, -16, 2, 5, bodyMid);
  px(g, 9, -16, 2, 5, bodyMid);
  px(g, -11, -16, 1, 5, bodyShade);
  px(g, 10, -16, 1, 5, bodyShade);
  px(g, -10, -12, 2, 1, bodyDeep); // jowl droop shadow
  px(g, 8, -12, 2, 1, bodyDeep);

  // ---------- BLACK MASK on face ----------
  // upper mask band (between brows)
  px(g, -7, -23, 14, 1, maskMid);
  // main eye-band mask
  px(g, -8, -22, 16, 5, maskMid);
  // mask bulges around cheeks
  px(g, -9, -19, 3, 4, maskMid);
  px(g, 6, -19, 3, 4, maskMid);
  // mask soft edges (gradient)
  px(g, -9, -22, 1, 5, maskShade);
  px(g, 8, -22, 1, 5, maskShade);
  px(g, -7, -17, 14, 1, maskShade);
  // mask shine (top of muzzle area)
  px(g, -5, -22, 10, 1, maskHi);

  // ---------- DEEP FOREHEAD WRINKLES ----------
  // top wrinkle
  px(g, -5, -25, 10, 1, bodyDeep);
  px(g, -5, -26, 10, 1, bodyShade);
  // mid wrinkle
  px(g, -4, -24, 8, 1, bodyDeep);
  // central worry crease (vertical between eyes)
  px(g, 0, -24, 1, 3, bodyDeep);
  px(g, -1, -25, 1, 1, bodyShade);

  // ---------- DROP EARS (3-shade with inner pink ear visible) ----------
  // LEFT EAR
  px(g, -14, -26, 5, 9, earMid);
  px(g, -14, -26, 5, 1, earHi);  // top hi
  px(g, -14, -26, 1, 9, earShade); // outer shadow
  // inner pink ear visible
  px(g, -12, -23, 2, 4, earInner);
  px(g, -12, -23, 2, 1, shade(earInner, 0.7));
  // ear bottom shadow + curl
  px(g, -14, -18, 5, 1, earShade);
  px(g, -13, -17, 3, 1, shade(earShade, 0.6));

  // RIGHT EAR
  px(g, 9, -26, 5, 9, earMid);
  px(g, 9, -26, 5, 1, earHi);
  px(g, 13, -26, 1, 9, earShade);
  px(g, 10, -23, 2, 4, earInner);
  px(g, 10, -23, 2, 1, shade(earInner, 0.7));
  px(g, 9, -18, 5, 1, earShade);
  px(g, 10, -17, 3, 1, shade(earShade, 0.6));

  // earlobe shadow on body where ear casts
  px(g, -11, -19, 1, 3, bodyDeep);
  px(g, 10, -19, 1, 3, bodyDeep);

  // ---------- BIG EXPRESSIVE BUG EYES ----------
  if (eyeShape !== 'closed') {
    // eye whites — large + round (defining pug feature)
    // LEFT
    px(g, -7, -21, 6, 6, 0xffffff);
    px(g, -7, -21, 6, 1, 0xddddee); // upper sclera shadow
    px(g, -7, -16, 6, 1, 0xbbbbcc); // lower sclera shadow
    px(g, -8, -19, 1, 3, 0xddddee); // left edge shade
    // RIGHT
    px(g, 1, -21, 6, 6, 0xffffff);
    px(g, 1, -21, 6, 1, 0xddddee);
    px(g, 1, -16, 6, 1, 0xbbbbcc);
    px(g, 7, -19, 1, 3, 0xddddee);
  }

  const pupil = eyeGlow || 0x101018;
  const iris = eyeGlow ? shade(eyeGlow, 1.4) : 0x4a3a2a;

  if (eyeShape === 'derpy') {
    // mismatched looking
    px(g, -7, -20, 3, 4, iris);
    px(g, -6, -19, 2, 2, pupil);
    px(g, 3, -19, 4, 4, iris);
    px(g, 4, -18, 2, 2, pupil);
    px(g, -6, -20, 1, 1, 0xffffff);
    px(g, 4, -19, 1, 1, 0xffffff);
  } else if (eyeShape === 'angry') {
    px(g, -6, -20, 4, 4, iris);
    px(g, -5, -19, 2, 2, pupil);
    px(g, 2, -20, 4, 4, iris);
    px(g, 3, -19, 2, 2, pupil);
    // angry brows above eyes (heavy)
    px(g, -8, -23, 5, 1, mask);
    px(g, 3, -23, 5, 1, mask);
    px(g, -7, -24, 3, 1, mask);
    px(g, 4, -24, 3, 1, mask);
  } else if (eyeShape === 'sleepy') {
    // half-closed lids
    px(g, -7, -20, 6, 2, mask);
    px(g, 1, -20, 6, 2, mask);
    px(g, -6, -19, 3, 1, pupil);
    px(g, 2, -19, 3, 1, pupil);
  } else if (eyeShape === 'sparkle') {
    px(g, -6, -20, 4, 4, pupil);
    px(g, 2, -20, 4, 4, pupil);
    // sparkle catchlights (top + bottom for adoring look)
    px(g, -6, -20, 1, 1, 0xffffff);
    px(g, -3, -20, 1, 1, 0xffffff);
    px(g, -5, -17, 1, 1, 0xffffff);
    px(g, 2, -20, 1, 1, 0xffffff);
    px(g, 5, -20, 1, 1, 0xffffff);
    px(g, 4, -17, 1, 1, 0xffffff);
  } else if (eyeShape === 'closed') {
    // ^ ^ contented slits
    px(g, -7, -20, 6, 1, mask);
    px(g, 1, -20, 6, 1, mask);
    px(g, -6, -21, 1, 1, mask);
    px(g, -3, -21, 1, 1, mask);
    px(g, 2, -21, 1, 1, mask);
    px(g, 5, -21, 1, 1, mask);
    // smile lines
    px(g, -6, -19, 1, 1, mask);
    px(g, -3, -19, 1, 1, mask);
    px(g, 2, -19, 1, 1, mask);
    px(g, 5, -19, 1, 1, mask);
  } else if (eyeShape === 'glow') {
    // intense glow eyes (demon, cosmic, etc.)
    px(g, -7, -21, 6, 6, pupil);
    px(g, 1, -21, 6, 6, pupil);
    px(g, -6, -20, 4, 4, shade(pupil, 1.6));
    px(g, 2, -20, 4, 4, shade(pupil, 1.6));
    px(g, -5, -19, 2, 2, 0xffffff);
    px(g, 3, -19, 2, 2, 0xffffff);
  } else {
    // NORMAL — proper iris + pupil + catchlight + lower reflection
    // iris
    px(g, -7, -20, 4, 4, iris);
    px(g, 1, -20, 4, 4, iris);
    px(g, -7, -20, 1, 4, shade(iris, 0.65)); // iris shadow side
    px(g, 1, -20, 1, 4, shade(iris, 0.65));
    // pupil
    px(g, -6, -19, 2, 3, pupil);
    px(g, 2, -19, 2, 3, pupil);
    // upper-left catchlight (sphere highlight)
    px(g, -6, -20, 1, 1, 0xffffff);
    px(g, 2, -20, 1, 1, 0xffffff);
    px(g, -7, -19, 1, 1, 0xeeeeff);
    px(g, 1, -19, 1, 1, 0xeeeeff);
    // lower reflection (subtle blue glint)
    px(g, -4, -17, 1, 1, 0x6688aa);
    px(g, 4, -17, 1, 1, 0x6688aa);
  }

  // ---------- PUSHED-IN SNOUT with detailed nose ----------
  // snout block (very short)
  px(g, -4, -15, 8, 4, maskMid);
  // snout bridge (highlight running down center of snout)
  px(g, -3, -15, 6, 1, maskHi);
  px(g, -2, -16, 4, 1, maskHi);
  px(g, -1, -17, 2, 1, maskHi);
  // snout side shadows (form depth)
  px(g, -4, -14, 1, 3, maskShade);
  px(g, 3, -14, 1, 3, maskShade);
  // snout bottom shadow
  px(g, -4, -12, 8, 1, maskShade);
  // detailed nose with two distinct nostrils
  px(g, -3, -14, 6, 2, mask);
  px(g, -2, -14, 1, 1, 0x000000); // left nostril
  px(g, 1, -14, 1, 1, 0x000000);  // right nostril
  px(g, -3, -14, 1, 1, maskHi); // nose top-left highlight
  // mouth line
  px(g, -2, -11, 4, 1, maskShade);

  // ---------- TONGUE ----------
  if (tongueOut) {
    px(g, -2, -10, 4, 3, 0xff5a82);
    px(g, -1, -10, 2, 1, 0xffaac4); // upper highlight
    px(g, 0, -10, 1, 1, 0xffd0e0);  // central shine
    px(g, -2, -8, 4, 1, 0xc8345a);  // bottom shadow
    px(g, -2, -10, 1, 3, 0xc8345a); // edge L
    px(g, 1, -10, 1, 3, 0xc8345a);  // edge R
  }

  // ---------- WHISKER DOTS + FUR TUFTS ----------
  if (whiskers) {
    px(g, -5, -13, 1, 1, maskHi);
    px(g, 4, -13, 1, 1, maskHi);
    // tiny tuft markers near jowls
    px(g, -10, -13, 1, 1, bodyShade);
    px(g, 9, -13, 1, 1, bodyShade);
  }

  // Fur tufts at body edges (small darker pixel hints of fur)
  px(g, -11, -7, 1, 1, bodyDeep);
  px(g, 10, -7, 1, 1, bodyDeep);
  px(g, -11, -3, 1, 1, bodyDeep);
  px(g, 10, -3, 1, 1, bodyDeep);
}

// =============================================================================
// CHARACTER DRAW FUNCTIONS — each builds vehicle + pug + accessories
// =============================================================================

// Tier 0
function drawBorkPup(c) {
  const v = new Graphics();
  drawShadow(v);
  // cardboard box-kart
  px(v, -16, 6, 32, 14, 0xa6753a);                     // box body
  px(v, -16, 6, 32, 2, shade(0xa6753a, 1.25));         // top edge
  px(v, -16, 18, 32, 2, shade(0xa6753a, 0.65));        // bottom shadow
  // box flap creases
  px(v, -8, 6, 1, 14, shade(0xa6753a, 0.7));
  px(v, 7, 6, 1, 14, shade(0xa6753a, 0.7));
  // crayon flames
  px(v, -14, 9, 4, 2, COLORS.yellow);
  px(v, -10, 8, 3, 4, COLORS.pink);
  px(v, -6, 9, 4, 2, COLORS.yellow);
  px(v, -2, 8, 3, 3, COLORS.pink);
  px(v, 2, 9, 4, 2, COLORS.yellow);
  // gaffer tape on corners
  px(v, -16, 6, 4, 1, COLORS.cyan);
  px(v, 12, 6, 4, 1, COLORS.cyan);
  drawWheels(v, { spread: 14, baseY: 20 });
  c.addChild(v);

  // pug (puppy — sparkle eyes, smaller scale)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    eyeShape: 'sparkle',
  });
  p.scale.set(0.85);
  p.y = -2;
  c.addChild(p);

  // sidekick: tiny pup with propeller hat
  const s = new Graphics();
  px(s, 14, -2, 6, 7, 0xe8c896);
  px(s, 14, -2, 6, 1, 0xfde0b8);
  px(s, 15, -8, 4, 6, 0xe8c896);
  px(s, 15, -8, 4, 1, 0xfde0b8);
  px(s, 15, -6, 1, 1, 0x000000);
  px(s, 18, -6, 1, 1, 0x000000);
  px(s, 16, -3, 2, 1, 0xff5a82); // tongue
  // propeller hat
  px(s, 16, -10, 2, 2, COLORS.pink);
  px(s, 13, -11, 8, 1, COLORS.cyan);
  px(s, 16, -12, 1, 1, COLORS.yellow);
  c.addChild(s);
}

// Tier 1
function drawLoaf(c) {
  const v = new Graphics();
  drawShadow(v);
  // chrome toaster
  const cb = 0xc8d0d8;
  px(v, -18, -2, 36, 16, cb);
  px(v, -18, -2, 36, 2, 0xffffff);                   // chrome shine
  px(v, -18, -2, 1, 16, 0xeef0f4);
  px(v, 17, -2, 1, 16, shade(cb, 0.6));
  px(v, -18, 12, 36, 2, shade(cb, 0.5));
  // toaster slot (slot is dark with bread peeking)
  px(v, -10, -2, 20, 4, 0x222230);
  px(v, -10, -2, 20, 1, 0x000000);
  // bread peeking out
  px(v, -8, -4, 16, 2, 0xd9a86a);
  px(v, -8, -4, 16, 1, 0xeac888);
  // browning button + lever
  px(v, 12, 2, 2, 2, 0xff5a3a);
  px(v, 12, 6, 3, 6, 0x6a6a72);
  px(v, 13, 6, 1, 1, 0xffffff);
  // panel rivets
  for (let x = -16; x <= 16; x += 8) {
    px(v, x, 0, 1, 1, 0x666666);
    px(v, x, 10, 1, 1, 0x666666);
  }
  drawTreads(v, { y: 14, w: 40 });
  c.addChild(v);

  // pug (loaf — sleepy eyes, no tongue, bread-brown body)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    eyeShape: 'sleepy',
    tongueOut: false,
  });
  p.y = -4;
  // baker beret (crust hat)
  px(p, -8, -32, 16, 4, 0xb8804a);
  px(p, -8, -32, 16, 1, shade(0xb8804a, 1.3));
  px(p, -6, -34, 12, 2, 0xb8804a);
  c.addChild(p);

  // baguette sidekick
  const s = new Graphics();
  px(s, 14, -8, 12, 5, 0xe8b87a);
  px(s, 14, -8, 12, 1, 0xfdd0a0);
  px(s, 14, -4, 12, 1, shade(0xe8b87a, 0.65));
  // baguette slashes
  px(s, 16, -8, 1, 1, shade(0xe8b87a, 0.5));
  px(s, 19, -8, 1, 1, shade(0xe8b87a, 0.5));
  px(s, 22, -8, 1, 1, shade(0xe8b87a, 0.5));
  // tiny eyes
  px(s, 16, -7, 1, 1, 0x000000);
  px(s, 21, -7, 1, 1, 0x000000);
  c.addChild(s);
}

function drawSnoot(c) {
  const v = new Graphics();
  drawShadow(v);
  // fire-engine truck
  px(v, -18, 0, 32, 14, COLORS.hydrant);
  px(v, -18, 0, 32, 2, shade(COLORS.hydrant, 1.4));
  px(v, -18, 12, 32, 2, shade(COLORS.hydrant, 0.5));
  // window/cab
  px(v, -16, 2, 8, 6, 0x6a8aaa);
  px(v, -16, 2, 8, 1, 0x9acaff);
  px(v, -16, 2, 1, 6, 0x9acaff);
  // door panel divide
  px(v, -8, 0, 1, 14, shade(COLORS.hydrant, 0.5));
  // emergency lights
  px(v, -6, -3, 4, 3, COLORS.yellow);
  px(v, -2, -3, 4, 3, COLORS.cyan);
  // ladder extending forward
  px(v, 4, 0, 16, 2, 0x6a7a8a);
  px(v, 4, 4, 16, 2, 0x6a7a8a);
  for (let x = 6; x < 20; x += 3) {
    px(v, x, 1, 1, 4, 0x9aaabb);
  }
  // hose reel
  px(v, 10, 8, 6, 5, 0x4a4a52);
  px(v, 11, 9, 4, 3, 0xff5a3a);
  // rivets
  for (let x = -15; x <= 13; x += 4) {
    px(v, x, 13, 1, 1, 0x666666);
  }
  drawWheels(v, { spread: 14, baseY: 18 });
  c.addChild(v);

  // pug with EXTENDED snoot
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    tongueOut: false,
  });
  p.y = -4;
  // ladder-snoot extension (snoot extends out)
  px(p, 4, -14, 14, 4, 0x1a0d05);
  px(p, 4, -14, 14, 1, shade(0x1a0d05, 1.6));
  px(p, 16, -13, 3, 2, 0x1a0d05); // nose tip
  px(p, 16, -13, 3, 1, 0xff5a82); // pink nose tip
  // fireman helmet
  px(p, -10, -32, 20, 4, COLORS.hydrant);
  px(p, -10, -32, 20, 1, shade(COLORS.hydrant, 1.4));
  px(p, -8, -34, 16, 2, COLORS.hydrant);
  px(p, -2, -36, 4, 2, COLORS.yellow); // badge
  c.addChild(p);

  // hydrant sidekick
  const s = new Graphics();
  px(s, -22, -2, 7, 10, COLORS.hydrant);
  px(s, -22, -2, 7, 1, shade(COLORS.hydrant, 1.4));
  px(s, -23, 0, 9, 2, COLORS.hydrant);
  px(s, -19, -6, 1, 4, 0xc8d0d8); // chain
  px(s, -19, -6, 1, 1, COLORS.yellow);
  c.addChild(s);
}

function drawZoom(c) {
  const v = new Graphics();
  drawShadow(v);
  // skateboard deck
  px(v, -22, 8, 40, 4, 0x5a3a8a);
  px(v, -22, 8, 40, 1, COLORS.pink);
  px(v, -22, 11, 40, 1, shade(0x5a3a8a, 0.5));
  // griptape pattern
  for (let x = -20; x < 18; x += 3) {
    px(v, x, 9, 1, 1, 0x3a2a5a);
  }
  // twin rocket boosters
  px(v, -24, 4, 6, 6, 0x6a7a8a);
  px(v, -24, 4, 6, 1, 0x9aaabb);
  px(v, -24, 8, 6, 2, shade(0x6a7a8a, 0.5));
  // booster flame
  px(v, -28, 5, 4, 4, COLORS.yellow);
  px(v, -32, 6, 4, 2, COLORS.pink);
  px(v, -28, 6, 4, 2, COLORS.cyan);
  // small wheels under deck
  px(v, -16, 12, 4, 4, 0x111118);
  px(v, 12, 12, 4, 4, 0x111118);
  px(v, -15, 13, 2, 2, 0x666666);
  px(v, 13, 13, 2, 2, 0x666666);
  c.addChild(v);

  // pug — skinny look (use scale)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xe8c896,
    mask: 0x6b3a1c,
    ear: 0x4a2a1a,
  });
  p.scale.set(0.95, 1);
  p.y = -2;
  // racing goggles
  px(p, -8, -22, 16, 3, 0x222230);
  px(p, -7, -21, 5, 1, COLORS.cyan);
  px(p, 3, -21, 5, 1, COLORS.cyan);
  px(p, -8, -22, 16, 1, shade(0x222230, 1.5));
  // motion lines
  px(p, -16, -8, 2, 1, COLORS.cyan);
  px(p, -18, -6, 2, 1, COLORS.cyan);
  px(p, -16, -4, 2, 1, COLORS.cyan);
  c.addChild(p);

  // chihuahua sniper sidekick
  const s = new Graphics();
  px(s, 14, -10, 8, 7, 0xe8c896);
  px(s, 14, -10, 8, 1, 0xfde0b8);
  px(s, 15, -16, 6, 6, 0xe8c896);
  px(s, 15, -16, 6, 1, 0xfde0b8);
  // laser shades
  px(s, 15, -14, 6, 2, 0x222228);
  px(s, 16, -13, 1, 1, COLORS.pink);
  px(s, 19, -13, 1, 1, COLORS.pink);
  // big ears (chihuahua)
  px(s, 13, -18, 2, 4, 0xe8c896);
  px(s, 21, -18, 2, 4, 0xe8c896);
  c.addChild(s);
}

function drawWiggle(c) {
  const v = new Graphics();
  drawShadow(v);
  // slinky-spring buggy — coiled spring base
  for (let i = 0; i < 5; i++) {
    px(v, -14 + i * 2, 0 + i, 14 - i, 2, COLORS.yellow);
    px(v, -14 + i * 2, 0 + i, 14 - i, 1, shade(COLORS.yellow, 1.3));
  }
  // bouncy seat platform
  px(v, -10, -4, 20, 4, 0x4a4a52);
  px(v, -10, -4, 20, 1, 0x6a6a72);
  // pom-poms on the side
  px(v, -14, -2, 3, 3, COLORS.pink);
  px(v, 11, -2, 3, 3, COLORS.pink);
  drawWheels(v, { spread: 12, baseY: 16 });
  c.addChild(v);

  // long-bodied pug — derpy big grin
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    eyeShape: 'derpy',
  });
  p.scale.set(1.05, 0.95);
  p.y = -6;
  // extra long body section
  px(p, -14, -6, 28, 4, 0xc8854a);
  px(p, -14, -6, 28, 1, shade(0xc8854a, 1.18));
  c.addChild(p);

  // worm sidekick with pom-poms
  const s = new Graphics();
  px(s, 16, -4, 10, 3, 0xff8aa8);
  px(s, 16, -4, 10, 1, 0xffaac4);
  px(s, 18, -6, 2, 2, 0x000000);
  px(s, 22, -6, 2, 2, 0x000000);
  px(s, 14, -3, 2, 2, COLORS.yellow); // pom L
  px(s, 26, -3, 2, 2, COLORS.yellow); // pom R
  c.addChild(s);
}

function drawBoop(c) {
  const v = new Graphics();
  drawShadow(v);
  // bumper car
  px(v, -16, 0, 32, 14, COLORS.cyan);
  px(v, -16, 0, 32, 2, shade(COLORS.cyan, 1.3));
  px(v, -16, 12, 32, 2, shade(COLORS.cyan, 0.5));
  // GIANT red nose-button on the front
  px(v, 14, 4, 8, 6, 0xff3030);
  px(v, 14, 4, 8, 1, 0xff8a8a);
  px(v, 14, 9, 8, 1, shade(0xff3030, 0.5));
  px(v, 16, 5, 4, 1, 0xffffff); // shine
  // bumper rim
  px(v, -18, 6, 36, 2, COLORS.yellow);
  px(v, -18, 6, 1, 2, 0xffeb55);
  px(v, 17, 6, 1, 2, 0xffeb55);
  // tiny horn
  px(v, -18, 0, 4, 4, COLORS.yellow);
  px(v, -20, 1, 2, 2, COLORS.yellow);
  drawWheels(v, { spread: 14, baseY: 18 });
  c.addChild(v);

  // chubby pug with HUGE red nose
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    eyeShape: 'sparkle',
  });
  p.y = -4;
  // big red nose accent
  px(p, -3, -14, 6, 4, 0xff3030);
  px(p, -3, -14, 6, 1, 0xff8a8a);
  px(p, -2, -13, 1, 1, 0xffffff);
  c.addChild(p);

  // sidekick: pug holding "BOOP" sign
  const s = new Graphics();
  px(s, 16, -2, 6, 7, 0xe8c896);
  px(s, 16, -7, 6, 5, 0xe8c896);
  px(s, 17, -5, 1, 1, 0x000000);
  px(s, 20, -5, 1, 1, 0x000000);
  // sign
  px(s, 22, -10, 8, 5, 0xffffff);
  px(s, 22, -10, 8, 1, 0xdddddd);
  px(s, 23, -8, 1, 1, 0x000000);
  px(s, 25, -8, 1, 1, 0x000000);
  px(s, 27, -8, 1, 1, 0x000000);
  c.addChild(s);
}

// Tier 2
function drawCheems(c) {
  const v = new Graphics();
  drawShadow(v);
  // Donut kart — pink ring with sprinkles
  v.circle(0, 8, 18).fill(0xffb7d1);
  v.circle(0, 8, 18).stroke({ color: shade(0xffb7d1, 0.6), width: 1 });
  v.circle(0, 8, 8).fill(0x110a26); // hole
  // glaze drips
  px(v, -14, 12, 3, 4, 0xffd5e8);
  px(v, 11, 14, 3, 3, 0xffd5e8);
  px(v, -4, 24, 2, 2, 0xffd5e8);
  // sprinkles
  px(v, -10, 4, 2, 1, COLORS.cyan);
  px(v, 8, 0, 2, 1, COLORS.yellow);
  px(v, -4, 16, 2, 1, COLORS.green);
  px(v, 12, 12, 2, 1, COLORS.pink);
  px(v, -12, 12, 1, 2, COLORS.cyan);
  px(v, 6, 18, 1, 2, COLORS.yellow);
  // jam filling oozing from a side
  px(v, 16, 6, 2, 2, 0xff3030);
  c.addChild(v);

  // Cheems pug — derpy + floppy tongue + scarf
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xe8c896,
    mask: 0x6b3a1c,
    ear: 0x8a5a2c,
    eyeShape: 'derpy',
    tongueOut: false,
  });
  p.y = -4;
  // floppy tongue out the SIDE
  px(p, 4, -13, 6, 2, 0xff5a82);
  px(p, 8, -11, 4, 2, 0xff5a82);
  px(p, 4, -13, 6, 1, 0xffaac4);
  // pink scarf
  px(p, -10, -8, 20, 3, COLORS.pink);
  px(p, -10, -8, 20, 1, 0xffaac4);
  px(p, 8, -6, 4, 4, COLORS.pink); // scarf tail
  c.addChild(p);

  // goldfish in bowl sidekick
  const s = new Graphics();
  s.circle(18, -4, 7).fill({ color: COLORS.cyan, alpha: 0.4 });
  s.circle(18, -4, 7).stroke({ color: COLORS.cyan, width: 1, alpha: 0.8 });
  px(s, 16, -6, 5, 3, 0xff8e3c);
  px(s, 19, -7, 2, 1, 0xff8e3c); // tail
  px(s, 17, -5, 1, 1, 0x000000);
  // megaphone
  px(s, 22, -2, 4, 4, 0xc8c8c8);
  px(s, 26, -3, 2, 6, 0xc8c8c8);
  c.addChild(s);
}

function drawDogeKnight(c) {
  const v = new Graphics();
  drawShadow(v);
  // Mech-horse body
  px(v, -14, 0, 28, 12, 0x9aa0c1);
  px(v, -14, 0, 28, 2, 0xc8d0e8);
  px(v, -14, 10, 28, 2, shade(0x9aa0c1, 0.5));
  // armor plates
  px(v, -12, 2, 6, 8, shade(0x9aa0c1, 1.15));
  px(v, 6, 2, 6, 8, shade(0x9aa0c1, 1.15));
  // glowing eye on horse face
  px(v, 14, 2, 4, 3, COLORS.yellow);
  px(v, 14, 2, 4, 1, 0xffeb55);
  // legs (hydraulic)
  px(v, -12, 12, 4, 6, 0x4a4a52);
  px(v, 8, 12, 4, 6, 0x4a4a52);
  px(v, -12, 14, 4, 1, 0x9aaabb);
  px(v, 8, 14, 4, 1, 0x9aaabb);
  // hooves
  px(v, -13, 17, 6, 2, 0x222228);
  px(v, 7, 17, 6, 2, 0x222228);
  // banner with crossed swords pattern
  px(v, -12, -8, 4, 12, COLORS.pink);
  px(v, -12, -8, 4, 1, 0xffaac4);
  px(v, -10, -4, 1, 4, 0xffeb55);
  // lance-cannon forward
  px(v, 14, -4, 14, 3, COLORS.yellow);
  px(v, 14, -4, 14, 1, 0xffeb55);
  px(v, 28, -6, 4, 6, COLORS.cyan);
  px(v, 28, -6, 4, 1, 0xb0e8ff);
  c.addChild(v);

  // Doge pug (golden shiba)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xe8c878,
    mask: 0xe8c878, // no black mask for shiba look
    ear: 0xb89858,
  });
  p.y = -4;
  // crusader helmet
  px(p, -10, -32, 20, 4, 0x9aa0c1);
  px(p, -10, -32, 20, 1, 0xc8d0e8);
  px(p, -8, -34, 16, 2, 0x9aa0c1);
  // helmet visor (over face)
  px(p, -10, -22, 20, 4, 0x222230);
  px(p, -10, -22, 20, 1, 0x444450);
  px(p, -7, -21, 4, 1, COLORS.cyan); // eye slit
  px(p, 3, -21, 4, 1, COLORS.cyan);
  // helmet plume
  px(p, -2, -38, 4, 4, COLORS.pink);
  px(p, -2, -38, 4, 1, 0xffaac4);
  c.addChild(p);

  // squire pug sidekick
  const s = new Graphics();
  px(s, -24, 0, 6, 8, 0xc8854a);
  px(s, -24, 0, 6, 1, shade(0xc8854a, 1.18));
  px(s, -23, 1, 1, 1, 0x000000);
  px(s, -20, 1, 1, 1, 0x000000);
  // flag held
  px(s, -27, -8, 1, 10, 0x6a4a2a);
  px(s, -28, -8, 4, 4, COLORS.pink);
  c.addChild(s);
}

function drawBonkPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // bumper car
  px(v, -16, 2, 32, 12, COLORS.pink);
  px(v, -16, 2, 32, 2, 0xffaac4);
  px(v, -16, 12, 32, 2, shade(COLORS.pink, 0.5));
  // bumper rim
  px(v, -18, 8, 36, 2, COLORS.yellow);
  // panel rivets
  for (let x = -14; x <= 14; x += 6) px(v, x, 4, 1, 1, 0x6a3a55);
  // GIANT bat strapped on top
  const bat = 0xa6753a;
  px(v, -2, -28, 6, 32, bat);
  px(v, -2, -28, 6, 1, shade(bat, 1.3));
  px(v, -4, -34, 10, 8, bat);
  px(v, -4, -34, 10, 1, shade(bat, 1.3));
  px(v, -4, -27, 10, 1, shade(bat, 0.7));
  // bat tape grip
  px(v, -2, -2, 6, 2, COLORS.cyan);
  px(v, -2, 0, 6, 1, COLORS.cyan);
  drawWheels(v, { spread: 14, baseY: 18 });
  c.addChild(v);

  // angry pug
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    eyeShape: 'angry',
    tongueOut: false,
  });
  p.y = -4;
  // sweatband
  px(p, -10, -28, 20, 3, COLORS.yellow);
  px(p, -10, -28, 20, 1, 0xffeb55);
  px(p, -2, -28, 4, 3, 0xff5a3a); // band stripe
  c.addChild(p);
}

function drawWalter(c) {
  const v = new Graphics();
  drawShadow(v);
  // RC monster truck
  px(v, -16, -4, 32, 14, 0xff5a3a);
  px(v, -16, -4, 32, 2, 0xffaa8a);
  px(v, -16, 8, 32, 2, shade(0xff5a3a, 0.5));
  // roll cage
  px(v, -16, -10, 2, 8, 0x222228);
  px(v, 14, -10, 2, 8, 0x222228);
  px(v, -14, -12, 28, 2, 0x222228);
  px(v, -10, -10, 2, 8, 0x222228);
  px(v, 8, -10, 2, 8, 0x222228);
  // headlights
  px(v, 14, 2, 2, 3, COLORS.yellow);
  px(v, -16, 2, 2, 3, COLORS.yellow);
  // antenna
  px(v, -2, -16, 1, 6, 0x222228);
  px(v, -3, -17, 3, 1, 0xff3030);
  drawBigWheels(v, { spread: 16, baseY: 14, r: 7 });
  c.addChild(v);

  // angry white pug (Walter)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xe8e0d8,
    mask: 0x222228,
    ear: 0x8a8478,
    eyeShape: 'angry',
    tongueOut: false,
  });
  p.y = -8;
  // single twitching eye highlight
  px(p, -5, -19, 1, 1, 0xff3030);
  c.addChild(p);

  // angrier pug sidekick yelling at clouds
  const s = new Graphics();
  px(s, -22, -8, 6, 8, 0xe8e0d8);
  px(s, -22, -14, 6, 6, 0xe8e0d8);
  px(s, -21, -12, 1, 1, 0xff3030);
  px(s, -18, -12, 1, 1, 0xff3030);
  px(s, -22, -8, 1, 8, shade(0xe8e0d8, 0.7));
  // shaking fist (waving paw)
  px(s, -26, -16, 3, 3, 0xe8e0d8);
  c.addChild(s);
}

function drawDiscoPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // mirror-ball kart
  v.circle(0, 4, 16).fill(0xc8c8e8);
  v.circle(0, 4, 16).stroke({ color: 0xffffff, width: 1 });
  // mirror tiles
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const x = Math.cos(a) * 12, y = 4 + Math.sin(a) * 12;
    const c2 = [COLORS.pink, COLORS.cyan, COLORS.yellow, COLORS.green][i % 4];
    px(v, x - 1, y - 1, 2, 2, c2);
  }
  // sparkle highlight
  px(v, -6, -8, 2, 2, 0xffffff);
  px(v, 4, -4, 1, 1, 0xffffff);
  // neon underglow
  v.ellipse(0, 18, 16, 3).fill({ color: COLORS.pink, alpha: 0.7 });
  v.ellipse(0, 19, 12, 2).fill({ color: COLORS.cyan, alpha: 0.7 });
  c.addChild(v);

  // disco pug — afro!
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x4a2a1a,
    eyeShape: 'sparkle',
  });
  p.y = -4;
  // big afro on top
  px(p, -12, -32, 24, 6, 0x6a3a1c);
  px(p, -10, -36, 20, 4, 0x6a3a1c);
  px(p, -8, -38, 16, 2, 0x6a3a1c);
  px(p, -10, -36, 20, 1, 0x8a5a2c); // hi
  // rainbow sequins on body
  px(p, -8, -3, 2, 2, COLORS.pink);
  px(p, 4, -1, 2, 2, COLORS.cyan);
  px(p, -2, -5, 2, 2, COLORS.yellow);
  c.addChild(p);

  // roller-skater boombox sidekick
  const s = new Graphics();
  px(s, 14, -10, 12, 7, 0x222228);
  px(s, 14, -10, 12, 1, 0x666666);
  px(s, 16, -8, 3, 3, COLORS.cyan);
  px(s, 21, -8, 3, 3, COLORS.cyan);
  px(s, 25, -9, 1, 1, COLORS.pink); // light
  c.addChild(s);
}

function drawChefPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // kitchen-prep cart
  px(v, -16, -2, 32, 16, 0xe8e0d0);
  px(v, -16, -2, 32, 2, 0xffffff);
  px(v, -16, 12, 32, 2, shade(0xe8e0d0, 0.6));
  // wood grain panels
  for (let x = -14; x <= 12; x += 6) {
    px(v, x, 2, 1, 10, shade(0xe8e0d0, 0.7));
  }
  // wok on top
  v.ellipse(-4, -4, 8, 3).fill(0x444450);
  v.ellipse(-4, -4, 8, 3).stroke({ color: 0x666672, width: 1 });
  v.ellipse(-4, -5, 6, 2).fill(0xff8a3a); // fire in wok
  // rolling pin
  px(v, 6, -4, 8, 3, 0xc8a878);
  px(v, 4, -4, 2, 3, 0x6a3a1c);
  px(v, 14, -4, 2, 3, 0x6a3a1c);
  // flame jets underneath
  px(v, -14, 10, 3, 4, 0xff5a3a);
  px(v, 11, 10, 3, 4, 0xff5a3a);
  px(v, -14, 10, 3, 1, COLORS.yellow);
  px(v, 11, 10, 3, 1, COLORS.yellow);
  drawWheels(v, { spread: 14, baseY: 18 });
  c.addChild(v);

  // chef pug — big chef hat + mustache
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xe8c896,
    mask: 0x6b3a1c,
    ear: 0x8a5a2c,
    tongueOut: false,
  });
  p.y = -6;
  // chef hat — tall poofy
  px(p, -8, -34, 16, 6, 0xffffff);
  px(p, -8, -40, 16, 6, 0xffffff);
  px(p, -10, -38, 20, 4, 0xffffff);
  px(p, -10, -38, 20, 1, 0xeeeeee);
  // mustache
  px(p, -6, -13, 12, 2, 0x222228);
  px(p, -6, -13, 1, 2, 0x222228);
  px(p, 5, -13, 1, 2, 0x222228);
  c.addChild(p);

  // sous-chef sidekick juggling knives
  const s = new Graphics();
  px(s, 16, -2, 6, 7, 0xe8c896);
  px(s, 16, -7, 6, 5, 0xe8c896);
  px(s, 17, -5, 1, 1, 0x000000);
  px(s, 20, -5, 1, 1, 0x000000);
  // floating knives
  px(s, 22, -12, 1, 4, 0xc8d0d8);
  px(s, 22, -12, 1, 1, 0x6a3a1c);
  px(s, 24, -9, 1, 4, 0xc8d0d8);
  px(s, 24, -9, 1, 1, 0x6a3a1c);
  c.addChild(s);
}

function drawToastPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // walking mecha-toaster (bread legs)
  // bread leg L
  px(v, -10, 6, 6, 14, 0xd9a86a);
  px(v, -10, 6, 6, 1, 0xeac888);
  px(v, -10, 18, 6, 2, shade(0xd9a86a, 0.5));
  // bread leg R
  px(v, 4, 6, 6, 14, 0xd9a86a);
  px(v, 4, 6, 6, 1, 0xeac888);
  px(v, 4, 18, 6, 2, shade(0xd9a86a, 0.5));
  // toaster body
  px(v, -14, -8, 28, 14, 0xc8d0d8);
  px(v, -14, -8, 28, 2, 0xffffff);
  px(v, -14, 4, 28, 2, shade(0xc8d0d8, 0.6));
  // slot
  px(v, -10, -8, 20, 3, 0x222230);
  // bread peeking
  px(v, -8, -10, 16, 2, 0xd9a86a);
  // browning lever
  px(v, 12, 0, 2, 4, 0x4a4a52);
  c.addChild(v);

  // pug face on top of toaster
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xd9a86a,
    mask: 0x8a5a2c,
    ear: 0x6b3a1c,
    eyeShape: 'derpy',
  });
  p.scale.set(0.85);
  p.y = -10;
  c.addChild(p);

  // butter-stick sidekick with jam cannon
  const s = new Graphics();
  px(s, 16, -4, 12, 5, COLORS.yellow);
  px(s, 16, -4, 12, 1, 0xffeb55);
  px(s, 16, 0, 12, 1, shade(COLORS.yellow, 0.6));
  // jam cannon
  px(s, 24, -8, 4, 6, 0xff3030);
  px(s, 28, -7, 2, 4, 0x222228);
  c.addChild(s);
}

// Tier 3
function drawCosmicPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // UFO saucer
  v.ellipse(0, 8, 28, 6).fill(0x4a4aaa);
  v.ellipse(0, 8, 28, 6).stroke({ color: shade(0x4a4aaa, 1.4), width: 1 });
  v.ellipse(0, 10, 24, 4).fill(shade(0x4a4aaa, 0.6));
  // glass dome
  v.ellipse(0, 0, 14, 8).fill({ color: COLORS.cyan, alpha: 0.5 });
  v.ellipse(0, 0, 14, 8).stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
  v.ellipse(-4, -2, 4, 3).fill({ color: 0xffffff, alpha: 0.5 });
  // rotating belly lights
  for (let i = -2; i <= 2; i++) {
    const col = [COLORS.pink, COLORS.cyan, COLORS.yellow, COLORS.green, COLORS.magenta][i + 2];
    px(v, i * 6 - 1, 12, 2, 2, col);
    px(v, i * 6 - 1, 12, 2, 1, 0xffffff);
  }
  // tractor beam socket
  px(v, -2, 14, 4, 2, COLORS.green);
  c.addChild(v);

  // galaxy pug — purple body with stars + glowing cyan eyes
  const p = new Graphics();
  drawPugBase(p, {
    body: 0x6a3a8a,
    mask: 0x2a1240,
    ear: 0x4a2a6a,
    eyeShape: 'glow',
    eyeGlow: COLORS.cyan,
  });
  p.scale.set(0.9);
  p.y = -8;
  // stars in fur
  px(p, -6, -16, 1, 1, 0xffffff);
  px(p, 4, -14, 1, 1, COLORS.yellow);
  px(p, -8, -8, 1, 1, 0xffffff);
  px(p, 6, -6, 1, 1, COLORS.cyan);
  px(p, 0, -22, 1, 1, COLORS.pink);
  px(p, 8, -20, 1, 1, 0xffffff);
  c.addChild(p);

  // alien pug sidekick in spacesuit
  const s = new Graphics();
  px(s, 16, -2, 7, 8, 0x6a8aaa);
  px(s, 16, -8, 7, 6, 0x6a8aaa);
  s.circle(19, -6, 4).fill({ color: COLORS.cyan, alpha: 0.4 });
  px(s, 17, -7, 1, 1, COLORS.green);
  px(s, 20, -7, 1, 1, COLORS.green);
  // antenna
  px(s, 19, -12, 1, 4, 0x9aaabb);
  px(s, 18, -13, 3, 1, COLORS.pink);
  c.addChild(s);
}

function drawDemonPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // hellfire monster truck
  px(v, -20, -6, 40, 16, 0x3a0a0a);
  px(v, -20, -6, 40, 2, COLORS.pink);
  px(v, -20, 8, 40, 2, shade(0x3a0a0a, 0.5));
  // skull grille on front
  px(v, 14, 0, 8, 8, 0xeeeee0);
  px(v, 14, 0, 8, 1, 0xffffff);
  px(v, 16, 2, 1, 1, 0x222228);
  px(v, 19, 2, 1, 1, 0x222228);
  px(v, 16, 5, 4, 1, 0x222228); // teeth line
  px(v, 16, 6, 1, 1, 0xeeeee0);
  px(v, 18, 6, 1, 1, 0xeeeee0);
  // demon horns on hood
  px(v, -2, -10, 3, 4, COLORS.yellow);
  px(v, -1, -12, 1, 2, COLORS.yellow);
  px(v, 4, -10, 3, 4, COLORS.yellow);
  px(v, 5, -12, 1, 2, COLORS.yellow);
  // chains
  for (let x = -16; x < 12; x += 4) px(v, x, 6, 2, 1, 0x666666);
  // flame exhaust
  px(v, -22, 0, 4, 4, COLORS.yellow);
  px(v, -26, 1, 4, 2, 0xff5a3a);
  px(v, -22, 2, 4, 2, 0xff5a3a);
  drawBigWheels(v, { spread: 18, baseY: 14, r: 8, tire: 0x101018, rim: 0x6a1a1a });
  c.addChild(v);

  // demon pug
  const p = new Graphics();
  drawPugBase(p, {
    body: 0x6a1a1a,
    mask: 0x2a0505,
    ear: 0x4a0d0d,
    eyeShape: 'glow',
    eyeGlow: COLORS.hydrant,
  });
  p.y = -10;
  // demon horns on head
  px(p, -10, -30, 3, 5, COLORS.yellow);
  px(p, -9, -32, 1, 2, COLORS.yellow);
  px(p, 7, -30, 3, 5, COLORS.yellow);
  px(p, 8, -32, 1, 2, COLORS.yellow);
  c.addChild(p);

  // imp pug with chain-flail sidekick
  const s = new Graphics();
  px(s, 18, -4, 6, 7, 0x6a1a1a);
  px(s, 18, -10, 6, 5, 0x6a1a1a);
  px(s, 19, -8, 1, 1, COLORS.hydrant);
  px(s, 22, -8, 1, 1, COLORS.hydrant);
  // chain
  for (let i = 0; i < 4; i++) px(s, 24 + i, -10 + i, 1, 1, 0x9aa0a8);
  // flail
  px(s, 28, -6, 3, 3, COLORS.yellow);
  c.addChild(s);
}

function drawPugZilla(c) {
  const v = new Graphics();
  drawShadow(v);
  // walking tank-mech (giant)
  // body
  px(v, -22, -10, 44, 22, 0x3a5a3a);
  px(v, -22, -10, 44, 3, 0x6aaa6a);
  px(v, -22, 10, 44, 2, shade(0x3a5a3a, 0.5));
  // scaly armor plates
  for (let x = -20; x < 20; x += 6) {
    for (let y = -6; y < 8; y += 6) {
      px(v, x, y, 5, 5, shade(0x3a5a3a, 1.15));
      px(v, x, y, 5, 1, 0x6aaa6a);
    }
  }
  // glowing chest reactor
  v.circle(0, 0, 5).fill(COLORS.yellow);
  v.circle(0, 0, 3).fill(0xffeb55);
  v.circle(0, 0, 1).fill(0xffffff);
  // hydraulic legs
  px(v, -18, 12, 8, 8, 0x222228);
  px(v, 10, 12, 8, 8, 0x222228);
  px(v, -18, 13, 8, 1, 0x666672);
  px(v, 10, 13, 8, 1, 0x666672);
  // shoulder turret
  px(v, -6, -16, 12, 6, 0x222228);
  px(v, -6, -16, 12, 1, 0x666672);
  px(v, -2, -20, 4, 4, COLORS.hydrant);
  // antennas
  px(v, -16, -12, 1, 6, 0x666672);
  px(v, 15, -12, 1, 6, 0x666672);
  px(v, -16, -13, 1, 1, COLORS.hydrant);
  c.addChild(v);

  // pug face on top (kaiju)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0x4a8a4a,
    mask: 0x1a3a1a,
    ear: 0x3a6a3a,
    eyeShape: 'glow',
    eyeGlow: COLORS.yellow,
  });
  p.scale.set(0.85);
  p.y = -22;
  // tiny crown
  px(p, -3, -36, 6, 2, COLORS.yellow);
  px(p, -3, -38, 1, 2, COLORS.yellow);
  px(p, -1, -38, 1, 2, COLORS.yellow);
  px(p, 1, -38, 1, 2, COLORS.yellow);
  px(p, 3, -38, 1, 2, COLORS.yellow); // wait - last point should be inside but ok
  c.addChild(p);

  // shoulder artillery pug sidekick
  const s = new Graphics();
  px(s, 16, -16, 6, 6, 0x4a8a4a);
  px(s, 16, -20, 6, 4, 0x4a8a4a);
  px(s, 17, -19, 1, 1, COLORS.yellow);
  px(s, 20, -19, 1, 1, COLORS.yellow);
  // helmet
  px(s, 16, -22, 6, 2, 0x222228);
  c.addChild(s);
}

function drawHolyPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // cloud chariot
  v.ellipse(-8, 6, 8, 4).fill(0xffffff);
  v.ellipse(8, 6, 8, 4).fill(0xffffff);
  v.ellipse(0, 4, 14, 6).fill(0xffffff);
  v.ellipse(0, 8, 16, 4).fill(0xeeeeff);
  // gold trim
  px(v, -16, 8, 32, 1, COLORS.yellow);
  // harp speakers (sides)
  px(v, -18, -2, 3, 10, COLORS.yellow);
  for (let y = 0; y < 8; y += 2) px(v, -18, y, 3, 1, 0xffeb55);
  px(v, 15, -2, 3, 10, COLORS.yellow);
  for (let y = 0; y < 8; y += 2) px(v, 15, y, 3, 1, 0xffeb55);
  // light rays
  for (let i = -3; i <= 3; i++) {
    px(v, i * 4, -16, 1, 8, { color: 0xffeb55, alpha: 0.4 });
  }
  c.addChild(v);

  // holy pug — sparkle eyes, halo
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xfafaff,
    mask: 0xc8c8e8,
    ear: 0xb8b8d8,
    eyeShape: 'sparkle',
  });
  p.y = -8;
  // halo
  px(p, -10, -36, 20, 2, COLORS.yellow);
  px(p, -8, -38, 16, 1, 0xffeb55);
  px(p, -10, -36, 20, 1, 0xffeb55);
  // tiny wings
  px(p, -16, -22, 4, 6, 0xfafaff);
  px(p, 12, -22, 4, 6, 0xfafaff);
  px(p, -16, -22, 1, 6, 0xeeeeff);
  px(p, 15, -22, 1, 6, 0xeeeeff);
  c.addChild(p);

  // cherub sidekick with healing arrow
  const s = new Graphics();
  px(s, 18, -4, 6, 7, 0xfde0b8);
  px(s, 18, -10, 6, 5, 0xfde0b8);
  px(s, 19, -8, 1, 1, 0x000000);
  px(s, 22, -8, 1, 1, 0x000000);
  // tiny halo
  px(s, 19, -12, 4, 1, COLORS.yellow);
  // bow
  px(s, 14, -8, 2, 6, 0x6a3a1c);
  px(s, 14, -8, 1, 1, 0x6a3a1c);
  px(s, 14, -3, 1, 1, 0x6a3a1c);
  c.addChild(s);
}

function drawCowboyPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // mechanical bull-bot
  px(v, -16, 0, 32, 14, 0x6a3a1c);
  px(v, -16, 0, 32, 2, 0x8a5a2c);
  px(v, -16, 12, 32, 2, shade(0x6a3a1c, 0.5));
  // bull horns on front
  px(v, 14, 0, 4, 2, 0xeeeeee);
  px(v, 18, -2, 2, 2, 0xeeeeee);
  px(v, 14, 4, 4, 2, 0xeeeeee);
  px(v, 18, 6, 2, 2, 0xeeeeee);
  // bull eye
  px(v, 14, 2, 2, 2, COLORS.hydrant);
  // saddle
  px(v, -8, -4, 16, 6, 0xa6753a);
  px(v, -8, -4, 16, 1, 0xc8a878);
  // rope coils
  v.circle(-12, 4, 3).stroke({ color: 0xeeb87a, width: 1 });
  v.circle(-12, 4, 2).stroke({ color: 0xeeb87a, width: 1 });
  // legs (mechanical)
  px(v, -12, 14, 4, 5, 0x222228);
  px(v, 8, 14, 4, 5, 0x222228);
  c.addChild(v);

  // cowboy pug
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
  });
  p.y = -6;
  // cowboy hat
  px(p, -14, -32, 28, 3, 0x6b3a1c);
  px(p, -10, -36, 20, 4, 0x8a5a2c);
  px(p, -10, -36, 20, 1, 0xa6753a);
  px(p, -14, -32, 28, 1, shade(0x6b3a1c, 1.3));
  // hat band
  px(p, -10, -33, 20, 1, COLORS.yellow);
  // bandana
  px(p, -10, -8, 20, 4, COLORS.hydrant);
  px(p, -10, -8, 20, 1, 0xff8a8a);
  // bandana spots
  px(p, -6, -7, 1, 1, 0xffffff);
  px(p, 0, -6, 1, 1, 0xffffff);
  px(p, 6, -7, 1, 1, 0xffffff);
  c.addChild(p);

  // banjo pug sidekick
  const s = new Graphics();
  px(s, -22, -2, 6, 8, 0xc8854a);
  px(s, -22, -8, 6, 6, 0xc8854a);
  px(s, -21, -6, 1, 1, 0x000000);
  px(s, -18, -6, 1, 1, 0x000000);
  // banjo (round body + neck)
  s.circle(-26, 2, 4).fill(0xeeb87a);
  s.circle(-26, 2, 4).stroke({ color: 0x6a3a1c, width: 1 });
  px(s, -28, 0, 1, 4, 0x6a3a1c);
  px(s, -25, 0, 1, 4, 0x6a3a1c);
  px(s, -22, -1, 6, 1, 0x6a3a1c); // neck
  c.addChild(s);
}

function drawPiratePug(c) {
  const v = new Graphics();
  drawShadow(v);
  // galleon-tank hybrid: ship hull on tank treads
  // hull (ship shape)
  px(v, -18, -4, 36, 12, 0x6a3a1c);
  px(v, -18, -4, 36, 2, 0x8a5a2c);
  px(v, -18, 6, 36, 2, shade(0x6a3a1c, 0.5));
  // hull planking
  for (let y = -2; y < 6; y += 2) px(v, -16, y, 32, 1, shade(0x6a3a1c, 0.7));
  // bow point
  px(v, 18, -2, 2, 8, 0x6a3a1c);
  px(v, 20, 0, 2, 4, 0x6a3a1c);
  // mast
  px(v, -2, -22, 2, 18, 0x4a2a0c);
  // sail
  px(v, -10, -22, 14, 12, 0xfafaff);
  px(v, -10, -22, 14, 1, 0xeeeeff);
  px(v, -10, -10, 14, 1, shade(0xfafaff, 0.7));
  // skull on sail
  px(v, -4, -18, 4, 4, 0x222228);
  px(v, -3, -17, 1, 1, 0xfafaff);
  px(v, -1, -17, 1, 1, 0xfafaff);
  px(v, -3, -15, 4, 1, 0x222228); // crossbones
  // cannon on side
  px(v, -16, 0, 4, 3, 0x222228);
  px(v, -20, 0, 4, 3, 0x222228);
  // tank treads (under ship)
  drawTreads(v, { y: 8, w: 38 });
  c.addChild(v);

  // pirate pug (under sail)
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
  });
  p.scale.set(0.8);
  p.y = -2;
  // tricorn hat
  px(p, -10, -32, 20, 3, 0x222228);
  px(p, -8, -34, 16, 2, 0x222228);
  px(p, -6, -33, 12, 1, COLORS.yellow); // gold trim
  // eyepatch
  px(p, -7, -20, 5, 5, 0x000000);
  px(p, -10, -19, 3, 1, 0x000000);
  px(p, -2, -19, 2, 1, 0x000000);
  c.addChild(p);

  // parrot sidekick
  const s = new Graphics();
  px(s, -22, -8, 5, 6, COLORS.green);
  px(s, -22, -8, 5, 1, 0x9af09a);
  px(s, -22, -12, 5, 4, COLORS.hydrant);
  px(s, -22, -12, 5, 1, 0xff8a8a);
  px(s, -21, -10, 1, 1, 0xffffff); // eye
  px(s, -22, -10, 1, 1, COLORS.yellow); // beak
  c.addChild(s);
}

function drawAstronautPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // lunar rover
  px(v, -16, 0, 32, 12, 0xc8d0d8);
  px(v, -16, 0, 32, 2, 0xffffff);
  px(v, -16, 10, 32, 2, shade(0xc8d0d8, 0.5));
  // solar panels (top)
  px(v, -18, -8, 14, 6, 0x4a4aaa);
  px(v, 4, -8, 14, 6, 0x4a4aaa);
  // grid lines on panels
  for (let x = -16; x <= -6; x += 2) px(v, x, -7, 1, 4, shade(0x4a4aaa, 0.6));
  for (let x = 6; x <= 16; x += 2) px(v, x, -7, 1, 4, shade(0x4a4aaa, 0.6));
  // dish antenna
  px(v, 12, -16, 1, 8, 0x9aaabb);
  v.circle(12, -16, 4).stroke({ color: 0x9aaabb, width: 1 });
  // NASA-style decals
  px(v, -10, 4, 2, 2, COLORS.hydrant);
  px(v, -6, 4, 4, 2, COLORS.cyan);
  // headlights
  px(v, 14, 4, 2, 2, COLORS.yellow);
  // big rover wheels
  drawBigWheels(v, { spread: 16, baseY: 12, r: 6, rim: 0xc8d0d8 });
  c.addChild(v);

  // astronaut pug — helmet
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xfafaff,
    mask: 0xc8c8e8,
    ear: 0xa8a8c8,
  });
  p.y = -6;
  // helmet (over head)
  px(p, -12, -32, 24, 4, 0xc8d0d8);
  px(p, -12, -28, 1, 8, 0xc8d0d8);
  px(p, 11, -28, 1, 8, 0xc8d0d8);
  px(p, -12, -32, 24, 1, 0xffffff);
  // helmet visor (transparent reflective)
  px(p, -10, -28, 20, 12, { color: COLORS.cyan, alpha: 0.4 });
  px(p, -10, -28, 20, 2, { color: 0xffffff, alpha: 0.7 });
  c.addChild(p);

  // baby astronaut pug sidekick
  const s = new Graphics();
  px(s, 16, -2, 6, 7, 0xfafaff);
  px(s, 16, -8, 6, 5, 0xfafaff);
  px(s, 16, -10, 6, 2, 0xc8d0d8); // helmet
  px(s, 17, -7, 1, 1, COLORS.cyan);
  px(s, 20, -7, 1, 1, COLORS.cyan);
  c.addChild(s);
}

function drawKaratePug(c) {
  const v = new Graphics();
  drawShadow(v);
  // ninja motorcycle
  px(v, -18, 4, 36, 8, 0x222228);
  px(v, -18, 4, 36, 2, 0x444450);
  px(v, -18, 10, 36, 2, 0x000000);
  // glowing trim
  px(v, -18, 8, 36, 1, COLORS.cyan);
  // spoiler
  px(v, -22, 0, 6, 2, 0x222228);
  // smoke vent
  px(v, -20, 6, 2, 4, COLORS.yellow);
  // headlight
  px(v, 16, 6, 2, 2, COLORS.cyan);
  drawBigWheels(v, { spread: 16, baseY: 12, r: 6, tire: 0x000000, rim: 0x4a4a52 });
  c.addChild(v);

  // karate pug — focused eyes, headband
  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a,
    mask: 0x1a0d05,
    ear: 0x6b3a1c,
    tongueOut: false,
  });
  p.y = -4;
  // headband
  px(p, -10, -22, 20, 2, COLORS.hydrant);
  px(p, -10, -22, 20, 1, 0xff8a8a);
  // headband knot trailing
  px(p, 10, -22, 4, 6, COLORS.hydrant);
  px(p, 10, -22, 4, 1, 0xff8a8a);
  // gi top
  px(p, -10, -8, 20, 4, 0xfafaff);
  px(p, -10, -8, 20, 1, 0xeeeeff);
  px(p, -2, -8, 4, 4, 0x000000); // belt black
  c.addChild(p);

  // dojo master pug sidekick
  const s = new Graphics();
  px(s, 16, -4, 6, 8, 0xc8854a);
  px(s, 16, -10, 6, 6, 0xc8854a);
  px(s, 17, -7, 1, 1, 0x000000);
  px(s, 20, -7, 1, 1, 0x000000);
  // long mustache
  px(s, 12, -5, 4, 1, 0xfafaff);
  px(s, 22, -5, 4, 1, 0xfafaff);
  c.addChild(s);
}

function drawVampirePug(c) {
  const v = new Graphics();
  drawShadow(v);
  // bat-shaped hover-coach
  // body
  px(v, -14, -2, 28, 14, 0x4a0a3a);
  px(v, -14, -2, 28, 2, 0x8a1a6a);
  px(v, -14, 10, 28, 2, shade(0x4a0a3a, 0.5));
  // bat-wing fins
  px(v, -22, 2, 8, 6, 0x4a0a3a);
  px(v, -24, 4, 4, 4, 0x4a0a3a);
  px(v, 14, 2, 8, 6, 0x4a0a3a);
  px(v, 20, 4, 4, 4, 0x4a0a3a);
  // gothic spires
  px(v, -10, -8, 2, 6, 0x222228);
  px(v, 8, -8, 2, 6, 0x222228);
  px(v, -10, -10, 2, 2, COLORS.yellow);
  px(v, 8, -10, 2, 2, COLORS.yellow);
  // red velvet curtains (windows)
  px(v, -8, 2, 6, 6, COLORS.hydrant);
  px(v, 2, 2, 6, 6, COLORS.hydrant);
  px(v, -8, 2, 1, 6, 0x6a0000);
  px(v, 2, 2, 1, 6, 0x6a0000);
  // hover glow
  drawHover(v, { y: 16, w: 38, color: COLORS.hydrant });
  c.addChild(v);

  // vampire pug
  const p = new Graphics();
  drawPugBase(p, {
    body: 0x222228,
    mask: 0x101014,
    ear: 0x444450,
    eyeShape: 'sparkle',
    eyeGlow: COLORS.hydrant,
    tongueOut: false,
  });
  p.y = -8;
  // cape
  px(p, -14, -8, 28, 14, 0x4a0a3a);
  px(p, -14, -8, 28, 1, 0x8a1a6a);
  px(p, -14, 6, 28, 1, shade(0x4a0a3a, 0.5));
  // fangs sticking down from snout
  px(p, -3, -10, 1, 2, 0xffffff);
  px(p, 2, -10, 1, 2, 0xffffff);
  c.addChild(p);

  // bat sidekick
  const s = new Graphics();
  px(s, 16, -10, 8, 5, 0x222228);
  px(s, 14, -10, 4, 3, 0x222228);
  px(s, 22, -10, 4, 3, 0x222228);
  px(s, 18, -8, 1, 1, COLORS.hydrant);
  px(s, 21, -8, 1, 1, COLORS.hydrant);
  px(s, 18, -6, 4, 1, 0x222228); // body
  c.addChild(s);
}

// ----- More characters (added in v2) -----

function drawWizardPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // floating spellbook with broom propulsion
  px(v, -16, 0, 32, 14, 0x4a2a8a);
  px(v, -16, 0, 32, 2, 0x6a4ab0);
  px(v, -16, 12, 32, 2, shade(0x4a2a8a, 0.5));
  // book pages
  px(v, -14, 4, 28, 6, 0xfde0b8);
  px(v, -14, 4, 28, 1, 0xffffff);
  // page text squiggles
  px(v, -12, 6, 8, 1, 0x222228);
  px(v, -12, 8, 12, 1, 0x222228);
  px(v, 2, 6, 10, 1, 0x222228);
  px(v, 2, 8, 6, 1, 0x222228);
  // spine
  px(v, -2, 0, 4, 14, 0x222228);
  px(v, -2, 0, 4, 1, COLORS.yellow);
  // broom under
  px(v, 8, 14, 14, 2, 0x6a3a1c);
  px(v, 18, 12, 6, 6, COLORS.yellow);
  px(v, 18, 12, 6, 1, 0xffeb55);
  // magic glow
  drawHover(v, { y: 16, w: 36, color: COLORS.purple || 0xb055ff });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    eyeShape: 'sparkle', eyeGlow: 0xb055ff,
  });
  p.y = -6;
  // pointy wizard hat
  px(p, -8, -32, 16, 4, 0x4a2a8a);
  px(p, -6, -36, 12, 4, 0x4a2a8a);
  px(p, -4, -40, 8, 4, 0x4a2a8a);
  px(p, -2, -44, 4, 4, 0x4a2a8a);
  px(p, -2, -44, 4, 1, 0xb055ff);
  px(p, -8, -32, 16, 1, COLORS.yellow); // hat band
  // stars on hat
  px(p, -3, -38, 1, 1, COLORS.yellow);
  px(p, 2, -34, 1, 1, COLORS.yellow);
  // long beard
  px(p, -6, -8, 12, 4, 0xfafaff);
  px(p, -4, -4, 8, 2, 0xfafaff);
  c.addChild(p);

  // black cat-pug familiar
  const s = new Graphics();
  px(s, 16, -2, 6, 7, 0x222228);
  px(s, 16, -8, 6, 5, 0x222228);
  px(s, 17, -7, 1, 1, COLORS.green);
  px(s, 20, -7, 1, 1, COLORS.green);
  px(s, 16, -10, 2, 2, 0x222228); // cat ear
  px(s, 20, -10, 2, 2, 0x222228);
  c.addChild(s);
}

function drawBoxerPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // boxing-ring on wheels
  px(v, -18, 0, 36, 12, 0xfafaff);
  px(v, -18, 0, 36, 2, 0xeeeeff);
  // ring posts at corners
  px(v, -18, -6, 3, 8, COLORS.hydrant);
  px(v, 15, -6, 3, 8, COLORS.hydrant);
  // top rope
  px(v, -16, -4, 32, 1, 0x222228);
  px(v, -16, -2, 32, 1, COLORS.yellow);
  // canvas mat lines
  px(v, -16, 6, 32, 1, COLORS.hydrant);
  drawWheels(v, { spread: 14, baseY: 14 });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    eyeShape: 'angry', tongueOut: false,
  });
  p.y = -8;
  // boxing gloves on front legs
  px(p, -12, -3, 4, 4, COLORS.hydrant);
  px(p, -12, -3, 4, 1, 0xff8a8a);
  px(p, 8, -3, 4, 4, COLORS.hydrant);
  px(p, 8, -3, 4, 1, 0xff8a8a);
  // mouthguard (yellow rectangle in mouth area)
  px(p, -2, -10, 4, 1, COLORS.yellow);
  // taped paws / wraps
  px(p, -10, 4, 2, 4, 0xfafaff);
  px(p, 8, 4, 2, 4, 0xfafaff);
  c.addChild(p);
}

function drawSkaterPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // mobile half-pipe
  px(v, -22, 4, 44, 10, 0x6a3a1c);
  px(v, -22, 4, 44, 2, 0x8a5a2c);
  // ramp curves
  px(v, -22, -2, 4, 6, 0x6a3a1c);
  px(v, 18, -2, 4, 6, 0x6a3a1c);
  px(v, -24, -4, 2, 4, 0x6a3a1c);
  px(v, 22, -4, 2, 4, 0x6a3a1c);
  // graffiti tags
  px(v, -10, 8, 4, 2, COLORS.pink);
  px(v, 4, 8, 4, 2, COLORS.cyan);
  drawWheels(v, { spread: 16, baseY: 14 });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
  });
  p.y = -4;
  // beanie
  px(p, -10, -32, 20, 4, 0xff5a3a);
  px(p, -10, -32, 20, 1, COLORS.yellow);
  px(p, -2, -36, 4, 4, 0xff5a3a); // pom
  // baggy clothes hint
  px(p, -10, -4, 20, 4, 0x4a4a8a);
  c.addChild(p);
}

function drawSurferPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // surfboard on wave-machine cart
  px(v, -22, 4, 44, 4, 0xfde0b8);
  px(v, -22, 4, 44, 1, 0xffffff);
  px(v, -22, 8, 44, 1, shade(0xfde0b8, 0.5));
  // wave decoration
  px(v, -20, 3, 4, 1, COLORS.cyan);
  px(v, 16, 3, 4, 1, COLORS.cyan);
  // wave cart underneath
  px(v, -16, 10, 32, 6, COLORS.cyan);
  px(v, -16, 10, 32, 2, 0xb0e8ff);
  // wave foam
  px(v, -14, 16, 6, 2, 0xffffff);
  px(v, 8, 16, 6, 2, 0xffffff);
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xeac888, mask: 0x6b3a1c, ear: 0x8a5a2c,
    eyeShape: 'sparkle',
  });
  p.y = -6;
  // hibiscus shirt pattern
  px(p, -10, -8, 20, 4, COLORS.pink);
  px(p, -8, -7, 2, 1, COLORS.yellow);
  px(p, 0, -6, 2, 1, COLORS.yellow);
  px(p, 6, -7, 2, 1, COLORS.yellow);
  // zinc nose (white stripe across snout)
  px(p, -3, -16, 6, 1, 0xffffff);
  c.addChild(p);
}

function drawRacePug(c) {
  const v = new Graphics();
  drawShadow(v);
  // F1 mini car body
  px(v, -22, 0, 44, 10, COLORS.hydrant);
  px(v, -22, 0, 44, 2, 0xff8a8a);
  px(v, -22, 8, 44, 2, shade(COLORS.hydrant, 0.5));
  // front wing
  px(v, 18, 6, 6, 2, 0x222228);
  // rear wing
  px(v, -22, -4, 4, 4, 0x222228);
  px(v, -22, -4, 4, 1, COLORS.yellow);
  // sponsor logos
  px(v, -10, 4, 4, 2, COLORS.yellow);
  px(v, 4, 4, 4, 2, COLORS.cyan);
  // F1 tires (low profile)
  px(v, -16, 10, 6, 6, 0x111118);
  px(v, 10, 10, 6, 6, 0x111118);
  px(v, -14, 12, 2, 2, 0xc8c8c8);
  px(v, 12, 12, 2, 2, 0xc8c8c8);
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    tongueOut: false,
  });
  p.y = -2;
  // racing helmet
  px(p, -10, -32, 20, 8, 0xfafaff);
  px(p, -10, -32, 20, 2, 0xeeeeff);
  // visor
  px(p, -10, -26, 20, 4, 0x222228);
  px(p, -10, -26, 20, 1, COLORS.cyan);
  // helmet stripes
  px(p, -2, -32, 4, 8, COLORS.hydrant);
  c.addChild(p);
}

function drawPizzaPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // pizza scooter
  px(v, -16, 4, 32, 8, COLORS.hydrant);
  px(v, -16, 4, 32, 2, 0xff8a8a);
  px(v, -16, 10, 32, 2, shade(COLORS.hydrant, 0.5));
  // delivery box stack on back
  px(v, -22, -2, 8, 8, 0xfde0b8);
  px(v, -22, -2, 8, 2, 0xffffff);
  px(v, -22, -8, 8, 6, COLORS.hydrant);
  px(v, -22, -8, 8, 1, 0xff8a8a);
  px(v, -20, -6, 4, 2, 0xffffff); // pizza icon
  // front handlebars
  px(v, 14, -2, 2, 6, 0x222228);
  drawWheels(v, { spread: 14, baseY: 14 });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xeac888, mask: 0x6b3a1c, ear: 0x8a5a2c,
  });
  p.y = -6;
  // pizza-slice cape
  px(p, -12, -8, 24, 6, COLORS.yellow);
  px(p, -12, -8, 24, 1, 0xffeb55);
  px(p, -10, -4, 4, 2, COLORS.hydrant); // pepperoni
  px(p, 4, -4, 4, 2, COLORS.hydrant);
  px(p, -2, -6, 2, 2, COLORS.hydrant);
  c.addChild(p);
}

function drawDoctorPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // mini-ambulance
  px(v, -18, -4, 36, 16, 0xfafaff);
  px(v, -18, -4, 36, 2, 0xeeeeff);
  px(v, -18, 10, 36, 2, shade(0xfafaff, 0.6));
  // red cross on side
  px(v, -4, 0, 8, 2, COLORS.hydrant);
  px(v, -1, -3, 2, 8, COLORS.hydrant);
  // siren on top
  px(v, -4, -10, 8, 4, 0x222228);
  px(v, -3, -9, 3, 2, COLORS.hydrant);
  px(v, 1, -9, 3, 2, COLORS.cyan);
  // window
  px(v, -16, -2, 6, 6, 0x6a8aaa);
  px(v, -16, -2, 6, 1, 0x9acaff);
  drawWheels(v, { spread: 14, baseY: 14 });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    tongueOut: false,
  });
  p.y = -8;
  // doctor coat
  px(p, -10, -8, 20, 6, 0xfafaff);
  px(p, -10, -8, 20, 1, 0xeeeeff);
  // stethoscope
  px(p, -8, -6, 2, 4, 0x222228);
  px(p, 6, -6, 2, 4, 0x222228);
  px(p, -8, -2, 16, 1, 0x222228);
  px(p, -2, -1, 4, 2, 0xc8c8c8);
  // glasses
  px(p, -8, -20, 16, 1, 0x222228);
  c.addChild(p);
}

function drawCopPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // cruiser bike
  px(v, -16, 2, 32, 10, 0x4a4aaa);
  px(v, -16, 2, 32, 2, 0x6a6acc);
  px(v, -16, 10, 32, 2, shade(0x4a4aaa, 0.5));
  // POLICE stripe
  px(v, -16, 6, 32, 2, 0xffffff);
  // siren lights
  px(v, -4, -2, 4, 4, COLORS.hydrant);
  px(v, 0, -2, 4, 4, COLORS.cyan);
  px(v, -4, -2, 8, 1, 0xffffff);
  drawWheels(v, { spread: 14, baseY: 14 });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    tongueOut: false,
  });
  p.y = -6;
  // cop cap
  px(p, -10, -32, 20, 4, 0x4a4aaa);
  px(p, -10, -32, 20, 1, 0x6a6acc);
  px(p, -8, -34, 16, 2, 0x4a4aaa);
  px(p, -2, -32, 4, 2, COLORS.yellow); // badge
  // aviator shades
  px(p, -8, -22, 6, 3, 0x222228);
  px(p, 2, -22, 6, 3, 0x222228);
  px(p, -2, -21, 4, 1, 0x222228); // bridge
  // mustache
  px(p, -6, -13, 12, 1, 0x4a2a0c);
  c.addChild(p);
}

function drawPunkPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // spiked motorcycle with sidecar
  px(v, -16, 0, 32, 12, 0x222228);
  px(v, -16, 0, 32, 2, 0x444450);
  // spikes
  for (let x = -14; x <= 12; x += 4) {
    px(v, x, -3, 2, 4, 0x9aa0a8);
    px(v, x, -5, 2, 2, 0x9aa0a8);
  }
  // chain exhaust
  for (let i = 0; i < 5; i++) px(v, -22 + i * 2, 6, 1, 1, 0x9aa0a8);
  drawBigWheels(v, { spread: 14, baseY: 14, r: 6, tire: 0x000000, rim: 0x666666 });
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    eyeShape: 'angry',
  });
  p.y = -6;
  // mohawk
  px(p, -2, -32, 4, 8, COLORS.pink);
  px(p, -2, -32, 4, 1, 0xffaac4);
  px(p, -1, -36, 2, 4, COLORS.pink);
  // leather jacket
  px(p, -10, -8, 20, 4, 0x222228);
  px(p, -10, -8, 20, 1, 0x444450);
  // studs on jacket
  px(p, -8, -7, 1, 1, 0xc8c8c8);
  px(p, -4, -7, 1, 1, 0xc8c8c8);
  px(p, 0, -7, 1, 1, 0xc8c8c8);
  px(p, 4, -7, 1, 1, 0xc8c8c8);
  px(p, 8, -7, 1, 1, 0xc8c8c8);
  // safety pin in ear
  px(p, -13, -22, 1, 1, 0xc8c8c8);
  c.addChild(p);
}

function drawMummyPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // sand-skiff sled drifting on sand cloud
  v.ellipse(0, 14, 22, 4).fill({ color: 0xeec890, alpha: 0.7 });
  v.ellipse(0, 16, 18, 3).fill({ color: 0xeec890, alpha: 0.5 });
  px(v, -16, 4, 32, 8, 0xa6753a);
  px(v, -16, 4, 32, 2, 0xc8a878);
  px(v, -16, 10, 32, 2, shade(0xa6753a, 0.5));
  // hieroglyphs on side
  px(v, -10, 6, 1, 4, COLORS.yellow);
  px(v, -8, 6, 2, 1, COLORS.yellow);
  px(v, 4, 6, 1, 4, COLORS.yellow);
  px(v, 6, 8, 2, 1, COLORS.yellow);
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xfde0b8, mask: 0x8a5a2c, ear: 0xa6753a,
    eyeShape: 'glow', eyeGlow: COLORS.yellow,
    tongueOut: false,
  });
  p.y = -6;
  // bandage wraps
  for (let y = -28; y <= 0; y += 4) {
    px(p, -10, y, 20, 1, shade(0xfde0b8, 0.6));
  }
  for (let y = -26; y <= -2; y += 4) {
    px(p, -10, y, 20, 1, 0xffffff);
  }
  // dangling bandage from mouth
  px(p, -1, -10, 2, 8, 0xffffff);
  c.addChild(p);

  // beetle sidekick with pyramid
  const s = new Graphics();
  px(s, 16, -2, 6, 5, 0x222228);
  px(s, 16, -2, 6, 1, 0x666666);
  px(s, 17, 0, 1, 1, COLORS.yellow);
  px(s, 20, 0, 1, 1, COLORS.yellow);
  // pyramid carried
  px(s, 18, -10, 3, 1, COLORS.yellow);
  px(s, 17, -8, 5, 1, COLORS.yellow);
  px(s, 16, -6, 7, 1, COLORS.yellow);
  c.addChild(s);
}

function drawDragonPug(c) {
  const v = new Graphics();
  drawShadow(v);
  // dragon mount under pug
  px(v, -18, -2, 36, 14, 0x3a8a3a);
  px(v, -18, -2, 36, 2, 0x6aaa6a);
  px(v, -18, 10, 36, 2, shade(0x3a8a3a, 0.5));
  // scale plates
  for (let x = -16; x < 16; x += 4) {
    for (let y = 0; y < 8; y += 4) {
      px(v, x, y, 3, 3, shade(0x3a8a3a, 1.15));
    }
  }
  // wings tucked in
  px(v, -22, 0, 6, 6, 0x4a8a4a);
  px(v, -22, 0, 6, 1, 0x6aaa6a);
  px(v, 16, 0, 6, 6, 0x4a8a4a);
  px(v, 16, 0, 6, 1, 0x6aaa6a);
  // dragon tail visible at back
  px(v, -22, 4, 4, 2, 0x3a8a3a);
  px(v, -24, 6, 2, 2, 0x3a8a3a);
  // dragon legs
  px(v, -14, 12, 4, 5, 0x2a6a2a);
  px(v, 10, 12, 4, 5, 0x2a6a2a);
  c.addChild(v);

  const p = new Graphics();
  drawPugBase(p, {
    body: 0xc8854a, mask: 0x1a0d05, ear: 0x6b3a1c,
    eyeShape: 'sparkle',
  });
  p.y = -8;
  // tiny dragon-style horns on pug head
  px(p, -10, -28, 2, 4, COLORS.yellow);
  px(p, 8, -28, 2, 4, COLORS.yellow);
  // smoke from snout
  px(p, -3, -18, 1, 1, { color: 0xc8c8c8, alpha: 0.7 });
  px(p, -4, -19, 1, 1, { color: 0xc8c8c8, alpha: 0.5 });
  px(p, 3, -18, 1, 1, { color: 0xc8c8c8, alpha: 0.7 });
  c.addChild(p);
}

// =============================================================================
// FORMS DATA
// =============================================================================

export const FORMS = {
  bork_pup: {
    id: 'bork_pup', name: 'Bork Pup', tier: 0,
    hp: 100, speed: 230, fireRate: 350,
    projectileSpeed: 480, projectileDamage: 8, projectileColor: COLORS.cyan,
    projectileShape: 'ball',
    radius: 22, contactDamage: 6,
    desc: 'Tiny pug, big heart. Cardboard kart with crayon flames.',
    draw: drawBorkPup,
  },
  // Tier 1
  loaf: {
    id: 'loaf', name: 'Loaf', tier: 1,
    hp: 200, speed: 180, fireRate: 600,
    projectileSpeed: 380, projectileDamage: 24, projectileColor: 0xd9a86a,
    projectileShape: 'crumb',
    radius: 24, contactDamage: 14,
    desc: 'Bread tank. Slow but THICC. Toaster on treads.',
    draw: drawLoaf,
  },
  snoot: {
    id: 'snoot', name: 'Snoot', tier: 1,
    hp: 140, speed: 230, fireRate: 280,
    projectileSpeed: 580, projectileDamage: 14, projectileColor: COLORS.hydrant,
    projectileShape: 'beam',
    radius: 22, contactDamage: 8,
    desc: 'Stretchy snoot. Fast fire. Fire-truck poker.',
    draw: drawSnoot,
  },
  zoom: {
    id: 'zoom', name: 'Zoom', tier: 1,
    hp: 120, speed: 320, fireRate: 220,
    projectileSpeed: 620, projectileDamage: 11, projectileColor: COLORS.pink,
    projectileShape: 'ball',
    radius: 18, contactDamage: 6,
    desc: 'Pure speed. Rocket-skateboard with chihuahua sniper.',
    draw: drawZoom,
  },
  wiggle: {
    id: 'wiggle', name: 'Wiggle', tier: 1,
    hp: 150, speed: 250, fireRate: 380,
    projectileSpeed: 460, projectileDamage: 16, projectileColor: COLORS.yellow,
    projectileShape: 'ball',
    radius: 20, contactDamage: 8,
    desc: 'Slinky-spring buggy. Wobble dodges hits.',
    draw: drawWiggle,
  },
  boop: {
    id: 'boop', name: 'Boop', tier: 1,
    hp: 170, speed: 220, fireRate: 320,
    projectileSpeed: 480, projectileDamage: 14, projectileColor: 0xff3030,
    projectileShape: 'ball',
    radius: 22, contactDamage: 18,
    desc: 'Big-nose bumper car. Rams hard.',
    draw: drawBoop,
  },
  // Tier 2
  cheems: {
    id: 'cheems', name: 'Cheems', tier: 2,
    hp: 240, speed: 200, fireRate: 500,
    projectileSpeed: 360, projectileDamage: 30, projectileColor: 0xffb7d1,
    projectileShape: 'donut',
    radius: 26, contactDamage: 12,
    desc: 'Such bork. Loopy donuts. Floppy tongue.',
    draw: drawCheems,
  },
  doge_knight: {
    id: 'doge_knight', name: 'Doge Knight', tier: 2,
    hp: 300, speed: 190, fireRate: 550,
    projectileSpeed: 540, projectileDamage: 34, projectileColor: COLORS.yellow,
    projectileShape: 'lance',
    radius: 28, contactDamage: 18,
    desc: 'Such honor. Mech-horse with lance-cannon.',
    draw: drawDogeKnight,
  },
  bonk_pug: {
    id: 'bonk_pug', name: 'Bonk Pug', tier: 2,
    hp: 260, speed: 220, fireRate: 350,
    projectileSpeed: 460, projectileDamage: 26, projectileColor: 0xa6753a,
    projectileShape: 'ball',
    radius: 26, contactDamage: 24,
    desc: 'BONK. Bumper car of doom + giant bat.',
    draw: drawBonkPug,
  },
  walter: {
    id: 'walter', name: 'Walter', tier: 2,
    hp: 280, speed: 240, fireRate: 320,
    projectileSpeed: 540, projectileDamage: 28, projectileColor: 0xffffff,
    projectileShape: 'ball',
    radius: 26, contactDamage: 16,
    desc: 'Rage white pug. RC monster truck.',
    draw: drawWalter,
  },
  disco_pug: {
    id: 'disco_pug', name: 'Disco Pug', tier: 2,
    hp: 220, speed: 230, fireRate: 380,
    projectileSpeed: 480, projectileDamage: 26, projectileColor: COLORS.magenta,
    projectileShape: 'star',
    radius: 24, contactDamage: 12,
    desc: 'Funk wave. Mirror-ball kart, rainbow stars.',
    draw: drawDiscoPug,
  },
  chef_pug: {
    id: 'chef_pug', name: 'Chef Pug', tier: 2,
    hp: 240, speed: 210, fireRate: 420,
    projectileSpeed: 440, projectileDamage: 28, projectileColor: 0xff8a3a,
    projectileShape: 'pan',
    radius: 25, contactDamage: 14,
    desc: 'Flambé. Wok-launcher kitchen cart.',
    draw: drawChefPug,
  },
  toast_pug: {
    id: 'toast_pug', name: 'Toast Pug', tier: 2,
    hp: 250, speed: 200, fireRate: 480,
    projectileSpeed: 420, projectileDamage: 28, projectileColor: 0xd9a86a,
    projectileShape: 'ball',
    radius: 26, contactDamage: 14,
    desc: 'Walking mecha-toaster. Pop-up dodge.',
    draw: drawToastPug,
  },
  // Tier 3
  cosmic_pug: {
    id: 'cosmic_pug', name: 'Cosmic Pug', tier: 3,
    hp: 380, speed: 250, fireRate: 320,
    projectileSpeed: 600, projectileDamage: 40, projectileColor: COLORS.cyan,
    projectileShape: 'star',
    radius: 30, contactDamage: 16,
    desc: 'UFO saucer. Star beams. Galaxy fur.',
    draw: drawCosmicPug,
  },
  demon_pug: {
    id: 'demon_pug', name: 'Demon Pug', tier: 3,
    hp: 400, speed: 230, fireRate: 380,
    projectileSpeed: 560, projectileDamage: 44, projectileColor: COLORS.hydrant,
    projectileShape: 'fireball',
    radius: 30, contactDamage: 22,
    desc: 'Hellfire monster truck. Burning paws.',
    draw: drawDemonPug,
  },
  pug_zilla: {
    id: 'pug_zilla', name: 'PUG-ZILLA', tier: 3,
    hp: 550, speed: 170, fireRate: 600,
    projectileSpeed: 480, projectileDamage: 60, projectileColor: COLORS.green,
    projectileShape: 'ball',
    radius: 38, contactDamage: 32,
    desc: 'Walking kaiju mech. Slow. Massive. STOMP.',
    draw: drawPugZilla,
  },
  holy_pug: {
    id: 'holy_pug', name: 'Holy Pug', tier: 3,
    hp: 360, speed: 220, fireRate: 360,
    projectileSpeed: 580, projectileDamage: 38, projectileColor: COLORS.yellow,
    projectileShape: 'beam',
    radius: 28, contactDamage: 14,
    desc: 'Cloud chariot. Healing aura. Holy beams.',
    draw: drawHolyPug,
  },
  cowboy_pug: {
    id: 'cowboy_pug', name: 'Cowboy Pug', tier: 3,
    hp: 350, speed: 240, fireRate: 360,
    projectileSpeed: 600, projectileDamage: 42, projectileColor: 0xeeb87a,
    projectileShape: 'ball',
    radius: 28, contactDamage: 20,
    desc: 'Mechanical bull. Yeehaw. Lasso pull.',
    draw: drawCowboyPug,
  },
  pirate_pug: {
    id: 'pirate_pug', name: 'Pirate Pug', tier: 3,
    hp: 380, speed: 200, fireRate: 480,
    projectileSpeed: 520, projectileDamage: 50, projectileColor: 0x222228,
    projectileShape: 'ball',
    radius: 30, contactDamage: 22,
    desc: 'Galleon-tank. Cannonball volleys. Yarr.',
    draw: drawPiratePug,
  },
  astronaut_pug: {
    id: 'astronaut_pug', name: 'Astronaut Pug', tier: 3,
    hp: 340, speed: 240, fireRate: 340,
    projectileSpeed: 620, projectileDamage: 36, projectileColor: COLORS.cyan,
    projectileShape: 'ball',
    radius: 28, contactDamage: 16,
    desc: 'Lunar rover. Low gravity. Solar laser.',
    draw: drawAstronautPug,
  },
  karate_pug: {
    id: 'karate_pug', name: 'Karate Pug', tier: 3,
    hp: 320, speed: 280, fireRate: 280,
    projectileSpeed: 600, projectileDamage: 36, projectileColor: 0xff8a3a,
    projectileShape: 'ball',
    radius: 26, contactDamage: 20,
    desc: 'Stealth ninja-moto. Crane kick.',
    draw: drawKaratePug,
  },
  vampire_pug: {
    id: 'vampire_pug', name: 'Vampire Pug', tier: 3,
    hp: 360, speed: 230, fireRate: 360,
    projectileSpeed: 560, projectileDamage: 38, projectileColor: COLORS.hydrant,
    projectileShape: 'bat',
    radius: 28, contactDamage: 18,
    desc: 'Bat hover-coach. Lifesteal on hit.',
    draw: drawVampirePug,
  },
  // ----- v2 additions -----
  boxer_pug: {
    id: 'boxer_pug', name: 'Boxer Pug', tier: 2,
    hp: 250, speed: 230, fireRate: 320,
    projectileSpeed: 480, projectileDamage: 26, projectileColor: COLORS.hydrant,
    projectileShape: 'ball', radius: 24, contactDamage: 22,
    desc: 'One-two combo. Boxing-ring on wheels.',
    draw: drawBoxerPug,
  },
  skater_pug: {
    id: 'skater_pug', name: 'Skater Pug', tier: 2,
    hp: 220, speed: 270, fireRate: 320,
    projectileSpeed: 540, projectileDamage: 24, projectileColor: COLORS.cyan,
    projectileShape: 'ball', radius: 22, contactDamage: 14,
    desc: 'Mobile half-pipe. Tricks build damage.',
    draw: drawSkaterPug,
  },
  surfer_pug: {
    id: 'surfer_pug', name: 'Surfer Pug', tier: 2,
    hp: 230, speed: 250, fireRate: 380,
    projectileSpeed: 520, projectileDamage: 26, projectileColor: COLORS.cyan,
    projectileShape: 'ball', radius: 24, contactDamage: 16,
    desc: 'Wave rider. Surfs over enemies.',
    draw: drawSurferPug,
  },
  race_pug: {
    id: 'race_pug', name: 'Race Pug', tier: 2,
    hp: 200, speed: 320, fireRate: 280,
    projectileSpeed: 620, projectileDamage: 22, projectileColor: COLORS.hydrant,
    projectileShape: 'ball', radius: 22, contactDamage: 14,
    desc: 'Pole position. Fastest on the grid.',
    draw: drawRacePug,
  },
  pizza_pug: {
    id: 'pizza_pug', name: 'Pizza Pug', tier: 2,
    hp: 240, speed: 220, fireRate: 420,
    projectileSpeed: 460, projectileDamage: 28, projectileColor: COLORS.yellow,
    projectileShape: 'donut', radius: 24, contactDamage: 14,
    desc: 'Frisbee-pizza throw. Returns to thrower.',
    draw: drawPizzaPug,
  },
  doctor_pug: {
    id: 'doctor_pug', name: 'Doctor Pug', tier: 2,
    hp: 240, speed: 210, fireRate: 380,
    projectileSpeed: 500, projectileDamage: 24, projectileColor: 0xfafaff,
    projectileShape: 'ball', radius: 24, contactDamage: 12,
    desc: 'Triage. Heals self on each hit.',
    draw: drawDoctorPug,
  },
  cop_pug: {
    id: 'cop_pug', name: 'Cop Pug', tier: 2,
    hp: 250, speed: 220, fireRate: 360,
    projectileSpeed: 540, projectileDamage: 26, projectileColor: COLORS.cyan,
    projectileShape: 'ball', radius: 24, contactDamage: 14,
    desc: 'Pull over! Stops the first enemy hit.',
    draw: drawCopPug,
  },
  punk_pug: {
    id: 'punk_pug', name: 'Punk Pug', tier: 2,
    hp: 240, speed: 240, fireRate: 320,
    projectileSpeed: 500, projectileDamage: 26, projectileColor: COLORS.pink,
    projectileShape: 'ball', radius: 24, contactDamage: 18,
    desc: 'Mosh pit. Spiked sidecar. Loud.',
    draw: drawPunkPug,
  },
  // Tier 3
  wizard_pug: {
    id: 'wizard_pug', name: 'Wizard Pug', tier: 3,
    hp: 340, speed: 220, fireRate: 380,
    projectileSpeed: 560, projectileDamage: 38, projectileColor: 0xb055ff,
    projectileShape: 'star', radius: 26, contactDamage: 14,
    desc: 'Polymorph. Such magic. Spellbook ride.',
    draw: drawWizardPug,
  },
  mummy_pug: {
    id: 'mummy_pug', name: 'Mummy Pug', tier: 3,
    hp: 360, speed: 200, fireRate: 460,
    projectileSpeed: 480, projectileDamage: 40, projectileColor: 0xfde0b8,
    projectileShape: 'ball', radius: 28, contactDamage: 18,
    desc: 'Wrap up. Sand-skiff drift.',
    draw: drawMummyPug,
  },
  dragon_pug: {
    id: 'dragon_pug', name: 'Dragon Pug', tier: 3,
    hp: 400, speed: 220, fireRate: 420,
    projectileSpeed: 540, projectileDamage: 44, projectileColor: 0xff5a3a,
    projectileShape: 'fireball', radius: 30, contactDamage: 22,
    desc: 'Fire breath. Dragon mount. Such roar.',
    draw: drawDragonPug,
  },
};

// Tier pools — used by Game._getEvolveOptions
export const TIER_POOLS = {
  0: ['bork_pup'],
  1: ['loaf', 'snoot', 'zoom', 'wiggle', 'boop'],
  2: [
    'cheems', 'doge_knight', 'bonk_pug', 'walter', 'disco_pug', 'chef_pug', 'toast_pug',
    'boxer_pug', 'skater_pug', 'surfer_pug', 'race_pug', 'pizza_pug',
    'doctor_pug', 'cop_pug', 'punk_pug',
  ],
  3: [
    'cosmic_pug', 'demon_pug', 'pug_zilla', 'holy_pug',
    'cowboy_pug', 'pirate_pug', 'astronaut_pug', 'karate_pug', 'vampire_pug',
    'wizard_pug', 'mummy_pug', 'dragon_pug',
  ],
};

// XP needed to evolve from a tier
export const XP_TO_EVOLVE = {
  0: 30,
  1: 80,
  2: 160,
};

export function makePugVisual(formId) {
  const c = new Container();
  c.label = 'pug-visual';
  const form = FORMS[formId];
  form.draw(c);
  // v3: scale everything up ~18% so pug + vehicle read clearer with more
  // visible detail at the same world position.
  c.scale.set(1.18);
  return c;
}

// v3: bump collision radius to match the scaled-up visual
for (const id in FORMS) {
  FORMS[id].radius = Math.round(FORMS[id].radius * 1.18);
}
