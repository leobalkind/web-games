// PUGZILLA RAMPAGE — top-down city destruction.
// Walk around city, click to smash buildings, vehicles flee, helicopters shoot
// missiles. Shockwave bork knocks back everything. Eat 5 vehicles to evolve.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { profileKey } from '../../src/shared/profile.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createKillFeed } from '../../src/shared/killFeed.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { showOrientationHint } from '../../src/shared/orientationHint.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';

// Scrolling kill feed (top-right) — pushed when buildings are destroyed.
const __pugzillaFeed = createKillFeed({ maxLines: 5, lifespan: 4500 });

// =============================================================================
// SKINS / FORMS — 8 visual variants the player picks on the start screen.
// Each has a tiny stat tweak (one perk per skin — keep balance simple).
// Unlocks are tracked persistently in localStorage (per profile).
// =============================================================================
const SKINS = [
  { id: 'classic', name: 'CLASSIC',  color: '#ff8e3c', ear: '#8a5a2c',
    unlock: { type: 'default' }, perk: null,
    desc: 'The original orange menace.' },
  { id: 'night',   name: 'NIGHT',    color: '#3a2a5a', ear: '#6b4a7a',
    unlock: { type: 'score',  value: 5000 }, perk: 'borkRadius+10',
    desc: '+10% bork radius' },
  { id: 'toxic',   name: 'TOXIC',    color: '#5ef38c', ear: '#3a8a3a',
    unlock: { type: 'score',  value: 10000 }, perk: 'eatRage+50',
    desc: '+50% rage on civilian eats' },
  { id: 'cyber',   name: 'CYBER',    color: '#4cc9f0', ear: '#2a6a8a',
    unlock: { type: 'score',  value: 20000 }, perk: 'missileResist-20',
    desc: 'Missiles deal 20% less damage' },
  { id: 'molten',  name: 'MOLTEN',   color: '#ff3a3a', ear: '#8a2a2a',
    unlock: { type: 'score',  value: 35000 }, perk: 'borkRadius+20',
    desc: '+20% bork radius' },
  { id: 'ghost',   name: 'GHOST',    color: '#cacad6', ear: '#9a9aa6',
    unlock: { type: 'score',  value: 50000 }, perk: 'phaseFirstMissile',
    desc: 'Translucent; ignores 1st missile per match' },
  { id: 'gold',    name: 'GOLD',     color: '#ffd23f', ear: '#c89c20',
    unlock: { type: 'rampage', value: 1 }, perk: 'civBonus+30',
    desc: 'Civilian eats give +30 score (was +20)' },
  { id: 'void',    name: 'VOID',     color: '#0a0716', ear: '#3a2a5a',
    unlock: { type: 'buildings', value: 100 }, perk: 'rage2x',
    desc: 'Gains rage 2× faster' },
];
const SKINS_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));

// Persistent skin state — stored per profile via profileKey().
const SKIN_STORE_KEY = 'pugzilla:skinState';
function _defaultSkinState() {
  return { chosen: 'classic', unlocked: ['classic'], rampagesEver: 0, buildingsEverSmashed: 0 };
}
function loadSkinState() {
  try {
    const raw = localStorage.getItem(profileKey(SKIN_STORE_KEY));
    if (!raw) return _defaultSkinState();
    const parsed = JSON.parse(raw);
    return {
      chosen: parsed.chosen || 'classic',
      unlocked: Array.isArray(parsed.unlocked) && parsed.unlocked.length ? parsed.unlocked : ['classic'],
      rampagesEver: parsed.rampagesEver || 0,
      buildingsEverSmashed: parsed.buildingsEverSmashed || 0,
    };
  } catch { return _defaultSkinState(); }
}
function saveSkinState() {
  try { localStorage.setItem(profileKey(SKIN_STORE_KEY), JSON.stringify(skinState)); } catch {}
}
let skinState = loadSkinState();
// Make sure chosen skin is actually unlocked (defensive)
if (!skinState.unlocked.includes(skinState.chosen)) skinState.chosen = 'classic';
function activeSkin() { return SKINS_BY_ID[skinState.chosen] || SKINS_BY_ID.classic; }

// Returns label for a skin's unlock condition (used on locked cards).
function unlockLabel(skin) {
  const u = skin.unlock;
  if (u.type === 'default') return '';
  if (u.type === 'score') return '$' + (u.value >= 1000 ? (u.value / 1000) + 'K' : u.value);
  if (u.type === 'rampage') return u.value + ' RAMPAGE';
  if (u.type === 'buildings') return u.value + ' BLDGS';
  return '???';
}

// Per-match flag for GHOST skin's "ignore 1st missile" perk.
let phaseUsed = false;
// Skins newly unlocked this match (shown as a toast on end overlay).
let _newSkinsThisMatch = [];

