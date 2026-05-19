// FLOOR IS LAVA: PUG ESCAPE — endless vertical climber.
// Random platforms scroll downward. Lava rises. Pug auto-falls (gravity).
// Double-jump. Treats give score.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

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
let pug, plats, treats, powerups, blobs, lavaY, height, maxHeight, score, treatsGot, running, lastPlatY;
let jetpackT = 0, freezeT = 0, shrinkT = 0;
function reset() {
  pug = { x: W / 2, y: H - 200, vx: 0, vy: 0, onGround: false, jumpsLeft: 2, w: 22, h: 22 };
  plats = []; treats = []; powerups = []; blobs = [];
  lastPlatY = H - 100;
  // Initial ground
  plats.push({ x: W / 2 - 80, y: H - 100, w: 160, h: 16, kind: 'normal' });
  for (let i = 0; i < 30; i++) addPlatformAbove();
  lavaY = H + 200;
  height = 0; maxHeight = 0; score = 0; treatsGot = 0;
  jetpackT = 0; freezeT = 0; shrinkT = 0;
}
function addPlatformAbove() {
  lastPlatY -= 80 + Math.random() * 50;
  const w = 70 + Math.random() * 70;
  const x = Math.random() * (W - w);
  // Platform variety based on depth — higher = more variety
  const r = Math.random();
  const depth = (H - lastPlatY) / 100;
  let kind = 'normal';
  if (depth > 3 && r < 0.18) kind = 'crumble';
  else if (depth > 2 && r < 0.30) kind = 'bouncy';
  plats.push({ x, y: lastPlatY, w, h: 14, kind, t: 0, alive: true });
  if (Math.random() < 0.45) treats.push({ x: x + w / 2, y: lastPlatY - 24 });
  // Powerup (rare)
  if (depth > 4 && Math.random() < 0.06) {
    const pwTypes = ['jetpack', 'freeze', 'shrink'];
    powerups.push({ x: x + w / 2, y: lastPlatY - 38, type: pwTypes[Math.floor(Math.random() * pwTypes.length)] });
  }
  // Lava blob (rare, only deep up)
  if (depth > 6 && Math.random() < 0.08) {
    blobs.push({ x: x + w / 2, y: H + 80, vy: -100 - Math.random() * 60, life: 2.5 });
  }
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
  // Decay powerup timers
  jetpackT = Math.max(0, jetpackT - dt);
  freezeT = Math.max(0, freezeT - dt);
  shrinkT = Math.max(0, shrinkT - dt);
  pug.vx += mx * 1200 * dt;
  pug.vx *= Math.pow(0.5, dt * 5);
  pug.vy += (jetpackT > 0 ? GRAV * 0.15 : GRAV) * dt;
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
          if (p.kind === 'bouncy') {
            pug.vy = JUMP_V * 1.3;
            pug.jumpsLeft = 2;
            sfx.tone(990, 'triangle', 0.08, 0.2);
          } else {
            pug.y = p.y - pug.h / 2;
            pug.vy = 0;
            pug.onGround = true;
            pug.jumpsLeft = 2;
            if (p.kind === 'crumble') {
              p.t += dt * 8; // tick fast while standing
              if (!p.crumbleStartT) p.crumbleStartT = performance.now();
              if (performance.now() - p.crumbleStartT > 700) p.alive = false;
            }
          }
        }
      }
    }
  }
  // Powerup pickup
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (Math.abs(p.x - pug.x) < 20 && Math.abs(p.y - pug.y) < 20) {
      powerups.splice(i, 1);
      if (p.type === 'jetpack') jetpackT = 5;
      else if (p.type === 'freeze') freezeT = 4;
      else if (p.type === 'shrink') shrinkT = 6;
      sfx.tone(1320, 'triangle', 0.12, 0.22);
    }
  }
  // Lava blobs
  for (let i = blobs.length - 1; i >= 0; i--) {
    const b = blobs[i];
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.y < -200) { blobs.splice(i, 1); continue; }
    if (Math.abs(b.x - pug.x) < 18 && Math.abs(b.y - pug.y) < 18) return die();
  }

  // Lava rises — accelerating (paused if freeze powerup active)
  height = Math.max(height, Math.floor((H - 200 - pug.y) / 10));
  maxHeight = Math.max(maxHeight, height);
  const lavaSpeed = (freezeT > 0 ? 0 : 50 + height * 0.4);
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
  // Platforms (color by kind)
  for (const p of plats) {
    if (!p.alive) continue;
    const isCrumble = p.kind === 'crumble';
    const isBouncy = p.kind === 'bouncy';
    const color = isBouncy ? '#b055ff' : (isCrumble ? '#8a6a4a' : '#5a3a1c');
    const topColor = isBouncy ? '#d59aff' : (isCrumble ? '#a68a6a' : '#7a5a3a');
    const grassColor = isBouncy ? '#ff8aa8' : (isCrumble ? '#ff8e3c' : '#5ef38c');
    ctx.fillStyle = color; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = topColor; ctx.fillRect(p.x, p.y, p.w, 3);
    ctx.fillStyle = grassColor; ctx.fillRect(p.x, p.y - 3, p.w, 3);
    // crumble indicator: cracks if started crumbling
    if (isCrumble && p.crumbleStartT) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(p.x + 6, p.y + 4, 4, 2);
      ctx.fillRect(p.x + p.w - 14, p.y + 6, 4, 2);
    }
  }
  // Powerups
  for (const p of powerups) {
    const colors = { jetpack: '#ff8e3c', freeze: '#4cc9f0', shrink: '#b055ff' };
    const icons = { jetpack: '🚀', freeze: '❄', shrink: '🔻' };
    ctx.shadowColor = colors[p.type]; ctx.shadowBlur = 12;
    ctx.fillStyle = colors[p.type]; ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.font = "14px serif"; ctx.textAlign = 'center';
    ctx.fillText(icons[p.type], p.x, p.y + 4);
  }
  // Lava blobs
  for (const b of blobs) {
    ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(b.x - 3, b.y - 3, 2, 2);
    ctx.fillRect(b.x + 1, b.y - 3, 2, 2);
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
  // Active powerup HUD chips (bottom-left)
  let py = H - 30;
  const chip = (label, t, color) => {
    if (t <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(12, py - 16, 130, 22);
    ctx.fillStyle = color;
    ctx.fillRect(12, py - 16, 130 * Math.min(1, t / 5), 4);
    ctx.fillStyle = '#fff'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`${label} ${t.toFixed(1)}s`, 18, py);
    py -= 26;
  };
  chip('🚀 JETPACK', jetpackT, '#ff8e3c');
  chip('❄ FREEZE', freezeT, '#4cc9f0');
  chip('🔻 SHRINK', shrinkT, '#b055ff');
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

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('A/D move · SPACE jump (double-jump midair) · grab treats, dodge lava', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
