// PUG DUNGEON DIGGERS — dig through tiles, find treasure, upgrade.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showOrientationHint } from '../../src/shared/orientationHint.js';
import { showGradeCard } from '../../src/shared/gradeCard.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';

// --- Custom plush toy icon (library has no plushie) ---------------------------
function drawPlushToy(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // teddy bear silhouette - body
  ctx.fillStyle = '#a0683a';
  ctx.fillRect(-4 * s, -2 * s, 8 * s, 6 * s);
  // head
  ctx.fillRect(-3 * s, -6 * s, 6 * s, 4 * s);
  // ears
  ctx.fillRect(-4 * s, -7 * s, 2 * s, 2 * s);
  ctx.fillRect( 2 * s, -7 * s, 2 * s, 2 * s);
  // arms
  ctx.fillRect(-5 * s, -1 * s, 1 * s, 3 * s);
  ctx.fillRect( 4 * s, -1 * s, 1 * s, 3 * s);
  // legs
  ctx.fillRect(-3 * s,  4 * s, 2 * s, 2 * s);
  ctx.fillRect( 1 * s,  4 * s, 2 * s, 2 * s);
  // ear inner & belly tan
  ctx.fillStyle = '#d8a06a';
  ctx.fillRect(-3 * s, -6 * s, 1 * s, 1 * s);
  ctx.fillRect( 2 * s, -6 * s, 1 * s, 1 * s);
  ctx.fillRect(-2 * s,  0 * s, 4 * s, 3 * s);
  // eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(-2 * s, -5 * s, 1 * s, 1 * s);
  ctx.fillRect( 1 * s, -5 * s, 1 * s, 1 * s);
  // nose
  ctx.fillRect(-1 * s, -3 * s, 2 * s, 1 * s);
  ctx.restore();
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'diggers:muted' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'dungeon-diggers', getControlsHelp: () => _isTouch
  ? 'JOYSTICK dig · BEAM button to place wooden beams · return to surface to spend $. Saved to your profile.'
  : 'WASD dig · B = place wooden beam (blocks cave-ins) · return to surface to spend $. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
const TILE = 36;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const TILE_TYPES = {
  air:    { color: null, val: 0, stam: 0 },
  dirt:   { color: '#6b3a1c', shade: '#4a2a0c', val: 0, stam: 1 },
  stone:  { color: '#5a5a72', shade: '#3a3a4a', val: 0, stam: 2 },
  cheese: { color: '#ffd23f', shade: '#c89c20', val: 0, stam: 2, biome: true },
  bone:   { isLoot: true, drawIconFn: drawIcon.bone,    val: 15,  stam: 1 },
  toy:    { isLoot: true, drawIconFn: drawPlushToy,     val: 25,  stam: 1 },
  gold:   { isLoot: true, drawIconFn: drawIcon.gold,    val: 50,  stam: 2 },
  biscuit:{ isLoot: true, drawIconFn: drawIcon.biscuit, val: 100, stam: 3, golden: true },
  gem:    { isLoot: true, drawIconFn: drawIcon.gem,     val: 60,  stam: 2 },
};

let cols, rows = 0;
let grid = []; // [row][col] = type
let wallDecor = []; // [row][col] decorative overlay per wall tile: 'pickaxe' | 'skull' | null
let pug, money, depth, stam, maxStam, bag, maxBag, drillSpeed, drillCd;
let upgrades, running;
let particles = []; // dig dust + ambient
let popups = [];
let supports = []; // {row, col} placements of decorative support beams
let cartTracks = []; // {row} horizontal rail rows
let crystalPockets = []; // {row, col, n}
let beams = []; // {row, col} player-placed beams that block cave-ins above
let supervisor = null; // surface pug walking back and forth
// SHOPKEEPER NPCS — 3 per run, each in a carved open chamber at fixed depths.
// Walk into the shopkeeper → opens a modal with 2 items + STEAL. STEAL toggles
// `ragedShopkeeper` (global hunter) — he then chases the player across all
// remaining layers at high speed dealing massive damage.
// shopkeeper: { row, col, baseCol, baseRow, x, y, dir, t, mode:'shop'|'hunt', sold:[], hp, alive, anger:0..1 }
let shopkeepers = [];
let ragedShopkeeper = null; // active hunter (clone of one of shopkeepers when STEAL fires)
let shopOpenWith = null;    // shopkeeper currently in modal
let shopTouchCd = 0;        // brief cooldown after closing modal so we don't re-open
let shakeT = 0, shakeAmp = 0;
let surfaceCelebT = 0;     // rays/light burst on surface arrival with loot
let lastPickup = 0;        // dollar haul to flash since last surface
let biomeBannerT = 0;      // banner fades over biomeBannerLife seconds
let biomeBannerText = '';
let biomeBannerColor = '#ffd23f';
let cheeseBiomeEntered = false; // once-per-run flag
// Beam construction + cave-in
const MAX_BEAMS = 5;
let beamsLeft = MAX_BEAMS;
let caveInT = 0;           // timer until next cave-in event
let caveInBlocks = [];     // {x, y, vy, life, hit} animated falling block
// Spelunky-style cracked walls (5% of solid tiles) — digging through reveals a
// bonus chamber with an extra loot or a stam-restoring "heart" tile.
const CRACK_CHANCE = 0.05;
let crackedSet = null; // Set<"r,c"> for fast lookup; null when uninitialized
function isCracked(r, c) { return crackedSet && crackedSet.has(r + ',' + c); }
function unmarkCracked(r, c) { if (crackedSet) crackedSet.delete(r + ',' + c); }
// Downwell-style dig combo meter — increments per consecutive dig within 1.5s
// of the previous; resets on damage or idle. Milestones at x5/x10/x20 drop
// bonus loot at the player's tile.
const COMBO_WINDOW = 1.5;
let combo = 0;
let comboTimer = 0;     // seconds since last dig; resets combo when > COMBO_WINDOW
let comboBannerT = 0;   // big banner pop on milestone
let comboBannerText = '';
const COMBO_MILESTONES = new Set([5, 10, 20]);
function resetCombo() { combo = 0; comboTimer = 0; }
function bumpCombo(worldX, worldY) {
  // If too long since last dig, restart at 1; else increment
  if (comboTimer > COMBO_WINDOW) combo = 1;
  else combo += 1;
  comboTimer = 0;
  if (COMBO_MILESTONES.has(combo)) {
    // Bonus loot: scale value with milestone (5→25, 10→60, 20→150)
    const valByCombo = { 5: 25, 10: 60, 20: 150 };
    const v = valByCombo[combo] || 0;
    money += v; lastPickup += v;
    popup(worldX, worldY - 18, '×' + combo + ' BONUS +$' + v, '#ffd23f');
    comboBannerText = 'COMBO ×' + combo + '!';
    comboBannerT = 1.4;
    sfx.tone(880, 'triangle', 0.12, 0.22);
    sfx.tone(1320, 'triangle', 0.1, 0.18);
    shake(4, 0.18);
  }
}
function shake(amp, dur) { const k = _shakeMul(); shakeAmp = Math.max(shakeAmp, amp * k); shakeT = Math.max(shakeT, dur); }
function popup(x, y, text, color) {
  if (popups.length > 24) popups.shift();
  // Round 2C: lateral spawn velocity so popups don't stack & feel snappier
  popups.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -55, text, color: color || '#ffd23f', life: 1.0, t: 0 });
}
function spawnDust(x, y, color, n) {
  for (let i = 0; i < (n || 6); i++) {
    if (particles.length > 180) break;
    const ang = Math.random() * Math.PI * 2;
    const sp = 30 + Math.random() * 90;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 20, gy: 140, color, life: 0.45 + Math.random() * 0.25, t: 0, size: 2 + Math.random() * 2 });
  }
}
// Round 2C: rectangular block shards — larger pixel chunks that tumble outward
// when a wall is dug. Differs from dust by size (4-7px) + slower fade for more
// "satisfying break-apart" read.
function spawnShards(x, y, color, n) {
  for (let i = 0; i < (n || 6); i++) {
    if (particles.length > 200) break;
    const ang = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 140;
    particles.push({
      x, y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
      gy: 280, color,
      life: 0.55 + Math.random() * 0.35, t: 0,
      size: 4 + Math.random() * 4,
    });
  }
}
function spawnAmbient(camY) {
  // light, slow falling dust above the player
  if (particles.length > 160) return;
  if (Math.random() > 0.6) return;
  const x = Math.random() * W;
  const y = camY + Math.random() * H * 0.5;
  particles.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: 8 + Math.random() * 18, gy: 0, color: 'rgba(220,200,160,0.5)', life: 2.2, t: 0, size: 1 + Math.random() * 1.5, ambient: true });
}

