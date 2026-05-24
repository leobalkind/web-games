import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';
import { profileKey } from '../../../src/shared/profile.js';

// =============================================================================
// MATERIALS — 4 resource types. Each buildable's cost is an object.
// =============================================================================
export const MATERIALS = {
  wood:        { id: 'wood',        icon: '🪵', iconName: 'biscuit',    name: 'Wood' },
  scrap:       { id: 'scrap',       icon: '🔩', iconName: 'gold',       name: 'Scrap' },
  explosives:  { id: 'explosives',  icon: '💣', iconName: 'smokeBomb',  name: 'Explosives' },
  electronics: { id: 'electronics', icon: '🔌', iconName: 'lightning',  name: 'Electronics' },
};

// =============================================================================
// BUILDABLE DEFINITIONS
// =============================================================================

// shared materials/colors
const WOOD = COLORS.wood, WOOD_HI = COLORS.woodHi, WOOD_DARK = COLORS.woodDark;
const NAIL = 0x222228, METAL = 0x5a5a62, METAL_HI = 0x9a9aa8, METAL_DARK = 0x2a2a32;
const BARREL = 0x18181c;

// ---------- WALL ----------
const WALL_W = 64, WALL_H = 20;
function createWallGraphic() {
  const c = new Container();
  const g = new Graphics();
  for (let i = 0; i < 4; i++) {
    const baseY = i * 5;
    const baseCol = i % 2 === 0 ? WOOD : WOOD_DARK;
    g.rect(0, baseY, WALL_W, 5).fill(baseCol);
    g.rect(0, baseY, WALL_W, 1).fill(shade(baseCol, 1.3));
    g.rect(0, baseY + 4, WALL_W, 1).fill(shade(baseCol, 0.6));
    for (let x = 4; x < WALL_W - 2; x += 3 + Math.floor(Math.random() * 3)) {
      g.rect(x, baseY + 2, 1, 1).fill(shade(baseCol, 0.6));
    }
    if (i === 1) g.circle(18, baseY + 2, 1.5).fill(shade(baseCol, 0.5));
    if (i === 3) g.circle(WALL_W - 14, baseY + 2, 1.5).fill(shade(baseCol, 0.5));
  }
  g.rect(0, 0, 4, WALL_H).fill(WOOD_DARK);
  g.rect(0, 0, 1, WALL_H).fill(shade(WOOD_DARK, 1.4));
  g.rect(WALL_W - 4, 0, 4, WALL_H).fill(WOOD_DARK);
  g.rect(WALL_W - 1, 0, 1, WALL_H).fill(shade(WOOD_DARK, 0.6));
  g.rect(WALL_W / 2 - 1, 0, 2, WALL_H).fill(WOOD_DARK);
  for (let i = 0; i < 4; i++) {
    g.circle(2, 2 + i * 5, 1).fill(NAIL);
    g.circle(WALL_W - 2, 2 + i * 5, 1).fill(NAIL);
    g.circle(WALL_W / 2, 2 + i * 5, 1).fill(NAIL);
  }
  g.rect(22, 8, 6, 1).fill({ color: 0x000000, alpha: 0.5 });
  g.rect(44, 13, 4, 1).fill({ color: 0x000000, alpha: 0.5 });
  c.addChild(g);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, WALL_W + 4, WALL_H + 4).stroke({ color: 0x4cc9f0, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- SANDBAG (cheap wall variant) ----------
const SAND_W = 44, SAND_H = 18;
function createSandbagGraphic() {
  const c = new Container();
  const g = new Graphics();
  // 3 stacked sandbags
  for (let i = 0; i < 3; i++) {
    const y = i * 5;
    const offsetX = (i % 2) * 4;
    g.rect(offsetX, y, SAND_W - 4, 6).fill(0x8a7a4a);
    g.rect(offsetX, y, SAND_W - 4, 1).fill(0xb0a070);
    g.rect(offsetX, y + 5, SAND_W - 4, 1).fill(0x5a4a2a);
    // cross-stitch
    g.rect(offsetX + 4, y, 1, 6).fill(0x6a5a3a);
    g.rect(offsetX + SAND_W - 12, y, 1, 6).fill(0x6a5a3a);
    g.rect(offsetX, y + 2, SAND_W - 4, 1).fill({ color: 0x000000, alpha: 0.2 });
  }
  c.addChild(g);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, SAND_W + 4, SAND_H + 4).stroke({ color: 0xffd23f, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- SPIKE TRAP ----------
const SPIKE_W = 36, SPIKE_H = 36;
function createSpikeGraphic() {
  const c = new Container();
  const g = new Graphics();
  // wooden base plate
  g.rect(0, 0, SPIKE_W, SPIKE_H).fill(WOOD_DARK);
  g.rect(0, 0, SPIKE_W, 2).fill(shade(WOOD_DARK, 1.4));
  g.rect(0, SPIKE_H - 2, SPIKE_W, 2).fill(0x1a0e05);
  g.rect(0, 0, 2, SPIKE_H).fill(shade(WOOD_DARK, 1.2));
  g.rect(SPIKE_W - 2, 0, 2, SPIKE_H).fill(shade(WOOD_DARK, 0.6));
  // grid of upward spikes
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const sx = 4 + i * 8;
      const sy = 4 + j * 8;
      g.rect(sx + 2, sy + 1, 2, 5).fill(0xb0b0b8);
      g.rect(sx + 2, sy + 1, 1, 5).fill(0xe0e0e8);
      g.rect(sx + 2, sy + 5, 2, 1).fill(0x666672);
      g.rect(sx + 3, sy, 1, 1).fill(0xffffff);
      // blood drips
      if (Math.random() < 0.4) g.circle(sx + 3, sy + 7, 1).fill(COLORS.bloodRed);
    }
  }
  c.addChild(g);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, SPIKE_W + 4, SPIKE_H + 4).stroke({ color: 0xff3a3a, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- MINE ----------
const MINE_W = 22, MINE_H = 22;
function createMineGraphic() {
  const c = new Container();
  const g = new Graphics();
  // round disc body
  g.circle(MINE_W / 2, MINE_H / 2, 10).fill(0x3a3a42);
  g.circle(MINE_W / 2, MINE_H / 2, 10).stroke({ color: 0x6a6a72, width: 1 });
  g.circle(MINE_W / 2, MINE_H / 2, 8).fill(0x2a2a32);
  // hazard stripes
  g.rect(2, MINE_H / 2 - 1, MINE_W - 4, 2).fill({ color: COLORS.neonYellow, alpha: 0.4 });
  // central blinking red light
  g.circle(MINE_W / 2, MINE_H / 2, 4).fill(COLORS.bloodRed);
  g.circle(MINE_W / 2, MINE_H / 2, 2).fill(0xffd0d0);
  g.circle(MINE_W / 2, MINE_H / 2, 1).fill(0xffffff);
  // antenna/trigger
  g.rect(MINE_W / 2 - 1, 1, 2, 4).fill(0x6a6a72);
  g.circle(MINE_W / 2, 1, 1).fill(COLORS.bloodRed);
  // bolt rivets
  g.circle(4, 4, 0.8).fill(0x222228);
  g.circle(MINE_W - 4, 4, 0.8).fill(0x222228);
  g.circle(4, MINE_H - 4, 0.8).fill(0x222228);
  g.circle(MINE_W - 4, MINE_H - 4, 0.8).fill(0x222228);
  c.addChild(g);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, MINE_W + 4, MINE_H + 4).stroke({ color: 0xff3a3a, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- TURRET (existing) ----------
const TURRET_W = 44, TURRET_H = 44;
function createTurretGraphic() {
  const c = new Container();
  const cx = TURRET_W / 2, cy = TURRET_H / 2;
  const base = new Graphics();
  base.circle(cx, cy + 4, 18).fill({ color: 0x4a4a52, alpha: 0.6 });
  base.circle(cx, cy + 4, 18).stroke({ color: 0x6a6a72, width: 1, alpha: 0.7 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 16;
    const by = cy + 4 + Math.sin(a) * 7;
    base.rect(bx - 4, by - 2, 8, 4).fill(0x8a7a4a);
    base.rect(bx - 4, by - 2, 8, 1).fill(0xa89a6a);
  }
  c.addChild(base);
  const ped = new Graphics();
  ped.rect(cx - 5, cy - 2, 10, 8).fill(METAL_DARK);
  ped.rect(cx - 5, cy - 2, 10, 2).fill(METAL_HI);
  ped.rect(cx - 5, cy + 5, 10, 1).fill(0x101014);
  c.addChild(ped);
  const body = new Graphics();
  body.rect(cx - 8, cy - 7, 14, 14).fill(METAL);
  body.rect(cx - 8, cy - 7, 14, 14).stroke({ color: METAL_DARK, width: 1 });
  body.rect(cx - 8, cy - 7, 14, 3).fill(METAL_HI);
  body.rect(cx - 8, cy + 4, 14, 3).fill(METAL_DARK);
  body.circle(cx - 6, cy - 5, 1).fill(NAIL);
  body.circle(cx + 4, cy - 5, 1).fill(NAIL);
  body.circle(cx - 6, cy + 5, 1).fill(NAIL);
  body.circle(cx + 4, cy + 5, 1).fill(NAIL);
  body.circle(cx + 2, cy, 1.6).fill(COLORS.neonCyan);
  body.circle(cx + 2, cy, 1).fill(0xffffff);
  c.addChild(body);
  const barrel = new Graphics();
  barrel.rect(cx + 6, cy - 1.5, 14, 3).fill(BARREL);
  barrel.rect(cx + 6, cy - 1.5, 14, 1).fill(METAL_HI);
  barrel.rect(cx + 6, cy + 1.5, 14, 1).fill(0x000000);
  barrel.rect(cx + 18, cy - 2.5, 3, 5).fill(BARREL);
  barrel.rect(cx + 18, cy - 2.5, 3, 1).fill(METAL_HI);
  barrel.circle(cx + 9, cy, 0.6).fill(0x000000);
  barrel.circle(cx + 12, cy, 0.6).fill(0x000000);
  barrel.circle(cx + 15, cy, 0.6).fill(0x000000);
  c.addChild(barrel);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, TURRET_W + 4, TURRET_H + 4).stroke({ color: 0x4cc9f0, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- SNIPER TURRET (bigger, longer barrel, scope) ----------
const SNIPER_W = 56, SNIPER_H = 56;
function createSniperTurretGraphic() {
  const c = new Container();
  const cx = SNIPER_W / 2, cy = SNIPER_H / 2;
  // larger sandbag perimeter
  const base = new Graphics();
  base.circle(cx, cy + 4, 22).fill({ color: 0x4a4a52, alpha: 0.6 });
  base.circle(cx, cy + 4, 22).stroke({ color: 0x6a6a72, width: 1, alpha: 0.8 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 20;
    const by = cy + 4 + Math.sin(a) * 9;
    base.rect(bx - 4, by - 2, 8, 4).fill(0x8a7a4a);
    base.rect(bx - 4, by - 2, 8, 1).fill(0xa89a6a);
  }
  c.addChild(base);
  const ped = new Graphics();
  ped.rect(cx - 6, cy - 3, 12, 9).fill(0x1a1a22);
  ped.rect(cx - 6, cy - 3, 12, 2).fill(0x9a9aa8);
  ped.rect(cx - 6, cy + 5, 12, 1).fill(0x000000);
  c.addChild(ped);
  // bigger body
  const body = new Graphics();
  body.rect(cx - 10, cy - 9, 18, 18).fill(METAL_DARK);
  body.rect(cx - 10, cy - 9, 18, 18).stroke({ color: 0x000000, width: 1 });
  body.rect(cx - 10, cy - 9, 18, 3).fill(METAL_HI);
  body.rect(cx - 10, cy + 6, 18, 3).fill(0x000000);
  // ammo box on side
  body.rect(cx - 12, cy - 3, 4, 8).fill(0x4a3a2a);
  body.rect(cx - 12, cy - 3, 4, 1).fill(0x6a5a4a);
  // scope on top
  body.rect(cx - 3, cy - 12, 8, 4).fill(0x222228);
  body.circle(cx + 5, cy - 10, 2).fill(COLORS.neonGreen);
  body.circle(cx + 5, cy - 10, 1).fill(0xffffff);
  // rivets
  body.circle(cx - 8, cy - 7, 1).fill(NAIL);
  body.circle(cx + 6, cy - 7, 1).fill(NAIL);
  body.circle(cx - 8, cy + 7, 1).fill(NAIL);
  body.circle(cx + 6, cy + 7, 1).fill(NAIL);
  c.addChild(body);
  // LONG sniper barrel
  const barrel = new Graphics();
  barrel.rect(cx + 8, cy - 2, 22, 4).fill(BARREL);
  barrel.rect(cx + 8, cy - 2, 22, 1).fill(METAL_HI);
  barrel.rect(cx + 8, cy + 2, 22, 1).fill(0x000000);
  // muzzle
  barrel.rect(cx + 28, cy - 3, 4, 6).fill(BARREL);
  barrel.rect(cx + 28, cy - 3, 4, 1).fill(METAL_HI);
  // grooves
  barrel.rect(cx + 14, cy, 1, 1).fill(0x000000);
  barrel.rect(cx + 18, cy, 1, 1).fill(0x000000);
  barrel.rect(cx + 22, cy, 1, 1).fill(0x000000);
  c.addChild(barrel);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, SNIPER_W + 4, SNIPER_H + 4).stroke({ color: 0x5ef38c, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- ACID TURRET (unlockable — sprays a green acid pool that damages
// zombies standing in it; weak per-tick but big AOE). Pixel-art: spiked
// barrel + bubbling green tank on top. Used to differentiate from plain TURRET.
const ACID_W = 44, ACID_H = 44;
function createAcidTurretGraphic() {
  const c = new Container();
  const cx = ACID_W / 2, cy = ACID_H / 2;
  // base — same pad as turret so visual language matches
  const base = new Graphics();
  base.circle(cx, cy + 4, 18).fill({ color: 0x2a4a2a, alpha: 0.7 });
  base.circle(cx, cy + 4, 18).stroke({ color: 0x4a7a4a, width: 1, alpha: 0.8 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 16;
    const by = cy + 4 + Math.sin(a) * 7;
    base.rect(bx - 4, by - 2, 8, 4).fill(0x6a8a4a);
    base.rect(bx - 4, by - 2, 8, 1).fill(0x9af09a);
  }
  c.addChild(base);
  // pedestal
  const ped = new Graphics();
  ped.rect(cx - 5, cy - 2, 10, 8).fill(0x2a3a2a);
  ped.rect(cx - 5, cy - 2, 10, 2).fill(0x4a6a4a);
  c.addChild(ped);
  // body (greenish armor)
  const body = new Graphics();
  body.rect(cx - 8, cy - 7, 14, 14).fill(0x4a6a4a);
  body.rect(cx - 8, cy - 7, 14, 14).stroke({ color: 0x2a3a2a, width: 1 });
  body.rect(cx - 8, cy - 7, 14, 3).fill(0x6a8a6a);
  // bubbling acid tank on top — circle with green fill + lighter bubble
  body.circle(cx, cy - 12, 6).fill(0x2a4a2a);
  body.circle(cx, cy - 12, 5).fill(0x6aaa3a);
  body.circle(cx - 2, cy - 14, 1.5).fill(0x9af09a);
  body.circle(cx + 1, cy - 11, 1).fill(0xffffff);
  // rivets
  body.circle(cx - 6, cy - 5, 1).fill(NAIL);
  body.circle(cx + 4, cy - 5, 1).fill(NAIL);
  c.addChild(body);
  // wide nozzle barrel
  const barrel = new Graphics();
  barrel.rect(cx + 6, cy - 3, 14, 6).fill(0x2a3a2a);
  barrel.rect(cx + 6, cy - 3, 14, 1).fill(0x6a8a6a);
  // muzzle drips
  barrel.circle(cx + 19, cy + 2, 1.2).fill({ color: 0x9af09a, alpha: 0.9 });
  c.addChild(barrel);
  const glow = new Graphics();
  glow.rect(-2, -2, ACID_W + 4, ACID_H + 4).stroke({ color: 0x6aaa3a, width: 2, alpha: 0.85 });
  c.addChild(glow);
  return c;
}

// ---------- GENERATOR SHIELD (unlockable — energy bubble around the generator,
// absorbs hits and lasts limited HP). Pixel-art: tall obelisk emitter with
// pulsing cyan bands. Acts as another wall but cheap-cost-when-unlocked.
const GENSHIELD_W = 36, GENSHIELD_H = 60;
function createGenShieldGraphic() {
  const c = new Container();
  const g = new Graphics();
  // obelisk base
  g.rect(4, GENSHIELD_H - 10, GENSHIELD_W - 8, 10).fill(0x222228);
  g.rect(4, GENSHIELD_H - 10, GENSHIELD_W - 8, 2).fill(0x4a4a52);
  // tower
  g.rect(8, 14, GENSHIELD_W - 16, GENSHIELD_H - 24).fill(0x3a3a48);
  g.rect(8, 14, GENSHIELD_W - 16, 4).fill(0x5a5a68);
  g.rect(8, GENSHIELD_H - 14, GENSHIELD_W - 16, 4).fill(0x222228);
  // pulsing cyan bands
  for (let i = 0; i < 3; i++) {
    const y = 20 + i * 12;
    g.rect(10, y, GENSHIELD_W - 20, 4).fill({ color: 0x4cc9f0, alpha: 0.75 });
    g.rect(10, y, GENSHIELD_W - 20, 1).fill(0xffffff);
  }
  // crystal tip
  g.rect(GENSHIELD_W / 2 - 4, 4, 8, 12).fill(0x4cc9f0);
  g.rect(GENSHIELD_W / 2 - 2, 0, 4, 6).fill(0xffffff);
  g.circle(GENSHIELD_W / 2, 4, 5).stroke({ color: 0x4cc9f0, width: 1, alpha: 0.6 });
  c.addChild(g);
  const glow = new Graphics();
  glow.rect(-2, -2, GENSHIELD_W + 4, GENSHIELD_H + 4).stroke({ color: 0x4cc9f0, width: 2, alpha: 0.85 });
  c.addChild(glow);
  return c;
}

// ---------- FLAMETHROWER (unlockable — short range, fast cooldown, continuous
// flame). Compact wide-mouth burner with a fuel tank on the side.
const FLAME_W = 44, FLAME_H = 44;
function createFlameThrowerGraphic() {
  const c = new Container();
  const cx = FLAME_W / 2, cy = FLAME_H / 2;
  const base = new Graphics();
  base.circle(cx, cy + 4, 18).fill({ color: 0x4a2818, alpha: 0.7 });
  base.circle(cx, cy + 4, 18).stroke({ color: 0x8a4828, width: 1, alpha: 0.8 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 16;
    const by = cy + 4 + Math.sin(a) * 7;
    base.rect(bx - 4, by - 2, 8, 4).fill(0x8a5828);
    base.rect(bx - 4, by - 2, 8, 1).fill(0xaa7838);
  }
  c.addChild(base);
  const ped = new Graphics();
  ped.rect(cx - 5, cy - 2, 10, 8).fill(0x2a1a14);
  ped.rect(cx - 5, cy - 2, 10, 2).fill(0x4a3024);
  c.addChild(ped);
  const body = new Graphics();
  body.rect(cx - 8, cy - 7, 14, 14).fill(0x6a3a1a);
  body.rect(cx - 8, cy - 7, 14, 14).stroke({ color: 0x3a1a0a, width: 1 });
  body.rect(cx - 8, cy - 7, 14, 3).fill(0x8a4a24);
  // fuel tank on side — red propane cylinder
  body.rect(cx - 14, cy - 2, 6, 10).fill(0xa02a1a);
  body.rect(cx - 14, cy - 2, 6, 2).fill(0xff5a2a);
  body.rect(cx - 14, cy + 6, 6, 1).fill(0x4a0a0a);
  // tank cap
  body.rect(cx - 12, cy - 4, 2, 2).fill(0x666672);
  c.addChild(body);
  // wide flared muzzle
  const barrel = new Graphics();
  barrel.rect(cx + 6, cy - 2, 10, 4).fill(0x222228);
  barrel.rect(cx + 14, cy - 4, 6, 8).fill(0x222228);
  barrel.rect(cx + 14, cy - 4, 6, 2).fill(0x4a4a52);
  // tiny pilot light
  barrel.circle(cx + 17, cy, 1).fill(COLORS.neonOrange);
  c.addChild(barrel);
  const glow = new Graphics();
  glow.rect(-2, -2, FLAME_W + 4, FLAME_H + 4).stroke({ color: 0xff5a2a, width: 2, alpha: 0.85 });
  c.addChild(glow);
  return c;
}

// ---------- REPAIR BAY ----------
const REPAIR_W = 44, REPAIR_H = 44;
function createRepairBayGraphic() {
  const c = new Container();
  const cx = REPAIR_W / 2, cy = REPAIR_H / 2;
  // ground glow pad
  const pad = new Graphics();
  pad.circle(cx, cy, 24).fill({ color: COLORS.neonGreen, alpha: 0.15 });
  pad.circle(cx, cy, 18).fill({ color: COLORS.neonGreen, alpha: 0.22 });
  c.addChild(pad);
  // base plate
  const base = new Graphics();
  base.rect(cx - 16, cy - 16, 32, 32).fill(0xeaf0ea);
  base.rect(cx - 16, cy - 16, 32, 3).fill(0xffffff);
  base.rect(cx - 16, cy + 13, 32, 3).fill(0x9aa0a0);
  base.rect(cx - 16, cy - 16, 3, 32).fill(0xffffff);
  base.rect(cx + 13, cy - 16, 3, 32).fill(0x9aa0a0);
  c.addChild(base);
  // big green cross
  const cross = new Graphics();
  cross.rect(cx - 3, cy - 12, 6, 24).fill(COLORS.neonGreen);
  cross.rect(cx - 12, cy - 3, 24, 6).fill(COLORS.neonGreen);
  cross.rect(cx - 3, cy - 12, 6, 2).fill(0xa0f0a0);
  cross.rect(cx - 12, cy - 3, 24, 2).fill(0xa0f0a0);
  c.addChild(cross);
  // corner bolts
  const bolts = new Graphics();
  bolts.circle(cx - 12, cy - 12, 1.5).fill(0x444450);
  bolts.circle(cx + 12, cy - 12, 1.5).fill(0x444450);
  bolts.circle(cx - 12, cy + 12, 1.5).fill(0x444450);
  bolts.circle(cx + 12, cy + 12, 1.5).fill(0x444450);
  c.addChild(bolts);
  // outlined glow — keeps build visible against floor
  const glow = new Graphics();
  glow.rect(-2, -2, REPAIR_W + 4, REPAIR_H + 4).stroke({ color: 0x5ef38c, width: 2, alpha: 0.75 });
  c.addChild(glow);
  return c;
}

// ---------- BUILDABLES TABLE ----------
export const BUILDABLES = {
  wall: {
    id: 'wall', name: 'WALL', icon: '🧱', iconName: 'shield',
    cost: { wood: 5 },
    build: createWallGraphic, width: WALL_W, height: WALL_H,
    rotatable: true, autoRotates: false, hp: 200,
    desc: 'Basic wooden barricade.',
  },
  sandbag: {
    id: 'sandbag', name: 'SANDBAG', icon: '🟫', iconName: 'sock',
    cost: { wood: 3 },
    build: createSandbagGraphic, width: SAND_W, height: SAND_H,
    rotatable: true, hp: 80,
    desc: 'Cheap. Weaker. Quick to deploy.',
  },
  spike: {
    id: 'spike', name: 'SPIKES', icon: '⚔️', iconName: 'crown',
    cost: { wood: 4, scrap: 2 },
    build: createSpikeGraphic, width: SPIKE_W, height: SPIKE_H,
    rotatable: false, hp: 100,
    isTrap: true,
    trapDps: 12,
    desc: 'Dmg/sec to any zombie standing on it.',
  },
  mine: {
    id: 'mine', name: 'MINE', icon: '💣', iconName: 'smokeBomb',
    cost: { wood: 2, explosives: 3 },
    build: createMineGraphic, width: MINE_W, height: MINE_H,
    rotatable: false, hp: 40,
    isMine: true,
    mineTrigger: 30,
    mineRadius: 90,
    mineDamage: 60,
    desc: 'Single-use AOE. Triggers on proximity.',
  },
  turret: {
    id: 'turret', name: 'TURRET', icon: '🔫', iconName: 'nitro',
    cost: { wood: 18, scrap: 8 },
    build: createTurretGraphic, width: TURRET_W, height: TURRET_H,
    rotatable: true, autoRotates: true, hp: 140,
    range: 280, fireCooldown: 0.45, damage: 14, projectileSpeed: 520,
    desc: 'Auto-fires at zombies in range.',
  },
  sniperTurret: {
    id: 'sniperTurret', name: 'SNIPER', icon: '🎯', iconName: 'lightning',
    cost: { wood: 30, scrap: 12, electronics: 6 },
    build: createSniperTurretGraphic, width: SNIPER_W, height: SNIPER_H,
    rotatable: true, autoRotates: true, hp: 220,
    range: 460, fireCooldown: 1.1, damage: 60, projectileSpeed: 720,
    desc: 'Slow. Huge damage. Long range.',
  },
  repair: {
    id: 'repair', name: 'REPAIR', icon: '➕', iconName: 'heart',
    cost: { wood: 20, electronics: 8 },
    build: createRepairBayGraphic, width: REPAIR_W, height: REPAIR_H,
    rotatable: false, hp: 120,
    isRepair: true,
    healRadius: 60, healRate: 6, // hp per second
    desc: 'Heals player standing in range.',
  },
  // ===========================================================================
  // META-UNLOCKABLE BUILDABLES — gated by cumulative nights survived. Persist
  // via profileKey('pugfort:unlocks'). See `getUnlocks()` / `tryUnlock()`.
  // ===========================================================================
  acidTurret: {
    id: 'acidTurret', name: 'ACID TURRET', icon: '🧪', iconName: 'magnet',
    cost: { wood: 22, scrap: 10, explosives: 4 },
    build: createAcidTurretGraphic, width: ACID_W, height: ACID_H,
    rotatable: true, autoRotates: true, hp: 130,
    range: 240, fireCooldown: 0.7, damage: 22, projectileSpeed: 360,
    isAcid: true, acidPoolDur: 3.0, acidPoolDps: 14, acidPoolRadius: 60,
    desc: 'Spits an acid pool — lingering AOE damage.',
    unlock: { key: 'acidTurret', threshold: 3, label: 'Survive 3 total nights' },
  },
  genShield: {
    id: 'genShield', name: 'GEN SHIELD', icon: '🛡️', iconName: 'shield',
    cost: { wood: 8, scrap: 4, electronics: 4 },
    build: createGenShieldGraphic, width: GENSHIELD_W, height: GENSHIELD_H,
    rotatable: true, hp: 360,
    desc: 'Tough armoured pillar — best stacked around the generator.',
    unlock: { key: 'genShield', threshold: 5, label: 'Survive 5 total nights' },
  },
  flamethrower: {
    id: 'flamethrower', name: 'FLAMER', icon: '🔥', iconName: 'flame',
    cost: { wood: 25, scrap: 12, explosives: 6 },
    build: createFlameThrowerGraphic, width: FLAME_W, height: FLAME_H,
    rotatable: true, autoRotates: true, hp: 160,
    range: 170, fireCooldown: 0.12, damage: 6, projectileSpeed: 380,
    isFlame: true,
    desc: 'Short-range continuous flame — burns crowds.',
    unlock: { key: 'flamethrower', threshold: 10, label: 'Survive 10 total nights' },
  },
};

// =============================================================================
// META-UNLOCK system — persistent across runs. Tracks cumulative nights
// survived and which buildables the player has earned. Stored under
// profileKey('pugfort:unlocks') as JSON: { totalNights, unlocked: {id: true} }.
// (profileKey is imported at the top of the file.)
// =============================================================================
const UNLOCK_KEY = 'pugfort:unlocks';
function _defaultUnlockState() {
  return { totalNights: 0, unlocked: {} };
}
export function loadUnlocks() {
  try {
    const raw = localStorage.getItem(profileKey(UNLOCK_KEY));
    if (!raw) return _defaultUnlockState();
    const o = JSON.parse(raw);
    return {
      totalNights: o.totalNights | 0,
      unlocked: o.unlocked && typeof o.unlocked === 'object' ? o.unlocked : {},
    };
  } catch { return _defaultUnlockState(); }
}
export function saveUnlocks(state) {
  try { localStorage.setItem(profileKey(UNLOCK_KEY), JSON.stringify(state)); } catch {}
}
// Append `nights` to the running total, then unlock anything whose threshold
// is now met. Returns array of newly-unlocked buildable definitions (may be
// empty). Caller can toast/celebrate the unlocks.
export function recordSurvival(nights) {
  if (!nights || nights <= 0) return [];
  const state = loadUnlocks();
  state.totalNights = (state.totalNights | 0) + (nights | 0);
  const newlyUnlocked = [];
  for (const id of Object.keys(BUILDABLES)) {
    const def = BUILDABLES[id];
    if (!def.unlock) continue;
    if (state.unlocked[def.unlock.key]) continue;
    if (state.totalNights >= def.unlock.threshold) {
      state.unlocked[def.unlock.key] = true;
      newlyUnlocked.push(def);
    }
  }
  saveUnlocks(state);
  return newlyUnlocked;
}
// Returns true if `id` is a locked buildable for the active profile.
export function isLocked(id) {
  const def = BUILDABLES[id];
  if (!def || !def.unlock) return false;
  const state = loadUnlocks();
  return !state.unlocked[def.unlock.key];
}
// Returns a summary: { totalNights, items: [{def, unlocked, threshold, label}] }
export function getUnlockSummary() {
  const state = loadUnlocks();
  const items = [];
  for (const id of Object.keys(BUILDABLES)) {
    const def = BUILDABLES[id];
    if (!def.unlock) continue;
    items.push({
      def,
      unlocked: !!state.unlocked[def.unlock.key],
      threshold: def.unlock.threshold,
      label: def.unlock.label,
    });
  }
  return { totalNights: state.totalNights, items };
}

// Helper: check if player has enough resources
export function canAfford(resources, cost) {
  for (const k in cost) {
    if ((resources[k] || 0) < cost[k]) return false;
  }
  return true;
}

// Helper: deduct cost from resources
export function spend(resources, cost) {
  for (const k in cost) {
    resources[k] = (resources[k] || 0) - cost[k];
  }
}

// Helper: format cost as readable text
export function costString(cost) {
  return Object.entries(cost).map(([k, v]) => `${v}${MATERIALS[k].icon}`).join(' ');
}

// =============================================================================
// HP-TIER DAMAGE OVERLAY — fresh / cracked / smoking debris.
// Drawn on top of each placed buildable based on hp/maxHp ratio.
// Tier 0 (>50%) = clean, no overlay. Tier 1 (15-50%) = cracks + char marks.
// Tier 2 (<15%) = smoke particles + heavy char + half-collapsed planks.
// =============================================================================
function _drawDamageOverlay(g, w, h, tier) {
  g.clear();
  if (tier <= 0) return;
  // Tier 1 — cracks + char marks (50%..15%)
  if (tier >= 1) {
    // Diagonal crack 1 — top-left to mid
    const cracks = [
      [[2, 2], [10, 6], [18, 5], [26, 10]],
      [[w - 6, 3], [w - 14, 8], [w - 22, 6]],
      [[6, h - 4], [14, h - 8], [22, h - 6], [30, h - 10]],
    ];
    for (const path of cracks) {
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, y1] = path[i], [x2, y2] = path[i + 1];
        const steps = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 2));
        for (let s = 0; s < steps; s++) {
          const t = s / steps;
          const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
          g.rect(x, y, 1, 1).fill({ color: 0x000000, alpha: 0.85 });
        }
      }
    }
    // Char/scorch blots
    g.circle(w * 0.3, h * 0.5, Math.min(3, h * 0.2)).fill({ color: 0x1a1010, alpha: 0.55 });
    g.circle(w * 0.7, h * 0.4, Math.min(2.5, h * 0.18)).fill({ color: 0x1a1010, alpha: 0.5 });
  }
  // Tier 2 — heavy damage: more black scorch + smoke wisps + missing chunk silhouettes (15%..0)
  if (tier >= 2) {
    g.rect(w * 0.4, h * 0.1, w * 0.25, h * 0.3).fill({ color: 0x000000, alpha: 0.75 });
    g.rect(w * 0.1, h * 0.55, w * 0.18, h * 0.25).fill({ color: 0x000000, alpha: 0.65 });
    // Bright ember dots — orange/red glow
    g.circle(w * 0.45, h * 0.5, 1.2).fill({ color: 0xff8a3a, alpha: 0.9 });
    g.circle(w * 0.6, h * 0.35, 1).fill({ color: 0xff3a3a, alpha: 0.85 });
    g.circle(w * 0.2, h * 0.6, 1).fill({ color: 0xffd23f, alpha: 0.7 });
    // Wispy smoke above
    g.circle(w * 0.3, -3, 5).fill({ color: 0x444444, alpha: 0.45 });
    g.circle(w * 0.5, -6, 6).fill({ color: 0x333333, alpha: 0.4 });
    g.circle(w * 0.7, -2, 4).fill({ color: 0x555555, alpha: 0.4 });
  }
}

// Return tier (0/1/2) for a given hp ratio.
function _hpTier(ratio) {
  if (ratio > 0.5) return 0;
  if (ratio > 0.15) return 1;
  return 2;
}

// =============================================================================
// Build manager
// =============================================================================
export class Build {
  constructor({ scene }) {
    this.scene = scene;
    this.selected = null;
    this.rotation = 0;
    this.ghost = null;
    this.placed = [];
  }

  toggle(id) {
    if (this.selected === id) this.cancel();
    else this.select(id);
  }

  select(id) {
    if (!BUILDABLES[id]) return;
    if (isLocked(id)) {
      // Surface a friendly toast via the global hud (set by Game). Safe to
      // skip if hud isn't wired yet.
      const def = BUILDABLES[id];
      try { window.__PUGFORT?.hud?.toastMessage(`🔒 LOCKED — ${def.unlock?.label || ''}`, 'warn'); } catch {}
      return;
    }
    this.selected = id;
    this.rotation = 0;
    this._refreshGhost();
  }

  cancel() {
    this.selected = null;
    if (this.ghost) { this.ghost.destroy({ children: true }); this.ghost = null; }
    if (this.rangeCircle) { this.rangeCircle.destroy(); this.rangeCircle = null; }
  }

  rotate(delta) {
    if (!this.selected) return;
    if (!BUILDABLES[this.selected].rotatable) return;
    this.rotation += delta;
  }

  _refreshGhost() {
    if (this.ghost) { this.ghost.destroy({ children: true }); this.ghost = null; }
    if (this.rangeCircle) { this.rangeCircle.destroy(); this.rangeCircle = null; }
    if (!this.selected) return;
    const def = BUILDABLES[this.selected];
    this.ghost = def.build();
    this.ghost.alpha = 0.55;
    this.scene.addChild(this.ghost);
    // Range circle for ranged buildings — shown as a faint cyan ring
    if (def.range) {
      this.rangeCircle = new Graphics();
      this.rangeCircle.circle(0, 0, def.range)
        .stroke({ color: 0x4cc9f0, width: 2, alpha: 0.5 });
      this.rangeCircle.circle(0, 0, def.range)
        .fill({ color: 0x4cc9f0, alpha: 0.04 });
      this.scene.addChild(this.rangeCircle);
    }
    // Mine trigger circle
    if (def.mineRadius) {
      this.rangeCircle = new Graphics();
      this.rangeCircle.circle(0, 0, def.mineRadius)
        .stroke({ color: 0xff5a3a, width: 2, alpha: 0.6 });
      this.rangeCircle.circle(0, 0, def.mineRadius)
        .fill({ color: 0xff5a3a, alpha: 0.06 });
      this.scene.addChild(this.rangeCircle);
    }
    // Repair-bay heal radius
    if (def.healRadius) {
      this.rangeCircle = new Graphics();
      this.rangeCircle.circle(0, 0, def.healRadius)
        .stroke({ color: 0x5ef38c, width: 2, alpha: 0.6 });
      this.rangeCircle.circle(0, 0, def.healRadius)
        .fill({ color: 0x5ef38c, alpha: 0.08 });
      this.scene.addChild(this.rangeCircle);
    }
  }

  update(mouseWorld, canPlace) {
    if (!this.selected || !this.ghost) return;
    const def = BUILDABLES[this.selected];
    this.ghost.x = mouseWorld.x;
    this.ghost.y = mouseWorld.y;
    this.ghost.rotation = this.rotation;
    this.ghost.pivot.set(def.width / 2, def.height / 2);
    this.ghost.tint = canPlace ? 0x5ef38c : 0xff3a3a;
    // Range circle tracks the cursor too
    if (this.rangeCircle) {
      this.rangeCircle.x = mouseWorld.x;
      this.rangeCircle.y = mouseWorld.y;
    }
  }

  placeAt(mouseWorld) {
    if (!this.selected) return null;
    const def = BUILDABLES[this.selected];
    const mesh = def.build();
    mesh.pivot.set(def.width / 2, def.height / 2);
    mesh.x = mouseWorld.x;
    mesh.y = mouseWorld.y;
    mesh.rotation = this.rotation;
    // Damage overlay graphic — sits on top of the mesh, repainted on HP change.
    const damageG = new Graphics();
    mesh.addChild(damageG);
    this.scene.addChild(mesh);
    const w = def.width, h = def.height;
    const cos = Math.abs(Math.cos(this.rotation));
    const sin = Math.abs(Math.sin(this.rotation));
    const aabbW = w * cos + h * sin;
    const aabbH = w * sin + h * cos;
    const placed = {
      id: this.selected, def, mesh,
      damageG, hpTier: 0,
      cx: mouseWorld.x, cy: mouseWorld.y,
      rotation: this.rotation,
      x: mouseWorld.x - aabbW / 2,
      y: mouseWorld.y - aabbH / 2,
      width: aabbW, height: aabbH,
      hp: def.hp, maxHp: def.hp,
      fireCd: 0,
    };
    this.placed.push(placed);
    return placed;
  }

  // Called per-frame on each placed buildable to repaint damage tier if HP
  // dropped into a new band. Safe to call every frame — early-out on no change.
  refreshDamage(p) {
    if (!p || !p.damageG || p.hp == null || p.maxHp == null) return;
    const tier = _hpTier(p.hp / p.maxHp);
    if (tier === p.hpTier) return;
    p.hpTier = tier;
    _drawDamageOverlay(p.damageG, p.def.width, p.def.height, tier);
  }

  removePlaced(p) {
    if (p.mesh) p.mesh.destroy({ children: true });
    const i = this.placed.indexOf(p);
    if (i >= 0) this.placed.splice(i, 1);
  }
}
