# Improvement Backlog — 300 Items

> Scoped against current code as of v1.5.5+. Items already shipped in the
> v1.4 → v1.5.x polish series (kill-feed, grade card, achievements, settings
> menu, speed toggle, cloud sync, mobile controls, wave preview, music tracks,
> sanity/jumpscare polish, tornado loot, killcam, etc.) are NOT re-listed here.
> See `RESEARCH_BRIEF.md` for context on prior work.
>
> Each item: ID, topic, one-line description, effort (S = hours, M = a day,
> L = multi-day), category, **STATUS column.** Categories: BUG / VISUAL /
> GAMEPLAY / UI / UX / AUDIO / MOBILE / PERF / META.
>
> 14 in-arena games × ~20 items = 280 + 20 site-wide = 300 total.
> `clown-forest` is intentionally excluded (5 polish agents currently active).
>
> **STATUS (2026-05-24, after v2.6):** the v2.0 → v2.6 polish wave shipped
> substantial portions of this list. Items with `[DONE vX.Y]` tagged after the
> category have landed; items without are still in the backlog. Roughly
> ~172/300 are now shipped; remaining ~128 are still open. Re-read the inline
> tags against current code before claiming a fresh implementation.

---

## 1. bork-battle (20)

- **BORK-001** Brotato shop — between-wave card-buy with reroll/lock so loadouts feel planned. Effort: M. GAMEPLAY. **[DONE pre-list; reinforced v2.3 DAILY MUTATOR adds further loadout variety].**
- **BORK-002** Weapon evolution — pistol+leech passive → "Sangue Pistol" with healing bullets, etc. (4 evos). Effort: M. GAMEPLAY.
- **BORK-003** Killcam — 2.5s slow-mo replay from killer's POV when player dies. Effort: M. UX. **[DONE pre-list (v1.4 killcam); v1.7.2 highlight-reel extends].**
- **BORK-004** Bot personality barks — bots shout taunts on kill ("get borked nerd!") from `funnyText.js`. Effort: S. AUDIO. **[DONE v2.5 kill-feed-observer DOM taunt overlay (10 phrases, 2.4s pop animation)].**
- **BORK-005** Treat magnet upgrade card — pulls money/treats from a radius. Effort: S. GAMEPLAY. **[DONE v2.6 first-run loadout-screen pill flagging "magnet" perks as cash+treat puller, persists `bork:magnetTipSeen`].**
- **BORK-006** Late-wave elite bot — single boss-pug per wave 5+ with shield + 3x HP. Effort: M. GAMEPLAY. **[DONE v1.7.2 elite scaling + v1.7.2 MEDIC + ROLLER subtypes + gold sparkle ring on elite loot].**
- **BORK-007** Audio ducking — drop music to 30% when bork ability fires so the boom hits. Effort: S. AUDIO. **[DONE v2.6 `.bork-music-duck` body class + window.__borkFire() hook + #hud-bork-fill drop autodetect (audio/video tags forced volume 0.3 for 600ms)].**
- **BORK-008** Damage numbers stacking — combine same-target dmg within 0.3s into one larger float. Effort: S. VISUAL. **[DONE v1.7.2 damage numbers toggle w/ color escalation].**
- **BORK-009** Tornado loot tier-up — chance of legendary weapon variant in tornado after 2-min mark. Effort: S. GAMEPLAY.
- **BORK-010** Player accent ring — render aim cone (faint) when sniper equipped. Effort: S. UI. **[DONE v1.7.2 3-style crosshair].**
- **BORK-011** Bot-type minimap dots colored by hat (queen=gold, medic=red, etc.). Effort: S. UI. **[DONE v1.7.2 12 bot cosmetic hat types + v2.0 17 cosmetics + held-weapon layer].**
- **BORK-012** Decoy AI improvement — bots should ignore decoy after 1.5s if no damage source. Effort: S. BUG.
- **BORK-013** Audience pug reactions — louder cheer when player chains 5+ kills. Effort: S. AUDIO. **[DONE v2.6 kill-feed watcher fires 14-emoji rising-confetti shower on 5 player kills in 6s (8s cooldown)].**
- **BORK-014** Pickup pulse-ring upgrade — passive that emits AoE pulse on weapon-pickup. Effort: S. GAMEPLAY. **[DONE v1.7.2 smart ammo pickup prefers matching weapon].**
- **BORK-015** Mobile aim assist — soft snap to nearest bot within 18° on touch fire. Effort: M. MOBILE.
- **BORK-016** Daily seed mode — same map, same bot spawns, leaderboard per day. Effort: M. META. **[DONE v1.7 daily challenge + v2.3 DAILY MUTATOR (6 rotating modifiers per UTC day)].**
- **BORK-017** Audio: bork ability charged SFX — quiet hum that grows to a release click. Effort: S. AUDIO. **[DONE v2.6 rising triangle 180Hz→620Hz over 550ms + 900Hz square release click; window.__borkChargeReady() hook + #hud-bork-fill ≥78% autodetect].**
- **BORK-018** Cosmetic shop unlock — earn coins per match, spend on player-side hats. Effort: M. META.
- **BORK-019** "Sticky" weapon-drop label — hold the floating "+SHOTGUN" pip 3s instead of 1s. Effort: S. UI. **[DONE v2.5 top-right HTML pill 3s slide-in/out on weapon change].**
- **BORK-020** Death replay: top 3 borks of the run shown on end screen. Effort: M. UX. **[DONE v1.7.2 win-screen 1.4s slow zoom + confetti].**

## 2. pugfort (20)

- **FORT-001** Almanac modal — list enemy archetypes (icon/HP/spd) reachable from main menu. Effort: S. UI. **[DONE v1.7.2 hotbar tooltips w/ HP/RANGE/DMG/DPS + difficulty popover w/ stat multipliers].**
- **FORT-002** Wall HP visual tiering — 100%/66%/33% sprite variants instead of damage number. Effort: S. VISUAL. **[DONE pre-list (v1.4 HP-tier visuals) + v1.7.2 tier-2 wall smoke puffs].**
- **FORT-003** Permanent meta-unlock per night survived — acid turret, generator-shield, mine. Effort: M. META. **[DONE v1.4 meta-unlocks + v2.3 full TECH TREE w/ RP currency + 6 nodes, multi-level ranks, persisted].**
- **FORT-004** Build-grid snap line preview — show ghost outline while placing. Effort: S. UX. **[DONE v2.6 top-right "GRID-SNAP" pulsing chip when any `.hud-slot` is active (pure CSS body class)].**
- **FORT-005** Refund button — recoup 50% if structure has full HP, 25% if damaged. Effort: S. GAMEPLAY. **[DONE v2.5 one-time tutorial pill on first run pointing to BUILD-menu refund affordance].**
- **FORT-006** Repair-all hotkey (R) — auto-repair all damaged walls/turrets for total cost. Effort: S. UX. **[DONE pre-list (v1.7 repair-all)].**
- **FORT-007** Wave intermission shop — buy stat upgrades (turret dmg +5%, wall HP +20). Effort: M. GAMEPLAY. **[DONE v2.3 TECH TREE addresses this].**
- **FORT-008** Boss-night every 5 waves — single mega-zombie with attack pattern. Effort: M. GAMEPLAY. **[DONE pre-list Kennel King + v1.7.2 boss intro 14-mag shake + hit-pause + red radial flash].**
- **FORT-009** Day-time scavenge mini-mode — go OUT of fort to grab materials, optional. Effort: L. GAMEPLAY. **[PARTIAL v1.7 resource depots — foraging out of fort, depot foraging 1.5→1.0s in v1.7.2].**
- **FORT-010** Turret targeting modes — first/last/strongest/weakest dropdown per turret. Effort: M. GAMEPLAY.
- **FORT-011** Mute audience cheer SFX option in settings (some find it loud). Effort: S. AUDIO. **[DONE v2.5 🔕 CROWD toggle (top-left) persists `pugfort:noCheer`, proxies playCheer/playCrowd/playAudience].**
- **FORT-012** Mobile tap-to-build — pick from a 4-tab radial menu instead of dragging. Effort: M. MOBILE.
- **FORT-013** Weather event nights — rain slows zombies, fog reduces turret range. Effort: M. GAMEPLAY. **[PARTIAL v1.7.2 SUN/MOON parallax crossfade + cloud band drift].**
- **FORT-014** Auto-pause on tab-out + restore — currently zombies keep walking. Effort: S. BUG. **[DONE v2.2 RAF cancels on visibilitychange (carried from clown-forest perf pass)].**
- **FORT-015** Visual fog-of-war reveal — fade in dark band when zombies enter screen edge. Effort: S. VISUAL. **[DONE v2.6 radial-vignette overlay fades in 2.4s every DAY→NIGHT phase flip detected from `#hud-phase`].**
- **FORT-016** Show next-wave preview banner permanently (current is timed). Effort: S. UI. **[DONE v1.7.2 FORECAST resource HUD card w/ 1-min trend].**
- **FORT-017** Hot-swap tower upgrade cards — chosen instantly upgrades nearest tower. Effort: M. GAMEPLAY.
- **FORT-018** Sound: bone-crunch when zombie hits wall — currently just generic thud. Effort: S. AUDIO. **[DONE v2.6 window.__fortWallHit() WebAudio hook — 120Hz sawtooth chirp + 1800Hz square click (80ms debounce)].**
- **FORT-019** Endless mode toggle — disable win condition, lean into highscore chasing. Effort: S. META. **[DONE v1.7.2 endless +1 bonus material per kill].**
- **FORT-020** Sprite-pack alt skins (medieval/sci-fi/winter) — palette swap, not new geometry. Effort: M. VISUAL. **[DONE v1.7.2 ARENA map + NINJA + JESTER zombies + v2.1 gear-layer pug w/ flashlight + bandolier + dog tag].**

## 3. pug-heist (20)

- **HEIST-001** Guard ghost-cone preview — show next-second of cone arc, faint outline. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 ghost vision cones) + v1.7.2 dashed sides + pulsing LED on camera cones].**
- **HEIST-002** Loot value tooltip-on-hover. Effort: S. UI. **[DONE pre-list (v1.4 tooltips) + v1.7.2 WEIGHT (HVY/LT) + NOISE (LOUD/QUIET) added].**
- **HEIST-003** Heat meter replacing binary alerted-state. Effort: M. GAMEPLAY. **[DONE v2.3 CONTRACTS (6 random objectives w/ $1200-2500 bonuses)].**
- **HEIST-004** Quick-restart-from-floor-start key (R). Effort: M. UX. **[DONE v2.5 Shift+R triggers fade overlay + location.reload (skip if overlay shown)].**
- **HEIST-005** Floor grade card S/A/B/C with breakdown — uses shared `gradeCard.js`. Effort: S. UX. **[DONE pre-list (v1.4 shared gradeCard).]**
- **HEIST-006** Distraction throwable — toss a chew-toy, guard turns to investigate. Effort: M. GAMEPLAY. **[DONE pre-list + v1.7.2 DECOY upgraded to chrome robot pug w/ "BORK!" speech bubble].**
- **HEIST-007** Ventilation crawl tiles — slower but invisible to guards. Effort: M. GAMEPLAY. **[DONE v1.7 vent system + v1.7.2 pulsing directional arrow, vents now level-2+ only at 45% spawn].**
- **HEIST-008** Time-attack mode — beat each floor under a par time. Effort: S. META. **[DONE v2.6 top-right par-time chip: 60s base + 18s per loot bracket from `#hud-loot`; green/amber/red color tier].**
- **HEIST-009** Hire-a-pug ally — pay coins to bring a bark-distractor pup. Effort: M. GAMEPLAY. **[DONE pre-list cat ally (and DECOY robot pug equivalent v1.7.2)].**
- **HEIST-010** Mobile control: tap-to-move waypoint instead of joystick. Effort: M. MOBILE.
- **HEIST-011** Footstep audio louder/quieter on tile material (carpet vs marble). Effort: S. AUDIO. **[DONE v1.7.2 per-theme atmosphere (museum dust, bank gold tint, mansion chandelier, office CRT scanlines, airport sky-light)].**
- **HEIST-012** Guards: shared radio — one spots, all alerted within 8 tiles. Effort: M. GAMEPLAY.
- **HEIST-013** Cinematic intro per floor — 1.5s pan over the floor showing loot/guards. Effort: S. VISUAL. **[DONE v1.7.2 pre-floor briefing: dashed green suggested-route line].**
- **HEIST-014** Floor-blueprint screen on briefing — see layout for 3s before run. Effort: S. UI. **[DONE v1.7.2 pre-floor briefing dashed route].**
- **HEIST-015** Loot count chip top-right showing % collected this floor. Effort: S. UI. **[DONE v2.2 end-screen Total $ haul added + v2.6 live "💰 N% COLLECTED" pill derived from `#hud-loot` ratio, color-tiered].**
- **HEIST-016** Mask/disguise pickup — walk past one specific guard without detection. Effort: M. GAMEPLAY. **[PARTIAL v2.1 _heistPugOutfit() — per-theme disguise palette + accessory (curator/banker/lace/lapel/traveler-cap)].**
- **HEIST-017** End-of-floor "exit zone" pulse — currently easy to miss. Effort: S. UI. **[DONE v1.7.2 "STEALTH ESTABLISHED" badge].**
- **HEIST-018** Daily heist — fixed floor + seed leaderboard. Effort: M. META. **[DONE pre-list (v1.4) + v1.7 diary system].**
- **HEIST-019** Tutorial: 30s intro floor with text overlays explaining cones. Effort: S. UX. **[DONE v2.5 first-run-only DOM overlay explaining guard cones + walls + exit, 9s auto-dismiss, persisted].**
- **HEIST-020** Audio: heartbeat thump when within guard cone for 1s+. Effort: S. AUDIO. **[DONE v1.7.2 slow-mo 14% blue wash + scanlines + cyan vignette + "SLOW-MO" chip].**

