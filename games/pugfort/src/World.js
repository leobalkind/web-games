import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

// =============================================================================
// World — bigger procedural neon-suburb. Layered background + dense decor:
// buildings, trees, rocks, forest clusters, dumpsters, crashed cars, lamps.
// =============================================================================
export class World {
  constructor(opts = {}) {
    this.width = opts.width || 3600;
    this.height = opts.height || 2700;

    this.container = new Container();
    this.container.label = 'world';

    this.bg = new Container();         this.bg.label = 'bg';
    this.decorLayer = new Container(); this.decorLayer.label = 'decor';
    this.mapLayer = new Container();   this.mapLayer.label = 'map';
    this.itemsLayer = new Container(); this.itemsLayer.label = 'items';
    this.entitiesLayer = new Container(); this.entitiesLayer.label = 'entities';
    this.effectsLayer = new Container(); this.effectsLayer.label = 'effects';
    this.tintLayer = new Container();  this.tintLayer.label = 'tint';
    this.container.addChild(
      this.bg, this.decorLayer, this.mapLayer, this.itemsLayer,
      this.entitiesLayer, this.effectsLayer, this.tintLayer,
    );

    this.lamps = [];
    this._drawBackground();
    this._addBuildings();
    this._addLamps();
    this._addForests();
    this._addRocks();
    this._addDecor();
    this._addPuddlesAndStains();
    this._addMicroDetail();
    this._addSignsAndFences();

    this.tintRect = new Graphics();
    this.tintRect.rect(0, 0, this.width, this.height).fill({ color: COLORS.nightTint, alpha: 0 });
    this.tintLayer.addChild(this.tintRect);
  }