// Check unlock conditions vs current run stats; return array of newly unlocked skins.
function checkSkinUnlocks(runScore) {
  const newly = [];
  for (const s of SKINS) {
    if (skinState.unlocked.includes(s.id)) continue;
    const u = s.unlock;
    let ok = false;
    if (u.type === 'default') ok = true;
    else if (u.type === 'score') ok = runScore >= u.value;
    else if (u.type === 'rampage') ok = (skinState.rampagesEver || 0) >= u.value;
    else if (u.type === 'buildings') ok = (skinState.buildingsEverSmashed || 0) >= u.value;
    if (ok) { skinState.unlocked.push(s.id); newly.push(s); }
  }
  return newly;
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'pugzilla:muted' });
// Light arcade backing — keep SFX dominant, music at low intensity.
const music = createMusicTrack({ mood: 'arcade', tempo: 130, key: 'A', scale: 'minor' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'pugzilla', getControlsHelp: () => _isTouch
  ? 'JOYSTICK walk · TAP building to smash · BORK button = shockwave · 🛒 SHOP top-right. Saved to your profile.'
  : 'WASD walk · CLICK building to smash · SPACE = shockwave bork · 🛒 SHOP top-right (B). Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const WORLD_W = 2200, WORLD_H = 1600;
const FORMS = [
  { name: 'Tiny Pugzilla',   r: 28, smash: 1, color: '#c8854a' },
  { name: 'Chonk Pugzilla',  r: 40, smash: 2, color: '#eac888' },
  { name: 'Mega Pugzilla',   r: 56, smash: 3, color: '#ff8e3c' },
  { name: 'GIGA-BORK GOD',   r: 78, smash: 5, color: '#b055ff' },
];

let pug, buildings, vehicles, helicopters, missiles, particles, powerups, score, smashed, eaten, hp, formIdx, borkCd, cam, running;
let combo = 0, comboT = 0, dmgBoostT = 0;
// Combo-flash overlay (center-screen) — { tier, t, life }
let comboFlash = null;
function comboFlashPopup(tier) {
  comboFlash = { tier, t: 0, life: 1.1 };
}
let mouse = { x: 0, y: 0 };
// EVOLUTION SHOP — stackable per-run upgrades bought with score.
// Each stack of an upgrade multiplies its cost by 1.5.
const SHOP_DEFS = [
  { id: 'bigBork',     name: 'BIGGER BORK',  baseCost: 300, max: 3, icon: '📢', desc: 'Bork radius +25% per stack (max 3)' },
  { id: 'thickHide',   name: 'THICKER HIDE', baseCost: 250, max: 1, icon: '🛡️', desc: 'Take 30% less missile damage' },
  { id: 'appetite',    name: 'APPETITE',     baseCost: 200, max: 1, icon: '🍴', desc: '+50% rage on civilian eats' },
  { id: 'rampagePlus', name: 'RAMPAGE+',     baseCost: 500, max: 1, icon: '🔥', desc: 'RAMPAGE lasts 5s instead of 3s' },
];
let shopBuys = { bigBork: 0, thickHide: 0, appetite: 0, rampagePlus: 0 };
let shopOpen = false;
function shopCost(def) { return Math.round(def.baseCost * Math.pow(1.5, shopBuys[def.id] || 0)); }
// Map upgrades
let broadcastTower = null;     // {x, y, smashed, strobe}
let civilians = [];            // {x, y, vx, vy, scream, screamT, color}
let newsTicker = '';           // long scrolling string
let newsScroll = 0;
let towerHit = 0;              // pugzilla bumping the tower flash
// RAGE mechanic
let rage = 0;                  // 0..100
let rampageT = 0;              // active rampage countdown (3s)
// --- Juice ---
let shakeT = 0, shakeMag = 0;
// Hit-pause + evolution white-flash overlay timers.
let _zillaHitstopT = 0;
let _evoFlashT = 0;
let hitFlashT = 0;
let popups = []; // {x, y, text, color, t}
let smokeColumns = []; // ambient smoke pillars at smash sites: {x, y, t, life}
let craters = []; // permanent floor scars from smashed buildings
let distantChoppers = []; // far skyline helicopter silhouettes (decorative)
function addShake(mag, dur) { const k = _shakeMul(); shakeMag = Math.max(shakeMag, mag * k); shakeT = Math.max(shakeT, dur); }
function addPopup(x, y, text, color) {
  // Random angle + small horizontal drift so spam-popups don't pile up.
  const a = (Math.random() - 0.5) * 0.6;
  popups.push({
    x: x + Math.cos(a) * 6,
    y: y + (Math.random() - 0.5) * 4,
    vx: Math.sin(a) * 20,
    text, color: color || '#ffd23f', t: 0,
  });
  if (popups.length > 40) popups.shift();
}

// Building types — each with different score/effect + render style
const BUILDING_TYPES = {
  house:    { color: '#7a4a2a', val: 40,  hp: 1, label: '',   style: 'house' },
  office:   { color: '#3a3a52', val: 70,  hp: 3, label: '',   style: 'office' },
  office2:  { color: '#4a4a72', val: 80,  hp: 3, label: '',   style: 'office' },
  bank:     { color: '#5ef38c', val: 200, hp: 4, label: '$',  style: 'bank',     special: 'bank' },
  gas:      { color: '#ff8e3c', val: 80,  hp: 1, label: '⛽', style: 'gas',      special: 'gas' },
  hospital: { color: '#e0e0e8', val: 120, hp: 3, label: '+',  style: 'hospital' },
};

function reset() {
  formIdx = 0;
  pug = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0 };
  buildings = [];
  for (let i = 0; i < 80; i++) buildings.push(makeBuilding());
  vehicles = []; helicopters = []; missiles = []; particles = []; powerups = [];
  for (let i = 0; i < 18; i++) spawnVehicle();
  for (let i = 0; i < 3; i++) spawnHelicopter();
  score = 0; smashed = 0; eaten = 0; hp = 100; borkCd = 0;
  combo = 0; comboT = 0; dmgBoostT = 0; _comboTier = 0; comboFlash = null;
  cam = { x: pug.x, y: pug.y };
  shakeT = 0; shakeMag = 0; hitFlashT = 0; _zillaHitstopT = 0; _evoFlashT = 0;
  popups = []; smokeColumns = []; craters = [];
  // Distant skyline silhouette choppers (decorative — drift across horizon band)
  distantChoppers = [];
  for (let i = 0; i < 5; i++) {
    distantChoppers.push({
      x: Math.random() * WORLD_W,
      y: 30 + Math.random() * 110,
      vx: 30 + Math.random() * 40,
      blade: Math.random() * Math.PI,
    });
  }
  // GIANT TV BROADCAST TOWER landmark — fixed position
  broadcastTower = { x: 800, y: 700, smashed: false, strobe: 0 };
  // Clear any building too close to the tower
  buildings = buildings.filter((b) => Math.hypot(b.x + b.w / 2 - broadcastTower.x, b.y + b.h / 2 - broadcastTower.y) > 120);
  while (buildings.length < 80) buildings.push(makeBuilding());
  // Civilians — 1-2 per existing building
  civilians = [];
  for (const b of buildings) {
    if (Math.random() < 0.65) spawnCiviliansAt(b, 1 + (Math.random() < 0.5 ? 1 : 0));
  }
  // News ticker
  newsTicker = '';
  newsScroll = 0;
  // Rage
  rage = 0; rampageT = 0;
  towerHit = 0;
  // Shop buys reset per run
  shopBuys = { bigBork: 0, thickHide: 0, appetite: 0, rampagePlus: 0 };
  shopOpen = false;
  // Skin per-match state
  phaseUsed = false;
  _newSkinsThisMatch = [];
  renderShopChips();
}
function makeBuilding() {
  // 8% bank, 10% gas, 8% hospital, 25% small house, rest offices
  const r = Math.random();
  let typeId;
  if (r < 0.08) typeId = 'bank';
  else if (r < 0.18) typeId = 'gas';
  else if (r < 0.26) typeId = 'hospital';
  else if (r < 0.50) typeId = 'house';
  else typeId = Math.random() < 0.5 ? 'office' : 'office2';
  const t = BUILDING_TYPES[typeId];
  let w, h;
  if (typeId === 'house') { w = rand(46, 60); h = rand(46, 60); }
  else if (typeId === 'gas') { w = rand(50, 70); h = rand(40, 56); }
  else if (typeId === 'hospital') { w = rand(60, 80); h = rand(70, 100); }
  else { w = rand(40, 80); h = rand(70, 140); } // office, bank
  return {
    x: rand(40, WORLD_W - w - 20),
    y: rand(40, WORLD_H - h - 20),
    w, h,
    hp: t.hp,
    typeId,
    color: t.color,
    val: t.val,
    label: t.label,
    style: t.style,
    special: t.special,
  };
}

function spawnCiviliansAt(b, count) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    civilians.push({
      x: b.x + b.w / 2 + Math.cos(ang) * (b.w / 2 + 4),
      y: b.y + b.h / 2 + Math.sin(ang) * (b.h / 2 + 4),
      vx: 0, vy: 0,
      screamT: 0,
      color: ['#ff5050', '#5acaff', '#e0e0e8', '#ffd23f', '#ff8ec8'][Math.floor(Math.random() * 5)],
      ang: ang,
    });
  }
}
function spawnPowerup(x, y) {
  const types = ['heal', 'damage', 'rage'];
  const t = types[Math.floor(Math.random() * types.length)];
  powerups.push({ x, y, type: t, t: 0 });
}
function rand(a, b) { return a + Math.random() * (b - a); }
function spawnVehicle() {
  vehicles.push({
    x: rand(0, WORLD_W), y: rand(0, WORLD_H),
    vx: 0, vy: 0, fleeT: 0,
    color: ['#ff3a3a', '#ffd23f', '#4cc9f0', '#fff'][Math.floor(Math.random() * 4)],
  });
}
function spawnHelicopter() {
  const side = Math.random() < 0.5 ? -1 : 1;
  helicopters.push({
    x: side < 0 ? -40 : WORLD_W + 40,
    y: rand(80, WORLD_H - 80),
    vx: -side * 60,
    fireCd: 3,
    hp: 2,
  });
}
function form() { return FORMS[formIdx]; }

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if ((e.key === ' ' || e.code === 'Space') && !e.repeat) doBork();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
// Mobile controls — joystick + bork/shop buttons. The fire-tap is handled by
// the existing canvas touchstart->smashAt logic, so we don't need aim-fire.
createMobileControls({
  layout: 'wasd-only',
  keys,
  buttons: [
    { id: 'bork', label: 'BORK', key: 'Space' },
  ],
  getCanvas: () => canvas,
});
// Top-down sprawling city = much better in landscape on phones.
showOrientationHint({ gameId: 'pugzilla' });
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', () => {
  if (!running || shopOpen) return; // ignore taps while paused / shopping
  smashAt(mouse.x + cam.x - W / 2, mouse.y + cam.y - H / 2);
});
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY;
  if (!running || shopOpen) { e.preventDefault(); return; }
  smashAt(t.clientX + cam.x - W / 2, t.clientY + cam.y - H / 2);
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
document.getElementById('bork-btn').addEventListener('click', doBork);
if ('ontouchstart' in window) document.getElementById('bork-btn').style.display = 'block';

function smashAt(wx, wy) {
  // SMASH BROADCAST TOWER (giant landmark) — within reach, gives big bonus
  if (broadcastTower && !broadcastTower.smashed) {
    const dxT = wx - broadcastTower.x, dyT = wy - (broadcastTower.y - 40);
    if (Math.abs(dxT) < 40 && Math.abs(dyT) < 80 &&
        Math.hypot(broadcastTower.x - pug.x, broadcastTower.y - pug.y) < form().r + 140) {
      broadcastTower.smashed = true;
      towerHit = 0.6;
      score += 500;
      addPopup(broadcastTower.x, broadcastTower.y - 80, 'NEWS SILENCED · +$500', '#ff3a3a');
      addShake(8, 0.45);
      sfx.sweep(440, 80, 'sawtooth', 0.6, 0.35);
      for (let i = 0; i < 28; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 100 + Math.random() * 180;
        particles.push({ x: broadcastTower.x, y: broadcastTower.y - 40, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: '#aaa', life: 1.0, t: 0, size: 4 });
      }
      particles.push({ ring: true, x: broadcastTower.x, y: broadcastTower.y - 30, t: 0, maxR: 260 });
      smokeColumns.push({ x: broadcastTower.x, y: broadcastTower.y - 20, t: 0, life: 6, mag: 120 });
      addRage(25);
      bumpCombo();
      return;
    }
  }
  // Civilians — eat a tiny humanoid: +20
  for (let i = civilians.length - 1; i >= 0; i--) {
    const c = civilians[i];
    if (Math.hypot(c.x - pug.x, c.y - pug.y) < form().r + 8 && Math.hypot(c.x - wx, c.y - wy) < 24) {
      civilians.splice(i, 1);
      // GOLD skin: civilian eats give +30 score (was +20)
      const _sk = activeSkin();
      const gain = _sk.perk === 'civBonus+30' ? 30 : 20;
      score += gain;
      sfx.tone(720, 'triangle', 0.06, 0.18);
      addPopup(c.x, c.y - 8, '+' + gain + ' NOM', _sk.perk === 'civBonus+30' ? '#ffd23f' : '#ff8ec8');
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 80;
        particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: '#ff5050', life: 0.5, t: 0, size: 3 });
      }
      // APPETITE shop upgrade: +50% rage on civilian eats
      // TOXIC skin: also +50% rage on civilian eats (stacks additively — both = +100%)
      let civRage = 4;
      if (shopBuys.appetite) civRage += 2;          // +50% of base
      if (_sk.perk === 'eatRage+50') civRage += 2;  // +50% of base
      addRage(civRage);
      return;
    }
  }
  // Smash building under reach (within pug.r + 80)
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (wx > b.x && wx < b.x + b.w && wy > b.y && wy < b.y + b.h) {
      if (Math.hypot(b.x + b.w / 2 - pug.x, b.y + b.h / 2 - pug.y) > form().r + 100) continue;
      b.hp -= form().smash * (dmgBoostT > 0 ? 2.5 : 1);
      sfx.tone(120 + Math.random() * 60, 'sawtooth', 0.1, 0.22);
      if (b.hp <= 0) {
        smashBuilding(b, i);
      }
      return;
    }
  }
  // Eat vehicle under reach
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (Math.hypot(v.x - pug.x, v.y - pug.y) < form().r + 16 && Math.hypot(v.x - wx, v.y - wy) < 30) {
      vehicles.splice(i, 1);
      eaten++; score += 30;
      sfx.tone(660, 'triangle', 0.1, 0.22);
      addPopup(v.x, v.y - 8, '+30 🍴', '#ffd23f');
      addShake(2, 0.1);
      addRage(6);
      if (eaten >= 5 && formIdx < FORMS.length - 1) {
        formIdx++; eaten = 0;
        hp = Math.min(100 + formIdx * 50, hp + 80);
        sfx.arp([523, 659, 784, 1047], 'triangle', 0.1, 0.25, 0.3);
        // Bigger shake + brief hit-pause + white-screen flash.
        addShake(16, 0.55);
        _zillaHitstopT = 0.12;
        _evoFlashT = 0.35;
        addPopup(pug.x, pug.y - form().r - 12, 'EVOLVE! ' + form().name.toUpperCase(), '#b055ff');
        // Triple expanding ring (rainbow) + chunky sparkle field.
        particles.push({ ring: true, x: pug.x, y: pug.y, t: 0, maxR: 220 });
        particles.push({ ring: true, x: pug.x, y: pug.y, t: -0.1, maxR: 160 });
        particles.push({ ring: true, x: pug.x, y: pug.y, t: -0.2, maxR: 280 });
        const rainbow = ['#ff3aa1', '#4cc9f0', '#ffd23f', '#5ef38c', '#b055ff', '#ffffff'];
        for (let k = 0; k < 28; k++) {
          const a = (k / 28) * Math.PI * 2;
          const s = 150 + Math.random() * 180;
          particles.push({
            x: pug.x, y: pug.y,
            vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
            color: rainbow[k % rainbow.length], life: 0.9, t: 0, size: 5, gravity: 180,
          });
        }
        // Sub-bass boom layer.
        sfx.tone(55, 'sine', 0.35, 0.55);
      }
      spawnVehicle();
      return;
    }
  }
}
function spawnReplacementBuilding() {
  buildings.push(makeBuilding());
}