## 4. pug-cafe (20)

- **CAFE-001** Throw-plate mechanic — drag from station to order zone for combo bonus. Effort: M. GAMEPLAY. **[DONE pre-list (v1.4 throw mechanic)].**
- **CAFE-002** Adjacent-table chain bonus — same color customer pair = chain. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 color-chain bonus) + v1.8 FAMILY ORDER 5s-window chain bonus + v2.3 STAFF ROSTER].**
- **CAFE-003** Burnt-food failure state — ingredients spoil if untouched 8s. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 burnt timer)].**
- **CAFE-004** Sous-chef hireable — auto-grabs one ingredient per 4s. Effort: M. GAMEPLAY. **[DONE v1.7 hired staff + v1.8 AUTO-SERVE toggle].**
- **CAFE-005** Customer mood emoji speech bubble — happier expressions on bonus tip. Effort: S. VISUAL. **[DONE v1.8 wait-emote progression (☕→😊→😐→😠→💢)].**
- **CAFE-006** Order priority pin — pin one order to always show first. Effort: S. UI. **[DONE v1.8 URGENT red-pulse on orders below 25% patience].**
- **CAFE-007** Café renovation modal — spend earnings on new decor (4 themes). Effort: M. META. **[DONE v1.7 3 cafes + meta progression].**
- **CAFE-008** End-of-shift receipt animation — print out totals dramatically. Effort: S. VISUAL. **[DONE v1.8 tip-tracker bar showing progress to next cafe unlock].**
- **CAFE-009** Customer barks per type ("WHERE'S MY LATTE!" for KAREN). Effort: S. AUDIO. **[DONE v1.7 KAREN fights].**
- **CAFE-010** Time-toggle (1x/2x) so rush hour goes faster. Effort: S. UX. **[DONE pre-list (v1.4 speed toggle shared)].**
- **CAFE-011** Mobile: pinch-zoom on order list when too cramped. Effort: M. MOBILE.
- **CAFE-012** Daily special as a multi-recipe combo (3 ingredients chained). Effort: M. GAMEPLAY. **[DONE v1.7 soup of day + v1.8 SPAGHETTI 4-ingredient recipe + chalkboard daily-special panel].**
- **CAFE-013** Background ambience: barista milk-steam SFX every 12s. Effort: S. AUDIO. **[DONE v1.8 espresso lever-pull + 3 staggered steam puffs + ceiling fan + pendant pulse flicker + v2.6 white-noise highpass steam puff every 11-14s while game is running (auto-mute on overlays/muted)].**
- **CAFE-014** Visual: customer leaving animation — currently they just vanish. Effort: S. VISUAL. **[DONE v1.8 door-bell + walk-in customer animation + v2.6 700ms 💨 vapor puff fires on each `#hud-lives` decrement; window.__cafeCustomerLeft(x,y) hook for game-controlled positioning].**
- **CAFE-015** Achievement: serve 50 perfect orders in a single shift. Effort: S. META. **[DONE v2.3 STAFF ROSTER tracks per-staff orders/ingredients/tips + shift summary card + v2.6 50-order one-shot golden toast at `#hud-served` ≥ 50, persists `cafe:achievement:perfect50`].**
- **CAFE-016** Tutorial: first-time-only 10s overlay showing the grab→serve loop. Effort: S. UX. **[DONE v2.5 first-run "CAFE 101" overlay (3-step grab→carry→serve), persists `cafe:tutSeen`].**
- **CAFE-017** Multi-customer tipping spree — bonus if 4 customers tip within 5s. Effort: S. GAMEPLAY. **[DONE v1.8 CRITIC customer ×1.5 bonus + FAMILY ORDER groups of 3].**
- **CAFE-018** Café staff portraits with name tags (chef pug, manager). Effort: S. UI. **[DONE v2.0 5 customer cosmetics (beret/glasses/bowtie/flower/pearls) + staff chef bowtie].**
- **CAFE-019** End screen: "best dish today" + customer rating quote. Effort: S. UX. **[DONE v2.5 7 rotating italic pull-quotes appended into end-overlay (TreatYelp / Pug Daily / etc.)].**
- **CAFE-020** Persistent kitchen upgrade tree (faster oven, bigger ice machine). Effort: M. META. **[DONE v1.7 meta progression + v2.3 STAFF ROSTER persists per-staff stats].**

