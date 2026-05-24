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
import { createSettingsMenu, caption, getMasterGain } from '../../src/shared/settingsMenu.js';
import { createAchievements } from '../../src/shared/achievements.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';
import { drawShadow as _depthShadow, depthSort as _depthSort } from '../../src/shared/depth3D.js';
import {
  showIntro as _cutIntro,
  showLevelCard as _cutLevelCard,
  showDeath as _cutDeath,
  showWin as _cutWin,
  showTutorial as _cutTutorial,
  showLevelSelect as _cutLevelSelect,
  isShowing as _cutIsShowing,
  hasSeenIntro as _cutHasSeenIntro,
  hasSeenTutorial as _cutHasSeenTutorial,
  loadLevelUnlocks as _cutLoadUnlocks,
  recordLevelReached as _cutRecordReached,
  recordLevelBestTime as _cutRecordBest,
  recordLastPlayed as _cutRecordLastPlayed,
} from './cutscenes.js';

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
      { wall: '#0a1820', light: '#244c66', dark: '#020608', label: 'submerged' },
      { wall: '#0e2832', light: '#286a78', dark: '#020608', label: 'deep cyan' },
    ],
  },
  // ===========================================================================
  // LEVEL 5 · POOLROOMS — pale blue tiles, shallow water everywhere, drips
  // echo down endless wet corridors. Water tiles slow you to a paw-paddle.
  // ===========================================================================
  poolrooms: {
    name: 'LEVEL 5 · POOLROOMS',
    sub: 'Endless tiled chambers. Shallow water. Something splashes far away.',
    floor: '#9abad0',
    floorAlt: '#86a8c0',
    floorGrout: '#3a5a72',
    wall: '#c4d6e0',
    wallLight: '#e0ecf2',
    wallDark: '#6a8294',
    fog: '#1a2832',
    hum: 110,
    lightTint: '#bce8ff',
    stainTint: 'rgba(40,70,90,$A)',
    wallPattern: 'tile',
    floorPattern: 'tile',
    spawnHounds: 1,
    spawnSmilers: 2,
    spawnCrawlers: 2,
    spawnWhisperers: 1,
    monsterSpeed: 1.3,
    wallpaperVariants: [
      { wall: '#c4d6e0', light: '#e6f0f6', dark: '#7a92a4', label: 'pale tile' },
      { wall: '#a8c4d4', light: '#d2e2ec', dark: '#5e7a8c', label: 'cool tile' },
      { wall: '#b8d2dc', light: '#dceaf0', dark: '#6e8898', label: 'chlorinated' },
      { wall: '#9eb8c4', light: '#c8dce4', dark: '#506878', label: 'wet tile' },
      { wall: '#aac0c8', light: '#d4e4e8', dark: '#5c7080', label: 'mildew tile' },
    ],
  },
  // ===========================================================================
  // LEVEL 6 · PARKING GARAGE — grey concrete pillars, oil-stained asphalt,
  // abandoned cars hulking in the dark. Half the strip lights are out cold.
  // ===========================================================================
  garage: {
    name: 'LEVEL 6 · PARKING GARAGE',
    sub: 'Concrete pillars. Oil pools. Distant drips. A car door slams.',
    floor: '#3a3e44',
    floorAlt: '#2c3036',
    floorGrout: '#14161a',
    wall: '#4a4e54',
    wallLight: '#686c74',
    wallDark: '#1a1c20',
    fog: '#0e1014',
    hum: 80,
    lightTint: '#e8eaf0',
    stainTint: 'rgba(8,8,10,$A)',
    wallPattern: 'concrete',
    floorPattern: 'parking',
    spawnHounds: 3,
    spawnSmilers: 1,
    spawnCrawlers: 2,
    spawnWhisperers: 2,
    monsterSpeed: 1.45,
    wallpaperVariants: [
      { wall: '#4a4e54', light: '#686c74', dark: '#1a1c20', label: 'raw concrete' },
      { wall: '#454850', light: '#6a6c74', dark: '#181a1e', label: 'oil-streaked' },
      { wall: '#42464c', light: '#5e6068', dark: '#16181c', label: 'soot' },
      { wall: '#4c4844', light: '#706a64', dark: '#1a1816', label: 'rusted rebar' },
      { wall: '#3e4248', light: '#5a5e64', dark: '#14161a', label: 'graffiti grime' },
    ],
  },
  // ===========================================================================
  // LEVEL 7+ · THE END — sparse vast red-lit office plain. Few walls, huge
  // rooms, a deep dental-drill drone. The exit is barely visible. Final.
  // ===========================================================================
  the_end: {
    name: 'LEVEL 7 · THE END',
    sub: 'Sparse red corridors stretching forever. The hum is a drill in your skull.',
    floor: '#2a0808',
    floorAlt: '#200606',
    floorGrout: '#080202',
    wall: '#3a0a0a',
    wallLight: '#5a1414',
    wallDark: '#0e0202',
    fog: '#080000',
    hum: 38,                     // dental-drill bass
    lightTint: '#ff3a3a',
    stainTint: 'rgba(20,0,0,$A)',
    wallPattern: 'wallpaper',
    floorPattern: 'carpet',
    spawnHounds: 3,
    spawnSmilers: 3,
    spawnCrawlers: 2,
    spawnWhisperers: 2,
    monsterSpeed: 1.6,
    wallpaperVariants: [
      { wall: '#3a0a0a', light: '#5a1414', dark: '#0e0202', label: 'blood crimson' },
      { wall: '#380c08', light: '#601a14', dark: '#0c0202', label: 'arterial' },
      { wall: '#420808', light: '#5e1010', dark: '#100000', label: 'oxidized' },
      { wall: '#2c0606', light: '#481010', dark: '#080000', label: 'black-red' },
      { wall: '#3e1010', light: '#682020', dark: '#100404', label: 'fevered' },
    ],
  },
};
// Cycle through archetypes as the player chains noclip-jumps. Order chosen for
// escalating dread — lobby is the soft start, the_end is the final pit.
// lvl 1=lobby, 2=warehouse, 3=pipes, 4=voidpool, 5=poolrooms, 6=garage, 7+=the_end.
const ARCHETYPE_CYCLE = ['lobby', 'warehouse', 'pipes', 'voidpool', 'poolrooms', 'garage', 'the_end'];
// Agent C: 7-level meta progression with a thematic name per floor. The
// archetype palette/AI still comes from LEVELS[archKey], but each "floor"
// gets its own name/intro line/difficulty rating for the cutscene + select UI.
// (Agent B updated 5/6/7 keys to point at the new dedicated archetypes.)
const LEVEL_LIST = [
  { idx: 1, key: 'lobby',     theme: 'lobby',     name: 'THE LOBBY',         diff: 1, sub: 'Endless yellow hallways. Damp tan carpet. The hum never stops.' },
  { idx: 2, key: 'warehouse', theme: 'warehouse', name: 'THE WAREHOUSE',     diff: 2, sub: 'Concrete walls and exposed beams. Something growls in the dark.' },
  { idx: 3, key: 'pipes',     theme: 'pipes',     name: 'PIPE DREAMS',       diff: 3, sub: 'Hissing pipes. Steam blocks vision. Watch the dark.' },
  { idx: 4, key: 'voidpool',  theme: 'voidpool',  name: 'THE VOID POOL',     diff: 4, sub: 'Cold inky water. Things swim under the floor.' },
  { idx: 5, key: 'poolrooms', theme: 'poolrooms', name: 'POOLROOMS',         diff: 4, sub: 'Blue-tiled corridors. Always wet. Always echoing.' },
  { idx: 6, key: 'garage',    theme: 'parking',   name: 'PARKING GARAGE',    diff: 5, sub: 'Concrete columns. Fluorescent dread. They circle in pairs.' },
  { idx: 7, key: 'the_end',   theme: 'end',       name: 'THE END',           diff: 5, sub: 'No more floors. Only the way out.' },
];
const MAX_LEVEL = LEVEL_LIST.length; // 7 — finishing this triggers the win cutscene
function levelArchetypeFor(lvl) {
  // For floors 1..MAX_LEVEL use the explicit mapping. Beyond that, cycle.
  const entry = LEVEL_LIST[Math.max(1, lvl) - 1];
  if (entry) return entry.key;
  const idx = (Math.max(1, lvl) - 1) % ARCHETYPE_CYCLE.length;
  return ARCHETYPE_CYCLE[idx];
}
function levelInfoFor(lvl) {
  const entry = LEVEL_LIST[Math.max(1, Math.min(MAX_LEVEL, lvl)) - 1];
  return entry || LEVEL_LIST[0];
}
// Per-level monster scaling. >1.0 means monsters move faster and spawn more.
// Caps at 2.0 to keep runs theoretically winnable.
function monsterScaleFor(lvl) {
  return Math.min(2.0, 1.0 + (lvl - 1) * 0.10);
}
// Inflate level dimensions per chain step so deeper levels feel vaster.
// lvl 1 → 1.0, lvl 2 → 1.15, ... cap at 1.5 so render budget stays sane.
function levelSizeMul(lvl) {
  return Math.min(1.5, 1.0 + (Math.max(1, lvl) - 1) * 0.15);
}
// Tiny snapshot of the current level so cutscene/intro overlays (Agent C)
// can read it without poking internals. Updated at end of genLevel().
let currentLevelInfo = { name: '', theme: '', lvl: 0 };

// ============================================================================
// LORE NOTES — 60 cryptic Backrooms-canon fragments organised into 7 themed
// banks, one per level archetype. Round-2 expansion (was 30). Each note has a
// stable id (its index in the array) so persistence dedupes. The themed banks
// give each level a distinct flavour for note discovery; spawner prefers notes
// from the current level's bank but falls back to ANY undiscovered note if the
// bank is exhausted, so completionists never get stuck.
// Banks (id ranges):
//   LOBBY      0..9   — OFFICE LIFE
//   WAREHOUSE  10..19 — STORAGE
//   PIPES      20..29 — INFRASTRUCTURE
//   VOIDPOOL   30..39 — THE DEEP
//   POOLROOMS  40..47 — TILES & WATER
//   GARAGE     48..53 — UNDERGROUND
//   THE END    54..59 — DESCENT
// ============================================================================
const LORE_NOTES = [
  // ---- LOBBY (0..9) OFFICE LIFE ----
  "Day 47. The smell of mildew has stopped registering. I think I'm becoming one of them.",
  "If you see a hallway you've already walked through but the wallpaper is yellower — turn back. That's not the same hall.",
  "The hum is in B-flat. It has always been in B-flat. I don't think it's coming from the lights.",
  "Found a vending machine. The cans were already open. I drank one anyway.",
  "Whoever wrote 'NOT THE EXIT' on this wall — bless you. I would have walked right in.",
  "I haven't slept. I haven't been tired. I haven't been anything for a while now.",
  "The lobby is not the start. The lobby is just the part we're allowed to remember.",
  "Found a memo pad on the floor. Page 1: BUY MILK. Pages 2-200: THE WALLS ARE BREATHING.",
  "There's a water cooler that's full. I haven't drunk in a week. I'm not thirsty. That's the worst part.",
  "Saw a man in a suit walk past three times in three different directions. Same man. Same minute. Different hall.",
  // ---- WAREHOUSE (10..19) STORAGE ----
  "Three hounds in the warehouse. They circle but don't enter the lit squares. Stay under the lights.",
  "Found Marcus's flashlight. Marcus is not with the flashlight.",
  "Crates labeled DO NOT OPEN. I didn't. Then I came back and they were already open. Empty.",
  "The forklift won't start. The keys are inside. The driver is not.",
  "Every crate I've opened has held one thing: another smaller crate. I'm not opening more.",
  "Wrote my name in spray-paint. Came back later. The paint had drifted three tiles to the left.",
  "There's a pug here who answers questions. Don't ask any. The answers are correct.",
  "I built a fort out of cardboard boxes. The fort was gone in the morning. So were two of my paws. They grew back.",
  "Smoke alarm went off for six hours. There was no smoke. The alarm hasn't shut up since.",
  "Found a clipboard. INVENTORY: 47 souls. Crossed out. Recount: 48. I am 48.",
  // ---- PIPES (20..29) INFRASTRUCTURE ----
  "The pipes never end. I followed one for what felt like a day. It went back to where it started, then kept going.",
  "Steam vents in Level 2 mean nothing. The steam is for us, not the monsters. So we don't see.",
  "Found a valve. Turned it. Heard screaming from three floors below me. Turned it back.",
  "Listen to the pipes when they hiss. They aren't venting. They're talking.",
  "The water in the pipes isn't water. I tested. It IS water now. I think it changes when you look.",
  "There's a service hatch in the ceiling. It opens downward. I haven't figured out how that works.",
  "If you put your ear to a pipe you hear your own breathing. Don't. You'll hear it stop before you do.",
  "Every fifth pipe is warmer than the others. Don't touch them. Don't ask why I know.",
  "Smiler in the steam. It pretended to be a valve handle. I almost grabbed it.",
  "The maintenance manual is missing pages 14-94. The pages I have say nothing useful.",
  // ---- VOIDPOOL (30..39) THE DEEP ----
  "The Void Pool isn't a pool. It's what's under all the other floors when you stop being polite about it.",
  "Bioluminescent fish below. They don't have eyes. They don't need them. They know I'm here.",
  "The water is exactly body temperature. That's not a coincidence. That's a welcome.",
  "I held my breath and went under. Came up an hour later. I never breathed in. I'm not sure I ever needed to.",
  "Something brushed my leg. I am wearing armor. I felt it through the armor. Then I had no armor.",
  "Bottom of the pool has a drain. The drain leads to a hallway. The hallway has a pool.",
  "The fish glow brighter when I'm afraid. I am trying very hard not to be afraid.",
  "Found a diving mask. The eye-holes are clouded. I see better through them than without.",
  "There's a song down here. Three notes, looping. I am humming it without meaning to.",
  "I think the pool is the bottom. I think everything else is the pool pretending.",
  // ---- POOLROOMS (40..47) TILES & WATER ----
  "Pool noodle in the corner. Yellow. Foam intact. Don't ask how. It works.",
  "Every tile in this room is exactly the same. So is every room.",
  "Drain in the corner. Hair around it. The hair is moving. The drain is not.",
  "I lay down on the tile floor and slept. I dreamed of being a tile. I woke up flat.",
  "The water never gets deeper. The water never gets shallower. The water is just there.",
  "Found a pug in the deep end. It was floating face-up. It smiled and waved. I waved back.",
  "There's a lifeguard chair, empty, but the whistle on it works. I blew it once. Don't.",
  "The chlorine smell is real. It is the ONLY real thing here. I cherish it.",
  // ---- GARAGE (48..53) UNDERGROUND ----
  "Found a parked car. Keys in ignition. Engine on. No one's been here in years. Tank's full.",
  "Three pugs in party hats around something on the floor. I didn't get close. I don't want to know.",
  "Half the parking spots are taken. I haven't seen another soul. Where are the drivers?",
  "Car alarm went off for forty minutes. Different car each time. Each car was empty.",
  "Concrete pillar number 47-B has a name carved into it. The name changes when I look away.",
  "There is no UP-RAMP. There is only DOWN. I have been driving down for what I think was years.",
  // ---- THE END (54..59) DESCENT ----
  "The red lights aren't lights. They're eyes. They blink when I'm not looking.",
  "I dreamed of grass yesterday. I think I dreamed it. I'm not sure I knew what grass was anymore.",
  "Sanity is a battery. You keep finding sockets but never the wall.",
  "I am going to noclip out. If you find this, don't follow. There is no out.",
  "EXIT SIGN visible from anywhere. EXIT SIGN never gets closer. EXIT SIGN watches.",
  "If you read this, you made it. I am proud of you. I am also still here. Get out.",
];
const NOTE_TOTAL = LORE_NOTES.length;
const NOTES_KEY = 'backrooms-pug:notes';
// Per-level note id ranges so spawner can pick a level-appropriate note. Maps
// archetype key → [startId, endIdInclusive]. Range checks honour bank size.
const LORE_BANKS = {
  lobby:     [0,  9],
  warehouse: [10, 19],
  pipes:     [20, 29],
  voidpool:  [30, 39],
  poolrooms: [40, 47],
  garage:    [48, 53],
  the_end:   [54, 59],
};
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
// ACHIEVEMENTS — Round 2 expansion. 5 hidden achievements unlocked via gameplay
// trackers (resetRunAchievementTrackers + checks throughout tick/genLevel/die).
// All unlocks are persisted via the shared achievements module so they carry
// across runs and profiles.
// ============================================================================
const ach = createAchievements('backrooms-pug', {
  ghost:       { name: 'GHOST',       desc: 'Complete a level without using the flashlight.', icon: '👻' },
  pacifist:    { name: 'PACIFIST',    desc: 'Complete a full level without triggering any jumpscare.', icon: '☮' },
  speedrun:    { name: 'SPEEDRUN',    desc: 'Complete level 1 in under 90 seconds.', icon: '⚡' },
  survivor:    { name: 'SURVIVOR',    desc: 'Reach level 5.', icon: '🏃' },
  enlightened: { name: 'ENLIGHTENED', desc: 'Discover every lore note (60/60).', icon: '✦' },
  lore_complete: { name: 'LORE COMPLETE', desc: 'All 60 lore notes recovered. The codex is whole.', icon: '📖' },
});
// Per-run achievement trackers — wiped on each level start by genLevel via
// resetLevelAchievementTrackers(). The run-wide "noFlashlight" flag resets in
// startRun.
let achLevelFlashlightUsed = false;   // any toggleFlashlight that turned it ON
let achLevelJumpscareTriggered = false; // any non-ambient jumpScare fire
function resetLevelAchievementTrackers() {
  achLevelFlashlightUsed = false;
  achLevelJumpscareTriggered = false;
}
// Called when a level completes successfully (player reaches exit). Awards any
// per-level achievements that the trackers permit. `lvl` = the level just
// cleared; `lvlElapsed` = seconds taken to clear it.
function checkLevelClearAchievements(lvl, lvlElapsed) {
  try {
    if (!achLevelFlashlightUsed) ach.unlock('ghost');
    if (!achLevelJumpscareTriggered) ach.unlock('pacifist');
    if (lvl === 1 && lvlElapsed < 90) ach.unlock('speedrun');
  } catch {}
}
function checkLoreCompleteAchievement() {
  try {
    if (notesFoundCount() >= NOTE_TOTAL) {
      ach.unlock('enlightened');
      ach.unlock('lore_complete');
    }
  } catch {}
}

// ============================================================================
// ALMOND WATER — 1 per level, glows blue, drinking (E within ~28px) restores
// 50 sanity + adds 30s of flashlight battery (capped at 100). Counter shown on
// HUD via `almondWaterCollected` tally; reset per run in startRun().
// ============================================================================
let almondWaters = [];                // [{x, y}]
let almondWaterCollected = 0;         // per-run collected count

// ============================================================================
// PER-LEVEL MUTATORS — 30% per level chance to apply one of 5 mutators that
// alter game pacing. Display the mutator name briefly at the top of the level
// (via popup). Mutators last the duration of the level only — reset in genLevel.
// ============================================================================
const MUTATORS = [
  { id: 'darker',   name: 'DARKER',   desc: 'flashlight drains 1.5x' },
  { id: 'foggy',    name: 'FOGGY',    desc: 'view radius reduced' },
  { id: 'haunted',  name: 'HAUNTED',  desc: 'extra ambient scares' },
  { id: 'silent',   name: 'SILENT',   desc: 'no monster footsteps' },
  { id: 'inverted', name: 'INVERTED', desc: 'controls inverted' },
];
let activeMutator = null;             // { id, name, desc } or null
let mutatorBannerT = 0;               // seconds remaining of the name banner

