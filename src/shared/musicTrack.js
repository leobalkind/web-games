// =============================================================================
// SHARED PROCEDURAL BACKGROUND MUSIC — tiny WebAudio loop generator.
// =============================================================================
// Usage:
//   import { createMusicTrack } from '../../src/shared/musicTrack.js';
//   const music = createMusicTrack({ mood: 'arcade', tempo: 130, key: 'C', scale: 'minor' });
//   music.play();
//   music.setIntensity(0.7);      // 0..1 — speeds up + brightens
//   music.pause();                 // freeze without destroying nodes
//   music.stop();                  // hard stop + tear down all timers
//   music.destroy();               // tear down + remove settings listener
//
// All gain is multiplied by `getMasterGain('music')` so the universal settings
// MUSIC slider + MUTE ALL switch always works — and the listener also reacts
// live when the user drags the slider.
//
// Moods — every preset designed to feel distinct in 1-2 bars:
//   arcade  : chunky bass + bright square lead + chiptune hat
//   tense   : pulse rhythm + dissonant pad + low sub-bass
//   spooky  : detuned drone + sparse high piano notes
//   chill   : slow arpeggio + soft sine pad
//
// Tempo is BPM. Intensity smoothly scales the local play speed by 0.9× -> 1.25×
// and bumps lead-voice brightness without re-scheduling the pattern.
//
// Sizing: this file is intentionally compact (procedural — no samples), so the
// bundle stays well under 4KB minified after esbuild compresses identifiers.

import { getMasterGain, onSettingsChange } from './settingsMenu.js';

// --- Note tables (semitone offsets from root, 0-indexed) ---------------------
const SCALES = {
  // Minor pentatonic — easy on the ear, works for arcade/spooky/chill
  minor:    [0, 3, 5, 7, 10],
  // Major pentatonic — sunnier, ideal for chill/arcade-bright
  major:    [0, 2, 4, 7, 9],
  // Dorian-ish (minor with #6) — adds tense colour
  dorian:   [0, 2, 3, 5, 7, 9, 10],
};

const KEY_OFFSETS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

