# Improvement Backlog — 300 Items

> Scoped against current code as of v1.5.5+. Items already shipped in the
> v1.4 → v1.5.x polish series (kill-feed, grade card, achievements, settings
> menu, speed toggle, cloud sync, mobile controls, wave preview, music tracks,
> sanity/jumpscare polish, tornado loot, killcam, etc.) are NOT re-listed here.
> See `RESEARCH_BRIEF.md` for context on prior work.
>
> Each item: ID, topic, one-line description, effort (S = hours, M = a day,
> L = multi-day), category. Categories: BUG / VISUAL / GAMEPLAY / UI / UX /
> AUDIO / MOBILE / PERF / META.
>
> 14 in-arena games × ~20 items = 280 + 20 site-wide = 300 total.
> `clown-forest` is intentionally excluded (5 polish agents currently active).

---

## 1. bork-battle (20)

- **BORK-001** Brotato shop — between-wave card-buy with reroll/lock so loadouts feel planned. Effort: M. GAMEPLAY.
- **BORK-002** Weapon evolution — pistol+leech passive → "Sangue Pistol" with healing bullets, etc. (4 evos). Effort: M. GAMEPLAY.
- **BORK-003** Killcam — 2.5s slow-mo replay from killer's POV when player dies. Effort: M. UX.
- **BORK-004** Bot personality barks — bots shout taunts on kill ("get borked nerd!") from `funnyText.js`. Effort: S. AUDIO.
- **BORK-005** Treat magnet upgrade card — pulls money/treats from a radius. Effort: S. GAMEPLAY.
- **BORK-006** Late-wave elite bot — single boss-pug per wave 5+ with shield + 3x HP. Effort: M. GAMEPLAY.
- **BORK-007** Audio ducking — drop music to 30% when bork ability fires so the boom hits. Effort: S. AUDIO.
- **BORK-008** Damage numbers stacking — combine same-target dmg within 0.3s into one larger float. Effort: S. VISUAL.
- **BORK-009** Tornado loot tier-up — chance of legendary weapon variant in tornado after 2-min mark. Effort: S. GAMEPLAY.
- **BORK-010** Player accent ring — render aim cone (faint) when sniper equipped. Effort: S. UI.
- **BORK-011** Bot-type minimap dots colored by hat (queen=gold, medic=red, etc.). Effort: S. UI.
- **BORK-012** Decoy AI improvement — bots should ignore decoy after 1.5s if no damage source. Effort: S. BUG.
- **BORK-013** Audience pug reactions — louder cheer when player chains 5+ kills. Effort: S. AUDIO.
- **BORK-014** Pickup pulse-ring upgrade — passive that emits AoE pulse on weapon-pickup. Effort: S. GAMEPLAY.
- **BORK-015** Mobile aim assist — soft snap to nearest bot within 18° on touch fire. Effort: M. MOBILE.
- **BORK-016** Daily seed mode — same map, same bot spawns, leaderboard per day. Effort: M. META.
- **BORK-017** Audio: bork ability charged SFX — quiet hum that grows to a release click. Effort: S. AUDIO.
- **BORK-018** Cosmetic shop unlock — earn coins per match, spend on player-side hats. Effort: M. META.
- **BORK-019** "Sticky" weapon-drop label — hold the floating "+SHOTGUN" pip 3s instead of 1s. Effort: S. UI.
- **BORK-020** Death replay: top 3 borks of the run shown on end screen. Effort: M. UX.

## 2. pugfort (20)