// ============================================================================
// MAP COLLECTIBLE — a single hidden symbol scratched into a random wall tile
// per level. Finding (within ~30px) marks it found, awards a lore note + adds
// 1 toward the 7-shard unlock for the EASTER EGG "MEMORY" archetype.
// Persisted across runs via localStorage 'backrooms-pug:sigils'.
// ============================================================================
let mapSigil = null;                  // { x, y, found } for current level
const SIGIL_KEY = 'backrooms-pug:sigils';
function loadSigilCount() {
  try {
    const raw = localStorage.getItem(profileKey(SIGIL_KEY));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}
function saveSigilCount(n) {
  try { localStorage.setItem(profileKey(SIGIL_KEY), String(n | 0)); } catch {}
}
function addSigil() {
  const n = Math.min(7, loadSigilCount() + 1);
  saveSigilCount(n);
  return n;
}

// ============================================================================
// PARTYGOERS — Garage-only NEW monster. 3 pugs in party hats that party in a
// circle around a focal point. If player walks within 30px of ANY of them →
// all 3 shriek and chase together. Easier per-pug than the main monster but
// pack pressure. State stored in `partygoers` array — separate from `entities`
// so the existing monster-AI core is not touched.
// ============================================================================
let partygoers = [];                  // [{ x, y, hatColor, partyCx, partyCy, partyAngle, partyRadius, state, t, alertedT, speed }]
let partyAlertedT = 0;                // shared timer once they shriek (so they synchronously chase)

// ============================================================================
// PER-ARCHETYPE UNIQUE MECHANIC — one MEMORABLE thing per level. Wired into
// genLevel + tick + render as appropriate. Most are cosmetic / event-driven so
// they don't bloat the bundle or touch the monster AI core.
//   LOBBY:     yellow notepad item — picking up flashes a dev note overlay
//   WAREHOUSE: forklift sprite — collision blocker (sets a special obstacle)
//   PIPES:     water-drop splash events from ceiling (audio + tiny splash pop)
//   VOIDPOOL:  bioluminescent fish (cosmetic, scared by player proximity)
//   POOLROOMS: pool noodle item — temporary weapon, whacks crawler back 80px
//   GARAGE:    car alarm event — random car's lights flash, attracts monster
//   THE END:   single visible EXIT SIGN red, visible-from-anywhere, win on reach
// ============================================================================
let yellowNotepad = null;             // { x, y, used } — LOBBY only
let yellowNoteFlashT = 0;             // seconds remaining of dev-note overlay
let yellowNoteText = '';
let forklift = null;                  // { x, y, w, h } — WAREHOUSE only (collision)
let waterDrops = [];                  // [{ x, y, t, life }] active drops (PIPES only)
let nextWaterDropAt = 999999;         // scheduled gameTime for next water drop
let bioFish = [];                     // [{ x, y, vx, vy, color, scaredT }] — VOIDPOOL only
let poolNoodleItem = null;            // { x, y } in-world pickup — POOLROOMS only
let poolNoodleCharges = 0;            // per-run charges (1 per pickup, single use)
let nextCarAlarmAt = 999999;          // scheduled gameTime for next garage car alarm
let activeCarAlarm = null;            // { car, t, life } — garage only
let endExitSign = null;               // { x, y } — THE END only, glowing red beacon
// Dev notepad strings — picked randomly per pickup.
const DEV_NOTES = [
  '// TODO: fix the wallpaper bug',
  '// note: do NOT noclip past floor 7',
  '// MEMORY archetype is just a placeholder',
  '// the hum is supposed to be in A. nobody noticed.',
  '// players love the smiler. nobody knows why.',
  '// did we ship the exit yet? -unanswered',
];

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
let jumpScareKind = null;     // 'monster' | 'hound' | 'smiler' | 'crawler' | 'whisperer' | 'ambient' | 'phantom' | 'reflection'
let jumpScareCooldown = 0;    // seconds remaining of "no real jumpscare" cooldown
let redFlashT = 0;            // seconds remaining of red full-screen flash overlay
// 3-frame flicker entrance: counts 0..3 across first ~90ms so the face appears
// then vanishes then re-appears for a strobe-style terror effect.
let jumpScareFlickerT = 0;    // time since scare fired (for flicker math)
let jumpScareMaxAudioT = 0;   // when > 0, scream audio plays at MAX gain (overrides settings)
// PHANTOM scare state (random fake-out flash, no monster involved) ----------
let phantomT = 0;             // seconds remaining on phantom flash
let phantomKind = null;       // 'phantom' | 'reflection'
let nextPhantomAt = 999999;   // scheduled gameTime for next phantom scare
let phantomCooldown = 0;      // separate short cooldown so phantoms can stack with monster scares
// PERIPHERAL DOORWAY GLIMPSE — silhouette near screen edge ------------------
let peripheralT = 0;          // seconds remaining of peripheral silhouette
let peripheralSide = 0;       // -1 left, +1 right, 0 top, 2 bottom
let nextPeripheralAt = 999999;
// EYES IN DARK — two glowing eyes briefly visible in unlit area --------------
let eyesT = 0;
let eyesX = 0, eyesY = 0;     // screen-space coords
let eyesDriftX = 0;
let nextEyesAt = 999999;
// LURKER REVEAL — when player approaches with flashlight on, Agent A's render
// reads this flag to draw the EYES-IN-DARK overlay on the nearest lurker.
let lurkerVisibleT = 0;
let lurkerVisibleX = 0, lurkerVisibleY = 0;
// MONSTER POSITIONAL AUDIO ACCUMULATORS — gate footstep + growl emission rate.
let monsterFootstepT = 0;
let monsterGrowlT = 0;
let monsterSniffT = 0;
let monsterBreathT = 0;
// MONSTER AI 3-state machine. 'idle' wanders, 'hunting' searches last-known,
// 'chase' full pursuit. Stored on monster.aiState (initialized in genLevel).
// Telegraph timers track how long since each state condition was met.
let monsterHuntingT = 0;        // seconds in hunting state
let monsterLostContactT = 0;    // seconds since last visual/audio contact
let monsterWanderRefreshAt = 0; // gameTime when monster picks a new wander target
// BLACKOUT — all lights go OUT for 1.5-2.5s every 60-120s -------------------
let blackoutT = 0;            // seconds remaining of current blackout (0 = lights on)
let blackoutLife = 0;         // total duration of current blackout
let nextBlackoutAt = 999999;
// DYING BULB — one specific big-light dims/erratically-flickers then dies ---
let dyingBulb = null;         // ref to a bigCeilingLights entry (or null)
let dyingBulbT = 0;           // seconds since the dying-bulb event started
let dyingBulbLife = 30;       // 30s before it goes permanently dark
let nextDyingBulbAt = 999999;
// STROBOSCOPIC — red+white strobe at 6Hz when sanity < 30 (random spike) ----
let stroboT = 0;
let nextStroboAt = 999999;
// STATIC/NOISE WASH — persistent pink-noise layer, intensifies when monster near
let staticNoiseNode = null;
let staticNoiseGain = null;
// FOOTSTEPS YOU DIDN'T MAKE — psychological scare while standing still ------
let stillT = 0;               // seconds player has been stationary
let nextGhostStepAt = 999999;
// WHISPERS — multiple panned voices when sanity < 50 -----------------------
// (handled inline by playPannedWhisper)
let lastHoundSeenIds = new Set(); // hound entity refs that have triggered first-sight
let firstHoundJump = false;   // first hound-jumpscare per match
let lastSmilerJumpAt = -999;  // last time we fired smiler jump-scare (gameTime)
let gameTime = 0;             // total seconds elapsed in current run
// =============================================================================
// PSYCHIC FLASH — every 5-7.5 min of game time (relative wall clock), a brief
// 1-second white flash reveals the level map: walls + cans + exit pinged in
// neon as a top-down overlay. Helps players who've been wandering for ages.
// =============================================================================
let psychicFlashT = 0;          // seconds remaining of active reveal (0..1)
let nextPsychicFlashAt = 0;     // gameTime at which next flash fires
function _schedulePsychicFlash() {
  // 5-7.5 min into the run (or relative to the last flash). Random-ish.
  nextPsychicFlashAt = gameTime + 300 + Math.random() * 150;
}
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
let currentWallpaper = null;  // chosen wallpaper variant for this level (fallback)
// MAP-OVERHAUL state (Agent B) ---------------------------------------------
// Per-tile wallpaper-variant index (each room paints with its own variant so
// you visually feel zone changes while moving). 0..N-1 where N is the
// current archetype's wallpaperVariants.length.
let roomWallpaperIdx = [];     // [row][col] → variant index (walls only)
let roomTileMap = [];          // [row][col] → room id or -1
let rooms = [];                // {minX,minY,w,h,kind,wpIdx,safeUntil}
let safeRoomT = 0;             // seconds remaining of safe-room monster suppression
let currentRoomId = -1;        // room id pug currently stands inside
// Closed doors (player presses E to open; some auto-close behind you).
let closedDoors = [];          // {tx, ty, vertical, glass, t, autoClose, closing}
// Secret rooms: hidden behind a fake wall — walk into wall to reveal.
let secretWalls = [];          // {tx, ty, vertical, revealed}
let secretRoomRevealedT = 0;   // seconds since last reveal (for popup)
// Water tiles (slow player) and bioluminescent fungi (decoration that glows).
let waterTiles = [];           // { tx, ty } flagged for slow + ripples
let fungi = [];                // { x, y, r, color } little glowing dots
// Parking-garage props: abandoned cars (obstacle + sightline blocker).
let garageCars = [];           // { x, y, w, h, color, smashed }
let garageRamps = [];          // { x, y } open-ramp markers (visual only)
// Environmental storytelling props (filing cabinets, water coolers, etc).
let envProps = [];             // {x, y, kind, used}
let waterCoolers = [];         // { x, y, used } single-use sanity restore
// New rare/usable items.
let talismanItems = [];        // { x, y } — pick up = 1 stun charge
let mapFragments = [];         // { x, y } — pick up = exit-revealed timer
let cigaretteItems = [];       // { x, y } — pick up = lit puff (+sanity -battery)
let talismanCharges = 0;       // owned stuns (E to use)
let mapFragmentRevealT = 0;    // seconds remaining of "exit-glow" buff
// Dead-end rooms (only 1 entrance; high-loot).
let deadEndRoomIds = new Set();
// Reveal-secret prompt
let secretPromptText = null;
let secretPromptT = 0;
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
// Agent C: gameplay pause flag + cutscene gating. When `paused` or
// `levelCardShowing` is true, tick() short-circuits monster AI/movement.
let paused = false;
let levelCardShowing = false;
// Tracks the run's start time so we can show "TIME SURVIVED" on the death card.
let runStartT = 0;
// Per-level start time (resets every genLevel) — used to record best-time per level.
let levelStartT = 0;
// Agent #5: REPLAY RING BUFFER — last ~5s of player/monster/entity positions
// at ~30fps (150 frames, ~12KB at peak). Drawn as ghost outlines on death.
const _REPLAY_FPS = 30, _REPLAY_MAX = 150;
const replayBuffer = [];
let replayAcc = 0, replayActive = false, replayElapsed = 0, replayDoneCb = null;
let _replayOverlayEl = null;
function recordReplayFrame(dt) {
  if (!pug || !monster) return;
  replayAcc += dt;
  if (replayAcc < 1 / _REPLAY_FPS) return;
  replayAcc = 0;
  const ents = entities ? entities.slice(0, 6).map(e => ({ x: e.x, y: e.y })) : [];
  if (replayBuffer.length >= _REPLAY_MAX) replayBuffer.shift();
  replayBuffer.push({ px: pug.x, py: pug.y, mx: monster.x, my: monster.y,
    mch: !!monster.chase, cx: cam ? cam.x : pug.x, cy: cam ? cam.y : pug.y, ents });
}
function startReplay(doneCb) {
  if (replayBuffer.length < 10) { try { doneCb && doneCb(); } catch {} return; }
  replayActive = true; replayElapsed = 0; replayDoneCb = doneCb || null;
}
function stopReplay() {
  replayActive = false;
  const cb = replayDoneCb; replayDoneCb = null;
  if (cb) try { cb(); } catch {}
}
function renderReplayGhosts() {
  if (!replayActive || !replayBuffer.length) return;
  const fr = replayBuffer[Math.min(replayBuffer.length - 1, Math.floor(replayElapsed * _REPLAY_FPS))];
  if (!fr) return;
  ctx.save(); ctx.globalAlpha = 0.55;
  ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(fr.px, fr.py, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(76,201,240,0.18)'; ctx.fill();
  ctx.strokeStyle = fr.mch ? '#ff3a3a' : '#ff8e3c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(fr.mx, fr.my, 32, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1.5;
  for (const e of fr.ents) { ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(fr.px, fr.py); ctx.lineTo(fr.mx, fr.my); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();
}
function showReplayOverlayHud() {
  if (_replayOverlayEl) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);'
    + 'background:rgba(10,7,22,0.85);border:2px solid #4cc9f0;border-radius:6px;padding:8px 16px;'
    + 'color:#4cc9f0;font-family:"Press Start 2P",monospace;font-size:0.6rem;letter-spacing:0.16em;'
    + 'z-index:200;box-shadow:0 0 16px rgba(76,201,240,0.5);pointer-events:none;';
  el.textContent = '▶ REPLAY · LAST 5s';
  document.body.appendChild(el); _replayOverlayEl = el;
}
function hideReplayOverlayHud() {
  if (_replayOverlayEl) { _replayOverlayEl.remove(); _replayOverlayEl = null; }
}

function shake(mag, dur) { const k = _shakeMul(); shakeMag = Math.max(shakeMag, mag * k); shakeT = Math.max(shakeT, dur); }
// True if reduced-motion is active (settings toggle OR OS pref). Scares still
// render but skip jitter/flicker/shake so motion-sensitive players see a static
// face rather than a strobing one. _shakeMul() returns 0 here, so we leverage it.
function isReducedMotion() {
  try {
    if (document.body && document.body.classList.contains('reduced-motion')) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {}
  return false;
}
function pop(x, y, text, color) {
  if (popups.length > 60) popups.shift();
  // Round 2C: lateral spawn velocity so popups don't stack on each other
  popups.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -50, life: 0, max: 0.9, text, color: color || '#5ef38c' });
}
function nowSec() { return performance.now() / 1000; }
function silenceHum(durSec) { humSilenceUntil = Math.max(humSilenceUntil, nowSec() + durSec); }

// ============================================================================
// JUMP SCARE — DOMINATING full-viewport face + 6-layer scream + heavy shake.
// `kind` ∈ 'monster' | 'hound' | 'smiler' | 'crawler' | 'whisperer'
//       | 'ambient' | 'phantom' | 'reflection'.
// Phantom/reflection bypass the 30s "real" cooldown (own short cooldown).
// Ambient = no-damage fake. Real scares hold full-screen for 0.8s then fade
// over 0.5s (total 1.3s life). Entrance has a 3-frame flicker (visible,
// hidden, visible) across the first ~120ms for terror effect.
// ============================================================================
function jumpScare(kind) {
  if (!running) return;
  const ambient = kind === 'ambient';
  const phantomLike = kind === 'phantom' || kind === 'reflection';
  if (!ambient && !phantomLike && jumpScareCooldown > 0) return;
  // Track for PACIFIST achievement — any non-ambient (=real) jumpscare disqualifies.
  if (!ambient) achLevelJumpscareTriggered = true;
  if (!ambient && !phantomLike) jumpScareCooldown = 30;
  jumpScareKind = kind;
  if (ambient) jumpScareLife = 0.45;
  else if (kind === 'phantom') jumpScareLife = 0.3;
  else if (kind === 'reflection') jumpScareLife = 0.4;
  else jumpScareLife = 1.3;                 // 0.8s hold + 0.5s fade
  jumpScareT = jumpScareLife;
  jumpScareFlickerT = 0;
  redFlashT = ambient ? 0.0 : (phantomLike ? 0.08 : 0.15);
  if (!ambient && !phantomLike) {
    // Max-out audio for the first 0.5s of the scare (overrides settings gain).
    jumpScareMaxAudioT = 0.5;
    shake(22, 0.45);
    sanity = Math.max(0, sanity - 25);
    silenceHum(1.0);
    const label = kind === 'hound' ? 'HOUND SCREAM'
                : kind === 'smiler' ? 'SMILER SCREAM'
                : kind === 'crawler' ? 'CRAWLER SHRIEK'
                : kind === 'whisperer' ? 'WHISPERER WAIL'
                : kind === 'monster' ? 'MONSTER SCREAM' : 'SCREAM';
    try { caption('[' + label + ']', 1400); } catch {}
    // 6-LAYER SCREAM — sweep + square mid + noise + 60Hz sub + 1200Hz shriek + 200Hz growl.
    // Total combined gain ~0.8 to be much louder than the old 0.4.
    try {
      sfx.sweep(900, 200, 'sawtooth', 0.34, 0.50);        // L1 main sweep
      sfx.tone(600, 'square', 0.22, 0.30);                // L2 square mid
      sfx.noise(0.22, 0.40, 400);                         // L3 noise burst
      sfx.tone(60, 'sine', 0.45, 0.55);                   // L4 60Hz sub thump
      sfx.tone(1200, 'square', 0.18, 0.28);               // L5 1200Hz shriek
      sfx.tone(200, 'sawtooth', 0.24, 0.45);              // L6 200Hz growl
      // Detuned re-layer 40ms later for grit + perceived loudness
      setTimeout(() => running && sfx.sweep(720, 160, 'square', 0.22, 0.22), 40);
      setTimeout(() => running && sfx.tone(80, 'sine', 0.30, 0.30), 60);
    } catch {}
  } else if (phantomLike) {
    // Phantom = brief flash, no sanity drop but a small dread tax
    sanity = Math.max(0, sanity - (kind === 'reflection' ? 4 : 2));
    phantomCooldown = 8;
    silenceHum(0.4);
    shake(8, 0.18);
    try {
      caption(kind === 'reflection' ? '[REFLECTION]' : '[FACE FLASH]', 900);
      sfx.sweep(1100, 300, 'sawtooth', 0.30, 0.18);
      sfx.tone(70, 'sine', 0.35, 0.20);
      sfx.noise(0.18, 0.18, 600);
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
  activeTriggerScare = { kind, t: 0, life: 1.4 };
  shake(14, 0.45);
  sanity = Math.max(0, sanity - 8);
  silenceHum(0.5);
  jumpScareMaxAudioT = 0.4;
  try {
    if (kind === 'mirror') {
      sfx.sweep(1200, 320, 'sawtooth', 0.40, 0.50);
      sfx.tone(60, 'sine', 0.50, 0.50);
      sfx.tone(1400, 'square', 0.22, 0.18);
      sfx.noise(0.18, 0.30, 600);
      caption('[MIRROR SHRIEK]', 1300);
    } else if (kind === 'hand') {
      sfx.noise(0.24, 0.45, 800);
      sfx.tone(120, 'sine', 0.36, 0.40);
      sfx.sweep(440, 180, 'sawtooth', 0.20, 0.30);
      caption('[SKITTERING HANDS]', 1300);
    } else if (kind === 'shadow') {
      sfx.sweep(1400, 600, 'square', 0.45, 0.40);
      sfx.tone(180, 'sawtooth', 0.30, 0.35);
      sfx.noise(0.18, 0.20, 400);
      caption('[SHADOW SHRIEK]', 1300);
    } else if (kind === 'whisper') {
      sfx.noise(0.28, 0.40, 200);
      sfx.tone(220, 'sine', 0.55, 0.35);
      sfx.tone(440, 'triangle', 0.22, 0.30);
      shake(22, 0.55);
      caption('[LOUD WHISPER]', 1400);
    }
  } catch {}
}

// =========================================================================
// CUTSCENE ASSIST — short tailored stinger by type. Public so cutscene
// flows (owned by Agent C) can call playScareSting('doom'|'reveal'|...).
// =========================================================================
function playScareSting(type) {
  try {
    if (type === 'doom') {
      // Descending strings — minor 2nd cascade
      const notes = [440, 415, 392, 370, 349];
      notes.forEach((f, i) => setTimeout(() => running !== false && sfx.tone(f, 'triangle', 0.30, 0.35), i * 110));
      sfx.tone(55, 'sine', 0.40, 0.80);
      caption('[DOOM]', 1200);
    } else if (type === 'reveal') {
      // Dissonant build — minor 2nd plus tritone, swelling
      sfx.tone(220, 'sawtooth', 0.18, 0.60);
      sfx.tone(233, 'sawtooth', 0.18, 0.60);
      sfx.tone(311, 'sawtooth', 0.20, 0.70);
      setTimeout(() => running !== false && sfx.tone(440, 'square', 0.30, 0.40), 220);
      setTimeout(() => running !== false && sfx.sweep(220, 660, 'sine', 0.30, 0.55), 380);
      caption('[REVEAL]', 1200);
    } else if (type === 'death') {
      // Layered death scream — sweep + scream + sub
      sfx.sweep(1000, 100, 'sawtooth', 0.45, 0.80);
      sfx.tone(60, 'sine', 0.50, 0.90);
      sfx.tone(900, 'square', 0.30, 0.50);
      sfx.noise(0.30, 0.60, 300);
      setTimeout(() => running !== false && sfx.sweep(180, 50, 'sawtooth', 0.40, 0.50), 200);
      caption('[DEATH]', 1400);
    } else if (type === 'success') {
      // Relief — soft major triad
      const arp = [523, 659, 784, 1047];
      arp.forEach((f, i) => setTimeout(() => running !== false && sfx.tone(f, 'triangle', 0.22, 0.50), i * 90));
      caption('[SUCCESS]', 1100);
    }
  } catch {}
}
// Expose for cross-module use (cutscene flow injected by Agent C).
if (typeof window !== 'undefined') window.__backroomsPlayScareSting = playScareSting;

function scheduleAmbient() {
  // HAUNTED mutator triples the rate (interval cut to 1/3).
  const haunted = !!(activeMutator && activeMutator.id === 'haunted');
  const mul = haunted ? 0.33 : 1.0;
  nextAmbientAt = gameTime + (90 + Math.random() * 90) * mul;
}
function scheduleDoorSlam() {
  nextDoorSlamAt = gameTime + 30 + Math.random() * 30;
}
function scheduleWhisper() {
  nextWhisperAt = gameTime + 6 + Math.random() * 9;
}
function schedulePhantom() {
  nextPhantomAt = gameTime + 30 + Math.random() * 60;
}
function schedulePeripheral() {
  nextPeripheralAt = gameTime + 18 + Math.random() * 30;
}
function scheduleEyes() {
  nextEyesAt = gameTime + 22 + Math.random() * 40;
}
function scheduleBlackout() {
  nextBlackoutAt = gameTime + 60 + Math.random() * 60;
}
function scheduleDyingBulb() {
  nextDyingBulbAt = gameTime + 25 + Math.random() * 40;
}
function scheduleStrobo() {
  nextStroboAt = gameTime + 18 + Math.random() * 22;
}
function scheduleGhostStep() {
  nextGhostStepAt = stillT + 4 + Math.random() * 3;
}

// ============================================================================
// PINK-NOISE STATIC WASH — persistent low-volume noise layer that ramps up
// when the monster is near but UNSEEN (mostly psychological — the player
// hears the static get louder before the monster appears in their viewport).
// Uses ScriptProcessor-free approach: looping noise buffer + gain node.
// ============================================================================
function ensureStaticNoise() {
  if (sfx.isMuted()) return;
  if (staticNoiseNode) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.__bkAC) window.__bkAC = new AC();
    const actx = window.__bkAC;
    // Build 4-second pink-noise buffer (Voss-McCartney approximation)
    const bufSec = 4;
    const buf = actx.createBuffer(1, actx.sampleRate * bufSec, actx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    const src = actx.createBufferSource();
    src.buffer = buf; src.loop = true;
    // Light low-pass for "dread air" rather than pure hiss
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    const g = actx.createGain();
    g.gain.value = 0.0;
    src.connect(lp).connect(g).connect(actx.destination);
    src.start();
    staticNoiseNode = src;
    staticNoiseGain = g;
  } catch {}
}
function updateStaticNoise(dt, monsterDist, monsterSees) {
  if (!staticNoiseGain) return;
  let target = 0.0;
  if (!sfx.isMuted() && running) {
    // Base whisper level
    target = 0.012 * getMasterGain('music');
    // Intensify when monster is near but UNSEEN (300..700px window)
    if (!monsterSees && monsterDist < 700) {
      const k = Math.max(0, 1 - Math.max(0, monsterDist - 200) / 500);
      target += 0.06 * k * getMasterGain('music');
    }
    // Boost during a blackout
    if (blackoutT > 0) target += 0.05 * getMasterGain('music');
  }
  const g = staticNoiseGain.gain.value;
  staticNoiseGain.gain.value = g + (target - g) * Math.min(1, dt * 2);
}

// Layered panned whisper voice — used by low-sanity whisper system.
// Plays multiple short voices at L/R pans with detuned octaves at ~0.3 gain.
function playPannedWhispers() {
  if (sfx.isMuted()) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.__bkAC) window.__bkAC = new AC();
    const actx = window.__bkAC;
    const mg = getMasterGain('sfx');
    // 3 voices: hard-L low, hard-R high, center mid
    const voices = [
      { freq: 180, pan: -0.9, dur: 0.6, type: 'sine' },
      { freq: 360, pan: 0.9, dur: 0.55, type: 'triangle' },
      { freq: 240, pan: 0.0, dur: 0.7, type: 'sine' },
    ];
    voices.forEach((v, i) => {
      setTimeout(() => {
        if (!running) return;
        const osc = actx.createOscillator();
        osc.type = v.type; osc.frequency.value = v.freq + (Math.random() - 0.5) * 12;
        const g = actx.createGain();
        const t0 = actx.currentTime;
        const peak = 0.10 * mg;       // combined ~0.3 across 3 voices
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur);
        // Stereo panning (StereoPannerNode is widely supported; fallback to merger).
        let panNode = null;
        try {
          panNode = actx.createStereoPanner();
          panNode.pan.value = v.pan;
        } catch {}
        if (panNode) osc.connect(g).connect(panNode).connect(actx.destination);
        else osc.connect(g).connect(actx.destination);
        osc.start(t0); osc.stop(t0 + v.dur + 0.05);
      }, i * 70);
    });
  } catch {}
}

