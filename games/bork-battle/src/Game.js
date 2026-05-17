import { Application, Container, Graphics, Text, Rectangle } from 'pixi.js';
import { COLORS, shade } from './colors.js';
import { World } from './World.js';
import { Audience } from './Audience.js';
import { EnergyManager } from './Energy.js';
import { ProjectileManager } from './Projectile.js';
import { Pug } from './Pug.js';
import { Bot } from './Bot.js';
import { Input } from './input.js';
import { Hud } from './Hud.js';
import { FORMS, XP_TO_EVOLVE, TIER_POOLS } from './pugForms.js';
import { WEAPONS, SKINS, defaultWeapon, defaultSkin } from './weapons.js';
import { DIFFICULTIES, defaultDifficulty } from './difficulty.js';
import { PowerupManager, buffMult, hasShield } from './Powerups.js';
import { WeaponDrops } from './WeaponDrops.js';
import {
  generateBotName, RANDOM_EVENTS, BARKS, killMessage, rndPick,
} from './funnyText.js';
import { randomSeed, mulberry32 } from './rng.js';
import { Sfx } from './Sfx.js';
import { submitRun, loadBest } from '../../../src/persistence/highScores.js';

const MAX_BOTS = 11;
const BORK_MAX_DAMAGE = 60;
const BORK_PUSH = 480;
const BORK_RADIUS = 220;
const BORK_COOLDOWN = 4;
const ENERGY_PER_LEVEL = 12;

// Upgrade pool — each level-up offers 3 random picks from this list
const UPGRADES = [
  { id: 'hp',       name: '+25 HP',        desc: 'More chonk. Survive harder.',           apply: (b) => { b.hp += 25; } },
  { id: 'dmg',      name: '+15% DMG',      desc: 'Bigger hits. More bonk.',                apply: (b) => { b.dmgMult *= 1.15; } },
  { id: 'spd',      name: '+10% SPEED',    desc: 'Zoom faster.',                           apply: (b) => { b.spdMult *= 1.10; } },
  { id: 'fire',     name: '+15% FIRE RATE', desc: 'Bork bork bork bork.',                  apply: (b) => { b.fireMult *= 1.15; } },
  { id: 'projspd',  name: '+20% PROJECTILE SPD', desc: 'Faster shots = better aim.',        apply: (b) => { b.projSpdMult *= 1.20; } },
  { id: 'regen',    name: '+0.6 HP/s REGEN', desc: 'Slow heal between fights.',            apply: (b) => { b.regen += 0.6; } },
  { id: 'leech',    name: '+8% LIFESTEAL', desc: 'Heal a fraction of damage dealt.',       apply: (b) => { b.lifestealPct += 0.08; } },
  { id: 'bork',     name: '-1s BORK CD',   desc: 'Bork more often. Bonk more pugs.',       apply: (b) => { b.borkCdReduce += 1; } },
  { id: 'maxhp_pct', name: '+10% MAX HP', desc: 'Get THICCer.',                              apply: (b) => { b.hp += Math.round(50 * 0.10); } }, // approx
];

export class Game {
  constructor() {
    this.app = null;
    this.world = null;
    this.audience = null;
    this.energy = null;
    this.projectiles = null;
    this.input = null;
    this.hud = null;
    this.pugs = [];
    this.player = null;
    this.matchTime = 0;
    this.kills = 0;
    this.running = false;
    this.evolving = false;
    this.eventTimer = 18;
    this.particles = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.respawnQueue = []; // { botName, formId, t }
    this.activeEffects = { speedBoost: 0 };
  }

  async init(rootEl) {
    this.app = new Application();
    await this.app.init({
      background: COLORS.bgDeep,
      resizeTo: window,
      antialias: false,
      resolution: 1,
      roundPixels: true,
    });
    rootEl.appendChild(this.app.canvas);
    // Pixel-perfect rendering style
    this.app.canvas.style.imageRendering = 'pixelated';

    this.input = new Input(this.app.canvas, this.touchControls || null, this.gamepad || null);
    this.hud = new Hud();
  }

  async start(starterFormId = 'bork_pup', weaponId = 'pistol', skinId = 'default', difficultyId = 'normal') {
    // Defensive: force-hide all overlays before starting (class + attribute)
    for (const id of ['overlay', 'end-overlay', 'evolve-overlay']) {
      const el = document.getElementById(id);
      if (el) {
        el.hidden = true;
        el.classList.add('is-hidden');
      }
    }

    // Reset state
    this._teardown();
    this.matchTime = 0;
    this.kills = 0;
    this.running = true;
    this.evolving = false;
    this.respawnQueue = [];
    this.particles = [];
    this.starterFormId = starterFormId;
    this.playerWeaponId = weaponId;
    this.playerSkinId = skinId;
    this.difficulty = DIFFICULTIES[difficultyId] || defaultDifficulty();
    console.log(`[BORK BATTLE] difficulty: ${this.difficulty.name}`);
    this._botsEverSpawned = 0;
    this._hitstopT = 0;
    this._slowmoT = 0;

    const seed = randomSeed();
    this.world = new World(seed, { width: 2400, height: 1800 });
    this.app.stage.addChild(this.world.container);

    this.audience = new Audience(this.world, 90);
    this.energy = new EnergyManager(this.world);
    this.powerups = new PowerupManager(this.world);
    this.weaponDrops = new WeaponDrops(this.world);
    this.projectiles = new ProjectileManager(this.world);

    // Pugs layer (above items, below projectiles)
    this.pugsLayer = new Container();
    this.pugsLayer.label = 'pugs';
    this.world.container.addChild(this.pugsLayer);
    // Make sure projectiles layer is above pugs
    this.world.container.addChild(this.projectiles.layer);
    // Effects on top
    this.effectsLayer = new Container();
    this.effectsLayer.label = 'effects';
    this.world.container.addChild(this.effectsLayer);

    this.pugs = [];

    // Spawn player at random safe location with chosen starter form
    const spawn = this._safeSpawnPos();
    this.player = new Pug({ name: 'YOU', formId: this.starterFormId || 'bork_pup', x: spawn.x, y: spawn.y, isPlayer: true });
    this.player.setWeapon(WEAPONS[this.playerWeaponId] || defaultWeapon(), SKINS[this.playerSkinId] || defaultSkin());
    // Apply difficulty HP scaling to the PLAYER
    this.player.maxHp = Math.round(this.player.form.hp * this.difficulty.playerHpMult);
    this.player.hp = this.player.maxHp;
    this.pugs.push(this.player);
    this.pugsLayer.addChild(this.player.container);
    // Spawn invulnerability — gives time to find bearings before bots swarm
    this.player.invuln = 3.0;

    // Spawn bots — keep them far from the player at start
    for (let i = 0; i < MAX_BOTS; i++) {
      this._spawnBot();
    }
    console.log(`[BORK BATTLE] match started — starter: ${this.starterFormId}, bots spawned: ${this._botsEverSpawned}`);
    // Debug hook for diagnostics
    window.__BORK = this;

    this.hud.show();
    this.hud.updatePlayer(this.player);
    this.hud.updateXp(this.player, XP_TO_EVOLVE[this.player.form.tier] || null);
    this.hud.updateKills(0);
    this.hud.updateBork(1);
    this.hud.toastMessage('★ ENTER THE BORK ★', 'kill');

    // Hook ticker
    this.app.ticker.maxFPS = 60;
    if (!this._tickerBound) {
      this.app.ticker.add((tk) => this._update(tk));
      this._tickerBound = true;
    }
  }

  _teardown() {
    if (this.world) {
      this.app.stage.removeChild(this.world.container);
      this.world.container.destroy({ children: true });
      this.world = null;
    }
    this.pugs = [];
  }

  _safeSpawnPos() {
    const margin = 200;
    const w = this.world.width, h = this.world.height;
    for (let i = 0; i < 30; i++) {
      const x = margin + Math.random() * (w - margin * 2);
      const y = margin + Math.random() * (h - margin * 2);
      if (Math.hypot(x - w / 2, y - h / 2) > 250) return { x, y };
    }
    return { x: 200, y: 200 };
  }

  _spawnBot(forcedFormId = null) {
    try {
      const formId = forcedFormId || this._botStartingForm();
      // Keep bots far from the player at spawn (>= 500px) so the first
      // few seconds are calm — no instant swarm
      const minDistFromPlayer = this.player ? 500 : 0;
      let spawn = this._safeSpawnPos();
      if (this.player) {
        for (let tries = 0; tries < 20; tries++) {
          const dx = spawn.x - this.player.x;
          const dy = spawn.y - this.player.y;
          if (Math.hypot(dx, dy) >= minDistFromPlayer) break;
          spawn = this._safeSpawnPos();
        }
      }
      const name = generateBotName(Math.random);
      const bot = new Bot({ name, formId, x: spawn.x, y: spawn.y });
      // Random weapon + skin for each bot to give the arena variety
      const wIds = Object.keys(WEAPONS);
      const sIds = Object.keys(SKINS);
      const wid = wIds[Math.floor(Math.random() * wIds.length)];
      const sid = sIds[Math.floor(Math.random() * sIds.length)];
      bot.setWeapon(WEAPONS[wid], SKINS[sid]);
      // Apply difficulty HP scaling to bots
      if (this.difficulty) {
        bot.maxHp = Math.round(bot.form.hp * this.difficulty.botHpMult);
        bot.hp = bot.maxHp;
      }
      this.pugs.push(bot);
      this.pugsLayer.addChild(bot.container);
      this._botsEverSpawned += 1;
    } catch (err) {
      console.error('[BORK BATTLE] bot spawn failed:', err);
    }
  }