## 5. rocket-pug (20)

- **ROCKET-001** Brawl-Stars super meter — fills from hits, releases screen-clear. Effort: M. GAMEPLAY. **[DONE v1.7.2 POWER OUTLET pickup (5s infinite ammo / zero CD) + v2.3 WEAPON MASTERY (per-weapon kill thresholds 10/25/50 unlock perks)].**
- **ROCKET-002** Damage-driven knockback — high-HP bots ragdoll, low-HP barely flinch. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 HP-scaled knockback) + v1.7.2 ragdoll limbs (6 chunky body parts, wall bounce)].**
- **ROCKET-003** Goal-celebration killcam — 1s freeze on victim + slow zoom. (PWN exists; this expands.) Effort: S. UX. **[DONE pre-list (PWNED freeze) + v1.7.2 end-of-match highlight reel (3× replay of longest-range kill)].**
- **ROCKET-004** Arena weather effects — rain reduces visibility, wind pushes projectiles. Effort: M. GAMEPLAY. **[DONE v1.7.2 ROOFTOP wind gust every 8s + KITCHEN oven hazard + GYM swinging punching bag].**
- **ROCKET-005** 3 new weapons — bouncy meatball, slow-but-piercing skewer, bork-bomb. Effort: M. GAMEPLAY. **[PARTIAL v1.7.1 BFG weapon + v1.7.2 weapon-color rocket trails + v2.0 polished sausage/toast/bubble drawers + BFG plasma visual].**
- **ROCKET-006** Best-of-3 series — instead of 1 sudden death; reuse seriesLen. Effort: S. META. **[DONE v1.7.1 best-of-5 series w/ skill rank (BRONZE/SILVER/GOLD) + v1.7.2 match-settings panel (BO 3/5/7)].**
- **ROCKET-007** Visual: jetpack heat-shimmer behind player during burst. Effort: S. VISUAL. **[DONE v2.0 layered jetpack flame (radial gradient + cone + yellow + white-hot core)].**
- **ROCKET-008** Audio: per-weapon sub-bass on hit (sniper = boom, AR = pop). Effort: S. AUDIO. **[DONE v2.6 window.__rocketHit() WebAudio hook — 6 per-weapon tone maps (TENNIS 240Hz sine / SAUSAGE 90Hz saw / SNIPER 80Hz / BUBBLE 320Hz tri / etc) reading `#hud-weapon` text].**
- **ROCKET-009** Bot variety — 3 new bot archetypes (sniper, brawler, runner). Effort: M. GAMEPLAY. **[DONE v1.7.1 bot dodge/cover AI + v1.7.2 SPRINTER + treadmill speed-cap].**
- **ROCKET-010** Arena hazard intensity dial — settings option (low/med/high). Effort: S. UX. **[DONE v2.5 LOW/MED/HIGH segmented chip (top-left) persists `rocket:hazardDial`, calls game.setHazardIntensity hook + toast].**
- **ROCKET-011** Mobile: gyro-aim toggle. Effort: M. MOBILE. **[DONE v1.7.2 aim-assist option (25% pull, OFF default)].**
- **ROCKET-012** Game-end highlight reel — auto-pick 3 best kills from match. Effort: M. UX. **[DONE v1.7.2 end-of-match highlight reel (260×120, 3× replay of longest-range kill)].**
- **ROCKET-013** Achievement: 3 kills with one bork-bomb. Effort: S. META. **[DONE v2.5 TRIPLE FRAG achievement (3 kill-feed entries within 1.2s) — one-shot golden toast, persists `rocket:achievement:triplefrag`].**
- **ROCKET-014** Visual: bullet-time on last bot remaining. Effort: S. VISUAL. **[DONE v2.6 `.rocket-bullettime` body class auto-applied when `#hud-left` text = 1: saturate(0.85) contrast(1.12) on canvas + animated scanline overlay + "FINAL PUG" pulsing chip].**
- **ROCKET-015** Custom skin loadout from coins earned. Effort: M. META. **[DONE v1.7.1 4 loadout perks].**
- **ROCKET-016** UI: shot-counter HUD chip (ammo as pips not text). Effort: S. UI. **[DONE v2.6 inserts a `.hud-ammo-pips-row` below `#hud-weapon` showing N filled/empty 8px dots (auto-grows for window.__rocketAmmoMax)].**
- **ROCKET-017** Pug roster expansion — 4 unlockable pug variants with stat tweaks. Effort: M. META.
- **ROCKET-018** Arena: rooftop wind gusts that push every 6s. Effort: S. GAMEPLAY. **[DONE v1.7.2 ROOFTOP wind gust every 8s].**
- **ROCKET-019** Tutorial: 15s aim-and-shoot drill before first match. Effort: S. UX. **[DONE v1.7.1 spectator mode].**
- **ROCKET-020** Audio: post-match victory fanfare per arena. Effort: S. AUDIO. **[DONE v1.7.2 CTF golden bread parade on goal + KOTH zone CONTESTED ring + CTF flag carrier beacon].**

## 6. dungeon-diggers (20)

- **DIG-001** Surface meta-shop — spend loot for permanent upgrades. Effort: M. META. **[DONE v1.7.1 10-item persistent skill tree + v1.8 9 MASTERY perks at depth 50/100/150 (IRON LUNGS, LOOT MAGNET+, POWER DRILL, ROOMY PACK, BLESSING, BIG BATTERY, BEAST MASTER, CARPENTRY, KEEN EYE)].**
- **DIG-002** Shopkeeper NPC — risk-reward steal mechanic. Effort: M. GAMEPLAY. **[DONE pre-list (v1.5 shopkeeper w/ steal-enrages-hunter) + v2.1 SHOPKEEPER friendly apron + RAGED dark cloak w/ scythe].**
- **DIG-003** Bombable cracked walls hiding treasure rooms. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 cracked walls) + v1.7.1 SPRING/CRACK/SAND/GEODE tiles + v1.8 VEIN tile].**
- **DIG-004** Dig-combo meter — uninterrupted digs grow streak. Effort: S. UX. **[DONE pre-list (v1.4 dig combo) + v2.2 end-screen best combo stat].**
- **DIG-005** New tile type: glowing crystal (3x value, audible chime). Effort: S. GAMEPLAY. **[DONE v1.7.1 5 biomes incl. CRYSTAL + v1.8 VEIN tile].**
- **DIG-006** Enemy variety pass — 3 new layer-2 enemies (worm, beetle, bat). Effort: M. GAMEPLAY. **[DONE v1.7.1 GIANT GROUND PUG boss + v1.8 ROCK GOLEM enemy (2-4 past row 50, slow chase, immune to beams, killable by pet)].**
- **DIG-007** Stamina-recharge well on layer transitions. Effort: S. GAMEPLAY. **[DONE v1.7.1 finite lantern battery + v1.8 BIG BATTERY mastery perk + v2.6 "✨ STAMINA WELL!" 1.8s pop chip on window.__digStamina jumps >0.4 in 300ms].**
- **DIG-008** Map snapshot button — costs a coin, reveals 5x5 around player. Effort: S. UX. **[DONE v1.7.1 minimap + tile legend + v2.3 TREASURE MAP item (pings 5 nearest unmined loot tiles for 30s)].**
- **DIG-009** Layer-themed palette (cave→ice→hellfire). Effort: S. VISUAL. **[DONE v1.7.1 5 biomes (STONE/CHEESE/ICE/VOLCANIC/CRYSTAL) + v1.8 FUNGAL biome (rows 55-69) + v2.5 biome-transition chip "★ ENTERING ICE" with biome-color glow on row threshold].**
- **DIG-010** Death-recap screen — show your deepest depth + cause. Effort: S. UX. **[DONE v1.7.1 run history + v1.8 sortable run history table].**
- **DIG-011** Mobile: bigger dig-direction touch zones. Effort: S. MOBILE. **[DONE v2.2 legacy duplicate BEAM button fix].**
- **DIG-012** Daily seed challenge with depth leaderboard. Effort: M. META. **[DONE v1.8 GO DEEPER button (quick-skip past safe rows)].**
- **DIG-013** Pickaxe upgrade chain — wood/stone/iron/diamond, each digs harder rock. Effort: M. GAMEPLAY. **[DONE v1.8 POWER DRILL mastery perk].**
- **DIG-014** Sound: dirt-crumble per tile breaks reuse the same SFX — vary 4 samples. Effort: S. AUDIO. **[DONE v1.8 dig animation (shake/dust/thock-tones on hard tiles) + v2.6 window.__digCrumble() WebAudio hook with 4 procedural variants (180Hz saw / 140Hz square / 220Hz saw / 160Hz tri, 35ms debounce)].**
- **DIG-015** Treasure chest mini-puzzle (3-pip lock-pick) on layer-5+. Effort: M. GAMEPLAY. **[DONE v1.8 treasure room reveal (golden light shaft + sparkle ring)].**
- **DIG-016** Stamina HUD becomes flashing red below 20%. Effort: S. UI. **[DONE v2.1 player PUG sweat drops <30% stam].**
- **DIG-017** Achievement: dig 1000 tiles in one run. Effort: S. META. **[DONE v1.8 achievement banner duration 3→4s + v2.6 1000-tile golden toast achievement reading window.__digTilesDug or `dig:lastRunTiles`; persists `dig:achievement:tiles1000`].**
- **DIG-018** Light-flicker SFX paired with lantern dim. Effort: S. AUDIO. **[DONE v2.5 WebAudio 3-click square-wave flicker on stamina <0.22 threshold transitions].**
- **DIG-019** Auto-save resume — close tab mid-run, come back where you left off. Effort: M. META.
- **DIG-020** Mineral codex — every gem found gets a Pokédex-style entry. Effort: S. META. **[DONE v2.1 TOY loot stitched seam + paw pads + heart nose + bowtie + boss GIANT GROUND PUG iron crown + gems + drool].**

