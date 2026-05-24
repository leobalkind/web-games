// ROCKET PUG ARENA — 4 bot pugs in giant kitchen, absurd weapons.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showOrientationHint } from '../../src/shared/orientationHint.js';
import { showGradeCard } from '../../src/shared/gradeCard.js';
import { createKillFeed } from '../../src/shared/killFeed.js';
import { drawShadow as _depthShadow } from '../../src/shared/depth3D.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';

// --- Custom weapon icons (drawn on canvas; size ~ 18px) -----------------------
// Library doesn't have sausage / toast / bubble, so we draw them inline here in
// the same pixel-art style as the shared icons (centered at x, y).
// v1.8 sprite polish: each weapon icon now has 4-shade depth + secondary
// detail (seared cross-hatch on sausage, butter pat on toast, refracted sheen
// on bubble) so they read crisply both as held-weapon AND as world pickup.
function drawSausage(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // bun-orange body
  ctx.fillStyle = '#ff8e3c';
  ctx.fillRect(-6 * s, -2 * s, 12 * s, 4 * s);
  ctx.fillRect(-7 * s, -1 * s,  1 * s, 2 * s);
  ctx.fillRect( 6 * s, -1 * s,  1 * s, 2 * s);
  // shading underside (deeper now — adds 3D rounding)
  ctx.fillStyle = '#b35a1c';
  ctx.fillRect(-6 * s,  1 * s, 12 * s, 1 * s);
  // ends cap shadow
  ctx.fillRect(-7 * s, 0, 1 * s, 1 * s);
  ctx.fillRect( 6 * s, 0, 1 * s, 1 * s);
  // top highlight (broader band)
  ctx.fillStyle = '#ffcc88';
  ctx.fillRect(-5 * s, -2 * s, 4 * s, 1 * s);
  // top-tip glint
  ctx.fillStyle = '#fff1b0';
  ctx.fillRect(-4 * s, -2 * s, 1 * s, 1 * s);
  // grill marks — 3 sear stripes (charred)
  ctx.fillStyle = '#5a2a08';
  ctx.fillRect(-3 * s, -1 * s, 1 * s, 2 * s);
  ctx.fillRect(0,     -1 * s, 1 * s, 2 * s);
  ctx.fillRect( 3 * s, -1 * s, 1 * s, 2 * s);
  ctx.restore();
}
function drawToast(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // crust outline (darker now for contrast)
  ctx.fillStyle = '#6a3a1c';
  ctx.fillRect(-6 * s, -7 * s, 12 * s, 14 * s);
  ctx.fillRect(-7 * s, -6 * s,  1 * s, 12 * s);
  ctx.fillRect( 6 * s, -6 * s,  1 * s, 12 * s);
  // outer crust hi (top edge)
  ctx.fillStyle = '#a86a3a';
  ctx.fillRect(-6 * s, -7 * s, 12 * s, 1 * s);
  // bread interior
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-5 * s, -6 * s, 10 * s, 12 * s);
  // bread texture (small holes/pores)
  ctx.fillStyle = '#e8b820';
  ctx.fillRect(-3 * s, -5 * s, 1 * s, 1 * s);
  ctx.fillRect(2 * s, -3 * s, 1 * s, 1 * s);
  ctx.fillRect(-2 * s, 2 * s, 1 * s, 1 * s);
  ctx.fillRect(3 * s, 4 * s, 1 * s, 1 * s);
  // butter pat (golden block) + melt highlight
  ctx.fillStyle = '#fff1b0';
  ctx.fillRect(-3 * s, -4 * s, 4 * s, 2 * s);
  ctx.fillRect(-1 * s,  1 * s, 3 * s, 2 * s);
  // butter-melt shine
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-2 * s, -4 * s, 1 * s, 1 * s);
  // bottom-right shadow on bread
  ctx.fillStyle = 'rgba(180,140,40,0.5)';
  ctx.fillRect(-5 * s, 5 * s, 10 * s, 1 * s);
  ctx.fillRect(4 * s, -6 * s, 1 * s, 12 * s);
  ctx.restore();
}
function drawBubble(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // outer ring (cyan)
  ctx.strokeStyle = '#4cc9f0';
  ctx.lineWidth = Math.max(1, 1.4 * s);
  ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, Math.PI * 2); ctx.stroke();
  // inner refraction ring (lighter)
  ctx.strokeStyle = 'rgba(180,230,255,0.7)';
  ctx.lineWidth = Math.max(1, 0.6 * s);
  ctx.beginPath(); ctx.arc(0, 0, 4 * s, 0, Math.PI * 2); ctx.stroke();
  // inner main sheen (oval)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.ellipse(-2 * s, -2 * s, 2.2 * s, 1.3 * s, -0.4, 0, Math.PI * 2); ctx.fill();
  // small secondary sheen
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(-2.5 * s, -2.5 * s, 0.7 * s, 0, Math.PI * 2); ctx.fill();
  // rainbow gradient hint on right rim
  ctx.fillStyle = 'rgba(255,150,200,0.4)';
  ctx.beginPath(); ctx.arc(3 * s, 2 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
// v1.8 — beefier BFG sprite (was reusing sausage). Glowing pink core +
// power-arc rings. Used both as held-weapon icon and pickup.
function drawBfg(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // outer glow halo
  ctx.fillStyle = 'rgba(255,58,161,0.35)';
  ctx.beginPath(); ctx.arc(0, 0, 8 * s, 0, Math.PI * 2); ctx.fill();
  // ring (containment)
  ctx.strokeStyle = '#ff3aa1'; ctx.lineWidth = Math.max(1, 1.4 * s);
  ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, Math.PI * 2); ctx.stroke();
  // inner ring darker
  ctx.strokeStyle = '#a01a6a'; ctx.lineWidth = Math.max(1, 0.6 * s);
  ctx.beginPath(); ctx.arc(0, 0, 4.5 * s, 0, Math.PI * 2); ctx.stroke();
  // pink plasma core
  ctx.fillStyle = '#ff3aa1';
  ctx.beginPath(); ctx.arc(0, 0, 3 * s, 0, Math.PI * 2); ctx.fill();
  // white hot center
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-1 * s, -1 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  // 4 mini cross-arcs
  ctx.strokeStyle = 'rgba(255,200,230,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6 * s, 0); ctx.lineTo(-3.5 * s, 0);
  ctx.moveTo(6 * s, 0); ctx.lineTo(3.5 * s, 0);
  ctx.moveTo(0, -6 * s); ctx.lineTo(0, -3.5 * s);
  ctx.moveTo(0, 6 * s); ctx.lineTo(0, 3.5 * s);
  ctx.stroke();
  ctx.restore();
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'rocket:muted' });

// Perf: reusable scratch buffer for [pug, ...bots] iterations — these
// happen 6+ times per frame and used to allocate a fresh array each call.
const _allFighters = [];
function _fighters() {
  _allFighters.length = 0;
  if (pug) _allFighters.push(pug);
  for (const b of bots) _allFighters.push(b);
  return _allFighters;
}
// Fast arcade backing track — sustained intensity for the whole arena.
const music = createMusicTrack({ mood: 'arcade', tempo: 150, key: 'F', scale: 'minor' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'rocket-pug', getControlsHelp: () => _isTouch
  ? 'LEFT JOYSTICK move · TAP-anywhere aim · FIRE / JETPACK buttons. Saved to your profile.'
  : 'WASD move · MOUSE aim · CLICK fire · SPACE jetpack burst. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => {
  resize();
  // Only rebuild decorative crowd silhouettes (cheap, no gameplay impact).
  // Skip rebuilding stove/obstacles/puddles/pedestal mid-match — that would
  // randomize positions and reset the pedestal cooldown, breaking the run.
  if (crowd && crowd.length) buildCrowd();
}); resize();

const WEAPONS = [
  { id: 'tennis',  name: 'Tennis',  drawIconFn: drawIcon.tennisBall, cooldown: 0.4,  speed: 480, dmg: 14, color: '#5ef38c', shape: 'ball',    recoil: 0.05, desc: 'Fast & light.' },
  { id: 'sausage', name: 'Sausage', drawIconFn: drawSausage,         cooldown: 0.55, speed: 380, dmg: 22, color: '#ff8e3c', shape: 'sausage', recoil: 0.12, desc: 'Solid hit.' },
  { id: 'toaster', name: 'Toast',   drawIconFn: drawToast,           cooldown: 0.8,  speed: 320, dmg: 30, color: '#ffd23f', shape: 'toast',   recoil: 0.22, desc: 'Slow but heavy.' },
  { id: 'bubble',  name: 'Bubble',  drawIconFn: drawBubble,          cooldown: 0.3,  speed: 240, dmg: 8,  color: '#4cc9f0', shape: 'bubble',  recoil: 0.02, desc: 'Spam at range.' },
  // BFG — Polish R2: cooldown now 4.0s (was 1.4) so it's punishingly slow
  // between shots. Damage stays high so a clean hit still feels devastating.
  { id: 'bfg',     name: 'BFG',     drawIconFn: drawBfg,             cooldown: 4.0,  speed: 260, dmg: 60, color: '#ff3aa1', shape: 'bfg',     recoil: 0.35, desc: 'BIG. RARE. SLOW.', rare: true },
];
let activePerkId = 'tough';

