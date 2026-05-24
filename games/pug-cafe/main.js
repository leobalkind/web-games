// PUG CAFÉ PANIC — order management with chaotic pug staff.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { iconSvg } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createSpeedToggle } from '../../src/shared/speedToggle.js';
import { createKillFeed } from '../../src/shared/killFeed.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { htmlVignette as _depthVignette } from '../../src/shared/depth3D.js';

// Cafe is click-only — shared module just adds a BACK chip + mute toggle.
createMobileControls({ layout: 'single-tap', buttons: [] });

// Helper: prefer pixel-art SVG icon when ingredient has an iconName; fall back to emoji string
function _ingIcon(ing) {
  return ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](28) : ing.icon;
}

const sfx = createSfx({ storageKey: 'cafe:muted' });
sfx.applyButton(document.getElementById('mute-btn'));
// Chill kitchen music — gentle major pad, intensifies briefly during rushes.
const music = createMusicTrack({ mood: 'chill', tempo: 110, key: 'C', scale: 'major' });
// Kitchen sizzle ambience — soft highpassed noise burst every ~6-9s while running.
// Fills the long quiet stretches between order events without competing with music.
let _sizzleT = 0;
function _kitchenAmbience(dt) {
  if (!running) return;
  _sizzleT -= dt;
  if (_sizzleT <= 0) {
    _sizzleT = 6 + Math.random() * 4;
    try { sfx.noise(0.35, 0.05, 4200); } catch {}
  }
}
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'pug-cafe', getControlsHelp: () => (_isTouch
  ? 'TAP an ingredient → TAP SERVE on right order. Tap ★ SHOP (top-right) for upgrades. ⚡ SPEED TOGGLE top-right. Saved to your profile.'
  : 'CLICK an ingredient → CLICK SERVE on right order. Tap ★ SHOP (top-right). T = speed toggle. Saved to your profile.') });

