import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

let _zid = 1;

// =============================================================================
// Zombie types — each is a stat profile + draw style + behavior flags.
// Used by the Zombie constructor: new Zombie({ x, y, type: 'runner', tier: 2 })
// "tier" scales HP/dmg/speed up per night (passed by Game).
// =============================================================================
export const ZOMBIE_TYPES = {
  walker: {
    name: 'Walker',
    hpBase: 40, dmgBase: 18, speedBase: 85,
    scale: 1.0,
    color: COLORS.zombieGreen,
    colorShade: COLORS.zombieGreenShade,
    radius: 16,
    isRanged: false,
    explodes: false,
    desc: 'Standard bork-pocalypse infectee.',
  },
  runner: {
    name: 'Runner',
    hpBase: 22, dmgBase: 14, speedBase: 165,
    scale: 0.82,
    color: 0x9ad08a,         // brighter, more agile
    colorShade: 0x4a7a3a,
    radius: 13,
    isRanged: false,
    explodes: false,
    desc: 'Fast. Squishy. Comes in packs.',
  },
  tank: {
    name: 'Tank',
    hpBase: 140, dmgBase: 32, speedBase: 50,
    scale: 1.55,
    color: 0x3a6a3a,         // darker armored green
    colorShade: 0x1a3a1a,
    radius: 26,
    armored: true,           // visual: shows plates
    isRanged: false,
    explodes: false,
    desc: 'Massive. Slow. Brutal.',
  },
  spitter: {
    name: 'Spitter',
    hpBase: 35, dmgBase: 22, speedBase: 70,
    scale: 1.05,
    color: 0xa8b05a,         // yellow-green sickly
    colorShade: 0x5a6a2a,
    radius: 16,
    isRanged: true,
    attackRange: 280,
    attackCooldown: 1.6,
    projectileSpeed: 280,
    projectileDamage: 18,
    explodes: false,
    desc: 'Stops at range. Spits acid balls.',
  },
  exploder: {
    name: 'Exploder',
    hpBase: 28, dmgBase: 8, speedBase: 130,
    scale: 0.95,
    color: 0xc8a050,
    colorShade: 0x6a4a20,
    radius: 14,
    isRanged: false,
    explodes: true,
    explodeRadius: 90,
    explodeDamage: 45,
    desc: 'Rushes. Detonates on death.',
  },
  screamer: {
    name: 'Screamer',
    hpBase: 55, dmgBase: 16, speedBase: 70,
    scale: 1.1,
    color: 0xb05a8a,         // pink-purple infection
    colorShade: 0x5a2a4a,
    radius: 16,
    isRanged: false,
    explodes: false,
    summons: true,           // marker: spawns walkers when hurt
    summonInterval: 4,
    summonsPerScream: 2,
    desc: 'Screams to summon more walkers nearby.',
  },
  digger: {
    name: 'Digger',
    hpBase: 48, dmgBase: 22, speedBase: 110,
    scale: 0.95,
    color: 0x7a5a3a,         // dirt-brown
    colorShade: 0x3a2a1a,
    radius: 15,
    isRanged: false,
    explodes: false,
    ignoresWalls: true,      // marker: walks through walls
    desc: 'Burrows under walls. Walls do not block it.',
  },
  cloaker: {
    name: 'Cloaker',
    hpBase: 35, dmgBase: 28, speedBase: 135,
    scale: 0.9,
    color: 0x4a4a72,         // deep blue-purple
    colorShade: 0x222244,
    radius: 14,
    isRanged: false,
    explodes: false,
    cloaks: true,            // marker: invisible until close
    cloakRange: 110,
    desc: 'Invisible at range. Reveals when close. Hits hard.',
  },
};

const TYPE_IDS = Object.keys(ZOMBIE_TYPES);

