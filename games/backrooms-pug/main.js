// THE BACKROOMS OF PUG — top-down stealth horror.
// Procedural hallway maze, yellow tint. Giant pug roams; alerted by sound
// (running = loud; sneak = silent). Collect 5 cans + find EXIT.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'backrooms:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

let W = 0, H = 0, DPR = 1;
const TILE = 64;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

let cols = 0, rows = 0;
let grid = [];
let pug, monster, cans, exitTile, level, soundLevel, running, cam, monsterChaseT;
const keys = new Set();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function genLevel(lvl) {
  cols = 28 + lvl * 2;
  rows = 18 + lvl;
  grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  // Carve maze (recursive backtracker on odd cells)
  const stack = [];
  grid[1][1] = 0; stack.push([1, 1]);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]].sort(() => Math.random() - 0.5);
    let moved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
        grid[ny][nx] = 0;
        grid[y + dy / 2][x + dx / 2] = 0;
        stack.push([nx, ny]); moved = true; break;
      }
    }
    if (!moved) stack.pop();
  }
  // Knock out random extra walls for more openness
  for (let i = 0; i < cols * rows / 8; i++) {
    const x = 1 + Math.floor(Math.random() * (cols - 2));
    const y = 1 + Math.floor(Math.random() * (rows - 2));
    grid[y][x] = 0;
  }
  // Place pug at (1,1)
  pug = { x: 1.5 * TILE, y: 1.5 * TILE };
  // Place monster far away
  monster = { x: (cols - 2.5) * TILE, y: (rows - 2.5) * TILE, vx: 0, vy: 0, sees: false, chase: false, lastSeenX: 0, lastSeenY: 0 };
  // Cans
  cans = [];
  for (let i = 0; i < 5; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 6) {
        cans.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
        break;
      }
    }
  }
  // Exit (only opens after all cans)
  exitTile = { x: (cols - 2) * TILE + TILE / 2, y: (rows - 2) * TILE + TILE / 2 };
  soundLevel = 0; monsterChaseT = 0;
  cam = { x: pug.x, y: pug.y };
}

function isWallAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
  return grid[ty][tx] === 1;
}
function move(e, dx, dy, r = 12) {
  const nx = e.x + dx;
  if (!isWallAt(nx - r, e.y - r) && !isWallAt(nx + r, e.y - r) &&
      !isWallAt(nx - r, e.y + r) && !isWallAt(nx + r, e.y + r)) e.x = nx;
  const ny = e.y + dy;
  if (!isWallAt(e.x - r, ny - r) && !isWallAt(e.x + r, ny - r) &&
      !isWallAt(e.x - r, ny + r) && !isWallAt(e.x + r, ny + r)) e.y = ny;
}

function tick(dt) {
  if (!running) return;
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  const sneaking = keys.has('shift');
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const speed = sneaking ? 70 : 140;
    move(pug, (mx / l) * speed * dt, (my / l) * speed * dt);
    soundLevel = Math.min(1, soundLevel + (sneaking ? 0.05 : 1.2) * dt);
  } else {
    soundLevel = Math.max(0, soundLevel - dt);
  }

  cam.x += (pug.x - cam.x) * 6 * dt;
  cam.y += (pug.y - cam.y) * 6 * dt;

  // Cans pickup
  for (let i = cans.length - 1; i >= 0; i--) {
    if (Math.hypot(cans[i].x - pug.x, cans[i].y - pug.y) < 22) {
      cans.splice(i, 1);
      sfx.tone(880, 'triangle', 0.1, 0.18);
    }
  }
  // Exit check
  if (cans.length === 0 && Math.hypot(exitTile.x - pug.x, exitTile.y - pug.y) < 26) {
    level++;
    sfx.arp([523, 659, 784, 1047], 'triangle', 0.1, 0.22, 0.3);
    genLevel(level);
    return;
  }

  // Monster AI
  const distToPug = Math.hypot(monster.x - pug.x, monster.y - pug.y);
  const hears = soundLevel > 0.5 && distToPug < 420;
  // Line of sight check
  let sees = false;
  if (distToPug < 320) {
    const steps = 20;
    let blocked = false;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = monster.x + (pug.x - monster.x) * t;
      const sy = monster.y + (pug.y - monster.y) * t;
      if (isWallAt(sx, sy)) { blocked = true; break; }
    }
    if (!blocked) sees = true;
  }
  monster.sees = sees;
  if (sees || hears) {
    monster.lastSeenX = pug.x; monster.lastSeenY = pug.y;
    monsterChaseT = sees ? 5 : 2.5;
  }
  monster.chase = monsterChaseT > 0;
  if (monsterChaseT > 0) monsterChaseT -= dt;

  // Move monster
  const target = monster.chase ? { x: monster.lastSeenX, y: monster.lastSeenY } : null;
  if (target) {
    const dx = target.x - monster.x, dy = target.y - monster.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = sees ? 165 : 110; // monster faster than walking pug (140) when it sees you
      move(monster, (dx / d) * sp * dt, (dy / d) * sp * dt, 14);
    } else {
      monsterChaseT = 0; // arrived
    }
  } else {
    // Wander
    if (Math.random() < dt * 0.6) {
      const a = Math.random() * Math.PI * 2;
      monster.vx = Math.cos(a) * 40;
      monster.vy = Math.sin(a) * 40;
    }
    move(monster, monster.vx * dt, monster.vy * dt, 14);
  }

  // Caught?
  if (distToPug < 24) return die();
  updateHud();
}

