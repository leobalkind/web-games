// HTML HUD updater. Game pushes state in; HUD reflects it.
export class Hud {
  constructor() {
    this.hp = document.getElementById('hud-hp');
    this.hpFill = document.getElementById('hud-hp-fill');
    this.stamFill = document.getElementById('hud-stam-fill');
    this.stamText = document.getElementById('hud-stam-text');
    this.wood = document.getElementById('hud-wood');
    this.scrap = document.getElementById('hud-scrap');
    this.explosives = document.getElementById('hud-explosives');
    this.electronics = document.getElementById('hud-electronics');
    this.kills = document.getElementById('hud-kills');
    this.night = document.getElementById('hud-night');
    this.phase = document.getElementById('hud-phase');
    this.phaseFill = document.getElementById('hud-phase-fill');
    this.phaseFillRow = this.phaseFill ? this.phaseFill.parentElement : null;
    this.phaseTime = document.getElementById('hud-phase-time');
    this.slotWall = document.getElementById('slot-wall');
    this.slotTurret = document.getElementById('slot-turret');
    this.buildHint = document.getElementById('hud-build-hint');
    this.toast = document.getElementById('hud-toast');
    this.overlay = document.getElementById('hud');
    this.genHp = document.getElementById('hud-gen-hp');
    this.genFill = document.getElementById('hud-gen-fill');
    // Boss-bar DOM cached so updateBoss() doesn't re-query each frame.
    this._bossEl = document.getElementById('hud-boss');
    this._bossFill = document.getElementById('hud-boss-fill');
    this._bossHp = document.getElementById('hud-boss-hp');
    // Perf: prev-value cache — only touch DOM when something actually changed.
    this._prev = {
      hp: '', hpPct: -1, stamPct: -1, stam: '',
      wood: -1, scrap: -1, explosives: -1, electronics: -1, kills: -1,
      night: '', phase: '', phasePct: -1, night_class: null,
      phaseTime: '', genHp: '', genPct: -1, bossHp: -1, bossPct: -1, bossHidden: null,
    };
  }

  updateGenerator(gen) {
    if (!this.genHp || !gen) return;
    const t = `${Math.ceil(gen.hp)}/${gen.maxHp}`;
    if (t !== this._prev.genHp) { this.genHp.textContent = t; this._prev.genHp = t; }
    const r = Math.max(0, gen.hp / gen.maxHp) * 100;
    const pct = Math.round(r * 10) / 10;
    if (pct !== this._prev.genPct) { this.genFill.style.width = `${r}%`; this._prev.genPct = pct; }
  }

  showBoss(boss) {
    if (!this._bossEl || !boss) return;
    this._bossEl.hidden = false;
    this._prev.bossHidden = false;
    const max = document.getElementById('hud-boss-max');
    if (max) max.textContent = boss.maxHp;
    this.updateBoss(boss);
  }
  updateBoss(boss) {
    if (!boss || !this._bossEl || !this._bossFill) return;
    if (!boss.alive) {
      if (this._prev.bossHidden !== true) { this._bossEl.hidden = true; this._prev.bossHidden = true; }
      return;
    }
    if (this._prev.bossHidden !== false) { this._bossEl.hidden = false; this._prev.bossHidden = false; }
    const hp = Math.ceil(boss.hp);
    if (hp !== this._prev.bossHp) { this._bossHp.textContent = hp; this._prev.bossHp = hp; }
    const pct = Math.round((boss.hp / boss.maxHp) * 1000) / 10;
    if (pct !== this._prev.bossPct) { this._bossFill.style.width = `${(boss.hp / boss.maxHp) * 100}%`; this._prev.bossPct = pct; }
  }
  hideBoss() {
    if (this._bossEl && this._prev.bossHidden !== true) {
      this._bossEl.hidden = true;
      this._prev.bossHidden = true;
    }
  }

  show() { this.overlay.hidden = false; this.overlay.classList.remove('is-hidden'); }
  hide() { this.overlay.hidden = true; this.overlay.classList.add('is-hidden'); }

  updatePlayer(player) {
    const P = this._prev;
    const t = `${Math.ceil(player.hp)}/${player.maxHp}`;
    if (t !== P.hp) { this.hp.textContent = t; P.hp = t; }
    const ratio = Math.max(0, player.hp / player.maxHp) * 100;
    const pct = Math.round(ratio * 10) / 10;
    if (pct !== P.hpPct) { this.hpFill.style.width = `${ratio}%`; P.hpPct = pct; }
    const sRatio = Math.max(0, player.stam / player.maxStam) * 100;
    const sPct = Math.round(sRatio * 10) / 10;
    if (sPct !== P.stamPct) { this.stamFill.style.width = `${sRatio}%`; P.stamPct = sPct; }
    const st = `${Math.ceil(player.stam)}`;
    if (st !== P.stam) { this.stamText.textContent = st; P.stam = st; }
  }

