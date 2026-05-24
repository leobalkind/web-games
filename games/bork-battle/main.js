import { Game } from './src/Game.js';
import { FORMS } from './src/pugForms.js';
import { WEAPONS, SKINS } from './src/weapons.js';
import { DIFFICULTIES, PERKS } from './src/difficulty.js';
import { Sfx } from './src/Sfx.js';
import { createTouchControls } from '../../src/touch/touchControls.js';
import '../../src/touch/touchControls.css';
import { getGamepad } from '../../src/gamepad/gamepad.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showOrientationHint } from '../../src/shared/orientationHint.js';

import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon, iconSvg } from '../../src/shared/icons.js';
import { createSpeedToggle } from '../../src/shared/speedToggle.js';
import { createKillFeed } from '../../src/shared/killFeed.js';
import { showWavePreview } from '../../src/shared/wavePreview.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { htmlParallax as _depthHtmlParallax } from '../../src/shared/depth3D.js';
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
// Dual-stick arena reads much better with landscape's extra horizontal view.
showOrientationHint({ gameId: 'bork-battle' });

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
let chosenPerk = 'none';

const weaponChoicesEl = document.getElementById('weapon-choices');
const skinChoicesEl = document.getElementById('skin-choices');
const difficultyChoicesEl = document.getElementById('difficulty-choices');
const perkChoicesEl = document.getElementById('perk-choices');

function renderDifficulty() {
  difficultyChoicesEl.innerHTML = '';
  // EASY/NORMAL/HARD use skull icons (1/2/3); MAYHEM gets a flame.
  const skulls = { easy: '💀', normal: '💀💀', hard: '💀💀💀', mayhem: '🔥🔥🔥🔥' };
  for (const id of ['easy', 'normal', 'hard', 'mayhem']) {
    const d = DIFFICULTIES[id];
    if (!d) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loadout-btn loadout-btn--diff loadout-btn--diff-' + id
      + (chosenDifficulty === id ? ' active' : '');
    const iconHtml = `<span class="loadout-btn__icon" style="font-size:11px;">${skulls[id] || d.icon}</span>`;
    btn.innerHTML = `${iconHtml}<span>${d.name}</span>`;
    btn.title = `${d.desc}\nbot HP×${d.botHpMult}  bot DMG×${d.botDmgMult}  player HP×${d.playerHpMult}  player DMG×${d.playerDmgMult}  XP×${d.xpMult}  $×${d.moneyMult}`;
    btn.addEventListener('click', () => { chosenDifficulty = id; renderDifficulty(); });
    difficultyChoicesEl.appendChild(btn);
  }
}