- **FORT-001** Almanac modal — list enemy archetypes (icon/HP/spd) reachable from main menu. Effort: S. UI.
- **FORT-002** Wall HP visual tiering — 100%/66%/33% sprite variants instead of damage number. Effort: S. VISUAL.
- **FORT-003** Permanent meta-unlock per night survived — acid turret, generator-shield, mine. Effort: M. META.
- **FORT-004** Build-grid snap line preview — show ghost outline while placing. Effort: S. UX.
- **FORT-005** Refund button — recoup 50% if structure has full HP, 25% if damaged. Effort: S. GAMEPLAY.
- **FORT-006** Repair-all hotkey (R) — auto-repair all damaged walls/turrets for total cost. Effort: S. UX.
- **FORT-007** Wave intermission shop — buy stat upgrades (turret dmg +5%, wall HP +20). Effort: M. GAMEPLAY.
- **FORT-008** Boss-night every 5 waves — single mega-zombie with attack pattern. Effort: M. GAMEPLAY.
- **FORT-009** Day-time scavenge mini-mode — go OUT of fort to grab materials, optional. Effort: L. GAMEPLAY.
- **FORT-010** Turret targeting modes — first/last/strongest/weakest dropdown per turret. Effort: M. GAMEPLAY.
- **FORT-011** Mute audience cheer SFX option in settings (some find it loud). Effort: S. AUDIO.
- **FORT-012** Mobile tap-to-build — pick from a 4-tab radial menu instead of dragging. Effort: M. MOBILE.
- **FORT-013** Weather event nights — rain slows zombies, fog reduces turret range. Effort: M. GAMEPLAY.
- **FORT-014** Auto-pause on tab-out + restore — currently zombies keep walking. Effort: S. BUG.
- **FORT-015** Visual fog-of-war reveal — fade in dark band when zombies enter screen edge. Effort: S. VISUAL.
- **FORT-016** Show next-wave preview banner permanently (current is timed). Effort: S. UI.
- **FORT-017** Hot-swap tower upgrade cards — chosen instantly upgrades nearest tower. Effort: M. GAMEPLAY.
- **FORT-018** Sound: bone-crunch when zombie hits wall — currently just generic thud. Effort: S. AUDIO.
- **FORT-019** Endless mode toggle — disable win condition, lean into highscore chasing. Effort: S. META.
- **FORT-020** Sprite-pack alt skins (medieval/sci-fi/winter) — palette swap, not new geometry. Effort: M. VISUAL.

## 3. pug-heist (20)

- **HEIST-001** Guard ghost-cone preview — show next-second of cone arc, faint outline. Effort: S. GAMEPLAY.
- **HEIST-002** Loot value tooltip-on-hover. Effort: S. UI.
- **HEIST-003** Heat meter replacing binary alerted-state. Effort: M. GAMEPLAY.
- **HEIST-004** Quick-restart-from-floor-start key (R). Effort: M. UX.
- **HEIST-005** Floor grade card S/A/B/C with breakdown — uses shared `gradeCard.js`. Effort: S. UX.
- **HEIST-006** Distraction throwable — toss a chew-toy, guard turns to investigate. Effort: M. GAMEPLAY.
- **HEIST-007** Ventilation crawl tiles — slower but invisible to guards. Effort: M. GAMEPLAY.
- **HEIST-008** Time-attack mode — beat each floor under a par time. Effort: S. META.
- **HEIST-009** Hire-a-pug ally — pay coins to bring a bark-distractor pup. Effort: M. GAMEPLAY.
- **HEIST-010** Mobile control: tap-to-move waypoint instead of joystick. Effort: M. MOBILE.
- **HEIST-011** Footstep audio louder/quieter on tile material (carpet vs marble). Effort: S. AUDIO.
- **HEIST-012** Guards: shared radio — one spots, all alerted within 8 tiles. Effort: M. GAMEPLAY.
- **HEIST-013** Cinematic intro per floor — 1.5s pan over the floor showing loot/guards. Effort: S. VISUAL.
- **HEIST-014** Floor-blueprint screen on briefing — see layout for 3s before run. Effort: S. UI.
- **HEIST-015** Loot count chip top-right showing % collected this floor. Effort: S. UI.
- **HEIST-016** Mask/disguise pickup — walk past one specific guard without detection. Effort: M. GAMEPLAY.
- **HEIST-017** End-of-floor "exit zone" pulse — currently easy to miss. Effort: S. UI.
- **HEIST-018** Daily heist — fixed floor + seed leaderboard. Effort: M. META.
- **HEIST-019** Tutorial: 30s intro floor with text overlays explaining cones. Effort: S. UX.
- **HEIST-020** Audio: heartbeat thump when within guard cone for 1s+. Effort: S. AUDIO.

## 4. pug-cafe (20)

