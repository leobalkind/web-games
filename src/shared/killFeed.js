// KILL FEED — scrolling top-right ticker for last N events.
//
//   const feed = createKillFeed({ maxLines: 5, lifespan: 5000 });
//   feed.push('PLAYER killed BOT', '#5ef38c');
//   feed.push('Level Up!', '#ffd23f');
//   feed.destroy();
//
import { ensureSharedStyles } from './_overlayStyles.js';

export function createKillFeed({
  container,
  maxLines = 5,
  lifespan = 5000,
  className = '',
} = {}) {
  ensureSharedStyles();
  const root = document.createElement('div');
  root.className = 'wg-feed ' + (className || '');
  // a11y: it's a streaming activity log, so role="log" + polite live region
  // — SR users hear each new line read out without it being interrupting.
  root.setAttribute('role', 'log');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-atomic', 'false');
  root.setAttribute('aria-label', 'Activity feed');
  (container || document.body).appendChild(root);

  const items = []; // { el, timer, fadeTimer }

  function trim() {
    while (items.length > maxLines) {
      const old = items.shift();
      clearTimeout(old.timer); clearTimeout(old.fadeTimer);
      if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
    }
  }

  function push(text, color = '#f8f5ff') {
    const el = document.createElement('div');
    el.className = 'wg-feed__item';
    el.style.color = color;
    el.textContent = text;
    root.appendChild(el);
    const item = { el, timer: 0, fadeTimer: 0 };
    items.push(item);
    trim();
    // Slide-in animation
    requestAnimationFrame(() => { el.classList.add('is-shown'); });
    item.fadeTimer = setTimeout(() => { el.classList.add('is-fading'); }, Math.max(0, lifespan - 400));
    item.timer = setTimeout(() => {
      const i = items.indexOf(item);
      if (i >= 0) items.splice(i, 1);
      if (el.parentNode) el.parentNode.removeChild(el);
    }, lifespan);
    return item;
  }

  function destroy() {
    for (const it of items) {
      clearTimeout(it.timer); clearTimeout(it.fadeTimer);
    }
    items.length = 0;
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  function clear() {
    for (const it of items) {
      clearTimeout(it.timer); clearTimeout(it.fadeTimer);
      if (it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el);
    }
    items.length = 0;
  }

  return { push, destroy, clear, element: root };
}
