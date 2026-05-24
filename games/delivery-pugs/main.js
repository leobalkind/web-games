// APOCALYPSE DELIVERY PUGS — top-down driver. Reach the delivery marker
// before time runs out. Dodge zombies, mutant cats, exploding mailboxes.
// Each delivery refills time + small chance of new vehicle (skateboard,
// shopping cart, tiny tank — different stats).
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
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';
import { drawShadow as _depthShadow, depthSort as _depthSort, isReducedMotion as _depthReduced } from '../../src/shared/depth3D.js';

// Scrolling kill feed (top-right) for delivery completions
const __deliveryFeed = createKillFeed({ maxLines: 5, lifespan: 4500 });

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'delivery:muted' });
// Synthwave arcade groove — accelerates during night/storm runs.
const music = createMusicTrack({ mood: 'arcade', tempo: 130, key: 'E', scale: 'minor' });
// City hum ambience — low filtered noise burst every ~7s (cars passing).
let _cityHumT = 0;
function _cityAmbience(dt) {
  if (!running) return;
  _cityHumT -= dt;
  if (_cityHumT <= 0) {
    _cityHumT = 7 + Math.random() * 5;
    try { sfx.noise(0.5, 0.04, 320); } catch {}
  }
}
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'delivery-pugs', getControlsHelp: () => _isTouch
  ? 'JOYSTICK drive · BOOST / HORN buttons · reach the green 📍 marker. Saved to your profile.'
  : 'WASD drive to the green 📍 marker · SHIFT to boost · grab 🔥 powerups. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

// World 1.5× original size (was 2400×1800). Bigger sandbox = more variety, more
// road events, less repetition. Districts get carved out below in buildCityDecor.
const WORLD_W = 3600, WORLD_H = 2700;
// 3 DISTRICTS — horizontal bands across the world. Each has its own palette,
// road density, decor and procedural hazards (Downtown skyscrapers, Suburbs
// kids/houses, Industrial warehouses). District() returns the active one for
// the given world coordinate.
const DISTRICTS = {
  downtown:   { name: 'DOWNTOWN',   roadCol: '#1a1530', sideCol: '#3a3050', tint: 'rgba(60,40,80,0.0)',   accent: '#4cc9f0' },
  suburbs:    { name: 'SUBURBS',    roadCol: '#1f1a30', sideCol: '#3a4030', tint: 'rgba(50,70,40,0.06)',  accent: '#5ef38c' },
  industrial: { name: 'INDUSTRIAL', roadCol: '#1a1a1a', sideCol: '#3a2a20', tint: 'rgba(70,40,20,0.08)',  accent: '#ff8e3c' },
};
function districtAt(x, y) {
  const band = Math.floor(y / (WORLD_H / 3));
  if (band <= 0) return DISTRICTS.downtown;
  if (band === 1) return DISTRICTS.suburbs;
  return DISTRICTS.industrial;
}
const VEHICLES = {
  skateboard:    { name: 'skateboard',   speed: 280, turn: 4.5, hp: 1, color: '#ff8e3c', icon: '🛹' },
  shoppingCart:  { name: 'shop cart',    speed: 240, turn: 5.0, hp: 2, color: '#4cc9f0', icon: '🛒' },
  tinyTank:      { name: 'tiny tank',    speed: 200, turn: 3.0, hp: 4, color: '#5ef38c', icon: '🚙' },
  hoverBoard:    { name: 'hoverboard',   speed: 330, turn: 5.2, hp: 1, color: '#b055ff', icon: '🛹' },
  scooter:       { name: 'scooter',      speed: 260, turn: 4.8, hp: 2, color: '#ffd23f', icon: '🛴' },
  motorbike:     { name: 'motorbike',    speed: 360, turn: 4.0, hp: 1, color: '#ff3a3a', icon: '🏍' },
  pizzaTruck:    { name: 'pizza truck',  speed: 180, turn: 2.4, hp: 6, color: '#5a3a1c', icon: '🍕' },
  rocketSled:    { name: 'rocket sled',  speed: 410, turn: 5.6, hp: 1, color: '#ff5a3a', icon: '🚀' },
  boneChopper:   { name: 'bone chopper', speed: 300, turn: 4.2, hp: 2, color: '#eae0c0', icon: '🦴' },
  // Wave 1E additions — selectable at start. Van trades speed for HP + cargo.
  van:           { name: 'cargo van',    speed: 210, turn: 2.8, hp: 5, color: '#5ef3c0', icon: '🚐' },
};
// Starter trio (selector). All others unlock via streak/earnings.
const STARTER_VEHICLES = ['skateboard', 'motorbike', 'van'];

let pug, vehicle, marker, obstacles, time, deliveries, fuel, running, cam;
let powerups, skidMarks, nitroT, shieldT, magnetT;
// v4 polish: route-start boost trail timer (decays in update loop).
let _routeStartBoostT = 0;
// CARGO FRAGILITY — each delivery starts at 100% intact. Every collision (any
// damage source) drops it 10%. Payout (= time bonus + tip $$) scales with how
// intact the cargo arrives: 1.5× at 100%, 1.0× at 50%, 0.5× at 0%.
let intact = 100;
let intactFlashT = 0; // brief red pulse on damage
let combo = 0, comboT = 0, toxicPuddles = [], spikeStrips = [], achievementsSeen = new Set();
let maxComboThisRun = 0; // surfaced on end-screen (Round-2 polish)
// Crazy Taxi stunt system: continuous-drift timer + near-miss tracking.
// driftHoldT counts up while skidding (continuous slide); once it crosses
// 1.5s a "DRIFT +50" pops and a fresh cycle begins. nearMissCooldown is per-
// zombie debounce so passing a single zombie at speed only fires once.
let driftHoldT = 0;
let driftAwardedT = 0; // tiny suppression so we don't double-award immediately
let nearMissBank = new WeakMap(); // obstacle -> cooldown seconds (so close-call fires once per pass)
let stuntMult = 1; // multiplier from chained drift/near-miss/delivery events; decays over time
let stuntMultT = 0; // seconds remaining before stuntMult decays back to 1
let weather = 'clear'; // 'clear' | 'rain' | 'fog' | 'night'
let weatherT = 0; // seconds remaining in current weather
let raindrops = []; // for rain visual
// World decor (rendered once per match)
let cityCenter = null, trafficLights = [], wreckedCars = [], billboards = [], phonePoles = [], campfires = [], debris = [];
// Wave 1E: districts/houses/etc
let skyscrapers = [], houses = [], warehouses = [], parkedCars = [], kids = [];
let trainTrack = null, train = null, trainCooldown = 30;
let bridges = [], tunnels = [], trafficCars = [];
// Crash spin-out
let crashSpinT = 0, crashSpinAng = 0;
// Customer reaction bubble
let customerBubble = null;
// Delivery type queue
const _DTC = { standard: '#5ef38c', fragile: '#ff8e3c', urgent: '#ffd23f', multi: '#4cc9f0', vip: '#b055ff' };
const _DTG = { standard: '📍', fragile: '📦', urgent: '⚡', multi: '🎁', vip: '⭐' };
let upcomingDeliveries = [], currentDeliveryType = 'standard', multiStops = 0, vipHits = 0;
// Vehicle selector + persistent garage
let selectedStartVehicle = 'skateboard';
let garageUpgrades = { speedT: 0, hpT: 0, fuelT: 0 };
try { const g = JSON.parse(localStorage.getItem('delivery:garage') || '{}'); if (g && typeof g === 'object') Object.assign(garageUpgrades, g); } catch {}
function saveGarage() { try { localStorage.setItem('delivery:garage', JSON.stringify(garageUpgrades)); } catch {} }
let totalEarnings = 0;
try { totalEarnings = parseInt(localStorage.getItem('delivery:earnings') || '0', 10) || 0; } catch {}
function saveEarnings() { try { localStorage.setItem('delivery:earnings', String(totalEarnings)); } catch {} }
let paused = false;
let timeOfDay = 0.3;
// Road events
let eventTimer = 0;
let activeEvent = null;       // {kind:'flood'|'gang'|'package', t, life, x, y, w?, h?, marker?}
let bonusMarker = null;       // {x, y, life} mystery package
// --- Juice: screen shake, hit flash, score popups, smog ---
let shakeT = 0, shakeMag = 0;
let hitFlashT = 0;
let popups = []; // {x, y, text, color, t}
let smog = []; // ambient dust drift particles
let exhaust = []; // tiny exhaust puffs from vehicle
let burst = []; // pickup burst particles
function addShake(mag, dur) { const k = _shakeMul(); shakeMag = Math.max(shakeMag, mag * k); shakeT = Math.max(shakeT, dur); }
function addPopup(x, y, text, color) {
  // Round 2C: lateral spawn velocity so popups don't stack atop each other
  popups.push({ x, y, vx: (Math.random() - 0.5) * 80, text, color: color || '#ffd23f', t: 0 });
  if (popups.length > 30) popups.shift();
}
// Round 2C: tire smoke trail for drifting. Cap at 50 to avoid frame drops.
let tireSmoke = [];
function spawnTireSmoke(x, y) {
  if (tireSmoke.length > 50) return;
  tireSmoke.push({
    x: x + (Math.random() - 0.5) * 18,
    y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 25,
    vy: (Math.random() - 0.5) * 25,
    t: 0, life: 0.65, r: 6 + Math.random() * 5,
  });
}
// Round 2C: weather change flash — brief screen wash on transition
let weatherFlashT = 0;
let weatherFlashCol = 'rgba(255,255,255,0)';
// Stunt multiplier — bumped by drift/near-miss/delivery events. Each bump
// adds 1 to the multiplier (capped at 5x) and refreshes the 6s window. While
// active, awarded score values are scaled up. Decay is handled in tick().
function bumpStunt(_pts) {
  stuntMult = Math.min(5, stuntMult + 1);
  stuntMultT = 6;
}
function addBurst(x, y, color, n) {
  for (let i = 0; i < (n || 8); i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 120;
    burst.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, t: 0, life: 0.6 });
  }
  if (burst.length > 240) burst.splice(0, burst.length - 240);
}
const ACHIEVEMENTS = {
  1: 'FIRST DELIVERY! 🎉',
  5: '5 DELIVERIES — getting good',
  10: '10! pizza is hot',
  25: '25 — neighborhood favorite',
  50: '50 — DELIVERY LEGEND',
  100: '100 — pug of the year',
};
let toasts = []; // {text, t}
const keys = new Set();
let touchAim = null; // legacy — kept null; mobile controls now use synth-WASD via shared module

function reset() {
  // Use selectedStartVehicle (set by selector UI). Apply persistent garage
  // upgrades on top: +20 speed per speedT tier, +1 hp per hpT tier.
  const baseV = VEHICLES[selectedStartVehicle] || VEHICLES.skateboard;
  vehicle = { ...baseV };
  vehicle.speed += (garageUpgrades.speedT || 0) * 20;
  vehicle.hp += (garageUpgrades.hpT || 0);
  pug = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, ang: 0, hp: vehicle.hp };
  // Set up delivery type queue (current + next 3 preview)
  upcomingDeliveries = [];
  for (let i = 0; i < 3; i++) upcomingDeliveries.push({ type: rollDeliveryType(0) });
  currentDeliveryType = rollDeliveryType(0);
  multiStops = currentDeliveryType === 'multi' ? 3 : 0;
  vipHits = 0;
  marker = newMarker();
  obstacles = [];
  for (let i = 0; i < 60; i++) spawnObstacle(); // scaled up with bigger world
  // 6 drones initially
  for (let i = 0; i < 6; i++) spawnDrone();
  powerups = [];
  for (let i = 0; i < 8; i++) spawnPowerup();
  skidMarks = [];
  nitroT = 0; shieldT = 0; magnetT = 0;
  combo = 0; comboT = 0; maxComboThisRun = 0;
  driftHoldT = 0; driftAwardedT = 0;
  nearMissBank = new WeakMap();
  stuntMult = 1; stuntMultT = 0;
  toxicPuddles = []; spikeStrips = []; toasts = [];
  weather = 'clear'; weatherT = 0; raindrops = [];
  crashSpinT = 0; crashSpinAng = 0;
  customerBubble = null; paused = false;
  timeOfDay = 0.3;
  trainCooldown = 30 + Math.random() * 20;
  train = null;
  // Spawn raccoons (3), toxic puddles (8), spike strips (6) — scaled with world
  for (let i = 0; i < 3; i++) spawnRaccoon();
  for (let i = 0; i < 8; i++) toxicPuddles.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), r: 36 });
  for (let i = 0; i < 6; i++) spikeStrips.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), w: 80 });
  // Time/fuel with garage upgrade
  time = 35; deliveries = 0; fuel = 100 + (garageUpgrades.fuelT || 0) * 20;
  intact = 100; intactFlashT = 0;
  cam = { x: pug.x, y: pug.y };
  shakeT = 0; shakeMag = 0; hitFlashT = 0;
  popups = []; exhaust = []; burst = [];
  tireSmoke = []; weatherFlashT = 0;
  // seed smog particles across viewport (drift across screen)
  smog = [];
  for (let i = 0; i < 30; i++) {
    smog.push({ x: Math.random() * W, y: Math.random() * H, vx: -8 - Math.random() * 14, vy: -2 - Math.random() * 4, r: 24 + Math.random() * 40, a: 0.04 + Math.random() * 0.06 });
  }
  // Map decoration — generated once per match
  buildCityDecor();
  // Spawn 12 procedural NPC traffic cars after roads exist
  trafficCars = [];
  for (let i = 0; i < 12; i++) spawnTrafficCar();
  // Road events
  eventTimer = 25 + Math.random() * 15;
  activeEvent = null; bonusMarker = null;
}
// Delivery types — bias toward standard early, add variety with more deliveries
function rollDeliveryType(_count) {
  const r = Math.random();
  if (r < 0.45) return 'standard';
  if (r < 0.60) return 'fragile';
  if (r < 0.75) return 'urgent';
  if (r < 0.90) return 'multi';
  return 'vip';
}
function isPerfectCheck() { return intact >= 90 && (currentDeliveryType !== 'vip' || vipHits === 0); }
function spawnTrafficCar() {
  // Pick a horizontal or vertical road and drive along it. Non-hostile.
  const horiz = Math.random() < 0.5;
  const ROAD = 320;
  const lane = Math.floor(Math.random() * Math.max(1, Math.floor((horiz ? WORLD_H : WORLD_W) / ROAD)));
  const colors = ['#4cc9f0','#ffd23f','#5ef38c','#b055ff','#ff3a3a','#ff8e3c','#eaeaff'];
  trafficCars.push({
    horiz,
    pos: rand(80, (horiz ? WORLD_W : WORLD_H) - 80),
    lane: lane * ROAD + 320, // road center
    speed: 90 + Math.random() * 60,
    dir: Math.random() < 0.5 ? 1 : -1,
    color: colors[Math.floor(Math.random() * colors.length)],
    hit: false,
  });
}

function buildCityDecor() {
  // Districts: downtown=top third, suburbs=middle, industrial=bottom
  const bandH = WORLD_H / 3;
  const _skC = ['#2a2540','#3a3050','#4a3a5a','#3a2a4a','#5a4060'];
  const _hsC = ['#5a4030','#5a3a40','#4a5040','#5a5030','#4a3a4a'];
  const _rfC = ['#3a2030','#3a3020','#4a2020'];
  const _pcC = ['#3a3a4a','#5a3a3a','#3a4a3a','#4a3a5a','#52523a'];
  const _kdC = ['#ff3aa1','#4cc9f0','#5ef38c','#ffd23f'];
  skyscrapers = []; houses = []; warehouses = []; parkedCars = []; kids = [];
  for (let i = 0; i < 18; i++) {
    const x = rand(120, WORLD_W - 200), y = rand(60, bandH - 200);
    if ((x % 320 < 80) || (y % 320 < 80)) { i--; continue; }
    skyscrapers.push({ x, y, w: 50 + Math.random() * 80, h: 100 + Math.random() * 130, color: _skC[i % 5], seed: i * 73 });
  }
  for (let i = 0; i < 28; i++) {
    const x = rand(80, WORLD_W - 120), y = rand(bandH + 80, 2 * bandH - 80);
    if ((x % 320 < 80) || (y % 320 < 80)) { i--; continue; }
    houses.push({ x, y, w: 60 + Math.random() * 50, h: 40 + Math.random() * 30, color: _hsC[i % 5], roof: _rfC[i % 3], hasLawn: Math.random() < 0.7 });
  }
  for (let i = 0; i < 12; i++) {
    const x = rand(120, WORLD_W - 200), y = rand(2 * bandH + 80, WORLD_H - 200);
    if ((x % 320 < 80) || (y % 320 < 80)) { i--; continue; }
    warehouses.push({ x, y, w: 120 + Math.random() * 100, h: 80 + Math.random() * 60, color: '#3a3030', hasHazard: Math.random() < 0.5 });
  }
  for (let i = 0; i < 30; i++) {
    const horiz = Math.random() < 0.5, ROAD2 = 320, off = Math.random() < 0.5 ? -56 : 56;
    if (horiz) {
      const yRoad = Math.floor(rand(1, WORLD_H / ROAD2)) * ROAD2;
      parkedCars.push({ x: rand(80, WORLD_W - 80), y: yRoad + off, ang: 0, color: _pcC[i % 5] });
    } else {
      const xRoad = Math.floor(rand(1, WORLD_W / ROAD2)) * ROAD2;
      parkedCars.push({ x: xRoad + off, y: rand(80, WORLD_H - 80), ang: Math.PI / 2, color: _pcC[i % 5] });
    }
  }
  for (let i = 0; i < 5; i++) {
    kids.push({ x: rand(120, WORLD_W - 120), y: rand(bandH + 80, 2 * bandH - 80), vx: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 50), color: _kdC[i % 4] });
  }
  trainTrack = { y: bandH * 1.5, dir: 1 };
  bridges = [{ x: WORLD_W * 0.25, y: bandH * 0.7, w: 220, isHorizontal: true }, { x: WORLD_W * 0.7, y: bandH * 2.3, w: 240, isHorizontal: true }];
  tunnels = [{ x: WORLD_W * 0.55, y: bandH * 1.1, w: 200, h: 80 }, { x: WORLD_W * 0.2, y: bandH * 2.5, w: 180, h: 90 }];
  const ROAD = 320;
  // CITY CENTER landmark — at world middle. Crashed bus + radio tower + campfire + debris.
  cityCenter = { x: WORLD_W / 2, y: WORLD_H / 2 };
  // Cluster of debris around center
  debris = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 130;
    debris.push({
      x: cityCenter.x + Math.cos(a) * r,
      y: cityCenter.y + Math.sin(a) * r,
      sz: 6 + Math.random() * 12,
      color: ['#3a2010', '#5a3020', '#222', '#4a3a2a'][Math.floor(Math.random() * 4)],
      ang: Math.random() * Math.PI,
    });
  }
  // Campfire AT city center + a few extras around the world
  campfires = [];
  campfires.push({ x: cityCenter.x - 40, y: cityCenter.y + 60, flickerT: 0, sparks: [] });
  for (let i = 0; i < 4; i++) {
    campfires.push({
      x: rand(80, WORLD_W - 80),
      y: rand(80, WORLD_H - 80),
      flickerT: 0, sparks: [],
    });
  }
  // Traffic lights at road intersections (skip if too close to city center)
  trafficLights = [];
  for (let x = ROAD; x < WORLD_W; x += ROAD) {
    for (let y = ROAD; y < WORLD_H; y += ROAD) {
      if (Math.hypot(x - cityCenter.x, y - cityCenter.y) < 200) continue;
      trafficLights.push({ x: x + 50, y: y - 50, phase: Math.floor(Math.random() * 3), t: Math.random() * 4 });
    }
  }
  // Wrecked cars scattered
  wreckedCars = [];
  for (let i = 0; i < 14; i++) {
    let x, y, ok = false;
    for (let k = 0; k < 12; k++) {
      x = rand(120, WORLD_W - 120); y = rand(120, WORLD_H - 120);
      if (Math.hypot(x - cityCenter.x, y - cityCenter.y) > 220) { ok = true; break; }
    }
    if (!ok) continue;
    wreckedCars.push({
      x, y,
      ang: Math.random() * Math.PI * 2,
      color: ['#3a3a4a', '#5a3a3a', '#3a4a3a', '#52523a'][Math.floor(Math.random() * 4)],
    });
  }
  // Billboards
  const BILL_TEXTS = ['BORK COLA', 'PUGMART', 'CHEESE 24/7', 'BACON BREW', 'WOOFFLIX', 'NEON BARK'];
  const BILL_COLORS = ['#ff3aa1', '#4cc9f0', '#ffd23f', '#5ef38c', '#ff8e3c', '#b055ff'];
  billboards = [];
  for (let i = 0; i < 8; i++) {
    let x, y, ok = false;
    for (let k = 0; k < 12; k++) {
      x = rand(160, WORLD_W - 160); y = rand(160, WORLD_H - 160);
      if (Math.hypot(x - cityCenter.x, y - cityCenter.y) > 260) { ok = true; break; }
    }
    if (!ok) continue;
    billboards.push({
      x, y,
      ang: Math.random() < 0.5 ? 0 : Math.PI / 2,
      text: BILL_TEXTS[i % BILL_TEXTS.length],
      color: BILL_COLORS[i % BILL_COLORS.length],
      scrollT: Math.random() * 4,
    });
  }
  // Telephone poles along edges of roads (sparse)
  phonePoles = [];
  for (let i = 0; i < 24; i++) {
    let x, y;
    if (Math.random() < 0.5) {
      x = (Math.floor(Math.random() * (WORLD_W / ROAD)) + 1) * ROAD - 56;
      y = rand(60, WORLD_H - 60);
    } else {
      x = rand(60, WORLD_W - 60);
      y = (Math.floor(Math.random() * (WORLD_H / ROAD)) + 1) * ROAD - 56;
    }
    if (Math.hypot(x - cityCenter.x, y - cityCenter.y) < 200) continue;
    phonePoles.push({ x, y, neighbor: null });
  }
  // Pair up poles into sagging wire neighbors (closest pole within 280px)
  for (const p of phonePoles) {
    let best = null, bestD = 280;
    for (const q of phonePoles) {
      if (q === p || q.neighbor) continue;
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bestD) { bestD = d; best = q; }
    }
    if (best) p.neighbor = best;
  }
}
function spawnRaccoon() {
  obstacles.push({
    type: 'raccoon',
    x: rand(0, WORLD_W), y: rand(0, WORLD_H),
    vx: 0, vy: 0, speed: 130, stealT: 0,
  });
}
function spawnDrone() {
  obstacles.push({
    type: 'drone',
    x: rand(0, WORLD_W), y: rand(0, WORLD_H),
    vx: 0, vy: 0,
    speed: 90,
    cd: Math.random() * 1.5,
  });
}
const POWERUP_TYPES = ['nitro', 'shield', 'magnet', 'repair'];
function spawnPowerup() {
  const t = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), type: t });
}
function newMarker() {
  // If a pre-built ROUTE is active and has more stops, use the next stop.
  if (activeRoute && activeRoute.stops && activeRoute.index < activeRoute.stops.length) {
    const m = activeRoute.stops[activeRoute.index];
    activeRoute.index++;
    return { x: m[0], y: m[1] };
  }
  // Place at random spot 400-800 from pug
  for (let i = 0; i < 50; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 400 + Math.random() * 400;
    const x = pug.x + Math.cos(ang) * dist;
    const y = pug.y + Math.sin(ang) * dist;
    if (x > 100 && x < WORLD_W - 100 && y > 100 && y < WORLD_H - 100) return { x, y };
  }
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
}

