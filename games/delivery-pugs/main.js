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
};

let pug, vehicle, marker, obstacles, time, deliveries, fuel, running, cam;
const keys = new Set();
let touchAim = null;

function reset() {
  vehicle = VEHICLES.skateboard;
  pug = { x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0, ang: 0, hp: vehicle.hp };
  marker = newMarker();
  obstacles = [];
  for (let i = 0; i < 40; i++) spawnObstacle();
  time = 30; deliveries = 0; fuel = 100;
  cam = { x: pug.x, y: pug.y };
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
  const boost = (keys.has('shift') && fuel > 0) ? 1.5 : 1;
  if (boost > 1) fuel = Math.max(0, fuel - dt * 25);
  fuel = Math.min(100, fuel + dt * 5);
  pug.vx += Math.cos(pug.ang) * vehicle.speed * boost * throttle * dt * 2;
  pug.vy += Math.sin(pug.ang) * vehicle.speed * boost * throttle * dt * 2;
  pug.vx *= Math.pow(0.5, dt * 3); pug.vy *= Math.pow(0.5, dt * 3);
  pug.x += pug.vx * dt; pug.y += pug.vy * dt;
  pug.x = Math.max(20, Math.min(WORLD_W - 20, pug.x));
  pug.y = Math.max(20, Math.min(WORLD_H - 20, pug.y));

  // Cam follow
  cam.x += (pug.x - cam.x) * 5 * dt;
  cam.y += (pug.y - cam.y) * 5 * dt;

  // Marker reach
  if (Math.hypot(pug.x - marker.x, pug.y - marker.y) < 50) {
    deliveries++;
    time = Math.min(time + 18, 60);
    sfx.arp([523, 659, 784, 1047], 'triangle', 0.08, 0.22, 0.25);
    // Maybe upgrade vehicle
    if (deliveries % 5 === 0) {
      const keys2 = Object.keys(VEHICLES);
      vehicle = VEHICLES[keys2[Math.floor(Math.random() * keys2.length)]];
      pug.hp = vehicle.hp;
      sfx.tone(1320, 'triangle', 0.2, 0.25);
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
  // Marker
  ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 20;
  ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(marker.x, marker.y, 40 + Math.sin(performance.now() / 200) * 5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#5ef38c'; ctx.font = "20px serif";
  ctx.textAlign = 'center'; ctx.fillText('📍', marker.x, marker.y + 7);
  ctx.shadowBlur = 0;
  // Obstacles
  for (const o of obstacles) drawObstacle(o);
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
}

function drawObstacle(o) {
  if (o.type === 'zombie') {
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
  lastT = now; tickInvuln(dt); tick(dt); render();
  requestAnimationFrame(loop);
})(performance.now());
