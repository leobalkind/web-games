// PUG TOWER DEFENSE — grid path, 6 tower classes, 15 scaling waves.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon, iconSvg } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createSpeedToggle } from '../../src/shared/speedToggle.js';
import { showWavePreview } from '../../src/shared/wavePreview.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { showOrientationHint } from '../../src/shared/orientationHint.js';
import { drawShadow as _depthShadow, isReducedMotion as _depthReduced } from '../../src/shared/depth3D.js';

// Tower-defense is tap-only — the shared module just adds the BACK chip and
// mute toggle in the corners (and is auto-hidden on desktop). No movement.
createMobileControls({ layout: 'single-tap', buttons: [] });
// Wide grid + tower-row below = much better in landscape on phones.
showOrientationHint({ gameId: 'pug-td' });

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'td:muted' });
// Catchy arcade — escalates during waves, calms between.
const music = createMusicTrack({ mood: 'arcade', tempo: 120, key: 'D', scale: 'minor' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'pug-td', getControlsHelp: () => (_isTouch
  ? 'TAP a tile to place a tower → TAP tower to upgrade. At Lv2 CHOOSE A PATH. ⚡ SPEED TOGGLE top-right. Saved to your profile.'
  : 'CLICK to place tower → CLICK tower to upgrade. At Lv2 CHOOSE A PATH. T = speed toggle. Saved to your profile.') });

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
  // ROUND-2 NEW: WINDING — very long S-curve that snakes through almost
  // every column. Stresses long-range towers + teleport positioning.
  winding: {
    name: 'WINDING',
    desc: 'very long S-curve',
    path: [
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
      [6,2],[6,3],
      [5,3],[4,3],[3,3],[2,3],[1,3],
      [1,4],[1,5],
      [2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],
      [8,6],[8,7],
      [7,7],[6,7],[5,7],[4,7],[3,7],[2,7],
      [2,8],[2,9],
      [3,9],[4,9],[5,9],[6,9],[7,9],[8,9],[9,9],[10,9],[11,9],
      [11,8],[11,7],
      [12,7],[13,7],[14,7],
      [14,6],[14,5],
      [13,5],[12,5],
      [12,4],[12,3],
      [13,3],[14,3],[15,3],[16,3],[17,3],
    ],
  },
};
let currentMap = MAPS.classic;
// Perf: precompute a Set of "c,r" keys so isPath() is O(1) instead of O(N).
// Per-frame this used to do GRID_W*GRID_H * path.length comparisons during render.
let _pathSet = null;
function _rebuildPathSet() {
  _pathSet = new Set();
  for (const p of currentMap.path) _pathSet.add(p[0] + ',' + p[1]);
}
_rebuildPathSet();
function isPath(c, r) {
  if (!_pathSet) _rebuildPathSet();
  return _pathSet.has(c + ',' + r);
}

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
  winding:  { name: 'meadow', ground: '#3a6a4a', groundAlt: '#2a5a3a', path: '#a08858', pathAlt: '#8a7848', accent: '#ff8ac8', decor: 'flowers',   ambient: 'pollen',  vault: 'chest',   spawner: 'cave' },
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
  // Perf: prune in-place via reverse-iter splice — avoids per-frame realloc.
  for (let i = mapParticles.length - 1; i >= 0; i--) {
    const p = mapParticles[i];
    p.t += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'leaf') p.spin += dt * 2;
    if (p.t >= p.life || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
      mapParticles.splice(i, 1);
    }
  }
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
      // Round-2 polish: dramatic vortex — multi-layered rotating "arms"
      // around the core. Each arm is a short eccentric arc that rotates at
      // a different rate, creating a swirling spiral effect.
      const rot = tNow * 1.4;
      // Outer halo
      ctx.fillStyle = `rgba(176,85,255,${0.25 + pulse * 0.25})`;
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.52 + pulse * 4, 0, Math.PI * 2); ctx.fill();
      // 4 swirling arms (alternating colors)
      for (let i = 0; i < 4; i++) {
        const a0 = rot + (i / 4) * Math.PI * 2;
        ctx.strokeStyle = i % 2 === 0 ? `rgba(176,85,255,${0.7})` : `rgba(255,58,161,${0.65})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, y, TILE * 0.42, a0, a0 + 0.85);
        ctx.stroke();
      }
      // Counter-rotating inner ring
      for (let i = 0; i < 6; i++) {
        const a0 = -rot * 1.6 + (i / 6) * Math.PI * 2;
        ctx.strokeStyle = `rgba(255,210,63,${0.55})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, TILE * 0.28, a0, a0 + 0.4);
        ctx.stroke();
      }
      // Mid pinkish disc
      ctx.fillStyle = `rgba(255,58,161,${0.45 + pulse * 0.35})`;
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.22, 0, Math.PI * 2); ctx.fill();
      // Bright center pinprick
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, TILE * 0.09 + pulse * 2, 0, Math.PI * 2); ctx.fill();
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

// Per-tower accessory overlay — unique silhouette per type + per-path flair.
function _drawTowerAccessory(ctx, x, y, type, path, size) {
  const s = size / 36;
  ctx.save();
  if (type === 'basic') {
    ctx.fillStyle = '#1a3a5a'; ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 3 * s);
    ctx.fillStyle = '#2a4a78'; ctx.fillRect(x - 7 * s, y - 13 * s, 14 * s, 1 * s);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(x + 6 * s, y - 2 * s, 5 * s, 2 * s); ctx.fillRect(x + 6 * s, y, 3 * s, 3 * s);
    if (path === 'A') { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 6 * s, y - 2 * s, 5 * s, 1 * s); }
    else if (path === 'B') { ctx.fillStyle = '#4cc9f0'; ctx.fillRect(x + 10 * s, y - 1 * s, 4 * s, 1 * s); }
  } else if (type === 'sniper') {
    // Sniper glasses + scope rifle
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(x - 6 * s, y - 4 * s, 12 * s, 2 * s);
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(x - 6 * s, y - 3 * s, 5 * s, 2 * s);
    ctx.fillRect(x + 1 * s, y - 3 * s, 5 * s, 2 * s);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 4 * s, y - 3 * s, 1 * s, 1 * s);
    ctx.fillRect(x + 3 * s, y - 3 * s, 1 * s, 1 * s);
    // long rifle barrel
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x + 6 * s, y - 1 * s, 9 * s, 2 * s);
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(x + 8 * s, y - 3 * s, 3 * s, 2 * s);
    if (path === 'A') {
      ctx.fillStyle = '#ff8e3c';
      ctx.fillRect(x + 14 * s, y - 1 * s, 2 * s, 1 * s);
    }
  } else if (type === 'gatling') {
    // Ear-protection / over-ear cans + spin-up barrels
    ctx.fillStyle = '#ff8e3c';
    ctx.fillRect(x - 9 * s, y - 5 * s, 2 * s, 7 * s);
    ctx.fillRect(x + 7 * s, y - 5 * s, 2 * s, 7 * s);
    ctx.fillStyle = '#c86028';
    ctx.fillRect(x - 9 * s, y - 5 * s, 2 * s, 1 * s);
    ctx.fillRect(x + 7 * s, y - 5 * s, 2 * s, 1 * s);
    // Spinning barrels (rendered as three stripes near front)
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x + 6 * s, y - 2 * s, 6 * s, 1 * s);
    ctx.fillRect(x + 6 * s, y, 6 * s, 1 * s);
    ctx.fillRect(x + 6 * s, y + 2 * s, 6 * s, 1 * s);
  } else if (type === 'cannon') {
    // Helmet + giant cannon barrel
    ctx.fillStyle = '#5a3018';
    ctx.fillRect(x - 8 * s, y - 14 * s, 16 * s, 4 * s);
    ctx.fillStyle = '#a04830';
    ctx.fillRect(x - 8 * s, y - 13 * s, 16 * s, 1 * s);
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(x + 5 * s, y - 4 * s, 8 * s, 6 * s); // barrel
    ctx.fillStyle = '#1a0808';
    ctx.fillRect(x + 11 * s, y - 4 * s, 2 * s, 6 * s); // muzzle
    if (path === 'A') { // NAPALM red glow
      ctx.fillStyle = 'rgba(255,90,40,0.7)';
      ctx.fillRect(x + 12 * s, y - 3 * s, 1 * s, 4 * s);
    }
  } else if (type === 'frost') {
    ctx.fillStyle = '#5078a8'; ctx.fillRect(x - 6 * s, y - 14 * s, 12 * s, 4 * s);
    ctx.fillStyle = '#b0e8ff';
    ctx.fillRect(x - 5 * s, y - 16 * s, 2 * s, 3 * s); ctx.fillRect(x - 1 * s, y - 17 * s, 2 * s, 4 * s); ctx.fillRect(x + 3 * s, y - 16 * s, 2 * s, 3 * s);
    ctx.fillStyle = '#8a8aac'; ctx.fillRect(x + 7 * s, y - 8 * s, 1 * s, 14 * s);
    ctx.fillStyle = '#b0e8ff'; ctx.fillRect(x + 6 * s, y - 10 * s, 3 * s, 3 * s);
  } else if (type === 'buff') {
    ctx.fillStyle = '#5a1010'; ctx.fillRect(x - 7 * s, y - 14 * s, 14 * s, 4 * s);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 1 * s, y - 12 * s, 2 * s, 1 * s);
    ctx.fillStyle = '#b055ff'; ctx.fillRect(x - 9 * s, y - 2 * s, 18 * s, 9 * s);
    ctx.fillStyle = '#7028a0'; ctx.fillRect(x - 9 * s, y + 6 * s, 18 * s, 1 * s);
  } else if (type === 'bone') {
    ctx.fillStyle = '#eae0c0'; ctx.fillRect(x - 8 * s, y + 1 * s, 16 * s, 3 * s);
    ctx.fillStyle = '#a8a098'; ctx.fillRect(x - 9 * s, y, 3 * s, 5 * s); ctx.fillRect(x + 6 * s, y, 3 * s, 5 * s);
  } else if (type === 'tar') {
    ctx.fillStyle = '#1a3a18'; ctx.fillRect(x - 8 * s, y - 14 * s, 16 * s, 6 * s);
    ctx.fillStyle = '#3a5a30'; ctx.fillRect(x - 8 * s, y - 14 * s, 16 * s, 1 * s);
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(x + 6 * s, y + 2 * s, 5 * s, 6 * s);
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x + 6 * s, y + 2 * s, 5 * s, 1 * s);
  } else if (type === 'teleport') {
    ctx.fillStyle = '#3a0a4a'; ctx.fillRect(x - 6 * s, y - 14 * s, 12 * s, 5 * s);
    ctx.fillStyle = '#b055ff'; ctx.fillRect(x - 2 * s, y - 18 * s, 4 * s, 5 * s);
    ctx.strokeStyle = '#b055ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y + 14 * s, 9 * s, 0, Math.PI * 2); ctx.stroke();
  } else if (type === 'banner') {
    ctx.fillStyle = '#5a3018'; ctx.fillRect(x + 6 * s, y - 18 * s, 1 * s, 24 * s);
    ctx.fillStyle = '#ff8ac8'; ctx.fillRect(x + 7 * s, y - 18 * s, 8 * s, 8 * s);
    ctx.fillStyle = '#c050a0'; ctx.fillRect(x + 7 * s, y - 18 * s, 8 * s, 1 * s);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 10 * s, y - 15 * s, 2 * s, 2 * s);
  }
  ctx.restore();
}

