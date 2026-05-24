import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, shade } from './colors.js';

// =============================================================================
// Dropped weapons from killed bots — player walks over to swap to that weapon.
// Each drop is a Container with the weapon icon emoji + a colored glow box.
// =============================================================================
export class WeaponDrops {
  constructor(world) {
    this.layer = new Container();
    this.layer.label = 'weapon-drops';
    world.container.addChild(this.layer);
    this.drops = [];
  }

  spawn(x, y, weapon, skin) {
    const c = new Container();
    c.x = x; c.y = y;
    const tint = (skin && skin.tint) || 0xc8d0d8;
    // crate box
    const box = new Graphics();
    box.rect(-12, -12, 24, 24).fill(shade(tint, 0.5));
    box.rect(-12, -12, 24, 3).fill(shade(tint, 1.3));
    box.rect(-12, 9, 24, 3).fill(shade(tint, 0.3));
    box.rect(-12, -12, 3, 24).fill(shade(tint, 1.1));
    box.rect(9, -12, 3, 24).fill(shade(tint, 0.3));
    c.addChild(box);
    // halo
    const halo = new Graphics();
    halo.circle(0, 0, 18).fill({ color: tint, alpha: 0.35 });
    c.addChildAt(halo, 0);
    // icon
    const icon = new Text({
      text: weapon.icon || '🔫',
      style: { fontFamily: 'sans-serif', fontSize: 16 },
    });
    icon.anchor.set(0.5);
    c.addChild(icon);

    this.layer.addChild(c);
    this.drops.push({
      c, halo, x, y, weapon, skin,
      bobT: Math.random() * Math.PI * 2,
      life: 25, // despawn after 25s
    });
  }

  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.bobT += dt * 3;
      d.c.y = d.y + Math.sin(d.bobT) * 3;
      d.halo.alpha = 0.25 + 0.2 * Math.sin(d.bobT * 2);
      if (d.life < 3) d.c.alpha = Math.max(0, d.life / 3);
      if (d.life <= 0) {
        d.c.destroy({ children: true });
        this.drops.splice(i, 1);
      }
    }
  }

  // Returns { weapon, skin } if pug picked up a drop, else null.
  // Polish R2: when `wg:smart-pickup` is enabled (default), we prefer drops
  // whose weapon matches the pug's current weapon (so the player effectively
  // gets a "reload" by walking over their own weapon type). Falls back to
  // any in-range drop if no matching one is available.
  tryPickup(pug) {
    const smart = (typeof localStorage !== 'undefined')
      ? (localStorage.getItem('wg:smart-pickup') !== '0')
      : true;
    const currentId = pug.weapon && pug.weapon.id;
    // First pass: prefer matching weapon
    if (smart && currentId) {
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        if (!d.weapon || d.weapon.id !== currentId) continue;
        const dx = pug.x - d.x, dy = pug.y - d.y;
        if (dx * dx + dy * dy < (pug.form.radius + 18) * (pug.form.radius + 18)) {
          d.c.destroy({ children: true });
          this.drops.splice(i, 1);
          return { weapon: d.weapon, skin: d.skin };
        }
      }
    }
    // Second pass: any in-range drop
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dx = pug.x - d.x, dy = pug.y - d.y;
      if (dx * dx + dy * dy < (pug.form.radius + 18) * (pug.form.radius + 18)) {
        d.c.destroy({ children: true });
        this.drops.splice(i, 1);
        return { weapon: d.weapon, skin: d.skin };
      }
    }
    return null;
  }
}
