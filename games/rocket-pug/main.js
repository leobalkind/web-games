// ROCKET PUG ARENA — 4 bot pugs in giant kitchen, absurd weapons.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'rocket:muted' });
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

const WEAPONS = [
  { id: 'tennis',   name: 'Tennis', icon: '🎾', cooldown: 0.4, speed: 480, dmg: 14, color: '#5ef38c', shape: 'ball' },
  { id: 'sausage',  name: 'Sausage', icon: '🌭', cooldown: 0.55, speed: 380, dmg: 22, color: '#ff8e3c', shape: 'sausage' },
  { id: 'toaster',  name: 'Toast', icon: '🍞', cooldown: 0.8, speed: 320, dmg: 30, color: '#ffd23f', shape: 'toast' },
  { id: 'bubble',   name: 'Bubble', icon: '🫧', cooldown: 0.3, speed: 240, dmg: 8, color: '#4cc9f0', shape: 'bubble' },
];

let pug, bots, projectiles, particles, kills, running, mouse;
function mkPug(x, y, isPlayer, color, mask) {
  return {
    x, y, vx: 0, vy: 0, hp: 100, maxHp: 100,
    isPlayer, color, mask, ang: 0,
    weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)],
    fireCd: 0,
    jetT: 0, jetCd: 0,
    targetAng: 0,
  };
}
function reset() {
  pug = mkPug(W / 2, H - 100, true, '#c8854a', '#1a0d05');
  pug.weapon = WEAPONS[0]; // start with tennis
  bots = [];
  const colors = [['#eac888','#6b3a1c'], ['#5a5a72','#222'], ['#fafaff','#a8a8c8'], ['#ff5a3a','#6a2a14']];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const r = Math.min(W, H) * 0.3;
    const c = colors[i];
    bots.push(mkPug(W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r, false, c[0], c[1]));
  }
  projectiles = []; particles = []; kills = 0;
  mouse = { x: W / 2, y: H / 2 };
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ') doJet();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
let firing = false;
canvas.addEventListener('mousedown', () => firing = true);
window.addEventListener('mouseup', () => firing = false);
canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; firing = true; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => firing = false);
document.getElementById('jet-btn').addEventListener('click', doJet);
if ('ontouchstart' in window) document.getElementById('jet-btn').style.display = 'block';

function doJet() {
  if (!running || pug.jetCd > 0) return;
  pug.jetT = 1.6;
  pug.jetCd = 5;
  sfx.tone(880, 'square', 0.3, 0.22);
}

function fire(shooter, ang) {
  if (shooter.fireCd > 0) return;
  shooter.fireCd = shooter.weapon.cooldown;
  const w = shooter.weapon;
  projectiles.push({
    x: shooter.x + Math.cos(ang) * 22, y: shooter.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
    owner: shooter, dmg: w.dmg, color: w.color, shape: w.shape, life: 2.0, ang,
  });
  sfx.tone(380 + Math.random() * 100, w.shape === 'bubble' ? 'sine' : 'square', 0.06, 0.18);
}

function tick(dt) {
  if (!running) return;
  // Player movement
  let mx = 0, my = 0;
  if (keys.has('w')) my -= 1;
  if (keys.has('s')) my += 1;
  if (keys.has('a')) mx -= 1;
  if (keys.has('d')) mx += 1;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const sp = (pug.jetT > 0 ? 480 : 220);
    pug.vx += (mx / l) * sp * dt * 3;
    pug.vy += (my / l) * sp * dt * 3;
  }
  pug.jetT = Math.max(0, pug.jetT - dt);
  pug.jetCd = Math.max(0, pug.jetCd - dt);
  pug.fireCd = Math.max(0, pug.fireCd - dt);
  // Aim
  pug.ang = Math.atan2(mouse.y - pug.y, mouse.x - pug.x);
  if (firing) fire(pug, pug.ang);

  // Bots AI
  for (const b of bots) {
    if (b.hp <= 0) continue;
    b.fireCd = Math.max(0, b.fireCd - dt);
    // pick nearest enemy (player or other bot)
    const all = [pug, ...bots.filter((x) => x !== b)];
    let target = null, bestD = Infinity;
    for (const o of all) {
      if (o.hp <= 0) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < bestD) { bestD = d; target = o; }
    }
    if (target) {
      const tx = target.x, ty = target.y;
      const angTo = Math.atan2(ty - b.y, tx - b.x);
      b.ang = angTo;
      if (bestD > 200) {
        b.vx += Math.cos(angTo) * 800 * dt;
        b.vy += Math.sin(angTo) * 800 * dt;
      } else if (bestD < 100) {
        b.vx -= Math.cos(angTo) * 700 * dt;
        b.vy -= Math.sin(angTo) * 700 * dt;
      } else {
        // strafe
        b.vx += Math.cos(angTo + Math.PI / 2) * 500 * dt;
        b.vy += Math.sin(angTo + Math.PI / 2) * 500 * dt;
      }
      fire(b, angTo);
    }
  }
  // Physics
  for (const p of [pug, ...bots]) {
    if (p.hp <= 0) continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.5, dt * 4); p.vy *= Math.pow(0.5, dt * 4);
    p.x = Math.max(30, Math.min(W - 30, p.x));
    p.y = Math.max(30, Math.min(H - 30, p.y));
  }
  // Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    if (pr.life <= 0 || pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) { projectiles.splice(i, 1); continue; }
    // Hit check
    for (const target of [pug, ...bots]) {
      if (target === pr.owner || target.hp <= 0) continue;
      const d = Math.hypot(target.x - pr.x, target.y - pr.y);
      if (d < 22) {
        target.hp -= pr.dmg;
        spawnHit(pr.x, pr.y, pr.color);
        sfx.tone(220, 'square', 0.05, 0.18);
        if (target.hp <= 0) {
          if (pr.owner === pug && target !== pug) kills++;
          spawnDeath(target.x, target.y, target.color);
          sfx.sweep(440, 110, 'sawtooth', 0.25, 0.22);
        }
        projectiles.splice(i, 1);
        break;
      }
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.t >= p.life) particles.splice(i, 1);
  }
  // End check
  if (pug.hp <= 0) return end(false);
  if (bots.every((b) => b.hp <= 0)) return end(true);
  updateHud();
}

