// THE BACKROOMS OF PUG — top-down stealth horror.
// Procedurally-generated noclip-out-of-reality levels. Three archetypes:
//   - Level 0 "Lobby" (yellow wallpaper, fluorescent buzz)
//   - Level 1 "Habitable Zone" (concrete warehouse + Hounds)
//   - Level 2 "Pipe Dreams" (steam corridors + Smilers)
// Mechanics: sanity meter, flashlight battery cone, multiple entity types,
// hum-buzz ambience, distance fog, big rooms + closets, varied stains.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug, drawMonsterPug } from '../../src/shared/pugSprite.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'backrooms:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

let W = 0, H = 0, DPR = 1;
const TILE = 64;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ============================================================================
// LEVEL ARCHETYPES — palette + entity rules per "real" backrooms level.
// ============================================================================
const LEVELS = {
  lobby: {
    name: 'LEVEL 0 · THE LOBBY',
    sub: 'Endless yellow hallways. Damp tan carpet. The hum never stops.',
    floor: '#b8a44a',
    floorAlt: '#a8964a',
    floorGrout: '#5a4a14',
    wall: '#7a6a20',
    wallLight: '#9a8a40',
    wallDark: '#4a3a10',
    fog: '#3a2f10',
    hum: 120,                // fluorescent buzz hz
    lightTint: '#fff0b4',
    stainTint: 'rgba(48,28,8,$A)',
    wallPattern: 'wallpaper',
    spawnHounds: 0,
    spawnSmilers: 0,
    monsterSpeed: 1.0,
  },
  warehouse: {
    name: 'LEVEL 1 · HABITABLE ZONE',
    sub: 'Concrete warehouse. Exposed beams. Something growls in the dark.',
    floor: '#5a534a',
    floorAlt: '#4a4338',
    floorGrout: '#1a1612',
    wall: '#3a342a',
    wallLight: '#5a5040',
    wallDark: '#1a1610',
    fog: '#1a1612',
    hum: 70,                 // deeper warehouse hum
    lightTint: '#ffb060',
    stainTint: 'rgba(20,10,4,$A)',
    wallPattern: 'concrete',
    spawnHounds: 2,
    spawnSmilers: 0,
    monsterSpeed: 1.15,
  },
  pipes: {
    name: 'LEVEL 2 · PIPE DREAMS',
    sub: 'Hissing pipes everywhere. Steam blocks vision. Watch the dark.',
    floor: '#3a4048',
    floorAlt: '#2c323a',
    floorGrout: '#0a0c10',
    wall: '#2a3038',
    wallLight: '#445060',
    wallDark: '#0a0e14',
    fog: '#0a0c12',
    hum: 90,
    lightTint: '#a8c0d0',
    stainTint: 'rgba(4,8,12,$A)',
    wallPattern: 'pipes',
    spawnHounds: 1,
    spawnSmilers: 2,
    monsterSpeed: 1.25,
  },
};
function levelArchetypeFor(lvl) {
  if (lvl >= 6) return 'pipes';
  if (lvl >= 4) return 'warehouse';
  return 'lobby';
}

// ============================================================================
// State
// ============================================================================
let cols = 0, rows = 0;
let grid = [];
let pug, monster, cans, exitTile, level, soundLevel, running, cam, monsterChaseT;
let archetype = 'lobby';      // current LEVELS key
let LV = LEVELS.lobby;        // current LEVELS entry shortcut
let entities = [];            // {kind:'hound'|'smiler', x,y, vx,vy, state, t, ...}
let steamVents = [];          // {x,y,t,phase}  for "pipes" archetype
let pillars = [];             // {x,y} center pillar in big rooms
let items = [];               // {x,y,type:'flashlight'|'smoke'|'battery'}
let hideSpots = [];           // {x,y,r,kind}
let flashlightOn = false;     // toggle (B key / button)
let battery = 0;              // 0..100
let sanity = 100;             // 0..100
let lastSanityTick = 0;       // for tick rate-limit on sounds
let smokeBombs = [];          // {x,y,t,life}
let monsterDazedT = 0;
let pugFaceX = 1, pugFaceY = 0;  // unit vec for flashlight cone direction
const keys = new Set();
let smokeCount = 0;
// Juice + visuals
let popups = [];
let shakeT = 0, shakeMag = 0;
let hitFlashT = 0;
let chaseVignetteT = 0;
let lightFlicker = 0;
let wallStains = [];
let monsterWiggle = 0;
let firstSeenScreamed = false;
let heartBeatT = 0;           // accumulator for heart-beat sfx
let humOsc = null;            // persistent fluorescent buzz (web audio)
let humGain = null;
let humSilenceUntil = 0;      // time (performance.now/1000) until which hum is muted

function shake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function pop(x, y, text, color) {
  if (popups.length > 60) popups.shift();
  popups.push({ x, y, vy: -28, life: 0, max: 0.9, text, color: color || '#5ef38c' });
}
function nowSec() { return performance.now() / 1000; }
function silenceHum(durSec) { humSilenceUntil = Math.max(humSilenceUntil, nowSec() + durSec); }

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'f' && smokeCount > 0 && running) {
    smokeCount--;
    smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 4 });
    monsterDazedT = 4;
    sfx.tone(330, 'sawtooth', 0.3, 0.22);
  }
  if (k === 'b' && running) toggleFlashlight();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function toggleFlashlight() {
  if (battery <= 0) {
    flashlightOn = false;
    pop(pug.x, pug.y - 18, 'DEAD BATTERY', '#ff3a3a');
    sfx.tone(120, 'square', 0.06, 0.12);
    return;
  }
  flashlightOn = !flashlightOn;
  sfx.tone(flashlightOn ? 880 : 440, 'square', 0.04, 0.14);
  pop(pug.x, pug.y - 18, flashlightOn ? 'LIGHT ON' : 'LIGHT OFF', '#ffd23f');
}

