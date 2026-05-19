import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

// =============================================================================
// MATERIALS — 4 resource types. Each buildable's cost is an object.
// =============================================================================
export const MATERIALS = {
  wood:        { id: 'wood',        icon: '🪵', name: 'Wood' },
  scrap:       { id: 'scrap',       icon: '🔩', name: 'Scrap' },
  explosives:  { id: 'explosives',  icon: '💣', name: 'Explosives' },
  electronics: { id: 'electronics', icon: '🔌', name: 'Electronics' },
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
    id: 'wall', name: 'WALL', icon: '🧱',
    cost: { wood: 5 },
    build: createWallGraphic, width: WALL_W, height: WALL_H,
    rotatable: true, autoRotates: false, hp: 200,
    desc: 'Basic wooden barricade.',
  },
  sandbag: {
    id: 'sandbag', name: 'SANDBAG', icon: '🟫',
    cost: { wood: 3 },
    build: createSandbagGraphic, width: SAND_W, height: SAND_H,
    rotatable: true, hp: 80,
    desc: 'Cheap. Weaker. Quick to deploy.',
  },
  spike: {
    id: 'spike', name: 'SPIKES', icon: '⚔️',
    cost: { wood: 4, scrap: 2 },
    build: createSpikeGraphic, width: SPIKE_W, height: SPIKE_H,
    rotatable: false, hp: 100,
    isTrap: true,
    trapDps: 12,
    desc: 'Dmg/sec to any zombie standing on it.',
  },
  mine: {
    id: 'mine', name: 'MINE', icon: '💣',
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
    id: 'turret', name: 'TURRET', icon: '🔫',
    cost: { wood: 18, scrap: 8 },
    build: createTurretGraphic, width: TURRET_W, height: TURRET_H,
    rotatable: true, autoRotates: true, hp: 140,
    range: 280, fireCooldown: 0.45, damage: 14, projectileSpeed: 520,
    desc: 'Auto-fires at zombies in range.',
  },
  sniperTurret: {
    id: 'sniperTurret', name: 'SNIPER', icon: '🎯',
    cost: { wood: 30, scrap: 12, electronics: 6 },
    build: createSniperTurretGraphic, width: SNIPER_W, height: SNIPER_H,
    rotatable: true, autoRotates: true, hp: 220,
    range: 460, fireCooldown: 1.1, damage: 60, projectileSpeed: 720,
    desc: 'Slow. Huge damage. Long range.',
  },
  repair: {
    id: 'repair', name: 'REPAIR', icon: '➕',
    cost: { wood: 20, electronics: 8 },
    build: createRepairBayGraphic, width: REPAIR_W, height: REPAIR_H,
    rotatable: false, hp: 120,
    isRepair: true,
    healRadius: 60, healRate: 6, // hp per second
    desc: 'Heals player standing in range.',
  },
};

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
    this.selected = id;
    this.rotation = 0;
    this._refreshGhost();
  }

  cancel() {
    this.selected = null;
    if (this.ghost) { this.ghost.destroy({ children: true }); this.ghost = null; }
  }

  rotate(delta) {
    if (!this.selected) return;
    if (!BUILDABLES[this.selected].rotatable) return;
    this.rotation += delta;
  }

  _refreshGhost() {
    if (this.ghost) { this.ghost.destroy({ children: true }); this.ghost = null; }
    if (!this.selected) return;
    this.ghost = BUILDABLES[this.selected].build();
    this.ghost.alpha = 0.55;
    this.scene.addChild(this.ghost);
  }

  update(mouseWorld, canPlace) {
    if (!this.selected || !this.ghost) return;
    const def = BUILDABLES[this.selected];
    this.ghost.x = mouseWorld.x;
    this.ghost.y = mouseWorld.y;
    this.ghost.rotation = this.rotation;
    this.ghost.pivot.set(def.width / 2, def.height / 2);
    this.ghost.tint = canPlace ? 0x5ef38c : 0xff3a3a;
  }

  placeAt(mouseWorld) {
    if (!this.selected) return null;
    const def = BUILDABLES[this.selected];
    const mesh = def.build();
    mesh.pivot.set(def.width / 2, def.height / 2);
    mesh.x = mouseWorld.x;
    mesh.y = mouseWorld.y;
    mesh.rotation = this.rotation;
    this.scene.addChild(mesh);
    const w = def.width, h = def.height;
    const cos = Math.abs(Math.cos(this.rotation));
    const sin = Math.abs(Math.sin(this.rotation));
    const aabbW = w * cos + h * sin;
    const aabbH = w * sin + h * cos;
    const placed = {
      id: this.selected, def, mesh,
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

  removePlaced(p) {
    if (p.mesh) p.mesh.destroy({ children: true });
    const i = this.placed.indexOf(p);
    if (i >= 0) this.placed.splice(i, 1);
  }
}
