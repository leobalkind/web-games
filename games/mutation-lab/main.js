// PUG MUTATION LAB — combine 3 ingredients to discover pug species.
// Recipes are deterministic by ingredient set (sorted). Some are pre-named
// legendaries, others are procedurally generated cursed pugs.
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { iconSvg } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';

// Procedurally derive body/mask/ear from a discovery key — any string with the
// same content always yields the same colors, but two different keys diverge.
const _PUG_BODY_PALETTE = [
  '#c8854a', '#a89888', '#5a5a5a', '#eac888', '#fafaff', '#8a5a2a',
  '#b055ff', '#4cc9f0', '#5ef38c', '#ff8e3c', '#ff3aa1', '#ffd23f',
];
const _PUG_MASK_PALETTE = [
  '#1a0d05', '#3a1a4a', '#0a0a0a', '#2a1810', '#5a3a1a', '#1a0014',
];
function _hashKey(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}
function _pugColorsFor(key) {
  const h = _hashKey(key || '?');
  return {
    body: _PUG_BODY_PALETTE[h % _PUG_BODY_PALETTE.length],
    mask: _PUG_MASK_PALETTE[(h >>> 8) % _PUG_MASK_PALETTE.length],
    tongueOut: ((h >>> 16) & 1) === 1,
  };
}
function _makeLabPugCanvas(w, h, opts) {
  const cv = document.createElement('canvas');
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.style.display = 'block';
  cv.style.imageRendering = 'pixelated';
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawPug(c, w / 2, h - 4, opts);
  return cv;
}

// Helper: prefer pixel-art SVG icon for ingredients that map to the library
function _labIcon(ing, size) {
  return ing.iconName && iconSvg[ing.iconName] ? iconSvg[ing.iconName](size || 24) : ing.icon;
}