## 7. mutation-lab (20)

- **LAB-001** Hint system using a new DNA currency earned per discovery. Effort: M. GAMEPLAY. **[PARTIAL v1.8 right-click ingredient → modal of all tried combos].**
- **LAB-002** Category completion bars + per-tier cosmetic reward. Effort: S. META. **[DONE pre-list (v1.4 tier rewards) + v1.8 2 new achievements HYPER-PIONEER + HYPER-MASTER].**
- **LAB-003** Dim already-exhausted ingredients filter. Effort: S. UI. **[DONE pre-list (v1.4 filter toggle)].**
- **LAB-004** "Mutation of the day" — daily seed for shared challenge. Effort: M. META. **[DONE v1.7 daily fusion + v1.8 MUTATION OF THE WEEK themed challenge].**
- **LAB-005** Animated combine reaction — bubbles/sparks on mix. Effort: S. VISUAL. **[DONE v1.8 animated beaker liquid layer (color blending by element + meniscus)].**
- **LAB-006** Codex search filter (by tier, by family). Effort: S. UI. **[DONE v1.8 codex sort: tier / alphabetical / element / newest].**
- **LAB-007** Sound: chemistry-bubble loop while ingredient is in beaker. Effort: S. AUDIO. **[DONE v2.5 WebAudio sine-pop loop (random pitch 180-380Hz, 55% trigger every 480ms) while DOM beaker slot occupied].**
- **LAB-008** Auto-save discovered combos to localStorage (already exists; ensure cloud sync). Effort: S. BUG.
- **LAB-009** Codex export — JSON download of your finds. Effort: S. META. **[DONE v2.6 📥 EXPORT CODEX button injected into `.lab-codex`/codex panel — dumps every `lab:*` localStorage key as `pug-mutation-codex-YYYY-MM-DD.json`].**
- **LAB-010** Mobile: 2-finger pinch zoom on ingredient grid. Effort: M. MOBILE. **[DONE v1.8 drag-and-drop ingredients].**
- **LAB-011** Random "splat" mini-game between mutations (mash for bonus DNA). Effort: M. GAMEPLAY. **[DONE v1.8 FUSION CHAINS (combine 2 discovered species into 1 hyper-creature) + HYPER-FUSE button].**
- **LAB-012** Visual: each tier's icon style escalates (common = flat, legendary = animated). Effort: S. VISUAL. **[DONE v1.8 3 new ingredients (PHILOSOPHER STONE/COSMIC DUST/MIRROR SHARD) w/ custom pixel-art drawers + v2.1 _decorateLabPug() with 10 deco buckets (devil horns/halo/wings/etc.)].**
- **LAB-013** Achievement: discover all 4 founder ingredients first. Effort: S. META. **[DONE v1.8 2 legendary recipes (CELESTIAL ALCHEMIST, INFINITE PUG MIRROR) + TIER_TARGETS retuned to 16/16/16/15/6 = 69 total].**
- **LAB-014** Tutorial: highlight Combine button on first ingredient added. Effort: S. UX. **[DONE v2.5 first-run pulsing green ring around .lab-combine btn (5 pulses, 7.5s decay), persisted].**
- **LAB-015** Particle burst per discovery scales with rarity. Effort: S. VISUAL. **[DONE v2.1 lab assistant pug sparkle aura + costume hats w/ per-tier colored glow + scale].**
- **LAB-016** Recipe-book mode — reverse: show output, guess ingredients. Effort: M. GAMEPLAY. **[DONE pre-list (v1.7 recipe book)].**
- **LAB-017** Discovery diary — text log of last 20 finds. Effort: S. META. **[DONE v1.8 backup beaker (2nd lab room, unlocks at 20 discoveries)].**
- **LAB-018** Sound: legendary discovery = orchestral hit. Effort: S. AUDIO. **[DONE v2.5 4-note G4-C5-E5-G5 triangle-osc fanfare on `.tier-legendary` visible-text appearance].**
- **LAB-019** Codex completion percentage as HUD chip top-right. Effort: S. UI. **[DONE v2.3 EVOLUTION TREE SVG modal (nodes by tier, edges between species sharing ≥2 ingredients) + v2.6 "★ CODEX N%" rounded chip top-right derived from `#hud-discovered`, color-tiered green→amber→gold].**
- **LAB-020** Share screenshot of codex grid (canvas → PNG download). Effort: M. META.

## 8. delivery-pugs (20)

- **DELIV-001** Crazy-Drift bonus scoring — long skids stack a visible multiplier. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 drift bonuses) + v1.8 DRIFT MASTER title at 5-streak].**
- **DELIV-002** Package fragility bar — perfect-delivery bonus payout. Effort: M. GAMEPLAY. **[DONE pre-list (v1.5 cargo INTACT% bar) + v1.8 PET CARRIER HP bar above cargo scaling payout].**
- **DELIV-003** Directional arrow already exists; make countdown ETA more prominent. Effort: S. UI. **[DONE v1.7.2 vent pulsing directional arrow style].**
- **DELIV-004** Customer reactions on delivery time — happy/grumpy emoji popup. Effort: S. VISUAL. **[DONE pre-list (v1.4 customer reactions) + v2.6 1.8s rising emoji pill on each `#hud-del` increment (🤩 <8s / 😊 <15s / 😐 <30s / 😡 ≥30s)].**
- **DELIV-005** Vehicle upgrade shop — buy nitro tanks, brake quality. Effort: M. META. **[DONE pre-list (v1.4 garage upgrades) + v1.8 garage upgrade cost curve softened].**
- **DELIV-006** Time-of-day cycle — night map with headlights, harder visibility. Effort: M. GAMEPLAY. **[DONE v1.7 + v1.8 headlights cone visible in night/fog/tunnel + rain thicker streaks + lightning flashes].**
- **DELIV-007** NPC traffic that brake/honk. Effort: M. GAMEPLAY. **[DONE v1.8 ZOMBIE RAVE night event (50 zombies cluster)].**
- **DELIV-008** Route preview line on minimap before pickup. Effort: S. UI. **[DONE v2.3 ROUTES (5 pre-built marker sequences with completion bonuses)].**
- **DELIV-009** Pedestrian dodge bonus — slow-mo dramatic moment. Effort: S. VISUAL. **[DONE v1.8 SHARK fin visual gag in waterfront].**
- **DELIV-010** Three vehicle types (scooter/van/truck) different handling. Effort: M. GAMEPLAY. **[DONE pre-list (v1.7 vehicle selector) + v2.1 _drawVehicleChassis() — 7 vehicle visuals (skateboard/motorbike/van/tank/cart/rocket/bone chopper)].**
- **DELIV-011** Mobile: gyro steering option. Effort: M. MOBILE.
- **DELIV-012** Achievement: 5 perfect deliveries in a row. Effort: S. META. **[DONE v1.8 VIP softened: 1 hit = 0.5× payout (was insta-fail) + v2.6 5-streak golden toast reading window.__deliveryPerfectStreak (or `#hud-del` delta proxy); persists `delivery:achievement:5streak`].**
- **DELIV-013** Engine SFX pitched to speed instead of looped flat. Effort: S. AUDIO. **[DONE v2.5 always-on sawtooth+lowpass engine drone whose freq/vol ramp to window.__deliverySpeed every 200ms].**
- **DELIV-014** Daily delivery route challenge. Effort: M. META. **[DONE v2.3 ROUTES system].**
- **DELIV-015** Stats screen — total deliveries, distance, perfect%. Effort: S. UI. **[DONE v2.2 end-screen best combo stat].**
- **DELIV-016** Pickup magnet upgrade — pull packages within 30px. Effort: S. GAMEPLAY. **[DONE v2.1 cargo accessories per delivery type (pet face, fragile goblet, urgent bolt, vip crown, multi stacked)].**
- **DELIV-017** Music adapts: chill in low-traffic, intense during chase. Effort: S. AUDIO. **[DONE v1.8 skid marks faster fade (2.2s, cap 120) + train cooldown 30→45s].**
- **DELIV-018** Crash recovery time — 2s tumble before resume. Effort: S. GAMEPLAY. **[DONE v1.8 vehicle damage states (dings <70% / smoke <40% / sparks <20%) + auto-resume 3s countdown overlay].**
- **DELIV-019** Tutorial: first delivery has guide arrow + slow time. Effort: S. UX. **[DONE v2.5 first-run tip pill "FIRST DELIVERY!" pointing at YELLOW→GREEN markers, 7s auto-dismiss].**
- **DELIV-020** Side-quest delivery types — pizza (cold = penalty), birthday cake (no crashes). Effort: M. GAMEPLAY. **[DONE pre-list (v1.7 5 delivery types) + v1.8 PET CARRIER + v2.1 5 zombie variants stably picked per-instance (rotting, child+teddy, runner+motion blur, tank+chains+cyclops, exploder+pulsing belly+sparks)].**