// Detailed enemy sprites.
function _drawEnemySprite(ctx, x, y, e) {
  const t = e.type;
  const fs = (col) => ctx.fillStyle = col;
  const r = (rx, ry, rw, rh) => ctx.fillRect(rx, ry, rw, rh);
  const a = (ax, ay, ar) => { ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill(); };
  const el = (ax, ay, rw, rh, rot) => { ctx.beginPath(); ctx.ellipse(ax, ay, rw, rh, rot || 0, 0, Math.PI * 2); ctx.fill(); };
  if (t === 'squirrel') {
    fs('#5a3018'); el(x + 8, y - 4, 5, 7, -0.4);
    fs('#a06030'); a(x, y, 9);
    fs('#d8a888'); el(x, y + 3, 5, 4);
    fs('#a06030'); a(x - 4, y - 4, 5);
    fs('#5a3018'); r(x - 7, y - 9, 2, 2); r(x - 3, y - 10, 2, 2);
    fs('#000'); r(x - 5, y - 4, 1, 1);
    fs('#8a5028'); r(x - 1, y - 2, 2, 2);
  } else if (t === 'cat') {
    fs('#0a0a12'); a(x, y, 11);
    fs('#222'); a(x - 1, y - 1, 10);
    fs('#000');
    ctx.beginPath(); ctx.moveTo(x - 7, y - 8); ctx.lineTo(x - 10, y - 14); ctx.lineTo(x - 4, y - 11); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 7, y - 8); ctx.lineTo(x + 10, y - 14); ctx.lineTo(x + 4, y - 11); ctx.closePath(); ctx.fill();
    fs('#a02060'); r(x - 8, y - 12, 1, 1); r(x + 7, y - 12, 1, 1);
    fs('#ffd23f'); r(x - 5, y - 3, 2, 3); r(x + 3, y - 3, 2, 3);
    fs('#000'); r(x - 4, y - 3, 1, 3); r(x + 4, y - 3, 1, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 2); ctx.lineTo(x - 3, y + 1);
    ctx.moveTo(x - 10, y + 4); ctx.lineTo(x - 3, y + 3);
    ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 3, y + 1);
    ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + 3, y + 3);
    ctx.stroke();
    fs('#000'); el(x + 12, y, 5, 2, 0.3);
  } else if (t === 'tank') {
    fs('#1a0d05'); a(x, y, 17);
    fs('#5a3a14'); a(x, y, 16);
    fs('#3a2a10'); r(x - 12, y - 2, 24, 10);
    fs('#7a5a24'); r(x - 12, y - 2, 24, 1);
    fs('#222230'); r(x - 12, y - 16, 24, 7);
    fs('#3a3a4a'); r(x - 12, y - 16, 24, 1);
    fs('#cacacf'); r(x - 9, y - 22, 3, 7); r(x - 1, y - 24, 3, 9); r(x + 6, y - 22, 3, 7);
    fs('#ff3a3a'); r(x - 5, y - 11, 10, 2);
    fs('#cacacf'); r(x - 11, y - 13, 1, 1); r(x + 10, y - 13, 1, 1); r(x - 11, y + 7, 1, 1); r(x + 10, y + 7, 1, 1);
  } else if (t === 'bird') {
    fs('#1a4020'); el(x, y, 12, 8);
    fs('#5ef38c'); el(x, y - 1, 11, 7);
    fs('#a8f0b8'); r(x - 6, y + 1, 12, 4);
    fs('#5ef38c'); a(x - 8, y - 4, 5);
    fs('#ff8e3c');
    ctx.beginPath(); ctx.moveTo(x - 13, y - 4); ctx.lineTo(x - 18, y - 3); ctx.lineTo(x - 13, y - 1); ctx.closePath(); ctx.fill();
    fs('#000'); r(x - 9, y - 5, 1, 1);
    fs('#fff'); r(x - 9, y - 6, 1, 1);
    fs('#1a4020'); r(x + 9, y - 4, 4, 2); r(x + 9, y + 2, 4, 2);
  } else if (t === 'elite') {
    drawPug(ctx, x, y + 4, { size: 32, body: '#c8854a', mask: '#3a1808' });
    fs('#7a5a24'); r(x - 14, y - 2, 5, 4); r(x + 9, y - 2, 5, 4);
    fs('#ffd23f'); r(x - 14, y - 2, 5, 1); r(x + 9, y - 2, 5, 1);
    ctx.strokeStyle = '#a02828'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 10); ctx.lineTo(x + 7, y - 4);
    ctx.moveTo(x + 7, y - 10); ctx.lineTo(x + 1, y - 4);
    ctx.stroke();
  } else {
    fs(e.def.color); a(x, y, e.def.size);
  }
}

// Detailed projectile render — dispatched by source tower type.
function _drawProjectile(ctx, p) {
  const t = p.sourceType, c = p.color || '#4cc9f0';
  let ang = 0;
  if (p.target && p.target.x != null) ang = Math.atan2((p.target.y * TILE + gridOffsetY()) - p.y, (p.target.x * TILE + gridOffsetX()) - p.x);
  const arc = (ax, ay, ar) => { ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.fill(); };
  if (t === 'sniper') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.shadowColor = c; ctx.shadowBlur = 8;
    ctx.fillStyle = c; ctx.fillRect(-12, -1, 14, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, -1, 4, 2);
    ctx.shadowBlur = 0; ctx.restore();
  } else if (t === 'cannon') {
    ctx.fillStyle = '#000'; arc(p.x + 1, p.y + 1, 7);
    ctx.fillStyle = '#1a0808'; arc(p.x, p.y, 6);
    ctx.fillStyle = '#5a1818'; arc(p.x - 2, p.y - 2, 3);
    ctx.fillStyle = 'rgba(180,180,200,0.45)'; arc(p.x - Math.cos(ang) * 5, p.y - Math.sin(ang) * 5, 3);
  } else if (t === 'frost') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(performance.now() * 0.01);
    ctx.shadowColor = c; ctx.shadowBlur = 8;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(0, 6); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(2, 0); ctx.lineTo(0, 3); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.restore();
  } else if (t === 'bone') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(performance.now() * 0.025);
    ctx.fillStyle = '#a8a098'; ctx.fillRect(-7, -2, 14, 4);
    arc(-7, 0, 3); arc(7, 0, 3);
    ctx.fillStyle = '#eae0c0'; ctx.fillRect(-7, -2, 14, 2);
    arc(-7, -1, 2); arc(7, -1, 2);
    ctx.restore();
  } else if (t === 'tar') {
    ctx.fillStyle = '#000'; arc(p.x, p.y, 5);
    ctx.fillStyle = '#222'; arc(p.x - 1, p.y - 1, 3);
    ctx.fillStyle = '#000'; ctx.fillRect(p.x - 1, p.y + 4, 2, 3);
  } else if (t === 'gatling') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.fillStyle = '#ffce5e'; ctx.fillRect(-4, -1, 6, 2);
    ctx.fillStyle = c; ctx.fillRect(-4, -1, 3, 2);
    ctx.restore();
  } else if (t === 'teleport') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(performance.now() * 0.015);
    ctx.shadowColor = c; ctx.shadowBlur = 10;
    ctx.fillStyle = c; arc(0, 0, 6);
    ctx.fillStyle = '#ff3aa1'; ctx.fillRect(-4, -1, 8, 2); ctx.fillRect(-1, -4, 2, 8);
    ctx.shadowBlur = 0; ctx.restore();
  } else if (t === 'basic') {
    ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.fillStyle = c; arc(p.x, p.y, 5);
    ctx.fillStyle = '#fff'; arc(p.x - 1, p.y - 1, 2);
    if (p.sourcePath === 'A') { ctx.fillStyle = 'rgba(255,210,63,0.5)'; arc(p.x - Math.cos(ang) * 5, p.y - Math.sin(ang) * 5, 2); }
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = c; ctx.shadowBlur = 6;
    ctx.fillStyle = c; arc(p.x, p.y, 5);
    ctx.shadowBlur = 0;
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
  // TELEPORT tower — warps enemies BACKWARD along path. Round-2 tune:
  // increased cooldown 1.6 → 2.2 + range 3.2 → 2.6 + cost 140 → 160 to reduce dominance.
  teleport: { name: 'Warp', icon: '🌀', iconName: 'diamond', cost: 160, range: 2.6, dmg: 0, cd: 2.2, color: '#b055ff', hitsAir: true, projColor: '#b055ff', teleport: true, desc: 'Warps enemies BACK on path' },
  // ROUND-2 NEW: BANNER — buff tower that stacks +25% fire rate AND +30%
  // range to adjacent towers. No damage. Stronger than BUFF (which only
  // boosts dmg) — different niche.
  banner:   { name: 'Banner', icon: '🚩', iconName: 'crown', cost: 100, range: 2.0, dmg: 0, cd: 0.5, color: '#ff8ac8', hitsAir: false, bannerBoost: true, bannerFireRate: 0.25, bannerRange: 0.3, desc: '+25% rate, +30% range to adj' },
};

const TARGETING_MODES = ['FIRST', 'LAST', 'STRONG', 'CLOSE'];
const TARGETING_LABEL = { FIRST: 'first on path', LAST: 'last on path', STRONG: 'highest HP', CLOSE: 'closest' };

// === 2-PATH UPGRADE TREE ===
// At level 2 (after first upgrade) the player must pick one of two paths per
// tower. Picking commits — levels 3+ apply that path's stat boosts and the
// tower draws a small badge indicating the chosen path.
// Each path has: label, blurb, badge color/glyph, and stat multipliers
// applied per upgrade level beyond the path-pick. Tower-specific behavior
// flags (crit, pierce, splash, knockback, etc.) are checked in firing code.
const TOWER_PATHS = {
  basic: {
    A: { id: 'CRIT',   label: 'CRIT',   blurb: '15% chance ×3 dmg',         badge: '#ffd23f', glyph: '★', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, crit: 0.15, critMul: 3 },
    B: { id: 'PIERCE', label: 'PIERCE', blurb: 'shots pierce 2 targets',     badge: '#4cc9f0', glyph: '➤', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, pierce: 2 },
  },
  sniper: {
    A: { id: 'SCOPE', label: 'SCOPE', blurb: '+50% range · crit full-HP',  badge: '#ff8e3c', glyph: '◎', dmgMul: 1.0, rangeMul: 1.5, rateMul: 1.0, fullHpCrit: true, critMul: 2 },
    B: { id: 'AMMO',  label: 'AMMO',  blurb: '1.5× fire rate',              badge: '#5ef38c', glyph: '|||', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.5 },
  },
  gatling: {
    A: { id: 'SPREAD', label: 'SPREAD', blurb: '5 pellets, wider arc',      badge: '#ff8e3c', glyph: '※', dmgMul: 0.8, rangeMul: 1.0, rateMul: 1.0, spreadCount: 5 },
    B: { id: 'SLUG',   label: 'SLUG',   blurb: '1 slug · ×3 dmg · knock',   badge: '#3a3030', glyph: '●', dmgMul: 3.0, rangeMul: 1.0, rateMul: 0.7, knockback: true },
  },
  cannon: {
    A: { id: 'NAPALM', label: 'NAPALM', blurb: 'leaves burning ground',     badge: '#ff5a3a', glyph: '🔥', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, napalm: true },
    B: { id: 'CLUSTER',label: 'CLUSTER',blurb: '+60% splash · ×1.3 dmg',    badge: '#ffd23f', glyph: '✦', dmgMul: 1.3, rangeMul: 1.0, rateMul: 1.0, splashMul: 1.6 },
  },
  frost: {
    A: { id: 'GLACIER', label: 'GLACIER', blurb: '70% slow · longer freeze', badge: '#b0e8ff', glyph: '❄', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, slowBoost: 0.7, slowDurBoost: 1.8 },
    B: { id: 'SHATTER', label: 'SHATTER', blurb: '×2 dmg vs slowed enemies', badge: '#4cc9f0', glyph: '✧', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, shatter: true },
  },
  buff: {
    A: { id: 'COMMANDER', label: 'COMMAND', blurb: '+80% buff · +30% range',  badge: '#ffd23f', glyph: '⚔', dmgMul: 1.0, rangeMul: 1.3, rateMul: 1.0, buffBoost: 1.8 },
    B: { id: 'BANK',      label: 'BANK',    blurb: '+$1/sec passive income', badge: '#5ef38c', glyph: '$', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, incomeSec: 1 },
  },
  bone: {
    A: { id: 'TRIPLE', label: 'TRIPLE', blurb: 'returning hits ×3',          badge: '#eae0c0', glyph: '↺', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, boomerangBounces: 3 },
    B: { id: 'HEAVY',  label: 'HEAVY',  blurb: '×2 dmg · slower throw',      badge: '#8a6a3a', glyph: '▣', dmgMul: 2.0, rangeMul: 1.0, rateMul: 0.7 },
  },
  tar: {
    A: { id: 'BOG',    label: 'BOG',    blurb: '80% slow · pool lingers',    badge: '#222230', glyph: '◉', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, slowBoost: 0.8, slowDurBoost: 2.0 },
    B: { id: 'TOXIC',  label: 'TOXIC',  blurb: 'pool tics +6 dmg/sec',       badge: '#5ef38c', glyph: '☣', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, dotPerSec: 6 },
  },
  teleport: {
    A: { id: 'BACKWARD', label: 'BACKWARD', blurb: 'warps enemies 4 tiles back', badge: '#b055ff', glyph: '↶', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, warpAmt: 4 },
    B: { id: 'CHAOS',    label: 'CHAOS',    blurb: 'warps random 1-6 tiles back', badge: '#ff3aa1', glyph: '⌘', dmgMul: 1.0, rangeMul: 1.2, rateMul: 0.8, warpAmt: 0, warpChaos: true },
  },
  banner: {
    A: { id: 'RALLY',   label: 'RALLY',   blurb: '+50% rate · bigger radius',  badge: '#ff8ac8', glyph: '◆', dmgMul: 1.0, rangeMul: 1.4, rateMul: 1.0, bannerFireBoost: 0.5 },
    B: { id: 'MARCH',   label: 'MARCH',   blurb: '+50% range · adj towers',    badge: '#5ef38c', glyph: '▲', dmgMul: 1.0, rangeMul: 1.0, rateMul: 1.0, bannerRangeBoost: 0.5 },
  },
};
function getPathDef(tw) {
  if (!tw.path) return null;
  const map = TOWER_PATHS[tw.type];
  return map && map[tw.path] ? map[tw.path] : null;
}