  _drawBackground() {
    const base = new Graphics();
    base.rect(0, 0, this.width, this.height).fill(COLORS.ground);
    this.bg.addChild(base);

    // ULTRA-DENSE speckle pass: 3x density + more color variety
    const speck = new Graphics();
    const speckCount = Math.floor((this.width * this.height) / 400);
    for (let i = 0; i < speckCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const c = [0x1f1340, 0x2a1a44, 0x14102a, 0x1a2a3a, 0x251735, 0x1c1428, 0x2e1f48][Math.floor(Math.random() * 7)];
      speck.rect(x, y, 2, 2).fill(c);
    }
    // tiny single-pixel grit (extra detail)
    for (let i = 0; i < speckCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const c = [0x3a2a4a, 0x2a1a3a, 0x1a0e2a][Math.floor(Math.random() * 3)];
      speck.rect(x, y, 1, 1).fill(c);
    }
    // grass tufts (much denser)
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const baseG = [0x2a5a3a, 0x3a7a4a, 0x1a4a2a, 0x4a8a5a][Math.floor(Math.random() * 4)];
      speck.rect(x, y, 1, 3).fill(baseG);
      speck.rect(x + 1, y + 1, 1, 2).fill(shade(baseG, 1.3));
    }
    // scattered dead leaves
    for (let i = 0; i < 240; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const c = [0x8a5a2c, 0x6a3a1c, 0xc8782a, 0xa05a2a][Math.floor(Math.random() * 4)];
      speck.rect(x, y, 2, 1).fill(c);
      speck.rect(x + 1, y, 1, 2).fill(shade(c, 0.7));
    }
    // tiny moss patches
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      speck.circle(x, y, 2).fill({ color: 0x3a7a4a, alpha: 0.6 });
      speck.rect(x - 1, y, 1, 1).fill({ color: 0x5aaa6a, alpha: 0.7 });
    }
    this.bg.addChild(speck);

    // crossroads paving at center
    const path = new Graphics();
    path.rect(0, this.height / 2 - 80, this.width, 160).fill({ color: COLORS.asphalt, alpha: 0.85 });
    path.rect(this.width / 2 - 80, 0, 160, this.height).fill({ color: COLORS.asphalt, alpha: 0.85 });
    // neon edge stripes
    path.rect(0, this.height / 2 - 80, this.width, 2).fill({ color: COLORS.neonCyan, alpha: 0.55 });
    path.rect(0, this.height / 2 + 78, this.width, 2).fill({ color: COLORS.neonPink, alpha: 0.55 });
    path.rect(this.width / 2 - 80, 0, 2, this.height).fill({ color: COLORS.neonCyan, alpha: 0.55 });
    path.rect(this.width / 2 + 78, 0, 2, this.height).fill({ color: COLORS.neonPink, alpha: 0.55 });
    // dashed centerlines
    for (let x = 30; x < this.width; x += 50) {
      path.rect(x, this.height / 2 - 1, 24, 2).fill({ color: COLORS.neonYellow, alpha: 0.65 });
    }
    for (let y = 30; y < this.height; y += 50) {
      path.rect(this.width / 2 - 1, y, 2, 24).fill({ color: COLORS.neonYellow, alpha: 0.65 });
    }
    this.bg.addChild(path);

    // subtle grid
    const grid = new Graphics();
    for (let x = 0; x <= this.width; x += 100) grid.moveTo(x, 0).lineTo(x, this.height);
    for (let y = 0; y <= this.height; y += 100) grid.moveTo(0, y).lineTo(this.width, y);
    grid.stroke({ color: 0x3a2a5a, width: 1, alpha: 0.15 });
    this.bg.addChild(grid);
  }

  _addBuildings() {
    const palette = [0x1f1538, 0x161126, 0x261a3a, 0x12102a, 0x1c1832];
    const place = (x, y, w, h) => {
      const col = palette[Math.floor(Math.random() * palette.length)];
      const g = new Graphics();
      g.rect(0, 0, w, h).fill(col);
      g.rect(0, 0, w, 5).fill(shade(col, 1.3));
      g.rect(0, h - 5, w, 5).fill(shade(col, 0.5));
      g.rect(0, 0, 3, h).fill(shade(col, 1.15));
      g.rect(w - 3, 0, 3, h).fill(shade(col, 0.5));
      // door
      g.rect(w / 2 - 5, h - 18, 10, 18).fill(0x222228);
      g.rect(w / 2 - 5, h - 18, 10, 1).fill(0x444450);
      // windows (denser)
      const cols = Math.max(2, Math.floor(w / 26));
      const rows = Math.max(2, Math.floor(h / 28));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.55) continue;
          const wc = Math.random() < 0.5 ? COLORS.neonYellow : COLORS.neonCyan;
          const wx = 10 + c * (w - 20) / Math.max(1, cols - 1) - 4;
          const wy = 16 + r * (h - 36) / Math.max(1, rows - 1) - 5;
          g.rect(wx, wy, 8, 10).fill({ color: wc, alpha: 0.85 });
          // pane cross
          g.rect(wx + 3, wy, 2, 10).fill({ color: 0x000000, alpha: 0.3 });
          g.rect(wx, wy + 4, 8, 2).fill({ color: 0x000000, alpha: 0.3 });
        }
      }
      // rooftop antenna
      if (Math.random() < 0.6) {
        g.rect(w * 0.3, -6, 1, 8).fill(0x666672);
        g.rect(w * 0.3 - 2, -8, 5, 1).fill(0xff3a3a);
      }
      g.x = x; g.y = y;
      this.decorLayer.addChild(g);
    };

    // top edge
    for (let x = -30; x < this.width; x += 110 + Math.random() * 110) {
      const w = 90 + Math.random() * 90;
      const h = 100 + Math.random() * 110;
      place(x, -h * 0.6, w, h);
    }
    // bottom edge
    for (let x = -30; x < this.width; x += 110 + Math.random() * 110) {
      const w = 90 + Math.random() * 90;
      const h = 100 + Math.random() * 110;
      place(x, this.height - h * 0.3, w, h);
    }
    // left edge
    for (let y = -30; y < this.height; y += 110 + Math.random() * 110) {
      const w = 90 + Math.random() * 90;
      const h = 100 + Math.random() * 110;
      place(-w * 0.6, y, w, h);
    }
    // right edge
    for (let y = -30; y < this.height; y += 110 + Math.random() * 110) {
      const w = 90 + Math.random() * 90;
      const h = 100 + Math.random() * 110;
      place(this.width - w * 0.3, y, w, h);
    }
  }

  _addLamps() {
    // Grid of streetlamps along the paths
    const xs = [400, 900, 1400, 1900, 2400, 2900, 3300];
    const yTop = this.height / 2 - 100;
    const yBot = this.height / 2 + 100;
    for (const x of xs) {
      this._addLamp(x, yTop);
      this._addLamp(x, yBot);
    }
    const ys = [400, 900, 1400, 1900, 2400];
    const xLeft = this.width / 2 - 100;
    const xRight = this.width / 2 + 100;
    for (const y of ys) {
      this._addLamp(xLeft, y);
      this._addLamp(xRight, y);
    }
  }

  _addLamp(x, y) {
    const lamp = new Container();
    lamp.x = x; lamp.y = y;
    const shadow = new Graphics();
    shadow.ellipse(0, 6, 4, 2).fill({ color: 0x000000, alpha: 0.4 });
    lamp.addChild(shadow);
    const pole = new Graphics();
    pole.rect(-2, -22, 4, 26).fill(0x3a3a4a);
    pole.rect(-2, -22, 4, 2).fill(0x6a6a72);
    lamp.addChild(pole);
    const head = new Graphics();
    head.rect(-6, -28, 12, 6).fill(0x6a6a72);
    head.circle(0, -26, 3).fill(COLORS.lampGlow);
    lamp.addChild(head);
    const glow = new Graphics();
    glow.circle(0, 0, 100).fill({ color: COLORS.lampGlow, alpha: 0.10 });
    glow.circle(0, 0, 70).fill({ color: COLORS.lampGlow, alpha: 0.16 });
    glow.circle(0, 0, 40).fill({ color: COLORS.lampGlow, alpha: 0.22 });
    this.mapLayer.addChild(glow);
    glow.x = x; glow.y = y + 4;
    this.decorLayer.addChild(lamp);
    this.lamps.push({ container: lamp, head, glow, x, y, t: Math.random() * 10 });
  }

  _addForests() {
    // 10 forest clusters (was 6) with more trees each (was 5-8 → 10-14)
    const clusters = [
      [400, 400, 14], [3200, 400, 14], [400, 2300, 14], [3200, 2300, 14],
      [600, 1350, 9], [3000, 1350, 9], [1800, 280, 8], [1800, 2420, 8],
      [320, 1100, 7], [3280, 1600, 7],
    ];
    for (const [cx, cy, count] of clusters) {
      for (let i = 0; i < count; i++) {
        const dx = (Math.random() - 0.5) * 260;
        const dy = (Math.random() - 0.5) * 220;
        this._drawTree(cx + dx, cy + dy);
      }
    }
    // scatter standalone trees (was 30, now 70)
    for (let i = 0; i < 70; i++) {
      const x = 200 + Math.random() * (this.width - 400);
      const y = 200 + Math.random() * (this.height - 400);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 320) continue;
      this._drawTree(x, y);
    }
  }

  _drawTree(x, y) {
    const c = new Container();
    c.x = x; c.y = y;
    // ground shadow
    const sh = new Graphics();
    sh.ellipse(0, 8, 14, 4).fill({ color: 0x000000, alpha: 0.4 });
    c.addChild(sh);
    // trunk
    const trunk = new Graphics();
    trunk.rect(-3, -2, 6, 12).fill(0x4a2a14);
    trunk.rect(-3, -2, 6, 2).fill(0x6a3a1c);
    trunk.rect(-3, 8, 6, 2).fill(0x2a1a0c);
    // bark grain
    trunk.rect(-2, 0, 1, 8).fill(0x2a1a0c);
    trunk.rect(1, 2, 1, 6).fill(0x2a1a0c);
    c.addChild(trunk);
    // canopy (chunky pixel circles, layered)
    const baseGreen = [0x2a5a3a, 0x3a7a4a, 0x4a8a4a, 0x5aaa5a][Math.floor(Math.random() * 4)];
    const can = new Graphics();
    can.circle(0, -8, 14).fill(shade(baseGreen, 0.7));
    can.circle(-4, -10, 10).fill(baseGreen);
    can.circle(4, -10, 10).fill(baseGreen);
    can.circle(0, -14, 9).fill(shade(baseGreen, 1.25));
    can.circle(-3, -12, 4).fill(shade(baseGreen, 1.4));   // highlight
    can.circle(5, -8, 3).fill(shade(baseGreen, 1.35));
    c.addChild(can);
    this.decorLayer.addChild(c);
  }

  _addRocks() {
    // 55 rocks scattered (was 22) for much denser feel
    for (let i = 0; i < 55; i++) {
      const x = 150 + Math.random() * (this.width - 300);
      const y = 150 + Math.random() * (this.height - 300);
      // avoid center generator zone
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 280) continue;
      this._drawRock(x, y);
    }
  }

  _drawRock(x, y) {
    const c = new Container();
    c.x = x; c.y = y;
    const sh = new Graphics();
    sh.ellipse(0, 6, 14, 4).fill({ color: 0x000000, alpha: 0.4 });
    c.addChild(sh);
    const baseGray = [0x5a5a62, 0x6a6a72, 0x7a7a82, 0x4a4a52][Math.floor(Math.random() * 4)];
    const g = new Graphics();
    // big rock body
    g.circle(0, 0, 10 + Math.random() * 4).fill(baseGray);
    g.circle(-3, -3, 8).fill(shade(baseGray, 1.15));
    g.circle(2, -1, 5).fill(shade(baseGray, 1.25));
    // crack
    g.rect(-2, 0, 1, 6).fill(shade(baseGray, 0.6));
    g.rect(-3, 3, 2, 1).fill(shade(baseGray, 0.55));
    // moss
    if (Math.random() < 0.5) {
      g.circle(-5, 3, 2).fill({ color: 0x3a7a4a, alpha: 0.7 });
      g.circle(4, 4, 1.5).fill({ color: 0x3a7a4a, alpha: 0.7 });
    }
    c.addChild(g);
    this.decorLayer.addChild(c);
  }

  _addPuddlesAndStains() {
    // Wet neon puddles + oil stains + cracked-asphalt patches scattered everywhere
    const layer = new Graphics();
    // ~80 neon-tinted puddles (reflective wet asphalt feel)
    for (let i = 0; i < 80; i++) {
      const x = 60 + Math.random() * (this.width - 120);
      const y = 60 + Math.random() * (this.height - 120);
      const c = [COLORS.neonCyan, COLORS.neonPink, COLORS.neonYellow, 0xb055ff][Math.floor(Math.random() * 4)];
      const r = 5 + Math.random() * 7;
      layer.ellipse(x, y, r, r * 0.5).fill({ color: c, alpha: 0.14 });
      layer.ellipse(x - r * 0.3, y - 1, r * 0.5, r * 0.25).fill({ color: 0xffffff, alpha: 0.18 });
    }
    // ~50 oil stains
    for (let i = 0; i < 50; i++) {
      const x = 60 + Math.random() * (this.width - 120);
      const y = 60 + Math.random() * (this.height - 120);
      const r = 6 + Math.random() * 10;
      layer.ellipse(x, y, r, r * 0.65).fill({ color: 0x000000, alpha: 0.45 });
      layer.ellipse(x + 1, y + 1, r * 0.6, r * 0.35).fill({ color: 0x1a1a2a, alpha: 0.6 });
      // rainbow oil sheen
      layer.rect(x - 2, y - 1, 4, 1).fill({ color: 0xb055ff, alpha: 0.3 });
    }
    // ~120 cracked-asphalt patches
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      layer.rect(x, y, 6, 1).fill({ color: 0x000000, alpha: 0.4 });
      layer.rect(x + 1, y + 1, 3, 1).fill({ color: 0x000000, alpha: 0.4 });
    }
    this.bg.addChild(layer);
  }

  _addMicroDetail() {
    // Cans, bottles, footprints, sewer covers — tiny props that add density
    const layer = new Graphics();
    // ~70 cans + bottles
    for (let i = 0; i < 70; i++) {
      const x = 60 + Math.random() * (this.width - 120);
      const y = 60 + Math.random() * (this.height - 120);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 220) { i--; continue; }
      const kind = Math.random();
      if (kind < 0.5) {
        // can (silver + colored label)
        layer.rect(x, y, 3, 5).fill(0xc8c8c8);
        layer.rect(x, y, 3, 1).fill(0xffffff);
        layer.rect(x, y + 4, 3, 1).fill(0x666666);
        const labelC = [0xc8281f, 0x4a8a4a, 0x4a4aaa, 0xffd23f][Math.floor(Math.random() * 4)];
        layer.rect(x, y + 1, 3, 2).fill(labelC);
      } else {
        // bottle (green or brown)
        const c = Math.random() < 0.5 ? 0x4a8a4a : 0x6a3a1c;
        layer.rect(x + 1, y, 1, 1).fill(0x6a6a72); // neck
        layer.rect(x, y + 1, 3, 5).fill(c);
        layer.rect(x, y + 1, 3, 1).fill(shade(c, 1.3));
      }
    }
    // ~30 footprints (paired)
    for (let i = 0; i < 30; i++) {
      const x = 80 + Math.random() * (this.width - 160);
      const y = 80 + Math.random() * (this.height - 160);
      const a = Math.random() * Math.PI * 2;
      for (let j = 0; j < 4; j++) {
        const fx = x + Math.cos(a) * j * 12 + (j % 2 === 0 ? -3 : 3);
        const fy = y + Math.sin(a) * j * 12 + (j % 2 === 0 ? -3 : 3);
        layer.ellipse(fx, fy, 2, 3).fill({ color: 0x000000, alpha: 0.35 });
        layer.rect(fx - 1, fy - 3, 1, 1).fill({ color: 0x000000, alpha: 0.35 });
      }
    }
    // ~14 sewer covers
    for (let i = 0; i < 14; i++) {
      const x = 100 + Math.random() * (this.width - 200);
      const y = 100 + Math.random() * (this.height - 200);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 200) continue;
      layer.circle(x, y, 9).fill(0x2a2a32);
      layer.circle(x, y, 9).stroke({ color: 0x4a4a52, width: 1 });
      // grate lines
      layer.rect(x - 7, y - 1, 14, 1).fill(0x1a1a22);
      layer.rect(x - 7, y - 3, 14, 1).fill(0x1a1a22);
      layer.rect(x - 7, y + 1, 14, 1).fill(0x1a1a22);
      layer.rect(x - 7, y + 3, 14, 1).fill(0x1a1a22);
      // hi-light
      layer.circle(x - 3, y - 3, 1).fill({ color: 0x666672, alpha: 0.7 });
    }
    // ~20 trash bags
    for (let i = 0; i < 20; i++) {
      const x = 80 + Math.random() * (this.width - 160);
      const y = 80 + Math.random() * (this.height - 160);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 220) continue;
      layer.ellipse(x, y, 7, 5).fill(0x222228);
      layer.ellipse(x - 2, y - 1, 4, 2).fill({ color: 0x444450, alpha: 0.8 });
      // knot at top
      layer.rect(x - 1, y - 5, 2, 2).fill(0x222228);
    }
    this.decorLayer.addChild(layer);
  }

  _addSignsAndFences() {
    // Broken neon signs + chain-link fence segments (decorative, non-blocking)
    for (let i = 0; i < 14; i++) {
      const x = 200 + Math.random() * (this.width - 400);
      const y = 200 + Math.random() * (this.height - 400);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 280) continue;
      // pole
      const g = new Graphics();
      g.x = x; g.y = y;
      g.rect(-1, -22, 2, 22).fill(0x3a3a4a);
      // sign panel
      const w = 24, h = 14;
      const sc = [0xc8281f, 0x4a4aaa, 0xff3aa1, COLORS.neonYellow, COLORS.neonCyan][Math.floor(Math.random() * 5)];
      g.rect(-w / 2, -36, w, h).fill(0x18181c);
      g.rect(-w / 2, -36, w, 2).fill(0x3a3a42);
      // neon glow text-line
      g.rect(-w / 2 + 3, -32, w - 6, 2).fill({ color: sc, alpha: 0.9 });
      g.rect(-w / 2 + 3, -28, w - 6, 2).fill({ color: sc, alpha: 0.7 });
      // glow halo
      g.rect(-w / 2 - 1, -32, w + 2, 6).fill({ color: sc, alpha: 0.15 });
      // damage / dead-pixels
      if (Math.random() < 0.6) {
        g.rect(-w / 2 + 5, -32, 2, 2).fill(0x000000);
        g.rect(w / 2 - 5, -28, 2, 2).fill(0x000000);
      }
      this.decorLayer.addChild(g);
    }
    // chain-link fence segments around the outer ring (decorative)
    for (let i = 0; i < 18; i++) {
      const x = 50 + Math.random() * (this.width - 100);
      const y = 50 + Math.random() * (this.height - 100);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 480) { i--; continue; }
      const vertical = Math.random() < 0.5;
      const len = 40 + Math.random() * 30;
      const w = vertical ? 8 : len;
      const h = vertical ? len : 8;
      const fg = new Graphics();
      fg.rect(0, 0, w, h).fill({ color: COLORS.fenceDim || 0x1d4a5a, alpha: 0.5 });
      // diagonals
      if (vertical) {
        for (let yy = 0; yy < h; yy += 3) {
          fg.moveTo(2, yy).lineTo(w - 2, yy + 3).stroke({ color: COLORS.neonCyan, width: 1, alpha: 0.4 });
          fg.moveTo(w - 2, yy).lineTo(2, yy + 3).stroke({ color: COLORS.neonCyan, width: 1, alpha: 0.4 });
        }
        fg.rect(0, 0, 2, h).fill(0x4a4a52);
        fg.rect(w - 2, 0, 2, h).fill(0x4a4a52);
      } else {
        for (let xx = 0; xx < w; xx += 3) {
          fg.moveTo(xx, 2).lineTo(xx + 3, h - 2).stroke({ color: COLORS.neonCyan, width: 1, alpha: 0.4 });
          fg.moveTo(xx + 3, 2).lineTo(xx, h - 2).stroke({ color: COLORS.neonCyan, width: 1, alpha: 0.4 });
        }
        fg.rect(0, 0, w, 2).fill(0x4a4a52);
        fg.rect(0, h - 2, w, 2).fill(0x4a4a52);
      }
      fg.x = x; fg.y = y;
      this.decorLayer.addChild(fg);
    }
  }

  _addDecor() {
    // bumped to 80 from 38 — denser props
    for (let i = 0; i < 80; i++) {
      const x = 200 + Math.random() * (this.width - 400);
      const y = 200 + Math.random() * (this.height - 400);
      if (Math.hypot(x - this.width / 2, y - this.height / 2) < 240) { i--; continue; }
      const kind = Math.random();
      const g = new Graphics();
      if (kind < 0.30) {
        // dumpster
        g.rect(-14, -10, 28, 16).fill(0x4a4a52);
        g.rect(-14, -10, 28, 3).fill(0x6a6a72);
        g.rect(-14, 4, 28, 2).fill(0x2a2a32);
        g.rect(-14, -2, 28, 1).fill(0x3a3a42);
        const tag = Math.random() < 0.5 ? COLORS.neonPink : COLORS.neonCyan;
        g.rect(-10, -6, 6, 3).fill({ color: tag, alpha: 0.7 });
      } else if (kind < 0.55) {
        // crashed car
        const c = [0xc8281f, 0x4a4aaa, 0x4aaa4a, 0xaaaa4a, 0xaa4aaa][Math.floor(Math.random() * 5)];
        g.rect(-18, -10, 36, 18).fill(c);
        g.rect(-18, -10, 36, 3).fill(shade(c, 1.3));
        g.rect(-18, 6, 36, 2).fill(shade(c, 0.5));
        g.rect(-14, -7, 8, 5).fill({ color: COLORS.neonCyan, alpha: 0.5 });
        g.rect(6, -7, 8, 5).fill({ color: COLORS.neonCyan, alpha: 0.5 });
        g.circle(-12, 9, 3).fill(0x101018);
        g.circle(12, 9, 3).fill(0x101018);
        // damage marks
        if (Math.random() < 0.4) g.rect(0, -10, 6, 3).fill(0x222228);
      } else if (kind < 0.80) {
        // debris pile
        g.rect(-9, -2, 18, 6).fill(0x4a3a2a);
        g.rect(-7, -5, 8, 3).fill(0x6a5a4a);
        g.rect(3, -4, 4, 2).fill(0x6a5a4a);
        g.rect(-4, -1, 2, 1).fill(0x3a2a1a);
        g.rect(5, 1, 3, 2).fill(0x3a2a1a);
      } else {
        // newspaper / box pile
        g.rect(-6, -2, 12, 6).fill(0xc8b888);
        g.rect(-6, -2, 12, 1).fill(0xeae0c0);
        g.rect(-5, 0, 10, 1).fill({ color: 0x000000, alpha: 0.4 });
        g.rect(-5, 2, 10, 1).fill({ color: 0x000000, alpha: 0.4 });
      }
      g.x = x; g.y = y;
      this.decorLayer.addChild(g);
    }
  }

  setPhaseTint(phase, k = 0) {
    let color = 0x0a0716;
    let alpha = 0;
    if (phase === 'day') { alpha = 0; }
    else if (phase === 'sunset') { color = COLORS.duskTint; alpha = 0.25 + k * 0.18; }
    else if (phase === 'night') { color = COLORS.nightTint; alpha = 0.6; }
    else if (phase === 'dawn') { color = COLORS.dawnTint; alpha = 0.28 - k * 0.18; }
    this.tintRect.clear();
    this.tintRect.rect(0, 0, this.width, this.height).fill({ color, alpha });
  }

  updateLamps(dt) {
    for (const l of this.lamps) {
      l.t += dt;
      const f = 0.85 + 0.25 * Math.sin(l.t * 12) + 0.1 * Math.sin(l.t * 37);
      l.glow.alpha = 0.6 * f;
      if (Math.random() < 0.002) l.glow.alpha *= 0.2;
    }
  }
}