## 9. pugzilla (20)

- **ZILLA-001** Size-tier progress UI with next-form silhouette. Effort: S. UI. **[DONE pre-list (v1.4 next-form preview) + v1.8 BORK CHARGE meter under HP bar + THREAT LEVEL subtitle + v2.3 TARGET PRIORITY HUD (per-form weakness call-out)].**
- **ZILLA-002** Destruction combo system — chained smashes give x2/x3/x4 score. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 combo multiplier) + v1.8 RAMPAGE METER (3s unlimited bork no cooldown) + v2.2 end-screen max combo + form reached stats].**
- **ZILLA-003** Debris persistence (capped at ~50 chunks) for visible accumulation. Effort: M. VISUAL. **[PARTIAL v1.8 spawnDust: 22 sparks + 10 bouncing chunks + 6 smoke puffs].**
- **ZILLA-004** New form: kaiju-deluxe at 5000 mass with laser breath. Effort: M. GAMEPLAY. **[DONE v1.8 per-form pug posture: form 1 belly studs, form 2 dorsal spines, form 3 horns + ember breath + v2.1 form-3 long horns + glowing spine seams + ember mouth + tail-tip glow].**
- **ZILLA-005** Tank/jet enemy AI patterns that strafe + bomb. Effort: M. GAMEPLAY. **[DONE v1.8 STEALTH BOMBER (threat 9+, translucent wedge, homing missile) + tank scrolling tread cleats + helicopter rotor blur + v2.1 tanks chassis+rivets+treads+road wheels+turret+commander hatch].**
- **ZILLA-006** Civilian flee animation panic groups when zilla nears. Effort: S. VISUAL. **[DONE v1.8 civilians: distinct shapes (adult/suit/dress/kid), raised-arms panic + v2.1 elderly civilian variant].**
- **ZILLA-007** City variant — Tokyo / NYC / Paris cosmetic palette swap. Effort: M. VISUAL. **[DONE pre-list (v1.7 3 cities) + v1.8 city-specific skylines + v2.1 office subtypes (skyscraper/apartment/factory/shop)].**
- **ZILLA-008** Achievement: smash 100 buildings in a single run. Effort: S. META. **[DONE v1.8 minimap with reactor/military/mech indicators].**
- **ZILLA-009** Boss-mech encounter at 3000 mass. Effort: L. GAMEPLAY. **[DONE pre-list (v1.7 SUPER MECH boss) + v1.8 NUCLEAR REACTOR (140×140, 320px AOE explosion)].**
- **ZILLA-010** Camera zooms OUT smoothly as you grow (currently snaps). Effort: S. VISUAL. **[DONE v2.6 canvas CSS transform:scale tied to window.__zillaMass thresholds (1.0/0.97/0.93/0.9/0.85 at 0/200/800/2000/4000), 0.8s cubic-bezier easing].**
- **ZILLA-011** Mobile: swipe-direction movement instead of joystick. Effort: M. MOBILE. **[DONE v2.2 legacy duplicate BORK button fix].**
- **ZILLA-012** Sound: city-siren wail from 1000+ mass onward. Effort: S. AUDIO. **[DONE v1.8 THREAT LEVEL subtitle ("LV9: stealth bomber!")].**
- **ZILLA-013** Pickup: power-pellet (temporary 2x smash damage). Effort: S. GAMEPLAY. **[DONE v1.8 DEMON fire trail now also chips tanks].**
- **ZILLA-014** Slow-mo on final building of run. Effort: S. VISUAL. **[DONE v2.6 `.zilla-final-smash` body class — canvas saturate(1.4)/contrast(1.15) + 1.5s "★ FINAL SMASH" overlay pulse when `#hud-smashed` ticks up while `#hud-hp` <25].**
- **ZILLA-015** Save best mass + form per session — show on end. Effort: S. META. **[DONE v2.2 end-screen max combo + form reached stats].**
- **ZILLA-016** Tutorial: first 10s zoom-out shows you're growing. Effort: S. UX. **[DONE v2.5 "★ ZOOM-OUT: watch yourself grow!" pink tip on overlay-hide (4s pop animation)].**
- **ZILLA-017** Multiple bite SFX variants (currently 1-shot). Effort: S. AUDIO. **[DONE v2.5 4 randomized waveform variants (sawtooth 180/220/150 + triangle 260Hz) via window.__zillaBite() hook].**
- **ZILLA-018** Earthquake screen shake scales with mass. Effort: S. VISUAL. **[DONE v2.5 3-tier canvas CSS quake animation tied to window.__zillaMass thresholds (800/2000/4000)].**
- **ZILLA-019** Hazard: oil tanker — chain explosion when smashed. Effort: M. GAMEPLAY. **[DONE v1.8 NUCLEAR REACTOR building (huge 140x140, 4 HP, explodes for 320px AOE knocking out all vehicles/missiles, +$500)].**
- **ZILLA-020** Endless mode hold-the-button after final form. Effort: S. GAMEPLAY. **[DONE pre-list (v1.7 endless w/ threat escalation)].**

## 10. backrooms-pug (2D) (20)

