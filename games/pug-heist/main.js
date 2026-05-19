// PUG HEIST SOCIETY — top-down stealth. Avoid human vision cones.
// Bark distracts a nearby human (look toward sound for ~2s).
// Fart boost = 1.5s speed burst but increases sound radius (humans turn to you).
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

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

// Loot types — varied values (rare = worth more)
const LOOT_TYPES = [
  { icon: '🦴', val: 50, rare: false },
  { icon: '🧀', val: 60, rare: false },
  { icon: '🧦', val: 30, rare: false },
  { icon: '🍖', val: 45, rare: false },
  { icon: '🥓', val: 55, rare: false },
  { icon: '🥪', val: 40, rare: false },
  { icon: '🎾', val: 35, rare: false },
  { icon: '👑', val: 200, rare: true },   // crown
  { icon: '💎', val: 150, rare: true },   // diamond
  { icon: '📺', val: 120, rare: true },   // remote
];
let pug, humans, walls, loot, exitZ, floor, barkCd, fartCd, running;
let smokeCd = 0, tongueCd = 0, decoyCd = 0;
let smokeBombs = []; // {x,y,t}
let particles = [];  // loot pickup particles
let alertedThisFloor = false;
let lootStolen = 0;
let totalLootValue = 0;
let lootValueThisFloor = 0;
let floorStartTime = 0;
let achievementsSeen = new Set();
let cats = [];

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
  // Cat ally: 30% chance per floor (helpful distraction NPC)
  cats = [];
  if (Math.random() < 0.3) {
    for (let tries = 0; tries < 20; tries++) {
      const x = 50 + Math.random() * (W - 100), y = 50 + Math.random() * (H - 100);
      if (!isWallNear(x, y, 18) && Math.hypot(x - pug.x, y - pug.y) > 120) {
        cats.push({ x, y, vx: 0, vy: 0, t: 0, distractT: 0 });
        break;
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
        // 12% rare drop chance
        const pool = Math.random() < 0.12 ? LOOT_TYPES.filter((t) => t.rare) : LOOT_TYPES.filter((t) => !t.rare);
        const ltype = pool[Math.floor(Math.random() * pool.length)];
        loot.push({ x, y, ...ltype, taken: false });
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
  smokeCd = 0; tongueCd = 0; decoyCd = 0;
  smokeBombs = []; particles = [];
  alertedThisFloor = false;
  lootValueThisFloor = 0;
  floorStartTime = performance.now();
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
  if (e.key === 'q' || e.key === 'Q') doSmoke();
  if (e.key === 'g' || e.key === 'G') doTongue();
  if (e.key === 't' || e.key === 'T') doDecoy();
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

function doSmoke() {
  if (smokeCd > 0 || !running) return;
  smokeCd = 7;
  // 3s smoke cloud at pug position, blocks vision cones in radius 90
  smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 3 });
  sfx.tone(330, 'sawtooth', 0.2, 0.2);
}
function doTongue() {
  if (tongueCd > 0 || !running) return;
  // Grab nearest visible loot within 180px
  let near = null, bestD = 180;
  for (const lt of loot) {
    if (lt.taken) continue;
    const d = Math.hypot(lt.x - pug.x, lt.y - pug.y);
    if (d < bestD) { bestD = d; near = lt; }
  }
  if (near) {
    near.taken = true;
    lootValueThisFloor += near.val;
    totalLootValue += near.val;
    lootStolen++;
    tongueCd = 4;
    sfx.tone(880, 'triangle', 0.1, 0.22);
    spawnParticles(near.x, near.y, '#ff5a82');
  } else {
    tongueCd = 1; // short cooldown on whiff
    sfx.tone(220, 'sawtooth', 0.08, 0.16);
  }
}
function doDecoy() {
  if (decoyCd > 0 || !running) return;
  decoyCd = 8;
  // Distract nearest human: walk away from pug for 4s
  let near = null, bestD = 280;
  for (const h of humans) {
    const d = Math.hypot(h.x - pug.x, h.y - pug.y);
    if (d < bestD) { bestD = d; near = h; }
  }
  if (near) {
    const ang = Math.atan2(near.y - pug.y, near.x - pug.x);
    near.distractTarget = { x: near.x + Math.cos(ang) * 220, y: near.y + Math.sin(ang) * 220 };
    near.state = 'distracted'; near.alertT = 4.0;
  }
  sfx.tone(440, 'square', 0.1, 0.2);
}
function spawnParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 80;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 0.6, t: 0, size: 3 });
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
      lootValueThisFloor += lt.val;
      totalLootValue += lt.val;
      lootStolen++;
      sfx.tone(lt.rare ? 1320 : 880, 'triangle', 0.1, 0.22);
      spawnParticles(lt.x, lt.y, lt.rare ? '#ffd23f' : '#5ef38c');
    }
  }
  // Gadget cooldown decay
  smokeCd = Math.max(0, smokeCd - dt);
  tongueCd = Math.max(0, tongueCd - dt);
  decoyCd = Math.max(0, decoyCd - dt);
  // Cat ally — wanders, periodically distracts a random human
  for (const c of cats) {
    c.t += dt;
    c.distractT -= dt;
    if (Math.random() < dt * 0.5) {
      const a = Math.random() * Math.PI * 2;
      c.vx = Math.cos(a) * 30; c.vy = Math.sin(a) * 30;
    }
    move(c, c.vx * dt, c.vy * dt, 8);
    // Every ~4s, distract one random human
    if (c.distractT <= 0 && humans.length > 0) {
      c.distractT = 4 + Math.random() * 3;
      const h = humans[Math.floor(Math.random() * humans.length)];
      h.distractTarget = { x: c.x, y: c.y };
      h.state = 'distracted';
      h.alertT = 2.0;
    }
  }
  // Smoke bombs
  for (let i = smokeBombs.length - 1; i >= 0; i--) {
    const s = smokeBombs[i];
    s.t += dt;
    if (s.t >= s.life) smokeBombs.splice(i, 1);
  }
  // Particles
  for (const p of particles) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95;
  }
  particles = particles.filter((p) => p.t < p.life);
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
        // Smoke blocks vision
        for (const sb of smokeBombs) {
          if (Math.hypot(sx - sb.x, sy - sb.y) < 90) { blocked = true; break; }
        }
        if (blocked) break;
      }
    }
    // Cone-color escalation: mark suspicion based on closeness
    if (inCone && d < 240) h._closeT = (h._closeT || 0) + dt; else h._closeT = Math.max(0, (h._closeT || 0) - dt);
    if (inCone && !blocked) { alertedThisFloor = true; caught(); }
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
  const g = calcGrade();
  document.getElementById('end-title').textContent = `CAUGHT! · GRADE ${g.grade}`;
  document.getElementById('end-sub').textContent = `${g.desc}. Final haul: $${totalLootValue}.`;
  document.getElementById('end-floor').textContent = floor;
  document.getElementById('end-loot').textContent = lootStolen;
  const score = floor * 100 + totalLootValue;
  const { isNewBest, current } = submitRun('pug-heist', { score, floor, value: totalLootValue });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { floor };
    bestEl.innerHTML = `Best: <b>${b.floor} floors · $${b.value || 0}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
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
  // Humans + vision cones (color shifts with suspicion)
  for (const h of humans) {
    // cone color: yellow safe → orange suspicious → red alerted
    const sus = Math.min(1, (h._closeT || 0) / 1.5);
    const alert = h.alertT > 0 ? 1 : 0;
    const r = Math.max(255, Math.floor(255));
    const g = alert ? 58 : Math.floor(210 - sus * 130);
    const b = alert ? 58 : Math.floor(63 - sus * 5);
    ctx.fillStyle = `rgba(${r},${g},${b},0.20)`;
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
  // Smoke bombs
  for (const sb of smokeBombs) {
    const a = sb.t < 0.4 ? sb.t / 0.4 : (sb.t > 2.5 ? (sb.life - sb.t) / 0.5 : 1);
    ctx.fillStyle = `rgba(60,60,60,${a * 0.7})`;
    ctx.beginPath(); ctx.arc(sb.x, sb.y, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(140,140,140,${a * 0.5})`;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + sb.t * 0.5;
      const rr = 60 + Math.sin(sb.t * 3 + i) * 10;
      ctx.beginPath(); ctx.arc(sb.x + Math.cos(ang) * rr, sb.y + Math.sin(ang) * rr, 18, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Particles
  for (const p of particles) {
    ctx.globalAlpha = 1 - p.t / p.life;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  // Cat allies
  for (const c of cats) {
    ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.arc(c.x, c.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(c.x - 7, c.y - 12, 3, 5); ctx.fillRect(c.x + 4, c.y - 12, 3, 5);
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(c.x - 3, c.y - 2, 2, 2); ctx.fillRect(c.x + 1, c.y - 2, 2, 2);
    // Indicator
    ctx.fillStyle = '#5ef38c'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('ALLY', c.x, c.y - 16);
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
  drawGadgetHud();
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

function drawGadgetHud() {
  const ox = W - 200, oy = H - 80;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(ox - 8, oy - 8, 190, 70);
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
  ctx.fillText('💨 SMOKE [Q]  ' + (smokeCd > 0 ? smokeCd.toFixed(1) + 's' : 'READY'), ox, oy + 8);
  ctx.fillText('👅 TONGUE [G] ' + (tongueCd > 0 ? tongueCd.toFixed(1) + 's' : 'READY'), ox, oy + 26);
  ctx.fillText('🦴 DECOY [T]  ' + (decoyCd > 0 ? decoyCd.toFixed(1) + 's' : 'READY'), ox, oy + 44);
  // Loot value running total
  ctx.fillStyle = '#ffd23f'; ctx.font = "11px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText(`$ ${totalLootValue}`, W - 16, 26);
}

function calcGrade() {
  const totalLoot = loot.length + lootStolen; // includes taken
  const collectedPct = lootStolen / Math.max(1, totalLoot);
  const undetected = !alertedThisFloor;
  if (collectedPct >= 0.95 && undetected) return { grade: 'S', desc: 'PERFECT HEIST' };
  if (collectedPct >= 0.85 && undetected) return { grade: 'A', desc: 'CLEAN' };
  if (collectedPct >= 0.6) return { grade: 'B', desc: 'GOOD' };
  if (collectedPct >= 0.4) return { grade: 'C', desc: 'MESSY' };
  return { grade: 'D', desc: 'ROUGH' };
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  floor = 1; running = true;
  lootStolen = 0; totalLootValue = 0; achievementsSeen = new Set();
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

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD sneak · avoid red vision cones · Q smoke · G tongue · T decoy', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