const sfx = createSfx({ storageKey: 'mutlab:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

// ----- Visual polish: bubbling beaker, glow, sparkles, table texture -----
const LAB_CSS = `
.lab-bg { position: fixed; inset: 0; z-index: 1; pointer-events: none; overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(76,201,240,0.08), transparent 60%),
    radial-gradient(ellipse at 20% 100%, rgba(255,58,161,0.08), transparent 60%),
    #0a0716; }

/* === DNA HELIX rotating in background === */
.lab-dna { position: absolute; left: 50%; top: 22%; width: 220px; height: 200px;
  transform: translateX(-50%); pointer-events: none; opacity: 0.18;
  animation: lab-dna-spin 18s linear infinite; }
@keyframes lab-dna-spin { from { transform: translateX(-50%) rotateY(0deg); }
  to { transform: translateX(-50%) rotateY(360deg); } }
.lab-dna__rung { position: absolute; left: 50%; width: 80px; height: 3px;
  transform: translateX(-50%); border-radius: 2px; }
.lab-dna__rung--pink { background: linear-gradient(90deg, #ff3aa1, #ff8ac8, #ff3aa1); box-shadow: 0 0 6px #ff3aa1; }
.lab-dna__rung--cyan { background: linear-gradient(90deg, #4cc9f0, #b0e8ff, #4cc9f0); box-shadow: 0 0 6px #4cc9f0; }
.lab-dna__rung--yellow { background: linear-gradient(90deg, #ffd23f, #fff0a0, #ffd23f); box-shadow: 0 0 6px #ffd23f; }

/* === TESLA COILS framing the beaker === */
.lab-coil { position: fixed; bottom: 30%; width: 28px; height: 180px; z-index: 2;
  pointer-events: none; }
.lab-coil--l { left: 4%; } .lab-coil--r { right: 4%; }
.lab-coil__base { position: absolute; bottom: 0; left: -8px; width: 44px; height: 20px;
  background: linear-gradient(180deg, #4a4a52, #2a2a32); border: 2px solid #6a6a72;
  border-radius: 4px 4px 0 0; }
.lab-coil__post { position: absolute; bottom: 18px; left: 8px; width: 12px; height: 130px;
  background: repeating-linear-gradient(90deg, #c8b888 0 3px, #6a5a3a 3px 4px, #c8b888 4px 7px);
  border-radius: 2px; box-shadow: 0 0 6px rgba(255,210,63,0.4) inset; }
.lab-coil__cap { position: absolute; bottom: 144px; left: 0; width: 28px; height: 16px;
  background: radial-gradient(ellipse at 50% 30%, #b0e8ff 0%, #4cc9f0 40%, #2a4a6a 90%);
  border: 2px solid #6a6a72; border-radius: 50%;
  box-shadow: 0 0 14px rgba(76,201,240,0.6); }
.lab-coil__tip { position: absolute; bottom: 158px; left: 12px; width: 4px; height: 8px;
  background: linear-gradient(180deg, #ffffff, #4cc9f0); }
@keyframes lab-coil-pulse { 0%, 100% { box-shadow: 0 0 14px rgba(76,201,240,0.6); }
  50% { box-shadow: 0 0 28px rgba(76,201,240,1.0), 0 0 60px rgba(76,201,240,0.7); } }
.lab-coil.is-charging .lab-coil__cap { animation: lab-coil-pulse 0.5s ease-in-out infinite; }

/* Lightning bolts: SVG paths drawn in the arc element */
.lab-arc { position: fixed; bottom: 38%; left: 8%; right: 8%; height: 140px;
  z-index: 2; pointer-events: none; opacity: 0; }
.lab-arc.is-flashing { animation: lab-arc-flash 0.25s ease-out; }
@keyframes lab-arc-flash { 0% { opacity: 0; } 30% { opacity: 1; } 100% { opacity: 0; } }
.lab-arc.is-charging { opacity: 0; animation: lab-arc-charge 1.4s ease-in-out infinite; }
@keyframes lab-arc-charge { 0%, 70%, 100% { opacity: 0; } 78%, 86% { opacity: 0.95; } 82% { opacity: 0.3; } }

/* === FRANKENSTEIN SWITCH === */
.lab-lever { position: fixed; bottom: 14%; right: 3%; width: 48px; height: 90px; z-index: 5;
  cursor: pointer; -webkit-tap-highlight-color: transparent; }
.lab-lever__box { position: absolute; bottom: 0; left: 0; width: 48px; height: 64px;
  background: linear-gradient(180deg, #3a2018 0%, #1a0e08 100%);
  border: 3px solid #5a3a1a; border-radius: 4px;
  box-shadow: inset 0 2px 0 rgba(255,210,63,0.2), 0 4px 0 rgba(0,0,0,0.6); }
.lab-lever__handle { position: absolute; bottom: 26px; left: 50%; width: 8px; height: 56px;
  background: linear-gradient(180deg, #ff3a3a 0 12px, #c8c8d8 12px 100%);
  transform-origin: 50% 100%; transform: translateX(-50%) rotate(-30deg);
  border-radius: 4px; transition: transform 0.4s cubic-bezier(0.4, 1.6, 0.6, 1);
  box-shadow: 0 0 8px rgba(255,58,58,0.7); }
.lab-lever.is-down .lab-lever__handle { transform: translateX(-50%) rotate(30deg); }
.lab-lever__label { position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
  font-family: var(--font-display); font-size: 0.34rem; color: var(--neon-yellow);
  letter-spacing: 0.06em; white-space: nowrap; text-shadow: 0 0 4px #000; }

/* === CHEMISTRY POSTERS on back wall === */
.lab-posters { position: absolute; top: 8%; left: 0; right: 0; height: 130px;
  display: flex; justify-content: space-around; pointer-events: none; padding: 0 6%; }
.lab-poster { width: 96px; height: 120px; background: rgba(244,236,210,0.92);
  border: 3px solid #6a3a1c; border-radius: 2px; padding: 5px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.7), inset 0 0 6px rgba(0,0,0,0.2);
  transform: rotate(-2deg); font-family: var(--font-display); font-size: 0.32rem;
  color: #2a1a0c; line-height: 1.4; overflow: hidden; }
.lab-poster:nth-child(2) { transform: rotate(1.5deg); }
.lab-poster:nth-child(3) { transform: rotate(-1deg); }
.lab-poster__title { font-size: 0.36rem; color: #c81818; text-align: center;
  border-bottom: 1px dashed #6a3a1c; padding-bottom: 2px; margin-bottom: 3px;
  letter-spacing: 0.05em; }
.lab-poster__row { font-size: 0.3rem; padding: 1px 0; display: flex; justify-content: space-between; }
.lab-poster__swatch { display: inline-block; width: 8px; height: 8px; vertical-align: middle;
  border: 1px solid #2a1a0c; margin-right: 2px; }

/* === ORGAN JARS on shelves === */
.lab-jars { position: absolute; bottom: 30%; left: 0; right: 0; height: 56px;
  display: flex; justify-content: space-around; pointer-events: none; padding: 0 30%;
  z-index: 1; }
.lab-jar { width: 42px; height: 52px; position: relative; opacity: 0.85;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6)); }
.lab-jar__body { position: absolute; bottom: 0; left: 0; right: 0; height: 44px;
  background: linear-gradient(180deg, rgba(200,240,255,0.25) 0%, rgba(80,140,180,0.45) 100%);
  border: 2px solid rgba(200,240,255,0.5); border-radius: 4px 4px 8px 8px;
  box-shadow: inset 0 0 8px rgba(255,255,255,0.3);
  overflow: hidden; }
.lab-jar__lid { position: absolute; top: 0; left: 4px; right: 4px; height: 8px;
  background: linear-gradient(180deg, #6a6a72, #2a2a32); border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2); }
.lab-jar__blob { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -40%);
  width: 22px; height: 22px; border-radius: 50%;
  animation: lab-jar-float 3s ease-in-out infinite; }
.lab-jar__blob--green { background: radial-gradient(circle at 30% 30%, #9ef0b0, #3aa860 60%, #1a5a30 100%);
  box-shadow: 0 0 12px rgba(94,243,140,0.5); }
.lab-jar__blob--red { background: radial-gradient(circle at 30% 30%, #ff8a8a, #c81818 60%, #5a0808 100%);
  box-shadow: 0 0 12px rgba(255,58,58,0.5); }
.lab-jar__blob--purple { background: radial-gradient(circle at 30% 30%, #d090ff, #b055ff 60%, #4a2070 100%);
  box-shadow: 0 0 12px rgba(176,85,255,0.5); }
@keyframes lab-jar-float { 0%, 100% { transform: translate(-50%, -40%) translateY(0); }
  50% { transform: translate(-50%, -40%) translateY(-3px); } }
.lab-jar__eye { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -40%);
  width: 8px; height: 8px; border-radius: 50%; background: #ffffff;
  border: 1px solid #000; box-shadow: 0 0 4px rgba(255,255,255,0.6); }
.lab-jar__eye::after { content: ''; position: absolute; top: 2px; left: 2px;
  width: 3px; height: 3px; border-radius: 50%; background: #000; }

/* Smoke wisps rising from beaker */
.lab-smoke { position: absolute; bottom: 100%; left: 50%; width: 10px; height: 10px;
  border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.4), transparent 70%);
  pointer-events: none; opacity: 0;
  animation: lab-smoke-rise 3s ease-out infinite; }
.lab-smoke:nth-child(1) { animation-delay: 0s; left: 40%; }
.lab-smoke:nth-child(2) { animation-delay: 1s; left: 55%; }
.lab-smoke:nth-child(3) { animation-delay: 2s; left: 48%; }
@keyframes lab-smoke-rise { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
  25% { opacity: 0.7; } 100% { transform: translate(-50%, -80px) scale(2); opacity: 0; } }

/* === RARITY BADGE === */
.lab-rarity-badge { display: inline-block; padding: 4px 10px; border-radius: 4px;
  font-family: var(--font-display); font-size: 0.42rem; letter-spacing: 0.1em;
  margin: 4px 0; border: 2px solid currentColor;
  text-shadow: 0 0 6px currentColor; box-shadow: 0 0 12px currentColor; }
.lab-rarity-badge.COMMON { color: #c8c8d8; background: rgba(200,200,216,0.12); }
.lab-rarity-badge.RARE { color: #4cc9f0; background: rgba(76,201,240,0.15); }
.lab-rarity-badge.EPIC { color: #b055ff; background: rgba(176,85,255,0.18); }
.lab-rarity-badge.LEGENDARY { color: #ffd23f; background: rgba(255,210,63,0.18);
  animation: lab-rarity-pulse 1s ease-in-out infinite; }
.lab-rarity-badge.CURSED { color: #ff3a3a; background: rgba(255,58,58,0.18); }
@keyframes lab-rarity-pulse { 0%,100% { box-shadow: 0 0 12px #ffd23f; }
  50% { box-shadow: 0 0 28px #ffd23f, 0 0 48px rgba(255,210,63,0.5); } }

/* === CODEX === */
.lab-codex-btn { position: fixed; top: calc(14px + env(safe-area-inset-top, 0)); right: 60px; z-index: 100;
  background: linear-gradient(180deg, #b055ff, #6a2080); color: #fff;
  border: 3px solid #d090ff; border-radius: 6px;
  font-family: var(--font-display); font-size: 0.5rem; letter-spacing: 0.08em;
  padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 0 #4a1060;
  -webkit-tap-highlight-color: transparent; }
.lab-codex-btn:hover { transform: translateY(-1px); }
.lab-codex-modal { position: fixed; inset: 0; z-index: 200; display: none;
  align-items: center; justify-content: center; background: rgba(0,0,0,0.85); padding: 16px; }
.lab-codex-modal.is-open { display: flex; }
.lab-codex-modal__panel { background: linear-gradient(180deg, #1a0f2e, #0a0716);
  border: 3px solid #b055ff; border-radius: 10px; padding: 18px;
  max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 0 40px rgba(176,85,255,0.5); }
.lab-codex-title { font-family: var(--font-display); font-size: 0.85rem;
  letter-spacing: 0.1em; color: #d090ff; text-align: center; margin: 0 0 8px;
  text-shadow: 0 0 12px #b055ff; }
.lab-codex-sub { text-align: center; font-family: var(--font-display);
  font-size: 0.5rem; color: var(--neon-cyan); margin-bottom: 14px; }
.lab-codex-tier-title { font-family: var(--font-display); font-size: 0.55rem;
  letter-spacing: 0.1em; margin: 16px 0 8px; padding-bottom: 4px;
  border-bottom: 1px dashed currentColor; }
.lab-codex-tier-title.COMMON { color: #c8c8d8; } .lab-codex-tier-title.RARE { color: #4cc9f0; }
.lab-codex-tier-title.EPIC { color: #b055ff; } .lab-codex-tier-title.LEGENDARY { color: #ffd23f; }
.lab-codex-tier-title.CURSED { color: #ff3a3a; }
.lab-codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: 6px; }
.lab-codex-cell { background: rgba(0,0,0,0.5); border: 2px solid var(--border);
  border-radius: 6px; padding: 6px 4px; text-align: center; min-height: 70px; }
.lab-codex-cell.discovered { border-color: currentColor; }
.lab-codex-cell.COMMON.discovered { color: #c8c8d8; }
.lab-codex-cell.RARE.discovered { color: #4cc9f0; background: rgba(76,201,240,0.08); }
.lab-codex-cell.EPIC.discovered { color: #b055ff; background: rgba(176,85,255,0.08); }
.lab-codex-cell.LEGENDARY.discovered { color: #ffd23f; background: rgba(255,210,63,0.1); box-shadow: 0 0 8px rgba(255,210,63,0.4); }
.lab-codex-cell.CURSED.discovered { color: #ff3a3a; background: rgba(255,58,58,0.1); }
.lab-codex-cell__icon { font-size: 22px; line-height: 1; }
.lab-codex-cell__name { font-family: var(--font-display); font-size: 0.34rem; margin-top: 4px;
  letter-spacing: 0.03em; }
.lab-codex-cell__unk { font-size: 30px; opacity: 0.3; }
.lab-codex-close { background: rgba(0,0,0,0.6); color: var(--text); border: 2px solid var(--border);
  border-radius: 4px; font-family: var(--font-display); font-size: 0.5rem;
  padding: 8px 14px; cursor: pointer; display: block; margin: 16px auto 0; }

.lab-bg__table { position: absolute; left: 0; right: 0; bottom: 0; height: 38%;
  background:
    linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.55)),
    repeating-linear-gradient(0deg, #2a2018 0 2px, #1f160f 2px 6px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 20px, transparent 20px 40px);
  border-top: 2px solid rgba(255,210,63,0.22); }
.lab-bg__shelf { position: absolute; left: 8px; right: 8px; top: 6px; padding: 4px 8px;
  background: rgba(20,12,30,0.65); border: 1px solid rgba(255,210,63,0.25);
  border-radius: 6px; display: flex; gap: 6px; overflow-x: auto; max-width: calc(100% - 16px); }
.lab-bg__shelf__pug { font-size: 18px; opacity: 0.7; filter: drop-shadow(0 2px 4px #000);
  animation: lab-shelf-bob 3s ease-in-out infinite; }
.lab-bg__shelf__pug:nth-child(2n) { animation-delay: 0.4s; }
.lab-bg__shelf__pug:nth-child(3n) { animation-delay: 0.8s; }
@keyframes lab-shelf-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
.lab-beaker { position: relative; overflow: visible !important; }
.lab-beaker.is-ready { box-shadow: 0 0 36px rgba(255,210,63,0.7), inset 0 0 24px rgba(255,210,63,0.18) !important;
  border-color: var(--neon-yellow) !important; }
.lab-beaker.is-ready h3 { color: var(--neon-yellow) !important; text-shadow: 0 0 12px var(--neon-yellow); }
.lab-bubble { position: absolute; bottom: 14px; left: 50%; width: 6px; height: 6px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff, #4cc9f0 70%);
  opacity: 0; pointer-events: none;
  animation: lab-bubble-rise 1.8s ease-in infinite; }
@keyframes lab-bubble-rise { 0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
  20% { opacity: 0.9; } 100% { transform: translate(calc(-50% + var(--dx, 0px)), -90px) scale(1.4); opacity: 0; } }
.lab-spark { position: fixed; width: 6px; height: 6px; border-radius: 50%; pointer-events: none; z-index: 1000;
  box-shadow: 0 0 12px currentColor; animation: lab-spark-fly 1s ease-out forwards; }
@keyframes lab-spark-fly { 0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx,0), var(--ty,0)) scale(0.2); opacity: 0; } }
.lab-shake { animation: lab-shake 0.4s ease-out; }
@keyframes lab-shake { 0%,100% { transform: translate(0,0); } 25% { transform: translate(-6px, 4px); }
  50% { transform: translate(6px, -4px); } 75% { transform: translate(-4px, -3px); } }
.lab-result { transition: transform 0.2s, box-shadow 0.2s; }
.lab-result.legendary { animation: lab-leg-pulse 1.4s ease-in-out infinite; }
@keyframes lab-leg-pulse { 0%,100% { box-shadow: 0 0 40px var(--neon-yellow); }
  50% { box-shadow: 0 0 80px var(--neon-yellow), 0 0 120px rgba(255,210,63,0.5); } }
.hud-card.is-legendary { animation: lab-hud-leg 0.8s ease-out; }
@keyframes lab-hud-leg { 0% { box-shadow: 0 0 0 var(--neon-yellow); }
  50% { box-shadow: 0 0 40px var(--neon-yellow); } 100% { box-shadow: 0 0 0 var(--neon-yellow); } }
`;
const _lstyle = document.createElement('style'); _lstyle.textContent = LAB_CSS; document.head.appendChild(_lstyle);
const _lbg = document.createElement('div');
_lbg.className = 'lab-bg';
// Build helix rungs
let _dnaRungs = '';
for (let i = 0; i < 18; i++) {
  const t = i / 18; const color = ['pink', 'cyan', 'yellow'][i % 3];
  _dnaRungs += `<div class="lab-dna__rung lab-dna__rung--${color}" style="top:${i * 11}px; width:${20 + Math.abs(Math.sin(t * Math.PI * 2)) * 60}px; opacity:${0.4 + Math.sin(t * Math.PI) * 0.5};"></div>`;
}
_lbg.innerHTML = `
  <div class="lab-bg__shelf" id="lab-shelf-bg"></div>
  <div class="lab-posters">
    <div class="lab-poster">
      <div class="lab-poster__title">PERIODIC TABLE OF TREATS</div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#ffd23f;"></span>Br</span><span>1</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#ff3aa1;"></span>Pu</span><span>2</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#4cc9f0;"></span>Bo</span><span>3</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#5ef38c;"></span>Sl</span><span>4</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#b055ff;"></span>Ch</span><span>5</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#ff8e3c;"></span>Fi</span><span>6</span></div>
    </div>
    <div class="lab-poster">
      <div class="lab-poster__title">PUG ANATOMY</div>
      <div style="text-align:center;font-size:0.5rem;margin:4px 0;">🐶</div>
      <div class="lab-poster__row"><span>Snoot</span><span>1</span></div>
      <div class="lab-poster__row"><span>Curls</span><span>2</span></div>
      <div class="lab-poster__row"><span>Belly</span><span>3</span></div>
      <div class="lab-poster__row"><span>Tongue</span><span>4</span></div>
      <div class="lab-poster__row"><span>Heart</span><span>♥</span></div>
    </div>
    <div class="lab-poster">
      <div class="lab-poster__title">MUTATION TIERS</div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#c8c8d8;"></span>COMMON</span><span>★</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#4cc9f0;"></span>RARE</span><span>★★</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#b055ff;"></span>EPIC</span><span>★★★</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#ffd23f;"></span>LEGEND</span><span>★★★★</span></div>
      <div class="lab-poster__row"><span><span class="lab-poster__swatch" style="background:#ff3a3a;"></span>CURSED</span><span>?!</span></div>
    </div>
  </div>
  <div class="lab-dna">${_dnaRungs}</div>
  <div class="lab-jars">
    <div class="lab-jar"><div class="lab-jar__body"><div class="lab-jar__blob lab-jar__blob--green"></div></div><div class="lab-jar__lid"></div></div>
    <div class="lab-jar"><div class="lab-jar__body"><div class="lab-jar__eye"></div></div><div class="lab-jar__lid"></div></div>
    <div class="lab-jar"><div class="lab-jar__body"><div class="lab-jar__blob lab-jar__blob--red"></div></div><div class="lab-jar__lid"></div></div>
    <div class="lab-jar"><div class="lab-jar__body"><div class="lab-jar__blob lab-jar__blob--purple"></div></div><div class="lab-jar__lid"></div></div>
    <div class="lab-jar"><div class="lab-jar__body"><div class="lab-jar__eye"></div></div><div class="lab-jar__lid"></div></div>
  </div>
  <div class="lab-bg__table"></div>
`;
document.body.appendChild(_lbg);
const _shelfBg = _lbg.querySelector('#lab-shelf-bg');

// Tesla coils + arc overlay
const _coilL = document.createElement('div');
_coilL.className = 'lab-coil lab-coil--l';
_coilL.innerHTML = '<div class="lab-coil__post"></div><div class="lab-coil__cap"></div><div class="lab-coil__tip"></div><div class="lab-coil__base"></div>';
document.body.appendChild(_coilL);
const _coilR = document.createElement('div');
_coilR.className = 'lab-coil lab-coil--r';
_coilR.innerHTML = '<div class="lab-coil__post"></div><div class="lab-coil__cap"></div><div class="lab-coil__tip"></div><div class="lab-coil__base"></div>';
document.body.appendChild(_coilR);
const _arc = document.createElement('div');
_arc.className = 'lab-arc';
_arc.innerHTML = `<svg width="100%" height="140" viewBox="0 0 600 140" preserveAspectRatio="none" style="overflow:visible;">
  <path d="M10,60 L80,40 L140,70 L200,30 L260,80 L320,20 L380,90 L440,40 L500,75 L590,55"
    stroke="#b0e8ff" stroke-width="2" fill="none" filter="url(#labGlow)" />
  <path d="M10,60 L80,40 L140,70 L200,30 L260,80 L320,20 L380,90 L440,40 L500,75 L590,55"
    stroke="#ffffff" stroke-width="1" fill="none" />
  <defs><filter id="labGlow"><feGaussianBlur stdDeviation="2"/></filter></defs>
</svg>`;
document.body.appendChild(_arc);

// Frankenstein lever (decorative)
const _lever = document.createElement('div');
_lever.className = 'lab-lever';
_lever.innerHTML = '<div class="lab-lever__box"></div><div class="lab-lever__handle"></div><div class="lab-lever__label">PULL ME</div>';
document.body.appendChild(_lever);
_lever.addEventListener('click', () => {
  _lever.classList.toggle('is-down');
  // Fire sparks + a big arc flash
  const r = _lever.getBoundingClientRect();
  sparkleBurst(r.left + r.width / 2, r.top + 10, 24, '#ffd23f');
  setTimeout(() => sparkleBurst(r.left + r.width / 2, r.top + 10, 16, '#ff3a3a'), 100);
  flashArc();
  sfx.tone(220, 'sawtooth', 0.12, 0.18);
});

// Periodic ambient arc-flash even when not charging
let _arcChargingState = false;
function setCoilCharging(on) {
  if (on === _arcChargingState) return;
  _arcChargingState = on;
  _coilL.classList.toggle('is-charging', on);
  _coilR.classList.toggle('is-charging', on);
  _arc.classList.toggle('is-charging', on);
}
function flashArc() {
  _arc.classList.remove('is-flashing');
  void _arc.offsetWidth;
  _arc.classList.add('is-flashing');
  setTimeout(() => _arc.classList.remove('is-flashing'), 300);
}
setInterval(() => { if (!_arcChargingState && Math.random() < 0.35) flashArc(); }, 2400);

function refreshShelfBg() {
  if (!_shelfBg) return;
  _shelfBg.innerHTML = '';
  const recent = Object.values(discoveries).slice(-22);
  for (const d of recent) {
    const sp = document.createElement('span');
    sp.className = 'lab-bg__shelf__pug';
    sp.title = d.name;
    const cols = _pugColorsFor(d.key || d.name || d.icon);
    const cv = _makeLabPugCanvas(26, 28, { size: 26, ...cols });
    sp.appendChild(cv);
    _shelfBg.appendChild(sp);
  }
}
function sparkleBurst(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'lab-spark';
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.background = color;
    s.style.color = color;
    const a = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * 140;
    s.style.setProperty('--tx', `${Math.cos(a) * r}px`);
    s.style.setProperty('--ty', `${Math.sin(a) * r}px`);
    s.style.animationDuration = (0.7 + Math.random() * 0.6) + 's';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}
function shakeEl(el) {
  if (!el) return;
  el.classList.remove('lab-shake'); void el.offsetWidth; el.classList.add('lab-shake');
  setTimeout(() => el.classList.remove('lab-shake'), 420);
}

const INGREDIENTS = [
  { id: 'lava', icon: '🌋', name: 'Lava' },                                       // no match
  { id: 'donut', icon: '🍩', name: 'Donut' },                                     // no match (biscuit is reserved for cafe)
  { id: 'wizard', icon: '🧙', name: 'Wizard Hat' },                                // no match
  { id: 'taco', icon: '🌮', name: 'Taco' },                                        // no match
  { id: 'lightning', icon: '⚡', iconName: 'lightning', name: 'Lightning' },
  { id: 'bone', icon: '🦴', iconName: 'bone',           name: 'Cursed Bone' },
  { id: 'ghost', icon: '👻', iconName: 'ghost',         name: 'Ghost Wisp' },
  { id: 'crystal', icon: '💎', iconName: 'gem',          name: 'Crystal' },
  { id: 'cheese', icon: '🧀', iconName: 'cheese',       name: 'Forbidden Cheese' },
  { id: 'gear', icon: '⚙', name: 'Mech Gear' },                                   // no match
  { id: 'rainbow', icon: '🌈', name: 'Rainbow Juice' },                            // no match
  { id: 'eyeball', icon: '👁', iconName: 'monsterEye',  name: 'Spare Eyeball' },
  { id: 'tongue', icon: '👅', name: 'Extra Tongue' },                              // no match
  { id: 'fire', icon: '🔥', iconName: 'flame',          name: 'Fire Spark' },
  { id: 'ice', icon: '🧊', name: 'Ice Cube' },                                    // no match
  { id: 'snake', icon: '🐍', name: 'Snake DNA' },                                  // no match
  { id: 'cake', icon: '🍰', iconName: 'cake',            name: 'Birthday Cake' },
  { id: 'bat', icon: '🦇', name: 'Bat Wing' },                                     // no match
  { id: 'tentacle', icon: '🐙', name: 'Tentacle' },                                // no match
  { id: 'leaf', icon: '🌿', name: 'Strange Leaf' },                                // no match
];

// Legendary named recipes (sorted ingredient ids → result)
const LEGENDARY = {
  'donut,lava,wizard':     { name: 'MOLTEN SPRINKLE MAGE', icon: '🔥🍩🧙', tier: 'LEGENDARY', desc: 'Casts donut-meteors. Glaze is volcanic.' },
  'bone,cheese,ghost':     { name: 'GORGONZOLA SPECTRE',   icon: '👻🧀🦴', tier: 'LEGENDARY', desc: 'Phases through walls, stinks of regret.' },
  'crystal,rainbow,wizard':{ name: 'PRISMATIC ORACLE PUG', icon: '💎🌈🧙', tier: 'LEGENDARY', desc: 'Sees all futures. Mostly futures involving snacks.' },
  'gear,lightning,snake':  { name: 'MECHA-COBRA EMPEROR',  icon: '🐍⚡⚙',  tier: 'LEGENDARY', desc: 'Half snake, half tank. 100% bork.' },
  'ghost,tentacle,eyeball':{ name: 'PUG-THULHU',           icon: '🐙👁👻', tier: 'LEGENDARY', desc: 'Ph\'nglui mglw\'nafh bork bork.' },
  'cake,fire,rainbow':     { name: 'BIRTHDAY DRAGON PUG',   icon: '🎂🔥🌈', tier: 'LEGENDARY', desc: 'Breathes party candles. Every day is its birthday.' },
  'bat,ghost,leaf':        { name: 'AUTUMN HAUNT PUG',      icon: '🍂🦇👻', tier: 'LEGENDARY', desc: 'Smells like pumpkin spice and old regret.' },
  'crystal,ice,tongue':    { name: 'FROZEN LICK GOLEM',     icon: '🧊💎👅', tier: 'LEGENDARY', desc: 'Long tongue, longer brain freeze.' },
  'cheese,snake,taco':     { name: 'NACHO SERPENT',         icon: '🌮🐍🧀', tier: 'LEGENDARY', desc: 'Slithers with crunch. Spicy bork.' },
  'gear,fire,wizard':      { name: 'STEAMPUNK MAGUS',       icon: '⚙🔥🧙',  tier: 'LEGENDARY', desc: 'Half clockwork, half spellcaster, all bork.' },
  'lightning,rainbow,eyeball': { name: 'KALEIDOSCOPE EYE',  icon: '👁🌈⚡', tier: 'LEGENDARY', desc: 'Sees in 11 dimensions. Most are snacks.' },
  'donut,cake,cheese':     { name: 'DESSERT KING PUG',      icon: '🍩🧀🍰', tier: 'LEGENDARY', desc: 'Eats only the sweet AND the savory. Diabetic vet declines.' },
  'bone,lava,tentacle':    { name: 'HELL-OCTOPUG',          icon: '🦴🌋🐙', tier: 'LEGENDARY', desc: 'Eight burning tentacles. Eight times the chaos.' },
};

// Cursed adjectives + nouns for procedural names
const ADJ = ['Molten', 'Cursed', 'Slimy', 'Holy', 'Frozen', 'Toasted', 'Glittered', 'Stinky', 'Spectral', 'Crispy', 'Soggy', 'Galactic', 'Forbidden', 'Burnt', 'Dripping', 'Glowing', 'Wobbly', 'Inverted', 'Possessed', 'Sentient'];
const NOUN = ['Loaf', 'Mage', 'Knight', 'Lord', 'Demon', 'Angel', 'Ghoul', 'Sphere', 'Blob', 'Wraith', 'Thing', 'Hybrid', 'Crab', 'Worm', 'Wisp', 'Beast', 'Mutant', 'Abomination', 'Snack', 'Cryptid'];
const FACE = ['😈', '👹', '🤖', '🧟', '🦄', '🐲', '🦑', '🦎', '🐸', '🐺', '🐯', '🦊', '🐻', '🦝', '🦨', '🐲', '🦖', '🦕', '🪼', '🧠'];
const CAPS = ['"It bork. It haunt. It mid."', '"Tag urself."', '"Do not feed."', '"Was once a good boy."', '"Smells like static."', '"Born in a microwave."', '"Knows what you did."', '"5/7."', '"Sad pug noises."', '"Just vibing."', '"Don\'t look it in the snoot."', '"Vegan now somehow."', '"100% organic chaos."', '"Cannot stop bork."', '"Free to a good home."'];

// Target totals per tier (for the codex display + progress goal)
const TIER_TARGETS = { COMMON: 14, RARE: 14, EPIC: 14, LEGENDARY: 13, CURSED: 5 };
const TIER_ORDER = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'CURSED'];

// Decide tier from sorted ids (deterministic). Legendaries are checked separately first.
// Cursed: rare-ish (hash trigger). Others: bucket by hash bytes for variety.
function decideTier(ids) {
  const hash = ids.reduce((h, s) => (h * 31 + s.charCodeAt(0)) >>> 0, 13);
  const byte = hash & 0xff;
  if (byte < 22) return 'CURSED';       // ~8.6%
  if (byte < 56) return 'EPIC';         // ~13%
  if (byte < 124) return 'RARE';        // ~26.5%
  return 'COMMON';                       // ~52%
}

let beaker = [null, null, null];
let discoveries = {}; // id -> {name, icon, tier, desc}
let experiments = 0;

const collEl = document.getElementById('collection');
const ingEl = document.getElementById('ingredients');
const resEl = document.getElementById('result');
const fuseBtn = document.getElementById('lab-fuse');

function renderIngredients() {
  ingEl.innerHTML = '';
  for (const ing of INGREDIENTS) {
    const el = document.createElement('div');
    el.className = 'lab-item';
    el.innerHTML = `<div class="lab-item__icon">${_labIcon(ing, 24)}</div><div class="lab-item__name">${ing.name}</div>`;
    el.addEventListener('click', () => addToBeaker(ing));
    ingEl.appendChild(el);
  }
}

function addToBeaker(ing) {
  const slot = beaker.findIndex((s) => s == null);
  if (slot === -1) return;
  beaker[slot] = ing;
  sfx.tone(440 + slot * 110, 'triangle', 0.08, 0.18);
  syncBeaker();
}

function syncBeaker() {
  document.querySelectorAll('.lab-slot').forEach((el, i) => {
    if (beaker[i]) {
      // Use SVG icon when available so beaker matches the shelf
      if (beaker[i].iconName && iconSvg[beaker[i].iconName]) {
        el.innerHTML = iconSvg[beaker[i].iconName](32);
      } else {
        el.textContent = beaker[i].icon;
      }
      el.classList.add('filled');
    } else {
      el.textContent = '+';
      el.classList.remove('filled');
    }
  });
  const allFilled = beaker.every((s) => s != null);
  fuseBtn.disabled = !allFilled;
  // Glow + bubbles when 3 loaded
  const beakerEl = document.querySelector('.lab-beaker');
  if (beakerEl) {
    beakerEl.classList.toggle('is-ready', allFilled);
    // Manage bubbles
    let bubbles = beakerEl.querySelectorAll('.lab-bubble');
    const want = allFilled ? 5 : (beaker.filter((b) => b != null).length);
    if (bubbles.length < want) {
      for (let i = bubbles.length; i < want; i++) {
        const b = document.createElement('div'); b.className = 'lab-bubble';
        b.style.animationDelay = (i * 0.3) + 's';
        b.style.setProperty('--dx', ((Math.random() - 0.5) * 30) + 'px');
        beakerEl.appendChild(b);
      }
    } else if (bubbles.length > want) {
      for (let i = want; i < bubbles.length; i++) bubbles[i].remove();
    }
    // Smoke wisps (once)
    if (!beakerEl.querySelector('.lab-smoke')) {
      for (let i = 0; i < 3; i++) {
        const sm = document.createElement('div');
        sm.className = 'lab-smoke';
        beakerEl.appendChild(sm);
      }
    }
  }
  // Tesla coils crackle harder when all 3 ingredients loaded
  setCoilCharging(allFilled);
}

document.querySelectorAll('.lab-slot').forEach((el, i) => {
  el.addEventListener('click', () => { beaker[i] = null; syncBeaker(); });
});

fuseBtn.addEventListener('click', fuse);

function fuse() {
  const ids = beaker.map((b) => b.id).sort();
  const key = ids.join(',');
  experiments++;
  let result;
  if (LEGENDARY[key]) {
    result = { ...LEGENDARY[key], key, legendary: true };
  } else {
    // Procedural mutant: derive name from hashed ingredient ids
    const hash = ids.reduce((h, s) => (h * 31 + s.charCodeAt(0)) >>> 0, 7);
    const adj = ADJ[hash % ADJ.length];
    const noun = NOUN[(hash >> 4) % NOUN.length];
    const face = FACE[(hash >> 8) % FACE.length];
    const cap = CAPS[(hash >> 12) % CAPS.length];
    const tier = decideTier(ids);
    const cursed = tier === 'CURSED';
    result = {
      key, name: `${adj.toUpperCase()} ${noun.toUpperCase()} PUG`, icon: face,
      tier, desc: cap, cursed,
    };
  }
  const isNew = !discoveries[key];
  if (isNew) discoveries[key] = result;
  showResult(result, isNew);
  // Big lightning flash on every fuse
  flashArc();
  beaker = [null, null, null];
  syncBeaker();
  save();
  renderCollection();
  refreshShelfBg();
  updateHud();
  // Celebration FX
  const beakerEl = document.querySelector('.lab-beaker');
  const rect = beakerEl ? beakerEl.getBoundingClientRect() : null;
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  if (result.legendary) {
    sparkleBurst(cx, cy, 36, '#ffd23f');
    setTimeout(() => sparkleBurst(cx, cy, 24, '#ff8ac8'), 120);
    setTimeout(() => sparkleBurst(cx, cy, 24, '#4cc9f0'), 240);
    shakeEl(beakerEl);
    if (isNew) {
      const hudCard = document.querySelector('#hud .hud-card');
      if (hudCard) {
        hudCard.classList.remove('is-legendary'); void hudCard.offsetWidth; hudCard.classList.add('is-legendary');
      }
    }
  } else if (result.tier === 'EPIC') {
    sparkleBurst(cx, cy, 24, '#b055ff');
    setTimeout(() => sparkleBurst(cx, cy, 12, '#d090ff'), 140);
  } else if (result.tier === 'RARE') {
    sparkleBurst(cx, cy, 16, '#4cc9f0');
  } else if (result.cursed) {
    sparkleBurst(cx, cy, 16, '#ff3a3a');
    shakeEl(beakerEl);
  } else {
    sparkleBurst(cx, cy, 12, '#c8c8d8');
  }
}

function showResult(r, isNew) {
  resEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'lab-result' + (r.legendary ? ' legendary' : (r.cursed ? ' cursed' : ''));
  const cols = _pugColorsFor(r.key || r.name || r.icon);
  const pugSlot = document.createElement('div'); pugSlot.className = 'lab-result__pug';
  pugSlot.style.display = 'flex'; pugSlot.style.alignItems = 'center'; pugSlot.style.justifyContent = 'center';
  pugSlot.appendChild(_makeLabPugCanvas(72, 78, { size: 72, ...cols }));
  div.appendChild(pugSlot);
  const nameDiv = document.createElement('div'); nameDiv.className = 'lab-result__name'; nameDiv.textContent = r.name;
  div.appendChild(nameDiv);
  const badgeRow = document.createElement('div');
  badgeRow.innerHTML = `<span class="lab-rarity-badge ${r.tier}">${r.tier}${isNew ? ' · ★ NEW' : ''}</span>`;
  div.appendChild(badgeRow);
  const cap = document.createElement('div'); cap.className = 'lab-result__caption'; cap.textContent = r.desc;
  div.appendChild(cap);
  resEl.appendChild(div);
  if (r.legendary) {
    sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.1, 0.25, 0.3);
  } else if (r.cursed) {
    sfx.sweep(220, 80, 'sawtooth', 0.5, 0.22);
  } else {
    sfx.arp([330, 440, 523], 'square', 0.08, 0.2, 0.25);
  }
  setTimeout(() => { div.style.transition = 'opacity 1s'; div.style.opacity = '0.4'; }, 3500);
}

