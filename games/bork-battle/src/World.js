import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, shade } from './colors.js';
import { mulberry32 } from './rng.js';

// World holds the procedural map: parallax bg, decorations, fences, ramps,
// hydrants, treat fountains, frisbee tornado, and the shrinking damage zone.
export class World {
  constructor(seed, opts = {}) {
    this.container = new Container();
    this.container.label = 'world';

    this.bg = new Container(); this.bg.label = 'bg';
    this.ambientLayer = new Container(); this.ambientLayer.label = 'ambient';
    this.decorLayer = new Container(); this.decorLayer.label = 'decor';
    this.mapLayer = new Container(); this.mapLayer.label = 'map';
    this.itemsLayer = new Container(); this.itemsLayer.label = 'items';
    this.zoneLayer = new Container(); this.zoneLayer.label = 'zone';
    this.container.addChild(this.bg, this.ambientLayer, this.decorLayer, this.mapLayer, this.itemsLayer, this.zoneLayer);

    this.ambientParticles = [];
    this._ambientSpawnT = 0;

    this.width = opts.width || 2400;
    this.height = opts.height || 1800;
    this.bounds = { x: 0, y: 0, w: this.width, h: this.height, width: this.width, height: this.height };
    this.rng = mulberry32(seed);

    this.fences = [];
    this.hydrants = [];
    this.fountains = [];
    this.tornado = null;
    this.lamps = [];
    // Biome zones — 3 squarish regions of the arena get different ambient tints + props.
    // { x, y, w, h, name, color, propsType }
    this.biomes = [];
    // Hazard pockets — { x, y, r, kind: 'poison' | 'wet' }
    this.hazards = [];
    // Mini-objective points (Radio Tower, Beef pedestal). Game owns activation logic.
    this.objectives = [];

    this._drawBackground();
    this._addBiomes();
    this._addDecor();
    this._generateMap();
    this._addHazards();
    this._addObjectives();
    this._buildTornado();

    this.zone = {
      x: 0, y: 0, w: this.width, h: this.height,
      targetX: this.width / 2 - 240,
      targetY: this.height / 2 - 180,
      targetW: 480,
      targetH: 360,
      shrinkStart: 40,
      shrinkEnd: 140,
    };
    this.zoneGraphics = new Graphics();
    this.zoneLayer.addChild(this.zoneGraphics);
  }

  _drawBackground() {
    // Layer 1: deep ground base (richer purple-blue)
    const base = new Graphics();
    base.rect(0, 0, this.width, this.height).fill(0x1a0f2e);
    this.bg.addChild(base);

    // Layer 2: grass tile pattern (subtle green-purple speckle)
    const grass = new Graphics();
    for (let i = 0; i < 800; i++) {
      const x = this.rng() * this.width;
      const y = this.rng() * this.height;
      const c = [0x2a1a44, 0x3a2a5a, 0x1f1340][Math.floor(this.rng() * 3)];
      grass.rect(x, y, 2, 2).fill(c);
    }
    // Grass blade tufts
    for (let i = 0; i < 200; i++) {
      const x = this.rng() * this.width;
      const y = this.rng() * this.height;
      grass.rect(x, y, 1, 3).fill(0x3a5a3a);
      grass.rect(x + 1, y + 1, 1, 2).fill(0x4a7a4a);
    }
    this.bg.addChild(grass);

    // Layer 3: neon paving paths (cross strips between zones)
    const paths = new Graphics();
    const pathColor = 0x2a3a5a;
    const pathGlow = 0x4cc9f0;
    // horizontal path
    paths.rect(0, this.height / 2 - 40, this.width, 80).fill({ color: pathColor, alpha: 0.5 });
    paths.rect(0, this.height / 2 - 40, this.width, 1).fill({ color: pathGlow, alpha: 0.3 });
    paths.rect(0, this.height / 2 + 39, this.width, 1).fill({ color: pathGlow, alpha: 0.3 });
    // vertical path
    paths.rect(this.width / 2 - 40, 0, 80, this.height).fill({ color: pathColor, alpha: 0.5 });
    paths.rect(this.width / 2 - 40, 0, 1, this.height).fill({ color: pathGlow, alpha: 0.3 });
    paths.rect(this.width / 2 + 39, 0, 1, this.height).fill({ color: pathGlow, alpha: 0.3 });
    this.bg.addChild(paths);

    // Layer 4: subtle grid for orientation
    const grid = new Graphics();
    const cell = 80;
    for (let x = 0; x <= this.width; x += cell) {
      grid.moveTo(x, 0).lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += cell) {
      grid.moveTo(0, y).lineTo(this.width, y);
    }
    grid.stroke({ color: 0x4a3a6a, width: 1, alpha: 0.25 });
    this.bg.addChild(grid);

    // Layer 5: pixel stars
    const stars = new Graphics();
    for (let i = 0; i < 120; i++) {
      const x = this.rng() * this.width;
      const y = this.rng() * this.height;
      const c = [COLORS.cyan, COLORS.pink, COLORS.yellow, 0xffffff][Math.floor(this.rng() * 4)];
      const size = this.rng() < 0.2 ? 2 : 1;
      stars.rect(x, y, size, size).fill({ color: c, alpha: 0.6 });
    }
    this.bg.addChild(stars);
  }

  // 3 biome regions across the arena — KITCHEN (top-left), GARAGE (top-right),
  // GARDEN (bottom-half). Each gets a subtle floor tint + signature ground props.
  _addBiomes() {
    const W = this.width, H = this.height;
    const layer = new Graphics();
    const KITCHEN = { x: 100, y: 100, w: W * 0.45 - 100, h: H * 0.45 - 100,
      name: 'KITCHEN', color: 0xff8e3c, propsType: 'kitchen' };
    const GARAGE  = { x: W * 0.55 + 100, y: 100, w: W * 0.45 - 200, h: H * 0.45 - 100,
      name: 'GARAGE',  color: 0x4cc9f0, propsType: 'garage' };
    const GARDEN  = { x: 100, y: H * 0.55 + 100, w: W - 200, h: H * 0.45 - 200,
      name: 'GARDEN',  color: 0x5ef38c, propsType: 'garden' };
    this.biomes.push(KITCHEN, GARAGE, GARDEN);
    // Subtle tinted floor patches for each biome
    for (const b of this.biomes) {
      layer.rect(b.x, b.y, b.w, b.h).fill({ color: b.color, alpha: 0.04 });
      // Border dashes — light decorative outline
      const dash = 12;
      for (let x = b.x; x < b.x + b.w; x += dash * 2) {
        layer.rect(x, b.y, dash, 1).fill({ color: b.color, alpha: 0.35 });
        layer.rect(x, b.y + b.h - 1, dash, 1).fill({ color: b.color, alpha: 0.35 });
      }
      for (let y = b.y; y < b.y + b.h; y += dash * 2) {
        layer.rect(b.x, y, 1, dash).fill({ color: b.color, alpha: 0.35 });
        layer.rect(b.x + b.w - 1, y, 1, dash).fill({ color: b.color, alpha: 0.35 });
      }
    }
    this.bg.addChild(layer);
    // Biome-specific scatter props (10-14 per biome)
    this._addBiomeProps();
  }

