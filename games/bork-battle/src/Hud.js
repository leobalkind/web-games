// HTML-driven HUD. Game pushes state in; HUD updates DOM.
// Keeps the canvas free of pixi text noise and keeps fonts crisp.
import { drawIcon } from '../../../src/shared/icons.js';

export class Hud {
  constructor() {
    this.formName = document.getElementById('hud-form-name');
    this.tierPip = document.getElementById('hud-tier-pip');
    this.levelPip = document.getElementById('hud-level-pip');
    this.hpFill = document.getElementById('hud-hp-fill');
    this.hpText = document.getElementById('hud-hp-text');
    this.xpFill = document.getElementById('hud-xp-fill');
    this.xpText = document.getElementById('hud-xp-text');
    this.timer = document.getElementById('hud-timer');
    this.kills = document.getElementById('hud-kills');
    this.botsLeft = document.getElementById('hud-bots-left');
    this.zone = document.getElementById('hud-zone');
    this.zoneRow = this.zone.parentElement;
    this.lbList = document.getElementById('hud-lb-list');
    this.event = document.getElementById('hud-event');
    this.borkFill = document.getElementById('hud-bork-fill');
    this.toast = document.getElementById('hud-toast');
    this.overlay = document.getElementById('hud-overlay');
    this.minimap = document.getElementById('hud-minimap');
    this.minimapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.screenFlash = document.getElementById('screen-flash');
    // Perf: cache hot-path DOM refs that were previously fetched every frame.
    this._ammoFill = document.getElementById('hud-ammo-fill');
    this._ammoText = document.getElementById('hud-ammo-text');
    this._weaponName = document.getElementById('hud-weapon-name');
    this._ammoBar = this._ammoFill && this._ammoFill.parentElement;
    this._moneyEl = document.getElementById('hud-money');
    // Cached prev values — only touch DOM when something actually changed.
    this._prev = {
      formName: '', tier: '', level: '', hpPct: -1, hpText: '', critical: null,
      weapon: '', ammoText: '', ammoPct: -1, reloading: null,
      xpPct: -1, xpText: '', timer: '', kills: -1, botsLeft: '', money: -1,
      zoneSafe: null, bork: -1, borkReady: null,
    };
    // Ability chips (DASH/DECOY/HEAL) — render the icon ONCE and reuse.
    this._chipDash  = document.getElementById('hud-chip-dash');
    this._chipDecoy = document.getElementById('hud-chip-decoy');
    this._chipHeal  = document.getElementById('hud-chip-heal');
    this._paintChipIcon(this._chipDash,  'lightning');
    this._paintChipIcon(this._chipDecoy, 'pugFace');
    this._paintChipIcon(this._chipHeal,  'heart');
  }

