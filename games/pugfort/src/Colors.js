export const COLORS = {
  bg: 0x0a0716,
  bgDeep: 0x050310,
  ground: 0x14102a,
  groundDark: 0x0e0a1f,
  grass: 0x1a3a2a,
  asphalt: 0x222234,

  neonPink: 0xff3aa1,
  neonCyan: 0x4cc9f0,
  neonYellow: 0xffd23f,
  neonGreen: 0x5ef38c,
  neonOrange: 0xff8e3c,
  magenta: 0xff2bd6,
  white: 0xffffff,
  black: 0x0a0716,

  // Pug palette
  pugFur: 0xc8854a,
  pugFurHi: 0xe5a06a,
  pugFurShade: 0x8e5a2c,
  pugMask: 0x1a0d05,
  pugBrown: 0x6b3a1c,
  pugCream: 0xfde0b8,
  pugTongue: 0xff8aa8,

  // Zombie palette
  zombieGreen: 0x6aaa5a,
  zombieGreenHi: 0x9ad08a,
  zombieGreenShade: 0x3a6a3a,
  zombieEye: 0xff3030,
  zombieEyeGlow: 0xff8080,
  zombieDrip: 0x6a3a3a,
  bloodRed: 0xc8281f,

  // Wood + walls
  wood: 0x8a5a2c,
  woodHi: 0xc8a878,
  woodDark: 0x4a2a0c,
  woodLog: 0xa6753a,

  // Lighting
  lampGlow: 0xfff0a8,
  lampDim: 0x4a3a1a,

  // Day/night tints
  dayTint: 0xffd28a,
  duskTint: 0xff6a3a,
  nightTint: 0x1a2050,
  dawnTint: 0xff9aaa,
};

export function shade(hex, factor) {
  const r = Math.max(0, Math.min(255, ((hex >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.min(255, ((hex >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.min(255, (hex & 0xff) * factor));
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}