function doBork() {
  if (!running || shopOpen || borkCd > 0) return;
  borkCd = 4;
  sfx.sweep(220, 80, 'sawtooth', 0.5, 0.3);
  addShake(8, 0.32);
  // Shockwave: push everything outward + damage helicopters; rage = +50% radius
  const rageRadiusBoost = (rage >= 80 || rampageT > 0) ? 1.5 : 1;
  // BIGGER BORK shop upgrade: +25% per stack
  const shopRadiusBoost = 1 + (shopBuys.bigBork || 0) * 0.25;
  // SKIN perks: Night +10% bork radius, Molten +20% bork radius
  const sk = activeSkin();
  const skinRadiusBoost = sk.perk === 'borkRadius+10' ? 1.1 : (sk.perk === 'borkRadius+20' ? 1.2 : 1);
  const reach = (form().r + 250) * rageRadiusBoost * shopRadiusBoost * skinRadiusBoost;
  for (const v of vehicles) {
    const dx = v.x - pug.x, dy = v.y - pug.y;
    const d = Math.hypot(dx, dy);
    if (d < reach && d > 0) {
      v.vx += (dx / d) * 400;
      v.vy += (dy / d) * 400;
      v.fleeT = 2;
    }
  }
  for (let i = helicopters.length - 1; i >= 0; i--) {
    const h = helicopters[i];
    const d = Math.hypot(h.x - pug.x, h.y - pug.y);
    if (d < reach) {
      h.hp -= 2;
      h.x += (h.x - pug.x) / d * 100;
      if (h.hp <= 0) {
        score += 200;
        // Bigger explosion: dual orange/red dust + expanding ring + shake spike.
        spawnDust(h.x, h.y, '#ff8e3c');
        spawnDust(h.x, h.y, '#ff3a3a');
        particles.push({ ring: true, x: h.x, y: h.y, t: 0, maxR: 110 });
        addShake(7, 0.32);
        sfx.tone(80, 'sawtooth', 0.25, 0.4);
        addPopup(h.x, h.y - 8, '+$200', '#ff8e3c');
        helicopters.splice(i, 1);
      }
    }
  }
  // damage buildings caught
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (Math.hypot(cx - pug.x, cy - pug.y) < reach) {
      b.hp -= 1;
      if (b.hp <= 0) {
        score += 30; smashed++;
        spawnDust(cx, cy, b.color);
        try { __pugzillaFeed.push(`BORK CRUSH · ${(b.typeId || 'BUILDING').toUpperCase()} +$30`, '#b055ff'); } catch (e) { /* */ }
        buildings.splice(i, 1);
      }
    }
  }
  particles.push({ ring: true, x: pug.x, y: pug.y, t: 0, maxR: reach });
}
// Rampage-arcade-style combo chain. 3+ smashes within COMBO_WINDOW seconds
// fires a big center-screen popup, extra screen shake, and a bright bell SFX
// — and the per-smash score multiplier ramps to x2 / x3 / x4 / x5.
const COMBO_WINDOW = 2.0;
let _comboTier = 0; // last tier that fired a popup so we don't double-pop
function bumpCombo() {
  if (comboT > 0) combo++;
  else { combo = 1; _comboTier = 0; }
  comboT = COMBO_WINDOW;
  // Tier check — combo=3 → x2 popup (tier=2), combo=4 → x3 (tier=3), etc.
  const tier = comboMult();
  if (combo >= 3 && tier > _comboTier) {
    _comboTier = tier;
    // Center-screen flash popup
    if (typeof comboFlashPopup === 'function') comboFlashPopup(tier);
    // Screen-shake spike (bigger at higher tiers)
    addShake(6 + tier * 2, 0.28);
    // Bright bell tone — ascending triad scaled with tier
    const base = 740 + tier * 80;
    try {
      sfx.arp([base, base * 1.25, base * 1.5, base * 2], 'triangle', 0.045, 0.22, 0.18);
    } catch (e) { /* */ }
    // Push a kill-feed line so the side ticker also shows the combo
    try { __pugzillaFeed.push(`WAHOO! COMBO ×${tier}`, '#ff3aa1'); } catch (e) { /* */ }
  }
}
// Multiplier ramp: combo=1 → 1.0, combo=2 → 1.0, combo=3 → 2.0,
// combo=4 → 3.0, combo=5+ → 4.0 (cap at 5x just like the brief's x2/x3/x4).
function comboMult() {
  if (combo < 3) return 1;
  return Math.min(5, combo - 1);
}

function smashBuilding(b, idx) {
  bumpCombo();
  const mult = comboMult();
  const gain = Math.floor(b.val * mult);
  score += gain;
  smashed++;
  // Lifetime smashed count (for VOID skin unlock).
  skinState.buildingsEverSmashed = (skinState.buildingsEverSmashed || 0) + 1;
  try {
    const name = (b.typeId || 'BUILDING').toUpperCase();
    const tag = combo > 1 ? ` x${combo}` : '';
    const color = combo > 2 ? '#ff3aa1' : combo > 1 ? '#ffd23f' : '#5ef38c';
    __pugzillaFeed.push(`SMASHED · ${name} +$${gain}${tag}`, color);
  } catch (e) { /* */ }
  addRage(b.special ? 14 : 8);
  // Civilians inside this building scatter on death
  for (const c of civilians) {
    if (c.x > b.x - 30 && c.x < b.x + b.w + 30 && c.y > b.y - 30 && c.y < b.y + b.h + 30) {
      const a = Math.atan2(c.y - (b.y + b.h / 2), c.x - (b.x + b.w / 2));
      c.vx += Math.cos(a) * 180;
      c.vy += Math.sin(a) * 180;
      c.screamT = 1.2;
    }
  }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  spawnDust(cx, cy, b.color);
  addPopup(cx, cy - b.h / 2, '+' + gain, b.special === 'bank' ? '#5ef38c' : (b.special === 'gas' ? '#ff8e3c' : '#ffd23f'));
  addShake(b.special ? 6 : 4, b.special ? 0.28 : 0.18);
  smokeColumns.push({ x: cx, y: cy, t: 0, life: 4, mag: b.h });
  if (smokeColumns.length > 30) smokeColumns.shift();
  craters.push({ x: cx, y: cy, r: Math.max(b.w, b.h) * 0.45 });
  if (craters.length > 120) craters.shift();
  buildings.splice(idx, 1);
  // Special effects
  if (b.special === 'bank') {
    // Coin burst — extra particles + score boost
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 160;
      particles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: '#ffd23f', life: 1.2, t: 0, size: 5 });
    }
    sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.07, 0.25, 0.25);
    if (Math.random() < 0.5) spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
  } else if (b.special === 'gas') {
    // Chain explosion — radius 120
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    sfx.sweep(440, 110, 'sawtooth', 0.4, 0.3);
    particles.push({ ring: true, x: cx, y: cy, t: 0, maxR: 140 });
    for (let j = buildings.length - 1; j >= 0; j--) {
      const o = buildings[j];
      const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
      if (Math.hypot(ocx - cx, ocy - cy) < 140) {
        o.hp -= 2;
        if (o.hp <= 0) smashBuilding(o, j);
      }
    }
    // also damages vehicles & helicopters
    for (let j = helicopters.length - 1; j >= 0; j--) {
      const h = helicopters[j];
      if (Math.hypot(h.x - cx, h.y - cy) < 140) {
        h.hp -= 3;
        if (h.hp <= 0) {
          score += 200;
          spawnDust(h.x, h.y, '#ff8e3c');
          particles.push({ ring: true, x: h.x, y: h.y, t: 0, maxR: 90 });
          addShake(5, 0.22);
          helicopters.splice(j, 1);
        }
      }
    }
    // 30% spawn powerup
    if (Math.random() < 0.3) spawnPowerup(cx, cy);
  } else {
    if (Math.random() < 0.08) spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
  }
  if (Math.random() < 0.2 && buildings.length < 100) spawnReplacementBuilding();
}

function addRage(amount) {
  if (rampageT > 0) return; // locked during rampage
  // VOID skin: gains rage 2× faster
  const sk = activeSkin();
  if (sk.perk === 'rage2x') amount *= 2;
  rage = Math.min(100, rage + amount);
  if (rage >= 100) {
    // RAMPAGE+ shop upgrade: 5s instead of 3s
    rampageT = shopBuys.rampagePlus ? 5.0 : 3.0;
    addShake(12, 0.5);
    addPopup(pug.x, pug.y - form().r - 20, 'RAMPAGE!!!', '#ff3a3a');
    sfx.arp([220, 330, 110], 'sawtooth', 0.2, 0.4, 0.6);
    // Track lifetime rampages for skin unlocks.
    skinState.rampagesEver = (skinState.rampagesEver || 0) + 1;
  }
}

function spawnDust(x, y, color) {
  // Bumped from 12 → 18 sparks + 6 large chunky debris with gravity so smashed
  // buildings throw real debris (not just colored dots).
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 70 + Math.random() * 170;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, color, life: 0.75, t: 0, size: 4, gravity: 320 });
  }
  // Big debris chunks — alternate building color + dark gray for variety.
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 100 + Math.random() * 180;
    const c = i % 2 === 0 ? color : '#3a3a48';
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 70, color: c, life: 1.0, t: 0, size: 7, gravity: 380 });
  }
  // Soft gray smoke puffs floating up.
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    particles.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 8, vx: Math.cos(a) * 25, vy: -40 - Math.random() * 20, color: '#aaaab8', life: 0.9, t: 0, size: 6 });
  }
}

