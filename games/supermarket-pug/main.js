// SUPERMARKET PUG — top-down chaos heist.
// Walk a supermarket. Grab items (E or button). Knock shelves (SPACE).
// Shopping cart = speed boost but louder. Guards chase based on heat.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'mart:muted' });
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

const ITEMS = [
  { icon: '🥩', name: 'steak', val: 40 },
  { icon: '🍗', name: 'chicken', val: 20 },
  { icon: '🧀', name: 'cheese', val: 25 },
  { icon: '🥓', name: 'bacon', val: 30 },
  { icon: '🍕', name: 'pizza', val: 35 },
  { icon: '🍰', name: 'cake', val: 28 },
  { icon: '🦴', name: 'bone', val: 50 },
  { icon: '🍩', name: 'donut', val: 18 },
];

let pug, inCart, shelves, items, guards, exitZ, haul, bag, maxBag, heat, shelvesKnocked, running;
function reset() {
  pug = { x: W / 2, y: H - 80, vx: 0, vy: 0, ang: 0 };
  inCart = false;
  shelves = []; items = []; guards = []; exitZ = { x: W / 2, y: 40, r: 36 };
  haul = 0; bag = 0; maxBag = 8; heat = 0; shelvesKnocked = 0;
  // Generate shelf grid
  const rows = 4, cols = 5;
  const sw = 80, sh = 24, gx = (W - cols * 120) / 2, gy = 100;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sh1 = { x: gx + c * 120 + 20, y: gy + r * 100, w: sw, h: sh, hp: 2 };
      shelves.push(sh1);
      // Items on top of shelf
      for (let i = 0; i < 3; i++) {
        const it = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        items.push({ x: sh1.x + 12 + i * 22, y: sh1.y - 4, item: it, on: sh1, taken: false });
      }
    }
  }
  // Guards (2)
  guards.push({ x: 60, y: 60, vx: 0, vy: 0, ang: 0, alertT: 0, target: null });
  guards.push({ x: W - 60, y: 60, vx: 0, vy: 0, ang: 0, alertT: 0, target: null });
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === 'e' || e.key === 'E') grabNear();
  if (e.key === ' ' || e.code === 'Space') ram();
  if (e.key === 'c' || e.key === 'C') toggleCart();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
document.getElementById('cart-btn').addEventListener('click', toggleCart);
if ('ontouchstart' in window) document.getElementById('cart-btn').style.display = 'block';
let touchAt = null;
canvas.addEventListener('touchstart', (e) => { touchAt = e.touches[0]; grabNear(); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAt = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAt = null);

function grabNear() {
  if (!running) return;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.taken) continue;
    if (Math.hypot(it.x - pug.x, it.y - pug.y) < 30) {
      if (bag < maxBag) {
        it.taken = true;
        bag++;
        haul += it.item.val;
        sfx.tone(880, 'triangle', 0.07, 0.18);
        return;
      } else {
        sfx.tone(220, 'sawtooth', 0.08, 0.18);
        return;
      }
    }
  }
}

function ram() {
  if (!running) return;
  for (const s of shelves) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    if (Math.hypot(cx - pug.x, cy - pug.y) < 40) {
      s.hp--;
      heat = Math.min(1, heat + 0.18);
      sfx.tone(180, 'sawtooth', 0.1, 0.22);
      if (s.hp <= 0) {
        // Drop all items
        for (const it of items) {
          if (it.on === s && !it.taken) {
            it.y += 18;
            it.fallen = true;
          }
        }
        shelvesKnocked++;
        shelves = shelves.filter((x) => x !== s);
        sfx.tone(110, 'square', 0.2, 0.24);
      }
      return;
    }
  }
}

function toggleCart() {
  inCart = !inCart;
  heat = Math.min(1, heat + 0.1);
  sfx.tone(550, 'square', 0.06, 0.16);
}

function tick(dt) {
  if (!running) return;
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchAt) {
    mx = touchAt.clientX - pug.x; my = touchAt.clientY - pug.y;
    const l = Math.hypot(mx, my);
    if (l > 20) { mx /= l; my /= l; } else { mx = 0; my = 0; }
  }
  const speed = inCart ? 280 : 160;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    pug.vx += (mx / l) * speed * dt * 4;
    pug.vy += (my / l) * speed * dt * 4;
    pug.ang = Math.atan2(my, mx);
    if (inCart) heat = Math.min(1, heat + dt * 0.04);
  }
  // Shelf collision (block movement)
  pug.x += pug.vx * dt; pug.y += pug.vy * dt;
  pug.vx *= Math.pow(0.5, dt * 4); pug.vy *= Math.pow(0.5, dt * 4);
  for (const s of shelves) {
    if (pug.x + 14 > s.x && pug.x - 14 < s.x + s.w && pug.y + 14 > s.y && pug.y - 14 < s.y + s.h) {
      // push out (simple)
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const dx = pug.x - cx, dy = pug.y - cy;
      if (Math.abs(dx) > Math.abs(dy)) pug.x = dx > 0 ? s.x + s.w + 14 : s.x - 14;
      else pug.y = dy > 0 ? s.y + s.h + 14 : s.y - 14;
      pug.vx *= 0.5; pug.vy *= 0.5;
    }
  }
  pug.x = Math.max(20, Math.min(W - 20, pug.x));
  pug.y = Math.max(20, Math.min(H - 20, pug.y));
  // Heat decays slowly
  heat = Math.max(0, heat - dt * 0.05);
  // Guards
  for (const g of guards) {
    const dx = pug.x - g.x, dy = pug.y - g.y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    let diff = ang - g.ang;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const sees = d < 200 && Math.abs(diff) < 0.5;
    if (sees) { g.alertT = 3; heat = Math.min(1, heat + 0.4 * dt); }
    if (heat > 0.7) g.alertT = Math.max(g.alertT, 1.5);
    if (g.alertT > 0) {
      g.alertT -= dt;
      g.ang = ang;
      const gs = 140;
      g.x += (dx / d) * gs * dt; g.y += (dy / d) * gs * dt;
    } else {
      // patrol along x
      g.ang += dt * 0.4;
      g.x += Math.cos(g.ang) * 30 * dt;
      g.y += Math.sin(g.ang) * 30 * dt;
      g.x = Math.max(40, Math.min(W - 40, g.x));
      g.y = Math.max(40, Math.min(H - 100, g.y));
    }
    if (d < 22) return caught();
  }
  // Exit reach
  if (Math.hypot(exitZ.x - pug.x, exitZ.y - pug.y) < exitZ.r) {
    if (haul > 0) end(true);
  }
  updateHud();
}

