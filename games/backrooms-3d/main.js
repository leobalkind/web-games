// =============================================================================
// BACKROOMS 3D — first-person horror crawl through the iconic yellow rooms.
//
// Architecture:
//   1. Lazy-load Three.js so the hub page never pulls in ~600kB it doesn't need.
//   2. Build canvas textures (wallpaper / carpet / ceiling) once on boot.
//   3. Procedural maze of 4m cells; expand outward as the player walks (the
//      "endless" feel — every chunk-boundary cross triggers a regen wave).
//   4. InstancedMesh for walls (one geometry, ~thousands of instances).
//   5. Per-fixture flicker + dying lights drive the unsettling vibe.
//   6. Billboard monster sprite (the existing evil-pug face) with shamble +
//      hunt + jumpscare behaviour.
//   7. Audio is co-owned with Agent B in ./audio.js — we just call into it.
//
// State machine: BOOT → MENU → PLAY → PAUSED → DEAD → (back to MENU on retry).
// =============================================================================

import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createSettingsMenu, getMasterGain } from '../../src/shared/settingsMenu.js';
import { submitRun, loadBest } from '../../src/persistence/highScores.js';

// =============================================================================
// BOOT — wrapped in an async IIFE because top-level await is not supported by
// our build target (Vite defaults to es2020 + chrome87/safari14, none of which
// allow top-level await in modules). The IIFE preserves the dynamic-import
// patterns we want (Three.js + audio.js lazy-loaded) while staying ES2020.
// =============================================================================
(async () => {

// ---------------------------------------------------------------------------
// Audio — Agent B owns ./audio.js. It exports `createAudio()` which returns a
// controller. We instantiate the controller now, but only call `start()` once
// the player clicks ENTER (browser autoplay policy needs a user gesture).
// Wrapped in a try/catch fallback so the game still boots if the module fails
// to resolve during the parallel-build phase.
// ---------------------------------------------------------------------------
let audio = null;
try {
  const audioMod = await import('./audio.js').catch(() => null);
  audio = audioMod?.createAudio ? audioMod.createAudio() : null;
} catch { audio = null; }
// Safe wrappers — every audio helper no-ops if audio.js never loaded or if the
// engine hasn't been started yet (we explicitly start it on click-to-enter).
const playFootstep = (s) => { try { audio?.playFootstep?.(s); } catch {} };
const playBuzz = (i) => { try { audio?.playBuzz?.(i); } catch {} };
const playFlicker = () => { try { audio?.playFlicker?.(); } catch {} };
const playMonsterFar = (d, p) => { try { audio?.playMonsterFar?.(d, p); } catch {} };
const playJumpscare = () => { try { audio?.playJumpscare?.(); } catch {} };
const playAmbience = (v) => { try { audio?.playAmbience?.(v); } catch {} };
const startAudio = () => { try { audio?.start?.(); } catch {} };
const stopAudio = () => { try { audio?.stop?.(); } catch {} };
const updateMonsterDistance = (d) => { try { audio?.updateDistance?.(d); } catch {} };

// ---------------------------------------------------------------------------
// SETTINGS MENU — wired the same way every other game does. The gear button
// auto-appears in the top-right; controls help shows on hover/click for
// keyboard accessibility.
// ---------------------------------------------------------------------------
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({
  gameId: 'backrooms-3d',
  getControlsHelp: () => _isTouch
    ? 'JOYSTICK walk · DRAG screen to look · Don\'t die.'
    : 'WASD walk · MOUSE look · ESC pause. Don\'t die.',
});

// ---------------------------------------------------------------------------
// LAZY THREE.JS — dynamic import. Bundle stays out of the hub page entirely;
// only loads when this file executes (i.e. the player clicked the card).
// ---------------------------------------------------------------------------
const THREE = await import('three');

// =============================================================================
// CONSTANTS — tweak knobs for the whole game.
// =============================================================================
const CELL = 4;                  // metres per maze cell
const ROOM_H = 3.5;              // ceiling height
const PLAYER_H = 1.6;             // eye height
const PLAYER_RADIUS = 0.3;        // collision radius
const WALK_SPEED = 3.6;           // m/s
const MOUSE_SENS = 0.0024;        // rad per pixel
const TOUCH_SENS = 0.005;         // rad per pixel (touch drag-look)
const FOG_DENSITY = 0.025;        // dense yellow haze
const FOG_COLOR = 0xb8a040;
const RENDER_RADIUS = 10;         // cells around player to render (=> 20x20 chunk)
const REGEN_THRESHOLD = 16;       // when player within N cells of edge, expand maze
const CHUNK_SIZE = 30;            // cells added per regen pass
// Monster tuning
const MONSTER_HEIGHT = 1.7;
const MONSTER_WANDER_SPEED = 1.6;
const MONSTER_HUNT_SPEED = 3.1;
const MONSTER_DETECT_DIST = 50;
const MONSTER_CATCH_DIST = 1.6;
const MONSTER_TELEPORT_INTERVAL = 30; // seconds without sighting → relocate
// Sanity
const SANITY_DRAIN_BASE = 0.6;       // per second when not in light
const SANITY_DRAIN_MONSTER = 4.0;    // per second when monster within 25m
const SANITY_RECOVER_LIGHT = 0.4;    // per second when standing under a fixture

// =============================================================================
// CANVAS TEXTURES — procedural so we ship zero image assets. Each texture is
// a small 256/512px canvas drawn once at boot and reused via NearestFilter for
// the crunchy pixel-art look the spec calls for.
// =============================================================================
function makeWallpaperTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // Base yellow wallpaper (#c8a93f).
  g.fillStyle = '#c8a93f'; g.fillRect(0, 0, 256, 256);
  // Vertical stripes — darker tone (#b89030), 8px wide, every 24px.
  g.fillStyle = '#b89030';
  for (let x = 0; x < 256; x += 24) {
    g.fillRect(x, 0, 8, 256);
  }
  // Subtle horizontal woodgrain to break perfect vertical repeat.
  g.globalAlpha = 0.06;
  g.fillStyle = '#000';
  for (let y = 0; y < 256; y += 4) {
    g.fillRect(0, y, 256, 1);
  }
  g.globalAlpha = 1;
  // Water stains — random brown blobs. Multiple at different intensities so it
  // doesn't look like a regular pattern.
  for (let i = 0; i < 6; i++) {
    const cx = Math.random() * 256;
    const cy = Math.random() * 256;
    const r = 18 + Math.random() * 30;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(80, 50, 12, 0.35)');
    grad.addColorStop(0.5, 'rgba(80, 50, 12, 0.18)');
    grad.addColorStop(1, 'rgba(80, 50, 12, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Tiny dark specks (mildew dots) for noise.
  g.fillStyle = 'rgba(0, 0, 0, 0.25)';
  for (let i = 0; i < 60; i++) {
    g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter; // crunchy pixels
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  return tex;
}

function makeCarpetTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // Base beige (#6b5a3e).
  g.fillStyle = '#6b5a3e'; g.fillRect(0, 0, 256, 256);
  // Tufted texture — tiny dots of slightly varied tone, like cheap office carpet.
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 0.5 + Math.random() * 0.5;
    g.fillStyle = `rgba(${Math.floor(40 * v)}, ${Math.floor(30 * v)}, ${Math.floor(20 * v)}, 0.6)`;
    g.fillRect(x, y, 1, 1);
  }
  // Darker random splotches — stains.
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * 256;
    const cy = Math.random() * 256;
    const r = 12 + Math.random() * 28;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(20, 10, 4, 0.5)');
    grad.addColorStop(0.6, 'rgba(20, 10, 4, 0.2)');
    grad.addColorStop(1, 'rgba(20, 10, 4, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  return tex;
}

function makeCeilingTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // Off-white tiles (#dcd6c8) with grout lines.
  g.fillStyle = '#dcd6c8'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#a89c80';
  g.lineWidth = 2;
  // 2×2 tile grid — each cell 128×128 with subtle in-tile dimpling.
  for (let i = 0; i < 4; i++) {
    g.strokeRect(0, i * 64 + 0.5, 256, 0);
    g.strokeRect(i * 64 + 0.5, 0, 0, 256);
  }
  g.beginPath();
  g.moveTo(0, 128); g.lineTo(256, 128);
  g.moveTo(128, 0); g.lineTo(128, 256);
  g.stroke();
  // Subtle stains so every tile isn't identical (we still nearest-filter, so
  // these read as creepy little marks rather than blur).
  g.globalAlpha = 0.18;
  g.fillStyle = '#988a70';
  for (let i = 0; i < 20; i++) {
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  return tex;
}

// Pug-monster face — billboard sprite. Same evil-pug palette as the 2D
// version so the brand carries over, but drawn fresh in a fixed pose
// (we can't import the existing pugSprite.js drawer which is ctx-2d-only).
function makeMonsterTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  // Transparent background — alpha blend onto the foggy scene.
  g.clearRect(0, 0, 256, 256);
  // Body silhouette (very dark, like a shadow).
  g.fillStyle = '#1a0d05';
  g.beginPath();
  g.ellipse(128, 200, 70, 50, 0, 0, Math.PI * 2);
  g.fill();
  // Head — a fawn pug face, but distorted to feel WRONG.
  g.fillStyle = '#3a2a18';
  g.beginPath();
  g.ellipse(128, 110, 70, 70, 0, 0, Math.PI * 2);
  g.fill();
  // Mask (black muzzle area).
  g.fillStyle = '#0a0708';
  g.beginPath();
  g.ellipse(128, 130, 55, 35, 0, 0, Math.PI * 2);
  g.fill();
  // Glowing red eyes — the unsettling key feature.
  const eyeGlow = (cx, cy, r) => {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ff4040');
    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  eyeGlow(98, 100, 22);
  eyeGlow(158, 100, 22);
  g.fillStyle = '#ff1010';
  g.fillRect(94, 96, 8, 8);
  g.fillRect(154, 96, 8, 8);
  g.fillStyle = '#fff';
  g.fillRect(96, 98, 3, 3);
  g.fillRect(156, 98, 3, 3);
  // Ears (pointing-down pug ears, but slightly torn-looking).
  g.fillStyle = '#1a0d05';
  g.beginPath();
  g.moveTo(60, 70);  g.lineTo(80, 100); g.lineTo(72, 50);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(196, 70); g.lineTo(176, 100); g.lineTo(184, 50);
  g.closePath(); g.fill();
  // Teeth — small jagged white triangles in the maw.
  g.fillStyle = '#fff8e0';
  for (let i = 0; i < 5; i++) {
    const tx = 102 + i * 12;
    g.beginPath();
    g.moveTo(tx, 150); g.lineTo(tx + 4, 156); g.lineTo(tx + 8, 150);
    g.closePath(); g.fill();
  }
  // Subtle drool drips.
  g.fillStyle = 'rgba(255, 240, 200, 0.6)';
  g.fillRect(120, 156, 2, 8);
  g.fillRect(140, 158, 2, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.premultiplyAlpha = false;
  return tex;
}

// =============================================================================
// MAZE GENERATION — procedural grid. Each cell can have walls on its N/E/S/W
// edges. We share walls so we only build a single wall per cell-edge (no
// double walls between adjacent rooms).
//
// Storage: a flat Map keyed by "x,y" → { walls: [N, E, S, W] (booleans),
// hasFixture: boolean, fixtureLight: PointLight or null }.
// =============================================================================
const grid = new Map();
const cellKey = (cx, cy) => `${cx},${cy}`;
let gridMinX = -CHUNK_SIZE / 2, gridMaxX = CHUNK_SIZE / 2;
let gridMinY = -CHUNK_SIZE / 2, gridMaxY = CHUNK_SIZE / 2;

// Seeded pseudo-random — we want the maze to be the same for one play session
// but different across sessions. Each chunk uses its (cx, cy) as seed so the
// regenerate-on-edge feature produces consistent extensions.
function cellRandom(cx, cy, salt = 0) {
  let h = (cx * 374761393 + cy * 668265263 + salt * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// Generate cells in a rectangular range. Each cell rolls per-wall: 30% door
// chance means 70% wall on that edge. To avoid orphan walls (one side has
// wall, other side doesn't), we use a shared seed: the wall between cells A
// and B is keyed by `min(A,B)` so both rolls always agree.
function generateRange(x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const k = cellKey(x, y);
      if (grid.has(k)) continue;
      // Pick walls: each edge is shared, so we seed from the edge's canonical id.
      const wN = cellRandom(x, Math.min(y, y - 1), 1) < 0.7; // between (x,y-1) and (x,y)
      const wS = cellRandom(x, Math.min(y, y + 1), 1) < 0.7; // between (x,y) and (x,y+1)
      const wW = cellRandom(Math.min(x, x - 1), y, 2) < 0.7;
      const wE = cellRandom(Math.min(x, x + 1), y, 2) < 0.7;
      // Every 3rd-cell-ish gets a fixture above it. Slight noise so the grid
      // isn't perfectly regular.
      const hasFixture = ((x + y * 2) % 3 === 0) && cellRandom(x, y, 7) > 0.15;
      grid.set(k, {
        x, y,
        walls: { N: wN, E: wE, S: wS, W: wW },
        hasFixture,
        fixturePhase: cellRandom(x, y, 9) * Math.PI * 2,
        fixtureFlickerRate: 0.05 + cellRandom(x, y, 11) * 0.4,
        fixtureDying: cellRandom(x, y, 13) < 0.18, // 18% of lights are dying
        fixtureDead: cellRandom(x, y, 17) < 0.04,   // 4% are fully dead
        light: null,
      });
    }
  }
}

// Initial chunk around origin.
generateRange(gridMinX, gridMinY, gridMaxX, gridMaxY);

// =============================================================================
// THREE.JS SCENE SETUP
// =============================================================================
const threeRoot = document.getElementById('three-root');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0806);
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0, PLAYER_H, 0);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
// Cap DPR at 1.0 for the crunchy/performant look. Modern phones can hit DPR=3
// which kills frame rate in a 90°-FOV scene with many lights.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false; // no shadows for perf; vibe doesn't need them
threeRoot.appendChild(renderer.domElement);

// Ambient — barely lit. Whatever sees the camera reads almost-black until a
// fixture lights it up.
const ambient = new THREE.AmbientLight(0x141308, 0.85);
scene.add(ambient);

// =============================================================================
// MATERIALS — single shared material per surface so we render efficiently.
// MeshLambertMaterial reacts to PointLights without the perf cost of
// MeshStandardMaterial (which would need a roughness lookup per fragment).
// =============================================================================
const wallpaperTex = makeWallpaperTexture();
const carpetTex = makeCarpetTexture();
const ceilingTex = makeCeilingTexture();

const wallMat = new THREE.MeshLambertMaterial({ map: wallpaperTex });
// Tile the carpet per cell (1 repeat per cell).
const floorMat = new THREE.MeshLambertMaterial({ map: carpetTex });
const ceilMat = new THREE.MeshLambertMaterial({ map: ceilingTex });

// Helper to create per-cell floor/ceiling planes. We keep these as discrete
// meshes (not instanced) because each needs its own UV scale so the texture
// doesn't stretch across the whole world.
function buildFloor(cx, cy) {
  const geom = new THREE.PlaneGeometry(CELL, CELL);
  const mesh = new THREE.Mesh(geom, floorMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cx * CELL + CELL / 2, 0, cy * CELL + CELL / 2);
  return mesh;
}
function buildCeiling(cx, cy) {
  const geom = new THREE.PlaneGeometry(CELL, CELL);
  const mesh = new THREE.Mesh(geom, ceilMat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(cx * CELL + CELL / 2, ROOM_H, cy * CELL + CELL / 2);
  return mesh;
}

// Wall geometry — single instance reused for every wall. Each wall is a
// 4m × 3.5m plane. We use Group + Mesh per wall (not InstancedMesh) because
// the wall density is tractable (~6000 walls in a 30×30 chunk worst case)
// and individual meshes let us frustum-cull per-wall — which is a bigger win
// in a hallway scene with tight sight-lines than instancing.
const wallGeom = new THREE.PlaneGeometry(CELL, ROOM_H);

// Track meshes so we can dispose them on regen.
const cellMeshes = new Map(); // cellKey -> { floor, ceiling, walls: [meshes] }

function buildCellGeometry(cell) {
  if (cellMeshes.has(cellKey(cell.x, cell.y))) return;
  const group = { floor: null, ceiling: null, walls: [] };
  group.floor = buildFloor(cell.x, cell.y); scene.add(group.floor);
  group.ceiling = buildCeiling(cell.x, cell.y); scene.add(group.ceiling);
  // Walls — each side, only build if the wall flag says so AND a neighbouring
  // cell hasn't already drawn it (we set a flag per built wall on the cell).
  const baseX = cell.x * CELL + CELL / 2;
  const baseZ = cell.y * CELL + CELL / 2;
  // North wall (low z) — z = cell.y * CELL.
  if (cell.walls.N) {
    const m = new THREE.Mesh(wallGeom, wallMat);
    m.position.set(baseX, ROOM_H / 2, cell.y * CELL);
    m.rotation.y = 0;
    scene.add(m); group.walls.push(m);
  }
  // South wall.
  if (cell.walls.S) {
    const m = new THREE.Mesh(wallGeom, wallMat);
    m.position.set(baseX, ROOM_H / 2, (cell.y + 1) * CELL);
    m.rotation.y = Math.PI;
    scene.add(m); group.walls.push(m);
  }
  // West wall.
  if (cell.walls.W) {
    const m = new THREE.Mesh(wallGeom, wallMat);
    m.position.set(cell.x * CELL, ROOM_H / 2, baseZ);
    m.rotation.y = Math.PI / 2;
    scene.add(m); group.walls.push(m);
  }
  // East wall.
  if (cell.walls.E) {
    const m = new THREE.Mesh(wallGeom, wallMat);
    m.position.set((cell.x + 1) * CELL, ROOM_H / 2, baseZ);
    m.rotation.y = -Math.PI / 2;
    scene.add(m); group.walls.push(m);
  }
  // Light fixture — point-light + small bar mesh for visual. Cap total
  // simultaneously-visible lights for perf: WebGL has a hard limit on per-
  // fragment lights; we cull to whatever's within RENDER_RADIUS at update.
  if (cell.hasFixture && !cell.fixtureDead) {
    const light = new THREE.PointLight(0xfff4c0, 0.5, 8, 1.6);
    light.position.set(baseX, ROOM_H - 0.15, baseZ);
    scene.add(light);
    cell.light = light;
    // Visual: a thin glowing plane on the ceiling.
    const fixGeom = new THREE.PlaneGeometry(1.6, 0.6);
    const fixMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
    const fix = new THREE.Mesh(fixGeom, fixMat);
    fix.rotation.x = Math.PI / 2;
    fix.position.set(baseX, ROOM_H - 0.02, baseZ);
    scene.add(fix);
    group.walls.push(fix); // dispose together
    cell.fixtureVisual = fix;
    cell.fixtureMat = fixMat;
  }
  cellMeshes.set(cellKey(cell.x, cell.y), group);
}

function disposeCellGeometry(key) {
  const group = cellMeshes.get(key);
  if (!group) return;
  scene.remove(group.floor); group.floor.geometry.dispose();
  scene.remove(group.ceiling); group.ceiling.geometry.dispose();
  for (const w of group.walls) scene.remove(w);
  const cell = grid.get(key);
  if (cell?.light) { scene.remove(cell.light); cell.light = null; }
  cellMeshes.delete(key);
}

// Track which cells are currently rendered so we can streamload as the player
// walks. The set is rebuilt incrementally each frame (cheap — just iterates a
// small square around the player).
const rendered = new Set();
function syncVisibleCells(playerCellX, playerCellY) {
  // Mark cells in render radius as wanted.
  const wanted = new Set();
  for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++) {
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      const x = playerCellX + dx, y = playerCellY + dy;
      const k = cellKey(x, y);
      if (!grid.has(k)) continue;
      wanted.add(k);
      if (!rendered.has(k)) {
        buildCellGeometry(grid.get(k));
        rendered.add(k);
      }
    }
  }
  // Drop cells no longer wanted.
  for (const k of rendered) {
    if (!wanted.has(k)) {
      disposeCellGeometry(k);
      rendered.delete(k);
    }
  }
}

// Endless feel: when the player gets within REGEN_THRESHOLD of the grid edge,
// expand the maze in that direction. Generates a new strip; subsequent
// syncVisibleCells will pull them in for rendering.
function expandIfNeeded(cx, cy) {
  if (cx - gridMinX < REGEN_THRESHOLD) {
    const newMinX = gridMinX - CHUNK_SIZE;
    generateRange(newMinX, gridMinY, gridMinX - 1, gridMaxY);
    gridMinX = newMinX;
  }
  if (gridMaxX - cx < REGEN_THRESHOLD) {
    const newMaxX = gridMaxX + CHUNK_SIZE;
    generateRange(gridMaxX + 1, gridMinY, newMaxX, gridMaxY);
    gridMaxX = newMaxX;
  }
  if (cy - gridMinY < REGEN_THRESHOLD) {
    const newMinY = gridMinY - CHUNK_SIZE;
    generateRange(gridMinX, newMinY, gridMaxX, gridMinY - 1);
    gridMinY = newMinY;
  }
  if (gridMaxY - cy < REGEN_THRESHOLD) {
    const newMaxY = gridMaxY + CHUNK_SIZE;
    generateRange(gridMinX, gridMaxY + 1, gridMaxX, newMaxY);
    gridMaxY = newMaxY;
  }
}

// =============================================================================
// THE MONSTER — billboard sprite (always faces camera) with a slow shamble +
// hunt + teleport-when-lost behaviour. Walks the maze via cell-based
// pathfinding (greedy step toward player when in line-of-sight, random walk
// otherwise).
// =============================================================================
const monsterTex = makeMonsterTexture();
const monsterMat = new THREE.SpriteMaterial({
  map: monsterTex,
  fog: true, // fog hides it well at distance — perfect for the slow-reveal vibe
  transparent: true,
  depthWrite: false,
});
const monsterSprite = new THREE.Sprite(monsterMat);
monsterSprite.scale.set(2.2, 2.2, 1);
// Start the monster far away from the player so the first 20–30 seconds feel
// safely empty. The player teleports back to (0,0,0) on play-start.
monsterSprite.position.set(40, MONSTER_HEIGHT / 2 + 0.3, 40);
scene.add(monsterSprite);

const monsterState = {
  pos: new THREE.Vector3(40, MONSTER_HEIGHT / 2 + 0.3, 40),
  vel: new THREE.Vector3(0, 0, 0),
  wanderTarget: null,
  lastSeenAt: 0,         // ts of last player-sighting
  lastTeleport: 0,       // ts of last forced relocate
  isHunting: false,
};

// =============================================================================
// COLLISION — simple cell-based AABB. We check the four cardinal walls of
// whatever cell the player is in (plus the four diagonals). Cheap because
// the grid is already a hash by cell.
// =============================================================================
function cellAt(worldX, worldZ) {
  return { cx: Math.floor(worldX / CELL), cy: Math.floor(worldZ / CELL) };
}

function collideMove(curX, curZ, dx, dz) {
  // Try X then Z separately so we slide along walls instead of stopping.
  let nx = curX, nz = curZ;
  const tryMove = (tx, ty) => {
    const { cx, cy } = cellAt(tx, ty);
    const cell = grid.get(cellKey(cx, cy));
    if (!cell) return false; // off grid — block
    // local fractional position within cell
    const fx = tx - cx * CELL;
    const fz = ty - cy * CELL;
    const r = PLAYER_RADIUS;
    if (cell.walls.W && fx < r) return false;
    if (cell.walls.E && fx > CELL - r) return false;
    if (cell.walls.N && fz < r) return false;
    if (cell.walls.S && fz > CELL - r) return false;
    return true;
  };
  if (tryMove(nx + dx, nz)) nx += dx;
  if (tryMove(nx, nz + dz)) nz += dz;
  return [nx, nz];
}

// Has line-of-sight between two world positions? Step along the line in 0.5m
// increments and check each cell for blocking walls.
function hasLineOfSight(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(2, Math.floor(dist / 0.4));
  let prevCx = null, prevCy = null;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = ax + dx * t, z = az + dz * t;
    const cx = Math.floor(x / CELL), cy = Math.floor(z / CELL);
    if (cx !== prevCx || cy !== prevCy) {
      // Just check if we cross a wall between adjacent cells.
      if (prevCx !== null) {
        const pcell = grid.get(cellKey(prevCx, prevCy));
        if (!pcell) return false;
        if (cx > prevCx && pcell.walls.E) return false;
        if (cx < prevCx && pcell.walls.W) return false;
        if (cy > prevCy && pcell.walls.S) return false;
        if (cy < prevCy && pcell.walls.N) return false;
      }
      prevCx = cx; prevCy = cy;
    }
  }
  return true;
}

