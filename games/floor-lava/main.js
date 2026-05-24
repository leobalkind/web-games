// FLOOR IS LAVA: PUG ESCAPE — endless vertical climber.
// Random platforms scroll downward. Lava rises. Pug auto-falls (gravity).
// Double-jump. Treats give score.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';
import { drawShadow as _depthShadow, isReducedMotion as _depthReduced } from '../../src/shared/depth3D.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'lava:muted' });
// Frantic arcade — tempo ramps with altitude.
const music = createMusicTrack({ mood: 'arcade', tempo: 160, key: 'C', scale: 'minor' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'floor-lava', getControlsHelp: () => _isTouch
  ? 'TILT/TAP LEFT-RIGHT to move · TAP JUMP to leap · double-tap = double-jump · Saved to your profile.'
  : 'A/D move · SPACE jump · avoid SPIKES on platforms · grab WINGS for triple-jump. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const GRAV = 1400;
const JUMP_V = -680;
let pug, plats, treats, powerups, blobs, lavaY, height, maxHeight, score, treatsGot, running, lastPlatY;
let jetpackT = 0, freezeT = 0, shrinkT = 0, wingsT = 0;
// Juice + visual layers
let embers = [];      // {x,y,vx,vy,life,max,r}
let lavaBubbles = []; // {x,y,r,life,max}
let popups = [];      // {x,y,vy,life,max,text,color}
let banner = null;    // {text,life,max}
let nextMilestone = 5;
let hitFlashT = 0;
let shakeT = 0, shakeMag = 0;
let caveOffset = 0;   // background parallax y scroll
// Map decor — stalactites/stalagmites + strata bands stored as world-y arrays
let caveSpikes = [];  // {x, y, side: 'top'|'bot'|'left'|'right', h}
let strataBands = []; // {y, color}
// === Doodle Jump-style enemy variety (scales with height) ===
let bats = [];        // {x, y, vx, baseY, ampT, alive} — fly horizontally crossing the play area, can be jumped on
let fireballs = [];   // {x, y, vx, vy, life, max} — spawn from screen edges, traverse the play area
let batSpawnT = 4;    // seconds until next bat spawn
let fireSpawnT = 6;   // seconds until next fireball spawn
// === Icy Tower combo-jumps ===
let lastPlat = null;  // platform reference last landed on (so re-landing same plat doesn't count)
let comboJumps = 0;   // consecutive distinct-platform landings without resting
let comboRestT = 0;   // seconds spent stationary on the SAME platform (resets combo after 0.7s)
// === Geometry Dash biome-shift checkpoints (every 500m) ===
// Round 2: 5 palettes — cave-grey, magma-orange, ABYSS (deep blue), hellscape-red, voidspace.
const BIOMES = [
  { name: 'CAVE',      sky0: '#0a0716', sky1: '#3a1a14', stratoR: 40, stratoG: 20, stratoB: 20, glow: '180,30,20', rockA: 'rgba(60,18,18,0.55)',  rockB: 'rgba(90,30,20,0.6)',  lava0: '#ff8e3c', lava1: '#ff3a3a', lava2: '#7a0a0a' },
  { name: 'MAGMA',     sky0: '#1a0510', sky1: '#5a2010', stratoR: 80, stratoG: 30, stratoB: 12, glow: '230,90,30',  rockA: 'rgba(90,30,12,0.6)',   rockB: 'rgba(130,50,20,0.62)', lava0: '#ffb04a', lava1: '#ff5a3a', lava2: '#8a1a08' },
  // ABYSS — eerie deep-blue/black inserted between MAGMA and HELLSCAPE. Background features floating eyes.
  { name: 'ABYSS',     sky0: '#020410', sky1: '#0a1830', stratoR: 18, stratoG: 30, stratoB: 70, glow: '60,130,220',  rockA: 'rgba(14,22,50,0.6)',   rockB: 'rgba(20,40,80,0.62)',  lava0: '#9adfff', lava1: '#3a7ad6', lava2: '#08163a' },
  { name: 'HELLSCAPE', sky0: '#1a0008', sky1: '#6a0810', stratoR: 130, stratoG: 18, stratoB: 22, glow: '255,40,40', rockA: 'rgba(120,16,18,0.62)', rockB: 'rgba(160,30,20,0.65)', lava0: '#ffd66a', lava1: '#ff2020', lava2: '#400000' },
  // VOIDSPACE — purple/black cosmic biome with low gravity + meteor showers.
  // Triggered above 2500m. Anti-gravity sections + falling meteors as hazards.
  { name: 'VOIDSPACE', sky0: '#04000f', sky1: '#1a0030', stratoR: 60, stratoG: 30, stratoB: 90, glow: '160,100,255', rockA: 'rgba(40,20,80,0.6)', rockB: 'rgba(60,30,100,0.6)', lava0: '#ff8aff', lava1: '#b055ff', lava2: '#2a0040' },
];
// VOIDSPACE altitude — biome 3 unlocks at 1500m (so it falls within "biome 4 unlocks > 2000m" feel after the standard 500m gates: 500, 1000, 1500).
// We adjust the player perception via comments below.
// Game modes: ENDLESS / CHALLENGE / TIME_ATTACK / DEATH_RUN
let gameMode = 'endless';
let challengeTarget = 1000; // CHALLENGE altitude target
let timeAttackT = 0;         // TIME_ATTACK seconds elapsed
let deathRunHasDied = false; // DEATH_RUN: instant-game-over flag (1 life, no powerups)
// Daily seed
function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
let useDailySeed = false, _rngState = 0;
function dailyRand() {
  if (!useDailySeed) return Math.random();
  _rngState = (_rngState * 1664525 + 1013904223) & 0x7fffffff;
  return _rngState / 0x7fffffff;
}
let rocketBootT = 0;
let petBird = null;
let usePetBird = true;
try { usePetBird = localStorage.getItem('lava:pet') !== '0'; } catch {}
let iceDrops = [], fallingDebris = [], haunts = [], meteors = [];
let iceFrozenT = new WeakMap();
let unlockedPowerups = { jetpack: true, freeze: true, shrink: true, wings: true, shield: false, doubleJumpExtra: false, slowMo: false, multiplier: false };
try { const u = JSON.parse(localStorage.getItem('lava:unlocks') || '{}'); Object.assign(unlockedPowerups, u || {}); } catch {}
function saveUnlocks() { try { localStorage.setItem('lava:unlocks', JSON.stringify(unlockedPowerups)); } catch {} }
let pugOutfit = 'classic';
try { pugOutfit = localStorage.getItem('lava:outfit') || 'classic'; } catch {}
const saveOutfit = () => { try { localStorage.setItem('lava:outfit', pugOutfit); } catch {} };
let shieldT = 0, doubleJumpExtraT = 0, slowMoT = 0, multiplierT = 0;
let bestAltitudeLineY = null, bestAltitudeM = 0;
try { bestAltitudeM = parseInt(localStorage.getItem('lava:bestAlt') || '0', 10) || 0; } catch {}
function saveBestAlt() { try { localStorage.setItem('lava:bestAlt', String(bestAltitudeM)); } catch {} }
// === Round 2: Achievement system (5 achievements) ===
const ACHIEVEMENTS = [
  { id: 'km_club',           name: '1KM CLUB',           desc: 'Reach 1000m altitude' },
  { id: 'perfect_biome',     name: 'PERFECT BIOME',      desc: 'Clear a biome with no damage' },
  { id: 'combo_master',      name: 'COMBO MASTER',       desc: 'Hit a 20+ landing combo' },
  { id: 'powerup_collector', name: 'POWERUP COLLECTOR',  desc: 'Grab 5 powerups in one run' },
  { id: 'speedrunner',       name: 'SPEEDRUNNER',        desc: 'Reach 500m in under 30 sec' },
];
let achievementsUnlocked = {};
try { achievementsUnlocked = JSON.parse(localStorage.getItem('lava:achievements') || '{}') || {}; } catch {}
function saveAchievements() { try { localStorage.setItem('lava:achievements', JSON.stringify(achievementsUnlocked)); } catch {} }
function unlockAchievement(id) {
  if (achievementsUnlocked[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id); if (!a) return;
  achievementsUnlocked[id] = Date.now(); saveAchievements();
  toasts_push(`★ ACHIEVEMENT: ${a.name}`);
  try { sfx.arp([659, 880, 1175, 1568], 'triangle', 0.07, 0.22, 0.28); } catch {}
}
let runStartT = 0, runPowerupsGrabbed = 0, biomeStartDamage = false;
// === Round 2: WIND CURRENTS — drift zones that push the player ===
let windCurrents = [];
let windSpawnT = 5;
// === Round 2: TELEPORTER global cooldown ===
let teleportCooldownT = 0;
// === Round 2: Pause + resume countdown ===
let paused = false;
let resumeCountdownT = 0;
// === Round 2: Pug visual animation state ===
let pugBobT = 0, pugSquashT = 0, pugStretchT = 0, lastWasOnGround = false;
let biomeIdx = 0;            // currently fully-applied biome index
let nextBiomeAtHeight = 500; // height in m at which the next shift starts
let biomeShiftT = 0;         // seconds remaining in active 2s shift transition
let biomeShiftTarget = 0;    // target biome index during a shift
// Returns the live (possibly mid-transition) biome palette used by render().
function getBiomePalette() {
  const from = BIOMES[biomeIdx];
  if (biomeShiftT <= 0) return from;
  const to = BIOMES[biomeShiftTarget];
  // 2s transition; biomeShiftT counts down from 2 to 0.
  const k = Math.max(0, Math.min(1, 1 - biomeShiftT / 2));
  // Linear blend HEX/RGB-channel colors; we keep things simple by returning
  // strings so render() can use them as fillStyle / gradient stops directly.
  const blendHex = (a, b) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 0xff) * (1 - k) + ((pb >> 16) & 0xff) * k);
    const g = Math.round(((pa >> 8) & 0xff) * (1 - k) + ((pb >> 8) & 0xff) * k);
    const bl = Math.round((pa & 0xff) * (1 - k) + (pb & 0xff) * k);
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
  };
  const blendRgbStr = (a, b) => {
    const pa = a.split(',').map(Number), pb = b.split(',').map(Number);
    return `${Math.round(pa[0] * (1 - k) + pb[0] * k)},${Math.round(pa[1] * (1 - k) + pb[1] * k)},${Math.round(pa[2] * (1 - k) + pb[2] * k)}`;
  };
  return {
    name: to.name,
    sky0: blendHex(from.sky0, to.sky0),
    sky1: blendHex(from.sky1, to.sky1),
    stratoR: Math.round(from.stratoR * (1 - k) + to.stratoR * k),
    stratoG: Math.round(from.stratoG * (1 - k) + to.stratoG * k),
    stratoB: Math.round(from.stratoB * (1 - k) + to.stratoB * k),
    glow: blendRgbStr(from.glow, to.glow),
    rockA: from.rockA, // hold these constant during transition — color is in sky+lava
    rockB: from.rockB,
    lava0: blendHex(from.lava0, to.lava0),
    lava1: blendHex(from.lava1, to.lava1),
    lava2: blendHex(from.lava2, to.lava2),
  };
}
function reset() {
  // Initialize daily seed if enabled
  if (useDailySeed) _rngState = getDailySeed();
  pug = { x: W / 2, y: H - 200, vx: 0, vy: 0, onGround: false, jumpsLeft: 2, w: 22, h: 22 };
  plats = []; treats = []; powerups = []; blobs = [];
  embers = []; lavaBubbles = []; popups = []; banner = null;
  caveSpikes = []; strataBands = [];
  bats = []; fireballs = [];
  iceDrops = []; fallingDebris = []; haunts = []; meteors = [];
  iceFrozenT = new WeakMap();
  batSpawnT = 4; fireSpawnT = 6;
  windCurrents = []; windSpawnT = 5; teleportCooldownT = 0;
  paused = false; resumeCountdownT = 0;
  pugBobT = 0; pugSquashT = 0; pugStretchT = 0; lastWasOnGround = false;
  runStartT = performance.now(); runPowerupsGrabbed = 0; biomeStartDamage = false;
  lastPlat = null; comboJumps = 0; comboRestT = 0;
  biomeIdx = 0; nextBiomeAtHeight = 500; biomeShiftT = 0; biomeShiftTarget = 0;
  nextMilestone = 5;
  hitFlashT = 0; shakeT = 0; shakeMag = 0; caveOffset = 0;
  lastPlatY = H - 100;
  // Reset all powerup timers (cleared on death-run too, even though restricted)
  jetpackT = 0; freezeT = 0; shrinkT = 0; wingsT = 0;
  shieldT = 0; doubleJumpExtraT = 0; slowMoT = 0; multiplierT = 0;
  rocketBootT = 0;
  deathRunHasDied = false;
  timeAttackT = 0;
  // Pet bird init
  if (usePetBird) {
    petBird = { x: W / 2 + 40, y: H - 220, baseY: H - 220, vx: 0, ampT: 0 };
  } else petBird = null;
  // Initial ground
  plats.push({ x: W / 2 - 80, y: H - 100, w: 160, h: 16, kind: 'normal', baseX: W / 2 - 80, alive: true });
  // Seed initial wall decor (stalactites/stalagmites) above starting view
  for (let yy = H - 200; yy > -2000; yy -= 120) seedCaveSpikes(yy);
  // Strata bands every ~200px world space
  for (let yy = H; yy > -3000; yy -= 200) {
    strataBands.push({ y: yy, color: `rgba(${40 + Math.floor(Math.random()*20)},${20 + Math.floor(Math.random()*15)},${20},${0.08 + Math.random() * 0.06})` });
  }
  for (let i = 0; i < 30; i++) addPlatformAbove();
  lavaY = H + 200;
  height = 0; maxHeight = 0; score = 0; treatsGot = 0;
  // Track best altitude across runs
  bestAltitudeLineY = null;
}
function seedCaveSpikes(yAround) {
  // ~6 per "slice" — split between left/right walls, top/bottom orientation
  for (let i = 0; i < 6; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const orient = Math.random() < 0.5 ? 'top' : 'bot';
    const h = 14 + Math.random() * 18;
    const x = side === 'left' ? 8 + Math.random() * 16 : W - 8 - Math.random() * 16;
    const y = yAround - Math.random() * 120;
    caveSpikes.push({ x, y, side, orient, h });
  }
}
function shake(mag, dur) { const k = _shakeMul(); shakeMag = Math.max(shakeMag, mag * k); shakeT = Math.max(shakeT, dur); }
// One-shot toast (uses banner) so unlock notifications don't get lost.
function toasts_push(text) { banner = { text, life: 0, max: 2.5 }; }
function pop(x, y, text, color) {
  if (popups.length > 80) popups.shift();
  // Round 2C: random lateral spawn velocity so chained popups fan out
  popups.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -60, life: 0, max: 0.9, text, color: color || '#ffd23f' });
}
// Round 2C: jump dust puff — light brown particles at pug's feet on takeoff
function spawnJumpDust(x, y) {
  for (let i = 0; i < 5; i++) {
    if (embers.length > 160) break;
    const ang = Math.PI + (Math.random() - 0.5) * 1.2; // mostly horizontal/downward
    const sp = 30 + Math.random() * 50;
    embers.push({
      x: x + (Math.random() - 0.5) * 14, y: y + 8,
      vx: Math.cos(ang) * sp + (Math.random() - 0.5) * 40,
      vy: Math.sin(ang) * sp - 10,
      life: 0, max: 0.4, r: 1.5 + Math.random() * 1.5,
      color: 'rgba(200,180,150,0.7)', dust: true,
    });
  }
}
// Round 2: landing puff — wider dust spread on hard landings
function spawnLandingPuff(x, y) {
  for (let i = 0; i < 8; i++) {
    if (embers.length > 170) break;
    const ang = Math.PI + (Math.random() - 0.5) * 1.4;
    const sp = 60 + Math.random() * 80;
    embers.push({
      x: x + (Math.random() - 0.5) * 18, y: y - 4,
      vx: Math.cos(ang) * sp + (Math.random() - 0.5) * 60,
      vy: Math.sin(ang) * sp * 0.5 - 10,
      life: 0, max: 0.55, r: 1.5 + Math.random() * 2.2,
      color: 'rgba(210,195,170,0.7)', dust: true,
    });
  }
}
// Round 2C: feather burst on bat death (small dark-grey feathers spray out)
function spawnFeathers(x, y) {
  for (let i = 0; i < 10; i++) {
    if (embers.length > 180) break;
    const ang = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 120;
    embers.push({
      x, y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
      life: 0, max: 0.8, r: 1.5 + Math.random() * 2,
      color: ['#3a2a3a', '#2a1a2a', '#4a3a4a', '#1a0d1a'][Math.floor(Math.random() * 4)],
      feather: true,
    });
  }
}
// Round 2C: bounce squash visual — bouncy platforms briefly compress
function squashPlat(p) {
  p.squashT = 0.25;
}
function addPlatformAbove() {
  lastPlatY -= 80 + dailyRand() * 50;
  const w = 70 + dailyRand() * 70;
  const x = dailyRand() * (W - w);
  // Platform variety based on depth — higher = more variety
  const r = dailyRand();
  const depth = (H - lastPlatY) / 100;
  let kind = 'normal';
  // Platform types: SPRING, DISAPPEARING, MOVING, ROTATING, CONVEYOR, SAFE, TELEPORTER (Round 2).
  if (depth > 8 && r < 0.04) kind = 'safe';
  else if (depth > 9 && r < 0.07) kind = 'teleporter'; // paired pads — touching one warps you to the other
  else if (depth > 6 && r < 0.13) kind = 'conveyor';
  else if (depth > 5 && r < 0.19) kind = 'rotating';
  else if (depth > 4 && r < 0.25) kind = 'moving';
  else if (depth > 4 && r < 0.32) kind = 'disappearing';
  else if (depth > 3 && r < 0.42) kind = 'spring';
  else if (depth > 3 && r < 0.50) kind = 'crumble';
  else if (depth > 2 && r < 0.58) kind = 'bouncy';
  // ~25% of new platforms drift left-right (skip if it's the very first ground platform)
  const drifts = dailyRand() < 0.25 && lastPlatY < H - 150;
  const baseX = x;
  // Moving platforms have a bigger drift amp + phase variability
  let driftAmp = drifts ? 26 + dailyRand() * 12 : 0;
  if (kind === 'moving') driftAmp = Math.max(driftAmp, 80 + dailyRand() * 50);
  const driftPhase = dailyRand() * Math.PI * 2;
  const conveyorDir = kind === 'conveyor' ? (dailyRand() < 0.5 ? -1 : 1) : 0;
  const rotateSpeed = kind === 'rotating' ? (0.5 + dailyRand() * 1.5) * (dailyRand() < 0.5 ? -1 : 1) : 0;
  // 5% chance of a spike on top — but never on the lowest visible platform, never on SAFE
  const hasSpike = lastPlatY < H - 200 && dailyRand() < 0.05 && kind === 'normal';
  // 1/40 chance to spawn WINGS powerup
  const wingsHere = dailyRand() < 1 / 40 && !hasSpike;
  const platRef = {
    x, y: lastPlatY, w, h: 14, kind, t: 0, alive: true,
    baseX, driftAmp, driftPhase, hasSpike, vine: dailyRand() < 0.18,
    crumbleStartT: 0,
    conveyorDir, rotateSpeed, rotateAng: 0,
    disappearT: 0, touched: false,
    safeRestT: 0,
    teleportPair: null, teleportHue: 0,
  };
  plats.push(platRef);
  // TELEPORTER pairing — link with most recent unpaired teleporter.
  if (kind === 'teleporter') {
    let mate = null;
    for (let i = plats.length - 2; i >= 0; i--) {
      const q = plats[i];
      if (q.kind === 'teleporter' && !q.teleportPair) { mate = q; break; }
    }
    if (mate) {
      platRef.teleportPair = mate;
      mate.teleportPair = platRef;
      platRef.teleportHue = 1; // pink
      mate.teleportHue = 0;     // cyan
    }
  }
  if (!hasSpike && dailyRand() < 0.45) treats.push({ x: x + w / 2, y: lastPlatY - 24, baseX: x + w / 2, plat: plats[plats.length - 1] });
  // Wings powerup (rare). DEATH_RUN suppresses ALL powerups at spawn time
  // (was only filtered at pickup) so the world isn't littered with un-grabbable
  // pickups that confuse the player about what's actually available.
  if (gameMode !== 'death_run') {
    if (wingsHere) {
      powerups.push({ x: x + w / 2, y: lastPlatY - 38, type: 'wings', plat: plats[plats.length - 1] });
    } else if (depth > 4 && dailyRand() < 0.07) {
      // Wave 1E: expanded powerup pool with unlocks gating
      const pwTypes = ['jetpack', 'freeze', 'shrink'];
      if (unlockedPowerups.shield) pwTypes.push('shield');
      if (unlockedPowerups.doubleJumpExtra) pwTypes.push('doubleJumpExtra');
      if (unlockedPowerups.slowMo) pwTypes.push('slowMo');
      if (unlockedPowerups.multiplier) pwTypes.push('multiplier');
      powerups.push({ x: x + w / 2, y: lastPlatY - 38, type: pwTypes[Math.floor(dailyRand() * pwTypes.length)], plat: plats[plats.length - 1] });
    }
  }
  // Lava blob (rare, only deep up)
  if (depth > 6 && dailyRand() < 0.08) {
    blobs.push({ x: x + w / 2, y: H + 80, vy: -100 - dailyRand() * 60, life: 2.5 });
  }
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.key === 'w' || e.code === 'Space' || e.key === 'ArrowUp') jump();
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
});
function togglePause() {
  if (!running && !paused) return;
  if (paused) {
    // Resume countdown — actual unpause happens when countdown hits 0
    resumeCountdownT = 3;
  } else {
    paused = true;
    resumeCountdownT = 0;
    try { sfx.tone(330, 'sine', 0.1, 0.18); } catch {}
  }
}
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let touchX = null;
canvas.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchX = null);
document.getElementById('jump-btn').addEventListener('click', jump);
if ('ontouchstart' in window) document.getElementById('jump-btn').style.display = 'block';
// Universal mobile controls — platformer layout (L/R buttons + JUMP). Synth
// keys feed the keys Set and also trigger the keydown listener above which
// auto-calls jump() on space, so JUMP works without extra wiring.
createMobileControls({ layout: 'platformer', keys });

