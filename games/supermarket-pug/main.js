// SUPERMARKET PUG — top-down chaos heist.
// Walk a supermarket. Grab items (E or button). Knock shelves (SPACE).
// Shopping cart = speed boost but louder. Guards chase based on heat.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showGradeCard } from '../../src/shared/gradeCard.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';

// --- Custom item icons for ones not in the shared library ---------------------
// Chicken drumstick — beige leg + brown bone tip
function drawChicken(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // drumstick meat body
  ctx.fillStyle = '#d8a06a';
  ctx.fillRect(-4 * s, -2 * s, 8 * s, 7 * s);
  ctx.fillRect(-3 * s, -3 * s, 6 * s, 1 * s);
  ctx.fillRect(-3 * s,  5 * s, 6 * s, 1 * s);
  // shading underside
  ctx.fillStyle = '#a06a3a';
  ctx.fillRect(-4 * s,  4 * s, 8 * s, 1 * s);
  // crispy highlight
  ctx.fillStyle = '#ffd8a0';
  ctx.fillRect(-3 * s, -1 * s, 2 * s, 2 * s);
  // bone sticking out top
  ctx.fillStyle = '#f4ecd2';
  ctx.fillRect(-1 * s, -6 * s, 2 * s, 3 * s);
  ctx.fillRect(-2 * s, -7 * s, 2 * s, 2 * s);
  ctx.fillRect( 0 * s, -7 * s, 2 * s, 2 * s);
  ctx.restore();
}
// Donut — pink frosted ring with sprinkles
function drawDonut(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // body (brown dough)
  ctx.fillStyle = '#a0683a';
  ctx.fillRect(-5 * s, -4 * s, 10 * s, 8 * s);
  ctx.fillRect(-4 * s, -5 * s,  8 * s, 1 * s);
  ctx.fillRect(-4 * s,  4 * s,  8 * s, 1 * s);
  // pink frosting top
  ctx.fillStyle = '#ff3aa1';
  ctx.fillRect(-5 * s, -4 * s, 10 * s, 5 * s);
  ctx.fillRect(-4 * s, -5 * s,  8 * s, 1 * s);
  // hole
  ctx.fillStyle = '#0a0716';
  ctx.fillRect(-1 * s, -1 * s, 2 * s, 2 * s);
  // sprinkles
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-3 * s, -3 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#4cc9f0';
  ctx.fillRect( 2 * s, -3 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#5ef38c';
  ctx.fillRect(-3 * s,  0 * s, 1 * s, 1 * s);
  ctx.fillStyle = '#fff';
  ctx.fillRect( 2 * s,  0 * s, 1 * s, 1 * s);
  ctx.restore();
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'mart:muted' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'supermarket-pug', getControlsHelp: () => _isTouch
  ? 'JOYSTICK move · GRAB / RAM / CART buttons (right) · 💰 BRIBE button (top) · EXIT bottom-right. Saved to your profile.'
  : 'WASD move · E grab · SPACE ram · C cart · 💰 BRIBE top-right (B) · EXIT bottom-right. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const ITEMS = [
  { drawIconFn: drawIcon.meat,     name: 'steak',   val: 40 },
  { drawIconFn: drawChicken,       name: 'chicken', val: 20 },
  { drawIconFn: drawIcon.cheese,   name: 'cheese',  val: 25 },
  { drawIconFn: drawIcon.bacon,    name: 'bacon',   val: 30 },
  { drawIconFn: drawIcon.pizza,    name: 'pizza',   val: 35 },
  { drawIconFn: drawIcon.cake,     name: 'cake',    val: 28 },
  { drawIconFn: drawIcon.bone,     name: 'bone',    val: 50 },
  { drawIconFn: drawDonut,         name: 'donut',   val: 18 },
];

let pug, inCart, shelves, items, guards, exitZ, haul, bag, maxBag, heat, shelvesKnocked, running;
let popups, aisles, lights, cameras, decorCarts, pallets, sceneRows, sceneCols, sceneGx, sceneGy;
// Goose-Game-style per-run checklist: 3 picked from pool, tick off live. Each
// objective is { id, label, check(state) } where check returns true once met.
const OBJECTIVE_POOL = [
  { id: 'chicken', label: 'Steal a chicken',   check: (s) => s.namesTaken.has('chicken') },
  { id: 'steak',   label: 'Steal a steak',     check: (s) => s.namesTaken.has('steak') },
  { id: 'bone',    label: 'Steal the bone',    check: (s) => s.namesTaken.has('bone') },
  { id: 'donut',   label: 'Snatch a donut',    check: (s) => s.namesTaken.has('donut') },
  { id: 'pizza',   label: 'Slice a pizza',     check: (s) => s.namesTaken.has('pizza') },
  { id: 'knock3',  label: 'Knock over 3 shelves', check: (s) => s.shelvesKnocked >= 3 },
  { id: 'knock5',  label: 'Knock over 5 shelves', check: (s) => s.shelvesKnocked >= 5 },
  { id: 'cash50',  label: 'Escape with $50+',  check: (s) => s.escaped && s.haul >= 50, finalOnly: true },
  { id: 'cash150', label: 'Escape with $150+', check: (s) => s.escaped && s.haul >= 150, finalOnly: true },
  { id: 'bagFull', label: 'Fill your bag (8)', check: (s) => s.bag >= s.maxBag },
  { id: 'undetected', label: 'Escape never spotted', check: (s) => s.escaped && !s.everSpotted, finalOnly: true },
];
let objectives = [];     // [{id,label,check,done}] — 3 per run
let everSpotted = false; // tracked for stealth objective
// Guard reactive barks — speech bubble above guard when player is freshly spotted
const BARK_LINES = ['HEY!', 'STOP!', 'THIEF!', 'GET BACK HERE!'];
// BLACK MARKET MID-RUN BRIBES — one-time-per-run buys spent from haul.
const BRIBE_DEFS = [
  { id: 'guardBreak',  cost: 80,  name: 'GUARD BREAK',  icon: '💤', desc: 'Both guards freeze for 10 seconds' },
  { id: 'cameraBlink', cost: 60,  name: 'CAMERA BLINK', icon: '📷', desc: 'Cameras + heat off for 8 seconds' },
  { id: 'tipOff',      cost: 100, name: 'TIP-OFF',      icon: '⭐', desc: 'Reveal most valuable item with glow halo' },
];
let bribesBought = {};   // id -> true when used (one-time-per-run)
let bribeOpen = false;
let guardFreezeT = 0;    // seconds remaining
let cameraBlinkT = 0;    // seconds remaining
let highlightedItem = null; // tip-off target ref
let shakeT = 0, shakeAmp = 0;
// New map decor + alarm mechanic
let saleSigns = [];     // {x, y, text, color, phase}
let priceFlags = [];    // {x, y, color, phase}
let frozenAisleY = 0;   // y-center of the frozen aisle (one of the aisles)
let frozenAisleH = 0;   // height of slow zone
let cleanerBot = null;  // {x, y, ang, speed, brushPhase}
let counter = null;     // {x, y, w, h}
let alarm = { on: false, T: 0, escaped: false, bonus: 0 };
let breathPuffs = [];   // {x, y, vy, life, max}
function shake(amp, dur) { const k = _shakeMul(); shakeAmp = Math.max(shakeAmp, amp * k); shakeT = Math.max(shakeT, dur); }
function popup(x, y, text, color) {
  if (!popups) return;
  if (popups.length > 24) popups.shift();
  popups.push({ x, y, vy: -36, text, color: color || '#5ef38c', life: 0.9, t: 0 });
}
function reset() {
  pug = { x: W / 2, y: H - 80, vx: 0, vy: 0, ang: 0 };
  inCart = false;
  // EXIT zone moved to bottom-right (next to the checkout counter)
  shelves = []; items = []; guards = []; exitZ = { x: W - 70, y: H - 50, r: 32 };
  popups = []; aisles = []; lights = []; cameras = []; decorCarts = []; pallets = [];
  saleSigns = []; priceFlags = []; breathPuffs = [];
  cleanerBot = null; counter = null;
  alarm = { on: false, T: 0, escaped: false, bonus: 0 };
  shakeT = 0; shakeAmp = 0;
  haul = 0; bag = 0; maxBag = 8; heat = 0; shelvesKnocked = 0;
  // Generate shelf grid
  const rows = 4, cols = 5;
  const sw = 80, sh = 24, gx = (W - cols * 120) / 2, gy = 100;
  sceneRows = rows; sceneCols = cols; sceneGx = gx; sceneGy = gy;
  for (let r = 0; r < rows; r++) {
    aisles.push({ x: gx, y: gy + r * 100 + sh + 30, w: cols * 120, n: r + 1 });
    for (let c = 0; c < cols; c++) {
      const sh1 = { x: gx + c * 120 + 20, y: gy + r * 100, w: sw, h: sh, hp: 2, seed: (r * 13 + c * 7) | 0 };
      shelves.push(sh1);
      // Items on top of shelf — keep deterministic-ish product slots so render can show varied colors below
      for (let i = 0; i < 3; i++) {
        const it = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        items.push({ x: sh1.x + 12 + i * 22, y: sh1.y - 4, item: it, on: sh1, taken: false });
      }
    }
  }
  // Ceiling light strips along the top of each row
  for (let r = 0; r < rows; r++) {
    lights.push({ x: gx - 12, y: gy + r * 100 - 18, w: cols * 120 + 24, h: 4 });
  }
  // Security cameras (decorative) at top corners
  cameras.push({ x: 40, y: 40, ang: 0.5, phase: 0 });
  cameras.push({ x: W - 40, y: 40, ang: Math.PI - 0.5, phase: Math.PI });
  // Shopping carts as decoration (parked near the bottom)
  for (let i = 0; i < 3; i++) {
    decorCarts.push({ x: 80 + i * 70, y: H - 40, ang: (Math.random() - 0.5) * 0.4 });
  }
  // Restock pallets — between rows
  for (let r = 0; r < rows - 1; r++) {
    pallets.push({ x: gx + (r % 2 ? cols - 1 : 0) * 120 + 4, y: gy + r * 100 + 60, w: 28, h: 22 });
  }
  // Guards (2)
  guards.push({ x: 60, y: 60, vx: 0, vy: 0, ang: 0, alertT: 0, target: null });
  guards.push({ x: W - 60, y: 60, vx: 0, vy: 0, ang: 0, alertT: 0, target: null });
  // SALE SIGNS hanging from ceiling between aisle rows
  const saleTexts = [
    { text: '50% OFF KIBBLE', color: '#ff3a3a' },
    { text: 'BACON SALE!',     color: '#ff8e3c' },
    { text: 'TREATS 2-FOR-1',  color: '#5ef38c' },
    { text: 'PIZZA NIGHT',     color: '#ffd23f' },
  ];
  for (let i = 0; i < Math.min(saleTexts.length, sceneRows); i++) {
    saleSigns.push({
      x: sceneGx + (i % 2 === 0 ? sceneCols * 100 * 0.3 : sceneCols * 100 * 0.7),
      y: sceneGy + i * 100 - 60,
      ...saleTexts[i],
      phase: Math.random() * Math.PI * 2,
    });
  }
  // PRICE-CHECK FLAGS on shelves (small triangular)
  for (let i = 0; i < Math.min(8, shelves.length); i += 2) {
    const s = shelves[i];
    const flagCol = ['#ff3a3a', '#ffd23f', '#5ef38c', '#4cc9f0'][i % 4];
    priceFlags.push({ x: s.x + 14, y: s.y - 4, color: flagCol, phase: Math.random() * Math.PI * 2 });
    priceFlags.push({ x: s.x + s.w - 14, y: s.y - 4, color: flagCol, phase: Math.random() * Math.PI * 2 + 1 });
  }
  // FROZEN AISLE — pick the 2nd aisle's row (visible blue tint, slow movement)
  if (aisles[1]) {
    const a = aisles[1];
    frozenAisleY = a.y;
    frozenAisleH = 100;
  }
  // CLEANING ROBOT — patrols a slow oval loop on the floor
  cleanerBot = {
    x: W / 2 - 100, y: H - 130, ang: 0, speed: 60,
    cx: W / 2, cy: H - 130, rx: 130, ry: 60, brushPhase: 0,
  };
  // CHECKOUT COUNTER along bottom — player must pass to exit
  counter = { x: 30, y: H - 60, w: W - 60, h: 18 };
  // Black-market state
  bribesBought = {};
  bribeOpen = false;
  guardFreezeT = 0;
  cameraBlinkT = 0;
  highlightedItem = null;
  // Roll 3 random objectives (no duplicates) from the pool for this run.
  objectives = [];
  const pool = OBJECTIVE_POOL.slice();
  for (let i = 0; i < 3 && pool.length; i++) {
    const k = Math.floor(Math.random() * pool.length);
    objectives.push({ ...pool.splice(k, 1)[0], done: false });
  }
  everSpotted = false;
  renderObjectivesPanel();
  renderBribeChips();
}

// Build a snapshot of the player state for objective checking
function _objectiveState(opts) {
  const namesTaken = new Set();
  for (const it of items) if (it.taken) namesTaken.add(it.item.name);
  return {
    namesTaken, shelvesKnocked,
    haul, bag, maxBag,
    escaped: !!(opts && opts.escaped),
    everSpotted,
  };
}
// Re-evaluate objectives; tick newly-met ones with a popup + sfx.
function checkObjectives(opts) {
  if (!objectives || !objectives.length) return;
  const state = _objectiveState(opts);
  let changed = false;
  for (const o of objectives) {
    if (o.done) continue;
    if (o.finalOnly && !state.escaped) continue;
    if (o.check(state)) {
      o.done = true; changed = true;
      sfx.arp([523, 784, 1047], 'triangle', 0.05, 0.18, 0.12);
      popup(pug.x, pug.y - 30, '✓ ' + o.label.toUpperCase(), '#ffd23f');
    }
  }
  if (changed) renderObjectivesPanel();
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'e' || e.key === 'E') grabNear();
  if (e.key === ' ' || e.code === 'Space') ram();
  if (e.key === 'c' || e.key === 'C') toggleCart();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
document.getElementById('cart-btn').addEventListener('click', toggleCart);
if ('ontouchstart' in window) document.getElementById('cart-btn').style.display = 'block';
// Universal mobile controls — joystick + GRAB/RAM/CART buttons
createMobileControls({
  layout: 'wasd-only',
  keys,
  buttons: [
    { id: 'grab', label: 'GRAB', key: 'E' },
    { id: 'ram',  label: 'RAM',  key: 'Space' },
    { id: 'cart', label: 'CART', key: 'C' },
  ],
  getCanvas: () => canvas,
});
let touchAt = null;
canvas.addEventListener('touchstart', (e) => { touchAt = e.touches[0]; grabNear(); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAt = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAt = null);

function grabNear() {
  if (!running) return;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.taken) continue;
    if (Math.hypot(it.x - pug.x, it.y - pug.y) < 30) {
      if (bag < maxBag) {
        it.taken = true;
        bag++;
        haul += it.item.val;
        popup(it.x, it.y - 10, '+$' + it.item.val);
        sfx.tone(880, 'triangle', 0.07, 0.18);
        checkObjectives();
        return;
      } else {
        popup(pug.x, pug.y - 24, 'BAG FULL', '#ff3a3a');
        sfx.tone(220, 'sawtooth', 0.08, 0.18);
        return;
      }
    }
  }
}

