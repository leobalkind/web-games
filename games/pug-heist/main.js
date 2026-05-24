// PUG HEIST SOCIETY — top-down stealth. Avoid human vision cones.
// Bark distracts a nearby human (look toward sound for ~2s).
// Fart boost = 1.5s speed burst but increases sound radius (humans turn to you).
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon, iconSvg } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showGradeCard } from '../../src/shared/gradeCard.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'heist:muted' });
// Tense stealth pulse — intensity spikes when any guard is alerted.
const music = createMusicTrack({ mood: 'tense', tempo: 130, key: 'A', scale: 'minor' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'pug-heist', getControlsHelp: () => _isTouch
  ? 'JOYSTICK sneak · BARK / SMOKE / TONGUE / DECOY / VASE buttons · 🛒 SHOP between floors. Saved to your profile.'
  : 'WASD sneak · Q smoke · G tongue · T decoy · X throw vase · spend $$ between floors. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

// Inline pixel-art icons into the rare-loot tip in the start overlay
const _rareTip = document.querySelector('.loot-rare-tip');
if (_rareTip) {
  _rareTip.innerHTML = iconSvg.crownGold(14) + iconSvg.diamond(14) + iconSvg.camera(14);
}

// Loot types — varied values (rare = worth more). `iconName` maps to drawIcon.*
const LOOT_TYPES = [
  { iconName: 'bone',      val: 50,  rare: false },
  { iconName: 'cheese',    val: 60,  rare: false },
  { iconName: 'sock',      val: 30,  rare: false },
  { iconName: 'meat',      val: 45,  rare: false },
  { iconName: 'bacon',     val: 55,  rare: false },
  { iconName: 'sandwich',  val: 40,  rare: false },
  { iconName: 'tennisBall',val: 35,  rare: false },
  { iconName: 'crownGold', val: 200, rare: true },   // crown
  { iconName: 'diamond',   val: 150, rare: true },   // diamond
  { iconName: 'camera',    val: 120, rare: true },   // was remote — camera is the closest jackpot tech icon
];
let pug, humans, walls, loot, exitZ, floor, barkCd, fartCd, running;
// Last-shown grade-card handle so start() can dismiss it (otherwise a CAUGHT
// grade card lingers on top of the new floor when the user clicks REMATCH
// on the end overlay before the grade-card RESTART button).
let _activeGradeCard = null;
let smokeCd = 0, tongueCd = 0, decoyCd = 0;
let smokeBombs = []; // {x,y,t}
let particles = [];  // loot pickup particles
let alertedThisFloor = false;
let lootStolen = 0;
let totalLootValue = 0;
let lootValueThisFloor = 0;
let floorStartTime = 0;
// BETWEEN-FLOOR SHOP — bought upgrades persist for the rest of the run.
const HEIST_SHOP = [
  { id: 'quietPaws',  cost: 150, name: 'QUIETER PAWS', icon: '🐾', desc: 'Sound radius halved (humans react slower)' },
  { id: 'eagleEye',   cost: 200, name: 'EAGLE EYE',    icon: '👁️', desc: 'See humans through walls (HUD dots)' },
  { id: 'pockets',    cost: 100, name: 'POCKETS+',     icon: '🎒', desc: '+2 throw vases per floor' },
  { id: 'luckyCharm', cost: 250, name: 'LUCKY CHARM',  icon: '🍀', desc: '25% chance loot drops 2x value' },
];
let runUpgrades = {}; // id -> true when owned
let shopPending = false; // shows shop overlay before next floor
let pendingFloor = 0;    // floor number to load after closing shop
let achievementsSeen = new Set();
let cats = [];
// Map upgrade: room types + furniture per cell, central staircase, TV light pools.
let roomTypes = [];   // 2D array [rows][cols] = 'bedroom'|'kitchen'|'living'|'office'|'vault'
let furniture = [];   // {x, y, w, h, kind, room, ...}
let tvs = [];         // {x, y, ang, flickerT, on, intensity}
let staircase = null; // {x, y, w, h} — strong landmark in exit room
// THROW DISTRACTION mechanic
let throwsLeft = 0;
let throwCd = 0;
let vases = [];       // {x, y, vx, vy, tx, ty, t, life}  (in-flight vases)
let noiseRings = [];  // {x, y, t, life, r} (visible ping where vase landed)
// --- Juice ---
let shakeT = 0, shakeMag = 0;
let hitFlashT = 0;
// Hit-pause — short freeze on big events (knockout, alarm trigger).
let _hitstopT = 0;
let popups = []; // {x, y, text, color, t}
let lights = []; // ceiling lights placed per-floor: {x, y, flickerT, on}
let scatter = []; // floor decorations: cracks, stains, debris
let dustMotes = []; // ambient dust motes drifting
function addShake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function addPopup(x, y, text, color) {
  // Spawn with small random horizontal drift + jitter so back-to-back popups
  // don't overlap and the burst feels more "splattery". Each popup also gets
  // a small random tilt + spin so floating numbers feel hand-painted vs robotic.
  const a = (Math.random() - 0.5) * 0.8;
  popups.push({
    x: x + Math.cos(a) * 6,
    y: y + (Math.random() - 0.5) * 4,
    vx: Math.sin(a) * 18,
    text, color: color || '#ffd23f', t: 0,
    rot: (Math.random() - 0.5) * 0.25,        // initial tilt in radians (~±7°)
    spin: (Math.random() - 0.5) * 0.6,        // additional spin over lifetime
  });
  if (popups.length > 30) popups.shift();
}

function genFloor(level) {
  pug = { x: 60, y: H - 100, vx: 0, vy: 0, alive: true, fartT: 0, sound: 0 };
  walls = [];
  // Outer walls
  walls.push({ x: 0, y: 0, w: W, h: 12 });
  walls.push({ x: 0, y: H - 12, w: W, h: 12 });
  walls.push({ x: 0, y: 0, w: 12, h: H });
  walls.push({ x: W - 12, y: 0, w: 12, h: H });
  // Interior walls forming rooms (random) — with connectivity guarantee.
  // Spawn lives in cell (row=2, col=0), exit in (row=0, col=cols-1). Without a
  // guarantee, ~33% of layouts seal the spawn cell off (see git history).
  const cols = 4, rows = 3;
  const cw = W / cols, ch = H / rows;
  // vGaps[c] = set of rows where the vertical wall at column c has a door.
  // hGaps[r] = set of cols where the horizontal wall at row r has a door.
  const vGaps = []; // index by c in [1..cols-1]
  const hGaps = []; // index by r in [1..rows-1]
  for (let c = 1; c < cols; c++) vGaps[c] = new Set([Math.floor(Math.random() * rows)]);
  for (let r = 1; r < rows; r++) hGaps[r] = new Set([Math.floor(Math.random() * cols)]);
  // BFS over the cell grid using current door sets — returns true if (sr,sc) reaches (er,ec).
  const spawnR = rows - 1, spawnC = 0, exitR = 0, exitC = cols - 1;
  function reachable() {
    const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const queue = [[spawnR, spawnC]];
    seen[spawnR][spawnC] = true;
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === exitR && c === exitC) return true;
      // up — cross horizontal wall at row r (if c is in hGaps[r])
      if (r > 0 && hGaps[r] && hGaps[r].has(c) && !seen[r - 1][c]) { seen[r - 1][c] = true; queue.push([r - 1, c]); }
      // down — cross horizontal wall at row r+1 (if c is in hGaps[r+1])
      if (r < rows - 1 && hGaps[r + 1] && hGaps[r + 1].has(c) && !seen[r + 1][c]) { seen[r + 1][c] = true; queue.push([r + 1, c]); }
      // left — cross vertical wall at col c (if r is in vGaps[c])
      if (c > 0 && vGaps[c] && vGaps[c].has(r) && !seen[r][c - 1]) { seen[r][c - 1] = true; queue.push([r, c - 1]); }
      // right — cross vertical wall at col c+1 (if r is in vGaps[c+1])
      if (c < cols - 1 && vGaps[c + 1] && vGaps[c + 1].has(r) && !seen[r][c + 1]) { seen[r][c + 1] = true; queue.push([r, c + 1]); }
    }
    return false;
  }
  // Add random extra doors until spawn->exit is reachable (cap at 10 tries).
  for (let attempt = 0; attempt < 10 && !reachable(); attempt++) {
    if (Math.random() < 0.5 && cols > 1) {
      const c = 1 + Math.floor(Math.random() * (cols - 1));
      vGaps[c].add(Math.floor(Math.random() * rows));
    } else if (rows > 1) {
      const r = 1 + Math.floor(Math.random() * (rows - 1));
      hGaps[r].add(Math.floor(Math.random() * cols));
    }
  }
  // Final guarantee: if random additions failed, force-open a corridor
  // up column 0 then right along row 0 (always connects spawn → exit).
  if (!reachable()) {
    for (let r = 1; r < rows; r++) hGaps[r].add(0);            // open column 0 vertically
    for (let c = 1; c < cols; c++) vGaps[c].add(0);            // open row 0 horizontally
  }
  // Emit wall rectangles from finalized gap sets.
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!vGaps[c].has(r)) walls.push({ x: c * cw - 6, y: r * ch + 10, w: 12, h: ch - 20 });
    }
  }
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!hGaps[r].has(c)) walls.push({ x: c * cw + 10, y: r * ch - 6, w: cw - 20, h: 12 });
    }
  }
  // Cat ally: 30% chance per floor (helpful distraction NPC)
  cats = [];
  if (Math.random() < 0.3) {
    for (let tries = 0; tries < 20; tries++) {
      const x = 50 + Math.random() * (W - 100), y = 50 + Math.random() * (H - 100);
      if (!isWallNear(x, y, 18) && Math.hypot(x - pug.x, y - pug.y) > 120) {
        cats.push({ x, y, vx: 0, vy: 0, t: 0, distractT: 0 });
        break;
      }
    }
  }
  // Loot - one per room (roughly)
  loot = [];
  const lootCount = 4 + level;
  for (let i = 0; i < lootCount; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 30 + Math.random() * (W - 60);
      const y = 30 + Math.random() * (H - 60);
      if (!isWallNear(x, y, 16)) {
        // 12% rare drop chance
        const pool = Math.random() < 0.12 ? LOOT_TYPES.filter((t) => t.rare) : LOOT_TYPES.filter((t) => !t.rare);
        const ltype = pool[Math.floor(Math.random() * pool.length)];
        loot.push({ x, y, ...ltype, taken: false });
        break;
      }
    }
  }
  // Humans - 2 + level/2 (floor 1 = 1 human for a softer intro)
  humans = [];
  const humanCount = level === 1 ? 1 : 1 + Math.floor(level / 2) + 1;
  for (let i = 0; i < humanCount; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const x = W / 2 + (Math.random() - 0.5) * W * 0.5;
      const y = H / 2 + (Math.random() - 0.5) * H * 0.5;
      if (!isWallNear(x, y, 30) && Math.hypot(x - pug.x, y - pug.y) > 200) {
        humans.push({
          x, y, ang: Math.random() * Math.PI * 2, lookT: 0,
          patrol: [
            { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 },
            { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 },
          ],
          patrolIdx: 0,
          state: 'patrol',
          alertT: 0,
          distractTarget: null,
        });
        break;
      }
    }
  }
  // Exit
  exitZ = { x: W - 50, y: 50, r: 30 };
  barkCd = 0; fartCd = 0;
  smokeCd = 0; tongueCd = 0; decoyCd = 0;
  smokeBombs = []; particles = [];
  alertedThisFloor = false;
  lootValueThisFloor = 0;
  floorStartTime = performance.now();
  // Throw distraction: 2 vases per floor (+2 with POCKETS+ upgrade)
  throwsLeft = 2 + (runUpgrades.pockets ? 2 : 0);
  throwCd = 0; vases = []; noiseRings = [];
  // Assign a room "type" per cell (deterministic per floor)
  const ROOM_TYPES = ['bedroom', 'kitchen', 'living', 'office', 'vault'];
  roomTypes = [];
  for (let r = 0; r < rows; r++) {
    roomTypes[r] = [];
    for (let c = 0; c < cols; c++) {
      roomTypes[r][c] = ROOM_TYPES[(r * 11 + c * 5 + (level || 1) * 3) % ROOM_TYPES.length];
    }
  }
  // Central staircase landmark: pick the cell nearest the exit corner
  const exitCol = cols - 1, exitRow = 0;
  staircase = {
    x: exitCol * cw + cw / 2 - 38,
    y: exitRow * ch + ch / 2 + 6,
    w: 76, h: 56,
  };
  // Furniture per room — pick a few props per cell based on its type
  furniture = [];
  tvs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Skip the cell that hosts the staircase (don't overlap landmark)
      if (r === exitRow && c === exitCol) continue;
      const cx0 = c * cw, cy0 = r * ch;
      const inset = 28;
      const type = roomTypes[r][c];
      const props = roomPropList(type);
      let tries = 0;
      for (const p of props) {
        let placed = false;
        for (let k = 0; k < 18 && !placed; k++) {
          const px = cx0 + inset + Math.random() * (cw - inset * 2 - p.w);
          const py = cy0 + inset + Math.random() * (ch - inset * 2 - p.h);
          // avoid walls + already-placed furniture in this room
          const cx = px + p.w / 2, cy = py + p.h / 2;
          if (isWallNear(cx, cy, Math.max(p.w, p.h) / 2 + 4)) continue;
          let overlap = false;
          for (const f of furniture) {
            if (f.room && f.room.r === r && f.room.c === c) {
              if (px < f.x + f.w + 6 && px + p.w + 6 > f.x && py < f.y + f.h + 6 && py + p.h + 6 > f.y) {
                overlap = true; break;
              }
            }
          }
          if (overlap) continue;
          const item = { x: px, y: py, w: p.w, h: p.h, kind: p.kind, room: { r, c } };
          furniture.push(item);
          if (p.kind === 'tv') tvs.push({ x: px + p.w / 2, y: py + p.h / 2, ang: Math.PI / 2, flickerT: 0, on: true, intensity: 0.7 });
          placed = true;
        }
        tries++;
      }
    }
  }
  // Ceiling lights — one per "room" cell
  lights = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      lights.push({
        x: c * cw + cw / 2,
        y: r * ch + ch / 2,
        flickerT: Math.random() * 2,
        on: true,
        broken: Math.random() < 0.18,
      });
    }
  }
  // Floor decor: deterministic-ish scatter (cracks, stains, debris)
  scatter = [];
  for (let i = 0; i < 70; i++) {
    const x = 16 + Math.random() * (W - 32), y = 16 + Math.random() * (H - 32);
    if (isWallNear(x, y, 8)) continue;
    const k = Math.random();
    if (k < 0.35) scatter.push({ kind: 'crack', x, y, ang: Math.random() * Math.PI, len: 14 + Math.random() * 22 });
    else if (k < 0.6) scatter.push({ kind: 'stain', x, y, r: 6 + Math.random() * 10, color: Math.random() < 0.5 ? 'rgba(110,30,30,0.35)' : 'rgba(20,12,30,0.4)' });
    else if (k < 0.85) scatter.push({ kind: 'debris', x, y, sz: 4 + Math.random() * 5 });
    else scatter.push({ kind: 'tile', x, y, sz: 24 + Math.random() * 16 });
  }
  // Dust motes (ambient drift)
  dustMotes = [];
  for (let i = 0; i < 24; i++) {
    dustMotes.push({ x: Math.random() * W, y: Math.random() * H, vx: -6 + Math.random() * 12, vy: -3 + Math.random() * 6, r: 1 + Math.random() * 1.6 });
  }
  shakeT = 0; shakeMag = 0; hitFlashT = 0;
  popups = [];
}

