import { Game } from './src/Game.js';
import { Sfx } from './src/Sfx.js';
import { createTouchControls } from '../../src/touch/touchControls.js';
import '../../src/touch/touchControls.css';
import { getGamepad } from '../../src/gamepad/gamepad.js';

const touch = createTouchControls({ enableAbility: true, abilityLabel: 'BUILD' });
if (touch.enabled) document.body.classList.add('is-touch');
const gp = getGamepad();

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
  await game.start();
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
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && startOverlay.classList.contains('is-hidden') && endOverlay.classList.contains('is-hidden')) {
    e.preventDefault();
    setPaused(!paused);
  }
});
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
