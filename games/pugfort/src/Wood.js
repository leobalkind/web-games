import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

// =============================================================================
// Wood log pickups scattered on the map. Walk over to collect.
// =============================================================================
export class WoodManager {
  constructor(parentLayer) {
    this.layer = new Container();
    this.layer.label = 'wood';
    parentLayer.addChild(this.layer);
    this.logs = [];
  }

  spawnAt(x, y, amount = 1) {
    const c = new Container();
    c.x = x; c.y = y;
    // shadow
    const sh = new Graphics();
    sh.ellipse(0, 4, 9, 3).fill({ color: 0x000000, alpha: 0.4 });
    c.addChild(sh);
    // log body
    const g = new Graphics();
    g.rect(-8, -3, 16, 6).fill(COLORS.woodLog);
    g.rect(-8, -3, 16, 2).fill(COLORS.woodHi);
    g.rect(-8, 1, 16, 2).fill(COLORS.woodDark);
    // rings on ends
    g.circle(-8, 0, 2.5).fill(COLORS.woodHi);
    g.circle(-8, 0, 1.5).fill(COLORS.woodDark);
    g.circle(8, 0, 2.5).fill(COLORS.woodHi);
    g.circle(8, 0, 1.5).fill(COLORS.woodDark);
    c.addChild(g);
    // bob
    this.layer.addChild(c);
    this.logs.push({ c, x, y, amount, bobT: Math.random() * Math.PI * 2 });
  }

  // Scatter N logs in the map (avoiding center)
  scatter(count, worldW, worldH) {
    for (let i = 0; i < count; i++) {
      let x, y;
      let tries = 0;
      do {
        x = 200 + Math.random() * (worldW - 400);
        y = 200 + Math.random() * (worldH - 400);
        tries++;
      } while (Math.hypot(x - worldW / 2, y - worldH / 2) < 180 && tries < 20);
      this.spawnAt(x, y, 1 + Math.floor(Math.random() * 2));
    }
  }

  update(dt) {
    for (const l of this.logs) {
      l.bobT += dt * 2;
      l.c.y = l.y + Math.sin(l.bobT) * 1.5;
    }
  }

  // Try collect for a player (px, py, pickupRadius). Returns total amount collected.
  tryCollect(px, py, pickupR = 28) {
    let total = 0;
    for (let i = this.logs.length - 1; i >= 0; i--) {
      const l = this.logs[i];
      if (Math.hypot(l.x - px, l.y - py) < pickupR) {
        total += l.amount;
        l.c.destroy({ children: true });
        this.logs.splice(i, 1);
      }
    }
    return total;
  }
}
