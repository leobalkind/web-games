import { Pug } from './Pug.js';
import { BARKS, rndPick } from './funnyText.js';

// Bot AI states: wander → seek treats → chase player → flee if low HP.
// Bots have personality "vibes": aggressive, scaredy, treat-greedy.
const VIBES = ['aggressive', 'scaredy', 'greedy', 'chill'];

export class Bot extends Pug {
  constructor({ name, formId, x, y }) {
    super({ name, formId, x, y, isPlayer: false });
    this.vibe = rndPick(VIBES);
    this.targetX = x;
    this.targetY = y;
    this.thinkT = 0;
    this.barkCooldown = Math.random() * 6;
  }

  think(world, energyMgr, pugs, dt, decoys = null) {
    if (!this.alive) return null;
    this.thinkT -= dt;
    this.barkCooldown -= dt;
    if (this.barkCooldown <= 0) {
      if (Math.random() < 0.5) this.bark(rndPick(BARKS));
      this.barkCooldown = 4 + Math.random() * 8;
    }

    // Identify nearest enemy
    let nearestEnemy = null;
    let nearestDist = Infinity;
    for (const p of pugs) {
      if (p === this || !p.alive) continue;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = p; }
    }
    // Decoys — fake stationary pugs dropped by the player. Only attract bots
    // within 600px (so it's a tactical bait, not a global distraction).
    if (decoys && decoys.length) {
      for (const d of decoys) {
        if (!d.alive) continue;
        const dx = d.x - this.x, dy = d.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 600 && dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = d;
        }
      }
    }
    // Identify nearest treat
    let nearestTreat = null;
    let treatDist = Infinity;
    for (const t of energyMgr.treats) {
      const d = Math.hypot(t.x - this.x, t.y - this.y);
      if (d < treatDist) { treatDist = d; nearestTreat = t; }
    }

    // Decide state
    const lowHp = this.hp < this.maxHp * 0.3;
    let mode = 'wander';
    if (lowHp && this.vibe !== 'aggressive') mode = 'flee';
    else if (this.vibe === 'greedy' && nearestTreat && treatDist < 400) mode = 'seekTreat';
    else if (nearestEnemy && nearestDist < 320) mode = 'fight';
    else if (nearestTreat && treatDist < 250) mode = 'seekTreat';

    // Pick target by mode
    if (mode === 'fight' && nearestEnemy) {
      // Move to keep ideal distance
      const ideal = 160;
      const angle = Math.atan2(this.y - nearestEnemy.y, this.x - nearestEnemy.x);
      this.targetX = nearestEnemy.x + Math.cos(angle) * ideal;
      this.targetY = nearestEnemy.y + Math.sin(angle) * ideal;
      this.setAimToward(nearestEnemy.x, nearestEnemy.y);
    } else if (mode === 'seekTreat' && nearestTreat) {
      this.targetX = nearestTreat.x;
      this.targetY = nearestTreat.y;
      if (nearestEnemy) this.setAimToward(nearestEnemy.x, nearestEnemy.y);
    } else if (mode === 'flee' && nearestEnemy) {
      const angle = Math.atan2(this.y - nearestEnemy.y, this.x - nearestEnemy.x);
      this.targetX = this.x + Math.cos(angle) * 300;
      this.targetY = this.y + Math.sin(angle) * 300;
      this.setAimToward(nearestEnemy.x, nearestEnemy.y);
    } else {
      // wander — pick a new target periodically
      if (this.thinkT <= 0) {
        this.targetX = Math.max(50, Math.min(world.width - 50, this.x + (Math.random() - 0.5) * 600));
        this.targetY = Math.max(50, Math.min(world.height - 50, this.y + (Math.random() - 0.5) * 600));
        this.thinkT = 1.5 + Math.random() * 2.5;
      }
    }

    // Stay in safe zone (priority) — if outside, target the center of safe zone
    if (!world.pointInSafeZone(this.x, this.y)) {
      const z = world.zone;
      this.targetX = z.x + z.w / 2;
      this.targetY = z.y + z.h / 2;
    }

    // Compute movement
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    let mx = 0, my = 0;
    if (dist > 8) {
      mx = dx / dist;
      my = dy / dist;
    }
    this.move(mx, my, dt);

    // Decide whether to fire — only when fighting and roughly aimed.
    // Skill profile drives aim quality + cadence.
    let fireRequest = null;
    const prof = this.skillProfile || { aimNoise: 0.07, fireRateMult: 1.0, leadMult: 1.0 };
    if (mode === 'fight' && nearestEnemy && nearestDist < 300) {
      this.cooldownFire -= dt;
      if (this.cooldownFire <= 0) {
        // lead target — scaled by skill profile
        const lead = 0.15 * prof.leadMult;
        const tx = nearestEnemy.x + nearestEnemy.vx * lead;
        const ty = nearestEnemy.y + nearestEnemy.vy * lead;
        this.setAimToward(tx, ty);
        // Add aim noise — rookies miss more
        this.aim += (Math.random() - 0.5) * prof.aimNoise;
        fireRequest = { aim: this.aim };
        this.cooldownFire = (this.form.fireRate / 1000) / prof.fireRateMult;
      }
    } else {
      this.cooldownFire -= dt;
    }
    return fireRequest;
  }
}
