// =============================================================================
// CLOUD SYNC WRAPPER (Supabase)
//
// Optional, feature-flagged via src/config.js. When SUPABASE_URL +
// SUPABASE_ANON_KEY are empty, every function in this module silently no-ops
// so the rest of the codebase can call them unconditionally.
//
// The Supabase SDK is lazy-loaded the first time getClient() is awaited,
// keeping the initial JS bundle small for users who never sign in.
//
// Offline-first contract:
//   - All writes are best-effort. If the network call fails OR the device is
//     offline, the write is queued in localStorage at WG_QUEUE_KEY and flushed
//     automatically on the next successful call (or on the next "online" event).
//   - All reads return { data, error } and NEVER throw to the caller. UI code
//     is expected to fall back to local data on any error.
//
// Public API:
//   isCloudEnabled(): boolean
//   getClient(): Promise<SupabaseClient | null>
//   signUp(email, password, displayName): Promise<{ user, error }>
//   signIn(email, password): Promise<{ user, error }>
//   signOut(): Promise<void>
//   getSession(): Promise<{ user, error }>
//   sendPasswordReset(email): Promise<{ error }>
//   pullProfile(userId): Promise<{ data, error }>
//      -> { profile, highScores[], achievements[], discoveries[] }
//   pushHighScore(gameId, score): Promise<{ error }>
//   pushAchievement(gameId, achievementId): Promise<{ error }>
//   pushDiscovery(gameId, key, data): Promise<{ error }>
//   migrateLocalToCloud(userId, localProfileId): Promise<{ error }>
//   subscribeToChanges(userId, callback): RealtimeChannel | null
// =============================================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_SYNC_ENABLED } from '../config.js';

const WG_QUEUE_KEY = 'wg:cloud:queue';

// --- lazy SDK + client --------------------------------------------------------
let _clientPromise = null;
let _client = null;

export function isCloudEnabled() {
  return CLOUD_SYNC_ENABLED;
}

export async function getClient() {
  if (!isCloudEnabled()) return null;
  if (_client) return _client;
  if (_clientPromise) return _clientPromise;
  _clientPromise = (async () => {
    try {
      const mod = await import('@supabase/supabase-js');
      _client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
      return _client;
    } catch (e) {
      // SDK load failure (bad URL, network, etc.) — leave _client null so
      // future calls retry. Don't throw.
      _clientPromise = null;
      return null;
    }
  })();
  return _clientPromise;
}