const UPGRADES = [
  { id: 'bag', name: 'Bigger Backpack', cost: 50, max: 5, apply: () => maxBag += 5 },
  { id: 'stam', name: 'Energy Drink', cost: 80, max: 5, apply: () => maxStam += 30 },
  { id: 'drill', name: 'Drill Speed', cost: 120, max: 3, apply: () => drillSpeed *= 1.3 },
  { id: 'helmet', name: 'Hard Hat', cost: 200, max: 2, apply: () => { /* reduces stone cost */ } },
];

// Cheese Caverns biome boundary — below this row, world generation changes.
const CHEESE_DEPTH_ROW = 50;
function reset() {
  cols = Math.max(8, Math.floor(W / TILE));
  rows = 80; // extended to make room for cheese caverns + vault
  grid = Array.from({ length: rows }, () => Array(cols).fill('air'));
  // Surface row = air. Row 1 = ground level. Below = dirt/stone with treasures.
  for (let r = 2; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rand = Math.random();
      const depthFactor = r / rows;
      if (r >= CHEESE_DEPTH_ROW) {
        // Cheese Caverns: sparser walls (open caves), cheese-heavy, lots of gold + biscuit
        if (rand < 0.55) { grid[r][c] = 'air'; continue; } // wide open caverns
        if (rand < 0.62) grid[r][c] = 'gold';
        else if (rand < 0.68) grid[r][c] = 'biscuit';
        else if (rand < 0.74) grid[r][c] = 'gem';
        else grid[r][c] = 'cheese';
      } else if (rand < 0.02 + depthFactor * 0.03) {
        grid[r][c] = depthFactor < 0.4 ? 'bone' : 'gold';
      } else if (rand < 0.04 + depthFactor * 0.02) {
        grid[r][c] = 'toy';
      } else if (rand < 0.06 && r > 20) {
        grid[r][c] = 'gem';
      } else if (rand < 0.07 && r > 35) {
        grid[r][c] = 'biscuit';
      } else if (r > 40 && Math.random() < 0.3) {
        grid[r][c] = 'cheese';
      } else if (r > 8 && Math.random() < 0.4) {
        grid[r][c] = 'stone';
      } else {
        grid[r][c] = 'dirt';
      }
    }
  }
  // CHEESE VAULT — enclosed chamber at the deepest 3 rows packed with biscuits + gold.
  const vaultR = rows - 3;
  const vaultCols = Math.min(cols, 7);
  const vaultStartC = Math.max(0, Math.floor((cols - vaultCols) / 2));
  for (let dr = -1; dr <= 2; dr++) {
    for (let dc = -1; dc <= vaultCols; dc++) {
      const r = vaultR + dr, c = vaultStartC + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      // wall border around vault, opening on top
      const isBorder = dr === -1 || dr === 2 || dc === -1 || dc === vaultCols;
      const isTopOpening = dr === -1 && dc === Math.floor(vaultCols / 2);
      if (isTopOpening) grid[r][c] = 'air';
      else if (isBorder) grid[r][c] = 'cheese';
      else {
        // Fill chamber with biscuits + gold, mostly biscuits
        const rr = Math.random();
        grid[r][c] = rr < 0.55 ? 'biscuit' : (rr < 0.85 ? 'gold' : 'gem');
      }
    }
  }
  pug = { col: Math.floor(cols / 2), row: 1, x: 0, y: 0 };
  syncXY();
  money = 0; depth = 0; bag = 0;
  maxStam = 100; stam = maxStam; maxBag = 10;
  drillSpeed = 1; drillCd = 0;
  upgrades = { bag: 0, stam: 0, drill: 0, helmet: 0 };
  particles = []; popups = []; supports = [];
  shakeT = 0; shakeAmp = 0; surfaceCelebT = 0; lastPickup = 0;
  biomeBannerT = 0; biomeBannerText = ''; cheeseBiomeEntered = false;
  beams = []; beamsLeft = MAX_BEAMS;
  caveInT = 30; caveInBlocks = [];
  // Roll cracked walls: 5% of all dirt/stone tiles. Excludes loot tiles + air
  // so crack overlays only ever render on solid wall tiles.
  crackedSet = new Set();
  for (let r = 2; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if ((t === 'dirt' || t === 'stone') && Math.random() < CRACK_CHANCE) {
        crackedSet.add(r + ',' + c);
      }
    }
  }
  resetCombo(); comboBannerT = 0; comboBannerText = '';
  lanternT = 0; amuletCharges = 0;
  // Pre-place decorative support beams every ~5 rows along the side walls
  for (let r = 5; r < rows; r += 5) {
    supports.push({ row: r, col: 0 });
    supports.push({ row: r, col: cols - 1 });
  }
  // Mining cart tracks (decorative) — every ~8 rows in dirt sections (rows 6..48)
  cartTracks = [];
  for (let r = 10; r < CHEESE_DEPTH_ROW; r += 8) cartTracks.push({ row: r });
  // Crystal pockets in cheese caverns — sprinkle 6 clusters
  crystalPockets = [];
  for (let i = 0; i < 6; i++) {
    const r = CHEESE_DEPTH_ROW + 4 + Math.floor(Math.random() * (rows - CHEESE_DEPTH_ROW - 8));
    const c = Math.floor(Math.random() * cols);
    crystalPockets.push({ row: r, col: c, n: 3 + Math.floor(Math.random() * 3), seed: Math.random() });
  }
  // Wall decor — broken pickaxes (1/80) + skull remains in deep rows (>30, sparse)
  wallDecor = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let r = 2; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === 'dirt' || t === 'stone') {
        if (Math.random() < 1 / 80) wallDecor[r][c] = 'pickaxe';
        else if (r > 30 && Math.random() < 1 / 120) wallDecor[r][c] = 'skull';
      }
    }
  }
  // Surface supervisor pug (walks back and forth on row 0)
  supervisor = { x: cols * TILE * 0.3, dir: 1, t: 0 };
  // SHOPKEEPERS — 3 carved chambers at fixed depth bands so players reliably
  // encounter at least one shop on every run. Each shop sells 2 random items
  // + offers STEAL (sets ragedShopkeeper = global hunter pug).
  shopkeepers = [];
  ragedShopkeeper = null;
  shopOpenWith = null;
  shopTouchCd = 0;
  const shopRows = [12, 28, 44];
  for (const sr of shopRows) {
    const sc = Math.floor(cols / 2) + (Math.random() < 0.5 ? -2 : 2);
    // Carve a 5x3 open chamber centered on (sr, sc)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = sr + dr, c = sc + dc;
        if (r < 2 || r >= rows || c < 0 || c >= cols) continue;
        grid[r][c] = 'air';
        if (crackedSet) unmarkCracked(r, c);
      }
    }
    // Pick 2 items for this shop (no duplicates)
    const stock = [];
    const pool = SHOP_ITEMS.slice();
    for (let i = 0; i < 2 && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      stock.push(pool.splice(idx, 1)[0]);
    }
    shopkeepers.push({
      row: sr, col: sc, baseRow: sr, baseCol: sc,
      x: sc * TILE + TILE / 2, y: sr * TILE + TILE / 2,
      mode: 'shop', dir: 1, t: 0, hp: 999, alive: true,
      stock, sold: [],
    });
  }
  renderUpgrades();
  updateBeamsHud();
  document.getElementById('upgrades').style.display = 'none';
}

