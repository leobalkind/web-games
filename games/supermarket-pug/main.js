// SUPERMARKET PUG — top-down chaos heist.
// Walk a supermarket. Grab items (E or button). Knock shelves (SPACE).
// Shopping cart = speed boost but louder. Guards chase based on heat.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showOrientationHint } from '../../src/shared/orientationHint.js';
import { showGradeCard } from '../../src/shared/gradeCard.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';
import { drawShadow as _depthShadow } from '../../src/shared/depth3D.js';

// Pug shopper disguise per map: corner=cap+coat, super=scarf+shades, warehouse=biz shirt.
function _shopperDisguiseForMap(mapId) {
  if (mapId === 'cornerStore') return { body: '#c8854a', mask: '#1a0d05' };
  if (mapId === 'supermarket') return { body: '#a88858', mask: '#2a1a10' };
  if (mapId === 'warehouse')   return { body: '#b89058', mask: '#1c0d04' };
  return { body: '#c8854a', mask: '#1a0d05' };
}

function _drawShopperAccessory(ctx, x, y, mapId, size) {
  const s = size / 36;
  ctx.save();
  if (mapId === 'cornerStore') {
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x - 7 * s, y - 13 * s, 14 * s, 3 * s);
    ctx.fillStyle = '#5a5a6a'; ctx.fillRect(x - 7 * s, y - 12 * s, 14 * s, 1 * s);
    ctx.fillStyle = '#3a5a78'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 4 * s);
    ctx.fillStyle = '#5a7a98'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 1 * s);
  } else if (mapId === 'supermarket') {
    ctx.fillStyle = '#0a0a10'; ctx.fillRect(x - 6 * s, y - 4 * s, 12 * s, 2 * s);
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(x - 6 * s, y - 3 * s, 5 * s, 2 * s); ctx.fillRect(x + 1 * s, y - 3 * s, 5 * s, 2 * s);
    ctx.fillStyle = '#a02828'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 3 * s);
    ctx.fillStyle = '#c83838'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 1 * s);
    ctx.fillStyle = '#a02828'; ctx.fillRect(x + 4 * s, y + 10 * s, 3 * s, 4 * s);
  } else if (mapId === 'warehouse') {
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 5 * s);
    ctx.fillStyle = '#cacacf'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 1 * s);
    ctx.fillStyle = '#2a3a78'; ctx.fillRect(x - 1 * s, y + 7 * s, 2 * s, 6 * s);
    ctx.fillStyle = '#5a7ab0'; ctx.fillRect(x - 1 * s, y + 7 * s, 2 * s, 1 * s);
  }
  ctx.restore();
}

// Guard uniforms keyed by guard.kind.
function _guardUniform(kind, frozen) {
  if (frozen) return { body: '#8a8aac', mask: '#3a3a52', hatColor: '#5a5a7a' };
  if (kind === 'walker')  return { body: '#5ea0c8', mask: '#1a3a55', hatColor: '#0a1a2a' };
  if (kind === 'patrol')  return { body: '#4cc9f0', mask: '#1a2a55', hatColor: '#082040' };
  if (kind === 'chaser')  return { body: '#ff5a5a', mask: '#3a0808', hatColor: '#1a0202' };
  if (kind === 'manager') return { body: '#ffd23f', mask: '#5a3808', hatColor: '#3a2806' };
  return { body: '#4cc9f0', mask: '#1a3a55', hatColor: '#0a1a2a' };
}

function _drawGuardAccessory(ctx, x, y, kind, size) {
  const s = size / 36;
  ctx.save();
  if (kind === 'walker') {
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 5 * s, y + 6 * s, 3 * s, 4 * s);
    ctx.fillStyle = '#7a5a08'; ctx.fillRect(x - 5 * s, y + 6 * s, 3 * s, 1 * s);
  } else if (kind === 'patrol') {
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x + 5 * s, y + 4 * s, 3 * s, 6 * s);
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x + 5 * s, y + 4 * s, 3 * s, 1 * s);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + 6 * s, y + 5 * s, 1 * s, 1 * s);
    ctx.fillStyle = '#cacacf'; ctx.fillRect(x + 7 * s, y + 1 * s, 1 * s, 4 * s);
  } else if (kind === 'chaser') {
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x + 7 * s, y - 1 * s, 5 * s, 1 * s); ctx.fillRect(x + 7 * s, y, 5 * s, 1 * s);
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x + 7 * s, y - 1 * s, 1 * s, 2 * s);
    ctx.fillStyle = '#000'; ctx.fillRect(x + 6 * s, y + 1 * s, 3 * s, 3 * s);
  } else if (kind === 'manager') {
    ctx.fillStyle = '#a87a4a'; ctx.fillRect(x - 9 * s, y + 1 * s, 5 * s, 7 * s);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 8 * s, y + 2 * s, 3 * s, 5 * s);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 7 * s, y + 3 * s, 1 * s, 1 * s); ctx.fillRect(x - 7 * s, y + 5 * s, 2 * s, 1 * s);
    ctx.fillStyle = '#a02838'; ctx.fillRect(x - 4 * s, y + 8 * s, 8 * s, 3 * s);
    ctx.fillStyle = '#7a1818'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 3 * s);
  }
  ctx.restore();
}

// 5 civilian types (kid/elder/biz/tourist/parent) — distinct sizes + accessories.
function _civSizeForType(type) {
  if (type === 'kid') return 16;
  if (type === 'elder') return 20;
  if (type === 'biz' || type === 'parent') return 24;
  return 22;
}
function _drawCivilianAccessory(ctx, x, y, type, size) {
  const s = size / 36;
  ctx.save();
  if (type === 'kid') {
    ctx.fillStyle = '#a06030'; ctx.fillRect(x + 6 * s, y - 18 * s, 1 * s, 14 * s);
    ctx.fillStyle = '#ff3aa1'; ctx.beginPath(); ctx.arc(x + 6 * s, y - 22 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff80c0'; ctx.beginPath(); ctx.arc(x + 5 * s, y - 23 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'elder') {
    ctx.fillStyle = '#5a5a6a'; ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 4 * s);
    ctx.fillStyle = '#8a8aac'; ctx.fillRect(x - 7 * s, y - 13 * s, 14 * s, 1 * s);
    ctx.fillStyle = '#a87a4a'; ctx.fillRect(x + 7 * s, y - 1 * s, 1 * s, 12 * s); ctx.fillRect(x + 6 * s, y + 10 * s, 3 * s, 1 * s);
  } else if (type === 'biz') {
    ctx.fillStyle = '#3a2810'; ctx.fillRect(x + 7 * s, y + 4 * s, 4 * s, 5 * s);
    ctx.fillStyle = '#5a3018'; ctx.fillRect(x + 7 * s, y + 4 * s, 4 * s, 1 * s);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 8 * s, y + 6 * s, 2 * s, 1 * s);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 1 * s, y + 7 * s, 2 * s, 6 * s);
  } else if (type === 'tourist') {
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 9 * s, y - 11 * s, 18 * s, 1 * s);
    ctx.fillStyle = '#ffce5e'; ctx.fillRect(x - 6 * s, y - 14 * s, 12 * s, 3 * s);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 3 * s, y + 4 * s, 6 * s, 4 * s);
    ctx.fillStyle = '#4cc9f0'; ctx.fillRect(x - 1 * s, y + 5 * s, 2 * s, 2 * s);
    ctx.fillStyle = '#5a3010'; ctx.fillRect(x - 5 * s, y - 1 * s, 1 * s, 6 * s); ctx.fillRect(x + 4 * s, y - 1 * s, 1 * s, 6 * s);
  } else if (type === 'parent') {
    ctx.fillStyle = '#a02838'; ctx.fillRect(x - 11 * s, y + 4 * s, 4 * s, 5 * s);
    ctx.fillStyle = '#c83a4a'; ctx.fillRect(x - 11 * s, y + 4 * s, 4 * s, 1 * s);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 10 * s, y + 6 * s, 2 * s, 1 * s);
    ctx.fillStyle = '#f8d8b8'; ctx.beginPath(); ctx.arc(x + 8 * s, y + 6 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillRect(x + 7 * s, y + 5 * s, 1 * s, 1 * s); ctx.fillRect(x + 9 * s, y + 5 * s, 1 * s, 1 * s);
  }
  ctx.restore();
}

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
// Tense pulse — alarms ramp intensity to max.
const music = createMusicTrack({ mood: 'tense', tempo: 120, key: 'D', scale: 'minor' });
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

