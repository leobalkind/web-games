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

    this._drawBackground();
    this._addDecor();
    this._generateMap();
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
    // Strong magenta tint outside safe zone
    const dangerColor = { color: COLORS.zoneEdge, alpha: 0.22 };
    if (z.y > 0) g.rect(0, 0, this.width, z.y).fill(dangerColor);
    if (z.y + z.h < this.height) g.rect(0, z.y + z.h, this.width, this.height - z.y - z.h).fill(dangerColor);
    if (z.x > 0) g.rect(0, z.y, z.x, z.h).fill(dangerColor);
    if (z.x + z.w < this.width) g.rect(z.x + z.w, z.y, this.width - z.x - z.w, z.h).fill(dangerColor);
    // Edge wall — thick + animated pulse
    const pulse = 0.5 + 0.5 * Math.sin(matchTimeSec * 6);
    g.rect(z.x, z.y, z.w, z.h).stroke({ color: COLORS.zoneEdge, width: 4, alpha: 0.6 + pulse * 0.4 });
    // inner glow line
    g.rect(z.x + 3, z.y + 3, z.w - 6, z.h - 6).stroke({ color: 0xff8aff, width: 2, alpha: 0.4 });
    // vertical pixel hatching on the wall
    if (z.y > 0) {
      for (let x = z.x; x < z.x + z.w; x += 6) {
        g.rect(x, z.y - 4, 2, 4).fill({ color: COLORS.zoneEdge, alpha: 0.7 });
      }
    }
    if (z.y + z.h < this.height) {
      for (let x = z.x; x < z.x + z.w; x += 6) {
        g.rect(x, z.y + z.h, 2, 4).fill({ color: COLORS.zoneEdge, alpha: 0.7 });
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
