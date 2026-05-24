// =============================================================================
// CLOWN IN THE FOREST — realistic first-person horror in a midnight forest.
//
// Tone target: SLENDER. Grounded, oppressive, hopeless. No cartoony elements.
// The player has 5 lost items to find before the clown catches them; if they
// collect all 5 a red beacon appears at the map edge and they can ESCAPE
// before dawn.
//
// Architecture:
//   1. Lazy-load Three.js + audio.js so the hub doesn't pay the cost.
//   2. Build procedural canvas textures once at boot (ground, bark, foliage,
//      ground-fog, item icons, the clown sprite). Zero image assets.
//   3. Procedural 400x400m forest:
//        - PlaneGeometry ground with ImprovedNoise vertex displacement
//        - InstancedMesh of tapered tree trunks (~1100 instances)
//        - InstancedMesh of leaf canopies (sphere geometry)
//        - Some trees are dead (no canopy instance)
//        - Fallen logs, rocks, fog patches scattered
//   4. Dense linear fog (10..45m) so the world feels SMALL even though it's huge.
//   5. Flashlight = SpotLight attached to camera, casts moving shadows (visceral).
//   6. CLOWN AI state machine — STALK → HUNT → CHASE → KILL.
//   7. Audio is co-owned with Agent B in ./audio.js — we just call its API.
//
// State machine: MENU → PLAY → PAUSED → DEAD | ESCAPED → MENU.
// =============================================================================

import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createSettingsMenu, caption as wgCaption } from '../../src/shared/settingsMenu.js';
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { profileKey } from '../../src/shared/profile.js';

// =============================================================================
// BOOT — async IIFE because top-level await isn't in our build target.
// =============================================================================
(async () => {

// ---------------------------------------------------------------------------
// AUDIO — Agent B owns ./audio.js. We instantiate the controller now but
// only call start() once the player clicks ENTER (autoplay policy).
// Every wrapper no-ops if audio.js fails to load.
// ---------------------------------------------------------------------------
let audio = null;
try {
  const audioMod = await import('./audio.js').catch(() => null);
  audio = audioMod?.createAudio ? audioMod.createAudio() : null;
} catch { audio = null; }
const playFootstep    = (s)    => { try { audio?.playFootstep?.(s); } catch {} };
const playTwigSnap    = ()     => { try { audio?.playTwigSnap?.(); } catch {} };
const playClownLaugh  = (p, d) => { try { audio?.playClownLaugh?.(p, d); } catch {} };
const playClownStep   = (p, d) => { try { audio?.playClownStep?.(p, d); } catch {} };
const playHuntMusic   = ()     => { try { audio?.playHuntMusic?.(); } catch {} };
const playChaseMusic  = ()     => { try { audio?.playChaseMusic?.(); } catch {} };
const playStalkMusic  = ()     => { try { audio?.playStalkMusic?.(); } catch {} };
const playKill        = ()     => { try { audio?.playKill?.(); } catch {} };
const playEscape      = ()     => { try { audio?.playEscape?.(); } catch {} };
const playPickup      = ()     => { try { audio?.playPickup?.(); } catch {} };
const playLightning   = ()     => { try { audio?.playLightning?.(); } catch {} };
const playFlashlight  = (on)   => { try { audio?.playFlashlight?.(on); } catch {} };
const playOwl         = ()     => { try { audio?.playOwl?.(); } catch {} };
const playAmbience    = (v)    => { try { audio?.playAmbience?.(v); } catch {} };
const startAudio      = ()     => { try { audio?.start?.(); } catch {} };
const stopAudio       = ()     => { try { audio?.stop?.(); } catch {} };
const updateClownDist = (d)    => { try { audio?.updateClownDistance?.(d); } catch {} };
const setHeartbeat    = (r)    => { try { audio?.setHeartbeatRate?.(r); } catch {} };

// ---------------------------------------------------------------------------
// SETTINGS — gear button auto-mounts top-right. Controls help on hover/click.
// We keep the handle so the pause overlay can re-open the settings modal on
// demand (player is in the dark — finding the gear icon is annoying).
// ---------------------------------------------------------------------------
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const settingsHandle = createSettingsMenu({
  gameId: 'clown-forest',
  getControlsHelp: () => _isTouch
    ? 'JOYSTICK walk · DRAG right half to look · TAKE / TORCH / RUN / CROUCH buttons · long-press = pause'
    : 'WASD walk · MOUSE look · E take · F flashlight · SHIFT sprint · C crouch · TAB objectives · R restart · ESC pause',
});

// ---------------------------------------------------------------------------
// LAZY THREE.JS + ImprovedNoise for ground displacement.
// ---------------------------------------------------------------------------
const THREE = await import('three');
const { ImprovedNoise } = await import('three/examples/jsm/math/ImprovedNoise.js');

// =============================================================================
// CONSTANTS — tweak knobs.
// =============================================================================
const WORLD_SIZE   = 400;          // metres; forest is 400x400
const TREE_COUNT   = 1100;         // trunk instances (split across 4 types)
const ROCK_COUNT   = 80;
const LOG_COUNT    = 50;
const FOG_NEAR     = 10;
const FOG_FAR      = 45;
const FOG_COLOR    = 0x0a0b15;
// Tree type distribution — 40% pine, 30% oak, 15% dead, 15% weeping.
const TREE_MIX = { pine: 0.40, oak: 0.30, dead: 0.15, weeping: 0.15 };
const TREE_CULL_DIST = 60;         // cull rendering past fog (kept >= FOG_FAR for safety)

const PLAYER_H            = 1.65;  // eye height (slightly lower than backrooms)
const PLAYER_CROUCH_H     = 1.15;
const PLAYER_R            = 0.32;
const WALK_SPEED          = 2.5;
const SPRINT_SPEED        = 5.0;
const CROUCH_SPEED        = 1.2;
const STAMINA_MAX         = 8.0;   // 8 seconds of sprint
const STAMINA_REGEN       = 1.4;   // per sec when not sprinting
const MOUSE_SENS          = 0.0022;
const TOUCH_SENS          = 0.0050;

const FLASHLIGHT_DRAIN    = 0.3;   // % per second
const ITEMS_TO_ESCAPE     = 5;
const ITEM_GLOW_DIST      = 8;
const ITEM_PICKUP_DIST    = 1.5;

// Clown tuning
const CLOWN_HEIGHT        = 2.2;
const CLOWN_HUNT_SPEED    = 1.6;
const CLOWN_CHASE_SPEED   = 4.0;
const CLOWN_KILL_DIST     = 1.5;
const CLOWN_CHASE_TRIGGER = 10;    // metres + line-of-sight => CHASE
const CLOWN_HUNT_AFTER    = 300;   // 5 minutes => HUNT phase activates
const CLOWN_STALK_INTERVAL_MIN = 25;
const CLOWN_STALK_INTERVAL_MAX = 55;
const CLOWN_TELEPORT_DELAY = 10;   // seconds out-of-sight before relocation
// Difficulty curve windows — soften the first 90s, gradual stalk in 90-300s,
// HUNT enabled at 300s+, CHASE at 600s+ OR all-items-collected (handled below).
const CURVE_QUIET_UNTIL   = 90;    // before this, only very rare ambient peeks
const CURVE_STALK_RAMP    = 300;   // gradual stalk events until HUNT
const CURVE_CHASE_ALLOW_AT= 600;   // after this CHASE may trigger naturally

// Time-of-night clock: 0 = dusk (just-started), 100 = dawn (auto-win).
// 1% per 30s => 50 min real-time full survival run. Item-collection is the
// primary path; survival to dawn is the alt path.
const NIGHT_PERCENT_PER_SEC = 1 / 30;
const NIGHT_FOG_LIFT_PCT    = 80;
const NIGHT_BRIGHTEN_PCT    = 95;
const NIGHT_DAWN_PCT        = 100;

// Stamina exhaustion lockout — when stamina hits 0 you can't sprint for this
// long (gives sprint real weight).
const STAMINA_EXHAUST_TIME  = 1.5;

// Hidden cassette tapes — 3 lore collectibles, persistent per-profile.
const TAPE_COUNT            = 3;

// Random ambient events (NEAR_MISS / CIRCLE / WHISPER / DISTURBANCE).
const RANDOM_EVENT_MIN_GAP  = 60;
const RANDOM_EVENT_MAX_GAP  = 150;

// Ambush state — clown stalks from behind after item pickup, for this long.
const AMBUSH_DURATION       = 60;

// =============================================================================
// PROCEDURAL CANVAS TEXTURES — desaturated, organic. Zero image assets.
// =============================================================================

// Forest floor: dark mud + scattered leaves + dirt patches + puddles + grass.
// Tileable. Designed to read at multiple scales (human-distance crunch + rep).
function makeGroundTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  // Base dark soil.
  g.fillStyle = '#1a1a10'; g.fillRect(0, 0, 512, 512);
  // Many overlapping dirt patches with varying brown tones.
  for (let i = 0; i < 260; i++) {
    const cx = Math.random() * 512, cy = Math.random() * 512;
    const r = 12 + Math.random() * 52;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const tone = Math.random();
    const col = tone < 0.4 ? '58, 50, 32' : tone < 0.7 ? '42, 48, 24' : '36, 30, 18';
    grad.addColorStop(0, `rgba(${col}, ${0.4 + Math.random() * 0.35})`);
    grad.addColorStop(1, `rgba(${col}, 0)`);
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // PUDDLES — small darker (near-black with bluish sheen) wet patches.
  for (let i = 0; i < 14; i++) {
    const cx = Math.random() * 512, cy = Math.random() * 512;
    const rx = 14 + Math.random() * 22;
    const ry = 8 + Math.random() * 14;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0,   'rgba(8, 12, 18, 0.85)');
    grad.addColorStop(0.6, 'rgba(14, 22, 28, 0.55)');
    grad.addColorStop(1,   'rgba(20, 22, 24, 0)');
    g.fillStyle = grad;
    g.save();
    g.translate(cx, cy);
    g.rotate(Math.random() * Math.PI);
    g.scale(rx / 22, ry / 14);
    g.beginPath();
    g.arc(0, 0, 22, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Faint reflective highlight on the puddle edge.
    g.strokeStyle = 'rgba(120, 140, 160, 0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(cx, cy, rx * 0.85, ry * 0.85, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // LEAF LITTER — denser scattering of small leaf shapes (curved blade).
  for (let i = 0; i < 720; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const w = 2 + Math.random() * 4, h = 1 + Math.random() * 3;
    const tone = Math.random();
    g.fillStyle =
      tone < 0.4 ? `rgba(${42 + Math.random() * 18}, ${36 + Math.random() * 14}, ${18}, 0.55)` :  // brown
      tone < 0.75 ? `rgba(${28 + Math.random() * 18}, ${44 + Math.random() * 18}, ${20}, 0.5)` : // dark green
      `rgba(${70 + Math.random() * 18}, ${48 + Math.random() * 14}, ${20}, 0.55)`;               // orange-rust
    g.save();
    g.translate(x, y);
    g.rotate(Math.random() * Math.PI * 2);
    // Use ellipse for a leaf shape (longer than wide).
    g.beginPath();
    g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // DEAD GRASS TUFTS — short cluster of vertical streaks.
  for (let i = 0; i < 38; i++) {
    const cx = Math.random() * 512, cy = Math.random() * 512;
    g.strokeStyle = `rgba(${78 + Math.random() * 18}, ${68 + Math.random() * 12}, ${30}, 0.6)`;
    g.lineWidth = 0.8;
    for (let k = 0; k < 6; k++) {
      const sx = cx + (Math.random() - 0.5) * 6;
      const sy = cy + (Math.random() - 0.5) * 4;
      g.beginPath();
      g.moveTo(sx, sy + 3);
      g.lineTo(sx + (Math.random() - 0.5) * 1.5, sy - 2 - Math.random() * 3);
      g.stroke();
    }
  }
  // Occasional small rock dots (grey-brown).
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${70 + Math.random() * 25}, ${66 + Math.random() * 18}, ${56}, 0.7)`;
    g.beginPath();
    g.arc(Math.random() * 512, Math.random() * 512, 1.5 + Math.random() * 2, 0, Math.PI * 2);
    g.fill();
  }
  // Final very dark noise pass — dirt graininess.
  for (let i = 0; i < 4200; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.35})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Tile across the 400m plane many times so detail stays at human scale.
  tex.repeat.set(80, 80);
  tex.anisotropy = 4;
  return tex;
}

// PINE foliage — slightly bluer-green than oak. Used by cone canopies.
function makePineFoliageTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#091410'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 256;
    const r = 2 + Math.random() * 7;
    const tone = 14 + Math.random() * 22;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${tone * 0.3}, ${tone}, ${tone * 0.55}, 0.7)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Tiny needle highlights (vertical streaks).
  for (let i = 0; i < 120; i++) {
    g.strokeStyle = `rgba(${30 + Math.random() * 18}, ${60 + Math.random() * 24}, ${38}, 0.4)`;
    g.lineWidth = 0.6;
    const x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 4, y + 3 + Math.random() * 4);
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// WEEPING foliage — flowing vertical streaks (drooping leaves).
function makeWeepingFoliageTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#10180a'; g.fillRect(0, 0, 256, 256);
  // Long vertical streaks (drooping willow/birch).
  for (let i = 0; i < 220; i++) {
    g.strokeStyle = `rgba(${24 + Math.random() * 26}, ${52 + Math.random() * 26}, ${26}, ${0.4 + Math.random() * 0.3})`;
    g.lineWidth = 0.6 + Math.random() * 1.4;
    const x = Math.random() * 256;
    const yStart = Math.random() * 80;
    const yEnd = yStart + 80 + Math.random() * 130;
    g.beginPath();
    g.moveTo(x, yStart);
    g.bezierCurveTo(x + 3, yStart + 40, x - 2, yStart + 100, x + (Math.random() - 0.5) * 6, yEnd);
    g.stroke();
  }
  // Dark voids between strands.
  for (let i = 0; i < 18; i++) {
    g.fillStyle = 'rgba(0, 0, 0, 0.4)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 16, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// Bark variant — pale greyed-white (dead/birch). Same dimensions for trunk reuse.
function makeDeadBarkTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#867f76'; g.fillRect(0, 0, 256, 512);
  // Horizontal birch-style bands.
  for (let i = 0; i < 36; i++) {
    g.fillStyle = `rgba(${10 + Math.random() * 30}, ${10 + Math.random() * 18}, ${10}, ${0.45 + Math.random() * 0.35})`;
    const y = Math.random() * 512;
    g.fillRect(0, y, 256, 0.6 + Math.random() * 3);
  }
  // Cracks / dark fissures.
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${0.45 + Math.random() * 0.3})`;
    const x = Math.random() * 256;
    g.fillRect(x, 0, 1 + Math.random() * 2, 512);
  }
  // Knot scars.
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 512;
    const r = 5 + Math.random() * 12;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(20, 14, 10, 0.85)');
    grad.addColorStop(1, 'rgba(20, 14, 10, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Subtle scratch marks (claw / knife) on a few dead trees.
  for (let i = 0; i < 6; i++) {
    g.strokeStyle = `rgba(220, 215, 205, ${0.55 + Math.random() * 0.25})`;
    g.lineWidth = 0.7;
    const sx = Math.random() * 256, sy = 100 + Math.random() * 300;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(sx + k * 3, sy);
      g.lineTo(sx + k * 3 + (Math.random() - 0.5) * 4, sy + 18 + Math.random() * 6);
      g.stroke();
    }
  }
  // Faint grain noise.
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.18})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Dark fissured bark texture for tree trunks.
function makeBarkTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1a120a'; g.fillRect(0, 0, 256, 512);
  // Vertical fissures (lighter highlight + dark crack).
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256;
    const w = 1 + Math.random() * 3;
    const tone = 30 + Math.random() * 25;
    g.fillStyle = `rgba(${tone}, ${tone * 0.75}, ${tone * 0.45}, 0.55)`;
    g.fillRect(x, 0, w, 512);
    g.fillStyle = 'rgba(0, 0, 0, 0.45)';
    g.fillRect(x + w, 0, 1, 512);
  }
  // Horizontal noise bands (bark cross-grain).
  for (let i = 0; i < 250; i++) {
    g.fillStyle = `rgba(${20 + Math.random() * 30}, ${14 + Math.random() * 20}, ${8}, ${Math.random() * 0.35})`;
    g.fillRect(0, Math.random() * 512, 256, 1 + Math.random() * 2);
  }
  // Random dark knots.
  for (let i = 0; i < 12; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 512;
    const r = 6 + Math.random() * 14;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Very dark base grain.
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.4})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Foliage (canopy) texture — clumpy dark green/black noise. Sphere mapping
// will smear it into a soft cloud which reads as a leafy mass at distance.
function makeFoliageTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0e1808'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1000; i++) {
    const cx = Math.random() * 256, cy = Math.random() * 256;
    const r = 2 + Math.random() * 8;
    const tone = 16 + Math.random() * 24;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${tone * 0.4}, ${tone}, ${tone * 0.3}, 0.7)`);
    grad.addColorStop(1, `rgba(0, 0, 0, 0)`);
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // Dark blobs (deep shadow gaps).
  for (let i = 0; i < 20; i++) {
    g.fillStyle = 'rgba(0, 0, 0, 0.45)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 20, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// Ground-fog patch — radial gradient soft puff. Used on a transparent quad,
// scattered across the forest floor to fake low-hanging mist.
function makeFogPatchTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0,   'rgba(180, 190, 210, 0.45)');
  grad.addColorStop(0.5, 'rgba(150, 160, 180, 0.18)');
  grad.addColorStop(1,   'rgba(120, 130, 150, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Glowing item icon — used for the 5 pickups. Each item gets a slightly
// different tint but the same overall faint glow shape.
function makeItemTexture(label) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  // Soft halo.
  const halo = g.createRadialGradient(64, 64, 0, 64, 64, 60);
  halo.addColorStop(0,   'rgba(255, 220, 160, 0.7)');
  halo.addColorStop(0.4, 'rgba(255, 180, 100, 0.3)');
  halo.addColorStop(1,   'rgba(255, 140, 60, 0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, 128, 128);
  // Item silhouette in the center — small pixel doodle per item.
  g.fillStyle = '#1a1006';
  switch (label) {
    case 'radio':
      g.fillRect(48, 56, 32, 22);
      g.fillStyle = '#3a3028';
      g.fillRect(52, 60, 16, 8);
      g.fillStyle = '#ffd680';
      g.fillRect(70, 62, 6, 4);
      g.fillStyle = '#1a1006';
      g.fillRect(56, 50, 2, 10); // antenna
      break;
    case 'locket':
      g.beginPath();
      g.arc(64, 66, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd680';
      g.fillRect(63, 50, 2, 8); // chain
      break;
    case 'phone':
      g.fillRect(54, 48, 20, 36);
      g.fillStyle = '#3a4858';
      g.fillRect(57, 52, 14, 26);
      g.fillStyle = '#1a1006';
      g.fillRect(62, 80, 4, 1);
      break;
    case 'lighter':
      g.fillRect(56, 56, 16, 22);
      g.fillStyle = '#3a3028';
      g.fillRect(58, 52, 12, 4);
      g.fillStyle = '#ffaa40';
      g.beginPath();
      g.moveTo(64, 48); g.lineTo(66, 52); g.lineTo(62, 52);
      g.closePath(); g.fill();
      break;
    case 'photo':
      g.fillRect(46, 52, 36, 28);
      g.fillStyle = '#3a3028';
      g.fillRect(49, 55, 30, 22);
      g.fillStyle = '#5a4a3a';
      g.fillRect(60, 64, 8, 8);
      break;
    default:
      g.beginPath();
      g.arc(64, 64, 10, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// THE CLOWN — billboard sprite. Tall figure, pale face, red triangle eyes,
// asymmetric red smile, ratty striped clown costume, machete in one hand.
// Drawn vertically (256x512) so the proportions read tall when scaled.
function makeClownTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 512);

  // ----- BODY / COSTUME -----
  // Torso — faded clown suit with vertical stripes. Slightly hunched silhouette.
  g.fillStyle = '#1a1408';
  // Body outline (slight hunch — leans forward).
  g.beginPath();
  g.moveTo(80, 200);  // left shoulder
  g.lineTo(176, 200); // right shoulder
  g.lineTo(184, 380); // right hip
  g.lineTo(72, 380);  // left hip
  g.closePath();
  g.fill();
  // Stripe painting — faded red/yellow/blue alternating.
  const stripes = ['#5a1414', '#1a3858', '#5a4a1a', '#5a1414', '#1a3858'];
  for (let i = 0; i < stripes.length; i++) {
    g.fillStyle = stripes[i];
    g.globalAlpha = 0.5;
    const x = 84 + (i / stripes.length) * 96;
    const w = 96 / stripes.length;
    g.fillRect(x, 202, w, 178);
  }
  g.globalAlpha = 1;
  // Dirt / blood smears on costume.
  for (let i = 0; i < 12; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 20}, 8, 8, ${0.35 + Math.random() * 0.3})`;
    const x = 86 + Math.random() * 92;
    const y = 220 + Math.random() * 140;
    g.beginPath();
    g.arc(x, y, 3 + Math.random() * 6, 0, Math.PI * 2);
    g.fill();
  }
  // Ruffle collar.
  g.fillStyle = '#48342a';
  g.beginPath();
  g.moveTo(80, 200);
  g.lineTo(86, 188); g.lineTo(94, 198); g.lineTo(102, 188);
  g.lineTo(110, 198); g.lineTo(120, 188); g.lineTo(128, 200);
  g.lineTo(136, 188); g.lineTo(146, 198); g.lineTo(156, 188);
  g.lineTo(164, 198); g.lineTo(172, 188); g.lineTo(176, 200);
  g.closePath();
  g.fill();

  // ----- ARMS -----
  // Left arm hanging by side.
  g.fillStyle = '#1a1408';
  g.fillRect(58, 208, 22, 110);
  g.fillStyle = '#48342a';
  g.fillRect(56, 312, 24, 14); // glove cuff
  g.fillStyle = '#d8c0a0';
  g.beginPath();
  g.arc(68, 332, 12, 0, Math.PI * 2);
  g.fill();
  // Right arm — holding a long machete.
  g.fillStyle = '#1a1408';
  g.fillRect(178, 208, 22, 110);
  g.fillStyle = '#48342a';
  g.fillRect(176, 312, 24, 14);
  g.fillStyle = '#d8c0a0';
  g.beginPath();
  g.arc(190, 332, 12, 0, Math.PI * 2);
  g.fill();
  // The machete — long thin blade extending down-right, with worn handle.
  g.save();
  g.translate(190, 332);
  g.rotate(0.15);
  // Handle (dark wood).
  g.fillStyle = '#2a1a0a';
  g.fillRect(-6, -10, 12, 22);
  // Blade — silver with darker bevel + bloody edge.
  g.fillStyle = '#9a9aa0';
  g.fillRect(-4, 10, 8, 110);
  g.fillStyle = '#5a5a64';
  g.fillRect(-4, 10, 2, 110);
  // Blood streaks on blade.
  g.fillStyle = 'rgba(110, 12, 12, 0.85)';
  g.fillRect(-3, 20, 2, 40);
  g.fillRect(0, 50, 2, 50);
  g.restore();

  // ----- HEAD -----
  // Pale flesh oval, slightly elongated.
  g.fillStyle = '#dcc8b0';
  g.beginPath();
  g.ellipse(128, 130, 56, 70, 0, 0, Math.PI * 2);
  g.fill();
  // Shadow under jaw (gives some depth).
  g.fillStyle = 'rgba(40, 30, 30, 0.45)';
  g.beginPath();
  g.ellipse(128, 178, 48, 18, 0, 0, Math.PI * 2);
  g.fill();
  // Shadow on left side (rim lighting from a moonlit right).
  g.fillStyle = 'rgba(20, 18, 30, 0.5)';
  g.beginPath();
  g.ellipse(98, 130, 22, 56, 0, 0, Math.PI * 2);
  g.fill();

  // Hair — wispy dark tufts on top + sides (greenish-black).
  g.fillStyle = '#0a1a08';
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI * 0.85 + (i / 13) * Math.PI * 0.7;
    const x = 128 + Math.cos(ang) * 56;
    const y = 130 + Math.sin(ang) * 70;
    g.beginPath();
    g.ellipse(x, y - 6, 8 + Math.random() * 6, 14 + Math.random() * 8, ang, 0, Math.PI * 2);
    g.fill();
  }

  // EYES — deep dark sockets first.
  g.fillStyle = '#0a0608';
  g.beginPath();
  g.ellipse(110, 116, 14, 10, 0, 0, Math.PI * 2); g.fill();
  g.beginPath();
  g.ellipse(146, 116, 14, 10, 0, 0, Math.PI * 2); g.fill();
  // Pupil — tiny glowing dot in each.
  g.fillStyle = '#fff8e0';
  g.fillRect(108, 114, 3, 3);
  g.fillRect(144, 114, 3, 3);
  // RED triangle markings around eyes (the classic killer-clown signature).
  g.fillStyle = '#9a0a0a';
  g.beginPath();
  g.moveTo(94, 96); g.lineTo(110, 124); g.lineTo(126, 96);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(130, 96); g.lineTo(146, 124); g.lineTo(162, 96);
  g.closePath(); g.fill();
  // Triangle inverted under each eye — completes the diamond markings.
  g.beginPath();
  g.moveTo(98, 136); g.lineTo(110, 124); g.lineTo(122, 136);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(134, 136); g.lineTo(146, 124); g.lineTo(158, 136);
  g.closePath(); g.fill();

  // RED LIPSTICK SMILE — asymmetric, way too wide. Drawn as a thick curved
  // stroke + jagged white teeth + drips.
  g.strokeStyle = '#8a0a0a';
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  // Asymmetric: left side curls higher than right.
  g.moveTo(80, 160);
  g.bezierCurveTo(90, 192, 160, 198, 184, 172);
  g.stroke();
  // Slightly thinner darker stroke under to add depth.
  g.strokeStyle = '#5a0808';
  g.lineWidth = 3;
  g.stroke();
  // Mouth interior (black void).
  g.fillStyle = '#0a0408';
  g.beginPath();
  g.moveTo(86, 164);
  g.bezierCurveTo(96, 186, 158, 190, 180, 170);
  g.bezierCurveTo(160, 178, 100, 178, 86, 164);
  g.closePath();
  g.fill();
  // Teeth — irregular jagged shards.
  g.fillStyle = '#e8dcc0';
  for (let i = 0; i < 9; i++) {
    const tx = 92 + i * 11;
    const ty = 168 + (i % 2 === 0 ? 0 : 2);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + 5, ty + 8 + Math.random() * 3);
    g.lineTo(tx + 10, ty);
    g.closePath();
    g.fill();
  }
  // Lipstick smudge on chin (a dripping streak).
  g.fillStyle = 'rgba(140, 10, 10, 0.85)';
  g.fillRect(124, 188, 2, 10);
  g.fillRect(140, 192, 2, 8);

  // Subtle nose — just a faint shadow line.
  g.fillStyle = 'rgba(80, 50, 50, 0.55)';
  g.beginPath();
  g.ellipse(128, 144, 6, 4, 0, 0, Math.PI * 2);
  g.fill();

  // Tiny RED CLOWN NOSE highlight (small — keeps the realism, isn't goofy).
  g.fillStyle = '#7a0a0a';
  g.beginPath();
  g.arc(128, 148, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#aa1414';
  g.beginPath();
  g.arc(126, 146, 2, 0, Math.PI * 2);
  g.fill();

  // Ground shadow underneath the body so the sprite reads as standing on something.
  g.fillStyle = 'rgba(0, 0, 0, 0.65)';
  g.beginPath();
  g.ellipse(128, 386, 70, 12, 0, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.premultiplyAlpha = false;
  return tex;
}

// =============================================================================
// THREE.JS SCENE — single scene, single camera.
// =============================================================================
const threeRoot = document.getElementById('three-root');
const scene = new THREE.Scene();
// Sky is upgraded later by initSky() to a gradient texture + moon + clouds.
// Solid colour here is the placeholder used before initSky() finishes.
scene.background = new THREE.Color(0x060810);
// Atmosphere (Agent B): density-based fog so we can animate it cheaply each
// frame. Base value sits between the breathing min/max; tickAtmosphere()
// oscillates it slowly and overrides for CHASE phase / near-dawn moments.
const FOG_DENSITY_BASE  = 0.022;
const FOG_DENSITY_MIN   = 0.018;
const FOG_DENSITY_MAX   = 0.028;
const FOG_DENSITY_CHASE = 0.040;
const FOG_DENSITY_DAWN  = 0.015;
const FOG_DENSITY_LIGHTNING = 0.005; // briefly when lightning fires (see further)
scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY_BASE);
// Note: FOG_FAR / FOG_NEAR constants are still consulted elsewhere for the
// clown's line-of-sight visibility cap, so they remain meaningful.

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, PLAYER_H, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
// Shadows ON — the flashlight's moving shadow is a major fear lever.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
threeRoot.appendChild(renderer.domElement);