// Generic ITEMS fallback. SECTION_ITEMS below = per-section products.
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
// SECTION-specific item rosters (30+ across all sections).
const SECTION_ITEMS = {
  produce: [
    { name: 'apple',    val: 12, color: '#ff5a3a', shape: 'round', fragile: true },
    { name: 'orange',   val: 10, color: '#ff8e3c', shape: 'round', fragile: true },
    { name: 'banana',   val: 8,  color: '#ffd23f', shape: 'curve', fragile: true },
    { name: 'lettuce',  val: 7,  color: '#5ef38c', shape: 'round' },
    { name: 'carrot',   val: 9,  color: '#ff8e3c', shape: 'cone' },
    { name: 'tomato',   val: 11, color: '#ff3a3a', shape: 'round', fragile: true },
    { name: 'grape',    val: 14, color: '#b055ff', shape: 'cluster' },
  ],
  frozen: [
    { name: 'icecream', val: 22, color: '#ffe0e8', shape: 'cone' },
    { name: 'frozenPizza',val: 35, color: '#ff8e3c', shape: 'box' },
    { name: 'peas',     val: 12, color: '#5ef38c', shape: 'box' },
    { name: 'frozenFish',val: 38, color: '#8aa8d8', shape: 'fish' },
    { name: 'icecake',  val: 30, color: '#fff', shape: 'box' },
  ],
  electronics: [
    { name: 'phone',    val: 85, color: '#1a1a22', shape: 'box', expensive: true },
    { name: 'headphones',val: 75, color: '#4cc9f0', shape: 'round', expensive: true },
    { name: 'tablet',   val: 120,color: '#3a3a4a', shape: 'box', expensive: true },
    { name: 'watch',    val: 95, color: '#ffd23f', shape: 'round', expensive: true },
  ],
  deli: [
    { name: 'salami',   val: 24, color: '#a04030', shape: 'tube', smelly: true },
    { name: 'cheeseWheel',val: 30,color: '#ffce5e', shape: 'round', smelly: true },
    { name: 'sausage',  val: 22, color: '#a06030', shape: 'tube', smelly: true },
    { name: 'oliveJar', val: 18, color: '#5a8a3a', shape: 'jar' },
    { name: 'pickle',   val: 14, color: '#5ef38c', shape: 'tube', smelly: true },
  ],
  clearance: [
    { name: 'oldBread', val: 4,  color: '#a87a4a', shape: 'box' },
    { name: 'dentedCan',val: 6,  color: '#8a8aac', shape: 'box' },
    { name: 'discBox',  val: 16, color: '#ff3aa1', shape: 'box', trap: true },
    { name: 'lastSeason',val: 8, color: '#5ea0c8', shape: 'box' },
  ],
  // BAKERY — high-value warm bread. Smell attracts the cleaner-bot (handled
  // in tick() via section check). Massive payouts justify the danger.
  bakery: [
    { name: 'croissant', val: 32, color: '#d8a06a', shape: 'curve', warm: true },
    { name: 'hotLoaf',   val: 48, color: '#a87a4a', shape: 'box',   warm: true },
    { name: 'cake',      val: 65, color: '#ffe0e8', shape: 'box',   warm: true },
    { name: 'pretzel',   val: 28, color: '#a06030', shape: 'cluster', warm: true },
  ],
};
const SECTION_ORDER = ['produce', 'frozen', 'electronics', 'deli', 'clearance', 'bakery'];
const SECTION_TINT = {
  produce:    'rgba(94,243,140,0.10)',
  frozen:     'rgba(76,201,240,0.18)',
  electronics:'rgba(176,85,255,0.10)',
  deli:       'rgba(255,142,60,0.10)',
  clearance:  'rgba(255,210,63,0.10)',
  bakery:     'rgba(255,180,100,0.16)',
};
// SECTION_LIGHT — per-section atmospheric tint applied as an overlay band.
// produce=warm sun, frozen=blue cold, electronics=sterile white, deli=warm
// yellow, clearance=flickering yellow/dim, bakery=warm orange glow.
const SECTION_LIGHT = {
  produce:    { color: 'rgba(255,220,140,0.18)', flicker: false },
  frozen:     { color: 'rgba(120,200,255,0.20)', flicker: false },
  electronics:{ color: 'rgba(240,245,255,0.12)', flicker: false },
  deli:       { color: 'rgba(255,210,80,0.16)',  flicker: false },
  clearance:  { color: 'rgba(255,210,63,0.18)',  flicker: true },
  bakery:     { color: 'rgba(255,160,80,0.22)',  flicker: false },
};
// Per-map config — chosen on the start overlay; persisted as runMeta.lastMap.
const MAPS = [
  { id: 'cornerStore', label: 'CORNER STORE',  rows: 3, cols: 4, goalHaul: 200 },
  { id: 'supermarket', label: 'SUPERMARKET',   rows: 4, cols: 5, goalHaul: 400 },
  { id: 'warehouse',   label: 'WAREHOUSE',     rows: 5, cols: 6, goalHaul: 700 },
];
// 10 different shoplist combinations — pick one at start for variety/replay.
const SHOPLISTS = [
  { id: 'meat',   labels: ['Grab 2 DELI items',      'Hit $80+',          'Escape clean'] },
  { id: 'tech',   labels: ['Snag 1 ELECTRONICS',     'Knock 3 shelves',   'Escape $150+'] },
  { id: 'fresh',  labels: ['Grab 3 PRODUCE',         'Bag full',          'No bribes'] },
  { id: 'sweet',  labels: ['Grab 1 FROZEN',          'Hit $100',          'Knock 2 shelves'] },
  { id: 'bargain',labels: ['Grab 2 CLEARANCE',       'Avoid the trap',    'Escape $50+'] },
  { id: 'chaos',  labels: ['Knock 5 shelves',        'Steal 5 items',     'Survive alarm'] },
  { id: 'stealth',labels: ['Never alert a guard',    'Escape with $60',   'Skip electronics'] },
  { id: 'gourmet',labels: ['Grab 1 DELI + PRODUCE',  'Hit $90',           'Bag full'] },
  { id: 'spree',  labels: ['Steal 7 items',          'Escape $120+',      'No frozen'] },
  { id: 'jackpot',labels: ['Grab 1 ELECTRONICS',     'Hit $200+',         'Knock 1 shelf'] },
];
const RUN_KEY = 'supermarket-pug:meta';
let runMeta = (() => {
  try { return JSON.parse(localStorage.getItem(RUN_KEY) || '{}'); } catch { return {}; }
})();
function _saveMeta() { try { localStorage.setItem(RUN_KEY, JSON.stringify(runMeta)); } catch {} }
let currentMapIdx = Math.min(MAPS.length - 1, runMeta.lastMap || 0);

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
  { id: 'alarmJam',    cost: 150, name: 'ALARM JAMMER', icon: '📡', desc: '8s alarm immunity — alarm cannot trigger' },
];
let bribesBought = {};   // id -> true when used (one-time-per-run)
let bribeOpen = false;
let guardFreezeT = 0;    // seconds remaining
let cameraBlinkT = 0;    // seconds remaining
let alarmJamT = 0;       // seconds remaining of alarm-trigger immunity
let highlightedItem = null; // tip-off target ref
// END-OF-RUN BADGES — earned by completing meta achievements during a run.
// Stored as a Set in localStorage (across all runs).
const BADGE_DEFS = [
  { id: 'PERFECT_HEIST',     label: 'PERFECT HEIST',     desc: 'Escape without being spotted' },
  { id: 'SECTION_MASTER_X5', label: 'SECTION MASTER ×5', desc: 'Loot from 5 different sections' },
  { id: 'DOMINO_FALL',       label: 'DOMINO FALL',       desc: 'Chain 4+ shelves in one ram' },
  { id: 'BIG_SCORE',         label: 'BIG SCORE',         desc: 'Escape with $300+' },
  { id: 'CART_DEMON',        label: 'CART DEMON',        desc: 'Knock 8+ shelves while in cart' },
  { id: 'BAKERY_THIEF',      label: 'BAKERY THIEF',      desc: 'Steal 3+ bakery items' },
  { id: 'ALARM_ESCAPE',      label: 'ALARM ESCAPE',      desc: 'Escape during active alarm' },
  { id: 'NO_BRIBE',          label: 'NO BRIBES',         desc: 'Escape without using a bribe' },
];
const BADGE_KEY = 'supermarket-pug:badges';
let savedBadges = (() => {
  try { return new Set(JSON.parse(localStorage.getItem(BADGE_KEY) || '[]')); }
  catch { return new Set(); }
})();
let runBadges = new Set();        // badges earned THIS run (shown on grade card)
let chainBestThisRun = 0;          // best chain depth seen this run
let cartShelvesThisRun = 0;        // shelves knocked while in cart
let bakeryStolenThisRun = 0;       // bakery items stolen
let sectionsLootedThisRun = new Set(); // sections we grabbed from
let bribeUsedThisRun = false;      // any bribe purchased
let shakeT = 0, shakeAmp = 0;
// Brief red flash overlay when a guard freshly spots you.
let spotFlashT = 0;
// New map decor + alarm mechanic
let saleSigns = [];     // {x, y, text, color, phase}
let priceFlags = [];    // {x, y, color, phase}
let frozenAisleY = 0;   // y-center of the frozen aisle (one of the aisles)
let frozenAisleH = 0;   // height of slow zone
let cleanerBot = null;  // {x, y, ang, speed, brushPhase}
let counter = null;     // {x, y, w, h}
let alarm = { on: false, T: 0, escaped: false, bonus: 0 };
let breathPuffs = [];   // {x, y, vy, life, max}
// Wave 1B map upgrades
let sections = {};      // section id -> {rect: {x,y,w,h}, id}
let customers = [];     // [{x,y,vx,vy,t,witness,witnessCd,color}]
let secOffice = null;   // {x,y,w,h} — guards "dispatch" from here if heat>0.7
let activeShoplist = null; // current shoplist {id, labels}
let lastGrabT = 0;      // timestamp of last small-grab — used for combo window
let comboChain = 0;     // consecutive small-grab counter for SHOPLIFTER bonus
let openBoxFired = false; // CLEARANCE trap state per-run
let currentMap = MAPS[currentMapIdx]; // active map config
let wantedLvl = runMeta.wanted || 1;  // grows with each successful escape
let miniMapOn = true;                 // M toggles HUD radar
function shake(amp, dur) { const k = _shakeMul(); shakeAmp = Math.max(shakeAmp, amp * k); shakeT = Math.max(shakeT, dur); }
function popup(x, y, text, color) {
  if (!popups) return;
  if (popups.length > 24) popups.shift();
  // Random angle + small horizontal velocity so stacked popups don't overlap.
  const a = (Math.random() - 0.5) * 0.7;
  popups.push({
    x: x + Math.cos(a) * 6,
    y: y + (Math.random() - 0.5) * 4,
    vx: Math.sin(a) * 22,
    vy: -36,
    text, color: color || '#5ef38c', life: 0.9, t: 0,
  });
}
function reset() {
  pug = { x: W / 2, y: H - 80, vx: 0, vy: 0, ang: 0 };
  inCart = false;
  // EXIT zone moved to bottom-right (next to the checkout counter)
  shelves = []; items = []; guards = []; exitZ = { x: W - 70, y: H - 50, r: 32 };
  popups = []; aisles = []; lights = []; cameras = []; decorCarts = []; pallets = [];
  saleSigns = []; priceFlags = []; breathPuffs = [];
  cleanerBot = null; counter = null;
  alarm = { on: false, T: 0, escaped: false, bonus: 0, timeoutFired: false };
  shakeT = 0; shakeAmp = 0; spotFlashT = 0;
  haul = 0; bag = 0; maxBag = 8; heat = 0; shelvesKnocked = 0;
  // Reset Wave-1B state
  sections = {}; customers = []; secOffice = null;
  lastGrabT = 0; comboChain = 0; openBoxFired = false;
  currentMap = MAPS[currentMapIdx] || MAPS[0];
  // Pick a shoplist for variety
  activeShoplist = SHOPLISTS[Math.floor(Math.random() * SHOPLISTS.length)];
  // Generate shelf grid — uses currentMap dims; 1.5x growth on supermarket
  const rows = currentMap.rows, cols = currentMap.cols;
  // Bag scales with map difficulty.
  maxBag = currentMap.id === 'warehouse' ? 12 : (currentMap.id === 'supermarket' ? 10 : 8);
  const cellW = Math.min(110, Math.max(80, (W - 80) / cols));
  const sw = Math.min(80, cellW - 30), sh = 22, gx = (W - cols * cellW) / 2, gy = 90;
  sceneRows = rows; sceneCols = cols; sceneGx = gx; sceneGy = gy;
  // Assign sections by row (each row = one section, cycle the list).
  for (let r = 0; r < rows; r++) {
    const secId = SECTION_ORDER[r % SECTION_ORDER.length];
    sections[r] = secId;
    aisles.push({ x: gx, y: gy + r * 100 + sh + 30, w: cols * cellW, n: r + 1, sec: secId });
    for (let c = 0; c < cols; c++) {
      const sh1 = { x: gx + c * cellW + 20, y: gy + r * 100, w: sw, h: sh, hp: 2, seed: (r * 13 + c * 7) | 0, sec: secId };
      shelves.push(sh1);
      // Use section-specific items where available; fall back to generic ITEMS.
      const pool = SECTION_ITEMS[secId] || ITEMS;
      for (let i = 0; i < 3; i++) {
        const sec = pool[Math.floor(Math.random() * pool.length)];
        const it = sec.drawIconFn ? sec : {
          name: sec.name, val: sec.val, color: sec.color, shape: sec.shape,
          fragile: sec.fragile, smelly: sec.smelly, expensive: sec.expensive, trap: sec.trap,
        };
        items.push({ x: sh1.x + 12 + i * 22, y: sh1.y - 4, item: it, on: sh1, taken: false, sec: secId });
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
  // Guards — 4 kinds: walker/patrol/chaser (alerts others)/manager (instant game-over on touch).
  const guardTypeCount = currentMap.id === 'warehouse' ? 4 : (currentMap.id === 'supermarket' ? 3 : 2);
  const guardKinds = ['walker', 'patrol', 'chaser', 'manager'];
  for (let i = 0; i < guardTypeCount; i++) {
    const kind = guardKinds[i % guardKinds.length];
    const speed = { walker: 90, patrol: 110, chaser: 170, manager: 80 }[kind];
    const x = 60 + (i % 2) * (W - 120);
    const y = 60 + Math.floor(i / 2) * (H - 200);
    guards.push({
      x, y, vx: 0, vy: 0, ang: Math.random() * Math.PI * 2,
      alertT: 0, target: null, kind, speed,
      patrol: [
        { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 },
        { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 },
      ],
      patrolIdx: 0,
    });
  }
  // SECURITY OFFICE — windowed room top-left with two monitors.
  secOffice = { x: 16, y: 24, w: 96, h: 56 };
  // CUSTOMERS — wander; witnessing theft = +30% heat.
  const customerCount = currentMap.id === 'warehouse' ? 5 : (currentMap.id === 'supermarket' ? 3 : 2);
  for (let i = 0; i < customerCount; i++) {
    const colors = ['#ff8e3c', '#5ea0c8', '#b055ff', '#5ef38c', '#ff3aa1'];
    customers.push({
      x: 100 + Math.random() * (W - 200), y: 120 + Math.random() * (H - 240),
      vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
      t: 0, witness: false, witnessCd: 0, color: colors[i % colors.length],
      pauseT: Math.random() * 2,
    });
  }
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
  alarmJamT = 0;
  highlightedItem = null;
  // Reset per-run badge tracking
  runBadges = new Set();
  chainBestThisRun = 0;
  cartShelvesThisRun = 0;
  bakeryStolenThisRun = 0;
  sectionsLootedThisRun = new Set();
  bribeUsedThisRun = false;
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
  if (e.repeat) return;
  if (e.key === 'e' || e.key === 'E') grabNear();
  if (e.key === ' ' || e.code === 'Space') ram();
  if (e.key === 'c' || e.key === 'C') toggleCart();
  if (e.key === 'm' || e.key === 'M') miniMapOn = !miniMapOn;
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
document.getElementById('cart-btn').addEventListener('click', toggleCart);
// The legacy floating cart-btn (right:20px;bottom:140px) overlapped with the
// universal mobile CART button on touch. The mobileControls overlay now owns
// the touch UI, so hide the legacy duplicate everywhere.
document.getElementById('cart-btn').style.display = 'none';
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
// Top-down sprawling supermarket — landscape gives you peripheral view of guards.
showOrientationHint({ gameId: 'supermarket-pug' });
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
        let val = it.item.val;
        // CLEARANCE trap — OPEN BOX drops loot loudly + +heat penalty
        if (it.item.trap && !openBoxFired) {
          openBoxFired = true;
          heat = Math.min(1, heat + 0.45);
          shake(8, 0.3);
          sfx.tone(140, 'sawtooth', 0.18, 0.3);
          popup(it.x, it.y - 18, 'OPEN BOX! +HEAT', '#ff3a3a');
        }
        // ELECTRONICS heavily watched: +heat per grab (bumped 0.18→0.22 to
        // match the "high-risk/high-reward" pitch)
        if (it.item.expensive) heat = Math.min(1, heat + 0.22);
        // BAKERY warm-bread smell attracts the cleaner-bot. Pull it toward
        // the player for ~3s by overriding its target angle.
        if (it.item.warm && cleanerBot) {
          cleanerBot._lure = { x: pug.x, y: pug.y, t: 3.0 };
          popup(it.x, it.y - 14, '~SMELLS GOOD~', '#ff8e3c');
        }
        // Track per-run badge state
        if (it.sec) sectionsLootedThisRun.add(it.sec);
        if (it.sec === 'bakery') bakeryStolenThisRun++;
        // SHOPLIFTER combo — 5 small items (<25 val) within 1.5s window each
        const now = performance.now();
        if (it.item.val < 25 && now - lastGrabT < 1500) comboChain++;
        else comboChain = 1;
        lastGrabT = now;
        if (comboChain >= 5) {
          val = Math.round(val * 1.25);
          popup(pug.x, pug.y - 22, 'SHOPLIFTER +25%', '#ffd23f');
          sfx.arp([880, 1320, 1760], 'triangle', 0.05, 0.18, 0.18);
          comboChain = 0;
        }
        haul += val;
        popup(it.x, it.y - 10, '+$' + val, it.item.expensive ? '#b055ff' : '#5ef38c');
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
  if (inCart) cartShelvesThisRun++;
  if (chainDepth + 1 > chainBestThisRun) chainBestThisRun = chainDepth + 1;
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
        if (inCart) cartShelvesThisRun++;
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
  if (!running) return;
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
  // Acceleration ramp from rest — smooth lerp to target velocity gives the cart
  // (and pug) a sense of weight instead of snapping to top speed instantly.
  let tvx = 0, tvy = 0;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    tvx = (mx / l) * speed;
    tvy = (my / l) * speed;
    // CART WOBBLE/LEAN — track angle delta. Sharp turns (Δang > ~40°)
    // induce a wobble that rocks the cart sideways for ~0.4s.
    if (inCart && pug.ang != null) {
      const newAng = Math.atan2(my, mx);
      let dAng = newAng - pug.ang;
      while (dAng > Math.PI) dAng -= Math.PI * 2;
      while (dAng < -Math.PI) dAng += Math.PI * 2;
      if (Math.abs(dAng) > 0.7) {
        pug.cartWobbleT = 0.4;
        pug.cartWobbleDir = Math.sign(dAng);
      }
    }
    pug.ang = Math.atan2(my, mx);
    if (inCart) heat = Math.min(1, heat + dt * 0.04);
  }
  if (pug.cartWobbleT > 0) pug.cartWobbleT = Math.max(0, pug.cartWobbleT - dt);
  // Cart is heavier (slower ramp); on-foot is snappier.
  const accel = inCart ? 5 : 8;
  const blend = Math.min(1, accel * dt);
  pug.vx += (tvx - pug.vx) * blend;
  pug.vy += (tvy - pug.vy) * blend;
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
  // Mild friction when no input — lerp already targets 0 toward rest, but a
  // small extra damping keeps the cart from sliding forever on diagonals.
  if (!mx && !my) { pug.vx *= Math.pow(0.5, dt * 4); pug.vy *= Math.pow(0.5, dt * 4); }
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
      // Normal push-out + jiggle. Pug "shakes" on impact (jiggleT drives
      // sprite tilt in render), small audio click for tactile feedback.
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const dx = pug.x - cx, dy = pug.y - cy;
      if (Math.abs(dx) > Math.abs(dy)) pug.x = dx > 0 ? s.x + s.w + 14 : s.x - 14;
      else pug.y = dy > 0 ? s.y + s.h + 14 : s.y - 14;
      pug.vx *= 0.5; pug.vy *= 0.5;
      // Jiggle (cart bump feel) only on meaningful collisions.
      if (pugSpeed > 80) {
        pug.jiggleT = 0.22;
        pug.jiggleDir = Math.atan2(dy, dx);
        if (inCart && !pug._lastBumpT || (pug._lastBumpT && performance.now() - pug._lastBumpT > 200)) {
          sfx.tone(180, 'square', 0.04, 0.12);
          pug._lastBumpT = performance.now();
        }
      }
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
  // ALARM trigger — once heat goes above 0.95, alarm latches on.
  // Stronger event: sub-bass thud + bigger shake + brief hit-pause spike.
  // ALARM JAMMER bribe (alarmJamT) blocks the trigger entirely.
  if (!alarm.on && heat >= 0.95 && alarmJamT <= 0) {
    alarm.on = true;
    alarm.T = 8;
    sfx.sweep(800, 200, 'square', 0.5, 0.3);
    sfx.tone(55, 'sine', 0.4, 0.55); // sub-bass alarm thud
    shake(14, 0.55);
    spotFlashT = 0.5;
  }
  if (alarmJamT > 0) alarmJamT -= dt;
  // Heat decays slowly UNLESS alarm is on
  if (!alarm.on) heat = Math.max(0, heat - dt * 0.07);
  else { heat = 1; alarm.T -= dt; if (alarm.T <= 0) alarm.T = 0; }
  // Cleaner robot — patrols an elliptical loop; sees player at close range -> heat spike
  if (cleanerBot) {
    if (cleanerBot._lure && cleanerBot._lure.t > 0) {
      // Lured by bakery smell: roll directly toward the lure point.
      cleanerBot._lure.t -= dt;
      const lx = cleanerBot._lure.x, ly = cleanerBot._lure.y;
      const dx = lx - cleanerBot.x, dy = ly - cleanerBot.y, dd = Math.hypot(dx, dy);
      if (dd > 2) {
        cleanerBot.x += (dx / dd) * 90 * dt;
        cleanerBot.y += (dy / dd) * 90 * dt;
      }
      if (cleanerBot._lure.t <= 0) {
        // Re-attach to the orbit by snapping the ang to the current position
        cleanerBot.ang = Math.atan2(cleanerBot.y - cleanerBot.cy, cleanerBot.x - cleanerBot.cx);
        cleanerBot._lure = null;
      }
    } else {
      cleanerBot.ang += dt * 0.6;
      cleanerBot.x = cleanerBot.cx + Math.cos(cleanerBot.ang) * cleanerBot.rx;
      cleanerBot.y = cleanerBot.cy + Math.sin(cleanerBot.ang) * cleanerBot.ry;
    }
    cleanerBot.brushPhase += dt * 12;
    const d = Math.hypot(pug.x - cleanerBot.x, pug.y - cleanerBot.y);
    // CAMERA BLINK suppresses cleaner-bot spotting
    if (d < 38 && cameraBlinkT <= 0) {
      heat = Math.min(1, heat + 0.6 * dt);
      // brief popup, throttled
      if (Math.random() < dt * 1.5) popup(cleanerBot.x, cleanerBot.y - 14, 'SPOTTED!', '#ff3a3a');
    }
  }
  // CUSTOMERS — wander; spot pug stealing within 90px = +heat 30%
  for (const c of customers) {
    c.t += dt;
    c.witnessCd = Math.max(0, c.witnessCd - dt);
    c.pauseT -= dt;
    if (c.pauseT <= 0) {
      const a = Math.random() * Math.PI * 2;
      c.vx = Math.cos(a) * 30; c.vy = Math.sin(a) * 30;
      c.pauseT = 1.5 + Math.random() * 2;
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.x = Math.max(50, Math.min(W - 50, c.x));
    c.y = Math.max(100, Math.min(H - 100, c.y));
    // Witness check — proximity + just-stole gate (lastGrabT recent + cooldown)
    if (c.witnessCd <= 0 && bag > 0 && performance.now() - lastGrabT < 800) {
      const d = Math.hypot(c.x - pug.x, c.y - pug.y);
      if (d < 90 && cameraBlinkT <= 0) {
        c.witnessCd = 4;
        heat = Math.min(1, heat + 0.3);
        popup(c.x, c.y - 18, 'WITNESS!', '#ff3a3a');
        sfx.tone(330, 'square', 0.06, 0.16);
        everSpotted = true;
      }
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
    // CHASER sees from further. MANAGER tighter cone.
    const sightRange = g.kind === 'chaser' ? 240 : (g.kind === 'manager' ? 180 : 200);
    const sightFov = g.kind === 'manager' ? 0.4 : 0.5;
    const sees = d < sightRange && Math.abs(diff) < sightFov;
    // CAMERA BLINK suppresses sight-based heat gain too
    if (sees) {
      // Rising-edge: guard newly spots player → bark + speech bubble (1.2s) +
      // red flash + audio sting + screen shake. Makes the moment a real EVENT.
      if ((g.alertT || 0) <= 0 && cameraBlinkT <= 0) {
        const line = BARK_LINES[Math.floor(Math.random() * BARK_LINES.length)];
        g.bark = { text: line, t: 0, life: 1.2 };
        // 2-note alarm sting (high stab + low bass).
        sfx.tone(880, 'square', 0.06, 0.18);
        sfx.tone(220, 'sawtooth', 0.18, 0.22);
        spotFlashT = 0.32;
        shake(4, 0.18);
        everSpotted = true;
      }
      g.alertT = 3;
      if (cameraBlinkT <= 0) heat = Math.min(1, heat + 0.4 * dt);
    }
    if (heat > 0.7) g.alertT = Math.max(g.alertT || 0, 1.5);
    if (alarm.on) g.alertT = 5; // always know
    // Rising-edge: newly-alerted CHASER bumps every guard to alert too.
    if (sees && (g.alertT || 0) <= 0 && cameraBlinkT <= 0 && g.kind === 'chaser') {
      for (const og of guards) if (og !== g) og.alertT = Math.max(og.alertT || 0, 2.5);
    }
    if (g.alertT > 0) {
      g.alertT -= dt;
      g.ang = ang;
      const gs = (alarm.on ? g.speed * 1.5 : g.speed);
      g.x += (dx / d) * gs * dt; g.y += (dy / d) * gs * dt;
    } else if (g.kind === 'patrol' && g.patrol) {
      const t = g.patrol[g.patrolIdx];
      const pdx = t.x - g.x, pdy = t.y - g.y, pd = Math.hypot(pdx, pdy);
      if (pd < 20) g.patrolIdx = (g.patrolIdx + 1) % g.patrol.length;
      else {
        g.ang = Math.atan2(pdy, pdx);
        g.x += (pdx / pd) * g.speed * 0.5 * dt;
        g.y += (pdy / pd) * g.speed * 0.5 * dt;
      }
    } else {
      // walker / manager — slow patrol along curve
      g.ang += dt * (g.kind === 'manager' ? 0.6 : 0.4);
      g.x += Math.cos(g.ang) * g.speed * 0.3 * dt;
      g.y += Math.sin(g.ang) * g.speed * 0.3 * dt;
      g.x = Math.max(40, Math.min(W - 40, g.x));
      g.y = Math.max(40, Math.min(H - 100, g.y));
    }
    // MANAGER catch = instant alarm-bypass game-over (priority witness).
    if (d < 22) {
      if (g.kind === 'manager') { alarm.on = true; alarm.T = 0; alarm.escaped = false; }
      return caught();
    }
  }
  // Exit reach
  if (Math.hypot(exitZ.x - pug.x, exitZ.y - pug.y) < exitZ.r) {
    if (haul > 0) {
      // 50% bonus if escaped during active alarm window
      if (alarm.on && alarm.T > 0) { alarm.escaped = true; alarm.bonus = Math.floor(haul * 0.5); }
      // Celebratory confetti spawn — bright multicolor popups from exit point.
      const cols = ['#ff3aa1', '#4cc9f0', '#ffd23f', '#5ef38c', '#b055ff', '#ff8e3c'];
      for (let i = 0; i < 16; i++) {
        popup(
          exitZ.x + (Math.random() - 0.5) * 60,
          exitZ.y + (Math.random() - 0.5) * 30,
          ['★', '♥', '♦', '✦'][i % 4],
          cols[i % cols.length]
        );
      }
      popup(exitZ.x, exitZ.y - 30, alarm.escaped ? 'CLOSE CALL!' : 'CLEAN ESCAPE!', '#ffd23f');
      sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.06, 0.22, 0.18);
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
    if (p.vx) { p.x += p.vx * dt; p.vx *= 1 - dt * 2; }
    if (p.t >= p.life) popups.splice(i, 1);
  }
  shakeT = Math.max(0, shakeT - dt); if (shakeT === 0) shakeAmp = 0;
  if (pug.jiggleT > 0) pug.jiggleT = Math.max(0, pug.jiggleT - dt);
  if (spotFlashT > 0) spotFlashT = Math.max(0, spotFlashT - dt);
  updateHud();
}

// Generic shape-based drawer for section items without explicit icon fns.
function drawSectionItem(it) {
  const x = it.x, y = it.y, c = it.item.color || '#fff';
  const name = it.item.name;
  // Per-item painters — each grocery gets a distinct silhouette+details so the
  // shelf isn't a sea of colored circles. Fallback uses the generic shape.
  if (_drawGroceryByName(name, x, y, c)) {
    // Trap badge (small "?" on trap items)
    if (it.item.trap) {
      ctx.fillStyle = '#ff3a3a'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('?', x, y + 10);
    }
    return;
  }
  switch (it.item.shape) {
    case 'round':
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.arc(x - 2, y - 3, 2, 0, Math.PI * 2); ctx.fill();
      break;
    case 'curve':
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y, 9, 3, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0d05'; ctx.fillRect(x - 8, y - 1, 2, 2);
      break;
    case 'cone':
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.moveTo(x - 5, y + 6); ctx.lineTo(x + 5, y + 6); ctx.lineTo(x, y - 6); ctx.closePath(); ctx.fill();
      break;
    case 'box':
      ctx.fillStyle = c; ctx.fillRect(x - 7, y - 6, 14, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 7, y + 5, 14, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - 7, y - 6, 14, 1);
      break;
    case 'cluster':
      ctx.fillStyle = c;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'fish':
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 7, y); ctx.lineTo(x + 12, y - 3); ctx.lineTo(x + 12, y + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 1, 2, 2);
      break;
    case 'tube':
      ctx.fillStyle = c; ctx.fillRect(x - 6, y - 2, 12, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 6, y + 2, 12, 1);
      break;
    case 'jar':
      ctx.fillStyle = '#a8d0c8'; ctx.fillRect(x - 5, y - 5, 10, 11);
      ctx.fillStyle = c; ctx.fillRect(x - 4, y - 4, 8, 9);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 4, y - 6, 8, 2);
      break;
    default:
      ctx.fillStyle = c; ctx.fillRect(x - 5, y - 5, 10, 10);
  }
  // Trap badge (small "?" on trap items)
  if (it.item.trap) {
    ctx.fillStyle = '#ff3a3a'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('?', x, y + 10);
  }
}

// Distinct icons per grocery name. Returns true on draw; false to use fallback.
// Compact helpers reduce code size while keeping art.
function _drawGroceryByName(name, x, y, c) {
  const fs = (col) => ctx.fillStyle = col;
  const r = (rx, ry, rw, rh) => ctx.fillRect(rx, ry, rw, rh);
  const a = (ax, ay, ar) => { ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill(); };
  const e = (ax, ay, rw, rh, rot) => { ctx.beginPath(); ctx.ellipse(ax, ay, rw, rh, rot || 0, 0, Math.PI * 2); ctx.fill(); };
  switch (name) {
    case 'apple':
      fs('#a02030'); a(x, y, 7);
      fs('#ff5a3a'); a(x - 1, y - 1, 6);
      fs('#ffb090'); a(x - 3, y - 3, 2);
      fs('#5a3010'); r(x - 1, y - 9, 2, 3);
      fs('#5ef38c'); r(x + 1, y - 8, 3, 2);
      return true;
    case 'orange':
      fs('#c85020'); a(x, y, 7);
      fs('#ff8e3c'); a(x, y, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI); ctx.stroke();
      fs('#3a6028'); r(x - 1, y - 8, 2, 2);
      return true;
    case 'banana':
      fs('#a07a20'); e(x, y, 9, 3, -0.4);
      fs('#ffd23f'); e(x, y - 1, 8, 2.5, -0.4);
      fs('#1a0d05'); r(x - 8, y - 1, 2, 2);
      fs('#5a3a10'); r(x + 7, y + 1, 2, 1);
      return true;
    case 'lettuce':
      fs('#3a8030'); a(x, y, 7);
      fs('#5ef38c');
      for (let i = 0; i < 5; i++) { const an = i * 1.257; a(x + Math.cos(an) * 3, y + Math.sin(an) * 3, 3); }
      fs('#a8f0b8'); a(x - 1, y - 1, 2);
      return true;
    case 'carrot':
      fs('#a04a10'); ctx.beginPath(); ctx.moveTo(x - 4, y + 5); ctx.lineTo(x + 4, y + 5); ctx.lineTo(x, y - 5); ctx.closePath(); ctx.fill();
      fs('#ff8e3c'); ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x + 3, y + 4); ctx.lineTo(x, y - 4); ctx.closePath(); ctx.fill();
      fs('#5ef38c'); r(x - 1, y - 8, 1, 3); r(x + 1, y - 9, 1, 4); r(x - 2, y - 7, 1, 2);
      return true;
    case 'tomato':
      fs('#7a1010'); a(x, y, 7);
      fs('#ff3a3a'); a(x, y, 6);
      fs('#ff8080'); a(x - 2, y - 2, 2);
      fs('#3a8028'); r(x - 2, y - 8, 4, 2);
      fs('#5ef38c'); r(x - 1, y - 9, 2, 1);
      return true;
    case 'grape':
      fs('#7028a0');
      for (let i = 0; i < 7; i++) { const ox = (i % 3) * 3 - 3, oy = Math.floor(i / 3) * 3 - 3; a(x + ox, y + oy, 2); }
      fs('#b055ff');
      for (let i = 0; i < 7; i++) { const ox = (i % 3) * 3 - 3, oy = Math.floor(i / 3) * 3 - 3; a(x + ox - 0.5, y + oy - 0.5, 1.5); }
      fs('#5a8030'); r(x, y - 7, 2, 2);
      return true;
    case 'icecream':
      fs('#a87a4a'); ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 7); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 1, y + 6); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x - 1, y + 6); ctx.stroke();
      fs('#ffe0e8'); a(x, y - 2, 5);
      fs('#a02060'); a(x - 2, y - 1, 1); a(x + 2, y - 4, 1);
      return true;
    case 'frozenPizza':
      fs('#3a2010'); r(x - 8, y - 6, 16, 12);
      fs('#ff8e3c'); r(x - 7, y - 5, 14, 10);
      fs('#fff'); r(x - 5, y - 3, 10, 5);
      fs('#a02020'); r(x - 4, y - 2, 2, 2); r(x, y - 1, 2, 2); r(x + 2, y - 2, 1, 1);
      fs('#5ef38c'); r(x - 3, y, 1, 1); r(x + 1, y - 3, 1, 1);
      fs('#b0d0e8'); r(x - 7, y - 6, 14, 1);
      return true;
    case 'peas':
      fs('#1a4020'); r(x - 7, y - 6, 14, 12);
      fs('#5ef38c'); r(x - 6, y - 5, 12, 10);
      fs('#3a8028'); a(x - 3, y - 1, 1.5); a(x, y, 1.5); a(x + 3, y + 2, 1.5);
      fs('#a8f0b8'); r(x - 6, y - 5, 12, 1);
      return true;
    case 'frozenFish':
      fs('#5078a8'); e(x, y, 9, 4);
      ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 13, y - 3); ctx.lineTo(x + 13, y + 3); ctx.closePath(); ctx.fill();
      fs('#8ab8d8'); e(x - 1, y - 1, 7, 2);
      fs('#fff'); a(x - 5, y - 1, 1);
      fs('#000'); r(x - 5, y - 1, 1, 1);
      fs('rgba(220,240,255,0.7)'); r(x - 3, y - 3, 1, 1); r(x + 1, y + 2, 1, 1);
      return true;
    case 'icecake':
      fs('#fff'); r(x - 7, y - 5, 14, 10);
      fs('#ffd0e0'); r(x - 7, y - 5, 14, 3);
      fs('#a02060'); r(x - 1, y - 8, 2, 3);
      fs('#ffd23f'); r(x - 1, y - 10, 1, 2);
      fs('rgba(0,0,0,0.3)'); r(x - 7, y + 4, 14, 1);
      return true;
    case 'phone':
      fs('#0a0a12'); r(x - 4, y - 7, 8, 14);
      fs('#1a1a22'); r(x - 4, y - 7, 8, 1);
      fs('#4cc9f0'); r(x - 3, y - 5, 6, 10);
      fs('rgba(255,255,255,0.4)'); r(x - 3, y - 5, 6, 1);
      fs('#fff'); r(x - 1, y + 6, 2, 1);
      return true;
    case 'headphones':
      ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6, Math.PI, Math.PI * 2); ctx.stroke();
      fs('#4cc9f0'); r(x - 7, y - 1, 3, 5); r(x + 4, y - 1, 3, 5);
      fs('#0a1a22'); r(x - 6, y + 1, 1, 2); r(x + 5, y + 1, 1, 2);
      return true;
    case 'tablet':
      fs('#0a0a12'); r(x - 7, y - 6, 14, 12);
      fs('#3a3a4a'); r(x - 7, y - 6, 14, 1);
      fs('#4cc9f0'); r(x - 6, y - 5, 12, 10);
      fs('rgba(255,255,255,0.4)'); r(x - 6, y - 5, 12, 1);
      fs('#ffd23f'); r(x - 5, y - 3, 1, 1);
      fs('#5ef38c'); r(x - 3, y - 3, 1, 1);
      fs('#ff5a3a'); r(x - 1, y - 3, 1, 1);
      return true;
    case 'watch':
      fs('#3a2810'); r(x - 1, y - 9, 2, 4); r(x - 1, y + 5, 2, 4);
      fs('#ffd23f'); a(x, y, 5);
      fs('#fff4a0'); a(x - 1, y - 1, 4);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 3); ctx.moveTo(x, y); ctx.lineTo(x + 2, y); ctx.stroke();
      return true;
    case 'salami':
      fs('#601818'); r(x - 7, y - 3, 14, 6);
      fs('#a04030'); r(x - 6, y - 2, 12, 4);
      fs('#3a2010');
      for (let i = -5; i <= 5; i += 3) r(x + i, y - 3, 1, 6);
      fs('#ffd8b0'); r(x - 3, y - 1, 1, 1); r(x + 1, y, 1, 1);
      return true;
    case 'cheeseWheel':
      fs('#b08028'); a(x, y, 7);
      fs('#ffce5e'); a(x, y, 6);
      fs('#fff4a0'); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, y - 3); ctx.lineTo(x + 6, y + 1); ctx.closePath(); ctx.fill();
      fs('#a07020'); r(x - 3, y - 1, 1, 1); r(x - 1, y + 2, 1, 1);
      return true;
    case 'sausage':
      fs('#6a3010'); e(x, y, 7, 3);
      fs('#a06030'); e(x, y - 1, 6, 2);
      fs('#3a1808'); r(x - 7, y - 1, 1, 2); r(x + 6, y - 1, 1, 2);
      return true;
    case 'pickle':
      fs('#3a8020'); e(x, y, 7, 2.5, 0.2);
      fs('#5ef38c'); e(x, y - 0.5, 6, 2, 0.2);
      fs('#2a5018'); r(x - 4, y, 1, 1); r(x - 1, y + 1, 1, 1); r(x + 3, y - 1, 1, 1);
      return true;
    case 'oliveJar':
      fs('#a8d0c8'); r(x - 5, y - 5, 10, 11);
      fs('#5a8a3a'); r(x - 4, y - 4, 8, 9);
      fs('#3a4a1a'); a(x - 2, y - 1, 1.5); a(x + 1, y + 1, 1.5); a(x - 1, y + 3, 1.5);
      fs('#3a3a3a'); r(x - 5, y - 7, 10, 2);
      fs('#5a5a5a'); r(x - 5, y - 7, 10, 1);
      return true;
    case 'oldBread':
      fs('#5a3018'); r(x - 7, y - 4, 14, 9);
      fs('#a87a4a'); r(x - 6, y - 3, 12, 7);
      fs('#3a6028'); r(x - 4, y - 2, 1, 1); r(x + 3, y, 1, 1); r(x - 1, y + 1, 1, 1);
      return true;
    case 'dentedCan':
      fs('#5a5a6a'); r(x - 5, y - 6, 10, 12);
      fs('#8a8aac'); r(x - 5, y - 5, 10, 10);
      fs('#3a3a4a'); r(x - 5, y - 6, 10, 1); r(x - 5, y + 5, 10, 1); r(x - 2, y - 1, 3, 2);
      fs('#a02020'); r(x - 5, y - 2, 10, 4);
      fs('#fff'); r(x - 3, y, 1, 1); r(x + 2, y, 1, 1);
      return true;
    case 'discBox':
      fs('#7a1860'); r(x - 7, y - 6, 14, 12);
      fs('#ff3aa1'); r(x - 7, y - 6, 14, 4);
      fs('#fff'); r(x - 5, y, 10, 4);
      fs('#000'); a(x, y + 2, 2);
      return true;
    case 'lastSeason':
      fs('#2a4868'); r(x - 7, y - 6, 14, 12);
      fs('#5ea0c8'); r(x - 6, y - 5, 12, 10);
      fs('#ff3a3a'); r(x - 4, y - 3, 8, 4);
      fs('#fff'); ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('OFF', x, y);
      return true;
    case 'croissant':
      fs('#8a5020'); e(x, y, 8, 4, -0.3);
      fs('#d8a06a'); e(x, y - 1, 7, 3, -0.3);
      ctx.strokeStyle = '#5a3010'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 1); ctx.lineTo(x - 3, y + 1);
      ctx.moveTo(x - 1, y - 2); ctx.lineTo(x + 1, y);
      ctx.moveTo(x + 3, y - 1); ctx.lineTo(x + 5, y + 1); ctx.stroke();
      return true;
    case 'hotLoaf':
      fs('#5a3018'); e(x, y, 8, 5);
      fs('#a87a4a'); e(x, y - 1, 7, 4);
      ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 3); ctx.lineTo(x - 2, y);
      ctx.moveTo(x, y - 3); ctx.lineTo(x + 2, y);
      ctx.moveTo(x + 3, y - 3); ctx.lineTo(x + 5, y); ctx.stroke();
      fs('rgba(255,255,255,0.45)'); r(x - 3, y - 8, 1, 2); r(x + 1, y - 9, 1, 2);
      return true;
    case 'cake':
      fs('#a06078'); r(x - 7, y - 4, 14, 9);
      fs('#ffe0e8'); r(x - 7, y - 4, 14, 5);
      fs('#ff3aa1'); r(x - 5, y - 3, 1, 1); r(x - 1, y - 3, 1, 1); r(x + 3, y - 3, 1, 1);
      fs('#5ea0c8'); r(x - 2, y - 7, 1, 3); r(x + 1, y - 7, 1, 3);
      fs('#ffd23f'); r(x - 2, y - 8, 1, 1); r(x + 1, y - 8, 1, 1);
      return true;
    case 'pretzel':
      ctx.strokeStyle = '#5a3010'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x - 2, y, 3, 0, Math.PI * 2); ctx.arc(x + 2, y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#a06030'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x - 2, y, 3, 0, Math.PI * 2); ctx.arc(x + 2, y, 3, 0, Math.PI * 2); ctx.stroke();
      fs('#fff'); r(x - 4, y - 2, 1, 1); r(x + 3, y - 2, 1, 1); r(x, y + 3, 1, 1);
      return true;
  }
  return false;
}
// MINI-MAP — small radar top-right with shelves/guards/customers/pug/exit.
// Section rows are tinted with the same colour key as the in-world floor so
// the player can read the layout at a glance.
function drawMartMiniMap() {
  const mw = 140, mh = 90;
  const mx = W - mw - 16, my = 50;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
  ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
  // Per-section row tint — same color key as the floor.
  for (let r = 0; r < sceneRows; r++) {
    const secId = sections[r];
    if (!secId) continue;
    const tint = SECTION_TINT[secId] || 'rgba(255,255,255,0.04)';
    // Pump up the alpha a touch so it reads on the dark map bg.
    ctx.fillStyle = tint.replace(/[\d.]+\)$/, (m) => Math.min(0.55, parseFloat(m) * 2.4).toFixed(2) + ')');
    const ry = my + ((sceneGy + r * 100 - 20) / H) * mh;
    const rh = (100 / H) * mh;
    ctx.fillRect(mx, ry, mw, rh);
  }
  // shelves
  ctx.fillStyle = 'rgba(160,100,40,0.5)';
  for (const s of shelves) {
    if (s.toppled) continue;
    ctx.fillRect(mx + (s.x / W) * mw, my + (s.y / H) * mh,
                 Math.max(1, (s.w / W) * mw), Math.max(1, (s.h / H) * mh));
  }
  // exit
  if (exitZ) {
    ctx.fillStyle = '#5ef38c';
    ctx.fillRect(mx + (exitZ.x / W) * mw - 2, my + (exitZ.y / H) * mh - 2, 4, 4);
  }
  // guards
  for (const g of guards || []) {
    ctx.fillStyle = g.alertT > 0 ? '#ff3a3a' : ({ chaser: '#ff8a8a', manager: '#ffd23f' }[g.kind] || '#4cc9f0');
    ctx.fillRect(mx + (g.x / W) * mw - 1, my + (g.y / H) * mh - 1, 3, 3);
  }
  // customers
  for (const c of customers) {
    ctx.fillStyle = '#b055ff';
    ctx.fillRect(mx + (c.x / W) * mw - 1, my + (c.y / H) * mh - 1, 2, 2);
  }
  // pug
  if (pug) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx + (pug.x / W) * mw - 2, my + (pug.y / H) * mh - 2, 4, 4);
  }
  ctx.fillStyle = '#4cc9f0'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText('MAP [M]', mx + mw, my - 4);
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

  // PER-SECTION row tint + atmospheric lighting band. Each section gets a
  // characteristic color tint applied as a "lit row" — clearance has a
  // flickering bulb (random alpha drops), bakery glows orange, etc.
  for (let r = 0; r < sceneRows; r++) {
    const secId = sections[r];
    if (!secId) continue;
    ctx.fillStyle = SECTION_TINT[secId] || 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, sceneGy + r * 100 - 20, W, 100);
    // Per-section overhead light overlay (gradient that pools down from top
    // of the row, tinted by section). CLEARANCE flickers (Math.random in alpha).
    const lightSpec = SECTION_LIGHT[secId];
    if (lightSpec) {
      let alphaMul = 1;
      if (lightSpec.flicker) alphaMul = Math.random() < 0.06 ? 0.25 : 1;
      const top = sceneGy + r * 100 - 20;
      const grad = ctx.createLinearGradient(0, top, 0, top + 100);
      // Parse a few cheap colors out of the color string
      const c = lightSpec.color;
      grad.addColorStop(0, c.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.8 * alphaMul).toFixed(2) + ')'));
      grad.addColorStop(0.55, c.replace(/[\d.]+\)$/, (m) => (parseFloat(m) * 0.4 * alphaMul).toFixed(2) + ')'));
      grad.addColorStop(1, c.replace(/[\d.]+\)$/, () => '0)'));
      ctx.fillStyle = grad;
      ctx.fillRect(0, top, W, 100);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = "bold 7px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
    ctx.fillText('· ' + secId.toUpperCase() + ' ·', W - 12, sceneGy + r * 100 - 6);
  }
  // SECURITY OFFICE — small windowed room top-left with 2 monitors + door
  if (secOffice) {
    const s = secOffice;
    ctx.fillStyle = '#1a1a26'; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, s.w, s.h);
    // monitors
    ctx.fillStyle = '#4cc9f0';
    const mon1Pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
    ctx.globalAlpha = mon1Pulse;
    ctx.fillRect(s.x + 8, s.y + 8, 30, 20);
    ctx.fillRect(s.x + 44, s.y + 8, 30, 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd23f'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText('SECURITY', s.x + 4, s.y - 2);
    // door
    ctx.fillStyle = '#5a3a1c'; ctx.fillRect(s.x + s.w - 14, s.y + s.h - 16, 10, 16);
    // tiny indicator: red when dispatch is "watching"
    ctx.fillStyle = heat > 0.4 ? '#ff3a3a' : '#5ef38c';
    ctx.fillRect(s.x + s.w - 6, s.y + 4, 4, 4);
  }
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
    else drawSectionItem(it);
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
  // CUSTOMERS — small pug NPCs that wander. Yellow "?" if witnessed recently.
  // Walk animation variety: each customer has a unique `gait` index that
  // changes the bob frequency + amplitude + lean direction.
  for (const c of customers) {
    if (c._gait == null) {
      c._gait = Math.floor(Math.random() * 4);
      c._gaitPhase = Math.random() * Math.PI * 2;
    }
    // Civilian archetype — picks a stable type per customer (kid/elder/biz/
    // tourist/parent) so the crowd visibly varies. Cached on first draw.
    if (c._civType == null) {
      const types = ['kid', 'elder', 'biz', 'tourist', 'parent'];
      c._civType = types[Math.floor(Math.random() * types.length)];
    }
    // Bob amount scales with current movement magnitude
    const moving = Math.hypot(c.vx, c.vy) > 5;
    const freq = [4, 6, 5, 7][c._gait]; // gait 0=slow, 1=quick, 2=normal, 3=jittery
    const amp = [1.6, 1.0, 1.2, 2.0][c._gait];
    const lean = [0, 0.05, -0.05, 0.08][c._gait];
    const phase = performance.now() / 1000 * freq + c._gaitPhase;
    const bob = moving ? Math.sin(phase) * amp : 0;
    const tilt = moving ? Math.cos(phase) * lean : 0;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.rotate(tilt);
    // Civilian sprite size + accent color per archetype.
    const civSize = _civSizeForType(c._civType);
    drawPug(ctx, 0, 0, { size: civSize, body: c.color, mask: '#3a2810' });
    _drawCivilianAccessory(ctx, 0, 0, c._civType, civSize);
    // Tiny shopping bag if gait 1 (quick shopper)
    if (c._gait === 1) {
      ctx.fillStyle = '#a87a4a'; ctx.fillRect(8, -2, 4, 6);
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(8, -2, 4, 1);
    }
    ctx.restore();
    if (c.witnessCd > 2) {
      ctx.fillStyle = '#ffd23f'; ctx.font = "10px sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('?', c.x, c.y - 18);
    }
  }
  // WANTED POSTER — pinned on the side wall. Grows with successful escapes.
  // Pulses with red glow more strongly as wantedLvl rises (notoriety vibe).
  if (wantedLvl > 0) {
    const wx = 16, wy = 100;
    const ww = 60 + Math.min(40, wantedLvl * 6);
    const wh = 76 + Math.min(60, wantedLvl * 8);
    // Pulse intensity scales linearly to wantedLvl (cap at lvl 10).
    const pulseStrength = Math.min(1, wantedLvl / 10);
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / (260 - pulseStrength * 60));
    // Background red glow when wanted is high
    if (pulseStrength > 0.2) {
      ctx.save();
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 8 + pulse * 14 * pulseStrength;
      ctx.fillStyle = '#c8a872'; ctx.fillRect(wx, wy, ww, wh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#c8a872'; ctx.fillRect(wx, wy, ww, wh);
    }
    // Paper edge crinkle
    ctx.strokeStyle = '#7a5a32'; ctx.lineWidth = 1;
    ctx.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1);
    ctx.fillStyle = '#1a0d05';
    ctx.font = "bold 7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('WANTED', wx + ww / 2, wy + 10);
    ctx.fillStyle = '#a06030';
    ctx.beginPath(); ctx.arc(wx + ww / 2, wy + 30 + wantedLvl, 10 + Math.min(8, wantedLvl), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(wx + ww / 2 - 7, wy + 28, 14, 4);
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(wx + ww / 2 - 4, wy + 29, 2, 1); ctx.fillRect(wx + ww / 2 + 2, wy + 29, 2, 1);
    // Bounty text pulses red along with the poster glow.
    const r = Math.floor(160 + pulse * 80 * pulseStrength);
    ctx.fillStyle = `rgb(${r},40,40)`;
    ctx.font = "bold 6px 'Press Start 2P', monospace";
    ctx.fillText('$' + (wantedLvl * 50), wx + ww / 2, wy + wh - 6);
  }
  // Guards — vision cone + high-detail security pug (depth3D shadow under each)
  for (const g of guards) {
    const frozen = guardFreezeT > 0;
    ctx.fillStyle = frozen
      ? 'rgba(120,120,180,0.12)'
      : `rgba(255,58,58,${g.alertT > 0 ? 0.3 : 0.15})`;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, 200, g.ang - 0.5, g.ang + 0.5);
    ctx.closePath(); ctx.fill();
    // Dashed edge lines along the cone — much easier to see where the cone
    // actually ends (the soft red fill blends with the floor).
    if (!frozen) {
      ctx.strokeStyle = g.alertT > 0 ? 'rgba(255,80,80,0.7)' : 'rgba(255,80,80,0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.ang - 0.5) * 200, g.y + Math.sin(g.ang - 0.5) * 200);
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.ang + 0.5) * 200, g.y + Math.sin(g.ang + 0.5) * 200);
      // Far-edge arc to close the wedge
      ctx.moveTo(g.x + Math.cos(g.ang - 0.5) * 200, g.y + Math.sin(g.ang - 0.5) * 200);
      ctx.arc(g.x, g.y, 200, g.ang - 0.5, g.ang + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    _depthShadow(ctx, g.x, g.y + 18, 20, { alpha: 0.4 });
    // Body color hints at guard kind (chaser=red, manager=gold, patrol=cyan, walker=teal).
    // Each kind also gets a distinct hat/uniform-accent so silhouettes read at speed.
    const _gu = _guardUniform(g.kind, frozen);
    drawPug(ctx, g.x, g.y, { size: 34, body: _gu.body, mask: _gu.mask, hat: true, hatColor: _gu.hatColor });
    if (!frozen) _drawGuardAccessory(ctx, g.x, g.y, g.kind, 34);
    // Tiny kind label above
    if (!frozen) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText((g.kind || 'guard').toUpperCase(), g.x, g.y + 24);
    }
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
  // Pug (and cart if active) — use the same cart art for consistency.
  // jiggleT (0..0.22s) drives a quick decaying tilt away from the bump direction.
  // cartWobbleT (0..0.4s) drives a side-lean from hard turns when in cart.
  let jiggleAng = 0;
  if (pug.jiggleT > 0) {
    const jk = pug.jiggleT / 0.22;
    // damped sine wave
    jiggleAng = Math.sin(jk * Math.PI * 4) * 0.18 * jk;
  }
  let wobbleAng = 0, wobbleY = 0;
  if (pug.cartWobbleT > 0) {
    const wk = pug.cartWobbleT / 0.4;
    // Damped lean — strongest at start, fades to 0
    wobbleAng = Math.sin(wk * Math.PI * 3) * 0.22 * wk * (pug.cartWobbleDir || 1);
    wobbleY = -Math.abs(Math.sin(wk * Math.PI * 3)) * 2 * wk;
  }
  const totalAng = jiggleAng + wobbleAng;
  if (totalAng !== 0) {
    ctx.save();
    ctx.translate(pug.x, pug.y);
    ctx.rotate(totalAng);
    ctx.translate(-pug.x, -pug.y);
  }
  // depth3D drop shadow under the pug (and cart if any)
  _depthShadow(ctx, pug.x, pug.y + 14, inCart ? 22 : 16, { alpha: 0.45 });
  if (inCart) drawCart(pug.x, pug.y + 4 + wobbleY, 0);
  // Pug shopper with rotating disguise — cycles by map for a "different store
  // different cover" feel. Stays cosmetic (does not change gameplay).
  const _shopperDisguise = _shopperDisguiseForMap(currentMap.id);
  drawPug(ctx, pug.x, pug.y - (inCart ? 6 : 0) + wobbleY, { size: 28, ..._shopperDisguise });
  _drawShopperAccessory(ctx, pug.x, pug.y - (inCart ? 6 : 0) + wobbleY, currentMap.id, 28);
  if (totalAng !== 0) ctx.restore();
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
  // STEALTH EYE icon — opens/closes based on alert level (easier to read than text).
  {
    let sus = 0;
    for (const g of guards || []) sus = Math.max(sus, g.alertT > 0 ? 1 : 0);
    if (alarm.on) sus = 1;
    if (heat > 0.5) sus = Math.max(sus, 0.6);
    const eyeOpen = sus > 0.35;
    const ex = 28, ey = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = eyeOpen ? '#ff3a3a' : '#5ef38c';
    ctx.beginPath(); ctx.ellipse(ex, ey, 10, eyeOpen ? 7 : 2, 0, 0, Math.PI * 2); ctx.fill();
    if (eyeOpen) {
      ctx.fillStyle = '#1a0d05'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // MINI-MAP (M toggle) — radar top-right
  if (miniMapOn) drawMartMiniMap();
  // OBJECTIVE banner (current shoplist + bag/haul progress) — under HUD card.
  // Always visible — quick glance at progress vs goal.
  if (activeShoplist) {
    const goal = currentMap.goalHaul || 200;
    const pct = Math.min(1, haul / goal);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 130, H - 38, 260, 26);
    // Progress bar inside
    ctx.fillStyle = 'rgba(60,60,80,0.7)';
    ctx.fillRect(W / 2 - 124, H - 18, 248, 6);
    ctx.fillStyle = haul >= goal ? '#5ef38c' : (pct > 0.65 ? '#ffd23f' : '#4cc9f0');
    ctx.fillRect(W / 2 - 124, H - 18, 248 * pct, 6);
    // Top line: shoplist + map
    ctx.fillStyle = '#b0e8ff'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('SHOPLIST · ' + activeShoplist.id.toUpperCase() + ' · ' + (currentMap.label || ''), W / 2, H - 27);
    // Goal line
    ctx.fillStyle = haul >= goal ? '#5ef38c' : '#fff';
    ctx.font = "5px 'Press Start 2P', monospace";
    ctx.fillText('$' + haul + ' / $' + goal + ' GOAL · BAG ' + bag + '/' + maxBag, W / 2, H - 7);
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
  // SPOT flash — brief red rim when a guard first sees you (not full overlay).
  if (spotFlashT > 0) {
    const a = Math.min(0.7, spotFlashT * 2.2);
    const rim = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.65);
    rim.addColorStop(0, 'rgba(255,58,58,0)');
    rim.addColorStop(0.55, `rgba(255,58,58,${a * 0.3})`);
    rim.addColorStop(1, `rgba(255,58,58,${a})`);
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, W, H);
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
  // depth3D: subtle screen-space vignette so the bright supermarket floor
  // feels framed and the action centers visually on the player.
  const _vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  _vg.addColorStop(0, 'rgba(0,0,0,0)');
  _vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = _vg; ctx.fillRect(0, 0, W, H);
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _smHud = {
  haul: document.getElementById('hud-haul'),
  bag: document.getElementById('hud-bag'),
  heat: document.getElementById('hud-heat'),
  shelves: document.getElementById('hud-shelves'),
  hud: document.getElementById('hud'),
  best: document.getElementById('hud-best'),
};
let _smHudPrev = { haul: -1, bag: '', heat: -1, shelves: -1, pulse: false, best: '' };
let _smBestCache = null, _smBestCacheT = 0;
function updateHud() {
  if (haul !== _smHudPrev.haul) { _smHud.haul.textContent = '$' + haul; _smHudPrev.haul = haul; }
  const bg = `${bag}/${maxBag}`;
  if (bg !== _smHudPrev.bag) { _smHud.bag.textContent = bg; _smHudPrev.bag = bg; }
  const ht = Math.floor(heat * 100);
  if (ht !== _smHudPrev.heat) { _smHud.heat.textContent = ht + '%'; _smHudPrev.heat = ht; }
  if (shelvesKnocked !== _smHudPrev.shelves) {
    _smHud.shelves.textContent = shelvesKnocked;
    _smHudPrev.shelves = shelvesKnocked;
  }
  const pulseOn = heat > 0.7;
  if (pulseOn) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.014);
    _smHud.hud.style.filter = `drop-shadow(0 0 ${6 + pulse * 8}px rgba(255,58,58,${0.4 + pulse * 0.4}))`;
  } else if (_smHudPrev.pulse) {
    _smHud.hud.style.filter = '';
  }
  _smHudPrev.pulse = pulseOn;
  // loadBest hits localStorage — cache for 2s.
  const now = performance.now();
  if (now - _smBestCacheT > 2000) {
    const best = loadBest('supermarket-pug');
    const bestHaul = best && (best.haul != null ? best.haul : best.score);
    _smBestCache = bestHaul != null ? '$' + bestHaul : '$0';
    _smBestCacheT = now;
  }
  if (_smBestCache !== _smHudPrev.best) {
    _smHud.best.textContent = _smBestCache;
    _smHudPrev.best = _smBestCache;
  }
}