// Convert (degree, octave) -> frequency in Hz given a key+scale.
function freq(rootSemis, scaleArr, degree, octave) {
  const scaleLen = scaleArr.length;
  const wrap = ((degree % scaleLen) + scaleLen) % scaleLen;
  const octShift = Math.floor(degree / scaleLen);
  const semis = rootSemis + scaleArr[wrap] + (octave + octShift) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

// --- Per-mood pattern factories — each returns one "step" callback called on
// the master scheduler. We keep these inline rather than data-driven so the
// minifier can fold dead paths. Each returns the noteCount-per-bar so the
// scheduler can wrap.
function arcadePattern() {
  // 16-step bassline (C minor pent) + lead stab on offbeats + chip hat.
  const bassDegs = [0, 0, 2, 0, 4, 2, 0, 2, 0, 0, 2, 4, 5, 4, 2, 0];
  const leadDegs = [-1, 7, -1, 5, -1, 4, -1, 7, -1, 5, -1, 9, -1, 7, -1, 5];
  return (ctx, when, step, dst, scaleArr, rootSemis, bright) => {
    const i = step & 15;
    const bd = bassDegs[i];
    _voice(ctx, dst, freq(rootSemis, scaleArr, bd, 2), 'square', when, 0.14, 0.13);
    const ld = leadDegs[i];
    if (ld >= 0) _voice(ctx, dst, freq(rootSemis, scaleArr, ld, 4), 'triangle', when + 0.005, 0.16, 0.05 + bright * 0.05);
    if ((i & 1) === 0) _hat(ctx, dst, when, 0.04, 0.05);
    return 16;
  };
}
function tensePattern() {
  // Steady pulse 8ths + low sub-bass on 1+3 + dissonant minor 2nd pad on bar starts.
  return (ctx, when, step, dst, scaleArr, rootSemis, bright) => {
    const i = step & 15;
    _voice(ctx, dst, freq(rootSemis, scaleArr, 0, 2), 'sawtooth', when, 0.07, 0.07);
    if (i === 0 || i === 8) _voice(ctx, dst, freq(rootSemis, scaleArr, 0, 1), 'sine', when, 0.45, 0.16);
    if (i === 0) {
      _voice(ctx, dst, freq(rootSemis, scaleArr, 2, 3), 'triangle', when, 1.2, 0.05 + bright * 0.05);
      _voice(ctx, dst, freq(rootSemis, scaleArr, 1, 3) * 1.02, 'sine', when, 1.2, 0.04 + bright * 0.04);
    }
    if ((i & 3) === 2) _hat(ctx, dst, when, 0.03, 0.03);
    return 16;
  };
}
function spookyPattern() {
  // Long detuned drone + sparse high piano-ish notes, mostly silent.
  return (ctx, when, step, dst, scaleArr, rootSemis, bright) => {
    const i = step & 31;
    if (i === 0) {
      _voice(ctx, dst, freq(rootSemis, scaleArr, 0, 2), 'sine', when, 2.4, 0.08);
      _voice(ctx, dst, freq(rootSemis, scaleArr, 0, 2) * 1.01, 'sine', when, 2.4, 0.06);
    }
    // Sparse pings on irregular steps for unease.
    if (i === 7 || i === 19 || i === 27) {
      const deg = i === 19 ? 4 : 2;
      _voice(ctx, dst, freq(rootSemis, scaleArr, deg, 5), 'triangle', when, 0.6, 0.04 + bright * 0.03);
    }
    return 32;
  };
}
function chillPattern() {
  // Slow 8th arpeggio + sustained soft pad on bar starts.
  const arp = [0, 2, 4, 7, 4, 2, 0, -3];
  return (ctx, when, step, dst, scaleArr, rootSemis, bright) => {
    const i = step & 7;
    _voice(ctx, dst, freq(rootSemis, scaleArr, arp[i], 4), 'sine', when, 0.3, 0.07 + bright * 0.03);
    if (i === 0) _voice(ctx, dst, freq(rootSemis, scaleArr, 0, 3), 'sine', when, 1.6, 0.05);
    return 8;
  };
}

// --- Voice helpers -----------------------------------------------------------
function _voice(ctx, dst, f, type, when, dur, peak) {
  if (!f || f <= 0) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, when);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(dst);
  o.start(when);
  o.stop(when + dur + 0.05);
}
function _hat(ctx, dst, when, dur, peak) {
  const buf = ctx.createBuffer(1, Math.max(2, Math.floor(dur * ctx.sampleRate)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 6000;
  src.connect(f).connect(g).connect(dst);
  src.start(when); src.stop(when + dur + 0.02);
}

// --- Factory -----------------------------------------------------------------
export function createMusicTrack(opts = {}) {
  const mood    = opts.mood   || 'arcade';
  const tempo   = Math.max(40, Math.min(220, +opts.tempo || 120));
  const key     = opts.key    || 'C';
  const scaleId = opts.scale  || (mood === 'chill' ? 'major' : 'minor');
  const rootSemis = 60 + (KEY_OFFSETS[key] || 0); // middle-C anchored
  const scaleArr = SCALES[scaleId] || SCALES.minor;
  const stepFn =
    mood === 'tense'  ? tensePattern()  :
    mood === 'spooky' ? spookyPattern() :
    mood === 'chill'  ? chillPattern()  :
                        arcadePattern();
  // arcade  -> 16th notes  (4 steps per beat)
  // tense   -> 16th notes
  // spooky  -> 8th notes   (2 steps per beat)
  // chill   -> 8th notes
  const stepsPerBeat = (mood === 'spooky' || mood === 'chill') ? 2 : 4;
  let intensity = 0.5;
  let ctx = null, masterGain = null, timer = 0, step = 0, nextAt = 0;
  let state = 'stopped'; // stopped | playing | paused
  const unsub = onSettingsChange(() => { if (masterGain) masterGain.gain.value = getMasterGain('music'); });

  function _ensureCtx() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = getMasterGain('music');
      masterGain.connect(ctx.destination);
    } catch { ctx = null; }
    return ctx;
  }
  function _stepDur() {
    const baseBeatSec = 60 / tempo;
    const speed = 0.9 + intensity * 0.35; // 0.9×..1.25×
    return baseBeatSec / stepsPerBeat / speed;
  }
  function _tick() {
    if (!ctx || state !== 'playing') return;
    const lookAhead = 0.25;
    while (nextAt < ctx.currentTime + lookAhead) {
      stepFn(ctx, nextAt, step, masterGain, scaleArr, rootSemis, intensity);
      nextAt += _stepDur();
      step++;
    }
  }
  function play() {
    if (state === 'playing') return;
    if (!_ensureCtx()) return;
    try { ctx.resume?.(); } catch {}
    state = 'playing';
    if (nextAt === 0) nextAt = ctx.currentTime + 0.05;
    else nextAt = Math.max(nextAt, ctx.currentTime + 0.05);
    if (!timer) timer = setInterval(_tick, 50);
  }
  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    if (timer) { clearInterval(timer); timer = 0; }
  }
  function stop() {
    state = 'stopped';
    if (timer) { clearInterval(timer); timer = 0; }
    step = 0; nextAt = 0;
    if (masterGain && ctx) {
      // Quick fade to silence to avoid clicks.
      try {
        masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
        masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        setTimeout(() => { try { masterGain.gain.value = getMasterGain('music'); } catch {} }, 120);
      } catch {}
    }
  }
  function destroy() {
    stop();
    try { unsub?.(); } catch {}
    try { masterGain?.disconnect(); } catch {}
    try { ctx?.close?.(); } catch {}
    ctx = null; masterGain = null;
  }
  function setIntensity(v) {
    intensity = Math.max(0, Math.min(1, +v || 0));
  }
  return { play, pause, stop, setIntensity, destroy };
}
