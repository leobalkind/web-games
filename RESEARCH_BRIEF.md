# Research Brief: Reference Games & Polish Wishlist

> **STATUS (2026-05-24):** Most items in this brief shipped across v1.4 and the
> v1.5.0 → v1.5.5 polish series. See recent commits + the inline `// === Round
> NX ===` markers across `src/shared/*` and each `games/*/main.js` for what
> actually landed (kill-feed, grade card, achievements, settings menu, music
> tracks, mobile controls, cloud sync, etc.). Remaining items in this document
> are either explicitly punted to a later iteration or already covered by a
> close-enough equivalent — re-read against current code before re-implementing.

13 web-games audited against established indie/mobile reference titles. For each
game: top references, three concrete things those references do that **we do
not** currently, and a rough effort estimate (S = hours, M = a day or two,
L = multi-day refactor).

Existing systems noted (so we don't re-recommend what we already have):
bork-battle has level-up upgrade cards, pug-td has range previews on placement
and tower-buff towers, mutation-lab has a codex, pug-cafe has serve combos,
backrooms has sanity + jumpscares + hide spots + closet items.

---

## 1. bork-battle — top-down arena battle royale

**References:** Vampire Survivors, Brotato, Surviv.io / Zombsroyale.io

**What they do, that we don't:**
1. **Brotato's between-wave shop with rerolls + lock.** After every wave, drop
   into a 6-card shop (weapons + passives) priced by tier. Reroll button
   escalates in cost per click within the same shop; locking pins a card across
   rerolls. Adds long-term loadout planning beyond our current "pick 1 of 3 on
   level-up." Effort: **M**.
2. **Vampire Survivors weapon evolution.** Combining max-rank weapon + matching
   passive = an evolved variant (totally different behaviour). Gives every run
   a clear "build" goal beyond raw stat stacking. Effort: **M**.
3. **Surviv.io kill-feed + spectator killcam.** Top-right kill ticker ("Loaf
   borked Snoot with PISTOL") plus a 3-second post-death replay of who killed
   you and from where. Massive identity/legibility win for a 30-bot arena.
   Effort: **S** for kill-feed, **M** for replay.

---

## 2. pugfort — base defense day/night

**References:** Plants vs Zombies, They Are Billions, Castle Crashers

**What they do, that we don't:**
1. **PvZ's "almanac" + wave preview banner.** Before each night, show a banner
   listing zombie archetypes coming this wave with their icons/hp/speed. Lets
   the player plan turret loadout instead of reactively scrambling. Effort: **S**.
2. **They Are Billions wall-tier visuals.** Walls should visibly degrade — fresh
   plank → cracked → smoking debris — synced to HP, not just a damage number.
   Same for turrets (scorched barrels at <50%). We have wall HP but no visual
   tiering. Effort: **S**.
3. **PvZ between-level meta unlock.** Surviving night N permanently unlocks one
   new buildable (acid turret, mine, generator-shield) on the start screen.
   Gives reason to replay short runs and currently the only progression is
   highscore. Effort: **M**.

---

## 3. pug-heist — multi-floor stealth

**References:** Hotline Miami (top-down lethality), Hitman GO (cone vision &
patrol patterns), Monaco: What's Yours Is Mine (loot + multi-floor exit)

**What they do, that we don't:**
1. **Hitman GO turn-preview / Monaco's predictable patrols.** Show the human's
   *next* facing arc as a faint ghost cone, so peeking past a guard feels
   chess-like, not gambling. Our cones rotate but the player can't read intent.
   Effort: **S**.
2. **Monaco's loot tooltip + heat bar.** Each loot item shows value-on-hover
   *before* pickup, and a global "heat" bar fills with each suspicious action;
   guards' search radius scales with heat instead of binary alerted-or-not.
   Effort: **M**.
3. **Hotline Miami's restart-instant + score grade.** End-of-floor grade
   (S/A/B/C) based on time, loot %, undetected bonus, plus 1-keystroke
   restart-from-floor-start. Turns each floor into a leaderboard mini-puzzle.
   Effort: **S** for grade, **M** for mid-floor restart.

---

## 4. pugzilla — destruction sandbox

**References:** Tasty Planet (growth tiers), Rampage arcade, Crush the Castle

**What they do, that we don't:**
1. **Tasty Planet's explicit size-tier UI.** A "next form unlocks at X mass"
   progress bar with a preview silhouette of what you'll become. We have
   evolution but it's surprise-only; players don't know what's next or how
   close. Effort: **S**.
2. **Rampage's destruction combos / chain multiplier.** Smashing 3+ buildings
   within ~2s gives x2/x3/x4 score with a screen-shake spike and audible
   crowd-cheer SFX. Currently each smash is flat. Hugely amplifies the
   destruction power-fantasy. Effort: **S**.
3. **Crush the Castle's physical debris persistence.** Building chunks should
   fall, settle, *and stay* on the ground (with a budget cap to free old ones).
   Currently smashed buildings just vanish into particles — the city never
   visually accumulates damage. Effort: **M**.

---

## 5. supermarket-pug — single-floor stealth shopping

**References:** Untitled Goose Game, Supermarket Shriek, PowerWash Simulator
(checklist satisfaction loop)

**What they do, that we don't:**
1. **Goose Game's per-level checklist / to-do list.** A small pinned card:
   "steal a chicken, knock over 3 cans, escape without alert." Converts an
   amorphous shopping spree into discrete satisfying ticks. Effort: **S**.
2. **Goose Game's reactive NPC barks + animations.** When a guard sees the cart
   crash, they yell ("HEY!"), do a startle anim, then chase. Currently chase
   triggers with no character. Speech-bubble lines + 2-frame surprise animation
   add huge personality. Effort: **S**.
3. **Supermarket Shriek's physics-cart momentum.** Cart should have inertia and
   *knock down shelves on collision*, creating domino chains. We have a cart
   but it just speed-boosts. The toy is the chaos. Effort: **M**.

---

## 6. pug-td — tower defense

**References:** Bloons TD 6, Kingdom Rush, Plants vs Zombies 2

**What they do, that we don't:**
1. **Bloons TD's 2x/3x speed toggle + pause-and-build.** Players burn out on
   trickle-spawn waves at 1x. A simple speed multiplier button (1x/2x/3x) is
   table stakes for the genre and we don't have it. Effort: **S**.
2. **Kingdom Rush's "call next wave early" gold bonus.** Button to summon the
   next wave instantly during a calm period, granting bonus cash equal to the
   timer remaining. Adds risk/reward pacing and rewards experienced players.
   Effort: **S**.
3. **Bloons TD's tower upgrade tree (2-3 paths) instead of linear level-ups.**
   Each tower gets two upgrade branches (e.g., Sniper → "Crit" path or "Pierce"
   path) that visibly change the turret art. Currently `level + 0.15 dmg/range`
   is the only upgrade vector. Effort: **L**.

---

## 7. rocket-pug — arena shooter with rocket jumps

**References:** Rocket League (arena identity), Super Smash Bros (knockback +
last-pug-standing), Brawl Stars (gadget + super)

**What they do, that we don't:**
1. **Rocket League's goal celebration / replay.** When someone scores a kill,
   freeze frame for 1s with a "PWNED!" banner over the victim and a slow-zoom
   camera. Currently kills are silent except for SFX. Big juice for very little
   effort. Effort: **S**.
2. **Brawl Stars' "super" charge meter.** A meter that fills from hits dealt;
   when full, the next shot is a screen-clearing super (giant sausage spread,
   toast-storm). Gives a comeback mechanic and a moment-to-moment goal beyond
   raw aiming. Effort: **M**.
3. **Smash Bros' damage-driven knockback.** Knockback scales with target's
   accumulated damage — low-HP bots barely flinch, high-HP bots ragdoll across
   the kitchen. Makes finishing kills feel decisive. Effort: **S**.

---

## 8. dungeon-diggers — roguelite digger

**References:** Spelunky, SteamWorld Dig, Boulder Dash, Downwell

**What they do, that we don't:**
1. **SteamWorld Dig's between-run meta-shop on the surface.** Sell loot on
   surface for permanent upgrades (bigger lantern, +1 max stam) carried into
   the next run. Currently money/upgrades reset every run = no progression
   hook. Effort: **M**.
2. **Spelunky's shopkeeper / risk-reward NPC.** A friendly digger NPC sells one
   premium item per layer; you can pay or murder & steal (which spawns angry
   guard pugs that hunt you for the rest of the run). Memorable mechanic.
   Effort: **M**.
3. **Spelunky's "bombable wall" hidden secrets + Downwell combo system.**
   Cracked walls hide treasure rooms; combo counter rewards uninterrupted digs
   (every 5 tiles in a chain = bonus). Both add depth to the core verb of
   "dig." Effort: **S** for cracks, **S** for combo meter.

---

## 9. delivery-pugs — top-down delivery driving

**References:** Crazy Taxi, Mini Motorways (clean readability), Death Stranding
(precious cargo)

**What they do, that we don't:**
1. **Crazy Taxi's directional arrow + countdown overlay.** A large arrow
   pointing toward the next delivery + ETA-style "time-to-marker" estimate.
   Players currently squint for the marker on the minimap-less open world.
   Effort: **S**.
2. **Crazy Taxi's "Crazy Drift" bonus + score multiplier escalation.** Long
   skids, near-misses, and aerial jumps award bonus cash and stack a multiplier
   visible on-screen. We have skid marks visually but no scoring payoff.
   Effort: **S**.
3. **Death Stranding's cargo-fragility / package-care mechanic.** Each delivery
   has a "freshness" or "intact" bar that drains with crashes; perfect
   delivery = bonus payout. Adds a careful-driving challenge counterbalancing
   nitro-spam. Effort: **M**.

---

## 10. floor-lava — vertical platformer

**References:** Doodle Jump, Icy Tower, Geometry Dash (rhythm/visual escalation)

**What they do, that we don't:**
1. **Doodle Jump's enemy / projectile variety scaling with height.** Enemies
   that fly across, must be jumped on or shot, scaling difficulty as the player
   climbs. Currently we just have spikes + crumble platforms — same threats
   at height 100 and height 1000. Effort: **M**.
2. **Icy Tower's "combo jumps" score system.** Chaining N platform-to-platform
   jumps without touching the ground/wall awards escalating "COMBO! x5"
   popups. Skill expression beyond just survival. Effort: **S**.
3. **Geometry Dash's biome-shift checkpoints.** Every 500m, the wall art / lava
   colour / music subtly changes (cave → magma cavern → hellscape). Gives a
   sense of *progression* in an endless climber. Our cave palette never
   changes. Effort: **S**.

---

## 11. mutation-lab — 3-ingredient discovery

**References:** Little Alchemy 2, Doodle God, Cookie Clicker (idle reward
satisfaction)

**What they do, that we don't:**
1. **Little Alchemy 2's "show me what ingredients I haven't used yet" filter.**
   Toggle to dim already-tried-with-everything ingredients, highlighting
   under-explored ones. Helps players past the mid-game wall when ~30% of
   combos are found. Effort: **S**.
2. **Doodle God's category-completion bars + per-tier rewards.** "8/12
   COMMON found" with a small reward (cosmetic icon, particle effect) at
   100% per tier. Codex grids alone aren't a *reward* — milestones are.
   Effort: **S**.
3. **Little Alchemy's optional hint system with a cost.** Spend in-game
   currency (which we'd add: "DNA" earned per discovery) to reveal one
   ingredient of an undiscovered combo. Prevents brute-force burnout.
   Effort: **M** (needs currency layer).

---

## 12. pug-cafe — time-management

**References:** Diner Dash, Overcooked / Overcooked 2, Cooking Mama

**What they do, that we don't:**
1. **Overcooked 2's throw mechanic + on-counter prep stations.** Throw plated
   food to the counter instead of walk-and-place. We have stations but no
   spatial movement / spatial mistakes — adding even a simple "drag-to-throw"
   between two stations doubles the chaos. Effort: **M**.
2. **Diner Dash's table-color matching chain bonuses.** Seating two
   matching-color customers at adjacent tables = chain bonus. We have a serve
   combo but no *placement* puzzle. Adds a planning layer. Effort: **S**.
3. **Overcooked's "burnt food" failure state.** Items left too long at a
   station catch fire (smoke alarm SFX + must-be-discarded). Currently
   ingredients have no decay — the only timer is the customer's. A second
   timer ratchets tension. Effort: **S**.

---

## 13. backrooms-pug — top-down horror

**References:** The Backrooms wiki/community lore, Apartment 327, Iron Lung
(audio-driven dread)

**What they do, that we don't:**
1. **Backrooms-canon "noclip to next level" portal mechanic.** Hitting the exit
   shouldn't just end the run — it should noclip you to a *new level archetype*
   with escalating threat. Levels 0 → 1 → 2 → ... as a literal run progression.
   We have the archetypes; we don't chain them. Effort: **M**.
2. **Iron Lung-style audio sting / proximity audio cues.** Monster footsteps
   should pan stereo + scale volume with distance; ambient hums should change
   pitch as sanity drops. We have buzzes but no spatial mixing. Massive horror
   immersion for low effort. Effort: **S**.
3. **Backrooms-community "found notes / lore fragments" collectibles.** Scraps
   of text on walls/floor — readable lore that builds a meta-story across
   runs. Horror fans expect this. Pairs with a "notes found: 4/30" stat on the
   end screen. Effort: **S**.

---

## Cross-game patterns worth standardizing

A few wins apply to **multiple** games and should be built once as shared
utilities in `src/shared/`:

- **Speed-toggle button** (pug-td, pugfort, pug-cafe, bork-battle waves).
- **End-of-run grade card** (S/A/B/C with breakdown) — fits heist, supermarket,
  rocket-pug, delivery-pugs, dungeon-diggers.
- **Persistent meta-currency** ("kibble" / "DNA" / "scrap") for between-run
  unlocks — would benefit dungeon-diggers, pugfort, mutation-lab, bork-battle.
- **Kill-feed / event-ticker component** — bork-battle, rocket-pug, pugzilla,
  pug-cafe (orders complete), delivery-pugs (deliveries) all benefit from a
  scrolling event log.
- **"Next wave preview" / "incoming" banner** — pugfort and pug-td.

Each of these is a single shared module unlocking polish across 4-5 games.

---

**Total scope estimate at S/M-only items: ~60-80 hours.** Prioritising
cross-game shared utilities first (speed toggle, grade card, kill-feed) yields
the broadest visible polish per hour invested.
