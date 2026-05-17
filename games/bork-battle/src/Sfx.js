// =============================================================================
// BORK BATTLE Sfx — WebAudio synth, NO audio files.
// Mirrors games/pugfort/src/Sfx.js patterns with bork-flavored effects.
// =============================================================================
let ctx = null;
let masterGain = null;
let muted = false;
let lastShootAt = 0;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.45;
    masterGain.connect(ctx.destination);
  } catch (e) {
    console.warn('[Sfx] no AudioContext', e);
  }
  return ctx;
}

// Resume after first user gesture (autoplay policy)
const resumeOnGesture = () => {
  ensureCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
};
window.addEventListener('click', resumeOnGesture, { once: false });
window.addEventListener('keydown', resumeOnGesture, { once: false });

function noiseBuffer(durationSec) {
  const c = ensureCtx();
  if (!c) return null;
  const buf = c.createBuffer(1, Math.floor(durationSec * c.sampleRate), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function env(gain, attack, decay, peak = 1) {
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
}

function play(node, durationSec) {
  if (muted) return;
  node.start();
  node.stop(ctx.currentTime + durationSec);
}

// ===== Public SFX =====

export const Sfx = {
  // Projectile fire — tiered by weapon for variety
  shoot(shape = 'ball') {
    const c = ensureCtx(); if (!c || muted) return;
    // throttle to avoid audio clipping when many bots fire at once
    const now = c.currentTime;
    if (now - lastShootAt < 0.03) return;
    lastShootAt = now;
    const osc = c.createOscillator();
    let f0 = 520, f1 = 90, type = 'square', dur = 0.07, peak = 0.18;
    if (shape === 'beam') { f0 = 880; f1 = 420; type = 'sawtooth'; dur = 0.08; peak = 0.16; }
    else if (shape === 'lance') { f0 = 320; f1 = 60; type = 'sawtooth'; dur = 0.1; peak = 0.22; }
    else if (shape === 'crumb' || shape === 'pan') { f0 = 260; f1 = 50; type = 'square'; dur = 0.12; peak = 0.22; }
    else if (shape === 'fireball') { f0 = 220; f1 = 40; type = 'sawtooth'; dur = 0.14; peak = 0.24; }
    else if (shape === 'star') { f0 = 700; f1 = 320; type = 'triangle'; dur = 0.08; peak = 0.18; }
    else if (shape === 'donut') { f0 = 420; f1 = 120; type = 'square'; dur = 0.09; peak = 0.2; }
    else if (shape === 'bat') { f0 = 600; f1 = 110; type = 'sawtooth'; dur = 0.09; peak = 0.18; }
    osc.type = type;
    osc.frequency.setValueAtTime(f0, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
    const g = c.createGain();
    env(g, 0.001, dur, peak);
    osc.connect(g).connect(masterGain);
    play(osc, dur + 0.02);
  },

  // Projectile impact — tiny noise burst
  hit() {
    const c = ensureCtx(); if (!c || muted) return;
    const nb = noiseBuffer(0.05);
    const src = c.createBufferSource();
    src.buffer = nb;
    const g = c.createGain();
    env(g, 0.001, 0.05, 0.18);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.2;
    src.connect(f).connect(g).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.06);
  },

  // Pug death — descending splat + noise
  kill() {
    const c = ensureCtx(); if (!c || muted) return;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(260, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.22);
    const g = c.createGain();
    env(g, 0.001, 0.24, 0.32);
    osc.connect(g).connect(masterGain);
    play(osc, 0.26);
    const nb = noiseBuffer(0.15);
    const src = c.createBufferSource();
    src.buffer = nb;
    const ng = c.createGain();
    env(ng, 0.001, 0.15, 0.22);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 800;
    src.connect(f).connect(ng).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.17);
  },

  // Treat pickup — bright bing
  pickup() {
    const c = ensureCtx(); if (!c || muted) return;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.07);
    const g = c.createGain();
    env(g, 0.001, 0.08, 0.18);
    osc.connect(g).connect(masterGain);
    play(osc, 0.1);
  },

  // Player takes damage — low thud
  hurt() {
    const c = ensureCtx(); if (!c || muted) return;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.18);
    const g = c.createGain();
    env(g, 0.001, 0.2, 0.4);
    osc.connect(g).connect(masterGain);
    play(osc, 0.22);
  },

  // Mechanical reload click-clack
  reload() {
    const c = ensureCtx(); if (!c || muted) return;
    [0, 0.07].forEach((delay) => {
      const nb = noiseBuffer(0.03);
      const src = c.createBufferSource();
      src.buffer = nb;
      const g = c.createGain();
      const start = c.currentTime + delay;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.03);
      const f = c.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 2000;
      src.connect(f).connect(g).connect(masterGain);
      src.start(start); src.stop(start + 0.04);
    });
  },

  // BORK release — big bass + noise blast
  borkRelease(charge = 1) {
    const c = ensureCtx(); if (!c || muted) return;
    // Pug "bork!" — short ascending square then descending sweep, scaled by charge
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180 + 80 * charge, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.25 * charge);
    const g = c.createGain();
    env(g, 0.005, 0.3 * charge, 0.35 + 0.2 * charge);
    osc.connect(g).connect(masterGain);
    play(osc, 0.32 * charge + 0.05);
    // Boom layer
    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(70, c.currentTime);
    sub.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.35);
    const sg = c.createGain();
    env(sg, 0.002, 0.35, 0.45 * charge);
    sub.connect(sg).connect(masterGain);
    play(sub, 0.4);
    // Noise wash
    const nb = noiseBuffer(0.25);
    const src = c.createBufferSource();
    src.buffer = nb;
    const ng = c.createGain();
    env(ng, 0.002, 0.25, 0.28 * charge);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    src.connect(f).connect(ng).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.27);
  },

  // Level-up — ascending arpeggio
  levelUp() {
    const c = ensureCtx(); if (!c || muted) return;
    const freqs = [523, 659, 784, 1047];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = c.createGain();
      const start = c.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  },

  // Evolve — magical chord cluster
  evolve() {
    const c = ensureCtx(); if (!c || muted) return;
    const freqs = [392, 494, 587, 740, 880];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = c.createGain();
      const start = c.currentTime + i * 0.04;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.16, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 0.62);
    });
    // sparkle layer
    const nb = noiseBuffer(0.3);
    const src = c.createBufferSource();
    src.buffer = nb;
    const ng = c.createGain();
    env(ng, 0.005, 0.3, 0.12);
    const f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 4000;
    src.connect(f).connect(ng).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.32);
  },

  // UI click
  click() {
    const c = ensureCtx(); if (!c || muted) return;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 720;
    const g = c.createGain();
    env(g, 0.001, 0.04, 0.15);
    osc.connect(g).connect(masterGain);
    play(osc, 0.05);
  },

  // Match win — victory fanfare
  win() {
    const c = ensureCtx(); if (!c || muted) return;
    const freqs = [523, 659, 784, 1047, 1319];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = c.createGain();
      const start = c.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 0.58);
    });
  },

  // Match lose — long sad descend
  lose() {
    const c = ensureCtx(); if (!c || muted) return;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, c.currentTime + 1.2);
    const g = c.createGain();
    env(g, 0.01, 1.2, 0.3);
    osc.connect(g).connect(masterGain);
    play(osc, 1.3);
  },

  // === Master controls ===
  setVolume(v) {
    ensureCtx();
    if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
  },
  setMuted(m) {
    muted = !!m;
    ensureCtx();
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.45;
  },
  toggleMute() {
    this.setMuted(!muted);
    return muted;
  },
  isMuted() { return muted; },
};