// =============================================================================
// ROUTES — pre-built delivery sequences. Each route has 5 stops chained as a
// loop or chain. Hitting all stops awards a bonus payout. After the route ends
// markers go back to random spawning.
// =============================================================================
const ROUTES = [
  { id: 'free', name: 'FREE-ROAM', icon: '🎲', desc: 'Default — markers spawn anywhere.', target: 0, bonus: 0, stops: null },
  { id: 'downtown', name: 'DOWNTOWN LOOP', icon: '🏙️', desc: '5 dense stops in the city core. Target: 5 deliveries.', target: 5, bonus: 350,
    stops: [[WORLD_W*0.30, WORLD_H*0.20], [WORLD_W*0.55, WORLD_H*0.25], [WORLD_W*0.70, WORLD_H*0.18], [WORLD_W*0.45, WORLD_H*0.12], [WORLD_W*0.25, WORLD_H*0.28]] },
  { id: 'suburb', name: 'SUBURB CHAIN', icon: '🏡', desc: '5 stops zigzagging through suburbs. Target: 5 deliveries.', target: 5, bonus: 300,
    stops: [[WORLD_W*0.20, WORLD_H*0.50], [WORLD_W*0.40, WORLD_H*0.55], [WORLD_W*0.60, WORLD_H*0.45], [WORLD_W*0.80, WORLD_H*0.55], [WORLD_W*0.50, WORLD_H*0.65]] },
  { id: 'industrial', name: 'INDUSTRIAL RUN', icon: '🏭', desc: 'Long-haul through warehouses. Target: 5 deliveries.', target: 5, bonus: 350,
    stops: [[WORLD_W*0.18, WORLD_H*0.82], [WORLD_W*0.45, WORLD_H*0.85], [WORLD_W*0.75, WORLD_H*0.80], [WORLD_W*0.85, WORLD_H*0.70], [WORLD_W*0.30, WORLD_H*0.78]] },
  { id: 'gauntlet', name: 'CROSS-CITY GAUNTLET', icon: '🚀', desc: 'Long diagonals from corner to corner. Target: 4 deliveries.', target: 4, bonus: 500,
    stops: [[WORLD_W*0.10, WORLD_H*0.10], [WORLD_W*0.90, WORLD_H*0.90], [WORLD_W*0.90, WORLD_H*0.10], [WORLD_W*0.10, WORLD_H*0.90]] },
];
let activeRoute = null; // {id, name, icon, target, bonus, stops, index, awarded}
let selectedRouteId = 'free';
// Inject UI into the start overlay.
(function _injectRoutesUI() {
  const panel = document.querySelector('#overlay .overlay__panel');
  if (!panel) return;
  const earn = document.getElementById('dp-earn');
  const wrap = document.createElement('div');
  wrap.id = 'dp-routes';
  wrap.style.cssText = 'margin:8px auto;padding:8px;background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:6px;max-width:520px;';
  wrap.innerHTML = `<div style="font-family:var(--font-display);font-size:0.5rem;color:var(--neon-cyan);text-align:center;letter-spacing:0.08em;margin-bottom:6px;">📍 ROUTE</div>
    <div id="dp-routes-list" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;"></div>
    <div id="dp-route-desc" style="font-size:0.42rem;color:var(--text-soft);text-align:center;margin-top:6px;letter-spacing:0.04em;"></div>`;
  if (earn && earn.parentNode) earn.parentNode.insertBefore(wrap, earn);
  else panel.insertBefore(wrap, panel.firstChild);
  function paint() {
    const list = document.getElementById('dp-routes-list');
    const desc = document.getElementById('dp-route-desc');
    if (!list) return;
    list.innerHTML = ROUTES.map((r) => {
      const active = selectedRouteId === r.id;
      return `<button data-route="${r.id}" style="padding:6px 10px;background:${active?'rgba(94,243,140,0.18)':'rgba(0,0,0,0.5)'};border:2px solid ${active?'#5ef38c':'var(--border)'};color:${active?'#5ef38c':'var(--text-soft)'};border-radius:4px;font-family:var(--font-display);font-size:0.45rem;cursor:pointer;letter-spacing:0.05em;">${r.icon} ${r.name}</button>`;
    }).join('');
    const sel = ROUTES.find((r) => r.id === selectedRouteId);
    if (desc && sel) {
      desc.innerHTML = sel.id === 'free' ? sel.desc : `${sel.desc} <b style="color:var(--neon-yellow);">Bonus: $${sel.bonus}</b>`;
    }
    list.querySelectorAll('button[data-route]').forEach((b) => {
      b.addEventListener('click', () => { selectedRouteId = b.getAttribute('data-route'); paint(); });
    });
  }
  paint();
})();
function spawnObstacle() {
  const type = Math.random();
  let o;
  // Reroll up to 5x if it lands on a bridge (no zombies/cats/mailboxes on bridges).
  let x, y;
  for (let attempt = 0; attempt < 5; attempt++) {
    x = rand(0, WORLD_W); y = rand(0, WORLD_H);
    if (!isOnBridge(x, y)) break;
  }
  if (type < 0.45) {
    o = { type: 'zombie', x, y, vx: 0, vy: 0, speed: 50 + Math.random() * 40 };
  } else if (type < 0.75) {
    o = { type: 'cat', x, y, vx: 0, vy: 0, speed: 110, jumpT: 0 };
  } else {
    o = { type: 'mailbox', x, y, fuse: -1 }; // -1 = stationary, set positive when triggered
  }
  obstacles.push(o);
}
function isOnBridge(x, y) {
  if (!bridges) return false;
  for (const b of bridges) {
    if (b.isHorizontal && Math.abs(y - b.y) < 28 && x > b.x - b.w / 2 && x < b.x + b.w / 2) return true;
  }
  return false;
}
function isInTunnel(x, y) {
  if (!tunnels) return false;
  for (const t of tunnels) {
    if (x > t.x - t.w / 2 && x < t.x + t.w / 2 && y > t.y - t.h / 2 && y < t.y + t.h / 2) return true;
  }
  return false;
}
function rand(a, b) { return a + Math.random() * (b - a); }

function triggerRoadEvent() {
  const pick = Math.floor(Math.random() * 3);
  if (pick === 0) {
    // FLASH FLOOD — random street area near player
    const cx = pug.x + (Math.random() - 0.5) * 600;
    const cy = pug.y + (Math.random() - 0.5) * 400;
    activeEvent = {
      kind: 'flood',
      x: Math.max(120, Math.min(WORLD_W - 120, cx)),
      y: Math.max(120, Math.min(WORLD_H - 120, cy)),
      w: 240, h: 160,
      t: 0, life: 18,
    };
    toasts.push({ text: 'EVENT: FLASH FLOOD!', t: 0 });
    hitFlashT = 0.12;
    sfx.tone(220, 'sine', 0.3, 0.25);
  } else if (pick === 1) {
    // GANG CHASE — spawn 3 tagged zombies near player
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 260 + Math.random() * 60;
      obstacles.push({
        type: 'zombie',
        x: Math.max(40, Math.min(WORLD_W - 40, pug.x + Math.cos(a) * r)),
        y: Math.max(40, Math.min(WORLD_H - 40, pug.y + Math.sin(a) * r)),
        vx: 0, vy: 0, speed: 130 + Math.random() * 30,
        _gang: true,
      });
    }
    activeEvent = { kind: 'gang', t: 0, life: 12 };
    toasts.push({ text: 'EVENT: GANG CHASE!', t: 0 });
    hitFlashT = 0.15;
    sfx.sweep(440, 110, 'sawtooth', 0.3, 0.25);
    addShake(5, 0.22);
  } else {
    // MYSTERY PACKAGE — spawn bonus marker 350-650 from player
    let bx, by;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 350 + Math.random() * 300;
      bx = pug.x + Math.cos(a) * r;
      by = pug.y + Math.sin(a) * r;
      if (bx > 100 && bx < WORLD_W - 100 && by > 100 && by < WORLD_H - 100) break;
    }
    bonusMarker = { x: bx, y: by, life: 20 };
    activeEvent = { kind: 'package', t: 0, life: 20 };
    toasts.push({ text: 'EVENT: MYSTERY PACKAGE (2x reward)', t: 0 });
    sfx.arp([523, 784, 1047], 'triangle', 0.08, 0.22, 0.2);
  }
}

window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
// Mobile controls — wasd-mouse joystick + HORN/NITRO action buttons.
// Joystick synthesises WASD into the shared `keys` Set so the existing top-down
// movement code at line ~400 works unchanged.
createMobileControls({
  layout: 'wasd-only',
  keys,
  buttons: [
    { id: 'horn',  label: 'HORN',  key: 'Space' },
    { id: 'nitro', label: 'NITRO', key: 'Shift' },
  ],
  getCanvas: () => canvas,
});
// Driving + delivery arrow + minimap = better with horizontal room.
showOrientationHint({ gameId: 'delivery-pugs' });

