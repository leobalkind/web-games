// Shared localStorage-backed high-score store.
// Each game records (kills, time, etc.) and the highest is shown on the
// start/end overlays.
//
// Profile-aware: if a profile is active (via src/shared/profile.js), keys are
// scoped under `wg:p:<profileId>:hs:<gameId>`. Falls back to legacy `wg:hs:*`
// when no profile is logged in (guest mode).

function _key(gameId) {
  let activeId = null;
  try { activeId = localStorage.getItem('wg:profiles:active'); } catch {}
  return activeId ? `wg:p:${activeId}:hs:${gameId}` : `wg:hs:${gameId}`;
}

export function loadBest(gameId) {
  try {
    const raw = localStorage.getItem(_key(gameId));
    if (raw) return JSON.parse(raw);
    // Fallback: if profile-scoped key missing, try legacy un-prefixed (helps if
    // a player created a profile after already playing as guest).
    const legacy = localStorage.getItem('wg:hs:' + gameId);
    return legacy ? JSON.parse(legacy) : null;
  } catch { return null; }
}

export function saveBest(gameId, payload) {
  try {
    localStorage.setItem(_key(gameId), JSON.stringify({ ...payload, ts: Date.now() }));
  } catch {}
}

// Submit a run and return { isNewBest, prev, current } where current is whatever
// got persisted (either the existing record, or the new one if it beat it).
// `compare` is a function(a, b) → -1/0/1; default sorts by .score descending.
export function submitRun(gameId, run, compare = null) {
  const prev = loadBest(gameId);
  const cmp = compare || ((a, b) => (b.score || 0) - (a.score || 0));
  const isNewBest = !prev || cmp(run, prev) < 0;
  if (isNewBest) saveBest(gameId, run);
  // Decorate the end-screen with a "saved to <profile>" line so the player
  // can tell whether their run was recorded against their account or guest.
  try { _decorateEndScreenWithProfile(); } catch {}
  return { isNewBest, prev, current: isNewBest ? run : prev };
}

// Returns the active profile name (or 'GUEST' fallback) without importing the
// full profile module — keeps this file lean for any game that wants to print
// a small "saved to <name>" string under its end screen.
function _activeProfileName() {
  try {
    const id = localStorage.getItem('wg:profiles:active');
    if (!id) return null;
    const raw = localStorage.getItem('wg:profiles:list');
    if (!raw) return null;
    const list = JSON.parse(raw);
    const p = Array.isArray(list) ? list.find((x) => x.id === id) : null;
    return p ? p.name : null;
  } catch { return null; }
}

// Finds the end-screen "best" line in the current page and inserts a sibling
// chip immediately after it: "saved to <profile>" (or "GUEST · saves locally").
// No-op if there's no end-best element on the page.
function _decorateEndScreenWithProfile() {
  if (typeof document === 'undefined') return;
  const bestEl = document.getElementById('end-best');
  if (!bestEl) return;
  let chip = document.getElementById('end-profile-chip');
  if (!chip) {
    chip = document.createElement('div');
    chip.id = 'end-profile-chip';
    chip.style.cssText = [
      'font-family:\'Press Start 2P\',\'Courier New\',monospace',
      'font-size:0.42rem',
      'letter-spacing:0.12em',
      'color:#8a90b1',
      'margin-top:6px',
      'text-align:center',
      'opacity:0.85',
    ].join(';');
    if (bestEl.parentNode) bestEl.parentNode.insertBefore(chip, bestEl.nextSibling);
  }
  const name = _activeProfileName();
  if (name) {
    chip.innerHTML = `<span style="color:#5ef38c;">SAVED</span> to <span style="color:#4cc9f0;">${_esc(name)}</span>`;
  } else {
    chip.innerHTML = '<span style="color:#ffd23f;">GUEST</span> · stored locally · log in to save per-profile';
  }
}
function _esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
