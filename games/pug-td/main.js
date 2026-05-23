// PUG TOWER DEFENSE — grid path, 6 tower classes, 15 scaling waves.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon, iconSvg } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';

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

// =========================================================================
// PER-MAP BIOMES — each map gets a distinct visual theme: ground color, path
// color, ambient particle behavior, decor type, vault+spawner style.
// =========================================================================
const BIOMES = {
  classic:  { name: 'grass',  ground: '#3a5a3a', groundAlt: '#2a4a2a', path: '#8a6a4a', pathAlt: '#7a5a3a', accent: '#5ef38c', decor: 'flowers',   ambient: 'pollen',   vault: 'chest',    spawner: 'cave' },
  spiral:   { name: 'temple', ground: '#5a504a', groundAlt: '#4a4038', path: '#8a7c6a', pathAlt: '#6a5c50', accent: '#ffd23f', decor: 'cracks',    ambient: 'dust',     vault: 'altar',    spawner: 'portal' },
  zigzag:   { name: 'forest', ground: '#2a4a30', groundAlt: '#1a3a24', path: '#6a4a2a', pathAlt: '#5a3a1a', accent: '#3aaa55', decor: 'trees',     ambient: 'leaves',   vault: 'stump',    spawner: 'hollow' },
  corridor: { name: 'ice',    ground: '#a0c8e8', groundAlt: '#80a8d0', path: '#c8e0f0', pathAlt: '#a8c8e0', accent: '#ffffff', decor: 'crystals',  ambient: 'snow',     vault: 'igloo',    spawner: 'cave' },
  loop:     { name: 'lava',   ground: '#3a1a14', groundAlt: '#2a0a04', path: '#5a2a18', pathAlt: '#4a1a08', accent: '#ff6418', decor: 'rocks',     ambient: 'embers',   vault: 'forge',    spawner: 'magmaport' },
  uturn:    { name: 'beach',  ground: '#e8d09a', groundAlt: '#d0b87a', path: '#c8a868', pathAlt: '#b89858', accent: '#4cc9f0', decor: 'palms',     ambient: 'sandwind', vault: 'shipwreck',spawner: 'cave' },
  edge:     { name: 'roof',   ground: '#4a4a4a', groundAlt: '#3a3a3a', path: '#6a4a2a', pathAlt: '#5a3a1a', accent: '#4cc9f0', decor: 'tiles',     ambient: 'pollen',   vault: 'chimney',  spawner: 'door' },
  cross:    { name: 'desert', ground: '#d8a868', groundAlt: '#c89858', path: '#a87838', pathAlt: '#986828', accent: '#ffd23f', decor: 'cacti',     ambient: 'sandswirl',vault: 'pyramid',  spawner: 'cave' },
  funnel:   { name: 'cave',   ground: '#2a2238', groundAlt: '#1a1228', path: '#5a4a3a', pathAlt: '#4a3a2a', accent: '#b055ff', decor: 'stalactites', ambient: 'dust',   vault: 'crystal',  spawner: 'hollow' },
};
function getBiome() { return BIOMES[chosenMapId] || BIOMES.classic; }

// Decor scatter generation — deterministic per map seed
let mapDecor = []; // {x, y, type, swayOffset}
let mapParticles = []; // {x, y, vx, vy, t, life, type, size}
let _ambientSpawnT = 0;
function generateDecor() {
  mapDecor = [];
  const biome = getBiome();
  // Simple deterministic LCG
  let seed = 1;
  for (const c of chosenMapId) seed = ((seed * 31) + c.charCodeAt(0)) >>> 0;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 0) / 0x100000000; };
  const count = 14 + Math.floor(rng() * 4);
  let tries = 0;
  while (mapDecor.length < count && tries < 200) {
    tries++;
    const c = Math.floor(rng() * GRID_W);
    const r = Math.floor(rng() * GRID_H);
    if (isPath(c, r)) continue;
    // Don't pile too many in the same cell
    if (mapDecor.some((d) => Math.abs(d.col - c) < 1 && Math.abs(d.row - r) < 1)) continue;
    mapDecor.push({
      col: c, row: r,
      ox: (rng() - 0.5) * 0.6, // sub-cell offset
      oy: (rng() - 0.5) * 0.6,
      type: biome.decor,
      swayOffset: rng() * Math.PI * 2,
      scale: 0.85 + rng() * 0.3,
    });
  }
}

