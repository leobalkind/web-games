// PUG HEIST SOCIETY — top-down stealth. Avoid human vision cones.
// Bark distracts a nearby human (look toward sound for ~2s).
// Fart boost = 1.5s speed burst but increases sound radius (humans turn to you).
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'heist:muted' });
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

const LOOT_TYPES = ['🦴', '🧀', '🧦', '🍖', '🥓', '🥪'];
let pug, humans, walls, loot, exitZ, floor, barkCd, fartCd, running;

function genFloor(level) {
  pug = { x: 60, y: H - 100, vx: 0, vy: 0, alive: true, fartT: 0, sound: 0 };
  walls = [];
  // Outer walls
  walls.push({ x: 0, y: 0, w: W, h: 12 });
  walls.push({ x: 0, y: H - 12, w: W, h: 12 });
  walls.push({ x: 0, y: 0, w: 12, h: H });
  walls.push({ x: W - 12, y: 0, w: 12, h: H });
  // Interior walls forming rooms (random)
  const cols = 4, rows = 3;
  const cw = W / cols, ch = H / rows;
  for (let c = 1; c < cols; c++) {
    let y = 0;
    const gaps = [Math.floor(Math.random() * rows)];
    for (let r = 0; r < rows; r++) {
      if (!gaps.includes(r)) {
        walls.push({ x: c * cw - 6, y: r * ch + 10, w: 12, h: ch - 20 });
      }
    }
  }
  for (let r = 1; r < rows; r++) {
    const gaps = [Math.floor(Math.random() * cols)];
    for (let c = 0; c < cols; c++) {
      if (!gaps.includes(c)) {
        walls.push({ x: c * cw + 10, y: r * ch - 6, w: cw - 20, h: 12 });
      }
    }
  }
  // Loot - one per room (roughly)
  loot = [];
  const lootCount = 4 + level;
  for (let i = 0; i < lootCount; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = 30 + Math.random() * (W - 60);
      const y = 30 + Math.random() * (H - 60);
      if (!isWallNear(x, y, 16)) {
        loot.push({ x, y, icon: LOOT_TYPES[Math.floor(Math.random() * LOOT_TYPES.length)], taken: false });
        break;
      }
    }
  }
  // Humans - 2 + level/2
  humans = [];
  const humanCount = 1 + Math.floor(level / 2) + 1;
  for (let i = 0; i < humanCount; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const x = W / 2 + (Math.random() - 0.5) * W * 0.5;
      const y = H / 2 + (Math.random() - 0.5) * H * 0.5;
      if (!isWallNear(x, y, 30) && Math.hypot(x - pug.x, y - pug.y) > 200) {
        humans.push({
          x, y, ang: Math.random() * Math.PI * 2, lookT: 0,
          patrol: [
            { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 },
            { x: x + (Math.random() - 0.5) * 200, y: y + (Math.random() - 0.5) * 200 },
          ],
          patrolIdx: 0,
          state: 'patrol',
          alertT: 0,
          distractTarget: null,
        });
        break;
      }
    }
  }
  // Exit
  exitZ = { x: W - 50, y: 50, r: 30 };
  barkCd = 0; fartCd = 0;
}

function isWallNear(x, y, r) {
  for (const w of walls) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  return false;
}

function rectCollide(e, dx, dy) {
  const r = 10;
  const nx = e.x + dx;
  if (!isWallNear(nx, e.y, r)) e.x = nx;
  const ny = e.y + dy;
  if (!isWallNear(e.x, ny, r)) e.y = ny;
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.code === 'Space') doBark();
  if (e.key === 'Shift' || e.key.toLowerCase() === 'shift') doFart();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let touchAim = null;