function renderCollection() {
  collEl.innerHTML = '';
  const list = Object.values(discoveries);
  if (list.length === 0) {
    collEl.innerHTML = '<div style="color:var(--muted);font-size:0.45rem;padding:6px;">No pugs discovered yet</div>';
    return;
  }
  for (const d of list) {
    const el = document.createElement('div');
    el.className = 'lab-item';
    el.title = `${d.name} — ${d.desc}`;
    const cols = _pugColorsFor(d.key || d.name || d.icon);
    const iconWrap = document.createElement('div'); iconWrap.className = 'lab-item__icon';
    iconWrap.style.display = 'flex'; iconWrap.style.alignItems = 'center'; iconWrap.style.justifyContent = 'center';
    iconWrap.appendChild(_makeLabPugCanvas(34, 36, { size: 34, ...cols }));
    el.appendChild(iconWrap);
    const nameEl = document.createElement('div'); nameEl.className = 'lab-item__name';
    nameEl.style.color = d.legendary ? 'var(--neon-yellow)' : (d.cursed ? 'var(--crimson)' : 'var(--text-soft)');
    nameEl.textContent = d.name.split(' ').slice(0, 2).join(' ');
    el.appendChild(nameEl);
    collEl.appendChild(el);
  }
}

function updateHud() {
  const total = Object.keys(discoveries).length;
  const legCount = Object.values(discoveries).filter((d) => d.legendary).length;
  document.getElementById('hud-discovered').textContent = `${total}/60`;
  document.getElementById('hud-legendary').textContent = `${legCount}/${Object.keys(LEGENDARY).length}`;
  document.getElementById('hud-exp').textContent = experiments;
}