// 2-item shop catalog. Effects applied immediately on BUY via apply().
const SHOP_ITEMS = [
  { id: 'bag',     name: 'BIGGER BAG',      cost: 80,  desc: '+5 carry slots', apply: () => { maxBag += 5; popup(pug.x, pug.y - 20, '+5 BAG SLOTS', '#5ef38c'); } },
  { id: 'lantern', name: 'PHANTOM LANTERN', cost: 120, desc: 'reveals nearby cracked walls', apply: () => { lanternT = 999999; popup(pug.x, pug.y - 20, 'LANTERN GLOW!', '#ffd23f'); } },
  { id: 'treat',   name: 'DOG TREAT',       cost: 50,  desc: 'restore full stamina',         apply: () => { stam = maxStam; popup(pug.x, pug.y - 20, 'STAM RESTORED', '#5ef38c'); } },
  { id: 'beams',   name: 'BEAM PACK',       cost: 60,  desc: '+5 wooden beams',              apply: () => { beamsLeft = Math.min(MAX_BEAMS + 5, beamsLeft + 5); updateBeamsHud(); popup(pug.x, pug.y - 20, '+5 BEAMS', '#5ef38c'); } },
  { id: 'amulet',  name: 'CAVE-IN AMULET',  cost: 150, desc: 'next cave-in is dodged',       apply: () => { amuletCharges = (amuletCharges || 0) + 1; popup(pug.x, pug.y - 20, 'AMULET +1', '#b055ff'); } },
  { id: 'pickaxe', name: 'STEEL PICKAXE',   cost: 130, desc: '+30% drill speed',             apply: () => { drillSpeed *= 1.3; popup(pug.x, pug.y - 20, 'DRILL +30%', '#ffd23f'); } },
];
let lanternT = 0;        // when > 0, cracked-wall pulse is brighter + glows
let amuletCharges = 0;   // each charge auto-dodges next cave-in hit