const ENEMIES = {
  squirrel: { name: 'squirrel', hp: 14, speed: 1.6, gold: 5,  color: '#a06030', size: 10, air: false },
  cat:      { name: 'cat',      hp: 40, speed: 1.0, gold: 10, color: '#222',    size: 12, air: false },
  tank:     { name: 'tank',     hp: 180, speed: 0.6, gold: 25, color: '#5a3a14', size: 16, air: false },
  bird:     { name: 'bird',     hp: 30, speed: 1.8, gold: 12, color: '#5ef38c', size: 11, air: true },
  boss:     { name: 'BOSS',     hp: 1500, speed: 0.5, gold: 250, color: '#b055ff', size: 22, air: false },
  // ROUND-2 NEW: PUG ELITE — chunky orange pug-cat. High HP, summons 3 squirrels on death.
  elite:    { name: 'PUG ELITE', hp: 320, speed: 0.75, gold: 45, color: '#c8854a', size: 17, air: false, summonOnDeath: 3 },
};

// Track endless-mode state: waves > 15 are procedurally generated and
// escalate forever. Boss waves every 5 waves get a unique modifier
// (REGEN, SPLITTER, SUMMONER) chosen by wave index.
let endlessMode = false;
const BOSS_MODIFIERS = ['REGEN', 'SPLITTER', 'SUMMONER'];
function generateEndlessWave(idx) {
  // idx is 1-based wave number (16, 17, 18, ...). Round-2: gentler ramp +
  // include PUG ELITE so endless feels distinct from late campaign.
  const base = idx - 15;
  const w = {};
  // Soften squirrel/cat ramp so wave 20+ doesn't bury the player.
  w.squirrel = 18 + Math.floor(base * 3);
  w.cat = 8 + Math.floor(base * 1.6);
  w.bird = 5 + Math.floor(base * 1.1);
  w.tank = Math.max(1, Math.floor(base * 0.6));
  w.elite = 2 + Math.floor(base * 0.5);
  // Every 5 waves: also queue an extra boss (handled separately by spawn)
  return w;
}
const WAVES = [
  { squirrel: 6 },
  { squirrel: 10, cat: 2 },
  { squirrel: 14, cat: 4 },
  { cat: 10, bird: 4 },
  { squirrel: 20, tank: 1 },
  { cat: 12, bird: 8 },
  { tank: 4, squirrel: 16, elite: 1 },           // First elite at wave 7
  { bird: 12, cat: 8 },
  { tank: 8, cat: 8, elite: 2 },                 // 2 elites at wave 9
  { squirrel: 30, bird: 6 },
  { tank: 6, bird: 10, cat: 10, elite: 2 },
  { bird: 18, tank: 4 },
  { tank: 12, squirrel: 25, elite: 3 },
  { tank: 8, cat: 20, bird: 14, elite: 3 },
  { boss: 1, tank: 10, bird: 10, elite: 4 },
];

let money, lives, waveIdx, enemies, towers, projectiles, particles, popups, running, spawnQueue, spawnT, betweenWaveT, inWave, selectedTowerType, selectedTower;
// ROUND-2 POLISH: wave history (last 5 entries) — { wave, kills, livesLost, gold }.
let waveHistory = [];
let _waveStartStats = { money: 100, lives: 10, kills: 0 };
let _totalKills = 0;
// Day/night cycle — 0..1, increases per wave (waves 1..15 = day → night)
function dayNightT() {
  // Endless waves keep night
  return Math.min(1, (waveIdx || 0) / 15);
}
// Returns an RGBA color for the night overlay (low-alpha blue → midnight)
function nightOverlayRGBA() {
  const t = dayNightT();
  if (t <= 0) return 'rgba(0,0,0,0)';
  return `rgba(20, 30, 80, ${0.35 * t})`;
}

// SYNERGY DETECTION — pre-computed per-frame map of synergies between
// adjacent towers. Returns: { tower-index: [{ type, label, color }] }.
function computeSynergies() {
  const map = new Map();
  if (!towers || towers.length < 2) return map;
  for (let i = 0; i < towers.length; i++) {
    for (let j = i + 1; j < towers.length; j++) {
      const a = towers[i], b = towers[j];
      const d = Math.hypot(a.col - b.col, a.row - b.row);
      if (d > 1.5) continue; // only direct neighbors
      // FROST + CANNON → DEEP FREEZE (cannon does +50% dmg)
      const types = new Set([a.type, b.type]);
      let syn = null;
      if (types.has('frost') && types.has('cannon')) syn = { label: 'DEEP FREEZE', color: '#b0e8ff' };
      else if (types.has('gatling') && types.has('buff')) syn = { label: 'OVERCLOCK', color: '#ff8e3c' };
      else if (types.has('sniper') && types.has('tar')) syn = { label: 'STICKY SHOT', color: '#5ef38c' };
      else if (types.has('teleport') && types.has('frost')) syn = { label: 'TIME LOCK', color: '#b055ff' };
      else if (types.has('bone') && types.has('basic')) syn = { label: 'PACK HUNTER', color: '#eae0c0' };
      if (syn) {
        const li = map.get(i) || []; li.push(syn); map.set(i, li);
        const lj = map.get(j) || []; lj.push(syn); map.set(j, lj);
      }
    }
  }
  return map;
}
function towerHasSynergy(tw, label) {
  if (!towers) return false;
  const idx = towers.indexOf(tw);
  if (idx < 0) return false;
  const syns = _synergyCache.get(idx);
  return !!(syns && syns.some((s) => s.label === label));
}
let _synergyCache = new Map();
let runId = 0;
let _lastFireSfxT = 0;
// Shared speed-toggle multiplier — set by createSpeedToggle (1/2/3)
let __speedMult = 1;
// Screen-shake state (canvas translate during render) + wave banner
let shakeT = 0, shakeMag = 0, waveBannerT = 0, waveBannerText = '', vaultFlashT = 0;
// Hit-pause — short freeze on major events (mini-boss kill, vault hit, etc).
let _tdHitstopT = 0;
function screenShake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function spawnPopup(x, y, text, color = '#5ef38c') {
  // Slight random angle + horizontal drift so back-to-back popups don't stack.
  const a = (Math.random() - 0.5) * 0.7;
  popups.push({
    x: x + Math.cos(a) * 6,
    y: y + (Math.random() - 0.5) * 4,
    vx: Math.sin(a) * 18,
    text, color, t: 0, life: 0.9,
  });
}

function reset() {
  money = 100; lives = 10; waveIdx = 0;
  enemies = []; towers = []; projectiles = []; particles = []; popups = [];
  spawnQueue = []; spawnT = 0; betweenWaveT = 0; inWave = false;
  selectedTowerType = null; selectedTower = null;
  shakeT = 0; shakeMag = 0; waveBannerT = 0; vaultFlashT = 0; _tdHitstopT = 0;
  endlessMode = false;
  _placeMode = false;
  waveHistory = []; _totalKills = 0;
  _waveStartStats = { money: 100, lives: 10, kills: 0 };
  _updateWaveHistoryDom();
  // Apply persistent talent buffs to starting money
  try {
    const t = loadTalents();
    if (t.bonusGold) money += t.bonusGold;
    if (t.bonusLives) lives += t.bonusLives;
  } catch {}
}

// ===== TALENT TREE — persistent stars earned by perfect-clearing maps.
// Stars are spent globally on tiny passive buffs that apply to all maps.
const TALENT_KEY = 'pug-td:talents';
function loadTalents() {
  try { return JSON.parse(localStorage.getItem(TALENT_KEY)) || { stars: 0, spent: 0, bonusGold: 0, bonusLives: 0, bonusDmg: 0 }; }
  catch { return { stars: 0, spent: 0, bonusGold: 0, bonusLives: 0, bonusDmg: 0 }; }
}
function saveTalents(t) {
  try { localStorage.setItem(TALENT_KEY, JSON.stringify(t)); } catch {}
}
function awardTalentStars(n) {
  const t = loadTalents();
  t.stars = (t.stars || 0) + n;
  saveTalents(t);
}

// Place-tower-mode toggle (P): persistent placement — selected tower stays
// armed after placement so you can drop several quickly. Press P again to exit.
let _placeMode = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    _placeMode = !_placeMode;
    try { sfx.tone(_placeMode ? 880 : 440, 'square', 0.05, 0.14); } catch {}
  }
});

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
  const isEndlessNext = waveIdx >= WAVES.length;
  wv.textContent = inWave
    ? `WAVE ${waveIdx} RUNNING`
    : (isEndlessNext
        ? `▶ ENDLESS WAVE ${waveIdx + 1}`
        : `▶ START WAVE ${waveIdx + 1}/${WAVES.length}`);
  wv.disabled = inWave;
  if (inWave) wv.style.opacity = 0.5;
  wv.addEventListener('click', () => {
    if (inWave) return;
    if (waveIdx < WAVES.length || endlessMode) startWave();
  });
  bar.appendChild(wv);
}

