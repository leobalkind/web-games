# BORK BATTLE — Map Design: The Neon Dog Park (After Dark)

## Concept

A surreal, glowing public dog park at midnight. The kind of place that shouldn't exist but does — neon fences buzzing, treat fountains spurting like Vegas water shows, audience pugs lining the sides cheering. The whole map is alive.

## Size & Layout

- **Size: Medium with distinct zones** — big enough to feel like a real arena with personality, small enough that 1-3 minute matches stay frantic.
- **Layout: PROCEDURAL — regenerates each match.** No memorized routes. No pre-camping. Every match feels fresh.
- **Generation rules:**
  - Always has a centerpiece (Frisbee Tornado)
  - Always has 3–5 Treat Fountains scattered
  - 6–10 Hydrants placed semi-randomly
  - Neon fences/ramps form roughly 30% of the playfield as cover/traversal
  - Edges are always traversable (no map-corner exploits)
  - Spawn points stay outside the initial damage zone

## Shrinking Damage Zone (Battle-Royale style)

The defining mechanic that drives matches to a conclusion.

- Match starts with the safe zone covering the full map.
- After 30s, an outer ring becomes the **DANGER ZONE** — a glowing magenta border begins to creep inward.
- Stepping out of the safe zone = continuous heavy damage (HP drains fast).
- Zone shrinks in 3–4 phases over the match:
  - Phase 1 (0:30–1:00): Outer 20% becomes danger
  - Phase 2 (1:00–1:30): Half the map is gone
  - Phase 3 (1:30–2:00): Forces players into the center brawl
  - Phase 4 (2:00+): Tiny final zone — winner takes all
- Visual: a wall of glowing magenta pixel-fire creeping inward, audience pugs on the SAFE side watching it, audience pugs in the DANGER side are now frantic glitchy ghosts.

## Map Features (locked)

### 🌪️ Rainbow Frisbee Tornado (center hotspot)
- Permanent feature in the middle of every map.
- Whirling vortex of multicolored frisbees that orbit a central column.
- **Risk:** stepping inside damages you and knocks you around.
- **Reward:** rare loot drops INSIDE the tornado (legendary energy, mythical-tier evolution chances).
- Creates the constant central brawl that defines the match's climax.

### ⛲ Treat Fountains (XP geysers, 3–5 per map)
- Glowing fountains that periodically *erupt* with energy treats.
- Each fountain has its own color (gold/pink/blue/green) — the energy color affects evolution paths.
- Fountains pulse on a 12-second cycle: 8s charging (visible glow buildup) → 4s eruption (treats fly out).
- Players camp them = predictable engagements + counter-camping.

### 🚿 Glowing Fire Hydrants (interactive, 6–10 per map)
- Bork at one to release a high-pressure water-jet that knocks pugs around in a cone.
- After use, hydrant goes dim and recharges in 15s.
- Strategic uses:
  - Knock an opponent OUT of the safe zone
  - Create an emergency "panic button" when surrounded
  - Slingshot yourself by riding the jet

### 🚧 Neon Fences + Ramps (cover/traversal)
- Glowing chain-link sections (cyan/magenta) that block bullets but not vehicles (you can drive through with a small slowdown).
- Ramps allow vehicles to **launch** — air-time gives invincibility for 0.4s but no shooting.
- Procedurally placed to form chase corridors and hiding spots.
- Some fences are **destructible** by Tier-3 attacks — long-running matches reshape the map.

## Atmosphere (locked)

### 🐶 Audience Pugs (the soul of the map)
- Crowd of tiny pixel pugs lining the entire perimeter, watching the action.
- **They REACT live:**
  - Hold up signs ("BORK!" "BONK!" "OOF!" "GG")
  - Do the wave when someone scores a kill
  - Boo when someone camps too long
  - Cheer-pose when the match-winner is decided
  - Briefly turn into ghosts in zones that have become DANGER (great visual signal)
- Adds personality, life, and a meta layer (it feels like a tournament).

### Additional ambient layers (free polish)
- Pixel-art neon stars + crescent moon overhead, subtle parallax
- Light pixel rain in some matches (random weather event)
- Distant neon billboard pugs in the background
- Glow-in-the-dark frisbees occasionally fly across the sky

## Random Match Events (every 30–45s)

Procedural events that shake up matches and create memorable moments:

- **🦴 Bone Drop** — a giant golden bone falls from the sky, contested loot
- **🌧️ Treat Storm** — sudden burst of falling treats covers the map
- **🌑 Moonlight** — Werewolf Pug gains 2× damage; map dims briefly
- **🎆 Fireworks** — 5s of random explosions, no aim, pure chaos
- **🐾 Stampede** — wild ghost-pugs run across the map, knocking everyone around
- **🎵 Beat Drop** — DJ Pug's signature, all damage syncs to the beat for 10s

## Technical notes for procedural generation

- Use seeded random per-match (could share a "room code" for friends to play same map)
- Layout = grid of ~20×15 cells, each cell is empty / fence / ramp / hydrant / fountain
- Constraint solver to ensure: connected paths, fountain spacing, no spawn-camping
- Tornado anchored to grid center
- Grid size scales with player count (more bots = bigger map)