// ----- Visual polish: decorations + staff animation + popups + shake ------
const VISUAL_CSS = `
.cafe-bg { position: fixed; inset: 0; z-index: 1; pointer-events: none; overflow: hidden;
  background:
    repeating-linear-gradient(45deg, rgba(255,210,63,0.04) 0 14px, transparent 14px 28px),
    repeating-linear-gradient(-45deg, rgba(76,201,240,0.04) 0 14px, transparent 14px 28px),
    radial-gradient(ellipse at 30% 80%, #1a0f2e 0%, #0a0716 70%); }
.cafe-bg__floor { position: absolute; bottom: 0; left: 0; right: 0; height: 30%;
  background:
    linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.5)),
    repeating-conic-gradient(from 0deg, #2a1818 0deg 90deg, #1a1010 90deg 180deg) 0 0/48px 48px;
  border-top: 2px solid rgba(255,210,63,0.18); box-shadow: 0 -6px 18px rgba(0,0,0,0.6) inset; }
/* Oil stain near grill + spilled flour patch with footprints */
.cafe-bg__oilstain { position: absolute; bottom: 8%; left: 18%; width: 70px; height: 28px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.7) 0%, rgba(40,20,10,0.4) 60%, transparent 80%);
  border-radius: 50%; filter: blur(1px); }
.cafe-bg__flour { position: absolute; bottom: 6%; right: 22%; width: 90px; height: 24px;
  background: radial-gradient(ellipse, rgba(255,240,220,0.55) 0%, rgba(255,240,220,0.18) 70%, transparent 90%);
  border-radius: 50%; filter: blur(0.5px); }
.cafe-bg__pawtrail { position: absolute; bottom: 4%; right: 8%; width: 200px; height: 18px;
  background:
    radial-gradient(circle 4px at 10px 4px, rgba(255,240,220,0.45), transparent 60%),
    radial-gradient(circle 4px at 36px 14px, rgba(255,240,220,0.4), transparent 60%),
    radial-gradient(circle 4px at 62px 4px, rgba(255,240,220,0.35), transparent 60%),
    radial-gradient(circle 4px at 88px 14px, rgba(255,240,220,0.3), transparent 60%),
    radial-gradient(circle 4px at 114px 4px, rgba(255,240,220,0.25), transparent 60%),
    radial-gradient(circle 4px at 140px 14px, rgba(255,240,220,0.2), transparent 60%),
    radial-gradient(circle 4px at 166px 4px, rgba(255,240,220,0.15), transparent 60%); }

/* === KITCHEN COUNTER LANDMARK === */
.cafe-kitchen { position: absolute; top: 38px; left: 0; right: 0; height: 38%;
  pointer-events: none; }
.cafe-kitchen__wall { position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(20,12,28,0.85) 0%, rgba(30,18,38,0.7) 70%, rgba(0,0,0,0.0) 100%),
    repeating-linear-gradient(90deg, rgba(255,210,63,0.04) 0 36px, transparent 36px 38px); }
.cafe-kitchen__counter { position: absolute; bottom: -6px; left: 0; right: 0; height: 16px;
  background: linear-gradient(180deg, #4a3a2a 0%, #2a1a10 100%);
  border-top: 2px solid #6a4a2c;
  box-shadow: 0 2px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,210,63,0.18); }
/* GRILL — alternating bars + heat shimmer */
.cafe-grill { position: absolute; left: 6%; bottom: 22px; width: 110px; height: 56px;
  background:
    repeating-linear-gradient(90deg, #1a0e0e 0 8px, #2a0f0f 8px 16px);
  border: 2px solid #5a3a2a; border-radius: 4px 4px 0 0;
  box-shadow: 0 0 16px rgba(255,80,30,0.4) inset; overflow: hidden; }
.cafe-grill__bar { position: absolute; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, transparent, #ff5418, #ffb000, #ff5418, transparent);
  animation: cafe-grill-flicker 0.4s ease-in-out infinite alternate; }
.cafe-grill__bar:nth-child(1) { top: 12px; animation-delay: 0s; }
.cafe-grill__bar:nth-child(2) { top: 28px; animation-delay: 0.15s; }
.cafe-grill__bar:nth-child(3) { top: 44px; animation-delay: 0.3s; }
@keyframes cafe-grill-flicker { 0% { opacity: 0.55; filter: blur(1px); transform: scaleY(0.85); }
  100% { opacity: 1; filter: blur(0px); transform: scaleY(1.15); } }
.cafe-grill__steam { position: absolute; top: -22px; left: 50%; width: 8px; height: 8px;
  border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%);
  animation: cafe-steam-rise 2.4s ease-out infinite; opacity: 0; }
.cafe-grill__steam:nth-child(4) { animation-delay: 0s; left: 30%; }
.cafe-grill__steam:nth-child(5) { animation-delay: 0.8s; left: 55%; }
.cafe-grill__steam:nth-child(6) { animation-delay: 1.6s; left: 75%; }
@keyframes cafe-steam-rise { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
  20% { opacity: 0.7; } 100% { transform: translate(-50%, -40px) scale(1.4); opacity: 0; } }
/* OVEN — door + flickering firebox */
.cafe-oven { position: absolute; left: calc(6% + 130px); bottom: 22px; width: 84px; height: 76px;
  background: linear-gradient(180deg, #2a2028 0%, #1a1018 100%);
  border: 2px solid #4a3a4a; border-radius: 4px 4px 0 0;
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.1); }
.cafe-oven__door { position: absolute; top: 8px; left: 8px; right: 8px; bottom: 18px;
  background: radial-gradient(ellipse at 50% 60%, #ff6a14 0%, #c83a00 40%, #2a0a00 80%);
  border: 2px solid #5a3a2a; border-radius: 4px;
  animation: cafe-oven-glow 1.8s ease-in-out infinite alternate;
  box-shadow: 0 0 14px rgba(255,140,30,0.6); }
@keyframes cafe-oven-glow { 0% { box-shadow: 0 0 10px rgba(255,140,30,0.4), inset 0 0 8px rgba(255,80,0,0.5); }
  100% { box-shadow: 0 0 22px rgba(255,140,30,0.9), inset 0 0 14px rgba(255,180,30,0.8); } }
.cafe-oven__handle { position: absolute; left: 12px; right: 12px; bottom: 8px; height: 4px;
  background: #6a6a72; border-radius: 2px; box-shadow: 0 1px 0 #2a2a32; }
.cafe-oven__knob { position: absolute; top: 2px; right: 4px; width: 6px; height: 6px;
  background: #ff3a3a; border-radius: 50%; box-shadow: 0 0 6px #ff3a3a; }
/* PREP STATION — chopping board + knife */
.cafe-prep { position: absolute; left: calc(6% + 230px); bottom: 22px; width: 80px; height: 36px;
  background: linear-gradient(180deg, #6a3a1a 0%, #4a2a10 100%);
  border: 2px solid #3a200c; border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(255,210,63,0.2); }
.cafe-prep__board-line { position: absolute; left: 6px; right: 6px; height: 1px;
  background: rgba(0,0,0,0.4); }
.cafe-prep__board-line:nth-child(1) { top: 8px; } .cafe-prep__board-line:nth-child(2) { top: 16px; }
.cafe-prep__board-line:nth-child(3) { top: 24px; }
.cafe-prep__knife { position: absolute; top: -8px; right: 8px; width: 4px; height: 30px;
  background: linear-gradient(180deg, #2a2a32 0 6px, #c8c8d8 6px 100%);
  transform-origin: 50% 8px; animation: cafe-knife-chop 1.4s ease-in-out infinite;
  border-radius: 1px; box-shadow: 0 0 4px rgba(200,200,216,0.5); }
@keyframes cafe-knife-chop { 0%, 60%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-40deg); } 40% { transform: rotate(5deg); } }
/* MIXER — rotating bowl */
.cafe-mixer { position: absolute; left: calc(6% + 326px); bottom: 22px; width: 64px; height: 76px;
  background: linear-gradient(180deg, #4a4a52 0%, #2a2a32 100%);
  border: 2px solid #6a6a72; border-radius: 4px 4px 0 0; }
.cafe-mixer__head { position: absolute; top: 4px; left: 8px; right: 8px; height: 22px;
  background: linear-gradient(180deg, #6a6a72, #3a3a42); border-radius: 4px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.15); }
.cafe-mixer__bowl { position: absolute; bottom: 8px; left: 50%; width: 40px; height: 28px;
  transform: translateX(-50%);
  background: conic-gradient(from 0deg, #c8c8d8 0deg, #888898 90deg, #c8c8d8 180deg, #888898 270deg, #c8c8d8 360deg);
  border: 2px solid #4a4a52; border-radius: 50%;
  animation: cafe-mixer-spin 4s linear infinite; }
@keyframes cafe-mixer-spin { from { transform: translateX(-50%) rotate(0deg); }
  to { transform: translateX(-50%) rotate(360deg); } }
.cafe-mixer__paddle { position: absolute; top: 26px; left: 50%; width: 3px; height: 16px;
  background: #6a6a72; transform: translateX(-50%); }

/* CHALKBOARD — current orders */
.cafe-chalk { position: absolute; right: 6px; top: 80px; width: 160px; min-height: 110px;
  background: linear-gradient(180deg, #1a3020 0%, #0a1810 100%);
  border: 4px solid #6a3a1c; border-radius: 4px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.5);
  padding: 6px 8px; font-family: 'Press Start 2P', monospace; font-size: 0.4rem;
  color: #f4ecd2; pointer-events: none; line-height: 1.5; }
.cafe-chalk__title { color: #ffd23f; font-size: 0.5rem; letter-spacing: 0.12em;
  border-bottom: 1px dashed #f4ecd2; padding-bottom: 3px; margin-bottom: 5px; text-align: center;
  text-shadow: 0 0 6px rgba(255,210,63,0.45); }
.cafe-chalk__line { font-size: 0.4rem; color: rgba(244,236,210,0.92); padding: 2px 0;
  text-shadow: 0 0 1px rgba(244,236,210,0.4); letter-spacing: 0.04em; }
.cafe-chalk__line.crit { color: #ff8a8a; }
.cafe-chalk__line.warn { color: #ffd23f; }
.cafe-chalk__empty { color: rgba(244,236,210,0.5); font-size: 0.34rem; font-style: italic; text-align: center; padding-top: 12px; }

/* === Make pendant lights more present (brighter glow) === */
.cafe-bg__neon { position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
  font-family: var(--font-display); font-size: 0.7rem; letter-spacing: 0.18em;
  color: #ff8ac8; text-shadow: 0 0 12px #ff3aa1, 0 0 24px #ff3aa1, 0 0 40px #ff3aa1, 0 0 60px rgba(255,58,161,0.5);
  animation: cafe-neon 2.6s ease-in-out infinite; pointer-events: none; }
@keyframes cafe-neon { 0%,90%,100% { opacity: 1; } 92% { opacity: 0.45; } 94% { opacity: 1; } 96% { opacity: 0.6; } }
.cafe-bg__plant { position: absolute; bottom: 32%; font-size: 38px; opacity: 0.85;
  text-shadow: 0 4px 8px rgba(0,0,0,0.6); animation: cafe-sway 4s ease-in-out infinite; }
@keyframes cafe-sway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
.cafe-bg__plant--l { left: 14px; }
.cafe-bg__plant--r { right: 14px; }
.cafe-bg__hang { position: absolute; top: 0; width: 2px; background: #4a3a1a; }
.cafe-bg__hang::after { content: ''; position: absolute; bottom: -10px; left: -10px; width: 22px; height: 14px;
  border-radius: 0 0 12px 12px; background: radial-gradient(ellipse at top, #ffffff 0%, #ffd23f 40%, #c08a14 80%);
  box-shadow: 0 0 24px rgba(255,210,63,0.85), 0 0 48px rgba(255,210,63,0.45); }
.cafe-bg__hang--1 { left: 18%; height: 60px; } .cafe-bg__hang--2 { left: 46%; height: 90px; } .cafe-bg__hang--3 { left: 76%; height: 50px; }

/* === SHOP === */
.cafe-shop-btn { position: fixed; top: calc(14px + env(safe-area-inset-top, 0)); right: 60px; z-index: 100;
  background: linear-gradient(180deg, #ffd23f, #c89c20); color: #1a0d05;
  border: 3px solid #fff0a0; border-radius: 6px;
  font-family: var(--font-display); font-size: 0.5rem; letter-spacing: 0.08em;
  padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 0 #6a4a0a;
  -webkit-tap-highlight-color: transparent; }
.cafe-shop-btn:hover { transform: translateY(-1px); }
.cafe-shop-chips { position: fixed; top: 60px; right: 60px; z-index: 50;
  display: flex; gap: 4px; flex-wrap: wrap; max-width: 220px; justify-content: flex-end; }
.cafe-shop-chip { background: rgba(255,210,63,0.18); border: 1px solid var(--neon-yellow);
  color: var(--neon-yellow); font-family: var(--font-display); font-size: 0.36rem;
  letter-spacing: 0.05em; padding: 3px 5px; border-radius: 3px;
  text-shadow: 0 0 4px var(--neon-yellow); }
.cafe-shop-modal { position: fixed; inset: 0; z-index: 200; display: none;
  align-items: center; justify-content: center; background: rgba(0,0,0,0.7); padding: 16px; }
.cafe-shop-modal.is-open { display: flex; }
.cafe-shop-modal__panel { background: linear-gradient(180deg, #1a0f2e, #0a0716);
  border: 3px solid var(--neon-yellow); border-radius: 10px; padding: 20px;
  max-width: 420px; width: 100%; box-shadow: 0 0 40px rgba(255,210,63,0.5); }
.cafe-shop-modal__title { font-family: var(--font-display); font-size: 0.85rem;
  letter-spacing: 0.1em; color: var(--neon-yellow); text-align: center; margin: 0 0 14px;
  text-shadow: 0 0 12px var(--neon-yellow); }
.cafe-shop-modal__money { text-align: center; font-family: var(--font-display);
  font-size: 0.6rem; color: var(--neon-green); margin-bottom: 12px; }
.cafe-shop-upgrade { background: rgba(0,0,0,0.5); border: 2px solid var(--border);
  border-radius: 6px; padding: 10px; margin-bottom: 8px; display: flex;
  gap: 10px; align-items: center; }
.cafe-shop-upgrade.owned { border-color: var(--neon-green); background: rgba(94,243,140,0.08); }
.cafe-shop-upgrade__icon { font-size: 26px; flex-shrink: 0; }
.cafe-shop-upgrade__body { flex: 1; }
.cafe-shop-upgrade__name { font-family: var(--font-display); font-size: 0.5rem;
  color: var(--neon-cyan); letter-spacing: 0.05em; }
.cafe-shop-upgrade__desc { font-size: 0.42rem; color: var(--text-soft); margin-top: 2px; }
.cafe-shop-upgrade__btn { background: linear-gradient(180deg, var(--neon-yellow), #c89c20);
  color: #1a0d05; border: 2px solid #fff0a0; border-radius: 4px;
  font-family: var(--font-display); font-size: 0.45rem; letter-spacing: 0.05em;
  padding: 6px 8px; cursor: pointer; min-width: 70px;
  box-shadow: 0 3px 0 #6a4a0a; -webkit-tap-highlight-color: transparent; }
.cafe-shop-upgrade__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cafe-shop-upgrade__btn.owned { background: var(--neon-green); color: #0a1018; box-shadow: 0 3px 0 #1a5a30; }
.cafe-shop-close { background: rgba(0,0,0,0.6); color: var(--text); border: 2px solid var(--border);
  border-radius: 4px; font-family: var(--font-display); font-size: 0.5rem;
  padding: 8px 14px; cursor: pointer; display: block; margin: 14px auto 0; }

.cafe-staff { position: fixed; bottom: 8px; left: 10px; z-index: 2; pointer-events: none;
  width: 56px; height: 56px; line-height: 1; transform-origin: 50% 100%;
  animation: cafe-staff-idle 1.6s ease-in-out infinite; }
@keyframes cafe-staff-idle { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-3px) scaleY(0.96); } }
.cafe-staff__canvas { display: block; image-rendering: pixelated; }
.cafe-staff__bub { position: absolute; left: 58px; top: -4px; background: rgba(255,255,255,0.92);
  color: #0a0716; font-family: var(--font-display); font-size: 0.45rem;
  padding: 3px 5px; border-radius: 4px; opacity: 0; transition: opacity 0.3s; white-space: nowrap; }
.cafe-staff__bub.is-active { opacity: 1; }
/* Customer crowd lined up along the dining floor */
.cafe-customers { position: fixed; bottom: 6px; left: 90px; right: 10px;
  z-index: 2; pointer-events: none; display: flex; gap: 14px;
  align-items: flex-end; justify-content: flex-start; flex-wrap: nowrap;
  overflow: hidden; max-width: calc(100% - 100px); }
.cafe-customer { width: 44px; height: 48px; flex-shrink: 0;
  animation: cafe-customer-idle 2.4s ease-in-out infinite; transform-origin: 50% 100%; }
.cafe-customer canvas { display: block; image-rendering: pixelated; }
.cafe-customer:nth-child(2n) { animation-delay: 0.4s; }
.cafe-customer:nth-child(3n) { animation-delay: 0.8s; }
.cafe-customer:nth-child(4n) { animation-delay: 1.2s; }
@keyframes cafe-customer-idle { 0%,100% { transform: translateY(0); }
  50% { transform: translateY(-3px); } }
.cafe-popups { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
.cafe-popup { position: absolute; font-family: var(--font-display); font-size: 0.85rem;
  letter-spacing: 0.05em; text-shadow: 0 2px 0 #000, 0 0 12px currentColor;
  animation: cafe-pop-fly 1.1s cubic-bezier(0.2,0.7,0.3,1) forwards; }
@keyframes cafe-pop-fly { 0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0; }
  20% { transform: translate(-50%,-90%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%,-200%) scale(1); opacity: 0; } }
.cafe-flash { animation: cafe-chip-flash 0.5s ease-out; }
@keyframes cafe-chip-flash { 0% { background: rgba(255,210,63,0.65); transform: scale(1.06); }
  100% { background: transparent; transform: scale(1); } }
.cafe-shake { animation: cafe-shake 0.32s ease-out; }
@keyframes cafe-shake { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-5px, 3px); }
  40% { transform: translate(5px, -3px); } 60% { transform: translate(-4px, -2px); } 80% { transform: translate(3px, 4px); } }
.hud-card.is-critical { animation: cafe-hud-pulse 0.6s ease-in-out infinite; }
@keyframes cafe-hud-pulse { 0%,100% { box-shadow: 0 0 0 rgba(255,58,58,0); }
  50% { box-shadow: 0 0 28px rgba(255,58,58,0.7); } }
.station .placemat { position: absolute; inset: auto 0 -6px 0; height: 4px;
  background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent); opacity: 0.5; }
/* Burnt-food order — once freshness > 5s, the order border pulses red. */
.order.is-burnt { border-color: #ff3a3a !important;
  animation: cafe-burnt-pulse 0.7s ease-in-out infinite; }
@keyframes cafe-burnt-pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(255,58,58,0); }
  50%      { box-shadow: 0 0 14px rgba(255,58,58,0.7); }
}

/* Round 2C: tip popup — $-symbol that floats up bigger than the regular
   popup so the player feels the satisfying tip-jar clink. */
.cafe-tip { position: absolute; font-family: var(--font-display);
  font-size: 1.1rem; color: #ffd23f; text-shadow: 0 2px 0 #000, 0 0 12px #ffd23f;
  pointer-events: none; animation: cafe-tip-fly 1.4s cubic-bezier(0.2,0.7,0.3,1) forwards; }
@keyframes cafe-tip-fly {
  0%   { transform: translate(-50%,-50%) scale(0.4) rotate(-20deg); opacity: 0; }
  20%  { transform: translate(-50%,-80%) scale(1.4) rotate(0deg);  opacity: 1; }
  100% { transform: translate(-50%,-220%) scale(0.9) rotate(15deg); opacity: 0; }
}

/* Round 2C: angry customer leaving — red smoke puff that quickly billows up
   from the order card area, plus a small cloud-emote that scales in. */
.cafe-angry-smoke { position: absolute; width: 60px; height: 60px;
  border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, rgba(255,80,80,0.85), rgba(255,80,80,0));
  animation: cafe-angry-smoke 0.9s ease-out forwards; opacity: 0;
}
@keyframes cafe-angry-smoke {
  0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0.9; }
  100% { transform: translate(-50%,-180%) scale(1.8); opacity: 0; }
}
.cafe-angry-cloud { position: absolute; pointer-events: none;
  font-size: 1.4rem; line-height: 1;
  animation: cafe-angry-cloud 1.2s ease-out forwards; }
@keyframes cafe-angry-cloud {
  0% { transform: translate(-50%,-40%) scale(0.5); opacity: 0; }
  30% { transform: translate(-50%,-90%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%,-200%) scale(1); opacity: 0; }
}

/* Round 2C: burnt smoke wisps — small grey curls drifting from a burnt
   order so the auto-discard moment reads as "kitchen on fire". */
.cafe-burnt-wisp { position: absolute; width: 18px; height: 18px;
  pointer-events: none; border-radius: 50%;
  background: radial-gradient(circle, rgba(80,80,80,0.7), transparent 70%);
  animation: cafe-burnt-wisp 1.6s ease-out forwards; opacity: 0;
}
@keyframes cafe-burnt-wisp {
  0% { transform: translate(-50%,-50%) scale(0.5); opacity: 0.8; }
  100% { transform: translate(calc(-50% + var(--wx, 0)), -250%) scale(2); opacity: 0; }
}

/* Round 2C: color-chain bonus arcs — bright SVG-line that snakes between
   two same-color tables to telegraph the chain. Element is positioned/styled
   inline since the geometry is dynamic. */
.cafe-chain-arc { position: fixed; pointer-events: none; z-index: 240;
  filter: drop-shadow(0 0 6px #ffd23f);
  animation: cafe-chain-arc 0.7s ease-out forwards; opacity: 0;
}
@keyframes cafe-chain-arc {
  0% { opacity: 0; stroke-dashoffset: 100; }
  20% { opacity: 1; }
  100% { opacity: 0; stroke-dashoffset: 0; }
}

/* === WAVE 1F: CAFÉ PRO POLISH (compact) === */
.cafe-name-chip{position:fixed;top:calc(14px + env(safe-area-inset-top,0));left:60px;z-index:100;font-family:var(--font-display);font-size:.5rem;letter-spacing:.08em;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.7);color:var(--neon-yellow);border:2px solid var(--neon-yellow);cursor:pointer;box-shadow:0 0 8px rgba(255,210,63,.4);-webkit-tap-highlight-color:transparent}
.cafe-name-chip:hover{transform:translateY(-1px)}
.cafe-select-modal{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.85);padding:16px}
.cafe-select-modal.is-open{display:flex}
.cafe-select-modal__panel{background:linear-gradient(180deg,#1a0f2e,#0a0716);border:3px solid var(--neon-yellow);border-radius:10px;padding:18px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 0 40px rgba(255,210,63,.5)}
.cafe-select-title{font-family:var(--font-display);font-size:.85rem;letter-spacing:.1em;color:var(--neon-yellow);text-align:center;margin:0 0 6px;text-shadow:0 0 12px var(--neon-yellow)}
.cafe-select-sub{text-align:center;font-family:var(--font-display);font-size:.42rem;color:var(--text-soft);margin-bottom:14px;letter-spacing:.04em}
.cafe-select-card{background:rgba(0,0,0,.5);border:2px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent}
.cafe-select-card:hover{transform:translateY(-2px);border-color:var(--neon-cyan)}
.cafe-select-card.is-active{border-color:var(--neon-yellow);background:rgba(255,210,63,.1)}
.cafe-select-card.is-locked{opacity:.5;cursor:not-allowed}
.cafe-select-card__icon{font-size:36px;flex-shrink:0;line-height:1}
.cafe-select-card__body{flex:1}
.cafe-select-card__name{font-family:var(--font-display);font-size:.6rem;color:var(--neon-cyan);letter-spacing:.06em}
.cafe-select-card__desc{font-size:.42rem;color:var(--text-soft);margin-top:4px;line-height:1.4}
.cafe-select-card__lock{font-size:.4rem;color:var(--crimson);letter-spacing:.05em;margin-top:3px}
.cafe-customer{position:relative}
.cafe-customer__badge{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:14px;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.8);pointer-events:none}
.cafe-customer__order{position:absolute;bottom:100%;left:50%;transform:translate(-50%,-10px);background:rgba(255,255,255,.95);border:2px solid #1a1430;border-radius:4px;padding:2px 4px;display:flex;gap:2px;align-items:center;min-width:32px;pointer-events:none;opacity:0;transition:opacity .3s}
.cafe-customer__order.is-show{opacity:1}
.cafe-customer__order::after{content:'';position:absolute;bottom:-5px;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1a1430}
.cafe-soup-banner{position:fixed;top:calc(54px + env(safe-area-inset-top,0));left:60px;z-index:90;background:rgba(94,243,140,.18);color:var(--neon-green);border:1px solid var(--neon-green);border-radius:4px;font-family:var(--font-display);font-size:.4rem;letter-spacing:.06em;padding:4px 8px;box-shadow:0 0 6px rgba(94,243,140,.5);text-shadow:0 0 4px var(--neon-green);pointer-events:none}
.cafe-espresso{position:absolute;left:calc(6% + 410px);bottom:22px;width:64px;height:80px;background:linear-gradient(180deg,#3a2a32,#1a1018);border:2px solid #5a4a52;border-radius:4px 4px 0 0}
.cafe-espresso__top{position:absolute;top:4px;left:6px;right:6px;height:24px;background:linear-gradient(180deg,#c8c8d8,#6a6a72);border-radius:4px}
.cafe-espresso__spout{position:absolute;top:36px;left:50%;width:3px;height:14px;background:#6a6a72;transform:translateX(-50%)}
.cafe-espresso__drip{position:absolute;top:50px;left:50%;width:2px;height:4px;background:#6a3a1a;transform:translateX(-50%);animation:cafe-espresso-drip 1.6s linear infinite;opacity:0}
@keyframes cafe-espresso-drip{0%{transform:translate(-50%,0);opacity:0}20%{opacity:1}100%{transform:translate(-50%,18px);opacity:0}}
.cafe-espresso__cup{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:24px;height:14px;background:#fafaff;border:1px solid #6a6a72;border-top:none;border-radius:0 0 6px 6px}
.cafe-fight{position:fixed;pointer-events:none;z-index:240;font-family:var(--font-display);font-size:1.4rem;letter-spacing:.04em;color:#ff3a3a;text-shadow:0 0 12px #ff3a3a, 0 2px 0 #000;animation:cafe-fight-fly 1.4s ease-out forwards;opacity:0}
@keyframes cafe-fight-fly{0%{transform:translate(-50%,-50%) scale(.3) rotate(-10deg);opacity:0}30%{transform:translate(-50%,-90%) scale(1.5) rotate(0deg);opacity:1}100%{transform:translate(-50%,-180%) scale(1) rotate(15deg);opacity:0}}
.cafe-staff-helper{position:fixed;bottom:8px;left:75px;z-index:2;pointer-events:none;width:48px;height:48px;line-height:1;animation:cafe-staff-idle 1.4s ease-in-out infinite;filter:drop-shadow(0 0 6px rgba(94,243,140,.5))}
.cafe-staff-helper canvas{display:block;image-rendering:pixelated}
.cafe-staff-helper__label{position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-family:var(--font-display);font-size:.32rem;color:var(--neon-green);letter-spacing:.05em;text-shadow:0 0 4px var(--neon-green);white-space:nowrap;pointer-events:none}
.order.is-special{border-color:#ffd23f !important;animation:cafe-order-special .9s ease-in-out infinite;box-shadow:0 0 18px rgba(255,210,63,.7)}
@keyframes cafe-order-special{0%,100%{box-shadow:0 0 12px rgba(255,210,63,.5)}50%{box-shadow:0 0 30px rgba(255,210,63,.9), 0 0 50px rgba(255,210,63,.4)}}
.order__special-tag{display:inline-block;background:linear-gradient(90deg,#ffd23f,#ff8e3c,#ffd23f);color:#1a0d05;font-family:var(--font-display);font-size:.32rem;padding:1px 4px;border-radius:2px;margin-left:4px;letter-spacing:.05em;box-shadow:0 0 6px rgba(255,210,63,.6);animation:cafe-special-shimmer 1.4s linear infinite}
@keyframes cafe-special-shimmer{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}}
.cafe-daily-chip{position:fixed;top:calc(14px + env(safe-area-inset-top,0));right:calc(60px + 140px);z-index:100;background:rgba(76,201,240,.16);color:var(--neon-cyan);border:2px solid var(--neon-cyan);border-radius:6px;font-family:var(--font-display);font-size:.4rem;letter-spacing:.06em;padding:6px 10px;max-width:160px;line-height:1.3;text-shadow:0 0 4px var(--neon-cyan);cursor:pointer;-webkit-tap-highlight-color:transparent}
.cafe-daily-chip:hover{background:rgba(76,201,240,.28)}
.cafe-daily-chip.is-complete{background:rgba(94,243,140,.18);color:var(--neon-green);border-color:var(--neon-green);text-shadow:0 0 4px var(--neon-green)}
.cafe-shift-summary{background:rgba(0,0,0,.55);border:2px solid var(--neon-cyan);border-radius:6px;padding:10px 14px;margin:8px auto;font-family:var(--font-display);font-size:.5rem;letter-spacing:.05em;max-width:380px}
.cafe-shift-summary__row{display:flex;justify-content:space-between;padding:2px 0}
.cafe-shift-summary__row b{color:var(--neon-yellow)}
.cafe-shift-summary__title{color:var(--neon-cyan);font-size:.6rem;text-align:center;margin-bottom:6px;border-bottom:1px dashed var(--border);padding-bottom:4px}
.cafe-bench-tools{position:absolute;top:-22px;right:6px;display:flex;gap:4px;pointer-events:none;z-index:5}
.cafe-bench-tools__icon{font-size:14px;opacity:.85;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7));animation:cafe-tool-bob 2.4s ease-in-out infinite}
.cafe-bench-tools__icon:nth-child(2n){animation-delay:.4s}
.cafe-bench-tools__icon:nth-child(3n){animation-delay:.8s}
@keyframes cafe-tool-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.cafe-tip-mult{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:90;padding:4px 10px;background:rgba(255,210,63,.18);border:1px solid var(--neon-yellow);border-radius:4px;font-family:var(--font-display);font-size:.5rem;letter-spacing:.08em;color:var(--neon-yellow);text-shadow:0 0 6px var(--neon-yellow);pointer-events:none;opacity:0;transition:opacity .2s}
.cafe-tip-mult.is-show{opacity:1}
.cafe-cb{display:inline-block;border:1px solid currentColor;padding:0 4px;border-radius:3px;font-size:.32rem;letter-spacing:.05em;margin-right:4px}
`;
const _s = document.createElement('style'); _s.textContent = VISUAL_CSS; document.head.appendChild(_s);
// depth3D: vignette + soft drop shadows under staff/customers via CSS filter.
try { _depthVignette(); } catch (e) { /* */ }
const _cafeDepthStyle = document.createElement('style');
_cafeDepthStyle.textContent = `
  .cafe-staff__canvas, .cafe-customer canvas, .cafe-staff-helper canvas {
    filter: drop-shadow(0 6px 4px rgba(0,0,0,0.5));
  }
  .cafe-customer { will-change: transform; }
  body.reduced-motion .cafe-staff__canvas,
  body.reduced-motion .cafe-customer canvas,
  body.reduced-motion .cafe-staff-helper canvas {
    filter: drop-shadow(0 4px 3px rgba(0,0,0,0.4));
  }
`;
document.head.appendChild(_cafeDepthStyle);

