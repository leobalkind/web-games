// PUG DUNGEON DIGGERS — dig through tiles, find treasure, upgrade.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'diggers:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

let W = 0, H = 0, DPR = 1;
const TILE = 36;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const TILE_TYPES = {
  air:    { color: null, val: 0, stam: 0 },
  dirt:   { color: '#6b3a1c', shade: '#4a2a0c', val: 0, stam: 1 },
  stone:  { color: '#5a5a72', shade: '#3a3a4a', val: 0, stam: 2 },
  cheese: { color: '#ffd23f', shade: '#c89c20', val: 0, stam: 2, biome: true },
  bone:   { icon: '🦴', val: 15, stam: 1 },
  toy:    { icon: '🧸', val: 25, stam: 1 },
  gold:   { icon: '🟡', val: 50, stam: 2 },
  biscuit:{ icon: '🟡', val: 100, stam: 3, golden: true },
  gem:    { icon: '💎', val: 60, stam: 2 },
};

let cols, rows = 0;
let grid = []; // [row][col] = type
let pug, money, depth, stam, maxStam, bag, maxBag, drillSpeed, drillCd;
let upgrades, running;

const UPGRADES = [
  { id: 'bag', name: 'Bigger Backpack', cost: 50, max: 5, apply: () => maxBag += 5 },
  { id: 'stam', name: 'Energy Drink', cost: 80, max: 5, apply: () => maxStam += 30 },
  { id: 'drill', name: 'Drill Speed', cost: 120, max: 3, apply: () => drillSpeed *= 1.3 },
  { id: 'helmet', name: 'Hard Hat', cost: 200, max: 2, apply: () => { /* reduces stone cost */ } },
];

function reset() {
  cols = Math.max(8, Math.floor(W / TILE));
  rows = 60;
  grid = Array.from({ length: rows }, () => Array(cols).fill('air'));
  // Surface row = air. Row 1 = ground level. Below = dirt/stone with treasures.
  for (let r = 2; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rand = Math.random();
      const depthFactor = r / rows;
      if (rand < 0.02 + depthFactor * 0.03) grid[r][c] = depthFactor < 0.4 ? 'bone' : 'gold';
      else if (rand < 0.04 + depthFactor * 0.02) grid[r][c] = 'toy';
      else if (rand < 0.06 && r > 20) grid[r][c] = 'gem';
      else if (rand < 0.07 && r > 35) grid[r][c] = 'biscuit';
      else if (r > 40 && Math.random() < 0.3) grid[r][c] = 'cheese';
      else if (r > 8 && Math.random() < 0.4) grid[r][c] = 'stone';
      else grid[r][c] = 'dirt';
    }
  }
  pug = { col: Math.floor(cols / 2), row: 1, x: 0, y: 0 };
  syncXY();
  money = 0; depth = 0; bag = 0;
  maxStam = 100; stam = maxStam; maxBag = 10;
  drillSpeed = 1; drillCd = 0;
  upgrades = { bag: 0, stam: 0, drill: 0, helmet: 0 };
  renderUpgrades();
  document.getElementById('upgrades').style.display = 'none';
}
function syncXY() { pug.x = pug.col * TILE + TILE / 2; pug.y = pug.row * TILE + TILE / 2; }

const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let touchAt = null;
canvas.addEventListener('touchstart', (e) => { touchAt = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchAt = e.touches[0]; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchAt = null);

let moveT = 0;
const MOVE_COOLDOWN = 0.14;

function tryMove(dc, dr) {
  if (drillCd > 0) return;
  const nc = pug.col + dc, nr = pug.row + dr;
  if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) return;
  const t = grid[nr][nc];
  if (t === 'air') {
    pug.col = nc; pug.row = nr;
    syncXY();
    drillCd = MOVE_COOLDOWN / drillSpeed;
  } else {
    // Dig
    const info = TILE_TYPES[t];
    if (info.icon) {
      // Treasure
      if (bag < maxBag) {
        bag++;
        money += info.val;
        sfx.tone(880, 'triangle', 0.1, 0.22);
      } else {
        sfx.tone(220, 'sawtooth', 0.1, 0.2); // bag full
        return;
      }
    } else {
      sfx.tone(330, 'square', 0.05, 0.15);
    }
    let cost = info.stam;
    if (t === 'stone' && upgrades.helmet > 0) cost = Math.max(1, cost - upgrades.helmet);
    if (stam < cost) return;
    stam -= cost;
    grid[nr][nc] = 'air';
    pug.col = nc; pug.row = nr;
    syncXY();
    drillCd = MOVE_COOLDOWN / drillSpeed;
  }
  if (pug.row > depth) depth = pug.row;
  // surface refill
  if (pug.row <= 1) {
    money += bag * 0; // already counted on pickup
    bag = 0;
    stam = maxStam;
    document.getElementById('upgrades').style.display = 'block';
  } else {
    document.getElementById('upgrades').style.display = 'none';
  }
  if (stam <= 0) end();
  updateHud();
}

