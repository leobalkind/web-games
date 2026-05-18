// APOCALYPSE DELIVERY PUGS — top-down driver. Reach the delivery marker
// before time runs out. Dodge zombies, mutant cats, exploding mailboxes.
// Each delivery refills time + small chance of new vehicle (skateboard,
// shopping cart, tiny tank — different stats).
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'delivery:muted' });
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
let combo = 0, comboT = 0, toxicPuddles = [], spikeStrips = [], achievementsSeen = new Set();
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
let touchAim = null;

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
  toxicPuddles = []; spikeStrips = []; toasts = [];
  // Spawn raccoons (2), toxic puddles (5), spike strips (4)
  for (let i = 0; i < 2; i++) spawnRaccoon();
  for (let i = 0; i < 5; i++) toxicPuddles.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), r: 36 });
  for (let i = 0; i < 4; i++) spikeStrips.push({ x: rand(80, WORLD_W - 80), y: rand(80, WORLD_H - 80), w: 80 });
  time = 30; deliveries = 0; fuel = 100;
  cam = { x: pug.x, y: pug.y };
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

window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('touchstart', (e) => { touchAim = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAim = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAim = null);

function tick(dt) {
  if (!running) return;
  time -= dt;
  if (time <= 0) return end();
  // Steer
  let steer = 0, throttle = 0;
  if (keys.has('a') || keys.has('arrowleft')) steer -= 1;
  if (keys.has('d') || keys.has('arrowright')) steer += 1;
  if (keys.has('w') || keys.has('arrowup')) throttle = 1;
  if (keys.has('s') || keys.has('arrowdown')) throttle = -0.5;
  if (touchAim) {
    const tx = touchAim.clientX - W / 2;
    const ty = touchAim.clientY - H / 2;
    const ta = Math.atan2(ty, tx);
    let diff = ta - pug.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    steer = Math.max(-1, Math.min(1, diff * 2));
    throttle = Math.min(1, Math.hypot(tx, ty) / 100);
  }
  pug.ang += steer * vehicle.turn * dt;
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
  for (const t of toasts) t.t += dt;
  toasts = toasts.filter((t) => t.t < 2.5);
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
  pug.vx += Math.cos(pug.ang) * vehicle.speed * boost * throttle * dt * 2;
  pug.vy += Math.sin(pug.ang) * vehicle.speed * boost * throttle * dt * 2;
  pug.vx *= Math.pow(0.5, dt * 3); pug.vy *= Math.pow(0.5, dt * 3);
  pug.x += pug.vx * dt; pug.y += pug.vy * dt;
  pug.x = Math.max(20, Math.min(WORLD_W - 20, pug.x));
  pug.y = Math.max(20, Math.min(WORLD_H - 20, pug.y));
  // Skid marks when steering hard or boosting
  const spd = Math.hypot(pug.vx, pug.vy);
  if (spd > 100 && (Math.abs(steer) > 0.4 || nitroT > 0)) {
    skidMarks.push({ x: pug.x, y: pug.y, ang: pug.ang, t: 0 });
    if (skidMarks.length > 200) skidMarks.shift();
  }
  for (const s of skidMarks) s.t += dt;
  skidMarks = skidMarks.filter((s) => s.t < 3);
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
      if (p.type === 'nitro') { nitroT = 3; }
      else if (p.type === 'shield') { shieldT = 4; }
      else if (p.type === 'magnet') { magnetT = 6; }
      else if (p.type === 'repair') { pug.hp = vehicle.hp; }
      sfx.tone(880, 'triangle', 0.1, 0.22);
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
    const bonusTime = 18 + Math.floor(combo * 0.5);
    time = Math.min(time + bonusTime, 60);
    sfx.arp([523, 659, 784, 1047], 'triangle', 0.08, 0.22, 0.25);
    // Achievement check
    if (ACHIEVEMENTS[deliveries] && !achievementsSeen.has(deliveries)) {
      toasts.push({ text: '🏆 ' + ACHIEVEMENTS[deliveries], t: 0 });
      achievementsSeen.add(deliveries);
      sfx.arp([880, 1320, 1760], 'triangle', 0.1, 0.25, 0.3);
    }
    if (combo >= 3) toasts.push({ text: `COMBO ×${combo}!`, t: 0 });
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
    }
  }
  updateHud();
}

