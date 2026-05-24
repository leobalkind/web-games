// =============================================================================
// Difficulty presets — scale bot/player HP + damage + reward economy.
// Picked at start; applied throughout the match.
// =============================================================================

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'EASY',
    icon: '🌟',
    iconName: 'gem',
    botHpMult: 0.65,
    botDmgMult: 0.6,    // damage bots deal to player
    playerHpMult: 1.35,
    playerDmgMult: 1.25, // damage player deals to bots
    xpMult: 1.3,
    moneyMult: 1.5,
    desc: 'Bots are squishy. You hit hard + live long.',
  },
  normal: {
    id: 'normal',
    name: 'NORMAL',
    icon: '⚔️',
    iconName: 'shield',
    botHpMult: 1.0,
    botDmgMult: 1.0,
    playerHpMult: 1.0,
    playerDmgMult: 1.0,
    xpMult: 1.0,
    moneyMult: 1.0,
    desc: 'Balanced. As designed.',
  },
  hard: {
    id: 'hard',
    name: 'HARD',
    icon: '💀',
    iconName: 'skull',
    botHpMult: 1.5,
    botDmgMult: 1.35,
    playerHpMult: 0.85,
    playerDmgMult: 0.95,
    xpMult: 0.9,
    moneyMult: 0.85,
    desc: 'Bots are tougher and hit harder. Glory awaits.',
  },
  // MAYHEM — endgame chaos: 10 elite bots + faster shrinking zone + bonus XP/$.
  // Bot composition is enforced separately (see Game._spawnBot eliteRatio).
  // Polish R2: bumped XP+money rewards (was 1.6) so the risk/reward feels
  // worthwhile vs HARD difficulty (which is now closer in baseline difficulty).
  mayhem: {
    id: 'mayhem',
    name: 'MAYHEM',
    icon: '🔥',
    iconName: 'flame',
    botHpMult: 1.7,
    botDmgMult: 1.55,
    playerHpMult: 0.85,
    playerDmgMult: 1.0,
    xpMult: 2.0,        // was 1.6 — better risk/reward
    moneyMult: 1.9,     // was 1.6 — better risk/reward
    eliteRatio: 0.8,    // 80% of bots will be elites
    zoneSpeedMult: 1.6, // shrink interval cut by 1/1.6
    desc: '10 elite bots. Faster zone. 2× XP / 1.9× $.',
  },
};

export function defaultDifficulty() { return DIFFICULTIES.normal; }

// =============================================================================
// LOADOUT PERKS — passive boosts the player picks alongside difficulty/weapon.
// Each perk applies a fixed-value tweak to player.bonus + tag flags. Picked
// from the start screen; applied in Game.start() before the first frame.
// =============================================================================
export const PERKS = {
  none: {
    id: 'none', name: 'NONE', icon: '·',
    apply: (_p) => { /* no-op */ },
    desc: 'No perk. Pure baseline.',
  },
  run_and_gun: {
    id: 'run_and_gun', name: 'RUN & GUN', icon: '⚡',
    apply: (p) => { p.bonus.spdMult *= 1.15; },
    desc: '+15% movement speed.',
  },
  glass_cannon: {
    id: 'glass_cannon', name: 'GLASS CANNON', icon: '💥',
    apply: (p) => {
      p.bonus.dmgMult *= 1.30;
      // -30% HP — applied via tag handling in Game (after maxHp is computed).
      p.bonus.hpPctMult = (p.bonus.hpPctMult || 1) * 0.70;
    },
    desc: '+30% damage. -30% max HP.',
  },
  tank: {
    id: 'tank', name: 'TANK', icon: '🛡️',
    apply: (p) => {
      p.bonus.hp += 40;
      p.bonus.spdMult *= 0.88;
    },
    desc: '+40 HP. -12% speed.',
  },
  vampire: {
    id: 'vampire', name: 'VAMPIRE', icon: '🩸',
    apply: (p) => { p.bonus.lifestealPct += 0.15; },
    desc: '+15% lifesteal.',
  },
};
export function defaultPerk() { return PERKS.none; }