// =============================================================================
// PLAYER STATE
// =============================================================================
const player = {
  pos: new THREE.Vector3(CELL / 2, PLAYER_H, CELL / 2),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  sanity: 100,
  walkTime: 0,
  walkBob: 0,
  lastFootstep: 0,
  visitedCells: new Set(['0,0']),
  deepestCell: 0,
};

camera.position.copy(player.pos);

// =============================================================================
// INPUT — keyboard + mouse + mobile drag-look
// =============================================================================
const keys = new Set();
window.addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase();
  keys.add(k);
  if (k === 'escape') {
    if (gameState === 'play') pauseGame();
  }
});
window.addEventListener('keyup', (e) => keys.delete((e.key || '').toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// Mouse look — only active when pointer is locked.
let pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
renderer.domElement.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.yaw -= e.movementX * MOUSE_SENS;
  player.pitch -= e.movementY * MOUSE_SENS;
  // Clamp pitch so we don't flip upside-down.
  player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
});

// Click anywhere on the canvas while playing to re-acquire pointer-lock (the
// browser drops it on ESC). The start button is the initial acquisition.
renderer.domElement.addEventListener('click', () => {
  if (gameState === 'play' && !pointerLocked && !_isTouch) {
    renderer.domElement.requestPointerLock();
  }
});

