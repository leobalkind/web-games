import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

// =============================================================================
// Generator — central fortified power core. Zombies target it.
// HP-bar visible. Sparks + flickering when damaged. Destroyed = game over.
// =============================================================================
export class Generator {
  constructor(x, y, hp = 800) {
    this.x = x; this.y = y;
    this.radius = 42;             // collision/targeting radius
    this.maxHp = hp;
    this.hp = hp;
    this.alive = true;
    this.flashT = 0;
    this.sparkT = 0;
    this.fanRot = 0;
    this.coreT = 0;

    this.container = new Container();
    this.container.label = 'generator';
    this.container.x = x;
    this.container.y = y;
    this._draw();

    this.hpBar = new Graphics();
    this.container.addChild(this.hpBar);
    this._renderHpBar();
  }

  _draw() {
    // Ground glow pad
    const padGlow = new Graphics();
    padGlow.circle(0, 0, 80).fill({ color: 0x4cc9f0, alpha: 0.12 });
    padGlow.circle(0, 0, 60).fill({ color: 0x4cc9f0, alpha: 0.18 });
    padGlow.circle(0, 0, 40).fill({ color: COLORS.neonYellow, alpha: 0.10 });
    this.container.addChild(padGlow);
    this.padGlow = padGlow;

    // shadow
    const sh = new Graphics();
    sh.ellipse(0, 30, 44, 10).fill({ color: 0x000000, alpha: 0.45 });
    this.container.addChild(sh);

    // sandbag perimeter
    const bags = new Graphics();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bx = Math.cos(a) * 40, by = Math.sin(a) * 18 + 24;
      bags.rect(bx - 5, by - 3, 10, 6).fill(0x8a7a4a);
      bags.rect(bx - 5, by - 3, 10, 1.5).fill(0xb0a070);
    }
    this.container.addChild(bags);

    // Base concrete plinth
    const base = new Graphics();
    base.rect(-32, 6, 64, 22).fill(0x4a4a52);
    base.rect(-32, 6, 64, 4).fill(0x6a6a72);
    base.rect(-32, 24, 64, 4).fill(0x2a2a32);
    // rivets row
    for (let x = -28; x <= 28; x += 7) base.circle(x, 12, 1).fill(0x222228);
    for (let x = -28; x <= 28; x += 7) base.circle(x, 23, 1).fill(0x222228);
    this.container.addChild(base);

    // Main body — boxy reactor housing
    const body = new Graphics();
    body.rect(-26, -22, 52, 30).fill(0x5a5a64);
    body.rect(-26, -22, 52, 5).fill(0x7a7a84);
    body.rect(-26, 4, 52, 4).fill(0x2a2a32);
    body.rect(-26, -22, 4, 30).fill(0x444450);
    body.rect(22, -22, 4, 30).fill(0x444450);
    // hazard stripes top
    for (let x = -20; x < 20; x += 8) {
      body.rect(x, -22, 4, 4).fill(COLORS.neonYellow);
      body.rect(x + 4, -22, 4, 4).fill(0x222228);
    }
    // panel seams
    body.rect(-26, -10, 52, 1).fill(0x222228);
    body.rect(0, -22, 1, 30).fill(0x222228);
    // bolts at corners
    body.circle(-22, -18, 1.5).fill(0x222228);
    body.circle(22, -18, 1.5).fill(0x222228);
    body.circle(-22, 4, 1.5).fill(0x222228);
    body.circle(22, 4, 1.5).fill(0x222228);
    this.container.addChild(body);

    // GLOWING CORE in the middle (animated)
    this.core = new Graphics();
    this.container.addChild(this.core);
    // Electric-arc layer (round-2 polish): random jagged Tesla-coil bolts
    // that flicker around the core. Density + speed scale inversely with HP
    // (more chaos when generator is dying).
    this.arcs = new Graphics();
    this.container.addChild(this.arcs);
    this._arcT = 0;

    // exhaust vents on sides
    const vents = new Graphics();
    vents.rect(-30, -16, 4, 6).fill(0x222228);
    vents.rect(26, -16, 4, 6).fill(0x222228);
    vents.rect(-30, -16, 4, 1).fill(COLORS.neonOrange);
    vents.rect(26, -16, 4, 1).fill(COLORS.neonOrange);
    this.container.addChild(vents);