function spawnAmbientParticle() {
  const biome = getBiome();
  const t = biome.ambient;
  let p;
  if (t === 'snow') {
    p = { type: 'snow', x: Math.random() * W, y: -10, vx: -10 + Math.random() * 20, vy: 30 + Math.random() * 40, life: 8, t: 0, size: 2 + Math.random() * 2, color: '#ffffff' };
  } else if (t === 'leaves') {
    p = { type: 'leaf', x: Math.random() * W, y: -10, vx: -20 + Math.random() * 40, vy: 30 + Math.random() * 30, life: 7, t: 0, size: 4, color: ['#c88a2a', '#8aaa3a', '#aa5a2a'][Math.floor(Math.random() * 3)], spin: Math.random() * Math.PI * 2 };
  } else if (t === 'embers') {
    p = { type: 'ember', x: Math.random() * W, y: H + 10, vx: -10 + Math.random() * 20, vy: -40 - Math.random() * 40, life: 4, t: 0, size: 2 + Math.random() * 2, color: ['#ff6418', '#ffb000', '#ff3a3a'][Math.floor(Math.random() * 3)] };
  } else if (t === 'sandswirl' || t === 'sandwind') {
    const sideR = Math.random() < 0.5;
    p = { type: 'sand', x: sideR ? -10 : W + 10, y: 60 + Math.random() * (H - 220), vx: sideR ? 60 + Math.random() * 60 : -60 - Math.random() * 60, vy: -10 + Math.random() * 20, life: 4, t: 0, size: 2, color: '#e8d09a' };
  } else if (t === 'pollen') {
    p = { type: 'pollen', x: Math.random() * W, y: H + 10, vx: -8 + Math.random() * 16, vy: -20 - Math.random() * 20, life: 6, t: 0, size: 1 + Math.random(), color: '#ffd23f' };
  } else { // dust
    p = { type: 'dust', x: Math.random() * W, y: Math.random() * H, vx: -4 + Math.random() * 8, vy: -6 + Math.random() * 4, life: 5, t: 0, size: 1, color: 'rgba(200,200,200,0.4)' };
  }
  mapParticles.push(p);
}
function tickAmbient(dt) {
  _ambientSpawnT += dt;
  while (_ambientSpawnT > 0.06 && mapParticles.length < 80) {
    _ambientSpawnT -= 0.06;
    spawnAmbientParticle();
  }
  for (const p of mapParticles) {
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'leaf') p.spin += dt * 2;
  }
  mapParticles = mapParticles.filter((p) => p.t < p.life && p.x > -30 && p.x < W + 30 && p.y > -30 && p.y < H + 30);
}

