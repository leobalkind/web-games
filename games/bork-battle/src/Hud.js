// HTML-driven HUD. Game pushes state in; HUD updates DOM.
// Keeps the canvas free of pixi text noise and keeps fonts crisp.

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

  updateMinimap(world, pugs, player) {
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
    // pugs
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
        ctx.fillStyle = '#ff3a3a';
        ctx.fillRect(px - 1, py - 1, 3, 3);
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
    this.formName.textContent = pug.form.name;
    this.tierPip.textContent = `T${pug.form.tier}`;
    if (this.levelPip && pug.level != null) this.levelPip.textContent = `LV ${pug.level}`;
    const hpRatio = Math.max(0, pug.hp / pug.maxHp) * 100;
    this.hpFill.style.width = `${hpRatio}%`;
    this.hpText.textContent = `${Math.ceil(pug.hp)}/${pug.maxHp}`;
    // weapon/ammo
    const ammoFill = document.getElementById('hud-ammo-fill');
    const ammoText = document.getElementById('hud-ammo-text');
    const weaponName = document.getElementById('hud-weapon-name');
    const ammoBar = ammoFill && ammoFill.parentElement;
    if (pug.weapon && ammoFill) {
      weaponName.textContent = pug.weapon.name + (pug.skin && pug.skin.id !== 'default' ? ` · ${pug.skin.name}` : '');
      if (pug.reloading) {
        const k = 1 - pug.reloadT / pug.weapon.reloadTime;
        ammoFill.style.width = `${k * 100}%`;
        ammoText.textContent = 'RELOADING';
        ammoBar.classList.add('reloading');
      } else {
        const ratio = (pug.ammo / pug.weapon.magSize) * 100;
        ammoFill.style.width = `${ratio}%`;
        ammoText.textContent = `${pug.ammo}/${pug.weapon.magSize}`;
        ammoBar.classList.remove('reloading');
      }
    }
  }

  updateXp(pug, threshold) {
    if (threshold == null) {
      this.xpFill.style.width = `100%`;
      this.xpText.textContent = `MAX`;
    } else {
      const ratio = Math.min(1, pug.xp / threshold) * 100;
      this.xpFill.style.width = `${ratio}%`;
      this.xpText.textContent = `${Math.floor(pug.xp)}/${threshold}`;
    }
  }

  updateTimer(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  updateKills(n) { this.kills.textContent = n; }
  updateBotsLeft(alive, total) {
    if (this.botsLeft) this.botsLeft.textContent = `${alive}/${total}`;
  }
  updateMoney(amount) {
    const el = document.getElementById('hud-money');
    if (el) el.textContent = `${Math.floor(amount)}`;
  }

  updateZone(inSafe) {
    if (inSafe) {
      this.zone.textContent = 'SAFE';
      this.zoneRow.classList.remove('danger');
    } else {
      this.zone.textContent = 'DANGER!';
      this.zoneRow.classList.add('danger');
    }
  }

  updateLeaderboard(pugs, playerId) {
    const sorted = [...pugs].sort((a, b) => b.kills - a.kills || b.xp - a.xp);
    this.lbList.innerHTML = '';
    for (let i = 0; i < Math.min(8, sorted.length); i++) {
      const p = sorted[i];
      const li = document.createElement('li');
      if (p.id === playerId) li.classList.add('me');
      if (!p.alive) li.classList.add('dead');
      const left = document.createElement('span');
      left.textContent = `${i + 1}. ${p.name}`;
      const right = document.createElement('span');
      right.textContent = `${p.kills}`;
      li.appendChild(left); li.appendChild(right);
      this.lbList.appendChild(li);
    }
  }

  updateBork(charge) {
    this.borkFill.style.width = `${Math.round(charge * 100)}%`;
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
