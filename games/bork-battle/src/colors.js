export const COLORS = {
  bg: 0x110a26,
  bgDeep: 0x0a0716,
  grid: 0x1f1340,
  gridGlow: 0x3a1d6e,

  pink: 0xff3aa1,
  cyan: 0x4cc9f0,
  yellow: 0xffd23f,
  green: 0x5ef38c,
  magenta: 0xff2bd6,
  white: 0xffffff,
  black: 0x0a0716,
  shadow: 0x000000,

  pugCinnamon: 0xc8854a,
  pugBrown: 0x6b3a1c,
  pugCream: 0xf5d49c,
  pugBlack: 0x1a0d05,

  zoneEdge: 0xff2bd6,
  zoneInside: 0x4a0a55,

  hydrant: 0xff3a3a,
  hydrantGlow: 0xff8a8a,

  treat: 0xffd23f,
  treatGlow: 0xfff0a0,

  fountain: 0x5ef38c,

  fence: 0x4cc9f0,
  fenceDim: 0x1d4a5a,

  ramp: 0xff8e3c,

  audience: 0x9aa0c1,
};

export function shade(hex, factor) {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.min(255, (hex & 0xff) * factor));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}