- **CAFE-001** Throw-plate mechanic — drag from station to order zone for combo bonus. Effort: M. GAMEPLAY.
- **CAFE-002** Adjacent-table chain bonus — same color customer pair = chain. Effort: S. GAMEPLAY.
- **CAFE-003** Burnt-food failure state — ingredients spoil if untouched 8s. Effort: S. GAMEPLAY.
- **CAFE-004** Sous-chef hireable — auto-grabs one ingredient per 4s. Effort: M. GAMEPLAY.
- **CAFE-005** Customer mood emoji speech bubble — happier expressions on bonus tip. Effort: S. VISUAL.
- **CAFE-006** Order priority pin — pin one order to always show first. Effort: S. UI.
- **CAFE-007** Café renovation modal — spend earnings on new decor (4 themes). Effort: M. META.
- **CAFE-008** End-of-shift receipt animation — print out totals dramatically. Effort: S. VISUAL.
- **CAFE-009** Customer barks per type ("WHERE'S MY LATTE!" for KAREN). Effort: S. AUDIO.
- **CAFE-010** Time-toggle (1x/2x) so rush hour goes faster. Effort: S. UX.
- **CAFE-011** Mobile: pinch-zoom on order list when too cramped. Effort: M. MOBILE.
- **CAFE-012** Daily special as a multi-recipe combo (3 ingredients chained). Effort: M. GAMEPLAY.
- **CAFE-013** Background ambience: barista milk-steam SFX every 12s. Effort: S. AUDIO.
- **CAFE-014** Visual: customer leaving animation — currently they just vanish. Effort: S. VISUAL.
- **CAFE-015** Achievement: serve 50 perfect orders in a single shift. Effort: S. META.
- **CAFE-016** Tutorial: first-time-only 10s overlay showing the grab→serve loop. Effort: S. UX.
- **CAFE-017** Multi-customer tipping spree — bonus if 4 customers tip within 5s. Effort: S. GAMEPLAY.
- **CAFE-018** Café staff portraits with name tags (chef pug, manager). Effort: S. UI.
- **CAFE-019** End screen: "best dish today" + customer rating quote. Effort: S. UX.
- **CAFE-020** Persistent kitchen upgrade tree (faster oven, bigger ice machine). Effort: M. META.

## 5. rocket-pug (20)

- **ROCKET-001** Brawl-Stars super meter — fills from hits, releases screen-clear. Effort: M. GAMEPLAY.
- **ROCKET-002** Damage-driven knockback — high-HP bots ragdoll, low-HP barely flinch. Effort: S. GAMEPLAY.
- **ROCKET-003** Goal-celebration killcam — 1s freeze on victim + slow zoom. (PWN exists; this expands.) Effort: S. UX.
- **ROCKET-004** Arena weather effects — rain reduces visibility, wind pushes projectiles. Effort: M. GAMEPLAY.
- **ROCKET-005** 3 new weapons — bouncy meatball, slow-but-piercing skewer, bork-bomb. Effort: M. GAMEPLAY.
- **ROCKET-006** Best-of-3 series — instead of 1 sudden death; reuse seriesLen. Effort: S. META.
- **ROCKET-007** Visual: jetpack heat-shimmer behind player during burst. Effort: S. VISUAL.
- **ROCKET-008** Audio: per-weapon sub-bass on hit (sniper = boom, AR = pop). Effort: S. AUDIO.
- **ROCKET-009** Bot variety — 3 new bot archetypes (sniper, brawler, runner). Effort: M. GAMEPLAY.
- **ROCKET-010** Arena hazard intensity dial — settings option (low/med/high). Effort: S. UX.
- **ROCKET-011** Mobile: gyro-aim toggle. Effort: M. MOBILE.
- **ROCKET-012** Game-end highlight reel — auto-pick 3 best kills from match. Effort: M. UX.
- **ROCKET-013** Achievement: 3 kills with one bork-bomb. Effort: S. META.
- **ROCKET-014** Visual: bullet-time on last bot remaining. Effort: S. VISUAL.
- **ROCKET-015** Custom skin loadout from coins earned. Effort: M. META.
- **ROCKET-016** UI: shot-counter HUD chip (ammo as pips not text). Effort: S. UI.
- **ROCKET-017** Pug roster expansion — 4 unlockable pug variants with stat tweaks. Effort: M. META.
- **ROCKET-018** Arena: rooftop wind gusts that push every 6s. Effort: S. GAMEPLAY.
- **ROCKET-019** Tutorial: 15s aim-and-shoot drill before first match. Effort: S. UX.
- **ROCKET-020** Audio: post-match victory fanfare per arena. Effort: S. AUDIO.

