// BOOP THE SNOOT — original reaction-rhythm game.
// Snoots appear at random positions with a shrinking target ring. Tap when the
// ring matches the snoot radius for PERFECT (3x), within an outer band for
// GOOD (1x), or you'll get MISS (combo break). Chains of PERFECTs build a
// combo multiplier. 60-second timed run.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const startOverlay = document.getElementById('overlay');
const endOverlay = document.getElementById('end-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('end-restart');
const muteBtn = document.getElementById('mute-btn');
const pauseBtn = document.getElementById('pause-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseResume = document.getElementById('pause-resume');
const pauseQuit = document.getElementById('pause-quit');
const hudEl = document.getElementById('hud');

const COLORS = {
  body: '#c8854a',
  bodyDark: '#8a5a2c',
  head: '#e0a566',
  mask: '#1a0d05',
  snoot: '#1a0d05',
  snootPink: '#ff8aa8',
  tongue: '#ff5a82',
  ringPerfect: '#ffd23f',
  ringGood: '#4cc9f0',
  ringMiss: '#ff3a3a',
  bg1: '#1a0f2e',
  bg2: '#0a0716',
};

let W = 0, H = 0, DPR = 1;
let running = false;
let paused = false;
let snoots = [];     // active targets
let particles = [];  // floating score popups
let score = 0;
let combo = 1;
let maxCombo = 1;
let perfectCount = 0;
let timeLeft = 60;
let spawnCooldown = 0;
let muted = localStorage.getItem('boop:muted') === '1';
let actx = null;

function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ===== Audio =====
function audio() { if (actx) return actx; try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} return actx; }
function sfx(freq, type = 'square', dur = 0.08, peak = 0.18) {
  if (muted) return;
  const c = audio(); if (!c) return;
  const o = c.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
  const g = c.createGain();
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(peak, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start(); o.stop(c.currentTime + dur + 0.02);
}
function sfxPerfect() { sfx(880, 'triangle', 0.1, 0.22); setTimeout(() => sfx(1320, 'triangle', 0.1, 0.2), 60); setTimeout(() => sfx(1760, 'triangle', 0.1, 0.18), 120); }
function sfxGood() { sfx(660, 'square', 0.09, 0.18); }
function sfxMiss() { sfx(165, 'sawtooth', 0.25, 0.18); }
function sfxAppear() { sfx(220, 'sine', 0.05, 0.08); }
function sfxEnd() { sfx(440, 'square', 0.2, 0.22); setTimeout(() => sfx(330, 'square', 0.2, 0.22), 120); setTimeout(() => sfx(220, 'square', 0.4, 0.22), 240); }

const applyMuteUI = () => {
  if (!muteBtn) return;
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
};
applyMuteUI();
muteBtn?.addEventListener('click', () => {
  muted = !muted; localStorage.setItem('boop:muted', muted ? '1' : '0'); applyMuteUI();
});

// ===== Game logic =====
function reset() {
  snoots = [];
  particles = [];
  score = 0;
  combo = 1;
  maxCombo = 1;
  perfectCount = 0;
  timeLeft = 60;
  spawnCooldown = 0.5;
}

function spawnSnoot() {
  const margin = 80;
  // Pick a position that's not overlapping with another snoot
  let x = 0, y = 0;
  for (let tries = 0; tries < 30; tries++) {
    x = margin + Math.random() * (W - margin * 2);
    y = margin + 80 + Math.random() * (H - margin * 2 - 80);
    let bad = false;
    for (const s of snoots) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < 120) { bad = true; break; }
    }
    if (!bad) break;
  }
  // Faster snoots as time progresses
  const elapsed = 60 - timeLeft;
  const speedMul = 1 + elapsed / 30; // up to 3x at end
  // The ring shrinks from 80 → 24 over `life`. Perfect window is around snootR.
  const snootR = 26;
  const life = 1.4 / speedMul;
  snoots.push({
    x, y,
    snootR,
    ringR: 90,            // starts large
    ringTargetR: snootR,  // shrinks to here
    life,                 // seconds total
    t: 0,                 // elapsed
    state: 'active',      // 'active' | 'hit' | 'miss' | 'fading'
    hue: Math.random(),
  });
  sfxAppear();
}

function hit(s, judgement) {
  s.state = judgement;
  s.fadeT = 0.4;
  let pts = 0;
  if (judgement === 'perfect') {
    pts = 100 * combo;
    perfectCount++;
    combo = Math.min(99, combo + 1);
    if (combo > maxCombo) maxCombo = combo;
    sfxPerfect();
    addParticle(s.x, s.y, `PERFECT +${pts}`, COLORS.ringPerfect);
  } else if (judgement === 'good') {
    pts = 30 * combo;
    sfxGood();
    addParticle(s.x, s.y, `GOOD +${pts}`, COLORS.ringGood);
  } else {
    combo = 1;
    sfxMiss();
    addParticle(s.x, s.y, `MISS`, COLORS.ringMiss);
  }
  score += pts;
  updateHud();
}