let invuln = 0;
function damage() {
  if (invuln > 0) return;
  if (shieldT > 0) { shieldT = 0; invuln = 0.4; sfx.tone(880, 'sine', 0.12, 0.2); return; }
  pug.hp--;
  invuln = 1.0;
  sfx.sweep(220, 110, 'sawtooth', 0.15, 0.22);
  if (pug.hp <= 0) end();
}

function tickInvuln(dt) { invuln = Math.max(0, invuln - dt); }

function render() {
  // World view
  ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
  // ground (ruined asphalt)
  ctx.fillStyle = '#2a2540';
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // cracks pattern
  ctx.strokeStyle = '#3a2a5a';
  ctx.lineWidth = 1;
  for (let y = 0; y < WORLD_H; y += 80) {
    for (let x = 0; x < WORLD_W; x += 80) {
      ctx.strokeRect(x, y, 80, 80);
    }
  }
  // Rubble piles
  ctx.fillStyle = '#1a1a22';
  for (let i = 0; i < 60; i++) {
    const x = (i * 173) % WORLD_W;
    const y = (i * 211) % WORLD_H;
    ctx.fillRect(x, y, 18, 18);
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
    const icons = { nitro: '🔥', shield: '🛡', magnet: '🧲', repair: '🔧' };
    ctx.shadowColor = colors[p.type]; ctx.shadowBlur = 14;
    ctx.fillStyle = colors[p.type];
    ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = "16px serif"; ctx.textAlign = 'center';
    ctx.fillText(icons[p.type], p.x, p.y + 5);
  }
  // Pug-vehicle
  ctx.save();
  ctx.translate(pug.x, pug.y);
  ctx.rotate(pug.ang);
  ctx.fillStyle = vehicle.color;
  ctx.fillRect(-18, -10, 36, 20);
  ctx.fillStyle = '#c8854a';
  ctx.fillRect(-10, -8, 20, 16);
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(-6, -4, 12, 8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-3, -3, 2, 2); ctx.fillRect(1, -3, 2, 2);
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
  // HP indicators (hearts above pug)
  ctx.fillStyle = '#ff3a3a';
  ctx.font = "10px sans-serif";
  for (let i = 0; i < pug.hp; i++) ctx.fillText('♥', pug.x - 12 + i * 8, pug.y - 24);
  ctx.restore();

  // Off-screen marker arrow
  const dx = marker.x - pug.x, dy = marker.y - pug.y;
  const d = Math.hypot(dx, dy);
  if (d > 300) {
    const ang = Math.atan2(dy, dx);
    const ex = W / 2 + Math.cos(ang) * (Math.min(W, H) / 2 - 60);
    const ey = H / 2 + Math.sin(ang) * (Math.min(W, H) / 2 - 60);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#5ef38c';
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-12, -12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Time bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 100, 16, 200, 8);
  ctx.fillStyle = time < 8 ? '#ff3a3a' : '#5ef38c';
  ctx.fillRect(W / 2 - 100, 16, 200 * (time / 60), 8);
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
}

function updateHud() {
  document.getElementById('hud-del').textContent = deliveries;
  document.getElementById('hud-time').textContent = Math.ceil(time);
  document.getElementById('hud-fuel').textContent = Math.floor(fuel);
  document.getElementById('hud-vehicle').textContent = vehicle.name;
  const best = loadBest('delivery-pugs');
  document.getElementById('hud-best').textContent = best ? best.score : 0;
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
  lastT = now; tickInvuln(dt); tick(dt);
  if (running) render();
  requestAnimationFrame(loop);
})(performance.now());