// Cart-momentum domino chain: knock the shelf over, fling it along (nx, ny),
// then look for any adjacent shelves within `chainR` and recurse with reduced
// power. Each link bumps heat and adds a popup; max chain depth keeps it
// from going O(n^2 * recurse-forever).
function knockOverShelf(s, nx, ny, power, chainDepth) {
  if (!s || s.hp <= 0 || s.toppled || chainDepth > 6) return;
  s.hp = 0; s.toppled = true;
  s.tvx = nx * (40 + power * 0.4);
  s.tvy = ny * (40 + power * 0.4);
  s.tlife = 0;
  // Drop all items on this shelf
  for (const it of items) {
    if (it.on === s && !it.taken) { it.y += 18; it.fallen = true; }
  }
  shelvesKnocked++;
  heat = Math.min(1, heat + 0.18 + chainDepth * 0.04);
  shake(3 + chainDepth, 0.18);
  sfx.tone(140 - chainDepth * 12, 'sawtooth', 0.12, 0.22);
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  popup(cx, cy - 18, chainDepth === 0 ? 'DOMINO!' : `CHAIN ×${chainDepth + 1}`, chainDepth === 0 ? '#ffd23f' : '#ff3aa1');
  checkObjectives();
  // Chain into nearby shelves within ~110px along the impact direction
  const chainR = 130;
  const nextPower = power * 0.7;
  if (nextPower < 80) return;
  // Sort candidates by signed distance along (nx,ny) so we cascade outward
  const candidates = [];
  for (const o of shelves) {
    if (o === s || o.hp <= 0 || o.toppled) continue;
    const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
    const dx = ocx - cx, dy = ocy - cy;
    const proj = dx * nx + dy * ny; // distance along impact dir
    const dist = Math.hypot(dx, dy);
    if (dist < chainR && proj > -10) candidates.push({ o, proj, dist });
  }
  candidates.sort((a, b) => a.dist - b.dist);
  // Knock the closest up to 2 in chain to avoid wiping the whole row in one hit
  for (let i = 0; i < Math.min(2, candidates.length); i++) {
    const next = candidates[i];
    // Use the relative direction from current shelf to next as the new impact
    const tx = (next.o.x + next.o.w / 2) - cx;
    const ty = (next.o.y + next.o.h / 2) - cy;
    const tl = Math.hypot(tx, ty) || 1;
    knockOverShelf(next.o, tx / tl, ty / tl, nextPower, chainDepth + 1);
  }
}

