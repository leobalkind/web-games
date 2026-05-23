// PUG CAFÉ PANIC — order management with chaotic pug staff.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { iconSvg } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';

// Helper: prefer pixel-art SVG icon when ingredient has an iconName; fall back to emoji string
function _ingIcon(ing) {
  return ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](28) : ing.icon;
}

const sfx = createSfx({ storageKey: 'cafe:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

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
.cafe-chalk__title { color: #ffd23f; font-size: 0.45rem; letter-spacing: 0.1em;
  border-bottom: 1px dashed #f4ecd2; padding-bottom: 3px; margin-bottom: 4px; text-align: center; }
.cafe-chalk__line { font-size: 0.36rem; color: rgba(244,236,210,0.85); padding: 1px 0;
  text-shadow: 0 0 1px rgba(244,236,210,0.4); }
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
`;
const _s = document.createElement('style'); _s.textContent = VISUAL_CSS; document.head.appendChild(_s);

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
for (let i = 0; i < 6; i++) {
  const col = _CUSTOMER_COLORS[i % _CUSTOMER_COLORS.length];
  const wrap = document.createElement('span'); wrap.className = 'cafe-customer';
  const cv = _makePugCanvas(44, 48, { size: 42, body: col.body, mask: col.mask, tongueOut: i % 3 === 0 });
  wrap.appendChild(cv);
  _customers.appendChild(wrap);
}
document.body.appendChild(_customers);
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

const RECIPES = [
  { name: 'Triple Bacon Pupcake', items: ['bacon', 'bacon', 'cake'], pay: 30 },
  { name: 'Slime Smoothie',       items: ['slime', 'milk'], pay: 18 },
  { name: 'Glowing Noodles',      items: ['noodle', 'cheese'], pay: 22 },
  { name: 'Fish Bone Stew',       items: ['fish', 'bone'], pay: 20 },
  { name: 'Pickle Donut',         items: ['pickle', 'donut'], pay: 16 },
  { name: 'Bacon Cheesebone',     items: ['bacon', 'cheese', 'bone'], pay: 32 },
  { name: 'Triple Slime',         items: ['slime', 'slime', 'slime'], pay: 38 },
  { name: 'Pup Pizza',            items: ['cheese', 'bacon', 'donut'], pay: 40 },
  { name: 'Fish Smoothie',        items: ['fish', 'milk'], pay: 18 },
  { name: 'Glow Donut Stack',     items: ['noodle', 'donut', 'cake'], pay: 42 },
  { name: 'Bacon Pickle Slime',   items: ['bacon', 'pickle', 'slime'], pay: 36 },
  { name: 'Cheese Donut Bake',    items: ['cheese', 'donut'], pay: 24 },
  { name: 'Quad Bacon Madness',   items: ['bacon', 'bacon', 'bacon', 'bacon'], pay: 60 },
  { name: 'Fish Pickle Latte',    items: ['fish', 'pickle', 'milk'], pay: 30 },
  { name: 'Bone Cheese Donut',    items: ['bone', 'cheese', 'donut'], pay: 38 },
  { name: 'Noodle Bone Soup',     items: ['noodle', 'bone'], pay: 22 },
  { name: 'Mega Pup Special',     items: ['cake', 'cake', 'bacon', 'donut'], pay: 70 },
];

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
  { id: 'autoCook',  name: 'AUTO-COOK',         cost: 300, icon: '🤖', desc: 'Auto-completes 1 ingredient in oldest order every 5s' },
  { id: 'extraBench',name: 'EXTRA BENCH',       cost: 400, icon: '🪑', desc: 'Bench capacity +2' },
  { id: 'fastServe', name: 'FAST SERVE',        cost: 350, icon: '⚡', desc: 'Skip serve animation (instant)' },
  { id: 'patient',   name: 'PATIENT CUSTOMERS', cost: 500, icon: '⏰', desc: 'Order timeouts +50%' },
];
let upgrades = {}; // id -> true when owned
let autoCookT = 0;
function reset() {
  orders = []; bench = []; money = 0; served = 0; lives = 3;
  spawnT = 1.5; eventT = 5;
  comboT = 0; comboCount = 0;
  upgrades = {}; autoCookT = 5;
  renderShopChips();
}

function spawnOrder() {
  const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  const maxT = upgrades.patient ? 33 : 22;
  orders.push({
    recipe: r,
    items: r.items.map((i) => ({ id: i, done: false })),
    time: maxT,
    maxTime: maxT,
  });
  renderOrders();
  updateChalkboard();
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
    let cls = 'order';
    const k = o.time / o.maxTime;
    if (k < 0.3) cls += ' crit';
    else if (k < 0.6) cls += ' warn';
    div.className = cls;
    div.innerHTML = `
      <h4>${o.recipe.name}</h4>
      <ul>${o.items.map((it) => {
        const ing = INGREDIENTS.find((g) => g.id === it.id);
        const iconHtml = ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](14) : ing.icon;
        return `<li class="${it.done ? 'done' : ''}"><span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;">${iconHtml}</span><span>${ing.name}</span></li>`;
      }).join('')}</ul>
      <div class="order__timer"><div class="order__timer-fill" style="width:${k * 100}%;background:${k < 0.3 ? '#ff3a3a' : (k < 0.6 ? '#ffd23f' : '#5ef38c')}"></div></div>
      <button class="serve-btn" data-idx="${i}" style="margin-top:6px;width:100%;">SERVE $${o.recipe.pay}</button>
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
    b.innerHTML = '<span style="color:var(--muted);font-size:0.5rem;">empty bench</span>';
    return;
  }
  for (let i = 0; i < bench.length; i++) {
    const ing = INGREDIENTS.find((g) => g.id === bench[i]);
    const el = document.createElement('div');
    el.className = 'bench__held';
    const iconHtml = ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](24) : ing.icon;
    el.innerHTML = `<div class="station__icon">${iconHtml}</div><div class="station__name">${ing.name}</div>`;
    el.addEventListener('click', () => { bench.splice(i, 1); renderBench(); });
    b.appendChild(el);
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
  const pay = o.recipe.pay + comboBonus;
  money += pay;
  served++;
  orders.splice(idx, 1);
  sfx.arp([523, 659, 784], 'triangle', 0.07, 0.22, 0.2);
  // Popup near the served order's button (approx center of orders bar)
  const ordersEl = document.getElementById('orders');
  const rect = ordersEl ? ordersEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: 100, width: 0, height: 0 };
  popup(rect.left + rect.width / 2, rect.top + rect.height / 2, `+$${pay}${comboCount > 1 ? ` x${comboCount}` : ''}`, comboCount > 1 ? '#ff3aa1' : '#5ef38c');
  // Flash all kitchen chips when comboing
  if (comboCount > 1) {
    document.querySelectorAll('#kitchen .station').forEach((el, i) => setTimeout(() => flashChip(el), i * 20));
  }
  // Equipment upgrade milestones
  if (served === 10) showEvent('🪑 BENCH UPGRADED! +1 slot');
  if (served === 20) showEvent('🪑 BENCH UPGRADED! +1 slot');
  if (served === 30) showEvent('🪑 BENCH UPGRADED! +1 slot');
  if (served === 40) showEvent('🪑 BENCH UPGRADED! +1 slot (max 8)');
  if (served % 25 === 0 && served > 0) {
    money += 50; showEvent(`💰 $50 BONUS for ${served} served!`);
    popup(window.innerWidth / 2, window.innerHeight / 2, '+$50 BONUS', '#ffd23f');
  }
  renderBench(); renderOrders();
  updateHud();
}