// === Biome decor rendering ===
function drawBiomeDecor(d, x, y, tNow, biome) {
  const sway = Math.sin(tNow * 1.2 + d.swayOffset) * 2;
  const s = d.scale;
  switch (d.type) {
    case 'flowers': {
      // small flower with green stalk
      ctx.fillStyle = '#3aaa55';
      ctx.fillRect(x - 1, y - 2, 2, 8);
      ctx.fillStyle = ['#ff8ac8', '#ffd23f', '#ffffff', '#b055ff'][((d.col + d.row) % 4)];
      ctx.beginPath(); ctx.arc(x + sway * 0.4, y - 6, 4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x + sway * 0.4, y - 6, 1.5 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'trees': {
      // pixel tree — trunk + chunky canopy
      ctx.fillStyle = '#4a2a14';
      ctx.fillRect(x - 2, y - 2, 4, 8 * s);
      ctx.fillStyle = '#1a3a24';
      ctx.beginPath(); ctx.arc(x + sway * 0.5, y - 8, 9 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3aaa55';
      ctx.beginPath(); ctx.arc(x + sway * 0.5 - 2, y - 10, 6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5ef38c';
      ctx.beginPath(); ctx.arc(x + sway * 0.5 - 1, y - 11, 2.5 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'crystals': {
      // ice/crystal chunk
      ctx.fillStyle = 'rgba(176,232,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(x, y - 10 * s);
      ctx.lineTo(x + 5 * s, y - 2 * s);
      ctx.lineTo(x + 2 * s, y + 4 * s);
      ctx.lineTo(x - 3 * s, y + 4 * s);
      ctx.lineTo(x - 5 * s, y - 2 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x - 1, y - 7 * s, 2, 8 * s);
      break;
    }
    case 'rocks': {
      // pile of glowing-vein rocks (lava biome)
      ctx.fillStyle = '#3a2018';
      ctx.beginPath(); ctx.arc(x, y, 7 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3028';
      ctx.beginPath(); ctx.arc(x - 2, y - 2, 5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6418';
      ctx.fillRect(x - 3, y + 1, 6, 1); ctx.fillRect(x - 1, y - 1, 4, 1);
      break;
    }
    case 'palms': {
      // palm tree
      ctx.fillStyle = '#7a4a25';
      ctx.fillRect(x - 1, y - 4, 2, 12 * s);
      ctx.fillStyle = '#3aaa55';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + sway * 0.05;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 6, y - 6 + Math.sin(a) * 3, 6 * s, 2 * s, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#8a5a14';
      ctx.beginPath(); ctx.arc(x + 2, y - 5, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'tiles': {
      // rooftop tile cluster
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(x - 8, y - 4, 16, 8);
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(x - 8, y - 4, 16, 2);
      ctx.fillRect(x - 8, y, 5, 1);
      ctx.fillRect(x - 3, y, 5, 1);
      ctx.fillRect(x + 3, y, 5, 1);
      break;
    }
    case 'cacti': {
      ctx.fillStyle = '#3aaa55';
      ctx.fillRect(x - 2, y - 8 * s, 4, 12 * s);
      ctx.fillRect(x - 6, y - 4 * s, 3, 5 * s); // left arm
      ctx.fillRect(x + 3, y - 6 * s, 3, 6 * s); // right arm
      ctx.fillStyle = '#1a5a30';
      ctx.fillRect(x - 2, y - 8 * s, 1, 12 * s);
      // spines (white pixels)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 6, 1, 1); ctx.fillRect(x + 1, y - 4, 1, 1); ctx.fillRect(x - 1, y - 1, 1, 1);
      // little flower on top
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 1, y - 9 * s, 2, 1);
      break;
    }
    case 'stalactites': {
      ctx.fillStyle = '#3a2238';
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 6);
      ctx.lineTo(x + 5, y - 6);
      ctx.lineTo(x, y + 4 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a5a';
      ctx.fillRect(x - 1, y - 4, 1, 5);
      ctx.fillStyle = '#b055ff';
      ctx.fillRect(x - 1, y + 2, 2, 1);
      break;
    }
    case 'cracks': {
      // stone with cracks (temple)
      ctx.fillStyle = '#3a3028';
      ctx.fillRect(x - 6, y - 4, 12, 8);
      ctx.fillStyle = '#5a504a';
      ctx.fillRect(x - 6, y - 4, 12, 2);
      ctx.fillStyle = '#1a1410';
      ctx.fillRect(x - 4, y - 2, 1, 4); ctx.fillRect(x - 1, y, 4, 1); ctx.fillRect(x + 3, y - 3, 1, 5);
      break;
    }
  }
}

// === Spawner (start) ===
function drawSpawner(x, y, biome, tNow) {
  const pulse = 0.5 + 0.5 * Math.sin(tNow * 2);
  switch (biome.spawner) {
    case 'cave': {
      ctx.fillStyle = '#1a0e08';
      ctx.beginPath(); ctx.ellipse(x, y, TILE * 0.36, TILE * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 2, TILE * 0.28, TILE * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      // glowing eyes
      ctx.fillStyle = `rgba(255,58,161,${0.6 + pulse * 0.4})`;
      ctx.fillRect(x - 6, y - 2, 3, 3); ctx.fillRect(x + 3, y - 2, 3, 3);
      break;
    }
    case 'portal': {
      ctx.fillStyle = `rgba(176,85,255,${0.4 + pulse * 0.3})`;
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,58,161,${0.5 + pulse * 0.4})`;
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.1 + pulse * 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'hollow': {
      ctx.fillStyle = '#3a200c';
      ctx.fillRect(x - TILE * 0.36, y - TILE * 0.36, TILE * 0.72, TILE * 0.72);
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(94,243,140,${0.6 + pulse * 0.4})`;
      ctx.fillRect(x - 3, y, 6, 2);
      break;
    }
    case 'magmaport': {
      ctx.fillStyle = '#1a0a04';
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,100,24,${0.7 + pulse * 0.3})`;
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,210,63,${0.6 + pulse * 0.4})`;
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.18 + pulse * 3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'door': {
      ctx.fillStyle = '#3a2014';
      ctx.fillRect(x - TILE * 0.28, y - TILE * 0.4, TILE * 0.56, TILE * 0.8);
      ctx.fillStyle = '#6a3a1c';
      ctx.fillRect(x - TILE * 0.28, y - TILE * 0.4, TILE * 0.56, 4);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(x + TILE * 0.18, y, 2, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  // SPAWN label
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('SPAWN', x + 1, y + TILE * 0.55 + 1);
  ctx.fillStyle = '#ff3aa1';
  ctx.fillText('SPAWN', x, y + TILE * 0.55);
}

// === Vault (end) — improved chest with spilling biscuits + sparkles ===
function drawVault(x, y, biome, tNow, flashT) {
  const pulse = 0.5 + 0.5 * Math.sin(tNow * 3);
  // Chest shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 22, y + 20, 44, 4);
  // Chest body
  ctx.fillStyle = flashT > 0 ? '#ffffff' : '#6a4a2a';
  ctx.fillRect(x - 20, y - 4, 40, 24);
  // Chest lid
  ctx.fillStyle = flashT > 0 ? '#ffffff' : '#8a5a2c';
  ctx.fillRect(x - 20, y - 16, 40, 14);
  // Gold bands
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 20, y - 6, 40, 2);
  ctx.fillRect(x - 20, y - 14, 40, 2);
  ctx.fillRect(x - 20, y + 18, 40, 2);
  // Lock
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x - 4, y - 4, 8, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, 2, 2);
  // Biscuit pile spilling out (front)
  ctx.fillStyle = '#eae0c0';
  for (let i = 0; i < 8; i++) {
    const bx = x - 16 + i * 4 + (i % 2 ? 1 : 0);
    const by = y + 12 + (i & 1) * 2;
    ctx.fillRect(bx, by, 5, 4);
    ctx.fillStyle = '#c8b888';
    ctx.fillRect(bx, by + 3, 5, 1);
    ctx.fillStyle = '#eae0c0';
  }
  // Bones
  ctx.fillStyle = '#f4ecd2';
  ctx.fillRect(x - 12, y - 12, 8, 2);
  ctx.fillRect(x - 13, y - 13, 2, 4); ctx.fillRect(x - 5, y - 13, 2, 4);
  // Sparkles
  ctx.fillStyle = `rgba(255,210,63,${0.6 + pulse * 0.4})`;
  for (let i = 0; i < 5; i++) {
    const a = tNow * 0.7 + i * 1.3;
    const r = 22 + Math.sin(a * 2) * 6;
    const sx = x + Math.cos(a) * r;
    const sy = y - 4 + Math.sin(a) * r * 0.5;
    ctx.fillRect(sx, sy, 2, 2);
  }
  // VAULT label
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('VAULT', x + 1, y - 19 + 1);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('VAULT', x, y - 19);
  if (flashT > 0) {
    ctx.strokeStyle = `rgba(255,58,58,${flashT / 0.35})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 22, y - 18, 44, 40);
  }
}

// === Ambient particle render (called inside render) ===
function drawAmbientParticles() {
  for (const p of mapParticles) {
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0.15, k);
    if (p.type === 'leaf') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin || 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(-3, -2, 6, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-3, -2, 6, 1);
      ctx.restore();
    } else if (p.type === 'snow' || p.type === 'pollen') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'ember') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
    } else { // sand, dust
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

const TOWERS = {
  basic:  { name: 'Bork', icon: '🐶', iconName: 'pugFace', cost: 30, range: 3.0, dmg: 8,  cd: 0.5, color: '#4cc9f0', hitsAir: true, projColor: '#4cc9f0', desc: 'Cheap balanced shots' },
  sniper: { name: 'Snoot', icon: '👃', iconName: 'pugFace', cost: 80, range: 6.5, dmg: 45, cd: 1.5, color: '#ffd23f', hitsAir: true, projColor: '#ffd23f', desc: 'Long range, high dmg' },
  gatling:{ name: 'Gat', icon: '🎯', iconName: 'lightning', cost: 100, range: 2.6, dmg: 4,  cd: 0.1, color: '#ff8e3c', hitsAir: true, projColor: '#ff8e3c', desc: 'Spray of bullets' },
  cannon: { name: 'Cannon', icon: '💥', iconName: 'flame', cost: 120, range: 3.0, dmg: 25, cd: 1.2, color: '#ff3a3a', hitsAir: false, splash: 1.4, projColor: '#ff3a3a', desc: 'Splash dmg, ground only' },
  frost:  { name: 'Frost', icon: '🧊', iconName: 'diamond', cost: 75, range: 2.8, dmg: 3,  cd: 0.4, color: '#b0e8ff', hitsAir: true, slow: 0.4, slowDur: 1.5, projColor: '#b0e8ff', desc: 'Slows enemies' },
  buff:   { name: 'Buff', icon: '⭐', iconName: 'crown', cost: 90, range: 2.5, dmg: 0,  cd: 0.5, color: '#b055ff', hitsAir: false, buff: 1.4, desc: 'Boosts nearby towers +40%' },
  // NEW towers
  bone:   { name: 'Bone', icon: '🦴', iconName: 'bone', cost: 110, range: 3.5, dmg: 12, cd: 0.7, color: '#eae0c0', hitsAir: true, projColor: '#eae0c0', boomerang: true, desc: 'Boomerang hits twice' },
  tar:    { name: 'Tar', icon: '🛢', iconName: 'smokeBomb', cost: 95, range: 2.5, dmg: 6,  cd: 0.55, color: '#222228', hitsAir: false, projColor: '#222228', tarPool: true, slow: 0.5, slowDur: 2.2, desc: 'Drops slow-pools on ground' },
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

let money, lives, waveIdx, enemies, towers, projectiles, particles, popups, running, spawnQueue, spawnT, betweenWaveT, inWave, selectedTowerType, selectedTower;
let runId = 0;
// Screen-shake state (canvas translate during render) + wave banner
let shakeT = 0, shakeMag = 0, waveBannerT = 0, waveBannerText = '', vaultFlashT = 0;
function screenShake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function spawnPopup(x, y, text, color = '#5ef38c') { popups.push({ x, y, text, color, t: 0, life: 0.9 }); }

function reset() {
  money = 100; lives = 10; waveIdx = 0;
  enemies = []; towers = []; projectiles = []; particles = []; popups = [];
  spawnQueue = []; spawnT = 0; betweenWaveT = 0; inWave = false;
  selectedTowerType = null; selectedTower = null;
  shakeT = 0; shakeMag = 0; waveBannerT = 0; vaultFlashT = 0;
}

function buildBar() {
  const bar = document.getElementById('td-bar');
  bar.innerHTML = '';
  for (const [id, t] of Object.entries(TOWERS)) {
    const el = document.createElement('div');
    el.className = 'tw-pick' + (selectedTowerType === id ? ' selected' : '') + (money < t.cost ? ' disabled' : '');
    const iconHtml = (t.iconName && iconSvg[t.iconName])
      ? iconSvg[t.iconName](22)
      : t.icon;
    el.innerHTML = `<div class="tw-pick__icon">${iconHtml}</div><div>${t.name}</div><div class="tw-pick__cost">$${t.cost}</div>`;
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
  // 1.5× base cost scaling per level: Lv2 = 1.5×base, Lv3 = 3×base, Lv4 = 4.5×base
  const upCost = Math.floor(def.cost * 1.5 * (t.level + 1));
  el.innerHTML = `
    <div class="row"><b>${def.icon} ${def.name}</b><span>Lv ${t.level + 1}</span></div>
    <div class="row"><span>DMG</span><b>${(def.dmg * (1 + t.level * 0.25)).toFixed(0)}</b></div>
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
  // Mini-boss every 5 waves (wave index 5, 10, 15 / 1-based)
  const oneBased = waveIdx + 1;
  if (oneBased === 5 || oneBased === 10 || oneBased === 15) {
    spawnQueue.push('__MINIBOSS__');
  }
  inWave = true; spawnT = 0;
  waveIdx++;
  waveBannerText = `WAVE ${waveIdx}`;
  waveBannerT = 1.4;
  buildBar();
}

let miniBossBannerT = 0, miniBossBannerText = '';
function spawnMiniBoss() {
  // 5× scaled cat with crown. Drops big money on kill.
  const base = ENEMIES.cat;
  const hpMul = 5 + waveIdx * 0.5;
  enemies.push({
    type: 'miniboss', def: { ...base, name: 'MINI-BOSS', color: '#ffd23f', size: 18 },
    hp: base.hp * hpMul, maxHp: base.hp * hpMul,
    speed: base.speed * 0.85, slowT: 0, slowMul: 1,
    pathIdx: 0,
    x: currentMap.path[0][0] + 0.5, y: currentMap.path[0][1] + 0.5,
    alive: true, miniboss: true,
  });
  miniBossBannerText = `★ MINI-BOSS INCOMING ★`;
  miniBossBannerT = 2;
  screenShake(6, 0.3);
  sfx.sweep(110, 60, 'sawtooth', 0.4, 0.25);
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
  // Ambient particles tick (independent of wave state)
  tickAmbient(dt);
  // Wave-banner decay
  if (miniBossBannerT > 0) miniBossBannerT = Math.max(0, miniBossBannerT - dt);
  // Spawn
  if (inWave) {
    spawnT -= dt;
    if (spawnT <= 0 && spawnQueue.length > 0) {
      const next = spawnQueue.shift();
      if (next === '__MINIBOSS__') spawnMiniBoss();
      else spawnEnemy(next);
      spawnT = 0.4;
    }
    if (spawnQueue.length === 0 && enemies.every((e) => !e.alive)) {
      inWave = false;
      betweenWaveT = 5;
      // bonus
      const bonus = 20 + waveIdx * 5;
      money += bonus;
      // Wave-complete pop near the vault
      const vlast = currentMap.path[currentMap.path.length - 1];
      spawnPopup(vlast[0] * TILE + gridOffsetX() + TILE / 2, vlast[1] * TILE + gridOffsetY() - 6, `WAVE CLEAR  +$${bonus}`, '#ffd23f');
      screenShake(4, 0.22);
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
      // Vault hit: flash + shake + popup
      vaultFlashT = 0.35;
      screenShake(7, 0.28);
      const vlast = currentMap.path[currentMap.path.length - 1];
      spawnPopup(vlast[0] * TILE + gridOffsetX() + TILE / 2, vlast[1] * TILE + gridOffsetY() - 6, '-1 LIFE', '#ff3a3a');
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
    const dmg = def.dmg * (1 + tw.level * 0.25) * buffMult;
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
          const runToken = runId;
          setTimeout(() => {
            if (!running || runToken !== runId) return; // stale projectile from a prior match
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
          // Mini-boss: big bonus + banner
          let goldDrop = e.def.gold;
          if (e.miniboss) {
            goldDrop = 100;
            miniBossBannerText = '★ MINI-BOSS DOWN ★';
            miniBossBannerT = 2;
            screenShake(10, 0.35);
            sfx.arp([523, 659, 880, 1175], 'triangle', 0.08, 0.25, 0.25);
          }
          money += goldDrop;
          sfx.tone(660, 'triangle', 0.05, 0.16);
          const ex = e.x * TILE + gridOffsetX();
          const ey = e.y * TILE + gridOffsetY();
          // Floating "+$N" popup
          spawnPopup(ex, ey - 6, `+$${goldDrop}`, e.miniboss ? '#ff8ac8' : '#ffd23f');
          // Bigger kill burst for bosses/miniboss
          const burst = e.type === 'boss' ? 18 : (e.miniboss ? 16 : 6);
          if (e.type === 'boss') screenShake(8, 0.32);
          for (let k = 0; k < burst; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 60 + Math.random() * ((e.type === 'boss' || e.miniboss) ? 160 : 80);
            particles.push({ x: ex, y: ey, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: e.def.color, life: 0.4, t: 0, size: 4 });
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
  // Floating score popups (drift upward, fade)
  for (const p of popups) { p.t += dt; p.y -= 28 * dt; }
  popups = popups.filter((p) => p.t < p.life);
  // Shake decay + banner + vault flash
  if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
  if (waveBannerT > 0) waveBannerT = Math.max(0, waveBannerT - dt);
  if (vaultFlashT > 0) vaultFlashT = Math.max(0, vaultFlashT - dt);
  updateHud();
}

function render() {
  const biome = getBiome();
  // Background — vignette per biome
  ctx.fillStyle = biome.ground; ctx.fillRect(0, 0, W, H);
  // Soft vignette to make the map pop
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // Screen shake — translate the world layers (HUD is DOM, unaffected)
  let shakeOx = 0, shakeOy = 0;
  if (shakeT > 0 && shakeMag > 0) {
    const k = (shakeT) * shakeMag;
    shakeOx = (Math.random() - 0.5) * k;
    shakeOy = (Math.random() - 0.5) * k;
    ctx.save();
    ctx.translate(shakeOx, shakeOy);
  }
  const ox = gridOffsetX(), oy = gridOffsetY();
  // Cells — biome-tinted with alternating tile shade
  let pathIdxLookup = null;
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const x = ox + c * TILE, y = oy + r * TILE;
      const alt = (c + r) & 1;
      if (isPath(c, r)) {
        ctx.fillStyle = alt ? biome.path : biome.pathAlt;
        ctx.fillRect(x, y, TILE, TILE);
        // top highlight (trampled)
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, y, TILE, 3);
        // edge pebbles
        if ((c * 7 + r * 13) % 5 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x + 4, y + TILE - 6, 3, 2);
          ctx.fillRect(x + TILE - 8, y + 5, 2, 2);
        }
      } else {
        ctx.fillStyle = alt ? biome.ground : biome.groundAlt;
        ctx.fillRect(x, y, TILE, TILE);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
  // Decor scatter — per biome props with sway
  const tNow = performance.now() / 1000;
  for (const d of mapDecor) {
    const dx = ox + (d.col + 0.5 + d.ox) * TILE;
    const dy = oy + (d.row + 0.5 + d.oy) * TILE;
    drawBiomeDecor(d, dx, dy, tNow, biome);
  }
  // Spawn portal/cave at start — biome-themed
  const first = currentMap.path[0];
  const sx = ox + first[0] * TILE + TILE / 2;
  const sy = oy + first[1] * TILE + TILE / 2;
  drawSpawner(sx, sy, biome, tNow);
  // Vault at end — improved with biscuit pile + sparkles
  const last = currentMap.path[currentMap.path.length - 1];
  const vx = ox + last[0] * TILE + TILE / 2;
  const vy = oy + last[1] * TILE + TILE / 2;
  drawVault(vx, vy, biome, tNow, vaultFlashT);

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
    // Level upgrade rings — 1 ring per level under tower
    if (tw.level > 0) {
      for (let i = 0; i < tw.level; i++) {
        ctx.strokeStyle = ['#5ef38c', '#4cc9f0', '#ffd23f'][i] || '#ffd23f';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y + 6, TILE * 0.36 + 4 + i * 4, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Shared high-detail pug sprite — body color comes from tower type.
    drawPug(ctx, x, bobY + 4, { size: 30, body: def.color || '#c8854a' });
    // Tower-type icon overlay above the pug head (small badge).
    if (def.iconName && drawIcon[def.iconName]) {
      drawIcon[def.iconName](ctx, x, bobY - 22, 12);
    } else {
      ctx.font = "12px serif"; ctx.textAlign = 'center';
      ctx.fillText(def.icon, x, bobY - 18);
    }
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
    // Mini-boss: aura ring
    if (e.miniboss) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.fillStyle = `rgba(255,210,63,${0.18 + pulse * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, e.def.size + 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
    }
    if (e.type === 'boss') {
      // Mega-pug villain — purple body, dark mask. drawPug handles its own shadow.
      drawPug(ctx, x, y + 6, { size: 44, body: '#b055ff', mask: '#3a1a4a' });
    } else {
      ctx.fillStyle = e.def.color;
      ctx.beginPath(); ctx.arc(x, y, e.def.size, 0, Math.PI * 2); ctx.fill();
    }
    if (e.def.air) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x - 14, y - 2, 6, 2); ctx.fillRect(x + 8, y - 2, 6, 2);
    }
    if (e.slowT > 0) {
      ctx.fillStyle = '#b0e8ff';
      ctx.fillRect(x - 4, y - e.def.size - 6, 8, 3);
    }
    // Mini-boss crown
    if (e.miniboss) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 8, y - e.def.size - 4, 16, 3);
      ctx.fillRect(x - 8, y - e.def.size - 7, 3, 3);
      ctx.fillRect(x - 1, y - e.def.size - 8, 3, 4);
      ctx.fillRect(x + 5, y - e.def.size - 7, 3, 3);
      ctx.fillStyle = '#ff3aa1';
      ctx.fillRect(x - 1, y - e.def.size - 6, 2, 2);
    }
    // HP bar — widened for boss/miniboss
    const barW = (e.type === 'boss' || e.miniboss) ? 44 : 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - barW / 2, y - e.def.size - 10, barW, 4);
    ctx.fillStyle = e.hp > e.maxHp * 0.5 ? '#5ef38c' : (e.hp > e.maxHp * 0.25 ? '#ffd23f' : '#ff3a3a');
    ctx.fillRect(x - barW / 2, y - e.def.size - 10, barW * e.hp / e.maxHp, 4);
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
  // Floating score popups
  for (const p of popups) {
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = k;
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(p.text, p.x + 1, p.y + 1);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  // Close screen-shake transform before drawing UI overlays
  if (shakeT > 0 && shakeMag > 0) ctx.restore();
  // Ambient biome particles drawn after shake-restore so they don't jitter
  drawAmbientParticles();
  // Mini-boss banner (above wave banner)
  if (miniBossBannerT > 0) {
    const k = Math.min(1, miniBossBannerT / 2);
    ctx.globalAlpha = Math.max(0, Math.min(1, k > 0.85 ? (2 - miniBossBannerT) / 0.3 : k));
    ctx.font = "20px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(miniBossBannerText, W / 2 + 2, H / 2 - 60 + 2);
    ctx.fillStyle = '#ff8ac8';
    ctx.fillText(miniBossBannerText, W / 2, H / 2 - 60);
    ctx.globalAlpha = 1;
  }
  // Wave-start banner (centered, fades)
  if (waveBannerT > 0) {
    const k = Math.min(1, waveBannerT / 1.4);
    const alpha = waveBannerT > 1.1 ? (1.4 - waveBannerT) / 0.3 : k;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = "26px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(waveBannerText, W / 2 + 2, H / 2 + 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(waveBannerText, W / 2, H / 2);
    ctx.globalAlpha = 1;
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
  const livesEl = document.getElementById('hud-lives');
  livesEl.textContent = lives;
  // Critical lives — pulse the HUD card red
  const hudCard = document.querySelector('#hud .hud-card');
  if (hudCard) {
    if (lives > 0 && lives <= 3) hudCard.classList.add('td-hud-critical');
    else hudCard.classList.remove('td-hud-critical');
  }
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
  reset(); running = true; runId++;
  // Regenerate biome decor + clear ambient particles per match
  mapParticles = [];
  generateDecor();
  miniBossBannerT = 0; miniBossBannerText = '';
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
      showTip('Place towers → tap one to UPGRADE/SELL. Waves 5, 10, 15 spawn MINI-BOSSES (+$100 bounty)', 7000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
