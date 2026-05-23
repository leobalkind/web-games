// WAVE PREVIEW BANNER — bottom-center slide-in banner shown before each wave.
//
//   showWavePreview({
//     wave: 3,
//     enemies: [
//       { icon: '🧟', count: 12, label: 'Walkers' },
//       { icon: '🏃', count: 4,  label: 'Runners' },
//     ],
//     duration: 3000,
//     subtitle: 'NIGHT FALLS',
//   });
//
import { ensureSharedStyles } from './_overlayStyles.js';

let _active = null;
let _activeTimer = 0;

export function showWavePreview({
  wave,
  enemies = [],
  duration = 3000,
  subtitle = '',
  title,
  color,
  onDismiss,
} = {}) {
  ensureSharedStyles();
  if (_active) { dismiss(); }

  const root = document.createElement('div');
  root.className = 'wg-wave-preview';
  if (color) root.style.setProperty('--wp-accent', color);
  const head = title || (wave != null ? `WAVE ${wave}` : 'INCOMING');
  root.innerHTML = `
    <div class="wg-wave-preview__inner">
      <div class="wg-wave-preview__head">
        <span class="wg-wave-preview__tag">INCOMING</span>
        <span class="wg-wave-preview__title">${escape(head)}</span>
        ${subtitle ? `<span class="wg-wave-preview__sub">${escape(subtitle)}</span>` : ''}
      </div>
      <div class="wg-wave-preview__enemies">
        ${(enemies || []).map((e) => `
          <div class="wg-wave-preview__enemy">
            <span class="wg-wave-preview__icon">${escape(e.icon || '?')}</span>
            <span class="wg-wave-preview__count">${e.count != null ? '×' + e.count : ''}</span>
            <span class="wg-wave-preview__label">${escape(e.label || '')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(root);
  _active = root;

  requestAnimationFrame(() => { root.classList.add('is-shown'); });

  const dismissNow = () => {
    if (_active !== root) return;
    root.classList.remove('is-shown');
    root.classList.add('is-leaving');
    clearTimeout(_activeTimer);
    setTimeout(() => {
      if (root.parentNode) root.parentNode.removeChild(root);
      if (_active === root) _active = null;
      try { onDismiss && onDismiss(); } catch (e) { /* */ }
    }, 320);
  };

  root.addEventListener('click', dismissNow);
  _activeTimer = setTimeout(dismissNow, Math.max(400, duration));

  return { dismiss: dismissNow, element: root };
}

export function dismiss() {
  if (_active) {
    clearTimeout(_activeTimer);
    if (_active.parentNode) _active.parentNode.removeChild(_active);
    _active = null;
  }
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
