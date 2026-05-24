// Reusable game-start tutorial tip. Call showTip(text) when a game begins —
// displays a brief instruction overlay that auto-fades after ~4 seconds.
//
// === UNIFIED VISUAL CONTRACT (Polish Round 2A) ===
// Tutorial tips across all 13 games use:
//   - neon-cyan border (#4cc9f0) + matching glow
//   - 'Press Start 2P' font, ~0.6rem
//   - 4s default duration (overridable via 2nd arg)
//   - slide-down + scale-up entry, fade-out exit
// One <style> tag is injected idempotently (class-based) so the tip can be
// targeted via DevTools and overridden if a game has special needs.

let _stylesInjected = false;
function ensureTipStyles() {
  if (_stylesInjected) return;
  if (document.getElementById('wg-tip-styles')) { _stylesInjected = true; return; }
  const s = document.createElement('style');
  s.id = 'wg-tip-styles';
  s.textContent = `
    #tutorial-tip {
      position: fixed;
      top: calc(60px + env(safe-area-inset-top, 0));
      left: 50%;
      transform: translateX(-50%) translateY(-8px) scale(0.95);
      z-index: 160;
      pointer-events: none;
      font-family: 'Press Start 2P', 'Courier New', monospace;
      /* clamp() so the tip stays readable on phones (min .55rem) without
         exploding on tablets (max .75rem). Plays well with large-text mode. */
      font-size: clamp(0.55rem, 1.6vw, 0.75rem);
      color: #fff;
      background: rgba(10, 7, 22, 0.92);
      border: 2px solid #4cc9f0;
      border-radius: 6px;
      padding: 12px 18px;
      box-shadow: 0 0 24px rgba(76, 201, 240, 0.45);
      max-width: 92vw;
      text-align: center;
      line-height: 1.6;
      letter-spacing: 0.06em;
      opacity: 0;
      transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: none;
    }
    #tutorial-tip.is-shown {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
    body.reduced-motion #tutorial-tip { transition: opacity 0.12s linear; }
    @media (max-width:380px){
      #tutorial-tip{padding:10px 12px;line-height:1.5;letter-spacing:.04em;}
    }
  `;
  document.head.appendChild(s);
  _stylesInjected = true;
}

let _tipEl = null;
function ensureTip() {
  if (_tipEl) return _tipEl;
  ensureTipStyles();
  _tipEl = document.createElement('div');
  _tipEl.id = 'tutorial-tip';
  // a11y: announced politely by screen readers when shown / updated.
  _tipEl.setAttribute('role', 'status');
  _tipEl.setAttribute('aria-live', 'polite');
  _tipEl.setAttribute('aria-atomic', 'true');
  document.body.appendChild(_tipEl);
  return _tipEl;
}
let _hideTimer = null;
let _fadeTimer = null;
export function showTip(text, durationMs = 4000) {
  const el = ensureTip();
  el.innerHTML = text;
  el.style.display = 'block';
  clearTimeout(_hideTimer); clearTimeout(_fadeTimer);
  // Trigger the slide/scale entry on next frame
  requestAnimationFrame(() => {
    el.classList.add('is-shown');
  });
  _fadeTimer = setTimeout(() => { el.classList.remove('is-shown'); }, Math.max(400, durationMs - 400));
  _hideTimer = setTimeout(() => { el.style.display = 'none'; }, durationMs);
}
export function hideTip() {
  const el = ensureTip();
  el.classList.remove('is-shown');
  clearTimeout(_hideTimer); clearTimeout(_fadeTimer);
  _hideTimer = setTimeout(() => { el.style.display = 'none'; }, 400);
}