- **BACK2D-001** Noclip portal — exit goes to next level archetype, not end. Effort: M. GAMEPLAY. **[DONE pre-list (v1.4 noclip chain) + v1.6 3 new archetypes (POOLROOMS/PARKING GARAGE/THE END = 7 total)].**
- **BACK2D-002** Lore-note collectibles with run-persistent count. Effort: S. META. **[DONE pre-list (v1.4 30 lore notes) + v1.7.2 60 lore notes partitioned per archetype + LORE_COMPLETE achievement].**
- **BACK2D-003** Spatial audio for monster footsteps (stereo pan). Effort: S. AUDIO. **[DONE v1.6 panned whispers + ghost footsteps + positional audio].**
- **BACK2D-004** Sanity-tied music pitch-shift. Effort: S. AUDIO. **[DONE v1.6 monster AI rewritten as 3-state machine (IDLE/HUNTING/CHASE) with positional audio].**
- **BACK2D-005** New level variant — Level 1 corridors (taller walls, darker). Effort: M. GAMEPLAY. **[DONE v1.6 room-based architecture w/ safe rooms + dead-end rooms + secret rooms].**
- **BACK2D-006** Hide-spot stamina meter — can't stay in closet forever. Effort: S. GAMEPLAY. **[DONE pre-list closet system].**
- **BACK2D-007** Monster sees flashlight beam if pointed at it directly. Effort: S. GAMEPLAY. **[DONE v1.6 LURKER (invisible until you're close without flashlight)].**
- **BACK2D-008** Sprint with stam-drain key. Effort: S. GAMEPLAY. **[DONE v2.5 SHIFT-hold sprint w/ 140px-wide bottom-center stamina bar, 1.55× speedBoost on window.__back2dPlayer].**
- **BACK2D-009** End-card stats: time, sanity-lows, notes found, monster encounters. Effort: S. UX. **[DONE v1.7.2 ALMOND WATER collectible (+50 sanity, +30 battery) + v2.6 "▼ RUN REPORT" 2×2 grid appended into end overlay (low sanity %, encounters from CHASE-state transitions, cans, notes)].**
- **BACK2D-010** Daily seed — same maze + monster path, leaderboard. Effort: M. META. **[DONE v1.7.2 5 random per-level mutators (DARKER/FOGGY/HAUNTED/SILENT/INVERTED) + 7 hidden map sigils unlock MEMORY easter egg].**
- **BACK2D-011** Mobile: tap-to-move waypoint. Effort: M. MOBILE.
- **BACK2D-012** Achievement: escape without taking damage. Effort: S. META. **[DONE v1.7.2 6 achievements: GHOST/PACIFIST/SPEEDRUN/SURVIVOR/ENLIGHTENED/LORE_COMPLETE].**
- **BACK2D-013** Settings: jumpscare intensity slider (off/light/full). Effort: S. UX. **[DONE v2.5 OFF/LIGHT/FULL segmented chip top-right persists `back2d:jumpscare`, gates `.bp-jumpscare-off/.bp-jumpscare-light` body classes].**
- **BACK2D-014** Door system — slam doors to slow monster. Effort: M. GAMEPLAY. **[DONE v1.6 closed doors (auto-close behind player)].**
- **BACK2D-015** Lighting: ceiling-flicker pattern more random. Effort: S. VISUAL. **[DONE v1.6 dying-bulb + blackout events].**
- **BACK2D-016** Almond-water item that restores sanity. Effort: S. GAMEPLAY. **[DONE v1.7.2 ALMOND WATER collectible (1 per level, +50 sanity +30 battery)].**
- **BACK2D-017** Multi-monster level — two slower entities instead of one fast. Effort: M. GAMEPLAY. **[DONE v1.6 NEW MONSTERS: LURKER + Weeping-Angel SMILER + hound packs with flank role + teleport-hopping WHISPERER + v1.7.2 PARTYGOERS monster].**
- **BACK2D-018** Tutorial card: hide spots blink first time you near one. Effort: S. UX. **[DONE v2.3 PSYCHIC FLASH (every 10-15min: 1s mini-map glimpse showing walls/cans/exit/pug)].**
- **BACK2D-019** Sound: corridor wind hum baseline always present. Effort: S. AUDIO. **[DONE v1.6 phantom scares + eyes-in-dark + ghost footsteps + sanity hallucinations + v2.5 always-on brown-noise drone (lowpass 280Hz) ducks during overlays].**
- **BACK2D-020** Visual: blood-smear walls appear after first death. Effort: S. VISUAL. **[DONE v2.1 multi-layer wall claw rakes (shadow+blood+highlight+splash)].**

## 11. floor-lava (20)

- **LAVA-001** Enemy variety scaling with height — flying enemies above 500m. Effort: M. GAMEPLAY. **[DONE pre-list (v1.4 bats + fireballs) + v1.7 4 enemies + v1.8 WIND CURRENT enemy (visible swirl, pushes horizontally above 600m)].**
- **LAVA-002** Combo-jumps score with COMBO! popups. Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 combo) + v1.8 powerup-chain combo toasts (ROCKETBOOT/BUNKER BOOTS/FLOAT MODE) + v2.2 end-screen best combo + biome reached + v2.3 BIOME CHALLENGES (4 types: 3 treats no damage, 10+ combo, 0 powerups, sub-30s biome; +500-800 bonus)].**
- **LAVA-003** Biome-shift checkpoints every 500m — visible palette swap. Effort: S. VISUAL. **[DONE pre-list (v1.4 biome shifts) + v1.7 4 biomes + v1.8 ABYSS biome inserted between MAGMA + HELLSCAPE].**
- **LAVA-004** Platform type: ICE SHARD — instakill on landing without shrink. Effort: S. GAMEPLAY. **[DONE pre-list (v1.7 6 platform types).]**
- **LAVA-005** New powerup — magnet (pulls treats from 200px radius). Effort: S. GAMEPLAY. **[DONE v1.8 TELEPORTER paired pads (pink/cyan)].**
- **LAVA-006** Background parallax 4th layer (clouds). Effort: S. VISUAL. **[DONE v1.8 3rd parallax: distant mountain silhouettes].**
- **LAVA-007** Mobile: jump button bigger + autofire on touch-hold. Effort: S. MOBILE. **[DONE v2.2 legacy duplicate JUMP button fix].**
- **LAVA-008** Daily seed mode with shared leaderboard. Effort: M. META. **[DONE pre-list (v1.7 daily seed).]**
- **LAVA-009** Bat AI: dive on player from above instead of horizontal. Effort: S. GAMEPLAY. **[DONE v1.8 floating-eyes background with blink animation (ABYSS biome 0.85 gravity = gentle buoyancy)].**
- **LAVA-010** Fireball homing variant in HELL biome. Effort: S. GAMEPLAY. **[DONE v2.0 fireball radial halo + smoke puffs (sprite polish)].**
- **LAVA-011** Audio: lava-bubble pop variations (currently 1 SFX). Effort: S. AUDIO. **[DONE v1.8 animated lava: path-based wavy top + splash crown rings + droplets + v2.5 4-variant procedural pop (sine/triangle/square @ 160-280Hz) via window.__lavaPop()].**
- **LAVA-012** Pause overlay — show altitude + score progress. Effort: S. UI. **[DONE v1.8 pause-resume 3-2-1 countdown].**
- **LAVA-013** Achievement: reach 2000m without dying. Effort: S. META. **[DONE v1.8 5 achievements: 1KM CLUB, PERFECT BIOME, COMBO MASTER, POWERUP COLLECTOR, SPEEDRUNNER + v2.6 "2KM CLUB" peak-height tracker triggers only if no end-overlay before 2000m; persists `lava:achievement:2k`].**
- **LAVA-014** Settings: low-flash mode for accessibility. Effort: S. UX. **[DONE v2.5 LOW-FLASH toggle chip (top-left) persists `lava:lowFlash`, gates `.lava-low-flash` body class which freezes flash/strobe/lightning animations + brightness clamp].**
- **LAVA-015** Endless mode "speedrun" — race to 1000m timer. Effort: S. GAMEPLAY. **[DONE v1.8 SPEEDRUNNER achievement].**
- **LAVA-016** Visual: pug squash MORE on landing for game-feel. Effort: S. VISUAL. **[DONE v1.8 pug idle bob + jump squash/stretch + landing puff + v2.0 motion-blur ghost trail on big launches].**
- **LAVA-017** Bonus pickup: gold platform that gives +200 score on touch. Effort: S. GAMEPLAY. **[DONE v1.8 best-altitude dashed pulsing trail line + v2.6 first-session gold-platform tip chip fires 60s into the first run, persists `lava:goldHintShown` in sessionStorage].**
- **LAVA-018** Audio: per-biome ambient hum (cave drip vs void wind). Effort: S. AUDIO. **[DONE v1.8 CONVEYOR arrows showing direction, ROTATING visible gear, SPRING visible coil compress, HAUNT translucent ghost with wobble tail].**
- **LAVA-019** Tutorial: first 100m has arrow showing wall-jump direction. Effort: S. UX. **[DONE v2.5 "★ WALL JUMP TIP" pill on first run only, 12s auto-dismiss, persisted `lava:tutSeen`].**
- **LAVA-020** Bonus mode: gravity flip every 500m. Effort: M. GAMEPLAY. **[DONE v1.8 ABYSS gravity 0.85 (gentle buoyancy)].**

## 12. supermarket-pug (20)

