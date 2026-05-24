// PUG DUNGEON DIGGERS — dig through tiles, find treasure, upgrade.
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
import { drawShadow as _depthShadow, lightingOverlay as _depthLighting } from '../../src/shared/depth3D.js';

// --- Custom plush toy icon (library has no plushie) ---------------------------
function drawPlushToy(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // teddy bear silhouette - body
  ctx.fillStyle = '#a0683a';
  ctx.fillRect(-4 * s, -2 * s, 8 * s, 6 * s);
  // body highlight + bottom shade for sphere shading
  ctx.fillStyle = '#c08858';
  ctx.fillRect(-4 * s, -2 * s, 8 * s, 1 * s);
  ctx.fillStyle = '#704818';
  ctx.fillRect(-4 * s,  3 * s, 8 * s, 1 * s);
  // head
  ctx.fillStyle = '#a0683a';
  ctx.fillRect(-3 * s, -6 * s, 6 * s, 4 * s);
  ctx.fillStyle = '#c08858';
  ctx.fillRect(-3 * s, -6 * s, 6 * s, 1 * s);  // head highlight
  // ears
  ctx.fillStyle = '#a0683a';
  ctx.fillRect(-4 * s, -7 * s, 2 * s, 2 * s);
  ctx.fillRect( 2 * s, -7 * s, 2 * s, 2 * s);
  // arms
  ctx.fillRect(-5 * s, -1 * s, 1 * s, 3 * s);
  ctx.fillRect( 4 * s, -1 * s, 1 * s, 3 * s);
  // legs
  ctx.fillRect(-3 * s,  4 * s, 2 * s, 2 * s);
  ctx.fillRect( 1 * s,  4 * s, 2 * s, 2 * s);
  // paw pads on legs
  ctx.fillStyle = '#704818';
  ctx.fillRect(-3 * s,  5 * s, 2 * s, 1 * s);
  ctx.fillRect( 1 * s,  5 * s, 2 * s, 1 * s);
  // ear inner & belly tan
  ctx.fillStyle = '#d8a06a';
  ctx.fillRect(-3 * s, -6 * s, 1 * s, 1 * s);
  ctx.fillRect( 2 * s, -6 * s, 1 * s, 1 * s);
  ctx.fillRect(-2 * s,  0 * s, 4 * s, 3 * s);
  // stitched seam down the middle of belly
  ctx.fillStyle = '#704818';
  ctx.fillRect(-0.5 * s, -1 * s, 1 * s, 4 * s);
  // tiny stitches on seam (4 hash marks)
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(-1 * s, 0 * s, 2 * s, 1);
  ctx.fillRect(-1 * s, 2 * s, 2 * s, 1);
  // eyes (now with white sclera under for cuter look)
  ctx.fillStyle = '#fff';
  ctx.fillRect(-2 * s, -5 * s, 1.5 * s, 1.5 * s);
  ctx.fillRect( 1 * s, -5 * s, 1.5 * s, 1.5 * s);
  ctx.fillStyle = '#000';
  ctx.fillRect(-2 * s, -5 * s, 1 * s, 1 * s);
  ctx.fillRect( 1 * s, -5 * s, 1 * s, 1 * s);
  // nose (heart-shape)
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(-1 * s, -3 * s, 2 * s, 1 * s);
  ctx.fillRect(-0.5 * s, -2.5 * s, 1 * s, 0.5 * s);
  // tiny smile
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(-1 * s, -2 * s, 1 * s, 0.5 * s);
  ctx.fillRect( 0.5 * s, -2 * s, 0.5 * s, 0.5 * s);
  // red bow tie at neck
  ctx.fillStyle = '#c01818';
  ctx.fillRect(-2 * s, -2.5 * s, 4 * s, 1.5 * s);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-2 * s, -2.5 * s, 4 * s, 0.5 * s);  // bow highlight
  ctx.fillStyle = '#7a0a0a';
  ctx.fillRect(-0.5 * s, -2.5 * s, 1 * s, 1.5 * s);  // bow knot
  ctx.restore();
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'diggers:muted' });
// Catchy arcade bass + lead — escalates briefly during combo streaks.
const music = createMusicTrack({ mood: 'arcade', tempo: 140, key: 'G', scale: 'minor' });
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
  // Wave 1D: biome-specific walls
  ice:    { color: '#9ec8d8', shade: '#5a8090', val: 0, stam: 1, biome: true },
  lava:   { color: '#ff5a3a', shade: '#a02810', val: 0, stam: 3, biome: true, hazard: true },
  crystal:{ color: '#b055ff', shade: '#5a2080', val: 0, stam: 2, biome: true },
  // POLISH ROUND 2 — NEW: FUNGAL biome wall (sits between volcanic and crystal)
  fungal: { color: '#7a3a5a', shade: '#3a1a2a', val: 0, stam: 2, biome: true },
  bone:   { isLoot: true, drawIconFn: drawIcon.bone,    val: 15,  stam: 1, rarity: 'common' },
  toy:    { isLoot: true, drawIconFn: drawPlushToy,     val: 25,  stam: 1, rarity: 'common' },
  gold:   { isLoot: true, drawIconFn: drawIcon.gold,    val: 50,  stam: 2, rarity: 'rare' },
  biscuit:{ isLoot: true, drawIconFn: drawIcon.biscuit, val: 100, stam: 3, golden: true, rarity: 'epic' },
  gem:    { isLoot: true, drawIconFn: drawIcon.gem,     val: 60,  stam: 2, rarity: 'rare' },
  // Wave 1D: new tile types
  spring: { color: '#5ef38c', shade: '#3aa860', val: 0, stam: 1, special: 'spring' },
  crack:  { color: '#4a3a2a', shade: '#2a1a0c', val: 0, stam: 1, special: 'crack' },
  sand:   { color: '#ffd9a8', shade: '#c8a878', val: 0, stam: 4, special: 'sand' }, // slow dig
  geode:  { isLoot: true, drawIconFn: drawIcon.gem, val: 300, stam: 3, golden: true, rarity: 'legendary', special: 'geode' },
  // POLISH ROUND 2 — NEW: VEIN tile (drops ore-line of 5 same-row gems on dig)
  vein:   { color: '#8a4a8a', shade: '#3a1a3a', val: 25, stam: 2, special: 'vein' },
};
// Biome bands by depth — POLISH ROUND 2 adds FUNGAL between volcanic + crystal
function biomeAt(row) {
  if (row < 12) return 'stone';
  if (row < 25) return 'cheese';
  if (row < 40) return 'ice';
  if (row < 55) return 'volcanic';
  if (row < 70) return 'fungal';
  return 'crystal';
}
const BIOME_LABELS = { stone: 'STONE DEPTHS', cheese: 'CHEESE CAVERNS', ice: 'GLACIER HALLS', volcanic: 'VOLCANIC CORE', fungal: 'FUNGAL GROVE', crystal: 'CRYSTAL ABYSS' };
const BIOME_COLORS = { stone: '#cacad6', cheese: '#ffd23f', ice: '#9ec8d8', volcanic: '#ff5a3a', fungal: '#b055ff', crystal: '#b055ff' };
// Rarity tiers (visual flair on pickup)
const RARITY = {
  common:    { glow: '#cacacf', tag: 'COMMON' },
  rare:      { glow: '#4cc9f0', tag: 'RARE' },
  epic:      { glow: '#b055ff', tag: 'EPIC' },
  legendary: { glow: '#ffd23f', tag: 'LEGENDARY' },
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
let maxComboThisRun = 0; // surfaced on end-screen (Round-2 polish)
let comboBannerT = 0;   // big banner pop on milestone
let comboBannerText = '';
const COMBO_MILESTONES = new Set([5, 10, 20]);
function resetCombo() { combo = 0; comboTimer = 0; }
function bumpCombo(worldX, worldY) {
  // If too long since last dig, restart at 1; else increment
  if (comboTimer > COMBO_WINDOW) combo = 1;
  else combo += 1;
  comboTimer = 0;
  if (combo > maxComboThisRun) maxComboThisRun = combo;
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

// Cheese Caverns biome boundary — kept for legacy CHEESE_DEPTH_ROW references.
const CHEESE_DEPTH_ROW = 25; // updated to align with new biome bands
const BOSS_DEPTH_ROW = 100;  // Wave 1D: boss layer
function reset() {
  cols = Math.max(8, Math.floor(W / TILE));
  rows = endlessMode ? 200 : 110;
  grid = Array.from({ length: rows }, () => Array(cols).fill('air'));
  for (let r = 2; r < rows; r++) {
    const biome = biomeAt(r);
    const openness = biome === 'cheese' ? 0.55 : (biome === 'ice' ? 0.25 : (biome === 'volcanic' ? 0.15 : (biome === 'fungal' ? 0.30 : 0.1)));
    for (let c = 0; c < cols; c++) {
      const rand = Math.random();
      const wallTile = biome === 'stone' ? (rand < 0.5 ? 'dirt' : 'stone')
                     : biome === 'cheese' ? 'cheese'
                     : biome === 'ice' ? 'ice'
                     : biome === 'volcanic' ? (rand < 0.4 ? 'lava' : 'stone')
                     : biome === 'fungal' ? 'fungal'
                     : 'crystal';
      if (rand < openness) { grid[r][c] = 'air'; continue; }
      const lr = Math.random();
      if (biome === 'crystal' && lr < 0.10) grid[r][c] = 'gem';
      else if (biome === 'volcanic' && lr < 0.06) grid[r][c] = 'gold';
      else if (biome === 'cheese' && lr < 0.08) grid[r][c] = 'biscuit';
      // POLISH ROUND 2 — VEIN tile spawns in fungal + volcanic + crystal layers
      else if ((biome === 'fungal' || biome === 'volcanic' || biome === 'crystal') && lr < 0.04) grid[r][c] = 'vein';
      else if (lr < 0.04) grid[r][c] = r < 30 ? 'bone' : 'gold';
      else if (lr < 0.06) grid[r][c] = 'toy';
      else if (lr < 0.07 && r > 30) grid[r][c] = 'biscuit';
      else if (lr < 0.085 && r > 25) grid[r][c] = 'gem';
      else if (lr < 0.092 && r > 40) grid[r][c] = 'geode';
      else if (lr < 0.105 && r > 8) grid[r][c] = 'spring';
      else if (lr < 0.11 && r > 15) grid[r][c] = 'crack';
      else if (lr < 0.125 && biome === 'volcanic') grid[r][c] = 'sand';
      else grid[r][c] = wallTile;
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
  // Apply skill-tree starters (persistent meta)
  money = 20 * (skillTree.startGold || 0); depth = 0; bag = 0;
  maxStam = 100 + 15 * (skillTree.startStam || 0); stam = maxStam;
  maxBag = 10 + 3 * (skillTree.startBag || 0);
  drillSpeed = 1 + 0.1 * (skillTree.startSpeed || 0); drillCd = 0;
  upgrades = { bag: 0, stam: 0, drill: 0, helmet: 0 };
  amuletCharges = (skillTree.hpRing || 0);
  lanternBattery = 100 * (1 + 0.25 * (skillTree.batt || 0));
  pendingMetaGems = 0;
  particles = []; popups = []; supports = [];
  shakeT = 0; shakeAmp = 0; surfaceCelebT = 0; lastPickup = 0;
  biomeBannerT = 0; biomeBannerText = ''; cheeseBiomeEntered = false;
  beams = []; beamsLeft = MAX_BEAMS + (skillTree.startBeams || 0);
  caveInT = 30; caveInBlocks = [];
  crackedSet = new Set();
  wallDecor = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (let r = 2; r < rows; r++) for (let c = 0; c < cols; c++) {
    const t = grid[r][c];
    if (t !== 'dirt' && t !== 'stone') continue;
    if (Math.random() < CRACK_CHANCE) crackedSet.add(r + ',' + c);
    if (Math.random() < 1 / 80) wallDecor[r][c] = 'pickaxe';
    else if (r > 30 && Math.random() < 1 / 120) wallDecor[r][c] = 'skull';
  }
  resetCombo(); comboBannerT = 0; comboBannerText = '';
  maxComboThisRun = 0;
  lanternT = 0; amuletCharges = 0;
  for (let r = 5; r < rows; r += 5) { supports.push({ row: r, col: 0 }); supports.push({ row: r, col: cols - 1 }); }
  cartTracks = [];
  for (let r = 10; r < CHEESE_DEPTH_ROW; r += 8) cartTracks.push({ row: r });
  crystalPockets = [];
  for (let i = 0; i < 6; i++) {
    crystalPockets.push({
      row: CHEESE_DEPTH_ROW + 4 + Math.floor(Math.random() * (rows - CHEESE_DEPTH_ROW - 8)),
      col: Math.floor(Math.random() * cols),
      n: 3 + Math.floor(Math.random() * 3), seed: Math.random(),
    });
  }
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
  // Wave 1D: stalactites, pots, mushrooms, water, treasure rooms, pet corpse
  stalactites = []; ancientPots = []; mushrooms = []; waterPools = [];
  for (let r = 30; r < rows; r += 6) for (let c = 1; c < cols - 1; c++)
    if (Math.random() < 0.04 && grid[r] && grid[r][c] === 'air')
      stalactites.push({ col: c, row: r, len: 6 + Math.floor(Math.random() * 8) });
  for (let r = 8; r < rows; r += 12) for (let i = 0; i < 2; i++) {
    const c = Math.floor(Math.random() * cols);
    for (let dr = 0; dr < 4; dr++) if (grid[r + dr] && grid[r + dr][c] === 'air') {
      ancientPots.push({ row: r + dr, col: c, t: 0, smashed: false }); break;
    }
  }
  for (let r = 12; r < rows; r++) {
    const b = biomeAt(r); if (b !== 'cheese' && b !== 'crystal') continue;
    for (let c = 0; c < cols; c++) if (Math.random() < 0.03 && grid[r] && grid[r][c] === 'air')
      mushrooms.push({ row: r, col: c, type: b === 'crystal' ? 'glow' : 'cap', t: Math.random() * Math.PI * 2 });
  }
  for (let r = 27; r < 38; r++) for (let c = 0; c < cols; c++)
    if (Math.random() < 0.04 && grid[r] && grid[r][c] === 'air')
      waterPools.push({ row: r, col: c, r: 8 + Math.random() * 6 });
  const lootPool = ['gem', 'biscuit', 'gold'];
  treasureRooms = []; // POLISH ROUND 2 — golden-shaft reveal targets
  for (let baseR = 10; baseR < rows - 5; baseR += 5) {
    const tc = 1 + Math.floor(Math.random() * (cols - 3));
    for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 3; dc++) {
      const r = baseR + dr, c = tc + dc;
      if (r < rows && c < cols) grid[r][c] = lootPool[Math.floor(Math.random() * 3)];
    }
    treasureRooms.push({ row: baseR, col: tc + 1, revealed: false });
  }
  petCorpse = null; pet = null; boss = null;
  if (Math.random() < (0.5 + 0.15 * (skillTree.pet || 0))) {
    for (let tries = 0; tries < 60; tries++) {
      const r = 20 + Math.floor(Math.random() * 6), c = Math.floor(Math.random() * cols);
      if (grid[r] && grid[r][c] === 'air') {
        petCorpse = { row: r, col: c, x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, t: 0 };
        break;
      }
    }
  }
  // POLISH ROUND 2 — reset polish state per run
  rockGolems = []; masteryOffered = {}; masteryActive = []; masteryModalOpen = false;
  _treasureRoomReveals = []; _digShakeT = 0; _digShakeAmp = 0; _confusionT = 0;
  _bossIntroT = 0; _bossNameBannerT = 0; _petEvolved = false;
  _masteryStamDrainMul = 1.0; _masteryLootMul = 1.0; _masteryPetDmg = 1.0;
  // POLISH ROUND 2 — spawn 2-4 ROCK GOLEMS deep in the level
  const numGolems = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numGolems; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const r = 50 + Math.floor(Math.random() * Math.max(1, rows - 60));
      const c = Math.floor(Math.random() * cols);
      if (grid[r] && grid[r][c] === 'air') {
        rockGolems.push({
          row: r, col: c,
          x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
          hp: 8, maxHp: 8, attackCd: 0, t: 0,
          dir: Math.random() < 0.5 ? -1 : 1,
        });
        break;
      }
    }
  }
  renderUpgrades();
  updateBeamsHud();
  refreshPerkStrip();
  const _gd = document.getElementById('godeeper-btn');
  if (_gd) _gd.style.display = 'none';
  const _mm = document.getElementById('mastery-modal');
  if (_mm) _mm.hidden = true;
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
// Wave 1D state
let lanternBattery = 100, stalactites = [], ancientPots = [], mushrooms = [], waterPools = [];
let boss = null, pet = null, petCorpse = null;
let treasureRooms = []; // POLISH ROUND 2 — golden-shaft reveal targets
// POLISH ROUND 2 — new state vars
let rockGolems = [];           // enemy: big, slow, immune to beams
let masteryOffered = {};       // depth-key (50/100/150) -> true once shown
let masteryActive = [];        // chosen perks for this run
let masteryModalOpen = false;
let _treasureRoomReveals = []; // {x, y, t, life} for golden light shaft anims
let _digShakeT = 0;            // brief dig animation timer
let _digShakeAmp = 0;
let _confusionT = 0;           // fungal spore confusion (inverts inputs)
let _bossIntroT = 0;           // cinematic boss descent
let _bossNameBannerT = 0;
let _petEvolved = false;       // becomes 'WAR DOG' after depth 50
let _masteryStamDrainMul = 1.0;
let _masteryLootMul = 1.0;
let _masteryPetDmg = 1.0;
let achievementsT = 0, achievementName = '';
let endlessMode = false, showLegend = false;
let metaGems = 0, pendingMetaGems = 0;
let skillTree = { startBag: 0, startStam: 0, startBeams: 0, startSpeed: 0, startGold: 0, hpRing: 0, lootMag: 0, pet: 0, batt: 0, biomeSkip: 0 };
const SKILL_DEFS = [
  { id: 'startBag',   name: 'BIGGER BAG',     desc: '+3 slots/lvl',     max: 5, cost: 8 },
  { id: 'startStam',  name: 'STAMINA',        desc: '+15 stam/lvl',     max: 5, cost: 10 },
  { id: 'startBeams', name: 'BEAMS',          desc: '+1 beam/lvl',      max: 5, cost: 6 },
  { id: 'startSpeed', name: 'DRILL SPEED',    desc: '+10%/lvl',         max: 5, cost: 12 },
  { id: 'startGold',  name: 'GOLDEN SPOON',   desc: '$20/lvl start',    max: 5, cost: 5 },
  { id: 'hpRing',     name: 'CAVE-IN RING',   desc: '+1 amulet/lvl',    max: 3, cost: 18 },
  { id: 'lootMag',    name: 'LOOT MAGNET',    desc: 'loot +5%/lvl',     max: 5, cost: 14 },
  { id: 'pet',        name: 'PUP COMPANION',  desc: 'pet chance up',    max: 3, cost: 20 },
  { id: 'batt',       name: 'BIG BATTERY',    desc: '+25% lantern/lvl', max: 4, cost: 9 },
  { id: 'biomeSkip',  name: 'BIOME SCANNER',  desc: 'shows next biome', max: 1, cost: 25 },
];
function _loadSkillTree() {
  try {
    const raw = JSON.parse(localStorage.getItem('diggers:skillTree')); if (raw) skillTree = Object.assign(skillTree, raw);
    metaGems = +(localStorage.getItem('diggers:metaGems') || 0);
  } catch {}
}
function _saveSkillTree() { try { localStorage.setItem('diggers:skillTree', JSON.stringify(skillTree)); localStorage.setItem('diggers:metaGems', metaGems); } catch {} }
_loadSkillTree();
function _loadRunHistory() { try { return JSON.parse(localStorage.getItem('diggers:runs')) || []; } catch { return []; } }
function _pushRunHistory(r) { try { const a = _loadRunHistory(); a.unshift(r); while (a.length > 5) a.pop(); localStorage.setItem('diggers:runs', JSON.stringify(a)); } catch {} }
function _achieve(name) {
  try {
    const got = JSON.parse(localStorage.getItem('diggers:achievements')) || {};
    if (got[name]) return;
    got[name] = Date.now(); localStorage.setItem('diggers:achievements', JSON.stringify(got));
    // POLISH ROUND 2 — smoother achievement: longer duration + double pop arp
    achievementName = '🏆 ' + name; achievementsT = 4.0;
    sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.06, 0.18, 0.1);
    setTimeout(() => sfx.arp([1047, 1319, 1568], 'triangle', 0.05, 0.14, 0.08), 220);
  } catch {}
}

// POLISH ROUND 2 — MASTERY perk pool. 3 options per depth checkpoint.
const MASTERY_PERKS = [
  { id: 'm_stamFresh', name: 'IRON LUNGS', desc: 'Stamina drain -25% this run', apply: () => { _masteryStamDrainMul = 0.75; } },
  { id: 'm_lootMag',   name: 'LOOT MAGNET+', desc: 'Loot value +20% this run', apply: () => { _masteryLootMul *= 1.2; } },
  { id: 'm_drill',     name: 'POWER DRILL', desc: 'Drill speed +30% this run', apply: () => { drillSpeed *= 1.3; } },
  { id: 'm_bag',       name: 'ROOMY PACK', desc: '+8 bag slots this run', apply: () => { maxBag += 8; } },
  { id: 'm_amulet',    name: 'BLESSING', desc: '+2 cave-in amulets', apply: () => { amuletCharges += 2; } },
  { id: 'm_battery',   name: 'BIG BATTERY', desc: 'Lantern +50% this run', apply: () => { lanternBattery *= 1.5; } },
  { id: 'm_pet',       name: 'BEAST MASTER', desc: 'Pet damage +50%', apply: () => { _masteryPetDmg = 1.5; } },
  { id: 'm_beam',      name: 'CARPENTRY', desc: '+3 beams', apply: () => { beamsLeft = Math.min(MAX_BEAMS + 5, beamsLeft + 3); updateBeamsHud(); } },
  { id: 'm_critEye',   name: 'KEEN EYE', desc: 'Reveal ALL cracked walls', apply: () => { lanternT = 999999; } },
];
function openMasteryModal(dKey) {
  // Pause world while choosing
  masteryModalOpen = true;
  // Pick 3 random perks not already chosen
  const taken = new Set(masteryActive.map((m) => m.id));
  const pool = MASTERY_PERKS.filter((p) => !taken.has(p.id));
  const choices = [];
  while (choices.length < 3 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(idx, 1)[0]);
  }
  const modal = document.getElementById('mastery-modal');
  const list = document.getElementById('mastery-options');
  const titleEl = document.getElementById('mastery-title');
  if (!modal || !list) { masteryModalOpen = false; return; }
  if (titleEl) titleEl.textContent = `★ DEPTH ${dKey} MASTERY ★`;
  list.innerHTML = '';
  for (const p of choices) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-mastery-btn';
    btn.innerHTML = `<b>${p.name}</b><br><span>${p.desc}</span>`;
    btn.addEventListener('click', () => {
      p.apply();
      masteryActive.push(p);
      showMasteryNotice('★ ' + p.name + ' ★', p.desc, '#ffd23f');
      modal.hidden = true;
      masteryModalOpen = false;
      document.body.classList.remove('wg-modal-open');
      try { sfx.arp([523, 784, 1047, 1319], 'triangle', 0.07, 0.2, 0.1); } catch {}
      refreshPerkStrip();
    });
    list.appendChild(btn);
  }
  modal.hidden = false;
  document.body.classList.add('wg-modal-open');
}
function showMasteryNotice(title, sub, color) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;top:24%;left:50%;transform:translate(-50%,-50%) scale(0.4);z-index:260;padding:18px 30px;border-radius:10px;font-family:var(--font-display);font-size:0.95rem;letter-spacing:0.1em;background:rgba(10,7,22,0.96);border:4px solid ${color || '#ffd23f'};color:${color || '#ffd23f'};text-align:center;opacity:0;pointer-events:none;transition:opacity 0.3s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);text-shadow:0 0 12px currentColor;`;
  el.innerHTML = `${title}<div style="font-size:0.45rem;color:#cacacf;margin-top:6px;letter-spacing:0.05em;">${sub || ''}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translate(-50%,-50%) scale(1)'; });
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 2400);
}

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
  // Wave 1D: L toggles tile legend
  if ((e.key === 'l' || e.key === 'L') && !e.repeat) showLegend = !showLegend;
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
  // Legacy floating BEAM button overlapped the mobileControls BEAM chip on
  // touch. The mobileControls overlay owns the touch UI now — hide the
  // legacy duplicate everywhere (the click handler stays as a safety net).
  beamBtnEl.style.display = 'none';
}
// POLISH ROUND 2 — GO DEEPER quick-skip button. Skips past empty/safe layers
// (no enemies, no walls in the column directly below) — teleports player down
// to the next interesting layer.
const _godeeperBtn = document.getElementById('godeeper-btn');
if (_godeeperBtn) {
  _godeeperBtn.addEventListener('click', doGoDeeper);
}
function doGoDeeper() {
  if (!running) return;
  if (masteryModalOpen || shopOpenWith) return;
  // Check there are no nearby enemies (rock golem, raged shopkeeper, boss)
  const enemiesNear = (boss && Math.hypot(boss.x - pug.x, boss.y - pug.y) < 600)
    || (ragedShopkeeper && Math.hypot(ragedShopkeeper.x - pug.x, ragedShopkeeper.y - pug.y) < 600)
    || rockGolems.some((rg) => Math.hypot(rg.x - pug.x, rg.y - pug.y) < 400);
  if (enemiesNear) {
    popup(pug.x, pug.y - 30, '⚠ ENEMIES NEARBY', '#ff3a3a');
    sfx.tone(220, 'sawtooth', 0.1, 0.18);
    return;
  }
  // Scan downward in pug.col for the next solid row (skip 4..15 air rows)
  let skipped = 0;
  let r = pug.row + 1;
  while (r < rows && grid[r] && grid[r][pug.col] === 'air' && skipped < 15) {
    r++; skipped++;
  }
  if (skipped < 4) {
    popup(pug.x, pug.y - 30, '✗ NO SAFE PATH', '#ff8a8a');
    sfx.tone(220, 'sawtooth', 0.1, 0.18);
    return;
  }
  pug.row = r - 1;
  syncXY();
  if (pug.row > depth) depth = pug.row;
  shake(5, 0.3);
  spawnDust(pug.x, pug.y, '#5ef38c', 14);
  popup(pug.x, pug.y - 24, `▼ DESCENDED ${skipped} ROWS`, '#5ef38c');
  sfx.arp([1320, 880, 523], 'triangle', 0.05, 0.16, 0.06);
  resetCombo();
}
function updateGoDeeperBtn() {
  if (!_godeeperBtn) return;
  if (!running || pug.row <= 2) { _godeeperBtn.style.display = 'none'; return; }
  // Show if at least 3 air rows beneath
  let openRows = 0;
  for (let rr = pug.row + 1; rr < Math.min(pug.row + 6, rows); rr++) {
    if (grid[rr] && grid[rr][pug.col] === 'air') openRows++;
    else break;
  }
  // hide near enemies (UX clarity)
  const enemiesNear = (boss && Math.hypot(boss.x - pug.x, boss.y - pug.y) < 600)
    || (ragedShopkeeper && Math.hypot(ragedShopkeeper.x - pug.x, ragedShopkeeper.y - pug.y) < 600)
    || rockGolems.some((rg) => Math.hypot(rg.x - pug.x, rg.y - pug.y) < 400);
  _godeeperBtn.style.display = (openRows >= 3 && !enemiesNear) ? 'block' : 'none';
}
function refreshPerkStrip() {
  const el = document.getElementById('dd-perk-strip');
  if (!el) return;
  el.innerHTML = '';
  for (const p of masteryActive) {
    const chip = document.createElement('div');
    chip.className = 'dd-perk-chip';
    chip.textContent = '★ ' + p.name;
    chip.title = p.desc;
    el.appendChild(chip);
  }
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
      // Treasure — loot magnet skill boosts value (+ POLISH ROUND 2 mastery mult)
      const lootMul = (1 + 0.05 * (skillTree.lootMag || 0)) * (_masteryLootMul || 1);
      if (bag < maxBag) {
        bag++;
        const finalVal = Math.round(info.val * lootMul);
        money += finalVal;
        lastPickup += finalVal;
        // Rarity tier flair — pop with colored aura
        const r = info.rarity || 'common';
        const tier = RARITY[r];
        popup(tileX, tileY - 8, '+$' + finalVal + (r !== 'common' ? ' [' + tier.tag + ']' : ''), tier.glow);
        sfx.tone(r === 'legendary' ? 1320 : (r === 'epic' ? 1100 : 880), 'triangle', 0.1, 0.22);
        if (r === 'legendary') sfx.arp([523, 784, 1047, 1319], 'triangle', 0.06, 0.18, 0.1);
        spawnDust(tileX, tileY, tier.glow, r === 'legendary' ? 16 : (r === 'epic' ? 12 : 10));
        // Geode bonus — drops 4 more gems immediately
        if (info.special === 'geode') {
          for (let k = 0; k < 4; k++) {
            money += 60; lastPickup += 60;
          }
          popup(tileX, tileY - 24, 'GEODE +5 GEMS!', '#ffd23f');
          pendingMetaGems += 3; // huge meta drop
        }
        // Meta-gem accrual — accumulate per gem-quality pickup
        if (t === 'gem' || t === 'biscuit') pendingMetaGems += (r === 'epic' ? 2 : 1);
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
      // POLISH ROUND 2 — dig animation feedback for HARD tiles: bigger
      // shake/dust + a satisfying "thock" tone progression.
      if (info.stam >= 2) {
        _digShakeT = 0.18; _digShakeAmp = 4 + info.stam;
        spawnDust(tileX, tileY, '#cacacf', 4);
        sfx.tone(220, 'square', 0.06, 0.18);
        sfx.tone(330, 'square', 0.04, 0.12);
        shake(2 + info.stam, 0.22);
      }
    }
    // POLISH ROUND 2 — apply IRON LUNGS mastery stam-drain multiplier
    stam -= cost * (_masteryStamDrainMul || 1);
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
    // Wave 1D: special tile effects + lava hazard
    if (info.special === 'spring') {
      const bdr = dr || -1, bdc = dc || 0;
      for (let k = 0; k < 3; k++) {
        const tr = pug.row + bdr, tc = pug.col + bdc;
        if (tr < 0 || tr >= rows || tc < 0 || tc >= cols || grid[tr][tc] !== 'air') break;
        pug.row = tr; pug.col = tc;
      }
      syncXY(); popup(pug.x, pug.y - 20, 'BOING!', '#5ef38c'); sfx.tone(880, 'sine', 0.12, 0.22);
    } else if (info.special === 'crack') {
      let dropped = 0;
      for (let k = 0; k < 5; k++) {
        if (pug.row + 1 >= rows || grid[pug.row + 1][pug.col] !== 'air') break;
        pug.row++; dropped++;
      }
      if (dropped) { syncXY(); popup(pug.x, pug.y - 20, 'CRACK! ▼' + dropped, '#ff5a3a'); sfx.sweep(440, 220, 'sawtooth', 0.18, 0.22); shake(5, 0.3); }
    } else if (info.special === 'sand') { drillCd *= 2.2; popup(pug.x, pug.y - 20, 'SLOG', '#c8a878'); }
    // POLISH ROUND 2 — VEIN tile: drops 5 ore tiles worth of value in a horizontal line
    else if (info.special === 'vein') {
      let totalVein = 0;
      for (let k = 1; k <= 5; k++) {
        const dx = dc === 0 ? k : (k * Math.sign(dc));
        const vc = pug.col + dx;
        if (vc < 0 || vc >= cols) break;
        // Each step gives a random gem-quality loot value
        const v = 35 + Math.floor(Math.random() * 35);
        money += v; lastPickup += v; totalVein += v;
        // Visual spark trail along the line
        const sx = vc * TILE + TILE / 2, sy = pug.row * TILE + TILE / 2;
        spawnDust(sx, sy, '#b055ff', 6);
      }
      popup(pug.x, pug.y - 24, '⛏ VEIN! +$' + totalVein, '#b055ff');
      shake(5, 0.28);
      sfx.arp([523, 659, 880, 1100], 'triangle', 0.05, 0.15, 0.08);
      pendingMetaGems += 2;
    }
    if (info.hazard) {
      stam = Math.max(0, stam - maxStam * 0.15);
      popup(pug.x, pug.y - 20, 'BURN! -15%', '#ff5a3a'); shake(5, 0.25); sfx.tone(220, 'sawtooth', 0.15, 0.2);
    }
    // Downwell combo: any successful dig (loot picked OR wall broken) counts.
    // Walking through pre-existing air does NOT.
    bumpCombo(pug.x, pug.y);
  }
  if (pug.row > depth) depth = pug.row;
  // Wave 1D: biome-entry banner on every new band
  const curBiome = biomeAt(pug.row);
  if (curBiome !== _lastBiome) {
    _lastBiome = curBiome;
    biomeBannerText = '★ ' + BIOME_LABELS[curBiome] + ' ★';
    biomeBannerColor = BIOME_COLORS[curBiome];
    biomeBannerT = 2.4;
    shake(6, 0.4);
    sfx.tone(440, 'triangle', 0.18, 0.22);
    sfx.tone(660, 'triangle', 0.18, 0.22);
    sfx.tone(880, 'triangle', 0.25, 0.18);
  }
  if (depth === 50) _achieve('DEPTH 50');
  if (depth === 100) _achieve('DEPTH 100');
  if (combo >= 50) _achieve('COMBO 50');
  if (money >= 1000) _achieve('GOLDEN PUG');
  // POLISH ROUND 2 — MASTERY PERK CHOICE at depth 50/100/150
  for (const dKey of [50, 100, 150]) {
    if (depth >= dKey && !masteryOffered[dKey]) {
      masteryOffered[dKey] = true;
      openMasteryModal(dKey);
    }
  }
  // POLISH ROUND 2 — PET EVOLUTION: when player crosses depth 50, pet upgrades
  // to WAR DOG (armor + bigger size + bonus DPS in attacks)
  if (pet && !_petEvolved && depth >= 50) {
    _petEvolved = true;
    pet.evolved = true;
    pet.armor = true;
    pet.hp = (pet.hp || 5) + 5;
    popup(pug.x, pug.y - 32, '🐕 PET EVOLVED → WAR DOG!', '#ffd23f');
    showMasteryNotice('🐕 WAR DOG', 'Your pet wears armor. Bigger bite. More HP.', '#ffd23f');
    sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.06, 0.18, 0.1);
  }
  // POLISH ROUND 2 — Confusion ticks down on movement
  if (_confusionT > 0) _confusionT -= 0.1;
  // surface refill — cache prev display state to avoid touching DOM each move.
  const atSurface = pug.row <= 1;
  if (atSurface) {
    money += bag * 0; // already counted on pickup
    if (lastPickup > 0) {
      surfaceCelebT = 1.6;
      popup(pug.x, pug.y - 30, 'DEPOSIT +$' + lastPickup, '#ffd23f');
      lastPickup = 0;
    }
    bag = 0;
    stam = maxStam;
  }
  if (_lastUpgradesVisible !== atSurface) {
    const upg = document.getElementById('upgrades');
    if (upg) upg.style.display = atSurface ? 'block' : 'none';
    _lastUpgradesVisible = atSurface;
  }
  if (stam <= 0 && running) { running = false; end(); }
  updateHud();
}
let _lastUpgradesVisible = null;
let _lastBiome = 'stone';

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
  if (masteryModalOpen) return; // POLISH ROUND 2 — pause for mastery choice
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
  if (achievementsT > 0) achievementsT = Math.max(0, achievementsT - dt);
  // Wave 1D: lantern drain, ancient pots, pet rescue, pet AI, boss
  if (pug.row > 2 && lanternBattery > 0) lanternBattery = Math.max(0, lanternBattery - dt * 1.2);
  for (const pot of ancientPots) {
    if (pot.smashed) continue;
    pot.t += dt;
    if (Math.abs(pot.col - pug.col) <= 1 && Math.abs(pot.row - pug.row) <= 1) {
      pot.smashed = true;
      const lc = Math.random() < 0.5 ? 'gold' : (Math.random() < 0.5 ? 'gem' : 'biscuit');
      const info = TILE_TYPES[lc];
      money += info.val * 1.5; lastPickup += info.val * 1.5;
      popup(pot.col * TILE + TILE / 2, pot.row * TILE, '+$' + Math.round(info.val * 1.5) + ' POT!', '#ffd23f');
      sfx.tone(880, 'triangle', 0.1, 0.22);
      spawnDust(pot.col * TILE + TILE / 2, pot.row * TILE + TILE / 2, '#c8a878', 14);
      shake(3, 0.16);
    }
  }
  if (petCorpse && !pet) {
    petCorpse.t += dt;
    if (Math.hypot((petCorpse.col - pug.col) * TILE, (petCorpse.row - pug.row) * TILE) < TILE * 1.4) {
      pet = { x: petCorpse.x, y: petCorpse.y, vx: 0, vy: 0, attackCd: 0, t: 0 };
      petCorpse = null;
      popup(pug.x, pug.y - 30, '🐶 PET RESCUED!', '#5ef38c');
      sfx.arp([523, 659, 784], 'triangle', 0.08, 0.22, 0.12);
      _achieve('FRIEND FOUND');
    }
  }
  if (pet) {
    pet.t += dt; pet.attackCd = Math.max(0, pet.attackCd - dt);
    pet.x += (pug.x - 28 - pet.x) * 6 * dt;
    pet.y += (pug.y + 4 - pet.y) * 6 * dt;
    if (ragedShopkeeper && pet.attackCd <= 0) {
      if (Math.hypot(ragedShopkeeper.x - pet.x, ragedShopkeeper.y - pet.y) < TILE * 1.2) {
        ragedShopkeeper.x -= ((pug.x - ragedShopkeeper.x) > 0 ? -1 : 1) * TILE * 2;
        pet.attackCd = 1.8;
        popup(pet.x, pet.y - 16, 'CHOMP!', '#5ef38c');
        sfx.tone(440, 'square', 0.06, 0.2);
      }
    }
  }
  if (!boss && pug.row >= BOSS_DEPTH_ROW) {
    // POLISH ROUND 2 — boss HP rebalance + cinematic descent
    // HP 30 -> 40 (slightly more durable since players have skill-tree + mastery)
    boss = { x: pug.x + 200, y: pug.y - 400, vx: 0, vy: 0, hp: 40, maxHp: 40, attackT: 2.0, mode: 'descend', t: 0, tell: 0 };
    biomeBannerText = '⚠ GIANT GROUND PUG ⚠'; biomeBannerColor = '#ff3a3a'; biomeBannerT = 3.0;
    _bossIntroT = 1.8; _bossNameBannerT = 2.6;
    shake(10, 0.6); sfx.sweep(220, 60, 'sawtooth', 0.5, 0.3); _achieve('BOSS ENCOUNTER');
  }
  // POLISH ROUND 2 — Boss intro descent: while in descend mode, fall to player Y
  // then "thud" + start chase
  if (boss && boss.mode === 'descend') {
    boss.y += 220 * dt;
    if (boss.y >= pug.y - 20) {
      boss.y = pug.y - 20;
      boss.mode = 'chase';
      shake(14, 0.5);
      sfx.tone(110, 'sawtooth', 0.35, 0.3);
      sfx.tone(70, 'square', 0.45, 0.32);
      _bossIntroT = 0;
      // dust burst at impact
      for (let i = 0; i < 18; i++) {
        spawnDust(boss.x + (Math.random() - 0.5) * 80, boss.y + 20, '#6a4a28', 1);
      }
    }
    return; // freeze world tick during descent
  }
  if (_bossNameBannerT > 0) _bossNameBannerT = Math.max(0, _bossNameBannerT - dt);
  // POLISH ROUND 2 — Treasure room reveal: when player < 4 tiles away, trigger
  // a golden light shaft + sparkles
  for (const tr of treasureRooms) {
    if (tr.revealed) continue;
    const dx = pug.col - tr.col, dy = pug.row - tr.row;
    if (Math.abs(dx) <= 4 && Math.abs(dy) <= 4) {
      tr.revealed = true;
      _treasureRoomReveals.push({ x: tr.col * TILE + TILE / 2, y: tr.row * TILE + TILE / 2, t: 0, life: 1.8 });
      sfx.arp([523, 784, 1047, 1319], 'triangle', 0.07, 0.2, 0.12);
      popup(tr.col * TILE + TILE / 2, tr.row * TILE - 8, '☆ TREASURE ROOM ☆', '#ffd23f');
    }
  }
  // Update treasure-room reveal anims
  for (let i = _treasureRoomReveals.length - 1; i >= 0; i--) {
    _treasureRoomReveals[i].t += dt;
    if (_treasureRoomReveals[i].t >= _treasureRoomReveals[i].life) _treasureRoomReveals.splice(i, 1);
  }
  // POLISH ROUND 2 — ROCK GOLEM AI: shamble toward player slowly; immune to
  // beams (don't affect cave-in checks); on contact, deal damage. Pet kills.
  for (let i = rockGolems.length - 1; i >= 0; i--) {
    const rg = rockGolems[i];
    rg.t += dt; rg.attackCd = Math.max(0, rg.attackCd - dt);
    const dx = pug.x - rg.x, dy = pug.y - rg.y;
    const d = Math.hypot(dx, dy);
    if (d < 400 && d > 0.001) {
      // Slow chase — 30 px/s
      const SPEED = 30;
      rg.x += (dx / d) * SPEED * dt;
      rg.y += (dy / d) * SPEED * dt;
    }
    if (d < TILE * 0.8 && rg.attackCd <= 0) {
      const dmg = maxStam * 0.18;
      stam = Math.max(0, stam - dmg);
      rg.attackCd = 1.4;
      popup(pug.x, pug.y - 26, 'ROCK GOLEM! -18%', '#7a3a5a');
      shake(7, 0.32);
      sfx.tone(120, 'sawtooth', 0.18, 0.22);
      resetCombo();
      if (stam <= 0 && running) { running = false; setTimeout(end, 50); return; }
    }
    // Pet attacks golem
    if (pet && pet.attackCd <= 0 && Math.hypot(pet.x - rg.x, pet.y - rg.y) < TILE * 1.2) {
      const petDmg = 1 * (_masteryPetDmg || 1) * (_petEvolved ? 1.8 : 1);
      rg.hp -= petDmg;
      pet.attackCd = 1.2;
      popup(pet.x, pet.y - 16, _petEvolved ? 'WAR CHOMP!' : 'CHOMP!', '#5ef38c');
      sfx.tone(550, 'square', 0.06, 0.18);
      if (rg.hp <= 0) {
        rockGolems.splice(i, 1);
        money += 80; lastPickup += 80;
        popup(rg.x, rg.y - 24, '★ GOLEM DOWN +$80', '#ffd23f');
        spawnDust(rg.x, rg.y, '#7a3a5a', 14);
        spawnShards(rg.x, rg.y, '#5a2a4a', 8);
        shake(6, 0.3);
      }
    }
  }
  // POLISH ROUND 2 — FUNGAL biome spore confusion: when in fungal biome, small
  // chance every few seconds to inflict confusion (inputs swap left/right).
  if (biomeAt(pug.row) === 'fungal' && _confusionT <= 0 && Math.random() < 0.005) {
    _confusionT = 3.5;
    popup(pug.x, pug.y - 30, '🍄 SPORE! Inputs swapped', '#b055ff');
    sfx.tone(880, 'sine', 0.12, 0.2);
    sfx.tone(660, 'sine', 0.08, 0.18);
  }
  if (boss) {
    boss.t += dt; boss.attackT = Math.max(0, boss.attackT - dt);
    const dx = pug.x - boss.x, dy = pug.y - boss.y, d = Math.hypot(dx, dy);
    const SPEED = boss.mode === 'lunge' ? 280 : 140;
    if (d > 0.001) { boss.x += (dx / d) * SPEED * dt; boss.y += (dy / d) * SPEED * dt; }
    if (d < 200 && boss.mode === 'chase') { boss.tell += dt; if (boss.tell >= 0.7) { boss.mode = 'lunge'; boss.tell = 0; boss.attackT = 0.9; } }
    if (boss.mode === 'lunge' && boss.attackT <= 0) { boss.mode = 'chase'; boss.tell = 0; }
    if (d < TILE * 0.7 && boss.attackT > 0 && boss.mode === 'lunge') {
      stam = Math.max(0, stam - maxStam * 0.3);
      boss.mode = 'chase'; boss.tell = 0; boss.attackT = 2;
      popup(pug.x, pug.y - 26, 'CHOMP! -30%', '#ff3a3a');
      shake(10, 0.4); sfx.tone(180, 'sawtooth', 0.2, 0.25);
      resetCombo();
      if (stam <= 0 && running) { running = false; setTimeout(end, 50); return; }
    }
  }
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
  // POLISH ROUND 2 — FUNGAL spore confusion swaps horizontal inputs
  if (_confusionT > 0) dc = -dc;
  if (touchAt) {
    const dx = touchAt.clientX - W / 2;
    const dy = touchAt.clientY - H / 2;
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 30 ? 1 : (dx < -30 ? -1 : 0);
    else dr = dy > 30 ? 1 : (dy < -30 ? -1 : 0);
  }
  if (dc !== 0 && dr !== 0) { if (Math.random() < 0.5) dr = 0; else dc = 0; }
  if (dc || dr) tryMove(dc, dr);
  // POLISH ROUND 2 — GO DEEPER + perk strip + dig shake animation decay
  updateGoDeeperBtn();
  if (_digShakeT > 0) {
    _digShakeT -= dt;
    if (_digShakeT <= 0) _digShakeAmp = 0;
  }
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
        } else if (t === 'fungal') {
          // POLISH ROUND 2 — fungal biome wall: pulsing purple spore dots
          const tpulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.003 + r + c);
          ctx.fillStyle = `rgba(176,85,255,${0.4 + tpulse * 0.3})`;
          ctx.beginPath(); ctx.arc(x + 10, y + 12, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 24, y + 22, 2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,200,255,${0.3 + tpulse * 0.3})`;
          ctx.beginPath(); ctx.arc(x + 18, y + 8, 1.5, 0, Math.PI * 2); ctx.fill();
        } else if (t === 'vein') {
          // POLISH ROUND 2 — VEIN tile: glowing purple ore vein with shimmer
          const tpulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.005 + c);
          ctx.fillStyle = `rgba(176,85,255,${0.5 + tpulse * 0.4})`;
          ctx.fillRect(x + 4, y + TILE / 2 - 2, TILE - 8, 4);
          ctx.fillStyle = '#ffb0ff';
          ctx.fillRect(x + 8, y + TILE / 2 - 1, 3, 2);
          ctx.fillRect(x + 22, y + TILE / 2 - 1, 3, 2);
          ctx.shadowColor = '#b055ff'; ctx.shadowBlur = 6 + tpulse * 4;
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 14, y + TILE / 2, 2, 1);
          ctx.shadowBlur = 0;
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

  // Wave 1D: stalactites + pots + mushrooms + water pools
  for (const st of stalactites) {
    const y = st.row * TILE;
    if (y + TILE < camY || y > camY + H) continue;
    const x = st.col * TILE + TILE / 2, b = biomeAt(st.row);
    ctx.fillStyle = b === 'crystal' ? '#b055ff' : (b === 'ice' ? '#9ec8d8' : (b === 'volcanic' ? '#5a5a72' : '#6a5a4a'));
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + st.len); ctx.closePath(); ctx.fill();
  }
  for (const pot of ancientPots) {
    if (pot.smashed) continue;
    const y = pot.row * TILE + TILE / 2;
    if (y < camY - 20 || y > camY + H + 20) continue;
    const x = pot.col * TILE + TILE / 2;
    ctx.fillStyle = '#a06a3a';
    ctx.beginPath(); ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a4a1c'; ctx.fillRect(x - 6, y - 9, 12, 3);
  }
  for (const m of mushrooms) {
    const x = m.col * TILE + TILE / 2, y = m.row * TILE + TILE - 4;
    if (y < camY || y > camY + H) continue;
    m.t += 0.02; const sway = Math.sin(m.t) * 1;
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(x - 1 + sway, y - 6, 2, 6);
    ctx.fillStyle = m.type === 'glow' ? '#b055ff' : '#ff5a3a';
    ctx.beginPath(); ctx.ellipse(x + sway, y - 6, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const w of waterPools) {
    const y = w.row * TILE + TILE - 4;
    if (y < camY || y > camY + H) continue;
    const x = w.col * TILE + TILE / 2;
    ctx.fillStyle = 'rgba(76,201,240,0.4)';
    ctx.beginPath(); ctx.ellipse(x, y, w.r, w.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
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
    // depth3D: shadow under supervisor
    _depthShadow(ctx, supervisor.x, sy + 2 + bob, 14, { alpha: 0.4 });
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

  // Tunnel-edge shadow vignette around player (battery-aware see-distance)
  if (pug.row > 2) {
    const batt = lanternBattery / (100 * (1 + 0.25 * (skillTree.batt || 0)));
    const inner = TILE * (2.6 + batt * 0.6);
    const outer = TILE * (4.6 - batt * 0.8);
    const darkness = 0.55 + (1 - batt) * 0.35;
    const grad = ctx.createRadialGradient(pug.x, pug.y, inner * 0.4, pug.x, pug.y, outer);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${darkness})`);
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
    // depth3D shadow underneath
    _depthShadow(ctx, sx, sy + 14 + bob, 16, { alpha: 0.45 });
    drawPug(ctx, sx, sy + bob, { size: 26, body: '#c8a06a', hat: true, hatColor: '#5ef38c' });
    // shopkeeper apron — beige apron with pocket (in front of body)
    ctx.fillStyle = '#e8d8a0';
    ctx.fillRect(sx - 8, sy + 2 + bob, 16, 8);
    ctx.fillStyle = '#c8b888';
    ctx.fillRect(sx - 8, sy + 9 + bob, 16, 1);
    // apron pocket
    ctx.fillStyle = '#a89868';
    ctx.fillRect(sx - 6, sy + 4 + bob, 5, 4);
    ctx.fillRect(sx + 1, sy + 4 + bob, 5, 4);
    // dollar pouch — gold coins peeking
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(sx - 5, sy + 5 + bob, 1, 1);
    ctx.fillRect(sx + 3, sy + 5 + bob, 1, 1);
    // friendly smile bump (white teeth dot under snout)
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 1, sy - 4 + bob, 2, 1);
    // green hat highlight band
    ctx.fillStyle = '#a8f8c0';
    ctx.fillRect(sx - 8, sy - 12 + bob, 16, 1);
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
    // depth3D shadow underneath the raged hunter
    _depthShadow(ctx, rh.x, rh.y + 14, 18, { alpha: 0.5 });
    // DARK CLOAK silhouette behind/over the body (jagged hem)
    ctx.fillStyle = '#0a0006';
    ctx.fillRect(rh.x - 14, rh.y - 8, 28, 20);
    // jagged cloak bottom hem
    for (let cx = -14; cx < 14; cx += 4) {
      ctx.beginPath();
      ctx.moveTo(rh.x + cx, rh.y + 12);
      ctx.lineTo(rh.x + cx + 2, rh.y + 18);
      ctx.lineTo(rh.x + cx + 4, rh.y + 12);
      ctx.closePath();
      ctx.fill();
    }
    // dark hood overhead
    ctx.fillStyle = '#0a0006';
    ctx.fillRect(rh.x - 12, rh.y - 18, 24, 10);
    // hood opening (dark slit)
    ctx.fillStyle = '#000';
    ctx.fillRect(rh.x - 8, rh.y - 10, 16, 4);
    // body (rendered AFTER cloak so head is visible through hood opening)
    drawPug(ctx, rh.x, rh.y, { size: 30, body: '#5a1a1a' });
    // SCYTHE held to the side — long handle + curved blade
    ctx.save();
    ctx.translate(rh.x + 14, rh.y);
    // handle (dark wood, slightly angled)
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(0, -22, 2, 36);
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(0, -22, 1, 36);  // highlight
    // curved blade (drawn via filled triangles)
    ctx.fillStyle = '#c8c8d0';
    ctx.beginPath();
    ctx.moveTo(2, -22);
    ctx.lineTo(12, -28);
    ctx.lineTo(14, -24);
    ctx.lineTo(8, -16);
    ctx.lineTo(2, -16);
    ctx.closePath();
    ctx.fill();
    // blade highlight
    ctx.fillStyle = '#eaeaea';
    ctx.beginPath();
    ctx.moveTo(2, -22);
    ctx.lineTo(12, -28);
    ctx.lineTo(13, -26);
    ctx.lineTo(4, -21);
    ctx.closePath();
    ctx.fill();
    // blood drip on blade
    ctx.fillStyle = '#c01818';
    ctx.fillRect(8, -16, 1, 4);
    ctx.fillRect(10, -16, 1, 3);
    ctx.restore();
    // glowing red eyes (override the pug face) — now BIGGER + halo
    ctx.fillStyle = `rgba(255,58,58,${0.3 + pulse * 0.3})`;
    ctx.beginPath(); ctx.arc(rh.x - 4, rh.y - 1, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rh.x + 4, rh.y - 1, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,58,58,${0.8 + pulse * 0.2})`;
    ctx.fillRect(rh.x - 6, rh.y - 3, 4, 4);
    ctx.fillRect(rh.x + 2, rh.y - 3, 4, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(rh.x - 5, rh.y - 2, 2, 2);
    ctx.fillRect(rh.x + 3, rh.y - 2, 2, 2);
    // fangs showing
    ctx.fillStyle = '#fff';
    ctx.fillRect(rh.x - 3, rh.y + 5, 1, 2);
    ctx.fillRect(rh.x + 2, rh.y + 5, 1, 2);
    // exclamation above
    ctx.fillStyle = '#ff3a3a';
    ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 10;
    ctx.fillText('!', rh.x, rh.y - 22);
    ctx.shadowBlur = 0;
  }
  // depth3D shadow under the pug — gives him weight on the tiles.
  _depthShadow(ctx, pug.x, pug.y + 14, 18, { alpha: 0.5 });
  // Pet corpse, pet, boss (compact)
  if (petCorpse) {
    drawPug(ctx, petCorpse.x, petCorpse.y, { size: 22, body: '#5a5a5a', mask: '#3a3a3a' });
    ctx.fillStyle = '#5ef38c'; ctx.font = "bold 11px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('?', petCorpse.x, petCorpse.y - 18);
  }
  if (pet) {
    // POLISH ROUND 2 — pet more expressive: looks toward nearest enemy + wags tail
    const targets = [];
    if (boss) targets.push({ x: boss.x, y: boss.y });
    if (ragedShopkeeper) targets.push({ x: ragedShopkeeper.x, y: ragedShopkeeper.y });
    for (const rg of rockGolems) targets.push({ x: rg.x, y: rg.y });
    let lookDir = 0;
    if (targets.length) {
      let nearest = targets[0], nd = Math.hypot(targets[0].x - pet.x, targets[0].y - pet.y);
      for (let i = 1; i < targets.length; i++) {
        const d = Math.hypot(targets[i].x - pet.x, targets[i].y - pet.y);
        if (d < nd) { nd = d; nearest = targets[i]; }
      }
      lookDir = nearest.x > pet.x ? 1 : -1;
    }
    // POLISH ROUND 2 — pet evolution: WAR DOG = bigger + armor + dark body
    const petSize = _petEvolved ? 26 : 20;
    const petBody = _petEvolved ? '#7a3a3a' : '#fafaff';
    const petMask = _petEvolved ? '#3a1a1a' : '#a8a8c8';
    drawPug(ctx, pet.x, pet.y, { size: petSize, body: petBody, mask: petMask });
    // Tail wag — sin-driven offset (visible when no target, calmer)
    const wag = Math.sin(pet.t * 14) * 4;
    ctx.fillStyle = petBody;
    if (!lookDir) ctx.fillRect(pet.x - 12, pet.y - 4 + wag, 4, 4);
    // Look-toward indicator: small dot pip on the appropriate eye
    if (lookDir !== 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(pet.x + lookDir * 3, pet.y - 4, 2, 2);
    }
    // War dog armor plate + battle scars + spiked collar
    if (_petEvolved) {
      // chest armor with bevel
      ctx.fillStyle = '#cacacf';
      ctx.fillRect(pet.x - 8, pet.y - 2, 16, 4);
      ctx.fillStyle = '#eaeaea';
      ctx.fillRect(pet.x - 8, pet.y - 2, 16, 1);  // bright highlight
      ctx.fillStyle = '#888898';
      ctx.fillRect(pet.x - 8, pet.y + 2, 16, 1);
      // chest emblem (red skull dot)
      ctx.fillStyle = '#c01818';
      ctx.fillRect(pet.x - 1, pet.y, 2, 2);
      // shoulder pads with spike rivets
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(pet.x - 10, pet.y - 6, 4, 4);
      ctx.fillRect(pet.x + 6, pet.y - 6, 4, 4);
      ctx.fillStyle = '#cacacf';
      ctx.fillRect(pet.x - 9, pet.y - 7, 1, 1);   // shoulder spike
      ctx.fillRect(pet.x + 8, pet.y - 7, 1, 1);
      // spiked collar at neck
      ctx.fillStyle = '#3a3a48';
      ctx.fillRect(pet.x - 6, pet.y - 9, 12, 2);
      ctx.fillStyle = '#cacacf';
      ctx.fillRect(pet.x - 5, pet.y - 11, 1, 2);
      ctx.fillRect(pet.x - 2, pet.y - 11, 1, 2);
      ctx.fillRect(pet.x + 1, pet.y - 11, 1, 2);
      ctx.fillRect(pet.x + 4, pet.y - 11, 1, 2);
      // battle scar (X across the face)
      ctx.strokeStyle = 'rgba(160,40,40,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pet.x - 6, pet.y - 11); ctx.lineTo(pet.x - 2, pet.y - 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pet.x - 2, pet.y - 11); ctx.lineTo(pet.x - 6, pet.y - 7); ctx.stroke();
      // glowing red eye glints
      ctx.fillStyle = '#ff5a3a';
      ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 4;
      ctx.fillRect(pet.x - 5, pet.y - 8, 1, 1);
      ctx.fillRect(pet.x + 4, pet.y - 8, 1, 1);
      ctx.shadowBlur = 0;
    } else {
      // PUPPY phase — tiny pink bow + cute floppy ear position indicator
      ctx.fillStyle = '#ff8aa8';
      ctx.fillRect(pet.x + 5, pet.y - 14, 3, 2);
      ctx.fillStyle = '#ff5a82';
      ctx.fillRect(pet.x + 6, pet.y - 13, 1, 1);
    }
    ctx.fillStyle = '#ff3aa1'; ctx.fillRect(pet.x - 5, pet.y - 14, 10, 4);
  }
  // POLISH ROUND 2 — ROCK GOLEMS render: chunky dark-purple monolith with eyes
  for (const rg of rockGolems) {
    const sx = rg.x, sy = rg.y;
    if (sy + TILE < camY || sy > camY + H) continue;
    // shadow
    _depthShadow(ctx, sx, sy + 18, 22, { alpha: 0.5 });
    // body
    ctx.fillStyle = '#5a2a4a';
    ctx.fillRect(sx - 14, sy - 18, 28, 36);
    ctx.fillStyle = '#3a1a2a';
    ctx.fillRect(sx - 14, sy - 18, 28, 4);
    ctx.fillRect(sx - 14, sy + 14, 28, 4);
    ctx.fillStyle = '#7a3a5a';
    ctx.fillRect(sx - 12, sy - 16, 24, 4);
    // chunky stone facet highlights (3D rocky look)
    ctx.fillStyle = '#8a4a6a';
    ctx.fillRect(sx - 14, sy - 14, 4, 4);
    ctx.fillRect(sx + 10, sy + 4, 4, 4);
    ctx.fillStyle = '#3a1a2a';
    ctx.fillRect(sx - 14, sy + 8, 4, 4);
    ctx.fillRect(sx + 10, sy - 14, 4, 4);
    // shoulder boulders (jutting up + asymmetric)
    ctx.fillStyle = '#5a2a4a';
    ctx.fillRect(sx - 16, sy - 22, 6, 8);
    ctx.fillRect(sx + 10, sy - 20, 6, 6);
    ctx.fillStyle = '#7a3a5a';
    ctx.fillRect(sx - 16, sy - 22, 6, 1);
    ctx.fillRect(sx + 10, sy - 20, 6, 1);
    // eyes (now in a deep socket — black behind glow)
    const eyePulse = 0.5 + 0.5 * Math.sin(rg.t * 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 8, sy - 9, 7, 7);
    ctx.fillRect(sx + 1, sy - 9, 7, 7);
    ctx.fillStyle = `rgba(255,80,150,${0.7 + eyePulse * 0.3})`;
    ctx.fillRect(sx - 7, sy - 8, 5, 5);
    ctx.fillRect(sx + 2, sy - 8, 5, 5);
    // bright pupil cores
    ctx.fillStyle = '#ffe0f0';
    ctx.fillRect(sx - 5, sy - 6, 2, 2);
    ctx.fillRect(sx + 4, sy - 6, 2, 2);
    // crack-rune lines (now glowing + branching)
    ctx.strokeStyle = `rgba(255,200,255,${0.4 + eyePulse * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx - 10, sy + 4); ctx.lineTo(sx - 4, sy + 8); ctx.lineTo(sx, sy + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 6, sy + 0); ctx.lineTo(sx + 10, sy + 6); ctx.stroke();
    // small glowing rune symbol on chest (3 dots in a triangle)
    ctx.fillStyle = `rgba(255,150,220,${0.6 + eyePulse * 0.3})`;
    ctx.fillRect(sx - 1, sy + 2, 2, 2);
    ctx.fillRect(sx - 5, sy + 6, 2, 2);
    ctx.fillRect(sx + 3, sy + 6, 2, 2);
    // crumbling pebble bits at base
    ctx.fillStyle = '#3a1a2a';
    ctx.fillRect(sx - 18, sy + 18, 2, 2);
    ctx.fillRect(sx + 16, sy + 17, 2, 2);
    ctx.fillRect(sx - 6, sy + 19, 2, 1);
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - 16, sy - 28, 32, 5);
    ctx.fillStyle = '#ff5050';
    ctx.fillRect(sx - 15, sy - 27, 30 * (rg.hp / rg.maxHp), 3);
  }
  // POLISH ROUND 2 — TREASURE ROOM REVEAL: golden light shaft + sparkle ring
  for (const tr of _treasureRoomReveals) {
    const a = Math.max(0, 1 - tr.t / tr.life);
    if (tr.y < camY - 100 || tr.y > camY + H + 100) continue;
    ctx.save();
    ctx.globalAlpha = a * 0.75;
    const grad = ctx.createLinearGradient(tr.x, tr.y - 200, tr.x, tr.y + 40);
    grad.addColorStop(0, 'rgba(255,240,150,0)');
    grad.addColorStop(0.4, 'rgba(255,240,150,0.55)');
    grad.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tr.x - 8, tr.y - 200);
    ctx.lineTo(tr.x + 8, tr.y - 200);
    ctx.lineTo(tr.x + 40, tr.y + 40);
    ctx.lineTo(tr.x - 40, tr.y + 40);
    ctx.closePath();
    ctx.fill();
    // sparkle ring
    for (let i = 0; i < 6; i++) {
      const ang = (tr.t * 4 + i / 6) * Math.PI * 2;
      const rad = 30 + tr.t * 30;
      const sx2 = tr.x + Math.cos(ang) * rad;
      const sy2 = tr.y + Math.sin(ang) * rad * 0.5;
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(sx2 - 1.5, sy2 - 1.5, 3, 3);
    }
    ctx.restore();
  }
  if (boss) {
    const tp = 0.4 + 0.6 * Math.sin(boss.t * 12);
    // POLISH ROUND 2 — boss intro shadow + falling silhouette
    if (boss.mode === 'descend') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(boss.x - 30, pug.y + 8, 60, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(boss.x - 36, pug.y + 14, 72, 3);
      // motion trail
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.25 - k * 0.07;
        drawPug(ctx, boss.x, boss.y - k * 26, { size: 72 - k * 8, body: '#5a1a1a', mask: '#1a0d05' });
      }
      ctx.globalAlpha = 1;
    } else {
      if (boss.tell > 0 || boss.mode === 'lunge') {
        ctx.strokeStyle = `rgba(255,58,58,${0.4 + tp * 0.4})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(boss.x, boss.y, 60 + boss.tell * 18, 0, Math.PI * 2); ctx.stroke();
      }
    }
    drawPug(ctx, boss.x, boss.y, { size: 72, body: '#5a1a1a', mask: '#1a0d05' });
    // Outer halo glow behind the boss
    ctx.save();
    ctx.fillStyle = `rgba(255,58,58,${0.18 + tp * 0.15})`;
    ctx.beginPath(); ctx.arc(boss.x, boss.y - 8, 50, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Heavy chains draped over the boss (iron links across body)
    ctx.save();
    ctx.fillStyle = '#3a3a48';
    for (let cx = -28; cx <= 28; cx += 6) {
      ctx.beginPath(); ctx.arc(boss.x + cx, boss.y + 18, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#6a6a72';
    for (let cx = -28; cx <= 28; cx += 6) {
      ctx.fillRect(boss.x + cx - 1, boss.y + 17, 1, 1);
    }
    // dangling padlock on the chain
    ctx.fillStyle = '#8a6a10';
    ctx.fillRect(boss.x - 4, boss.y + 24, 8, 6);
    ctx.fillStyle = '#c8a830';
    ctx.fillRect(boss.x - 4, boss.y + 24, 8, 1);
    ctx.fillStyle = '#000';
    ctx.fillRect(boss.x - 1, boss.y + 27, 2, 1);
    ctx.restore();
    // Battle scars across the snout (3 claw-rake scars)
    ctx.strokeStyle = 'rgba(200,30,30,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(boss.x - 16, boss.y - 14); ctx.lineTo(boss.x - 6, boss.y - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boss.x - 12, boss.y - 16); ctx.lineTo(boss.x - 2, boss.y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(boss.x - 8, boss.y - 18); ctx.lineTo(boss.x + 2, boss.y - 8); ctx.stroke();
    // Spiked crown on top (jagged red-iron crown)
    ctx.fillStyle = '#2a1010';
    ctx.fillRect(boss.x - 16, boss.y - 30, 32, 5);
    ctx.fillStyle = '#5a2020';
    ctx.fillRect(boss.x - 16, boss.y - 30, 32, 1);
    // crown spikes
    ctx.beginPath();
    ctx.moveTo(boss.x - 14, boss.y - 30); ctx.lineTo(boss.x - 12, boss.y - 38); ctx.lineTo(boss.x - 10, boss.y - 30); ctx.closePath();
    ctx.moveTo(boss.x - 6, boss.y - 30); ctx.lineTo(boss.x - 4, boss.y - 42); ctx.lineTo(boss.x - 2, boss.y - 30); ctx.closePath();
    ctx.moveTo(boss.x + 2, boss.y - 30); ctx.lineTo(boss.x + 4, boss.y - 38); ctx.lineTo(boss.x + 6, boss.y - 30); ctx.closePath();
    ctx.moveTo(boss.x + 10, boss.y - 30); ctx.lineTo(boss.x + 12, boss.y - 40); ctx.lineTo(boss.x + 14, boss.y - 30); ctx.closePath();
    ctx.fillStyle = '#3a1010';
    ctx.fill();
    // crown gems (red + center yellow)
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(boss.x - 11, boss.y - 28, 2, 2);
    ctx.fillRect(boss.x + 9, boss.y - 28, 2, 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(boss.x - 1, boss.y - 28, 2, 2);
    // Glowing eyes (override with brighter pulsing red — larger + halo)
    ctx.fillStyle = `rgba(255,58,58,${0.4 + tp * 0.3})`;
    ctx.beginPath(); ctx.arc(boss.x - 10, boss.y - 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(boss.x + 10, boss.y - 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,58,58,${0.7 + tp * 0.3})`;
    ctx.fillRect(boss.x - 14, boss.y - 8, 8, 8); ctx.fillRect(boss.x + 6, boss.y - 8, 8, 8);
    ctx.fillStyle = '#fff';
    ctx.fillRect(boss.x - 12, boss.y - 6, 4, 4); ctx.fillRect(boss.x + 8, boss.y - 6, 4, 4);
    // tiny hot-white pupil core
    ctx.fillStyle = `rgba(255,255,255,${0.7 + tp * 0.3})`;
    ctx.fillRect(boss.x - 11, boss.y - 5, 1, 1);
    ctx.fillRect(boss.x + 9, boss.y - 5, 1, 1);
    // drool dripping from mouth
    ctx.fillStyle = 'rgba(200,30,30,0.7)';
    ctx.fillRect(boss.x - 3, boss.y + 8, 1, 4);
    ctx.fillRect(boss.x + 2, boss.y + 8, 1, 3);
  }
  // Pug — high-detail digger with yellow hard hat
  drawPug(ctx, pug.x, pug.y, { size: 30, hat: true, hatColor: '#ffd23f' });
  // === DIGGER PUG GEAR OVERLAY ===
  // Pickaxe slung over shoulder (visible accessory) + helmet-mounted lamp ring
  // + sweat drops when low stamina. Cosmetic only.
  ctx.save();
  // pickaxe on back-right
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(pug.x + 8, pug.y - 16, 2, 14);  // handle
  ctx.fillStyle = '#c8c8d0';
  ctx.fillRect(pug.x + 4, pug.y - 17, 10, 3);   // head
  ctx.fillStyle = '#eaeaea';
  ctx.fillRect(pug.x + 4, pug.y - 17, 10, 1);   // shine
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(pug.x + 4, pug.y - 14, 2, 1);    // socket
  // helmet lamp socket + lens glow
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(pug.x - 4, pug.y - 19, 8, 3);
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(pug.x - 2, pug.y - 19, 4, 2);
  // chest strap (dark band across the body)
  ctx.fillStyle = 'rgba(40,20,8,0.7)';
  ctx.fillRect(pug.x - 8, pug.y - 4, 16, 1);
  // tool-belt pouch on hip
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(pug.x - 10, pug.y + 0, 4, 4);
  ctx.fillStyle = '#7a4a2a';
  ctx.fillRect(pug.x - 10, pug.y + 0, 4, 1);
  // sweat drops when low stam (animated bob)
  if (stam / maxStam < 0.3) {
    const bobS = Math.sin(performance.now() * 0.012) * 1.5;
    ctx.fillStyle = '#9ec8d8';
    ctx.fillRect(pug.x - 6, pug.y - 26 + bobS, 1, 2);
    ctx.fillRect(pug.x + 5, pug.y - 25 + bobS, 1, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(pug.x - 6, pug.y - 26 + bobS, 1, 1);
    ctx.fillRect(pug.x + 5, pug.y - 25 + bobS, 1, 1);
  }
  ctx.restore();
  // Helmet headlamp glow when underground (battery-aware — drains over time)
  if (pug.row > 2) {
    const batt = lanternBattery / (100 * (1 + 0.25 * (skillTree.batt || 0)));
    const radius = 30 + batt * 50; // shrinks as battery dies
    if (radius > 30) {
      const lg = ctx.createRadialGradient(pug.x, pug.y - 8, 4, pug.x, pug.y - 8, radius);
      lg.addColorStop(0, `rgba(255,240,180,${0.2 + batt * 0.35})`);
      lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.arc(pug.x, pug.y - 8, radius, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // depth3D: lantern lighting overlay around the player when underground.
  // Subtle ambient darkness + a warm radial light at the player's screen pos
  // gives a "I have a lamp in the dark" depth feel. Tuned light so it never
  // washes out the existing biome tints below.
  if (pug.row > 2) {
    const screenPx = pug.x;
    const screenPy = pug.y - camY;
    _depthLighting(ctx, [
      { x: screenPx, y: screenPy - 6, radius: 180, color: '255,228,150', intensity: 0.7 },
    ], 0.15);
  }

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
  // Depth indicator (right side) — pulses on low stam, draws biome bands
  const lowStam = stam / maxStam < 0.25;
  const stamPulse = lowStam ? (0.6 + 0.4 * Math.sin(performance.now() * 0.014)) : 1;
  const baseX = W - 30, baseY = 80, baseH = H - 160;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(baseX, baseY, 18, baseH);
  // POLISH ROUND 2 — add FUNGAL band marker between volcanic + crystal
  for (const [end, b] of [[12, 'stone'], [25, 'cheese'], [40, 'ice'], [55, 'volcanic'], [70, 'fungal'], [110, 'crystal']]) {
    ctx.fillStyle = BIOME_COLORS[b] + '33';
    ctx.fillRect(baseX, baseY + baseH * (end / 110) - 4, 18, 4);
  }
  ctx.fillStyle = lowStam ? '#ff3a3a' : '#5ef38c'; ctx.globalAlpha = stamPulse;
  ctx.fillRect(baseX, baseY, 18, baseH * (depth / 110));
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText('DEPTH', W - 14, 72);
  // POLISH ROUND 2 — LARGE PROMINENT DEPTH DISPLAY (top-center)
  {
    const dx = W / 2, dy = 96;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(dx - 70, dy - 22, 140, 32);
    ctx.strokeStyle = BIOME_COLORS[biomeAt(pug.row)] || '#5ef38c';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx - 70, dy - 22, 140, 32);
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillStyle = '#cacacf'; ctx.fillText('DEPTH', dx, dy - 12);
    ctx.font = "bold 18px 'Press Start 2P', monospace";
    ctx.shadowColor = BIOME_COLORS[biomeAt(pug.row)] || '#5ef38c'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    ctx.fillText(String(depth), dx, dy + 6);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // POLISH ROUND 2 — BOSS NAME BANNER on intro descent
  if (_bossNameBannerT > 0 && boss) {
    const a = Math.min(1, _bossNameBannerT / 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(W / 2 - 200, H * 0.18, 400, 56);
    ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 3;
    ctx.strokeRect(W / 2 - 200, H * 0.18, 400, 56);
    ctx.font = "bold 22px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff3a3a';
    ctx.fillText('⚠ GIANT GROUND PUG ⚠', W / 2, H * 0.18 + 28);
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
    ctx.fillText(`HP: ${boss.maxHp || 40} · DEPTH ${BOSS_DEPTH_ROW}`, W / 2, H * 0.18 + 48);
    ctx.restore();
  }
  const battPct = lanternBattery / (100 * (1 + 0.25 * (skillTree.batt || 0)));
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W - 52, baseY, 10, baseH);
  ctx.fillStyle = battPct < 0.25 ? '#ff5a3a' : '#ffd23f'; ctx.fillRect(W - 52, baseY, 10, baseH * battPct);
  ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.fillText('BATT', W - 42, 72);
  drawMinimap();
  if (showLegend) drawTileLegend();
  if (achievementsT > 0 && achievementName) {
    const a = Math.min(1, achievementsT / 0.5);
    ctx.fillStyle = `rgba(0,0,0,${0.7 * a})`; ctx.fillRect(W / 2 - 130, 8, 260, 28);
    ctx.fillStyle = `rgba(255,210,63,${a})`;
    ctx.font = "bold 11px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(achievementName, W / 2, 26);
  }
  if (boss && boss.hp > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(W / 2 - 100, H - 64, 200, 18);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(W / 2 - 98, H - 62, 196 * (boss.hp / 30), 14);
    ctx.fillStyle = '#fff'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('GIANT GROUND PUG', W / 2, H - 72);
  }
}
function drawMinimap() {
  const w = 90, h = 60, x = W - w - 12, y = 12, biome = biomeAt(pug.row);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = BIOME_COLORS[biome]; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.fillStyle = BIOME_COLORS[biome]; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText(BIOME_LABELS[biome], x + w / 2, y - 2);
  const startR = Math.max(0, pug.row - 12), endR = Math.min(rows - 1, pug.row + 18);
  const sx = w / cols, sy = h / (endR - startR + 1);
  for (let r = startR; r <= endR; r++) for (let c = 0; c < cols; c++) {
    const tt = grid[r][c]; if (tt === 'air') continue;
    const info = TILE_TYPES[tt];
    ctx.fillStyle = info.isLoot ? '#ffd23f' : (info.color || '#5a3a1c');
    ctx.fillRect(x + c * sx, y + (r - startR) * sy, sx + 0.5, sy + 0.5);
  }
  ctx.fillStyle = '#5ef38c'; ctx.fillRect(x + pug.col * sx - 1, y + (pug.row - startR) * sy - 1, sx + 2, sy + 2);
  if (boss) {
    const br = (boss.y / TILE) | 0, bc = (boss.x / TILE) | 0;
    if (br >= startR && br <= endR) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + bc * sx - 1, y + (br - startR) * sy - 1, sx + 2, sy + 2); }
  }
}
const _LEGEND = [['#6b3a1c','DIRT 1'],['#5a5a72','STONE 2'],['#ffd23f','CHEESE/GOLD'],['#9ec8d8','ICE'],['#ff5a3a','LAVA'],['#7a3a5a','FUNGAL'],['#b055ff','CRYSTAL'],['#5ef38c','SPRING +3'],['#4a3a2a','CRACK ▼5'],['#ffd9a8','SAND slow'],['#8a4a8a','VEIN ⛏×5'],['#ffd23f','GEODE +5']];
function drawTileLegend() {
  const w = 130, h = _LEGEND.length * 12 + 22, x = 12, y = H / 2 - h / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.fillStyle = '#ffd23f'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('TILE LEGEND', x + w / 2, y + 12);
  ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  for (let i = 0; i < _LEGEND.length; i++) {
    ctx.fillStyle = _LEGEND[i][0]; ctx.fillRect(x + 6, y + 20 + i * 12, 6, 6);
    ctx.fillStyle = '#fff'; ctx.fillText(_LEGEND[i][1], x + 18, y + 25 + i * 12);
  }
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
// renderUpgrades() is intentionally NOT called per-frame anymore — it's only
// called on money mutation (mining loot, purchase). Disable/enable state needs
// to update though, so we patch it directly when money changes.
const _ddHud = {
  money: document.getElementById('hud-money'),
  depth: document.getElementById('hud-depth'),
  stam: document.getElementById('hud-stam'),
  bag: document.getElementById('hud-bag'),
  hud: document.getElementById('hud'),
  best: document.getElementById('hud-best'),
};
let _ddHudPrev = { money: -1, depth: -1, stam: -1, bag: '', pulse: false, best: '' };
let _ddBestCache = '', _ddBestCacheT = 0;
function _refreshUpgradeButtons() {
  // Cheap pass over existing buttons — toggle disabled/opacity based on money.
  const e = document.getElementById('upg-buttons');
  if (!e) return;
  const btns = e.children;
  for (let i = 0; i < UPGRADES.length && i < btns.length; i++) {
    const u = UPGRADES[i];
    const lvl = upgrades[u.id];
    const next = u.cost * (lvl + 1);
    const btn = btns[i];
    if (lvl >= u.max) { btn.disabled = true; btn.style.opacity = 0.4; }
    else if (money < next) { btn.disabled = true; btn.style.opacity = 0.5; }
    else { btn.disabled = false; btn.style.opacity = 1; }
  }
}
function updateHud() {
  if (money !== _ddHudPrev.money) {
    _ddHud.money.textContent = '$' + money;
    _ddHudPrev.money = money;
    _refreshUpgradeButtons();
  }
  if (depth !== _ddHudPrev.depth) { _ddHud.depth.textContent = depth; _ddHudPrev.depth = depth; }
  const sv = Math.floor(stam);
  if (sv !== _ddHudPrev.stam) { _ddHud.stam.textContent = sv; _ddHudPrev.stam = sv; }
  const bg = `${bag}/${maxBag}`;
  if (bg !== _ddHudPrev.bag) { _ddHud.bag.textContent = bg; _ddHudPrev.bag = bg; }
  const pulseOn = stam / maxStam < 0.25 && stam > 0;
  if (pulseOn) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.014);
    _ddHud.hud.style.filter = `drop-shadow(0 0 ${6 + pulse * 8}px rgba(255,58,58,${0.4 + pulse * 0.4}))`;
  } else if (_ddHudPrev.pulse) {
    _ddHud.hud.style.filter = '';
  }
  _ddHudPrev.pulse = pulseOn;
  const now = performance.now();
  if (now - _ddBestCacheT > 2000) {
    const best = loadBest('dungeon-diggers');
    const bestMoney = best && (best.money != null ? best.money : best.score);
    _ddBestCache = bestMoney != null ? '$' + bestMoney : '$0';
    _ddBestCacheT = now;
  }
  if (_ddBestCache !== _ddHudPrev.best) { _ddHud.best.textContent = _ddBestCache; _ddHudPrev.best = _ddBestCache; }
}

function end() {
  // Idempotent: if end() already ran (end-overlay shown), don't double-submit.
  const _endOv = document.getElementById('end-overlay');
  if (_endOv && !_endOv.hidden) { running = false; return; }
  running = false;
  // Wave 1D: bank meta gems
  metaGems += pendingMetaGems;
  try { localStorage.setItem('diggers:metaGems', metaGems); } catch {}
  // Wave 1D: record run history (last 5)
  const cause = ragedShopkeeper ? 'mauled by shopkeeper' : (boss ? 'crushed by giant pug' : 'collapsed exhausted');
  _pushRunHistory({ depth, money, cause, time: Date.now() });
  sfx.sweep(330, 80, 'sawtooth', 0.5, 0.22);
  document.getElementById('end-money').textContent = '$' + money;
  document.getElementById('end-depth').textContent = depth;
  // Round-2 polish: surface BEST COMBO on end-stats list.
  const _ddComboEl = document.getElementById('end-combo');
  if (_ddComboEl) _ddComboEl.textContent = '×' + (maxComboThisRun || 0);
  const _gemEl = document.getElementById('end-meta-gems');
  if (_gemEl) _gemEl.textContent = '+' + pendingMetaGems + ' gems banked (total: ' + metaGems + ')';
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
  try { music.setIntensity(0.4); music.play(); } catch {}
}
// Combo-driven music intensity sampler.
setInterval(() => {
  if (!running) return;
  try { music.setIntensity(Math.min(1, 0.4 + (combo || 0) * 0.08)); } catch {}
}, 400);
(function _wireDiggersMusicEnd() {
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

// Tutorial tip — shows briefly when the game starts (every match).
// Touch + desktop wording diverge so on-screen buttons match the device.
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      const msg = _isTouch
        ? 'JOYSTICK dig · BEAM button blocks cave-ins · BUY safely from shopkeepers — STEAL = hunted'
        : 'WASD dig · B = beam (blocks cave-ins) · find shopkeepers — BUY or STEAL (he hunts you!)';
      showTip(msg, 7500);
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

// Wave 1D: skill tree + run history + endless toggle wiring
(function _wave1DWiring() {
  const refreshSkillTree = () => {
    const list = document.getElementById('skilltree-list');
    const gemsEl = document.getElementById('meta-gems');
    if (gemsEl) gemsEl.textContent = metaGems;
    if (!list) return;
    list.innerHTML = '';
    for (const sk of SKILL_DEFS) {
      const lvl = skillTree[sk.id] || 0, isMax = lvl >= sk.max;
      const cost = sk.cost * (lvl + 1), canBuy = !isMax && metaGems >= cost;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'dd-skill-btn'; btn.disabled = !canBuy;
      btn.innerHTML = `<b>${sk.name}</b><br><span class="lvl">Lv ${lvl}/${sk.max}</span><span class="cost">${isMax ? 'MAX' : cost + '💎'}</span><br><i style="opacity:0.7;">${sk.desc}</i>`;
      btn.addEventListener('click', () => {
        if (!canBuy) return;
        metaGems -= cost; skillTree[sk.id] = lvl + 1; _saveSkillTree(); refreshSkillTree();
      });
      list.appendChild(btn);
    }
  };
  // POLISH ROUND 2 — sortable table view of run history
  let _histSortCol = 'time', _histSortDir = -1; // newest first by default
  const refreshHistory = () => {
    const list = document.getElementById('hist-list');
    if (!list) return;
    const hist = _loadRunHistory();
    if (!hist.length) { list.innerHTML = '<li><i>No runs yet — go dig!</i></li>'; return; }
    // Sort
    const sorted = hist.slice().sort((a, b) => {
      const av = a[_histSortCol] ?? 0, bv = b[_histSortCol] ?? 0;
      return (av < bv ? -1 : av > bv ? 1 : 0) * _histSortDir;
    });
    // Render as table
    const arrow = (col) => _histSortCol === col ? (_histSortDir < 0 ? ' is-sorted' : ' is-sorted is-asc') : '';
    list.innerHTML = `
      <table class="dd-hist-table">
        <thead><tr>
          <th data-col="depth" class="${'depth' === _histSortCol ? 'is-sorted' + (_histSortDir < 0 ? '' : ' is-asc') : ''}">▼ DEPTH</th>
          <th data-col="money" class="${'money' === _histSortCol ? 'is-sorted' + (_histSortDir < 0 ? '' : ' is-asc') : ''}">$ EARNED</th>
          <th data-col="cause">CAUSE</th>
          <th data-col="time" class="${'time' === _histSortCol ? 'is-sorted' + (_histSortDir < 0 ? '' : ' is-asc') : ''}">WHEN</th>
        </tr></thead>
        <tbody>
        ${sorted.map((r) => {
          const ago = (Date.now() - r.time) / 60000;
          const agoStr = ago < 60 ? Math.round(ago) + 'm' : ago < 1440 ? (ago / 60).toFixed(1) + 'h' : Math.floor(ago / 1440) + 'd';
          return `<tr><td>${r.depth}</td><td>$${r.money}</td><td>${r.cause}</td><td>${agoStr}</td></tr>`;
        }).join('')}
        </tbody>
      </table>
    `;
    list.querySelectorAll('th[data-col]').forEach((th) => {
      th.addEventListener('click', () => {
        const c = th.dataset.col;
        if (_histSortCol === c) _histSortDir = -_histSortDir;
        else { _histSortCol = c; _histSortDir = -1; }
        refreshHistory();
      });
    });
  };
  for (const tab of document.querySelectorAll('.dd-tab')) {
    tab.addEventListener('click', () => {
      for (const t of document.querySelectorAll('.dd-tab')) t.classList.remove('is-on');
      tab.classList.add('is-on');
      for (const p of document.querySelectorAll('.dd-panel')) p.classList.remove('is-on');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('is-on');
      if (tab.dataset.tab === 'tree') refreshSkillTree();
      if (tab.dataset.tab === 'hist') refreshHistory();
    });
  }
  const endBtn = document.getElementById('endless-toggle');
  if (endBtn) endBtn.addEventListener('click', () => {
    endlessMode = !endlessMode;
    endBtn.textContent = 'ENDLESS: ' + (endlessMode ? 'ON' : 'OFF');
  });
  refreshSkillTree(); refreshHistory();
  const startOv = document.getElementById('overlay');
  if (startOv) new MutationObserver(() => {
    if (!startOv.hidden && !startOv.classList.contains('is-hidden')) { refreshSkillTree(); refreshHistory(); }
  }).observe(startOv, { attributes: true, attributeFilter: ['hidden','class'] });
})();
