// END-OF-RUN GRADE CARD — S/A/B/C/D letter grade with animated breakdown bars.
//
//   showGradeCard({
//     stats: [
//       { label: 'Time',       value: 95, weight: 0.4 },
//       { label: 'Loot',       value: 80, weight: 0.4 },
//       { label: 'Undetected', value: 100, weight: 0.2 },
//     ],
//     breakdown: [
//       { label: 'Time',       value: 38, max: 60 },
//       { label: 'Loot',       value: 8,  max: 10 },
//       { label: 'Undetected', value: 1,  max: 1  },
//     ],
//     onRestart: () => start(),
//     onClose:   () => { /* user dismissed */ },
//   });
//
// Each `stats` row contributes `value * weight` to the weighted score (0-100).
// `breakdown` is purely visual — animated horizontal fill per row.
//
import { ensureSharedStyles } from './_overlayStyles.js';

const GRADE_COLORS = {
  S: '#ffd23f',
  A: '#4cc9f0',
  B: '#ff3aa1',
  C: '#ffce5e',
  D: '#8a90b1',
};

export function computeGrade(stats) {
  let total = 0, weightSum = 0;
  for (const s of stats || []) {
    const w = (typeof s.weight === 'number') ? s.weight : 1;
    const v = Math.max(0, Math.min(100, s.value || 0));
    total += v * w;
    weightSum += w;
  }
  const score = weightSum > 0 ? total / weightSum : 0;
  let grade = 'D';
  if (score >= 92) grade = 'S';
  else if (score >= 80) grade = 'A';
  else if (score >= 65) grade = 'B';
  else if (score >= 45) grade = 'C';
  return { grade, score: Math.round(score) };
}

let _activeCard = null;

export function showGradeCard({
  stats = [],
  breakdown = [],
  title = '',
  subtitle = '',
  onRestart,
  onClose,
  restartLabel = 'RESTART',
  hubLabel = 'HUB',
  hubHref = '../../index.html',
  appendTo,
} = {}) {
  ensureSharedStyles();
  if (_activeCard) { _activeCard.remove(); _activeCard = null; }

  const { grade, score } = computeGrade(stats);
  const color = GRADE_COLORS[grade] || '#4cc9f0';

  const root = document.createElement('div');
  root.className = 'wg-grade';
  root.innerHTML = `
    <div class="wg-grade__card">
      <div class="wg-grade__letter" style="color:${color};text-shadow:0 0 24px ${color}88">${grade}</div>
      ${title ? `<div class="wg-grade__title">${escape(title)}</div>` : ''}
      ${subtitle ? `<div class="wg-grade__sub">${escape(subtitle)}</div>` : ''}
      <div class="wg-grade__score">SCORE <b>${score}</b>/100</div>
      <div class="wg-grade__bars">
        ${(breakdown || []).map((b) => {
          const pct = b.max > 0 ? Math.max(0, Math.min(100, Math.round((b.value / b.max) * 100))) : 0;
          return `<div class="wg-grade__row">
            <div class="wg-grade__row-label">${escape(b.label)} <span>${b.value}/${b.max}</span></div>
            <div class="wg-grade__bar"><div class="wg-grade__fill" data-pct="${pct}" style="background:${color}"></div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="wg-grade__btns">
        <button type="button" class="wg-grade__btn wg-grade__btn--restart">${escape(restartLabel)}</button>
        <a class="wg-grade__btn wg-grade__btn--hub" href="${hubHref}">${escape(hubLabel)}</a>
      </div>
    </div>
  `;
  (appendTo || document.body).appendChild(root);
  _activeCard = root;

  // Trigger bar-fill animation next frame so transition picks up
  requestAnimationFrame(() => {
    root.classList.add('is-shown');
    root.querySelectorAll('.wg-grade__fill').forEach((el) => {
      el.style.width = el.dataset.pct + '%';
    });
  });

  const close = () => {
    if (root.parentNode) root.parentNode.removeChild(root);
    if (_activeCard === root) _activeCard = null;
  };

  root.querySelector('.wg-grade__btn--restart')?.addEventListener('click', () => {
    close();
    try { onRestart && onRestart(); } catch (e) { /* */ }
  });
  root.querySelector('.wg-grade__btn--hub')?.addEventListener('click', () => {
    try { onClose && onClose(); } catch (e) { /* */ }
  });

  return { close, element: root, grade, score };
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