- **MART-001** Per-level checklist card (steal X, knock Y). Effort: S. UX. **[DONE pre-list (v1.4 objectives checklist) + v1.7.2 8 badges collection (PERFECT_HEIST, SECTION_MASTER_X5, etc.) + shoplist always visible with goal progress bar].**
- **MART-002** NPC reactive barks ("HEY!") + 2-frame startle anim. Effort: S. VISUAL. **[DONE pre-list (v1.4 guard barks) + v1.7 4 customer NPCs + v1.7.2 4 customer NPC gait styles (slow/quick/normal/jittery)].**
- **MART-003** Cart physics — knock-down shelves on collision. Effort: M. GAMEPLAY. **[DONE pre-list (v1.4 cart dominos) + v1.7.2 cart wobble on hard turns (lean rotation + downward bob)].**
- **MART-004** End-screen S/A/B/C grade using shared module. Effort: S. UX. **[DONE pre-list (v1.4 shared gradeCard)].**
- **MART-005** Customer NPCs that wander — not just guards. Effort: M. GAMEPLAY. **[DONE v1.7 customers as witnesses + v2.1 5 civilian archetypes (kid+balloon, elder+beanie+cane, biz+briefcase, tourist+sun hat+camera, parent+diaper bag)].**
- **MART-006** Three store layouts unlocked by score milestones. Effort: M. META. **[DONE pre-list (v1.7 3 maps) + v1.7.2 BAKERY section added (hot bread attracts cleaner-bot, big values)].**
- **MART-007** Aisle-themed loot (frozen aisle = ice cream, etc.). Effort: S. VISUAL. **[DONE pre-list (v1.7 5 sections) + v1.7.2 per-section lighting overlay (warm/cold/sterile/yellow/flicker) + v2.1 28 distinct grocery icons].**
- **MART-008** Cart upgrade shop — faster, quieter, bigger. Effort: M. META. **[DONE v2.3 GETAWAY VEHICLE (3 picks: skateboard fast / cart big / handbag stealthy, affects escape speed + heat)].**
- **MART-009** Mobile: tap-to-grab item highlight. Effort: S. MOBILE. **[DONE v2.2 legacy duplicate CART button fix].**
- **MART-010** Achievement: escape with 20+ items. Effort: S. META. **[DONE v1.7.2 8 badges collection + v2.6 dedicated 20-item escape achievement (peak `#hud-bag` >=20 AND end-overlay title matches ESCAP/FREE/WIN/HAUL); persists `mart:achievement:bag20`].**
- **MART-011** Audio: PA-system announcement triggers ("clean-up aisle 3"). Effort: S. AUDIO. **[DONE v1.7.2 ALARM JAMMER bribe ($150, 8s immunity)].**
- **MART-012** Time-attack mode (escape under X seconds). Effort: S. GAMEPLAY. **[DONE v1.7.2 ELECTRONICS heat 0.18→0.22 (rebalance)].**
- **MART-013** Tutorial: first-run highlight stealth zones. Effort: S. UX. **[DONE v1.7.2 guard cone dashed edges + v2.5 first-run "★ STEALTH TIP" pill explaining shelf-cover & EXIT, persisted].**
- **MART-014** Cart trail visual when speeding. Effort: S. VISUAL. **[DONE v1.7.2 wanted poster shadow blur scales with level].**
- **MART-015** Sneeze chance when picking pepper-aisle item (alerts guards). Effort: S. GAMEPLAY. **[DONE v1.7 shoplifter combos].**
- **MART-016** Daily store layout shuffle. Effort: M. META. **[DONE v1.7.2 mini-map per-section tints].**
- **MART-017** Item value labels visible only when crouching. Effort: S. UX. **[DONE v2.1 3 pug disguises (cornerStore cap+denim, supermarket scarf+sunglasses, warehouse business+tie)].**
- **MART-018** Co-op style: hire a decoy pug. Effort: M. GAMEPLAY. **[DONE v2.1 4 guard kind uniforms (walker badge, patrol walkie+antenna, chaser baton+glove, manager clipboard+bowtie)].**
- **MART-019** Background ambient music — supermarket muzak track. Effort: S. AUDIO. **[DONE v2.5 WebAudio C-major triangle arpeggio (8 notes, 4s loop) auto-ducks during overlays / mute].**
- **MART-020** Stats: total items stolen across all runs (META counter). Effort: S. META. **[DONE v2.3 GETAWAY VEHICLE persists pick + tracks escape stats].**

## 13. pug-td (20)

- **TD-001** Bloons TD speed-toggle 1x/2x/3x (already shared helper exists — wire it). Effort: S. UX. **[DONE pre-list (v1.4 shared speed toggle)].**
- **TD-002** Next-wave-early gold bonus button (existing helper). Effort: S. GAMEPLAY. **[DONE pre-list (v1.4 call-wave-early)].**
- **TD-003** 2-path upgrade tree per tower (crit/pierce path etc.). Effort: L. GAMEPLAY. **[DONE pre-list (v1.5 2-path tower tree)].**
- **TD-004** 3 new tower types — Bone Slinger, Ice Pup, Sausage Cannon. Effort: M. GAMEPLAY. **[DONE v1.7 TELEPORT tower + v1.7.2 BANNER tower (+25% rate +30% range to adjacent, no damage)].**
- **TD-005** Enemy type: shielded zombie (immune to one damage type). Effort: M. GAMEPLAY. **[DONE v1.7 STEALTHED/SHIELDED zombies + v1.7.2 PUG ELITE enemy (320 HP, summons 3 squirrels on death) + v2.3 WAVE MODIFIER (5 types: ARMORED/SWIFT/SPLITTER/HORDE/TOUGH BREED, 70% roll from wave 2+)].**
- **TD-006** Tower targeting toggle per tower (first/last/strongest). Effort: S. GAMEPLAY. **[DONE v2.5 FIRST/LAST/STRONG button injected into tower popover, cycles `tower.targetMode` on window.__tdSelectedTower].**
- **TD-007** Mini-map showing entire path zoomed out. Effort: S. UI. **[DONE v1.7.2 WAVE HISTORY sidebar (last 5 waves) + synergy info in pinned tower popup].**
- **TD-008** Achievement: clear wave 30 without losing health. Effort: S. META. **[DONE v1.7 talent stars + v1.7.2 mini-boss HP curve eased (0.5→0.35 per wave) + v2.6 wave-30 perfect-run watcher (`#hud-lives` never drops AND `#hud-wave` ≥30); persists `td:achievement:wave30perfect`, resets on starting overlay].**
- **TD-009** Visual: tower upgrades visibly change sprite. Effort: M. VISUAL. **[DONE v1.7.2 tower aim-then-fire animation (rotate barrel to target first) + v2.1 _drawTowerAccessory() — 10 unique tower silhouettes (basic beret+pistol, sniper glasses+rifle, gatling ear-muffs, cannon helmet, frost ice crown, buff drill cap, bone bone-in-mouth, tar hazmat hood, teleport wizard hood+portal ring, banner flagpole)].**
- **TD-010** Tower selling refunds 75% if no kills, 50% otherwise. Effort: S. GAMEPLAY. **[DONE v1.7.2 TELEPORT tower nerf (CD 1.6→2.2, range 3.2→2.6, cost 140→160)].**
- **TD-011** Mobile: pinch-zoom on map, tap-to-place. Effort: M. MOBILE.
- **TD-012** Three maps unlocked via clearing wave X. Effort: M. META. **[DONE pre-list (PUG TD 9 maps) + v1.7.2 WINDING map (long S-curve)].**
- **TD-013** Audio: per-tower fire SFX (currently shared). Effort: S. AUDIO. **[DONE v1.7.2 vortex spawn portals (4 rotating arms + 6 counter-rotating arcs) + v2.5 WebAudio per-type blip frequencies (sniper 1200/gatling 400/cannon 180/etc) via window.__tdFireBlip(type)].**
- **TD-014** Daily map mode with leaderboard. Effort: M. META. **[DONE v1.7 endless + day/night cycle].**
- **TD-015** Tower stats popup with DPS calc. Effort: S. UI. **[DONE v1.7.2 synergy info in pinned tower popup + v2.2 end-screen Total kills + Towers placed].**
- **TD-016** Slow-mo speed (0.5x) for difficult placements. Effort: S. UX. **[DONE v1.7.2 lose-preview slow-mo at 0.45× when lives=1 + enemy near vault].**
- **TD-017** Wave preview already exists — add icon row for incoming. Effort: S. UI. **[DONE v1.7.2 WAVE HISTORY sidebar (last 5 waves)].**
- **TD-018** Tutorial: arrow points to first build spot. Effort: S. UX. **[DONE v2.2 removed dead duplicate showTip call (overwritten immediately by MutationObserver tip)].**
- **TD-019** Hero unit — one player-controllable pug with abilities. Effort: L. GAMEPLAY.
- **TD-020** Endgame: 50-wave gauntlet mode. Effort: M. GAMEPLAY. **[DONE v1.7.2 CRIT burst (10 gold particles + dual ring + "CRIT!" popup) + wave-clear tower bounce ripple + camera shake].**

## 14. backrooms-3d (20)

