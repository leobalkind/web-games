import { Container, Graphics } from 'pixi.js';
import { COLORS } from './colors.js';

// Energy treat pickups. Spawn from fountain eruptions and from killed pugs.
export class EnergyManager {
  constructor(world) {
    this.layer = new Container();
    this.layer.label = 'energy';
    world.container.addChild(this.layer);
    this.world = world;
    this.treats = [];
  }

  spawnAt(x, y, value = 5) {
    const c = new Container();
    c.x = x; c.y = y;
    const g = new Graphics();
    g.rect(-3, -3, 6, 6).fill(COLORS.treat);
    g.rect(-2, -2, 4, 4).fill(COLORS.treatGlow);
    g.rect(-3, -3, 6, 1).fill(COLORS.white);
    c.addChild(g);
    this.layer.addChild(c);
    this.treats.push({ c, x, y, value, t: Math.random() * Math.PI * 2, vx: 0, vy: 0, life: 25 });
  }

  spawnBurst(x, y, count = 5, value = 5) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 60 + Math.random() * 80;
      const t = {
        c: null, x, y, value,
        t: Math.random() * Math.PI * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 25,
      };
      const c = new Container();
      c.x = x; c.y = y;
      const g = new Graphics();
      g.rect(-3, -3, 6, 6).fill(COLORS.treat);
      g.rect(-2, -2, 4, 4).fill(COLORS.treatGlow);
      c.addChild(g);
      t.c = c;
      this.layer.addChild(c);
      this.treats.push(t);
    }
  }

  update(dt) {
    // From fountain eruptions, occasionally drop treats
    for (const f of this.world.fountains) {
      if (this.world.fountainEruptingNow(f)) {
        if (Math.random() < dt * 6) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
          const speed = 120 + Math.random() * 80;
          this.spawnBurst(f.x, f.y - 20, 1, 5);
          const last = this.treats[this.treats.length - 1];
          last.vx = Math.cos(angle) * speed;
          last.vy = Math.sin(angle) * speed;
        }
      }
    }

    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      t.t += dt * 4;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      // gravity-ish friction so they settle
      t.vx *= 1 - dt * 1.6;
      t.vy *= 1 - dt * 1.6;
      t.c.x = t.x;
      t.c.y = t.y - Math.abs(Math.sin(t.t)) * 2;
      t.life -= dt;
      // fade near death
      t.c.alpha = t.life < 4 ? Math.max(0, t.life / 4) : 1;
      if (t.life <= 0) {
        t.c.destroy();
        this.treats.splice(i, 1);
      }
    }
  }

  // Try to consume treats overlapping with a pug. Returns total value gained.
  collectFor(pug) {
    let gained = 0;
    const r = pug.form.radius + 10;
    for (let i = this.treats.length - 1; i >= 0; i--) {
      const t = this.treats[i];
      const dx = t.x - pug.x, dy = t.y - pug.y;
      const dist = Math.hypot(dx, dy);
      if (dist < r) {
        // magnetism close-up
        if (dist < r - 4) {
          gained += t.value;
          t.c.destroy();
          this.treats.splice(i, 1);
        } else {
          // pull toward pug
          const k = 6;
          t.vx -= (dx / dist) * k;
          t.vy -= (dy / dist) * k;
        }
      }
    }
    return gained;
  }
}
