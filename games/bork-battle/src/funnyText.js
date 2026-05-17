// Random funny text. The personality of the game lives here.

export const BARKS = [
  'BORK!', 'AROO!', 'yip yip', 'BONK', 'mlem', 'snoot.', 'doot doot',
  '*confused snort*', 'heckin', 'wow', 'such bork', 'bork.', 'awoo~',
  'yipyipyip', 'BARK BARK', '*loud sniff*', 'borfff', 'YIPPEE',
];

export const TAUNTS = [
  'gg ez', 'skill issue', 'bonk that pug',
  'i am the bork', 'who let the dogs out',
  'meme dimension entered', 'such pug', 'very bork',
  'bork supremacy', 'L + ratio', 'bork or be borked',
];

export const KILL_VERBS = [
  'BONKED', 'YEETED', 'BORKED', 'DOOTED', 'SNOOTED',
  'CHONKED', 'BAMBOOZLED', 'OWNED', 'WHEEZED', 'DEPUGGED',
];

export const ZONE_DEATH_LINES = [
  'wandered into the void',
  'forgot how to safe zone',
  'got dissolved by pink',
  'YEETED itself off the map',
  'absorbed by the magenta nope',
  'became one with the danger',
];

// Bot pug name generator — composes parts. Slightly unhinged on purpose.
const BOT_PREFIX = [
  'Sir', 'Big', 'Smol', 'Lord', 'Captain', 'Doctor',
  'Mr', 'Ms', 'Lil', 'Mega', 'Ultra', 'Tiny', 'Gigantic',
  'King', 'Queen', 'Hecking', 'The',
];

const BOT_CORE = [
  'Bork', 'Snoot', 'Loaf', 'Chonk', 'Mlem', 'Boop',
  'Doot', 'Awoo', 'Yip', 'Floof', 'Cheems', 'Pugma',
  'Walter', 'Doge', 'Bonk', 'Zoom', 'Borf',
];

const BOT_SUFFIX = [
  '420', '69', '_xX', '999', 'Lord', 'Master',
  'Supreme', 'III', 'Jr', '2.0', 'Prime', '_OG',
  '', '', '', '', // weight to no-suffix
];

export function generateBotName(rng) {
  const usePrefix = rng() < 0.5;
  const useSuffix = rng() < 0.55;
  const prefix = usePrefix ? BOT_PREFIX[Math.floor(rng() * BOT_PREFIX.length)] + ' ' : '';
  const core = BOT_CORE[Math.floor(rng() * BOT_CORE.length)];
  const suffix = useSuffix ? BOT_SUFFIX[Math.floor(rng() * BOT_SUFFIX.length)] : '';
  return (prefix + core + suffix).slice(0, 18);
}

export const AUDIENCE_SIGNS = ['BORK!', 'BONK!', 'OOF', 'GG', '!!!', 'YES', 'WOW', 'AWOO', 'L', 'W', '???', 'OMG'];

export const RANDOM_EVENTS = [
  { name: 'BONE DROP', desc: 'Golden bone falls. Contested loot incoming.' },
  { name: 'TREAT STORM', desc: 'It rains energy. Get rich.' },
  { name: 'MOONLIGHT', desc: 'Werewolves get spicy.' },
  { name: 'FIREWORKS', desc: 'Random booms. No aim. Pure chaos.' },
  { name: 'BEAT DROP', desc: 'Damage syncs to the beat.' },
  { name: 'ZOOM ZOOM', desc: 'Everyone moves 2x faster.' },
  { name: 'BORK FEST', desc: 'Free borks for everyone.' },
];

export function rndPick(arr, rng = Math.random) {
  return arr[Math.floor(rng() * arr.length)];
}

export function killMessage(killer, victim, byZone = false, rng = Math.random) {
  if (byZone) {
    return `${victim} ${rndPick(ZONE_DEATH_LINES, rng)}.`;
  }
  return `${killer} ${rndPick(KILL_VERBS, rng)} ${victim}!`;
}