function jump() {
  if (!running || pug.jumpsLeft <= 0) return;
  pug.vy = JUMP_V * (wingsT > 0 ? 1.1 : 1);
  // Round 2C: jump dust puff only when launching from the ground (looks weird
  // exploding mid-air on double-jump). Heuristic: pug.onGround was true.
  if (pug.onGround) spawnJumpDust(pug.x, pug.y);
  pug.jumpsLeft--;
  pug.onGround = false;
  sfx.tone(wingsT > 0 ? 990 : (pug.jumpsLeft === 1 ? 660 : 880), 'triangle', 0.08, 0.18);
}
function refillJumps() { pug.jumpsLeft = wingsT > 0 ? 3 : 2; }
// Icy Tower-style combo thresholds — popup + score bonus at 5/10/20/30/...
function checkComboThreshold() {
  // Trigger at 5, 10, 20, then every 10 above
  const hit =
    comboJumps === 5 || comboJumps === 10 || comboJumps === 20 ||
    (comboJumps > 20 && comboJumps % 10 === 0);
  if (!hit) return;
  const bonus = comboJumps * 10;
  score += bonus;
  banner = { text: `COMBO ×${comboJumps}!`, life: 0, max: 1.4 };
  pop(pug.x, pug.y - 30, `+${bonus}`, '#ff3aa1');
  sfx.arp([659, 880, 1320], 'triangle', 0.06, 0.2, 0.22);
  shake(4, 0.22);
  if (comboJumps >= 20) unlockAchievement('combo_master');
}