let pug, bots, projectiles, particles, popups, sparks, kills, running;
let mouse = { x: 0, y: 0 };
let shakeT = 0, shakeAmp = 0;
let comboT = 0, comboN = 0, comboBannerT = 0;
let lastHitT = 0; // for player hit-flash
const ARENA_LABELS = { kitchen: 'KITCHEN', gym: 'GYM', rooftop: 'ROOFTOP' };
let activeArena = 'kitchen', activeMode = 'dm';
let treadmills = [], dumbbells = [], acUnits = [], trampolines = [], smashTables = [];
let chopperT = 0, bgChefsT = 0;
let flags = [], teamScore = 0, botScore = 0;
let kothZone = null, kothMeter = { team: 0, bots: 0 };
let seriesRound = 1, seriesTeam = 0, seriesBots = 0;
// Best-of N. Default 5 (= first to 3). User can pick 3/5/7 in start screen
// match settings. SERIES_TARGET = Math.ceil(seriesLen / 2).
let seriesLen = 5;
function getSeriesTarget() { return Math.ceil(seriesLen / 2); }
// Backwards-compat alias for any string refs (we keep the name SERIES_TARGET
// in the rest of the file via the helper above).
const SERIES_TARGET = 3;  // unused, kept so external scripts don't crash
let shotsFired = 0, shotsHit = 0, longestStreak = 0, matchStartT = 0, spectatorIdx = -1;
// Round 2C polish: hit-pause window pauses physics for ~0.08s on big hits, and
// ring shockwaves expand outward on detonation/kills (drawn under particles).
let hitPauseT = 0;
let shockwaves = []; // {x, y, r, maxR, life, t, color}
// PWNED freeze-frame: when set, tick() pauses physics/AI; render still runs and
// draws the giant PWNED banner over the victim with slight zoom-in.
let pwnedT = 0;     // seconds remaining of freeze (0.6 total)
let pwnedVictim = null; // pug ref — banner anchor + camera zoom center
let crowd = [];
let weaponPickups = []; // {x, y, weapon, t, bob}
let weaponSpawnT = 0;   // seconds until next spawn
// Round 2 polish:
let ragdollLimbs = [];  // {x, y, vx, vy, rot, rotV, color, kind, life, t, bounces}
// CTF goal celebration (golden bread parade) — particles released on score
let goalParade = [];    // {x, y, vx, vy, color, life, t, kind}
let infiniteAmmoT = 0;  // POWER OUTLET pickup: when >0, player skips fire cooldown
// Arena-specific hazards added in Polish R2:
let kitchenOvenSpit = []; // {x, y, vx, vy, life, t} fireball blobs from a wall oven
let kitchenOvenT = 0;     // cooldown for oven spit cycle
let gymBag = null;        // swinging punching bag {x, y, angle, t}
let rooftopWindT = 0;     // seconds since last gust
let rooftopWindBlowing = 0; // seconds the wind is active (0 = no wind)
let rooftopWindDir = 0;     // -1 / +1 horizontal
// Match-settings overrides: chosen on the start screen, applied at match start.
let mSettingsScoreLimit = 0; // 0 = use default DM rule; otherwise win on this many kills
let mSettingsTimeLimit = 0;  // 0 = no time cap; otherwise auto-end at this many seconds
// Spectator name + best-of replay info
let lastBestKill = null;     // {ang, x, y, killer, victim, ts, weapon} — last "highlight"
let endHighlightT = 0;       // seconds remaining for the end-screen highlight replay
// --- Map decor & hazards (kitchen arena) ----------------------------------
let stove = null;       // central hazard {x, y, w, h, burners[]}
let obstacles = [];     // {x, y, w, h, kind, c1, c2}  blocks movement
let puddles = [];       // {x, y, r}  slip zones
let goalPosts = [];     // {x, y, side}  decorative arches
// --- Powerup pedestal -----------------------------------------------------
const BUFF_TYPES = ['shield', 'damage', 'speed'];
let pedestal = null;    // {x, y, ready, t, type}
let pedestalCd = 0;     // seconds until next ready
let activeBuffs = new Map(); // pug -> {type, t}
function shake(amp, dur) { const k = _shakeMul(); shakeAmp = Math.max(shakeAmp, amp * k); shakeT = Math.max(shakeT, dur); }
function popup(x, y, text, color) {
  if (popups.length > 32) popups.shift();
  // Round 2C: random horizontal spawn velocity + slight vertical jitter so
  // multiple popups don't stack atop each other (juicier score spew).
  const vx = (Math.random() - 0.5) * 60;
  popups.push({ x, y, vx, vy: -80, text, color: color || '#ffd23f', life: 1.0, t: 0 });
}
function mkPug(x, y, isPlayer, color, mask) {
  return {
    x, y, vx: 0, vy: 0, hp: 100, maxHp: 100,
    isPlayer, color, mask, ang: 0,
    weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)],
    fireCd: 0,
    jetT: 0, jetCd: 0,
    targetAng: 0,
    hitFlashT: 0,
    slipT: 0, // when >0, controls reduced and velocity scaled
    // 2s grace period at match start — player gets oriented before bots open fire
    invuln: isPlayer ? 2.0 : 0,
  };
}
// Build the central kitchen stove (large rectangle + 4 burners).
function buildStove() {
  const w = 130, h = 90;
  stove = {
    x: W / 2 - w / 2, y: H / 2 - h / 2, w, h,
    burners: [
      { dx: 28,    dy: 24, phase: Math.random() * Math.PI * 2 },
      { dx: w-28,  dy: 24, phase: Math.random() * Math.PI * 2 },
      { dx: 28,    dy: h-24, phase: Math.random() * Math.PI * 2 },
      { dx: w-28,  dy: h-24, phase: Math.random() * Math.PI * 2 },
    ],
  };
}
// 6 fixed kitchen prop obstacles. Sized ~50x40. Placed away from stove + spawn.
function buildObstacles() {
  obstacles = [];
  const stoveCx = W / 2, stoveCy = H / 2;
  const props = [
    { kind: 'fridge',   c1: '#cacad6', c2: '#8a8a9a' },
    { kind: 'microwave',c1: '#2a2a3a', c2: '#4cc9f0' },
    { kind: 'sink',     c1: '#9ec8d8', c2: '#4a7080' },
    { kind: 'trash',    c1: '#3a5a3a', c2: '#2a4a2a' },
    { kind: 'table',    c1: '#8a5a2c', c2: '#5a3a1c' },
    { kind: 'icecream', c1: '#ff8ec7', c2: '#c8589a' },
  ];
  // Six anchor positions relative to screen
  const anchors = [
    { ax: 0.18, ay: 0.22 },
    { ax: 0.82, ay: 0.22 },
    { ax: 0.18, ay: 0.78 },
    { ax: 0.82, ay: 0.78 },
    { ax: 0.50, ay: 0.18 },
    { ax: 0.50, ay: 0.82 },
  ];
  for (let i = 0; i < props.length; i++) {
    const a = anchors[i];
    const w = 50, h = 40;
    const x = a.ax * W - w / 2;
    const y = a.ay * H - h / 2;
    // Skip if too close to stove center
    if (Math.hypot((x + w/2) - stoveCx, (y + h/2) - stoveCy) < 110) continue;
    obstacles.push({ x, y, w, h, ...props[i] });
  }
}
function buildPuddles() {
  puddles = [];
  for (let i = 0; i < 4; i++) {
    let tries = 0;
    while (tries++ < 20) {
      const x = 90 + Math.random() * (W - 180);
      const y = 90 + Math.random() * (H - 180);
      // avoid stove + obstacles
      if (Math.hypot(x - W/2, y - H/2) < 100) continue;
      let ok = true;
      for (const o of obstacles) {
        if (x > o.x - 30 && x < o.x + o.w + 30 && y > o.y - 30 && y < o.y + o.h + 30) { ok = false; break; }
      }
      if (ok) { puddles.push({ x, y, r: 22 + Math.random() * 10, phase: Math.random() * Math.PI * 2 }); break; }
    }
  }
}
function buildGoalPosts() {
  // 4 corner arches (decorative landmarks)
  goalPosts = [
    { x: 60,       y: 60,     side: 'tl' },
    { x: W - 60,   y: 60,     side: 'tr' },
    { x: 60,       y: H - 60, side: 'bl' },
    { x: W - 60,   y: H - 60, side: 'br' },
  ];
}
function buildPedestal() {
  pedestal = { x: W / 2, y: H / 2, ready: false, t: 0, type: BUFF_TYPES[0] };
  pedestalCd = 8;
}
function buildArenaProps() {
  treadmills = []; dumbbells = []; acUnits = []; trampolines = []; smashTables = [];
  gymBag = null;
  kitchenOvenT = 0;
  kitchenOvenSpit = [];
  rooftopWindT = 0;
  rooftopWindBlowing = 0;
  if (activeArena === 'gym') {
    treadmills.push({ x: W * 0.22, y: H * 0.3, w: 100, h: 40, dir: 1, t: 0 });
    treadmills.push({ x: W * 0.78 - 100, y: H * 0.7, w: 100, h: 40, dir: -1, t: 0 });
    const gp = [[0.15, 0.55], [0.4, 0.18], [0.6, 0.82], [0.85, 0.45], [0.35, 0.7], [0.65, 0.25]];
    for (const [ax, ay] of gp) dumbbells.push({ x: ax * W - 18, y: ay * H - 10, w: 36, h: 20 });
    // Polish R2: swinging punching bag centered above the arena center.
    gymBag = { x: W / 2, y: H * 0.35, angle: 0, t: 0 };
  } else if (activeArena === 'rooftop') {
    const ap = [[0.18, 0.25], [0.45, 0.7], [0.75, 0.25], [0.3, 0.45], [0.7, 0.7]];
    for (const [ax, ay] of ap) acUnits.push({ x: ax * W - 22, y: ay * H - 18, w: 44, h: 36 });
  }
  trampolines.push({ x: W * 0.28, y: H * 0.5, r: 22, t: 0 });
  trampolines.push({ x: W * 0.72, y: H * 0.5, r: 22, t: 0 });
  smashTables.push({ x: W * 0.35 - 30, y: H * 0.35 - 18, w: 60, h: 36, hp: 1, hidden: 'ammo' });
  smashTables.push({ x: W * 0.65 - 30, y: H * 0.65 - 18, w: 60, h: 36, hp: 1, hidden: 'shield' });
}
function buildModeProps() {
  flags = []; kothZone = null; teamScore = 0; botScore = 0; kothMeter = { team: 0, bots: 0 };
  if (activeMode === 'ctf') {
    for (let i = 0; i < 3; i++) {
      const fx = (i + 1) * (W / 4), fy = H / 2 + (i % 2 === 0 ? -60 : 60);
      flags.push({ x: fx, y: fy, baseX: fx, baseY: fy, holder: null, t: 0, dropT: 0 });
    }
  } else if (activeMode === 'koth') kothZone = { x: W / 2, y: H / 2, r: 70 };
}
// Rect-circle resolve for obstacles (simple AABB-vs-pug)
function resolveObstacles(p) {
  const pr = 18;
  for (const o of obstacles) {
    const cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(p.y, o.y + o.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < pr * pr) {
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d, ny = dy / d;
      const push = pr - d;
      p.x += nx * push; p.y += ny * push;
      // dampen velocity into wall
      const dot = p.vx * nx + p.vy * ny;
      if (dot < 0) { p.vx -= nx * dot; p.vy -= ny * dot; }
    }
  }
}
function buffMod(p, key) {
  const b = activeBuffs.get(p); if (!b) return 1;
  if (b.type === 'shield' && key === 'damage_in') return 0.5;
  if (b.type === 'damage' && key === 'damage_out') return 1.5;
  if (b.type === 'speed' && key === 'speed') return 1.4;
  return 1;
}
function buildCrowd() {
  crowd = [];
  // Top + bottom rows of silhouettes outside the stadium walls
  const STEP = 14;
  for (let x = 12; x < W; x += STEP) {
    crowd.push({ x, y: 14, base: 14, phase: Math.random() * Math.PI * 2, c: ['#3a2a5a','#4a3a6a','#5a3a4a','#2a3a5a'][Math.floor(Math.random()*4)], waveT: 0 });
    crowd.push({ x, y: H - 14, base: H - 14, phase: Math.random() * Math.PI * 2, c: ['#3a2a5a','#4a3a6a','#5a3a4a','#2a3a5a'][Math.floor(Math.random()*4)], waveT: 0 });
  }
}
function crowdCheer() {
  // Triggered on kills — sweep wave across the stands
  for (const c of crowd) c.waveT = 0.5 + Math.random() * 0.2;
}
// Scrolling kill feed (top-right) — pushed on each elimination.
const __rocketFeed = createKillFeed({ maxLines: 5, lifespan: 5000 });
function pushKillFeed(killer, victim) {
  const isPlayer = killer === pug;
  const isDeath = victim === pug;
  const color = isPlayer ? '#5ef38c' : isDeath ? '#ff3a3a' : '#c8c0e8';
  const k = isPlayer ? 'YOU' : (killer && killer.color) ? 'BOT' : 'THE ARENA';
  const v = isDeath ? 'YOU' : 'BOT';
  __rocketFeed.push(`${k} ▶ ${v}`, color);
}
function reset() {
  pug = mkPug(W / 2, H - 100, true, '#c8854a', '#1a0d05');
  pug.weapon = WEAPONS[0]; // start with tennis
  // Apply perk effects
  if (activePerkId === 'tough') { pug.maxHp = 130; pug.hp = 130; }
  bots = [];
  const colors = [['#eac888','#6b3a1c'], ['#5a5a72','#222'], ['#fafaff','#a8a8c8'], ['#ff5a3a','#6a2a14']];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const r = Math.min(W, H) * 0.3;
    const c = colors[i];
    bots.push(mkPug(W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r, false, c[0], c[1]));
  }
  projectiles = []; particles = []; popups = []; sparks = []; kills = 0;
  comboT = 0; comboN = 0; comboBannerT = 0;
  shakeT = 0; shakeAmp = 0;
  shockwaves = []; hitPauseT = 0;
  weaponPickups = []; weaponSpawnT = 6; // first pickup after 6s
  // Polish R2 resets
  ragdollLimbs = [];
  goalParade = [];
  infiniteAmmoT = 0;
  endHighlightT = 0;
  lastBestKill = null;
  mouse = { x: W / 2, y: H / 2 };
  activeBuffs = new Map();
  // Reset PWNED freeze so a fresh match doesn't inherit a stuck freeze if the
  // previous match ended while the cam was still up.
  pwnedT = 0; pwnedVictim = null;
  lastHitT = 0;
  // Wave 1D: reset stats + spectator
  shotsFired = 0; shotsHit = 0; longestStreak = 0;
  matchStartT = performance.now();
  spectatorIdx = -1;
  chopperT = 0; bgChefsT = 0;
  buildCrowd();
  buildStove();
  buildObstacles();
  buildPuddles();
  buildGoalPosts();
  buildPedestal();
  buildArenaProps();
  buildModeProps();
}
function spawnWeaponPickup() {
  // Polish R2: 8% chance the spawn is a POWER OUTLET (infinite-ammo buff).
  const isPower = Math.random() < 0.08;
  if (isPower) {
    for (let tries = 0; tries < 30; tries++) {
      const x = 80 + Math.random() * (W - 160);
      const y = 80 + Math.random() * (H - 160);
      let ok = true;
      for (const p of [pug, ...bots]) {
        if (!p) continue;
        if (Math.hypot(p.x - x, p.y - y) < 90) { ok = false; break; }
      }
      if (ok) {
        weaponPickups.push({
          x, y, t: 0, bob: Math.random() * Math.PI * 2,
          weapon: { name: 'POWER', drawIconFn: drawBubble, color: '#4cc9f0' },
          buff: 'infiniteAmmo',
        });
        return;
      }
    }
  }
  // Pick a random non-current weapon for variety. BFG = rare (1-in-6) drop.
  const isBfg = Math.random() < 0.16;
  const pool = isBfg ? WEAPONS.filter((w) => w.id === 'bfg')
                     : WEAPONS.filter((w) => !w.rare && (!pug || w.id !== pug.weapon.id));
  const w = pool[Math.floor(Math.random() * pool.length)] || WEAPONS[0];
  // Spawn at a random arena spot away from any pug
  for (let tries = 0; tries < 30; tries++) {
    const x = 80 + Math.random() * (W - 160);
    const y = 80 + Math.random() * (H - 160);
    let ok = true;
    for (const p of [pug, ...bots]) {
      if (!p) continue;
      if (Math.hypot(p.x - x, p.y - y) < 90) { ok = false; break; }
    }
    if (ok) { weaponPickups.push({ x, y, weapon: w, t: 0, bob: Math.random() * Math.PI * 2 }); return; }
  }
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' && !e.repeat) doJet();
  // Spectator: arrow keys cycle bot targets while player is dead
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && pug && pug.hp <= 0 && bots) {
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    let idx = spectatorIdx + dir;
    for (let i = 0; i < bots.length; i++) {
      if (idx < 0) idx = bots.length - 1; if (idx >= bots.length) idx = 0;
      if (bots[idx] && bots[idx].hp > 0) break;
      idx += dir;
    }
    spectatorIdx = idx;
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
let firing = false;
canvas.addEventListener('mousedown', () => firing = true);
window.addEventListener('mouseup', () => firing = false);
canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; firing = true; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => firing = false);
document.getElementById('jet-btn').addEventListener('click', doJet);
if ('ontouchstart' in window) document.getElementById('jet-btn').style.display = 'block';
// Universal mobile controls — aim-fire layout. Joystick moves, drag-anywhere
// forwards mousemove to the canvas (so existing `firing`/`mouse` logic reads
// from canvas-relative mouse events). FIRE button triggers held-mouse-down.
createMobileControls({
  layout: 'aim-fire',
  keys,
  buttons: [
    { id: 'jet',    label: 'JET',    key: 'Space' },
  ],
  getCanvas: () => canvas,
  onFire: (down) => { firing = down; },
});
// Arena-style multi-pug brawl reads much better in landscape.
showOrientationHint({ gameId: 'rocket-pug' });

function doJet() {
  if (!running || pug.jetCd > 0) return;
  pug.jetT = 1.6;
  pug.jetCd = 5;
  sfx.tone(880, 'square', 0.3, 0.22);
}

function fire(shooter, ang) {
  if (shooter.fireCd > 0) return;
  const w = shooter.weapon;
  // Perk: QUICKFIRE reduces shooter cooldown for player only
  const cdMul = (shooter === pug && activePerkId === 'quick') ? 0.85 : 1.0;
  // POWER OUTLET (Polish R2): zero cooldown for the player while buff is active
  if (shooter === pug && infiniteAmmoT > 0) {
    shooter.fireCd = 0.04;  // tiny cooldown so we don't tank perf
  } else {
    shooter.fireCd = w.cooldown * cdMul;
  }
  // Each weapon has unique recoil pattern (kicks the shooter back along -aim)
  if (w.recoil) {
    shooter.vx -= Math.cos(ang) * 60 * w.recoil;
    shooter.vy -= Math.sin(ang) * 60 * w.recoil;
  }
  projectiles.push({
    x: shooter.x + Math.cos(ang) * 22, y: shooter.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
    owner: shooter, dmg: w.dmg, color: w.color, shape: w.shape, life: w.shape === 'bfg' ? 3.0 : 2.0, ang,
  });
  // Accuracy tracking
  if (shooter === pug) shotsFired++;
  sfx.tone(380 + Math.random() * 100, w.shape === 'bubble' ? 'sine' : (w.shape === 'bfg' ? 'sawtooth' : 'square'), w.shape === 'bfg' ? 0.18 : 0.06, w.shape === 'bfg' ? 0.34 : 0.18);
}

