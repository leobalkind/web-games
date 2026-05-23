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
  }

  updateGenerator(gen) {
    if (!this.genHp || !gen) return;
    this.genHp.textContent = `${Math.ceil(gen.hp)}/${gen.maxHp}`;
    const r = Math.max(0, gen.hp / gen.maxHp) * 100;
    this.genFill.style.width = `${r}%`;
  }

  showBoss(boss) {
    const el = document.getElementById('hud-boss');
    if (!el || !boss) return;
    el.hidden = false;
    document.getElementById('hud-boss-max').textContent = boss.maxHp;
    this.updateBoss(boss);
  }
  updateBoss(boss) {
    if (!boss) return;
    const el = document.getElementById('hud-boss');
    const fill = document.getElementById('hud-boss-fill');
    const hp = document.getElementById('hud-boss-hp');
    if (!el || !fill) return;
    if (!boss.alive) { el.hidden = true; return; }
    el.hidden = false;
    hp.textContent = Math.ceil(boss.hp);
    fill.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  }
  hideBoss() {
    const el = document.getElementById('hud-boss');
    if (el) el.hidden = true;
  }

  show() { this.overlay.hidden = false; this.overlay.classList.remove('is-hidden'); }
  hide() { this.overlay.hidden = true; this.overlay.classList.add('is-hidden'); }

  updatePlayer(player) {
    this.hp.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    const ratio = Math.max(0, player.hp / player.maxHp) * 100;
    this.hpFill.style.width = `${ratio}%`;
    const sRatio = Math.max(0, player.stam / player.maxStam) * 100;
    this.stamFill.style.width = `${sRatio}%`;
    this.stamText.textContent = `${Math.ceil(player.stam)}`;
  }

  updateResources(res, kills) {
    if (this.wood)        this.wood.textContent        = Math.floor(res.wood || 0);
    if (this.scrap)       this.scrap.textContent       = Math.floor(res.scrap || 0);
    if (this.explosives)  this.explosives.textContent  = Math.floor(res.explosives || 0);
    if (this.electronics) this.electronics.textContent = Math.floor(res.electronics || 0);
    if (this.kills)       this.kills.textContent       = kills;
  }

  updatePhase(phase, night, total, k) {
    this.night.textContent = `${night}/${total}`;
    this.phase.textContent = phase.toUpperCase();
    this.phaseFill.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
    const isNight = phase === 'night';
    if (isNight) this.phaseFillRow.classList.add('night');
    else this.phaseFillRow.classList.remove('night');
  }

  updatePhaseTime(secsLeft) {
    const m = Math.max(0, Math.floor(secsLeft / 60));
    const s = Math.max(0, Math.floor(secsLeft % 60));
    this.phaseTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  setBuildActive(active, id = null) {
    const ids = ['wall','sandbag','spike','mine','turret','sniperTurret','repair','acidTurret','genShield','flamethrower'];
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

  // Critical-state border pulses
  setPlayerCritical(on) {
    const card = this.hp ? this.hp.closest('.hud-card') : null;
    if (!card) return;
    if (on) card.classList.add('hud-card--critical');
    else card.classList.remove('hud-card--critical');
  }
  setGenCritical(on) {
    const card = this.genHp ? this.genHp.closest('.hud-card') : null;
    if (!card) return;
    if (on) card.classList.add('hud-card--critical');
    else card.classList.remove('hud-card--critical');
  }
}
