import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

// =============================================================================
// Buildable definitions. Each has a unique mesh factory + cost + footprint
// (axis-aligned bounding box used for zombie collision).
// =============================================================================

const WOOD = COLORS.wood;
const WOOD_HI = COLORS.woodHi;
const WOOD_DARK = COLORS.woodDark;
const NAIL = 0x222228;
const METAL = 0x5a5a62;
const METAL_HI = 0x9a9aa8;
const METAL_DARK = 0x2a2a32;
const BARREL = 0x18181c;

// ---------- WALL (much higher detail) ----------
const WALL_W = 64;
const WALL_H = 20;
export const WALL_COST = 5;

function createWallGraphic() {
  const c = new Container();
  const g = new Graphics();
  // 4 stacked planks with random variation per row
  for (let i = 0; i < 4; i++) {
    const baseY = i * 5;
    const baseCol = i % 2 === 0 ? WOOD : WOOD_DARK;
    g.rect(0, baseY, WALL_W, 5).fill(baseCol);
    g.rect(0, baseY, WALL_W, 1).fill(shade(baseCol, 1.3));        // top highlight
    g.rect(0, baseY + 4, WALL_W, 1).fill(shade(baseCol, 0.6));     // bottom shadow
    // wood grain pixels
    for (let x = 4; x < WALL_W - 2; x += 3 + Math.floor(Math.random() * 3)) {
      g.rect(x, baseY + 2, 1, 1).fill(shade(baseCol, 0.6));
    }
    // occasional knot
    if (i === 1) g.circle(18, baseY + 2, 1.5).fill(shade(baseCol, 0.5));
    if (i === 3) g.circle(WALL_W - 14, baseY + 2, 1.5).fill(shade(baseCol, 0.5));
  }
  // vertical support beams at ends
  g.rect(0, 0, 4, WALL_H).fill(WOOD_DARK);
  g.rect(0, 0, 1, WALL_H).fill(shade(WOOD_DARK, 1.4));
  g.rect(WALL_W - 4, 0, 4, WALL_H).fill(WOOD_DARK);
  g.rect(WALL_W - 1, 0, 1, WALL_H).fill(shade(WOOD_DARK, 0.6));
  // middle support
  g.rect(WALL_W / 2 - 1, 0, 2, WALL_H).fill(WOOD_DARK);
  // many nails along seams
  for (let i = 0; i < 4; i++) {
    g.circle(2, 2 + i * 5, 1).fill(NAIL);
    g.circle(WALL_W - 2, 2 + i * 5, 1).fill(NAIL);
    g.circle(WALL_W / 2, 2 + i * 5, 1).fill(NAIL);
  }
  // damage marks (random scratches)
  g.rect(22, 8, 6, 1).fill({ color: 0x000000, alpha: 0.5 });
  g.rect(44, 13, 4, 1).fill({ color: 0x000000, alpha: 0.5 });
  c.addChild(g);
  return c;
}

// ---------- TURRET (high detail, separate body + barrel + base) ----------
const TURRET_W = 44;
const TURRET_H = 44;
export const TURRET_COST = 18;

