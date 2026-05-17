// =============================================================================
// Weapons + skins.
//
// Each weapon modifies the wielder's base stats (damage and fire rate are
// MULTIPLICATIVE on the character's form values, so a Tier-3 Pug-Zilla with
// a Sniper still feels stronger than a Tier-0 Bork Pup with a Sniper).
//
// Stats are tuned to give each weapon a distinct feel:
//  - Pistol  = balanced baseline
//  - AR      = fast rapid fire, low single-shot damage
//  - Shotgun = many pellets at once, slow reload
//  - Sniper  = slow heavy single shots, fastest projectile
// =============================================================================

export const WEAPONS = {
  // Pistol — buffed baseline. Reliable, decent damage, fast reload.
  pistol: {
    id: 'pistol',
    name: 'PISTOL',
    icon: '🔫',
    dmgMult: 1.4,        // was 1.0
    fireRateMult: 1.2,   // was 1.0
    magSize: 14,         // was 12
    reloadTime: 0.9,     // was 1.0
    pellets: 1,
    spread: 0.02,
    projSpeedMult: 1.05,
    desc: 'Reliable. Hits hard for a sidearm.',
  },
  // AR — nerfed: smaller mag, slower fire, no longer eats close range.
  // Damage falloff at close range applied in Game._fireProjectile.
  ar: {
    id: 'ar',
    name: 'AR',
    icon: '🪖',
    dmgMult: 0.45,       // was 0.55
    fireRateMult: 2.0,   // was 2.6
    magSize: 22,         // was 30
    reloadTime: 2.0,     // was 1.7
    pellets: 1,
    spread: 0.10,        // was 0.07 — less accurate
    projSpeedMult: 1.1,
    closeRangeFalloff: true, // marker: damage drops when target is very close
    desc: 'Rapid fire. Bad in your face. Bigger spread.',
  },
  // Shotgun — buffed massively. More pellets, more damage per pellet,
  // tighter pattern at close range.
  shotgun: {
    id: 'shotgun',
    name: 'SHOTGUN',
    icon: '💥',
    dmgMult: 0.75,       // was 0.40 (now 0.75 × 8 pellets = 6× pistol close)
    fireRateMult: 0.55,
    magSize: 7,          // was 6
    reloadTime: 1.6,     // was 1.9 — faster reload to feel viable
    pellets: 8,          // was 6
    spread: 0.30,
    projSpeedMult: 0.95,
    desc: '8 pellets. King at close range.',
  },
  // Sniper — buffed: bigger one-shots, faster projectile, still slow.
  sniper: {
    id: 'sniper',
    name: 'SNIPER',
    icon: '🎯',
    dmgMult: 4.2,        // was 3.6
    fireRateMult: 0.35,  // was 0.30
    magSize: 5,          // was 4
    reloadTime: 1.9,     // was 2.1
    pellets: 1,
    spread: 0,
    projSpeedMult: 1.9,  // was 1.7
    desc: 'Slow. DEADLY. One shot one bork.',
  },
};

// Skin tints override the projectile color when set.
// `null` means use the character's form-defined projectile color.
export const SKINS = {
  default: { id: 'default', name: 'Default', swatch: 0xc8d0d8, tint: null },
  neon:    { id: 'neon',    name: 'Neon',    swatch: 0xff3aa1, tint: 0xff3aa1 },
  gold:    { id: 'gold',    name: 'Gold',    swatch: 0xffd700, tint: 0xffd700 },
  camo:    { id: 'camo',    name: 'Camo',    swatch: 0x6aaa6a, tint: 0x6aaa6a },
};

export function defaultWeapon() { return WEAPONS.pistol; }
export function defaultSkin() { return SKINS.default; }