function openShop(sk) {
  shopOpenWith = sk;
  const modal = document.getElementById('shop-modal');
  const itemsEl = document.getElementById('shop-items');
  const greetEl = document.getElementById('shop-greet');
  if (!modal || !itemsEl) return;
  greetEl.textContent = 'Welcome, friend! Take a look:';
  itemsEl.innerHTML = '';
  for (const item of sk.stock) {
    const row = document.createElement('button');
    const sold = sk.sold.includes(item.id);
    const canAfford = money >= item.cost;
    row.type = 'button';
    row.disabled = sold || !canAfford;
    row.style.cssText = `background:rgba(0,0,0,0.4);border:2px solid ${sold ? '#5a5a5a' : (canAfford ? '#5ef38c' : '#ff5a5a')};color:#fff;font-family:var(--font-display);font-size:0.45rem;padding:10px;border-radius:6px;cursor:${sold ? 'not-allowed' : 'pointer'};letter-spacing:0.05em;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:10px;opacity:${sold ? 0.4 : 1};`;
    row.innerHTML = `<div><div style="color:#ffd23f;">${item.name}</div><div style="color:#cacacf;margin-top:2px;font-size:0.4rem;">${item.desc}</div></div><div style="color:${canAfford ? '#5ef38c' : '#ff5a5a'};">${sold ? 'SOLD' : '$' + item.cost}</div>`;
    row.addEventListener('click', () => {
      if (sold || money < item.cost) return;
      money -= item.cost;
      sk.sold.push(item.id);
      item.apply();
      sfx.arp([523, 784, 1047], 'triangle', 0.06, 0.18, 0.12);
      closeShop();
      updateHud();
    });
    itemsEl.appendChild(row);
  }
  modal.hidden = false;
  document.body.classList.add('wg-modal-open'); // lock background scroll on iOS
}
function closeShop() {
  shopOpenWith = null;
  const modal = document.getElementById('shop-modal');
  if (modal) modal.hidden = true;
  document.body.classList.remove('wg-modal-open');
  shopTouchCd = 0.8; // brief grace so we don't re-trigger immediately
}
function stealFromShop(sk) {
  if (!sk) return;
  // Spawn raged hunter at shopkeeper's location
  ragedShopkeeper = {
    x: sk.x, y: sk.y, row: sk.row, col: sk.col,
    vx: 0, vy: 0, dmgCd: 0, anger: 1.0, t: 0,
  };
  sk.alive = false;
  // Player grabs the unsold inventory for free
  let snagged = 0;
  for (const item of sk.stock) {
    if (!sk.sold.includes(item.id)) { item.apply(); snagged++; }
  }
  popup(pug.x, pug.y - 30, '💀 SHOPKEEPER ENRAGED!', '#ff3a3a');
  popup(pug.x, pug.y - 50, `STOLE ${snagged} ITEM${snagged !== 1 ? 'S' : ''}`, '#ffd23f');
  shake(8, 0.5);
  sfx.sweep(880, 110, 'sawtooth', 0.5, 0.3);
  sfx.tone(220, 'sawtooth', 0.3, 0.25);
  closeShop();
}
// Wire shop modal buttons (once)
const shopCloseBtn = document.getElementById('shop-close');
const shopStealBtn = document.getElementById('shop-steal');
if (shopCloseBtn) shopCloseBtn.addEventListener('click', closeShop);
if (shopStealBtn) shopStealBtn.addEventListener('click', () => stealFromShop(shopOpenWith));
function syncXY() { pug.x = pug.col * TILE + TILE / 2; pug.y = pug.row * TILE + TILE / 2; }

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if ((e.key === 'b' || e.key === 'B') && !e.repeat) placeBeam();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
function placeBeam() {
  if (!running) return;
  if (beamsLeft <= 0) { popup(pug.x, pug.y - 24, 'NO BEAMS', '#ff3a3a'); sfx.tone(220, 'sawtooth', 0.08, 0.18); return; }
  if (stam < 1 || money < 5) { popup(pug.x, pug.y - 24, 'NEED $5+1 STAM', '#ff3a3a'); sfx.tone(220, 'sawtooth', 0.08, 0.18); return; }
  // Can't place at surface row
  if (pug.row <= 1) { popup(pug.x, pug.y - 24, 'NOT HERE', '#ff3a3a'); return; }
  // Don't double-place at same row
  if (beams.some((b) => b.row === pug.row)) { popup(pug.x, pug.y - 24, 'EXISTS', '#ff3a3a'); return; }
  beams.push({ row: pug.row, col: pug.col });
  beamsLeft--; stam -= 1; money -= 5;
  spawnDust(pug.x, pug.y, '#8a5a2c', 6);
  sfx.tone(440, 'square', 0.08, 0.20);
  popup(pug.x, pug.y - 24, 'BEAM!', '#ffd23f');
  updateBeamsHud();
  updateHud();
}
function updateBeamsHud() {
  const el = document.getElementById('hud-beams');
  if (el) el.textContent = `${beamsLeft}/${MAX_BEAMS}`;
}
const beamBtnEl = document.getElementById('beam-btn');
if (beamBtnEl) {
  beamBtnEl.addEventListener('click', placeBeam);
  if ('ontouchstart' in window) beamBtnEl.style.display = 'block';
}
// Universal mobile controls — D-pad to move grid + BEAM action button. Tile
// movement reads `keys` which is mutated by synth keydown/keyup events.
createMobileControls({
  layout: 'dpad-buttons',
  keys,
  buttons: [
    { id: 'beam', label: 'BEAM', key: 'B' },
  ],
});
// Grid-mining is much more readable in landscape on phones.
showOrientationHint({ gameId: 'dungeon-diggers' });
let touchAt = null;
canvas.addEventListener('touchstart', (e) => { touchAt = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAt = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAt = null);

let moveT = 0;
const MOVE_COOLDOWN = 0.14;

function tryMove(dc, dr) {
  if (drillCd > 0) return;
  const nc = pug.col + dc, nr = pug.row + dr;
  if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return;
  const t = grid[nr][nc];
  if (t === 'air') {
    pug.col = nc; pug.row = nr;
    syncXY();
    drillCd = MOVE_COOLDOWN / drillSpeed;
  } else {
    // Dig
    const info = TILE_TYPES[t];
    const tileX = nc * TILE + TILE / 2;
    const tileY = nr * TILE + TILE / 2;
    // Compute stam cost up-front so we can bail before any feedback fires.
    let cost = info.stam;
    if (t === 'stone' && upgrades.helmet > 0) cost = Math.max(1, cost - upgrades.helmet);
    if (stam < cost) {
      popup(tileX, tileY - 8, 'TOO TIRED', '#ff3a3a');
      sfx.tone(220, 'sawtooth', 0.06, 0.15);
      return;
    }
    if (info.isLoot) {
      // Treasure
      if (bag < maxBag) {
        bag++;
        money += info.val;
        lastPickup += info.val;
        popup(tileX, tileY - 8, '+$' + info.val, info.golden ? '#ffd23f' : '#5ef38c');
        sfx.tone(880, 'triangle', 0.1, 0.22);
        spawnDust(tileX, tileY, info.golden ? '#ffd23f' : '#fffbe6', 10);
      } else {
        popup(tileX, tileY - 8, 'BAG FULL', '#ff3a3a');
        sfx.tone(220, 'sawtooth', 0.1, 0.2); // bag full
        return;
      }
    } else {
      sfx.tone(330, 'square', 0.05, 0.15);
      const dustC = t === 'stone' ? '#8a8aa0' : (t === 'cheese' ? '#ffd23f' : '#8a5a2c');
      spawnDust(tileX, tileY, dustC, 6 + Math.floor(nr / 12));
      // Round 2C: block-shatter shards on wall break — stone/cheese throw
      // bigger chunks since they're tougher
      const shardN = t === 'stone' ? 5 : (t === 'cheese' ? 4 : 3);
      const shardC = t === 'stone' ? '#5a5a72' : (t === 'cheese' ? '#c89c20' : '#4a2a0c');
      spawnShards(tileX, tileY, shardC, shardN);
    }
    stam -= cost;
    grid[nr][nc] = 'air';
    // CRACKED wall reveal — opens a 3-wide x 2-tall bonus chamber around the
    // broken tile and seeds 1 guaranteed loot tile inside (gem or biscuit).
    if (isCracked(nr, nc)) {
      unmarkCracked(nr, nc);
      const lootChoices = ['gem', 'gem', 'biscuit', 'gold'];
      const seeded = lootChoices[Math.floor(Math.random() * lootChoices.length)];
      let placedLoot = false;
      for (let rr = nr - 1; rr <= nr + 1; rr++) {
        for (let cc = nc - 1; cc <= nc + 1; cc++) {
          if (rr < 2 || rr >= rows || cc < 0 || cc >= cols) continue;
          if (rr === nr && cc === nc) continue;
          const cur = grid[rr][cc];
          if (cur === 'air') continue;
          // First slot becomes the loot; rest become air (the chamber)
          if (!placedLoot && cur !== 'cheese') {
            grid[rr][cc] = seeded;
            placedLoot = true;
          } else {
            grid[rr][cc] = 'air';
          }
          // Strip any crack on cells we opened/changed
          unmarkCracked(rr, cc);
        }
      }
      popup(tileX, tileY - 20, '☆ BONUS ROOM ☆', '#ffd23f');
      // Round 2C: bigger shake + extra burst + brief electric arc visual flash
      // (rendered via spark particles emanating from break point).
      shake(7, 0.32);
      sfx.arp([523, 659, 784, 1047], 'triangle', 0.06, 0.2, 0.12);
      spawnDust(tileX, tileY, '#ffd23f', 18);
      spawnShards(tileX, tileY, '#ffd23f', 8);
      // Electric arc — fast bright particles snake outward (high speed, low life)
      for (let i = 0; i < 10; i++) {
        if (particles.length > 200) break;
        const ang = (i / 10) * Math.PI * 2;
        const sp = 220 + Math.random() * 120;
        particles.push({
          x: tileX, y: tileY,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          gy: 0, color: '#fff8e0',
          life: 0.22, t: 0, size: 2.5,
        });
      }
    }
    pug.col = nc; pug.row = nr;
    syncXY();
    drillCd = MOVE_COOLDOWN / drillSpeed;
    // shake more for deep / stone / cheese
    const deep = nr / rows;
    if (t === 'stone' || t === 'cheese' || deep > 0.5) shake(2 + deep * 4, 0.18);
    // Downwell combo: any successful dig (loot picked OR wall broken) counts.
    // Walking through pre-existing air does NOT.
    bumpCombo(pug.x, pug.y);
  }
  if (pug.row > depth) depth = pug.row;
  // First entry into Cheese Caverns — banner + celebration shake
  if (!cheeseBiomeEntered && pug.row >= CHEESE_DEPTH_ROW) {
    cheeseBiomeEntered = true;
    biomeBannerText = '★ CHEESE CAVERNS ★';
    biomeBannerColor = '#ffd23f';
    biomeBannerT = 2.4;
    shake(6, 0.4);
    sfx.tone(440, 'triangle', 0.18, 0.22);
    sfx.tone(660, 'triangle', 0.18, 0.22);
    sfx.tone(880, 'triangle', 0.25, 0.18);
  }
  // surface refill
  if (pug.row <= 1) {
    money += bag * 0; // already counted on pickup
    if (lastPickup > 0) {
      surfaceCelebT = 1.6;
      popup(pug.x, pug.y - 30, 'DEPOSIT +$' + lastPickup, '#ffd23f');
      lastPickup = 0;
    }
    bag = 0;
    stam = maxStam;
    document.getElementById('upgrades').style.display = 'block';
  } else {
    document.getElementById('upgrades').style.display = 'none';
  }
  if (stam <= 0 && running) { running = false; end(); }
  updateHud();
}

function renderUpgrades() {
  const e = document.getElementById('upg-buttons');
  e.innerHTML = '';
  for (const u of UPGRADES) {
    const lvl = upgrades[u.id];
    const next = u.cost * (lvl + 1);
    const btn = document.createElement('button');
    btn.style.cssText = `background:rgba(0,0,0,0.4);color:var(--text);border:2px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--font-display);font-size:0.45rem;cursor:pointer;`;
    btn.innerHTML = `${u.name}<br>Lv ${lvl}/${u.max} — $${next}`;
    if (lvl >= u.max) { btn.disabled = true; btn.style.opacity = 0.4; btn.innerHTML = `${u.name}<br>MAX`; }
    else if (money < next) { btn.disabled = true; btn.style.opacity = 0.5; }
    btn.addEventListener('click', () => {
      if (money < next || lvl >= u.max) return;
      money -= next;
      upgrades[u.id]++;
      u.apply();
      sfx.tone(660, 'triangle', 0.1, 0.22);
      renderUpgrades();
      updateHud();
    });
    e.appendChild(btn);
  }
}

function tick(dt) {
  if (!running) return;
  if (shopOpenWith) return; // pause world while shop modal is open
  drillCd = Math.max(0, drillCd - dt);
  moveT += dt;
  // Shopkeeper proximity → open shop if not already open.
  if (shopTouchCd > 0) shopTouchCd = Math.max(0, shopTouchCd - dt);
  for (const sk of shopkeepers) {
    if (!sk.alive) continue;
    sk.t += dt;
    // gentle idle bob (no movement — they stand by their stock)
    const d = Math.hypot(sk.x - pug.x, sk.y - pug.y);
    if (d < TILE * 1.4 && !shopOpenWith && shopTouchCd <= 0 && !ragedShopkeeper) {
      openShop(sk);
      break;
    }
  }
  // RAGED HUNTER — chases player at high speed, deals massive damage on touch
  if (ragedShopkeeper) {
    const rh = ragedShopkeeper;
    rh.t += dt; rh.dmgCd = Math.max(0, rh.dmgCd - dt);
    const dx = pug.x - rh.x, dy = pug.y - rh.y;
    const d = Math.hypot(dx, dy);
    // Phasing through walls — pure chase. Speed = 200 px/s (player moves
    // grid-step so this is faster than a casual digger).
    const SPEED = 200;
    if (d > 0.001) {
      rh.x += (dx / d) * SPEED * dt;
      rh.y += (dy / d) * SPEED * dt;
    }
    // On contact: massive stam damage every 0.7s
    if (d < TILE * 0.7 && rh.dmgCd <= 0) {
      if (amuletCharges > 0) {
        amuletCharges--;
        popup(pug.x, pug.y - 26, 'AMULET BLOCKED!', '#b055ff');
        sfx.tone(880, 'triangle', 0.15, 0.22);
        // knock the hunter back briefly
        rh.x -= (dx / d) * TILE * 1.5;
        rh.y -= (dy / d) * TILE * 1.5;
        rh.dmgCd = 1.0;
      } else {
        const dmg = maxStam * 0.40;
        stam = Math.max(0, stam - dmg);
        rh.dmgCd = 0.7;
        popup(pug.x, pug.y - 26, 'SHOPKEEPER MAULS! -40%', '#ff3a3a');
        shake(9, 0.35);
        sfx.sweep(440, 110, 'sawtooth', 0.25, 0.25);
        resetCombo();
        if (stam <= 0 && running) { running = false; setTimeout(end, 50); return; }
      }
    }
  }
  // Combo idle decay — when no dig within COMBO_WINDOW seconds, reset.
  if (combo > 0) {
    comboTimer += dt;
    if (comboTimer > COMBO_WINDOW) resetCombo();
  }
  if (comboBannerT > 0) comboBannerT = Math.max(0, comboBannerT - dt);
  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.gy || 0) * dt;
    if (!p.ambient) { p.vx *= 0.92; p.vy *= 0.96; }
    if (p.t >= p.life) particles.splice(i, 1);
  }
  // popups
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt; p.y += p.vy * dt; p.vy *= 0.92;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 0.88; }
    if (p.t >= p.life) popups.splice(i, 1);
  }
  shakeT = Math.max(0, shakeT - dt); if (shakeT === 0) shakeAmp = 0;
  surfaceCelebT = Math.max(0, surfaceCelebT - dt);
  biomeBannerT = Math.max(0, biomeBannerT - dt);
  // ambient dust falling near the player
  spawnAmbient(pug.y - H / 2);
  // Supervisor pug pacing on surface
  if (supervisor) {
    supervisor.t += dt;
    supervisor.x += supervisor.dir * 28 * dt;
    if (supervisor.x < 30 || supervisor.x > cols * TILE - 30) supervisor.dir *= -1;
  }
  // CAVE-IN events — only when player is underground
  if (pug.row > 2) {
    caveInT -= dt;
    if (caveInT <= 0) {
      caveInT = 28 + Math.random() * 6;
      // Find an air cell 2-4 rows above the player
      const offset = 2 + Math.floor(Math.random() * 3);
      const targetR = pug.row - offset;
      if (targetR >= 2 && targetR < rows) {
        // Pick a column near the player
        const candidateCols = [];
        for (let c = Math.max(0, pug.col - 2); c <= Math.min(cols - 1, pug.col + 2); c++) {
          if (grid[targetR][c] === 'air') candidateCols.push(c);
        }
        if (candidateCols.length > 0) {
          const c = candidateCols[Math.floor(Math.random() * candidateCols.length)];
          // Check if any beam exists between targetR (exclusive) and player row (exclusive)
          const blocked = beams.some((b) => b.row > targetR && b.row < pug.row && Math.abs(b.col - c) <= Math.floor(cols / 2));
          caveInBlocks.push({
            col: c, fromR: targetR, toR: pug.row,
            x: c * TILE + TILE / 2, y: targetR * TILE + TILE / 2,
            vy: 280, blocked, hit: false,
          });
          shake(3, 0.3);
          sfx.tone(140, 'square', 0.18, 0.16);
          spawnDust(c * TILE + TILE / 2, targetR * TILE + TILE / 2, '#6a4a28', 8);
          popup(c * TILE + TILE / 2, targetR * TILE - 14, 'CAVE-IN!', '#ff5a3a');
        }
      }
    }
  }
  // Update cave-in falling blocks
  for (let i = caveInBlocks.length - 1; i >= 0; i--) {
    const b = caveInBlocks[i];
    b.y += b.vy * dt;
    b.vy += 320 * dt;
    // Stop when hits a beam row OR player row OR floor of caveIn target
    const stopRow = b.blocked ? beams.find((bm) => bm.row > b.fromR && bm.row < b.toR)?.row || b.toR : b.toR;
    const stopY = stopRow * TILE + TILE / 2 - 6;
    if (b.y >= stopY) {
      // Landed
      // Round 2C: bigger debris on cave-in landing — dust + shards + harder shake
      spawnDust(b.x, stopY, '#6a4a28', 16);
      spawnShards(b.x, stopY, '#5a3a1c', 8);
      shake(6, 0.28);
      if (!b.blocked && !b.hit && Math.abs(b.x - pug.x) < TILE * 0.6 && Math.abs(stopY - pug.y) < TILE) {
        if (amuletCharges > 0) {
          // AMULET dodges the hit
          amuletCharges--;
          b.hit = true;
          popup(pug.x, pug.y - 26, 'AMULET DODGED!', '#b055ff');
          shake(4, 0.18);
          sfx.tone(880, 'triangle', 0.15, 0.22);
        } else {
          // Hit the player
          const dmg = maxStam * 0.25;
          stam = Math.max(0, stam - dmg);
          b.hit = true;
          popup(pug.x, pug.y - 26, 'CRUSH! -25%', '#ff3a3a');
          shake(7, 0.35);
          sfx.tone(110, 'sawtooth', 0.2, 0.22);
          // Combo break on damage (Downwell rule)
          resetCombo();
          if (stam <= 0 && running) { running = false; setTimeout(end, 50); }
        }
      } else if (b.blocked) {
        popup(b.x, stopY - 14, 'BLOCKED!', '#5ef38c');
      }
      caveInBlocks.splice(i, 1);
    }
  }
  if (drillCd > 0) return;
  let dc = 0, dr = 0;
  if (keys.has('w') || keys.has('arrowup')) dr -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dr += 1;
  if (keys.has('a') || keys.has('arrowleft')) dc -= 1;
  if (keys.has('d') || keys.has('arrowright')) dc += 1;
  if (touchAt) {
    const dx = touchAt.clientX - W / 2;
    const dy = touchAt.clientY - H / 2;
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 30 ? 1 : (dx < -30 ? -1 : 0);
    else dr = dy > 30 ? 1 : (dy < -30 ? -1 : 0);
  }
  if (dc !== 0 && dr !== 0) { if (Math.random() < 0.5) dr = 0; else dc = 0; }
  if (dc || dr) tryMove(dc, dr);
}