function render() {
  // Tile floor
  ctx.fillStyle = '#3a3a4a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < H; y += 48) for (let x = 0; x < W; x += 48)
    if ((x + y) % 96 === 0) ctx.fillRect(x, y, 48, 48);
  // EXIT zone at top
  ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 16;
  ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(exitZ.x, exitZ.y, exitZ.r, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#5ef38c'; ctx.font = "14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('EXIT', exitZ.x, exitZ.y + 4);
  // Shelves
  for (const s of shelves) {
    ctx.fillStyle = s.hp > 1 ? '#5a3a1c' : '#3a2a14';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(s.x, s.y, s.w, 3);
  }
  // Items
  for (const it of items) {
    if (it.taken) continue;
    ctx.font = "18px serif"; ctx.textAlign = 'center';
    ctx.fillText(it.item.icon, it.x, it.y + 6);
  }
  // Guards
  for (const g of guards) {
    // vision cone
    ctx.fillStyle = `rgba(255,58,58,${g.alertT > 0 ? 0.3 : 0.15})`;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, 200, g.ang - 0.5, g.ang + 0.5);
    ctx.closePath(); ctx.fill();
    // body
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(g.x - 12, g.y - 12, 24, 24);
    ctx.fillStyle = '#fff';
    ctx.fillRect(g.x - 8, g.y - 18, 16, 8);
    // alert
    if (g.alertT > 0) {
      ctx.fillStyle = '#ff3a3a'; ctx.font = "16px sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 18);
    }
  }
  // Pug (and cart if active)
  if (inCart) {
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(pug.x - 22, pug.y - 14, 44, 28);
    ctx.fillStyle = '#1a0d05';
    ctx.fillRect(pug.x - 18, pug.y + 14, 8, 6);
    ctx.fillRect(pug.x + 10, pug.y + 14, 8, 6);
  }
  ctx.fillStyle = '#c8854a';
  ctx.beginPath(); ctx.arc(pug.x, pug.y - (inCart ? 6 : 0), 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(pug.x - 4, pug.y - 4 - (inCart ? 6 : 0), 2, 2);
  ctx.fillRect(pug.x + 2, pug.y - 4 - (inCart ? 6 : 0), 2, 2);
  // Heat bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - 100, 18, 200, 8);
  ctx.fillStyle = heat > 0.7 ? '#ff3a3a' : (heat > 0.4 ? '#ffd23f' : '#5ef38c');
  ctx.fillRect(W / 2 - 100, 18, 200 * heat, 8);
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('HEAT', W / 2, 14);
}

function updateHud() {
  document.getElementById('hud-haul').textContent = '$' + haul;
  document.getElementById('hud-bag').textContent = `${bag}/${maxBag}`;
  document.getElementById('hud-heat').textContent = Math.floor(heat * 100) + '%';
  document.getElementById('hud-shelves').textContent = shelvesKnocked;
  const best = loadBest('supermarket-pug');
  document.getElementById('hud-best').textContent = best ? '$' + best.haul : '$0';
}

function caught() { end(false); }
function end(escaped) {
  running = false;
  sfx.sweep(escaped ? 880 : 220, escaped ? 1320 : 80, escaped ? 'triangle' : 'sawtooth', 0.5, 0.25);
  document.getElementById('end-title').textContent = escaped ? 'CLEAN GETAWAY' : 'CAUGHT';
  document.getElementById('end-sub').textContent = escaped ? 'You made it to the parking lot.' : 'Security got you. The snacks are gone.';
  document.getElementById('end-haul').textContent = '$' + haul;
  document.getElementById('end-shelves').textContent = shelvesKnocked;
  const finalScore = haul + (escaped ? 100 : 0);
  const { isNewBest, current } = submitRun('supermarket-pug', { score: finalScore, haul });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { haul };
    bestEl.innerHTML = `Best: <b>$${b.haul}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
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
      showTip('WASD move · E grab item · SPACE ram shelf · C cart · reach EXIT', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
