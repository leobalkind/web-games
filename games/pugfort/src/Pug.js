import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, shade } from './Colors.js';

// =============================================================================
// Player pug — top-down chunky pixel pug viewed from 3/4 angle.
// Composed of detailed Graphics primitives; rotates to face mouse direction.
// =============================================================================
export class Pug {
  constructor({ x, y } = {}) {
    this.x = x ?? 1200;
    this.y = y ?? 900;
    this.vx = 0; this.vy = 0;
    this.aim = 0; // rotation in radians

    this.maxHp = 100;
    this.hp = 100;
    this.maxStam = 100;
    this.stam = 100;
    this.speed = 220;
    this.sprintMult = 1.6;
    this.radius = 18;
    this.alive = true;
    this.flashT = 0;
    this.invuln = 0;
    this.kills = 0;

    this.container = new Container();
    this.container.label = 'player-pug';
    this.container.x = this.x;
    this.container.y = this.y;

    this.visual = new Container();
    this.container.addChild(this.visual);
    this._drawPug();

    // Aim indicator (small arrow ahead of pug)
    this.aimMarker = new Graphics();
    this.container.addChild(this.aimMarker);
    this._drawAimMarker();
  }

  _drawPug() {
    // ground shadow (bigger, softer)
    const sh = new Graphics();
    sh.ellipse(0, 13, 22, 6).fill({ color: 0x000000, alpha: 0.45 });
    sh.ellipse(0, 13, 18, 5).fill({ color: 0x000000, alpha: 0.25 });
    this.visual.addChild(sh);

    // BODY — multi-shade oval with belly highlight
    const body = new Graphics();
    body.ellipse(0, 5, 14, 10).fill(COLORS.pugFur);
    body.ellipse(0, 5, 14, 10).stroke({ color: COLORS.pugFurShade, width: 1 });
    body.ellipse(-3, 3, 10, 7).fill({ color: COLORS.pugFurHi, alpha: 0.55 });
    body.ellipse(2, 7, 9, 5).fill({ color: COLORS.pugFurShade, alpha: 0.45 });
    // belly stripe (lighter)
    body.ellipse(0, 8, 6, 3).fill({ color: COLORS.pugCream, alpha: 0.3 });
    // fur tufts at edges (small darker pixels)
    body.rect(-13, 3, 1, 1).fill(COLORS.pugFurShade);
    body.rect(12, 3, 1, 1).fill(COLORS.pugFurShade);
    body.rect(-13, 7, 1, 1).fill(COLORS.pugFurShade);
    body.rect(12, 7, 1, 1).fill(COLORS.pugFurShade);
    this.visual.addChild(body);

    // CURLY CORKSCREW TAIL behind body (more pixels)
    const tail = new Graphics();
    tail.rect(-3, 12, 3, 2).fill(COLORS.pugFur);
    tail.rect(-5, 13, 2, 2).fill(COLORS.pugFur);
    tail.rect(-6, 15, 2, 2).fill(COLORS.pugFur);
    tail.rect(-4, 16, 2, 2).fill(COLORS.pugFur);
    tail.rect(-3, 17, 2, 1).fill(COLORS.pugFurShade);
    // curl highlight
    tail.rect(-4, 12, 1, 1).fill(COLORS.pugFurHi);
    this.visual.addChild(tail);

    // 4 STUBBY LEGS with visible paw pads
    const legs = new Graphics();
    // back-left
    legs.rect(-11, -1, 4, 5).fill(COLORS.pugFurShade);
    legs.rect(-11, -1, 1, 5).fill(COLORS.pugFur);  // inner hi
    legs.rect(-10, 3, 2, 1).fill(0x000000);         // paw pad
    // back-right
    legs.rect(7, -1, 4, 5).fill(COLORS.pugFurShade);
    legs.rect(7, -1, 1, 5).fill(COLORS.pugFur);
    legs.rect(8, 3, 2, 1).fill(0x000000);
    // front-left
    legs.rect(-10, 6, 4, 5).fill(COLORS.pugFurShade);
    legs.rect(-10, 6, 1, 5).fill(COLORS.pugFur);
    legs.rect(-9, 10, 2, 1).fill(0x000000);
    // front-right
    legs.rect(6, 6, 4, 5).fill(COLORS.pugFurShade);
    legs.rect(6, 6, 1, 5).fill(COLORS.pugFur);
    legs.rect(7, 10, 2, 1).fill(0x000000);
    this.visual.addChild(legs);

    // HEAD — round dome with sphere shading
    const head = new Graphics();
    head.ellipse(0, -7, 10, 8).fill(COLORS.pugFur);
    head.ellipse(0, -7, 10, 8).stroke({ color: COLORS.pugFurShade, width: 1 });
    head.ellipse(-3, -9, 6, 4).fill({ color: COLORS.pugFurHi, alpha: 0.7 });
    head.ellipse(-4, -10, 3, 2).fill({ color: 0xffffff, alpha: 0.25 });
    this.visual.addChild(head);

    // FOREHEAD WRINKLES (signature pug feature)
    const wrinkles = new Graphics();
    wrinkles.rect(-4, -11, 8, 1).fill({ color: COLORS.pugFurShade, alpha: 0.7 });
    wrinkles.rect(-3, -12, 6, 1).fill({ color: COLORS.pugFurShade, alpha: 0.7 });
    wrinkles.rect(-1, -13, 2, 1).fill({ color: COLORS.pugFurShade, alpha: 0.5 });
    this.visual.addChild(wrinkles);

    // DROP EARS sticking out (more detail)
    const ears = new Graphics();
    // left ear
    ears.rect(-11, -9, 4, 8).fill(COLORS.pugBrown);
    ears.rect(-11, -9, 1, 8).fill(shade(COLORS.pugBrown, 1.4));
    ears.rect(-11, -2, 4, 1).fill(shade(COLORS.pugBrown, 0.6));
    ears.rect(-10, -7, 2, 4).fill({ color: COLORS.pugTongue, alpha: 0.5 }); // inner ear
    // right ear
    ears.rect(7, -9, 4, 8).fill(COLORS.pugBrown);
    ears.rect(10, -9, 1, 8).fill(shade(COLORS.pugBrown, 0.6));
    ears.rect(7, -2, 4, 1).fill(shade(COLORS.pugBrown, 0.6));
    ears.rect(8, -7, 2, 4).fill({ color: COLORS.pugTongue, alpha: 0.5 });
    this.visual.addChild(ears);

    // CHEEK PUFFS (jowls)
    const jowls = new Graphics();
    jowls.ellipse(-7, -4, 3, 3).fill({ color: COLORS.pugFur, alpha: 0.9 });
    jowls.ellipse(7, -4, 3, 3).fill({ color: COLORS.pugFur, alpha: 0.9 });
    jowls.rect(-9, -2, 1, 2).fill(COLORS.pugFurShade);
    jowls.rect(8, -2, 1, 2).fill(COLORS.pugFurShade);
    this.visual.addChild(jowls);

    // BLACK MASK on face
    const mask = new Graphics();
    mask.ellipse(0, -5, 7, 5).fill(COLORS.pugMask);
    mask.rect(-4, -3, 8, 1).fill({ color: COLORS.pugMask, alpha: 0.6 });
    this.visual.addChild(mask);

    // HUGE BUG EYES with iris + catchlight + lower reflection
    const eyes = new Graphics();
    // whites
    eyes.circle(-3, -8, 2.4).fill(0xffffff);
    eyes.circle(3, -8, 2.4).fill(0xffffff);
    // iris (subtle brown)
    eyes.circle(-3, -8, 1.6).fill(0x4a2a14);
    eyes.circle(3, -8, 1.6).fill(0x4a2a14);
    // pupil
    eyes.circle(-3, -8, 1).fill(0x101018);
    eyes.circle(3, -8, 1).fill(0x101018);
    // catchlights upper-left
    eyes.rect(-4, -9, 1, 1).fill(0xffffff);
    eyes.rect(2, -9, 1, 1).fill(0xffffff);
    // lower reflection
    eyes.rect(-3, -7, 1, 1).fill(0x6688aa);
    eyes.rect(3, -7, 1, 1).fill(0x6688aa);
    this.visual.addChild(eyes);

    // PUSHED-IN SNOUT with nose bridge highlight
    const snout = new Graphics();
    snout.rect(-3, -5, 6, 4).fill(COLORS.pugMask);
    snout.rect(-2, -6, 4, 1).fill(shade(COLORS.pugMask, 1.7));  // bridge highlight
    snout.rect(-1, -7, 2, 1).fill(shade(COLORS.pugMask, 1.5));
    snout.rect(-1, -3, 1, 1).fill(0x000000); // nostril
    snout.rect(0, -3, 1, 1).fill(0x000000);
    this.visual.addChild(snout);

    // TONGUE
    const tongue = new Graphics();
    tongue.rect(-1, -2, 2, 2).fill(COLORS.pugTongue);
    tongue.rect(-1, -1, 1, 1).fill(0xffaac4);
    this.visual.addChild(tongue);

    // WHISKER DOTS
    const whiskers = new Graphics();
    whiskers.rect(-5, -3, 1, 1).fill(shade(COLORS.pugMask, 1.4));
    whiskers.rect(4, -3, 1, 1).fill(shade(COLORS.pugMask, 1.4));
    this.visual.addChild(whiskers);

    // HELD PISTOL in front of the pug (visible weapon)
    const gun = new Graphics();
    // grip
    gun.rect(11, -1, 3, 4).fill(0x222228);
    gun.rect(11, -1, 1, 4).fill(0x444450);
    // barrel
    gun.rect(13, -1, 8, 2).fill(0x18181c);
    gun.rect(13, -1, 8, 1).fill(0x444450);
    // sight
    gun.rect(15, -2, 2, 1).fill(0x666672);
    // muzzle hole
    gun.rect(20, 0, 1, 1).fill(0x000000);
    this.visual.addChild(gun);
  }