// =============================================================================
// MOBILE CONTROLS — virtual joystick (left) + drag-anywhere to look (right
// half of the screen). The shared mobileControls module gives us the joystick
// for free; we add our own touch-drag handler for the camera.
// =============================================================================
let mc = null;
const mcMove = { x: 0, y: 0, mag: 0 };
if (_isTouch) {
  mc = createMobileControls({
    layout: 'wasd-only',
    keys,
    onMove: (x, y, mag) => { mcMove.x = x; mcMove.y = y; mcMove.mag = mag; },
  });
  // Drag-anywhere look — but only on the right HALF of the screen, so the
  // joystick (left side) is unaffected. We track a per-finger origin so look
  // is relative.
  let lookFingerId = null, lookLastX = 0, lookLastY = 0;
  const isInJoystickZone = (clientX) => clientX < window.innerWidth * 0.5;
  document.addEventListener('touchstart', (e) => {
    if (gameState !== 'play') return;
    for (const t of e.changedTouches) {
      if (isInJoystickZone(t.clientX)) continue;
      // Skip touches on UI buttons (any element with explicit pointer events).
      if (t.target?.closest?.('.mc-root, button, a')) continue;
      if (lookFingerId === null) {
        lookFingerId = t.identifier;
        lookLastX = t.clientX; lookLastY = t.clientY;
      }
    }
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (gameState !== 'play') return;
    for (const t of e.changedTouches) {
      if (t.identifier !== lookFingerId) continue;
      const dx = t.clientX - lookLastX, dy = t.clientY - lookLastY;
      lookLastX = t.clientX; lookLastY = t.clientY;
      player.yaw -= dx * TOUCH_SENS;
      player.pitch -= dy * TOUCH_SENS;
      player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
    }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === lookFingerId) { lookFingerId = null; }
    }
  }, { passive: true });
  document.addEventListener('touchcancel', () => { lookFingerId = null; }, { passive: true });
}

