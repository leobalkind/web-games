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
// Round-2: per-difficulty stat preview popover on hover (zombie counts).
const DIFF_PREVIEW = {
  easy:   { hpMul: '0.55×', dmgMul: '0.55×', zMul: '×0.45 zombies' },
  normal: { hpMul: '1.00×', dmgMul: '1.00×', zMul: '×1.00 zombies' },
  hard:   { hpMul: '1.40×', dmgMul: '1.40×', zMul: '×1.45 zombies' },
};
const savedDiff = localStorage.getItem('pugfort:difficulty') || 'normal';
document.querySelectorAll('.diff-btn').forEach((btn) => {
  if (btn.dataset.diff === savedDiff) btn.classList.add('diff-btn--active');
  else btn.classList.remove('diff-btn--active');
  // Inject preview popover (HP/DMG/spawn-count multipliers)
  const dp = DIFF_PREVIEW[btn.dataset.diff];
  if (dp && !btn.querySelector('.diff-btn__hint')) {
    const hint = document.createElement('span');
    hint.className = 'diff-btn__hint';
    hint.innerHTML = `<b>HP</b> ${dp.hpMul} · <b>DMG</b> ${dp.dmgMul}<br/>${dp.zMul}`;
    btn.appendChild(hint);
  }
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

// Round-2 polish: hover tooltips on each hotbar slot. Builds a tooltip from
// the buildable def — HP, RANGE, DMG, DPS where applicable, plus desc.
function injectSlotTooltips() {
  for (const id of Object.keys(BUILDABLES)) {
    const def = BUILDABLES[id];
    const slot = document.getElementById('slot-' + id);
    if (!slot || slot.querySelector('.hud-slot__tip')) continue;
    const rows = [];
    if (def.hp != null) rows.push(['HP', def.hp]);
    if (def.range != null) rows.push(['RANGE', def.range]);
    if (def.damage != null && def.fireCooldown) {
      const dps = (def.damage / def.fireCooldown).toFixed(1);
      rows.push(['DMG', def.damage]);
      rows.push(['DPS', dps]);
    }
    if (def.trapDps != null) rows.push(['DPS', def.trapDps]);
    if (def.mineDamage != null) rows.push(['BLAST', def.mineDamage]);
    if (def.healRate != null) rows.push(['HEAL/s', def.healRate]);
    if (def.platformRangeBonus) rows.push(['RANGE+', `+${Math.round(def.platformRangeBonus * 100)}%`]);
    if (def.wireSlowMul != null) rows.push(['SLOW', `${Math.round((1 - def.wireSlowMul) * 100)}%`]);
    const rowHtml = rows.map(([k, v]) => `<div class="row"><span>${k}</span><b>${v}</b></div>`).join('');
    const tip = document.createElement('div');
    tip.className = 'hud-slot__tip';
    tip.innerHTML = `<div><b>${def.name}</b></div>${rowHtml}`
      + `<div class="desc">${def.desc || ''}</div>`;
    slot.appendChild(tip);
  }
}
injectSlotTooltips();

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

// =============================================================================
// TECH TREE — persistent research points earned per night, spent between runs
// on permanent tower upgrades. Live mirrored into BUILDABLES on game.start so
// the existing turret-update path picks the bonuses up automatically.
// =============================================================================
const TECH_KEY = 'pugfort:tech';
const TECH_NODES = [
  { id: 'turret_dmg',    name: 'BORE-OUT BARRELS',    cost: 1, max: 4, icon: '🔫', desc: '+10% turret damage per level.',           apply: (b, lv) => { if (b.turret) b.turret.damage = Math.round(b.turret.damage * (1 + 0.10 * lv)); } },
  { id: 'turret_rate',   name: 'RAPID LOADERS',       cost: 1, max: 3, icon: '⚙️', desc: '-8% turret reload per level.',             apply: (b, lv) => { if (b.turret) b.turret.fireCooldown = b.turret.fireCooldown * Math.pow(0.92, lv); } },
  { id: 'sniper_range',  name: 'SCOPED OPTICS',       cost: 2, max: 3, icon: '🎯', desc: '+15% sniper range per level.',             apply: (b, lv) => { if (b.sniperTurret) b.sniperTurret.range = Math.round(b.sniperTurret.range * (1 + 0.15 * lv)); } },
  { id: 'wall_hp',       name: 'REBAR REINFORCE',     cost: 1, max: 3, icon: '🧱', desc: '+25% wall/sandbag HP per level.',          apply: (b, lv) => { const m = 1 + 0.25 * lv; if (b.wall) b.wall.hp = Math.round(b.wall.hp * m); if (b.sandbag) b.sandbag.hp = Math.round(b.sandbag.hp * m); } },
  { id: 'mine_dmg',      name: 'C4 PACKING',          cost: 2, max: 2, icon: '💣', desc: '+30% mine damage per level.',              apply: (b, lv) => { if (b.mine) b.mine.mineDamage = Math.round(b.mine.mineDamage * (1 + 0.30 * lv)); } },
  { id: 'acid_dur',      name: 'SLOW DRIP TANKS',     cost: 2, max: 2, icon: '🧪', desc: '+50% acid pool duration per level.',       apply: (b, lv) => { if (b.acidTurret) b.acidTurret.acidPoolDur = b.acidTurret.acidPoolDur * (1 + 0.50 * lv); } },
];
function loadTech() {
  try {
    const raw = localStorage.getItem(TECH_KEY);
    if (!raw) return { points: 0, ranks: {} };
    const o = JSON.parse(raw);
    return { points: o.points | 0, ranks: o.ranks || {} };
  } catch { return { points: 0, ranks: {} }; }
}
function saveTech(s) { try { localStorage.setItem(TECH_KEY, JSON.stringify(s)); } catch {} }
function awardResearch(nights) {
  if (!nights || nights <= 0) return 0;
  const s = loadTech();
  const earned = nights * 2; // 2 RP per night cleared — faster tech progression
  s.points = (s.points | 0) + earned;
  saveTech(s);
  return earned;
}
function renderTechPanel() {
  const root = document.getElementById('tech-tree-modal');
  if (!root) return;
  const s = loadTech();
  const ptsEl = document.getElementById('tech-points');
  if (ptsEl) ptsEl.textContent = s.points;
  const list = document.getElementById('tech-list');
  if (!list) return;
  list.innerHTML = TECH_NODES.map((n) => {
    const lv = s.ranks[n.id] | 0;
    const maxed = lv >= n.max;
    const canBuy = !maxed && s.points >= n.cost;
    return `<div class="tech-row ${maxed ? 'maxed' : (canBuy ? 'can-buy' : 'locked')}">
      <span class="tech-icon">${n.icon}</span>
      <div class="tech-body">
        <div class="tech-name"><b>${n.name}</b> <span class="tech-lv">Lv ${lv}/${n.max}</span></div>
        <div class="tech-desc">${n.desc}</div>
      </div>
      <button data-tech="${n.id}" ${maxed || !canBuy ? 'disabled' : ''}>${maxed ? '★ MAX' : `${n.cost} RP`}</button>
    </div>`;
  }).join('');
  list.querySelectorAll('button[data-tech]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-tech');
      const node = TECH_NODES.find((x) => x.id === id);
      if (!node) return;
      const st = loadTech();
      const cur = st.ranks[id] | 0;
      if (cur >= node.max) return;
      if (st.points < node.cost) return;
      st.points -= node.cost;
      st.ranks[id] = cur + 1;
      saveTech(st);
      renderTechPanel();
    });
  });
}
// Inject the tech-tree button + modal into the start overlay.
(function _injectTechUI() {
  const panel = startOverlay?.querySelector('.overlay__panel');
  if (!panel) return;
  const btn = document.createElement('button');
  btn.id = 'tech-tree-btn';
  btn.className = 'overlay__btn overlay__btn--ghost';
  btn.type = 'button';
  btn.style.cssText = 'margin:6px;';
  btn.innerHTML = '🔬 TECH TREE';
  btn.addEventListener('click', () => {
    const m = document.getElementById('tech-tree-modal');
    if (m) { m.hidden = false; renderTechPanel(); }
  });
  // Insert before the back-to-hub link so it sits with action buttons.
  const back = panel.querySelector('.overlay__back');
  if (back) panel.insertBefore(btn, back); else panel.appendChild(btn);
  // Build the modal (once)
  const modal = document.createElement('div');
  modal.id = 'tech-tree-modal';
  modal.hidden = true;
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(8,4,18,0.9);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `<div style="max-width:560px;width:100%;background:#15101e;border:2px solid var(--neon-cyan,#4cc9f0);border-radius:8px;padding:18px;color:#fff;font-family:inherit;max-height:80vh;overflow:auto;">
    <h2 style="margin:0 0 10px;color:var(--neon-cyan,#4cc9f0);text-align:center;">🔬 RESEARCH LAB</h2>
    <p style="text-align:center;margin:0 0 12px;font-size:0.6rem;letter-spacing:0.05em;">RESEARCH POINTS: <b id="tech-points" style="color:var(--neon-yellow,#ffd23f);">0</b> · Earn 2 RP per night cleared.</p>
    <div id="tech-list" style="display:flex;flex-direction:column;gap:8px;"></div>
    <button id="tech-close" style="margin:14px auto 0;display:block;padding:8px 18px;background:var(--neon-magenta,#ff2bd6);color:#fff;border:0;border-radius:4px;font-family:inherit;cursor:pointer;">CLOSE</button>
    <style>
      .tech-row{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #2a2540;border-radius:5px;background:rgba(0,0,0,0.3);}
      .tech-row.maxed{border-color:var(--neon-yellow,#ffd23f);}
      .tech-row.can-buy{border-color:var(--neon-green,#5ef38c);}
      .tech-row.locked{opacity:0.6;}
      .tech-row .tech-icon{font-size:1.4rem;}
      .tech-row .tech-body{flex:1;font-size:0.55rem;letter-spacing:0.04em;}
      .tech-row .tech-lv{color:var(--neon-cyan,#4cc9f0);margin-left:6px;}
      .tech-row .tech-desc{opacity:0.8;margin-top:3px;}
      .tech-row button{padding:6px 10px;background:var(--neon-cyan,#4cc9f0);color:#000;border:0;border-radius:4px;font-family:inherit;font-size:0.55rem;cursor:pointer;}
      .tech-row button:disabled{background:#444;color:#aaa;cursor:not-allowed;}
    </style>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('tech-close')?.addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
})();
// Apply tech bonuses to BUILDABLES at game.start (snapshot+restore so rematches
// don't compound). Also award RP on end (hooked alongside recordSurvival).
const _origStart_pft = game.start.bind(game);
game.start = async function(...args) {
  // If a prior snapshot is still live (e.g. mid-run crash, or rapid restart
  // before end-overlay observer fired), restore it FIRST so we re-snapshot
  // from clean baseline instead of capturing already-boosted stats and
  // compounding bonuses on every rematch.
  if (this._techSnap) {
    for (const id of Object.keys(this._techSnap)) {
      const snap = this._techSnap[id];
      if (!snap || !BUILDABLES[id]) continue;
      for (const k of Object.keys(snap)) {
        if (snap[k] != null) BUILDABLES[id][k] = snap[k];
      }
    }
    this._techSnap = null;
  }
  // Snapshot relevant numeric stats on each def so we can revert later.
  this._techSnap = {};
  for (const id of Object.keys(BUILDABLES)) {
    this._techSnap[id] = {
      damage: BUILDABLES[id].damage,
      fireCooldown: BUILDABLES[id].fireCooldown,
      range: BUILDABLES[id].range,
      hp: BUILDABLES[id].hp,
      mineDamage: BUILDABLES[id].mineDamage,
      acidPoolDur: BUILDABLES[id].acidPoolDur,
    };
  }
  const st = loadTech();
  for (const node of TECH_NODES) {
    const lv = st.ranks[node.id] | 0;
    if (lv > 0) { try { node.apply(BUILDABLES, lv); } catch (e) { /* */ } }
  }
  const r = await _origStart_pft(...args);
  return r;
};
// Hook end-screen observer to award RP from this run's nights.
(function _hookResearchAward() {
  const ov = document.getElementById('end-overlay');
  if (!ov) return;
  let last = 0;
  new MutationObserver(() => {
    if (ov.hidden || ov.classList.contains('is-hidden')) {
      // Restore def stats on overlay-hide (i.e., user closed end / went back).
      if (game?._techSnap) {
        for (const id of Object.keys(game._techSnap)) {
          const snap = game._techSnap[id];
          for (const k of Object.keys(snap)) {
            if (snap[k] != null) BUILDABLES[id][k] = snap[k];
          }
        }
        game._techSnap = null;
      }
      return;
    }
    const now = performance.now();
    if (now - last < 1500) return;
    last = now;
    const nights = parseInt(document.getElementById('end-nights')?.textContent || '0', 10);
    const earned = awardResearch(nights);
    if (earned > 0) {
      const stats = document.querySelector('#end-overlay .end-stats');
      if (stats && !document.getElementById('end-tech-banner')) {
        const div = document.createElement('div');
        div.id = 'end-tech-banner';
        div.style.cssText = 'margin:10px 0;padding:6px 10px;background:rgba(76,201,240,0.12);border:1px solid var(--neon-cyan,#4cc9f0);border-radius:4px;color:var(--neon-cyan,#4cc9f0);font-size:0.6rem;text-align:center;';
        div.innerHTML = `🔬 +${earned} RESEARCH POINT${earned === 1 ? '' : 'S'} EARNED — spend in 🔬 TECH TREE on start screen.`;
        stats.after(div);
      }
    }
  }).observe(ov, { attributes: true, attributeFilter: ['hidden', 'class'] });
})();

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

// Tutorial tip — shows briefly when the game starts (every match).
// Touch + desktop get distinct wording so mobile users see joystick hints.
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      const msg = _isTouch
        ? 'LEFT JOY move · RIGHT JOY aim+fire · BUILD 🟢 · 🛒 SHOP top-right'
        : 'WASD move · CLICK shoot · B build · R repair-all · TAB stats · T speed';
      showTip(msg, 6000);
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

// Round-2 polish: resource forecast. Polls game.resources every ~5s and shows
// a "+/- per minute" rate for each material so the player can budget.
(function _forecastHud(){
  const el = document.getElementById('hud-forecast');
  const rowsEl = document.getElementById('hud-forecast-rows');
  if (!el || !rowsEl) return;
  const KEYS = [
    { k: 'wood', icon: '🪵' },
    { k: 'scrap', icon: '🔩' },
    { k: 'explosives', icon: '💣' },
    { k: 'electronics', icon: '🔌' },
  ];
  let prev = null, prevT = 0;
  function sample() {
    if (!game?.running || !game.resources) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const now = performance.now() / 1000;
    const cur = { wood: 0, scrap: 0, explosives: 0, electronics: 0 };
    for (const { k } of KEYS) cur[k] = Math.floor(game.resources[k] || 0);
    if (prev && (now - prevT) > 1) {
      const dt = now - prevT;
      const lines = [];
      for (const { k, icon } of KEYS) {
        const delta = cur[k] - prev[k];
        const perMin = delta / dt * 60;
        const sign = perMin > 0.5 ? '+' : (perMin < -0.5 ? '' : '±');
        const color = perMin > 0.5 ? 'var(--neon-green)' : (perMin < -0.5 ? 'var(--crimson)' : 'var(--muted)');
        lines.push(`<div class="row"><span>${icon}</span><b style="color:${color}">${sign}${perMin.toFixed(0)}/min</b></div>`);
      }
      rowsEl.innerHTML = lines.join('');
    } else if (!prev) {
      rowsEl.innerHTML = `<div class="row"><span style="color:var(--muted)">measuring…</span></div>`;
    }
    prev = cur;
    prevT = now;
  }
  // Sample every 5s — long enough to see real trends without spamming DOM.
  setInterval(sample, 5000);
})();

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
// ROUND-2 polish: add SUN + MOON layer + scroll cloud band faster when night.
try {
  _depthHtmlParallax({
    layers: [
      // Distant city silhouette (slow drift)
      { speed: 0.15, html: '<div style="position:absolute;left:-5%;right:-5%;bottom:0;height:24%;background:linear-gradient(to top,#0a0716 0%,rgba(20,12,34,0.5) 70%,transparent 100%);"></div><div style="position:absolute;left:-5%;right:-5%;bottom:14%;height:8%;background-image:repeating-linear-gradient(to right,#1a0d2a 0,#1a0d2a 28px,transparent 28px,transparent 38px,#2a1640 38px,#2a1640 64px,transparent 64px,transparent 80px);opacity:0.7;"></div>' },
      // Sun + Moon — both rendered, css opacity toggled by .pf-sky--night class.
      { speed: 0.05, html: '<div id="pf-sun" style="position:absolute;left:14%;top:8%;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe082 0%,#ffd23f 50%,rgba(255,210,63,0.0) 75%);box-shadow:0 0 60px rgba(255,210,63,0.45);transition:opacity 2s linear;"></div><div id="pf-moon" style="position:absolute;right:14%;top:6%;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff0a8 0%,#c0c8e0 60%,rgba(192,200,224,0.0) 80%);box-shadow:0 0 36px rgba(192,200,224,0.4);opacity:0;transition:opacity 2s linear;"><div style="position:absolute;left:18px;top:14px;width:8px;height:8px;border-radius:50%;background:rgba(120,128,160,0.55);"></div><div style="position:absolute;left:30px;top:32px;width:6px;height:6px;border-radius:50%;background:rgba(120,128,160,0.45);"></div><div style="position:absolute;left:40px;top:18px;width:5px;height:5px;border-radius:50%;background:rgba(120,128,160,0.5);"></div></div>' },
      // Cloud band over horizon — id used to swap CSS animation speed for night
      { speed: 0.4, html: '<div id="pf-clouds" style="position:absolute;left:-50%;right:-50%;top:10%;height:14%;background:radial-gradient(ellipse at 20% 50%, rgba(180,150,220,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(255,255,255,0.05) 0%, transparent 55%), radial-gradient(ellipse at 40% 60%, rgba(200,200,235,0.06) 0%, transparent 60%);animation:pfCloudDrift 60s linear infinite;"></div>' },
    ],
  });
  // Inject cloud drift + night-mode keyframes once.
  if (!document.getElementById('pugfort-sky-styles')) {
    const s = document.createElement('style');
    s.id = 'pugfort-sky-styles';
    s.textContent = '@keyframes pfCloudDrift{from{transform:translateX(0)}to{transform:translateX(33%)}}'
      + '.pf-sky--night #pf-sun{opacity:0!important;}'
      + '.pf-sky--night #pf-moon{opacity:1!important;}'
      + '.pf-sky--night #pf-clouds{animation-duration:24s!important;}'
      + '.pf-sky--day #pf-sun{opacity:1;} .pf-sky--day #pf-moon{opacity:0;}'
      + '.pf-sky--dusk #pf-sun{opacity:0.4;} .pf-sky--dusk #pf-moon{opacity:0.6;}'
      + '#pf-sun,#pf-moon{transition:opacity 2.2s ease-in-out;}'
      + '#pf-clouds{transition:animation-duration 2s linear;}';
    document.head.appendChild(s);
  }
} catch (e) { /* */ }

// Sync sky class with the game's phase. Polled lightly — no per-frame cost.
setInterval(() => {
  if (!game?.running) return;
  const ph = game.phase;
  const cls = (ph === 'night') ? 'pf-sky--night'
            : (ph === 'sunset' || ph === 'dawn') ? 'pf-sky--dusk' : 'pf-sky--day';
  if (document.body.dataset.pfSky !== cls) {
    document.body.classList.remove('pf-sky--day', 'pf-sky--night', 'pf-sky--dusk');
    document.body.classList.add(cls);
    document.body.dataset.pfSky = cls;
  }
}, 500);

// ============================================================================
// v2.5 FORT-011: Mute audience cheer SFX option in settings.
// Adds a small floating toggle that writes localStorage `pugfort:noCheer` and
// gates Sfx.playCheer/playCrowd at call sites (best-effort proxy).
// ============================================================================
(function _r5CheerMute() {
  const key = 'pugfort:noCheer';
  // Patch Sfx if it exposes named cheer methods
  ['playCheer', 'playCrowd', 'playAudience'].forEach((fn) => {
    if (typeof Sfx?.[fn] === 'function') {
      const orig = Sfx[fn].bind(Sfx);
      Sfx[fn] = function(...args) {
        if (localStorage.getItem(key) === '1') return;
        return orig(...args);
      };
    }
  });
  // Inject a tiny toggle near the settings button
  const btn = document.createElement('button');
  btn.id = 'pf-cheer-toggle';
  btn.title = 'Mute audience cheer SFX';
  btn.style.cssText = 'position:fixed;top:14px;left:120px;z-index:50;background:rgba(20,8,32,0.85);color:#fff;border:1px solid #5ef38c;padding:4px 8px;font-family:"Press Start 2P",monospace;font-size:8px;border-radius:3px;cursor:pointer;';
  const sync = () => {
    const muted = localStorage.getItem(key) === '1';
    btn.textContent = muted ? '🔕 CROWD' : '🎉 CROWD';
    btn.style.opacity = muted ? '0.55' : '1';
  };
  btn.addEventListener('click', () => {
    const cur = localStorage.getItem(key) === '1';
    localStorage.setItem(key, cur ? '0' : '1');
    sync();
  });
  document.body.appendChild(btn);
  sync();
})();

// ============================================================================
// v2.5 FORT-005: Refund hint badge — small static reminder next to BUILD
// button that the player CAN sell back structures (existing R hotkey logic
// elsewhere). Adds a 1-time tutorial pill when build menu first opens.
// ============================================================================
(function _r5RefundHint() {
  if (localStorage.getItem('pugfort:refundHintSeen') === '1') return;
  const showHint = () => {
    if (localStorage.getItem('pugfort:refundHintSeen') === '1') return;
    localStorage.setItem('pugfort:refundHintSeen', '1');
    const pill = document.createElement('div');
    pill.textContent = 'TIP: Sell structures back via the BUILD menu for partial refund.';
    pill.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(20,8,32,0.94);color:#ffd23f;border:2px solid #ffd23f;padding:8px 14px;font-family:"Press Start 2P",monospace;font-size:9px;border-radius:4px;z-index:9998;pointer-events:none;animation:refundHintPulse 5s ease-out forwards;max-width:340px;text-align:center;';
    document.body.appendChild(pill);
    setTimeout(() => pill.remove(), 5200);
  };
  // Show after a short delay once game starts
  const tick = setInterval(() => {
    if (game?.running) { setTimeout(showHint, 8000); clearInterval(tick); }
  }, 500);
  if (!document.getElementById('pf-refund-hint-style')) {
    const s = document.createElement('style');
    s.id = 'pf-refund-hint-style';
    s.textContent = '@keyframes refundHintPulse{0%{opacity:0;transform:translateX(-50%) translateY(10px)}12%{opacity:1;transform:translateX(-50%) translateY(0)}82%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-8px)}}';
    document.head.appendChild(s);
  }
})();