## 6. dungeon-diggers (20)

- **DIG-001** Surface meta-shop — spend loot for permanent upgrades. Effort: M. META.
- **DIG-002** Shopkeeper NPC — risk-reward steal mechanic. Effort: M. GAMEPLAY.
- **DIG-003** Bombable cracked walls hiding treasure rooms. Effort: S. GAMEPLAY.
- **DIG-004** Dig-combo meter — uninterrupted digs grow streak. Effort: S. UX.
- **DIG-005** New tile type: glowing crystal (3x value, audible chime). Effort: S. GAMEPLAY.
- **DIG-006** Enemy variety pass — 3 new layer-2 enemies (worm, beetle, bat). Effort: M. GAMEPLAY.
- **DIG-007** Stamina-recharge well on layer transitions. Effort: S. GAMEPLAY.
- **DIG-008** Map snapshot button — costs a coin, reveals 5x5 around player. Effort: S. UX.
- **DIG-009** Layer-themed palette (cave→ice→hellfire). Effort: S. VISUAL.
- **DIG-010** Death-recap screen — show your deepest depth + cause. Effort: S. UX.
- **DIG-011** Mobile: bigger dig-direction touch zones. Effort: S. MOBILE.
- **DIG-012** Daily seed challenge with depth leaderboard. Effort: M. META.
- **DIG-013** Pickaxe upgrade chain — wood/stone/iron/diamond, each digs harder rock. Effort: M. GAMEPLAY.
- **DIG-014** Sound: dirt-crumble per tile breaks reuse the same SFX — vary 4 samples. Effort: S. AUDIO.
- **DIG-015** Treasure chest mini-puzzle (3-pip lock-pick) on layer-5+. Effort: M. GAMEPLAY.
- **DIG-016** Stamina HUD becomes flashing red below 20%. Effort: S. UI.
- **DIG-017** Achievement: dig 1000 tiles in one run. Effort: S. META.
- **DIG-018** Light-flicker SFX paired with lantern dim. Effort: S. AUDIO.
- **DIG-019** Auto-save resume — close tab mid-run, come back where you left off. Effort: M. META.
- **DIG-020** Mineral codex — every gem found gets a Pokédex-style entry. Effort: S. META.

## 7. mutation-lab (20)

- **LAB-001** Hint system using a new DNA currency earned per discovery. Effort: M. GAMEPLAY.
- **LAB-002** Category completion bars + per-tier cosmetic reward. Effort: S. META.
- **LAB-003** Dim already-exhausted ingredients filter. Effort: S. UI.
- **LAB-004** "Mutation of the day" — daily seed for shared challenge. Effort: M. META.
- **LAB-005** Animated combine reaction — bubbles/sparks on mix. Effort: S. VISUAL.
- **LAB-006** Codex search filter (by tier, by family). Effort: S. UI.
- **LAB-007** Sound: chemistry-bubble loop while ingredient is in beaker. Effort: S. AUDIO.
- **LAB-008** Auto-save discovered combos to localStorage (already exists; ensure cloud sync). Effort: S. BUG.
- **LAB-009** Codex export — JSON download of your finds. Effort: S. META.
- **LAB-010** Mobile: 2-finger pinch zoom on ingredient grid. Effort: M. MOBILE.
- **LAB-011** Random "splat" mini-game between mutations (mash for bonus DNA). Effort: M. GAMEPLAY.
- **LAB-012** Visual: each tier's icon style escalates (common = flat, legendary = animated). Effort: S. VISUAL.
- **LAB-013** Achievement: discover all 4 founder ingredients first. Effort: S. META.
- **LAB-014** Tutorial: highlight Combine button on first ingredient added. Effort: S. UX.
- **LAB-015** Particle burst per discovery scales with rarity. Effort: S. VISUAL.
- **LAB-016** Recipe-book mode — reverse: show output, guess ingredients. Effort: M. GAMEPLAY.
- **LAB-017** Discovery diary — text log of last 20 finds. Effort: S. META.
- **LAB-018** Sound: legendary discovery = orchestral hit. Effort: S. AUDIO.
- **LAB-019** Codex completion percentage as HUD chip top-right. Effort: S. UI.
- **LAB-020** Share screenshot of codex grid (canvas → PNG download). Effort: M. META.

