import { Application, Container, Graphics, Text } from 'pixi.js';
import { COLORS, shade } from './Colors.js';
import { World } from './World.js';
import { Pug } from './Pug.js';
import { Zombie, ZOMBIE_TYPES, pickZombieType, waveLineup } from './Zombie.js';
import { ProjectileManager } from './Projectile.js';
import { WoodManager } from './Wood.js';
import { Build, BUILDABLES, MATERIALS, canAfford, spend, costString, isLocked, recordSurvival } from './Build.js';
import { Hud } from './Hud.js';
import { Input } from './Input.js';
import { Sfx } from './Sfx.js';
import { Generator } from './Generator.js';
import { Boss } from './Boss.js';
import { getShakeMul as _pf_shakeMul } from '../../../src/shared/screenShake.js';

const DAY_DURATION = 30;
const DAY_DURATION_FIRST = 45; // first day = longer prep (Night 1 ramp-fix)
const NIGHT_DURATION = 50;
const TRANSITION_DURATION = 3;
const TOTAL_NIGHTS = 3;

// Helper — longer prep on Night 1 only.
function _dayDurationFor(nightsCompleted) {
  // nightsCompleted = 0 -> Day 1 -> first night ahead
  return nightsCompleted === 0 ? DAY_DURATION_FIRST : DAY_DURATION;
}

const PISTOL_DAMAGE = 20;
const PISTOL_SPEED = 620;
const PISTOL_COOLDOWN = 0.25;

export class Game {
  constructor() {
    this.app = null;
    this.world = null;
    this.player = null;
    this.zombies = [];
    this.projectiles = null;
    this.wood = null;
    this.build = null;
    this.hud = null;
    this.input = null;
    this.acidBalls = [];
    this.running = false;
    this.matchTime = 0;
    this.phase = 'day';
    this.phaseT = 0;
    this.phaseTotal = _dayDurationFor(0);
    this.nightIdx = 0;
    this.nightsSurvived = 0;
    this.nightSpawnTimer = 0;
    this.nightTotalSpawned = 0;
    this.nightSpawnTarget = 0;
    this.resources = { wood: 0, scrap: 0, explosives: 0, electronics: 0 };
    this.playerKills = 0;
    this.wallsBuilt = 0;
    this.turretsBuilt = 0;
    this.fireCooldown = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this._lastPlayerHp = 100;
    this._speedMult = 1; // toggled via the shared speedToggle button
    this._lastGenHp = null;
    // Pity-drop tracker: every Nth kill globally guarantees the player's lowest
    // material drops at the kill site. Counter persists across all kills.
    this._killStreak = 0;
    this._pityInterval = 8;
  }

  _screenShake(mag, dur) {
    const k = _pf_shakeMul();
    this.shakeMag = Math.max(this.shakeMag || 0, mag * k);
    this.shakeT = Math.max(this.shakeT || 0, dur);
  }

  async init(rootEl) {
    this.app = new Application();
    await this.app.init({
      background: COLORS.bgDeep,
      resizeTo: window,
      antialias: true,
      resolution: 1,
    });
    rootEl.appendChild(this.app.canvas);
    this.input = new Input(this.app.canvas, this.touchControls || null, this.gamepad || null);
    this.hud = new Hud();
  }

  async start(opts = {}) {
    this._teardown();
    const mapId = opts.mapId || localStorage.getItem('pugfort:map') || 'courtyard';
    const endless = !!opts.endless || localStorage.getItem('pugfort:endless') === '1';
    this._endless = endless;
    // Different maps scale differently — ROOFTOP is smaller (vertical), UNDERGROUND
    // is wider/taller-ratio with smaller-feeling FOV; COURTYARD is the default.
    let mapW = 3600, mapH = 2700;
    if (mapId === 'rooftop') { mapW = 3200; mapH = 2400; }
    else if (mapId === 'underground') { mapW = 3000; mapH = 2400; }
    this.mapId = mapId;
    // Bigger map
    this.world = new World({ width: mapW, height: mapH, mapId });
    this.app.stage.addChild(this.world.container);
    // Zoom-in for closer FOV — feels more intimate/cinematic
    this.app.stage.scale.set(1.5);

    this.projectiles = new ProjectileManager(this.world.effectsLayer);
    this.wood = new WoodManager(this.world.itemsLayer);
    this.wood.scatter(36, this.world.width, this.world.height);

    // Generator at center of map — zombies target it, destroy = game over
    this.generator = new Generator(this.world.width / 2, this.world.height / 2, 900);
    this.world.entitiesLayer.addChild(this.generator.container);

    // Player spawns near (but not on) the generator
    this.player = new Pug({ x: this.world.width / 2 - 120, y: this.world.height / 2 - 80 });
    this.world.entitiesLayer.addChild(this.player.container);

    this.build = new Build({ scene: this.world.mapLayer });

    this.zombies = [];
    this.acidBalls = [];
    this.boss = null;
    this.bossSpawned = false;
    this.matchTime = 0;
    this.phase = 'day';
    this.phaseT = 0;
    this.phaseTotal = _dayDurationFor(0); // first day = longer prep
    this.nightIdx = 0;
    this.nightsSurvived = 0;
    // Starting stash: enough wood + scrap for a baseline starter wall before first night.
    // (Was 12 wood / 2 scrap — too thin; players couldn't build even one full row.)
    this.resources = { wood: 30, scrap: 15, explosives: 0, electronics: 0 };
    this.playerKills = 0;
    this.wallsBuilt = 0;
    this.turretsBuilt = 0;
    this.fireCooldown = 0;
    this._killStreak = 0;
    this._deathFreezeFired = false;
    this._genDeathFreezeFired = false;
    this._hitstopT = 0;
    this.running = true;

    this.hud.show();
    this.hud.updatePlayer(this.player);
    this.hud.updateResources(this.resources, 0);
    this.hud.updatePhase('day', 1, TOTAL_NIGHTS, 0);
    this.hud.toastMessage('DAY 1 — gather wood, build defenses. Night brings horde.', 'good');

    if (!this._tickerBound) {
      this.app.ticker.add((tk) => this._update(tk));
      this._tickerBound = true;
    }
    window.__PUGFORT = this;
  }

  _teardown() {
    if (this.world) {
      this.app.stage.removeChild(this.world.container);
      this.world.container.destroy({ children: true });
      this.world = null;
    }
    this.zombies = [];
    this.acidBalls = [];
    this.boss = null;
    this.bossSpawned = false;
  }

  _update(ticker) {
    if (!this.running) return;
    if (this.gamepad) this.gamepad.pump();
    // Only the night phase honours the 1x/2x/3x speed toggle. Day/sunset/dawn
    // stay at 1x so prep-time pacing doesn't get squashed.
    const speed = (this.phase === 'night') ? (this._speedMult || 1) : 1;
    let dt = Math.min(ticker.deltaMS / 1000, 1 / 30) * speed;
    // Hit-pause — short freeze on big events (boss stomp, night start, etc).
    // We tick the timer with raw frame dt but zero the gameplay dt while active.
    if (this._hitstopT && this._hitstopT > 0) {
      this._hitstopT -= Math.min(ticker.deltaMS / 1000, 1 / 30);
      dt = 0;
    }
    this.matchTime += dt;
    this.phaseT += dt;

    this._lastDt = dt;
    this._updatePhase();
    this._updatePlayer(dt);
    this._updateZombies(dt);
    this._updateTurrets(dt);
    this._updateAcidBalls(dt);
    this._updateProjectiles(dt);
    this._updateBuild();
    this._updateBuildables(dt);
    this._updateWood(dt);
    this._updateDepots(dt);
    if (this.world.updateWorldFx) this.world.updateWorldFx(dt, this.matchTime);
    if (this.world.updateLamps)   this.world.updateLamps(dt);
    if (this.generator) this.generator.update(dt);
    this._updateCamera();
    this._updateHud();
    this._checkEndConditions();

    this.input.postFrame();
  }