function ram() {
  if (!running) return;
  for (const s of shelves) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    if (Math.hypot(cx - pug.x, cy - pug.y) < 40) {
      s.hp--;
      heat = Math.min(1, heat + 0.18);
      sfx.tone(180, 'sawtooth', 0.1, 0.22);
      if (s.hp <= 0) {
        // Drop all items
        for (const it of items) {
          if (it.on === s && !it.taken) {
            it.y += 18;
            it.fallen = true;
          }
        }
        shelvesKnocked++;
        shelves = shelves.filter((x) => x !== s);
        sfx.tone(110, 'square', 0.2, 0.24);
        shake(6, 0.22);
        checkObjectives();
      } else {
        shake(2, 0.1);
      }
      return;
    }
  }
}

function toggleCart() {
  inCart = !inCart;
  heat = Math.min(1, heat + 0.1);
  sfx.tone(550, 'square', 0.06, 0.16);
}

function tick(dt) {
  if (!running) return;
  if (bribeOpen) return; // pause world during bribe panel
  // Decrement bribe timers
  if (guardFreezeT > 0) guardFreezeT -= dt;
  if (cameraBlinkT > 0) cameraBlinkT -= dt;
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchAt) {
    mx = touchAt.clientX - pug.x; my = touchAt.clientY - pug.y;
    const l = Math.hypot(mx, my);
    if (l > 20) { mx /= l; my /= l; } else { mx = 0; my = 0; }
  }
  // Frozen aisle slows movement by 15%
  let frozen = false;
  if (frozenAisleH && pug.y > frozenAisleY - frozenAisleH / 2 && pug.y < frozenAisleY + frozenAisleH / 2) frozen = true;
  let speed = inCart ? 280 : 160;
  if (frozen) speed *= 0.85;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    pug.vx += (mx / l) * speed * dt * 4;
    pug.vy += (my / l) * speed * dt * 4;
    pug.ang = Math.atan2(my, mx);
    if (inCart) heat = Math.min(1, heat + dt * 0.04);
  }
  // Breath puffs while in frozen aisle
  if (frozen && Math.random() < dt * 4 && breathPuffs.length < 40) {
    breathPuffs.push({ x: pug.x + 6, y: pug.y - 4, vy: -20, life: 0, max: 0.8 + Math.random() * 0.3 });
  }
  for (let i = breathPuffs.length - 1; i >= 0; i--) {
    const b = breathPuffs[i]; b.life += dt; b.y += b.vy * dt; b.vy *= 0.95;
    if (b.life >= b.max) breathPuffs.splice(i, 1);
  }
  // Shelf collision (block movement) + cart-momentum knockover.
  // In cart mode @ high speed, hitting a shelf knocks it down (HP -> 0) and
  // imparts velocity to it, which can chain-knock adjacent shelves.
  pug.x += pug.vx * dt; pug.y += pug.vy * dt;
  pug.vx *= Math.pow(0.5, dt * 4); pug.vy *= Math.pow(0.5, dt * 4);
  const pugSpeed = Math.hypot(pug.vx, pug.vy);
  for (const s of shelves) {
    if (s.toppled) continue; // toppled shelves are visually-only (flat on floor)
    if (pug.x + 14 > s.x && pug.x - 14 < s.x + s.w && pug.y + 14 > s.y && pug.y - 14 < s.y + s.h) {
      // Cart RAM threshold: speed > 200 in-cart triggers domino chain
      if (inCart && pugSpeed > 200 && s.hp > 0) {
        // Direction of ram = velocity normalized
        const len = pugSpeed || 1;
        const nx = pug.vx / len, ny = pug.vy / len;
        knockOverShelf(s, nx, ny, pugSpeed, /*chainDepth*/ 0);
        // Player keeps most momentum (only mild slow)
        pug.vx *= 0.6; pug.vy *= 0.6;
        continue;
      }
      // Normal push-out
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const dx = pug.x - cx, dy = pug.y - cy;
      if (Math.abs(dx) > Math.abs(dy)) pug.x = dx > 0 ? s.x + s.w + 14 : s.x - 14;
      else pug.y = dy > 0 ? s.y + s.h + 14 : s.y - 14;
      pug.vx *= 0.5; pug.vy *= 0.5;
    }
  }
  // Tick toppling shelves' visual flight (slides briefly then settles).
  for (const s of shelves) {
    if (!s.toppled) continue;
    if (s.tvx == null) continue;
    s.x += s.tvx * dt; s.y += s.tvy * dt;
    s.tvx *= Math.pow(0.5, dt * 3); s.tvy *= Math.pow(0.5, dt * 3);
    s.tlife = (s.tlife || 0) + dt;
    if (s.tlife > 0.6) { s.tvx = 0; s.tvy = 0; }
  }
  pug.x = Math.max(20, Math.min(W - 20, pug.x));
  pug.y = Math.max(20, Math.min(H - 20, pug.y));
  // ALARM trigger — once heat goes above 0.95, alarm latches on
  if (!alarm.on && heat >= 0.95) {
    alarm.on = true;
    alarm.T = 8;
    sfx.sweep(800, 200, 'square', 0.4, 0.25);
    shake(8, 0.4);
  }
  // Heat decays slowly UNLESS alarm is on
  if (!alarm.on) heat = Math.max(0, heat - dt * 0.05);
  else { heat = 1; alarm.T -= dt; if (alarm.T <= 0) alarm.T = 0; }
  // Cleaner robot — patrols an elliptical loop; sees player at close range -> heat spike
  if (cleanerBot) {
    cleanerBot.ang += dt * 0.6;
    cleanerBot.x = cleanerBot.cx + Math.cos(cleanerBot.ang) * cleanerBot.rx;
    cleanerBot.y = cleanerBot.cy + Math.sin(cleanerBot.ang) * cleanerBot.ry;
    cleanerBot.brushPhase += dt * 12;
    const d = Math.hypot(pug.x - cleanerBot.x, pug.y - cleanerBot.y);
    // CAMERA BLINK suppresses cleaner-bot spotting
    if (d < 38 && cameraBlinkT <= 0) {
      heat = Math.min(1, heat + 0.6 * dt);
      // brief popup, throttled
      if (Math.random() < dt * 1.5) popup(cleanerBot.x, cleanerBot.y - 14, 'SPOTTED!', '#ff3a3a');
    }
  }
  // Guards (alarm = omniscient + 1.5x speed)
  for (const g of guards) {
    const dx = pug.x - g.x, dy = pug.y - g.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let diff = ang - g.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // GUARD BREAK bribe: guards frozen + sleepy (don't see, don't move)
    if (guardFreezeT > 0) {
      g.alertT = 0;
      continue;
    }
    const sees = d < 200 && Math.abs(diff) < 0.5;
    // CAMERA BLINK suppresses sight-based heat gain too
    if (sees) {
      // Rising-edge: guard newly spots player → bark + speech bubble (1.2s).
      if ((g.alertT || 0) <= 0 && cameraBlinkT <= 0) {
        const line = BARK_LINES[Math.floor(Math.random() * BARK_LINES.length)];
        g.bark = { text: line, t: 0, life: 1.2 };
        sfx.tone(660, 'square', 0.06, 0.14);
        everSpotted = true;
      }
      g.alertT = 3;
      if (cameraBlinkT <= 0) heat = Math.min(1, heat + 0.4 * dt);
    }
    if (heat > 0.7) g.alertT = Math.max(g.alertT, 1.5);
    if (alarm.on) g.alertT = 5; // always know
    if (g.alertT > 0) {
      g.alertT -= dt;
      g.ang = ang;
      const gs = alarm.on ? 140 * 1.5 : 140;
      g.x += (dx / d) * gs * dt; g.y += (dy / d) * gs * dt;
    } else {
      // patrol along x
      g.ang += dt * 0.4;
      g.x += Math.cos(g.ang) * 30 * dt;
      g.y += Math.sin(g.ang) * 30 * dt;
      g.x = Math.max(40, Math.min(W - 40, g.x));
      g.y = Math.max(40, Math.min(H - 100, g.y));
    }
    if (d < 22) return caught();
  }
  // Exit reach
  if (Math.hypot(exitZ.x - pug.x, exitZ.y - pug.y) < exitZ.r) {
    if (haul > 0) {
      // 50% bonus if escaped during active alarm window
      if (alarm.on && alarm.T > 0) { alarm.escaped = true; alarm.bonus = Math.floor(haul * 0.5); }
      end(true);
    }
  }
  // If alarm timer ran out and player didn't escape, instant game over
  if (alarm.on && alarm.T <= 0 && !alarm.escaped) {
    // Only trigger once
    if (!alarm.timeoutFired) {
      alarm.timeoutFired = true;
      caught();
      return;
    }
  }
  // popups + shake decay
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt; p.y += p.vy * dt; p.vy *= 0.9;
    if (p.t >= p.life) popups.splice(i, 1);
  }
  shakeT = Math.max(0, shakeT - dt); if (shakeT === 0) shakeAmp = 0;
  updateHud();
}

