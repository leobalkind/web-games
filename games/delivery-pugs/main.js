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

const WORLD_W = 2400, WORLD_H = 1800;
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
};

let pug, vehicle, marker, obstacles, time, deliveries, fuel, running, cam;
let powerups, skidMarks, nitroT, shieldT, magnetT;
// CARGO FRAGILITY — each delivery starts at 100% intact. Every collision (any
// damage source) drops it 10%. Payout (= time bonus + tip $$) scales with how
// intact the cargo arrives: 1.5× at 100%, 1.0× at 50%, 0.5× at 0%.
let intact = 100;
let intactFlashT = 0; // brief red pulse on damage
let combo = 0, comboT = 0, toxicPuddles = [], spikeStrips = [], achievementsSeen = new Set();
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
// Map upgrade: world decor (rendered once per match), city center landmark, road events
let cityCenter = null;        // {x, y} with bus + tower + campfire components
let trafficLights = [];       // {x, y, phase, t} — cycles red/yellow/green
let wreckedCars = [];         // {x, y, ang, color}
let billboards = [];          // {x, y, ang, text, color, scrollT}
let phonePoles = [];          // {x, y, neighborY}
let campfires = [];           // {x, y, flickerT, sparks: []}
let debris = [];              // {x, y, sz, color, ang}
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
  vehicle = VEHICLES.skateboard;
  pug = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, ang: 0, hp: vehicle.hp };
  marker = newMarker();
  obstacles = [];
  for (let i = 0; i < 40; i++) spawnObstacle();
  // 6 drones initially
  for (let i = 0; i < 4; i++) spawnDrone();
  powerups = [];
  for (let i = 0; i < 5; i++) spawnPowerup();
  skidMarks = [];
  nitroT = 0; shieldT = 0; magnetT = 0;
  combo = 0; comboT = 0;
  driftHoldT = 0; driftAwardedT = 0;
  nearMissBank = new WeakMap();
  stuntMult = 1; stuntMultT = 0;
  toxicPuddles = []; spikeStrips = []; toasts = [];
  weather = 'clear'; weatherT = 0; raindrops = [];
  // Spawn raccoons (2), toxic puddles (5), spike strips (4)
  for (let i = 0; i < 2; i++) spawnRaccoon();
  for (let i = 0; i < 5; i++) toxicPuddles.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), r: 36 });
  for (let i = 0; i < 4; i++) spikeStrips.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), w: 80 });
  time = 35; deliveries = 0; fuel = 100;
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
  // Road events
  eventTimer = 25 + Math.random() * 15;
  activeEvent = null; bonusMarker = null;
}