## 8. delivery-pugs (20)

- **DELIV-001** Crazy-Drift bonus scoring — long skids stack a visible multiplier. Effort: S. GAMEPLAY.
- **DELIV-002** Package fragility bar — perfect-delivery bonus payout. Effort: M. GAMEPLAY.
- **DELIV-003** Directional arrow already exists; make countdown ETA more prominent. Effort: S. UI.
- **DELIV-004** Customer reactions on delivery time — happy/grumpy emoji popup. Effort: S. VISUAL.
- **DELIV-005** Vehicle upgrade shop — buy nitro tanks, brake quality. Effort: M. META.
- **DELIV-006** Time-of-day cycle — night map with headlights, harder visibility. Effort: M. GAMEPLAY.
- **DELIV-007** NPC traffic that brake/honk. Effort: M. GAMEPLAY.
- **DELIV-008** Route preview line on minimap before pickup. Effort: S. UI.
- **DELIV-009** Pedestrian dodge bonus — slow-mo dramatic moment. Effort: S. VISUAL.
- **DELIV-010** Three vehicle types (scooter/van/truck) different handling. Effort: M. GAMEPLAY.
- **DELIV-011** Mobile: gyro steering option. Effort: M. MOBILE.
- **DELIV-012** Achievement: 5 perfect deliveries in a row. Effort: S. META.
- **DELIV-013** Engine SFX pitched to speed instead of looped flat. Effort: S. AUDIO.
- **DELIV-014** Daily delivery route challenge. Effort: M. META.
- **DELIV-015** Stats screen — total deliveries, distance, perfect%. Effort: S. UI.
- **DELIV-016** Pickup magnet upgrade — pull packages within 30px. Effort: S. GAMEPLAY.
- **DELIV-017** Music adapts: chill in low-traffic, intense during chase. Effort: S. AUDIO.
- **DELIV-018** Crash recovery time — 2s tumble before resume. Effort: S. GAMEPLAY.
- **DELIV-019** Tutorial: first delivery has guide arrow + slow time. Effort: S. UX.
- **DELIV-020** Side-quest delivery types — pizza (cold = penalty), birthday cake (no crashes). Effort: M. GAMEPLAY.

## 9. pugzilla (20)

- **ZILLA-001** Size-tier progress UI with next-form silhouette. Effort: S. UI.
- **ZILLA-002** Destruction combo system — chained smashes give x2/x3/x4 score. Effort: S. GAMEPLAY.
- **ZILLA-003** Debris persistence (capped at ~50 chunks) for visible accumulation. Effort: M. VISUAL.
- **ZILLA-004** New form: kaiju-deluxe at 5000 mass with laser breath. Effort: M. GAMEPLAY.
- **ZILLA-005** Tank/jet enemy AI patterns that strafe + bomb. Effort: M. GAMEPLAY.
- **ZILLA-006** Civilian flee animation panic groups when zilla nears. Effort: S. VISUAL.
- **ZILLA-007** City variant — Tokyo / NYC / Paris cosmetic palette swap. Effort: M. VISUAL.
- **ZILLA-008** Achievement: smash 100 buildings in a single run. Effort: S. META.
- **ZILLA-009** Boss-mech encounter at 3000 mass. Effort: L. GAMEPLAY.
- **ZILLA-010** Camera zooms OUT smoothly as you grow (currently snaps). Effort: S. VISUAL.
- **ZILLA-011** Mobile: swipe-direction movement instead of joystick. Effort: M. MOBILE.
- **ZILLA-012** Sound: city-siren wail from 1000+ mass onward. Effort: S. AUDIO.
- **ZILLA-013** Pickup: power-pellet (temporary 2x smash damage). Effort: S. GAMEPLAY.
- **ZILLA-014** Slow-mo on final building of run. Effort: S. VISUAL.
- **ZILLA-015** Save best mass + form per session — show on end. Effort: S. META.
- **ZILLA-016** Tutorial: first 10s zoom-out shows you're growing. Effort: S. UX.
- **ZILLA-017** Multiple bite SFX variants (currently 1-shot). Effort: S. AUDIO.
- **ZILLA-018** Earthquake screen shake scales with mass. Effort: S. VISUAL.
- **ZILLA-019** Hazard: oil tanker — chain explosion when smashed. Effort: M. GAMEPLAY.
- **ZILLA-020** Endless mode hold-the-button after final form. Effort: S. GAMEPLAY.