// =============================================================================
// GAME STATE MACHINE
// =============================================================================
let gameState = 'menu'; // 'menu' | 'play' | 'paused' | 'dead'
let runStartTs = 0;
let totalElapsed = 0;
let jumpscaring = false;
let jumpscareEnd = 0;

const startOverlay = document.getElementById('start-overlay');
const endOverlay = document.getElementById('end-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const hudEl = document.getElementById('hud');
const flashEl = document.getElementById('flash');
const sanityFill = document.getElementById('hud-sanity');
const sanityBar = sanityFill.parentElement;
const depthOut = document.getElementById('hud-depth');
const levelOut = document.getElementById('hud-level');
const endDepth = document.getElementById('end-depth');
const endLevel = document.getElementById('end-level');
const endBest = document.getElementById('end-best');
const startBestOut = document.getElementById('start-best');

// Load + display previous best on the start screen.
const best = loadBest('backrooms-3d');
if (best && typeof best.depth === 'number') {
  startBestOut.textContent = `${best.depth} rooms (lvl ${best.level || 0})`;
}

function startGame() {
  gameState = 'play';
  document.body.classList.add('is-playing');
  startOverlay.hidden = true;
  endOverlay.hidden = true;
  pauseOverlay.hidden = true;
  hudEl.hidden = false;
  // Reset player.
  player.pos.set(CELL / 2, PLAYER_H, CELL / 2);
  player.yaw = 0; player.pitch = 0;
  player.sanity = 100;
  player.visitedCells.clear();
  player.visitedCells.add('0,0');
  player.deepestCell = 0;
  // Reset monster — start far away.
  monsterSprite.position.set(60, MONSTER_HEIGHT / 2 + 0.3, 60);
  monsterState.pos.copy(monsterSprite.position);
  monsterState.isHunting = false;
  monsterState.lastSeenAt = performance.now() / 1000;
  monsterState.lastTeleport = performance.now() / 1000;
  // Pointer-lock on desktop.
  if (!_isTouch) {
    renderer.domElement.requestPointerLock();
  }
  runStartTs = performance.now() / 1000;
  totalElapsed = 0;
  // First user gesture — safe to start the audio engine now.
  startAudio();
  playAmbience(0.6);
}

function pauseGame() {
  if (gameState !== 'play') return;
  gameState = 'paused';
  document.body.classList.remove('is-playing');
  pauseOverlay.hidden = false;
  document.exitPointerLock?.();
  playAmbience(0); // mute ambience while paused
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'play';
  document.body.classList.add('is-playing');
  pauseOverlay.hidden = true;
  if (!_isTouch) {
    renderer.domElement.requestPointerLock();
  }
  playAmbience(0.6);
}

function endGame(reason) {
  if (gameState === 'dead') return;
  gameState = 'dead';
  document.body.classList.remove('is-playing');
  document.exitPointerLock?.();
  // Compute final score: total unique cells visited = "depth", + level tier.
  const depth = player.visitedCells.size;
  const level = Math.floor(depth / 20);
  endDepth.textContent = String(depth);
  endLevel.textContent = String(level);
  const title = document.getElementById('end-title');
  const sub = document.getElementById('end-sub');
  if (reason === 'monster') {
    title.textContent = 'CAUGHT';
    sub.textContent = 'It found you. It always finds you.';
  } else {
    title.textContent = 'LOST';
    sub.textContent = 'Your sanity gave out. The yellow walls won.';
  }
  // Submit + show best. Higher depth = better; we compare descending on depth.
  const run = { depth, level, score: depth, ts: Date.now() };
  const result = submitRun('backrooms-3d', run, (a, b) => (b.depth || 0) - (a.depth || 0));
  const b2 = result.current;
  endBest.innerHTML = `Best depth: <b>${b2.depth} rooms (lvl ${b2.level || 0})</b>${result.isNewBest ? ' ★ NEW BEST!' : ''}`;
  endOverlay.hidden = false;
  playAmbience(0);
}

// Wire overlay buttons.
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('end-restart').addEventListener('click', () => {
  endOverlay.hidden = true;
  startGame();
});
document.getElementById('pause-resume').addEventListener('click', resumeGame);
document.getElementById('pause-restart').addEventListener('click', () => {
  pauseOverlay.hidden = true;
  startGame();
});

// =============================================================================
// MAIN LOOP — fixed-step-friendly delta with a sane cap so tab-out doesn't
// teleport everything. We use rAF throughout.
// =============================================================================
let prevTs = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - prevTs) / 1000); // cap to 50ms
  prevTs = now;
  if (gameState === 'play') {
    tickPlay(dt);
  } else if (gameState === 'paused' || gameState === 'menu') {
    // Idle frame — still render so the menu has a live backdrop.
  }
  renderer.render(scene, camera);
}