// =============================================================================
// Zombie — single class handles all types via the ZOMBIE_TYPES profile.
// =============================================================================
export class Zombie {
  constructor({ x, y, type = 'walker', tier = 1 } = {}) {
    const def = ZOMBIE_TYPES[type] || ZOMBIE_TYPES.walker;
    this.id = _zid++;
    this.type = type;
    this.def = def;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.aim = 0;

    // tier scaling — each night escalates stats
    const tierMult = 1 + (tier - 1) * 0.32;
    this.maxHp = Math.round(def.hpBase * tierMult);
    this.hp = this.maxHp;
    this.damage = Math.round(def.dmgBase * (0.9 + (tier - 1) * 0.18));
    this.speed = Math.round(def.speedBase * (0.95 + (tier - 1) * 0.08));
    this.radius = def.radius;
    this.scale = def.scale;
    this.alive = true;
    this.flashT = 0;
    this.contactT = 0;
    this.attackT = 0;
    this.wantsToSpit = null; // {aim} when spitter is about to shoot
    this.wantsToScream = false; // screamer signals Game to summon
    this.summonsRemaining = 3; // total walkers a screamer can spawn
    this.summonT = 0;          // cooldown to next summon

    this.container = new Container();
    this.container.label = `zombie-${this.id}-${type}`;
    this.container.x = x;
    this.container.y = y;
    this.visual = new Container();
    this.container.addChild(this.visual);
    this._draw();
    this.visual.scale.set(def.scale);

    this.hpBar = new Graphics();
    this.container.addChild(this.hpBar);
    this._renderHpBar();
  }

  _draw() {
    const d = this.def;
    // ground shadow
    const sh = new Graphics();
    sh.ellipse(0, 12, 16, 4).fill({ color: 0x000000, alpha: 0.4 });
    this.visual.addChild(sh);

    // body
    const body = new Graphics();
    body.ellipse(0, 4, 12, 8).fill(d.color);
    body.ellipse(0, 4, 12, 8).stroke({ color: d.colorShade, width: 1 });
    body.ellipse(-2, 2, 8, 5).fill({ color: shade(d.color, 1.3), alpha: 0.45 });
    // infection patches
    body.circle(-4, 6, 2).fill({ color: d.colorShade, alpha: 0.7 });
    body.circle(5, 3, 1.5).fill({ color: COLORS.bloodRed, alpha: 0.6 });
    body.circle(2, 7, 1.5).fill({ color: COLORS.bloodRed, alpha: 0.6 });
    this.visual.addChild(body);

    // armored plates on Tank
    if (d.armored) {
      const plates = new Graphics();
      plates.rect(-9, -1, 4, 9).fill(0x222228);
      plates.rect(5, -1, 4, 9).fill(0x222228);
      plates.rect(-3, -1, 6, 4).fill(0x444450);
      plates.rect(-9, -1, 4, 1).fill(0x666672);
      plates.rect(5, -1, 4, 1).fill(0x666672);
      // bolt rivets
      plates.circle(-7, 1, 0.8).fill(0x999999);
      plates.circle(7, 1, 0.8).fill(0x999999);
      plates.circle(0, 1, 0.8).fill(0x999999);
      this.visual.addChild(plates);
    }

    // acid sac for Spitter (back hump bulging with green)
    if (d.isRanged) {
      const sac = new Graphics();
      sac.ellipse(0, 8, 8, 4).fill(0x9af09a);
      sac.ellipse(0, 8, 8, 4).stroke({ color: 0x4a8a4a, width: 1 });
      sac.circle(-2, 7, 1).fill({ color: 0xffffff, alpha: 0.6 });
      this.visual.addChild(sac);
    }

    // pulsing explosive core for Exploder
    if (d.explodes) {
      const core = new Graphics();
      core.circle(0, 4, 4).fill({ color: COLORS.bloodRed, alpha: 0.8 });
      core.circle(0, 4, 2.5).fill({ color: COLORS.neonYellow, alpha: 0.9 });
      core.circle(0, 4, 1).fill(0xffffff);
      this.visual.addChild(core);
      // sticks of dynamite-ish strapped on
      const strap = new Graphics();
      strap.rect(-7, -2, 2, 8).fill(0xc8281f);
      strap.rect(5, -2, 2, 8).fill(0xc8281f);
      this.visual.addChild(strap);
    }

    // legs (uneven — one limp)
    const legs = new Graphics();
    legs.rect(-9, -1, 4, 4).fill(d.colorShade);
    legs.rect(5, -1, 4, 4).fill(d.colorShade);
    legs.rect(-8, 6, 4, 4).fill(d.colorShade);
    legs.rect(4, 5, 3, 5).fill(d.colorShade);
    this.visual.addChild(legs);

    // exposed bone
    const bone = new Graphics();
    bone.rect(-3, 0, 6, 1).fill(COLORS.pugCream);
    this.visual.addChild(bone);

    // head
    const head = new Graphics();
    head.ellipse(0, -5, 8, 6).fill(d.color);
    head.ellipse(0, -5, 8, 6).stroke({ color: d.colorShade, width: 1 });
    head.ellipse(-2, -7, 5, 3).fill({ color: shade(d.color, 1.3), alpha: 0.5 });
    this.visual.addChild(head);

    // torn ears
    const ears = new Graphics();
    ears.rect(-9, -8, 3, 5).fill(d.colorShade);
    ears.rect(6, -7, 2, 4).fill(d.colorShade);
    this.visual.addChild(ears);

    // glowing red eyes (signature)
    const eyes = new Graphics();
    const eyeColor = d.explodes ? COLORS.neonYellow : COLORS.zombieEye;
    const eyeGlow = d.explodes ? 0xfff0a8 : COLORS.zombieEyeGlow;
    eyes.circle(-3, -6, 2).fill(eyeColor);
    eyes.circle(3, -6, 2).fill(eyeColor);
    eyes.circle(-3, -6, 1).fill(eyeGlow);
    eyes.circle(3, -6, 1).fill(eyeGlow);
    eyes.circle(-3, -6, 3.5).fill({ color: eyeColor, alpha: 0.3 });
    eyes.circle(3, -6, 3.5).fill({ color: eyeColor, alpha: 0.3 });
    this.visual.addChild(eyes);

    // drippy mouth
    const mouth = new Graphics();
    mouth.rect(-2, -3, 4, 2).fill(0x000000);
    mouth.circle(-1, -2, 0.8).fill(COLORS.bloodRed);
    mouth.circle(1, -1, 0.6).fill(COLORS.bloodRed);
    mouth.rect(-1, 0, 1, 2).fill(COLORS.bloodRed);
    this.visual.addChild(mouth);

    // Screamer — gaping pink throat
    if (d.summons) {
      const throat = new Graphics();
      throat.ellipse(0, -2, 4, 3).fill(0xff3aa1);
      throat.ellipse(0, -2, 4, 3).stroke({ color: 0x6a0a4a, width: 1 });
      throat.rect(-3, -3, 2, 1).fill(0xffffff); // teeth
      throat.rect(1, -3, 2, 1).fill(0xffffff);
      this.visual.addChild(throat);
    }

    // Digger — big bone claws on the front
    if (d.ignoresWalls) {
      const claws = new Graphics();
      claws.rect(-12, 1, 3, 4).fill(0xfde0b8);
      claws.rect(9, 1, 3, 4).fill(0xfde0b8);
      claws.rect(-12, 1, 1, 4).fill(0xffffff);
      claws.rect(9, 1, 1, 4).fill(0xffffff);
      // dirt trail
      claws.circle(0, 10, 3).fill({ color: 0x6a4a2a, alpha: 0.6 });
      claws.circle(-4, 11, 2).fill({ color: 0x6a4a2a, alpha: 0.4 });
      this.visual.addChild(claws);
    }

    // Cloaker — purple shimmer outline + glowing slit eyes
    if (d.cloaks) {
      const shimmer = new Graphics();
      shimmer.circle(0, -2, 12).stroke({ color: 0xb055ff, width: 1, alpha: 0.5 });
      this.visual.addChild(shimmer);
    }

    // Crown for Tank (looks dangerous)
    if (d.armored) {
      const crown = new Graphics();
      crown.rect(-4, -12, 8, 2).fill(0x666672);
      crown.rect(-4, -14, 1, 2).fill(0x666672);
      crown.rect(-1, -14, 1, 2).fill(0x666672);
      crown.rect(3, -14, 1, 2).fill(0x666672);
      this.visual.addChild(crown);
    }
  }