// =============================================================================
// LIGHTING — very low ambient, faint moon, player flashlight, lightning flash.
// All values are tuned to keep the forest dark enough that the flashlight
// reads as a "stab" of light, but lifted just enough at the horizon to give
// silhouettes some pop (see moonRim below).
// =============================================================================
const ambient = new THREE.AmbientLight(0x0a0c12, 0.85);
scene.add(ambient);

// Moon — faint blue-white directional from above-rear. Adds a soft top-light
// to every surface so the world isn't pitch-black when the torch is off.
const moon = new THREE.DirectionalLight(0x6a78a0, 0.22);
moon.position.set(60, 100, 40);
moon.castShadow = false; // moon shadows would kill perf; flashlight handles drama
scene.add(moon);

// Rim light — second directional opposing the moon at low intensity. Pulls
// the dark side of tree trunks just barely out of the void, giving silhouettes
// a subtle edge that reads as "moonlit" without flattening the darkness.
const moonRim = new THREE.DirectionalLight(0x4a5a78, 0.10);
moonRim.position.set(-50, 30, -60);
moonRim.castShadow = false;
scene.add(moonRim);

// Hemisphere — sky tint vs ground tint, slightly stronger than before so the
// ground bounces a faint mood-coloured wash up into the canopy.
const hemi = new THREE.HemisphereLight(0x1a2238, 0x0a0805, 0.40);
scene.add(hemi);

// FLASHLIGHT — SpotLight attached to camera. Tighter (24°) than before for a
// more focused stab of light. Colour starts warm (#ffd070) and shifts toward
// orange as the battery drains. Intensity is driven by tickFlashlight() with
// a multi-tier flicker model (subtle / notable dim / scary blink-out).
const FLASH_BASE_COLOR_HEX = 0xffd070;
const FLASH_DRAIN_COLOR_HEX = 0xff8030;
const FLASH_BASE_INTENSITY = 1.6;          // peak intensity at full battery
const FLASH_BASE_DISTANCE  = 30;
const FLASH_BASE_ANGLE     = Math.PI / 7.5; // ~24° cone (was 30°)
const flashlight = new THREE.SpotLight(FLASH_BASE_COLOR_HEX, FLASH_BASE_INTENSITY, FLASH_BASE_DISTANCE, FLASH_BASE_ANGLE, 0.32, 1.2);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(512, 512);
flashlight.shadow.camera.near = 0.5;
flashlight.shadow.camera.far = 28;
flashlight.shadow.bias = -0.0008;
flashlight.shadow.normalBias = 0.04;
camera.add(flashlight);
// SpotLight needs a target — attach to camera so it points where we look.
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight.target);
scene.add(camera);
flashlight.visible = true;

// Flashlight runtime state — owned by tickFlashlight().
// blinkOutUntil: ts at which an in-progress scary-blink-out ends.
// cutOutUntil:   ts at which a low-battery hard cutout ends (battery <10%).
// nextCutOutAt:  ts when the next low-battery cutout may begin.
// colorCache:    reusable THREE.Color to avoid allocation per frame.
const flashState = {
  blinkOutUntil: 0,
  cutOutUntil: 0,
  nextCutOutAt: 0,
  cutoutScreenAlpha: 0,        // current overlay darkening contribution
  colorCache: new THREE.Color(FLASH_BASE_COLOR_HEX),
  baseColor: new THREE.Color(FLASH_BASE_COLOR_HEX),
  drainColor: new THREE.Color(FLASH_DRAIN_COLOR_HEX),
};

// =============================================================================
// GROUND — PlaneGeometry with ImprovedNoise vertex displacement (more
// pronounced bumps + slopes) + per-vertex color biome variation.
// =============================================================================
const groundTex = makeGroundTexture();
// Higher subdivision so slopes read smoothly across the larger displacement.
const groundGeom = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 96, 96);
// Shared noise instance used by both vertex displacement and the groundY()
// runtime sampler — keeps the two perfectly in sync.
const groundNoise = new ImprovedNoise();
// Biome noise — different scale, picks soil-tone patches (clay-red / mossy-green / dry-grey).
const biomeNoise = new ImprovedNoise();

// Public sampler: world (x,z) -> ground Y. Matches the geometry displacement.
function groundY(x, z) {
  // Big rolling slopes (low frequency, big amplitude) + medium bumps + fine grain.
  return groundNoise.noise(x * 0.006,  z * 0.006,  17) * 1.6
       + groundNoise.noise(x * 0.018,  z * 0.018,  3.5) * 0.65
       + groundNoise.noise(x * 0.055,  z * 0.055,  9) * 0.22;
}

// Biome tint sampler: returns an [r,g,b] color tint for the given world position.
// Used both to color vertices and to color the matching dirt-path tiles.
function biomeColor(x, z) {
  const v = biomeNoise.noise(x * 0.008, z * 0.008, 23);  // ~-1..1
  // Three soft biomes blended around the base mud color.
  // Map v -> band: clay-red (warm), mossy-green (cool), dry-grey (neutral).
  if (v > 0.25)        return { r: 0.72, g: 0.52, b: 0.36 }; // clay-red
  else if (v < -0.25)  return { r: 0.46, g: 0.58, b: 0.36 }; // mossy-green
  else                 return { r: 0.58, g: 0.56, b: 0.48 }; // dry-grey
}

// Apply vertex displacement + per-vertex colors.
{
  const pos = groundGeom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, groundY(x, y));
    const tint = biomeColor(x, y);
    // Subtle per-vertex jitter so the biomes feel painted, not banded.
    const j = 0.92 + Math.random() * 0.16;
    colors[i * 3 + 0] = tint.r * j;
    colors[i * 3 + 1] = tint.g * j;
    colors[i * 3 + 2] = tint.b * j;
  }
  pos.needsUpdate = true;
  groundGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeom.computeVertexNormals();
}
const groundMat = new THREE.MeshStandardMaterial({
  map: groundTex,
  roughness: 0.95,
  metalness: 0,
  color: 0xffffff,        // let vertex colors drive the tint
  vertexColors: true,
});
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// =============================================================================
// WORLD STRUCTURE PLANNING — landmarks + paths planned BEFORE trees so the
// tree scatter can carve around them. `world` is exposed for cross-agent
// access (Agent B may read `world.trees` for wind sway, Agent E may read
// `world.landmarks` to spawn items at memorable points).
// =============================================================================
const world = {
  trees: null,
  landmarks: [],
  paths: [],
  hiddenDetails: [],
};

// Plan 6 landmark positions across angular sectors so the player encounters
// them naturally while exploring outward. Reject overlaps.
{
  const landmarkSpec = ['cabin', 'well', 'cemetery', 'car-wreck', 'shrine', 'tent'];
  const placed = [];
  for (let i = 0; i < landmarkSpec.length; i++) {
    const baseAng = (i / landmarkSpec.length) * Math.PI * 2;
    let attempts = 0, x = 0, z = 0;
    while (attempts < 30) {
      const ang = baseAng + (Math.random() - 0.5) * 0.6;
      const r = 45 + Math.random() * 110;
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r;
      let ok = true;
      for (const p of placed) {
        if (Math.hypot(p.x - x, p.z - z) < 28) { ok = false; break; }
      }
      if (Math.hypot(x, z) < 22) ok = false;
      if (ok) break;
      attempts++;
    }
    placed.push({ x, z });
    world.landmarks.push({ name: landmarkSpec[i], x, z });
  }
}

// 2-3 dirt paths through the forest. Trees within `width/2` of a segment are
// excluded, creating a tree-free corridor. Paths connect landmark pairs so
// they feel motivated and lead the player somewhere.
{
  const cabin = world.landmarks.find((l) => l.name === 'cabin');
  const cemetery = world.landmarks.find((l) => l.name === 'cemetery');
  const well = world.landmarks.find((l) => l.name === 'well');
  if (cabin) world.paths.push({ ax: 0, az: 0, bx: cabin.x, bz: cabin.z, width: 3.2 });
  if (cabin && cemetery) world.paths.push({ ax: cabin.x, az: cabin.z, bx: cemetery.x, bz: cemetery.z, width: 2.6 });
  if (well) world.paths.push({ ax: 0, az: 0, bx: well.x, bz: well.z, width: 2.4 });
}

// Shortest distance from (px,pz) to a path segment minus its half-width.
// Negative => inside the path corridor. Infinity if no paths.
function distToPath(px, pz) {
  let minD = Infinity;
  for (const p of world.paths) {
    const dx = p.bx - p.ax, dz = p.bz - p.az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 0.0001) continue;
    let t = ((px - p.ax) * dx + (pz - p.az) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = p.ax + dx * t, cz = p.az + dz * t;
    const d = Math.hypot(px - cx, pz - cz) - p.width / 2;
    if (d < minD) minD = d;
  }
  return minD;
}

// Shortest distance from point to nearest landmark center.
function distToLandmark(px, pz) {
  let minD = Infinity;
  for (const l of world.landmarks) {
    const d = Math.hypot(l.x - px, l.z - pz);
    if (d < minD) minD = d;
  }
  return minD;
}

// =============================================================================
// TREE LAYOUT — Poisson-disk-ish scatter, then split into 4 type-buckets so
// each type can use its own InstancedMesh (different silhouette per type).
//   Distribution: PINE 40% / OAK 30% / DEAD 15% / WEEPING 15%
// Trees are rejected if they fall on a path or inside a landmark exclusion.
// =============================================================================
const treeData = []; // { x, z, scale, rot, type, swayPhase }
{
  // Seeded random so layout is stable for the session (but varies per load).
  let seed = Math.floor(Math.random() * 1e9);
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  // Pre-place a handful of cluster centers — denser, gnarlier groves.
  const clusters = [];
  for (let i = 0; i < 22; i++) {
    clusters.push({
      x: (rng() - 0.5) * WORLD_SIZE * 0.85,
      z: (rng() - 0.5) * WORLD_SIZE * 0.85,
      r: 20 + rng() * 30,
    });
  }
  // Place trees one at a time, rejecting if too close to an existing one.
  const minDist = 2.2;
  const minDistSq = minDist * minDist;
  const spawnRadius = WORLD_SIZE * 0.45;
  let tries = 0;
  while (treeData.length < TREE_COUNT && tries < TREE_COUNT * 40) {
    tries++;
    let x, z;
    // 65% biased toward a cluster center; 35% pure uniform.
    if (rng() < 0.65) {
      const cl = clusters[Math.floor(rng() * clusters.length)];
      const ang = rng() * Math.PI * 2;
      const r = rng() * cl.r;
      x = cl.x + Math.cos(ang) * r;
      z = cl.z + Math.sin(ang) * r;
    } else {
      x = (rng() - 0.5) * WORLD_SIZE * 0.9;
      z = (rng() - 0.5) * WORLD_SIZE * 0.9;
    }
    // Keep a clear plaza around the player spawn (a hint of "trail").
    if (Math.hypot(x, z) < 4) continue;
    if (Math.abs(x) > spawnRadius || Math.abs(z) > spawnRadius) continue;
    // Reject if on a path (carve the corridor through the forest).
    if (distToPath(x, z) < 0) continue;
    // Reject if inside a landmark exclusion bubble.
    if (distToLandmark(x, z) < 7) continue;
    // Distance check against existing trees.
    let ok = true;
    for (let i = 0; i < treeData.length; i++) {
      const t = treeData[i];
      const dx = t.x - x, dz = t.z - z;
      if (dx * dx + dz * dz < minDistSq) { ok = false; break; }
    }
    if (!ok) continue;
    // Pick the tree type based on the configured mix.
    const rr = rng();
    let type;
    if      (rr < TREE_MIX.pine)                                                     type = 'pine';
    else if (rr < TREE_MIX.pine + TREE_MIX.oak)                                      type = 'oak';
    else if (rr < TREE_MIX.pine + TREE_MIX.oak + TREE_MIX.dead)                      type = 'dead';
    else                                                                             type = 'weeping';
    treeData.push({
      x, z,
      scale: 0.85 + rng() * 0.6,
      rot: rng() * Math.PI * 2,
      type,
      swayPhase: rng() * Math.PI * 2,
    });
  }
}
// Expose so other agents (Agent B wind, Agent E clown cover spots) can read.
world.trees = treeData;

// Bucket the trees by type so each type gets its own InstancedMesh.
const treesByType = { pine: [], oak: [], dead: [], weeping: [] };
for (const t of treeData) treesByType[t.type].push(t);

// =============================================================================
// TREE MATERIALS + GEOMETRIES — one InstancedMesh per type + canopy. The
// `trunkMat` name is preserved for back-compat with code referencing it.
// =============================================================================
const barkTex = makeBarkTexture();
const deadBarkTex = makeDeadBarkTexture();
const trunkMat = new THREE.MeshStandardMaterial({
  map: barkTex, roughness: 1.0, metalness: 0, color: 0x6a5238,
});
const pineBarkMat = new THREE.MeshStandardMaterial({
  map: barkTex, roughness: 1.0, metalness: 0, color: 0x5a4028,
});
const oakBarkMat = new THREE.MeshStandardMaterial({
  map: barkTex, roughness: 1.0, metalness: 0, color: 0x7a5a3a,
});
const deadBarkMat = new THREE.MeshStandardMaterial({
  map: deadBarkTex, roughness: 1.0, metalness: 0, color: 0xb6ada4,
});
const weepingBarkMat = new THREE.MeshStandardMaterial({
  map: barkTex, roughness: 1.0, metalness: 0, color: 0x5e4a36,
});

const oakFoliageTex = makeFoliageTexture();
const pineFoliageTex = makePineFoliageTexture();
const weepingFoliageTex = makeWeepingFoliageTexture();
const oakCanopyMat = new THREE.MeshStandardMaterial({
  map: oakFoliageTex, color: 0x1a2a14, roughness: 1, metalness: 0,
  transparent: true, opacity: 0.92, alphaTest: 0.15,
});
const pineCanopyMat = new THREE.MeshStandardMaterial({
  map: pineFoliageTex, color: 0x18221a, roughness: 1, metalness: 0,
  transparent: true, opacity: 0.94, alphaTest: 0.15,
});
const weepingCanopyMat = new THREE.MeshStandardMaterial({
  map: weepingFoliageTex, color: 0x223018, roughness: 1, metalness: 0,
  transparent: true, opacity: 0.88, alphaTest: 0.1,
});

// Trunk geometries — each translated so base sits at y=0.
const oakTrunkGeom = new THREE.CylinderGeometry(0.22, 0.45, 11, 8, 1, false);
oakTrunkGeom.translate(0, 5.5, 0);
const pineTrunkGeom = new THREE.CylinderGeometry(0.18, 0.32, 14, 8, 1, false);
pineTrunkGeom.translate(0, 7, 0);
const deadTrunkGeom = new THREE.CylinderGeometry(0.14, 0.34, 10, 6, 1, false);
deadTrunkGeom.translate(0, 5, 0);
const weepingTrunkGeom = new THREE.CylinderGeometry(0.12, 0.26, 13, 8, 1, false);
weepingTrunkGeom.translate(0, 6.5, 0);

// Canopy geometries.
const oakCanopyGeom = new THREE.IcosahedronGeometry(3.2, 1);
const oakCanopyGeom2 = new THREE.IcosahedronGeometry(2.4, 1);
const pineConeGeom = new THREE.ConeGeometry(2.6, 4.2, 8, 1, true);
const weepingCanopyGeom = new THREE.IcosahedronGeometry(3.0, 1);

// Build an InstancedMesh with the world's standard flags.
function makeInstancedMesh(geom, mat, count, opts = {}) {
  const im = new THREE.InstancedMesh(geom, mat, Math.max(1, count));
  im.castShadow = opts.castShadow !== false;
  im.receiveShadow = opts.receiveShadow === true;
  im.frustumCulled = false;
  return im;
}

// Reusable compose buffers — avoids allocating in layout loops.
const _composeM = new THREE.Matrix4();
const _composeQ = new THREE.Quaternion();
const _composeE = new THREE.Euler();
const _composeS = new THREE.Vector3();
const _composeP = new THREE.Vector3();
function setIM(im, idx, x, y, z, rotY, sx, sy, sz, tiltZ = 0) {
  _composeE.set(0, rotY, tiltZ);
  _composeQ.setFromEuler(_composeE);
  _composeS.set(sx, sy, sz);
  _composeP.set(x, y, z);
  _composeM.compose(_composeP, _composeQ, _composeS);
  im.setMatrixAt(idx, _composeM);
}

// PINE — tall narrow conifer, 4-stack of cone canopies (12-15m tall scaled).
const pineTrunkMesh = makeInstancedMesh(pineTrunkGeom, pineBarkMat, treesByType.pine.length, { receiveShadow: true });
const pineConeMesh = makeInstancedMesh(pineConeGeom, pineCanopyMat, treesByType.pine.length * 4, { castShadow: false });
{
  for (let i = 0; i < treesByType.pine.length; i++) {
    const t = treesByType.pine[i];
    const gy = groundY(t.x, t.z);
    const s = t.scale;
    setIM(pineTrunkMesh, i, t.x, gy, t.z, t.rot, s, s, s);
    for (let k = 0; k < 4; k++) {
      const cs = (0.95 - k * 0.16) * s;
      const cy = gy + (6 + k * 2.0) * s;
      setIM(pineConeMesh, i * 4 + k, t.x, cy, t.z, t.rot + k * 0.7, cs, 0.9 * cs, cs);
    }
  }
  pineTrunkMesh.instanceMatrix.needsUpdate = true;
  pineConeMesh.instanceMatrix.needsUpdate = true;
}
scene.add(pineTrunkMesh);
scene.add(pineConeMesh);

// OAK — gnarly chunky trunk + wide main canopy + smaller asymmetric lobe.
const oakTrunkMesh = makeInstancedMesh(oakTrunkGeom, oakBarkMat, treesByType.oak.length, { receiveShadow: true });
const oakCanopy1Mesh = makeInstancedMesh(oakCanopyGeom, oakCanopyMat, treesByType.oak.length, { castShadow: false });
const oakCanopy2Mesh = makeInstancedMesh(oakCanopyGeom2, oakCanopyMat, treesByType.oak.length, { castShadow: false });
{
  for (let i = 0; i < treesByType.oak.length; i++) {
    const t = treesByType.oak[i];
    const gy = groundY(t.x, t.z);
    const s = t.scale;
    setIM(oakTrunkMesh, i, t.x, gy, t.z, t.rot, s, s, s);
    const lobeY = gy + 9 * s;
    setIM(oakCanopy1Mesh, i, t.x, lobeY, t.z, t.rot, 1.15 * s, 0.85 * s, 1.15 * s);
    const off = ((i % 3) - 1) * 1.2 * s;
    setIM(oakCanopy2Mesh, i, t.x + off, lobeY + 1.4 * s, t.z + off * 0.6, t.rot + 0.7, 0.85 * s, 0.7 * s, 0.85 * s);
  }
  oakTrunkMesh.instanceMatrix.needsUpdate = true;
  oakCanopy1Mesh.instanceMatrix.needsUpdate = true;
  oakCanopy2Mesh.instanceMatrix.needsUpdate = true;
}
scene.add(oakTrunkMesh);
scene.add(oakCanopy1Mesh);
scene.add(oakCanopy2Mesh);

// DEAD — leaf-less white-grey trunks. ~1/3 "snapped" (half height + tilt).
const deadTrunkMesh = makeInstancedMesh(deadTrunkGeom, deadBarkMat, treesByType.dead.length, { receiveShadow: true });
{
  for (let i = 0; i < treesByType.dead.length; i++) {
    const t = treesByType.dead[i];
    const gy = groundY(t.x, t.z);
    const s = t.scale;
    const isSnapped = (i % 3 === 0);
    const sy = isSnapped ? (0.5 + Math.random() * 0.3) * s : s;
    const tilt = isSnapped ? (Math.random() - 0.5) * 0.25 : (Math.random() - 0.5) * 0.06;
    setIM(deadTrunkMesh, i, t.x, gy, t.z, t.rot, s, sy, s, tilt);
  }
  deadTrunkMesh.instanceMatrix.needsUpdate = true;
}
scene.add(deadTrunkMesh);

// WEEPING — tall thin trunk + flattened oblate canopy with vertical streaks.
const weepingTrunkMesh = makeInstancedMesh(weepingTrunkGeom, weepingBarkMat, treesByType.weeping.length, { receiveShadow: true });
const weepingCanopyMesh = makeInstancedMesh(weepingCanopyGeom, weepingCanopyMat, treesByType.weeping.length, { castShadow: false });
{
  for (let i = 0; i < treesByType.weeping.length; i++) {
    const t = treesByType.weeping[i];
    const gy = groundY(t.x, t.z);
    const s = t.scale;
    setIM(weepingTrunkMesh, i, t.x, gy, t.z, t.rot, s, s, s);
    const cy = gy + 10 * s;
    setIM(weepingCanopyMesh, i, t.x, cy, t.z, t.rot, 1.35 * s, 0.55 * s, 1.35 * s);
  }
  weepingTrunkMesh.instanceMatrix.needsUpdate = true;
  weepingCanopyMesh.instanceMatrix.needsUpdate = true;
}
scene.add(weepingTrunkMesh);
scene.add(weepingCanopyMesh);