function drawBuilding(b) {
  const x = b.x, y = b.y, w = b.w, h = b.h;
  // Building base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 2, y + h, w + 4, 4);
  switch (b.style) {
    case 'house': {
      // walls
      ctx.fillStyle = b.color; ctx.fillRect(x, y + 8, w, h - 8);
      // roof (triangle as two rects approximation)
      ctx.fillStyle = '#3a2010';
      for (let i = 0; i < w / 2; i++) {
        const hh = Math.floor((i / (w / 2)) * 12);
        ctx.fillRect(x + i, y + 10 - hh, 2, hh + 1);
        ctx.fillRect(x + w - i - 2, y + 10 - hh, 2, hh + 1);
      }
      // chimney
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(x + w - 14, y - 4, 6, 12);
      ctx.fillStyle = '#222'; ctx.fillRect(x + w - 14, y - 4, 6, 2);
      // smoke from chimney
      ctx.fillStyle = 'rgba(180,180,180,0.45)';
      ctx.beginPath(); ctx.arc(x + w - 11, y - 10, 4, 0, Math.PI * 2); ctx.fill();
      // door
      ctx.fillStyle = '#3a2010'; ctx.fillRect(x + w / 2 - 5, y + h - 14, 10, 14);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + w / 2 + 2, y + h - 8, 2, 2);
      // windows
      ctx.fillStyle = '#a0d8ff';
      ctx.fillRect(x + 6, y + 18, 8, 8); ctx.fillRect(x + w - 14, y + 18, 8, 8);
      ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 10, y + 18); ctx.lineTo(x + 10, y + 26); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 6, y + 22); ctx.lineTo(x + 14, y + 22); ctx.stroke();
      break;
    }
    case 'office': {
      ctx.fillStyle = b.color; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + h - 6, w, 6);
      // window grid (more even / dense)
      for (let yy = 6; yy < h - 10; yy += 10) {
        for (let xx = 4; xx < w - 6; xx += 8) {
          const lit = ((xx * 11 + yy * 7 + b.hp * 13) % 5) > 1;
          ctx.fillStyle = lit ? 'rgba(255,210,63,0.7)' : 'rgba(40,40,60,0.6)';
          ctx.fillRect(x + xx, y + yy, 4, 6);
        }
      }
      // antenna
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x + w / 2 - 1, y - 8, 2, 8);
      ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + w / 2 - 1, y - 9, 2, 2);
      break;
    }
    case 'bank': {
      ctx.fillStyle = b.color; ctx.fillRect(x, y, w, h);
      // columns (pixel pillars)
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        const cx = x + 4 + (i * (w - 8)) / 3;
        ctx.fillRect(cx, y + 10, 4, h - 18);
      }
      // entablature
      ctx.fillStyle = '#5a8a5a'; ctx.fillRect(x, y + 4, w, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y + h - 6, w, 6);
      // big $ label
      ctx.fillStyle = '#1a1a1a';
      ctx.font = "bold 18px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('$', x + w / 2, y + 22);
      ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      break;
    }
    case 'gas': {
      // canopy
      ctx.fillStyle = b.color; ctx.fillRect(x, y, w, 8);
      // posts
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(x + 2, y + 8, 4, h - 8);
      ctx.fillRect(x + w - 6, y + 8, 4, h - 8);
      // pump
      ctx.fillStyle = '#c8c8d8'; ctx.fillRect(x + w / 2 - 6, y + h - 26, 12, 22);
      ctx.fillStyle = '#1a0d05'; ctx.fillRect(x + w / 2 - 4, y + h - 22, 8, 4);
      ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + w / 2 - 1, y + h - 26, 2, 2);
      // little floor pad
      ctx.fillStyle = '#3a3a52'; ctx.fillRect(x + 6, y + h - 4, w - 12, 4);
      // pulsing ⛽ marker
      ctx.strokeStyle = '#ff8e3c'; ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = "bold 12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('GAS', x + w / 2, y + 6);
      break;
    }
    case 'hospital': {
      ctx.fillStyle = b.color; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y + h - 6, w, 6);
      // big red cross sign at top
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(x + w / 2 - 8, y + 6, 16, 4);
      ctx.fillRect(x + w / 2 - 2, y, 4, 16);
      // window grid
      for (let yy = 22; yy < h - 12; yy += 12) {
        for (let xx = 4; xx < w - 6; xx += 10) {
          ctx.fillStyle = ((xx * 7 + yy * 5) % 3 === 0) ? 'rgba(150,210,255,0.7)' : 'rgba(60,80,100,0.6)';
          ctx.fillRect(x + xx, y + yy, 5, 8);
        }
      }
      // entrance
      ctx.fillStyle = '#5a5a72'; ctx.fillRect(x + w / 2 - 6, y + h - 12, 12, 12);
      ctx.fillStyle = '#ff3a3a'; ctx.fillRect(x + w / 2 - 1, y + h - 6, 2, 4);
      break;
    }
    default: {
      ctx.fillStyle = b.color; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - 6, w, 6);
    }
  }
  // Cracks if damaged (hp < initial)
  if (b.hp < (BUILDING_TYPES[b.typeId]?.hp || 2)) {
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 6, y + h - 8);
    ctx.stroke();
  }
}

function drawCivilians() {
  for (const c of civilians) {
    // body
    ctx.fillStyle = c.color; ctx.fillRect(c.x - 2, c.y - 4, 4, 6);
    // head
    ctx.fillStyle = '#e0c89a'; ctx.fillRect(c.x - 2, c.y - 8, 4, 4);
    // panic arms (waving)
    const wave = Math.sin(performance.now() / 100 + c.x) > 0;
    ctx.fillStyle = '#e0c89a';
    if (wave) {
      ctx.fillRect(c.x - 4, c.y - 6, 2, 2); ctx.fillRect(c.x + 2, c.y - 6, 2, 2);
    } else {
      ctx.fillRect(c.x - 4, c.y - 4, 2, 2); ctx.fillRect(c.x + 2, c.y - 4, 2, 2);
    }
    // legs (alternating)
    const step = (Math.floor(performance.now() / 100 + c.x) % 2 === 0);
    ctx.fillStyle = '#1a1a22';
    if (step) {
      ctx.fillRect(c.x - 2, c.y + 2, 2, 3); ctx.fillRect(c.x + 1, c.y + 2, 2, 2);
    } else {
      ctx.fillRect(c.x - 2, c.y + 2, 2, 2); ctx.fillRect(c.x + 1, c.y + 2, 2, 3);
    }
  }
}