  _paintChipIcon(chipEl, iconName) {
    if (!chipEl) return;
    const c = chipEl.querySelector('canvas.ability-chip__icon');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx || !drawIcon[iconName]) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawIcon[iconName](ctx, c.width / 2, c.height / 2, c.width);
  }

  // Receive ability cooldown readiness (1.0 = ready, 0.0 = just used).
  // Drives the conic-gradient sweep on each chip + the ready-pulse animation.
  updateAbilities({ dash, decoy, heal }) {
    if (this._chipDash)  this._setChipState(this._chipDash,  dash);
    if (this._chipDecoy) this._setChipState(this._chipDecoy, decoy);
    if (this._chipHeal)  this._setChipState(this._chipHeal,  heal);
  }
  _setChipState(chipEl, ready) {
    chipEl.style.setProperty('--cd', String(Math.max(0, Math.min(1, ready))));
    if (ready >= 0.999) chipEl.classList.add('ability-chip--ready');
    else chipEl.classList.remove('ability-chip--ready');
  }

  flashScreen(intensity = 1) {
    if (!this.screenFlash) return;
    this.screenFlash.classList.remove('flash-fade');
    this.screenFlash.classList.add('flash-on');
    this.screenFlash.style.opacity = String(Math.min(1, intensity));
    // remove + fade out
    setTimeout(() => {
      this.screenFlash.classList.remove('flash-on');
      this.screenFlash.classList.add('flash-fade');
      this.screenFlash.style.opacity = '0';
    }, 60);
  }

  updateMinimap(world, pugs, player, opts = {}) {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const W = this.minimap.width, H = this.minimap.height;
    const sx = W / world.width, sy = H / world.height;
    // bg
    ctx.fillStyle = '#110a26';
    ctx.fillRect(0, 0, W, H);
    // safe zone fill
    const z = world.zone;
    ctx.fillStyle = 'rgba(94, 243, 140, 0.08)';
    ctx.fillRect(z.x * sx, z.y * sy, z.w * sx, z.h * sy);
    // danger overlay outside
    ctx.fillStyle = 'rgba(255, 43, 214, 0.18)';
    if (z.y > 0) ctx.fillRect(0, 0, W, z.y * sy);
    if (z.y + z.h < world.height) ctx.fillRect(0, (z.y + z.h) * sy, W, H - (z.y + z.h) * sy);
    if (z.x > 0) ctx.fillRect(0, z.y * sy, z.x * sx, z.h * sy);
    if (z.x + z.w < world.width) ctx.fillRect((z.x + z.w) * sx, z.y * sy, W - (z.x + z.w) * sx, z.h * sy);
    // zone border
    ctx.strokeStyle = '#ff2bd6';
    ctx.lineWidth = 1;
    ctx.strokeRect(z.x * sx + 0.5, z.y * sy + 0.5, z.w * sx - 1, z.h * sy - 1);
    // Hazards — show as colored circles on the minimap (poison green, wet cyan)
    if (world.hazards) {
      for (const h of world.hazards) {
        ctx.fillStyle = h.kind === 'poison' ? 'rgba(106, 170, 58, 0.55)' : 'rgba(76, 201, 240, 0.5)';
        ctx.beginPath();
        ctx.arc(h.x * sx, h.y * sy, Math.max(2, h.r * sx), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Objectives — gold star for available ones
    if (world.objectives) {
      for (const ob of world.objectives) {
        if (ob.state !== 'available') continue;
        ctx.fillStyle = ob.kind === 'beef' ? '#ff5a3a' : '#4cc9f0';
        ctx.fillRect(Math.floor(ob.x * sx) - 2, Math.floor(ob.y * sy) - 2, 4, 4);
      }
    }
    // tornado
    if (world.tornado) {
      ctx.fillStyle = 'rgba(255, 58, 161, 0.6)';
      ctx.beginPath();
      ctx.arc(world.tornado.x * sx, world.tornado.y * sy, Math.max(2, world.tornado.radius * sx), 0, Math.PI * 2);
      ctx.fill();
    }
    // fountains (treats)
    for (const f of world.fountains) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(Math.floor(f.x * sx) - 1, Math.floor(f.y * sy) - 1, 2, 2);
    }
    // pugs — under RADIO reveal mode, bots pulse and are larger.
    const reveal = !!opts.reveal;
    for (const p of pugs) {
      if (!p.alive) continue;
      const px = Math.floor(p.x * sx);
      const py = Math.floor(p.y * sy);
      if (p === player) {
        // larger yellow square + ring
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(px - 2, py - 2, 4, 4);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(px - 2.5, py - 2.5, 5, 5);
      } else {
        if (reveal) {
          // Pulsing red dot for revealed bots
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
          ctx.fillStyle = `rgba(255, 58, 58, ${0.55 + pulse * 0.4})`;
          ctx.fillRect(px - 2, py - 2, 4, 4);
        } else {
          ctx.fillStyle = '#ff3a3a';
          ctx.fillRect(px - 1, py - 1, 3, 3);
        }
      }
    }
  }

  show() {
    this.overlay.hidden = false;
    this.overlay.classList.remove('is-hidden');
  }
  hide() {
    this.overlay.hidden = true;
    this.overlay.classList.add('is-hidden');
  }

  updatePlayer(pug) {
    const P = this._prev;
    if (pug.form.name !== P.formName) { this.formName.textContent = pug.form.name; P.formName = pug.form.name; }
    const tier = `T${pug.form.tier}`;
    if (tier !== P.tier) { this.tierPip.textContent = tier; P.tier = tier; }
    if (this.levelPip && pug.level != null) {
      const lv = `LV ${pug.level}`;
      if (lv !== P.level) { this.levelPip.textContent = lv; P.level = lv; }
    }
    const hpRatio = Math.max(0, pug.hp / pug.maxHp) * 100;
    const hpPctRounded = Math.round(hpRatio * 10) / 10;
    if (hpPctRounded !== P.hpPct) { this.hpFill.style.width = `${hpRatio}%`; P.hpPct = hpPctRounded; }
    const hpStr = `${Math.ceil(pug.hp)}/${pug.maxHp}`;
    if (hpStr !== P.hpText) { this.hpText.textContent = hpStr; P.hpText = hpStr; }
    // Pulse the player HUD card border red when HP is critical.
    // Pulse intensifies (faster + brighter) as HP drops below 25% → 0%.
    if (!this._playerCard) this._playerCard = this.formName ? this.formName.closest('.hud-card') : null;
    if (this._playerCard) {
      const crit = pug.alive && hpRatio < 25;
      if (crit) {
        if (P.critical !== true) {
          this._playerCard.classList.add('hud-card--critical');
          P.critical = true;
        }
        // Map hpRatio 0..25 → speed 0.32s..0.6s + glow 0.5..0.95.
        // Continuous value — must update every frame in critical state.
        const t = Math.max(0, Math.min(1, hpRatio / 25));
        const speed = (0.32 + t * 0.28).toFixed(2);
        const glow  = (0.55 + (1 - t) * 0.4).toFixed(2);
        this._playerCard.style.setProperty('--crit-speed', speed + 's');
        this._playerCard.style.setProperty('--crit-glow', glow);
      } else if (P.critical !== false) {
        this._playerCard.classList.remove('hud-card--critical');
        P.critical = false;
      }
    }
    // weapon/ammo — DOM refs now cached in constructor.
    if (pug.weapon && this._ammoFill) {
      const wn = pug.weapon.name + (pug.skin && pug.skin.id !== 'default' ? ` · ${pug.skin.name}` : '');
      if (wn !== P.weapon) { this._weaponName.textContent = wn; P.weapon = wn; }
      if (pug.reloading) {
        const k = 1 - pug.reloadT / pug.weapon.reloadTime;
        const pct = Math.round(k * 1000) / 10;
        if (pct !== P.ammoPct) { this._ammoFill.style.width = `${k * 100}%`; P.ammoPct = pct; }
        if (P.ammoText !== 'RELOADING') { this._ammoText.textContent = 'RELOADING'; P.ammoText = 'RELOADING'; }
        if (P.reloading !== true) { this._ammoBar.classList.add('reloading'); P.reloading = true; }
      } else {
        const ratio = (pug.ammo / pug.weapon.magSize) * 100;
        const pct = Math.round(ratio * 10) / 10;
        if (pct !== P.ammoPct) { this._ammoFill.style.width = `${ratio}%`; P.ammoPct = pct; }
        const at = `${pug.ammo}/${pug.weapon.magSize}`;
        if (at !== P.ammoText) { this._ammoText.textContent = at; P.ammoText = at; }
        if (P.reloading !== false) { this._ammoBar.classList.remove('reloading'); P.reloading = false; }
      }
    }
  }

  updateXp(pug, threshold) {
    const P = this._prev;
    if (threshold == null) {
      if (P.xpText !== 'MAX') {
        this.xpFill.style.width = `100%`;
        this.xpText.textContent = `MAX`;
        P.xpText = 'MAX'; P.xpPct = 100;
      }
    } else {
      const ratio = Math.min(1, pug.xp / threshold) * 100;
      const pct = Math.round(ratio * 10) / 10;
      if (pct !== P.xpPct) { this.xpFill.style.width = `${ratio}%`; P.xpPct = pct; }
      const t = `${Math.floor(pug.xp)}/${threshold}`;
      if (t !== P.xpText) { this.xpText.textContent = t; P.xpText = t; }
    }
  }

  updateTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const txt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (txt !== this._prev.timer) { this.timer.textContent = txt; this._prev.timer = txt; }
  }

  updateKills(n) {
    if (n !== this._prev.kills) { this.kills.textContent = n; this._prev.kills = n; }
  }
  updateBotsLeft(alive, total) {
    if (!this.botsLeft) return;
    const t = `${alive}/${total}`;
    if (t !== this._prev.botsLeft) { this.botsLeft.textContent = t; this._prev.botsLeft = t; }
  }
  updateMoney(amount) {
    if (!this._moneyEl) return;
    const m = Math.floor(amount);
    if (m !== this._prev.money) { this._moneyEl.textContent = `${m}`; this._prev.money = m; }
  }

  updateZone(inSafe) {
    if (inSafe === this._prev.zoneSafe) return;
    if (inSafe) {
      this.zone.textContent = 'SAFE';
      this.zoneRow.classList.remove('danger');
    } else {
      this.zone.textContent = 'DANGER!';
      this.zoneRow.classList.add('danger');
    }
    this._prev.zoneSafe = inSafe;
  }

  updateLeaderboard(pugs, playerId) {
    // Perf: reuse <li> children instead of full innerHTML rebuild per frame.
    // Sort works in-place on a cached scratch buffer to avoid spread allocs.
    if (!this._lbScratch) this._lbScratch = [];
    const scratch = this._lbScratch;
    scratch.length = 0;
    for (const p of pugs) scratch.push(p);
    scratch.sort((a, b) => b.kills - a.kills || b.xp - a.xp);
    const need = Math.min(8, scratch.length);
    // Grow / shrink existing <li> children to match `need`
    while (this.lbList.children.length < need) {
      const li = document.createElement('li');
      const left = document.createElement('span');
      const right = document.createElement('span');
      li.appendChild(left); li.appendChild(right);
      this.lbList.appendChild(li);
    }
    while (this.lbList.children.length > need) {
      this.lbList.removeChild(this.lbList.lastChild);
    }
    for (let i = 0; i < need; i++) {
      const p = scratch[i];
      const li = this.lbList.children[i];
      const isMe = p.id === playerId;
      const dead = !p.alive;
      // toggle classes only if changed
      if (li._isMe !== isMe) { li.classList.toggle('me', isMe); li._isMe = isMe; }
      if (li._dead !== dead) { li.classList.toggle('dead', dead); li._dead = dead; }
      const lt = `${i + 1}. ${p.name}`;
      if (li.children[0].textContent !== lt) li.children[0].textContent = lt;
      const rt = `${p.kills}`;
      if (li.children[1].textContent !== rt) li.children[1].textContent = rt;
    }
  }

  updateBork(charge) {
    const pct = Math.round(charge * 100);
    if (pct !== this._prev.bork) { this.borkFill.style.width = `${pct}%`; this._prev.bork = pct; }
    // Dramatic visual at near-full charge — pulse + extra glow
    if (!this._borkBar) this._borkBar = this.borkFill ? this.borkFill.parentElement : null;
    if (this._borkBar) {
      const ready = charge >= 0.95;
      if (ready !== this._prev.borkReady) {
        this._borkBar.classList.toggle('ability-bar--ready', ready);
        this._prev.borkReady = ready;
      }
    }
  }

  showEvent(name, desc) {
    this.event.hidden = false;
    this.event.textContent = `★ ${name} ★`;
    this.event.style.animation = 'none';
    void this.event.offsetWidth;
    this.event.style.animation = '';
    setTimeout(() => { this.event.hidden = true; }, 2500);
  }

  toastMessage(text, kind = 'info') {
    const div = document.createElement('div');
    div.className = `hud-toast__msg ${kind}`;
    div.textContent = text;
    this.toast.appendChild(div);
    setTimeout(() => div.remove(), 4200);
  }
}