// Convenience lists for Agent B wind code / future culling.
const canopyMeshes = [pineConeMesh, oakCanopy1Mesh, oakCanopy2Mesh, weepingCanopyMesh];
const trunkMeshes  = [pineTrunkMesh, oakTrunkMesh, deadTrunkMesh, weepingTrunkMesh];
// Back-compat shims for any old code that referenced the single
// `trunkMesh`/`canopyMesh`/`liveTrees`. The wind code (Agent B) iterates
// `treeData.length` writing to `trunkMesh.setMatrixAt(i, ...)`, but now
// there are 4 separate type-specific trunk meshes (and canopy meshes).
// We map each global `treeData` index to its per-type (mesh, localIndex)
// pair via `treeMeshIndex[]`; the proxy meshes route setMatrixAt to the
// correct underlying InstancedMesh + index so the wind sway "just works"
// without Agent B needing to refactor.
const treeMeshIndex = new Array(treeData.length);
{
  const counters = { pine: 0, oak: 0, dead: 0, weeping: 0 };
  const trunkByType = { pine: pineTrunkMesh, oak: oakTrunkMesh, dead: deadTrunkMesh, weeping: weepingTrunkMesh };
  const canopyByType = { pine: pineConeMesh, oak: oakCanopy1Mesh, dead: null, weeping: weepingCanopyMesh };
  for (let i = 0; i < treeData.length; i++) {
    const t = treeData[i];
    const k = counters[t.type]++;
    treeMeshIndex[i] = { tr: trunkByType[t.type], ca: canopyByType[t.type], k };
  }
}
const _proxyMesh = (kind) => ({
  instanceMatrix: { _needsUpdate: false, set needsUpdate(v) {
    // Propagate the flag to every per-type InstancedMesh.
    pineTrunkMesh.instanceMatrix.needsUpdate = v;
    oakTrunkMesh.instanceMatrix.needsUpdate = v;
    deadTrunkMesh.instanceMatrix.needsUpdate = v;
    weepingTrunkMesh.instanceMatrix.needsUpdate = v;
    if (kind === 'canopy') {
      pineConeMesh.instanceMatrix.needsUpdate = v;
      oakCanopy1Mesh.instanceMatrix.needsUpdate = v;
      oakCanopy2Mesh.instanceMatrix.needsUpdate = v;
      weepingCanopyMesh.instanceMatrix.needsUpdate = v;
    }
  }, get needsUpdate() { return false; } },
  rotation: { x: 0, y: 0, z: 0 },
  setMatrixAt(i, m) {
    const map = treeMeshIndex[i];
    if (!map) return;
    if (kind === 'trunk' && map.tr) map.tr.setMatrixAt(map.k, m);
    else if (kind === 'canopy' && map.ca) map.ca.setMatrixAt(map.k, m);
  },
  getMatrixAt() {},
});
const trunkMesh  = _proxyMesh('trunk');
const canopyMesh = _proxyMesh('canopy');
// `liveTrees` was previously `treeData.filter(!t.dead)`. In the new model
// every tree has a `type` (DEAD trees are still present) so expose the full
// list for back-compat with any iterator caller.
const liveTrees = treeData;

// FALLEN LOGS — scattered, rejecting paths/landmarks so corridors stay clear.
{
  const logGeom = new THREE.CylinderGeometry(0.3, 0.3, 4, 6);
  let placed = 0, tries = 0;
  while (placed < LOG_COUNT && tries < LOG_COUNT * 12) {
    tries++;
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    if (distToPath(x, z) < 0.5) continue;
    if (distToLandmark(x, z) < 8) continue;
    const log = new THREE.Mesh(logGeom, trunkMat);
    log.position.set(x, groundY(x, z) + 0.3, z);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = Math.random() * Math.PI * 2;
    log.castShadow = true;
    log.receiveShadow = true;
    scene.add(log);
    placed++;
  }
}

// ROCKS — IcosahedronGeometry with random scale & rotation.
{
  const rockGeom = new THREE.IcosahedronGeometry(0.5, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x3a3830,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  for (let i = 0; i < ROCK_COUNT; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    if (distToLandmark(x, z) < 6) continue;
    const r = new THREE.Mesh(rockGeom, rockMat);
    const s = 0.4 + Math.random() * 1.3;
    r.position.set(x, groundY(x, z) + s * 0.3, z);
    r.scale.set(s, s * 0.7, s);
    r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    r.castShadow = true;
    r.receiveShadow = true;
    scene.add(r);
  }
  // Fallen branches — thin twigs scattered on the ground.
  const branchGeom = new THREE.CylinderGeometry(0.04, 0.06, 1.4, 5);
  branchGeom.translate(0, 0.7, 0);
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85;
    if (distToLandmark(x, z) < 4) continue;
    const b = new THREE.Mesh(branchGeom, trunkMat);
    b.position.set(x, groundY(x, z) + 0.05, z);
    b.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    b.rotation.y = Math.random() * Math.PI * 2;
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
  }
}

// =============================================================================
// PATH TILES — lighter colored ground tiles along each path segment.
// Polygon-offset prevents z-fighting with the base ground.
// =============================================================================
{
  const pathTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3220'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 80; i++) {
      g.fillStyle = `rgba(${110 + Math.random() * 30}, ${94 + Math.random() * 18}, ${64}, ${0.45 + Math.random() * 0.3})`;
      const cx = Math.random() * 256, cy = Math.random() * 256;
      const r = 4 + Math.random() * 14;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(0, 0, 0, 0.22)';
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 4, 8, Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.25})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const pathMat = new THREE.MeshStandardMaterial({
    map: pathTex, color: 0xb09878, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  for (const p of world.paths) {
    const dx = p.bx - p.ax, dz = p.bz - p.az;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) continue;
    const step = 2.2;
    const segments = Math.max(1, Math.floor(len / step));
    const ang = Math.atan2(dz, dx);
    const pathGeom = new THREE.PlaneGeometry(step + 0.4, p.width);
    for (let k = 0; k <= segments; k++) {
      const tt = k / segments;
      const cx = p.ax + dx * tt;
      const cz = p.az + dz * tt;
      const m = new THREE.Mesh(pathGeom, pathMat);
      m.position.set(cx, groundY(cx, cz) + 0.012, cz);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = -ang;
      m.receiveShadow = true;
      scene.add(m);
    }
  }
}

// =============================================================================
// LANDMARKS — one Group per landmark (regular meshes, not instanced — there
// is only one of each). Built from primitive boxes/cylinders/planes.
// =============================================================================
function buildLandmarks() {
  const woodMatDark = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 1, metalness: 0, map: barkTex });
  const woodMatLight = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1, metalness: 0 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1, metalness: 0, flatShading: true });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x5a2818, roughness: 0.95, metalness: 0.15 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.45 });
  const skullMat = new THREE.MeshStandardMaterial({ color: 0xb6ada4, roughness: 1, metalness: 0 });
  const fabricMat = new THREE.MeshStandardMaterial({ color: 0x3a4830, roughness: 1, metalness: 0, side: THREE.DoubleSide });

  for (const lm of world.landmarks) {
    const group = new THREE.Group();
    const gy = groundY(lm.x, lm.z);
    group.position.set(lm.x, gy, lm.z);
    group.rotation.y = Math.random() * Math.PI * 2;

    if (lm.name === 'cabin') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 5), woodMatDark);
      body.position.y = 1.6;
      body.castShadow = true; body.receiveShadow = true;
      group.add(body);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 1, metalness: 0 });
      const roofL = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 3.2), roofMat);
      roofL.position.set(0, 3.6, -0.8); roofL.rotation.x = -0.35;
      roofL.castShadow = true; group.add(roofL);
      const roofR = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.2, 3.2), roofMat);
      roofR.position.set(0, 3.6, 0.8); roofR.rotation.x = 0.35;
      roofR.castShadow = true; group.add(roofR);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.12), woodMatDark);
      door.position.set(0, 1.0, 2.52); group.add(door);
      for (const xOff of [-2.0, 2.0]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.05), stoneMat);
        win.position.set(xOff, 1.9, 2.51); group.add(win);
        const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.06), woodMatLight);
        p1.position.set(xOff, 1.9, 2.54); p1.rotation.z = 0.5; group.add(p1);
        const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.06), woodMatLight);
        p2.position.set(xOff, 1.9, 2.54); p2.rotation.z = -0.5; group.add(p2);
      }
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), stoneMat);
      chim.position.set(2.0, 4.0, -1.4); chim.castShadow = true; group.add(chim);
    }
    else if (lm.name === 'well') {
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.6, 16, 1, true), stoneMat);
      wall.position.y = 0.8; wall.castShadow = true; wall.receiveShadow = true;
      group.add(wall);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
      inner.position.y = 1.55; inner.rotation.x = -Math.PI / 2; group.add(inner);
      const postGeom = new THREE.BoxGeometry(0.15, 2.2, 0.15);
      const postL = new THREE.Mesh(postGeom, woodMatLight); postL.position.set(-1.2, 1.7, 0); group.add(postL);
      const postR = new THREE.Mesh(postGeom, woodMatLight); postR.position.set(1.2, 1.7, 0); group.add(postR);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.18), woodMatLight);
      beam.position.set(0, 2.85, 0); group.add(beam);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1 }));
      rope.position.set(0, 2.2, 0); group.add(rope);
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.45, 10), woodMatDark);
      bucket.position.set(0, 1.5, 0); group.add(bucket);
    }
    else if (lm.name === 'cemetery') {
      const n = 8 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const r = 1.5 + Math.random() * 3;
        const hx = Math.cos(ang) * r, hz = Math.sin(ang) * r;
        const h = 0.6 + Math.random() * 0.6;
        const w = 0.4 + Math.random() * 0.3;
        const head = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), stoneMat);
        head.position.set(hx, h / 2, hz);
        head.rotation.z = (Math.random() - 0.5) * 0.5;
        head.rotation.y = Math.random() * Math.PI;
        head.castShadow = true; head.receiveShadow = true;
        group.add(head);
      }
      const fenceSeg = new THREE.BoxGeometry(6.5, 0.5, 0.08);
      for (const [px, pz, ry] of [[0, 3.2, 0], [0, -3.2, 0], [3.2, 0, Math.PI / 2], [-3.2, 0, Math.PI / 2]]) {
        const f = new THREE.Mesh(fenceSeg, woodMatLight);
        f.position.set(px, 0.4, pz); f.rotation.y = ry;
        f.castShadow = true; group.add(f);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), woodMatLight);
        post.position.set(px, 0.55, pz); group.add(post);
      }
    }
    else if (lm.name === 'car-wreck') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.85, 1.8), rustMat);
      body.position.y = 0.6; body.castShadow = true; body.receiveShadow = true;
      group.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.6), rustMat);
      cabin.position.set(-0.2, 1.4, 0); cabin.castShadow = true; group.add(cabin);
      const wind = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 1.5), glassMat);
      wind.position.set(0.95, 1.45, 0); wind.rotation.z = -0.4; group.add(wind);
      const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
      for (const [wx, wz] of [[1.5, 0.9], [-1.5, 0.9], [1.5, -0.9], [-1.5, -0.9]]) {
        const w = new THREE.Mesh(wheelGeom, new THREE.MeshStandardMaterial({ color: 0x100808, roughness: 1 }));
        w.position.set(wx, 0.18, wz); w.rotation.x = Math.PI / 2;
        w.castShadow = true; group.add(w);
      }
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x2a4018, roughness: 1, metalness: 0, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const v = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.6), vineMat);
        v.position.set((Math.random() - 0.5) * 3, 1.4, (Math.random() - 0.5) * 1.4);
        v.rotation.set(0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
        group.add(v);
      }
    }
    else if (lm.name === 'shrine') {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const sx = Math.cos(ang) * 2.4, sz = Math.sin(ang) * 2.4;
        const h = 1.6 + Math.random() * 0.6;
        const stone = new THREE.Mesh(new THREE.BoxGeometry(0.55 + Math.random() * 0.25, h, 0.5 + Math.random() * 0.25), stoneMat);
        stone.position.set(sx, h / 2, sz);
        stone.rotation.y = ang + (Math.random() - 0.5) * 0.4;
        stone.rotation.z = (Math.random() - 0.5) * 0.15;
        stone.castShadow = true; stone.receiveShadow = true;
        group.add(stone);
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), skullMat);
        skull.position.set(sx, h + 0.2, sz);
        skull.castShadow = true; group.add(skull);
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        eye.position.set(sx, h + 0.22, sz + 0.14); group.add(eye);
      }
      const altar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), stoneMat);
      altar.position.y = 0.25; altar.castShadow = true; altar.receiveShadow = true;
      group.add(altar);
    }
    else if (lm.name === 'tent') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), woodMatLight);
      pole.position.set(0, 0.8, -1.0); group.add(pole);
      const canvas = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.6), fabricMat);
      canvas.position.set(0, 0.4, 0); canvas.rotation.x = -1.0;
      canvas.castShadow = true; canvas.receiveShadow = true;
      group.add(canvas);
      const canvas2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), fabricMat);
      canvas2.position.set(0, 0.7, -0.4); canvas2.rotation.x = -0.5;
      group.add(canvas2);
      const bagMat = new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 1, metalness: 0 });
      const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8), bagMat);
      bag.position.set(0.5, 0.3, 0.8); bag.rotation.z = Math.PI / 2;
      bag.castShadow = true; group.add(bag);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: 0xa89880, roughness: 1 }));
      pillow.position.set(1.2, 0.3, 0.8); group.add(pillow);
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 }));
      lantern.position.set(-0.8, 0.15, 0.6); group.add(lantern);
    }

    scene.add(group);
    lm.group = group;
  }
}
buildLandmarks();

// =============================================================================
// HIDDEN DETAILS — bloodstains on ground + half-buried abandoned items.
// =============================================================================
{
  const bloodTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(70, 8, 8, 0.85)';
    g.beginPath();
    g.ellipse(64, 64, 40, 32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(50, 4, 4, 0.85)';
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 28;
      g.beginPath();
      g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 4 + Math.random() * 8, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 24; i++) {
      g.fillStyle = `rgba(${50 + Math.random() * 30}, 4, 4, ${0.5 + Math.random() * 0.4})`;
      g.beginPath();
      g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return new THREE.CanvasTexture(c);
  })();
  const bloodMat = new THREE.MeshBasicMaterial({
    map: bloodTex, transparent: true, depthWrite: false, fog: true,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const bloodGeom = new THREE.PlaneGeometry(1.4, 1.4);
  for (let i = 0; i < 7; i++) {
    let x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    let z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    if (Math.hypot(x, z) < 15) { x *= 1.4; z *= 1.4; }
    const b = new THREE.Mesh(bloodGeom, bloodMat);
    b.position.set(x, groundY(x, z) + 0.014, z);
    b.rotation.x = -Math.PI / 2;
    b.rotation.z = Math.random() * Math.PI * 2;
    const s = 0.7 + Math.random() * 0.8;
    b.scale.set(s, s, 1);
    scene.add(b);
    world.hiddenDetails.push({ kind: 'bloodstain', x, z });
  }
  // Bone fragment — thin pale cylinder partially in the dirt.
  {
    const ang = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * 40;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const bone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xcdc4b8, roughness: 1, metalness: 0 })
    );
    bone.position.set(x, groundY(x, z) + 0.06, z);
    bone.rotation.z = Math.PI / 2.4;
    bone.rotation.y = Math.random() * Math.PI * 2;
    bone.castShadow = true; bone.receiveShadow = true;
    scene.add(bone);
    world.hiddenDetails.push({ kind: 'bone', x, z });
  }
  // Broken doll — small box body + sphere head, tipped over.
  {
    const ang = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 50;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const doll = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.32, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x8a3a3a, roughness: 1, metalness: 0 })
    );
    body.position.y = 0.16; doll.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8c8b0, roughness: 1, metalness: 0 })
    );
    head.position.y = 0.42; doll.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), eyeMat);
    e1.position.set(-0.04, 0.44, 0.12); doll.add(e1);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3), eyeMat);
    e2.position.set(0.04, 0.44, 0.12); doll.add(e2);
    doll.position.set(x, groundY(x, z) + 0.02, z);
    doll.rotation.z = Math.PI / 2.5;
    doll.rotation.y = Math.random() * Math.PI * 2;
    scene.add(doll);
    world.hiddenDetails.push({ kind: 'doll', x, z });
  }
  // Torn fabric — a tattered plane half-buried.
  {
    const ang = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 60;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const fabric = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4a3a26, roughness: 1, metalness: 0, side: THREE.DoubleSide })
    );
    fabric.position.set(x, groundY(x, z) + 0.06, z);
    fabric.rotation.set(-Math.PI / 2 + 0.1, Math.random() * Math.PI * 2, 0);
    scene.add(fabric);
    world.hiddenDetails.push({ kind: 'fabric', x, z });
  }
}

// GROUND-FOG PATCHES — semi-transparent quads near the floor, scattered.
{
  const fogTex = makeFogPatchTexture();
  const fogMat = new THREE.MeshBasicMaterial({
    map: fogTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
    fog: true,
  });
  const fogGeom = new THREE.PlaneGeometry(6, 6);
  for (let i = 0; i < 60; i++) {
    const f = new THREE.Mesh(fogGeom, fogMat);
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.7;
    f.position.set(x, groundY(x, z) + 0.3, z);
    f.rotation.x = -Math.PI / 2;
    f.rotation.z = Math.random() * Math.PI * 2;
    const s = 0.9 + Math.random() * 1.6;
    f.scale.set(s, s, 1);
    scene.add(f);
  }
}

// =============================================================================
// ATMOSPHERE / PARTICLES / WEATHER — Agent B owns everything below until the
// next major section header. All systems are designed to be cheap to update
// at 60fps on mid-range mobile:
//   * Wind sway updates InstancedMesh matrices only every 3rd frame.
//   * Leaf / dust / rain particles cap at ~80 / 200 / 600 each (recycled).
//   * Drifting "fog patches" are 8 translucent quads (no per-particle math).
//   * Lightning fog override + cloud drift are O(1) per frame.
// =============================================================================

// ---------------------------------------------------------------------------
// SKY — gradient texture (lighter at the horizon, near-black at the zenith),
// a faint moon disc, and a few slow-drifting cloud silhouettes baked onto a
// dedicated CanvasTexture. As the player collects items the sky shifts toward
// a slightly bluer pre-dawn tint via syncSkyDawn().
// ---------------------------------------------------------------------------
const SKY_W = 512, SKY_H = 256;
const skyCanvas = document.createElement('canvas');
skyCanvas.width = SKY_W; skyCanvas.height = SKY_H;
const skyCtx = skyCanvas.getContext('2d');
const skyTexture = new THREE.CanvasTexture(skyCanvas);
skyTexture.colorSpace = THREE.SRGBColorSpace;
// Cloud silhouettes: random soft blobs across the horizon band that drift
// horizontally over time. We pre-bake their positions once and re-render the
// canvas every ~250ms so animation cost is amortised.
const skyClouds = [];
for (let i = 0; i < 9; i++) {
  skyClouds.push({
    x: Math.random() * SKY_W * 1.5,
    y: SKY_H * (0.35 + Math.random() * 0.30),
    r: 30 + Math.random() * 70,
    speed: 0.04 + Math.random() * 0.10, // px per second
    alpha: 0.18 + Math.random() * 0.20,
  });
}
// Dawn factor 0..1 — increased by syncSkyDawn() as items are collected.
let skyDawnFactor = 0;
let skyNextRedrawTs = 0;
function redrawSky() {
  // Vertical gradient: lighter near horizon (bottom 65%), darkest at zenith.
  // Dawn factor pushes the horizon slightly bluer/lighter as escape approaches.
  const horizonR = 14 + skyDawnFactor * 26;
  const horizonG = 18 + skyDawnFactor * 38;
  const horizonB = 32 + skyDawnFactor * 70;
  const zenithR  = 4;
  const zenithG  = 6 + skyDawnFactor * 4;
  const zenithB  = 14 + skyDawnFactor * 14;
  const grad = skyCtx.createLinearGradient(0, 0, 0, SKY_H);
  grad.addColorStop(0,   `rgb(${zenithR}, ${zenithG}, ${zenithB})`);
  grad.addColorStop(0.55, `rgb(${(zenithR + horizonR) / 2 | 0}, ${(zenithG + horizonG) / 2 | 0}, ${(zenithB + horizonB) / 2 | 0})`);
  grad.addColorStop(1,   `rgb(${horizonR}, ${horizonG}, ${horizonB})`);
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, SKY_W, SKY_H);

  // Faint stars — sparse pixel-sized dots in the upper 65%.
  for (let i = 0; i < 110; i++) {
    const sx = (i * 49.13) % SKY_W;
    const sy = (i * 17.71) % (SKY_H * 0.7);
    const a = 0.25 + ((i * 13) % 60) / 200;
    skyCtx.fillStyle = `rgba(220, 230, 245, ${a})`;
    skyCtx.fillRect(sx | 0, sy | 0, 1, 1);
  }

  // The moon — small faint glowing disc high in the sky. Slight blue cast.
  const moonX = SKY_W * 0.78, moonY = SKY_H * 0.20;
  const moonGrad = skyCtx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 36);
  moonGrad.addColorStop(0,   'rgba(220, 226, 240, 0.85)');
  moonGrad.addColorStop(0.4, 'rgba(180, 190, 210, 0.4)');
  moonGrad.addColorStop(1,   'rgba(120, 140, 170, 0)');
  skyCtx.fillStyle = moonGrad;
  skyCtx.beginPath();
  skyCtx.arc(moonX, moonY, 36, 0, Math.PI * 2);
  skyCtx.fill();
  // Moon body.
  skyCtx.fillStyle = 'rgba(228, 232, 245, 0.92)';
  skyCtx.beginPath();
  skyCtx.arc(moonX, moonY, 10, 0, Math.PI * 2);
  skyCtx.fill();

  // Cloud silhouettes — drift horizontally with wrap-around.
  for (const c of skyClouds) {
    const cx = ((c.x % (SKY_W + 200)) + SKY_W + 200) % (SKY_W + 200) - 100;
    const cy = c.y;
    const cg = skyCtx.createRadialGradient(cx, cy, 0, cx, cy, c.r);
    cg.addColorStop(0, `rgba(8, 10, 18, ${c.alpha})`);
    cg.addColorStop(1, `rgba(8, 10, 18, 0)`);
    skyCtx.fillStyle = cg;
    skyCtx.beginPath();
    skyCtx.ellipse(cx, cy, c.r * 1.4, c.r * 0.55, 0, 0, Math.PI * 2);
    skyCtx.fill();
  }
  skyTexture.needsUpdate = true;
}
redrawSky();
scene.background = skyTexture;
// Push the sky-dawn factor toward a target based on items collected.
function syncSkyDawn() {
  const found = player?.itemsFound ?? 0;
  // Begins shifting at 4+ items; full pre-dawn at 5.
  skyDawnFactor = Math.max(0, Math.min(1, (found - 3) / 2));
}

// ---------------------------------------------------------------------------
// WIND SWAY — for every tree we apply a tiny rotation-Z to the trunk and
// canopy matrices so the forest visibly breathes. Sampling treeData (or a
// future Agent-A-provided world.trees array) keeps phase-per-tree variation.
// Updated only every 3rd frame to keep the cost negligible.
// ---------------------------------------------------------------------------
const WIND_BASE_AMP = 0.020; // radians at base wind
const WIND_GUST_AMP = 0.075; // peak radians during a gust
const WIND_BASE_RATE = 0.9;  // base oscillation rate (rad/s in sin())
const windState = {
  frameCounter: 0,
  gustEndAt: 0,
  nextGustAt: 0,
  currentAmp: WIND_BASE_AMP,
  // Reusable matrices/objects so we don't allocate per frame.
  _m: new THREE.Matrix4(),
  _q: new THREE.Quaternion(),
  _e: new THREE.Euler(),
  _s: new THREE.Vector3(),
  _p: new THREE.Vector3(),
};
windState.nextGustAt = (typeof performance !== 'undefined' ? performance.now() / 1000 : 0) + 25 + Math.random() * 35;

// Pre-compute an "exposure" factor per tree — isolated trees sway harder
// (rough estimate: count nearby neighbours and invert). Tree data is read
// once at boot. If Agent A swaps in a world.trees structure later we'll
// still have a sane default.
const treeExposure = new Float32Array(treeData.length);
{
  const RR = 6 * 6; // 6m radius for "neighbour"
  for (let i = 0; i < treeData.length; i++) {
    let neighbours = 0;
    const ti = treeData[i];
    for (let j = 0; j < treeData.length; j++) {
      if (i === j) continue;
      const dx = treeData[j].x - ti.x;
      const dz = treeData[j].z - ti.z;
      if (dx * dx + dz * dz < RR) neighbours++;
      if (neighbours > 8) break; // early-out — already well-protected
    }
    // 0 neighbours -> 1.6x sway, 8+ neighbours -> 0.55x sway.
    treeExposure[i] = 1.6 - Math.min(1.05, neighbours * 0.13);
  }
}