function tick(dt) {
  if (!running) return;
  if (paused) return;
  // Polish R2: auto-resume countdown — count down but skip world updates
  if (resumeCountdownT > 0) {
    resumeCountdownT = Math.max(0, resumeCountdownT - dt);
    return;
  }
  _cityAmbience(dt);
  timeOfDay = (timeOfDay + dt / 120) % 1;
  time -= dt;
  if (time <= 0) return end();
  if (crashSpinT > 0) { crashSpinT -= dt; crashSpinAng += dt * 18; }
  if (customerBubble) { customerBubble.life += dt; if (customerBubble.life >= customerBubble.max) customerBubble = null; }
  // Polish R2: SHARK (waterfront visual gag) — fin pops up in the water area
  // every ~12-20s. Pure visual + minor damage if you drive into the pier
  // section while it's there.
  if (shark) {
    shark.t += dt;
    shark.x += shark.vx * dt;
    if (shark.t > 5 || shark.x < WORLD_W * WATERFRONT_X + 80 || shark.x > WORLD_W - 30) {
      shark = null;
    }
  } else if (isWaterfront(pug.x) && Math.random() < dt * 0.05) {
    // Spawn near pug's Y in the water
    shark = {
      x: WORLD_W * WATERFRONT_X + 100 + Math.random() * 80,
      y: pug.y + (Math.random() - 0.5) * 200,
      vx: 50 + Math.random() * 30,
      t: 0,
    };
    try { sfx.tone(110, 'sine', 0.35, 0.25); } catch {}
    try { __deliveryFeed.push('🦈 SHARK SPOTTED', '#dde6f0'); } catch {}
  }
  // Polish R2: ZOMBIE RAVE event (night-only). Cluster of 50 zombies in one
  // spot. Driving through gives big bonus + risk.
  zombieRaveCdT -= dt;
  if (!zombieRave && weather === 'night' && zombieRaveCdT <= 0 && Math.random() < dt * 0.04) {
    // Place cluster a reasonable distance from pug
    const ang = Math.random() * Math.PI * 2;
    const dist = 700 + Math.random() * 400;
    let zx = pug.x + Math.cos(ang) * dist;
    let zy = pug.y + Math.sin(ang) * dist;
    zx = Math.max(200, Math.min(WORLD_W - 200, zx));
    zy = Math.max(200, Math.min(WORLD_H - 200, zy));
    zombieRave = { x: zx, y: zy, life: 22, t: 0, picked: false, bonus: 60 };
    toasts.push({ text: '🧟 ZOMBIE RAVE — drive through for bonus!', t: 0 });
    try { __deliveryFeed.push('★ ZOMBIE RAVE EVENT', '#ff3aa1'); } catch {}
  }
  if (zombieRave) {
    zombieRave.t += dt;
    // Pickup: drive through the center
    if (!zombieRave.picked && Math.hypot(zombieRave.x - pug.x, zombieRave.y - pug.y) < 80) {
      zombieRave.picked = true;
      time = Math.min(time + zombieRave.bonus, 60);
      addPopup(zombieRave.x, zombieRave.y - 30, `+${zombieRave.bonus}s · ZOMBIE RAVE!`, '#ff3aa1');
      addBurst(zombieRave.x, zombieRave.y, '#ff3aa1', 32);
      addBurst(zombieRave.x, zombieRave.y, '#b055ff', 24);
      addShake(10, 0.4);
      sfx.arp([220, 440, 880, 1320, 1760], 'sawtooth', 0.07, 0.28, 0.4);
      try { __deliveryFeed.push(`★ RAVE BONUS +${zombieRave.bonus}s`, '#ff3aa1'); } catch {}
      // Tiny intact loss to balance the big bonus
      intact = Math.max(0, intact - 8);
      intactFlashT = 0.4;
    }
    if (zombieRave.t > zombieRave.life) {
      zombieRave = null;
      zombieRaveCdT = 35 + Math.random() * 20;
    }
  }
  // Train
  trainCooldown -= dt;
  if (!train && trainCooldown <= 0 && trainTrack) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    train = { x: dir > 0 ? -200 : WORLD_W + 200, y: trainTrack.y, vx: dir * 300, len: 220 };
    toasts.push({ text: '🚂 TRAIN APPROACHING!', t: 0 });
    sfx.tone(110, 'square', 0.6, 0.3);
  }
  if (train) {
    train.x += train.vx * dt;
    // Tunnel safety: train passes overhead while you're inside one (matches
    // the GPS-jam behaviour, where tunnels visually obscure you from the
    // overworld). Avoids the unfair "killed in tunnel by train you can't see".
    const safeInTunnel = isInTunnel(pug.x, pug.y);
    if (!safeInTunnel && Math.abs(pug.y - train.y) < 30 && pug.x > train.x - train.len / 2 - 40 && pug.x < train.x + train.len / 2 + 40) {
      if (shieldT <= 0 && invuln <= 0) {
        // Train is a heavy hit — apply HP cost directly so the i-frame from
        // the first damage() doesn't no-op the second call.
        damage();
        if (pug.hp > 0) { pug.hp = Math.max(0, pug.hp - 1); if (pug.hp <= 0) end(); }
        crashSpin();
      }
    }
    if ((train.vx > 0 && train.x > WORLD_W + 200) || (train.vx < 0 && train.x < -200)) { train = null; trainCooldown = 35 + Math.random() * 25; }
  }
  // NPC traffic
  for (const c of trafficCars) {
    if (c.hit) continue;
    c.pos += c.speed * c.dir * dt;
    if (c.pos < -80 || c.pos > (c.horiz ? WORLD_W : WORLD_H) + 80) c.dir = -c.dir;
    const cx = c.horiz ? c.pos : c.lane, cy = c.horiz ? c.lane : c.pos;
    if (Math.hypot(cx - pug.x, cy - pug.y) < 22 && invuln <= 0 && shieldT <= 0) {
      intact = Math.max(0, intact - 10); intactFlashT = 0.4; invuln = 0.8;
      addPopup(pug.x, pug.y - 12, '-10% TRAFFIC!', '#ff5a3a');
      addBurst(pug.x, pug.y, '#ff5a3a', 12); addShake(6, 0.22);
      sfx.tone(220, 'sawtooth', 0.18, 0.22);
      c.hit = true; setTimeout(() => { c.hit = false; }, 600);
    }
  }
  // Kids
  for (const k of kids) {
    k.x += k.vx * dt;
    if (k.x < 40) k.vx = Math.abs(k.vx); if (k.x > WORLD_W - 40) k.vx = -Math.abs(k.vx);
    if (Math.hypot(k.x - pug.x, k.y - pug.y) < 18 && invuln <= 0) {
      pug.vx *= 0.4; pug.vy *= 0.4;
      intact = Math.max(0, intact - 6); intactFlashT = 0.4; invuln = 0.6;
      addPopup(pug.x, pug.y - 12, 'WATCH OUT, KID!', '#ffd23f');
      addShake(4, 0.2); sfx.tone(880, 'square', 0.12, 0.2);
    }
  }
  // Weather system — every ~25s pick a new condition for 15-25s
  weatherT -= dt;
  if (weatherT <= 0) {
    const options = ['clear', 'clear', 'rain', 'fog', 'night'];
    weather = options[Math.floor(Math.random() * options.length)];
    weatherT = 18 + Math.random() * 10;
    if (weather === 'rain') {
      raindrops = [];
      for (let i = 0; i < 120; i++) raindrops.push({ x: rand(0, W), y: rand(-H, H), vy: 600 + Math.random() * 200 });
    }
    if (weather !== 'clear') toasts.push({ text: weather === 'rain' ? '🌧 RAIN — slower vehicle' : (weather === 'fog' ? '🌫 FOG — short sight' : '🌙 NIGHT'), t: 0 });
    // Round 2C: atmospheric flash on weather change so the transition reads
    weatherFlashT = 0.6;
    weatherFlashCol = weather === 'rain' ? 'rgba(120,180,255,0.18)'
                    : weather === 'fog'  ? 'rgba(220,220,220,0.22)'
                    : weather === 'night' ? 'rgba(20,20,80,0.28)'
                    : 'rgba(255,230,180,0.16)';
  }
  if (weather === 'rain') {
    for (const d of raindrops) { d.y += d.vy * dt; if (d.y > H) { d.y = -10; d.x = rand(0, W); } }
    // Polish R2: lightning flashes (10-18s interval)
    nextLightningT -= dt;
    if (nextLightningT <= 0) {
      lightningFlashT = 0.4;
      nextLightningT = 10 + Math.random() * 8;
      try { sfx.tone(80, 'sawtooth', 0.5, 0.35); } catch {}
    }
    if (lightningFlashT > 0) lightningFlashT = Math.max(0, lightningFlashT - dt);
  } else {
    lightningFlashT = 0;
    nextLightningT = 6 + Math.random() * 8;
  }
  const weatherSpeedMul = weather === 'rain' ? 0.75 : 1;
  // --- Traffic lights cycle (4s per phase) ---
  for (const tl of trafficLights) {
    tl.t += dt;
    if (tl.t >= 4) { tl.t = 0; tl.phase = (tl.phase + 1) % 3; }
  }
  // --- Campfires flicker + spawn sparks ---
  for (const cf of campfires) {
    cf.flickerT -= dt;
    if (cf.flickerT <= 0) cf.flickerT = 0.05 + Math.random() * 0.12;
    if (Math.random() < dt * 8) {
      cf.sparks.push({ x: cf.x + (Math.random() - 0.5) * 6, y: cf.y - 4, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, t: 0, life: 0.7 });
    }
    // Perf: prune in-place via reverse-iter splice
    for (let i = cf.sparks.length - 1; i >= 0; i--) {
      const s = cf.sparks[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 30 * dt;
      if (s.t >= s.life) cf.sparks.splice(i, 1);
    }
  }
  // --- Billboards scroll ---
  for (const b of billboards) b.scrollT += dt;
  // --- Road events ---
  eventTimer -= dt;
  if (activeEvent) {
    activeEvent.t += dt;
    if (activeEvent.kind === 'flood') {
      // Slow player if inside flood box
      const e = activeEvent;
      if (pug.x > e.x - e.w / 2 && pug.x < e.x + e.w / 2 &&
          pug.y > e.y - e.h / 2 && pug.y < e.y + e.h / 2) {
        pug.vx *= Math.pow(0.5, dt * 8);
        pug.vy *= Math.pow(0.5, dt * 8);
      }
    }
    if (activeEvent.t >= activeEvent.life) {
      // End event
      if (activeEvent.kind === 'gang') {
        // remove gang zombies tagged by event
        for (let i = obstacles.length - 1; i >= 0; i--) {
          if (obstacles[i]._gang) obstacles.splice(i, 1);
        }
      }
      if (activeEvent.kind === 'package') bonusMarker = null;
      activeEvent = null;
      eventTimer = 25 + Math.random() * 15;
    }
  } else if (eventTimer <= 0) {
    triggerRoadEvent();
    eventTimer = 25 + Math.random() * 15;
  }
  // Bonus marker pickup
  if (bonusMarker && Math.hypot(pug.x - bonusMarker.x, pug.y - bonusMarker.y) < 44) {
    // Mystery package: intact still scales the bonus 0.5×..1.5×
    const intactMul = 0.5 + (intact / 100);
    const bonus = Math.floor(36 * intactMul);
    time = Math.min(time + bonus, 60);
    intact = 100; intactFlashT = 0;
    deliveries++;
    sfx.arp([523, 880, 1320, 1760], 'triangle', 0.06, 0.25, 0.35);
    addPopup(bonusMarker.x, bonusMarker.y - 10, `+${bonus}s · BONUS!`, '#b055ff');
    addBurst(bonusMarker.x, bonusMarker.y, '#b055ff', 22);
    addShake(6, 0.24);
    toasts.push({ text: 'MYSTERY PACKAGE DELIVERED!', t: 0 });
    try { __deliveryFeed.push(`★ BONUS PACKAGE +${bonus}s`, '#b055ff'); } catch (e) { /* */ }
    bonusMarker = null;
    if (activeEvent && activeEvent.kind === 'package') { activeEvent.t = activeEvent.life; }
  }

  // Top-down WASD (consistent with all other games)
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup'))    my -= 1;
  if (keys.has('s') || keys.has('arrowdown'))  my += 1;
  if (keys.has('a') || keys.has('arrowleft'))  mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchAim) {
    mx = touchAim.clientX - W / 2;
    my = touchAim.clientY - H / 2;
    const l = Math.hypot(mx, my);
    if (l > 30) { mx /= l; my /= l; } else { mx = 0; my = 0; }
  }
  // Boost: shift OR nitro powerup
  const shiftBoost = keys.has('shift') && fuel > 0;
  const boost = nitroT > 0 ? 2.2 : (shiftBoost ? 1.5 : 1);
  if (shiftBoost && nitroT <= 0) fuel = Math.max(0, fuel - dt * 25);
  fuel = Math.min(100, fuel + dt * 5);
  nitroT = Math.max(0, nitroT - dt);
  _routeStartBoostT = Math.max(0, _routeStartBoostT - dt);
  shieldT = Math.max(0, shieldT - dt);
  magnetT = Math.max(0, magnetT - dt);
  comboT = Math.max(0, comboT - dt);
  if (comboT <= 0) combo = 0;
  // Perf: prune in-place via reverse-iter splice — avoids per-frame array realloc.
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i]; t.t += dt;
    if (t.t >= 2.5) toasts.splice(i, 1);
  }
  // Juice timers + ambient
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  if (hitFlashT > 0) hitFlashT = Math.max(0, hitFlashT - dt);
  if (intactFlashT > 0) intactFlashT = Math.max(0, intactFlashT - dt);
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.t += dt; p.y -= 28 * dt;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 0.88; }
    if (p.t >= 1.2) popups.splice(i, 1);
  }
  if (popups.length > 30) popups.splice(0, popups.length - 30);
  for (let i = burst.length - 1; i >= 0; i--) {
    const p = burst[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    if (p.t >= p.life) burst.splice(i, 1);
  }
  if (burst.length > 200) burst.splice(0, burst.length - 200);
  for (const s of smog) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x + s.r < 0) { s.x = W + s.r; s.y = Math.random() * H; }
    if (s.y + s.r < 0) { s.y = H + s.r; }
  }
  // Vehicle exhaust trail (only when moving)
  const _spd = Math.hypot(pug.vx, pug.vy);
  if (_spd > 80 && Math.random() < 0.6) {
    const back = pug.ang + Math.PI;
    exhaust.push({ x: pug.x + Math.cos(back) * 16, y: pug.y + Math.sin(back) * 16, vx: Math.cos(back) * 20 + (Math.random() - 0.5) * 20, vy: Math.sin(back) * 20 + (Math.random() - 0.5) * 20, t: 0, life: nitroT > 0 ? 0.6 : 0.4, r: 4 + Math.random() * 3, hot: nitroT > 0 });
  }
  // Perf: prune in-place via reverse-iter splice — avoids per-frame array realloc.
  for (let i = exhaust.length - 1; i >= 0; i--) {
    const e = exhaust[i];
    e.t += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.vx *= 0.92; e.vy *= 0.92; e.r += 12 * dt;
    if (e.t >= e.life) exhaust.splice(i, 1);
  }
  if (exhaust.length > 80) exhaust.splice(0, exhaust.length - 80);
  // Toxic puddle damage
  for (const p of toxicPuddles) {
    if (Math.hypot(p.x - pug.x, p.y - pug.y) < p.r) {
      if (Math.random() < dt * 4) damage();
    }
  }
  // Spike strip damage
  for (const s of spikeStrips) {
    if (pug.x > s.x - s.w / 2 && pug.x < s.x + s.w / 2 && Math.abs(pug.y - s.y) < 14) {
      damage();
      // pop the strip
      s.x = -9999;
    }
  }
  if ((mx || my) && crashSpinT <= 0) {
    const l = Math.hypot(mx, my);
    pug.vx += (mx / l) * vehicle.speed * boost * weatherSpeedMul * dt * 4;
    pug.vy += (my / l) * vehicle.speed * boost * weatherSpeedMul * dt * 4;
    pug.ang = Math.atan2(my, mx); // visual facing
  }
  // Slick roads when raining (less friction) — accentuates lateral drift
  if (weather === 'rain') {
    pug.vx *= Math.pow(0.5, dt * 1.5); pug.vy *= Math.pow(0.5, dt * 1.5);
  }
  pug.vx *= Math.pow(0.5, dt * 3); pug.vy *= Math.pow(0.5, dt * 3);
  pug.x += pug.vx * dt; pug.y += pug.vy * dt;
  pug.x = Math.max(20, Math.min(WORLD_W - 20, pug.x));
  pug.y = Math.max(20, Math.min(WORLD_H - 20, pug.y));
  // Skid marks when boosting or drifting (velocity direction differs from input)
  const spd = Math.hypot(pug.vx, pug.vy);
  let drifting = false;
  if (spd > 0 && (mx || my)) {
    const velAng = Math.atan2(pug.vy, pug.vx);
    let d = velAng - pug.ang;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    drifting = Math.abs(d) > 0.6;
  }
  if (spd > 100 && (drifting || nitroT > 0)) {
    skidMarks.push({ x: pug.x, y: pug.y, ang: pug.ang, t: 0 });
    // Polish R2: stricter cap so marks don't pile up forever (120 instead of 200)
    if (skidMarks.length > 120) skidMarks.shift();
    // Round 2C: tire smoke puffs during drift (denser when actually drifting)
    if (Math.random() < (drifting ? 0.55 : 0.3)) spawnTireSmoke(pug.x, pug.y);
  }
  // Polish R2: faster skid fade (2.2s instead of 3s) so they don't linger.
  for (let i = skidMarks.length - 1; i >= 0; i--) {
    const s = skidMarks[i]; s.t += dt;
    if (s.t >= 2.2) skidMarks.splice(i, 1);
  }
  // Round 2C: tire smoke decay
  for (let i = tireSmoke.length - 1; i >= 0; i--) {
    const ts = tireSmoke[i];
    ts.t += dt; ts.x += ts.vx * dt; ts.y += ts.vy * dt;
    ts.vx *= 0.93; ts.vy *= 0.93; ts.r += 18 * dt;
    if (ts.t >= ts.life) tireSmoke.splice(i, 1);
  }
  if (tireSmoke.length > 100) tireSmoke.splice(0, tireSmoke.length - 100);
  if (weatherFlashT > 0) weatherFlashT = Math.max(0, weatherFlashT - dt);
  // Crazy Taxi DRIFT bonus — sustained skid >1.5s pops "DRIFT +50".
  // Counts both true drift AND nitro-skid (matches the skid-mark trigger
  // above so the visual and the scoring stay coupled).
  driftAwardedT = Math.max(0, driftAwardedT - dt);
  if (spd > 100 && (drifting || nitroT > 0)) {
    driftHoldT += dt;
    if (driftHoldT >= 1.5 && driftAwardedT <= 0) {
      addPopup(pug.x, pug.y - 28, `DRIFT +50`, '#ff8e3c');
      addBurst(pug.x, pug.y, '#ff8e3c', 12);
      sfx.tone(660, 'triangle', 0.06, 0.18);
      bumpStunt(50);
      // Polish R2: drift streak — increment, 5 in a row = DRIFT MASTER title
      driftStreak++;
      if (driftStreak === 5) {
        toasts.push({ text: '★ DRIFT MASTER UNLOCKED ★', t: 0 });
        addBurst(pug.x, pug.y, '#ffd23f', 40);
        sfx.arp([880, 1320, 1760, 2200], 'triangle', 0.08, 0.28, 0.4);
        try { __deliveryFeed.push('★ DRIFT MASTER (5 streak)', '#ffd23f'); } catch {}
      }
      try { __deliveryFeed.push(`★ DRIFT +50 (×${driftStreak})`, '#ff8e3c'); } catch (e) { /* */ }
      driftHoldT = 0;
      driftAwardedT = 0.5; // small cooldown so we don't insta-re-award
    }
  } else {
    driftHoldT = 0;
  }
  // Decay the stunt multiplier (separate from delivery combo so stunts don't
  // expire as fast). Once stuntMultT runs out, multiplier eases back to 1.
  if (stuntMultT > 0) {
    stuntMultT -= dt;
    if (stuntMultT <= 0) { stuntMult = 1; stuntMultT = 0; }
  }
  // Powerup pickup
  const grabR = magnetT > 0 ? 80 : 22;
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    // Magnet pulls
    if (magnetT > 0) {
      const dx = pug.x - p.x, dy = pug.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 240 && d > 0) { p.x += (dx / d) * 180 * dt; p.y += (dy / d) * 180 * dt; }
    }
    if (Math.hypot(p.x - pug.x, p.y - pug.y) < grabR) {
      const labels = { nitro: '+NITRO', shield: '+SHIELD', magnet: '+MAGNET', repair: '+REPAIR' };
      const colors = { nitro: '#ff8e3c', shield: '#4cc9f0', magnet: '#b055ff', repair: '#5ef38c' };
      if (p.type === 'nitro') { nitroT = 3; }
      else if (p.type === 'shield') { shieldT = 4; }
      else if (p.type === 'magnet') { magnetT = 6; }
      else if (p.type === 'repair') { pug.hp = vehicle.hp; }
      sfx.tone(880, 'triangle', 0.1, 0.22);
      addPopup(p.x, p.y, labels[p.type], colors[p.type]);
      addBurst(p.x, p.y, colors[p.type], 10);
      powerups.splice(i, 1);
      if (powerups.length < 4) spawnPowerup();
    }
  }

  // Cam follow
  cam.x += (pug.x - cam.x) * 5 * dt;
  cam.y += (pug.y - cam.y) * 5 * dt;

  // Marker reach
  if (Math.hypot(pug.x - marker.x, pug.y - marker.y) < 50) {
    // MULTI-PACKAGE — pop next stop, don't count delivery until all 3 done
    if (currentDeliveryType === 'multi' && multiStops > 1) {
      multiStops--;
      time = Math.min(time + 6, 60);
      addPopup(marker.x, marker.y - 10, `MULTI ${4 - multiStops}/3 · +6s`, '#4cc9f0');
      addBurst(marker.x, marker.y, '#4cc9f0', 12);
      sfx.tone(880, 'triangle', 0.1, 0.22);
      try { __deliveryFeed.push(`★ MULTI STOP ${4 - multiStops}/3`, '#4cc9f0'); } catch {}
      marker = newMarker();
      return; // exit early — wait for last stop
    }
    // VIP — must arrive at full intact, no hits
    if (currentDeliveryType === 'vip' && vipHits > 0) {
      addPopup(marker.x, marker.y - 30, '✗ VIP FAILED', '#ff5a3a');
      sfx.tone(220, 'sawtooth', 0.3, 0.25);
      customerBubble = { x: marker.x, y: marker.y - 50, text: 'YOU RUINED IT!', color: '#ff5a3a', life: 0, max: 2.5 };
      try { __deliveryFeed.push(`✗ VIP FAILED (no hits allowed)`, '#ff5a3a'); } catch {}
      // No counted delivery; just refresh marker + next type
      currentDeliveryType = upcomingDeliveries.shift().type;
      upcomingDeliveries.push({ type: rollDeliveryType(deliveries + 1) });
      multiStops = currentDeliveryType === 'multi' ? 3 : 0;
      vipHits = 0;
      marker = newMarker();
      return;
    }
    deliveries++;
    // ROUTE bonus — first time we hit `target` deliveries on a route, pay out.
    if (activeRoute && !activeRoute.awarded && deliveries >= activeRoute.target) {
      activeRoute.awarded = true;
      totalEarnings += activeRoute.bonus;
      saveEarnings();
      time = Math.min(time + 20, 60);
      addPopup(marker.x, marker.y - 50, `★ ROUTE CLEARED +$${activeRoute.bonus} ★`, '#5ef38c');
      try { __deliveryFeed.push(`★ ${activeRoute.name} CLEARED · +$${activeRoute.bonus}`, '#5ef38c'); } catch (e) { /* */ }
      try { sfx.arp([523, 784, 1047, 1320], 'triangle', 0.08, 0.22, 0.18); } catch (e) { /* */ }
    }
    // Combo: deliveries within 12s chain
    if (comboT > 0) combo = Math.min(99, combo + 1); else combo = 1;
    if (combo > maxComboThisRun) maxComboThisRun = combo;
    comboT = 12;
    let baseBonus = 18 + Math.floor(combo * 0.5);
    // Delivery type modifiers
    let typeMul = 1; // base time bonus
    let cashMul = 1; // tip $$$ multiplier
    if (currentDeliveryType === 'urgent') { typeMul = 0.6; cashMul = 2.5; }
    else if (currentDeliveryType === 'vip') { typeMul = 1.2; cashMul = 3; }
    else if (currentDeliveryType === 'fragile') { typeMul = 1; cashMul = 1.5; }
    else if (currentDeliveryType === 'multi') { typeMul = 1.5; cashMul = 1.6; }
    baseBonus = Math.floor(baseBonus * typeMul);
    // CARGO FRAGILITY MULTIPLIER — payout scales from 0.5× (0% intact) to
    // 1.5× (100% intact). Linear: 0.5 + intact/100.
    const intactMul = 0.5 + (intact / 100);
    // Stunt multiplier from drifts/near-misses scales the delivery time
    // payout, giving Crazy Taxi-style "drive crazy = bigger payday" loop.
    const bonusTime = Math.floor(baseBonus * stuntMult * intactMul);
    time = Math.min(time + bonusTime, 60);
    // Earn cash (saved to garage)
    const cashEarned = Math.floor(12 * cashMul * intactMul);
    totalEarnings += cashEarned;
    saveEarnings();
    // Customer reaction
    const reactions = isPerfectCheck() ? ['GREAT!', 'FAST!', 'BEST!'] : (intact <= 30 ? ['MASHED!', 'LATE!', 'UGH!'] : ['THANKS!', 'OK', 'NICE']);
    customerBubble = { x: marker.x, y: marker.y - 50, text: reactions[Math.floor(Math.random() * reactions.length)], color: isPerfectCheck() ? '#5ef38c' : (intact <= 30 ? '#ff5a3a' : '#ffd23f'), life: 0, max: 2.2 };
    // "PERFECT" celebration when intact stays above 90%
    const isPerfect = intact >= 90;
    if (isPerfect) {
      addPopup(marker.x, marker.y - 30, '★ PERFECT! ×1.5 ★', '#ffd23f');
      addBurst(marker.x, marker.y, '#ffd23f', 18);
      sfx.tone(1320, 'triangle', 0.18, 0.25);
      try { __deliveryFeed.push(`★ PERFECT DELIVERY ×1.5`, '#ffd23f'); } catch (e) { /* */ }
    } else if (intact <= 20) {
      addPopup(marker.x, marker.y - 30, 'CARGO MASHED ×0.5', '#ff5a3a');
    }
    // RESET intact + advance delivery type queue
    intact = 100; intactFlashT = 0;
    currentDeliveryType = upcomingDeliveries.shift().type;
    upcomingDeliveries.push({ type: rollDeliveryType(deliveries) });
    multiStops = currentDeliveryType === 'multi' ? 3 : 0;
    vipHits = 0;
    petPassengerHp = 100;
    // Refresh the stunt multiplier window on every delivery so stunts during
    // delivery runs keep the chain alive (separate decay so multi-stunt
    // runs feel rewarding).
    if (stuntMult > 1) stuntMultT = 6;
    sfx.arp([523, 659, 784, 1047], 'triangle', 0.08, 0.22, 0.25);
    // Round 2C: cheer SFX layered on top (rising arpeggio + bright tone)
    sfx.tone(1320, 'triangle', 0.18, 0.22);
    sfx.tone(1760, 'triangle', 0.12, 0.18);
    // v4 polish: ROUTE-START — engine rev + speed trail kicks the next route.
    // 0.45s "boost trail" timer + low-mid-high SFX stack (sub-thump + rev +
    // honk) so the player feels propelled toward the next stop.
    _routeStartBoostT = 0.45;
    try {
      sfx.tone(110, 'sawtooth', 0.18, 0.32);   // low rumble
      sfx.tone(330, 'sawtooth', 0.16, 0.24);   // engine rev
      setTimeout(() => { try { sfx.tone(880, 'square', 0.08, 0.18); } catch {} }, 90); // horn beep
    } catch {}
    const stuntTag = stuntMult > 1 ? ` ×${stuntMult}` : '';
    addPopup(marker.x, marker.y - 10, `+${bonusTime}s${stuntTag}`, stuntMult > 1 ? '#ffd23f' : '#5ef38c');
    // Round 2C: confetti spray — multi-color burst instead of single green
    addBurst(marker.x, marker.y, '#5ef38c', 16);
    addBurst(marker.x, marker.y, '#ffd23f', 12);
    addBurst(marker.x, marker.y, '#ff3aa1', 10);
    addBurst(marker.x, marker.y, '#4cc9f0', 10);
    addShake(6, 0.24);
    try {
      const tag = combo > 1 ? ` x${combo}` : '';
      __deliveryFeed.push(`DELIVERED #${deliveries}${tag}`, combo > 1 ? '#ff3aa1' : '#5ef38c');
    } catch (e) { /* */ }
    // Achievement check
    if (ACHIEVEMENTS[deliveries] && !achievementsSeen.has(deliveries)) {
      toasts.push({ text: '🏆 ' + ACHIEVEMENTS[deliveries], t: 0 });
      achievementsSeen.add(deliveries);
      sfx.arp([880, 1320, 1760], 'triangle', 0.1, 0.25, 0.3);
    }
    // Only toast on milestone combo entries (3, 5, 10, 20) to avoid spam.
    if (combo === 3 || combo === 5 || combo === 10 || combo === 20) {
      toasts.push({ text: `COMBO ×${combo}!`, t: 0 });
    }
    // Maybe upgrade vehicle (every 5 deliveries)
    if (deliveries % 5 === 0) {
      const keys2 = Object.keys(VEHICLES);
      vehicle = VEHICLES[keys2[Math.floor(Math.random() * keys2.length)]];
      pug.hp = vehicle.hp;
      sfx.tone(1320, 'triangle', 0.2, 0.25);
      toasts.push({ text: `${vehicle.icon} ${vehicle.name.toUpperCase()}!`, t: 0 });
    }
    marker = newMarker();
  }

  // Obstacles
  for (const o of obstacles) {
    if (o.type === 'zombie') {
      const dx = pug.x - o.x, dy = pug.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < 600) {
        o.vx = (dx / d) * o.speed;
        o.vy = (dy / d) * o.speed;
      } else { o.vx *= 0.95; o.vy *= 0.95; }
      o.x += o.vx * dt; o.y += o.vy * dt;
    } else if (o.type === 'cat') {
      o.jumpT -= dt;
      if (o.jumpT <= 0) {
        const ang = Math.random() * Math.PI * 2;
        o.vx = Math.cos(ang) * o.speed * 1.6;
        o.vy = Math.sin(ang) * o.speed * 1.6;
        o.jumpT = 0.5 + Math.random() * 0.8;
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.vx *= 0.92; o.vy *= 0.92;
    } else if (o.type === 'raccoon') {
      // Raccoon: dart toward pug, on touch steal 4 seconds and flee
      const dx = pug.x - o.x, dy = pug.y - o.y;
      const d = Math.hypot(dx, dy);
      o.stealT = Math.max(0, o.stealT - dt);
      if (o.stealT > 0) {
        // Flee away
        o.vx = -(dx / d) * o.speed * 1.5;
        o.vy = -(dy / d) * o.speed * 1.5;
      } else if (d < 400) {
        o.vx = (dx / d) * o.speed;
        o.vy = (dy / d) * o.speed;
        if (d < 22) { time = Math.max(2, time - 4); o.stealT = 2.0; sfx.tone(330, 'sawtooth', 0.2, 0.22); }
      } else { o.vx *= 0.95; o.vy *= 0.95; }
      o.x += o.vx * dt; o.y += o.vy * dt;
    } else if (o.type === 'drone') {
      // Drone slowly chases, dives every few seconds
      const dx = pug.x - o.x, dy = pug.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < 500) {
        o.vx = (dx / d) * o.speed;
        o.vy = (dy / d) * o.speed;
      } else { o.vx *= 0.95; o.vy *= 0.95; }
      o.cd -= dt;
      if (o.cd <= 0 && d < 200) {
        // Dive!
        o.vx = (dx / d) * 280;
        o.vy = (dy / d) * 280;
        o.cd = 2.0;
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
    } else if (o.type === 'mailbox') {
      const d = Math.hypot(pug.x - o.x, pug.y - o.y);
      if (o.fuse < 0 && d < 60) { o.fuse = 1.2; sfx.tone(880, 'square', 0.06, 0.18); }
      if (o.fuse > 0) {
        o.fuse -= dt;
        if (o.fuse <= 0) {
          // Explode
          if (d < 80) damage();
          sfx.sweep(440, 110, 'sawtooth', 0.3, 0.25);
          o.x = rand(0, WORLD_W); o.y = rand(0, WORLD_H); o.fuse = -1;
        }
      }
    }
    // Collision (zombies/cats touch player)
    if (o.type !== 'mailbox') {
      const cd = Math.hypot(pug.x - o.x, pug.y - o.y);
      if (cd < 24) damage();
      // Crazy Taxi "CLOSE CALL" — passing within 30px of a zombie at >150
      // speed (and not actually colliding) awards 25. Per-obstacle cooldown
      // via nearMissBank so a single zombie pass only fires once.
      else if (o.type === 'zombie' && cd < 30 && spd > 150) {
        const cd2 = nearMissBank.get(o) || 0;
        if (cd2 <= 0) {
          addPopup(pug.x, pug.y - 18, `CLOSE CALL +25`, '#ff3aa1');
          addBurst((pug.x + o.x) / 2, (pug.y + o.y) / 2, '#ff3aa1', 6);
          sfx.tone(880, 'triangle', 0.05, 0.16);
          bumpStunt(25);
          try { __deliveryFeed.push(`★ CLOSE CALL +25`, '#ff3aa1'); } catch (e) { /* */ }
          nearMissBank.set(o, 1.2);
        }
      }
      // Cool the near-miss bank for this obstacle even when not in proximity.
      const cur = nearMissBank.get(o);
      if (cur && cur > 0) nearMissBank.set(o, cur - dt);
    }
  }
  updateHud();
}