function caught() { shake(8, 0.3); end(false); }
// Evaluate end-of-run badges and persist any new ones.
function _evaluateRunBadges(escaped) {
  runBadges = new Set();
  if (escaped && !everSpotted) runBadges.add('PERFECT_HEIST');
  if (sectionsLootedThisRun.size >= 5) runBadges.add('SECTION_MASTER_X5');
  if (chainBestThisRun >= 4) runBadges.add('DOMINO_FALL');
  if (escaped && haul >= 300) runBadges.add('BIG_SCORE');
  if (cartShelvesThisRun >= 8) runBadges.add('CART_DEMON');
  if (bakeryStolenThisRun >= 3) runBadges.add('BAKERY_THIEF');
  if (escaped && alarm.escaped) runBadges.add('ALARM_ESCAPE');
  if (escaped && !bribeUsedThisRun) runBadges.add('NO_BRIBE');
  // Persist new badges into savedBadges (lifetime collection)
  let changed = false;
  for (const id of runBadges) {
    if (!savedBadges.has(id)) { savedBadges.add(id); changed = true; }
  }
  if (changed) {
    try { localStorage.setItem(BADGE_KEY, JSON.stringify([...savedBadges])); } catch {}
  }
}
function end(escaped) {
  // Final-only objectives (cash thresholds, no-spot escape) get one last evaluation.
  checkObjectives({ escaped });
  _evaluateRunBadges(escaped);
  running = false;
  sfx.sweep(escaped ? 880 : 220, escaped ? 1320 : 80, escaped ? 'triangle' : 'sawtooth', 0.5, 0.25);
  document.getElementById('end-title').textContent = escaped ? (alarm.escaped ? 'CLOSE CALL!' : 'CLEAN GETAWAY') : 'CAUGHT';
  document.getElementById('end-sub').textContent = escaped ? (alarm.escaped ? `Escaped the alarm! +50% bonus (+$${alarm.bonus})` : 'You made it to the parking lot.') : 'Security got you. The snacks are gone.';
  // Apply alarm bonus to haul before recording
  if (escaped && alarm.escaped) haul += alarm.bonus;
  // Multi-run progression: successful escape → bump wanted poster + maybe unlock next map.
  if (escaped) {
    wantedLvl = Math.min(15, wantedLvl + 1);
    runMeta.wanted = wantedLvl;
    if (haul >= currentMap.goalHaul && currentMapIdx < MAPS.length - 1) {
      runMeta.unlocked = Math.max(runMeta.unlocked || 0, currentMapIdx + 1);
    }
    _saveMeta();
    _renderMapPicker();
  }
  document.getElementById('end-haul').textContent = '$' + haul;
  document.getElementById('end-shelves').textContent = shelvesKnocked;
  const finalScore = haul + (escaped ? 100 : 0);
  const { isNewBest, current } = submitRun('supermarket-pug', { score: finalScore, haul });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { haul };
    const haulShown = (b.haul != null) ? b.haul : (b.score || 0);
    bestEl.innerHTML = `Best: <b>$${haulShown}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // Inject badge strip into the end-overlay panel.
  try { _renderEndBadges(); } catch (e) { /* */ }
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

// Render badges (this run + lifetime collection) into the end-overlay panel.
// We inject a small chip strip just before the buttons; clears on each end.
function _renderEndBadges() {
  const endPanel = document.querySelector('#end-overlay .overlay__panel');
  if (!endPanel) return;
  let stripId = 'mart-badges-strip';
  let strip = document.getElementById(stripId);
  if (!strip) {
    strip = document.createElement('div');
    strip.id = stripId;
    strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px auto 0;padding:8px 6px;border:1px dashed rgba(94,243,140,0.35);border-radius:6px;max-width:420px;';
    // Insert before the buttons row
    const btns = endPanel.querySelector('.wg-end-buttons');
    if (btns) endPanel.insertBefore(strip, btns); else endPanel.appendChild(strip);
  }
  strip.innerHTML = '';
  // Header
  const head = document.createElement('div');
  head.style.cssText = 'flex:1 1 100%;text-align:center;font-family:var(--font-display);font-size:0.45rem;color:var(--neon-yellow);letter-spacing:0.08em;margin-bottom:4px;';
  const newCount = runBadges.size;
  head.textContent = newCount > 0 ? `★ ${newCount} BADGE${newCount === 1 ? '' : 'S'} EARNED · ${savedBadges.size}/${BADGE_DEFS.length} COLLECTED` : `BADGES · ${savedBadges.size}/${BADGE_DEFS.length} COLLECTED`;
  strip.appendChild(head);
  for (const def of BADGE_DEFS) {
    const earned = runBadges.has(def.id);
    const owned = savedBadges.has(def.id);
    const chip = document.createElement('div');
    const color = earned ? 'var(--neon-yellow)' : (owned ? 'var(--neon-green)' : 'var(--text-soft)');
    const bg = earned ? 'rgba(255,210,63,0.18)' : (owned ? 'rgba(94,243,140,0.10)' : 'rgba(120,120,140,0.06)');
    chip.style.cssText = `padding:3px 6px;border:1px solid ${color};color:${color};background:${bg};font-family:var(--font-display);font-size:0.36rem;letter-spacing:0.05em;border-radius:3px;` + (earned ? 'animation:wgBadgePulse 1s ease-in-out infinite alternate;' : '');
    chip.title = def.desc;
    chip.textContent = (earned ? '★ ' : (owned ? '✓ ' : '· ')) + def.label;
    strip.appendChild(chip);
  }
}
// One-time CSS injection for the pulsing animation used on newly-earned badges.
(function _martBadgeCss() {
  if (document.getElementById('mart-badge-css')) return;
  const st = document.createElement('style');
  st.id = 'mart-badge-css';
  st.textContent = '@keyframes wgBadgePulse { from { box-shadow: 0 0 4px rgba(255,210,63,0.3); } to { box-shadow: 0 0 14px rgba(255,210,63,0.85); } }';
  document.head.appendChild(st);
})();

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  keys.clear(); touchAt = null; // wipe stuck inputs from prior match
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
  try { music.setIntensity(0.25); music.play(); } catch {}
}
// Music dynamics — sample alarm state + heat in a periodic timer.
setInterval(() => {
  if (!running) return;
  try {
    const heatVal = (typeof heat === 'number') ? heat : 0;
    const i = (alarm && alarm.on) ? 1.0 : Math.min(0.75, 0.25 + heatVal * 0.5);
    music.setIntensity(i);
  } catch {}
}, 350);
(function _wireMartMusicEnd() {
  const endOv = document.getElementById('end-overlay');
  if (!endOv) return;
  const upd = () => {
    const visible = !endOv.hidden && !endOv.classList.contains('is-hidden');
    if (visible) try { music.stop(); } catch {}
  };
  new MutationObserver(upd).observe(endOv, { attributes: true, attributeFilter: ['hidden','class'] });
})();
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
  align-items: center; justify-content: center; background: rgba(0,0,0,0.78); padding: 16px;
  animation: bribe-fade-in 0.18s ease-out; }
.bribe-modal.is-open { display: flex; }
.bribe-modal__panel { background: linear-gradient(180deg, #1a0f2e, #0a0716);
  border: 3px solid var(--neon-yellow); border-radius: 10px; padding: 20px;
  max-width: 440px; width: 100%; box-shadow: 0 0 40px rgba(255,210,63,0.4);
  animation: bribe-pop-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes bribe-fade-in { from { background: rgba(0,0,0,0); } to { background: rgba(0,0,0,0.78); } }
@keyframes bribe-pop-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
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
  bribeUsedThisRun = true;
  sfx.arp([523, 659, 880], 'triangle', 0.08, 0.22, 0.2);
  // Apply effect
  if (b.id === 'guardBreak') {
    guardFreezeT = 10;
    popup(pug.x, pug.y - 24, '💤 GUARDS NAPPING', '#b0e0ff');
  } else if (b.id === 'cameraBlink') {
    cameraBlinkT = 8;
    heat = 0; // immediate calm
    popup(pug.x, pug.y - 24, '📷 CAMERAS OFF', '#4cc9f0');
  } else if (b.id === 'alarmJam') {
    alarmJamT = 8;
    // If alarm was already on, kill it immediately
    if (alarm.on) { alarm.on = false; alarm.T = 0; }
    popup(pug.x, pug.y - 24, '📡 ALARM JAMMED', '#ff8e3c');
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
  if (alarmJamT > 0) {
    const c = document.createElement('div'); c.className = 'bribe-chip';
    c.textContent = '📡 ' + alarmJamT.toFixed(1) + 's';
    _bribeChips.appendChild(c);
  }
  if (highlightedItem && !highlightedItem.taken) {
    const c = document.createElement('div'); c.className = 'bribe-chip';
    c.textContent = '⭐ JACKPOT MARKED';
    _bribeChips.appendChild(c);
  }
}
// Keep bribe button label fresh + chips ticking.
// Perf: cache prev values so we only touch the button DOM when something changed.
// renderBribeChips() must remain per-frame — it visualises timers (guardFreezeT,
// cameraBlinkT) that decrement continuously.
let _prevBribeDisplay = null, _prevBribeHaul = -1, _prevBribeChipsDisplay = null;
function _bribeBtnLoop() {
  if (_bribeBtn) {
    const disp = running ? 'block' : 'none';
    if (_prevBribeDisplay !== disp) { _bribeBtn.style.display = disp; _prevBribeDisplay = disp; }
    if (running && haul !== _prevBribeHaul) {
      _bribeBtn.textContent = `💰 BRIBE $${haul}`;
      _prevBribeHaul = haul;
    }
  }
  if (_bribeChips) {
    const cd = running ? 'flex' : 'none';
    if (_prevBribeChipsDisplay !== cd) { _bribeChips.style.display = cd; _prevBribeChipsDisplay = cd; }
  }
  renderBribeChips();
  requestAnimationFrame(_bribeBtnLoop);
}
_bribeBtnLoop();

window.addEventListener('keydown', (e) => {
  if ((e.key === 'b' || e.key === 'B') && !e.repeat) {
    if (bribeOpen) closeBribe(); else if (running) openBribe();
  }
});

// ===== OBJECTIVES PANEL (Goose-Game checklist, top-left) =====
const _objCss = `
.mart-objectives { position: fixed; top: 70px; left: 12px; z-index: 60;
  background: rgba(10,7,22,0.78); border: 2px solid rgba(94,243,140,0.45);
  border-radius: 6px; padding: 8px 10px 8px 10px; min-width: 180px; max-width: 240px;
  font-family: var(--font-display); font-size: 0.42rem; letter-spacing: 0.04em;
  box-shadow: 0 4px 0 rgba(0,0,0,0.4); pointer-events: none;
  animation: mart-obj-slide 0.4s ease-out; }
@keyframes mart-obj-slide {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
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
// Hide objectives panel when run ends (visible only while in-game).
// Perf: cache prev display so we don't touch CSS every frame.
let _prevObjDisplay = null;
const _objVisLoop = () => {
  if (_objPanel) {
    const d = (running && objectives && objectives.length) ? 'block' : 'none';
    if (_prevObjDisplay !== d) { _objPanel.style.display = d; _prevObjDisplay = d; }
  }
  requestAnimationFrame(_objVisLoop);
};
_objVisLoop();

// Tutorial tip — shows briefly when the game starts (every match).
// Touch + desktop wording diverge so the buttons / keys match the device.
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      const firstTip = _isTouch
        ? 'JOYSTICK move · GRAB / RAM / CART buttons · 💰 BRIBE top-right · 🚪 EXIT bottom-right'
        : 'WASD move · E grab · SPACE ram · C cart · 💰 BRIBE top-right (B) · 🚪 EXIT bottom-right';
      showTip(firstTip, 7000);
      // Follow-up bubble after 7.5s — explains the SECTIONS + GUARD types.
      // Only fires once per session (sessionStorage flag).
      setTimeout(() => {
        try {
          if (sessionStorage.getItem('mart-tut-2')) return;
          sessionStorage.setItem('mart-tut-2', '1');
          showTip('SECTIONS · PRODUCE cheap · FROZEN slow · ELECTRONICS expensive (+heat) · DELI mid · CLEARANCE traps · BAKERY massive (lures cleaner-bot)', 8500);
          setTimeout(() => {
            showTip('GUARDS · WALKER slow · PATROL paths · CHASER fast + alerts others · MANAGER = instant catch', 7500);
          }, 9000);
        } catch {}
      }, 7500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Knocking over a shelf creates chaos cover.',
    'TIP: Carts move faster but make more noise.',
    'TIP: Bribe security with $$ to escape pinches.',
    'TIP: Bigger bags = more loot per trip.',
    'LORE: Supermarkets owe pugs millions in stolen biscuits.',
    'JOKE: How does a pug shop? With chaos and intent.',
  ];
  const GAME_ID = 'supermarket-pug';
  const startOv = document.getElementById('overlay');
  const endOv = document.getElementById('end-overlay');
  const factEl = document.getElementById('wg-fun-facts');
  let factIdx = Math.floor(Math.random() * FACTS.length), factTimer = null;
  function showFact() {
    if (!factEl) return;
    factEl.classList.remove('is-shown');
    setTimeout(() => { factEl.textContent = FACTS[factIdx % FACTS.length]; factEl.classList.add('is-shown'); factIdx++; }, 220);
  }
  function startFactLoop() { showFact(); clearInterval(factTimer); factTimer = setInterval(showFact, 4200); }
  function stopFactLoop() { clearInterval(factTimer); if (factEl) factEl.classList.remove('is-shown'); }
  function refreshStartBest() {
    const el = document.getElementById('start-best');
    if (!el) return;
    import('../../src/persistence/highScores.js').then(({ loadBest: lb }) => {
      try {
        const best = lb(GAME_ID);
        if (best && (best.haul || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: $${best.haul || best.score || 0}`;
        } else { el.hidden = true; }
      } catch {}
    }).catch(() => {});
  }
  function spawnConfetti() {
    const colors = ['#ffd23f','#ff3aa1','#4cc9f0','#5ef38c','#ff8e3c','#b055ff'];
    const root = document.createElement('div'); root.className = 'wg-confetti';
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('span');
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.background = colors[Math.floor(Math.random() * colors.length)];
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      root.appendChild(s);
    }
    document.body.appendChild(root);
    setTimeout(() => root.remove(), 3200);
  }
  let _runStart = 0;
  function showReplayPrompt() {
    const el = document.getElementById('wg-tryagain');
    if (!el) return;
    const dur = (performance.now() - _runStart) / 1000;
    el.hidden = dur > 25;
  }
  const shareBtn = document.getElementById('wg-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const h = document.getElementById('end-haul')?.textContent || '$0';
      const s = document.getElementById('end-shelves')?.textContent || '0';
      const text = `🐶 SUPERMARKET PUG — Stole ${h} and trashed ${s} shelves! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'SUPERMARKET PUG', text, url: 'https://leobalkind.github.io/web-games/' });
        else { await navigator.clipboard.writeText(text); shareBtn.textContent = '✓ COPIED!'; setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800); }
      } catch { shareBtn.textContent = '⚠ FAILED'; setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800); }
    });
  }
  if (startOv) {
    const startUpdate = () => {
      const visible = !startOv.hidden && !startOv.classList.contains('is-hidden');
      if (visible) { refreshStartBest(); startFactLoop(); } else { stopFactLoop(); _runStart = performance.now(); }
    };
    new MutationObserver(startUpdate).observe(startOv, { attributes: true, attributeFilter: ['hidden','class'] });
    startUpdate();
  }
  if (endOv) {
    const endUpdate = () => {
      const visible = !endOv.hidden && !endOv.classList.contains('is-hidden');
      if (!visible) return;
      const title = document.getElementById('end-title');
      if (title) { title.classList.remove('is-shake'); void title.offsetWidth; title.classList.add('is-shake'); }
      const bestEl = document.getElementById('end-best');
      const banner = document.getElementById('wg-newbest');
      const isNew = bestEl && /NEW/i.test(bestEl.textContent || '');
      if (banner) banner.classList.toggle('is-shown', !!isNew);
      if (isNew) spawnConfetti();
      showReplayPrompt();
    };
    new MutationObserver(endUpdate).observe(endOv, { attributes: true, attributeFilter: ['hidden','class'] });
  }
})();