// Decorative background — includes painted kitchen counter landmark
const _bg = document.createElement('div');
_bg.className = 'cafe-bg';
_bg.innerHTML = `
  <div class="cafe-kitchen">
    <div class="cafe-kitchen__wall"></div>
    <div class="cafe-grill">
      <div class="cafe-grill__bar"></div>
      <div class="cafe-grill__bar"></div>
      <div class="cafe-grill__bar"></div>
      <div class="cafe-grill__steam"></div>
      <div class="cafe-grill__steam"></div>
      <div class="cafe-grill__steam"></div>
    </div>
    <div class="cafe-oven">
      <div class="cafe-oven__knob"></div>
      <div class="cafe-oven__door"></div>
      <div class="cafe-oven__handle"></div>
    </div>
    <div class="cafe-prep">
      <div class="cafe-prep__board-line"></div>
      <div class="cafe-prep__board-line"></div>
      <div class="cafe-prep__board-line"></div>
      <div class="cafe-prep__knife"></div>
    </div>
    <div class="cafe-mixer">
      <div class="cafe-mixer__head"></div>
      <div class="cafe-mixer__paddle"></div>
      <div class="cafe-mixer__bowl"></div>
    </div>
    <div class="cafe-kitchen__counter"></div>
  </div>
  <div class="cafe-chalk" id="cafe-chalk">
    <div class="cafe-chalk__title">★ TODAY'S ORDERS ★</div>
    <div id="cafe-chalk-list"><div class="cafe-chalk__empty">no orders yet</div></div>
  </div>
  <div class="cafe-bg__floor"></div>
  <div class="cafe-bg__oilstain"></div>
  <div class="cafe-bg__flour"></div>
  <div class="cafe-bg__pawtrail"></div>
  <div class="cafe-bg__neon">★ PUG CAFÉ ★</div>
  <div class="cafe-bg__hang cafe-bg__hang--1"></div>
  <div class="cafe-bg__hang cafe-bg__hang--2"></div>
  <div class="cafe-bg__hang cafe-bg__hang--3"></div>
  <div class="cafe-bg__plant cafe-bg__plant--l">🪴</div>
  <div class="cafe-bg__plant cafe-bg__plant--r">🌵</div>
`;
document.body.appendChild(_bg);

// ===== SHOP UI =====
const _shopBtn = document.createElement('button');
_shopBtn.className = 'cafe-shop-btn';
_shopBtn.id = 'cafe-shop-btn';
_shopBtn.textContent = '★ SHOP';
document.body.appendChild(_shopBtn);
const _shopChips = document.createElement('div');
_shopChips.className = 'cafe-shop-chips';
_shopChips.id = 'cafe-shop-chips';
document.body.appendChild(_shopChips);
const _shopModal = document.createElement('div');
_shopModal.className = 'cafe-shop-modal';
_shopModal.id = 'cafe-shop-modal';
_shopModal.innerHTML = `
  <div class="cafe-shop-modal__panel">
    <h2 class="cafe-shop-modal__title">★ CAFÉ SHOP ★</h2>
    <div class="cafe-shop-modal__money">YOUR TIPS: <span id="cafe-shop-money">$0</span></div>
    <div id="cafe-shop-list"></div>
    <button class="cafe-shop-close" id="cafe-shop-close">CLOSE</button>
  </div>
`;
document.body.appendChild(_shopModal);
_shopBtn.addEventListener('click', openShop);
document.getElementById('cafe-shop-close').addEventListener('click', () => _shopModal.classList.remove('is-open'));
_shopModal.addEventListener('click', (e) => { if (e.target === _shopModal) _shopModal.classList.remove('is-open'); });
const _popups = document.createElement('div'); _popups.className = 'cafe-popups'; document.body.appendChild(_popups);
// Helper: render a high-detail pug into a small offscreen canvas (cached as bitmap).
function _makePugCanvas(w, h, opts) {
  const cv = document.createElement('canvas');
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  // drawPug anchors body around y=14 (feet); place the pug so feet sit near bottom.
  drawPug(c, w / 2, h - 4, opts);
  return cv;
}

const _staff = document.createElement('div'); _staff.className = 'cafe-staff';
const _staffCanvas = _makePugCanvas(56, 56, { size: 48, body: '#c8854a', mask: '#1a0d05', chef: true, tongueOut: true });
_staffCanvas.className = 'cafe-staff__canvas';
_staff.appendChild(_staffCanvas);
const _staffBubEl = document.createElement('span'); _staffBubEl.className = 'cafe-staff__bub'; _staffBubEl.textContent = 'bork!';
_staff.appendChild(_staffBubEl);
document.body.appendChild(_staff);
const _staffBub = _staffBubEl;