let invuln = 0;
function crashSpin() {
  crashSpinT = 1.5;
  crashSpinAng = 0;
  pug.vx *= 0.3; pug.vy *= 0.3;
}
function damage() {
  if (invuln > 0) return;
  if (shieldT > 0) {
    shieldT = 0; invuln = 0.4; sfx.tone(880, 'sine', 0.12, 0.2);
    addShake(3, 0.15); addBurst(pug.x, pug.y, '#4cc9f0', 10);
    return;
  }
  pug.hp--;
  invuln = 1.0;
  // Polish R2: damage breaks drift streak
  driftStreak = 0;
  sfx.sweep(220, 110, 'sawtooth', 0.15, 0.22);
  // Round 2C: bigger shake + lower bass thump for impact weight
  sfx.tone(110, 'square', 0.12, 0.22);
  hitFlashT = 0.22;
  addShake(10, 0.34);
  // Round 2C: shatter spray — paint chips + sparks instead of single red puff
  addBurst(pug.x, pug.y, '#ff3a3a', 14);
  addBurst(pug.x, pug.y, '#ffd23f', 8);
  addBurst(pug.x, pug.y, '#cacacf', 8);
  // CARGO FRAGILITY — every collision drops intact% by 10. Bottom at 0.
  // FRAGILE deliveries lose 2x. VIP tracks any hit for failure.
  const intactLoss = currentDeliveryType === 'fragile' ? 16 : 8;
  intact = Math.max(0, intact - intactLoss);
  intactFlashT = 0.4;
  if (currentDeliveryType === 'vip') vipHits++;
  // Polish R2: PET CARRIER — passenger loses HP per hit (heavier per crash)
  if (currentDeliveryType === 'pet') {
    const isCrash = Math.hypot(pug.vx, pug.vy) > 250;
    petPassengerHp = Math.max(0, petPassengerHp - (isCrash ? 30 : 15));
    addPopup(pug.x, pug.y - 24, '🐕 -' + (isCrash ? 30 : 15) + '%', '#ff8ec8');
  }
  addPopup(pug.x, pug.y - 12, currentDeliveryType === 'fragile' ? '-16% FRAGILE!' : `-${intactLoss}% INTACT`, '#ff8e3c');
  // Crazy Taxi spin-out on hard hit (random ~30% chance, and always at high speed)
  const sp = Math.hypot(pug.vx, pug.vy);
  if (crashSpinT <= 0 && (sp > 280 || Math.random() < 0.3)) crashSpin();
  if (pug.hp <= 0) end();
}

function tickInvuln(dt) { invuln = Math.max(0, invuln - dt); }