function drawBroadcastTower() {
  if (!broadcastTower) return;
  const tx = broadcastTower.x, by = broadcastTower.y;
  if (broadcastTower.smashed) {
    // Toppled pylon — single fallen rect
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(tx - 50, by - 14, 100, 12);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(tx - 50, by - 4, 100, 2);
    // smoke
    ctx.fillStyle = 'rgba(80,80,80,0.55)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(tx + (i - 2) * 14, by - 22 - Math.sin(performance.now() / 600 + i) * 4, 8 + i * 2, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  // Base plate
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(tx, by + 4, 38, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(tx - 28, by - 4, 56, 8);
  // Pylon: tapering struts upward (90px tall)
  ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
  const towerHeight = 90;
  // outer slanted struts
  ctx.beginPath(); ctx.moveTo(tx - 22, by - 4); ctx.lineTo(tx - 6, by - towerHeight); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tx + 22, by - 4); ctx.lineTo(tx + 6, by - towerHeight); ctx.stroke();
  // crossbars (X pattern)
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const y1 = by - 4 - t * (towerHeight - 4);
    const lx = -22 + t * 16;
    const rx =  22 - t * 16;
    ctx.beginPath(); ctx.moveTo(tx + lx, y1); ctx.lineTo(tx + rx, y1); ctx.stroke();
    if (i < 5) {
      const t2 = (i + 0.5) / 6;
      const y2 = by - 4 - t2 * (towerHeight - 4);
      const lx2 = -22 + t2 * 16, rx2 = 22 - t2 * 16;
      ctx.beginPath();
      ctx.moveTo(tx + lx, y1); ctx.lineTo(tx + rx2, y2);
      ctx.moveTo(tx + rx, y1); ctx.lineTo(tx + lx2, y2);
      ctx.stroke();
    }
  }
  // Broadcast dish (offset to one side)
  ctx.fillStyle = '#c8c8d8';
  ctx.beginPath(); ctx.arc(tx + 10, by - towerHeight + 12, 8, Math.PI * 0.2, Math.PI * 1.2); ctx.fill();
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(tx + 6, by - towerHeight + 14, 2, 8);
  // Top platform
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(tx - 8, by - towerHeight - 4, 16, 4);
  // Red strobe (top)
  const strobePulse = (Math.sin(broadcastTower.strobe * Math.PI * 2 / 1.6) > 0);
  ctx.fillStyle = strobePulse ? '#ff3a3a' : '#5a1a1a';
  ctx.fillRect(tx - 3, by - towerHeight - 8, 6, 6);
  if (strobePulse) {
    const grd = ctx.createRadialGradient(tx, by - towerHeight - 5, 2, tx, by - towerHeight - 5, 38);
    grd.addColorStop(0, 'rgba(255,58,58,0.5)');
    grd.addColorStop(1, 'rgba(255,58,58,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(tx, by - towerHeight - 5, 38, 0, Math.PI * 2); ctx.fill();
  }
  // Sign at base
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(tx - 32, by + 6, 64, 12);
  ctx.fillStyle = '#ffd23f';
  ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('NEWS', tx, by + 14);
  // Hit flash overlay on tower
  if (towerHit > 0) {
    ctx.fillStyle = `rgba(255,255,255,${towerHit})`;
    ctx.fillRect(tx - 30, by - towerHeight - 10, 60, towerHeight + 16);
  }
}

function tick(dt) {
  if (!running) return;
  if (shopOpen) return; // pause world while shopping
  // Tick the evolution white-flash overlay (independent of hit-pause).
  if (_evoFlashT > 0) _evoFlashT = Math.max(0, _evoFlashT - dt);
  // Hit-pause — freeze world for a few frames after evolve / big event.
  if (_zillaHitstopT > 0) { _zillaHitstopT -= dt; return; }
  borkCd = Math.max(0, borkCd - dt);
  comboT = Math.max(0, comboT - dt);
  if (comboT <= 0) { combo = 0; _comboTier = 0; }
  // Tick the center-screen combo-flash overlay
  if (comboFlash) {
    comboFlash.t += dt;
    if (comboFlash.t >= comboFlash.life) comboFlash = null;
  }
  dmgBoostT = Math.max(0, dmgBoostT - dt);
  // Rage decay (idle 5/sec) — only when not actively rampaging
  if (rampageT > 0) {
    rampageT -= dt;
    if (rampageT <= 0) { rage = 0; rampageT = 0; }
  } else {
    rage = Math.max(0, rage - dt * 5);
  }
  // Tower strobe pulse
  if (broadcastTower) {
    broadcastTower.strobe = (broadcastTower.strobe + dt) % 1.6;
  }
  if (towerHit > 0) towerHit -= dt;
  // News ticker scroll
  newsScroll += dt * 60;
  // Powerup pickup
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.t += dt;
    if (p.t > 12) { powerups.splice(i, 1); continue; }
    if (Math.hypot(p.x - pug.x, p.y - pug.y) < form().r + 16) {
      if (p.type === 'heal') { hp = Math.min(100 + formIdx * 50, hp + 40); sfx.tone(880, 'triangle', 0.12, 0.22); }
      else if (p.type === 'damage') { dmgBoostT = 8; sfx.arp([523, 880, 1320], 'square', 0.06, 0.22, 0.18); }
      else if (p.type === 'rage') { borkCd = 0; eaten = Math.min(4, eaten + 2); sfx.tone(440, 'sawtooth', 0.3, 0.25); }
      powerups.splice(i, 1);
    }
  }
  // Move pug — smooth blend to target velocity (acceleration ramp from rest)
  // so bigger pug forms feel heavier and starting/stopping has weight.
  let mx = 0, my = 0;
  if (keys.has('w')) my -= 1;
  if (keys.has('s')) my += 1;
  if (keys.has('a')) mx -= 1;
  if (keys.has('d')) mx += 1;
  const rageBoost = (rage >= 80 || rampageT > 0) ? 1.3 : 1;
  const speed = (220 - formIdx * 25) * rageBoost;
  let tvx = 0, tvy = 0;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    tvx = (mx / l) * speed;
    tvy = (my / l) * speed;
  }
  // Smaller formIdx (lighter pug) = snappier accel; bigger forms ramp slower.
  const accel = 9 - formIdx * 1.2;
  const blend = Math.min(1, Math.max(3, accel) * dt);
  pug.vx += (tvx - pug.vx) * blend;
  pug.vy += (tvy - pug.vy) * blend;
  pug.x += pug.vx * dt; pug.y += pug.vy * dt;
  pug.x = Math.max(form().r, Math.min(WORLD_W - form().r, pug.x));
  pug.y = Math.max(form().r, Math.min(WORLD_H - form().r, pug.y));
  cam.x += (pug.x - cam.x) * 5 * dt;
  cam.y += (pug.y - cam.y) * 5 * dt;

  // Vehicles flee from pug
  for (const v of vehicles) {
    if (v.fleeT > 0) v.fleeT -= dt;
    const dx = pug.x - v.x, dy = pug.y - v.y;
    const d = Math.hypot(dx, dy);
    if (d < 300) {
      v.vx -= (dx / d) * 200 * dt;
      v.vy -= (dy / d) * 200 * dt;
    }
    v.vx *= Math.pow(0.5, dt * 2); v.vy *= Math.pow(0.5, dt * 2);
    v.x += v.vx * dt; v.y += v.vy * dt;
    v.x = Math.max(20, Math.min(WORLD_W - 20, v.x));
    v.y = Math.max(20, Math.min(WORLD_H - 20, v.y));
  }
  // Civilians — flee from pug, scream particles
  for (const c of civilians) {
    const dx = c.x - pug.x, dy = c.y - pug.y;
    const d = Math.hypot(dx, dy);
    if (d < 280 && d > 0) {
      c.vx += (dx / d) * 80 * dt;
      c.vy += (dy / d) * 80 * dt;
    }
    c.vx *= Math.pow(0.5, dt * 1.5);
    c.vy *= Math.pow(0.5, dt * 1.5);
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.x = Math.max(20, Math.min(WORLD_W - 20, c.x));
    c.y = Math.max(20, Math.min(WORLD_H - 20, c.y));
    if (c.screamT > 0) c.screamT -= dt;
    // Spawn occasional AAAA scream particle
    if (d < 200 && Math.random() < dt * 1.6) {
      particles.push({ x: c.x, y: c.y - 8, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, color: '#fff', life: 0.9, t: 0, size: 3, scream: true });
    }
  }
  // Helicopters
  for (const h of helicopters) {
    h.x += h.vx * dt;
    h.fireCd -= dt;
    if (h.fireCd <= 0) {
      h.fireCd = 2.2 + Math.random() * 0.7;
      const dx = pug.x - h.x, dy = pug.y - h.y;
      const d = Math.hypot(dx, dy);
      missiles.push({ x: h.x, y: h.y, vx: (dx / d) * 200, vy: (dy / d) * 200, life: 5 });
      sfx.tone(440, 'square', 0.06, 0.18);
    }
    if (h.x < -60 || h.x > WORLD_W + 60) h.vx = -h.vx;
  }
  // Spawn new helicopters periodically
  if (Math.random() < dt * 0.08 && helicopters.length < 6) spawnHelicopter();
  if (vehicles.length < 12) spawnVehicle();

  // Missiles
  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt;
    if (m.life <= 0) { missiles.splice(i, 1); continue; }
    if (Math.hypot(m.x - pug.x, m.y - pug.y) < form().r) {
      // GHOST skin: phase through the first missile of the match (no damage).
      const _activeSk = activeSkin();
      if (_activeSk.perk === 'phaseFirstMissile' && !phaseUsed) {
        phaseUsed = true;
        missiles.splice(i, 1);
        sfx.tone(880, 'sine', 0.12, 0.18);
        addPopup(pug.x, pug.y - form().r - 4, 'PHASED!', '#cacad6');
        continue;
      }
      const rageDmgCut = (rage >= 80 || rampageT > 0) ? 0.5 : 1;
      const hideCut = shopBuys.thickHide ? 0.7 : 1;
      // CYBER skin: missiles deal 20% less damage
      const skinCut = _activeSk.perk === 'missileResist-20' ? 0.8 : 1;
      const dmg = Math.round(12 * rageDmgCut * hideCut * skinCut);
      hp -= dmg;
      missiles.splice(i, 1);
      sfx.tone(180, 'square', 0.1, 0.22);
      addShake(5, 0.22);
      hitFlashT = 0.18;
      addPopup(pug.x, pug.y - form().r - 4, '-' + dmg + ' HP', '#ff5a5a');
      if (hp <= 0) return end();
    }
  }
  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (p.ring) {
      if (p.t > 0.5) particles.splice(i, 1);
    } else {
      // Gravity (debris chunks have it) gives them a satisfying arc-and-fall.
      if (p.gravity) p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // Less friction when gravity dominates so the arc reads.
      const fr = p.gravity ? 0.985 : 0.94;
      p.vx *= fr;
      if (!p.gravity) p.vy *= fr;
      if (p.t >= p.life) particles.splice(i, 1);
    }
  }
  // Cap particles to avoid runaway pyrotechnics from chained explosions.
  if (particles.length > 250) particles.splice(0, particles.length - 250);
  // Juice tick
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  if (hitFlashT > 0) hitFlashT = Math.max(0, hitFlashT - dt);
  // Perf: prune popups in-place via reverse-iter splice.
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.t += dt; p.y -= 32 * dt;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 1 - dt * 2; }
    if (p.t >= 1.2) popups.splice(i, 1);
  }
  if (popups.length > 30) popups.splice(0, popups.length - 30);
  for (let i = smokeColumns.length - 1; i >= 0; i--) {
    const s = smokeColumns[i]; s.t += dt;
    if (s.t >= s.life) smokeColumns.splice(i, 1);
  }
  // Distant choppers drift
  for (const d of distantChoppers) {
    d.x += d.vx * dt;
    d.blade += dt * 18;
    if (d.x > WORLD_W + 60) { d.x = -60; d.y = 30 + Math.random() * 110; }
  }
  updateHud();
}

