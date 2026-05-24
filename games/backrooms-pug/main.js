// THE BACKROOMS OF PUG — top-down stealth horror.
// Procedurally-generated noclip-out-of-reality levels. Three archetypes:
//   - Level 0 "Lobby" (yellow wallpaper, fluorescent buzz)
//   - Level 1 "Habitable Zone" (concrete warehouse + Hounds)
//   - Level 2 "Pipe Dreams" (steam corridors + Smilers)
// Mechanics: sanity meter, flashlight battery cone, multiple entity types,
// hum-buzz ambience, distance fog, big rooms + closets, varied stains.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug, drawMonsterPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { profileKey } from '../../src/shared/profile.js';
import { createSettingsMenu, caption } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'backrooms:muted' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'backrooms-pug', getControlsHelp: () => _isTouch
  ? 'JOYSTICK move · SNEAK / TORCH / SMOKE buttons (right) · find 5 cans, reach EXIT. Saved to your profile.'
  : 'WASD walk · SHIFT sneak · B flashlight · F smoke · find 5 cans, reach the EXIT. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
const TILE = 84;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ============================================================================
// LEVEL ARCHETYPES — palette + entity rules per "real" backrooms level.
// Each lobby variant offers 3 wallpaper tints — chosen per level for variety.
// ============================================================================
const LEVELS = {
  lobby: {
    name: 'LEVEL 0 · THE LOBBY',
    sub: 'Endless yellow hallways. Damp tan carpet. The hum never stops.',
    floor: '#b8a44a',
    floorAlt: '#a8964a',
    floorGrout: '#5a4a14',
    wall: '#7a6a20',
    wallLight: '#9a8a40',
    wallDark: '#4a3a10',
    fog: '#3a2f10',
    hum: 120,                // fluorescent buzz hz
    lightTint: '#fff0b4',
    stainTint: 'rgba(48,28,8,$A)',
    wallPattern: 'wallpaper',
    spawnHounds: 0,
    spawnSmilers: 0,
    spawnCrawlers: 0,
    spawnWhisperers: 0,
    monsterSpeed: 1.0,
    // Three wallpaper variants — picked per level
    wallpaperVariants: [
      { wall: '#7a6a20', light: '#9a8a40', dark: '#4a3a10', label: 'faded yellow' },
      { wall: '#7a7048', light: '#a09a68', dark: '#4a4628', label: 'water-stained beige' },
      { wall: '#5a6038', light: '#80885a', dark: '#2a3018', label: 'mold-streaked olive' },
    ],
  },
  warehouse: {
    name: 'LEVEL 1 · HABITABLE ZONE',
    sub: 'Concrete warehouse. Exposed beams. Something growls in the dark.',
    floor: '#5a534a',
    floorAlt: '#4a4338',
    floorGrout: '#1a1612',
    wall: '#3a342a',
    wallLight: '#5a5040',
    wallDark: '#1a1610',
    fog: '#1a1612',
    hum: 70,                 // deeper warehouse hum
    lightTint: '#ffb060',
    stainTint: 'rgba(20,10,4,$A)',
    wallPattern: 'concrete',
    spawnHounds: 2,
    spawnSmilers: 0,
    spawnCrawlers: 1,
    spawnWhisperers: 0,
    monsterSpeed: 1.15,
    wallpaperVariants: [
      { wall: '#3a342a', light: '#5a5040', dark: '#1a1610', label: 'gray concrete' },
      { wall: '#3a302c', light: '#5a4a3c', dark: '#1a140e', label: 'rust-stained' },
      { wall: '#2c322c', light: '#4a504a', dark: '#0e120e', label: 'mossy concrete' },
    ],
  },
  pipes: {
    name: 'LEVEL 2 · PIPE DREAMS',
    sub: 'Hissing pipes everywhere. Steam blocks vision. Watch the dark.',
    floor: '#3a4048',
    floorAlt: '#2c323a',
    floorGrout: '#0a0c10',
    wall: '#2a3038',
    wallLight: '#445060',
    wallDark: '#0a0e14',
    fog: '#0a0c12',
    hum: 90,
    lightTint: '#a8c0d0',
    stainTint: 'rgba(4,8,12,$A)',
    wallPattern: 'pipes',
    spawnHounds: 1,
    spawnSmilers: 2,
    spawnCrawlers: 1,
    spawnWhisperers: 1,
    monsterSpeed: 1.25,
    wallpaperVariants: [
      { wall: '#2a3038', light: '#445060', dark: '#0a0e14', label: 'cold steel' },
      { wall: '#2a3434', light: '#445858', dark: '#0a1010', label: 'verdigris' },
      { wall: '#2c2832', light: '#484058', dark: '#0c0a10', label: 'shadowed' },
    ],
  },
  // ===========================================================================
  // LEVEL 3 · THE VOID POOL — new archetype, completes the noclip chain.
  // Deep cyan/black; bioluminescent strips on the walls; everything moves
  // faster. Most-dangerous spawn mix.
  // ===========================================================================
  voidpool: {
    name: 'LEVEL 3 · THE VOID POOL',
    sub: 'Cold inky water laps at your paws. Things swim under the floor.',
    floor: '#0a1820',
    floorAlt: '#0a1418',
    floorGrout: '#020608',
    wall: '#0e1e2a',
    wallLight: '#1a3a50',
    wallDark: '#020608',
    fog: '#02060a',
    hum: 55,                     // ultra-deep submarine throb
    lightTint: '#48d8ff',
    stainTint: 'rgba(0,12,20,$A)',
    wallPattern: 'concrete',
    spawnHounds: 2,
    spawnSmilers: 2,
    spawnCrawlers: 2,
    spawnWhisperers: 1,
    monsterSpeed: 1.4,
    wallpaperVariants: [
      { wall: '#0e1e2a', light: '#1a3a50', dark: '#020608', label: 'ink' },
      { wall: '#0a141c', light: '#1a3848', dark: '#020608', label: 'rust on black' },
      { wall: '#0c1c1c', light: '#1a4040', dark: '#020608', label: 'oxide' },
    ],
  },
};
// Cycle through archetypes as the player chains noclip-jumps. Order chosen for
// escalating dread — lobby's the soft start, voidpool the worst. After running
// out, wraps but keeps monster scaling climbing (see monsterScaleFor()).
const ARCHETYPE_CYCLE = ['lobby', 'warehouse', 'pipes', 'voidpool'];
function levelArchetypeFor(lvl) {
  // lvl 1 → lobby, lvl 2 → warehouse, lvl 3 → pipes, lvl 4 → voidpool, lvl 5+ → wraps
  const idx = (Math.max(1, lvl) - 1) % ARCHETYPE_CYCLE.length;
  return ARCHETYPE_CYCLE[idx];
}
// Per-level monster scaling. >1.0 means monsters move faster and spawn more.
// Caps at 2.0 to keep runs theoretically winnable.
function monsterScaleFor(lvl) {
  return Math.min(2.0, 1.0 + (lvl - 1) * 0.10);
}

// ============================================================================
// LORE NOTES — 30 cryptic Backrooms-canon style fragments. The player can
// find at most NOTE_TOTAL across all runs (their personal "codex"). Each note
// has a stable id (its index in the array) so the persistence layer can dedupe.
// ============================================================================
const LORE_NOTES = [
  "Day 47. The smell of mildew has stopped registering. I think I'm becoming one of them.",
  "If you see a hallway you've already walked through but the wallpaper is yellower — turn back. That's not the same hall.",
  "The hum is in B-flat. It has always been in B-flat. I don't think it's coming from the lights.",
  "Found a vending machine. The cans were already open. I drank one anyway.",
  "Whoever wrote 'NOT THE EXIT' on this wall — bless you. I would have walked right in.",
  "I haven't slept. I haven't been tired. I haven't been anything for a while now.",
  "The Smilers don't actually smile. They're just trying to remember what teeth were for.",
  "Three hounds in the warehouse. They circle but don't enter the lit squares. Stay under the lights.",
  "Found Marcus's flashlight. Marcus is not with the flashlight.",
  "Almond water tastes like nothing. It IS nothing. Drink it anyway. It works.",
  "The pipes never end. I followed one for what felt like a day. It went back to where it started, then kept going.",
  "If you noclip again you reach a place worse than this. There is no level for which 'worse' does not have a meaning.",
  "I drew a map. I came back the next day. The map didn't match. Drew a new one. Same result.",
  "Avoid the corners. Anything that's been in a corner long enough becomes a corner.",
  "The Whisperer doesn't whisper to you. It whispers to itself, about you. Don't listen in.",
  "Crawlers won't lunge if you don't break the line of sight. They want you to look away.",
  "I think the carpet is digesting me. Very slowly. I have stopped checking my paws.",
  "Found a door. Opened it. Closed it. Opened it again. Different room. Closed it. Walked away.",
  "Sometimes the lights go out and you can hear your own footsteps from a few seconds ago.",
  "The lobby is not the start. The lobby is just the part we're allowed to remember.",
  "Steam vents in Level 2 mean nothing. The steam is for us, not the monsters. So we don't see.",
  "Wrote my name on the wall. Came back later. The name had drifted three tiles to the left.",
  "If you find a note that isn't mine, please leave it for whoever comes next.",
  "The Void Pool isn't a pool. It's what's under all the other floors when you stop being polite about it.",
  "The thing that chases you is not the worst thing here. It's just the loudest.",
  "Found a calendar. Every page said TUESDAY. I tore them all out. I don't know what day it is.",
  "Don't trust the exits with green light. Trust the ones with no light at all.",
  "I dreamed of grass yesterday. I think I dreamed it. I'm not sure I knew what grass was anymore.",
  "Sanity is a battery. You keep finding sockets but never the wall.",
  "I am going to noclip out. If you find this, don't follow. There is no out.",
];
const NOTE_TOTAL = LORE_NOTES.length;
const NOTES_KEY = 'backrooms-pug:notes';
function loadNotesFound() {
  try {
    const raw = localStorage.getItem(profileKey(NOTES_KEY));
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}
function saveNotesFound(map) {
  try { localStorage.setItem(profileKey(NOTES_KEY), JSON.stringify(map)); } catch {}
}
function markNoteFound(id) {
  const m = loadNotesFound();
  if (m[id]) return false;
  m[id] = 1;
  saveNotesFound(m);
  return true;
}
function notesFoundCount() {
  return Object.keys(loadNotesFound()).length;
}

// ============================================================================
// State
// ============================================================================
let cols = 0, rows = 0;
let grid = [];
let pug, monster, cans, exitTile, level, soundLevel, running, cam, monsterChaseT;
let archetype = 'lobby';      // current LEVELS key
let LV = LEVELS.lobby;        // current LEVELS entry shortcut
let entities = [];            // {kind:'hound'|'smiler', x,y, vx,vy, state, t, ...}
let steamVents = [];          // {x,y,t,phase}  for "pipes" archetype
let pillars = [];             // {x,y} center pillar in big rooms
let items = [];               // {x,y,type:'flashlight'|'smoke'|'battery'}
let hideSpots = [];           // {x,y,r,kind}
let flashlightOn = false;     // toggle (B key / button)
let battery = 0;              // 0..100
let sanity = 100;             // 0..100
let lastSanityTick = 0;       // for tick rate-limit on sounds
let smokeBombs = [];          // {x,y,t,life}
let monsterDazedT = 0;
let pugFaceX = 1, pugFaceY = 0;  // unit vec for flashlight cone direction
const keys = new Set();
let smokeCount = 0;
// Juice + visuals
let popups = [];
let shakeT = 0, shakeMag = 0;
let hitFlashT = 0;
let chaseVignetteT = 0;
let lightFlicker = 0;
let wallStains = [];
let monsterWiggle = 0;
let firstSeenScreamed = false;
let heartBeatT = 0;           // accumulator for heart-beat sfx
let humOsc = null;            // persistent fluorescent buzz (web audio)
let humGain = null;
let humSilenceUntil = 0;      // time (performance.now/1000) until which hum is muted
// JUMP SCARE state ----------------------------------------------------------
let jumpScareT = 0;           // seconds remaining on current jump-scare overlay (full)
let jumpScareLife = 0;        // total seconds the current jump-scare runs (for fade math)
let jumpScareKind = null;     // 'monster' | 'hound' | 'smiler' | 'ambient'
let jumpScareCooldown = 0;    // seconds remaining of "no real jumpscare" cooldown
let redFlashT = 0;            // seconds remaining of red full-screen flash overlay
let lastHoundSeenIds = new Set(); // hound entity refs that have triggered first-sight
let firstHoundJump = false;   // first hound-jumpscare per match
let lastSmilerJumpAt = -999;  // last time we fired smiler jump-scare (gameTime)
let gameTime = 0;             // total seconds elapsed in current run
let nextAmbientAt = 999999;   // scheduled time for next ambient fake scare
let ambientEvent = null;      // { x, y, t, life } silhouette doorway
let nextDoorSlamAt = 999999;  // scheduled time for next far-off door slam
let nextWhisperAt = 999999;   // next whisper sfx time
let breathT = 0;              // accumulator for pug breathing sfx
// MAP-EXPANSION state -------------------------------------------------------
let furniture = [];           // {x,y,kind} small in-cell obstacles (lamp, box, chair) — break sightline
let bloodStains = [];         // {x,y,r} cosmetic floor blots
let doorways = [];            // {x,y} cells flagged as a doorway (drawn with darker frame)
let bigCeilingLights = [];    // {x,y,offT,nextOff,offDur} flickering lights (every 5th tile)
let triggerTiles = [];        // {tx,ty,fired,kind} invisible jumpscare triggers
let lastTriggerScareAt = -999;// gameTime of last trigger-scare (cooldown gate)
let activeTriggerScare = null;// { kind, t, life }
let currentWallpaper = null;  // chosen wallpaper variant for this level
// MONSTER-STUCK detection ---------------------------------------------------
let monsterStuckT = 0;        // seconds monster has been inside a wall
let monsterStuckPos = { x: 0, y: 0 }; // position used to test "not moved" stuck
let monsterStuckPosT = 0;     // seconds since monsterStuckPos updated
// HORROR MUSIC --------------------------------------------------------------
let musicNodes = null;        // { droneA, droneB, droneGain, proxOscA, proxOscB, proxGain }
let nextPianoAt = 999999;
let nextScrapeAt = 999999;
// NOCLIP TRANSITION (chain-progression cinematic) ----------------------------
const NOCLIP_TRANSITION_DUR = 1.6; // total seconds the full-screen flash runs
let noclipTransitionT = 0;       // counts DOWN from NOCLIP_TRANSITION_DUR
let noclipFromLabel = '';        // "LEVEL 0 · THE LOBBY"
let noclipToLabel = '';          // "LEVEL 1 · HABITABLE ZONE"
let noclipsChained = 0;          // total chain-jumps in this run (for end stats)
let noclipSwapped = false;       // true once we've actually swapped to the new level mid-transition
// LORE NOTES (collectibles) --------------------------------------------------
let noteCollectibles = [];       // {x, y, id} in-world notes for current level
let activeNoteText = null;       // string currently shown in the modal, null if closed
// Round 2C: parchment-unfold animation timer (counts UP from 0 to 0.45 when
// note opens; scales the paper card from a tight folded form to full open).
let noteUnfoldT = 0;
// Round 2C: monster-catch slow-mo / zoom timer. When set, render() does a
// brief camera zoom-in toward the monster and the main loop slows world dt.
let catchSlowmoT = 0;
// Round 2C: sanity-drop iris-pulse — set when sanity drops 5+ in a single tick
let sanityPulseT = 0;
let lastSanity = 100;
// Round 2C: smoke deploy darken timer (extra atmospheric screen-darken)
let smokeDarkenT = 0;

function shake(mag, dur) { const k = _shakeMul(); shakeMag = Math.max(shakeMag, mag * k); shakeT = Math.max(shakeT, dur); }
function pop(x, y, text, color) {
  if (popups.length > 60) popups.shift();
  // Round 2C: lateral spawn velocity so popups don't stack on each other
  popups.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -50, life: 0, max: 0.9, text, color: color || '#5ef38c' });
}
function nowSec() { return performance.now() / 1000; }
function silenceHum(durSec) { humSilenceUntil = Math.max(humSilenceUntil, nowSec() + durSec); }