function addParticle(x, y, text, color) {
  particles.push({ x, y, text, color, life: 1.2, t: 0, vy: -40 });
}

function updateHud() {
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-combo').textContent = `x${combo}`;
  document.getElementById('hud-time').textContent = Math.max(0, Math.ceil(timeLeft));
  const best = loadBest('boop-snoot');
  document.getElementById('hud-best').textContent = best ? best.score : 0;
}

function tick(dt) {
  if (!running || paused) return;
  timeLeft -= dt;
  if (timeLeft <= 0) return end();

  // Spawn cadence: every 0.5–1.2s, faster as time runs out
  spawnCooldown -= dt;
  const elapsed = 60 - timeLeft;
  const minSpawn = Math.max(0.18, 0.55 - elapsed / 80);
  if (spawnCooldown <= 0 && snoots.filter((s) => s.state === 'active').length < 5) {
    spawnSnoot();
    spawnCooldown = minSpawn + Math.random() * 0.4;
  }

  // Tick snoots
  for (let i = snoots.length - 1; i >= 0; i--) {
    const s = snoots[i];
    s.t += dt;
    if (s.state === 'active') {
      const k = Math.min(1, s.t / s.life);
      s.ringR = 90 - (90 - s.snootR) * k;
      if (s.t >= s.life) {
        // Auto-miss
        hit(s, 'miss');
        s.state = 'miss';
        s.fadeT = 0.5;
      }
    } else {
      s.fadeT -= dt;
      if (s.fadeT <= 0) snoots.splice(i, 1);
    }
  }
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt;
    p.y += p.vy * dt;
    p.vy *= 0.96;
    if (p.t >= p.life) particles.splice(i, 1);
  }
}

function attemptBoop(x, y) {
  // Find the active snoot under cursor
  for (const s of snoots) {
    if (s.state !== 'active') continue;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= s.snootR + 6) {
      // Now judge by current ringR
      const diff = s.ringR - s.snootR;
      if (diff <= 8) hit(s, 'perfect');
      else if (diff <= 28) hit(s, 'good');
      else hit(s, 'miss');
      return;
    }
  }
}

function boopNearest() {
  // For SPACE — pick the smallest-ring active snoot
  let best = null;
  let bestDiff = Infinity;
  for (const s of snoots) {
    if (s.state !== 'active') continue;
    const d = s.ringR - s.snootR;
    if (d < bestDiff) { bestDiff = d; best = s; }
  }
  if (best) {
    if (bestDiff <= 8) hit(best, 'perfect');
    else if (bestDiff <= 28) hit(best, 'good');
    else hit(best, 'miss');
  }
}

