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
  // STEALTHED — briefly invisible on a cycle. v1.7 round-2 tune:
  // shortened invisible phase from 1.5s → 1.0s so kiting feels less frustrating.
  stealthed: {
    name: 'Stealthed',
    hpBase: 50, dmgBase: 24, speedBase: 110,
    scale: 0.95,
    color: 0x6a3a8a,            // purple-violet phasing skin
    colorShade: 0x2a1244,
    radius: 14,
    isRanged: false,
    explodes: false,
    isStealthed: true,
    stealthInterval: 3.5,       // visible 2.5s + invis 1.0s (was 4.0 cycle)
    stealthVisibleDur: 2.5,
    desc: 'Phases in and out. Time your shots.',
  },
  // SHIELDED — frontal armor shaved off only by hits from behind. Renders a
  // chunky riot shield on its front (rotated with movement).
  shielded: {
    name: 'Shielded',
    hpBase: 90, dmgBase: 24, speedBase: 78,
    scale: 1.15,
    color: 0x5a7a3a,            // muddy military-green
    colorShade: 0x2a4a1a,
    radius: 18,
    isRanged: false,
    explodes: false,
    hasShield: true,
    shieldArc: Math.PI * 0.55,  // 99°-wide frontal arc absorbs damage
    desc: 'Frontal riot shield. Hit from BEHIND.',
  },
  // NINJA — full cloak (dark grey body), short blinky teleport-dashes every
  // few seconds. Different visual language from STEALTHED (which just fades)
  // — ninja has a hooded silhouette + visible katana.
  ninja: {
    name: 'Ninja',
    hpBase: 38, dmgBase: 26, speedBase: 140,
    scale: 0.95,
    color: 0x2a2a36,
    colorShade: 0x101018,
    radius: 14,
    isRanged: false,
    explodes: false,
    isNinja: true,
    dashInterval: 3.0,
    dashDistance: 90,
    desc: 'Hooded ninja. Teleports forward in short dashes.',
  },
  // JESTER — chaotic patroller that wanders unpredictably (zig-zags). Colorful
  // pixel-art jester hat + bell tip. Visually loud — pink/teal striped body.
  jester: {
    name: 'Jester',
    hpBase: 42, dmgBase: 20, speedBase: 105,
    scale: 1.0,
    color: 0xc8285a,            // bright magenta-red
    colorShade: 0x6a0a2a,
    radius: 15,
    isRanged: false,
    explodes: false,
    isJester: true,
    jesterAmp: 90,              // sideways wander amplitude
    jesterFreq: 1.4,
    desc: 'Chaotic. Zig-zags wildly. Hard to predict.',
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
    const tierMult = 1 + (tier - 1) * 0.28;
    this.maxHp = Math.round(def.hpBase * tierMult);
    this.hp = this.maxHp;
    this.damage = Math.round(def.dmgBase * (0.9 + (tier - 1) * 0.16));
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

    // ===== STEALTHED — purple shimmer + phase rune on chest =====
    if (d.isStealthed) {
      const phase = new Graphics();
      // Rune marking on chest
      phase.rect(-3, -2, 6, 1).fill(0xb055ff);
      phase.rect(-1, -4, 2, 6).fill(0xb055ff);
      phase.rect(-3, 0, 1, 2).fill(0xb055ff);
      phase.rect(2, 0, 1, 2).fill(0xb055ff);
      // Aura ring
      phase.circle(0, -2, 16).stroke({ color: 0xb055ff, width: 1, alpha: 0.45 });
      this.visual.addChild(phase);
    }

    // ===== NINJA — dark hood + katana strap. Distinctive from STEALTHED's
    // phasing aura: ninja is OPAQUE but dark, with a visible weapon.
    if (d.isNinja) {
      const ninja = new Graphics();
      // Dark hooded cowl over entire head
      ninja.rect(-9, -12, 18, 7).fill(0x101018);
      ninja.rect(-9, -12, 18, 2).fill(0x2a2a36);
      ninja.rect(-9, -6, 18, 2).fill(0x000000);
      // Eye slit — single horizontal red glow band
      ninja.rect(-5, -8, 10, 2).fill({ color: 0xff3a3a, alpha: 0.85 });
      ninja.rect(-5, -7, 10, 1).fill({ color: 0xffd0d0, alpha: 0.9 });
      // Katana scabbard slung across back (diagonal)
      ninja.rect(-12, -2, 24, 2).fill(0x222228);
      ninja.rect(-12, -2, 24, 1).fill(0x6a6a72);
      // Katana hilt (right side, gold)
      ninja.rect(8, -3, 2, 4).fill(0xffd23f);
      ninja.rect(8, -3, 2, 1).fill(0xfff0a8);
      // Pointed hood tail
      ninja.rect(-2, -14, 4, 4).fill(0x101018);
      // Shuriken on belt (tiny X)
      ninja.rect(-5, 4, 3, 1).fill(0xc8c8d0);
      ninja.rect(-4, 3, 1, 3).fill(0xc8c8d0);
      this.visual.addChild(ninja);
    }
    // ===== JESTER — colorful clown hat (3 spiky tips), checkered jersey,
    // tiny bell on cap. Loud + chaotic — opposite of the dark zombies.
    if (d.isJester) {
      const jester = new Graphics();
      // Triple-spike jester hat (alternating magenta + teal)
      jester.rect(-7, -14, 14, 4).fill(0xc8285a);
      jester.rect(-7, -14, 14, 1).fill(0xff5a8a);
      // 3 spiky tips
      jester.rect(-6, -18, 3, 4).fill(0x4cc9f0);
      jester.rect(-1, -19, 3, 5).fill(0xc8285a);
      jester.rect(4, -18, 3, 4).fill(0x4cc9f0);
      // Bell on center tip (tiny yellow circle)
      jester.circle(0, -20, 1.5).fill(0xffd23f);
      jester.rect(0, -21, 1, 1).fill(0xffffff);
      // Checkered jersey on chest (pink + teal squares)
      for (let i = 0; i < 3; i++) {
        const cx = -6 + i * 4;
        jester.rect(cx, 2, 4, 4).fill(i % 2 === 0 ? 0xff5a8a : 0x4cc9f0);
      }
      // Ruff collar (white frilled fan)
      jester.rect(-8, -3, 16, 2).fill(0xeeeeee);
      jester.rect(-8, -3, 2, 2).fill(0xdddddd);
      jester.rect(0, -3, 2, 2).fill(0xdddddd);
      jester.rect(6, -3, 2, 2).fill(0xdddddd);
      // Painted clown cheek dots
      jester.circle(-6, -4, 1).fill(0xff3aa1);
      jester.circle(6, -4, 1).fill(0xff3aa1);
      this.visual.addChild(jester);
    }
    // ===== SHIELDED — riot shield mounted on the FRONT (right side, +X)
    // The arc test in takeDamage uses the zombie's aim/facing to decide if a
    // hit lands in the protected zone.
    if (d.hasShield) {
      const shieldG = new Graphics();
      // Shield slab (vertical riot shield extending past the body to the right)
      shieldG.rect(10, -16, 6, 32).fill(0x444450);
      shieldG.rect(10, -16, 6, 4).fill(0x6a6a72);
      shieldG.rect(10, 12, 6, 4).fill(0x222228);
      shieldG.rect(10, -16, 2, 32).fill(0x9a9aa8); // outer rim
      shieldG.rect(14, -16, 2, 32).fill(0x222228); // inner shadow
      // Visor band
      shieldG.rect(10, -6, 6, 4).fill({ color: 0x4cc9f0, alpha: 0.6 });
      shieldG.rect(10, -6, 6, 1).fill(0xb0e8ff);
      // Rivets
      shieldG.circle(12, -10, 0.8).fill(0xaaaaaa);
      shieldG.circle(12, 0, 0.8).fill(0xaaaaaa);
      shieldG.circle(12, 10, 0.8).fill(0xaaaaaa);
      // Skull-glyph on the shield centerline
      shieldG.rect(12, 4, 2, 2).fill(COLORS.bloodRed);
      this.visual.addChild(shieldG);
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

  // takeDamage now accepts an optional projectile angle so SHIELDED zombies can
  // reject frontal hits. `projectileAngle` is the world-angle of the projectile's
  // velocity (radians). If absent, damage applies as normal.
  takeDamage(amount, projectileAngle = null) {
    if (!this.alive) return;
    // Shield logic — block frontal hits within the shieldArc.
    if (this.def.hasShield && projectileAngle != null) {
      // Projectile travels toward the zombie at `projectileAngle`; the angle
      // from zombie to projectile-source is the OPPOSITE. So the hit-direction
      // from the zombie's POV is `projectileAngle + PI`.
      const hitFromAngle = projectileAngle + Math.PI;
      let diff = hitFromAngle - this.aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const arc = this.def.shieldArc || (Math.PI * 0.55);
      if (Math.abs(diff) < arc / 2) {
        // Blocked — small spark flash but no HP loss
        this.flashT = 0.08;
        this._shieldBlockFlash = 0.18;
        return;
      }
    }
    this.hp -= amount;
    this.flashT = 0.15;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    this._renderHpBar();
  }

  update(dt, target, walls = []) {
    if (!this.alive) return;
    if (!target || !target.alive) return;

    const d = this.def;
    // Tick wire-slow timer (re-applied each frame the zombie touches wire).
    if (this._wireSlowT > 0) {
      this._wireSlowT -= dt;
      if (this._wireSlowT <= 0) { this._wireSlowMul = 1; }
    }
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

    // NINJA dash: every dashInterval seconds, the ninja blinks forward toward
    // the target. Visualized by Game via wantsToDash flag (puff + ring).
    if (d.isNinja) {
      this._dashT = (this._dashT || 0) - dt;
      if (this._dashT <= 0 && dist > 30) {
        this._dashT = d.dashInterval;
        const dashDist = Math.min(d.dashDistance, dist - 16);
        if (dashDist > 4) {
          const oldX = this.x, oldY = this.y;
          this.x += (dx / dist) * dashDist;
          this.y += (dy / dist) * dashDist;
          this._dashFromX = oldX;
          this._dashFromY = oldY;
          this.wantsToDashPoof = true; // Game will spawn a teleport puff
        }
      }
    }
    if (dist > 0.1) {
      this.aim = Math.atan2(dy, dx);

      // Ranged (Spitter): stop at attackRange, fire instead of moving close
      const shouldStop = d.isRanged && dist < d.attackRange;
      if (!shouldStop) {
        let ux = dx / dist;
        let uy = dy / dist;
        // JESTER zig-zag: oscillate movement angle sideways using a sine
        // perpendicular to the target vector. Amp + freq from def.
        if (d.isJester) {
          const t = performance.now() / 1000;
          const sway = Math.sin(t * d.jesterFreq + this.id * 0.7) * 0.65;
          // Perpendicular vector
          const perpX = -uy, perpY = ux;
          ux = ux + perpX * sway;
          uy = uy + perpY * sway;
          const L = Math.hypot(ux, uy) || 1;
          ux /= L; uy /= L;
        }
        const wireMul = (this._wireSlowMul && this._wireSlowT > 0) ? this._wireSlowMul : 1;
        const nextX = this.x + ux * this.speed * wireMul * dt;
        const nextY = this.y + uy * this.speed * wireMul * dt;
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
    // Stealthed cycle — visible for stealthVisibleDur, then invisible for the
    // remainder of stealthInterval. Tied to performance.now for a smooth phase
    // that doesn't reset across pauses.
    if (this.def.isStealthed) {
      const phase = (performance.now() / 1000) % this.def.stealthInterval;
      const visiblePhase = phase < this.def.stealthVisibleDur;
      baseAlpha *= visiblePhase ? 1 : 0.06;
    }
    // Shield-block visual flash
    if (this._shieldBlockFlash > 0) {
      this._shieldBlockFlash -= dt;
      baseAlpha = Math.min(1, baseAlpha + 0.3);
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
    2: [['walker', 0.32], ['runner', 0.22], ['tank', 0.08], ['spitter', 0.07],
        ['cloaker', 0.05], ['digger', 0.04], ['screamer', 0.03],
        ['stealthed', 0.05], ['shielded', 0.04],
        ['jester', 0.06], ['ninja', 0.04]],
    3: [['walker', 0.14], ['runner', 0.14], ['tank', 0.10], ['spitter', 0.08],
        ['exploder', 0.08], ['cloaker', 0.07], ['digger', 0.06], ['screamer', 0.06],
        ['stealthed', 0.07], ['shielded', 0.07],
        ['jester', 0.07], ['ninja', 0.06]],
  };
  // Nights 4+ inherit night 3 composition (endless mode keeps using it).
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
// Nights past 3 (endless mode) scale by +15 zombies per night per difficulty.
export function waveLineup(nightIdx, difficulty = 'normal') {
  const perNight = {
    easy:   { 1: 7,  2: 22, 3: 32 },
    normal: { 1: 12, 2: 32, 3: 44 },
    hard:   { 1: 18, 2: 44, 3: 56 },
  };
  const table = perNight[difficulty] || perNight.normal;
  if (table[nightIdx]) return table[nightIdx];
  // Endless: linearly scale past night 3
  const base = table[3] || 44;
  return base + (nightIdx - 3) * 15;
}