// ============================================================================
// JUMP SCARE — full-screen face + scream + shake + silence + sanity hit.
// `kind` ∈ 'monster' | 'hound' | 'smiler' | 'ambient'.
// `ambient` is the fake scare (no damage, bypasses cooldown).
// ============================================================================
function jumpScare(kind) {
  if (!running) return;
  const ambient = kind === 'ambient';
  if (!ambient && jumpScareCooldown > 0) return;
  if (!ambient) jumpScareCooldown = 30;
  jumpScareKind = kind;
  jumpScareLife = ambient ? 0.45 : 1.0;     // total visible duration
  jumpScareT = jumpScareLife;
  redFlashT = ambient ? 0.0 : 0.2;          // ambient = no red flash
  if (!ambient) {
    shake(15, 0.35);
    sanity = Math.max(0, sanity - 25);
    silenceHum(1.0);
    // Caption + SR live-region for the audio cue. Per-kind copy so screen
    // readers / captioned players know which entity caught them.
    const label = kind === 'hound' ? 'HOUND SCREAM'
                : kind === 'smiler' ? 'SMILER SCREAM'
                : kind === 'monster' ? 'MONSTER SCREAM' : 'SCREAM';
    try { caption('[' + label + ']', 1400); } catch {}
    // Layered scream: pitch sweep + mid-noise burst + sub-bass thump
    try {
      sfx.sweep(900, 200, 'sawtooth', 0.3, 0.45);
      sfx.tone(600, 'square', 0.18, 0.25);
      sfx.noise(0.18, 0.30, 400);
      sfx.tone(60, 'sine', 0.45, 0.50);     // sub-bass thump
      // Second-layer detuned shriek for grit
      setTimeout(() => running && sfx.sweep(720, 160, 'square', 0.22, 0.22), 40);
    } catch {}
  } else {
    // Ambient = soft sting (single short tone), no damage
    try {
      sfx.tone(180, 'sine', 0.18, 0.20);
      sfx.sweep(380, 220, 'sine', 0.18, 0.10);
    } catch {}
    try { caption('[DISTANT NOISE]', 1100); } catch {}
    shake(3, 0.12);
  }
}

// Fire one of 4 trigger-tile jumpscares. Always plays sfx + screen shake;
// the visual layer is drawn from render() based on activeTriggerScare state.
function fireTriggerScare(kind) {
  activeTriggerScare = { kind, t: 0, life: 1.2 };
  shake(10, 0.4);
  sanity = Math.max(0, sanity - 8);
  silenceHum(0.5);
  try {
    if (kind === 'mirror') {
      // High-pitched piercing shriek + sub thump
      sfx.sweep(1200, 320, 'sawtooth', 0.34, 0.45);
      sfx.tone(60, 'sine', 0.45, 0.45);
      caption('[MIRROR SHRIEK]', 1300);
    } else if (kind === 'hand') {
      // Skitter — fast filtered noise
      sfx.noise(0.18, 0.4, 800);
      sfx.tone(120, 'sine', 0.3, 0.35);
      caption('[SKITTERING HANDS]', 1300);
    } else if (kind === 'shadow') {
      // Single piercing shriek
      sfx.sweep(1400, 600, 'square', 0.4, 0.35);
      caption('[SHADOW SHRIEK]', 1300);
    } else if (kind === 'whisper') {
      // Loud whisper — short noise pop with low filter sweep, no visual
      sfx.noise(0.22, 0.35, 200);
      sfx.tone(220, 'sine', 0.5, 0.3);
      shake(18, 0.5);
      caption('[LOUD WHISPER]', 1400);
    }
  } catch {}
}

function scheduleAmbient() {
  nextAmbientAt = gameTime + 90 + Math.random() * 90;
}
function scheduleDoorSlam() {
  nextDoorSlamAt = gameTime + 30 + Math.random() * 30;
}
function scheduleWhisper() {
  nextWhisperAt = gameTime + 6 + Math.random() * 9;
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  // Lore-note modal — any key closes it. Block other actions while open.
  if (activeNoteText) {
    activeNoteText = null;
    return;
  }
  if (k === 'f' && smokeCount > 0 && running) {
    smokeCount--;
    smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 4 });
    monsterDazedT = 4;
    sfx.tone(330, 'sawtooth', 0.3, 0.22);
    // Round 2C: denser smoke + brief screen-darken pulse on deploy
    sfx.noise(0.22, 0.3, 600);
    smokeDarkenT = 0.7;
    shake(3, 0.18);
  }
  if (k === 'b' && running) toggleFlashlight();
});
// Mouse click also dismisses the lore-note modal.
canvas.addEventListener('mousedown', () => {
  if (activeNoteText) activeNoteText = null;
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function toggleFlashlight() {
  if (battery <= 0) {
    flashlightOn = false;
    pop(pug.x, pug.y - 18, 'DEAD BATTERY', '#ff3a3a');
    sfx.tone(120, 'square', 0.06, 0.12);
    return;
  }
  flashlightOn = !flashlightOn;
  sfx.tone(flashlightOn ? 880 : 440, 'square', 0.04, 0.14);
  pop(pug.x, pug.y - 18, flashlightOn ? 'LIGHT ON' : 'LIGHT OFF', '#ffd23f');
}

// ----- Touch controls — uses the shared mobile-controls module --------------
// D-pad on the left synthesises WASD/arrow keys; action buttons on the right
// trigger the same handlers the keyboard already does. SHIFT is read via keys
// (already wired) so SNEAK is purely synth-key. LIGHT and SMOKE fire direct
// callbacks (no keyboard equivalents in this game).
let touchSneak = false;
createMobileControls({
  layout: 'dpad-buttons',
  keys, // share the same Set so synth keys reflect into game state
  onButton: (id, pressed) => {
    if (id === 'light' && pressed && running) toggleFlashlight();
    if (id === 'smoke' && pressed && smokeCount > 0 && running) {
      smokeCount--;
      smokeBombs.push({ x: pug.x, y: pug.y, t: 0, life: 4 });
      monsterDazedT = 4;
      sfx.tone(330, 'sawtooth', 0.3, 0.22);
      // Round 2C: matched effect on mobile smoke deploy
      sfx.noise(0.22, 0.3, 600);
      smokeDarkenT = 0.7;
      shake(3, 0.18);
    }
    if (id === 'sneak') touchSneak = pressed;
  },
  buttons: [
    { id: 'light', label: 'LIGHT' },
    { id: 'sneak', label: 'SNEAK', key: 'Shift' },
    { id: 'smoke', label: 'SMOKE' },
  ],
});

// ============================================================================
// Maze generation (recursive backtracker + big rooms + closets + extras)
// ============================================================================
function carveRoom(cx, cy, w, h) {
  for (let y = cy; y < cy + h; y++)
    for (let x = cx; x < cx + w; x++)
      if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) grid[y][x] = 0;
}
function genLevel(lvl) {
  archetype = levelArchetypeFor(lvl);
  LV = LEVELS[archetype];
  // Choose a wallpaper variant per level (rotates through the 3 per-archetype).
  if (LV.wallpaperVariants && LV.wallpaperVariants.length) {
    const variantIdx = (lvl + Math.floor(Math.random() * 3)) % LV.wallpaperVariants.length;
    currentWallpaper = LV.wallpaperVariants[variantIdx];
  } else {
    currentWallpaper = null;
  }
  cols = 28 + Math.min(lvl, 8) * 2;
  rows = 18 + Math.min(lvl, 8);
  grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  // 1) Recursive backtracker on odd cells
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
  // 2) Knock out random extra walls for openness
  for (let i = 0; i < cols * rows / 8; i++) {
    const x = 1 + Math.floor(Math.random() * (cols - 2));
    const y = 1 + Math.floor(Math.random() * (rows - 2));
    grid[y][x] = 0;
  }
  // 3) Big rooms (2..3 per level) — 3x3 / 4x3 with a center pillar
  pillars = [];
  const nRooms = 2 + Math.floor(Math.random() * 2);
  for (let r = 0; r < nRooms; r++) {
    const rw = 3 + Math.floor(Math.random() * 2);
    const rh = 3;
    const rx = 2 + Math.floor(Math.random() * (cols - rw - 4));
    const ry = 2 + Math.floor(Math.random() * (rows - rh - 4));
    carveRoom(rx, ry, rw, rh);
    // central pillar (turn one inner tile into wall)
    const px = rx + Math.floor(rw / 2);
    const py = ry + Math.floor(rh / 2);
    grid[py][px] = 1;
    pillars.push({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 });
  }
  // 4) Closets — 1x1 pockets containing a guaranteed item
  const closetSlots = [];
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    for (let tries = 0; tries < 40; tries++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 4));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
      if (grid[ty][tx] === 1) {
        // it must be adjacent to exactly one open tile (a true pocket-like spot)
        const nbrs = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) =>
          grid[ty+dy] && grid[ty+dy][tx+dx] === 0);
        if (nbrs.length >= 1) {
          grid[ty][tx] = 0;
          closetSlots.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
          break;
        }
      }
    }
  }
  // 4b) NOOK ROOMS — 2x2 dead-end pockets containing a high-value can/item.
  const nookSlots = [];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 5));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
      // Require all 4 cells be wall + adjacent open cell exists
      let allWall = true;
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          if (grid[ty + dy][tx + dx] !== 1) { allWall = false; break; }
      if (!allWall) continue;
      const adj = [[2,0],[-1,0],[2,1],[-1,1],[0,2],[1,2],[0,-1],[1,-1]];
      let hasAdj = false;
      for (const [dx, dy] of adj) {
        if (grid[ty + dy] && grid[ty + dy][tx + dx] === 0) { hasAdj = true; break; }
      }
      if (!hasAdj) continue;
      carveRoom(tx, ty, 2, 2);
      nookSlots.push({ x: tx * TILE + TILE, y: ty * TILE + TILE });
      break;
    }
  }
  // 4c) HALLWAY SEGMENTS — 1-tile-wide straight corridors (4-7 tiles long).
  const nHalls = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < nHalls; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const horiz = Math.random() < 0.5;
      const length = 4 + Math.floor(Math.random() * 4);
      const tx = 2 + Math.floor(Math.random() * (cols - length - 4));
      const ty = 2 + Math.floor(Math.random() * (rows - length - 4));
      let ok = true;
      // require start and end adjacent to existing open tiles (connect-up)
      const ex = horiz ? tx + length - 1 : tx;
      const ey = horiz ? ty : ty + length - 1;
      const startOpen = (grid[ty] && grid[ty][tx - (horiz ? 1 : 0)] === 0) ||
                        (grid[ty - (horiz ? 0 : 1)] && grid[ty - (horiz ? 0 : 1)][tx] === 0);
      const endOpen = (grid[ey] && grid[ey][ex + (horiz ? 1 : 0)] === 0) ||
                      (grid[ey + (horiz ? 0 : 1)] && grid[ey + (horiz ? 0 : 1)][ex] === 0);
      if (!startOpen && !endOpen) ok = false;
      if (!ok) continue;
      if (horiz) for (let k = 0; k < length; k++) grid[ty][tx + k] = 0;
      else for (let k = 0; k < length; k++) grid[ty + k][tx] = 0;
      break;
    }
  }
  // Place pug at (1,1)
  pug = { x: 1.5 * TILE, y: 1.5 * TILE };
  pugFaceX = 1; pugFaceY = 0;
  // Place monster far away — find a guaranteed-open tile in the far quadrant.
  // Critical: avoid the bottom-right corner cell (which is often walled in)
  // because the monster could land inside a wall and never escape.
  const monsterSpawn = findFarOpenTile(1, 1);
  monster = {
    x: monsterSpawn.x, y: monsterSpawn.y,
    vx: 0, vy: 0, sees: false, chase: false,
    lastSeenX: 0, lastSeenY: 0,
    spawnX: monsterSpawn.x, spawnY: monsterSpawn.y,
    wanderTarget: null,
  };
  monsterStuckT = 0;
  monsterStuckPos = { x: monsterSpawn.x, y: monsterSpawn.y };
  monsterStuckPosT = 0;
  // Cans (5) — drop one into a nook room if any exist for "reward room" feel
  cans = [];
  if (nookSlots.length) cans.push({ x: nookSlots[0].x, y: nookSlots[0].y });
  for (let i = cans.length; i < 5; i++) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 6) {
        cans.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
        break;
      }
    }
  }
  exitTile = { x: (cols - 2) * TILE + TILE / 2, y: (rows - 2) * TILE + TILE / 2 };
  soundLevel = 0; monsterChaseT = 0;
  // Items: 1 flashlight + 2 smoke + 1 battery + closet items
  items = []; smokeBombs = []; monsterDazedT = 0;
  // Closet contents (guaranteed)
  closetSlots.forEach((c, i) => {
    const types = ['battery', 'smoke', 'flashlight', 'battery'];
    items.push({ x: c.x, y: c.y, type: types[i % types.length] });
  });
  for (const t of ['flashlight', 'smoke', 'smoke', 'battery']) {
    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 5) {
        items.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, type: t });
        break;
      }
    }
  }
  // Hide spots: 3 per level (furniture)
  hideSpots = [];
  const furnitureKinds = archetype === 'pipes' ? ['vending', 'vending', 'chair'] :
    archetype === 'warehouse' ? ['vending', 'chair', 'chair'] :
    ['chair', 'sofa', 'vending'];
  for (let i = 0; i < 3; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 0) {
        hideSpots.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, r: 22, kind: furnitureKinds[i % furnitureKinds.length] });
        break;
      }
    }
  }
  // Wall stains (decorative)
  wallStains = [];
  for (let i = 0; i < 18 + lvl * 2; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] === 1) {
        wallStains.push({
          x: tx * TILE + Math.random() * TILE,
          y: ty * TILE + Math.random() * TILE,
          r: 4 + Math.random() * 8,
          a: 0.15 + Math.random() * 0.25,
        });
        break;
      }
    }
  }
  // Steam vents (only pipes archetype) — periodic blocking puffs
  steamVents = [];
  if (archetype === 'pipes') {
    for (let i = 0; i < 6; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const tx = 1 + Math.floor(Math.random() * (cols - 2));
        const ty = 1 + Math.floor(Math.random() * (rows - 2));
        if (grid[ty][tx] === 1) {
          steamVents.push({
            x: tx * TILE + TILE / 2,
            y: ty * TILE + TILE / 2,
            t: Math.random() * 5,
            phase: 2 + Math.random() * 3, // seconds between bursts
          });
          break;
        }
      }
    }
  }
  // Entities per archetype — original types + new (Crawler/Whisperer)
  entities = [];
  for (let i = 0; i < LV.spawnHounds; i++) spawnEntity('hound');
  for (let i = 0; i < LV.spawnSmilers; i++) spawnEntity('smiler');
  // New monster types — spawn with lower weight than existing types. Roll per-slot.
  for (let i = 0; i < (LV.spawnCrawlers || 0); i++) {
    if (Math.random() < 0.7) spawnEntity('crawler');
  }
  for (let i = 0; i < (LV.spawnWhisperers || 0); i++) {
    if (Math.random() < 0.6) spawnEntity('whisperer');
  }
  // Higher-floor bonus: a small chance of an extra Crawler on level 5+
  if (lvl >= 5 && Math.random() < 0.5) spawnEntity('crawler');
  // ---- FURNITURE (small obstacles — break sightline, walk past) ----
  furniture = [];
  const furnCount = 8 + Math.floor(lvl * 1.5);
  const furnKinds = ['lamp', 'box', 'chair_small'];
  for (let i = 0; i < furnCount; i++) {
    for (let tries = 0; tries < 30; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      // Don't sit ON the player spawn or exit
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 2) continue;
      if (exitTile && Math.hypot(wx - exitTile.x, wy - exitTile.y) < TILE) continue;
      furniture.push({ x: wx, y: wy, kind: furnKinds[Math.floor(Math.random() * furnKinds.length)] });
      break;
    }
  }
  // ---- BLOOD STAINS (cosmetic floor blots) ----
  bloodStains = [];
  for (let i = 0; i < 4 + lvl; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      bloodStains.push({
        x: tx * TILE + Math.random() * TILE,
        y: ty * TILE + Math.random() * TILE,
        r: 6 + Math.random() * 10,
      });
      break;
    }
  }
  // ---- DOORWAYS (open tiles bordered by walls on two opposite sides) ----
  doorways = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] !== 0) continue;
      const wL = grid[y][x - 1] === 1, wR = grid[y][x + 1] === 1;
      const wU = grid[y - 1][x] === 1, wD = grid[y + 1][x] === 1;
      if ((wL && wR && !wU && !wD) || (wU && wD && !wL && !wR)) {
        if (Math.random() < 0.45) doorways.push({ x, y, vertical: wL && wR });
      }
    }
  }
  // ---- BIG CEILING LIGHTS (every 5th tile) with flicker timing ----
  bigCeilingLights = [];
  for (let y = 2; y < rows - 1; y += 5) {
    for (let x = 2; x < cols - 1; x += 5) {
      if (grid[y][x] === 0) {
        bigCeilingLights.push({
          x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
          offT: 0, nextOff: 4 + Math.random() * 8, offDur: 0.25 + Math.random() * 0.2,
        });
      }
    }
  }
  // ---- TRIGGER TILES (2-4 invisible jumpscare triggers per level) ----
  triggerTiles = [];
  const triggerKinds = ['mirror', 'hand', 'shadow', 'whisper'];
  const nTriggers = 2 + Math.floor(Math.random() * 3); // 2..4
  for (let i = 0; i < nTriggers; i++) {
    for (let tries = 0; tries < 40; tries++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 4));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
      if (grid[ty][tx] !== 0) continue;
      // Far enough from spawn the player has to walk to reach it
      if (Math.abs(tx - 1) + Math.abs(ty - 1) < 6) continue;
      // Don't double-stack
      if (triggerTiles.some(t => t.tx === tx && t.ty === ty)) continue;
      triggerTiles.push({
        tx, ty, fired: false,
        kind: triggerKinds[Math.floor(Math.random() * triggerKinds.length)],
      });
      break;
    }
  }
  // Reset active trigger scare state
  activeTriggerScare = null;
  popups = []; shakeT = 0; shakeMag = 0; hitFlashT = 0; chaseVignetteT = 0;
  noteUnfoldT = 0; catchSlowmoT = 0; sanityPulseT = 0; smokeDarkenT = 0; lastSanity = 100;
  firstSeenScreamed = false;
  cam = { x: pug.x, y: pug.y };
  // Sanity restored on entering a new level (gentle)
  sanity = Math.min(100, sanity + 15);
  // Battery preserved across levels but topped up slightly each level
  if (battery < 30) battery = Math.min(100, battery + 25);
  // ---- LORE NOTES (1-2 per level) — spawn id picked from undiscovered pool
  // when possible, otherwise random from full pool so a "completist" player
  // still sees notes (re-read on the modal will just re-show).
  noteCollectibles = [];
  const found = loadNotesFound();
  const undiscovered = [];
  for (let i = 0; i < NOTE_TOTAL; i++) if (!found[i]) undiscovered.push(i);
  const noteCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < noteCount; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 3) continue;
      const id = undiscovered.length
        ? undiscovered.splice(Math.floor(Math.random() * undiscovered.length), 1)[0]
        : Math.floor(Math.random() * NOTE_TOTAL);
      noteCollectibles.push({ x: wx, y: wy, id });
      break;
    }
  }
  // Reset note modal so a noclip-transition doesn't preserve a stale one.
  activeNoteText = null;
  // Update HUD/level banner
  document.getElementById('hud-arch').textContent = LV.name.replace(/^LEVEL\s*\d+\s*·\s*/, '');
  updateHud();
  // Brief level intro popup
  pop(pug.x, pug.y - 28, LV.name, '#ffd23f');
  setTimeout(() => running && pop(pug.x, pug.y - 16, LV.sub, '#5ef38c'), 600);
}

