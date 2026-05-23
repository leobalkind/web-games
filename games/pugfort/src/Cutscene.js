// =============================================================================
// INTRO CUTSCENE — Kennel King rises from the bottom while typewriter text
// crawls in. CRT vignette overlay. Deep oscillator drone. Click/Space/SKIP
// dismisses → resolves the returned Promise so caller can start the game.
//
// Usage:
//   import { playIntroCutscene } from './Cutscene.js';
//   await playIntroCutscene();  // resolves on dismissal
//   game.start();
//
// Self-contained DOM overlay — does NOT touch the pixi canvas. The Kennel
// King is rendered onto a small inline <canvas> using Canvas2D primitives.
// =============================================================================
export function playIntroCutscene() {
  return new Promise((resolve) => {
    // ============ DOM scaffold ============
    const overlay = document.createElement('div');
    overlay.id = 'pugfort-cutscene';
    overlay.className = 'pugfort-cutscene';
    overlay.innerHTML = `
      <div class="pf-cs__vignette"></div>
      <div class="pf-cs__scanlines"></div>
      <div class="pf-cs__top">
        <div class="pf-cs__line pf-cs__line--top" data-line="1"></div>
      </div>
      <canvas class="pf-cs__king" width="320" height="380"></canvas>
      <div class="pf-cs__mid">
        <div class="pf-cs__line pf-cs__line--mid" data-line="2"></div>
      </div>
      <div class="pf-cs__bottom">
        <div class="pf-cs__line pf-cs__line--prompt" data-line="3"></div>
      </div>
      <button class="pf-cs__skip" type="button">SKIP &raquo;</button>
    `;
    document.body.appendChild(overlay);

    // ============ Lines + typewriter ============
    const line1 = '> GENERATOR ONLINE. INTRUDER DETECTED.';
    const line2 = '"I AM THE KENNEL KING. YOU AND YOUR PRECIOUS CORE WILL NOT SURVIVE THE NIGHT. YOUR BONES WILL FEED MY HORDE."';
    const line3 = '[ CLICK TO BEGIN DEFENSE ]';

    const el1 = overlay.querySelector('[data-line="1"]');
    const el2 = overlay.querySelector('[data-line="2"]');
    const el3 = overlay.querySelector('[data-line="3"]');

    let dismissed = false;
    const typers = [];
    function typeInto(el, text, charsPerSec = 40, startDelayMs = 0) {
      return new Promise((res) => {
        const tick = (start) => {
          let i = 0;
          const startedAt = performance.now();
          const step = () => {
            if (dismissed) { el.textContent = text; res(); return; }
            const dt = (performance.now() - startedAt) / 1000;
            const target = Math.min(text.length, Math.floor(dt * charsPerSec));
            if (target > i) {
              el.textContent = text.slice(0, target);
              i = target;
            }
            if (i < text.length) { typers.push(requestAnimationFrame(step)); }
            else res();
          };
          typers.push(requestAnimationFrame(step));
        };
        if (startDelayMs > 0) setTimeout(tick, startDelayMs);
        else tick();
      });
    }

    // Kick off typewriters with staggered delays
    typeInto(el1, line1, 40, 200);
    typeInto(el2, line2, 38, 1400);
    typeInto(el3, line3, 50, 4000).then(() => {
      el3.classList.add('pf-cs__line--blink');
    });

    // ============ King canvas — pixel-art draw + rise animation ============
    const canvas = overlay.querySelector('.pf-cs__king');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let kingRiseT = 0;
    const RISE_DURATION = 4.2;
    let lastFrame = performance.now();
    let raf;
    function frame(now) {
      if (dismissed) return;
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      kingRiseT = Math.min(RISE_DURATION, kingRiseT + dt);
      drawKing(ctx, canvas.width, canvas.height, kingRiseT / RISE_DURATION, now / 1000);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // ============ Audio — 40Hz drone + occasional growls ============
    let audioCleanup = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const out = ac.createGain();
      out.gain.value = 0.0001;
      out.gain.linearRampToValueAtTime(0.18, ac.currentTime + 0.3);
      out.connect(ac.destination);

      const drone = ac.createOscillator();
      drone.type = 'sawtooth';
      drone.frequency.value = 40;
      const droneGain = ac.createGain();
      droneGain.gain.value = 0.6;
      const droneFilter = ac.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 220;
      drone.connect(droneFilter).connect(droneGain).connect(out);
      drone.start();

      // sub-bass second oscillator one octave down for thickness
      const sub = ac.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 28;
      const subGain = ac.createGain();
      subGain.gain.value = 0.45;
      sub.connect(subGain).connect(out);
      sub.start();

      // periodic growl bursts
      const growlTimer = setInterval(() => {
        if (dismissed) return;
        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140 + Math.random() * 40, ac.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.4);
        const g = ac.createGain();
        g.gain.setValueAtTime(0, ac.currentTime);
        g.gain.linearRampToValueAtTime(0.22, ac.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
        const f = ac.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 400;
        osc.connect(f).connect(g).connect(out);
        osc.start();
        osc.stop(ac.currentTime + 0.55);
      }, 1100);

      audioCleanup = () => {
        clearInterval(growlTimer);
        try {
          out.gain.cancelScheduledValues(ac.currentTime);
          out.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.2);
        } catch {}
        setTimeout(() => {
          try { drone.stop(); } catch {}
          try { sub.stop(); } catch {}
          try { ac.close(); } catch {}
        }, 260);
      };
    } catch (e) {
      // Audio context blocked or unavailable — silently degrade
    }

    // ============ Dismiss handlers ============
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      cancelAnimationFrame(raf);
      typers.forEach((t) => cancelAnimationFrame(t));
      if (audioCleanup) audioCleanup();
      overlay.classList.add('pf-cs--out');
      setTimeout(() => {
        overlay.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        resolve();
      }, 220);
    }
    function onClick(e) {
      // SKIP button click bubbles here too — that's fine, both dismiss
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    }
    function onKey(e) {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        dismiss();
      }
    }
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    // Skip button: explicit
    overlay.querySelector('.pf-cs__skip').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    });
  });
}