function render() {
  // Sky gradient (screen space, painted first)
  const skyGrd = ctx.createLinearGradient(0, 0, 0, H);
  skyGrd.addColorStop(0, '#3a1a4a');
  skyGrd.addColorStop(0.5, '#52223a');
  skyGrd.addColorStop(1, '#22103f');
  ctx.fillStyle = skyGrd; ctx.fillRect(0, 0, W, H);
  // Distant low-parallax skyline band (screen space, before world)
  const horizonY = H * 0.22;
  ctx.fillStyle = 'rgba(20,8,30,0.7)';
  // Pseudo-random skyline silhouettes (parallax: shift by cam.x * 0.1)
  const px = (cam.x * 0.12) % 80;
  for (let i = -2; i < Math.floor(W / 30) + 2; i++) {
    const seed = ((i + 100) * 37) % 100;
    const bh = 30 + (seed % 60);
    const bw = 16 + (seed % 14);
    ctx.fillRect(i * 30 - px, horizonY - bh, bw, bh + 4);
    // tiny windows
    ctx.fillStyle = 'rgba(255,210,63,0.4)';
    for (let yy = 4; yy < bh - 4; yy += 8) {
      if ((yy + seed) % 16 === 0) ctx.fillRect(i * 30 - px + 4, horizonY - bh + yy, 2, 3);
    }
    ctx.fillStyle = 'rgba(20,8,30,0.7)';
  }
  // Distant choppers (parallax silhouette)
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (const d of distantChoppers) {
    const sx = ((d.x - cam.x * 0.3) % (WORLD_W + 120) + (WORLD_W + 120)) % (WORLD_W + 120) - 60;
    const sy = d.y;
    if (sx < -60 || sx > W + 60) continue;
    ctx.fillRect(sx - 6, sy - 2, 12, 4);
    // blade
    const bx = Math.cos(d.blade) * 10;
    ctx.fillRect(sx - bx, sy - 4, bx * 2 || 1, 1);
  }
  // Now world-space render with shake offset
  let _sx = 0, _sy = 0;
  if (shakeT > 0 && shakeMag > 0) {
    const k = Math.min(1, shakeT / 0.3);
    _sx = (Math.random() - 0.5) * shakeMag * 2 * k;
    _sy = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  ctx.save();
  ctx.translate(W / 2 - cam.x + _sx, H / 2 - cam.y + _sy);
  // Ground / streets
  ctx.fillStyle = '#3a2a5a'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // Wide road bands
  ctx.fillStyle = '#221836';
  for (let x = 80; x < WORLD_W; x += 220) ctx.fillRect(x - 22, 0, 44, WORLD_H);
  for (let y = 80; y < WORLD_H; y += 220) ctx.fillRect(0, y - 22, WORLD_W, 44);
  // Sidewalk edge highlights
  ctx.fillStyle = '#4a3a6a';
  for (let x = 80; x < WORLD_W; x += 220) {
    ctx.fillRect(x - 24, 0, 2, WORLD_H);
    ctx.fillRect(x + 22, 0, 2, WORLD_H);
  }
  for (let y = 80; y < WORLD_H; y += 220) {
    ctx.fillRect(0, y - 24, WORLD_W, 2);
    ctx.fillRect(0, y + 22, WORLD_W, 2);
  }
  // Center lane dashes (yellow)
  ctx.fillStyle = 'rgba(255,210,63,0.55)';
  for (let x = 80; x < WORLD_W; x += 220) {
    for (let y = 10; y < WORLD_H; y += 38) ctx.fillRect(x - 1, y, 2, 18);
  }
  for (let y = 80; y < WORLD_H; y += 220) {
    for (let x = 10; x < WORLD_W; x += 38) ctx.fillRect(x, y - 1, 18, 2);
  }
  // Strong street outlines (kept similar to original look)
  ctx.strokeStyle = '#1a0d05';
  ctx.lineWidth = 2;
  for (let x = 80; x < WORLD_W; x += 220) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
  }
  for (let y = 80; y < WORLD_H; y += 220) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }
  // Craters from smashed buildings (drawn under everything)
  for (const c of craters) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(60,40,30,0.55)';
    ctx.beginPath(); ctx.arc(c.x + 2, c.y + 2, c.r * 0.7, 0, Math.PI * 2); ctx.fill();
    // rubble dots
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.fillStyle = 'rgba(80,60,50,0.6)';
      ctx.fillRect(c.x + Math.cos(a) * c.r * 0.8 - 1, c.y + Math.sin(a) * c.r * 0.8 - 1, 3, 3);
    }
  }
  // Buildings — per-style render
  for (const b of buildings) drawBuilding(b);
  // Broadcast tower landmark (after buildings, before actors)
  drawBroadcastTower();
  // Civilians (panicked humanoids)
  drawCivilians();
  // Powerups — pixel-art icons (heal→heart, damage→lightning; rage has no library match → keep abstract glyph)
  for (const p of powerups) {
    const blink = p.t > 8 ? (Math.floor(p.t * 6) % 2 === 0) : true;
    if (!blink) continue;
    ctx.shadowColor = p.type === 'heal' ? '#5ef38c' : (p.type === 'damage' ? '#ff3a3a' : '#b055ff');
    ctx.shadowBlur = 14;
    ctx.fillStyle = p.type === 'heal' ? '#5ef38c' : (p.type === 'damage' ? '#ff3a3a' : '#b055ff');
    ctx.fillRect(p.x - 14, p.y - 14, 28, 28);
    ctx.shadowBlur = 0;
    if (p.type === 'heal') drawIcon.heart(ctx, p.x, p.y, 22);
    else if (p.type === 'damage') drawIcon.lightning(ctx, p.x, p.y, 22);
    else {
      // Rage / enrage — no library match, keep a fanged glyph (eyebrows + jagged mouth)
      ctx.fillStyle = '#fff';
      ctx.font = "20px serif"; ctx.textAlign = 'center';
      ctx.fillText('!!', p.x, p.y + 6);
    }
  }
  // Vehicles
  for (const v of vehicles) {
    ctx.fillStyle = v.color;
    ctx.fillRect(v.x - 10, v.y - 6, 20, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(v.x - 6, v.y - 4, 12, 5);
  }
  // Helicopters
  for (const h of helicopters) {
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(h.x - 14, h.y - 8, 28, 16);
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(h.x - 18, h.y - 1, 36, 2); // rotor
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(h.x - 2, h.y - 2, 4, 4); // light
  }
  // Missiles
  for (const m of missiles) {
    ctx.fillStyle = '#ff8e3c';
    ctx.fillRect(m.x - 3, m.y - 3, 6, 6);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(m.x - 6, m.y - 1, 4, 2);
  }
  // Particles
  for (const p of particles) {
    if (p.ring) {
      ctx.strokeStyle = `rgba(255,210,63,${1 - p.t / 0.5})`;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.maxR * (p.t / 0.5), 0, Math.PI * 2); ctx.stroke();
    } else if (p.scream) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = '#fff';
      ctx.font = "bold 8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('AAA', p.x, p.y);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
  // PUGZILLA
  const r = form().r;
  // Damage-boost aura
  if (dmgBoostT > 0) {
    ctx.strokeStyle = `rgba(255,58,58,${0.4 + Math.sin(performance.now() / 80) * 0.3})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, r + 12, 0, Math.PI * 2); ctx.stroke();
  }
  // PUGZILLA — high-detail kaiju pug at scale (size scales with form radius r)
  // Body / ear come from the chosen SKIN; GHOST skin renders translucent.
  const _sk = activeSkin();
  const _ghostAlpha = (_sk.id === 'ghost') ? 0.7 : 1;
  if (_ghostAlpha < 1) ctx.globalAlpha = _ghostAlpha;
  drawPug(ctx, pug.x, pug.y, {
    size: r * 3.6,
    body: _sk.color,
    mask: '#1a0d05',
    ear: _sk.ear,
    tongueOut: true,
  });
  if (_ghostAlpha < 1) ctx.globalAlpha = 1;
  // Smoke columns (drawn in world, rise upward from smash sites)
  for (const s of smokeColumns) {
    const t = s.t / s.life;
    const baseA = (1 - t) * 0.55;
    const rise = t * 90;
    for (let i = 0; i < 5; i++) {
      const py = s.y - i * 22 - rise;
      const rr = 14 + i * 5 + Math.sin(s.t * 2 + i) * 3;
      const a = baseA * (1 - i * 0.15);
      ctx.fillStyle = `rgba(60,55,72,${a})`;
      ctx.beginPath(); ctx.arc(s.x + Math.sin(s.t + i) * 4, py, rr, 0, Math.PI * 2); ctx.fill();
    }
    // Ember
    if (t < 0.4) {
      ctx.fillStyle = `rgba(255,142,60,${(0.4 - t) * 1.4})`;
      ctx.beginPath(); ctx.arc(s.x, s.y - rise * 0.3, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Score popups (world space)
  ctx.font = "bold 12px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  for (const p of popups) {
    const a = p.t < 0.1 ? p.t / 0.1 : (p.t > 0.9 ? Math.max(0, (1.2 - p.t) / 0.3) : 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillText(p.text, p.x + 1, p.y + 1);
    ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // Hit flash overlay
  if (hitFlashT > 0) {
    ctx.fillStyle = `rgba(255,58,58,${Math.min(0.45, hitFlashT * 2.2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Evolution white-screen flash — peaks at start, fades to transparent.
  if (_evoFlashT > 0) {
    const k = _evoFlashT / 0.35;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, k * 0.85)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // RAGE tint — red overlay + screen rumble during rampage
  if (rage >= 80 || rampageT > 0) {
    const ragePulse = 0.12 + Math.sin(performance.now() / 80) * 0.06;
    ctx.fillStyle = `rgba(255,40,40,${ragePulse + (rampageT > 0 ? 0.1 : 0)})`;
    ctx.fillRect(0, 0, W, H);
    // edge vignette in red
    const rgv = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.6);
    rgv.addColorStop(0, 'rgba(0,0,0,0)');
    rgv.addColorStop(1, 'rgba(180,20,20,0.6)');
    ctx.fillStyle = rgv; ctx.fillRect(0, 0, W, H);
  }
  // NEWS TICKER (top of screen)
  drawNewsTicker();
  // RAGE bar (HUD chip — right of HP bar)
  const rgX = W / 2 + 110, rgY = 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(rgX, rgY, 100, 8);
  const ragePulseFull = (rage >= 100) ? (0.6 + Math.sin(performance.now() / 80) * 0.4) : 1;
  ctx.fillStyle = `rgba(255,58,58,${ragePulseFull})`;
  ctx.fillRect(rgX, rgY, 100 * rage / 100, 8);
  ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 1;
  ctx.strokeRect(rgX + 0.5, rgY + 0.5, 99, 7);
  ctx.fillStyle = '#ff3a3a'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  ctx.fillText('RAGE', rgX, rgY - 2);
  if (rampageT > 0) {
    ctx.fillStyle = '#ff3a3a'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`RAMPAGE ${rampageT.toFixed(1)}s`, rgX, rgY + 22);
  }
  // Tasty-Planet-style NEXT FORM preview bar — strip below the rage bar
  // showing the next evolution name + remaining vehicles + a silhouette of
  // the next form. Hidden when already at the final form.
  if (formIdx < FORMS.length - 1) {
    const nextForm = FORMS[formIdx + 1];
    const needed = 5;
    const got = Math.min(eaten, needed);
    const nfX = rgX, nfY = rgY + (rampageT > 0 ? 32 : 14);
    const nfW = 100, nfH = 6;
    // Track
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(nfX, nfY, nfW, nfH);
    // Fill
    ctx.fillStyle = nextForm.color;
    ctx.fillRect(nfX, nfY, nfW * (got / needed), nfH);
    ctx.strokeStyle = nextForm.color; ctx.lineWidth = 1;
    ctx.strokeRect(nfX + 0.5, nfY + 0.5, nfW - 1, nfH - 1);
    // Label (left)
    ctx.fillStyle = nextForm.color;
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`NEXT: ${nextForm.name.toUpperCase()}`, nfX, nfY - 3);
    // Count (right)
    ctx.fillStyle = '#c8c0e8';
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
    ctx.fillText(`${got}/${needed} 🍴`, nfX + nfW, nfY - 3);
    // Silhouette — small filled circle scaled relative to the next form's radius
    // drawn just right of the bar (a "shape preview").
    const silR = Math.max(4, Math.min(10, nextForm.r * 0.14));
    const silX = nfX + nfW + 12, silY = nfY + nfH / 2;
    ctx.fillStyle = nextForm.color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(silX, silY, silR, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Eye dots for the silhouette so it reads as a creature
    ctx.fillStyle = '#0a0716';
    ctx.beginPath(); ctx.arc(silX - silR * 0.32, silY - silR * 0.15, Math.max(1, silR * 0.18), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(silX + silR * 0.32, silY - silR * 0.15, Math.max(1, silR * 0.18), 0, Math.PI * 2); ctx.fill();
  }
  // HP bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 100, 16, 200, 8);
  ctx.fillStyle = hp > 50 ? '#5ef38c' : (hp > 25 ? '#ffd23f' : '#ff3a3a');
  ctx.fillRect(W / 2 - 100, 16, 200 * Math.max(0, hp) / 100, 8);
  // Combo banner
  if (combo > 1 && running) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 28px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 14;
    ctx.fillText(`COMBO ×${combo}  (×${comboMult().toFixed(1)})`, W / 2, 60);
    ctx.shadowBlur = 0;
    // Combo timer
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W / 2 - 100, 72, 200, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(W / 2 - 100, 72, 200 * (comboT / COMBO_WINDOW), 4);
  }
  // Rampage-style center-screen COMBO flash — pops once per new tier reached.
  // Big neon text + 'WAHOO!' subtitle. Scales up then fades, 1.1s total.
  if (comboFlash) {
    const p = comboFlash.t / comboFlash.life; // 0..1
    const ease = p < 0.2 ? p / 0.2 : 1; // pop in first
    const fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    const alpha = Math.max(0, fade);
    const scale = 0.6 + ease * 0.6 + Math.sin(p * Math.PI * 4) * 0.04;
    const hue = (comboFlash.tier % 4) * 90; // shifts colour per tier
    ctx.save();
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${hue}, 95%, 60%)`;
    ctx.shadowColor = `hsl(${hue}, 95%, 60%)`; ctx.shadowBlur = 28;
    ctx.font = "bold 56px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO ×${comboFlash.tier}!`, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = "bold 18px 'Press Start 2P', monospace";
    ctx.fillText('WAHOO!', 0, 42);
    ctx.restore();
  }
  // Damage boost banner
  if (dmgBoostT > 0) {
    ctx.fillStyle = '#ff3a3a';
    ctx.font = "16px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
    const txt = `2.5× DMG ${dmgBoostT.toFixed(1)}s`;
    ctx.fillText(txt, W - 16, H - 22);
    // pixel lightning glyph just left of the text
    const tw = ctx.measureText(txt).width;
    drawIcon.lightning(ctx, W - 16 - tw - 14, H - 28, 16);
  }
  // Cursor reach indicator
  ctx.strokeStyle = 'rgba(255,210,63,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2 + (pug.x - cam.x), H / 2 + (pug.y - cam.y), r + 100, 0, Math.PI * 2); ctx.stroke();
}

function drawNewsTicker() {
  // Black bar at top of screen
  const barH = 22;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, barH);
  // BREAKING badge
  ctx.fillStyle = '#ff3a3a';
  ctx.fillRect(0, 0, 92, barH);
  ctx.fillStyle = '#fff';
  ctx.font = "bold 10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('BREAKING', 46, 14);
  // Build live ticker string from match stats
  const damageM = ((score + smashed * 5) * 0.42).toFixed(0); // pretend damage estimate
  const segments = [
    `PUG MENACES CITY`,
    `EVACUATE NOW`,
    `ESTIMATED DAMAGE $${damageM}M`,
    `${smashed} BUILDINGS DOWN`,
    `${eaten + formIdx * 5} VEHICLES CONSUMED`,
    `MILITARY DEPLOYED`,
    rage >= 80 ? `BEAST IS ENRAGED!` : `BORK COUNT RISING`,
    broadcastTower && broadcastTower.smashed ? `NEWS TOWER SILENCED!` : `NEWS CHOPPERS CIRCLING`,
  ];
  const txt = segments.join('  ·  ') + '  ·  ';
  ctx.font = "bold 11px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  // Loop the scroll: render twice for seamless wrap
  const textW = ctx.measureText(txt).width;
  const off = newsScroll % textW;
  ctx.save();
  ctx.beginPath(); ctx.rect(96, 0, W - 96, barH); ctx.clip();
  ctx.fillText(txt, 100 - off, 14);
  ctx.fillText(txt, 100 - off + textW, 14);
  ctx.restore();
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _pzHud = {
  score: document.getElementById('hud-score'),
  form: document.getElementById('hud-form'),
  hp: document.getElementById('hud-hp'),
  hpParent: document.getElementById('hud-hp')?.parentElement,
  smashed: document.getElementById('hud-smashed'),
  eaten: document.getElementById('hud-eaten'),
  cd: document.getElementById('hud-cd'),
  best: document.getElementById('hud-best'),
};
let _pzHudPrev = { score: -1, form: '', hp: -1, hpLow: null, smashed: -1, eaten: '', cd: '', best: -1 };
let _pzBestCache = -1, _pzBestCacheT = 0;
function updateHud() {
  if (score !== _pzHudPrev.score) { _pzHud.score.textContent = score; _pzHudPrev.score = score; }
  const fn = form().name;
  if (fn !== _pzHudPrev.form) { _pzHud.form.textContent = fn; _pzHudPrev.form = fn; }
  const hv = Math.max(0, Math.ceil(hp));
  if (hv !== _pzHudPrev.hp) { _pzHud.hp.textContent = hv; _pzHudPrev.hp = hv; }
  const hLow = hp < 30;
  if (hLow !== _pzHudPrev.hpLow && _pzHud.hpParent) {
    _pzHud.hpParent.classList.toggle('is-low', hLow);
    _pzHudPrev.hpLow = hLow;
  }
  if (smashed !== _pzHudPrev.smashed) { _pzHud.smashed.textContent = smashed; _pzHudPrev.smashed = smashed; }
  const eat = formIdx >= FORMS.length - 1 ? 'MAX' : `${eaten}/5`;
  if (eat !== _pzHudPrev.eaten) { _pzHud.eaten.textContent = eat; _pzHudPrev.eaten = eat; }
  const cd = borkCd > 0 ? borkCd.toFixed(1) + 's' : 'READY';
  if (cd !== _pzHudPrev.cd) { _pzHud.cd.textContent = cd; _pzHudPrev.cd = cd; }
  const now = performance.now();
  if (now - _pzBestCacheT > 2000) {
    const best = loadBest('pugzilla');
    _pzBestCache = best ? best.score : 0;
    _pzBestCacheT = now;
  }
  if (_pzBestCache !== _pzHudPrev.best) { _pzHud.best.textContent = _pzBestCache; _pzHudPrev.best = _pzBestCache; }
}

function end() {
  running = false;
  sfx.sweep(220, 60, 'sawtooth', 1.0, 0.25);
  document.getElementById('end-score').textContent = score;
  document.getElementById('end-smashed').textContent = smashed;
  document.getElementById('end-eaten').textContent = eaten + formIdx * 5;
  const { isNewBest, current } = submitRun('pugzilla', { score, smashed });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { score };
    bestEl.innerHTML = `Best: <b>${b.score}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  // === SKIN UNLOCK CHECK ===
  // Run stats (rampages/buildings) were tracked into skinState live during play.
  // Check skin unlock thresholds vs the final score + lifetime totals.
  const newlyUnlocked = checkSkinUnlocks(score);
  saveSkinState();
  const newSkinsEl = document.getElementById('end-new-skins');
  if (newSkinsEl) {
    if (newlyUnlocked.length) {
      newSkinsEl.innerHTML = newlyUnlocked
        .map((s) => `<div class="pz-newskin-toast">UNLOCKED: ${s.name} PUG</div>`)
        .join('');
    } else {
      newSkinsEl.innerHTML = '';
    }
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // Refresh the start-screen picker (locked → unlocked transitions) for next start.
  renderSkinPicker();
}

// =============================================================================
// SKIN PICKER (start-screen UI) — renders 8 cards inside the overlay.
// =============================================================================
function renderSkinPicker() {
  const row = document.getElementById('pz-skin-row');
  if (!row) return;
  row.innerHTML = '';
  for (const s of SKINS) {
    const unlocked = skinState.unlocked.includes(s.id);
    const selected = skinState.chosen === s.id;
    const card = document.createElement('div');
    card.className = 'pz-skin-card' + (selected ? ' is-selected' : '') + (unlocked ? '' : ' is-locked');
    card.title = unlocked ? (s.name + ' — ' + s.desc) : ('LOCKED: ' + unlockLabel(s));
    const swatchAlpha = s.id === 'ghost' ? 0.7 : 1;
    card.innerHTML = `
      <div class="pz-skin-card__swatch" style="background:${s.color};opacity:${swatchAlpha};"></div>
      <div class="pz-skin-card__name">${s.name}</div>
      ${unlocked ? '' : `<div class="pz-skin-card__lock">
        <div class="pz-skin-card__lock-icon">🔒</div>
        <div>${unlockLabel(s)}</div>
      </div>`}
    `;
    if (unlocked) {
      card.addEventListener('click', () => {
        skinState.chosen = s.id;
        saveSkinState();
        renderSkinPicker();
        sfx.tone(660, 'triangle', 0.06, 0.15);
      });
    }
    row.appendChild(card);
  }
}
renderSkinPicker();

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  keys.clear(); // wipe any stuck keys from prior match
  // Wipe stale kill-feed lines from a previous match.
  try { __pugzillaFeed.clear(); } catch (e) { /* */ }
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
  try { music.setIntensity(0.25); music.play(); } catch {}
}
(function _wirePugzillaMusicEnd() {
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

// ===== EVOLUTION SHOP UI =====
const SHOP_CSS = `
.pz-shop-btn { position: fixed; top: calc(14px + env(safe-area-inset-top, 0)); right: 60px; z-index: 200;
  background: linear-gradient(180deg, #b055ff, #6a2aa0); color: #fff;
  border: 3px solid #e0b8ff; border-radius: 6px;
  font-family: var(--font-display); font-size: 0.5rem; letter-spacing: 0.08em;
  padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 0 #3a0e60;
  -webkit-tap-highlight-color: transparent; }
.pz-shop-btn:hover { transform: translateY(-1px); }
.pz-shop-chips { position: fixed; top: 60px; right: 60px; z-index: 50;
  display: flex; gap: 4px; flex-wrap: wrap; max-width: 220px; justify-content: flex-end; }
.pz-shop-chip { background: rgba(176,85,255,0.18); border: 1px solid var(--neon-purple);
  color: var(--neon-purple); font-family: var(--font-display); font-size: 0.36rem;
  letter-spacing: 0.05em; padding: 3px 5px; border-radius: 3px;
  text-shadow: 0 0 4px var(--neon-purple); }
.pz-shop-modal { position: fixed; inset: 0; z-index: 300; display: none;
  align-items: center; justify-content: center; background: rgba(0,0,0,0.75); padding: 16px;
  animation: pz-fade-in 0.18s ease-out; }
.pz-shop-modal.is-open { display: flex; }
.pz-shop-modal__panel { background: linear-gradient(180deg, #1a0f2e, #0a0716);
  border: 3px solid var(--neon-purple); border-radius: 10px; padding: 20px;
  max-width: 440px; width: 100%; box-shadow: 0 0 40px rgba(176,85,255,0.5);
  animation: pz-pop-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes pz-fade-in { from { background: rgba(0,0,0,0); } to { background: rgba(0,0,0,0.75); } }
@keyframes pz-pop-in { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.pz-shop-modal__title { font-family: var(--font-display); font-size: 0.85rem;
  letter-spacing: 0.1em; color: var(--neon-purple); text-align: center; margin: 0 0 14px;
  text-shadow: 0 0 12px var(--neon-purple); }
.pz-shop-modal__money { text-align: center; font-family: var(--font-display);
  font-size: 0.6rem; color: var(--neon-yellow); margin-bottom: 12px; }
.pz-shop-row { background: rgba(0,0,0,0.5); border: 2px solid var(--border);
  border-radius: 6px; padding: 10px; margin-bottom: 8px; display: flex;
  gap: 10px; align-items: center; }
.pz-shop-row.maxed { border-color: var(--neon-green); background: rgba(94,243,140,0.08); }
.pz-shop-row__icon { font-size: 26px; flex-shrink: 0; }
.pz-shop-row__body { flex: 1; }
.pz-shop-row__name { font-family: var(--font-display); font-size: 0.5rem;
  color: var(--neon-cyan); letter-spacing: 0.05em; }
.pz-shop-row__desc { font-size: 0.42rem; color: var(--text-soft); margin-top: 2px; }
.pz-shop-row__stack { font-size: 0.38rem; color: var(--neon-yellow); margin-top: 2px; }
.pz-shop-row__btn { background: linear-gradient(180deg, var(--neon-purple), #6a2aa0);
  color: #fff; border: 2px solid #e0b8ff; border-radius: 4px;
  font-family: var(--font-display); font-size: 0.45rem; letter-spacing: 0.05em;
  padding: 6px 8px; cursor: pointer; min-width: 70px;
  box-shadow: 0 3px 0 #3a0e60; -webkit-tap-highlight-color: transparent; }
.pz-shop-row__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pz-shop-row__btn.maxed { background: var(--neon-green); color: #0a1018; box-shadow: 0 3px 0 #1a5a30; }
.pz-shop-close { background: rgba(0,0,0,0.6); color: var(--text); border: 2px solid var(--border);
  border-radius: 4px; font-family: var(--font-display); font-size: 0.5rem;
  padding: 8px 14px; cursor: pointer; display: block; margin: 14px auto 0; }
`;
const _pzStyle = document.createElement('style'); _pzStyle.textContent = SHOP_CSS;
document.head.appendChild(_pzStyle);

const _pzShopBtn = document.createElement('button');
_pzShopBtn.className = 'pz-shop-btn';
_pzShopBtn.id = 'pz-shop-btn';
_pzShopBtn.textContent = '🛒 SHOP · $0';
_pzShopBtn.style.display = 'none';
document.body.appendChild(_pzShopBtn);

const _pzShopChips = document.createElement('div');
_pzShopChips.className = 'pz-shop-chips';
_pzShopChips.id = 'pz-shop-chips';
document.body.appendChild(_pzShopChips);

const _pzShopModal = document.createElement('div');
_pzShopModal.className = 'pz-shop-modal';
_pzShopModal.id = 'pz-shop-modal';
_pzShopModal.innerHTML = `
  <div class="pz-shop-modal__panel">
    <h2 class="pz-shop-modal__title">★ EVOLUTION SHOP ★</h2>
    <div class="pz-shop-modal__money">SCORE: <span id="pz-shop-money">0</span></div>
    <div id="pz-shop-list"></div>
    <button class="pz-shop-close" id="pz-shop-close">RESUME RAMPAGE</button>
  </div>
`;
document.body.appendChild(_pzShopModal);
_pzShopBtn.addEventListener('click', openShop);
document.getElementById('pz-shop-close').addEventListener('click', closeShop);
_pzShopModal.addEventListener('click', (e) => { if (e.target === _pzShopModal) closeShop(); });

function openShop() {
  if (!running) return;
  shopOpen = true;
  _pzShopModal.classList.add('is-open');
  renderShopList();
}
function closeShop() {
  shopOpen = false;
  _pzShopModal.classList.remove('is-open');
}
function renderShopList() {
  const moneyEl = document.getElementById('pz-shop-money');
  if (moneyEl) moneyEl.textContent = score;
  const list = document.getElementById('pz-shop-list');
  list.innerHTML = '';
  for (const u of SHOP_DEFS) {
    const stacks = shopBuys[u.id] || 0;
    const maxed = stacks >= u.max;
    const cost = shopCost(u);
    const canBuy = !maxed && score >= cost;
    const row = document.createElement('div');
    row.className = 'pz-shop-row' + (maxed ? ' maxed' : '');
    row.innerHTML = `
      <div class="pz-shop-row__icon">${u.icon}</div>
      <div class="pz-shop-row__body">
        <div class="pz-shop-row__name">${u.name}</div>
        <div class="pz-shop-row__desc">${u.desc}</div>
        ${u.max > 1 ? `<div class="pz-shop-row__stack">stack ${stacks}/${u.max}</div>` : ''}
      </div>
      <button class="pz-shop-row__btn ${maxed ? 'maxed' : ''}" ${maxed || !canBuy ? 'disabled' : ''}>
        ${maxed ? 'MAXED' : '$' + cost}
      </button>
    `;
    if (!maxed && canBuy) {
      row.querySelector('button').addEventListener('click', () => buyShop(u));
    }
    list.appendChild(row);
  }
}
function buyShop(u) {
  const cost = shopCost(u);
  if (score < cost) return;
  const stacks = shopBuys[u.id] || 0;
  if (stacks >= u.max) return;
  score -= cost;
  shopBuys[u.id] = stacks + 1;
  sfx.arp([523, 659, 880], 'triangle', 0.08, 0.22, 0.2);
  addPopup(pug.x, pug.y - form().r - 28, `★ ${u.name} ★`, '#b055ff');
  renderShopList();
  renderShopChips();
  updateHud();
}
function renderShopChips() {
  if (!_pzShopChips) return;
  _pzShopChips.innerHTML = '';
  for (const u of SHOP_DEFS) {
    const stacks = shopBuys[u.id] || 0;
    if (!stacks) continue;
    const c = document.createElement('div');
    c.className = 'pz-shop-chip';
    c.textContent = u.icon + ' ' + u.name + (u.max > 1 ? ` x${stacks}` : '');
    _pzShopChips.appendChild(c);
  }
}
// Update shop button visibility + cost label.
// Perf: cache prev values so we only touch the DOM when something actually changed.
let _prevShopDisplay = null, _prevShopScore = -1, _prevChipsDisplay = null;
function updateShopBtn() {
  if (!_pzShopBtn) return;
  const disp = running ? 'block' : 'none';
  if (_prevShopDisplay !== disp) { _pzShopBtn.style.display = disp; _prevShopDisplay = disp; }
  if (running && score !== _prevShopScore) {
    _pzShopBtn.textContent = `🛒 SHOP · $${score}`;
    _prevShopScore = score;
  }
  if (_pzShopChips) {
    const cd = running ? 'flex' : 'none';
    if (_prevChipsDisplay !== cd) { _pzShopChips.style.display = cd; _prevChipsDisplay = cd; }
  }
}
// Poll the shop-btn label via rAF (avoids monkey-patching updateHud).
function _shopBtnLoop() {
  updateShopBtn();
  requestAnimationFrame(_shopBtnLoop);
}
_shopBtnLoop();

// Keyboard shortcut: B opens shop
window.addEventListener('keydown', (e) => {
  if ((e.key === 'b' || e.key === 'B') && !e.repeat) {
    if (shopOpen) closeShop(); else if (running) openShop();
  }
});

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD walk · CLICK building to smash · SPACE = shockwave bork · 🛒 SHOP top-right (B)', 7000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Eat 5 vehicles to evolve to your next form.',
    'TIP: Shockwave bork (SPACE) downs helicopters.',
    'TIP: Higher tier forms = more HP and damage.',
    'TIP: Smashed buildings drop $ for the SHOP.',
    'LORE: Pugzilla was born during a science experiment.',
    'JOKE: What does Pugzilla eat? Whatever moves.',
  ];
  const GAME_ID = 'pugzilla';
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
        if (best && (best.score || best.smashed)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.score || 0} score · ${best.smashed || 0} smashed`;
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
      const sc = document.getElementById('end-score')?.textContent || '0';
      const sm = document.getElementById('end-smashed')?.textContent || '0';
      const text = `🐶 PUGZILLA RAMPAGE — Score ${sc} · ${sm} buildings smashed! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'PUGZILLA RAMPAGE', text, url: 'https://leobalkind.github.io/web-games/' });
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
