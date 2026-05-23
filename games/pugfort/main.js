import { Game } from './src/Game.js';
import { Sfx } from './src/Sfx.js';
import { createTouchControls } from '../../src/touch/touchControls.js';
import '../../src/touch/touchControls.css';
import { getGamepad } from '../../src/gamepad/gamepad.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';

import { showTip } from '../../src/shared/tutorialTip.js';
import { iconSvg } from '../../src/shared/icons.js';
import { BUILDABLES, MATERIALS, getUnlockSummary, recordSurvival, isLocked } from './src/Build.js';
import { playIntroCutscene } from './src/Cutscene.js';
import { createSpeedToggle } from '../../src/shared/speedToggle.js';
import { showWavePreview } from '../../src/shared/wavePreview.js';

const touch = createTouchControls({ enableAbility: true, abilityLabel: 'BUILD' });
if (touch.enabled) document.body.classList.add('is-touch');
const gp = getGamepad();
// Mobile extra-buttons overlay (joystick + fire handled by dual-stick above)
createMobileControls({
  layout: 'single-tap',
  buttons: [
    { id: 'shop', label: 'SHOP', key: 'B' },
  ],
});

const root = document.getElementById('game-root');
const startBtn = document.getElementById('start-btn');
const startOverlay = document.getElementById('overlay');
const endOverlay = document.getElementById('end-overlay');
const restartBtn = document.getElementById('end-restart');
const muteBtn = document.getElementById('mute-btn');

// Mute toggle — persists across sessions
function applyMuteUI(muted) {
  if (!muteBtn) return;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
}
const savedMute = localStorage.getItem('pugfort:muted') === '1';
Sfx.setMuted?.(savedMute);
applyMuteUI(savedMute);
muteBtn?.addEventListener('click', () => {
  const m = Sfx.toggleMute ? Sfx.toggleMute() : false;
  localStorage.setItem('pugfort:muted', m ? '1' : '0');
  applyMuteUI(m);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    const m = Sfx.toggleMute ? Sfx.toggleMute() : false;
    localStorage.setItem('pugfort:muted', m ? '1' : '0');
    applyMuteUI(m);
  }
});

const game = new Game();
game.touchControls = touch;
game.gamepad = gp;

function hide(el) { el.hidden = true; el.classList.add('is-hidden'); }
function show(el) { el.hidden = false; el.classList.remove('is-hidden'); }

async function play() {
  hide(startOverlay);
  hide(endOverlay);
  // 4-5s cinematic intro before the game starts. Skippable via SKIP / click / space.
  // Plays every match (including REMATCH) — the user explicitly asked for that.
  try {
    await playIntroCutscene();
  } catch (e) {
    // never let the cutscene block the game
    console.warn('[pugfort] cutscene error', e);
  }
  await game.start();
  // Repaint locked-state on hotbar slots — must happen AFTER hud is wired by start().
  refreshLockedSlots();
  if (localStorage.getItem('wg:music') !== '0') Sfx.startMusic?.();
}

// ============ Pause menu ============
const pauseOverlay = document.getElementById('pause-overlay');
const pauseBtn = document.getElementById('pause-btn');
const pauseResume = document.getElementById('pause-resume');
const pauseMuteBtn = document.getElementById('pause-mute');
const pauseLarge = document.getElementById('pause-large-text');
const pauseQuit = document.getElementById('pause-quit');
let paused = false;
function setPaused(p) {
  paused = p;
  if (!pauseOverlay) return;
  pauseOverlay.hidden = !p;
  if (game?.app?.ticker) { if (p) game.app.ticker.stop(); else game.app.ticker.start(); }
  if (pauseMuteBtn) pauseMuteBtn.textContent = Sfx.isMuted?.() ? 'SOUND: OFF' : 'SOUND: ON';
  if (pauseLarge) pauseLarge.textContent = document.body.classList.contains('large-text') ? 'LARGE TEXT: ON' : 'LARGE TEXT: OFF';
}
pauseBtn?.addEventListener('click', () => setPaused(!paused));
pauseResume?.addEventListener('click', () => setPaused(false));
pauseMuteBtn?.addEventListener('click', () => {
  const m = Sfx.toggleMute?.();
  localStorage.setItem('pugfort:muted', m ? '1' : '0');
  applyMuteUI(!!m);
  pauseMuteBtn.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
});
pauseLarge?.addEventListener('click', () => {
  document.body.classList.toggle('large-text');
  const on = document.body.classList.contains('large-text');
  localStorage.setItem('wg:large-text', on ? '1' : '0');
  pauseLarge.textContent = on ? 'LARGE TEXT: ON' : 'LARGE TEXT: OFF';
});
pauseQuit?.addEventListener('click', () => { window.location.href = '../../index.html'; });
document.getElementById('pause-photo')?.addEventListener('click', () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const a = document.createElement('a');
  a.download = `pugfort-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});
document.getElementById('end-share')?.addEventListener('click', async () => {
  const nights = document.getElementById('end-nights')?.textContent || '0';
  const kills = document.getElementById('end-kills')?.textContent || '0';
  const walls = document.getElementById('end-walls')?.textContent || '0';
  const text = `🐶 PUGFORT.EXE — I survived ${nights} nights, killed ${kills} zombies, built ${walls} walls! Beat me at https://leobalkind.github.io/web-games/`;
  const btn = document.getElementById('end-share');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'PUGFORT.EXE', text, url: 'https://leobalkind.github.io/web-games/' });
    } else {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ COPIED!';
      setTimeout(() => { btn.textContent = '📋 SHARE'; }, 2000);
    }
  } catch (err) {
    btn.textContent = '⚠ FAILED';
    setTimeout(() => { btn.textContent = '📋 SHARE'; }, 2000);
  }
});
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && startOverlay.classList.contains('is-hidden') && endOverlay.classList.contains('is-hidden')) {
    e.preventDefault();
    setPaused(!paused);
  }
});
// Difficulty buttons
const savedDiff = localStorage.getItem('pugfort:difficulty') || 'easy';
document.querySelectorAll('.diff-btn').forEach((btn) => {
  if (btn.dataset.diff === savedDiff) btn.classList.add('diff-btn--active');
  else btn.classList.remove('diff-btn--active');
  btn.addEventListener('click', () => {
    const d = btn.dataset.diff;
    localStorage.setItem('pugfort:difficulty', d);
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('diff-btn--active', b === btn));
  });
});