// Customer crowd — varied body colors so it feels like a crowded café.
const _customers = document.createElement('div'); _customers.className = 'cafe-customers';
const _CUSTOMER_COLORS = [
  { body: '#c8854a', mask: '#1a0d05' },          // classic fawn
  { body: '#a89888', mask: '#3a2818' },          // silver
  { body: '#5a5a5a', mask: '#0a0a0a' },          // black
  { body: '#eac888', mask: '#5a3a1a' },          // cream
  { body: '#fafaff', mask: '#a08878' },          // white
  { body: '#8a5a2a', mask: '#1a0a04' },          // chocolate
];
// Wave 1F: bump from 6 to 8 customer slots — booths/bar/patio variety.
// We rotate through type badges so the crowd visibly reads as varied.
const _CUSTOMER_BADGE_TYPES = ['NORMAL', 'HUNGRY', 'VIP', 'KAREN', 'TOURIST', 'NORMAL', 'HUNGRY', 'NORMAL'];
for (let i = 0; i < 8; i++) {
  const col = _CUSTOMER_COLORS[i % _CUSTOMER_COLORS.length];
  const wrap = document.createElement('span'); wrap.className = 'cafe-customer';
  const cv = _makePugCanvas(44, 48, { size: 42, body: col.body, mask: col.mask, tongueOut: i % 3 === 0 });
  wrap.appendChild(cv);
  // Add a small type-badge above the head
  const badge = document.createElement('span');
  badge.className = 'cafe-customer__badge';
  const ct = CUSTOMER_TYPES[_CUSTOMER_BADGE_TYPES[i]] || CUSTOMER_TYPES.NORMAL;
  badge.textContent = ct.icon;
  badge.title = ct.name;
  wrap.appendChild(badge);
  _customers.appendChild(wrap);
}
document.body.appendChild(_customers);

// === WAVE 1F: ESPRESSO machine in kitchen ===
const _espresso = document.createElement('div');
_espresso.className = 'cafe-espresso';
_espresso.innerHTML = `
  <div class="cafe-espresso__top"></div>
  <div class="cafe-espresso__spout"></div>
  <div class="cafe-espresso__drip"></div>
  <div class="cafe-espresso__cup"></div>
`;
const _kitchen = document.querySelector('.cafe-kitchen');
if (_kitchen) _kitchen.appendChild(_espresso);

// === WAVE 1F: CAFE NAME CHIP + SELECT MODAL ===
const _cafeChip = document.createElement('button');
_cafeChip.className = 'cafe-name-chip';
_cafeChip.id = 'cafe-name-chip';
document.body.appendChild(_cafeChip);
const _cafeSelectModal = document.createElement('div');
_cafeSelectModal.className = 'cafe-select-modal';
_cafeSelectModal.id = 'cafe-select-modal';
_cafeSelectModal.innerHTML = `
  <div class="cafe-select-modal__panel">
    <h2 class="cafe-select-title">★ SELECT CAFÉ ★</h2>
    <div class="cafe-select-sub" id="cafe-select-sub">Unlock cafes by total tips earned across all runs</div>
    <div id="cafe-select-list"></div>
    <button class="cafe-shop-close" id="cafe-select-close">CLOSE</button>
  </div>
`;
document.body.appendChild(_cafeSelectModal);
_cafeChip.addEventListener('click', openCafeSelect);
document.getElementById('cafe-select-close').addEventListener('click', () => _cafeSelectModal.classList.remove('is-open'));
_cafeSelectModal.addEventListener('click', (e) => { if (e.target === _cafeSelectModal) _cafeSelectModal.classList.remove('is-open'); });

function openCafeSelect() {
  const sub = document.getElementById('cafe-select-sub');
  if (sub) sub.textContent = `Total tips earned: $${metaTotalTips} · Current: ${currentCafe().name}`;
  const list = document.getElementById('cafe-select-list');
  list.innerHTML = '';
  for (const id of CAFE_ORDER) {
    const c = CAFE_TYPES[id];
    const unlocked = cafeUnlocked(id);
    const isActive = currentCafeId === id;
    const card = document.createElement('div');
    card.className = 'cafe-select-card' + (isActive ? ' is-active' : '') + (unlocked ? '' : ' is-locked');
    card.innerHTML = `
      <div class="cafe-select-card__icon">${c.icon}</div>
      <div class="cafe-select-card__body">
        <div class="cafe-select-card__name">${c.name}</div>
        <div class="cafe-select-card__desc">${c.desc}</div>
        ${unlocked ? '' : `<div class="cafe-select-card__lock">🔒 LOCKED — earn $${c.needTips} total tips (${Math.max(0, c.needTips - metaTotalTips)} to go)</div>`}
      </div>
    `;
    if (unlocked && !isActive) {
      card.addEventListener('click', () => {
        currentCafeId = id;
        saveMeta();
        refreshCafeChip();
        showAccomplish(`★ ${c.name} ★`, 'Cafe switched — affects next shift', '#ffd23f');
        _cafeSelectModal.classList.remove('is-open');
      });
    }
    list.appendChild(card);
  }
  _cafeSelectModal.classList.add('is-open');
}
function refreshCafeChip() {
  if (!_cafeChip) return;
  const c = currentCafe();
  _cafeChip.innerHTML = `${c.icon} ${c.name}`;
  _cafeChip.title = c.desc;
}

// === WAVE 1F: DAILY CHALLENGE CHIP ===
const _dailyChip = document.createElement('button');
_dailyChip.className = 'cafe-daily-chip';
document.body.appendChild(_dailyChip);
function refreshDailyChip() {
  if (!_dailyChip) return;
  _dailyChallenge = dailyChallenge();
  const done = dailyDone();
  if (done) {
    _dailyChip.classList.add('is-complete');
    _dailyChip.innerHTML = `✓ DAILY: ${_dailyChallenge.label}`;
  } else {
    _dailyChip.classList.remove('is-complete');
    _dailyChip.innerHTML = `⚡ DAILY: ${_dailyChallenge.label}`;
  }
  _dailyChip.title = `Today's challenge — $100 bonus on first clear`;
}

// === WAVE 1F: SOUP OF THE DAY BANNER ===
const _soupBanner = document.createElement('div');
_soupBanner.className = 'cafe-soup-banner';
document.body.appendChild(_soupBanner);
function refreshSoupBanner() {
  if (!_soupBanner) return;
  const s = soupOfTheDay();
  if (s) _soupBanner.textContent = `🍲 SOUP OF THE DAY: ${s.name} (×2 pay)`;
}

// === WAVE 1F: HIRED STAFF SPRITE (visible when hireStaff upgrade owned) ===
const _staffHelper = document.createElement('div');
_staffHelper.className = 'cafe-staff-helper';
_staffHelper.style.display = 'none';
const _helperCanvas = _makePugCanvas(48, 48, { size: 42, body: '#5ef38c', mask: '#1a0d05', tongueOut: true });
_helperCanvas.className = 'cafe-staff-helper__canvas';
_staffHelper.appendChild(_helperCanvas);
const _helperLabel = document.createElement('span');
_helperLabel.className = 'cafe-staff-helper__label';
_helperLabel.textContent = 'HELPER';
_staffHelper.appendChild(_helperLabel);
document.body.appendChild(_staffHelper);
function refreshStaffHelper() {
  if (!_staffHelper) return;
  _staffHelper.style.display = upgrades.hireStaff ? 'block' : 'none';
}

// === WAVE 1F: TIP MULTIPLIER CHIP (visible during combo) ===
const _tipMultChip = document.createElement('div');
_tipMultChip.className = 'cafe-tip-mult';
document.body.appendChild(_tipMultChip);
function updateTipMultChip() {
  if (!_tipMultChip) return;
  if (comboCount > 1) {
    _tipMultChip.classList.add('is-show');
    _tipMultChip.textContent = `COMBO ×${comboCount} · +$${(comboCount - 1) * 5}/order · ${comboT.toFixed(1)}s`;
  } else {
    _tipMultChip.classList.remove('is-show');
  }
}

// === WAVE 1F: BENCH TOOLS upgrade visual (icons above bench) ===
function refreshBenchTools() {
  const benchEl = document.getElementById('bench');
  if (!benchEl) return;
  let tools = benchEl.querySelector('.cafe-bench-tools');
  if (!tools) {
    tools = document.createElement('div');
    tools.className = 'cafe-bench-tools';
    benchEl.style.position = 'relative';
    benchEl.appendChild(tools);
  }
  tools.innerHTML = '';
  // Show tool icons matching purchased upgrades (visible "stuff you bought")
  if (upgrades.autoCook)    tools.innerHTML += `<span class="cafe-bench-tools__icon" title="Auto-cook">🤖</span>`;
  if (upgrades.extraBench)  tools.innerHTML += `<span class="cafe-bench-tools__icon" title="Extra bench">🪑</span>`;
  if (upgrades.fastServe)   tools.innerHTML += `<span class="cafe-bench-tools__icon" title="Fast serve">⚡</span>`;
  if (upgrades.patient)     tools.innerHTML += `<span class="cafe-bench-tools__icon" title="Patient customers">⏰</span>`;
  if (upgrades.hireStaff)   tools.innerHTML += `<span class="cafe-bench-tools__icon" title="Hired helper">🐶</span>`;
  // Bench upgrades (per 10 served) — visible tool icons indicating tier
  const benchTier = Math.floor(served / 10);
  for (let i = 0; i < Math.min(4, benchTier); i++) {
    tools.innerHTML += `<span class="cafe-bench-tools__icon" title="Bench tier ${i + 1}">🔪</span>`;
  }
}
const _staffPhrases = ['bork!', 'chef!', 'snrk', 'order up!', 'woof', 'zzz…', 'OK!'];
setInterval(() => {
  if (!running) return;
  _staffBub.textContent = _staffPhrases[Math.floor(Math.random() * _staffPhrases.length)];
  _staffBub.classList.add('is-active');
  setTimeout(() => _staffBub.classList.remove('is-active'), 1400);
}, 3400);

