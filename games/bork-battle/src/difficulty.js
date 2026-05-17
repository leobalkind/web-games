// =============================================================================
// Difficulty presets — scale bot/player HP + damage + reward economy.
// Picked at start; applied throughout the match.
// =============================================================================

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'EASY',
    icon: '🌟',
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
    botHpMult: 1.5,
    botDmgMult: 1.35,
    playerHpMult: 0.85,
    playerDmgMult: 0.95,
    xpMult: 0.9,
    moneyMult: 0.85,
    desc: 'Bots are tougher and hit harder. Glory awaits.',
  },
};

export function defaultDifficulty() { return DIFFICULTIES.normal; }