function render() {
  // World view
  ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, 0, W, H);
  // depth3D: parallax distant horizon — pulled from camera at low speed so
  // distant city silhouettes drift slowly behind everything (fake skyline).
  if (!_depthReduced()) {
    const hp = (cam.x * 0.04) % 240;
    const horizonY = H * 0.16;
    ctx.fillStyle = 'rgba(30,18,50,0.8)';
    for (let i = -1; i < Math.floor(W / 60) + 2; i++) {
      const seed = ((i + 88) * 41) % 100;
      const bh = 22 + (seed % 40);
      const bw = 12 + (seed % 10);
      ctx.fillRect(i * 60 - hp, horizonY - bh, bw, bh + 6);
    }
    // Slow drifting clouds further back (above horizon)
    const cp = (cam.x * 0.015) % 200;
    ctx.fillStyle = 'rgba(180,150,220,0.05)';
    for (let cx = -200; cx < W + 200; cx += 200) {
      ctx.beginPath();
      ctx.ellipse(cx - cp, horizonY - 70, 70, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Screen shake offset (applied to world translate)
  let shkx = 0, shky = 0;
  if (shakeT > 0 && shakeMag > 0) {
    const k = Math.min(1, shakeT / 0.3);
    shkx = (Math.random() - 0.5) * shakeMag * 2 * k;
    shky = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  ctx.save();
  ctx.translate(W / 2 - cam.x + shkx, H / 2 - cam.y + shky);
  // ground (ruined asphalt with subtle gradient)
  ctx.fillStyle = '#2a2540';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Road grid — wide streets every 320px, with sidewalk borders
  const ROAD = 320;
  ctx.fillStyle = '#1f1a30';
  for (let x = 0; x < WORLD_W; x += ROAD) ctx.fillRect(x - 40, 0, 80, WORLD_H);
  for (let y = 0; y < WORLD_H; y += ROAD) ctx.fillRect(0, y - 40, WORLD_W, 80);
  // Sidewalk borders along roads
  ctx.fillStyle = '#3a3050';
  for (let x = 0; x < WORLD_W; x += ROAD) {
    ctx.fillRect(x - 44, 0, 4, WORLD_H);
    ctx.fillRect(x + 40, 0, 4, WORLD_H);
  }
  for (let y = 0; y < WORLD_H; y += ROAD) {
    ctx.fillRect(0, y - 44, WORLD_W, 4);
    ctx.fillRect(0, y + 40, WORLD_W, 4);
  }
  // Lane dashes (yellow) along centerlines
  ctx.fillStyle = 'rgba(255,210,63,0.5)';
  for (let x = 0; x < WORLD_W; x += ROAD) {
    for (let y = 10; y < WORLD_H; y += 36) ctx.fillRect(x - 1, y, 2, 18);
  }
  for (let y = 0; y < WORLD_H; y += ROAD) {
    for (let x = 10; x < WORLD_W; x += 36) ctx.fillRect(x, y - 1, 18, 2);
  }
  // cracks pattern (kept, but lighter)
  ctx.strokeStyle = 'rgba(58,42,90,0.5)';
  ctx.lineWidth = 1;
  for (let y = 0; y < WORLD_H; y += 80) {
    for (let x = 0; x < WORLD_W; x += 80) {
      ctx.strokeRect(x, y, 80, 80);
    }
  }
  // Rubble piles (deterministic, varied size)
  for (let i = 0; i < 80; i++) {
    const x = (i * 173) % WORLD_W;
    const y = (i * 211) % WORLD_H;
    const sz = 10 + ((i * 37) % 14);
    ctx.fillStyle = i % 3 === 0 ? '#2a1f3a' : '#1a1a22';
    ctx.fillRect(x, y, sz, sz);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(x + 2, y + sz - 3, sz, 3);
  }
  // Manhole covers at road intersections
  ctx.fillStyle = '#2c2438';
  ctx.strokeStyle = '#1a1426';
  ctx.lineWidth = 2;
  for (let x = ROAD; x < WORLD_W; x += ROAD) {
    for (let y = ROAD; y < WORLD_H; y += ROAD) {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a1426';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.fillRect(x + Math.cos(a) * 8 - 1, y + Math.sin(a) * 8 - 1, 2, 2);
      }
      ctx.fillStyle = '#2c2438';
    }
  }
  // Bloodstains/oil splats (deterministic)
  for (let i = 0; i < 18; i++) {
    const x = ((i * 421) % (WORLD_W - 40)) + 20;
    const y = ((i * 311) % (WORLD_H - 40)) + 20;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(80,0,12,0.45)' : 'rgba(10,8,18,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + (i % 4) * 2, 6 + (i % 3) * 2, (i % 7) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // District tint bands (downtown / suburbs / industrial)
  const bandH = WORLD_H / 3;
  ctx.fillStyle = DISTRICTS.suburbs.tint;    ctx.fillRect(0, bandH, WORLD_W, bandH);
  ctx.fillStyle = DISTRICTS.industrial.tint; ctx.fillRect(0, bandH * 2, WORLD_W, bandH);
  // Polish R2: WATERFRONT (rightmost 18%) — sand + water with subtle wave
  const wfStartX = WORLD_W * WATERFRONT_X;
  const wfW = WORLD_W - wfStartX;
  // sandy beach strip
  ctx.fillStyle = '#d8c098';
  ctx.fillRect(wfStartX, 0, 60, WORLD_H);
  // beach speckle
  ctx.fillStyle = 'rgba(190,160,110,0.5)';
  for (let i = 0; i < 80; i++) {
    const sxx = wfStartX + 8 + ((i * 173) % 44);
    const syy = (i * 217) % WORLD_H;
    ctx.fillRect(sxx, syy, 2, 2);
  }
  // ocean water
  const waterGrad = ctx.createLinearGradient(wfStartX + 60, 0, WORLD_W, 0);
  waterGrad.addColorStop(0, '#2a5a8a');
  waterGrad.addColorStop(1, '#1a3a5a');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(wfStartX + 60, 0, wfW - 60, WORLD_H);
  // animated waves
  ctx.fillStyle = 'rgba(180,220,255,0.25)';
  for (let i = 0; i < 40; i++) {
    const wy = (i * 73) % WORLD_H;
    const phase = performance.now() / 700 + i * 0.3;
    const wx = wfStartX + 80 + Math.sin(phase) * 12 + ((i * 41) % 200);
    ctx.fillRect(wx, wy, 12, 1);
    ctx.fillRect(wx + 30, wy + 5, 8, 1);
  }
  // foam at beach edge
  ctx.fillStyle = 'rgba(240,250,255,0.55)';
  for (let y = 0; y < WORLD_H; y += 8) {
    const off = Math.sin(performance.now() / 400 + y * 0.05) * 3;
    ctx.fillRect(wfStartX + 58 + off, y, 4, 5);
  }
  // pier (one big dock sticking into the water)
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(wfStartX + 60, WORLD_H / 2 - 12, 200, 24);
  ctx.fillStyle = '#3a2018';
  for (let pi = 0; pi < 10; pi++) {
    ctx.fillRect(wfStartX + 80 + pi * 20, WORLD_H / 2 + 12, 4, 6);
  }
  // waterfront sign
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(wfStartX + 4, 30, 50, 16);
  ctx.fillStyle = '#4cc9f0'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('PIER 7', wfStartX + 29, 41);
  // Skyscrapers (downtown). Windows drawn from deterministic seed.
  const _winC = ['#ffd23f','#ff8e3c','#fff7d0','#4cc9f0'];
  const dayLight = Math.abs(timeOfDay - 0.5) * 2;
  for (const sk of skyscrapers) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sk.x + 4, sk.y + 6, sk.w, sk.h);
    ctx.fillStyle = sk.color; ctx.fillRect(sk.x, sk.y, sk.w, sk.h);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(sk.x, sk.y, sk.w, 4);
    // Windows — deterministic from seed; brighter at night
    let s = sk.seed;
    for (let r = 4; r < sk.h - 8; r += 14) {
      for (let c = 6; c < sk.w - 6; c += 12) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        if ((s & 0xff) < 140) continue;
        ctx.fillStyle = _winC[(s >> 8) & 3];
        ctx.globalAlpha = 0.4 + 0.6 * dayLight;
        ctx.fillRect(sk.x + c, sk.y + r, 6, 8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#888'; ctx.fillRect(sk.x + sk.w / 2 - 1, sk.y - 16, 2, 16);
  }
  // Houses (suburbs)
  for (const h of houses) {
    if (h.hasLawn) { ctx.fillStyle = 'rgba(60,140,80,0.4)'; ctx.fillRect(h.x - 8, h.y - 8, h.w + 16, h.h + 18); }
    ctx.fillStyle = h.color; ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.fillStyle = h.roof;
    ctx.beginPath(); ctx.moveTo(h.x - 4, h.y); ctx.lineTo(h.x + h.w / 2, h.y - 18); ctx.lineTo(h.x + h.w + 4, h.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(h.x + 8, h.y + 8, 10, 8); ctx.fillRect(h.x + h.w - 18, h.y + 8, 10, 8);
    ctx.fillStyle = '#3a2018'; ctx.fillRect(h.x + h.w / 2 - 6, h.y + h.h - 16, 12, 16);
  }
  // Warehouses (industrial)
  for (const wh of warehouses) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(wh.x + 4, wh.y + 6, wh.w, wh.h);
    ctx.fillStyle = wh.color; ctx.fillRect(wh.x, wh.y, wh.w, wh.h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 3; i++) ctx.fillRect(wh.x, wh.y + (wh.h / 3) * i, wh.w, 2);
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(wh.x + 12, wh.y + wh.h - 24, 26, 24); ctx.fillRect(wh.x + wh.w - 38, wh.y + wh.h - 24, 26, 24);
    if (wh.hasHazard) { ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) ctx.fillRect(wh.x + 10 + i * 14, wh.y - 6, 8, 4); }
  }
  // Parked cars
  for (const pc of parkedCars) {
    ctx.save(); ctx.translate(pc.x, pc.y); ctx.rotate(pc.ang);
    ctx.fillStyle = pc.color; ctx.fillRect(-14, -8, 28, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-12, -6, 24, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(-12, 4, 6, 2); ctx.fillRect(6, 4, 6, 2);
    ctx.restore();
  }
  // Bridges
  for (const b of bridges) {
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(b.x - b.w / 2 - 30, b.y - 26, b.w + 60, 52);
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(b.x - b.w / 2 - 30, b.y - 26, b.w + 60, 4); ctx.fillRect(b.x - b.w / 2 - 30, b.y + 22, b.w + 60, 4);
    ctx.fillStyle = '#ffd23f'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('BRIDGE', b.x, b.y - 12);
  }
  // Tunnels (GPS-jam zones)
  for (const t of tunnels) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.strokeRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);
    ctx.fillStyle = '#ffd23f'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('TUNNEL · NO GPS', t.x, t.y);
  }
  // Train tracks
  if (trainTrack) {
    ctx.fillStyle = '#3a2818'; ctx.fillRect(0, trainTrack.y - 16, WORLD_W, 32);
    ctx.fillStyle = '#5a3a20';
    for (let x = 0; x < WORLD_W; x += 36) { ctx.fillRect(x, trainTrack.y - 14, 24, 6); ctx.fillRect(x, trainTrack.y + 8, 24, 6); }
    ctx.fillStyle = '#888'; ctx.fillRect(0, trainTrack.y - 10, WORLD_W, 2); ctx.fillRect(0, trainTrack.y + 8, WORLD_W, 2);
  }
  // Active train
  if (train) {
    ctx.save(); ctx.translate(train.x, train.y); if (train.vx < 0) ctx.scale(-1, 1);
    ctx.fillStyle = '#4a2030'; ctx.fillRect(-train.len / 2, -22, train.len, 44);
    ctx.fillStyle = '#2a1018'; ctx.fillRect(train.len / 2 - 40, -22, 40, 44);
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 4; i++) ctx.fillRect(-train.len / 2 + 20 + i * 30, -12, 14, 10);
    ctx.fillStyle = '#fff7d0'; ctx.fillRect(train.len / 2 - 6, -4, 6, 8);
    ctx.restore();
  }
  // Per-weather: rain reflective shine streaks on the road
  if (weather === 'rain') {
    ctx.fillStyle = 'rgba(160,200,255,0.07)';
    for (let i = 0; i < 80; i++) {
      const xx = ((i * 263) + (performance.now() * 0.02)) % WORLD_W;
      const yy = (i * 197) % WORLD_H;
      ctx.fillRect(xx, yy, 60, 2);
    }
  }
  // CITY CENTER landmark — crashed bus, radio tower, debris, campfire (the campfire is rendered below with others)
  if (cityCenter) {
    const cx = cityCenter.x, cy = cityCenter.y;
    // base scorch
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 160, 110, 0, 0, Math.PI * 2); ctx.fill();
    // Radio tower (offset to one side)
    const tx = cx + 60, tyBase = cy - 30;
    // tower struts (60px tall pylon up-and-back)
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - 12, tyBase); ctx.lineTo(tx, tyBase - 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx + 12, tyBase); ctx.lineTo(tx, tyBase - 70); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - 6, tyBase - 30); ctx.lineTo(tx + 6, tyBase - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - 4, tyBase - 50); ctx.lineTo(tx + 4, tyBase - 50); ctx.stroke();
    // dish
    ctx.fillStyle = '#aaa'; ctx.fillRect(tx - 5, tyBase - 75, 10, 4);
    // red strobe
    const strobe = (Math.floor(performance.now() / 400) % 2 === 0);
    ctx.fillStyle = strobe ? '#ff3a3a' : '#5a1a1a';
    ctx.fillRect(tx - 2, tyBase - 76, 4, 4);
    if (strobe) {
      ctx.fillStyle = 'rgba(255,58,58,0.25)';
      ctx.beginPath(); ctx.arc(tx, tyBase - 75, 10, 0, Math.PI * 2); ctx.fill();
    }
    // Crashed bus (rotated, tipped)
    ctx.save();
    ctx.translate(cx - 30, cy + 10);
    ctx.rotate(-0.3);
    ctx.fillStyle = '#c89020'; ctx.fillRect(-50, -16, 100, 32); // body
    ctx.fillStyle = '#5a3a1c'; ctx.fillRect(-50, 8, 100, 8);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-50, -16, 100, 4);
    ctx.fillStyle = '#1a1a22';
    for (let wi = 0; wi < 4; wi++) {
      ctx.fillRect(-40 + wi * 24, -12, 14, 12);
    }
    // broken wheels
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath(); ctx.arc(-30, 16, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(30, 16, 7, 0, Math.PI * 2); ctx.fill();
    // smoke from front
    ctx.fillStyle = 'rgba(80,80,80,0.55)';
    for (let s = 0; s < 3; s++) {
      const ya = Math.sin(performance.now() / 600 + s);
      ctx.beginPath(); ctx.arc(-50 - s * 6, -20 - s * 8 + ya * 2, 6 + s * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Debris scattered around landmark
    for (const d of debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.ang);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.sz / 2, -d.sz / 2, d.sz, d.sz);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-d.sz / 2, d.sz / 2 - 1, d.sz, 1);
      ctx.restore();
    }
    // Landmark sign
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(cx - 50, cy - 90, 100, 14);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('CITY CENTER', cx, cy - 80);
  }
  // Polish R2: SHARK FIN visual gag (waterfront only)
  if (shark) {
    const fy = shark.y;
    // Ripple wake
    ctx.strokeStyle = 'rgba(180,220,255,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shark.x - 30, fy);
    ctx.quadraticCurveTo(shark.x - 15, fy - 4, shark.x - 5, fy);
    ctx.stroke();
    // Fin triangle
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath();
    ctx.moveTo(shark.x, fy - 14);
    ctx.lineTo(shark.x - 6, fy + 2);
    ctx.lineTo(shark.x + 6, fy + 2);
    ctx.closePath(); ctx.fill();
    // fin highlight
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(shark.x - 1, fy - 10, 2, 6);
    // teeth tease
    ctx.fillStyle = '#fff';
    ctx.fillRect(shark.x + 8, fy + 4, 4, 1);
    ctx.fillRect(shark.x + 8, fy + 6, 4, 1);
  }
  // Polish R2: ZOMBIE RAVE — pulsing pink circle + 50 zombie silhouettes
  if (zombieRave) {
    const k = 1 - zombieRave.t / zombieRave.life;
    const pulse = 0.5 + Math.sin(performance.now() / 100) * 0.4;
    // pulsing aura
    const grd = ctx.createRadialGradient(zombieRave.x, zombieRave.y, 10, zombieRave.x, zombieRave.y, 110);
    grd.addColorStop(0, `rgba(255,58,161,${pulse * 0.5 * k})`);
    grd.addColorStop(0.6, `rgba(176,85,255,${pulse * 0.3 * k})`);
    grd.addColorStop(1, 'rgba(176,85,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(zombieRave.x, zombieRave.y, 110, 0, Math.PI * 2); ctx.fill();
    // 50 zombies clustered in a circle (small dots that wave)
    const t3 = performance.now() / 200;
    for (let i = 0; i < 50; i++) {
      const a = (i / 50) * Math.PI * 2 + t3 * 0.1;
      const r = 30 + (i % 5) * 12 + Math.sin(t3 + i) * 3;
      const zx = zombieRave.x + Math.cos(a) * r;
      const zy = zombieRave.y + Math.sin(a) * r + Math.sin(t3 * 3 + i) * 2;
      ctx.fillStyle = '#4a7a4a';
      ctx.fillRect(zx - 2, zy - 4, 4, 6);
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(zx - 1, zy - 3, 1, 1);
      ctx.fillRect(zx + 1, zy - 3, 1, 1);
      // arms up
      if (Math.sin(t3 + i * 2) > 0) {
        ctx.fillStyle = '#4a7a4a';
        ctx.fillRect(zx - 3, zy - 6, 1, 2);
        ctx.fillRect(zx + 2, zy - 6, 1, 2);
      }
    }
    // RAVE label
    ctx.fillStyle = '#ff3aa1'; ctx.font = "bold 10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3aa1'; ctx.shadowBlur = 10;
    ctx.fillText('★ RAVE +' + zombieRave.bonus + 's ★', zombieRave.x, zombieRave.y - 70);
    ctx.shadowBlur = 0;
  }
  // Traffic lights at intersections
  for (const tl of trafficLights) {
    // post
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(tl.x - 1, tl.y, 2, 24);
    // housing
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(tl.x - 6, tl.y - 22, 12, 22);
    // bulbs
    const phaseColors = ['#ff3a3a', '#ffd23f', '#5ef38c'];
    for (let i = 0; i < 3; i++) {
      const lit = tl.phase === i;
      ctx.fillStyle = lit ? phaseColors[i] : '#1a1a1a';
      ctx.fillRect(tl.x - 3, tl.y - 19 + i * 6, 6, 5);
      if (lit) {
        ctx.fillStyle = phaseColors[i] + '40';
        ctx.beginPath(); ctx.arc(tl.x, tl.y - 17 + i * 6, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // Wrecked cars
  for (const w of wreckedCars) {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.ang);
    ctx.fillStyle = w.color; ctx.fillRect(-16, -10, 32, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-14, -8, 28, 4);
    // rust spots
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-12, -2, 6, 4); ctx.fillRect(6, 0, 6, 4);
    // flat tires (broken rect)
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(-14, 8, 6, 3); ctx.fillRect(8, 8, 6, 3);
    ctx.fillRect(-14, -11, 6, 3); ctx.fillRect(8, -11, 6, 3);
    // shattered window
    ctx.fillStyle = '#5a5a7a';
    ctx.fillRect(-6, -4, 12, 6);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, 2); ctx.stroke();
    ctx.restore();
  }
  // Billboards
  for (const b of billboards) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.ang);
    // post
    ctx.fillStyle = '#3a2a1c'; ctx.fillRect(-2, 16, 4, 14);
    // panel
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(-30, -16, 60, 34);
    ctx.fillStyle = b.color; ctx.fillRect(-28, -14, 56, 30);
    // scrolling text loop
    ctx.fillStyle = '#1a1a22';
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    const off = (b.scrollT * 24) % 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(-28, -14, 56, 30); ctx.clip();
    ctx.fillText(b.text, -28 + 60 - off, 4);
    ctx.fillText(b.text, -28 + 120 - off, 4);
    ctx.restore();
    // pixel border
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(-28, -14, 56, 30);
    ctx.restore();
  }
  // Telephone poles + sagging wires
  for (const p of phonePoles) {
    if (p.neighbor) {
      const midX = (p.x + p.neighbor.x) / 2;
      const midY = (p.y + p.neighbor.y) / 2 + 14; // sag
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 18);
      ctx.quadraticCurveTo(midX, midY, p.neighbor.x, p.neighbor.y - 18);
      ctx.stroke();
    }
    // pole
    ctx.fillStyle = '#3a2818'; ctx.fillRect(p.x - 2, p.y - 28, 4, 32);
    // cross arm
    ctx.fillStyle = '#3a2818'; ctx.fillRect(p.x - 8, p.y - 18, 16, 2);
    // base shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(p.x - 6, p.y + 4, 12, 2);
  }
  // Campfires (under cars/etc — but vehicles render later)
  for (const cf of campfires) {
    // ring of stones
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.fillRect(cf.x + Math.cos(a) * 8 - 2, cf.y + Math.sin(a) * 8 - 2, 4, 4);
    }
    // flame
    const flick = 0.7 + Math.sin(performance.now() / 80 + cf.x) * 0.3;
    ctx.fillStyle = `rgba(255,142,60,${0.7 * flick})`;
    ctx.beginPath(); ctx.arc(cf.x, cf.y - 4, 7 * flick, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,210,63,${0.9 * flick})`;
    ctx.beginPath(); ctx.arc(cf.x, cf.y - 2, 4 * flick, 0, Math.PI * 2); ctx.fill();
    // glow
    const grd = ctx.createRadialGradient(cf.x, cf.y - 2, 4, cf.x, cf.y - 2, 40);
    grd.addColorStop(0, 'rgba(255,142,60,0.35)');
    grd.addColorStop(1, 'rgba(255,142,60,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cf.x, cf.y - 2, 40, 0, Math.PI * 2); ctx.fill();
    // sparks
    for (const s of cf.sparks) {
      const a = Math.max(0, 1 - s.t / s.life);
      ctx.fillStyle = `rgba(255,210,63,${a})`;
      ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
    }
  }
  // Active road event visuals
  if (activeEvent && activeEvent.kind === 'flood') {
    const e = activeEvent;
    const pulse = 0.4 + Math.sin(performance.now() / 200) * 0.15;
    ctx.fillStyle = `rgba(76,130,240,${pulse})`;
    ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
    // ripples
    ctx.strokeStyle = 'rgba(180,220,255,0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const r = ((performance.now() / 300) + i * 0.25) % 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r * Math.min(e.w, e.h) / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // warning border
    ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 3;
    ctx.strokeRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
  }
  if (bonusMarker) {
    ctx.shadowColor = '#b055ff'; ctx.shadowBlur = 22;
    ctx.strokeStyle = '#b055ff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(bonusMarker.x, bonusMarker.y, 36 + Math.sin(performance.now() / 150) * 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#b055ff'; ctx.fillRect(bonusMarker.x - 12, bonusMarker.y - 12, 24, 24);
    ctx.fillStyle = '#fff';
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('?', bonusMarker.x, bonusMarker.y + 4);
    ctx.shadowBlur = 0;
  }
  // Toxic puddles
  for (const p of toxicPuddles) {
    ctx.fillStyle = `rgba(94,243,140,${0.3 + Math.sin(performance.now()/300) * 0.1})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
  }
  // Spike strips
  for (const s of spikeStrips) {
    if (s.x < -9000) continue;
    ctx.fillStyle = '#222';
    ctx.fillRect(s.x - s.w / 2, s.y - 4, s.w, 8);
    ctx.fillStyle = '#c8c8c8';
    for (let x = -s.w / 2; x < s.w / 2; x += 8) {
      ctx.beginPath();
      ctx.moveTo(s.x + x, s.y - 4);
      ctx.lineTo(s.x + x + 4, s.y - 12);
      ctx.lineTo(s.x + x + 8, s.y - 4);
      ctx.closePath(); ctx.fill();
    }
  }
  // Exhaust puffs (under vehicle)
  for (const e of exhaust) {
    const a = (1 - e.t / e.life) * 0.55;
    ctx.fillStyle = e.hot
      ? `rgba(255,142,60,${a})`
      : `rgba(120,120,140,${a})`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
  }
  // Round 2C: tire smoke puffs during drift (rendered above skid marks for read)
  for (const ts of tireSmoke) {
    const a = (1 - ts.t / ts.life) * 0.4;
    ctx.fillStyle = `rgba(220,220,230,${a})`;
    ctx.beginPath(); ctx.arc(ts.x, ts.y, ts.r, 0, Math.PI * 2); ctx.fill();
  }
  // Skid marks (under everything) — Polish R2: faster fade (2.2s)
  for (const s of skidMarks) {
    const a = (1 - s.t / 2.2) * 0.6;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.ang);
    ctx.fillRect(-12, -4, 4, 2); ctx.fillRect(-12, 2, 4, 2);
    ctx.restore();
  }
  // NPC traffic cars
  for (const c of trafficCars) {
    const cx = c.horiz ? c.pos : c.lane, cy = c.horiz ? c.lane : c.pos;
    ctx.save(); ctx.translate(cx, cy);
    if (c.horiz) { if (c.dir < 0) ctx.scale(-1, 1); } else ctx.rotate(c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-14, -8, 28, 16);
    ctx.fillStyle = c.color; ctx.fillRect(-14, -8, 28, 14);
    ctx.fillStyle = '#1a1a30'; ctx.fillRect(-10, -5, 20, 6);
    ctx.fillStyle = '#fff7d0'; ctx.fillRect(12, -6, 2, 3); ctx.fillRect(12, 3, 2, 3);
    ctx.restore();
  }
  // Kids
  for (const k of kids) {
    const wob = Math.sin(performance.now() / 100 + k.x) * 2;
    ctx.fillStyle = k.color; ctx.fillRect(k.x - 4, k.y - 6, 8, 8);
    ctx.fillStyle = '#3a2818'; ctx.fillRect(k.x - 3, k.y + 2 + wob, 6, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(k.x - 2, k.y - 6, 4, 4);
    ctx.fillStyle = '#000'; ctx.fillRect(k.x - 1, k.y - 5, 1, 1); ctx.fillRect(k.x + 0, k.y - 5, 1, 1);
  }
  // Marker — color/glyph by delivery type (reuses module-level _DTC/_DTG)
  const mc = _DTC[currentDeliveryType] || '#5ef38c';
  ctx.shadowColor = mc; ctx.shadowBlur = 20;
  ctx.strokeStyle = mc; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(marker.x, marker.y, 40 + Math.sin(performance.now() / 200) * 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = mc; ctx.font = "20px serif";
  ctx.textAlign = 'center'; ctx.fillText(_DTG[currentDeliveryType], marker.x, marker.y + 7);
  // Multi-package: small "x/3" stops indicator above marker
  if (currentDeliveryType === 'multi') {
    ctx.fillStyle = '#4cc9f0'; ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillText(`${4 - multiStops}/3`, marker.x, marker.y - 50);
  }
  ctx.shadowBlur = 0;
  // Customer bubble after delivery
  if (customerBubble) {
    const cb = customerBubble;
    const a = cb.life < 0.3 ? cb.life / 0.3 : (cb.life > cb.max - 0.4 ? Math.max(0, (cb.max - cb.life) / 0.4) : 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(cb.x - 50, cb.y - 16, 100, 28);
    ctx.fillStyle = cb.color; ctx.font = "bold 12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(cb.text, cb.x, cb.y);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath(); ctx.moveTo(cb.x - 6, cb.y + 12); ctx.lineTo(cb.x + 6, cb.y + 12); ctx.lineTo(cb.x, cb.y + 22); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Obstacles — depth-sort + drop shadow under each
  _depthSort(obstacles);
  for (const o of obstacles) {
    if (o && typeof o.x === 'number') {
      const r = Math.max(8, Math.min(40, (o.r || o.w || 16)));
      _depthShadow(ctx, o.x, o.y + r * 0.7, r * 0.95, { alpha: 0.32 });
    }
    drawObstacle(o);
  }
  // Powerups
  for (const p of powerups) {
    const colors = { nitro: '#ff8e3c', shield: '#4cc9f0', magnet: '#b055ff', repair: '#5ef38c' };
    ctx.shadowColor = colors[p.type]; ctx.shadowBlur = 14;
    ctx.fillStyle = colors[p.type];
    ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
    ctx.shadowBlur = 0;
    // Pixel-art icon overlay (library): nitro→flame, shield→shield, magnet→magnet.
    // Repair has no library match — render a white "+" cross to match the wrench feel.
    if (p.type === 'nitro')      drawIcon.flame(ctx, p.x, p.y, 20);
    else if (p.type === 'shield') drawIcon.shield(ctx, p.x, p.y, 20);
    else if (p.type === 'magnet') drawIcon.magnet(ctx, p.x, p.y, 20);
    else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.x - 6, p.y - 2, 12, 4);
      ctx.fillRect(p.x - 2, p.y - 6, 4, 12);
    }
  }
  // depth3D drop shadow under the pug-vehicle — keeps the world axis aligned.
  _depthShadow(ctx, pug.x, pug.y + 14, 22, { alpha: 0.45 });
  // Pug-vehicle — vehicle chassis + high-detail pug rider. Chassis art is
  // dispatched per vehicle.name so each ride looks distinct.
  ctx.save();
  ctx.translate(pug.x, pug.y);
  // crashSpin overrides facing direction — spin around fast for "out of control" feel
  ctx.rotate(pug.ang + Math.PI / 2 + (crashSpinT > 0 ? crashSpinAng : 0));
  _drawVehicleChassis(ctx, vehicle);
  // pug rider centered on chassis (helmet color varies per vehicle)
  drawPug(ctx, 0, 0, { size: 26, helmet: true, helmetColor: _riderHelmetColor(vehicle) });
  // damage flash
  if (invuln > 0) {
    ctx.fillStyle = `rgba(255,58,58,${invuln})`;
    ctx.fillRect(-20, -12, 40, 24);
  }
  // Nitro exhaust
  if (nitroT > 0) {
    ctx.fillStyle = '#ff8e3c'; ctx.fillRect(-26, -4, 8, 8);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-30, -2, 4, 4);
  }
  // v4 polish: route-start boost trail — pulsing flame puff behind the vehicle
  // for ~0.45s after each completed delivery. Layered with the existing nitro
  // so combo runs look extra punchy.
  if (_routeStartBoostT > 0) {
    const k = _routeStartBoostT / 0.45;
    const len = 18 + (1 - k) * 22;
    ctx.fillStyle = `rgba(255,210,63,${k * 0.85})`;
    ctx.fillRect(-22 - len, -3, len, 6);
    ctx.fillStyle = `rgba(255,142,60,${k})`;
    ctx.fillRect(-22 - len * 0.7, -2, len * 0.7, 4);
    ctx.fillStyle = `rgba(255,255,255,${k * 0.9})`;
    ctx.fillRect(-22 - 6, -1.5, 6, 3);
  }
  // Shield bubble
  if (shieldT > 0) {
    ctx.strokeStyle = `rgba(76,201,240,${0.5 + Math.sin(performance.now()/100) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
  }
  // Magnet aura
  if (magnetT > 0) {
    ctx.strokeStyle = 'rgba(176,85,255,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 240, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // HP indicators (pixel hearts above pug, world space)
  for (let i = 0; i < pug.hp; i++) drawIcon.heart(ctx, pug.x - 10 + i * 8, pug.y - 24, 10);
  // Polish R2: cargo box bouncing animation above vehicle. Bounce intensity
  // scales with damage taken (intact < 100). Color/icon matches delivery type.
  // Always rendered when carrying (any delivery in progress).
  if (running) {
    const dmgBounce = (100 - intact) / 20; // 0..5
    const bx = pug.x;
    const by = pug.y - 36 - Math.abs(Math.sin(performance.now() / 150 + pug.x * 0.1)) * (1 + dmgBounce);
    const cargoCol = _DTC[currentDeliveryType] || '#5ef38c';
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx - 7, by + 7, 14, 2);
    // box
    ctx.fillStyle = cargoCol;
    ctx.fillRect(bx - 6, by - 6, 12, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx - 6, by - 6, 12, 2);
    // box side shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(bx + 5, by - 6, 1, 12);
    // tape cross
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 1, by - 6, 2, 12);
    ctx.fillRect(bx - 6, by - 1, 12, 2);
    // Per-delivery-type accessory on the box.
    _drawCargoAccessory(ctx, bx, by, currentDeliveryType);
    // damage cracks if intact < 70
    if (intact < 70) {
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx - 4, by - 4); ctx.lineTo(bx + 2, by + 2); ctx.stroke();
      if (intact < 40) {
        ctx.beginPath(); ctx.moveTo(bx + 3, by - 5); ctx.lineTo(bx - 1, by + 4); ctx.stroke();
      }
    }
  }
  // Polish R2: PET CARRIER passenger HP bar above box
  if (currentDeliveryType === 'pet') {
    const px = pug.x - 12, py = pug.y - 52;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px, py, 24, 3);
    const phc = petPassengerHp >= 60 ? '#5ef38c' : (petPassengerHp >= 30 ? '#ffd23f' : '#ff5a3a');
    ctx.fillStyle = phc;
    ctx.fillRect(px, py, 24 * petPassengerHp / 100, 3);
  }
  // Burst particles (world space)
  for (const p of burst) {
    const a = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
  // Score popups (world space)
  ctx.font = "bold 11px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  for (const p of popups) {
    const a = p.t < 0.1 ? p.t / 0.1 : (p.t > 0.9 ? Math.max(0, (1.2 - p.t) / 0.3) : 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillText(p.text, p.x + 1, p.y + 1);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Hit flash (full screen)
  if (hitFlashT > 0) {
    ctx.fillStyle = `rgba(255,58,58,${Math.min(0.45, hitFlashT * 2.2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Round 2C: weather change flash (full screen, fades out fast)
  if (weatherFlashT > 0) {
    const a = weatherFlashT / 0.6;
    // weatherFlashCol is already an rgba string, just modulate via globalAlpha
    ctx.globalAlpha = a;
    ctx.fillStyle = weatherFlashCol;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  // Ambient smog drift (screen-space, atmospheric)
  for (const s of smog) {
    ctx.fillStyle = `rgba(120,108,160,${s.a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  // Vignette (subtle, around camera)
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // Weather overlay (full-screen, after world render)
  // Polish R2: HEADLIGHTS cone — visible in night/fog/tunnel, regardless of motion
  const _inTunnelNow = isInTunnel(pug.x, pug.y);
  const headlightsOn = weather === 'night' || weather === 'fog' || _inTunnelNow;
  if (headlightsOn) {
    // Direction = motion when moving, else last-facing (pug.ang)
    const sp2 = Math.hypot(pug.vx, pug.vy);
    const dir = sp2 > 30 ? Math.atan2(pug.vy, pug.vx) : pug.ang;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(dir);
    // Polish R2: thicker, more visible cone with bright core + spread
    const hgrd = ctx.createRadialGradient(0, 0, 16, 100, 0, 260);
    hgrd.addColorStop(0, 'rgba(255,235,170,0.42)');
    hgrd.addColorStop(0.4, 'rgba(255,230,180,0.22)');
    hgrd.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = hgrd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 320, -0.55, 0.55);
    ctx.closePath(); ctx.fill();
    // Bright dual beam cores
    ctx.fillStyle = 'rgba(255,245,200,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(280, -28); ctx.lineTo(280, 28); ctx.lineTo(0, 3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (weather === 'night') {
    // Night tightens vignette — only ~180px around pug is lit
    const grd = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 240);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  } else if (weather === 'fog') {
    // Fog tightens sight radius severely (Wave 1E impact)
    const grd = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 360);
    grd.addColorStop(0, 'rgba(180,180,200,0)');
    grd.addColorStop(1, 'rgba(180,180,200,0.94)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    // Extra grey overlay so distance fades to grey
    ctx.fillStyle = 'rgba(180,180,200,0.16)';
    ctx.fillRect(0, 0, W, H);
  } else if (weather === 'rain') {
    ctx.fillStyle = 'rgba(0,0,40,0.18)'; ctx.fillRect(0, 0, W, H);
    // Polish R2: denser, more visible rain — thicker streaks
    ctx.strokeStyle = 'rgba(160,200,255,0.7)';
    ctx.lineWidth = 1.5;
    for (const d of raindrops) {
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4, d.y + 12); ctx.stroke();
    }
    // Polish R2: LIGHTNING flash — full screen bright wash that fades fast
    if (lightningFlashT > 0) {
      const lk = lightningFlashT / 0.4;
      ctx.fillStyle = `rgba(255,255,255,${lk * 0.55})`;
      ctx.fillRect(0, 0, W, H);
      // Bolt streak from top
      ctx.strokeStyle = `rgba(220,230,255,${lk})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const bx = W * 0.35 + (Math.sin(lightningFlashT * 30) * 10);
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 20, H * 0.18);
      ctx.lineTo(bx - 10, H * 0.32);
      ctx.lineTo(bx + 30, H * 0.5);
      ctx.stroke();
    }
  }
  // Polish R2: FOG — additional denser haze (already exists but add density)
  if (weather === 'fog') {
    ctx.fillStyle = 'rgba(200,200,210,0.05)';
    for (let i = 0; i < 30; i++) {
      const fx = ((performance.now() * 0.02 + i * 47) % (W + 100)) - 50;
      const fy = (i * 73) % H;
      ctx.beginPath(); ctx.arc(fx, fy, 60, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Crazy Taxi directional arrow — large screen-edge arrow pointing to the
  // current marker. Hides when the marker is on-screen so it doesn't clutter
  // the camera view; otherwise clamps to a viewport-edge ring. Also draws an
  // "ETA: X.Xs" estimate beneath the arrow head based on straight-line
  // distance / current speed (clamped so a parked vehicle doesn't show 9999).
  // GPS jammed when player is in a tunnel (Wave 1E).
  const _inTunnel = isInTunnel(pug.x, pug.y);
  {
    const dxA = marker.x - pug.x, dyA = marker.y - pug.y;
    const dA = Math.hypot(dxA, dyA);
    // On-screen detection — marker screen position vs viewport with a small
    // safety margin so the arrow shows again the moment it slips off-edge.
    const markerScreenX = marker.x - cam.x + W / 2;
    const markerScreenY = marker.y - cam.y + H / 2;
    const offEdge = markerScreenX < 60 || markerScreenX > W - 60 ||
                    markerScreenY < 60 || markerScreenY > H - 60;
    if (offEdge && dA > 80 && !_inTunnel) {
      const ang = Math.atan2(dyA, dxA);
      // Clamp to a viewport-edge ring (rectangular clamp so the arrow hugs
      // the side it points toward — matches Crazy Taxi).
      const margin = 70;
      const tx = Math.cos(ang), ty = Math.sin(ang);
      // Distance from screen center to the rectangle edge along (tx,ty).
      const halfW = W / 2 - margin, halfH = H / 2 - margin;
      const scale = Math.min(
        Math.abs(tx) > 1e-3 ? halfW / Math.abs(tx) : Infinity,
        Math.abs(ty) > 1e-3 ? halfH / Math.abs(ty) : Infinity,
      );
      const ex = W / 2 + tx * scale;
      const ey = H / 2 + ty * scale;
      // Pulsing scale + glow so it reads in heavy weather / smog.
      const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.scale(pulse, pulse);
      // Arrow shadow / outline
      ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(46, 0); ctx.lineTo(-18, -22); ctx.lineTo(-10, 0); ctx.lineTo(-18, 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5ef38c';
      ctx.beginPath(); ctx.moveTo(42, 0); ctx.lineTo(-14, -18); ctx.lineTo(-6, 0); ctx.lineTo(-14, 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9affc0';
      ctx.beginPath(); ctx.moveTo(36, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      // ETA label below the arrow, axis-aligned (no rotation).
      const spdNow = Math.hypot(pug.vx, pug.vy);
      const eta = spdNow > 25 ? (dA / spdNow) : 99;
      const etaTxt = eta >= 99 ? 'ETA: --' : `ETA: ${eta.toFixed(1)}s`;
      ctx.font = "bold 11px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(etaTxt, ex + 1, ey + 41);
      ctx.fillStyle = eta < 5 ? '#ffd23f' : '#5ef38c';
      ctx.fillText(etaTxt, ex, ey + 40);
      // Distance label
      ctx.fillStyle = '#000';
      ctx.font = "9px 'Press Start 2P', monospace";
      ctx.fillText(`${Math.floor(dA)}m`, ex + 1, ey + 55);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`${Math.floor(dA)}m`, ex, ey + 54);
    }
  }
  // Time bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 100, 16, 200, 8);
  ctx.fillStyle = time < 8 ? '#ff3a3a' : '#5ef38c';
  ctx.fillRect(W / 2 - 100, 16, 200 * (time / 60), 8);
  // CARGO FRAGILITY bar — under time bar, with INTACT % label.
  // Color: 100%=green, 50%=yellow, <30%=red. Flashes briefly on damage so
  // the player sees the hit cost them payout.
  const intactColor = intact >= 70 ? '#5ef38c' : (intact >= 40 ? '#ffd23f' : '#ff5a3a');
  const flashAlpha = intactFlashT > 0 ? Math.min(0.6, intactFlashT * 1.5) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - 100, 30, 200, 6);
  ctx.fillStyle = intactColor;
  ctx.fillRect(W / 2 - 100, 30, 200 * (intact / 100), 6);
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(W / 2 - 100, 30, 200, 6);
  }
  // INTACT label + percent
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText('INTACT', W / 2 - 100, 45);
  ctx.fillStyle = intactColor;
  ctx.fillText('INTACT', W / 2 - 100, 44);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(`${Math.round(intact)}%`, W / 2 + 100, 45);
  ctx.fillStyle = intactColor;
  ctx.fillText(`${Math.round(intact)}%`, W / 2 + 100, 44);
  // Speedometer (top-right)
  const spd = Math.hypot(pug.vx, pug.vy);
  const maxSpd = 600;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W - 130, 36, 120, 16);
  ctx.fillStyle = spd > maxSpd * 0.8 ? '#ff8e3c' : '#4cc9f0';
  ctx.fillRect(W - 130, 36, 120 * Math.min(1, spd / maxSpd), 16);
  ctx.fillStyle = '#fff'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText(Math.floor(spd) + ' MPH', W - 12, 48);
  // Delivery type label + Next-3 preview
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W / 2 + 110, 24, 100, 24);
  ctx.fillStyle = '#888'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  ctx.fillText('NEXT:', W / 2 + 114, 33);
  ctx.font = "14px serif"; ctx.textAlign = 'center';
  for (let i = 0; i < upcomingDeliveries.length; i++) {
    ctx.fillStyle = _DTC[upcomingDeliveries[i].type];
    ctx.fillText(_DTG[upcomingDeliveries[i].type], W / 2 + 140 + i * 22, 42);
  }
  const _typeLabel = currentDeliveryType === 'multi' ? `MULTI ${4 - multiStops}/3` : (currentDeliveryType === 'vip' && vipHits > 0 ? 'VIP RUINED' : currentDeliveryType.toUpperCase());
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(W / 2 - 100, 6, 200, 10);
  ctx.fillStyle = currentDeliveryType === 'vip' && vipHits > 0 ? '#ff5a3a' : _DTC[currentDeliveryType];
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText(_typeLabel, W / 2, 14);
  // Time-of-day indicator (top-left corner under HUD card)
  {
    const tx = 12, ty = H - 60;
    const isDay = timeOfDay > 0.25 && timeOfDay < 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(tx, ty, 80, 16);
    ctx.fillStyle = isDay ? '#ffd23f' : '#4cc9f0';
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    const hour = Math.floor(timeOfDay * 24);
    ctx.fillText(`${isDay ? '☀' : '🌙'} ${String(hour).padStart(2,'0')}:00`, tx + 4, ty + 11);
  }
  // BIG delivery streak counter
  if (deliveries > 0) {
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.06;
    ctx.save(); ctx.translate(W / 2 - 220, 90); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#000'; ctx.font = "bold 26px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText('×' + deliveries, 2, 2);
    ctx.fillStyle = '#ffd23f'; ctx.fillText('×' + deliveries, 0, 0);
    ctx.font = "8px 'Press Start 2P', monospace"; ctx.fillStyle = '#fff';
    ctx.fillText('DELIVERED', 0, 14);
    ctx.restore();
  }
  if (crashSpinT > 0) {
    ctx.fillStyle = '#ff5a3a'; ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = 12;
    ctx.fillText('!! SPIN-OUT !!', W / 2, H / 2 - 60); ctx.shadowBlur = 0;
  }
  if (_inTunnel) {
    ctx.fillStyle = '#ffd23f'; ctx.font = "bold 12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('GPS LOST · IN TUNNEL', W / 2, H - 90);
  }
  // Active powerup chips bottom-left
  let py = H - 30;
  const drawChip = (label, t, color) => {
    if (t <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(12, py - 16, 110, 22);
    ctx.fillStyle = color;
    ctx.fillRect(12, py - 16, 110 * (t / 6), 4);
    ctx.fillStyle = '#fff'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`${label} ${t.toFixed(1)}s`, 18, py);
    py -= 26;
  };
  drawChip('NITRO', nitroT, '#ff8e3c');
  drawChip('SHIELD', shieldT, '#4cc9f0');
  drawChip('MAGNET', magnetT, '#b055ff');
  // Combo banner
  if (combo > 1 && running) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 22px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    ctx.fillText(`COMBO ×${combo}`, W / 2, 90);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W / 2 - 80, 100, 160, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(W / 2 - 80, 100, 160 * (comboT / 12), 4);
  }
  // Stunt multiplier — separate from delivery combo. Rises with drifts +
  // near-misses, decays after 6s of no stunts. Shows just below combo banner.
  if (stuntMult > 1 && running) {
    const my = 124;
    ctx.fillStyle = '#ff3aa1';
    ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3aa1'; ctx.shadowBlur = 10;
    ctx.fillText(`STUNT ×${stuntMult}`, W / 2, my);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W / 2 - 60, my + 4, 120, 3);
    ctx.fillStyle = '#ff3aa1';
    ctx.fillRect(W / 2 - 60, my + 4, 120 * Math.max(0, Math.min(1, stuntMultT / 6)), 3);
  }
  // Toasts (achievement/combo messages)
  for (let i = 0; i < toasts.length; i++) {
    const t = toasts[i];
    const alpha = t.t < 0.3 ? t.t / 0.3 : (t.t > 2.0 ? (2.5 - t.t) / 0.5 : 1);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    const tw = ctx.measureText(t.text).width + 36;
    ctx.fillRect(W / 2 - tw / 2, 140 + i * 30, tw, 24);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(t.text, W / 2, 156 + i * 30);
    ctx.globalAlpha = 1;
  }
  // Minimap (top-right area)
  // Polish R2: tinted bands per district + cargo type icon on marker
  const mmW = 130, mmH = 90, mmX = W - mmW - 12, mmY = 60;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  // district band tints (downtown / suburbs / industrial / waterfront)
  ctx.fillStyle = 'rgba(60,40,80,0.25)';
  ctx.fillRect(mmX, mmY, mmW * WATERFRONT_X, mmH / 3);
  ctx.fillStyle = 'rgba(50,80,40,0.25)';
  ctx.fillRect(mmX, mmY + mmH / 3, mmW * WATERFRONT_X, mmH / 3);
  ctx.fillStyle = 'rgba(80,50,30,0.25)';
  ctx.fillRect(mmX, mmY + (mmH / 3) * 2, mmW * WATERFRONT_X, mmH / 3);
  // waterfront band (blue)
  ctx.fillStyle = 'rgba(76,201,240,0.18)';
  ctx.fillRect(mmX + mmW * WATERFRONT_X, mmY, mmW * (1 - WATERFRONT_X), mmH);
  ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 1;
  ctx.strokeRect(mmX + 0.5, mmY + 0.5, mmW - 1, mmH - 1);
  // dotted waterfront edge
  ctx.fillStyle = 'rgba(76,201,240,0.5)';
  for (let yy = mmY; yy < mmY + mmH; yy += 4) {
    ctx.fillRect(mmX + mmW * WATERFRONT_X, yy, 1, 2);
  }
  const sx = mmW / WORLD_W, sy = mmH / WORLD_H;
  // marker (with type color) + cargo icon
  const mmc = _DTC[currentDeliveryType] || '#5ef38c';
  ctx.fillStyle = mmc;
  ctx.fillRect(mmX + marker.x * sx - 3, mmY + marker.y * sy - 3, 6, 6);
  // Polish R2: cargo type icon on minimap marker arrow (drawn as small emoji)
  ctx.fillStyle = mmc;
  ctx.font = '10px serif'; ctx.textAlign = 'center';
  ctx.fillText(_DTG[currentDeliveryType] || '📍', mmX + marker.x * sx, mmY + marker.y * sy - 6);
  // pug (yellow dot)
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(mmX + pug.x * sx - 2, mmY + pug.y * sy - 2, 4, 4);
  // obstacles
  for (const o of obstacles) {
    ctx.fillStyle = o.type === 'drone' ? '#ff3a3a' : 'rgba(255,58,58,0.5)';
    ctx.fillRect(mmX + o.x * sx, mmY + o.y * sy, 2, 2);
  }
  // train
  if (train) {
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(mmX + train.x * sx - 4, mmY + train.y * sy - 1, 8, 2);
  }
  // shark
  if (shark) {
    ctx.fillStyle = '#dde6f0';
    ctx.fillRect(mmX + shark.x * sx - 1, mmY + shark.y * sy - 1, 3, 3);
  }
  // zombie rave (big pink blob)
  if (zombieRave) {
    ctx.fillStyle = '#ff3aa1';
    ctx.beginPath();
    ctx.arc(mmX + zombieRave.x * sx, mmY + zombieRave.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Polish R2: minimap title shows DELIVERY COMPLETE x/3 for multi
  ctx.fillStyle = '#4cc9f0'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  if (currentDeliveryType === 'multi') {
    ctx.fillText(`MULTI ${4 - multiStops}/3 COMPLETE`, mmX, mmY - 2);
  } else {
    ctx.fillText('MAP', mmX, mmY - 2);
  }
  // Polish R2: DRIFT MASTER badge when streak hits 5
  if (driftStreak >= 5) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 10px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 8;
    ctx.fillText('★ DRIFT MASTER ★', mmX + mmW, mmY + mmH + 18);
    ctx.shadowBlur = 0;
  }
  // Polish R2: auto-resume countdown after pause
  if (resumeCountdownT > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(W / 2 - 80, H / 2 - 30, 160, 60);
    ctx.fillStyle = '#5ef38c';
    ctx.font = "bold 32px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(resumeCountdownT) + '', W / 2, H / 2 + 4);
    ctx.fillStyle = '#fff'; ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillText('RESUMING...', W / 2, H / 2 + 20);
  }
}

function drawObstacle(o) {
  if (o.type === 'raccoon') {
    // Raccoon — striped body + bandit mask + ringed tail. More detail.
    // body
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath(); ctx.arc(o.x, o.y - 1, 8, 0, Math.PI * 2); ctx.fill();
    // back stripes
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(o.x - 4, o.y - 6, 8, 1);
    ctx.fillRect(o.x - 5, o.y - 3, 10, 1);
    ctx.fillRect(o.x - 5, o.y, 10, 1);
    // ears (small)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(o.x - 7, o.y - 8, 2, 2); ctx.fillRect(o.x + 5, o.y - 8, 2, 2);
    // bandit mask
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(o.x - 7, o.y - 3, 5, 3); ctx.fillRect(o.x + 2, o.y - 3, 5, 3);
    // eye whites + pupils
    ctx.fillStyle = '#fff'; ctx.fillRect(o.x - 5, o.y - 2, 2, 2); ctx.fillRect(o.x + 3, o.y - 2, 2, 2);
    ctx.fillStyle = '#000'; ctx.fillRect(o.x - 4, o.y - 1, 1, 1); ctx.fillRect(o.x + 4, o.y - 1, 1, 1);
    // nose
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x - 1, o.y + 2, 2, 1);
    // ringed tail
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(o.x + 7, o.y - 2, 8, 4);
    ctx.fillStyle = '#222'; ctx.fillRect(o.x + 10, o.y - 2, 2, 4);
    ctx.fillStyle = '#222'; ctx.fillRect(o.x + 13, o.y - 2, 2, 4);
  } else if (o.type === 'drone') {
    // Glowing drone with shadow + four propellers + payload
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(o.x, o.y + 18, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3a3a';
    ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(o.x, o.y, 1, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Four arms + propeller discs
    ctx.fillStyle = '#222';
    ctx.fillRect(o.x - 14, o.y - 1, 6, 2); ctx.fillRect(o.x + 8, o.y - 1, 6, 2);
    ctx.fillRect(o.x - 1, o.y - 14, 2, 6); ctx.fillRect(o.x - 1, o.y + 8, 2, 6);
    // spinning rotor blur
    ctx.fillStyle = 'rgba(180,180,200,0.4)';
    ctx.beginPath(); ctx.arc(o.x - 14, o.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(o.x + 14, o.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(o.x, o.y - 14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(o.x, o.y + 14, 3, 0, Math.PI * 2); ctx.fill();
    // camera dome
    ctx.fillStyle = '#0a0a12';
    ctx.beginPath(); ctx.arc(o.x, o.y + 4, 2, 0, Math.PI * 2); ctx.fill();
  } else if (o.type === 'zombie') {
    // Zombie variant picked stably from id. 5 types: rotting / child / runner /
    // tank / exploder. Each has distinct silhouette + accents.
    if (o._zombieKind == null) {
      const kinds = ['rotting', 'child', 'runner', 'tank', 'exploder'];
      o._zombieKind = kinds[((o.x | 0) ^ (o.y | 0)) % kinds.length];
    }
    _drawZombieByKind(o);
  } else if (o.type === 'cat') {
    // Black cat — angular ears + tail flicker + slit eyes + arched back
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(o.x, o.y - 1, 10, 0, Math.PI * 2); ctx.fill();
    // Spike fur along back (arched)
    ctx.fillStyle = '#000';
    for (let i = -2; i <= 2; i++) ctx.fillRect(o.x + i * 3 - 1, o.y - 11, 2, 3);
    // Ears (pointy triangles)
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(o.x - 7, o.y - 8); ctx.lineTo(o.x - 10, o.y - 16); ctx.lineTo(o.x - 4, o.y - 12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(o.x + 7, o.y - 8); ctx.lineTo(o.x + 10, o.y - 16); ctx.lineTo(o.x + 4, o.y - 12); ctx.closePath(); ctx.fill();
    // Ear pink interior
    ctx.fillStyle = '#a02060';
    ctx.fillRect(o.x - 8, o.y - 14, 1, 1); ctx.fillRect(o.x + 7, o.y - 14, 1, 1);
    // Slit yellow eyes
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(o.x - 4, o.y - 3, 3, 3); ctx.fillRect(o.x + 1, o.y - 3, 3, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x - 3, o.y - 3, 1, 3); ctx.fillRect(o.x + 2, o.y - 3, 1, 3);
    // glowing 3rd eye (kept from original — red)
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(o.x - 8, o.y - 1, 2, 2);
    // Whiskers
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(o.x - 10, o.y + 1); ctx.lineTo(o.x - 4, o.y);
    ctx.moveTo(o.x - 10, o.y + 3); ctx.lineTo(o.x - 4, o.y + 2);
    ctx.moveTo(o.x + 10, o.y + 1); ctx.lineTo(o.x + 4, o.y);
    ctx.moveTo(o.x + 10, o.y + 3); ctx.lineTo(o.x + 4, o.y + 2);
    ctx.stroke();
    // Flick tail (small lash) — angle by jumpT phase
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(o.x + 10, o.y - 4, 6, 2);
    ctx.fillRect(o.x + 14, o.y - 6, 2, 4);
  } else if (o.type === 'mailbox') {
    const danger = o.fuse > 0;
    // post
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(o.x - 2, o.y + 12, 4, 8);
    ctx.fillStyle = '#5a3018';
    ctx.fillRect(o.x - 2, o.y + 12, 4, 1);
    // mailbox body
    ctx.fillStyle = danger ? (Math.floor(o.fuse * 10) % 2 === 0 ? '#ff3a3a' : '#fff') : '#4cc9f0';
    ctx.fillRect(o.x - 12, o.y - 12, 24, 24);
    ctx.fillStyle = danger ? (Math.floor(o.fuse * 10) % 2 === 0 ? '#a02020' : '#cacacf') : '#2a78a8';
    ctx.fillRect(o.x - 12, o.y - 12, 24, 2);
    // slot
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(o.x - 8, o.y - 4, 16, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x - 7, o.y - 3, 14, 4);
    // flag
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(o.x + 8, o.y - 6, 4, 12);
    ctx.fillStyle = '#a07810';
    ctx.fillRect(o.x + 11, o.y - 6, 1, 12);
    // address label
    ctx.fillStyle = '#fff';
    ctx.fillRect(o.x - 6, o.y + 4, 12, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(o.x - 5, o.y + 5, 2, 1); ctx.fillRect(o.x - 2, o.y + 5, 2, 1); ctx.fillRect(o.x + 1, o.y + 5, 2, 1);
    if (danger) {
      // burning fuse + sparks
      ctx.fillStyle = '#ff8e3c';
      ctx.fillRect(o.x, o.y - 18, 1, 6);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(o.x, o.y - 18, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// === ZOMBIE VARIANTS — 5 distinct kinds ===
function _drawZombieByKind(o) {
  const x = o.x, y = o.y, k = o._zombieKind;
  const arc = (ax, ay, ar) => { ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill(); };
  if (k === 'rotting') {
    ctx.fillStyle = '#2a4a2a'; ctx.fillRect(x - 11, y - 13, 22, 19);
    ctx.fillStyle = '#4a7a4a'; ctx.fillRect(x - 10, y - 12, 20, 18);
    ctx.fillStyle = '#2a4a2a'; ctx.fillRect(x - 8, y - 8, 16, 8);
    ctx.fillStyle = '#1a3a1a'; ctx.fillRect(x - 5, y - 4, 2, 2); ctx.fillRect(x + 3, y - 2, 2, 2);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x - 5, y - 6, 3, 3); ctx.fillRect(x + 2, y - 6, 3, 3);
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(x - 1, y + 4, 2, 4);
    ctx.fillStyle = '#4a7a4a'; ctx.fillRect(x + 10, y - 4, 6, 3);
    ctx.fillStyle = '#1a3a1a'; ctx.fillRect(x + 15, y - 4, 2, 3);
  } else if (k === 'child') {
    ctx.fillStyle = '#3a5a3a'; ctx.fillRect(x - 7, y - 8, 14, 14);
    ctx.fillStyle = '#5a8a5a'; ctx.fillRect(x - 7, y - 8, 14, 13);
    ctx.fillStyle = '#7aaa7a'; arc(x, y - 12, 8);
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(x - 3, y - 10, 6, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - 10, 1, 1); ctx.fillRect(x + 1, y - 10, 1, 1);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 14, 2, 2); ctx.fillRect(x + 1, y - 14, 2, 2);
    ctx.fillStyle = '#a06030'; ctx.fillRect(x + 6, y - 2, 4, 5);
    ctx.fillStyle = '#5a3010'; ctx.fillRect(x + 6, y - 4, 4, 2);
  } else if (k === 'runner') {
    ctx.fillStyle = '#1a3a1a'; ctx.fillRect(x - 12, y - 10, 22, 14);
    ctx.fillStyle = '#3a5a2a'; ctx.fillRect(x - 11, y - 9, 20, 13);
    ctx.fillStyle = '#7a9a4a'; arc(x + 8, y - 10, 6);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + 6, y - 12, 2, 2); ctx.fillRect(x + 10, y - 12, 2, 2);
    ctx.fillStyle = '#3a5a2a'; ctx.fillRect(x - 11, y + 4, 4, 8); ctx.fillRect(x + 6, y + 4, 4, 6);
    ctx.fillStyle = 'rgba(94,243,140,0.3)'; ctx.fillRect(x - 18, y - 8, 4, 12);
  } else if (k === 'tank') {
    ctx.fillStyle = '#0a1a0a'; ctx.fillRect(x - 16, y - 16, 32, 24);
    ctx.fillStyle = '#2a5a1a'; ctx.fillRect(x - 15, y - 15, 30, 22);
    ctx.fillStyle = '#1a3a0a'; ctx.fillRect(x - 12, y - 12, 24, 6);
    ctx.fillStyle = '#5a8a4a'; ctx.fillRect(x - 12, y - 12, 24, 1);
    ctx.fillStyle = '#2a5a1a'; ctx.fillRect(x - 18, y - 6, 6, 6); ctx.fillRect(x + 12, y - 6, 6, 6);
    ctx.fillStyle = '#5a8a3a'; arc(x, y - 16, 5);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x - 2, y - 17, 4, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 16, 2, 2);
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(x - 10, y - 2, 1, 6); ctx.fillRect(x - 7, y - 2, 1, 6);
    ctx.fillRect(x + 6, y - 2, 1, 6); ctx.fillRect(x + 9, y - 2, 1, 6);
  } else if (k === 'exploder') {
    const pulse = 0.7 + Math.sin(performance.now() / 120) * 0.3;
    ctx.fillStyle = '#3a4a1a'; arc(x, y, 13 * pulse);
    ctx.fillStyle = '#5a7a2a'; arc(x, y, 12);
    ctx.fillStyle = `rgba(255,90,40,${pulse * 0.7})`; arc(x, y + 1, 6);
    ctx.fillStyle = '#3a5a1a'; ctx.fillRect(x - 14, y - 2, 4, 3); ctx.fillRect(x + 10, y - 2, 4, 3);
    ctx.fillStyle = '#7a9a4a'; arc(x, y - 12, 4);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x - 2, y - 13, 1, 1); ctx.fillRect(x + 1, y - 13, 1, 1);
    if (pulse > 0.9) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 10, y - 8, 1, 1); ctx.fillRect(x + 9, y - 6, 1, 1); ctx.fillRect(x + 5, y + 12, 1, 1);
    }
  }
}

// Detailed vehicle chassis — dispatched by vehicle.name. Pug rider sits on top.
function _drawVehicleChassis(ctx, v) {
  const name = v.name || 'skateboard', col = v.color || '#fff';
  const arc = (ax, ay, ar) => { ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill(); };
  if (name === 'skateboard' || name === 'hoverboard') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-18, 10, 36, 3);
    ctx.fillStyle = col; ctx.fillRect(-18, -4, 36, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-18, -4, 36, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-18, 2, 36, 1);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(-15, -3, 30, 5);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-15, -3, 30, 1);
    if (name === 'hoverboard') {
      ctx.fillStyle = 'rgba(176,85,255,0.5)'; ctx.fillRect(-16, 4, 32, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-16, 4, 32, 1);
    } else {
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-14, 4, 5, 5); ctx.fillRect(9, 4, 5, 5);
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-14, 4, 5, 1); ctx.fillRect(9, 4, 5, 1);
    }
  } else if (name === 'motorbike' || name === 'scooter') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-18, 12, 36, 3);
    ctx.fillStyle = col; ctx.fillRect(-16, -8, 32, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-16, -8, 32, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-16, 4, 32, 2);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-18, 0, 4, 3);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-18, 0, 1, 3);
    ctx.fillStyle = '#0a0a0a'; arc(-14, 8, 6); arc(14, 8, 6);
    ctx.fillStyle = '#3a3a3a'; arc(-14, 8, 3); arc(14, 8, 3);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-15, 8, 2, 1); ctx.fillRect(13, 8, 2, 1);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(8, -10, 8, 2);
  } else if (name === 'van' || name === 'pizza truck' || name === 'cargo van') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-20, 12, 40, 3);
    ctx.fillStyle = col; ctx.fillRect(-20, -12, 40, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-20, -12, 40, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-20, 8, 40, 2);
    ctx.fillStyle = '#0a1a2a'; ctx.fillRect(-18, -10, 16, 8);
    ctx.fillStyle = 'rgba(140,200,255,0.55)'; ctx.fillRect(-18, -10, 16, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(2, -10, 16, 18);
    ctx.fillStyle = '#cacacf'; ctx.fillRect(8, -2, 2, 4); ctx.fillRect(12, -2, 2, 4);
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-18, 8, 6, 5); ctx.fillRect(12, 8, 6, 5);
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-18, 8, 6, 1); ctx.fillRect(12, 8, 6, 1);
    ctx.fillStyle = '#fff'; ctx.fillRect(-15, -2, 14, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(-14, -1, 2, 1); ctx.fillRect(-11, -1, 2, 1); ctx.fillRect(-8, -1, 2, 1);
  } else if (name === 'tiny tank') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-18, 11, 36, 3);
    ctx.fillStyle = col; ctx.fillRect(-16, -10, 32, 18);
    ctx.fillStyle = '#3a5a2a'; ctx.fillRect(-16, -10, 32, 1);
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-18, -10, 4, 20); ctx.fillRect(14, -10, 4, 20);
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 4; i++) { ctx.fillRect(-18, -8 + i * 5, 4, 2); ctx.fillRect(14, -8 + i * 5, 4, 2); }
    ctx.fillStyle = '#2a4a1a'; arc(0, -2, 7);
    ctx.fillStyle = '#5a8a3a'; arc(-1, -3, 4);
  } else if (name === 'shop cart') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-18, 11, 36, 3);
    ctx.fillStyle = col; ctx.fillRect(-18, -10, 36, 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    for (let i = -16; i <= 16; i += 4) { ctx.beginPath(); ctx.moveTo(i, -10); ctx.lineTo(i, 6); ctx.stroke(); }
    for (let j = -8; j <= 4; j += 4) { ctx.beginPath(); ctx.moveTo(-18, j); ctx.lineTo(18, j); ctx.stroke(); }
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(-16, 6, 4, 5); ctx.fillRect(12, 6, 4, 5);
    ctx.fillRect(-4, 8, 4, 3); ctx.fillRect(0, 8, 4, 3);
  } else if (name === 'rocket sled') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-20, 8, 40, 3);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-18, -8); ctx.lineTo(18, -10); ctx.lineTo(20, 0); ctx.lineTo(18, 8); ctx.lineTo(-18, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-15, -8, 30, 2);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(-22, -3, 4, 6);
    ctx.fillStyle = '#ff8e3c'; ctx.fillRect(-26, -2, 4, 4);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(-28, -1, 2, 2);
  } else if (name === 'bone chopper') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-18, 12, 36, 3);
    ctx.fillStyle = col; ctx.fillRect(-16, -8, 32, 14);
    ctx.fillStyle = '#fff'; arc(0, -2, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(-2, -3, 1, 2); ctx.fillRect(1, -3, 1, 2); ctx.fillRect(-1, 0, 2, 1);
    ctx.fillStyle = '#0a0a0a'; arc(-14, 8, 6); arc(14, 8, 6);
  } else {
    ctx.fillStyle = col; ctx.fillRect(-18, -10, 36, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-18, 8, 36, 2);
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-14, 8, 4, 3); ctx.fillRect(10, 8, 4, 3);
  }
}