  _renderHpBar() {
    const w = 22 * this.scale, h = 3;
    this.hpBar.clear();
    this.hpBar.rect(-w / 2, -16 - this.scale * 4, w, h).fill({ color: 0x000000, alpha: 0.55 });
    const ratio = Math.max(0, this.hp / this.maxHp);
    const c = ratio > 0.5 ? COLORS.neonGreen : ratio > 0.25 ? COLORS.neonYellow : COLORS.zombieEye;
    this.hpBar.rect(-w / 2 + 0.5, -15.5 - this.scale * 4, (w - 1) * ratio, h - 1).fill(c);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flashT = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    this._renderHpBar();
  }

  update(dt, target, walls = []) {
    if (!this.alive) return;
    if (!target || !target.alive) return;

    const d = this.def;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Screamer summon cooldown ticks even when not moving
    if (d.summons) {
      this.summonT -= dt;
      if (this.summonT <= 0 && this.summonsRemaining > 0) {
        this.summonT = d.summonInterval;
        this.summonsRemaining -= 1;
        this.wantsToScream = true;
      }
    }

    if (dist > 0.1) {
      this.aim = Math.atan2(dy, dx);

      // Ranged (Spitter): stop at attackRange, fire instead of moving close
      const shouldStop = d.isRanged && dist < d.attackRange;
      if (!shouldStop) {
        const ux = dx / dist;
        const uy = dy / dist;
        const nextX = this.x + ux * this.speed * dt;
        const nextY = this.y + uy * this.speed * dt;
        // Digger ignores walls entirely
        if (d.ignoresWalls) {
          this.x = nextX; this.y = nextY;
        } else if (!this._wouldCollideWall(nextX, nextY, walls)) {
          this.x = nextX; this.y = nextY;
        } else if (!this._wouldCollideWall(nextX, this.y, walls)) {
          this.x = nextX;
        } else if (!this._wouldCollideWall(this.x, nextY, walls)) {
          this.y = nextY;
        }
      }

      // Spitter attack timer
      if (d.isRanged && dist < d.attackRange) {
        this.attackT += dt;
        if (this.attackT >= d.attackCooldown) {
          this.attackT = 0;
          // signal Game that it wants to spit
          this.wantsToSpit = { aim: this.aim };
        }
      }
    }

    // Contact damage if touching player (melee types)
    if (!d.isRanged && dist < this.radius + target.radius - 4) {
      this.contactT += dt;
      if (this.contactT > 0.5) {
        target.takeDamage(this.damage * 0.5);
        this.contactT = 0;
      }
    } else {
      this.contactT = 0;
    }
  }

