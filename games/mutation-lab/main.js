// PUG MUTATION LAB — combine 3 ingredients to discover pug species.
// Recipes are deterministic by ingredient set (sorted). Some are pre-named
// legendaries, others are procedurally generated cursed pugs.
//
// Each combination is *one-shot per profile*: repeating the same 3 ingredients
// triggers an "ALREADY DISCOVERED" feedback (toast + shake + ingredient
// refund) instead of producing the same result again.
import { createSfx } from '../../src/shared/miniSfx.js';
import { createMusicTrack } from '../../src/shared/musicTrack.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { makeIngredientCanvas } from '../../src/shared/ingredientIcons.js';
import { profileKey } from '../../src/shared/profile.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { htmlVignette as _depthVignette } from '../../src/shared/depth3D.js';

// Mutation lab is drag-only; the shared module just adds a BACK chip + mute.
createMobileControls({ layout: 'single-tap', buttons: [] });
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'mutation-lab', getControlsHelp: () => _isTouch
  ? 'TAP 3 ingredients → ⚗ FUSE. Each combo is one-shot — get creative! 📖 CODEX tracks species. Saved to your profile.'
  : 'CLICK 3 ingredients → ⚗ FUSE. Each combo is one-shot — get creative! 📖 CODEX tracks species. Saved to your profile.' });

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

// Helper: small wrapper around makeIngredientCanvas with sensible defaults.
function _ingredientEl(ing, size) {
  return makeIngredientCanvas(ing.id, size || 32);
}