function save() {
  try {
    localStorage.setItem('mutlab:state', JSON.stringify({ discoveries, experiments }));
    // Also write to namespaced highscore + codex keys per spec
    localStorage.setItem('wg:hs:mutation-lab', JSON.stringify({ score: Object.keys(discoveries).length, discovered: Object.keys(discoveries).length, experiments, ts: Date.now() }));
    localStorage.setItem('wg:codex:mutation-lab', JSON.stringify(discoveries));
  } catch {}
}
function load() {
  try {
    // Prefer the codex key if present
    const codexRaw = localStorage.getItem('wg:codex:mutation-lab');
    if (codexRaw) {
      discoveries = JSON.parse(codexRaw) || {};
    }
    const s = JSON.parse(localStorage.getItem('mutlab:state') || '{}');
    if (s.discoveries && Object.keys(discoveries).length === 0) discoveries = s.discoveries;
    if (s.experiments) experiments = s.experiments;
  } catch {}
}

// ===== CODEX =====
const _codexBtn = document.createElement('button');
_codexBtn.className = 'lab-codex-btn';
_codexBtn.textContent = '📖 CODEX';
document.body.appendChild(_codexBtn);
const _codexModal = document.createElement('div');
_codexModal.className = 'lab-codex-modal';
_codexModal.innerHTML = `
  <div class="lab-codex-modal__panel">
    <h2 class="lab-codex-title">★ MUTATION CODEX ★</h2>
    <div class="lab-codex-sub" id="codex-sub">DISCOVERED 0/60</div>
    <div id="codex-body"></div>
    <button class="lab-codex-close" id="codex-close">CLOSE</button>
  </div>
`;
document.body.appendChild(_codexModal);
_codexBtn.addEventListener('click', openCodex);
document.getElementById('codex-close').addEventListener('click', () => _codexModal.classList.remove('is-open'));
_codexModal.addEventListener('click', (e) => { if (e.target === _codexModal) _codexModal.classList.remove('is-open'); });