function isWallNear(x, y, r) {
  for (const w of walls) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  return false;
}
// Wrap angle delta to [-PI, PI] — used by ghost-cone heading diff check.
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Predict where a guard will be FACING in ~1.5s. For patrol: angle to the
// upcoming waypoint after the current one (or pause-turn at current target).
// For distracted: angle to the distraction. Returns null if can't predict.
function predictGuardAngle(h) {
  if (h.state === 'distracted' && h.distractTarget) {
    return Math.atan2(h.distractTarget.y - h.y, h.distractTarget.x - h.x);
  }
  if (!h.patrol || h.patrol.length === 0) return null;
  // Current target — guard is moving toward / pausing at this
  const curr = h.patrol[h.patrolIdx];
  const distToCurr = Math.hypot(curr.x - h.x, curr.y - h.y);
  // If close to current target, guard will rotate to next waypoint shortly
  if (distToCurr < 80) {
    const nextIdx = (h.patrolIdx + 1) % h.patrol.length;
    const next = h.patrol[nextIdx];
    return Math.atan2(next.y - curr.y, next.x - curr.x);
  }
  // Otherwise, still heading toward current → ghost = same as current; skip drawing
  return Math.atan2(curr.y - h.y, curr.x - h.x);
}

// Camera: 1.25x zoom centered on pug, clamped to world bounds (0,0)→(W,H).
const CAM_ZOOM = 1.25;
function getCamera() {
  const viewW = W / CAM_ZOOM, viewH = H / CAM_ZOOM;
  const cx = pug ? pug.x : W / 2;
  const cy = pug ? pug.y : H / 2;
  let camX = cx - viewW / 2;
  let camY = cy - viewH / 2;
  camX = Math.max(0, Math.min(W - viewW, camX));
  camY = Math.max(0, Math.min(H - viewH, camY));
  return { x: camX, y: camY, zoom: CAM_ZOOM };
}
// Convert screen-space (clientX/clientY) coords into world coords for input.
function screenToWorld(sx, sy) {
  const cam = getCamera();
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
}