function tickPlay(dt) {
  totalElapsed += dt;
  // ---- Input → desired velocity ----
  const fwd = (keys.has('w') || keys.has('arrowup')) ? 1 : 0;
  const back = (keys.has('s') || keys.has('arrowdown')) ? 1 : 0;
  const left = (keys.has('a') || keys.has('arrowleft')) ? 1 : 0;
  const right = (keys.has('d') || keys.has('arrowright')) ? 1 : 0;
  let mx = (right - left);
  let my = (back - fwd);
  // Mobile joystick — overrides if active.
  if (_isTouch && mcMove.mag > 0.05) {
    mx = mcMove.x; my = mcMove.y;
  }
  // Convert input axes to world-space using yaw.
  const cs = Math.cos(player.yaw), sn = Math.sin(player.yaw);
  // Forward in world = (-sin yaw, 0, -cos yaw) when pitch is 0.
  let vx = (-sn * (-my)) + (cs * mx);
  let vz = (-cs * (-my)) + (-sn * mx);
  const inputMag = Math.hypot(vx, vz);
  if (inputMag > 1) { vx /= inputMag; vz /= inputMag; }
  vx *= WALK_SPEED; vz *= WALK_SPEED;
  // ---- Collide + integrate ----
  const [nx, nz] = collideMove(player.pos.x, player.pos.z, vx * dt, vz * dt);
  const moved = Math.hypot(nx - player.pos.x, nz - player.pos.z);
  player.pos.x = nx; player.pos.z = nz;
  // Walk bob — subtle vertical oscillation while moving.
  if (moved > 0.001) {
    player.walkTime += dt * 8;
    player.walkBob = Math.sin(player.walkTime) * 0.04;
    // Footsteps timed to bob phase peaks.
    if (now() - player.lastFootstep > 0.35) {
      playFootstep(moved / dt / WALK_SPEED);
      player.lastFootstep = now();
    }
  } else {
    player.walkBob *= 0.85; // settle to 0
  }
  // ---- Camera ----
  camera.position.set(player.pos.x, PLAYER_H + player.walkBob, player.pos.z);
  // Build look direction from yaw/pitch.
  const lookX = Math.cos(player.pitch) * -Math.sin(player.yaw);
  const lookY = Math.sin(player.pitch);
  const lookZ = Math.cos(player.pitch) * -Math.cos(player.yaw);
  camera.lookAt(camera.position.x + lookX, camera.position.y + lookY, camera.position.z + lookZ);
  // ---- Cell tracking + maze streaming ----
  const { cx, cy } = cellAt(player.pos.x, player.pos.z);
  const k = cellKey(cx, cy);
  if (!player.visitedCells.has(k)) {
    player.visitedCells.add(k);
    player.deepestCell++;
  }
  expandIfNeeded(cx, cy);
  syncVisibleCells(cx, cy);
  // ---- Lighting flicker ----
  tickLights(dt, cx, cy);
  // ---- Monster ----
  tickMonster(dt);
  // ---- Sanity ----
  tickSanity(dt);
  // ---- HUD ----
  tickHUD();
  // ---- Jumpscare timer ----
  if (jumpscaring && now() > jumpscareEnd) {
    jumpscaring = false;
    flashEl.classList.remove('is-on');
    endGame('monster');
  }
}

