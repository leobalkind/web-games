import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, shade } from './colors.js';

// =============================================================================
// Power-ups: drop from kills, picked up by walking over, apply instant or
// timed effects. All effects are read by Game when computing stats so they
// stack naturally on top of level-up bonuses + weapon stats.
// =============================================================================

export const POWERUPS = {
  med: {
    id: 'med',  name: 'MED PACK',  icon: '💊', color: 0x5ef38c,
    desc: 'Heal 40% max HP',
    instant: true,
  },
  ammo: {
    id: 'ammo', name: 'AMMO',      icon: '📦', color: 0xc8d0d8,
    desc: 'Instant reload',
    instant: true,
  },
  dmg: {
    id: 'dmg',  name: 'DMG +',     icon: '💥', color: 0xff3a3a,
    desc: '2× damage for 8s', duration: 8, mult: { dmgMult: 2.0 },
  },
  spd: {
    id: 'spd',  name: 'SPD +',     icon: '⚡', color: 0xffd23f,
    desc: '1.5× speed for 8s', duration: 8, mult: { spdMult: 1.5 },
  },
  rapid: {
    id: 'rapid', name: 'FIRE +',   icon: '🔥', color: 0xff8e3c,
    desc: '2× fire rate for 6s', duration: 6, mult: { fireMult: 2.0 },
  },
  shield: {
    id: 'shield', name: 'SHIELD',  icon: '🛡️', color: 0x4cc9f0,
    desc: 'Invulnerable for 5s', duration: 5, shield: true,
  },
};

const POWERUP_IDS = Object.keys(POWERUPS);

// Drop chance per kill
export const DROP_CHANCE = 0.32;

export class PowerupManager {
  constructor(world) {
    this.layer = new Container();
    this.layer.label = 'powerups';
    world.container.addChild(this.layer);
    this.world = world;
    this.drops = [];
  }

  // Maybe spawn a power-up at this position (called on kill).
  maybeSpawnAt(x, y) {
    if (Math.random() > DROP_CHANCE) return;
    const id = POWERUP_IDS[Math.floor(Math.random() * POWERUP_IDS.length)];
    this._spawn(id, x, y);
  }

  _spawn(id, x, y) {
    const def = POWERUPS[id];
    const c = new Container();
    c.x = x; c.y = y;
    // glow + box backdrop
    const halo = new Graphics();
    halo.circle(0, 0, 14).fill({ color: def.color, alpha: 0.25 });
    halo.circle(0, 0, 10).fill({ color: def.color, alpha: 0.5 });
    c.addChild(halo);
    // crate body
    const box = new Graphics();
    box.rect(-9, -9, 18, 18).fill(shade(def.color, 0.4));
    box.rect(-9, -9, 18, 2).fill(shade(def.color, 1.4));
    box.rect(-9, 7, 18, 2).fill(shade(def.color, 0.2));
    box.rect(-9, -9, 2, 18).fill(shade(def.color, 1.1));
    box.rect(7, -9, 2, 18).fill(shade(def.color, 0.2));
    // X-strap pattern
    box.rect(-1, -9, 2, 18).fill(shade(def.color, 0.7));
    box.rect(-9, -1, 18, 2).fill(shade(def.color, 0.7));
    c.addChild(box);
    // icon emoji on top
    const iconText = new Text({
      text: def.icon,
      style: { fontFamily: 'sans-serif', fontSize: 16 },
    });
    iconText.anchor.set(0.5);
    c.addChild(iconText);
    this.layer.addChild(c);
    this.drops.push({
      c, halo, box, x, y,
      id, def,
      bobT: Math.random() * Math.PI * 2,
      life: 18,           // power-ups despawn after 18s if not collected
    });
  }

  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.bobT += dt * 3;
      // floating bob
      d.c.y = d.y + Math.sin(d.bobT) * 3;
      // pulsing halo
      const pulse = 0.6 + 0.4 * Math.sin(d.bobT * 2);
      d.halo.alpha = pulse;
      d.c.scale.set(1 + Math.sin(d.bobT * 1.5) * 0.05);
      // fade near despawn
      if (d.life < 3) {
        d.c.alpha = Math.max(0, d.life / 3);
      }
      if (d.life <= 0) {
        d.c.destroy({ children: true });
        this.drops.splice(i, 1);
      }
    }
  }

  // Try to collect for a pug; returns the powerup def if collected.
  tryCollect(pug) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dx = pug.x - d.x;
      const dy = pug.y - d.y;
      if (dx * dx + dy * dy < (pug.form.radius + 14) * (pug.form.radius + 14)) {
        d.c.destroy({ children: true });
        this.drops.splice(i, 1);
        return d.def;
      }
    }
    return null;
  }
}

// Helper: compute combined multiplier of all active buffs for one stat key
export function buffMult(buffs, key) {
  let m = 1;
  for (const b of buffs) {
    if (b.def.mult && b.def.mult[key] != null) m *= b.def.mult[key];
  }
  return m;
}

export function hasShield(buffs) {
  for (const b of buffs) {
    if (b.def.shield) return true;
  }
  return false;
}