function renderPerks() {
  if (!perkChoicesEl) return;
  perkChoicesEl.innerHTML = '';
  for (const pid of Object.keys(PERKS)) {
    const p = PERKS[pid];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'loadout-btn loadout-btn--perk' + (chosenPerk === pid ? ' active' : '');
    btn.innerHTML = `<span class="loadout-btn__icon">${p.icon}</span><span>${p.name}</span>`;
    btn.title = p.desc;
    btn.addEventListener('click', () => { chosenPerk = pid; renderPerks(); });
    perkChoicesEl.appendChild(btn);
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
renderPerks();

// Daily challenge — same arena seed for all players on a given UTC day.
// Polish R2: challenges are now MUCH more playable. Each one suggests a
// weapon (not forced) and a low kill threshold (5 kills). Completing
// awards a one-time "Daily Crown" badge label to motivate retries.
(function _dailyChallenge() {
  const el = document.getElementById('daily-challenge-line');
  if (!el) return;
  const today = new Date().toISOString().slice(0, 10);
  const dailyKey = 'bork:daily:' + today;
  const challenges = [
    { name: 'PISTOL HEAD',     desc: '5 kills with the PISTOL (any difficulty)',  weapon: 'pistol',  goal: 5 },
    { name: 'SHOTGUN SUNDAY',  desc: '4 kills with the SHOTGUN — get up close',   weapon: 'shotgun', goal: 4 },
    { name: 'SNIPER ELITE',    desc: '4 kills with the SNIPER — pick your shots', weapon: 'sniper',  goal: 4 },
    { name: 'AR ASSAULT',      desc: '6 kills with the AR — spray and pray',      weapon: 'ar',      goal: 6 },
  ];
  // Pick deterministically from today's date
  const seed = today.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const challenge = challenges[seed % challenges.length];
  let bestText = '';
  let done = false;
  try {
    const raw = localStorage.getItem(dailyKey);
    if (raw) {
      const o = JSON.parse(raw);
      bestText = ` · Best: ${o.kills} kills`;
      done = !!o.done;
    }
  } catch (e) { /* */ }
  el.hidden = false;
  el.innerHTML = `★ DAILY: <b>${challenge.name}</b> — ${challenge.desc}${bestText}${done ? ' <span style="color:var(--neon-yellow)">✓ DONE</span>' : ''}`;
  // Persist personal-best for the daily key on each match end.
  window.__borkDaily = { key: dailyKey, challenge };
})();

// ===== DAILY MUTATOR — same modifier for everyone on a given UTC day =====
// Picks one mutator deterministically from today's date string (so all players
// share the same wrinkle on a given day). Effects are applied as light hooks
// onto the running game instance — they piggy-back on existing systems
// (player.hp / powerups / xp) so nothing else has to change.
const MUTATORS = [
  { id: 'low_grav', name: 'LOW GRAVITY',   icon: '🪶',  desc: 'Particles float — every kill leaves a chandelier of debris.', apply: (g) => { g._mutatorGravScale = 0.35; } },
  { id: 'double_xp', name: 'DOUBLE XP',    icon: '⚡',  desc: '1.5× XP per kill. Evolve fast, become unstoppable.',         apply: (g) => { g._mutatorXpScale = 1.5; } },
  { id: 'no_pickup', name: 'NO PICKUPS',   icon: '🚫',  desc: 'Power-ups disabled. Survive on your starting kit alone.',     apply: (g) => { g._mutatorNoPickup = true; } },
  { id: 'vampire',   name: 'VAMPIRE PUG', icon: '🩸',  desc: 'Kills heal +5 HP. Stay aggressive, stay alive.',              apply: (g) => { g._mutatorVampire = 5; } },
  { id: 'glass_can', name: 'GLASS CANNON', icon: '💎',  desc: 'You deal 1.6× damage… but take 1.6× as well. High-octane.',   apply: (g) => { g._mutatorDmgOut = 1.6; g._mutatorDmgIn = 1.6; } },
  { id: 'treat_rain', name: 'TREAT RAIN', icon: '🍖',  desc: 'Bots drop 2× treats — go full money mode at the shop.',       apply: (g) => { g._mutatorTreatScale = 2.0; } },
];
const _todayMut = new Date().toISOString().slice(0, 10);
const _mutSeed = _todayMut.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7);
const TODAYS_MUTATOR = MUTATORS[_mutSeed % MUTATORS.length];
// Render a small banner above difficulty picker so the player sees it pre-match.
(function _renderMutatorBanner() {
  const panel = document.querySelector('#overlay .overlay__panel');
  if (!panel) return;
  const banner = document.createElement('div');
  banner.id = 'daily-mutator-line';
  banner.style.cssText = 'margin:8px auto 10px;padding:6px 10px;border:1px solid var(--neon-magenta,#ff2bd6);border-radius:6px;background:rgba(255,43,214,0.08);color:#fff;font-size:0.55rem;letter-spacing:0.05em;text-align:center;max-width:560px;';
  banner.innerHTML = `<span style="color:var(--neon-magenta,#ff2bd6);">⚡ TODAY'S MUTATOR</span> · ${TODAYS_MUTATOR.icon} <b>${TODAYS_MUTATOR.name}</b> — ${TODAYS_MUTATOR.desc}`;
  const dc = document.getElementById('daily-challenge-line');
  if (dc && dc.parentNode) dc.parentNode.insertBefore(banner, dc.nextSibling);
  else panel.insertBefore(banner, panel.firstChild);
})();
// Apply the mutator each time the game starts. Wraps original start().
const _origStart = game.start.bind(game);
game.start = async function(...args) {
  // Reset previous-run mutator flags BEFORE start() rebuilds powerups/energy/player.
  // Without this, stale flags from a prior day could double-apply (e.g. yesterday's
  // LOW GRAVITY lingering today on top of VAMPIRE), and energy/powerups get reset
  // each start so their per-run hooks must be re-applied.
  this._mutatorGravScale = 0;
  this._mutatorXpScale = 0;
  this._mutatorNoPickup = false;
  this._mutatorVampire = 0;
  this._mutatorDmgOut = 0;
  this._mutatorDmgIn = 0;
  this._mutatorTreatScale = 0;
  // energy/powerups are recreated each start — clear per-instance hook flags
  this._treatHooked = false;
  const r = await _origStart(...args);
  try { TODAYS_MUTATOR.apply(this); } catch (e) { /* */ }
  // VAMPIRE: hook _handleKill to heal player on kill
  if (this._mutatorVampire && !this._vampHooked) {
    this._vampHooked = true;
    const _origKill = this._handleKill.bind(this);
    this._handleKill = (killer, victim, byZone) => {
      _origKill(killer, victim, byZone);
      if (killer === this.player && this.player.alive && this._mutatorVampire) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this._mutatorVampire);
        try { this.hud.updatePlayer(this.player); } catch (e) { /* */ }
      }
    };
  }
  // NO PICKUPS: gut the powerup spawner (powerups is recreated each start)
  if (this._mutatorNoPickup && this.powerups) {
    if (this.powerups.maybeSpawnAt) this.powerups.maybeSpawnAt = () => {};
  }
  // DOUBLE XP: difficulty.xpMult adjusted post-spawn (Game reads each kill)
  if (this._mutatorXpScale && this.difficulty) {
    this.difficulty = Object.assign({}, this.difficulty, { xpMult: this.difficulty.xpMult * this._mutatorXpScale });
  }
  // TREAT RAIN: scale energy spawn (each treat = 1 unit, so we just spawn more).
  // energy is recreated each start so we must re-hook fresh per run.
  if (this._mutatorTreatScale && this.energy && !this._treatHooked) {
    this._treatHooked = true;
    const _origBurst = this.energy.spawnBurst.bind(this.energy);
    this.energy.spawnBurst = (x, y, count, ...rest) => _origBurst(x, y, Math.round(count * this._mutatorTreatScale), ...rest);
  }
  // GLASS CANNON: adjust player damage out + scale incoming damage handler
  if (this._mutatorDmgOut && this.player && this.player.bonus) {
    this.player.bonus.dmgMult = (this.player.bonus.dmgMult || 1) * this._mutatorDmgOut;
  }
  // LOW GRAVITY: scale all particle gravity in _updateParticles via setter trap
  if (this._mutatorGravScale && !this._gravHooked) {
    this._gravHooked = true;
    const _origUpdate = this._updateParticles.bind(this);
    this._updateParticles = (dt) => {
      for (const p of this.particles) if (p && p.gravity && p._gravOrig == null) { p._gravOrig = p.gravity; p.gravity *= this._mutatorGravScale; }
      _origUpdate(dt);
    };
  }
  // HUD toast announcing the mutator
  try { this.hud.toastMessage(`${TODAYS_MUTATOR.icon} ${TODAYS_MUTATOR.name} ACTIVE`, 'kill'); } catch (e) { /* */ }
  return r;
};

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
    await game.start(chosenStarter, chosenWeapon, chosenSkin, chosenDifficulty, chosenPerk);
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
  document.body.classList.toggle('wg-modal-open', !!p);
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
  document.body.classList.add('wg-modal-open'); // lock background scroll/rubber-band on iOS
  // Stop the Pixi ticker directly so the world freezes (no pause panel shown).
  if (game?.app?.ticker?.started) game.app.ticker.stop();
  renderShopList();
}
function closeShopModal() {
  shopOpen = false;
  shopModal.hidden = true;
  document.body.classList.remove('wg-modal-open');
  // Resume Pixi ticker only if the user-pause overlay isn't active.
  if (!paused && game?.app?.ticker && !game.app.ticker.started) game.app.ticker.start();
}
shopBtn?.addEventListener('click', openShopModal);
shopClose?.addEventListener('click', closeShopModal);
shopModal?.addEventListener('click', (e) => { if (e.target === shopModal) closeShopModal(); });