function depthTint(r) {
  // Layered geology — three biome bands.
  // 0..0.4: dirt (brown). 0.4..0.7: stone bands (grey-blue). 0.7..1: cheese/lava.
  const f = r / rows;
  if (f < 0.4) return null;
  if (f < 0.7) return `rgba(60,60,90,${0.05 + (f - 0.4) * 0.6})`;
  // lava-warm tint near bottom
  return `rgba(180,60,40,${0.10 + (f - 0.7) * 0.7})`;
}
function render() {
  // background — gradient that shifts with depth (sky -> deep purple -> hellish red)
  const depthFrac = pug.row / rows;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  if (depthFrac < 0.3) { bg.addColorStop(0, '#3a2a5a'); bg.addColorStop(1, '#1a0d2a'); }
  else if (depthFrac < 0.7) { bg.addColorStop(0, '#1a0d2a'); bg.addColorStop(1, '#0a0716'); }
  else { bg.addColorStop(0, '#0a0716'); bg.addColorStop(1, '#2a0a14'); }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // screen-shake offset (applied to world)
  const sxOff = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  const syOff = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;

  // Camera follows pug (centers on it vertically)
  const camY = pug.y - H / 2;
  const camX = 0;
  ctx.save();
  ctx.translate(-camX + sxOff, -camY + syOff);
  // Sky for surface — bright daylight gradient when near top
  const skyTop = -H, skyBot = TILE * 2;
  const sky = ctx.createLinearGradient(0, skyTop, 0, skyBot);
  sky.addColorStop(0, '#7ad6ff');
  sky.addColorStop(0.6, '#aee3ff');
  sky.addColorStop(1, '#ffd9a8');
  ctx.fillStyle = sky; ctx.fillRect(0, skyTop, W, skyBot - skyTop);
  // sun
  ctx.fillStyle = 'rgba(255,240,180,0.9)';
  ctx.beginPath(); ctx.arc(W * 0.78, -H * 0.35, 28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,180,0.2)';
  ctx.beginPath(); ctx.arc(W * 0.78, -H * 0.35, 60, 0, Math.PI * 2); ctx.fill();
  // simple cloud silhouettes
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(W * 0.2, -H * 0.45, 18, 0, Math.PI * 2); ctx.arc(W * 0.25, -H * 0.45, 22, 0, Math.PI * 2); ctx.arc(W * 0.3, -H * 0.45, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.5, -H * 0.55, 14, 0, Math.PI * 2); ctx.arc(W * 0.55, -H * 0.55, 18, 0, Math.PI * 2); ctx.fill();
  // distant grass hills
  ctx.fillStyle = '#3a6a2a';
  ctx.beginPath();
  ctx.moveTo(0, TILE);
  ctx.quadraticCurveTo(W * 0.25, TILE - 24, W * 0.5, TILE - 6);
  ctx.quadraticCurveTo(W * 0.75, TILE - 18, W, TILE);
  ctx.lineTo(W, TILE + 6); ctx.lineTo(0, TILE + 6); ctx.closePath(); ctx.fill();

  // Tiles in viewport
  const rowStart = Math.max(0, Math.floor((camY) / TILE) - 1);
  const rowEnd = Math.min(rows - 1, Math.floor((camY + H) / TILE) + 1);
  for (let r = rowStart; r <= rowEnd; r++) {
    const tint = depthTint(r);
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === 'air') continue;
      const x = c * TILE, y = r * TILE;
      const info = TILE_TYPES[t];
      if (info.isLoot) {
        // Treasure tile = dirt background + pixel icon
        ctx.fillStyle = TILE_TYPES.dirt.color; ctx.fillRect(x, y, TILE, TILE);
        if (tint) { ctx.fillStyle = tint; ctx.fillRect(x, y, TILE, TILE); }
        const ix = x + TILE / 2;
        const iy = y + TILE / 2;
        const isize = TILE - 10;
        if (info.golden) {
          ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
          info.drawIconFn(ctx, ix, iy, isize);
          ctx.shadowBlur = 0;
        } else {
          info.drawIconFn(ctx, ix, iy, isize);
        }
      } else {
        ctx.fillStyle = info.color; ctx.fillRect(x, y, TILE, TILE);
        if (tint && t === 'dirt') { ctx.fillStyle = tint; ctx.fillRect(x, y, TILE, TILE); }
        ctx.fillStyle = info.shade; ctx.fillRect(x, y, TILE, 3);
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
        if (t === 'cheese') {
          // holes
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.arc(x + 10, y + 12, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 24, y + 22, 4, 0, Math.PI * 2); ctx.fill();
        } else if (t === 'stone') {
          // dotted speckle
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(x + 6, y + 8, 2, 2);
          ctx.fillRect(x + 22, y + 18, 2, 2);
        } else if (t === 'dirt') {
          // dirt pebbles
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x + 8, y + 12, 2, 2);
          ctx.fillRect(x + 24, y + 22, 2, 2);
        }
        // CRACKED wall overlay — bright lightning-bolt crack with a faint
        // pulse glow. Tells the player "dig me for a bonus room!".
        if (isCracked(r, c)) {
          const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004 + r + c);
          ctx.save();
          ctx.strokeStyle = `rgba(255,210,63,${0.55 + pulse * 0.35})`;
          ctx.lineWidth = 2;
          ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 4 + pulse * 4;
          ctx.beginPath();
          ctx.moveTo(x + 6,  y + 4);
          ctx.lineTo(x + 14, y + 14);
          ctx.lineTo(x + 10, y + 18);
          ctx.lineTo(x + 22, y + 28);
          ctx.lineTo(x + 30, y + 22);
          ctx.stroke();
          // small forked branch
          ctx.beginPath();
          ctx.moveTo(x + 14, y + 14);
          ctx.lineTo(x + 24, y + 12);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
        // wall decor overlay (broken pickaxe / skeleton remains)
        const deco = wallDecor[r] && wallDecor[r][c];
        if (deco === 'pickaxe') {
          // angled wooden handle + grey blade
          ctx.save();
          ctx.translate(x + TILE / 2, y + TILE / 2);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#5a3a1c';
          ctx.fillRect(-1, -10, 2, 16); // handle
          ctx.fillStyle = '#cacad6';
          ctx.fillRect(-6, -12, 12, 4); // blade
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(-6, -12, 12, 1);
          ctx.restore();
        } else if (deco === 'skull') {
          ctx.fillStyle = 'rgba(240,240,240,0.85)';
          ctx.fillRect(x + 12, y + 14, 12, 10);
          ctx.fillRect(x + 14, y + 22, 8, 4);
          ctx.fillStyle = '#1a0d05';
          ctx.fillRect(x + 14, y + 17, 2, 2);
          ctx.fillRect(x + 20, y + 17, 2, 2);
          ctx.fillRect(x + 17, y + 22, 2, 2);
        }
      }
    }
  }
  // Crystal pockets (cheese caverns) — drawn over their tile clusters
  for (const cp of crystalPockets) {
    const baseX = cp.col * TILE, baseY = cp.row * TILE;
    if (baseY + TILE < camY || baseY > camY + H) continue;
    const cols2 = ['#4cc9f0', '#c062ff', '#5ef38c', '#ff3aa1'];
    const c = cols2[Math.floor(cp.seed * cols2.length)];
    const tNow = performance.now() * 0.001;
    for (let i = 0; i < cp.n; i++) {
      const gx = baseX + 6 + (i * 8) % (TILE - 12);
      const gy = baseY + 8 + (i * 11) % (TILE - 16);
      const pulse = 0.6 + 0.4 * Math.sin(tNow * 3 + i + cp.seed * 6);
      ctx.shadowColor = c; ctx.shadowBlur = 6 * pulse;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(gx + 3, gy);
      ctx.lineTo(gx + 6, gy + 3);
      ctx.lineTo(gx + 3, gy + 8);
      ctx.lineTo(gx, gy + 3);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(gx + 2, gy + 1, 1, 1);
    }
  }
  // Decorative mining cart tracks (only in dirt section)
  for (const tr of cartTracks) {
    const y = tr.row * TILE;
    if (y + TILE < camY || y > camY + H) continue;
    // rails
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(0, y + 12, cols * TILE, 2);
    ctx.fillRect(0, y + 22, cols * TILE, 2);
    // cross-ties
    ctx.fillStyle = '#5a3a1c';
    for (let cx = 0; cx < cols * TILE; cx += 22) {
      ctx.fillRect(cx, y + 10, 6, 16);
    }
    // rust highlight
    ctx.fillStyle = 'rgba(180,90,40,0.4)';
    ctx.fillRect(0, y + 12, cols * TILE, 1);
    ctx.fillRect(0, y + 22, cols * TILE, 1);
  }
  // Player-placed wooden beams (block cave-ins above)
  for (const bm of beams) {
    const y = bm.row * TILE;
    if (y + TILE < camY || y > camY + H) continue;
    ctx.fillStyle = '#8a5a2c';
    ctx.fillRect(0, y - 2, cols * TILE, 7);
    ctx.fillStyle = '#6a3a1c';
    ctx.fillRect(0, y + 5, cols * TILE, 2);
    // wood grain streaks
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let cx = 6; cx < cols * TILE; cx += 18) ctx.fillRect(cx, y + 1, 1, 4);
    // nails (yellow)
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(4, y + 1, 2, 2);
    ctx.fillRect(cols * TILE - 6, y + 1, 2, 2);
  }
  // Falling cave-in blocks (animated dirt cube)
  for (const b of caveInBlocks) {
    ctx.fillStyle = '#6a3a1c';
    ctx.fillRect(b.x - 14, b.y - 14, 28, 28);
    ctx.fillStyle = '#4a2a0c';
    ctx.fillRect(b.x - 14, b.y - 14, 28, 4);
    ctx.fillRect(b.x - 14, b.y + 10, 28, 4);
    // trailing dust
    ctx.fillStyle = 'rgba(120,80,40,0.4)';
    ctx.fillRect(b.x - 18, b.y - 22, 4, 6);
    ctx.fillRect(b.x + 14, b.y - 22, 4, 6);
  }

  // Support beams on the side walls (decorative)
  for (const s of supports) {
    const y = s.row * TILE;
    if (y + TILE < camY || y > camY + H) continue;
    const x = s.col * TILE;
    // beam crossbar
    ctx.fillStyle = '#8a5a2c';
    ctx.fillRect(x, y - 4, TILE, 4);
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(x, y, 6, TILE);
    ctx.fillRect(x + TILE - 6, y, 6, TILE);
    // nails
    ctx.fillStyle = '#cacad6';
    ctx.fillRect(x + 2, y - 3, 2, 2);
    ctx.fillRect(x + TILE - 4, y - 3, 2, 2);
  }

  // Surface ground line (top of dirt)
  ctx.fillStyle = '#2a4a2a';
  ctx.fillRect(0, TILE, W, 6);
  // grass tufts
  ctx.fillStyle = '#5ef38c';
  for (let gx = 8; gx < W; gx += 14) ctx.fillRect(gx, TILE - 2, 2, 4);
  // Supervisor pug (walks back and forth on the surface) — high-detail
  if (supervisor) {
    const sy = TILE - 6;
    const bob = Math.sin(supervisor.t * 6) * 1;
    drawPug(ctx, supervisor.x, sy - 12 + bob, { size: 24, hat: true, hatColor: '#ffd23f' });
    // clipboard
    ctx.fillStyle = '#fff'; ctx.fillRect(supervisor.x - 2, sy - 2 + bob, 5, 6);
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(supervisor.x - 1, sy + bob, 3, 1);
    ctx.fillRect(supervisor.x - 1, sy + 2 + bob, 3, 1);
  }

  // Ambient + dig particles (in world space)
  for (const p of particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }

  // Tunnel-edge shadow vignette around player (only when underground)
  if (pug.row > 2) {
    const radius = TILE * 3.2;
    const grad = ctx.createRadialGradient(pug.x, pug.y, radius * 0.4, pug.x, pug.y, radius * 2.2);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, camY, W, H);
  }

  // Surface celebration — rays of light when reaching top with loot
  if (surfaceCelebT > 0) {
    const a = Math.min(1, surfaceCelebT / 0.7);
    const cx = pug.x, cy = pug.y;
    ctx.save();
    ctx.globalAlpha = a * 0.7;
    ctx.translate(cx, cy);
    const t = (1.6 - surfaceCelebT) * 1.4;
    ctx.rotate(t);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      const grad = ctx.createLinearGradient(0, 0, 0, -180);
      grad.addColorStop(0, 'rgba(255,230,120,0.6)');
      grad.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(2, -180); ctx.lineTo(-2, -180); ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // sparkle particles
    if (surfaceCelebT > 1.0 && Math.random() < 0.4 && particles.length < 180) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 90;
      particles.push({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 30, gy: 100, color: '#ffd23f', life: 0.8, t: 0, size: 3 });
    }
  }

  // Popups (in world space)
  for (const p of popups) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.font = "bold 11px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }

  // SHOPKEEPERS — friendly pugs in carved chambers, surrounded by a small
  // pile of "stock" pixels and a glow halo so the player can spot one even
  // through dense walls.
  for (const sk of shopkeepers) {
    if (!sk.alive) continue;
    const sx = sk.x, sy = sk.y;
    if (sy + TILE < camY || sy > camY + H) continue;
    // glow halo (so players spot the chamber easily)
    const glow = 0.4 + 0.2 * Math.sin(sk.t * 2);
    const grd = ctx.createRadialGradient(sx, sy, 6, sx, sy, 60);
    grd.addColorStop(0, `rgba(255,210,63,${glow})`);
    grd.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(sx, sy, 60, 0, Math.PI * 2); ctx.fill();
    // sack of items behind shopkeeper
    ctx.fillStyle = '#6a4a28';
    ctx.fillRect(sx + 10, sy - 4, 14, 18);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(sx + 10, sy - 4, 14, 4);
    // gold coins poking out
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(sx + 12, sy - 8, 3, 3);
    ctx.fillRect(sx + 18, sy - 7, 3, 3);
    ctx.fillRect(sx + 15, sy - 11, 3, 3);
    // shopkeeper pug
    const bob = Math.sin(sk.t * 2) * 1.5;
    drawPug(ctx, sx, sy + bob, { size: 26, body: '#c8a06a', hat: true, hatColor: '#5ef38c' });
    // "$" sign hovering above
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 12px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8;
    ctx.fillText('$', sx, sy - 22 + bob);
    ctx.shadowBlur = 0;
    // Hint when player is nearby — walk into the shopkeeper to open the shop.
    if (Math.hypot(sx - pug.x, sy - pug.y) < TILE * 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(sx - 52, sy - 50, 104, 14);
      ctx.fillStyle = '#5ef38c';
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('▶ DIG TO SHOP ◀', sx, sy - 40);
    }
  }
  // RAGED HUNTER — glowing-red eyes, fast chaser, phases through walls
  if (ragedShopkeeper) {
    const rh = ragedShopkeeper;
    const pulse = 0.5 + 0.5 * Math.sin(rh.t * 8);
    // angry red aura
    const rg = ctx.createRadialGradient(rh.x, rh.y, 4, rh.x, rh.y, 50);
    rg.addColorStop(0, `rgba(255,58,58,${0.4 + pulse * 0.3})`);
    rg.addColorStop(1, 'rgba(255,58,58,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(rh.x, rh.y, 50, 0, Math.PI * 2); ctx.fill();
    // body
    drawPug(ctx, rh.x, rh.y, { size: 30, body: '#5a1a1a' });
    // glowing red eyes (override the pug face)
    ctx.fillStyle = `rgba(255,58,58,${0.8 + pulse * 0.2})`;
    ctx.fillRect(rh.x - 6, rh.y - 3, 4, 4);
    ctx.fillRect(rh.x + 2, rh.y - 3, 4, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(rh.x - 5, rh.y - 2, 2, 2);
    ctx.fillRect(rh.x + 3, rh.y - 2, 2, 2);
    // exclamation above
    ctx.fillStyle = '#ff3a3a';
    ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 10;
    ctx.fillText('!', rh.x, rh.y - 22);
    ctx.shadowBlur = 0;
  }
  // Pug — high-detail digger with yellow hard hat
  drawPug(ctx, pug.x, pug.y, { size: 30, hat: true, hatColor: '#ffd23f' });
  // helmet headlamp glow when underground
  if (pug.row > 2) {
    const lg = ctx.createRadialGradient(pug.x, pug.y - 8, 4, pug.x, pug.y - 8, 60);
    lg.addColorStop(0, 'rgba(255,240,180,0.45)');
    lg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(pug.x, pug.y - 8, 60, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // CHEESE CAVERNS biome screen tint when player is deep
  if (pug.row >= CHEESE_DEPTH_ROW) {
    const k = Math.min(1, (pug.row - CHEESE_DEPTH_ROW) / 10);
    ctx.fillStyle = `rgba(255,210,63,${0.10 + k * 0.08})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Round 2C: SHOPKEEPER RAGE red overlay — pulsing crimson tint + iris
  // vignette around the player while the hunter is active, ramping with how
  // close he is (closer = darker, more saturated).
  if (ragedShopkeeper) {
    const rh = ragedShopkeeper;
    const d = Math.hypot(rh.x - pug.x, rh.y - pug.y);
    const closeness = Math.max(0, Math.min(1, 1 - d / 400));
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.012);
    ctx.fillStyle = `rgba(160,30,30,${(0.08 + closeness * 0.18) * pulse})`;
    ctx.fillRect(0, 0, W, H);
    // dark iris vignette so the player feels hunted
    const cx = W / 2, cy = H / 2;
    const ig = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.18, cx, cy, Math.max(W, H) * 0.6);
    ig.addColorStop(0, 'rgba(0,0,0,0)');
    ig.addColorStop(1, `rgba(0,0,0,${0.35 + closeness * 0.25})`);
    ctx.fillStyle = ig; ctx.fillRect(0, 0, W, H);
  }

  // Biome banner — centered, fades over its lifetime
  if (biomeBannerT > 0) {
    const life = 2.4;
    const k = biomeBannerT / life;
    const yPos = H * 0.35 + (1 - k) * 8;
    ctx.globalAlpha = Math.min(1, k * 2.4);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, yPos - 32, W, 56);
    ctx.fillStyle = biomeBannerColor;
    ctx.font = "bold 22px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = biomeBannerColor; ctx.shadowBlur = 16;
    ctx.fillText(biomeBannerText, W / 2, yPos);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // DIG COMBO meter (top-center) — Downwell-style. Shows current chain and
  // the next milestone, with a fade-in timer bar that shrinks until reset.
  if (combo > 0) {
    const tBar = Math.max(0, 1 - (comboTimer / COMBO_WINDOW));
    const cx = W / 2;
    const cy = 56;
    const mileStones = [5, 10, 20];
    const next = mileStones.find((m) => m > combo) || null;
    const txt = 'DIG COMBO ×' + combo;
    ctx.save();
    ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    const tw = Math.max(160, ctx.measureText(txt).width + 36);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(cx - tw / 2, cy - 18, tw, 32);
    // milestone bar
    ctx.fillStyle = 'rgba(94,243,140,0.18)';
    ctx.fillRect(cx - tw / 2 + 4, cy + 6, tw - 8, 6);
    ctx.fillStyle = '#5ef38c';
    ctx.fillRect(cx - tw / 2 + 4, cy + 6, (tw - 8) * tBar, 6);
    // big combo label
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(txt, cx, cy);
    ctx.shadowBlur = 0;
    if (next) {
      ctx.font = "7px 'Press Start 2P', monospace";
      ctx.fillStyle = '#fff';
      ctx.fillText('NEXT MILESTONE ×' + next, cx, cy + 22);
    }
    ctx.restore();
  }
  // COMBO MILESTONE banner — flashes briefly on x5/x10/x20.
  if (comboBannerT > 0) {
    const a = Math.min(1, comboBannerT / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = "bold 26px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = '#1a0d05';
    ctx.strokeText(comboBannerText, W / 2, H * 0.42);
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(comboBannerText, W / 2, H * 0.42);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // Depth indicator (right side) — pulses on low stam
  const lowStam = stam / maxStam < 0.25;
  const stamPulse = lowStam ? (0.6 + 0.4 * Math.sin(performance.now() * 0.014)) : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W - 30, 80, 18, H - 160);
  ctx.fillStyle = lowStam ? '#ff3a3a' : '#5ef38c';
  ctx.globalAlpha = stamPulse;
  const k = depth / rows;
  ctx.fillRect(W - 30, 80, 18, (H - 160) * k);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText('DEPTH', W - 14, 72);
}

function updateHud() {
  document.getElementById('hud-money').textContent = '$' + money;
  document.getElementById('hud-depth').textContent = depth;
  document.getElementById('hud-stam').textContent = Math.floor(stam);
  document.getElementById('hud-bag').textContent = `${bag}/${maxBag}`;
  const hud = document.getElementById('hud');
  if (stam / maxStam < 0.25 && stam > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.014);
    hud.style.filter = `drop-shadow(0 0 ${6 + pulse * 8}px rgba(255,58,58,${0.4 + pulse * 0.4}))`;
  } else {
    hud.style.filter = '';
  }
  const best = loadBest('dungeon-diggers');
  const bestMoney = best && (best.money != null ? best.money : best.score);
  document.getElementById('hud-best').textContent = bestMoney != null ? '$' + bestMoney : '$0';
  renderUpgrades();
}

function end() {
  // Idempotent: if end() already ran (end-overlay shown), don't double-submit.
  const _endOv = document.getElementById('end-overlay');
  if (_endOv && !_endOv.hidden) { running = false; return; }
  running = false;
  sfx.sweep(330, 80, 'sawtooth', 0.5, 0.22);
  document.getElementById('end-money').textContent = '$' + money;
  document.getElementById('end-depth').textContent = depth;
  const { isNewBest, current } = submitRun('dungeon-diggers', { score: money, money, depth });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { money };
    const moneyShown = (b.money != null) ? b.money : (b.score || 0);
    bestEl.innerHTML = `Best: <b>$${moneyShown}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('upgrades').style.display = 'none';
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // S/A/B/C/D grade card — supplements existing end-overlay.
  try {
    const depthPct = Math.max(0, Math.min(100, (depth / (rows || 80)) * 100));
    const moneyPct = Math.max(0, Math.min(100, (money / 1000) * 100));
    showGradeCard({
      title: 'EXPEDITION END',
      subtitle: `Dug to depth ${depth} · $${money} earned`,
      stats: [
        { label: 'Depth', value: depthPct, weight: 0.5 },
        { label: 'Loot',  value: moneyPct, weight: 0.5 },
      ],
      breakdown: [
        { label: 'Depth reached', value: depth,         max: rows || 80 },
        { label: 'Cash ($)',      value: money,         max: 1000 },
      ],
      onRestart: () => start(),
    });
  } catch (e) { /* */ }
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  keys.clear(); touchAt = null; // wipe stuck inputs from prior match
  // Force-close any leftover shop modal from a previous run
  const _sm = document.getElementById('shop-modal');
  if (_sm) _sm.hidden = true;
  shopOpenWith = null;
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  updateHud();
  sfx.resume();
}
let lastT = performance.now();
(function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now; tick(dt); if (running) render();
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD dig · B = beam (blocks cave-ins) · find shopkeepers — BUY safely or STEAL (he hunts you!)', 7500);
    }
  };


  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: BEAMS prevent cave-ins on weak tile lines.',
    'TIP: Cheese Caverns unlock at depth 50.',
    'TIP: STEAL from a shopkeeper — he will hunt you.',
    'TIP: Better drills dig harder tiles faster.',
    'LORE: The Diggers Guild has secrets buried for ages.',
    'JOKE: How deep is too deep? Yes.',
  ];
  const GAME_ID = 'dungeon-diggers';
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
        if (best && (best.money || best.score || best.depth)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: $${best.money || best.score || 0} · depth ${best.depth || 0}`;
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
    el.hidden = dur > 30;
  }
  const shareBtn = document.getElementById('wg-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const m = document.getElementById('end-money')?.textContent || '0';
      const d = document.getElementById('end-depth')?.textContent || '0';
      const text = `🐶 PUG DUNGEON DIGGERS — Dug to depth ${d} with $${m}! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'PUG DUNGEON DIGGERS', text, url: 'https://leobalkind.github.io/web-games/' });
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