// Paint shared pixel-art icons over the emoji placeholders in the hotbar.
// Cost lines still use emoji (the wood/scrap counts) since they live in
// regular text content — keeping the source-of-truth in MATERIALS.icon.
function paintHotbarIcons() {
  for (const id of Object.keys(BUILDABLES)) {
    const def = BUILDABLES[id];
    if (!def.iconName || !iconSvg[def.iconName]) continue;
    const slot = document.getElementById('slot-' + id);
    if (!slot) continue;
    const iconEl = slot.querySelector('.hud-slot__icon');
    if (iconEl) iconEl.innerHTML = iconSvg[def.iconName](22);
  }
}
paintHotbarIcons();

// =============================================================================
// META-UNLOCKS — render start-screen list + dim locked hotbar slots.
// Refreshed on boot, after each run, and whenever recordSurvival mutates state.
// =============================================================================
function renderUnlocksPanel(highlightFreshKeys) {
  const summary = getUnlockSummary();
  const panel = document.getElementById('unlocks-panel');
  const listEl = document.getElementById('unlocks-list');
  const progEl = document.getElementById('unlocks-progress');
  if (!panel || !listEl || !progEl) return;
  if (!summary.items.length) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  progEl.textContent = `Cumulative nights survived: ${summary.totalNights}`;
  listEl.innerHTML = summary.items.map((it) => {
    const cls = it.unlocked ? 'unlocked' : 'locked';
    const fresh = highlightFreshKeys && highlightFreshKeys.has(it.def.unlock.key) ? ' fresh' : '';
    const hint = it.unlocked
      ? `Unlocked`
      : `Locked · ${it.label}`;
    return `<li class="${cls}${fresh}">
      <span class="ul-icon">${it.def.icon || '⬛'}</span>
      <span class="ul-name"><b>${it.def.name}</b> — ${hint}</span>
    </li>`;
  }).join('');
}
function refreshLockedSlots() {
  for (const id of Object.keys(BUILDABLES)) {
    const def = BUILDABLES[id];
    if (!def.unlock) continue;
    if (game?.hud) game.hud.setSlotLocked(id, isLocked(id), `Locked · ${def.unlock.label}`);
  }
}
renderUnlocksPanel();

// Restore accessibility preferences from hub-wide settings
if (localStorage.getItem('wg:large-text') === '1') document.body.classList.add('large-text');
if (localStorage.getItem('wg:reduced-motion') === '1') document.body.classList.add('reduced-motion');
if (localStorage.getItem('wg:colorblind') === '1') document.body.classList.add('colorblind');