// ----- Touch controls (mobile only) ---------------------------------------- (preserved from prior build)
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
let touchMove = { x: 0, y: 0 };
let touchSneak = false;
if (isTouch) {
  const stick = document.createElement('div');
  stick.className = 'touch-stick touch-stick--left';
  stick.innerHTML = '<div class="touch-stick__base"></div><div class="touch-stick__thumb"></div>';
  document.body.appendChild(stick);
  const base = stick.querySelector('.touch-stick__base');
  const thumb = stick.querySelector('.touch-stick__thumb');
  let id = null, cx = 0, cy = 0;
  const R = 60, DEAD = 0.18;
  stick.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    id = t.identifier;
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    handle(t.clientX, t.clientY); e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) {
      handle(t.clientX, t.clientY); e.preventDefault();
    }
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) if (t.identifier === id) {
      id = null; touchMove = { x: 0, y: 0 };
      thumb.style.transform = 'translate(0,0)'; stick.classList.remove('is-active');
    }
  };
  document.addEventListener('touchend', endTouch);
  document.addEventListener('touchcancel', endTouch);
  function handle(x, y) {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    thumb.style.transform = `translate(${dx}px,${dy}px)`;
    const nx = dx / R, ny = dy / R;
    const mag = Math.hypot(nx, ny);
    if (mag < DEAD) touchMove = { x: 0, y: 0 };
    else { const s = (mag - DEAD) / (1 - DEAD); touchMove = { x: (nx / mag) * s, y: (ny / mag) * s }; }
    stick.classList.add('is-active');
  }
  const sneakBtn = document.createElement('button');
  sneakBtn.type = 'button';
  sneakBtn.className = 'touch-ability';
  sneakBtn.style.cssText = 'right:24px;bottom:300px;background:linear-gradient(180deg,#4cc9f0,#1e7aa8);border-color:#b0e8ff;font-size:0.55rem';
  sneakBtn.textContent = 'SNEAK';
  document.body.appendChild(sneakBtn);
  const setSneak = (v) => { touchSneak = v; sneakBtn.classList.toggle('is-active', v); };
  sneakBtn.addEventListener('touchstart', (e) => { setSneak(true); e.preventDefault(); }, { passive: false });
  sneakBtn.addEventListener('touchend', (e) => { setSneak(false); e.preventDefault(); }, { passive: false });
  sneakBtn.addEventListener('touchcancel', (e) => { setSneak(false); });
  const smokeBtn = document.createElement('button');
  smokeBtn.type = 'button';
  smokeBtn.className = 'touch-ability';
  smokeBtn.textContent = 'SMOKE';
  document.body.appendChild(smokeBtn);
  smokeBtn.addEventListener('touchstart', (e) => {
    if (smokeCount > 0 && running) {
      smokeCount--;
      smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 4 });
      monsterDazedT = 4;
      sfx.tone(330, 'sawtooth', 0.3, 0.22);
    }
    e.preventDefault();
  }, { passive: false });
  // Flashlight toggle button
  const flashBtn = document.createElement('button');
  flashBtn.type = 'button';
  flashBtn.className = 'touch-ability';
  flashBtn.style.cssText = 'right:24px;bottom:220px;background:linear-gradient(180deg,#ffd23f,#a87a14);border-color:#ffe98a;font-size:0.55rem';
  flashBtn.textContent = 'LIGHT';
  document.body.appendChild(flashBtn);
  flashBtn.addEventListener('touchstart', (e) => {
    if (running) toggleFlashlight();
    e.preventDefault();
  }, { passive: false });
  // Stylesheet for touch controls (one-time inject)
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '../../src/touch/touchControls.css';
  document.head.appendChild(link);
  function syncVis() {
    const anyOv = !!document.querySelector('.overlay:not([hidden]):not(.is-hidden)');
    [stick, sneakBtn, smokeBtn, flashBtn].forEach(el => {
      el.style.opacity = anyOv ? '0' : '1';
      el.style.pointerEvents = anyOv ? 'none' : 'auto';
    });
  }
  syncVis();
  const mo = new MutationObserver(syncVis);
  document.querySelectorAll('.overlay').forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] }));
}