function spawnHit(x, y, color) {
  for (let i = 0; i < 6; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 100;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color, life: 0.3, t: 0, size: 3 });
  }
}
function spawnDeath(x, y, color) {
  for (let i = 0; i < 16; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 200;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color, life: 0.8, t: 0, size: 4 });
  }
}

function render() {
  // Kitchen floor
  ctx.fillStyle = '#5a3a1c'; ctx.fillRect(0, 0, W, H);
  // tiles
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < H; y += 48) for (let x = 0; x < W; x += 48)
    if ((x + y) % 96 === 0) ctx.fillRect(x, y, 48, 48);
  // Kitchen obstacles (sketch)
  ctx.fillStyle = '#3a2a14';
  ctx.fillRect(W * 0.2, H * 0.2, 60, 60); // table
  ctx.fillRect(W * 0.7, H * 0.6, 80, 40);
  // pugs
  for (const p of [pug, ...bots]) {
    if (p.hp <= 0) continue;
    // body
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.mask;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - 8, p.y - 4, 3, 3); ctx.fillRect(p.x + 4, p.y - 4, 3, 3);
    // weapon
    ctx.font = "16px serif"; ctx.textAlign = 'center';
    ctx.fillText(p.weapon.icon, p.x + Math.cos(p.ang) * 22, p.y + Math.sin(p.ang) * 22 + 5);
    // hp bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 18, p.y - 28, 36, 4);
    ctx.fillStyle = p.hp > 50 ? '#5ef38c' : (p.hp > 25 ? '#ffd23f' : '#ff3a3a');
    ctx.fillRect(p.x - 18, p.y - 28, 36 * Math.max(0, p.hp) / p.maxHp, 4);
    // jetpack flame
    if (p === pug && pug.jetT > 0) {
      ctx.fillStyle = '#ff8e3c';
      ctx.fillRect(p.x - 3, p.y + 16, 6, 12);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(p.x - 2, p.y + 16, 4, 6);
    }
  }
  // Projectiles
  for (const pr of projectiles) {
    if (pr.shape === 'ball') {
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
    } else if (pr.shape === 'sausage') {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang);
      ctx.fillStyle = pr.color; ctx.fillRect(-10, -3, 20, 6);
      ctx.restore();
    } else if (pr.shape === 'toast') {
      ctx.fillStyle = pr.color; ctx.fillRect(pr.x - 6, pr.y - 8, 12, 16);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(pr.x - 6, pr.y - 8, 12, 2);
      ctx.fillRect(pr.x - 6, pr.y + 6, 12, 2);
    } else if (pr.shape === 'bubble') {
      ctx.strokeStyle = pr.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,0.3)`;
      ctx.beginPath(); ctx.arc(pr.x - 3, pr.y - 3, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Particles
  for (const p of particles) {
    ctx.globalAlpha = 1 - (p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  // Aim line for player
  if (running && pug.hp > 0) {
    ctx.strokeStyle = 'rgba(255,210,63,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(pug.x, pug.y); ctx.lineTo(pug.x + Math.cos(pug.ang) * 200, pug.y + Math.sin(pug.ang) * 200); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function updateHud() {
  document.getElementById('hud-hp').textContent = Math.max(0, Math.ceil(pug.hp));
  document.getElementById('hud-kills').textContent = kills;
  document.getElementById('hud-left').textContent = bots.filter((b) => b.hp > 0).length;
  document.getElementById('hud-weapon').textContent = pug.weapon.name;
  document.getElementById('hud-jet').textContent = pug.jetCd > 0 ? pug.jetCd.toFixed(1) + 's' : 'READY';
  const best = loadBest('rocket-pug');
  document.getElementById('hud-best').textContent = best ? best.kills : 0;
}

function end(won) {
  running = false;
  document.getElementById('end-title').textContent = won ? 'LAST PUG STANDING' : 'YOU GOT TOASTED';
  document.getElementById('end-sub').textContent = won ? 'The kitchen is yours.' : 'Try a different weapon next time.';
  document.getElementById('end-kills').textContent = kills;
  const { isNewBest, current } = submitRun('rocket-pug', { score: kills, kills, won });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { kills };
    bestEl.innerHTML = `Best: <b>${b.kills} kills</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
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
      showTip('WASD move · MOUSE aim · CLICK fire · SPACE = jetpack burst', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