// MAP picker on start overlay — also persists the picked map.
function _renderMapPicker() {
  const root = document.getElementById('mart-map-pick');
  if (!root) return;
  root.innerHTML = '';
  const unlocked = Math.max(0, runMeta.unlocked || 0);
  MAPS.forEach((m, i) => {
    const btn = document.createElement('button');
    const locked = i > unlocked;
    btn.className = 'overlay__btn overlay__btn--small';
    btn.textContent = (locked ? '🔒 ' : '') + m.label;
    if (locked) {
      btn.disabled = true; btn.style.opacity = '0.45';
    } else if (i === currentMapIdx) {
      btn.style.borderColor = 'var(--neon-yellow)';
      btn.style.color = 'var(--neon-yellow)';
    }
    btn.addEventListener('click', () => {
      if (locked) return;
      currentMapIdx = i;
      runMeta.lastMap = i;
      _saveMeta();
      _renderMapPicker();
      const hint = document.getElementById('mart-map-hint');
      if (hint) hint.textContent = `Goal: $${m.goalHaul} · ${m.rows}×${m.cols} grid`;
    });
    root.appendChild(btn);
  });
  const hint = document.getElementById('mart-map-hint');
  if (hint) {
    const m = MAPS[currentMapIdx];
    hint.textContent = `Goal: $${m.goalHaul} · ${m.rows}×${m.cols} grid · Clear it to unlock the next`;
  }
}
_renderMapPicker();