function createTurretGraphic() {
  const c = new Container();
  // The mesh is built around the turret's CENTER for rotation simplicity.
  // We offset by (-TURRET_W/2, -TURRET_H/2) when placing into the world.
  const cx = TURRET_W / 2;
  const cy = TURRET_H / 2;

  // BASE — circular concrete pad
  const base = new Graphics();
  base.circle(cx, cy + 4, 18).fill({ color: 0x4a4a52, alpha: 0.6 });
  base.circle(cx, cy + 4, 18).stroke({ color: 0x6a6a72, width: 1, alpha: 0.7 });
  // sandbags around base (4 segments)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 16;
    const by = cy + 4 + Math.sin(a) * 7;
    base.rect(bx - 4, by - 2, 8, 4).fill(0x8a7a4a);
    base.rect(bx - 4, by - 2, 8, 1).fill(0xa89a6a);
  }
  c.addChild(base);

  // PEDESTAL — short metal pillar
  const ped = new Graphics();
  ped.rect(cx - 5, cy - 2, 10, 8).fill(METAL_DARK);
  ped.rect(cx - 5, cy - 2, 10, 2).fill(METAL_HI);
  ped.rect(cx - 5, cy + 5, 10, 1).fill(0x101014);
  c.addChild(ped);

  // BODY (turret head — rotates with the whole mesh during use; we draw oriented to +X)
  const body = new Graphics();
  // backplate
  body.rect(cx - 8, cy - 7, 14, 14).fill(METAL);
  body.rect(cx - 8, cy - 7, 14, 14).stroke({ color: METAL_DARK, width: 1 });
  body.rect(cx - 8, cy - 7, 14, 3).fill(METAL_HI);
  body.rect(cx - 8, cy + 4, 14, 3).fill(METAL_DARK);
  // rivets
  body.circle(cx - 6, cy - 5, 1).fill(NAIL);
  body.circle(cx + 4, cy - 5, 1).fill(NAIL);
  body.circle(cx - 6, cy + 5, 1).fill(NAIL);
  body.circle(cx + 4, cy + 5, 1).fill(NAIL);
  // glowing scope (cyan eye in front)
  body.circle(cx + 2, cy, 1.6).fill(COLORS.neonCyan);
  body.circle(cx + 2, cy, 1).fill(0xffffff);
  c.addChild(body);

  // BARREL — sticks out to +X (right). Rotation of the whole mesh will aim this.
  const barrel = new Graphics();
  barrel.rect(cx + 6, cy - 1.5, 14, 3).fill(BARREL);
  barrel.rect(cx + 6, cy - 1.5, 14, 1).fill(METAL_HI);
  barrel.rect(cx + 6, cy + 1.5, 14, 1).fill(0x000000);
  // muzzle break
  barrel.rect(cx + 18, cy - 2.5, 3, 5).fill(BARREL);
  barrel.rect(cx + 18, cy - 2.5, 3, 1).fill(METAL_HI);
  // cooling holes
  barrel.circle(cx + 9, cy, 0.6).fill(0x000000);
  barrel.circle(cx + 12, cy, 0.6).fill(0x000000);
  barrel.circle(cx + 15, cy, 0.6).fill(0x000000);
  c.addChild(barrel);

  return c;
}

export const BUILDABLES = {
  wall: {
    id: 'wall',
    name: 'WALL',
    icon: '🧱',
    cost: WALL_COST,
    costType: 'wood',
    build: createWallGraphic,
    width: WALL_W,
    height: WALL_H,
    rotatable: true,
    autoRotates: false,
    hp: 200,
  },
  turret: {
    id: 'turret',
    name: 'TURRET',
    icon: '🔫',
    cost: TURRET_COST,
    costType: 'wood',
    build: createTurretGraphic,
    width: TURRET_W,
    height: TURRET_H,
    rotatable: true,
    autoRotates: true,         // game updates rotation to aim at nearest zombie
    hp: 140,
    range: 280,
    fireCooldown: 0.45,
    damage: 14,
    projectileSpeed: 520,
  },
};

// =============================================================================
// Build manager — selected buildable id + ghost preview + rotation + placement
// =============================================================================
export class Build {
  constructor({ scene }) {
    this.scene = scene;        // world layer for placed structures
    this.selected = null;
    this.rotation = 0;         // radians; Q/E rotates by 90°
    this.ghost = null;
    this.placed = [];          // { id, def, x, y, width, height, mesh, rotation, hp, ... }
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

  // Update ghost position + tint per frame
  update(mouseWorld, canPlace) {
    if (!this.selected || !this.ghost) return;
    const def = BUILDABLES[this.selected];
    // Position so the mesh CENTER is at mouse position
    this.ghost.x = mouseWorld.x - def.width / 2;
    this.ghost.y = mouseWorld.y - def.height / 2;
    this.ghost.rotation = this.rotation;
    // For rotation around center, we need pivot at the center
    this.ghost.pivot.set(def.width / 2, def.height / 2);
    this.ghost.x = mouseWorld.x;
    this.ghost.y = mouseWorld.y;
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
    // Compute axis-aligned bounding rect AFTER rotation (rough approximation
    // for collision/raycasting — perfect rect math would require oriented BB)
    const w = def.width, h = def.height;
    const cos = Math.abs(Math.cos(this.rotation));
    const sin = Math.abs(Math.sin(this.rotation));
    const aabbW = w * cos + h * sin;
    const aabbH = w * sin + h * cos;
    const placed = {
      id: this.selected,
      def,
      mesh,
      cx: mouseWorld.x,
      cy: mouseWorld.y,
      rotation: this.rotation,
      // top-left of AABB for fast collision tests
      x: mouseWorld.x - aabbW / 2,
      y: mouseWorld.y - aabbH / 2,
      width: aabbW,
      height: aabbH,
      hp: def.hp,
      maxHp: def.hp,
      // turret state
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
