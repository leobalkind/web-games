import { Container, Graphics, Text } from 'pixi.js';
import { COLORS } from './colors.js';
import { FORMS, makePugVisual } from './pugForms.js';
import { BARKS, rndPick } from './funnyText.js';

let _pugId = 1;

// Common base for player + bots. Holds the visual entity, stats, ability state.
export class Pug {
  constructor({ name, formId, x, y, isPlayer = false }) {
    this.id = _pugId++;
    this.name = name;
    this.formId = formId;
    this.form = FORMS[formId];
    this.isPlayer = isPlayer;
    this.alive = true;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.aim = 0; // radians

    this.hp = this.form.hp;
    this.maxHp = this.form.hp;
    this.xp = 0;
    this.kills = 0;
    // Equipped weapon (set after construction via setWeapon)
    this.weapon = null;
    this.skin = null;
    this.ammo = 0;
    this.reloading = false;
    this.reloadT = 0;
    // Active power-up buffs — array of { def, timeLeft }
    this.buffs = [];
    // Money — earned from collecting treats + holding center
    this.money = 0;
    // Recent damage source tracking (set by takeDamage; cleared on kill)
    this.lastDamagedBy = null;
    this.lastPlayerDamageAt = 0;
    // Tracking for assists — set of pug.id who damaged this pug recently
    this.recentDamagers = new Set();
    // Level-up upgrade stats (only the player uses these)
    this.level = 1;
    this.energyForLevel = 0;
    this.bonus = {
      hp: 0,            // additive to maxHp
      dmgMult: 1,       // multiplier on projectile damage
      spdMult: 1,       // multiplier on movement speed
      fireMult: 1,      // multiplier on fire rate (>1 = faster)
      projSpdMult: 1,   // multiplier on projectile speed
      regen: 0,         // hp/sec passive regen
      lifestealPct: 0,  // % of damage healed back
      borkCdReduce: 0,  // seconds shaved off bork cooldown
    };
    this.cooldownFire = 0;
    this.borkCharge = 0;     // 0..1 charge ratio for bork ability
    this.borkCooldown = 0;   // seconds until bork can be charged again
    this.invuln = 0;         // brief i-frames after spawn / hit
    this.flashT = 0;         // visual flash timer
    // Ability cooldowns (player only — bots ignore these)
    this.dashCd = 0;          // E — short forward burst
    this.decoyCd = 0;         // Q — drop fake target
    this.healCd = 0;          // R — instant heal + ally pulse
    // Dash motion state: dashT counts down a quick burst window where we
    // override velocity with dashVx/dashVy.
    this.dashT = 0;
    this.dashVx = 0;
    this.dashVy = 0;

    this.container = new Container();
    this.container.label = `pug-${this.id}`;
    this.container.x = x;
    this.container.y = y;

    this.visual = makePugVisual(formId);
    this.container.addChild(this.visual);

    // HP bar
    this.hpBar = new Graphics();
    this.container.addChild(this.hpBar);

    // Name tag
    this.nameTag = new Text({
      text: name,
      style: {
        fill: isPlayer ? COLORS.yellow : COLORS.white,
        fontFamily: 'monospace',
        fontSize: 9,
        fontWeight: 'bold',
        stroke: { color: COLORS.black, width: 2 },
      },
    });
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.y = -this.form.radius - 16;
    this.container.addChild(this.nameTag);

    // Bark text bubble (rare)
    this.barkText = null;
    this.barkT = 0;

    this._wobble = 0;

    this._renderHpBar();
  }

  _renderHpBar() {
    const w = 30;
    const h = 4;
    this.hpBar.clear();
    this.hpBar.rect(-w / 2, -this.form.radius - 10, w, h).fill({ color: 0x000000, alpha: 0.5 });
    const ratio = Math.max(0, this.hp / this.maxHp);
    const c = ratio > 0.5 ? COLORS.green : ratio > 0.25 ? COLORS.yellow : COLORS.hydrant;
    this.hpBar.rect(-w / 2 + 1, -this.form.radius - 9, (w - 2) * ratio, h - 2).fill(c);
  }

  // Evolve into a new form. Returns the new form id.
  evolveTo(newFormId) {
    this.formId = newFormId;
    this.form = FORMS[newFormId];
    // Heal up on evolve, preserving level-up bonuses AND difficulty/perk HP scaling.
    // (Game stamps this._hpMult during start() to capture playerHpMult * hpPctMult
    // so evolves/level-ups don't silently strip the Glass Cannon HP penalty.)
    const hpMult = this._hpMult || 1;
    this.maxHp = Math.round(this.form.hp * hpMult) + (this.bonus ? this.bonus.hp : 0);
    this.hp = this.maxHp;
    this.xp = 0;
    // Replace visual
    this.container.removeChild(this.visual);
    this.visual.destroy({ children: true });
    this.visual = makePugVisual(newFormId);
    this.container.addChildAt(this.visual, 0);
    this.nameTag.y = -this.form.radius - 16;
    this._renderHpBar();
  }