    // Top FAN (rotates)
    this.fan = new Graphics();
    this.fan.rect(-3, -36, 6, 14).fill(0x3a3a42);
    this.fan.circle(0, -28, 6).fill(0x4a4a52);
    // blades (initially)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bx = Math.cos(a) * 5, by = -28 + Math.sin(a) * 5;
      this.fan.rect(bx - 1, by - 3, 2, 6).fill(0x9a9aa8);
    }
    this.container.addChild(this.fan);
    this.fanY = -28;
  }

  _drawCore(t) {
    this.core.clear();
    // Pulse rate now correlates with HP — low HP = faster, more frantic pulse
    const ratio = Math.max(0.1, this.hp / this.maxHp);
    const pulseRate = 4 + (1 - ratio) * 6;          // 4..10 Hz
    const pulseAmp = 0.15 + (1 - ratio) * 0.25;     // 0.15..0.4
    const pulse = (1 - pulseAmp * 0.5) + pulseAmp * Math.sin(t * pulseRate);
    const c = ratio > 0.5 ? COLORS.neonCyan : ratio > 0.25 ? COLORS.neonYellow : COLORS.zombieEye;
    // Outer halo + 3 layered glow rings — radius scales with pulse
    this.core.circle(0, -7, 18 * pulse).fill({ color: c, alpha: 0.18 });
    this.core.circle(0, -7, 14 * pulse).fill({ color: c, alpha: 0.32 });
    this.core.circle(0, -7, 11 * pulse).fill({ color: c, alpha: 0.55 });
    this.core.circle(0, -7, 8 * pulse).fill(c);
    this.core.circle(0, -7, 5 * pulse).fill(0xffffff);
    // glow ring — 2 strokes for layered depth
    this.core.circle(0, -7, 16).stroke({ color: c, width: 2, alpha: 0.45 });
    this.core.circle(0, -7, 22).stroke({ color: c, width: 1, alpha: 0.25 });
  }
  // Re-render the Tesla-coil arc layer. Each frame we pick N random jagged
  // bolts radiating from the core. Density + brightness ramp as HP falls.
  _drawArcs(t) {
    this.arcs.clear();
    const ratio = Math.max(0.05, this.hp / this.maxHp);
    // More arcs at low HP (1..5)
    const count = 1 + Math.floor((1 - ratio) * 5);
    const c = ratio > 0.5 ? COLORS.neonCyan : ratio > 0.25 ? COLORS.neonYellow : COLORS.zombieEye;
    // Use a quantized time so the arcs flicker (not smooth)
    const tick = Math.floor(t * 18);
    for (let i = 0; i < count; i++) {
      // Pseudorandom angle from id + tick (stable per ~55ms slice)
      const seed = (tick * 13 + i * 31) & 255;
      const ang = ((seed * 137.5) % 360) * Math.PI / 180;
      // Jagged polyline ~3 segments
      const segs = 3;
      const reach = 18 + (1 - ratio) * 14;
      let px = 0, py = -7;
      for (let s = 1; s <= segs; s++) {
        const k = s / segs;
        const baseX = Math.cos(ang) * reach * k;
        const baseY = -7 + Math.sin(ang) * reach * k;
        const jitter = ((seed + s * 17) & 7) - 3;
        const nx = baseX + jitter;
        const ny = baseY + jitter * 0.5;
        this.arcs.rect(Math.min(px, nx) - 0.5, Math.min(py, ny) - 0.5,
          Math.abs(nx - px) + 1, Math.abs(ny - py) + 1)
          .fill({ color: c, alpha: 0.8 });
        // hot-white core stripe
        this.arcs.rect(Math.min(px, nx), Math.min(py, ny),
          Math.max(1, Math.abs(nx - px)), Math.max(1, Math.abs(ny - py)))
          .fill({ color: 0xffffff, alpha: 0.6 });
        px = nx; py = ny;
      }
    }
  }

  _renderHpBar() {
    const w = 70, h = 6;
    this.hpBar.clear();
    this.hpBar.rect(-w / 2 - 1, -52, w + 2, h + 2).fill({ color: 0x000000, alpha: 0.7 });
    const ratio = Math.max(0, this.hp / this.maxHp);
    const c = ratio > 0.5 ? COLORS.neonGreen : ratio > 0.25 ? COLORS.neonYellow : COLORS.zombieEye;
    this.hpBar.rect(-w / 2, -51, w * ratio, h).fill(c);
    // tick marks
    for (let i = 1; i < 4; i++) {
      this.hpBar.rect(-w / 2 + (w / 4) * i, -51, 1, h).fill({ color: 0x000000, alpha: 0.6 });
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flashT = 0.18;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    this._renderHpBar();
  }

  // Returns true if pug/zombie position is inside the bounding box for collision blocking
  blocks(px, py) {
    return Math.abs(px - this.x) < 32 && Math.abs(py - (this.y + 6)) < 24;
  }

  update(dt) {
    this.coreT += dt;
    this.fanRot += dt * 6;
    this.fan.rotation = this.fanRot;
    this.fan.x = 0; this.fan.y = 0;
    // fan position via transform (already at top of body in local coords)
    this._drawCore(this.coreT);
    this._arcT += dt;
    if (this._arcT > 0.05) {
      this._arcT = 0;
      this._drawArcs(this.coreT);
    }

    // pulse ground glow
    const ratio = Math.max(0.2, this.hp / this.maxHp);
    this.padGlow.alpha = (0.6 + 0.4 * Math.sin(this.coreT * 2)) * ratio;

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.container.alpha = 0.6 + Math.random() * 0.4;
    } else {
      this.container.alpha = 1;
    }
  }

  destroy() { this.container.destroy({ children: true }); }
}
