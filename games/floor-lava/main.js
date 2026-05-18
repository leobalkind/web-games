// FLOOR IS LAVA: PUG ESCAPE — endless vertical climber.
// Random platforms scroll downward. Lava rises. Pug auto-falls (gravity).
// Double-jump. Treats give score.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'lava:muted' });
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

const GRAV = 1400;
const JUMP_V = -680;
let pug, plats, treats, lavaY, height, maxHeight, score, treatsGot, running, lastPlatY;
function reset() {
  pug = { x: W / 2, y: H - 200, vx: 0, vy: 0, onGround: false, jumpsLeft: 2, w: 22, h: 22 };
  plats = []; treats = [];
  lastPlatY = H - 100;
  // Initial ground
  plats.push({ x: W / 2 - 80, y: H - 100, w: 160, h: 16 });
  for (let i = 0; i < 30; i++) addPlatformAbove();
  lavaY = H + 200;
  height = 0; maxHeight = 0; score = 0; treatsGot = 0;
}
function addPlatformAbove() {
  lastPlatY -= 80 + Math.random() * 50;
  const w = 70 + Math.random() * 70;
  const x = Math.random() * (W - w);
  plats.push({ x, y: lastPlatY, w, h: 14 });
  if (Math.random() < 0.5) treats.push({ x: x + w / 2, y: lastPlatY - 24 });
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.key === 'w' || e.code === 'Space' || e.key === 'ArrowUp') jump();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let touchX = null;
canvas.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchX = null);
document.getElementById('jump-btn').addEventListener('click', jump);
if ('ontouchstart' in window) document.getElementById('jump-btn').style.display = 'block';

function jump() {
  if (!running || pug.jumpsLeft <= 0) return;
  pug.vy = JUMP_V;
  pug.jumpsLeft--;
  pug.onGround = false;
  sfx.tone(pug.jumpsLeft === 1 ? 660 : 880, 'triangle', 0.08, 0.18);
}

function tick(dt) {
  if (!running) return;
  // Movement
  let mx = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchX !== null) {
    if (touchX < W / 2 - 30) mx = -1;
    else if (touchX > W / 2 + 30) mx = 1;
  }
  pug.vx += mx * 1200 * dt;
  pug.vx *= Math.pow(0.5, dt * 5);
  pug.vy += GRAV * dt;
  pug.x += pug.vx * dt;
  pug.y += pug.vy * dt;
  // Wrap horizontally
  if (pug.x < -10) pug.x = W;
  if (pug.x > W + 10) pug.x = 0;

  // Platform collision (only when falling)
  pug.onGround = false;
  if (pug.vy > 0) {
    for (const p of plats) {
      if (pug.x + pug.w / 2 > p.x && pug.x - pug.w / 2 < p.x + p.w) {
        if (pug.y + pug.h / 2 > p.y && pug.y + pug.h / 2 < p.y + p.h + 12) {
          pug.y = p.y - pug.h / 2;
          pug.vy = 0;
          pug.onGround = true;
          pug.jumpsLeft = 2;
        }
      }
    }
  }

  // Lava rises — accelerating
  height = Math.max(height, Math.floor((H - 200 - pug.y) / 10));
  maxHeight = Math.max(maxHeight, height);
  const lavaSpeed = 50 + height * 0.4;
  lavaY -= lavaSpeed * dt;
  // Camera: when pug is above middle, scroll world down
  if (pug.y < H * 0.4) {
    const dy = H * 0.4 - pug.y;
    pug.y += dy;
    lavaY += dy;
    for (const p of plats) p.y += dy;
    for (const t of treats) t.y += dy;
  }
  // Recycle platforms above viewport
  while (lastPlatY > -200) addPlatformAbove();
  for (let i = plats.length - 1; i >= 0; i--) if (plats[i].y > H + 100) plats.splice(i, 1);
  for (let i = treats.length - 1; i >= 0; i--) if (treats[i].y > H + 100) treats.splice(i, 1);

  // Treats
  for (let i = treats.length - 1; i >= 0; i--) {
    const t = treats[i];
    if (Math.abs(t.x - pug.x) < 20 && Math.abs(t.y - pug.y) < 20) {
      treats.splice(i, 1);
      treatsGot++; score += 50;
      sfx.tone(1320, 'triangle', 0.08, 0.2);
    }
  }
  score = Math.max(score, height * 10 + treatsGot * 50);

  // Lava death
  if (pug.y + pug.h / 2 >= lavaY) return die();
  // Fall too far below
  if (pug.y > H + 80) return die();
  updateHud();
}

function render() {
  // Sky gradient
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0a0716'); grd.addColorStop(1, '#3a1a14');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  // Platforms
  for (const p of plats) {
    ctx.fillStyle = '#5a3a1c'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(p.x, p.y, p.w, 3);
    // grass tops
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(p.x, p.y - 3, p.w, 3);
  }
  // Treats
  for (const t of treats) {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(t.x - 6, t.y - 6, 12, 12);
    ctx.shadowBlur = 0;
  }
  // Lava with surface bubbles
  ctx.fillStyle = '#ff3a3a'; ctx.fillRect(0, lavaY, W, H - lavaY);
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 12; i++) {
    const x = (i * 73 + performance.now() / 5) % W;
    ctx.beginPath(); ctx.arc(x, lavaY + 4, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff8e3c';
  ctx.fillRect(0, lavaY, W, 4);
  // Pug
  ctx.fillStyle = '#8a5a2c';
  ctx.fillRect(pug.x - 10, pug.y - 16, 5, 5); ctx.fillRect(pug.x + 5, pug.y - 16, 5, 5);
  ctx.fillStyle = '#c8854a';
  ctx.fillRect(pug.x - pug.w / 2, pug.y - pug.h / 2, pug.w, pug.h);
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(pug.x - 8, pug.y - 5, 16, 8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(pug.x - 6, pug.y - 4, 3, 3); ctx.fillRect(pug.x + 3, pug.y - 4, 3, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(pug.x - 5, pug.y - 3, 2, 2); ctx.fillRect(pug.x + 4, pug.y - 3, 2, 2);
  // Jump indicator
  ctx.fillStyle = '#5ef38c';
  for (let i = 0; i < pug.jumpsLeft; i++) ctx.fillRect(pug.x - 6 + i * 8, pug.y - 24, 4, 4);
}

function updateHud() {
  document.getElementById('hud-height').textContent = height + 'm';
  document.getElementById('hud-score').textContent = score;
  const best = loadBest('floor-lava');
  document.getElementById('hud-best').textContent = (best ? best.height : 0) + 'm';
}

function die() {
  running = false;
  sfx.sweep(440, 110, 'sawtooth', 0.6, 0.25);
  document.getElementById('end-height').textContent = maxHeight + 'm';
  document.getElementById('end-treats').textContent = treatsGot;
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
