# PUGFORT.EXE — Design Document (restart)

## Vision (from user)

> Create a highly detailed browser-based multiplayer survival defense game
> called PUGFORT.EXE where players control adorable but highly expressive
> high-poly pugs surviving a zombie apocalypse in a ruined neon-lit suburban
> world. The game should combine scavenging, exploration, base building,
> wave survival, progression systems, co-op multiplayer, random events,
> physics chaos, and cinematic boss fights.

Players explore detailed handcrafted environments during the day to collect
resources, rescue survivor pugs, loot abandoned buildings, and build
increasingly advanced shelters with walls, traps, electric fences, turrets,
generators, towers, and mechanical defenses before massive zombie hordes
attack at night.

### Soul

- World feels alive: flickering neon signs, rain, sparks, smoke,
  destruction, debris, atmospheric audio
- Pugs are adorable + highly expressive + emotionally read as characters
- Combat = satisfying, chaotic, funny, weighty
- Loop = addictive: prep → defend → upgrade → harder waves → bigger fortress
- Enemy variety: runners, tanks, screamers, diggers, spitters, cloaked
  infected, giant cinematic bosses (mutated zombie pug monsters)
- Random events: storms, blackouts, toxic fog, boss invasions

### Gameplay loop

Each match split into two phases:

1. **DAY** — players explore, collect resources, loot, rescue survivors,
   repair structures, build/upgrade base. Limited time + resources. Prep
   for the attack.
2. **NIGHT** — zombie hordes spawn from different map areas and attack the
   base. Behaviors: climbing, breaking walls, digging underground,
   targeting weak points. Nights escalate — more enemies, new types, bosses.

Players earn resources + tech + upgrades by surviving waves → unlock
stronger defenses, weapons, vehicles, automation, bigger fortresses.

## Tech (decided)

**2D top-down with PixiJS** — same stack as BORK BATTLE. No 3D, no Blender.

### Why 2D
- The 3D-realism dream needs a full art team and months of work to look right
- 2D top-down PixiJS lets us ship a polished, playable, atmospheric slice
  in HOURS
- The SOUL (pugs vs zombies, day/night, build, atmosphere) translates fine
  to 2D — proven by Vampire Survivors, Brotato, Project Zomboid
- Already-installed dependency
- Reuse BORK BATTLE's pug drawing patterns (chunky pixel pugs with
  detailed shading) for instant aesthetic consistency

### Visual approach
- Top-down 3/4 view (slight tilt so faces are visible — Brotato-style)
- Dense, detailed pixel art per entity
- Atmosphere via PixiJS overlays:
  - Dark vignette
  - Drifting fog particles
  - Radial glow circles around streetlamps
  - Rain streaks
  - Day/night tint shift on the world container
  - Wet neon reflection stripes on the ground

## Vertical Slice 1 (this turn)

Single match flow that ships **fully playable** end-to-end:

- **Player pug** — WASD movement, mouse aim, click to fire pistol
- **Map** — procedural neon-suburb playfield. Streetlamps with flickering
  light pools. Buildings around the edges. Wet asphalt with neon stripes.
  Scattered crashed-car silhouettes + debris piles + dumpsters.
- **Zombie type** — Walker (green pug with glowing red eyes). Spawns from
  map edges. Walks toward player. Deals contact damage.
- **Day/night** — 30s day + 45s night. Visible sunset/midnight tint shift
  on a full-screen overlay. Distant siren during sunset transition.
- **Wood resource** — scattered logs. Walk over to collect. Killed zombies
  also drop wood.
- **Build mode** — press B → ghost wall preview at cursor. Click to place
  (costs 5 wood). Walls block zombies physically.
- **HUD** — HP bar · Wood count · Day counter · Time-of-day pip · Build
  hotkey hint
- **Win** — survive 3 nights → SUCH WIN
- **Lose** — HP hits 0 → GAME OVER

### Out of slice 1 (deferred)
- Multiplayer co-op (Colyseus)
- More zombie types (Runner, Tank, Screamer, Digger, Spitter, Cloaker,
  Exploder)
- Other defenses (turret, spike trap, electric fence, generator, drone)
- Cinematic boss fights
- Weather events (acid rain, blizzard, thunderstorm)
- Vehicles
- Survivor rescue
- Customization / cosmetics
- Multiple maps (Mall, Toxic Park, Underground Lab)
- Progression / tech tree across matches

## Files (slice 1)

```
games/pugfort/
├── index.html
├── style.css
├── main.js
└── src/
    ├── Game.js       (main loop, day/night, win/lose)
    ├── World.js      (procedural neon suburb + lamps + decor)
    ├── Pug.js        (player entity, top-down pug)
    ├── Zombie.js     (zombie entity + AI)
    ├── Build.js      (wall placement system)
    ├── Projectile.js (bullets)
    ├── Hud.js
    ├── Input.js
    └── Colors.js
```

## Verification (slice 1 = done)

`http://localhost:5173/games/pugfort/` plays a full loop:

1. Click PLAY → spawn into foggy neon suburb
2. WASD moves, mouse aims, click fires pistol with muzzle flash
3. Walk over wood logs → collect
4. Day timer ticks down → sunset color → night arrives, zombies spawn
   from map edges
5. Zombies walk toward player + deal contact damage
6. Press B → ghost wall follows cursor → click to place
7. Walls physically block zombies
8. Survive 3 nights → SUCH WIN
9. Die → GAME OVER → replay