const _HELMET_MAP = {
  'skateboard': '#ff8e3c', 'motorbike': '#ff3a3a', 'scooter': '#ffd23f',
  'cargo van': '#4cc9f0', 'van': '#4cc9f0', 'pizza truck': '#a02828',
  'tiny tank': '#5ef38c', 'shop cart': '#b055ff', 'hoverboard': '#b055ff',
  'rocket sled': '#ff5a3a', 'bone chopper': '#eae0c0',
};
function _riderHelmetColor(v) { return _HELMET_MAP[v.name] || '#ff3a3a'; }

// CARGO BOX ACCESSORY — small icon stuck on top of the box per delivery type
// so players can read at-a-glance what they're carrying.
function _drawCargoAccessory(ctx, bx, by, type) {
  if (type === 'pet') {
    // Pet ears + tiny pug face peeking from box
    ctx.fillStyle = '#c8854a';
    ctx.fillRect(bx - 4, by - 4, 8, 6);
    ctx.fillStyle = '#a06530';
    ctx.fillRect(bx - 5, by - 5, 2, 3); ctx.fillRect(bx + 3, by - 5, 2, 3); // ears
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(bx - 3, by - 3, 2, 1);
    ctx.fillRect(bx + 1, by - 3, 2, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 3, by - 3, 1, 1);
    // breathing hole
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(bx - 5, by + 2, 2, 1); ctx.fillRect(bx + 3, by + 2, 2, 1);
  } else if (type === 'fragile') {
    // Glass goblet symbol + caution stripes
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(bx - 6, by + 4, 12, 1);
    ctx.fillRect(bx - 6, by - 6, 12, 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 2, by - 4, 4, 4); // goblet bowl
    ctx.fillRect(bx - 1, by, 2, 2); // stem
    ctx.fillRect(bx - 3, by + 2, 6, 1); // foot
  } else if (type === 'urgent') {
    // Lightning bolt
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(bx - 2, by - 5); ctx.lineTo(bx + 1, by - 5);
    ctx.lineTo(bx - 1, by); ctx.lineTo(bx + 2, by);
    ctx.lineTo(bx - 2, by + 5); ctx.lineTo(bx, by + 1);
    ctx.lineTo(bx - 2, by + 1); ctx.closePath(); ctx.fill();
  } else if (type === 'vip') {
    // Crown
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(bx - 4, by - 1, 8, 3);
    ctx.fillRect(bx - 4, by - 4, 2, 3);
    ctx.fillRect(bx - 1, by - 5, 2, 4);
    ctx.fillRect(bx + 2, by - 4, 2, 3);
    ctx.fillStyle = '#ff3aa1';
    ctx.fillRect(bx - 1, by, 2, 2);
  } else if (type === 'multi') {
    // Stacked boxes icon
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 4, by - 3, 5, 3);
    ctx.fillRect(bx - 1, by, 5, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(bx - 4, by - 3, 5, 1);
    ctx.fillRect(bx - 1, by, 5, 1);
  } else if (type === 'radio') {
    // Radio antenna + reception bars
    ctx.fillStyle = '#cacacf';
    ctx.fillRect(bx, by - 8, 1, 6);
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(bx - 1, by - 9, 3, 2);
    // signal arcs
    ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(bx + 1, by - 7, 3, -Math.PI * 0.6, -Math.PI * 0.1); ctx.stroke();
  }
  // 'standard' → no extra icon (plain box)
}

