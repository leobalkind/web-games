// PUG TOWER DEFENSE — grid path, 6 tower classes, 15 scaling waves.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'td:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

let W = 0, H = 0, DPR = 1, TILE = 0;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // Fit grid: leave room for HUD top + bar bottom
  TILE = Math.floor(Math.min((W - 16) / GRID_W, (H - 200) / GRID_H));
  TILE = Math.max(32, Math.min(64, TILE));
}
const GRID_W = 18, GRID_H = 11;

// 3 selectable maps, each with its own snaking path
const MAPS = {
  classic: {
    name: 'CLASSIC',
    desc: 'snaking S-curve',
    path: [
      [0,2],[1,2],[2,2],[3,2],[3,3],[3,4],[3,5],[4,5],[5,5],[6,5],[6,4],[6,3],[6,2],[7,2],[8,2],[9,2],[9,3],[9,4],[9,5],[9,6],[9,7],[9,8],[10,8],[11,8],[12,8],[12,7],[12,6],[12,5],[12,4],[12,3],[13,3],[14,3],[15,3],[16,3],[17,3],
    ],
  },
  spiral: {
    name: 'SPIRAL',
    desc: 'inward spiral, choke at center',
    path: [
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],
      [17,1],[17,2],[17,3],[17,4],[17,5],[17,6],[17,7],[17,8],[17,9],[17,10],
      [16,10],[15,10],[14,10],[13,10],[12,10],[11,10],[10,10],[9,10],[8,10],[7,10],[6,10],[5,10],[4,10],[3,10],[2,10],[1,10],[0,10],
      [0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[0,3],[0,2],
      [1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],
      [9,3],[9,4],[9,5],[9,6],[9,7],[9,8],
      [10,8],[11,8],[12,8],[13,8],[14,8],[15,8],
      [15,7],[15,6],[15,5],
      [14,5],[13,5],[12,5],[11,5],
    ],
  },
  zigzag: {
    name: 'ZIGZAG',
    desc: 'tight back-and-forth',
    path: [
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],
      [5,2],[5,3],
      [4,3],[3,3],[2,3],[1,3],[0,3],
      [0,4],[0,5],
      [1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],
      [7,6],[7,7],
      [6,7],[5,7],[4,7],[3,7],[2,7],[1,7],[0,7],
      [0,8],[0,9],
      [1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],
      [14,8],[14,7],[14,6],[14,5],[14,4],[14,3],
      [15,3],[16,3],[17,3],
    ],
  },
  corridor: {
    name: 'CORRIDOR',
    desc: 'long straight, few tower spots',
    path: [
      [0,5],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[12,5],[13,5],[14,5],[15,5],[16,5],[17,5],
    ],
  },
  loop: {
    name: 'LOOP',
    desc: 'circular path, inner kill-box',
    path: [
      [0,4],[1,4],[2,4],[3,4],[4,4],
      [4,5],[4,6],
      [5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],
      [13,5],[13,4],[13,3],[13,2],
      [12,2],[11,2],[10,2],[9,2],[8,2],[7,2],[6,2],[5,2],[4,2],
      [4,3],[4,4],
      [5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
      [10,5],
      [11,5],[12,5],[13,5],[14,5],[15,5],[16,5],[17,5],
    ],
  },
  uturn: {
    name: 'U-TURN',
    desc: 'sharp double-back at midfield',
    path: [
      [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[10,3],[11,3],[12,3],[13,3],[14,3],[15,3],[16,3],
      [16,4],[16,5],[16,6],[16,7],
      [15,7],[14,7],[13,7],[12,7],[11,7],[10,7],[9,7],[8,7],[7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],
      [1,8],[1,9],
      [2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[16,9],[17,9],
    ],
  },
  edge: {
    name: 'EDGE',
    desc: 'hugs the border, big open center',
    path: [
      [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[13,0],[14,0],[15,0],[16,0],[17,0],
      [17,1],[17,2],[17,3],[17,4],[17,5],[17,6],[17,7],[17,8],[17,9],[17,10],
      [16,10],[15,10],[14,10],[13,10],[12,10],[11,10],[10,10],[9,10],[8,10],[7,10],[6,10],[5,10],[4,10],[3,10],[2,10],[1,10],[0,10],
      [0,9],[0,8],[0,7],[0,6],[0,5],[0,4],[0,3],
    ],
  },
  cross: {
    name: 'CROSS',
    desc: 'path crosses itself — overlap fire',
    path: [
      [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],
      [7,3],[7,4],[7,5],[7,6],[7,7],[7,8],
      [8,8],[9,8],[10,8],[11,8],[12,8],
      [12,7],[12,6],[12,5],[12,4],[12,3],[12,2],
      [11,2],[10,2],[9,2],[8,2],[7,2],
      [7,3],
      [6,3],[5,3],[4,3],[3,3],
      [3,4],[3,5],[3,6],[3,7],[3,8],[3,9],
      [4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[16,9],[17,9],
    ],
  },
  funnel: {
    name: 'FUNNEL',
    desc: 'wide entry funnels into a single line',
    path: [
      [0,0],[1,0],[2,0],[3,0],[4,0],
      [4,1],[4,2],[4,3],[4,4],
      [5,4],[6,4],[7,4],
      [7,3],[7,2],[7,1],[7,0],
      [8,0],[9,0],[10,0],
      [10,1],[10,2],[10,3],[10,4],
      [11,4],[12,4],[13,4],
      [13,5],[13,6],[13,7],
      [12,7],[11,7],[10,7],[9,7],[8,7],[7,7],[6,7],[5,7],[4,7],[3,7],[2,7],[1,7],[0,7],
      [0,8],[0,9],
      [1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],[12,9],[13,9],[14,9],[15,9],[16,9],[17,9],
    ],
  },
};
let currentMap = MAPS.classic;
function isPath(c, r) { return currentMap.path.some((p) => p[0] === c && p[1] === r); }

const TOWERS = {
  basic:  { name: 'Bork', icon: '🐶', cost: 30, range: 3.0, dmg: 8,  cd: 0.5, color: '#4cc9f0', hitsAir: true, projColor: '#4cc9f0', desc: 'Cheap balanced shots' },
  sniper: { name: 'Snoot', icon: '👃', cost: 80, range: 6.5, dmg: 45, cd: 1.5, color: '#ffd23f', hitsAir: true, projColor: '#ffd23f', desc: 'Long range, high dmg' },
  gatling:{ name: 'Gat', icon: '🎯', cost: 100, range: 2.6, dmg: 4,  cd: 0.1, color: '#ff8e3c', hitsAir: true, projColor: '#ff8e3c', desc: 'Spray of bullets' },
  cannon: { name: 'Cannon', icon: '💥', cost: 120, range: 3.0, dmg: 25, cd: 1.2, color: '#ff3a3a', hitsAir: false, splash: 1.4, projColor: '#ff3a3a', desc: 'Splash dmg, ground only' },
  frost:  { name: 'Frost', icon: '🧊', cost: 75, range: 2.8, dmg: 3,  cd: 0.4, color: '#b0e8ff', hitsAir: true, slow: 0.4, slowDur: 1.5, projColor: '#b0e8ff', desc: 'Slows enemies' },
  buff:   { name: 'Buff', icon: '⭐', cost: 90, range: 2.5, dmg: 0,  cd: 0.5, color: '#b055ff', hitsAir: false, buff: 1.4, desc: 'Boosts nearby towers +40%' },
  // NEW towers
  bone:   { name: 'Bone', icon: '🦴', cost: 110, range: 3.5, dmg: 12, cd: 0.7, color: '#eae0c0', hitsAir: true, projColor: '#eae0c0', boomerang: true, desc: 'Boomerang hits twice' },
  tar:    { name: 'Tar', icon: '🛢', cost: 95, range: 2.5, dmg: 6,  cd: 0.55, color: '#222228', hitsAir: false, projColor: '#222228', tarPool: true, slow: 0.5, slowDur: 2.2, desc: 'Drops slow-pools on ground' },
};

const TARGETING_MODES = ['FIRST', 'LAST', 'STRONG', 'CLOSE'];
const TARGETING_LABEL = { FIRST: 'first on path', LAST: 'last on path', STRONG: 'highest HP', CLOSE: 'closest' };

const ENEMIES = {
  squirrel: { name: 'squirrel', hp: 14, speed: 1.6, gold: 5,  color: '#a06030', size: 10, air: false },
  cat:      { name: 'cat',      hp: 40, speed: 1.0, gold: 10, color: '#222',    size: 12, air: false },
  tank:     { name: 'tank',     hp: 180, speed: 0.6, gold: 25, color: '#5a3a14', size: 16, air: false },
  bird:     { name: 'bird',     hp: 30, speed: 1.8, gold: 12, color: '#5ef38c', size: 11, air: true },
  boss:     { name: 'BOSS',     hp: 1500, speed: 0.5, gold: 250, color: '#b055ff', size: 22, air: false },
};

const WAVES = [
  { squirrel: 8 },
  { squirrel: 12, cat: 2 },
  { squirrel: 14, cat: 4 },
  { cat: 10, bird: 4 },
  { squirrel: 20, tank: 1 },
  { cat: 12, bird: 8 },
  { tank: 4, squirrel: 16 },
  { bird: 12, cat: 8 },
  { tank: 8, cat: 8 },
  { squirrel: 30, bird: 6 },
  { tank: 6, bird: 10, cat: 10 },
  { bird: 18, tank: 4 },
  { tank: 12, squirrel: 25 },
  { tank: 8, cat: 20, bird: 14 },
  { boss: 1, tank: 10, bird: 10 },
];

let money, lives, waveIdx, enemies, towers, projectiles, particles, running, spawnQueue, spawnT, betweenWaveT, inWave, selectedTowerType, selectedTower;

function reset() {
  money = 100; lives = 10; waveIdx = 0;
  enemies = []; towers = []; projectiles = []; particles = [];
  spawnQueue = []; spawnT = 0; betweenWaveT = 0; inWave = false;
  selectedTowerType = null; selectedTower = null;
}

function buildBar() {
  const bar = document.getElementById('td-bar');
  bar.innerHTML = '';
  for (const [id, t] of Object.entries(TOWERS)) {
    const el = document.createElement('div');
    el.className = 'tw-pick' + (selectedTowerType === id ? ' selected' : '') + (money < t.cost ? ' disabled' : '');
    el.innerHTML = `<div class="tw-pick__icon">${t.icon}</div><div>${t.name}</div><div class="tw-pick__cost">$${t.cost}</div>`;
    el.addEventListener('click', () => {
      if (money < t.cost) return;
      selectedTowerType = selectedTowerType === id ? null : id;
      selectedTower = null; hidePopup();
      buildBar();
    });
    bar.appendChild(el);
  }
  const wv = document.createElement('button');
  wv.id = 'td-wave-btn';
  wv.textContent = inWave ? `WAVE ${waveIdx} RUNNING` : `▶ START WAVE ${waveIdx + 1}/${WAVES.length}`;
  wv.disabled = inWave;
  if (inWave) wv.style.opacity = 0.5;
  wv.addEventListener('click', () => { if (!inWave && waveIdx < WAVES.length) startWave(); });
  bar.appendChild(wv);
}

function hidePopup() { document.getElementById('tower-popup').style.display = 'none'; }
function showTowerPopup(t) {
  const el = document.getElementById('tower-popup');
  const def = TOWERS[t.type];
  const upCost = Math.floor(def.cost * 0.75 * (t.level + 1));
  el.innerHTML = `
    <div class="row"><b>${def.icon} ${def.name}</b><span>Lv ${t.level + 1}</span></div>
    <div class="row"><span>DMG</span><b>${(def.dmg * (1 + t.level * 0.5)).toFixed(0)}</b></div>
    <div class="row"><span>RANGE</span><b>${(def.range * (1 + t.level * 0.15)).toFixed(1)}</b></div>
    <div class="row"><span>RATE</span><b>${(1 / (def.cd / (1 + t.level * 0.2))).toFixed(1)}/s</b></div>
    <div class="row"><span>TARGET</span><b id="targ-label">${t.targeting || 'FIRST'} · ${TARGETING_LABEL[t.targeting || 'FIRST']}</b></div>
    <button id="targ-btn">↻ CHANGE TARGETING</button>
    <button id="up-btn">⬆ UPGRADE — $${upCost}</button>
    <button id="sell-btn" class="sell">SELL — $${Math.floor(t.totalCost * 0.6)}</button>
  `;
  el.style.display = 'block';
  document.getElementById('targ-btn').addEventListener('click', () => {
    const cur = TARGETING_MODES.indexOf(t.targeting || 'FIRST');
    t.targeting = TARGETING_MODES[(cur + 1) % TARGETING_MODES.length];
    sfx.tone(550, 'square', 0.06, 0.16);
    showTowerPopup(t);
  });
  document.getElementById('up-btn').addEventListener('click', () => {
    if (money < upCost || t.level >= 3) return;
    money -= upCost; t.level++; t.totalCost += upCost;
    sfx.tone(660, 'triangle', 0.1, 0.22);
    showTowerPopup(t); updateHud();
  });
  document.getElementById('sell-btn').addEventListener('click', () => {
    money += Math.floor(t.totalCost * 0.6);
    towers = towers.filter((x) => x !== t);
    selectedTower = null;
    hidePopup(); buildBar(); updateHud();
  });
}

canvas.addEventListener('mousedown', (e) => handleClick(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; handleClick(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
function gridOffsetX() { return Math.floor((W - GRID_W * TILE) / 2); }
function gridOffsetY() { return 60; }
function handleClick(x, y) {
  if (!running) return;
  const c = Math.floor((x - gridOffsetX()) / TILE);
  const r = Math.floor((y - gridOffsetY()) / TILE);
  if (c < 0 || r < 0 || c >= GRID_W || r >= GRID_H) { hidePopup(); selectedTower = null; return; }
  // Check existing tower at cell
  const existing = towers.find((t) => t.col === c && t.row === r);
  if (existing) {
    selectedTower = existing;
    selectedTowerType = null;
    showTowerPopup(existing);
    buildBar();
    return;
  }
  // If a tower type is selected and cell is buildable, place
  if (selectedTowerType && !isPath(c, r)) {
    const t = TOWERS[selectedTowerType];
    if (money < t.cost) return;
    money -= t.cost;
    towers.push({ type: selectedTowerType, col: c, row: r, cd: 0, level: 0, totalCost: t.cost, targeting: 'FIRST', bob: Math.random() * Math.PI * 2 });
    sfx.tone(880, 'triangle', 0.08, 0.22);
    selectedTowerType = null;
    buildBar(); updateHud();
  } else {
    hidePopup(); selectedTower = null;
  }
}

function startWave() {
  if (inWave || waveIdx >= WAVES.length) return;
  // Bonus money for calling early
  if (betweenWaveT > 0) money += Math.floor(betweenWaveT * 5);
  const wv = WAVES[waveIdx];
  spawnQueue = [];
  for (const [type, count] of Object.entries(wv)) {
    for (let i = 0; i < count; i++) spawnQueue.push(type);
  }
  // Shuffle spawn order
  spawnQueue.sort(() => Math.random() - 0.5);
  inWave = true; spawnT = 0;
  waveIdx++;
  buildBar();
}

function spawnEnemy(typeId) {
  const def = ENEMIES[typeId];
  enemies.push({
    type: typeId, def,
    hp: def.hp * (1 + waveIdx * 0.05),
    maxHp: def.hp * (1 + waveIdx * 0.05),
    speed: def.speed,
    slowT: 0, slowMul: 1,
    pathIdx: 0,
    x: currentMap.path[0][0] + 0.5, y: currentMap.path[0][1] + 0.5,
    alive: true,
  });
}

function tick(dt) {
  if (!running) return;
  // Spawn
  if (inWave) {
    spawnT -= dt;
    if (spawnT <= 0 && spawnQueue.length > 0) {
      spawnEnemy(spawnQueue.shift());
      spawnT = 0.4;
    }
    if (spawnQueue.length === 0 && enemies.every((e) => !e.alive)) {
      inWave = false;
      betweenWaveT = 5;
      // bonus
      money += 20 + waveIdx * 5;
      sfx.arp([523, 659, 784], 'triangle', 0.08, 0.22, 0.25);
      if (waveIdx >= WAVES.length) return end(true);
      buildBar();
    }
  } else if (betweenWaveT > 0) {
    betweenWaveT -= dt;
  }

  // Enemies move
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
    const target = currentMap.path[e.pathIdx + 1];
    if (!target) {
      // Reached end
      e.alive = false;
      lives--;
      sfx.sweep(220, 110, 'sawtooth', 0.2, 0.2);
      if (lives <= 0) return end(false);
      continue;
    }
    const tx = target[0] + 0.5, ty = target[1] + 0.5;
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    const sp = e.speed * e.slowMul;
    if (d < sp * dt) {
      e.x = tx; e.y = ty;
      e.pathIdx++;
    } else {
      e.x += (dx / d) * sp * dt;
      e.y += (dy / d) * sp * dt;
    }
  }
  enemies = enemies.filter((e) => e.alive);

  // Towers fire
  for (const tw of towers) {
    const def = TOWERS[tw.type];
    if (def.buff) continue; // buff towers don't fire
    tw.cd -= dt;
    if (tw.cd > 0) continue;
    // find a buff
    let buffMult = 1;
    for (const b of towers) {
      if (b === tw) continue;
      const bd = TOWERS[b.type];
      if (bd.buff && Math.hypot(b.col - tw.col, b.row - tw.row) <= bd.range) {
        buffMult = Math.max(buffMult, bd.buff);
      }
    }
    const range = def.range * (1 + tw.level * 0.15);
    // Targeting selection — FIRST (most progress), LAST, STRONG (highest HP), CLOSE (smallest dist)
    let target = null;
    const inRange = [];
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.def.air && !def.hitsAir) continue;
      const d = Math.hypot(e.x - (tw.col + 0.5), e.y - (tw.row + 0.5));
      if (d <= range) inRange.push({ e, d });
    }
    if (inRange.length === 0) continue;
    const mode = tw.targeting || 'FIRST';
    if (mode === 'FIRST') target = inRange.reduce((a, b) => (a.e.pathIdx > b.e.pathIdx ? a : b)).e;
    else if (mode === 'LAST') target = inRange.reduce((a, b) => (a.e.pathIdx < b.e.pathIdx ? a : b)).e;
    else if (mode === 'STRONG') target = inRange.reduce((a, b) => (a.e.hp > b.e.hp ? a : b)).e;
    else target = inRange.reduce((a, b) => (a.d < b.d ? a : b)).e;
    // Fire
    const dmg = def.dmg * (1 + tw.level * 0.5) * buffMult;
    tw.cd = def.cd / (1 + tw.level * 0.2);
    projectiles.push({
      x: (tw.col + 0.5) * TILE + gridOffsetX(),
      y: (tw.row + 0.5) * TILE + gridOffsetY(),
      target, dmg, color: def.projColor,
      splash: def.splash || 0,
      slow: def.slow || 0, slowDur: def.slowDur || 0,
      boomerang: !!def.boomerang,
      speed: 800, dead: false,
      origX: (tw.col + 0.5) * TILE + gridOffsetX(),
      origY: (tw.row + 0.5) * TILE + gridOffsetY(),
    });
    sfx.tone(440 + Math.random() * 200, def.cannon ? 'sawtooth' : 'square', 0.04, 0.12);
  }
  // Projectiles
  for (const p of projectiles) {
    if (p.dead) continue;
    const tx = p.target.x * TILE + gridOffsetX();
    const ty = p.target.y * TILE + gridOffsetY();
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 10 || !p.target.alive) {
      // Hit
      if (p.splash > 0) {
        for (const e of enemies) {
          if (!e.alive) continue;
          const dd = Math.hypot(e.x * TILE + gridOffsetX() - tx, e.y * TILE + gridOffsetY() - ty);
          if (dd < p.splash * TILE) e.hp -= p.dmg;
        }
        particles.push({ x: tx, y: ty, t: 0, life: 0.4, ring: true, maxR: p.splash * TILE, color: p.color });
      } else if (p.target.alive) {
        p.target.hp -= p.dmg;
        if (p.slow > 0) {
          p.target.slowMul = Math.min(p.target.slowMul, 1 - p.slow);
          p.target.slowT = p.slowDur;
        }
        // Boomerang: queue a second hit 0.4s later on whatever is closest to origin
        if (p.boomerang) {
          setTimeout(() => {
            let best = null, bestD = Infinity;
            for (const e of enemies) {
              if (!e.alive) continue;
              const d = Math.hypot(e.x * TILE + gridOffsetX() - p.origX, e.y * TILE + gridOffsetY() - p.origY);
              if (d < bestD) { bestD = d; best = e; }
            }
            if (best && best.alive) {
              best.hp -= p.dmg * 0.7;
              particles.push({ x: best.x * TILE + gridOffsetX(), y: best.y * TILE + gridOffsetY(), t: 0, life: 0.3, ring: true, maxR: 14, color: p.color });
            }
          }, 400);
        }
      }
      p.dead = true;
      for (const e of enemies) {
        if (e.hp <= 0 && e.alive) {
          e.alive = false;
          money += e.def.gold;
          sfx.tone(660, 'triangle', 0.05, 0.16);
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 60 + Math.random() * 80;
            particles.push({ x: e.x * TILE + gridOffsetX(), y: e.y * TILE + gridOffsetY(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: e.def.color, life: 0.4, t: 0, size: 4 });
          }
        }
      }
      continue;
    }
    p.x += (dx / d) * p.speed * dt;
    p.y += (dy / d) * p.speed * dt;
  }
  projectiles = projectiles.filter((p) => !p.dead);
  // Particles
  for (const p of particles) {
    p.t += dt;
    if (!p.ring) { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.vx *= 0.94; p.vy *= 0.94; }
  }
  particles = particles.filter((p) => p.t < p.life);
  updateHud();
}

function render() {
  ctx.fillStyle = '#1a0f2e'; ctx.fillRect(0, 0, W, H);
  const ox = gridOffsetX(), oy = gridOffsetY();
  // Cells
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const x = ox + c * TILE, y = oy + r * TILE;
      if (isPath(c, r)) {
        ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x, y, TILE, 3);
      } else {
        ctx.fillStyle = '#3a5a3a'; ctx.fillRect(x, y, TILE, TILE);
        // grass tufts
        ctx.fillStyle = '#5ef38c';
        ctx.fillRect(x + 6, y + 8, 2, 4);
        ctx.fillRect(x + TILE - 10, y + TILE - 12, 2, 4);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
  // Spawn marker (left edge)
  ctx.fillStyle = '#ff3aa1'; ctx.font = "12px sans-serif"; ctx.textAlign = 'center';
  ctx.fillText('▶', ox - 14, oy + (currentMap.path[0][1] + 0.5) * TILE + 4);
  // Vault (end)
  const last = currentMap.path[currentMap.path.length - 1];
  const vx = ox + last[0] * TILE + TILE / 2;
  const vy = oy + last[1] * TILE + TILE / 2;
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(vx - 18, vy - 18, 36, 36);
  ctx.fillStyle = '#c89c20';
  ctx.fillRect(vx - 18, vy + 12, 36, 6);
  ctx.fillStyle = '#000'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('🦴', vx, vy + 4);
  ctx.fillText('VAULT', vx, vy + 22);

  // Towers
  for (const tw of towers) {
    const def = TOWERS[tw.type];
    const x = ox + tw.col * TILE + TILE / 2;
    const y = oy + tw.row * TILE + TILE / 2;
    // Range halo
    if (selectedTower === tw) {
      ctx.fillStyle = 'rgba(255,210,63,0.1)';
      ctx.beginPath(); ctx.arc(x, y, def.range * (1 + tw.level * 0.15) * TILE, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,63,0.5)';
      ctx.beginPath(); ctx.arc(x, y, def.range * (1 + tw.level * 0.15) * TILE, 0, Math.PI * 2); ctx.stroke();
    }
    // Tower body — bob gently
    const bobY = y + Math.sin(performance.now() / 400 + (tw.bob || 0)) * 2;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(x, bobY, TILE * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0d05';
    ctx.beginPath(); ctx.ellipse(x, bobY + 3, TILE * 0.24, TILE * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 5, bobY - 3, 3, 3); ctx.fillRect(x + 2, bobY - 3, 3, 3);
    // Icon
    ctx.font = "14px serif"; ctx.textAlign = 'center';
    ctx.fillText(def.icon, x, bobY - TILE * 0.36);
    // Level pips
    for (let i = 0; i < tw.level; i++) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 8 + i * 6, y + TILE * 0.32, 4, 4);
    }
  }
  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const x = ox + e.x * TILE;
    const y = oy + e.y * TILE;
    ctx.fillStyle = e.def.color;
    ctx.beginPath(); ctx.arc(x, y, e.def.size, 0, Math.PI * 2); ctx.fill();
    if (e.def.air) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x - 14, y - 2, 6, 2); ctx.fillRect(x + 8, y - 2, 6, 2);
    }
    if (e.slowT > 0) {
      ctx.fillStyle = '#b0e8ff';
      ctx.fillRect(x - 4, y - e.def.size - 6, 8, 3);
    }
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 14, y - e.def.size - 10, 28, 4);
    ctx.fillStyle = e.hp > e.maxHp * 0.5 ? '#5ef38c' : (e.hp > e.maxHp * 0.25 ? '#ffd23f' : '#ff3a3a');
    ctx.fillRect(x - 14, y - e.def.size - 10, 28 * e.hp / e.maxHp, 4);
  }
  // Projectiles
  for (const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Particles
  for (const p of particles) {
    if (p.ring) {
      ctx.strokeStyle = `rgba(255,58,58,${1 - p.t / p.life})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.maxR * (p.t / p.life), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
  // Placement preview (if a tower is selected & mouse hovers a buildable cell)
  if (selectedTowerType) {
    const def = TOWERS[selectedTowerType];
    ctx.fillStyle = 'rgba(255,210,63,0.08)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(0,0,0,0.7)`;
    ctx.fillRect(8, 32, 240, 28);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "12px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`tap a green cell to place ${def.name}`, 14, 50);
  }
}

function updateHud() {
  document.getElementById('hud-money').textContent = '$' + money;
  document.getElementById('hud-lives').textContent = lives;
  document.getElementById('hud-wave').textContent = `${waveIdx}/${WAVES.length}`;
  document.getElementById('hud-enemies').textContent = enemies.length;
  const best = loadBest('pug-td');
  document.getElementById('hud-best').textContent = best ? best.score : 0;
}

function end(won) {
  running = false;
  sfx.sweep(won ? 1320 : 220, won ? 880 : 60, won ? 'triangle' : 'sawtooth', 0.8, 0.25);
  document.getElementById('end-title').textContent = won ? 'VAULT SAFE!' : 'VAULT EMPTY';
  document.getElementById('end-sub').textContent = won ? 'You defended all 15 waves.' : 'The squirrels got all the biscuits.';
  document.getElementById('end-waves').textContent = waveIdx;
  const score = waveIdx * 100 + lives * 20;
  document.getElementById('end-score').textContent = score;
  const { isNewBest, current } = submitRun('pug-td', { score, waves: waveIdx, won });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { score };
    bestEl.innerHTML = `Best: <b>${b.score}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('td-bar').hidden = true;
  hidePopup();
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

// Map picker
let chosenMapId = 'classic';
function renderMapPicker() {
  const el = document.getElementById('map-picker');
  if (!el) return;
  el.innerHTML = '';
  for (const [id, m] of Object.entries(MAPS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `background:rgba(0,0,0,0.4);color:var(--text);border:2px solid ${chosenMapId === id ? 'var(--neon-yellow)' : 'var(--border)'};border-radius:4px;padding:8px 14px;font-family:var(--font-display);font-size:0.5rem;letter-spacing:0.06em;cursor:pointer;${chosenMapId === id ? 'background:rgba(255,210,63,0.18);color:var(--neon-yellow);box-shadow:0 0 12px rgba(255,210,63,0.45);' : ''}`;
    btn.innerHTML = `${m.name}<br><span style="color:var(--text-soft);font-size:0.42rem;">${m.desc}</span>`;
    btn.addEventListener('click', () => { chosenMapId = id; renderMapPicker(); });
    el.appendChild(btn);
  }
}
renderMapPicker();

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  currentMap = MAPS[chosenMapId] || MAPS.classic;
  reset(); running = true;
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('td-bar').hidden = false;
  buildBar();
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
      showTip('Pick a tower (bar) → tap a green cell to place · NEXT WAVE button starts', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