  updateResources(res, kills) {
    const P = this._prev;
    if (this.wood) {
      const v = Math.floor(res.wood || 0);
      if (v !== P.wood) { this.wood.textContent = v; P.wood = v; }
    }
    if (this.scrap) {
      const v = Math.floor(res.scrap || 0);
      if (v !== P.scrap) { this.scrap.textContent = v; P.scrap = v; }
    }
    if (this.explosives) {
      const v = Math.floor(res.explosives || 0);
      if (v !== P.explosives) { this.explosives.textContent = v; P.explosives = v; }
    }
    if (this.electronics) {
      const v = Math.floor(res.electronics || 0);
      if (v !== P.electronics) { this.electronics.textContent = v; P.electronics = v; }
    }
    if (this.kills && kills !== P.kills) { this.kills.textContent = kills; P.kills = kills; }
  }

  updatePhase(phase, night, total, k) {
    const P = this._prev;
    const n = `${night}/${total}`;
    if (n !== P.night) { this.night.textContent = n; P.night = n; }
    const ph = phase.toUpperCase();
    if (ph !== P.phase) { this.phase.textContent = ph; P.phase = ph; }
    const pct = Math.round(Math.max(0, Math.min(1, k)) * 1000) / 10;
    if (pct !== P.phasePct) { this.phaseFill.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`; P.phasePct = pct; }
    const isNight = phase === 'night';
    if (isNight !== P.night_class) {
      this.phaseFillRow.classList.toggle('night', isNight);
      P.night_class = isNight;
    }
  }

  updatePhaseTime(secsLeft) {
    const m = Math.max(0, Math.floor(secsLeft / 60));
    const s = Math.max(0, Math.floor(secsLeft % 60));
    const t = `${m}:${String(s).padStart(2, '0')}`;
    if (t !== this._prev.phaseTime) { this.phaseTime.textContent = t; this._prev.phaseTime = t; }
  }

  setBuildActive(active, id = null) {
    const ids = ['wall','sandbag','spike','mine','turret','sniperTurret','repair','acidTurret','genShield','flamethrower','barbedWire','turretPlatform'];
    for (const sid of ids) {
      const el = document.getElementById(`slot-${sid}`);
      if (el) el.classList.remove('hud-slot--armed');
    }
    if (this.buildHint) this.buildHint.hidden = !active;
    if (!active || !id) return;
    const armed = document.getElementById(`slot-${id}`);
    if (armed) armed.classList.add('hud-slot--armed');
  }

  // Toggle a locked-state class on a hotbar slot. Locked slots are dimmed and
  // show a small padlock badge via CSS.
  setSlotLocked(id, locked, reason = '') {
    const el = document.getElementById(`slot-${id}`);
    if (!el) return;
    el.classList.toggle('hud-slot--locked', !!locked);
    if (locked) {
      el.title = reason || 'Locked';
      el.dataset.lockReason = reason || 'Locked';
    } else {
      delete el.dataset.lockReason;
      el.title = '';
    }
  }

  toastMessage(text, kind = 'info') {
    const div = document.createElement('div');
    div.className = `hud-toast__msg ${kind}`;
    div.textContent = text;
    this.toast.appendChild(div);
    setTimeout(() => div.remove(), 4200);
  }

  // Big centered wave-start banner that fades out
  showWaveBanner(text) {
    let el = document.getElementById('pf-wave-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pf-wave-banner';
      el.className = 'pf-wave-banner';
      document.body.appendChild(el);
    }
    el.textContent = text;
    // restart the animation
    el.classList.remove('pf-wave-banner--show');
    void el.offsetWidth;
    el.classList.add('pf-wave-banner--show');
  }

  // Critical-state border pulses. `ratio` (0..1) optional → if set, pulse speed
  // scales with severity (lower HP = faster, brighter glow).
  setPlayerCritical(on, ratio) {
    const card = this.hp ? this.hp.closest('.hud-card') : null;
    if (!card) return;
    if (on) {
      card.classList.add('hud-card--critical');
      this._scaleCriticalPulse(card, ratio);
    } else card.classList.remove('hud-card--critical');
  }
  setGenCritical(on, ratio) {
    const card = this.genHp ? this.genHp.closest('.hud-card') : null;
    if (!card) return;
    if (on) {
      card.classList.add('hud-card--critical');
      this._scaleCriticalPulse(card, ratio);
    } else card.classList.remove('hud-card--critical');
  }
  _scaleCriticalPulse(card, ratio) {
    if (ratio == null) return;
    // ratio 0..1 (HP% within the critical band) → speed 0.32s..0.6s, glow 0.55..0.95
    const t = Math.max(0, Math.min(1, ratio));
    card.style.setProperty('--crit-speed', (0.32 + t * 0.28).toFixed(2) + 's');
    card.style.setProperty('--crit-glow', (0.55 + (1 - t) * 0.4).toFixed(2));
  }
}
