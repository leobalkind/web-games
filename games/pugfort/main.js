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
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { htmlParallax as _depthHtmlParallax } from '../../src/shared/depth3D.js';
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'pugfort', getControlsHelp: () => _isTouch
  ? 'LEFT JOYSTICK move · RIGHT JOYSTICK aim · BUILD button · SHOP button · ⚡ SPEED TOGGLE top-right. Saved to your profile.'
  : 'WASD move · MOUSE aim · CLICK fire · B build menu · 1-9 build slots · ESC cancel · T speed toggle. Saved to your profile.' });

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

// Mute UI moved into the shared Settings panel (⚙ top-left). Legacy 🔊 button
// is hidden but its click handler is preserved as a safety net.
function applyMuteUI(muted) {
  if (!muteBtn) return;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
}
if (muteBtn) muteBtn.style.display = 'none';
const savedMute = localStorage.getItem('pugfort:muted') === '1';
Sfx.setMuted?.(savedMute);
applyMuteUI(savedMute);
muteBtn?.addEventListener('click', () => {
  const m = Sfx.toggleMute ? Sfx.toggleMute() : false;
  localStorage.setItem('pugfort:muted', m ? '1' : '0');
  applyMuteUI(m);
});
// M-key mute is now owned by settingsMenu (toggles global wg:settings:muted).

const game = new Game();
game.touchControls = touch;
game.gamepad = gp;

function hide(el) { el.hidden = true; el.classList.add('is-hidden'); }
function show(el) { el.hidden = false; el.classList.remove('is-hidden'); }

let _playInFlight = false;
async function play() {
  // Re-entry guard — the cutscene + game.start() are async and a fast
  // double-click on REMATCH would overlap two boots.
  if (_playInFlight) return;
  _playInFlight = true;
  try {
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
  } finally {
    _playInFlight = false;
  }
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
  document.body.classList.toggle('wg-modal-open', !!p);
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
pauseQuit?.addEventListener('click', () => {
  // Stop music + freeze ticker so audio doesn't bleed into the hub.
  try { Sfx.stopMusic?.(); } catch (e) { /* */ }
  try { if (game?.app?.ticker?.started) game.app.ticker.stop(); } catch (e) { /* */ }
  window.location.href = '../../index.html';
});
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
  // Pause only during actual gameplay — not during cutscene / start / end overlay.
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && game?.running
      && startOverlay.classList.contains('is-hidden') && endOverlay.classList.contains('is-hidden')) {
    e.preventDefault();
    setPaused(!paused);
  }
});
// Difficulty buttons — default matches the HTML's pre-active button (NORMAL).
const savedDiff = localStorage.getItem('pugfort:difficulty') || 'normal';
document.querySelectorAll('.diff-btn').forEach((btn) => {
  if (btn.dataset.diff === savedDiff) btn.classList.add('diff-btn--active');
  else btn.classList.remove('diff-btn--active');
  btn.addEventListener('click', () => {
    const d = btn.dataset.diff;
    localStorage.setItem('pugfort:difficulty', d);
    document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('diff-btn--active', b === btn));
  });
});

// Map picker — COURTYARD / ROOFTOP / UNDERGROUND
const savedMap = localStorage.getItem('pugfort:map') || 'courtyard';
document.querySelectorAll('.map-btn').forEach((btn) => {
  if (btn.dataset.map === savedMap) btn.classList.add('map-btn--active');
  else btn.classList.remove('map-btn--active');
  btn.addEventListener('click', () => {
    const m = btn.dataset.map;
    localStorage.setItem('pugfort:map', m);
    document.querySelectorAll('.map-btn').forEach((b) => b.classList.toggle('map-btn--active', b === btn));
  });
});

