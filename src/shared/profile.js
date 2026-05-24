// =============================================================================
// LOCAL PROFILE / "ACCOUNTS" SYSTEM (+ optional cloud profile metadata)
//
// Browser-only by default. No backend required. Multiple profiles share the
// same browser/device, each gets its own namespace under localStorage. The
// "active" profile prefix is auto-applied to high-score keys via
// highScores.js's namespace.
//
// Optional cloud profiles (when src/config.js is filled in) are stored as
// METADATA only here (email, displayName, lastSync); the real data lives in
// Supabase and is cached under the `wg:c:<userId>:*` namespace.
//
// Data shape (in localStorage):
//   wg:profiles:list      = JSON array of profile objects { id, name, pin?, createdAt }
//   wg:profiles:active    = profile id string  ('p_xxx' for local, 'c_<userId>' for cloud)
//   wg:profiles:cloud:<userId> = cloud profile metadata { email, displayName, lastSync }
//   wg:p:<id>:hs:<gameId> = high-score record for a LOCAL profile + game
//   wg:p:<id>:ach:<gid>   = achievements unlocked (LOCAL)
//   wg:p:<id>:settings    = per-profile settings (optional)
//   wg:c:<userId>:hs:<gameId> = cached high-score record for a CLOUD profile + game
//   wg:c:<userId>:ach:<gid>   = cached achievement IDs for a CLOUD profile
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
const CLOUD_META_PREFIX = 'wg:profiles:cloud:';
const CLOUD_ID_PREFIX = 'c_'; // active id prefix used to distinguish cloud profiles

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