function tickWind(dt, time) {
  windState.frameCounter++;
  // Gust scheduling — random gusts every 30-60s, lasting 3s, audio cue once.
  if (time > windState.nextGustAt && time > windState.gustEndAt + 5) {
    windState.gustEndAt = time + 3;
    windState.nextGustAt = time + 30 + Math.random() * 30;
    try { audio?.playWindGust?.(); } catch {}
  }
  const inGust = time < windState.gustEndAt;
  // Ease the amplitude toward target so gusts don't pop in/out.
  const targetAmp = inGust ? WIND_GUST_AMP : WIND_BASE_AMP;
  windState.currentAmp += (targetAmp - windState.currentAmp) * Math.min(1, dt * 2.0);

  // Only re-bake matrices every 3rd frame — still smooth at ~20Hz.
  if ((windState.frameCounter % 3) !== 0) return;

  const { _m, _q, _e, _s, _p } = windState;
  const amp = windState.currentAmp;
  const rate = WIND_BASE_RATE + (inGust ? 1.4 : 0);

  // Trunks — small lean only (very subtle; trunks shouldn't rubber-band).
  for (let i = 0; i < treeData.length; i++) {
    const t = treeData[i];
    const exposure = treeExposure[i];
    const phase = t.swayPhase ?? (i * 0.317);
    const lean = Math.sin(time * rate + phase) * amp * exposure * 0.35;
    _e.set(0, t.rot, lean);
    _q.setFromEuler(_e);
    _s.set(t.scale, t.scale, t.scale);
    _p.set(t.x, groundY(t.x, t.z), t.z);
    _m.compose(_p, _q, _s);
    trunkMesh.setMatrixAt(i, _m);
  }
  trunkMesh.instanceMatrix.needsUpdate = true;

  // Canopies sway more visibly than trunks (foliage catches the wind).
  for (let i = 0; i < liveTrees.length; i++) {
    const t = liveTrees[i];
    const idx = treeData.indexOf(t); // sparse but small N; OK at 20Hz
    const exposure = idx >= 0 ? treeExposure[idx] : 1.0;
    const phase = t.swayPhase ?? (i * 0.413);
    const lean = Math.sin(time * rate + phase + 0.7) * amp * exposure;
    _e.set(0, t.rot, lean);
    _q.setFromEuler(_e);
    const cs = (0.75 + ((i * 7919) % 100) / 180) * t.scale;
    _s.set(cs, cs * 0.85, cs);
    _p.set(t.x, groundY(t.x, t.z) + 10 * t.scale, t.z);
    _m.compose(_p, _q, _s);
    canopyMesh.setMatrixAt(i, _m);
  }
  canopyMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// FALLING LEAVES — 80 leaf billboards that drift down from above the player.
// Each leaf has its own gentle sway. When they reach the ground (or drift too
// far) they recycle above the player so the effect is omnipresent.
// ---------------------------------------------------------------------------
const LEAF_COUNT = 80;
const LEAF_SPAWN_HEIGHT = 14;
const LEAF_DESPAWN_HEIGHT = -0.3;
function makeLeafTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 32);
  // Simple leaf silhouette — ellipse with mid-vein.
  const palette = ['#4a3a18', '#3a2e10', '#5a3a14', '#3a2a12', '#4a4218', '#5a4818'];
  const col = palette[Math.floor(Math.random() * palette.length)];
  g.fillStyle = col;
  g.beginPath();
  g.ellipse(16, 16, 11, 6, Math.PI / 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(7, 20); g.lineTo(25, 12);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}
const leafTextures = [makeLeafTexture(), makeLeafTexture(), makeLeafTexture(), makeLeafTexture()];
const leaves = [];
{
  for (let i = 0; i < LEAF_COUNT; i++) {
    const tex = leafTextures[i % leafTextures.length];
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, fog: true, opacity: 0,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.25, 0.25, 1);
    s.position.set(
      (Math.random() - 0.5) * 30,
      LEAF_SPAWN_HEIGHT + Math.random() * 6,
      (Math.random() - 0.5) * 30
    );
    s.visible = false;
    scene.add(s);
    leaves.push({
      sprite: s,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(0.4 + Math.random() * 0.5),
      vz: (Math.random() - 0.5) * 0.6,
      swayPhase: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.2,
      rot: Math.random() * Math.PI * 2,
      life: Math.random() * 8,
    });
  }
}
function recycleLeaf(leaf) {
  const sprite = leaf.sprite;
  sprite.position.set(
    player.pos.x + (Math.random() - 0.5) * 30,
    player.pos.y + LEAF_SPAWN_HEIGHT + Math.random() * 4,
    player.pos.z + (Math.random() - 0.5) * 30
  );
  leaf.vx = (Math.random() - 0.5) * 0.7;
  leaf.vy = -(0.35 + Math.random() * 0.5);
  leaf.vz = (Math.random() - 0.5) * 0.7;
  leaf.swayPhase = Math.random() * Math.PI * 2;
  leaf.rotSpeed = (Math.random() - 0.5) * 1.2;
  leaf.life = 0;
  sprite.visible = true;
}
function tickLeaves(dt, time) {
  for (let i = 0; i < leaves.length; i++) {
    const l = leaves[i];
    const sp = l.sprite;
    if (!sp.visible) { recycleLeaf(l); continue; }
    l.life += dt;
    // Sway adds horizontal wobble. Wind gusts push leaves harder.
    const inGust = time < windState.gustEndAt;
    const swayAmp = inGust ? 1.4 : 0.7;
    sp.position.x += (l.vx + Math.sin(time * 1.6 + l.swayPhase) * swayAmp) * dt;
    sp.position.y += l.vy * dt;
    sp.position.z += (l.vz + Math.cos(time * 1.3 + l.swayPhase) * swayAmp * 0.7) * dt;
    l.rot += l.rotSpeed * dt;
    sp.material.rotation = l.rot;
    // Fade in over first 0.8s, fade out below 1m.
    const fadeIn = Math.min(1, l.life / 0.8);
    const heightFade = Math.max(0, Math.min(1, (sp.position.y - groundY(sp.position.x, sp.position.z)) / 1.5));
    sp.material.opacity = 0.55 * fadeIn * heightFade;
    // Recycle when low or far from player.
    const dx = sp.position.x - player.pos.x;
    const dz = sp.position.z - player.pos.z;
    if (sp.position.y < groundY(sp.position.x, sp.position.z) + LEAF_DESPAWN_HEIGHT ||
        (dx * dx + dz * dz) > 30 * 30) {
      recycleLeaf(l);
    }
  }
}

// ---------------------------------------------------------------------------
// DUST MOTES — 200 small point sprites that drift slowly. They only become
// visible when the flashlight beam is roughly pointing at them (cheap dot-
// product check), which sells the "torch lighting up the dust" feel.
// ---------------------------------------------------------------------------
const DUST_COUNT = 200;
const dustGeom = new THREE.BufferGeometry();
const dustPositions = new Float32Array(DUST_COUNT * 3);
const dustVelocities = new Float32Array(DUST_COUNT * 3);
for (let i = 0; i < DUST_COUNT; i++) {
  dustPositions[i * 3 + 0] = (Math.random() - 0.5) * 30;
  dustPositions[i * 3 + 1] = 0.5 + Math.random() * 3;
  dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  dustVelocities[i * 3 + 0] = (Math.random() - 0.5) * 0.05;
  dustVelocities[i * 3 + 1] = 0.02 + Math.random() * 0.04;
  dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
}
dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({
  size: 0.04,
  color: 0xffe8b0,
  transparent: true,
  opacity: 0.0,
  depthWrite: false,
  sizeAttenuation: true,
  fog: true,
});
const dustPoints = new THREE.Points(dustGeom, dustMat);
dustPoints.frustumCulled = false;
scene.add(dustPoints);
function tickDust(dt) {
  // Cheap drift around the player. Opacity fades in when flashlight is on
  // (the only time you'd see motes anyway).
  const recycleDist = 16;
  const recycleDistSq = recycleDist * recycleDist;
  for (let i = 0; i < DUST_COUNT; i++) {
    const idx = i * 3;
    dustPositions[idx + 0] += dustVelocities[idx + 0];
    dustPositions[idx + 1] += dustVelocities[idx + 1] * (0.5 + 0.5 * Math.sin(totalElapsed * 0.4 + i));
    dustPositions[idx + 2] += dustVelocities[idx + 2];
    // Wrap around player if too far / too high.
    const dx = dustPositions[idx + 0] - player.pos.x;
    const dz = dustPositions[idx + 2] - player.pos.z;
    if (dx * dx + dz * dz > recycleDistSq || dustPositions[idx + 1] > 5) {
      const ang = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 10;
      dustPositions[idx + 0] = player.pos.x + Math.cos(ang) * r;
      dustPositions[idx + 1] = 0.4 + Math.random() * 2.5;
      dustPositions[idx + 2] = player.pos.z + Math.sin(ang) * r;
    }
  }
  dustGeom.attributes.position.needsUpdate = true;
  // Visibility — only matters when flashlight is on (otherwise dust would
  // be near-invisible anyway, save the draw cost).
  const wantVisible = player.flashlightOn && flashlight.visible;
  const targetAlpha = wantVisible ? 0.45 : 0.0;
  dustMat.opacity += (targetAlpha - dustMat.opacity) * Math.min(1, dt * 5);
  dustPoints.visible = dustMat.opacity > 0.01;
}

// ---------------------------------------------------------------------------
// RAIN — rare event (10% chance per run, 2-4 min duration). Vertical line
// particles falling around the player. Density ramps in/out so it doesn't
// pop. Audio: tries audio.playRainOn / playRainOff but tolerates absence.
// ---------------------------------------------------------------------------
const RAIN_LINE_COUNT = 600;
const rainGeom = new THREE.BufferGeometry();
const rainPositions = new Float32Array(RAIN_LINE_COUNT * 6); // pairs of XYZ per line
for (let i = 0; i < RAIN_LINE_COUNT; i++) {
  const idx = i * 6;
  rainPositions[idx + 0] = (Math.random() - 0.5) * 40;
  rainPositions[idx + 1] = Math.random() * 16;
  rainPositions[idx + 2] = (Math.random() - 0.5) * 40;
  rainPositions[idx + 3] = rainPositions[idx + 0];
  rainPositions[idx + 4] = rainPositions[idx + 1] - 0.6;
  rainPositions[idx + 5] = rainPositions[idx + 2];
}
rainGeom.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
const rainMat = new THREE.LineBasicMaterial({
  color: 0x8aa0c0, transparent: true, opacity: 0.0, depthWrite: false, fog: true,
});
const rainLines = new THREE.LineSegments(rainGeom, rainMat);
rainLines.frustumCulled = false;
rainLines.visible = false;
scene.add(rainLines);
const rainState = {
  active: false,
  startedAt: 0,
  endAt: 0,
  intensity: 0,
  decidedThisRun: false,
};
function maybeStartRain() {
  if (rainState.decidedThisRun) return;
  rainState.decidedThisRun = true;
  if (Math.random() < 0.10) {
    rainState.active = true;
    rainState.startedAt = (typeof performance !== 'undefined' ? performance.now() / 1000 : 0) + 25 + Math.random() * 50;
    rainState.endAt = rainState.startedAt + 120 + Math.random() * 120;
    // Audio is optional — fall through silently if not present.
    try { audio?.playRainOn?.(); } catch {}
  }
}
function tickRain(dt, time) {
  // Ramp intensity toward target (active -> 1, inactive -> 0).
  const wantActive = rainState.active && time > rainState.startedAt && time < rainState.endAt;
  const targetIntensity = wantActive ? 1.0 : 0.0;
  rainState.intensity += (targetIntensity - rainState.intensity) * Math.min(1, dt * 1.4);
  if (rainState.intensity < 0.02 && !wantActive) {
    rainLines.visible = false;
    return;
  }
  rainLines.visible = true;
  rainMat.opacity = 0.42 * rainState.intensity;
  // Stop event — clean up audio.
  if (rainState.active && time > rainState.endAt) {
    rainState.active = false;
    try { audio?.playRainOff?.(); } catch {}
  }
  // Move rain down + wrap. Each pair of XYZ shares X/Z; only Y differs.
  const fallSpeed = 18.0 * dt; // metres per second
  const horizWind = (time < windState.gustEndAt ? 4 : 1.5) * dt;
  for (let i = 0; i < RAIN_LINE_COUNT; i++) {
    const idx = i * 6;
    rainPositions[idx + 1] -= fallSpeed;
    rainPositions[idx + 4] -= fallSpeed;
    rainPositions[idx + 0] += horizWind;
    rainPositions[idx + 3] += horizWind;
    // Recycle when off-screen or too far from player.
    if (rainPositions[idx + 1] < groundY(rainPositions[idx + 0], rainPositions[idx + 2])) {
      rainPositions[idx + 0] = player.pos.x + (Math.random() - 0.5) * 40;
      rainPositions[idx + 1] = 14 + Math.random() * 6;
      rainPositions[idx + 2] = player.pos.z + (Math.random() - 0.5) * 40;
      rainPositions[idx + 3] = rainPositions[idx + 0];
      rainPositions[idx + 4] = rainPositions[idx + 1] - 0.6;
      rainPositions[idx + 5] = rainPositions[idx + 2];
    }
    // Keep above-ground portion centred-ish on player.
    const dx = rainPositions[idx + 0] - player.pos.x;
    const dz = rainPositions[idx + 2] - player.pos.z;
    if (dx * dx + dz * dz > 35 * 35) {
      rainPositions[idx + 0] = player.pos.x + (Math.random() - 0.5) * 40;
      rainPositions[idx + 2] = player.pos.z + (Math.random() - 0.5) * 40;
      rainPositions[idx + 3] = rainPositions[idx + 0];
      rainPositions[idx + 5] = rainPositions[idx + 2];
    }
  }
  rainGeom.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// DRIFTING FOG PATCHES — 8 large ground-hugging quads that slowly drift,
// adding another layer of depth to the mid-range. Different from the static
// ground-fog set above; these move and wrap.
// ---------------------------------------------------------------------------
const driftingFog = [];
{
  const fogTex = makeFogPatchTexture();
  const fogMat = new THREE.MeshBasicMaterial({
    map: fogTex, transparent: true, depthWrite: false, opacity: 0.45, fog: true,
  });
  const fogGeom = new THREE.PlaneGeometry(14, 14);
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Mesh(fogGeom, fogMat);
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.6;
    f.position.set(x, groundY(x, z) + 0.4, z);
    f.rotation.x = -Math.PI / 2;
    f.rotation.z = Math.random() * Math.PI * 2;
    const s = 1.3 + Math.random() * 1.5;
    f.scale.set(s, s, 1);
    scene.add(f);
    driftingFog.push({
      mesh: f,
      vx: (Math.random() - 0.5) * 0.3,
      vz: (Math.random() - 0.5) * 0.3,
    });
  }
}
function tickDriftingFog(dt) {
  for (const d of driftingFog) {
    d.mesh.position.x += d.vx * dt;
    d.mesh.position.z += d.vz * dt;
    d.mesh.rotation.z += dt * 0.02;
    // Wrap around if drifted too far from origin.
    const lim = WORLD_SIZE * 0.45;
    if (d.mesh.position.x > lim) d.mesh.position.x = -lim;
    if (d.mesh.position.x < -lim) d.mesh.position.x = lim;
    if (d.mesh.position.z > lim) d.mesh.position.z = -lim;
    if (d.mesh.position.z < -lim) d.mesh.position.z = lim;
    d.mesh.position.y = groundY(d.mesh.position.x, d.mesh.position.z) + 0.4;
  }
}

// ---------------------------------------------------------------------------
// LIGHTNING — overhauled multi-layer strobe. Reduces fog briefly so the
// player sees further (terror-reveal moment); 20% chance to silhouette the
// clown by ensuring its sprite is visible for the duration of the flash.
// ---------------------------------------------------------------------------
const lightningState = {
  fogOverrideUntil: 0,
  fogOverrideDensity: FOG_DENSITY_BASE,
};

// Frame counter used by tickAtmosphere() for any throttling needed.
let atmosphereFrame = 0;

// =============================================================================
// ITEMS — 5 lost objects. Each is a billboard sprite with a faint glow that
// brightens within ITEM_GLOW_DIST. Stored so we can update + check pickup.
// =============================================================================
const ITEM_LABELS = ['radio', 'locket', 'phone', 'lighter', 'photo'];
const items = []; // { label, sprite, baseOpacity, x, z, picked }
{
  for (let i = 0; i < ITEMS_TO_ESCAPE; i++) {
    const label = ITEM_LABELS[i];
    const tex = makeItemTexture(label);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      fog: true,
      opacity: 0.35,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.4, 1.4, 1);
    // Place items at varying radii so the player explores in multiple directions.
    const ang = (i / ITEMS_TO_ESCAPE) * Math.PI * 2 + Math.random() * 0.8;
    const r = 40 + Math.random() * 90;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    sprite.position.set(x, groundY(x, z) + 0.9, z);
    scene.add(sprite);
    items.push({ label, sprite, baseOpacity: 0.35, x, z, picked: false });
  }
}

// ---------------------------------------------------------------------------
// resetItemsForRun() — reseed item positions onto Agent A's landmarks if
// exposed via `window.world.landmarks`; otherwise falls back to original ring.
// ---------------------------------------------------------------------------
function resetItemsForRun() {
  let landmarks = null;
  try {
    const w = (typeof window !== 'undefined') ? window.world : null;
    landmarks = (w && Array.isArray(w.landmarks)) ? w.landmarks.slice() : null;
  } catch { landmarks = null; }
  const positions = [];
  if (landmarks && landmarks.length) {
    for (let i = landmarks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [landmarks[i], landmarks[j]] = [landmarks[j], landmarks[i]];
    }
    for (const lm of landmarks) {
      if (typeof lm?.x === 'number' && typeof lm?.z === 'number') {
        positions.push({
          x: lm.x + (Math.random() - 0.5) * 1.6,
          z: lm.z + (Math.random() - 0.5) * 1.6,
        });
      }
      if (positions.length >= ITEMS_TO_ESCAPE) break;
    }
  }
  for (let i = positions.length; i < ITEMS_TO_ESCAPE; i++) {
    const ang = (i / ITEMS_TO_ESCAPE) * Math.PI * 2 + Math.random() * 0.8;
    const r = 40 + Math.random() * 90;
    positions.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r });
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const pos = positions[i];
    it.x = pos.x; it.z = pos.z;
    it.picked = false;
    it.sprite.visible = true;
    it.sprite.material.opacity = 0.35;
    it.sprite.scale.setScalar(1.4);
    it.sprite.position.set(pos.x, groundY(pos.x, pos.z) + 0.9, pos.z);
  }
}

// =============================================================================
// HIDDEN CASSETTE TAPES — 3 lore collectibles. Found tape count persists across
// runs in localStorage (`wg:clown-forest:tapes:lifetime`) and is published on
// `window.clownForestTapesFound` so Agent C's start-screen UI can show TAPES X/3.
// =============================================================================
const tapes = []; // { sprite, x, z, picked }

function makeTapeTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 96, 64);
  const halo = g.createRadialGradient(48, 32, 0, 48, 32, 40);
  halo.addColorStop(0, 'rgba(200, 220, 255, 0.55)');
  halo.addColorStop(1, 'rgba(200, 220, 255, 0)');
  g.fillStyle = halo; g.fillRect(0, 0, 96, 64);
  g.fillStyle = '#1a1a1a'; g.fillRect(24, 18, 48, 28);
  g.fillStyle = '#403028'; g.fillRect(28, 22, 40, 9);
  g.fillStyle = '#0a0a0a';
  g.beginPath(); g.arc(38, 38, 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(58, 38, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.15)';
  g.fillRect(24, 18, 48, 2);
  return new THREE.CanvasTexture(c);
}
const tapeTex = makeTapeTexture();
{
  for (let i = 0; i < TAPE_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tapeTex, transparent: true, depthWrite: false, fog: true, opacity: 0.55,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.65, 0.45, 1);
    sprite.visible = false;
    scene.add(sprite);
    tapes.push({ sprite, x: 0, z: 0, picked: false });
  }
}

const TAPE_LIFETIME_KEY = 'wg:clown-forest:tapes:lifetime';
function _loadTapesLifetime() {
  try {
    const v = parseInt(localStorage.getItem(TAPE_LIFETIME_KEY) || '0', 10);
    return Number.isFinite(v) ? Math.max(0, Math.min(TAPE_COUNT, v)) : 0;
  } catch { return 0; }
}
function _saveTapesLifetime(n) {
  try { localStorage.setItem(TAPE_LIFETIME_KEY, String(Math.max(0, Math.min(TAPE_COUNT, n | 0)))); } catch {}
}

function resetTapesForRun() {
  const positions = [];
  let landmarks = null;
  try {
    const w = (typeof window !== 'undefined') ? window.world : null;
    landmarks = (w && Array.isArray(w.landmarks)) ? w.landmarks : null;
  } catch {}
  {
    const cands = treeData.filter((t) => {
      const d = Math.hypot(t.x, t.z);
      return d > 35 && d < 110;
    });
    const t = cands[Math.floor(Math.random() * cands.length)] || treeData[0];
    if (t) {
      const ang = Math.random() * Math.PI * 2;
      positions.push({ x: t.x + Math.cos(ang) * 1.5, z: t.z + Math.sin(ang) * 1.5 });
    }
  }
  if (landmarks && landmarks.length) {
    const lm = landmarks[Math.floor(Math.random() * landmarks.length)];
    const ang = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 4;
    positions.push({ x: (lm.x || 0) + Math.cos(ang) * r, z: (lm.z || 0) + Math.sin(ang) * r });
  } else {
    const ang = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 40;
    positions.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r });
  }
  {
    const ang = Math.random() * Math.PI * 2;
    const r = 130 + Math.random() * 30;
    positions.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r });
  }
  for (let i = 0; i < tapes.length; i++) {
    const t = tapes[i];
    const p = positions[i] || { x: 50, z: 50 };
    const lim = WORLD_SIZE * 0.45;
    t.x = Math.max(-lim, Math.min(lim, p.x));
    t.z = Math.max(-lim, Math.min(lim, p.z));
    t.picked = false;
    t.sprite.visible = true;
    t.sprite.material.opacity = 0.55;
    t.sprite.position.set(t.x, groundY(t.x, t.z) + 0.7, t.z);
  }
  try {
    if (typeof window !== 'undefined') {
      window.clownForestTapesFound = _loadTapesLifetime();
      window.clownForestTapesTotal = TAPE_COUNT;
    }
  } catch {}
}

// Publish initial values at module-load so Agent C's start-screen UI can render
// "TAPES X/3" before the player presses ENTER (resetTapesForRun() also runs).
try {
  if (typeof window !== 'undefined') {
    window.clownForestTapesFound = _loadTapesLifetime();
    window.clownForestTapesTotal = TAPE_COUNT;
    window.clownForestNightPct = 0;
  }
} catch {}

// =============================================================================
// EXIT BEACON — appears only after all 5 items are picked up. A faint red
// glowing tower at a random edge.
// =============================================================================
let beacon = null;
let beaconLight = null;
let beaconPos = null;
function spawnBeacon() {
  if (beacon) return;
  // Choose a far edge so the player has to traverse some forest to reach it.
  const side = Math.floor(Math.random() * 4);
  const edge = WORLD_SIZE * 0.42;
  let bx, bz;
  if (side === 0) { bx = -edge; bz = (Math.random() - 0.5) * edge * 0.5; }
  else if (side === 1) { bx = edge; bz = (Math.random() - 0.5) * edge * 0.5; }
  else if (side === 2) { bx = (Math.random() - 0.5) * edge * 0.5; bz = -edge; }
  else { bx = (Math.random() - 0.5) * edge * 0.5; bz = edge; }
  beaconPos = { x: bx, z: bz };
  // Tall thin pillar with emissive red top.
  const beaconGeom = new THREE.CylinderGeometry(0.25, 0.5, 9, 6);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x1a0808,
    emissive: 0xc81a14,
    emissiveIntensity: 1.4,
    roughness: 1,
  });
  beacon = new THREE.Mesh(beaconGeom, beaconMat);
  beacon.position.set(bx, groundY(bx, bz) + 4.5, bz);
  scene.add(beacon);
  // Soft red point-light for ambience.
  beaconLight = new THREE.PointLight(0xff3030, 1.8, 24, 1.5);
  beaconLight.position.set(bx, groundY(bx, bz) + 7, bz);
  scene.add(beaconLight);
  showSubtitle('A red beacon glows in the distance.', 5);
}

// =============================================================================
// THE CLOWN — billboard sprite that floats above the ground at clown height.
// Hidden during STALK phase (off-screen / teleporting); becomes visible in
// HUNT and CHASE phases.
// =============================================================================
const clownTex = makeClownTexture();
const clownMat = new THREE.SpriteMaterial({
  map: clownTex,
  transparent: true,
  depthWrite: false,
  fog: true,
  opacity: 1.0,
});
const clownSprite = new THREE.Sprite(clownMat);
// Sprite is sized so the clown reads as a 2.2m-tall figure. Width is half the
// texture aspect (256/512 = 0.5).
clownSprite.scale.set(CLOWN_HEIGHT * 0.5, CLOWN_HEIGHT, 1);
clownSprite.position.set(100, CLOWN_HEIGHT / 2, 100);
clownSprite.visible = false;
scene.add(clownSprite);

const clownState = {
  phase: 'stalk',           // 'stalk' | 'hunt' | 'chase'
  pos: new THREE.Vector3(100, 0, 100),
  lastStalkEvent: 0,        // ts of last stalk peek
  nextStalkEvent: 0,        // ts when the next peek is scheduled
  lastSeenAt: 0,            // ts of last player line-of-sight
  visibleStartedAt: 0,      // ts when sprite became visible (for run-away timing)
  isVisible: false,
  fleeUntil: 0,             // ts until which the clown is hiding (post-peek)
  ranAwayCount: 0,          // tracks times player has run from clown
  lastPlayerCheckPos: null, // helps detect "running away from"
  // ---- Agent E additions ----
  lastSeenDist: 999,        // cached distance at last LoS — Agent C reads for HUD throb
  // STALK behavior flags
  stalkVariant: null,       // 'line-of-sight' | 'fake-out-behind' | 'tree-peek'
  // HUNT behavior flags
  weepingAngelLockUntil: 0, // ts until which clown is frozen (player looking at it)
  nextHuntPeekAt: 0,        // ts of next "terror peek" sideways sprint
  huntPeekActive: false,
  huntPeekStartedAt: 0,
  huntPeekDir: 1,           // direction sign for sideways sprint
  huntPeekOrigin: null,     // {x,z} to return to after peek
  // CHASE behavior — weaving offset
  chaseWeavePhase: 0,
  // AMBUSH state (triggered when player picks up an item)
  ambushUntil: 0,
  ambushNextTickAt: 0,
  // Reads on player behavior — used to bias HUNT triggers and CHASE distance.
  searchInterest: 0,        // 0..1 raised by crouching / flashlight off
  // Lightning reveal hint set by triggerLightning().
  lightningRevealUntil: 0,
};

