import { Game } from './src/Game.js';
import { FORMS } from './src/pugForms.js';
import { WEAPONS, SKINS } from './src/weapons.js';
import { DIFFICULTIES } from './src/difficulty.js';
import { Sfx } from './src/Sfx.js';
import { createTouchControls } from '../../src/touch/touchControls.js';
import '../../src/touch/touchControls.css';
import { getGamepad } from '../../src/gamepad/gamepad.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';

import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon, iconSvg } from '../../src/shared/icons.js';
import { createSpeedToggle } from '../../src/shared/speedToggle.js';
import { createKillFeed } from '../../src/shared/killFeed.js';
import { showWavePreview } from '../../src/shared/wavePreview.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'bork-battle', getControlsHelp: () => _isTouch
  ? 'LEFT JOYSTICK move · RIGHT JOYSTICK aim · BORK / DASH / DECOY / HEAL buttons · 🛒 SHOP top-right. Saved to your profile.'
  : 'WASD move · MOUSE aim · CLICK fire · SPACE BORK · E dash · Q decoy · R heal · B shop · T speed toggle. Saved to your profile.' });

// Detect touch device + create overlay controls (no-op on desktop)
const touch = createTouchControls({ enableAbility: true, abilityLabel: 'BORK' });
if (touch.enabled) document.body.classList.add('is-touch');
const gp = getGamepad();
// Universal mobile-controls overlay — for aim/fire bork-battle, the existing
// dual-stick `touch` handles move+aim+fire; we add right-hand action buttons
// (RELOAD, SHOP) on top so mobile users can reach them without keyboard.
createMobileControls({
  layout: 'single-tap',
  buttons: [
    { id: 'reload', label: 'RELOAD', key: 'R' },
    { id: 'shop',   label: 'SHOP',   key: 'B' },
  ],
});

const root = document.getElementById('game-root');
const startOverlay = document.getElementById('overlay');
const endOverlay = document.getElementById('end-overlay');
const restartBtn = document.getElementById('end-restart');
const starterChoices = document.getElementById('starter-choices');
const muteBtn = document.getElementById('mute-btn');

