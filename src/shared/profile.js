// =============================================================================
// LOCAL PROFILE / "ACCOUNTS" SYSTEM
//
// Browser-only. No backend. Multiple profiles share the same browser/device,
// each gets its own namespace under localStorage. The "active" profile prefix
// is auto-applied to high-score keys via highScores.js's namespace.
//
// Data shape (in localStorage):
//   wg:profiles:list      = JSON array of profile objects { id, name, pin?, createdAt }
//   wg:profiles:active    = profile id string
//   wg:p:<id>:hs:<gameId> = high-score record for that profile + game
//   wg:p:<id>:ach:<gid>   = achievements unlocked
//   wg:p:<id>:settings    = per-profile settings (optional)
//
// Anonymous / no-profile mode: keys live at the legacy unprefixed paths.
// First time a profile is created, existing legacy data is migrated under it.
//
// Public API:
//   listProfiles()         -> Profile[]
//   getActive()            -> Profile | null
//   setActive(id)
//   createProfile(name, pin?)   -> Profile (throws on dup name)
//   deleteProfile(id)
//   verifyPin(id, pin)     -> boolean
//   renameProfile(id, name)
//   exportProfile(id)      -> JSON string (all keys for that profile)
//   importProfile(json)    -> Profile (created from import)
//   profileKey(suffix)     -> 'wg:p:<id>:<suffix>'  or  'wg:<suffix>' if no active
//   onChange(cb)           -> unsubscribe fn  (fired on profile switch / create / delete)
// =============================================================================

const LIST_KEY = 'wg:profiles:list';
const ACTIVE_KEY = 'wg:profiles:active';

function _readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function _writeJson(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function _hashPin(pin) {
  // Tiny non-cryptographic hash. PIN is for casual privacy only — defeated
  // trivially by anyone with devtools. Don't use real passwords.
  if (!pin) return null;
  let h = 0;
  const s = String(pin);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return 'h_' + Math.abs(h).toString(36);
}

const listeners = new Set();
function _emit() { for (const cb of listeners) try { cb(); } catch {} }

export function listProfiles() {
  return _readJson(LIST_KEY, []);
}
export function getActive() {
  const id = localStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  return listProfiles().find((p) => p.id === id) || null;
}
export function setActive(id) {
  if (!id) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    const exists = listProfiles().some((p) => p.id === id);
    if (!exists) throw new Error('Profile not found: ' + id);
    localStorage.setItem(ACTIVE_KEY, id);
  }
  _emit();
}
export function createProfile(name, pin) {
  name = (name || '').trim();
  if (!name) throw new Error('Name required');
  if (name.length > 24) throw new Error('Name too long (max 24)');
  const list = listProfiles();
  if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A profile with that name already exists');
  }
  const id = 'p_' + Math.random().toString(36).slice(2, 10);
  const profile = { id, name, pin: _hashPin(pin), createdAt: Date.now() };
  list.push(profile);
  _writeJson(LIST_KEY, list);
  // If this is the first profile, also migrate existing legacy data under it.
  if (list.length === 1) _migrateLegacyTo(id);
  setActive(id);
  return profile;
}
export function deleteProfile(id) {
  const list = listProfiles().filter((p) => p.id !== id);
  _writeJson(LIST_KEY, list);
  // Wipe all keys under that profile's namespace
  const prefix = 'wg:p:' + id + ':';
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) toDelete.push(k);
  }
  for (const k of toDelete) localStorage.removeItem(k);
  if (localStorage.getItem(ACTIVE_KEY) === id) localStorage.removeItem(ACTIVE_KEY);
  _emit();
}
export function verifyPin(id, pin) {
  const p = listProfiles().find((x) => x.id === id);
  if (!p) return false;
  if (!p.pin) return true; // no PIN set = anyone can log in
  return p.pin === _hashPin(pin);
}
export function renameProfile(id, name) {
  name = (name || '').trim();
  if (!name) throw new Error('Name required');
  const list = listProfiles();
  if (list.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A profile with that name already exists');
  }
  const p = list.find((x) => x.id === id);
  if (!p) throw new Error('Profile not found');
  p.name = name;
  _writeJson(LIST_KEY, list);
  _emit();
}
// Returns the localStorage key used for a logical suffix, scoped to the
// active profile if one is logged in.
export function profileKey(suffix) {
  const id = localStorage.getItem(ACTIVE_KEY);
  return id ? `wg:p:${id}:${suffix}` : `wg:${suffix}`;
}
// Dump every key+value under a profile as a JSON string.
export function exportProfile(id) {
  const p = listProfiles().find((x) => x.id === id);
  if (!p) throw new Error('Profile not found');
  const prefix = 'wg:p:' + id + ':';
  const out = { profile: { name: p.name, createdAt: p.createdAt }, data: {} };
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      out.data[k.slice(prefix.length)] = localStorage.getItem(k);
    }
  }
  return JSON.stringify(out);
}
// Import a previously-exported profile JSON. Creates a new profile (no merge).
export function importProfile(json) {
  const obj = JSON.parse(json);
  if (!obj.profile?.name || !obj.data) throw new Error('Invalid profile export');
  let name = obj.profile.name;
  // De-duplicate name if clash
  const existing = listProfiles().map((p) => p.name.toLowerCase());
  let attempt = name;
  let n = 2;
  while (existing.includes(attempt.toLowerCase())) {
    attempt = name + ' (' + n + ')'; n++;
    if (n > 50) break;
  }
  const profile = createProfile(attempt);
  const prefix = 'wg:p:' + profile.id + ':';
  for (const [suffix, value] of Object.entries(obj.data)) {
    try { localStorage.setItem(prefix + suffix, value); } catch {}
  }
  _emit();
  return profile;
}
// Migrate existing legacy un-prefixed keys (wg:hs:*, wg:ach:*) into a profile.
function _migrateLegacyTo(id) {
  const prefix = 'wg:p:' + id + ':';
  const movePrefixes = ['wg:hs:', 'wg:ach:', 'wg:codex:'];
  const moves = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    for (const p of movePrefixes) {
      if (k.startsWith(p) && !k.startsWith('wg:p:')) {
        moves.push({ from: k, to: prefix + k.slice(3) }); // drop the 'wg:' prefix in target
        break;
      }
    }
  }
  for (const { from, to } of moves) {
    try {
      localStorage.setItem(to, localStorage.getItem(from));
      // keep originals around as a safety net — don't delete legacy data on first migrate.
    } catch {}
  }
}
export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
// Helper for hub display: human-friendly label of current profile state.
export function activeLabel() {
  const p = getActive();
  return p ? p.name : 'GUEST';
}

// Derive a stable accent color for a profile id (HSL hue). Used by the chip
// avatar dot, login tiles, and any UI that wants a per-profile tint.
export function profileColor(id) {
  if (!id) return '#8a90b1';
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i);
    h |= 0;
  }
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 78%, 62%)`;
}

// Initials (1–2 chars) for avatar fallback.
export function profileInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Count games played (anything stored under wg:p:<id>:hs:*) for a profile.
// Returns 0 for guest mode (no id).
export function profileGamesPlayed(id) {
  if (!id) return 0;
  const prefix = 'wg:p:' + id + ':hs:';
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) n++;
  }
  return n;
}