// ============================================================================
// POSITIONAL MONSTER AUDIO (Agent D)
// Drives the "you hear it but can't see where it is" mechanic. Pan from
// monster X vs player X (-1..1), volume scales 100..600px (1..0). Returns
// { pan, vol } and emits one panned tone via sfx.tonePanned() so footsteps,
// growls, sniffs all share consistent stereo positioning.
// ============================================================================
function _monsterPanVol(mx, my, px, py, maxDist = 600, minDist = 100) {
  const dx = mx - px, dy = my - py;
  const dist = Math.hypot(dx, dy);
  if (dist > maxDist) return { pan: 0, vol: 0, dist };
  const vol = 1 - Math.max(0, Math.min(1, (dist - minDist) / (maxDist - minDist)));
  // Pan: clamp dx to ±300px = full pan, ease past that.
  const pan = Math.max(-1, Math.min(1, dx / 300));
  return { pan, vol, dist };
}
function emitPositionalTone(mx, my, freq, type, dur, peakBase, maxDist = 600, minDist = 100) {
  if (sfx.isMuted() || !running) return;
  const { pan, vol } = _monsterPanVol(mx, my, pug.x, pug.y, maxDist, minDist);
  if (vol < 0.02) return;
  try {
    sfx.tonePanned(freq, type, dur, peakBase * vol, pan);
  } catch {
    sfx.tone(freq, type, dur, peakBase * vol);
  }
}
function emitPositionalNoise(mx, my, dur, peakBase, hp, maxDist = 600, minDist = 100) {
  if (sfx.isMuted() || !running) return;
  const { vol } = _monsterPanVol(mx, my, pug.x, pug.y, maxDist, minDist);
  if (vol < 0.02) return;
  // miniSfx.noise() doesn't expose pan, so use tonePanned at a noise-like band
  // for pan correctness; layer a real noise burst at attenuated volume.
  try {
    sfx.noise(dur, peakBase * vol, hp);
  } catch {}
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
  // Track GHOST achievement — flipping ON disqualifies the level.
  if (flashlightOn) achLevelFlashlightUsed = true;
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
  // Choose a fallback wallpaper variant per level (rooms still re-pick their
  // own variant individually so each room paints a different "zone").
  if (LV.wallpaperVariants && LV.wallpaperVariants.length) {
    const variantIdx = (lvl + Math.floor(Math.random() * 3)) % LV.wallpaperVariants.length;
    currentWallpaper = LV.wallpaperVariants[variantIdx];
  } else {
    currentWallpaper = null;
  }
  // Level scaling: deeper levels are larger (cap budget stays under ~2000 cells)
  const sizeMul = levelSizeMul(lvl);
  cols = Math.min(60, Math.floor((28 + Math.min(lvl, 8) * 2) * sizeMul));
  rows = Math.min(36, Math.floor((18 + Math.min(lvl, 8)) * sizeMul));
  // Total cell budget guard: trim if we'd blow the render budget.
  if (cols * rows > 1900) {
    const k = Math.sqrt(1900 / (cols * rows));
    cols = Math.max(28, Math.floor(cols * k));
    rows = Math.max(18, Math.floor(rows * k));
  }
  grid = Array.from({ length: rows }, () => Array(cols).fill(1));
  // ROOM-BASED ARCHITECTURE — generate varied-size rooms first, then connect
  // them with corridors. Replaces the old maze backtracker; richer + has
  // identifiable rooms (for safe-rooms / dead-ends / room-wallpaper-zones).
  rooms = [];
  const variantCount = (LV.wallpaperVariants && LV.wallpaperVariants.length) || 1;
  const targetRooms = Math.max(8, Math.floor((cols * rows) / 60));
  for (let r = 0; r < targetRooms; r++) {
    for (let tries = 0; tries < 40; tries++) {
      const rw = 3 + Math.floor(Math.random() * 4);  // 3..6 wide
      const rh = 3 + Math.floor(Math.random() * 3);  // 3..5 tall
      const rx = 1 + Math.floor(Math.random() * (cols - rw - 2));
      const ry = 1 + Math.floor(Math.random() * (rows - rh - 2));
      // Overlap test: leave 1-tile gap between rooms
      let overlap = false;
      for (const o of rooms) {
        if (rx < o.minX + o.w + 1 && rx + rw + 1 > o.minX &&
            ry < o.minY + o.h + 1 && ry + rh + 1 > o.minY) { overlap = true; break; }
      }
      if (overlap) continue;
      carveRoom(rx, ry, rw, rh);
      rooms.push({
        minX: rx, minY: ry, w: rw, h: rh,
        cx: rx + (rw >> 1), cy: ry + (rh >> 1),
        wpIdx: Math.floor(Math.random() * variantCount),
        kind: 'normal',
        safeUntil: 0,
        connections: 0,
      });
      break;
    }
  }
  // Ensure spawn-anchor exists: carve a 3x3 around (1,1) if needed.
  carveRoom(1, 1, 3, 3);
  if (!rooms.some(r => r.minX <= 1 && r.minX + r.w >= 4 && r.minY <= 1 && r.minY + r.h >= 4)) {
    rooms.unshift({
      minX: 1, minY: 1, w: 3, h: 3, cx: 2, cy: 2,
      wpIdx: 0, kind: 'normal', safeUntil: 0, connections: 0,
    });
  }
  // 1..2 LARGE CHAMBERS (8x6) with central dividers/pillars — placed only
  // if a clear patch exists; otherwise skipped to avoid stomping rooms.
  const nChambers = 1 + Math.floor(Math.random() * 2);
  pillars = [];
  for (let c = 0; c < nChambers; c++) {
    for (let tries = 0; tries < 40; tries++) {
      const cw = 8, ch = 6;
      const cxR = 2 + Math.floor(Math.random() * (cols - cw - 4));
      const cyR = 2 + Math.floor(Math.random() * (rows - ch - 4));
      let overlap = false;
      for (const o of rooms) {
        if (cxR < o.minX + o.w + 1 && cxR + cw + 1 > o.minX &&
            cyR < o.minY + o.h + 1 && cyR + ch + 1 > o.minY) { overlap = true; break; }
      }
      if (overlap) continue;
      carveRoom(cxR, cyR, cw, ch);
      // Central pillar(s) — 1 or 2 inner walls for cover
      const px = cxR + (cw >> 1), py = cyR + (ch >> 1);
      grid[py][px] = 1;
      pillars.push({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 });
      if (Math.random() < 0.5) {
        const px2 = cxR + 2, py2 = cyR + 3;
        grid[py2][px2] = 1;
        pillars.push({ x: px2 * TILE + TILE / 2, y: py2 * TILE + TILE / 2 });
      }
      rooms.push({
        minX: cxR, minY: cyR, w: cw, h: ch,
        cx: cxR + (cw >> 1), cy: cyR + (ch >> 1),
        wpIdx: Math.floor(Math.random() * variantCount),
        kind: 'chamber',
        safeUntil: 0, connections: 0,
      });
      break;
    }
  }
  // CORRIDOR CONNECTIONS — L-shaped paths from each room center to its
  // nearest neighbour. ~30% of corridors widen to 2-tile-wide for variety.
  const visited = new Set([0]);
  while (visited.size < rooms.length) {
    let bestI = -1, bestJ = -1, bestD = Infinity;
    for (const i of visited) {
      for (let j = 0; j < rooms.length; j++) {
        if (visited.has(j)) continue;
        const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy);
        if (d < bestD) { bestD = d; bestI = i; bestJ = j; }
      }
    }
    if (bestI < 0 || bestJ < 0) break;
    const A = rooms[bestI], B = rooms[bestJ];
    const wide = Math.random() < 0.3;  // 30% are 2-tile wide
    // L-corridor: horizontal first, then vertical
    const x0 = Math.min(A.cx, B.cx), x1 = Math.max(A.cx, B.cx);
    const y0 = Math.min(A.cy, B.cy), y1 = Math.max(A.cy, B.cy);
    const horizFirst = Math.random() < 0.5;
    if (horizFirst) {
      for (let x = x0; x <= x1; x++) {
        if (grid[A.cy] && A.cy > 0 && A.cy < rows - 1) grid[A.cy][x] = 0;
        if (wide && A.cy + 1 < rows - 1 && grid[A.cy + 1]) grid[A.cy + 1][x] = 0;
      }
      for (let y = y0; y <= y1; y++) {
        if (grid[y] && B.cx > 0 && B.cx < cols - 1) grid[y][B.cx] = 0;
        if (wide && B.cx + 1 < cols - 1 && grid[y]) grid[y][B.cx + 1] = 0;
      }
    } else {
      for (let y = y0; y <= y1; y++) {
        if (grid[y] && A.cx > 0 && A.cx < cols - 1) grid[y][A.cx] = 0;
        if (wide && A.cx + 1 < cols - 1 && grid[y]) grid[y][A.cx + 1] = 0;
      }
      for (let x = x0; x <= x1; x++) {
        if (grid[B.cy] && B.cy > 0 && B.cy < rows - 1) grid[B.cy][x] = 0;
        if (wide && B.cy + 1 < rows - 1 && grid[B.cy + 1]) grid[B.cy + 1][x] = 0;
      }
    }
    A.connections = (A.connections || 0) + 1;
    B.connections = (B.connections || 0) + 1;
    visited.add(bestJ);
  }
  // Add a few extra random connections so the level isn't a tree (loops!).
  const extraConnections = Math.max(2, Math.floor(rooms.length * 0.25));
  for (let k = 0; k < extraConnections; k++) {
    const i = Math.floor(Math.random() * rooms.length);
    const j = Math.floor(Math.random() * rooms.length);
    if (i === j) continue;
    const A = rooms[i], B = rooms[j];
    for (let x = Math.min(A.cx, B.cx); x <= Math.max(A.cx, B.cx); x++) {
      if (grid[A.cy] && x > 0 && x < cols - 1) grid[A.cy][x] = 0;
    }
    for (let y = Math.min(A.cy, B.cy); y <= Math.max(A.cy, B.cy); y++) {
      if (grid[y] && B.cx > 0 && B.cx < cols - 1) grid[y][B.cx] = 0;
    }
    A.connections = (A.connections || 0) + 1;
    B.connections = (B.connections || 0) + 1;
  }
  // SAFE ROOMS — 30% of rooms become safe rooms (visual green tint + monster
  // suppression buffer when player enters). Skip the spawn room (idx 0).
  for (let i = 1; i < rooms.length; i++) {
    if (Math.random() < 0.3) rooms[i].kind = 'safe';
  }
  // DEAD-END ROOMS — rooms with 1 connection that aren't the spawn room.
  deadEndRoomIds = new Set();
  for (let i = 1; i < rooms.length; i++) {
    if ((rooms[i].connections || 0) <= 1 && rooms[i].kind !== 'safe') {
      rooms[i].kind = 'deadend';
      deadEndRoomIds.add(i);
    }
  }
  // SECRET ROOM — pick one wall-hidden 3x3 patch and add a fake-wall portal.
  // Player walking into the fake wall reveals it (turns wall to open).
  secretWalls = [];
  for (let tries = 0; tries < 50; tries++) {
    const sw = 3, sh = 3;
    const sx = 2 + Math.floor(Math.random() * (cols - sw - 4));
    const sy = 2 + Math.floor(Math.random() * (rows - sh - 4));
    let allWall = true;
    for (let yy = sy; yy < sy + sh; yy++)
      for (let xx = sx; xx < sx + sw; xx++)
        if (grid[yy][xx] !== 1) { allWall = false; break; }
    if (!allWall) continue;
    // Need an adjacent open tile to attach a "fake wall" door at
    const candidates = [];
    for (let yy = sy; yy < sy + sh; yy++) {
      if (grid[yy][sx - 1] === 0) candidates.push({ tx: sx, ty: yy, vertical: true });
      if (grid[yy][sx + sw] === 0) candidates.push({ tx: sx + sw - 1, ty: yy, vertical: true });
    }
    for (let xx = sx; xx < sx + sw; xx++) {
      if (grid[sy - 1] && grid[sy - 1][xx] === 0) candidates.push({ tx: xx, ty: sy, vertical: false });
      if (grid[sy + sh] && grid[sy + sh][xx] === 0) candidates.push({ tx: xx, ty: sy + sh - 1, vertical: false });
    }
    if (!candidates.length) continue;
    // Carve the secret room
    carveRoom(sx, sy, sw, sh);
    // Re-wall the chosen "fake wall" tile and record it as a secret entrance.
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    grid[c.ty][c.tx] = 1;
    secretWalls.push({ tx: c.tx, ty: c.ty, vertical: c.vertical, revealed: false });
    rooms.push({
      minX: sx, minY: sy, w: sw, h: sh,
      cx: sx + 1, cy: sy + 1,
      wpIdx: Math.floor(Math.random() * variantCount),
      kind: 'secret',
      safeUntil: 0, connections: 1,
    });
    break;
  }
  // CLOSETS — 1x1 item pockets adjacent to rooms (legacy support).
  const closetSlots = [];
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    for (let tries = 0; tries < 40; tries++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 4));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
      if (grid[ty][tx] === 1) {
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
  // NOOK ROOMS — 2x2 dead-end pockets (legacy, can contain a high-value can).
  const nookSlots = [];
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    for (let tries = 0; tries < 60; tries++) {
      const tx = 2 + Math.floor(Math.random() * (cols - 5));
      const ty = 2 + Math.floor(Math.random() * (rows - 4));
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
  // HALLWAY SEGMENTS — 1-tile-wide straight corridors (legacy decoration).
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
    vx: 0, vy: 0, sees: false, chase: false, hunting: false,
    lastSeenX: 0, lastSeenY: 0,
    spawnX: monsterSpawn.x, spawnY: monsterSpawn.y,
    wanderTarget: null,
    aiState: 'idle',          // Agent D — 3-state machine
    visible: false,           // Agent D — only true within viewR
  };
  monsterStuckT = 0;
  monsterStuckPos = { x: monsterSpawn.x, y: monsterSpawn.y };
  monsterStuckPosT = 0;
  // Reset monster AI accumulators on level gen so cues don't double-fire.
  monsterFootstepT = 0;
  monsterGrowlT = 5 + Math.random() * 5;   // delay first growl ~5-10s
  monsterSniffT = 0;
  monsterBreathT = 0;
  monsterHuntingT = 0;
  monsterLostContactT = 99;
  monsterWanderRefreshAt = 0;
  lurkerVisibleT = 0;
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
  // Hide spots: 4-6 per level (distinct cabinet/closet/locker icons).
  // The wider count + visual distinctness gives the player a real "hide
  // strategy" rather than dumb-luck. Archetype-aware kinds for flavour.
  hideSpots = [];
  const hideKinds = archetype === 'pipes'    ? ['locker', 'vending', 'locker', 'cabinet', 'vending'] :
                    archetype === 'warehouse' ? ['cabinet', 'locker', 'vending', 'cabinet', 'crate'] :
                    archetype === 'poolrooms' ? ['cabinet', 'cabinet', 'closet', 'locker'] :
                    archetype === 'garage'    ? ['locker', 'crate', 'cabinet', 'locker'] :
                    archetype === 'the_end'   ? ['closet', 'cabinet', 'closet', 'cabinet'] :
                    archetype === 'voidpool'  ? ['cabinet', 'locker', 'cabinet', 'locker'] :
                    ['closet', 'sofa', 'cabinet', 'vending', 'closet'];
  const nHide = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < nHide; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const r = rooms[1 + Math.floor(Math.random() * Math.max(1, rooms.length - 1))];
      const tx = r
        ? r.minX + Math.floor(Math.random() * r.w)
        : 1 + Math.floor(Math.random() * (cols - 2));
      const ty = r
        ? r.minY + Math.floor(Math.random() * r.h)
        : 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty] && grid[ty][tx] === 0) {
        const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
        if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 2) continue;
        hideSpots.push({ x: wx, y: wy, r: 24, kind: hideKinds[i % hideKinds.length] });
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
  // -------------------------------------------------------------------------
  // ENTITY SPAWNS — Agent D horror-overhaul scaling.
  // Authoritative per-archetype counts (overrides LEVELS spawn* fields so the
  // spec is honoured regardless of Agent B's LEVELS tweaks):
  //   lobby:     0 hounds + 0 smilers + 0 crawlers + 0 whisperers + 1 lurker
  //   warehouse: 2 hounds + 0 smilers + 1 crawler  + 0 whisperers + 1 lurker
  //   pipes:     2 hounds + 1 smiler  + 0 crawlers + 0 whisperers + 2 lurkers
  //   voidpool:  3 hounds + 1 smiler  + 0 crawlers + 1 whisperer  + 2 lurkers
  // After the 4-archetype cycle wraps, +0.5/level on every kind (fractional
  // rolls so growth is gradual). LURKER is a NEW invisible entity that sits
  // far from the player and grabs them if approached without flashlight.
  // -------------------------------------------------------------------------
  entities = [];
  const sp = archetype === 'lobby'     ? { hounds: 0, smilers: 0, crawlers: 0, whisperers: 0, lurkers: 1 }
           : archetype === 'warehouse' ? { hounds: 2, smilers: 0, crawlers: 1, whisperers: 0, lurkers: 1 }
           : archetype === 'pipes'     ? { hounds: 2, smilers: 1, crawlers: 0, whisperers: 0, lurkers: 2 }
           : archetype === 'voidpool'  ? { hounds: 3, smilers: 1, crawlers: 0, whisperers: 1, lurkers: 2 }
           : { hounds: 2, smilers: 1, crawlers: 1, whisperers: 1, lurkers: 2 };
  const cycleLen = ARCHETYPE_CYCLE.length;
  const lvlBoost = lvl > cycleLen ? (lvl - cycleLen) * 0.5 : 0;
  const rollCount = (base) => {
    const total = base + lvlBoost;
    const whole = Math.floor(total);
    const frac = total - whole;
    return whole + (Math.random() < frac ? 1 : 0);
  };
  for (let i = 0; i < rollCount(sp.hounds);     i++) spawnEntity('hound');
  for (let i = 0; i < rollCount(sp.smilers);    i++) spawnEntity('smiler');
  for (let i = 0; i < rollCount(sp.crawlers);   i++) spawnEntity('crawler');
  for (let i = 0; i < rollCount(sp.whisperers); i++) spawnEntity('whisperer');
  for (let i = 0; i < rollCount(sp.lurkers);    i++) spawnEntity('lurker');
  // ---- HOUND PACKS — group hounds within 6 tiles into shared-aggro packs.
  // Round-robin assigns 'chase' (head-on) vs 'flank' (90° offset target) so
  // pack hounds split and pinch the player.
  const hounds = entities.filter(e => e.kind === 'hound');
  let packIdx = 0;
  for (const h of hounds) {
    let joined = null;
    for (const other of hounds) {
      if (other === h || other.packId === undefined) continue;
      if (Math.hypot(other.x - h.x, other.y - h.y) < 6 * TILE) { joined = other; break; }
    }
    if (joined) {
      h.packId = joined.packId;
      joined._roleCount = (joined._roleCount || 1) + 1;
      h.packRole = (joined._roleCount % 2 === 0) ? 'flank' : 'chase';
    } else {
      h.packId = ++packIdx;
      h.packRole = 'chase';
      h._roleCount = 1;
    }
  }
  // ---- FURNITURE (small obstacles — break sightline, walk past) ----
  // Trimmed count so the new envProps + cars + waterCoolers don't push total
  // entity count past the 2000-render budget on larger levels.
  furniture = [];
  const furnCount = 5 + Math.floor(lvl * 1.0);
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
  // Tag every 1-tile-wide passage as a doorway (these get the dark wood
  // frames + can become closed-door later). Rate bumped to 0.65 since the
  // room-based architecture generates many clean doorway candidates.
  doorways = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] !== 0) continue;
      const wL = grid[y][x - 1] === 1, wR = grid[y][x + 1] === 1;
      const wU = grid[y - 1][x] === 1, wD = grid[y + 1][x] === 1;
      if ((wL && wR && !wU && !wD) || (wU && wD && !wL && !wR)) {
        if (Math.random() < 0.65) doorways.push({ x, y, vertical: wL && wR });
      }
    }
  }
  // ---- BIG CEILING LIGHTS (every 5th tile) with flicker timing ----
  // Per-light `flickerT` + `flickerCycle` fields are read by Agent A's
  // updated drawBigCeilingLights pass — keep them populated here.
  bigCeilingLights = [];
  for (let y = 2; y < rows - 1; y += 5) {
    for (let x = 2; x < cols - 1; x += 5) {
      if (grid[y][x] === 0) {
        bigCeilingLights.push({
          x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
          offT: 0, nextOff: 4 + Math.random() * 8, offDur: 0.25 + Math.random() * 0.2,
          flickerT: Math.random() * 6.28,
          flickerCycle: 0.4 + Math.random() * 1.8,
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
  // -------------------------------------------------------------------------
  // ROOM TILEMAP — fill per-tile room ID and per-tile wallpaper variant index
  // for fast lookup at runtime (safe-room buffer, per-room wallpaper paint).
  // -------------------------------------------------------------------------
  roomTileMap = Array.from({ length: rows }, () => Array(cols).fill(-1));
  roomWallpaperIdx = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let ri = 0; ri < rooms.length; ri++) {
    const r = rooms[ri];
    for (let yy = r.minY; yy < r.minY + r.h; yy++) {
      for (let xx = r.minX; xx < r.minX + r.w; xx++) {
        if (yy < 0 || xx < 0 || yy >= rows || xx >= cols) continue;
        if (roomTileMap[yy][xx] === -1) roomTileMap[yy][xx] = ri;
      }
    }
  }
  // Paint per-tile wallpaper index — walls inherit their nearest room's
  // wpIdx so corridors blend with adjacent rooms.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] !== 1) continue;
      let nearestIdx = 0, nearestD = 9999;
      for (let r = 1; r < 4 && nearestD > 0; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            if (roomTileMap[ny][nx] >= 0) {
              const d = Math.abs(dx) + Math.abs(dy);
              if (d < nearestD) {
                nearestD = d;
                nearestIdx = rooms[roomTileMap[ny][nx]].wpIdx;
              }
            }
          }
        }
        if (nearestD <= r) break;
      }
      roomWallpaperIdx[y][x] = nearestIdx;
    }
  }
  // -------------------------------------------------------------------------
  // WATER TILES (poolrooms only) — 35% of room tiles, ripples + slow player.
  // -------------------------------------------------------------------------
  waterTiles = [];
  if (archetype === 'poolrooms') {
    const flagged = new Set();
    for (const r of rooms) {
      if (Math.random() < 0.85) {
        for (let yy = r.minY; yy < r.minY + r.h; yy++) {
          for (let xx = r.minX; xx < r.minX + r.w; xx++) {
            if (grid[yy] && grid[yy][xx] === 0 && Math.random() < 0.55) {
              const k = yy * cols + xx;
              if (!flagged.has(k)) {
                flagged.add(k);
                waterTiles.push({ tx: xx, ty: yy });
              }
            }
          }
        }
      }
    }
  }
  // -------------------------------------------------------------------------
  // BIOLUMINESCENT FUNGI (poolrooms + voidpool) — small glowing dots clustered
  // around walls.
  // -------------------------------------------------------------------------
  fungi = [];
  if (archetype === 'poolrooms' || archetype === 'voidpool') {
    const fungiCount = 16 + Math.floor(lvl * 1.5);
    const cols2 = ['#7effe6', '#5cf3c8', '#aaffff', '#84ffd2'];
    for (let i = 0; i < fungiCount; i++) {
      for (let t = 0; t < 30; t++) {
        const tx = 1 + Math.floor(Math.random() * (cols - 2));
        const ty = 1 + Math.floor(Math.random() * (rows - 2));
        if (grid[ty][tx] !== 1) continue;
        // Place at a wall-edge that touches an open tile
        const edges = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy]) =>
          grid[ty+dy] && grid[ty+dy][tx+dx] === 0);
        if (!edges.length) continue;
        const e = edges[Math.floor(Math.random() * edges.length)];
        const wx = tx * TILE + TILE / 2 + e[0] * TILE * 0.35;
        const wy = ty * TILE + TILE / 2 + e[1] * TILE * 0.35;
        fungi.push({ x: wx, y: wy, r: 2 + Math.random() * 4, color: cols2[Math.floor(Math.random() * cols2.length)] });
        break;
      }
    }
  }
  // -------------------------------------------------------------------------
  // GARAGE CARS (garage only) — 4-6 abandoned cars in open rooms (sightline
  // blocker + obstacle). Placed inside chambers if possible.
  // -------------------------------------------------------------------------
  garageCars = [];
  garageRamps = [];
  if (archetype === 'garage') {
    const carColors = ['#5a4a3a', '#3a3a4a', '#4a3a3a', '#3a4a3a', '#2a2a2a'];
    const nCars = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nCars; i++) {
      for (let tries = 0; tries < 30; tries++) {
        const tx = 2 + Math.floor(Math.random() * (cols - 4));
        const ty = 2 + Math.floor(Math.random() * (rows - 4));
        if (grid[ty][tx] !== 0 || grid[ty][tx + 1] !== 0) continue;
        const wx = tx * TILE + TILE, wy = ty * TILE + TILE / 2;
        if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 3) continue;
        if (Math.hypot(wx - exitTile.x, wy - exitTile.y) < TILE * 2) continue;
        garageCars.push({
          x: wx, y: wy, w: TILE * 1.6, h: TILE * 0.7,
          color: carColors[i % carColors.length], smashed: Math.random() < 0.4,
        });
        break;
      }
    }
    // Open "ramps to nowhere" — visual marker tiles
    const nRamps = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < nRamps; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const tx = 2 + Math.floor(Math.random() * (cols - 4));
        const ty = 2 + Math.floor(Math.random() * (rows - 4));
        if (grid[ty][tx] !== 0) continue;
        garageRamps.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
        break;
      }
    }
  }
  // -------------------------------------------------------------------------
  // ENV PROPS — environmental storytelling: filing cabinets, fallen chairs,
  // splattered paint, cardboard stacks, shoes, briefcases, dead plants,
  // calendars, broken vending machines. Placed inside rooms.
  // -------------------------------------------------------------------------
  envProps = [];
  waterCoolers = [];
  const propKinds = [
    'filing_cabinet', 'broken_vending', 'fallen_chair', 'paint_splatter',
    'cardboard_stack', 'shoes', 'briefcase', 'dead_plant', 'wall_calendar',
  ];
  const propCount = 6 + Math.floor(Math.random() * 5) + Math.min(4, lvl);
  for (let i = 0; i < propCount; i++) {
    for (let tries = 0; tries < 25; tries++) {
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      if (!r) continue;
      const tx = r.minX + Math.floor(Math.random() * r.w);
      const ty = r.minY + Math.floor(Math.random() * r.h);
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 1.5) continue;
      if (exitTile && Math.hypot(wx - exitTile.x, wy - exitTile.y) < TILE) continue;
      envProps.push({
        x: wx, y: wy,
        kind: propKinds[Math.floor(Math.random() * propKinds.length)],
        used: false,
      });
      break;
    }
  }
  // One water-cooler per level (single-use sanity refill).
  for (let tries = 0; tries < 30; tries++) {
    const r = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
    if (!r) break;
    const tx = r.minX + Math.floor(Math.random() * r.w);
    const ty = r.minY + Math.floor(Math.random() * r.h);
    if (grid[ty][tx] !== 0) continue;
    waterCoolers.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, used: false });
    break;
  }
  // -------------------------------------------------------------------------
  // TALISMAN (1 per level), MAP FRAGMENT (50% chance), CIGARETTES (1-2)
  // -------------------------------------------------------------------------
  talismanItems = []; mapFragments = []; cigaretteItems = [];
  // Talisman — placed in a dead-end room if possible (high-risk-high-reward).
  for (let tries = 0; tries < 50; tries++) {
    let r = null;
    if (deadEndRoomIds.size) {
      const ids = Array.from(deadEndRoomIds);
      r = rooms[ids[Math.floor(Math.random() * ids.length)]];
    } else {
      r = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
    }
    if (!r) continue;
    const tx = r.minX + Math.floor(Math.random() * r.w);
    const ty = r.minY + Math.floor(Math.random() * r.h);
    if (grid[ty][tx] !== 0) continue;
    talismanItems.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
    break;
  }
  // Map fragment — placed anywhere; only sometimes appears.
  if (Math.random() < 0.55) {
    for (let tries = 0; tries < 30; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 3) continue;
      mapFragments.push({ x: wx, y: wy });
      break;
    }
  }
  // Cigarettes
  for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
    for (let tries = 0; tries < 30; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      cigaretteItems.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
      break;
    }
  }
  // -------------------------------------------------------------------------
  // CLOSED DOORS — half of doorways become closed (player presses E to open).
  // 30% auto-close behind player. In poolrooms/garage some are glass.
  // -------------------------------------------------------------------------
  closedDoors = [];
  for (const d of doorways) {
    if (Math.random() < 0.5) {
      const glass = (archetype === 'lobby' || archetype === 'poolrooms') && Math.random() < 0.3;
      closedDoors.push({
        tx: d.x, ty: d.y, vertical: d.vertical, glass,
        autoClose: Math.random() < 0.3,
        closing: false, t: 0,
      });
    }
  }
  // -------------------------------------------------------------------------
  // ROUND-2 EXPANSION SPAWNS — almond water, partygoers (garage only),
  // mutators, map sigil, archetype-unique props.
  // -------------------------------------------------------------------------
  // Reset per-level achievement trackers
  resetLevelAchievementTrackers();
  // SURVIVOR achievement — fires when player reaches level 5.
  if (lvl >= 5) { try { ach.unlock('survivor'); } catch {} }
  // ALMOND WATER — 1 per level, placed in any open tile away from the spawn.
  almondWaters = [];
  for (let tries = 0; tries < 50; tries++) {
    const tx = 1 + Math.floor(Math.random() * (cols - 2));
    const ty = 1 + Math.floor(Math.random() * (rows - 2));
    if (grid[ty][tx] !== 0) continue;
    const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
    if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 4) continue;
    if (exitTile && Math.hypot(wx - exitTile.x, wy - exitTile.y) < TILE * 2) continue;
    almondWaters.push({ x: wx, y: wy });
    break;
  }
  // MUTATOR — 30% chance per level. Mutator name shown via banner for 4s.
  activeMutator = null;
  mutatorBannerT = 0;
  if (Math.random() < 0.30) {
    activeMutator = MUTATORS[Math.floor(Math.random() * MUTATORS.length)];
    mutatorBannerT = 4.0;
  }
  // MAP SIGIL — 1 hidden symbol scratched into a random wall tile per level.
  mapSigil = null;
  for (let tries = 0; tries < 60; tries++) {
    const tx = 2 + Math.floor(Math.random() * (cols - 4));
    const ty = 2 + Math.floor(Math.random() * (rows - 4));
    if (grid[ty][tx] !== 1) continue;
    // Need at least one open neighbour so it's reachable.
    const hasOpen = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) =>
      grid[ty+dy] && grid[ty+dy][tx+dx] === 0);
    if (!hasOpen) continue;
    mapSigil = { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, found: false };
    break;
  }
  // PARTYGOERS — Garage only. 3 pugs in party hats, circling a focal point.
  partygoers = [];
  partyAlertedT = 0;
  if (archetype === 'garage') {
    // Find a focal point in the largest room far from player.
    let focal = null;
    for (let tries = 0; tries < 30; tries++) {
      const r = rooms[1 + Math.floor(Math.random() * Math.max(1, rooms.length - 1))];
      if (!r) continue;
      const fx = (r.cx) * TILE + TILE / 2;
      const fy = (r.cy) * TILE + TILE / 2;
      if (Math.hypot(fx - pug.x, fy - pug.y) < TILE * 6) continue;
      focal = { x: fx, y: fy };
      break;
    }
    if (focal) {
      const hatColors = ['#ff3aa1', '#4cc9f0', '#5ef38c'];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const r = 36;
        partygoers.push({
          x: focal.x + Math.cos(a) * r,
          y: focal.y + Math.sin(a) * r,
          hatColor: hatColors[i],
          partyCx: focal.x, partyCy: focal.y,
          partyAngle: a, partyRadius: r,
          state: 'party', t: 0, alertedT: 0,
          speed: 95,
        });
      }
    }
  }
  // ARCHETYPE-UNIQUE MECHANICS — placed/initialized per level.
  yellowNotepad = null;
  forklift = null;
  waterDrops = [];
  nextWaterDropAt = 999999;
  bioFish = [];
  poolNoodleItem = null;
  nextCarAlarmAt = 999999;
  activeCarAlarm = null;
  endExitSign = null;
  if (archetype === 'lobby') {
    // Yellow notepad — rare pickup in a random open tile.
    for (let tries = 0; tries < 40; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 4) continue;
      yellowNotepad = { x: wx, y: wy, used: false };
      break;
    }
  } else if (archetype === 'warehouse') {
    // Forklift — collision blocker placed in a chamber room if possible.
    for (let tries = 0; tries < 30; tries++) {
      const r = rooms.find(rr => rr.kind === 'chamber') ||
        rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
      if (!r) break;
      const tx = r.minX + Math.floor(Math.random() * Math.max(1, r.w - 1));
      const ty = r.minY + Math.floor(Math.random() * Math.max(1, r.h - 1));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 3) continue;
      if (exitTile && Math.hypot(wx - exitTile.x, wy - exitTile.y) < TILE * 2) continue;
      forklift = { x: wx, y: wy, w: TILE * 1.1, h: TILE * 0.8 };
      break;
    }
  } else if (archetype === 'pipes') {
    // Schedule first water drop. Drops fire every 6-12s, splash at random nearby tile.
    nextWaterDropAt = 4 + Math.random() * 6;
  } else if (archetype === 'voidpool') {
    // Bioluminescent fish — 6-10 swimming around. Scared by player proximity.
    const nFish = 6 + Math.floor(Math.random() * 5);
    const fishColors = ['#7effe6', '#5cf3c8', '#aaffff', '#84ffd2'];
    for (let i = 0; i < nFish; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const tx = 1 + Math.floor(Math.random() * (cols - 2));
        const ty = 1 + Math.floor(Math.random() * (rows - 2));
        if (grid[ty][tx] !== 0) continue;
        bioFish.push({
          x: tx * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.4,
          y: ty * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.4,
          vx: (Math.random() - 0.5) * 28,
          vy: (Math.random() - 0.5) * 28,
          color: fishColors[Math.floor(Math.random() * fishColors.length)],
          scaredT: 0,
          phase: Math.random() * Math.PI * 2,
        });
        break;
      }
    }
  } else if (archetype === 'poolrooms') {
    // Pool noodle item — 1 per level.
    for (let tries = 0; tries < 30; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 3) continue;
      poolNoodleItem = { x: wx, y: wy };
      break;
    }
  } else if (archetype === 'garage') {
    nextCarAlarmAt = 18 + Math.random() * 30;
  } else if (archetype === 'the_end') {
    // EXIT SIGN beacon — same as the normal exit but always-visible halo.
    endExitSign = { x: exitTile.x, y: exitTile.y };
  }
  // -------------------------------------------------------------------------
  // EXPOSE level metadata for cutscenes/intros (Agent C reads currentLevelInfo)
  // -------------------------------------------------------------------------
  currentLevelInfo = { name: LV.name, theme: archetype, lvl };
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
  // Reset talisman / map-fragment carry state to ensure they're per-run
  // (not per-level — but reset is harmless; pickup re-arms it).
  talismanCharges = talismanCharges || 0;
  mapFragmentRevealT = 0;
  safeRoomT = 0;
  currentRoomId = -1;
  secretRoomRevealedT = 0;
  secretPromptText = null; secretPromptT = 0;
  // ---- LORE NOTES (1-2 per level) — Round-2: prefer notes from THIS level's
  // bank (LORE_BANKS[archetype]) when picking an undiscovered id. Falls back
  // to ANY undiscovered note if the bank is exhausted, then to a random note.
  noteCollectibles = [];
  const found = loadNotesFound();
  const bank = LORE_BANKS[archetype] || [0, NOTE_TOTAL - 1];
  const bankUndiscovered = [];
  for (let i = bank[0]; i <= bank[1] && i < NOTE_TOTAL; i++) if (!found[i]) bankUndiscovered.push(i);
  const anyUndiscovered = [];
  for (let i = 0; i < NOTE_TOTAL; i++) if (!found[i]) anyUndiscovered.push(i);
  const noteCount = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < noteCount; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      if (Math.hypot(wx - pug.x, wy - pug.y) < TILE * 3) continue;
      let id;
      if (bankUndiscovered.length) {
        id = bankUndiscovered.splice(Math.floor(Math.random() * bankUndiscovered.length), 1)[0];
        // also drop from any-pool so we don't double-pick across slots
        const idx = anyUndiscovered.indexOf(id);
        if (idx >= 0) anyUndiscovered.splice(idx, 1);
      } else if (anyUndiscovered.length) {
        id = anyUndiscovered.splice(Math.floor(Math.random() * anyUndiscovered.length), 1)[0];
      } else {
        id = Math.floor(Math.random() * NOTE_TOTAL);
      }
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
  // Mutator badge — secondary popup so the player sees what's modifying this run.
  if (activeMutator) {
    setTimeout(() => running && pop(pug.x, pug.y - 4, `MUTATOR: ${activeMutator.name}`, '#ff8e3c'), 1100);
  }
}