function popup(x, y, text, color) {
  const div = document.createElement('div');
  div.className = 'cafe-popup';
  div.textContent = text;
  div.style.left = x + 'px'; div.style.top = y + 'px';
  div.style.color = color || '#5ef38c';
  _popups.appendChild(div);
  setTimeout(() => div.remove(), 1100);
}
function flashChip(stationEl) {
  if (!stationEl) return;
  stationEl.classList.remove('cafe-flash');
  void stationEl.offsetWidth;
  stationEl.classList.add('cafe-flash');
}
// Round 2C: bigger "$" tip popup with rotation + scale punch
function tipPopup(x, y, text) {
  const div = document.createElement('div');
  div.className = 'cafe-tip';
  div.textContent = text;
  div.style.left = x + 'px'; div.style.top = y + 'px';
  _popups.appendChild(div);
  setTimeout(() => div.remove(), 1500);
}
// Round 2C: angry customer leaving — red smoke + cloud emote at a screen pt
function angryEmote(x, y) {
  const sm = document.createElement('div');
  sm.className = 'cafe-angry-smoke';
  sm.style.left = x + 'px'; sm.style.top = y + 'px';
  _popups.appendChild(sm);
  setTimeout(() => sm.remove(), 1000);
  const em = document.createElement('div');
  em.className = 'cafe-angry-cloud';
  em.textContent = Math.random() < 0.5 ? '💢' : '😡';
  em.style.left = x + 'px'; em.style.top = y + 'px';
  _popups.appendChild(em);
  setTimeout(() => em.remove(), 1300);
}
// Round 2C: drift wisps for burnt orders (3 small grey puffs)
function burntWisps(x, y) {
  for (let i = 0; i < 3; i++) {
    const w = document.createElement('div');
    w.className = 'cafe-burnt-wisp';
    w.style.left = x + 'px'; w.style.top = (y - i * 6) + 'px';
    w.style.setProperty('--wx', ((Math.random() - 0.5) * 40) + 'px');
    w.style.animationDelay = (i * 0.18) + 's';
    _popups.appendChild(w);
    setTimeout(() => w.remove(), 1700);
  }
}
// Round 2C: color-chain bonus arc — quick SVG curve between two points to
// reinforce the same-color combo visually. Both points are viewport coords.
function chainArc(x1, y1, x2, y2, color) {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'cafe-chain-arc');
  const left = Math.min(x1, x2) - 20;
  const top = Math.min(y1, y2) - 60;
  const w = Math.abs(x2 - x1) + 40;
  const h = Math.abs(y2 - y1) + 120;
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.style.left = left + 'px';
  svg.style.top = top + 'px';
  const path = document.createElementNS(svgNs, 'path');
  const sx = x1 - left, sy = y1 - top;
  const ex = x2 - left, ey = y2 - top;
  const cx = (sx + ex) / 2, cy = Math.min(sy, ey) - 60;
  path.setAttribute('d', `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', color || '#ffd23f');
  path.setAttribute('stroke-width', 3);
  path.setAttribute('stroke-dasharray', 100);
  svg.appendChild(path);
  _popups.appendChild(svg);
  setTimeout(() => svg.remove(), 760);
}
function screenShake() {
  document.body.classList.remove('cafe-shake');
  void document.body.offsetWidth;
  document.body.classList.add('cafe-shake');
  setTimeout(() => document.body.classList.remove('cafe-shake'), 360);
}

const INGREDIENTS = [
  { id: 'bacon', icon: '🥓', iconName: 'bacon',  name: 'Bacon' },
  { id: 'cake',  icon: '🧁', iconName: 'cake',   name: 'Pupcake' },
  { id: 'slime', icon: '🟢',                       name: 'Slime' },        // no library match — keep unicode dot
  { id: 'noodle', icon: '🍜',                      name: 'Glow Noodle' },  // no match
  { id: 'fish',  icon: '🐟',                       name: 'Fish' },         // no match
  { id: 'milk',  icon: '🥛', iconName: 'milk',    name: 'Milk' },
  { id: 'bone',  icon: '🦴', iconName: 'bone',    name: 'Bone' },
  { id: 'cheese', icon: '🧀', iconName: 'cheese', name: 'Cheese' },
  { id: 'pickle', icon: '🥒',                      name: 'Pickle' },       // no match
  { id: 'donut', icon: '🍩', iconName: 'biscuit', name: 'Donut' },         // closest round-pastry match
];

// Recipes are tagged with a `type` for the "8 dish types" requirement.
// Each cafe later picks which subset to spawn from.
const RECIPES = [
  { name: 'Triple Bacon Pupcake', items: ['bacon', 'bacon', 'cake'], pay: 30, type: 'pastry' },
  { name: 'Slime Smoothie',       items: ['slime', 'milk'], pay: 18, type: 'drink' },
  { name: 'Glowing Noodles',      items: ['noodle', 'cheese'], pay: 22, type: 'noodle' },
  { name: 'Fish Bone Stew',       items: ['fish', 'bone'], pay: 20, type: 'soup' },
  { name: 'Pickle Donut',         items: ['pickle', 'donut'], pay: 16, type: 'sandwich' },
  { name: 'Bacon Cheesebone',     items: ['bacon', 'cheese', 'bone'], pay: 32, type: 'sandwich' },
  { name: 'Triple Slime',         items: ['slime', 'slime', 'slime'], pay: 38, type: 'drink' },
  { name: 'Pup Pizza',            items: ['cheese', 'bacon', 'donut'], pay: 40, type: 'pizza' },
  { name: 'Fish Smoothie',        items: ['fish', 'milk'], pay: 18, type: 'drink' },
  { name: 'Glow Donut Stack',     items: ['noodle', 'donut', 'cake'], pay: 42, type: 'pastry' },
  { name: 'Bacon Pickle Slime',   items: ['bacon', 'pickle', 'slime'], pay: 36, type: 'salad' },
  { name: 'Cheese Donut Bake',    items: ['cheese', 'donut'], pay: 24, type: 'pastry' },
  { name: 'Quad Bacon Madness',   items: ['bacon', 'bacon', 'bacon', 'bacon'], pay: 60, type: 'specialty' },
  { name: 'Fish Pickle Latte',    items: ['fish', 'pickle', 'milk'], pay: 30, type: 'drink' },
  { name: 'Bone Cheese Donut',    items: ['bone', 'cheese', 'donut'], pay: 38, type: 'pastry' },
  { name: 'Noodle Bone Soup',     items: ['noodle', 'bone'], pay: 22, type: 'soup' },
  { name: 'Mega Pup Special',     items: ['cake', 'cake', 'bacon', 'donut'], pay: 70, type: 'specialty' },
  // === WAVE 1F: 3 new recipes covering the missing dish types ===
  { name: 'Pickle Garden Salad',  items: ['pickle', 'pickle', 'milk'], pay: 26, type: 'salad' },
  { name: 'Croque Pug',           items: ['cheese', 'bacon', 'milk'], pay: 34, type: 'sandwich' },
  { name: 'Fish Pizza',           items: ['cheese', 'fish', 'donut'], pay: 44, type: 'pizza' },
];

// === WAVE 1F: 3 CAFE TYPES (unlocked by progression) ===
// Cozy = current (~24s timeouts). Busy = faster spawns + tighter timeouts +
// smaller tips. Fancy = slow spawns + huge tips + complex orders + KAREN/VIP
// only. Unlock by total tips earned ever (meta progression).
const CAFE_TYPES = {
  cozy:  { name: 'COZY CORNER',  icon: '🏠', desc: 'Balanced tips.',          maxTime: 24, tipMult: 1.0, customerWeights: { HUNGRY: 35, VIP: 10, KAREN: 15, TOURIST: 20, NORMAL: 20 }, recipePool: null,                 needTips: 0 },
  busy:  { name: 'BUSY BISTRO',  icon: '🏙', desc: 'Fast spawns, tight time.',maxTime: 18, tipMult: 1.2, customerWeights: { HUNGRY: 50, VIP: 5,  KAREN: 25, TOURIST: 10, NORMAL: 10 }, recipePool: null,                 needTips: 800 },
  fancy: { name: 'FANCY FRENCH', icon: '🥂', desc: 'Huge tips, complex.',     maxTime: 32, tipMult: 1.8, customerWeights: { HUNGRY: 5,  VIP: 45, KAREN: 35, TOURIST: 5,  NORMAL: 10 }, recipePool: (r) => r.pay >= 30, needTips: 2200 },
};
const CAFE_ORDER = ['cozy', 'busy', 'fancy'];
let currentCafeId = 'cozy';
function currentCafe() { return CAFE_TYPES[currentCafeId]; }

// === WAVE 1F: CUSTOMER TYPES ===
// Each new order gets a customerType. Type drives tip multiplier, patience,
// behavior (KARENs decrease tips, VIPs require perfect timing for max bonus,
// HUNGRY tip extra for fast service, TOURISTs have hidden / scrambled orders).
const CUSTOMER_TYPES = {
  NORMAL:  { id: 'NORMAL',  icon: '🐶', patience: 1.0,  tipMult: 1.0, color: '#c8854a', name: 'NORMAL' },
  HUNGRY:  { id: 'HUNGRY',  icon: '😋', patience: 0.75, tipMult: 1.5, color: '#ff8e3c', name: 'HUNGRY' },
  VIP:     { id: 'VIP',     icon: '👔', patience: 1.6,  tipMult: 2.5, color: '#ffd23f', name: 'VIP' },
  KAREN:   { id: 'KAREN',   icon: '😤', patience: 0.55, tipMult: 0.6, color: '#ff3a3a', name: 'KAREN' },
  TOURIST: { id: 'TOURIST', icon: '🧳', patience: 1.2,  tipMult: 1.1, color: '#4cc9f0', name: 'TOURIST' },
};
function pickCustomerType() {
  const w = currentCafe().customerWeights || { NORMAL: 100 };
  let total = 0;
  for (const k in w) total += w[k];
  let r = Math.random() * total;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'NORMAL';
}

// === WAVE 1F: SOUP OF THE DAY ===
// Pick one soup-type recipe per UTC day. Doubles its pay when ordered.
function todayUtcKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
function _seededInt(seed, max) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h % max;
}
function soupOfTheDay() {
  // Use any non-drink recipe pool — soup, pastry, sandwich, etc.
  const pool = RECIPES.filter((r) => r.type !== 'drink');
  return pool[_seededInt(todayUtcKey(), pool.length)];
}

const STAFF_EVENTS = [
  'A pug ATE your bacon.',
  'A pug fell asleep on the milk.',
  'A pug chased a pigeon out the window.',
  'A pug knocked over the noodles.',
  'A pug snored. Order delayed.',
  'A pug sat in the cake.',
  'A pug barked at the door for 20 seconds.',
  'A pug brought you a stick instead.',
];

let orders, bench, money, served, lives, spawnT, eventT, running;
let comboT = 0, comboCount = 0; // serve combo within window
// Shop upgrades — purchased flags reset per run. autoCookT counts down to next autocook trigger.
const SHOP_DEFS = [
  { id: 'autoCook',  name: 'AUTO-COOK',         cost: 250, icon: '🤖', desc: 'Auto-completes 1 ingredient in oldest order every 5s' },
  { id: 'extraBench',name: 'EXTRA BENCH',       cost: 350, icon: '🪑', desc: 'Bench capacity +2' },
  { id: 'fastServe', name: 'FAST SERVE',        cost: 300, icon: '⚡', desc: 'Skip serve animation (instant)' },
  { id: 'patient',   name: 'PATIENT CUSTOMERS', cost: 450, icon: '⏰', desc: 'Order timeouts +50%' },
  // Wave 1F: staff hire — 2nd AI server that pre-grabs needed ingredients
  { id: 'hireStaff', name: 'HIRE 2nd SERVER',   cost: 600, icon: '🐶', desc: 'AI server auto-grabs ingredients for oldest order' },
];
let upgrades = {}; // id -> true when owned
let autoCookT = 0;
// Wave 1F: extra timers + shift stats
let hireGrabT = 0;
let karenFightCheckT = 0;
let shiftStats = {};
function reset() {
  orders = []; bench = []; money = 0; served = 0; lives = 4;
  spawnT = 1.5; eventT = 5;
  comboT = 0; comboCount = 0;
  upgrades = {}; autoCookT = 5;
  hireGrabT = 4; karenFightCheckT = 1.5;
  shiftStats = { bestTip: 0, longestChain: 0, specialsServed: 0, vipsServed: 0, karensCalmed: 0, burnt: 0, mostChaotic: '', startedAt: performance.now() };
  renderShopChips();
}

// === WAVE 1F: META PROGRESSION (persists between runs) ===
const META_KEY = () => `wg:pugcafe:meta`;
let metaTotalTips = 0;
function loadMeta() {
  try {
    const raw = localStorage.getItem(META_KEY());
    const m = raw ? JSON.parse(raw) : {};
    metaTotalTips = m.totalTips || 0;
    currentCafeId = m.lastCafe && CAFE_TYPES[m.lastCafe] ? m.lastCafe : 'cozy';
  } catch { metaTotalTips = 0; currentCafeId = 'cozy'; }
}
function saveMeta() {
  try {
    localStorage.setItem(META_KEY(), JSON.stringify({ totalTips: metaTotalTips, lastCafe: currentCafeId }));
  } catch {}
}
function cafeUnlocked(id) {
  const c = CAFE_TYPES[id];
  if (!c) return false;
  return metaTotalTips >= (c.needTips || 0);
}

// === WAVE 1F: ACCOMPLISHMENT POPUP (large celebratory banner) ===
function showAccomplish(title, sub, color) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;top:30%;left:50%;transform:translate(-50%,-50%) scale(0.4);
    z-index:260;padding:18px 30px;border-radius:10px;
    font-family:var(--font-display);font-size:0.95rem;letter-spacing:0.1em;
    background:rgba(10,7,22,0.96);border:4px solid ${color || '#ffd23f'};
    color:${color || '#ffd23f'};text-align:center;opacity:0;pointer-events:none;
    transition:opacity 0.3s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    text-shadow:0 0 12px currentColor;`;
  el.innerHTML = `${title}<div style="font-size:0.45rem;color:var(--text-soft);margin-top:6px;letter-spacing:0.05em;">${sub || ''}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 2200);
}

// === WAVE 1F: DAILY CHALLENGE (one per UTC day) ===
const DAILY_CHALLENGES = [
  { id: 'serve_30',   label: 'Serve 30 orders',              check: () => served >= 30,                target: 30, current: () => served },
  { id: 'money_400',  label: 'Hit $400 with no burnt orders',check: () => money >= 400 && (shiftStats.burnt || 0) === 0, target: 400, current: () => money },
  { id: 'chain_5',    label: 'Hit a 5-combo serve streak',   check: () => (shiftStats.longestChain || 0) >= 5, target: 5, current: () => shiftStats.longestChain || 0 },
  { id: 'serve_3vip', label: 'Serve 3 VIP customers',        check: () => (shiftStats.vipsServed || 0) >= 3,  target: 3, current: () => shiftStats.vipsServed || 0 },
  { id: 'special_1',  label: 'Serve 1 SPECIAL dish perfectly',check: () => (shiftStats.specialsServed || 0) >= 1, target: 1, current: () => shiftStats.specialsServed || 0 },
];
function dailyChallenge() {
  return DAILY_CHALLENGES[_seededInt(todayUtcKey(), DAILY_CHALLENGES.length)];
}
const DAILY_DONE_KEY = () => `wg:pugcafe:dailyDone`;
function dailyDone() {
  try {
    const raw = localStorage.getItem(DAILY_DONE_KEY());
    if (!raw) return false;
    const obj = JSON.parse(raw);
    return obj && obj.day === todayUtcKey();
  } catch { return false; }
}
function markDailyDone() {
  try { localStorage.setItem(DAILY_DONE_KEY(), JSON.stringify({ day: todayUtcKey() })); } catch {}
}
let _dailyChallenge = null;
function checkDailyChallenge() {
  if (!_dailyChallenge || dailyDone()) return;
  if (_dailyChallenge.check()) {
    markDailyDone();
    showAccomplish('★ DAILY CHALLENGE! ★', _dailyChallenge.label, '#4cc9f0');
    const reward = 100;
    money += reward;
    try { sfx.arp([523, 659, 880, 1320], 'triangle', 0.06, 0.22, 0.22); } catch {}
    updateHud();
    // Refresh visual chip
    if (_dailyChip) {
      _dailyChip.classList.add('is-complete');
      _dailyChip.innerHTML = `✓ ${_dailyChallenge.label}`;
    }
  } else if (_dailyChip) {
    _dailyChip.innerHTML = `⚡ ${_dailyChallenge.label}<br><span style="opacity:0.7;">${_dailyChallenge.current()} / ${_dailyChallenge.target}</span>`;
  }
}

// Diner Dash table-color chain bonus: each new order is tagged with a color.
// Two CONSECUTIVE orders (in spawn order) sharing the same color = "adjacent
// same-colour customers" → +20% tip multiplier on the second (and on each
// further chained-same-color order, scaling).
const ORDER_COLORS = [
  { id: 'fawn',     hex: '#c8854a', name: 'fawn' },
  { id: 'silver',   hex: '#a89888', name: 'silver' },
  { id: 'black',    hex: '#5a5a5a', name: 'black' },
  { id: 'cream',    hex: '#eac888', name: 'cream' },
  { id: 'white',    hex: '#fafaff', name: 'white' },
  { id: 'choc',     hex: '#8a5a2a', name: 'choc' },
];
function spawnOrder() {
  // Cafe-aware recipe pool
  const cafe = currentCafe();
  let pool = RECIPES;
  if (cafe.recipePool) pool = pool.filter(cafe.recipePool);
  if (pool.length === 0) pool = RECIPES;
  const r = pool[Math.floor(Math.random() * pool.length)];
  // Cafe sets the base patience; upgrades.patient stacks; customer type
  // multiplies it.
  const customerType = pickCustomerType();
  const ct = CUSTOMER_TYPES[customerType] || CUSTOMER_TYPES.NORMAL;
  let maxT = (cafe.maxTime || 24) * ct.patience;
  if (upgrades.patient) maxT *= 1.5;
  // Pick a color. ~30% chance to match the *previous* order's color so chains
  // form often enough to feel rewarding without trivialising the bonus.
  let col;
  if (orders.length > 0 && Math.random() < 0.3) {
    col = orders[orders.length - 1].color;
  } else {
    col = ORDER_COLORS[Math.floor(Math.random() * ORDER_COLORS.length)];
  }
  // Chain length = how many in-a-row prior orders share this color.
  let chainLen = 1;
  for (let i = orders.length - 1; i >= 0; i--) {
    if (orders[i].color && orders[i].color.id === col.id) chainLen++;
    else break;
  }
  // Wave 1F: SPECIAL DISH — 12% chance per spawn. Pays 3x, but requires
  // PERFECT freshness (serve within 5s of plating). KARENs/TOURISTs don't get
  // specials (only NORMAL/HUNGRY/VIP).
  const isSpecial = (customerType === 'NORMAL' || customerType === 'HUNGRY' || customerType === 'VIP')
    && Math.random() < 0.12;
  // Wave 1F: SOUP OF THE DAY — when this recipe matches today's soup, double pay.
  const sotd = soupOfTheDay();
  const isSotd = sotd && r.name === sotd.name;
  orders.push({
    recipe: r,
    items: r.items.map((i) => ({ id: i, done: false })),
    time: maxT,
    maxTime: maxT,
    color: col,
    chainLen, // 1 = solo, 2 = +20% tip, 3 = +40%, etc.
    customerType,
    isSpecial,
    isSotd,
    // Burnt-food freshness — null until all ingredients arrive on the bench
    // (i.e., the order is "plated"). Then ticks up: 0..5 perfect, 5..10
    // burnt, >10 must-discard.
    freshnessT: null,
    bornAt: performance.now(),
  });
  renderOrders();
  updateChalkboard();
  // Wave 1F: KAREN FIGHT — if 2+ KARENS are unattended (no served ingredient)
  // for >8s, they "fight" — both vanish, both cost a life. Telegraphed by the
  // fight marker. Use a periodic check in tick() rather than spawn-time.
}

function renderKitchen() {
  const k = document.getElementById('kitchen');
  k.innerHTML = '';
  for (const ing of INGREDIENTS) {
    const el = document.createElement('div');
    el.className = 'station';
    el.innerHTML = `<div class="station__icon">${_ingIcon(ing)}</div><div class="station__name">${ing.name}</div>`;
    el.style.position = 'relative';
    el.addEventListener('click', () => grab(ing, el));
    const mat = document.createElement('div'); mat.className = 'placemat'; el.appendChild(mat);
    k.appendChild(el);
  }
}

function renderOrders() {
  const el = document.getElementById('orders');
  el.innerHTML = '';
  if (orders.length === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:0.5rem;padding:6px;">No orders yet…</span>';
    return;
  }
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const div = document.createElement('div');
    div.dataset.orderIdx = i;
    div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('is-drop-target'); });
    div.addEventListener('dragleave', () => div.classList.remove('is-drop-target'));
    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('is-drop-target');
      // Overcooked-style flick: dropping a single ingredient from the bench
      // immediately adds it (i.e., "throws" across the counter). If the order
      // is fully satisfied after adding, auto-serve.
      const ingId = e.dataTransfer?.getData('text/plain');
      if (!ingId) return;
      throwIngredient(ingId, i, e.clientX, e.clientY);
    });
    let cls = 'order';
    const k = o.time / o.maxTime;
    if (k < 0.3) cls += ' crit';
    else if (k < 0.6) cls += ' warn';
    if (o.isSpecial) cls += ' is-special';
    // Freshness state classes — burnt (5..10s) gets red border; the >10s
    // discard transition is handled by tick() and never reaches the UI.
    let burntPct = 0;
    let stateLabel = '';
    if (o.freshnessT != null) {
      if (o.freshnessT > 5) {
        cls += ' is-burnt';
        burntPct = Math.min(1, (o.freshnessT - 5) / 5);
        stateLabel = '🔥 BURNT';
      } else {
        stateLabel = '✨ FRESH';
      }
    }
    div.className = cls;
    const chainBadge = o.chainLen > 1
      ? `<span style="background:${o.color.hex};color:#0a0716;padding:1px 5px;border-radius:3px;font-size:0.32rem;letter-spacing:0.05em;margin-left:4px;text-shadow:none;">CHAIN ×${o.chainLen}</span>`
      : '';
    const colorDot = o.color
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${o.color.hex};border:1px solid rgba(0,0,0,0.6);margin-right:4px;vertical-align:middle;"></span>`
      : '';
    // Wave 1F: customer-type badge above name
    const ct = CUSTOMER_TYPES[o.customerType] || CUSTOMER_TYPES.NORMAL;
    const custBadge = `<span class="cafe-cb" title="${ct.name} pat${(ct.patience*100).toFixed(0)}% tip${(ct.tipMult*100).toFixed(0)}%" style="background:${ct.color}22;border-color:${ct.color};color:${ct.color}">${ct.icon} ${ct.name}</span>`;
    const specialTag = o.isSpecial ? '<span class="order__special-tag">★ SPECIAL 3×</span>' : '';
    const sotdTag = o.isSotd ? '<span style="background:rgba(94,243,140,0.2);color:#5ef38c;padding:1px 4px;border-radius:2px;font-size:0.32rem;letter-spacing:0.05em;margin-left:4px;">SOUP×2</span>' : '';
    // Pay preview includes chain bonus + burnt penalty + customer mult + special + sotd
    let payShown = o.recipe.pay;
    payShown *= ct.tipMult;
    payShown *= (currentCafe().tipMult || 1);
    if (o.chainLen > 1) payShown *= (1 + (o.chainLen - 1) * 0.2);
    if (o.freshnessT != null && o.freshnessT > 5) payShown *= (1 - burntPct * 0.5);
    if (o.isSpecial && o.freshnessT != null && o.freshnessT < 5) payShown *= 3;
    if (o.isSotd) payShown *= 2;
    payShown = Math.round(payShown);
    div.innerHTML = `
      <h4>${custBadge}${colorDot}${o.recipe.name}${chainBadge}${specialTag}${sotdTag}</h4>
      <ul>${o.items.map((it) => {
        const ing = INGREDIENTS.find((g) => g.id === it.id);
        const iconHtml = ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](14) : ing.icon;
        // Wave 1F: tourists scramble their order — show ??? for half the items
        const hideTourist = ct.id === 'TOURIST' && !it.done && (it.id.charCodeAt(0) % 2 === 0);
        const showLabel = hideTourist ? '???' : ing.name;
        return `<li class="${it.done ? 'done' : ''}"><span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;">${iconHtml}</span><span>${showLabel}</span></li>`;
      }).join('')}</ul>
      <div class="order__timer"><div class="order__timer-fill" style="width:${k * 100}%;background:${k < 0.3 ? '#ff3a3a' : (k < 0.6 ? '#ffd23f' : '#5ef38c')}"></div></div>
      ${o.freshnessT != null ? `
        <div style="margin-top:3px;height:5px;background:rgba(0,0,0,0.6);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100, (o.freshnessT / 10) * 100)}%;background:${o.freshnessT > 5 ? '#ff3a3a' : '#ffd23f'};transition:width 0.1s linear;"></div>
        </div>
        <div style="font-size:0.34rem;color:${o.freshnessT > 5 ? '#ff8a8a' : '#ffd23f'};letter-spacing:0.05em;margin-top:1px;text-align:right;">${stateLabel}</div>
      ` : ''}
      <button class="serve-btn" data-idx="${i}" style="margin-top:6px;width:100%;">SERVE $${payShown}</button>
    `;
    el.appendChild(div);
  }
  el.querySelectorAll('.serve-btn').forEach((b) => b.addEventListener('click', () => serve(+b.dataset.idx)));
  updateChalkboard();
}

function updateChalkboard() {
  const list = document.getElementById('cafe-chalk-list');
  if (!list) return;
  if (!orders || orders.length === 0) {
    list.innerHTML = '<div class="cafe-chalk__empty">no orders yet</div>';
    return;
  }
  list.innerHTML = orders.slice(0, 6).map((o) => {
    const k = o.time / o.maxTime;
    const cls = k < 0.3 ? 'crit' : (k < 0.6 ? 'warn' : '');
    return `<div class="cafe-chalk__line ${cls}">• ${o.recipe.name} $${o.recipe.pay}</div>`;
  }).join('') + (orders.length > 6 ? `<div class="cafe-chalk__line">+${orders.length - 6} more…</div>` : '');
}

function renderBench() {
  const b = document.getElementById('bench');
  b.innerHTML = '';
  if (bench.length === 0) {
    b.innerHTML = '<span style="color:var(--muted);font-size:0.5rem;">empty bench (drag chips onto an order to throw 🎯)</span>';
    refreshBenchTools();
    return;
  }
  for (let i = 0; i < bench.length; i++) {
    const ing = INGREDIENTS.find((g) => g.id === bench[i]);
    const el = document.createElement('div');
    el.className = 'bench__held';
    el.draggable = true;
    el.title = 'Drag onto an order to THROW · click to discard';
    const iconHtml = ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](24) : ing.icon;
    el.innerHTML = `<div class="station__icon">${iconHtml}</div><div class="station__name">${ing.name}</div>`;
    el.addEventListener('click', () => { bench.splice(i, 1); renderBench(); });
    // Native drag-and-drop = chunky-but-works throw mechanic; touch users can
    // still use the SERVE button on each order card.
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', ing.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-throwing');
    });
    el.addEventListener('dragend', () => el.classList.remove('is-throwing'));
    b.appendChild(el);
  }
  refreshBenchTools();
}

// Overcooked throw: removes one of `ingId` from bench, marks it as fulfilling
// any matching needed slot on order `orderIdx`. If the order is now complete,
// auto-serve. Visual = quick popup along the throw arc.
function throwIngredient(ingId, orderIdx, clientX, clientY) {
  const o = orders[orderIdx];
  if (!o) return;
  const benchIdx = bench.indexOf(ingId);
  if (benchIdx === -1) return;
  // Check it's still needed
  const stillNeeded = o.items.some((it) => it.id === ingId && !it.done);
  if (!stillNeeded) {
    popup(clientX, clientY, '✗ NOT NEEDED', '#ff8a8a');
    sfx.tone(220, 'sawtooth', 0.08, 0.18);
    return;
  }
  // Consume one from bench + mark first matching slot done
  bench.splice(benchIdx, 1);
  for (const it of o.items) { if (it.id === ingId && !it.done) { it.done = true; break; } }
  popup(clientX, clientY, '🍳 THROW!', '#ffd23f');
  sfx.tone(820, 'triangle', 0.05, 0.16);
  // Auto-serve if every slot is filled
  if (o.items.every((it) => it.done)) {
    // We need to make sure bench has ALL items, because serve() re-checks.
    // Add the marked-done items back to bench so serve() can consume them.
    for (const it of o.items) bench.push(it.id);
    serve(orderIdx);
  } else {
    renderBench(); renderOrders();
  }
}

function grab(ing, srcEl) {
  // Bench capacity grows with served count (4 base + 1 per 10 served, max 8). +2 with extraBench shop.
  const cap = Math.min(10, 4 + Math.floor(served / 10) + (upgrades.extraBench ? 2 : 0));
  if (bench.length >= cap) { showEvent(`Bench full (${cap})!`); return; }
  bench.push(ing.id);
  sfx.tone(660, 'triangle', 0.06, 0.18);
  if (srcEl) flashChip(srcEl);
  renderBench();
}

function serve(idx) {
  const o = orders[idx];
  if (!o) return;
  // Check that bench contains all needed items
  const need = o.recipe.items.slice();
  const benchCopy = bench.slice();
  for (const n of need) {
    const i = benchCopy.indexOf(n);
    if (i === -1) {
      showEvent('Missing ingredient!');
      sfx.tone(165, 'sawtooth', 0.1, 0.18);
      popup(window.innerWidth / 2, window.innerHeight / 2, 'MISS', '#ff3a3a');
      return;
    }
    benchCopy.splice(i, 1);
  }
  // Success
  bench = benchCopy;
  // Combo: serves within 5s of each other stack
  if (comboT > 0) comboCount++; else comboCount = 1;
  comboT = 5;
  const comboBonus = comboCount > 1 ? (comboCount - 1) * 5 : 0;
  // Diner Dash CHAIN multiplier — +20% per chained same-color order beyond
  // the first (so chainLen 2 = +20%, chainLen 3 = +40%, etc.)
  const chainMult = o.chainLen && o.chainLen > 1 ? 1 + (o.chainLen - 1) * 0.2 : 1;
  // BURNT penalty — once freshness > 5s, payout scales linearly down by up
  // to 50% by the 10s mark. Below 5s = full price (and a quick "FRESH" tag).
  let freshnessMult = 1;
  let freshnessLabel = '';
  if (o.freshnessT != null) {
    if (o.freshnessT > 5) {
      const burntK = Math.min(1, (o.freshnessT - 5) / 5);
      freshnessMult = 1 - burntK * 0.5;
      freshnessLabel = '🔥 BURNT';
    } else {
      // Tiny bonus for serving FAST after plating — keeps the timer meaningful.
      freshnessLabel = '✨ FRESH';
      freshnessMult = 1.05;
    }
  }
  // Wave 1F: customer type multiplier + cafe baseline multiplier
  const ct = CUSTOMER_TYPES[o.customerType] || CUSTOMER_TYPES.NORMAL;
  const cafeMult = currentCafe().tipMult || 1;
  // Wave 1F: SPECIAL DISH bonus (3x) only when freshness < 5s (perfect)
  let specialMult = 1;
  if (o.isSpecial && o.freshnessT != null && o.freshnessT < 5) specialMult = 3;
  // Wave 1F: SOUP OF THE DAY double pay
  const sotdMult = o.isSotd ? 2 : 1;
  const pay = Math.round((o.recipe.pay + comboBonus) * chainMult * freshnessMult * ct.tipMult * cafeMult * specialMult * sotdMult);
  money += pay;
  served++;
  // Wave 1F: track shift stats for end-of-shift summary
  shiftStats.bestTip = Math.max(shiftStats.bestTip || 0, pay);
  shiftStats.longestChain = Math.max(shiftStats.longestChain || 0, comboCount || 0);
  if (o.isSpecial && specialMult === 3) shiftStats.specialsServed = (shiftStats.specialsServed || 0) + 1;
  if (o.customerType === 'VIP') shiftStats.vipsServed = (shiftStats.vipsServed || 0) + 1;
  if (o.customerType === 'KAREN') shiftStats.karensCalmed = (shiftStats.karensCalmed || 0) + 1;
  // Wave 1F: meta-progression — total tips ever (drives cafe unlocks)
  metaTotalTips = (metaTotalTips || 0) + pay;
  saveMeta();
  orders.splice(idx, 1);
  try {
    const tag = comboCount > 1 ? ` x${comboCount}` : '';
    const ch  = o.chainLen > 1 ? ` CHAIN×${o.chainLen}` : '';
    const fr  = freshnessLabel ? ` ${freshnessLabel}` : '';
    const sp  = (o.isSpecial && specialMult === 3) ? ' SPECIAL×3' : '';
    __cafeFeed && __cafeFeed.push(`SERVED · +$${pay}${tag}${ch}${fr}${sp}`, comboCount > 1 || o.chainLen > 1 || sp ? '#ff3aa1' : '#5ef38c');
  } catch (e) { /* */ }
  // Wave 1F: special-dish celebratory popup
  if (o.isSpecial && specialMult === 3) {
    showAccomplish(`★ SPECIAL DISH! ★`, `+$${pay} — PERFECT timing`, '#ffd23f');
    try { sfx.arp([523, 659, 880, 1320], 'triangle', 0.06, 0.22, 0.2); } catch {}
  }
  // Wave 1F: VIP perfect bonus
  if (o.customerType === 'VIP' && freshnessLabel === '✨ FRESH') {
    showAccomplish(`★ VIP SATISFIED ★`, `+$${pay} — flawless service`, '#ffd23f');
  }
  sfx.arp([523, 659, 784], 'triangle', 0.07, 0.22, 0.2);
  // Popup near the served order's button (approx center of orders bar)
  const ordersEl = document.getElementById('orders');
  const rect = ordersEl ? ordersEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: 100, width: 0, height: 0 };
  const popTag = (comboCount > 1 ? ` x${comboCount}` : '') + (o.chainLen > 1 ? ` CHAIN×${o.chainLen}` : '');
  popup(rect.left + rect.width / 2, rect.top + rect.height / 2, `+$${pay}${popTag}`, o.chainLen > 1 ? '#ffd23f' : (comboCount > 1 ? '#ff3aa1' : '#5ef38c'));
  // Round 2C: bigger $ tip popup over the bench so it reads as a real cash-out
  tipPopup(rect.left + rect.width / 2, rect.top + rect.height / 2 - 26, `$${pay}`);
  // Round 2C: arcing light between this order and the previous same-color
  // order when chained (telegraphs the chain bonus visually).
  if (o.chainLen > 1) {
    try {
      const orderBars = ordersEl ? ordersEl.querySelectorAll('.order') : [];
      // Connect first to last order so the arc spans visible chain
      if (orderBars.length >= 1) {
        const b = orderBars[0].getBoundingClientRect();
        const startX = b.left + b.width / 2, startY = b.top + b.height / 2;
        const endX = rect.left + rect.width / 2, endY = rect.top + rect.height / 2;
        chainArc(startX, startY, endX, endY, '#ffd23f');
      }
    } catch (e) { /* */ }
  }
  // Flash all kitchen chips when comboing
  if (comboCount > 1) {
    document.querySelectorAll('#kitchen .station').forEach((el, i) => setTimeout(() => flashChip(el), i * 20));
  }
  // Equipment upgrade milestones
  if (served === 10) showEvent('🪑 BENCH UPGRADED! +1 slot');
  if (served === 20) showEvent('🪑 BENCH UPGRADED! +1 slot');
  if (served === 30) showEvent('🪑 BENCH UPGRADED! +1 slot');
  if (served === 40) showEvent('🪑 BENCH UPGRADED! +1 slot (max 10)');
  if (served % 25 === 0 && served > 0) {
    money += 50; showEvent(`💰 $50 BONUS for ${served} served!`);
    popup(window.innerWidth / 2, window.innerHeight / 2, '+$50 BONUS', '#ffd23f');
  }
  renderBench(); renderOrders();
  updateHud();
}

// Perf: reusable Set for the bench-supply check (avoids per-frame array slice).
let _freshUsedIdx = null;
function tick(dt) {
  if (!running) return;
  _kitchenAmbience(dt);
  spawnT -= dt;
  if (spawnT <= 0) { spawnOrder(); spawnT = Math.max(1.6, 4 - served * 0.05); }
  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i];
    o.time -= dt;
    // ===== BURNT FOOD TIMER =====
    // Once the bench has every ingredient the order needs (i.e., it's
    // "plated/ready"), start the freshness clock. Player-served before 5s =
    // bonus; 5..10s = burnt (smaller pay); past 10s = auto-discard + smoke
    // alarm chime + lost life.
    if (o.freshnessT == null) {
      // Check whether bench supplies the recipe (multi-count safe).
      // Perf: avoid array slice per order per frame. Track index usage in a
      // reusable bit-array (Set of indices already "consumed").
      if (!_freshUsedIdx) _freshUsedIdx = new Set();
      _freshUsedIdx.clear();
      let ok = true;
      for (const n of o.recipe.items) {
        let found = -1;
        for (let bi = 0; bi < bench.length; bi++) {
          if (bench[bi] === n && !_freshUsedIdx.has(bi)) { found = bi; break; }
        }
        if (found === -1) { ok = false; break; }
        _freshUsedIdx.add(found);
      }
      if (ok) {
        o.freshnessT = 0;
        // Quick "plated" cue — small jingle so the player knows the freshness
        // window has started.
        sfx.tone(1320, 'triangle', 0.05, 0.16);
        popup(window.innerWidth / 2, window.innerHeight / 2 - 80, '✨ PLATED', '#ffd23f');
      }
    } else {
      o.freshnessT += dt;
      if (o.freshnessT >= 10) {
        // Smoke alarm + auto-discard + lost life
        orders.splice(i, 1);
        lives--;
        // Quick "smoke alarm" — two-note alternating beep that reads as a real alarm.
        sfx.tone(1760, 'square', 0.18, 0.28);
        setTimeout(() => sfx.tone(1320, 'square', 0.18, 0.28), 180);
        screenShake();
        popup(window.innerWidth / 2, window.innerHeight / 3, '🔥 BURNT!', '#ff3a3a');
        // Round 2C: smoke wisps + angry emote drift up from the orders bar
        const ordersBar = document.getElementById('orders');
        if (ordersBar) {
          const r = ordersBar.getBoundingClientRect();
          burntWisps(r.left + r.width / 2, r.top + r.height / 2);
          angryEmote(r.left + r.width / 2, r.top + 8);
        }
        try { __cafeFeed && __cafeFeed.push(`★ BURNT — discarded`, '#ff3a3a'); } catch (e) { /* */ }
        // Wave 1F: track burnt for daily challenge + shift summary
        shiftStats.burnt = (shiftStats.burnt || 0) + 1;
        if (lives <= 0) return end();
        updateHud();
        updateChalkboard();
        continue;
      }
    }
    if (o.time <= 0) {
      orders.splice(i, 1);
      lives--;
      sfx.sweep(220, 110, 'sawtooth', 0.3, 0.22);
      screenShake();
      popup(window.innerWidth / 2, window.innerHeight / 3, 'ANGRY!', '#ff3a3a');
      // Round 2C: angry customer cloud-emote + red smoke (where the order was)
      const ordersBar = document.getElementById('orders');
      if (ordersBar) {
        const r = ordersBar.getBoundingClientRect();
        angryEmote(r.left + r.width / 2, r.top + 8);
        burntWisps(r.left + r.width / 2, r.top + r.height / 2);
      }
      if (lives <= 0) return end();
      updateHud();
      updateChalkboard();
    }
  }
  // Combo decay
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) comboCount = 0; }
  eventT -= dt;
  if (eventT <= 0) {
    eventT = 8 + Math.random() * 6;
    chaosEvent();
  }
  // AUTO-COOK upgrade: every 5s pre-load a random missing ingredient onto bench
  if (upgrades.autoCook) {
    autoCookT -= dt;
    if (autoCookT <= 0) {
      autoCookT = 5;
      if (orders.length > 0) {
        // pick oldest order, find a needed ingredient not yet on bench enough
        const o = orders[0];
        const need = o.recipe.items.slice();
        const benchCopy = bench.slice();
        let missing = null;
        for (const n of need) {
          const i = benchCopy.indexOf(n);
          if (i === -1) { missing = n; break; }
          benchCopy.splice(i, 1);
        }
        if (missing) {
          const cap = Math.min(10, 4 + Math.floor(served / 10) + (upgrades.extraBench ? 2 : 0));
          if (bench.length < cap) {
            bench.push(missing);
            sfx.tone(880, 'sine', 0.05, 0.15);
            const ing = INGREDIENTS.find((g) => g.id === missing);
            popup(80, window.innerHeight - 120, `🤖 +${ing ? ing.name : missing}`, '#b055ff');
            renderBench();
          }
        }
      }
    }
  }
  // WAVE 1F: HIRED STAFF — grabs ingredients for oldest order every ~4s.
  if (upgrades.hireStaff) {
    hireGrabT -= dt;
    if (hireGrabT <= 0) {
      hireGrabT = 4;
      if (orders.length > 0) {
        const o = orders[0];
        const need = o.recipe.items.slice();
        const benchCopy = bench.slice();
        let missing = null;
        for (const n of need) {
          const i = benchCopy.indexOf(n);
          if (i === -1) { missing = n; break; }
          benchCopy.splice(i, 1);
        }
        if (missing) {
          const cap = Math.min(10, 4 + Math.floor(served / 10) + (upgrades.extraBench ? 2 : 0));
          if (bench.length < cap) {
            bench.push(missing);
            sfx.tone(700, 'sine', 0.04, 0.14);
            const ing = INGREDIENTS.find((g) => g.id === missing);
            popup(140, window.innerHeight - 120, `🐶 +${ing ? ing.name : missing}`, '#5ef38c');
            renderBench();
          }
        }
      }
    }
  }
  // WAVE 1F: KAREN FIGHT — if 2+ KAREN orders unattended for >8s, they fight.
  // Both vanish, both cost a life, scary fight marker plays.
  karenFightCheckT -= dt;
  if (karenFightCheckT <= 0) {
    karenFightCheckT = 1.5;
    const karens = orders.filter((o) => o.customerType === 'KAREN' && o.freshnessT == null && o.time < o.maxTime * 0.55);
    if (karens.length >= 2) {
      // Pick the first two
      const a = karens[0], b = karens[1];
      const aIdx = orders.indexOf(a), bIdx = orders.indexOf(b);
      const ordersBar = document.getElementById('orders');
      if (ordersBar) {
        const r = ordersBar.getBoundingClientRect();
        // Big fight marker
        const fm = document.createElement('div');
        fm.className = 'cafe-fight';
        fm.textContent = 'KAREN FIGHT! 💢';
        fm.style.left = (r.left + r.width / 2) + 'px';
        fm.style.top = (r.top + r.height / 2) + 'px';
        document.body.appendChild(fm);
        setTimeout(() => fm.remove(), 1500);
      }
      // Remove both (highest idx first)
      const removeIdx = [aIdx, bIdx].sort((x, y) => y - x);
      for (const ri of removeIdx) if (ri >= 0) orders.splice(ri, 1);
      lives -= 2;
      sfx.sweep(180, 90, 'sawtooth', 0.4, 0.24);
      screenShake();
      try { __cafeFeed && __cafeFeed.push(`★ KARENS FOUGHT — 2 lives lost`, '#ff3a3a'); } catch {}
      shiftStats.mostChaotic = 'KAREN FIGHT';
      if (lives <= 0) return end();
      updateHud();
      updateChalkboard();
    }
  }
  // Wave 1F: tip multiplier chip visibility
  updateTipMultChip();
  // Wave 1F: daily challenge progress check
  checkDailyChallenge();
  renderOrders();
}

function chaosEvent() {
  let which = Math.floor(Math.random() * 4);
  // If the random-bench-steal branch fires but bench is empty, slide to the
  // next branch — otherwise `msg` would stay undefined and a literal
  // "undefined" would appear in the staff-events feed.
  if (which === 0 && bench.length === 0) which = 1;
  let msg;
  if (which === 0 && bench.length > 0) {
    bench.splice(Math.floor(Math.random() * bench.length), 1);
    msg = STAFF_EVENTS[0];
    renderBench();
  } else if (which === 1) {
    msg = STAFF_EVENTS[1 + Math.floor(Math.random() * (STAFF_EVENTS.length - 1))];
    // shorten oldest order time
    if (orders.length > 0) orders[0].time = Math.max(2, orders[0].time - 3);
  } else if (which === 2) {
    msg = 'A pigeon stole a tip. -$8';
    money = Math.max(0, money - 8);
  } else {
    msg = 'A regular tipped extra! +$15';
    money += 15;
  }
  showEvent(msg);
  updateHud();
}

function showEvent(text) {
  const c = document.getElementById('staff-events');
  const div = document.createElement('div');
  div.className = 'staff__event';
  div.textContent = text;
  c.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Perf: cache DOM refs + prev values; only touch DOM when something changed.
const _cfHud = {
  money: document.getElementById('hud-money'),
  served: document.getElementById('hud-served'),
  lives: document.getElementById('hud-lives'),
  best: document.getElementById('hud-best'),
  card: document.querySelector('#hud .hud-card'),
};
let _cfHudPrev = { money: -1, served: -1, lives: -1, best: '', critical: null };
let _cfBestCache = '', _cfBestCacheT = 0;
function updateHud() {
  if (money !== _cfHudPrev.money) { _cfHud.money.textContent = '$' + money; _cfHudPrev.money = money; }
  if (served !== _cfHudPrev.served) { _cfHud.served.textContent = served; _cfHudPrev.served = served; }
  if (lives !== _cfHudPrev.lives) {
    _cfHud.lives.textContent = '❤️'.repeat(lives) + '🖤'.repeat(4 - lives);
    _cfHudPrev.lives = lives;
  }
  const now = performance.now();
  if (now - _cfBestCacheT > 2000) {
    const best = loadBest('pug-cafe');
    _cfBestCache = best ? '$' + best.money : '$0';
    _cfBestCacheT = now;
  }
  if (_cfBestCache !== _cfHudPrev.best) { _cfHud.best.textContent = _cfBestCache; _cfHudPrev.best = _cfBestCache; }
  if (_cfHud.card) {
    const crit = lives <= 1;
    if (crit !== _cfHudPrev.critical) {
      _cfHud.card.classList.toggle('is-critical', crit);
      _cfHudPrev.critical = crit;
    }
  }
}

function end() {
  running = false;
  sfx.sweep(330, 80, 'sawtooth', 0.5, 0.22);
  document.getElementById('end-money').textContent = '$' + money;
  document.getElementById('end-served').textContent = served;
  const { isNewBest, current } = submitRun('pug-cafe', { score: money, money, served });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { money, served };
    bestEl.innerHTML = `Best: <b>$${b.money}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  // Wave 1F: end-of-shift summary card (best tip, longest chain, most chaotic)
  let summaryHost = document.getElementById('cafe-shift-summary');
  if (!summaryHost) {
    summaryHost = document.createElement('div');
    summaryHost.id = 'cafe-shift-summary';
    summaryHost.className = 'cafe-shift-summary';
    const endPanel = document.querySelector('#end-overlay .overlay__panel');
    const bestLi = document.getElementById('end-best');
    if (endPanel && bestLi) endPanel.insertBefore(summaryHost, bestLi.parentElement || bestLi);
    else if (endPanel) endPanel.appendChild(summaryHost);
  }
  const sh = shiftStats || {};
  const durMin = ((performance.now() - (sh.startedAt || performance.now())) / 60000).toFixed(1);
  summaryHost.innerHTML = `
    <div class="cafe-shift-summary__title">★ SHIFT SUMMARY · ${currentCafe().name} ★</div>
    <div class="cafe-shift-summary__row"><span>Best single tip</span><b>$${sh.bestTip || 0}</b></div>
    <div class="cafe-shift-summary__row"><span>Longest combo</span><b>×${sh.longestChain || 0}</b></div>
    <div class="cafe-shift-summary__row"><span>SPECIALS served</span><b>${sh.specialsServed || 0}</b></div>
    <div class="cafe-shift-summary__row"><span>VIPs served</span><b>${sh.vipsServed || 0}</b></div>
    <div class="cafe-shift-summary__row"><span>KARENs calmed</span><b>${sh.karensCalmed || 0}</b></div>
    <div class="cafe-shift-summary__row"><span>Burnt orders</span><b>${sh.burnt || 0}</b></div>
    <div class="cafe-shift-summary__row"><span>Most chaotic moment</span><b>${sh.mostChaotic || 'none'}</b></div>
    <div class="cafe-shift-summary__row"><span>Shift duration</span><b>${durMin} min</b></div>
    <div class="cafe-shift-summary__row" style="margin-top:6px;border-top:1px dashed var(--border);padding-top:4px;"><span>Total tips ever</span><b>$${metaTotalTips}</b></div>
  `;
  document.getElementById('hud').hidden = true;
  document.getElementById('cafe').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // Wave 1F: announce newly-unlocked cafes
  for (const id of CAFE_ORDER) {
    if (id !== 'cozy' && cafeUnlocked(id) && currentCafeId !== id) {
      // Did we just unlock this cafe? Check threshold proximity (within this shift's worth of tips)
      const prevTips = metaTotalTips - money;
      if (prevTips < CAFE_TYPES[id].needTips) {
        setTimeout(() => showAccomplish(`★ ${CAFE_TYPES[id].name} UNLOCKED! ★`, 'Switch via café chip top-left', '#ffd23f'), 400);
      }
    }
  }
}