// Keyboard shortcut: B opens shop (mirrors pug-cafe / pugzilla / supermarket).
// Guarded against evolve-menu / pause overlay so the shop can't stack on top.
// e.repeat guard prevents held-B from rapid-flipping open/close every frame.
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if ((e.key === 'b' || e.key === 'B') && game?.running && !game?.evolving && !paused) {
    e.preventDefault();
    if (shopOpen) closeShopModal(); else openShopModal();
  }
});

// Keep button label fresh (shows current money) + toggle visibility with game state.
// Perf: cache prev values so we only touch the DOM when something actually changed.
const _evolveOv = document.getElementById('evolve-overlay');
let _prevShopHidden = null, _prevShopMoney = -1;
function _shopBtnLoop() {
  if (shopBtn) {
    const evolveOpen = _evolveOv ? !_evolveOv.hidden : false;
    const visible = !!(game?.running && game?.player?.alive && !paused && !shopOpen && !evolveOpen);
    if (_prevShopHidden !== !visible) {
      shopBtn.hidden = !visible;
      _prevShopHidden = !visible;
    }
    if (visible) {
      const m = Math.floor(game.player.money || 0);
      if (m !== _prevShopMoney) {
        shopBtn.textContent = `🛒 SHOP $${m}`;
        _prevShopMoney = m;
      }
    }
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

// Tutorial tip — shows briefly when the game starts (every match).
// Round-2 polish: touch + desktop get their own (clearer) wording so mobile
// players don't see useless keyboard hints on first match.
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      const msg = _isTouch
        ? 'LEFT JOY move · RIGHT JOY aim+fire · BORK 🟢 · DASH · DECOY · HEAL · 🛒 SHOP'
        : 'MOUSE aim · CLICK fire · SPACE BORK · E dash · Q decoy · R heal · B shop';
      showTip(msg, 6500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === BORK Polish R2 — extra settings (crosshair, damage numbers) ===
// Adds 3 small toggles into the start overlay using localStorage keys:
//   wg:crosshair         '0' default, '1' dot, '2' cross
//   wg:damage-numbers    '0' off, '1' on (default on)
//   wg:smart-pickup      '0' off, '1' prefer current weapon (default on)
// Drawn as a small UI block at the bottom of the .overlay__panel.
(function _r2Settings() {
  const panel = document.querySelector('#overlay .overlay__panel');
  if (!panel) return;
  const block = document.createElement('div');
  block.className = 'r2-settings';
  block.style.cssText = 'margin:10px auto 4px;font-size:0.5rem;color:#c8c0e8;letter-spacing:0.05em;text-align:center;display:flex;gap:14px;flex-wrap:wrap;justify-content:center;';
  block.innerHTML = `
    <label class="r2-settings__row" style="display:flex;flex-direction:column;gap:3px;">
      <span style="color:var(--neon-cyan);font-size:0.42rem;">CROSSHAIR</span>
      <select id="r2-crosshair" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 6px;font-family:inherit;font-size:0.5rem;">
        <option value="0">DEFAULT</option>
        <option value="1">DOT</option>
        <option value="2">CROSS</option>
      </select>
    </label>
    <label class="r2-settings__row" style="display:flex;flex-direction:column;gap:3px;">
      <span style="color:var(--neon-cyan);font-size:0.42rem;">DAMAGE NUMBERS</span>
      <select id="r2-damage-numbers" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 6px;font-family:inherit;font-size:0.5rem;">
        <option value="1">ON</option>
        <option value="0">OFF</option>
      </select>
    </label>
    <label class="r2-settings__row" style="display:flex;flex-direction:column;gap:3px;">
      <span style="color:var(--neon-cyan);font-size:0.42rem;">SMART AMMO PICKUP</span>
      <select id="r2-smart-pickup" style="background:rgba(0,0,0,0.5);color:#fff;border:1px solid #2a2540;padding:3px 6px;font-family:inherit;font-size:0.5rem;">
        <option value="1">PREFER CURRENT</option>
        <option value="0">RANDOM</option>
      </select>
    </label>
  `;
  panel.insertBefore(block, document.querySelector('#starter-choices'));
  // Wire selects → localStorage (defaults sensible if not set)
  const cs = document.getElementById('r2-crosshair');
  cs.value = localStorage.getItem('wg:crosshair') || '0';
  cs.addEventListener('change', () => {
    localStorage.setItem('wg:crosshair', cs.value);
    applyCrosshairStyle(cs.value);
  });
  applyCrosshairStyle(cs.value);
  const dn = document.getElementById('r2-damage-numbers');
  dn.value = localStorage.getItem('wg:damage-numbers') || '1';
  dn.addEventListener('change', () => { localStorage.setItem('wg:damage-numbers', dn.value); });
  const sp = document.getElementById('r2-smart-pickup');
  sp.value = localStorage.getItem('wg:smart-pickup') || '1';
  sp.addEventListener('change', () => { localStorage.setItem('wg:smart-pickup', sp.value); });
})();
// Crosshair: rendered via DOM cursor SVG so it doesn't conflict with Pixi.
function applyCrosshairStyle(style) {
  // SVG-data-URI cursors. Anchor 16,16 = center.
  const cursors = {
    '0': "default",
    '1': "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='3' fill='%23ffd23f' stroke='%23000' stroke-width='1'/></svg>\") 8 8, crosshair",
    '2': "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><line x1='12' y1='2' x2='12' y2='8' stroke='%234cc9f0' stroke-width='2'/><line x1='12' y1='16' x2='12' y2='22' stroke='%234cc9f0' stroke-width='2'/><line x1='2' y1='12' x2='8' y2='12' stroke='%234cc9f0' stroke-width='2'/><line x1='16' y1='12' x2='22' y2='12' stroke='%234cc9f0' stroke-width='2'/><circle cx='12' cy='12' r='1.5' fill='%23fff'/></svg>\") 12 12, crosshair",
  };
  // Apply to game-root + canvas (only matters during play)
  const root = document.getElementById('game-root');
  if (root) root.style.cursor = cursors[style] || cursors['0'];
}

// === Pre-game tooltip — show arena/biome info on match start ===
// One-shot toast that lists the three biome names (KITCHEN/GARAGE/GARDEN)
// + reminds player about hazards. Replaces the generic controls tip on
// the second start onward (first start still shows controls).
(function _arenaTipOnStart() {
  const startOv = document.getElementById('overlay');
  if (!startOv) return;
  let _startCount = 0;
  new MutationObserver(() => {
    if (startOv.classList.contains('is-hidden') || startOv.hidden) {
      _startCount++;
      // Skip the first transition (controls tip handles that one).
      if (_startCount > 1) {
        setTimeout(() => {
          if (game && game.hud && game.hud.toastMessage) {
            game.hud.toastMessage('🗺 ARENA: KITCHEN · GARAGE · GARDEN biomes — watch for ☣ poison + 💧 puddles', 'info');
          }
        }, 400);
      }
    }
  }).observe(startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
})();

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

// ============ Stats overlay (TAB to toggle, refreshed while open) ============
// Reads game._stat* counters every 250ms while shown. Bot count comes from
// the pugs[] array (subtract player). Pause-aware: closes when game pauses.
const statsOv = document.getElementById('hud-stats-overlay');
const statRefs = statsOv ? {
  kills: document.getElementById('stat-kills'),
  time:  document.getElementById('stat-time'),
  shots: document.getElementById('stat-shots'),
  hits:  document.getElementById('stat-hits'),
  acc:   document.getElementById('stat-acc'),
  dd:    document.getElementById('stat-dd'),
  dt:    document.getElementById('stat-dt'),
  hz:    document.getElementById('stat-hz'),
  obj:   document.getElementById('stat-obj'),
  bots:  document.getElementById('stat-bots'),
} : null;
let statsOpen = false, statsTimer = null;
function refreshStats() {
  if (!statsOpen || !game?.running || !statRefs) return;
  const t = game.matchTime || 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  statRefs.time.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  statRefs.kills.textContent = game.player?.kills || 0;
  const sf = game._statShotsFired || 0, sh = game._statShotsHit || 0;
  statRefs.shots.textContent = sf;
  statRefs.hits.textContent  = sh;
  statRefs.acc.textContent   = sf > 0 ? `${Math.round(sh / sf * 100)}%` : '—';
  statRefs.dd.textContent    = Math.round(game._statDmgDealt || 0);
  statRefs.dt.textContent    = Math.round(game._statDmgTaken || 0);
  statRefs.hz.textContent    = Math.round(game._statHazardDmg || 0);
  statRefs.obj.textContent   = game._statObjectivesGrabbed || 0;
  const aliveBots = (game.pugs || []).filter((p) => p.alive && p !== game.player).length;
  statRefs.bots.textContent  = aliveBots;
}
function setStatsOpen(open) {
  if (!statsOv) return;
  statsOpen = !!open;
  statsOv.hidden = !statsOpen;
  clearInterval(statsTimer);
  if (statsOpen) { refreshStats(); statsTimer = setInterval(refreshStats, 250); }
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.repeat && game?.running) {
    e.preventDefault();
    setStatsOpen(!statsOpen);
  }
});

// Persist daily best on match end (observe the end overlay).
// Polish R2: also tracks `done` flag — set when player reaches goal with the
// suggested weapon. The flag is persistent (sticky across all matches today).
const __endOv = document.getElementById('end-overlay');
if (__endOv && window.__borkDaily) {
  new MutationObserver(() => {
    if (__endOv.hidden || __endOv.classList.contains('is-hidden')) return;
    try {
      const kills = parseInt(document.getElementById('end-kills')?.textContent || '0', 10);
      const prev = JSON.parse(localStorage.getItem(window.__borkDaily.key) || '{"kills":0,"done":false}');
      // Did the player use the suggested weapon this match? chosenWeapon is the
      // module-scoped picker state at the time of match start.
      const usedSuggested = (chosenWeapon === window.__borkDaily.challenge.weapon);
      const newDone = prev.done || (usedSuggested && kills >= (window.__borkDaily.challenge.goal || 5));
      const newKills = Math.max(prev.kills | 0, kills);
      if (newKills !== (prev.kills | 0) || newDone !== !!prev.done) {
        localStorage.setItem(window.__borkDaily.key, JSON.stringify({ kills: newKills, done: newDone }));
      }
      // First-completion toast
      if (newDone && !prev.done) {
        try {
          if (game?.hud?.toastMessage) game.hud.toastMessage('★ DAILY CHALLENGE COMPLETE!', 'kill');
        } catch (e) { /* */ }
      }
    } catch (e) { /* */ }
  }).observe(__endOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish (fun-facts, new-best confetti, replay-prompt) ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Hold SPACE to charge a BORK blast.',
    'TIP: Pink zone shrinks fast in late waves — stay central.',
    'TIP: DASH (E) gives brief invuln — use to escape pinches.',
    'TIP: Decoy (Q) baits bots away from you.',
    'LORE: Bork Battle started as a backyard squabble.',
    'TIP: Higher tiers = more health AND damage.',
    'TIP: Eat treats to evolve — keep moving between zones.',
    'JOKE: What did the pug say to the gun? Such fire.',
  ];
  const GAME_ID = 'bork-battle';
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
        if (best && (best.kills || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.kills || best.score} kills${best.form ? ' · ' + best.form : ''}`;
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

// depth3D: HTML parallax layer over the Pixi canvas — slow drifting stars +
// cloud silhouettes that respond to mouse for a 3D-camera feel. Z-index sits
// below all HUD/overlay UI so it never blocks gameplay. Reduced-motion off.
try {
  _depthHtmlParallax({
    layers: [
      // Distant stars (slow)
      { speed: 0.2, html: '<div style="position:absolute;inset:0;background:radial-gradient(circle at 12% 18%, rgba(255,255,255,0.45) 1px, transparent 2px), radial-gradient(circle at 32% 42%, rgba(180,200,255,0.35) 1px, transparent 2px), radial-gradient(circle at 58% 22%, rgba(255,255,255,0.4) 1px, transparent 2px), radial-gradient(circle at 78% 70%, rgba(255,210,160,0.3) 1px, transparent 2px), radial-gradient(circle at 88% 12%, rgba(255,255,255,0.4) 1px, transparent 2px);"></div>' },
      // Mid-layer cloud band (faster)
      { speed: 0.55, html: '<div style="position:absolute;top:8%;left:-10%;right:-10%;height:14%;background:radial-gradient(ellipse at 30% 50%, rgba(76,201,240,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(255,58,161,0.06) 0%, transparent 60%);"></div>' },
    ],
  });
} catch (e) { /* */ }

// ============================================================================
// v2.5 BORK-004: Bot personality taunt barks on kills
// Watches the kill feed for entries with the player as victim, then a 600ms
// later shows a randomly-rolled bot taunt floating from the top of the screen.
// Pure DOM overlay — no Pixi changes, no Game.js touch. Persists nothing.
// ============================================================================
(function _r5BotTaunts() {
  const TAUNTS = [
    'get borked nerd!',
    'TOO SLOW PUG',
    'lol skill issue',
    'cry about it',
    'i am the bork now',
    'gg ez 🐶',
    'mid pug confirmed',
    'bork bork bork',
    'sit. stay. dead.',
    'you smell like wet kibble',
  ];
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  let lastCount = 0;
  setInterval(() => {
    if (!game?.running) return;
    const items = feed.querySelectorAll('.kill-feed__item, .kf-row');
    if (items.length === lastCount) return;
    // Player just died if any new entry mentions YOU as victim
    const newOnes = [...items].slice(lastCount);
    lastCount = items.length;
    for (const it of newOnes) {
      const txt = (it.textContent || '').toLowerCase();
      if (txt.includes('you') && !txt.startsWith('you ')) {
        // Player was killed — show bot taunt
        const t = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
        const bub = document.createElement('div');
        bub.textContent = t;
        bub.style.cssText = 'position:fixed;top:14%;left:50%;transform:translateX(-50%);background:rgba(20,8,32,0.92);color:#ff3aa1;border:2px solid #ff3aa1;padding:6px 14px;font-family:"Press Start 2P",monospace;font-size:10px;border-radius:4px;z-index:9998;pointer-events:none;animation:botTauntPop 2.4s ease-out forwards;text-shadow:0 0 4px rgba(255,58,161,0.6);';
        document.body.appendChild(bub);
        setTimeout(() => bub.remove(), 2500);
        break;
      }
    }
  }, 400);
  if (!document.getElementById('bork-bot-taunt-style')) {
    const s = document.createElement('style');
    s.id = 'bork-bot-taunt-style';
    s.textContent = '@keyframes botTauntPop{0%{opacity:0;transform:translateX(-50%) translateY(-8px) scale(0.6)}15%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.08)}30%{transform:translateX(-50%) translateY(0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-14px) scale(0.95)}}';
    document.head.appendChild(s);
  }
})();

// ============================================================================
// v2.5 BORK-019: Sticky weapon-drop label — pin "+SHOTGUN" pip for 3s instead
// of 1s. The Game already spawns float text on pickup; we extend by scanning
// for `.bw-weapon-pickup` elements (or similar) added to the DOM and force a
// longer animation. Since the Game uses Pixi for pickups, we instead show a
// supplementary fixed top-right pill that lingers.
// ============================================================================
(function _r5StickyPickupLabel() {
  let lastWeapon = null;
  setInterval(() => {
    if (!game?.running || !game.player) return;
    const w = game.player.weapon?.name || game.player.weapon?.id || game.player.weaponName;
    if (!w || w === lastWeapon) return;
    if (lastWeapon === null) { lastWeapon = w; return; } // skip initial spawn
    lastWeapon = w;
    const pill = document.createElement('div');
    pill.textContent = '+ ' + String(w).toUpperCase();
    pill.style.cssText = 'position:fixed;top:64px;right:14px;background:linear-gradient(90deg,#5ef38c 0%,#4cc9f0 100%);color:#0a0716;padding:6px 12px;font-family:"Press Start 2P",monospace;font-size:9px;border-radius:3px;z-index:9997;pointer-events:none;box-shadow:0 0 16px rgba(94,243,140,0.45);animation:weapPillSlide 3s ease-out forwards;font-weight:bold;';
    document.body.appendChild(pill);
    setTimeout(() => pill.remove(), 3100);
  }, 250);
  if (!document.getElementById('bork-weap-pill-style')) {
    const s = document.createElement('style');
    s.id = 'bork-weap-pill-style';
    s.textContent = '@keyframes weapPillSlide{0%{opacity:0;transform:translateX(40px) scale(0.6)}10%{opacity:1;transform:translateX(0) scale(1.1)}18%{transform:translateX(0) scale(1)}90%{opacity:1}100%{opacity:0;transform:translateX(20px) scale(0.95)}}';
    document.head.appendChild(s);
  }
})();