function end() {
  running = false;
  sfxEnd();
  document.getElementById('end-score').textContent = score;
  document.getElementById('end-combo').textContent = `x${maxCombo}`;
  document.getElementById('end-perfect').textContent = perfectCount;
  const { isNewBest, current } = submitRun('boop-snoot', { score, maxCombo, perfect: perfectCount });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { score, maxCombo, perfect: perfectCount };
    bestEl.innerHTML = `Best: <b>${b.score}</b> (combo x${b.maxCombo})${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  hudEl.hidden = true;
  endOverlay.hidden = false;
  endOverlay.classList.remove('is-hidden');
}

// ===== Render =====
function drawSnoot(s) {
  // Pug face — head, ears, mask, snoot
  const x = s.x, y = s.y, r = s.snootR;
  // ears
  ctx.fillStyle = COLORS.bodyDark;
  ctx.fillRect(x - r - 4, y - r - 6, 12, 14);
  ctx.fillRect(x + r - 8, y - r - 6, 12, 14);
  // head
  ctx.fillStyle = COLORS.head;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // body shadow under head
  ctx.fillStyle = COLORS.body;
  ctx.fillRect(x - r, y, r * 2, r - 2);
  // mask
  ctx.fillStyle = COLORS.mask;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.15, r * 0.78, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - r * 0.42, y - r * 0.15, 6, 6);
  ctx.fillRect(x + r * 0.18, y - r * 0.15, 6, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(x - r * 0.42 + 2, y - r * 0.15 + 2, 3, 3);
  ctx.fillRect(x + r * 0.18 + 2, y - r * 0.15 + 2, 3, 3);
  // SNOOT (the target!) — glowing pink center
  ctx.shadowColor = COLORS.snootPink;
  ctx.shadowBlur = 12;
  ctx.fillStyle = COLORS.snoot;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.snootPink;
  ctx.beginPath();
  ctx.arc(x - 2, y + r * 0.4 - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // RING (the timing target)
  if (s.state === 'active') {
    const diff = s.ringR - s.snootR;
    let ringColor = COLORS.ringMiss;
    if (diff <= 8) ringColor = COLORS.ringPerfect;
    else if (diff <= 28) ringColor = COLORS.ringGood;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 4;
    ctx.shadowColor = ringColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y, s.ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Inner perfect-target indicator (subtle)
    ctx.strokeStyle = 'rgba(255,210,63,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, s.snootR + 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.state === 'perfect' || s.state === 'good') {
    // Hit feedback — expanding ring
    const k = 1 - (s.fadeT / 0.4);
    ctx.strokeStyle = s.state === 'perfect' ? COLORS.ringPerfect : COLORS.ringGood;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, s.snootR + 20 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (s.state === 'miss') {
    // X
    ctx.strokeStyle = COLORS.ringMiss;
    ctx.lineWidth = 4;
    ctx.globalAlpha = Math.max(0, s.fadeT / 0.5);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y - r * 0.7);
    ctx.lineTo(x + r * 0.7, y + r * 0.7);
    ctx.moveTo(x + r * 0.7, y - r * 0.7);
    ctx.lineTo(x - r * 0.7, y + r * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function render() {
  // BG
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, COLORS.bg1);
  grd.addColorStop(1, COLORS.bg2);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  // Subtle dot pattern
  ctx.fillStyle = 'rgba(76,201,240,0.04)';
  for (let yy = 30; yy < H; yy += 40) {
    for (let xx = 30; xx < W; xx += 40) {
      ctx.fillRect(xx, yy, 2, 2);
    }
  }
  // Snoots
  for (const s of snoots) drawSnoot(s);
  // Particles (score popups)
  ctx.font = "bold 14px 'Press Start 2P', monospace";
  ctx.textAlign = 'center';
  for (const p of particles) {
    const alpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  // Combo banner if combo > 1
  if (combo > 2 && running) {
    ctx.fillStyle = COLORS.ringPerfect;
    ctx.font = "bold 28px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.shadowColor = COLORS.ringPerfect;
    ctx.shadowBlur = 14;
    ctx.fillText(`COMBO x${combo}`, W / 2, 60);
    ctx.shadowBlur = 0;
  }
}

// ===== Input =====
function pointerXY(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}
canvas.addEventListener('mousedown', (e) => {
  if (!running || paused) return;
  const { x, y } = pointerXY(e);
  attemptBoop(x, y);
});
canvas.addEventListener('touchstart', (e) => {
  if (!running || paused) return;
  const { x, y } = pointerXY(e);
  attemptBoop(x, y);
  e.preventDefault();
}, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    if (running && !paused) { boopNearest(); e.preventDefault(); }
  } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (running) togglePause();
  } else if (e.key === 'm' || e.key === 'M') {
    muted = !muted; localStorage.setItem('boop:muted', muted ? '1' : '0'); applyMuteUI();
  }
});

// Buttons
startBtn.addEventListener('click', start);
restartBtn.addEventListener('click', start);
pauseBtn?.addEventListener('click', togglePause);
pauseResume?.addEventListener('click', togglePause);
pauseQuit?.addEventListener('click', () => { window.location.href = '../../index.html'; });

document.getElementById('end-share')?.addEventListener('click', async () => {
  const s = document.getElementById('end-score')?.textContent || '0';
  const c = document.getElementById('end-combo')?.textContent || 'x1';
  const text = `👃 BOOP THE SNOOT — Score ${s}, max combo ${c}! Beat me at https://leobalkind.github.io/web-games/`;
  const btn = document.getElementById('end-share');
  try {
    if (navigator.share) await navigator.share({ title: 'BOOP THE SNOOT', text, url: 'https://leobalkind.github.io/web-games/' });
    else { await navigator.clipboard.writeText(text); btn.textContent = '✓ COPIED!'; setTimeout(() => btn.textContent = '📋 SHARE', 2000); }
  } catch { btn.textContent = '⚠ FAILED'; setTimeout(() => btn.textContent = '📋 SHARE', 2000); }
});

function start() {
  reset();
  running = true;
  paused = false;
  startOverlay.hidden = true; startOverlay.classList.add('is-hidden');
  endOverlay.hidden = true; endOverlay.classList.add('is-hidden');
  hudEl.hidden = false;
  updateHud();
  audio()?.resume?.();
}
function togglePause() {
  paused = !paused;
  pauseOverlay.hidden = !paused;
}

// ===== Main loop =====
let lastT = performance.now();
function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  tick(dt);
  render();
  if (running) updateHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Show best on start screen
const best = loadBest('boop-snoot');
if (best) {
  const sub = startOverlay.querySelector('.overlay__sub');
  if (sub) {
    const div = document.createElement('div');
    div.style.cssText = 'margin:10px 0 0;color:var(--neon-yellow);font-size:0.6rem;letter-spacing:0.05em;';
    div.innerHTML = `★ Personal best: <b>${best.score}</b> (combo x${best.maxCombo}, ${best.perfect} perfects)`;
    sub.appendChild(div);
  }
}