function rectCollide(e, dx, dy) {
  const r = 10;
  const nx = e.x + dx;
  if (!isWallNear(nx, e.y, r)) e.x = nx;
  const ny = e.y + dy;
  if (!isWallNear(e.x, ny, r)) e.y = ny;
}
// Generic radius-aware move (used by cats; was previously called undefined)
function move(e, dx, dy, r) {
  const _r = r || 10;
  const nx = e.x + dx;
  if (!isWallNear(nx, e.y, _r)) e.x = nx;
  const ny = e.y + dy;
  if (!isWallNear(e.x, ny, _r)) e.y = ny;
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  // Skip when typing in a text field (e.g. profile-rename modal).
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  // Block browser shortcuts (e.g. Quick Find on /, scroll on space) for keys we own.
  if (e.code === 'Space' || ['q','g','t','x','w','a','s','d'].includes(k)) e.preventDefault();
  if (e.key === ' ' || e.code === 'Space') doBark();
  if (e.key === 'Shift' || k === 'shift') doFart();
  if (k === 'q') doSmoke();
  if (k === 'g') doTongue();
  if (k === 't') doDecoy();
  if (k === 'x') doThrow();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
// Mobile controls — wasd-only joystick + action buttons. Buttons synth keys so
// the existing keydown handlers (Q smoke, T decoy, X throw, etc.) just fire.
createMobileControls({
  layout: 'wasd-only',
  keys,
  buttons: [
    { id: 'bark',   label: 'BARK',  key: 'Space' },
    { id: 'fart',   label: 'BOOST', key: 'Shift' },
    { id: 'smoke',  label: 'SMOKE', key: 'Q' },
    { id: 'throw',  label: 'THROW', key: 'X' },
    { id: 'decoy',  label: 'DECOY', key: 'T' },
  ],
  getCanvas: () => canvas,
});
let touchAim = null;
const _throwBtn = document.getElementById('throw-btn');
if (_throwBtn) {
  _throwBtn.addEventListener('click', doThrow);
  if ('ontouchstart' in window) _throwBtn.style.display = 'block';
}
canvas.addEventListener('touchstart', (e) => { touchAim = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAim = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAim = null);

function doBark() {
  if (barkCd > 0 || !running) return;
  barkCd = 5;
  sfx.tone(440, 'square', 0.15, 0.22);
  // Find nearest human and distract toward a random direction
  let near = null, bestD = 200;
  for (const h of humans) {
    const d = Math.hypot(h.x - pug.x, h.y - pug.y);
    if (d < bestD) { bestD = d; near = h; }
  }
  if (near) {
    // distract toward a random position AWAY from pug
    const ang = Math.atan2(pug.y - near.y, pug.x - near.x) + Math.PI; // opposite of pug
    near.distractTarget = {
      x: near.x + Math.cos(ang) * 200,
      y: near.y + Math.sin(ang) * 200,
    };
    near.state = 'distracted';
    near.alertT = 2.0;
  }
}

function doSmoke() {
  if (smokeCd > 0 || !running) return;
  smokeCd = 7;
  // 3s smoke cloud at pug position, blocks vision cones in radius 90
  smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 3 });
  sfx.tone(330, 'sawtooth', 0.2, 0.2);
}
function doTongue() {
  if (tongueCd > 0 || !running) return;
  // Grab nearest visible loot within 180px
  let near = null, bestD = 180;
  for (const lt of loot) {
    if (lt.taken) continue;
    const d = Math.hypot(lt.x - pug.x, lt.y - pug.y);
    if (d < bestD) { bestD = d; near = lt; }
  }
  if (near) {
    near.taken = true;
    // LUCKY CHARM: 25% chance loot drops 2x value
    const mult = (runUpgrades.luckyCharm && Math.random() < 0.25) ? 2 : 1;
    const val = near.val * mult;
    lootValueThisFloor += val;
    totalLootValue += val;
    lootStolen++;
    tongueCd = 4;
    sfx.tone(880, 'triangle', 0.1, 0.22);
    spawnParticles(near.x, near.y, mult > 1 ? '#ffd23f' : '#ff5a82');
    if (mult > 1) addPopup(near.x, near.y - 6, 'LUCKY! +$' + val, '#ffd23f');
  } else {
    tongueCd = 1; // short cooldown on whiff
    sfx.tone(220, 'sawtooth', 0.08, 0.16);
  }
}
function doDecoy() {
  if (decoyCd > 0 || !running) return;
  decoyCd = 8;
  // Distract nearest human: walk away from pug for 4s
  let near = null, bestD = 280;
  for (const h of humans) {
    const d = Math.hypot(h.x - pug.x, h.y - pug.y);
    if (d < bestD) { bestD = d; near = h; }
  }
  if (near) {
    const ang = Math.atan2(near.y - pug.y, near.x - pug.x);
    near.distractTarget = { x: near.x + Math.cos(ang) * 220, y: near.y + Math.sin(ang) * 220 };
    near.state = 'distracted'; near.alertT = 4.0;
  }
  sfx.tone(440, 'square', 0.1, 0.2);
}
// Room furniture catalog — kinds rendered in render() below
function roomPropList(type) {
  switch (type) {
    case 'bedroom':
      return [
        { kind: 'bed',     w: 56, h: 38 },
        { kind: 'lamp',    w: 14, h: 14 },
        { kind: 'dresser', w: 36, h: 18 },
        { kind: 'rug',     w: 60, h: 36 },
        { kind: 'painting',w: 28, h: 4 },
      ];
    case 'kitchen':
      return [
        { kind: 'counter', w: 64, h: 18 },
        { kind: 'fridge',  w: 24, h: 30 },
        { kind: 'kettle',  w: 14, h: 14 },
        { kind: 'stool',   w: 12, h: 12 },
        { kind: 'tiles',   w: 50, h: 30 },
      ];
    case 'living':
      return [
        { kind: 'couch',   w: 64, h: 22 },
        { kind: 'tv',      w: 36, h: 14 },
        { kind: 'rug',     w: 70, h: 42 },
        { kind: 'plant',   w: 14, h: 22 },
        { kind: 'coffee',  w: 30, h: 16 },
      ];
    case 'office':
      return [
        { kind: 'desk',    w: 52, h: 22 },
        { kind: 'monitor', w: 22, h: 14 },
        { kind: 'chair',   w: 18, h: 18 },
        { kind: 'cabinet', w: 24, h: 30 },
        { kind: 'painting',w: 28, h: 4 },
      ];
    case 'vault':
      return [
        { kind: 'safe',    w: 32, h: 32 },
        { kind: 'painting',w: 32, h: 4 },
        { kind: 'vase',    w: 12, h: 16 },
        { kind: 'vase',    w: 12, h: 16 },
        { kind: 'pedestal',w: 18, h: 18 },
      ];
    default:
      return [];
  }
}

function doThrow() {
  if (throwCd > 0 || !running || throwsLeft <= 0) return;
  throwCd = 6;
  throwsLeft--;
  // Throw direction: last movement direction OR (if stopped) facing right
  let dx = 0, dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;
  if (touchAim) {
    const wp = screenToWorld(touchAim.clientX, touchAim.clientY);
    dx = wp.x - pug.x; dy = wp.y - pug.y;
  }
  const l = Math.hypot(dx, dy);
  if (l < 0.1) { dx = 1; dy = 0; } else { dx /= l; dy /= l; }
  // Land target: 180px ahead, clamped inside walls
  let tx = pug.x + dx * 180, ty = pug.y + dy * 180;
  tx = Math.max(20, Math.min(W - 20, tx));
  ty = Math.max(20, Math.min(H - 20, ty));
  // Stop at first wall along path
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sx = pug.x + (tx - pug.x) * t;
    const sy = pug.y + (ty - pug.y) * t;
    if (isWallNear(sx, sy, 4)) {
      tx = pug.x + (tx - pug.x) * ((i - 1) / steps);
      ty = pug.y + (ty - pug.y) * ((i - 1) / steps);
      break;
    }
  }
  vases.push({ x: pug.x, y: pug.y, sx: pug.x, sy: pug.y, tx, ty, t: 0, life: 0.4 });
  sfx.tone(560, 'triangle', 0.08, 0.18);
}

function spawnParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 80;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 0.6, t: 0, size: 3 });
  }
}

function doFart() {
  if (fartCd > 0 || !running) return;
  fartCd = 6;
  pug.fartT = 1.5;
  pug.sound = 1; // big sound
  sfx.tone(110, 'sawtooth', 0.4, 0.25);
}

