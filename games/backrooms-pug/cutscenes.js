// =========================================================================
// BACKROOMS OF PUG — CUTSCENE MODULE (Agent C)
//
// Self-contained system for:
//   - Intro cinematic (first run only, profile-flagged)
//   - Per-level "level cards" with vibe flashes + stat lines
//   - Death + Win epilogue cards
//   - Tutorial bubble flow (first-run only)
//   - Level select modal w/ unlock gates
//
// Public API (attached to window.__backrooms by the host main.js so other
// agents can drive cutscenes if needed):
//     showIntro(cb)           - one-shot intro flash; cb fires when dismissed.
//                               Skips immediately if the profile flag is set.
//     showLevelCard(info, cb) - 2-3s level card. info: { name, sub, kind,
//                               level, palette, monsters }. cb runs on close.
//     showDeath(stats, cb)    - "YOU WERE FOUND." card + stats. cb fires on
//                               restart click.
//     showWin(stats, cb)      - "YOU NOCLIPPED OUT." card + stats. cb fires on
//                               restart click.
//     showTutorial(cb)        - sequence of 3 hint bubbles + objective tip.
//     showLevelSelect(opts)   - modal of all 7 level cards. opts: { onPick,
//                               levels, unlocks, bestTimes }.
//     isShowing()             - true while any cutscene is on-screen.
//     onSkip(fn)              - subscribe to global skip events.
//     markIntroSeen()         - persists the flag (so it never replays).
//     hasSeenIntro()          - true if the flag is set in localStorage.
//     hasSeenTutorial()       - true if tutorial already shown for this profile.
//     markTutorialSeen()      - persists the tutorial flag.
//     reducedMotion()         - mirrors prefers-reduced-motion / body class.
//
// All overlays are DOM elements appended to <body> with z-index above the
// canvas/HUD but below the settings menu. Built without any external CSS — all
// inline so this file is drop-in.
// =========================================================================

import { profileKey } from '../../src/shared/profile.js';

const INTRO_KEY = 'backrooms-pug:intro-seen';
const TUT_KEY = 'backrooms-pug:tutorial-seen';
const UNLOCKS_KEY = 'backrooms-pug:levelUnlocks';

// --- localStorage helpers ---------------------------------------------------
function getFlag(key) {
  try { return !!localStorage.getItem(profileKey(key)); } catch { return false; }
}
function setFlag(key) {
  try { localStorage.setItem(profileKey(key), '1'); } catch {}
}

export function hasSeenIntro() { return getFlag(INTRO_KEY); }
export function markIntroSeen() { setFlag(INTRO_KEY); }
export function hasSeenTutorial() { return getFlag(TUT_KEY); }
export function markTutorialSeen() { setFlag(TUT_KEY); }
export function loadLevelUnlocks() {
  try {
    const raw = localStorage.getItem(profileKey(UNLOCKS_KEY));
    if (!raw) return { maxReached: 1 };
    const o = JSON.parse(raw);
    return (o && typeof o === 'object') ? o : { maxReached: 1 };
  } catch { return { maxReached: 1 }; }
}
export function saveLevelUnlocks(o) {
  try { localStorage.setItem(profileKey(UNLOCKS_KEY), JSON.stringify(o)); } catch {}
}
export function recordLevelReached(level) {
  const u = loadLevelUnlocks();
  if ((u.maxReached | 0) < level) {
    u.maxReached = level;
    saveLevelUnlocks(u);
  }
  return u;
}
export function recordLastPlayed(level) {
  const u = loadLevelUnlocks();
  u.lastPlayed = (level | 0) || 1;
  saveLevelUnlocks(u);
  return u;
}
export function recordLevelBestTime(levelIdx, seconds) {
  const u = loadLevelUnlocks();
  if (!u.bestTimes) u.bestTimes = {};
  const prev = u.bestTimes[levelIdx];
  if (prev == null || seconds < prev) {
    u.bestTimes[levelIdx] = Math.round(seconds * 10) / 10;
    saveLevelUnlocks(u);
    return true;
  }
  return false;
}