function openCodex() {
  const sub = document.getElementById('codex-sub');
  const total = Object.keys(discoveries).length;
  if (sub) sub.textContent = `DISCOVERED ${total}/60`;
  const body = document.getElementById('codex-body');
  body.innerHTML = '';
  // Group by tier; legendary key set is known. For other tiers we synthesize
  // slot-counts up to TIER_TARGETS — discovered ones in each tier are shown
  // by icon/name; the remainder are ? cells.
  const byTier = { LEGENDARY: [], EPIC: [], RARE: [], COMMON: [], CURSED: [] };
  for (const d of Object.values(discoveries)) {
    const t = d.tier || (d.legendary ? 'LEGENDARY' : (d.cursed ? 'CURSED' : 'COMMON'));
    if (byTier[t]) byTier[t].push(d);
  }
  for (const tier of TIER_ORDER) {
    const have = byTier[tier];
    const target = TIER_TARGETS[tier];
    const heading = document.createElement('div');
    heading.className = 'lab-codex-tier-title ' + tier;
    heading.textContent = `${tier} — ${have.length}/${target}`;
    body.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'lab-codex-grid';
    // Discovered cells first
    for (const d of have) {
      const cell = document.createElement('div');
      cell.className = `lab-codex-cell ${tier} discovered`;
      cell.title = d.desc || d.name;
      const iconWrap = document.createElement('div'); iconWrap.className = 'lab-codex-cell__icon';
      iconWrap.style.display = 'flex'; iconWrap.style.alignItems = 'center'; iconWrap.style.justifyContent = 'center';
      const cols = _pugColorsFor(d.key || d.name || d.icon);
      iconWrap.appendChild(_makeLabPugCanvas(32, 34, { size: 32, ...cols }));
      cell.appendChild(iconWrap);
      const nameEl = document.createElement('div'); nameEl.className = 'lab-codex-cell__name';
      nameEl.textContent = d.name.split(' ').slice(0,2).join(' ');
      cell.appendChild(nameEl);
      grid.appendChild(cell);
    }
    // Undiscovered placeholders
    for (let i = have.length; i < target; i++) {
      const cell = document.createElement('div');
      cell.className = `lab-codex-cell ${tier}`;
      cell.innerHTML = `<div class="lab-codex-cell__unk">?</div><div class="lab-codex-cell__name">???</div>`;
      grid.appendChild(cell);
    }
    body.appendChild(grid);
  }
  _codexModal.classList.add('is-open');
}

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('overlay').hidden = true;
  document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('lab').hidden = false;
  load();
  renderIngredients();
  renderCollection();
  refreshShelfBg();
  updateHud();
  syncBeaker(); // ensures bubble + glow state reflects empty beaker
  sfx.resume();
});

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('Tap 3 ingredients → ⚗ FUSE. Tap 📖 CODEX to track all 60 species. Yellow lever = sparks!', 7000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