  _botStartingForm() {
    // Bots start at varying tiers so the world feels alive
    const r = Math.random();
    if (r < 0.45) return 'bork_pup';
    if (r < 0.78) return rndPick(['loaf', 'snoot', 'zoom']);
    if (r < 0.95) return rndPick(['cheems', 'doge_knight', 'bonk_pug']);
    return rndPick(['cosmic_pug', 'demon_pug', 'pug_zilla']);
  }

  _update(ticker) {
    if (!this.running || this.evolving) {
      return;
    }
    const rawDt = Math.min(0.05, ticker.deltaMS / 1000);
    let dt = rawDt;
    // Hitstop — fully freeze the world for a few frames after a hit
    if (this._hitstopT > 0) {
      this._hitstopT -= rawDt;
      dt = 0;
    } else if (this._slowmoT > 0) {
      // Slow-mo after a kill
      this._slowmoT -= rawDt;
      dt = rawDt * 0.4;
    }
    this.matchTime += dt;
    this._tickCombo();
    if (this.gamepad) this.gamepad.pump();

    // World + items
    this.world.update(dt, this.matchTime);
    this.audience.update(dt);
    this.audience.applyDangerZone(this.world.zone);
    this.energy.update(dt);
    this.powerups.update(dt);
    this.weaponDrops.update(dt);
    // Try weapon pickup
    if (this.player.alive) {
      const pick = this.weaponDrops.tryPickup(this.player);
      if (pick) {
        this.player.setWeapon(pick.weapon, pick.skin);
        this.hud.toastMessage(`Picked up ${pick.weapon.name}!`, 'kill');
        this.hud.updatePlayer(this.player);
      }
    }

    // Tick player buff timers
    if (this.player.alive) {
      for (let i = this.player.buffs.length - 1; i >= 0; i--) {
        const b = this.player.buffs[i];
        b.timeLeft -= dt;
        if (b.timeLeft <= 0) this.player.buffs.splice(i, 1);
      }
      // Apply shield as invuln if any shield buff active
      if (hasShield(this.player.buffs)) {
        this.player.invuln = Math.max(this.player.invuln, 0.1);
      }
      // Try collect power-up
      const got = this.powerups.tryCollect(this.player);
      if (got) this._applyPowerup(got);
    }

    // Player input
    this._updatePlayer(dt);

    // Bot AI + fire requests (with weapon reload ticking)
    for (const p of this.pugs) {
      if (!p.alive || !(p instanceof Bot)) continue;
      if (p.reloading) {
        p.reloadT -= dt;
        if (p.reloadT <= 0) {
          p.reloading = false;
          p.ammo = (p.weapon || defaultWeapon()).magSize;
        }
      }
      const fire = p.think(this.world, this.energy, this.pugs, dt);
      if (fire && !p.reloading) {
        this._fireProjectile(p, fire.aim);
        // Apply weapon fireRate multiplier to bot's cooldown
        const w = p.weapon || defaultWeapon();
        p.cooldownFire = (p.form.fireRate / 1000) / w.fireRateMult;
      }
    }

    // Resolve fence collisions for all pugs
    for (const p of this.pugs) {
      if (!p.alive) continue;
      this.world.resolveFenceCollision(p, p.form.radius - 4);
      // Clamp to map
      p.x = Math.max(p.form.radius, Math.min(this.world.width - p.form.radius, p.x));
      p.y = Math.max(p.form.radius, Math.min(this.world.height - p.form.radius, p.y));
    }

    // Pug-vs-pug contact damage (light brawl bumping)
    this._applyContactDamage(dt);

    // Projectiles
    this.projectiles.update(dt, this.pugs,
      (p, hit) => {
        // Damage scaling:
        //  - bot-vs-bot = 25% (stops mutual wipeout)
        //  - bot-vs-player = botDmgMult from difficulty
        //  - player-vs-bot = playerDmgMult from difficulty
        const owner = this._findById(p.ownerId);
        let dmgScale = 1.0;
        if (owner !== this.player && hit !== this.player) {
          dmgScale = 0.25;
        } else if (hit === this.player) {
          dmgScale = this.difficulty.botDmgMult;
        } else if (owner === this.player) {
          dmgScale = this.difficulty.playerDmgMult;
        }
        hit.takeDamage(p.damage * dmgScale, owner || { id: p.ownerId, isPlayer: false });
        this._spawnHitParticles(hit.x, hit.y, p.color);
        // Audio — quiet hit click when player is the shooter OR target
        if (owner === this.player) Sfx.hit();
        else if (hit === this.player) Sfx.hurt();
        // Lifesteal — heal owner if it's the player
        if (owner === this.player && this.player.bonus.lifestealPct > 0) {
          this.player.heal(p.damage * this.player.bonus.lifestealPct);
        }
        // Knockback from projectile
        const ang = Math.atan2(p.vy, p.vx);
        hit.vx += Math.cos(ang) * 80;
        hit.vy += Math.sin(ang) * 80;
        // Hitstop only when PLAYER deals damage (not when receiving),
        // otherwise being shot freezes movement and you can't escape.
        if (owner === this.player) {
          this._hitstopT = 0.03;
        }
        if (!hit.alive) {
          this._handleKill(owner, hit, false);
        }
      },
      (p) => {
        this._spawnHitParticles(p.x, p.y, p.color);
      });

    // Treat collection per pug — treats now grant $MONEY (not XP).
    // XP only comes from kills + assists (handled in _handleKill).
    const moneyMult = this.difficulty ? this.difficulty.moneyMult : 1;
    for (const p of this.pugs) {
      if (!p.alive) continue;
      const gained = this.energy.collectFor(p);
      if (gained > 0 && p === this.player) {
        p.money = (p.money || 0) + gained * moneyMult;
        Sfx.pickup();
      }
    }
    // Center-capture money: standing within the tornado-area earns $/sec
    if (this.player.alive && this.world.tornado) {
      const dx = this.player.x - this.world.tornado.x;
      const dy = this.player.y - this.world.tornado.y;
      const distSq = dx * dx + dy * dy;
      const capR = (this.world.tornado.radius + 60);
      if (distSq < capR * capR) {
        this.player.money += 8 * dt * moneyMult;
      }
    }
    // Player passive regen from upgrades
    if (this.player.alive && this.player.bonus.regen > 0) {
      this.player.heal(this.player.bonus.regen * dt);
    }

    // Tornado damage
    this._applyTornado(dt);

    // Zone damage
    this._applyZone(dt);

    // Hydrant interaction (pugs near a "ready" hydrant blast it)
    this._updateHydrants(dt);

    // Pug visual sync
    for (const p of this.pugs) p.syncVisual(dt);

    // Particles
    this._updateParticles(dt);

    // Camera follow + screen shake
    this._updateCamera(dt);

    // (Bot respawn removed — kill all bots = WIN)

    // Random match events
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this._triggerRandomEvent();
      this.eventTimer = 30 + Math.random() * 20;
    }

    // HUD updates
    if (this.player.alive) this.hud.updatePlayer(this.player);
    this.hud.updateTimer(this.matchTime);
    this.hud.updateKills(this.player.kills);
    const aliveBots = this.pugs.filter((p) => p.alive && p !== this.player).length;
    this.hud.updateBotsLeft(aliveBots, this._botsEverSpawned);
    this.hud.updateMoney(this.player.money || 0);
    this.hud.updateZone(this.world.pointInSafeZone(this.player.x, this.player.y));
    this.hud.updateLeaderboard(this.pugs, this.player.id);
    this.hud.updateMinimap(this.world, this.pugs, this.player);

    // End of match
    if (!this.player.alive) {
      this._endMatch(false);
    } else if (this.matchTime > 240) {
      // Hard cap — 4 minutes (safety net if bots get stuck somewhere)
      this._endMatch(true);
    } else {
      const aliveOpponents = this.pugs.filter((p) => p.alive && p !== this.player).length;
      if (this._botsEverSpawned > 0 && aliveOpponents === 0 && this.matchTime > 8) {
        this._endMatch(true);
      }
    }