function drawCart(x, y, ang, big) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  // basket
  ctx.fillStyle = '#8a8a9a';
  ctx.fillRect(-18, -12, 36, 20);
  // diagonal mesh
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
  for (let i = -16; i < 18; i += 5) {
    ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i + 6, 8); ctx.stroke();
  }
  // handle
  ctx.strokeStyle = '#cacad6'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(-22, -4); ctx.stroke();
  // wheels
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(-16, 8, 6, 4); ctx.fillRect(10, 8, 6, 4);
  ctx.restore();
}
function render() {
  // screen-shake offset
  const sx = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  const sy = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  // Vinyl tile floor (alternating pattern)
  ctx.fillStyle = '#3a3a4a'; ctx.fillRect(-8, -8, W + 16, H + 16);
  const TS = 48;
  for (let y = 0; y < H; y += TS) {
    for (let x = 0; x < W; x += TS) {
      const c = ((x / TS | 0) + (y / TS | 0)) & 1;
      ctx.fillStyle = c ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x, y, TS, TS);
    }
  }
  // subtle grout lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += TS) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += TS) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();

  // FROZEN AISLE tint (drawn before aisle numbers so labels are on top)
  if (frozenAisleH) {
    const fg = ctx.createLinearGradient(0, frozenAisleY - frozenAisleH / 2, 0, frozenAisleY + frozenAisleH / 2);
    fg.addColorStop(0, 'rgba(76,201,240,0)');
    fg.addColorStop(0.5, 'rgba(76,201,240,0.18)');
    fg.addColorStop(1, 'rgba(76,201,240,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, frozenAisleY - frozenAisleH / 2, W, frozenAisleH);
    // tiny ice crystals
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 14; i++) {
      const fx = (i * 73 + (performance.now() / 80)) % W;
      const fy = frozenAisleY + Math.sin(i * 1.3 + performance.now() / 800) * 24;
      ctx.fillRect(fx, fy, 2, 2);
    }
    // "FROZEN" label tag at left edge
    ctx.fillStyle = 'rgba(76,201,240,0.6)';
    ctx.font = "bold 8px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText('* FROZEN *', 8, frozenAisleY + 3);
  }
  // Aisle numbers between rows
  ctx.fillStyle = 'rgba(255,210,63,0.35)';
  ctx.font = "bold 9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  for (const a of aisles) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(a.x, a.y - 8, a.w, 16);
    ctx.fillStyle = 'rgba(255,210,63,0.4)';
    ctx.fillText('· AISLE ' + a.n + ' ·', a.x + a.w / 2, a.y + 3);
  }

  // Restock pallets (decorative)
  for (const p of pallets) {
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(p.x, p.y + p.h - 4, p.w, 2);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 4);
    ctx.fillRect(p.x + 2, p.y + 10, p.w - 4, 4);
    // small cardboard boxes on top
    ctx.fillStyle = '#a87a4a'; ctx.fillRect(p.x + 4, p.y - 6, 8, 8); ctx.fillRect(p.x + 16, p.y - 6, 8, 8);
  }

  // Decor carts parked at bottom
  for (const c of decorCarts) drawCart(c.x, c.y, c.ang);

  // Ceiling light strips (subtle yellow glow above rows)
  for (const l of lights) {
    const grad = ctx.createLinearGradient(0, l.y - 12, 0, l.y + 16);
    grad.addColorStop(0, 'rgba(255,230,150,0)');
    grad.addColorStop(0.5, 'rgba(255,230,150,0.16)');
    grad.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = grad; ctx.fillRect(l.x, l.y - 12, l.w, 28);
    ctx.fillStyle = '#fff7d0'; ctx.fillRect(l.x, l.y, l.w, l.h);
  }

  // CHECKOUT COUNTER along the bottom (long bar with register + belt + EXIT sign)
  if (counter) {
    // belt (light grey)
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(counter.x, counter.y, counter.w, counter.h);
    ctx.fillStyle = '#8a8a9a';
    ctx.fillRect(counter.x, counter.y + 2, counter.w, 4);
    // belt rollers (small dark stripes that "move")
    const rollerOff = (performance.now() / 60) % 24;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let bx = counter.x - 24 + rollerOff; bx < counter.x + counter.w; bx += 24) {
      ctx.fillRect(bx, counter.y + 2, 12, 4);
    }
    // counter body
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(counter.x, counter.y + 8, counter.w, counter.h - 8);
    // register at the left side
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(counter.x + 30, counter.y - 22, 28, 22);
    ctx.fillStyle = '#fff';
    ctx.fillRect(counter.x + 34, counter.y - 18, 20, 8);
    ctx.fillStyle = '#1a0d05';
    ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('$' + haul, counter.x + 44, counter.y - 12);
    // banana on belt
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(counter.x + 130 + Math.sin(performance.now() / 800) * 6, counter.y + 4, 9, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(counter.x + 122 + Math.sin(performance.now() / 800) * 6, counter.y + 2, 2, 2);
    // ANGRY CASHIER PUG appears at counter when heat is high (decorative)
    if (heat > 0.6) {
      const cx = counter.x + 90;
      const cy = counter.y - 16;
      // pug head
      ctx.fillStyle = '#c8854a';
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(cx - 4, cy - 3, 2, 2); ctx.fillRect(cx + 2, cy - 3, 2, 2);
      // angry brows
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(cx - 5, cy - 6, 4, 1); ctx.fillRect(cx + 1, cy - 6, 4, 1);
      // angry mouth
      ctx.fillRect(cx - 3, cy + 3, 6, 1);
      // shouting badge
      ctx.fillStyle = '#ff3a3a'; ctx.font = "8px sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('!!', cx + 14, cy - 4);
    }
  }
  // EXIT zone (bottom-right, next to counter)
  ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 16;
  ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(exitZ.x, exitZ.y, exitZ.r, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#5ef38c'; ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('EXIT →', exitZ.x, exitZ.y + 4);

  // Shelves — multi-tier with colorful products visible
  const PROD = ['#ff5a3a', '#ffd23f', '#5ef38c', '#4cc9f0', '#c062ff', '#ff8e3c'];
  for (const s of shelves) {
    // TOPPLED shelves render as a flat "fallen" rectangle on the floor with
    // scattered product dots so the player can read the chaos.
    if (s.toppled) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(s.x - 2, s.y + s.h - 4, s.w + 4, 6);
      ctx.fillStyle = '#3a2a14';
      ctx.fillRect(s.x, s.y + s.h - 8, s.w, 8); // flat board
      ctx.fillStyle = '#5a3a1c';
      ctx.fillRect(s.x, s.y + s.h - 10, s.w, 2);
      // Scattered products
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = PROD[(s.seed + i) % PROD.length];
        const px = s.x + 4 + ((i * 13 + (s.seed * 7) % 19) % (s.w - 8));
        const py = s.y + s.h - 12 + ((i * 5 + (s.seed * 3) % 7) % 8);
        ctx.fillRect(px, py, 5, 4);
      }
      continue;
    }
    // back board
    ctx.fillStyle = s.hp > 1 ? '#5a3a1c' : '#3a2a14';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // top trim
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(s.x, s.y, s.w, 3);
    // products line on the front
    for (let i = 0; i < 6; i++) {
      const pc = PROD[(s.seed + i) % PROD.length];
      ctx.fillStyle = pc;
      ctx.fillRect(s.x + 2 + i * 13, s.y + 5, 10, s.h - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(s.x + 2 + i * 13, s.y + 5, 10, 2);
    }
    // damage cracks if hp <=1
    if (s.hp <= 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x + 8, s.y + 4); ctx.lineTo(s.x + 22, s.y + 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x + 40, s.y + 6); ctx.lineTo(s.x + 56, s.y + 20); ctx.stroke();
    }
    // shelf shadow on floor
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(s.x + 2, s.y + s.h, s.w - 4, 4);
  }
  // Items
  for (const it of items) {
    if (it.taken) continue;
    // TIP-OFF halo on highlighted item
    if (highlightedItem === it) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
      ctx.save();
      ctx.fillStyle = `rgba(255,210,63,${0.25 * pulse})`;
      ctx.beginPath(); ctx.arc(it.x, it.y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,210,63,${0.8 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(it.x, it.y, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (it.item.drawIconFn) it.item.drawIconFn(ctx, it.x, it.y, 18);
  }
  // Security cameras at corners (decorative, animated pan)
  const tNow = performance.now() * 0.001;
  for (const cam of cameras) {
    const pan = Math.sin(tNow * 0.6 + cam.phase) * 0.4;
    // bracket
    ctx.fillStyle = '#2a2a3a'; ctx.fillRect(cam.x - 6, cam.y - 6, 12, 4);
    // camera body
    ctx.save(); ctx.translate(cam.x, cam.y); ctx.rotate(cam.ang + pan);
    ctx.fillStyle = '#1a1a26'; ctx.fillRect(-8, -4, 14, 8);
    ctx.fillStyle = '#4cc9f0'; ctx.fillRect(4, -2, 4, 4); // lens
    // faint vision indicator
    ctx.fillStyle = 'rgba(76,201,240,0.07)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -0.4, 0.4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // tiny red recording dot — dim during CAMERA BLINK
    ctx.fillStyle = cameraBlinkT > 0
      ? '#2a1a1a'
      : (((tNow * 1.5 | 0) & 1) ? '#ff3a3a' : '#7a1a1a');
    ctx.fillRect(cam.x - 2, cam.y + 2, 2, 2);
  }
  // Guards — vision cone + high-detail security pug
  for (const g of guards) {
    const frozen = guardFreezeT > 0;
    ctx.fillStyle = frozen
      ? 'rgba(120,120,180,0.12)'
      : `rgba(255,58,58,${g.alertT > 0 ? 0.3 : 0.15})`;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, 200, g.ang - 0.5, g.ang + 0.5);
    ctx.closePath(); ctx.fill();
    drawPug(ctx, g.x, g.y, { size: 34, body: frozen ? '#8a8aac' : '#4cc9f0', mask: '#1a3a55', hat: true, hatColor: '#0a1a2a' });
    if (frozen) {
      ctx.fillStyle = '#b0e0ff'; ctx.font = "bold 12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('Zzz', g.x, g.y - 28);
    } else if (g.alertT > 0) {
      ctx.fillStyle = '#ff3a3a'; ctx.font = "16px sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 28);
    }
    // Speech bubble bark — white rounded rect with red text above the guard.
    // Use real elapsed time (now - lastT) so frame-rate variation doesn't desync
    // the fade. Renderer-only tick means it pauses correctly with the game
    // (render is gated by `if (running) render()`).
    if (g.bark) {
      const nowB = performance.now() / 1000;
      const lastB = g.bark._lastT || nowB;
      g.bark.t += Math.max(0, Math.min(0.1, nowB - lastB));
      g.bark._lastT = nowB;
      if (g.bark.t >= g.bark.life) { g.bark = null; }
      else {
        const txt = g.bark.text;
        ctx.font = "bold 9px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        const tw = ctx.measureText(txt).width;
        const bx = g.x - tw / 2 - 6, by = g.y - 50, bw = tw + 12, bh = 16;
        const alpha = g.bark.t < 0.15
          ? g.bark.t / 0.15
          : (g.bark.t > g.bark.life - 0.25 ? Math.max(0, (g.bark.life - g.bark.t) / 0.25) : 1);
        ctx.globalAlpha = alpha;
        // rounded rect
        ctx.fillStyle = '#fff';
        const rr = 4;
        ctx.beginPath();
        ctx.moveTo(bx + rr, by);
        ctx.lineTo(bx + bw - rr, by);
        ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + rr);
        ctx.lineTo(bx + bw, by + bh - rr);
        ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - rr, by + bh);
        ctx.lineTo(bx + rr, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - rr);
        ctx.lineTo(bx, by + rr);
        ctx.quadraticCurveTo(bx, by, bx + rr, by);
        ctx.closePath(); ctx.fill();
        // tail
        ctx.beginPath();
        ctx.moveTo(g.x - 4, by + bh);
        ctx.lineTo(g.x + 4, by + bh);
        ctx.lineTo(g.x, by + bh + 6);
        ctx.closePath(); ctx.fill();
        // text
        ctx.fillStyle = '#c81e1e';
        ctx.fillText(txt, g.x, by + 11);
        ctx.globalAlpha = 1;
      }
    }
  }
  // Pug (and cart if active) — use the same cart art for consistency
  if (inCart) drawCart(pug.x, pug.y + 4, 0);
  drawPug(ctx, pug.x, pug.y - (inCart ? 6 : 0), { size: 28 });
  // Score popups
  for (const p of popups) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.font = "bold 11px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  // Hanging SALE signs from ceiling (swaying gently)
  for (const sg of saleSigns) {
    const sway = Math.sin(performance.now() * 0.002 + sg.phase) * 4;
    // chain
    ctx.fillStyle = 'rgba(180,180,200,0.5)';
    ctx.fillRect(sg.x + sway / 2 - 1, sg.y - 16, 2, 16);
    // sign body
    ctx.save();
    ctx.translate(sg.x + sway, sg.y);
    ctx.rotate(sway * 0.01);
    ctx.fillStyle = sg.color;
    ctx.shadowColor = sg.color; ctx.shadowBlur = 8;
    ctx.fillRect(-58, -8, 116, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(-58, -8, 116, 2); ctx.fillRect(-58, 8, 116, 2);
    ctx.fillStyle = '#fff'; ctx.font = "bold 7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(sg.text, 0, 3);
    ctx.restore();
  }
  // Price-check FLAGS on shelves (triangular, fluttering)
  for (const f of priceFlags) {
    const sway = Math.sin(performance.now() * 0.004 + f.phase) * 2;
    // pole
    ctx.fillStyle = '#cacad6';
    ctx.fillRect(f.x, f.y - 12, 1, 12);
    // flag triangle
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(f.x + 1, f.y - 12);
    ctx.lineTo(f.x + 1, f.y - 4);
    ctx.lineTo(f.x + 9 + sway, f.y - 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(f.x + 3, f.y - 9, 1, 1);
  }
  // Cleaner robot — round body, antenna, spinning brush
  if (cleanerBot) {
    const cx = cleanerBot.x, cy = cleanerBot.y;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 12, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    // body
    ctx.fillStyle = '#cacad6';
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a8a9a';
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI, false); ctx.fill();
    // brush (rotating)
    ctx.save();
    ctx.translate(cx, cy + 10);
    ctx.rotate(cleanerBot.brushPhase);
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.fillRect(0, 0, 8, 2);
    }
    ctx.restore();
    // antenna
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(cx - 1, cy - 18, 2, 8);
    ctx.fillStyle = '#ff3a3a';
    const blink = (((performance.now() / 200) | 0) & 1) ? '#ff3a3a' : '#7a1a1a';
    ctx.fillStyle = blink;
    ctx.beginPath(); ctx.arc(cx, cy - 18, 2, 0, Math.PI * 2); ctx.fill();
    // eye dot
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(cx - 2, cy - 4, 4, 2);
    // mini detection ring
    ctx.strokeStyle = 'rgba(255,58,58,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.stroke();
  }
  // Breath puffs (frozen aisle)
  for (const b of breathPuffs) {
    const a = 1 - b.life / b.max;
    ctx.fillStyle = `rgba(220,240,255,${a * 0.5})`;
    ctx.beginPath(); ctx.arc(b.x, b.y, 4 + (1 - a) * 4, 0, Math.PI * 2); ctx.fill();
  }
  // Heat bar — pulses if hot
  const hotPulse = heat > 0.7 ? (0.7 + 0.3 * Math.sin(performance.now() * 0.02)) : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - 100, 18, 200, 8);
  ctx.fillStyle = heat > 0.7 ? '#ff3a3a' : (heat > 0.4 ? '#ffd23f' : '#5ef38c');
  ctx.globalAlpha = hotPulse;
  ctx.fillRect(W / 2 - 100, 18, 200 * heat, 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('HEAT', W / 2, 14);
  // High-heat vignette
  if (heat > 0.7) {
    const a = (heat - 0.7) / 0.3 * 0.35 * hotPulse;
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.65);
    grad.addColorStop(0, 'rgba(255,58,58,0)');
    grad.addColorStop(1, `rgba(255,58,58,${a})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }
  // ALARM strobe overlay + countdown chip
  if (alarm.on) {
    const strobePhase = (performance.now() / 200) % 2;
    const isRed = strobePhase < 1;
    const edge = isRed ? 'rgba(255,58,58,0.45)' : 'rgba(76,201,240,0.45)';
    // top and bottom edges only — not a full overlay (lets player see)
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, 18);
    ctx.fillRect(0, H - 18, W, 18);
    ctx.fillRect(0, 0, 12, H);
    ctx.fillRect(W - 12, 0, 12, H);
    // exclamation overlay on every guard (forced from logic above; here we mark them visually)
    for (const g of guards) {
      ctx.save();
      ctx.fillStyle = '#ff3a3a';
      ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 22);
      ctx.restore();
    }
    // BIG flashing ALARM chip top-center
    const pulse = (((performance.now() / 250) | 0) & 1);
    ctx.save();
    ctx.fillStyle = pulse ? '#ff3a3a' : '#1a0d05';
    ctx.fillRect(W / 2 - 110, 36, 220, 30);
    ctx.fillStyle = pulse ? '#1a0d05' : '#ff3a3a';
    ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('* ALARM ' + alarm.T.toFixed(1) + 's *', W / 2, 56);
    ctx.restore();
  }
  ctx.restore();
}

function updateHud() {
  document.getElementById('hud-haul').textContent = '$' + haul;
  document.getElementById('hud-bag').textContent = `${bag}/${maxBag}`;
  document.getElementById('hud-heat').textContent = Math.floor(heat * 100) + '%';
  document.getElementById('hud-shelves').textContent = shelvesKnocked;
  const hud = document.getElementById('hud');
  if (heat > 0.7) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.014);
    hud.style.filter = `drop-shadow(0 0 ${6 + pulse * 8}px rgba(255,58,58,${0.4 + pulse * 0.4}))`;
  } else {
    hud.style.filter = '';
  }
  const best = loadBest('supermarket-pug');
  document.getElementById('hud-best').textContent = best ? '$' + best.haul : '$0';
}

function caught() { shake(8, 0.3); end(false); }
function end(escaped) {
  // Final-only objectives (cash thresholds, no-spot escape) get one last evaluation.
  checkObjectives({ escaped });
  running = false;
  sfx.sweep(escaped ? 880 : 220, escaped ? 1320 : 80, escaped ? 'triangle' : 'sawtooth', 0.5, 0.25);
  document.getElementById('end-title').textContent = escaped ? (alarm.escaped ? 'CLOSE CALL!' : 'CLEAN GETAWAY') : 'CAUGHT';
  document.getElementById('end-sub').textContent = escaped ? (alarm.escaped ? `Escaped the alarm! +50% bonus ($${alarm.bonus})` : 'You made it to the parking lot.') : 'Security got you. The snacks are gone.';
  // Apply alarm bonus to haul before recording
  if (escaped && alarm.escaped) haul += alarm.bonus;
  document.getElementById('end-haul').textContent = '$' + haul;
  document.getElementById('end-shelves').textContent = shelvesKnocked;
  const finalScore = haul + (escaped ? 100 : 0);
  const { isNewBest, current } = submitRun('supermarket-pug', { score: finalScore, haul });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { haul };
    bestEl.innerHTML = `Best: <b>$${b.haul}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // S/A/B/C/D grade card — layered ABOVE the existing end-overlay buttons.
  // Weighted: haul (50%) + escape (30%) + low-heat (20%).
  try {
    const haulPct  = Math.max(0, Math.min(100, (haul / 600) * 100));
    const escapePct = escaped ? 100 : 0;
    const heatPct  = Math.max(0, Math.min(100, (1 - heat) * 100));
    showGradeCard({
      title: escaped ? (alarm.escaped ? 'CLOSE CALL!' : 'CLEAN GETAWAY') : 'CAUGHT',
      subtitle: escaped ? `Final haul: $${haul}` : 'Security took everything.',
      stats: [
        { label: 'Haul',    value: haulPct,   weight: 0.5 },
        { label: 'Escape',  value: escapePct, weight: 0.3 },
        { label: 'Low Heat', value: heatPct,  weight: 0.2 },
      ],
      breakdown: [
        { label: 'Cash haul ($)',    value: haul,            max: 600 },
        { label: 'Shelves knocked',  value: shelvesKnocked,  max: 12 },
        { label: 'Heat',             value: Math.round((1 - heat) * 100), max: 100 },
      ],
      onRestart: () => start(),
    });
  } catch (e) { /* */ }
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
}
let lastT = performance.now();
(function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now; tick(dt); if (running) render();
  requestAnimationFrame(loop);
})(performance.now());