canvas.addEventListener('touchstart', (e) => { touchAim = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAim = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAim = null);

function doBark() {
  if (barkCd > 0 || !running) return;
  barkCd = 5;
  sfx.tone(440, 'square', 0.15, 0.22);
  // Find nearest human and distract toward a random direction
  let near = null, bestD = 200;
  for (const h of humans) {
    const d = Math.hypot(h.x - pug.x, h.y - pug.y);
    if (d < bestD) { bestD = d; near = h; }
  }
  if (near) {
    // distract toward a random position AWAY from pug
    const ang = Math.atan2(pug.y - near.y, pug.x - near.x) + Math.PI; // opposite of pug
    near.distractTarget = {
      x: near.x + Math.cos(ang) * 200,
      y: near.y + Math.sin(ang) * 200,
    };
    near.state = 'distracted';
    near.alertT = 2.0;
  }
}

function doFart() {
  if (fartCd > 0 || !running) return;
  fartCd = 6;
  pug.fartT = 1.5;
  pug.sound = 1; // big sound
  sfx.tone(110, 'sawtooth', 0.4, 0.25);
}

function tick(dt) {
  if (!running) return;
  barkCd = Math.max(0, barkCd - dt);
  fartCd = Math.max(0, fartCd - dt);
  pug.fartT = Math.max(0, pug.fartT - dt);
  pug.sound = Math.max(0, pug.sound - dt * 0.5);

  // Move
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchAim) {
    mx = touchAim.clientX - pug.x; my = touchAim.clientY - pug.y;
    const l = Math.hypot(mx, my);
    if (l > 20) { mx /= l; my /= l; } else { mx = 0; my = 0; }
  }
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const speed = (pug.fartT > 0 ? 220 : 110);
    rectCollide(pug, (mx / l) * speed * dt, (my / l) * speed * dt);
  }

  // Loot pickup
  for (const lt of loot) {
    if (lt.taken) continue;
    if (Math.hypot(lt.x - pug.x, lt.y - pug.y) < 20) {
      lt.taken = true;
      sfx.tone(880, 'triangle', 0.1, 0.22);
    }
  }
  // Exit check
  if (loot.every((l) => l.taken)) {
    if (Math.hypot(exitZ.x - pug.x, exitZ.y - pug.y) < exitZ.r) {
      floor++;
      genFloor(floor);
      sfx.arp([523, 659, 784], 'triangle', 0.08, 0.22, 0.2);
      return;
    }
  }

  // Humans
  for (const h of humans) {
    if (h.lookT > 0) h.lookT -= dt;
    if (h.alertT > 0) h.alertT -= dt;
    if (h.state === 'patrol') {
      const target = h.patrol[h.patrolIdx];
      const dx = target.x - h.x, dy = target.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 20) {
        h.patrolIdx = (h.patrolIdx + 1) % h.patrol.length;
        h.lookT = 1.2; // pause to look
      } else if (h.lookT <= 0) {
        h.ang = Math.atan2(dy, dx);
        rectCollide(h, (dx / d) * 50 * dt, (dy / d) * 50 * dt);
      }
    } else if (h.state === 'distracted' && h.distractTarget) {
      const dx = h.distractTarget.x - h.x, dy = h.distractTarget.y - h.y;
      const d = Math.hypot(dx, dy);
      h.ang = Math.atan2(dy, dx);
      if (d > 20) rectCollide(h, (dx / d) * 60 * dt, (dy / d) * 60 * dt);
      if (h.alertT <= 0) { h.state = 'patrol'; h.distractTarget = null; }
    }
    // Vision cone check
    const dx = pug.x - h.x, dy = pug.y - h.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let diff = ang - h.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const inCone = d < 180 && Math.abs(diff) < 0.6;
    // line-of-sight: any wall between?
    let blocked = false;
    if (inCone) {
      const steps = 16;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const sx = h.x + (pug.x - h.x) * t;
        const sy = h.y + (pug.y - h.y) * t;
        if (isWallNear(sx, sy, 2)) { blocked = true; break; }
      }
    }
    if (inCone && !blocked) caught();
    // Sound detection
    if (pug.sound > 0.6 && d < 240) {
      // turn toward sound
      h.ang = ang;
      h.state = 'distracted';
      h.distractTarget = { x: pug.x, y: pug.y };
      h.alertT = 1.5;
    }
  }
  updateHud();
}