    this.input.postUpdate();
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) return;

    // Aim — touch right stick takes priority on mobile, mouse on desktop.
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
    // Aim assist — snap toward nearest enemy if within 240px of cursor
    if (localStorage.getItem('wg:aim-assist') === '1') {
      let nearest = null;
      let bestD = 240 * 240;
      const ax = p.x + Math.cos(p.aim) * 200;
      const ay = p.y + Math.sin(p.aim) * 200;
      for (const o of this.pugs) {
        if (o === p || !o.alive) continue;
        const dx = o.x - ax, dy = o.y - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) { bestD = d2; nearest = o; }
      }
      if (nearest) {
        const desired = Math.atan2(nearest.y - p.y, nearest.x - p.x);
        // Blend toward target — soft assist, not lock
        let diff = desired - p.aim;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.aim += diff * 0.35;
      }
    }

    // Move (with speed bonus from upgrades + power-up buffs)
    const mv = this.input.moveVector();
    const spdMult = (p.bonus ? p.bonus.spdMult : 1) * buffMult(p.buffs, 'spdMult');
    const origSpeed = p.form.speed;
    p.form.speed = origSpeed * spdMult;
    p.move(mv.x, mv.y, dt);
    p.form.speed = origSpeed;

    // Exhaust trail behind player when moving fast
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 80) {
      p._exhaustT = (p._exhaustT || 0) + dt;
      if (p._exhaustT > 0.07) {
        p._exhaustT = 0;
        const trailAngle = Math.atan2(-p.vy, -p.vx); // opposite of motion
        const ex = p.x + Math.cos(trailAngle) * (p.form.radius - 4) + (Math.random() - 0.5) * 6;
        const ey = p.y + Math.sin(trailAngle) * (p.form.radius - 4) + (Math.random() - 0.5) * 6;
        this._spawnExhaust(ex, ey);
      }
    }

    // Reload tick
    if (p.reloading) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.reloading = false;
        p.ammo = (p.weapon || defaultWeapon()).magSize;
      }
    }

    // Fire
    p.cooldownFire -= dt;
    if (this.input.isFiring() && p.cooldownFire <= 0 && !p.reloading) {
      this._fireProjectile(p, p.aim);
      const fireMult =
        (p.bonus ? p.bonus.fireMult : 1) *
        ((p.weapon && p.weapon.fireRateMult) || 1) *
        buffMult(p.buffs, 'fireMult');
      p.cooldownFire = p.form.fireRate / 1000 / fireMult;
    }

    // Bork ability — hold space to charge, release to fire
    const borkCd = Math.max(1.0, BORK_COOLDOWN - (p.bonus ? p.bonus.borkCdReduce : 0));
    if (p.borkCooldown > 0) {
      p.borkCooldown -= dt;
      this.hud.updateBork(1 - (p.borkCooldown / borkCd));
      p.borkCharge = 0;
    } else if (this.input.spaceDown()) {
      p.borkCharge = Math.min(1, p.borkCharge + dt / 1.0);
      this.hud.updateBork(p.borkCharge);
    } else if (p.borkCharge > 0 || this.input.spaceJustReleased()) {
      const charge = Math.max(0.25, p.borkCharge);
      this._unleashBork(p, charge);
      p.borkCharge = 0;
      p.borkCooldown = borkCd;
    } else {
      this.hud.updateBork(1);
    }
  }

  _fireProjectile(pug, aim) {
    if (!pug.alive) return;
    // Block firing while reloading
    if (pug.reloading) return;
    // If no weapon (shouldn't happen but defensive), fall back to pistol
    const w = pug.weapon || defaultWeapon();
    const skin = pug.skin || defaultSkin();
    // Block firing if out of ammo (will trigger reload below)
    if (pug.ammo != null && pug.ammo <= 0) {
      pug.reloading = true;
      pug.reloadT = w.reloadTime;
      return;
    }
    const f = pug.form;
    const buffDmg = pug.buffs ? buffMult(pug.buffs, 'dmgMult') : 1;
    let dmgMult = (pug.bonus ? pug.bonus.dmgMult : 1) * w.dmgMult * buffDmg;
    const projSpdMult = (pug.bonus ? pug.bonus.projSpdMult : 1) * w.projSpeedMult;
    // AR close-range falloff: if target is right on top, damage drops to 40%.
    // We approximate "close range" by checking nearest enemy within 80 units.
    if (w.closeRangeFalloff) {
      let nearestSq = Infinity;
      for (const o of this.pugs) {
        if (o === pug || !o.alive) continue;
        const dxN = o.x - pug.x, dyN = o.y - pug.y;
        const d2 = dxN * dxN + dyN * dyN;
        if (d2 < nearestSq) nearestSq = d2;
      }
      const nearestDist = Math.sqrt(nearestSq);
      if (nearestDist < 80) {
        // linear falloff 100% at 80 → 40% at 0
        const k = nearestDist / 80;
        dmgMult *= 0.4 + 0.6 * k;
      }
    }
    const speed = f.projectileSpeed * projSpdMult;
    const baseColor = skin.tint != null ? skin.tint : f.projectileColor;
    const offX = Math.cos(aim) * (f.radius + 6);
    const offY = Math.sin(aim) * (f.radius + 6);
    // Spawn N pellets with spread
    for (let i = 0; i < w.pellets; i++) {
      const t = w.pellets > 1 ? (i / (w.pellets - 1) - 0.5) * 2 : 0;
      const angle = aim + t * w.spread + (Math.random() - 0.5) * w.spread * 0.3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.projectiles.spawn({
        x: pug.x + offX,
        y: pug.y + offY,
        vx, vy,
        damage: f.projectileDamage * dmgMult,
        color: baseColor,
        ownerId: pug.id,
        lifetime: w.id === 'sniper' ? 2.2 : 1.6,
        radius: w.id === 'shotgun' ? 5 : (f.tier >= 2 ? 7 : 6),
        shape: w.id === 'sniper' ? 'lance' : (f.projectileShape || 'ball'),
        angle,
      });
    }
    // Muzzle flash effect
    this._spawnMuzzleFlash(pug.x + offX, pug.y + offY, baseColor, aim);
    // Audio — only audible from player (avoid bot-fire spam)
    if (pug === this.player) Sfx.shoot(f.projectileShape || 'ball');
    // Recoil (visual) — scaled by weapon (shotgun = big shove, AR = tiny)
    const recoil = w.id === 'shotgun' ? 80 : (w.id === 'sniper' ? 120 : (w.id === 'ar' ? 18 : 40));
    pug.vx -= Math.cos(aim) * recoil;
    pug.vy -= Math.sin(aim) * recoil;
    // Decrement ammo + auto-reload when empty
    if (pug.ammo != null) {
      pug.ammo -= 1;
      if (pug.ammo <= 0) {
        pug.reloading = true;
        pug.reloadT = w.reloadTime;
        if (pug === this.player) Sfx.reload();
      }
    }
  }

  _spawnExhaust(x, y) {
    const g = new Graphics();
    g.x = x; g.y = y;
    this.effectsLayer.addChild(g);
    this.particles.push({
      kind: 'cloud', g, x, y,
      startR: 2 + Math.random() * 2,
      endR: 8 + Math.random() * 4,
      color: 0x8a8aa0,
      vy: -12,
      life: 0.5 + Math.random() * 0.2,
      t: 0,
    });
  }

  _spawnMuzzleFlash(x, y, color, angle) {
    // ---------- main flash burst (layered glow) ----------
    const g = new Graphics();
    g.x = x; g.y = y; g.rotation = angle;
    // outer halo
    g.circle(0, 0, 14).fill({ color, alpha: 0.25 });
    g.circle(0, 0, 10).fill({ color, alpha: 0.5 });
    // bright core
    g.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.95 });
    g.circle(0, 0, 3).fill(0xffffff);
    // forward muzzle cone
    g.rect(0, -3, 16, 6).fill({ color, alpha: 0.8 });
    g.rect(0, -1, 18, 2).fill({ color: 0xffffff, alpha: 0.9 });
    // radial spark lines
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const r = 4 + Math.random() * 4;
      g.rect(2, i * 3 - 0.5, 8 + r, 1).fill({ color, alpha: 0.7 });
    }
    // back-puff
    g.rect(-6, -2, 4, 4).fill({ color, alpha: 0.4 });
    this.effectsLayer.addChild(g);
    this.particles.push({ kind: 'muzzle', g, t: 0, life: 0.12, x, y });

    // ---------- shockwave ring (quick expand) ----------
    const ring = new Graphics();
    ring.x = x; ring.y = y;
    this.effectsLayer.addChild(ring);
    this.particles.push({
      kind: 'shockring', g: ring, t: 0, life: 0.22, x, y,
      startR: 4, endR: 22, color,
    });

    // ---------- ejected casings / sparks (small tumbling pixels) ----------
    const perpAngle = angle + Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const sg = new Graphics();
      const sparkCol = i % 2 === 0 ? color : 0xffd23f;
      sg.rect(-1, -1, 2, 2).fill(sparkCol);
      sg.rect(-1, -1, 1, 1).fill(0xffffff);
      sg.x = x; sg.y = y;
      this.effectsLayer.addChild(sg);
      // shoot to the side of aim + forward bias
      const ang = angle + (Math.random() - 0.5) * 0.6;
      const sp = 120 + Math.random() * 100;
      const perp = (Math.random() - 0.5) * 80;
      this.particles.push({
        kind: 'spark', g: sg, x, y,
        vx: Math.cos(ang) * sp + Math.cos(perpAngle) * perp,
        vy: Math.sin(ang) * sp + Math.sin(perpAngle) * perp,
        gravity: 280,
        life: 0.45 + Math.random() * 0.2, t: 0,
      });
    }

    // ---------- smoke puff behind the muzzle (cloud) ----------
    const smoke = new Graphics();
    smoke.x = x - Math.cos(angle) * 4;
    smoke.y = y - Math.sin(angle) * 4;
    this.effectsLayer.addChild(smoke);
    this.particles.push({
      kind: 'cloud', g: smoke, x: smoke.x, y: smoke.y,
      startR: 4, endR: 14, color: 0xaaaab8, vy: -10,
      life: 0.5, t: 0,
    });
  }

  _unleashBork(pug, charge) {
    // Beefed: minimum charge floored at 0.5 so even a tap feels strong,
    // bigger radius scaling, more pushback, multi-layer visuals.
    const effCharge = Math.max(0.5, charge);
    const radius = BORK_RADIUS * (0.75 + 0.6 * effCharge);
    const damage = BORK_MAX_DAMAGE * effCharge;
    pug.bark(effCharge > 0.7 ? 'BORK!!!' : 'BORK!');
    if (pug === this.player) Sfx.borkRelease(effCharge);

    // visual rings — triple-layer
    this._spawnBorkRing(pug.x, pug.y, radius, COLORS.cyan);
    this._spawnBorkRing(pug.x, pug.y, radius * 0.7, COLORS.white || 0xffffff);
    this._spawnBorkRing(pug.x, pug.y, radius * 1.15, COLORS.pink);
    // big text overlay
    this._spawnTextBurst(pug.x, pug.y - 30, effCharge > 0.7 ? 'BORK!!!' : 'BORK!', COLORS.cyan, 28);
    // particles in all directions
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2;
      const sp = 220 + Math.random() * 140;
      const g = new Graphics();
      const c = [COLORS.cyan, COLORS.white || 0xffffff, COLORS.pink][i % 3];
      g.rect(-3, -3, 6, 6).fill(c);
      g.x = pug.x; g.y = pug.y;
      this.effectsLayer.addChild(g);
      this.particles.push({
        kind: 'spark', g, x: pug.x, y: pug.y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.5, t: 0,
      });
    }
    // screen-flash overlay (HUD)
    this.hud.flashScreen(effCharge);
    this._screenShake(16 * effCharge, 0.35);

    for (const other of this.pugs) {
      if (other === pug || !other.alive) continue;
      const dx = other.x - pug.x, dy = other.y - pug.y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        const k = 1 - d / radius;
        other.takeDamage(damage * k, pug);
        if (d > 1) {
          other.vx += (dx / d) * BORK_PUSH * 1.4 * k;
          other.vy += (dy / d) * BORK_PUSH * 1.4 * k;
        }
        if (!other.alive) this._handleKill(pug, other, false);
      }
    }
  }

  _spawnBorkRing(x, y, radius, color = COLORS.cyan) {
    const g = new Graphics();
    g.x = x; g.y = y;
    g.circle(0, 0, 10).stroke({ color, width: 4, alpha: 0.9 });
    this.effectsLayer.addChild(g);
    this.particles.push({
      kind: 'shockring',
      g, t: 0, life: 0.5, x, y,
      startR: 10, endR: radius, color,
    });
  }

  _spawnHitParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      const g = new Graphics();
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 100;
      g.rect(-2, -2, 4, 4).fill(color);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      this.particles.push({
        kind: 'spark',
        g,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        t: 0,
      });
    }
  }

  _spawnKillBanner(x, y) {
    const t = new Text({
      text: '+1 KILL',
      style: {
        fill: COLORS.yellow,
        fontFamily: 'monospace',
        fontSize: 18,
        fontWeight: 'bold',
        stroke: { color: COLORS.black, width: 4 },
      },
    });
    t.anchor.set(0.5, 1);
    t.x = x; t.y = y;
    this.effectsLayer.addChild(t);
    this.particles.push({ kind: 'killbanner', g: t, x, y, life: 1.2, t: 0 });
  }

  // ===========================================================================
  // DEATH EFFECTS — 12 variations, picked at random per kill.
  // Every death also triggers a white impact-ring + screen shake so any
  // kill reads as "an event happened here". The picked effect then adds
  // its own flavor on top.
  // ===========================================================================
  _spawnRandomDeathEffect(x, y) {
    // universal impact flash
    const flash = new Graphics();
    flash.x = x; flash.y = y;
    this.effectsLayer.addChild(flash);
    this.particles.push({
      kind: 'shockring', g: flash, t: 0, life: 0.32, x, y,
      startR: 6, endR: 60, color: 0xffffff,
    });
    // secondary tinted ring
    const ring = new Graphics();
    ring.x = x; ring.y = y;
    this.effectsLayer.addChild(ring);
    this.particles.push({
      kind: 'shockring', g: ring, t: 0, life: 0.45, x, y,
      startR: 4, endR: 80, color: COLORS.pink,
    });
    // a few universal white sparks
    for (let i = 0; i < 6; i++) {
      const g = new Graphics();
      g.rect(-2, -2, 4, 4).fill(0xffffff);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = (i / 6) * Math.PI * 2;
      const sp = 200 + Math.random() * 80;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35, t: 0,
      });
    }
    // the variant
    const fns = [
      this._deathFxSpaghetti, this._deathFxConfetti, this._deathFxHearts,
      this._deathFxBones,     this._deathFxEmoji,    this._deathFxTreats,
      this._deathFxBurp,      this._deathFxDisco,    this._deathFxGhost,
      this._deathFxToast,     this._deathFxNuggets,  this._deathFxYeet,
    ];
    const pick = fns[Math.floor(Math.random() * fns.length)];
    pick.call(this, x, y);
    this._screenShake(5, 0.25);
  }

  // 1. SPAGHETTI EXPLOSION — yellow noodles + marinara + meatballs
  _deathFxSpaghetti(x, y) {
    // 20 noodles
    for (let i = 0; i < 20; i++) {
      const g = new Graphics();
      const noodleColor = [0xffe066, 0xf5d340, 0xffd23f, 0xe8b830][Math.floor(Math.random() * 4)];
      g.rect(-8, -1, 16, 2).fill(noodleColor);
      g.rect(-8, -1, 16, 1).fill(0xfff0a8);
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI * 2;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 180;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        rotVel: (Math.random() - 0.5) * 14,
        gravity: 260,
        life: 1.2 + Math.random() * 0.5, t: 0,
      });
    }
    // 12 marinara splats
    for (let i = 0; i < 12; i++) {
      const g = new Graphics();
      const r = 2 + Math.random() * 3;
      g.circle(0, 0, r).fill(0xc8281f);
      g.circle(0, 0, r - 1).fill(0xe8483a);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 70 + Math.random() * 130;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gravity: 200,
        life: 0.9 + Math.random() * 0.3, t: 0,
      });
    }
    // 3 flying meatballs
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      g.circle(0, 0, 5).fill(0x6a3a1c);
      g.circle(0, 0, 4).fill(0x8a5a2c);
      g.circle(-1, -1, 1).fill(0xc8a878);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 180 + Math.random() * 80;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rotVel: (Math.random() - 0.5) * 8,
        gravity: 340,
        life: 1.4, t: 0,
      });
    }
    this._spawnTextBurst(x, y, 'MAMA MIA!', 0xffd23f, 14);
  }

  _spawnTextBurst(x, y, text, color = 0xffd23f, size = 14) {
    const t = new Text({
      text,
      style: {
        fill: color, fontFamily: 'monospace', fontSize: size, fontWeight: 'bold',
        stroke: { color: 0x000000, width: 3 },
      },
    });
    t.anchor.set(0.5);
    t.x = x; t.y = y - 32;
    this.effectsLayer.addChild(t);
    this.particles.push({ kind: 'text', g: t, x, y: y - 32, vy: -60, life: 1.0, t: 0 });
  }

  // 2. CONFETTI BLAST — multi-color storm with starburst flash
  _deathFxConfetti(x, y) {
    const palette = [COLORS.pink, COLORS.cyan, COLORS.yellow, COLORS.green, COLORS.magenta, 0xb055ff];
    // starburst flash
    const star = new Graphics();
    star.x = x; star.y = y;
    star.rotation = Math.random() * Math.PI;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const len = i % 2 === 0 ? 28 : 14;
      star.moveTo(0, 0).lineTo(Math.cos(a) * len, Math.sin(a) * len).stroke({ color: 0xffffff, width: 3 });
    }
    this.effectsLayer.addChild(star);
    this.particles.push({ kind: 'spark', g: star, x, y, vx: 0, vy: 0, life: 0.25, t: 0 });
    // 35 confetti rects
    for (let i = 0; i < 35; i++) {
      const g = new Graphics();
      const c = palette[Math.floor(Math.random() * palette.length)];
      const w = 3 + Math.floor(Math.random() * 4);
      const h = 2 + Math.floor(Math.random() * 3);
      g.rect(-w / 2, -h / 2, w, h).fill(c);
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI * 2;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 240;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        rotVel: (Math.random() - 0.5) * 14,
        gravity: 200,
        life: 1.2 + Math.random() * 0.6, t: 0,
      });
    }
    this._spawnTextBurst(x, y, rndPick(['GG', 'PARTY!', 'OOF']), COLORS.yellow, 18);
  }

  // 3. HEARTS RISE — pink hearts float up + heart shockwave
  _deathFxHearts(x, y) {
    // heart-colored shockring
    const ring = new Graphics();
    ring.x = x; ring.y = y;
    this.effectsLayer.addChild(ring);
    this.particles.push({
      kind: 'shockring', g: ring, t: 0, life: 0.5, x, y,
      startR: 8, endR: 70, color: 0xff8aa8,
    });
    // 14 hearts (some larger)
    for (let i = 0; i < 14; i++) {
      const g = new Graphics();
      const big = Math.random() < 0.3;
      const s = big ? 2 : 1;
      // pixel heart (parameterized)
      g.rect(-3 * s, -2 * s, 2 * s, 2 * s).fill(0xff8aa8);
      g.rect(1 * s, -2 * s, 2 * s, 2 * s).fill(0xff8aa8);
      g.rect(-3 * s, 0, 6 * s, 2 * s).fill(0xff8aa8);
      g.rect(-2 * s, 2 * s, 4 * s, 1 * s).fill(0xff8aa8);
      g.rect(-1 * s, 3 * s, 2 * s, 1 * s).fill(0xff8aa8);
      g.rect(-2 * s, -2 * s, 1 * s, 1 * s).fill(0xffd0e0);
      g.x = x + (Math.random() - 0.5) * 50;
      g.y = y + (Math.random() - 0.5) * 10;
      this.effectsLayer.addChild(g);
      this.particles.push({
        kind: 'spark', g, x: g.x, y: g.y,
        vx: (Math.random() - 0.5) * 50,
        vy: -50 - Math.random() * 40,
        noFriction: true,
        life: 1.4 + Math.random() * 0.6, t: 0,
      });
    }
    this._spawnTextBurst(x, y, '💕 RIP 💕', 0xff8aa8, 14);
  }

  // 4. BONE TUMBLE — pixel bones + dust + tombstone
  _deathFxBones(x, y) {
    // 14 bones
    for (let i = 0; i < 14; i++) {
      const g = new Graphics();
      const bc = 0xfde0b8;
      g.rect(-5, -1, 10, 3).fill(bc);
      g.rect(-6, -3, 3, 6).fill(bc);
      g.rect(3, -3, 3, 6).fill(bc);
      g.rect(-5, -1, 10, 1).fill(0xffffff);
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI * 2;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 160;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100,
        rotVel: (Math.random() - 0.5) * 10,
        gravity: 280,
        life: 1.2 + Math.random() * 0.4, t: 0,
      });
    }
    // dust cloud
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      g.x = x + (Math.random() - 0.5) * 18;
      g.y = y + (Math.random() - 0.5) * 12;
      this.effectsLayer.addChild(g);
      this.particles.push({
        kind: 'cloud', g, x: g.x, y: g.y,
        startR: 4, endR: 14, color: 0xc8b88a, vy: -8,
        life: 0.7, t: 0,
      });
    }
    // small tombstone pops up briefly
    const tomb = new Graphics();
    tomb.x = x; tomb.y = y - 20;
    tomb.rect(-6, -10, 12, 14).fill(0x8a8a9a);
    tomb.rect(-6, -10, 12, 2).fill(0xb0b0c0);
    tomb.rect(-4, -8, 8, 1).fill(0x4a4a52); // RIP top
    tomb.rect(-3, -6, 6, 1).fill(0x4a4a52);
    this.effectsLayer.addChild(tomb);
    this.particles.push({
      kind: 'spark', g: tomb, x, y: y - 20, vx: 0, vy: -10, noFriction: true,
      life: 1.0, t: 0,
    });
    this._spawnTextBurst(x, y, 'BONK\'D', 0xfde0b8, 14);
  }

  // 5. EMOJI SHOWER — burst of skull/ghost/bone emojis
  _deathFxEmoji(x, y) {
    const choices = ['💀', '😵', '🦴', '⚰️', '👻', '🐶', '🪦', '😇'];
    for (let i = 0; i < 12; i++) {
      const t = new Text({
        text: choices[Math.floor(Math.random() * choices.length)],
        style: { fontFamily: 'sans-serif', fontSize: 22 + Math.floor(Math.random() * 6) },
      });
      t.anchor.set(0.5);
      t.x = x; t.y = y;
      this.effectsLayer.addChild(t);
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 80 + Math.random() * 120;
      this.particles.push({
        kind: 'spark', g: t, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        gravity: 120,
        life: 1.4 + Math.random() * 0.4, t: 0,
      });
    }
  }

  // 6. TREAT EXPLOSION — gold treats fan + explosion ring + ACTUAL pickup treats
  _deathFxTreats(x, y) {
    // gold ring
    const ring = new Graphics();
    ring.x = x; ring.y = y;
    this.effectsLayer.addChild(ring);
    this.particles.push({
      kind: 'shockring', g: ring, t: 0, life: 0.5, x, y,
      startR: 6, endR: 90, color: COLORS.treat,
    });
    // 18 oversized treats
    for (let i = 0; i < 18; i++) {
      const g = new Graphics();
      g.rect(-5, -5, 10, 10).fill(COLORS.treat);
      g.rect(-4, -4, 8, 8).fill(COLORS.treatGlow);
      g.rect(-5, -5, 10, 2).fill(0xffffff);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = (i / 18) * Math.PI * 2;
      const sp = 120 + Math.random() * 100;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gravity: 80,
        life: 1.0 + Math.random() * 0.3, t: 0,
      });
    }
    // also drop 5 ACTUAL pickup treats player can grab (bonus on top of normal drop)
    this.energy.spawnBurst(x, y, 5, 4);
    this._spawnTextBurst(x, y, '+TREATS!', COLORS.treat, 14);
  }

  // 7. BURP CLOUD — green clouds + flies + tiny bones
  _deathFxBurp(x, y) {
    // 10 green cloud puffs
    for (let i = 0; i < 10; i++) {
      const g = new Graphics();
      g.x = x + (Math.random() - 0.5) * 28;
      g.y = y + (Math.random() - 0.5) * 28;
      this.effectsLayer.addChild(g);
      this.particles.push({
        kind: 'cloud', g, x: g.x, y: g.y,
        startR: 4 + Math.random() * 3,
        endR: 22 + Math.random() * 12,
        color: [0x6ad06a, 0x9af09a, 0x5ef38c, 0x8ad08a][Math.floor(Math.random() * 4)],
        vy: -30,
        life: 1.2 + Math.random() * 0.5, t: 0,
      });
    }
    // small flies/dots buzzing in the cloud
    for (let i = 0; i < 6; i++) {
      const g = new Graphics();
      g.rect(-1, -1, 2, 2).fill(0x101018);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * (40 + Math.random() * 30),
        vy: Math.sin(a) * (40 + Math.random() * 30) - 30,
        noFriction: true,
        life: 1.5 + Math.random() * 0.3, t: 0,
      });
    }
    // 3 small bones
    for (let i = 0; i < 3; i++) {
      const g = new Graphics();
      g.rect(-3, -1, 6, 2).fill(0xfde0b8);
      g.rect(-4, -2, 2, 4).fill(0xfde0b8);
      g.rect(2, -2, 2, 4).fill(0xfde0b8);
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI;
      this.effectsLayer.addChild(g);
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 40,
        rotVel: (Math.random() - 0.5) * 8, gravity: 240,
        life: 1.3, t: 0,
      });
    }
    this._spawnTextBurst(x, y, 'BUUURRP', 0x6ad06a, 14);
  }

  // 8. DISCO DEATH — multi-color shockwaves + rainbow sparkles + tiny disco ball
  _deathFxDisco(x, y) {
    const rainbow = [COLORS.pink, COLORS.cyan, COLORS.yellow, COLORS.green, COLORS.magenta, 0xb055ff];
    // triple shockwave rings (rainbow)
    for (let i = 0; i < 3; i++) {
      const ring = new Graphics();
      ring.x = x; ring.y = y;
      this.effectsLayer.addChild(ring);
      this.particles.push({
        kind: 'shockring', g: ring, t: -i * 0.08, life: 0.55, x, y,
        startR: 8, endR: 90 + i * 30, color: rainbow[i * 2 % rainbow.length],
      });
    }
    // 24 rainbow sparkles
    for (let i = 0; i < 24; i++) {
      const g = new Graphics();
      const c = rainbow[i % rainbow.length];
      g.rect(-3, -3, 6, 6).fill(c);
      g.rect(-2, -2, 4, 4).fill(0xffffff);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = (i / 24) * Math.PI * 2;
      const sp = 120 + Math.random() * 100;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1.0 + Math.random() * 0.4, t: 0,
      });
    }
    // tiny floating disco ball
    const ball = new Graphics();
    ball.circle(0, 0, 7).fill(0xc8c8e8);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ball.rect(Math.cos(a) * 5 - 1, Math.sin(a) * 5 - 1, 2, 2).fill(rainbow[i % rainbow.length]);
    }
    ball.x = x; ball.y = y;
    this.effectsLayer.addChild(ball);
    this.particles.push({
      kind: 'spark', g: ball, x, y, vx: 0, vy: -50, noFriction: true,
      life: 1.5, t: 0,
    });
    this._spawnTextBurst(x, y, 'DANCE OFF', COLORS.magenta, 14);
  }

  // 9. GHOST RISE — big ghost-pug with halo + wings + tombstone
  _deathFxGhost(x, y) {
    // tombstone (stays at ground)
    const tomb = new Graphics();
    tomb.x = x; tomb.y = y - 10;
    tomb.rect(-8, -12, 16, 16).fill(0x8a8a9a);
    tomb.rect(-8, -12, 16, 2).fill(0xb0b0c0);
    tomb.rect(-5, -10, 10, 1).fill(0x4a4a52);
    tomb.rect(-4, -8, 8, 1).fill(0x4a4a52);
    tomb.rect(-3, -6, 6, 1).fill(0x4a4a52);
    this.effectsLayer.addChild(tomb);
    this.particles.push({
      kind: 'spark', g: tomb, x, y: y - 10, vx: 0, vy: 0,
      life: 1.5, t: 0,
    });
    // big ghost pug rising
    const g = new Graphics();
    // halo
    g.ellipse(0, -16, 9, 2).stroke({ color: COLORS.yellow, width: 2 });
    // wings
    g.rect(-12, -4, 4, 8).fill(0xeeeeff);
    g.rect(8, -4, 4, 8).fill(0xeeeeff);
    g.rect(-12, -4, 1, 8).fill(0xffffff);
    g.rect(11, -4, 1, 8).fill(0xffffff);
    // body
    g.rect(-8, -10, 16, 12).fill(0xffffff);
    g.rect(-7, -12, 14, 2).fill(0xffffff);
    g.rect(-5, -14, 10, 2).fill(0xffffff);
    // wavy bottom
    g.rect(-8, 2, 3, 3).fill(0xffffff);
    g.rect(-1, 2, 3, 3).fill(0xffffff);
    g.rect(5, 2, 3, 3).fill(0xffffff);
    // eyes (sad)
    g.rect(-5, -8, 3, 3).fill(0x000000);
    g.rect(2, -8, 3, 3).fill(0x000000);
    g.rect(-3, -3, 6, 1).fill(0x000000); // sad mouth
    g.x = x; g.y = y;
    g.alpha = 0.92;
    this.effectsLayer.addChild(g);
    this.particles.push({
      kind: 'spark', g, x, y, vx: 0, vy: -55,
      noFriction: true, life: 1.6, t: 0,
    });
    this._spawnTextBurst(x, y, 'F', 0xffffff, 22);
  }

  // 10. TOAST POP — bread slices + jam splatter + butter chunks
  _deathFxToast(x, y) {
    // 12 toast slices arcing up
    for (let i = 0; i < 12; i++) {
      const g = new Graphics();
      g.rect(-5, -6, 10, 12).fill(0xd9a86a);
      g.rect(-5, -6, 10, 2).fill(0xeac888);
      g.rect(-5, -6, 1, 12).fill(0x8a5a2c);
      g.rect(4, -6, 1, 12).fill(0x8a5a2c);
      g.rect(-5, 5, 10, 1).fill(0x8a5a2c);
      g.rect(-1, 0, 2, 2).fill(0xa66a3a);
      g.x = x; g.y = y;
      g.rotation = (Math.random() - 0.5) * 0.6;
      this.effectsLayer.addChild(g);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 220 + Math.random() * 100;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        rotVel: (Math.random() - 0.5) * 8,
        gravity: 420,
        life: 1.4 + Math.random() * 0.3, t: 0,
      });
    }
    // 8 jam splatter (red)
    for (let i = 0; i < 8; i++) {
      const g = new Graphics();
      const r = 2 + Math.random() * 3;
      g.circle(0, 0, r).fill(0xc8281f);
      g.circle(0, 0, r - 1).fill(0xff5a3a);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gravity: 220,
        life: 0.9 + Math.random() * 0.3, t: 0,
      });
    }
    // 5 butter chunks (yellow blocks)
    for (let i = 0; i < 5; i++) {
      const g = new Graphics();
      g.rect(-3, -3, 6, 6).fill(COLORS.yellow);
      g.rect(-3, -3, 6, 1).fill(0xffeb55);
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 80;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
        rotVel: (Math.random() - 0.5) * 6, gravity: 300,
        life: 1.2, t: 0,
      });
    }
    this._spawnTextBurst(x, y, 'TOAST\'D', 0xeac888, 14);
  }

  // 11. NUGGETS — pug exploded into chicken nuggets (lol)
  _deathFxNuggets(x, y) {
    // 16 nugget shapes
    for (let i = 0; i < 16; i++) {
      const g = new Graphics();
      const nc = 0xeac08a;
      // nugget bumpy outline
      g.rect(-4, -3, 8, 7).fill(nc);
      g.rect(-5, -2, 1, 4).fill(nc);
      g.rect(4, -2, 1, 4).fill(nc);
      g.rect(-3, -4, 6, 1).fill(nc);
      g.rect(-3, 4, 6, 1).fill(nc);
      g.rect(-4, -3, 8, 2).fill(0xfde0b8); // crispy top
      g.x = x; g.y = y;
      g.rotation = Math.random() * Math.PI * 2;
      this.effectsLayer.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const sp = 110 + Math.random() * 130;
      this.particles.push({
        kind: 'noodle', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        rotVel: (Math.random() - 0.5) * 10, gravity: 280,
        life: 1.2 + Math.random() * 0.3, t: 0,
      });
    }
    // 4 dipping sauce blobs
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      const c = i % 2 === 0 ? 0xc8281f : 0xeac018; // ketchup + mustard
      g.circle(0, 0, 4).fill(c);
      g.circle(0, 0, 3).fill(shade(c, 1.3));
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const a = (i / 4) * Math.PI * 2;
      const sp = 80 + Math.random() * 60;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        gravity: 240,
        life: 1.0, t: 0,
      });
    }
    this._spawnTextBurst(x, y, 'NUGGETS!', 0xeac08a, 14);
  }

  // 12. YEET — pug-silhouette flies off-screen with a trail
  _deathFxYeet(x, y) {
    // big arrow trail showing direction
    const yeetAngle = -Math.PI / 4 + Math.random() * Math.PI / 2; // up-ish
    // 10 trail dots
    for (let i = 0; i < 10; i++) {
      const g = new Graphics();
      const c = [COLORS.cyan, COLORS.pink, COLORS.yellow, 0xffffff][i % 4];
      g.rect(-2, -2, 4, 4).fill(c);
      g.x = x; g.y = y;
      this.effectsLayer.addChild(g);
      const sp = 80 + i * 15;
      this.particles.push({
        kind: 'spark', g, x, y,
        vx: Math.cos(yeetAngle) * sp, vy: Math.sin(yeetAngle) * sp,
        noFriction: true, life: 0.8 + i * 0.05, t: i * 0.04,
      });
    }
    // main pug-silhouette flying away fast
    const ball = new Graphics();
    ball.rect(-6, -8, 12, 10).fill(0xc8854a);
    ball.rect(-6, -10, 12, 2).fill(0xc8854a);
    ball.rect(-8, -8, 2, 6).fill(0x6b3a1c); // ear
    ball.rect(6, -8, 2, 6).fill(0x6b3a1c);
    ball.rect(-3, -5, 6, 2).fill(0x1a0d05); // face
    ball.rect(-3, -3, 6, 1).fill(0xff5a82); // tongue
    ball.x = x; ball.y = y;
    ball.rotation = yeetAngle;
    this.effectsLayer.addChild(ball);
    this.particles.push({
      kind: 'noodle', g: ball, x, y,
      vx: Math.cos(yeetAngle) * 600, vy: Math.sin(yeetAngle) * 600,
      rotVel: 18, gravity: 0,
      life: 1.5, t: 0,
    });
    this._spawnTextBurst(x, y, 'Y E E T', COLORS.cyan, 18);
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.kind === 'spark') {
        // physics
        if (p.gravity) p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!p.noFriction) {
          const fr = p.gravity ? 1.5 : 4; // less friction when gravity is the dominant force
          p.vx *= 1 - dt * fr;
          if (!p.gravity) p.vy *= 1 - dt * fr;
        }
        p.g.x = p.x; p.g.y = p.y;
        p.g.alpha = Math.max(0, 1 - p.t / p.life);
      } else if (p.kind === 'noodle') {
        // like spark but spinning
        if (p.gravity) p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - dt * 0.8;
        if (p.rotVel != null) p.g.rotation += p.rotVel * dt;
        p.g.x = p.x; p.g.y = p.y;
        const k = p.t / p.life;
        p.g.alpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      } else if (p.kind === 'cloud') {
        // expanding ellipse that fades
        const k = p.t / p.life;
        const r = p.startR + (p.endR - p.startR) * k;
        if (p.vy) p.y += p.vy * dt;
        p.g.clear();
        p.g.circle(0, 0, r).fill({ color: p.color, alpha: (1 - k) * 0.6 });
        p.g.circle(-r * 0.3, -r * 0.3, r * 0.5).fill({ color: 0xffffff, alpha: (1 - k) * 0.2 });
        p.g.x = p.x; p.g.y = p.y;
      } else if (p.kind === 'text') {
        p.y += p.vy * dt;
        p.g.x = p.x; p.g.y = p.y;
        p.g.alpha = Math.max(0, 1 - p.t / p.life);
      } else if (p.kind === 'ring') {
        const k = p.t / p.life;
        const r = 10 + (p.target - 10) * k;
        p.g.clear();
        p.g.circle(0, 0, r).stroke({ color: COLORS.cyan, width: 4 * (1 - k), alpha: 1 - k });
      } else if (p.kind === 'muzzle') {
        const k = p.t / p.life;
        p.g.alpha = 1 - k;
        p.g.scale.set(1 + k * 0.5);
      } else if (p.kind === 'killbanner') {
        const k = p.t / p.life;
        p.g.y = p.y - k * 50;
        p.g.alpha = k < 0.7 ? 1 : (1 - k) / 0.3;
      } else if (p.kind === 'shockring') {
        const k = p.t / p.life;
        const r = p.startR + (p.endR - p.startR) * k;
        p.g.clear();
        p.g.circle(0, 0, r).stroke({ color: p.color, width: 3 * (1 - k), alpha: 1 - k });
      }
      if (p.t >= p.life) {
        p.g.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  _updateCamera(dt) {
    const cam = this.app.stage;
    const screen = this.app.screen;
    const scale = 1; // pixel game — keep 1:1 scale
    cam.scale.set(scale);
    let camX = -this.player.x * scale + screen.width / 2;
    let camY = -this.player.y * scale + screen.height / 2;
    // Clamp to map bounds (stop scrolling at edges)
    camX = Math.min(0, Math.max(-this.world.width * scale + screen.width, camX));
    camY = Math.min(0, Math.max(-this.world.height * scale + screen.height, camY));
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT) * this.shakeMag;
      camX += (Math.random() - 0.5) * k;
      camY += (Math.random() - 0.5) * k;
    }
    cam.x = camX;
    cam.y = camY;
  }

  _screenShake(magnitude, duration) {
    this.shakeMag = magnitude;
    this.shakeT = duration;
  }

  _applyContactDamage(dt) {
    // O(n^2) but n is small (~12)
    for (let i = 0; i < this.pugs.length; i++) {
      const a = this.pugs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.pugs.length; j++) {
        const b = this.pugs[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const r = a.form.radius + b.form.radius - 4;
        const d = Math.hypot(dx, dy);
        if (d < r && d > 0.1) {
          const overlap = r - d;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * overlap * 0.5;
          a.y -= uy * overlap * 0.5;
          b.x += ux * overlap * 0.5;
          b.y += uy * overlap * 0.5;
          const baseDmg = (a.form.contactDamage + b.form.contactDamage) * dt;
          // Bot-vs-bot scaled to 25%; player-involved scaled by difficulty
          let dmgA, dmgB;
          if (a === this.player) {
            // bot 'b' damaging player 'a' = botDmgMult; player 'a' damaging bot 'b' = playerDmgMult
            dmgA = baseDmg * this.difficulty.botDmgMult;
            dmgB = baseDmg * this.difficulty.playerDmgMult;
          } else if (b === this.player) {
            dmgB = baseDmg * this.difficulty.botDmgMult;
            dmgA = baseDmg * this.difficulty.playerDmgMult;
          } else {
            dmgA = dmgB = baseDmg * 0.25;
          }
          a.takeDamage(dmgA, b);
          b.takeDamage(dmgB, a);
          if (!a.alive) this._handleKill(b, a, false);
          if (!b.alive) this._handleKill(a, b, false);
        }
      }
    }
  }

  _applyTornado(dt) {
    const t = this.world.tornado;
    for (const p of this.pugs) {
      if (!p.alive) continue;
      const dx = p.x - t.x, dy = p.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < t.radius) {
        // Push outward (gentle)
        if (d > 1) {
          p.vx += (dx / d) * 200 * dt;
          p.vy += (dy / d) * 200 * dt;
        }
        p.takeDamage(t.damage * dt, null);
        if (!p.alive) this._handleKill(null, p, false);
      }
    }
  }

  _applyZone(dt) {
    for (const p of this.pugs) {
      if (!p.alive) continue;
      if (!this.world.pointInSafeZone(p.x, p.y)) {
        p.takeDamage(28 * dt, null);
        if (!p.alive) this._handleKill(null, p, true);
      }
    }
  }

  _updateHydrants(dt) {
    for (const h of this.world.hydrants) {
      if (!h.ready) continue;
      // If ANY pug bumps a hydrant, it triggers
      for (const p of this.pugs) {
        if (!p.alive) continue;
        const dx = p.x - h.x, dy = p.y - h.y;
        const r = p.form.radius + 14;
        if (dx * dx + dy * dy < r * r) {
          this._triggerHydrant(h, p);
          break;
        }
      }
    }
  }

  _triggerHydrant(h, byPug) {
    h.ready = false;
    h.cooldownT = 12;
    h.g.tint = 0x444444;
    // Big AOE knockback (no damage)
    this._spawnBorkRing(h.x, h.y, 180);
    this._screenShake(4, 0.2);
    for (const p of this.pugs) {
      if (!p.alive) continue;
      const dx = p.x - h.x, dy = p.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d < 220 && d > 1) {
        const k = 1 - d / 220;
        p.vx += (dx / d) * 600 * k;
        p.vy += (dy / d) * 600 * k;
      }
    }
    if (byPug === this.player) this.hud.toastMessage('💦 hydrant blast!', 'info');
  }

  _findById(id) {
    return this.pugs.find((p) => p.id === id) || null;
  }

  _handleKill(killer, victim, byZone) {
    victim.alive = false;
    this._spawnRandomDeathEffect(victim.x, victim.y);
    // Audio — kill sound, louder when player kills or is killed
    if (killer === this.player || victim === this.player) Sfx.kill();
    // Combo system: if player chained kill within 3s, grow combo
    if (killer === this.player) {
      const now = this.matchTime;
      const COMBO_WINDOW = 3.0;
      if (this._comboLast && (now - this._comboLast) < COMBO_WINDOW) {
        this._combo = (this._combo || 1) + 1;
      } else {
        this._combo = 1;
      }
      this._comboLast = now;
      this._comboExpiresAt = now + COMBO_WINDOW;
      this._updateComboUI();
    }
    // Drop energy (treats → money for player)
    this.energy.spawnBurst(victim.x, victim.y, 6 + victim.form.tier * 3, 6);
    // ~32% chance to drop a power-up (handled inside PowerupManager)
    if (this.powerups) this.powerups.maybeSpawnAt(victim.x, victim.y);
    // Drop killed bot's weapon as a pickup (so player can grab guns)
    if (victim !== this.player && victim.weapon && this.weaponDrops) {
      this.weaponDrops.spawn(victim.x, victim.y, victim.weapon, victim.skin);
    }
    // Audience cheer
    this.audience.cheer();

    // === KILL + ASSIST XP awards (replaces orb-based XP) ===
    // Scaled by difficulty.xpMult
    const killXp = Math.round((10 + victim.form.tier * 4) * (this.difficulty ? this.difficulty.xpMult : 1));
    if (killer && killer.id) {
      killer.xp = (killer.xp || 0) + killXp;
      if (killer === this.player) {
        killer.energyForLevel = (killer.energyForLevel || 0) + killXp;
      }
    }
    // assists
    if (victim.recentDamagers) {
      for (const did of victim.recentDamagers) {
        if (killer && did === killer.id) continue;
        const damager = this._findById(did);
        if (!damager || !damager.alive) continue;
        damager.xp = (damager.xp || 0) + Math.round(killXp * 0.5);
        if (damager === this.player) {
          damager.energyForLevel = (damager.energyForLevel || 0) + Math.round(killXp * 0.5);
          this.hud.toastMessage(`+${Math.round(killXp * 0.5)} XP assist`, 'info');
        }
      }
    }
    // Check player level-up + evolve trigger AFTER xp grant
    if (killer === this.player) {
      this.hud.updateXp(this.player, XP_TO_EVOLVE[this.player.form.tier] || null);
      if (this.player.energyForLevel >= ENERGY_PER_LEVEL && !this.evolving) {
        this.player.energyForLevel -= ENERGY_PER_LEVEL;
        this.player.level += 1;
        this._openLevelUpMenu();
      }
      const need = XP_TO_EVOLVE[this.player.form.tier];
      const nextPool = TIER_POOLS[this.player.form.tier + 1];
      if (need && this.player.xp >= need && nextPool && nextPool.length > 0 && !this.evolving) {
        this._openEvolveMenu();
      }
    }
    // Bots auto-evolve too
    if (killer && killer !== this.player) {
      const need = XP_TO_EVOLVE[killer.form.tier];
      const nextPool = TIER_POOLS[killer.form.tier + 1];
      if (need && killer.xp >= need && nextPool && nextPool.length > 0) {
        killer.evolveTo(rndPick(nextPool));
      }
    }

    // Slow-mo + screen shake when player gets a kill
    if (killer === this.player) {
      this._slowmoT = 0.3;
      this._screenShake(8, 0.3);
      this._spawnKillBanner(this.player.x, this.player.y - 60);
    }
    // Toast
    const k = killer ? killer.name : 'THE ZONE';
    if (killer) killer.kills += 1;
    const text = killMessage(k, victim.name, byZone, Math.random);
    if (killer === this.player) {
      this.hud.toastMessage(text, 'kill');
    } else if (victim === this.player) {
      this.hud.toastMessage(text, 'death');
    } else if (Math.random() < 0.5) {
      this.hud.toastMessage(text, 'info');
    }
    // Remove visual after short delay; but for simplicity destroy now
    setTimeout(() => {
      try {
        this.pugsLayer.removeChild(victim.container);
        victim.destroy();
      } catch {}
      // remove from pugs list
      const idx = this.pugs.indexOf(victim);
      if (idx >= 0) this.pugs.splice(idx, 1);
    }, 50);
    // No bot respawns — clearing the field wins the match.
  }

  _applyPowerup(def) {
    const p = this.player;
    if (def.id === 'med') {
      p.heal(p.maxHp * 0.4);
      this.hud.toastMessage(`💊 ${def.name} +HP`, 'kill');
    } else if (def.id === 'ammo') {
      const w = p.weapon || defaultWeapon();
      p.ammo = w.magSize;
      p.reloading = false;
      p.reloadT = 0;
      this.hud.toastMessage(`📦 ${def.name} reloaded!`, 'kill');
    } else if (def.duration) {
      // Replace any existing buff of same id with a fresh timer
      const existing = p.buffs.findIndex((b) => b.def.id === def.id);
      if (existing >= 0) p.buffs.splice(existing, 1);
      p.buffs.push({ def, timeLeft: def.duration });
      this.hud.toastMessage(`${def.icon} ${def.name}!`, 'kill');
    }
    p.bark(def.name + '!');
  }

  _getEvolveOptions(pug) {
    const nextTier = pug.form.tier + 1;
    const pool = TIER_POOLS[nextTier];
    if (!pool || pool.length === 0) return [];
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(3, shuffled.length));
  }

  _openEvolveMenu() {
    this.evolving = true;
    const overlay = document.getElementById('evolve-overlay');
    const choices = document.getElementById('evolve-choices');
    choices.innerHTML = '';
    const opts = this._getEvolveOptions(this.player);
    for (const id of opts) {
      const f = FORMS[id];
      const card = document.createElement('div');
      card.className = 'evolve-card';
      card.innerHTML = `
        <div class="evolve-card__preview" id="prev-${id}"></div>
        <h3 class="evolve-card__name">${f.name}</h3>
        <div class="evolve-card__desc">
          ${f.desc}<br><br>
          <b>HP</b> ${f.hp} · <b>SPD</b> ${f.speed} · <b>DMG</b> ${f.projectileDamage}
        </div>
      `;
      card.addEventListener('click', () => this._chooseEvolution(id));
      choices.appendChild(card);
      // Render real Pixi preview into the card
      const previewEl = card.querySelector('.evolve-card__preview');
      const canvas = this._renderFormPreview(id);
      if (canvas) previewEl.appendChild(canvas);
    }
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
  }

  _renderFormPreview(formId) {
    try {
      const wrap = new Container();
      // bg panel
      const bg = new Graphics();
      bg.rect(0, 0, 96, 96).fill(0x1a0f2e);
      bg.rect(0, 0, 96, 96).stroke({ color: 0x4cc9f0, width: 2, alpha: 0.5 });
      wrap.addChild(bg);
      // character (drawn at origin in pug-local; offset and scale to fit frame)
      const inner = new Container();
      FORMS[formId].draw(inner);
      inner.x = 48; inner.y = 60;
      inner.scale.set(1.3);
      wrap.addChild(inner);
      const canvas = this.app.renderer.extract.canvas({
        target: wrap,
        frame: new Rectangle(0, 0, 96, 96),
        antialias: false,
      });
      canvas.style.width = '96px';
      canvas.style.height = '96px';
      canvas.style.imageRendering = 'pixelated';
      wrap.destroy({ children: true });
      return canvas;
    } catch (err) {
      console.warn('preview render failed', formId, err);
      return null;
    }
  }

  _openLevelUpMenu() {
    this.evolving = true; // pauses game loop similarly
    const overlay = document.getElementById('evolve-overlay');
    const choices = document.getElementById('evolve-choices');
    const titleEl = overlay.querySelector('.overlay__title');
    const subEl = overlay.querySelector('.overlay__sub');
    if (titleEl) titleEl.textContent = `LEVEL ${this.player.level}!`;
    if (subEl) subEl.textContent = 'Pick an upgrade. Such growth.';
    choices.innerHTML = '';
    // pick 3 random unique upgrades
    const pool = [...UPGRADES];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const opts = pool.slice(0, 3);
    for (const u of opts) {
      const card = document.createElement('div');
      card.className = 'evolve-card';
      card.innerHTML = `
        <div class="evolve-card__preview" style="font-size:42px;display:flex;align-items:center;justify-content:center;">
          ${this._upgradeEmoji(u.id)}
        </div>
        <h3 class="evolve-card__name">${u.name}</h3>
        <div class="evolve-card__desc">${u.desc}</div>
      `;
      card.addEventListener('click', () => this._chooseUpgrade(u));
      choices.appendChild(card);
    }
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
  }

  _upgradeEmoji(id) {
    return ({
      hp: '❤️', dmg: '💥', spd: '⚡', fire: '🔥',
      projspd: '🎯', regen: '✨', leech: '🩸', bork: '📢', maxhp_pct: '🛡️',
    }[id]) || '⭐';
  }

  _chooseUpgrade(upg) {
    upg.apply(this.player.bonus);
    // sync hp/maxHp if hp bonus changed
    this.player.maxHp = this.player.form.hp + this.player.bonus.hp;
    this.player.hp = Math.min(this.player.hp + 10, this.player.maxHp); // small heal on level
    const overlay = document.getElementById('evolve-overlay');
    overlay.hidden = true;
    overlay.classList.add('is-hidden');
    // restore evolve menu title for next time
    const titleEl = overlay.querySelector('.overlay__title');
    const subEl = overlay.querySelector('.overlay__sub');
    if (titleEl) titleEl.textContent = 'EVOLVE!';
    if (subEl) subEl.textContent = 'Pick your next form. Such choice.';
    this.evolving = false;
    this.player.bark('upgrayedd!');
    this.hud.toastMessage(`★ LEVEL ${this.player.level} — ${upg.name}`, 'kill');
    this.hud.updatePlayer(this.player);
    Sfx.levelUp();
  }

  _chooseEvolution(id) {
    const overlay = document.getElementById('evolve-overlay');
    overlay.hidden = true;
    overlay.classList.add('is-hidden');
    this.player.evolveTo(id);
    this.player.bark('such evolve!');
    this.evolving = false;
    this.hud.updatePlayer(this.player);
    this.hud.updateXp(this.player, XP_TO_EVOLVE[this.player.form.tier] || null);
    this._screenShake(6, 0.4);
    Sfx.evolve();
  }

  _triggerRandomEvent() {
    const ev = rndPick(RANDOM_EVENTS);
    this.hud.showEvent(ev.name, ev.desc);
    if (ev.name === 'TREAT STORM') {
      // Drop a bunch of treats around the safe zone
      const z = this.world.zone;
      for (let i = 0; i < 30; i++) {
        const x = z.x + Math.random() * z.w;
        const y = z.y + Math.random() * z.h;
        this.energy.spawnAt(x, y, 5);
      }
    } else if (ev.name === 'BONE DROP') {
      // Spawn one giant treat near tornado
      this.energy.spawnAt(this.world.width / 2 + (Math.random() - 0.5) * 80,
        this.world.height / 2 + (Math.random() - 0.5) * 80, 30);
    } else if (ev.name === 'FIREWORKS') {
      // Random booms
      this._screenShake(6, 1.5);
    } else if (ev.name === 'BORK FEST') {
      // Free bork for player
      this.player.borkCooldown = 0;
      this.hud.toastMessage('Free BORK!', 'kill');
    }
  }

  _updateComboUI() {
    const bubble = document.getElementById('combo-bubble');
    const text = document.getElementById('combo-text');
    const fill = document.getElementById('combo-bar-fill');
    if (!bubble || !text || !fill) return;
    if (!this._combo || this._combo < 2) {
      bubble.classList.remove('is-show');
      return;
    }
    const labels = ['', '', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA', 'HEXA', 'RAMPAGE'];
    const label = labels[this._combo] || 'MEGA';
    text.textContent = `${label} ×${this._combo}`;
    bubble.classList.add('is-show');
    // Tint hotter as combo grows
    bubble.style.borderColor = this._combo >= 4 ? 'var(--neon-pink)' : 'var(--neon-yellow)';
    bubble.style.color = this._combo >= 4 ? 'var(--neon-pink)' : 'var(--neon-yellow)';
    // Reset fill animation
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    requestAnimationFrame(() => {
      fill.style.transition = 'transform 3s linear';
      fill.style.transform = 'scaleX(0)';
    });
  }

  _tickCombo() {
    if (this._comboExpiresAt && this.matchTime >= this._comboExpiresAt) {
      this._combo = 0;
      this._comboExpiresAt = 0;
      this._updateComboUI();
    }
  }

  _endMatch(won) {
    if (!this.running) return; // guard against double-call
    this.running = false;
    const overlay = document.getElementById('end-overlay');
    document.getElementById('end-title').textContent = won ? 'SUCH WIN' : 'GAME OVER';
    document.getElementById('end-sub').textContent = won
      ? 'You did the bork. Last pug standing.'
      : 'You got bonked. Bork lives on.';
    document.getElementById('end-form').textContent = this.player.form.name;
    document.getElementById('end-kills').textContent = this.player.kills;
    const m = Math.floor(this.matchTime / 60);
    const s = Math.floor(this.matchTime % 60);
    document.getElementById('end-time').textContent =
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    // Submit run to local best-tracker
    const run = {
      score: this.player.kills,
      kills: this.player.kills,
      time: this.matchTime,
      form: this.player.form.name,
      won,
    };
    const { isNewBest, current } = submitRun('bork-battle', run);
    const bestRow = document.getElementById('end-best');
    if (bestRow) {
      const best = current || run;
      bestRow.innerHTML = `Best kills: <b>${best.kills}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
    }
    overlay.hidden = false;
    overlay.classList.remove('is-hidden');
    this.hud.hide();
    if (won) Sfx.win(); else Sfx.lose();
  }
}