// Helper — current "game time" in seconds. Wraps performance.now() so it's a
// stable monotonic source for cooldowns.
function now() { return performance.now() / 1000; }

// =============================================================================
// LIGHT TICK — each visible fixture computes a per-frame intensity using
// random flicker, dying-light fade, and dead-light gates.
// =============================================================================
function tickLights(dt, pcx, pcy) {
  let buzzAccum = 0, buzzCount = 0;
  for (let dy = -RENDER_RADIUS; dy <= RENDER_RADIUS; dy++) {
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      const cell = grid.get(cellKey(pcx + dx, pcy + dy));
      if (!cell?.light) continue;
      let intensity = 0.5;
      // Base flicker — sin wave + random jitter.
      const sinVal = Math.sin(totalElapsed * (8 + cell.fixturePhase) + cell.fixturePhase);
      intensity *= 0.85 + 0.15 * sinVal;
      // Random spike-out: every fixtureFlickerRate seconds on average, the
      // light dips for a brief frame.
      const r = Math.random();
      if (r < dt / cell.fixtureFlickerRate) {
        intensity *= 0.2;
        playFlicker();
      }
      // Dying lights — pulse harder + intermittent full-out.
      if (cell.fixtureDying) {
        intensity *= (Math.sin(totalElapsed * 1.4 + cell.fixturePhase * 3) > 0) ? 1.0 : 0.15;
      }
      cell.light.intensity = intensity;
      // Visual sync — the ceiling fixture plane brightens with the light.
      if (cell.fixtureMat) {
        const v = Math.min(1, intensity * 1.8);
        cell.fixtureMat.color.setRGB(v, v * 0.95, v * 0.75);
      }
      buzzAccum += intensity; buzzCount++;
    }
  }
  // Aggregate buzz volume — louder when more lights are visible/lit.
  if (buzzCount > 0) {
    playBuzz(Math.min(1, buzzAccum / buzzCount));
  }
}