// =============================================================================
// PLAYER STATE
// =============================================================================
const player = {
  pos: new THREE.Vector3(0, PLAYER_H, 0),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  walkTime: 0,
  walkBob: 0,
  lastFootstep: 0,
  stamina: STAMINA_MAX,
  flashlightOn: true,
  flashlightBattery: 100,
  isCrouching: false,
  isSprinting: false,
  itemsFound: 0,
  twigSnapCooldown: 0,
  // ---- Agent E additions ----
  playerSprintTime: 0,        // cumulative seconds sprinted (across run)
  playerCrouchTime: 0,        // cumulative seconds crouched (across run)
  flashlightOffTime: 0,       // cumulative seconds with light off
  exhaustedUntil: 0,          // ts until which sprint is locked out after stamina=0
  isListening: false,         // L held / mobile listen button
  tapesFound: 0,              // cassettes collected this run (lore)
  nightPercent: 0,            // 0..100 (dawn approaches)
  // ---- Agent D additions ----
  distanceWalked: 0,          // metres traversed this run (for end-screen stat)
  pendingInteract: null,      // {item} when an item is in range and pressable
  deathLandmark: null,        // populated at kill time for the death-screen subtitle
};

// =============================================================================
// INPUT — keyboard + mouse + mobile drag-look
// =============================================================================
const keys = new Set();
window.addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase();
  keys.add(k);
  if (k === 'escape') {
    if (gameState === 'play') {
      // Subtle hint flash before the pause overlay (Agent D owns the overlay
      // itself; we just nudge the player with a one-shot reminder).
      flashPauseHint();
      pauseGame();
    } else if (gameState === 'paused') {
      // Second press = resume (the spec wants ESC to be symmetric).
      resumeGame();
    }
  }
  // F toggles flashlight — only when battery > 0 (off→on blocked when dead).
  if (k === 'f' && gameState === 'play') {
    if (player.flashlightOn) {
      player.flashlightOn = false;
      flashlight.visible = false;
      playFlashlight(false);
    } else if (player.flashlightBattery > 0) {
      player.flashlightOn = true;
      flashlight.visible = true;
      playFlashlight(true);
    }
  }
});

// LISTEN MODE — L key (or mobile LISTEN button) crouches the player a bit,
// slightly dims the flashlight, and lets Agent B's audio system bias 360° cues
// more prominently (tactical triangulation). Free to use, no resource drain.
window.addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase();
  if (k === 'l' && gameState === 'play') player.isListening = true;
});
window.addEventListener('keyup', (e) => {
  const k = (e.key || '').toLowerCase();
  if (k === 'l') player.isListening = false;
});
window.addEventListener('keyup', (e) => keys.delete((e.key || '').toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// ---------------------------------------------------------------------------
// AGENT D — extra input handlers (E interact, R restart, Tab objectives,
// "?" controls help). Wrapped in a single listener so they coexist with the
// existing flashlight + escape + listen handlers above.
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase();
  // E — interact with nearby item (Agent D ownership: input wiring; pickup
  // resolution lives in tickPlay's items loop where pendingInteract is set).
  if (k === 'e' && gameState === 'play') {
    if (player.pendingInteract) {
      tryInteractPickup(player.pendingInteract);
    }
  }
  // R — restart, but only when on the death screen (avoids accidental
  // restarts mid-run when the player meant to hold R for something else).
  if (k === 'r' && (gameState === 'dead' || gameState === 'escaped')) {
    requestRestart('end');
  }
  // Tab — quick objective view (hold). Prevent the default browser focus
  // shift so the canvas keeps focus.
  if (k === 'tab' && gameState === 'play') {
    e.preventDefault();
    showObjectives(true);
  }
  // "?" / "/" — open controls overlay from anywhere.
  if ((k === '?' || k === '/') && gameState === 'play') {
    e.preventDefault();
    openControlsHelp();
  }
  // Escape extra wiring: close child overlays first.
  if (k === 'escape') {
    if (gameState === 'controls') { closeControlsHelp(); return; }
    if (gameState === 'confirm')  { closeConfirm();     return; }
  }
});
window.addEventListener('keyup', (e) => {
  const k = (e.key || '').toLowerCase();
  if (k === 'tab') showObjectives(false);
});

let pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});
renderer.domElement.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  player.yaw -= e.movementX * MOUSE_SENS;
  player.pitch -= e.movementY * MOUSE_SENS;
  player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
});
renderer.domElement.addEventListener('click', () => {
  if (gameState === 'play' && !pointerLocked && !_isTouch) {
    renderer.domElement.requestPointerLock();
  }
});

