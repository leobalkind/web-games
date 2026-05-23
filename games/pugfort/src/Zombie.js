import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

let _zid = 1;

// =============================================================================
// Zombie types — each is a stat profile + draw style + behavior flags.
// Used by the Zombie constructor: new Zombie({ x, y, type: 'runner', tier: 2 })
// "tier" scales HP/dmg/speed up per night (passed by Game).
// =============================================================================
// EVIL PUG color palette — sickly grey-green skin, deep shade, per-variant tint.
export const ZOMBIE_TYPES = {
  walker: {
    name: 'Walker',
    hpBase: 40, dmgBase: 18, speedBase: 85,
    scale: 1.0,
    color: 0x7c8a5f,            // greyish-green corrupted pug
    colorShade: 0x3a4624,
    radius: 16,
    isRanged: false,
    explodes: false,
    desc: 'Slumped, snarling infected pug.',
  },
  runner: {
    name: 'Runner',
    hpBase: 22, dmgBase: 14, speedBase: 165,
    scale: 0.82,
    color: 0x9aa46e,            // brighter pale-green (younger pug)
    colorShade: 0x4a542e,
    radius: 13,
    isRanged: false,
    explodes: false,
    desc: 'Lean. Quick. Lunges in packs.',
  },
  tank: {
    name: 'Tank',
    hpBase: 140, dmgBase: 32, speedBase: 50,
    scale: 1.55,
    color: 0x5a6a3a,            // darker olive
    colorShade: 0x2a3a1a,
    radius: 26,
    armored: true,
    isRanged: false,
    explodes: false,
    desc: 'Massive armored alpha. Spike-plated.',
  },
  spitter: {
    name: 'Spitter',
    hpBase: 35, dmgBase: 22, speedBase: 70,
    scale: 1.05,
    color: 0x9aae54,            // yellow-green sickly
    colorShade: 0x4a6024,
    radius: 16,
    isRanged: true,
    attackRange: 280,
    attackCooldown: 1.6,
    projectileSpeed: 280,
    projectileDamage: 18,
    explodes: false,
    desc: 'Bile-sac on back. Spits acid balls.',
  },
  exploder: {
    name: 'Exploder',
    hpBase: 28, dmgBase: 8, speedBase: 130,
    scale: 0.95,
    color: 0xb88a4a,            // sickly tan-yellow
    colorShade: 0x5a3a1a,
    radius: 14,
    isRanged: false,
    explodes: true,
    explodeRadius: 90,
    explodeDamage: 45,
    desc: 'Bomb collar. Detonates on death.',
  },
  screamer: {
    name: 'Screamer',
    hpBase: 55, dmgBase: 16, speedBase: 70,
    scale: 1.1,
    color: 0xa46e8a,            // pink-purple infection
    colorShade: 0x4e2e4a,
    radius: 16,
    isRanged: false,
    explodes: false,
    summons: true,
    summonInterval: 4,
    summonsPerScream: 2,
    desc: 'Screams to summon more walkers nearby.',
  },
  digger: {
    name: 'Digger',
    hpBase: 48, dmgBase: 22, speedBase: 110,
    scale: 0.95,
    color: 0x8a6a4a,            // dirt-stained brown
    colorShade: 0x3a2a14,
    radius: 15,
    isRanged: false,
    explodes: false,
    ignoresWalls: true,
    desc: 'Burrows under walls. Bone claws.',
  },
  cloaker: {
    name: 'Cloaker',
    hpBase: 35, dmgBase: 28, speedBase: 135,
    scale: 0.9,
    color: 0x5a5a78,            // deep blue-purple
    colorShade: 0x222244,
    radius: 14,
    isRanged: false,
    explodes: false,
    cloaks: true,
    cloakRange: 110,
    desc: 'Invisible at range. Strikes from shadows.',
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
    // EVIL PUG palette — sickly grey-green body, deep desaturated shade,
    // glowing crimson eyes, drippy bile saliva. Same shapes as classic pug
    // (drop ears + pink inner, snout, wrinkles) but corrupted/undead.
    const skin = d.color;
    const skinDark = d.colorShade;
    const skinHi = shade(skin, 1.25);
    const skinDeep = shade(skinDark, 0.65);
    const earInner = 0xc46688;     // muted/desaturated pink (zombified)
    const earInnerShade = 0x6a2a44;
    const bile = 0xaaff66;
    const bileShade = 0x4a7a2a;
    const eyeColor = d.explodes ? COLORS.neonYellow : COLORS.zombieEye;
    const eyeGlow = d.explodes ? 0xfff0a8 : 0xffd0d0;

    // ground shadow
    const sh = new Graphics();
    sh.ellipse(0, 12, 16, 4).fill({ color: 0x000000, alpha: 0.45 });
    sh.ellipse(0, 12, 12, 3).fill({ color: 0x000000, alpha: 0.3 });
    this.visual.addChild(sh);

    // ===== TAIL (corkscrew, behind body — pug signature) =====
    const tail = new Graphics();
    tail.rect(-13, -1, 2, 2).fill(skin);
    tail.rect(-15, 0, 2, 2).fill(skin);
    tail.rect(-15, 2, 2, 2).fill(skinDark);
    tail.rect(-13, 3, 2, 2).fill(skinDark);
    tail.rect(-11, 2, 2, 2).fill(skinDark);
    this.visual.addChild(tail);

    // ===== BODY (rounded — slumped, hunched zombie posture) =====
    const body = new Graphics();
    body.ellipse(0, 4, 13, 8).fill(skin);
    body.ellipse(0, 4, 13, 8).stroke({ color: skinDeep, width: 1 });
    // body highlight (light from above)
    body.ellipse(-2, 1, 9, 4).fill({ color: skinHi, alpha: 0.55 });
    // necrotic infection patches
    body.circle(-5, 7, 2.5).fill({ color: skinDeep, alpha: 0.7 });
    body.circle(5, 3, 1.8).fill({ color: COLORS.bloodRed, alpha: 0.6 });
    body.circle(2, 8, 1.5).fill({ color: COLORS.bloodRed, alpha: 0.5 });
    // X-stitched scars (signature evil-pug touch)
    body.rect(-3, 4, 5, 1).fill({ color: 0x1a1a1a, alpha: 0.8 });
    body.rect(-1, 2, 1, 5).fill({ color: 0x1a1a1a, alpha: 0.8 });
    // belly seam stitches
    body.rect(-4, 7, 1, 1).fill(0xeeeeee);
    body.rect(-2, 7, 1, 1).fill(0xeeeeee);
    body.rect(0, 7, 1, 1).fill(0xeeeeee);
    body.rect(2, 7, 1, 1).fill(0xeeeeee);
    this.visual.addChild(body);

    // ===== TANK — spike armor over the pug body (was metal plates) =====
    if (d.armored) {
      const plates = new Graphics();
      plates.rect(-10, -1, 4, 9).fill(0x2a2a32);
      plates.rect(6, -1, 4, 9).fill(0x2a2a32);
      plates.rect(-4, -1, 8, 5).fill(0x444450);
      plates.rect(-10, -1, 4, 1).fill(0x666672);
      plates.rect(6, -1, 4, 1).fill(0x666672);
      // shoulder spikes (jutting up)
      plates.rect(-9, -4, 2, 4).fill(0xbababa);
      plates.rect(-9, -4, 1, 4).fill(0xeaeaea);
      plates.rect(7, -4, 2, 4).fill(0xbababa);
      plates.rect(7, -4, 1, 4).fill(0xeaeaea);
      // back spikes (smaller, in middle)
      plates.rect(-2, -3, 1, 3).fill(0xbababa);
      plates.rect(1, -3, 1, 3).fill(0xbababa);
      // rivets
      plates.circle(-7, 2, 0.8).fill(0xaaaaaa);
      plates.circle(7, 2, 0.8).fill(0xaaaaaa);
      plates.circle(0, 2, 0.8).fill(0xaaaaaa);
      this.visual.addChild(plates);
    }

    // ===== SPITTER — bile sac (bulging green sack on back) =====
    if (d.isRanged) {
      const sac = new Graphics();
      sac.ellipse(0, 8, 9, 5).fill(bile);
      sac.ellipse(0, 8, 9, 5).stroke({ color: bileShade, width: 1 });
      sac.circle(-2, 7, 1.2).fill({ color: 0xffffff, alpha: 0.7 });
      sac.circle(2, 9, 0.8).fill({ color: 0xffffff, alpha: 0.4 });
      // bubbling specks
      sac.circle(-4, 9, 0.7).fill(0xddffdd);
      sac.circle(4, 8, 0.6).fill(0xddffdd);
      this.visual.addChild(sac);
    }

    // ===== EXPLODER — bomb collar around the neck =====
    if (d.explodes) {
      const collar = new Graphics();
      // collar band around neck/shoulders
      collar.rect(-9, -3, 18, 3).fill(0x3a2a14);
      collar.rect(-9, -3, 18, 1).fill(0x6a4a2a);
      // central red blinking detonator
      collar.circle(0, -1, 2.5).fill(COLORS.bloodRed);
      collar.circle(0, -1, 1.2).fill(COLORS.neonYellow);
      collar.circle(0, -1, 0.5).fill(0xffffff);
      // dynamite sticks dangling from collar
      collar.rect(-7, 0, 2, 5).fill(0xc8281f);
      collar.rect(-7, 0, 1, 5).fill(0xff5a5a);
      collar.rect(5, 0, 2, 5).fill(0xc8281f);
      collar.rect(5, 0, 1, 5).fill(0xff5a5a);
      // wires
      collar.rect(-4, -2, 8, 1).fill(COLORS.neonYellow);
      this.visual.addChild(collar);
    }

    // ===== LEGS (4 stubby pug paws, uneven — one limp) =====
    const legs = new Graphics();
    legs.rect(-10, -1, 4, 5).fill(skinDark);
    legs.rect(-10, -1, 1, 5).fill(skin);
    legs.rect(6, -1, 4, 5).fill(skinDark);
    legs.rect(9, -1, 1, 5).fill(skinDeep);
    legs.rect(-9, 6, 4, 5).fill(skinDark);   // back-left (slightly forward)
    legs.rect(5, 5, 3, 6).fill(skinDark);     // back-right (dragging — limp)
    // claw tips (yellowed)
    legs.rect(-9, 10, 3, 1).fill(0xfde0b8);
    legs.rect(6, 10, 3, 1).fill(0xfde0b8);
    legs.rect(-9, 3, 3, 1).fill(0xfde0b8);
    legs.rect(6, 3, 3, 1).fill(0xfde0b8);
    this.visual.addChild(legs);

    // exposed rib bone poking through belly
    const bone = new Graphics();
    bone.rect(-4, 0, 7, 1).fill(COLORS.pugCream);
    bone.rect(-3, 1, 5, 1).fill({ color: COLORS.pugCream, alpha: 0.7 });
    this.visual.addChild(bone);

    // ===== HEAD (squat, square — pug-shape) =====
    const head = new Graphics();
    head.ellipse(0, -6, 9, 7).fill(skin);
    head.ellipse(0, -6, 9, 7).stroke({ color: skinDeep, width: 1 });
    // forehead highlight (rounded shape)
    head.ellipse(-1, -8, 6, 3).fill({ color: skinHi, alpha: 0.55 });
    // jowls (signature pug — drooping cheeks)
    head.ellipse(-7, -4, 2, 3).fill(skin);
    head.ellipse(7, -4, 2, 3).fill(skin);
    head.ellipse(-7, -4, 2, 3).stroke({ color: skinDeep, width: 1, alpha: 0.6 });
    head.ellipse(7, -4, 2, 3).stroke({ color: skinDeep, width: 1, alpha: 0.6 });
    this.visual.addChild(head);

    // forehead wrinkles (deep pug brow furrows)
    const wrinkles = new Graphics();
    wrinkles.rect(-4, -10, 8, 1).fill({ color: skinDeep, alpha: 0.85 });
    wrinkles.rect(-3, -9, 6, 1).fill({ color: skinDeep, alpha: 0.6 });
    wrinkles.rect(-1, -8, 2, 1).fill({ color: skinDeep, alpha: 0.7 });
    this.visual.addChild(wrinkles);

    // ===== DROP EARS (signature pug — flopped down with pink inner) =====
    const ears = new Graphics();
    // left ear (drop)
    ears.rect(-11, -9, 4, 6).fill(shade(skin, 0.7));
    ears.rect(-11, -9, 4, 1).fill(skin);
    ears.rect(-11, -9, 1, 6).fill(skinDeep);
    ears.rect(-10, -7, 2, 3).fill(earInner);      // pink inner
    ears.rect(-10, -7, 2, 1).fill(earInnerShade);
    // right ear (drop, slightly torn)
    ears.rect(7, -9, 4, 5).fill(shade(skin, 0.7));  // shorter = torn
    ears.rect(7, -9, 4, 1).fill(skin);
    ears.rect(10, -9, 1, 5).fill(skinDeep);
    ears.rect(8, -7, 2, 2).fill(earInner);
    ears.rect(8, -7, 2, 1).fill(earInnerShade);
    // ear tear notch
    ears.rect(9, -5, 2, 1).fill(0x000000);
    this.visual.addChild(ears);

    // ===== GLOWING RED EYES (no whites — straight crimson glow) =====
    const eyes = new Graphics();
    // outer glow halo
    eyes.circle(-3, -6, 3.5).fill({ color: eyeColor, alpha: 0.35 });
    eyes.circle(3, -6, 3.5).fill({ color: eyeColor, alpha: 0.35 });
    // eye core
    eyes.circle(-3, -6, 2).fill(eyeColor);
    eyes.circle(3, -6, 2).fill(eyeColor);
    // bright center
    eyes.circle(-3, -6, 1).fill(eyeGlow);
    eyes.circle(3, -6, 1).fill(eyeGlow);
    // tiny catchlight (sinister glint)
    eyes.rect(-3, -7, 1, 1).fill(0xffffff);
    eyes.rect(3, -7, 1, 1).fill(0xffffff);
    this.visual.addChild(eyes);

    // ===== SNOUT + NOSE (pug-flat snout) =====
    const snout = new Graphics();
    // black flat nose
    snout.rect(-2, -3, 4, 2).fill(0x000000);
    snout.rect(-1, -3, 1, 1).fill(0x3a3a3a);
    snout.rect(-2, -1, 4, 1).fill({ color: 0x1a1a1a, alpha: 0.8 });
    this.visual.addChild(snout);

    // ===== DRIPPING FANG-MOUTH + bile saliva =====
    const mouth = new Graphics();
    mouth.rect(-3, 0, 6, 2).fill(0x000000);
    // top fangs
    mouth.rect(-2, 0, 1, 2).fill(0xffffff);
    mouth.rect(0, 0, 1, 2).fill(0xffffff);
    mouth.rect(2, 0, 1, 2).fill(0xffffff);
    // bottom fang
    mouth.rect(-1, 2, 1, 1).fill(0xffffff);
    mouth.rect(1, 2, 1, 1).fill(0xffffff);
    // dripping bile saliva
    mouth.rect(-2, 2, 1, 3).fill(bile);
    mouth.rect(2, 2, 1, 2).fill(bile);
    mouth.circle(-2, 5, 0.8).fill(bile);
    mouth.circle(3, 4, 0.6).fill(bile);
    // blood smear on mouth
    mouth.circle(-1, 1, 0.5).fill(COLORS.bloodRed);
    mouth.circle(2, 1, 0.4).fill(COLORS.bloodRed);
    this.visual.addChild(mouth);

    // ===== SCREAMER — gaping pink throat with rotted teeth =====
    if (d.summons) {
      const throat = new Graphics();
      throat.ellipse(0, -2, 5, 4).fill(0xff3aa1);
      throat.ellipse(0, -2, 5, 4).stroke({ color: 0x6a0a4a, width: 1 });
      // inner gum (deeper red)
      throat.ellipse(0, -1, 3, 2).fill({ color: 0xc8281f, alpha: 0.7 });
      // jagged teeth
      throat.rect(-4, -4, 1, 2).fill(0xeeeeee);
      throat.rect(-2, -4, 1, 2).fill(0xeeeeee);
      throat.rect(1, -4, 1, 2).fill(0xeeeeee);
      throat.rect(3, -4, 1, 2).fill(0xeeeeee);
      throat.rect(-3, 1, 1, 2).fill(0xeeeeee);
      throat.rect(0, 1, 1, 2).fill(0xeeeeee);
      throat.rect(2, 1, 1, 2).fill(0xeeeeee);
      this.visual.addChild(throat);
    }

    // ===== DIGGER — big bone claws on front + dirt trail =====
    if (d.ignoresWalls) {
      const claws = new Graphics();
      claws.rect(-13, 2, 4, 5).fill(0xfde0b8);
      claws.rect(9, 2, 4, 5).fill(0xfde0b8);
      claws.rect(-13, 2, 1, 5).fill(0xffffff);
      claws.rect(9, 2, 1, 5).fill(0xffffff);
      // claw tips (sharper)
      claws.rect(-13, 7, 1, 2).fill(0xfde0b8);
      claws.rect(-11, 7, 1, 2).fill(0xfde0b8);
      claws.rect(10, 7, 1, 2).fill(0xfde0b8);
      claws.rect(12, 7, 1, 2).fill(0xfde0b8);
      // dirt clods trailing behind
      claws.circle(0, 12, 3).fill({ color: 0x6a4a2a, alpha: 0.7 });
      claws.circle(-4, 13, 2).fill({ color: 0x6a4a2a, alpha: 0.5 });
      claws.circle(4, 13, 2).fill({ color: 0x6a4a2a, alpha: 0.5 });
      this.visual.addChild(claws);
    }

    // ===== CLOAKER — purple shimmer outline + sneaky vibe =====
    if (d.cloaks) {
      const shimmer = new Graphics();
      shimmer.circle(0, -2, 13).stroke({ color: 0xb055ff, width: 1, alpha: 0.55 });
      shimmer.circle(0, -2, 10).stroke({ color: 0xb055ff, width: 1, alpha: 0.3 });
      // hood overlay on head
      shimmer.rect(-9, -12, 18, 4).fill({ color: 0x2a1244, alpha: 0.6 });
      shimmer.rect(-9, -12, 18, 1).fill({ color: 0x6a3a8a, alpha: 0.6 });
      this.visual.addChild(shimmer);
    }

    // ===== TANK CROWN — looks dangerous, marks elite =====
    if (d.armored) {
      const crown = new Graphics();
      crown.rect(-5, -13, 10, 2).fill(0x666672);
      crown.rect(-5, -15, 1, 2).fill(0x666672);
      crown.rect(-2, -16, 2, 3).fill(0x666672);
      crown.rect(2, -16, 2, 3).fill(0x666672);
      crown.rect(4, -15, 1, 2).fill(0x666672);
      crown.rect(-5, -13, 10, 1).fill(0xaaaaaa);
      // crown gem
      crown.circle(0, -14, 1).fill(COLORS.bloodRed);
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
  // NIGHT 1 — softball intro: only walkers + runners, no specialists yet.
  // (Was 60/25/10/5 walker/runner/cloaker/digger — too punishing for first-time players.)
  const compositions = {
    1: [['walker', 0.80], ['runner', 0.20]],
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

// Total spawns per night. Night 1 is now per-difficulty (was hard-coded 26 = brutal
// on Normal). Difficulty key matches the localStorage value in Game/main.
export function waveLineup(nightIdx, difficulty = 'normal') {
  const perNight = {
    easy:   { 1: 7,  2: 30, 3: 32 },
    normal: { 1: 12, 2: 42, 3: 40 },
    hard:   { 1: 18, 2: 54, 3: 50 },
  };
  const table = perNight[difficulty] || perNight.normal;
  return table[nightIdx] || (50 + (nightIdx - 3) * 15);
}
