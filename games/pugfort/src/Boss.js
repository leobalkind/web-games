import { Container, Graphics } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

let _bid = 1;

// =============================================================================
// THE KENNEL KING — boss-tier zombie pug fused with mechanical armor.
// Massive HP. Two attack patterns: STOMP (AOE shockwave) + SUMMON (spawns
// walkers). Moves toward target (player or generator) but slow.
// =============================================================================
export class Boss {
  constructor({ x, y, hpMult = 1 } = {}) {
    this.id = _bid++;
    this.type = 'boss';
    this.def = { name: 'KENNEL KING', isRanged: false, explodes: false, color: 0x6a1a2a };
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.aim = 0;
    this.maxHp = Math.round(4500 * hpMult);
    this.hp = this.maxHp;
    this.damage = 60;
    this.contactDamage = 32;
    this.speed = 45;
    this.radius = 56;
    this.alive = true;
    this.flashT = 0;
    this.contactT = 0;
    this.stompT = 4;       // first stomp after 4s of activity
    this.summonT = 7;
    this.wantsToStomp = null;   // {x, y} when boss is signaling Game
    this.wantsToSummon = false;
    this.summonsRemaining = 12; // total walker summons over its life
    this.attackPattern = 'walk';

    this.container = new Container();
    this.container.label = `boss-${this.id}`;
    this.container.x = x;
    this.container.y = y;
    this.visual = new Container();
    this.container.addChild(this.visual);
    this._draw();
  }