// MOBILE — joystick + drag-look on the right half of the screen. Drag uses
// the TOUCH_SENS constant which Agent D exposes to the settings menu (mobile
// look sensitivity). Buttons stack bottom-right: TAKE / TORCH / RUN / CROUCH
// / LISTEN. TAKE is only visible while player.pendingInteract is non-null
// (see updateInteractPrompt()). Long-press anywhere (>650ms) = pause.
let mc = null;
const mcMove = { x: 0, y: 0, mag: 0 };
let mobileInteractBtn = null; // reference set after createMobileControls below
if (_isTouch) {
  mc = createMobileControls({
    layout: 'wasd-only',
    keys,
    onMove: (x, y, mag) => { mcMove.x = x; mcMove.y = y; mcMove.mag = mag; },
    buttons: [
      // Action buttons stack — TAKE + F (flashlight) + Shift (sprint) + CROUCH + LISTEN.
      // 'INTERACT' synthesises an E keydown via the keys Set + handler below.
      { id: 'INTERACT', label: 'TAKE' },
      { id: 'F', label: 'TORCH', key: 'F' },
      { id: 'Shift', label: 'RUN', key: 'Shift' },
      { id: 'CROUCH', label: 'CROUCH' },
      { id: 'LISTEN', label: 'LISTEN' },
    ],
    onButton: (id, down) => {
      if (id === 'LISTEN')   player.isListening = !!down;
      if (id === 'CROUCH') {
        if (down) keys.add('c'); else keys.delete('c');
      }
      if (id === 'INTERACT' && down && gameState === 'play' && player.pendingInteract) {
        tryInteractPickup(player.pendingInteract);
      }
    },
  });
  // Cache the INTERACT button DOM node so updateInteractPrompt() can show/hide
  // it. mobileControls.js sets the label as textContent — we match by label.
  setTimeout(() => {
    const btns = document.querySelectorAll('.mc-btn');
    for (const b of btns) {
      if ((b.textContent || '').trim() === 'TAKE') { mobileInteractBtn = b; break; }
    }
    // Default hidden until prompt fires.
    if (mobileInteractBtn) mobileInteractBtn.style.display = 'none';
  }, 50);
  let lookFingerId = null, lookLastX = 0, lookLastY = 0;
  let longPressTimer = null, longPressFiredId = null;
  const isInJoystickZone = (clientX) => clientX < window.innerWidth * 0.5;
  document.addEventListener('touchstart', (e) => {
    if (gameState !== 'play') {
      // Allow long-press to dismiss intro/end overlays where a tap would do.
      return;
    }
    for (const t of e.changedTouches) {
      // Skip touches that land on UI surfaces (joystick, settings gear, etc).
      if (t.target?.closest?.('.mc-root, button, a, .wg-settings-modal, .overlay')) continue;
      if (isInJoystickZone(t.clientX)) continue;
      if (lookFingerId === null) {
        lookFingerId = t.identifier;
        lookLastX = t.clientX; lookLastY = t.clientY;
      }
      // Long-press anywhere on the play area (>650ms without moving much) =
      // pause. Universal mobile gesture across the suite.
      if (longPressTimer === null) {
        const startX = t.clientX, startY = t.clientY, startId = t.identifier;
        longPressTimer = setTimeout(() => {
          if (gameState === 'play') {
            longPressFiredId = startId;
            pauseGame();
          }
          longPressTimer = null;
        }, 650);
        // Cancel long-press if finger moves significantly.
        const cancelOnMove = (ev) => {
          for (const tt of ev.changedTouches) {
            if (tt.identifier !== startId) continue;
            if (Math.hypot(tt.clientX - startX, tt.clientY - startY) > 14) {
              clearTimeout(longPressTimer); longPressTimer = null;
              document.removeEventListener('touchmove', cancelOnMove);
            }
          }
        };
        document.addEventListener('touchmove', cancelOnMove, { passive: true });
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
      if (t.identifier === lookFingerId) lookFingerId = null;
      if (t.identifier === longPressFiredId) longPressFiredId = null;
    }
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }, { passive: true });
  document.addEventListener('touchcancel', () => {
    lookFingerId = null;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }, { passive: true });
}

// =============================================================================
// GAME STATE MACHINE
//   loading  → boot, textures baking. CLICK TO ENTER appears when ready.
//   intro    → typewriter cutscene (first launch / first-time per profile).
//   menu     → start screen. Title + ENTER THE WOODS.
//   play     → in-game.
//   paused   → pause overlay open.
//   controls → controls help overlay open (was 'play', returns to 'play').
//   confirm  → restart confirmation overlay open.
//   dead     → death cinematic + end screen.
//   escaped  → escape cinematic + end screen.
// =============================================================================
let gameState = 'loading';
let priorGameState = null; // saved when entering controls / confirm so we can restore
let runStartTs = 0;
let totalElapsed = 0;
let nextLightningAt = 0;
let nextOwlAt = 0;

const loadingOverlay  = document.getElementById('loading-overlay');
const loadingReady    = document.getElementById('loading-ready');
const loadingFill     = document.getElementById('loading-fill');
const introOverlay    = document.getElementById('intro-overlay');
const introSkipBtn    = document.getElementById('intro-skip');
const introLineEl     = document.getElementById('intro-line');
const introEnterEl    = document.getElementById('intro-enter');
const startOverlay    = document.getElementById('start-overlay');
const endOverlay      = document.getElementById('end-overlay');
const pauseOverlay    = document.getElementById('pause-overlay');
const controlsOverlay = document.getElementById('controls-overlay');
const confirmOverlay  = document.getElementById('confirm-overlay');
const hudEl           = document.getElementById('hud');
const flashEl         = document.getElementById('flash');
const killCamEl = document.getElementById('kill-cam');
const killCanvas = document.getElementById('kill-canvas');

// ---- HUD elements (Agent C) ----------------------------------------------
const itemsBadge   = document.getElementById('hud-items');
const itemsN       = document.getElementById('hud-items-n');
const staminaBox   = document.getElementById('hud-stamina');
const staminaFill  = document.getElementById('hud-stamina-fill');
const batteryBox   = document.getElementById('hud-battery');
const batteryN     = document.getElementById('hud-battery-n');
const batteryFill  = document.getElementById('hud-battery-fill');
const subtitleEl   = document.getElementById('hud-subtitle');
const heartBox     = document.getElementById('hud-heart');
const heartLine    = document.getElementById('hud-heart-line');
const crosshairEl  = document.getElementById('hud-crosshair');
const compassEl    = document.getElementById('hud-compass');
const compassArrow = document.getElementById('hud-compass-arrow');
const popupsEl     = document.getElementById('hud-popups');
const objectiveEl  = document.getElementById('hud-objective');
const warningEl    = document.getElementById('hud-warning');
const pauseHintEl  = document.getElementById('hud-pause-hint');
const tutBox       = document.getElementById('hud-tut');
const tutText      = document.getElementById('hud-tut-text');
const tutNext      = document.getElementById('hud-tut-next');
const tutSkip      = document.getElementById('hud-tut-skip');

// ---- VFX layer (sits between canvas and HUD) -----------------------------
const vfxThrob       = document.getElementById('vfx-throb');
const vfxStamCrit    = document.getElementById('vfx-stamina-crit');
const vfxBatStatic   = document.getElementById('vfx-battery-static');
const vfxHitFlash    = document.getElementById('vfx-hit-flash');
const vfxHeartBreath = document.getElementById('vfx-heart-breath');
const screenFlashEl  = document.getElementById('screen-flash');

const endTitle    = document.getElementById('end-title');
const endSub      = document.getElementById('end-sub');
const endItems    = document.getElementById('end-items');
const endTime     = document.getElementById('end-time');
const endDistance = document.getElementById('end-distance');
const endBest     = document.getElementById('end-best');
const startBestOut = document.getElementById('start-best');

// Best escape (lowest time wins for completion runs).
function refreshStartBest() {
  if (!startBestOut) return;
  const best = loadBest('clown-forest');
  if (best?.escaped && typeof best.time === 'number') {
    startBestOut.textContent = `TIME ${formatTime(best.time)} (escaped)`;
  } else if (best?.itemsFound) {
    startBestOut.textContent = `${best.itemsFound}/5 items`;
  } else {
    startBestOut.textContent = 'no record';
  }
}
refreshStartBest();

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// =============================================================================
// AGENT D — flow orchestration helpers (intro, loading, controls, restart).
// =============================================================================

const INTRO_LINES = [
  'You wake up in the woods.',
  'Your car is gone.',
  'Something woke you.',
  'Find your things. Find a way out.',
  "Don't look back.",
];
const INTRO_TYPE_CADENCE_MS = 60;
const INTRO_LINE_HOLD_MS    = 2500;
const INTRO_FADE_MS         = 300;

const INTRO_FLAG_KEY = (() => {
  try { return profileKey('clown-forest:intro-seen'); }
  catch { return 'wg:clown-forest:intro-seen'; }
})();
function hasSeenIntro() {
  try { return localStorage.getItem(INTRO_FLAG_KEY) === '1'; } catch { return false; }
}
function markIntroSeen() {
  try { localStorage.setItem(INTRO_FLAG_KEY, '1'); } catch {}
}

let _introTimers = [];
let _introWaitingForEnter = false;
let _introLineIdx = 0;
function _clearIntroTimers() {
  for (const t of _introTimers) clearTimeout(t);
  _introTimers = [];
}

function playIntro() {
  if (!introOverlay) { showStartScreen(); return; }
  gameState = 'intro';
  loadingOverlay.hidden = true;
  startOverlay.hidden = true;
  introOverlay.hidden = false;
  introLineEl.textContent = '';
  introLineEl.classList.remove('is-done');
  introEnterEl.hidden = true;
  _introWaitingForEnter = false;
  _introLineIdx = 0;
  _clearIntroTimers();
  _runIntroLine(0);
}

function _runIntroLine(idx) {
  _introLineIdx = idx;
  if (idx >= INTRO_LINES.length) {
    introLineEl.classList.add('is-done');
    introEnterEl.hidden = false;
    _introWaitingForEnter = true;
    return;
  }
  const text = INTRO_LINES[idx];
  introLineEl.textContent = '';
  introLineEl.classList.remove('is-done');
  introLineEl.style.opacity = '0';
  _introTimers.push(setTimeout(() => {
    introLineEl.style.transition = `opacity ${INTRO_FADE_MS}ms ease`;
    introLineEl.style.opacity = '1';
  }, 20));
  let i = 0;
  const typeStep = () => {
    if (gameState !== 'intro') return;
    introLineEl.textContent = text.slice(0, i++);
    if (i <= text.length) {
      _introTimers.push(setTimeout(typeStep, INTRO_TYPE_CADENCE_MS));
    } else {
      introLineEl.classList.add('is-done');
      _introTimers.push(setTimeout(() => {
        if (gameState !== 'intro') return;
        introLineEl.style.opacity = '0';
        _introTimers.push(setTimeout(() => {
          if (gameState !== 'intro') return;
          _runIntroLine(idx + 1);
        }, INTRO_FADE_MS));
      }, INTRO_LINE_HOLD_MS));
    }
  };
  _introTimers.push(setTimeout(typeStep, INTRO_FADE_MS + 60));
}

function skipIntro() {
  if (gameState !== 'intro') return;
  _clearIntroTimers();
  markIntroSeen();
  introOverlay.hidden = true;
  showStartScreen();
}

function finishIntro() {
  if (gameState !== 'intro' || !_introWaitingForEnter) return;
  _clearIntroTimers();
  markIntroSeen();
  introOverlay.hidden = true;
  showStartScreen();
}

if (introSkipBtn) introSkipBtn.addEventListener('click', (e) => { e.stopPropagation(); skipIntro(); });
if (introEnterEl) introEnterEl.addEventListener('click', (e) => { e.stopPropagation(); finishIntro(); });
if (introOverlay) introOverlay.addEventListener('click', (e) => {
  if (gameState !== 'intro') return;
  if (_introWaitingForEnter) { finishIntro(); return; }
  _clearIntroTimers();
  _runIntroLine(_introLineIdx + 1);
});

function setLoadingProgress(pct) {
  if (loadingFill) loadingFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function onAssetsReady() {
  setLoadingProgress(100);
  if (loadingReady) loadingReady.hidden = false;
  const enterFn = () => {
    loadingOverlay.removeEventListener('click', enterFn);
    if (!hasSeenIntro()) playIntro();
    else showStartScreen();
  };
  loadingOverlay.addEventListener('click', enterFn, { once: true });
}

function showStartScreen() {
  gameState = 'menu';
  loadingOverlay.hidden = true;
  introOverlay.hidden = true;
  endOverlay.hidden = true;
  pauseOverlay.hidden = true;
  startOverlay.hidden = false;
  refreshStartBest();
  flashEl.className = '';
  flashEl.style.opacity = '';
  killCamEl.classList.remove('is-on');
  document.body.classList.remove('is-playing');
  endOverlay.classList.remove('is-escape');
}

function openControlsHelp() {
  if (gameState === 'controls') return;
  priorGameState = gameState;
  gameState = 'controls';
  // Rebuild the controls list each time so we always reflect the current
  // device (a player who plugs in a Bluetooth keyboard mid-session gets the
  // desktop labels). On mobile we list the touch controls instead.
  const listEl = document.getElementById('controls-list');
  if (listEl) {
    const desktop = [
      ['MOVEMENT',  'WASD / arrows'],
      ['LOOK',      'Mouse (click to lock)'],
      ['INTERACT',  'E (when prompted)'],
      ['FLASHLIGHT','F'],
      ['SPRINT',    'Shift (limited stamina)'],
      ['CROUCH',    'C (quieter, slower)'],
      ['OBJECTIVES','Tab (hold)'],
      ['RESTART',   'R (on death screen)'],
      ['PAUSE',     'ESC'],
    ];
    const touch = [
      ['MOVEMENT',  'JOYSTICK (left half)'],
      ['LOOK',      'DRAG (right half)'],
      ['INTERACT',  'TAKE button'],
      ['FLASHLIGHT','TORCH button'],
      ['SPRINT',    'RUN button (limited stamina)'],
      ['CROUCH',    'CROUCH button (quieter, slower)'],
      ['PAUSE',     'Long-press anywhere'],
    ];
    const rows = _isTouch ? touch : desktop;
    listEl.innerHTML = rows.map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('');
  }
  controlsOverlay.hidden = false;
  document.exitPointerLock?.();
}
function closeControlsHelp() {
  if (gameState !== 'controls') return;
  controlsOverlay.hidden = true;
  if (priorGameState === 'paused') {
    gameState = 'paused';
  } else if (priorGameState === 'play') {
    gameState = 'play';
    if (!_isTouch) renderer.domElement.requestPointerLock?.();
  } else {
    gameState = priorGameState || 'menu';
  }
  priorGameState = null;
}

let _restartConfirmSource = null;
function requestRestart(source) {
  if (source === 'end') { startGame(); return; }
  if (!confirmOverlay) { startGame(); return; }
  _restartConfirmSource = source || gameState;
  priorGameState = gameState;
  gameState = 'confirm';
  confirmOverlay.hidden = false;
}
function confirmRestart() {
  closeConfirm(true);
  startGame();
}
function closeConfirm(restarting = false) {
  if (gameState !== 'confirm' && !restarting) return;
  confirmOverlay.hidden = true;
  if (!restarting) {
    if (_restartConfirmSource === 'pause' || priorGameState === 'paused') {
      gameState = 'paused';
    } else {
      gameState = priorGameState || 'play';
    }
  }
  _restartConfirmSource = null;
  priorGameState = null;
}

function openSettings() {
  try { settingsHandle?.open?.(); } catch {}
}

function showObjectives(on) {
  const el = document.getElementById('hud-objectives');
  if (!el) return;
  if (on) {
    const objItems = document.getElementById('obj-items');
    if (objItems) objItems.textContent = String(player.itemsFound);
    const objBeacon = document.getElementById('obj-beacon-row');
    if (objBeacon) {
      objBeacon.textContent = beaconPos
        ? 'Reach the beacon (red light)'
        : `Find ${ITEMS_TO_ESCAPE - player.itemsFound} more lost items`;
    }
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function tryInteractPickup(itemRef) {
  if (!itemRef || itemRef.picked) return;
  const d = Math.hypot(itemRef.x - player.pos.x, itemRef.z - player.pos.z);
  if (d > ITEM_PICKUP_DIST + 0.4) return;
  itemRef.picked = true;
  if (itemRef.sprite) itemRef.sprite.visible = false;
  player.itemsFound++;
  player.pendingInteract = null;
  updateInteractPrompt();
  try { playPickup?.(); } catch {}
  flashItemsBadge();
  const lbl = (itemRef.label || 'ITEM').toUpperCase();
  try { showPopup?.(`ITEM FOUND: <b>${lbl}</b>`, 2.5); } catch {}
  try { wgCaption?.(`ITEM FOUND: ${lbl}`, 1800); } catch {}
  // Agent E hooks (per-item personality + post-pickup ambush). Both are
  // optional — wrap in typeof checks so the build never breaks if Agent E's
  // patch hasn't merged yet.
  try { if (typeof triggerItemPersonality === 'function') triggerItemPersonality(itemRef.label); } catch {}
  try { if (typeof maybeTriggerAmbush === 'function') maybeTriggerAmbush(); } catch {}
  const remaining = ITEMS_TO_ESCAPE - player.itemsFound;
  if (remaining === 0) {
    showSubtitle('All items found. Run.', 6);
    try { showObjective?.('BEACON ACTIVATED', 4); } catch {}
    spawnBeacon();
  } else if (remaining === 1) {
    showSubtitle('One more...', 4);
  }
}

const interactPromptEl = document.getElementById('hud-interact');
function updateInteractPrompt() {
  const want = !!player.pendingInteract && gameState === 'play';
  if (interactPromptEl) interactPromptEl.classList.toggle('is-shown', want);
  if (mobileInteractBtn) mobileInteractBtn.style.display = want ? '' : 'none';
}

function pickDeathLandmark() {
  const x = player.pos.x, z = player.pos.z;
  const lm = (typeof window !== 'undefined' && window.world?.landmarks) || null;
  let nearest = null, nearestD = 1e9;
  if (Array.isArray(lm)) {
    for (const m of lm) {
      const d = Math.hypot((m.x ?? 0) - x, (m.z ?? 0) - z);
      if (d < nearestD) { nearestD = d; nearest = m; }
    }
    if (nearest && nearestD < 35) {
      const nm = nearest.name || nearest.label || 'place';
      return `Caught at the ${nm}.`;
    }
  }
  const fromSpawn = Math.hypot(x, z);
  if (fromSpawn < 22) return 'Found near the path.';
  if (fromSpawn > 110) return 'Lost at the edge of the woods.';
  const quad = (x > 0 ? (z > 0 ? 'east clearing' : 'cabin ruins') : (z > 0 ? 'cemetery line' : 'fallen birches'));
  return `Caught by the ${quad}.`;
}

let subtitleClearTo = 0;
// Show a subtitle with optional caption-mirror for accessibility (deaf players).
// `cap` defaults to the same text; pass a different label (e.g. 'DISTANT LAUGH')
// to use a short caption keyword while showing a longer cinematic line.
function showSubtitle(text, durationSecs = 3, cap = null) {
  subtitleEl.textContent = text;
  subtitleEl.classList.add('is-shown');
  subtitleClearTo = now() + durationSecs;
  // Mirror to the shared caption system (no-op if captions are off).
  try { wgCaption?.(cap || text, durationSecs * 1000); } catch {}
}

// Short caption-only hint for ambient audio cues (footsteps, lightning, etc.)
// — fires the in-world subtitle AND the captions live region. The visible
// text is italicized parenthetical to read like an audio caption.
function audioCue(label, durationSecs = 2) {
  showSubtitle(`(${label.toLowerCase()})`, durationSecs, label.toUpperCase());
}

let itemsBadgeHideTo = 0;
function flashItemsBadge() {
  itemsN.textContent = String(player.itemsFound);
  itemsBadge.classList.add('is-shown');
  itemsBadgeHideTo = now() + 2.5;
}

// ---- Popups (top-right slide-in) ------------------------------------------
// Stacked. Each popup auto-fades after `durationSecs` then is removed from DOM.
const _activePopups = [];
function showPopup(html, durationSecs = 2.5) {
  if (!popupsEl) return;
  const el = document.createElement('div');
  el.className = 'hud-popup';
  el.innerHTML = html;
  popupsEl.appendChild(el);
  // Force layout so the transition runs.
  void el.offsetWidth;
  el.classList.add('is-in');
  const item = { el, removeAt: now() + durationSecs };
  _activePopups.push(item);
  // Cap stack to 4 to avoid pile-up during chaotic moments.
  while (_activePopups.length > 4) {
    const dead = _activePopups.shift();
    dead?.el?.remove();
  }
  return item;
}
function _tickPopups() {
  const t = now();
  for (let i = _activePopups.length - 1; i >= 0; i--) {
    const p = _activePopups[i];
    if (t > p.removeAt) {
      // Fade out, then remove from DOM.
      if (!p.el.classList.contains('is-out')) {
        p.el.classList.remove('is-in');
        p.el.classList.add('is-out');
        p.removeAt = t + 0.5; // give it 0.5s to fade
        p.fading = true;
      } else if (p.fading && t > p.removeAt) {
        p.el.remove();
        _activePopups.splice(i, 1);
      }
    }
  }
}

// ---- Objective beat (mid-screen "BEACON ACTIVATED" style) -----------------
let objectiveClearTo = 0;
function showObjective(text, durationSecs = 3.5) {
  if (!objectiveEl) return;
  objectiveEl.textContent = text;
  objectiveEl.classList.add('is-shown');
  objectiveClearTo = now() + durationSecs;
  try { wgCaption?.(text, durationSecs * 1000); } catch {}
}

// ---- Top-center warning blinker -------------------------------------------
let warningClearTo = 0;
function showWarning(text, durationSecs = 3) {
  if (!warningEl) return;
  warningEl.textContent = text;
  warningEl.classList.add('is-shown');
  warningClearTo = now() + durationSecs;
}

// ---- Pause-hint flash (when ESC is pressed) -------------------------------
let pauseHintClearTo = 0;
function flashPauseHint() {
  if (!pauseHintEl) return;
  pauseHintEl.classList.add('is-shown');
  pauseHintClearTo = now() + 1.5;
}

// ---- VFX: kill hit-flash, etc. --------------------------------------------
function triggerHitFlash() {
  if (!vfxHitFlash) return;
  vfxHitFlash.classList.add('is-on');
  setTimeout(() => vfxHitFlash.classList.remove('is-on'), 80);
}

// ---- Heart-rate waveform (top-left) ---------------------------------------
// We render the waveform with a polyline whose points are recomputed each
// frame. Two oscillators stacked: a slow breath wave + a fast spike that fires
// at `heartRate` Hz. As clown closes, heartRate rises and the box "spikes".
const HEART_W = 140, HEART_H = 28;
const HEART_POINTS = 64;
const heartBuf = new Array(HEART_POINTS).fill(HEART_H / 2);
let heartPhase = 0;
let heartRate = 0.9; // Hz (~54 bpm at rest; ramps up near clown)
function tickHeartRate(dt, clownDist) {
  // Closer clown => faster + more chaotic. Mirrors the audio heartbeat rate
  // already pushed via setHeartbeat() from tickClown.
  const proximity = Math.max(0, Math.min(1, (60 - Math.min(60, clownDist)) / 50));
  const targetRate = 0.9 + proximity * 2.6; // up to ~3.5 Hz at point-blank
  heartRate += (targetRate - heartRate) * Math.min(1, dt * 2.5);
  heartPhase += dt * heartRate * Math.PI * 2;

  // Advance waveform: shift left, drop a new sample at the right.
  for (let i = 0; i < HEART_POINTS - 1; i++) heartBuf[i] = heartBuf[i + 1];
  // QRS-shaped spike: a sharp positive peak then a smaller dip per beat,
  // plus a low-amplitude baseline jitter so the line never feels dead.
  const beatPos = (heartPhase / (Math.PI * 2)) % 1;
  let spike = 0;
  if (beatPos < 0.06)      spike = -10 * (beatPos / 0.06);                  // Q dip
  else if (beatPos < 0.10) spike = 16 * ((beatPos - 0.06) / 0.04) - 10;     // R rise
  else if (beatPos < 0.14) spike = 6 - 14 * ((beatPos - 0.10) / 0.04);      // S drop
  else if (beatPos < 0.18) spike = -8 + 8 * ((beatPos - 0.14) / 0.04);      // recover
  else                     spike = (Math.random() - 0.5) * 1.6;             // jitter
  heartBuf[HEART_POINTS - 1] = HEART_H / 2 - spike * (0.7 + proximity * 0.6);

  // Repaint polyline as a single concatenated string.
  let pts = '';
  for (let i = 0; i < HEART_POINTS; i++) {
    const x = (i / (HEART_POINTS - 1)) * HEART_W;
    pts += x.toFixed(1) + ',' + Math.max(2, Math.min(HEART_H - 2, heartBuf[i])).toFixed(1) + ' ';
  }
  if (heartLine) heartLine.setAttribute('points', pts);
  // Heart "icon pulse" period (CSS var) matches the beat rate.
  if (heartBox) {
    heartBox.style.setProperty('--heart-period', (1 / heartRate).toFixed(2) + 's');
    heartBox.classList.toggle('is-spiked', proximity > 0.55);
  }
}

// ---- Compass arrow (visible only after all 5 items collected) -------------
function tickCompass() {
  if (!compassEl || !compassArrow) return;
  // Hide when no beacon yet.
  if (!beaconPos || player.itemsFound < ITEMS_TO_ESCAPE) {
    compassEl.classList.remove('is-shown');
    return;
  }
  compassEl.classList.add('is-shown');
  // World-relative angle to beacon, transformed by player yaw so 0° = forward.
  const dx = beaconPos.x - player.pos.x;
  const dz = beaconPos.z - player.pos.z;
  // Player faces -Z when yaw=0, so the same convention used elsewhere.
  // We want angle 0 to point UP (forward). Rotate by -yaw so the arrow points
  // toward the beacon RELATIVE to the player's view.
  const worldAng = Math.atan2(dx, -dz); // 0 when beacon directly forward
  const rel = worldAng - player.yaw;
  // Normalize to [-pi, pi] then convert to degrees.
  let deg = (rel * 180 / Math.PI) % 360;
  if (deg > 180)  deg -= 360;
  if (deg < -180) deg += 360;
  compassArrow.style.transform = `rotate(${deg.toFixed(1)}deg)`;
}

// ---- Crosshair: show subtle dot only when looking at an interactable ------
// "Interactable" right now = a not-yet-picked item within ~ITEM_GLOW_DIST
// AND inside a narrow center-look cone.
function tickCrosshair() {
  if (!crosshairEl) return;
  let active = false;
  if (player.flashlightOn) {
    const cs = Math.cos(player.yaw), sn = Math.sin(player.yaw);
    const lookX = -sn, lookZ = -cs;
    for (const it of items) {
      if (it.picked) continue;
      const dx = it.x - player.pos.x, dz = it.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > ITEM_GLOW_DIST) continue;
      const dot = (dx / d) * lookX + (dz / d) * lookZ;
      if (dot > 0.93) { active = true; break; } // narrow center-look cone
    }
  }
  crosshairEl.classList.toggle('is-shown', active);
}

// ---- Tutorial bubbles (first-visit only, profile-flagged) -----------------
const TUT_STEPS = _isTouch ? [
  'MOVE: drag the joystick on the left half.',
  'LOOK: drag anywhere on the right half.',
  'FLASHLIGHT: tap TORCH (battery is limited).',
  'SPRINT: hold RUN (stamina is limited).',
  'FIND 5 ITEMS, REACH THE BEACON.',
  "DON'T LET HIM CATCH YOU.",
] : [
  'MOVE: WASD or arrow keys.',
  'LOOK: move the mouse (click first to lock pointer).',
  'FLASHLIGHT: F  (battery is limited).',
  'SPRINT: SHIFT (stamina is limited).',
  'FIND 5 ITEMS, REACH THE BEACON.',
  "DON'T LET HIM CATCH YOU.",
];
const TUT_FLAG_KEY = (() => {
  try { return profileKey('clown-forest:tut-seen'); }
  catch { return 'wg:clown-forest:tut-seen'; }
})();
let _tutSeen = false;
try { _tutSeen = localStorage.getItem(TUT_FLAG_KEY) === '1'; } catch { _tutSeen = false; }
let _tutIndex = 0;
let _tutAutoAdvanceTo = 0;
let _tutActive = false;
function _renderTutStep() {
  if (!tutBox || !tutText) return;
  if (_tutIndex >= TUT_STEPS.length) { _endTutorial(); return; }
  tutText.textContent = TUT_STEPS[_tutIndex];
  if (tutNext) tutNext.textContent = (_tutIndex === TUT_STEPS.length - 1) ? 'BEGIN' : 'NEXT ›';
  _tutAutoAdvanceTo = now() + 4; // 4s auto-advance per spec
}
function _advanceTut() {
  _tutIndex++;
  if (_tutIndex >= TUT_STEPS.length) { _endTutorial(); return; }
  _renderTutStep();
}
function _endTutorial() {
  _tutActive = false;
  _tutAutoAdvanceTo = 0;
  if (tutBox) tutBox.hidden = true;
  try { localStorage.setItem(TUT_FLAG_KEY, '1'); } catch {}
  _tutSeen = true;
}
function startTutorial() {
  if (_tutSeen || !tutBox) return;
  _tutActive = true;
  _tutIndex = 0;
  tutBox.hidden = false;
  _renderTutStep();
}
function _tickTutorial() {
  if (!_tutActive) return;
  if (_tutAutoAdvanceTo && now() > _tutAutoAdvanceTo) _advanceTut();
}
if (tutNext) tutNext.addEventListener('click', (e) => { e.stopPropagation(); _advanceTut(); });
if (tutSkip) tutSkip.addEventListener('click', (e) => { e.stopPropagation(); _endTutorial(); });
// Click-to-advance anywhere on the bubble.
if (tutBox) tutBox.addEventListener('click', (e) => {
  if (e.target === tutNext || e.target === tutSkip) return;
  _advanceTut();
});

function startGame() {
  gameState = 'play';
  document.body.classList.add('is-playing');
  // Hide every overlay we own so a state-change mid-flow is recoverable.
  loadingOverlay.hidden = true;
  introOverlay.hidden = true;
  startOverlay.hidden = true;
  endOverlay.hidden = true;
  pauseOverlay.hidden = true;
  if (controlsOverlay) controlsOverlay.hidden = true;
  if (confirmOverlay)  confirmOverlay.hidden = true;
  hudEl.hidden = false;
  flashEl.className = '';
  flashEl.style.opacity = '';
  killCamEl.classList.remove('is-on');
  endOverlay.classList.remove('is-escape');

  // Reset player.
  player.pos.set(0, PLAYER_H, 0);
  player.yaw = 0; player.pitch = 0;
  player.stamina = STAMINA_MAX;
  player.flashlightOn = true;
  flashlight.visible = true;
  player.flashlightBattery = 100;
  player.isCrouching = false;
  player.isSprinting = false;
  player.itemsFound = 0;
  player.twigSnapCooldown = 0;
  // Reset Agent D tracker variables.
  player.distanceWalked = 0;
  player.pendingInteract = null;
  player.deathLandmark = null;
  // Reset Agent E tracker variables.
  player.playerSprintTime = 0;
  player.playerCrouchTime = 0;
  player.flashlightOffTime = 0;
  player.exhaustedUntil = 0;
  player.isListening = false;
  player.tapesFound = 0;
  player.nightPercent = 0;
  player._fogLiftAnnounced = false;
  player._brightenAnnounced = false;
  _nightDawnTriggered = false;
  try { if (typeof window !== 'undefined') window.clownForestNightPct = 0; } catch {}
  // Reset + reseed items onto Agent A's landmarks (if exposed).
  resetItemsForRun();
  // Reset cassette tapes + load persisted tally for the start-screen flag.
  resetTapesForRun();
  // Remove existing beacon if any.
  if (beacon) {
    scene.remove(beacon); beacon.geometry.dispose(); beacon = null;
  }
  if (beaconLight) { scene.remove(beaconLight); beaconLight = null; }
  beaconPos = null;
  // Reset clown.
  clownState.phase = 'stalk';
  clownState.lastStalkEvent = 0;
  clownState.nextStalkEvent = now() + 8 + Math.random() * 10; // first peek soon
  clownState.lastSeenAt = now();
  clownState.fleeUntil = 0;
  clownState.ranAwayCount = 0;
  clownState.isVisible = false;
  clownSprite.visible = false;
  // Reset Agent E clown additions.
  clownState.lastSeenDist = 999;
  clownState.stalkVariant = null;
  clownState.weepingAngelLockUntil = 0;
  clownState.nextHuntPeekAt = now() + 25 + Math.random() * 15;
  clownState.huntPeekActive = false;
  clownState.huntPeekOrigin = null;
  clownState.chaseWeavePhase = Math.random() * Math.PI * 2;
  clownState.ambushUntil = 0;
  clownState.ambushNextTickAt = 0;
  clownState.searchInterest = 0;
  nextRandomEventAt = now() + 60 + Math.random() * 60;
  // Pick a far hiding spot.
  const ang0 = Math.random() * Math.PI * 2;
  clownState.pos.set(Math.cos(ang0) * 50, 0, Math.sin(ang0) * 50);
  clownSprite.position.set(clownState.pos.x, CLOWN_HEIGHT / 2 + groundY(clownState.pos.x, clownState.pos.z), clownState.pos.z);

  runStartTs = now();
  totalElapsed = 0;
  nextLightningAt = now() + 30 + Math.random() * 60;
  nextOwlAt = now() + 15 + Math.random() * 25;

  // Atmosphere (Agent B): reset per-run state so weather decisions, gust
  // timers, fog density, flashlight cutout schedules, and the dawn factor
  // all start fresh.
  rainState.decidedThisRun = false;
  rainState.active = false;
  rainState.startedAt = 0; rainState.endAt = 0;
  rainState.intensity = 0;
  rainLines.visible = false; rainMat.opacity = 0;
  maybeStartRain();
  windState.gustEndAt = 0;
  windState.nextGustAt = now() + 25 + Math.random() * 35;
  windState.currentAmp = WIND_BASE_AMP;
  flashState.blinkOutUntil = 0;
  flashState.cutOutUntil = 0;
  flashState.nextCutOutAt = 0;
  flashState.cutoutScreenAlpha = 0;
  flashState.colorCache.copy(flashState.baseColor);
  flashlight.color.copy(flashState.baseColor);
  flashlight.angle = FLASH_BASE_ANGLE;
  flashlight.intensity = FLASH_BASE_INTENSITY;
  flashEl.classList.remove('is-cutout');
  flashEl.style.removeProperty('--cutout-alpha');
  skyDawnFactor = 0;
  if (scene.fog?.isFogExp2) scene.fog.density = FOG_DENSITY_BASE;
  lightningState.fogOverrideUntil = 0;

  if (!_isTouch) {
    renderer.domElement.requestPointerLock();
  }
  // First user gesture — start audio + start stalk-phase music.
  startAudio();
  playAmbience(0.55);
  playStalkMusic();

  // ---- HUD reset (Agent C) ----
  // Wipe all popup/objective/warning state from the previous run.
  _activePopups.forEach((p) => p.el?.remove());
  _activePopups.length = 0;
  if (objectiveEl) { objectiveEl.classList.remove('is-shown'); objectiveClearTo = 0; }
  if (warningEl)   { warningEl.classList.remove('is-shown');   warningClearTo  = 0; }
  if (pauseHintEl) { pauseHintEl.classList.remove('is-shown'); pauseHintClearTo = 0; }
  if (compassEl)   compassEl.classList.remove('is-shown');
  if (crosshairEl) crosshairEl.classList.remove('is-shown');
  if (vfxStamCrit) vfxStamCrit.classList.remove('is-on');
  if (vfxBatStatic) vfxBatStatic.classList.remove('is-on');
  if (vfxThrob)   vfxThrob.style.setProperty('--throb-alpha', '0');
  if (vfxHeartBreath) vfxHeartBreath.style.setProperty('--breath-alpha', '0');
  document.body.classList.remove('is-sanity-low');

  // First-visit tutorial — non-blocking, four-second auto-advance per step.
  startTutorial();

  // Agent D: ensure the TAB objectives panel + INTERACT prompt are clean.
  showObjectives(false);
  updateInteractPrompt();

  // Opening subtitle (always shows for tone, regardless of tutorial).
  showSubtitle('Find 5 items. Stay alive.', 5);
}

function pauseGame() {
  if (gameState !== 'play') return;
  gameState = 'paused';
  document.body.classList.remove('is-playing');
  pauseOverlay.hidden = false;
  document.exitPointerLock?.();
  playAmbience(0);
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'play';
  document.body.classList.add('is-playing');
  pauseOverlay.hidden = true;
  if (!_isTouch) {
    renderer.domElement.requestPointerLock();
  }
  playAmbience(0.55);
}

function endGame(reason) {
  if (gameState === 'dead' || gameState === 'escaped') return;
  document.body.classList.remove('is-playing');
  document.exitPointerLock?.();
  const escaped = reason === 'escape';
  gameState = escaped ? 'escaped' : 'dead';
  const elapsed = now() - runStartTs;

  // Clear ephemeral UI from the run.
  showObjectives(false);
  updateInteractPrompt();
  endOverlay.classList.toggle('is-escape', escaped);

  if (escaped) {
    // Win cutscene — see playWinCinematic() for the staged sequence. The
    // escape sting was already played there; don't double-trigger it here.
    endTitle.textContent = 'DAWN BREAKS';
    endSub.textContent = 'He stayed in the woods.';
  } else {
    // Death — landmark-flavored subtitle. The huge red title is set in the
    // CSS layout; we just supply the lines.
    endTitle.textContent = 'YOU WERE FOUND';
    endSub.textContent = player.deathLandmark || pickDeathLandmark();
  }
  endItems.textContent = String(player.itemsFound);
  endTime.textContent  = formatTime(elapsed);
  if (endDistance) endDistance.textContent = `${Math.round(player.distanceWalked)} m`;

  // Persist best — prioritize ESCAPED runs by time, else by items found.
  const run = {
    escaped,
    itemsFound: player.itemsFound,
    time: elapsed,
    score: (escaped ? 1000 : 0) + player.itemsFound * 10 - Math.floor(elapsed / 10),
    ts: Date.now(),
  };
  const result = submitRun('clown-forest', run, (a, b) => {
    if (a.escaped !== b.escaped) return a.escaped ? -1 : 1;
    if (a.escaped) return (a.time || Infinity) - (b.time || Infinity);
    return (b.itemsFound || 0) - (a.itemsFound || 0);
  });
  const best = result.current;
  const newBest = result.isNewBest ? ' ★ NEW BEST' : '';
  if (best.escaped) {
    endBest.innerHTML = `BEST <b>TIME ${formatTime(best.time)}</b>${newBest}`;
  } else {
    endBest.innerHTML = `BEST <b>${best.itemsFound || 0}/5 ITEMS</b>${newBest}`;
  }

  // Show the overlay AFTER the kill / sunrise cinematic completes.
  // The kill cinematic already fades to black for ~0.85s before calling here;
  // we follow with the typography fade-in built into the .end-title style.
  // Sunrise gets a longer reveal so DAWN BREAKS feels earned.
  const delay = escaped ? 2200 : 1300;
  setTimeout(() => {
    endOverlay.hidden = false;
    flashEl.className = '';
    flashEl.style.opacity = '';
  }, delay);
  playAmbience(0);
}

// =============================================================================
// AGENT D — WIN CUTSCENE. Called when the player reaches the beacon. Stages:
//   0.0s  freeze input + start sunrise gradient + auto-walk
//   1.8s  swap sunrise → full white wash
//   3.0s  call endGame('escape') which paints the DAWN BREAKS panel
// We use a distinct internal sentinel ('winCine') so endGame won't early-out
// when we hand off to it.
// =============================================================================
function playWinCinematic() {
  if (gameState !== 'play') return;
  gameState = 'winCine'; // sentinel — tickPlay won't run, endGame won't bail
  document.body.classList.remove('is-playing');
  document.exitPointerLock?.();
  // Stop tick-driven music; play the escape stinger.
  try { playEscape?.(); } catch {}
  // Soft sunrise gradient first.
  flashEl.className = 'is-sunrise';
  // Auto-walk the camera forward briefly so the player isn't frozen in place.
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const winStart = now();
  const WIN_AUTOWALK_DURATION = 3.0;
  const WIN_AUTOWALK_SPEED = 1.6;
  const stepFn = () => {
    const t = now() - winStart;
    if (t > WIN_AUTOWALK_DURATION) return;
    if (gameState !== 'winCine' && gameState !== 'escaped') return;
    const dt = 1 / 60;
    player.pos.x += fwdX * WIN_AUTOWALK_SPEED * dt;
    player.pos.z += fwdZ * WIN_AUTOWALK_SPEED * dt;
    camera.position.set(player.pos.x, PLAYER_H, player.pos.z);
    requestAnimationFrame(stepFn);
  };
  requestAnimationFrame(stepFn);
  // 1.8s in, swap to white wash.
  setTimeout(() => {
    if (gameState !== 'winCine' && gameState !== 'escaped') return;
    flashEl.className = 'is-white';
  }, 1800);
  // 3.0s total: trigger endGame so the stats panel arrives over the white.
  setTimeout(() => {
    if (gameState !== 'winCine' && gameState !== 'escaped') return;
    // Reset to 'play' just for endGame's guard, which expects to transition
    // from 'play' to 'escaped'. (gameState is internal; the player can't
    // observe this momentary flicker.)
    gameState = 'play';
    endGame('escape');
  }, 3000);
}

// ---- KILL CINEMATIC -------------------------------------------------------
// 1) zoom + scream (1.2s) → 2) hard cut to black → 3) endGame('dead') paints
// the "YOU WERE FOUND" panel + landmark subtitle. Agent D extends the
// existing zoom (CLOWN-A) by capturing the death landmark up-front so the
// panel can flavor the sub-line.
function triggerKillCinematic() {
  if (gameState !== 'play') return;
  // Capture the landmark NOW (before player.pos can shift in any tick race).
  player.deathLandmark = pickDeathLandmark();
  // Snap the kill canvas to the clown face.
  const ctx = killCanvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, killCanvas.width, killCanvas.height);
  drawKillFace(ctx);
  killCamEl.classList.add('is-on');
  playKill();
  // Agent C VFX: red hit-flash and caption — caption fires regardless of
  // sound state so deaf players still get a kill cue.
  triggerHitFlash();
  try { wgCaption?.('MONSTER GROWL', 1400); } catch {}
  // 1.2s zoom + scream, then HARD CUT to black before endGame paints the panel.
  setTimeout(() => {
    flashEl.className = 'is-black';
    endGame('caught');
  }, 1200);
}

// Bigger clown face for the kill cam — close-up, eyes filling the frame.
function drawKillFace(g) {
  const W = killCanvas.width, H = killCanvas.height;
  // Background: oppressive black + faint dark red corner glow.
  const bg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, '#1a0a0a');
  bg.addColorStop(1, '#000');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Pale face fills 80% of the frame.
  g.fillStyle = '#dcc8b0';
  g.beginPath();
  g.ellipse(W / 2, H * 0.55, W * 0.42, H * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  // Side shadows.
  g.fillStyle = 'rgba(40, 30, 30, 0.55)';
  g.beginPath();
  g.ellipse(W * 0.3, H * 0.5, W * 0.18, H * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  // Big black eye sockets.
  g.fillStyle = '#0a0608';
  g.beginPath();
  g.ellipse(W * 0.36, H * 0.42, 40, 28, 0, 0, Math.PI * 2); g.fill();
  g.beginPath();
  g.ellipse(W * 0.64, H * 0.42, 40, 28, 0, 0, Math.PI * 2); g.fill();
  // RED triangle markings.
  g.fillStyle = '#9a0a0a';
  g.beginPath();
  g.moveTo(W * 0.25, H * 0.30); g.lineTo(W * 0.36, H * 0.5); g.lineTo(W * 0.47, H * 0.30);
  g.closePath(); g.fill();
  g.beginPath();
  g.moveTo(W * 0.53, H * 0.30); g.lineTo(W * 0.64, H * 0.5); g.lineTo(W * 0.75, H * 0.30);
  g.closePath(); g.fill();
  // Glowing white pupils.
  g.fillStyle = '#fff8e0';
  g.fillRect(W * 0.36 - 4, H * 0.42 - 4, 8, 8);
  g.fillRect(W * 0.64 - 4, H * 0.42 - 4, 8, 8);
  // The smile — huge, asymmetric, blood-red.
  g.strokeStyle = '#7a0a0a';
  g.lineWidth = 22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W * 0.22, H * 0.68);
  g.bezierCurveTo(W * 0.35, H * 0.90, W * 0.65, H * 0.92, W * 0.78, H * 0.74);
  g.stroke();
  g.fillStyle = '#0a0408';
  g.beginPath();
  g.moveTo(W * 0.23, H * 0.69);
  g.bezierCurveTo(W * 0.35, H * 0.88, W * 0.65, H * 0.88, W * 0.77, H * 0.74);
  g.bezierCurveTo(W * 0.65, H * 0.80, W * 0.35, H * 0.80, W * 0.23, H * 0.69);
  g.closePath();
  g.fill();
  // Teeth — irregular jagged.
  g.fillStyle = '#e8dcc0';
  for (let i = 0; i < 11; i++) {
    const tx = W * 0.27 + (i / 10) * W * 0.46;
    const ty = H * 0.74 + (i % 2 === 0 ? 0 : 4);
    g.beginPath();
    g.moveTo(tx, ty);
    g.lineTo(tx + 14, ty + 22 + Math.random() * 8);
    g.lineTo(tx + 28, ty);
    g.closePath();
    g.fill();
  }
  // Red nose.
  g.fillStyle = '#7a0a0a';
  g.beginPath();
  g.arc(W / 2, H * 0.55, 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#aa1414';
  g.beginPath();
  g.arc(W / 2 - 5, H * 0.54, 9, 0, Math.PI * 2); g.fill();
}

// =============================================================================
// AGENT D — overlay button wiring (start / end / pause / controls / confirm).
// =============================================================================
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('end-restart').addEventListener('click', () => {
  endOverlay.hidden = true;
  killCamEl.classList.remove('is-on');
  flashEl.className = '';
  startGame();
});
document.getElementById('pause-resume').addEventListener('click', resumeGame);
document.getElementById('pause-restart').addEventListener('click', () => {
  // The restart button on pause goes through the confirm flow.
  requestRestart('pause');
});
const pauseControlsBtn = document.getElementById('pause-controls');
if (pauseControlsBtn) pauseControlsBtn.addEventListener('click', () => openControlsHelp());
const pauseSettingsBtn = document.getElementById('pause-settings');
if (pauseSettingsBtn) pauseSettingsBtn.addEventListener('click', () => openSettings());
const controlsCloseBtn = document.getElementById('controls-close');
if (controlsCloseBtn) controlsCloseBtn.addEventListener('click', () => closeControlsHelp());
const confirmYesBtn = document.getElementById('confirm-yes');
if (confirmYesBtn) confirmYesBtn.addEventListener('click', () => confirmRestart());
const confirmNoBtn = document.getElementById('confirm-no');
if (confirmNoBtn)  confirmNoBtn.addEventListener('click', () => closeConfirm(false));

// =============================================================================
// AGENT D — boot kick-off. After Three.js + textures are baked, fire the
// loading-ready prompt; first launch threads to the intro cutscene, returning
// players land straight on the start screen.
// =============================================================================
// We've already done all the heavy baking by this point in the async IIFE.
// Show a quick progress ramp for tactile feedback (the work is done in <1
// frame typically), then surface CLICK TO ENTER.
{
  // 4-step animated ramp so the bar actually moves a bit even on fast loads.
  setLoadingProgress(25);
  setTimeout(() => setLoadingProgress(55), 80);
  setTimeout(() => setLoadingProgress(82), 180);
  setTimeout(() => setLoadingProgress(98), 280);
  setTimeout(() => onAssetsReady(), 380);
}

// =============================================================================
// MAIN LOOP
// =============================================================================
let prevTs = performance.now();
function loop(now_) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now_ - prevTs) / 1000);
  prevTs = now_;
  if (gameState === 'play') {
    tickPlay(dt);
  }
  renderer.render(scene, camera);
}