// ===== BLACK MARKET BRIBE UI =====
const BRIBE_CSS = `
.bribe-btn { position: fixed; top: calc(14px + env(safe-area-inset-top, 0)); right: 60px; z-index: 200;
  background: linear-gradient(180deg, #1a0d05, #3a2010); color: var(--neon-yellow);
  border: 3px solid var(--neon-yellow); border-radius: 6px;
  font-family: var(--font-display); font-size: 0.5rem; letter-spacing: 0.08em;
  padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 0 #0a0500;
  -webkit-tap-highlight-color: transparent; }
.bribe-btn:hover { transform: translateY(-1px); }
.bribe-chips { position: fixed; top: 60px; right: 60px; z-index: 50;
  display: flex; gap: 4px; flex-wrap: wrap; max-width: 240px; justify-content: flex-end; pointer-events: none; }
.bribe-chip { background: rgba(255,210,63,0.18); border: 1px solid var(--neon-yellow);
  color: var(--neon-yellow); font-family: var(--font-display); font-size: 0.36rem;
  letter-spacing: 0.05em; padding: 3px 5px; border-radius: 3px;
  text-shadow: 0 0 4px var(--neon-yellow); }
.bribe-modal { position: fixed; inset: 0; z-index: 300; display: none;
  align-items: center; justify-content: center; background: rgba(0,0,0,0.78); padding: 16px; }
.bribe-modal.is-open { display: flex; }
.bribe-modal__panel { background: linear-gradient(180deg, #1a0f2e, #0a0716);
  border: 3px solid var(--neon-yellow); border-radius: 10px; padding: 20px;
  max-width: 440px; width: 100%; box-shadow: 0 0 40px rgba(255,210,63,0.4); }
.bribe-modal__title { font-family: var(--font-display); font-size: 0.8rem;
  letter-spacing: 0.1em; color: var(--neon-yellow); text-align: center; margin: 0 0 6px;
  text-shadow: 0 0 12px var(--neon-yellow); }
.bribe-modal__sub { text-align: center; color: var(--text-soft);
  font-family: var(--font-display); font-size: 0.42rem; margin-bottom: 12px; }
.bribe-modal__money { text-align: center; font-family: var(--font-display);
  font-size: 0.6rem; color: var(--neon-green); margin-bottom: 12px; }
.bribe-row { background: rgba(0,0,0,0.5); border: 2px solid var(--border);
  border-radius: 6px; padding: 10px; margin-bottom: 8px; display: flex;
  gap: 10px; align-items: center; }
.bribe-row.used { border-color: var(--text-soft); opacity: 0.55; }
.bribe-row__icon { font-size: 26px; flex-shrink: 0; }
.bribe-row__body { flex: 1; }
.bribe-row__name { font-family: var(--font-display); font-size: 0.5rem;
  color: var(--neon-cyan); letter-spacing: 0.05em; }
.bribe-row__desc { font-size: 0.42rem; color: var(--text-soft); margin-top: 2px; }
.bribe-row__btn { background: linear-gradient(180deg, var(--neon-yellow), #c89c20);
  color: #1a0d05; border: 2px solid #fff0a0; border-radius: 4px;
  font-family: var(--font-display); font-size: 0.45rem; letter-spacing: 0.05em;
  padding: 6px 8px; cursor: pointer; min-width: 70px;
  box-shadow: 0 3px 0 #6a4a0a; -webkit-tap-highlight-color: transparent; }
.bribe-row__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bribe-row__btn.used { background: var(--text-soft); color: #1a0d05; box-shadow: 0 3px 0 #3a3a4a; }
.bribe-close { background: rgba(0,0,0,0.6); color: var(--text); border: 2px solid var(--border);
  border-radius: 4px; font-family: var(--font-display); font-size: 0.5rem;
  padding: 8px 14px; cursor: pointer; display: block; margin: 14px auto 0; }
`;
const _bribeStyle = document.createElement('style'); _bribeStyle.textContent = BRIBE_CSS;
document.head.appendChild(_bribeStyle);