function caught() {
  if (!running) return;
  running = false;
  sfx.sweep(220, 80, 'sawtooth', 0.6, 0.25);
  document.getElementById('end-title').textContent = 'CAUGHT!';
  document.getElementById('end-sub').textContent = 'The human saw you. Held by the scruff.';
  document.getElementById('end-floor').textContent = floor;
  document.getElementById('end-loot').textContent = loot.filter((l) => l.taken).length + (floor - 1) * 6;
  const score = floor;
  const { isNewBest, current } = submitRun('pug-heist', { score, floor });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { floor };
    bestEl.innerHTML = `Best: <b>${b.floor} floors</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

function render() {
  // BG (carpet)
  ctx.fillStyle = '#3a2a5a'; ctx.fillRect(0, 0, W, H);
  // tiles
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let y = 0; y < H; y += 40) for (let x = 0; x < W; x += 40)
    if ((x + y) % 80 === 0) ctx.fillRect(x, y, 40, 40);
  // Walls
  ctx.fillStyle = '#1a0d05';
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = '#6b3a1c';
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, Math.min(3, w.h));
  // Loot
  for (const lt of loot) {
    if (lt.taken) continue;
    ctx.font = "22px serif"; ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    ctx.fillText(lt.icon, lt.x, lt.y + 6);
    ctx.shadowBlur = 0;
  }
  // Exit zone (only when all loot taken)
  if (loot.every((l) => l.taken)) {
    ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 3;
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(exitZ.x, exitZ.y, exitZ.r + Math.sin(performance.now() / 200) * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#5ef38c'; ctx.font = "20px sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitZ.x, exitZ.y + 6);
  }
  // Humans + vision cones
  for (const h of humans) {
    // cone
    ctx.fillStyle = 'rgba(255,58,58,0.18)';
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.arc(h.x, h.y, 180, h.ang - 0.6, h.ang + 0.6);
    ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(h.x - 12, h.y - 12, 24, 24);
    ctx.fillStyle = '#e0a566';
    ctx.fillRect(h.x - 8, h.y - 18, 16, 8);
    // facing dot
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(h.x + Math.cos(h.ang) * 10, h.y + Math.sin(h.ang) * 10, 3, 0, Math.PI * 2); ctx.fill();
    if (h.alertT > 0) {
      ctx.fillStyle = '#ff3a3a'; ctx.font = "12px sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('?', h.x, h.y - 22);
    }
  }
  // Pug
  ctx.fillStyle = '#c8854a';
  ctx.beginPath(); ctx.arc(pug.x, pug.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(pug.x - 3, pug.y - 2, 2, 2); ctx.fillRect(pug.x + 1, pug.y - 2, 2, 2);
  // fart cloud
  if (pug.fartT > 0) {
    ctx.fillStyle = `rgba(94,243,140,${pug.fartT / 1.5 * 0.6})`;
    ctx.beginPath(); ctx.arc(pug.x, pug.y + 6, 18, 0, Math.PI * 2); ctx.fill();
  }
  // sound ring
  if (pug.sound > 0) {
    ctx.strokeStyle = `rgba(255,210,63,${pug.sound})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 30 * (1 - pug.sound + 1), 0, Math.PI * 2); ctx.stroke();
  }
}

function updateHud() {
  const t = loot.filter((l) => l.taken).length;
  document.getElementById('hud-loot').textContent = `${t}/${loot.length}`;
  document.getElementById('hud-floor').textContent = floor;
  document.getElementById('hud-bark').textContent = barkCd > 0 ? barkCd.toFixed(1) + 's' : 'READY';
  document.getElementById('hud-fart').textContent = fartCd > 0 ? fartCd.toFixed(1) + 's' : 'READY';
  const best = loadBest('pug-heist');
  document.getElementById('hud-best').textContent = best ? best.floor : 0;
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  floor = 1; running = true;
  genFloor(floor);
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