// =============================================================================
// MONSTER TICK — moves the sprite toward the player, hunts when close,
// triggers the jumpscare on catch, and teleports if it hasn't been seen.
// =============================================================================
function tickMonster(dt) {
  const dx = player.pos.x - monsterState.pos.x;
  const dz = player.pos.z - monsterState.pos.z;
  const dist = Math.hypot(dx, dz);
  // Audio cue — distance-based panning + continuous prox engine update.
  const screenSpaceX = Math.atan2(dz, dx) - player.yaw;
  const panX = Math.sin(screenSpaceX); // -1 left, +1 right
  playMonsterFar(dist, panX);
  // Drives Agent B's continuous proximity voices (breath/heartbeat/dissonance).
  updateMonsterDistance(dist);
  // Determine line-of-sight.
  const sees = hasLineOfSight(player.pos.x, player.pos.z, monsterState.pos.x, monsterState.pos.z);
  if (sees && dist < MONSTER_DETECT_DIST * 1.5) {
    monsterState.lastSeenAt = now();
  }
  // Hunting state.
  monsterState.isHunting = dist < MONSTER_DETECT_DIST && sees;
  let speed = monsterState.isHunting ? MONSTER_HUNT_SPEED : MONSTER_WANDER_SPEED;
  // Movement — head straight at the player if hunting, else wander.
  let mvx = 0, mvz = 0;
  if (monsterState.isHunting) {
    const inv = 1 / Math.max(0.001, dist);
    mvx = dx * inv; mvz = dz * inv;
  } else {
    // Random wander — pick a new target every few seconds, or whenever close.
    if (!monsterState.wanderTarget || Math.hypot(
          monsterState.pos.x - monsterState.wanderTarget.x,
          monsterState.pos.z - monsterState.wanderTarget.z) < 1.0) {
      // New target — a random cell within ±10 of monster pos.
      const ang = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 12;
      monsterState.wanderTarget = {
        x: monsterState.pos.x + Math.cos(ang) * r,
        z: monsterState.pos.z + Math.sin(ang) * r,
      };
    }
    const wx = monsterState.wanderTarget.x - monsterState.pos.x;
    const wz = monsterState.wanderTarget.z - monsterState.pos.z;
    const wd = Math.hypot(wx, wz);
    if (wd > 0.001) { mvx = wx / wd; mvz = wz / wd; }
  }
  // Collide + integrate (slimmer collision than player — monster squeezes by).
  const oldX = monsterState.pos.x, oldZ = monsterState.pos.z;
  const targetX = oldX + mvx * speed * dt;
  const targetZ = oldZ + mvz * speed * dt;
  // Try X then Z separately so monster slides along walls instead of stalling.
  const tryStep = (tx, tz) => {
    const c = grid.get(cellKey(Math.floor(tx / CELL), Math.floor(tz / CELL)));
    if (!c) return false;
    const fx = tx - Math.floor(tx / CELL) * CELL;
    const fz = tz - Math.floor(tz / CELL) * CELL;
    const r = 0.4;
    if (c.walls.W && fx < r) return false;
    if (c.walls.E && fx > CELL - r) return false;
    if (c.walls.N && fz < r) return false;
    if (c.walls.S && fz > CELL - r) return false;
    return true;
  };
  if (tryStep(targetX, oldZ)) monsterState.pos.x = targetX;
  if (tryStep(monsterState.pos.x, targetZ)) monsterState.pos.z = targetZ;
  monsterSprite.position.set(monsterState.pos.x, MONSTER_HEIGHT / 2 + 0.3, monsterState.pos.z);
  // Catch / jumpscare.
  if (dist < MONSTER_CATCH_DIST && !jumpscaring) {
    triggerJumpscare();
  }
  // Teleport-when-lost: if the monster hasn't been seen for a while, relocate
  // to a far cell so it can re-emerge from an unexpected direction.
  if (now() - monsterState.lastSeenAt > MONSTER_TELEPORT_INTERVAL
      && now() - monsterState.lastTeleport > MONSTER_TELEPORT_INTERVAL) {
    monsterState.lastTeleport = now();
    const ang = Math.random() * Math.PI * 2;
    const r = 35 + Math.random() * 20;
    monsterState.pos.x = player.pos.x + Math.cos(ang) * r;
    monsterState.pos.z = player.pos.z + Math.sin(ang) * r;
    monsterSprite.position.set(monsterState.pos.x, MONSTER_HEIGHT / 2 + 0.3, monsterState.pos.z);
  }
}

