// PUGZILLA RAMPAGE — top-down city destruction.
// Walk around city, click to smash buildings, vehicles flee, helicopters shoot
// missiles. Shockwave bork knocks back everything. Eat 5 vehicles to evolve.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
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

let pug, buildings, vehicles, helicopters, missiles, particles, score, smashed, eaten, hp, formIdx, borkCd, cam, running;
let mouse = { x: 0, y: 0 };

function reset() {
  formIdx = 0;
  pug = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0 };
  buildings = [];
  for (let i = 0; i < 80; i++) {
    buildings.push({
      x: rand(40, WORLD_W - 60),
      y: rand(40, WORLD_H - 60),
      w: rand(40, 80),
      h: rand(50, 130),
      hp: 1 + Math.floor(Math.random() * 3),
      color: ['#5a5a72', '#6b3a1c', '#3a3a4a', '#4a4a52'][Math.floor(Math.random() * 4)],
    });
  }
  vehicles = []; helicopters = []; missiles = []; particles = [];
  for (let i = 0; i < 18; i++) spawnVehicle();
  for (let i = 0; i < 3; i++) spawnHelicopter();
  score = 0; smashed = 0; eaten = 0; hp = 100; borkCd = 0;
  cam = { x: pug.x, y: pug.y };
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
  // Smash building under reach (within pug.r + 80)
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (wx > b.x && wx < b.x + b.w && wy > b.y && wy < b.y + b.h) {
      if (Math.hypot(b.x + b.w / 2 - pug.x, b.y + b.h / 2 - pug.y) > form().r + 100) continue;
      b.hp -= form().smash;
      sfx.tone(120 + Math.random() * 60, 'sawtooth', 0.1, 0.22);
      if (b.hp <= 0) {
        score += 50;
        smashed++;
        spawnDust(b.x + b.w / 2, b.y + b.h / 2, b.color);
        buildings.splice(i, 1);
        if (Math.random() < 0.2 && buildings.length < 100) spawnReplacementBuilding();
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
      if (eaten >= 5 && formIdx < FORMS.length - 1) {
        formIdx++; eaten = 0;
        hp = Math.min(100 + formIdx * 50, hp + 80);
        sfx.arp([523, 659, 784, 1047], 'triangle', 0.1, 0.25, 0.3);
      }
      spawnVehicle();
      return;
    }
  }
}
function spawnReplacementBuilding() {
  // off-screen
  buildings.push({
    x: rand(0, WORLD_W), y: rand(0, WORLD_H),
    w: rand(40, 80), h: rand(50, 130),
    hp: 1 + Math.floor(Math.random() * 3),
    color: ['#5a5a72', '#6b3a1c', '#3a3a4a'][Math.floor(Math.random() * 3)],
  });
}

function doBork() {
  if (!running || borkCd > 0) return;
  borkCd = 4;
  sfx.sweep(220, 80, 'sawtooth', 0.5, 0.3);
  // Shockwave: push everything outward + damage helicopters
  const reach = form().r + 250;
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
function spawnDust(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 140;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 0.7, t: 0, size: 4 });
  }
}

function tick(dt) {
  if (!running) return;
  borkCd = Math.max(0, borkCd - dt);
  // Move pug
  let mx = 0, my = 0;
  if (keys.has('w')) my -= 1;
  if (keys.has('s')) my += 1;
  if (keys.has('a')) mx -= 1;
  if (keys.has('d')) mx += 1;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const speed = 220 - formIdx * 25;
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
      hp -= 12;
      missiles.splice(i, 1);
      sfx.tone(180, 'square', 0.1, 0.22);
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
  updateHud();
}

function render() {
  ctx.fillStyle = '#22103f'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
  // Ground / streets
  ctx.fillStyle = '#3a2a5a'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.strokeStyle = '#1a0d05';
  ctx.lineWidth = 4;
  for (let x = 80; x < WORLD_W; x += 220) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
  }
  for (let y = 80; y < WORLD_H; y += 220) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }
  // Buildings
  for (const b of buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    // windows
    ctx.fillStyle = 'rgba(255,210,63,0.55)';
    for (let yy = 6; yy < b.h - 8; yy += 12) {
      for (let xx = 6; xx < b.w - 6; xx += 12) {
        if ((xx + yy + b.hp * 7) % 24 === 0) ctx.fillRect(b.x + xx, b.y + yy, 4, 6);
      }
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
    } else {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
  // PUGZILLA
  const r = form().r;
  ctx.fillStyle = form().color;
  ctx.beginPath(); ctx.arc(pug.x, pug.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a5a2c';
  ctx.fillRect(pug.x - r + 4, pug.y - r - 8, r * 0.5, r * 0.5);
  ctx.fillRect(pug.x + r * 0.5 - 4, pug.y - r - 8, r * 0.5, r * 0.5);
  ctx.fillStyle = '#1a0d05';
  ctx.beginPath(); ctx.ellipse(pug.x, pug.y + r * 0.18, r * 0.7, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(pug.x - r * 0.4, pug.y - r * 0.18, r * 0.16, r * 0.16);
  ctx.fillRect(pug.x + r * 0.24, pug.y - r * 0.18, r * 0.16, r * 0.16);
  ctx.fillStyle = '#ff3a3a';
  ctx.fillRect(pug.x - r * 0.36, pug.y - r * 0.14, r * 0.08, r * 0.08);
  ctx.fillRect(pug.x + r * 0.28, pug.y - r * 0.14, r * 0.08, r * 0.08);
  ctx.fillStyle = '#ff5a82';
  ctx.beginPath(); ctx.arc(pug.x, pug.y + r * 0.45, r * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // HP bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 100, 16, 200, 8);
  ctx.fillStyle = hp > 50 ? '#5ef38c' : (hp > 25 ? '#ffd23f' : '#ff3a3a');
  ctx.fillRect(W / 2 - 100, 16, 200 * Math.max(0, hp) / 100, 8);
  // Cursor reach indicator
  ctx.strokeStyle = 'rgba(255,210,63,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2 + (pug.x - cam.x), H / 2 + (pug.y - cam.y), r + 100, 0, Math.PI * 2); ctx.stroke();
}

function updateHud() {
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-form').textContent = form().name;
  document.getElementById('hud-hp').textContent = Math.max(0, Math.ceil(hp));
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