  // Aim toward a world point.
  setAimToward(wx, wy) {
    this.aim = Math.atan2(wy - this.y, wx - this.x);
  }

  // Apply movement vector (already normalized) for this frame.
  move(dx, dy, dt) {
    // Dash overrides normal control during the burst window.
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashVx;
      this.vy = this.dashVy;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    const sp = this.form.speed;
    // accelerate toward target velocity
    const targetVx = dx * sp;
    const targetVy = dy * sp;
    const accel = 12;
    this.vx += (targetVx - this.vx) * Math.min(1, accel * dt);
    this.vy += (targetVy - this.vy) * Math.min(1, accel * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  takeDamage(amount, source) {
    if (!this.alive) return;
    if (this.invuln > 0) return;
    this.hp -= amount;
    this.flashT = 0.15;
    this.invuln = 0.05;
    // Track recent damager — used by Game for kill credit + assists.
    // Set lastDamagedAt = current time (Game stamps it; we hold the ref).
    this.lastDamagedBy = source && source.id ? source : null;
    if (source && source.id != null) this.recentDamagers.add(source.id);
    if (source && source.isPlayer) {
      this.lastPlayerDamageAt = performance.now() / 1000;
    }
    if (this.hp <= 0) {
      this.alive = false;
      this.hp = 0;
    }
    this._renderHpBar();
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this._renderHpBar();
  }

  setWeapon(weapon, skin) {
    this.weapon = weapon;
    this.skin = skin;
    this.ammo = weapon.magSize;
    this.reloading = false;
    this.reloadT = 0;
  }

  bark(text) {
    if (this.barkText) this.barkText.destroy();
    this.barkText = new Text({
      text: text || rndPick(BARKS),
      style: {
        fill: COLORS.white,
        fontFamily: 'monospace',
        fontSize: 10,
        fontWeight: 'bold',
        stroke: { color: COLORS.pink, width: 2 },
      },
    });
    this.barkText.anchor.set(0.5, 1);
    this.barkText.y = -this.form.radius - 28;
    this.container.addChild(this.barkText);
    this.barkT = 1.2;
  }

  // Per-frame visual updates only (called after gameplay update)
  syncVisual(dt) {
    this.container.x = this.x;
    this.container.y = this.y;
    // animated wobble + squash-stretch when moving
    const speed = Math.hypot(this.vx, this.vy);
    const speedRatio = Math.min(1, speed / 240);
    if (speed > 10) {
      this._wobble += dt * (12 + speedRatio * 16);
      // tilt forward into movement direction
      const moveAngle = Math.atan2(this.vy, this.vx);
      const tilt = Math.cos(moveAngle) * 0.08 * speedRatio;
      this.visual.rotation = tilt + Math.sin(this._wobble) * 0.05;
      // bob up/down (driving over bumps)
      const bob = -Math.abs(Math.sin(this._wobble * 0.9)) * (1.4 + speedRatio * 1.2);
      this.visual.y = bob;
      // gentle squash-stretch
      const sx = (this._facing || 1) * (1 + Math.sin(this._wobble) * 0.04 * speedRatio);
      const sy = 1 - Math.sin(this._wobble) * 0.04 * speedRatio;
      this.visual.scale.set(1.18 * sx, 1.18 * sy);
    } else {
      // idle — gentle breathing
      this._wobble += dt * 2;
      this.visual.rotation *= 0.85;
      this.visual.y *= 0.85;
      const breathe = 1 + Math.sin(this._wobble) * 0.015;
      this.visual.scale.set(1.18 * (this._facing || 1) * breathe, 1.18 / breathe);
    }
    // facing (track separately so scale can squash without overriding flip)
    const facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    this._facing = facing;
    // re-apply facing into x scale
    this.visual.scale.x = Math.abs(this.visual.scale.x) * facing;
    // flash on damage
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.visual.tint = 0xffffff;
      this.visual.alpha = 0.5 + Math.random() * 0.5;
    } else if (this.invuln > 0.1) {
      // long invuln (spawn shield) — pulse so player knows
      this.visual.alpha = 0.55 + 0.35 * Math.sin(performance.now() / 80);
      this.visual.tint = 0xb0e8ff;
    } else {
      this.visual.alpha = 1;
      this.visual.tint = 0xffffff;
    }
    if (this.invuln > 0) this.invuln -= dt;
    // bark life
    if (this.barkText) {
      this.barkT -= dt;
      this.barkText.y = -this.form.radius - 28 - (1 - this.barkT) * 6;
      this.barkText.alpha = Math.max(0, this.barkT);
      if (this.barkT <= 0) {
        this.barkText.destroy();
        this.barkText = null;
      }
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