function tick(dt) {
  if (!running) return;
  // Paused — handle resume countdown
  if (paused) {
    if (resumeCountdownT > 0) {
      resumeCountdownT -= dt;
      if (resumeCountdownT <= 0) {
        paused = false;
        resumeCountdownT = 0;
        try { sfx.tone(880, 'triangle', 0.08, 0.18); } catch {}
      }
    }
    return;
  }
  // Movement
  let mx = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchX !== null) {
    if (touchX < W / 2 - 30) mx = -1;
    else if (touchX > W / 2 + 30) mx = 1;
  }
  // Death-run mode tracking
  if (gameMode === 'time_attack') timeAttackT += dt;
  // Slow-mo scales gameplay dt (visuals still real-time)
  const gdt = slowMoT > 0 ? dt * 0.6 : dt;
  // Decay powerup timers
  jetpackT = Math.max(0, jetpackT - dt);
  freezeT = Math.max(0, freezeT - dt);
  shrinkT = Math.max(0, shrinkT - dt);
  wingsT = Math.max(0, wingsT - dt);
  shieldT = Math.max(0, shieldT - dt);
  doubleJumpExtraT = Math.max(0, doubleJumpExtraT - dt);
  slowMoT = Math.max(0, slowMoT - dt);
  multiplierT = Math.max(0, multiplierT - dt);
  rocketBootT = Math.max(0, rocketBootT - dt);
  // ROCKETBOOT combo — jetpack + shield active simultaneously = rocketboot (flies through obstacles)
  if (jetpackT > 0 && shieldT > 0 && rocketBootT <= 0) {
    rocketBootT = Math.min(jetpackT, shieldT);
    banner = { text: '★ ROCKETBOOT ★', life: 0, max: 1.4 };
    pop(pug.x, pug.y - 30, 'COMBO!', '#fff7d0');
    sfx.arp([523, 880, 1320], 'triangle', 0.06, 0.2, 0.22);
    shake(4, 0.22);
  }
  // Round 2: pug animation decay
  lastWasOnGround = pug.onGround;
  pugBobT += dt;
  pugSquashT = Math.max(0, pugSquashT - dt * 4);
  if (pug.vy < -200) pugStretchT = Math.min(1, pugStretchT + dt * 4);
  else pugStretchT = Math.max(0, pugStretchT - dt * 4);
  // Round 2C: decay squash on bouncy platforms
  for (const p of plats) {
    if (p.squashT > 0) p.squashT = Math.max(0, p.squashT - dt);
    // DISAPPEARING — vanish 1s after first touch
    if (p.kind === 'disappearing' && p.touched && p.alive) {
      p.disappearT += dt;
      if (p.disappearT >= 1) p.alive = false;
    }
    // ROTATING — spin around center (decorative)
    if (p.rotateSpeed) p.rotateAng += p.rotateSpeed * dt;
    // SAFE — gradient pulse already in render; just decay safeRestT
    if (p.kind === 'safe' && p.safeRestT > 0) p.safeRestT = Math.max(0, p.safeRestT - dt);
  }
  // Decay ice-frozen timers (per platform — instant slide)
  for (const p of plats) {
    const t = iceFrozenT.get(p);
    if (t && t > 0) iceFrozenT.set(p, t - dt);
  }
  // Drift platforms left/right (sin oscillation around baseX)
  const driftT = performance.now() * 0.001;
  for (const p of plats) {
    if (p.driftAmp > 0) {
      const nx = p.baseX + Math.sin(driftT * Math.PI + p.driftPhase) * p.driftAmp;
      // Move treats/powerups that ride this plat
      const dx = nx - p.x;
      p.x = nx;
      for (const t of treats) if (t.plat === p) t.x += dx;
      for (const pw of powerups) if (pw.plat === p) pw.x += dx;
    }
  }
  // CONVEYOR — apply horizontal push if pug stands on one
  if (pug.onGround && lastPlat && lastPlat.conveyorDir) {
    pug.vx += lastPlat.conveyorDir * 200 * dt;
  }
  // ICE FROZEN — if last platform is frozen, slide off (no friction, push toward edge)
  if (pug.onGround && lastPlat) {
    const frozenT = iceFrozenT.get(lastPlat) || 0;
    if (frozenT > 0) {
      pug.vx *= Math.pow(0.5, dt * 0.5); // very low friction
      // Slight push toward nearest edge (so player slips off)
      const center = lastPlat.x + lastPlat.w / 2;
      pug.vx += (pug.x < center ? -1 : 1) * 90 * dt;
    }
  }
  pug.vx += mx * 1200 * dt;
  pug.vx *= Math.pow(0.5, dt * 5);
  // VOIDSPACE biome (idx 4) → 55% gravity. ABYSS (idx 2) → 85% buoyancy. Jetpack still wins.
  let gravMul = 1;
  const _bIdx = biomeShiftT > 0 ? biomeShiftTarget : biomeIdx;
  if (_bIdx === 4) gravMul = 0.55;
  else if (_bIdx === 2) gravMul = 0.85;
  pug.vy += (jetpackT > 0 ? GRAV * 0.15 : GRAV * gravMul) * dt;
  if (jetpackT > 0 && keys.has(' ')) pug.vy = Math.max(pug.vy, -200); // hover
  pug.x += pug.vx * dt;
  pug.y += pug.vy * dt;
  // Wrap horizontally
  if (pug.x < -10) pug.x = W;
  if (pug.x > W + 10) pug.x = 0;

  // Platform collision (only when falling)
  pug.onGround = false;
  const hw = (shrinkT > 0 ? pug.w * 0.5 : pug.w) / 2;
  if (pug.vy > 0) {
    for (const p of plats) {
      if (!p.alive) continue;
      if (pug.x + hw > p.x && pug.x - hw < p.x + p.w) {
        if (pug.y + pug.h / 2 > p.y && pug.y + pug.h / 2 < p.y + p.h + 12) {
          // Spike kills on landing
          if (p.hasSpike) { hitFlashT = 0.3; shake(8, 0.4); return die(); }
          if (p.kind === 'spring') {
            // SPRING — 3x bounce
            pug.vy = JUMP_V * 1.8;
            refillJumps();
            sfx.arp([880, 1320, 1760], 'triangle', 0.04, 0.18, 0.18);
            shake(6, 0.24);
            squashPlat(p);
            spawnJumpDust(pug.x, p.y);
            if (p !== lastPlat) {
              comboJumps++; lastPlat = p; comboRestT = 0;
              checkComboThreshold();
            }
          } else if (p.kind === 'bouncy') {
            pug.vy = JUMP_V * 1.3;
            refillJumps();
            sfx.tone(990, 'triangle', 0.08, 0.2);
            // Round 2C: bigger shake + larger spring squash + extra dust puff
            shake(4, 0.18);
            squashPlat(p);
            spawnJumpDust(pug.x, p.y);
            // Icy Tower combo: bouncy launch counts as a chained landing.
            if (p !== lastPlat) {
              comboJumps++; lastPlat = p; comboRestT = 0;
              checkComboThreshold();
            }
          } else {
            // Round 2: hard-landing puff
            if (!lastWasOnGround && pug.vy > 250) {
              spawnLandingPuff(pug.x, p.y);
              pugSquashT = 1;
              shake(2, 0.12);
            }
            pug.y = p.y - pug.h / 2;
            pug.vy = 0;
            pug.onGround = true;
            refillJumps();
            // Icy Tower combo: only NEW platform landings count.
            if (p !== lastPlat) {
              comboJumps++;
              lastPlat = p;
              comboRestT = 0;
              checkComboThreshold();
            }
            // DISAPPEARING — touched marker so it starts vanishing 1s
            if (p.kind === 'disappearing') p.touched = true;
            // TELEPORTER — warp to paired pad if it exists and off cooldown
            if (p.kind === 'teleporter' && p.teleportPair && p.teleportPair.alive && teleportCooldownT <= 0) {
              const dest = p.teleportPair;
              pug.x = dest.x + dest.w / 2;
              pug.y = dest.y - pug.h / 2 - 4;
              pug.vy = JUMP_V * 0.3;
              teleportCooldownT = 0.7;
              pop(dest.x + dest.w / 2, dest.y - 20, 'WARP!', '#4cc9f0');
              shake(4, 0.2);
              try { sfx.arp([880, 1320, 1760], 'triangle', 0.04, 0.16, 0.2); } catch {}
              for (let i = 0; i < 10; i++) {
                if (embers.length > 180) break;
                const a = Math.random() * Math.PI * 2;
                embers.push({ x: p.x + p.w / 2, y: p.y - 4, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0, max: 0.45, r: 2 + Math.random() * 2, color: p.teleportHue ? '#ff3aa1' : '#4cc9f0', glow: true });
                embers.push({ x: dest.x + dest.w / 2, y: dest.y - 4, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, life: 0, max: 0.45, r: 2 + Math.random() * 2, color: dest.teleportHue ? '#ff3aa1' : '#4cc9f0', glow: true });
              }
              break;
            }
            // SAFE — resting on safe platform earns small "REST" bonus
            if (p.kind === 'safe') {
              p.safeRestT += dt;
              if (p.safeRestT >= 0.7 && !p._safeBonusGiven) {
                p._safeBonusGiven = true;
                score += 30;
                pop(pug.x, pug.y - 30, 'SAFE +30', '#5ef38c');
                sfx.tone(660, 'sine', 0.1, 0.18);
              }
            }
            if (p.kind === 'crumble') {
              if (!p.crumbleStartT) p.crumbleStartT = performance.now();
              const elapsed = performance.now() - p.crumbleStartT;
              if (elapsed > 1500) {
                p.alive = false;
                // shed particles
                for (let i = 0; i < 6; i++) {
                  if (embers.length > 150) break;
                  embers.push({ x: p.x + Math.random() * p.w, y: p.y, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 40, life: 0, max: 0.5, r: 1.5 });
                }
                shake(3, 0.18);
              }
            }
          }
        }
      }
    }
  }
  // Powerup pickup (DEATH_RUN bans powerups)
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (Math.abs(p.x - pug.x) < 20 && Math.abs(p.y - pug.y) < 20) {
      if (gameMode === 'death_run') { powerups.splice(i, 1); continue; }
      powerups.splice(i, 1);
      if (p.type === 'jetpack') jetpackT = 5;
      else if (p.type === 'freeze') freezeT = 4;
      else if (p.type === 'shrink') shrinkT = 6;
      else if (p.type === 'wings') {
        wingsT = 6;
        pug.jumpsLeft = 3;
        pop(p.x, p.y - 10, 'WINGS!', '#fff7d0');
        shake(3, 0.18);
      }
      else if (p.type === 'shield') { shieldT = 6; pop(p.x, p.y - 10, 'SHIELD!', '#4cc9f0'); }
      else if (p.type === 'doubleJumpExtra') { doubleJumpExtraT = 8; pug.jumpsLeft = Math.max(pug.jumpsLeft, 3); pop(p.x, p.y - 10, '+JUMP!', '#5ef38c'); }
      else if (p.type === 'slowMo') { slowMoT = 4; pop(p.x, p.y - 10, 'SLOW-MO!', '#b055ff'); }
      else if (p.type === 'multiplier') { multiplierT = 8; pop(p.x, p.y - 10, '×2 SCORE!', '#ffd23f'); }
      sfx.tone(1320, 'triangle', 0.12, 0.22);
      // Round 2: powerup_collector achievement + chain hint banners
      runPowerupsGrabbed++;
      if (runPowerupsGrabbed >= 5) unlockAchievement('powerup_collector');
      if (rocketBootT <= 0) {
        if (jetpackT > 0 && shieldT > 0) toasts_push('★ COMBO: ROCKETBOOT! ★');
        else if (doubleJumpExtraT > 0 && shieldT > 0) toasts_push('★ COMBO: BUNKER BOOTS!');
        else if (wingsT > 0 && slowMoT > 0) toasts_push('★ COMBO: FLOAT MODE!');
        else if (multiplierT > 0 && jetpackT > 0) toasts_push('★ COMBO: JACKPOT JET!');
      }
    }
  }
  // Pet bird companion (Wave 1E) — auto-collects nearby treats
  if (petBird && usePetBird) {
    petBird.ampT += dt * 2;
    const targetX = pug.x + 30 + Math.sin(petBird.ampT) * 8;
    const targetY = pug.y - 30 + Math.cos(petBird.ampT * 0.7) * 6;
    petBird.x += (targetX - petBird.x) * dt * 4;
    petBird.y += (targetY - petBird.y) * dt * 4;
    for (let i = treats.length - 1; i >= 0; i--) {
      const t = treats[i];
      if (Math.hypot(t.x - petBird.x, t.y - petBird.y) < 50 && Math.hypot(t.x - pug.x, t.y - pug.y) < 200) {
        treats.splice(i, 1);
        treatsGot++; score += 50;
        sfx.tone(1760, 'triangle', 0.06, 0.18);
        pop(t.x, t.y - 10, '+50 PET', '#fff7d0');
      }
    }
  }
  // Wave 1E enemies (ICE DROP / DEBRIS / HAUNTS / METEORS)
  if (height >= 700 && Math.random() < dt * 0.5) iceDrops.push({ x: Math.random() * W, y: -20, vy: 200 + Math.random() * 80, life: 0, max: 6 });
  for (let i = iceDrops.length - 1; i >= 0; i--) {
    const d = iceDrops[i]; d.y += d.vy * dt; d.life += dt;
    if (d.life >= d.max || d.y > H + 20) { iceDrops.splice(i, 1); continue; }
    for (const p of plats) {
      if (p.alive && d.x > p.x && d.x < p.x + p.w && d.y > p.y - 2 && d.y < p.y + 4) {
        iceFrozenT.set(p, 3); iceDrops.splice(i, 1); sfx.tone(660, 'sine', 0.1, 0.2); break;
      }
    }
  }
  if (height >= 800 && Math.random() < dt * 0.4) fallingDebris.push({ x: Math.random() * W, y: -20, vy: 280 + Math.random() * 80, sz: 8 + Math.random() * 6 });
  for (let i = fallingDebris.length - 1; i >= 0; i--) {
    const d = fallingDebris[i]; d.y += d.vy * dt;
    if (d.y > H + 30) { fallingDebris.splice(i, 1); continue; }
    if (rocketBootT <= 0 && Math.abs(d.x - pug.x) < d.sz + 10 && Math.abs(d.y - pug.y) < d.sz + 10) {
      if (shieldT > 0) { shieldT = 0; biomeStartDamage = true; pop(d.x, d.y, 'SHIELD!', '#4cc9f0'); fallingDebris.splice(i, 1); continue; }
      return die();
    }
  }
  if (height >= 1200 && Math.random() < dt * 0.25) haunts.push({ x: Math.random() * W, baseY: 40 + Math.random() * (H * 0.6), y: 0, ampT: 0, alpha: 0 });
  for (let i = haunts.length - 1; i >= 0; i--) {
    const h = haunts[i]; h.ampT += dt * 1.5; h.alpha = Math.min(1, h.alpha + dt); h.y = h.baseY + Math.sin(h.ampT) * 30;
    if (Math.abs(h.x - pug.x) < 18 && Math.abs(h.y - pug.y) < 18 && Math.abs(pug.vy) < 100 && rocketBootT <= 0) {
      if (shieldT > 0) { shieldT = 0; biomeStartDamage = true; pop(h.x, h.y, 'SHIELD!', '#4cc9f0'); haunts.splice(i, 1); continue; }
      return die();
    }
  }
  // Round 2: WIND CURRENT spawn + push logic. Spawns above 600m.
  teleportCooldownT = Math.max(0, teleportCooldownT - dt);
  if (height >= 600 && windCurrents.length < 4) {
    windSpawnT -= dt;
    if (windSpawnT <= 0) {
      windSpawnT = 6 + Math.random() * 5;
      const ww = 90 + Math.random() * 100;
      windCurrents.push({
        x: Math.random() * (W - ww),
        y: -40, w: ww, h: 140 + Math.random() * 80,
        dir: Math.random() < 0.5 ? -1 : 1, ampT: 0,
        vy: 30 + Math.random() * 20, alive: true,
        life: 0, max: 14 + Math.random() * 4,
      });
    }
  }
  for (let i = windCurrents.length - 1; i >= 0; i--) {
    const w = windCurrents[i];
    w.life += dt; w.y += w.vy * dt; w.ampT += dt * 2.4;
    if (w.life >= w.max || w.y > H + 40) { windCurrents.splice(i, 1); continue; }
    if (pug.x > w.x && pug.x < w.x + w.w && pug.y > w.y && pug.y < w.y + w.h && rocketBootT <= 0) {
      pug.vx += w.dir * 380 * dt;
    }
  }
  if (height >= 1500 && Math.random() < dt * 0.3) meteors.push({ x: Math.random() * W, y: -30, vx: (Math.random() - 0.5) * 60, vy: 320 + Math.random() * 120, sz: 10 + Math.random() * 6 });
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]; m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.y > H + 30) { meteors.splice(i, 1); continue; }
    if (rocketBootT <= 0 && Math.abs(m.x - pug.x) < m.sz + 10 && Math.abs(m.y - pug.y) < m.sz + 10) {
      if (shieldT > 0) { shieldT = 0; biomeStartDamage = true; pop(m.x, m.y, 'SHIELD!', '#4cc9f0'); meteors.splice(i, 1); continue; }
      return die();
    }
    if (Math.random() < 0.5 && embers.length < 200) embers.push({ x: m.x, y: m.y, vx: -m.vx * 0.2, vy: -m.vy * 0.2, life: 0, max: 0.4, r: 2 + Math.random() * 2, color: '#b055ff', glow: true });
  }
  if (height === 1337 && !window._lavaLore) {
    window._lavaLore = true;
    banner = { text: 'LORE: pugs once ruled this realm', life: 0, max: 3.5 };
    sfx.arp([523, 660, 880, 1320, 1760], 'triangle', 0.06, 0.3, 0.25);
  }
  if (gameMode === 'challenge' && height >= challengeTarget && running) {
    banner = { text: '★ CHALLENGE WON ★', life: 0, max: 3 };
    score += 500; return die(true);
  }
  // Lava blobs
  for (let i = blobs.length - 1; i >= 0; i--) {
    const b = blobs[i];
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.y < -200) { blobs.splice(i, 1); continue; }
    // Honour shrink powerup — smaller pug = tighter hit box, matching
    // platform/treat collision feel.
    const hitR = shrinkT > 0 ? 12 : 18;
    if (Math.abs(b.x - pug.x) < hitR && Math.abs(b.y - pug.y) < hitR) return die();
  }
  // ===== Doodle Jump-style flying enemies (height-gated spawns) =====
  // Above 500m: bats cross horizontally; can be jumped on (vy>0 stomp = kill
  // + bounce) or touched at any other angle = death. Above 1000m: fireballs
  // launch from the edges and traverse, instant-death on touch.
  if (height >= 500) {
    batSpawnT -= dt;
    if (batSpawnT <= 0) {
      // Spawn around 1.0..2.4s apart, scaling tighter with height.
      batSpawnT = Math.max(1.2, 3.8 - (height - 500) * 0.0014);
      const fromLeft = Math.random() < 0.5;
      const speed = 80 + Math.random() * 60 + Math.min(60, height * 0.04);
      bats.push({
        x: fromLeft ? -20 : W + 20,
        baseY: 40 + Math.random() * (H * 0.55),
        y: 0, // overwritten next tick
        vx: fromLeft ? speed : -speed,
        ampT: Math.random() * Math.PI * 2, alive: true,
      });
    }
  }
  if (height >= 1000) {
    fireSpawnT -= dt;
    if (fireSpawnT <= 0) {
      fireSpawnT = Math.max(1.0, 4.5 - (height - 1000) * 0.001);
      const fromLeft = Math.random() < 0.5;
      const spd = 220 + Math.random() * 100 + Math.min(120, (height - 1000) * 0.06);
      // Fireballs arc slightly toward pug — small vertical drift only so they
      // remain readable as horizontal threats.
      const vy = (Math.random() - 0.5) * 40;
      fireballs.push({
        x: fromLeft ? -16 : W + 16,
        y: 40 + Math.random() * (H * 0.45),
        vx: fromLeft ? spd : -spd, vy,
        life: 0, max: 8, r: 9 + Math.random() * 3,
      });
    }
  }
  // Bat movement + stomp/kill resolution
  for (let i = bats.length - 1; i >= 0; i--) {
    const b = bats[i];
    if (!b.alive) {
      // Dying bats fall — keep them around briefly for a satisfying squash.
      b.y += 240 * dt;
      b.ampT += dt * 6;
      if (b.y > H + 30) bats.splice(i, 1);
      continue;
    }
    b.x += b.vx * dt;
    b.ampT += dt * 3;
    b.y = b.baseY + Math.sin(b.ampT) * 14;
    if (b.x < -40 || b.x > W + 40) { bats.splice(i, 1); continue; }
    const batR = shrinkT > 0 ? 14 : 22;
    if (Math.abs(b.x - pug.x) < batR && Math.abs(b.y - pug.y) < batR) {
      // Stomp = pug falling onto bat from above (vy>0 and pug center above bat center)
      if (pug.vy > 50 && pug.y < b.y - 4) {
        b.alive = false;
        pug.vy = JUMP_V * 0.85;
        refillJumps();
        comboJumps++; // stomp counts as a combo jump
        comboRestT = 0;
        score += 75;
        pop(b.x, b.y - 10, '+75 STOMP', '#ff8e3c');
        // Round 2C: bigger stomp shake + feather burst on death
        shake(5, 0.22);
        spawnFeathers(b.x, b.y);
        sfx.tone(880, 'triangle', 0.08, 0.2);
        // tiny secondary thump
        sfx.tone(440, 'square', 0.05, 0.2);
      } else {
        return die();
      }
    }
  }
  // Fireballs traverse + check collisions
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.life += dt;
    if (f.life >= f.max || f.x < -30 || f.x > W + 30) { fireballs.splice(i, 1); continue; }
    const fR = shrinkT > 0 ? 11 : 18;
    if (Math.abs(f.x - pug.x) < fR && Math.abs(f.y - pug.y) < fR) return die();
    // Round 2C: trailing flame particles — small fast-fading sparks behind
    // each fireball that read as a comet tail. Cap-checked to stay below 200.
    if (Math.random() < 0.65 && embers.length < 180) {
      const cols = ['#ffd23f', '#ff8e3c', '#ff5a3a'];
      embers.push({
        x: f.x + (Math.random() - 0.5) * 4,
        y: f.y + (Math.random() - 0.5) * 4,
        vx: -f.vx * 0.15 + (Math.random() - 0.5) * 30,
        vy: -f.vy * 0.15 + (Math.random() - 0.5) * 30,
        life: 0, max: 0.35, r: 1.5 + Math.random() * 2,
        color: cols[Math.floor(Math.random() * cols.length)],
        glow: true,
      });
    }
  }

  // Lava rises — accelerating (paused if freeze powerup active)
  height = Math.max(height, Math.floor((H - 200 - pug.y) / 10));
  maxHeight = Math.max(maxHeight, height);
  // Combo decay: standing on the same platform >0.7s resets the chain.
  if (pug.onGround) {
    comboRestT += dt;
    if (comboRestT > 0.7 && comboJumps > 0) {
      // Tiny "chain broken" tick so the player feels the loss without a banner.
      if (comboJumps >= 5) pop(pug.x, pug.y - 18, '✕ CHAIN', '#a0a0b0');
      comboJumps = 0; lastPlat = null; comboRestT = 0;
    }
  } else {
    comboRestT = 0;
  }
  // Geometry Dash biome-shift checkpoints (every 500m, 2s transition).
  // VOIDSPACE (biome 3) unlocks above 1500m by way of the +500 step.
  if (height >= nextBiomeAtHeight && biomeShiftT <= 0 && biomeIdx < BIOMES.length - 1) {
    biomeShiftTarget = biomeIdx + 1;
    biomeShiftT = 2;
    banner = { text: `★ ${BIOMES[biomeShiftTarget].name} ★`, life: 0, max: 1.8 };
    sfx.arp([220, 330, 440, 660], 'sawtooth', 0.08, 0.25, 0.18);
    shake(5, 0.4);
  }
  if (biomeShiftT > 0) {
    biomeShiftT -= dt;
    if (biomeShiftT <= 0) {
      biomeIdx = biomeShiftTarget;
      biomeShiftT = 0;
      nextBiomeAtHeight += 500;
      // Round 2: PERFECT_BIOME — cleared a 500m biome with no damage
      if (!biomeStartDamage) unlockAchievement('perfect_biome');
      biomeStartDamage = false;
      // Unlock new powerup on each biome reached (cosmetic + functional)
      const unlockMap = { 1: 'shield', 2: 'doubleJumpExtra', 3: 'slowMo', 4: 'multiplier' };
      if (unlockMap[biomeIdx] && !unlockedPowerups[unlockMap[biomeIdx]]) {
        unlockedPowerups[unlockMap[biomeIdx]] = true; saveUnlocks();
        toasts_push(`★ UNLOCKED: ${unlockMap[biomeIdx].toUpperCase()}`);
      }
    }
  }
  // Round 2: altitude + speedrun achievements
  if (height >= 1000) unlockAchievement('km_club');
  if (height >= 500 && ((performance.now() - runStartT) / 1000) < 30) unlockAchievement('speedrunner');
  // VOIDSPACE anti-gravity sections — lower gravity if in VOIDSPACE biome (biome 3)
  // Done as a soft multiplier already applied in pug movement code via biome check.
  const lavaSpeed = (freezeT > 0 ? 0 : 40 + height * 0.38);
  lavaY -= lavaSpeed * dt;
  // Camera: when pug is above middle, scroll world down
  if (pug.y < H * 0.4) {
    const dy = H * 0.4 - pug.y;
    pug.y += dy;
    lavaY += dy;
    for (const p of plats) p.y += dy;
    for (const t of treats) t.y += dy;
    for (const pw of powerups) pw.y += dy;
    for (const s of caveSpikes) s.y += dy;
    for (const b of strataBands) b.y += dy;
    for (const w of windCurrents) w.y += dy;
    lastPlatY += dy;
    // Seed new cave decor as we scroll up. Fall back to player y when the
    // array has been fully spliced so spawning never silently stops.
    {
      const topY = caveSpikes.length ? caveSpikes[caveSpikes.length - 1].y : pug.y;
      if (topY > -200) seedCaveSpikes(topY - 120);
    }
    // New strata bands
    while (strataBands.length === 0 || strataBands[strataBands.length - 1].y > -200) {
      const lastY = strataBands.length ? strataBands[strataBands.length - 1].y : H;
      strataBands.push({ y: lastY - 200, color: `rgba(${40 + Math.floor(Math.random()*20)},${20 + Math.floor(Math.random()*15)},${20},${0.08 + Math.random() * 0.06})` });
    }
  }
  // Recycle platforms above viewport
  while (lastPlatY > -200) addPlatformAbove();
  for (let i = plats.length - 1; i >= 0; i--) if (plats[i].y > H + 100) plats.splice(i, 1);
  for (let i = treats.length - 1; i >= 0; i--) if (treats[i].y > H + 100) treats.splice(i, 1);
  for (let i = powerups.length - 1; i >= 0; i--) if (powerups[i].y > H + 100) powerups.splice(i, 1);
  for (let i = caveSpikes.length - 1; i >= 0; i--) if (caveSpikes[i].y > H + 100) caveSpikes.splice(i, 1);
  for (let i = strataBands.length - 1; i >= 0; i--) if (strataBands[i].y > H + 100) strataBands.splice(i, 1);

  // Treats — apply multiplier powerup
  const scoreMul = multiplierT > 0 ? 2 : 1;
  for (let i = treats.length - 1; i >= 0; i--) {
    const t = treats[i];
    if (Math.abs(t.x - pug.x) < 20 && Math.abs(t.y - pug.y) < 20) {
      treats.splice(i, 1);
      treatsGot++; score += 50 * scoreMul;
      sfx.tone(1320, 'triangle', 0.08, 0.2);
      pop(t.x, t.y - 10, `+${50 * scoreMul}`, '#ffd23f');
    }
  }
  score = Math.max(score, (height * 10 + treatsGot * 50) * scoreMul);

  // Milestone banner every 5m
  if (height >= nextMilestone) {
    banner = { text: `${nextMilestone}m MILESTONE!`, life: 0, max: 1.8 };
    pop(W / 2, H * 0.4, `+${nextMilestone * 5}`, '#5ef38c');
    score += nextMilestone * 5;
    nextMilestone += 5;
    sfx.arp([523, 659, 784], 'triangle', 0.06, 0.18, 0.15);
    shake(3, 0.18);
  }

  // Spawn embers rising from lava (cap at ~150)
  if (embers.length < 150 && lavaY < H + 40) {
    const burst = freezeT > 0 ? 0 : 2;
    for (let i = 0; i < burst; i++) {
      embers.push({
        x: Math.random() * W,
        y: lavaY + Math.random() * 4,
        vx: (Math.random() - 0.5) * 30,
        vy: -40 - Math.random() * 60,
        life: 0, max: 1.6 + Math.random() * 1.2, r: 1 + Math.random() * 2,
      });
    }
  }
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.life += dt; e.x += e.vx * dt; e.y += e.vy * dt;
    // Round 2C: dust falls + feathers gently flutter; default embers float up.
    if (e.dust) { e.vy += 220 * dt; e.vx *= 0.92; }
    else if (e.feather) { e.vy += 60 * dt; e.vx *= 0.95; }
    else e.vy += -20 * dt; // buoyancy for default lava embers
    if (e.life >= e.max || e.y < -20 || e.y > H + 80) embers.splice(i, 1);
  }
  // Spawn lava bubbles (cap at ~30)
  if (lavaBubbles.length < 30) {
    if (Math.random() < dt * 6) {
      lavaBubbles.push({
        x: Math.random() * W, y: lavaY + 2 + Math.random() * 8,
        r: 3 + Math.random() * 5, life: 0, max: 0.6 + Math.random() * 0.5,
      });
    }
  }
  for (let i = lavaBubbles.length - 1; i >= 0; i--) {
    const b = lavaBubbles[i];
    b.life += dt;
    if (b.life >= b.max) lavaBubbles.splice(i, 1);
  }
  // Popup floats
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life += dt; p.y += p.vy * dt; p.vy += 30 * dt;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 0.88; }
    if (p.life >= p.max) popups.splice(i, 1);
  }
  // Banner
  if (banner) { banner.life += dt; if (banner.life >= banner.max) banner = null; }
  // Shake/flash decay
  if (shakeT > 0) shakeT -= dt;
  if (hitFlashT > 0) hitFlashT -= dt;
  // Background parallax: scroll with platforms but slower
  caveOffset += 12 * dt;

  // Lava death
  if (pug.y + pug.h / 2 >= lavaY) { hitFlashT = 0.3; shake(8, 0.4); return die(); }
  // Fall too far below
  if (pug.y > H + 80) { hitFlashT = 0.3; shake(6, 0.35); return die(); }
  updateHud();
}