function now() { return performance.now() / 1000; }

function tickPlay(dt) {
  totalElapsed += dt;

  // ---- Movement input + speed selection -----------------------------------
  const fwd = (keys.has('w') || keys.has('arrowup')) ? 1 : 0;
  const back = (keys.has('s') || keys.has('arrowdown')) ? 1 : 0;
  const left = (keys.has('a') || keys.has('arrowleft')) ? 1 : 0;
  const right = (keys.has('d') || keys.has('arrowright')) ? 1 : 0;
  let mx = (right - left), my = (back - fwd);
  if (_isTouch && mcMove.mag > 0.05) { mx = mcMove.x; my = mcMove.y; }
  const inputMag = Math.hypot(mx, my);
  const isMoving = inputMag > 0.05;

  // Crouch — held with C key (or LISTEN mode forces a crouch-like stance).
  player.isCrouching = keys.has('c') || player.isListening;
  // Sprint — Shift held + stamina + not crouching + not exhausted.
  const sprintRequested = keys.has('shift');
  const exhausted = now() < player.exhaustedUntil;
  player.isSprinting = sprintRequested && !player.isCrouching && player.stamina > 0.05 && isMoving && !exhausted;

  let targetSpeed = WALK_SPEED;
  if (player.isCrouching) targetSpeed = CROUCH_SPEED;
  else if (player.isSprinting) targetSpeed = SPRINT_SPEED;
  // Exhausted slow-walk penalty for the lockout window.
  if (exhausted) targetSpeed = Math.min(targetSpeed, WALK_SPEED * 0.6);

  // Stamina drain / regen. Hitting 0 triggers an EXHAUSTED lockout.
  if (player.isSprinting) {
    player.stamina = Math.max(0, player.stamina - dt);
    if (player.stamina <= 0 && player.exhaustedUntil < now()) {
      player.exhaustedUntil = now() + STAMINA_EXHAUST_TIME;
      showSubtitle('EXHAUSTED', 1.5);
    }
  } else {
    player.stamina = Math.min(STAMINA_MAX, player.stamina + dt * STAMINA_REGEN);
  }

  // Convert input to world-space velocity.
  const cs = Math.cos(player.yaw), sn = Math.sin(player.yaw);
  let vx = (-sn * (-my)) + (cs * mx);
  let vz = (-cs * (-my)) + (-sn * mx);
  const vmag = Math.hypot(vx, vz);
  if (vmag > 1) { vx /= vmag; vz /= vmag; }
  vx *= targetSpeed; vz *= targetSpeed;

  // ---- Movement + tree collision ----
  const [nx, nz] = collideMove(player.pos.x, player.pos.z, vx * dt, vz * dt);
  const moved = Math.hypot(nx - player.pos.x, nz - player.pos.z);
  player.pos.x = nx; player.pos.z = nz;
  // Soft clamp to playable area (with margin from world edge).
  const lim = WORLD_SIZE * 0.48;
  player.pos.x = Math.max(-lim, Math.min(lim, player.pos.x));
  player.pos.z = Math.max(-lim, Math.min(lim, player.pos.z));
  // Agent D: track total distance walked for the end-screen stat.
  player.distanceWalked += moved;

  // ---- Walk bob + footsteps ----
  if (moved > 0.001) {
    const bobRate = player.isSprinting ? 12 : player.isCrouching ? 5 : 8;
    player.walkTime += dt * bobRate;
    player.walkBob = Math.sin(player.walkTime) * (player.isSprinting ? 0.06 : 0.035);
    // Footstep cadence scales with speed.
    const footInterval = player.isSprinting ? 0.30 : player.isCrouching ? 0.55 : 0.42;
    if (now() - player.lastFootstep > footInterval) {
      const intensity = player.isSprinting ? 1.0 : player.isCrouching ? 0.35 : 0.65;
      playFootstep(intensity);
      player.lastFootstep = now();
    }
    // Occasional twig snap — sounds genuinely scary in headphones.
    player.twigSnapCooldown -= dt;
    if (player.twigSnapCooldown <= 0 && Math.random() < 0.012) {
      playTwigSnap();
      player.twigSnapCooldown = 2 + Math.random() * 4;
      try { wgCaption?.('TWIG SNAP', 900); } catch {}
    }
  } else {
    player.walkBob *= 0.85;
  }

  // ---- Camera ----
  const targetH = player.isCrouching ? PLAYER_CROUCH_H : PLAYER_H;
  // Smooth crouch transition.
  const eyeH = (camera.position.y - player.walkBob);
  const newH = eyeH + (targetH - eyeH) * Math.min(1, dt * 6);
  camera.position.set(player.pos.x, newH + player.walkBob, player.pos.z);
  const lookX = Math.cos(player.pitch) * -Math.sin(player.yaw);
  const lookY = Math.sin(player.pitch);
  const lookZ = Math.cos(player.pitch) * -Math.cos(player.yaw);
  camera.lookAt(camera.position.x + lookX, camera.position.y + lookY, camera.position.z + lookZ);

  // ---- Flashlight battery + sophisticated flicker / cutout (Agent B) ----
  tickFlashlight(dt);

  // ---- Items: glow when near, set pendingInteract when in pickup range ----
  // Agent D removed auto-pickup in favour of E / TAKE button so the player
  // has agency. The actual pickup logic lives in tryInteractPickup() above
  // (and is called from the keydown / mobile button handlers).
  let nearestInteract = null;
  let nearestInteractD = 1e9;
  for (const it of items) {
    if (it.picked) continue;
    const d = Math.hypot(it.x - player.pos.x, it.z - player.pos.z);
    if (d < ITEM_PICKUP_DIST) {
      // Pick the nearest interactable as the prompt target.
      if (d < nearestInteractD) { nearestInteract = it; nearestInteractD = d; }
    }
    if (d < ITEM_GLOW_DIST) {
      const t = 1 - d / ITEM_GLOW_DIST;
      const closeBoost = d < 3 ? (1 - d / 3) : 0;
      it.sprite.material.opacity = 0.35 + t * 0.45 + closeBoost * 0.25;
      it.sprite.scale.setScalar(1.4 + t * 0.3 + closeBoost * 0.25);
    } else {
      it.sprite.material.opacity = 0.35;
      it.sprite.scale.setScalar(1.4);
    }
  }
  // Update the pending-interact prompt only when the target changes.
  if (nearestInteract !== player.pendingInteract) {
    player.pendingInteract = nearestInteract;
    updateInteractPrompt();
  }

  // ---- Cassette tapes: glow when near + pickup (lore, persistent) ----
  for (const tp of tapes) {
    if (tp.picked) continue;
    const d = Math.hypot(tp.x - player.pos.x, tp.z - player.pos.z);
    if (d < ITEM_PICKUP_DIST) {
      tp.picked = true;
      tp.sprite.visible = false;
      player.tapesFound++;
      playPickup();
      // Persist lifetime tally so the start screen can show TAPES X/3.
      const lifetime = Math.min(TAPE_COUNT, _loadTapesLifetime() + 1);
      _saveTapesLifetime(lifetime);
      try {
        if (typeof window !== 'undefined') {
          window.clownForestTapesFound = lifetime;
          window.clownForestTapesTotal = TAPE_COUNT;
        }
      } catch {}
      // Audio: try a whisper/voice clip; fall back to pickup ding if absent.
      try { audio?.playClownLaugh?.(0, 30); } catch {}
      try { wgCaption?.(`CASSETTE TAPE FOUND (${player.tapesFound}/${TAPE_COUNT})`, 2500); } catch {}
      showPopup(`<b>TAPE FOUND</b> · ${player.tapesFound}/${TAPE_COUNT}`, 3);
    } else if (d < ITEM_GLOW_DIST) {
      const t = 1 - d / ITEM_GLOW_DIST;
      tp.sprite.material.opacity = 0.45 + t * 0.35;
    } else {
      tp.sprite.material.opacity = 0.45;
    }
  }

  // ---- Beacon check ----
  if (beaconPos) {
    const d = Math.hypot(beaconPos.x - player.pos.x, beaconPos.z - player.pos.z);
    if (d < 3.5) {
      // Agent D: staged escape cinematic (slow forward run + white wash) before
      // endGame('escape') paints the DAWN BREAKS panel.
      playWinCinematic();
    } else if (d < 30) {
      // Pulse beacon emissive based on proximity for visual urgency.
      if (beacon) {
        const t = 1 - d / 30;
        beacon.material.emissiveIntensity = 1.2 + t * 1.4 + Math.sin(totalElapsed * 6) * 0.3 * t;
      }
    }
  }

  // ---- Atmosphere / particles / weather (Agent B) ----
  // Order: clown AI runs first so tickAtmosphere() can read clown phase for
  // the fog-density override. All particle systems are no-ops while paused
  // because tickPlay isn't called outside gameState === 'play'.
  tickClown(dt);
  // Random ambient events (NEAR_MISS / CIRCLE / WHISPER / DISTURBANCE).
  maybeTriggerRandomEvent();
  // Time-of-night clock — gameplay-affecting; published to a global so Agents
  // B/C can read it for fog lift / sky brightening / HUD dawn indicator.
  tickNightClock(dt);
  tickAtmosphere(dt);

  // ---- Ambient events: lightning + owl ----
  if (now() > nextLightningAt) {
    triggerLightning();
    nextLightningAt = now() + 30 + Math.random() * 60;
    // Accessibility caption — silent for hearing players, visible if CAPS on.
    try { wgCaption?.('LIGHTNING', 1200); } catch {}
  }
  if (now() > nextOwlAt) {
    playOwl();
    nextOwlAt = now() + 30 + Math.random() * 50;
    try { wgCaption?.('OWL CALL', 1000); } catch {}
  }

  // ---- Tutorial auto-advance ----
  _tickTutorial();

  // ---- HUD ticking (Agent C) ----
  tickHUD(dt);
}

// =============================================================================
// TREE COLLISION — for each tree within a small bounding box of the player,
// resolve overlap by pushing the player away.
// =============================================================================
function collideMove(curX, curZ, dx, dz) {
  let nx = curX + dx;
  let nz = curZ + dz;
  // Only check trees within a 6m bubble (cheap).
  const checkR = 6;
  const checkRSq = checkR * checkR;
  for (let i = 0; i < treeData.length; i++) {
    const t = treeData[i];
    const dx2 = t.x - nx, dz2 = t.z - nz;
    const distSq = dx2 * dx2 + dz2 * dz2;
    if (distSq > checkRSq) continue;
    // Trunk radius scales with tree scale; conservative bottom radius.
    const trunkR = 0.4 * t.scale;
    const minD = PLAYER_R + trunkR;
    if (distSq < minD * minD) {
      // Push the player out along the normal.
      const d = Math.sqrt(distSq);
      if (d < 0.001) continue;
      const nxn = (nx - t.x) / d;
      const nzn = (nz - t.z) / d;
      nx = t.x + nxn * minD;
      nz = t.z + nzn * minD;
    }
  }
  return [nx, nz];
}

// =============================================================================
// LINE-OF-SIGHT for the clown — check if player can see the clown. Cheap:
// distance + roughly a frustum check (is clown inside the view cone?).
// Fog + trees mean the player has very limited sight regardless, so we don't
// need to ray-march the trees explicitly.
// =============================================================================
function playerCanSeeClown() {
  const dx = clownState.pos.x - player.pos.x;
  const dz = clownState.pos.z - player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > FOG_FAR) return false;
  // Angle to clown vs forward (yaw).
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const len = Math.max(0.001, dist);
  const dot = (dx / len) * fwdX + (dz / len) * fwdZ;
  // Camera FOV ~72°, so cos(36°) ≈ 0.81. Widen slightly for peripheral feel.
  return dot > 0.65;
}

// =============================================================================
// AGENT E HELPERS — per-item personality, ambush trigger, random events,
// player-behavior trackers (search interest).
// =============================================================================
function triggerItemPersonality(label) {
  switch (label) {
    case 'radio': {
      try { audio?.playLeafSwirl?.(); } catch {}
      try { audio?.playClownBreath?.(15); } catch {}
      showSubtitle('...static...', 2);
      break;
    }
    case 'locket': {
      if (flashEl) {
        const prev = flashEl.className;
        flashEl.className = 'is-lightning-dim';
        setTimeout(() => { flashEl.className = prev || ''; }, 90);
      }
      showSubtitle('A face...', 2);
      break;
    }
    case 'phone': {
      const startT = now();
      const intervalId = setInterval(() => {
        if (now() - startT > 0.4 || gameState !== 'play') { clearInterval(intervalId); return; }
        player.yaw   += (Math.random() - 0.5) * 0.018;
        player.pitch += (Math.random() - 0.5) * 0.014;
        player.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, player.pitch));
      }, 30);
      break;
    }
    case 'lighter': {
      if (flashlight && player.flashlightOn) {
        const prevI = flashlight.intensity;
        const prevD = flashlight.distance;
        flashlight.intensity = Math.max(prevI, FLASH_BASE_INTENSITY * 1.8);
        flashlight.distance  = Math.max(prevD, FLASH_BASE_DISTANCE * 1.4);
        setTimeout(() => { flashlight.intensity = prevI; flashlight.distance = prevD; }, 1000);
      } else { showSubtitle('A spark...', 2); }
      break;
    }
    case 'photo': {
      if (clownSprite && !clownSprite.visible) {
        clownSprite.material.opacity = 0.55;
        clownSprite.visible = true;
        const gy = groundY(clownState.pos.x, clownState.pos.z);
        clownSprite.position.set(clownState.pos.x, CLOWN_HEIGHT / 2 + gy, clownState.pos.z);
        setTimeout(() => {
          if (!clownState.isVisible) {
            clownSprite.visible = false;
            clownSprite.material.opacity = 1.0;
          }
        }, 150);
      }
      showSubtitle('Smiling...', 2);
      break;
    }
  }
}
function maybeTriggerAmbush() {
  if (Math.random() > 0.6) return;
  if (clownState.phase === 'chase') return;
  const backX = Math.sin(player.yaw), backZ = Math.cos(player.yaw);
  clownState.pos.x = player.pos.x + backX * 10;
  clownState.pos.z = player.pos.z + backZ * 10;
  clownState.ambushUntil = now() + AMBUSH_DURATION;
  clownState.ambushNextTickAt = now() + 0.5;
  if (clownState.phase === 'stalk') {
    clownState.phase = 'hunt';
    try { playHuntMusic(); } catch {}
  }
  showSubtitle('You hear breathing.', 3);
  try { wgCaption?.('BREATHING BEHIND', 1500); } catch {}
}
let nextRandomEventAt = 0;
function maybeTriggerRandomEvent() {
  if (gameState !== 'play') return;
  if (now() < nextRandomEventAt) return;
  if (totalElapsed < CURVE_QUIET_UNTIL) {
    nextRandomEventAt = now() + 40 + Math.random() * 60; return;
  }
  if (clownState.phase === 'chase') {
    nextRandomEventAt = now() + 20 + Math.random() * 20; return;
  }
  nextRandomEventAt = now() + RANDOM_EVENT_MIN_GAP + Math.random() * (RANDOM_EVENT_MAX_GAP - RANDOM_EVENT_MIN_GAP);
  const which = Math.floor(Math.random() * 4);
  if (which === 0) randomEventNearMiss();
  else if (which === 1) randomEventCircle();
  else if (which === 2) randomEventWhisper();
  else randomEventObjectDisturbance();
}
function randomEventNearMiss() {
  const side = Math.random() < 0.5 ? 1 : -1;
  const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
  const rightX = -fwdZ, rightZ = fwdX;
  const cx = player.pos.x + fwdX * 22 + rightX * side * 18;
  const cz = player.pos.z + fwdZ * 22 + rightZ * side * 18;
  clownState.pos.x = cx; clownState.pos.z = cz;
  clownState.isVisible = true;
  clownSprite.visible = true;
  clownState.visibleStartedAt = now();
  clownState.fleeUntil = now() + 4;
  const a = Math.atan2(cz - player.pos.z, cx - player.pos.x) - player.yaw;
  try { playClownLaugh(Math.sin(a), 30); } catch {}
  try { wgCaption?.('SOMETHING PASSED BY', 1500); } catch {}
  setTimeout(() => {
    if (!clownState.isVisible) return;
    if (clownState.phase !== 'chase') { clownState.isVisible = false; clownSprite.visible = false; }
  }, 1100);
}
function randomEventCircle() {
  clownState.circleEndAt = now() + 8;
  clownState.circlePhase = Math.random() * Math.PI * 2;
  clownState.isVisible = true;
  clownSprite.visible = true;
  try { wgCaption?.('CIRCLING', 1500); } catch {}
}
function randomEventWhisper() {
  const pan = (Math.random() - 0.5) * 2;
  try { playClownLaugh(pan, 25); } catch {}
  try { wgCaption?.('WHISPER', 1200); } catch {}
}
function randomEventObjectDisturbance() {
  try { playTwigSnap(); } catch {}
  try { wgCaption?.('TWIG SNAP', 1000); } catch {}
}
function tickPlayerBehaviorTrackers(dt) {
  if (player.isSprinting) player.playerSprintTime += dt;
  if (player.isCrouching) player.playerCrouchTime += dt;
  if (!player.flashlightOn) player.flashlightOffTime += dt;
  let target = 0;
  if (player.playerCrouchTime > 5) target = Math.min(1, (player.playerCrouchTime - 5) / 12);
  if (player.flashlightOffTime > 8) target = Math.max(target, Math.min(1, (player.flashlightOffTime - 8) / 15));
  clownState.searchInterest += (target - clownState.searchInterest) * Math.min(1, dt * 0.5);
}