function tick(dt) {
  if (!running) return;
  spawnT -= dt;
  if (spawnT <= 0) { spawnOrder(); spawnT = Math.max(1.6, 4 - served * 0.05); }
  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i];
    o.time -= dt;
    if (o.time <= 0) {
      orders.splice(i, 1);
      lives--;
      sfx.sweep(220, 110, 'sawtooth', 0.3, 0.22);
      screenShake();
      popup(window.innerWidth / 2, window.innerHeight / 3, 'ANGRY!', '#ff3a3a');
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
  renderOrders();
}

function chaosEvent() {
  const which = Math.floor(Math.random() * 4);
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

function updateHud() {
  document.getElementById('hud-money').textContent = '$' + money;
  document.getElementById('hud-served').textContent = served;
  document.getElementById('hud-lives').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  const best = loadBest('pug-cafe');
  document.getElementById('hud-best').textContent = best ? '$' + best.money : '$0';
  const hudCard = document.querySelector('#hud .hud-card');
  if (hudCard) hudCard.classList.toggle('is-critical', lives <= 1);
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
  document.getElementById('hud').hidden = true;
  document.getElementById('cafe').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
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
  updateHud();
  renderShopChips();
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
  reset(); running = true;
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('cafe').hidden = false;
  renderKitchen(); renderBench(); renderOrders();
  updateHud();
  sfx.resume();
}

let lastT = performance.now();
(function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
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
