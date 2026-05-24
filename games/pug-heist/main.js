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
import { drawShadow as _depthShadow, depthSort as _depthSort } from '../../src/shared/depth3D.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'heist:muted' });
// Tense stealth pulse — intensity spikes when any guard is alerted.
const music = createMusicTrack({ mood: 'tense', tempo: 130, key: 'A', scale: 'minor' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'pug-heist', getControlsHelp: () => _isTouch
  ? 'JOYSTICK sneak · BARK / SMOKE / TONGUE / DECOY / VASE buttons · 🛒 SHOP between floors. Saved to your profile.'
  : 'WASD sneak · Q smoke · G tongue · T decoy · X throw vase · F crack safe · spend $$ between floors. Saved to your profile.' });

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

// THEMED LOOT — per building: museum=gems(rare), bank=goldbars(slow),
// mansion=paintings, office=laptops, airport=luggage. Lives alongside generic LOOT_TYPES.
const THEME_LOOT = {
  museum:  [ { kind: 'gem',     val: 220, color: '#ff3aa1', shape: 'gem' },
             { kind: 'artifact',val: 180, color: '#c89c20', shape: 'urn' } ],
  bank:    [ { kind: 'goldBar', val: 160, color: '#ffd23f', shape: 'bar' },
             { kind: 'cashStack',val: 110,color: '#5ef38c', shape: 'stack' } ],
  mansion: [ { kind: 'painting',val: 150, color: '#a06030', shape: 'painting' },
             { kind: 'chandelier',val: 130,color: '#ffce5e', shape: 'chand' } ],
  office:  [ { kind: 'laptop',  val: 45,  color: '#4cc9f0', shape: 'laptop' },
             { kind: 'monitor', val: 35,  color: '#8a8aac', shape: 'monitor' } ],
  airport: [ { kind: 'luggage', val: 140, color: '#5a3a82', shape: 'luggage' },
             { kind: 'passport',val: 90,  color: '#a02828', shape: 'passport' } ],
};
const BUILDING_THEMES = ['museum', 'bank', 'mansion', 'office', 'airport'];
// DIFFICULTY — picked on the start overlay (defaults to MASTERMIND).
const DIFFICULTY = {
  student:    { timeBonus: 1.4, guardSpeed: 0.7, lootTimer: 60, label: 'STUDENT',    hint: 'More time · slower guards' },
  mastermind: { timeBonus: 1.0, guardSpeed: 1.0, lootTimer: 60, label: 'MASTERMIND', hint: 'Default' },
  ghost:      { timeBonus: 0.8, guardSpeed: 1.25, lootTimer: 45, label: 'GHOST',     hint: 'No smoke · no decoys · faster guards' },
};
let difficulty = 'mastermind';
// HEIST DIARY — per-theme clears + MASTER badge (no-alert clear).
const DIARY_KEY = 'pug-heist:diary';
let heistDiary = (() => {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '{}'); } catch { return {}; }
})();
function _saveDiary() { try { localStorage.setItem(DIARY_KEY, JSON.stringify(heistDiary)); } catch {} }
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
// Wave 1B — themed building + map upgrades
let buildingTheme = 'museum';     // current floor's building theme
let secCams = [];                 // {x, y, baseAng, sweep, phase, range, fov}
let vents = [];                   // {x, y, w, h, pair} — shortcut pads (slow but undetectable)
let lasers = [];                  // {x, y, w, h, axis:'h'|'v', phase, period} — alarm-trigger beams
let perfectFloor = true;          // resets per-floor; true = no detection at all on this floor
let comboBonus = 0;               // 2x multiplier banner counter (popups only)
let slowmoT = 0;                  // active slow-mo timer in seconds (0=off)
let slowmoUsed = 0;               // count this floor (limit per floor to avoid abuse)
let quickRestartCd = 0;           // (R) prevents accidental multi-press
let miniMapOn = true;             // M toggles HUD radar
let ghostReplay = null;           // recorded last successful floor: { samples:[{x,y,t}], floor, theme }
let _curRecord = null;            // recording buffer for current run
let _ghostT = 0;                  // playback head
let _floorBriefingPending = false; // briefing overlay shown before each new floor
let _floorPreviewMeta = null;     // {theme, lootCount, estHaul, floor}
let _jumpT = 0;                   // brief jump arc (s) — lets pug clear lasers
let alarmTier = 0;                // 0 idle · 1 suspicion · 2 alert · 3 full alarm
let _alarmAt = 0;                 // gate: throttles alarm sirens to ≥1/2s
let _stealthPop = 0;              // last "+10 STEALTH" popup time
let _stealthEstT = 0;             // seconds spent in shadow (resets on any suspicion)
let _stealthBadgeT = 0;           // fade timer for "STEALTH ESTABLISHED" badge
// SAFE crack mini-game — 5-tap rhythm. When pug stands on a safe and starts
// cracking, a timing window opens with 5 sequential taps. Big reward if all hit.
let safes = [];                   // {x, y, w, h, cracked:false, val:380, tapsHit, tapsNeeded:5}
let activeSafe = null;            // currently cracking
let safeMeter = 0;                // 0..1 — sweeping needle
let safeMeterDir = 1;             // +1 / -1
let safeStreak = 0;               // taps hit in current attempt
let safeTotal = 5;                // taps required
let safeFailT = 0;                // brief fail-flash duration
// AIRPORT theme: X-ray scanner obstacles (animated, similar to laser but rectangle)
let scanners = [];                // {x, y, w, h, phase, period, axis}
// Decoy robot pug visual state
let decoyBot = null;              // {x, y, t, life} — visible mini-bot during decoy
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
  // Theme cycles by floor (museum → bank → mansion → office → museum…)
  buildingTheme = BUILDING_THEMES[(level - 1) % BUILDING_THEMES.length];
  pug = { x: 60, y: H - 100, vx: 0, vy: 0, alive: true, fartT: 0, sound: 0, held: [] };
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
  // Loot - one per room (roughly). Now mixes generic LOOT_TYPES with the
  // current theme's themed-loot (gems/gold-bars/paintings/laptops) at 35%.
  loot = [];
  const themedPool = THEME_LOOT[buildingTheme] || [];
  const lootCount = 4 + level;
  for (let i = 0; i < lootCount; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 30 + Math.random() * (W - 60);
      const y = 30 + Math.random() * (H - 60);
      if (!isWallNear(x, y, 16)) {
        let lootObj;
        if (themedPool.length && Math.random() < 0.35) {
          const t = themedPool[Math.floor(Math.random() * themedPool.length)];
          lootObj = {
            x, y, taken: false, themed: true, theme: buildingTheme,
            iconName: t.shape, val: t.val, rare: t.val >= 150, ...t,
          };
        } else {
          const pool = Math.random() < 0.12 ? LOOT_TYPES.filter((t) => t.rare) : LOOT_TYPES.filter((t) => !t.rare);
          const ltype = pool[Math.floor(Math.random() * pool.length)];
          lootObj = { x, y, ...ltype, taken: false };
        }
        loot.push(lootObj);
        break;
      }
    }
  }
  // SECURITY CAMERAS — rotating sweep cones; skipped in STUDENT mode.
  secCams = [];
  if (difficulty !== 'student') {
    const camCount = Math.min(3, Math.floor(level / 2));
    for (let i = 0; i < camCount; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const x = 30 + Math.random() * (W - 60);
        const y = 30 + Math.random() * (H - 60);
        if (!isWallNear(x, y, 24) && Math.hypot(x - pug.x, y - pug.y) > 180) {
          secCams.push({ x, y, baseAng: Math.random() * Math.PI * 2,
            sweep: 0.7, phase: Math.random() * Math.PI * 2, range: 140, fov: 0.45 });
          break;
        }
      }
    }
  }
  // VENTS — shortcut pair: enter A → teleport to B. RARE (1 pair every other floor).
  // Drop frequency from 70% → 45% and only past floor 1 so early game stays clean.
  vents = [];
  if (level >= 2 && Math.random() < 0.45) {
    const ax = 50 + Math.random() * 80;
    const ay = H - 60 - Math.random() * 60;
    const bx = W - 90 - Math.random() * 80;
    const by = 60 + Math.random() * 60;
    // Direction vector from A→B is stored as `dirAng` so the renderer can draw
    // a directional arrow on each pad pointing to the linked pad.
    const aAng = Math.atan2(by - ay, bx - ax);
    const bAng = aAng + Math.PI;
    vents.push({ x: ax - 12, y: ay - 12, w: 24, h: 24, pair: 1, cd: 0, dirAng: aAng });
    vents.push({ x: bx - 12, y: by - 12, w: 24, h: 24, pair: 1, cd: 0, dirAng: bAng });
  }
  // SAFES — rare big-reward (per-theme 25% chance, 1 per floor max). Cracking
  // is a 5-tap rhythm via the J-key timing window once the player is adjacent.
  safes = [];
  activeSafe = null; safeStreak = 0; safeMeter = 0; safeMeterDir = 1; safeFailT = 0;
  if (level >= 2 && Math.random() < 0.4) {
    for (let tries = 0; tries < 16; tries++) {
      const x = 80 + Math.random() * (W - 160);
      const y = 80 + Math.random() * (H - 160);
      if (!isWallNear(x, y, 30) && Math.hypot(x - pug.x, y - pug.y) > 200) {
        safes.push({ x: x - 18, y: y - 18, w: 36, h: 36, cracked: false, val: 380, tapsHit: 0, tapsNeeded: 5 });
        break;
      }
    }
  }
  // X-RAY SCANNERS — airport-themed obstacle. Acts like a horizontal laser
  // pulsing on/off; only spawned for the airport theme. 1-2 per floor.
  scanners = [];
  if (buildingTheme === 'airport' && level >= 1) {
    const count = 1 + Math.floor(level / 3);
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const horizontal = Math.random() < 0.5;
        const len = 90 + Math.random() * 110;
        const x = 60 + Math.random() * (W - 120 - (horizontal ? len : 8));
        const y = 80 + Math.random() * (H - 160 - (horizontal ? 8 : len));
        const sc = horizontal
          ? { x, y, w: len, h: 14, axis: 'h', phase: Math.random() * Math.PI * 2, period: 2.5 + Math.random() * 2 }
          : { x, y, w: 14, h: len, axis: 'v', phase: Math.random() * Math.PI * 2, period: 2.5 + Math.random() * 2 };
        const cx = sc.x + sc.w / 2, cy = sc.y + sc.h / 2;
        if (Math.hypot(cx - pug.x, cy - pug.y) < 140) continue;
        if (isWallNear(cx, cy, 10)) continue;
        scanners.push(sc);
        break;
      }
    }
  }
  decoyBot = null;
  // LASERS — pulsing floor beams. Cross while not jumping (J) = full alarm.
  lasers = [];
  if (level >= 2 && difficulty !== 'student') {
    const laserCount = Math.min(3, Math.floor((level - 1) / 2) + 1);
    for (let i = 0; i < laserCount; i++) {
      for (let tries = 0; tries < 16; tries++) {
        const horizontal = Math.random() < 0.5;
        const len = 120 + Math.random() * 160;
        const x = 40 + Math.random() * (W - 80 - (horizontal ? len : 6));
        const y = 60 + Math.random() * (H - 120 - (horizontal ? 6 : len));
        const beam = horizontal
          ? { x, y, w: len, h: 4, axis: 'h', phase: Math.random() * Math.PI * 2, period: 3 + Math.random() * 3 }
          : { x, y, w: 4, h: len, axis: 'v', phase: Math.random() * Math.PI * 2, period: 3 + Math.random() * 3 };
        // avoid spawn area + walls along the line
        const midX = beam.x + beam.w / 2, midY = beam.y + beam.h / 2;
        if (Math.hypot(midX - pug.x, midY - pug.y) < 120) continue;
        if (isWallNear(midX, midY, 8)) continue;
        lasers.push(beam);
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
  // Stealth combo + ghost recording reset
  perfectFloor = true; comboBonus = 0;
  slowmoT = 0; slowmoUsed = 0; _jumpT = 0; alarmTier = 0;
  _curRecord = { samples: [], floor, theme: buildingTheme, t: 0 };
  _ghostT = 0;
  if (difficulty === 'ghost') { smokeCd = 9999; decoyCd = 9999; }
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
  if (e.code === 'Space' || ['q','g','t','x','j','r','m','w','a','s','d','f'].includes(k)) e.preventDefault();
  if (e.key === ' ' || e.code === 'Space') doBark();
  if (e.key === 'Shift' || k === 'shift') doFart();
  if (k === 'q') doSmoke();
  if (k === 'g') doTongue();
  if (k === 't') doDecoy();
  if (k === 'x') doThrow();
  if (k === 'j') doJump();           // hop over lasers
  if (k === 'r') doQuickRestart();   // restart this floor (keep run progress)
  if (k === 'm') miniMapOn = !miniMapOn;
  if (k === 'f') doSafeTap();        // safe-crack rhythm tap
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
  // Legacy floating THROW button overlapped the universal mobileControls THROW
  // chip on touch. The mobileControls overlay owns the touch UI, so hide the
  // legacy duplicate everywhere (click handler kept as a safety net).
  _throwBtn.style.display = 'none';
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
  if (difficulty === 'ghost') { popup_locked('GHOST: no smoke'); return; }
  smokeCd = 7;
  // 3s smoke cloud at pug position, blocks vision cones in radius 90
  smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 3 });
  sfx.tone(330, 'sawtooth', 0.2, 0.2);
}
// Brief locked-action toast — surfaced when difficulty disallows an action.
function popup_locked(text) {
  if (!pug) return;
  addPopup(pug.x, pug.y - 18, text, '#ff5a82');
}
// JUMP — 0.45s hop; lasers ignored while airborne.
function doJump() {
  if (!running || _jumpT > 0) return;
  _jumpT = 0.45;
  sfx.tone(540, 'triangle', 0.06, 0.16);
}
// SAFE CRACK — press F to tap. Hit when the meter is in the green zone (0.4..0.6).
// Five consecutive hits cracks it for the big reward; one miss resets the chain.
function doSafeTap() {
  if (!running || !activeSafe) return;
  // Window is the center 22% of the sweep (tight but generous enough).
  const inWindow = Math.abs(safeMeter - 0.5) < 0.11;
  if (inWindow) {
    safeStreak++;
    sfx.tone(880 + safeStreak * 80, 'triangle', 0.05, 0.18);
    addPopup(activeSafe.x + activeSafe.w / 2, activeSafe.y - 6, 'HIT ' + safeStreak + '/' + safeTotal, '#5ef38c');
    if (safeStreak >= safeTotal) {
      // Cracked! Big reward.
      activeSafe.cracked = true;
      const val = activeSafe.val;
      lootValueThisFloor += val;
      totalLootValue += val;
      lootStolen++;
      spawnParticles(activeSafe.x + activeSafe.w / 2, activeSafe.y + activeSafe.h / 2, '#ffd23f');
      addPopup(activeSafe.x + activeSafe.w / 2, activeSafe.y - 18, 'SAFE CRACKED! +$' + val, '#ffd23f');
      sfx.arp([523, 784, 1320, 1760], 'triangle', 0.06, 0.22, 0.18);
      addShake(6, 0.25);
      activeSafe = null;
      safeStreak = 0;
    }
  } else {
    // Miss = reset chain + small heat penalty (humans hear the bonk).
    safeFailT = 0.4;
    sfx.tone(140, 'sawtooth', 0.1, 0.2);
    addPopup(activeSafe.x + activeSafe.w / 2, activeSafe.y - 6, 'MISS!', '#ff5a82');
    pug.sound = Math.max(pug.sound, 0.6);
    safeStreak = 0;
  }
}
// QUICK RESTART (R) — reset current floor, keep run-totals.
function doQuickRestart() {
  if (!running || quickRestartCd > 0) return;
  quickRestartCd = 0.6;
  totalLootValue -= lootValueThisFloor;
  lootStolen -= loot.filter((l) => l.taken).length;
  if (lootStolen < 0) lootStolen = 0;
  genFloor(floor);
  addPopup(pug.x, pug.y - 16, 'FLOOR RESTARTED', '#4cc9f0');
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
  if (difficulty === 'ghost') { popup_locked('GHOST: no decoy'); return; }
  decoyCd = 8;
  // Distract nearest human: walk away from pug for 4s
  let near = null, bestD = 280;
  for (const h of humans) {
    const d = Math.hypot(h.x - pug.x, h.y - pug.y);
    if (d < bestD) { bestD = d; near = h; }
  }
  // Spawn the visible decoy bot — tiny pug robot waddles toward the distraction
  // target so the player can SEE what the guard is chasing (was invisible before).
  let tx = pug.x + 220, ty = pug.y;
  if (near) {
    const ang = Math.atan2(near.y - pug.y, near.x - pug.x);
    tx = near.x + Math.cos(ang) * 220;
    ty = near.y + Math.sin(ang) * 220;
    near.distractTarget = { x: tx, y: ty };
    near.state = 'distracted'; near.alertT = 4.0;
  }
  decoyBot = { x: pug.x, y: pug.y, tx, ty, t: 0, life: 4.0, wobble: 0 };
  sfx.tone(440, 'square', 0.1, 0.2);
  sfx.tone(660, 'square', 0.06, 0.14);
  addPopup(pug.x, pug.y - 18, 'DECOY BOT!', '#b0e8ff');
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
  // Bigger pickup burst — more particles, larger sizes, plus an expanding halo
  // ring overlay (the renderer uses size>=8 + `halo:true` to draw rings).
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 70 + Math.random() * 110;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 0.7, t: 0, size: 3 + Math.random() * 2 });
  }
  // Expanding ring halo — visual "pop" right at the pickup
  particles.push({ x, y, vx: 0, vy: 0, color, life: 0.45, t: 0, size: 8, halo: true });
  particles.push({ x, y, vx: 0, vy: 0, color, life: 0.6, t: 0, size: 12, halo: true });
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
  // Slow-mo scales dt by 0.4.
  if (slowmoT > 0) { slowmoT = Math.max(0, slowmoT - dt); dt *= 0.4; }
  if (_jumpT > 0) _jumpT = Math.max(0, _jumpT - dt);
  if (quickRestartCd > 0) quickRestartCd = Math.max(0, quickRestartCd - dt);
  barkCd = Math.max(0, barkCd - dt);
  fartCd = Math.max(0, fartCd - dt);
  pug.fartT = Math.max(0, pug.fartT - dt);
  pug.sound = Math.max(0, pug.sound - dt * 0.5);
  // Ghost-replay sample every 0.1s
  if (_curRecord) {
    _curRecord.t += dt;
    const lastS = _curRecord.samples[_curRecord.samples.length - 1];
    if (!lastS || _curRecord.t - lastS.t > 0.1) {
      _curRecord.samples.push({ x: pug.x, y: pug.y, t: _curRecord.t });
      if (_curRecord.samples.length > 800) _curRecord.samples.shift();
    }
  }
  if (ghostReplay && ghostReplay.samples.length) _ghostT += dt;
  for (const cam of secCams) cam.phase += dt;
  for (const lz of lasers) lz.phase += dt;
  for (const sc of scanners) sc.phase += dt;
  // Safe-crack proximity check — auto-engages while standing on the safe pad.
  // Sweeping meter ticks back-and-forth (period ~1.3s). The needle is what the
  // F-key tap fires against in doSafeTap().
  let inSafe = null;
  for (const sf of safes) {
    if (sf.cracked) continue;
    if (pug.x > sf.x - 4 && pug.x < sf.x + sf.w + 4 && pug.y > sf.y - 4 && pug.y < sf.y + sf.h + 4) {
      inSafe = sf; break;
    }
  }
  if (inSafe && inSafe !== activeSafe) {
    activeSafe = inSafe; safeStreak = 0; safeMeter = 0; safeMeterDir = 1;
    addPopup(activeSafe.x + activeSafe.w / 2, activeSafe.y - 14, 'SAFE · F to crack', '#ffd23f');
  } else if (!inSafe && activeSafe) {
    activeSafe = null; safeStreak = 0;
  }
  if (activeSafe) {
    const rate = 1.8;
    safeMeter += safeMeterDir * rate * dt;
    if (safeMeter > 1) { safeMeter = 1; safeMeterDir = -1; }
    if (safeMeter < 0) { safeMeter = 0; safeMeterDir = 1; }
  }
  if (safeFailT > 0) safeFailT = Math.max(0, safeFailT - dt);
  // Decoy bot waddles toward target then dissolves
  if (decoyBot) {
    decoyBot.t += dt;
    decoyBot.wobble += dt * 9;
    const dxx = decoyBot.tx - decoyBot.x, dyy = decoyBot.ty - decoyBot.y;
    const dd = Math.hypot(dxx, dyy);
    if (dd > 4) {
      decoyBot.x += (dxx / dd) * 110 * dt;
      decoyBot.y += (dyy / dd) * 110 * dt;
    }
    if (decoyBot.t >= decoyBot.life) decoyBot = null;
  }

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
  // Held bank loot ("goldBar") slows the carrier — 6% per bar carried.
  let heldBars = 0;
  for (const lt of loot) if (lt.taken && lt.kind === 'goldBar') heldBars++;
  const heavyMul = Math.max(0.55, 1 - heldBars * 0.06);
  const targetSpeed = (pug.fartT > 0 ? 220 : 110) * heavyMul;
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
      // PERFECT STEALTH combo: floor cleared with no detection AT ALL → 2x value bonus
      if (perfectFloor) {
        const bonus = Math.round(lootValueThisFloor);
        totalLootValue += bonus;
        addPopup(pug.x, pug.y - 22, 'PERFECT STEALTH! +$' + bonus, '#ffd23f');
        sfx.arp([523, 784, 1320], 'triangle', 0.08, 0.18, 0.2);
      }
      // Heist Diary update — count clears per theme; MASTER if perfectFloor.
      const t = buildingTheme;
      const d = heistDiary[t] || { cleared: 0, master: false };
      d.cleared++;
      if (perfectFloor) d.master = true;
      heistDiary[t] = d;
      _saveDiary();
      // Save replay buffer as ghost for the NEXT attempt of this same floor.
      if (_curRecord && _curRecord.samples.length > 4) {
        ghostReplay = { ..._curRecord, floor };
        _ghostT = 0;
      }
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
        const gm = (DIFFICULTY[difficulty] || DIFFICULTY.mastermind).guardSpeed;
        rectCollide(h, (dx / d) * 50 * gm * dt, (dy / d) * 50 * gm * dt);
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
    // SLOW-MO trigger (max 2/floor) — gives 0.5s @ 0.4x speed.
    if (inCone && !blocked && slowmoT <= 0 && slowmoUsed < 2 && d < 220) {
      slowmoT = 0.5;
      slowmoUsed++;
      sfx.tone(180, 'sine', 0.18, 0.14);
      addPopup(pug.x, pug.y - 14, 'CLOSE!', '#4cc9f0');
    }
    if (inCone && !blocked) { alertedThisFloor = true; perfectFloor = false; alarmTier = Math.max(alarmTier, 2); caught(); }
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
  // SECURITY CAMERAS — sweep cone hits = caught (same as guard).
  for (const cam of secCams) {
    const ang = cam.baseAng + Math.sin(cam.phase * cam.sweep) * 1.0;
    const dx = pug.x - cam.x, dy = pug.y - cam.y;
    const d = Math.hypot(dx, dy);
    if (d > cam.range) continue;
    let diff = Math.atan2(dy, dx) - ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > cam.fov) continue;
    // line-of-sight via walls
    let blocked = false;
    const steps = 14;
    for (let i = 1; i < steps && !blocked; i++) {
      const t = i / steps;
      const sx = cam.x + (pug.x - cam.x) * t;
      const sy = cam.y + (pug.y - cam.y) * t;
      if (isWallNear(sx, sy, 2)) blocked = true;
      for (const sb of smokeBombs) {
        if (Math.hypot(sx - sb.x, sy - sb.y) < 90) { blocked = true; break; }
      }
    }
    if (!blocked) {
      alertedThisFloor = true; perfectFloor = false; alarmTier = Math.max(alarmTier, 2);
      caught();
    }
  }
  // LASERS — beam active when sin(phase * 2π/period) > 0. Touching while not
  // jumping = full alarm. Standing on a vent pad and exiting it instead = safe.
  if (_jumpT <= 0) {
    for (const lz of lasers) {
      const active = Math.sin(lz.phase * (Math.PI * 2 / lz.period)) > 0;
      if (!active) continue;
      const px = pug.x, py = pug.y;
      if (px > lz.x - 8 && px < lz.x + lz.w + 8 && py > lz.y - 8 && py < lz.y + lz.h + 8) {
        alertedThisFloor = true; perfectFloor = false; alarmTier = 3;
        _trySiren(now_perf());
        addShake(8, 0.35);
        for (const h of humans) h.alertT = 4.5; // wake all
        caught();
        break;
      }
    }
  }
  // X-RAY SCANNERS — same behavior as lasers but on a separate cycle. Touch
  // while active = full alarm. Slightly slower pulse so they're learnable.
  if (_jumpT <= 0) {
    for (const sc of scanners) {
      const active = Math.sin(sc.phase * (Math.PI * 2 / sc.period)) > 0;
      if (!active) continue;
      const px = pug.x, py = pug.y;
      if (px > sc.x - 6 && px < sc.x + sc.w + 6 && py > sc.y - 6 && py < sc.y + sc.h + 6) {
        alertedThisFloor = true; perfectFloor = false; alarmTier = 3;
        _trySiren(now_perf());
        addShake(7, 0.32);
        for (const h of humans) h.alertT = 4.5;
        caught();
        break;
      }
    }
  }
  // VENTS — step on a pad → 0.4s crawl tween → teleport to paired pad.
  for (const v of vents) {
    if (v.cd > 0) { v.cd -= dt; continue; }
    if (pug.x > v.x && pug.x < v.x + v.w && pug.y > v.y && pug.y < v.y + v.h) {
      const other = vents.find((o) => o !== v && o.pair === v.pair);
      if (other) {
        pug.x = other.x + other.w / 2;
        pug.y = other.y + other.h / 2;
        v.cd = 1.2; other.cd = 1.2;
        sfx.tone(220, 'sine', 0.18, 0.18);
        addPopup(pug.x, pug.y - 14, 'VENT', '#b0e8ff');
        // Bonus: silent dodge = +10 STEALTH popup
        if (perfectFloor && performance.now() - _stealthPop > 1500) {
          _stealthPop = performance.now();
          addPopup(pug.x + 12, pug.y - 28, '+10 STEALTH', '#5ef38c');
        }
      }
    }
  }
  // Alarm tier audio (siren / klaxon / soft beep). Decays back to 0 over 2s.
  if (alarmTier > 0) {
    // any guard alerted bumps to ≥1
    for (const h of humans) if (h.alertT > 0) { alarmTier = Math.max(alarmTier, 2); break; }
  }
  // STEALTH ESTABLISHED — fires once after 2 continuous seconds without
  // any guard suspicion. Resets on any (_closeT > 0.5) or alertT > 0.
  let anySus = false;
  for (const h of humans) {
    if ((h._closeT || 0) > 0.5 || (h.alertT || 0) > 0) { anySus = true; break; }
  }
  if (anySus) {
    _stealthEstT = 0;
  } else {
    const prev = _stealthEstT;
    _stealthEstT += dt;
    if (prev < 2 && _stealthEstT >= 2 && _stealthBadgeT <= 0) {
      _stealthBadgeT = 2.5;
      sfx.tone(880, 'sine', 0.06, 0.16);
    }
  }
  if (_stealthBadgeT > 0) _stealthBadgeT = Math.max(0, _stealthBadgeT - dt);
  updateHud();
}
// Throttled alarm siren.
function now_perf() { return performance.now() / 1000; }
function _trySiren(t) {
  if (t - _alarmAt < 0.5) return;
  _alarmAt = t;
  sfx.sweep(880, 220, 'square', 0.5, 0.32);
  sfx.tone(110, 'sawtooth', 0.4, 0.4);
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
  // Round-2 polish: surface the dollar total alongside the item count.
  const _haulEl = document.getElementById('end-haul');
  if (_haulEl) _haulEl.textContent = '$' + (totalLootValue || 0);
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
  // VENTS — silver grate, recessed, with directional arrow pointing to pair.
  for (const v of vents) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(v.x, v.y, v.w, v.h);
    ctx.fillStyle = '#7a7a8a';
    ctx.fillRect(v.x + 1, v.y + 1, v.w - 2, v.h - 2);
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    for (let i = 0; i < 4; i++) ctx.fillRect(v.x + 2, v.y + 4 + i * 5, v.w - 4, 2);
    ctx.fillStyle = '#b0e8ff'; ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('VENT', v.x + v.w / 2, v.y - 2);
    // Directional arrow — drawn 18px outside the pad in the direction of the
    // linked pad. Pulses gently so it draws the eye.
    if (v.dirAng != null && v.cd <= 0) {
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      const ox = cx + Math.cos(v.dirAng) * 22;
      const oy = cy + Math.sin(v.dirAng) * 22;
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(v.dirAng);
      ctx.fillStyle = `rgba(176,232,255,${pulse * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-1, 0); ctx.lineTo(-4, 4); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${pulse * 0.6})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
  // LASERS — pulsing red beams (active = bright, inactive = faint).
  // Now with bright white core + outer haze halo + glowing emitter eyes.
  for (const lz of lasers) {
    const active = Math.sin(lz.phase * (Math.PI * 2 / lz.period)) > 0;
    // Outer haze halo when active — soft glow around the beam axis.
    if (active) {
      ctx.fillStyle = 'rgba(255,40,40,0.18)';
      if (lz.axis === 'h') ctx.fillRect(lz.x, lz.y - 2, lz.w, lz.h + 4);
      else ctx.fillRect(lz.x - 2, lz.y, lz.w + 4, lz.h);
    }
    ctx.fillStyle = active ? 'rgba(255,40,40,0.85)' : 'rgba(255,40,40,0.18)';
    ctx.fillRect(lz.x, lz.y, lz.w, lz.h);
    if (active) {
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(255,180,180,0.9)';
      ctx.fillRect(lz.x + 1, lz.y + 1, lz.w - 2, lz.h - 2);
      // White hot core down the middle
      ctx.fillStyle = '#fff';
      if (lz.axis === 'h') ctx.fillRect(lz.x, lz.y + lz.h / 2 - 0.5, lz.w, 1);
      else ctx.fillRect(lz.x + lz.w / 2 - 0.5, lz.y, 1, lz.h);
      ctx.shadowBlur = 0;
    }
    // emitter caps — heavy metal housing with red lens glow
    ctx.fillStyle = '#1a0a0a';
    if (lz.axis === 'h') {
      ctx.fillRect(lz.x - 5, lz.y - 3, 5, 10); ctx.fillRect(lz.x + lz.w, lz.y - 3, 5, 10);
      ctx.fillStyle = '#3a1a1a'; ctx.fillRect(lz.x - 4, lz.y - 2, 4, 8); ctx.fillRect(lz.x + lz.w, lz.y - 2, 4, 8);
      // emitter lens dot
      ctx.fillStyle = active ? '#ff3a3a' : '#3a1010';
      ctx.fillRect(lz.x - 2, lz.y + lz.h / 2 - 1, 2, 2);
      ctx.fillRect(lz.x + lz.w, lz.y + lz.h / 2 - 1, 2, 2);
    } else {
      ctx.fillRect(lz.x - 3, lz.y - 5, 10, 5); ctx.fillRect(lz.x - 3, lz.y + lz.h, 10, 5);
      ctx.fillStyle = '#3a1a1a'; ctx.fillRect(lz.x - 2, lz.y - 4, 8, 4); ctx.fillRect(lz.x - 2, lz.y + lz.h, 8, 4);
      ctx.fillStyle = active ? '#ff3a3a' : '#3a1010';
      ctx.fillRect(lz.x + lz.w / 2 - 1, lz.y - 2, 2, 2);
      ctx.fillRect(lz.x + lz.w / 2 - 1, lz.y + lz.h, 2, 2);
    }
  }
  // X-RAY SCANNERS (airport) — wider blue/violet field with scanning lines.
  for (const sc of scanners) {
    const active = Math.sin(sc.phase * (Math.PI * 2 / sc.period)) > 0;
    // Field outline
    ctx.fillStyle = active ? 'rgba(120,80,255,0.55)' : 'rgba(80,60,160,0.18)';
    ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
    if (active) {
      ctx.shadowColor = '#b080ff'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(220,200,255,0.85)';
      ctx.fillRect(sc.x + 1, sc.y + 1, sc.w - 2, sc.h - 2);
      ctx.shadowBlur = 0;
      // Scanning line — moves across the field
      const pct = (Math.sin(sc.phase * 4) + 1) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      if (sc.axis === 'h') ctx.fillRect(sc.x + pct * (sc.w - 4), sc.y, 4, sc.h);
      else ctx.fillRect(sc.x, sc.y + pct * (sc.h - 4), sc.w, 4);
    }
    // Frame caps
    ctx.fillStyle = '#221a3a';
    if (sc.axis === 'h') { ctx.fillRect(sc.x - 5, sc.y - 3, 5, sc.h + 6); ctx.fillRect(sc.x + sc.w, sc.y - 3, 5, sc.h + 6); }
    else { ctx.fillRect(sc.x - 3, sc.y - 5, sc.w + 6, 5); ctx.fillRect(sc.x - 3, sc.y + sc.h, sc.w + 6, 5); }
    ctx.fillStyle = '#b080ff'; ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('X-RAY', sc.x + sc.w / 2, sc.y - 5);
  }
  // SAFES — heavy metal box; halo + meter sweep when actively cracking.
  for (const sf of safes) {
    if (sf.cracked) {
      // Cracked open — door swung, shows the gold inside
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(sf.x, sf.y, sf.w, sf.h);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(sf.x + 4, sf.y + 4, sf.w - 8, sf.h - 8);
      ctx.fillStyle = '#c89c20';
      ctx.fillRect(sf.x + 6, sf.y + sf.h - 8, sf.w - 12, 2);
      continue;
    }
    // Body — dark steel with bolts
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sf.x + 2, sf.y + sf.h - 2, sf.w, 4);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(sf.x, sf.y, sf.w, sf.h);
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(sf.x + 3, sf.y + 3, sf.w - 6, sf.h - 6);
    // Dial in the middle
    const cx = sf.x + sf.w / 2, cy = sf.y + sf.h / 2;
    ctx.fillStyle = '#cacacf';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
    // Bolts
    ctx.fillStyle = '#cacacf';
    for (const [ox, oy] of [[6, 6], [sf.w - 6, 6], [6, sf.h - 6], [sf.w - 6, sf.h - 6]]) {
      ctx.beginPath(); ctx.arc(sf.x + ox, sf.y + oy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // Halo when active
    if (activeSafe === sf) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      ctx.strokeStyle = `rgba(255,210,63,${0.6 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, sf.w * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
    // Label
    ctx.fillStyle = '#ffd23f'; ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('SAFE $' + sf.val, cx, sf.y - 3);
  }
  // SECURITY CAMERAS — wall-bracket + lens + sweep beam.
  // Beam cone now uses a radial gradient (bright near the lens, faint at the
  // far edge) + a brighter glow rim along the sweep edge for readability.
  for (const cam of secCams) {
    const ang = cam.baseAng + Math.sin(cam.phase * cam.sweep) * 1.0;
    // Gradient cone — strongest at the lens, falls off to nothing at the rim.
    const conGrd = ctx.createRadialGradient(cam.x, cam.y, 6, cam.x, cam.y, cam.range);
    conGrd.addColorStop(0, 'rgba(255,40,40,0.42)');
    conGrd.addColorStop(0.55, 'rgba(255,40,40,0.18)');
    conGrd.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = conGrd;
    ctx.beginPath(); ctx.moveTo(cam.x, cam.y);
    ctx.arc(cam.x, cam.y, cam.range, ang - cam.fov, ang + cam.fov);
    ctx.closePath(); ctx.fill();
    // Outer glow rim — bright thin arc along the sweep's far edge.
    ctx.strokeStyle = 'rgba(255,80,80,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, cam.range - 1, ang - cam.fov, ang + cam.fov);
    ctx.stroke();
    // Side edges (faint dashed) — pulses if you're inside the cone
    ctx.strokeStyle = 'rgba(255,40,40,0.35)';
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cam.x, cam.y);
    ctx.lineTo(cam.x + Math.cos(ang - cam.fov) * cam.range, cam.y + Math.sin(ang - cam.fov) * cam.range);
    ctx.moveTo(cam.x, cam.y);
    ctx.lineTo(cam.x + Math.cos(ang + cam.fov) * cam.range, cam.y + Math.sin(ang + cam.fov) * cam.range);
    ctx.stroke();
    ctx.setLineDash([]);
    // Menacing security camera — wall bracket, dome housing, lens, LED, antenna
    // Bracket on wall (behind body) with mounting screw heads
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(cam.x - 7, cam.y - 7, 14, 6);
    ctx.fillStyle = '#2a2a3a'; ctx.fillRect(cam.x - 6, cam.y - 6, 12, 4);
    ctx.fillStyle = '#5a5a6a'; ctx.fillRect(cam.x - 5, cam.y - 6, 10, 1);
    // Screws
    ctx.fillStyle = '#cacacf';
    ctx.fillRect(cam.x - 5, cam.y - 5, 1, 1);
    ctx.fillRect(cam.x + 4, cam.y - 5, 1, 1);
    ctx.save(); ctx.translate(cam.x, cam.y); ctx.rotate(ang);
    // Camera body — domed top + rectangular barrel
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(-8, -4, 16, 8);
    ctx.fillStyle = '#1a1a26'; ctx.fillRect(-7, -3, 14, 6);
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(-7, -3, 14, 1); // top highlight
    ctx.fillStyle = '#000'; ctx.fillRect(-7, 3, 14, 1); // bottom shadow
    // Lens — glossy black circle with bright catch-light
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(2, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath(); ctx.arc(2, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(1.2, -0.8, 0.7, 0, Math.PI * 2); ctx.fill();
    // Antenna stub
    ctx.fillStyle = '#7a7a8a'; ctx.fillRect(-8, -1, 1, 2);
    // Glowing red LED — pulses with phase
    const ledPulse = 0.5 + 0.5 * Math.sin(cam.phase * 4);
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 6 + ledPulse * 4;
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(5, -1, 3, 2);
    ctx.fillStyle = '#ff8a8a'; ctx.fillRect(5, -1, 3, 1);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // GHOST-REPLAY overlay — faint pug trail tracking last successful run
  if (ghostReplay && ghostReplay.samples && ghostReplay.samples.length > 0 && ghostReplay.floor === floor) {
    // Find sample nearest current playback time
    const samples = ghostReplay.samples;
    let idx = 0;
    for (; idx < samples.length - 1; idx++) if (samples[idx + 1].t > _ghostT) break;
    const g = samples[idx];
    ctx.globalAlpha = 0.35;
    drawPug(ctx, g.x, g.y, { size: 26, body: '#b0e8ff', mask: '#5a8aac' });
    ctx.globalAlpha = 1;
    if (_ghostT > samples[samples.length - 1].t) _ghostT = 0;
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
  // Loot — pixel-art icons from shared library (or themed fallback)
  for (const lt of loot) {
    if (lt.taken) continue;
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    const fn = drawIcon[lt.iconName];
    if (fn) fn(ctx, lt.x, lt.y, 22);
    else drawThemedLoot(lt);
    ctx.shadowBlur = 0;
  }
  // Loot-value tooltip — Monaco-style: hover/proximity reveals value BEFORE
  // pickup. Now also shows WEIGHT (heavy = slows you) and NOISE (loud = guards
  // hear). Helps decide $30 sock vs $200 crown that slows you down.
  for (const lt of loot) {
    if (lt.taken) continue;
    const d = Math.hypot(lt.x - pug.x, lt.y - pug.y);
    if (d > 80) continue;
    const alpha = Math.max(0.25, Math.min(1, (80 - d) / 50));
    const name = lt.iconName.replace(/([A-Z])/g, ' $1').toUpperCase();
    // Weight + noise tags. goldBar = heavy + quiet, gem = light + quiet,
    // chandelier = heavy + loud (clinky), laptop = light + loud (snap shut).
    const heavy = lt.kind === 'goldBar' || lt.kind === 'chandelier' || lt.kind === 'painting' || lt.kind === 'luggage';
    const loud = lt.kind === 'chandelier' || lt.kind === 'laptop' || lt.kind === 'monitor' || lt.iconName === 'camera';
    const w = heavy ? 'HVY' : 'LT';
    const n = loud ? 'LOUD' : 'QUIET';
    const label = `${name} · $${lt.val}`;
    const sub = `${w} · ${n}`;
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width;
    const sw = ctx.measureText(sub).width;
    const boxW = Math.max(tw, sw) + 8;
    const ly = lt.y - 28;
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.82})`;
    ctx.fillRect(lt.x - boxW / 2, ly - 7, boxW, 22);
    ctx.fillStyle = lt.rare ? `rgba(255,210,63,${alpha})` : `rgba(94,243,140,${alpha})`;
    ctx.fillText(label, lt.x, ly + 1);
    // Sub line — orange if heavy or loud, grey if normal
    const subColor = (heavy || loud) ? `rgba(255,142,60,${alpha})` : `rgba(180,180,200,${alpha * 0.85})`;
    ctx.fillStyle = subColor;
    ctx.font = "6px 'Press Start 2P', monospace";
    ctx.fillText(sub, lt.x, ly + 11);
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
  // Humans + vision cones (color shifts with suspicion) — depth-sort so
  // overlapping guards layer back-to-front for a fake 3D feel.
  _depthSort(humans);
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
    // depth3D drop shadow under guard
    _depthShadow(ctx, h.x, h.y + 16, 18, { alpha: 0.4 });
    // Guard body + theme uniform. Each guard receives a stable variant index
    // (cached on first draw) so they keep the same uniform across frames even
    // though humans are not labeled. Variants are picked from a theme palette
    // so e.g. museum gives jacket/cap/blazer/captain looks while office gives
    // suit/tie/blazer/lanyard looks. Pure cosmetic.
    if (h._uniformIdx == null) h._uniformIdx = ((h.x | 0) ^ (h.y | 0)) % 4;
    const _gOut = _heistGuardOutfit(buildingTheme, h._uniformIdx);
    drawPug(ctx, h.x, h.y, { size: 32, ..._gOut });
    _drawHeistGuardAccessory(ctx, h.x, h.y, buildingTheme, h._uniformIdx, 32);
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
  // Particles — halo particles expand as a ring; others are pixel squares.
  for (const p of particles) {
    const fade = 1 - p.t / p.life;
    ctx.globalAlpha = fade;
    if (p.halo) {
      const r = p.size + (p.t / p.life) * 36;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, 4 * fade);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
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
  // Cat allies — small grey pug variant (depth3D shadow under each)
  for (const c of cats) {
    _depthShadow(ctx, c.x, c.y + 12, 12, { alpha: 0.35 });
    drawPug(ctx, c.x, c.y, { size: 22, body: '#5a5a5a', mask: '#2a2a2a', tongueOut: false });
    ctx.fillStyle = '#5ef38c'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('ALLY', c.x, c.y - 22);
  }
  // JUMP arc — translate pug upward briefly. Drawn just before pug rendering.
  let _jumpLift = 0;
  if (_jumpT > 0) {
    const k = _jumpT / 0.45;
    _jumpLift = Math.sin(k * Math.PI) * 14;
    // shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(pug.x, pug.y + 8, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Pug — hero (with hit flash overlay + ragdoll tilt if knocked out)
  const _origY = pug.y;
  if (_jumpLift) pug.y -= _jumpLift;
  // depth3D drop shadow under the pug (stays on the floor, doesn't lift with jump)
  _depthShadow(ctx, pug.x, _origY + 14, 16, { alpha: 0.45 });
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
  // Theme-based pug outfit. Each building gives the pug a distinct disguise so
  // returning players can tell what floor they're on at a glance.
  const _pugOutfit = _heistPugOutfit(buildingTheme);
  if (hitFlashT > 0) {
    ctx.save(); ctx.filter = 'brightness(2.5) saturate(0)';
    drawPug(ctx, pug.x, pug.y, { size: 30, ..._pugOutfit });
    _drawHeistPugAccessory(ctx, pug.x, pug.y, buildingTheme, 30);
    ctx.filter = 'none'; ctx.restore();
  } else {
    drawPug(ctx, pug.x, pug.y, { size: 30, ..._pugOutfit });
    _drawHeistPugAccessory(ctx, pug.x, pug.y, buildingTheme, 30);
  }
  if (isKnocked) { ctx.restore(); }
  // restore actual y after jump-lift draw offset
  if (_jumpLift) pug.y = _origY;
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
  // Dust motes (ambient, soft) — color shifts per theme.
  // museum=warm dust, bank=gold, mansion=warm white, office=cyan, airport=pale
  const moteColor = {
    museum:  'rgba(255,220,170,0.22)',
    bank:    'rgba(255,210,90,0.20)',
    mansion: 'rgba(255,210,255,0.18)',
    office:  'rgba(120,200,255,0.18)',
    airport: 'rgba(200,200,255,0.18)',
  }[buildingTheme] || 'rgba(220,210,255,0.18)';
  ctx.fillStyle = moteColor;
  for (const d of dustMotes) {
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  // THEME ATMOSPHERE — per-building flavor passes (all cheap, all subtle).
  if (buildingTheme === 'museum') {
    // Diagonal beams of light from the ceiling — dust catches the rays.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const bx = (W / 4) * (i + 1);
      const grad = ctx.createLinearGradient(bx - 30, 0, bx + 30, H);
      grad.addColorStop(0, 'rgba(255,230,170,0.10)');
      grad.addColorStop(0.5, 'rgba(255,230,170,0.04)');
      grad.addColorStop(1, 'rgba(255,230,170,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - 30, 0); ctx.lineTo(bx + 30, 0);
      ctx.lineTo(bx + 60, H); ctx.lineTo(bx - 60, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  } else if (buildingTheme === 'bank') {
    // Gold-tint overlay — adds a warm yellow film over the whole floor.
    ctx.fillStyle = 'rgba(255,200,80,0.07)';
    ctx.fillRect(0, 0, W, H);
  } else if (buildingTheme === 'mansion') {
    // Chandelier sparkle — small glints at the ceiling lights, twinkling.
    for (const l of lights) {
      if (!l.on) continue;
      const tw = 0.5 + 0.5 * Math.sin((performance.now() + l.flickerT * 1000) / 110);
      if (tw < 0.5) continue;
      ctx.fillStyle = `rgba(255,240,200,${tw * 0.8})`;
      ctx.fillRect(l.x - 1, l.y - 6, 2, 2);
      ctx.fillRect(l.x - 1, l.y + 4, 2, 2);
      ctx.fillRect(l.x - 6, l.y - 1, 2, 2);
      ctx.fillRect(l.x + 4, l.y - 1, 2, 2);
    }
  } else if (buildingTheme === 'office') {
    // CRT flicker — faint horizontal scanline that drifts down the screen.
    const sy = (performance.now() / 8) % H;
    ctx.fillStyle = 'rgba(120,255,200,0.04)';
    ctx.fillRect(0, sy, W, 2);
    ctx.fillRect(0, (sy + H / 2) % H, W, 1);
  } else if (buildingTheme === 'airport') {
    // Cold fluorescent tint + soft white glow at top (sky-light look).
    ctx.fillStyle = 'rgba(180,210,255,0.05)';
    ctx.fillRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, 120);
    sky.addColorStop(0, 'rgba(220,235,255,0.18)');
    sky.addColorStop(1, 'rgba(220,235,255,0)');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 120);
  }
  // DECOY BOT — tiny robot pug strolling toward the lure point.
  if (decoyBot) {
    const a = decoyBot.t < 0.2 ? decoyBot.t / 0.2 : (decoyBot.t > decoyBot.life - 0.4 ? Math.max(0, (decoyBot.life - decoyBot.t) / 0.4) : 1);
    const wob = Math.sin(decoyBot.wobble) * 2;
    ctx.save();
    ctx.globalAlpha = a;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(decoyBot.x, decoyBot.y + 10, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Body — chrome plate
    ctx.fillStyle = '#cacacf';
    ctx.fillRect(decoyBot.x - 9, decoyBot.y - 6 + wob, 18, 12);
    ctx.fillStyle = '#8a8a9a';
    ctx.fillRect(decoyBot.x - 9, decoyBot.y - 6 + wob, 18, 2);
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(decoyBot.x - 9, decoyBot.y + 4 + wob, 18, 2);
    // Head
    ctx.fillStyle = '#e0e0e8';
    ctx.fillRect(decoyBot.x - 6, decoyBot.y - 14 + wob, 12, 10);
    // Eyes — red LEDs
    ctx.fillStyle = '#ff3a3a';
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 6;
    ctx.fillRect(decoyBot.x - 4, decoyBot.y - 11 + wob, 2, 2);
    ctx.fillRect(decoyBot.x + 2, decoyBot.y - 11 + wob, 2, 2);
    ctx.shadowBlur = 0;
    // Antenna with blinking light
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(decoyBot.x - 1, decoyBot.y - 20 + wob, 2, 6);
    const blink = ((performance.now() / 200) | 0) & 1 ? '#ff3a3a' : '#ffd23f';
    ctx.fillStyle = blink;
    ctx.fillRect(decoyBot.x - 2, decoyBot.y - 22 + wob, 4, 2);
    // Ears (tiny triangles)
    ctx.fillStyle = '#8a8a9a';
    ctx.beginPath();
    ctx.moveTo(decoyBot.x - 6, decoyBot.y - 14 + wob);
    ctx.lineTo(decoyBot.x - 9, decoyBot.y - 17 + wob);
    ctx.lineTo(decoyBot.x - 4, decoyBot.y - 13 + wob);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(decoyBot.x + 6, decoyBot.y - 14 + wob);
    ctx.lineTo(decoyBot.x + 9, decoyBot.y - 17 + wob);
    ctx.lineTo(decoyBot.x + 4, decoyBot.y - 13 + wob);
    ctx.closePath(); ctx.fill();
    // BARK speech bubble
    if (((performance.now() / 600) | 0) & 1) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(decoyBot.x + 10, decoyBot.y - 24 + wob, 22, 10);
      ctx.fillStyle = '#1a0d05'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('BORK!', decoyBot.x + 21, decoyBot.y - 17 + wob);
    }
    ctx.restore();
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

// Per-theme pug body+mask palette for heist disguise.
const _HEIST_PUG = {
  museum:  { body: '#d8a070', mask: '#221008' },
  bank:    { body: '#b88858', mask: '#1a0d05' },
  mansion: { body: '#caa080', mask: '#2a1a10' },
  office:  { body: '#c08858', mask: '#1c0e06' },
  airport: { body: '#d09060', mask: '#2a1208' },
};
function _heistPugOutfit(theme) { return _HEIST_PUG[theme] || { body: '#c8854a', mask: '#1a0d05' }; }

// Per-theme heist disguise accessory layer (bowtie/tie/cap/monocle/scarf).
function _drawHeistPugAccessory(ctx, x, y, theme, size) {
  const s = size / 36;
  ctx.save();
  if (theme === 'museum') {
    ctx.fillStyle = '#7a1a2e'; ctx.fillRect(x - 4 * s, y + 8 * s, 8 * s, 3 * s);
    ctx.fillStyle = '#a02838'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 3 * s);
    ctx.fillStyle = '#f0e8d0'; ctx.fillRect(x - 3 * s, y + 12 * s, 4 * s, 3 * s);
  } else if (theme === 'bank') {
    ctx.fillStyle = '#1a2848'; ctx.fillRect(x - 5 * s, y + 7 * s, 10 * s, 3 * s);
    ctx.fillStyle = '#3a5a90'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 8 * s);
    ctx.fillStyle = '#5a7ab0'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 2 * s);
  } else if (theme === 'mansion') {
    ctx.fillStyle = '#4a2868'; ctx.fillRect(x - 5 * s, y + 7 * s, 10 * s, 3 * s);
    ctx.fillStyle = '#caa8d8'; ctx.fillRect(x - 4 * s, y + 8 * s, 8 * s, 1 * s);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + 4 * s, y - 3 * s, 3 * s, 0, Math.PI * 2); ctx.stroke();
  } else if (theme === 'office') {
    ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x - 6 * s, y + 8 * s, 12 * s, 4 * s);
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.moveTo(x - 6 * s, y + 8 * s); ctx.lineTo(x, y + 12 * s); ctx.lineTo(x + 6 * s, y + 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c83838'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 6 * s);
  } else if (theme === 'airport') {
    ctx.fillStyle = '#a02828'; ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 4 * s);
    ctx.fillStyle = '#c83838'; ctx.fillRect(x - 6 * s, y - 13 * s, 12 * s, 2 * s);
    ctx.fillStyle = '#1a1a26'; ctx.fillRect(x - 7 * s, y - 10 * s, 14 * s, 1 * s);
    ctx.fillStyle = '#5ea0c8'; ctx.fillRect(x - 6 * s, y + 7 * s, 12 * s, 3 * s);
  }
  ctx.restore();
}

// Per-theme guard palette table (4 variants per theme).
const _HEIST_GUARD = {
  museum:  [{ body: '#2a3a5a', mask: '#0a1a2a' }, { body: '#8a7858', mask: '#3a2810' }, { body: '#6a6a78', mask: '#2a2a32' }, { body: '#6a4828', mask: '#2a1808' }],
  bank:    [{ body: '#1a1a22', mask: '#0a0a10' }, { body: '#5a5a6a', mask: '#2a2a32' }, { body: '#2a3a5a', mask: '#0a1a2a' }, { body: '#3a2818', mask: '#1a0d05' }],
  mansion: [{ body: '#221a1a', mask: '#0a0a10' }, { body: '#7a7a82', mask: '#3a3a42' }, { body: '#d8d0c8', mask: '#5a5040' }, { body: '#7a2828', mask: '#3a1010' }],
  office:  [{ body: '#3a3a4a', mask: '#1a1a22' }, { body: '#5a8a4a', mask: '#2a4a20' }, { body: '#2a4a78', mask: '#0a2a48' }, { body: '#0a0a12', mask: '#000000' }],
  airport: [{ body: '#1a2a48', mask: '#0a1020' }, { body: '#3a5aa0', mask: '#1a2a50' }, { body: '#c87030', mask: '#683818' }, { body: '#4a4a5a', mask: '#1a1a22' }],
};
function _heistGuardOutfit(theme, variant) {
  const p = _HEIST_GUARD[theme];
  return p ? p[variant & 3] : { body: '#a89888', mask: '#3a2810' };
}

// Per-theme/variant guard accessory (cap/badge/shades/tie/lanyard/etc).
function _drawHeistGuardAccessory(ctx, x, y, theme, variant, size) {
  const s = size / 36, v = variant & 3;
  ctx.save();
  if (theme === 'museum') {
    if (v === 0 || v === 3) {
      ctx.fillStyle = v === 0 ? '#0a1a2a' : '#3a1808';
      ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 3 * s);
      ctx.fillRect(x - 8 * s, y - 11 * s, 16 * s, 2 * s);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 1 * s, y - 13 * s, 2 * s, 1 * s);
    } else if (v === 1) {
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 5 * s, y + 6 * s, 2 * s, 3 * s);
    }
  } else if (theme === 'bank') {
    if (v === 0 || v === 2) {
      ctx.fillStyle = '#0a0a10'; ctx.fillRect(x - 6 * s, y - 4 * s, 12 * s, 2 * s);
      ctx.fillStyle = '#1a1a22';
      ctx.fillRect(x - 6 * s, y - 3 * s, 5 * s, 2 * s); ctx.fillRect(x + 1 * s, y - 3 * s, 5 * s, 2 * s);
    }
    if (v === 1 || v === 3) {
      ctx.fillStyle = '#cacacf';
      ctx.fillRect(x + 6 * s, y - 5 * s, 1 * s, 4 * s); ctx.fillRect(x + 5 * s, y - 1 * s, 2 * s, 1 * s);
    }
  } else if (theme === 'mansion') {
    if (v === 0) {
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 5 * s, y + 8 * s, 10 * s, 2 * s);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 5 * s);
    } else if (v === 1) {
      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x - 6 * s, y - 14 * s, 12 * s, 3 * s);
    } else if (v === 2) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 14 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
    } else if (v === 3) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 8 * s, y + 4 * s, 3 * s, 3 * s); ctx.fillRect(x + 5 * s, y + 4 * s, 3 * s, 3 * s);
    }
  } else if (theme === 'office') {
    if (v === 0) {
      ctx.fillStyle = '#c83838'; ctx.fillRect(x - 1 * s, y + 8 * s, 2 * s, 7 * s);
    } else if (v === 1) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 4 * s, y + 4 * s, 1 * s, 6 * s); ctx.fillRect(x + 3 * s, y + 4 * s, 1 * s, 6 * s);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 3 * s, y + 9 * s, 6 * s, 2 * s);
    } else if (v === 2) {
      ctx.fillStyle = '#8a6840'; ctx.fillRect(x + 6 * s, y - 8 * s, 2 * s, 14 * s);
      ctx.fillStyle = '#5a8aac'; ctx.fillRect(x + 4 * s, y + 4 * s, 5 * s, 4 * s);
    } else if (v === 3) {
      ctx.fillStyle = '#1a1a26'; ctx.fillRect(x + 5 * s, y + 7 * s, 3 * s, 4 * s);
      ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x + 5 * s, y + 7 * s, 3 * s, 1 * s);
    }
  } else if (theme === 'airport') {
    if (v === 0) {
      ctx.fillStyle = '#0a1020'; ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 4 * s);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 3 * s, y - 12 * s, 6 * s, 1 * s);
    } else if (v === 1) {
      ctx.fillStyle = '#1a2a50'; ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 3 * s);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1 * s, y - 13 * s, 2 * s, 1 * s);
    } else if (v === 2) {
      ctx.fillStyle = '#ff8e3c'; ctx.fillRect(x - 6 * s, y + 5 * s, 12 * s, 4 * s);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 6 * s, y + 6 * s, 12 * s, 1 * s);
    } else if (v === 3) {
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 8 * s, y - 12 * s, 16 * s, 2 * s);
      ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 3 * s);
    }
  }
  ctx.restore();
}

// Themed-loot icons — small pixel art for gem/bar/painting/laptop.
function drawThemedLoot(lt) {
  const x = lt.x, y = lt.y, c = lt.color || '#ffd23f';
  switch (lt.iconName) {
    case 'gem': {
      // Cut gem with multi-facet shading + inner sparkle + tip highlight.
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 4, y + 8);
      ctx.lineTo(x - 4, y + 8); ctx.lineTo(x - 7, y - 1); ctx.closePath(); ctx.fill();
      // Right-facet shadow
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.moveTo(x, y - 9); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 4, y + 8);
      ctx.lineTo(x, y - 2); ctx.closePath(); ctx.fill();
      // Left main highlight
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x + 1, y - 6); ctx.lineTo(x - 2, y - 1); ctx.closePath(); ctx.fill();
      // Inner sparkle dot
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 1, y - 5, 1, 1);
      ctx.fillRect(x + 3, y - 2, 1, 1);
      // Crown ridge
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 7, y - 1); ctx.lineTo(x + 7, y - 1); ctx.stroke();
      break;
    }
    case 'urn':
      ctx.fillStyle = '#a06030'; ctx.fillRect(x - 5, y - 4, 10, 9);
      ctx.fillStyle = '#c89c20'; ctx.fillRect(x - 6, y - 5, 12, 2);
      ctx.fillStyle = '#5a3010'; ctx.fillRect(x - 5, y + 4, 10, 2);
      break;
    case 'bar':
      // Gold bar — beveled edges + stamped serial dots + corner highlights
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 9, y - 4, 18, 8);
      ctx.fillStyle = '#c89c20'; ctx.fillRect(x - 9, y + 2, 18, 2);
      ctx.fillStyle = '#a07810'; ctx.fillRect(x - 9, y + 3, 18, 1);
      ctx.fillStyle = '#fff4a0'; ctx.fillRect(x - 8, y - 3, 16, 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 7, y - 3, 12, 1);
      // engraved serial dots in the centre
      ctx.fillStyle = '#7a5808';
      ctx.fillRect(x - 5, y, 1, 1); ctx.fillRect(x - 2, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1);
      // stamp circle
      ctx.strokeStyle = '#7a5808'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x - 6, y - 1, 1.5, 0, Math.PI * 2); ctx.stroke();
      break;
    case 'stack':
      ctx.fillStyle = '#1a8a40'; ctx.fillRect(x - 8, y - 4, 16, 8);
      ctx.fillStyle = '#5ef38c'; ctx.fillRect(x - 8, y - 4, 16, 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 1, 4, 2);
      break;
    case 'painting': {
      // Ornate gilded frame + landscape inside (sky band, hills, sun, signature)
      ctx.fillStyle = '#1a0a04'; ctx.fillRect(x - 10, y - 7, 20, 14); // outer shadow
      ctx.fillStyle = '#8a6028'; ctx.fillRect(x - 10, y - 7, 20, 14); // frame
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 9, y - 6, 18, 1);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 9, y - 6, 1, 12);
      ctx.fillStyle = '#5a3008'; ctx.fillRect(x + 8, y - 6, 1, 12);
      ctx.fillStyle = '#5a3008'; ctx.fillRect(x - 9, y + 5, 18, 1);
      // canvas — sky / hills / sun
      ctx.fillStyle = '#a8d0e8'; ctx.fillRect(x - 8, y - 5, 16, 6);
      ctx.fillStyle = '#5a8050'; ctx.fillRect(x - 8, y - 1, 16, 4);
      ctx.fillStyle = '#3a6038'; ctx.fillRect(x - 8, y + 1, 16, 2);
      ctx.fillStyle = '#ffce5e'; ctx.fillRect(x + 3, y - 4, 2, 2); // sun
      // signature
      ctx.fillStyle = '#000'; ctx.fillRect(x + 5, y + 3, 2, 1);
      break;
    }
    case 'chand':
      ctx.fillStyle = '#ffce5e';
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 4, y - 5, 2, 3); ctx.fillRect(x + 2, y - 5, 2, 3);
      break;
    case 'laptop': {
      // Laptop — open lid + base keyboard + glowing screen with app icons
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 9, y - 6, 18, 10);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x - 9, y - 6, 18, 1);
      // Glowing screen with backlight bloom
      ctx.fillStyle = '#4cc9f0'; ctx.fillRect(x - 8, y - 5, 16, 8);
      ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(180,240,255,0.55)';
      ctx.fillRect(x - 8, y - 5, 16, 1);
      ctx.shadowBlur = 0;
      // Window bar + app row
      ctx.fillStyle = '#2a3a78'; ctx.fillRect(x - 7, y - 4, 14, 1);
      ctx.fillStyle = '#ff6b6b'; ctx.fillRect(x - 7, y - 4, 1, 1);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 6, y - 4, 1, 1);
      ctx.fillStyle = '#5ef38c'; ctx.fillRect(x - 5, y - 4, 1, 1);
      // Code lines
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - 6, y - 1, 6, 1);
      ctx.fillRect(x - 6, y + 1, 9, 1);
      ctx.fillRect(x - 6, y + 3, 4, 1);
      // Keyboard base — slim sliver under the screen, hinged
      ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x - 9, y + 4, 18, 2);
      ctx.fillStyle = '#cacacf'; ctx.fillRect(x - 4, y + 4, 8, 1); // trackpad
      break;
    }
    case 'monitor':
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 8, y - 6, 16, 11);
      ctx.fillStyle = '#5ef38c'; ctx.fillRect(x - 7, y - 5, 14, 9);
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(x - 3, y + 5, 6, 2);
      break;
    case 'luggage':
      // Roll-along suitcase: dark body, top handle, side stripes, wheels
      ctx.fillStyle = '#3a2a52';
      ctx.fillRect(x - 9, y - 6, 18, 12);
      ctx.fillStyle = '#5a3a82';
      ctx.fillRect(x - 8, y - 5, 16, 3);
      ctx.fillStyle = '#221a3a';
      ctx.fillRect(x - 9, y + 4, 18, 2);
      // handle
      ctx.fillStyle = '#cacacf';
      ctx.fillRect(x - 1, y - 10, 2, 4);
      ctx.fillRect(x - 3, y - 10, 6, 1);
      // wheels
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(x - 7, y + 6, 3, 2); ctx.fillRect(x + 4, y + 6, 3, 2);
      break;
    case 'passport':
      // Red passport with gold seal
      ctx.fillStyle = '#a02828';
      ctx.fillRect(x - 6, y - 8, 12, 14);
      ctx.fillStyle = '#7a1a1a';
      ctx.fillRect(x - 6, y - 8, 12, 1);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x, y - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffce5e';
      ctx.fillRect(x - 4, y + 3, 8, 1);
      break;
    default:
      ctx.fillStyle = c; ctx.fillRect(x - 5, y - 5, 10, 10);
  }
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
  // THEME banner — current building above HUD
  const themeLbl = (buildingTheme || '').toUpperCase();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(W / 2 - 60, 6, 120, 16);
  ctx.fillStyle = '#b0e8ff'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText(themeLbl + (perfectFloor ? ' *' : ''), W / 2, 17);
  // STEALTH EYE icon (open=seen, closed=hidden). Reads faster than text.
  // Aggregate any current suspicion.
  let sus = 0;
  for (const h of humans || []) sus = Math.max(sus, (h._closeT || 0) / 1.5, h.alertT > 0 ? 1 : 0);
  const eyeOpen = sus > 0.35;
  const ex = 24, ey = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = eyeOpen ? '#ff3a3a' : '#5ef38c';
  ctx.beginPath(); ctx.ellipse(ex, ey, 10, eyeOpen ? 7 : 2, 0, 0, Math.PI * 2); ctx.fill();
  if (eyeOpen) {
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
  }
  // MINI-MAP (toggle M) — top-right
  if (miniMapOn) drawMiniMap();
  // SLOW-MO chroma — much stronger blue overlay so it's instantly readable.
  // Was barely visible (0.06 alpha). Now a 14% blue wash + scanlines + edge
  // glow + a "SLOW-MO" chip in the top-center.
  if (slowmoT > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90);
    // Stronger overall wash
    ctx.fillStyle = `rgba(76,201,240,${0.14 * pulse})`;
    ctx.fillRect(0, 0, W, H);
    // Scanlines slightly heavier
    ctx.strokeStyle = `rgba(76,201,240,${0.18 * pulse})`; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
    // Edge glow vignette
    const eg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    eg.addColorStop(0, 'rgba(76,201,240,0)');
    eg.addColorStop(1, `rgba(76,201,240,${0.55 * pulse})`);
    ctx.fillStyle = eg; ctx.fillRect(0, 0, W, H);
    // Center chip
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 50, H / 2 - 80, 100, 18);
    ctx.fillStyle = '#b0e8ff'; ctx.font = "bold 9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('• SLOW-MO •', W / 2, H / 2 - 67);
  }
  // STEALTH ESTABLISHED — pulsing badge near top center after 2s in shadow.
  if (_stealthBadgeT > 0) {
    const a = _stealthBadgeT > 0.4 ? 1 : _stealthBadgeT / 0.4;
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 200);
    ctx.fillStyle = `rgba(20,40,28,${0.7 * a})`;
    ctx.fillRect(W / 2 - 110, 30, 220, 22);
    ctx.strokeStyle = `rgba(94,243,140,${pulse * a})`; ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 110, 30, 220, 22);
    ctx.fillStyle = `rgba(94,243,140,${pulse * a})`;
    ctx.font = "bold 9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('· STEALTH ESTABLISHED ·', W / 2, 45);
  }
  // SAFE CRACK meter — large bar at the bottom of the screen when active.
  if (activeSafe) {
    const mx = W / 2 - 130, my = H - 80, mw = 260, mh = 22;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(mx - 4, my - 22, mw + 8, mh + 32);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.strokeRect(mx - 4, my - 22, mw + 8, mh + 32);
    // Track
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(mx, my, mw, mh);
    // Sweet spot — center 22%
    ctx.fillStyle = safeFailT > 0 ? '#ff5a82' : '#1a8a40';
    ctx.fillRect(mx + mw * 0.39, my, mw * 0.22, mh);
    // Needle
    const nx = mx + safeMeter * mw;
    ctx.fillStyle = '#fff';
    ctx.fillRect(nx - 2, my - 2, 4, mh + 4);
    // Title
    ctx.fillStyle = '#ffd23f'; ctx.font = "bold 9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('SAFE CRACK · F TO TAP · ' + safeStreak + '/' + safeTotal, mx + mw / 2, my - 6);
  }
}
// MINI-MAP — radar w/ pug+guards+cameras+vents+exit.
function drawMiniMap() {
  const mw = 130, mh = 90;
  const mx = W - mw - 14, my = 46;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
  ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 1; ctx.strokeRect(mx, my, mw, mh);
  // walls
  ctx.fillStyle = 'rgba(120,80,40,0.5)';
  for (const w of walls) {
    ctx.fillRect(mx + (w.x / W) * mw, my + (w.y / H) * mh,
                 Math.max(1, (w.w / W) * mw), Math.max(1, (w.h / H) * mh));
  }
  // exit
  if (exitZ) {
    ctx.fillStyle = '#5ef38c';
    ctx.fillRect(mx + (exitZ.x / W) * mw - 1, my + (exitZ.y / H) * mh - 1, 3, 3);
  }
  // guards
  for (const h of humans || []) {
    ctx.fillStyle = h.alertT > 0 ? '#ff3a3a' : '#ffd23f';
    ctx.fillRect(mx + (h.x / W) * mw - 1, my + (h.y / H) * mh - 1, 3, 3);
  }
  // cameras
  for (const cam of secCams) {
    ctx.fillStyle = 'rgba(255,80,80,0.6)';
    ctx.fillRect(mx + (cam.x / W) * mw - 1, my + (cam.y / H) * mh - 1, 2, 2);
  }
  // vents
  for (const v of vents) {
    ctx.fillStyle = '#b0e8ff';
    ctx.fillRect(mx + ((v.x + v.w / 2) / W) * mw - 1, my + ((v.y + v.h / 2) / H) * mh - 1, 2, 2);
  }
  // pug
  if (pug) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx + (pug.x / W) * mw - 2, my + (pug.y / H) * mh - 2, 4, 4);
  }
  ctx.fillStyle = '#4cc9f0'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText('MAP [M]', mx + mw, my - 4);
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
// Difficulty pick
const _diffPanel = document.getElementById('heist-diff');
const _diffHint = document.getElementById('heist-diff-hint');
function _highlightDiff() {
  if (!_diffPanel) return;
  _diffPanel.querySelectorAll('button').forEach((b) => {
    const sel = b.dataset.d === difficulty;
    b.style.borderColor = sel ? 'var(--neon-yellow)' : 'var(--border)';
    b.style.color = sel ? 'var(--neon-yellow)' : 'var(--text-soft)';
  });
  if (_diffHint) _diffHint.textContent = (DIFFICULTY[difficulty] || {}).hint || '';
}
if (_diffPanel) {
  _diffPanel.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    difficulty = b.dataset.d; _highlightDiff();
  });
  _highlightDiff();
}
function _renderDiary() {
  const el = document.getElementById('heist-diary');
  if (!el) return;
  let h = '';
  for (const t of BUILDING_THEMES) {
    const d = heistDiary[t] || { cleared: 0, master: false };
    const c = d.master ? 'var(--neon-yellow)' : 'var(--text-soft)';
    h += `<span style="padding:3px 5px;border:1px solid ${c};border-radius:3px;color:${c};">${t.toUpperCase()} ${d.cleared}${d.master ? ' ★' : ''}</span>`;
  }
  el.innerHTML = h;
}
_renderDiary();
function start() {
  floor = 1; running = true;
  lootStolen = 0; totalLootValue = 0; achievementsSeen = new Set();
  runUpgrades = {}; shopPending = false; pendingFloor = 0;
  ghostReplay = null; _ghostT = 0;
  closeHeistShop();
  renderHeistShopChips();
  // Dismiss any lingering grade card from the previous run.
  try { _activeGradeCard?.close?.(); } catch (e) { /* */ }
  _activeGradeCard = null;
  _renderDiary();
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
  try { music.setIntensity(0.3); music.play(); } catch {}
  // Floor 1 briefing — sets up the run with theme context.
  showFloorBriefing(floor);
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
    showFloorBriefing(floor);
  }
}
// PRE-FLOOR BRIEFING — calls genFloor when player hits INFILTRATE.
const _briefingOv = document.createElement('div');
_briefingOv.id = 'heist-briefing';
_briefingOv.style.cssText = 'position:fixed;inset:0;z-index:280;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.78);padding:16px;font-family:var(--font-display);';
_briefingOv.innerHTML = `<div style="background:#1a0f2e;border:3px solid var(--neon-cyan);border-radius:10px;padding:18px 22px;max-width:440px;text-align:center;">
<h2 style="color:var(--neon-cyan);font-size:0.8rem;margin:0 0 6px;">FLOOR <span id="brief-floor">1</span> · <span id="brief-theme">MUSEUM</span></h2>
<p id="brief-flavor" style="font-size:0.45rem;color:var(--text-soft);margin:4px 0 10px;"></p>
<canvas id="brief-map" width="220" height="140" style="background:#0a0716;border:1px solid var(--border);border-radius:4px;"></canvas>
<p style="font-size:0.5rem;color:var(--neon-yellow);margin:8px 0 12px;">EST HAUL: $<span id="brief-haul">0</span></p>
<button id="brief-go" class="overlay__btn">INFILTRATE</button></div>`;
document.body.appendChild(_briefingOv);
function showFloorBriefing(level) {
  if (!_briefingOv || !document.getElementById('brief-floor')) { genFloor(level); return; }
  const theme = BUILDING_THEMES[(level - 1) % BUILDING_THEMES.length];
  const flavor = { museum: 'Gems + artifacts. Fragile haul.', bank: 'Heavy gold bars slow you.',
    mansion: 'Paintings block vision while held.', office: 'Plentiful laptops, low value.',
    airport: 'Luggage + passports. WATCH the X-RAY scanners.' }[theme] || '';
  document.getElementById('brief-floor').textContent = level;
  document.getElementById('brief-theme').textContent = theme.toUpperCase();
  document.getElementById('brief-flavor').textContent = flavor;
  const lootCount = 4 + level;
  const pool = THEME_LOOT[theme] || [];
  const avg = pool.length ? pool.reduce((s, t) => s + t.val, 0) / pool.length : 80;
  document.getElementById('brief-haul').textContent = Math.round(lootCount * 0.65 * avg);
  const c2 = document.getElementById('brief-map').getContext('2d');
  c2.fillStyle = '#0a0716'; c2.fillRect(0, 0, 220, 140);
  c2.fillStyle = { museum: '#3a2a5a', bank: '#5a3a1c', mansion: '#5a1e2a',
    office: '#1e3a4a', airport: '#1a2a3a' }[theme] || '#3a3a3a';
  for (let r = 0; r < 3; r++) for (let cc = 0; cc < 4; cc++) c2.fillRect(cc * 55 + 1, r * 47 + 1, 53, 45);
  // RECOMMENDED PATH hint — faint dashed line from spawn (bottom-left) → exit
  // (top-right), curving along the perimeter (the safest known route).
  c2.strokeStyle = 'rgba(94,243,140,0.55)';
  c2.lineWidth = 1.5;
  c2.setLineDash([3, 3]);
  c2.beginPath();
  c2.moveTo(17, 125);
  c2.quadraticCurveTo(60, 60, 110, 50);
  c2.quadraticCurveTo(170, 40, 203, 10);
  c2.stroke();
  c2.setLineDash([]);
  // Arrow head at the exit
  c2.fillStyle = 'rgba(94,243,140,0.85)';
  c2.beginPath();
  c2.moveTo(203, 10); c2.lineTo(196, 14); c2.lineTo(199, 16); c2.closePath(); c2.fill();
  // Hint label
  c2.fillStyle = 'rgba(176,232,255,0.7)';
  c2.font = "7px 'Press Start 2P', monospace"; c2.textAlign = 'center';
  c2.fillText('· suggested route ·', 110, 70);
  // Endpoints
  c2.fillStyle = '#5ef38c'; c2.fillRect(200, 6, 6, 6);
  c2.fillStyle = '#fff'; c2.fillRect(14, 122, 6, 6);
  _briefingOv.style.display = 'flex';
}
document.getElementById('brief-go').addEventListener('click', () => {
  _briefingOv.style.display = 'none';
  genFloor(floor);
});

// Tutorial tip — shows briefly when the game starts (every match).
// Touch + desktop get distinct wording so mobile users see button hints.
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      const msg = _isTouch
        ? 'JOYSTICK sneak · BARK/SMOKE/TONGUE/DECOY/VASE buttons · 🛒 SHOP between floors'
        : 'WASD sneak · Q smoke · G tongue · T decoy · X vase · F crack safe · R restart floor';
      showTip(msg, 6500);
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