function spawnEntity(kind) {
  for (let tries = 0; tries < 80; tries++) {
    const tx = 2 + Math.floor(Math.random() * (cols - 4));
    const ty = 2 + Math.floor(Math.random() * (rows - 4));
    if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > 8) {
      const e = {
        kind, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        vx: 0, vy: 0, state: 'idle', t: 0, hp: 1,
      };
      // Per-level monster scaling — bumps speed each chained noclip jump.
      const scale = monsterScaleFor(level || 1);
      if (kind === 'hound') { e.speed = 200 * scale; e.aggroT = 0; e.wanderT = 0; }
      if (kind === 'smiler') { e.speed = 50 * scale; e.recoilT = 0; e.opacity = 0.0; }
      if (kind === 'crawler') {
        // Low spider-pug — slow patrol, lunges from short range, hides near furniture.
        e.speed = 65 * scale; e.lungeT = 0; e.lungeCooldown = 0; e.wanderT = 0;
      }
      if (kind === 'whisperer') {
        // Stationary entity. Erodes sanity if player looks at it directly.
        e.speed = 0; e.gazeT = 0; e.lastWhisperT = -999;
      }
      entities.push(e); return;
    }
  }
}

// ============================================================================
// Collision
// ============================================================================
function isWallAt(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
  return grid[ty][tx] === 1;
}
function isWallTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
  return grid[ty][tx] === 1;
}
// Find the open tile farthest (Manhattan) from anchor tile (ax,ay).
// Returns world-space center coords. Falls back to (1,1) if grid is solid.
function findFarOpenTile(ax, ay) {
  let best = { x: TILE * 1.5, y: TILE * 1.5, d: -1 };
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === 0) {
        const d = Math.abs(x - ax) + Math.abs(y - ay);
        if (d > best.d) best = { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, d };
      }
    }
  }
  return best;
}
// Find the open tile nearest the given world coords. Used to rescue stuck entities.
function findNearestOpenTile(wx, wy) {
  const cx = Math.floor(wx / TILE), cy = Math.floor(wy / TILE);
  for (let r = 0; r < Math.max(cols, rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (tx < 1 || ty < 1 || tx >= cols - 1 || ty >= rows - 1) continue;
        if (grid[ty][tx] === 0) return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
      }
    }
  }
  return { x: TILE * 1.5, y: TILE * 1.5 };
}
// Pick a random open tile that's far from world coord (fx, fy) — used as a
// re-pathfinding fallback when the monster gets pinned near its spawn.
function findRandomFarOpenTile(fx, fy, minDist) {
  for (let tries = 0; tries < 80; tries++) {
    const tx = 1 + Math.floor(Math.random() * (cols - 2));
    const ty = 1 + Math.floor(Math.random() * (rows - 2));
    if (grid[ty][tx] !== 0) continue;
    const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
    if (Math.hypot(wx - fx, wy - fy) >= minDist) return { x: wx, y: wy };
  }
  return findFarOpenTile(Math.floor(fx / TILE), Math.floor(fy / TILE));
}
function move(e, dx, dy, r = 12) {
  const nx = e.x + dx;
  if (!isWallAt(nx - r, e.y - r) && !isWallAt(nx + r, e.y - r) &&
      !isWallAt(nx - r, e.y + r) && !isWallAt(nx + r, e.y + r)) e.x = nx;
  const ny = e.y + dy;
  if (!isWallAt(e.x - r, ny - r) && !isWallAt(e.x + r, ny - r) &&
      !isWallAt(e.x - r, ny + r) && !isWallAt(e.x + r, ny + r)) e.y = ny;
}
function lineClear(ax, ay, bx, by, ignoreSmoke = false) {
  const steps = 22;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = ax + (bx - ax) * t;
    const sy = ay + (by - ay) * t;
    if (isWallAt(sx, sy)) return false;
    if (!ignoreSmoke) {
      for (const sb of smokeBombs) if (Math.hypot(sx - sb.x, sy - sb.y) < 70) return false;
      // steam vents block sight during a burst
      for (const v of steamVents) {
        const phase = v.t % v.phase;
        if (phase < 1.2 && Math.hypot(sx - v.x, sy - v.y) < 80) return false;
      }
    }
  }
  return true;
}
function inLitCell(x, y) {
  // a cell is "lit" if it's one of the ceiling-light tiles (every 4th row+col)
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return false;
  // ceiling lights placed at (1+4k, 1+4j); call a 3x3 around each "lit"
  const ox = ((tx - 1) % 4 + 4) % 4;
  const oy = ((ty - 1) % 4 + 4) % 4;
  return grid[ty][tx] === 0 && ox <= 1 && oy <= 1;
}

// ============================================================================
// Audio — persistent fluorescent hum + heartbeat ramp
// ============================================================================
function ensureHum() {
  if (sfx.isMuted()) return;
  // Try to construct an oscillator via the same trick miniSfx uses internally
  try {
    if (humOsc) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Use a fresh shared context — miniSfx creates its own; we can create ours too
    if (!window.__bkAC) window.__bkAC = new AC();
    const actx = window.__bkAC;
    humOsc = actx.createOscillator();
    humOsc.type = 'sawtooth';
    humOsc.frequency.value = LV.hum;
    humGain = actx.createGain();
    humGain.gain.value = 0.0;
    // Highpass to make it whisper-quiet and texture-y
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    humOsc.connect(lp).connect(humGain).connect(actx.destination);
    humOsc.start();
  } catch {}
}
function setHumTargetFor(archKey) {
  if (humOsc) humOsc.frequency.value = LEVELS[archKey].hum;
}
function updateHum(dt) {
  if (!humGain) return;
  const target = sfx.isMuted() || nowSec() < humSilenceUntil || !running ? 0.0 : 0.04;
  const g = humGain.gain.value;
  humGain.gain.value = g + (target - g) * Math.min(1, dt * 8);
}