// ============================================================================
// Maze generation (recursive backtracker + big rooms + closets + extras)
// ============================================================================
function carveRoom(cx, cy, w, h) {
  for (let y = cy; y < cy + h; y++)
    for (let x = cx; x < cx + w; x++)
      if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) grid[y][x] = 0;
}
function genLevel(lvl) {
  archetype = levelArchetypeFor(lvl);
  LV = LEVELS[archetype];
  cols = 28 + Math.min(lvl, 8) * 2;
  rows = 18 + Math.min(lvl, 8);
  grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  // 1) Recursive backtracker on odd cells
  const stack = [];
  grid[1][1] = 0; stack.push([1, 1]);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]].sort(() => Math.random() - 0.5);
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
        grid[ny][nx] = 0;
        grid[y + dy / 2][x + dx / 2] = 0;
        stack.push([nx, ny]); moved = true; break;
      }
    }
    if (!moved) stack.pop();
  }
  // 2) Knock out random extra walls for openness
  for (let i = 0; i < cols * rows / 8; i++) {
    const x = 1 + Math.floor(Math.random() * (cols - 2));
    const y = 1 + Math.floor(Math.random() * (rows - 2));
    grid[y][x] = 0;
  }
  // 3) Big rooms (2..3 per level) — 3x3 / 4x3 with a center pillar
  pillars = [];
  const nRooms = 2 + Math.floor(Math.random() * 2);
  for (let r = 0; r < nRooms; r++) {
    const rw = 3 + Math.floor(Math.random() * 2);
    const rh = 3;
    const rx = 2 + Math.floor(Math.random() * (cols - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (rows - rh - 4));
    carveRoom(rx, ry, rw, rh);
    // central pillar (turn one inner tile into wall)
    const px = rx + Math.floor(rw / 2);
    const py = ry + Math.floor(rh / 2);
    grid[py][px] = 1;
    pillars.push({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 });
  }
  // 4) Closets — 1x1 pockets containing a guaranteed item
  const closetSlots = [];
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    for (let tries = 0; tries < 40; tries++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 4));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
      if (grid[ty][tx] === 1) {
        // it must be adjacent to exactly one open tile (a true pocket-like spot)
        const nbrs = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) =>
          grid[ty+dy] && grid[ty+dy][tx+dx] === 0);
        if (nbrs.length >= 1) {
          grid[ty][tx] = 0;
          closetSlots.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
          break;
        }
      }
    }
  }
  // Place pug at (1,1)
  pug = { x: 1.5 * TILE, y: 1.5 * TILE };
  pugFaceX = 1; pugFaceY = 0;
  // Place monster far away
  monster = { x: (cols - 2.5) * TILE, y: (rows - 2.5) * TILE, vx: 0, vy: 0, sees: false, chase: false, lastSeenX: 0, lastSeenY: 0 };
  // Cans (5)
  cans = [];
  for (let i = 0; i < 5; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 6) {
        cans.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
        break;
      }
    }
  }
  exitTile = { x: (cols - 2) * TILE + TILE / 2, y: (rows - 2) * TILE + TILE / 2 };
  soundLevel = 0; monsterChaseT = 0;
  // Items: 1 flashlight + 2 smoke + 1 battery + closet items
  items = []; smokeBombs = []; monsterDazedT = 0;
  // Closet contents (guaranteed)
  closetSlots.forEach((c, i) => {
    const types = ['battery', 'smoke', 'flashlight', 'battery'];
    items.push({ x: c.x, y: c.y, type: types[i % types.length] });
  });
  for (const t of ['flashlight', 'smoke', 'smoke', 'battery']) {
    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 5) {
        items.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, type: t });
        break;
      }
    }
  }
  // Hide spots: 3 per level (furniture)
  hideSpots = [];
  const furnitureKinds = archetype === 'pipes' ? ['vending', 'vending', 'chair'] :
    archetype === 'warehouse' ? ['vending', 'chair', 'chair'] :
    ['chair', 'sofa', 'vending'];
  for (let i = 0; i < 3; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0) {
        hideSpots.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, r: 22, kind: furnitureKinds[i % furnitureKinds.length] });
        break;
      }
    }
  }
  // Wall stains (decorative)
  wallStains = [];
  for (let i = 0; i < 18 + lvl * 2; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 1) {
        wallStains.push({
          x: tx * TILE + Math.random() * TILE,
          y: ty * TILE + Math.random() * TILE,
          r: 4 + Math.random() * 8,
          a: 0.15 + Math.random() * 0.25,
        });
        break;
      }
    }
  }
  // Steam vents (only pipes archetype) — periodic blocking puffs
  steamVents = [];
  if (archetype === 'pipes') {
    for (let i = 0; i < 6; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const tx = 1 + Math.floor(Math.random() * (cols - 2));
        const ty = 1 + Math.floor(Math.random() * (rows - 2));
        if (grid[ty][tx] === 1) {
          steamVents.push({
            x: tx * TILE + TILE / 2,
            y: ty * TILE + TILE / 2,
            t: Math.random() * 5,
            phase: 2 + Math.random() * 3, // seconds between bursts
          });
          break;
        }
      }
    }
  }
  // Entities per archetype
  entities = [];
  for (let i = 0; i < LV.spawnHounds; i++) spawnEntity('hound');
  for (let i = 0; i < LV.spawnSmilers; i++) spawnEntity('smiler');
  popups = []; shakeT = 0; shakeMag = 0; hitFlashT = 0; chaseVignetteT = 0;
  firstSeenScreamed = false;
  cam = { x: pug.x, y: pug.y };
  // Sanity restored on entering a new level (gentle)
  sanity = Math.min(100, sanity + 15);
  // Battery preserved across levels but topped up slightly each level
  if (battery < 30) battery = Math.min(100, battery + 25);
  // Update HUD/level banner
  document.getElementById('hud-arch').textContent = LV.name.replace(/^LEVEL\s*\d+\s*·\s*/, '');
  updateHud();
  // Brief level intro popup
  pop(pug.x, pug.y - 28, LV.name, '#ffd23f');
  setTimeout(() => running && pop(pug.x, pug.y - 16, LV.sub, '#5ef38c'), 600);
}

function spawnEntity(kind) {
  for (let tries = 0; tries < 80; tries++) {
    const tx = 2 + Math.floor(Math.random() * (cols - 4));
    const ty = 2 + Math.floor(Math.random() * (rows - 4));
    if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 8) {
      const e = {
        kind, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        vx: 0, vy: 0, state: 'idle', t: 0, hp: 1,
      };
      if (kind === 'hound') { e.speed = 200; e.aggroT = 0; e.wanderT = 0; }
      if (kind === 'smiler') { e.speed = 50; e.recoilT = 0; e.opacity = 0.0; }
      entities.push(e); return;
    }
  }
}

// ============================================================================
// Collision
// ============================================================================
function isWallAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
  return grid[ty][tx] === 1;
}
function move(e, dx, dy, r = 12) {
  const nx = e.x + dx;
  if (!isWallAt(nx - r, e.y - r) && !isWallAt(nx + r, e.y - r) &&
      !isWallAt(nx - r, e.y + r) && !isWallAt(nx + r, e.y + r)) e.x = nx;
  const ny = e.y + dy;
  if (!isWallAt(e.x - r, ny - r) && !isWallAt(e.x + r, ny - r) &&
      !isWallAt(e.x - r, ny + r) && !isWallAt(e.x + r, ny + r)) e.y = ny;
}
function lineClear(ax, ay, bx, by, ignoreSmoke = false) {
  const steps = 22;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = ax + (bx - ax) * t;
    const sy = ay + (by - ay) * t;
    if (isWallAt(sx, sy)) return false;
    if (!ignoreSmoke) {
      for (const sb of smokeBombs) if (Math.hypot(sx - sb.x, sy - sb.y) < 70) return false;
      // steam vents block sight during a burst
      for (const v of steamVents) {
        const phase = v.t % v.phase;
        if (phase < 1.2 && Math.hypot(sx - v.x, sy - v.y) < 80) return false;
      }
    }
  }
  return true;
}
function inLitCell(x, y) {
  // a cell is "lit" if it's one of the ceiling-light tiles (every 4th row+col)
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
  // ceiling lights placed at (1+4k, 1+4j); call a 3x3 around each "lit"
  const ox = ((tx - 1) % 4 + 4) % 4;
  const oy = ((ty - 1) % 4 + 4) % 4;
  return grid[ty][tx] === 0 && ox <= 1 && oy <= 1;
}