## 10. backrooms-pug (2D) (20)

- **BACK2D-001** Noclip portal — exit goes to next level archetype, not end. Effort: M. GAMEPLAY.
- **BACK2D-002** Lore-note collectibles with run-persistent count. Effort: S. META.
- **BACK2D-003** Spatial audio for monster footsteps (stereo pan). Effort: S. AUDIO.
- **BACK2D-004** Sanity-tied music pitch-shift. Effort: S. AUDIO.
- **BACK2D-005** New level variant — Level 1 corridors (taller walls, darker). Effort: M. GAMEPLAY.
- **BACK2D-006** Hide-spot stamina meter — can't stay in closet forever. Effort: S. GAMEPLAY.
- **BACK2D-007** Monster sees flashlight beam if pointed at it directly. Effort: S. GAMEPLAY.
- **BACK2D-008** Sprint with stam-drain key. Effort: S. GAMEPLAY.
- **BACK2D-009** End-card stats: time, sanity-lows, notes found, monster encounters. Effort: S. UX.
- **BACK2D-010** Daily seed — same maze + monster path, leaderboard. Effort: M. META.
- **BACK2D-011** Mobile: tap-to-move waypoint. Effort: M. MOBILE.
- **BACK2D-012** Achievement: escape without taking damage. Effort: S. META.
- **BACK2D-013** Settings: jumpscare intensity slider (off/light/full). Effort: S. UX.
- **BACK2D-014** Door system — slam doors to slow monster. Effort: M. GAMEPLAY.
- **BACK2D-015** Lighting: ceiling-flicker pattern more random. Effort: S. VISUAL.
- **BACK2D-016** Almond-water item that restores sanity. Effort: S. GAMEPLAY.
- **BACK2D-017** Multi-monster level — two slower entities instead of one fast. Effort: M. GAMEPLAY.
- **BACK2D-018** Tutorial card: hide spots blink first time you near one. Effort: S. UX.
- **BACK2D-019** Sound: corridor wind hum baseline always present. Effort: S. AUDIO.
- **BACK2D-020** Visual: blood-smear walls appear after first death. Effort: S. VISUAL.

## 11. floor-lava (20)

- **LAVA-001** Enemy variety scaling with height — flying enemies above 500m. Effort: M. GAMEPLAY.
- **LAVA-002** Combo-jumps score with COMBO! popups. Effort: S. GAMEPLAY.
- **LAVA-003** Biome-shift checkpoints every 500m — visible palette swap. Effort: S. VISUAL.
- **LAVA-004** Platform type: ICE SHARD — instakill on landing without shrink. Effort: S. GAMEPLAY.
- **LAVA-005** New powerup — magnet (pulls treats from 200px radius). Effort: S. GAMEPLAY.
- **LAVA-006** Background parallax 4th layer (clouds). Effort: S. VISUAL.
- **LAVA-007** Mobile: jump button bigger + autofire on touch-hold. Effort: S. MOBILE.
- **LAVA-008** Daily seed mode with shared leaderboard. Effort: M. META.
- **LAVA-009** Bat AI: dive on player from above instead of horizontal. Effort: S. GAMEPLAY.
- **LAVA-010** Fireball homing variant in HELL biome. Effort: S. GAMEPLAY.
- **LAVA-011** Audio: lava-bubble pop variations (currently 1 SFX). Effort: S. AUDIO.
- **LAVA-012** Pause overlay — show altitude + score progress. Effort: S. UI.
- **LAVA-013** Achievement: reach 2000m without dying. Effort: S. META.
- **LAVA-014** Settings: low-flash mode for accessibility. Effort: S. UX.
- **LAVA-015** Endless mode "speedrun" — race to 1000m timer. Effort: S. GAMEPLAY.
- **LAVA-016** Visual: pug squash MORE on landing for game-feel. Effort: S. VISUAL.
- **LAVA-017** Bonus pickup: gold platform that gives +200 score on touch. Effort: S. GAMEPLAY.
- **LAVA-018** Audio: per-biome ambient hum (cave drip vs void wind). Effort: S. AUDIO.
- **LAVA-019** Tutorial: first 100m has arrow showing wall-jump direction. Effort: S. UX.
- **LAVA-020** Bonus mode: gravity flip every 500m. Effort: M. GAMEPLAY.

