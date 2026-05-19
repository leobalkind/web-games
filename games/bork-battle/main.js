import { Game } from './src/Game.js';
import { FORMS } from './src/pugForms.js';
import { WEAPONS, SKINS } from './src/weapons.js';
import { DIFFICULTIES } from './src/difficulty.js';
import { Sfx } from './src/Sfx.js';
import { createTouchControls } from '../../src/touch/touchControls.js';
import '../../src/touch/touchControls.css';
import { getGamepad } from '../../src/gamepad/gamepad.js';

import { showTip } from '../../src/shared/tutorialTip.js';

// Detect touch device + create overlay controls (no-op on desktop)
const touch = createTouchControls({ enableAbility: true, abilityLabel: 'BORK' });
if (touch.enabled) document.body.classList.add('is-touch');
const gp = getGamepad();

const root = document.getElementById('game-root');
const startOverlay = document.getElementById('overlay');
const endOverlay = document.getElementById('end-overlay');
const restartBtn = document.getElementById('end-restart');
const starterChoices = document.getElementById('starter-choices');
const muteBtn = document.getElementById('mute-btn');

// Mute toggle — persists across sessions
function applyMuteUI(muted) {
  if (!muteBtn) return;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
}
const savedMute = localStorage.getItem('bork:muted') === '1';
Sfx.setMuted(savedMute);
applyMuteUI(savedMute);
muteBtn?.addEventListener('click', () => {
  const m = Sfx.toggleMute();
  localStorage.setItem('bork:muted', m ? '1' : '0');
  applyMuteUI(m);
});
window.addEventListener('keydown', (e) => {
  // Don't trigger when typing in inputs
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === 'm' || e.key === 'M') {
    const m = Sfx.toggleMute();
    localStorage.setItem('bork:muted', m ? '1' : '0');
    applyMuteUI(m);
  }
});

const game = new Game();
game.touchControls = touch;
game.gamepad = gp;
// Boot is async; wrapped in IIFE so production build doesn't need top-level await.
// Once init resolves the Pixi app exists, so re-render the starter cards with real
// per-character previews (replacing the emoji fallback shown during boot).
(async () => {
  await game.init(root);
  renderStarters();
  // Hide loading screen once Pixi is up
  const ls = document.getElementById('loading-screen');
  if (ls) ls.hidden = true;
})();

// Available starter forms — the puppy + 3 Tier 1 quick-picks
const STARTERS = [
  { id: 'bork_pup',   emoji: '🐶', tag: 'PUPPY',     hint: 'Tiny + speedy. Pure chaos potato.' },
  { id: 'loaf',       emoji: '🍞', tag: 'TANK',      hint: 'Bread tank. Slow but THICC.' },
  { id: 'snoot',      emoji: '👃', tag: 'SHARPSHOOT', hint: 'Stretchy snoot. Fast fire.' },
  { id: 'zoom',       emoji: '💨', tag: 'SPEED',     hint: 'Rocket-skate. Pure zoom.' },
];

let chosenStarter = 'bork_pup';
let chosenWeapon = 'pistol';
let chosenSkin = 'default';
let chosenDifficulty = 'normal';

const weaponChoicesEl = document.getElementById('weapon-choices');
const skinChoicesEl = document.getElementById('skin-choices');
const difficultyChoicesEl = document.getElementById('difficulty-choices');