// ============================================================================
// Audio — persistent fluorescent hum + heartbeat ramp
// ============================================================================
function ensureHum() {
  if (sfx.isMuted()) return;
  // Try to construct an oscillator via the same trick miniSfx uses internally
  try {
    if (humOsc) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Use a fresh shared context — miniSfx creates its own; we can create ours too
    if (!window.__bkAC) window.__bkAC = new AC();
    const actx = window.__bkAC;
    humOsc = actx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = LV.hum;
    humGain = actx.createGain();
    humGain.gain.value = 0.0;
    // Highpass to make it whisper-quiet and texture-y
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    humOsc.connect(lp).connect(humGain).connect(actx.destination);
    humOsc.start();
  } catch {}
}
function setHumTargetFor(archKey) {
  if (humOsc) humOsc.frequency.value = LEVELS[archKey].hum;
}
function updateHum(dt) {
  if (!humGain) return;
  const target = sfx.isMuted() || nowSec() < humSilenceUntil || !running ? 0.0 : 0.04;
  const g = humGain.gain.value;
  humGain.gain.value = g + (target - g) * Math.min(1, dt * 8);
}

// ============================================================================
// Tick
// ============================================================================
function tick(dt) {
  if (!running) { updateHum(dt); return; }
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchMove.x || touchMove.y) { mx = touchMove.x; my = touchMove.y; }
  const sneaking = keys.has('shift') || touchSneak;
  // Partygoer-style slow not implemented; sanity-low slows you slightly though
  const sanitySlow = sanity < 25 ? 0.7 : 1.0;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const speed = (sneaking ? 70 : 140) * sanitySlow;
    move(pug, (mx / l) * speed * dt, (my / l) * speed * dt);
    soundLevel = Math.min(1, soundLevel + (sneaking ? 0.05 : 1.2) * dt);
    // Update facing for flashlight cone
    pugFaceX = mx / l; pugFaceY = my / l;
    // Footstep tick
    if ((performance.now() | 0) % (sneaking ? 360 : 230) < 18) {
      sfx.tone(sneaking ? 180 : 260, 'sine', 0.04, sneaking ? 0.05 : 0.09);
    }
  } else {
    soundLevel = Math.max(0, soundLevel - dt);
  }

  cam.x += (pug.x - cam.x) * 6 * dt;
  cam.y += (pug.y - cam.y) * 6 * dt;

  // Cans pickup
  for (let i = cans.length - 1; i >= 0; i--) {
    if (Math.hypot(cans[i].x - pug.x, cans[i].y - pug.y) < 22) {
      const c = cans[i]; cans.splice(i, 1);
      sfx.tone(880, 'triangle', 0.1, 0.18);
      pop(c.x, c.y - 14, '+CAN', '#ffd23f');
    }
  }
  // Item pickup (flashlight battery / smoke / extra battery)
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (Math.hypot(it.x - pug.x, it.y - pug.y) < 22) {
      items.splice(i, 1);
      if (it.type === 'flashlight') {
        battery = Math.min(100, battery + 60);
        sfx.tone(660, 'triangle', 0.15, 0.22);
        pop(it.x, it.y - 14, '+FLASHLIGHT', '#ffd23f');
      } else if (it.type === 'battery') {
        battery = Math.min(100, battery + 40);
        sfx.tone(540, 'triangle', 0.12, 0.18);
        pop(it.x, it.y - 14, '+BATTERY', '#ffd23f');
      } else if (it.type === 'smoke') {
        smokeCount++;
        sfx.tone(440, 'triangle', 0.12, 0.18);
        pop(it.x, it.y - 14, '+SMOKE', '#4cc9f0');
      }
    }
  }
  // Battery drain
  if (flashlightOn) {
    battery = Math.max(0, battery - 4 * dt);
    if (battery <= 0) { flashlightOn = false; pop(pug.x, pug.y - 18, 'BATTERY DEAD', '#ff3a3a'); }
  }
  monsterDazedT = Math.max(0, monsterDazedT - dt);
  // Smoke decay
  for (let i = smokeBombs.length - 1; i >= 0; i--) {
    smokeBombs[i].t += dt;
    if (smokeBombs[i].t >= smokeBombs[i].life) smokeBombs.splice(i, 1);
  }
  // Steam vents tick
  for (const v of steamVents) v.t += dt;

  // Hiding
  let hidden = false;
  for (const h of hideSpots) if (Math.hypot(h.x - pug.x, h.y - pug.y) < h.r) { hidden = true; break; }

  // Exit check
  if (cans.length === 0 && Math.hypot(exitTile.x - pug.x, exitTile.y - pug.y) < 26) {
    level++;
    sfx.arp([523, 659, 784, 1047], 'triangle', 0.1, 0.22, 0.3);
    const oldArch = archetype;
    genLevel(level);
    if (oldArch !== archetype) setHumTargetFor(archetype);
    return;
  }

  // Main monster AI
  const distToPug = Math.hypot(monster.x - pug.x, monster.y - pug.y);
  const detectable = !hidden && monsterDazedT <= 0;
  const hears = detectable && soundLevel > 0.5 && distToPug < 420;
  let sees = false;
  if (detectable && distToPug < 320) sees = lineClear(monster.x, monster.y, pug.x, pug.y);
  const prevSees = monster.sees;
  monster.sees = sees;
  if (sees && !prevSees) {
    shake(4, 0.25);
    sfx.tone(220, 'sawtooth', 0.18, 0.18);
    if (!firstSeenScreamed) {
      firstSeenScreamed = true;
      // Sudden scream — a sweep + brief silence
      sfx.sweep(900, 180, 'sawtooth', 0.6, 0.32);
      silenceHum(0.45);
    }
  }
  if (sees || hears) {
    monster.lastSeenX = pug.x; monster.lastSeenY = pug.y;
    monsterChaseT = sees ? 5 : 2.5;
  }
  monster.chase = monsterChaseT > 0;
  if (monsterChaseT > 0) monsterChaseT -= dt;

  // Move main monster (speed scaled by archetype)
  const target = monster.chase ? { x: monster.lastSeenX, y: monster.lastSeenY } : null;
  if (target) {
    const dx = target.x - monster.x, dy = target.y - monster.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = (sees ? 165 : 110) * LV.monsterSpeed;
      move(monster, (dx / d) * sp * dt, (dy / d) * sp * dt, 14);
    } else { monsterChaseT = 0; }
  } else {
    if (Math.random() < dt * 0.6) {
      const a = Math.random() * Math.PI * 2;
      monster.vx = Math.cos(a) * 40; monster.vy = Math.sin(a) * 40;
    }
    move(monster, monster.vx * dt, monster.vy * dt, 14);
  }

  // Entities AI (Hounds + Smilers)
  for (const e of entities) {
    e.t += dt;
    if (e.kind === 'hound') tickHound(e, dt, hidden);
    if (e.kind === 'smiler') tickSmiler(e, dt, hidden);
    // Damage on contact
    if (Math.hypot(e.x - pug.x, e.y - pug.y) < 20) {
      if (e.kind === 'smiler' && (flashlightOn && smilerInBeam(e))) {
        // Smiler being repelled — don't damage; push it back
      } else {
        hitFlashT = 0.4; shake(7, 0.4); return die(e.kind);
      }
    }
  }

  // Sanity dynamics
  lastSanityTick += dt;
  if (lastSanityTick >= 0.5) {
    lastSanityTick = 0;
    const lit = inLitCell(pug.x, pug.y) && !hidden;
    let drain = 0;
    if (!lit) drain += 1.2;
    if (monster.chase) drain += 3.0;
    if (archetype === 'pipes') drain += 0.8;
    // Smiler proximity drains sanity even without contact
    for (const e of entities)
      if (e.kind === 'smiler' && Math.hypot(e.x - pug.x, e.y - pug.y) < 220) drain += 1.6;
    if (lit) drain -= 2.5; // lit safe cells regen
    sanity = Math.max(0, Math.min(100, sanity - drain));
    if (drain > 1.5) silenceHum(0.12); // dread tick — momentary dead silence
  }
  if (sanity <= 0) { hitFlashT = 0.5; return die('sanity'); }

  // Heartbeat when monster close & chase
  if (monster.chase && distToPug < 360) {
    heartBeatT += dt;
    const rate = Math.max(0.35, distToPug / 800); // closer = faster
    if (heartBeatT >= rate) { heartBeatT = 0; sfx.tone(60, 'sine', 0.12, 0.18); }
  } else { heartBeatT = 0; }

  // Vignette + visuals
  if (sees) chaseVignetteT = Math.min(1, chaseVignetteT + dt * 2.5);
  else chaseVignetteT = Math.max(0, chaseVignetteT - dt * 1.2);
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life += dt; p.y += p.vy * dt; p.vy += 22 * dt;
    if (p.life >= p.max) popups.splice(i, 1);
  }
  lightFlicker += dt * (4 + Math.random() * 4);
  if (shakeT > 0) shakeT -= dt;
  if (hitFlashT > 0) hitFlashT -= dt;
  monsterWiggle += dt * 4;

  // Caught by main monster?
  if (distToPug < 24) { hitFlashT = 0.4; shake(7, 0.4); return die('monster'); }

  updateHum(dt);
  updateHud();
}

