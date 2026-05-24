# Cloud Sync Setup (Supabase)

Web-Games is **local-only by default** — every score, achievement and discovery
lives in your browser's `localStorage`. If you want cross-device sync (play on
your laptop, pick up on your phone), follow this guide to wire in your own
free Supabase project.

The whole flow is feature-flagged: leave `src/config.js` empty and the app
behaves exactly as it does today.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up (free tier is fine).
2. Click **New project**. Pick a name (e.g. `web-games`), a strong DB password,
   and the region closest to your players.
3. Wait ~1 minute for the project to provision.

## 2. Grab your URL and anon key

1. In your project dashboard, click the gear icon (**Project Settings**).
2. Open **API**.
3. Copy two values:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (the long JWT under "Project API keys")

> The anon key is safe to ship to the browser. Row Level Security (set up in
> step 4 below) is what actually protects user data.

## 3. Paste them into `src/config.js`

Open `src/config.js` and fill in the two strings:

```js
export const SUPABASE_URL = 'https://abcd1234.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...your-anon-key...';
export const CLOUD_SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
```

That's the **only** file you need to edit. Restart the dev server / rebuild
and the login screen will show a new `CLOUD ACCOUNT` tab on the next load.

## 4. Run the schema SQL

In your Supabase dashboard, open **SQL Editor** → **+ New query**. Paste the
entire block below and click **Run**. This creates the four tables, locks
them down with Row Level Security, and adds a trigger that auto-creates a
profile row whenever someone signs up.

```sql
-- Profiles
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- High scores
create table public.high_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  score jsonb not null,
  updated_at timestamptz default now() not null,
  primary key (user_id, game_id)
);

-- Achievements
create table public.achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  achievement_id text not null,
  unlocked_at timestamptz default now() not null,
  primary key (user_id, game_id, achievement_id)
);

-- Discoveries (mutation lab combos, lore notes, etc)
create table public.discoveries (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  discovery_key text not null,
  data jsonb,
  found_at timestamptz default now() not null,
  primary key (user_id, game_id, discovery_key)
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.high_scores enable row level security;
alter table public.achievements enable row level security;
alter table public.discoveries enable row level security;

-- Policies: users can only read/write their own rows
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own scores" on public.high_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own achievements" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own discoveries" on public.discoveries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile row on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## 5. (Optional) Tweak Auth settings

Defaults are fine for casual use, but you may want to:

- **Authentication → Providers**: disable email confirmation if you want
  instant sign-up during testing (Supabase calls this "Confirm email").
- **Authentication → URL Configuration**: add your production URL to the
  Site URL allow-list so password-reset links work.

## 6. Done

Reload the hub. On the login screen you'll see a new **CLOUD ACCOUNT** tab.
Create an account, then any high score / achievement / discovery saved while
you're signed in will sync across every device you sign in from.

### How it works

- The Supabase SDK loads **lazily** (only after the user clicks Sign In) so the
  initial JS bundle stays small for local-only players.
- Writes are local-first: localStorage is updated immediately, then cloud
  push happens in the background. If the device is offline, writes are queued
  at `localStorage['wg:cloud:queue']` and replayed on reconnect.
- Existing local profiles can be promoted via the **UPGRADE LOCAL PROFILE TO
  CLOUD** button on the cloud tab — it creates a Supabase account and uploads
  every existing high score / achievement / discovery to your new account.

### Disabling

Just blank out the values in `src/config.js` and rebuild. The app reverts to
100% local mode. No code changes needed.