const _bribeBtn = document.createElement('button');
_bribeBtn.className = 'bribe-btn';
_bribeBtn.id = 'bribe-btn';
_bribeBtn.textContent = '💰 BRIBE $0';
_bribeBtn.style.display = 'none';
document.body.appendChild(_bribeBtn);

const _bribeChips = document.createElement('div');
_bribeChips.className = 'bribe-chips';
_bribeChips.id = 'bribe-chips';
document.body.appendChild(_bribeChips);

const _bribeModal = document.createElement('div');
_bribeModal.className = 'bribe-modal';
_bribeModal.id = 'bribe-modal';
_bribeModal.innerHTML = `
  <div class="bribe-modal__panel">
    <h2 class="bribe-modal__title">★ BLACK MARKET ★</h2>
    <div class="bribe-modal__sub">A shady cashier offers one-time deals.</div>
    <div class="bribe-modal__money">HAUL: $<span id="bribe-money">0</span></div>
    <div id="bribe-list"></div>
    <button class="bribe-close" id="bribe-close">CLOSE</button>
  </div>
`;
document.body.appendChild(_bribeModal);
_bribeBtn.addEventListener('click', () => openBribe());
document.getElementById('bribe-close').addEventListener('click', () => closeBribe());
_bribeModal.addEventListener('click', (e) => { if (e.target === _bribeModal) closeBribe(); });