function spawnEntity(kind) {
  // Lurkers must spawn FAR from the player (> 12 tiles Manhattan) so they
  // can't be stumbled into immediately. All other entities use the legacy
  // > 8 tile minimum (already plenty of breathing room from the spawn point).
  const minDist = kind === 'lurker' ? 12 : 8;
  for (let tries = 0; tries < 80; tries++) {
    const tx = 2 + Math.floor(Math.random() * (cols - 4));
    const ty = 2 + Math.floor(Math.random() * (rows - 4));
    if (grid[ty][tx] === 0 && Math.abs(tx - 1) + Math.abs(ty - 1) > minDist) {
      const e = {
        kind, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        vx: 0, vy: 0, state: 'idle', t: 0, hp: 1,
      };
      // Per-level monster scaling — bumps speed each chained noclip jump.
      const scale = monsterScaleFor(level || 1);
      if (kind === 'hound') {
        e.speed = 200 * scale;
        e.aggroT = 0; e.wanderT = 0;
        e.lastScratchT = -999; // for offscreen scratching cue
      }
      if (kind === 'smiler') {
        e.speed = 50 * scale; e.recoilT = 0; e.opacity = 0.0;
      }
      if (kind === 'crawler') {
        // Low spider-pug — slow patrol, lunges from short range, hides near furniture.
        e.speed = 65 * scale; e.lungeT = 0; e.lungeCooldown = 0; e.wanderT = 0;
        e.lastSkitterT = -999;     // for offscreen skittering cue
        e.spottedFreezeT = 0;      // brief freeze when player spots them
        e.spottedResolved = false; // whether 50/50 lunge-or-retreat already rolled
        e.retreatVx = 0; e.retreatVy = 0;
      }
      if (kind === 'whisperer') {
        // Stationary entity. Erodes sanity if player looks at it directly.
        // NEW: hops to new spot every 20s; walks at low sanity.
        e.speed = 0; e.gazeT = 0; e.lastWhisperT = -999;
        e.nextHopT = 18 + Math.random() * 6;  // 18..24s until first hop
        e.lowSanityWalk = false;
      }
      if (kind === 'lurker') {
        // INVISIBLE entity. Doesn't move. Grabs player if approached within
        // ~80px without flashlight on. Flashlight ON within 220px reveals it
        // briefly via Agent A's `lurkerVisibleT` overlay (we just set the flag).
        e.speed = 0;
        e.spawnTx = tx; e.spawnTy = ty;
        e.triggered = false;
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
  if (grid[ty][tx] === 1) return true;
  // Closed doors block movement (treated as walls).
  if (closedDoors && closedDoors.length) {
    for (const d of closedDoors) if (d.tx === tx && d.ty === ty) return true;
  }
  // Garage cars block movement (bounding box test).
  if (garageCars && garageCars.length) {
    for (const c of garageCars) {
      if (Math.abs(x - c.x) < c.w / 2 + 2 && Math.abs(y - c.y) < c.h / 2 + 2) return true;
    }
  }
  // Warehouse forklift blocks movement.
  if (forklift) {
    if (Math.abs(x - forklift.x) < forklift.w / 2 + 2 && Math.abs(y - forklift.y) < forklift.h / 2 + 2) return true;
  }
  return false;
}
function isWallTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
  if (grid[ty][tx] === 1) return true;
  if (closedDoors && closedDoors.length) {
    for (const d of closedDoors) if (d.tx === tx && d.ty === ty) return true;
  }
  return false;
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
  // Agent C: pause + level card freeze gameplay (no monster movement, no
  // damage, no can pickups). Ambient hum + music keep evolving for atmos.
  if (paused || levelCardShowing) {
    silenceHum(0.1);
    updateHum(dt);
    updateMusic(dt, Math.hypot((monster?.x ?? 0) - pug.x, (monster?.y ?? 0) - pug.y));
    return;
  }
  gameTime += dt;
  if (jumpScareCooldown > 0) jumpScareCooldown -= dt;
  if (jumpScareT > 0) jumpScareT -= dt;
  if (redFlashT > 0) redFlashT -= dt;
  // PSYCHIC FLASH — fire when scheduled time passes; reschedule afterward.
  if (nextPsychicFlashAt === 0) _schedulePsychicFlash();
  if (psychicFlashT > 0) psychicFlashT = Math.max(0, psychicFlashT - dt);
  if (psychicFlashT === 0 && gameTime >= nextPsychicFlashAt) {
    psychicFlashT = 1.0;
    _schedulePsychicFlash();
    try { sfx.tone(180, 'sine', 0.4, 0.18); sfx.tone(60, 'sine', 0.5, 0.25); } catch (e) { /* */ }
  }
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
      // Agent C: once the chain-flash finishes, show the per-level card.
      triggerLevelCard(level);
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
  // INVERTED mutator — flip input axes for spooky-confusing feel.
  if (activeMutator && activeMutator.id === 'inverted') { mx = -mx; my = -my; }
  const sneaking = keys.has('shift') || touchSneak;
  // Partygoer-style slow not implemented; sanity-low slows you slightly though
  const sanitySlow = sanity < 25 ? 0.7 : 1.0;
  // Water-slow — poolrooms water tiles drop you to 60% speed.
  const ptxNow = Math.floor(pug.x / TILE), ptyNow = Math.floor(pug.y / TILE);
  const onWater = waterTiles.some(w => w.tx === ptxNow && w.ty === ptyNow);
  const waterSlow = onWater ? 0.6 : 1.0;
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const speed = (sneaking ? 70 : 140) * sanitySlow * waterSlow;
    move(pug, (mx / l) * speed * dt, (my / l) * speed * dt);
    soundLevel = Math.min(1, soundLevel + (sneaking ? 0.05 : 1.2) * dt);
    // Update facing for flashlight cone
    pugFaceX = mx / l; pugFaceY = my / l;
    // Footstep tick — splash sfx when wading
    if ((performance.now() | 0) % (sneaking ? 360 : 230) < 18) {
      if (onWater) sfx.noise(0.04, 0.06, 600);
      else sfx.tone(sneaking ? 180 : 260, 'sine', 0.04, sneaking ? 0.05 : 0.09);
    }
  } else {
    soundLevel = Math.max(0, soundLevel - dt);
  }

  cam.x += (pug.x - cam.x) * 6 * dt;
  cam.y += (pug.y - cam.y) * 6 * dt;

  // Agent #5: record this frame into the 5s replay ring buffer.
  recordReplayFrame(dt);

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
        checkLoreCompleteAchievement();
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
  // RARE ITEM PICKUPS (talisman / map fragment / cigarettes)
  for (let i = talismanItems.length - 1; i >= 0; i--) {
    const t = talismanItems[i];
    if (Math.hypot(t.x - pug.x, t.y - pug.y) < 22) {
      talismanItems.splice(i, 1);
      talismanCharges = (talismanCharges | 0) + 1;
      try { sfx.tone(880, 'triangle', 0.22, 0.28); sfx.tone(1320, 'sine', 0.18, 0.2); } catch {}
      pop(t.x, t.y - 14, '+TALISMAN (Q to burn)', '#d2a8ff');
    }
  }
  for (let i = mapFragments.length - 1; i >= 0; i--) {
    const m = mapFragments[i];
    if (Math.hypot(m.x - pug.x, m.y - pug.y) < 22) {
      mapFragments.splice(i, 1);
      mapFragmentRevealT = 10;
      try { sfx.tone(660, 'triangle', 0.2, 0.26); sfx.tone(990, 'sine', 0.18, 0.2); } catch {}
      pop(m.x, m.y - 14, '+MAP — EXIT GLOWS 10s', '#5ef38c');
    }
  }
  for (let i = cigaretteItems.length - 1; i >= 0; i--) {
    const c = cigaretteItems[i];
    if (Math.hypot(c.x - pug.x, c.y - pug.y) < 22) {
      cigaretteItems.splice(i, 1);
      sanity = Math.min(100, sanity + 20);
      battery = Math.max(0, battery - 10);
      try { sfx.tone(220, 'sine', 0.3, 0.18); sfx.noise(0.05, 0.12, 200); } catch {}
      pop(c.x, c.y - 14, '+20 SANITY -10 BATTERY', '#aaaaaa');
    }
  }
  // ALMOND WATER — drink with E within ~28px. +50 sanity, +30s of flashlight
  // battery (battery treated as a fraction of 100; +30s @ 3/sec drain = ~+90
  // tiny units, but capped at 100). Per-run counter for HUD.
  for (let i = almondWaters.length - 1; i >= 0; i--) {
    const a = almondWaters[i];
    const d = Math.hypot(a.x - pug.x, a.y - pug.y);
    if (d < 28 && keys.has('e')) {
      almondWaters.splice(i, 1);
      almondWaterCollected++;
      sanity = Math.min(100, sanity + 50);
      battery = Math.min(100, battery + 30);
      try { sfx.tone(660, 'sine', 0.22, 0.20); sfx.tone(880, 'triangle', 0.18, 0.16); } catch {}
      pop(a.x, a.y - 14, `+ALMOND ${almondWaterCollected}/${MAX_LEVEL}`, '#48d8ff');
    } else if (d < 28) {
      // Prompt text only — caption-style. Drawn in render via popup is too noisy.
      // (Visual hint kept inside the glow render — skip per-frame popup spam.)
    }
  }
  // YELLOW NOTEPAD — LOBBY only. Pickup = flash dev note overlay (renders in render()).
  if (yellowNotepad && !yellowNotepad.used) {
    if (Math.hypot(yellowNotepad.x - pug.x, yellowNotepad.y - pug.y) < 22) {
      yellowNotepad.used = true;
      yellowNoteText = DEV_NOTES[Math.floor(Math.random() * DEV_NOTES.length)];
      yellowNoteFlashT = 3.0;
      try { sfx.tone(440, 'square', 0.10, 0.14); sfx.tone(880, 'triangle', 0.18, 0.12); } catch {}
      pop(yellowNotepad.x, yellowNotepad.y - 14, '+DEV NOTE', '#ffd23f');
    }
  }
  // POOL NOODLE — POOLROOMS only. Pickup grants 1 charge of crawler-knockback.
  if (poolNoodleItem) {
    if (Math.hypot(poolNoodleItem.x - pug.x, poolNoodleItem.y - pug.y) < 22) {
      poolNoodleCharges++;
      try { sfx.tone(540, 'triangle', 0.12, 0.18); sfx.noise(0.06, 0.10, 600); } catch {}
      pop(poolNoodleItem.x, poolNoodleItem.y - 14, '+POOL NOODLE (Q to whack)', '#ffd23f');
      poolNoodleItem = null;
    }
  }
  // MAP SIGIL — find within 30px to mark it. Awards a bonus undiscovered lore
  // note + +1 toward the 7-shard MEMORY unlock.
  if (mapSigil && !mapSigil.found) {
    if (Math.hypot(mapSigil.x - pug.x, mapSigil.y - pug.y) < 30) {
      mapSigil.found = true;
      const total = addSigil();
      try { sfx.tone(660, 'sine', 0.22, 0.22); sfx.tone(990, 'triangle', 0.18, 0.18); sfx.tone(1320, 'sine', 0.14, 0.18); } catch {}
      pop(mapSigil.x, mapSigil.y - 18, `+SIGIL ${total}/7`, '#d2a8ff');
      // Bonus undiscovered lore note (if any).
      const foundMap = loadNotesFound();
      const undisc = [];
      for (let k = 0; k < NOTE_TOTAL; k++) if (!foundMap[k]) undisc.push(k);
      if (undisc.length) {
        const id = undisc[Math.floor(Math.random() * undisc.length)];
        markNoteFound(id);
        pop(mapSigil.x, mapSigil.y - 32, `+NOTE ${notesFoundCount()}/${NOTE_TOTAL}`, '#ffd23f');
        checkLoreCompleteAchievement();
      }
      if (total >= 7) {
        pop(pug.x, pug.y - 32, 'MEMORY ARCHETYPE UNLOCKED', '#5ef38c');
      }
    }
  }
  // Water-cooler drink — single-use, +5 sanity.
  for (const w of waterCoolers) {
    if (w.used) continue;
    if (Math.hypot(w.x - pug.x, w.y - pug.y) < 28) {
      if (keys.has('e')) {
        w.used = true;
        sanity = Math.min(100, sanity + 5);
        try { sfx.tone(540, 'triangle', 0.18, 0.22); } catch {}
        pop(w.x, w.y - 14, '+5 SANITY', '#5ef38c');
      }
    }
  }
  // Closed-door interaction (E to open). Auto-close behind player.
  for (let i = closedDoors.length - 1; i >= 0; i--) {
    const d = closedDoors[i];
    const cx = d.tx * TILE + TILE / 2, cy = d.ty * TILE + TILE / 2;
    const dist = Math.hypot(pug.x - cx, pug.y - cy);
    if (dist < TILE * 1.1 && keys.has('e')) {
      const willAutoClose = d.autoClose;
      closedDoors.splice(i, 1);
      try { sfx.tone(220, 'square', 0.06, 0.12); sfx.tone(120, 'sine', 0.18, 0.15); } catch {}
      pop(cx, cy - 14, willAutoClose ? 'DOOR OPENS (will close)' : 'DOOR OPENS', '#ffd23f');
      if (willAutoClose) {
        // Re-arm a 4s delayed re-close, but only if player has walked past.
        setTimeout(() => {
          if (!running) return;
          const dd = Math.hypot(pug.x - cx, pug.y - cy);
          if (dd > TILE * 1.6) {
            closedDoors.push({ tx: d.tx, ty: d.ty, vertical: d.vertical, glass: d.glass, autoClose: false, closing: false, t: 0 });
            try { sfx.tone(180, 'sine', 0.06, 0.12); } catch {}
          }
        }, 4000);
      }
    }
  }
  // Secret-wall reveal — player must press WASD into a fake wall. If we
  // detect player attempting to cross into a secret wall tile, open it.
  if (mx || my) {
    const ahead = { x: pug.x + mx * 14, y: pug.y + my * 14 };
    const atx = Math.floor(ahead.x / TILE), aty = Math.floor(ahead.y / TILE);
    for (const s of secretWalls) {
      if (s.revealed) continue;
      if (s.tx === atx && s.ty === aty) {
        s.revealed = true;
        if (grid[s.ty]) grid[s.ty][s.tx] = 0;
        secretRoomRevealedT = 3;
        try { sfx.tone(660, 'sine', 0.3, 0.24); sfx.tone(990, 'sine', 0.3, 0.18); sfx.tone(1320, 'triangle', 0.22, 0.16); } catch {}
        pop(pug.x, pug.y - 24, 'SECRET ROOM!', '#ffd23f');
        // Drop a guaranteed bonus inside the room.
        const px = s.tx * TILE + (s.vertical ? (mx > 0 ? TILE * 0.5 : -TILE * 0.5) : 0) + TILE / 2;
        const py = s.ty * TILE + (!s.vertical ? (my > 0 ? TILE * 0.5 : -TILE * 0.5) : 0) + TILE / 2;
        // bonus note + battery
        const found = loadNotesFound();
        const undiscovered = [];
        for (let k = 0; k < NOTE_TOTAL; k++) if (!found[k]) undiscovered.push(k);
        const noteId = undiscovered.length ? undiscovered[Math.floor(Math.random() * undiscovered.length)]
                                          : Math.floor(Math.random() * NOTE_TOTAL);
        noteCollectibles.push({ x: px, y: py, id: noteId });
        items.push({ x: px + 28, y: py, type: 'battery' });
      }
    }
  }
  // Track current room (for safe-room buffer) and update safeRoomT.
  if (roomTileMap && roomTileMap[ptyNow]) {
    const ridNow = roomTileMap[ptyNow][ptxNow];
    if (ridNow !== currentRoomId) {
      currentRoomId = ridNow;
      if (ridNow >= 0 && rooms[ridNow] && rooms[ridNow].kind === 'safe') {
        safeRoomT = 5;
        pop(pug.x, pug.y - 20, 'SAFE ROOM', '#5ef38c');
      }
    }
  }
  if (safeRoomT > 0) safeRoomT = Math.max(0, safeRoomT - dt);
  if (secretRoomRevealedT > 0) secretRoomRevealedT = Math.max(0, secretRoomRevealedT - dt);
  if (mapFragmentRevealT > 0) mapFragmentRevealT = Math.max(0, mapFragmentRevealT - dt);
  // Talisman use (Q with charges) — stun monster. Separate from E so it
  // doesn't conflict with door-open / water-cooler interaction on the same
  // frame as pickup. Talisman is the priority Q use; pool-noodle falls through
  // only when player has 0 charges.
  if (keys.has('q') && talismanCharges > 0 && monsterDazedT <= 0) {
    talismanCharges--;
    monsterDazedT = 6;
    try { sfx.tone(1320, 'triangle', 0.3, 0.3); sfx.sweep(880, 220, 'sine', 0.3, 0.4); } catch {}
    pop(pug.x, pug.y - 22, 'TALISMAN BURNS', '#d2a8ff');
    silenceHum(0.5);
    keys.delete('q');
  } else if (keys.has('q') && poolNoodleCharges > 0) {
    // POOL NOODLE whack — find nearest crawler within 90px, knock back 80px.
    let nearest = null, nd = 90;
    for (const e of entities) {
      if (e.kind !== 'crawler') continue;
      const d = Math.hypot(e.x - pug.x, e.y - pug.y);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (nearest) {
      poolNoodleCharges--;
      const dx = nearest.x - pug.x, dy = nearest.y - pug.y;
      const m = Math.hypot(dx, dy) || 1;
      // Knock-back 80px instantly (clamped to walls via move()).
      move(nearest, (dx / m) * 80, (dy / m) * 80, 10);
      nearest.lungeCooldown = 3;       // reset its lunge so it stays disoriented
      nearest.lungeT = 0;
      try { sfx.tone(220, 'sine', 0.18, 0.12); sfx.noise(0.10, 0.18, 600); } catch {}
      pop(pug.x, pug.y - 22, 'THWACK!', '#ffd23f');
      shake(4, 0.20);
      keys.delete('q');
    }
  }
  // Hide-in-spot battery drain doubles (handled where hidden is computed).
  // Battery drain — DARKER mutator multiplies drain by 1.5x.
  if (flashlightOn) {
    const drainMul = (activeMutator && activeMutator.id === 'darker') ? 1.5 : 1.0;
    battery = Math.max(0, battery - 3 * drainMul * dt);
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

  // Hiding — Agent B: tightened "hidden" rule so monster's effective detect
  // radius is just 50px when player is inside a hide spot (was 200px from
  // detectable=false fully suppressing). Battery drains 2x while hiding.
  let hidden = false;
  for (const h of hideSpots) if (Math.hypot(h.x - pug.x, h.y - pug.y) < h.r) { hidden = true; break; }
  // While hidden + flashlight ON, drain battery at 2x rate.
  if (hidden && flashlightOn) battery = Math.max(0, battery - 3 * dt);
  // Allow monster to "find" you if within 50px even while hidden (tense out
  // of hide spot if monster comes right next to it).
  if (hidden && monster && Math.hypot(monster.x - pug.x, monster.y - pug.y) < 50) hidden = false;

  // Exit check — chain into the NEXT level archetype rather than ending the
  // run. Cinematic "NOCLIPPED → LEVEL N: NAME" flash plays for ~1.6s. Sanity
  // carries over; cans/pickups reset; monster scaling rises per level.
  // Agent C: record level best time, unlock next level, and trigger WIN
  // cutscene if we just cleared the final floor (MAX_LEVEL).
  if (cans.length === 0 && Math.hypot(exitTile.x - pug.x, exitTile.y - pug.y) < 26) {
    if (!noclipTransitionT) {
      const lvlInfo = levelInfoFor(level);
      // Per-level achievement check — GHOST (no flashlight), PACIFIST (no
      // jumpscares), SPEEDRUN (level 1 < 90s).
      const lvlElapsed = gameTime - levelStartT;
      checkLevelClearAchievements(level, lvlElapsed);
      // Persist best-time for this level + unlock the next one.
      try { _cutRecordBest(level, gameTime - levelStartT); } catch {}
      try { _cutRecordReached(Math.min(MAX_LEVEL, level + 1)); } catch {}
      // WIN — final level cleared. Fire win cutscene and stop the run.
      if (level >= MAX_LEVEL) {
        running = false;
        document.getElementById('hud').hidden = true;
        const pauseBtn = document.getElementById('pause-btn'); if (pauseBtn) pauseBtn.hidden = true;
        try {
          sfx.arp([523, 659, 784, 1047, 1568], 'triangle', 0.1, 0.30, 0.40);
        } catch {}
        const { isNewBest } = submitRun('backrooms-pug', { score: level, level }, (a, b) => b.level - a.level);
        try {
          _cutWin({
            level, cans: (level - 1) * 5 + (5 - cans.length),
            time: gameTime - runStartT,
            notesFound: notesFoundCount(), notesTotal: NOTE_TOTAL,
            deathsAvoided: Math.max(0, noclipsChained | 0),
            isNewBest,
          }, (action) => {
            if (action === 'restart') startRun();
          });
        } catch (e) {}
        return;
      }
      // Otherwise — keep the existing chain-transition + show a level card.
      noclipTransitionT = NOCLIP_TRANSITION_DUR;
      noclipFromLabel = lvlInfo.name;
      const nextLvl = level + 1;
      const nextInfo = levelInfoFor(nextLvl);
      noclipToLabel = nextInfo.name;
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

  // ==========================================================================
  // MAIN MONSTER AI — 3-state machine: IDLE → HUNTING → CHASE (Agent D).
  // Player only knows monster position via stereo-panned audio cues. Sprite is
  // hidden whenever outside viewR (monster.visible = false). Speed model:
  // full when offscreen, slow when visible — "slow when seen, deadly otherwise".
  // ==========================================================================
  const distToPug = Math.hypot(monster.x - pug.x, monster.y - pug.y);
  // Safe rooms suppress monster detection for safeRoomT seconds after entering.
  const detectable = !hidden && monsterDazedT <= 0 && safeRoomT <= 0;
  const hears = detectable && soundLevel > 0.5 && distToPug < 420;
  let sees = false;
  if (detectable && distToPug < 360) sees = lineClear(monster.x, monster.y, pug.x, pug.y);
  const prevSees = monster.sees;
  monster.sees = sees;
  const VIEW_R = 340; // flashlight-on viewR; sprite hidden beyond this
  const monsterOffscreen = distToPug > VIEW_R;
  monster.visible = !monsterOffscreen;

  // ----- 3-STATE TRANSITION LOGIC ------------------------------------------
  if (!monster.aiState) monster.aiState = 'idle';
  if (sees || hears) {
    monster.lastSeenX = pug.x; monster.lastSeenY = pug.y;
    monsterLostContactT = 0;
    if (distToPug < 200) monster.aiState = 'chase';
    else if (monster.aiState !== 'chase') monster.aiState = 'hunting';
  } else {
    monsterLostContactT += dt;
    if (monster.aiState === 'chase') {
      if (distToPug > 400 && monsterLostContactT > 5) monster.aiState = 'idle';
      else if (distToPug > 200) monster.aiState = 'hunting';
    } else if (monster.aiState === 'hunting') {
      monsterHuntingT += dt;
      if (monsterLostContactT > 15) { monster.aiState = 'idle'; monsterHuntingT = 0; }
    }
  }
  const prevChase = monster.chase;
  monster.chase = monster.aiState === 'chase';
  monster.hunting = monster.aiState === 'hunting';
  monsterChaseT = monster.chase ? 5 : Math.max(0, monsterChaseT - dt);

  if (sees && !prevSees && !firstSeenScreamed) {
    firstSeenScreamed = true;
    shake(4, 0.25);
    sfx.sweep(900, 180, 'sawtooth', 0.6, 0.32);
    silenceHum(0.45);
  }
  if (monster.chase && !prevChase && distToPug < 280) jumpScare('monster');
  else if (monster.chase && distToPug < 70 && jumpScareCooldown <= 0) jumpScare('monster');

  // ----- STOCHASTIC WANDER TARGET (IDLE) -----------------------------------
  // 50% true far wander, 30% silent closing on player, 20% ambush near exit.
  if (monster.aiState === 'idle') {
    if (gameTime >= monsterWanderRefreshAt ||
        !monster.wanderTarget ||
        Math.hypot(monster.wanderTarget.x - monster.x, monster.wanderTarget.y - monster.y) < 50) {
      const roll = Math.random();
      if (roll < 0.20 && exitTile) {
        const midX = (pug.x + exitTile.x) * 0.5 + (Math.random() - 0.5) * TILE * 3;
        const midY = (pug.y + exitTile.y) * 0.5 + (Math.random() - 0.5) * TILE * 3;
        monster.wanderTarget = findNearestOpenTile(midX, midY);
      } else if (roll < 0.50) {
        const a = Math.random() * Math.PI * 2;
        const r = (4 + Math.random() * 4) * TILE;
        monster.wanderTarget = findNearestOpenTile(pug.x + Math.cos(a) * r, pug.y + Math.sin(a) * r);
      } else {
        monster.wanderTarget = findRandomFarOpenTile(monster.x, monster.y, 6 * TILE);
      }
      monsterWanderRefreshAt = gameTime + 3 + Math.random() * 4;
    }
  }

  // ----- MOVEMENT (full offscreen, creep visible) --------------------------
  let mvx = 0, mvy = 0;
  const chainScale = monsterScaleFor(level || 1);
  const blackoutBoost = blackoutT > 0 ? 2.0 : 1.0;
  let baseSpeed;
  let targetT;
  if (monster.aiState === 'chase') {
    targetT = { x: monster.lastSeenX, y: monster.lastSeenY };
    baseSpeed = monsterOffscreen ? 220 : 135;
  } else if (monster.aiState === 'hunting') {
    targetT = { x: monster.lastSeenX, y: monster.lastSeenY };
    baseSpeed = monsterOffscreen ? 150 : 80;
  } else {
    if (!monster.wanderTarget) monster.wanderTarget = findRandomFarOpenTile(monster.x, monster.y, 6 * TILE);
    targetT = monster.wanderTarget;
    baseSpeed = monsterOffscreen ? 95 : 45;
  }
  if (targetT) {
    const dx = targetT.x - monster.x, dy = targetT.y - monster.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = baseSpeed * LV.monsterSpeed * chainScale * blackoutBoost;
      mvx = (dx / d) * sp; mvy = (dy / d) * sp;
    } else if (monster.aiState === 'chase' || monster.aiState === 'hunting') {
      if (monster.aiState === 'chase') { monster.aiState = 'hunting'; monsterLostContactT = 0; }
      else { monster.aiState = 'idle'; monster.wanderTarget = null; }
    } else {
      monsterWanderRefreshAt = 0;
    }
  }
  // Sliding collision + anti-stuck (preserved from prior round).
  const beforeX = monster.x, beforeY = monster.y;
  move(monster, mvx * dt, mvy * dt, 14);
  const moved = Math.hypot(monster.x - beforeX, monster.y - beforeY);
  if (moved < 0.2 && (Math.abs(mvx) > 1 || Math.abs(mvy) > 1)) {
    if (Math.abs(mvx) > 1) move(monster, mvx * dt, 0, 14);
    if (Math.abs(mvy) > 1 && Math.hypot(monster.x - beforeX, monster.y - beforeY) < 0.2) {
      move(monster, 0, mvy * dt, 14);
    }
  }
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
  monsterStuckPosT += dt;
  if (Math.hypot(monster.x - monsterStuckPos.x, monster.y - monsterStuckPos.y) > 12) {
    monsterStuckPos = { x: monster.x, y: monster.y };
    monsterStuckPosT = 0;
  } else if (monsterStuckPosT > 3 && !monster.chase) {
    monster.wanderTarget = findRandomFarOpenTile(monster.x, monster.y, 8 * TILE);
    monsterStuckPos = { x: monster.x, y: monster.y };
    monsterStuckPosT = 0;
    monsterWanderRefreshAt = gameTime + 3 + Math.random() * 4;
  }

  // ----- POSITIONAL AUDIO (the ONLY way to know where the monster is) -----
  // SILENT mutator suppresses the monster footstep cue (player has no aural
  // anchor for monster position).
  const silentMut = !!(activeMutator && activeMutator.id === 'silent');
  const monsterMoving = Math.hypot(mvx, mvy) > 5;
  monsterFootstepT += dt;
  const footRate = monster.chase ? 0.40 : monster.hunting ? 0.55 : 0.70;
  if (!silentMut && monsterMoving && monsterFootstepT >= footRate + Math.random() * 0.10) {
    monsterFootstepT = 0;
    emitPositionalTone(monster.x, monster.y, 90 + Math.random() * 18, 'sine', 0.06, 0.18);
  }
  monsterGrowlT += dt;
  if (monsterGrowlT >= 8 + Math.random() * 7) {
    monsterGrowlT = 0;
    emitPositionalTone(monster.x, monster.y, 78 + Math.random() * 22, 'sawtooth', 0.40, 0.22, 900, 100);
    setTimeout(() => running && emitPositionalTone(monster.x, monster.y, 55, 'sine', 0.45, 0.18, 900, 100), 120);
  }
  if (distToPug < 200) {
    monsterBreathT += dt;
    const rate = monster.chase ? 0.50 : 0.85;
    if (monsterBreathT >= rate) {
      monsterBreathT = 0;
      emitPositionalTone(monster.x, monster.y, 130 + Math.random() * 30, 'sine', 0.16, 0.10, 350, 60);
    }
  } else {
    monsterBreathT = Math.max(0, monsterBreathT - dt * 0.5);
  }
  if (monster.hunting) {
    monsterSniffT += dt;
    if (monsterSniffT >= 1.4 + Math.random() * 1.0) {
      monsterSniffT = 0;
      emitPositionalNoise(monster.x, monster.y, 0.18, 0.10, 600);
      emitPositionalTone(monster.x, monster.y, 220 + Math.random() * 40, 'triangle', 0.08, 0.08, 600, 60);
    }
  } else {
    monsterSniffT = 0;
  }

  // Entities AI (Hounds + Smilers + Crawlers + Whisperers + Lurkers).
  // Lurker visibility flag is reset each frame so it only persists while a
  // lurker is actively revealed by the player's flashlight.
  if (lurkerVisibleT > 0) lurkerVisibleT = Math.max(0, lurkerVisibleT - dt);
  for (const e of entities) {
    e.t += dt;
    if (e.kind === 'hound') tickHound(e, dt, hidden);
    if (e.kind === 'smiler') tickSmiler(e, dt, hidden);
    if (e.kind === 'crawler') tickCrawler(e, dt, hidden);
    if (e.kind === 'whisperer') tickWhisperer(e, dt, hidden);
    if (e.kind === 'lurker') tickLurker(e, dt, hidden);
    // Damage on contact (lurker handles its own damage in tickLurker)
    if (e.kind !== 'lurker' && Math.hypot(e.x - pug.x, e.y - pug.y) < 20) {
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
    if (!lit) drain += 1.0;
    if (monster.chase) drain += 2.4;
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

  // Heartbeat — louder when monster < 300px, fades when > 500px. Synthesised
  // as a 50Hz thump + 70Hz subtone with a 0.06s envelope-shaped attack. Plays
  // even outside chase if monster is genuinely close (proximity tension).
  const hbProx = distToPug < 500;
  const hbActive = hbProx || monster.chase;
  if (hbActive && distToPug < 500) {
    heartBeatT += dt;
    // Closer = faster. <300px → 0.45s; 500px → 0.9s.
    const rate = Math.max(0.32, distToPug / 700);
    if (heartBeatT >= rate) {
      heartBeatT = 0;
      // Loud near, soft far. Two-tone thump.
      const closeness = Math.max(0, 1 - distToPug / 500);
      const vol = 0.10 + 0.30 * closeness;        // ramps 0.10 → 0.40
      const sub = 0.06 + 0.18 * closeness;
      sfx.tone(50, 'sine', vol, 0.06);             // 50Hz thump
      setTimeout(() => running && sfx.tone(70, 'sine', sub, 0.06), 35); // 70Hz subtone
    }
  } else { heartBeatT = 0; }
  // FOOTSTEPS YOU DIDN'T MAKE — purely psychological footstep when standing
  // still long enough. Tracks `stillT` (seconds player has been stationary).
  if (mx === 0 && my === 0) {
    stillT += dt;
    if (stillT >= nextGhostStepAt && Math.random() < 0.5) {
      try {
        sfx.tone(180 + Math.random() * 40, 'sine', 0.06, 0.08);
        setTimeout(() => running && sfx.tone(140, 'sine', 0.04, 0.07), 90);
      } catch {}
      scheduleGhostStep();
    } else if (stillT < 0.1) {
      scheduleGhostStep();
    }
  } else {
    stillT = 0;
  }

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
  // Low-sanity whispers — multiple simultaneous panned voices, detuned octaves
  // (loudly at sanity<50). Combined gain ~0.3, was ~0.1 in old single-tone ver.
  if (sanity < 50 && gameTime >= nextWhisperAt) {
    playPannedWhispers();
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

  // Pug breathing — gets louder/faster in chase. During blackout the breathing
  // shifts to a deeper, slower "trapped" rate as if holding breath.
  if (monster.chase) {
    breathT += dt;
    const rate = Math.max(0.45, distToPug / 700);
    if (breathT >= rate) {
      breathT = 0;
      try { sfx.tone(140 + Math.random() * 40, 'sine', 0.18, 0.05); } catch {}
    }
  } else if (blackoutT > 0) {
    // Deep breathing during blackout
    breathT += dt;
    if (breathT >= 1.2) {
      breathT = 0;
      try {
        sfx.tone(90, 'sine', 0.22, 0.30);
        setTimeout(() => running && sfx.tone(60, 'sine', 0.16, 0.40), 250);
      } catch {}
    }
  } else {
    breathT = Math.max(0, breathT - dt * 0.5);
  }

  // ===========================================================================
  // NEW HORROR EVENT SYSTEMS — phantom, peripheral, eyes, blackout,
  // dying-bulb, stroboscopic. All decay timers + schedule next event.
  // ===========================================================================
  // PHANTOM scares — random face-flash with NO monster nearby.
  if (phantomCooldown > 0) phantomCooldown -= dt;
  if (jumpScareMaxAudioT > 0) jumpScareMaxAudioT -= dt;
  if (gameTime >= nextPhantomAt) {
    if (phantomCooldown <= 0 && jumpScareT <= 0) {
      // Roll 50/50: phantom or reflection.
      const kind = Math.random() < 0.5 ? 'phantom' : 'reflection';
      jumpScare(kind);
    }
    schedulePhantom();
  }
  // PERIPHERAL DOORWAY GLIMPSE — quick edge-of-screen silhouette.
  if (peripheralT > 0) peripheralT = Math.max(0, peripheralT - dt);
  if (gameTime >= nextPeripheralAt) {
    peripheralT = 0.22;
    peripheralSide = Math.floor(Math.random() * 4); // 0:L 1:R 2:T 3:B
    try {
      caption('[GLIMPSE]', 700);
      sfx.tone(110, 'sine', 0.10, 0.15);
      sfx.noise(0.08, 0.18, 200);
    } catch {}
    schedulePeripheral();
  }
  // EYES IN DARK — two glowing eyes in an unlit area for 1s, then drift.
  if (eyesT > 0) {
    eyesT = Math.max(0, eyesT - dt);
    eyesX += eyesDriftX * dt;
  }
  if (gameTime >= nextEyesAt) {
    // Place in screen edge, slight off-camera in unlit zone (rendered in screen-space).
    eyesT = 1.0;
    eyesX = (Math.random() < 0.5 ? 0.12 : 0.88) * W;
    eyesY = (0.25 + Math.random() * 0.5) * H;
    eyesDriftX = (Math.random() - 0.5) * 30;
    try {
      caption('[EYES]', 900);
      sfx.tone(70, 'sine', 0.18, 0.5);
    } catch {}
    scheduleEyes();
  }
  // BLACKOUT — all lights OUT for 1.5-2.5s every 60-120s. Monster gains 2x
  // speed (applied to LV.monsterSpeed in monster movement) and audio shifts.
  if (blackoutT > 0) {
    blackoutT -= dt;
    if (blackoutT <= 0) {
      blackoutT = 0;
      // Lights-back-on click
      try { sfx.tone(660, 'square', 0.05, 0.10); } catch {}
    }
  }
  if (gameTime >= nextBlackoutAt) {
    blackoutLife = 1.5 + Math.random() * 1.0;
    blackoutT = blackoutLife;
    silenceHum(0.6);
    try {
      caption('[BLACKOUT]', 1500);
      // Pop + dwindle
      sfx.tone(220, 'sawtooth', 0.18, 0.20);
      sfx.tone(60, 'sine', 0.30, 0.60);
      sfx.noise(0.12, 0.30, 400);
    } catch {}
    scheduleBlackout();
  }
  // DYING BULB — pick a random big ceiling light; flicker erratically for 30s
  // then leave it permanently off (mark with .dead=true).
  if (dyingBulb) {
    dyingBulbT += dt;
    if (dyingBulbT >= dyingBulbLife) {
      dyingBulb.dead = true;
      dyingBulb = null;
      try { sfx.tone(120, 'square', 0.08, 0.18); } catch {}
    }
  } else if (gameTime >= nextDyingBulbAt && bigCeilingLights.length) {
    const alive = bigCeilingLights.filter(L => !L.dead);
    if (alive.length) {
      dyingBulb = alive[Math.floor(Math.random() * alive.length)];
      dyingBulbT = 0;
      try { sfx.tone(440, 'sine', 0.06, 0.12); } catch {}
    }
    scheduleDyingBulb();
  }
  // STROBOSCOPIC — when sanity < 30, strobe red+white at 6Hz for 2s.
  if (stroboT > 0) stroboT = Math.max(0, stroboT - dt);
  if (sanity < 30 && gameTime >= nextStroboAt) {
    stroboT = 2.0;
    try {
      caption('[STROBE]', 1500);
      sfx.sweep(880, 220, 'square', 0.20, 0.30);
      sfx.tone(60, 'sine', 0.25, 0.45);
    } catch {}
    scheduleStrobo();
  } else if (sanity >= 30) {
    // Keep pushing it forward so it's ready when sanity drops
    if (nextStroboAt < gameTime + 10) scheduleStrobo();
  }

  // ==========================================================================
  // ROUND-2 PER-ARCHETYPE MECHANICS — partygoers, water drops, fish, alarm.
  // ==========================================================================
  // Mutator banner countdown
  if (mutatorBannerT > 0) mutatorBannerT = Math.max(0, mutatorBannerT - dt);
  // Yellow notepad dev-flash countdown
  if (yellowNoteFlashT > 0) yellowNoteFlashT = Math.max(0, yellowNoteFlashT - dt);
  // PARTYGOERS (garage only) — 3 pugs circling a focal point until provoked.
  // If player walks within 30px of any one, all 3 alert and chase. On contact
  // they damage (death). Their movement uses move() so they respect walls.
  if (partygoers.length) {
    let provoke = false;
    if (partyAlertedT <= 0) {
      for (const p of partygoers) {
        if (Math.hypot(p.x - pug.x, p.y - pug.y) < 30) { provoke = true; break; }
      }
    }
    if (provoke) {
      partyAlertedT = 0.001; // mark alerted
      try {
        sfx.sweep(800, 280, 'sawtooth', 0.30, 0.30);
        sfx.tone(880, 'square', 0.18, 0.16);
        sfx.tone(110, 'sine', 0.30, 0.40);
        caption('[PARTYGOERS]', 1300);
      } catch {}
      shake(8, 0.30);
    }
    if (partyAlertedT > 0) partyAlertedT += dt;
    for (const p of partygoers) {
      p.t += dt;
      if (partyAlertedT > 0) {
        // Chase player. Easier than main monster (95 px/s base, lower than 200).
        const dxp = pug.x - p.x, dyp = pug.y - p.y;
        const dp = Math.hypot(dxp, dyp) || 1;
        const sp = p.speed;
        move(p, (dxp / dp) * sp * dt, (dyp / dp) * sp * dt, 12);
        // Contact = death (pack pressure is the gimmick)
        if (dp < 22) {
          hitFlashT = 0.4; shake(7, 0.4);
          jumpScareCooldown = 0;
          jumpScare('hound'); // reuse hound scare visual
          return die('hound');
        }
      } else {
        // Idle — orbit focal point at partyRadius. Wobble for cuteness/horror.
        p.partyAngle += dt * 1.3;
        const wob = Math.sin(p.t * 5) * 4;
        p.x = p.partyCx + Math.cos(p.partyAngle) * p.partyRadius + wob * 0.2;
        p.y = p.partyCy + Math.sin(p.partyAngle) * p.partyRadius + wob * 0.2;
      }
    }
  }
  // WATER DROPS (pipes only) — periodic splash overhead. Cosmetic splash
  // graphic + a faint audio pop. Drops at a random open tile near the player.
  if (archetype === 'pipes' && gameTime >= nextWaterDropAt) {
    let placed = false;
    for (let tries = 0; tries < 8; tries++) {
      const a2 = Math.random() * Math.PI * 2;
      const r2 = 80 + Math.random() * 180;
      const dx = Math.cos(a2) * r2, dy = Math.sin(a2) * r2;
      const wx = pug.x + dx, wy = pug.y + dy;
      if (isWallAt(wx, wy)) continue;
      waterDrops.push({ x: wx, y: wy, t: 0, life: 0.8 });
      placed = true;
      // If drop lands within 40px of pug → splash sound + tiny sanity poke.
      if (Math.hypot(dx, dy) < 40) {
        try { sfx.noise(0.06, 0.10, 800); sfx.tone(440, 'sine', 0.04, 0.06); } catch {}
        sanity = Math.max(0, sanity - 1);
      } else {
        try { sfx.tone(220 + Math.random() * 80, 'sine', 0.04, 0.04); } catch {}
      }
      break;
    }
    if (placed) {} // suppress
    nextWaterDropAt = gameTime + 6 + Math.random() * 6;
  }
  // Decay water drops.
  for (let i = waterDrops.length - 1; i >= 0; i--) {
    waterDrops[i].t += dt;
    if (waterDrops[i].t >= waterDrops[i].life) waterDrops.splice(i, 1);
  }
  // BIO FISH (voidpool only) — wander + flee from player.
  for (const f of bioFish) {
    f.phase += dt * 2;
    const dxp = f.x - pug.x, dyp = f.y - pug.y;
    const dp = Math.hypot(dxp, dyp);
    if (dp < 80) {
      f.scaredT = 0.8;
      const m = dp || 1;
      f.vx += (dxp / m) * 120 * dt;
      f.vy += (dyp / m) * 120 * dt;
    }
    if (f.scaredT > 0) f.scaredT = Math.max(0, f.scaredT - dt);
    // Light wander
    f.vx += (Math.random() - 0.5) * 6;
    f.vy += (Math.random() - 0.5) * 6;
    // Damping
    f.vx *= 0.95; f.vy *= 0.95;
    // Cap speed
    const sp = Math.hypot(f.vx, f.vy);
    const cap = f.scaredT > 0 ? 140 : 40;
    if (sp > cap) { f.vx = (f.vx / sp) * cap; f.vy = (f.vy / sp) * cap; }
    // Move with wall constraint
    const nx = f.x + f.vx * dt, ny = f.y + f.vy * dt;
    if (!isWallAt(nx, f.y)) f.x = nx; else f.vx = -f.vx * 0.5;
    if (!isWallAt(f.x, ny)) f.y = ny; else f.vy = -f.vy * 0.5;
  }
  // CAR ALARM (garage only) — random parked car flashes lights + horn. Pulls
  // monster toward that spot, opening sneak space the OTHER direction.
  if (archetype === 'garage' && garageCars.length) {
    if (activeCarAlarm) {
      activeCarAlarm.t += dt;
      if (activeCarAlarm.t >= activeCarAlarm.life) activeCarAlarm = null;
    } else if (gameTime >= nextCarAlarmAt) {
      const c = garageCars[Math.floor(Math.random() * garageCars.length)];
      activeCarAlarm = { car: c, t: 0, life: 5.0 };
      // Set monster wander target there (only if not already chasing the player)
      if (monster && monster.aiState !== 'chase') {
        monster.wanderTarget = { x: c.x, y: c.y };
        monsterWanderRefreshAt = gameTime + 6;
      }
      try {
        caption('[CAR ALARM]', 1500);
        sfx.tone(880, 'square', 0.20, 0.30);
        sfx.tone(660, 'square', 0.20, 0.30);
      } catch {}
      nextCarAlarmAt = gameTime + 30 + Math.random() * 40;
    }
  }
  // EXIT SIGN beacon (THE END only) — visible-everywhere red halo; reaching
  // the exitTile triggers the win cutscene (handled by existing exit check).

  updateHum(dt);
  updateMusic(dt, distToPug);
  updateStaticNoise(dt, distToPug, sees);
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
    if (!wasChase && !firstHoundJump) {
      firstHoundJump = true;
      jumpScare('hound');
    }
    // PACK AGGRO — alert pack-mates within 300px so they share the chase.
    // (Agent D) Pack hounds split flanking: 'chase' = head-on, 'flank' = 90° offset.
    if (e.packId) {
      for (const other of entities) {
        if (other === e || other.kind !== 'hound' || other.packId !== e.packId) continue;
        if (Math.hypot(other.x - e.x, other.y - e.y) < 300) {
          other.aggroT = Math.max(other.aggroT || 0, 3.0);
          if (other.state !== 'chase') other.state = 'chase';
        }
      }
    }
  } else if (e.aggroT > 0) {
    e.aggroT -= dt;
    if (e.aggroT <= 0) e.state = 'idle';
  }
  if (e.state === 'chase' && dist > 4) {
    // FLANK role — aim for a 90° offset position perpendicular to the player→hound
    // vector so the player gets pincered. Once within 80px of player, drop the
    // flank goal and pursue directly.
    let targetX = pug.x, targetY = pug.y;
    if (e.packRole === 'flank' && dist > 80) {
      // 90° rotation of (player→hound) gives perpendicular direction; offset target
      // by 120px so the hound circles around. Sign alternates per pack member id.
      const px = -dy / dist, py = dx / dist;
      const side = (e.packId & 1) ? 1 : -1;
      targetX = pug.x + px * 120 * side;
      targetY = pug.y + py * 120 * side;
    }
    const tdx = targetX - e.x, tdy = targetY - e.y;
    const tdist = Math.hypot(tdx, tdy) || 1;
    move(e, (tdx / tdist) * e.speed * dt, (tdy / tdist) * e.speed * dt, 12);
  } else {
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = 1.2 + Math.random() * 1.8;
      const a = Math.random() * Math.PI * 2;
      e.vx = Math.cos(a) * 50; e.vy = Math.sin(a) * 50;
    }
    move(e, e.vx * dt, e.vy * dt, 12);
  }
  // SCRATCHING WOOD cue — emitted only when hound is OFFSCREEN (player can't
  // see it). Sparse: every 5-12s, low-vol positional noise burst.
  if (dist > 340 && gameTime - (e.lastScratchT || -999) > 5 + Math.random() * 7) {
    e.lastScratchT = gameTime;
    emitPositionalNoise(e.x, e.y, 0.22, 0.10, 1200);
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
  const targetOp = lit ? 0.05 : 0.9;
  e.opacity += (targetOp - e.opacity) * Math.min(1, dt * 3);
  const dPug = Math.hypot(e.x - pug.x, e.y - pug.y);
  if (!flashlightOn && dPug < 90 && (gameTime - (e.lastJumpAt || -999)) > 12) {
    e.lastJumpAt = gameTime;
    jumpScare('smiler');
  }
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
  // WEEPING ANGEL behaviour (Agent D) — if smiler is NOT in player's viewport
  // center 40° cone, it shifts toward player by 5px/frame. If in center cone,
  // it FREEZES. "Looked away for 1 sec and it's right next to me" terror.
  const dxSm = e.x - pug.x, dySm = e.y - pug.y;
  const dSm = Math.hypot(dxSm, dySm) || 1;
  const flLen = Math.hypot(pugFaceX, pugFaceY) || 1;
  const facingDot = (dxSm / dSm) * (pugFaceX / flLen) + (dySm / dSm) * (pugFaceY / flLen);
  // cos(20°) ≈ 0.94 — within ~40° cone of facing dir = "looking at it"
  const inCenterCone = facingDot > 0.94 && lineClear(e.x, e.y, pug.x, pug.y);
  if (!inCenterCone) {
    // Shift 5px/frame at 60fps ≈ 300px/s — apply as velocity-based move
    move(e, (-dxSm / dSm) * 300 * dt, (-dySm / dSm) * 300 * dt, 12);
    return;
  }
  // FROZEN — player is looking at it; do nothing.
}

// ----- CRAWLER ----- low spider-pug. Hugs floor, hides near furniture, lunges
// when player gets within 50px. High damage on contact via the normal contact-
// collision path; we drive it here.
function tickCrawler(e, dt, hidden) {
  e.lungeCooldown = Math.max(0, e.lungeCooldown - dt);
  const dx = pug.x - e.x, dy = pug.y - e.y;
  const dist = Math.hypot(dx, dy);
  // Spotted-freeze decay (Agent D — added).
  if (e.spottedFreezeT > 0) e.spottedFreezeT -= dt;
  // Currently lunging — fast burst toward player for 0.35s.
  if (e.lungeT > 0) {
    e.lungeT -= dt;
    if (dist > 2) {
      const sp = 320;
      move(e, (dx / dist) * sp * dt, (dy / dist) * sp * dt, 10);
    }
    return;
  }
  // SILENT LUNGE (Agent D) — if player walks within 40px while crawler is OFFSCREEN
  // (outside viewport), lunge with no warning audio. lineClear still required.
  if (!hidden && dist < 40 && e.lungeCooldown <= 0 && dist > 360) {
    if (lineClear(e.x, e.y, pug.x, pug.y)) {
      e.lungeT = 0.35; e.lungeCooldown = 2.5;
      return; // no sfx — silent
    }
  }
  // SPOT-FREEZE behaviour (Agent D) — if player sees crawler from > 60px,
  // freeze briefly then 50/50 lunge-or-retreat. e.spottedResolved gates the
  // roll so it only happens once per "spotted" event.
  const playerSees = !hidden && dist < 360 && dist > 60 && lineClear(e.x, e.y, pug.x, pug.y);
  if (playerSees && !e.spottedResolved && e.spottedFreezeT <= 0) {
    e.spottedFreezeT = 0.6;     // freeze for 0.6s
    e.spottedResolved = false;  // will roll at end of freeze
  }
  if (e.spottedFreezeT > 0) {
    // Frozen — don't move
    if (e.spottedFreezeT <= dt && !e.spottedResolved) {
      // Just resolved — coin flip: lunge or retreat
      e.spottedResolved = true;
      if (Math.random() < 0.5 && lineClear(e.x, e.y, pug.x, pug.y)) {
        e.lungeT = 0.35; e.lungeCooldown = 2.5;
        try { sfx.sweep(420, 220, 'sawtooth', 0.18, 0.18); } catch {}
      } else {
        // Retreat — 90° away from player for 0.8s
        const m = Math.hypot(dx, dy) || 1;
        e.retreatVx = -(dx / m) * 200;
        e.retreatVy = -(dy / m) * 200;
        e.lungeT = -0.8;   // negative = retreat counter
      }
    }
    return;
  }
  // Currently retreating (encoded as negative lungeT counter)
  if (e.lungeT < 0) {
    e.lungeT += dt;
    move(e, e.retreatVx * dt, e.retreatVy * dt, 10);
    if (e.lungeT >= 0) { e.lungeT = 0; e.spottedResolved = false; }
    return;
  }
  // Reset spotted flag when player looks away
  if (!playerSees) e.spottedResolved = false;
  // Normal lunge — close range with LOS
  if (!hidden && dist < 80 && e.lungeCooldown <= 0 && lineClear(e.x, e.y, pug.x, pug.y)) {
    e.lungeT = 0.35; e.lungeCooldown = 2.5;
    try { sfx.sweep(420, 220, 'sawtooth', 0.18, 0.18); } catch {}
    return;
  }
  // Patrol — slow wander biased toward nearby furniture.
  e.wanderT -= dt;
  if (e.wanderT <= 0) {
    e.wanderT = 2 + Math.random() * 2;
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
  // SKITTERING cue (Agent D) — when crawler is OFFSCREEN, emit a faint skittering
  // noise burst every 4..10s. Player hears them but can't pinpoint location.
  if (dist > 360 && gameTime - (e.lastSkitterT || -999) > 4 + Math.random() * 6) {
    e.lastSkitterT = gameTime;
    emitPositionalNoise(e.x, e.y, 0.16, 0.08, 1800);
    emitPositionalTone(e.x, e.y, 340 + Math.random() * 80, 'triangle', 0.05, 0.06, 700, 80);
  }
}

// ----- WHISPERER ----- stationary silhouette. Erodes sanity if the player's
// facing vector points within ~15deg of it AND there's line of sight, for >1.5s.
function tickWhisperer(e, dt, hidden) {
  // HOP — every 20s, teleport to a new visible-ish open tile (player sees it's
  // gone but doesn't see the move). Pick a tile within line-of-sight range but
  // not too close to the player.
  if ((e.nextHopT = (e.nextHopT || 20) - dt) <= 0) {
    e.nextHopT = 18 + Math.random() * 6;
    for (let tries = 0; tries < 25; tries++) {
      const tx = 1 + Math.floor(Math.random() * (cols - 2));
      const ty = 1 + Math.floor(Math.random() * (rows - 2));
      if (grid[ty][tx] !== 0) continue;
      const wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
      const d = Math.hypot(wx - pug.x, wy - pug.y);
      if (d < 200 || d > 520) continue;
      e.x = wx; e.y = wy;
      e.gazeT = 0;
      break;
    }
  }
  if (hidden) { e.gazeT = 0; return; }
  const dx = e.x - pug.x, dy = e.y - pug.y;
  const dist = Math.hypot(dx, dy);
  // LOW-SANITY WALK (Agent D) — at sanity < 30, whisperer slowly walks toward
  // player at 0.5 cells/sec (~ 42px/s). Terrifying because they're normally fixed.
  if (sanity < 30 && dist > 60) {
    const m = dist || 1;
    move(e, (-dx / m) * 42 * dt, (-dy / m) * 42 * dt, 12);
  }
  if (dist > 520 || dist < 60) { e.gazeT = Math.max(0, e.gazeT - dt * 2); return; }
  const fl = Math.hypot(pugFaceX, pugFaceY) || 1;
  const dot = (dx / dist) * (pugFaceX / fl) + (dy / dist) * (pugFaceY / fl);
  const facing = dot > 0.95; // ~18deg
  const visible = lineClear(e.x, e.y, pug.x, pug.y);
  // Drain sanity only when player FACING + visible (per spec: stops draining
  // when player not facing it).
  if (facing && visible) {
    e.gazeT += dt;
    if (e.gazeT > 1.5) {
      sanity = Math.max(0, sanity - 4 * dt);
      if (gameTime - (e.lastWhisperT || -999) > 1.5) {
        e.lastWhisperT = gameTime;
        try { sfx.tone(180 + Math.random() * 80, 'sine', 0.5, 0.04); } catch {}
      }
    }
  } else {
    e.gazeT = Math.max(0, e.gazeT - dt * 1.5);
  }
}

// ----- LURKER ----- (Agent D) invisible, stationary; grabs player if approached
// within 80px without flashlight on. Flashlight on within 220px sets the
// visibility flag (consumed by Agent A's EYES-IN-DARK overlay). Triggered
// lurkers fire a 'lurker' jumpscare and de-spawn (one-shot).
function tickLurker(e, dt, hidden) {
  if (e.triggered) return;
  const dx = e.x - pug.x, dy = e.y - pug.y;
  const dist = Math.hypot(dx, dy);
  // Reveal — when player has flashlight on and is within 220px AND the line is
  // clear, expose the lurker briefly so player can see + dodge.
  if (flashlightOn && dist < 220 && lineClear(e.x, e.y, pug.x, pug.y)) {
    lurkerVisibleT = 1.0;
    lurkerVisibleX = e.x;
    lurkerVisibleY = e.y;
  }
  // Catch — within 80px AND flashlight off (player can't see it).
  if (!hidden && !flashlightOn && dist < 80) {
    e.triggered = true;
    sanity = Math.max(0, sanity - 30);
    hitFlashT = 0.5;
    shake(14, 0.5);
    // Force a real jumpscare even on cooldown (death-ish event).
    jumpScareCooldown = 0;
    jumpScare('lurker');
    // Drop a giant LURKER scream
    try { sfx.sweep(1100, 90, 'sawtooth', 0.55, 0.42); } catch {}
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
  // FOGGY mutator reduces view radius by 30%.
  const foggyMul = (activeMutator && activeMutator.id === 'foggy') ? 0.7 : 1.0;
  const viewR = (flashlightOn ? 340 : 200) * foggyMul;
  // FLOOR — archetype-specific. SAFE rooms get a slight green tint so the
  // player recognises them at a glance.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 0) {
        const rid = (roomTileMap[y] && roomTileMap[y][x] !== undefined) ? roomTileMap[y][x] : -1;
        const room = rid >= 0 ? rooms[rid] : null;
        ctx.fillStyle = ((x + y) & 1) ? LV.floor : LV.floorAlt;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (room && room.kind === 'safe') {
          // Soft green wash for safe rooms
          ctx.fillStyle = 'rgba(60,255,150,0.10)';
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        } else if (room && room.kind === 'secret') {
          // Tiny gold wash for secret rooms (only visible once revealed)
          ctx.fillStyle = 'rgba(255,210,80,0.07)';
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
  }
  // Floor grout (skip on parking lot — its paint stripes replace grout)
  if ((LV.floorPattern || 'carpet') !== 'parking') {
    ctx.strokeStyle = LV.floorGrout; ctx.lineWidth = 1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 0) ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }
  // Floor pattern — archetype-driven texture overlay on top of grout.
  renderFloorPattern();
  // Water tiles (poolrooms) — ripple texture + reflective sheen.
  if (waterTiles.length) renderWaterTiles();
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
  // WALLS — archetype-specific colour + texture. Per-room wallpaper variant
  // is looked up via roomWallpaperIdx so adjacent rooms have visually distinct
  // wallpaper. Falls back to currentWallpaper when no per-room index exists.
  const variants = (LV.wallpaperVariants && LV.wallpaperVariants.length)
    ? LV.wallpaperVariants : [{ wall: LV.wall, light: LV.wallLight, dark: LV.wallDark }];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) {
        const idx = (roomWallpaperIdx[y] && typeof roomWallpaperIdx[y][x] === 'number')
          ? roomWallpaperIdx[y][x] : 0;
        const wp = variants[idx % variants.length];
        ctx.fillStyle = wp.wall;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        renderWallTextureWithVariant(x, y, wp);
      }
    }
  }
  // Mold-stained wall overlays (near water) — extra dark green-brown patches.
  if (waterTiles.length) {
    ctx.fillStyle = 'rgba(40,60,30,0.32)';
    for (const w of waterTiles) {
      // For each water tile, lightly stain a neighbour wall tile
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = w.tx + dx, ny = w.ty + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (grid[ny][nx] !== 1) continue;
        ctx.beginPath();
        ctx.arc(nx * TILE + TILE / 2, ny * TILE + TILE - 8, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Scratch/blood marks near monster spawn — claw furrows on the floor.
  // Three jagged parallel claw rakes (signature for the main Monster Pug),
  // each with darker shadow + brighter blood highlight pixels.
  if (monster && monster.spawnX) {
    const sx = monster.spawnX, sy = monster.spawnY;
    ctx.save();
    // shadow layer (darker behind)
    ctx.strokeStyle = 'rgba(20,2,2,0.55)'; ctx.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      const a = k * 0.7;
      ctx.beginPath();
      ctx.moveTo(sx - 17 + k * 8, sy + 19 + Math.sin(a) * 6);
      ctx.lineTo(sx - 3 + k * 8, sy + 29 + Math.sin(a) * 4);
      ctx.stroke();
    }
    // main blood layer
    ctx.strokeStyle = 'rgba(80,8,8,0.55)'; ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      const a = k * 0.7;
      ctx.beginPath();
      ctx.moveTo(sx - 18 + k * 8, sy + 18 + Math.sin(a) * 6);
      ctx.lineTo(sx - 4 + k * 8, sy + 28 + Math.sin(a) * 4);
      ctx.stroke();
    }
    // bright crimson highlight on the deepest part of each gouge
    ctx.strokeStyle = 'rgba(180,30,30,0.55)'; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      const a = k * 0.7;
      ctx.beginPath();
      ctx.moveTo(sx - 15 + k * 8, sy + 21 + Math.sin(a) * 5);
      ctx.lineTo(sx - 9 + k * 8, sy + 25 + Math.sin(a) * 4);
      ctx.stroke();
    }
    // blood splash droplets at the end of each rake
    ctx.fillStyle = 'rgba(100,8,8,0.5)';
    for (let k = 0; k < 5; k++) {
      const dx = sx - 4 + k * 8, dy = sy + 28;
      ctx.beginPath(); ctx.arc(dx, dy, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
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
  // Ceiling lights flicker — more aggressive than before. Random 0.2-0.4s
  // darkness pulses fire ~1% per frame for sharp flicker bursts; proximity to
  // monster also pushes a "wild flicker" multiplier in `lightFlicker`. During
  // blackout, ALL lights are killed by zeroing flick.
  const proxKick = (Math.hypot(monster.x - pug.x, monster.y - pug.y) < 300) ? 0.5 : 0.0;
  let flick = 0.7 + Math.sin(lightFlicker * 3.1) * 0.2
            + (Math.random() < (0.04 + proxKick * 0.05) ? -0.55 : 0)
            + (Math.random() < 0.012 ? -0.7 : 0);
  if (blackoutT > 0) flick = 0.02;        // total kill during blackout
  const lt = LV.lightTint;
  for (let y = 1; y < rows; y += 4) {
    for (let x = 1; x < cols; x += 4) {
      if (grid[y][x] === 0) {
        const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
        ctx.fillStyle = hexA(lt, Math.max(0.04, flick * 0.32));
        ctx.fillRect(cx - 20, cy - 4, 40, 8);
        ctx.fillStyle = hexA(lt, Math.max(0.06, flick * 0.7));
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
  // Environmental props (filing cabinets, paint cans, etc.) + water coolers.
  renderEnvProps();
  // Bioluminescent fungi (poolrooms + voidpool only)
  if (fungi.length) renderFungi();
  // Garage cars (garage only)
  if (garageCars.length) renderGarageCars();
  // Secret rooms — reveal markers (only after walking into the fake wall)
  renderSecretWalls();
  // Closed doors — wood or glass; block movement until E to open.
  renderClosedDoors();
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
  // Rare items: talismans, map fragments, cigarette packs
  renderRareItems();
  // Round-2: archetype-unique props + sigil + almond water + bio fish.
  renderAlmondWaters();
  renderYellowNotepad();
  renderForklift();
  renderPoolNoodleItem();
  renderBioFish();
  renderMapSigil();
  renderWaterDrops();
  renderCarAlarm();
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
  // Exit (only if cans done) — map-fragment buff makes the exit visible
  // through walls via a giant green halo so lost players can find their way.
  if (cans.length === 0) {
    const glow = 0.7 + Math.sin(performance.now() / 220) * 0.3;
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 20 * glow;
    ctx.fillStyle = '#5ef38c'; ctx.fillRect(exitTile.x - 22, exitTile.y - 30, 44, 60);
    ctx.shadowBlur = 0;
    drawIcon.exit(ctx, exitTile.x, exitTile.y, 36);
    ctx.fillStyle = '#0a1018'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', exitTile.x, exitTile.y + 44);
  }
  if (mapFragmentRevealT > 0) {
    // Giant green halo at the exit so the player can find it.
    const a = Math.min(1, mapFragmentRevealT / 10) * 0.7;
    ctx.save();
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 60;
    ctx.strokeStyle = `rgba(94,243,140,${a})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(exitTile.x, exitTile.y, 80 + Math.sin(performance.now() / 200) * 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // THE END — always-visible glowing EXIT SIGN beacon. Pulses red. Drawn as a
  // tall sign post + an oversized halo so it's recognisable from afar.
  if (endExitSign) {
    const pulse = 0.6 + Math.sin(performance.now() / 240) * 0.4;
    ctx.save();
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 50 * pulse;
    ctx.strokeStyle = `rgba(255,58,58,${0.6 * pulse})`; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(endExitSign.x, endExitSign.y, 120 + Math.sin(performance.now() / 220) * 14, 0, Math.PI * 2);
    ctx.stroke();
    // Sign rectangle ABOVE the exit
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(endExitSign.x - 40, endExitSign.y - 70, 80, 26);
    ctx.fillStyle = '#fff'; ctx.font = "12px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('EXIT', endExitSign.x, endExitSign.y - 52);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // Entities (Hounds + Smilers + Crawlers + Whisperers) — depth-sorted so
  // sprites further "back" render first; depth3D drop shadow under each.
  _depthSort(entities);
  for (const e of entities) {
    _depthShadow(ctx, e.x, e.y + 12, 18, { alpha: 0.32 });
    if (e.kind === 'hound') drawHound(e);
    if (e.kind === 'smiler') drawSmiler(e);
    if (e.kind === 'crawler') drawCrawler(e);
    if (e.kind === 'whisperer') drawWhisperer(e);
  }
  // Monster — main pug-monster (depth-shadow under it adds weight)
  if (monster && monster.visible !== false) _depthShadow(ctx, monster.x, monster.y + 22, 38, { alpha: 0.42 });
  drawMonster();
  // Partygoers (garage only) — drawn after main entities so their hats render on top.
  renderPartygoers();
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
  // depth3D drop shadow under the pug — gives the sprite weight on the floor.
  _depthShadow(ctx, pug.x, pug.y + 14, 22, { alpha: 0.45 });
  // Pug player — high-detail sprite (with hit-flash overlay)
  if (hitFlashT > 0) {
    ctx.save(); ctx.filter = 'brightness(2.5)';
    drawPug(ctx, pug.x, pug.y, { size: 40 });
    ctx.filter = 'none'; ctx.restore();
  } else {
    drawPug(ctx, pug.x, pug.y, { size: 40 });
  }
  // Agent #5: replay ghost trail (drawn in world coords).
  if (replayActive) renderReplayGhosts();
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
  // Red full-screen flash from a jump-scare. Initial 0.15s at FULL opacity
  // (massive overlay), then decays to 0 across remaining timer life.
  if (redFlashT > 0) {
    // redFlashT starts at 0.15. First "half" = 1.0 opacity, then linear fade.
    const a = redFlashT > 0.075 ? 1.0 : (redFlashT / 0.075);
    ctx.fillStyle = `rgba(220,10,10,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
  // JUMP SCARE — DOMINATING full-viewport face. Holds 0.8s then fades 0.5s.
  // 3-frame flicker entrance: visible (0-40ms), hidden (40-80ms), visible
  // (80-120ms) — strobe effect that sells the terror. Veins/cracks overlay
  // on the face for additional horror detail. Each kind paints a distinct
  // full-screen image. Reduced-motion users get a static image (no flicker
  // / no jitter); the shake is already 0 via _shakeMul().
  if (jumpScareT > 0 && jumpScareKind && jumpScareKind !== 'ambient') {
    const elapsed = jumpScareLife - jumpScareT;
    const reduce = isReducedMotion();
    // 3-frame flicker entrance (skipped under reduced motion)
    let flickerVisible = true;
    if (!reduce) {
      if (elapsed < 0.04) flickerVisible = true;
      else if (elapsed < 0.08) flickerVisible = false;
      else if (elapsed < 0.12) flickerVisible = true;
    }
    const isPhantom = jumpScareKind === 'phantom' || jumpScareKind === 'reflection';
    // Phantom = quick flash; main scares = 0.8s hold + 0.5s fade.
    let a = 1;
    if (isPhantom) {
      a = elapsed < 0.15 ? 1 : Math.max(0, 1 - (elapsed - 0.15) / (jumpScareLife - 0.15));
    } else if (elapsed > 0.8) {
      a = Math.max(0, 1 - (elapsed - 0.8) / 0.5);
    }
    if (!flickerVisible) a = 0;
    // Heavy jitter — was 14, now 22. Reduced motion = static.
    const jx = reduce ? 0 : (Math.random() - 0.5) * 22 * a;
    const jy = reduce ? 0 : (Math.random() - 0.5) * 22 * a;
    ctx.save();
    ctx.globalAlpha = a;
    const cx = W / 2 + jx, cy = H / 2 + jy;
    // FULL-VIEWPORT black backdrop (no margin) for every scare
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, W, H);
    if (jumpScareKind === 'monster') {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(120,0,0,0.85)');
      rg.addColorStop(1, 'rgba(20,0,0,0.0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      const size = Math.min(W, H) * 1.4;          // FILL viewport
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 60;
      drawMonsterPug(ctx, cx, cy, { size, body: '#5a0d0d' });
      ctx.shadowBlur = 0;
      drawVeinsOverlay(cx, cy, Math.min(W, H) * 0.7, '#7a0808');
    } else if (jumpScareKind === 'hound') {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(50,0,0,0.95)');
      rg.addColorStop(1, 'rgba(8,0,0,0.0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      const sc = Math.min(W, H) / 240;
      ctx.fillStyle = '#1a0606';
      ctx.fillRect(cx - 260 * sc, cy - 80 * sc, 520 * sc, 220 * sc);
      ctx.fillRect(cx + 100 * sc, cy - 150 * sc, 220 * sc, 240 * sc);
      ctx.fillRect(cx + 240 * sc, cy - 60 * sc, 140 * sc, 100 * sc);
      ctx.fillStyle = '#ff3a3a';
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 80;
      ctx.fillRect(cx + 160 * sc, cy - 110 * sc, 36 * sc, 36 * sc);
      ctx.fillRect(cx + 230 * sc, cy - 100 * sc, 36 * sc, 36 * sc);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      const fangCount = 16;
      const fw = (Math.min(W, H) * 1.1) / fangCount;
      for (let i = 0; i < fangCount; i++) {
        const fx = cx - Math.min(W, H) * 0.55 + i * fw;
        const fy = cy + Math.min(W, H) * 0.05;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + fw, fy);
        ctx.lineTo(fx + fw / 2, fy + fw * 1.5);
        ctx.closePath(); ctx.fill();
      }
      drawVeinsOverlay(cx, cy, Math.min(W, H) * 0.6, '#8a1010');
    } else if (jumpScareKind === 'smiler') {
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, W, H);
      const sc = Math.min(W, H) / 280;
      ctx.fillStyle = '#ffd23f';
      ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 80;
      ctx.fillRect(cx - 120 * sc, cy - 60 * sc, 60 * sc, 60 * sc);
      ctx.fillRect(cx + 60 * sc, cy - 60 * sc, 60 * sc, 60 * sc);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      const tt = Math.floor(Math.min(W, H) / 28);
      for (let i = -tt; i <= tt; i++) {
        const yy = cy + 80 * sc + Math.abs(i) * 3 * sc;
        ctx.fillRect(cx + i * 18 * sc, yy, 16 * sc, 30 * sc);
      }
      drawVeinsOverlay(cx, cy, Math.min(W, H) * 0.65, '#aa8800');
    } else if (jumpScareKind === 'crawler') {
      ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fillRect(0, 0, W, H);
      const sc = Math.min(W, H) / 200;
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 12 * sc;
      for (let i = 0; i < 8; i++) {
        const a2 = (i / 8) * Math.PI * 2 + Math.sin(elapsed * 6 + i) * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a2) * 280 * sc, cy + Math.sin(a2) * 160 * sc);
        ctx.stroke();
      }
      ctx.fillStyle = '#180a0a';
      ctx.beginPath(); ctx.ellipse(cx, cy, 120 * sc, 80 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff3a3a'; ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 40;
      for (let i = 0; i < 6; i++) {
        const ex = cx + ((i % 3) - 1) * 40 * sc;
        const ey = cy + (i < 3 ? -22 : 16) * sc;
        ctx.fillRect(ex - 8 * sc, ey - 8 * sc, 16 * sc, 16 * sc);
      }
      ctx.shadowBlur = 0;
      drawVeinsOverlay(cx, cy, Math.min(W, H) * 0.55, '#8a1010');
    } else if (jumpScareKind === 'whisperer') {
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
      rg.addColorStop(0, 'rgba(20,20,30,0.7)');
      rg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      const sc = Math.min(W, H) / 200;
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - 60 * sc, cy - 220 * sc, 120 * sc, 360 * sc);
      ctx.beginPath(); ctx.arc(cx, cy - 240 * sc, 60 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 110 * sc, cy - 160 * sc, 28 * sc, 220 * sc);
      ctx.fillRect(cx + 82 * sc, cy - 160 * sc, 28 * sc, 220 * sc);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 30;
      ctx.fillRect(cx - 20 * sc, cy - 250 * sc, 10 * sc, 10 * sc);
      ctx.fillRect(cx + 10 * sc, cy - 250 * sc, 10 * sc, 10 * sc);
      ctx.shadowBlur = 0;
    } else if (jumpScareKind === 'phantom') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H);
      const size = Math.min(W, H) * 0.9;
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 30;
      drawMonsterPug(ctx, cx, cy, { size, body: '#3a0808' });
      ctx.shadowBlur = 0;
    } else if (jumpScareKind === 'reflection') {
      ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, W, H);
      const size = Math.min(W, H) * 1.1;
      drawPug(ctx, cx, cy, { size });
      ctx.fillStyle = '#ff3a3a';
      ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 50;
      const ey = cy - size * 0.06;
      const eo = size * 0.14;
      ctx.fillRect(cx - eo - size * 0.04, ey, size * 0.08, size * 0.08);
      ctx.fillRect(cx + eo - size * 0.04, ey, size * 0.08, size * 0.08);
      ctx.shadowBlur = 0;
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
  // PERIPHERAL DOORWAY GLIMPSE — 0.2s silhouette at screen edge.
  // -------------------------------------------------------------------------
  if (peripheralT > 0) {
    const ap = peripheralT / 0.22;
    ctx.save();
    ctx.globalAlpha = ap * 0.85;
    ctx.fillStyle = '#000';
    if (peripheralSide === 0) {
      ctx.fillRect(0, H * 0.35, 30, H * 0.5);
      ctx.fillRect(-10, H * 0.28, 50, 80);
    } else if (peripheralSide === 1) {
      ctx.fillRect(W - 30, H * 0.35, 30, H * 0.5);
      ctx.fillRect(W - 40, H * 0.28, 50, 80);
    } else if (peripheralSide === 2) {
      ctx.fillRect(W * 0.4, 0, W * 0.2, 60);
      ctx.beginPath(); ctx.ellipse(W * 0.5, 60, 50, 30, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(W * 0.4, H - 60, W * 0.2, 60);
      ctx.beginPath(); ctx.ellipse(W * 0.5, H - 60, 50, 30, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // EYES IN DARK — two glowing red eyes appear briefly, drift, then vanish.
  // -------------------------------------------------------------------------
  if (eyesT > 0) {
    const ea = Math.min(1, eyesT / 0.4);
    ctx.save();
    ctx.globalAlpha = ea;
    ctx.fillStyle = '#ff3a3a';
    ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 30;
    ctx.fillRect(eyesX - 14, eyesY - 4, 8, 8);
    ctx.fillRect(eyesX + 6, eyesY - 4, 8, 8);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // BLACKOUT OVERLAY — total darkness when all lights are OUT.
  // -------------------------------------------------------------------------
  if (blackoutT > 0) {
    const t = blackoutLife - blackoutT;
    let aBlack = 0.92;
    if (t < 0.2) aBlack = 0.92 * (t / 0.2);
    else if (blackoutT < 0.3) aBlack = 0.92 * (blackoutT / 0.3);
    ctx.fillStyle = `rgba(0,0,0,${aBlack})`;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------------------------------
  // STROBOSCOPIC — red+white strobe at 6Hz for 2s (sanity < 30). SKIPPED
  // under reduced motion (potential seizure trigger).
  // -------------------------------------------------------------------------
  if (stroboT > 0 && !isReducedMotion()) {
    const phase = Math.floor((2.0 - stroboT) * 12) % 2;
    ctx.fillStyle = phase ? 'rgba(255,255,255,0.6)' : 'rgba(255,40,40,0.6)';
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------------------------------
  // SANITY-BASED ESCALATION — tiered grain, color shift, hallucinations.
  //  60-80: slight grain (0.02) + occasional flicker
  //  40-60: edge shimmer + more grain (0.04)
  //  20-40: heavy grain + red wash + 6-amp shake every 8s
  //   <20 : full hallucination — fake silhouettes in peripheral + sin warp
  // -------------------------------------------------------------------------
  if (sanity < 80) {
    if (sanity >= 60) {
      ctx.globalAlpha = 0.02;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 24; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      ctx.globalAlpha = 1;
      if (Math.random() < 0.005) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 0, W, H);
      }
    } else if (sanity >= 40) {
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 50; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 8; i++) {
        const sxe = Math.random() * W;
        ctx.fillRect(sxe, 0, 1, H);
      }
    } else if (sanity >= 20) {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 80; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      ctx.fillStyle = '#000';
      for (let i = 0; i < 80; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(180,30,30,0.06)';
      ctx.fillRect(0, 0, W, H);
      if (gameTime - (window.__lastSanShake || 0) > 8) {
        window.__lastSanShake = gameTime;
        shake(6, 0.3);
      }
    } else {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 120; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      ctx.fillStyle = '#000';
      for (let i = 0; i < 120; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(220,30,30,0.10)';
      ctx.fillRect(0, 0, W, H);
      const pT = performance.now() / 800;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const lx = 30 + Math.sin(pT) * 18;
      const ly = H * 0.25 + Math.cos(pT * 0.7) * 30;
      ctx.beginPath(); ctx.ellipse(lx, ly, 38, 56, 0, 0, Math.PI * 2); ctx.fill();
      const rx = W - 50 + Math.sin(pT * 1.3) * 18;
      const ry = H * 0.7 + Math.cos(pT * 0.9) * 30;
      ctx.beginPath(); ctx.ellipse(rx, ry, 38, 56, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,0,0,0.04)';
      const wpT = performance.now() / 200;
      for (let yy = 0; yy < H; yy += 12) {
        const wOff = Math.sin(yy / 30 + wpT) * 6;
        ctx.fillRect(wOff, yy, W, 6);
      }
    }
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
  // ROUND-2 SCREEN OVERLAYS — mutator banner, dev-note flash, almond counter.
  // These render in screen-space (no camera transform).
  // -------------------------------------------------------------------------
  // Mutator banner — top-center bar; fades out over its banner timer.
  if (activeMutator && mutatorBannerT > 0) {
    const a = Math.min(1, mutatorBannerT / 4) * 0.92;
    ctx.save();
    ctx.globalAlpha = a;
    const bx = W / 2 - 200, by = 12, bw = 400, bh = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ff8e3c'; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.textAlign = 'center';
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillStyle = '#ff8e3c';
    ctx.fillText(`MUTATOR · ${activeMutator.name}`, W / 2, by + 16);
    ctx.font = "8px 'Press Start 2P', monospace";
    ctx.fillStyle = '#ddd';
    ctx.fillText(activeMutator.desc, W / 2, by + 30);
    ctx.restore();
  }
  // ALMOND WATER counter — bottom-left small badge with count.
  {
    const bx = 12, by = H - 36;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, 160, 26);
    ctx.fillStyle = '#48d8ff';
    ctx.fillRect(bx + 4, by + 6, 4, 14);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx + 5, by + 4, 2, 2);
    ctx.textAlign = 'left';
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = '#48d8ff';
    ctx.fillText(`ALMOND WATER  ${almondWaterCollected}/${MAX_LEVEL}`, bx + 16, by + 16);
    ctx.restore();
  }
  // SIGIL counter — also bottom-left, just above the almond counter.
  {
    const sc = loadSigilCount();
    if (sc > 0) {
      const bx = 12, by = H - 64;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(bx, by, 160, 26);
      ctx.fillStyle = '#d2a8ff';
      ctx.fillRect(bx + 4, by + 6, 4, 14);
      ctx.textAlign = 'left';
      ctx.font = "9px 'Press Start 2P', monospace";
      ctx.fillStyle = '#d2a8ff';
      ctx.fillText(`SIGILS  ${sc}/7`, bx + 16, by + 16);
      ctx.restore();
    }
  }
  // POOL NOODLE indicator (only when player has 1+ charges)
  if (poolNoodleCharges > 0) {
    const bx = 12, by = H - 92;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, 200, 26);
    ctx.fillStyle = '#ffec3c';
    ctx.fillRect(bx + 4, by + 10, 10, 4);
    ctx.textAlign = 'left';
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = '#ffec3c';
    ctx.fillText(`POOL NOODLE × ${poolNoodleCharges}  (Q)`, bx + 18, by + 16);
    ctx.restore();
  }
  // DEV NOTE flash — yellow notepad pickup. Brief overlay reveals a snippet.
  if (yellowNoteFlashT > 0 && yellowNoteText) {
    const a = Math.min(1, yellowNoteFlashT / 1.0);
    ctx.save();
    ctx.globalAlpha = a;
    const bw = 460, bh = 60;
    const bx = (W - bw) / 2, by = H - 140;
    ctx.fillStyle = 'rgba(20,20,10,0.85)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffec3c'; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.textAlign = 'center';
    ctx.font = "9px 'Press Start 2P', monospace";
    ctx.fillStyle = '#ffec3c';
    ctx.fillText('DEV NOTE FOUND', W / 2, by + 18);
    ctx.font = "11px 'VT323', 'Press Start 2P', monospace";
    ctx.fillStyle = '#fff';
    ctx.fillText(yellowNoteText, W / 2, by + 40);
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
  // ===== PSYCHIC FLASH overlay — brief top-down map reveal =====
  // Drawn as a 1s SCREEN-SPACE pass after everything else. White out the
  // viewport for ~0.15s, then fade in a top-down schematic with cans + exit.
  if (psychicFlashT > 0) {
    const phase = 1 - psychicFlashT; // 0..1
    // v4 polish: sanity tilt — subtle rotation+shake during the flash,
    // strongest at the bright-out moment. Tilt range: ±2.5deg.
    if (phase < 0.55) {
      const tk = phase < 0.25 ? (phase / 0.25) : (1 - (phase - 0.25) / 0.3);
      const tilt = Math.sin(performance.now() * 0.014) * 0.044 * tk;
      // Apply screen-space tilt by pivoting around viewport center.
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(tilt); ctx.translate(-W / 2, -H / 2);
      // tear-drop streaks falling across the screen — vertical chromatic blur lines
      const streakA = Math.min(1, (phase < 0.2 ? phase / 0.2 : 1 - phase) * 1.2);
      if (streakA > 0) {
        ctx.fillStyle = `rgba(255,255,255,${streakA * 0.18})`;
        const t = performance.now() * 0.001;
        for (let i = 0; i < 14; i++) {
          const sx = ((i * 91 + Math.floor(t * 60)) % W);
          const sh = 30 + (i % 5) * 18;
          ctx.fillRect(sx, ((i * 53) % H), 1.5, sh);
        }
      }
      ctx.restore();
    }
    // Initial bright flash (first 25% of duration)
    const flashA = phase < 0.25 ? (1 - phase / 0.25) * 0.75 : 0;
    if (flashA > 0) { ctx.fillStyle = `rgba(255,255,255,${flashA})`; ctx.fillRect(0, 0, W, H); }
    // Minimap reveal (after the flash, fades over remaining time)
    if (phase > 0.15) {
      const a = Math.min(1, (1 - phase) * 2.5);
      const mmW = Math.min(W * 0.55, 380), mmH = Math.min(H * 0.55, 280);
      const mmX = (W - mmW) / 2, mmY = (H - mmH) / 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(8,12,20,0.85)'; ctx.fillRect(mmX, mmY, mmW, mmH);
      ctx.strokeStyle = '#5ef38c'; ctx.lineWidth = 2;
      ctx.strokeRect(mmX + 0.5, mmY + 0.5, mmW - 1, mmH - 1);
      const sxS = mmW / (cols * TILE), syS = mmH / (rows * TILE);
      // walls
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) ctx.fillRect(mmX + x * TILE * sxS, mmY + y * TILE * syS, Math.max(1, TILE * sxS), Math.max(1, TILE * syS));
      }
      // cans (pulse)
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
      ctx.fillStyle = `rgba(76,201,240,${0.6 + pulse * 0.4})`;
      for (const c of cans || []) if (!c.taken) ctx.fillRect(mmX + c.x * sxS - 3, mmY + c.y * syS - 3, 6, 6);
      // exit
      // exitTile stores world coords (.x/.y), not tile coords (.tx/.ty);
      // the original `.tx*TILE` math produced NaN so the exit dot never drew.
      if (exitTile) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(mmX + exitTile.x * sxS - 4, mmY + exitTile.y * syS - 4, 8, 8); }
      // pug
      // Was using sxS for the y-axis — pug dot rendered at wrong vertical pos.
      if (pug) { ctx.fillStyle = '#ff3aa1'; ctx.fillRect(mmX + pug.x * sxS - 3, mmY + pug.y * syS - 3, 6, 6); }
      // label
      ctx.fillStyle = '#5ef38c'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('PSYCHIC FLASH', mmX + mmW / 2, mmY - 8);
      ctx.restore();
    }
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

// Per-room wallpaper variant wrapper — feeds chosen variant's light/dark into
// the same wall-pattern code paths. Lets adjacent rooms paint different zones.
function renderWallTextureWithVariant(x, y, wp) {
  const px = x * TILE, py = y * TILE;
  const wpLight = wp ? wp.light : (currentWallpaper ? currentWallpaper.light : LV.wallLight);
  const wpDark = wp ? wp.dark : (currentWallpaper ? currentWallpaper.dark : LV.wallDark);
  if (LV.wallPattern === 'wallpaper') {
    ctx.fillStyle = wpLight;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        ctx.fillRect(px + 6 + i * 16, py + 6 + j * 16, 2, 2);
    ctx.fillStyle = wpDark;
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 16, py, 1, TILE);
  } else if (LV.wallPattern === 'concrete') {
    ctx.fillStyle = wpLight;
    ctx.fillRect(px, py + 28, TILE, 2);
    ctx.fillStyle = wpDark;
    ctx.fillRect(px, py + 30, TILE, 1);
    for (let i = 0; i < 8; i++) {
      const r1 = ((x * 71 + y * 17 + i * 13) % 64);
      const r2 = ((x * 31 + y * 47 + i * 23) % 64);
      ctx.fillStyle = i & 1 ? wpLight : wpDark;
      ctx.fillRect(px + r1, py + r2, 2, 2);
    }
  } else if (LV.wallPattern === 'pipes') {
    ctx.fillStyle = wpLight;
    ctx.fillRect(px + 8, py, 6, TILE);
    ctx.fillRect(px + 48, py, 4, TILE);
    ctx.fillStyle = wpDark;
    ctx.fillRect(px + 8, py, 1, TILE);
    ctx.fillRect(px + 13, py, 1, TILE);
    ctx.fillRect(px + 48, py, 1, TILE);
    ctx.fillRect(px + 51, py, 1, TILE);
    if (((x * 13 + y * 7) % 5) === 0) {
      ctx.fillStyle = '#a02a1a';
      ctx.fillRect(px + 22, py + 24, 16, 4);
      ctx.fillRect(px + 28, py + 18, 4, 16);
    }
  } else if (LV.wallPattern === 'tile') {
    ctx.fillStyle = wpLight;
    ctx.fillRect(px + 2, py + 2, TILE - 4, 2);
    ctx.fillRect(px + 2, py + TILE / 2 - 1, TILE - 4, 2);
    ctx.fillStyle = wpDark;
    ctx.fillRect(px, py, 2, TILE);
    ctx.fillRect(px + TILE / 2 - 1, py, 2, TILE);
    if (((x * 17 + y * 23) % 7) === 0) {
      ctx.strokeStyle = wpDark; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 8, py + 12);
      ctx.lineTo(px + 14, py + 30);
      ctx.lineTo(px + 26, py + 44);
      ctx.stroke();
    }
  }
}

// Archetype-specific FLOOR pattern overlay.
function renderFloorPattern() {
  const pat = LV.floorPattern || 'carpet';
  if (pat === 'carpet') {
    renderCarpetDots();
  } else if (pat === 'tile') {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== 0) continue;
        if ((x + y) & 1) ctx.fillRect(x * TILE + 4, y * TILE + 4, TILE - 8, 2);
      }
    }
  } else if (pat === 'parking') {
    ctx.fillStyle = 'rgba(220,180,40,0.35)';
    for (let y = 0; y < rows; y++) {
      if (y % 3 !== 0) continue;
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== 0) continue;
        ctx.fillRect(x * TILE + 8, y * TILE + TILE - 6, TILE - 16, 3);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== 0) continue;
        if (((x * 11 + y * 17) % 23) === 0) {
          ctx.beginPath();
          ctx.ellipse(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE * 0.35, TILE * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else if (pat === 'concrete') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== 0) continue;
        const seed = (x * 73 + y * 31) % 16;
        ctx.fillRect(x * TILE + (seed * 5) % TILE, y * TILE + (seed * 11) % TILE, 2, 2);
      }
    }
  }
}

// Water-tile rendering — ripples + sheen for poolrooms.
function renderWaterTiles() {
  const t = performance.now() / 600;
  for (const w of waterTiles) {
    const px = w.tx * TILE, py = w.ty * TILE;
    ctx.fillStyle = 'rgba(80,160,200,0.45)';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.strokeStyle = 'rgba(220,240,255,0.35)'; ctx.lineWidth = 1;
    const off = ((w.tx * 7 + w.ty * 11) % 7) * 0.3;
    const r1 = 8 + ((Math.sin(t + off) + 1) * 8);
    const r2 = 18 + ((Math.sin(t + off + 1.2) + 1) * 6);
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, r1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + TILE / 2 + 4, py + TILE / 2 - 3, r2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(px + 6, py + 10, TILE - 12, 4);
  }
}

// Bioluminescent fungi — small glowing dots clustered on wall edges.
function renderFungi() {
  for (const f of fungi) {
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// Garage abandoned cars — sideways shapes, optionally smashed.
function renderGarageCars() {
  for (const c of garageCars) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(c.x - c.w / 2 + 4, c.y - c.h / 2 + 6, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
    ctx.fillStyle = '#222';
    ctx.fillRect(c.x - c.w / 2 + 16, c.y - c.h / 2 + 6, c.w - 32, c.h - 12);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(c.x - c.w / 2 + 8, c.y + c.h / 2 - 4, 14, 8);
    ctx.fillRect(c.x + c.w / 2 - 22, c.y + c.h / 2 - 4, 14, 8);
    ctx.fillStyle = c.smashed ? '#1a1a1a' : 'rgba(140,180,200,0.45)';
    ctx.fillRect(c.x - c.w / 2 + 22, c.y - c.h / 2 + 12, c.w / 2 - 18, c.h - 24);
    ctx.fillRect(c.x + 6, c.y - c.h / 2 + 12, c.w / 2 - 28, c.h - 24);
    if (c.smashed) {
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x - 12, c.y); ctx.lineTo(c.x + 12, c.y - 6);
      ctx.moveTo(c.x - 8, c.y - 8); ctx.lineTo(c.x + 8, c.y + 6);
      ctx.stroke();
    }
    ctx.fillStyle = c.smashed ? 'rgba(120,90,40,0.2)' : 'rgba(255,240,180,0.45)';
    ctx.fillRect(c.x + c.w / 2 - 4, c.y - 8, 4, 6);
    ctx.fillRect(c.x + c.w / 2 - 4, c.y + 2, 4, 6);
  }
  for (const r of garageRamps) {
    ctx.fillStyle = 'rgba(20,20,20,0.5)';
    ctx.fillRect(r.x - 28, r.y - 18, 56, 36);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x - 26, r.y - 14); ctx.lineTo(r.x + 24, r.y);
    ctx.moveTo(r.x - 26, r.y + 14); ctx.lineTo(r.x + 24, r.y);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('RAMP', r.x, r.y - 22);
  }
}

// Environmental storytelling props.
function renderEnvProps() {
  for (const p of envProps) drawEnvProp(p);
  for (const w of waterCoolers) drawWaterCooler(w);
}

function drawEnvProp(p) {
  if (p.kind === 'filing_cabinet') {
    ctx.fillStyle = '#5e6068'; ctx.fillRect(p.x - 14, p.y - 18, 28, 36);
    ctx.fillStyle = '#3e4048'; ctx.fillRect(p.x - 14, p.y - 18, 28, 2);
    ctx.fillRect(p.x - 14, p.y - 6, 28, 1);
    ctx.fillRect(p.x - 14, p.y + 6, 28, 1);
    ctx.fillStyle = '#8a8c94';
    ctx.fillRect(p.x - 2, p.y - 14, 4, 2);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 2);
    ctx.fillRect(p.x - 2, p.y + 10, 4, 2);
  } else if (p.kind === 'broken_vending') {
    ctx.fillStyle = '#1a3a5e'; ctx.fillRect(p.x - 16, p.y - 22, 32, 38);
    ctx.fillStyle = '#0a1a2e'; ctx.fillRect(p.x - 14, p.y - 20, 28, 6);
    ctx.fillStyle = '#444a52';
    ctx.fillRect(p.x - 14, p.y - 10, 28, 22);
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - 10, p.y - 8); ctx.lineTo(p.x + 8, p.y + 8);
    ctx.moveTo(p.x + 8, p.y - 6); ctx.lineTo(p.x - 10, p.y + 6);
    ctx.stroke();
    ctx.fillStyle = '#ff3a3a'; ctx.fillRect(p.x + 6, p.y, 4, 4);
  } else if (p.kind === 'fallen_chair') {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(0.6);
    ctx.fillStyle = '#5a3e1c'; ctx.fillRect(-12, -8, 24, 6);
    ctx.fillStyle = '#3a2810'; ctx.fillRect(-12, -2, 24, 14);
    ctx.fillRect(-10, 8, 3, 8); ctx.fillRect(7, 8, 3, 8);
    ctx.restore();
  } else if (p.kind === 'paint_splatter') {
    const cols2 = ['#a02020', '#3060c0', '#d2a020'];
    ctx.fillStyle = cols2[(p.x * 17 + p.y) % 3 | 0];
    ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cols2[(p.y * 7) % 3 | 0];
    ctx.beginPath(); ctx.arc(p.x - 8, p.y + 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + 10, p.y - 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888'; ctx.fillRect(p.x + 6, p.y - 14, 12, 8);
  } else if (p.kind === 'cardboard_stack') {
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(p.x - 14, p.y - 8, 28, 18);
    ctx.fillStyle = '#5a3e18'; ctx.fillRect(p.x - 14, p.y - 8, 28, 2);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(p.x - 10, p.y - 18, 20, 12);
    ctx.fillStyle = '#5a3e18'; ctx.fillRect(p.x - 10, p.y - 18, 20, 2);
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(p.x - 1, p.y - 18, 2, 28);
    ctx.fillRect(p.x - 14, p.y - 1, 28, 2);
  } else if (p.kind === 'shoes') {
    ctx.fillStyle = '#3a2a18';
    ctx.fillRect(p.x - 12, p.y, 10, 5);
    ctx.fillRect(p.x + 2, p.y - 3, 10, 5);
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(p.x - 12, p.y + 4, 10, 1);
    ctx.fillRect(p.x + 2, p.y + 1, 10, 1);
  } else if (p.kind === 'briefcase') {
    ctx.fillStyle = '#3a2818'; ctx.fillRect(p.x - 14, p.y - 6, 28, 14);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(p.x - 14, p.y - 6, 28, 2);
    ctx.fillStyle = '#222'; ctx.fillRect(p.x - 2, p.y - 12, 4, 6);
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(p.x - 10, p.y + 2, 8, 6);
    ctx.fillRect(p.x + 2, p.y + 2, 8, 6);
    ctx.fillStyle = '#1a1208'; ctx.fillRect(p.x - 9, p.y + 4, 6, 1);
    ctx.fillRect(p.x + 3, p.y + 4, 6, 1);
  } else if (p.kind === 'dead_plant') {
    ctx.fillStyle = '#3a2818'; ctx.fillRect(p.x - 8, p.y, 16, 12);
    ctx.fillStyle = '#5a3818'; ctx.fillRect(p.x - 8, p.y, 16, 3);
    ctx.strokeStyle = '#3a2818'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * 10, p.y - 8 + Math.sin(a) * 6);
      ctx.stroke();
    }
    ctx.fillStyle = '#4a3a08';
    ctx.fillRect(p.x - 6, p.y - 12, 3, 3);
    ctx.fillRect(p.x + 2, p.y - 10, 3, 3);
  } else if (p.kind === 'wall_calendar') {
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(p.x - 14, p.y - 14, 28, 22);
    ctx.fillStyle = '#a02020'; ctx.fillRect(p.x - 14, p.y - 14, 28, 4);
    ctx.fillStyle = '#222'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('TUE', p.x, p.y - 7);
    ctx.strokeStyle = '#a02020'; ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) {
        const cx = p.x - 10 + c * 5, cy = p.y - 2 + r * 4;
        ctx.beginPath();
        ctx.moveTo(cx - 1, cy - 1); ctx.lineTo(cx + 1, cy + 1);
        ctx.moveTo(cx + 1, cy - 1); ctx.lineTo(cx - 1, cy + 1);
        ctx.stroke();
      }
  }
}

function drawWaterCooler(w) {
  ctx.fillStyle = w.used ? '#888' : '#bce0e8';
  ctx.fillRect(w.x - 10, w.y - 22, 20, 24);
  ctx.fillStyle = w.used ? '#666' : '#2a78a8';
  ctx.fillRect(w.x - 10, w.y + 2, 20, 12);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(w.x - 4, w.y + 14, 8, 4);
  ctx.fillStyle = '#888'; ctx.fillRect(w.x - 2, w.y + 6, 4, 4);
  if (!w.used) {
    ctx.fillStyle = '#5ef38c'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('DRINK', w.x, w.y - 28);
  }
}

// Closed door rendering — wood or glass.
function renderClosedDoors() {
  for (const d of closedDoors) {
    const px = d.tx * TILE, py = d.ty * TILE;
    if (d.glass) {
      ctx.fillStyle = 'rgba(180,220,240,0.35)';
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 4;
      ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(px + 10, py + 10, 6, TILE - 20);
    } else {
      ctx.fillStyle = '#5a3818';
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(px + 4, py + 4, TILE - 8, 4);
      ctx.fillRect(px + 4, py + TILE - 8, TILE - 8, 4);
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1;
      ctx.strokeRect(px + 12, py + 12, TILE - 24, (TILE - 24) / 2 - 2);
      ctx.strokeRect(px + 12, py + TILE / 2 + 2, TILE - 24, (TILE - 24) / 2 - 4);
      ctx.fillStyle = '#ddd2a0';
      ctx.fillRect(px + TILE - 18, py + TILE / 2 - 2, 4, 4);
    }
    if (pug && Math.hypot(pug.x - (px + TILE / 2), pug.y - (py + TILE / 2)) < TILE * 1.2) {
      ctx.fillStyle = '#ffd23f'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('E', px + TILE / 2, py - 4);
    }
  }
}

// Secret-wall hints — only after revealed.
function renderSecretWalls() {
  for (const s of secretWalls) {
    if (!s.revealed) continue;
    const px = s.tx * TILE + TILE / 2, py = s.ty * TILE + TILE / 2;
    ctx.fillStyle = 'rgba(255,200,80,0.25)';
    ctx.beginPath(); ctx.arc(px, py, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('SECRET', px, py - 22);
  }
}

// Render talismans/map-fragments/cigarette packs.
function renderRareItems() {
  for (const t of talismanItems) {
    const bob = Math.sin(performance.now() / 280 + (t.x | 0)) * 1.6;
    ctx.save();
    ctx.shadowColor = '#b055ff'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#3a1858';
    ctx.beginPath(); ctx.arc(t.x, t.y + bob, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d2a8ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.x, t.y + bob, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(t.x - 1, t.y + bob - 5, 2, 10);
    ctx.fillRect(t.x - 5, t.y + bob - 1, 10, 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  for (const m of mapFragments) {
    const bob = Math.sin(performance.now() / 320 + (m.x | 0)) * 1.4;
    ctx.save();
    ctx.shadowColor = '#5ef38c'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(m.x - 10, m.y - 8 + bob, 20, 16);
    ctx.fillStyle = '#bda878';
    ctx.fillRect(m.x - 10, m.y - 8 + bob, 20, 2);
    ctx.strokeStyle = '#1a4030'; ctx.lineWidth = 1;
    ctx.strokeRect(m.x - 8, m.y - 6 + bob, 16, 12);
    ctx.beginPath();
    ctx.moveTo(m.x - 4, m.y - 6 + bob); ctx.lineTo(m.x - 4, m.y + 6 + bob);
    ctx.moveTo(m.x + 2, m.y - 6 + bob); ctx.lineTo(m.x + 2, m.y + 6 + bob);
    ctx.moveTo(m.x - 8, m.y - 2 + bob); ctx.lineTo(m.x + 8, m.y - 2 + bob);
    ctx.moveTo(m.x - 8, m.y + 2 + bob); ctx.lineTo(m.x + 8, m.y + 2 + bob);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  for (const c of cigaretteItems) {
    const bob = Math.sin(performance.now() / 340 + (c.x | 0)) * 1.2;
    ctx.save();
    ctx.fillStyle = '#f0e8d8';
    ctx.fillRect(c.x - 7, c.y - 6 + bob, 14, 12);
    ctx.fillStyle = '#a02020';
    ctx.fillRect(c.x - 7, c.y - 6 + bob, 14, 3);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(c.x - 5, c.y - 1 + bob, 2, 6);
    ctx.fillRect(c.x - 1, c.y - 1 + bob, 2, 6);
    ctx.fillRect(c.x + 3, c.y - 1 + bob, 2, 6);
    ctx.restore();
  }
}

// Round-2 expansion renderers.
function renderAlmondWaters() {
  const t = performance.now() / 320;
  for (const a of almondWaters) {
    const glow = 0.6 + Math.sin(t + a.x) * 0.4;
    const bob = Math.sin(t * 1.4 + a.x) * 1.6;
    ctx.save();
    // Halo
    ctx.shadowColor = '#48d8ff'; ctx.shadowBlur = 20 * glow;
    // Bottle body
    ctx.fillStyle = '#a8e8ff';
    ctx.fillRect(a.x - 6, a.y - 12 + bob, 12, 22);
    // Neck/cap
    ctx.fillStyle = '#e0f8ff';
    ctx.fillRect(a.x - 3, a.y - 16 + bob, 6, 4);
    ctx.fillStyle = '#2078a8';
    ctx.fillRect(a.x - 3, a.y - 18 + bob, 6, 2);
    // Label
    ctx.fillStyle = '#0a3050';
    ctx.fillRect(a.x - 5, a.y - 4 + bob, 10, 6);
    ctx.fillStyle = '#fff';
    ctx.font = "5px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('A.W', a.x, a.y + 1 + bob);
    ctx.shadowBlur = 0;
    // Prompt when close enough
    if (Math.hypot(a.x - pug.x, a.y - pug.y) < 36) {
      ctx.fillStyle = '#48d8ff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('E DRINK', a.x, a.y - 22);
    }
    ctx.restore();
  }
}
function renderMapSigil() {
  if (!mapSigil || mapSigil.found) return;
  // Etched glyph at the wall tile center. Subtle so the player has to be near.
  const dist = Math.hypot(mapSigil.x - pug.x, mapSigil.y - pug.y);
  if (dist > 220) return;       // only visible when close
  const a = Math.max(0.15, 1 - dist / 220);
  ctx.save();
  ctx.strokeStyle = `rgba(180,110,200,${a * 0.6})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // simple triangular sigil with inscribed eye
  const r = 9;
  ctx.moveTo(mapSigil.x, mapSigil.y - r);
  ctx.lineTo(mapSigil.x - r, mapSigil.y + r);
  ctx.lineTo(mapSigil.x + r, mapSigil.y + r);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mapSigil.x, mapSigil.y + 3, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
// PARTYGOER pug — small purple/pink/blue pug with cone party hat.
function renderPartygoers() {
  for (const p of partygoers) {
    ctx.save();
    // Body + drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Body — base pug shape, smaller than the main monster.
    const wob = Math.sin(p.t * 4) * 1.5;
    const bodyCol = partyAlertedT > 0 ? '#6a1a3a' : '#8a5a2c';
    ctx.fillStyle = bodyCol;
    ctx.fillRect(p.x - 14, p.y - 6 + wob, 28, 16);
    // head
    ctx.fillStyle = partyAlertedT > 0 ? '#7a1a3a' : '#a06834';
    ctx.fillRect(p.x - 10, p.y - 16 + wob, 20, 14);
    // eyes
    ctx.fillStyle = partyAlertedT > 0 ? '#ff3a3a' : '#000';
    ctx.shadowColor = partyAlertedT > 0 ? '#ff3a3a' : '';
    ctx.shadowBlur = partyAlertedT > 0 ? 8 : 0;
    ctx.fillRect(p.x - 6, p.y - 12 + wob, 3, 3);
    ctx.fillRect(p.x + 3, p.y - 12 + wob, 3, 3);
    ctx.shadowBlur = 0;
    // Snout (now with nostril detail)
    ctx.fillStyle = '#3a1810';
    ctx.fillRect(p.x - 3, p.y - 6 + wob, 6, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x - 2, p.y - 5 + wob, 1, 1);
    ctx.fillRect(p.x + 1, p.y - 5 + wob, 1, 1);
    // Tongue (party = open mouth)
    if (partyAlertedT <= 0) {
      ctx.fillStyle = '#ff5a82';
      ctx.fillRect(p.x - 2, p.y - 3 + wob, 4, 2);
      ctx.fillStyle = '#ff8aab';
      ctx.fillRect(p.x - 2, p.y - 3 + wob, 4, 1);
    }
    // Party collar — paper ruff under chin
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x - 11, p.y - 2 + wob, 22, 2);
    ctx.fillStyle = '#d8d8e8';
    ctx.fillRect(p.x - 11, p.y - 0 + wob, 22, 1);
    // colorful confetti dots on collar
    ctx.fillStyle = p.hatColor;
    ctx.fillRect(p.x - 8, p.y - 1 + wob, 1, 1);
    ctx.fillRect(p.x + 3, p.y - 1 + wob, 1, 1);
    ctx.fillRect(p.x + 7, p.y - 1 + wob, 1, 1);
    // Party hat — cone with pom-pom
    ctx.fillStyle = p.hatColor;
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 16 + wob);
    ctx.lineTo(p.x + 8, p.y - 16 + wob);
    ctx.lineTo(p.x, p.y - 30 + wob);
    ctx.closePath(); ctx.fill();
    // hat lightening highlight (one side lit)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y - 17 + wob);
    ctx.lineTo(p.x - 1, p.y - 17 + wob);
    ctx.lineTo(p.x - 1, p.y - 28 + wob);
    ctx.closePath(); ctx.fill();
    // hat band base
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(p.x - 8, p.y - 17 + wob, 16, 1);
    // Hat stripe
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y - 22 + wob);
    ctx.lineTo(p.x + 5, p.y - 22 + wob);
    ctx.lineTo(p.x + 3, p.y - 25 + wob);
    ctx.lineTo(p.x - 3, p.y - 25 + wob);
    ctx.closePath(); ctx.fill();
    // tiny polka-dot stripe pattern
    ctx.fillStyle = p.hatColor;
    ctx.fillRect(p.x - 3, p.y - 23 + wob, 1, 1);
    ctx.fillRect(p.x + 0, p.y - 23 + wob, 1, 1);
    ctx.fillRect(p.x + 3, p.y - 23 + wob, 1, 1);
    // Pom-pom (with shine)
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(p.x, p.y - 30 + wob, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff0a8';
    ctx.fillRect(p.x - 1, p.y - 32 + wob, 1, 1);
    ctx.fillRect(p.x + 1, p.y - 31 + wob, 1, 1);
    // Status label when alerted
    if (partyAlertedT > 0) {
      ctx.fillStyle = '#ff8080'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('!!', p.x, p.y - 36 + wob);
    }
    ctx.restore();
  }
}
function renderWaterDrops() {
  for (const d of waterDrops) {
    const a = d.t < 0.15 ? d.t / 0.15 : Math.max(0, 1 - (d.t - 0.15) / (d.life - 0.15));
    // Splash circle expanding
    const r = 4 + (d.t / d.life) * 18;
    ctx.save();
    ctx.strokeStyle = `rgba(170,210,240,${a * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(220,240,250,${a * 0.4})`;
    ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function renderBioFish() {
  const t = performance.now() / 400;
  for (const f of bioFish) {
    const glow = 0.6 + Math.sin(t + f.phase) * 0.4 + (f.scaredT > 0 ? 0.4 : 0);
    ctx.save();
    ctx.shadowColor = f.color; ctx.shadowBlur = 8 * glow;
    ctx.fillStyle = f.color;
    // Body
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, 5, 2.5, Math.atan2(f.vy, f.vx), 0, Math.PI * 2);
    ctx.fill();
    // Tail
    const a = Math.atan2(f.vy, f.vx);
    const tx = f.x - Math.cos(a) * 5, ty = f.y - Math.sin(a) * 5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - Math.cos(a) * 4 + Math.cos(a + 1.4) * 3, ty - Math.sin(a) * 4 + Math.sin(a + 1.4) * 3);
    ctx.lineTo(tx - Math.cos(a) * 4 + Math.cos(a - 1.4) * 3, ty - Math.sin(a) * 4 + Math.sin(a - 1.4) * 3);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
function renderYellowNotepad() {
  if (!yellowNotepad || yellowNotepad.used) return;
  const bob = Math.sin(performance.now() / 320) * 1.5;
  ctx.save();
  ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffec80';
  ctx.fillRect(yellowNotepad.x - 9, yellowNotepad.y - 11 + bob, 18, 20);
  ctx.fillStyle = '#bda848';
  ctx.fillRect(yellowNotepad.x - 9, yellowNotepad.y - 11 + bob, 18, 2);
  // Faux text lines
  ctx.fillStyle = '#5a4a20';
  ctx.fillRect(yellowNotepad.x - 6, yellowNotepad.y - 5 + bob, 12, 1);
  ctx.fillRect(yellowNotepad.x - 6, yellowNotepad.y - 1 + bob, 10, 1);
  ctx.fillRect(yellowNotepad.x - 6, yellowNotepad.y + 3 + bob, 12, 1);
  ctx.shadowBlur = 0;
  ctx.restore();
}
function renderForklift() {
  if (!forklift) return;
  const f = forklift;
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(f.x - f.w / 2 + 4, f.y - f.h / 2 + 6, f.w, f.h);
  // Body
  ctx.fillStyle = '#ffa83a';
  ctx.fillRect(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h);
  // Cab
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(f.x - f.w / 4, f.y - f.h / 2 + 4, f.w / 2, f.h / 2);
  // Forks (sticking out front)
  ctx.fillStyle = '#5a5a5a';
  ctx.fillRect(f.x + f.w / 2, f.y - 8, 14, 3);
  ctx.fillRect(f.x + f.w / 2, f.y + 5, 14, 3);
  // Wheel hubs
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(f.x - f.w / 2 + 8, f.y + f.h / 2 - 4, 10, 6);
  ctx.fillRect(f.x + f.w / 2 - 18, f.y + f.h / 2 - 4, 10, 6);
  // Label
  ctx.fillStyle = '#5a3a08'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('FORKLIFT', f.x, f.y - f.h / 2 - 4);
}
function renderPoolNoodleItem() {
  if (!poolNoodleItem) return;
  const bob = Math.sin(performance.now() / 280) * 1.4;
  ctx.save();
  ctx.shadowColor = '#ff8e3c'; ctx.shadowBlur = 8;
  // Yellow noodle cylinder
  ctx.fillStyle = '#ffec3c';
  ctx.fillRect(poolNoodleItem.x - 14, poolNoodleItem.y - 3 + bob, 28, 6);
  ctx.fillStyle = '#daca20';
  ctx.fillRect(poolNoodleItem.x - 14, poolNoodleItem.y + 1 + bob, 28, 2);
  // Hollow centre on each end
  ctx.fillStyle = '#1a1a08';
  ctx.fillRect(poolNoodleItem.x - 14, poolNoodleItem.y - 1 + bob, 2, 2);
  ctx.fillRect(poolNoodleItem.x + 12, poolNoodleItem.y - 1 + bob, 2, 2);
  ctx.shadowBlur = 0;
  ctx.restore();
}
function renderCarAlarm() {
  if (!activeCarAlarm) return;
  const c = activeCarAlarm.car;
  const t = activeCarAlarm.t;
  // Flashing red/white pulse at ~6Hz
  const phase = Math.floor(t * 6) % 2;
  ctx.save();
  ctx.fillStyle = phase ? 'rgba(255,40,40,0.55)' : 'rgba(255,255,255,0.45)';
  ctx.shadowColor = phase ? '#ff3a3a' : '#fff';
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, c.w * 0.6, c.h * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Tag
  ctx.fillStyle = '#ff8080'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('ALARM', c.x, c.y - c.h / 2 - 8);
  ctx.restore();
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
  } else if (h.kind === 'locker') {
    // Metal school-style locker, two vertical doors with handles.
    ctx.fillStyle = '#5a6068'; ctx.fillRect(h.x - 16, h.y - 24, 32, 42);
    // top + bottom edge bands
    ctx.fillStyle = '#3a4048'; ctx.fillRect(h.x - 16, h.y - 24, 32, 3);
    ctx.fillStyle = '#2a3038'; ctx.fillRect(h.x - 16, h.y + 14, 32, 4);
    // door divider seam
    ctx.fillStyle = '#1a1e22';
    ctx.fillRect(h.x - 1, h.y - 24, 2, 42);
    ctx.fillRect(h.x - 16, h.y + 16, 32, 2);
    // metallic side-frame highlights (3D edge)
    ctx.fillStyle = '#8a9098';
    ctx.fillRect(h.x - 16, h.y - 24, 1, 42);
    ctx.fillStyle = '#3a4048';
    ctx.fillRect(h.x + 15, h.y - 24, 1, 42);
    // BIG HANDLES — chrome levers with bolt-head
    ctx.fillStyle = '#8a8c94';
    ctx.fillRect(h.x - 9, h.y - 2, 5, 7);
    ctx.fillRect(h.x + 4, h.y - 2, 5, 7);
    ctx.fillStyle = '#c8cad0';
    ctx.fillRect(h.x - 9, h.y - 2, 5, 1);  // shine
    ctx.fillRect(h.x + 4, h.y - 2, 5, 1);
    ctx.fillStyle = '#1a1e22';  // bolt centers
    ctx.fillRect(h.x - 7, h.y, 1, 1);
    ctx.fillRect(h.x + 6, h.y, 1, 1);
    // top number-plate (locker number) — small white tag
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(h.x - 13, h.y - 22, 8, 4);
    ctx.fillStyle = '#1a0d05'; ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('07', h.x - 9, h.y - 18);
    // Vent slits (more rows + darker depth)
    ctx.fillStyle = '#1a1e22';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(h.x - 9, h.y - 18 + i * 3, 5, 1);
      ctx.fillRect(h.x + 4, h.y - 18 + i * 3, 5, 1);
    }
    // vent grille shadow band underneath
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(h.x - 9, h.y - 7, 5, 1);
    ctx.fillRect(h.x + 4, h.y - 7, 5, 1);
    // small rust streaks
    ctx.fillStyle = 'rgba(120,40,10,0.4)';
    ctx.fillRect(h.x - 13, h.y + 4, 1, 5);
    ctx.fillRect(h.x + 13, h.y + 8, 1, 4);
  } else if (h.kind === 'cabinet') {
    // Wood filing cabinet with knobs — now with visible drawer shelves + label tags.
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(h.x - 16, h.y - 20, 32, 36);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(h.x - 16, h.y - 20, 32, 3);
    // wood grain stripes
    ctx.fillStyle = 'rgba(40,24,8,0.35)';
    ctx.fillRect(h.x - 14, h.y - 18, 28, 1);
    ctx.fillRect(h.x - 14, h.y + 4, 28, 1);
    // drawer separators
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(h.x - 16, h.y - 6, 32, 1);
    ctx.fillRect(h.x - 16, h.y + 7, 32, 1);
    // drawer-front inset shadow (gives depth)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(h.x - 14, h.y - 18, 28, 1);
    ctx.fillRect(h.x - 14, h.y - 4, 28, 1);
    ctx.fillRect(h.x - 14, h.y + 9, 28, 1);
    // brass handle pulls (longer, tear-drop style)
    ctx.fillStyle = '#d2a878';
    ctx.fillRect(h.x - 4, h.y - 14, 8, 2);
    ctx.fillRect(h.x - 4, h.y - 1, 8, 2);
    ctx.fillRect(h.x - 4, h.y + 11, 8, 2);
    // handle highlights
    ctx.fillStyle = '#fff0a8';
    ctx.fillRect(h.x - 4, h.y - 14, 8, 1);
    ctx.fillRect(h.x - 4, h.y - 1, 8, 1);
    ctx.fillRect(h.x - 4, h.y + 11, 8, 1);
    // file-label tags (white slips)
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(h.x - 13, h.y - 13, 6, 2);
    ctx.fillRect(h.x + 7, h.y - 0, 6, 2);
    ctx.fillRect(h.x - 13, h.y + 12, 6, 2);
    // small key-lock hole on the top drawer
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(h.x + 12, h.y - 16, 2, 2);
  } else if (h.kind === 'closet') {
    // Tall wardrobe closet with doors slightly ajar — visible interior darkness.
    ctx.fillStyle = '#3a2410'; ctx.fillRect(h.x - 18, h.y - 26, 36, 46);
    // top trim
    ctx.fillStyle = '#5a3818';
    ctx.fillRect(h.x - 18, h.y - 26, 18, 4);
    ctx.fillRect(h.x + 0, h.y - 26, 18, 4);
    // base trim
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(h.x - 18, h.y + 18, 36, 2);
    // door seam (door slightly ajar — small interior gap visible)
    ctx.fillStyle = '#1a0e08'; ctx.fillRect(h.x - 1, h.y - 26, 2, 46);
    // PEEKING INTERIOR — dark slit at the seam top hinting at darkness inside
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(h.x - 2, h.y - 18, 4, 12);
    // wood grain panels on doors
    ctx.fillStyle = 'rgba(80,40,16,0.4)';
    ctx.fillRect(h.x - 14, h.y - 22, 12, 1);
    ctx.fillRect(h.x + 2, h.y - 22, 12, 1);
    ctx.fillRect(h.x - 14, h.y + 8, 12, 1);
    ctx.fillRect(h.x + 2, h.y + 8, 12, 1);
    // door inset panels (carved rectangles)
    ctx.strokeStyle = 'rgba(20,10,4,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(h.x - 14, h.y - 18, 12, 14);
    ctx.strokeRect(h.x + 2, h.y - 18, 12, 14);
    ctx.strokeRect(h.x - 14, h.y - 0, 12, 14);
    ctx.strokeRect(h.x + 2, h.y - 0, 12, 14);
    // BRASS KNOBS (round + highlight)
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(h.x - 6, h.y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x + 6, h.y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff0a8';
    ctx.fillRect(h.x - 7, h.y - 1, 1, 1);
    ctx.fillRect(h.x + 5, h.y - 1, 1, 1);
    // keyhole below each knob
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(h.x - 6, h.y + 4, 1, 2);
    ctx.fillRect(h.x + 6, h.y + 4, 1, 2);
  } else if (h.kind === 'crate') {
    // Wooden crate with x-brace.
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(h.x - 18, h.y - 14, 36, 28);
    ctx.fillStyle = '#5a3e18';
    ctx.fillRect(h.x - 18, h.y - 14, 36, 2);
    ctx.fillRect(h.x - 18, h.y + 12, 36, 2);
    ctx.strokeStyle = '#5a3e18'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(h.x - 16, h.y - 12); ctx.lineTo(h.x + 16, h.y + 10);
    ctx.moveTo(h.x + 16, h.y - 12); ctx.lineTo(h.x - 16, h.y + 10);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#6b3a1c'; ctx.fillRect(h.x - 18, h.y - 12, 36, 18);
    ctx.fillStyle = '#8a5a2c'; ctx.fillRect(h.x - 18, h.y - 12, 36, 3);
    ctx.fillStyle = '#3a2a0c'; ctx.fillRect(h.x - 18, h.y + 4, 36, 2);
    ctx.fillStyle = '#5a2a0c'; ctx.fillRect(h.x - 16, h.y - 22, 4, 12); ctx.fillRect(h.x + 12, h.y - 22, 4, 12);
  }
  ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
  ctx.fillText('HIDE', h.x, h.y - 28);
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
  // Agent D: hide sprite when monster is outside player's view radius so the
  // player can never SEE the monster from far away — they only hear it. The
  // monster.visible flag is set each tick from the AI step.
  if (monster && monster.visible === false) return;
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
  // a four-legged dark shape with glowing eyes — now with hackles, ribs, and ear shapes
  const chasing = e.state === 'chase';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 14, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
  const bodyCol = chasing ? '#3a0a0a' : '#1a0a08';
  const accentCol = chasing ? '#5a1a1a' : '#2a1a14';
  ctx.fillStyle = bodyCol;
  // body
  ctx.fillRect(e.x - 14, e.y - 4, 28, 12);
  // body top-highlight (less flat)
  ctx.fillStyle = accentCol;
  ctx.fillRect(e.x - 14, e.y - 4, 28, 2);
  // head (front-right)
  ctx.fillStyle = bodyCol;
  ctx.fillRect(e.x + 10, e.y - 6, 10, 10);
  // forward snout/jaw
  ctx.fillRect(e.x + 18, e.y - 2, 4, 5);
  // bare teeth (small white slits) — only when chasing
  if (chasing) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x + 19, e.y + 1, 1, 2);
    ctx.fillRect(e.x + 21, e.y + 1, 1, 2);
  }
  // pointed ears (2 triangular ear nubs on top of head)
  ctx.fillStyle = bodyCol;
  ctx.beginPath();
  ctx.moveTo(e.x + 11, e.y - 6); ctx.lineTo(e.x + 13, e.y - 11); ctx.lineTo(e.x + 14, e.y - 6); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(e.x + 16, e.y - 6); ctx.lineTo(e.x + 18, e.y - 11); ctx.lineTo(e.x + 19, e.y - 6); ctx.closePath(); ctx.fill();
  // raised hackles (back spikes when chasing)
  if (chasing) {
    ctx.fillStyle = '#5a1a1a';
    ctx.fillRect(e.x - 8, e.y - 6, 1, 2);
    ctx.fillRect(e.x - 5, e.y - 7, 1, 3);
    ctx.fillRect(e.x - 2, e.y - 7, 1, 3);
    ctx.fillRect(e.x + 1, e.y - 6, 1, 2);
    ctx.fillRect(e.x + 4, e.y - 6, 1, 2);
  }
  // exposed rib hint (vertical dark line stripes on body)
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(e.x - 8, e.y + 2, 1, 4);
  ctx.fillRect(e.x - 4, e.y + 2, 1, 4);
  ctx.fillRect(e.x + 0, e.y + 2, 1, 4);
  ctx.fillRect(e.x + 4, e.y + 2, 1, 4);
  // legs — slightly wider, with paw-tip detail
  ctx.fillStyle = bodyCol;
  ctx.fillRect(e.x - 12, e.y + 8, 3, 6);
  ctx.fillRect(e.x - 4, e.y + 8, 3, 6);
  ctx.fillRect(e.x + 4, e.y + 8, 3, 6);
  ctx.fillRect(e.x + 12, e.y + 8, 3, 6);
  // paw pads (white claw tips when chasing)
  if (chasing) {
    ctx.fillStyle = '#dde0c8';
    ctx.fillRect(e.x - 12, e.y + 13, 1, 1);
    ctx.fillRect(e.x - 4, e.y + 13, 1, 1);
    ctx.fillRect(e.x + 4, e.y + 13, 1, 1);
    ctx.fillRect(e.x + 12, e.y + 13, 1, 1);
  }
  // tail (curved drooping, with darker tip)
  ctx.fillStyle = bodyCol;
  ctx.fillRect(e.x - 18, e.y - 2, 5, 2);
  ctx.fillRect(e.x - 21, e.y + 0, 3, 2);
  ctx.fillStyle = accentCol;
  ctx.fillRect(e.x - 21, e.y + 2, 2, 1);
  // glowing eyes (now BOTH eyes properly placed)
  ctx.fillStyle = chasing ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowColor = chasing ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowBlur = chasing ? 10 : 4;
  ctx.fillRect(e.x + 13, e.y - 4, 2, 2);
  ctx.fillRect(e.x + 17, e.y - 2, 2, 2);
  // bright pupil dot
  ctx.fillStyle = '#fff';
  ctx.fillRect(e.x + 14, e.y - 3, 1, 1);
  ctx.fillRect(e.x + 18, e.y - 1, 1, 1);
  ctx.shadowBlur = 0;
  // little label
  if (chasing) {
    ctx.fillStyle = '#ff8080'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('HOUND', e.x, e.y - 16);
  }
}

function drawSmiler(e) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, e.opacity);
  // outer halo so the smile glows in the dark
  const halo = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, 36);
  halo.addColorStop(0, 'rgba(255,210,63,0.18)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(e.x, e.y, 36, 0, Math.PI * 2); ctx.fill();
  // dark body smudge (now layered for depth)
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath(); ctx.arc(e.x, e.y, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(8,2,8,0.95)';
  ctx.beginPath(); ctx.arc(e.x, e.y, 17, 0, Math.PI * 2); ctx.fill();
  // glowing eyes (now with red iris core)
  ctx.fillStyle = '#ffd23f';
  ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
  ctx.fillRect(e.x - 8, e.y - 4, 4, 4);
  ctx.fillRect(e.x + 4, e.y - 4, 4, 4);
  // iris/pupil
  ctx.fillStyle = '#aa0000';
  ctx.fillRect(e.x - 7, e.y - 3, 2, 2);
  ctx.fillRect(e.x + 5, e.y - 3, 2, 2);
  // bright catchlight
  ctx.fillStyle = '#fff';
  ctx.fillRect(e.x - 7, e.y - 4, 1, 1);
  ctx.fillRect(e.x + 5, e.y - 4, 1, 1);
  // grin (curve of teeth) — now with gaps + canine tips
  ctx.fillStyle = '#fffae0';
  for (let i = -6; i <= 6; i += 2) {
    const yy = e.y + 6 + Math.abs(i) * 0.4;
    ctx.fillRect(e.x + i, yy, 2, 3);
  }
  // jagged tooth shadows (gives crooked grin feel)
  ctx.fillStyle = 'rgba(40,0,0,0.5)';
  for (let i = -5; i <= 5; i += 4) {
    const yy = e.y + 6 + Math.abs(i) * 0.4;
    ctx.fillRect(e.x + i, yy + 2, 1, 1);
  }
  // upper lip (red gum line above teeth)
  ctx.fillStyle = 'rgba(160,20,20,0.85)';
  ctx.fillRect(e.x - 7, e.y + 5, 14, 1);
  // two canine teeth (longer tips at corners)
  ctx.fillStyle = '#fffae0';
  ctx.fillRect(e.x - 7, e.y + 6, 1, 4);
  ctx.fillRect(e.x + 6, e.y + 6, 1, 4);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// CRAWLER — spider-pug, low to the floor. 8 legs splayed out, small body.
function drawCrawler(e) {
  const lunging = e.lungeT > 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 8, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
  // legs (8 spindly, now with KNEE joint mid-segment for a more arachnid feel)
  const legCol = lunging ? '#3a0a0a' : '#1a0a08';
  const kneeCol = lunging ? '#5a1a1a' : '#2a1a14';
  ctx.strokeStyle = legCol; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.sin(e.t * 4 + i) * 0.15;
    const knx = e.x + Math.cos(a) * 9;
    const kny = e.y + Math.sin(a) * 4 - 2;
    const lx = e.x + Math.cos(a) * 16;
    const ly = e.y + Math.sin(a) * 8;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(knx, kny);  // segment 1 (femur)
    ctx.lineTo(lx, ly);    // segment 2 (tibia)
    ctx.stroke();
    // knee joint dot
    ctx.fillStyle = kneeCol;
    ctx.fillRect(knx - 1, kny - 1, 2, 2);
    // tiny claw tip
    ctx.fillStyle = lunging ? '#ff9090' : '#5a3a3a';
    ctx.fillRect(lx - 0.5, ly - 0.5, 1, 1);
  }
  // body (with darker spine line + bristles)
  ctx.fillStyle = lunging ? '#5a1a1a' : '#1a0a08';
  ctx.beginPath(); ctx.ellipse(e.x, e.y, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  // dorsal spine ridge
  ctx.fillStyle = lunging ? '#7a2a2a' : '#2a1a14';
  ctx.fillRect(e.x - 6, e.y - 1, 12, 1);
  // bristly back hairs (3 spikes)
  ctx.fillStyle = legCol;
  ctx.fillRect(e.x - 3, e.y - 5, 1, 2);
  ctx.fillRect(e.x, e.y - 6, 1, 2);
  ctx.fillRect(e.x + 3, e.y - 5, 1, 2);
  // head — small with red eyes + mandibles
  ctx.fillStyle = '#0a0606';
  ctx.beginPath(); ctx.arc(e.x + 6, e.y - 2, 5, 0, Math.PI * 2); ctx.fill();
  // chelicerae mandibles (2 small fangs jutting forward)
  ctx.fillStyle = lunging ? '#aa3030' : '#3a2018';
  ctx.fillRect(e.x + 9, e.y - 1, 2, 1);
  ctx.fillRect(e.x + 9, e.y + 1, 2, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(e.x + 11, e.y - 1, 1, 1);
  ctx.fillRect(e.x + 11, e.y + 1, 1, 1);
  // eyes — now 4 small clustered like a spider's
  ctx.fillStyle = lunging ? '#ff3a3a' : '#ffaa3a';
  ctx.shadowColor = lunging ? '#ff3a3a' : '#aa6630';
  ctx.shadowBlur = lunging ? 10 : 4;
  ctx.fillRect(e.x + 8, e.y - 3, 2, 2);
  ctx.fillRect(e.x + 8, e.y, 2, 2);
  ctx.fillRect(e.x + 5, e.y - 4, 1, 1);
  ctx.fillRect(e.x + 5, e.y + 2, 1, 1);
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
  // tall silhouette — now with subtle gradient and shoulder definition
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - 9, e.y - 36, 18, 50);
  // narrow waist
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(e.x - 7, e.y - 14, 14, 14);
  // shoulders — broader top
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - 12, e.y - 34, 24, 6);
  // neck
  ctx.fillRect(e.x - 3, e.y - 36, 6, 4);
  // head
  ctx.beginPath(); ctx.arc(e.x, e.y - 40, 8, 0, Math.PI * 2); ctx.fill();
  // arms hanging (longer than humanoid — adds creepy proportion)
  ctx.fillRect(e.x - 14, e.y - 28, 4, 30);
  ctx.fillRect(e.x + 10, e.y - 28, 4, 30);
  // long fingers/claws at end of each arm (3 prongs each side)
  ctx.fillRect(e.x - 14, e.y + 2, 1, 4);
  ctx.fillRect(e.x - 12, e.y + 2, 1, 5);
  ctx.fillRect(e.x - 10, e.y + 2, 1, 4);
  ctx.fillRect(e.x + 10, e.y + 2, 1, 4);
  ctx.fillRect(e.x + 12, e.y + 2, 1, 5);
  ctx.fillRect(e.x + 14, e.y + 2, 1, 4);
  // hint of eyes — only when gazed enough
  if ((e.gazeT || 0) > 0.8) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x - 4, e.y - 42, 2, 2);
    ctx.fillRect(e.x + 2, e.y - 42, 2, 2);
    // mouth — long jagged smile (creepy)
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.x - 4, e.y - 37, 1, 1);
    ctx.fillRect(e.x - 2, e.y - 37, 1, 1);
    ctx.fillRect(e.x, e.y - 37, 1, 1);
    ctx.fillRect(e.x + 2, e.y - 37, 1, 1);
    ctx.fillRect(e.x + 4, e.y - 37, 1, 1);
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
// occasional dark "off" pulses (~0.3s) to break ambiance. Supports:
//   - blackout (all forced off)
//   - dying bulb (erratic stochastic flicker for 30s then permanent off)
//   - .dead flag (permanent off after dying-bulb expires)
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
    let a = isOff ? 0.05 : 0.55;
    // Permanently dead
    if (L.dead) a = 0.02;
    // Blackout overrides everything
    if (blackoutT > 0) a = 0.02;
    // Currently-dying bulb: rapid stochastic flicker that gradually goes darker
    if (L === dyingBulb) {
      const dyingProgress = dyingBulbT / dyingBulbLife;          // 0..1
      const baseDim = (1 - dyingProgress) * 0.5;                  // bright→dim
      const erratic = Math.random() < (0.25 + dyingProgress * 0.45) ? 0 : 1;
      a = baseDim * erratic + (1 - erratic) * 0.04;
    }
    ctx.fillStyle = `rgba(255,250,220,${a})`;
    ctx.fillRect(L.x - 26, L.y - 6, 52, 12);
    ctx.fillStyle = `rgba(255,250,220,${a * 1.6})`;
    ctx.fillRect(L.x - 22, L.y - 3, 44, 6);
  }
}

// Veins/cracks overlay drawn ON TOP of a jumpscare face for additional horror
// detail. Stochastic branching tendrils radiating from center. Deterministic
// per frame via Math.random — looks like blood vessels / hairline cracks.
function drawVeinsOverlay(cx, cy, radius, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  // 14 main veins, each branching once
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
    let x = cx + Math.cos(a) * radius * 0.2;
    let y = cy + Math.sin(a) * radius * 0.2;
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let curA = a;
    for (let s = 0; s < 6; s++) {
      curA += (Math.random() - 0.5) * 0.6;
      x += Math.cos(curA) * radius * 0.12;
      y += Math.sin(curA) * radius * 0.12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // branch
    if (Math.random() < 0.7) {
      ctx.lineWidth = 1;
      const bA = curA + (Math.random() - 0.5) * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(bA) * radius * 0.18, y + Math.sin(bA) * radius * 0.18);
      ctx.stroke();
    }
  }
  // Thin cracks at the edges
  ctx.strokeStyle = '#000';
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const x0 = cx + Math.cos(a) * radius * 0.7;
    const y0 = cy + Math.sin(a) * radius * 0.7;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (Math.random() - 0.5) * 60, y0 + (Math.random() - 0.5) * 60);
    ctx.stroke();
  }
  ctx.restore();
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

// Agent C: rebuilt HUD — three zones (vital / objective / resources),
// 28px-tall bars, plain-language readouts, critical-pulse border on the
// whole HUD when sanity < 30. Compass arrow appears once all cans are picked.
// Agent #5: heart icon now SANITY-driven (beat rate scales with low sanity);
// 5 can-pip icons fill in as cans are collected; battery shows %.
const _brHud = {
  root:    document.getElementById('hud'),
  cans:    document.getElementById('hud-cans'),
  canPips: document.getElementById('hud-can-pips'),
  state:   document.getElementById('hud-state'),
  sanBar:  document.getElementById('hud-sanity-bar'),
  sanPct:  document.getElementById('hud-sanity-pct'),
  batBar:  document.getElementById('hud-battery-bar'),
  batWrap: document.getElementById('hud-battery-bar-wrap'),
  batPct:  document.getElementById('hud-battery-pct'),
  heart:   document.getElementById('hud-heart'),
  smk:     document.getElementById('hud-smoke'),
  depth:   document.getElementById('hud-depth'),
  notes:   document.getElementById('hud-notes'),
  arch:    document.getElementById('hud-arch'),
  exitHint:document.getElementById('hud-exit-hint'),
  exitDir: document.getElementById('hud-exit-dir'),
};
// Cache the 5 can-pip <i> nodes declared in index.html.
const _brHudCanPipNodes = _brHud.canPips ? Array.from(_brHud.canPips.querySelectorAll('i')) : [];
let _brHudPrev = {
  cans: -1, cansDone: null, state: '', stateClass: '',
  san: -1, sanColor: '',
  bat: -1, batColor: '', batShadow: null,
  critical: null,
  smk: -1, depth: '', notes: '',
  exitShown: null, exitDir: '',
  gotCans: 0, heartRate: '', heartCrit: null,
};
function _exitArrow(dx, dy) {
  const a = Math.atan2(dy, dx);
  const deg = (a * 180 / Math.PI + 360) % 360;
  // 8-direction arrow (E=0, S=90, W=180, N=270)
  if (deg >= 337.5 || deg < 22.5) return '→';
  if (deg < 67.5)  return '↘';
  if (deg < 112.5) return '↓';
  if (deg < 157.5) return '↙';
  if (deg < 202.5) return '←';
  if (deg < 247.5) return '↖';
  if (deg < 292.5) return '↑';
  return '↗';
}
function updateHud() {
  if (!_brHud.root) return;
  // OBJECTIVE — big can count + EXIT arrow
  const cansLeft = cans ? cans.length : 0;
  const got = 5 - cansLeft;
  if (cansLeft !== _brHudPrev.cans) {
    if (_brHud.cans) _brHud.cans.textContent = `${got} / 5`;
    _brHudPrev.cans = cansLeft;
  }
  const done = cansLeft === 0;
  if (done !== _brHudPrev.cansDone) {
    if (_brHud.cans) _brHud.cans.classList.toggle('is-done', done);
    _brHudPrev.cansDone = done;
  }
  // Update 5 can-pip icons: fill in those collected, briefly pop the new one.
  if (got !== _brHudPrev.gotCans && _brHudCanPipNodes.length) {
    const justGot = got > _brHudPrev.gotCans;
    for (let k = 0; k < _brHudCanPipNodes.length; k++) {
      const pip = _brHudCanPipNodes[k];
      const filled = k < got;
      pip.classList.toggle('is-got', filled);
      // pop only the freshly-collected pip
      if (justGot && k === got - 1) {
        pip.classList.remove('is-just-got');
        // force reflow so the animation restarts
        void pip.offsetWidth;
        pip.classList.add('is-just-got');
      } else {
        pip.classList.remove('is-just-got');
      }
    }
    _brHudPrev.gotCans = got;
  }
  if (_brHud.exitHint) {
    if (done && exitTile && pug) {
      const dx = exitTile.x - pug.x, dy = exitTile.y - pug.y;
      const arr = _exitArrow(dx, dy);
      if (_brHudPrev.exitShown !== true) {
        _brHud.exitHint.hidden = false;
        _brHudPrev.exitShown = true;
      }
      if (arr !== _brHudPrev.exitDir) {
        if (_brHud.exitDir) _brHud.exitDir.textContent = arr;
        _brHudPrev.exitDir = arr;
      }
    } else if (_brHudPrev.exitShown !== false) {
      _brHud.exitHint.hidden = true;
      _brHudPrev.exitShown = false;
    }
  }
  // STATE — plain-language readout (SAFE / LOUD / HUNTED / SMOKED)
  let state = 'SAFE', stateClass = '';
  if (monster && monster.chase) { state = 'HUNTED'; stateClass = 'is-hunted'; }
  else if (monsterDazedT > 0) { state = 'SMOKED'; stateClass = ''; }
  else if (soundLevel > 0.5) { state = 'LOUD'; stateClass = 'is-loud'; }
  if (state !== _brHudPrev.state) { if (_brHud.state) _brHud.state.textContent = state; _brHudPrev.state = state; }
  if (stateClass !== _brHudPrev.stateClass) {
    if (_brHud.state) _brHud.state.className = 'hud-state ' + stateClass;
    _brHudPrev.stateClass = stateClass;
  }
  // VITAL — sanity bar
  if (_brHud.sanBar) {
    const s = Math.max(0, Math.round(sanity));
    if (s !== _brHudPrev.san) {
      _brHud.sanBar.style.width = s + '%';
      if (_brHud.sanPct) _brHud.sanPct.textContent = s;
      _brHudPrev.san = s;
    }
    const c = sanity > 60 ? '#5ef38c' : (sanity > 25 ? '#ffd23f' : '#ff3a3a');
    if (c !== _brHudPrev.sanColor) { _brHud.sanBar.style.background = c; _brHudPrev.sanColor = c; }
  }
  // VITAL — battery bar
  if (_brHud.batBar) {
    const b = Math.max(0, Math.round(battery));
    if (b !== _brHudPrev.bat) {
      _brHud.batBar.style.width = b + '%';
      if (_brHud.batPct) _brHud.batPct.textContent = b;
      _brHudPrev.bat = b;
    }
    const c = battery > 50 ? '#ffd23f' : (battery > 15 ? '#ffa83a' : '#ff3a3a');
    if (c !== _brHudPrev.batColor) { _brHud.batBar.style.background = c; _brHudPrev.batColor = c; }
    // Glow effect when flashlight is on
    const glow = !!flashlightOn;
    if (glow !== _brHudPrev.batShadow) {
      if (_brHud.batWrap) _brHud.batWrap.classList.toggle('is-glow', glow);
      _brHudPrev.batShadow = glow;
    }
  }
  // VITAL — sanity heart. Beat rate scales with low sanity:
  //   sanity 100 → 1.20s/beat (calm), 50 → 0.75s, 25 → 0.45s, 0 → 0.30s.
  // Critical class kicks in below 30 (deeper red, larger glow).
  if (_brHud.heart) {
    const s = Math.max(0, Math.min(100, sanity));
    // Quantise to 50ms steps so we don't churn the style attribute every frame.
    const rateMs = Math.round((0.30 + (s / 100) * 0.90) * 1000 / 50) * 50;
    const rateStr = rateMs + 'ms';
    if (rateStr !== _brHudPrev.heartRate) {
      _brHud.heart.style.setProperty('--hb', rateStr);
      _brHudPrev.heartRate = rateStr;
    }
    const heartCrit = s < 30;
    if (heartCrit !== _brHudPrev.heartCrit) {
      _brHud.heart.classList.toggle('is-critical', heartCrit);
      _brHudPrev.heartCrit = heartCrit;
    }
  }
  // CRITICAL — pulsing red border around entire HUD when sanity < 30
  const crit = sanity < 30;
  if (crit !== _brHudPrev.critical) {
    _brHud.root.classList.toggle('is-critical', crit);
    _brHudPrev.critical = crit;
  }
  // RESOURCES — smoke / depth / notes / archetype tag
  if (_brHud.smk && smokeCount !== _brHudPrev.smk) {
    _brHud.smk.textContent = smokeCount;
    _brHudPrev.smk = smokeCount;
  }
  const depthTxt = `${level}/${MAX_LEVEL}`;
  if (depthTxt !== _brHudPrev.depth) {
    if (_brHud.depth) _brHud.depth.textContent = depthTxt;
    _brHudPrev.depth = depthTxt;
  }
  if (_brHud.notes) {
    const n = `${notesFoundCount()}/${NOTE_TOTAL}`;
    if (n !== _brHudPrev.notes) { _brHud.notes.textContent = n; _brHudPrev.notes = n; }
  }
}

function die(cause) {
  running = false;
  sfx.sweep(110, 40, 'sawtooth', 1.0, 0.3);
  silenceHum(0.6);
  const SUBS = {
    monster: 'The giant pug found you.',
    hound: 'A hound caught your scent.',
    smiler: 'The grinning thing got you.',
    sanity: 'The hum took everything.',
    crawler: 'A crawler lunged from the dark.',
    whisperer: 'The whispers consumed you.',
    lurker: 'A lurker dragged you under.',
  };
  // Hide HUD + pause button immediately so death card has the screen.
  document.getElementById('hud').hidden = true;
  const pauseBtn = document.getElementById('pause-btn'); if (pauseBtn) pauseBtn.hidden = true;
  const { isNewBest, current } = submitRun('backrooms-pug', { score: level, level }, (a, b) => b.level - a.level);
  // Agent #5: replay buffer is offered only if we recorded enough frames.
  const canReplay = replayBuffer.length >= 30;
  // Agent C: dramatic 2s hold to let camera zoom + jumpscare resolve before
  // popping the death card. catchSlowmoT (set by caller) is ~0.4s.
  const holdMs = 1900;
  setTimeout(() => {
    try {
      _cutDeath({
        cause: SUBS[cause] || 'The Backrooms claimed you.',
        level,
        cans: (level - 1) * 5 + (5 - cans.length),
        time: Math.max(0, gameTime - runStartT),
        notesFound: notesFoundCount(),
        notesTotal: NOTE_TOTAL,
        best: (current && current.level) || level,
        isNewBest,
        canReplay,
      }, (action, restoreCb) => {
        if (action === 'restart') startRun();
        else if (action === 'select') openLevelSelect();
        else if (action === 'replay') {
          // Show overlay HUD then replay; on done, restore the death panel.
          showReplayOverlayHud();
          startReplay(() => {
            hideReplayOverlayHud();
            try { restoreCb && restoreCb(); } catch {}
          });
        }
      });
    } catch {}
  }, holdMs);
}

// Paint the start-screen notes-found counter (persisted across runs).
function paintStartNotesCounter() {
  const el = document.getElementById('start-notes');
  if (el) el.innerHTML = `Notes recovered: <b>${notesFoundCount()}/${NOTE_TOTAL}</b>`;
}
function paintLevelSelectButtonVisibility() {
  const btn = document.getElementById('level-select-btn');
  if (!btn) return;
  const u = _cutLoadUnlocks();
  // Show after the player has beaten at least 1 level (maxReached >= 2 means
  // they got TO level 2, i.e. cleared 1).
  btn.hidden = !((u && (u.maxReached | 0)) >= 2);
}
paintStartNotesCounter();
paintLevelSelectButtonVisibility();
// Public entry from start button — plays intro (skipped if seen) then begins run.
function start() {
  // Hide start overlay first so the intro takes the whole screen.
  document.getElementById('overlay').hidden = true;
  document.getElementById('overlay').classList.add('is-hidden');
  _cutIntro(() => startRun({ level: 1 }));
}
document.getElementById('start-btn').addEventListener('click', start);
const _endRestartBtn = document.getElementById('end-restart');
if (_endRestartBtn) _endRestartBtn.addEventListener('click', () => { paintStartNotesCounter(); start(); });
// Agent C: full reset + genLevel + show first level card.
function startRun(opts) {
  const startLevel = Math.max(1, Math.min(MAX_LEVEL, (opts && opts.level) || 1));
  level = startLevel; running = true;
  sanity = 100; battery = 50; flashlightOn = false; smokeCount = 0;
  // Reset jump-scare / ambient state
  gameTime = 0; runStartT = 0; levelStartT = 0;
  // Agent #5: clear replay buffer + stop any in-progress playback.
  replayBuffer.length = 0; replayAcc = 0;
  if (replayActive) { hideReplayOverlayHud(); stopReplay(); }
  jumpScareT = 0; jumpScareLife = 0; jumpScareKind = null;
  jumpScareCooldown = 0; redFlashT = 0;
  firstHoundJump = false; lastSmilerJumpAt = -999;
  ambientEvent = null;
  activeTriggerScare = null; lastTriggerScareAt = -999;
  // Clear any in-flight PSYCHIC FLASH from a prior run and re-arm the
  // schedule so the next reveal is timed from the new run's gameTime.
  psychicFlashT = 0; nextPsychicFlashAt = 0;
  // Reset noclip-chain + lore-note transient state for this run.
  noclipTransitionT = 0; noclipSwapped = false;
  noclipFromLabel = ''; noclipToLabel = '';
  noclipsChained = 0;
  activeNoteText = null;
  paused = false; levelCardShowing = false;
  // Reset accumulators/Sets so a fresh run isn't tainted by the previous one
  // (held keys carrying over auto-walked the pug into a wall).
  keys.clear(); touchSneak = false;
  monsterWiggle = 0; lightFlicker = 0; heartBeatT = 0; breathT = 0;
  firstSeenScreamed = false; lastSanityTick = 0;
  // Agent D — monster AI accumulators
  monsterFootstepT = 0; monsterGrowlT = 5; monsterSniffT = 0; monsterBreathT = 0;
  monsterHuntingT = 0; monsterLostContactT = 99; monsterWanderRefreshAt = 0;
  lurkerVisibleT = 0;
  popups = []; chaseVignetteT = 0; hitFlashT = 0; shakeT = 0; shakeMag = 0;
  noteUnfoldT = 0; catchSlowmoT = 0; sanityPulseT = 0; smokeDarkenT = 0; lastSanity = 100;
  scheduleAmbient(); scheduleDoorSlam(); scheduleWhisper();
  if (typeof schedulePhantom === 'function') schedulePhantom();
  if (typeof schedulePeripheral === 'function') schedulePeripheral();
  if (typeof scheduleEyes === 'function') scheduleEyes();
  if (typeof scheduleBlackout === 'function') scheduleBlackout();
  if (typeof scheduleDyingBulb === 'function') scheduleDyingBulb();
  if (typeof scheduleStrobo === 'function') scheduleStrobo();
  // Reset new horror-system runtime state
  phantomT = 0; phantomKind = null; phantomCooldown = 0;
  peripheralT = 0; peripheralSide = 0;
  eyesT = 0; eyesX = 0; eyesY = 0; eyesDriftX = 0;
  blackoutT = 0; blackoutLife = 0;
  dyingBulb = null; dyingBulbT = 0; dyingBulbLife = 30;
  stroboT = 0;
  jumpScareFlickerT = 0; jumpScareMaxAudioT = 0;
  stillT = 0;
  // Agent B map-overhaul state reset
  talismanCharges = 0;
  mapFragmentRevealT = 0;
  safeRoomT = 0;
  currentRoomId = -1;
  secretRoomRevealedT = 0;
  secretPromptText = null; secretPromptT = 0;
  closedDoors = []; secretWalls = []; waterTiles = []; fungi = [];
  garageCars = []; garageRamps = []; envProps = []; waterCoolers = [];
  talismanItems = []; mapFragments = []; cigaretteItems = [];
  rooms = []; roomTileMap = []; roomWallpaperIdx = [];
  deadEndRoomIds = new Set();
  // Round-2 expansion reset
  almondWaters = []; almondWaterCollected = 0;
  activeMutator = null; mutatorBannerT = 0;
  mapSigil = null;
  partygoers = []; partyAlertedT = 0;
  yellowNotepad = null; yellowNoteFlashT = 0; yellowNoteText = '';
  forklift = null; waterDrops = []; nextWaterDropAt = 999999;
  bioFish = []; poolNoodleItem = null; poolNoodleCharges = 0;
  nextCarAlarmAt = 999999; activeCarAlarm = null; endExitSign = null;
  achLevelFlashlightUsed = false; achLevelJumpscareTriggered = false;
  genLevel(level);
  ensureHum();
  ensureMusic();
  if (typeof ensureStaticNoise === 'function') ensureStaticNoise();
  setHumTargetFor(archetype);
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) pauseBtn.hidden = false;
  sfx.resume();
  // Agent #5: track the level just entered as "last played" so level-select
  // can highlight it.
  try { _cutRecordLastPlayed(level); } catch {}
  // Show level card first; gameplay paused via levelCardShowing flag.
  triggerLevelCard(level, () => {
    if (level === 1 && !_cutHasSeenTutorial()) {
      _cutTutorial(() => {});
    }
  });
}

// Agent C: trigger the per-level card and pause gameplay until dismissed.
function triggerLevelCard(lvl, onClosed) {
  const info = levelInfoFor(lvl);
  levelCardShowing = true;
  const monsterSummary = monsterSummaryFor(lvl);
  try {
    _cutLevelCard({
      level: lvl,
      name: info.name,
      sub: info.sub,
      theme: info.theme,
      monsters: monsterSummary,
    }, () => {
      levelCardShowing = false;
      levelStartT = gameTime;
      if (lvl === 1) runStartT = gameTime;
      try { onClosed && onClosed(); } catch {}
    });
  } catch {
    levelCardShowing = false;
    levelStartT = gameTime;
    if (lvl === 1) runStartT = gameTime;
    try { onClosed && onClosed(); } catch {}
  }
}
function monsterSummaryFor(lvl) {
  const arch = levelArchetypeFor(lvl);
  const parts = ['PUGZILLA × 1'];
  const sp = arch === 'lobby'     ? { hounds: 0, smilers: 0, crawlers: 0, whisperers: 0 }
           : arch === 'warehouse' ? { hounds: 2, smilers: 0, crawlers: 1, whisperers: 0 }
           : arch === 'pipes'     ? { hounds: 2, smilers: 1, crawlers: 0, whisperers: 0 }
           : arch === 'voidpool'  ? { hounds: 3, smilers: 1, crawlers: 0, whisperers: 1 }
           :                        { hounds: 2, smilers: 1, crawlers: 1, whisperers: 1 };
  if (sp.hounds)     parts.push(`HOUNDS × ${sp.hounds}`);
  if (sp.smilers)    parts.push(`SMILERS × ${sp.smilers}`);
  if (sp.crawlers)   parts.push(`CRAWLERS × ${sp.crawlers}`);
  if (sp.whisperers) parts.push(`WHISPERERS × ${sp.whisperers}`);
  return parts.join(' · ');
}
function openLevelSelect() {
  paintLevelSelectButtonVisibility();
  const unlocks = _cutLoadUnlocks();
  _cutLevelSelect({
    levels: LEVEL_LIST,
    unlocks,
    lastPlayedLevel: (unlocks && unlocks.lastPlayed) | 0,
    onPick: (lv) => {
      document.getElementById('overlay').hidden = true;
      document.getElementById('overlay').classList.add('is-hidden');
      startRun({ level: lv.idx });
    },
    onClose: () => {},
  });
}
// PAUSE
function togglePause() {
  if (!running) return;
  if (levelCardShowing) return;
  if (_cutIsShowing()) return;
  paused = !paused;
  const ov = document.getElementById('pause-overlay');
  if (!ov) return;
  if (paused) {
    const obj = document.getElementById('pause-obj');
    if (obj) {
      const info = levelInfoFor(level);
      const cansLeft = cans ? cans.length : 0;
      obj.innerHTML = (cansLeft > 0)
        ? `<b>LEVEL ${level}/${MAX_LEVEL}</b> · ${info.name}<br/>Pick up <b>${cansLeft}</b> more can${cansLeft === 1 ? '' : 's'}, then reach the yellow EXIT.`
        : `<b>LEVEL ${level}/${MAX_LEVEL}</b> · ${info.name}<br/>All cans collected — head to the yellow <b>EXIT</b> tile.`;
    }
    ov.hidden = false; ov.classList.remove('is-hidden');
  } else {
    ov.hidden = true; ov.classList.add('is-hidden');
  }
}
// Hook up the pause UI + ESC key + pause button + level-select button.
{
  const _levelBtn = document.getElementById('level-select-btn');
  if (_levelBtn) _levelBtn.addEventListener('click', openLevelSelect);
  const _pauseBtn = document.getElementById('pause-btn');
  if (_pauseBtn) _pauseBtn.addEventListener('click', togglePause);
  const _resume = document.getElementById('pause-resume');
  if (_resume) _resume.addEventListener('click', () => { paused = false;
    const ov = document.getElementById('pause-overlay'); if (ov) { ov.hidden = true; ov.classList.add('is-hidden'); } });
  // Agent #5: settings button reuses the shared gear button (createSettingsMenu
  // appended a global .wg-settings-btn at game init). Clicking it opens the
  // standard modal; the pause overlay stays underneath.
  const _pauseSettings = document.getElementById('pause-settings');
  if (_pauseSettings) _pauseSettings.addEventListener('click', () => {
    const gear = document.querySelector('.wg-settings-btn');
    if (gear) gear.click();
  });
  const _restartLv = document.getElementById('pause-restart');
  if (_restartLv) _restartLv.addEventListener('click', () => {
    paused = false;
    const ov = document.getElementById('pause-overlay'); if (ov) { ov.hidden = true; ov.classList.add('is-hidden'); }
    startRun({ level });
  });
  const _selBtn = document.getElementById('pause-select');
  if (_selBtn) _selBtn.addEventListener('click', () => {
    paused = false;
    const ov = document.getElementById('pause-overlay'); if (ov) { ov.hidden = true; ov.classList.add('is-hidden'); }
    openLevelSelect();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (_cutIsShowing()) return; // let cutscene handle escape
      e.preventDefault();
      togglePause();
    }
  });
}
// Agent C: cross-agent hook for other modules to trigger cutscenes.
if (typeof window !== 'undefined') {
  window.__backrooms = {
    showLevelCard: (lvl) => triggerLevelCard(lvl || level),
    showCutscene: (kind, opts) => {
      if (kind === 'intro') _cutIntro(opts && opts.cb);
      else if (kind === 'level') triggerLevelCard((opts && opts.level) || level, opts && opts.cb);
      else if (kind === 'death') _cutDeath(opts || {}, opts && opts.cb);
      else if (kind === 'win') _cutWin(opts || {}, opts && opts.cb);
      else if (kind === 'tutorial') _cutTutorial(opts && opts.cb);
      else if (kind === 'select') openLevelSelect();
    },
    getLevelInfo: (lvl) => levelInfoFor(lvl || level),
    getMaxLevel: () => MAX_LEVEL,
    togglePause,
    isCutsceneShowing: _cutIsShowing,
    isPaused: () => paused,
  };
}
let lastT = performance.now();
(function loop(now) {
  let dt = Math.min((now - lastT) / 1000, 0.05);
  // Round 2C: slow-mo final frame on monster catch — drop dt to 25% for the
  // duration of catchSlowmoT so the world freezes briefly with juicy weight.
  if (catchSlowmoT > 0) dt *= 0.25;
  lastT = now; tick(dt);
  // Agent #5: while replay is playing back, advance the playback clock and
  // keep rendering (game is not running anymore but we still need pixels).
  if (replayActive) {
    replayElapsed += dt;
    if (replayElapsed >= REPLAY_SECONDS + 0.2) {
      hideReplayOverlayHud();
      stopReplay();
    } else {
      render();
    }
  } else if (running) {
    render();
  }
  requestAnimationFrame(loop);
})(performance.now());

// Agent C: legacy showTip popup disabled — the new cutscene tutorial bubbles
// (_cutTutorial) handle this on first run, and returning players don't need a
// repeated tip every time they enter. Kept the import in case other code
// references it.
void showTip; // explicit reference so linters don't yell about unused import

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Stay near lights to keep sanity high.',
    'TIP: Hounds chase on sight — sneak instead of run.',
    'TIP: Smilers hate light — flash them to scare them off.',
    'TIP: Stand on furniture to HIDE from the giant pug.',
    'LORE: You noclipped through reality and now exist here.',
    'TIP: 60 notes are scattered across the layers — collect them all.',
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

// ============================================================================
// v2.5 BACK2D-013: Jumpscare intensity slider (off/light/full). Adds a tiny
// toggle in the top-right that gates the body class `.bp-jumpscare-off` and
// `.bp-jumpscare-light` for use by overlay screens.
// ============================================================================
(function _r5JumpscareSlider() {
  const key = 'back2d:jumpscare';
  if (!document.getElementById('bp-jumpscare-style')) {
    const s = document.createElement('style');
    s.id = 'bp-jumpscare-style';
    s.textContent = '.bp-jumpscare-off .jumpscare,.bp-jumpscare-off [class*="jumpscare"]{display:none!important}'
      + '.bp-jumpscare-light [class*="jumpscare"]{opacity:0.5!important;animation-duration:0.2s!important}';
    document.head.appendChild(s);
  }
  const cur = localStorage.getItem(key) || 'full';
  const apply = (v) => {
    document.body.classList.toggle('bp-jumpscare-off', v === 'off');
    document.body.classList.toggle('bp-jumpscare-light', v === 'light');
  };
  apply(cur);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:14px;right:140px;z-index:50;display:flex;gap:4px;background:rgba(20,8,32,0.85);border:1px solid #ff3aa1;padding:4px 6px;border-radius:3px;font-family:"Press Start 2P",monospace;font-size:8px;align-items:center;';
  const lbl = document.createElement('span');
  lbl.textContent = 'SCARE';
  lbl.style.cssText = 'color:#ff3aa1;padding:2px 4px;';
  wrap.appendChild(lbl);
  ['off','light','full'].forEach((lvl) => {
    const b = document.createElement('button');
    b.textContent = lvl.toUpperCase();
    b.style.cssText = 'background:none;border:none;color:' + (lvl === cur ? '#ffd23f' : '#888') + ';padding:2px 4px;cursor:pointer;font:inherit;';
    b.addEventListener('click', () => {
      localStorage.setItem(key, lvl);
      apply(lvl);
      [...wrap.querySelectorAll('button')].forEach((c, i) => {
        c.style.color = ['off','light','full'][i] === lvl ? '#ffd23f' : '#888';
      });
    });
    wrap.appendChild(b);
  });
  document.body.appendChild(wrap);
})();

// ============================================================================
// v2.5 BACK2D-008: Sprint key with stamina drain.
// Holding SHIFT increases player.speedMult (best-effort) and drains a stamina
// bar; auto-regen when released. Pure HUD pill — gameplay coupling only via
// window.__back2dPlayer.speedBoost flag.
// ============================================================================
(function _r5SprintStamina() {
  let stam = 1;
  let sprinting = false;
  let down = false;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:140px;height:8px;background:rgba(20,8,32,0.85);border:1px solid #4cc9f0;border-radius:2px;z-index:50;overflow:hidden;opacity:0;transition:opacity 0.4s;';
  const fill = document.createElement('div');
  fill.style.cssText = 'height:100%;background:linear-gradient(90deg,#4cc9f0,#5ef38c);width:100%;transition:width 0.1s linear;';
  bar.appendChild(fill);
  document.body.appendChild(bar);
  window.addEventListener('keydown', (e) => { if (e.key === 'Shift') down = true; });
  window.addEventListener('keyup', (e) => { if (e.key === 'Shift') down = false; });
  setInterval(() => {
    const wantSprint = down && stam > 0.05;
    if (wantSprint) stam = Math.max(0, stam - 0.018);
    else stam = Math.min(1, stam + 0.012);
    sprinting = wantSprint;
    if (window.__back2dPlayer) window.__back2dPlayer.speedBoost = sprinting ? 1.55 : 1;
    fill.style.width = (stam * 100).toFixed(0) + '%';
    fill.style.background = stam < 0.25 ? '#ff3aa1' : 'linear-gradient(90deg,#4cc9f0,#5ef38c)';
    bar.style.opacity = (down || stam < 0.99) ? '1' : '0';
  }, 80);
})();

// ============================================================================
// v2.5 BACK2D-019: Corridor wind-hum baseline. Always-on low drone via
// WebAudio that ducks when overlays open. Built lazily on first gesture.
// ============================================================================
(function _r5WindHum() {
  let ac = null, master = null;
  function build() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
      const bufSize = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
      const src = ac.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 280;
      src.connect(filt); filt.connect(master);
      src.start();
    } catch {}
  }
  window.addEventListener('pointerdown', build, { once: true });
  window.addEventListener('keydown', build, { once: true });
  setInterval(() => {
    if (!master || !ac) return;
    const startOv = document.getElementById('overlay');
    const muted = localStorage.getItem('wg:settings:muted') === '1';
    const startVisible = startOv && !startOv.hidden && !startOv.classList.contains('is-hidden');
    const want = !startVisible && !muted ? 0.045 : 0;
    try { master.gain.linearRampToValueAtTime(want, ac.currentTime + 0.6); } catch {}
  }, 600);
})();

// ============================================================================
// v2.6 BACK2D-009: End-card stats — appends a small "RUN REPORT" block to
// the end overlay each time it appears. Pulls from #hud-* counters that
// were live during the run + persists low-water sanity in localStorage.
// ============================================================================
(function _r6Back2dRunReport() {
  const endOv = document.getElementById('end-overlay');
  if (!endOv) return;
  let lowSanity = 100;
  let monsterEncs = 0, prevState = null;
  setInterval(() => {
    const s = parseInt(document.getElementById('hud-sanity-pct')?.textContent || '100', 10);
    if (!isNaN(s) && s < lowSanity) lowSanity = s;
    const st = (document.getElementById('hud-state')?.textContent || '').trim().toUpperCase();
    if (st === 'CHASE' && prevState !== 'CHASE') monsterEncs++;
    prevState = st;
  }, 400);
  new MutationObserver(() => {
    if (endOv.hidden || endOv.classList.contains('is-hidden')) return;
    if (endOv.querySelector('.r6-back2d-report')) return;
    const cans = document.getElementById('end-cans')?.textContent || '0';
    const notes = document.getElementById('end-notes')?.textContent || '0';
    const div = document.createElement('div');
    div.className = 'r6-back2d-report';
    div.innerHTML = '<div style="color:#4cc9f0;font-size:9px;margin-bottom:4px;letter-spacing:2px;">▼ RUN REPORT</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:VT323,monospace;font-size:15px;color:#fff;">'
      + '<div>Low sanity: <b style="color:#ff3aa1">' + lowSanity + '%</b></div>'
      + '<div>Encounters: <b style="color:#ffd23f">' + monsterEncs + '</b></div>'
      + '<div>Cans found: <b style="color:#5ef38c">' + cans + '</b></div>'
      + '<div>Notes read: <b style="color:#4cc9f0">' + notes + '</b></div>'
      + '</div>';
    div.style.cssText = 'margin:10px auto 0;max-width:340px;padding:10px 12px;background:rgba(76,201,240,0.08);border:1px solid rgba(76,201,240,0.4);border-radius:4px;text-align:left;';
    const box = endOv.querySelector('.overlay__panel') || endOv.querySelector('.overlay__inner') || endOv;
    box.appendChild(div);
    // reset for next run
    setTimeout(() => { lowSanity = 100; monsterEncs = 0; }, 500);
  }).observe(endOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
})();
