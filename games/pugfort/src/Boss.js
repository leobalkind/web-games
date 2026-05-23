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
    // RAGE AURA — separate container behind the visual so it doesn't tint with body
    this.aura = new Container();
    this.container.addChild(this.aura);
    this.auraGfx = new Graphics();
    this.aura.addChild(this.auraGfx);
    this._auraT = 0;
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

    // BIGGER, GAUDIER crown of bones + gold + spikes (was tiny — now POPS)
    const crown = new Graphics();
    // gold base band (wider)
    crown.rect(-20, -30, 40, 6).fill(0xffd23f);
    crown.rect(-20, -30, 40, 2).fill(0xfff0a8);
    crown.rect(-20, -25, 40, 1).fill(0x8a5a10);
    // taller spikes (5 of them, alternating bone + gold)
    crown.rect(-18, -38, 4, 8).fill(0xfde0b8);
    crown.rect(-18, -38, 1, 8).fill(0xffffff);
    crown.rect(-10, -42, 4, 12).fill(0xffd23f);
    crown.rect(-10, -42, 1, 12).fill(0xfff0a8);
    crown.rect(-2, -46, 4, 16).fill(0xfde0b8);     // centerpiece — TALLEST
    crown.rect(-2, -46, 1, 16).fill(0xffffff);
    crown.rect(6, -42, 4, 12).fill(0xffd23f);
    crown.rect(6, -42, 1, 12).fill(0xfff0a8);
    crown.rect(14, -38, 4, 8).fill(0xfde0b8);
    crown.rect(14, -38, 1, 8).fill(0xffffff);
    // 3 inset gems (red/cyan/red)
    crown.circle(-10, -27, 1.5).fill(COLORS.bloodRed);
    crown.circle(0, -27, 1.5).fill(COLORS.neonCyan);
    crown.circle(10, -27, 1.5).fill(COLORS.bloodRed);
    // crown apex blood drip (centerpiece looks bloody)
    crown.rect(-1, -32, 2, 4).fill(COLORS.bloodRed);
    this.visual.addChild(crown);

    // ===== CHAINS — heavy iron chains draped across body =====
    const chains = new Graphics();
    // primary horizontal chain across chest
    const chainColor = 0x4a4a52;
    const chainHi = 0x7a7a84;
    const chainShade = 0x222228;
    for (let i = -28; i <= 28; i += 5) {
      chains.circle(i, 8, 1.8).fill(chainColor);
      chains.circle(i, 8, 1.8).stroke({ color: chainShade, width: 0.5 });
      chains.circle(i - 1, 7, 0.6).fill(chainHi);
    }
    // diagonal chain across shoulder (left to right)
    for (let t = 0; t < 8; t++) {
      const cx = -22 + t * 5;
      const cy = -2 + t * 2;
      chains.circle(cx, cy, 1.6).fill(chainColor);
      chains.circle(cx - 1, cy - 1, 0.5).fill(chainHi);
    }
    // dangling chain ends (with broken padlock + bone)
    chains.rect(-28, 20, 2, 6).fill(chainColor);
    chains.circle(-27, 20, 1.5).fill(chainColor);
    chains.circle(-27, 23, 1.5).fill(chainColor);
    chains.circle(-27, 26, 1.5).fill(chainColor);
    // padlock
    chains.rect(-30, 27, 6, 5).fill(0x6a5a10);
    chains.rect(-30, 27, 6, 1).fill(0xaa9a30);
    chains.circle(-27, 30, 0.8).fill(0x000000);
    // right-side dangle
    chains.rect(26, 22, 2, 5).fill(chainColor);
    chains.circle(27, 25, 1.5).fill(chainColor);
    chains.circle(27, 28, 1.5).fill(chainColor);
    this.visual.addChild(chains);

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

    // ===== Glowing RAGE AURA — pulsing red/orange halo behind the boss =====
    // Aura intensifies as HP drops (boss gets angrier).
    this._auraT += dt;
    const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    const rage = 1 - hpRatio;   // 0..1, higher = lower HP
    const pulse = 0.55 + 0.3 * Math.sin(this._auraT * 4.5);   // 0.25..0.85
    const radius = 70 + rage * 18 + Math.sin(this._auraT * 6) * 4;
    this.auraGfx.clear();
    // outer red glow
    this.auraGfx.circle(0, 6, radius)
      .fill({ color: COLORS.bloodRed, alpha: (0.12 + rage * 0.18) * pulse });
    // mid orange glow
    this.auraGfx.circle(0, 6, radius * 0.65)
      .fill({ color: 0xff6a3a, alpha: (0.15 + rage * 0.2) * pulse });
    // inner crimson ring
    this.auraGfx.circle(0, 6, radius * 0.85)
      .stroke({ color: COLORS.bloodRed, width: 2, alpha: 0.4 + rage * 0.4 });
    // jagged rage spikes (more when low HP)
    const spikeCount = 6 + Math.floor(rage * 6);
    for (let i = 0; i < spikeCount; i++) {
      const a = (i / spikeCount) * Math.PI * 2 + this._auraT * 0.6;
      const r1 = radius * 0.95;
      const r2 = radius * (1.15 + rage * 0.1);
      const x1 = Math.cos(a) * r1;
      const y1 = Math.sin(a) * r1 + 6;
      const x2 = Math.cos(a) * r2;
      const y2 = Math.sin(a) * r2 + 6;
      this.auraGfx.moveTo(x1, y1).lineTo(x2, y2)
        .stroke({ color: COLORS.bloodRed, width: 2.5, alpha: 0.55 + rage * 0.4 });
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      this.visual.alpha = 0.6 + Math.random() * 0.4;
      this.visual.tint = 0xffffff;
    } else {
      this.visual.alpha = 1;
      // intimidating pulse — bigger when more enraged
      const p = 1 + Math.sin(performance.now() / 200) * (0.025 + rage * 0.02);
      this.visual.scale.set(p);
    }
  }

  destroy() { this.container.destroy({ children: true }); }
}
