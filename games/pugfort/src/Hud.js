// HTML HUD updater. Game pushes state in; HUD reflects it.
export class Hud {
  constructor() {
    this.hp = document.getElementById('hud-hp');
    this.hpFill = document.getElementById('hud-hp-fill');
    this.stamFill = document.getElementById('hud-stam-fill');
    this.stamText = document.getElementById('hud-stam-text');
    this.wood = document.getElementById('hud-wood');
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

  updateResources(wood, kills) {
    this.wood.textContent = wood;
    this.kills.textContent = kills;
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
    // Clear all
    if (this.slotWall) this.slotWall.classList.remove('hud-slot--armed');
    if (this.slotTurret) this.slotTurret.classList.remove('hud-slot--armed');
    if (this.buildHint) this.buildHint.hidden = !active;
    if (!active) return;
    if (id === 'wall' && this.slotWall) this.slotWall.classList.add('hud-slot--armed');
    if (id === 'turret' && this.slotTurret) this.slotTurret.classList.add('hud-slot--armed');
  }

  toastMessage(text, kind = 'info') {
    const div = document.createElement('div');
    div.className = `hud-toast__msg ${kind}`;
    div.textContent = text;
    this.toast.appendChild(div);
    setTimeout(() => div.remove(), 4200);
  }
}
