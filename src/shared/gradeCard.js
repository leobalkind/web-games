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
// Round 3C a11y:
//   • Card has role="dialog" aria-modal="true" aria-labelledby pointing at the
//     letter so screen readers announce "Grade S, Time 38 of 60..."
//   • Focus is moved into the card on open (Restart button by default) and
//     restored to the previously-focused element on close.
//   • ESC closes (acts as "skip" — calls onClose like the Hub button).
//   • Tab is trapped inside the card.
//   • Outcome announced via the global wg-live-region.
//
import { ensureSharedStyles } from './_overlayStyles.js';
import { announce } from './settingsMenu.js';

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
  // Remember who had focus before the card opened — restored on close so
  // keyboard users land back on the button they pressed (or the canvas).
  const opener = document.activeElement;

  const root = document.createElement('div');
  root.className = 'wg-grade';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'wg-grade-letter');
  root.setAttribute('aria-describedby', 'wg-grade-score');
  root.innerHTML = `
    <div class="wg-grade__card" tabindex="-1">
      <div class="wg-grade__letter" id="wg-grade-letter" style="color:${color};text-shadow:0 0 24px ${color}88" aria-label="Grade ${grade}">${grade}</div>
      ${title ? `<div class="wg-grade__title">${escape(title)}</div>` : ''}
      ${subtitle ? `<div class="wg-grade__sub">${escape(subtitle)}</div>` : ''}
      <div class="wg-grade__score" id="wg-grade-score">SCORE <b>${score}</b>/100</div>
      <div class="wg-grade__bars" role="list">
        ${(breakdown || []).map((b) => {
          const pct = b.max > 0 ? Math.max(0, Math.min(100, Math.round((b.value / b.max) * 100))) : 0;
          return `<div class="wg-grade__row" role="listitem">
            <div class="wg-grade__row-label">${escape(b.label)} <span>${b.value}/${b.max}</span></div>
            <div class="wg-grade__bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escape(b.label)} ${pct} percent"><div class="wg-grade__fill" data-pct="${pct}" style="background:${color}"></div></div>
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

  const restartBtn = root.querySelector('.wg-grade__btn--restart');
  const hubLink = root.querySelector('.wg-grade__btn--hub');

  // Focus + announce after the panel paints
  setTimeout(() => {
    try { restartBtn?.focus(); } catch {}
    announce(`Run complete. Grade ${grade}. Score ${score} out of 100.`);
  }, 80);

  // ESC closes (treats as "Hub" / dismiss) and Tab is trapped between the
  // two buttons so a sighted keyboard user can't tab into the canvas.
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      try { onClose && onClose(); } catch (_) {}
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = [restartBtn, hubLink].filter(Boolean);
    if (focusables.length < 2) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', onKey);

  const close = () => {
    if (root.parentNode) root.parentNode.removeChild(root);
    if (_activeCard === root) _activeCard = null;
    // Restore focus
    if (opener && document.contains(opener) && typeof opener.focus === 'function') {
      try { opener.focus(); } catch {}
    }
  };

  restartBtn?.addEventListener('click', () => {
    close();
    try { onRestart && onRestart(); } catch (e) { /* */ }
  });
  hubLink?.addEventListener('click', () => {
    try { onClose && onClose(); } catch (e) { /* */ }
  });

  return { close, element: root, grade, score };
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