// Returns LOCAL profiles + any CLOUD profiles previously signed in on this
// device. Cloud profiles carry `type: 'cloud'`, local ones have no type field
// (treated as `'local'`).
export function listProfiles() {
  const local = _readJson(LIST_KEY, []).map((p) => ({ ...p, type: p.type || 'local' }));
  const cloud = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(CLOUD_META_PREFIX)) continue;
    const userId = k.slice(CLOUD_META_PREFIX.length);
    const meta = _readJson(k, null);
    if (!meta) continue;
    cloud.push({
      id: CLOUD_ID_PREFIX + userId,
      userId,
      name: meta.displayName || meta.email || 'CLOUD USER',
      email: meta.email || '',
      type: 'cloud',
      lastSync: meta.lastSync || 0,
      createdAt: meta.createdAt || meta.lastSync || 0,
    });
  }
  return [...local, ...cloud];
}
// Identify whether an id refers to a local or cloud profile.
export function getProfileType(id) {
  if (!id) return 'local';
  return String(id).startsWith(CLOUD_ID_PREFIX) ? 'cloud' : 'local';
}
function _isCloudId(id) { return getProfileType(id) === 'cloud'; }
function _userIdFromCloudId(id) {
  return _isCloudId(id) ? String(id).slice(CLOUD_ID_PREFIX.length) : null;
}
export function getActive() {
  const id = localStorage.getItem(ACTIVE_KEY);
  if (!id) return null;
  return listProfiles().find((p) => p.id === id) || null;
}
export function setActive(id) {
  const current = localStorage.getItem(ACTIVE_KEY);
  if (!id) {
    if (current == null) return; // nothing to do — already in guest mode
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    if (current === id) return;  // no-op — already active, skip the listener storm
    const exists = listProfiles().some((p) => p.id === id);
    if (!exists) throw new Error('Profile not found: ' + id);
    localStorage.setItem(ACTIVE_KEY, id);
  }
  _emit();
}
// Register / refresh a cloud profile's metadata, then make it active.
export function setActiveCloud(userId, email, displayName) {
  if (!userId) throw new Error('userId required');
  const metaKey = CLOUD_META_PREFIX + userId;
  const existing = _readJson(metaKey, null) || {};
  const meta = {
    email: email || existing.email || '',
    displayName: displayName || existing.displayName || (email || '').split('@')[0] || 'CLOUD USER',
    createdAt: existing.createdAt || Date.now(),
    lastSync: existing.lastSync || 0,
  };
  _writeJson(metaKey, meta);
  localStorage.setItem(ACTIVE_KEY, CLOUD_ID_PREFIX + userId);
  _emit();
  return { id: CLOUD_ID_PREFIX + userId, userId, ...meta, type: 'cloud' };
}
// Update the lastSync timestamp on the cloud profile metadata.
export function touchCloudSync(userId) {
  if (!userId) return;
  const metaKey = CLOUD_META_PREFIX + userId;
  const existing = _readJson(metaKey, null);
  if (!existing) return;
  existing.lastSync = Date.now();
  _writeJson(metaKey, existing);
  _emit();
}
// Remove a cloud profile from local storage (does NOT delete the cloud account
// — only the local cache + metadata).
export function forgetCloudProfile(userId) {
  if (!userId) return;
  localStorage.removeItem(CLOUD_META_PREFIX + userId);
  const prefix = 'wg:c:' + userId + ':';
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) toDelete.push(k);
  }
  for (const k of toDelete) localStorage.removeItem(k);
  if (localStorage.getItem(ACTIVE_KEY) === CLOUD_ID_PREFIX + userId) {
    localStorage.removeItem(ACTIVE_KEY);
  }
  _emit();
}
// Hard cap on local profiles to keep the picker UI usable and the localStorage
// quota safe (each profile multiplies high-score/achievement footprint).
const MAX_LOCAL_PROFILES = 20;
// Optional PIN validation: digits 3..6 only (matches the inputmode="numeric"
// field) — keeps the hash space large enough to be casually useful.
function _normalizePin(pin) {
  if (pin == null || pin === '') return null;
  const s = String(pin).trim();
  if (!s) return null;
  if (!/^\d{3,6}$/.test(s)) throw new Error('PIN must be 3-6 digits (numbers only)');
  return s;
}
export function createProfile(name, pin) {
  name = (name || '').trim();
  if (!name) throw new Error('Name required');
  if (name.length > 24) throw new Error('Name too long (max 24)');
  // Reject all-whitespace / pure-punctuation names that survive .trim() oddities.
  if (!/[\p{L}\p{N}]/u.test(name)) throw new Error('Name must include at least one letter or number');
  // Only consider LOCAL profiles toward the cap — cloud profiles live in
  // Supabase and don't pile up local storage in the same way.
  const localOnly = _readJson(LIST_KEY, []);
  if (localOnly.length >= MAX_LOCAL_PROFILES) {
    throw new Error('Too many local profiles (max ' + MAX_LOCAL_PROFILES + ') — delete one first');
  }
  const list = listProfiles();
  if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A profile with that name already exists');
  }
  // Validate PIN format BEFORE we persist anything.
  const normalizedPin = _normalizePin(pin);
  const id = 'p_' + Math.random().toString(36).slice(2, 10);
  const profile = { id, name, pin: _hashPin(normalizedPin), createdAt: Date.now() };
  localOnly.push(profile);
  _writeJson(LIST_KEY, localOnly);
  // If this is the first profile, also migrate existing legacy data under it.
  if (localOnly.length === 1) _migrateLegacyTo(id);
  setActive(id);
  return profile;
}
export function deleteProfile(id) {
  const list = listProfiles().filter((p) => p.id !== id);
  _writeJson(LIST_KEY, list);
  // Wipe all keys under that profile's namespace + the hub "best seen" cache
  // so we don't pulse the BEST chip on the next hub visit based on a stale
  // comparison value left over from the deleted profile.
  const prefix = 'wg:p:' + id + ':';
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.startsWith(prefix) || k.startsWith('wg:bestSeen:'))) toDelete.push(k);
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
// Cloud profiles use the `wg:c:<userId>:<suffix>` namespace so their cached
// data is clearly distinguishable from local-only profile data.
export function profileKey(suffix) {
  const id = localStorage.getItem(ACTIVE_KEY);
  if (!id) return `wg:${suffix}`;
  if (_isCloudId(id)) return `wg:c:${_userIdFromCloudId(id)}:${suffix}`;
  return `wg:p:${id}:${suffix}`;
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

// Count games played for a profile. Works for both local and cloud profiles
// (counts whichever namespace the id resolves to). Returns 0 for guest mode.
export function profileGamesPlayed(id) {
  if (!id) return 0;
  const prefix = _isCloudId(id)
    ? 'wg:c:' + _userIdFromCloudId(id) + ':hs:'
    : 'wg:p:' + id + ':hs:';
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) n++;
  }
  return n;
}