// =============================================================================
// drawKing — paints the Kennel King onto a 2D canvas. Rises from bottom-center,
// scaling up as `riseK` goes 0 → 1. `nowS` lets us pulse the rage aura.
// =============================================================================
function drawKing(ctx, W, H, riseK, nowS) {
  ctx.clearRect(0, 0, W, H);
  // ease-out
  const ease = 1 - Math.pow(1 - riseK, 3);
  // size grows from 60% to 100% of design size
  const scale = (0.55 + ease * 0.55);
  const px = Math.floor(W / 2);
  // y position: starts off-bottom, rises to 75% height
  const py = Math.floor(H + 100 - ease * (H * 0.5 + 100));

  // ground mist (orange-red haze under the boss)
  const mistGrad = ctx.createRadialGradient(px, py + 40, 4, px, py + 40, 160);
  mistGrad.addColorStop(0, 'rgba(255,80,40,0.55)');
  mistGrad.addColorStop(1, 'rgba(255,40,40,0)');
  ctx.fillStyle = mistGrad;
  ctx.beginPath();
  ctx.ellipse(px, py + 40, 180, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  // === RAGE AURA — pulsing red halo ===
  const pulse = 0.7 + 0.3 * Math.sin(nowS * 5);
  const aura = ctx.createRadialGradient(0, -10, 20, 0, -10, 140);
  aura.addColorStop(0, `rgba(255,80,80,${0.45 * pulse})`);
  aura.addColorStop(0.6, `rgba(200,40,32,${0.22 * pulse})`);
  aura.addColorStop(1, 'rgba(200,40,32,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, -10, 140, 0, Math.PI * 2); ctx.fill();
  // jagged rage spikes
  ctx.strokeStyle = 'rgba(255,40,32,0.7)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + nowS * 0.6;
    const r1 = 110;
    const r2 = 130 + Math.sin(nowS * 4 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }

  // === SHADOW ===
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath(); ctx.ellipse(0, 70, 70, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0, 70, 50, 9, 0, 0, Math.PI * 2); ctx.fill();

  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // === BODY (massive bloated zombie pug) ===
  ctx.fillStyle = '#6a1a2a';
  ctx.beginPath(); ctx.ellipse(0, 28, 76, 52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a0a14'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 28, 76, 52, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(138,58,74,0.5)';
  ctx.beginPath(); ctx.ellipse(-16, 20, 52, 32, 0, 0, Math.PI * 2); ctx.fill();

  // infection lumps
  ctx.fillStyle = 'rgba(74,26,42,0.85)';
  ctx.beginPath(); ctx.arc(-28, 32, 10, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(24, 20, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(200,40,32,0.7)';
  ctx.beginPath(); ctx.arc(16, 44, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-24, 44, 6, 0, Math.PI * 2); ctx.fill();

  // === ARMOR PLATES ===
  rect(-60, -4, 24, 36, '#4a4a52');
  rect(36, -4, 24, 36, '#4a4a52');
  rect(-60, -4, 24, 8, '#7a7a84');
  rect(36, -4, 24, 8, '#7a7a84');
  rect(-60, 28, 24, 4, '#222228');
  rect(36, 28, 24, 4, '#222228');
  // chest plate
  rect(-24, 12, 48, 36, '#5a5a64');
  rect(-24, 12, 48, 6, '#7a7a84');
  // crown emblem
  rect(-6, 22, 12, 8, '#ffd23f');

  // === CHAINS — heavy iron chains across body ===
  ctx.fillStyle = '#4a4a52';
  for (let i = -56; i <= 56; i += 10) {
    ctx.beginPath(); ctx.arc(i, 16, 4, 0, Math.PI * 2); ctx.fill();
  }
  // padlock dangling
  ctx.fillStyle = '#6a5a10';
  ctx.fillRect(-58, 50, 12, 10);
  ctx.fillStyle = '#aa9a30';
  ctx.fillRect(-58, 50, 12, 2);

  // === LEGS ===
  rect(-52, 48, 16, 24, '#4a0a14');
  rect(36, 48, 16, 24, '#4a0a14');
  rect(-44, 60, 16, 20, '#3a0a14');
  rect(28, 60, 16, 20, '#3a0a14');
  // bone claws
  rect(-52, 68, 16, 8, '#fde0b8');
  rect(36, 68, 16, 8, '#fde0b8');

  // === HEAD ===
  ctx.fillStyle = '#6a1a2a';
  ctx.beginPath(); ctx.ellipse(0, -20, 52, 44, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a0a14'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, -20, 52, 44, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(138,58,74,0.5)';
  ctx.beginPath(); ctx.ellipse(-12, -28, 36, 24, 0, 0, Math.PI * 2); ctx.fill();

  // === DROP EARS (huge, torn) ===
  rect(-52, -44, 12, 24, '#4a0a14');
  rect(40, -40, 10, 20, '#4a0a14');
  rect(-50, -34, 6, 6, '#c46688');
  rect(42, -32, 5, 5, '#c46688');

  // === BIG GAUDY CROWN ===
  rect(-40, -60, 80, 12, '#ffd23f');
  rect(-40, -60, 80, 4, '#fff0a8');
  // spikes (5 alternating bone + gold)
  rect(-36, -76, 8, 16, '#fde0b8');
  rect(-20, -84, 8, 24, '#ffd23f');
  rect(-4, -92, 8, 32, '#fde0b8');   // CENTERPIECE — tallest
  rect(12, -84, 8, 24, '#ffd23f');
  rect(28, -76, 8, 16, '#fde0b8');
  // gems
  ctx.fillStyle = '#c8281f';
  ctx.beginPath(); ctx.arc(-20, -54, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4cc9f0';
  ctx.beginPath(); ctx.arc(0, -54, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8281f';
  ctx.beginPath(); ctx.arc(20, -54, 3, 0, Math.PI * 2); ctx.fill();
  // blood-drip apex
  rect(-2, -66, 4, 8, '#c8281f');

  // === EYES — 4 glowing crimson, pulsing ===
  const eyePulse = 0.7 + 0.3 * Math.sin(nowS * 6);
  ctx.fillStyle = `rgba(255,48,48,${eyePulse})`;
  ctx.beginPath(); ctx.arc(-16, -20, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -20, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff3030';
  ctx.beginPath(); ctx.arc(-16, -20, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -20, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd0d0';
  ctx.beginPath(); ctx.arc(-16, -20, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, -20, 4, 0, Math.PI * 2); ctx.fill();
  // secondary smaller eye pair
  ctx.fillStyle = '#ff3030';
  ctx.beginPath(); ctx.arc(-28, -8, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(28, -8, 4, 0, Math.PI * 2); ctx.fill();

  // === SNARLING MAW ===
  ctx.fillStyle = '#000';
  ctx.fillRect(-20, -4, 40, 16);
  // teeth (top)
  ctx.fillStyle = '#fff';
  for (let i = -18; i <= 14; i += 8) ctx.fillRect(i, -2, 4, 6);
  // teeth (bottom)
  for (let i = -14; i <= 10; i += 8) ctx.fillRect(i, 8, 4, 4);
  // blood drool
  ctx.fillStyle = '#c8281f';
  ctx.fillRect(-4, 12, 2, 8);
  ctx.fillRect(6, 12, 2, 6);

  ctx.restore();
}