## 12. supermarket-pug (20)

- **MART-001** Per-level checklist card (steal X, knock Y). Effort: S. UX.
- **MART-002** NPC reactive barks ("HEY!") + 2-frame startle anim. Effort: S. VISUAL.
- **MART-003** Cart physics — knock-down shelves on collision. Effort: M. GAMEPLAY.
- **MART-004** End-screen S/A/B/C grade using shared module. Effort: S. UX.
- **MART-005** Customer NPCs that wander — not just guards. Effort: M. GAMEPLAY.
- **MART-006** Three store layouts unlocked by score milestones. Effort: M. META.
- **MART-007** Aisle-themed loot (frozen aisle = ice cream, etc.). Effort: S. VISUAL.
- **MART-008** Cart upgrade shop — faster, quieter, bigger. Effort: M. META.
- **MART-009** Mobile: tap-to-grab item highlight. Effort: S. MOBILE.
- **MART-010** Achievement: escape with 20+ items. Effort: S. META.
- **MART-011** Audio: PA-system announcement triggers ("clean-up aisle 3"). Effort: S. AUDIO.
- **MART-012** Time-attack mode (escape under X seconds). Effort: S. GAMEPLAY.
- **MART-013** Tutorial: first-run highlight stealth zones. Effort: S. UX.
- **MART-014** Cart trail visual when speeding. Effort: S. VISUAL.
- **MART-015** Sneeze chance when picking pepper-aisle item (alerts guards). Effort: S. GAMEPLAY.
- **MART-016** Daily store layout shuffle. Effort: M. META.
- **MART-017** Item value labels visible only when crouching. Effort: S. UX.
- **MART-018** Co-op style: hire a decoy pug. Effort: M. GAMEPLAY.
- **MART-019** Background ambient music — supermarket muzak track. Effort: S. AUDIO.
- **MART-020** Stats: total items stolen across all runs (META counter). Effort: S. META.

## 13. pug-td (20)

- **TD-001** Bloons TD speed-toggle 1x/2x/3x (already shared helper exists — wire it). Effort: S. UX.
- **TD-002** Next-wave-early gold bonus button (existing helper). Effort: S. GAMEPLAY.
- **TD-003** 2-path upgrade tree per tower (crit/pierce path etc.). Effort: L. GAMEPLAY.
- **TD-004** 3 new tower types — Bone Slinger, Ice Pup, Sausage Cannon. Effort: M. GAMEPLAY.
- **TD-005** Enemy type: shielded zombie (immune to one damage type). Effort: M. GAMEPLAY.
- **TD-006** Tower targeting toggle per tower (first/last/strongest). Effort: S. GAMEPLAY.
- **TD-007** Mini-map showing entire path zoomed out. Effort: S. UI.
- **TD-008** Achievement: clear wave 30 without losing health. Effort: S. META.
- **TD-009** Visual: tower upgrades visibly change sprite. Effort: M. VISUAL.
- **TD-010** Tower selling refunds 75% if no kills, 50% otherwise. Effort: S. GAMEPLAY.
- **TD-011** Mobile: pinch-zoom on map, tap-to-place. Effort: M. MOBILE.
- **TD-012** Three maps unlocked via clearing wave X. Effort: M. META.
- **TD-013** Audio: per-tower fire SFX (currently shared). Effort: S. AUDIO.
- **TD-014** Daily map mode with leaderboard. Effort: M. META.
- **TD-015** Tower stats popup with DPS calc. Effort: S. UI.
- **TD-016** Slow-mo speed (0.5x) for difficult placements. Effort: S. UX.
- **TD-017** Wave preview already exists — add icon row for incoming. Effort: S. UI.
- **TD-018** Tutorial: arrow points to first build spot. Effort: S. UX.
- **TD-019** Hero unit — one player-controllable pug with abilities. Effort: L. GAMEPLAY.
- **TD-020** Endgame: 50-wave gauntlet mode. Effort: M. GAMEPLAY.