function render() {
  // Yellow backrooms vibe
  ctx.fillStyle = '#3a2f10'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2 - cam.x, H / 2 - cam.y);
  const viewR = 240;
  // Floor
  ctx.fillStyle = '#b8a44a';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  // Wallpaper
  ctx.strokeStyle = '#5a4a14';
  ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) {
        ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }
  // Walls
  ctx.fillStyle = '#7a6a20';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  // Wallpaper pattern on walls
  ctx.fillStyle = '#9a8a40';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) {
        ctx.fillRect(x * TILE + 8, y * TILE + 8, 4, 4);
        ctx.fillRect(x * TILE + 32, y * TILE + 32, 4, 4);
      }
    }
  }
  // Cans
  for (const c of cans) {
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(c.x - 8, c.y - 10, 16, 20);
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(c.x - 8, c.y - 6, 16, 4);
    ctx.fillStyle = '#fff';
    ctx.font = "8px sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('DOG', c.x, c.y - 1);
  }
  // Exit (only if cans done)
  if (cans.length === 0) {
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 20;
    ctx.fillStyle = '#5ef38c';
    ctx.fillRect(exitTile.x - 20, exitTile.y - 28, 40, 56);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0a1018'; ctx.font = "12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitTile.x, exitTile.y + 4);
  }
  // Monster
  const mr = 22;
  ctx.fillStyle = '#1a0d05';
  ctx.beginPath(); ctx.arc(monster.x, monster.y, mr * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = monster.chase ? '#5a0d0d' : '#6b3a1c';
  ctx.beginPath(); ctx.arc(monster.x, monster.y, mr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = monster.chase ? '#ff3a3a' : '#ffd23f';
  ctx.fillRect(monster.x - 10, monster.y - 4, 5, 5);
  ctx.fillRect(monster.x + 4, monster.y - 4, 5, 5);
  ctx.fillStyle = '#000';
  ctx.fillRect(monster.x - 8, monster.y - 2, 2, 2);
  ctx.fillRect(monster.x + 6, monster.y - 2, 2, 2);
  // teeth
  ctx.fillStyle = '#fff';
  ctx.fillRect(monster.x - 6, monster.y + 8, 12, 2);
  ctx.fillRect(monster.x - 4, monster.y + 10, 1, 3);
  ctx.fillRect(monster.x, monster.y + 10, 1, 3);
  ctx.fillRect(monster.x + 4, monster.y + 10, 1, 3);
  // Pug player
  ctx.fillStyle = '#c8854a';
  ctx.beginPath(); ctx.arc(pug.x, pug.y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(pug.x - 3, pug.y - 2, 2, 2);
  ctx.fillRect(pug.x + 1, pug.y - 2, 2, 2);
  // Sound waves around pug
  if (soundLevel > 0.05) {
    ctx.strokeStyle = `rgba(255,210,63,${soundLevel * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 14 + soundLevel * 40, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // Dim vignette (you can only see clearly nearby)
  const grd = ctx.createRadialGradient(W / 2, H / 2, viewR * 0.4, W / 2, H / 2, viewR * 1.4);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
}

function updateHud() {
  document.getElementById('hud-cans').textContent = `${5 - cans.length}/5`;
  const state = monster.chase ? 'HUNTED!' : (soundLevel > 0.5 ? 'LOUD' : 'SAFE');
  const el = document.getElementById('hud-state');
  el.textContent = state;
  el.style.color = monster.chase ? '#ff3a3a' : (soundLevel > 0.5 ? '#ffd23f' : '#5ef38c');
  document.getElementById('hud-depth').textContent = `Level ${level}`;
  const best = loadBest('backrooms-pug');
  document.getElementById('hud-best').textContent = best ? best.level : 0;
}

function die() {
  running = false;
  sfx.sweep(110, 40, 'sawtooth', 1.0, 0.3);
  document.getElementById('end-title').textContent = 'SCREAMED';
  document.getElementById('end-sub').textContent = 'The giant pug found you.';
  document.getElementById('end-level').textContent = level;
  document.getElementById('end-cans').textContent = (level - 1) * 5 + (5 - cans.length);
  const { isNewBest, current } = submitRun('backrooms-pug', { score: level, level }, (a, b) => b.level - a.level);
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { level };
    bestEl.innerHTML = `Best: <b>level ${b.level}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  level = 1; running = true;
  genLevel(level);
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
      showTip('WASD walk · SHIFT to walk silently · find 5 cans, reach the EXIT', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