// ============ High score on end screen ============
import('../../src/persistence/highScores.js').then(({ submitRun, loadBest }) => {
  // Hook end-screen submission via observing the end overlay being shown
  const obs = new MutationObserver(() => {
    if (endOverlay.hidden || endOverlay.classList.contains('is-hidden')) return;
    const kills = parseInt(document.getElementById('end-kills')?.textContent || '0', 10);
    const nights = parseInt(document.getElementById('end-nights')?.textContent || '0', 10);
    const walls = parseInt(document.getElementById('end-walls')?.textContent || '0', 10);
    // Score: nights primary, kills tiebreak
    const score = nights * 10000 + kills;
    const run = { score, nights, kills, walls };
    const { isNewBest, current } = submitRun('pugfort', run);
    const bestEl = document.getElementById('end-best');
    if (bestEl) {
      const best = current || run;
      bestEl.innerHTML = `Best: <b>${best.nights} nights, ${best.kills} kills</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
    }
    // -----------------------------------------------------------------------
    // META-UNLOCK — add this run's nights to the career total, surface any
    // newly-unlocked buildables in a banner under the end stats.
    // -----------------------------------------------------------------------
    const newlyUnlocked = recordSurvival(nights);
    const banner = document.getElementById('end-unlock-banner');
    if (banner) banner.remove();
    if (newlyUnlocked.length) {
      const div = document.createElement('div');
      div.id = 'end-unlock-banner';
      div.className = 'end-unlock-banner';
      div.innerHTML = '★ NEW UNLOCK: ' + newlyUnlocked.map(d => `<b>${d.name}</b>`).join(', ');
      const stats = document.querySelector('#end-overlay .end-stats');
      if (stats) stats.after(div);
    }
    // Repaint start-screen unlocks list so a future REMATCH→back-to-start
    // shows fresh state. Highlight any newly-earned ones.
    renderUnlocksPanel(new Set(newlyUnlocked.map(d => d.unlock.key)));
    // Also refresh the in-game hotbar lock state for next match.
    refreshLockedSlots();
  });
  obs.observe(endOverlay, { attributes: true, attributeFilter: ['hidden', 'class'] });

  // Show personal best on start screen
  const best = loadBest('pugfort');
  if (best) {
    const sub = startOverlay.querySelector('.overlay__sub');
    if (sub && !document.getElementById('best-line')) {
      const div = document.createElement('div');
      div.id = 'best-line';
      div.style.cssText = 'margin:10px 0 0;color:var(--neon-yellow);font-size:0.6rem;letter-spacing:0.05em;';
      div.innerHTML = `★ Best: <b>${best.nights}</b> nights, <b>${best.kills}</b> kills`;
      sub.appendChild(div);
    }
  }
});

// Async boot wrapped in an IIFE so production build doesn't need top-level await
(async () => {
  await game.init(root);
  startBtn.addEventListener('click', play);
  restartBtn.addEventListener('click', play);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (!startOverlay.classList.contains('is-hidden') || !endOverlay.classList.contains('is-hidden'))) {
      play();
    }
  });
  // Hide loading screen
  const ls = document.getElementById('loading-screen');
  if (ls) ls.hidden = true;
})();

// Floating 1x/2x/3x speed toggle (only active during the night phase). The
// toggle calls into Game._speedMult; Game._update gates by `phase === 'night'`.
const _speedTog = createSpeedToggle({ onChange: (m) => { if (game) game._speedMult = m; } });
_speedTog.setDisabled(true);
// Wave-preview banner before each night + manage speed-toggle enabled state.
game.onWaveStart = (nightIdx, spawnTarget) => {
  // Enemy mix per night — matches the game's _announceWave() table.
  const lineups = {
    1: [{ icon: '🐶', count: spawnTarget, label: 'WALKERS' }],
    2: [
      { icon: '🐶', count: Math.floor(spawnTarget * 0.5), label: 'WALKERS' },
      { icon: '🛡️', count: Math.floor(spawnTarget * 0.2), label: 'TANKS' },
      { icon: '🦠', count: Math.floor(spawnTarget * 0.2), label: 'SPITTERS' },
    ],
    3: [
      { icon: '🐶', count: Math.floor(spawnTarget * 0.4), label: 'WALKERS' },
      { icon: '🛡️', count: Math.floor(spawnTarget * 0.25), label: 'TANKS' },
      { icon: '🦠', count: Math.floor(spawnTarget * 0.2), label: 'SPITTERS' },
      { icon: '💣', count: Math.floor(spawnTarget * 0.1), label: 'EXPLODERS' },
    ],
  };
  const list = lineups[nightIdx] || lineups[3];
  try { showWavePreview({ wave: nightIdx, title: `NIGHT ${nightIdx}`, subtitle: 'HORDE INCOMING', enemies: list, duration: 2800, color: nightIdx >= 3 ? '#b055ff' : '#ff3aa1' }); } catch (e) { /* */ }
  _speedTog.setDisabled(false);
};
// Poll once per second to keep the toggle disabled outside the night phase.
setInterval(() => {
  if (!game) return;
  _speedTog.setDisabled(game.phase !== 'night' || !game.running);
}, 500);

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('WASD move · CLICK shoot · B for build menu · survive 3 nights', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
