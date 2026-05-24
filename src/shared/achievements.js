// Shared achievements system.
// Games import this, register their achievement set, then call `unlock(id)` when
// the player triggers something. The module:
//   - persists unlocked IDs in localStorage under `wg:ach:<gameId>`
//   - fires a transient toast in the top-right
//   - exposes `getProgress(gameId)` for HUD / hub display
//
// Usage:
//   import { createAchievements } from '../../src/shared/achievements.js';
//   const ach = createAchievements('bork-battle', {
//     first_kill:   { name: 'First Blood',     desc: 'Defeat any pug',           icon: '⚔' },
//     ten_kills:    { name: 'Pug Slayer',      desc: '10 kills in one match',    icon: '💀' },
//     no_damage:    { name: 'Untouchable',     desc: 'Win without taking damage', icon: '🛡' },
//   });
//   ach.unlock('first_kill');        // toast + persist (no-op if already unlocked)
//   ach.isUnlocked('first_kill');    // boolean
//   ach.getProgress();               // { unlocked: 2, total: 3 }
//   ach.getUnlockedIds();            // Set<string>
//   ach.reset();                     // wipe (for dev/testing)

const NS = 'wg:ach:';

// Profile-aware key resolution — mirrors highScores.js so achievements stay
// scoped to the active profile (local or cloud). Returns:
//   wg:c:<userId>:ach:<gameId>   for cloud profiles
//   wg:p:<profileId>:ach:<gameId> for local profiles
//   wg:ach:<gameId>              for guest mode
function _activeId() {
  try { return localStorage.getItem('wg:profiles:active'); } catch { return null; }
}
function _isCloud(id) { return !!id && String(id).startsWith('c_'); }
function _scopedKey(gameId) {
  const id = _activeId();
  if (!id) return NS + gameId;
  if (_isCloud(id)) return 'wg:c:' + String(id).slice(2) + ':ach:' + gameId;
  return 'wg:p:' + id + ':ach:' + gameId;
}

// Single shared toast container — created once, reused across all instances.
let _toastHost = null;
function ensureToastHost() {
  if (_toastHost) return _toastHost;
  _toastHost = document.createElement('div');
  _toastHost.id = 'ach-toasts';
  _toastHost.style.cssText = [
    'position:fixed',
    'top:calc(72px + env(safe-area-inset-top, 0))',
    'right:calc(12px + env(safe-area-inset-right, 0))',
    'z-index:1500',
    'pointer-events:none',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'max-width:90vw',
  ].join(';');
  document.body.appendChild(_toastHost);
  // One-time styles for the toast element
  const style = document.createElement('style');
  style.textContent = `
    .ach-toast {
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(135deg, rgba(26,15,46,0.95), rgba(42,18,85,0.95));
      border: 2px solid #ffd23f;
      border-radius: 8px;
      padding: 10px 14px 10px 12px;
      color: #f8f5ff;
      font-family: 'Press Start 2P', 'Courier New', monospace;
      font-size: 0.55rem;
      letter-spacing: 0.05em;
      box-shadow: 0 4px 18px rgba(255,210,63,0.35), 0 0 0 1px rgba(0,0,0,0.5);
      transform: translateX(120%);
      opacity: 0;
      transition: transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.45s ease;
      min-width: 220px;
      max-width: 360px;
    }
    .ach-toast.is-in { transform: translateX(0); opacity: 1; }
    .ach-toast.is-out { transform: translateX(20%); opacity: 0; }
    .ach-toast__icon {
      font-size: 1.4rem; line-height: 1;
      flex-shrink: 0;
      filter: drop-shadow(0 0 6px rgba(255,210,63,0.6));
    }
    .ach-toast__body { flex: 1; min-width: 0; }
    .ach-toast__tag {
      color: #ffd23f; font-size: 0.42rem; letter-spacing: 0.18em;
      display: block; margin-bottom: 3px;
    }
    .ach-toast__name {
      color: #fff; font-size: 0.65rem; letter-spacing: 0.04em;
      display: block; line-height: 1.3; margin-bottom: 2px;
    }
    .ach-toast__desc {
      color: #c8c0e8; font-size: 0.46rem; letter-spacing: 0.02em;
      font-family: 'Segoe UI', Roboto, system-ui, sans-serif; line-height: 1.4;
    }
    @media (prefers-reduced-motion: reduce) {
      .ach-toast { transition: opacity 0.1s ease !important; transform: none !important; }
    }
  `;
  document.head.appendChild(style);
  return _toastHost;
}

function showToast(achDef) {
  const host = ensureToastHost();
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML = `
    <div class="ach-toast__icon">${achDef.icon || '★'}</div>
    <div class="ach-toast__body">
      <span class="ach-toast__tag">ACHIEVEMENT UNLOCKED</span>
      <span class="ach-toast__name"></span>
      <span class="ach-toast__desc"></span>
    </div>`;
  // Safe text injection (avoid HTML in user-provided strings)
  el.querySelector('.ach-toast__name').textContent = achDef.name || '';
  el.querySelector('.ach-toast__desc').textContent = achDef.desc || '';
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 600);
  }, 4200);
}

export function createAchievements(gameId, defs) {
  if (!gameId || typeof gameId !== 'string') {
    throw new Error('createAchievements: gameId is required');
  }
  defs = defs || {};
  const key = _scopedKey(gameId);
  // Lazy-load unlocked set from localStorage. Fallback to legacy `wg:ach:*`
  // if profile-scoped key missing (helps profiles that pre-date scoping).
  let unlocked = new Set();
  try {
    let raw = localStorage.getItem(key);
    if (!raw && key !== NS + gameId) raw = localStorage.getItem(NS + gameId);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) unlocked = new Set(arr);
    }
  } catch {}
  const persist = () => {
    try { localStorage.setItem(key, JSON.stringify([...unlocked])); } catch {}
  };
  const pushIfCloud = (achId) => {
    if (!_isCloud(_activeId())) return;
    import('./cloudSync.js').then((mod) => {
      try { mod.pushAchievement(gameId, achId); } catch {}
    }).catch(() => {});
  };
  return {
    unlock(id) {
      if (!id || unlocked.has(id)) return false;
      const def = defs[id];
      if (!def) {
        // Unknown achievement — still record so unknown unlocks aren't lost.
        unlocked.add(id); persist(); pushIfCloud(id);
        return false;
      }
      unlocked.add(id); persist(); pushIfCloud(id);
      showToast(def);
      return true;
    },
    isUnlocked(id) { return unlocked.has(id); },
    getUnlockedIds() { return new Set(unlocked); },
    getProgress() {
      const total = Object.keys(defs).length;
      // Only count unlocks that map to a known def (so removed defs don't inflate).
      let n = 0;
      for (const id of unlocked) if (defs[id]) n++;
      return { unlocked: n, total };
    },
    list() {
      // Returns an ordered array of { id, def, unlocked }.
      return Object.entries(defs).map(([id, def]) => ({
        id,
        def,
        unlocked: unlocked.has(id),
      }));
    },
    reset() { unlocked = new Set(); persist(); },
  };
}

// Helper for the hub: read all achievement progress for every known game
// without instantiating a full set. Returns array of { gameId, unlockedCount }.
export function readAllProgress(gameIds) {
  const out = [];
  for (const gid of gameIds) {
    let n = 0;
    try {
      let raw = localStorage.getItem(_scopedKey(gid));
      if (!raw) raw = localStorage.getItem(NS + gid);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) n = arr.length;
      }
    } catch {}
    out.push({ gameId: gid, unlockedCount: n });
  }
  return out;
}