function tick(dt) {
  // Tick the knock-out animation independently of running so the ragdoll
  // keeps falling even after running=false.
  if (pug && pug.knockedT != null) pug.knockedT += dt;
  if (!running) return;
  if (shopPending) return; // pause world while shop overlay is open
  // Hit-pause — freeze the world for a few frames after a knockout (set in caught()).
  if (_hitstopT && _hitstopT > 0) { _hitstopT -= dt; return; }
  barkCd = Math.max(0, barkCd - dt);
  fartCd = Math.max(0, fartCd - dt);
  pug.fartT = Math.max(0, pug.fartT - dt);
  pug.sound = Math.max(0, pug.sound - dt * 0.5);

  // Move
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchAim) {
    const wp = screenToWorld(touchAim.clientX, touchAim.clientY);
    mx = wp.x - pug.x; my = wp.y - pug.y;
    const l = Math.hypot(mx, my);
    if (l > 20) { mx /= l; my /= l; } else { mx = 0; my = 0; }
  }
  // Subtle acceleration ramp from rest — feels weightier than instant zoom.
  // Smooth blend toward target velocity, then apply that velocity via rectCollide.
  const targetSpeed = (pug.fartT > 0 ? 220 : 110);
  let tvx = 0, tvy = 0;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    tvx = (mx / l) * targetSpeed;
    tvy = (my / l) * targetSpeed;
  }
  if (pug._mvx == null) { pug._mvx = 0; pug._mvy = 0; }
  // accel = 14 → reaches ~95% of target in 0.2s; gives just-enough heft.
  const accel = 14;
  const blend = Math.min(1, accel * dt);
  pug._mvx += (tvx - pug._mvx) * blend;
  pug._mvy += (tvy - pug._mvy) * blend;
  if (Math.abs(pug._mvx) > 0.5 || Math.abs(pug._mvy) > 0.5) {
    rectCollide(pug, pug._mvx * dt, pug._mvy * dt);
  } else { pug._mvx = 0; pug._mvy = 0; }

  // Loot pickup
  for (const lt of loot) {
    if (lt.taken) continue;
    if (Math.hypot(lt.x - pug.x, lt.y - pug.y) < 20) {
      lt.taken = true;
      // LUCKY CHARM: 25% chance loot drops 2x value
      const mult = (runUpgrades.luckyCharm && Math.random() < 0.25) ? 2 : 1;
      const val = lt.val * mult;
      lootValueThisFloor += val;
      totalLootValue += val;
      lootStolen++;
      sfx.tone(lt.rare ? 1320 : 880, 'triangle', 0.1, 0.22);
      spawnParticles(lt.x, lt.y, lt.rare || mult > 1 ? '#ffd23f' : '#5ef38c');
      addPopup(lt.x, lt.y - 6, (mult > 1 ? 'LUCKY! +$' : '+$') + val, lt.rare || mult > 1 ? '#ffd23f' : '#5ef38c');
      if (lt.rare || mult > 1) addShake(3, 0.15);
      // Sweetener "ping" sparkle when the entire floor is undetected — bigger
      // burst + ascending tone so a stealth-perfect grab feels rewarding.
      if (!alertedThisFloor) {
        sfx.tone(lt.rare ? 1760 : 1320, 'triangle', 0.05, 0.18);
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 80 + Math.random() * 60;
          particles.push({
            x: lt.x, y: lt.y,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
            color: '#b0e8ff', life: 0.55, t: 0, size: 2,
          });
        }
      }
    }
  }
  // Gadget cooldown decay
  smokeCd = Math.max(0, smokeCd - dt);
  tongueCd = Math.max(0, tongueCd - dt);
  decoyCd = Math.max(0, decoyCd - dt);
  throwCd = Math.max(0, throwCd - dt);
  // Vases: arc through air; on land create noise ring + distract nearest human within 200px
  for (let i = vases.length - 1; i >= 0; i--) {
    const v = vases[i];
    v.t += dt;
    if (v.t >= v.life) {
      const lx = v.tx, ly = v.ty;
      noiseRings.push({ x: lx, y: ly, t: 0, life: 1.4, r: 0 });
      // Particle burst (vase shatter)
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2;
        const s = 50 + Math.random() * 90;
        particles.push({ x: lx, y: ly, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: '#e0d8c4', life: 0.5, t: 0, size: 3 });
      }
      sfx.tone(220, 'square', 0.06, 0.22);
      addShake(2, 0.1);
      // Distract nearest human within 200px of landing
      let near = null, bestD = 200;
      for (const h of humans) {
        const d = Math.hypot(h.x - lx, h.y - ly);
        if (d < bestD) { bestD = d; near = h; }
      }
      if (near) {
        near.distractTarget = { x: lx, y: ly };
        near.state = 'distracted';
        near.alertT = 3.2;
      }
      vases.splice(i, 1);
    }
  }
  // Noise rings expand visually — Perf: in-place prune.
  for (let i = noiseRings.length - 1; i >= 0; i--) {
    const n = noiseRings[i];
    n.t += dt;
    n.r = (n.t / n.life) * 120;
    if (n.t >= n.life) noiseRings.splice(i, 1);
  }
  // TV flicker
  for (const tv of tvs) {
    tv.flickerT -= dt;
    if (tv.flickerT <= 0) {
      tv.intensity = 0.5 + Math.random() * 0.5;
      tv.flickerT = 0.08 + Math.random() * 0.18;
    }
  }
  // Cat ally — wanders, periodically distracts a random human
  for (const c of cats) {
    c.t += dt;
    c.distractT -= dt;
    if (Math.random() < dt * 0.5) {
      const a = Math.random() * Math.PI * 2;
      c.vx = Math.cos(a) * 30; c.vy = Math.sin(a) * 30;
    }
    move(c, c.vx * dt, c.vy * dt, 8);
    // Every ~4s, distract one random human
    if (c.distractT <= 0 && humans.length > 0) {
      c.distractT = 4 + Math.random() * 3;
      const h = humans[Math.floor(Math.random() * humans.length)];
      h.distractTarget = { x: c.x, y: c.y };
      h.state = 'distracted';
      h.alertT = 2.0;
    }
  }
  // Smoke bombs
  for (let i = smokeBombs.length - 1; i >= 0; i--) {
    const s = smokeBombs[i];
    s.t += dt;
    if (s.t >= s.life) smokeBombs.splice(i, 1);
  }
  // Particles — Perf: prune in-place via reverse-iter splice.
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95;
    if (p.t >= p.life) particles.splice(i, 1);
  }
  if (particles.length > 200) particles.splice(0, particles.length - 200);
  // Juice tick
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  if (hitFlashT > 0) hitFlashT = Math.max(0, hitFlashT - dt);
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.t += dt;
    p.y -= 28 * dt;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 1 - dt * 2; }
    if (p.t >= 1.2) popups.splice(i, 1);
  }
  if (popups.length > 30) popups.splice(0, popups.length - 30);
  // Light flicker tick
  for (const l of lights) {
    l.flickerT -= dt;
    if (l.flickerT <= 0) {
      l.on = l.broken ? Math.random() < 0.55 : Math.random() < 0.95;
      l.flickerT = l.broken ? 0.05 + Math.random() * 0.2 : 0.6 + Math.random() * 3;
    }
  }
  // Dust drift
  for (const d of dustMotes) {
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (d.x < -4) d.x = W + 4;
    if (d.x > W + 4) d.x = -4;
    if (d.y < -4) d.y = H + 4;
    if (d.y > H + 4) d.y = -4;
  }
  // Exit check
  if (loot.every((l) => l.taken)) {
    if (Math.hypot(exitZ.x - pug.x, exitZ.y - pug.y) < exitZ.r) {
      // Trigger BETWEEN-FLOOR SHOP overlay before advancing
      pendingFloor = floor + 1;
      shopPending = true;
      sfx.arp([523, 659, 784], 'triangle', 0.08, 0.22, 0.2);
      // S/A/B/C/D grade card — wraps openHeistShop on dismissal
      showFloorGrade(true);
      return;
    }
  }

  // Humans
  for (const h of humans) {
    if (h.lookT > 0) h.lookT -= dt;
    if (h.alertT > 0) h.alertT -= dt;
    if (h.state === 'patrol') {
      const target = h.patrol[h.patrolIdx];
      const dx = target.x - h.x, dy = target.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 20) {
        h.patrolIdx = (h.patrolIdx + 1) % h.patrol.length;
        h.lookT = 1.2; // pause to look
      } else if (h.lookT <= 0) {
        h.ang = Math.atan2(dy, dx);
        rectCollide(h, (dx / d) * 50 * dt, (dy / d) * 50 * dt);
      }
    } else if (h.state === 'distracted' && h.distractTarget) {
      const dx = h.distractTarget.x - h.x, dy = h.distractTarget.y - h.y;
      const d = Math.hypot(dx, dy);
      h.ang = Math.atan2(dy, dx);
      if (d > 20) rectCollide(h, (dx / d) * 60 * dt, (dy / d) * 60 * dt);
      if (h.alertT <= 0) { h.state = 'patrol'; h.distractTarget = null; }
    }
    // Vision cone check — pug in TV light gets spotted easier (cone reach +40)
    const dx = pug.x - h.x, dy = pug.y - h.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let diff = ang - h.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    let coneReach = 180;
    for (const tv of tvs) {
      // TV light pool is a downward 80px-radius half-disc in front of the screen
      const tdx = pug.x - tv.x, tdy = pug.y - tv.y;
      if (tdy > -10 && Math.hypot(tdx, tdy) < 80) { coneReach = 220; break; }
    }
    const inCone = d < coneReach && Math.abs(diff) < 0.6;
    // line-of-sight: any wall between?
    let blocked = false;
    if (inCone) {
      const steps = 16;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const sx = h.x + (pug.x - h.x) * t;
        const sy = h.y + (pug.y - h.y) * t;
        if (isWallNear(sx, sy, 2)) { blocked = true; break; }
        // Smoke blocks vision
        for (const sb of smokeBombs) {
          if (Math.hypot(sx - sb.x, sy - sb.y) < 90) { blocked = true; break; }
        }
        if (blocked) break;
      }
    }
    // Cone-color escalation: mark suspicion based on closeness
    if (inCone && d < 240) h._closeT = (h._closeT || 0) + dt; else h._closeT = Math.max(0, (h._closeT || 0) - dt);
    if (inCone && !blocked) { alertedThisFloor = true; caught(); }
    // Sound detection (QUIETER PAWS: halve effective sound radius)
    const soundReach = runUpgrades.quietPaws ? 120 : 240;
    if (pug.sound > 0.6 && d < soundReach) {
      // turn toward sound
      h.ang = ang;
      h.state = 'distracted';
      h.distractTarget = { x: pug.x, y: pug.y };
      h.alertT = 1.5;
    }
  }
  updateHud();
}