## 14. backrooms-3d (20)

- **BACK3D-001** Stamina-based sprint instead of unlimited. Effort: S. GAMEPLAY.
- **BACK3D-002** Crouch hide mechanic for closets. Effort: M. GAMEPLAY.
- **BACK3D-003** Footstep audio swap per floor texture. Effort: S. AUDIO.
- **BACK3D-004** Audio: positional 3D monster steps using Web Audio panner. Effort: M. AUDIO.
- **BACK3D-005** Sanity meter that ticks down in dark areas. Effort: M. GAMEPLAY.
- **BACK3D-006** Multi-floor escape (basement → corridor → exit). Effort: L. GAMEPLAY.
- **BACK3D-007** Lighting: dynamic flicker — fluorescent buzz + dim. Effort: S. VISUAL.
- **BACK3D-008** Mobile touch joystick + look (already exists, polish dead zone). Effort: S. MOBILE.
- **BACK3D-009** Daily seed maze layout. Effort: M. META.
- **BACK3D-010** Lore note pickups with text overlays. Effort: S. META.
- **BACK3D-011** Settings: FOV slider 60-110. Effort: S. UX.
- **BACK3D-012** Settings: jumpscare intensity slider. Effort: S. UX.
- **BACK3D-013** Visual: heat-haze post-process on sanity low. Effort: M. VISUAL.
- **BACK3D-014** Pause: minimap reveal of explored cells. Effort: M. UI.
- **BACK3D-015** Achievement: escape under 5 minutes. Effort: S. META.
- **BACK3D-016** Object collision sound (bump-into-wall thud). Effort: S. AUDIO.
- **BACK3D-017** Tutorial: opening text crawl explaining the level. Effort: S. UX.
- **BACK3D-018** Performance: instanced wall geometry instead of per-tile mesh. Effort: M. PERF.
- **BACK3D-019** Almond-water restore item like 2D variant. Effort: S. GAMEPLAY.
- **BACK3D-020** Level 1+ unlock after first escape. Effort: M. GAMEPLAY.

---

## Site-Wide (20)

- **SITE-001** Hub: filter games by mood (chill/action/puzzle/horror). Effort: S. UI.
- **SITE-002** Hub: favorite-pin a game to top. Effort: S. UI.
- **SITE-003** Profile: editable avatar drawn with `pugSprite.js`. Effort: M. META.
- **SITE-004** Cloud sync: conflict resolver UI when same key differs locally vs cloud. Effort: M. META.
- **SITE-005** Settings: global volume slider (currently per-game mute only). Effort: S. UX.
- **SITE-006** Settings: motion-reduction master toggle (already partial; expand to all). Effort: M. UX.
- **SITE-007** Mobile: persistent landscape-orientation prompt (currently per-game). Effort: S. MOBILE.
- **SITE-008** PWA: offline cache for hub + at least 3 most-played games. Effort: M. PWA.
- **SITE-009** Accessibility: keyboard nav for hub tile selection. Effort: S. UX.
- **SITE-010** Accessibility: contrast theme (high-contrast palette). Effort: M. UX.
- **SITE-011** Perf: lazy-load each game bundle only on click (verify already chunked). Effort: S. PERF.
- **SITE-012** Documentation: per-game README with controls + tips. Effort: M. META.
- **SITE-013** New game idea: pug-pinball — physics pinball with pug ball. Effort: L. GAMEPLAY.
- **SITE-014** New game idea: pug-puzzler — match-3 with bone/treat/bowl tiles. Effort: L. GAMEPLAY.
- **SITE-015** Profile: stats dashboard across all games (total plays, total kills, etc.). Effort: M. META.
- **SITE-016** Daily login streak reward — cosmetic coin every day. Effort: M. META.
- **SITE-017** Site-wide achievements page with progress bars. Effort: M. META.
- **SITE-018** Hub: news ticker for "what's new in v1.x". Effort: S. UI.
- **SITE-019** Bug-report button (mailto link to info@sodaworld.tv). Effort: S. UX.
- **SITE-020** Internationalization: extract strings to i18n JSON for future locales. Effort: L. META.

---

**Total: 14 × 20 + 20 site-wide = 300 items.**