function openShop() {
  const moneyEl = document.getElementById('cafe-shop-money');
  if (moneyEl) moneyEl.textContent = '$' + money;
  const list = document.getElementById('cafe-shop-list');
  list.innerHTML = '';
  for (const u of SHOP_DEFS) {
    const owned = !!upgrades[u.id];
    const canBuy = !owned && money >= u.cost;
    const row = document.createElement('div');
    row.className = 'cafe-shop-upgrade' + (owned ? ' owned' : '');
    row.innerHTML = `
      <div class="cafe-shop-upgrade__icon">${u.icon}</div>
      <div class="cafe-shop-upgrade__body">
        <div class="cafe-shop-upgrade__name">${u.name}</div>
        <div class="cafe-shop-upgrade__desc">${u.desc}</div>
      </div>
      <button class="cafe-shop-upgrade__btn ${owned ? 'owned' : ''}" ${owned || !canBuy ? 'disabled' : ''}>
        ${owned ? 'OWNED' : '$' + u.cost}
      </button>
    `;
    if (!owned && canBuy) {
      row.querySelector('button').addEventListener('click', () => buyUpgrade(u));
    }
    list.appendChild(row);
  }
  _shopModal.classList.add('is-open');
}
function buyUpgrade(u) {
  if (upgrades[u.id] || money < u.cost) return;
  money -= u.cost;
  upgrades[u.id] = true;
  sfx.arp([523, 659, 880], 'triangle', 0.08, 0.22, 0.2);
  popup(window.innerWidth / 2, window.innerHeight / 2, `★ ${u.name} ★`, '#ffd23f');
  if (u.id === 'autoCook') autoCookT = 5;
  if (u.id === 'hireStaff') hireGrabT = 4;
  updateHud();
  renderShopChips();
  refreshStaffHelper(); // Wave 1F: show 2nd pug if hired
  refreshBenchTools(); // Wave 1F: show owned upgrade icons over bench
  openShop(); // re-render
}
function renderShopChips() {
  if (!_shopChips) return;
  _shopChips.innerHTML = '';
  for (const u of SHOP_DEFS) {
    if (!upgrades[u.id]) continue;
    const c = document.createElement('div');
    c.className = 'cafe-shop-chip';
    c.textContent = u.icon + ' ' + u.name;
    _shopChips.appendChild(c);
  }
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  // Wave 1F: load meta progression BEFORE reset() so currentCafeId is set
  loadMeta();
  reset(); running = true;
  // Close any stale modal/shop overlay from a previous match so the second
  // start doesn't load over an open shop panel.
  if (_shopModal) _shopModal.classList.remove('is-open');
  if (_cafeSelectModal) _cafeSelectModal.classList.remove('is-open');
  // Wipe stale serve-feed lines from a previous match.
  try { __cafeFeed && __cafeFeed.clear(); } catch (e) { /* */ }
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('cafe').hidden = false;
  refreshCafeChip();
  refreshDailyChip();
  refreshSoupBanner();
  refreshStaffHelper();
  renderKitchen(); renderBench(); renderOrders();
  refreshBenchTools();
  updateHud();
  sfx.resume();
  try { music.setIntensity(0.3); music.play(); } catch {}
}
// Stop music whenever the end overlay reveals (end-of-day card).
(function _wireMusicEnd() {
  const endOv = document.getElementById('end-overlay');
  if (!endOv) return;
  const upd = () => {
    const visible = !endOv.hidden && !endOv.classList.contains('is-hidden');
    if (visible) try { music.stop(); } catch {}
  };
  new MutationObserver(upd).observe(endOv, { attributes: true, attributeFilter: ['hidden','class'] });
})();