const sfx = createSfx({ storageKey: 'mutlab:muted' });
// Sleepy lab ambience — slow chill arp, never changes intensity.
const music = createMusicTrack({ mood: 'chill', tempo: 80, key: 'F', scale: 'major' });
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
.lab-lever__label { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
  font-family: var(--font-display); font-size: 0.4rem; color: var(--neon-yellow);
  letter-spacing: 0.08em; white-space: nowrap; text-shadow: 0 0 4px #000, 0 0 2px #000; }

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
.lab-codex-cell__unk { font-size: 30px; opacity: 0.45; color: #7a7a8a; }
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

/* Per-ingredient combo-count badge (bottom-right of each ingredient cell) */
.lab-item { position: relative; }
.lab-item__combos { position: absolute; top: 2px; right: 2px; min-width: 14px; height: 14px;
  padding: 0 3px; box-sizing: border-box; line-height: 12px; text-align: center;
  font-family: var(--font-display); font-size: 0.3rem; letter-spacing: 0;
  color: #0a0716; background: var(--neon-yellow); border: 1px solid #4a3a08;
  border-radius: 8px; box-shadow: 0 0 4px rgba(255,210,63,0.6); pointer-events: none; }
.lab-item__combos--zero { background: #2a2540; color: #8a90b1; border-color: #1a1430;
  box-shadow: none; }
.lab-codex-cell__icon { display: flex; align-items: center; justify-content: center; }

/* "Already discovered" toast (centred top, distinct from showTip yellow border) */
.lab-already-toast { position: fixed; top: calc(60px + env(safe-area-inset-top, 0));
  left: 50%; transform: translateX(-50%) translateY(-12px);
  z-index: 220; pointer-events: none;
  font-family: var(--font-display); font-size: 0.55rem; letter-spacing: 0.08em;
  color: #ffffff; background: rgba(110, 20, 30, 0.96);
  border: 2px solid var(--crimson); border-radius: 6px;
  padding: 10px 16px; max-width: 86vw; text-align: center; line-height: 1.5;
  box-shadow: 0 0 24px rgba(255,58,58,0.55);
  opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease; }
.lab-already-toast.is-show { opacity: 1; transform: translateX(-50%) translateY(0); }

/* Refund flash on ingredient cell (brief red ring) */
.lab-refund-flash { animation: lab-refund 0.6s ease-out; }
@keyframes lab-refund {
  0%   { box-shadow: 0 0 0 0 rgba(255,58,58,0.0); border-color: var(--border); }
  30%  { box-shadow: 0 0 24px 4px rgba(255,58,58,0.85); border-color: var(--crimson); }
  100% { box-shadow: 0 0 0 0 rgba(255,58,58,0.0); border-color: var(--border); }
}

/* Codex cell "ping" — used when same combo highlights existing creature */
.lab-codex-cell.is-ping { animation: lab-codex-ping 0.9s ease-out; }
@keyframes lab-codex-ping {
  0%   { box-shadow: 0 0 0 0 rgba(255,210,63,0.0); }
  35%  { box-shadow: 0 0 28px 6px rgba(255,210,63,0.75); }
  100% { box-shadow: 0 0 0 0 rgba(255,210,63,0.0); }
}

@keyframes lab-leg-pulse { 0%,100% { box-shadow: 0 0 40px var(--neon-yellow); }
  50% { box-shadow: 0 0 80px var(--neon-yellow), 0 0 120px rgba(255,210,63,0.5); } }
.hud-card.is-legendary { animation: lab-hud-leg 0.8s ease-out; }
@keyframes lab-hud-leg { 0% { box-shadow: 0 0 0 var(--neon-yellow); }
  50% { box-shadow: 0 0 40px var(--neon-yellow); } 100% { box-shadow: 0 0 0 var(--neon-yellow); } }

/* "🔍 FILTER" toggle — dim ingredients that already participate in many combos
   (default threshold 8) so the player visually focuses on under-explored ones. */
.lab-item--filtered { opacity: 0.28; filter: grayscale(0.7); pointer-events: auto; }
.lab-item--filtered:hover { opacity: 0.5; }
.lab-filter-btn { /* shares lab-codex-btn rules, just slid left in JS */ }

/* TIER-COMPLETE banner — drops down on first time the player completes a tier. */
.lab-tier-banner { position: fixed; top: 18%; left: 50%;
  transform: translate(-50%, -200%); z-index: 250;
  font-family: var(--font-display); font-size: 0.9rem; letter-spacing: 0.1em;
  padding: 14px 24px; border-radius: 8px; text-align: center;
  background: rgba(10, 7, 22, 0.97);
  border: 3px solid currentColor; color: var(--neon-yellow);
  box-shadow: 0 0 32px currentColor, 0 0 64px rgba(255, 210, 63, 0.5);
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none; max-width: 86vw;
}
.lab-tier-banner.is-show { transform: translate(-50%, 0); }
.lab-tier-banner__sub { font-size: 0.5rem; letter-spacing: 0.06em;
  color: var(--text-soft); margin-top: 6px; }
.lab-tier-banner.COMMON    { color: #c8c8d8; box-shadow: 0 0 32px #c8c8d8, 0 0 64px rgba(200,200,216,0.45); }
.lab-tier-banner.RARE      { color: #4cc9f0; box-shadow: 0 0 32px #4cc9f0, 0 0 64px rgba(76,201,240,0.45); }
.lab-tier-banner.EPIC      { color: #b055ff; box-shadow: 0 0 32px #b055ff, 0 0 64px rgba(176,85,255,0.45); }
.lab-tier-banner.LEGENDARY { color: #ffd23f; box-shadow: 0 0 32px #ffd23f, 0 0 64px rgba(255,210,63,0.45); }
.lab-tier-banner.CURSED    { color: #ff3a3a; box-shadow: 0 0 32px #ff3a3a, 0 0 64px rgba(255,58,58,0.45); }

/* Confetti pieces — single absolute-positioned bits that fly out + fall. */
.lab-confetti { position: fixed; width: 8px; height: 12px; pointer-events: none;
  z-index: 245; opacity: 0; will-change: transform, opacity;
  animation: lab-confetti-fall 1.6s ease-out forwards; }
@keyframes lab-confetti-fall {
  0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--tx, 0), 70vh) rotate(var(--rot, 540deg)); opacity: 0; }
}

/* Tier-aura particle on future fusion result — appears around the discovered
   creature card whenever its tier has been fully unlocked. */
.lab-result.has-tier-aura { position: relative; }
.lab-result.has-tier-aura::before {
  content: ''; position: absolute; inset: -10px; border-radius: 16px;
  background: radial-gradient(circle, currentColor 0%, transparent 70%);
  opacity: 0.18; pointer-events: none;
  animation: lab-aura-pulse 2.2s ease-in-out infinite;
}
@keyframes lab-aura-pulse {
  0%, 100% { transform: scale(1.0); opacity: 0.18; }
  50%      { transform: scale(1.08); opacity: 0.35; }
}
.lab-result.has-tier-aura.COMMON { color: #c8c8d8; }
.lab-result.has-tier-aura.RARE { color: #4cc9f0; }
.lab-result.has-tier-aura.EPIC { color: #b055ff; }
.lab-result.has-tier-aura.LEGENDARY { color: #ffd23f; }
.lab-result.has-tier-aura.CURSED { color: #ff3a3a; }

/* Round 2C: ENTRY UNLOCKED banner — sheet-style notification for every new
   discovery (separate from the heavy tier-complete banner). Slides in from
   the right and dissolves after ~1.6s. Layered above sparkles. */
.lab-entry-banner { position: fixed; top: 14%; right: 4%;
  z-index: 252; pointer-events: none;
  font-family: var(--font-display); font-size: 0.5rem; letter-spacing: 0.12em;
  padding: 8px 14px; border-radius: 6px;
  background: rgba(10,7,22,0.94); border: 2px solid currentColor;
  color: var(--neon-yellow);
  box-shadow: 0 0 18px currentColor, inset 0 0 12px rgba(255,210,63,0.18);
  transform: translateX(120%); transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
}
.lab-entry-banner.is-show { transform: translateX(0); }
.lab-entry-banner__sub { font-size: 0.4rem; color: var(--text-soft); letter-spacing: 0.06em; }
.lab-entry-banner.COMMON    { color: #c8c8d8; box-shadow: 0 0 14px #c8c8d8; }
.lab-entry-banner.RARE      { color: #4cc9f0; box-shadow: 0 0 14px #4cc9f0; }
.lab-entry-banner.EPIC      { color: #b055ff; box-shadow: 0 0 14px #b055ff; }
.lab-entry-banner.LEGENDARY { color: #ffd23f; box-shadow: 0 0 18px #ffd23f, 0 0 36px rgba(255,210,63,0.5); }
.lab-entry-banner.CURSED    { color: #ff3a3a; box-shadow: 0 0 14px #ff3a3a; }

/* Round 2C: ghost-trail when an ingredient flies into the beaker.
   Brief radial fade flying from cursor point to the beaker. */
.lab-ghost-trail { position: fixed; pointer-events: none; z-index: 240;
  width: 36px; height: 36px; transform: translate(-50%, -50%) scale(0.6);
  border-radius: 50%; background: radial-gradient(circle, rgba(76,201,240,0.7), rgba(76,201,240,0));
  opacity: 0; animation: lab-ghost-fly 0.42s ease-out forwards;
}
@keyframes lab-ghost-fly {
  0% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4) translate(var(--gx, 0), var(--gy, 0)); }
}

/* Round 2C: ingredient-card pulse on pick — quick scale punch */
.lab-item.is-picked { animation: lab-item-pick 0.32s ease-out; }
@keyframes lab-item-pick {
  0% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.18); filter: brightness(1.6); }
  100% { transform: scale(1); filter: brightness(1); }
}

/* === WAVE 1F (compact CSS) === */
.lab-assistant{position:fixed;bottom:calc(38% - 4px);left:6%;z-index:6;width:56px;height:60px;pointer-events:none;animation:lab-assist-idle 2.2s ease-in-out infinite;transform-origin:50% 100%}
@keyframes lab-assist-idle{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-3px) scaleY(.97)}}
.lab-assistant canvas{display:block;image-rendering:pixelated}
.lab-assistant__bubble{position:absolute;bottom:100%;left:50%;transform:translate(-50%,-10px);background:rgba(255,255,255,.95);color:#0a0716;font-family:var(--font-display);font-size:.42rem;padding:4px 7px;border-radius:6px;white-space:nowrap;border:2px solid #2a2540;box-shadow:0 2px 4px rgba(0,0,0,.6);opacity:0;transition:opacity .3s, transform .3s}
.lab-assistant__bubble.is-show{opacity:1;transform:translate(-50%,-16px)}
.lab-assistant__bubble::after{content:'';position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#2a2540}
.lab-assistant.is-clap{animation:lab-assist-clap .7s ease-in-out 3}
@keyframes lab-assist-clap{0%,100%{transform:scaleY(1) translateY(0)}50%{transform:scaleY(.9) translateY(-8px)}}
.lab-assistant.is-curious{animation:lab-assist-curious .9s ease-in-out 2}
@keyframes lab-assist-curious{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
.lab-assistant.is-scared{animation:lab-assist-scared .4s ease-in-out 4}
@keyframes lab-assist-scared{0%,100%{transform:translate(0,0)}25%{transform:translate(-4px,0)}75%{transform:translate(4px,0)}}
.lab-pinboard{position:fixed;top:24%;left:50%;transform:translate(-50%,-20px) scale(.6);z-index:4;width:88px;height:100px;pointer-events:none;background:linear-gradient(180deg,#6a3a1c,#4a2a14);border:3px solid #3a200c;border-radius:4px;box-shadow:0 6px 14px rgba(0,0,0,.7), inset 0 0 8px rgba(0,0,0,.35);opacity:0;transition:opacity .3s, transform .4s cubic-bezier(.34,1.56,.64,1)}
.lab-pinboard.is-show{opacity:1;transform:translate(-50%,0) scale(1)}
.lab-pinboard__pin{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#ff8a8a,#c81818 70%);box-shadow:0 0 6px rgba(255,58,58,.7), 0 2px 2px rgba(0,0,0,.6)}
.lab-pinboard__inner{position:absolute;top:8px;left:4px;right:4px;bottom:8px;background:rgba(244,236,210,.95);border-radius:2px;padding:4px;display:flex;flex-direction:column;align-items:center;font-family:var(--font-display);color:#2a1a0c}
.lab-pinboard__name{font-size:.32rem;line-height:1.2;text-align:center;letter-spacing:.04em;margin-top:2px;max-width:100%;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
.lab-sort-row{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 6px;align-items:center}
.lab-sort-row__label{font-family:var(--font-display);font-size:.4rem;letter-spacing:.08em;color:var(--text-soft);margin-right:4px}
.lab-sort-chip{font-family:var(--font-display);font-size:.36rem;letter-spacing:.06em;padding:3px 7px;border-radius:12px;background:rgba(0,0,0,.45);border:1px solid var(--border);color:var(--text-soft);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all .15s}
.lab-sort-chip:hover{border-color:var(--neon-cyan);color:var(--neon-cyan)}
.lab-sort-chip.is-active{background:rgba(76,201,240,.25);border-color:var(--neon-cyan);color:var(--neon-cyan);text-shadow:0 0 6px var(--neon-cyan)}
.lab-sort-chip__dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:3px;vertical-align:middle;box-shadow:0 0 4px currentColor}
.lab-ing-group{width:100%}
.lab-ing-group__title{font-family:var(--font-display);font-size:.4rem;letter-spacing:.08em;opacity:.6;margin:6px 0 3px;display:flex;align-items:center;gap:4px}
.lab-beaker.has-affinity{box-shadow:0 0 36px var(--aff-color,#ff8ac8), inset 0 0 24px var(--aff-color,#ff8ac8) !important;border-color:var(--aff-color,#ff8ac8) !important;transition:box-shadow .3s, border-color .3s}
.lab-affinity-label{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-family:var(--font-display);font-size:.42rem;letter-spacing:.12em;white-space:nowrap;padding:3px 8px;border-radius:4px;background:rgba(0,0,0,.75);color:var(--aff-color,#fff);border:1px solid var(--aff-color,#fff);text-shadow:0 0 6px var(--aff-color,#fff);opacity:0;transition:opacity .3s;pointer-events:none}
.lab-affinity-label.is-show{opacity:1}
.lab-score-line{font-size:.42rem;color:var(--neon-yellow);letter-spacing:.05em}
.lab-score-popup{position:fixed;pointer-events:none;z-index:1001;font-family:var(--font-display);font-size:.7rem;letter-spacing:.08em;color:var(--neon-yellow);text-shadow:0 0 8px var(--neon-yellow), 0 2px 0 #000;animation:lab-score-fly 1.4s cubic-bezier(.2,.7,.3,1) forwards}
@keyframes lab-score-fly{0%{transform:translate(-50%,-50%) scale(.4);opacity:0}20%{transform:translate(-50%,-110%) scale(1.2);opacity:1}100%{transform:translate(-50%,-220%) scale(1);opacity:0}}
.lab-item.is-hint-1-swap{box-shadow:0 0 16px var(--neon-pink), inset 0 0 8px rgba(255,58,161,.4);border-color:var(--neon-pink) !important;animation:lab-hint-pulse 1.4s ease-in-out infinite}
@keyframes lab-hint-pulse{0%,100%{box-shadow:0 0 8px var(--neon-pink), inset 0 0 4px rgba(255,58,161,.3)}50%{box-shadow:0 0 22px var(--neon-pink), inset 0 0 10px rgba(255,58,161,.5)}}
.lab-book-modal,.lab-challenge-modal{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.85);padding:16px}
.lab-book-modal.is-open,.lab-challenge-modal.is-open{display:flex}
.lab-book-modal__panel{background:linear-gradient(180deg,#2a1810,#14080a);border:4px solid #8a5a2a;border-radius:6px;padding:18px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 0 40px rgba(255,210,63,.4), inset 0 0 30px rgba(0,0,0,.6)}
.lab-challenge-modal__panel{background:linear-gradient(180deg,#0e2a3f,#050f1a);border:3px solid #4cc9f0;border-radius:10px;padding:18px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 0 40px rgba(76,201,240,.45)}
.lab-book-title,.lab-challenge-title{font-family:var(--font-display);font-size:.85rem;letter-spacing:.1em;text-align:center;margin:0 0 8px;text-shadow:0 0 12px currentColor}
.lab-book-title{color:#ffd23f}.lab-challenge-title{color:#4cc9f0}
.lab-book-sub,.lab-challenge-sub{text-align:center;font-family:var(--font-display);font-size:.42rem;color:var(--text-soft);margin-bottom:14px;letter-spacing:.05em}
.lab-recipe-entry{background:rgba(244,236,210,.06);border:2px solid rgba(255,210,63,.4);border-radius:4px;padding:10px 12px;margin-bottom:10px;font-family:var(--font-display);font-size:.45rem;line-height:1.5}
.lab-recipe-entry.discovered{background:rgba(255,210,63,.12);border-color:#ffd23f;box-shadow:0 0 12px rgba(255,210,63,.3)}
.lab-recipe-entry__name{color:#ffd23f;font-size:.55rem;letter-spacing:.06em;margin-bottom:4px}
.lab-recipe-entry__name.locked{color:var(--text-soft)}
.lab-recipe-entry__items{display:flex;gap:4px;align-items:center;margin:4px 0;flex-wrap:wrap}
.lab-ri-slot{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;background:rgba(0,0,0,.4);border-radius:4px;color:#7a7a8a;font-size:18px}
.lab-recipe-entry__hint{font-size:.38rem;color:var(--text-soft);letter-spacing:.04em;font-style:italic}
.lab-recipe-entry__desc{font-size:.4rem;color:var(--neon-cyan);margin-top:2px;letter-spacing:.03em}
.lab-book-btn,.lab-daily-btn{position:fixed;z-index:100;font-family:var(--font-display);letter-spacing:.06em;border-radius:6px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.lab-book-btn{top:calc(14px + env(safe-area-inset-top,0));left:60px;background:linear-gradient(180deg,#8a5a2a,#4a2a10);color:#ffd23f;border:3px solid #c8954a;font-size:.5rem;padding:6px 10px;box-shadow:0 4px 0 #2a1410}
.lab-daily-btn{top:calc(54px + env(safe-area-inset-top,0));left:60px;background:linear-gradient(180deg,#4cc9f0,#1a6080);color:#fff;border:3px solid #a0e0ff;font-size:.44rem;padding:5px 9px;box-shadow:0 3px 0 #0a3050}
.lab-book-btn:hover,.lab-daily-btn:hover{transform:translateY(-1px)}
.lab-daily-btn.is-pending{animation:lab-daily-pulse 1.4s ease-in-out infinite}
@keyframes lab-daily-pulse{0%,100%{box-shadow:0 3px 0 #0a3050, 0 0 6px var(--neon-cyan)}50%{box-shadow:0 3px 0 #0a3050, 0 0 22px var(--neon-cyan)}}
.lab-challenge-item{background:rgba(0,0,0,.5);border:2px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px;display:flex;gap:8px;align-items:center}
.lab-challenge-item.complete{border-color:#5ef38c;background:rgba(94,243,140,.1)}
.lab-challenge-item__icon{font-size:22px;flex-shrink:0}
.lab-challenge-item__body{flex:1}
.lab-challenge-item__title{font-family:var(--font-display);font-size:.5rem;color:var(--neon-cyan);letter-spacing:.05em}
.lab-challenge-item.complete .lab-challenge-item__title{color:#5ef38c}
.lab-challenge-item__desc{font-size:.42rem;color:var(--text-soft);margin-top:2px}
.lab-challenge-item__check{font-size:22px;flex-shrink:0;opacity:.4}
.lab-challenge-item.complete .lab-challenge-item__check{opacity:1;color:#5ef38c}
.lab-daily-section{background:rgba(76,201,240,.08);border:2px dashed #4cc9f0;border-radius:6px;padding:10px 12px;margin-bottom:12px}
.lab-daily-section__title{font-family:var(--font-display);font-size:.55rem;letter-spacing:.08em;color:#4cc9f0;margin-bottom:6px}
.lab-daily-section__ings{display:flex;gap:8px;align-items:center;justify-content:center;margin:6px 0}
.lab-daily-section__btn{background:linear-gradient(180deg,#4cc9f0,#1a6080);color:#fff;border:2px solid #a0e0ff;border-radius:4px;font-family:var(--font-display);font-size:.5rem;letter-spacing:.06em;padding:6px 10px;cursor:pointer;display:block;margin:4px auto;box-shadow:0 3px 0 #0a3050}
.lab-codex-search{width:100%;box-sizing:border-box;margin:4px 0 8px;background:rgba(0,0,0,.5);border:2px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--font-display);font-size:.45rem;letter-spacing:.04em;padding:6px 10px;outline:none}
.lab-codex-search:focus{border-color:var(--neon-cyan);box-shadow:0 0 8px rgba(76,201,240,.3)}
.lab-accomplish{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) scale(.3);z-index:260;padding:22px 36px;border-radius:10px;font-family:var(--font-display);font-size:1.1rem;letter-spacing:.1em;background:rgba(10,7,22,.96);border:4px solid currentColor;text-align:center;opacity:0;pointer-events:none;transition:opacity .3s, transform .5s cubic-bezier(.34,1.56,.64,1);text-shadow:0 0 12px currentColor}
.lab-accomplish.is-show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.lab-accomplish__sub{font-size:.5rem;color:var(--text-soft);margin-top:6px;letter-spacing:.05em}
body.lab-theme-dark .lab-bg{background:radial-gradient(ellipse at 50% 0%,rgba(122,32,128,.18),transparent 60%),radial-gradient(ellipse at 20% 100%,rgba(255,58,58,.12),transparent 60%),#050208}
body.lab-theme-cosmic .lab-bg{background:radial-gradient(ellipse at 50% 0%,rgba(176,85,255,.18),transparent 60%),radial-gradient(ellipse at 20% 100%,rgba(76,201,240,.18),transparent 60%),radial-gradient(circle at 75% 25%,rgba(255,210,63,.10),transparent 50%),#0a0820}
.lab-assistant__hat{position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:20px;line-height:1;pointer-events:none;text-shadow:0 2px 4px rgba(0,0,0,.8);opacity:0;transition:opacity .3s}
.lab-assistant__hat.is-show{opacity:1}

`;
const _lstyle = document.createElement('style'); _lstyle.textContent = LAB_CSS; document.head.appendChild(_lstyle);
// depth3D: vignette + subtle 3D tilt on ingredient hover (CSS-only, GPU-cheap).
// Reduced-motion users get vignette ONLY (no tilt).
try { _depthVignette(); } catch (e) { /* */ }
const _labDepthStyle = document.createElement('style');
_labDepthStyle.textContent = `
  .lab-item { transform-style: preserve-3d; transition: transform 0.22s cubic-bezier(.3,1.4,.5,1); will-change: transform; }
  .lab-item:hover { transform: perspective(420px) rotateY(-10deg) rotateX(6deg) translateZ(6px); }
  .lab-item.is-selected { transform: perspective(420px) rotateY(0) rotateX(0) translateZ(10px); }
  body.reduced-motion .lab-item,
  body.reduced-motion .lab-item:hover,
  body.reduced-motion .lab-item.is-selected { transform: none!important; }
  /* Depth-sorted beaker layering via z-index ramp on ingredient stack */
  .lab-beaker__layer { transform: translateZ(0); }
  .lab-beaker__layer:nth-child(1) { z-index: 1; }
  .lab-beaker__layer:nth-child(2) { z-index: 2; }
  .lab-beaker__layer:nth-child(3) { z-index: 3; }
`;
document.head.appendChild(_labDepthStyle);
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

// Round 2C: SHEET-ENTRY style "ENTRY UNLOCKED" pill — appears top-right on
// every NEW discovery (separate from the tier-complete celebration banner).
function showEntryBanner(name, tier) {
  const el = document.createElement('div');
  el.className = `lab-entry-banner ${tier || 'COMMON'}`;
  el.innerHTML = `★ ENTRY UNLOCKED<div class="lab-entry-banner__sub">${(name || '').slice(0, 32)}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-show'));
  setTimeout(() => { el.classList.remove('is-show'); setTimeout(() => el.remove(), 380); }, 1800);
}
const _assist = document.createElement('div');
_assist.className = 'lab-assistant';
// Reuse the lab pug canvas helper — different palette so it reads as "ours"
const _assistCanvas = _makeLabPugCanvas(56, 60, { size: 50, body: '#eac888', mask: '#5a3a1a', tongueOut: true });
_assistCanvas.style.imageRendering = 'pixelated';
_assist.appendChild(_assistCanvas);
const _assistHat = document.createElement('span');
_assistHat.className = 'lab-assistant__hat';
_assistHat.textContent = '';
_assist.appendChild(_assistHat);
const _assistBubble = document.createElement('div');
_assistBubble.className = 'lab-assistant__bubble';
_assist.appendChild(_assistBubble);
document.body.appendChild(_assist);
let _assistBubbleHide = null;
const ASSIST_PHRASES = {
  legendary: ['SPECTACULAR!', 'a MASTERPIECE!', 'history made!', '★ chef\'s kiss ★', 'bork excellence!'],
  epic:      ['amazing!', 'very good fusion', 'epic mutation!', 'I am impressed'],
  rare:      ['nice one!', 'rare specimen', 'good bork', 'interesting'],
  common:    ['…sure.', 'a pug.', 'meh.', 'mid bork.'],
  cursed:    ['don\'t look at it', '*scared yip*', 'IT MOVED', 'I shall sleep here'],
  almost:    ['close!', 'almost there', 'so close…', 'try again'],
  idle:      ['snrk', 'I\'m hungry', 'bork', 'when lunch?', 'I miss the sun'],
};
function assistantReact(kind) {
  // Remove old animation class so the same kind can re-trigger.
  _assist.classList.remove('is-clap', 'is-curious', 'is-scared');
  void _assist.offsetWidth;
  if (kind === 'legendary' || kind === 'epic') _assist.classList.add('is-clap');
  else if (kind === 'cursed') _assist.classList.add('is-scared');
  else if (kind === 'rare' || kind === 'almost') _assist.classList.add('is-curious');
  const phrases = ASSIST_PHRASES[kind] || ASSIST_PHRASES.idle;
  const txt = phrases[Math.floor(Math.random() * phrases.length)];
  _assistBubble.textContent = txt;
  _assistBubble.classList.add('is-show');
  clearTimeout(_assistBubbleHide);
  _assistBubbleHide = setTimeout(() => _assistBubble.classList.remove('is-show'), 2200);
}
// Idle thoughts every ~12-18s during gameplay
setInterval(() => {
  if (!_labStarted || _assistBubble.classList.contains('is-show')) return;
  if (Math.random() < 0.4) assistantReact('idle');
}, 15000);

const _pinBoard = document.createElement('div');
_pinBoard.className = 'lab-pinboard';
_pinBoard.innerHTML = `
  <div class="lab-pinboard__pin"></div>
  <div class="lab-pinboard__inner">
    <div id="lab-pin-pug" style="display:flex;align-items:center;justify-content:center;"></div>
    <div class="lab-pinboard__name" id="lab-pin-name"></div>
  </div>
`;
document.body.appendChild(_pinBoard);
let _pinHide = null;
function pinDiscovery(d) {
  const pugSlot = document.getElementById('lab-pin-pug');
  const nameSlot = document.getElementById('lab-pin-name');
  if (!pugSlot || !nameSlot) return;
  pugSlot.innerHTML = '';
  const cols = _pugColorsFor(d.key || d.name || d.icon);
  pugSlot.appendChild(_makeLabPugCanvas(54, 56, { size: 50, ...cols }));
  nameSlot.textContent = (d.name || '???').split(' ').slice(0, 2).join(' ');
  _pinBoard.classList.add('is-show');
  clearTimeout(_pinHide);
  _pinHide = setTimeout(() => _pinBoard.classList.remove('is-show'), 2600);
}

// Round 2C: ghost-trail from the clicked ingredient towards the beaker — a
// soft radial flicker that hints at the ingredient flying into the beaker.
function ghostTrailToBeaker(fromX, fromY) {
  const beakerEl = document.querySelector('.lab-beaker');
  if (!beakerEl) return;
  const r = beakerEl.getBoundingClientRect();
  const tx = r.left + r.width / 2;
  const ty = r.top + r.height / 2;
  const el = document.createElement('div');
  el.className = 'lab-ghost-trail';
  el.style.left = fromX + 'px';
  el.style.top = fromY + 'px';
  el.style.setProperty('--gx', (tx - fromX) + 'px');
  el.style.setProperty('--gy', (ty - fromY) + 'px');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 480);
}

// 20 ingredients. Every id has a matching pixel-art drawer in
// src/shared/ingredientIcons.js — emoji is kept only as an accessibility
// fallback/title hint and is never rendered in the UI directly anymore.
//
// `element` groups ingredients by elemental family so the shelf can be sorted
// by element (FIRE/WATER/etc.) and the affinity system can hint when two
// loaded ingredients have a natural pairing (e.g. fire+ice = always interesting).
// 8 elements: [color, name]. Compact form; .icon implied by name where used.
const ELEMENTS = {
  FIRE:   { color: '#ff5418', name: 'FIRE',   icon: '🔥' },
  WATER:  { color: '#4cc9f0', name: 'WATER',  icon: '💧' },
  EARTH:  { color: '#8a5a2a', name: 'EARTH',  icon: '🌿' },
  DARK:   { color: '#7a2080', name: 'DARK',   icon: '👻' },
  TECH:   { color: '#b0b0c8', name: 'TECH',   icon: '⚙' },
  COSMIC: { color: '#b055ff', name: 'COSMIC', icon: '✨' },
  FLESH:  { color: '#ff3aa1', name: 'FLESH',  icon: '👁' },
  FOOD:   { color: '#ffd23f', name: 'FOOD',   icon: '🍩' },
};
const INGREDIENTS = [
  { id: 'lava',     emoji: '🌋', name: 'Lava',             element: 'FIRE' },
  { id: 'donut',    emoji: '🍩', name: 'Donut',            element: 'FOOD' },
  { id: 'wizard',   emoji: '🧙', name: 'Wizard Hat',       element: 'COSMIC' },
  { id: 'taco',     emoji: '🌮', name: 'Taco',             element: 'FOOD' },
  { id: 'lightning',emoji: '⚡', name: 'Lightning',         element: 'TECH' },
  { id: 'bone',     emoji: '🦴', name: 'Cursed Bone',      element: 'DARK' },
  { id: 'ghost',    emoji: '👻', name: 'Ghost Wisp',       element: 'DARK' },
  { id: 'crystal',  emoji: '💎', name: 'Crystal',          element: 'COSMIC' },
  { id: 'cheese',   emoji: '🧀', name: 'Forbidden Cheese', element: 'FOOD' },
  { id: 'gear',     emoji: '⚙',  name: 'Mech Gear',        element: 'TECH' },
  { id: 'rainbow',  emoji: '🌈', name: 'Rainbow Juice',    element: 'COSMIC' },
  { id: 'eyeball',  emoji: '👁', name: 'Spare Eyeball',    element: 'FLESH' },
  { id: 'tongue',   emoji: '👅', name: 'Extra Tongue',     element: 'FLESH' },
  { id: 'fire',     emoji: '🔥', name: 'Fire Spark',       element: 'FIRE' },
  { id: 'ice',      emoji: '🧊', name: 'Ice Cube',         element: 'WATER' },
  { id: 'snake',    emoji: '🐍', name: 'Snake DNA',        element: 'FLESH' },
  { id: 'cake',     emoji: '🍰', name: 'Birthday Cake',    element: 'FOOD' },
  { id: 'bat',      emoji: '🦇', name: 'Bat Wing',         element: 'DARK' },
  { id: 'tentacle', emoji: '🐙', name: 'Tentacle',         element: 'FLESH' },
  { id: 'leaf',     emoji: '🌿', name: 'Strange Leaf',     element: 'EARTH' },
];

// Affinity pairs — 2-element key string lookup, much smaller minified.
const AFFINITY = {
  'FIRE|WATER':  ['ELEMENTAL CLASH', '#ff8ac8'],
  'EARTH|FIRE':  ['BURNING GROUND',  '#ff8e3c'],
  'TECH|WATER':  ['SHORT CIRCUIT',   '#4cc9f0'],
  'COSMIC|DARK': ['VOID HARMONY',    '#b055ff'],
  'FLESH|TECH':  ['BIOMECH',         '#ff3aa1'],
  'DARK|FOOD':   ['FORBIDDEN FEAST', '#ffd23f'],
  'COSMIC|FOOD': ['STARLIGHT TREAT', '#fff0a0'],
  'EARTH|FLESH': ['PRIMAL UNION',    '#5ef38c'],
};
function affinityFor(a, b) {
  if (!a || !b || a === b) return null;
  const k = [a, b].sort().join('|');
  const v = AFFINITY[k];
  return v ? { label: v[0], color: v[1] } : null;
}

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
let discoveries = {}; // key -> {name, icon, tier, desc}  (key = sorted ids joined by ',')
let experiments = 0;
// Each 3-ingredient combination is one-shot: once a sorted key lands here,
// re-fusing the same 3 ingredients triggers an "already discovered" toast.
let discoveredCombos = new Set();
// Total possible 3-ingredient combinations from 20 ingredients: C(20,3) = 1140.
const TOTAL_COMBOS = (function () {
  const n = 20, k = 3;
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - i + 1) / i;
  return Math.round(r);
})();

const collEl = document.getElementById('collection');
const ingEl = document.getElementById('ingredients');
const resEl = document.getElementById('result');
const fuseBtn = document.getElementById('lab-fuse');

// Count how many *discovered* combos include this ingredient id.
function combosForIngredient(id) {
  let n = 0;
  for (const key of discoveredCombos) {
    if (key.split(',').includes(id)) n++;
  }
  return n;
}

// Sort modes for the ingredient shelf — wave 1F.
//   'default' = original 20-item flat list
//   'element' = grouped by ELEMENTS family
//   'tier'    = grouped by combo-tier-result-density (most legendary combos first)
//   'combos'  = ascending combo count (helps spotting under-used ingredients)
let _ingSortMode = 'default';

// Build a single ingredient card (DOM element). Helps with the grouped layout.
function _buildIngredientCard(ing) {
  const el = document.createElement('div');
  el.className = 'lab-item';
  el.dataset.ingId = ing.id;
  const elemName = ing.element ? ELEMENTS[ing.element]?.name : '';
  el.title = `${ing.name} ${ing.emoji || ''}${elemName ? ` · ${elemName}` : ''}`.trim();
  // Custom pixel-art icon (no emoji)
  const iconWrap = document.createElement('div');
  iconWrap.className = 'lab-item__icon';
  iconWrap.style.display = 'flex';
  iconWrap.style.alignItems = 'center';
  iconWrap.style.justifyContent = 'center';
  iconWrap.appendChild(_ingredientEl(ing, 32));
  el.appendChild(iconWrap);
  // Name label
  const nameEl = document.createElement('div');
  nameEl.className = 'lab-item__name';
  nameEl.textContent = ing.name;
  el.appendChild(nameEl);
  // Combo-count badge ("4" = 4 discovered combos using this ingredient)
  const n = combosForIngredient(ing.id);
  const badge = document.createElement('div');
  badge.className = 'lab-item__combos' + (n === 0 ? ' lab-item__combos--zero' : '');
  badge.textContent = String(n);
  badge.title = `${n} discovered combo${n === 1 ? '' : 's'} use ${ing.name}`;
  el.appendChild(badge);
  // Element color stripe on the left edge (subtle hint)
  if (ing.element && ELEMENTS[ing.element]) {
    const stripe = document.createElement('div');
    stripe.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:3px;background:${ELEMENTS[ing.element].color};box-shadow:0 0 6px ${ELEMENTS[ing.element].color};border-radius:6px 0 0 6px;`;
    el.appendChild(stripe);
  }
  el.addEventListener('click', (ev) => {
    const r = el.getBoundingClientRect();
    const fx = r.left + r.width / 2;
    const fy = r.top + r.height / 2;
    addToBeaker(ing, fx, fy);
    el.classList.remove('is-picked'); void el.offsetWidth; el.classList.add('is-picked');
    setTimeout(() => el.classList.remove('is-picked'), 340);
  });
  return el;
}

function renderIngredients() {
  ingEl.innerHTML = '';
  // Sort/filter chip row first (always at top of shelf so the modes are
  // visible without scrolling).
  const sortRow = document.createElement('div');
  sortRow.className = 'lab-sort-row';
  sortRow.innerHTML = `<span class="lab-sort-row__label">SORT</span>`;
  const modes = [
    { id: 'default', label: 'A-Z' },
    { id: 'element', label: 'ELEMENT' },
    { id: 'combos',  label: 'COMBOS' },
  ];
  for (const m of modes) {
    const chip = document.createElement('span');
    chip.className = 'lab-sort-chip' + (_ingSortMode === m.id ? ' is-active' : '');
    chip.textContent = m.label;
    chip.addEventListener('click', () => {
      _ingSortMode = m.id;
      renderIngredients();
      applyIngredientFilter();
      applyAlmostHints();
    });
    sortRow.appendChild(chip);
  }
  ingEl.appendChild(sortRow);

  if (_ingSortMode === 'element') {
    // Group ingredients by their element. Sort element groups by ELEMENTS key
    // order so the grid is stable between renders.
    const byElement = {};
    for (const ing of INGREDIENTS) {
      const e = ing.element || 'MISC';
      (byElement[e] = byElement[e] || []).push(ing);
    }
    for (const elemKey of Object.keys(ELEMENTS)) {
      const list = byElement[elemKey];
      if (!list || list.length === 0) continue;
      const group = document.createElement('div');
      group.className = 'lab-ing-group';
      const title = document.createElement('div');
      title.className = 'lab-ing-group__title';
      title.style.color = ELEMENTS[elemKey].color;
      title.innerHTML = `<span class="lab-sort-chip__dot" style="background:${ELEMENTS[elemKey].color};color:${ELEMENTS[elemKey].color};"></span>${ELEMENTS[elemKey].name} · ${list.length}`;
      group.appendChild(title);
      const grid = document.createElement('div');
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
      for (const ing of list) grid.appendChild(_buildIngredientCard(ing));
      group.appendChild(grid);
      ingEl.appendChild(group);
    }
  } else {
    // 'default' = original order, 'combos' = sort by combo count asc (helps
    // find under-used ingredients quickly).
    const list = INGREDIENTS.slice();
    if (_ingSortMode === 'combos') {
      list.sort((a, b) => combosForIngredient(a.id) - combosForIngredient(b.id));
    }
    for (const ing of list) ingEl.appendChild(_buildIngredientCard(ing));
  }
}

function addToBeaker(ing, fromX, fromY) {
  const slot = beaker.findIndex((s) => s == null);
  if (slot === -1) return;
  beaker[slot] = ing;
  sfx.tone(440 + slot * 110, 'triangle', 0.08, 0.18);
  // Round 2C: layered higher tone for the satisfying "click" when slot fills
  sfx.tone(880 + slot * 80, 'triangle', 0.04, 0.12);
  // Round 2C: ghost trail from clicked card to beaker (if a source was given)
  if (typeof fromX === 'number' && typeof fromY === 'number') {
    ghostTrailToBeaker(fromX, fromY);
  }
  syncBeaker();
  // Wave 1F: refresh ALMOST DISCOVERED hint pulses for any 1-swap-away combos
  applyAlmostHints();
}

function syncBeaker() {
  document.querySelectorAll('.lab-slot').forEach((el, i) => {
    el.innerHTML = '';
    if (beaker[i]) {
      // Custom pixel-art icon — matches the shelf
      el.appendChild(_ingredientEl(beaker[i], 44));
      el.classList.add('filled');
      el.title = beaker[i].name;
    } else {
      el.textContent = '+';
      el.classList.remove('filled');
      el.title = '';
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
    // ===== WAVE 1F: AFFINITY GLOW + LABEL =====
    // Look at currently-loaded ingredients; if any pair shares an affinity
    // bond, highlight the beaker with that color and show a small label above
    // it. Resets cleanly when ingredients change or slot is cleared.
    let affinity = null;
    const loaded = beaker.filter((b) => b != null);
    if (loaded.length >= 2) {
      // Test every loaded pair
      for (let i = 0; i < loaded.length && !affinity; i++) {
        for (let j = i + 1; j < loaded.length && !affinity; j++) {
          affinity = affinityFor(loaded[i].element, loaded[j].element);
        }
      }
    }
    let affLabel = beakerEl.querySelector('.lab-affinity-label');
    if (affinity) {
      beakerEl.classList.add('has-affinity');
      beakerEl.style.setProperty('--aff-color', affinity.color);
      if (!affLabel) {
        affLabel = document.createElement('div');
        affLabel.className = 'lab-affinity-label';
        beakerEl.appendChild(affLabel);
      }
      affLabel.textContent = affinity.label;
      affLabel.style.setProperty('--aff-color', affinity.color);
      requestAnimationFrame(() => affLabel.classList.add('is-show'));
    } else {
      beakerEl.classList.remove('has-affinity');
      if (affLabel) affLabel.classList.remove('is-show');
    }
  }
  // Tesla coils crackle harder when all 3 ingredients loaded
  setCoilCharging(allFilled);
}

document.querySelectorAll('.lab-slot').forEach((el, i) => {
  el.addEventListener('click', () => { beaker[i] = null; syncBeaker(); applyAlmostHints(); });
});

fuseBtn.addEventListener('click', fuse);

// ----- "Already discovered" feedback ---------------------------------------
let _alreadyToast = null;
let _alreadyHideTimer = null;
function showAlreadyToast(text) {
  if (!_alreadyToast) {
    _alreadyToast = document.createElement('div');
    _alreadyToast.className = 'lab-already-toast';
    document.body.appendChild(_alreadyToast);
  }
  _alreadyToast.textContent = text;
  // restart animation
  _alreadyToast.classList.remove('is-show');
  void _alreadyToast.offsetWidth;
  _alreadyToast.classList.add('is-show');
  clearTimeout(_alreadyHideTimer);
  _alreadyHideTimer = setTimeout(() => {
    if (_alreadyToast) _alreadyToast.classList.remove('is-show');
  }, 2200);
}

// Repeat-fuse handler — refunds the beaker visually, shakes everything, and
// (if open) pings the previously discovered creature in the codex.
function handleAlreadyDiscovered(key) {
  // Find the existing creature for context in the toast / sfx
  const existing = discoveries[key];
  const niceName = existing ? existing.name : 'this combo';
  showAlreadyToast(`ALREADY DISCOVERED — ${niceName}. Try a different mix!`);
  // Shake the beaker
  const beakerEl = document.querySelector('.lab-beaker');
  shakeEl(beakerEl);
  // Refund flash on each ingredient cell currently in the beaker
  const ids = beaker.map((b) => b && b.id).filter(Boolean);
  for (const id of ids) {
    const cell = ingEl && ingEl.querySelector(`.lab-item[data-ing-id="${id}"]`);
    if (cell) {
      cell.classList.remove('lab-refund-flash');
      void cell.offsetWidth;
      cell.classList.add('lab-refund-flash');
      setTimeout(() => cell && cell.classList.remove('lab-refund-flash'), 700);
    }
  }
  // Sad-trombone-ish sfx
  sfx.sweep(440, 180, 'sawtooth', 0.35, 0.18);
  // Brief red sparkles centred on the beaker
  if (beakerEl) {
    const r = beakerEl.getBoundingClientRect();
    sparkleBurst(r.left + r.width / 2, r.top + r.height / 2, 14, '#ff3a3a');
  }
  // Empty the beaker (refund) so the player can start a fresh combo
  beaker = [null, null, null];
  syncBeaker();
  // If codex is open, ping the existing creature cell
  if (_codexModal && _codexModal.classList.contains('is-open')) {
    // Re-open to get a fresh render with the ping highlight
    setTimeout(() => pingCodexCell(key), 50);
  }
}

function fuse() {
  const ids = beaker.map((b) => b.id).sort();
  const key = ids.join(',');
  // -- Unique recipe rule: same 3 ingredients = one-shot per profile --------
  if (discoveredCombos.has(key)) {
    handleAlreadyDiscovered(key);
    return;
  }
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
  // Mark this combo as discovered no matter what (procedural results may map
  // to a creature name that's already in the codex — but the combo itself is
  // novel and counts as a discovery).
  discoveredCombos.add(key);
  // Cloud-sync: if signed into a cloud profile, push this combo discovery up
  // (best-effort, queues if offline). Lazy import keeps the local-only path
  // free of Supabase code.
  try {
    const aid = localStorage.getItem('wg:profiles:active');
    if (aid && String(aid).startsWith('c_')) {
      import('../../src/shared/cloudSync.js').then((mod) => {
        try { mod.pushDiscovery('mutation-lab', key, isNew ? result : null); } catch {}
      }).catch(() => {});
    }
  } catch {}
  // ===== Per-tier completion check =====
  // After the new discovery is recorded, recount how many discoveries the
  // result's tier now has. If we just hit TIER_TARGETS for that tier AND we
  // haven't already unlocked it, fire the celebration + persist the unlock.
  if (isNew) {
    const tier = result.tier || (result.legendary ? 'LEGENDARY' : (result.cursed ? 'CURSED' : 'COMMON'));
    const target = TIER_TARGETS[tier];
    if (target && !tierUnlocks[tier]) {
      // Count this tier's discoveries (after just adding the new one).
      let n = 0;
      for (const d of Object.values(discoveries)) {
        const t = d.tier || (d.legendary ? 'LEGENDARY' : (d.cursed ? 'CURSED' : 'COMMON'));
        if (t === tier) n++;
      }
      if (n >= target) {
        tierUnlocks[tier] = true;
        saveTierUnlocks();
        // Delay the banner slightly so the fusion popup is visible first.
        setTimeout(() => showTierComplete(tier), 700);
      }
    }
  }
  showResult(result, isNew);
  // Round 2C: SHEET-ENTRY style "ENTRY UNLOCKED" banner for every new combo.
  // Fires on isNew (fresh species discovery), not on combo repeats — the
  // existing handleAlreadyDiscovered() path already returns before fuse runs.
  if (isNew) {
    const tier = result.tier || (result.legendary ? 'LEGENDARY' : (result.cursed ? 'CURSED' : 'COMMON'));
    showEntryBanner(result.name, tier);
    // Wave 1F: pin to back-wall pinboard + lab assistant reaction
    pinDiscovery(result);
    const reactKind = result.legendary ? 'legendary'
      : (tier === 'EPIC' ? 'epic' : (tier === 'RARE' ? 'rare' : (tier === 'CURSED' ? 'cursed' : 'common')));
    assistantReact(reactKind);
    // Wave 1F: score popup + milestones
    const earned = TIER_SCORE[tier] || 1;
    recomputeScore();
    const beakerR = document.querySelector('.lab-beaker')?.getBoundingClientRect();
    if (beakerR) popScore(beakerR.left + beakerR.width / 2, beakerR.top + 10, earned, ELEMENTS[tier]?.color);
    // Milestone accomplishments
    const total = Object.keys(discoveries).length;
    if (total === 10) showAccomplishment('★ 10 PUGS! ★', 'You\'re officially a breeder', '#5ef38c');
    if (total === 25) showAccomplishment('★ 25 PUGS! ★', 'Quarter of the codex done', '#4cc9f0');
    if (total === 50) showAccomplishment('★ 50 PUGS! ★', 'Almost there — keep fusing', '#b055ff');
    if (total === 60) showAccomplishment('★ CODEX COMPLETE! ★', 'You discovered every pug!', '#ffd23f');
    // Challenge evaluation runs after every new discovery
    evaluateChallenges();
    // Daily fusion completion?
    if (!dailyDoneToday()) {
      const dailyIds = dailyFusionIngredients().map((i) => i.id).sort().join(',');
      if (key === dailyIds) {
        markDailyDone();
        showAccomplishment('★ DAILY FUSION! ★', 'You guessed today\'s combo!', '#ffd23f');
        if (_dailyBtn) _dailyBtn.classList.remove('is-pending');
      }
    }
    // Costume + theme unlocks may have changed
    updateAssistantCostume();
  }
  // Big lightning flash on every fuse (+ extra flashes for legendaries)
  flashArc();
  if (result.legendary || result.tier === 'EPIC') {
    setTimeout(() => flashArc(), 90);
    setTimeout(() => flashArc(), 200);
  }
  beaker = [null, null, null];
  syncBeaker();
  save();
  renderCollection();
  renderIngredients(); // refresh combo-count badges
  applyIngredientFilter(); // re-apply filter after re-render
  applyAlmostHints();
  refreshShelfBg();
  updateHud();
  // Celebration FX
  const beakerEl = document.querySelector('.lab-beaker');
  const rect = beakerEl ? beakerEl.getBoundingClientRect() : null;
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  if (result.legendary) {
    // Round 2C: bigger celebration burst — denser sparkles + confetti chase
    sparkleBurst(cx, cy, 52, '#ffd23f');
    setTimeout(() => sparkleBurst(cx, cy, 36, '#ff8ac8'), 120);
    setTimeout(() => sparkleBurst(cx, cy, 36, '#4cc9f0'), 240);
    setTimeout(() => sparkleBurst(cx, cy, 24, '#fff0a0'), 360);
    try { confettiBurst(cx, cy, 20, ['#ffd23f', '#ff8e3c', '#ff3aa1', '#fff0a0']); } catch (e) { /* */ }
    shakeEl(beakerEl);
    shakeEl(document.querySelector('.lab-result'));
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
  // Cosmetic tier-aura: applied to every future fusion result whose tier the
  // player has previously fully unlocked. CSS adds a soft pulsing halo.
  const _tier = r.tier || (r.legendary ? 'LEGENDARY' : (r.cursed ? 'CURSED' : 'COMMON'));
  const _auraCls = tierUnlocks[_tier] ? ` has-tier-aura ${_tier}` : '';
  div.className = 'lab-result' + (r.legendary ? ' legendary' : (r.cursed ? ' cursed' : '')) + _auraCls;
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
  // "DISCOVERED" now means unique creatures in the codex; "COMBOS TRIED" is
  // the size of discoveredCombos (real progression metric out of 1140).
  const total = Object.keys(discoveries).length;
  const combos = discoveredCombos.size;
  const legCount = Object.values(discoveries).filter((d) => d.legendary).length;
  const dEl = document.getElementById('hud-discovered');
  // 60 is the curated target across all tiers (sum of TIER_TARGETS).
  if (dEl) dEl.textContent = `${total}/60`;
  const lEl = document.getElementById('hud-legendary');
  if (lEl) lEl.textContent = `${legCount}/${Object.keys(LEGENDARY).length}`;
  const eEl = document.getElementById('hud-exp');
  if (eEl) eEl.textContent = `${experiments} (${combos}/${TOTAL_COMBOS})`;
  // Wave 1F: SCORE row (added dynamically below if missing)
  const card = document.querySelector('#hud .hud-card');
  if (card) {
    let scoreRow = card.querySelector('.hud-row--score');
    if (!scoreRow) {
      scoreRow = document.createElement('div');
      scoreRow.className = 'hud-row hud-row--small hud-row--score';
      scoreRow.innerHTML = `<b>SCORE</b> <span id="hud-score" class="lab-score-line">0</span>`;
      card.appendChild(scoreRow);
    }
    const sEl = document.getElementById('hud-score');
    if (sEl) sEl.textContent = String(labScore || recomputeScore());
  }
}

// localStorage keys are profile-scoped via profileKey() — so two players on
// the same browser don't share combos.
const COMBOS_KEY = () => profileKey('mutation-lab:discoveredCombos');
const STATE_KEY  = () => profileKey('mutation-lab:state');
// Per-tier completion unlocks — once a tier hits its TIER_TARGETS count, the
// player permanently unlocks a tier-coloured "aura" effect that appears on
// future fusion results of that tier. Stored as { COMMON: true, RARE: true }.
const TIER_UNLOCK_KEY = () => profileKey('mutation-lab:tierUnlocks');
let tierUnlocks = {};
function loadTierUnlocks() {
  try {
    const raw = localStorage.getItem(TIER_UNLOCK_KEY());
    tierUnlocks = raw ? (JSON.parse(raw) || {}) : {};
  } catch { tierUnlocks = {}; }
}
function saveTierUnlocks() {
  try { localStorage.setItem(TIER_UNLOCK_KEY(), JSON.stringify(tierUnlocks)); } catch {}
}

// Confetti burst — N pieces flying outward from a screen point. Uses the
// CSS `lab-confetti-fall` animation (declared above) for the actual motion.
function confettiBurst(x, y, count, palette) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'lab-confetti';
    el.style.left = (x - 4) + 'px';
    el.style.top  = (y - 6) + 'px';
    el.style.background = palette[i % palette.length];
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4; // mostly upward
    const r = 220 + Math.random() * 220;
    el.style.setProperty('--tx',  `${Math.cos(a) * r}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 1080}deg`);
    el.style.animationDuration = (1.4 + Math.random() * 0.6) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }
}

// Tier-complete celebration: big drop-in banner + confetti burst across the
// screen + arpeggio. Only ever fires once per profile per tier (we re-check
// `tierUnlocks` before triggering in fuse()).
function showTierComplete(tier) {
  const banner = document.createElement('div');
  banner.className = `lab-tier-banner ${tier}`;
  banner.innerHTML = `
    ★ TIER COMPLETE: ${tier} ★
    <div class="lab-tier-banner__sub">Cosmetic aura unlocked for future ${tier.toLowerCase()} fusions!</div>
  `;
  document.body.appendChild(banner);
  // Drop in
  requestAnimationFrame(() => banner.classList.add('is-show'));
  // Three confetti bursts staggered
  const tierPalettes = {
    COMMON:    ['#c8c8d8', '#fafaff', '#888898', '#5ef38c'],
    RARE:      ['#4cc9f0', '#b0e8ff', '#ffd23f'],
    EPIC:      ['#b055ff', '#d090ff', '#ff3aa1', '#ffd23f'],
    LEGENDARY: ['#ffd23f', '#fff0a0', '#ff8e3c', '#ff3aa1'],
    CURSED:    ['#ff3a3a', '#8a0808', '#ffd23f'],
  };
  const palette = tierPalettes[tier] || tierPalettes.COMMON;
  confettiBurst(window.innerWidth * 0.5, window.innerHeight * 0.35, 36, palette);
  setTimeout(() => confettiBurst(window.innerWidth * 0.3, window.innerHeight * 0.4, 24, palette), 200);
  setTimeout(() => confettiBurst(window.innerWidth * 0.7, window.innerHeight * 0.4, 24, palette), 350);
  // Big celebratory arp
  sfx.arp([523, 659, 784, 1047, 1319, 1568], 'triangle', 0.09, 0.28, 0.32);
  // Banner auto-dismiss
  setTimeout(() => {
    banner.classList.remove('is-show');
    setTimeout(() => banner.remove(), 600);
  }, 3800);
}

const TIER_SCORE = { COMMON: 1, RARE: 3, EPIC: 5, LEGENDARY: 10, CURSED: 4 };
let labScore = 0;
function recomputeScore() {
  let s = 0;
  for (const d of Object.values(discoveries)) {
    const t = d.tier || (d.legendary ? 'LEGENDARY' : (d.cursed ? 'CURSED' : 'COMMON'));
    s += (TIER_SCORE[t] || 1);
  }
  labScore = s;
  return s;
}
function popScore(x, y, n, color) {
  const el = document.createElement('div');
  el.className = 'lab-score-popup';
  el.textContent = `+${n} PTS`;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  if (color) el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function showAccomplishment(title, sub, color) {
  const el = document.createElement('div');
  el.className = 'lab-accomplish';
  el.style.color = color || '#ffd23f';
  el.innerHTML = `${title}<div class="lab-accomplish__sub">${sub || ''}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-show'));
  setTimeout(() => { el.classList.remove('is-show'); setTimeout(() => el.remove(), 400); }, 2400);
}

function todayUtcKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}
function _seededInt(seed, max) {
  // Tiny LCG — deterministic for a given seed string
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h % max;
}
function dailyFusionIngredients() {
  const day = todayUtcKey();
  // 3 distinct indices into INGREDIENTS
  const a = _seededInt(day + '-a', INGREDIENTS.length);
  let b = _seededInt(day + '-b', INGREDIENTS.length);
  if (b === a) b = (b + 1) % INGREDIENTS.length;
  let c = _seededInt(day + '-c', INGREDIENTS.length);
  while (c === a || c === b) c = (c + 1) % INGREDIENTS.length;
  return [INGREDIENTS[a], INGREDIENTS[b], INGREDIENTS[c]];
}
// localStorage of done-today flag (so the daily button can pulse pre-attempt).
const DAILY_KEY = () => profileKey('mutation-lab:dailyDone');
function dailyDoneToday() {
  try {
    const raw = localStorage.getItem(DAILY_KEY());
    if (!raw) return false;
    const obj = JSON.parse(raw);
    return obj && obj.day === todayUtcKey();
  } catch { return false; }
}
function markDailyDone() {
  try { localStorage.setItem(DAILY_KEY(), JSON.stringify({ day: todayUtcKey() })); } catch {}
}

const CHALLENGES = [
  { id: 'first_legendary', title: 'FIRST LEGENDARY', icon: '★', desc: 'Discover any LEGENDARY pug',
    check: () => Object.values(discoveries).some((d) => d.legendary) },
  { id: 'fire_water', title: 'ELEMENTAL CLASH', icon: '🔥', desc: 'Make a recipe with FIRE + WATER',
    check: () => Object.keys(discoveries).some((k) => _comboHasElements(k, ['FIRE', 'WATER'])) },
  { id: 'all_dark', title: 'DARK ARTS', icon: '🦇', desc: 'Make a recipe with 2+ DARK ingredients',
    check: () => Object.keys(discoveries).some((k) => _countCommonElement(k, 'DARK') >= 2) },
  { id: 'tier_common', title: 'CASUAL BREEDER', icon: '🐶', desc: 'Discover 10 COMMON pugs',
    check: () => Object.values(discoveries).filter((d) => (d.tier || 'COMMON') === 'COMMON').length >= 10 },
  { id: 'tier_rare', title: 'RARE COLLECTOR', icon: '💎', desc: 'Discover 5 RARE pugs',
    check: () => Object.values(discoveries).filter((d) => (d.tier) === 'RARE').length >= 5 },
  { id: 'tier_epic', title: 'EPIC HOARDER', icon: '🌟', desc: 'Discover 3 EPIC pugs',
    check: () => Object.values(discoveries).filter((d) => (d.tier) === 'EPIC').length >= 3 },
  { id: 'cursed_5', title: 'CURSE COLLECTOR', icon: '💀', desc: 'Discover 3 CURSED pugs',
    check: () => Object.values(discoveries).filter((d) => (d.tier) === 'CURSED' || d.cursed).length >= 3 },
  { id: 'cosmic_rec', title: 'COSMIC HORROR', icon: '👁', desc: 'Make a recipe with COSMIC + FLESH',
    check: () => Object.keys(discoveries).some((k) => _comboHasElements(k, ['COSMIC', 'FLESH'])) },
  { id: 'foody', title: 'FOODIE EXPERIMENTS', icon: '🍩', desc: 'Make 5 recipes using FOOD ingredients',
    check: () => Object.keys(discoveries).filter((k) => _countCommonElement(k, 'FOOD') >= 1).length >= 5 },
  { id: 'legend_5', title: 'LEGEND HUNTER', icon: '👑', desc: 'Discover 5 LEGENDARY pugs',
    check: () => Object.values(discoveries).filter((d) => d.legendary).length >= 5 },
];
function _comboHasElements(comboKey, els) {
  // comboKey = "id1,id2,id3"; els = array of ELEMENT names ALL of which must appear in the combo
  const have = new Set();
  for (const id of comboKey.split(',')) {
    const ing = INGREDIENTS.find((i) => i.id === id);
    if (ing && ing.element) have.add(ing.element);
  }
  return els.every((e) => have.has(e));
}
function _countCommonElement(comboKey, el) {
  let c = 0;
  for (const id of comboKey.split(',')) {
    const ing = INGREDIENTS.find((i) => i.id === id);
    if (ing && ing.element === el) c++;
  }
  return c;
}
const CHALLENGE_KEY = () => profileKey('mutation-lab:challenges');
let challengeProgress = {};
function loadChallenges() {
  try {
    const raw = localStorage.getItem(CHALLENGE_KEY());
    challengeProgress = raw ? (JSON.parse(raw) || {}) : {};
  } catch { challengeProgress = {}; }
}
function saveChallenges() {
  try { localStorage.setItem(CHALLENGE_KEY(), JSON.stringify(challengeProgress)); } catch {}
}
// Evaluate; any new completion fires popup + accomplishment banner.
function evaluateChallenges() {
  for (const c of CHALLENGES) {
    if (challengeProgress[c.id]) continue;
    try {
      if (c.check()) {
        challengeProgress[c.id] = true;
        saveChallenges();
        showAccomplishment(`★ ${c.title} ★`, c.desc, '#4cc9f0');
        sfx.arp([523, 659, 880, 1047], 'triangle', 0.07, 0.18, 0.22);
      }
    } catch { /* */ }
  }
}

function applyAlmostHints() {
  if (!ingEl) return;
  // Clear all
  ingEl.querySelectorAll('.lab-item.is-hint-1-swap').forEach((c) => c.classList.remove('is-hint-1-swap'));
  // Need at least 2 ingredients loaded to be "1 swap away"
  const loadedIds = beaker.filter((b) => b != null).map((b) => b.id);
  if (loadedIds.length < 2) return;
  // For each pair of loaded ingredients, scan discovered combos that include
  // both — the missing slot is the hint.
  const hintIds = new Set();
  for (let i = 0; i < loadedIds.length; i++) {
    for (let j = i + 1; j < loadedIds.length; j++) {
      const pair = [loadedIds[i], loadedIds[j]];
      for (const k of discoveredCombos) {
        const ids = k.split(',');
        if (pair.every((p) => ids.includes(p))) {
          // The third id is the hint
          const third = ids.find((id) => !pair.includes(id));
          if (third) hintIds.add(third);
        }
      }
    }
  }
  for (const id of hintIds) {
    const cell = ingEl.querySelector(`.lab-item[data-ing-id="${id}"]`);
    if (cell) cell.classList.add('is-hint-1-swap');
  }
}

// ===== WAVE 1F: LAB THEMES =====
const THEME_DEFS = ['basic', 'dark', 'cosmic'];
let labTheme = 'basic';
const THEME_KEY = () => profileKey('mutation-lab:theme');
function applyTheme(t) {
  labTheme = t;
  for (const def of THEME_DEFS) document.body.classList.toggle(`lab-theme-${def}`, def === t);
  try { localStorage.setItem(THEME_KEY(), t); } catch {}
}
function loadTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY());
    if (THEME_DEFS.includes(t)) applyTheme(t);
  } catch {}
}
function cycleTheme() {
  // Themes unlock by discovery count: dark @20, cosmic @45
  const total = Object.keys(discoveries).length;
  const idx = THEME_DEFS.indexOf(labTheme);
  let next = THEME_DEFS[(idx + 1) % THEME_DEFS.length];
  if (next === 'dark' && total < 20) {
    showTip('★ DARK theme unlocks at 20 discoveries', 2500);
    next = THEME_DEFS[(THEME_DEFS.indexOf(next) + 1) % THEME_DEFS.length];
  }
  if (next === 'cosmic' && total < 45) {
    showTip('★ COSMIC theme unlocks at 45 discoveries', 2500);
    next = 'basic';
  }
  applyTheme(next);
  showTip(`Theme: ${next.toUpperCase()}`, 1500);
}

const COSTUMES = [
  { id: 'none',   icon: '',   need: 0 },
  { id: 'wizard', icon: '🧙', need: 8 },
  { id: 'chef',   icon: '👨‍🍳', need: 18 },
  { id: 'crown',  icon: '👑', need: 32 },
  { id: 'devil',  icon: '😈', need: 50 },
];
function updateAssistantCostume() {
  const total = Object.keys(discoveries).length;
  // Find the highest-tier unlocked costume
  let chosen = COSTUMES[0];
  for (const c of COSTUMES) if (total >= c.need) chosen = c;
  if (chosen.icon) {
    _assistHat.textContent = chosen.icon;
    _assistHat.classList.add('is-show');
  } else {
    _assistHat.classList.remove('is-show');
  }
}

function save() {
  try {
    // Per-profile combo + state
    localStorage.setItem(STATE_KEY(), JSON.stringify({ discoveries, experiments }));
    localStorage.setItem(COMBOS_KEY(), JSON.stringify([...discoveredCombos]));
    // Legacy unscoped keys for backward compatibility (and the namespaced ones
    // used by the hub's highscore/codex readers).
    localStorage.setItem('mutlab:state', JSON.stringify({ discoveries, experiments }));
    localStorage.setItem(profileKey('hs:mutation-lab'), JSON.stringify({
      score: labScore || recomputeScore(),
      discovered: Object.keys(discoveries).length,
      combos: discoveredCombos.size,
      experiments, ts: Date.now(),
    }));
    localStorage.setItem(profileKey('codex:mutation-lab'), JSON.stringify(discoveries));
  } catch {}
}
function load() {
  try {
    // Prefer per-profile keys; fall back to legacy unscoped storage.
    const codexRaw = localStorage.getItem(profileKey('codex:mutation-lab'))
                  || localStorage.getItem('wg:codex:mutation-lab');
    if (codexRaw) {
      discoveries = JSON.parse(codexRaw) || {};
    }
    const stateRaw = localStorage.getItem(STATE_KEY()) || localStorage.getItem('mutlab:state');
    const s = JSON.parse(stateRaw || '{}');
    if (s.discoveries && Object.keys(discoveries).length === 0) discoveries = s.discoveries;
    if (s.experiments) experiments = s.experiments;
    // Combos: prefer the dedicated key; otherwise seed from existing
    // discoveries so a returning player doesn't lose their progress.
    const combosRaw = localStorage.getItem(COMBOS_KEY());
    if (combosRaw) {
      const arr = JSON.parse(combosRaw);
      discoveredCombos = new Set(Array.isArray(arr) ? arr : []);
    } else {
      discoveredCombos = new Set(Object.keys(discoveries));
    }
  } catch {
    discoveredCombos = new Set();
  }
}

// ===== FILTER (Little Alchemy "show me what I haven't tried" toggle) =====
// When ON, ingredients that have been used in 8+ discovered combos are dimmed
// so the player sees at-a-glance which ones are under-explored. Pure UX win;
// no balance change. The state lives in JS (not persisted) — toggling resets
// per session, which is fine for a quick exploration aid.
let _filterMode = false;
const _filterBtn = document.createElement('button');
_filterBtn.className = 'lab-codex-btn lab-filter-btn';
// Position adjustment so it sits to the LEFT of the CODEX button. CSS below
// adds the offset; codex button already lives at right:60px.
_filterBtn.textContent = '🔍 FILTER';
_filterBtn.style.right = 'calc(60px + 130px)'; // CODEX btn ~120px wide + small gap
_filterBtn.style.background = 'linear-gradient(180deg, #4cc9f0, #1a6080)';
_filterBtn.style.borderColor = '#a0e0ff';
_filterBtn.style.boxShadow = '0 4px 0 #0a3050';
_filterBtn.title = 'Dim ingredients used in 8+ discovered combos so you can find under-explored ones';
document.body.appendChild(_filterBtn);
_filterBtn.addEventListener('click', () => {
  _filterMode = !_filterMode;
  _filterBtn.textContent = _filterMode ? '✓ FILTER ON' : '🔍 FILTER';
  _filterBtn.style.background = _filterMode
    ? 'linear-gradient(180deg, #5ef38c, #1a6030)'
    : 'linear-gradient(180deg, #4cc9f0, #1a6080)';
  applyIngredientFilter();
});

// Apply / remove the dimmed look on ingredient cells based on combo count.
function applyIngredientFilter() {
  if (!ingEl) return;
  const FILTER_THRESHOLD = 8;
  ingEl.querySelectorAll('.lab-item').forEach((cell) => {
    const id = cell.dataset.ingId;
    if (!id) return;
    const n = combosForIngredient(id);
    if (_filterMode && n >= FILTER_THRESHOLD) {
      cell.classList.add('lab-item--filtered');
    } else {
      cell.classList.remove('lab-item--filtered');
    }
  });
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

// Codex search filter (wave 1F) — filter discovered creature names case-insensitive
let _codexSearch = '';
function openCodex() {
  const sub = document.getElementById('codex-sub');
  const total = Object.keys(discoveries).length;
  if (sub) sub.textContent = `DISCOVERED ${total}/60 · COMBOS ${discoveredCombos.size}/${TOTAL_COMBOS} · SCORE ${labScore || recomputeScore()}`;
  const body = document.getElementById('codex-body');
  body.innerHTML = '';
  // Wave 1F: search box
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'lab-codex-search';
  search.placeholder = 'Search discovered pugs…';
  search.value = _codexSearch;
  search.addEventListener('input', (e) => {
    _codexSearch = e.target.value || '';
    openCodex();
  });
  body.appendChild(search);
  const q = _codexSearch.trim().toLowerCase();
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
    // Apply search filter to discovered list
    const matched = q ? have.filter((d) => (d.name || '').toLowerCase().includes(q)) : have;
    // Skip tier section entirely when searching with no matches
    if (q && matched.length === 0) continue;
    const heading = document.createElement('div');
    heading.className = 'lab-codex-tier-title ' + tier;
    heading.textContent = `${tier} — ${have.length}/${target}${q ? ` (${matched.length} match)` : ''}`;
    body.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'lab-codex-grid';
    // Discovered cells first
    for (const d of matched) {
      const cell = document.createElement('div');
      cell.className = `lab-codex-cell ${tier} discovered`;
      cell.title = d.desc || d.name;
      if (d.key) cell.dataset.comboKey = d.key;
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
    // Undiscovered placeholders (suppress when searching)
    if (!q) {
      for (let i = have.length; i < target; i++) {
        const cell = document.createElement('div');
        cell.className = `lab-codex-cell ${tier}`;
        cell.innerHTML = `<div class="lab-codex-cell__unk">?</div><div class="lab-codex-cell__name">???</div>`;
        grid.appendChild(cell);
      }
    }
    body.appendChild(grid);
  }
  _codexModal.classList.add('is-open');
}

// ===== WAVE 1F: RECIPE BOOK (locked named legendaries with progressive hints) =====
const _bookBtn = document.createElement('button');
_bookBtn.className = 'lab-book-btn';
_bookBtn.textContent = '📜 RECIPES';
document.body.appendChild(_bookBtn);
const _bookModal = document.createElement('div');
_bookModal.className = 'lab-book-modal';
_bookModal.innerHTML = `
  <div class="lab-book-modal__panel">
    <h2 class="lab-book-title">★ LEGENDARY RECIPE BOOK ★</h2>
    <div class="lab-book-sub" id="book-sub">All 13 named LEGENDARIES (hints unlock as you discover more)</div>
    <div id="book-body"></div>
    <button class="lab-codex-close" id="book-close">CLOSE</button>
  </div>
`;
document.body.appendChild(_bookModal);
_bookBtn.addEventListener('click', openRecipeBook);
document.getElementById('book-close').addEventListener('click', () => _bookModal.classList.remove('is-open'));
_bookModal.addEventListener('click', (e) => { if (e.target === _bookModal) _bookModal.classList.remove('is-open'); });

function openRecipeBook() {
  const sub = document.getElementById('book-sub');
  const total = Object.keys(discoveries).length;
  const foundLeg = Object.values(discoveries).filter((d) => d.legendary).length;
  if (sub) sub.textContent = `LEGENDARIES: ${foundLeg}/13 · TOTAL: ${total}`;
  const body = document.getElementById('book-body');
  body.innerHTML = '';
  // Progressive hints by total: <10=1 id, 10-29=2 ids, >=30=all + desc, found=full
  const HINT = total >= 30 ? 3 : (total >= 10 ? 2 : 1);
  let idx = 0;
  for (const key of Object.keys(LEGENDARY)) {
    const recipe = LEGENDARY[key];
    const found = !!discoveries[key];
    const ids = key.split(',');
    const shownIds = found ? ids : (HINT === 1 ? [ids[idx % ids.length]] : ids.slice(0, HINT));
    const nameLabel = found ? recipe.name : '???';
    const descShown = (found || total >= 30) ? recipe.desc : '';
    const entry = document.createElement('div');
    entry.className = 'lab-recipe-entry' + (found ? ' discovered' : '');
    let html = `<div class="lab-recipe-entry__name${found ? '' : ' locked'}">${nameLabel}</div><div class="lab-recipe-entry__items">`;
    for (let i = 0; i < 3; i++) {
      const id = shownIds[i];
      html += `<span class="lab-ri-slot">${id ? '' : '?'}</span>`;
    }
    html += `</div>`;
    if (descShown) html += `<div class="lab-recipe-entry__desc">"${descShown}"</div>`;
    if (!found) html += `<div class="lab-recipe-entry__hint">${HINT === 3 ? 'All revealed — FUSE!' : (HINT === 2 ? '+1 ingredient to find' : '1 of 3 shown')}</div>`;
    entry.innerHTML = html;
    const slots = entry.querySelectorAll('.lab-ri-slot');
    shownIds.forEach((id, i) => {
      const ing = INGREDIENTS.find((x) => x.id === id);
      if (ing && slots[i]) slots[i].appendChild(_ingredientEl(ing, 24));
    });
    body.appendChild(entry);
    idx++;
  }
  _bookModal.classList.add('is-open');
}

// ===== WAVE 1F: DAILY FUSION + CHALLENGES MODAL =====
const _dailyBtn = document.createElement('button');
_dailyBtn.className = 'lab-daily-btn';
_dailyBtn.textContent = '⚡ DAILY';
document.body.appendChild(_dailyBtn);
const _challModal = document.createElement('div');
_challModal.className = 'lab-challenge-modal';
_challModal.innerHTML = `
  <div class="lab-challenge-modal__panel">
    <h2 class="lab-challenge-title">★ CHALLENGES + DAILY ★</h2>
    <div class="lab-challenge-sub" id="chall-sub">Complete challenges for bonus reactions</div>
    <div id="chall-body"></div>
    <button class="lab-codex-close" id="chall-close">CLOSE</button>
  </div>
`;
document.body.appendChild(_challModal);
_dailyBtn.addEventListener('click', openChallengeModal);
document.getElementById('chall-close').addEventListener('click', () => _challModal.classList.remove('is-open'));
_challModal.addEventListener('click', (e) => { if (e.target === _challModal) _challModal.classList.remove('is-open'); });

function openChallengeModal() {
  const sub = document.getElementById('chall-sub');
  const done = CHALLENGES.filter((c) => challengeProgress[c.id]).length;
  if (sub) sub.textContent = `Challenges complete: ${done}/${CHALLENGES.length}`;
  const body = document.getElementById('chall-body');
  body.innerHTML = '';
  // === DAILY SECTION ===
  const daily = document.createElement('div');
  daily.className = 'lab-daily-section';
  daily.innerHTML = `<div class="lab-daily-section__title">⚡ DAILY FUSION · ${todayUtcKey()}</div>`;
  const dings = dailyFusionIngredients();
  const dDone = dailyDoneToday();
  daily.innerHTML += `<div style="font-size:0.4rem;color:var(--text-soft);text-align:center;margin-bottom:4px;">Today's 3 ingredients are pre-set. ${dDone ? 'You already discovered today\'s combo! ★' : 'Can you guess what they make?'}</div>`;
  const ingsRow = document.createElement('div');
  ingsRow.className = 'lab-daily-section__ings';
  for (const ing of dings) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
    wrap.appendChild(_ingredientEl(ing, 40));
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-family:var(--font-display);font-size:0.34rem;color:var(--text-soft);letter-spacing:0.03em;';
    lbl.textContent = ing.name;
    wrap.appendChild(lbl);
    ingsRow.appendChild(wrap);
  }
  daily.appendChild(ingsRow);
  const loadBtn = document.createElement('button');
  loadBtn.className = 'lab-daily-section__btn';
  loadBtn.textContent = dDone ? '✓ DAILY DONE — load anyway' : 'LOAD INTO BEAKER';
  loadBtn.addEventListener('click', () => {
    beaker = [dings[0], dings[1], dings[2]];
    syncBeaker();
    applyAlmostHints();
    _challModal.classList.remove('is-open');
    showTip('Daily ingredients loaded! Tap ⚗ FUSE to try.', 3200);
  });
  daily.appendChild(loadBtn);
  body.appendChild(daily);

  // === CHALLENGE LIST ===
  for (const c of CHALLENGES) {
    const item = document.createElement('div');
    const isComplete = !!challengeProgress[c.id];
    item.className = 'lab-challenge-item' + (isComplete ? ' complete' : '');
    item.innerHTML = `
      <div class="lab-challenge-item__icon">${c.icon}</div>
      <div class="lab-challenge-item__body">
        <div class="lab-challenge-item__title">${c.title}</div>
        <div class="lab-challenge-item__desc">${c.desc}</div>
      </div>
      <div class="lab-challenge-item__check">${isComplete ? '✓' : '○'}</div>
    `;
    body.appendChild(item);
  }
  _challModal.classList.add('is-open');
}

// ===== WAVE 1F: THEME SWITCHER BUTTON =====
const _themeBtn = document.createElement('button');
_themeBtn.className = 'lab-codex-btn lab-theme-btn';
_themeBtn.textContent = '🎨 THEME';
_themeBtn.style.right = 'calc(60px + 250px)';
_themeBtn.style.background = 'linear-gradient(180deg, #b055ff, #4a2070)';
_themeBtn.style.borderColor = '#d090ff';
_themeBtn.style.boxShadow = '0 4px 0 #2a1040';
_themeBtn.title = 'Cycle lab themes (basic / dark / cosmic — unlock by discoveries)';
document.body.appendChild(_themeBtn);
_themeBtn.addEventListener('click', cycleTheme);

// Briefly highlight a discovered creature cell in the codex (used when the
// player tries to re-fuse a combo they've already done).
function pingCodexCell(key) {
  if (!_codexModal || !_codexModal.classList.contains('is-open')) return;
  // CSS.escape is not present in some older WebViews — fall back to a manual
  // attribute-selector friendly escape so the codex ping never throws.
  const esc = (typeof CSS !== 'undefined' && CSS.escape)
    ? CSS.escape(key)
    : String(key).replace(/[^a-zA-Z0-9_\-]/g, (c) => '\\' + c);
  const cell = _codexModal.querySelector(`.lab-codex-cell[data-combo-key="${esc}"]`);
  if (!cell) return;
  cell.classList.remove('is-ping');
  void cell.offsetWidth;
  cell.classList.add('is-ping');
  // Scroll into view so the player can actually see it
  cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => cell && cell.classList.remove('is-ping'), 1000);
}

let _labStarted = false;
document.getElementById('start-btn').addEventListener('click', () => {
  // Guard against double-clicks that would re-load+re-render and could
  // momentarily glitch the codex/badges.
  if (_labStarted) return;
  _labStarted = true;
  document.getElementById('overlay').hidden = true;
  document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('lab').hidden = false;
  load();
  loadTierUnlocks();
  loadChallenges();
  loadTheme();
  recomputeScore();
  renderIngredients();
  applyIngredientFilter(); // honour current filter state on re-render
  renderCollection();
  refreshShelfBg();
  updateHud();
  syncBeaker(); // ensures bubble + glow state reflects empty beaker
  updateAssistantCostume();
  // Pulse the daily-challenge button if today's daily hasn't been done yet
  if (_dailyBtn) {
    if (!dailyDoneToday()) _dailyBtn.classList.add('is-pending');
    else _dailyBtn.classList.remove('is-pending');
  }
  sfx.resume();
  try { music.setIntensity(0.3); music.play(); } catch {}
});

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip(`Tap 3 ingredients → ⚗ FUSE. Each unique combo only works ONCE — get creative! ${TOTAL_COMBOS} combos exist. 📖 CODEX tracks all species.`, 7500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}

// === Round 3B: start-screen polish (no end screen — this is open-ended discovery) ===
(function _r3bPolish(){
  const FACTS = [
    'TIP: Combine 3 LEGENDARY-tier ingredients for jackpots.',
    'TIP: Each combo only works ONCE — 1140 combos exist.',
    'TIP: 13 named LEGENDARIES are hidden — find them all.',
    'LORE: The Lab was abandoned after the Great Crossbreeding.',
    'TIP: Some pugs are CURSED — those count too.',
    'JOKE: A pug fused with a cat once. We do not speak of it.',
  ];
  const GAME_ID = 'mutation-lab';
  const startOv = document.getElementById('overlay');
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
        if (best && (best.discovered || best.score)) {
          el.hidden = false;
          el.textContent = `★ LAST BEST: ${best.discovered || best.score} discovered`;
        } else { el.hidden = true; }
      } catch {}
    }).catch(() => {});
  }
  if (startOv) {
    const startUpdate = () => {
      const visible = !startOv.hidden && !startOv.classList.contains('is-hidden');
      if (visible) { refreshStartBest(); startFactLoop(); } else { stopFactLoop(); }
    };
    new MutationObserver(startUpdate).observe(startOv, { attributes: true, attributeFilter: ['hidden','class'] });
    startUpdate();
  }
})();