  _wouldCollideWall(nx, ny, walls) {
    for (const w of walls) {
      if (nx >= w.x - 2 && nx <= w.x + w.width + 2 &&
          ny >= w.y - 2 && ny <= w.y + w.height + 2) return true;
    }
    return false;
  }

  syncVisual(dt, viewer) {
    // `viewer` = whose eyes we're rendering for (the player). Cloakers fade
    // based on PLAYER distance so they're scary specifically for the player,
    // regardless of who they're targeting.
    this.container.x = this.x;
    this.container.y = this.y;
    this.container.rotation = this.aim;
    let baseAlpha = 1;
    if (this.def.cloaks && viewer) {
      const dx = viewer.x - this.x, dy = viewer.y - this.y;
      const d = Math.hypot(dx, dy);
      const cr = this.def.cloakRange;
      if (d > cr) baseAlpha = 0.12;
      else if (d > cr * 0.6) baseAlpha = 0.12 + (1 - 0.12) * (1 - (d - cr * 0.6) / (cr * 0.4));
      else baseAlpha = 1;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.visual.alpha = baseAlpha * (0.5 + Math.random() * 0.5);
    } else {
      this.visual.alpha = baseAlpha;
    }
    if (this.def.explodes) {
      const pulse = 1 + Math.sin(performance.now() / 100) * 0.06;
      this.visual.scale.set(this.def.scale * pulse);
    }
    // Screamer mouth pulse when about to summon
    if (this.def.summons && this.summonT < 0.5 && this.summonsRemaining > 0) {
      this.visual.scale.set(this.def.scale * (1 + 0.04 * Math.sin(performance.now() / 60)));
    }
  }

  destroy() { this.container.destroy({ children: true }); }
}

// =============================================================================
// Wave composition — given a night number, returns array of weighted types
// for spawning. Earlier nights favor walkers; later nights bring tougher types.
// =============================================================================
export function pickZombieType(nightIdx) {
  const compositions = {
    1: [['walker', 0.60], ['runner', 0.25], ['cloaker', 0.10], ['digger', 0.05]],
    2: [['walker', 0.30], ['runner', 0.25], ['tank', 0.12], ['spitter', 0.10],
        ['cloaker', 0.10], ['digger', 0.08], ['screamer', 0.05]],
    3: [['walker', 0.20], ['runner', 0.18], ['tank', 0.14], ['spitter', 0.12],
        ['exploder', 0.10], ['cloaker', 0.10], ['digger', 0.08], ['screamer', 0.08]],
  };
  const comp = compositions[nightIdx] || compositions[3];
  const r = Math.random();
  let acc = 0;
  for (const [type, weight] of comp) {
    acc += weight;
    if (r < acc) return type;
  }
  return comp[comp.length - 1][0];
}

export function waveLineup(nightIdx) {
  // Total spawns per night. Night 3 has fewer because the boss adds pressure.
  const counts = { 1: 26, 2: 42, 3: 40 };
  return counts[nightIdx] || 50 + (nightIdx - 3) * 15;
}
