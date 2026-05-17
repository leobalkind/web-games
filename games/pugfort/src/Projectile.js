import { Container, Graphics } from 'pixi.js';
import { COLORS } from './Colors.js';

// =============================================================================
// Simple bullet manager. Bullets fly in a straight line, hit zombies, despawn.
// =============================================================================
export class ProjectileManager {
  constructor(parentLayer) {
    this.layer = new Container();
    this.layer.label = 'projectiles';
    parentLayer.addChild(this.layer);
    this.list = [];
  }

  spawn({ x, y, vx, vy, damage = 15, lifetime = 0.9, color = COLORS.neonYellow }) {
    const g = new Graphics();
    g.circle(0, 0, 4).fill(color);
    g.circle(0, 0, 2).fill(0xffffff);
    g.x = x; g.y = y;
    this.layer.addChild(g);
    this.list.push({ g, x, y, vx, vy, damage, lifetime, color, trail: 0 });
  }

  _spawnTrail(p) {
    const g = new Graphics();
    g.circle(0, 0, 3).fill({ color: p.color, alpha: 0.55 });
    g.x = p.x; g.y = p.y;
    this.layer.addChildAt(g, 0);
    // simple self-destroy after short time
    setTimeout(() => g.destroy(), 200);
  }

  update(dt, zombies, walls, onHit, onWallHit) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lifetime -= dt;
      p.g.x = p.x; p.g.y = p.y;
      p.trail += dt;
      if (p.trail > 0.025) {
        p.trail = 0;
        this._spawnTrail(p);
      }

      let removed = false;
      if (p.lifetime <= 0) removed = true;

      // Wall collision
      if (!removed) {
        for (const w of walls) {
          if (p.x >= w.x && p.x <= w.x + w.width &&
              p.y >= w.y && p.y <= w.y + w.height) {
            if (onWallHit) onWallHit(p, w);
            removed = true;
            break;
          }
        }
      }
      // Zombie hit
      if (!removed) {
        for (const z of zombies) {
          if (!z.alive) continue;
          const dx = z.x - p.x, dy = z.y - p.y;
          if (dx * dx + dy * dy < (z.radius + 5) * (z.radius + 5)) {
            onHit(p, z);
            removed = true;
            break;
          }
        }
      }
      if (removed) {
        p.g.destroy();
        this.list.splice(i, 1);
      }
    }
  }
}