// ============================================================================
// HORROR MUSIC — drone bed (detuned saws beating @50/53Hz) + proximity pad +
// scheduled slow piano (triangle ADSR) + occasional scrape (filtered noise).
// All gated on `running` + mute toggle. Uses same window.__bkAC as hum.
// ============================================================================
function ensureMusic() {
  if (sfx.isMuted()) return;
  if (musicNodes) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.__bkAC) window.__bkAC = new AC();
    const actx = window.__bkAC;
    // --- Drone bed: two detuned saws, low-passed, soft master gain.
    const droneA = actx.createOscillator();
    droneA.type = 'sawtooth'; droneA.frequency.value = 50;
    const droneB = actx.createOscillator();
    droneB.type = 'sawtooth'; droneB.frequency.value = 53;
    const droneLp = actx.createBiquadFilter();
    droneLp.type = 'lowpass'; droneLp.frequency.value = 200; droneLp.Q.value = 0.7;
    const droneGain = actx.createGain();
    droneGain.gain.value = 0.0;
    droneA.connect(droneLp); droneB.connect(droneLp);
    droneLp.connect(droneGain).connect(actx.destination);
    droneA.start(); droneB.start();
    // --- Proximity pad: dissonant sine pair (220 + 233 = minor 2nd) ramping
    // in only when monster < 200px.
    const proxOscA = actx.createOscillator();
    proxOscA.type = 'sine'; proxOscA.frequency.value = 220;
    const proxOscB = actx.createOscillator();
    proxOscB.type = 'sine'; proxOscB.frequency.value = 233;
    const proxGain = actx.createGain();
    proxGain.gain.value = 0.0;
    proxOscA.connect(proxGain); proxOscB.connect(proxGain);
    proxGain.connect(actx.destination);
    proxOscA.start(); proxOscB.start();
    musicNodes = { actx, droneA, droneB, droneGain, proxOscA, proxOscB, proxGain };
    schedulePiano(); scheduleScrape();
  } catch {}
}
function schedulePiano() { nextPianoAt = gameTime + 4 + Math.random() * 4; }
function scheduleScrape() { nextScrapeAt = gameTime + 15 + Math.random() * 15; }
// A minor pentatonic-ish set of dread notes (C/D#/F#/A across octaves).
const PIANO_NOTES = [
  130.81, 155.56, 185.00, 220.00,
  261.63, 311.13, 369.99, 440.00,
  523.25,
];
function playPianoNote() {
  if (sfx.isMuted() || !musicNodes) return;
  try {
    const actx = musicNodes.actx;
    const n = PIANO_NOTES[Math.floor(Math.random() * PIANO_NOTES.length)];
    const osc = actx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = n;
    const g = actx.createGain();
    const t0 = actx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);   // attack
    g.gain.exponentialRampToValueAtTime(0.025, t0 + 0.25);  // decay
    g.gain.setValueAtTime(0.025, t0 + 1.2);                 // sustain
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);  // release
    osc.connect(g).connect(actx.destination);
    osc.start(t0); osc.stop(t0 + 2.5);
  } catch {}
}
function playScrape() {
  if (sfx.isMuted() || !musicNodes) return;
  try {
    const actx = musicNodes.actx;
    const bufLen = Math.floor(actx.sampleRate * 0.7);
    const buf = actx.createBuffer(1, bufLen, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
    const src = actx.createBufferSource(); src.buffer = buf;
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 6;
    const t0 = actx.currentTime;
    bp.frequency.setValueAtTime(220, t0);
    bp.frequency.exponentialRampToValueAtTime(80, t0 + 0.6); // sweep down
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    src.connect(bp).connect(g).connect(actx.destination);
    src.start(t0); src.stop(t0 + 0.75);
  } catch {}
}
function updateMusic(dt, monsterDist) {
  if (!musicNodes) return;
  const muted = sfx.isMuted();
  // Drone target: louder when running + not muted.
  const droneTarget = muted || !running ? 0.0 : 0.025;
  const dg = musicNodes.droneGain.gain.value;
  musicNodes.droneGain.gain.value = dg + (droneTarget - dg) * Math.min(1, dt * 1.2);
  // Proximity pad: ramps up below 200px monster distance.
  let proxTarget = 0.0;
  if (!muted && running && monsterDist < 200) {
    proxTarget = 0.045 * (1 - monsterDist / 200);
  }
  const pg = musicNodes.proxGain.gain.value;
  musicNodes.proxGain.gain.value = pg + (proxTarget - pg) * Math.min(1, dt * 3);
  // Scheduled musical events
  if (running && !muted) {
    if (gameTime >= nextPianoAt) { playPianoNote(); schedulePiano(); }
    if (gameTime >= nextScrapeAt) { playScrape(); scheduleScrape(); }
  }
}
function stopMusic() {
  // Soft-stop: just zero gains. Oscillators keep running for future starts.
  if (!musicNodes) return;
  try {
    musicNodes.droneGain.gain.value = 0;
    musicNodes.proxGain.gain.value = 0;
  } catch {}
}

// ============================================================================
// Tick
// ============================================================================
function tick(dt) {
  if (!running) { updateHum(dt); updateMusic(dt, 9999); return; }
  gameTime += dt;
  if (jumpScareCooldown > 0) jumpScareCooldown -= dt;
  if (jumpScareT > 0) jumpScareT -= dt;
  if (redFlashT > 0) redFlashT -= dt;
  // -------------------------------------------------------------------------
  // NOCLIP CHAIN TRANSITION — when active, FREEZE all gameplay (player can't
  // move, monsters can't damage you, no can pickups). At the midpoint, swap
  // to the new level so the second half of the flash reveals the new arch.
  // -------------------------------------------------------------------------
  if (noclipTransitionT > 0) {
    noclipTransitionT -= dt;
    // Swap level halfway through so the player sees the "from" flash, then
    // the "to" level fades up. Idempotent via noclipSwapped guard.
    if (!noclipSwapped && noclipTransitionT <= NOCLIP_TRANSITION_DUR * 0.5) {
      noclipSwapped = true;
      level++;
      const oldArch = archetype;
      genLevel(level);
      if (oldArch !== archetype) setHumTargetFor(archetype);
    }
    if (noclipTransitionT <= 0) {
      noclipTransitionT = 0;
      noclipSwapped = false;
    }
    // Keep the hum/music ducking smoothly during the cinematic — without
    // these calls the gain freezes at its pre-transition value and "pops"
    // when tick resumes.
    silenceHum(0.2);
    updateHum(dt);
    updateMusic(dt, 9999);
    return;
  }
  // Lore-note modal pauses gameplay too — player can read at their pace.
  if (activeNoteText) {
    // Still drive ambient hum/music so the reading scene isn't dead-silent.
    updateHum(dt);
    updateMusic(dt, Math.hypot((monster?.x ?? 0) - pug.x, (monster?.y ?? 0) - pug.y));
    return;
  }
  let mx = 0, my = 0;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  const sneaking = keys.has('shift') || touchSneak;
  // Partygoer-style slow not implemented; sanity-low slows you slightly though
  const sanitySlow = sanity < 25 ? 0.7 : 1.0;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const speed = (sneaking ? 70 : 140) * sanitySlow;
    move(pug, (mx / l) * speed * dt, (my / l) * speed * dt);
    soundLevel = Math.min(1, soundLevel + (sneaking ? 0.05 : 1.2) * dt);
    // Update facing for flashlight cone
    pugFaceX = mx / l; pugFaceY = my / l;
    // Footstep tick
    if ((performance.now() | 0) % (sneaking ? 360 : 230) < 18) {
      sfx.tone(sneaking ? 180 : 260, 'sine', 0.04, sneaking ? 0.05 : 0.09);
    }
  } else {
    soundLevel = Math.max(0, soundLevel - dt);
  }

  cam.x += (pug.x - cam.x) * 6 * dt;
  cam.y += (pug.y - cam.y) * 6 * dt;

  // Cans pickup
  for (let i = cans.length - 1; i >= 0; i--) {
    if (Math.hypot(cans[i].x - pug.x, cans[i].y - pug.y) < 22) {
      const c = cans[i]; cans.splice(i, 1);
      sfx.tone(880, 'triangle', 0.1, 0.18);
      pop(c.x, c.y - 14, '+CAN', '#ffd23f');
    }
  }
  // Lore-note pickup — opens a modal (pauses gameplay) and stamps the note id
  // as found in the persisted set. Re-reading an already-found note is fine.
  for (let i = noteCollectibles.length - 1; i >= 0; i--) {
    const n = noteCollectibles[i];
    if (Math.hypot(n.x - pug.x, n.y - pug.y) < 22) {
      noteCollectibles.splice(i, 1);
      // Defensive: a degenerate spawn with no id should still pick up cleanly.
      const id = (typeof n.id === 'number' && n.id >= 0 && n.id < NOTE_TOTAL) ? n.id : 0;
      const wasNew = markNoteFound(id);
      activeNoteText = LORE_NOTES[id] || '...';
      // Round 2C: trigger parchment-unfold animation timer
      noteUnfoldT = 0.45;
      try {
        sfx.tone(440, 'sine', 0.18, 0.10);
        // Round 2C: tiny paper-rustle layer to sell the unfold
        sfx.noise(0.08, 0.08, 200);
      } catch {}
      if (wasNew) {
        pop(n.x, n.y - 14, `+NOTE ${notesFoundCount()}/${NOTE_TOTAL}`, '#ffd23f');
      } else {
        pop(n.x, n.y - 14, 'RE-READ', '#aaaaaa');
      }
      // Update HUD note count
      updateHud();
      break; // only one note at a time
    }
  }
  // Item pickup (flashlight battery / smoke / extra battery)
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (Math.hypot(it.x - pug.x, it.y - pug.y) < 22) {
      items.splice(i, 1);
      if (it.type === 'flashlight') {
        battery = Math.min(100, battery + 60);
        sfx.tone(660, 'triangle', 0.15, 0.22);
        pop(it.x, it.y - 14, '+FLASHLIGHT', '#ffd23f');
      } else if (it.type === 'battery') {
        battery = Math.min(100, battery + 40);
        sfx.tone(540, 'triangle', 0.12, 0.18);
        pop(it.x, it.y - 14, '+BATTERY', '#ffd23f');
      } else if (it.type === 'smoke') {
        smokeCount++;
        sfx.tone(440, 'triangle', 0.12, 0.18);
        pop(it.x, it.y - 14, '+SMOKE', '#4cc9f0');
      }
    }
  }
  // Battery drain
  if (flashlightOn) {
    battery = Math.max(0, battery - 4 * dt);
    if (battery <= 0) { flashlightOn = false; pop(pug.x, pug.y - 18, 'BATTERY DEAD', '#ff3a3a'); }
  }
  monsterDazedT = Math.max(0, monsterDazedT - dt);
  // Smoke decay
  for (let i = smokeBombs.length - 1; i >= 0; i--) {
    smokeBombs[i].t += dt;
    if (smokeBombs[i].t >= smokeBombs[i].life) smokeBombs.splice(i, 1);
  }
  // Steam vents tick
  for (const v of steamVents) v.t += dt;

  // Hiding
  let hidden = false;
  for (const h of hideSpots) if (Math.hypot(h.x - pug.x, h.y - pug.y) < h.r) { hidden = true; break; }

  // Exit check — chain into the NEXT level archetype rather than ending the
  // run. Cinematic "NOCLIPPED → LEVEL N: NAME" flash plays for ~1.6s. Sanity
  // carries over; cans/pickups reset; monster scaling rises per level.
  if (cans.length === 0 && Math.hypot(exitTile.x - pug.x, exitTile.y - pug.y) < 26) {
    if (!noclipTransitionT) {
      // Fire the cinematic + arpeggio; gen the next level only once the
      // transition starts. This lets the player see the OLD scene during
      // the first half of the flash.
      noclipTransitionT = NOCLIP_TRANSITION_DUR;
      noclipFromLabel = LV.name;
      const nextLvl = level + 1;
      const nextArch = levelArchetypeFor(nextLvl);
      noclipToLabel = LEVELS[nextArch].name;
      // Persist a fake-level peek for the banner during the transition
      try {
        sfx.arp([523, 659, 784, 1047], 'triangle', 0.1, 0.22, 0.3);
        sfx.sweep(220, 880, 'sine', 0.3, 0.45);
        sfx.tone(1320, 'sine', 0.18, 0.20);
      } catch {}
      // Track total chained levels for end screen
      noclipsChained = (noclipsChained | 0) + 1;
    }
    return;
  }

  // Main monster AI
  const distToPug = Math.hypot(monster.x - pug.x, monster.y - pug.y);
  const detectable = !hidden && monsterDazedT <= 0;
  const hears = detectable && soundLevel > 0.5 && distToPug < 420;
  let sees = false;
  if (detectable && distToPug < 320) sees = lineClear(monster.x, monster.y, pug.x, pug.y);
  const prevSees = monster.sees;
  monster.sees = sees;
  if (sees && !prevSees) {
    shake(4, 0.25);
    sfx.tone(220, 'sawtooth', 0.18, 0.18);
    if (!firstSeenScreamed) {
      firstSeenScreamed = true;
      // Sudden scream — a sweep + brief silence
      sfx.sweep(900, 180, 'sawtooth', 0.6, 0.32);
      silenceHum(0.45);
    }
  }
  if (sees || hears) {
    monster.lastSeenX = pug.x; monster.lastSeenY = pug.y;
    monsterChaseT = sees ? 5 : 2.5;
  }
  const prevChase = monster.chase;
  monster.chase = monsterChaseT > 0;
  if (monsterChaseT > 0) monsterChaseT -= dt;
  // JUMP SCARE TRIGGER — first transition into chase while monster is close.
  // Also re-trigger if the monster has been chasing for a while and suddenly
  // closes inside 70px (panic spike). Cooldown still gates real scares.
  if (monster.chase && !prevChase && distToPug < 280) {
    jumpScare('monster');
  } else if (monster.chase && distToPug < 70 && jumpScareCooldown <= 0) {
    jumpScare('monster');
  }

  // --------------------------------------------------------------------------
  // MONSTER MOVEMENT — with sliding collision + stuck rescue + wander target.
  // Bug we are fixing: in the bottom-right corner the monster would push
  // into a wall and stick forever because the simple move() only resolved
  // axis-aligned overlaps. We add: (a) intended-velocity slide retry,
  // (b) "inside a wall for >0.5s" teleport rescue, (c) "didn't move >12px
  // in 3s while not chasing" wander-target reset to a random far tile.
  // --------------------------------------------------------------------------
  // (a) Determine intended velocity.
  let mvx = 0, mvy = 0;
  const targetT = monster.chase ? { x: monster.lastSeenX, y: monster.lastSeenY } : null;
  // Per-level chain scaling applied on top of the archetype base speed.
  const chainScale = monsterScaleFor(level || 1);
  if (targetT) {
    const dx = targetT.x - monster.x, dy = targetT.y - monster.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = (sees ? 165 : 110) * LV.monsterSpeed * chainScale;
      mvx = (dx / d) * sp; mvy = (dy / d) * sp;
    } else {
      monsterChaseT = 0;
    }
    monster.wanderTarget = null;
  } else {
    // Wander toward a roving target far from current spot; refresh every few s.
    if (!monster.wanderTarget ||
        Math.hypot(monster.wanderTarget.x - monster.x, monster.wanderTarget.y - monster.y) < 40) {
      monster.wanderTarget = findRandomFarOpenTile(monster.x, monster.y, 6 * TILE);
    }
    const dx = monster.wanderTarget.x - monster.x;
    const dy = monster.wanderTarget.y - monster.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = 50 * LV.monsterSpeed * chainScale;
    mvx = (dx / d) * sp; mvy = (dy / d) * sp;
  }
  // (b) Move with sliding collision — try full move, then X-only, then Y-only.
  const beforeX = monster.x, beforeY = monster.y;
  move(monster, mvx * dt, mvy * dt, 14);
  // If we barely moved and there was clear intent, try to slide along walls
  // by independently retrying X and Y at higher resolution.
  const moved = Math.hypot(monster.x - beforeX, monster.y - beforeY);
  if (moved < 0.2 && (Math.abs(mvx) > 1 || Math.abs(mvy) > 1)) {
    // Pure axis slide: zero out the blocked component, keep the tangent one.
    if (Math.abs(mvx) > 1) move(monster, mvx * dt, 0, 14);
    if (Math.abs(mvy) > 1 && Math.hypot(monster.x - beforeX, monster.y - beforeY) < 0.2) {
      move(monster, 0, mvy * dt, 14);
    }
  }
  // (c) Wall-inside rescue: if monster's center is inside a wall for >0.5s
  // (impossible normally but happens when carve-room overlaps spawn), teleport.
  if (isWallAt(monster.x, monster.y)) {
    monsterStuckT += dt;
    if (monsterStuckT > 0.5) {
      const safe = findNearestOpenTile(monster.x, monster.y);
      monster.x = safe.x; monster.y = safe.y;
      monsterStuckT = 0;
      monster.wanderTarget = null;
    }
  } else {
    monsterStuckT = 0;
  }
  // (d) Spawn-corner pin rescue: if the monster's hardly moved from a tracked
  // position in 3s AND isn't actively chasing, force a fresh random wander target.
  monsterStuckPosT += dt;
  if (Math.hypot(monster.x - monsterStuckPos.x, monster.y - monsterStuckPos.y) > 12) {
    monsterStuckPos = { x: monster.x, y: monster.y };
    monsterStuckPosT = 0;
  } else if (monsterStuckPosT > 3 && !monster.chase) {
    monster.wanderTarget = findRandomFarOpenTile(monster.x, monster.y, 8 * TILE);
    monsterStuckPos = { x: monster.x, y: monster.y };
    monsterStuckPosT = 0;
  }

  // Entities AI (Hounds + Smilers + Crawlers + Whisperers)
  for (const e of entities) {
    e.t += dt;
    if (e.kind === 'hound') tickHound(e, dt, hidden);
    if (e.kind === 'smiler') tickSmiler(e, dt, hidden);
    if (e.kind === 'crawler') tickCrawler(e, dt, hidden);
    if (e.kind === 'whisperer') tickWhisperer(e, dt, hidden);
    // Damage on contact
    if (Math.hypot(e.x - pug.x, e.y - pug.y) < 20) {
      if (e.kind === 'smiler' && (flashlightOn && smilerInBeam(e))) {
        // Smiler being repelled — don't damage; push it back
      } else if (e.kind === 'whisperer') {
        // Whisperer never attacks — only stares.
      } else {
        hitFlashT = 0.4; shake(7, 0.4); return die(e.kind);
      }
    }
  }

  // Sanity dynamics
  lastSanityTick += dt;
  if (lastSanityTick >= 0.5) {
    lastSanityTick = 0;
    const lit = inLitCell(pug.x, pug.y) && !hidden;
    let drain = 0;
    if (!lit) drain += 1.2;
    if (monster.chase) drain += 3.0;
    if (archetype === 'pipes') drain += 0.8;
    // Smiler proximity drains sanity even without contact
    for (const e of entities)
      if (e.kind === 'smiler' && Math.hypot(e.x - pug.x, e.y - pug.y) < 220) drain += 1.6;
    if (lit) drain -= 2.5; // lit safe cells regen
    sanity = Math.max(0, Math.min(100, sanity - drain));
    if (drain > 1.5) silenceHum(0.12); // dread tick — momentary dead silence
    // Round 2C: detect a sanity DROP > 3 in a single tick — iris-pulse it.
    const dropAmt = lastSanity - sanity;
    if (dropAmt > 3) sanityPulseT = 0.5;
    lastSanity = sanity;
  }
  if (sanity <= 0) { hitFlashT = 0.5; return die('sanity'); }
  // Round 2C: decay iris pulse + smoke darken timers + parchment unfold
  if (sanityPulseT > 0) sanityPulseT = Math.max(0, sanityPulseT - dt);
  if (smokeDarkenT > 0) smokeDarkenT = Math.max(0, smokeDarkenT - dt);
  if (noteUnfoldT > 0) noteUnfoldT = Math.max(0, noteUnfoldT - dt);
  if (catchSlowmoT > 0) catchSlowmoT = Math.max(0, catchSlowmoT - dt);

  // Heartbeat when monster close & chase
  if (monster.chase && distToPug < 360) {
    heartBeatT += dt;
    const rate = Math.max(0.35, distToPug / 800); // closer = faster
    if (heartBeatT >= rate) { heartBeatT = 0; sfx.tone(60, 'sine', 0.12, 0.18); }
  } else { heartBeatT = 0; }

  // Vignette + visuals
  if (sees) chaseVignetteT = Math.min(1, chaseVignetteT + dt * 2.5);
  else chaseVignetteT = Math.max(0, chaseVignetteT - dt * 1.2);
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life += dt; p.y += p.vy * dt; p.vy += 22 * dt;
    if (p.vx) { p.x += p.vx * dt; p.vx *= 0.88; }
    if (p.life >= p.max) popups.splice(i, 1);
  }
  // Light flicker accelerates when monster is close (< 200px = wild flicker)
  const flickerBoost = (distToPug < 200) ? (1 - distToPug / 200) * 18 : 0;
  lightFlicker += dt * (4 + Math.random() * 4 + flickerBoost);
  if (shakeT > 0) shakeT -= dt;
  if (hitFlashT > 0) hitFlashT -= dt;
  monsterWiggle += dt * 4;

  // Caught by main monster?
  if (distToPug < 24) {
    // Force jumpscare even if cooldown — death scare always plays.
    jumpScareCooldown = 0;
    // Round 2C: camera-zoom slow-mo final frame before death (renders during
    // the jumpscare with extra zoom + slightly longer hit-flash).
    catchSlowmoT = 0.4;
    jumpScare('monster');
    hitFlashT = 0.6; shake(12, 0.55);
    return die('monster');
  }

  // ============================================================
  // AMBIENT DREAD — fake jumpscare, far-off door slams, whispers
  // ============================================================
  if (gameTime >= nextAmbientAt) {
    // Place a silhouette in a doorway nearby (random tile around player).
    let placed = false;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 180 + Math.random() * 120;
      const ax = pug.x + Math.cos(a) * r;
      const ay = pug.y + Math.sin(a) * r;
      if (!isWallAt(ax, ay)) {
        ambientEvent = { x: ax, y: ay, t: 0, life: 0.15 };
        placed = true; break;
      }
    }
    if (placed) jumpScare('ambient');
    scheduleAmbient();
  }
  if (ambientEvent) {
    ambientEvent.t += dt;
    if (ambientEvent.t >= ambientEvent.life) ambientEvent = null;
  }
  // Door slam — only when player is fairly still / not in active chase, every 30-60s
  if (gameTime >= nextDoorSlamAt) {
    if (!monster.chase) {
      try {
        sfx.sweep(200, 80, 'sawtooth', 0.15, 0.32);
        sfx.tone(70, 'sine', 0.18, 0.22);
      } catch {}
    }
    scheduleDoorSlam();
  }
  // Low-sanity whispers
  if (sanity < 50 && gameTime >= nextWhisperAt) {
    try {
      const baseF = 280 + Math.random() * 240;
      sfx.tone(baseF, 'sine', 0.4, 0.05);
      setTimeout(() => running && sfx.tone(baseF * 0.78, 'triangle', 0.35, 0.04), 90);
    } catch {}
    scheduleWhisper();
  } else if (sanity >= 50) {
    // push next whisper out if sanity is healthy
    if (nextWhisperAt < gameTime + 3) nextWhisperAt = gameTime + 6 + Math.random() * 9;
  }

  // ============================================================
  // TRIGGER TILES — invisible per-level jumpscare hot-spots.
  // Player walks onto one → fire random jumpscare from a 4-pool.
  // Each tile fires once per level; 8s global cooldown between any two.
  // ============================================================
  {
    const ptx = Math.floor(pug.x / TILE);
    const pty = Math.floor(pug.y / TILE);
    for (const tt of triggerTiles) {
      if (tt.fired) continue;
      if (tt.tx === ptx && tt.ty === pty &&
          gameTime - lastTriggerScareAt > 8) {
        tt.fired = true;
        lastTriggerScareAt = gameTime;
        fireTriggerScare(tt.kind);
        break;
      }
    }
    if (activeTriggerScare) {
      activeTriggerScare.t += dt;
      if (activeTriggerScare.t >= activeTriggerScare.life) activeTriggerScare = null;
    }
  }

  // Pug breathing — gets louder/faster in chase
  if (monster.chase) {
    breathT += dt;
    const rate = Math.max(0.45, distToPug / 700);
    if (breathT >= rate) {
      breathT = 0;
      try { sfx.tone(140 + Math.random() * 40, 'sine', 0.18, 0.05); } catch {}
    }
  } else {
    breathT = Math.max(0, breathT - dt * 0.5);
  }

  updateHum(dt);
  updateMusic(dt, distToPug);
  updateHud();
}