// ----- HOUND ----- fast chaser, sight-only, easily lost around corners
function tickHound(e, dt, hidden) {
  const dx = pug.x - e.x, dy = pug.y - e.y;
  const dist = Math.hypot(dx, dy);
  const detectable = !hidden && monsterDazedT <= 0;
  const sees = detectable && dist < 360 && lineClear(e.x, e.y, pug.x, pug.y);
  if (sees) {
    e.aggroT = 3.0;
    e.state = 'chase';
    if (e.t > 1.2) { e.t = 0; sfx.tone(380, 'sawtooth', 0.08, 0.12); }
  } else if (e.aggroT > 0) {
    e.aggroT -= dt;
    if (e.aggroT <= 0) e.state = 'idle';
  }
  if (e.state === 'chase' && dist > 4) {
    move(e, (dx / dist) * e.speed * dt, (dy / dist) * e.speed * dt, 12);
  } else {
    // wander
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 1.2 + Math.random() * 1.8;
      const a = Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * 50; e.vy = Math.sin(a) * 50;
    }
    move(e, e.vx * dt, e.vy * dt, 12);
  }
}

// ----- SMILER ----- only in dark, repelled by flashlight beam pointed at it
function smilerInBeam(e) {
  if (!flashlightOn) return false;
  const dx = e.x - pug.x, dy = e.y - pug.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 360) return false;
  // angle vs facing
  const fl = Math.hypot(pugFaceX, pugFaceY) || 1;
  const dot = (dx / dist) * (pugFaceX / fl) + (dy / dist) * (pugFaceY / fl);
  return dot > 0.86; // ~30deg cone
}
function tickSmiler(e, dt, hidden) {
  const lit = inLitCell(e.x, e.y);
  // Visibility: only in dark areas
  const targetOp = lit ? 0.05 : 0.9;
  e.opacity += (targetOp - e.opacity) * Math.min(1, dt * 3);
  // If in flashlight beam, get pushed back & damaged-mood
  if (smilerInBeam(e)) {
    e.recoilT = 0.6;
    const dx = e.x - pug.x, dy = e.y - pug.y;
    const d = Math.hypot(dx, dy) || 1;
    move(e, (dx / d) * 110 * dt, (dy / d) * 110 * dt, 12);
    if (e.t > 0.4) { e.t = 0; sfx.tone(1100, 'square', 0.05, 0.08); }
    return;
  }
  e.recoilT = Math.max(0, e.recoilT - dt);
  if (hidden || monsterDazedT > 0) return; // hidden = smiler stops
  // Slow creep toward pug if pug not lit
  const litPug = inLitCell(pug.x, pug.y);
  if (!litPug) {
    const dx = pug.x - e.x, dy = pug.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 10) move(e, (dx / d) * e.speed * dt, (dy / d) * e.speed * dt, 12);
  } else {
    // wander while pug is safe
    if (Math.random() < dt * 0.4) {
      const a = Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * 30; e.vy = Math.sin(a) * 30;
    }
    move(e, (e.vx || 0) * dt, (e.vy || 0) * dt, 12);
  }
}