function tick(dt) {
  if (!running) return;
  // PWNED freeze: pause world for 0.6s after a kill (Rocket League goal cam).
  // Only the freeze timer + render flow advance during this window.
  if (pwnedT > 0) {
    pwnedT = Math.max(0, pwnedT - dt);
    if (pwnedT === 0) pwnedVictim = null;
    return;
  }
  // Round 2C: brief 0.05-0.08s hit-pause on big projectile hits — pauses world
  // physics but still updates the timer + sparks/shockwaves visuals (those
  // advance below in the particles/sparks/shockwaves block via separate decay).
  if (hitPauseT > 0) {
    hitPauseT = Math.max(0, hitPauseT - dt);
    // still advance shockwave animations during pause for visual snap
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i]; s.t += dt;
      if (s.t >= s.life) shockwaves.splice(i, 1);
    }
    return;
  }
  // Weapon pickups — periodic spawn + collision check
  weaponSpawnT -= dt;
  if (weaponSpawnT <= 0 && weaponPickups.length < 2) {
    spawnWeaponPickup();
    weaponSpawnT = 9 + Math.random() * 4; // every 9-13s
  }
  for (let i = weaponPickups.length - 1; i >= 0; i--) {
    const wp = weaponPickups[i];
    wp.t += dt; wp.bob += dt * 3;
    // Player pickup
    if (pug.hp > 0 && Math.hypot(pug.x - wp.x, pug.y - wp.y) < 28) {
      if (wp.buff === 'infiniteAmmo') {
        // POWER OUTLET (Polish R2): 5s of zero-cooldown firing
        infiniteAmmoT = 5.0;
        popup(pug.x, pug.y - 20, 'INFINITE AMMO!', '#4cc9f0');
        sfx.tone(740, 'triangle', 0.18, 0.3);
        sfx.tone(1480, 'triangle', 0.12, 0.22);
      } else if (wp.buff) {
        // Smash-table buff: instant 8s shield/damage/speed activation
        activeBuffs.set(pug, { type: wp.buff, t: 10 });
        popup(pug.x, pug.y - 20, wp.buff.toUpperCase() + '!', wp.weapon.color);
        sfx.tone(880, 'triangle', 0.12, 0.25);
        sfx.tone(1320, 'triangle', 0.12, 0.18);
      } else {
        pug.weapon = wp.weapon;
        popup(pug.x, pug.y - 20, wp.weapon.name.toUpperCase() + '!', wp.weapon.color);
        sfx.tone(880, 'triangle', 0.1, 0.25);
        sfx.tone(1320, 'triangle', 0.1, 0.18);
      }
      weaponPickups.splice(i, 1);
      continue;
    }
    // Bot pickup (only weapon pickups, not buff)
    if (!wp.buff) {
      for (const b of bots) {
        if (b.hp <= 0) continue;
        if (Math.hypot(b.x - wp.x, b.y - wp.y) < 26) {
          b.weapon = wp.weapon;
          weaponPickups.splice(i, 1);
          break;
        }
      }
    }
  }
  // Player movement (controls disabled while slipping AND when alive)
  if (pug.hp > 0) {
    let mx = 0, my = 0;
    if (pug.slipT <= 0) {
      if (keys.has('w')) my -= 1;
      if (keys.has('s')) my += 1;
      if (keys.has('a')) mx -= 1;
      if (keys.has('d')) mx += 1;
    }
    if (mx || my) {
      const l = Math.hypot(mx, my);
      const baseSp = (pug.jetT > 0 ? 480 : 220) * buffMod(pug, 'speed');
      // SPRINTER perk = +20% move speed
      const sp = baseSp * (activePerkId === 'sprint' ? 1.20 : 1.0);
      pug.vx += (mx / l) * sp * dt * 3;
      pug.vy += (my / l) * sp * dt * 3;
    }
    pug.jetT = Math.max(0, pug.jetT - dt);
    pug.jetCd = Math.max(0, pug.jetCd - dt);
    pug.fireCd = Math.max(0, pug.fireCd - dt);
    if (pug.invuln > 0) pug.invuln = Math.max(0, pug.invuln - dt);
    // MEDIC perk: +1 HP/sec regen
    if (activePerkId === 'medic' && pug.hp < pug.maxHp) pug.hp = Math.min(pug.maxHp, pug.hp + dt);
    // Aim
    pug.ang = Math.atan2(mouse.y - pug.y, mouse.x - pug.x);
    // === AIM ASSIST (Polish R2) ===
    // Subtle pull toward nearest enemy within 220px of crosshair; off by default.
    if (localStorage.getItem('wg:rp-aim-assist') === '1') {
      let bestD = 220 * 220, target = null;
      const ax = pug.x + Math.cos(pug.ang) * 200;
      const ay = pug.y + Math.sin(pug.ang) * 200;
      for (const b of bots) {
        if (b.hp <= 0) continue;
        const dx = b.x - ax, dy = b.y - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; target = b; }
      }
      if (target) {
        const desired = Math.atan2(target.y - pug.y, target.x - pug.x);
        let diff = desired - pug.ang;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        pug.ang += diff * 0.25;  // 25% pull — feels subtle but helpful
      }
    }
    if (firing) fire(pug, pug.ang);
  }
  // Wave 1D: animated bg + arena props update
  bgChefsT += dt; chopperT += dt;
  for (const tr of trampolines) tr.t = Math.max(0, tr.t - dt);
  for (const tm of treadmills) tm.t += dt;

  // Bots AI — cover-seeking, projectile dodge, strafe
  for (const b of bots) {
    if (b.hp <= 0) continue;
    b.fireCd = Math.max(0, b.fireCd - dt);
    let target = null, bestD = Infinity;
    if (pug.hp > 0) { bestD = Math.hypot(pug.x - b.x, pug.y - b.y); target = pug; }
    for (const o of bots) {
      if (o === b || o.hp <= 0) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < bestD) { bestD = d; target = o; }
    }
    let dodgeAng = 0, dodgeForce = 0;
    for (const pr of projectiles) {
      if (pr.owner === b) continue;
      const dx = b.x - pr.x, dy = b.y - pr.y, dd = Math.hypot(dx, dy);
      if (dd > 180) continue;
      const vl = Math.hypot(pr.vx, pr.vy) || 1;
      if (((-dx) * pr.vx + (-dy) * pr.vy) / vl > dd * 0.7) {
        dodgeAng = Math.atan2(pr.vx / vl, -pr.vy / vl); dodgeForce = 600; break;
      }
    }
    if (target) {
      const angTo = Math.atan2(target.y - b.y, target.x - b.x);
      b.ang = angTo;
      if (b.hp < b.maxHp * 0.4 && obstacles.length) {
        let nd = Infinity, near = obstacles[0];
        for (const o of obstacles) {
          const dd = Math.hypot((o.x + o.w / 2) - b.x, (o.y + o.h / 2) - b.y);
          if (dd < nd) { nd = dd; near = o; }
        }
        const ca = Math.atan2((near.y + near.h / 2) - b.y, (near.x + near.w / 2) - b.x);
        b.vx += Math.cos(ca) * 600 * dt; b.vy += Math.sin(ca) * 600 * dt;
      } else if (bestD > 200) { b.vx += Math.cos(angTo) * 800 * dt; b.vy += Math.sin(angTo) * 800 * dt; }
      else if (bestD < 100) { b.vx -= Math.cos(angTo) * 700 * dt; b.vy -= Math.sin(angTo) * 700 * dt; }
      else {
        const dir = (b._strafeDir = b._strafeDir ?? (Math.random() < 0.5 ? 1 : -1));
        b.vx += Math.cos(angTo + dir * Math.PI / 2) * 500 * dt;
        b.vy += Math.sin(angTo + dir * Math.PI / 2) * 500 * dt;
        if (Math.random() < dt * 0.5) b._strafeDir *= -1;
      }
      if (dodgeForce > 0) { b.vx += Math.cos(dodgeAng) * dodgeForce * dt; b.vy += Math.sin(dodgeAng) * dodgeForce * dt; }
      fire(b, angTo);
    }
  }
  // Physics
  for (const p of _fighters()) {
    if (p.hp <= 0) continue;
    // Slip on puddles — boost velocity and freeze input briefly on entry
    for (const pud of puddles) {
      if (Math.hypot(p.x - pud.x, p.y - pud.y) < pud.r) {
        if (p.slipT <= 0) {
          p.slipT = 0.5;
          p.vx *= 2; p.vy *= 2;
          if (p === pug) popup(p.x, p.y - 26, 'SLIP!', '#4cc9f0');
        }
        break;
      }
    }
    // Trampoline — bounce upward (give jet effect briefly)
    for (const tr of trampolines) {
      if (Math.hypot(p.x - tr.x, p.y - tr.y) < tr.r && tr.t <= 0) {
        p.vy -= 480;
        tr.t = 0.4;
        if (p === pug) {
          p.jetT = Math.max(p.jetT, 0.5);
          popup(p.x, p.y - 26, 'BOING!', '#ff3aa1');
        }
        sfx.tone(880, 'sine', 0.12, 0.22);
      }
    }
    // Treadmill (gym arena): push pugs along its direction while standing on it.
    // Polish R2: SPRINTER perk would stack with treadmill into a slingshot
    // (+20% move speed × treadmill push × jet burst could go ballistic), so
    // we now halve the treadmill push for SPRINTER + cap max horizontal
    // velocity from the treadmill so it can't snowball.
    for (const tm of treadmills) {
      if (p.x > tm.x && p.x < tm.x + tm.w && p.y > tm.y && p.y < tm.y + tm.h) {
        const tmPush = (p === pug && activePerkId === 'sprint') ? 120 : 240;
        // Cap: if pug already moving fast in the treadmill direction, don't
        // boost further (prevents the snowball with sprint+jet).
        if (Math.abs(p.vx) < 360 || Math.sign(p.vx) !== Math.sign(tm.dir)) {
          p.vx += tm.dir * tmPush * dt;
        }
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    // Friction (less when slipping — keeps the slide alive)
    const fric = p.slipT > 0 ? 1.5 : 4;
    p.vx *= Math.pow(0.5, dt * fric); p.vy *= Math.pow(0.5, dt * fric);
    p.x = Math.max(30, Math.min(W - 30, p.x));
    p.y = Math.max(30, Math.min(H - 30, p.y));
    // Obstacle collision
    resolveObstacles(p);
    // Arena cover collisions — generic AABB-vs-pug push for dumbbells/AC/tables
    const resolveBox = (b) => {
      const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      const dx = p.x - cx, dy = p.y - cy, d2 = dx * dx + dy * dy;
      if (d2 >= 324) return;
      const dd = Math.sqrt(d2) || 0.001;
      const nx = dx / dd, ny = dy / dd, push = 18 - dd;
      p.x += nx * push; p.y += ny * push;
      const dot = p.vx * nx + p.vy * ny;
      if (dot < 0) { p.vx -= nx * dot; p.vy -= ny * dot; }
    };
    for (const d of dumbbells) resolveBox(d);
    for (const d of acUnits) resolveBox(d);
    for (const t of smashTables) if (t.hp > 0) resolveBox(t);
    // Stove hazard — flames damage anyone within 26px of any burner
    if (stove) {
      for (const b of stove.burners) {
        const bx = stove.x + b.dx, by = stove.y + b.dy;
        if (Math.hypot(p.x - bx, p.y - by) < 26) {
          const dmg = 8 * dt * buffMod(p, 'damage_in');
          p.hp -= dmg;
          if (p === pug) { lastHitT = Math.max(lastHitT, 0.15); }
          // periodic popup so it doesn't spam
          if (Math.random() < dt * 1.5) popup(p.x, p.y - 24, 'FIRE!', '#ff5a3a');
          if (p.hp > 0 && Math.random() < dt * 8 && particles.length < 200) {
            const ang = Math.random() * Math.PI * 2;
            particles.push({ x: p.x, y: p.y, vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40 - 30, color: '#ff8e3c', life: 0.4, t: 0, size: 3 });
          }
          break;
        }
      }
    }
    p.slipT = Math.max(0, p.slipT - dt);
  }
  // Decay buffs
  for (const [p, b] of activeBuffs) {
    b.t -= dt;
    if (b.t <= 0 || p.hp <= 0) activeBuffs.delete(p);
  }
  // Pedestal — refill timer, then ready; first pug to enter claims buff
  if (pedestal) {
    if (!pedestal.ready) {
      pedestalCd -= dt;
      if (pedestalCd <= 0) {
        pedestal.ready = true; pedestal.t = 0;
        pedestal.type = BUFF_TYPES[Math.floor(Math.random() * BUFF_TYPES.length)];
        sfx.tone(740, 'triangle', 0.12, 0.20);
        if (pug && pug.hp > 0) popup(pedestal.x, pedestal.y - 60, 'PEDESTAL READY', '#fff');
      }
    } else {
      pedestal.t += dt;
      for (const p of _fighters()) {
        if (p.hp <= 0) continue;
        if (Math.hypot(p.x - pedestal.x, p.y - pedestal.y) < 26) {
          activeBuffs.set(p, { type: pedestal.type, t: 12 });
          const tname = pedestal.type === 'shield' ? 'SHIELD' : pedestal.type === 'damage' ? 'DMG BOOST' : 'SPEED';
          const tcol = pedestal.type === 'shield' ? '#4cc9f0' : pedestal.type === 'damage' ? '#ff5a3a' : '#ffd23f';
          popup(p.x, p.y - 28, tname + '!', tcol);
          sfx.tone(1100, 'triangle', 0.15, 0.25);
          shake(3, 0.15);
          pedestal.ready = false;
          pedestalCd = 18;
          break;
        }
      }
    }
  }
  // Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    // === Rocket trails (Round 2 polish) ===
    // Spawn 1-3 trail particles per frame behind heavier shots (sausage/toast/
    // BFG). Color varies per weapon. Lighter shots (tennis/bubble) skip to
    // keep particle budget healthy.
    if (pr.shape !== 'bubble' && pr.shape !== 'ball' && particles.length < 200) {
      const trailCount = pr.shape === 'bfg' ? 3 : (pr.shape === 'toast' ? 2 : 1);
      for (let k = 0; k < trailCount; k++) {
        const back = -1;
        const jitter = (Math.random() - 0.5) * 6;
        const trailX = pr.x + back * pr.vx * 0.012 + jitter;
        const trailY = pr.y + back * pr.vy * 0.012 + jitter;
        // Trail colors: white core for BFG; warm gradient for sausage/toast
        const cols = pr.shape === 'bfg'
          ? ['#ffffff', '#ff8aff', pr.color]
          : ['#ff8e3c', '#ffd23f', '#fff1b0'];
        particles.push({
          x: trailX, y: trailY,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          color: cols[Math.floor(Math.random() * cols.length)],
          life: 0.4 + Math.random() * 0.18, t: 0,
          size: 2 + Math.random() * 2,
        });
      }
    }
    // Wall sparks if it flew offscreen
    if (pr.x < 8 || pr.x > W - 8 || pr.y < 8 || pr.y > H - 8) {
      spawnSpark(Math.max(4, Math.min(W - 4, pr.x)), Math.max(4, Math.min(H - 4, pr.y)));
    }
    if (pr.life <= 0 || pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) { projectiles.splice(i, 1); continue; }
    // Smash table hit — destroy + reveal hidden pickup
    let tableHit = false;
    for (const t of smashTables) {
      if (t.hp <= 0) continue;
      if (pr.x > t.x && pr.x < t.x + t.w && pr.y > t.y && pr.y < t.y + t.h) {
        t.hp = 0;
        spawnHit(pr.x, pr.y, '#ffd23f'); spawnShockwave(pr.x, pr.y, '#ffd23f', 50, 0.32); shake(4, 0.18);
        const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
        if (t.hidden === 'shield') {
          weaponPickups.push({ x: cx, y: cy, weapon: { name: 'SHIELD', drawIconFn: drawBubble, color: '#4cc9f0' }, t: 0, bob: 0, buff: 'shield' });
        } else {
          const choices = WEAPONS.filter((w) => !w.rare && w.id !== 'tennis' && w.id !== 'bubble');
          weaponPickups.push({ x: cx, y: cy, weapon: choices[Math.floor(Math.random() * choices.length)], t: 0, bob: 0 });
        }
        popup(cx, cy - 24, 'SMASHED!', '#ffd23f'); sfx.tone(280, 'square', 0.18, 0.22);
        projectiles.splice(i, 1); tableHit = true; break;
      }
    }
    if (tableHit) continue;
    // Hit check
    for (const target of _fighters()) {
      if (target === pr.owner || target.hp <= 0) continue;
      if (target.invuln > 0) continue; // skip projectiles on invulnerable targets (player spawn grace)
      const d = Math.hypot(target.x - pr.x, target.y - pr.y);
      const radius = pr.shape === 'bfg' ? 32 : 22;
      if (d < radius) {
        // Accuracy: track shots-hit when the player's projectile lands
        if (pr.owner === pug) shotsHit++;
        const outMul = pr.owner ? buffMod(pr.owner, 'damage_out') : 1;
        const inMul = buffMod(target, 'damage_in');
        const finalDmg = pr.dmg * outMul * inMul;
        target.hp -= finalDmg;
        target.hitFlashT = 0.18;
        // SMASH-BROS knockback: scales with (1 - hp%) so low-HP pugs ragdoll
        // far, full-HP barely flinch. Direction = projectile travel direction
        // (so a back-shot launches them away from the shooter).
        {
          const hpPct = Math.max(0, target.hp) / target.maxHp;
          const intensity = 1 - hpPct;           // 0 at full HP, ~1 near death
          const baseKick = 60 + finalDmg * 6;    // baseline pop
          const kick = baseKick + intensity * intensity * 720; // quadratic ramp
          const vlen = Math.hypot(pr.vx, pr.vy) || 1;
          const nx = pr.vx / vlen, ny = pr.vy / vlen;
          target.vx += nx * kick;
          target.vy += ny * kick;
          // Low-HP targets briefly lose footing for visual "ragdoll" feel.
          if (intensity > 0.5) target.slipT = Math.max(target.slipT, 0.35);
        }
        spawnHit(pr.x, pr.y, pr.color);
        // Round 2C: small ring shockwave on heavy weapons (toast/sausage)
        if (pr.dmg >= 20) spawnShockwave(pr.x, pr.y, pr.color, 36, 0.28);
        sfx.tone(220, 'square', 0.05, 0.18);
        // Round 2C: brief hit-pause on heavier impacts (not bubbles) — 0.05s
        if (pr.dmg >= 20) hitPauseT = Math.max(hitPauseT, 0.05);
        if (target === pug) { lastHitT = 0.25; shake(4, 0.18); }
        if (target.hp <= 0) {
          if (pr.owner === pug && target !== pug) {
            kills++;
            // Polish R2: track "best kill" for the end-of-match highlight reel.
            // Heuristic: longest range player kill wins. We re-capture if a
            // newer kill is at a longer distance.
            const distFromPlayer = Math.hypot(target.x - pug.x, target.y - pug.y);
            if (!lastBestKill || distFromPlayer > (lastBestKill.dist || 0)) {
              lastBestKill = {
                killerX: pug.x, killerY: pug.y, ang: pug.ang,
                victimX: target.x, victimY: target.y,
                victimColor: target.color,
                weapon: pug.weapon ? pug.weapon.name : '?',
                dist: distFromPlayer,
                ts: performance.now(),
              };
            }
            // combo
            if (comboT > 0) comboN++; else comboN = 1;
            comboT = 3.0;
            if (comboN > longestStreak) longestStreak = comboN;
            if (comboN >= 2) comboBannerT = 1.4;
            // Round 2C: combo escalation popup — bigger text with each step
            const popText = comboN >= 3 ? `+${25 * comboN} x${comboN}!` : '+25';
            const popCol = comboN >= 3 ? '#ffd23f' : '#5ef38c';
            popup(target.x, target.y - 30, popText, popCol);
            // Round 2C: bigger shake + hit-pause on kill (juicy stop-frame)
            shake(comboN >= 2 ? 12 : 9, 0.32);
            hitPauseT = Math.max(hitPauseT, 0.10);
          } else {
            shake(5, 0.18);
          }
          try { pushKillFeed(pr.owner, target); } catch (e) { /* */ }
          crowdCheer();
          spawnDeath(target.x, target.y, target.color);
          sfx.sweep(440, 110, 'sawtooth', 0.25, 0.22);
          // ROCKET-LEAGUE freeze frame: 0.6s freeze + giant PWNED + slow zoom
          // over the victim. Skip if the player is the victim (death already
          // shows end overlay; freeze would feel like a hang on game-over).
          if (target !== pug) {
            pwnedT = 0.6;
            pwnedVictim = target;
            sfx.tone(880, 'square', 0.12, 0.3);
          }
        }
        projectiles.splice(i, 1);
        break;
      }
    }
  }
  // particle cap (oldest first)
  if (particles.length > 220) particles.splice(0, particles.length - 220);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.t >= p.life) particles.splice(i, 1);
  }
  // sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    s.vx *= 0.86; s.vy *= 0.86;
    if (s.t >= s.life) sparks.splice(i, 1);
  }
  // Ragdoll limbs (Round 2): gravity + tumble + wall bounce
  for (let i = ragdollLimbs.length - 1; i >= 0; i--) {
    const r = ragdollLimbs[i];
    r.t += dt;
    r.vy += 540 * dt;     // gravity
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.rot += r.rotV * dt;
    // Wall bounce — once per side
    if (r.bounces > 0) {
      if (r.x < 12 || r.x > W - 12) {
        r.vx = -r.vx * 0.45;
        r.x = Math.max(12, Math.min(W - 12, r.x));
        r.bounces -= 1;
      }
      if (r.y > H - 18) {
        r.vy = -r.vy * 0.35;
        r.y = H - 18;
        r.bounces -= 1;
      }
    }
    r.vx *= 0.985;
    if (r.t >= r.life) ragdollLimbs.splice(i, 1);
  }
  // CTF goal parade (Round 2): golden bread loaves arcing across the field
  for (let i = goalParade.length - 1; i >= 0; i--) {
    const g = goalParade[i];
    g.t += dt;
    g.vy += 360 * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    if (g.t >= g.life) goalParade.splice(i, 1);
  }
  // Kitchen oven spit projectiles (Round 2 element)
  for (let i = kitchenOvenSpit.length - 1; i >= 0; i--) {
    const o = kitchenOvenSpit[i];
    o.t += dt;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.vy += 100 * dt;
    // Damage player or bot on hit
    for (const p of _fighters()) {
      if (p.hp <= 0) continue;
      if (Math.hypot(p.x - o.x, p.y - o.y) < 18) {
        p.hp -= 12 * buffMod(p, 'damage_in');
        if (p === pug) { lastHitT = Math.max(lastHitT, 0.18); shake(3, 0.15); }
        spawnHit(o.x, o.y, '#ff5a3a');
        o.t = o.life;  // mark for removal
        break;
      }
    }
    if (o.t >= o.life) kitchenOvenSpit.splice(i, 1);
  }
  // Kitchen oven — periodic fireball spit (every ~5s, only kitchen arena)
  if (activeArena === 'kitchen') {
    kitchenOvenT = (kitchenOvenT || 0) + dt;
    if (kitchenOvenT > 5.0) {
      kitchenOvenT = 0;
      // Spit from a side-wall oven position
      const ox = 30, oy = H * 0.3 + Math.random() * H * 0.4;
      kitchenOvenSpit.push({ x: ox, y: oy, vx: 260, vy: -40, life: 2.6, t: 0 });
      popup(ox + 20, oy - 18, 'WHOOSH!', '#ff5a3a');
      sfx.tone(140, 'sawtooth', 0.18, 0.18);
    }
  }
  // Gym punching bag — slow oscillation in arena; damages on contact when swinging
  if (activeArena === 'gym' && gymBag) {
    gymBag.t += dt;
    gymBag.angle = Math.sin(gymBag.t * 1.4) * 0.7;
    const bx = gymBag.x + Math.sin(gymBag.angle) * 30;
    const by = gymBag.y + Math.abs(Math.sin(gymBag.angle)) * 8;
    for (const p of _fighters()) {
      if (p.hp <= 0) continue;
      if (Math.hypot(p.x - bx, p.y - by) < 26) {
        const swingV = Math.abs(Math.cos(gymBag.t * 1.4));
        if (swingV > 0.5) {
          // Knock back + small damage
          const ang = Math.atan2(p.y - by, p.x - bx);
          p.vx += Math.cos(ang) * 380;
          p.vy += Math.sin(ang) * 380;
          if (Math.random() < dt * 4) {
            p.hp -= 8 * buffMod(p, 'damage_in');
            if (p === pug) { lastHitT = Math.max(lastHitT, 0.15); }
          }
        }
      }
    }
  }
  // Rooftop wind gust — every 8s a 1.5s gust pushes pugs horizontally
  if (activeArena === 'rooftop') {
    rooftopWindT += dt;
    if (rooftopWindBlowing > 0) {
      rooftopWindBlowing -= dt;
      // Apply push to all alive pugs
      for (const p of _fighters()) {
        if (p.hp <= 0) continue;
        p.vx += rooftopWindDir * 320 * dt;
      }
      if (rooftopWindBlowing <= 0) rooftopWindT = 0;
    } else if (rooftopWindT > 8.0) {
      rooftopWindBlowing = 1.5;
      rooftopWindDir = Math.random() < 0.5 ? -1 : 1;
      popup(W / 2, 60, rooftopWindDir > 0 ? 'WIND →' : '← WIND', '#4cc9f0');
      sfx.tone(200, 'sine', 0.14, 0.5);
    }
  }
  // POWER OUTLET infinite-ammo buff timer
  if (infiniteAmmoT > 0) {
    infiniteAmmoT = Math.max(0, infiniteAmmoT - dt);
    // While buff active, also reset fireCd to 0 so the pug shoots at max speed
    if (pug && pug.hp > 0) pug.fireCd = 0;
  }
  // shockwaves (ring detonations) — expand and fade independently
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const s = shockwaves[i];
    s.t += dt;
    if (s.t >= s.life) shockwaves.splice(i, 1);
  }
  // popups
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt; p.y += p.vy * dt; p.vy *= 0.9;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 0.88; }
    if (p.t >= p.life) popups.splice(i, 1);
  }
  // timers
  shakeT = Math.max(0, shakeT - dt); if (shakeT === 0) shakeAmp = 0;
  comboT = Math.max(0, comboT - dt); if (comboT === 0) comboN = 0;
  comboBannerT = Math.max(0, comboBannerT - dt);
  lastHitT = Math.max(0, lastHitT - dt);
  for (const p of _fighters()) p.hitFlashT = Math.max(0, p.hitFlashT - dt);
  // crowd ambient sway uses real-time, no state to update

  // CTF / KOTH mode logic
  if (activeMode === 'ctf') {
    for (const fl of flags) {
      if (fl.holder) {
        if (fl.holder.hp <= 0) {
          // Carrier died — drop flag at their position + start the auto-return
          // timer so a dropped flag can't be stranded in inaccessible corners.
          fl.x = fl.holder.x; fl.y = fl.holder.y; fl.holder = null;
          fl.dropT = 0;
        } else {
          fl.x = fl.holder.x; fl.y = fl.holder.y - 30;
          if (fl.holder === pug && pug.y > H - 100) {
            teamScore++; fl.holder = null; fl.x = fl.baseX; fl.y = fl.baseY; fl.dropT = 0;
            popup(pug.x, pug.y - 30, 'FLAG SCORE!', '#ffd23f');
            sfx.arp([523, 659, 784, 1047], 'triangle', 0.06, 0.2, 0.12); shake(7, 0.32);
            // === GOLDEN BREAD PARADE (Polish R2) — 18 golden loaves arc skyward
            // across the field to celebrate the score.
            for (let bi = 0; bi < 18; bi++) {
              const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
              const sp = 280 + Math.random() * 220;
              goalParade.push({
                x: pug.x, y: pug.y - 20,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                color: ['#ffd23f', '#ff8e3c', '#fff1b0'][bi % 3],
                life: 2.0, t: 0,
                kind: 'bread',
              });
            }
          } else if (fl.holder !== pug && fl.holder.y < 100) {
            botScore++; fl.holder = null; fl.x = fl.baseX; fl.y = fl.baseY; fl.dropT = 0;
            popup(W / 2, 60, 'BOTS SCORED!', '#ff5a3a');
            sfx.tone(220, 'sawtooth', 0.18, 0.22);
          }
        }
      } else {
        // Auto-return: dropped flags warp back to base after 8s so they
        // can't be stranded in inaccessible corners. Pickup resets the timer.
        if (fl.dropT == null) fl.dropT = 0;
        if (fl.x !== fl.baseX || fl.y !== fl.baseY) {
          fl.dropT += dt;
          if (fl.dropT > 8) {
            fl.x = fl.baseX; fl.y = fl.baseY; fl.dropT = 0;
            popup(fl.baseX, fl.baseY - 16, 'FLAG RETURNED', '#4cc9f0');
            sfx.tone(523, 'triangle', 0.08, 0.2);
          }
        }
        for (const p of _fighters()) {
          if (p.hp > 0 && Math.hypot(p.x - fl.x, p.y - fl.y) < 24) {
            fl.holder = p;
            fl.dropT = 0;
            if (p === pug) popup(pug.x, pug.y - 30, 'FLAG!', '#ffd23f');
            break;
          }
        }
      }
    }
    if (teamScore >= 3) return end(true);
    if (botScore >= 3) return end(false);
  } else if (activeMode === 'koth') {
    let teamIn = pug.hp > 0 && Math.hypot(pug.x - kothZone.x, pug.y - kothZone.y) < kothZone.r;
    let botsIn = false;
    for (const b of bots) if (b.hp > 0 && Math.hypot(b.x - kothZone.x, b.y - kothZone.y) < kothZone.r) { botsIn = true; break; }
    if (teamIn && !botsIn) kothMeter.team = Math.min(10, kothMeter.team + dt);
    else if (botsIn && !teamIn) kothMeter.bots = Math.min(10, kothMeter.bots + dt);
    if (kothMeter.team >= 10) return end(true);
    if (kothMeter.bots >= 10) return end(false);
  }
  if (activeMode === 'dm') {
    if (pug.hp <= 0) return end(false);
    if (bots.every((b) => b.hp <= 0)) return end(true);
    // Polish R2: optional kill-score limit
    if (mSettingsScoreLimit > 0 && kills >= mSettingsScoreLimit) return end(true);
  } else if (pug.hp <= 0 && spectatorIdx === -1) {
    spectatorIdx = bots.findIndex((b) => b.hp > 0);
  }
  // Polish R2: optional time-limit auto-end (counts as win if player has the
  // higher kill count vs bots-combined, else loss)
  if (mSettingsTimeLimit > 0) {
    const elapsed = (performance.now() - matchStartT) / 1000;
    if (elapsed >= mSettingsTimeLimit) {
      const botKills = bots.reduce((acc, b) => acc + (b.kills || 0), 0);
      return end(kills >= botKills);
    }
  }
  updateHud();
}