// =============================================================================
// CLOWN STATE MACHINE
// =============================================================================
function tickClown(dt) {
  // Player behavior trackers — bias HUNT-trigger and CHASE distance via these.
  tickPlayerBehaviorTrackers(dt);
  // Curve-aware phase entry.
  const huntFromCurve = totalElapsed > CLOWN_HUNT_AFTER || totalElapsed > CURVE_STALK_RAMP;
  const huntFromBehavior = clownState.ranAwayCount >= 3 || clownState.searchInterest > 0.7;
  const playerHuntStart = huntFromCurve || huntFromBehavior;
  const chaseAllowed = totalElapsed > CURVE_CHASE_ALLOW_AT || player.itemsFound >= ITEMS_TO_ESCAPE;
  const inQuietWindow = totalElapsed < CURVE_QUIET_UNTIL;

  // Compute basics.
  const dx = clownState.pos.x - player.pos.x;
  const dz = clownState.pos.z - player.pos.z;
  const dist = Math.hypot(dx, dz);
  const sees = playerCanSeeClown();
  // Cache lastSeenDist for HUD red-throb (Agent C reads clownState.lastSeenDist).
  if (sees && clownState.isVisible) {
    clownState.lastSeenDist = dist;
    clownState.lastSeenAt = now();
  } else {
    clownState.lastSeenDist = Math.min(999, clownState.lastSeenDist + dt * 6);
  }
  // Audio: pan + distance for breath/whispers (Agent B reacts).
  const screenAng = Math.atan2(dz, dx) - player.yaw;
  const panX = Math.sin(screenAng);
  updateClownDist(dist);
  // Heartbeat speeds up when clown is closer.
  setHeartbeat(Math.max(0.4, Math.min(1.8, 0.4 + (50 - Math.min(50, dist)) / 30)));

  // ---- Listen mode side-effect: dim flashlight while listening. ----
  if (player.isListening && flashlight && player.flashlightOn) {
    flashlight.intensity = Math.min(flashlight.intensity, FLASH_BASE_INTENSITY * 0.7);
  }

  // ---- AMBUSH overlay (post-item-pickup) ----
  // Independent of phase — keep the clown visible and stalking during the window.
  if (now() < clownState.ambushUntil && clownState.phase !== 'chase') {
    clownState.isVisible = true;
    clownSprite.visible = true;
    if (now() > clownState.ambushNextTickAt) {
      const a = Math.atan2(dz, dx) - player.yaw;
      try { playClownStep(Math.sin(a), dist); } catch {}
      clownState.ambushNextTickAt = now() + 1.5 + Math.random();
    }
  }

  // ---- Circle event (set up by randomEventCircle) ----
  if (clownState.circleEndAt && now() < clownState.circleEndAt) {
    clownState.circlePhase = (clownState.circlePhase || 0) + dt * 0.9;
    const cr = 25;
    clownState.pos.x = player.pos.x + Math.cos(clownState.circlePhase) * cr;
    clownState.pos.z = player.pos.z + Math.sin(clownState.circlePhase) * cr;
    clownState.isVisible = true;
    clownSprite.visible = true;
    // Sync sprite + early-return to avoid phase override.
    const _gy = groundY(clownState.pos.x, clownState.pos.z);
    clownSprite.position.set(clownState.pos.x, CLOWN_HEIGHT / 2 + _gy, clownState.pos.z);
    clownSprite.position.y += Math.sin(totalElapsed * 1.4) * 0.04;
    return;
  } else if (clownState.circleEndAt && now() >= clownState.circleEndAt) {
    clownState.circleEndAt = 0;
    if (clownState.phase !== 'chase') {
      clownState.isVisible = false;
      clownSprite.visible = false;
      clownState.fleeUntil = now() + 4;
    }
  }

  // ---- PHASE TRANSITIONS (curve-aware) ----
  if (clownState.phase === 'stalk' && playerHuntStart && !inQuietWindow) {
    clownState.phase = 'hunt';
    playHuntMusic();
    showSubtitle('Something is following you.', 5);
  }
  if (clownState.phase !== 'chase' && chaseAllowed &&
      dist < CLOWN_CHASE_TRIGGER && sees && clownState.isVisible) {
    clownState.phase = 'chase';
    playChaseMusic();
    showSubtitle('RUN.', 3);
  }
  if (clownState.phase === 'chase' && dist > CLOWN_CHASE_TRIGGER * 2.5 && !sees) {
    // Lost the player — back to hunt.
    clownState.phase = playerHuntStart ? 'hunt' : 'stalk';
    if (clownState.phase === 'hunt') playHuntMusic(); else playStalkMusic();
  }

  // ---- KILL ----
  if (dist < CLOWN_KILL_DIST && clownState.isVisible) {
    triggerKillCinematic();
    return;
  }

  // ---- PHASE BEHAVIOR (extended with Agent E variants) ----
  if (clownState.phase === 'stalk') {
    // STALK behavior with variants:
    //   • LINE-OF-SIGHT (30%) — peek spawns in player's view, brief glimpse
    //   • FAKE-OUT BEHIND (15%) — audio only, no sprite
    //   • TREE-PEEK / RING (rest) — original behavior
    if (clownState.isVisible) {
      const seeing = playerCanSeeClown();
      if (seeing) {
        clownState.isVisible = false;
        clownSprite.visible = false;
        clownState.fleeUntil = now() + 3 + Math.random() * 4;
        const ang = Math.random() * Math.PI * 2;
        const r = 50 + Math.random() * 30;
        clownState.pos.x = player.pos.x + Math.cos(ang) * r;
        clownState.pos.z = player.pos.z + Math.sin(ang) * r;
        // Only count "ran away" for non-fake-out variants.
        if (clownState.stalkVariant !== 'fake-out-behind' && clownState.lastPlayerCheckPos) {
          const lp = clownState.lastPlayerCheckPos;
          const movedAwayFromClown = Math.hypot(player.pos.x - lp.x, player.pos.z - lp.z) > 1.0;
          if (movedAwayFromClown) clownState.ranAwayCount++;
        }
        clownState.stalkVariant = null;
      }
      // Variant-specific time-out.
      const maxVisibleTime = clownState.stalkVariant === 'line-of-sight' ? 1.5 : 3.0;
      if (now() - clownState.visibleStartedAt > maxVisibleTime) {
        clownState.isVisible = false;
        clownSprite.visible = false;
        clownState.fleeUntil = now() + 5 + Math.random() * 6;
        clownState.stalkVariant = null;
      }
    } else if (now() > clownState.nextStalkEvent && now() > clownState.fleeUntil &&
               (!inQuietWindow || Math.random() < 0.3)) {
      // Pick a variant.
      const roll = Math.random();
      let cx, cz;
      let variant;
      if (roll < 0.15) {
        // FAKE-OUT BEHIND — laugh from behind, sprite stays hidden.
        variant = 'fake-out-behind';
        const backX = Math.sin(player.yaw), backZ = Math.cos(player.yaw);
        cx = player.pos.x + backX * 6; cz = player.pos.z + backZ * 6;
        clownState.pos.x = cx; clownState.pos.z = cz;
        const a = Math.atan2(cz - player.pos.z, cx - player.pos.x) - player.yaw;
        try { playClownLaugh(Math.sin(a), 6); } catch {}
        try { wgCaption?.('LAUGH BEHIND YOU', 1500); } catch {}
        clownState.stalkVariant = variant;
        clownState.lastStalkEvent = now();
        clownState.nextStalkEvent = now() + CLOWN_STALK_INTERVAL_MIN + Math.random() * (CLOWN_STALK_INTERVAL_MAX - CLOWN_STALK_INTERVAL_MIN);
        clownState.fleeUntil = now() + 4;
      } else {
        if (roll < 0.45) {
          // LINE-OF-SIGHT — directly in view, brief glimpse.
          variant = 'line-of-sight';
          const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
          const r = 18 + Math.random() * 14;
          cx = player.pos.x + fwdX * r + (Math.random() - 0.5) * 3;
          cz = player.pos.z + fwdZ * r + (Math.random() - 0.5) * 3;
        } else if (roll < 0.85) {
          // TREE-PEEK — behind a tree (original).
          variant = 'tree-peek';
          const candidates = [];
          for (let i = 0; i < treeData.length; i += 5) {
            const t = treeData[i];
            const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
            if (d > 18 && d < 32) candidates.push(t);
          }
          if (candidates.length) {
            const t = candidates[Math.floor(Math.random() * candidates.length)];
            const dxT = t.x - player.pos.x, dzT = t.z - player.pos.z;
            const dT = Math.hypot(dxT, dzT);
            cx = t.x + (dxT / dT) * 1.2;
            cz = t.z + (dzT / dT) * 1.2;
          } else {
            const ang = Math.random() * Math.PI * 2;
            const r = 20 + Math.random() * 15;
            cx = player.pos.x + Math.cos(ang) * r;
            cz = player.pos.z + Math.sin(ang) * r;
          }
        } else {
          // RING — random ring fallback.
          variant = 'ring';
          const ang = Math.random() * Math.PI * 2;
          const r = 22 + Math.random() * 13;
          cx = player.pos.x + Math.cos(ang) * r;
          cz = player.pos.z + Math.sin(ang) * r;
        }
        clownState.pos.x = cx;
        clownState.pos.z = cz;
        clownState.isVisible = true;
        clownSprite.visible = true;
        clownState.visibleStartedAt = now();
        clownState.lastPlayerCheckPos = { x: player.pos.x, z: player.pos.z };
        clownState.stalkVariant = variant;
        const a = Math.atan2(cz - player.pos.z, cx - player.pos.x) - player.yaw;
        const pan = Math.sin(a);
        const d = Math.hypot(cx - player.pos.x, cz - player.pos.z);
        if (Math.random() < 0.5) { playClownLaugh(pan, d); try { wgCaption?.('DISTANT LAUGH', 1400); } catch {} }
        else                     { playClownStep(pan, d);  try { wgCaption?.('FOOTSTEPS NEAR', 1400); } catch {} }
        clownState.lastStalkEvent = now();
        // Stalk frequency scales with search interest.
        const baseGap = CLOWN_STALK_INTERVAL_MIN + Math.random() * (CLOWN_STALK_INTERVAL_MAX - CLOWN_STALK_INTERVAL_MIN);
        const gap = baseGap * (1 - 0.35 * clownState.searchInterest);
        clownState.nextStalkEvent = now() + Math.max(8, gap);
      }
    }
  } else if (clownState.phase === 'hunt') {
    // HUNT behavior with Weeping Angel + Terror Peek + sprint bias.
    clownState.isVisible = true;
    clownSprite.visible = true;
    // Weeping Angel: freeze when player looks at the clown (~0.5s lock).
    if (sees && dist < 40) clownState.weepingAngelLockUntil = now() + 0.5;
    const frozen = now() < clownState.weepingAngelLockUntil;
    // Terror peek every 25-40s (faster when search interest is high).
    if (!frozen && !clownState.huntPeekActive && now() > clownState.nextHuntPeekAt) {
      const fwdX = -Math.sin(player.yaw), fwdZ = -Math.cos(player.yaw);
      const rightX = -fwdZ, rightZ = fwdX;
      const side = Math.random() < 0.5 ? 1 : -1;
      clownState.pos.x = player.pos.x + fwdX * 20 + rightX * side * -15;
      clownState.pos.z = player.pos.z + fwdZ * 20 + rightZ * side * -15;
      clownState.huntPeekActive = true;
      clownState.huntPeekStartedAt = now();
      clownState.huntPeekOrigin = {
        x: player.pos.x + fwdX * 20 + rightX * side * 15,
        z: player.pos.z + fwdZ * 20 + rightZ * side * 15,
      };
      try { wgCaption?.('SOMETHING IS WATCHING', 1200); } catch {}
    }
    if (clownState.huntPeekActive) {
      const tp = (now() - clownState.huntPeekStartedAt) / 0.8;
      if (tp >= 1) {
        clownState.huntPeekActive = false;
        const gap = (25 + Math.random() * 15) * (1 - 0.4 * clownState.searchInterest);
        clownState.nextHuntPeekAt = now() + Math.max(12, gap);
      } else if (clownState.huntPeekOrigin) {
        const ox = clownState.huntPeekOrigin.x;
        const oz = clownState.huntPeekOrigin.z;
        clownState.pos.x += (ox - clownState.pos.x) * Math.min(1, dt * 4);
        clownState.pos.z += (oz - clownState.pos.z) * Math.min(1, dt * 4);
      }
    } else if (!frozen) {
      // Sprint bias — clown closes faster if player has sprinted a lot.
      const sprintBias = Math.min(0.5, player.playerSprintTime * 0.02);
      moveClownToward(player.pos.x, player.pos.z, CLOWN_HUNT_SPEED * (1 + sprintBias), dt);
    }
    if (Math.random() < dt * 0.4) {
      const a = Math.atan2(dz, dx) - player.yaw;
      playClownStep(Math.sin(a), dist);
    }
    if (dist > 45 && now() - clownState.lastStalkEvent > CLOWN_TELEPORT_DELAY) {
      const ang = player.yaw + Math.PI + (Math.random() - 0.5) * 1.6;
      const r = 25 + Math.random() * 10 - clownState.searchInterest * 8;
      clownState.pos.x = player.pos.x + Math.cos(ang) * r;
      clownState.pos.z = player.pos.z + Math.sin(ang) * r;
      clownState.lastStalkEvent = now();
    }
  } else if (clownState.phase === 'chase') {
    // CHASE — predictable but unsettling weave; aggressive when on beacon run.
    clownState.isVisible = true;
    clownSprite.visible = true;
    clownState.chaseWeavePhase += dt * 2.0;
    const aggressive = player.itemsFound >= ITEMS_TO_ESCAPE;
    const speed = CLOWN_CHASE_SPEED * (aggressive ? 1.15 : 1.0);
    const perpX = -Math.cos(player.yaw), perpZ = Math.sin(player.yaw);
    const wob = Math.sin(clownState.chaseWeavePhase) * 1.3;
    const tx = player.pos.x + perpX * wob;
    const tz = player.pos.z + perpZ * wob;
    moveClownToward(tx, tz, speed, dt);
    if (Math.random() < dt * 1.2) {
      const a = Math.atan2(dz, dx) - player.yaw;
      playClownStep(Math.sin(a), dist);
    }
  }

  // ---- Sync sprite position to ground + ensure facing camera ----
  if (clownState.isVisible) {
    const gy = groundY(clownState.pos.x, clownState.pos.z);
    clownSprite.position.set(
      clownState.pos.x,
      CLOWN_HEIGHT / 2 + gy,
      clownState.pos.z
    );
    // Slight bob to feel "breathing" / shuffling weight.
    clownSprite.position.y += Math.sin(totalElapsed * 1.4) * 0.04;
  }
}

// Move clown toward a target world position. Clamps to world bounds.
function moveClownToward(tx, tz, speed, dt) {
  const dx = tx - clownState.pos.x;
  const dz = tz - clownState.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const step = speed * dt;
  const ux = dx / d, uz = dz / d;
  // Try the full step; if we'd hit a tree, slide around it.
  let cx = clownState.pos.x + ux * step;
  let cz = clownState.pos.z + uz * step;
  // Cheap clown collision: same as player but smaller radius.
  for (let i = 0; i < treeData.length; i++) {
    const t = treeData[i];
    const dx2 = t.x - cx, dz2 = t.z - cz;
    const distSq = dx2 * dx2 + dz2 * dz2;
    const trunkR = 0.4 * t.scale;
    const minD = 0.5 + trunkR;
    if (distSq < minD * minD && distSq > 0.0001) {
      const dd = Math.sqrt(distSq);
      cx = t.x + ((cx - t.x) / dd) * minD;
      cz = t.z + ((cz - t.z) / dd) * minD;
    }
  }
  clownState.pos.x = cx;
  clownState.pos.z = cz;
}

// =============================================================================
// LIGHTNING — multi-layer strobe (Agent B). Three flashes:
//   1) initial bright (90ms, 0.9 alpha)
//   2) 40-80ms later: dim re-strobe (60ms, 0.55 alpha)
//   3) 200-400ms later: lingering brighter quarter-second
// During the bright strobe we slam the fog density down to FOG_DENSITY_LIGHTNING
// so the player briefly sees further (terror reveal) and there's a 20% chance
// to silhouette the clown by ensuring its sprite is visible for the duration.
// =============================================================================
function triggerLightning() {
  // First bright strobe.
  flashEl.className = 'is-lightning';
  setTimeout(() => { flashEl.className = ''; }, 90);
  // Brief fog clearing — "see further" beat. tickAtmosphere honours this.
  lightningState.fogOverrideDensity = FOG_DENSITY_LIGHTNING;
  lightningState.fogOverrideUntil = now() + 0.10;
  // Possibly silhouette the clown during this flash.
  const silhouetteClown = Math.random() < 0.20;
  let priorClownVisible = null;
  if (silhouetteClown && typeof clownSprite !== 'undefined') {
    priorClownVisible = clownSprite.visible;
    clownSprite.visible = true;
    // Signal Agent E that the clown may "appear" at the edge of vision during
    // this flash. We only nudge a flag the clown state-machine can read; we
    // don't move the clown ourselves (that's Agent E's domain).
    if (typeof clownState !== 'undefined') {
      clownState.lightningRevealUntil = now() + 1.2;
    }
  }
  // Second dim re-strobe at 40-80ms.
  const reStrobeDelay = 40 + Math.random() * 40;
  setTimeout(() => {
    flashEl.className = 'is-lightning-dim';
    setTimeout(() => { flashEl.className = ''; }, 60);
  }, reStrobeDelay);
  // Lingering brighter quarter-second at 200-400ms.
  const lingerDelay = 200 + Math.random() * 200;
  setTimeout(() => {
    flashEl.className = 'is-lightning';
    setTimeout(() => {
      flashEl.className = '';
      // Restore prior clown visibility if we forced it on for the silhouette.
      if (silhouetteClown && priorClownVisible === false && typeof clownSprite !== 'undefined') {
        // Only revert if the clown hasn't legitimately become visible meanwhile.
        if (typeof clownState !== 'undefined' && !clownState.isVisible) {
          clownSprite.visible = false;
        }
      }
    }, 250);
  }, lingerDelay);
  playLightning();
}

// =============================================================================
// FLASHLIGHT (Agent B) — battery + sophisticated flicker model.
//   Frame tier: 95% subtle (0.95-1.05x), 4% notable dim (0.7-0.85x),
//               1% scary blink-out (0.0 for 50-150ms).
//   <30% battery: flicker chance doubles (so dim/blink probability ~10%).
//   <10% battery: full cutouts 1-3x per minute for 2-4s with screen darken.
//   Color: warms toward orange as battery drops (#ffd070 -> #ff8030).
//   Cone tightens slightly under 25% (focus-stab feel).
// =============================================================================
function tickFlashlight(dt) {
  if (!player.flashlightOn) {
    // Even when off, ease the screen darkening contribution back down.
    flashState.cutoutScreenAlpha = Math.max(0, flashState.cutoutScreenAlpha - dt * 2.0);
    applyCutoutOverlay();
    return;
  }
  // Battery drain.
  player.flashlightBattery = Math.max(0, player.flashlightBattery - FLASHLIGHT_DRAIN * dt);
  if (player.flashlightBattery <= 0) {
    player.flashlightOn = false;
    flashlight.visible = false;
    playFlashlight(false);
    showSubtitle('Flashlight is dead.', 4);
    return;
  }
  const bat01 = player.flashlightBattery / 100;
  const lowBat = bat01 < 0.30;
  const criticalBat = bat01 < 0.10;
  const t = now();

  // Schedule low-battery cutouts (only enter if not already cutting out).
  if (criticalBat) {
    if (flashState.nextCutOutAt === 0) {
      // First scheduling — 20-50s out so it doesn't fire instantly.
      flashState.nextCutOutAt = t + 20 + Math.random() * 30;
    }
    if (t > flashState.nextCutOutAt && t > flashState.cutOutUntil) {
      flashState.cutOutUntil = t + 2 + Math.random() * 2; // 2-4s cutout
      // Reschedule next: 1-3 per minute => 20-60s interval.
      flashState.nextCutOutAt = flashState.cutOutUntil + 20 + Math.random() * 40;
      try { audio?.playFlashlightFlicker?.(); } catch {}
    }
  } else {
    flashState.nextCutOutAt = 0;
  }

  // If we're inside a cutout window, hold dark with a faint flicker; bump
  // the screen-darkening overlay so the world dips a touch.
  if (t < flashState.cutOutUntil) {
    flashlight.intensity = 0.0;
    flashState.cutoutScreenAlpha = Math.min(0.45, flashState.cutoutScreenAlpha + dt * 4.0);
    applyCutoutOverlay();
    return;
  } else {
    flashState.cutoutScreenAlpha = Math.max(0, flashState.cutoutScreenAlpha - dt * 1.4);
    applyCutoutOverlay();
  }

  // If we're inside a scary blink-out, hold black for its duration.
  if (t < flashState.blinkOutUntil) {
    flashlight.intensity = 0.0;
    return;
  }

  // ---- Compute flicker tier ----
  // Base probabilities; doubled when below 30% battery.
  let pDim    = 0.04;
  let pBlink  = 0.01;
  if (lowBat) { pDim *= 2; pBlink *= 2; }
  const r = Math.random();
  let intensityMul;
  if (r < pBlink) {
    // Scary blink-out — 50-150ms at zero.
    flashState.blinkOutUntil = t + 0.050 + Math.random() * 0.100;
    intensityMul = 0.0;
    try { audio?.playFlashlightFlicker?.(); } catch {}
  } else if (r < pBlink + pDim) {
    // Notable dim — 0.7-0.85x for this frame.
    intensityMul = 0.70 + Math.random() * 0.15;
  } else {
    // Subtle 0.95-1.05x — the dominant case (~95%).
    intensityMul = 0.95 + Math.random() * 0.10;
  }
  flashlight.intensity = FLASH_BASE_INTENSITY * intensityMul;

  // ---- Color warm-up as battery drains ----
  // Lerp from baseColor at 100% to drainColor at ~10%.
  const lerpAmt = 1 - Math.max(0, Math.min(1, (bat01 - 0.10) / 0.90));
  flashState.colorCache.copy(flashState.baseColor).lerp(flashState.drainColor, lerpAmt);
  flashlight.color.copy(flashState.colorCache);

  // ---- Cone tightening at low battery ----
  // Tightens from FLASH_BASE_ANGLE down ~15% at <25% battery.
  const angleScale = bat01 < 0.25 ? 0.85 + (bat01 / 0.25) * 0.15 : 1.0;
  flashlight.angle = FLASH_BASE_ANGLE * angleScale;
}

// Apply cutout-overlay darkening to the existing flash element (reuses the
// HUD overlay so we don't add a new DOM node). Uses a dedicated CSS class
// so we don't clash with the lightning strobe.
function applyCutoutOverlay() {
  if (flashState.cutoutScreenAlpha > 0.01) {
    flashEl.classList.add('is-cutout');
    flashEl.style.setProperty('--cutout-alpha', flashState.cutoutScreenAlpha.toFixed(3));
  } else {
    flashEl.classList.remove('is-cutout');
    flashEl.style.removeProperty('--cutout-alpha');
  }
}

// =============================================================================
// ATMOSPHERE TICK (Agent B) — drives fog density oscillation, sky dawn-shift,
// wind sway, particles, and runs the lightning-fog override. Called from
// tickPlay() after the clown AI updates so we can read clownState.phase.
// =============================================================================
function tickAtmosphere(dt) {
  atmosphereFrame++;
  const t = now();
  // ---- Fog density ----
  // Default: slow sin oscillation between MIN and MAX over a 30s cycle.
  const breath = 0.5 + 0.5 * Math.sin(totalElapsed * (Math.PI * 2 / 30));
  let targetDensity = FOG_DENSITY_MIN + breath * (FOG_DENSITY_MAX - FOG_DENSITY_MIN);
  // Chase phase thickens the fog.
  if (typeof clownState !== 'undefined' && clownState.phase === 'chase') {
    targetDensity = FOG_DENSITY_CHASE;
  }
  // Near-dawn (all items collected): fog lifts slightly.
  if (player.itemsFound >= ITEMS_TO_ESCAPE) {
    targetDensity = Math.min(targetDensity, FOG_DENSITY_DAWN);
  }
  // Lightning override — punches density down for a single beat.
  if (t < lightningState.fogOverrideUntil) {
    targetDensity = lightningState.fogOverrideDensity;
  }
  // Smooth toward target so density changes don't pop.
  scene.fog.density += (targetDensity - scene.fog.density) * Math.min(1, dt * 1.5);

  // ---- Sky updates ----
  // Drift cloud silhouettes + redraw every ~250ms.
  for (const c of skyClouds) {
    c.x += c.speed * dt * 10;
  }
  syncSkyDawn();
  if (t > skyNextRedrawTs) {
    redrawSky();
    skyNextRedrawTs = t + 0.25;
  }

  // ---- Wind sway, particles, weather ----
  tickWind(dt, t);
  tickLeaves(dt, t);
  tickDust(dt);
  tickRain(dt, t);
  tickDriftingFog(dt);
}

// =============================================================================
// TIME-OF-NIGHT CLOCK — 0% just-started, 100% dawn (auto-win). 1%/30s default.
// Published to window.clownForestNightPct so Agent B can lift fog at 80% +
// brighten sky at 95%. At 100% triggers alternate "dawn" win cinematic.
// =============================================================================
let _nightDawnTriggered = false;
function tickNightClock(dt) {
  player.nightPercent = Math.min(NIGHT_DAWN_PCT,
    player.nightPercent + NIGHT_PERCENT_PER_SEC * 100 * dt);
  try {
    if (typeof window !== 'undefined') window.clownForestNightPct = player.nightPercent;
  } catch {}
  // Subtitles at key thresholds.
  if (player.nightPercent >= NIGHT_FOG_LIFT_PCT && !player._fogLiftAnnounced) {
    player._fogLiftAnnounced = true;
    showSubtitle('The fog is lifting...', 4);
  }
  if (player.nightPercent >= NIGHT_BRIGHTEN_PCT && !player._brightenAnnounced) {
    player._brightenAnnounced = true;
    showSubtitle('The sky is paling. Dawn is near.', 5);
  }
  // Alternate win at 100% — only if we haven't already escaped some other way.
  if (player.nightPercent >= NIGHT_DAWN_PCT && !_nightDawnTriggered && gameState === 'play') {
    _nightDawnTriggered = true;
    showSubtitle('Dawn breaks. The forest is empty.', 5);
    // Hide clown so the dawn moment is clean.
    if (clownSprite) { clownSprite.visible = false; clownState.isVisible = false; }
    setTimeout(() => { if (gameState === 'play') endGame('escape'); }, 1600);
  }
}

// =============================================================================
// HUD UPDATE — gated by deltas so we don't repaint every frame.
// =============================================================================
let lastStamPct = -1, lastBatPct = -1;
let _batStaticFlickerTo = 0;
let _batWarningNextAt = 0;
let _sanityLowState = false;
function tickHUD(dt) {
  const t = now();
  if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;

  // Subtitle / objective / warning / pause-hint auto-clear (Agent C).
  if (subtitleClearTo && t > subtitleClearTo) {
    subtitleEl.classList.remove('is-shown');
    subtitleClearTo = 0;
  }
  if (objectiveEl && objectiveClearTo && t > objectiveClearTo) {
    objectiveEl.classList.remove('is-shown');
    objectiveClearTo = 0;
  }
  if (warningEl && warningClearTo && t > warningClearTo) {
    warningEl.classList.remove('is-shown');
    warningClearTo = 0;
  }
  if (pauseHintEl && pauseHintClearTo && t > pauseHintClearTo) {
    pauseHintEl.classList.remove('is-shown');
    pauseHintClearTo = 0;
  }
  // Items badge auto-hide.
  if (itemsBadgeHideTo && t > itemsBadgeHideTo) {
    itemsBadge.classList.remove('is-shown');
    itemsBadgeHideTo = 0;
  }
  // Popups (slide-in stack).
  _tickPopups();

  // Stamina bar — show when actively sprinting or stamina < max.
  const stamPct = Math.round((player.stamina / STAMINA_MAX) * 100);
  if (stamPct !== lastStamPct) {
    staminaFill.style.width = stamPct + '%';
    lastStamPct = stamPct;
  }
  const showStam = player.isSprinting || player.stamina < STAMINA_MAX - 0.1;
  staminaBox.classList.toggle('is-shown', showStam);
  staminaBox.classList.toggle('is-low', stamPct < 30);
  staminaBox.classList.toggle('is-crit', stamPct < 20);
  if (vfxStamCrit) vfxStamCrit.classList.toggle('is-on', stamPct < 20);

  // Battery bar + percent.
  const batPct = Math.round(player.flashlightBattery);
  if (batPct !== lastBatPct) {
    if (batteryFill) batteryFill.style.width = batPct + '%';
    if (batteryN)    batteryN.textContent    = batPct + '%';
    lastBatPct = batPct;
  }
  batteryBox.classList.toggle('is-shown', player.flashlightOn);
  batteryBox.classList.toggle('is-low', batPct < 25);

  // Critical battery: corner electrical static + nag warning text.
  if (vfxBatStatic) {
    const crit = player.flashlightOn && batPct < 10;
    if (crit) {
      vfxBatStatic.classList.add('is-on');
      if (t > _batStaticFlickerTo) {
        const a = (0.3 + Math.random() * 0.55).toFixed(2);
        vfxBatStatic.style.setProperty('--static-alpha', a);
        _batStaticFlickerTo = t + 0.05 + Math.random() * 0.18;
      }
    } else {
      vfxBatStatic.classList.remove('is-on');
    }
  }
  if (player.flashlightOn && batPct < 10 && batPct > 0) {
    if (!_batWarningNextAt || t > _batWarningNextAt) {
      showWarning('BATTERY LOW', 2.8);
      _batWarningNextAt = t + 25;
    }
  } else if (batPct >= 15) {
    _batWarningNextAt = 0;
  }

  // Heart-rate + clown-proximity throb (VFX).
  const dxC = clownState.pos.x - player.pos.x;
  const dzC = clownState.pos.z - player.pos.z;
  const distC = Math.hypot(dxC, dzC);
  tickHeartRate(dt, distC);
  if (vfxHeartBreath) {
    const breathAlpha = Math.max(0, Math.min(0.55, (heartRate - 1.0) * 0.22));
    vfxHeartBreath.style.setProperty('--breath-alpha', breathAlpha.toFixed(3));
  }
  if (vfxThrob) {
    let throb = 0;
    const isHunting = clownState.phase === 'hunt' || clownState.phase === 'chase';
    if (isHunting && clownState.isVisible && distC < 8) {
      throb = Math.max(0, Math.min(0.9, (8 - distC) / 6.5));
    }
    vfxThrob.style.setProperty('--throb-alpha', throb.toFixed(3));
  }

  // Sanity-equivalent: chase phase or close-clown-with-dead-battery.
  const sanityLow =
    clownState.phase === 'chase' ||
    (player.flashlightBattery < 15 && distC < 25) ||
    (clownState.ranAwayCount >= 4 && distC < 30);
  if (sanityLow !== _sanityLowState) {
    _sanityLowState = sanityLow;
    document.body.classList.toggle('is-sanity-low', sanityLow);
  }

  // Crosshair + compass.
  tickCrosshair();
  tickCompass();
}

// =============================================================================
// RESIZE
// =============================================================================
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// First frame.
requestAnimationFrame(loop);

})(); // end async boot IIFE