// --- reduced motion ---------------------------------------------------------
export function reducedMotion() {
  try {
    if (document.body && document.body.classList.contains('reduced-motion')) return true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {}
  return false;
}

// --- shared style block (injected once) -------------------------------------
let _stylesInjected = false;
function ensureStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .br-cut { position: fixed; inset: 0; z-index: 180; display: flex; align-items: center; justify-content: center;
              background: #000; color: #fff; font-family: 'Press Start 2P', monospace; -webkit-user-select: none; user-select: none;
              padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
    .br-cut[hidden] { display: none !important; }
    .br-cut.fade { animation: brCutFade .6s ease both; }
    @keyframes brCutFade { from { opacity: 0; } to { opacity: 1; } }
    .br-cut__panel { max-width: min(640px, 92vw); text-align: center; padding: 22px 26px; }
    .br-cut__skip { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
                    background: rgba(0,0,0,0.65); color: #c8c0e8; border: 2px solid #2a2540; padding: 8px 14px;
                    font-family: inherit; font-size: 0.55rem; letter-spacing: 0.1em; border-radius: 4px; cursor: pointer; z-index: 2; }
    .br-cut__skip:hover { color: #4cc9f0; border-color: #4cc9f0; }
    .br-cut__skip-hint { position: absolute; left: 50%; transform: translateX(-50%);
                         bottom: max(12px, env(safe-area-inset-bottom)); color: #6f6a88; font-size: 0.45rem;
                         letter-spacing: 0.18em; opacity: 0.7; pointer-events: none; text-align: center; }
    .br-cut__title { font-size: clamp(1.1rem, 4.5vw, 1.9rem); letter-spacing: 0.08em; color: #ffd23f;
                     text-shadow: 0 0 12px rgba(255,210,63,0.55), 0 0 30px rgba(255,210,63,0.25); margin: 0 0 8px; }
    .br-cut__sub { font-size: clamp(0.55rem, 2.5vw, 0.78rem); color: #c8c0e8; line-height: 1.7; margin: 12px 0; }
    .br-cut__prompt { margin-top: 22px; font-size: 0.6rem; color: #ffd23f; letter-spacing: 0.18em; animation: brCutBlink 1s steps(2,end) infinite; }
    @keyframes brCutBlink { 50% { opacity: 0.2; } }
    .br-cut__type { display: block; min-height: 1.3em; font-size: clamp(0.6rem, 2.6vw, 0.95rem); letter-spacing: 0.06em;
                    margin: 8px 0; color: #ffd23f; text-shadow: 0 0 6px rgba(255,210,63,0.5); }
    .br-cut__type--cyan { color: #4cc9f0; text-shadow: 0 0 6px rgba(76,201,240,0.5); }
    .br-cut__type--red  { color: #ff3a3a; text-shadow: 0 0 6px rgba(255,58,58,0.7); }
    .br-cut__type--white{ color: #fff; text-shadow: 0 0 6px rgba(255,255,255,0.5); }
    /* HALL silhouette pixel-art */
    .br-cut__hall { position: relative; width: min(560px, 86vw); height: 180px; margin: 14px auto 4px;
                    background: linear-gradient(180deg, #2a1e08 0%, #5a4818 35%, #8a7028 60%, #5a4818 80%, #2a1e08 100%);
                    border: 3px solid #1a0e02; overflow: hidden; }
    .br-cut__hall::before {
      content: ''; position: absolute; top: 38%; left: 50%; width: 0; height: 0;
      border-left: 280px solid transparent; border-right: 280px solid transparent;
      border-bottom: 120px solid #0a0600; transform: translate(-50%, -50%);
    }
    .br-cut__hall::after {
      content: ''; position: absolute; left: 50%; bottom: 18px; width: 9px; height: 18px;
      background: radial-gradient(circle, #1a0a04 0%, #1a0a04 65%, transparent 70%);
      transform: translateX(-50%); box-shadow: 0 -2px 0 #2a1408;
    }
    .br-cut__hall i.br-bulb {
      position: absolute; top: 12px; height: 6px; width: 28px; background: rgba(255,240,180,0.95);
      box-shadow: 0 0 12px rgba(255,240,180,0.6);
    }
    .br-cut__hall i.br-bulb.b1 { left: 14%; }
    .br-cut__hall i.br-bulb.b2 { left: 38%; }
    .br-cut__hall i.br-bulb.b3 { left: 60%; }
    .br-cut__hall i.br-bulb.b4 { left: 82%; }
    .br-cut.fl-flicker i.br-bulb.b2 { animation: brBulbFlick .9s steps(2,end) infinite; }
    .br-cut.fl-flicker i.br-bulb.b3 { animation: brBulbFlick 1.3s steps(2,end) infinite .2s; }
    @keyframes brBulbFlick { 50% { background: rgba(80,60,20,0.7); box-shadow: none; } }
    /* Level card */
    .br-cut__card { max-width: min(680px, 94vw); text-align: center; padding: 14px; }
    .br-cut__level-label { font-size: 0.6rem; color: #4cc9f0; letter-spacing: 0.22em; margin-bottom: 6px; }
    .br-cut__monsters { margin-top: 10px; font-size: clamp(0.5rem, 2.2vw, 0.7rem); letter-spacing: 0.08em; color: #ffd23f; }
    .br-cut__atmos { display: flex; gap: 14px; justify-content: center; margin: 18px 0 8px; }
    .br-cut__atmos canvas { image-rendering: pixelated; border: 3px solid #1a0e02; box-shadow: 0 0 14px rgba(0,0,0,0.7); background: #000; }
    .br-cut__atmos canvas { width: clamp(80px, 26vw, 130px); height: clamp(80px, 26vw, 130px); }
    .br-cut__progress { height: 4px; margin-top: 22px; background: #2a2540; position: relative; }
    .br-cut__progress > i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #ff3aa1, #ffd23f); }
    .br-cut.no-anim .br-cut__progress > i { width: 100%; transition: none; animation: none; }
    .br-cut.no-anim .br-cut__type { opacity: 1 !important; }
    .br-cut.no-anim * { animation: none !important; transition: none !important; }
    /* Stats card (death/win) */
    .br-cut__stats { list-style: none; padding: 14px 18px; margin: 18px 0 10px;
                     background: rgba(40,20,20,0.5); border-left: 3px solid #ff3a3a;
                     border-radius: 4px; text-align: left; font-size: clamp(0.5rem, 2vw, 0.7rem); line-height: 2.0; }
    .br-cut__stats.win-stats { border-color: #5ef38c; background: rgba(20,40,30,0.5);
                               border-left: none; border-top: 3px solid #5ef38c;
                               display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 14px;
                               text-align: center; line-height: 1.4; padding: 16px 14px; }
    .br-cut__stats.win-stats li { padding: 6px 4px; background: rgba(0,0,0,0.18); border-radius: 3px; }
    .br-cut__stats.win-stats li b { display: block; margin: 6px 0 0; color: #5ef38c;
                                    font-size: clamp(0.75rem, 2.8vw, 1.05rem); }
    @media (max-width: 520px) {
      .br-cut__stats.win-stats { grid-template-columns: repeat(2, 1fr); }
    }
    .br-cut__stats b { color: #ffd23f; margin-left: 6px; }
    .br-cut__btn { background: linear-gradient(180deg, #ff3aa1, #c01884); color: #fff;
                   border: 3px solid #ff8fc8; padding: 12px 22px; font-family: inherit;
                   font-size: 0.72rem; letter-spacing: 0.08em; cursor: pointer; border-radius: 4px;
                   box-shadow: 0 4px 0 #6b0c4a; margin: 6px 4px; min-height: 52px; min-width: 140px; }
    .br-cut__btn:hover { transform: translateY(-2px); }
    .br-cut__btn--ghost { background: transparent; border-color: #2a2540; color: #c8c0e8; box-shadow: none; }
    .br-cut__btn--ghost:hover { border-color: #4cc9f0; color: #4cc9f0; }
    .br-cut__btn-row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
    /* Tutorial bubbles — positioned per-step to avoid blocking the player.
       Default anchor at top so the player (centered on screen) stays visible. */
    .br-tip { position: fixed; left: 50%; top: clamp(80px, 12vh, 140px); transform: translateX(-50%);
              background: rgba(10,7,22,0.94); border: 2px solid #4cc9f0; border-radius: 6px; padding: 12px 20px;
              color: #f8f5ff; font-family: 'Press Start 2P', monospace; font-size: clamp(0.52rem, 2.2vw, 0.75rem);
              letter-spacing: 0.06em; text-align: center; max-width: min(560px, 88vw); z-index: 170;
              box-shadow: 0 0 16px rgba(76,201,240,0.6); animation: brTipPop .35s cubic-bezier(.22,1,.36,1) both; }
    .br-tip::before { content: '★'; color: #ffd23f; margin-right: 8px; }
    .br-tip.br-tip--bottom { top: auto; bottom: clamp(140px, 22vh, 220px); }
    .br-tip.br-tip--top-left  { left: max(12px, env(safe-area-inset-left, 0)); transform: none; max-width: min(360px, 50vw); }
    .br-tip.br-tip--top-right { left: auto; right: max(12px, env(safe-area-inset-right, 0)); transform: none; max-width: min(360px, 50vw); }
    .br-tip .br-tip-dots { display: block; margin-top: 8px; font-size: 0.5em; letter-spacing: 0.4em; color: #4cc9f0; opacity: 0.6; }
    @keyframes brTipPop { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translateX(-50%); } }
    .br-tip.br-tip--top-left, .br-tip.br-tip--top-right { animation: brTipPopSide .35s cubic-bezier(.22,1,.36,1) both; }
    @keyframes brTipPopSide { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .br-tip[hidden] { display: none !important; }
    /* Level select */
    .br-select { position: fixed; inset: 0; z-index: 160; background: rgba(10,7,22,0.92);
                 display: flex; align-items: center; justify-content: center; padding: 14px;
                 overflow-y: auto; backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .br-select[hidden] { display: none !important; }
    .br-select__panel { max-width: 960px; width: 100%; max-height: calc(100vh - 28px);
                        background: linear-gradient(135deg, #1a0f2e, #2a1255);
                        border: 3px solid #ff3aa1; border-radius: 8px; padding: 18px;
                        text-align: center; box-shadow: 0 0 0 3px #050310, 0 0 40px rgba(255,58,161,0.4);
                        overflow-y: auto; }
    .br-select__title { font-size: 1.2rem; margin: 0 0 6px; color: #ffd23f;
                        text-shadow: 0 0 10px rgba(255,210,63,0.5); letter-spacing: 0.08em; }
    .br-select__sub { color: #c8c0e8; font-size: 0.6rem; margin: 0 0 16px; letter-spacing: 0.06em; }
    .br-select__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                       gap: 14px; margin: 14px 0; }
    .br-select__card { background: rgba(0,0,0,0.5); border: 2px solid #2a2540; border-radius: 6px;
                       padding: 10px; cursor: pointer; transition: transform .14s, border-color .14s, box-shadow .14s;
                       text-align: center; font-family: inherit; color: #f8f5ff; position: relative; }
    .br-select__card:hover:not(.locked) { transform: translateY(-3px); border-color: #4cc9f0; box-shadow: 0 0 18px rgba(76,201,240,0.5); }
    .br-select__card.locked { opacity: 0.55; cursor: not-allowed; }
    .br-select__card.is-last-played { border-color: #ffd23f; box-shadow: 0 0 14px rgba(255,210,63,0.45); }
    .br-select__card.is-last-played::before { content: 'LAST PLAYED'; position: absolute;
                                              top: -10px; left: 50%; transform: translateX(-50%);
                                              font-size: 0.4rem; letter-spacing: 0.16em; color: #1a0f2e;
                                              background: #ffd23f; padding: 2px 8px; border-radius: 3px;
                                              box-shadow: 0 0 6px rgba(255,210,63,0.6); }
    .br-select__card canvas { width: 100%; height: 110px; image-rendering: pixelated; border-radius: 3px; background: #000; display: block; }
    .br-select__card .name { font-size: 0.65rem; color: #ffd23f; margin-top: 10px; letter-spacing: 0.06em; }
    .br-select__card .stars { font-size: 0.7rem; color: #ffb030; margin-top: 6px; letter-spacing: 0.2em;
                              text-shadow: 0 0 6px rgba(255,176,48,0.55); }
    .br-select__card .stars .s-off { color: #3a342a; text-shadow: none; opacity: 0.6; }
    .br-select__card .best { font-size: 0.45rem; color: #5ef38c; margin-top: 5px; letter-spacing: 0.06em; }
    .br-select__card .lock { font-size: 0.45rem; color: #ff3a3a; margin-top: 5px; letter-spacing: 0.04em; line-height: 1.4; }
    /* Subtle animated preview shimmer on each thumbnail */
    .br-select__card .br-thumb-wrap { position: relative; overflow: hidden; border-radius: 3px; }
    .br-select__card:not(.locked) .br-thumb-wrap::after {
      content: ''; position: absolute; inset: 0; background:
        linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%);
      transform: translateX(-100%); animation: brThumbShine 3.6s ease-in-out infinite;
    }
    @keyframes brThumbShine { 0% { transform: translateX(-100%); } 55% { transform: translateX(100%); } 100% { transform: translateX(100%); } }
    .br-cut.no-anim .br-select__card .br-thumb-wrap::after { animation: none !important; }
    .br-select__close { margin-top: 14px; }
  `;
  document.head.appendChild(s);
}

// --- skip subscribers -------------------------------------------------------
const _skipCbs = new Set();
export function onSkip(fn) { _skipCbs.add(fn); return () => _skipCbs.delete(fn); }
function _fireSkip() { for (const fn of _skipCbs) try { fn(); } catch {} }

// --- showing-state ----------------------------------------------------------
let _showCount = 0;
export function isShowing() { return _showCount > 0; }
function _enter() { _showCount++; }
function _exit() { _showCount = Math.max(0, _showCount - 1); }

// --- helpers ----------------------------------------------------------------
function mkOverlay(extraClass = '') {
  ensureStyles();
  const o = document.createElement('div');
  o.className = 'br-cut fade' + (extraClass ? ' ' + extraClass : '');
  if (reducedMotion()) o.classList.add('no-anim');
  return o;
}
function addSkipBtn(overlay, onSkipCb, hintLabel) {
  const b = document.createElement('button');
  b.className = 'br-cut__skip';
  b.type = 'button';
  b.textContent = 'SKIP ▶';
  b.setAttribute('aria-label', 'Skip cutscene');
  b.addEventListener('click', (e) => { e.stopPropagation(); onSkipCb(); });
  overlay.appendChild(b);
  // ESC-to-skip hint at the bottom of the cutscene (Agent #5).
  const hint = document.createElement('div');
  hint.className = 'br-cut__skip-hint';
  hint.textContent = hintLabel || 'ESC · SPACE · TAP TO SKIP';
  overlay.appendChild(hint);
  return b;
}

// =========================================================================
// INTRO CUTSCENE
// =========================================================================
const INTRO_LINES = [
  { text: 'YOU NOCLIPPED.', cls: '' },
  { text: 'YOU ARE IN THE BACKROOMS.', cls: 'br-cut__type--cyan' },
  { text: 'FIND 5 ALMOND CANS.', cls: '' },
  { text: 'REACH THE EXIT. DON’T DIE.', cls: 'br-cut__type--red' },
  { text: 'TRY NOT TO LOOK BEHIND YOU.', cls: 'br-cut__type--white' },
];
export function showIntro(cb) {
  ensureStyles();
  if (hasSeenIntro()) { try { cb && cb(); } catch {} return; }
  _enter();
  const o = mkOverlay('fl-flicker');
  const panel = document.createElement('div');
  panel.className = 'br-cut__panel';
  // Hall illustration
  const hall = document.createElement('div');
  hall.className = 'br-cut__hall';
  hall.innerHTML = '<i class="br-bulb b1"></i><i class="br-bulb b2"></i><i class="br-bulb b3"></i><i class="br-bulb b4"></i>';
  panel.appendChild(hall);
  // Typewriter container
  const linesEl = document.createElement('div');
  for (let i = 0; i < INTRO_LINES.length; i++) {
    const ln = document.createElement('span');
    ln.className = 'br-cut__type ' + INTRO_LINES[i].cls;
    ln.style.opacity = '0';
    ln.dataset.full = INTRO_LINES[i].text;
    linesEl.appendChild(ln);
  }
  panel.appendChild(linesEl);
  const prompt = document.createElement('div');
  prompt.className = 'br-cut__prompt';
  prompt.textContent = '[ SPACE / TAP TO ENTER ]';
  prompt.style.visibility = 'hidden';
  panel.appendChild(prompt);
  o.appendChild(panel);
  document.body.appendChild(o);
  // Play scare sting if available
  try { window.__backroomsPlayScareSting && window.__backroomsPlayScareSting('doom'); } catch {}
  // Type-out
  const reduced = reducedMotion();
  const lines = linesEl.children;
  let done = false;
  let timeouts = [];
  function showAll() {
    for (let i = 0; i < lines.length; i++) {
      lines[i].style.opacity = '1';
      lines[i].textContent = lines[i].dataset.full;
    }
    prompt.style.visibility = 'visible';
    done = true;
  }
  if (reduced) {
    showAll();
  } else {
    // Agent #5: faster typewriter (was 38ms/char + 700ms gap → painful).
    // Now 22ms/char + 360ms gap. Total intro ~3.7s vs old ~6.3s. Skip still works.
    const CHAR_MS = 22, LINE_GAP = 360;
    let delay = 250;
    for (let i = 0; i < lines.length; i++) {
      const el = lines[i];
      const txt = el.dataset.full;
      timeouts.push(setTimeout(() => {
        el.style.opacity = '1';
        let n = 0;
        const tickId = setInterval(() => {
          n++;
          el.textContent = txt.slice(0, n);
          if (n >= txt.length) clearInterval(tickId);
        }, CHAR_MS);
        timeouts.push({ clear: () => clearInterval(tickId) });
      }, delay));
      delay += LINE_GAP + txt.length * CHAR_MS;
    }
    timeouts.push(setTimeout(() => { prompt.style.visibility = 'visible'; done = true; }, delay + 150));
  }
  function cleanup() {
    timeouts.forEach(t => { if (typeof t === 'object' && t.clear) t.clear(); else clearTimeout(t); });
    timeouts = [];
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onPtr, true);
    o.remove();
    _exit();
    markIntroSeen();
    try { cb && cb(); } catch {}
  }
  function dismiss() {
    if (!done) showAll();
    cleanup();
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation(); dismiss();
    }
  }
  function onPtr() { dismiss(); }
  addSkipBtn(o, dismiss, 'ESC · SPACE · ENTER · TAP TO SKIP');
  document.addEventListener('keydown', onKey, true);
  o.addEventListener('pointerdown', onPtr, true);
}

// =========================================================================
// LEVEL CARD — short atmosphere flash
// =========================================================================
const ATMOS_THEMES = {
  lobby: {
    floor: ['#b8a44a', '#a8964a'], wall: '#7a6a20', accent: '#fff0b4',
    prop: 'lamp',
  },
  warehouse: {
    floor: ['#5a534a', '#4a4338'], wall: '#3a342a', accent: '#ffb060',
    prop: 'box',
  },
  pipes: {
    floor: ['#3a4048', '#2c323a'], wall: '#2a3038', accent: '#a8c0d0',
    prop: 'pipe',
  },
  voidpool: {
    floor: ['#0a1820', '#0a1418'], wall: '#0e1e2a', accent: '#48d8ff',
    prop: 'puddle',
  },
  poolrooms: {
    floor: ['#5ad0f0', '#4ab0d8'], wall: '#a0e8f8', accent: '#fff',
    prop: 'puddle',
  },
  parking: {
    floor: ['#2a2a2a', '#222'], wall: '#3a3838', accent: '#ffdc40',
    prop: 'box',
  },
  end: {
    floor: ['#000', '#0a0a0a'], wall: '#1a0a0a', accent: '#ff3a3a',
    prop: 'lamp',
  },
};

function paintAtmosTile(canvas, palette, kind) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  if (kind === 'wall') {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, w, h);
    // wallpaper stripes
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    for (let y = 4; y < h; y += 7) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    // light
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(w * 0.2, h * 0.12, w * 0.6, 5);
    ctx.globalAlpha = 1;
    // stains
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(w * 0.3, h * 0.65, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.7, h * 0.45, 5, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'floor') {
    // checker
    const tw = 14, th = 14;
    for (let y = 0; y < h; y += th) {
      for (let x = 0; x < w; x += tw) {
        ctx.fillStyle = ((x / tw + y / th) & 1) ? palette.floor[0] : palette.floor[1];
        ctx.fillRect(x, y, tw, th);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    for (let y = 0; y < h; y += th) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    for (let x = 0; x < w; x += tw) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
    }
    // stains
    ctx.fillStyle = 'rgba(80,8,8,0.5)';
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, 6, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'prop') {
    // dim floor backdrop
    ctx.fillStyle = palette.floor[0]; ctx.fillRect(0, 0, w, h);
    if (palette.prop === 'lamp') {
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(w / 2, h * 0.4, 35, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      // pole
      ctx.fillStyle = '#1a1208'; ctx.fillRect(w / 2 - 2, h * 0.4, 4, h * 0.4);
      // shade
      ctx.beginPath();
      ctx.moveTo(w / 2 - 18, h * 0.35);
      ctx.lineTo(w / 2 + 18, h * 0.35);
      ctx.lineTo(w / 2 + 12, h * 0.25);
      ctx.lineTo(w / 2 - 12, h * 0.25);
      ctx.closePath(); ctx.fillStyle = palette.wall; ctx.fill();
      // bulb
      ctx.fillStyle = palette.accent; ctx.fillRect(w / 2 - 4, h * 0.32, 8, 6);
    } else if (palette.prop === 'box') {
      ctx.fillStyle = '#7a5a2a'; ctx.fillRect(w * 0.25, h * 0.4, w * 0.5, h * 0.4);
      ctx.fillStyle = '#5a3e18'; ctx.fillRect(w * 0.25, h * 0.4, w * 0.5, 4);
      ctx.fillStyle = '#a08850'; ctx.fillRect(w * 0.5 - 2, h * 0.4, 4, h * 0.4);
    } else if (palette.prop === 'pipe') {
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, h * 0.5, w, 12);
      ctx.fillStyle = '#7a7a7a'; ctx.fillRect(0, h * 0.5 + 2, w, 4);
      ctx.fillStyle = '#3a3a3a';
      for (let x = 8; x < w; x += 18) ctx.fillRect(x, h * 0.5 - 3, 4, 18);
    } else if (palette.prop === 'puddle') {
      ctx.fillStyle = '#020608';
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.7, w * 0.35, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.7, w * 0.2, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // dim vignette
    const grd = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.6);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  }
}

export function showLevelCard(info, cb) {
  ensureStyles();
  _enter();
  const reduced = reducedMotion();
  const dur = reduced ? 1.6 : 2.6;
  const o = mkOverlay();
  const panel = document.createElement('div');
  panel.className = 'br-cut__panel br-cut__card';
  // Level label
  const lvLabel = document.createElement('div');
  lvLabel.className = 'br-cut__level-label';
  lvLabel.textContent = `LEVEL ${info.level} OF 7`;
  panel.appendChild(lvLabel);
  // Big title
  const title = document.createElement('h2');
  title.className = 'br-cut__title';
  title.textContent = info.name;
  panel.appendChild(title);
  // Sub
  const sub = document.createElement('div');
  sub.className = 'br-cut__sub';
  sub.textContent = info.sub || '';
  panel.appendChild(sub);
  // Atmosphere 3-frame flash
  const atmos = document.createElement('div');
  atmos.className = 'br-cut__atmos';
  const themeKey = info.theme || info.kind || 'lobby';
  const palette = ATMOS_THEMES[themeKey] || ATMOS_THEMES.lobby;
  ['wall', 'floor', 'prop'].forEach(k => {
    const c = document.createElement('canvas');
    c.width = 120; c.height = 120;
    paintAtmosTile(c, palette, k);
    atmos.appendChild(c);
  });
  panel.appendChild(atmos);
  // Monster count line
  if (info.monsters) {
    const monLine = document.createElement('div');
    monLine.className = 'br-cut__monsters';
    monLine.textContent = info.monsters;
    panel.appendChild(monLine);
  }
  // Progress bar
  const prog = document.createElement('div');
  prog.className = 'br-cut__progress';
  const fill = document.createElement('i');
  prog.appendChild(fill);
  panel.appendChild(prog);
  o.appendChild(panel);
  document.body.appendChild(o);
  // Animate fill
  let startT = performance.now();
  let rafId = 0;
  let closed = false;
  function step(now) {
    if (closed) return;
    const k = Math.min(1, (now - startT) / (dur * 1000));
    fill.style.width = (k * 100) + '%';
    if (k >= 1) { close(); return; }
    rafId = requestAnimationFrame(step);
  }
  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(rafId);
    document.removeEventListener('keydown', onKey, true);
    o.remove();
    _exit();
    try { cb && cb(); } catch {}
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation(); close();
    }
  }
  addSkipBtn(o, close, 'ESC · SPACE · TAP TO SKIP');
  o.addEventListener('pointerdown', close, { once: true });
  document.addEventListener('keydown', onKey, true);
  rafId = requestAnimationFrame(step);
}

// =========================================================================
// DEATH CUTSCENE
// =========================================================================
function fmtTime(s) {
  if (s == null || isNaN(s)) return '0:00';
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function showDeath(stats, cb) {
  ensureStyles();
  _enter();
  const o = mkOverlay();
  const panel = document.createElement('div');
  panel.className = 'br-cut__panel br-cut__card';
  // Title
  const title = document.createElement('h2');
  title.className = 'br-cut__title';
  title.style.color = '#ff3a3a';
  title.style.textShadow = '0 0 14px rgba(255,58,58,0.6)';
  title.textContent = 'YOU WERE FOUND.';
  panel.appendChild(title);
  // Cause sub
  const sub = document.createElement('div');
  sub.className = 'br-cut__sub';
  sub.textContent = stats.cause || 'The Backrooms claimed you.';
  panel.appendChild(sub);
  // Stats
  const ul = document.createElement('ul');
  ul.className = 'br-cut__stats';
  const items = [
    ['LEVEL REACHED', stats.level || 1],
    ['CANS COLLECTED', stats.cans || 0],
    ['TIME SURVIVED', fmtTime(stats.time)],
    ['NOTES FOUND', `${stats.notesFound || 0} / ${stats.notesTotal || 30}`],
  ];
  if (stats.best != null) items.push(['BEST LEVEL', `Level ${stats.best}${stats.isNewBest ? ' ★ NEW' : ''}`]);
  items.forEach(([k, v]) => {
    const li = document.createElement('li');
    li.innerHTML = `${k}: <b>${v}</b>`;
    ul.appendChild(li);
  });
  panel.appendChild(ul);
  // Buttons
  const row = document.createElement('div');
  row.className = 'br-cut__btn-row';
  const tryBtn = document.createElement('button');
  tryBtn.className = 'br-cut__btn'; tryBtn.type = 'button';
  tryBtn.textContent = 'TRY AGAIN';
  tryBtn.addEventListener('click', () => { close(); try { cb && cb('restart'); } catch {} });
  row.appendChild(tryBtn);
  // REPLAY LAST 5s — only if host registered a replay buffer with frames.
  let replayBtn = null;
  if (stats.canReplay) {
    replayBtn = document.createElement('button');
    replayBtn.className = 'br-cut__btn br-cut__btn--ghost'; replayBtn.type = 'button';
    replayBtn.textContent = '▶ REPLAY LAST 5s';
    replayBtn.addEventListener('click', () => {
      // Don't close — fade the whole overlay so the player can watch the
      // ghost recap playing on the gameplay canvas underneath, then fade back.
      o.style.transition = 'opacity .25s'; o.style.opacity = '0';
      o.style.pointerEvents = 'none';
      try { cb && cb('replay', () => {
        o.style.opacity = '1'; o.style.pointerEvents = 'auto';
      }); } catch {}
    });
    row.appendChild(replayBtn);
  }
  const selBtn = document.createElement('button');
  selBtn.className = 'br-cut__btn br-cut__btn--ghost'; selBtn.type = 'button';
  selBtn.textContent = 'LEVEL SELECT';
  selBtn.addEventListener('click', () => { close(); try { cb && cb('select'); } catch {} });
  row.appendChild(selBtn);
  const hubA = document.createElement('a');
  hubA.className = 'br-cut__btn br-cut__btn--ghost';
  hubA.href = '../../index.html'; hubA.textContent = '← HUB';
  row.appendChild(hubA);
  panel.appendChild(row);
  o.appendChild(panel);
  document.body.appendChild(o);
  // Death sting
  try { window.__backroomsPlayScareSting && window.__backroomsPlayScareSting('death'); } catch {}
  // 2s hold before buttons get focus styling (visual drama)
  if (!reducedMotion()) {
    const fadeBtns = [tryBtn];
    if (replayBtn) fadeBtns.push(replayBtn);
    fadeBtns.push(selBtn, hubA);
    fadeBtns.forEach(b => { b.style.opacity = '0'; });
    setTimeout(() => {
      fadeBtns.forEach((b, i) => {
        setTimeout(() => { b.style.transition = 'opacity .4s'; b.style.opacity = '1'; }, i * 110);
      });
    }, 1600);
  }
  function close() {
    document.removeEventListener('keydown', onKey, true);
    o.remove();
    _exit();
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryBtn.click(); }
  }
  document.addEventListener('keydown', onKey, true);
}

// =========================================================================
// WIN CUTSCENE
// =========================================================================
export function showWin(stats, cb) {
  ensureStyles();
  _enter();
  const o = mkOverlay();
  o.style.background = 'radial-gradient(circle at 50% 40%, #fff7d0 0%, #fff 8%, #f8f5ff 30%, #1a0f2e 90%)';
  const panel = document.createElement('div');
  panel.className = 'br-cut__panel br-cut__card';
  const title = document.createElement('h2');
  title.className = 'br-cut__title';
  title.style.color = '#5ef38c';
  title.style.textShadow = '0 0 14px rgba(94,243,140,0.6)';
  title.textContent = 'YOU NOCLIPPED OUT.';
  panel.appendChild(title);
  const sub = document.createElement('div');
  sub.className = 'br-cut__sub';
  sub.style.color = '#1a0f2e';
  sub.textContent = 'Reality folded back over the pug. The hum is gone.';
  panel.appendChild(sub);
  const ul = document.createElement('ul');
  ul.className = 'br-cut__stats win-stats';
  // Agent #5: 4-column grid. Label sits above the value (formatted via CSS
  // `.win-stats li b { display:block; font-size:bigger }`), so we drop the
  // ": " separator from the inline HTML.
  const items = [
    ['LEVELS', stats.level || 1],
    ['CANS', stats.cans || 0],
    ['TIME', fmtTime(stats.time)],
    ['NOTES', `${stats.notesFound || 0}/${stats.notesTotal || 30}`],
    ['CHAINS', stats.deathsAvoided || 0],
  ];
  if (stats.isNewBest) items.push(['★', 'NEW BEST']);
  items.forEach(([k, v]) => {
    const li = document.createElement('li');
    li.innerHTML = `${k}<b>${v}</b>`;
    ul.appendChild(li);
  });
  panel.appendChild(ul);
  const row = document.createElement('div');
  row.className = 'br-cut__btn-row';
  const shareBtn = document.createElement('button');
  shareBtn.className = 'br-cut__btn'; shareBtn.type = 'button';
  shareBtn.textContent = '\u{1F4CB} SHARE';
  shareBtn.addEventListener('click', async () => {
    const text = `\u{1F436} BACKROOMS OF PUG — Noclipped out! Beat me at https://leobalkind.github.io/web-games/`;
    try {
      if (navigator.share) await navigator.share({ title: 'BACKROOMS OF PUG', text });
      else { await navigator.clipboard.writeText(text); shareBtn.textContent = '✓ COPIED'; }
    } catch { shareBtn.textContent = '⚠ FAILED'; }
  });
  row.appendChild(shareBtn);
  const tryBtn = document.createElement('button');
  tryBtn.className = 'br-cut__btn'; tryBtn.type = 'button';
  tryBtn.textContent = 'RESTART';
  tryBtn.addEventListener('click', () => { close(); try { cb && cb('restart'); } catch {} });
  row.appendChild(tryBtn);
  const hubA = document.createElement('a');
  hubA.className = 'br-cut__btn br-cut__btn--ghost';
  hubA.href = '../../index.html'; hubA.textContent = '← HUB';
  row.appendChild(hubA);
  panel.appendChild(row);
  o.appendChild(panel);
  document.body.appendChild(o);
  try { window.__backroomsPlayScareSting && window.__backroomsPlayScareSting('success'); } catch {}
  function close() {
    document.removeEventListener('keydown', onKey, true);
    o.remove();
    _exit();
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryBtn.click(); }
  }
  document.addEventListener('keydown', onKey, true);
}

// =========================================================================
// TUTORIAL — 4 sequential hint bubbles after first level card.
// =========================================================================
// Agent #5: 7 sequential tutorial bubbles with per-step positions so they
// don't sit on top of the player (centered on screen). Pos values:
//   'top'        — above the player, anchored ~12vh from the top
//   'bottom'     — below the player, anchored ~22vh from the bottom
//   'top-left'   — top-left corner card (won't block view)
//   'top-right'  — top-right corner card (won't block view)
const TUTORIAL_STEPS = [
  { text: 'WASD or DPad to move', pos: 'top' },
  { text: 'HOLD SHIFT to sneak — slower but quieter', pos: 'bottom' },
  { text: 'B or LIGHT to toggle flashlight', pos: 'top-left' },
  { text: 'F or SMOKE to drop a smoke bomb', pos: 'top-right' },
  { text: 'PICK UP 5 ALMOND CANS each floor', pos: 'top' },
  { text: 'REACH THE YELLOW EXIT TILE when done', pos: 'bottom' },
  { text: 'AT THE EXIT, PRESS E TO NOCLIP TO THE NEXT LEVEL', pos: 'top' },
];
export function showTutorial(cb) {
  ensureStyles();
  if (hasSeenTutorial()) { try { cb && cb(); } catch {} return; }
  let i = 0;
  let bubble = null;
  let timer = null;
  function next() {
    if (bubble) { bubble.remove(); bubble = null; }
    if (i >= TUTORIAL_STEPS.length) {
      markTutorialSeen();
      try { cb && cb(); } catch {}
      return;
    }
    const step = TUTORIAL_STEPS[i];
    bubble = document.createElement('div');
    let cls = 'br-tip';
    if (step.pos === 'bottom') cls += ' br-tip--bottom';
    else if (step.pos === 'top-left') cls += ' br-tip--top-left';
    else if (step.pos === 'top-right') cls += ' br-tip--top-right';
    bubble.className = cls;
    bubble.innerHTML = (step.text || '') +
      `<span class="br-tip-dots">${i + 1} / ${TUTORIAL_STEPS.length}</span>`;
    document.body.appendChild(bubble);
    i++;
    const dur = reducedMotion() ? 2300 : 3600;
    timer = setTimeout(next, dur);
  }
  next();
}

// =========================================================================
// LEVEL SELECT MODAL
// =========================================================================
// Each level: { idx, key, name, theme, diff (1..5) }
export function showLevelSelect({ levels, unlocks, onPick, onClose, lastPlayedLevel }) {
  ensureStyles();
  _enter();
  const o = document.createElement('div');
  o.className = 'br-select';
  if (reducedMotion()) o.classList.add('br-cut'); // reuse no-anim flag rules
  const panel = document.createElement('div');
  panel.className = 'br-select__panel';
  const title = document.createElement('h2');
  title.className = 'br-select__title';
  title.textContent = 'LEVEL SELECT';
  panel.appendChild(title);
  const sub = document.createElement('div');
  sub.className = 'br-select__sub';
  sub.textContent = 'Pick where to noclip in. Higher floors stay locked until reached.';
  panel.appendChild(sub);
  const grid = document.createElement('div');
  grid.className = 'br-select__grid';
  const maxReached = (unlocks && unlocks.maxReached) || 1;
  const bestTimes = (unlocks && unlocks.bestTimes) || {};
  // Last-played is read from unlocks.lastPlayed (set in main.js) or arg.
  const lastPlayed = (lastPlayedLevel | 0) || (unlocks && (unlocks.lastPlayed | 0)) || 0;
  levels.forEach((lv) => {
    const locked = lv.idx > maxReached;
    const card = document.createElement('button');
    card.type = 'button';
    let cls = 'br-select__card';
    if (locked) cls += ' locked';
    if (!locked && lv.idx === lastPlayed) cls += ' is-last-played';
    card.className = cls;
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'br-thumb-wrap';
    const thumb = document.createElement('canvas');
    thumb.width = 220; thumb.height = 110;
    const pal = ATMOS_THEMES[lv.theme] || ATMOS_THEMES.lobby;
    paintLevelThumb(thumb, pal, lv);
    if (locked) {
      const c2 = thumb.getContext('2d');
      c2.fillStyle = 'rgba(0,0,0,0.7)';
      c2.fillRect(0, 0, thumb.width, thumb.height);
    }
    thumbWrap.appendChild(thumb);
    card.appendChild(thumbWrap);
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = `LV ${lv.idx} · ${lv.name}`;
    card.appendChild(nm);
    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.setAttribute('aria-label', `Difficulty ${lv.diff || 1} of 5`);
    const s = lv.diff || 1;
    // Split filled/empty so CSS can de-emphasise the empty ones distinctly.
    let starHtml = '';
    for (let k = 0; k < 5; k++) starHtml += (k < s ? '<span>★</span>' : '<span class="s-off">★</span>');
    stars.innerHTML = starHtml;
    card.appendChild(stars);
    if (locked) {
      const lk = document.createElement('div');
      lk.className = 'lock';
      lk.textContent = `\u{1F512} REACH LV ${lv.idx} TO UNLOCK`;
      card.appendChild(lk);
    } else {
      const bt = bestTimes[lv.idx];
      const best = document.createElement('div');
      best.className = 'best';
      best.textContent = (bt != null) ? `BEST: ${fmtTime(bt)}` : 'NEW';
      card.appendChild(best);
    }
    if (!locked) {
      card.addEventListener('click', () => {
        close();
        try { onPick && onPick(lv); } catch {}
      });
    }
    grid.appendChild(card);
  });
  panel.appendChild(grid);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'br-cut__btn br-cut__btn--ghost br-select__close';
  closeBtn.type = 'button';
  closeBtn.textContent = 'CANCEL';
  closeBtn.addEventListener('click', () => { close(); try { onClose && onClose(); } catch {} });
  panel.appendChild(closeBtn);
  o.appendChild(panel);
  document.body.appendChild(o);
  function close() {
    document.removeEventListener('keydown', onKey, true);
    o.remove();
    _exit();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); try { onClose && onClose(); } catch {} }
  }
  document.addEventListener('keydown', onKey, true);
}

function paintLevelThumb(canvas, palette, lv) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // floor backdrop
  for (let y = 0; y < h; y += 10) {
    for (let x = 0; x < w; x += 10) {
      ctx.fillStyle = ((x / 10 + y / 10) & 1) ? palette.floor[0] : palette.floor[1];
      ctx.fillRect(x, y, 10, 10);
    }
  }
  // walls (top + side strip)
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, w, 12);
  ctx.fillRect(0, 0, 8, h);
  // light strip
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(w * 0.2, 4, w * 0.6, 4);
  ctx.globalAlpha = 1;
  // tiny pug silhouette in center
  ctx.fillStyle = '#1a0a08';
  ctx.beginPath(); ctx.ellipse(w / 2, h * 0.7, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w / 2 + 5, h * 0.7 - 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = palette.accent;
  ctx.fillRect(w / 2 + 7, h * 0.7 - 5, 2, 2);
  // vignette
  const grd = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
}