function drawMinimap() {
  const w = 120, h = 80, x = W - w - 12, y = 12, sx = w / W, sy = h / H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.fillStyle = '#ffd23f'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText(ARENA_LABELS[activeArena], x + w / 2, y - 2);
  ctx.fillStyle = '#5a5a72';
  for (const o of obstacles) ctx.fillRect(x + o.x * sx, y + o.y * sy, o.w * sx, o.h * sy);
  if (kothZone) {
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x + kothZone.x * sx, y + kothZone.y * sy, kothZone.r * sx, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#ffd23f';
  for (const fl of flags) ctx.fillRect(x + fl.x * sx - 1, y + fl.y * sy - 1, 3, 3);
  ctx.fillStyle = '#ff5a3a';
  for (const b of bots) if (b.hp > 0) ctx.fillRect(x + b.x * sx - 1, y + b.y * sy - 1, 3, 3);
  if (pug.hp > 0) {
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(x + pug.x * sx - 2, y + pug.y * sy - 2, 4, 4);
  }
}
function spawnShockwave(x, y, color, maxR, life) {
  if (shockwaves.length > 14) shockwaves.shift();
  shockwaves.push({ x, y, r: 0, maxR: maxR || 60, life: life || 0.35, t: 0, color: color || '#ffd23f' });
}
function spawnHit(x, y, color) {
  // Round 2C: denser hit burst (6 -> 9 particles) for juicier impacts
  for (let i = 0; i < 9; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 70 + Math.random() * 120;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color, life: 0.32, t: 0, size: 3 });
  }
}
function spawnDeath(x, y, color) {
  // Round 2C: bigger blood spray (16 -> 26 particles, slower fade for read)
  for (let i = 0; i < 26; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 140 + Math.random() * 240;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color, life: 0.95, t: 0, size: 4 + Math.random() * 2 });
  }
  // ring shockwave on kill (red-orange detonation)
  spawnShockwave(x, y, '#ff5a3a', 90, 0.45);
  // === RAGDOLL LIMBS (Round 2 polish) ===
  // Throw 6 chunky body-part rectangles outward; they bounce off the screen
  // edges (one bounce) and tumble with rotation. Lives ~1.6s.
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 220 + Math.random() * 200;
    const partKind = i % 3;  // 0=ear, 1=paw, 2=body chunk
    ragdollLimbs.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 180,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 14,
      color, kind: partKind,
      life: 1.6, t: 0,
      bounces: 1,  // one bounce off each wall before fade
    });
  }
}
function spawnSpark(x, y) {
  if (sparks.length > 60) return;
  for (let i = 0; i < 4; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 160;
    sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.25, t: 0 });
  }
}
function spawnJet(x, y) {
  if (particles.length > 220) return;
  // v1.8 — richer flame trail: a white-hot core ember plus warm outer puffs.
  // First particle is a tight white core (smaller, faster decay) for that
  // "afterburner crack" reading; rest are warm orange/red puffs.
  // Core ember (hottest)
  particles.push({
    x: x + (Math.random() - 0.5) * 3, y: y + 14,
    vx: (Math.random() - 0.5) * 30, vy: 180 + Math.random() * 60,
    color: '#ffffff',
    life: 0.18 + Math.random() * 0.08, t: 0, size: 2 + Math.random() * 1.5,
  });
  // Warm flame puffs
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const sp = 140 + Math.random() * 140;
    const cols = ['#ffd23f', '#ff8e3c', '#ff5a3a', '#fff1b0'];
    particles.push({
      x: x + (Math.random() - 0.5) * 8, y: y + 14,
      vx: Math.cos(ang) * sp * 0.5, vy: Math.sin(ang) * sp,
      color: cols[Math.floor(Math.random() * cols.length)],
      life: 0.4 + Math.random() * 0.15, t: 0, size: 3 + Math.random() * 4,
    });
  }
  // A wider, dimmer smoke puff that fades slower for depth
  if (Math.random() < 0.5) {
    particles.push({
      x: x + (Math.random() - 0.5) * 14, y: y + 18,
      vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 40,
      color: 'rgba(200,200,210,0.35)',
      life: 0.6 + Math.random() * 0.3, t: 0, size: 5 + Math.random() * 4,
    });
  }
}