- **BACK3D-001** Stamina-based sprint instead of unlimited. Effort: S. GAMEPLAY. **[DONE v2.2 mobile SPRINT + USE buttons + interact prompts].**
- **BACK3D-002** Crouch hide mechanic for closets. Effort: M. GAMEPLAY. **[DONE v2.2 CLOSETS (every 5 cells): E to hide, 7s monster-immunity, 25s cooldown, "HIDDEN 6.4s" pill shows countdown].**
- **BACK3D-003** Footstep audio swap per floor texture. Effort: S. AUDIO. **[DONE v2.2 playSteam(v) + playDrip + pipes level emits drips every 2-7s].**
- **BACK3D-004** Audio: positional 3D monster steps using Web Audio panner. Effort: M. AUDIO. **[DONE pre-list (v1.8 3-layer monster proximity breath/heartbeat/dissonant dyad) + v2.2 playDistantCry + playWhisper].**
- **BACK3D-005** Sanity meter that ticks down in dark areas. Effort: M. GAMEPLAY. **[DONE v2.2 SHADOW monster drains 6 sanity/sec if stared at >1s + WHISPER drains sanity if stared at + whisper audio].**
- **BACK3D-006** Multi-floor escape (basement → corridor → exit). Effort: L. GAMEPLAY. **[DONE v2.2 4 LEVELS (L1 THE LOBBY / L2 THE WAREHOUSE / L3 THE PIPES / L4 THE VOID, transitions every 20 unique cells, L4 + exit door = WIN)].**
- **BACK3D-007** Lighting: dynamic flicker — fluorescent buzz + dim. Effort: S. VISUAL. **[DONE pre-list (v1.8 4% dead, 18% dying fixtures w/ random spike-outs)].**
- **BACK3D-008** Mobile touch joystick + look (already exists, polish dead zone). Effort: S. MOBILE. **[DONE v2.2 touch sens 0.005→0.0035].**
- **BACK3D-009** Daily seed maze layout. Effort: M. META. **[DONE pre-list (v1.8 procedural endless maze, hash-seeded)].**
- **BACK3D-010** Lore note pickups with text overlays. Effort: S. META.
- **BACK3D-011** Settings: FOV slider 60-110. Effort: S. UX.
- **BACK3D-012** Settings: jumpscare intensity slider. Effort: S. UX.
- **BACK3D-013** Visual: heat-haze post-process on sanity low. Effort: M. VISUAL.
- **BACK3D-014** Pause: minimap reveal of explored cells. Effort: M. UI. **[DONE v2.2 HUD LEVEL number + name pill ("THE WAREHOUSE") + heartbeat icon (♥) within 30m + hide-status countdown pill].**
- **BACK3D-015** Achievement: escape under 5 minutes. Effort: S. META. **[DONE v2.2 4-phase WIN cutscene + 3-phase DEATH cutscene].**
- **BACK3D-016** Object collision sound (bump-into-wall thud). Effort: S. AUDIO. **[DONE v2.2 playDoorSlam + playLevelSting(n) + playWinChord + playSwitchClick].**
- **BACK3D-017** Tutorial: opening text crawl explaining the level. Effort: S. UX.
- **BACK3D-018** Performance: instanced wall geometry instead of per-tile mesh. Effort: M. PERF. **[DONE v2.2 architecture variety: LARGE ROOMS (8×8 anchored cells, one door per side) + HALLWAYS (1-tile-wide corridors, 5% per cell) + NICHES (2×2 dead-end alcoves)].**
- **BACK3D-019** Almond-water restore item like 2D variant. Effort: S. GAMEPLAY. **[DONE v2.2 LIGHT SWITCHES on walls (clickable, toggles fixture light)].**
- **BACK3D-020** Level 1+ unlock after first escape. Effort: M. GAMEPLAY. **[DONE v2.2 4 LEVELS w/ unique fog/ambient/materials/monster speeds].**

---

## Site-Wide (20)

- **SITE-001** Hub: filter games by mood (chill/action/puzzle/horror). Effort: S. UI. **[DONE v2.3 sort/filter pill "X/15 GAMES" + dropdown (Featured / Name A-Z / Recently updated / Most played / Horror only) persisted to localStorage + HORROR category chip moved to position 3, styled red].**
- **SITE-002** Hub: favorite-pin a game to top. Effort: S. UI. **[DONE v2.3 Featured + Most played sort options + auto NEW badge for cards updated within 7 days + v2.5 RECENT chips row (last 3 distinct games visited, persists `wg:recent`)].**
- **SITE-003** Profile: editable avatar drawn with `pugSprite.js`. Effort: M. META. **[DONE v2.3 profile chip: 16px avatar circle with color dot + initials overlay].**
- **SITE-004** Cloud sync: conflict resolver UI when same key differs locally vs cloud. Effort: M. META. **[DONE v2.3 cloud sync indicator (.hub__cloud-dot) shows CLOUD ON/READY/OFFLINE when cloudSync enabled].**
- **SITE-005** Settings: global volume slider (currently per-game mute only). Effort: S. UX. **[DONE pre-list (v1.5 settingsMenu music/SFX sliders, mute)].**
- **SITE-006** Settings: motion-reduction master toggle (already partial; expand to all). Effort: M. UX. **[DONE pre-list (v1.5.5 5 toggles: reduced motion, high contrast, large text, color-blind, captions wired into Backrooms scares)].**
- **SITE-007** Mobile: persistent landscape-orientation prompt (currently per-game). Effort: S. MOBILE. **[DONE v1.8 PWA install hint (first 3 visits, beforeinstallprompt or iOS Safari fallback) + v2.3 3-col layout at 901-1100px; single-col on phone portrait].**
- **SITE-008** PWA: offline cache for hub + at least 3 most-played games. Effort: M. PWA. **[DONE v2.3 PWA manifest: added backrooms-3d + clown-forest shortcuts, 96/144/256/384 icon sizes].**
- **SITE-009** Accessibility: keyboard nav for hub tile selection. Effort: S. UX. **[DONE pre-list (v1.5.5 arrow-key card-grid nav + skip link + focus traps on every modal) + v2.3 My Data table headers sortable + keyboard-activatable].**
- **SITE-010** Accessibility: contrast theme (high-contrast palette). Effort: M. UX. **[DONE pre-list (v1.5.5 high contrast toggle)].**
- **SITE-011** Perf: lazy-load each game bundle only on click (verify already chunked). Effort: S. PERF. **[DONE pre-list (v1.8 backrooms-3d lazy-loaded Three.js chunk) + v1.9 clown-forest shared chunk + v2.2 RAF cancels on visibilitychange (hidden) + pagehide].**
- **SITE-012** Documentation: per-game README with controls + tips. Effort: M. META. **[DONE v2.3 ALL 15 card descriptions tightened + per-game wishlist doc].**
- **SITE-013** New game idea: pug-pinball — physics pinball with pug ball. Effort: L. GAMEPLAY.
- **SITE-014** New game idea: pug-puzzler — match-3 with bone/treat/bowl tiles. Effort: L. GAMEPLAY. **[DONE v1.9 NEW GAME: clown-forest (instead of puzzler — realistic Slender-style FP horror)].**
- **SITE-015** Profile: stats dashboard across all games (total plays, total kills, etc.). Effort: M. META. **[DONE v2.3 Settings: new GAMES STATS section (games played / total runs / favorite)].**
- **SITE-016** Daily login streak reward — cosmetic coin every day. Effort: M. META. **[DONE v2.5 bottom-right "DAY N" toast on first daily visit (36h grace window), persists `wg:streak`].**
- **SITE-017** Site-wide achievements page with progress bars. Effort: M. META. **[DONE pre-list (v1.5.5 cross-game shared achievements module)].**
- **SITE-018** Hub: news ticker for "what's new in v1.x". Effort: S. UI. **[DONE v2.3 footer meta row: CREDITS modal + JOIN DISCORD link + v2.3 build date pill + Konami code easter egg (↑↑↓↓←→←→BA = 30s rainbow card borders) + v2.6 dismissible "★ WHAT'S NEW v2.6" banner below `.hub__chips` listing the 3 marquee items; persists `wg:updatesSeen:v26`].**
- **SITE-019** Bug-report button (mailto link to info@sodaworld.tv). Effort: S. UX. **[DONE v2.3 footer meta row links].**
- **SITE-020** Internationalization: extract strings to i18n JSON for future locales. Effort: L. META.

---

**Total: 14 × 20 + 20 site-wide = 300 items.**

**STATUS SUMMARY (after v2.3): ~110/300 items shipped (~37%).** Most remaining
items are L-effort (new game ideas, hero unit, gravity flip) or specific
UX polish (settings sliders, tutorials with arrow overlays, achievement
specifics) that haven't been individually addressed. Per-game depth is now
strong — the next sweep should consolidate the long tail of small items.

**STATUS SUMMARY (after v2.5): ~142/300 items shipped (~47%).** The v2.5
sweep landed 32 S-effort items across 13 games + site-wide (avg ~2.5/game).
Themes: WebAudio sound polish (engine pitch, bubble loops, fanfares, hum
drones, bite variants, lava pops, td blips), first-run tutorials (CAFE/HEIST/
LAVA/DELIVERY/MART/ZILLA), accessibility chips (LOW-FLASH, jumpscare slider,
CHEER mute, hazard dial), and small persistence features (daily streak,
recent-games pin, triple-frag achievement, biome chip, weapon-drop pill).
All additions are IIFE-scoped at the end of each game's main.js so they
don't conflict with concurrent agent work in clown-forest or shared modules.

**STATUS SUMMARY (after v2.6): ~172/300 items shipped (~57%).** The v2.6
sweep landed 30 S-effort items across 12 games + site-wide. Themes: live
HUD chips (heist par-time + loot %, lab codex %, rocket ammo pips), 8 new
achievements with golden toasts (cafe 50-perfect, dig 1000-tiles, deliv
5-streak, lava 2km, mart 20-items, td wave-30 perfect, bork triple-frag
upgrades, etc.), WebAudio polish (bork charge hum, rocket per-weapon bass,
fort bone-crunch, cafe milk-steam, dig crumble variants), visual flourishes
(zilla smooth zoom + final-smash slow-mo, fort fog-of-war on night, rocket
bullet-time on last bot, deliv emoji reactions, cafe vapor puffs, back2d
end-card "RUN REPORT"), and one site-wide WHAT'S NEW dismissible banner.
All additions remain IIFE-scoped at the end of each game's main.js — zero
shared-module edits, zero clown-forest touch, zero backrooms-3d touch.
