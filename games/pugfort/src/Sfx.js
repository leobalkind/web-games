// =============================================================================
// Sound system — WebAudio synth, NO audio files.
// All effects programmatically generated via oscillators + noise + envelopes.
// =============================================================================
let ctx = null;
let masterGain = null;
let muted = false;
let baseVolume = 0.5;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  } catch (e) {
    console.warn('[Sfx] no AudioContext', e);
  }
  return ctx;
}

// Resume after first user gesture
window.addEventListener('click', () => {
  ensureCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: false });
window.addEventListener('keydown', () => {
  ensureCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: false });

function noiseBuffer(durationSec, bandPass = null) {
  const c = ensureCtx();
  if (!c) return null;
  const sampleRate = c.sampleRate;
  const buf = c.createBuffer(1, Math.floor(durationSec * sampleRate), sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(gain, attack, decay, peak = 1, sustain = 0) {
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), now + attack + decay);
}

function play(node, durationSec) {
  node.start();
  node.stop(ctx.currentTime + durationSec);
}

// ===== Public SFX =====

export const Sfx = {
  pistol() {
    const c = ensureCtx(); if (!c) return;
    // Bright pop + low thud
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.08);
    const g = c.createGain();
    envelope(g, 0.001, 0.09, 0.4, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.1);
    // noise burst
    const nb = noiseBuffer(0.05);
    if (nb) {
      const src = c.createBufferSource();
      src.buffer = nb;
      const ng = c.createGain();
      envelope(ng, 0.001, 0.05, 0.3, 0.0001);
      const f = c.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 1500;
      src.connect(f).connect(ng).connect(masterGain);
      src.start();
      src.stop(c.currentTime + 0.06);
    }
  },

  zombieHit() {
    const c = ensureCtx(); if (!c) return;
    const nb = noiseBuffer(0.1);
    const src = c.createBufferSource();
    src.buffer = nb;
    const g = c.createGain();
    envelope(g, 0.001, 0.1, 0.4, 0.0001);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 700;
    src.connect(f).connect(g).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.12);
  },

  zombieDeath() {
    const c = ensureCtx(); if (!c) return;
    // wet splat: low frequency + noise
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25);
    const g = c.createGain();
    envelope(g, 0.001, 0.26, 0.5, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.28);
    const nb = noiseBuffer(0.18);
    const src = c.createBufferSource();
    src.buffer = nb;
    const ng = c.createGain();
    envelope(ng, 0.001, 0.18, 0.3, 0.0001);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 400;
    src.connect(f).connect(ng).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.2);
  },

  buildPlace() {
    const c = ensureCtx(); if (!c) return;
    // ascending pop — wood/metal placement
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(380, c.currentTime);
    osc.frequency.linearRampToValueAtTime(560, c.currentTime + 0.1);
    const g = c.createGain();
    envelope(g, 0.001, 0.12, 0.25, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.13);
  },

  woodCollect() {
    const c = ensureCtx(); if (!c) return;
    // bright bing
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.08);
    const g = c.createGain();
    envelope(g, 0.001, 0.09, 0.2, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.1);
  },

  explosion() {
    const c = ensureCtx(); if (!c) return;
    // low rumble + noise blast
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, c.currentTime + 0.5);
    const g = c.createGain();
    envelope(g, 0.002, 0.5, 0.7, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.6);
    const nb = noiseBuffer(0.4);
    const src = c.createBufferSource();
    src.buffer = nb;
    const ng = c.createGain();
    envelope(ng, 0.005, 0.4, 0.5, 0.0001);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1200;
    src.connect(f).connect(ng).connect(masterGain);
    src.start(); src.stop(c.currentTime + 0.42);
  },

  generatorHit() {
    const c = ensureCtx(); if (!c) return;
    // metallic thud
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.15);
    const g = c.createGain();
    envelope(g, 0.001, 0.16, 0.35, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.17);
  },

  turretFire() {
    const c = ensureCtx(); if (!c) return;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, c.currentTime + 0.05);
    const g = c.createGain();
    envelope(g, 0.001, 0.06, 0.25, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.07);
  },

  acidSpit() {
    const c = ensureCtx(); if (!c) return;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, c.currentTime);
    osc.frequency.linearRampToValueAtTime(440, c.currentTime + 0.15);
    const g = c.createGain();
    envelope(g, 0.005, 0.18, 0.3, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 0.19);
  },

  phaseDay() {
    const c = ensureCtx(); if (!c) return;
    // ascending chime
    const freqs = [440, 660, 880];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = c.createGain();
      const start = c.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 0.42);
    });
  },

  phaseNight() {
    const c = ensureCtx(); if (!c) return;
    // descending sinister chord
    const freqs = [330, 220, 110];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const g = c.createGain();
      const start = c.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 0.72);
    });
  },

  win() {
    const c = ensureCtx(); if (!c) return;
    const freqs = [440, 554, 659, 880];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.value = f;
      const g = c.createGain();
      const start = c.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 0.62);
    });
  },

  lose() {
    const c = ensureCtx(); if (!c) return;
    // long descending failure tone
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, c.currentTime + 1.4);
    const g = c.createGain();
    envelope(g, 0.01, 1.4, 0.4, 0.0001);
    osc.connect(g).connect(masterGain);
    play(osc, 1.5);
  },

  setVolume(v) {
    ensureCtx();
    baseVolume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = muted ? 0 : baseVolume;
  },
  setMuted(m) {
    muted = !!m;
    ensureCtx();
    if (masterGain) masterGain.gain.value = muted ? 0 : baseVolume;
  },
  toggleMute() {
    this.setMuted(!muted);
    return muted;
  },
  isMuted() { return muted; },
};