function render() {
  // screen-shake offset
  const sx = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  const sy = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  // PWNED slow zoom — ramps from 1.0 → 1.18 over the 0.6s freeze, centered
  // on victim. Applied as scale+translate inside the existing shake save block
  // so the matching ctx.restore() at the bottom of render() unwinds both.
  if (pwnedT > 0 && pwnedVictim) {
    const k = 1 - (pwnedT / 0.6);             // 0 → 1
    const zoom = 1 + 0.18 * k;
    const vx = pwnedVictim.x, vy = pwnedVictim.y;
    ctx.translate(vx, vy);
    ctx.scale(zoom, zoom);
    ctx.translate(-vx, -vy);
  }

  // Stadium floor: warm tone with a parking-lot/stadium grid — arena-tinted
  const floorCol = activeArena === 'gym' ? '#3a3a52' : (activeArena === 'rooftop' ? '#3a4a52' : '#5a3a1c');
  ctx.fillStyle = floorCol; ctx.fillRect(-12, -12, W + 24, H + 24);
  // big tile alternation
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < H; y += 48) for (let x = 0; x < W; x += 48)
    if ((x + y) % 96 === 0) ctx.fillRect(x, y, 48, 48);
  // grid lines (parking-lot feel)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 48) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 48) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  // center circle (stadium midfield)
  ctx.strokeStyle = 'rgba(255,210,63,0.15)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 6); ctx.lineTo(W / 2, H / 2 + 6); ctx.moveTo(W / 2 - 6, H / 2); ctx.lineTo(W / 2 + 6, H / 2); ctx.stroke();
  // Water puddles (drawn under everything else so pugs slide on top)
  for (const pud of puddles) {
    pud.phase += 0.01;
    ctx.save();
    ctx.fillStyle = 'rgba(76,201,240,0.35)';
    ctx.beginPath(); ctx.ellipse(pud.x, pud.y, pud.r, pud.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,230,255,0.55)';
    ctx.beginPath(); ctx.ellipse(pud.x - pud.r * 0.3, pud.y - pud.r * 0.2, pud.r * 0.3, pud.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    // ripple ring
    const rk = (Math.sin(pud.phase * 3) + 1) * 0.5;
    ctx.strokeStyle = `rgba(180,230,255,${0.4 - rk * 0.3})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(pud.x, pud.y, pud.r * (0.5 + rk * 0.4), pud.r * (0.35 + rk * 0.3), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Goal posts at corners (red glowing arches)
  for (const g of goalPosts) {
    ctx.save();
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.004 + (g.x + g.y) * 0.01);
    ctx.shadowColor = '#ff3a3a';
    ctx.shadowBlur = 14 * pulse;
    ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(g.x, g.y, 22, Math.PI, 0); ctx.stroke();
    ctx.shadowBlur = 0;
    // posts
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(g.x - 24, g.y, 4, 16);
    ctx.fillRect(g.x + 20, g.y, 4, 16);
    // net hint
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    for (let i = -20; i <= 20; i += 6) {
      ctx.beginPath(); ctx.moveTo(g.x + i, g.y); ctx.lineTo(g.x + i, g.y + 14); ctx.stroke();
    }
    ctx.restore();
  }
  // Kitchen obstacle props (block movement) — varied art per kind
  for (const o of obstacles) {
    ctx.save();
    // shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(o.x + 2, o.y + o.h - 2, o.w - 2, 4);
    ctx.fillStyle = o.c1;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = o.c2;
    if (o.kind === 'fridge') {
      ctx.fillRect(o.x, o.y, o.w, 4); // top trim
      ctx.fillRect(o.x, o.y + o.h * 0.4, o.w, 3); // door split
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(o.x + o.w - 6, o.y + 8, 3, 8);
      ctx.fillRect(o.x + o.w - 6, o.y + o.h * 0.5, 3, 8);
    } else if (o.kind === 'microwave') {
      ctx.fillRect(o.x + 4, o.y + 6, o.w - 18, o.h - 14); // window
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(o.x + o.w - 10, o.y + 8, 4, 2); // power LED
      ctx.fillStyle = '#fff';
      ctx.fillRect(o.x + o.w - 10, o.y + 14, 6, 2); ctx.fillRect(o.x + o.w - 10, o.y + 18, 6, 2);
    } else if (o.kind === 'sink') {
      ctx.fillRect(o.x + 4, o.y + 6, o.w - 8, o.h - 14); // basin (darker)
      ctx.fillStyle = '#cacad6';
      ctx.fillRect(o.x + o.w / 2 - 4, o.y - 4, 8, 6); // faucet
      ctx.fillRect(o.x + o.w / 2 - 1, o.y - 6, 2, 4);
    } else if (o.kind === 'trash') {
      ctx.fillRect(o.x, o.y - 4, o.w, 4); // lid
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(o.x + 8, o.y + 8, 4, 4); // hole
      ctx.fillStyle = '#5ef38c';
      ctx.fillRect(o.x + 14, o.y + 10, 6, 6); // peeking apple
    } else if (o.kind === 'table') {
      ctx.fillRect(o.x, o.y, o.w, 6); // tabletop
      ctx.fillRect(o.x + 4, o.y + 6, 4, o.h - 6); // legs
      ctx.fillRect(o.x + o.w - 8, o.y + 6, 4, o.h - 6);
    } else if (o.kind === 'icecream') {
      ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 8); // sign
      ctx.fillStyle = '#fff';
      ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('ICE', o.x + o.w / 2, o.y + 10);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h - 8, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // CENTRAL STOVE — strong landmark with 4 flickering burners
  if (stove) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(stove.x + 4, stove.y + stove.h - 4, stove.w - 4, 6);
    // body
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(stove.x, stove.y, stove.w, stove.h);
    // chrome top trim
    ctx.fillStyle = '#cacad6';
    ctx.fillRect(stove.x, stove.y, stove.w, 5);
    ctx.fillRect(stove.x, stove.y + stove.h - 5, stove.w, 5);
    // control knobs (front)
    ctx.fillStyle = '#1a0d05';
    for (let i = 0; i < 4; i++) {
      const kx = stove.x + 16 + i * ((stove.w - 32) / 3);
      ctx.beginPath(); ctx.arc(kx, stove.y + stove.h - 10, 3, 0, Math.PI * 2); ctx.fill();
    }
    // 4 burners with flickering flame
    const tNow = performance.now() * 0.001;
    for (const b of stove.burners) {
      const bx = stove.x + b.dx, by = stove.y + b.dy;
      // burner pan
      ctx.fillStyle = '#1a0d05';
      ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a5a72'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.stroke();
      // flame glow
      const flick = 0.7 + 0.3 * Math.sin(tNow * 12 + b.phase);
      const grad = ctx.createRadialGradient(bx, by, 2, bx, by, 28);
      grad.addColorStop(0, `rgba(255,210,63,${0.9 * flick})`);
      grad.addColorStop(0.5, `rgba(255,90,58,${0.5 * flick})`);
      grad.addColorStop(1, 'rgba(255,90,58,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI * 2); ctx.fill();
      // flame tongues
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(bx - 4, by);
      ctx.lineTo(bx, by - 8 - flick * 6);
      ctx.lineTo(bx + 4, by);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5a3a';
      ctx.beginPath();
      ctx.moveTo(bx - 2, by);
      ctx.lineTo(bx, by - 4 - flick * 3);
      ctx.lineTo(bx + 2, by);
      ctx.closePath(); ctx.fill();
    }
    // hazard ring
    ctx.strokeStyle = 'rgba(255,90,58,0.25)'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(stove.x - 4, stove.y - 4, stove.w + 8, stove.h + 8);
    ctx.setLineDash([]);
    ctx.restore();
  }
  // PEDESTAL — beam of light + glowing dais when ready
  if (pedestal) {
    ctx.save();
    const tNow = performance.now() * 0.001;
    // dais base
    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath(); ctx.ellipse(pedestal.x, pedestal.y + 6, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.ellipse(pedestal.x, pedestal.y + 2, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (pedestal.ready) {
      const col = pedestal.type === 'shield' ? '#4cc9f0' : pedestal.type === 'damage' ? '#ff5a3a' : '#ffd23f';
      // rotating beam (own save/restore so we don't break outer translate)
      ctx.save();
      ctx.translate(pedestal.x, pedestal.y);
      ctx.rotate(tNow * 1.8);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        const grad = ctx.createLinearGradient(0, 0, 0, -130);
        grad.addColorStop(0, col + 'cc');
        grad.addColorStop(1, col + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(4, -130); ctx.lineTo(-4, -130); ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // glowing orb on top
      const pulse = 0.7 + 0.3 * Math.sin(tNow * 6);
      ctx.shadowColor = col; ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(pedestal.x, pedestal.y - 4, 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // label
      ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      const tname = pedestal.type === 'shield' ? 'SHIELD' : pedestal.type === 'damage' ? 'DAMAGE' : 'SPEED';
      ctx.fillText(tname, pedestal.x, pedestal.y + 22);
    } else {
      // recharging indicator (faint ring + countdown spot)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pedestal.x, pedestal.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(pedestal.x - 1, pedestal.y - 8, 2, 2);
    }
    ctx.restore();
  }
  // Arena props (compact)
  for (const tm of treadmills) {
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(tm.x, tm.y, tm.w, tm.h);
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(tm.x, tm.y, tm.w, 4); ctx.fillRect(tm.x, tm.y + tm.h - 4, tm.w, 4);
    const off = (tm.t * 80 * tm.dir) % 20;
    ctx.fillStyle = '#5ef38c';
    for (let bx = -20; bx < tm.w; bx += 20) {
      const ax = tm.x + bx + off, my = tm.y + tm.h / 2;
      ctx.beginPath();
      if (tm.dir > 0) { ctx.moveTo(ax + 4, my - 5); ctx.lineTo(ax + 12, my); ctx.lineTo(ax + 4, my + 5); }
      else { ctx.moveTo(ax + 12, my - 5); ctx.lineTo(ax + 4, my); ctx.lineTo(ax + 12, my + 5); }
      ctx.closePath(); ctx.fill();
    }
  }
  for (const d of dumbbells) {
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(d.x, d.y, 8, d.h); ctx.fillRect(d.x + d.w - 8, d.y, 8, d.h);
    ctx.fillStyle = '#5a5a72'; ctx.fillRect(d.x + 8, d.y + d.h / 2 - 2, d.w - 16, 4);
  }
  for (const a of acUnits) {
    ctx.fillStyle = '#9ec8d8'; ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.fillStyle = '#5a7080';
    for (let yy = a.y + 6; yy < a.y + a.h - 6; yy += 6) ctx.fillRect(a.x + 4, yy, a.w - 8, 2);
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(a.x, a.y, a.w, 3);
  }
  for (const tr of trampolines) {
    const pulse = 1 + (tr.t > 0 ? 0.3 * (tr.t / 0.4) : 0);
    ctx.fillStyle = '#ff3aa1';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(tr.x - 6, tr.y - 1, 12, 2); ctx.fillRect(tr.x - 1, tr.y - 6, 2, 12);
  }
  for (const t of smashTables) {
    if (t.hp <= 0) continue;
    ctx.fillStyle = '#8a5a2c'; ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = '#5a3a1c'; ctx.fillRect(t.x, t.y, t.w, 4);
    ctx.fillStyle = '#ffd23f'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(t.hidden === 'shield' ? '? SHIELD' : '? AMMO', t.x + t.w / 2, t.y + t.h / 2 + 2);
  }
  if (flags.length) {
    for (const fl of flags) {
      if (!fl.holder) {
        ctx.fillStyle = '#5a3a1c'; ctx.fillRect(fl.x - 1, fl.y - 22, 2, 30);
        ctx.fillStyle = '#ff8e3c'; ctx.fillRect(fl.x, fl.y - 22, 22, 12);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(fl.x + 2, fl.y - 20, 18, 4);
      } else {
        // Carrier flag icon (Polish R2): floating golden flag + bright arrow
        // beacon above so all players can spot the carrier instantly.
        ctx.fillStyle = '#ff8e3c'; ctx.fillRect(fl.holder.x - 8, fl.holder.y - 30, 16, 6);
        // Big pulsing arrow above carrier
        const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.012);
        ctx.save();
        ctx.shadowColor = '#ffd23f';
        ctx.shadowBlur = 16 * pulse;
        ctx.fillStyle = '#ffd23f';
        // Triangle pointing down
        ctx.beginPath();
        ctx.moveTo(fl.holder.x, fl.holder.y - 38);
        ctx.lineTo(fl.holder.x - 8, fl.holder.y - 50);
        ctx.lineTo(fl.holder.x + 8, fl.holder.y - 50);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // "FLAG" label
        ctx.fillStyle = '#1a0d05';
        ctx.font = "bold 7px 'Press Start 2P', monospace";
        ctx.textAlign = 'center';
        ctx.fillText('FLAG', fl.holder.x, fl.holder.y - 56);
        ctx.restore();
        // Ring under the carrier so teammates can find them on the floor
        ctx.strokeStyle = `rgba(255,210,63,${pulse * 0.7})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fl.holder.x, fl.holder.y, 26, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(94,243,140,0.12)'; ctx.fillRect(0, H - 100, W, 100);
    ctx.fillStyle = 'rgba(255,90,58,0.12)'; ctx.fillRect(0, 0, W, 100);
    ctx.fillStyle = '#5ef38c'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('YOUR BASE', W / 2, H - 80);
    ctx.fillStyle = '#ff5a3a'; ctx.fillText('BOT BASE', W / 2, 90);
  }
  if (kothZone) {
    // Detect contested state: both player + bot are inside the zone simultaneously
    let teamIn = pug && pug.hp > 0 && Math.hypot(pug.x - kothZone.x, pug.y - kothZone.y) < kothZone.r;
    let botsIn = false;
    for (const b of bots) if (b.hp > 0 && Math.hypot(b.x - kothZone.x, b.y - kothZone.y) < kothZone.r) { botsIn = true; break; }
    const contested = teamIn && botsIn;
    // Polish R2: ring color shifts red when contested; faster pulse + double-ring
    const baseCol = contested ? '#ff3aa1' : '#ffd23f';
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * (contested ? 0.008 : 0.002));
    ctx.strokeStyle = baseCol; ctx.lineWidth = contested ? 4 : 3; ctx.globalAlpha = pulse * 0.8;
    ctx.beginPath(); ctx.arc(kothZone.x, kothZone.y, kothZone.r, 0, Math.PI * 2); ctx.stroke();
    if (contested) {
      // outer expanding pulse ring
      const pr = kothZone.r + (Math.sin(performance.now() * 0.012) * 6) + 8;
      ctx.strokeStyle = '#ff3aa1';
      ctx.lineWidth = 2;
      ctx.globalAlpha = (1 - (pr - kothZone.r) / 14) * 0.6;
      ctx.beginPath(); ctx.arc(kothZone.x, kothZone.y, pr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = contested ? 0.22 : 0.16;
    ctx.fillStyle = baseCol;
    ctx.beginPath(); ctx.arc(kothZone.x, kothZone.y, kothZone.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // CONTESTED label
    if (contested) {
      ctx.fillStyle = '#ff3aa1';
      ctx.font = "bold 10px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('★ CONTESTED ★', kothZone.x, kothZone.y - kothZone.r - 14);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(kothZone.x - 80, kothZone.y + kothZone.r + 8, 160, 8);
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(kothZone.x - 80, kothZone.y + kothZone.r + 8, 80 * (kothMeter.team / 10), 8);
    ctx.fillStyle = '#ff5a3a'; ctx.fillRect(kothZone.x, kothZone.y + kothZone.r + 8, 80 * (kothMeter.bots / 10), 8);
  }
  // Weapon pickups — glowing crate with floating weapon icon
  for (const wp of weaponPickups) {
    const bobY = wp.y + Math.sin(wp.bob) * 4;
    // ground glow
    const glow = ctx.createRadialGradient(wp.x, wp.y + 8, 4, wp.x, wp.y + 8, 38);
    glow.addColorStop(0, wp.weapon.color + 'cc');
    glow.addColorStop(1, wp.weapon.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(wp.x, wp.y + 8, 38, 0, Math.PI * 2); ctx.fill();
    // crate
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(wp.x - 14, wp.y - 4, 28, 18);
    ctx.fillStyle = wp.weapon.color;
    ctx.fillRect(wp.x - 14, wp.y - 4, 28, 2);
    ctx.fillRect(wp.x - 14, wp.y + 12, 28, 2);
    // floating icon
    if (wp.weapon.drawIconFn) wp.weapon.drawIconFn(ctx, wp.x, bobY - 12, 18);
    // label
    ctx.fillStyle = '#fff'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(wp.weapon.name.toUpperCase(), wp.x, wp.y + 26);
  }

  // Stadium walls (chrome rails) at edges
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8);
  ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, H - 8, W, 2);

  // Arena-specific animated background — chefs / gym TV / rooftop skyline+chopper
  if (activeArena === 'kitchen') {
    ctx.fillStyle = 'rgba(255,210,63,0.18)'; ctx.fillRect(W * 0.3, 16, W * 0.4, 16);
    ctx.fillStyle = '#1a0d05';
    for (let i = 0; i < 3; i++) {
      const cx = W * 0.35 + i * W * 0.12, bob = Math.sin(bgChefsT * 2 + i) * 2;
      ctx.fillRect(cx - 4, 17 + bob, 8, 4); ctx.fillRect(cx - 3, 21 + bob, 6, 6);
    }
  } else if (activeArena === 'gym') {
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(W - 110, 12, 90, 50);
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(W - 106, 16, 82, 42);
    const fcx = W - 65; ctx.fillStyle = '#1a0d05';
    ctx.beginPath(); ctx.arc(fcx, 26, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(fcx - 1, 30, 2, 14);
    if (Math.floor(bgChefsT * 2) % 2) { ctx.fillRect(fcx - 10, 34, 8, 2); ctx.fillRect(fcx + 2, 34, 8, 2); }
    else { ctx.fillRect(fcx - 3, 34, 2, 10); ctx.fillRect(fcx + 1, 34, 2, 10); }
  } else if (activeArena === 'rooftop') {
    const off = (chopperT * 8) % 80;
    ctx.fillStyle = '#1a0d2a';
    for (let bx = -80; bx < W + 80; bx += 80) {
      const h = 28 + (Math.abs(((bx + 19) * 7) % 30)), x = bx - off;
      ctx.fillRect(x, 10, 60, h);
    }
    const hx = (W + 100) - (chopperT * 90) % (W + 200), hy = 60 + Math.sin(chopperT * 3) * 6;
    ctx.fillStyle = '#5a5a72'; ctx.fillRect(hx, hy, 20, 6); ctx.fillRect(hx + 14, hy + 2, 8, 4);
    ctx.fillStyle = '#cacad6'; ctx.fillRect(hx - 4, hy - 5, 28, 1);
  }

  // Crowd silhouettes — waving heads (above/below the walls). waveT scales on kill.
  if (crowd.length) {
    const tNow = performance.now() * 0.001;
    for (const c of crowd) {
      const sway = Math.sin(tNow * 1.8 + c.phase) * 2;
      const scale = c.waveT > 0 ? 1.15 : 1;
      if (c.waveT > 0) c.waveT -= 1 / 60;
      ctx.fillStyle = c.c;
      ctx.beginPath();
      ctx.arc(c.x, c.base + sway - (scale - 1) * 4, 5 * scale, 0, Math.PI * 2); ctx.fill();
    }
  }

  // pugs (depth3D drop shadow under each)
  for (const p of _fighters()) {
    if (p.hp <= 0) continue;
    // shadow beneath body — gives the pug weight on the stadium floor
    _depthShadow(ctx, p.x, p.y + 16, 18, { alpha: 0.4 });
    // jetpack thruster particles (player only)
    if (p === pug && pug.jetT > 0) spawnJet(p.x, p.y);
    // buff aura
    const buff = activeBuffs.get(p);
    if (buff) {
      const col = buff.type === 'shield' ? '#4cc9f0' : buff.type === 'damage' ? '#ff5a3a' : '#ffd23f';
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.008);
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 14 * pulse;
      ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // body — high-detail sprite (hit flash via canvas filter)
    if (p.hitFlashT > 0) {
      ctx.save(); ctx.filter = `brightness(${1 + p.hitFlashT * 3})`;
      drawPug(ctx, p.x, p.y, { size: 36, body: p.color, mask: p.mask });
      ctx.filter = 'none'; ctx.restore();
    } else {
      drawPug(ctx, p.x, p.y, { size: 36, body: p.color, mask: p.mask });
    }
    // weapon (custom canvas icon, centered ~22px out along aim)
    if (p.weapon.drawIconFn) {
      p.weapon.drawIconFn(ctx, p.x + Math.cos(p.ang) * 22, p.y + Math.sin(p.ang) * 22, 18);
    }
    // hp bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 18, p.y - 28, 36, 4);
    ctx.fillStyle = p.hp > 50 ? '#5ef38c' : (p.hp > 25 ? '#ffd23f' : '#ff3a3a');
    ctx.fillRect(p.x - 18, p.y - 28, 36 * Math.max(0, p.hp) / p.maxHp, 4);
    // jetpack flame (bigger, glowy) — v1.8: layered cone + flicker tongues
    if (p === pug && pug.jetT > 0) {
      const flick = 1 + 0.25 * Math.sin(performance.now() * 0.04);
      // Outer red glow halo
      const grd = ctx.createRadialGradient(p.x, p.y + 22, 2, p.x, p.y + 22, 22 * flick);
      grd.addColorStop(0, 'rgba(255,210,63,0.9)');
      grd.addColorStop(0.4, 'rgba(255,90,58,0.55)');
      grd.addColorStop(1, 'rgba(255,90,58,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(p.x - 24, p.y + 12, 48, 28);
      // Main flame body (orange cone)
      ctx.fillStyle = '#ff8e3c';
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y + 16);
      ctx.lineTo(p.x + 4, p.y + 16);
      ctx.lineTo(p.x + 2, p.y + 30 * flick);
      ctx.lineTo(p.x - 2, p.y + 30 * flick);
      ctx.closePath(); ctx.fill();
      // Inner yellow flame
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(p.x - 2, p.y + 16);
      ctx.lineTo(p.x + 2, p.y + 16);
      ctx.lineTo(p.x + 1, p.y + 22 * flick);
      ctx.lineTo(p.x - 1, p.y + 22 * flick);
      ctx.closePath(); ctx.fill();
      // White hot core
      ctx.fillStyle = '#fff1b0';
      ctx.fillRect(p.x - 1, p.y + 16, 2, 4);
    }
    // INFINITE-AMMO POWER OUTLET aura (Polish R2)
    if (p === pug && infiniteAmmoT > 0) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.018);
      ctx.save();
      ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 18 * pulse;
      ctx.strokeStyle = `rgba(76,201,240,${pulse})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.stroke();
      // tiny lightning bolts
      for (let i = 0; i < 3; i++) {
        const ang = (performance.now() * 0.004 + i * Math.PI * 2 / 3) % (Math.PI * 2);
        const ex = p.x + Math.cos(ang) * 30;
        const ey = p.y + Math.sin(ang) * 30;
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ex - 2, ey - 4); ctx.lineTo(ex + 1, ey - 1);
        ctx.lineTo(ex - 1, ey + 1); ctx.lineTo(ex + 2, ey + 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  // === ARENA HAZARDS RENDERING (Polish R2) ===
  // Kitchen oven on the left wall + spit fireballs
  if (activeArena === 'kitchen') {
    // Oven cabinet on left wall, ~middle of arena vertically
    const oy = H * 0.5 - 30;
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(0, oy, 22, 60);
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(2, oy + 6, 18, 18);  // window
    // glowing interior
    const ovenFlick = 0.6 + 0.4 * Math.sin(performance.now() * 0.012);
    ctx.fillStyle = `rgba(255,90,58,${0.5 + 0.3 * ovenFlick})`;
    ctx.fillRect(4, oy + 8, 14, 14);
    ctx.fillStyle = `rgba(255,210,63,${0.4 + 0.3 * ovenFlick})`;
    ctx.fillRect(6, oy + 10, 10, 10);
    // chrome trim
    ctx.fillStyle = '#5a5a72';
    ctx.fillRect(0, oy, 22, 3);
    ctx.fillRect(0, oy + 56, 22, 4);
    // ⚠ label
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 6px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.fillText('⚠', 11, oy + 36);
    // Fireball projectiles
    for (const o of kitchenOvenSpit) {
      ctx.save();
      const grad = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, 14);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.4, '#ffd23f');
      grad.addColorStop(1, 'rgba(255,90,58,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(o.x, o.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8e3c';
      ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // Gym swinging punching bag
  if (activeArena === 'gym' && gymBag) {
    const bx = gymBag.x + Math.sin(gymBag.angle) * 30;
    const by = gymBag.y + Math.abs(Math.sin(gymBag.angle)) * 8;
    ctx.save();
    // chain
    ctx.strokeStyle = '#5a5a72'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gymBag.x, gymBag.y - 18); ctx.lineTo(bx, by - 18); ctx.stroke();
    // bag body
    ctx.fillStyle = '#8a3a3a';
    ctx.fillRect(bx - 14, by - 18, 28, 40);
    ctx.fillStyle = '#5a1a1a';
    ctx.fillRect(bx - 14, by + 18, 28, 4);
    ctx.fillRect(bx - 14, by - 18, 28, 3);
    // stripes
    ctx.fillStyle = '#fafaff';
    ctx.fillRect(bx - 14, by - 6, 28, 2);
    ctx.fillRect(bx - 14, by + 6, 28, 2);
    // shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(bx, by + 24, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Rooftop wind gust banner
  if (activeArena === 'rooftop' && rooftopWindBlowing > 0) {
    const wAlpha = Math.min(1, rooftopWindBlowing * 2);
    ctx.save();
    ctx.globalAlpha = wAlpha * 0.4;
    // diagonal wind streaks
    ctx.strokeStyle = rooftopWindDir > 0 ? '#4cc9f0' : '#b0e8ff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const sy = (i / 16) * H + (performance.now() * 0.2) % 40;
      const sx = (performance.now() * 0.6 * rooftopWindDir) % W;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + rooftopWindDir * 36, sy);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Ragdoll limbs (Polish R2) — body parts of dead pugs
  for (const r of ragdollLimbs) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);
    const alpha = Math.max(0, 1 - r.t / r.life);
    ctx.globalAlpha = alpha;
    if (r.kind === 0) {
      // ear — small brown wedge
      ctx.fillStyle = r.color;
      ctx.fillRect(-4, -6, 8, 10);
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(-3, -5, 6, 3);
    } else if (r.kind === 1) {
      // paw — square w/ toes
      ctx.fillStyle = r.color;
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(-4, 4, 2, 2);
      ctx.fillRect(-1, 4, 2, 2);
      ctx.fillRect(2, 4, 2, 2);
    } else {
      // body chunk — bigger rectangle
      ctx.fillStyle = r.color;
      ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(-7, -5, 14, 2);
    }
    ctx.restore();
  }
  // Goal-parade golden bread loaves (Polish R2)
  for (const g of goalParade) {
    const alpha = Math.max(0, 1 - g.t / g.life);
    ctx.save();
    ctx.globalAlpha = alpha;
    // little loaf
    ctx.fillStyle = g.color;
    ctx.fillRect(g.x - 6, g.y - 5, 12, 10);
    ctx.fillStyle = '#8a5a2c';
    ctx.fillRect(g.x - 6, g.y + 3, 12, 2);
    // diagonal score lines
    ctx.strokeStyle = '#8a5a2c'; ctx.lineWidth = 1;
    for (let s = -3; s <= 3; s += 3) {
      ctx.beginPath(); ctx.moveTo(g.x + s, g.y - 5); ctx.lineTo(g.x + s + 2, g.y); ctx.stroke();
    }
    ctx.restore();
  }
  // EXPLOSION RADIUS INDICATOR (Polish R2)
  // When the player holds fire with the BFG, show a faint ring at the impact
  // point ahead of them so they can aim the splash. Lasts as long as firing.
  if (running && pug && pug.hp > 0 && pug.weapon && pug.weapon.id === 'bfg' && firing) {
    const range = 220;
    const ex = pug.x + Math.cos(pug.ang) * range;
    const ey = pug.y + Math.sin(pug.ang) * range;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
    ctx.save();
    ctx.strokeStyle = `rgba(255,58,161,${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(ex, ey, 32, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // crosshair
    ctx.strokeStyle = `rgba(255,58,161,${pulse})`;
    ctx.beginPath(); ctx.moveTo(ex - 6, ey); ctx.lineTo(ex + 6, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, ey - 6); ctx.lineTo(ex, ey + 6); ctx.stroke();
    ctx.restore();
  }
  // Projectiles
  for (const pr of projectiles) {
    if (pr.shape === 'ball') {
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
    } else if (pr.shape === 'sausage') {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang);
      ctx.fillStyle = pr.color; ctx.fillRect(-10, -3, 20, 6);
      ctx.restore();
    } else if (pr.shape === 'toast') {
      ctx.fillStyle = pr.color; ctx.fillRect(pr.x - 6, pr.y - 8, 12, 16);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(pr.x - 6, pr.y - 8, 12, 2);
      ctx.fillRect(pr.x - 6, pr.y + 6, 12, 2);
    } else if (pr.shape === 'bubble') {
      ctx.strokeStyle = pr.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,0.3)`;
      ctx.beginPath(); ctx.arc(pr.x - 3, pr.y - 3, 2, 0, Math.PI * 2); ctx.fill();
    } else if (pr.shape === 'bfg') {
      const pulse = 0.8 + 0.2 * Math.sin(performance.now() * 0.005);
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 14 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(pr.x - 3, pr.y - 3, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Sparks (wall hits)
  for (const s of sparks) {
    const a = 1 - s.t / s.life;
    ctx.strokeStyle = `rgba(255,210,63,${a})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke();
  }
  // Round 2C: ring shockwaves (kills + heavy hits) — expand outward, fade
  for (const sw of shockwaves) {
    const k = sw.t / sw.life;
    const r = sw.maxR * k;
    const a = (1 - k) * 0.75;
    ctx.save();
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = Math.max(1, 3 * (1 - k));
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2); ctx.stroke();
    // inner ring for depth
    ctx.lineWidth = Math.max(1, 1.5 * (1 - k));
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Particles
  for (const p of particles) {
    ctx.globalAlpha = 1 - (p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  // Score popups
  for (const p of popups) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  // Aim line for player
  if (running && pug.hp > 0) {
    ctx.strokeStyle = 'rgba(255,210,63,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(pug.x, pug.y); ctx.lineTo(pug.x + Math.cos(pug.ang) * 200, pug.y + Math.sin(pug.ang) * 200); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Spectator banner — Polish R2: clearer "YOU → BOT #N" indicator + arrow
  if (spectatorIdx >= 0 && pug.hp <= 0) {
    const tg = bots[spectatorIdx];
    if (tg && tg.hp > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
      ctx.strokeStyle = `rgba(255,210,63,${pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(tg.x, tg.y, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd23f';
      ctx.font = "8px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillText(`YOU → BOT #${spectatorIdx + 1}`, tg.x, tg.y - 50);
      ctx.fillStyle = '#fff';
      ctx.font = "6px 'Press Start 2P', monospace";
      ctx.fillText('◀ ▶ swap', tg.x, tg.y - 38);
      // big arrow above the spectated bot
      ctx.save();
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12 * pulse;
      ctx.beginPath();
      ctx.moveTo(tg.x, tg.y - 26);
      ctx.lineTo(tg.x - 6, tg.y - 32);
      ctx.lineTo(tg.x + 6, tg.y - 32);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Hit vignette when player just got hit
  if (lastHitT > 0) {
    const a = (lastHitT / 0.25) * 0.35;
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, 'rgba(255,58,58,0)');
    grad.addColorStop(1, `rgba(255,58,58,${a})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  // Combo banner
  if (comboBannerT > 0 && comboN >= 2) {
    const a = Math.min(1, comboBannerT / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 22px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('x' + comboN + ' COMBO!', W / 2, 70);
    ctx.globalAlpha = 1;
  }
  // Mode score banner (CTF/KOTH) + series pips
  if (activeMode === 'ctf') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - 90, 24, 180, 22);
    ctx.fillStyle = '#5ef38c'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(`YOU ${teamScore} : ${botScore} BOTS`, W / 2, 38);
  } else if (activeMode === 'koth') {
    ctx.fillStyle = '#ffd23f'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('KING OF THE TOPPING · HOLD CENTER 10s', W / 2, 18);
  }
  if (seriesRound > 1 || seriesTeam > 0 || seriesBots > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, H - 30, 168, 22);
    ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`ROUND ${seriesRound}/${seriesLen}`, 14, H - 16);
    ctx.fillStyle = '#5ef38c'; ctx.fillText(`YOU ${seriesTeam}`, 80, H - 16);
    ctx.fillStyle = '#ff5a3a'; ctx.fillText(`BOTS ${seriesBots}`, 130, H - 16);
  }
  // MINIMAP — top-right corner overview of all pugs + flags/koth zone
  drawMinimap();
  ctx.restore();
  // PWNED freeze-frame banner — screen-space, drawn after restore so the
  // big yellow text doesn't get scaled with the world zoom.
  if (pwnedT > 0 && pwnedVictim) {
    const k = 1 - (pwnedT / 0.6);
    // dim flash that punches the screen at the moment of kill
    ctx.fillStyle = `rgba(0,0,0,${0.35 - k * 0.25})`;
    ctx.fillRect(0, 0, W, H);
    // banner sized big with subtle pop-in
    const popK = Math.min(1, k * 3);              // 0→1 quickly
    const size = 64 * (0.7 + popK * 0.35);
    ctx.save();
    ctx.font = `bold ${Math.round(size)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    const cx = W / 2, cy = H / 2 - 20;
    // black thick stroke first for legibility
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a0d05';
    ctx.strokeText('PWNED!', cx, cy);
    // yellow fill with glow
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 18 + popK * 14;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('PWNED!', cx, cy);
    ctx.shadowBlur = 0;
    // small "killer" subline (skip if killed by arena/hazard with no shooter)
    ctx.font = "bold 12px 'Press Start 2P', monospace";
    ctx.fillStyle = '#fff';
    ctx.fillText('▼ ELIMINATED ▼', cx, cy + 36);
    ctx.restore();
  }
}

const _hudEls = {
  hp: document.getElementById('hud-hp'),
  hud: document.getElementById('hud'),
  kills: document.getElementById('hud-kills'),
  left: document.getElementById('hud-left'),
  weapon: document.getElementById('hud-weapon'),
  weaponDesc: document.getElementById('hud-weapon-desc'),
  jet: document.getElementById('hud-jet'),
  best: document.getElementById('hud-best'),
};
let _hudPrev = { hp: -1, kills: -1, left: -1, weapon: '', jet: '', best: -1, pulse: false };
let _hudBestCache = -1, _hudBestCacheT = 0;
function updateHud() {
  const hpV = Math.max(0, Math.ceil(pug.hp));
  if (hpV !== _hudPrev.hp) { _hudEls.hp.textContent = hpV; _hudPrev.hp = hpV; }
  // low-HP pulse — needs continuous update because of sin() animation.
  const pulseOn = pug.hp <= 25 && pug.hp > 0;
  if (pulseOn) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.012);
    _hudEls.hud.style.filter = `drop-shadow(0 0 ${6 + pulse * 8}px rgba(255,58,58,${0.4 + pulse * 0.4}))`;
  } else if (_hudPrev.pulse) {
    _hudEls.hud.style.filter = '';
  }
  _hudPrev.pulse = pulseOn;
  if (kills !== _hudPrev.kills) { _hudEls.kills.textContent = kills; _hudPrev.kills = kills; }
  let aliveBots = 0;
  for (const b of bots) if (b.hp > 0) aliveBots++;
  if (aliveBots !== _hudPrev.left) { _hudEls.left.textContent = aliveBots; _hudPrev.left = aliveBots; }
  const wn = pug.weapon.name.toUpperCase();
  if (wn !== _hudPrev.weapon) {
    _hudEls.weapon.textContent = wn; _hudPrev.weapon = wn;
    if (_hudEls.weaponDesc) _hudEls.weaponDesc.textContent = pug.weapon.desc || '';
  }
  const jt = pug.jetCd > 0 ? pug.jetCd.toFixed(1) + 's' : 'READY';
  if (jt !== _hudPrev.jet) { _hudEls.jet.textContent = jt; _hudPrev.jet = jt; }
  // loadBest hits localStorage — cache for 2s, it never changes mid-match anyway.
  const now = performance.now();
  if (now - _hudBestCacheT > 2000) {
    const best = loadBest('rocket-pug');
    _hudBestCache = best ? best.kills : 0;
    _hudBestCacheT = now;
  }
  if (_hudBestCache !== _hudPrev.best) {
    _hudEls.best.textContent = _hudBestCache;
    _hudPrev.best = _hudBestCache;
  }
}

function end(won) {
  running = false;
  if (won) seriesTeam++; else seriesBots++;
  const target = getSeriesTarget();
  const seriesEnded = seriesTeam >= target || seriesBots >= target || seriesRound >= seriesLen;
  if (!seriesEnded) seriesRound++;
  if (seriesEnded) {
    const p = _loadSkillProfile();
    p.results.push(seriesTeam > seriesBots ? 1 : 0);
    while (p.results.length > 10) p.results.shift();
    _saveSkillProfile(p); try { _refreshRank(); } catch {}
  }
  document.getElementById('end-title').textContent = won ? (activeMode === 'dm' ? 'LAST PUG STANDING' : 'ROUND WON') : 'YOU GOT TOASTED';
  document.getElementById('end-sub').textContent = seriesEnded
    ? (seriesTeam > seriesBots ? `SERIES WIN ${seriesTeam}-${seriesBots}!` : `SERIES LOST ${seriesTeam}-${seriesBots}.`)
    : `Series ${seriesTeam}-${seriesBots} (Round ${seriesRound - 1})`;
  document.getElementById('end-kills').textContent = kills;
  const acc = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  const matchSec = Math.round((performance.now() - matchStartT) / 1000);
  const ex = document.getElementById('end-stats-extra');
  if (ex) ex.innerHTML = `Accuracy <b>${acc}%</b> · Streak <b>${longestStreak}</b> · Time <b>${matchSec}s</b>`;
  const { isNewBest, current } = submitRun('rocket-pug', { score: kills, kills, won });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { kills };
    bestEl.innerHTML = `Best: <b>${b.kills} kills</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  try {
    showGradeCard({
      title: won ? 'LAST PUG STANDING' : 'KITCHEN CLOSED',
      subtitle: `${kills} kill${kills === 1 ? '' : 's'} · ${won ? 'VICTORY' : 'DEFEAT'}`,
      stats: [
        { label: 'Kills', value: Math.min(100, kills / 8 * 100), weight: 0.55 },
        { label: 'Victory', value: won ? 100 : 0, weight: 0.3 },
        { label: 'Survival', value: Math.max(0, Math.min(100, pug.hp / 100 * 100)), weight: 0.15 },
      ],
      breakdown: [
        { label: 'Kills', value: kills, max: 8 },
        { label: 'Won match', value: won ? 1 : 0, max: 1 },
        { label: 'HP remaining', value: Math.max(0, Math.round(pug.hp)), max: 100 },
      ],
      onRestart: () => start(),
    });
  } catch {}
  // Polish R2: end-of-match highlight reel — shows the best kill from this
  // match as a small replay card inside the end overlay (5-second loop).
  try { showHighlightReel(); } catch (e) { /* */ }
}
// Render a small "best kill" replay panel inside the end overlay. Replays the
// shot 3 times over 5 seconds with a moving projectile + impact flash.
function showHighlightReel() {
  if (!lastBestKill) return;
  const ov = document.getElementById('end-overlay');
  if (!ov) return;
  const panel = ov.querySelector('.overlay__panel');
  if (!panel) return;
  // Remove any prior reel
  const old = panel.querySelector('.rp-highlight');
  if (old) old.remove();
  const reel = document.createElement('div');
  reel.className = 'rp-highlight';
  reel.style.cssText = 'margin:10px auto;width:260px;height:120px;border:2px solid #ffd23f;border-radius:6px;background:rgba(0,0,0,0.6);position:relative;overflow:hidden;';
  reel.innerHTML = `
    <div style="position:absolute;top:4px;left:6px;color:#ffd23f;font-size:0.42rem;letter-spacing:0.08em;">★ BEST KILL — ${lastBestKill.weapon}</div>
    <canvas width="260" height="120" style="display:block;"></canvas>
  `;
  panel.insertBefore(reel, panel.querySelector('.wg-end-buttons') || panel.lastChild);
  const c = reel.querySelector('canvas');
  const ctx2 = c.getContext('2d');
  let t = 0;
  const DUR = 5.0;
  const SHOT = 1.3;  // 1.3s per shot replay, loops ~3 times in 5s
  // Scale source coords (W/H) to canvas 260x120
  const sx = (x) => (x / W) * 260;
  const sy = (y) => (y / H) * 120;
  function frame() {
    t += 1 / 60;
    if (t >= DUR) { reel.remove(); return; }
    const loopT = t % SHOT;
    const k = loopT / SHOT;
    ctx2.fillStyle = 'rgba(20,12,40,0.5)';
    ctx2.fillRect(0, 0, 260, 120);
    // killer pug (yellow square)
    ctx2.fillStyle = '#ffd23f';
    ctx2.fillRect(sx(lastBestKill.killerX) - 3, sy(lastBestKill.killerY) - 3, 6, 6);
    // victim pug (red square)
    ctx2.fillStyle = lastBestKill.victimColor;
    ctx2.fillRect(sx(lastBestKill.victimX) - 3, sy(lastBestKill.victimX) - 3, 6, 6);
    ctx2.fillRect(sx(lastBestKill.victimX) - 3, sy(lastBestKill.victimY) - 3, 6, 6);
    // projectile traveling killer → victim
    const px = sx(lastBestKill.killerX) + (sx(lastBestKill.victimX) - sx(lastBestKill.killerX)) * k;
    const py = sy(lastBestKill.killerY) + (sy(lastBestKill.victimY) - sy(lastBestKill.killerY)) * k;
    ctx2.fillStyle = '#fff';
    ctx2.beginPath(); ctx2.arc(px, py, 2.5, 0, Math.PI * 2); ctx2.fill();
    // impact ring near the end
    if (k > 0.85) {
      const ka = (k - 0.85) / 0.15;
      ctx2.strokeStyle = `rgba(255,90,58,${1 - ka})`;
      ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.arc(sx(lastBestKill.victimX), sy(lastBestKill.victimY), 6 + ka * 16, 0, Math.PI * 2);
      ctx2.stroke();
    }
    requestAnimationFrame(frame);
  }
  frame();
}

// Wave 1D: arena/mode/perk pickers + skill rank
for (const id of ['pick-arena', 'pick-mode', 'pick-perk']) {
  const row = document.getElementById(id);
  if (!row) continue;
  row.addEventListener('click', (e) => {
    const btn = e.target.closest('.pchip');
    if (!btn) return;
    for (const b of row.querySelectorAll('.pchip')) b.classList.remove('is-on');
    btn.classList.add('is-on');
    if (id === 'pick-arena') activeArena = btn.dataset.v;
    else if (id === 'pick-mode') activeMode = btn.dataset.v;
    else activePerkId = btn.dataset.v;
  });
}

// Polish R2: Match settings (rounds / time limit / score limit / aim assist)
// Injected into the start overlay panel. Choices saved to localStorage so they
// persist across reloads.
(function _r2MatchSettings() {
  const ov = document.getElementById('overlay');
  const panel = ov && ov.querySelector('.overlay__panel');
  if (!panel) return;
  const startBtn = document.getElementById('start-btn');
  const div = document.createElement('div');
  div.className = 'r2-match-settings';
  div.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0;font-size:0.45rem;';
  div.innerHTML = `
    <label style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <span style="color:var(--neon-cyan)">SERIES</span>
      <select id="r2-rounds" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 5px;font-family:var(--font-display);font-size:0.5rem;">
        <option value="3">BO 3</option>
        <option value="5" selected>BO 5</option>
        <option value="7">BO 7</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <span style="color:var(--neon-cyan)">TIME LIMIT</span>
      <select id="r2-time" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 5px;font-family:var(--font-display);font-size:0.5rem;">
        <option value="0" selected>NONE</option>
        <option value="60">60s</option>
        <option value="120">2m</option>
        <option value="180">3m</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <span style="color:var(--neon-cyan)">SCORE LIMIT</span>
      <select id="r2-score" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 5px;font-family:var(--font-display);font-size:0.5rem;">
        <option value="0" selected>OFF</option>
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="15">15</option>
      </select>
    </label>
    <label style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <span style="color:var(--neon-cyan)">AIM ASSIST</span>
      <select id="r2-aim-assist" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 5px;font-family:var(--font-display);font-size:0.5rem;">
        <option value="0" selected>OFF</option>
        <option value="1">ON (SUBTLE)</option>
      </select>
    </label>
  `;
  // Place before the start button
  if (startBtn) panel.insertBefore(div, startBtn);
  else panel.appendChild(div);
  const rs = document.getElementById('r2-rounds');
  const tm = document.getElementById('r2-time');
  const sc = document.getElementById('r2-score');
  const aa = document.getElementById('r2-aim-assist');
  rs.value = localStorage.getItem('rocket:rounds') || '5';
  tm.value = localStorage.getItem('rocket:time-limit') || '0';
  sc.value = localStorage.getItem('rocket:score-limit') || '0';
  aa.value = localStorage.getItem('wg:rp-aim-assist') || '0';
  rs.addEventListener('change', () => localStorage.setItem('rocket:rounds', rs.value));
  tm.addEventListener('change', () => {
    localStorage.setItem('rocket:time-limit', tm.value);
    mSettingsTimeLimit = parseInt(tm.value, 10) || 0;
  });
  sc.addEventListener('change', () => {
    localStorage.setItem('rocket:score-limit', sc.value);
    mSettingsScoreLimit = parseInt(sc.value, 10) || 0;
  });
  aa.addEventListener('change', () => localStorage.setItem('wg:rp-aim-assist', aa.value));
  // Apply persisted values on load
  mSettingsTimeLimit = parseInt(tm.value, 10) || 0;
  mSettingsScoreLimit = parseInt(sc.value, 10) || 0;
})();
function _loadSkillProfile() { try { return JSON.parse(localStorage.getItem('rocket:skillProfile')) || { results: [] }; } catch { return { results: [] }; } }
function _saveSkillProfile(p) { try { localStorage.setItem('rocket:skillProfile', JSON.stringify(p)); } catch {} }
function _refreshRank() {
  const el = document.getElementById('rank-display');
  if (!el) return;
  const p = _loadSkillProfile(), n = p.results.length;
  const wr = n ? p.results.reduce((a, b) => a + b, 0) / n : 0;
  const r = n < 3 ? { name: 'UNRANKED', col: '#cacacf' } : (wr >= 0.7 ? { name: 'GOLD', col: '#ffd23f' } : (wr >= 0.4 ? { name: 'SILVER', col: '#cacad6' } : { name: 'BRONZE', col: '#c87a4a' }));
  el.hidden = false; el.style.color = r.col;
  el.innerHTML = `★ RANK: <b>${r.name}</b> · ${n}/10 matches`;
}
_refreshRank();
document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  // If the series is over (or hasn't begun), start a fresh series; otherwise
  // continue into the next round with the existing seriesRound count.
  const startOv = document.getElementById('overlay');
  const startVisible = startOv && !startOv.hidden && !startOv.classList.contains('is-hidden');
  if (startVisible) {
    seriesRound = 1; seriesTeam = 0; seriesBots = 0;
    // Polish R2: Apply match-settings overrides from the picker.
    seriesLen = parseInt(localStorage.getItem('rocket:rounds') || '5', 10);
    if (![3, 5, 7].includes(seriesLen)) seriesLen = 5;
    mSettingsTimeLimit = parseInt(localStorage.getItem('rocket:time-limit') || '0', 10);
    mSettingsScoreLimit = parseInt(localStorage.getItem('rocket:score-limit') || '0', 10);
  }
  const target = getSeriesTarget();
  if (seriesTeam >= target || seriesBots >= target || seriesRound > seriesLen) {
    seriesRound = 1; seriesTeam = 0; seriesBots = 0;
  }
  reset(); running = true;
  firing = false; // safety: don't auto-fire if mouse was held during restart click
  keys.clear();   // wipe any stuck keys from prior match
  // Wipe stale kill-feed lines from a previous match so they don't bleed into
  // the new round (otherwise the ticker shows "you killed X" from last run).
  try { __rocketFeed.clear(); } catch (e) { /* */ }
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
  try { music.setIntensity(0.6); music.play(); } catch {}
}
(function _wireRocketMusicEnd() {
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

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD move · MOUSE aim · CLICK fire · SPACE = jetpack burst', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Jetpack burst (SPACE) breaks line-of-sight.',
    'TIP: Different weapons suit different ranges.',
    'TIP: Bubble shield protects briefly — time it well.',
    'TIP: Last pug standing wins.',
    'LORE: The Kitchen Arena was built for retired strays.',
    'JOKE: Why do pugs love tennis balls? Pure muscle memory.',
  ];
  const GAME_ID = 'rocket-pug';
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
        if (best && (best.kills || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.kills || best.score || 0} kills${best.won ? ' · WON' : ''}`;
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
      const k = document.getElementById('end-kills')?.textContent || '0';
      const text = `🐶 ROCKET PUG ARENA — ${k} kills! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'ROCKET PUG ARENA', text, url: 'https://leobalkind.github.io/web-games/' });
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