function openBribe() {
  if (!running) return;
  bribeOpen = true;
  _bribeModal.classList.add('is-open');
  renderBribeList();
}
function closeBribe() {
  bribeOpen = false;
  _bribeModal.classList.remove('is-open');
}
function renderBribeList() {
  document.getElementById('bribe-money').textContent = haul;
  const list = document.getElementById('bribe-list');
  list.innerHTML = '';
  for (const b of BRIBE_DEFS) {
    const used = !!bribesBought[b.id];
    const canBuy = !used && haul >= b.cost;
    const row = document.createElement('div');
    row.className = 'bribe-row' + (used ? ' used' : '');
    row.innerHTML = `
      <div class="bribe-row__icon">${b.icon}</div>
      <div class="bribe-row__body">
        <div class="bribe-row__name">${b.name}</div>
        <div class="bribe-row__desc">${b.desc}</div>
      </div>
      <button class="bribe-row__btn ${used ? 'used' : ''}" ${used || !canBuy ? 'disabled' : ''}>
        ${used ? 'USED' : '$' + b.cost}
      </button>
    `;
    if (!used && canBuy) {
      row.querySelector('button').addEventListener('click', () => buyBribe(b));
    }
    list.appendChild(row);
  }
}
function buyBribe(b) {
  if (bribesBought[b.id] || haul < b.cost) return;
  haul -= b.cost;
  bribesBought[b.id] = true;
  sfx.arp([523, 659, 880], 'triangle', 0.08, 0.22, 0.2);
  // Apply effect
  if (b.id === 'guardBreak') {
    guardFreezeT = 10;
    popup(pug.x, pug.y - 24, '💤 GUARDS NAPPING', '#b0e0ff');
  } else if (b.id === 'cameraBlink') {
    cameraBlinkT = 8;
    heat = 0; // immediate calm
    popup(pug.x, pug.y - 24, '📷 CAMERAS OFF', '#4cc9f0');
  } else if (b.id === 'tipOff') {
    // Find the highest-value untaken item
    let best = null, bestVal = -1;
    for (const it of items) {
      if (it.taken) continue;
      if (it.item.val > bestVal) { bestVal = it.item.val; best = it; }
    }
    highlightedItem = best;
    if (best) popup(best.x, best.y - 16, '⭐ JACKPOT!', '#ffd23f');
  }
  renderBribeList();
  renderBribeChips();
  updateHud();
}
function renderBribeChips() {
  if (!_bribeChips) return;
  _bribeChips.innerHTML = '';
  if (guardFreezeT > 0) {
    const c = document.createElement('div'); c.className = 'bribe-chip';
    c.textContent = '💤 ' + guardFreezeT.toFixed(1) + 's';
    _bribeChips.appendChild(c);
  }
  if (cameraBlinkT > 0) {
    const c = document.createElement('div'); c.className = 'bribe-chip';
    c.textContent = '📷 ' + cameraBlinkT.toFixed(1) + 's';
    _bribeChips.appendChild(c);
  }
  if (highlightedItem && !highlightedItem.taken) {
    const c = document.createElement('div'); c.className = 'bribe-chip';
    c.textContent = '⭐ JACKPOT MARKED';
    _bribeChips.appendChild(c);
  }
}
// Keep bribe button label fresh + chips ticking
function _bribeBtnLoop() {
  if (_bribeBtn) {
    _bribeBtn.style.display = running ? 'block' : 'none';
    _bribeBtn.textContent = `💰 BRIBE $${haul}`;
  }
  if (_bribeChips) _bribeChips.style.display = running ? 'flex' : 'none';
  renderBribeChips();
  requestAnimationFrame(_bribeBtnLoop);
}
_bribeBtnLoop();