// ----- HOUND ----- fast chaser, sight-only, easily lost around corners
function tickHound(e, dt, hidden) {
  const dx = pug.x - e.x, dy = pug.y - e.y;
  const dist = Math.hypot(dx, dy);
  const detectable = !hidden && monsterDazedT <= 0;
  const sees = detectable && dist < 360 && lineClear(e.x, e.y, pug.x, pug.y);
  if (sees) {
    const wasChase = e.state === 'chase';
    e.aggroT = 3.0;
    e.state = 'chase';
    if (e.t > 1.2) { e.t = 0; sfx.tone(380, 'sawtooth', 0.08, 0.12); }
    // JUMP SCARE — first hound to enter chase this match.
    if (!wasChase && !firstHoundJump) {
      firstHoundJump = true;
      jumpScare('hound');
    }
  } else if (e.aggroT > 0) {
    e.aggroT -= dt;
    if (e.aggroT <= 0) e.state = 'idle';
  }
  if (e.state === 'chase' && dist > 4) {
    move(e, (dx / dist) * e.speed * dt, (dy / dist) * e.speed * dt, 12);
  } else {
    // wander
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 1.2 + Math.random() * 1.8;
      const a = Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * 50; e.vy = Math.sin(a) * 50;
    }
    move(e, e.vx * dt, e.vy * dt, 12);
  }
}

// ----- SMILER ----- only in dark, repelled by flashlight beam pointed at it
function smilerInBeam(e) {
  if (!flashlightOn) return false;
  const dx = e.x - pug.x, dy = e.y - pug.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 360) return false;
  // angle vs facing
  const fl = Math.hypot(pugFaceX, pugFaceY) || 1;
  const dot = (dx / dist) * (pugFaceX / fl) + (dy / dist) * (pugFaceY / fl);
  return dot > 0.86; // ~30deg cone
}
function tickSmiler(e, dt, hidden) {
  const lit = inLitCell(e.x, e.y);
  // Visibility: only in dark areas
  const targetOp = lit ? 0.05 : 0.9;
  e.opacity += (targetOp - e.opacity) * Math.min(1, dt * 3);
  // JUMP SCARE — smiler within 90px and flashlight OFF, once per 12s per smiler.
  const dPug = Math.hypot(e.x - pug.x, e.y - pug.y);
  if (!flashlightOn && dPug < 90 && (gameTime - (e.lastJumpAt || -999)) > 12) {
    e.lastJumpAt = gameTime;
    jumpScare('smiler');
  }
  // If in flashlight beam, get pushed back & damaged-mood
  if (smilerInBeam(e)) {
    e.recoilT = 0.6;
    const dx = e.x - pug.x, dy = e.y - pug.y;
    const d = Math.hypot(dx, dy) || 1;
    move(e, (dx / d) * 110 * dt, (dy / d) * 110 * dt, 12);
    if (e.t > 0.4) { e.t = 0; sfx.tone(1100, 'square', 0.05, 0.08); }
    return;
  }
  e.recoilT = Math.max(0, e.recoilT - dt);
  if (hidden || monsterDazedT > 0) return; // hidden = smiler stops
  // Slow creep toward pug if pug not lit
  const litPug = inLitCell(pug.x, pug.y);
  if (!litPug) {
    const dx = pug.x - e.x, dy = pug.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 10) move(e, (dx / d) * e.speed * dt, (dy / d) * e.speed * dt, 12);
  } else {
    // wander while pug is safe
    if (Math.random() < dt * 0.4) {
      const a = Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * 30; e.vy = Math.sin(a) * 30;
    }
    move(e, (e.vx || 0) * dt, (e.vy || 0) * dt, 12);
  }
}

// ----- CRAWLER ----- low spider-pug. Hugs floor, hides near furniture, lunges
// when player gets within 50px. High damage on contact via the normal contact-
// collision path; we drive it here.
function tickCrawler(e, dt, hidden) {
  e.lungeCooldown = Math.max(0, e.lungeCooldown - dt);
  const dx = pug.x - e.x, dy = pug.y - e.y;
  const dist = Math.hypot(dx, dy);
  // Currently lunging — fast burst toward player for 0.35s.
  if (e.lungeT > 0) {
    e.lungeT -= dt;
    if (dist > 2) {
      const sp = 320;
      move(e, (dx / dist) * sp * dt, (dy / dist) * sp * dt, 10);
    }
    return;
  }
  // Trigger lunge if close enough, not on cooldown, line clear, and not hidden.
  if (!hidden && dist < 80 && e.lungeCooldown <= 0 && lineClear(e.x, e.y, pug.x, pug.y)) {
    e.lungeT = 0.35; e.lungeCooldown = 2.5;
    try { sfx.sweep(420, 220, 'sawtooth', 0.18, 0.18); } catch {}
    return;
  }
  // Patrol — slow wander biased toward nearby furniture (to "hide" near it).
  e.wanderT -= dt;
  if (e.wanderT <= 0) {
    e.wanderT = 2 + Math.random() * 2;
    // Pick a nearby furniture or random target
    let tgt = null;
    if (furniture.length && Math.random() < 0.5) {
      tgt = furniture[Math.floor(Math.random() * furniture.length)];
    }
    if (tgt) {
      const ax = tgt.x - e.x, ay = tgt.y - e.y;
      const m = Math.hypot(ax, ay) || 1;
      e.vx = (ax / m) * e.speed; e.vy = (ay / m) * e.speed;
    } else {
      const a = Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * e.speed; e.vy = Math.sin(a) * e.speed;
    }
  }
  move(e, (e.vx || 0) * dt, (e.vy || 0) * dt, 10);
}

// ----- WHISPERER ----- stationary silhouette. Erodes sanity if the player's
// facing vector points within ~15deg of it AND there's line of sight, for >1.5s.
function tickWhisperer(e, dt, hidden) {
  if (hidden) { e.gazeT = 0; return; }
  const dx = e.x - pug.x, dy = e.y - pug.y;
  const dist = Math.hypot(dx, dy);
  // Only "active" within long-corridor visible range
  if (dist > 520 || dist < 60) { e.gazeT = Math.max(0, e.gazeT - dt * 2); return; }
  const fl = Math.hypot(pugFaceX, pugFaceY) || 1;
  const dot = (dx / dist) * (pugFaceX / fl) + (dy / dist) * (pugFaceY / fl);
  const facing = dot > 0.95; // ~18deg
  const visible = lineClear(e.x, e.y, pug.x, pug.y);
  if (facing && visible) {
    e.gazeT += dt;
    // After 1.5s of staring, start draining sanity rapidly (4/sec)
    if (e.gazeT > 1.5) {
      sanity = Math.max(0, sanity - 4 * dt);
      // Soft whisper sound every 1.5s while gazed
      if (gameTime - (e.lastWhisperT || -999) > 1.5) {
        e.lastWhisperT = gameTime;
        try { sfx.tone(180 + Math.random() * 80, 'sine', 0.5, 0.04); } catch {}
      }
    }
  } else {
    e.gazeT = Math.max(0, e.gazeT - dt * 1.5);
  }
}