  // ---------- Phase / day-night ----------
  _updatePhase() {
    if (this.phaseT < this.phaseTotal) return;
    if (this.phase === 'day') {
      this.phase = 'sunset';
      this.phaseTotal = TRANSITION_DURATION;
      this.phaseT = 0;
      this.hud.toastMessage('☀️ → 🌅 Sunset...', 'warn');
    } else if (this.phase === 'sunset') {
      this.phase = 'night';
      this.phaseTotal = NIGHT_DURATION;
      this.phaseT = 0;
      this.nightIdx += 1;
      this.nightTotalSpawned = 0;
      const _diff = localStorage.getItem('pugfort:difficulty') || 'normal';
      this.nightSpawnTarget = waveLineup(this.nightIdx, _diff);
      this.nightSpawnTimer = 0;
      this._announceWave();
      this.hud.showWaveBanner(`NIGHT ${this.nightIdx}`);
      // Cinematic night-start: longer + heavier shake; bigger on later nights.
      this._screenShake(8 + this.nightIdx * 1.5, 0.5);
      // Quick brief hit-pause so the wave-banner pop reads as an EVENT.
      this._hitstopT = 0.1;
      Sfx.phaseNight();
      // Bottom-center "incoming" wave preview — fired AFTER state set so callers
      // see correct night index. Non-critical, wrap in try/catch.
      if (typeof this.onWaveStart === 'function') {
        try { this.onWaveStart(this.nightIdx, this.nightSpawnTarget); } catch (e) { /* */ }
      }
    } else if (this.phase === 'night') {
      this.nightsSurvived += 1;
      for (const z of this.zombies) z.alive = false;
      this.phase = 'dawn';
      this.phaseTotal = TRANSITION_DURATION;
      this.phaseT = 0;
      this.hud.toastMessage(`🌅 Survived night ${this.nightIdx} / ${TOTAL_NIGHTS}`, 'good');
    } else if (this.phase === 'dawn') {
      this.phase = 'day';
      // nightsSurvived has incremented at end of night; helper uses that count
      this.phaseTotal = _dayDurationFor(this.nightsSurvived);
      this.phaseT = 0;
      this.wood.scatter(18, this.world.width, this.world.height);
      if (this.world.refillResourceDepots) this.world.refillResourceDepots();
      this.hud.toastMessage(`☀️ DAY ${this.nightIdx + 1} — fortify! Depots restocked.`, 'good');
      Sfx.phaseDay();
    }
    const k = this.phaseT / this.phaseTotal;
    this.world.setPhaseTint(this.phase, k);
  }

  _announceWave() {
    const enemies = {
      1: 'Walkers + Runners',
      2: 'Walkers + Runners + 🛡️ Tanks + 🦠 Spitters',
      3: 'EVERYTHING — Tanks, Spitters, 💣 Exploders incoming',
    }[this.nightIdx] || 'EVERYTHING';
    this.hud.toastMessage(`🌙 NIGHT ${this.nightIdx} — ${enemies}`, 'warn');
  }

  // ---------- Player ----------
  _updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;

    const tAim = this.input.touchAim ? this.input.touchAim() : null;
    if (tAim) {
      p.aim = Math.atan2(tAim.y, tAim.x);
    } else {
      const screen = this.input.mouse;
      const cam = this.app.stage;
      const wx = (screen.screenX - cam.x) / cam.scale.x;
      const wy = (screen.screenY - cam.y) / cam.scale.y;
      p.setAimToward(wx, wy);
    }

    const mv = this.input.moveVector();
    let sprintMult = 1;
    if (this.input.sprintDown() && p.stam > 1 && (mv.x !== 0 || mv.y !== 0)) {
      sprintMult = p.sprintMult;
      p.stam = Math.max(0, p.stam - 28 * dt);
    } else {
      p.stam = Math.min(p.maxStam, p.stam + 14 * dt);
    }
    p.move(mv.x, mv.y, dt, sprintMult);

    p.x = Math.max(p.radius, Math.min(this.world.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(this.world.height - p.radius, p.y));

    // Resolve generator collision (push out of generator footprint)
    if (this.generator && this.generator.alive) {
      const gx = this.generator.x, gy = this.generator.y + 6;
      const gw = 34, gh = 26; // half-extents
      const cx = Math.max(gx - gw, Math.min(p.x, gx + gw));
      const cy = Math.max(gy - gh, Math.min(p.y, gy + gh));
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < p.radius) {
        if (d > 0.01) {
          const overlap = p.radius - d;
          p.x += (dx / d) * overlap;
          p.y += (dy / d) * overlap;
        } else { p.x += 1; }
      }
    }