function hidePopup() { document.getElementById('tower-popup').style.display = 'none'; }
// Effective stats for a tower (level + chosen path mul). Used by render + fire.
function effDmg(tw)   { const def = TOWERS[tw.type]; const p = getPathDef(tw); return def.dmg   * (1 + tw.level * 0.25) * (p ? p.dmgMul   : 1); }
function effRange(tw) { const def = TOWERS[tw.type]; const p = getPathDef(tw); return def.range * (1 + tw.level * 0.15) * (p ? p.rangeMul : 1); }
function effRate(tw)  { const def = TOWERS[tw.type]; const p = getPathDef(tw); const cd = def.cd / (1 + tw.level * 0.2) / (p ? p.rateMul : 1); return 1 / cd; }
function effCd(tw)    { const def = TOWERS[tw.type]; const p = getPathDef(tw); return def.cd / (1 + tw.level * 0.2) / (p ? p.rateMul : 1); }
function showTowerPopup(t) {
  const el = document.getElementById('tower-popup');
  const def = TOWERS[t.type];
  // 1.5× base cost scaling per level: Lv2 = 1.5×base, Lv3 = 3×base, Lv4 = 4.5×base
  const upCost = Math.floor(def.cost * 1.5 * (t.level + 1));
  // Current stats (path-aware)
  const dmgNow   = effDmg(t);
  const rangeNow = effRange(t);
  const rateNow  = effRate(t);
  // Path-fork condition: tower is at level 2 (t.level === 1) and has no path
  // chosen yet. In this state, the regular upgrade is replaced by a PATH
  // PICKER. Picking a path commits it and bumps the tower to Lv3 (level=2).
  const paths = TOWER_PATHS[t.type];
  const needsPathChoice = !t.path && t.level === 1 && !!paths;
  const isMax = t.level >= 3;
  const nextLvl  = t.level + 1;
  // For preview row (only shown for regular upgrades, not at the fork point)
  let upgradePreview;
  if (needsPathChoice) {
    upgradePreview = `<div class="upgrade-preview">
      <div class="row" style="justify-content:center;"><b style="color:var(--neon-pink)">★ CHOOSE A PATH ★</b></div>
      <div class="row" style="justify-content:center;font-size:0.4rem;color:var(--text-soft);">paths are PERMANENT</div>
    </div>`;
  } else if (isMax) {
    upgradePreview = `<div class="upgrade-preview"><div class="row" style="justify-content:center;"><b style="color:var(--neon-yellow)">★ MAX LEVEL ★</b></div></div>`;
  } else {
    // Build a temp "next-tower" object to compute path-aware preview stats.
    const next = { ...t, level: nextLvl };
    const dmgNext   = effDmg(next);
    const rangeNext = effRange(next);
    const rateNext  = effRate(next);
    const dmgDelta   = dmgNext   - dmgNow;
    const rangeDelta = rangeNext - rangeNow;
    const rateDelta  = rateNext  - rateNow;
    // Hide delta when there's no change (e.g. BUFF tower) for cleaner UI.
    const _fmtDelta = (d, places) => d > 0.05 ? ` <span class="delta">+${d.toFixed(places)}</span>` : '';
    upgradePreview = `<div class="upgrade-preview">
        <div class="row" style="justify-content:center;"><b style="color:var(--neon-cyan)">NEXT: Lv ${nextLvl + 1}</b></div>
        <div class="row"><span>DMG</span><b>${dmgNext.toFixed(0)}${_fmtDelta(dmgDelta, 0)}</b></div>
        <div class="row"><span>RANGE</span><b>${rangeNext.toFixed(1)}${_fmtDelta(rangeDelta, 1)}</b></div>
        <div class="row"><span>RATE</span><b>${rateNext.toFixed(1)}/s${_fmtDelta(rateDelta, 1)}</b></div>
      </div>`;
  }
  const canAfford = money >= upCost;
  // Show chosen path badge in header if committed
  const pathDef = getPathDef(t);
  const pathTag = pathDef
    ? `<span style="color:${pathDef.badge};font-size:0.4rem;letter-spacing:0.08em;">${pathDef.glyph} ${pathDef.label}</span>`
    : '';
  // Path-pick UI: two buttons side-by-side
  let pathButtons = '';
  if (needsPathChoice) {
    const pA = paths.A, pB = paths.B;
    pathButtons = `
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button id="path-a" style="flex:1;border-color:${pA.badge};color:${pA.badge};">
          <div style="font-size:0.55rem;">${pA.glyph} ${pA.label}</div>
          <div style="font-size:0.4rem;color:var(--text-soft);margin-top:2px;">${pA.blurb}</div>
          <div style="font-size:0.4rem;color:var(--neon-yellow);margin-top:2px;">$${upCost}</div>
        </button>
        <button id="path-b" style="flex:1;border-color:${pB.badge};color:${pB.badge};">
          <div style="font-size:0.55rem;">${pB.glyph} ${pB.label}</div>
          <div style="font-size:0.4rem;color:var(--text-soft);margin-top:2px;">${pB.blurb}</div>
          <div style="font-size:0.4rem;color:var(--neon-yellow);margin-top:2px;">$${upCost}</div>
        </button>
      </div>`;
  }
  // ROUND-2 POLISH: list any active synergies for this tower.
  const tIdx = towers.indexOf(t);
  const tSyns = tIdx >= 0 ? (_synergyCache.get(tIdx) || []) : [];
  const synergyHtml = tSyns.length
    ? `<div class="row" style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--border);">
         <span style="color:var(--neon-pink);">SYNERGY</span>
         <b style="color:${tSyns[0].color};">${tSyns.map(s => s.label).join(', ')}</b>
       </div>`
    : '';
  const refundAmt = Math.floor(t.totalCost * 0.6);
  el.innerHTML = `
    <div class="row"><b>${def.icon} ${def.name}</b><span>Lv ${t.level + 1} ${pathTag}</span></div>
    <div class="row"><span>DMG</span><b>${dmgNow.toFixed(0)}</b></div>
    <div class="row"><span>RANGE</span><b>${rangeNow.toFixed(1)}</b></div>
    <div class="row"><span>RATE</span><b>${rateNow.toFixed(1)}/s</b></div>
    <div class="row"><span>TARGET</span><b id="targ-label">${t.targeting || 'FIRST'} · ${TARGETING_LABEL[t.targeting || 'FIRST']}</b></div>
    ${synergyHtml}
    ${upgradePreview}
    <button id="targ-btn">↻ CHANGE TARGETING</button>
    ${needsPathChoice
      ? pathButtons
      : `<button id="up-btn"${isMax || !canAfford ? ' disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>${isMax ? 'MAX LEVEL' : `⬆ UPGRADE — $${upCost}`}</button>`}
    <button id="sell-btn" class="sell">SELL · REFUND $${refundAmt}</button>
  `;
  el.style.display = 'block';
  document.getElementById('targ-btn').addEventListener('click', () => {
    const cur = TARGETING_MODES.indexOf(t.targeting || 'FIRST');
    t.targeting = TARGETING_MODES[(cur + 1) % TARGETING_MODES.length];
    sfx.tone(550, 'square', 0.06, 0.16);
    showTowerPopup(t);
  });
  if (needsPathChoice) {
    const commit = (which) => {
      if (money < upCost) return;
      money -= upCost; t.level++; t.totalCost += upCost;
      t.path = which;
      sfx.arp([523, 784, 1047], 'triangle', 0.08, 0.22, 0.22);
      spawnPopup((t.col + 0.5) * TILE + gridOffsetX(), (t.row + 0.5) * TILE + gridOffsetY(), `${paths[which].label} PATH!`, paths[which].badge);
      showTowerPopup(t); updateHud(); buildBar();
    };
    const aBtn = document.getElementById('path-a');
    const bBtn = document.getElementById('path-b');
    if (aBtn) { if (!canAfford) { aBtn.disabled = true; aBtn.style.opacity = 0.5; } aBtn.addEventListener('click', () => commit('A')); }
    if (bBtn) { if (!canAfford) { bBtn.disabled = true; bBtn.style.opacity = 0.5; } bBtn.addEventListener('click', () => commit('B')); }
  } else {
    const upBtn = document.getElementById('up-btn');
    if (upBtn) upBtn.addEventListener('click', () => {
      if (money < upCost || t.level >= 3) return;
      money -= upCost; t.level++; t.totalCost += upCost;
      sfx.tone(660, 'triangle', 0.1, 0.22);
      showTowerPopup(t); updateHud();
    });
  }
  document.getElementById('sell-btn').addEventListener('click', () => {
    money += Math.floor(t.totalCost * 0.6);
    towers = towers.filter((x) => x !== t);
    selectedTower = null;
    hidePopup(); buildBar(); updateHud();
  });
}

canvas.addEventListener('mousedown', (e) => handleClick(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; handleClick(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
// Desktop hover preview — while the user hasn't selected a tower for upgrade,
// hovering an existing tower opens the upgrade-preview popup. Leaves the
// click-to-select model intact; clicking simply pins the popup (it was already
// pinned before this hover was added). On touch devices, mouseover doesn't
// fire so this is a no-op.
let _hoverTower = null;
canvas.addEventListener('mousemove', (e) => {
  if (!running) return;
  const x = e.clientX, y = e.clientY;
  const c = Math.floor((x - gridOffsetX()) / TILE);
  const r = Math.floor((y - gridOffsetY()) / TILE);
  const found = towers.find((t) => t.col === c && t.row === r) || null;
  if (found === _hoverTower) return;
  _hoverTower = found;
  // Don't override a click-pinned selection
  if (selectedTower) return;
  if (found) showTowerPopup(found); else hidePopup();
});
canvas.addEventListener('mouseleave', () => {
  _hoverTower = null;
  if (!selectedTower) hidePopup();
});
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
    // `placeT` drives a quick squash → settle scale ramp inside drawTower.
    towers.push({
      type: selectedTowerType, col: c, row: r, cd: 0, level: 0,
      totalCost: t.cost, targeting: 'FIRST', bob: Math.random() * Math.PI * 2,
      placeT: 0,
    });
    // Two-tone thud (sub-bass + click) for placement "thunk".
    sfx.tone(140, 'sine', 0.18, 0.35);
    sfx.tone(880, 'triangle', 0.08, 0.22);
    // Brief screen shake — anchors the placement.
    screenShake(2.5, 0.14);
    // Dust ring + sparks at placement cell so player sees the impact.
    const px = (c + 0.5) * TILE + gridOffsetX();
    const py = (r + 0.5) * TILE + gridOffsetY();
    particles.push({ x: px, y: py, t: 0, life: 0.35, ring: true, maxR: 26, color: '#c8a878' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = 70 + Math.random() * 50;
      particles.push({
        x: px, y: py,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        color: '#c8a878', life: 0.5, t: 0, size: 3,
      });
    }
    if (!_placeMode) selectedTowerType = null;
    buildBar(); updateHud();
  } else {
    hidePopup(); selectedTower = null;
  }
}

function startWave() {
  if (inWave) return;
  // After campaign waves: keep generating endless waves.
  if (waveIdx >= WAVES.length && !endlessMode) return;
  // Bonus money for calling early (Kingdom Rush mechanic). Pop a yellow text
  // near the vault so the player sees the reward.
  if (betweenWaveT > 0) {
    const early = Math.floor(betweenWaveT * 5);
    money += early;
    if (early > 0 && currentMap?.path) {
      const vlast = currentMap.path[currentMap.path.length - 1];
      spawnPopup(vlast[0] * TILE + gridOffsetX() + TILE / 2, vlast[1] * TILE + gridOffsetY() - 6, `EARLY +$${early}`, '#ffd23f');
    }
    betweenWaveT = 0;
  }
  // Pick from campaign waves or generate endless wave
  const wv = waveIdx < WAVES.length ? WAVES[waveIdx] : generateEndlessWave(waveIdx + 1);
  spawnQueue = [];
  for (const [type, count] of Object.entries(wv)) {
    for (let i = 0; i < count; i++) spawnQueue.push(type);
  }
  // Shuffle spawn order
  spawnQueue.sort(() => Math.random() - 0.5);
  // Mini-boss every 5 waves (1-based)
  const oneBased = waveIdx + 1;
  if (oneBased % 5 === 0) {
    spawnQueue.push('__MINIBOSS__');
  }
  inWave = true; spawnT = 0;
  waveIdx++;
  // ROUND-2: snapshot stats for wave-history summary
  _waveStartStats = { money: money, lives: lives, kills: _totalKills };
  waveBannerText = endlessMode || waveIdx > 15 ? `★ ENDLESS WAVE ${waveIdx} ★` : `WAVE ${waveIdx}`;
  waveBannerT = 1.4;
  // Bottom-center "incoming" wave preview (icons + counts + mini-boss flag)
  try {
    const enemyIcons = { squirrel: '🐿️', cat: '🐱', tank: '🛡️', bird: '🐦', boss: '👹', elite: '★' };
    const enemyList = Object.entries(wv).map(([type, count]) => ({
      icon: enemyIcons[type] || '?', count, label: type.toUpperCase(),
    }));
    if (oneBased === 5 || oneBased === 10 || oneBased === 15) {
      enemyList.push({ icon: '★', count: 1, label: 'MINI-BOSS' });
    }
    showWavePreview({ wave: waveIdx, enemies: enemyList, duration: 2400, color: oneBased === 15 ? '#b055ff' : '#ff3aa1' });
  } catch (e) { /* preview is non-critical */ }
  buildBar();
}

let miniBossBannerT = 0, miniBossBannerText = '';
function spawnMiniBoss() {
  // 5× scaled cat with crown. Drops big money on kill.
  // Boss modifier rotates every wave: REGEN / SPLITTER / SUMMONER.
  // Round-2 tune: gentler HP curve (0.5 → 0.35 per wave) so endless waves
  // 20+ don't have unkillable mini-bosses. Damage scaling kept the same.
  const modifier = BOSS_MODIFIERS[Math.floor(waveIdx / 5) % BOSS_MODIFIERS.length];
  const base = ENEMIES.cat;
  const hpMul = 5 + waveIdx * 0.35;
  enemies.push({
    type: 'miniboss', def: { ...base, name: 'MINI-BOSS', color: '#ffd23f', size: 18 },
    hp: base.hp * hpMul, maxHp: base.hp * hpMul,
    speed: base.speed * 0.85, slowT: 0, slowMul: 1,
    pathIdx: 0,
    x: currentMap.path[0][0] + 0.5, y: currentMap.path[0][1] + 0.5,
    alive: true, miniboss: true, bossMod: modifier,
    summonT: 0,
  });
  miniBossBannerText = `★ MINI-BOSS — ${modifier} ★`;
  miniBossBannerT = 2;
  // Cinematic intro shake — longer + heavier so MINI-BOSS arrival reads.
  screenShake(9, 0.55);
  sfx.sweep(110, 60, 'sawtooth', 0.5, 0.3);
  // Bass thud — gives the intro a sub-low layer.
  sfx.tone(60, 'sine', 0.4, 0.5);
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
  // Hit-pause — freeze gameplay (still tick ambient + popups + shake decay
  // so the moment doesn't feel completely dead).
  if (_tdHitstopT > 0) {
    _tdHitstopT -= dt;
    tickAmbient(dt);
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    return;
  }
  // ROUND-2 POLISH: lose-preview slow-mo. When lives==1 and an enemy is
  // about to reach the vault, slow gameplay to 0.45× so the loss feels
  // intentional + the player can see it happen.
  if (lives === 1) {
    for (const e of enemies) {
      if (!e.alive) continue;
      // Within last ~3 path nodes of the vault?
      if (e.pathIdx >= currentMap.path.length - 4) {
        dt = dt * 0.45;
        break;
      }
    }
  }
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
      const bonus = 25 + waveIdx * 6;
      money += bonus;
      // ROUND-2: log wave stats into history (last 5 kept)
      const killsThisWave = _totalKills - _waveStartStats.kills;
      const livesLost = _waveStartStats.lives - lives;
      const goldEarned = money - _waveStartStats.money;
      waveHistory.unshift({ wave: waveIdx, kills: killsThisWave, livesLost, gold: goldEarned });
      if (waveHistory.length > 5) waveHistory.length = 5;
      _updateWaveHistoryDom();
      // Wave-complete pop near the vault — bigger celebratory ring + golden burst.
      const vlast = currentMap.path[currentMap.path.length - 1];
      const vx = vlast[0] * TILE + gridOffsetX() + TILE / 2;
      const vy = vlast[1] * TILE + gridOffsetY() - 6;
      spawnPopup(vx, vy, `WAVE CLEAR  +$${bonus}`, '#ffd23f');
      screenShake(4, 0.22);
      // Round-2 polish: tower-row dance — kick every tower into a small
      // staggered bounce by setting their placeT back to 0 with offsets.
      for (let twi = 0; twi < towers.length; twi++) {
        const tw = towers[twi];
        tw.placeT = -twi * 0.04;     // negative = delayed start, ripples L→R
      }
      // Camera zoom-pan hint — bigger shake + brief vault pulse.
      vaultFlashT = 0.5;
      screenShake(7, 0.45);
      // Two expanding rings + sparkle ring of particles
      particles.push({ x: vx, y: vy + 6, t: 0, life: 0.6, ring: true, maxR: 60, color: '#ffd23f' });
      particles.push({ x: vx, y: vy + 6, t: 0, life: 0.7, ring: true, maxR: 90, color: '#5ef38c' });
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const s = 80 + Math.random() * 70;
        particles.push({
          x: vx, y: vy + 6,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          color: i % 2 ? '#ffd23f' : '#fff0a0',
          life: 0.7, t: 0, size: 4,
        });
      }
      // Richer victory chime — 4-note major arp + bell-top.
      sfx.arp([523, 659, 784, 1047], 'triangle', 0.07, 0.22, 0.18);
      sfx.tone(1568, 'sine', 0.06, 0.25);
      // Win — but allow endless mode! After clearing wave 15, flip endless
      // and show a celebratory banner; player can call further waves.
      if (waveIdx >= WAVES.length && !endlessMode) {
        endlessMode = true;
        miniBossBannerText = '★ VAULT SAFE — ENDLESS MODE UNLOCKED ★';
        miniBossBannerT = 3;
        // Award stars for clearing the map (talent currency, persistent).
        try { awardTalentStars(lives === 10 ? 3 : (lives > 5 ? 2 : 1)); } catch {}
        sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.08, 0.25, 0.25);
      }
      buildBar();
    }
  } else if (betweenWaveT > 0) {
    betweenWaveT -= dt;
  }

  // Enemies move
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
    // DOT (toxic tar) + NAPALM (cannon NAPALM) damage-over-time
    if (e.dotT > 0)     { e.dotT -= dt;     if (e.dotT > 0)     e.hp -= (e.dotDps     || 0) * dt; }
    if (e.napalmT > 0)  { e.napalmT -= dt;  if (e.napalmT > 0)  e.hp -= (e.napalmDps  || 0) * dt; }
    // Boss modifier ticks
    if (e.miniboss && e.bossMod) {
      if (e.bossMod === 'REGEN' && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
      } else if (e.bossMod === 'SUMMONER') {
        e.summonT = (e.summonT || 0) + dt;
        if (e.summonT >= 2.5) {
          e.summonT = 0;
          // Spawn a squirrel right at the boss's path position
          enemies.push({
            type: 'squirrel', def: ENEMIES.squirrel,
            hp: ENEMIES.squirrel.hp, maxHp: ENEMIES.squirrel.hp,
            speed: ENEMIES.squirrel.speed, slowT: 0, slowMul: 1,
            pathIdx: e.pathIdx, x: e.x, y: e.y, alive: true,
          });
          particles.push({ x: e.x * TILE + gridOffsetX(), y: e.y * TILE + gridOffsetY(), t: 0, life: 0.4, ring: true, maxR: 26, color: '#b055ff' });
        }
      }
    }
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
  // Perf: prune in-place via reverse-iter splice — avoids per-frame realloc.
  for (let i = enemies.length - 1; i >= 0; i--) if (!enemies[i].alive) enemies.splice(i, 1);

  // Refresh synergy cache (cheap — at most ~30 towers in practice)
  _synergyCache = computeSynergies();
  // Towers fire
  for (const tw of towers) {
    if (tw.placeT != null && tw.placeT < 0.35) tw.placeT += dt;
    const def = TOWERS[tw.type];
    const path = getPathDef(tw);
    // BANK path: passive income (BUFF tower, BANK chosen)
    if (path && path.incomeSec) {
      tw._bankT = (tw._bankT || 0) + dt;
      while (tw._bankT >= 1) {
        tw._bankT -= 1;
        money += path.incomeSec;
        spawnPopup((tw.col + 0.5) * TILE + gridOffsetX(), (tw.row + 0.5) * TILE + gridOffsetY() - 6, `+$${path.incomeSec}`, '#5ef38c');
      }
    }
    if (def.buff || def.bannerBoost) continue; // buff / banner towers don't fire
    tw.cd -= dt;
    if (tw.cd > 0) continue;
    // find a buff (path-aware: COMMAND path = +60% aura)
    let buffMult = 1;
    // Round-2: banner-tower bonuses (fire rate + range) stack on top of buffs.
    let bannerRateMul = 1;
    let bannerRangeMul = 1;
    for (const b of towers) {
      if (b === tw) continue;
      const bd = TOWERS[b.type];
      if (bd.buff) {
        const bp = getPathDef(b);
        const bRange = bd.range * (bp ? bp.rangeMul : 1);
        if (Math.hypot(b.col - tw.col, b.row - tw.row) <= bRange) {
          const bMul = bp && bp.buffBoost ? bp.buffBoost : bd.buff;
          buffMult = Math.max(buffMult, bMul);
        }
      } else if (bd.bannerBoost) {
        const bp = getPathDef(b);
        const bRange = bd.range * (bp ? bp.rangeMul : 1);
        if (Math.hypot(b.col - tw.col, b.row - tw.row) <= bRange) {
          const fireBoost = (bp && bp.bannerFireBoost) || bd.bannerFireRate || 0;
          const rangeBoost = (bp && bp.bannerRangeBoost) || bd.bannerRange || 0;
          bannerRateMul = Math.max(bannerRateMul, 1 + fireBoost);
          bannerRangeMul = Math.max(bannerRangeMul, 1 + rangeBoost);
        }
      }
    }
    const range = effRange(tw) * bannerRangeMul;
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
    // Round-2 polish: smoothly rotate the tower's barrel toward the target.
    // If the angle delta is > 0.4 rad we DON'T fire this tick — barrel keeps
    // rotating, so the visual aim-then-shoot reads cleanly.
    const tCx = (tw.col + 0.5);
    const tCy = (tw.row + 0.5);
    const aimTarget = Math.atan2(target.y - tCy, target.x - tCx);
    if (tw.aimAngle == null) tw.aimAngle = aimTarget;
    let aimDelta = aimTarget - tw.aimAngle;
    while (aimDelta > Math.PI) aimDelta -= Math.PI * 2;
    while (aimDelta < -Math.PI) aimDelta += Math.PI * 2;
    tw.aimAngle += aimDelta * Math.min(1, 12 * dt); // ease rotation
    // If still aiming too wide, delay the shot one frame.
    if (Math.abs(aimDelta) > 0.35) { tw.cd = 0.02; continue; }
    // Fire — base dmg/cd from path-aware effective values
    let dmg = effDmg(tw) * buffMult;
    // SYNERGY damage bonuses
    if (towerHasSynergy(tw, 'DEEP FREEZE') && tw.type === 'cannon') dmg *= 1.5;
    if (towerHasSynergy(tw, 'OVERCLOCK')   && tw.type === 'gatling') dmg *= 1.3;
    if (towerHasSynergy(tw, 'STICKY SHOT') && tw.type === 'sniper')  dmg *= 1.4;
    if (towerHasSynergy(tw, 'PACK HUNTER') && tw.type === 'basic')   dmg *= 1.3;
    // Persistent talent: bonus dmg
    try { const tal = loadTalents(); if (tal.bonusDmg) dmg *= (1 + tal.bonusDmg); } catch {}
    tw.cd = effCd(tw) / bannerRateMul;
    // CRIT path: random 15% chance ×3
    let isCrit = false;
    if (path && path.crit && Math.random() < path.crit) { dmg *= (path.critMul || 3); isCrit = true; }
    // SCOPE: crit when firing on a full-HP target
    if (path && path.fullHpCrit && target.hp >= target.maxHp - 0.01) { dmg *= (path.critMul || 2); isCrit = true; }
    // SHATTER: ×2 vs slowed enemies (frost SHATTER)
    if (path && path.shatter && target.slowT > 0) { dmg *= 2; isCrit = true; }
    // Spawn projectiles. SPREAD = 5 pellets in a small arc; SLUG = single
    // heavy shot (already covered by dmgMul + knockback flag). Default = 1.
    const baseProjArgs = {
      target, dmg, color: def.projColor,
      splash: (def.splash || 0) * (path && path.splashMul ? path.splashMul : 1),
      slow: Math.max(def.slow || 0, path && path.slowBoost ? path.slowBoost : 0),
      slowDur: Math.max(def.slowDur || 0, path && path.slowDurBoost ? path.slowDurBoost : 0),
      boomerang: !!def.boomerang,
      boomerangBounces: path && path.boomerangBounces ? path.boomerangBounces : (def.boomerang ? 1 : 0),
      pierce: path && path.pierce ? path.pierce : 0,
      pierceHit: [],
      knockback: !!(path && path.knockback),
      napalm: !!(path && path.napalm),
      dotPerSec: path && path.dotPerSec ? path.dotPerSec : 0,
      teleport: !!def.teleport,
      warpAmt: path && path.warpAmt ? path.warpAmt : 3,
      warpChaos: !!(path && path.warpChaos),
      crit: isCrit,
      sourceType: tw.type,
      sourcePath: tw.path,
      speed: 800, dead: false,
      origX: (tw.col + 0.5) * TILE + gridOffsetX(),
      origY: (tw.row + 0.5) * TILE + gridOffsetY(),
    };
    const spreadCount = (path && path.spreadCount) ? path.spreadCount : 1;
    if (spreadCount > 1) {
      // SPREAD: fan out toward the target with a wider angle than the base
      // gatling's natural spray.
      const ox = (tw.col + 0.5) * TILE + gridOffsetX();
      const oy = (tw.row + 0.5) * TILE + gridOffsetY();
      const tx = target.x * TILE + gridOffsetX();
      const ty = target.y * TILE + gridOffsetY();
      const baseAng = Math.atan2(ty - oy, tx - ox);
      const arc = 0.6; // ~35deg total
      for (let i = 0; i < spreadCount; i++) {
        const t01 = spreadCount === 1 ? 0.5 : i / (spreadCount - 1);
        const a = baseAng - arc / 2 + arc * t01;
        // Synthesize a "virtual target" point so the existing projectile
        // homing code reaches the swept angle. We use the closest enemy
        // along this ray instead — fall back to actual target.
        const reachX = ox + Math.cos(a) * range * TILE;
        const reachY = oy + Math.sin(a) * range * TILE;
        // Find nearest enemy to that ray point
        let bestE = target, bestD = Infinity;
        for (const e of enemies) {
          if (!e.alive) continue;
          if (e.def.air && !def.hitsAir) continue;
          const dd = Math.hypot(e.x * TILE + gridOffsetX() - reachX, e.y * TILE + gridOffsetY() - reachY);
          if (dd < bestD) { bestD = dd; bestE = e; }
        }
        projectiles.push({
          ...baseProjArgs, target: bestE,
          x: ox, y: oy,
          pierceHit: [], // own array per pellet
        });
      }
    } else {
      projectiles.push({
        ...baseProjArgs,
        x: (tw.col + 0.5) * TILE + gridOffsetX(),
        y: (tw.row + 0.5) * TILE + gridOffsetY(),
      });
    }
    // Splash-tower (cannon) gets a meatier sawtooth; everything else stays light.
    // Throttle to ~12 fire-tones per second total so 8 gatling towers don't
    // saturate the audio context.
    if (!_lastFireSfxT || performance.now() - _lastFireSfxT > 80) {
      sfx.tone(440 + Math.random() * 200, def.splash ? 'sawtooth' : 'square', 0.04, 0.12);
      _lastFireSfxT = performance.now();
    }
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
          if (dd < p.splash * TILE) {
            e.hp -= p.dmg;
            // NAPALM: leave a burning ground patch (handled via short-lived
            // ground particles + persistent DOT on enemies inside)
            if (p.napalm) { e.napalmT = Math.max(e.napalmT || 0, 2.5); e.napalmDps = 6; }
          }
        }
        particles.push({ x: tx, y: ty, t: 0, life: p.napalm ? 1.2 : 0.4, ring: true, maxR: p.splash * TILE, color: p.napalm ? '#ff5a3a' : p.color });
      } else if (p.target.alive) {
        // PIERCE handling — apply damage, mark target as hit, then re-aim to
        // a fresh enemy along the trajectory until pierce budget exhausted.
        const applyHit = (e) => {
          e.hp -= p.dmg;
          if (p.slow > 0) {
            e.slowMul = Math.min(e.slowMul, 1 - p.slow);
            e.slowT = p.slowDur;
          }
          if (p.knockback) {
            // shove enemy back along its path by ~0.7 tile (reduces pathIdx)
            e.pathIdx = Math.max(0, e.pathIdx - 1);
            e.slowMul = Math.min(e.slowMul, 0.5);
            e.slowT = Math.max(e.slowT, 0.4);
          }
          if (p.dotPerSec) {
            e.dotT = Math.max(e.dotT || 0, 2.5);
            e.dotDps = Math.max(e.dotDps || 0, p.dotPerSec);
          }
          if (p.crit) {
            // Round-2 polish: golden particle burst + ring + popup. Much
            // splashier than the old single ring so crit is clearly readable.
            const cx = e.x * TILE + gridOffsetX();
            const cy = e.y * TILE + gridOffsetY();
            particles.push({ x: cx, y: cy, t: 0, life: 0.45, ring: true, maxR: 28, color: '#ffd23f' });
            particles.push({ x: cx, y: cy, t: 0, life: 0.6, ring: true, maxR: 44, color: '#ff8a3a' });
            for (let bi = 0; bi < 10; bi++) {
              const ang = (bi / 10) * Math.PI * 2;
              const sp = 110 + Math.random() * 60;
              particles.push({
                x: cx, y: cy,
                vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                color: bi % 2 ? '#ffd23f' : '#fff0a8',
                life: 0.55, t: 0, size: 4,
              });
            }
            spawnPopup(cx, cy - 12, 'CRIT!', '#ffd23f');
          }
          // TELEPORT: warp back along path
          if (p.teleport) {
            const amt = p.warpChaos ? (1 + Math.floor(Math.random() * 6)) : (p.warpAmt || 3);
            const newIdx = Math.max(0, e.pathIdx - amt);
            const node = currentMap.path[newIdx];
            if (node) {
              const oldX = e.x, oldY = e.y;
              e.pathIdx = newIdx;
              e.x = node[0] + 0.5;
              e.y = node[1] + 0.5;
              // Warp ring at old + new pos
              particles.push({ x: oldX * TILE + gridOffsetX(), y: oldY * TILE + gridOffsetY(), t: 0, life: 0.4, ring: true, maxR: 24, color: '#b055ff' });
              particles.push({ x: e.x * TILE + gridOffsetX(), y: e.y * TILE + gridOffsetY(), t: 0, life: 0.4, ring: true, maxR: 24, color: '#ff3aa1' });
            }
          }
        };
        applyHit(p.target);
        if (p.pierce > 0) {
          p.pierceHit.push(p.target);
          // Find next enemy along forward direction (closest) not yet hit
          let next = null, bestD = Infinity;
          for (const e of enemies) {
            if (!e.alive || p.pierceHit.includes(e)) continue;
            const ed = Math.hypot(e.x * TILE + gridOffsetX() - p.x, e.y * TILE + gridOffsetY() - p.y);
            if (ed < bestD && ed < 200) { bestD = ed; next = e; }
          }
          if (next) {
            p.target = next;
            p.pierce -= 1;
            continue; // keep this projectile alive, re-fly to new target
          }
        }
        // Boomerang: queue a second hit 0.4s later on whatever is closest to origin
        if (p.boomerang) {
          const runToken = runId;
          const bounces = p.boomerangBounces || 1;
          for (let bi = 1; bi <= bounces; bi++) {
            setTimeout(() => {
              if (!running || runToken !== runId) return;
              let best = null, bestD = Infinity;
              for (const e of enemies) {
                if (!e.alive) continue;
                const dd = Math.hypot(e.x * TILE + gridOffsetX() - p.origX, e.y * TILE + gridOffsetY() - p.origY);
                if (dd < bestD) { bestD = dd; best = e; }
              }
              if (best && best.alive) {
                best.hp -= p.dmg * (0.7 / bi); // diminishing returns per bounce
                particles.push({ x: best.x * TILE + gridOffsetX(), y: best.y * TILE + gridOffsetY(), t: 0, life: 0.3, ring: true, maxR: 14, color: p.color });
              }
            }, 400 * bi);
          }
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
            screenShake(12, 0.45);
            // Hit-pause so the kill feels weighty.
            _tdHitstopT = 0.12;
            sfx.arp([523, 659, 880, 1175], 'triangle', 0.08, 0.25, 0.25);
            // Sub-bass thud sweetener.
            sfx.tone(70, 'sine', 0.3, 0.4);
            // SPLITTER boss: spawn 3 cats on death
            if (e.bossMod === 'SPLITTER') {
              for (let k = 0; k < 3; k++) {
                enemies.push({
                  type: 'cat', def: ENEMIES.cat,
                  hp: ENEMIES.cat.hp * 1.5, maxHp: ENEMIES.cat.hp * 1.5,
                  speed: ENEMIES.cat.speed * 1.2, slowT: 0, slowMul: 1,
                  pathIdx: e.pathIdx, x: e.x + (k - 1) * 0.2, y: e.y, alive: true,
                });
              }
              spawnPopup(e.x * TILE + gridOffsetX(), e.y * TILE + gridOffsetY() - 20, 'SPLIT!', '#ff3aa1');
            }
          }
          money += goldDrop;
          _totalKills++;
          sfx.tone(660, 'triangle', 0.05, 0.16);
          const ex = e.x * TILE + gridOffsetX();
          const ey = e.y * TILE + gridOffsetY();
          // Floating "+$N" popup
          spawnPopup(ex, ey - 6, `+$${goldDrop}`, e.miniboss ? '#ff8ac8' : '#ffd23f');
          // ROUND-2: PUG ELITE death-summon — spawns 3 squirrels at the elite's
          // current path position so the player has to clean them up.
          if (e.type === 'elite') {
            const n = (e.def.summonOnDeath || 3);
            for (let k = 0; k < n; k++) {
              enemies.push({
                type: 'squirrel', def: ENEMIES.squirrel,
                hp: ENEMIES.squirrel.hp * 1.2, maxHp: ENEMIES.squirrel.hp * 1.2,
                speed: ENEMIES.squirrel.speed * 1.1, slowT: 0, slowMul: 1,
                pathIdx: e.pathIdx, x: e.x + (k - 1) * 0.18, y: e.y + (Math.random() - 0.5) * 0.2, alive: true,
              });
            }
            spawnPopup(ex, ey - 22, 'SPAWN!', '#ff5a8a');
            screenShake(4, 0.18);
            sfx.tone(140, 'sine', 0.15, 0.32);
          }
          // Bigger kill burst for bosses/miniboss/elite
          const burst = e.type === 'boss' ? 18 : (e.miniboss ? 16 : (e.type === 'elite' ? 12 : 6));
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
  // Perf: prune in-place via reverse-iter splice — avoids per-frame realloc.
  for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].dead) projectiles.splice(i, 1);
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    if (!p.ring) { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; p.vx *= 0.94; p.vy *= 0.94; }
    if (p.t >= p.life) particles.splice(i, 1);
  }
  if (particles.length > 250) particles.splice(0, particles.length - 250);
  // Floating score popups (drift upward + slight horizontal, fade)
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.t += dt;
    p.y -= 28 * dt;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 1 - dt * 2; }
    if (p.t >= p.life) popups.splice(i, 1);
  }
  if (popups.length > 30) popups.splice(0, popups.length - 30);
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
  // depth3D: subtle parallax cloud band along the top — gentle scroll over time.
  if (!_depthReduced()) {
    const t = performance.now() * 0.012;
    const py = H * 0.06;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = -1; i < Math.floor(W / 140) + 1; i++) {
      const cw = 70 + ((i * 17) % 30);
      const cx = (i * 140 - t) % (W + 280) - 70;
      ctx.beginPath();
      ctx.ellipse(cx, py + (i % 2) * 10, cw, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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
    // Round-2 polish: tower AIM rotation — small "barrel" arrow rotates
    // toward the current target before firing. Uses cached tw.aimAngle.
    if (!def.buff && !def.bannerBoost && tw.aimAngle != null) {
      ctx.save();
      ctx.translate(x, y + 4);
      ctx.rotate(tw.aimAngle);
      ctx.fillStyle = def.projColor || def.color || '#ffd23f';
      // Barrel rectangle (longer than tower body, extends in aim direction)
      ctx.fillRect(0, -2, TILE * 0.45, 4);
      // Bright muzzle tip
      ctx.fillStyle = '#fff';
      ctx.fillRect(TILE * 0.42, -1, 3, 2);
      ctx.restore();
    }
    // Tower body — bob gently
    const bobY = y + Math.sin(performance.now() / 400 + (tw.bob || 0)) * 2;
    // depth3D drop shadow under tower — grounds the pug body on its tile.
    _depthShadow(ctx, x, y + TILE * 0.36, TILE * 0.32, { alpha: 0.4 });
    // Level upgrade rings — 1 ring per level under tower
    if (tw.level > 0) {
      for (let i = 0; i < tw.level; i++) {
        ctx.strokeStyle = ['#5ef38c', '#4cc9f0', '#ffd23f'][i] || '#ffd23f';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y + 6, TILE * 0.36 + 4 + i * 4, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Path tint — overlay the chosen path's badge color on the tower body
    // so players can read PATH at a glance. PIERCE blue trail, CRIT gold,
    // etc. The pug body inherits the color when a path is set.
    const tPath = getPathDef(tw);
    // Placement squash-stretch: drop in (scaleY → 0.55 → 1) over 0.3s.
    let _placeY = 0, _scaleX = 1, _scaleY = 1;
    if (tw.placeT != null && tw.placeT < 0.3) {
      // Handle negative placeT (staggered dance) — skip animation until t > 0
      if (tw.placeT >= 0) {
        const k = tw.placeT / 0.3;
        // Ease-out cubic
        const ek = 1 - Math.pow(1 - k, 3);
        _scaleY = 0.55 + 0.45 * ek;
        _scaleX = 1.25 - 0.25 * ek;
        _placeY = (1 - ek) * -10;
      }
    }
    // Per-tower body color: use path tint if committed, else def.color. Use
    // distinctive body colors per tower kind so each tower has a unique look.
    const _bodyCol = tPath ? tPath.badge : (def.color || '#c8854a');
    if (_scaleX !== 1 || _scaleY !== 1) {
      ctx.save();
      ctx.translate(x, bobY + 4);
      ctx.scale(_scaleX, _scaleY);
      drawPug(ctx, 0, _placeY, { size: 30, body: _bodyCol });
      ctx.restore();
    } else {
      drawPug(ctx, x, bobY + 4, { size: 30, body: _bodyCol });
    }
    // Per-tower-kind accessory: gunner cap, sniper glasses+rifle silhouette,
    // ear-protection, beret, scope, etc. Layered on top of the pug body.
    _drawTowerAccessory(ctx, x, bobY + 4, tw.type, tw.path, 30);
    // Tower-type icon overlay above the pug head (small badge).
    if (def.iconName && drawIcon[def.iconName]) {
      drawIcon[def.iconName](ctx, x, bobY - 22, 12);
    } else {
      ctx.font = "12px serif"; ctx.textAlign = 'center';
      ctx.fillText(def.icon, x, bobY - 18);
    }
    // PATH BADGE — small glyph in a colored bubble at the tower's top-right
    // corner. Strongly visible so players can see at-a-glance which path a
    // tower committed to (esp. on busy boards).
    if (tPath) {
      const bx = x + TILE * 0.32;
      const by = bobY - 18;
      ctx.fillStyle = '#0a0716';
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = tPath.badge; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = tPath.badge;
      ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText(tPath.glyph, bx, by + 3);
    }
    // Level pips
    for (let i = 0; i < tw.level; i++) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x - 8 + i * 6, y + TILE * 0.32, 4, 4);
    }
  }
  // Enemies (depth3D shadow under each)
  for (const e of enemies) {
    if (!e.alive) continue;
    const x = ox + e.x * TILE;
    const y = oy + e.y * TILE;
    // shadow on the ground beneath enemy (air units = smaller shadow further down)
    _depthShadow(ctx, x, y + e.def.size + (e.def.air ? 18 : 6), e.def.size * 0.9, { alpha: e.def.air ? 0.22 : 0.4 });
    // Mini-boss: aura ring
    if (e.miniboss) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.fillStyle = `rgba(255,210,63,${0.18 + pulse * 0.12})`;
      ctx.beginPath(); ctx.arc(x, y, e.def.size + 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
    }
    if (e.type === 'boss') {
      // Mega-pug villain — purple body, dark mask. drawPug handles its own shadow.
      drawPug(ctx, x, y + 6, { size: 44, body: '#b055ff', mask: '#3a1a4a' });
      // Boss crown spikes + glowing eyes
      ctx.fillStyle = '#3a0a4a';
      ctx.fillRect(x - 14, y - 22, 4, 6);
      ctx.fillRect(x - 5, y - 26, 4, 8);
      ctx.fillRect(x + 4, y - 26, 4, 8);
      ctx.fillRect(x + 11, y - 22, 4, 6);
      ctx.fillStyle = '#ff3aa1';
      ctx.fillRect(x - 14, y - 18, 4, 2);
      ctx.fillRect(x - 5, y - 20, 4, 2);
      ctx.fillRect(x + 4, y - 20, 4, 2);
      ctx.fillRect(x + 11, y - 18, 4, 2);
    } else {
      _drawEnemySprite(ctx, x, y, e);
    }
    if (e.def.air) {
      // Detailed wings: bone strut + feathery edge that flaps slightly.
      const wf = Math.sin(performance.now() * 0.02 + e.x * 1.7) * 2;
      ctx.fillStyle = 'rgba(60,90,40,0.9)';
      ctx.fillRect(x - 16, y - 3 + wf, 8, 3);
      ctx.fillRect(x + 8, y - 3 - wf, 8, 3);
      ctx.fillStyle = 'rgba(140,200,120,0.7)';
      ctx.fillRect(x - 16, y - 3 + wf, 8, 1);
      ctx.fillRect(x + 8, y - 3 - wf, 8, 1);
      // wing tip feather flick
      ctx.fillStyle = 'rgba(94,243,140,0.85)';
      ctx.fillRect(x - 17, y - 4 + wf, 2, 5);
      ctx.fillRect(x + 15, y - 4 - wf, 2, 5);
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
  // Projectiles — per source-tower visual: bullet / sniper-tracer / cannonball /
  // ice-crystal / bone-boomerang / missile / tar-glob. Falls back to a glowing
  // dot if a projectile lacks a `sourceType` tag.
  for (const p of projectiles) {
    _drawProjectile(ctx, p);
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
  // Day/night blue tint — gradually deepens as waves progress
  const dnT = dayNightT();
  if (dnT > 0) {
    ctx.fillStyle = nightOverlayRGBA();
    ctx.fillRect(0, 0, W, H);
    // Subtle moon when fully night
    if (dnT > 0.7) {
      const moonAlpha = (dnT - 0.7) / 0.3;
      ctx.fillStyle = `rgba(255,250,220,${0.5 * moonAlpha})`;
      ctx.beginPath(); ctx.arc(W - 60, 80, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(200,200,170,${0.35 * moonAlpha})`;
      ctx.beginPath(); ctx.arc(W - 52, 76, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W - 68, 88, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Synergy badges — small tag next to towers that have a synergy active
  if (_synergyCache.size > 0) {
    const ox = gridOffsetX(), oy = gridOffsetY();
    for (let i = 0; i < towers.length; i++) {
      const syns = _synergyCache.get(i);
      if (!syns || syns.length === 0) continue;
      const tw = towers[i];
      const x = ox + tw.col * TILE + TILE / 2;
      const y = oy + tw.row * TILE + TILE * 0.4;
      const syn = syns[0]; // show only first
      ctx.font = "5px 'Press Start 2P', monospace";
      ctx.textAlign = 'center';
      const tw2 = ctx.measureText(syn.label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - tw2 / 2 - 2, y - 4, tw2 + 4, 8);
      ctx.fillStyle = syn.color;
      ctx.fillText(syn.label, x, y + 2);
    }
  }
  // Ambient biome particles drawn after shake-restore so they don't jitter
  drawAmbientParticles();
  // Wave progress bar (top center) — visualizes spawn queue progress
  if (inWave) {
    const totalCount = enemies.filter((e) => e.alive).length + spawnQueue.length;
    const totalSent = (spawnQueue.length === 0 && totalCount === 0) ? 1 : 1 - (spawnQueue.length / Math.max(1, spawnQueue.length + enemies.filter((e) => e.alive).length + 0.0001));
    // Use a smarter denominator
    void totalSent;
    const pbX = W / 2 - 120, pbY = 10, pbW = 240, pbH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(pbX, pbY, pbW, pbH);
    // Fill = (remaining sends + remaining alive) ratio to total wave size
    const remaining = spawnQueue.length + enemies.filter((e) => e.alive).length;
    const orig = remaining + 1; // approx
    const frac = 1 - remaining / Math.max(orig, 1);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(pbX, pbY, pbW * frac, pbH);
    ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 1;
    ctx.strokeRect(pbX + 0.5, pbY + 0.5, pbW - 1, pbH - 1);
    ctx.fillStyle = '#5ef38c';
    ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${waveIdx}  ${spawnQueue.length} queued · ${enemies.filter((e) => e.alive).length} alive`, W / 2, pbY - 2);
  }
  // Place-mode indicator
  if (_placeMode) {
    ctx.fillStyle = 'rgba(94,243,140,0.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 110, 26, 220, 22);
    ctx.fillStyle = '#5ef38c';
    ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('★ PLACE MODE (P) ★', W / 2, 40);
  }
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

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _tdHud = {
  money: document.getElementById('hud-money'),
  lives: document.getElementById('hud-lives'),
  card: document.querySelector('#hud .hud-card'),
  wave: document.getElementById('hud-wave'),
  enemies: document.getElementById('hud-enemies'),
  best: document.getElementById('hud-best'),
};
let _tdHudPrev = { money: NaN, lives: NaN, critical: null, wave: '', enemies: -1, best: -1 };
let _tdBestCache = -1, _tdBestCacheT = 0;
// ROUND-2 POLISH: wave history sidebar DOM updater.
function _updateWaveHistoryDom() {
  const panel = document.getElementById('td-wave-history');
  const list = document.getElementById('td-wave-history-list');
  if (!panel || !list) return;
  // Hidden until first wave completed
  panel.hidden = !running || waveHistory.length === 0;
  if (!waveHistory.length) { list.textContent = '—'; return; }
  list.innerHTML = waveHistory.map((h) => {
    const livesC = h.livesLost > 0 ? 'var(--crimson)' : 'var(--neon-green)';
    return `<div style="display:flex;justify-content:space-between;padding:1px 0;">
      <span>W${h.wave}</span>
      <span style="color:var(--neon-yellow)">+$${h.gold}</span>
      <span style="color:var(--text-soft)">${h.kills}k</span>
      <span style="color:${livesC}">${h.livesLost > 0 ? '-' + h.livesLost : '✓'}</span>
    </div>`;
  }).join('');
}
function updateHud() {
  if (money !== _tdHudPrev.money) { _tdHud.money.textContent = '$' + money; _tdHudPrev.money = money; }
  if (lives !== _tdHudPrev.lives) { _tdHud.lives.textContent = lives; _tdHudPrev.lives = lives; }
  if (_tdHud.card) {
    const crit = lives > 0 && lives <= 3;
    if (crit !== _tdHudPrev.critical) {
      _tdHud.card.classList.toggle('td-hud-critical', crit);
      _tdHudPrev.critical = crit;
    }
  }
  const w = endlessMode || waveIdx > WAVES.length ? `${waveIdx} ★` : `${waveIdx}/${WAVES.length}`;
  if (w !== _tdHudPrev.wave) { _tdHud.wave.textContent = w; _tdHudPrev.wave = w; }
  if (enemies.length !== _tdHudPrev.enemies) {
    _tdHud.enemies.textContent = enemies.length;
    _tdHudPrev.enemies = enemies.length;
  }
  const now = performance.now();
  if (now - _tdBestCacheT > 2000) {
    const best = loadBest('pug-td');
    _tdBestCache = best ? best.score : 0;
    _tdBestCacheT = now;
  }
  if (_tdBestCache !== _tdHudPrev.best) {
    _tdHud.best.textContent = _tdBestCache;
    _tdHudPrev.best = _tdBestCache;
  }
}

function end(won) {
  // Idempotent — end() can in theory be reached twice in one frame if both the
  // life-loss and wave-clear conditions trigger on the same enemy update.
  if (!running) return;
  running = false;
  sfx.sweep(won ? 1320 : 220, won ? 880 : 60, won ? 'triangle' : 'sawtooth', 0.8, 0.25);
  const isEndless = endlessMode && waveIdx > WAVES.length;
  document.getElementById('end-title').textContent = isEndless ? `ENDLESS · WAVE ${waveIdx}` : (won ? 'VAULT SAFE!' : 'VAULT EMPTY');
  document.getElementById('end-sub').textContent = isEndless
    ? `Endless rampage — ${waveIdx - 15} waves past victory.`
    : (won ? 'You defended all 15 waves.' : 'The squirrels got all the biscuits.');
  document.getElementById('end-waves').textContent = waveIdx;
  const score = waveIdx * 100 + lives * 20 + (isEndless ? (waveIdx - 15) * 150 : 0);
  document.getElementById('end-score').textContent = score;
  // Award stars in endless mode too (1 per 5 extra waves)
  if (isEndless) try { awardTalentStars(Math.floor((waveIdx - 15) / 5)); } catch {}
  const { isNewBest, current } = submitRun('pug-td', { score, waves: waveIdx, won });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { score };
    bestEl.innerHTML = `Best: <b>${b.score}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('td-bar').hidden = true;
  const hist = document.getElementById('td-wave-history');
  if (hist) hist.hidden = true;
  hidePopup();
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

// Map picker — now with per-map difficulty rating (dots)
let chosenMapId = 'classic';
const MAP_DIFFICULTY = {
  classic: 1, spiral: 2, zigzag: 2, corridor: 3, loop: 2, uturn: 2, edge: 3, cross: 3, funnel: 3, winding: 2,
};
function renderMapPicker() {
  const el = document.getElementById('map-picker');
  if (!el) return;
  el.innerHTML = '';
  for (const [id, m] of Object.entries(MAPS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = `background:rgba(0,0,0,0.4);color:var(--text);border:2px solid ${chosenMapId === id ? 'var(--neon-yellow)' : 'var(--border)'};border-radius:4px;padding:8px 14px;font-family:var(--font-display);font-size:0.5rem;letter-spacing:0.06em;cursor:pointer;${chosenMapId === id ? 'background:rgba(255,210,63,0.18);color:var(--neon-yellow);box-shadow:0 0 12px rgba(255,210,63,0.45);' : ''}`;
    const diff = MAP_DIFFICULTY[id] || 2;
    const dots = '★'.repeat(diff) + '☆'.repeat(Math.max(0, 3 - diff));
    btn.innerHTML = `${m.name} <span style="color:var(--neon-pink);font-size:0.4rem;">${dots}</span><br><span style="color:var(--text-soft);font-size:0.42rem;">${m.desc}</span>`;
    btn.addEventListener('click', () => { chosenMapId = id; renderMapPicker(); });
    el.appendChild(btn);
  }
  // Show talent panel if stars > 0
  try {
    const t = loadTalents();
    const panel = document.getElementById('td-talents');
    const cnt = document.getElementById('td-stars-count');
    if (panel && cnt && t.stars) {
      panel.style.display = 'block';
      cnt.textContent = t.stars;
    }
  } catch {}
}
renderMapPicker();

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  currentMap = MAPS[chosenMapId] || MAPS.classic;
  _rebuildPathSet();
  reset(); running = true; runId++;
  // Regenerate biome decor + clear ambient particles per match
  mapParticles = [];
  generateDecor();
  miniBossBannerT = 0; miniBossBannerText = '';
  // Show start tip + place-mode key hint
  try { showTip('Tip: SYNERGY! Place FROST+CANNON adjacent → DEEP FREEZE bonus. Endless mode after wave 15. P=place-mode.', 6500); } catch {}
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('td-bar').hidden = false;
  buildBar();
  updateHud();
  sfx.resume();
  try { music.setIntensity(0.3); music.play(); } catch {}
}
// Wave-driven music intensity sampler.
setInterval(() => {
  if (!running) return;
  try {
    // Base intensity rises slowly through campaign + spikes during active waves.
    const progress = Math.min(1, (waveIdx || 0) / 15);
    const i = (inWave ? 0.85 : 0.35) + progress * 0.15;
    music.setIntensity(Math.min(1, i));
  } catch {}
}, 500);
(function _wireTdMusicEnd() {
  const endOv = document.getElementById('end-overlay');
  if (!endOv) return;
  const upd = () => {
    const visible = !endOv.hidden && !endOv.classList.contains('is-hidden');
    if (visible) try { music.stop(); } catch {}
  };
  new MutationObserver(upd).observe(endOv, { attributes: true, attributeFilter: ['hidden','class'] });
})();
// Kingdom-Rush-style "Call next wave early" button — visible only during the
// calm period between waves. Clicking it triggers the next wave and grants
// bonus money equal to the remaining timer (same formula startWave() already
// uses: floor(betweenWaveT * 5)). The button text refreshes every frame.
const callWaveBtn = document.getElementById('td-call-wave');
const callWaveBonusEl = callWaveBtn?.querySelector('.td-call-bonus');
callWaveBtn?.addEventListener('click', () => {
  if (!running || inWave) return;
  if (waveIdx >= WAVES.length && !endlessMode) return;
  sfx.tone(920, 'square', 0.08, 0.22);
  startWave();
  callWaveBtn.hidden = true;
});

function refreshCallWaveBtn() {
  if (!callWaveBtn) return;
  const showable = running && !inWave && (waveIdx < WAVES.length || endlessMode) && betweenWaveT > 0.1;
  callWaveBtn.hidden = !showable;
  if (showable && callWaveBonusEl) {
    const bonus = Math.floor(betweenWaveT * 5);
    callWaveBonusEl.textContent = `(+$${bonus})`;
  }
}

let lastT = performance.now();
(function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05) * __speedMult;
  lastT = now; tick(dt); if (running) render();
  refreshCallWaveBtn();
  requestAnimationFrame(loop);
})(performance.now());

// Floating 1x/2x/3x speed toggle (top-right) — multiplies the tick dt
createSpeedToggle({ onChange: (m) => { __speedMult = m; } });

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('Place towers → tap to upgrade. At Lv2 CHOOSE A PATH (permanent!). Mini-bosses on waves 5/10/15.', 7500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Call the next wave early for bonus money.',
    'TIP: At Lv2 you choose a tower path — permanent!',
    'TIP: Bosses appear on waves 5 / 10 / 15.',
    'TIP: Splash towers excel against grouped enemies.',
    'LORE: The biscuit vault has been raided for years.',
    'TIP: Sell underperforming towers — get most of $ back.',
    'JOKE: Why don\'t squirrels play TD? They prefer the nuts.',
  ];
  const GAME_ID = 'pug-td';
  const startOv = document.getElementById('overlay');
  const endOv = document.getElementById('end-overlay');
  const factEl = document.getElementById('wg-fun-facts');
  let factIdx = Math.floor(Math.random() * FACTS.length), factTimer = null;
  function showFact() {
    if (!factEl) return;
    factEl.classList.remove('is-shown');
    setTimeout(() => { factEl.textContent = FACTS[factIdx % FACTS.length]; factEl.classList.add('is-shown'); factIdx++; }, 220);
  }
  function startFactLoop() { showFact(); clearInterval(factTimer); factTimer = setInterval(showFact, 4200); }
  function stopFactLoop() { clearInterval(factTimer); if (factEl) factEl.classList.remove('is-shown'); }
  function refreshStartBest() {
    const el = document.getElementById('start-best');
    if (!el) return;
    import('../../src/persistence/highScores.js').then(({ loadBest: lb }) => {
      try {
        const best = lb(GAME_ID);
        if (best && (best.score || best.waves)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.waves || 0} waves · ${best.score || 0} score${best.won ? ' · WON' : ''}`;
        } else { el.hidden = true; }
      } catch {}
    }).catch(() => {});
  }
  function spawnConfetti() {
    const colors = ['#ffd23f','#ff3aa1','#4cc9f0','#5ef38c','#ff8e3c','#b055ff'];
    const root = document.createElement('div'); root.className = 'wg-confetti';
    for (let i = 0; i < 80; i++) {
      const s = document.createElement('span');
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.background = colors[Math.floor(Math.random() * colors.length)];
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      root.appendChild(s);
    }
    document.body.appendChild(root);
    setTimeout(() => root.remove(), 3200);
  }
  let _runStart = 0;
  function showReplayPrompt() {
    const el = document.getElementById('wg-tryagain');
    if (!el) return;
    const dur = (performance.now() - _runStart) / 1000;
    el.hidden = dur > 40;
  }
  const shareBtn = document.getElementById('wg-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const w = document.getElementById('end-waves')?.textContent || '0';
      const sc = document.getElementById('end-score')?.textContent || '0';
      const wn = parseInt(w, 10) || 0;
      const endlessSuffix = wn > 15 ? ` (★ ENDLESS +${wn - 15})` : '';
      const text = `🐶 PUG TOWER DEFENSE — Survived ${w} waves with ${sc} score${endlessSuffix}! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'PUG TOWER DEFENSE', text, url: 'https://leobalkind.github.io/web-games/' });
        else { await navigator.clipboard.writeText(text); shareBtn.textContent = '✓ COPIED!'; setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800); }
      } catch { shareBtn.textContent = '⚠ FAILED'; setTimeout(() => { shareBtn.textContent = '📋 SHARE'; }, 1800); }
    });
  }
  if (startOv) {
    const startUpdate = () => {
      const visible = !startOv.hidden && !startOv.classList.contains('is-hidden');
      if (visible) { refreshStartBest(); startFactLoop(); } else { stopFactLoop(); _runStart = performance.now(); }
    };
    new MutationObserver(startUpdate).observe(startOv, { attributes: true, attributeFilter: ['hidden','class'] });
    startUpdate();
  }
  if (endOv) {
    const endUpdate = () => {
      const visible = !endOv.hidden && !endOv.classList.contains('is-hidden');
      if (!visible) return;
      const title = document.getElementById('end-title');
      if (title) { title.classList.remove('is-shake'); void title.offsetWidth; title.classList.add('is-shake'); }
      const bestEl = document.getElementById('end-best');
      const banner = document.getElementById('wg-newbest');
      const isNew = bestEl && /NEW/i.test(bestEl.textContent || '');
      if (banner) banner.classList.toggle('is-shown', !!isNew);
      if (isNew) spawnConfetti();
      showReplayPrompt();
    };
    new MutationObserver(endUpdate).observe(endOv, { attributes: true, attributeFilter: ['hidden','class'] });
  }
})();