function renderDifficulty() {
  difficultyChoicesEl.innerHTML = '';
  for (const id of ['easy', 'normal', 'hard']) {
    const d = DIFFICULTIES[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loadout-btn loadout-btn--diff loadout-btn--diff-' + id
      + (chosenDifficulty === id ? ' active' : '');
    btn.innerHTML = `<span>${d.icon}</span><span>${d.name}</span>`;
    btn.title = `${d.desc}\nbot HP×${d.botHpMult}  bot DMG×${d.botDmgMult}  player HP×${d.playerHpMult}  player DMG×${d.playerDmgMult}  XP×${d.xpMult}  $×${d.moneyMult}`;
    btn.addEventListener('click', () => { chosenDifficulty = id; renderDifficulty(); });
    difficultyChoicesEl.appendChild(btn);
  }
}

function renderWeapons() {
  weaponChoicesEl.innerHTML = '';
  for (const wid of Object.keys(WEAPONS)) {
    const w = WEAPONS[wid];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loadout-btn' + (chosenWeapon === wid ? ' active' : '');
    btn.innerHTML = `<span>${w.icon}</span><span>${w.name}</span>`;
    btn.title = `${w.desc}\nDMG ×${w.dmgMult}  FR ×${w.fireRateMult}  MAG ${w.magSize}  RELOAD ${w.reloadTime}s${w.pellets > 1 ? `  PELLETS ${w.pellets}` : ''}`;
    btn.addEventListener('click', () => { chosenWeapon = wid; renderWeapons(); });
    weaponChoicesEl.appendChild(btn);
  }
}

function renderSkins() {
  skinChoicesEl.innerHTML = '';
  for (const sid of Object.keys(SKINS)) {
    const s = SKINS[sid];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loadout-btn' + (chosenSkin === sid ? ' active' : '');
    const swatch = `<span class="skin-swatch" style="background:#${s.swatch.toString(16).padStart(6, '0')}"></span>`;
    btn.innerHTML = `${swatch}<span>${s.name}</span>`;
    btn.addEventListener('click', () => { chosenSkin = sid; renderSkins(); });
    skinChoicesEl.appendChild(btn);
  }
}

renderWeapons();
renderSkins();
renderDifficulty();

function renderStarters() {
  starterChoices.innerHTML = '';
  for (const s of STARTERS) {
    const f = FORMS[s.id];
    const card = document.createElement('div');
    card.className = 'evolve-card';
    card.innerHTML = `
      <div class="evolve-card__preview"></div>
      <h3 class="evolve-card__name">${f.name}</h3>
      <div class="evolve-card__desc">
        <b>${s.tag}</b><br>
        ${s.hint}<br>
        <b>HP</b> ${f.hp} · <b>SPD</b> ${f.speed}
      </div>
    `;
    const previewEl = card.querySelector('.evolve-card__preview');
    const canvas = game._renderFormPreview(s.id);
    if (canvas) previewEl.appendChild(canvas);
    else previewEl.innerHTML = `<div style="font-size:54px;line-height:1;">${s.emoji}</div>`;
    card.addEventListener('click', () => {
      chosenStarter = s.id;
      play();
    });
    starterChoices.appendChild(card);
  }
}

renderStarters();

function hide(el) { el.hidden = true; el.classList.add('is-hidden'); }
function show(el) { el.hidden = false; el.classList.remove('is-hidden'); }

async function play() {
  hide(startOverlay);
  hide(endOverlay);
  await game.start(chosenStarter, chosenWeapon, chosenSkin, chosenDifficulty);
  // Defensively unpause + restart ticker (in case any prior interaction stopped it)
  if (typeof paused !== 'undefined' && paused) setPaused(false);
  if (game?.app?.ticker && !game.app.ticker.started) game.app.ticker.start();
  if (pauseOverlay) pauseOverlay.hidden = true;
  // Background music starts when match starts
  if (localStorage.getItem('wg:music') !== '0') Sfx.startMusic?.();
}

// REMATCH — replay same loadout instantly
restartBtn.addEventListener('click', () => { play(); });
// START SCREEN — go back to character/loadout picker
document.getElementById('end-back')?.addEventListener('click', () => {
  hide(endOverlay);
  show(startOverlay);
});
// Share — copy stats text + URL to clipboard
document.getElementById('end-share')?.addEventListener('click', async () => {
  const form = document.getElementById('end-form')?.textContent || '?';
  const kills = document.getElementById('end-kills')?.textContent || '0';
  const time = document.getElementById('end-time')?.textContent || '0:00';
  const text = `🐶 BORK BATTLE — I got ${kills} kills as ${form} in ${time}! Beat me at https://leobalkind.github.io/web-games/`;
  const btn = document.getElementById('end-share');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'BORK BATTLE', text, url: 'https://leobalkind.github.io/web-games/' });
    } else {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ COPIED!';
      setTimeout(() => { btn.textContent = '📋 SHARE'; }, 2000);
    }
  } catch (err) {
    console.warn('Share failed', err);
    btn.textContent = '⚠ FAILED';
    setTimeout(() => { btn.textContent = '📋 SHARE'; }, 2000);
  }
});

