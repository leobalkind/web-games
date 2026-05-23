// PUGZILLA RAMPAGE — top-down city destruction.
// Walk around city, click to smash buildings, vehicles flee, helicopters shoot
// missiles. Shockwave bork knocks back everything. Eat 5 vehicles to evolve.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'pugzilla:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

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
let mouse = { x: 0, y: 0 };
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
let hitFlashT = 0;
let popups = []; // {x, y, text, color, t}
let smokeColumns = []; // ambient smoke pillars at smash sites: {x, y, t, life}
let craters = []; // permanent floor scars from smashed buildings
let distantChoppers = []; // far skyline helicopter silhouettes (decorative)
function addShake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function addPopup(x, y, text, color) { popups.push({ x, y, text, color: color || '#ffd23f', t: 0 }); if (popups.length > 40) popups.shift(); }

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
  combo = 0; comboT = 0; dmgBoostT = 0;
  cam = { x: pug.x, y: pug.y };
  shakeT = 0; shakeMag = 0; hitFlashT = 0;
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
    fireCd: 2,
    hp: 2,
  });
}
function form() { return FORMS[formIdx]; }

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.code === 'Space') doBork();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', () => smashAt(mouse.x + cam.x - W / 2, mouse.y + cam.y - H / 2));
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY;
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
      score += 20;
      sfx.tone(720, 'triangle', 0.06, 0.18);
      addPopup(c.x, c.y - 8, '+20 NOM', '#ff8ec8');
      addBurst && addBurst(c.x, c.y, '#ff5050', 6);
      addRage(4);
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
        addShake(10, 0.4);
        addPopup(pug.x, pug.y - form().r - 12, 'EVOLVE! ' + form().name.toUpperCase(), '#b055ff');
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
  if (!running || borkCd > 0) return;
  borkCd = 4;
  sfx.sweep(220, 80, 'sawtooth', 0.5, 0.3);
  addShake(8, 0.32);
  // Shockwave: push everything outward + damage helicopters; rage = +50% radius
  const rageRadiusBoost = (rage >= 80 || rampageT > 0) ? 1.5 : 1;
  const reach = (form().r + 250) * rageRadiusBoost;
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
        spawnDust(h.x, h.y, '#ff3a3a');
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
        buildings.splice(i, 1);
      }
    }
  }
  particles.push({ ring: true, x: pug.x, y: pug.y, t: 0, maxR: reach });
}
function bumpCombo() {
  if (comboT > 0) combo++;
  else combo = 1;
  comboT = 2.0;
}
function comboMult() { return Math.min(5, 1 + (combo - 1) * 0.25); }

function smashBuilding(b, idx) {
  bumpCombo();
  const mult = comboMult();
  const gain = Math.floor(b.val * mult);
  score += gain;
  smashed++;
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
        if (h.hp <= 0) { score += 200; helicopters.splice(j, 1); }
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
  rage = Math.min(100, rage + amount);
  if (rage >= 100) {
    rampageT = 3.0;
    addShake(12, 0.5);
    addPopup(pug.x, pug.y - form().r - 20, 'RAMPAGE!!!', '#ff3a3a');
    sfx.arp([220, 330, 110], 'sawtooth', 0.2, 0.4, 0.6);
  }
}

function spawnDust(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 0.7, t: 0, size: 4 });
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
  borkCd = Math.max(0, borkCd - dt);
  comboT = Math.max(0, comboT - dt);
  if (comboT <= 0) combo = 0;
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
  // Move pug
  let mx = 0, my = 0;
  if (keys.has('w')) my -= 1;
  if (keys.has('s')) my += 1;
  if (keys.has('a')) mx -= 1;
  if (keys.has('d')) mx += 1;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const rageBoost = (rage >= 80 || rampageT > 0) ? 1.3 : 1;
    const speed = (220 - formIdx * 25) * rageBoost;
    pug.vx += (mx / l) * speed * dt * 3;
    pug.vy += (my / l) * speed * dt * 3;
  }
  pug.vx *= Math.pow(0.5, dt * 3); pug.vy *= Math.pow(0.5, dt * 3);
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
      h.fireCd = 1.8 + Math.random() * 0.6;
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
      const rageDmgCut = (rage >= 80 || rampageT > 0) ? 0.5 : 1;
      const dmg = Math.round(12 * rageDmgCut);
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
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
      if (p.t >= p.life) particles.splice(i, 1);
    }
  }
  // Juice tick
  if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) shakeMag = 0; }
  if (hitFlashT > 0) hitFlashT = Math.max(0, hitFlashT - dt);
  for (const p of popups) { p.t += dt; p.y -= 32 * dt; }
  popups = popups.filter((p) => p.t < 1.2);
  for (const s of smokeColumns) s.t += dt;
  smokeColumns = smokeColumns.filter((s) => s.t < s.life);
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
  drawPug(ctx, pug.x, pug.y, {
    size: r * 3.6,
    body: form().color,
    mask: '#1a0d05',
    ear: '#8a5a2c',
    tongueOut: true,
  });
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
    ctx.fillRect(W / 2 - 100, 72, 200 * (comboT / 2.0), 4);
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

function updateHud() {
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-form').textContent = form().name;
  const hpEl = document.getElementById('hud-hp');
  hpEl.textContent = Math.max(0, Math.ceil(hp));
  hpEl.parentElement.classList.toggle('is-low', hp < 30);
  document.getElementById('hud-smashed').textContent = smashed;
  document.getElementById('hud-eaten').textContent = `${eaten}/5`;
  document.getElementById('hud-cd').textContent = borkCd > 0 ? borkCd.toFixed(1) + 's' : 'READY';
  const best = loadBest('pugzilla');
  document.getElementById('hud-best').textContent = best ? best.score : 0;
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
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
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

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD walk · CLICK building to smash · SPACE = shockwave bork', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