function triggerJumpscare() {
  if (jumpscaring) return;
  jumpscaring = true;
  jumpscareEnd = now() + 0.4;
  // Snap camera to monster face — instant 0.3s zoom-in feel.
  camera.fov = 50;
  camera.updateProjectionMatrix();
  flashEl.classList.add('is-on', 'is-red');
  playJumpscare();
  // Fade flash to white over the next frame so the final death overlay reads.
  setTimeout(() => {
    flashEl.classList.remove('is-red');
  }, 200);
  setTimeout(() => {
    camera.fov = 90;
    camera.updateProjectionMatrix();
  }, 600);
}

// =============================================================================
// SANITY — drains when not in light, faster when monster is close.
// =============================================================================
function tickSanity(dt) {
  // Is the player under a lit fixture? Check the current cell's light.
  const { cx, cy } = cellAt(player.pos.x, player.pos.z);
  const cell = grid.get(cellKey(cx, cy));
  let inLight = false;
  if (cell?.light && cell.light.intensity > 0.3) inLight = true;
  // Monster proximity check.
  const monDist = Math.hypot(monsterState.pos.x - player.pos.x, monsterState.pos.z - player.pos.z);
  const monClose = monDist < 25;
  let drain = SANITY_DRAIN_BASE;
  if (inLight) drain -= SANITY_RECOVER_LIGHT; // light gives back a bit
  if (monClose) drain += SANITY_DRAIN_MONSTER * (1 - monDist / 25);
  player.sanity = Math.max(0, Math.min(100, player.sanity - drain * dt));
  if (player.sanity <= 0) {
    endGame('sanity');
  }
}

// =============================================================================
// HUD UPDATE — DOM writes are cheap here because the values change slowly,
// but we still gate by deltas to avoid repainting every frame.
// =============================================================================
let lastHudDepth = -1, lastHudLevel = -1, lastHudSanityPct = -1;
function tickHUD() {
  const pct = Math.round(player.sanity);
  if (pct !== lastHudSanityPct) {
    sanityFill.style.width = pct + '%';
    sanityBar.classList.toggle('is-low', pct < 50 && pct >= 25);
    sanityBar.classList.toggle('is-critical', pct < 25);
    lastHudSanityPct = pct;
  }
  const depth = player.visitedCells.size;
  if (depth !== lastHudDepth) {
    depthOut.textContent = String(depth);
    lastHudDepth = depth;
  }
  const level = Math.floor(depth / 20);
  if (level !== lastHudLevel) {
    levelOut.textContent = String(level);
    lastHudLevel = level;
  }
}

// =============================================================================
// RESIZE — keep renderer + camera aspect in sync. Clamp DPR to 1.0 on
// high-res phones so frame rate stays north of 30 fps.
// =============================================================================
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// First frame.
requestAnimationFrame(loop);

})(); // end async boot IIFE