function caught() {
  if (!running) return;
  // Stronger event: bigger shake + screen-edge red flash + brief hit-pause.
  addShake(14, 0.45);
  hitFlashT = 0.45;
  // Player ragdoll: tilt + drop animation while end overlay slides in.
  if (pug) {
    pug.knockedT = 0;
    pug.knockedAng = (Math.random() - 0.5) * 1.2; // random fall angle
  }
  // Hit-pause: freeze the world for 0.12s so the knockout reads.
  _hitstopT = 0.12;
  running = false;
  sfx.sweep(220, 80, 'sawtooth', 0.6, 0.3);
  const g = calcGrade();
  document.getElementById('end-title').textContent = `CAUGHT! · GRADE ${g.grade}`;
  document.getElementById('end-sub').textContent = `${g.desc}. Final haul: $${totalLootValue}.`;
  document.getElementById('end-floor').textContent = floor;
  document.getElementById('end-loot').textContent = lootStolen;
  const score = floor * 100 + totalLootValue;
  const { isNewBest, current } = submitRun('pug-heist', { score, floor, value: totalLootValue });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { floor };
    bestEl.innerHTML = `Best: <b>${b.floor} floors · $${b.value || 0}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // Grade card layered above the end-overlay buttons (per the spec).
  showFloorGrade(false);
}

function render() {
  // Screen shake offset
  let _sx = 0, _sy = 0;
  if (shakeT > 0 && shakeMag > 0) {
    const k = Math.min(1, shakeT / 0.3);
    _sx = (Math.random() - 0.5) * shakeMag * 2 * k;
    _sy = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  ctx.save();
  ctx.translate(_sx, _sy);
  // Camera: pug-centered 1.25x zoom, clamped to (0,0)→(W,H) world bounds.
  // Applied here so everything inside this save block draws in world space.
  const _cam = getCamera();
  ctx.scale(_cam.zoom, _cam.zoom);
  ctx.translate(-_cam.x, -_cam.y);
  // BG: vary tile color by room cell (bedroom / hallway / vault look)
  const cols = 4, rows = 3;
  const cw = W / cols, ch = H / rows;
  // Per-floor master palette — each floor feels like a different house
  const floorPalettes = [
    // floor 1: tan/beige bungalow
    [['#5a4530', '#4a3520'], ['#6a4540', '#52302e'], ['#5a5036', '#42381f'], ['#5a4830', '#42321f'], ['#5a4030', '#3a2820']],
    // floor 2: blue/grey condo
    [['#2a3a4a', '#1e2e3a'], ['#3a3a52', '#2e2e42'], ['#3a4a5a', '#28384a'], ['#2a3a52', '#1e2e42'], ['#324050', '#202e3e']],
    // floor 3: maroon mansion
    [['#5a2030', '#42121f'], ['#5a3030', '#42201f'], ['#3a1a28', '#2a0a18'], ['#5a2a3a', '#42182a'], ['#502028', '#3a0e1a']],
    // floor 4: emerald villa
    [['#2a4a3a', '#1e3a2e'], ['#345240', '#1e3a28'], ['#3a5a42', '#1e3a2e'], ['#2a4032', '#1a2e22'], ['#42584a', '#1e3a30']],
    // floor 5: deep purple penthouse
    [['#3a2a5a', '#2e2148'], ['#4a2a52', '#341e3a'], ['#3a1e4a', '#28104a'], ['#4a3a5a', '#2e1e42'], ['#3a2a52', '#221842']],
  ];
  const palettes = floorPalettes[((floor || 1) - 1) % floorPalettes.length];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = palettes[(r * 7 + c * 3 + (floor || 1)) % palettes.length];
      ctx.fillStyle = p[0];
      ctx.fillRect(c * cw, r * ch, cw, ch);
      // checker
      ctx.fillStyle = p[1];
      for (let y = 0; y < ch; y += 40) {
        for (let x = 0; x < cw; x += 40) {
          if (((x / 40) + (y / 40)) % 2 === 0) ctx.fillRect(c * cw + x, r * ch + y, 40, 40);
        }
      }
    }
  }
  // tile borders
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
  }
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke();
  }
  // Floor scatter (cracks, stains, debris, tile accents)
  for (const s of scatter) {
    if (s.kind === 'crack') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.ang);
      ctx.beginPath();
      ctx.moveTo(-s.len / 2, 0);
      ctx.lineTo(-s.len / 4, -2);
      ctx.lineTo(s.len / 4, 1);
      ctx.lineTo(s.len / 2, 0);
      ctx.stroke();
      ctx.restore();
    } else if (s.kind === 'stain') {
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === 'debris') {
      ctx.fillStyle = 'rgba(40,28,52,0.7)';
      ctx.fillRect(s.x, s.y, s.sz, s.sz);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(s.x, s.y + s.sz - 1, s.sz, 1);
    } else if (s.kind === 'tile') {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x, s.y, s.sz, s.sz);
    }
  }
  // Staircase landmark (isometric-style stack of nested rects)
  if (staircase) {
    const s = staircase;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(s.x - 4, s.y + s.h - 4, s.w + 8, 8);
    // nested treads — each step a darker rect, offset upward
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const f = i / steps;
      const treadW = s.w * (1 - f * 0.45);
      const treadH = s.h / steps;
      const tx = s.x + (s.w - treadW) / 2;
      const ty = s.y + s.h - (i + 1) * treadH;
      ctx.fillStyle = i % 2 === 0 ? '#4a3424' : '#3a2818';
      ctx.fillRect(tx, ty, treadW, treadH);
      // tread highlight
      ctx.fillStyle = 'rgba(255,210,150,0.25)';
      ctx.fillRect(tx, ty, treadW, 1);
      // tread shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(tx, ty + treadH - 1, treadW, 1);
    }
    // top arrow "UP" hint
    ctx.fillStyle = '#ffd23f';
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('STAIRS', s.x + s.w / 2, s.y - 4);
  }
  // Furniture (per room)
  for (const f of furniture) drawFurniture(f);
  // TV-cast flickering light pool on the floor in front of the TV
  for (const tv of tvs) {
    const intensity = tv.intensity || 0.6;
    const grd = ctx.createRadialGradient(tv.x, tv.y + 18, 4, tv.x, tv.y + 18, 80);
    grd.addColorStop(0, `rgba(120,180,255,${0.32 * intensity})`);
    grd.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(tv.x, tv.y + 18, 80, 0, Math.PI * 2); ctx.fill();
  }
  // Walls — thicker with highlight/shadow for depth
  ctx.fillStyle = '#1a0d05';
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
  // top highlight
  ctx.fillStyle = '#6b3a1c';
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, Math.min(3, w.h));
  // side highlight (left)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (const w of walls) ctx.fillRect(w.x + w.w - 2, w.y + 2, 2, w.h - 2);
  // Loot — pixel-art icons from shared library
  for (const lt of loot) {
    if (lt.taken) continue;
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    const fn = drawIcon[lt.iconName];
    if (fn) fn(ctx, lt.x, lt.y, 22);
    ctx.shadowBlur = 0;
  }
  // Loot-value tooltip — Monaco-style: hover/proximity reveals value BEFORE
  // pickup, so the player can decide to skip the $30 sock vs grab the $200 crown.
  for (const lt of loot) {
    if (lt.taken) continue;
    const d = Math.hypot(lt.x - pug.x, lt.y - pug.y);
    if (d > 80) continue;
    const alpha = Math.max(0.25, Math.min(1, (80 - d) / 50));
    const name = lt.iconName.replace(/([A-Z])/g, ' $1').toUpperCase();
    const label = `${name} · $${lt.val}`;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    const ly = lt.y - 22;
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.82})`;
    ctx.fillRect(lt.x - tw / 2 - 4, ly - 7, tw + 8, 11);
    ctx.fillStyle = lt.rare ? `rgba(255,210,63,${alpha})` : `rgba(94,243,140,${alpha})`;
    ctx.fillText(label, lt.x, ly + 1);
  }
  // Exit zone (only when all loot taken)
  if (loot.every((l) => l.taken)) {
    ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 3;
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(exitZ.x, exitZ.y, exitZ.r + Math.sin(performance.now() / 200) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#5ef38c'; ctx.font = "20px sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitZ.x, exitZ.y + 6);
  }
  // Humans + vision cones (color shifts with suspicion)
  for (const h of humans) {
    // cone color: yellow safe → orange suspicious → red alerted
    const sus = Math.min(1, (h._closeT || 0) / 1.5);
    const alert = h.alertT > 0 ? 1 : 0;
    const r = Math.max(255, Math.floor(255));
    const g = alert ? 58 : Math.floor(210 - sus * 130);
    const b = alert ? 58 : Math.floor(63 - sus * 5);
    // GHOST CONE — faint preview of where guard will be facing in ~1.5s.
    // Hitman-GO-style readability: lets players plan peeks. Hidden while alerted.
    if (!alert) {
      const ghostAng = predictGuardAngle(h);
      if (ghostAng !== null && Math.abs(angDiff(ghostAng, h.ang)) > 0.08) {
        ctx.fillStyle = `rgba(${r},${g},${b},0.08)`;
        ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(h.x, h.y);
        ctx.arc(h.x, h.y, 180, ghostAng - 0.6, ghostAng + 0.6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.fillStyle = `rgba(${r},${g},${b},0.20)`;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.arc(h.x, h.y, 180, h.ang - 0.6, h.ang + 0.6);
    ctx.closePath(); ctx.fill();
    // body — high-detail human-pug
    drawPug(ctx, h.x, h.y, { size: 32, body: '#a89888', mask: '#3a2810' });
    // facing dot
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(h.x + Math.cos(h.ang) * 10, h.y + Math.sin(h.ang) * 10, 3, 0, Math.PI * 2); ctx.fill();
    if (h.alertT > 0) {
      ctx.fillStyle = '#ff3a3a'; ctx.font = "12px sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('?', h.x, h.y - 22);
    }
  }
  // Smoke bombs — thicker cloud: bigger core, more puffs, second swirl ring.
  for (const sb of smokeBombs) {
    const a = sb.t < 0.4 ? sb.t / 0.4 : (sb.t > 2.5 ? (sb.life - sb.t) / 0.5 : 1);
    // Dark base (slightly bigger).
    ctx.fillStyle = `rgba(40,40,50,${a * 0.78})`;
    ctx.beginPath(); ctx.arc(sb.x, sb.y, 96, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(70,70,80,${a * 0.65})`;
    ctx.beginPath(); ctx.arc(sb.x, sb.y, 70, 0, Math.PI * 2); ctx.fill();
    // Inner swirl ring — 12 puffs (was 8) at varied radii for dense look.
    ctx.fillStyle = `rgba(150,150,160,${a * 0.55})`;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + sb.t * 0.5;
      const rr = 56 + Math.sin(sb.t * 3 + i) * 12;
      ctx.beginPath(); ctx.arc(sb.x + Math.cos(ang) * rr, sb.y + Math.sin(ang) * rr, 22, 0, Math.PI * 2); ctx.fill();
    }
    // Outer faint puff layer — pushes the cloud edge outward.
    ctx.fillStyle = `rgba(110,110,120,${a * 0.35})`;
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 - sb.t * 0.4;
      const rr = 84 + Math.sin(sb.t * 2 + i * 0.7) * 8;
      ctx.beginPath(); ctx.arc(sb.x + Math.cos(ang) * rr, sb.y + Math.sin(ang) * rr, 16, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Particles
  for (const p of particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  // Noise rings (where vase landed)
  for (const n of noiseRings) {
    const a = Math.max(0, 1 - n.t / n.life);
    ctx.strokeStyle = `rgba(255,210,63,${a * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,210,63,${a * 0.5})`;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.6, 0, Math.PI * 2); ctx.stroke();
  }
  // Vases in flight (arc trajectory with little "lift")
  for (const v of vases) {
    const t = v.t / v.life;
    const cx = v.sx + (v.tx - v.sx) * t;
    const cy = v.sy + (v.ty - v.sy) * t - Math.sin(t * Math.PI) * 28; // arc up
    // shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(v.sx + (v.tx - v.sx) * t, v.sy + (v.ty - v.sy) * t + 4, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
    // vase body
    ctx.fillStyle = '#8a4a9a'; ctx.fillRect(cx - 4, cy - 6, 8, 12);
    ctx.fillStyle = '#aa6abe'; ctx.fillRect(cx - 3, cy - 5, 6, 2);
    ctx.fillStyle = '#5a2a6a'; ctx.fillRect(cx - 4, cy + 4, 8, 2);
  }
  // Cat allies — small grey pug variant
  for (const c of cats) {
    drawPug(ctx, c.x, c.y, { size: 22, body: '#5a5a5a', mask: '#2a2a2a', tongueOut: false });
    ctx.fillStyle = '#5ef38c'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('ALLY', c.x, c.y - 22);
  }
  // Pug — hero (with hit flash overlay + ragdoll tilt if knocked out)
  const isKnocked = pug.knockedT != null;
  if (isKnocked) {
    // Tilt + drop animation: rotates to knockedAng over ~0.5s, fades to 0.6 alpha.
    ctx.save();
    const fall = Math.min(1, pug.knockedT / 0.5);
    ctx.translate(pug.x, pug.y);
    ctx.rotate(pug.knockedAng * fall);
    ctx.translate(-pug.x, -pug.y + fall * 6);
    ctx.globalAlpha = 0.6 + 0.4 * (1 - fall);
  }
  if (hitFlashT > 0) {
    ctx.save(); ctx.filter = 'brightness(2.5) saturate(0)';
    drawPug(ctx, pug.x, pug.y, { size: 30 });
    ctx.filter = 'none'; ctx.restore();
  } else {
    drawPug(ctx, pug.x, pug.y, { size: 30 });
  }
  if (isKnocked) { ctx.restore(); }
  // fart cloud
  if (pug.fartT > 0) {
    ctx.fillStyle = `rgba(94,243,140,${pug.fartT / 1.5 * 0.6})`;
    ctx.beginPath(); ctx.arc(pug.x, pug.y + 6, 18, 0, Math.PI * 2); ctx.fill();
  }
  // sound ring
  if (pug.sound > 0) {
    ctx.strokeStyle = `rgba(255,210,63,${pug.sound})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 30 * (1 - pug.sound + 1), 0, Math.PI * 2); ctx.stroke();
  }
  // Score popups (world space, before lighting). Each one applies its own
  // tilt + spin so the burst feels organic — guarded by save/restore so it
  // doesn't bleed into following draws.
  ctx.font = "bold 11px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  for (const p of popups) {
    const a = p.t < 0.1 ? p.t / 0.1 : (p.t > 0.9 ? Math.max(0, (1.2 - p.t) / 0.3) : 1);
    ctx.globalAlpha = a;
    const ang = (p.rot || 0) + (p.spin || 0) * p.t;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (ang) ctx.rotate(ang);
    ctx.fillStyle = '#000'; ctx.fillText(p.text, 1, 1);
    ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // Dust motes (ambient, soft)
  ctx.fillStyle = 'rgba(220,210,255,0.18)';
  for (const d of dustMotes) {
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  // ---- Lighting pass: darken whole stage, punch out light pools ----
  ctx.save();
  ctx.fillStyle = 'rgba(8,4,16,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  // Player carries soft visibility halo
  const pgrd = ctx.createRadialGradient(pug.x, pug.y, 10, pug.x, pug.y, 140);
  pgrd.addColorStop(0, 'rgba(0,0,0,1)');
  pgrd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = pgrd;
  ctx.beginPath(); ctx.arc(pug.x, pug.y, 140, 0, Math.PI * 2); ctx.fill();
  // Each ceiling light contributes a pool when on
  for (const l of lights) {
    if (!l.on) continue;
    const grd = ctx.createRadialGradient(l.x, l.y, 10, l.x, l.y, 110);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(l.x, l.y, 110, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Warm light tint over pools (additive feel)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (!l.on) continue;
    const grd = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 80);
    grd.addColorStop(0, 'rgba(255,210,140,0.18)');
    grd.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(l.x, l.y, 80, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Ceiling light fixtures (small icons)
  for (const l of lights) {
    ctx.fillStyle = l.on ? '#ffd23f' : '#3a3040';
    ctx.fillRect(l.x - 5, l.y - 1, 10, 2);
    if (l.broken) {
      ctx.strokeStyle = 'rgba(255,90,90,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.x - 6, l.y - 3); ctx.lineTo(l.x + 6, l.y - 3); ctx.stroke();
    }
  }
  // EAGLE EYE upgrade — overlay glowing red dots above each human (visible through walls).
  // Drawn in world space so they track humans correctly under the camera zoom.
  if (runUpgrades.eagleEye) {
    for (const h of humans) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
      ctx.fillStyle = `rgba(255,60,60,${pulse})`;
      ctx.beginPath(); ctx.arc(h.x, h.y - 18, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${pulse * 0.8})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(h.x, h.y - 18, 5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore(); // closes the shake-translate save (and camera transform)
  // Hit flash overlay (screen space, after shake). Edge-only radial gradient
  // so the action stays visible while the rim "alarm"-pulses red.
  if (hitFlashT > 0) {
    const a = Math.min(0.65, hitFlashT * 2);
    // dim red rim
    const rim = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    rim.addColorStop(0, 'rgba(255,58,58,0)');
    rim.addColorStop(0.55, `rgba(255,58,58,${a * 0.25})`);
    rim.addColorStop(1, `rgba(255,58,58,${a})`);
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, W, H);
    // thin center flash for first 0.1s so the impact still punches
    if (hitFlashT > 0.35) {
      ctx.fillStyle = `rgba(255,58,58,${(hitFlashT - 0.35) * 1.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // Vignette (screen space)
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  drawGadgetHud();
}

function drawFurniture(f) {
  const x = f.x, y = f.y, w = f.w, h = f.h;
  // Generic shadow under most pieces
  const shadowKinds = ['bed','dresser','counter','fridge','couch','tv','desk','monitor','cabinet','safe','coffee','plant','pedestal'];
  if (shadowKinds.includes(f.kind)) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 2, y + h - 2, w, 3);
  }
  switch (f.kind) {
    case 'bed':
      ctx.fillStyle = '#6a4a2e'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#e0d8c0'; ctx.fillRect(x + 4, y + 4, w - 8, h - 12);
      ctx.fillStyle = '#b04a4a'; ctx.fillRect(x + 4, y + 4, w - 8, 8); // pillow band
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + h - 4, w, 4);
      break;
    case 'lamp':
      ctx.fillStyle = '#3a2818'; ctx.fillRect(x + w / 2 - 1, y + 4, 2, h - 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, y, w, 6);
      ctx.fillStyle = 'rgba(255,210,63,0.18)';
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 18, 0, Math.PI * 2); ctx.fill();
      break;
    case 'dresser':
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#3a2010'; ctx.fillRect(x + 2, y + h / 2, w - 4, 1);
      ctx.fillStyle = '#c8a872'; ctx.fillRect(x + 4, y + 4, 4, 2); ctx.fillRect(x + w - 8, y + 4, 4, 2);
      ctx.fillStyle = '#c8a872'; ctx.fillRect(x + 4, y + h - 6, 4, 2); ctx.fillRect(x + w - 8, y + h - 6, 4, 2);
      break;
    case 'rug':
      ctx.fillStyle = 'rgba(180,40,60,0.28)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,210,63,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      break;
    case 'painting':
      ctx.fillStyle = '#3a2010'; ctx.fillRect(x, y, w, h + 2);
      ctx.fillStyle = '#5ea0c8'; ctx.fillRect(x + 1, y + 1, w - 2, h);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + w * 0.3, y + h * 0.3, 4, 2);
      break;
    case 'counter':
      ctx.fillStyle = '#7a7a7a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#a0a0a0'; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + 4, y + 6, 6, 6); // sink
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x + w - 14, y + 6, 8, 6); // stove
      ctx.fillStyle = '#ff8e3c'; ctx.fillRect(x + w - 12, y + 8, 2, 2);
      break;
    case 'fridge':
      ctx.fillStyle = '#e0e0e8'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#a0a0a8'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = '#3a2818'; ctx.fillRect(x + w - 5, y + 8, 2, 6);
      ctx.fillStyle = '#5ef38c'; ctx.fillRect(x + 4, y + 4, 4, 2);
      break;
    case 'kettle':
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + 2, y + 4, w - 4, h - 4);
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x + 4, y + 2, w - 8, 2);
      ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x + 2, y + 8, 1, 4);
      break;
    case 'stool':
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#3a2010'; ctx.fillRect(x + 2, y + h - 2, w - 4, 2);
      break;
    case 'tiles':
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      for (let i = 0; i <= w; i += 10) {
        ctx.beginPath(); ctx.moveTo(x + i + 0.5, y); ctx.lineTo(x + i + 0.5, y + h); ctx.stroke();
      }
      for (let j = 0; j <= h; j += 10) {
        ctx.beginPath(); ctx.moveTo(x, y + j + 0.5); ctx.lineTo(x + w, y + j + 0.5); ctx.stroke();
      }
      break;
    case 'couch':
      ctx.fillStyle = '#5e3a82'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#7a4ea6'; ctx.fillRect(x + 2, y + 2, w - 4, h - 8);
      ctx.fillStyle = '#2a1844'; ctx.fillRect(x, y, 4, h);
      ctx.fillStyle = '#2a1844'; ctx.fillRect(x + w - 4, y, 4, h);
      ctx.fillStyle = '#9a6ed8';
      ctx.fillRect(x + 8, y + 4, 12, 6); ctx.fillRect(x + w - 20, y + 4, 12, 6);
      break;
    case 'tv': {
      const tv = tvs.find((t) => Math.abs(t.x - (x + w / 2)) < 1 && Math.abs(t.y - (y + h / 2)) < 1);
      const intensity = tv ? tv.intensity : 0.6;
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = `rgba(120,180,255,${0.55 + intensity * 0.4})`;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      // scanline pattern flicker
      ctx.fillStyle = `rgba(255,255,255,${intensity * 0.25})`;
      ctx.fillRect(x + 2, y + 2 + (Math.floor((performance.now() / 80) % (h - 6))), w - 4, 1);
      ctx.fillStyle = '#3a2818'; ctx.fillRect(x + w / 2 - 6, y + h, 12, 3); // stand
      break;
    }
    case 'plant':
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(x + 2, y + h - 6, w - 4, 6);
      ctx.fillStyle = '#2a6a3a'; ctx.beginPath(); ctx.arc(x + w / 2, y + h - 8, w * 0.8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3a8a4a'; ctx.fillRect(x + w / 2 - 1, y, 2, h - 8);
      break;
    case 'coffee':
      ctx.fillStyle = '#3a2010'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#5a3820'; ctx.fillRect(x + 1, y + 1, w - 2, h - 4);
      ctx.fillStyle = '#c8a872'; ctx.fillRect(x + 4, y + 4, 6, 3); // book
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + w - 8, y + 4, 4, 4); // cup
      break;
    case 'desk':
      ctx.fillStyle = '#4a3220'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#6a4a2e'; ctx.fillRect(x + 2, y + 2, w - 4, 3);
      ctx.fillStyle = '#2a1a0a'; ctx.fillRect(x, y + h - 3, w, 3);
      ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x + 4, y + 6, 8, 4); // paper
      break;
    case 'monitor':
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#4cc9f0'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x + w / 2 - 4, y + h, 8, 2);
      break;
    case 'chair':
      ctx.fillStyle = '#3a2010'; ctx.fillRect(x + 2, y, w - 4, h);
      ctx.fillStyle = '#5a3220'; ctx.fillRect(x + 2, y, w - 4, 4); // back
      ctx.fillStyle = '#1a0d05'; ctx.fillRect(x, y + h - 2, 2, 2); ctx.fillRect(x + w - 2, y + h - 2, 2, 2);
      break;
    case 'cabinet':
      ctx.fillStyle = '#3a2818'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1a0d05'; ctx.fillRect(x + w / 2 - 0.5, y, 1, h);
      ctx.fillStyle = '#c8a872';
      ctx.fillRect(x + w / 2 - 4, y + h / 2 - 1, 3, 2);
      ctx.fillRect(x + w / 2 + 1, y + h / 2 - 1, 3, 2);
      break;
    case 'safe':
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a3a3a';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.fillRect(x + w / 2 + Math.cos(a) * 7 - 1, y + h / 2 + Math.sin(a) * 7 - 1, 2, 2);
      }
      break;
    case 'vase':
      ctx.fillStyle = '#8a4a9a'; ctx.fillRect(x + 2, y + 4, w - 4, h - 6);
      ctx.fillStyle = '#aa6abe'; ctx.fillRect(x + 3, y + 5, w - 6, 2);
      ctx.fillStyle = '#5a2a6a'; ctx.fillRect(x + 1, y + h - 3, w - 2, 3);
      ctx.fillStyle = '#3a8a4a'; ctx.fillRect(x + w / 2 - 1, y, 2, 4);
      break;
    case 'pedestal':
      ctx.fillStyle = '#c8c8d8'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#888898'; ctx.fillRect(x + 2, y + 2, w - 4, 2);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x, y + h - 2, w, 2);
      break;
  }
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _hsHud = {
  loot: document.getElementById('hud-loot'),
  floor: document.getElementById('hud-floor'),
  bark: document.getElementById('hud-bark'),
  fart: document.getElementById('hud-fart'),
  best: document.getElementById('hud-best'),
  card: document.querySelector('#hud .hud-card'),
};
let _hsHudPrev = { loot: '', floor: -1, bark: '', fart: '', best: -1, alert: null };
let _hsBestCache = -1, _hsBestCacheT = 0;
function updateHud() {
  // Count taken loot in-place — avoids per-frame filter allocation.
  let takenCount = 0;
  for (const l of loot) if (l.taken) takenCount++;
  const lt = `${takenCount}/${loot.length}`;
  if (lt !== _hsHudPrev.loot) { _hsHud.loot.textContent = lt; _hsHudPrev.loot = lt; }
  if (floor !== _hsHudPrev.floor) { _hsHud.floor.textContent = floor; _hsHudPrev.floor = floor; }
  const bk = barkCd > 0 ? barkCd.toFixed(1) + 's' : 'READY';
  if (bk !== _hsHudPrev.bark) { _hsHud.bark.textContent = bk; _hsHudPrev.bark = bk; }
  const ft = fartCd > 0 ? fartCd.toFixed(1) + 's' : 'READY';
  if (ft !== _hsHudPrev.fart) { _hsHud.fart.textContent = ft; _hsHudPrev.fart = ft; }
  const now = performance.now();
  if (now - _hsBestCacheT > 2000) {
    const best = loadBest('pug-heist');
    _hsBestCache = best ? best.floor : 0;
    _hsBestCacheT = now;
  }
  if (_hsBestCache !== _hsHudPrev.best) { _hsHud.best.textContent = _hsBestCache; _hsHudPrev.best = _hsBestCache; }
  // Alert pulse: any human with vision suspicion or alerted
  let suspicious = false;
  for (const h of humans) {
    if (h.alertT > 0 || (h._closeT || 0) > 0.6) { suspicious = true; break; }
  }
  if (suspicious !== _hsHudPrev.alert && _hsHud.card) {
    _hsHud.card.classList.toggle('is-alert', suspicious);
    _hsHudPrev.alert = suspicious;
  }
}

function drawGadgetHud() {
  const ox = W - 200, oy = H - 98;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(ox - 8, oy - 8, 190, 88);
  // Row icons: smokeBomb / no-match tongue / bone — drawn pixel-art at left of row
  drawIcon.smokeBomb(ctx, ox + 8, oy + 4, 14);
  // tongue has no library match — keep a tiny pink rounded blob
  ctx.fillStyle = '#ff8ac8'; ctx.fillRect(ox + 2, oy + 21, 12, 4); ctx.fillRect(ox + 4, oy + 19, 8, 2);
  drawIcon.bone(ctx, ox + 8, oy + 40, 14);
  // Throw row: tiny vase glyph
  ctx.fillStyle = '#8a4a9a'; ctx.fillRect(ox + 4, oy + 56, 8, 10);
  ctx.fillStyle = '#aa6abe'; ctx.fillRect(ox + 5, oy + 57, 6, 2);
  ctx.fillStyle = '#3a8a4a'; ctx.fillRect(ox + 7, oy + 54, 2, 3);
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  ctx.fillText('SMOKE [Q]  ' + (smokeCd > 0 ? smokeCd.toFixed(1) + 's' : 'READY'), ox + 22, oy + 8);
  ctx.fillText('TONGUE [G] ' + (tongueCd > 0 ? tongueCd.toFixed(1) + 's' : 'READY'), ox + 22, oy + 26);
  ctx.fillText('DECOY [T]  ' + (decoyCd > 0 ? decoyCd.toFixed(1) + 's' : 'READY'), ox + 22, oy + 44);
  const tStat = throwsLeft <= 0 ? 'EMPTY' : (throwCd > 0 ? throwCd.toFixed(1) + 's' : 'READY');
  const tColor = throwsLeft <= 0 ? '#888' : '#fff';
  ctx.fillStyle = tColor;
  ctx.fillText(`THROW [X]  ${tStat}  x${throwsLeft}`, ox + 22, oy + 62);
  // Loot value running total
  ctx.fillStyle = '#ffd23f'; ctx.font = "11px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText(`$ ${totalLootValue}`, W - 16, 26);
}

function calcGrade() {
  // Per-floor grade: how much of this floor's loot did we take?
  const floorTaken = loot.filter((l) => l.taken).length;
  const collectedPct = floorTaken / Math.max(1, loot.length);
  const undetected = !alertedThisFloor;
  if (collectedPct >= 0.95 && undetected) return { grade: 'S', desc: 'PERFECT HEIST' };
  if (collectedPct >= 0.85 && undetected) return { grade: 'A', desc: 'CLEAN' };
  if (collectedPct >= 0.6) return { grade: 'B', desc: 'GOOD' };
  if (collectedPct >= 0.4) return { grade: 'C', desc: 'MESSY' };
  return { grade: 'D', desc: 'ROUGH' };
}

// Shared grade card after each floor — supplements the existing CAUGHT screen
// and replaces the silent shop-open on successful exit. On dismissal:
//   - escaped=true  -> opens the between-floor shop
//   - escaped=false -> ends the run (caught() already populated end-overlay)
function showFloorGrade(escaped) {
  const floorTaken = loot.filter((l) => l.taken).length;
  const lootMax = Math.max(1, loot.length);
  const elapsed = (performance.now() - floorStartTime) / 1000;
  const timePct = escaped ? Math.max(40, Math.min(100, 100 - elapsed * 1.2)) : 30;
  const lootPct = (floorTaken / lootMax) * 100;
  const stealthPct = alertedThisFloor ? 0 : 100;
  _activeGradeCard = showGradeCard({
    title: escaped ? `FLOOR ${floor} CLEARED` : `CAUGHT ON FLOOR ${floor}`,
    subtitle: escaped ? 'Spend your haul before the next floor.' : 'Restart from floor 1.',
    stats: [
      { label: 'Loot',       value: lootPct,    weight: 0.5 },
      { label: 'Stealth',    value: stealthPct, weight: 0.3 },
      { label: 'Speed',      value: timePct,    weight: 0.2 },
    ],
    breakdown: [
      { label: 'Loot taken', value: floorTaken,            max: lootMax },
      { label: 'Undetected', value: alertedThisFloor ? 0 : 1, max: 1 },
      { label: 'Time (s)',   value: Math.round(elapsed),   max: 60 },
    ],
    restartLabel: escaped ? 'CONTINUE' : 'RESTART',
    onRestart: () => {
      _activeGradeCard = null;
      if (escaped) { openHeistShop(); }
      else { start(); }
    },
  });
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  floor = 1; running = true;
  lootStolen = 0; totalLootValue = 0; achievementsSeen = new Set();
  runUpgrades = {}; shopPending = false; pendingFloor = 0;
  closeHeistShop();
  renderHeistShopChips();
  // Dismiss any lingering grade card from the previous run.
  try { _activeGradeCard?.close?.(); } catch (e) { /* */ }
  _activeGradeCard = null;
  genFloor(floor);
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
  try { music.setIntensity(0.3); music.play(); } catch {}
}
// Music dynamics — sample guard-alert state in the main loop and adjust intensity.
let _heistMusicAt = 0;
function _heistUpdateMusic(now) {
  if (now - _heistMusicAt < 400) return;
  _heistMusicAt = now;
  try {
    let alerted = 0;
    // humans[] holds guards/patrols; count any actively alerted ones.
    if (typeof humans !== 'undefined' && Array.isArray(humans)) {
      for (const h of humans) if (h && h.alertT > 0) alerted++;
    }
    const i = alertedThisFloor ? 1.0 : Math.min(0.8, 0.3 + alerted * 0.18);
    music.setIntensity(i);
  } catch {}
}
// Hook into main loop without rewriting it: schedule a periodic sampler.
setInterval(() => { if (running) _heistUpdateMusic(performance.now()); }, 350);
// Stop music on end-overlay show.
(function _wireHeistMusicEnd() {
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

// ===== BETWEEN-FLOOR SHOP UI =====
const HEIST_SHOP_CSS = `
.heist-shop-chips { position: fixed; top: 12px; right: 60px; z-index: 50;
  display: flex; gap: 4px; flex-wrap: wrap; max-width: 280px; justify-content: flex-end; pointer-events: none; }
.heist-shop-chip { background: rgba(94,243,140,0.18); border: 1px solid var(--neon-green);
  color: var(--neon-green); font-family: var(--font-display); font-size: 0.36rem;
  letter-spacing: 0.05em; padding: 3px 5px; border-radius: 3px;
  text-shadow: 0 0 4px var(--neon-green); }
.heist-shop-modal { position: fixed; inset: 0; z-index: 300; display: none;
  align-items: center; justify-content: center; background: rgba(0,0,0,0.75); padding: 16px; }
.heist-shop-modal.is-open { display: flex; animation: heistShopFade 0.18s ease-out; }
@keyframes heistShopFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes heistShopPop { from { transform: translateY(12px) scale(0.96); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; } }
.heist-shop-modal__panel { background: linear-gradient(180deg, #1a0f2e, #0a0716);
  border: 3px solid var(--neon-green); border-radius: 10px; padding: 20px;
  max-width: 460px; width: 100%; box-shadow: 0 0 40px rgba(94,243,140,0.4);
  animation: heistShopPop 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.heist-shop-modal__title { font-family: var(--font-display); font-size: 0.85rem;
  letter-spacing: 0.1em; color: var(--neon-green); text-align: center; margin: 0 0 6px;
  text-shadow: 0 0 12px var(--neon-green); }
.heist-shop-modal__sub { text-align: center; color: var(--text-soft);
  font-family: var(--font-display); font-size: 0.42rem; margin-bottom: 12px; }
.heist-shop-modal__money { text-align: center; font-family: var(--font-display);
  font-size: 0.6rem; color: var(--neon-yellow); margin-bottom: 12px; }
.heist-shop-row { background: rgba(0,0,0,0.5); border: 2px solid var(--border);
  border-radius: 6px; padding: 10px; margin-bottom: 8px; display: flex;
  gap: 10px; align-items: center; }
.heist-shop-row.owned { border-color: var(--neon-green); background: rgba(94,243,140,0.08); }
.heist-shop-row__icon { font-size: 26px; flex-shrink: 0; }
.heist-shop-row__body { flex: 1; }
.heist-shop-row__name { font-family: var(--font-display); font-size: 0.5rem;
  color: var(--neon-cyan); letter-spacing: 0.05em; }
.heist-shop-row__desc { font-size: 0.42rem; color: var(--text-soft); margin-top: 2px; }
.heist-shop-row__btn { background: linear-gradient(180deg, var(--neon-green), #1a8a40);
  color: #0a1018; border: 2px solid #b8ffd0; border-radius: 4px;
  font-family: var(--font-display); font-size: 0.45rem; letter-spacing: 0.05em;
  padding: 6px 8px; cursor: pointer; min-width: 70px;
  box-shadow: 0 3px 0 #0a4a20; -webkit-tap-highlight-color: transparent; }
.heist-shop-row__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.heist-shop-row__btn.owned { background: var(--neon-yellow); color: #1a0d05; box-shadow: 0 3px 0 #6a4a0a; }
.heist-shop-skip { background: linear-gradient(180deg, var(--neon-cyan), #2a8aac); color: #0a1018;
  border: 2px solid #b8e8ff; border-radius: 4px;
  font-family: var(--font-display); font-size: 0.55rem; letter-spacing: 0.05em;
  padding: 10px 16px; cursor: pointer; display: block; margin: 14px auto 0;
  box-shadow: 0 3px 0 #0a3a4a; -webkit-tap-highlight-color: transparent; }
`;
const _heistStyle = document.createElement('style'); _heistStyle.textContent = HEIST_SHOP_CSS;
document.head.appendChild(_heistStyle);

const _heistShopChips = document.createElement('div');
_heistShopChips.className = 'heist-shop-chips';
_heistShopChips.id = 'heist-shop-chips';
document.body.appendChild(_heistShopChips);

const _heistShopModal = document.createElement('div');
_heistShopModal.className = 'heist-shop-modal';
_heistShopModal.id = 'heist-shop-modal';
_heistShopModal.innerHTML = `
  <div class="heist-shop-modal__panel">
    <h2 class="heist-shop-modal__title">★ FENCE'S BLACK MARKET ★</h2>
    <div class="heist-shop-modal__sub" id="heist-shop-sub">Floor cleared. Spend your haul.</div>
    <div class="heist-shop-modal__money">HAUL: $<span id="heist-shop-money">0</span></div>
    <div id="heist-shop-list"></div>
    <button class="heist-shop-skip" id="heist-shop-skip">NEXT FLOOR →</button>
  </div>
`;
document.body.appendChild(_heistShopModal);
document.getElementById('heist-shop-skip').addEventListener('click', advancePendingFloor);

function openHeistShop() {
  renderHeistShopList();
  _heistShopModal.classList.add('is-open');
}
function closeHeistShop() {
  _heistShopModal.classList.remove('is-open');
}
function renderHeistShopList() {
  document.getElementById('heist-shop-money').textContent = totalLootValue;
  const subEl = document.getElementById('heist-shop-sub');
  if (subEl) subEl.textContent = `Floor ${floor} cleared. Next: floor ${pendingFloor}.`;
  const list = document.getElementById('heist-shop-list');
  list.innerHTML = '';
  for (const u of HEIST_SHOP) {
    const owned = !!runUpgrades[u.id];
    const canBuy = !owned && totalLootValue >= u.cost;
    const row = document.createElement('div');
    row.className = 'heist-shop-row' + (owned ? ' owned' : '');
    row.innerHTML = `
      <div class="heist-shop-row__icon">${u.icon}</div>
      <div class="heist-shop-row__body">
        <div class="heist-shop-row__name">${u.name}</div>
        <div class="heist-shop-row__desc">${u.desc}</div>
      </div>
      <button class="heist-shop-row__btn ${owned ? 'owned' : ''}" ${owned || !canBuy ? 'disabled' : ''}>
        ${owned ? 'OWNED' : '$' + u.cost}
      </button>
    `;
    if (!owned && canBuy) {
      row.querySelector('button').addEventListener('click', () => buyHeistShop(u));
    }
    list.appendChild(row);
  }
}
function buyHeistShop(u) {
  if (runUpgrades[u.id] || totalLootValue < u.cost) return;
  totalLootValue -= u.cost;
  runUpgrades[u.id] = true;
  sfx.arp([523, 659, 880], 'triangle', 0.08, 0.22, 0.2);
  renderHeistShopList();
  renderHeistShopChips();
}
function renderHeistShopChips() {
  if (!_heistShopChips) return;
  _heistShopChips.innerHTML = '';
  for (const u of HEIST_SHOP) {
    if (!runUpgrades[u.id]) continue;
    const c = document.createElement('div');
    c.className = 'heist-shop-chip';
    c.textContent = u.icon + ' ' + u.name;
    _heistShopChips.appendChild(c);
  }
}
function advancePendingFloor() {
  closeHeistShop();
  shopPending = false;
  if (pendingFloor > 0) {
    floor = pendingFloor;
    pendingFloor = 0;
    genFloor(floor);
  }
}

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD sneak · Q smoke · G tongue · T decoy · X throw vase · spend $$ between floors!', 6500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish (fun-facts, new-best confetti, share, view-data, replay-prompt) ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Bark from far away — humans investigate the sound.',
    'TIP: Smoke bombs blind the vision cone for 3 seconds.',
    'TIP: Rare loot (gold) = 5× score bonus.',
    'TIP: Stay UNDETECTED on a floor for the S-grade.',
    'LORE: The Heist Society pugs have stolen for centuries.',
    'TIP: Decoy pugs distract guards for 6 seconds.',
    'LORE: The forbidden cheese is in the master bedroom.',
    'JOKE: A pug walks into a kitchen — and steals everything.',
  ];
  const GAME_ID = 'pug-heist';
  const TITLE_TEXT = 'PUG HEIST SOCIETY';
  const start = document.getElementById('overlay');
  const end = document.getElementById('end-overlay');
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
        if (best && (best.floor || best.score || best.value)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: floor ${best.floor || '?'} · $${best.value || best.score || 0}`;
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
  function markRunStart() { _runStart = performance.now(); }
  function showReplayPrompt() {
    const el = document.getElementById('wg-tryagain');
    if (!el) return;
    const dur = (performance.now() - _runStart) / 1000;
    el.hidden = dur > 25;
  }
  const shareBtn = document.getElementById('wg-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const f = document.getElementById('end-floor')?.textContent || '0';
      const l = document.getElementById('end-loot')?.textContent || '0';
      const text = `🐶 ${TITLE_TEXT} — Cleared ${f} floors with ${l} loot! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: TITLE_TEXT, text, url: 'https://leobalkind.github.io/web-games/' });
        else { await navigator.clipboard.writeText(text); shareBtn.textContent = '✓ COPIED!'; setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800); }
      } catch { shareBtn.textContent = '⚠ FAILED'; setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800); }
    });
  }
  if (start) {
    const startUpdate = () => {
      const visible = !start.hidden && !start.classList.contains('is-hidden');
      if (visible) { refreshStartBest(); startFactLoop(); } else { stopFactLoop(); markRunStart(); }
    };
    new MutationObserver(startUpdate).observe(start, { attributes: true, attributeFilter: ['hidden','class'] });
    startUpdate();
  }
  if (end) {
    const endUpdate = () => {
      const visible = !end.hidden && !end.classList.contains('is-hidden');
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
    new MutationObserver(endUpdate).observe(end, { attributes: true, attributeFilter: ['hidden','class'] });
  }
})();