    // Resolve wall collisions
    for (const w of this.build.placed) {
      const cx = Math.max(w.x, Math.min(p.x, w.x + w.width));
      const cy = Math.max(w.y, Math.min(p.y, w.y + w.height));
      const dx = p.x - cx, dy = p.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < p.radius) {
        if (d > 0.01) {
          const overlap = p.radius - d;
          p.x += (dx / d) * overlap;
          p.y += (dy / d) * overlap;
        } else { p.x += 1; }
      }
    }

    // Fire
    this.fireCooldown -= dt;
    if (!this.build.selected && this.input.isFiring() && this.fireCooldown <= 0) {
      this.fireCooldown = PISTOL_COOLDOWN;
      const angle = p.aim;
      const offX = Math.cos(angle) * (p.radius + 8);
      const offY = Math.sin(angle) * (p.radius + 8);
      this.projectiles.spawn({
        x: p.x + offX, y: p.y + offY,
        vx: Math.cos(angle) * PISTOL_SPEED,
        vy: Math.sin(angle) * PISTOL_SPEED,
        damage: PISTOL_DAMAGE,
        color: COLORS.neonYellow,
      });
      this._spawnMuzzleFlash(p.x + offX, p.y + offY, angle);
      Sfx.pistol();
    }

    p.syncVisual(dt);

    const gained = this.wood.tryCollect(p.x, p.y);
    if (gained > 0) {
      this.resources.wood = (this.resources.wood || 0) + gained;
      this.hud.toastMessage(`+${gained} 🪵`, 'good');
      Sfx.woodCollect();
    }
  }

  _spawnMuzzleFlash(x, y, angle) {
    const g = new Graphics();
    g.x = x; g.y = y; g.rotation = angle;
    g.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.95 });
    g.circle(0, 0, 6).fill(COLORS.neonYellow);
    g.rect(0, -3, 22, 6).fill({ color: COLORS.neonYellow, alpha: 0.7 });
    this.world.effectsLayer.addChild(g);
    setTimeout(() => g.destroy(), 80);
  }

  // ---------- Zombies ----------
  _updateZombies(dt) {
    if (this.phase === 'night' && this.nightTotalSpawned < this.nightSpawnTarget) {
      this.nightSpawnTimer -= dt;
      if (this.nightSpawnTimer <= 0) {
        this._spawnZombie();
        this.nightTotalSpawned += 1;
        this.nightSpawnTimer = (NIGHT_DURATION * 0.75) / this.nightSpawnTarget;
      }
    }
    // BOSS spawn: night 3, halfway through. Only spawns once.
    if (this.phase === 'night' && this.nightIdx === TOTAL_NIGHTS && !this.bossSpawned
        && this.phaseT > NIGHT_DURATION * 0.4) {
      this._spawnBoss();
    }
    // Update boss
    if (this.boss && this.boss.alive) {
      const target = (this.generator && this.generator.alive) ? this.generator : this.player;
      this.boss.update(dt, target, this.build.placed);
      if (this.boss.wantsToStomp) {
        this._bossStomp(this.boss.x, this.boss.y);
        this.boss.wantsToStomp = null;
      }
      if (this.boss.wantsToSummon) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = 80 + Math.random() * 40;
          this._spawnZombieAt(this.boss.x + Math.cos(a) * d, this.boss.y + Math.sin(a) * d, 'walker');
        }
        this.boss.wantsToSummon = false;
        Sfx.zombieDeath(); // a screamy noise for the summon
      }
      this.boss.syncVisual(dt);
      // contact damage handled inside boss.update via target.takeDamage
      // generator special damage from boss
      if (this.generator && this.generator.alive) {
        const dx = this.boss.x - this.generator.x, dy = this.boss.y - this.generator.y;
        const d = Math.hypot(dx, dy);
        if (d < this.boss.radius + this.generator.radius - 4) {
          this.boss.contactT += dt;
          if (this.boss.contactT > 0.45) {
            this.generator.takeDamage(this.boss.contactDamage * 1.5);
            this.boss.contactT = 0;
            Sfx.generatorHit();
          }
        }
      }
    } else if (this.boss && !this.boss.alive) {
      // boss death
      this._bossDeath(this.boss);
      this.boss = null;
    }

    const walls = this.build.placed;
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (!z.alive) {
        if (z.def.explodes) this._explode(z);
        this._spawnDeathPoof(z.x, z.y, z.def.color);
        // Small punch-shake on every kill — heavier for tanks/special zombies.
        const isHeavy = z.type === 'tank' || z.type === 'screamer' || z.type === 'digger';
        this._screenShake(isHeavy ? 3.5 : 1.5, isHeavy ? 0.18 : 0.1);
        // Hit-pause on tank kills only (rare events).
        if (isHeavy) this._hitstopT = Math.max(this._hitstopT || 0, 0.06);
        // ----- material drops by zombie type -----
        const drops = this._dropsForZombie(z);
        // Pity safeguard: every Nth kill, boost the player's lowest stockpile
        this._maybePityDrop(z, drops);
        // Wood drops as collectible logs (the player walks over them)
        if (drops.wood > 0) this.wood.spawnAt(z.x, z.y, drops.wood);
        // Other materials go directly into player inventory + show toast
        const directGains = [];
        for (const k of ['scrap', 'explosives', 'electronics']) {
          if (drops[k] > 0) {
            this.resources[k] = (this.resources[k] || 0) + drops[k];
            directGains.push(`+${drops[k]} ${MATERIALS[k].icon}`);
          }
        }
        if (directGains.length) this.hud.toastMessage(directGains.join(' '), 'good');
        if (this._pityToastQueued) {
          const { key, amount } = this._pityToastQueued;
          this.hud.toastMessage(`★ LUCKY +${amount} ${MATERIALS[key].icon}`, 'good');
          this._pityToastQueued = null;
        }
        z.destroy();
        this.zombies.splice(i, 1);
        this.playerKills += 1;
        Sfx.zombieDeath();
        continue;
      }
      // Zombies ALWAYS target the generator — player is now a free defender.
      // (Fallback to player only if generator already destroyed.)
      const target = (this.generator && this.generator.alive) ? this.generator : this.player;
      z.update(dt, target, walls);
      // Generator contact damage (only zombies that can do melee)
      if (this.generator && this.generator.alive && !z.def.isRanged) {
        const dx = z.x - this.generator.x, dy = z.y - this.generator.y;
        const d = Math.hypot(dx, dy);
        if (d < this.generator.radius + z.radius) {
          // Damage generator at attack interval (reuse zombie.contactT)
          z.contactT += dt;
          if (z.contactT > 0.6) {
            this.generator.takeDamage(z.damage * 0.7);
            z.contactT = 0;
            Sfx.generatorHit();
          }
        }
      }
      // Spitter shoots at chosen target (player or generator)
      if (z.wantsToSpit) {
        const aim = Math.atan2(target.y - z.y, target.x - z.x);
        this._spawnAcidBall(z.x, z.y, aim, z.def.projectileSpeed, z.def.projectileDamage);
        z.wantsToSpit = null;
        Sfx.acidSpit();
      }
      // Screamer summons walkers around it
      if (z.wantsToScream) {
        z.wantsToScream = false;
        // visual scream ring
        this._spawnRing(z.x, z.y, 80, 0xff3aa1);
        Sfx.zombieDeath();
        for (let i = 0; i < z.def.summonsPerScream; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = 40 + Math.random() * 30;
          this._spawnZombieAt(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 'walker');
        }
      }
      // cloakers fade based on PLAYER view, not target
      z.syncVisual(dt, this.player);
    }
  }

  _spawnZombie() {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    const M = 20;
    if (edge === 0)      { x = Math.random() * this.world.width; y = M; }
    else if (edge === 1) { x = Math.random() * this.world.width; y = this.world.height - M; }
    else if (edge === 2) { x = M; y = Math.random() * this.world.height; }
    else                 { x = this.world.width - M; y = Math.random() * this.world.height; }
    const type = pickZombieType(this.nightIdx);
    this._spawnZombieAt(x, y, type);
    // Tell the World to pulse the nearest portal — visual feedback that
    // "the zombies came from over there".
    if (this.world.pingNearestPortal) this.world.pingNearestPortal(x, y);
  }

  _spawnZombieAt(x, y, type) {
    const z = new Zombie({ x, y, type, tier: this.nightIdx });
    // Apply difficulty scaling (easy=0.55, normal=1, hard=1.4) — default = easy
    // Default matches the HTML's pre-active button and waveLineup default.
    const diff = localStorage.getItem('pugfort:difficulty') || 'normal';
    const mult = diff === 'easy' ? 0.55 : diff === 'hard' ? 1.4 : 1.0;
    z.hp *= mult;
    z.maxHp *= mult;
    if (z.damage != null) z.damage *= mult;
    this.zombies.push(z);
    this.world.entitiesLayer.addChild(z.container);
  }

  // Per-zombie-type drop table. Wood drops as a log; rest go to inventory.
  // Boosted non-wood rates so walker-heavy Night 1 actually drops scrap.
  _dropsForZombie(z) {
    const t = z.type;
    const r = Math.random;
    const drops = { wood: 0, scrap: 0, explosives: 0, electronics: 0 };
    if (t === 'walker')        { drops.wood = 1 + Math.floor(r() * 2); if (r() < 0.25) drops.scrap = 1 + Math.floor(r() * 2); }
    else if (t === 'runner')   { drops.wood = 1; if (r() < 0.65) drops.scrap = 1 + Math.floor(r() * 2); }
    else if (t === 'tank')     { drops.wood = 2 + Math.floor(r() * 2); drops.scrap = 2; if (r() < 0.50) drops.electronics = 1; }
    else if (t === 'spitter')  { drops.wood = 1; drops.scrap = 1 + Math.floor(r() * 2); if (r() < 0.85) drops.electronics = 1; }
    else if (t === 'exploder') { drops.wood = 1; drops.explosives = 2 + Math.floor(r() * 2); if (r() < 0.30) drops.scrap = 1; }
    else if (t === 'screamer') { drops.wood = 2; drops.scrap = 1 + Math.floor(r() * 2); if (r() < 0.55) drops.explosives = 1; }
    else if (t === 'digger')   { drops.wood = 2; drops.scrap = 1 + Math.floor(r() * 2); if (r() < 0.30) drops.electronics = 1; }
    else if (t === 'cloaker')  { drops.wood = 1; if (r() < 0.80) drops.electronics = 1; if (r() < 0.30) drops.scrap = 1; }
    return drops;
  }

  // Pity-drop helper — every Nth kill, the player's lowest-stockpile resource
  // is bumped at the kill site so a run never starves on one material.
  _maybePityDrop(z, drops) {
    this._killStreak += 1;
    if (this._killStreak % this._pityInterval !== 0) return;
    // Find lowest of the 4 tracked resources
    const keys = ['wood', 'scrap', 'explosives', 'electronics'];
    let lo = keys[0];
    for (const k of keys) {
      if ((this.resources[k] || 0) < (this.resources[lo] || 0)) lo = k;
    }
    const bonus = lo === 'wood' ? (2 + Math.floor(Math.random() * 2)) : (1 + Math.floor(Math.random() * 2));
    drops[lo] = (drops[lo] || 0) + bonus;
    this._pityToastQueued = { key: lo, amount: bonus };
  }

  _spawnBoss() {
    this.bossSpawned = true;
    // pick spawn edge opposite the player
    const cx = this.world.width / 2;
    const cy = this.world.height / 2;
    const angleAway = Math.atan2(cy - this.player.y, cx - this.player.x);
    const spawnDist = 600;
    const bx = Math.max(80, Math.min(this.world.width - 80, cx + Math.cos(angleAway) * spawnDist));
    const by = Math.max(80, Math.min(this.world.height - 80, cy + Math.sin(angleAway) * spawnDist));
    this.boss = new Boss({ x: bx, y: by });
    this.world.entitiesLayer.addChild(this.boss.container);
    this.hud.showBoss(this.boss);
    // CINEMATIC INTRO — big toast, screen flash, sound
    this.hud.toastMessage(`👑 THE KENNEL KING HAS RISEN 👑`, 'warn');
    Sfx.lose(); // dramatic descending tone as intro stinger
    setTimeout(() => Sfx.phaseNight(), 600);
    // multiple screen-shake style toasts spread over a beat
    setTimeout(() => this.hud.toastMessage('PROTECT THE GENERATOR', 'warn'), 800);
  }

  _bossStomp(x, y) {
    Sfx.explosion();
    this._screenShake(8, 0.32);
    const radius = 220;
    const damage = 50;
    // visual ring
    this._spawnRing(x, y, radius, COLORS.zombieEye);
    this._spawnRing(x, y, radius * 0.6, 0xff8a8a);
    // damage + knockback player
    if (this.player.alive) {
      const dx = this.player.x - x, dy = this.player.y - y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        const k = 1 - d / radius;
        this.player.takeDamage(damage * k);
        if (d > 1) {
          this.player.vx += (dx / d) * 500 * k;
          this.player.vy += (dy / d) * 500 * k;
        }
        this.hud.toastMessage(`🦶 STOMP -${Math.round(damage * k)} HP`, 'warn');
      }
    }
    // damage walls in radius
    for (const w of [...this.build.placed]) {
      const wx = w.cx ?? (w.x + (w.width || 0) / 2);
      const wy = w.cy ?? (w.y + (w.height || 0) / 2);
      const dx = wx - x, dy = wy - y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        if (w.hp != null) {
          w.hp -= damage * 0.6 * (1 - d / radius);
          if (w.hp <= 0) this.build.removePlaced(w);
        }
      }
    }
  }

  _bossDeath(boss) {
    Sfx.win();
    this._screenShake(8, 0.5);
    this.hud.toastMessage(`👑 KENNEL KING SLAIN`, 'good');
    // big explosion + many drops
    this._spawnRing(boss.x, boss.y, 300, COLORS.neonYellow);
    this._spawnRing(boss.x, boss.y, 220, 0xff8a3a);
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const dst = 30 + Math.random() * 80;
      this.wood.spawnAt(boss.x + Math.cos(a) * dst, boss.y + Math.sin(a) * dst, 2 + Math.floor(Math.random() * 3));
    }
    // Big material bonus
    this.resources.scrap += 25;
    this.resources.explosives += 12;
    this.resources.electronics += 10;
    this.hud.toastMessage('+25 🔩 +12 💣 +10 🔌', 'good');
    this._spawnDeathPoof(boss.x, boss.y, 0xc8281f);
    boss.destroy();
    // Boss death = instantly win the night (kills all remaining zombies).
    // In endless mode we let the player keep going indefinitely; the boss
    // becomes a milestone rather than a win condition.
    for (const z of this.zombies) z.alive = false;
    if (!this._endless) this.nightsSurvived = TOTAL_NIGHTS; // triggers SUCH SURVIVAL on next check
    else this.hud.toastMessage('★ BOSS DEFEATED — ENDLESS MODE CONTINUES ★', 'good');
  }

  _spawnRing(x, y, targetR, color = COLORS.neonCyan) {
    const ring = new Graphics();
    ring.x = x; ring.y = y;
    this.world.effectsLayer.addChild(ring);
    let t = 0; const life = 0.5;
    const animate = () => {
      t += 1 / 60;
      const k = t / life;
      ring.clear();
      ring.circle(0, 0, 10 + (targetR - 10) * k).stroke({ color, width: 4 * (1 - k), alpha: 1 - k });
      if (t < life) requestAnimationFrame(animate);
      else ring.destroy();
    };
    requestAnimationFrame(animate);
  }

  // ---------- Explosions ----------
  _explode(zombie) {
    Sfx.explosion();
    this._screenShake(6, 0.28);
    const x = zombie.x, y = zombie.y;
    const r = zombie.def.explodeRadius;
    const dmg = zombie.def.explodeDamage;
    // Visual: big orange ring + particles + flash
    const ring = new Graphics();
    ring.x = x; ring.y = y;
    this.world.effectsLayer.addChild(ring);
    let t = 0; const life = 0.45;
    const animate = () => {
      t += 1/60;
      const k = t / life;
      ring.clear();
      ring.circle(0, 0, 5 + (r - 5) * k).stroke({ color: 0xff8a3a, width: 4 * (1 - k), alpha: 1 - k });
      ring.circle(0, 0, 3 + (r - 5) * k * 0.7).fill({ color: 0xffd23f, alpha: (1 - k) * 0.4 });
      if (t < life) requestAnimationFrame(animate);
      else ring.destroy();
    };
    requestAnimationFrame(animate);
    // Sparks
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 200 + Math.random() * 200;
      const g = new Graphics();
      const c = [0xff8a3a, 0xffd23f, 0xff3a3a, 0xffffff][Math.floor(Math.random() * 4)];
      g.rect(-3, -3, 6, 6).fill(c);
      g.x = x; g.y = y;
      this.world.effectsLayer.addChild(g);
      let life2 = 0.5 + Math.random() * 0.3;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      const tick = () => {
        if (life2 <= 0) { g.destroy(); return; }
        life2 -= 1/60;
        g.x += vx / 60; g.y += vy / 60;
        g.alpha = Math.max(0, life2 / 0.8);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    // Damage player if in radius
    const dx = this.player.x - x, dy = this.player.y - y;
    const d = Math.hypot(dx, dy);
    if (d < r && this.player.alive) {
      const k = 1 - d / r;
      this.player.takeDamage(dmg * k);
      // knockback
      if (d > 1) {
        this.player.vx += (dx / d) * 400 * k;
        this.player.vy += (dy / d) * 400 * k;
      }
      this.hud.toastMessage(`💥 -${Math.round(dmg * k)} HP`, 'warn');
    }
    // Damage nearby zombies too (chain reaction is funny)
    for (const other of this.zombies) {
      if (other === zombie || !other.alive) continue;
      const ox = other.x - x, oy = other.y - y;
      const od = Math.hypot(ox, oy);
      if (od < r) {
        const k = 1 - od / r;
        other.takeDamage(dmg * k * 0.5);
      }
    }
  }

  // Tiny brown rectangular splinters fly outward — used on every wall-chew tick.
  // Count default = 5 (fast spam-safe); set higher when a wall finally breaks.
  _spawnWoodSplinters(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const wcols = [0x8a5a2c, 0xb87a40, 0x6a3a1c, 0xc8a878];
      const c = wcols[Math.floor(Math.random() * wcols.length)];
      g.rect(-2, -1, 4, 2).fill(c);
      g.rect(-2, -1, 1, 1).fill(0xffffff);
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI * 2;
      this.world.effectsLayer.addChild(g);
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 90;
      const vx = Math.cos(ang) * sp;
      const vy = Math.sin(ang) * sp - 40;
      let life = 0.5 + Math.random() * 0.25, t = 0;
      const rotv = (Math.random() - 0.5) * 12;
      const gravity = 320;
      const tick = () => {
        t += 1 / 60;
        if (t >= life) { g.destroy(); return; }
        g.x += vx / 60;
        g.y += (vy + gravity * t) / 60;
        g.rotation += rotv / 60;
        g.alpha = Math.max(0, 1 - t / life);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  _spawnDeathPoof(x, y, color = COLORS.zombieGreen) {
    // Bumped from 10 → 14 sparks + 3 dust puffs for a chunkier kill burst.
    for (let i = 0; i < 14; i++) {
      const g = new Graphics();
      const angle = Math.random() * Math.PI * 2;
      const sp = 90 + Math.random() * 160;
      const c = [color, COLORS.bloodRed, COLORS.zombieEye, 0xffffff][Math.floor(Math.random() * 4)];
      // Larger sparks every 4th particle add visual weight.
      if (i % 4 === 0) {
        g.rect(-3, -3, 6, 6).fill(c);
        g.rect(-1, -1, 2, 2).fill(0xffffff);
      } else {
        g.rect(-2, -2, 4, 4).fill(c);
      }
      g.x = x; g.y = y;
      this.world.effectsLayer.addChild(g);
      const vx = Math.cos(angle) * sp;
      const vy = Math.sin(angle) * sp - 30;
      let life = 0.6 + Math.random() * 0.4;
      const gravity = 240;
      const tick = () => {
        if (life <= 0) { g.destroy(); return; }
        life -= 1 / 60;
        g.x += vx / 60;
        g.y += vy / 60;
        g.alpha = Math.max(0, life / 0.8);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    // Three soft dust puffs that expand + fade — gives the kill spot
    // a lingering ground impact instead of just sparks vanishing.
    for (let i = 0; i < 3; i++) {
      const puff = new Graphics();
      puff.x = x + (Math.random() - 0.5) * 12;
      puff.y = y + (Math.random() - 0.5) * 6;
      this.world.effectsLayer.addChildAt(puff, 0);
      let pl = 0.55, pt = 0;
      const startR = 4 + Math.random() * 3, endR = 16 + Math.random() * 6;
      const tick = () => {
        pt += 1 / 60;
        if (pt >= pl) { puff.destroy(); return; }
        const k = pt / pl;
        const r = startR + (endR - startR) * k;
        puff.clear();
        puff.circle(0, 0, r).fill({ color: 0x8a7a52, alpha: (1 - k) * 0.55 });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // ---------- Acid balls (Spitter projectiles) ----------
  _spawnAcidBall(x, y, angle, speed = 280, damage = 18) {
    const g = new Graphics();
    g.x = x; g.y = y;
    g.circle(0, 0, 6).fill(0x6aaa3a);
    g.circle(0, 0, 4).fill(0x9af09a);
    g.circle(-1, -1, 1.5).fill(0xffffff);
    this.world.effectsLayer.addChild(g);
    this.acidBalls.push({
      g, x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage,
      lifetime: 2.5,
      trail: 0,
    });
  }

  _updateAcidBalls(dt) {
    for (let i = this.acidBalls.length - 1; i >= 0; i--) {
      const b = this.acidBalls[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.lifetime -= dt;
      b.g.x = b.x; b.g.y = b.y;
      b.trail += dt;
      // small drip trail
      if (b.trail > 0.04) {
        b.trail = 0;
        const drip = new Graphics();
        drip.circle(0, 0, 3).fill({ color: 0x6aaa3a, alpha: 0.5 });
        drip.x = b.x; drip.y = b.y;
        this.world.effectsLayer.addChild(drip);
        setTimeout(() => drip.destroy(), 250);
      }
      let hit = false;
      // wall collision
      for (const w of this.build.placed) {
        if (b.x >= w.x && b.x <= w.x + w.width && b.y >= w.y && b.y <= w.y + w.height) {
          this._splashAcid(b.x, b.y);
          hit = true; break;
        }
      }
      // player hit
      if (!hit && this.player.alive) {
        const dx = b.x - this.player.x, dy = b.y - this.player.y;
        if (dx * dx + dy * dy < (this.player.radius + 6) * (this.player.radius + 6)) {
          this.player.takeDamage(b.damage);
          this._splashAcid(b.x, b.y);
          hit = true;
        }
      }
      if (hit || b.lifetime <= 0 ||
          b.x < 0 || b.x > this.world.width || b.y < 0 || b.y > this.world.height) {
        b.g.destroy();
        this.acidBalls.splice(i, 1);
      }
    }
  }

  _splashAcid(x, y) {
    const splash = new Graphics();
    splash.x = x; splash.y = y;
    splash.circle(0, 0, 12).fill({ color: 0x6aaa3a, alpha: 0.55 });
    this.world.effectsLayer.addChild(splash);
    setTimeout(() => splash.destroy(), 350);
  }

  // ---------- Turret AI ----------
  _updateTurrets(dt) {
    for (const t of this.build.placed) {
      // turret/sniper handled below — also acidTurret and flamethrower share
      // the auto-rotating-target-and-fire shape.
      if (t.id !== 'turret' && t.id !== 'sniperTurret' && t.id !== 'acidTurret' && t.id !== 'flamethrower') continue;
      // find nearest alive zombie in range
      let nearest = null, nearestD2 = (t.def.range || 280) ** 2;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const dx = z.x - t.cx, dy = z.y - t.cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD2) { nearestD2 = d2; nearest = z; }
      }
      if (nearest) {
        const aim = Math.atan2(nearest.y - t.cy, nearest.x - t.cx);
        // Ease toward target — separate gains for "snap to a new target" (fast)
        // and "track a moving target" (smoother). Sniper turrets ease slower so
        // they feel deliberate and heavy.
        let dA = aim - t.rotation;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        const isSniper = t.id === 'sniperTurret';
        const easeRate = isSniper ? 6 : 8;
        t.rotation += dA * Math.min(1, easeRate * dt);
        t.mesh.rotation = t.rotation;
        t.fireCd -= dt;
        if (t.fireCd <= 0 && Math.abs(dA) < 0.3) {
          t.fireCd = t.def.fireCooldown;
          const muzzleX = t.cx + Math.cos(t.rotation) * 22;
          const muzzleY = t.cy + Math.sin(t.rotation) * 22;
          // ACID TURRET — lob an acid blob that creates a lingering pool on impact.
          if (t.def.isAcid) {
            this._spawnAcidShot(muzzleX, muzzleY, t.rotation, t.def);
          } else if (t.def.isFlame) {
            // FLAMETHROWER — short bright projectile + add a brief flame patch.
            this.projectiles.spawn({
              x: muzzleX, y: muzzleY,
              vx: Math.cos(t.rotation) * t.def.projectileSpeed,
              vy: Math.sin(t.rotation) * t.def.projectileSpeed,
              damage: t.def.damage,
              lifetime: 0.35,
              color: 0xff8a3a,
            });
          } else {
            this.projectiles.spawn({
              x: muzzleX, y: muzzleY,
              vx: Math.cos(t.rotation) * t.def.projectileSpeed,
              vy: Math.sin(t.rotation) * t.def.projectileSpeed,
              damage: t.def.damage,
              color: COLORS.neonCyan,
            });
          }
          this._spawnMuzzleFlash(muzzleX, muzzleY, t.rotation);
          Sfx.turretFire();
        }
      } else {
        t.fireCd = Math.max(0, t.fireCd - dt);
      }
    }
    // Update lingering acid pools (spawned by acidTurret hits).
    this._updateAcidPools(dt);
  }

  // Acid blob — a slow heavy projectile that creates a damaging pool on contact.
  _spawnAcidShot(x, y, angle, def) {
    if (!this._acidShots) this._acidShots = [];
    const g = new Graphics();
    g.x = x; g.y = y;
    g.circle(0, 0, 7).fill(0x6aaa3a);
    g.circle(0, 0, 4).fill(0x9af09a);
    g.circle(-1, -1, 1.5).fill(0xffffff);
    this.world.effectsLayer.addChild(g);
    this._acidShots.push({
      g, x, y,
      vx: Math.cos(angle) * def.projectileSpeed,
      vy: Math.sin(angle) * def.projectileSpeed,
      damage: def.damage,
      lifetime: 1.5,
      def,
    });
  }

  _updateAcidPools(dt) {
    // Move + collide acid blobs first.
    if (this._acidShots) {
      for (let i = this._acidShots.length - 1; i >= 0; i--) {
        const b = this._acidShots[i];
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.g.x = b.x; b.g.y = b.y;
        b.lifetime -= dt;
        let hit = false;
        for (const z of this.zombies) {
          if (!z.alive) continue;
          const dx = z.x - b.x, dy = z.y - b.y;
          if (dx * dx + dy * dy < (z.radius + 8) * (z.radius + 8)) {
            const pa = Math.atan2(b.vy, b.vx);
            z.takeDamage(b.damage, pa);
            hit = true; break;
          }
        }
        if (!hit) {
          for (const w of this.build.placed) {
            if (b.x >= w.x && b.x <= w.x + w.width && b.y >= w.y && b.y <= w.y + w.height) {
              hit = true; break;
            }
          }
        }
        if (hit || b.lifetime <= 0) {
          // spawn lingering pool at impact site
          this._spawnAcidPool(b.x, b.y, b.def);
          b.g.destroy();
          this._acidShots.splice(i, 1);
        }
      }
    }
    // Active acid pools — damage zombies standing in them.
    if (!this._acidPools) this._acidPools = [];
    for (let i = this._acidPools.length - 1; i >= 0; i--) {
      const p = this._acidPools[i];
      p.life -= dt;
      const a = Math.max(0, p.life / p.maxLife);
      if (p.g) p.g.alpha = 0.35 + 0.35 * a;
      for (const z of this.zombies) {
        if (!z.alive) continue;
        const dx = z.x - p.x, dy = z.y - p.y;
        if (dx * dx + dy * dy < p.radius * p.radius) {
          z.takeDamage(p.dps * dt);
        }
      }
      if (p.life <= 0) {
        if (p.g) p.g.destroy();
        this._acidPools.splice(i, 1);
      }
    }
  }

  _spawnAcidPool(x, y, def) {
    const r = def.acidPoolRadius || 60;
    const g = new Graphics();
    g.x = x; g.y = y;
    g.circle(0, 0, r).fill({ color: 0x6aaa3a, alpha: 0.55 });
    g.circle(0, 0, r * 0.7).fill({ color: 0x9af09a, alpha: 0.4 });
    // a few darker speckles for texture
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r * 0.8;
      g.circle(Math.cos(a) * d, Math.sin(a) * d, 2).fill({ color: 0x3a6a1a, alpha: 0.6 });
    }
    this.world.effectsLayer.addChildAt(g, 0);
    if (!this._acidPools) this._acidPools = [];
    this._acidPools.push({
      g, x, y,
      radius: r,
      dps: def.acidPoolDps || 14,
      life: def.acidPoolDur || 3.0,
      maxLife: def.acidPoolDur || 3.0,
    });
  }

  // ---------- Projectiles ----------
  _updateProjectiles(dt) {
    // Combine zombies + boss into one targets array so player bullets can hit both
    const targets = this.boss && this.boss.alive
      ? [...this.zombies, this.boss]
      : this.zombies;
    this.projectiles.update(dt, targets, this.build.placed,
      (p, z) => {
        // Pass projectile travel angle so shielded zombies can block frontals.
        const pa = Math.atan2(p.vy, p.vx);
        z.takeDamage(p.damage, pa);
        if (z === this.boss) Sfx.zombieHit();
      },
      (p, w) => { /* could damage wall */ });
  }

  // ---------- Build ----------
  _updateBuild() {
    const buildHotkeys = ['wall', 'sandbag', 'spike', 'mine', 'turret', 'sniperTurret', 'repair', 'acidTurret', 'genShield', 'flamethrower'];
    if (this.input.takeOnePress())   { this.build.toggle(buildHotkeys[0]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeTwoPress())   { this.build.toggle(buildHotkeys[1]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeThreePress()) { this.build.toggle(buildHotkeys[2]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeFourPress())  { this.build.toggle(buildHotkeys[3]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeFivePress())  { this.build.toggle(buildHotkeys[4]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeSixPress())   { this.build.toggle(buildHotkeys[5]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeSevenPress()) { this.build.toggle(buildHotkeys[6]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeEightPress?.()) { this.build.toggle(buildHotkeys[7]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeNinePress?.())  { this.build.toggle(buildHotkeys[8]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeZeroPress?.())  { this.build.toggle(buildHotkeys[9]); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeBPress())     { this.build.toggle('wall'); this.hud.setBuildActive(!!this.build.selected, this.build.selected); }
    if (this.input.takeEscPress())   { this.build.cancel(); this.hud.setBuildActive(false); }
    if (this.input.takeQPress()) this.build.rotate(-Math.PI / 8);
    if (this.input.takeEPress()) this.build.rotate(Math.PI / 8);
    // R-key is dual-purpose: when in build mode it snaps rotation 90°; outside
    // build mode it triggers REPAIR ALL on damaged structures.
    if (this.input.takeRPress()) {
      if (this.build.selected) this.build.rotate(Math.PI / 2);
      else this._repairAllWalls();
    }
    if (!this.build.selected) return;

    const screen = this.input.mouse;
    const cam = this.app.stage;
    const wx = (screen.screenX - cam.x) / cam.scale.x;
    const wy = (screen.screenY - cam.y) / cam.scale.y;
    const def = BUILDABLES[this.build.selected];
    const affordable = canAfford(this.resources, def.cost);
    this.build.update({ x: wx, y: wy }, affordable);

    if (this.input.takeClick()) {
      if (!affordable) {
        this.hud.toastMessage(`Need ${costString(def.cost)}`, 'warn');
        return;
      }
      this.build.placeAt({ x: wx, y: wy });
      spend(this.resources, def.cost);
      Sfx.buildPlace();
      const labels = {
        wall: '🧱 Wall placed', sandbag: '🟫 Sandbag dropped',
        spike: '⚔️ Spikes armed', mine: '💣 Mine planted',
        turret: '🔫 Turret deployed', sniperTurret: '🎯 Sniper deployed',
        repair: '➕ Repair bay built',
      };
      this.hud.toastMessage(labels[this.build.selected] || 'Built!', 'good');
      if (this.build.selected === 'wall' || this.build.selected === 'sandbag') this.wallsBuilt += 1;
      if (this.build.selected === 'turret' || this.build.selected === 'sniperTurret') this.turretsBuilt += 1;
    }
  }

  // Per-frame logic for spike traps, mines, repair bays
  _updateBuildables(dt) {
    for (let i = this.build.placed.length - 1; i >= 0; i--) {
      const p = this.build.placed[i];
      // HP-tier visual refresh (clean / cracked / smoking) — early-outs if
      // tier didn't change since last frame.
      this.build.refreshDamage(p);
      // Auto-cull buildings that fall below 0 HP from any damage source.
      if (p.hp != null && p.hp <= 0) {
        this.build.removePlaced(p);
        continue;
      }
      // Zombies adjacent to a wall/turret chew it down. Without this, walls
      // were effectively invincible against regular zombies — boss was the
      // only thing that hurt them, so the new damage tiers never appeared.
      if (!p.def.isRepair && !p.def.isMine && !p.def.isTrap) {
        for (const z of this.zombies) {
          if (!z.alive || z.def.isRanged) continue;
          // Quick AABB overlap test — zombie center within wall bbox (slop=zombie radius)
          const r = z.radius || 14;
          if (z.x >= p.x - r && z.x <= p.x + p.width + r &&
              z.y >= p.y - r && z.y <= p.y + p.height + r) {
            z._wallChewT = (z._wallChewT || 0) + dt;
            if (z._wallChewT > 0.6) {
              z._wallChewT = 0;
              p.hp -= z.damage * 0.5;
              // Wood-splinter burst at the impact point so each chew reads.
              this._spawnWoodSplinters(z.x, z.y);
              if (p.hp <= 0) {
                this.build.removePlaced(p);
                // Bigger burst + small shake when a wall finally breaks.
                this._spawnWoodSplinters(p.cx ?? (p.x + p.width / 2), p.cy ?? (p.y + p.height / 2), 12);
                this._screenShake(3, 0.16);
                break;
              }
            }
          } else if (z._wallChewT) {
            z._wallChewT = 0;
          }
        }
      }
      if (p.def.isTrap) {
        // damage zombies standing on it
        for (const z of this.zombies) {
          if (!z.alive) continue;
          if (z.x >= p.x && z.x <= p.x + p.width && z.y >= p.y && z.y <= p.y + p.height) {
            z.takeDamage(p.def.trapDps * dt);
          }
        }
      } else if (p.def.isMine) {
        // trigger if any zombie within mineTrigger
        let triggered = null;
        for (const z of this.zombies) {
          if (!z.alive) continue;
          const dx = z.x - p.cx, dy = z.y - p.cy;
          if (dx * dx + dy * dy < (p.def.mineTrigger + (z.radius || 14)) ** 2) { triggered = z; break; }
        }
        if (triggered) {
          this._mineExplode(p);
          this.build.removePlaced(p);
        }
      } else if (p.def.isRepair) {
        // heal player if within radius
        const dx = this.player.x - p.cx, dy = this.player.y - p.cy;
        if (dx * dx + dy * dy < p.def.healRadius * p.def.healRadius) {
          this.player.heal(p.def.healRate * dt);
        }
      }
    }
  }

  _mineExplode(mine) {
    Sfx.explosion();
    this._screenShake(5, 0.22);
    const x = mine.cx, y = mine.cy;
    const r = mine.def.mineRadius;
    const dmg = mine.def.mineDamage;
    this._spawnRing(x, y, r, COLORS.neonOrange);
    this._spawnRing(x, y, r * 0.6, COLORS.neonYellow);
    // damage zombies in radius
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const dx = z.x - x, dy = z.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r) {
        const k = 1 - d / r;
        z.takeDamage(dmg * k);
      }
    }
    // damage boss too
    if (this.boss && this.boss.alive) {
      const dx = this.boss.x - x, dy = this.boss.y - y;
      const d = Math.hypot(dx, dy);
      if (d < r) this.boss.takeDamage(dmg * (1 - d / r));
    }
    // particles
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 180 + Math.random() * 180;
      const g = new Graphics();
      const c = [0xff8a3a, 0xffd23f, 0xff3a3a, 0xffffff][Math.floor(Math.random() * 4)];
      g.rect(-3, -3, 6, 6).fill(c);
      g.x = x; g.y = y;
      this.world.effectsLayer.addChild(g);
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      let life = 0.5;
      const tick = () => {
        if (life <= 0) { g.destroy(); return; }
        life -= 1 / 60;
        g.x += vx / 60; g.y += vy / 60;
        g.alpha = Math.max(0, life / 0.7);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  _updateWood(dt) { this.wood.update(dt); }

  // Resource depot foraging — only active during the DAY phase. Stand next to
  // a depot for 1.5s to drain it (gives the player a goal between waves).
  _updateDepots(dt) {
    if (this.phase !== 'day') {
      this._depotProgressT = 0;
      this._depotCurrent = null;
      return;
    }
    if (!this.player.alive || !this.world.depotAt) return;
    const d = this.world.depotAt(this.player.x, this.player.y);
    if (!d) {
      this._depotProgressT = 0;
      this._depotCurrent = null;
      return;
    }
    if (this._depotCurrent !== d) {
      this._depotCurrent = d;
      this._depotProgressT = 0;
      this.hud.toastMessage(`Foraging ${d.kind}...`, 'good');
    }
    this._depotProgressT = (this._depotProgressT || 0) + dt;
    if (this._depotProgressT >= 1.5) {
      const result = this.world.drainDepot(d);
      if (result) {
        const key = result.kind;
        this.resources[key] = (this.resources[key] || 0) + result.amount;
        this.hud.toastMessage(`+${result.amount} ${MATERIALS[key].icon} from depot!`, 'good');
        this._spawnDepotPop(d.x, d.y, key, result.amount);
        Sfx.woodCollect?.();
      }
      this._depotProgressT = 0;
      this._depotCurrent = null;
    }
  }

  _spawnDepotPop(x, y, key, amount) {
    // Tiny burst of pickup particles + flying number
    const colors = { wood: 0xc8a878, scrap: 0xc8c8d0, electronics: 0xffd23f, explosives: 0xff5a3a };
    const c = colors[key] || 0xffffff;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = 80 + Math.random() * 40;
      const g = new Graphics();
      g.rect(-2, -2, 4, 4).fill(c);
      g.x = x; g.y = y;
      this.world.effectsLayer.addChild(g);
      let life = 0.6, t = 0;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp - 30;
      const tick = () => {
        t += 1 / 60;
        if (t >= life) { g.destroy(); return; }
        g.x += vx / 60; g.y += vy / 60;
        g.alpha = Math.max(0, 1 - t / life);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // Repair-all-walls (R key) — spends materials proportional to total damage
  // across all placed buildables. Skips if nothing damaged.
  _repairAllWalls() {
    let totalDamage = 0;
    const repairable = [];
    for (const p of this.build.placed) {
      if (p.hp == null || p.maxHp == null) continue;
      const missing = Math.max(0, p.maxHp - p.hp);
      if (missing > 0.5) {
        totalDamage += missing;
        repairable.push({ p, missing });
      }
    }
    if (totalDamage <= 0) {
      this.hud.toastMessage('All buildings already at full HP.', 'good');
      return;
    }
    // Cost: 1 wood per 10 HP repaired (rounded up); +1 scrap per 50 HP
    const woodCost = Math.ceil(totalDamage / 10);
    const scrapCost = Math.ceil(totalDamage / 50);
    if ((this.resources.wood || 0) < woodCost || (this.resources.scrap || 0) < scrapCost) {
      this.hud.toastMessage(`Need ${woodCost}🪵 ${scrapCost}🔩 to repair all`, 'warn');
      return;
    }
    this.resources.wood -= woodCost;
    this.resources.scrap -= scrapCost;
    for (const { p } of repairable) {
      p.hp = p.maxHp;
      this.build.refreshDamage(p);
    }
    this.hud.toastMessage(`✚ REPAIRED ${repairable.length} structures (-${woodCost}🪵 -${scrapCost}🔩)`, 'good');
    Sfx.buildPlace?.();
  }

  _updateCamera() {
    const cam = this.app.stage;
    const screen = this.app.screen;
    const scale = cam.scale.x; // accounts for zoom
    const px = this.player.x, py = this.player.y;
    let camX = -px * scale + screen.width / 2;
    let camY = -py * scale + screen.height / 2;
    // clamp to world bounds (in screen-space, so multiply by scale)
    camX = Math.min(0, Math.max(-this.world.width * scale + screen.width, camX));
    camY = Math.min(0, Math.max(-this.world.height * scale + screen.height, camY));
    // Screen shake — small camera offset (HUD is DOM, unaffected)
    if (this.shakeT > 0) {
      const dt = this._lastDt || 1 / 60;
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeMag = 0;
      const k = Math.max(0, this.shakeT) * (this.shakeMag || 0);
      camX += (Math.random() - 0.5) * k;
      camY += (Math.random() - 0.5) * k;
    }
    cam.x = camX;
    cam.y = camY;
  }

  _updateHud() {
    this.hud.updatePlayer(this.player);
    this.hud.updateResources(this.resources, this.playerKills);
    const showNight = this.phase === 'night' ? this.nightIdx : Math.min(TOTAL_NIGHTS, this.nightIdx + 1);
    this.hud.updatePhase(this.phase, showNight, TOTAL_NIGHTS, this.phaseT / this.phaseTotal);
    this.hud.updatePhaseTime(this.phaseTotal - this.phaseT);
    if (this.generator) this.hud.updateGenerator(this.generator);
    if (this.boss) this.hud.updateBoss(this.boss);
    else this.hud.hideBoss();
    this.world.setPhaseTint(this.phase, this.phaseT / this.phaseTotal);
    // Player damage shake — detect HP drop frame-over-frame
    if (this.player && this.player.alive) {
      const drop = this._lastPlayerHp - this.player.hp;
      if (drop > 0.5) this._screenShake(Math.min(6, 3 + drop * 0.1), 0.2);
      this._lastPlayerHp = this.player.hp;
    }
    // Generator hit shake — detect HP drop
    if (this.generator && this.generator.alive) {
      if (this._lastGenHp == null) this._lastGenHp = this.generator.hp;
      const gDrop = this._lastGenHp - this.generator.hp;
      if (gDrop > 0.5) this._screenShake(Math.min(7, 4 + gDrop * 0.05), 0.22);
      this._lastGenHp = this.generator.hp;
    }
    // Critical HUD pulses — low player HP + low generator HP. Pass the in-band
    // ratio (0 at critical-low, 1 at edge) so the pulse intensifies as HP drops.
    if (this.player && this.player.alive) {
      const phpRatio = this.player.hp / this.player.maxHp;
      const playerCrit = phpRatio < 0.25;
      this.hud.setPlayerCritical(playerCrit, playerCrit ? (phpRatio / 0.25) : undefined);
    } else this.hud.setPlayerCritical(false);
    if (this.generator && this.generator.alive) {
      const ghpRatio = this.generator.hp / this.generator.maxHp;
      const genCrit = ghpRatio < 0.3;
      this.hud.setGenCritical(genCrit, genCrit ? (ghpRatio / 0.3) : undefined);
    } else this.hud.setGenCritical(false);
    // Wave banner ticker (DOM-driven, fade controlled by CSS animation)
  }

  _checkEndConditions() {
    if (!this.player.alive) {
      // Final-frame freeze (0.12s hitstop + screen-shake spike) before end
      // overlay — the death feels like AN EVENT, not just a state flip.
      if (!this._deathFreezeFired) {
        this._deathFreezeFired = true;
        this._hitstopT = 0.25;
        this._screenShake(10, 0.45);
        setTimeout(() => this._endMatch(false, 'YOU GOT BONKED'), 320);
        return;
      }
      return;
    }
    if (this.generator && !this.generator.alive) {
      if (!this._genDeathFreezeFired) {
        this._genDeathFreezeFired = true;
        this._hitstopT = 0.2;
        this._screenShake(10, 0.4);
        setTimeout(() => this._endMatch(false, 'GENERATOR DESTROYED'), 320);
        return;
      }
      return;
    }
    if (!this._endless && this.nightsSurvived >= TOTAL_NIGHTS) { this._endMatch(true); }
  }

  _endMatch(won, loseReason = null) {
    if (!this.running) return;
    this.running = false;
    document.getElementById('end-title').textContent = won ? 'SUCH SURVIVAL' : (loseReason || 'GAME OVER');
    document.getElementById('end-sub').textContent = won
      ? 'The pug + generator survived. Such victory.'
      : (loseReason === 'GENERATOR DESTROYED'
        ? 'The core fell. The horde wins.'
        : 'The horde won. Bork lives on.');
    if (won) Sfx.win(); else Sfx.lose();
    document.getElementById('end-nights').textContent = this.nightsSurvived;
    document.getElementById('end-kills').textContent = this.playerKills;
    document.getElementById('end-walls').textContent = this.wallsBuilt + this.turretsBuilt;
    const overlay = document.getElementById('end-overlay');
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
    this.hud.hide();
    // Stop the bg music loop so the end stinger reads + audio doesn't bleed
    // into the start screen if the player picks REMATCH.
    try { Sfx.stopMusic?.(); } catch {}
  }
}
