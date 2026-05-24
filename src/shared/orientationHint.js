// =============================================================================
// ORIENTATION HINT — one-time "rotate your device" toast for landscape-better
// games. Renders on touch devices in portrait, dismisses on rotate OR after
// 6s OR on tap. Persists dismissal per-game in localStorage so it never nags.
//
//   import { showOrientationHint } from '../../src/shared/orientationHint.js';
//   showOrientationHint({ gameId: 'bork-battle', prefer: 'landscape' });
//
// The hint is a small bottom-centre pill — it does NOT block input. Players
// in portrait can keep playing; we just remind them once that landscape is
// the intended view.
// =============================================================================

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  if (document.getElementById('wg-orient-styles')) return;
  const s = document.createElement('style');
  s.id = 'wg-orient-styles';
  s.textContent = `
    .wg-orient-hint{position:fixed;left:50%;top:max(80px,env(safe-area-inset-top,12px));transform:translateX(-50%) translateY(-12px);z-index:9100;
      background:linear-gradient(135deg,#1a0f2e,#2a1255);border:2px solid #ffd23f;border-radius:10px;padding:10px 14px;
      color:#fff;font-family:'Press Start 2P',monospace;font-size:.5rem;letter-spacing:.06em;text-align:center;
      box-shadow:0 0 0 2px #050310,0 0 24px rgba(255,210,63,.5);opacity:0;pointer-events:auto;cursor:pointer;
      transition:opacity .3s ease,transform .3s ease;display:flex;align-items:center;gap:10px;max-width:90vw}
    .wg-orient-hint.is-shown{opacity:1;transform:translateX(-50%) translateY(0)}
    .wg-orient-hint.is-leaving{opacity:0;transform:translateX(-50%) translateY(-12px)}
    .wg-orient-hint__icon{width:24px;height:24px;flex-shrink:0;animation:wgOrientSpin 1.6s ease-in-out infinite}
    .wg-orient-hint__text{white-space:nowrap}
    .wg-orient-hint__close{margin-left:6px;color:#8a90b1;font-size:.6rem}
    @keyframes wgOrientSpin{0%,100%{transform:rotate(0)}50%{transform:rotate(90deg)}}
    body.reduced-motion .wg-orient-hint__icon{animation:none}
  `;
  document.head.appendChild(s);
}

function isTouchDevice() {
  try {
    if (location.search.indexOf('touch=1') !== -1) return true;
    if (location.search.indexOf('touch=0') !== -1) return false;
  } catch {}
  return ('ontouchstart' in window) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    window.matchMedia('(pointer: coarse)').matches;
}

function isPortrait() {
  return window.matchMedia('(orientation: portrait)').matches;
}

export function showOrientationHint({ gameId, prefer = 'landscape', autoHideMs = 6000 } = {}) {
  if (!gameId) return null;
  if (!isTouchDevice()) return null;
  // Only nag for the orientation we prefer.
  const wantPortrait = prefer === 'portrait';
  const wantsHint = wantPortrait ? !isPortrait() : isPortrait();
  if (!wantsHint) return null;
  // Per-game dismissal — don't re-show in this session if already dismissed.
  const key = `wg:orient-hint-dismissed:${gameId}`;
  try { if (localStorage.getItem(key) === '1') return null; } catch {}

  injectStyles();

  const el = document.createElement('div');
  el.className = 'wg-orient-hint';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <svg class="wg-orient-hint__icon" viewBox="0 0 24 24" fill="none" stroke="#ffd23f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="14" height="12" rx="2"/>
      <path d="M17 10l3 2-3 2"/>
      <path d="M9 14h2"/>
    </svg>
    <span class="wg-orient-hint__text">${wantPortrait ? 'BETTER IN PORTRAIT' : 'BETTER IN LANDSCAPE — ROTATE'}</span>
    <span class="wg-orient-hint__close" aria-hidden="true">×</span>
  `;
  document.body.appendChild(el);
  // Slight delay before adding `is-shown` so the CSS transition triggers.
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-shown')));

  const dismiss = (persist = true) => {
    if (!el.parentNode) return;
    el.classList.remove('is-shown'); el.classList.add('is-leaving');
    if (persist) { try { localStorage.setItem(key, '1'); } catch {} }
    setTimeout(() => { try { el.remove(); } catch {} }, 350);
    clearTimeout(_hideTimer);
    window.removeEventListener('orientationchange', onOrient);
    if (_mql) _mql.removeEventListener?.('change', onOrient);
  };
  el.addEventListener('click', () => dismiss(true));
  const _hideTimer = setTimeout(() => dismiss(true), autoHideMs);
  // Dismiss on rotate (without persisting — they actually rotated, so next
  // time we want to remind them again if they ever go back to portrait).
  const onOrient = () => {
    if (wantPortrait ? isPortrait() : !isPortrait()) dismiss(true);
  };
  const _mql = window.matchMedia('(orientation: portrait)');
  window.addEventListener('orientationchange', onOrient);
  _mql.addEventListener?.('change', onOrient);

  return { dismiss, element: el };
}

export default showOrientationHint;