// --- queue (offline buffer) ---------------------------------------------------
function _readQueue() {
  try {
    const raw = localStorage.getItem(WG_QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function _writeQueue(q) {
  try { localStorage.setItem(WG_QUEUE_KEY, JSON.stringify(q)); } catch {}
}
function _enqueue(op) {
  const q = _readQueue();
  q.push({ ...op, queuedAt: Date.now() });
  // Cap queue at 500 entries so a broken connection doesn't eat localStorage.
  if (q.length > 500) q.splice(0, q.length - 500);
  _writeQueue(q);
}

let _flushing = false;
async function _flushQueue() {
  if (_flushing) return;
  if (!isCloudEnabled()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const q = _readQueue();
  if (!q.length) return;
  _flushing = true;
  try {
    const client = await getClient();
    if (!client) return;
    // We need an authenticated session to write — bail otherwise.
    const sess = await _getUser(client);
    if (!sess) return;
    const userId = sess.id;
    const remaining = [];
    for (const op of q) {
      // Only flush ops belonging to the currently signed-in user. Leave others
      // queued (will replay if that user signs in again).
      if (op.userId && op.userId !== userId) { remaining.push(op); continue; }
      const ok = await _executeOp(client, userId, op);
      if (!ok) remaining.push(op);
    }
    _writeQueue(remaining);
  } catch { /* swallow */ }
  finally { _flushing = false; }
}

async function _executeOp(client, userId, op) {
  try {
    if (op.kind === 'highScore') {
      const { error } = await client.from('high_scores').upsert({
        user_id: userId, game_id: op.gameId, score: op.score, updated_at: new Date().toISOString(),
      });
      return !error;
    }
    if (op.kind === 'achievement') {
      const { error } = await client.from('achievements').upsert({
        user_id: userId, game_id: op.gameId, achievement_id: op.achievementId,
      });
      return !error;
    }
    if (op.kind === 'discovery') {
      const { error } = await client.from('discoveries').upsert({
        user_id: userId, game_id: op.gameId, discovery_key: op.key, data: op.data || null,
      });
      return !error;
    }
  } catch { return false; }
  return true;
}

if (typeof window !== 'undefined' && isCloudEnabled()) {
  window.addEventListener('online', () => { _flushQueue().catch(() => {}); });
  // Also try once shortly after load so any leftover ops drain.
  setTimeout(() => { _flushQueue().catch(() => {}); }, 2500);
}

// --- auth helpers -------------------------------------------------------------
async function _getUser(client) {
  try {
    const { data } = await client.auth.getUser();
    return data?.user || null;
  } catch { return null; }
}

export async function signUp(email, password, displayName) {
  if (!isCloudEnabled()) return { user: null, error: new Error('Cloud sync disabled') };
  try {
    const client = await getClient();
    if (!client) return { user: null, error: new Error('Cloud client unavailable') };
    const { data, error } = await client.auth.signUp({
      email, password,
      options: { data: { display_name: displayName || (email || '').split('@')[0] } },
    });
    return { user: data?.user || null, error: error || null };
  } catch (e) { return { user: null, error: e }; }
}

export async function signIn(email, password) {
  if (!isCloudEnabled()) return { user: null, error: new Error('Cloud sync disabled') };
  try {
    const client = await getClient();
    if (!client) return { user: null, error: new Error('Cloud client unavailable') };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error) { _flushQueue().catch(() => {}); }
    return { user: data?.user || null, error: error || null };
  } catch (e) { return { user: null, error: e }; }
}

export async function signOut() {
  if (!isCloudEnabled()) return;
  try {
    const client = await getClient();
    if (!client) return;
    await client.auth.signOut();
  } catch { /* swallow */ }
}

export async function getSession() {
  if (!isCloudEnabled()) return { user: null, error: null };
  try {
    const client = await getClient();
    if (!client) return { user: null, error: new Error('Cloud client unavailable') };
    const user = await _getUser(client);
    return { user, error: null };
  } catch (e) { return { user: null, error: e }; }
}

export async function sendPasswordReset(email) {
  if (!isCloudEnabled()) return { error: new Error('Cloud sync disabled') };
  try {
    const client = await getClient();
    if (!client) return { error: new Error('Cloud client unavailable') };
    const { error } = await client.auth.resetPasswordForEmail(email);
    return { error: error || null };
  } catch (e) { return { error: e }; }
}

// --- read / write -------------------------------------------------------------
export async function pullProfile(userId) {
  if (!isCloudEnabled() || !userId) return { data: null, error: new Error('Cloud sync disabled') };
  try {
    const client = await getClient();
    if (!client) return { data: null, error: new Error('Cloud client unavailable') };
    const [profileRes, scoresRes, achRes, discRes] = await Promise.all([
      client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      client.from('high_scores').select('*').eq('user_id', userId),
      client.from('achievements').select('*').eq('user_id', userId),
      client.from('discoveries').select('*').eq('user_id', userId),
    ]);
    return {
      data: {
        profile: profileRes.data || null,
        highScores: scoresRes.data || [],
        achievements: achRes.data || [],
        discoveries: discRes.data || [],
      },
      error: null,
    };
  } catch (e) { return { data: null, error: e }; }
}

export async function pushHighScore(gameId, score) {
  if (!isCloudEnabled()) return { error: null };
  const op = { kind: 'highScore', gameId, score };
  try {
    const client = await getClient();
    if (!client) { _enqueue(op); return { error: null }; }
    const user = await _getUser(client);
    if (!user) { _enqueue(op); return { error: null }; }
    op.userId = user.id;
    const ok = await _executeOp(client, user.id, op);
    if (!ok) _enqueue(op);
    return { error: null };
  } catch (e) { _enqueue(op); return { error: e }; }
}

export async function pushAchievement(gameId, achievementId) {
  if (!isCloudEnabled()) return { error: null };
  const op = { kind: 'achievement', gameId, achievementId };
  try {
    const client = await getClient();
    if (!client) { _enqueue(op); return { error: null }; }
    const user = await _getUser(client);
    if (!user) { _enqueue(op); return { error: null }; }
    op.userId = user.id;
    const ok = await _executeOp(client, user.id, op);
    if (!ok) _enqueue(op);
    return { error: null };
  } catch (e) { _enqueue(op); return { error: e }; }
}

export async function pushDiscovery(gameId, key, data) {
  if (!isCloudEnabled()) return { error: null };
  const op = { kind: 'discovery', gameId, key, data };
  try {
    const client = await getClient();
    if (!client) { _enqueue(op); return { error: null }; }
    const user = await _getUser(client);
    if (!user) { _enqueue(op); return { error: null }; }
    op.userId = user.id;
    const ok = await _executeOp(client, user.id, op);
    if (!ok) _enqueue(op);
    return { error: null };
  } catch (e) { _enqueue(op); return { error: e }; }
}

// Walk a local profile's localStorage namespace and push every record up.
// Used after "upgrade local profile to cloud" so the player keeps their saves.
export async function migrateLocalToCloud(userId, localProfileId) {
  if (!isCloudEnabled()) return { error: new Error('Cloud sync disabled') };
  if (!userId || !localProfileId) return { error: new Error('Missing ids') };
  try {
    const prefix = 'wg:p:' + localProfileId + ':';
    const hsRe = /^hs:(.+)$/;
    const achRe = /^ach:(.+)$/;
    const codexRe = /^codex:(.+)$/;
    const labCombosRe = /^(.+):discoveredCombos$/;

    const tasks = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const suffix = k.slice(prefix.length);
      const raw = localStorage.getItem(k);
      if (raw == null) continue;
      // High scores
      let m = suffix.match(hsRe);
      if (m) {
        let parsed; try { parsed = JSON.parse(raw); } catch { continue; }
        tasks.push(pushHighScore(m[1], parsed));
        continue;
      }
      // Achievements: stored as array of IDs
      m = suffix.match(achRe);
      if (m) {
        let arr; try { arr = JSON.parse(raw); } catch { continue; }
        if (!Array.isArray(arr)) continue;
        for (const aid of arr) tasks.push(pushAchievement(m[1], aid));
        continue;
      }
      // Codex / discoveries (per-game)
      m = suffix.match(codexRe);
      if (m) {
        let parsed; try { parsed = JSON.parse(raw); } catch { continue; }
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [dk, dv] of Object.entries(parsed)) {
            tasks.push(pushDiscovery(m[1], dk, dv));
          }
        }
        continue;
      }
      // Mutation lab combos (game-namespaced)
      m = suffix.match(labCombosRe);
      if (m) {
        let arr; try { arr = JSON.parse(raw); } catch { continue; }
        if (Array.isArray(arr)) {
          for (const ck of arr) tasks.push(pushDiscovery(m[1], ck, null));
        }
        continue;
      }
    }
    await Promise.all(tasks);
    return { error: null };
  } catch (e) { return { error: e }; }
}

export function subscribeToChanges(userId, callback) {
  if (!isCloudEnabled() || !userId) return null;
  try {
    // Fire-and-forget — return a thin handle the caller can unsubscribe from.
    let channel = null;
    let unsubbed = false;
    (async () => {
      try {
        const client = await getClient();
        if (!client || unsubbed) return;
        channel = client
          .channel('wg-user-' + userId)
          .on('postgres_changes',
              { event: '*', schema: 'public', table: 'high_scores', filter: 'user_id=eq.' + userId },
              (payload) => { try { callback({ type: 'highScore', payload }); } catch {} })
          .on('postgres_changes',
              { event: '*', schema: 'public', table: 'achievements', filter: 'user_id=eq.' + userId },
              (payload) => { try { callback({ type: 'achievement', payload }); } catch {} })
          .on('postgres_changes',
              { event: '*', schema: 'public', table: 'discoveries', filter: 'user_id=eq.' + userId },
              (payload) => { try { callback({ type: 'discovery', payload }); } catch {} })
          .subscribe();
      } catch { /* swallow */ }
    })();
    return {
      unsubscribe() {
        unsubbed = true;
        try { channel && channel.unsubscribe(); } catch {}
      },
    };
  } catch { return null; }
}