// Floating 1x/2x/3x speed toggle (top-right) + served-customer kill-feed.
// Declared BEFORE the rAF loop so `__cafeFeed` is defined when serve() runs.
let __cafeSpeed = 1;
createSpeedToggle({ onChange: (m) => { __cafeSpeed = m; } });
const __cafeFeed = createKillFeed({ maxLines: 5, lifespan: 4500 });

let lastT = performance.now();
(function loop(now) {
  // Multiplying dt scales spawn rate, order patience drain, event timer AND
  // combo-decay — i.e. the whole game's pace, not just patience.
  const dt = Math.min((now - lastT) / 1000, 0.05) * __cafeSpeed;
  lastT = now; tick(dt);
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('Tap an ingredient → tap SERVE on the right order. Tap ★ SHOP (top-right) to spend tips on permanent upgrades.', 7500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start/end screen polish ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Some orders need 4 ingredients — plan your bench.',
    'TIP: Drag a held item to an order to deliver fast.',
    'TIP: Pugs eat ingredients off the bench randomly.',
    'TIP: Spend tips at the SHOP between days for upgrades.',
    'LORE: The cafe was opened by a retired racing pug.',
    'JOKE: What did the pug barista say? "Espresso! Espresso!"',
  ];
  const GAME_ID = 'pug-cafe';
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
        if (best && (best.money || best.score || best.served)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: $${best.money || best.score || 0} · ${best.served || 0} served`;
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
      const m = document.getElementById('end-money')?.textContent || '$0';
      const s = document.getElementById('end-served')?.textContent || '0';
      const text = `🐶 PUG CAFÉ PANIC — Made ${m} from ${s} orders! Beat me at https://leobalkind.github.io/web-games/`;
      try {
        if (navigator.share) await navigator.share({ title: 'PUG CAFÉ PANIC', text, url: 'https://leobalkind.github.io/web-games/' });
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