function render() {
  // Screen shake transform
  let sx = 0, sy = 0;
  if (shakeT > 0) {
    const k = Math.min(1, shakeT / 0.3);
    sx = (Math.random() - 0.5) * shakeMag * 2 * k;
    sy = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  ctx.save();
  ctx.translate(sx, sy);
  const biome = getBiomePalette();
  // Sky gradient (biome-tinted)
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, biome.sky0); grd.addColorStop(1, biome.sky1);
  ctx.fillStyle = grd; ctx.fillRect(-8, -8, W + 16, H + 16);
  // Distant pulsing red glow — palette-driven so it shifts with the biome.
  const glowPulse = 0.55 + 0.25 * Math.sin(performance.now() * 0.0008);
  const coreGrad = ctx.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, Math.max(W, H) * 0.7);
  coreGrad.addColorStop(0, `rgba(${biome.glow},${0.25 * glowPulse})`);
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGrad; ctx.fillRect(0, 0, W, H);
  // Strata bands — decorative horizontal bands
  for (const sb of strataBands) {
    if (sb.y < -20 || sb.y > H + 20) continue;
    ctx.fillStyle = sb.color;
    ctx.fillRect(0, sb.y, W, 6);
  }
  // Round 2: ABYSS biome — floating watching eyes (compact)
  if (biome.name === 'ABYSS' || (biomeShiftT > 0 && BIOMES[biomeShiftTarget].name === 'ABYSS')) {
    const _tt = performance.now() * 0.0006;
    for (let i = 0; i < 7; i++) {
      const ex = (W * (i * 0.18 + 0.05)) % W + Math.sin(_tt + i * 1.7) * 18;
      const ey = (H * ((i * 0.27 + 0.12) % 1)) + Math.cos(_tt * 0.7 + i * 1.3) * 24;
      const open = Math.sin(_tt * 2 + i * 2.5) > -0.7 ? 1 : 0.1;
      const irisX = ex + Math.sin(_tt + i) * 4;
      ctx.save();
      ctx.globalAlpha = 0.45 * open;
      ctx.fillStyle = '#caf0ff'; ctx.beginPath(); ctx.ellipse(ex, ey, 14, 7 * open, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a3a6a'; ctx.beginPath(); ctx.arc(irisX, ey, 5 * open, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(irisX, ey, 2 * open, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(irisX - 1, ey - 2, 1, 1);
      ctx.restore();
    }
  }
  // Round 2: 3rd parallax — far mountain silhouettes (compact)
  const _parY0 = (caveOffset * 0.18) % 240;
  ctx.fillStyle = `rgba(${(biome.stratoR*.4)|0},${(biome.stratoG*.4)|0},${(biome.stratoB*.4)|0},.55)`;
  for (let yy = -240; yy < H + 240; yy += 240) for (let i = 0; i < 5; i++) {
    const cx = (i / 4) * W, cy = yy + _parY0;
    ctx.beginPath();
    ctx.moveTo(cx - 100, cy + 30); ctx.lineTo(cx - 50, cy - 70); ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx + 50, cy - 50); ctx.lineTo(cx + 100, cy + 30); ctx.closePath(); ctx.fill();
  }
  // 20m level markers — when world altitude crosses a "20m line" draw small chip
  // Background parallax: distant cave walls (slow scroll, repeating)
  const parY = (caveOffset * 0.4) % 200;
  ctx.fillStyle = biome.rockA;
  for (let yy = -200; yy < H + 200; yy += 200) {
    for (let i = 0; i < 6; i++) {
      const cx = (i / 5) * W;
      const cy = yy + parY + (i % 2) * 80;
      ctx.beginPath();
      ctx.moveTo(cx - 60, cy);
      ctx.lineTo(cx - 30, cy - 40);
      ctx.lineTo(cx + 30, cy - 30);
      ctx.lineTo(cx + 60, cy);
      ctx.closePath(); ctx.fill();
    }
  }
  // Mining cart tracks (decorative) — rust rails on left wall, repeating
  const rk = (caveOffset * 1.0) % 90;
  for (let yy = -90; yy < H + 90; yy += 90) {
    const ty = yy + rk;
    ctx.fillStyle = 'rgba(120,60,30,0.5)';
    ctx.fillRect(2, ty, 4, 60); ctx.fillRect(W - 6, ty, 4, 60);
    ctx.fillStyle = 'rgba(180,90,40,0.4)';
    ctx.fillRect(2, ty + 14, 4, 1); ctx.fillRect(W - 6, ty + 14, 4, 1);
    // ties
    for (let cy = 0; cy < 60; cy += 14) {
      ctx.fillStyle = 'rgba(70,40,20,0.5)';
      ctx.fillRect(0, ty + cy, 8, 3); ctx.fillRect(W - 8, ty + cy, 8, 3);
    }
  }
  // Stalactites/stalagmites (cave spikes) — cone shapes hugging side walls
  for (const s of caveSpikes) {
    if (s.y < -30 || s.y > H + 30) continue;
    ctx.save();
    ctx.fillStyle = '#5a3a1c';
    ctx.beginPath();
    if (s.side === 'left') {
      // narrow cones pointing right
      if (s.orient === 'top') {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8);
      } else {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8);
      }
    } else {
      if (s.orient === 'top') {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8);
      } else {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8);
      }
    }
    ctx.closePath(); ctx.fill();
    // darker shading
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    if (s.side === 'left') {
      if (s.orient === 'top') { ctx.moveTo(s.x, s.y + 4); ctx.lineTo(s.x + s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8); }
      else { ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x + s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8); }
    } else {
      if (s.orient === 'top') { ctx.moveTo(s.x, s.y + 4); ctx.lineTo(s.x - s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8); }
      else { ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x - s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8); }
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Mid parallax: closer rocks (faster)
  const parY2 = (caveOffset * 0.85) % 160;
  ctx.fillStyle = biome.rockB;
  for (let yy = -160; yy < H + 160; yy += 160) {
    for (let i = 0; i < 4; i++) {
      const cx = (i / 3) * W + 40;
      const cy = yy + parY2;
      ctx.fillRect(cx - 18, cy - 12, 36, 24);
      ctx.fillRect(cx - 22, cy + 8, 44, 6);
    }
  }
  // Glow embers (cheap, additive)
  ctx.globalCompositeOperation = 'lighter';
  for (const e of embers) {
    const a = 1 - e.life / e.max;
    if (e.color && (e.dust || e.feather)) {
      // Round 2C: dust + feathers use source-over so they don't bleach white
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
    } else if (e.color && e.glow) {
      // Fireball trail — use stored color with additive blend
      ctx.fillStyle = e.color;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(255,${140 + Math.floor(80 * a)},40,${a * 0.7})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  // Platform palette by kind (compact lookup, Round 2 + TELEPORTER)
  const _PKINDS = {
    spring:    ['#3a8e4c','#5ef38c','#fff7d0'],
    conveyor:  ['#5a4a3a','#b0a070','#ffd23f'],
    rotating:  ['#4a3a5a','#b08acf','#b055ff'],
    moving:    ['#3a4a5a','#5ec0e8','#4cc9f0'],
    bouncy:    ['#b055ff','#d59aff','#ff8aa8'],
    crumble:   ['#8a6a4a','#a68a6a','#ff8e3c'],
    normal:    ['#5a3a1c','#7a5a3a','#5ef38c'],
    teleporter:['#1a4a6a','#4cc9f0','#fff7d0'],
  };
  for (const p of plats) {
    if (!p.alive) continue;
    const isCrumble = p.kind === 'crumble', isBouncy = p.kind === 'bouncy';
    const isSpring = p.kind === 'spring', isSafe = p.kind === 'safe';
    const isDisappear = p.kind === 'disappearing';
    const frozen = (iceFrozenT.get(p) || 0) > 0;
    const crumbleAge = p.crumbleStartT ? (performance.now() - p.crumbleStartT) : 0;
    const crumbleRed = isCrumble && crumbleAge > 500;
    let color, topColor, grassColor;
    const isTele = p.kind === 'teleporter';
    if (frozen) { color = '#4a8aaa'; topColor = '#8acce0'; grassColor = '#caf0ff'; }
    else if (isSafe) { const k = 0.7 + 0.3 * Math.sin(performance.now() / 250); color = `rgba(40,180,80,${k})`; topColor = `rgba(160,255,180,${k})`; grassColor = '#fff7d0'; }
    else if (isTele) {
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 200);
      if (p.teleportHue === 1) { color = `rgba(140,30,90,${pulse})`; topColor = `rgba(255,90,180,${pulse})`; grassColor = '#ff3aa1'; }
      else { color = `rgba(20,80,120,${pulse})`; topColor = `rgba(90,200,240,${pulse})`; grassColor = '#4cc9f0'; }
    }
    else if (isDisappear) { const fade = p.touched ? 1 - p.disappearT : 1; color = `rgba(180,90,90,${fade})`; topColor = `rgba(230,150,150,${fade})`; grassColor = `rgba(255,200,200,${fade})`; }
    else if (crumbleRed) { color = '#a83830'; topColor = '#d05050'; grassColor = '#ff8e3c'; }
    else { const arr = _PKINDS[p.kind] || _PKINDS.normal; color = arr[0]; topColor = arr[1]; grassColor = arr[2]; }
    // Round 2C: bouncy platform squash — exaggerated vertical compress that
    // eases back; draws at slightly reduced height + wider so spring reads.
    let pX = p.x, pW = p.w, pY = p.y, pH = p.h;
    if (isBouncy && p.squashT > 0) {
      const k = p.squashT / 0.25; // 1 = full squash, 0 = settled
      const sq = 1 - 0.35 * k;    // 1.0 -> 0.65 height
      const stretch = 1 + 0.18 * k; // 1.0 -> 1.18 width
      const nw = pW * stretch;
      pX = p.x - (nw - pW) / 2;
      pW = nw;
      pH = p.h * sq;
      pY = p.y + (p.h - pH); // anchored at bottom so squash compresses downward
    }
    // depth3D: fade distant platforms (top of viewport) to simulate atmospheric
    // perspective — closer platforms render at full alpha, far ones at ~0.55.
    const _depthFade = Math.min(1, 0.55 + (pY / H) * 0.6);
    if (!_depthReduced() && _depthFade < 1) ctx.globalAlpha = _depthFade;
    // shadow on the side wall — small dark sliver beneath each platform
    if (!_depthReduced()) {
      const _prevA = ctx.globalAlpha;
      ctx.globalAlpha = _prevA * 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(pX, pY + pH, pW, 3);
      ctx.globalAlpha = _prevA;
    }
    ctx.fillStyle = color; ctx.fillRect(pX, pY, pW, pH);
    ctx.fillStyle = topColor; ctx.fillRect(pX, pY, pW, 3);
    ctx.fillStyle = grassColor; ctx.fillRect(pX, pY - 3, pW, 3);
    // v1.8 polish — bottom edge darker rim gives a 3D bevel
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(pX, pY + pH - 1, pW, 1);
    // Right-edge form shadow (tiny vertical sliver)
    ctx.fillRect(pX + pW - 1, pY, 1, pH);
    // SPIKE on top (kills on landing)
    if (p.hasSpike) {
      const sx = p.x + p.w / 2;
      ctx.fillStyle = '#cacad6';
      ctx.beginPath();
      ctx.moveTo(sx - 5, p.y - 3); ctx.lineTo(sx + 5, p.y - 3); ctx.lineTo(sx, p.y - 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a8a9a';
      ctx.beginPath();
      ctx.moveTo(sx, p.y - 3); ctx.lineTo(sx + 5, p.y - 3); ctx.lineTo(sx, p.y - 14);
      ctx.closePath(); ctx.fill();
      // base
      ctx.fillStyle = '#5a5a72';
      ctx.fillRect(sx - 6, p.y - 4, 12, 2);
    }
    // Hanging vines under platform
    if (p.vine && !isCrumble) {
      const vx = p.x + 12;
      const sway = Math.sin(performance.now() * 0.002 + p.x * 0.05) * 4;
      ctx.strokeStyle = '#3a8e4c'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, p.y + p.h);
      ctx.quadraticCurveTo(vx + sway, p.y + p.h + 14, vx + sway, p.y + p.h + 28);
      ctx.stroke();
      ctx.fillStyle = '#5ef38c';
      ctx.fillRect(vx + sway - 2, p.y + p.h + 26, 4, 4);
    }
    // Wood-grain texture (vertical streaks)
    if (!isBouncy) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      const seed = Math.floor(p.x * 13 + p.w * 7) % 11;
      for (let i = 0; i < Math.floor(p.w / 14); i++) {
        const gx = p.x + 4 + i * 14 + ((seed + i) % 4);
        ctx.fillRect(gx, p.y + 4, 1, p.h - 6);
      }
    }
    // Moss tufts on top of normal platforms — v1.8 polish: multi-blade tufts
    if (!isBouncy && !isCrumble && p.w > 80) {
      // Left tuft (3 blades)
      ctx.fillStyle = '#3a8e4c';
      ctx.fillRect(p.x + 8, p.y - 5, 1, 2);
      ctx.fillRect(p.x + 10, p.y - 6, 1, 3);
      ctx.fillRect(p.x + 12, p.y - 5, 1, 2);
      ctx.fillStyle = '#5ef38c';
      ctx.fillRect(p.x + 10, p.y - 7, 1, 1);
      // Tiny flower
      if (p.w > 120) {
        ctx.fillStyle = '#ff8aa8';
        ctx.fillRect(p.x + p.w / 2 - 1, p.y - 5, 2, 2);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(p.x + p.w / 2, p.y - 4, 1, 1);
      }
      // Right tuft (mirror)
      ctx.fillStyle = '#3a8e4c';
      ctx.fillRect(p.x + p.w - 14, p.y - 5, 1, 2);
      ctx.fillRect(p.x + p.w - 12, p.y - 6, 1, 3);
      ctx.fillRect(p.x + p.w - 10, p.y - 5, 1, 2);
      ctx.fillStyle = '#5ef38c';
      ctx.fillRect(p.x + p.w - 12, p.y - 7, 1, 1);
    }
    // crumble indicator: cracks if started crumbling
    if (isCrumble && p.crumbleStartT) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x + 6, p.y + 4, 4, 2);
      ctx.fillRect(p.x + p.w - 14, p.y + 6, 4, 2);
      ctx.fillRect(p.x + p.w / 2 - 2, p.y + 3, 1, p.h - 4);
    }
    // Round 2: per-kind decorations (CONVEYOR arrows, ROTATING gear, SPRING coil, TELEPORTER ring)
    if (p.kind === 'conveyor' && p.conveyorDir) {
      const flow = (performance.now() * 0.15) % 18;
      ctx.fillStyle = '#fff7d0';
      for (let i = -1; i < (p.w / 18 | 0) + 1; i++) {
        const ax = p.x + (i * 18 + flow * p.conveyorDir + p.w) % (p.w + 18);
        if (ax < p.x - 6 || ax > p.x + p.w - 4) continue;
        ctx.beginPath();
        if (p.conveyorDir > 0) { ctx.moveTo(ax, p.y + 5); ctx.lineTo(ax + 6, p.y + 8); ctx.lineTo(ax, p.y + 11); }
        else { ctx.moveTo(ax + 6, p.y + 5); ctx.lineTo(ax, p.y + 8); ctx.lineTo(ax + 6, p.y + 11); }
        ctx.closePath(); ctx.fill();
      }
    } else if (p.kind === 'rotating') {
      ctx.save(); ctx.translate(p.x + p.w / 2, p.y + p.h / 2); ctx.rotate(p.rotateAng);
      ctx.fillStyle = '#d59aff';
      for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.fillRect(-2, -7, 4, 4); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'spring') {
      ctx.strokeStyle = '#fff7d0'; ctx.lineWidth = 2;
      const compress = p.squashT > 0 ? (1 - p.squashT * 0.5) : 1;
      const cx = p.x + p.w / 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { const cy = p.y - 2 - i * 3 * compress; ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy - 2); }
      ctx.stroke();
    } else if (p.kind === 'teleporter') {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      const col = p.teleportHue === 1 ? '#ff3aa1' : '#4cc9f0';
      ctx.save();
      ctx.globalAlpha = 0.5 + pulse * 0.5;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.y - 4, p.w / 2 - 4, 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(p.x + p.w / 2 - 4, p.y - 6, 8, 2);
      ctx.fillRect(p.x + p.w / 2 - 2, p.y - 4, 4, 2);
      ctx.restore();
    }
    // restore alpha after the depth3D fade
    if (ctx.globalAlpha !== 1) ctx.globalAlpha = 1;
  }
  // Round 2: WIND CURRENTS — translucent swirl bands with directional arrows
  for (const w of windCurrents) {
    const a = Math.min(Math.min(1, w.life / 0.8), Math.min(1, (w.max - w.life) / 1.2));
    ctx.save();
    ctx.globalAlpha = 0.18 * a;
    ctx.fillStyle = '#caf0ff';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.globalAlpha = 0.5 * a;
    ctx.strokeStyle = '#caf0ff'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const t = (performance.now() * 0.001 + i * 0.5 + w.ampT * 0.5) % 1;
      const sy = w.y + t * w.h;
      ctx.beginPath();
      for (let xi = 0; xi <= 4; xi++) {
        const px = w.x + (xi / 4) * w.w;
        const py = sy + Math.sin((xi / 4) * Math.PI * 2 + w.ampT) * 4;
        if (xi === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Direction arrow
    ctx.globalAlpha = 0.85 * a;
    ctx.fillStyle = '#fff';
    const ax = w.dir > 0 ? w.x + w.w - 14 : w.x + 8, ay = w.y + w.h / 2;
    ctx.beginPath();
    if (w.dir > 0) { ctx.moveTo(ax, ay - 5); ctx.lineTo(ax + 8, ay); ctx.lineTo(ax, ay + 5); }
    else { ctx.moveTo(ax + 8, ay - 5); ctx.lineTo(ax, ay); ctx.lineTo(ax + 8, ay + 5); }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Powerups — jetpack uses pixel-art flame; freeze/shrink/wings use primitives.
  for (const p of powerups) {
    const colors = { jetpack: '#ff8e3c', freeze: '#4cc9f0', shrink: '#b055ff', wings: '#fff7d0' };
    ctx.shadowColor = colors[p.type]; ctx.shadowBlur = 12;
    ctx.fillStyle = colors[p.type]; ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
    ctx.shadowBlur = 0;
    if (p.type === 'jetpack') {
      drawIcon.flame(ctx, p.x, p.y, 16);
    } else if (p.type === 'freeze') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.x - 7, p.y - 1, 14, 2);
      ctx.fillRect(p.x - 1, p.y - 7, 2, 14);
      ctx.fillRect(p.x - 5, p.y - 5, 2, 2); ctx.fillRect(p.x + 3, p.y - 5, 2, 2);
      ctx.fillRect(p.x - 5, p.y + 3, 2, 2); ctx.fillRect(p.x + 3, p.y + 3, 2, 2);
    } else if (p.type === 'shrink') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 5); ctx.lineTo(p.x + 7, p.y - 5); ctx.lineTo(p.x, p.y + 7);
      ctx.closePath(); ctx.fill();
    } else if (p.type === 'wings') {
      // Pair of small wing shapes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(p.x - 1, p.y);
      ctx.quadraticCurveTo(p.x - 9, p.y - 6, p.x - 8, p.y + 3);
      ctx.quadraticCurveTo(p.x - 5, p.y + 1, p.x - 1, p.y + 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x + 1, p.y);
      ctx.quadraticCurveTo(p.x + 9, p.y - 6, p.x + 8, p.y + 3);
      ctx.quadraticCurveTo(p.x + 5, p.y + 1, p.x + 1, p.y + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 4);
    }
  }
  // Lava blobs
  for (const b of blobs) {
    ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(b.x - 3, b.y - 3, 2, 2);
    ctx.fillRect(b.x + 1, b.y - 3, 2, 2);
  }
  // Bats — pixel-art shape (body + flapping wings). Dying bats roll over.
  // v1.8 polish: layered membrane shading + wing bones + fangs.
  for (const b of bats) {
    const flap = Math.sin(b.ampT * 4) * 6;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (!b.alive) ctx.rotate(Math.PI); // upside-down on death
    // Wing membranes (darker outer) — same triangles but anchor curve
    ctx.fillStyle = '#2a1240';
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(-15, -2 - flap); ctx.lineTo(-13, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, 0); ctx.lineTo(15, -2 - flap); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill();
    // Wing inner highlights (lighter purple, smaller triangle inside)
    ctx.fillStyle = '#6a3a8a';
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(-10, -1 - flap * 0.7); ctx.lineTo(-8, 3); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(10, -1 - flap * 0.7); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
    // Wing bone lines
    ctx.strokeStyle = '#1a0a30'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(-13, -1 - flap); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, 0); ctx.lineTo(13, -1 - flap); ctx.stroke();
    // Body
    ctx.fillStyle = b.alive ? '#2a0a3a' : '#5a3a5a';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    // Body highlight
    ctx.fillStyle = b.alive ? '#5a2a6a' : '#7a5a7a';
    ctx.beginPath(); ctx.arc(-1, -2, 2, 0, Math.PI * 2); ctx.fill();
    // Glowing eyes (sharper)
    if (b.alive) {
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(-3, -1, 2, 2); ctx.fillRect(1, -1, 2, 2);
      // Pupil glint
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-2, 0, 1, 1); ctx.fillRect(2, 0, 1, 1);
      // Tiny fangs
      ctx.fillStyle = '#fff';
      ctx.fillRect(-2, 3, 1, 2); ctx.fillRect(1, 3, 1, 2);
    } else {
      // Dead bat: white "x"s for eyes — use a tiny readable font instead of
      // relying on whatever previous ctx.font was leaked in.
      ctx.fillStyle = '#fff';
      ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('x', -2, 1); ctx.fillText('x', 2, 1);
    }
    // Tiny pointy ears (with inner highlight)
    ctx.fillStyle = b.alive ? '#2a0a3a' : '#5a3a5a';
    ctx.fillRect(-4, -7, 2, 3); ctx.fillRect(2, -7, 2, 3);
    ctx.fillStyle = b.alive ? '#5a2a6a' : '#7a5a7a';
    ctx.fillRect(-4, -7, 1, 1); ctx.fillRect(2, -7, 1, 1);
    ctx.restore();
  }
  // Fireballs — pulsing red/orange ball with trail
  // v1.8 polish: layered halo + smoke wisps + harder white-hot center.
  for (const f of fireballs) {
    const tNow = performance.now() * 0.01;
    // Outer glow halo (radial gradient)
    const grd = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r * 2.2);
    grd.addColorStop(0, 'rgba(255,210,63,0.65)');
    grd.addColorStop(0.5, 'rgba(255,90,58,0.35)');
    grd.addColorStop(1, 'rgba(255,90,58,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 2.2, 0, Math.PI * 2); ctx.fill();
    // Tail behind (longer + dimmer)
    ctx.fillStyle = 'rgba(255,180,60,0.45)';
    for (let i = 1; i <= 5; i++) {
      const tx = f.x - (f.vx / 220) * i * 5;
      const ty = f.y - (f.vy / 220) * i * 5;
      ctx.beginPath(); ctx.arc(tx, ty, Math.max(0.5, f.r - i * 1.3), 0, Math.PI * 2); ctx.fill();
    }
    // Smoke puff behind
    ctx.fillStyle = 'rgba(80,40,30,0.4)';
    for (let i = 5; i <= 7; i++) {
      const tx = f.x - (f.vx / 220) * i * 6;
      const ty = f.y - (f.vy / 220) * i * 6;
      ctx.beginPath(); ctx.arc(tx, ty, 2 + (i - 5), 0, Math.PI * 2); ctx.fill();
    }
    // Core (red)
    ctx.fillStyle = '#ff3a3a';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    // Yellow inner
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(f.x - 1, f.y - 1, f.r * 0.55, 0, Math.PI * 2); ctx.fill();
    // White hot center
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(f.x - 1.5, f.y - 1.5, f.r * 0.25, 0, Math.PI * 2); ctx.fill();
    // Flicker pixel
    if ((tNow | 0) % 2) {
      ctx.fillStyle = '#fff7d0';
      ctx.fillRect(f.x - 2, f.y - 3, 2, 2);
    }
  }
  // ICE DROPS — light-blue droplets falling
  for (const d of iceDrops) {
    ctx.fillStyle = '#caf0ff';
    ctx.beginPath(); ctx.arc(d.x, d.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(d.x - 1, d.y - 3, 2, 2);
    ctx.strokeStyle = 'rgba(160,220,255,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(d.x, d.y - 8); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  // FALLING DEBRIS — grey stone chunks
  for (const d of fallingDebris) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(d.x - d.sz / 2 + 2, d.y - d.sz / 2 + 2, d.sz, d.sz);
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(d.x - d.sz / 2, d.y - d.sz / 2, d.sz, d.sz);
    ctx.fillStyle = '#7a7a8a';
    ctx.fillRect(d.x - d.sz / 2, d.y - d.sz / 2, d.sz, 2);
    ctx.strokeStyle = '#3a3a4a';
    ctx.strokeRect(d.x - d.sz / 2, d.y - d.sz / 2, d.sz, d.sz);
  }
  // HAUNTS — translucent ghosts with shimmer + flowing wisp tail (Round 2)
  // v1.8 polish: two-tone glow ring, inner highlight crescent, jagged-edge
  // mouth + dripping ectoplasm trail behind the ghost.
  for (const h of haunts) {
    ctx.save();
    // Outer cyan glow ring (bigger, layered for depth)
    const ghostGrd = ctx.createRadialGradient(h.x, h.y, 5, h.x, h.y, 26);
    ghostGrd.addColorStop(0, `rgba(202,240,255,${h.alpha * 0.35})`);
    ghostGrd.addColorStop(1, 'rgba(76,201,240,0)');
    ctx.fillStyle = ghostGrd;
    ctx.beginPath(); ctx.arc(h.x, h.y, 26, 0, Math.PI * 2); ctx.fill();
    // Ectoplasm tail behind/below
    ctx.globalAlpha = h.alpha * 0.25;
    ctx.fillStyle = '#caf0ff';
    for (let i = 0; i < 4; i++) {
      const ty = h.y + 20 + i * 4;
      const tw = 14 - i * 2;
      ctx.beginPath(); ctx.ellipse(h.x + Math.sin(h.ampT + i) * 3, ty, tw, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Ghost body — more translucent
    ctx.globalAlpha = h.alpha * 0.55;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(h.x, h.y, 12, Math.PI, 0);
    const wobble = Math.sin(h.ampT * 2) * 1.5;
    ctx.lineTo(h.x + 12, h.y + 8 + wobble);
    ctx.lineTo(h.x + 8, h.y + 14 - wobble);
    ctx.lineTo(h.x + 4, h.y + 8 + wobble);
    ctx.lineTo(h.x, h.y + 14 - wobble);
    ctx.lineTo(h.x - 4, h.y + 8 + wobble);
    ctx.lineTo(h.x - 8, h.y + 14 - wobble);
    ctx.lineTo(h.x - 12, h.y + 8 + wobble);
    ctx.closePath(); ctx.fill();
    // Inner shimmer (lighter crescent on body upper-left)
    ctx.globalAlpha = h.alpha * 0.45;
    ctx.fillStyle = '#caf0ff';
    ctx.beginPath(); ctx.arc(h.x - 4, h.y - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = h.alpha * 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(h.x - 5, h.y - 6, 2.5, 0, Math.PI * 2); ctx.fill();
    // Eyes — empty sockets with red pinpricks
    ctx.globalAlpha = h.alpha * 0.95;
    ctx.fillStyle = '#000';
    ctx.fillRect(h.x - 5, h.y - 2, 3, 5); ctx.fillRect(h.x + 3, h.y - 2, 3, 5);
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(h.x - 4, h.y - 1, 1, 1); ctx.fillRect(h.x + 4, h.y - 1, 1, 1);
    // Tiny tear of light from each eye
    ctx.fillStyle = 'rgba(202,240,255,0.5)';
    ctx.fillRect(h.x - 4, h.y + 3, 1, 1); ctx.fillRect(h.x + 4, h.y + 3, 1, 1);
    // Jagged grimace mouth
    ctx.fillStyle = '#000';
    ctx.fillRect(h.x - 2, h.y + 4, 4, 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(h.x - 2, h.y + 4, 1, 1);
    ctx.fillRect(h.x + 1, h.y + 4, 1, 1);
    ctx.restore();
  }
  // METEORS — VOIDSPACE purple flame ball with violet trail
  for (const m of meteors) {
    ctx.fillStyle = 'rgba(176,85,255,0.55)';
    ctx.beginPath(); ctx.arc(m.x - m.vx * 0.04, m.y - m.vy * 0.04, m.sz * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8aff';
    ctx.beginPath(); ctx.arc(m.x, m.y, m.sz, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(m.x - 1, m.y - 2, 2, 2);
  }
  // PET BIRD companion
  if (petBird && usePetBird) {
    const flap = Math.sin(petBird.ampT * 5) * 4;
    ctx.fillStyle = '#fff7d0';
    ctx.beginPath();
    ctx.moveTo(petBird.x - 4, petBird.y); ctx.lineTo(petBird.x - 10, petBird.y - 4 - flap); ctx.lineTo(petBird.x - 8, petBird.y + 2); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(petBird.x + 4, petBird.y); ctx.lineTo(petBird.x + 10, petBird.y - 4 - flap); ctx.lineTo(petBird.x + 8, petBird.y + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(petBird.x, petBird.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8e3c';
    ctx.fillRect(petBird.x + 4, petBird.y - 1, 3, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(petBird.x + 1, petBird.y - 2, 1, 1);
  }
  // Treats
  for (const t of treats) {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(t.x - 6, t.y - 6, 12, 12);
    ctx.shadowBlur = 0;
  }
  // Lava: gradient body with Round 2 wavy top edge
  const lgrd = ctx.createLinearGradient(0, lavaY, 0, H);
  lgrd.addColorStop(0, biome.lava0); lgrd.addColorStop(0.3, biome.lava1); lgrd.addColorStop(1, biome.lava2);
  const t = performance.now() / 600;
  ctx.fillStyle = lgrd;
  ctx.beginPath();
  ctx.moveTo(-8, lavaY + 16);
  for (let xi = 0; xi <= W + 16; xi += 12) {
    const wy = lavaY + Math.sin((xi + t * 60) * 0.04) * 4 + Math.cos((xi + t * 50) * 0.07) * 3;
    ctx.lineTo(xi - 8, wy);
  }
  ctx.lineTo(W + 8, H + 16);
  ctx.lineTo(-8, H + 16);
  ctx.closePath(); ctx.fill();
  // Lava swirl streaks
  ctx.fillStyle = 'rgba(255,210,63,0.35)';
  for (let i = 0; i < 8; i++) {
    const wx = ((i * 137 + t * 30) % (W + 80)) - 40;
    const wy = lavaY + 14 + Math.sin(t + i) * 4 + i * 6;
    ctx.fillRect(wx, wy, 50, 2);
  }
  // Bubble pops (animated arc + Round 2 splash crown)
  for (const bb of lavaBubbles) {
    const k = bb.life / bb.max;
    const r = bb.r * (k < 0.5 ? k * 2 : (1 - k) * 2);
    if (r < 0.5) continue;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(bb.x, bb.y - r * 0.3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(bb.x - r * 0.4, bb.y - r * 0.6, r * 0.4, r * 0.3);
    // Splash crown at peak
    if (k > 0.4 && k < 0.6) {
      ctx.save();
      ctx.globalAlpha = 1 - Math.abs(k - 0.5) * 2;
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(bb.x, bb.y, r * 1.8, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = biome.lava0;
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        const sx2 = bb.x + Math.cos(a) * r * 1.3;
        const sy2 = bb.y - r * 0.8 - Math.sin(j) * 4;
        ctx.fillRect(sx2 - 1, sy2 - 1, 2, 2);
      }
      ctx.restore();
    }
  }
  ctx.fillStyle = biome.lava0;
  ctx.fillRect(-8, lavaY, W + 16, 2);
  // Surface wave bumps
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 14; i++) {
    const x = (i * 73 + performance.now() / 5) % W;
    ctx.beginPath(); ctx.arc(x, lavaY + 4 + Math.sin(t * 2 + i) * 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  // depth3D drop shadow under the pug — anchors him to the platform he's on.
  // v1.8 polish: 2-layer shadow (broader fainter outer, tighter darker inner).
  _depthShadow(ctx, pug.x, pug.y + 14, 14, { alpha: 0.4 });
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(pug.x, pug.y + 15, 9, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Round 2: Pug — squash/stretch + idle bob
  // v1.8 polish: airborne squash is stronger to give jump character; a faint
  // motion blur trail rotated by velocity hints momentum when launching.
  const _pugBob = pug.onGround ? Math.sin(pugBobT * 4) * 1.2 : 0;
  // Boost stretch when shooting upward; boost squash when falling.
  const vySign = pug.vy ? Math.sign(pug.vy) : 0;
  const airStretchBoost = (!pug.onGround && vySign < 0) ? Math.min(0.18, -pug.vy * 0.0006) : 0;
  const airSquashBoost  = (!pug.onGround && vySign > 0) ? Math.min(0.12, pug.vy * 0.0004) : 0;
  const _pugSX = 1 + pugSquashT * 0.35 - pugStretchT * 0.18 - airStretchBoost + airSquashBoost;
  const _pugSY = 1 - pugSquashT * 0.3 + pugStretchT * 0.22 + airStretchBoost - airSquashBoost;
  // Motion-blur ghost trail when launching upward fast
  if (!pug.onGround && pug.vy < -380) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.translate(pug.x, pug.y - pug.vy * 0.015);
    ctx.scale(_pugSX * 0.95, _pugSY * 1.05);
    drawPug(ctx, 0, 0, { size: 30 });
    ctx.restore();
  }
  ctx.save();
  ctx.translate(pug.x, pug.y + _pugBob);
  ctx.scale(_pugSX, _pugSY);
  if (hitFlashT > 0) {
    ctx.filter = 'brightness(2.5)';
    drawPug(ctx, 0, 0, { size: 30 });
    ctx.filter = 'none';
  } else {
    drawPug(ctx, 0, 0, { size: 30 });
  }
  ctx.restore();
  // Outfit overlays — v1.8 polish: jumpsuit gets buttons + stripes; hat gets band trim + brim shadow.
  if (pugOutfit === 'jumpsuit') {
    ctx.fillStyle = '#ff8e3c'; ctx.fillRect(pug.x - 10, pug.y - 4, 20, 14);
    ctx.fillStyle = '#fff'; ctx.fillRect(pug.x - 1, pug.y - 4, 2, 14);
    // Buttons
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(pug.x + 1, pug.y - 1, 2, 2);
    ctx.fillRect(pug.x + 1, pug.y + 4, 2, 2);
    // Stripe trim
    ctx.fillStyle = '#b35a1c';
    ctx.fillRect(pug.x - 10, pug.y + 9, 20, 1);
  } else if (pugOutfit === 'hat') {
    ctx.fillStyle = '#4cc9f0'; ctx.fillRect(pug.x - 10, pug.y - 22, 20, 5);
    ctx.fillRect(pug.x - 6, pug.y - 30, 12, 8);
    // Hat band (darker)
    ctx.fillStyle = '#2a8aaa';
    ctx.fillRect(pug.x - 10, pug.y - 20, 20, 2);
    // Hat crown highlight
    ctx.fillStyle = '#9aebff';
    ctx.fillRect(pug.x - 6, pug.y - 30, 12, 1);
    // Tiny propeller dot
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(pug.x - 1, pug.y - 32, 2, 2);
  }
  // ROCKETBOOT visual aura
  if (rocketBootT > 0) {
    ctx.strokeStyle = `rgba(255,247,208,${0.5 + 0.5 * Math.sin(performance.now() / 100)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff8e3c';
    ctx.beginPath(); ctx.arc(pug.x, pug.y + 14, 4, 0, Math.PI * 2); ctx.fill();
  }
  // SHIELD bubble
  if (shieldT > 0) {
    ctx.strokeStyle = `rgba(76,201,240,${0.5 + Math.sin(performance.now() / 100) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 22, 0, Math.PI * 2); ctx.stroke();
  }
  // Jump indicator (more dots if wings active)
  ctx.fillStyle = wingsT > 0 ? '#fff7d0' : '#5ef38c';
  for (let i = 0; i < pug.jumpsLeft; i++) ctx.fillRect(pug.x - 8 + i * 6, pug.y - 24, 4, 4);
  // Wings flap behind pug
  if (wingsT > 0) {
    const flap = Math.sin(performance.now() * 0.025) * 4;
    ctx.fillStyle = 'rgba(255,247,208,0.85)';
    ctx.beginPath();
    ctx.moveTo(pug.x - 10, pug.y); ctx.quadraticCurveTo(pug.x - 18, pug.y - 4 - flap, pug.x - 14, pug.y + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pug.x + 10, pug.y); ctx.quadraticCurveTo(pug.x + 18, pug.y - 4 - flap, pug.x + 14, pug.y + 6); ctx.closePath(); ctx.fill();
  }
  // Active powerup HUD chips (bottom-left). `iconDraw` is an optional pixel-art icon drawer.
  let py = H - 30;
  const chip = (label, t, color) => {
    if (t <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(12, py - 16, 140, 22);
    ctx.fillStyle = color; ctx.fillRect(12, py - 16, 140 * Math.min(1, t / 5), 4);
    ctx.fillStyle = '#fff'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`${label} ${t.toFixed(1)}s`, 18, py);
    py -= 26;
  };
  chip('JETPACK', jetpackT, '#ff8e3c');
  chip('FREEZE', freezeT, '#4cc9f0');
  chip('SHRINK', shrinkT, '#b055ff');
  chip('WINGS', wingsT, '#fff7d0');
  chip('SHIELD', shieldT, '#4cc9f0');
  chip('+JUMP', doubleJumpExtraT, '#5ef38c');
  chip('SLOW-MO', slowMoT, '#b055ff');
  chip('×2', multiplierT, '#ffd23f');
  chip('ROCKETBOOT', rocketBootT, '#fff7d0');
  // Vertical altitude meter (right edge) + biome zones + best-altitude line
  {
    const mh = H - 100, mw = 18, mx = W - 28, my = 60, altMax = 3000;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(mx, my, mw, mh);
    const _Z = [[0,500,'#5a3a5a','CAVE'],[500,1000,'#5a3a20','MAGMA'],[1000,1500,'#1a2a5a','ABYSS'],[1500,2000,'#5a1018','HELL'],[2000,3000,'#3a1a5a','VOID']];
    for (const z of _Z) {
      const y0 = my + mh - (z[1] / altMax) * mh, y1 = my + mh - (z[0] / altMax) * mh;
      ctx.fillStyle = z[2]; ctx.fillRect(mx, y0, mw, y1 - y0);
      ctx.fillStyle = '#fff'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
      ctx.fillText(z[3], mx - 2, (y0 + y1) / 2 + 2);
    }
    const currY = my + mh - Math.min(altMax, height) / altMax * mh;
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(mx - 4, currY - 2, mw + 8, 4);
    ctx.fillStyle = '#000'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(height + 'm', mx + mw / 2, currY - 6);
    if (bestAltitudeM > 0 && bestAltitudeM < altMax) {
      const bestY = my + mh - bestAltitudeM / altMax * mh;
      // Round 2: dashed best-altitude trail line
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = `rgba(255,210,63,${0.35 + 0.15 * Math.sin(performance.now() / 800)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, bestY); ctx.lineTo(W - 30, bestY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'left'; ctx.fillText('BEST ' + bestAltitudeM + 'm', 12, bestY - 2);
    }
  }
  // Game-mode badge (compact)
  if (gameMode !== 'endless') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(12, 6, 120, 18);
    ctx.fillStyle = '#ff3aa1'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(gameMode === 'challenge' ? `CHALLENGE ${challengeTarget}m` : (gameMode === 'time_attack' ? `TIME ${timeAttackT.toFixed(1)}s` : 'DEATH RUN · 1 LIFE'), 16, 18);
  }
  // Combo HUD (top-center). Always visible once chain hits 2+, even before
  // crossing a threshold so the player understands a chain is building.
  if (comboJumps >= 2) {
    const cw = 150, ch = 26;
    const cx = W / 2 - cw / 2, cy = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = comboJumps >= 10 ? '#ff3aa1' : (comboJumps >= 5 ? '#ffd23f' : '#5ef38c');
    ctx.fillRect(cx, cy, cw, 3);
    ctx.fillStyle = '#fff';
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(`COMBO ×${comboJumps}`, W / 2, cy + 18);
  }
  // Biome tag (top-right small chip) — pulse the border during a shift so
  // the player notices the palette is mid-transition.
  {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(W - 108, 36, 96, 20);
    if (biomeShiftT > 0) {
      const k = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
      ctx.strokeStyle = `rgba(255,58,58,${0.5 + 0.5 * k})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(W - 108, 36, 96, 20);
    }
    ctx.fillStyle = biomeShiftT > 0 ? '#ff3a3a' : '#c8c8d8';
    ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
    ctx.fillText(biome.name, W - 14, 50);
  }
  // Score popups
  ctx.textAlign = 'center';
  ctx.font = "12px 'Press Start 2P', monospace";
  for (const pp of popups) {
    const a = 1 - pp.life / pp.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillText(pp.text, pp.x + 1, pp.y + 1);
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, pp.x, pp.y);
    ctx.globalAlpha = 1;
  }
  // Milestone banner
  if (banner) {
    const a = banner.life < 0.3 ? banner.life / 0.3 : (banner.life > banner.max - 0.4 ? (banner.max - banner.life) / 0.4 : 1);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 180, H * 0.25 - 24, 360, 48);
    ctx.fillStyle = '#5ef38c';
    ctx.fillRect(W / 2 - 180, H * 0.25 - 24, 360, 3);
    ctx.fillRect(W / 2 - 180, H * 0.25 + 21, 360, 3);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "18px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(banner.text, W / 2, H * 0.25 + 6);
    ctx.globalAlpha = 1;
  }
  // Hit flash overlay (red tint)
  if (hitFlashT > 0) {
    ctx.fillStyle = `rgba(255,58,58,${Math.min(0.6, hitFlashT * 2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Round 2: PAUSE overlay + resume countdown (3-2-1)
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    if (resumeCountdownT > 0) {
      const n = Math.ceil(resumeCountdownT);
      const pulse = 1 + (1 - (resumeCountdownT % 1)) * 0.4;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd23f';
      ctx.font = "64px 'Press Start 2P', monospace";
      ctx.fillText(String(n), 0, 22);
      ctx.restore();
      ctx.fillStyle = '#caf0ff';
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.fillText('GET READY…', W / 2, H / 2 + 80);
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.font = "28px 'Press Start 2P', monospace";
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.fillStyle = '#caf0ff';
      ctx.font = "10px 'Press Start 2P', monospace";
      ctx.fillText('PRESS P / ESC TO RESUME', W / 2, H / 2 + 30);
    }
  }
  ctx.restore();
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _flHud = {
  height: document.getElementById('hud-height'),
  score: document.getElementById('hud-score'),
  best: document.getElementById('hud-best'),
};
let _flHudPrev = { height: -1, score: -1, best: '' };
let _flBestCache = '', _flBestCacheT = 0;
function updateHud() {
  if (height !== _flHudPrev.height) { _flHud.height.textContent = height + 'm'; _flHudPrev.height = height; }
  if (score !== _flHudPrev.score) { _flHud.score.textContent = score; _flHudPrev.score = score; }
  const now = performance.now();
  if (now - _flBestCacheT > 2000) {
    const best = loadBest('floor-lava');
    _flBestCache = (best ? best.height : 0) + 'm';
    _flBestCacheT = now;
  }
  if (_flBestCache !== _flHudPrev.best) { _flHud.best.textContent = _flBestCache; _flHudPrev.best = _flBestCache; }
}

function die(success) {
  if (!running) return; // idempotent
  running = false;
  sfx.sweep(440, 110, 'sawtooth', 0.6, 0.25);
  if (maxHeight > bestAltitudeM) { bestAltitudeM = maxHeight; saveBestAlt(); }
  document.getElementById('end-height').textContent = maxHeight + 'm';
  document.getElementById('end-treats').textContent = treatsGot;
  const _endTitle = document.getElementById('end-title');
  if (_endTitle) _endTitle.textContent = success ? '★ VICTORY! ★' : (gameMode === 'death_run' ? 'DEATH RUN OVER' : (gameMode === 'time_attack' ? `TIME: ${timeAttackT.toFixed(1)}s` : 'CRISPY'));
  const _endSub = document.getElementById('end-sub');
  if (_endSub) _endSub.textContent = success ? `Challenge target ${challengeTarget}m reached!` : 'The lava got you.';
  const { isNewBest, current } = submitRun('floor-lava', { score: maxHeight * 10 + treatsGot * 50, height: maxHeight });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { height: maxHeight };
    bestEl.innerHTML = `Best: <b>${b.height}m</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

// === Wave 1E: game mode + pet + daily seed + outfit selectors ===
const MODES = [
  { id: 'endless', label: 'ENDLESS' },
  { id: 'challenge', label: 'CHALLENGE 1000m' },
  { id: 'time_attack', label: 'TIME ATTACK' },
  { id: 'death_run', label: 'DEATH RUN' },
];
function renderModeRow() {
  const row = document.getElementById('fl-mode-row');
  if (!row) return;
  row.innerHTML = '';
  for (const m of MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fl-mode-btn' + (gameMode === m.id ? ' is-active' : '');
    btn.textContent = m.label;
    btn.addEventListener('click', () => { gameMode = m.id; renderModeRow(); });
    row.appendChild(btn);
  }
}
const OUTFITS = [
  { id: 'classic', label: 'CLASSIC' },
  { id: 'jumpsuit', label: 'JUMPSUIT' },
  { id: 'dress', label: 'DRESS' },
  { id: 'hat', label: 'HAT' },
];
function renderOutfitRow() {
  const row = document.getElementById('fl-outfit-row');
  if (!row) return;
  row.innerHTML = '<span style="font-size:0.4rem;color:var(--muted);align-self:center">OUTFIT:</span>';
  for (const o of OUTFITS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fl-outfit-btn' + (pugOutfit === o.id ? ' is-active' : '');
    btn.textContent = o.label;
    btn.addEventListener('click', () => { pugOutfit = o.id; saveOutfit(); renderOutfitRow(); });
    row.appendChild(btn);
  }
}
function renderAchievementsRow() {
  const row = document.getElementById('fl-achievements');
  if (!row) return;
  row.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const cell = document.createElement('div');
    const unlocked = !!achievementsUnlocked[a.id];
    cell.className = 'fl-ach' + (unlocked ? ' is-unlocked' : '');
    cell.innerHTML = `<span class="fl-ach__title">${unlocked ? '★ ' : '· '}${a.name}</span><span class="fl-ach__desc">${a.desc}</span>`;
    row.appendChild(cell);
  }
}
renderModeRow(); renderOutfitRow(); renderAchievementsRow();
{
  const petCb = document.getElementById('fl-pet');
  if (petCb) { petCb.checked = !!usePetBird; petCb.addEventListener('change', () => { usePetBird = petCb.checked; try { localStorage.setItem('lava:pet', usePetBird ? '1' : '0'); } catch {} }); }
  const dailyCb = document.getElementById('fl-daily');
  if (dailyCb) { dailyCb.checked = !!useDailySeed; dailyCb.addEventListener('change', () => { useDailySeed = dailyCb.checked; }); }
  // Refresh mode row on overlay show
  const so = document.getElementById('overlay');
  if (so) new MutationObserver(() => {
    if (!so.hidden && !so.classList.contains('is-hidden')) { renderModeRow(); renderOutfitRow(); renderAchievementsRow(); }
  }).observe(so, { attributes: true, attributeFilter: ['hidden','class'] });
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  // Reset easter-egg lore flag so next 1337m run pings the toast again
  window._lavaLore = false;
  // Clear any stale keys (e.g., user held a key during the end-overlay) so
  // the pug doesn't auto-walk into lava on restart.
  keys.clear(); touchX = null;
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
  try { music.setIntensity(0.3); music.play(); } catch {}
}
// Altitude-driven music sampler — more frantic the higher you climb.
setInterval(() => {
  if (!running) return;
  try { music.setIntensity(Math.min(1, 0.3 + (maxHeight || 0) / 1400)); } catch {}
}, 600);
(function _wireLavaMusicEnd() {
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
  lastT = now; tick(dt); if (running || paused) render();
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('A/D move · SPACE jump · avoid SPIKES on platforms · grab WINGS for triple-jump', 6500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish (fun-facts, new-best confetti, share, view-data, replay-prompt) ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Bounce platforms refill your double-jump.',
    'TIP: WINGS give you a triple-jump for 6s.',
    'TIP: Watch the strata bands — every 500m = new biome.',
    'TIP: Stomp bats from above for +75 score.',
    'LORE: The lava came from a forgotten pug kitchen.',
    'TIP: Chain landings on new platforms for COMBO bonuses.',
    'LORE: Pugs evolved climbing skills during the Great Spill.',
    'JOKE: Why did the pug climb? Because the floor told it to.',
  ];
  const GAME_ID = 'floor-lava';
  const TITLE_TEXT = 'FLOOR IS LAVA';
  const start = document.getElementById('overlay');
  const end = document.getElementById('end-overlay');
  // Fun-fact rotator (start screen only)
  const factEl = document.getElementById('wg-fun-facts');
  let factIdx = Math.floor(Math.random() * FACTS.length), factTimer = null;
  function showFact() {
    if (!factEl) return;
    factEl.classList.remove('is-shown');
    setTimeout(() => {
      factEl.textContent = FACTS[factIdx % FACTS.length];
      factEl.classList.add('is-shown');
      factIdx++;
    }, 220);
  }
  function startFactLoop() { showFact(); clearInterval(factTimer); factTimer = setInterval(showFact, 4200); }
  function stopFactLoop() { clearInterval(factTimer); if (factEl) factEl.classList.remove('is-shown'); }
  // Show last-best on start (dynamic-imports persistence — robust regardless of static import status)
  function refreshStartBest() {
    const el = document.getElementById('start-best');
    if (!el) return;
    import('../../src/persistence/highScores.js').then(({ loadBest: lb }) => {
      try {
        const best = lb(GAME_ID);
        if (best && (best.height || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.height ? best.height + 'm' : best.score}`;
        } else {
          el.hidden = true;
        }
      } catch {}
    }).catch(() => {});
  }
  // Confetti burst on new-best
  function spawnConfetti() {
    const colors = ['#ffd23f','#ff3aa1','#4cc9f0','#5ef38c','#ff8e3c','#b055ff'];
    const root = document.createElement('div');
    root.className = 'wg-confetti';
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
  // Replay-prompt: short runs get a bigger TRY AGAIN
  let _runStart = 0;
  function markRunStart() { _runStart = performance.now(); }
  function showReplayPrompt() {
    const el = document.getElementById('wg-tryagain');
    if (!el) return;
    const dur = (performance.now() - _runStart) / 1000;
    el.hidden = dur > 20; // short run = nudge to retry
  }
  // Share button — uses Web Share API or falls back to clipboard
  const shareBtn = document.getElementById('wg-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const h = document.getElementById('end-height')?.textContent || '0m';
      const t = document.getElementById('end-treats')?.textContent || '0';
      const text = `🐶 ${TITLE_TEXT} — I climbed ${h} and grabbed ${t} treats! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) {
          await navigator.share({ title: TITLE_TEXT, text, url: 'https://leobalkind.github.io/web-games/' });
        } else {
          await navigator.clipboard.writeText(text);
          shareBtn.textContent = '✓ COPIED!';
          setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800);
        }
      } catch (e) {
        shareBtn.textContent = '⚠ FAILED';
        setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800);
      }
    });
  }
  // Start-overlay observer: start fact loop when visible, stop on hide. Also
  // record run-start time when overlay hides (game starting).
  if (start) {
    const startUpdate = () => {
      const visible = !start.hidden && !start.classList.contains('is-hidden');
      if (visible) { refreshStartBest(); startFactLoop(); }
      else { stopFactLoop(); markRunStart(); }
    };
    new MutationObserver(startUpdate).observe(start, { attributes: true, attributeFilter: ['hidden','class'] });
    startUpdate();
  }
  // End-overlay observer: shake title, new-best banner+confetti, replay prompt
  if (end) {
    const endUpdate = () => {
      const visible = !end.hidden && !end.classList.contains('is-hidden');
      if (!visible) return;
      const title = document.getElementById('end-title');
      if (title) { title.classList.remove('is-shake'); void title.offsetWidth; title.classList.add('is-shake'); }
      // Detect NEW best by looking at the existing end-best content (★ NEW marker)
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
