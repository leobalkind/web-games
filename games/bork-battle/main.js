import { Game } from './src/Game.js';
import { FORMS } from './src/pugForms.js';
import { WEAPONS, SKINS } from './src/weapons.js';
import { DIFFICULTIES } from './src/difficulty.js';
import { Sfx } from './src/Sfx.js';

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
// Boot is async; wrapped in IIFE so production build doesn't need top-level await.
// Once init resolves the Pixi app exists, so re-render the starter cards with real
// per-character previews (replacing the emoji fallback shown during boot).
(async () => {
  await game.init(root);
  renderStarters();
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
}

restartBtn.addEventListener('click', () => {
  hide(endOverlay);
  show(startOverlay);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !startOverlay.classList.contains('is-hidden')) {
    play();
  }
});
