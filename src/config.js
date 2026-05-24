// =============================================================================
// WEB-GAMES CONFIG
//
// Edit these two values to enable optional cloud account sync.
// Get them from https://app.supabase.com -> your project -> Settings -> API
// Leave them empty to keep the game 100% local (default behavior).
//
// When both are non-empty:
//   - CLOUD_SYNC_ENABLED becomes true
//   - The hub login overlay shows a "CLOUD ACCOUNT" tab
//   - High scores / achievements / discoveries sync to Supabase per-account
// =============================================================================

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
export const CLOUD_SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