// Mode picker — 3 NIGHTS / ENDLESS
const savedMode = localStorage.getItem('pugfort:endless') === '1' ? 'endless' : '3nights';
document.querySelectorAll('.mode-btn').forEach((btn) => {
  if (btn.dataset.mode === savedMode) btn.classList.add('mode-btn--active');
  else btn.classList.remove('mode-btn--active');
  btn.addEventListener('click', () => {
    const m = btn.dataset.mode;
    localStorage.setItem('pugfort:endless', m === 'endless' ? '1' : '0');
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.toggle('mode-btn--active', b === btn));
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
  // Hook end-screen submission via observing the end overlay being shown.
  // _endMatch toggles BOTH the `hidden` attribute and the `is-hidden` class in
  // quick succession; without a guard the observer fires twice per match and
  // submits the run twice (inflating cumulative-nights for meta-unlocks).
  let _lastSubmitT = 0;
  const obs = new MutationObserver(() => {
    if (endOverlay.hidden || endOverlay.classList.contains('is-hidden')) return;
    const now = performance.now();
    if (now - _lastSubmitT < 1500) return; // de-dupe rapid attribute flips
    _lastSubmitT = now;
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
  // Enemy mix per night — Night 2+ now includes STEALTHED + SHIELDED. Endless
  // nights (4+) keep using night 3's composition with a TOTAL count label.
  const lineups = {
    1: [{ icon: '🐶', count: spawnTarget, label: 'WALKERS' }],
    2: [
      { icon: '🐶', count: Math.floor(spawnTarget * 0.45), label: 'WALKERS' },
      { icon: '🛡️', count: Math.floor(spawnTarget * 0.10), label: 'TANKS' },
      { icon: '🦠', count: Math.floor(spawnTarget * 0.10), label: 'SPITTERS' },
      { icon: '👻', count: Math.floor(spawnTarget * 0.07), label: 'STEALTHED' },
      { icon: '🛡', count: Math.floor(spawnTarget * 0.06), label: 'SHIELDED' },
    ],
    3: [
      { icon: '🐶', count: Math.floor(spawnTarget * 0.30), label: 'WALKERS' },
      { icon: '🛡️', count: Math.floor(spawnTarget * 0.14), label: 'TANKS' },
      { icon: '🦠', count: Math.floor(spawnTarget * 0.12), label: 'SPITTERS' },
      { icon: '💣', count: Math.floor(spawnTarget * 0.09), label: 'EXPLODERS' },
      { icon: '👻', count: Math.floor(spawnTarget * 0.08), label: 'STEALTHED' },
      { icon: '🛡', count: Math.floor(spawnTarget * 0.08), label: 'SHIELDED' },
    ],
  };
  let title = `NIGHT ${nightIdx}`;
  let subtitle = 'HORDE INCOMING';
  if (nightIdx >= 4) {
    title = `★ ENDLESS · NIGHT ${nightIdx} ★`;
    subtitle = `${spawnTarget} ENEMIES`;
  }
  const list = lineups[nightIdx] || lineups[3];
  try {
    showWavePreview({
      wave: nightIdx, title, subtitle,
      enemies: list, duration: 2800,
      color: nightIdx >= 3 ? '#b055ff' : '#ff3aa1',
    });
  } catch (e) { /* */ }
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
      showTip('WASD move · CLICK shoot · B build · R repair-all · TAB stats', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// ============ Stats overlay (TAB to toggle) ============
const pfStatsOv = document.getElementById('hud-stats-overlay');
const pfRefs = pfStatsOv ? {
  nights:      document.getElementById('pf-stat-nights'),
  time:        document.getElementById('pf-stat-time'),
  kills:       document.getElementById('pf-stat-kills'),
  walls:       document.getElementById('pf-stat-walls'),
  turrets:     document.getElementById('pf-stat-turrets'),
  gen:         document.getElementById('pf-stat-gen'),
  wood:        document.getElementById('pf-stat-wood'),
  scrap:       document.getElementById('pf-stat-scrap'),
  explosives:  document.getElementById('pf-stat-explosives'),
  electronics: document.getElementById('pf-stat-electronics'),
} : null;
let pfStatsOpen = false, pfStatsTimer = null;
function refreshPfStats() {
  if (!pfStatsOpen || !game?.running || !pfRefs) return;
  const t = game.matchTime || 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  pfRefs.time.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  pfRefs.nights.textContent      = game.nightsSurvived || 0;
  pfRefs.kills.textContent       = game.playerKills || 0;
  pfRefs.walls.textContent       = game.wallsBuilt || 0;
  pfRefs.turrets.textContent     = game.turretsBuilt || 0;
  pfRefs.gen.textContent         = game.generator
    ? `${Math.ceil(game.generator.hp)}/${game.generator.maxHp}` : '—';
  pfRefs.wood.textContent        = Math.floor(game.resources.wood || 0);
  pfRefs.scrap.textContent       = Math.floor(game.resources.scrap || 0);
  pfRefs.explosives.textContent  = Math.floor(game.resources.explosives || 0);
  pfRefs.electronics.textContent = Math.floor(game.resources.electronics || 0);
}
function setPfStatsOpen(open) {
  if (!pfStatsOv) return;
  pfStatsOpen = !!open;
  pfStatsOv.hidden = !pfStatsOpen;
  clearInterval(pfStatsTimer);
  if (pfStatsOpen) { refreshPfStats(); pfStatsTimer = setInterval(refreshPfStats, 250); }
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.repeat && game?.running) {
    e.preventDefault();
    setPfStatsOpen(!pfStatsOpen);
  }
});

// === Round 3B: start/end screen polish (fun-facts, new-best confetti, replay-prompt) ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: The GENERATOR must survive — protect it with walls.',
    'TIP: Spikes deal damage to zombies that touch them.',
    'TIP: Sniper turrets pick off threats from across the map.',
    'TIP: SHIELD modules absorb damage for the generator.',
    'LORE: The Kennel King rises every third night.',
    'TIP: Sprint uses stamina — wait for it to refill.',
    'JOKE: Why did the zombie pug cross the road? Brains.',
  ];
  const GAME_ID = 'pugfort';
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
        if (best && (best.nights || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.nights || 0} nights · ${best.kills || 0} kills`;
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
    el.hidden = dur > 45;
  }
  if (startOv) {
    const startUpdate = () => {
      const visible = !startOv.hidden && !startOv.classList.contains('is-hidden');
      if (visible) { refreshStartBest(); startFactLoop(); }
      else { stopFactLoop(); _runStart = performance.now(); }
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

// depth3D: HTML parallax horizon — city silhouette + low cloud band sit above
// the Pixi stage but below all HUD. Mouse-driven movement for fake 3D camera.
try {
  _depthHtmlParallax({
    layers: [
      // Distant city silhouette (slow drift)
      { speed: 0.15, html: '<div style="position:absolute;left:-5%;right:-5%;bottom:0;height:24%;background:linear-gradient(to top,#0a0716 0%,rgba(20,12,34,0.5) 70%,transparent 100%);"></div><div style="position:absolute;left:-5%;right:-5%;bottom:14%;height:8%;background-image:repeating-linear-gradient(to right,#1a0d2a 0,#1a0d2a 28px,transparent 28px,transparent 38px,#2a1640 38px,#2a1640 64px,transparent 64px,transparent 80px);opacity:0.7;"></div>' },
      // Cloud band over horizon
      { speed: 0.4, html: '<div style="position:absolute;left:-10%;right:-10%;top:10%;height:14%;background:radial-gradient(ellipse at 20% 50%, rgba(180,150,220,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.05) 0%, transparent 55%);"></div>' },
    ],
  });
} catch (e) { /* */ }