// ============================================================================
// Rendering
// ============================================================================
function render() {
  let sx = 0, sy = 0;
  if (shakeT > 0) {
    const k = Math.min(1, shakeT / 0.3);
    sx = (Math.random() - 0.5) * shakeMag * 2 * k;
    sy = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  // Background fog tone for archetype
  ctx.fillStyle = LV.fog; ctx.fillRect(0, 0, W, H);
  ctx.save();
  // Round 2C: MONSTER CATCH camera zoom — eases the world up to 1.5x and
  // pivots toward the monster during the slow-mo death frame.
  if (catchSlowmoT > 0) {
    const k = 1 - (catchSlowmoT / 0.4);   // 0 -> 1
    const zoom = 1 + 0.5 * k;
    const cx = (monster && monster.x) || pug.x;
    const cy = (monster && monster.y) || pug.y;
    ctx.translate(W / 2 - cx * zoom + sx, H / 2 - cy * zoom + sy);
    ctx.scale(zoom, zoom);
  } else {
    ctx.translate(W / 2 - cam.x + sx, H / 2 - cam.y + sy);
  }
  // View radius — slightly larger when flashlight ON.
  // Tightened so visible area is ~7 tiles even with bigger TILE — more dread.
  const viewR = flashlightOn ? 340 : 200;
  // FLOOR — archetype-specific
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) {
        ctx.fillStyle = ((x + y) & 1) ? LV.floor : LV.floorAlt;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
  }
  // Floor grout
  ctx.strokeStyle = LV.floorGrout; ctx.lineWidth = 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }
  // Carpet pattern dots — gives the floor a "yellow carpet" texture
  renderCarpetDots();
  // Ceiling-light shadow bands (alternating subtle stripes across floor — reflection of fluorescent strips)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) {
        const t = y * TILE;
        ctx.fillRect(x * TILE, t + 18, TILE, 6);
        ctx.fillRect(x * TILE, t + 42, TILE, 6);
      }
    }
  }
  // Wall-base shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++)
      if (grid[y][x] === 0 && y > 0 && grid[y - 1][x] === 1)
        ctx.fillRect(x * TILE, y * TILE, TILE, 6);
  // WALLS — archetype-specific colour + texture, with chosen wallpaper variant.
  const wpWall = currentWallpaper ? currentWallpaper.wall : LV.wall;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) {
        ctx.fillStyle = wpWall;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        renderWallTexture(x, y);
      }
    }
  }
  // Doorway frames — darker rect outline around open tiles that connect rooms.
  ctx.strokeStyle = 'rgba(10,8,6,0.55)';
  ctx.lineWidth = 3;
  for (const d of doorways) {
    if (d.vertical) {
      ctx.fillStyle = 'rgba(10,8,6,0.4)';
      ctx.fillRect(d.x * TILE, d.y * TILE, 6, TILE);
      ctx.fillRect(d.x * TILE + TILE - 6, d.y * TILE, 6, TILE);
    } else {
      ctx.fillStyle = 'rgba(10,8,6,0.4)';
      ctx.fillRect(d.x * TILE, d.y * TILE, TILE, 6);
      ctx.fillRect(d.x * TILE, d.y * TILE + TILE - 6, TILE, 6);
    }
  }
  // Wall stains
  for (const s of wallStains) {
    const a1 = s.a, a2 = s.a * 0.6;
    ctx.fillStyle = LV.stainTint.replace('$A', a1);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LV.stainTint.replace('$A', a2);
    ctx.beginPath(); ctx.arc(s.x + s.r * 0.4, s.y + s.r * 0.3, s.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // Ceiling lights flicker
  const flick = 0.7 + Math.sin(lightFlicker * 3.1) * 0.2 + (Math.random() < 0.02 ? -0.4 : 0);
  const lt = LV.lightTint;
  for (let y = 1; y < rows; y += 4) {
    for (let x = 1; x < cols; x += 4) {
      if (grid[y][x] === 0) {
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        ctx.fillStyle = hexA(lt, Math.max(0.18, flick * 0.32));
        ctx.fillRect(cx - 20, cy - 4, 40, 8);
        ctx.fillStyle = hexA(lt, Math.max(0.4, flick * 0.7));
        ctx.fillRect(cx - 18, cy - 2, 36, 4);
      }
    }
  }
  // Big ceiling lights (every 5th tile) with brief OFF pulses
  drawBigCeilingLights();
  // Pillars (center columns of big rooms — rendered as decorative concrete posts)
  for (const p of pillars) {
    ctx.fillStyle = LV.wallDark;
    ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
    ctx.fillStyle = LV.wallLight;
    ctx.fillRect(p.x - 18, p.y - 18, 36, 4);
    ctx.fillRect(p.x - 18, p.y + 14, 36, 4);
  }
  // Blood stains (cosmetic floor blots — drawn UNDER furniture/hide spots)
  for (const b of bloodStains) {
    ctx.fillStyle = 'rgba(58,4,4,0.55)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(28,2,2,0.45)';
    ctx.beginPath(); ctx.arc(b.x + b.r * 0.5, b.y + b.r * 0.3, b.r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(80,8,8,0.3)';
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.4, b.y + b.r * 0.5, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  // In-room furniture (lamp/box/chair_small) — small obstacles, break sightline.
  for (const f of furniture) drawSmallFurniture(f);
  // Hide spots (furniture)
  for (const h of hideSpots) drawFurniture(h);
  // Cans — use icon library
  for (const c of cans) {
    ctx.save();
    drawIcon.can(ctx, c.x, c.y, 22);
    ctx.restore();
  }
  // Items
  for (const it of items) drawItem(it);
  // Lore notes — small white rects with a folded corner. Subtle glow so they
  // catch the eye but don't compete with the dread atmosphere.
  for (const n of noteCollectibles) {
    const bob = Math.sin(performance.now() / 380 + (n.id || 0)) * 1.4;
    ctx.save();
    ctx.shadowColor = '#fff5c8';
    ctx.shadowBlur = 8;
    // paper
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(n.x - 8, n.y - 10 + bob, 16, 18);
    ctx.fillStyle = '#bda878';
    ctx.fillRect(n.x - 8, n.y - 10 + bob, 16, 2);
    // folded corner
    ctx.fillStyle = '#c8b888';
    ctx.beginPath();
    ctx.moveTo(n.x + 4, n.y - 10 + bob);
    ctx.lineTo(n.x + 8, n.y - 10 + bob);
    ctx.lineTo(n.x + 8, n.y - 6 + bob);
    ctx.closePath(); ctx.fill();
    // tiny text-lines
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(n.x - 5, n.y - 5 + bob, 10, 1);
    ctx.fillRect(n.x - 5, n.y - 2 + bob, 8, 1);
    ctx.fillRect(n.x - 5, n.y + 1 + bob, 10, 1);
    ctx.fillRect(n.x - 5, n.y + 4 + bob, 6, 1);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // Smoke bombs (active clouds)
  for (const sb of smokeBombs) {
    const a = sb.t < 0.3 ? sb.t / 0.3 : (sb.t > 3.5 ? (sb.life - sb.t) / 0.5 : 1);
    // Round 2C: denser smoke — layered puffs that pulse around the center
    ctx.fillStyle = `rgba(140,140,160,${a * 0.6})`;
    ctx.beginPath(); ctx.arc(sb.x, sb.y, 70, 0, Math.PI * 2); ctx.fill();
    // Outer billow
    ctx.fillStyle = `rgba(100,100,120,${a * 0.45})`;
    const off = Math.sin(sb.t * 4) * 4;
    ctx.beginPath(); ctx.arc(sb.x + off, sb.y - 8, 56, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sb.x - off, sb.y + 6, 50, 0, Math.PI * 2); ctx.fill();
    // Bright inner highlight
    ctx.fillStyle = `rgba(180,180,200,${a * 0.3})`;
    ctx.beginPath(); ctx.arc(sb.x - 12, sb.y - 6, 24, 0, Math.PI * 2); ctx.fill();
  }
  // Steam vents (pipes archetype) — visible during their burst
  for (const v of steamVents) {
    const phase = v.t % v.phase;
    if (phase < 1.4) {
      const a = phase < 0.2 ? phase / 0.2 : (phase > 1.0 ? (1.4 - phase) / 0.4 : 1);
      ctx.fillStyle = `rgba(220,230,240,${a * 0.55})`;
      ctx.beginPath(); ctx.arc(v.x, v.y, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(240,250,255,${a * 0.35})`;
      ctx.beginPath(); ctx.arc(v.x - 12, v.y - 8, 40, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Exit (only if cans done)
  if (cans.length === 0) {
    const glow = 0.7 + Math.sin(performance.now() / 220) * 0.3;
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 20 * glow;
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(exitTile.x - 22, exitTile.y - 30, 44, 60);
    ctx.shadowBlur = 0;
    drawIcon.exit(ctx, exitTile.x, exitTile.y, 36);
    ctx.fillStyle = '#0a1018'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitTile.x, exitTile.y + 44);
  }
  // Entities (Hounds + Smilers + Crawlers + Whisperers)
  for (const e of entities) {
    if (e.kind === 'hound') drawHound(e);
    if (e.kind === 'smiler') drawSmiler(e);
    if (e.kind === 'crawler') drawCrawler(e);
    if (e.kind === 'whisperer') drawWhisperer(e);
  }
  // Monster — main pug-monster
  drawMonster();
  // Ambient silhouette (fake jumpscare) — a doorway-shaped shadow that vanishes
  if (ambientEvent) {
    const a = 1 - ambientEvent.t / ambientEvent.life;
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#000';
    ctx.fillRect(ambientEvent.x - 16, ambientEvent.y - 36, 32, 70);
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(ambientEvent.x - 6, ambientEvent.y - 24, 12, 8);
    ctx.restore();
  }
  // Flashlight cone (player) — narrow yellow wedge
  if (flashlightOn && battery > 0) drawFlashlightCone();
  // Pug player — high-detail sprite (with hit-flash overlay)
  if (hitFlashT > 0) {
    ctx.save(); ctx.filter = 'brightness(2.5)';
    drawPug(ctx, pug.x, pug.y, { size: 40 });
    ctx.filter = 'none'; ctx.restore();
  } else {
    drawPug(ctx, pug.x, pug.y, { size: 40 });
  }
  // Sound waves
  if (soundLevel > 0.05) {
    ctx.strokeStyle = `rgba(255,210,63,${soundLevel * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pug.x, pug.y, 14 + soundLevel * 40, 0, Math.PI * 2); ctx.stroke();
  }
  // Popups
  ctx.textAlign = 'center';
  ctx.font = "10px 'Press Start 2P', monospace";
  for (const pp of popups) {
    const a = 1 - pp.life / pp.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillText(pp.text, pp.x + 1, pp.y + 1);
    ctx.fillStyle = pp.color; ctx.fillText(pp.text, pp.x, pp.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // SCREEN-SPACE post-fx
  // Distance fog (tight radial gradient) — pulled in by ~30% so the world feels
  // claustrophobic; radius now ~7 tiles instead of ~9.
  const grd = ctx.createRadialGradient(W / 2, H / 2, viewR * 0.3, W / 2, H / 2, viewR * 1.1);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.75, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0.96)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  // Scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  const sLine = Math.floor(performance.now() / 100) % 3;
  for (let y = sLine; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  // Sanity blur tint — pulsing red when low
  if (sanity < 40) {
    const lo = (40 - sanity) / 40;
    const pul = 0.5 + Math.sin(performance.now() / 220) * 0.5;
    ctx.fillStyle = `rgba(80,0,0,${0.18 * lo * (0.6 + 0.4 * pul)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Compute monster distance up-front for heartbeat-paced vignette + film grain.
  const distToPug = Math.hypot(monster.x - pug.x, monster.y - pug.y);
  // Red chase vignette pulse — pulse rate scales with proximity (real heartbeat).
  if (chaseVignetteT > 0.05) {
    // Closer = faster pulse. At 400px ~ 180ms, at 50px ~ 70ms.
    const pulseRate = Math.max(70, Math.min(220, distToPug * 0.5 + 60));
    const pulse = 0.5 + Math.sin(performance.now() / pulseRate) * 0.5;
    const rgrd = ctx.createRadialGradient(W / 2, H / 2, viewR * 0.5, W / 2, H / 2, viewR * 1.3);
    rgrd.addColorStop(0, 'rgba(255,58,58,0)');
    rgrd.addColorStop(1, `rgba(255,58,58,${0.35 * chaseVignetteT * (0.6 + 0.4 * pulse)})`);
    ctx.fillStyle = rgrd; ctx.fillRect(0, 0, W, H);
  }
  // Round 2C: SANITY-DROP IRIS PULSE — subtle dark ring contracts inward when
  // a big sanity hit just landed (telegraphs "you got mentally smacked").
  if (sanityPulseT > 0) {
    const k = sanityPulseT / 0.5; // 1 -> 0
    const pgrd = ctx.createRadialGradient(W / 2, H / 2, viewR * 0.2 + (1 - k) * 80, W / 2, H / 2, viewR * 1.1);
    pgrd.addColorStop(0, 'rgba(0,0,0,0)');
    pgrd.addColorStop(0.85, `rgba(0,0,0,${0.55 * k})`);
    pgrd.addColorStop(1, `rgba(0,0,0,${0.85 * k})`);
    ctx.fillStyle = pgrd; ctx.fillRect(0, 0, W, H);
  }
  // Round 2C: SMOKE DEPLOY SCREEN-DARKEN — full-screen grey wash for ~0.7s
  if (smokeDarkenT > 0) {
    const k = smokeDarkenT / 0.7;
    ctx.fillStyle = `rgba(80,80,90,${0.35 * k})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Film grain / static overlay when monster very close in chase
  if (monster.chase && distToPug < 220) {
    const intensity = 1 - (distToPug / 220);
    ctx.globalAlpha = 0.18 * intensity;
    // sparse random pixels — tiny perf cost
    ctx.fillStyle = '#fff';
    const count = 80 * intensity;
    for (let i = 0; i < count; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    ctx.fillStyle = '#000';
    for (let i = 0; i < count; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    ctx.globalAlpha = 1;
  }
  // Sanity-based film grain — ramps up below 60 sanity, max at 0.
  if (sanity < 60) {
    const sint = (60 - sanity) / 60;          // 0..1
    ctx.globalAlpha = 0.10 * sint;
    ctx.fillStyle = '#fff';
    const c = Math.floor(40 * sint);
    for (let i = 0; i < c; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    ctx.fillStyle = '#000';
    for (let i = 0; i < c; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    ctx.globalAlpha = 1;
  }
  // Hit flash overlay
  if (hitFlashT > 0) {
    ctx.fillStyle = `rgba(255,58,58,${Math.min(0.55, hitFlashT * 1.5)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Red full-screen flash from a jump-scare (200ms decay)
  if (redFlashT > 0) {
    const a = Math.min(0.7, (redFlashT / 0.2) * 0.7);
    ctx.fillStyle = `rgba(220,10,10,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
  // JUMP SCARE — huge face/sprite in center of screen
  if (jumpScareT > 0 && jumpScareKind) {
    const elapsed = jumpScareLife - jumpScareT;
    // first 0.4s fully visible, then fade across remaining
    let a = 1;
    if (elapsed > 0.4) a = Math.max(0, 1 - (elapsed - 0.4) / 0.6);
    // slight jitter
    const jx = (Math.random() - 0.5) * 14 * a;
    const jy = (Math.random() - 0.5) * 14 * a;
    ctx.save();
    ctx.globalAlpha = a;
    const cx = W / 2 + jx, cy = H / 2 + jy;
    if (jumpScareKind === 'monster') {
      ctx.fillStyle = 'rgba(60,0,0,0.55)';
      ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 40;
      drawMonsterPug(ctx, cx, cy, { size: 280, body: '#5a0d0d' });
      ctx.shadowBlur = 0;
    } else if (jumpScareKind === 'hound') {
      ctx.fillStyle = 'rgba(20,0,0,0.6)';
      ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.fill();
      // scale-up version of drawHound
      ctx.save(); ctx.translate(cx, cy); ctx.scale(7, 7); ctx.translate(-cx / 7, -cy / 7);
      // synthesize a hound at center
      const fake = { x: cx / 7, y: cy / 7, state: 'chase' };
      // draw simplified large hound directly
      ctx.restore();
      ctx.fillStyle = '#3a0a0a';
      ctx.fillRect(cx - 130, cy - 30, 260, 90);
      ctx.fillRect(cx + 80, cy - 50, 80, 70);
      ctx.fillStyle = '#ff3a3a';
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 30;
      ctx.fillRect(cx + 120, cy - 40, 18, 18);
      ctx.fillRect(cx + 145, cy - 30, 18, 18);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(cx + 90 + i * 8, cy + 10, 5, 18);
      }
    } else if (jumpScareKind === 'smiler') {
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, 200, 0, Math.PI * 2); ctx.fill();
      // huge grin
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 40;
      ctx.fillRect(cx - 80, cy - 40, 40, 40);
      ctx.fillRect(cx + 40, cy - 40, 40, 40);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      for (let i = -10; i <= 10; i++) {
        const yy = cy + 60 + Math.abs(i) * 3;
        ctx.fillRect(cx + i * 14, yy, 12, 22);
      }
    } else if (jumpScareKind === 'ambient') {
      // ambient = no center face, only the in-world silhouette (drawn earlier)
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------------
  // TRIGGER-TILE jumpscare overlays (4 kinds).
  // Animated by `activeTriggerScare = { kind, t, life }`.
  // ------------------------------------------------------------------------
  if (activeTriggerScare) {
    const ts = activeTriggerScare;
    const k = ts.kind;
    const a = ts.t < 0.4 ? 1 : Math.max(0, 1 - (ts.t - 0.4) / (ts.life - 0.4));
    ctx.save();
    ctx.globalAlpha = a;
    if (k === 'mirror') {
      // Red overlay + giant grinning evil-pug face
      ctx.fillStyle = 'rgba(160,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      const jx = (Math.random() - 0.5) * 12 * a;
      const jy = (Math.random() - 0.5) * 12 * a;
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 50;
      drawMonsterPug(ctx, W / 2 + jx, H / 2 + jy, { size: Math.min(W, H) * 0.7, body: '#5a0d0d' });
      ctx.shadowBlur = 0;
    } else if (k === 'hand') {
      // Pale hand reaching from below the screen — 800px tall, centered.
      const ascend = Math.min(1, ts.t / 0.3); // rises fast in first 0.3s
      const handTop = H + 50 - 800 * ascend;
      const cx = W / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#d8c8b8';
      // forearm
      ctx.fillRect(cx - 60, handTop + 400, 120, 400);
      // palm
      ctx.beginPath();
      ctx.ellipse(cx, handTop + 380, 110, 130, 0, 0, Math.PI * 2);
      ctx.fill();
      // fingers
      const fingerW = 28;
      for (let i = 0; i < 4; i++) {
        const fx = cx - 70 + i * 40;
        ctx.fillRect(fx, handTop + 100, fingerW, 280);
        ctx.beginPath();
        ctx.arc(fx + fingerW / 2, handTop + 100, fingerW / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // thumb
      ctx.fillRect(cx + 80, handTop + 280, 30, 200);
      // shadowy fingernails
      ctx.fillStyle = '#8a6a5a';
      for (let i = 0; i < 4; i++) {
        const fx = cx - 70 + i * 40;
        ctx.fillRect(fx + 4, handTop + 100, fingerW - 8, 18);
      }
    } else if (k === 'shadow') {
      // Quick dark shape darting left→right across the screen (0.4s).
      const phase = Math.min(1, ts.t / 0.4);
      const sx = -200 + (W + 400) * phase;
      const sy = H / 2 + Math.sin(phase * Math.PI * 2) * 60;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 200, 80, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(sx - 80, sy + 10, 240, 50, 0, 0, Math.PI * 2); ctx.fill();
      // motion blur
      for (let i = 0; i < 5; i++) {
        ctx.globalAlpha = a * (0.3 - i * 0.05);
        ctx.beginPath(); ctx.ellipse(sx - 60 * i, sy, 180 - i * 20, 70, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (k === 'whisper') {
      // No visual — only a quick black vignette pulse to enhance the audio.
      const vpul = 0.4 + Math.sin(ts.t * 30) * 0.3;
      ctx.fillStyle = `rgba(0,0,0,${0.25 * vpul})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // NOCLIP TRANSITION — full-screen "NOCLIPPED → LEVEL N: NAME" flash.
  // Animates: white→black radial reveal, then the new level fades up.
  // -------------------------------------------------------------------------
  if (noclipTransitionT > 0) {
    const elapsed = NOCLIP_TRANSITION_DUR - noclipTransitionT;
    const k = elapsed / NOCLIP_TRANSITION_DUR; // 0..1
    // First half: bright glitch + zoom; second half: dark fade-up + new title.
    ctx.save();
    if (k < 0.5) {
      // Glitch — bright pulses + chromatic split + "NOCLIPPED"
      const flickA = 0.55 + Math.sin(elapsed * 80) * 0.4;
      ctx.fillStyle = `rgba(255,255,255,${0.4 * flickA})`;
      ctx.fillRect(0, 0, W, H);
      // RGB split bands
      const off = (1 - k * 2) * 30;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(-off, 0, W, H * 0.35);
      ctx.fillStyle = '#3affd2';
      ctx.fillRect(off, H * 0.65, W, H * 0.35);
      ctx.globalAlpha = 1;
      // Title text
      ctx.textAlign = 'center';
      const jx = (Math.random() - 0.5) * 8;
      const jy = (Math.random() - 0.5) * 8;
      ctx.font = "bold 36px 'Press Start 2P', monospace";
      ctx.fillStyle = '#000';
      ctx.fillText('NOCLIPPED', W / 2 + jx + 2, H / 2 + jy + 2);
      ctx.fillStyle = '#fff';
      ctx.fillText('NOCLIPPED', W / 2 + jx, H / 2 + jy);
      ctx.font = "12px 'Press Start 2P', monospace";
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(noclipFromLabel, W / 2, H / 2 + 36);
    } else {
      // Dark fade-up with the destination level title.
      const k2 = (k - 0.5) / 0.5;
      ctx.fillStyle = `rgba(0,0,0,${(1 - k2) * 0.92})`;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = "bold 22px 'Press Start 2P', monospace";
      ctx.fillStyle = '#000';
      ctx.fillText('→', W / 2 + 2, H / 2 - 16 + 2);
      ctx.fillStyle = '#5ef38c';
      ctx.fillText('→', W / 2, H / 2 - 16);
      ctx.font = "16px 'Press Start 2P', monospace";
      ctx.fillStyle = '#000';
      ctx.fillText(noclipToLabel, W / 2 + 2, H / 2 + 18 + 2);
      ctx.fillStyle = '#fff';
      ctx.fillText(noclipToLabel, W / 2, H / 2 + 18);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // LORE NOTE MODAL — paper-textured rect, dim backdrop, click to dismiss.
  // -------------------------------------------------------------------------
  if (activeNoteText) {
    ctx.save();
    // backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);
    // paper card
    const cw = Math.min(560, W - 80);
    const ch = 320;
    const cx = (W - cw) / 2, cy = (H - ch) / 2;
    // Round 2C: parchment-unfold scale-Y animation. noteUnfoldT counts down
    // from 0.45 to 0; we map (1 - t/0.45) to an ease-out cubic curve so the
    // card "snaps open" then settles. Anchor scaling at card center so it
    // visually unfolds vertically.
    if (noteUnfoldT > 0) {
      const k = 1 - (noteUnfoldT / 0.45);          // 0..1
      const ease = 1 - Math.pow(1 - k, 3);         // ease-out cubic
      const sx = 0.6 + 0.4 * ease;                 // 0.6 -> 1.0 width
      const sy = 0.08 + 0.92 * ease;               // 0.08 -> 1.0 height (folded → open)
      ctx.translate(cx + cw / 2, cy + ch / 2);
      ctx.scale(sx, sy);
      ctx.translate(-(cx + cw / 2), -(cy + ch / 2));
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx + 8, cy + 10, cw, ch);
    // paper
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(cx, cy, cw, ch);
    // edge tear/stain
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(cx, cy, cw, 4);
    ctx.fillRect(cx, cy + ch - 4, cw, 4);
    ctx.fillStyle = 'rgba(140,90,40,0.18)';
    ctx.fillRect(cx + 18, cy + 28, 60, 28);
    ctx.fillRect(cx + cw - 80, cy + ch - 70, 60, 28);
    // header
    ctx.textAlign = 'left';
    ctx.font = "14px 'Press Start 2P', monospace";
    ctx.fillStyle = '#3a2818';
    ctx.fillText('FOUND NOTE', cx + 20, cy + 38);
    // body — wrap text into ~52-char lines.
    ctx.font = "12px 'VT323', 'Press Start 2P', monospace";
    ctx.fillStyle = '#1a1208';
    const maxChars = 52;
    const words = activeNoteText.split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) {
        lines.push(cur.trim()); cur = w;
      } else {
        cur = cur ? cur + ' ' + w : w;
      }
    }
    if (cur) lines.push(cur.trim());
    let y = cy + 78;
    for (const l of lines) {
      ctx.fillText(l, cx + 24, y);
      y += 22;
      if (y > cy + ch - 50) break;
    }
    // dismiss hint
    ctx.textAlign = 'center';
    ctx.font = "10px 'Press Start 2P', monospace";
    ctx.fillStyle = '#7a6a4a';
    ctx.fillText('CLICK or press ANY KEY to continue', cx + cw / 2, cy + ch - 22);
    ctx.restore();
  }
}

function hexA(hex, a) {
  // Accept '#rrggbb' and produce 'rgba(r,g,b,a)'
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function renderWallTexture(x, y) {
  const px = x * TILE, py = y * TILE;
  const wpLight = currentWallpaper ? currentWallpaper.light : LV.wallLight;
  const wpDark = currentWallpaper ? currentWallpaper.dark : LV.wallDark;
  if (LV.wallPattern === 'wallpaper') {
    // subtle floral repeat — small dots in a regular grid (Level 0)
    ctx.fillStyle = wpLight;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        ctx.fillRect(px + 6 + i * 16, py + 6 + j * 16, 2, 2);
    // vertical wallpaper lines
    ctx.fillStyle = wpDark;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 16, py, 1, TILE);
  } else if (LV.wallPattern === 'concrete') {
    // mottled concrete (Level 1 warehouse) — speckles + a horizontal seam
    ctx.fillStyle = wpLight;
    ctx.fillRect(px, py + 28, TILE, 2);
    ctx.fillStyle = wpDark;
    ctx.fillRect(px, py + 30, TILE, 1);
    // speckles (deterministic via tile coords)
    for (let i = 0; i < 8; i++) {
      const r1 = ((x * 71 + y * 17 + i * 13) % 64);
      const r2 = ((x * 31 + y * 47 + i * 23) % 64);
      ctx.fillStyle = i & 1 ? wpLight : wpDark;
      ctx.fillRect(px + r1, py + r2, 2, 2);
    }
  } else if (LV.wallPattern === 'pipes') {
    // pipe stripes (Level 2) — long vertical pipes + occasional red paint
    ctx.fillStyle = wpLight;
    ctx.fillRect(px + 8, py, 6, TILE);
    ctx.fillRect(px + 48, py, 4, TILE);
    ctx.fillStyle = wpDark;
    ctx.fillRect(px + 8, py, 1, TILE);
    ctx.fillRect(px + 13, py, 1, TILE);
    ctx.fillRect(px + 48, py, 1, TILE);
    ctx.fillRect(px + 51, py, 1, TILE);
    // valve circle on some tiles
    if (((x * 13 + y * 7) % 5) === 0) {
      ctx.fillStyle = '#a02a1a';
      ctx.fillRect(px + 22, py + 24, 16, 4);
      ctx.fillRect(px + 28, py + 18, 4, 16);
    }
  }
}

// Floor carpet dot pattern — subtle darker speckles for "yellow carpet" feel.
function renderCarpetDots() {
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== 0) continue;
      const seed = (x * 73 + y * 31) % 16;
      ctx.fillRect(x * TILE + (seed * 5) % TILE, y * TILE + (seed * 11) % TILE, 2, 2);
      ctx.fillRect(x * TILE + ((seed + 7) * 5) % TILE, y * TILE + ((seed + 3) * 11) % TILE, 2, 2);
    }
  }
}

function drawFurniture(h) {
  if (h.kind === 'sofa') {
    ctx.fillStyle = '#5a2a0c'; ctx.fillRect(h.x - 22, h.y - 8, 44, 16);
    ctx.fillStyle = '#7a3a14'; ctx.fillRect(h.x - 22, h.y - 16, 44, 9);
    ctx.fillStyle = '#a05828'; ctx.fillRect(h.x - 20, h.y - 14, 18, 6);
    ctx.fillRect(h.x + 2, h.y - 14, 18, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(h.x - 22, h.y + 7, 44, 2);
  } else if (h.kind === 'vending') {
    ctx.fillStyle = '#1a3a5e'; ctx.fillRect(h.x - 16, h.y - 22, 32, 38);
    ctx.fillStyle = '#2a5a8e'; ctx.fillRect(h.x - 14, h.y - 20, 28, 4);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(h.x - 10, h.y - 14, 20, 10);
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(h.x - 8, h.y - 2, 16, 2);
    ctx.fillStyle = '#0a1a2e'; ctx.fillRect(h.x - 6, h.y + 4, 12, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(h.x - 16, h.y + 15, 32, 2);
  } else {
    ctx.fillStyle = '#6b3a1c'; ctx.fillRect(h.x - 18, h.y - 12, 36, 18);
    ctx.fillStyle = '#8a5a2c'; ctx.fillRect(h.x - 18, h.y - 12, 36, 3);
    ctx.fillStyle = '#3a2a0c'; ctx.fillRect(h.x - 18, h.y + 4, 36, 2);
    ctx.fillStyle = '#5a2a0c'; ctx.fillRect(h.x - 16, h.y - 22, 4, 12); ctx.fillRect(h.x + 12, h.y - 22, 4, 12);
  }
  ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('HIDE', h.x, h.y - 24);
}

function drawItem(it) {
  if (it.type === 'flashlight') {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    drawIcon.flashlight(ctx, it.x, it.y, 22);
    ctx.shadowBlur = 0;
  } else if (it.type === 'battery') {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10;
    // simple AA-battery icon — fill a small rect
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(it.x - 7, it.y - 10, 14, 20);
    ctx.fillStyle = '#a87a14'; ctx.fillRect(it.x - 4, it.y - 12, 8, 2);
    ctx.fillStyle = '#1a1610'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('+', it.x, it.y + 3);
    ctx.shadowBlur = 0;
  } else if (it.type === 'smoke') {
    ctx.shadowColor = '#4cc9f0'; ctx.shadowBlur = 12;
    drawIcon.smokeBomb(ctx, it.x, it.y, 22);
    ctx.shadowBlur = 0;
  }
}

function drawMonster() {
  const wob = Math.sin(monsterWiggle) * 1.4;
  // Aggression-tinted body palette
  const bodyCol = monster.chase ? '#5a0d0d' : '#6b3a1c';
  // Dread aura beneath
  ctx.fillStyle = monster.chase ? 'rgba(120,0,0,0.45)' : 'rgba(40,20,8,0.4)';
  ctx.beginPath(); ctx.arc(monster.x, monster.y + wob, 44, 0, Math.PI * 2); ctx.fill();
  drawMonsterPug(ctx, monster.x, monster.y + wob, { size: 90, body: bodyCol });
  if (monster.chase) {
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 16;
    drawMonsterPug(ctx, monster.x, monster.y + wob, { size: 90, body: bodyCol, alpha: 0.5 });
    ctx.shadowBlur = 0;
  }
}

function drawHound(e) {
  // a four-legged dark shape with glowing eyes
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = e.state === 'chase' ? '#3a0a0a' : '#1a0a08';
  // body
  ctx.fillRect(e.x - 14, e.y - 4, 28, 12);
  // head (front-right)
  ctx.fillRect(e.x + 10, e.y - 6, 10, 10);
  // legs
  ctx.fillRect(e.x - 12, e.y + 8, 3, 6);
  ctx.fillRect(e.x - 4, e.y + 8, 3, 6);
  ctx.fillRect(e.x + 4, e.y + 8, 3, 6);
  ctx.fillRect(e.x + 12, e.y + 8, 3, 6);
  // tail
  ctx.fillRect(e.x - 18, e.y - 2, 5, 2);
  // glowing eyes
  ctx.fillStyle = e.state === 'chase' ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowColor = e.state === 'chase' ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowBlur = e.state === 'chase' ? 10 : 4;
  ctx.fillRect(e.x + 16, e.y - 4, 2, 2);
  ctx.fillRect(e.x + 18, e.y - 2, 2, 2);
  ctx.shadowBlur = 0;
  // little label
  if (e.state === 'chase') {
    ctx.fillStyle = '#ff8080'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('HOUND', e.x, e.y - 16);
  }
}

function drawSmiler(e) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.opacity);
  // dark body smudge
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.beginPath(); ctx.arc(e.x, e.y, 22, 0, Math.PI * 2); ctx.fill();
  // glowing eyes
  ctx.fillStyle = '#ffd23f';
  ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
  ctx.fillRect(e.x - 8, e.y - 4, 4, 4);
  ctx.fillRect(e.x + 4, e.y - 4, 4, 4);
  // grin (curve of teeth)
  ctx.fillStyle = '#ffffff';
  for (let i = -6; i <= 6; i += 2) {
    const yy = e.y + 6 + Math.abs(i) * 0.4;
    ctx.fillRect(e.x + i, yy, 2, 3);
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// CRAWLER — spider-pug, low to the floor. 8 legs splayed out, small body.
function drawCrawler(e) {
  const lunging = e.lungeT > 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  // legs (8 spindly ones)
  ctx.strokeStyle = lunging ? '#3a0a0a' : '#1a0a08'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.sin(e.t * 4 + i) * 0.15;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    const lx = e.x + Math.cos(a) * 16;
    const ly = e.y + Math.sin(a) * 8;
    ctx.lineTo(lx, ly);
    ctx.stroke();
  }
  // body
  ctx.fillStyle = lunging ? '#5a1a1a' : '#1a0a08';
  ctx.beginPath(); ctx.ellipse(e.x, e.y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  // head — small with red eyes
  ctx.fillStyle = '#0a0606';
  ctx.beginPath(); ctx.arc(e.x + 6, e.y - 2, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lunging ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowColor = lunging ? '#ff3a3a' : '#aa6630';
  ctx.shadowBlur = lunging ? 10 : 4;
  ctx.fillRect(e.x + 8, e.y - 3, 2, 2);
  ctx.fillRect(e.x + 8, e.y, 2, 2);
  ctx.shadowBlur = 0;
  if (lunging) {
    ctx.fillStyle = '#ff5050'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('LUNGE', e.x, e.y - 16);
  }
}

// WHISPERER — tall faint silhouette standing far away. Almost a person-shape.
function drawWhisperer(e) {
  // Faintness scales with how long the player has been gazing — barely visible
  // at first, then a little more opaque to hint at presence.
  const dist = Math.hypot(e.x - pug.x, e.y - pug.y);
  const baseA = Math.max(0.0, 0.18 + (e.gazeT || 0) * 0.15);
  // fade in based on distance window (60..520)
  const distFade = dist < 60 ? 0 : (dist > 520 ? 0 : 1);
  const a = Math.min(0.6, baseA * distFade);
  if (a < 0.02) return;
  ctx.save();
  ctx.globalAlpha = a;
  // tall silhouette
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - 9, e.y - 36, 18, 50);
  // head
  ctx.beginPath(); ctx.arc(e.x, e.y - 40, 8, 0, Math.PI * 2); ctx.fill();
  // arms hanging
  ctx.fillRect(e.x - 14, e.y - 28, 4, 28);
  ctx.fillRect(e.x + 10, e.y - 28, 4, 28);
  // hint of eyes — only when gazed enough
  if ((e.gazeT || 0) > 0.8) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x - 4, e.y - 42, 2, 2);
    ctx.fillRect(e.x + 2, e.y - 42, 2, 2);
  }
  ctx.restore();
}

// Small in-cell furniture (lamp / box / chair_small). Walk past — break sightline.
function drawSmallFurniture(f) {
  if (f.kind === 'lamp') {
    // base
    ctx.fillStyle = '#2a2218'; ctx.fillRect(f.x - 4, f.y + 6, 8, 4);
    // pole
    ctx.fillStyle = '#3a302a'; ctx.fillRect(f.x - 1, f.y - 8, 2, 14);
    // shade
    ctx.fillStyle = '#5a4a2a';
    ctx.beginPath();
    ctx.moveTo(f.x - 8, f.y - 8);
    ctx.lineTo(f.x + 8, f.y - 8);
    ctx.lineTo(f.x + 5, f.y - 18);
    ctx.lineTo(f.x - 5, f.y - 18);
    ctx.closePath(); ctx.fill();
    // tiny glow
    ctx.fillStyle = 'rgba(255,210,120,0.35)';
    ctx.beginPath(); ctx.arc(f.x, f.y - 10, 14, 0, Math.PI * 2); ctx.fill();
  } else if (f.kind === 'box') {
    // cardboard box
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(f.x - 11, f.y - 8, 22, 16);
    ctx.fillStyle = '#5a3e18'; ctx.fillRect(f.x - 11, f.y - 8, 22, 2);
    ctx.fillRect(f.x - 11, f.y - 1, 22, 1);
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(f.x - 11, f.y + 7, 22, 1);
    // tape line
    ctx.fillStyle = '#a08850'; ctx.fillRect(f.x - 1, f.y - 8, 2, 16);
  } else {
    // chair_small
    ctx.fillStyle = '#3a2810'; ctx.fillRect(f.x - 6, f.y - 12, 12, 4);
    ctx.fillStyle = '#5a3e1c'; ctx.fillRect(f.x - 7, f.y - 4, 14, 6);
    ctx.fillStyle = '#3a2810';
    ctx.fillRect(f.x - 6, f.y + 2, 2, 6); ctx.fillRect(f.x + 4, f.y + 2, 2, 6);
  }
}

// Big ceiling lights — pulsed white rects centered above 5-tile grid, with
// occasional dark "off" pulses (~0.3s) to break ambiance.
// Uses gameTime (sec) so we don't need to pass dt to render().
function drawBigCeilingLights() {
  const now = gameTime;
  for (const L of bigCeilingLights) {
    if (L.lastOnAt === undefined) { L.lastOnAt = now; L.lastOffAt = -10; }
    // Stay "on" until nextOff seconds elapse, then go "off" for offDur, then reset.
    const onTime = now - L.lastOnAt;
    let isOff = false;
    if (onTime > L.nextOff) {
      if (now - L.lastOffAt < L.offDur) isOff = true;
      else {
        L.lastOnAt = now; L.lastOffAt = -10;
        L.nextOff = 4 + Math.random() * 10;
      }
      if (L.lastOffAt < 0) L.lastOffAt = now;
    }
    const a = isOff ? 0.05 : 0.55;
    ctx.fillStyle = `rgba(255,250,220,${a})`;
    ctx.fillRect(L.x - 26, L.y - 6, 52, 12);
    ctx.fillStyle = `rgba(255,250,220,${a * 1.6})`;
    ctx.fillRect(L.x - 22, L.y - 3, 44, 6);
  }
}

function drawFlashlightCone() {
  const len = 380;
  const ang = Math.atan2(pugFaceY, pugFaceX);
  const half = Math.PI / 8; // ~22.5deg
  ctx.save();
  ctx.translate(pug.x, pug.y);
  ctx.rotate(ang);
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, 'rgba(255,235,150,0.55)');
  grad.addColorStop(0.6, 'rgba(255,235,150,0.18)');
  grad.addColorStop(1, 'rgba(255,235,150,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(half) * len, Math.sin(half) * len);
  ctx.lineTo(Math.cos(-half) * len, Math.sin(-half) * len);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateHud() {
  document.getElementById('hud-cans').textContent = `${5 - cans.length}/5`;
  const state = monsterDazedT > 0 ? 'SMOKED' : (monster.chase ? 'HUNTED!' : (soundLevel > 0.5 ? 'LOUD' : 'SAFE'));
  const el = document.getElementById('hud-state');
  el.textContent = state;
  el.style.color = monster.chase ? '#ff3a3a' : (soundLevel > 0.5 ? '#ffd23f' : '#5ef38c');
  const hudCard = document.querySelector('#hud .hud-card');
  if (hudCard) {
    if (monster.chase) {
      const k = 0.5 + Math.sin(performance.now() / 120) * 0.5;
      hudCard.style.boxShadow = `0 0 ${10 + k * 20}px rgba(255,58,58,${0.4 + k * 0.4})`;
    } else if (hudCard.style.boxShadow) {
      hudCard.style.boxShadow = '';
    }
  }
  // Sanity bar
  const sanBar = document.getElementById('hud-sanity-bar');
  if (sanBar) {
    sanBar.style.width = sanity + '%';
    sanBar.style.background = sanity > 60 ? '#5ef38c' : (sanity > 25 ? '#ffd23f' : '#ff3a3a');
  }
  // Battery bar
  const batBar = document.getElementById('hud-battery-bar');
  if (batBar) {
    batBar.style.width = battery + '%';
    batBar.style.background = battery > 50 ? '#ffd23f' : (battery > 15 ? '#ffa83a' : '#ff3a3a');
    batBar.style.boxShadow = flashlightOn ? '0 0 8px #ffd23f' : 'none';
  }
  // Smoke pip
  const smk = document.getElementById('hud-smoke');
  if (smk) smk.textContent = '× ' + smokeCount;
  document.getElementById('hud-depth').textContent = `Level ${level}`;
  const best = loadBest('backrooms-pug');
  document.getElementById('hud-best').textContent = best ? best.level : 0;
  const notesEl = document.getElementById('hud-notes');
  if (notesEl) notesEl.textContent = `${notesFoundCount()}/${NOTE_TOTAL}`;
}

function die(cause) {
  running = false;
  sfx.sweep(110, 40, 'sawtooth', 1.0, 0.3);
  silenceHum(0.6);
  const TITLES = {
    monster: 'SCREAMED', hound: 'TORN APART', smiler: 'GRINNED AT', sanity: 'LOST YOURSELF',
  };
  const SUBS = {
    monster: 'The giant pug found you.',
    hound: 'A hound caught your scent.',
    smiler: 'The grinning thing got you.',
    sanity: 'The hum took everything.',
  };
  document.getElementById('end-title').textContent = TITLES[cause] || 'SCREAMED';
  document.getElementById('end-sub').textContent = SUBS[cause] || 'The Backrooms claimed you.';
  document.getElementById('end-level').textContent = level;
  document.getElementById('end-cans').textContent = (level - 1) * 5 + (5 - cans.length);
  const chainsEl = document.getElementById('end-chains');
  if (chainsEl) chainsEl.textContent = noclipsChained | 0;
  const notesEndEl = document.getElementById('end-notes');
  if (notesEndEl) notesEndEl.textContent = `${notesFoundCount()}/${NOTE_TOTAL}`;
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

// Paint the start-screen notes-found counter (persisted across runs).
function paintStartNotesCounter() {
  const el = document.getElementById('start-notes');
  if (el) el.innerHTML = `Notes recovered: <b>${notesFoundCount()}/${NOTE_TOTAL}</b>`;
}
paintStartNotesCounter();
document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', () => { paintStartNotesCounter(); start(); });
function start() {
  level = 1; running = true;
  sanity = 100; battery = 50; flashlightOn = false; smokeCount = 0;
  // Reset jump-scare / ambient state
  gameTime = 0;
  jumpScareT = 0; jumpScareLife = 0; jumpScareKind = null;
  jumpScareCooldown = 0; redFlashT = 0;
  firstHoundJump = false; lastSmilerJumpAt = -999;
  ambientEvent = null;
  activeTriggerScare = null; lastTriggerScareAt = -999;
  // Reset noclip-chain + lore-note transient state for this run.
  noclipTransitionT = 0; noclipSwapped = false;
  noclipFromLabel = ''; noclipToLabel = '';
  noclipsChained = 0;
  activeNoteText = null;
  // Reset accumulators/Sets so a fresh run isn't tainted by the previous one
  // (held keys carrying over auto-walked the pug into a wall).
  keys.clear(); touchSneak = false;
  monsterWiggle = 0; lightFlicker = 0; heartBeatT = 0; breathT = 0;
  firstSeenScreamed = false; lastSanityTick = 0;
  popups = []; chaseVignetteT = 0; hitFlashT = 0; shakeT = 0; shakeMag = 0;
  noteUnfoldT = 0; catchSlowmoT = 0; sanityPulseT = 0; smokeDarkenT = 0; lastSanity = 100;
  scheduleAmbient(); scheduleDoorSlam(); scheduleWhisper();
  genLevel(level);
  ensureHum();
  ensureMusic();
  setHumTargetFor(archetype);
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
}
let lastT = performance.now();
(function loop(now) {
  let dt = Math.min((now - lastT) / 1000, 0.05);
  // Round 2C: slow-mo final frame on monster catch — drop dt to 25% for the
  // duration of catchSlowmoT so the world freezes briefly with juicy weight.
  if (catchSlowmoT > 0) dt *= 0.25;
  lastT = now; tick(dt); if (running) render();
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD walk · SHIFT sneak · B toggle flashlight · F smoke · find 5 cans, reach the EXIT', 7000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Stay near lights to keep sanity high.',
    'TIP: Hounds chase on sight — sneak instead of run.',
    'TIP: Smilers hate light — flash them to scare them off.',
    'TIP: Stand on furniture to HIDE from the giant pug.',
    'LORE: You noclipped through reality and now exist here.',
    'TIP: 30 notes are scattered across the layers — collect them.',
    'JOKE: Why is the wallpaper yellow? Don\'t ask.',
  ];
  const GAME_ID = 'backrooms-pug';
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
        if (best && (best.level || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: level ${best.level || best.score || 0}`;
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
    el.hidden = dur > 30;
  }
  const shareBtn = document.getElementById('wg-share');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const lvl = document.getElementById('end-level')?.textContent || '0';
      const cans = document.getElementById('end-cans')?.textContent || '0';
      const text = `🐶 BACKROOMS OF PUG — Reached level ${lvl} with ${cans} cans! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'BACKROOMS OF PUG', text, url: 'https://leobalkind.github.io/web-games/' });
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