  _draw() {
    // Big shadow
    const sh = new Graphics();
    sh.ellipse(0, 36, 56, 14).fill({ color: 0x000000, alpha: 0.55 });
    sh.ellipse(0, 36, 44, 10).fill({ color: 0x000000, alpha: 0.4 });
    this.visual.addChild(sh);

    // body — massive bloated zombie pug
    const body = new Graphics();
    body.ellipse(0, 14, 38, 26).fill(0x6a1a2a);
    body.ellipse(0, 14, 38, 26).stroke({ color: 0x3a0a14, width: 2 });
    body.ellipse(-8, 10, 26, 16).fill({ color: 0x8a3a4a, alpha: 0.5 });
    body.ellipse(6, 18, 22, 12).fill({ color: 0x3a0a14, alpha: 0.45 });
    // infection lumps
    body.circle(-14, 16, 5).fill({ color: 0x4a1a2a, alpha: 0.8 });
    body.circle(12, 10, 6).fill({ color: 0x4a1a2a, alpha: 0.8 });
    body.circle(8, 22, 4).fill({ color: COLORS.bloodRed, alpha: 0.7 });
    body.circle(-12, 22, 3).fill({ color: COLORS.bloodRed, alpha: 0.7 });
    this.visual.addChild(body);

    // mechanical armor plates on shoulders/legs
    const armor = new Graphics();
    armor.rect(-30, -2, 12, 18).fill(0x4a4a52);
    armor.rect(18, -2, 12, 18).fill(0x4a4a52);
    armor.rect(-30, -2, 12, 4).fill(0x7a7a84);
    armor.rect(18, -2, 12, 4).fill(0x7a7a84);
    armor.rect(-30, 14, 12, 2).fill(0x222228);
    armor.rect(18, 14, 12, 2).fill(0x222228);
    // bolts
    armor.circle(-26, 4, 1.5).fill(0x222228);
    armor.circle(-22, 12, 1.5).fill(0x222228);
    armor.circle(22, 4, 1.5).fill(0x222228);
    armor.circle(26, 12, 1.5).fill(0x222228);
    // chest plate
    armor.rect(-12, 6, 24, 18).fill(0x5a5a64);
    armor.rect(-12, 6, 24, 3).fill(0x7a7a84);
    // crown emblem in center
    armor.rect(-3, 11, 6, 4).fill(COLORS.neonYellow);
    armor.rect(-3, 11, 6, 1).fill(0xfff0a8);
    this.visual.addChild(armor);

    // 4 huge legs/claws
    const legs = new Graphics();
    legs.rect(-26, 24, 8, 12).fill(0x4a0a14);
    legs.rect(18, 24, 8, 12).fill(0x4a0a14);
    legs.rect(-22, 30, 8, 10).fill(0x3a0a14);
    legs.rect(14, 30, 8, 10).fill(0x3a0a14);
    // bone claws sticking out
    legs.rect(-26, 34, 8, 4).fill(0xfde0b8);
    legs.rect(18, 34, 8, 4).fill(0xfde0b8);
    this.visual.addChild(legs);

    // exposed ribcage / bones
    const bones = new Graphics();
    bones.rect(-10, 12, 20, 1).fill(0xeae0c0);
    bones.rect(-12, 18, 24, 1).fill(0xeae0c0);
    bones.rect(-10, 24, 20, 1).fill(0xeae0c0);
    this.visual.addChild(bones);

    // HUGE HEAD with multiple eyes
    const head = new Graphics();
    head.ellipse(0, -10, 26, 22).fill(0x6a1a2a);
    head.ellipse(0, -10, 26, 22).stroke({ color: 0x3a0a14, width: 2 });
    head.ellipse(-6, -14, 18, 12).fill({ color: 0x8a3a4a, alpha: 0.5 });
    this.visual.addChild(head);

    // shredded ears (uneven, big)
    const ears = new Graphics();
    ears.rect(-26, -22, 6, 12).fill(0x4a0a14);
    ears.rect(20, -20, 5, 10).fill(0x4a0a14); // torn shorter
    ears.rect(-26, -22, 1, 12).fill(0x6a1a2a);
    ears.rect(24, -20, 1, 10).fill(0x6a1a2a);
    // tear at the bottom
    ears.rect(-25, -12, 4, 1).fill(0x000000);
    this.visual.addChild(ears);

    // crown of bones / spikes
    const crown = new Graphics();
    crown.rect(-12, -34, 4, 6).fill(0xfde0b8);
    crown.rect(-6, -36, 4, 8).fill(0xfde0b8);
    crown.rect(0, -38, 4, 10).fill(0xfde0b8);
    crown.rect(6, -36, 4, 8).fill(0xfde0b8);
    crown.rect(12, -34, 4, 6).fill(0xfde0b8);
    crown.rect(-14, -28, 28, 3).fill(0x4a4a52);
    crown.rect(-14, -28, 28, 1).fill(0x7a7a84);
    this.visual.addChild(crown);

    // MULTIPLE GLOWING EYES (4 of them)
    const eyes = new Graphics();
    // main pair
    eyes.circle(-8, -10, 4).fill(COLORS.zombieEye);
    eyes.circle(8, -10, 4).fill(COLORS.zombieEye);
    eyes.circle(-8, -10, 2).fill(0xffd0d0);
    eyes.circle(8, -10, 2).fill(0xffd0d0);
    eyes.circle(-8, -10, 6).fill({ color: COLORS.zombieEye, alpha: 0.3 });
    eyes.circle(8, -10, 6).fill({ color: COLORS.zombieEye, alpha: 0.3 });
    // smaller secondary pair
    eyes.circle(-14, -4, 2).fill(COLORS.zombieEye);
    eyes.circle(14, -4, 2).fill(COLORS.zombieEye);
    eyes.circle(-14, -4, 1).fill(0xffffff);
    eyes.circle(14, -4, 1).fill(0xffffff);
    this.visual.addChild(eyes);

    // drippy maw with teeth
    const maw = new Graphics();
    maw.rect(-10, -2, 20, 8).fill(0x000000);
    maw.rect(-10, -2, 20, 1).fill(0x3a0a14);
    // top teeth
    maw.rect(-9, -1, 2, 3).fill(0xffffff);
    maw.rect(-5, -1, 2, 3).fill(0xffffff);
    maw.rect(-1, -1, 2, 3).fill(0xffffff);
    maw.rect(3, -1, 2, 3).fill(0xffffff);
    maw.rect(7, -1, 2, 3).fill(0xffffff);
    // bottom teeth
    maw.rect(-7, 4, 2, 2).fill(0xffffff);
    maw.rect(-3, 4, 2, 2).fill(0xffffff);
    maw.rect(1, 4, 2, 2).fill(0xffffff);
    maw.rect(5, 4, 2, 2).fill(0xffffff);
    // drool
    maw.rect(-2, 6, 1, 4).fill(COLORS.bloodRed);
    maw.rect(3, 6, 1, 3).fill(COLORS.bloodRed);
    this.visual.addChild(maw);

    // infection tentacles dangling from back
    const tents = new Graphics();
    tents.rect(-32, 30, 2, 12).fill(0x3a6a3a);
    tents.rect(30, 30, 2, 12).fill(0x3a6a3a);
    tents.rect(-32, 40, 4, 2).fill(0x3a6a3a);
    tents.rect(28, 40, 4, 2).fill(0x3a6a3a);
    tents.rect(-30, 42, 1, 1).fill(COLORS.zombieEye);
    tents.rect(30, 42, 1, 1).fill(COLORS.zombieEye);
    this.visual.addChild(tents);
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    this.flashT = 0.18;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  update(dt, target, walls = []) {
    if (!this.alive) return;
    if (!target || !target.alive) return;

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.1) {
      this.aim = Math.atan2(dy, dx);
      // Boss moves slowly toward target. Walls don't stop it.
      const ux = dx / dist;
      const uy = dy / dist;
      this.x += ux * this.speed * dt;
      this.y += uy * this.speed * dt;
    }

    // STOMP timer — periodic shockwave
    this.stompT -= dt;
    if (this.stompT <= 0) {
      this.stompT = 5 + Math.random() * 2;
      this.wantsToStomp = { x: this.x, y: this.y };
    }
    // SUMMON timer — periodic walker spawns
    this.summonT -= dt;
    if (this.summonT <= 0 && this.summonsRemaining > 0) {
      this.summonT = 8 + Math.random() * 3;
      this.summonsRemaining -= 1;
      this.wantsToSummon = true;
    }

    // Contact damage to target (player or generator)
    if (dist < this.radius + (target.radius || 30) - 4) {
      this.contactT += dt;
      if (this.contactT > 0.45) {
        if (target.takeDamage) target.takeDamage(this.contactDamage);
        this.contactT = 0;
      }
    } else {
      this.contactT = 0;
    }
  }

  syncVisual(dt) {
    this.container.x = this.x;
    this.container.y = this.y;
    this.container.rotation = this.aim;
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.visual.alpha = 0.6 + Math.random() * 0.4;
      this.visual.tint = 0xffffff;
    } else {
      this.visual.alpha = 1;
      // intimidating pulse
      const p = 1 + Math.sin(performance.now() / 200) * 0.02;
      this.visual.scale.set(p);
    }
  }

  destroy() { this.container.destroy({ children: true }); }
}