function buildCityDecor() {
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
  const ROAD = 320;
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
function spawnObstacle() {
  const type = Math.random();
  let o;
  if (type < 0.45) {
    o = { type: 'zombie', x: rand(0, WORLD_W), y: rand(0, WORLD_H), vx: 0, vy: 0, speed: 50 + Math.random() * 40 };
  } else if (type < 0.75) {
    o = { type: 'cat', x: rand(0, WORLD_W), y: rand(0, WORLD_H), vx: 0, vy: 0, speed: 110, jumpT: 0 };
  } else {
    o = { type: 'mailbox', x: rand(0, WORLD_W), y: rand(0, WORLD_H), fuse: -1 }; // -1 = stationary, set positive when triggered
  }
  obstacles.push(o);
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
  _cityAmbience(dt);
  time -= dt;
  if (time <= 0) return end();
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
  if (mx || my) {
    const l = Math.hypot(mx, my);
    pug.vx += (mx / l) * vehicle.speed * boost * weatherSpeedMul * dt * 4;
    pug.vy += (my / l) * vehicle.speed * boost * weatherSpeedMul * dt * 4;
    pug.ang = Math.atan2(my, mx); // visual facing
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
    if (skidMarks.length > 200) skidMarks.shift();
    // Round 2C: tire smoke puffs during drift (denser when actually drifting)
    if (Math.random() < (drifting ? 0.55 : 0.3)) spawnTireSmoke(pug.x, pug.y);
  }
  // Perf: prune in-place via reverse-iter splice — avoids per-frame array realloc.
  for (let i = skidMarks.length - 1; i >= 0; i--) {
    const s = skidMarks[i]; s.t += dt;
    if (s.t >= 3) skidMarks.splice(i, 1);
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
      try { __deliveryFeed.push(`★ DRIFT +50`, '#ff8e3c'); } catch (e) { /* */ }
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
    deliveries++;
    // Combo: deliveries within 12s chain
    if (comboT > 0) combo = Math.min(99, combo + 1); else combo = 1;
    comboT = 12;
    const baseBonus = 18 + Math.floor(combo * 0.5);
    // CARGO FRAGILITY MULTIPLIER — payout scales from 0.5× (0% intact) to
    // 1.5× (100% intact). Linear: 0.5 + intact/100.
    const intactMul = 0.5 + (intact / 100);
    // Stunt multiplier from drifts/near-misses scales the delivery time
    // payout, giving Crazy Taxi-style "drive crazy = bigger payday" loop.
    const bonusTime = Math.floor(baseBonus * stuntMult * intactMul);
    time = Math.min(time + bonusTime, 60);
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
    // RESET intact for next delivery
    intact = 100; intactFlashT = 0;
    // Refresh the stunt multiplier window on every delivery so stunts during
    // delivery runs keep the chain alive (separate decay so multi-stunt
    // runs feel rewarding).
    if (stuntMult > 1) stuntMultT = 6;
    sfx.arp([523, 659, 784, 1047], 'triangle', 0.08, 0.22, 0.25);
    // Round 2C: cheer SFX layered on top (rising arpeggio + bright tone)
    sfx.tone(1320, 'triangle', 0.18, 0.22);
    sfx.tone(1760, 'triangle', 0.12, 0.18);
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
function damage() {
  if (invuln > 0) return;
  if (shieldT > 0) {
    shieldT = 0; invuln = 0.4; sfx.tone(880, 'sine', 0.12, 0.2);
    addShake(3, 0.15); addBurst(pug.x, pug.y, '#4cc9f0', 10);
    return;
  }
  pug.hp--;
  invuln = 1.0;
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
  // Flash the bar so the player sees the hit cost them payout, not just HP.
  intact = Math.max(0, intact - 8);
  intactFlashT = 0.4;
  addPopup(pug.x, pug.y - 12, '-8% INTACT', '#ff8e3c');
  if (pug.hp <= 0) end();
}

function tickInvuln(dt) { invuln = Math.max(0, invuln - dt); }

function render() {
  // World view
  ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, 0, W, H);
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
  // Skid marks (under everything)
  for (const s of skidMarks) {
    const a = (1 - s.t / 3) * 0.6;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.ang);
    ctx.fillRect(-12, -4, 4, 2); ctx.fillRect(-12, 2, 4, 2);
    ctx.restore();
  }
  // Marker
  ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 20;
  ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(marker.x, marker.y, 40 + Math.sin(performance.now() / 200) * 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#5ef38c'; ctx.font = "20px serif";
  ctx.textAlign = 'center'; ctx.fillText('📍', marker.x, marker.y + 7);
  ctx.shadowBlur = 0;
  // Obstacles
  for (const o of obstacles) drawObstacle(o);
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
  // Pug-vehicle — vehicle chassis + high-detail pug rider
  ctx.save();
  ctx.translate(pug.x, pug.y);
  ctx.rotate(pug.ang + Math.PI / 2); // rotate so the pug faces movement direction
  ctx.fillStyle = vehicle.color;
  ctx.fillRect(-18, -10, 36, 20);
  // pug rider centered on chassis
  drawPug(ctx, 0, 0, { size: 26, helmet: true, helmetColor: '#ff3a3a' });
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
  if (weather === 'night') {
    // Night tightens vignette — only ~180px around pug is lit
    const grd = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 240);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    // small headlight cone in the direction of motion
    const sp = Math.hypot(pug.vx, pug.vy);
    if (sp > 30) {
      const dir = Math.atan2(pug.vy, pug.vx);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(dir);
      const hgrd = ctx.createRadialGradient(0, 0, 10, 80, 0, 120);
      hgrd.addColorStop(0, 'rgba(255,230,180,0.18)');
      hgrd.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = hgrd;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 220, -0.45, 0.45);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  } else if (weather === 'fog') {
    const grd = ctx.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, 460);
    grd.addColorStop(0, 'rgba(180,180,200,0)');
    grd.addColorStop(1, 'rgba(180,180,200,0.85)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    // Extra grey overlay so distance fades to grey
    ctx.fillStyle = 'rgba(180,180,200,0.12)';
    ctx.fillRect(0, 0, W, H);
  } else if (weather === 'rain') {
    ctx.fillStyle = 'rgba(0,0,40,0.18)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,180,255,0.5)';
    ctx.lineWidth = 1;
    for (const d of raindrops) {
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 4, d.y + 10); ctx.stroke();
    }
  }
  // Crazy Taxi directional arrow — large screen-edge arrow pointing to the
  // current marker. Hides when the marker is on-screen so it doesn't clutter
  // the camera view; otherwise clamps to a viewport-edge ring. Also draws an
  // "ETA: X.Xs" estimate beneath the arrow head based on straight-line
  // distance / current speed (clamped so a parked vehicle doesn't show 9999).
  {
    const dxA = marker.x - pug.x, dyA = marker.y - pug.y;
    const dA = Math.hypot(dxA, dyA);
    // On-screen detection — marker screen position vs viewport with a small
    // safety margin so the arrow shows again the moment it slips off-edge.
    const markerScreenX = marker.x - cam.x + W / 2;
    const markerScreenY = marker.y - cam.y + H / 2;
    const offEdge = markerScreenX < 60 || markerScreenX > W - 60 ||
                    markerScreenY < 60 || markerScreenY > H - 60;
    if (offEdge && dA > 80) {
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
  const mmW = 130, mmH = 90, mmX = W - mmW - 12, mmY = 60;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 1;
  ctx.strokeRect(mmX + 0.5, mmY + 0.5, mmW - 1, mmH - 1);
  const sx = mmW / WORLD_W, sy = mmH / WORLD_H;
  // marker
  ctx.fillStyle = '#5ef38c';
  ctx.fillRect(mmX + marker.x * sx - 2, mmY + marker.y * sy - 2, 4, 4);
  // pug
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(mmX + pug.x * sx - 2, mmY + pug.y * sy - 2, 4, 4);
  // obstacles
  for (const o of obstacles) {
    ctx.fillStyle = o.type === 'drone' ? '#ff3a3a' : 'rgba(255,58,58,0.5)';
    ctx.fillRect(mmX + o.x * sx, mmY + o.y * sy, 2, 2);
  }
}

function drawObstacle(o) {
  if (o.type === 'raccoon') {
    ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(o.x - 7, o.y - 3, 5, 3); ctx.fillRect(o.x + 2, o.y - 3, 5, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(o.x - 4, o.y - 2, 2, 2); ctx.fillRect(o.x + 2, o.y - 2, 2, 2);
    ctx.fillStyle = '#000'; ctx.fillRect(o.x - 3, o.y - 1, 1, 1); ctx.fillRect(o.x + 3, o.y - 1, 1, 1);
    // tail
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(o.x + 7, o.y - 2, 8, 4);
    ctx.fillStyle = '#222'; ctx.fillRect(o.x + 10, o.y - 2, 2, 4);
  } else if (o.type === 'drone') {
    // Glowing drone with shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(o.x, o.y + 18, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#3a3a4a'; ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#222';
    ctx.fillRect(o.x - 14, o.y - 1, 6, 2); ctx.fillRect(o.x + 8, o.y - 1, 6, 2);
  } else if (o.type === 'zombie') {
    ctx.fillStyle = '#4a7a4a'; ctx.fillRect(o.x - 10, o.y - 12, 20, 18);
    ctx.fillStyle = '#2a4a2a'; ctx.fillRect(o.x - 8, o.y - 8, 16, 8);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(o.x - 5, o.y - 6, 3, 3); ctx.fillRect(o.x + 2, o.y - 6, 3, 3);
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(o.x - 1, o.y + 4, 2, 4); // drool
  } else if (o.type === 'cat') {
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(o.x - 8, o.y - 14, 4, 6); ctx.fillRect(o.x + 4, o.y - 14, 4, 6);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(o.x - 4, o.y - 3, 3, 3); ctx.fillRect(o.x + 1, o.y - 3, 3, 3);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(o.x - 8, o.y - 1, 2, 2); // glowing 3rd eye
  } else if (o.type === 'mailbox') {
    const danger = o.fuse > 0;
    ctx.fillStyle = danger ? (Math.floor(o.fuse * 10) % 2 === 0 ? '#ff3a3a' : '#fff') : '#4cc9f0';
    ctx.fillRect(o.x - 12, o.y - 12, 24, 24);
    ctx.fillStyle = '#1a0d05'; ctx.fillRect(o.x - 8, o.y - 4, 16, 6);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(o.x + 8, o.y - 6, 4, 12);
  }
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
  const { isNewBest, current } = submitRun('delivery-pugs', { score: deliveries });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { score: deliveries };
    bestEl.innerHTML = `Best: <b>${b.score}</b> deliveries${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
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

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  keys.clear(); touchAim = null; invuln = 0; // wipe stuck inputs / invuln from prior match
  // Wipe stale delivery-feed lines from a previous match.
  try { __deliveryFeed.clear(); } catch (e) { /* */ }
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
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

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD drive · SHIFT boost · don\'t crash! INTACT% bar drains on hits — 100% intact = 1.5× payout', 7500);
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