// Mute UI now lives in the shared Settings panel (⚙ top-left). Hide the legacy
// 🔊 button to avoid duplicate controls, but keep clicks functional so any
// holdout muscle memory still works. Persisted per-game `bork:muted` is read at
// boot to honour the user's previous choice.
function applyMuteUI(muted) {
  if (!muteBtn) return;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
}
if (muteBtn) muteBtn.style.display = 'none';
const savedMute = localStorage.getItem('bork:muted') === '1';
Sfx.setMuted(savedMute);
applyMuteUI(savedMute);
muteBtn?.addEventListener('click', () => {
  const m = Sfx.toggleMute();
  localStorage.setItem('bork:muted', m ? '1' : '0');
  applyMuteUI(m);
});
// M-key mute is now owned by settingsMenu (toggles global wg:settings:muted).

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
// `iconName` resolves to the shared pixel-art icon library; `emoji` is kept as
// a last-resort fallback if the icon library ever fails to load.
const STARTERS = [
  { id: 'bork_pup',   iconName: 'pugFace',   emoji: '🐶', tag: 'PUPPY',     hint: 'Tiny + speedy. Pure chaos potato.' },
  { id: 'loaf',       iconName: 'biscuit',   emoji: '🍞', tag: 'TANK',      hint: 'Bread tank. Slow but THICC.' },
  { id: 'snoot',      iconName: 'pugFace',   emoji: '👃', tag: 'SHARPSHOOT', hint: 'Stretchy snoot. Fast fire.' },
  { id: 'zoom',       iconName: 'lightning', emoji: '💨', tag: 'SPEED',     hint: 'Rocket-skate. Pure zoom.' },
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
    const iconHtml = (d.iconName && iconSvg[d.iconName])
      ? `<span class="loadout-btn__icon">${iconSvg[d.iconName](20)}</span>`
      : `<span>${d.icon}</span>`;
    btn.innerHTML = `${iconHtml}<span>${d.name}</span>`;
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
    const iconHtml = (w.iconName && iconSvg[w.iconName])
      ? `<span class="loadout-btn__icon">${iconSvg[w.iconName](20)}</span>`
      : `<span>${w.icon}</span>`;
    btn.innerHTML = `${iconHtml}<span>${w.name}</span>`;
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
    else if (s.iconName && drawIcon[s.iconName]) {
      // Render the shared pixel-art icon onto a small canvas as a fallback
      // (instead of the raw emoji) while Pixi is still initializing.
      const fb = document.createElement('canvas');
      fb.width = 64; fb.height = 64;
      fb.style.cssText = 'width:64px;height:64px;image-rendering:pixelated;';
      drawIcon[s.iconName](fb.getContext('2d'), 32, 32, 56);
      previewEl.appendChild(fb);
    }
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

let _playInFlight = false;
async function play() {
  // Guard against rapid double-click / Enter-spam — start() is async so two
  // overlapping calls could leak Pixi containers from the first match.
  if (_playInFlight) return;
  _playInFlight = true;
  try {
    hide(startOverlay);
    hide(endOverlay);
    // Wipe stale kill-feed lines + zone-warn flags from a previous match.
    try { __borkFeed.clear(); } catch (e) { /* */ }
    __zoneWarnSent = false; __zoneFinalSent = false;
    await game.start(chosenStarter, chosenWeapon, chosenSkin, chosenDifficulty);
    // Defensively unpause + restart ticker (in case any prior interaction stopped it)
    if (typeof paused !== 'undefined' && paused) setPaused(false);
    if (game?.app?.ticker && !game.app.ticker.started) game.app.ticker.start();
    if (pauseOverlay) pauseOverlay.hidden = true;
    // Background music starts when match starts
    if (localStorage.getItem('wg:music') !== '0') Sfx.startMusic?.();
  } finally {
    _playInFlight = false;
  }
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
pauseQuit?.addEventListener('click', () => {
  // Stop music / freeze ticker before nav so audio doesn't echo over the hub.
  try { Sfx.stopMusic?.(); } catch (e) { /* */ }
  try { if (game?.app?.ticker?.started) game.app.ticker.stop(); } catch (e) { /* */ }
  window.location.href = '../../index.html';
});

// ===== MID-MATCH ARMOURY SHOP =====
const shopBtn = document.getElementById('bork-shop-btn');
const shopModal = document.getElementById('bork-shop-modal');
const shopClose = document.getElementById('bork-shop-close');
const shopMoneyEl = document.getElementById('bork-shop-money');
const shopListEl = document.getElementById('bork-shop-list');
let shopOpen = false;

function renderShopList() {
  if (!shopListEl) return;
  const money = Math.floor(game?.player?.money || 0);
  if (shopMoneyEl) shopMoneyEl.textContent = money;
  shopListEl.innerHTML = '';
  if (!Game?.SHOP_BUYS) return;
  for (const def of Game.SHOP_BUYS) {
    const canBuy = money >= def.cost;
    const row = document.createElement('div');
    row.className = 'bork-shop-row';
    row.innerHTML = `
      <div class="bork-shop-row__icon">${def.icon}</div>
      <div class="bork-shop-row__body">
        <div class="bork-shop-row__name">${def.name}</div>
        <div class="bork-shop-row__desc">${def.desc}</div>
      </div>
      <button class="bork-shop-row__btn" ${canBuy ? '' : 'disabled'}>$${def.cost}</button>
    `;
    if (canBuy) {
      row.querySelector('button').addEventListener('click', () => {
        if (game.buyShopItem(def.id)) renderShopList();
      });
    }
    shopListEl.appendChild(row);
  }
}
function openShopModal() {
  if (!game?.running) return;
  shopOpen = true;
  shopModal.hidden = false;
  // Stop the Pixi ticker directly so the world freezes (no pause panel shown).
  if (game?.app?.ticker?.started) game.app.ticker.stop();
  renderShopList();
}
function closeShopModal() {
  shopOpen = false;
  shopModal.hidden = true;
  // Resume Pixi ticker only if the user-pause overlay isn't active.
  if (!paused && game?.app?.ticker && !game.app.ticker.started) game.app.ticker.start();
}
shopBtn?.addEventListener('click', openShopModal);
shopClose?.addEventListener('click', closeShopModal);
shopModal?.addEventListener('click', (e) => { if (e.target === shopModal) closeShopModal(); });

// Keyboard shortcut: B opens shop (mirrors pug-cafe / pugzilla / supermarket).
// Guarded against evolve-menu / pause overlay so the shop can't stack on top.
window.addEventListener('keydown', (e) => {
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if ((e.key === 'b' || e.key === 'B') && game?.running && !game?.evolving && !paused) {
    e.preventDefault();
    if (shopOpen) closeShopModal(); else openShopModal();
  }
});

// Keep button label fresh (shows current money) + toggle visibility with game state
function _shopBtnLoop() {
  if (shopBtn) {
    // Hide during evolve menu / user pause / shop modal already open
    const evolveOpen = !document.getElementById('evolve-overlay')?.hidden;
    const visible = !!(game?.running && game?.player?.alive && !paused && !shopOpen && !evolveOpen);
    shopBtn.hidden = !visible;
    if (visible) shopBtn.textContent = `🛒 SHOP $${Math.floor(game.player.money || 0)}`;
  }
  requestAnimationFrame(_shopBtnLoop);
}
_shopBtnLoop();
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
      showTip('MOUSE aim · CLICK fire · SPACE BORK · E dash · Q decoy · R heal', 6500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// ============ Touch ability buttons (DASH / DECOY / HEAL) ============
// Built in DOM (not in shared touchControls.js) to avoid edits to shared code.
// Stack above the existing BORK button on the right edge.
if (touch.enabled) {
  const wrap = document.createElement('div');
  wrap.className = 'touch-ability-extra';
  // Position above the shared .touch-ability button (which sits bottom: 200px,
  // size 84x84). Stack 3 chips (54px + 10px gap = 64px tall each) above it.
  wrap.style.bottom = 'calc(300px + env(safe-area-inset-bottom, 0))';
  wrap.innerHTML = `
    <button type="button" class="touch-ability-extra__btn" id="touch-btn-dash"  aria-label="Dash">DASH</button>
    <button type="button" class="touch-ability-extra__btn" id="touch-btn-decoy" aria-label="Decoy">DECOY</button>
    <button type="button" class="touch-ability-extra__btn" id="touch-btn-heal"  aria-label="Heal">HEAL</button>
  `;
  document.body.appendChild(wrap);
  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = (ev) => {
      ev.preventDefault();
      if (!game?.input) return;
      fn(game.input);
    };
    el.addEventListener('pointerdown', handler, { passive: false });
  };
  bind('touch-btn-dash',  (input) => input.triggerTouchE());
  bind('touch-btn-decoy', (input) => input.triggerTouchQ());
  bind('touch-btn-heal',  (input) => input.triggerTouchR());
}

// ============ Shared utilities: speed toggle + kill feed + zone preview ============
// Speed toggle is only enabled when a match is running (Game.running === true).
// Zone-warn preview fires once when the danger zone starts shrinking and once
// just before the "final" tight zone is reached.
const __borkSpeed = createSpeedToggle({ onChange: (m) => { if (game) game._speedMult = m; } });
__borkSpeed.setDisabled(true);
const __borkFeed = createKillFeed({ maxLines: 5, lifespan: 5000 });

game.onKillFeed = ({ killer, victim, byZone, weaponName, weaponIcon }) => {
  // Surviv.io-style: "{icon} Killer borked Victim · WEAPON"
  // Zone / tornado deaths skip the weapon tag and use a hazard marker.
  const v = victim?.name || '?';
  if (!killer && byZone) {
    __borkFeed.push(`☣ THE ZONE ▶ ${v}`, '#ff3aa1');
    return;
  }
  if (!killer) {
    // Tornado / environmental kill — no shooter, not byZone.
    __borkFeed.push(`🌪 THE TORNADO ▶ ${v}`, '#b055ff');
    return;
  }
  const k = killer.name || '?';
  const color = killer === game.player ? '#5ef38c'
              : victim === game.player ? '#ff3a3a'
              : '#c8c0e8';
  const icon = weaponIcon || '🐾';
  const wpn = (weaponName || 'BORK').toUpperCase();
  __borkFeed.push(`${icon} ${k} borked ${v} · ${wpn}`, color);
};
game.onLevelUp = (lvl) => {
  try { __borkFeed.push(`★ LEVEL UP ${lvl} ★`, '#ffd23f'); } catch (e) { /* */ }
};

// Watch World.zone.shrinkStart to fire zone-warning previews. World is created
// inside game.start(), so poll for it.
let __zoneWarnSent = false, __zoneFinalSent = false;
setInterval(() => {
  if (!game) return;
  __borkSpeed.setDisabled(!game.running || !!game.evolving);
  const w = game.world;
  if (!w || !w.zone || !game.running) { __zoneWarnSent = false; __zoneFinalSent = false; return; }
  const z = w.zone;
  const t = game.matchTime || 0;
  // 5-second pre-warn before shrink starts
  if (!__zoneWarnSent && t > Math.max(0, z.shrinkStart - 5) && t < z.shrinkStart) {
    __zoneWarnSent = true;
    showWavePreview({
      title: 'ZONE CLOSING',
      subtitle: 'Stay in the safe area',
      enemies: [{ icon: '⚠', count: null, label: 'INCOMING' }],
      duration: 2400,
      color: '#ff3aa1',
    });
  }
  // 5-second pre-warn before final shrink
  if (!__zoneFinalSent && t > Math.max(0, z.shrinkEnd - 5) && t < z.shrinkEnd) {
    __zoneFinalSent = true;
    showWavePreview({
      title: 'FINAL ZONE',
      subtitle: 'No more safe ground',
      enemies: [{ icon: '☠', count: null, label: 'LAST STAND' }],
      duration: 2400,
      color: '#b055ff',
    });
  }
}, 400);