  _drawAimMarker() {
    this.aimMarker.clear();
    // subtle aim line forward
    this.aimMarker.rect(20, -0.5, 14, 1).fill({ color: COLORS.neonYellow, alpha: 0.35 });
  }

  setAimToward(wx, wy) {
    this.aim = Math.atan2(wy - this.y, wx - this.x);
  }

  move(dx, dy, dt, sprintMult = 1) {
    const sp = this.speed * sprintMult;
    const targetVx = dx * sp;
    const targetVy = dy * sp;
    const accel = 14;
    const blend = Math.min(1, accel * dt);
    this.vx += (targetVx - this.vx) * blend;
    this.vy += (targetVy - this.vy) * blend;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  takeDamage(amount) {
    if (!this.alive || this.invuln > 0) return;
    this.hp -= amount;
    this.flashT = 0.18;
    this.invuln = 0.1;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  syncVisual(dt) {
    this.container.x = this.x;
    this.container.y = this.y;
    this.container.rotation = this.aim; // whole pug rotates to face direction
    // flash on damage
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.visual.alpha = 0.5 + Math.random() * 0.5;
    } else {
      this.visual.alpha = 1;
    }
    if (this.invuln > 0) this.invuln -= dt;
  }

  destroy() { this.container.destroy({ children: true }); }
}