// ============================================================================
// Rendering
// ============================================================================
function render() {
  let sx = 0, sy = 0;
  if (shakeT > 0) {
    const k = Math.min(1, shakeT / 0.3);
    sx = (Math.random() - 0.5) * shakeMag * 2 * k;
    sy = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  // Background fog tone for archetype
  ctx.fillStyle = LV.fog; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 - cam.x + sx, H / 2 - cam.y + sy);
  // View radius — slightly larger when flashlight ON
  const viewR = flashlightOn ? 380 : 240;
  // FLOOR — archetype-specific
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) {
        ctx.fillStyle = ((x + y) & 1) ? LV.floor : LV.floorAlt;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
  // Floor grout
  ctx.strokeStyle = LV.floorGrout; ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
  // Ceiling-light shadow bands (alternating subtle stripes across floor — reflection of fluorescent strips)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) {
        const t = y * TILE;
        ctx.fillRect(x * TILE, t + 18, TILE, 6);
        ctx.fillRect(x * TILE, t + 42, TILE, 6);
      }
    }
  }
  // Wall-base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === 0 && y > 0 && grid[y - 1][x] === 1)
        ctx.fillRect(x * TILE, y * TILE, TILE, 6);
  // WALLS — archetype-specific colour + texture
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) {
        ctx.fillStyle = LV.wall;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        renderWallTexture(x, y);
      }
    }
  }
  // Wall stains
  for (const s of wallStains) {
    const a1 = s.a, a2 = s.a * 0.6;
    ctx.fillStyle = LV.stainTint.replace('$A', a1);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LV.stainTint.replace('$A', a2);
    ctx.beginPath(); ctx.arc(s.x + s.r * 0.4, s.y + s.r * 0.3, s.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // Ceiling lights flicker
  const flick = 0.7 + Math.sin(lightFlicker * 3.1) * 0.2 + (Math.random() < 0.02 ? -0.4 : 0);
  const lt = LV.lightTint;
  for (let y = 1; y < rows; y += 4) {
    for (let x = 1; x < cols; x += 4) {
      if (grid[y][x] === 0) {
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        ctx.fillStyle = hexA(lt, Math.max(0.18, flick * 0.32));
        ctx.fillRect(cx - 20, cy - 4, 40, 8);
        ctx.fillStyle = hexA(lt, Math.max(0.4, flick * 0.7));
        ctx.fillRect(cx - 18, cy - 2, 36, 4);
      }
    }
  }
  // Pillars (center columns of big rooms — rendered as decorative concrete posts)
  for (const p of pillars) {
    ctx.fillStyle = LV.wallDark;
    ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
    ctx.fillStyle = LV.wallLight;
    ctx.fillRect(p.x - 18, p.y - 18, 36, 4);
    ctx.fillRect(p.x - 18, p.y + 14, 36, 4);
  }
  // Hide spots (furniture)
  for (const h of hideSpots) drawFurniture(h);
  // Cans — use icon library
  for (const c of cans) {
    ctx.save();
    drawIcon.can(ctx, c.x, c.y, 22);
    ctx.restore();
  }
  // Items
  for (const it of items) drawItem(it);
  // Smoke bombs (active clouds)
  for (const sb of smokeBombs) {
    const a = sb.t < 0.3 ? sb.t / 0.3 : (sb.t > 3.5 ? (sb.life - sb.t) / 0.5 : 1);
    ctx.fillStyle = `rgba(140,140,160,${a * 0.6})`;
    ctx.beginPath(); ctx.arc(sb.x, sb.y, 70, 0, Math.PI * 2); ctx.fill();
  }
  // Steam vents (pipes archetype) — visible during their burst
  for (const v of steamVents) {
    const phase = v.t % v.phase;
    if (phase < 1.4) {
      const a = phase < 0.2 ? phase / 0.2 : (phase > 1.0 ? (1.4 - phase) / 0.4 : 1);
      ctx.fillStyle = `rgba(220,230,240,${a * 0.55})`;
      ctx.beginPath(); ctx.arc(v.x, v.y, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(240,250,255,${a * 0.35})`;
      ctx.beginPath(); ctx.arc(v.x - 12, v.y - 8, 40, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Exit (only if cans done)
  if (cans.length === 0) {
    const glow = 0.7 + Math.sin(performance.now() / 220) * 0.3;
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 20 * glow;
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(exitTile.x - 22, exitTile.y - 30, 44, 60);
    ctx.shadowBlur = 0;
    drawIcon.exit(ctx, exitTile.x, exitTile.y, 36);
    ctx.fillStyle = '#0a1018'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitTile.x, exitTile.y + 44);
  }
  // Entities (Hounds + Smilers)
  for (const e of entities) {
    if (e.kind === 'hound') drawHound(e);
    if (e.kind === 'smiler') drawSmiler(e);
  }
  // Monster — main pug-monster
  drawMonster();
  // Flashlight cone (player) — narrow yellow wedge
  if (flashlightOn && battery > 0) drawFlashlightCone();
  // Pug player — high-detail sprite (with hit-flash overlay)
  if (hitFlashT > 0) {
    ctx.save(); ctx.filter = 'brightness(2.5)';
    drawPug(ctx, pug.x, pug.y, { size: 28 });
    ctx.filter = 'none'; ctx.restore();
  } else {
    drawPug(ctx, pug.x, pug.y, { size: 28 });
  }
  // Sound waves
  if (soundLevel > 0.05) {
    ctx.strokeStyle = `rgba(255,210,63,${soundLevel * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 14 + soundLevel * 40, 0, Math.PI * 2); ctx.stroke();
  }
  // Popups
  ctx.textAlign = 'center';
  ctx.font = "10px 'Press Start 2P', monospace";
  for (const pp of popups) {
    const a = 1 - pp.life / pp.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillText(pp.text, pp.x + 1, pp.y + 1);
    ctx.fillStyle = pp.color; ctx.fillText(pp.text, pp.x, pp.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // SCREEN-SPACE post-fx
  // Distance fog (tight radial gradient)
  const grd = ctx.createRadialGradient(W / 2, H / 2, viewR * 0.4, W / 2, H / 2, viewR * 1.35);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  // Scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  const sLine = Math.floor(performance.now() / 100) % 3;
  for (let y = sLine; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  // Sanity blur tint — pulsing red when low
  if (sanity < 40) {
    const lo = (40 - sanity) / 40;
    const pul = 0.5 + Math.sin(performance.now() / 220) * 0.5;
    ctx.fillStyle = `rgba(80,0,0,${0.18 * lo * (0.6 + 0.4 * pul)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Red chase vignette pulse
  if (chaseVignetteT > 0.05) {
    const pulse = 0.5 + Math.sin(performance.now() / 110) * 0.5;
    const rgrd = ctx.createRadialGradient(W / 2, H / 2, viewR * 0.5, W / 2, H / 2, viewR * 1.3);
    rgrd.addColorStop(0, 'rgba(255,58,58,0)');
    rgrd.addColorStop(1, `rgba(255,58,58,${0.35 * chaseVignetteT * (0.6 + 0.4 * pulse)})`);
    ctx.fillStyle = rgrd; ctx.fillRect(0, 0, W, H);
  }
  // Film grain / static overlay when monster very close in chase
  const distToPug = Math.hypot(monster.x - pug.x, monster.y - pug.y);
  if (monster.chase && distToPug < 220) {
    const intensity = 1 - (distToPug / 220);
    ctx.globalAlpha = 0.18 * intensity;
    // sparse random pixels — tiny perf cost
    ctx.fillStyle = '#fff';
    const count = 80 * intensity;
    for (let i = 0; i < count; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    ctx.fillStyle = '#000';
    for (let i = 0; i < count; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    ctx.globalAlpha = 1;
  }
  // Hit flash overlay
  if (hitFlashT > 0) {
    ctx.fillStyle = `rgba(255,58,58,${Math.min(0.55, hitFlashT * 1.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function hexA(hex, a) {
  // Accept '#rrggbb' and produce 'rgba(r,g,b,a)'
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function renderWallTexture(x, y) {
  const px = x * TILE, py = y * TILE;
  if (LV.wallPattern === 'wallpaper') {
    // subtle floral repeat — small dots in a regular grid (Level 0)
    ctx.fillStyle = LV.wallLight;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        ctx.fillRect(px + 6 + i * 16, py + 6 + j * 16, 2, 2);
    // vertical wallpaper lines
    ctx.fillStyle = LV.wallDark;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 16, py, 1, TILE);
  } else if (LV.wallPattern === 'concrete') {
    // mottled concrete (Level 1 warehouse) — speckles + a horizontal seam
    ctx.fillStyle = LV.wallLight;
    ctx.fillRect(px, py + 28, TILE, 2);
    ctx.fillStyle = LV.wallDark;
    ctx.fillRect(px, py + 30, TILE, 1);
    // speckles (deterministic via tile coords)
    for (let i = 0; i < 8; i++) {
      const r1 = ((x * 71 + y * 17 + i * 13) % 64);
      const r2 = ((x * 31 + y * 47 + i * 23) % 64);
      ctx.fillStyle = i & 1 ? LV.wallLight : LV.wallDark;
      ctx.fillRect(px + r1, py + r2, 2, 2);
    }
  } else if (LV.wallPattern === 'pipes') {
    // pipe stripes (Level 2) — long vertical pipes + occasional red paint
    ctx.fillStyle = LV.wallLight;
    ctx.fillRect(px + 8, py, 6, TILE);
    ctx.fillRect(px + 48, py, 4, TILE);
    ctx.fillStyle = LV.wallDark;
    ctx.fillRect(px + 8, py, 1, TILE);
    ctx.fillRect(px + 13, py, 1, TILE);
    ctx.fillRect(px + 48, py, 1, TILE);
    ctx.fillRect(px + 51, py, 1, TILE);
    // valve circle on some tiles
    if (((x * 13 + y * 7) % 5) === 0) {
      ctx.fillStyle = '#a02a1a';
      ctx.fillRect(px + 22, py + 24, 16, 4);
      ctx.fillRect(px + 28, py + 18, 4, 16);
    }
  }
}

function drawFurniture(h) {
  if (h.kind === 'sofa') {
    ctx.fillStyle = '#5a2a0c'; ctx.fillRect(h.x - 22, h.y - 8, 44, 16);
    ctx.fillStyle = '#7a3a14'; ctx.fillRect(h.x - 22, h.y - 16, 44, 9);
    ctx.fillStyle = '#a05828'; ctx.fillRect(h.x - 20, h.y - 14, 18, 6);
    ctx.fillRect(h.x + 2, h.y - 14, 18, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(h.x - 22, h.y + 7, 44, 2);
  } else if (h.kind === 'vending') {
    ctx.fillStyle = '#1a3a5e'; ctx.fillRect(h.x - 16, h.y - 22, 32, 38);
    ctx.fillStyle = '#2a5a8e'; ctx.fillRect(h.x - 14, h.y - 20, 28, 4);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(h.x - 10, h.y - 14, 20, 10);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(h.x - 8, h.y - 2, 16, 2);
    ctx.fillStyle = '#0a1a2e'; ctx.fillRect(h.x - 6, h.y + 4, 12, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(h.x - 16, h.y + 15, 32, 2);
  } else {
    ctx.fillStyle = '#6b3a1c'; ctx.fillRect(h.x - 18, h.y - 12, 36, 18);
    ctx.fillStyle = '#8a5a2c'; ctx.fillRect(h.x - 18, h.y - 12, 36, 3);
    ctx.fillStyle = '#3a2a0c'; ctx.fillRect(h.x - 18, h.y + 4, 36, 2);
    ctx.fillStyle = '#5a2a0c'; ctx.fillRect(h.x - 16, h.y - 22, 4, 12); ctx.fillRect(h.x + 12, h.y - 22, 4, 12);
  }
  ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('HIDE', h.x, h.y - 24);
}

function drawItem(it) {
  if (it.type === 'flashlight') {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    drawIcon.flashlight(ctx, it.x, it.y, 22);
    ctx.shadowBlur = 0;
  } else if (it.type === 'battery') {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10;
    // simple AA-battery icon — fill a small rect
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(it.x - 7, it.y - 10, 14, 20);
    ctx.fillStyle = '#a87a14'; ctx.fillRect(it.x - 4, it.y - 12, 8, 2);
    ctx.fillStyle = '#1a1610'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('+', it.x, it.y + 3);
    ctx.shadowBlur = 0;
  } else if (it.type === 'smoke') {
    ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 12;
    drawIcon.smokeBomb(ctx, it.x, it.y, 22);
    ctx.shadowBlur = 0;
  }
}

function drawMonster() {
  const wob = Math.sin(monsterWiggle) * 1.4;
  // Aggression-tinted body palette
  const bodyCol = monster.chase ? '#5a0d0d' : '#6b3a1c';
  // Dread aura beneath
  ctx.fillStyle = monster.chase ? 'rgba(120,0,0,0.45)' : 'rgba(40,20,8,0.4)';
  ctx.beginPath(); ctx.arc(monster.x, monster.y + wob, 44, 0, Math.PI * 2); ctx.fill();
  drawMonsterPug(ctx, monster.x, monster.y + wob, { size: 70, body: bodyCol });
  if (monster.chase) {
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 16;
    drawMonsterPug(ctx, monster.x, monster.y + wob, { size: 70, body: bodyCol, alpha: 0.5 });
    ctx.shadowBlur = 0;
  }
}

function drawHound(e) {
  // a four-legged dark shape with glowing eyes
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = e.state === 'chase' ? '#3a0a0a' : '#1a0a08';
  // body
  ctx.fillRect(e.x - 14, e.y - 4, 28, 12);
  // head (front-right)
  ctx.fillRect(e.x + 10, e.y - 6, 10, 10);
  // legs
  ctx.fillRect(e.x - 12, e.y + 8, 3, 6);
  ctx.fillRect(e.x - 4, e.y + 8, 3, 6);
  ctx.fillRect(e.x + 4, e.y + 8, 3, 6);
  ctx.fillRect(e.x + 12, e.y + 8, 3, 6);
  // tail
  ctx.fillRect(e.x - 18, e.y - 2, 5, 2);
  // glowing eyes
  ctx.fillStyle = e.state === 'chase' ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowColor = e.state === 'chase' ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowBlur = e.state === 'chase' ? 10 : 4;
  ctx.fillRect(e.x + 16, e.y - 4, 2, 2);
  ctx.fillRect(e.x + 18, e.y - 2, 2, 2);
  ctx.shadowBlur = 0;
  // little label
  if (e.state === 'chase') {
    ctx.fillStyle = '#ff8080'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('HOUND', e.x, e.y - 16);
  }
}

function drawSmiler(e) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.opacity);
  // dark body smudge
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath(); ctx.arc(e.x, e.y, 22, 0, Math.PI * 2); ctx.fill();
  // glowing eyes
  ctx.fillStyle = '#ffd23f';
  ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
  ctx.fillRect(e.x - 8, e.y - 4, 4, 4);
  ctx.fillRect(e.x + 4, e.y - 4, 4, 4);
  // grin (curve of teeth)
  ctx.fillStyle = '#ffffff';
  for (let i = -6; i <= 6; i += 2) {
    const yy = e.y + 6 + Math.abs(i) * 0.4;
    ctx.fillRect(e.x + i, yy, 2, 3);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawFlashlightCone() {
  const len = 380;
  const ang = Math.atan2(pugFaceY, pugFaceX);
  const half = Math.PI / 8; // ~22.5deg
  ctx.save();
  ctx.translate(pug.x, pug.y);
  ctx.rotate(ang);
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, 'rgba(255,235,150,0.55)');
  grad.addColorStop(0.6, 'rgba(255,235,150,0.18)');
  grad.addColorStop(1, 'rgba(255,235,150,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(half) * len, Math.sin(half) * len);
  ctx.lineTo(Math.cos(-half) * len, Math.sin(-half) * len);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateHud() {
  document.getElementById('hud-cans').textContent = `${5 - cans.length}/5`;
  const state = monsterDazedT > 0 ? 'SMOKED' : (monster.chase ? 'HUNTED!' : (soundLevel > 0.5 ? 'LOUD' : 'SAFE'));
  const el = document.getElementById('hud-state');
  el.textContent = state;
  el.style.color = monster.chase ? '#ff3a3a' : (soundLevel > 0.5 ? '#ffd23f' : '#5ef38c');
  const hudCard = document.querySelector('#hud .hud-card');
  if (hudCard) {
    if (monster.chase) {
      const k = 0.5 + Math.sin(performance.now() / 120) * 0.5;
      hudCard.style.boxShadow = `0 0 ${10 + k * 20}px rgba(255,58,58,${0.4 + k * 0.4})`;
    } else if (hudCard.style.boxShadow) {
      hudCard.style.boxShadow = '';
    }
  }
  // Sanity bar
  const sanBar = document.getElementById('hud-sanity-bar');
  if (sanBar) {
    sanBar.style.width = sanity + '%';
    sanBar.style.background = sanity > 60 ? '#5ef38c' : (sanity > 25 ? '#ffd23f' : '#ff3a3a');
  }
  // Battery bar
  const batBar = document.getElementById('hud-battery-bar');
  if (batBar) {
    batBar.style.width = battery + '%';
    batBar.style.background = battery > 50 ? '#ffd23f' : (battery > 15 ? '#ffa83a' : '#ff3a3a');
    batBar.style.boxShadow = flashlightOn ? '0 0 8px #ffd23f' : 'none';
  }
  // Smoke pip
  const smk = document.getElementById('hud-smoke');
  if (smk) smk.textContent = '× ' + smokeCount;
  document.getElementById('hud-depth').textContent = `Level ${level}`;
  const best = loadBest('backrooms-pug');
  document.getElementById('hud-best').textContent = best ? best.level : 0;
}

function die(cause) {
  running = false;
  sfx.sweep(110, 40, 'sawtooth', 1.0, 0.3);
  silenceHum(0.6);
  const TITLES = {
    monster: 'SCREAMED', hound: 'TORN APART', smiler: 'GRINNED AT', sanity: 'LOST YOURSELF',
  };
  const SUBS = {
    monster: 'The giant pug found you.',
    hound: 'A hound caught your scent.',
    smiler: 'The grinning thing got you.',
    sanity: 'The hum took everything.',
  };
  document.getElementById('end-title').textContent = TITLES[cause] || 'SCREAMED';
  document.getElementById('end-sub').textContent = SUBS[cause] || 'The Backrooms claimed you.';
  document.getElementById('end-level').textContent = level;
  document.getElementById('end-cans').textContent = (level - 1) * 5 + (5 - cans.length);
  const { isNewBest, current } = submitRun('backrooms-pug', { score: level, level }, (a, b) => b.level - a.level);
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { level };
    bestEl.innerHTML = `Best: <b>level ${b.level}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  level = 1; running = true;
  sanity = 100; battery = 50; flashlightOn = false; smokeCount = 0;
  genLevel(level);
  ensureHum();
  setHumTargetFor(archetype);
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

// Tutorial tip
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD walk · SHIFT sneak · B toggle flashlight · F smoke · find 5 cans, reach the EXIT', 7000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