  _addBiomeProps() {
    const propsLayer = new Graphics();
    for (const b of this.biomes) {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const px = b.x + 30 + this.rng() * (b.w - 60);
        const py = b.y + 30 + this.rng() * (b.h - 60);
        if (b.propsType === 'kitchen') {
          // Fridge crates (silver boxes) + spilled food
          propsLayer.rect(px, py, 18, 22).fill(0xc8c8d0);
          propsLayer.rect(px, py, 18, 3).fill(0xeaeaf0);
          propsLayer.rect(px, py + 18, 18, 2).fill(0x6a6a72);
          propsLayer.rect(px + 12, py + 8, 3, 1).fill(0x444450); // handle
          // food smear
          if (this.rng() < 0.6) {
            propsLayer.circle(px + 3, py + 28, 4).fill({ color: 0xff5a3a, alpha: 0.5 });
            propsLayer.circle(px + 6, py + 30, 2).fill({ color: 0xff5a3a, alpha: 0.7 });
          }
        } else if (b.propsType === 'garage') {
          // Oil drums + tire stacks
          if (this.rng() < 0.6) {
            // drum
            propsLayer.ellipse(px, py + 16, 8, 3).fill(0x222228);
            propsLayer.rect(px - 8, py, 16, 16).fill(0x4a4a52);
            propsLayer.rect(px - 8, py, 16, 2).fill(0x6a6a72);
            propsLayer.rect(px - 8, py + 7, 16, 1).fill(0xc8281f); // hazard stripe
            propsLayer.rect(px - 8, py + 15, 16, 1).fill(0x222228);
          } else {
            // tire stack
            propsLayer.ellipse(px, py + 12, 10, 4).fill(0x1a1a1a);
            propsLayer.ellipse(px, py + 8, 10, 4).fill(0x2a2a2a);
            propsLayer.ellipse(px, py + 4, 10, 4).fill(0x1a1a1a);
            propsLayer.ellipse(px, py + 4, 5, 2).fill(0x444450);
          }
        } else if (b.propsType === 'garden') {
          // Bushes + flower beds + small trees
          if (this.rng() < 0.55) {
            // bush
            const c = [0x3a7a4a, 0x4a8a5a, 0x2a6a3a][Math.floor(this.rng() * 3)];
            propsLayer.circle(px, py, 8).fill(c);
            propsLayer.circle(px - 3, py - 3, 5).fill({ color: 0xffffff, alpha: 0.18 });
            // tiny flowers
            propsLayer.circle(px - 2, py + 1, 1).fill(0xff8aff);
            propsLayer.circle(px + 3, py - 1, 1).fill(0xffd23f);
          } else {
            // potted plant
            propsLayer.rect(px - 5, py + 4, 10, 6).fill(0x8a5a2c);
            propsLayer.rect(px - 5, py + 4, 10, 1).fill(0xc8a878);
            // leaves
            propsLayer.rect(px - 3, py - 2, 6, 6).fill(0x4a8a4a);
            propsLayer.rect(px - 1, py - 5, 2, 8).fill(0x4a8a4a);
            propsLayer.rect(px - 4, py, 2, 4).fill(0x2a6a3a);
            propsLayer.rect(px + 2, py, 2, 4).fill(0x2a6a3a);
          }
        }
      }
    }
    this.decorLayer.addChild(propsLayer);
  }

  _addHazards() {
    // POISON-GAS pocket: green misty circle in one corner. Slow HP drain.
    const poisonX = 220 + this.rng() * 60;
    const poisonY = 220 + this.rng() * 60;
    this.hazards.push({ x: poisonX, y: poisonY, r: 110, kind: 'poison' });
    // WET-FLOOR puddle: bluish slick. Causes acceleration loss while standing on it.
    const wetX = this.width - 280 + this.rng() * 60;
    const wetY = this.height - 280 + this.rng() * 60;
    this.hazards.push({ x: wetX, y: wetY, r: 130, kind: 'wet' });

    // Visuals — separate Graphics so we can animate per-frame.
    this.hazardLayer = new Container();
    this.itemsLayer.addChild(this.hazardLayer);
    for (const h of this.hazards) {
      const g = new Graphics();
      g.x = h.x; g.y = h.y;
      h.visual = g;
      this.hazardLayer.addChild(g);
      // Static base layer (drawn once, doesn't animate)
      const base = new Graphics();
      base.x = h.x; base.y = h.y;
      if (h.kind === 'poison') {
        // Toxic green pool with bubbling rim
        base.circle(0, 0, h.r).fill({ color: 0x4a8a4a, alpha: 0.18 });
        base.circle(0, 0, h.r).stroke({ color: 0x9af09a, width: 2, alpha: 0.6 });
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          base.circle(Math.cos(a) * (h.r - 12), Math.sin(a) * (h.r - 12), 3)
            .fill({ color: 0x6aaa3a, alpha: 0.6 });
        }
        // Skull-and-crossbones warning marker
        base.rect(-6, -28, 12, 12).fill({ color: 0x000000, alpha: 0.6 });
        base.rect(-5, -27, 10, 8).fill(0x6aaa3a);
        base.rect(-3, -25, 2, 2).fill(0x000000);
        base.rect(1, -25, 2, 2).fill(0x000000);
        base.rect(-2, -21, 4, 2).fill(0x000000);
        base.rect(-4, -18, 8, 1).fill(0x000000); // crossbones
      } else if (h.kind === 'wet') {
        // Cyan slippery puddle with white highlight
        base.circle(0, 0, h.r).fill({ color: 0x4cc9f0, alpha: 0.22 });
        base.circle(0, 0, h.r).stroke({ color: 0xb0e8ff, width: 2, alpha: 0.5 });
        base.ellipse(-h.r * 0.3, -h.r * 0.3, h.r * 0.5, h.r * 0.25)
          .fill({ color: 0xffffff, alpha: 0.4 });
        // "SLIPPERY" tile pattern
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          base.rect(Math.cos(a) * (h.r - 16) - 2, Math.sin(a) * (h.r - 16) - 2, 4, 4)
            .fill({ color: 0xb0e8ff, alpha: 0.5 });
        }
      }
      this.hazardLayer.addChild(base);
      h.baseG = base;
    }
  }

  _addObjectives() {
    // BEEF pedestal in arena dead-center area (close to tornado but offset)
    // and RADIO TOWER in another spot. Each spawns "active" once per cycle.
    this.objectivesLayer = new Container();
    this.itemsLayer.addChild(this.objectivesLayer);

    const beefX = this.width * 0.35;
    const beefY = this.height * 0.65;
    const beef = {
      x: beefX, y: beefY, r: 28, kind: 'beef',
      state: 'inactive', // 'inactive' | 'available' | 'taken'
      cooldown: 25, // seconds before first spawn
    };
    this.objectives.push(beef);
    // Pedestal visual
    const pedB = new Container();
    pedB.x = beefX; pedB.y = beefY;
    const pgb = new Graphics();
    pgb.rect(-14, -2, 28, 8).fill(0x4a3a2a);
    pgb.rect(-14, -2, 28, 2).fill(0x6a5a3a);
    pgb.rect(-14, 4, 28, 2).fill(0x2a1a14);
    pgb.rect(-6, -10, 12, 8).fill(0x6a5a3a);
    pgb.rect(-6, -10, 12, 1).fill(0x8a7a4a);
    pedB.addChild(pgb);
    // Beef glow + visual (only shown when state === 'available')
    const beefG = new Graphics();
    beefG.alpha = 0;
    pedB.addChild(beefG);
    beef.visual = beefG;
    beef.container = pedB;
    // Label text
    const beefLbl = new Text({
      text: 'BEEF',
      style: { fill: COLORS.yellow, fontFamily: 'monospace', fontSize: 9,
        fontWeight: 'bold', stroke: { color: 0x000000, width: 2 } },
    });
    beefLbl.anchor.set(0.5, 1);
    beefLbl.y = -16;
    beefLbl.alpha = 0;
    pedB.addChild(beefLbl);
    beef.label = beefLbl;
    this.objectivesLayer.addChild(pedB);

    const radioX = this.width * 0.7;
    const radioY = this.height * 0.4;
    const radio = {
      x: radioX, y: radioY, r: 36, kind: 'radio',
      state: 'inactive',
      cooldown: 40,
      captureProgress: 0,
      captureRequired: 3, // seconds of standing
    };
    this.objectives.push(radio);

    // === FLAG — new mini-objective. Capture and hold to earn +1 kill/sec.
    // Game handles the "+1 kill/sec while held" logic in _tickObjectives.
    const flagX = this.width * 0.6;
    const flagY = this.height * 0.7;
    const flag = {
      x: flagX, y: flagY, r: 30, kind: 'flag',
      state: 'inactive',
      cooldown: 55,         // first spawn ~55s in
      held: false,          // becomes true once player captures
      heldT: 0,
      heldSecs: 0,          // total seconds player has held (capped at 10)
    };
    this.objectives.push(flag);
    const pedF = new Container();
    pedF.x = flagX; pedF.y = flagY;
    const pfg = new Graphics();
    // Flag pole
    pfg.rect(-1, -36, 2, 38).fill(0xfafaff);
    pfg.rect(-2, 2, 4, 4).fill(0x3a3a4a);  // base
    pedF.addChild(pfg);
    // Flag visual (drawn into ob.visual so it can be cleared when consumed)
    const flagG = new Graphics();
    flagG.alpha = 0;
    pedF.addChild(flagG);
    flag.visual = flagG;
    flag.container = pedF;
    const flagLbl = new Text({
      text: 'FLAG',
      style: { fill: 0xff3aa1, fontFamily: 'monospace', fontSize: 9,
        fontWeight: 'bold', stroke: { color: 0x000000, width: 2 } },
    });
    flagLbl.anchor.set(0.5, 1);
    flagLbl.y = -44;
    flagLbl.alpha = 0;
    pedF.addChild(flagLbl);
    flag.label = flagLbl;
    this.objectivesLayer.addChild(pedF);
    const pedR = new Container();
    pedR.x = radioX; pedR.y = radioY;
    const prg = new Graphics();
    // Antenna tower base
    prg.rect(-2, -34, 4, 36).fill(0x4a4a52);
    prg.rect(-2, -34, 4, 2).fill(0x6a6a72);
    // Cross bars
    prg.rect(-8, -28, 16, 2).fill(0x4a4a52);
    prg.rect(-6, -20, 12, 2).fill(0x4a4a52);
    prg.rect(-4, -12, 8, 2).fill(0x4a4a52);
    // Antenna tip
    prg.rect(-1, -40, 2, 8).fill(0xc8281f);
    // Base platform
    prg.rect(-16, 0, 32, 6).fill(0x2a2a32);
    prg.rect(-16, 0, 32, 1).fill(0x4a4a52);
    pedR.addChild(prg);
    // Glow ring when capturing
    const radioG = new Graphics();
    radioG.alpha = 0;
    pedR.addChild(radioG);
    radio.visual = radioG;
    radio.container = pedR;
    const radioLbl = new Text({
      text: 'RADIO',
      style: { fill: COLORS.cyan, fontFamily: 'monospace', fontSize: 9,
        fontWeight: 'bold', stroke: { color: 0x000000, width: 2 } },
    });
    radioLbl.anchor.set(0.5, 1);
    radioLbl.y = -48;
    radioLbl.alpha = 0;
    pedR.addChild(radioLbl);
    radio.label = radioLbl;
    this.objectivesLayer.addChild(pedR);
  }

  _addDecor() {
    // BORK BATTLE billboard in background
    const billboard = new Container();
    billboard.x = this.width / 2;
    billboard.y = 60;
    const sign = new Graphics();
    sign.rect(-180, -40, 360, 60).fill(0x0d0820);
    sign.rect(-180, -40, 360, 60).stroke({ color: COLORS.pink, width: 3, alpha: 0.7 });
    sign.rect(-180, -40, 360, 4).fill({ color: COLORS.pink, alpha: 0.6 });
    billboard.addChild(sign);
    const text = new Text({
      text: 'BORK BATTLE',
      style: {
        fill: COLORS.pink,
        fontFamily: 'monospace',
        fontSize: 38,
        fontWeight: 'bold',
        stroke: { color: COLORS.cyan, width: 2 },
        dropShadow: {
          alpha: 0.6, angle: Math.PI / 2, blur: 4,
          color: COLORS.magenta, distance: 2,
        },
      },
    });
    text.anchor.set(0.5);
    text.x = 0; text.y = -10;
    billboard.addChild(text);
    // legs
    const legs = new Graphics();
    legs.rect(-160, 20, 6, 30).fill(0x4a4a52);
    legs.rect(154, 20, 6, 30).fill(0x4a4a52);
    billboard.addChild(legs);
    this.decorLayer.addChild(billboard);

    // Lamp posts at the corners + middle of each edge
    const lampPositions = [
      [200, 200], [this.width - 200, 200],
      [200, this.height - 200], [this.width - 200, this.height - 200],
      [this.width / 2, 200], [this.width / 2, this.height - 200],
      [200, this.height / 2], [this.width - 200, this.height / 2],
    ];
    for (const [x, y] of lampPositions) {
      const lamp = new Container();
      lamp.x = x; lamp.y = y;
      const post = new Graphics();
      post.rect(-2, -8, 4, 30).fill(0x4a4a52);
      post.rect(-2, -8, 1, 30).fill(0x6a6a72);
      // bulb
      post.circle(0, -10, 6).fill(0xfff0b0);
      post.circle(0, -10, 4).fill(0xffffff);
      // glow
      post.circle(0, -10, 18).fill({ color: 0xfff0b0, alpha: 0.15 });
      post.circle(0, -10, 30).fill({ color: 0xfff0b0, alpha: 0.05 });
      lamp.addChild(post);
      this.decorLayer.addChild(lamp);
      this.lamps.push({ x, y });
    }

    // RAMPS — small angled wooden ramps that decorate the arena (no gameplay
    // effect, purely visual variety so the field doesn't feel flat).
    for (let i = 0; i < 6; i++) {
      const x = 200 + this.rng() * (this.width - 400);
      const y = 200 + this.rng() * (this.height - 400);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 280) { i--; continue; }
      const r = new Graphics();
      r.rect(-16, -8, 32, 16).fill(COLORS.ramp);
      r.rect(-16, -8, 32, 2).fill(0xffb060);
      r.rect(-16, 6, 32, 2).fill(0xa05a1c);
      // angled wedge front
      r.rect(-16, 8, 32, 4).fill(0x8a5a2c);
      r.rect(-16, 8, 32, 1).fill(0xa07a4a);
      r.x = x; r.y = y;
      this.decorLayer.addChild(r);
    }
    // BOXES / CRATES — wooden ammo boxes scattered as cover-like decor.
    for (let i = 0; i < 14; i++) {
      const x = 200 + this.rng() * (this.width - 400);
      const y = 200 + this.rng() * (this.height - 400);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 240) { i--; continue; }
      const b = new Graphics();
      const c = 0x8a5a2c;
      b.rect(-9, -9, 18, 18).fill(c);
      b.rect(-9, -9, 18, 2).fill(0xc8a878);
      b.rect(-9, 7, 18, 2).fill(0x4a2a0c);
      b.rect(-9, -9, 2, 18).fill(0xa07a4a);
      b.rect(7, -9, 2, 18).fill(0x4a2a0c);
      // X-brace
      b.moveTo(-7, -7).lineTo(7, 7).stroke({ color: 0x4a2a0c, width: 1 });
      b.moveTo(7, -7).lineTo(-7, 7).stroke({ color: 0x4a2a0c, width: 1 });
      b.x = x; b.y = y;
      this.decorLayer.addChild(b);
    }
    // ABANDONED VEHICLES — small parked-cars near the edges. Cosmetic.
    const vehiclePositions = [
      [320, 320], [this.width - 320, 380], [380, this.height - 320],
      [this.width - 380, this.height - 360], [this.width / 2, 280],
    ];
    for (const [x, y] of vehiclePositions) {
      const v = new Graphics();
      const c = [0xc8281f, 0x4a4aaa, 0xeac018, 0x4a8a4a][Math.floor(this.rng() * 4)];
      v.rect(-22, -10, 44, 20).fill(c);
      v.rect(-22, -10, 44, 3).fill(0xffffff);
      v.rect(-22, 7, 44, 3).fill(0x222228);
      // windows
      v.rect(-18, -7, 14, 5).fill({ color: 0x4cc9f0, alpha: 0.5 });
      v.rect(4, -7, 14, 5).fill({ color: 0x4cc9f0, alpha: 0.5 });
      // wheels
      v.circle(-14, 10, 3).fill(0x101018);
      v.circle(14, 10, 3).fill(0x101018);
      // headlights
      v.rect(-22, -5, 2, 4).fill(0xffd23f);
      v.rect(20, -5, 2, 4).fill(0xffd23f);
      v.x = x; v.y = y;
      this.decorLayer.addChild(v);
    }
    // SMALL TREES — extra arena variety
    for (let i = 0; i < 10; i++) {
      const x = 200 + this.rng() * (this.width - 400);
      const y = 200 + this.rng() * (this.height - 400);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 280) { i--; continue; }
      const t = new Graphics();
      // trunk
      t.rect(-2, 0, 4, 10).fill(0x4a2a14);
      t.rect(-2, 0, 1, 10).fill(0x6a3a1c);
      // canopy
      const c = [0x3a7a4a, 0x4a8a5a, 0x2a6a3a][Math.floor(this.rng() * 3)];
      t.circle(0, -4, 9).fill(c);
      t.circle(-3, -6, 5).fill({ color: 0xffffff, alpha: 0.2 });
      t.x = x; t.y = y;
      this.decorLayer.addChild(t);
    }
    // Scattered tennis balls + chew toys + bowls
    for (let i = 0; i < 20; i++) {
      const x = 80 + this.rng() * (this.width - 160);
      const y = 80 + this.rng() * (this.height - 160);
      const cx = this.width / 2, cy = this.height / 2;
      if (Math.hypot(x - cx, y - cy) < 200) continue;
      const prop = this.rng();
      const g = new Graphics();
      if (prop < 0.4) {
        // tennis ball
        g.circle(x, y, 4).fill(0xc8e858);
        g.circle(x, y, 4).stroke({ color: 0x6a8838, width: 1 });
        g.moveTo(x - 3, y - 1).lineTo(x + 3, y - 1).stroke({ color: 0xfafafa, width: 1, alpha: 0.7 });
      } else if (prop < 0.7) {
        // chew toy bone
        g.rect(x - 6, y - 2, 12, 4).fill(0xeeb87a);
        g.rect(x - 7, y - 3, 3, 6).fill(0xeeb87a);
        g.rect(x + 4, y - 3, 3, 6).fill(0xeeb87a);
        g.rect(x - 6, y - 2, 12, 1).fill(0xfde0b8);
      } else {
        // pixel bench
        g.rect(x - 8, y - 2, 16, 3).fill(0x6a3a1c);
        g.rect(x - 8, y - 2, 16, 1).fill(0x8a5a2c);
        g.rect(x - 6, y + 1, 2, 4).fill(0x4a2a0c);
        g.rect(x + 4, y + 1, 2, 4).fill(0x4a2a0c);
      }
      this.decorLayer.addChild(g);
    }
  }

  _generateMap() {
    for (let i = 0; i < 5; i++) {
      const f = this._newFountain();
      this.fountains.push(f);
      this.itemsLayer.addChild(f.container);
    }
    for (let i = 0; i < 10; i++) {
      const h = this._newHydrant();
      this.hydrants.push(h);
      this.itemsLayer.addChild(h.container);
    }
    for (let i = 0; i < 14; i++) {
      this._addFence();
    }
  }

  _safeRandomPos(margin = 200) {
    for (let tries = 0; tries < 60; tries++) {
      const x = margin + this.rng() * (this.width - margin * 2);
      const y = margin + this.rng() * (this.height - margin * 2);
      const cx = this.width / 2, cy = this.height / 2;
      if (Math.hypot(x - cx, y - cy) > 240) return { x, y };
    }
    return { x: margin + this.rng() * 400, y: margin + this.rng() * 400 };
  }

  _newFountain() {
    const { x, y } = this._safeRandomPos(180);
    const c = new Container();
    c.x = x; c.y = y;
    // base stone
    const base = new Graphics();
    base.ellipse(0, 8, 22, 6).fill(0x4a4a3a);
    base.ellipse(0, 8, 22, 6).stroke({ color: 0x6a6a52, width: 1 });
    base.rect(-18, 0, 36, 10).fill(0x4a4a3a);
    base.rect(-18, 0, 36, 2).fill(0x6a6a52);
    base.rect(-18, 8, 36, 2).fill(0x2a2a1a);
    // pillar
    base.rect(-3, -10, 6, 14).fill(0x6a6a52);
    base.rect(-3, -10, 1, 14).fill(0x8a8a72);
    // bowl on top
    base.ellipse(0, -12, 8, 3).fill(0x4a4a3a);
    base.ellipse(0, -12, 8, 3).stroke({ color: 0x6a6a52, width: 1 });
    c.addChild(base);
    // glow column (animated)
    const glow = new Graphics();
    c.addChild(glow);
    return {
      container: c, glow, x, y,
      cycleT: Math.random() * 12,
      eruptT: 0,
    };
  }

  _newHydrant() {
    const { x, y } = this._safeRandomPos(160);
    const c = new Container();
    c.x = x; c.y = y;
    const g = new Graphics();
    // body
    g.rect(-7, -12, 14, 16).fill(COLORS.hydrant);
    g.rect(-7, -12, 14, 3).fill(0xff8a8a);
    g.rect(-7, 2, 14, 2).fill(shade(COLORS.hydrant, 0.5));
    // arms (sides)
    g.rect(-10, -5, 3, 5).fill(COLORS.hydrant);
    g.rect(-10, -5, 1, 5).fill(0xff8a8a);
    g.rect(7, -5, 3, 5).fill(COLORS.hydrant);
    g.rect(9, -5, 1, 5).fill(shade(COLORS.hydrant, 0.5));
    // top cap
    g.rect(-3, -16, 6, 4).fill(COLORS.hydrant);
    g.rect(-3, -16, 6, 1).fill(0xff8a8a);
    g.rect(-2, -14, 4, 2).fill(shade(COLORS.hydrant, 1.4));
    // status indicator (small light)
    g.circle(0, -10, 2).fill(COLORS.green);
    c.addChild(g);
    // status indicator ref (we tint when on cooldown)
    return {
      container: c, g, x, y,
      ready: true,
      cooldownT: 0,
      radius: 18,
    };
  }

  _addFence() {
    const horizontal = this.rng() < 0.5;
    const len = 80 + Math.floor(this.rng() * 5) * 30;
    const { x, y } = this._safeRandomPos(140);
    const w = horizontal ? len : 14;
    const h = horizontal ? 14 : len;
    const fx = Math.min(x, this.width - w - 20);
    const fy = Math.min(y, this.height - h - 20);
    const g = new Graphics();
    // back fill
    g.rect(0, 0, w, h).fill(0x0d0820);
    // chain-link diagonal cross-hatch
    if (horizontal) {
      // horizontal segment
      for (let i = 0; i < w; i += 3) {
        g.moveTo(i, 2).lineTo(i + 3, h - 2).stroke({ color: COLORS.cyan, width: 1, alpha: 0.45 });
        g.moveTo(i + 3, 2).lineTo(i, h - 2).stroke({ color: COLORS.cyan, width: 1, alpha: 0.45 });
      }
      // top + bottom rails
      g.rect(0, 0, w, 2).fill(COLORS.cyan);
      g.rect(0, 0, w, 1).fill(0xb0e8ff);
      g.rect(0, h - 2, w, 2).fill(shade(COLORS.cyan, 0.5));
      // posts
      g.rect(0, 0, 3, h).fill(0x4a4a52);
      g.rect(w - 3, 0, 3, h).fill(0x4a4a52);
    } else {
      for (let i = 0; i < h; i += 3) {
        g.moveTo(2, i).lineTo(w - 2, i + 3).stroke({ color: COLORS.cyan, width: 1, alpha: 0.45 });
        g.moveTo(w - 2, i).lineTo(2, i + 3).stroke({ color: COLORS.cyan, width: 1, alpha: 0.45 });
      }
      g.rect(0, 0, 2, h).fill(COLORS.cyan);
      g.rect(0, 0, 1, h).fill(0xb0e8ff);
      g.rect(w - 2, 0, 2, h).fill(shade(COLORS.cyan, 0.5));
      g.rect(0, 0, w, 3).fill(0x4a4a52);
      g.rect(0, h - 3, w, 3).fill(0x4a4a52);
    }
    g.x = fx; g.y = fy;
    this.mapLayer.addChild(g);
    this.fences.push({ x: fx, y: fy, w, h });
  }

  _buildTornado() {
    const c = new Container();
    c.x = this.width / 2;
    c.y = this.height / 2;
    this.itemsLayer.addChild(c);
    // base ring with gradient
    const ring = new Graphics();
    ring.circle(0, 0, 80).fill({ color: 0x4a0a55, alpha: 0.5 });
    ring.circle(0, 0, 80).stroke({ color: COLORS.magenta, width: 3, alpha: 0.8 });
    ring.circle(0, 0, 70).stroke({ color: COLORS.pink, width: 2, alpha: 0.4 });
    ring.circle(0, 0, 60).stroke({ color: COLORS.cyan, width: 1, alpha: 0.4 });
    c.addChild(ring);
    // LOOT label
    const loot = new Text({
      text: '★ LOOT ★',
      style: {
        fill: COLORS.yellow,
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 2 },
      },
    });
    loot.anchor.set(0.5);
    loot.y = -100;
    c.addChild(loot);
    // frisbees orbiting
    const frisbees = [];
    for (let i = 0; i < 14; i++) {
      const f = new Graphics();
      const col = [COLORS.pink, COLORS.cyan, COLORS.yellow, COLORS.green, COLORS.magenta][i % 5];
      f.ellipse(0, 0, 10, 4).fill(col);
      f.ellipse(0, 0, 10, 4).stroke({ color: 0xffffff, width: 1, alpha: 0.6 });
      c.addChild(f);
      frisbees.push({ g: f, angle: (i / 14) * Math.PI * 2, r: 30 + (i % 4) * 14, speed: 1.2 + (i % 3) * 0.4 });
    }
    this.tornado = {
      container: c, frisbees, loot,
      x: this.width / 2, y: this.height / 2,
      radius: 75, damage: 16,
      // Loot drop state — Game owns the timer/spawn logic; we just hold refs
      // so Game can update the floating label per-frame.
      lootText: '★ LOOT ★',
      lootColor: COLORS.yellow,
    };
  }

  _spawnAmbientMote() {
    const colors = [0x4cc9f0, 0xff3aa1, 0xffd23f, 0x5ef38c, 0xb055ff, 0xffffff];
    const c = colors[Math.floor(Math.random() * colors.length)];
    const g = new Graphics();
    const size = Math.random() < 0.25 ? 2 : 1;
    g.rect(0, 0, size, size).fill(c);
    g.x = Math.random() * this.width;
    g.y = Math.random() * this.height;
    g.alpha = 0;
    this.ambientLayer.addChild(g);
    this.ambientParticles.push({
      g,
      x: g.x, y: g.y,
      vx: (Math.random() - 0.5) * 8,
      vy: -8 - Math.random() * 14, // drift up
      life: 4 + Math.random() * 3,
      t: 0,
      twinkleT: Math.random() * Math.PI * 2,
    });
  }

  _updateAmbient(dt) {
    // spawn budget — keep population ~60 motes
    this._ambientSpawnT += dt;
    while (this._ambientSpawnT > 0.08 && this.ambientParticles.length < 60) {
      this._ambientSpawnT -= 0.08;
      this._spawnAmbientMote();
    }
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const p = this.ambientParticles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.twinkleT += dt * 4;
      p.g.x = p.x;
      p.g.y = p.y;
      // fade in then out
      const lifeK = p.t / p.life;
      const baseAlpha = lifeK < 0.2
        ? lifeK / 0.2
        : (lifeK > 0.7 ? Math.max(0, (1 - lifeK) / 0.3) : 1);
      // gentle twinkle
      const twinkle = 0.6 + 0.4 * Math.sin(p.twinkleT);
      p.g.alpha = baseAlpha * twinkle * 0.7;
      if (p.t >= p.life || p.y < -20 || p.x < -20 || p.x > this.width + 20) {
        p.g.destroy();
        this.ambientParticles.splice(i, 1);
      }
    }
  }

  update(dt, matchTimeSec) {
    this._updateAmbient(dt);
    this._updateHazards(dt, matchTimeSec);
    this._updateObjectives(dt, matchTimeSec);
    // Fountains
    for (const f of this.fountains) {
      f.cycleT += dt;
      const period = 12;
      const t = f.cycleT % period;
      f.glow.clear();
      if (t < 8) {
        // charging
        const k = t / 8;
        f.glow.rect(-2, -16 - k * 8, 4, 4 + k * 6).fill({ color: COLORS.treat, alpha: 0.4 + k * 0.3 });
        f.glow.circle(0, -18, 4 + k * 3).fill({ color: COLORS.treat, alpha: 0.2 + k * 0.4 });
      } else {
        // erupting — geyser column
        f.glow.rect(-3, -32, 6, 24).fill({ color: COLORS.treatGlow, alpha: 0.85 });
        f.glow.rect(-2, -36, 4, 28).fill({ color: 0xffffff, alpha: 0.9 });
        f.glow.circle(0, -36, 8).fill({ color: COLORS.treat, alpha: 0.7 });
        f.glow.circle(0, -36, 5).fill({ color: 0xffffff, alpha: 0.9 });
      }
    }
    // Hydrants
    for (const h of this.hydrants) {
      if (!h.ready) {
        h.cooldownT -= dt;
        if (h.cooldownT <= 0) {
          h.ready = true;
          h.g.tint = 0xffffff;
        }
      }
    }
    // Tornado spin
    for (const f of this.tornado.frisbees) {
      f.angle += f.speed * dt;
      f.g.x = Math.cos(f.angle) * f.r;
      f.g.y = Math.sin(f.angle) * f.r * 0.5;
      f.g.rotation = f.angle;
    }
    if (this.tornado.loot) {
      this.tornado.loot.y = -100 + Math.sin(matchTimeSec * 2) * 4;
      // Sync label text/color if Game has updated it (cheap; Text only updates
      // its texture when content actually changes).
      if (this.tornado.loot.text !== this.tornado.lootText) {
        this.tornado.loot.text = this.tornado.lootText;
      }
      if (this.tornado.lootColor != null && this.tornado.loot.style.fill !== this.tornado.lootColor) {
        this.tornado.loot.style.fill = this.tornado.lootColor;
      }
    }

    this._updateZone(dt, matchTimeSec);
  }

  // Per-frame hazard animation — pulse the overlay so they read as "dangerous".
  _updateHazards(dt, matchTimeSec) {
    for (const h of this.hazards) {
      if (!h.visual) continue;
      h.visual.clear();
      const t = matchTimeSec * 4;
      const pulse = 0.5 + 0.5 * Math.sin(t);
      if (h.kind === 'poison') {
        // Bubbling green wisps that rise + fade
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + matchTimeSec * 0.4;
          const r = h.r * 0.45;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r * 0.5 - (Math.sin(t + i) * 8);
          h.visual.circle(x, y, 4 + pulse * 2)
            .fill({ color: 0x9af09a, alpha: 0.3 + pulse * 0.3 });
        }
      } else if (h.kind === 'wet') {
        // Shimmer dots on the puddle
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + matchTimeSec * 0.6;
          const r = h.r * 0.4;
          h.visual.circle(Math.cos(a) * r, Math.sin(a) * r * 0.6, 2)
            .fill({ color: 0xffffff, alpha: 0.4 + pulse * 0.4 });
        }
      }
    }
  }

  // Objectives spawn periodically. Logic for awarding effect lives in Game; here
  // we only animate visuals + flip state machine.
  _updateObjectives(dt, matchTimeSec) {
    for (const ob of this.objectives) {
      ob.cooldown -= dt;
      // Spawn-available transition
      if (ob.state === 'inactive' && ob.cooldown <= 0) {
        ob.state = 'available';
        ob.label.alpha = 1;
        ob.visual.alpha = 1;
        if (ob.kind === 'beef') {
          // Draw the beef chunk
          ob.visual.clear();
          ob.visual.rect(-12, -16, 24, 14).fill(0xc8281f); // raw beef
          ob.visual.rect(-12, -16, 24, 2).fill(0xff5a3a);
          ob.visual.rect(-12, -4, 24, 2).fill(0x6a0a0a);
          // marbling
          ob.visual.rect(-8, -12, 4, 1).fill(0xffffff);
          ob.visual.rect(2, -10, 4, 1).fill(0xffffff);
          ob.visual.rect(-6, -8, 4, 1).fill(0xffffff);
          // bone sticking out top
          ob.visual.rect(-2, -22, 4, 8).fill(0xfde0b8);
          ob.visual.rect(-4, -22, 8, 2).fill(0xfde0b8);
        } else if (ob.kind === 'radio') {
          ob.visual.clear();
          ob.captureProgress = 0;
        }
      }
      // Available — pulse the label
      if (ob.state === 'available') {
        const pulse = 0.6 + 0.4 * Math.sin(matchTimeSec * 6);
        if (ob.label) ob.label.scale.set(pulse * 0.4 + 0.9);
        if (ob.kind === 'beef' && ob.visual) {
          // Halo glow
          ob.visual.clear();
          ob.visual.circle(0, -10, 28 + pulse * 4)
            .fill({ color: 0xffd23f, alpha: 0.1 + pulse * 0.15 });
          ob.visual.rect(-12, -16, 24, 14).fill(0xc8281f);
          ob.visual.rect(-12, -16, 24, 2).fill(0xff5a3a);
          ob.visual.rect(-12, -4, 24, 2).fill(0x6a0a0a);
          ob.visual.rect(-8, -12, 4, 1).fill(0xffffff);
          ob.visual.rect(2, -10, 4, 1).fill(0xffffff);
          ob.visual.rect(-6, -8, 4, 1).fill(0xffffff);
          ob.visual.rect(-2, -22, 4, 8).fill(0xfde0b8);
          ob.visual.rect(-4, -22, 8, 2).fill(0xfde0b8);
        } else if (ob.kind === 'radio' && ob.visual) {
          // Capture ring (fills as captureProgress grows)
          ob.visual.clear();
          const ringAlpha = 0.4 + pulse * 0.3;
          ob.visual.circle(0, -16, 40)
            .stroke({ color: 0x4cc9f0, width: 3, alpha: ringAlpha });
          // Progress arc
          const prog = Math.min(1, ob.captureProgress / ob.captureRequired);
          if (prog > 0) {
            // Pixel-art arc emulated with N tick dots
            const ticks = Math.floor(prog * 24);
            for (let i = 0; i < ticks; i++) {
              const a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
              ob.visual.rect(Math.cos(a) * 40 - 1, -16 + Math.sin(a) * 40 - 1, 3, 3)
                .fill(0x5ef38c);
            }
          }
        } else if (ob.kind === 'flag' && ob.visual) {
          // Pink waving flag — flap animated by sin
          ob.visual.clear();
          const wave = Math.sin(matchTimeSec * 5) * 2;
          // flag rectangle
          ob.visual.moveTo(1, -36).lineTo(1 + 18, -32 + wave).lineTo(1 + 18, -22 + wave).lineTo(1, -18).closePath().fill(0xff3aa1);
          ob.visual.moveTo(1, -36).lineTo(8, -34 + wave * 0.5).lineTo(8, -26 + wave * 0.5).lineTo(1, -24).closePath().fill({ color: 0xffffff, alpha: 0.3 });
          // glow ring
          ob.visual.circle(0, -18, 28 + pulse * 4)
            .stroke({ color: 0xff3aa1, width: 2, alpha: 0.4 + pulse * 0.3 });
        }
      }
    }
  }

  // Returns the hazard the point lies in, or null. Game uses this for HP drain / friction.
  pointInHazard(x, y) {
    for (const h of this.hazards) {
      const dx = x - h.x, dy = y - h.y;
      if (dx * dx + dy * dy < h.r * h.r) return h;
    }
    return null;
  }

  // Returns any 'available' objective at this point, or null.
  pointInObjective(x, y) {
    for (const ob of this.objectives) {
      if (ob.state !== 'available') continue;
      const dx = x - ob.x, dy = y - ob.y;
      if (dx * dx + dy * dy < ob.r * ob.r) return ob;
    }
    return null;
  }

  // Game calls this after a successful pickup to reset the cooldown timer.
  consumeObjective(ob, cooldownSec = null) {
    ob.state = 'inactive';
    ob.cooldown = cooldownSec != null ? cooldownSec : (ob.kind === 'beef' ? 45 : 60);
    if (ob.visual) ob.visual.clear();
    if (ob.label) ob.label.alpha = 0;
  }

  _updateZone(dt, matchTimeSec) {
    const z = this.zone;
    if (matchTimeSec < z.shrinkStart) {
      z.x = 0; z.y = 0; z.w = this.width; z.h = this.height;
    } else if (matchTimeSec < z.shrinkEnd) {
      const k = (matchTimeSec - z.shrinkStart) / (z.shrinkEnd - z.shrinkStart);
      const easedK = k * k * (3 - 2 * k);
      z.x = lerp(0, z.targetX, easedK);
      z.y = lerp(0, z.targetY, easedK);
      z.w = lerp(this.width, z.targetW, easedK);
      z.h = lerp(this.height, z.targetH, easedK);
    } else {
      z.x = z.targetX; z.y = z.targetY; z.w = z.targetW; z.h = z.targetH;
    }

    const g = this.zoneGraphics;
    g.clear();
    // Sky-tint shifts as zone shrinks: SAFE = subtle pink → FINAL = deep crimson.
    // shrinkFraction: 0 at start, 1 at fully-shrunk.
    const total = z.shrinkEnd - z.shrinkStart;
    const shrinkFraction = total > 0
      ? Math.max(0, Math.min(1, (matchTimeSec - z.shrinkStart) / total))
      : 0;
    // Stronger outside-zone tint as we approach the final phase.
    const dangerAlpha = 0.22 + shrinkFraction * 0.18;
    const dangerColor = { color: COLORS.zoneEdge, alpha: dangerAlpha };
    if (z.y > 0) g.rect(0, 0, this.width, z.y).fill(dangerColor);
    if (z.y + z.h < this.height) g.rect(0, z.y + z.h, this.width, this.height - z.y - z.h).fill(dangerColor);
    if (z.x > 0) g.rect(0, z.y, z.x, z.h).fill(dangerColor);
    if (z.x + z.w < this.width) g.rect(z.x + z.w, z.y, this.width - z.x - z.w, z.h).fill(dangerColor);
    // Edge wall — thick + animated pulse. Outer halo grows wider during shrink.
    const pulse = 0.5 + 0.5 * Math.sin(matchTimeSec * 6);
    const wallWidth = 4 + shrinkFraction * 4;
    g.rect(z.x, z.y, z.w, z.h).stroke({ color: COLORS.zoneEdge, width: wallWidth, alpha: 0.7 + pulse * 0.3 });
    // Outer glow halo — sits OUTSIDE the safe zone, fades from the edge
    g.rect(z.x - 6, z.y - 6, z.w + 12, z.h + 12).stroke({ color: 0xff8aff, width: 2, alpha: 0.4 + pulse * 0.2 });
    g.rect(z.x - 12, z.y - 12, z.w + 24, z.h + 24).stroke({ color: 0xff3aa1, width: 1, alpha: 0.2 + pulse * 0.15 });
    // Inner glow line
    g.rect(z.x + 3, z.y + 3, z.w - 6, z.h - 6).stroke({ color: 0xff8aff, width: 2, alpha: 0.4 });
    // Vertical pixel hatching on the wall + animated drips during shrink
    if (z.y > 0) {
      for (let x = z.x; x < z.x + z.w; x += 6) {
        g.rect(x, z.y - 4, 2, 4).fill({ color: COLORS.zoneEdge, alpha: 0.7 });
      }
      // Pink particle "rain" cascading inside the wall during shrink
      if (shrinkFraction > 0.2) {
        const dripCount = Math.floor(z.w / 30);
        for (let i = 0; i < dripCount; i++) {
          const dx = z.x + (i / dripCount) * z.w + ((matchTimeSec * 60) % 30);
          const dy = z.y - 8 + ((matchTimeSec * 80 + i * 17) % 16);
          g.rect(dx, dy, 2, 6).fill({ color: 0xff3aa1, alpha: 0.6 * shrinkFraction });
        }
      }
    }
    if (z.y + z.h < this.height) {
      for (let x = z.x; x < z.x + z.w; x += 6) {
        g.rect(x, z.y + z.h, 2, 4).fill({ color: COLORS.zoneEdge, alpha: 0.7 });
      }
      if (shrinkFraction > 0.2) {
        const dripCount = Math.floor(z.w / 30);
        for (let i = 0; i < dripCount; i++) {
          const dx = z.x + (i / dripCount) * z.w + ((matchTimeSec * 60) % 30);
          const dy = z.y + z.h + 4 + ((matchTimeSec * 80 + i * 17) % 16);
          g.rect(dx, dy, 2, 6).fill({ color: 0xff3aa1, alpha: 0.6 * shrinkFraction });
        }
      }
    }
    // Side walls — pink particle rain for left/right
    if (z.x > 0 || z.x + z.w < this.width) {
      const lateralDrips = Math.floor(z.h / 30);
      for (let i = 0; i < lateralDrips; i++) {
        const dy = z.y + (i / lateralDrips) * z.h + ((matchTimeSec * 60) % 30);
        if (z.x > 0 && shrinkFraction > 0.2) {
          const dx = z.x - 8 + ((matchTimeSec * 80 + i * 17) % 16);
          g.rect(dx, dy, 6, 2).fill({ color: 0xff3aa1, alpha: 0.6 * shrinkFraction });
        }
        if (z.x + z.w < this.width && shrinkFraction > 0.2) {
          const dx = z.x + z.w + 4 + ((matchTimeSec * 80 + i * 17) % 16);
          g.rect(dx, dy, 6, 2).fill({ color: 0xff3aa1, alpha: 0.6 * shrinkFraction });
        }
      }
    }
    // === ELECTRIC ARCS (Round 2 polish) ===
    // Random short pink lightning arcs running along the zone boundary.
    // Only active during the shrink phase (so calm pre-game isn't busy).
    // We draw 6 jagged 3-segment polylines per frame at pseudo-random spots
    // along the perimeter. Driven by matchTimeSec for stable "flicker" feel.
    if (shrinkFraction > 0.05) {
      const arcCount = 6;
      const perimeter = 2 * (z.w + z.h);
      for (let i = 0; i < arcCount; i++) {
        // Distribute starts around perimeter, offset by time
        const phase = (i / arcCount + matchTimeSec * 0.7 + i * 0.137) % 1;
        // Sub-flicker: only render about 50% of the time per arc
        if ((Math.sin(matchTimeSec * 20 + i * 1.3) > 0.0) ? false : true) continue;
        const dist = phase * perimeter;
        // map dist around the rectangle perimeter to (x, y, dirX, dirY)
        let sx, sy, dx, dy;
        if (dist < z.w) {
          // top edge → going right
          sx = z.x + dist; sy = z.y; dx = 0; dy = -1;
        } else if (dist < z.w + z.h) {
          // right edge → going down
          sx = z.x + z.w; sy = z.y + (dist - z.w); dx = 1; dy = 0;
        } else if (dist < 2 * z.w + z.h) {
          // bottom edge → going left
          sx = z.x + (2 * z.w + z.h - dist); sy = z.y + z.h; dx = 0; dy = 1;
        } else {
          // left edge → going up
          sx = z.x; sy = z.y + (2 * (z.w + z.h) - dist); dx = -1; dy = 0;
        }
        // Draw a 4-segment zigzag perpendicular to the edge (out into danger)
        const segLen = 8;
        const arcCol = i % 2 === 0 ? 0xff8aff : 0xb0e8ff;
        const baseAlpha = 0.7 + Math.sin(matchTimeSec * 14 + i) * 0.3;
        let px = sx, py = sy;
        for (let s = 0; s < 4; s++) {
          // small random kink each segment — seeded by matchTime so it shifts
          const k = Math.sin(matchTimeSec * 30 + i * 2.7 + s * 0.4) * 4;
          const tx = px + dx * segLen + (-dy) * k;
          const ty = py + dy * segLen + (dx) * k;
          g.moveTo(px, py).lineTo(tx, ty)
            .stroke({ color: arcCol, width: 2, alpha: baseAlpha * 0.9 });
          px = tx; py = ty;
        }
        // bright endpoint spark
        g.circle(px, py, 2).fill({ color: 0xffffff, alpha: baseAlpha });
      }
    }
  }

  pointInSafeZone(x, y) {
    const z = this.zone;
    return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
  }

  resolveFenceCollision(ent, radius) {
    for (const f of this.fences) {
      const closestX = Math.max(f.x, Math.min(ent.x, f.x + f.w));
      const closestY = Math.max(f.y, Math.min(ent.y, f.y + f.h));
      const dx = ent.x - closestX;
      const dy = ent.y - closestY;
      const dist = Math.hypot(dx, dy);
      if (dist < radius) {
        if (dist === 0) {
          ent.x += (Math.random() - 0.5) * 2;
          continue;
        }
        const overlap = radius - dist;
        ent.x += (dx / dist) * overlap;
        ent.y += (dy / dist) * overlap;
      }
    }
  }

  projectileHitsFence(x, y) {
    for (const f of this.fences) {
      if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return true;
    }
    return false;
  }

  fountainEruptingNow(f) {
    const t = f.cycleT % 12;
    return t >= 8 && t < 12;
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