window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') {
    if (bribeOpen) closeBribe(); else if (running) openBribe();
  }
});

// ===== OBJECTIVES PANEL (Goose-Game checklist, top-left) =====
const _objCss = `
.mart-objectives { position: fixed; top: 70px; left: 12px; z-index: 60;
  background: rgba(10,7,22,0.78); border: 2px solid rgba(94,243,140,0.45);
  border-radius: 6px; padding: 8px 10px 8px 10px; min-width: 180px; max-width: 240px;
  font-family: var(--font-display); font-size: 0.42rem; letter-spacing: 0.04em;
  box-shadow: 0 4px 0 rgba(0,0,0,0.4); pointer-events: none; }
.mart-objectives__title { color: var(--neon-yellow); font-size: 0.5rem;
  text-shadow: 0 0 6px var(--neon-yellow); margin-bottom: 6px; }
.mart-objectives__row { display: flex; gap: 6px; align-items: center;
  padding: 2px 0; color: var(--text); }
.mart-objectives__row.done { color: var(--neon-green); text-decoration: line-through;
  text-shadow: 0 0 4px var(--neon-green); }
.mart-objectives__box { width: 10px; height: 10px; border: 1px solid currentColor;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 9px; line-height: 9px; flex-shrink: 0; }
`;
const _objStyle = document.createElement('style'); _objStyle.textContent = _objCss;
document.head.appendChild(_objStyle);
const _objPanel = document.createElement('div');
_objPanel.className = 'mart-objectives';
_objPanel.id = 'mart-objectives';
_objPanel.style.display = 'none';
document.body.appendChild(_objPanel);
function renderObjectivesPanel() {
  if (!_objPanel) return;
  if (!objectives || objectives.length === 0) { _objPanel.style.display = 'none'; return; }
  _objPanel.style.display = 'block';
  let html = '<div class="mart-objectives__title">TODAY\'S MISSION</div>';
  for (const o of objectives) {
    html += `<div class="mart-objectives__row${o.done ? ' done' : ''}">`
      + `<span class="mart-objectives__box">${o.done ? '✓' : ''}</span>`
      + `<span>${o.label}</span></div>`;
  }
  _objPanel.innerHTML = html;
}
// Hide objectives panel when run ends (visible only while in-game)
const _objVisLoop = () => {
  if (_objPanel) _objPanel.style.display = (running && objectives && objectives.length) ? 'block' : 'none';
  requestAnimationFrame(_objVisLoop);
};
_objVisLoop();

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD move · E grab · SPACE ram · C cart · 💰 BRIBE top-right (B) · EXIT bottom-right', 7000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
