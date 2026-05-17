import { Container, Graphics } from 'pixi.js';
import { COLORS } from './colors.js';

export class ProjectileManager {
  constructor(world) {
    this.trailLayer = new Container();
    this.trailLayer.label = 'projectile-trails';
    world.container.addChild(this.trailLayer);
    this.layer = new Container();
    this.layer.label = 'projectiles';
    world.container.addChild(this.layer);
    this.world = world;
    this.list = [];
    this.trails = [];
  }

  spawn({ x, y, vx, vy, damage, color, lifetime = 1.6, ownerId, radius = 6, shape = 'ball', angle = 0 }) {
    const c = new Container();
    c.x = x; c.y = y;
    c.rotation = angle;
    const g = new Graphics();
    this._drawShape(g, shape, color, radius);
    c.addChild(g);
    this.layer.addChild(c);
    this.list.push({ c, x, y, vx, vy, damage, color, lifetime, lifeMax: lifetime, ownerId, radius, shape, trailT: 0 });
  }

  _spawnTrail(p) {
    const g = new Graphics();
    g.circle(0, 0, Math.max(2, p.radius - 1)).fill({ color: p.color, alpha: 0.55 });
    g.circle(0, 0, Math.max(1, p.radius - 3)).fill({ color: 0xffffff, alpha: 0.4 });
    g.x = p.x; g.y = p.y;
    this.trailLayer.addChild(g);
    this.trails.push({ g, life: 0.22, maxLife: 0.22 });
  }

  _drawShape(g, shape, color, r) {
    switch (shape) {
      case 'donut': {
        g.circle(0, 0, r + 1).fill(color);
        g.circle(0, 0, r - 2).fill(0x110a26);
        g.circle(0, 0, r + 1).stroke({ color: 0xffffff, width: 1, alpha: 0.7 });
        break;
      }
      case 'lance': {
        // long thin spear
        g.rect(-r * 2, -1, r * 4, 2).fill(color);
        g.rect(-r * 2, -1, r * 4, 1).fill(0xffffff);
        // tip
        g.rect(r * 2, -2, 2, 4).fill(color);
        g.rect(r * 2, -2, 2, 1).fill(0xffffff);
        break;
      }
      case 'beam': {
        // long bright beam
        g.rect(-r, -2, r * 3, 4).fill(color);
        g.rect(-r, -1, r * 3, 2).fill(0xffffff);
        break;
      }
      case 'crumb': {
        // irregular bread crumb cluster
        g.rect(-r, -r, r, r).fill(color);
        g.rect(0, 0, r, r).fill(color);
        g.rect(-r + 1, -r + 1, 1, 1).fill(0xffffff);
        break;
      }
      case 'star': {
        // 5-point star (pixel approximation)
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const px = Math.cos(a) * r, py = Math.sin(a) * r;
          g.rect(px - 1, py - 1, 2, 2).fill(color);
        }
        g.rect(-r / 2, -r / 2, r, r).fill(color);
        g.rect(-1, -1, 2, 2).fill(0xffffff);
        break;
      }
      case 'fireball': {
        g.circle(0, 0, r).fill(color);
        g.circle(0, 0, r - 2).fill(COLORS.yellow);
        g.circle(0, 0, r - 4).fill(0xffffff);
        // flame trail
        g.rect(-r - 4, -2, 4, 4).fill({ color, alpha: 0.6 });
        g.rect(-r - 7, -1, 3, 2).fill({ color: COLORS.yellow, alpha: 0.5 });
        break;
      }
      case 'pan': {
        // round pan with handle
        g.circle(0, 0, r).fill(0x222228);
        g.circle(0, 0, r - 1).fill(color);
        g.rect(-r * 2, -1, r, 2).fill(0x6a3a1c); // handle
        break;
      }
      case 'bat': {
        // bat-shape: small body + 2 wings
        g.rect(-1, -2, 2, 4).fill(color);
        g.rect(-r, -1, r - 1, 3).fill(color);
        g.rect(1, -1, r - 1, 3).fill(color);
        g.rect(-r, -2, 2, 2).fill(color);
        g.rect(r - 2, -2, 2, 2).fill(color);
        break;
      }
      case 'ball':
      default: {
        g.circle(0, 0, r).fill(color);
        g.circle(0, 0, r - 2).fill(0xffffff);
        g.circle(0, 0, r - 1).stroke({ color: 0xffffff, width: 1, alpha: 0.4 });
        break;
      }
    }
  }

  update(dt, pugs, onHit, onWallHit) {
    // Animate trail afterimages
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.g.destroy();
        this.trails.splice(i, 1);
      } else {
        const k = t.life / t.maxLife;
        t.g.alpha = k * 0.6;
        t.g.scale.set(Math.max(0.15, k));
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt;
      p.c.x = p.x; p.c.y = p.y;
      // Spinning visual for some shapes
      if (p.shape === 'donut' || p.shape === 'star') p.c.rotation += dt * 8;
      // fade out near end of life
      if (p.lifetime < 0.4) p.c.alpha = Math.max(0, p.lifetime / 0.4);

      // Spawn trail afterimage every ~30ms
      p.trailT += dt;
      if (p.trailT > 0.03) {
        p.trailT = 0;
        this._spawnTrail(p);
      }

      let removed = false;
      if (p.x < 0 || p.x > this.world.width || p.y < 0 || p.y > this.world.height) removed = true;
      if (!removed && this.world.projectileHitsFence(p.x, p.y)) {
        if (onWallHit) onWallHit(p);
        removed = true;
      }
      if (!removed) {
        for (const pug of pugs) {
          if (!pug.alive) continue;
          if (pug.id === p.ownerId) continue;
          const dx = pug.x - p.x, dy = pug.y - p.y;
          const r = pug.form.radius + p.radius;
          if (dx * dx + dy * dy < r * r) {
            onHit(p, pug);
            removed = true;
            break;
          }
        }
      }
      if (!removed && p.lifetime <= 0) removed = true;
      if (removed) {
        p.c.destroy();
        this.list.splice(i, 1);
      }
    }
  }
}