function end() {
  // Idempotent: avoid double-submit if end() called from both damage() and tick().
  if (!running) return;
  running = false;
  sfx.sweep(330, 80, 'sawtooth', 0.5, 0.25);
  document.getElementById('end-title').textContent = pug.hp <= 0 ? 'WIPED OUT' : 'PIZZA COLD';
  document.getElementById('end-sub').textContent = pug.hp <= 0 ? 'The horde got the pizza too.' : 'Time ran out. The customer is upset.';
  document.getElementById('end-del').textContent = deliveries;
  document.getElementById('end-tip').textContent = '$' + (deliveries * 12);
  // Round-2 polish: surface BEST COMBO on end-stats list.
  const _comboEl = document.getElementById('end-combo');
  if (_comboEl) _comboEl.textContent = '×' + (maxComboThisRun || 0);
  const { isNewBest, current } = submitRun('delivery-pugs', { score: deliveries });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { score: deliveries };
    bestEl.innerHTML = `Best: <b>${b.score}</b> deliveries${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  if (_pauseBtn) _pauseBtn.classList.remove('is-shown');
  if (_pauseOv) _pauseOv.classList.remove('is-open');
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // S/A/B/C/D grade card — supplements existing end-overlay.
  try {
    const delPct  = Math.max(0, Math.min(100, (deliveries / 12) * 100));
    const survPct = pug.hp > 0 ? 100 : 0;
    const comboPct = Math.max(0, Math.min(100, ((combo || 0) / 6) * 100));
    showGradeCard({
      title: pug.hp <= 0 ? 'WIPED OUT' : 'SHIFT OVER',
      subtitle: `${deliveries} delivery${deliveries === 1 ? '' : 's'} · $${deliveries * 12} tips`,
      stats: [
        { label: 'Deliveries', value: delPct,    weight: 0.6 },
        { label: 'Survival',   value: survPct,   weight: 0.2 },
        { label: 'Combo',      value: comboPct,  weight: 0.2 },
      ],
      breakdown: [
        { label: 'Deliveries done', value: deliveries,  max: 12 },
        { label: 'Best combo',      value: combo || 0,  max: 6 },
        { label: 'Tips ($)',        value: deliveries * 12, max: 144 },
      ],
      onRestart: () => start(),
    });
  } catch (e) { /* */ }
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _dpHud = {
  del: document.getElementById('hud-del'),
  time: document.getElementById('hud-time'),
  timeParent: document.getElementById('hud-time')?.parentElement,
  fuel: document.getElementById('hud-fuel'),
  fuelParent: document.getElementById('hud-fuel')?.parentElement,
  vehicle: document.getElementById('hud-vehicle'),
  best: document.getElementById('hud-best'),
};
let _dpHudPrev = { del: -1, time: -1, timeLow: null, fuel: -1, fuelLow: null, vehicle: '', best: -1 };
let _dpBestCache = -1, _dpBestCacheT = 0;
function updateHud() {
  if (deliveries !== _dpHudPrev.del) { _dpHud.del.textContent = deliveries; _dpHudPrev.del = deliveries; }
  const t = Math.ceil(time);
  if (t !== _dpHudPrev.time) { _dpHud.time.textContent = t; _dpHudPrev.time = t; }
  const tLow = time < 8;
  if (tLow !== _dpHudPrev.timeLow && _dpHud.timeParent) {
    _dpHud.timeParent.classList.toggle('is-low', tLow);
    _dpHudPrev.timeLow = tLow;
  }
  const f = Math.floor(fuel);
  if (f !== _dpHudPrev.fuel) { _dpHud.fuel.textContent = f; _dpHudPrev.fuel = f; }
  const fLow = fuel < 25;
  if (fLow !== _dpHudPrev.fuelLow && _dpHud.fuelParent) {
    _dpHud.fuelParent.classList.toggle('is-low', fLow);
    _dpHudPrev.fuelLow = fLow;
  }
  const vn = vehicle.name.toUpperCase();
  if (vn !== _dpHudPrev.vehicle) { _dpHud.vehicle.textContent = vn; _dpHudPrev.vehicle = vn; }
  const now = performance.now();
  if (now - _dpBestCacheT > 2000) {
    const best = loadBest('delivery-pugs');
    _dpBestCache = best ? best.score : 0;
    _dpBestCacheT = now;
  }
  if (_dpBestCache !== _dpHudPrev.best) { _dpHud.best.textContent = _dpBestCache; _dpHudPrev.best = _dpBestCache; }
}

// === Wave 1E: vehicle selector + garage upgrades + pause ===
function renderVehSel() {
  const row = document.getElementById('dp-veh-row'); if (!row) return;
  row.innerHTML = '';
  for (const id of STARTER_VEHICLES) {
    const v = VEHICLES[id], b = document.createElement('button');
    b.type = 'button';
    b.className = 'dp-veh-btn' + (selectedStartVehicle === id ? ' is-active' : '');
    b.innerHTML = `${v.icon} ${v.name.toUpperCase()}<span class="dp-veh-stats">SPD ${v.speed} · HP ${v.hp}</span>`;
    b.addEventListener('click', () => { selectedStartVehicle = id; renderVehSel(); });
    row.appendChild(b);
  }
}
const _GARAGE_TIERS = [['speedT','⚡ SPEED','+20 speed'], ['hpT','🛡 ARMOR','+1 HP'], ['fuelT','⛽ FUEL','+20 fuel']];
function renderGarage() {
  const root = document.getElementById('dp-garage'); if (!root) return;
  const earnEl = document.getElementById('dp-earn');
  if (earnEl) earnEl.textContent = `$${totalEarnings} earnings · spend on upgrades:`;
  root.innerHTML = '';
  for (const [id, label, desc] of _GARAGE_TIERS) {
    // Polish R2: softer cost curve (was 30 + cur * 40 → 25 + cur * 30)
    const cur = garageUpgrades[id] || 0, price = 25 + cur * 30, maxed = cur >= 5;
    const div = document.createElement('div'); div.className = 'dp-up-row';
    div.innerHTML = `<b>${label}</b>Lv ${cur}/5<br><span style="font-size:0.4rem;color:var(--muted)">${desc}</span>`;
    const btn = document.createElement('button'); btn.className = 'dp-up-btn';
    btn.textContent = maxed ? 'MAX' : `$${price}`;
    btn.disabled = maxed || totalEarnings < price;
    btn.addEventListener('click', () => {
      if (maxed || totalEarnings < price) return;
      totalEarnings -= price; saveEarnings();
      garageUpgrades[id] = cur + 1; saveGarage(); renderGarage();
    });
    div.appendChild(btn); root.appendChild(div);
  }
}
renderVehSel(); renderGarage();
{
  const so = document.getElementById('overlay');
  if (so) new MutationObserver(() => {
    if (!so.hidden && !so.classList.contains('is-hidden')) { renderVehSel(); renderGarage(); }
  }).observe(so, { attributes: true, attributeFilter: ['hidden','class'] });
}
// Pause menu
const _pauseOv = document.getElementById('dp-pause');
const _pauseBtn = document.getElementById('pause-btn');
function togglePause(forceState) {
  if (!running) return;
  const wasPaused = paused;
  paused = typeof forceState === 'boolean' ? forceState : !paused;
  if (_pauseOv) _pauseOv.classList.toggle('is-open', paused);
  // Polish R2: auto-resume after pause — when transitioning from paused→running
  // via the resume button (not via the menu close), show 5s countdown overlay
  // so the player can re-orient before action picks back up.
  if (wasPaused && !paused) {
    resumeCountdownT = 3; // 3s feels right — 5 was too long in playtesting
  }
}
if (_pauseBtn) _pauseBtn.addEventListener('click', () => togglePause());
window.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { togglePause(); e.preventDefault(); }
});
document.getElementById('pause-resume')?.addEventListener('click', () => togglePause(false));
document.getElementById('pause-restart')?.addEventListener('click', () => { togglePause(false); start(); });

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  // Set up the chosen route (if any) BEFORE reset() so the first marker uses it.
  const chosen = ROUTES.find((r) => r.id === selectedRouteId) || ROUTES[0];
  activeRoute = chosen.stops ? { ...chosen, index: 0, awarded: false } : null;
  reset(); running = true;
  keys.clear(); touchAim = null; invuln = 0; // wipe stuck inputs / invuln from prior match
  // Wipe stale delivery-feed lines from a previous match.
  try { __deliveryFeed.clear(); } catch (e) { /* */ }
  if (activeRoute) {
    try { __deliveryFeed.push(`📍 ROUTE: ${activeRoute.name} · target ${activeRoute.target}`, '#5ef38c'); } catch (e) { /* */ }
  }
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  if (_pauseBtn) _pauseBtn.classList.add('is-shown');
  if (_pauseOv) _pauseOv.classList.remove('is-open');
  paused = false;
  sfx.resume();
  try { music.setIntensity(0.4); music.play(); } catch {}
}
// Weather-driven music intensity sampler.
setInterval(() => {
  if (!running) return;
  try {
    let i = 0.4;
    if (weather === 'rain') i = 0.7;
    else if (weather === 'fog') i = 0.55;
    else if (weather === 'night') i = 0.85;
    music.setIntensity(i);
  } catch {}
}, 500);
(function _wireDeliveryMusicEnd() {
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
  lastT = now; tickInvuln(dt); tick(dt);
  if (running) render();
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip — shows briefly when the game starts (every match).
// Touch + desktop split — joystick + boost button on mobile.
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      const msg = _isTouch
        ? 'JOYSTICK drive · ⚡ BOOST button · don\'t crash! 100% intact = 1.5× payout'
        : 'WASD drive · SHIFT boost · don\'t crash! INTACT% drops on hits — 100% intact = 1.5× payout';
      showTip(msg, 7500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Boost (SHIFT) burns fuel — refuel at gas stations.',
    'TIP: Stay 100% intact for 1.5× tips.',
    'TIP: Each 5th delivery = new vehicle.',
    'TIP: Chain deliveries fast for combo multipliers.',
    'LORE: The pugs survived because someone always wants pizza.',
    'TIP: Mutant cats hit hard — dodge them.',
    'JOKE: Why was the pizza late? Zombies in the elevator.',
  ];
  const GAME_ID = 'delivery-pugs';
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
        if (best && (best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.score} deliveries`;
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
      const d = document.getElementById('end-del')?.textContent || '0';
      const t = document.getElementById('end-tip')?.textContent || '$0';
      const text = `🐶 APOCALYPSE DELIVERY PUGS — ${d} deliveries, ${t} tips! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'APOCALYPSE DELIVERY PUGS', text, url: 'https://leobalkind.github.io/web-games/' });
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

// ============================================================================
// v2.5 DELIV-013: Engine SFX pitched to speed.
// Continuous low rumble whose frequency mirrors the player's current speed.
// Created once, gain ramped down to 0 when game pauses / unmuted.
// ============================================================================
(function _r5EnginePitch() {
  let ac = null, osc = null, gain = null, filt = null;
  function start() {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      osc = ac.createOscillator();
      gain = ac.createGain();
      filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 600;
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      gain.gain.value = 0;
      osc.connect(filt); filt.connect(gain); gain.connect(ac.destination);
      osc.start();
    } catch {}
  }
  // Start lazily on first user gesture
  window.addEventListener('pointerdown', () => { if (!ac) start(); }, { once: true });
  window.addEventListener('keydown', () => { if (!ac) start(); }, { once: true });

  let lastTargetFreq = 60;
  setInterval(() => {
    if (!gain || !osc) return;
    const muted = localStorage.getItem('wg:settings:muted') === '1';
    const speed = (typeof window.__deliverySpeed === 'number') ? Math.abs(window.__deliverySpeed) : 0;
    const targetVol = muted ? 0 : Math.min(0.04, 0.005 + speed * 0.005);
    const targetFreq = 50 + Math.min(180, speed * 14);
    try {
      gain.gain.linearRampToValueAtTime(targetVol, ac.currentTime + 0.12);
      if (Math.abs(targetFreq - lastTargetFreq) > 4) {
        osc.frequency.linearRampToValueAtTime(targetFreq, ac.currentTime + 0.12);
        lastTargetFreq = targetFreq;
      }
    } catch {}
  }, 200);
})();

// ============================================================================
// v2.5 DELIV-019: Tutorial — first delivery has guide-arrow + slow time.
// Adds a 6-second slow-mo class to body on first run only. Existing arrow
// already exists; we just amplify it briefly.
// ============================================================================
(function _r5DeliveryTutorial() {
  if (localStorage.getItem('delivery:tutSeen') === '1') return;
  const startOv = document.getElementById('overlay');
  const fire = () => {
    if (localStorage.getItem('delivery:tutSeen') === '1') return;
    localStorage.setItem('delivery:tutSeen', '1');
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(20,8,32,0.95);color:#fff;border:2px solid #ffd23f;padding:10px 14px;font-family:"Press Start 2P",monospace;font-size:9px;border-radius:6px;z-index:9998;max-width:340px;text-align:center;line-height:1.6;box-shadow:0 0 24px rgba(255,210,63,0.45);';
    tip.innerHTML = '<div style="color:#ffd23f;margin-bottom:6px;">FIRST DELIVERY!</div>'
      + '<div>Follow the YELLOW ARROW to the pickup.</div>'
      + '<div style="margin-top:4px">Then to the GREEN DROP-OFF.</div>'
      + '<div style="margin-top:10px;color:#5ef38c;font-size:8px;opacity:0.7">click to dismiss</div>';
    tip.addEventListener('click', () => tip.remove(), { once: true });
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 7000);
  };
  if (startOv) {
    const onHide = () => {
      const visible = !startOv.hidden && !startOv.classList.contains('is-hidden');
      if (!visible) setTimeout(fire, 1500);
    };
    new MutationObserver(onHide).observe(startOv, { attributes: true, attributeFilter: ['hidden','class'] });
  }
})();

// ============================================================================
// v2.6 DELIV-004: Customer emoji reactions on delivery. Watches `#hud-del`
// counter — whenever it increments, picks an emoji (😊/🤩/😡 based on tip
// magnitude derived from time-since-last) and floats it up from bottom-center.
// ============================================================================
(function _r6DelivCustomerReact() {
  const del = document.getElementById('hud-del');
  if (!del) return;
  let last = 0, lastTime = performance.now();
  setInterval(() => {
    const cur = parseInt((del.textContent || '').replace(/\D/g, ''), 10) || 0;
    if (cur > last) {
      const dt = performance.now() - lastTime;
      lastTime = performance.now();
      // Faster delivery = happier emoji
      const em = dt < 8000 ? '🤩' : dt < 15000 ? '😊' : dt < 30000 ? '😐' : '😡';
      const col = dt < 8000 ? '#5ef38c' : dt < 15000 ? '#4cc9f0' : dt < 30000 ? '#ffd23f' : '#ff3aa1';
      const bub = document.createElement('div');
      bub.textContent = em + ' DELIVERED';
      bub.style.cssText = 'position:fixed;bottom:30%;left:50%;transform:translateX(-50%);background:rgba(20,8,32,0.92);color:' + col + ';border:1px solid ' + col + ';padding:6px 14px;font-family:"Press Start 2P",monospace;font-size:11px;border-radius:4px;z-index:9997;pointer-events:none;animation:delCustomerRise 1.8s ease-out forwards;';
      document.body.appendChild(bub);
      setTimeout(() => bub.remove(), 1900);
    }
    last = cur;
  }, 250);
  if (!document.getElementById('del-customer-style')) {
    const s = document.createElement('style');
    s.id = 'del-customer-style';
    s.textContent = '@keyframes delCustomerRise{0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.7)}15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.18)}30%{transform:translateX(-50%) translateY(0) scale(1)}82%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-40px) scale(0.95)}}';
    document.head.appendChild(s);
  }
})();

// ============================================================================
// v2.6 DELIV-012: Achievement — 5 perfect deliveries in a row. Reads the
// combo stat from `#end-combo` after a run (or live via `#hud-combo` if
// exposed). Persists `delivery:achievement:5streak`.
// ============================================================================
(function _r6DelivStreakAch() {
  const KEY = 'delivery:achievement:5streak';
  if (localStorage.getItem(KEY) === '1') return;
  const del = document.getElementById('hud-del');
  let streak = 0, last = 0;
  setInterval(() => {
    if (localStorage.getItem(KEY) === '1') return;
    const cur = parseInt((del?.textContent || '').replace(/\D/g, ''), 10) || 0;
    if (cur > last) {
      // Heuristic: each new delivery counts as +1 streak; a hud "fail" indicator
      // (smoke/sparks class) breaks it. Best-effort: read window.__deliveryPerfectStreak.
      streak = (typeof window.__deliveryPerfectStreak === 'number') ? window.__deliveryPerfectStreak : streak + 1;
    }
    last = cur;
    if (streak >= 5) {
      localStorage.setItem(KEY, '1');
      const toast = document.createElement('div');
      toast.textContent = '★ 5 PERFECT DELIVERIES IN A ROW!';
      toast.style.cssText = 'position:fixed;top:30%;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#ffd23f,#ff8e3c);color:#0a0716;padding:10px 18px;font-family:"Press Start 2P",monospace;font-size:10px;border-radius:6px;z-index:9999;pointer-events:none;animation:delStreakPop 3.4s ease-out forwards;box-shadow:0 0 24px rgba(255,210,63,0.55);font-weight:bold;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3500);
      if (!document.getElementById('del-streak-style')) {
        const s = document.createElement('style');
        s.id = 'del-streak-style';
        s.textContent = '@keyframes delStreakPop{0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.5)}12%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.18)}28%{transform:translateX(-50%) translateY(0) scale(1)}90%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-12px)}}';
        document.head.appendChild(s);
      }
    }
  }, 350);
  // Reset streak when starting overlay shows
  const sov = document.getElementById('overlay');
  if (sov) {
    new MutationObserver(() => { if (!sov.hidden) streak = 0; }).observe(sov, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
})();

// ============================================================================
// v2.7 DELIV-011: Gyro steering option — top-left "🧭 GYRO" toggle pill;
// when ON requests devicemotion permission (iOS) and exposes
// window.__deliveryGyro = {tilt} for game-side steering hook. Persisted.
// ============================================================================
(function _r7DelivGyro() {
  const isTouch = matchMedia('(hover:none)').matches || 'ontouchstart' in window;
  if (!isTouch) return;
  let on = localStorage.getItem('delivery:gyro') === '1';
  const pill = document.createElement('div');
  pill.id = 'r7-deliv-gyro';
  pill.style.cssText = 'position:fixed;top:14px;left:14px;background:rgba(20,8,32,0.94);color:#4cc9f0;border:1px solid #4cc9f0;font-family:"Press Start 2P",monospace;font-size:8px;padding:5px 10px;border-radius:3px;z-index:55;letter-spacing:1px;cursor:pointer;display:none;';
  function refresh() {
    pill.textContent = '🧭 GYRO: ' + (on ? 'ON' : 'OFF');
    pill.style.color = on ? '#5ef38c' : '#4cc9f0';
    pill.style.borderColor = pill.style.color;
  }
  refresh();
  let handler = null;
  function start() {
    handler = (e) => {
      const tilt = (e.gamma || 0) / 45; // -1..1
      window.__deliveryGyro = { tilt: Math.max(-1, Math.min(1, tilt)), t: performance.now() };
    };
    window.addEventListener('deviceorientation', handler);
  }
  function stop() {
    if (handler) window.removeEventListener('deviceorientation', handler);
    handler = null;
    window.__deliveryGyro = null;
  }
  pill.addEventListener('click', async () => {
    on = !on;
    try { localStorage.setItem('delivery:gyro', on ? '1' : '0'); } catch {}
    refresh();
    if (on) {
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          const r = await DeviceOrientationEvent.requestPermission();
          if (r !== 'granted') { on = false; refresh(); return; }
        }
        start();
      } catch {}
    } else stop();
  });
  document.body.appendChild(pill);
  // Show only when HUD visible
  const hud = document.getElementById('hud');
  setInterval(() => {
    pill.style.display = (hud && hud.hidden) ? 'none' : 'block';
  }, 400);
  if (on) start();
})();

// ============================================================================
// v2.7 DELIV-extra (DELIV-005 extension): Favorite vehicle stat tracker —
// records which vehicle the player most-used and displays it on the start
// overlay. Reads `window.__deliveryVehicle` or falls back to HUD text.
// Persists `delivery:vehicleStats` keyed by vehicle name.
// ============================================================================
(function _r7DelivFavVehicle() {
  const start = document.getElementById('overlay-start') || document.getElementById('overlay');
  const hud = document.getElementById('hud');
  if (!start) return;
  let stats = {};
  try { stats = JSON.parse(localStorage.getItem('delivery:vehicleStats') || '{}') || {}; } catch {}
  function track() {
    if (hud && hud.hidden) return;
    const v = (window.__deliveryVehicle || '').toString().toUpperCase()
      || (document.getElementById('hud-vehicle')?.textContent || '').trim().toUpperCase()
      || 'SCOOTER';
    if (!v || v === '—' || v === '-') return;
    stats[v] = (stats[v] || 0) + 1;
    try { localStorage.setItem('delivery:vehicleStats', JSON.stringify(stats)); } catch {}
  }
  setInterval(track, 5000);
  function injectChip() {
    if (start.hidden) return;
    if (document.getElementById('r7-deliv-fav')) return;
    const top = Object.entries(stats).sort((a, b) => b[1] - a[1])[0];
    if (!top) return;
    const chip = document.createElement('div');
    chip.id = 'r7-deliv-fav';
    chip.textContent = '🏆 FAVORITE: ' + top[0];
    chip.style.cssText = 'position:absolute;top:14px;right:14px;background:rgba(20,8,32,0.92);color:#ffd23f;border:1px solid #ffd23f;font-family:"Press Start 2P",monospace;font-size:8px;padding:5px 10px;border-radius:3px;letter-spacing:1px;pointer-events:none;z-index:10;';
    start.appendChild(chip);
  }
  new MutationObserver(injectChip).observe(start, { attributes: true, attributeFilter: ['hidden', 'class'] });
  injectChip();
})();

// ============================================================================
// v2.8 DELIV-021: Fuel-low warning — when `#hud-fuel` drops below 20, flash
// a yellow "⛽ LOW FUEL" chip pulsing at the top-right of the screen.
// ============================================================================
(function _r8DelivFuelLow() {
  const fuel = document.getElementById('hud-fuel');
  if (!fuel) return;
  const chip = document.createElement('div');
  chip.id = 'r8-deliv-fuellow';
  chip.textContent = '⛽ LOW FUEL';
  chip.style.cssText = 'position:fixed;top:120px;right:14px;background:rgba(40,28,8,0.95);color:#ffd23f;border:1px solid #ffd23f;font-family:"Press Start 2P",monospace;font-size:10px;padding:5px 10px;border-radius:4px;z-index:60;letter-spacing:2px;pointer-events:none;display:none;animation:r8DelivFuelPulse 0.85s ease-in-out infinite alternate;';
  document.body.appendChild(chip);
  setInterval(() => {
    const f = parseInt((fuel.textContent || '').replace(/\D/g, ''), 10) || 0;
    if (f > 0 && f < 20) chip.style.display = 'block';
    else chip.style.display = 'none';
  }, 400);
  if (!document.getElementById('r8-deliv-fuel-style')) {
    const s = document.createElement('style');
    s.id = 'r8-deliv-fuel-style';
    s.textContent = '@keyframes r8DelivFuelPulse{from{opacity:0.65;transform:scale(1)}to{opacity:1;transform:scale(1.06)}}';
    document.head.appendChild(s);
  }
})();

// ============================================================================
// v2.8 DELIV-022: Lifetime deliveries counter — accumulates total deliveries
// across runs (counts `#hud-del` peak on end-overlay), shows on start overlay.
// ============================================================================
(function _r8DelivLifetime() {
  const del = document.getElementById('hud-del');
  const start = document.getElementById('overlay');
  const end = document.getElementById('end-overlay');
  if (!del || !start || !end) return;
  let lifetime = parseInt(localStorage.getItem('delivery:lifetimeDeliv') || '0', 10) || 0;
  let lastPeak = 0;
  let endVisible = false;
  setInterval(() => {
    const cur = parseInt((del.textContent || '').replace(/\D/g, ''), 10) || 0;
    if (cur > lastPeak) lastPeak = cur;
    const endVis = !end.hidden && !end.classList.contains('is-hidden');
    if (endVis && !endVisible && lastPeak > 0) {
      lifetime += lastPeak;
      try { localStorage.setItem('delivery:lifetimeDeliv', String(lifetime)); } catch {}
      lastPeak = 0;
      inject();
    }
    if (!endVis) lastPeak = Math.max(lastPeak, cur);
    endVisible = endVis;
  }, 700);
  function inject() {
    if (start.hidden) return;
    let chip = document.getElementById('r8-deliv-lifetime');
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'r8-deliv-lifetime';
      chip.style.cssText = 'position:absolute;top:38px;right:14px;background:rgba(20,8,32,0.92);color:#9b5de5;border:1px solid #9b5de5;font-family:"Press Start 2P",monospace;font-size:8px;padding:5px 10px;border-radius:3px;letter-spacing:1px;pointer-events:none;z-index:10;';
      start.appendChild(chip);
    }
    chip.textContent = '📦 LIFETIME DROPS: ' + lifetime;
  }
  new MutationObserver(inject).observe(start, { attributes: true, attributeFilter: ['hidden', 'class'] });
  inject();
})();