function renderUpgrades() {
  const e = document.getElementById('upg-buttons');
  e.innerHTML = '';
  for (const u of UPGRADES) {
    const lvl = upgrades[u.id];
    const next = u.cost * (lvl + 1);
    const btn = document.createElement('button');
    btn.style.cssText = `background:rgba(0,0,0,0.4);color:var(--text);border:2px solid var(--border);border-radius:4px;padding:6px 10px;font-family:var(--font-display);font-size:0.45rem;cursor:pointer;`;
    btn.innerHTML = `${u.name}<br>Lv ${lvl}/${u.max} — $${next}`;
    if (lvl >= u.max) { btn.disabled = true; btn.style.opacity = 0.4; btn.innerHTML = `${u.name}<br>MAX`; }
    else if (money < next) { btn.disabled = true; btn.style.opacity = 0.5; }
    btn.addEventListener('click', () => {
      if (money < next || lvl >= u.max) return;
      money -= next;
      upgrades[u.id]++;
      u.apply();
      sfx.tone(660, 'triangle', 0.1, 0.22);
      renderUpgrades();
      updateHud();
    });
    e.appendChild(btn);
  }
}

function tick(dt) {
  if (!running) return;
  drillCd = Math.max(0, drillCd - dt);
  moveT += dt;
  if (drillCd > 0) return;
  let dc = 0, dr = 0;
  if (keys.has('w') || keys.has('arrowup')) dr -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dr += 1;
  if (keys.has('a') || keys.has('arrowleft')) dc -= 1;
  if (keys.has('d') || keys.has('arrowright')) dc += 1;
  if (touchAt) {
    const dx = touchAt.clientX - W / 2;
    const dy = touchAt.clientY - H / 2;
    if (Math.abs(dx) > Math.abs(dy)) dc = dx > 30 ? 1 : (dx < -30 ? -1 : 0);
    else dr = dy > 30 ? 1 : (dy < -30 ? -1 : 0);
  }
  if (dc !== 0 && dr !== 0) { if (Math.random() < 0.5) dr = 0; else dc = 0; }
  if (dc || dr) tryMove(dc, dr);
}

function render() {
  ctx.fillStyle = '#0a0716'; ctx.fillRect(0, 0, W, H);
  // Camera follows pug (centers on it vertically)
  const camY = pug.y - H / 2;
  const camX = 0;
  ctx.save();
  ctx.translate(-camX, -camY);
  // Sky for surface
  const skyTop = -H, skyBot = TILE * 2;
  const sky = ctx.createLinearGradient(0, skyTop, 0, skyBot);
  sky.addColorStop(0, '#22103f'); sky.addColorStop(1, '#3a2a5a');
  ctx.fillStyle = sky; ctx.fillRect(0, skyTop, W, skyBot - skyTop);
  // Tiles in viewport
  const rowStart = Math.max(0, Math.floor((camY) / TILE) - 1);
  const rowEnd = Math.min(rows - 1, Math.floor((camY + H) / TILE) + 1);
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === 'air') continue;
      const x = c * TILE, y = r * TILE;
      const info = TILE_TYPES[t];
      if (info.icon) {
        // Treasure tile = dirt background + icon
        ctx.fillStyle = TILE_TYPES.dirt.color; ctx.fillRect(x, y, TILE, TILE);
        ctx.font = `${TILE - 8}px serif`; ctx.textAlign = 'center';
        if (info.golden) {
          ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
          ctx.fillText('🟡', x + TILE / 2, y + TILE - 6);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillText(info.icon, x + TILE / 2, y + TILE - 6);
        }
      } else {
        ctx.fillStyle = info.color; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = info.shade; ctx.fillRect(x, y, TILE, 3);
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
        if (t === 'cheese') {
          // holes
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath(); ctx.arc(x + 10, y + 12, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 24, y + 22, 4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }
  // Surface ground line (top of dirt)
  ctx.fillStyle = '#2a4a2a';
  ctx.fillRect(0, TILE, W, 6);
  // Pug
  ctx.fillStyle = '#c8854a';
  ctx.beginPath(); ctx.arc(pug.x, pug.y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f'; // helmet
  ctx.fillRect(pug.x - 12, pug.y - 14, 24, 4);
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(pug.x - 4, pug.y - 3, 2, 2); ctx.fillRect(pug.x + 2, pug.y - 3, 2, 2);
  ctx.restore();
  // Depth indicator (right side)
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(W - 30, 80, 18, H - 160);
  ctx.fillStyle = '#5ef38c';
  const k = depth / rows;
  ctx.fillRect(W - 30, 80, 18, (H - 160) * k);
  ctx.fillStyle = '#fff'; ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
  ctx.fillText('DEPTH', W - 14, 72);
}

function updateHud() {
  document.getElementById('hud-money').textContent = '$' + money;
  document.getElementById('hud-depth').textContent = depth;
  document.getElementById('hud-stam').textContent = Math.floor(stam);
  document.getElementById('hud-bag').textContent = `${bag}/${maxBag}`;
  const best = loadBest('dungeon-diggers');
  document.getElementById('hud-best').textContent = best ? '$' + best.money : '$0';
  renderUpgrades();
}

function end() {
  running = false;
  sfx.sweep(330, 80, 'sawtooth', 0.5, 0.22);
  document.getElementById('end-money').textContent = '$' + money;
  document.getElementById('end-depth').textContent = depth;
  const { isNewBest, current } = submitRun('dungeon-diggers', { score: money, money, depth });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { money };
    bestEl.innerHTML = `Best: <b>$${b.money}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('upgrades').style.display = 'none';
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
  updateHud();
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
      showTip('WASD dig through dirt/stone · return to surface (top) to spend $', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