// ============ Pause menu ============
const pauseOverlay = document.getElementById('pause-overlay');
const pauseBtn = document.getElementById('pause-btn');
const pauseResume = document.getElementById('pause-resume');
const pauseMute = document.getElementById('pause-mute');
const pauseLarge = document.getElementById('pause-large-text');
const pauseQuit = document.getElementById('pause-quit');
let paused = false;

function setPaused(p) {
  paused = p;
  if (!pauseOverlay) return;
  pauseOverlay.hidden = !p;
  if (game && game.app && game.app.ticker) {
    if (p) game.app.ticker.stop(); else game.app.ticker.start();
  }
  // Refresh button states
  if (pauseMute) pauseMute.textContent = Sfx.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
  if (pauseLarge) pauseLarge.textContent = document.body.classList.contains('large-text') ? 'LARGE TEXT: ON' : 'LARGE TEXT: OFF';
}
pauseBtn?.addEventListener('click', () => setPaused(!paused));
pauseResume?.addEventListener('click', () => setPaused(false));
pauseMute?.addEventListener('click', () => {
  const m = Sfx.toggleMute();
  localStorage.setItem('bork:muted', m ? '1' : '0');
  applyMuteUI(m);
  pauseMute.textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
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
  a.download = `bork-battle-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});
window.addEventListener('keydown', (e) => {
  // Both ESC and P toggle pause, but ONLY during an active match
  // (start overlay hidden = game running)
  const gameRunning = startOverlay.classList.contains('is-hidden');
  if (!gameRunning) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    setPaused(!paused);
  }
});

// Restore accessibility preferences from hub-wide settings
if (localStorage.getItem('wg:large-text') === '1') document.body.classList.add('large-text');
if (localStorage.getItem('wg:reduced-motion') === '1') document.body.classList.add('reduced-motion');
if (localStorage.getItem('wg:colorblind') === '1') document.body.classList.add('colorblind');

// ============ Konami code: ↑↑↓↓←→←→BA — unlocks GOD MODE ============
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiBuffer = [];
window.addEventListener('keydown', (e) => {
  konamiBuffer.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (konamiBuffer.length > KONAMI.length) konamiBuffer.shift();
  if (konamiBuffer.length === KONAMI.length && konamiBuffer.every((k, i) => k === KONAMI[i])) {
    konamiBuffer = [];
    document.body.classList.add('konami-active');
    if (game && game.player) {
      game.player.maxHp = 9999;
      game.player.hp = 9999;
      if (game.hud && game.hud.toastMessage) game.hud.toastMessage('🌈 KONAMI! GOD MODE: HP ×100', 'kill');
    } else {
      alert('🌈 KONAMI! GOD MODE will activate when you start a match.');
    }
  }
});

// Show personal best on start screen
import('../../src/persistence/highScores.js').then(({ loadBest }) => {
  const best = loadBest('bork-battle');
  if (!best) return;
  const sub = document.querySelector('#overlay .overlay__sub');
  if (sub && !document.getElementById('best-line')) {
    const div = document.createElement('div');
    div.id = 'best-line';
    div.style.cssText = 'margin:10px 0 0;color:var(--neon-yellow);font-size:0.6rem;letter-spacing:0.05em;';
    div.innerHTML = `★ Personal best: <b>${best.kills}</b> kills as <b>${best.form}</b>`;
    sub.appendChild(div);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !startOverlay.classList.contains('is-hidden')) {
    play();
  }
});

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('MOUSE aim · CLICK fire · SPACE hold = BORK · WASD drive', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
