// Reusable game-start tutorial tip. Call showTip(text) when a game begins —
// displays a brief instruction overlay that auto-fades after ~5 seconds.
let _tipEl = null;
function ensureTip() {
  if (_tipEl) return _tipEl;
  _tipEl = document.createElement('div');
  _tipEl.id = 'tutorial-tip';
  _tipEl.style.cssText = [
    'position:fixed',
    'top:calc(60px + env(safe-area-inset-top, 0))',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:160',
    'pointer-events:none',
    "font-family:'Press Start 2P', monospace",
    'font-size:0.6rem',
    'color:#fff',
    'background:rgba(10,7,22,0.92)',
    'border:2px solid #ffd23f',
    'border-radius:6px',
    'padding:10px 16px',
    'box-shadow:0 0 24px rgba(255,210,63,0.45)',
    'max-width:90vw',
    'text-align:center',
    'line-height:1.6',
    'letter-spacing:0.06em',
    'opacity:0',
    'transition:opacity 0.4s ease',
    'display:none',
  ].join(';');
  document.body.appendChild(_tipEl);
  return _tipEl;
}
let _hideTimer = null;
let _fadeTimer = null;
export function showTip(text, durationMs = 5000) {
  const el = ensureTip();
  el.innerHTML = text;
  el.style.display = 'block';
  clearTimeout(_hideTimer); clearTimeout(_fadeTimer);
  // Fade in next frame
  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });
  _fadeTimer = setTimeout(() => { el.style.opacity = '0'; }, durationMs - 400);
  _hideTimer = setTimeout(() => { el.style.display = 'none'; }, durationMs);
}
export function hideTip() {
  const el = ensureTip();
  el.style.opacity = '0';
  clearTimeout(_hideTimer); clearTimeout(_fadeTimer);
  _hideTimer = setTimeout(() => { el.style.display = 'none'; }, 400);
}
