// =============================================================================
// BACKROOMS 3D — PROCEDURAL AUDIO ENGINE
// =============================================================================
// Pure-WebAudio module. No samples — every sound is synthesized live, so the
// payload stays tiny and the game never blocks on asset loading.
//
// Design pillars (driven by the user's vibe spec):
//   1. CONSTANT BUZZ — 60/120/240Hz fluorescent hum + 0.3Hz LFO wobble. Lives
//      forever on the page; volume is the player's "is it real?" anxiety dial.
//   2. STALE AIR — 35/45Hz triangle drone through an 80Hz lowpass. You don't
//      hear it so much as feel it; the slow filter LFO makes the walls "breathe".
//   3. SOFT FOOTSTEPS ON CARPET — bandpassed noise burst (700-1000Hz), short
//      envelope, ±5% pitch jitter. Carpet means no boot-tap; just muffled thuds.
//   4. PHANTOM DISTANT FOOTSTEPS — same step routed through a stack of long
//      delay+lowpass stages (cheap convolver) + random stereo pan. Auto-fires
//      every 4-15s when the player is idle so they never feel alone.
//   5. MONSTER PROXIMITY (positional) — three layered, distance-attenuated
//      voices (breath @ 30m → heartbeat @ 15m → dissonant minor-second @ 5m)
//      all panned via StereoPannerNode. Driven by `updateDistance(d)` per frame.
//   6. JUMPSCARE — six oscillators + noise fired in lock-step at master 0.7,
//      with a 40ms delayed secondary shriek for extra terror.
//
// All audio multiplied by `getMasterGain('music' | 'sfx')` from the shared
// settings menu. `wg:settings:muted` flag is respected via that helper
// returning 0 when muted. `onSettingsChange` re-applies live mix changes.
//
// Helpers `mkOsc`, `mkNoise`, `mkEnv`, `mkPan` are the workhorses — every
// sound is composed of those four primitives, which keeps the minified
// payload small (~5KB) despite the dense feature set.

import { getMasterGain, onSettingsChange } from '../../src/shared/settingsMenu.js';

export function createAudio() {
  // ---- AudioContext lifecycle ---------------------------------------------
  let ctx = null;            // Lazy on `start()` — browsers require a gesture.
  let started = false;

  // Persistent (looped) nodes — built once in start(), torn down in stop().
  let buzzNodes = null, buzzGain = null, buzzLFO = null;
  let staleNodes = null, staleGain = null, staleFilter = null, staleLFO = null;
  let busMusic = null, busSfx = null, masterGain = null;
  let reverbIn = null, reverbOut = null;

  // Proximity voices — built on demand, persistent until stop().
  let proxBreath = null, proxBreathLFO = null;
  let proxHeartT = 0;
  let proxDiss = null;
  let monsterDist = 999, monsterPan = 0, lastTickMs = 0;

  let distantTimer = null;
  let playerIsIdle = true;
  let unsubSettings = null;
  let _noiseBuf = null;

  // ---- Helpers -------------------------------------------------------------
  // Aliased to keep the minified payload small — these names appear constantly.
  const rnd  = Math.random;
  const mx   = Math.max;
  const mn   = Math.min;
  const now  = () => ctx ? ctx.currentTime : 0;
  const mg   = (k) => getMasterGain(k);
  const clamp01 = (v) => mx(0, mn(1, v || 0));

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  // 4-second white-noise loop — reused for every noise-based sound.
  function noiseBuf() {
    if (_noiseBuf) return _noiseBuf;
    const sr = ctx.sampleRate;
    _noiseBuf = ctx.createBuffer(1, sr * 4, sr);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    return _noiseBuf;
  }

  // Spawn one oscillator with type/frequency.
  function mkOsc(type, freq) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  // Spawn a noise BufferSource (one-shot), with optional pitch.
  function mkNoise(rate = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf();
    s.playbackRate.value = rate;
    return s;
  }

  // Spawn a bandpass / lowpass filter quickly.
  function mkFilter(type, freq, Q = 1) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = Q;
    return f;
  }

  // Standard quick-attack/exp-decay envelope on a GainNode. Returns the gain.
  function mkEnv(t0, attack, peak, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return g;
  }

  // StereoPannerNode with graceful fallback (very old Safari).
  function mkPan(pan) {
    try { const p = ctx.createStereoPanner(); p.pan.value = pan; return p; }
    catch { return null; }
  }

  // Plain gain node with initial value (shaves a few bytes by removing repetition).
  function mkGain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }

  // Glide an AudioParam to `v` via setTargetAtTime, swallowing errors.
  function glide(param, v, tau) {
    try { param.setTargetAtTime(v, now(), tau); } catch {}
  }

  // Exponential ramp on an AudioParam (errors when value <= 0, so we floor it).
  function expTo(param, v, at) {
    try { param.exponentialRampToValueAtTime(mx(1e-4, v), at); } catch {}
  }

  // Stop and forget a node (try/catch — node may already be stopped).
  function silence(node) { if (node) try { node.stop(); } catch {} }

  // Chain N audio nodes: pipe(a, b, c) === a.connect(b).connect(c). Returns
  // the final node so callers can keep chaining if they want.
  function pipe(...nodes) {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    return nodes[nodes.length - 1];
  }

  // Cheap 4-tap delay reverb — sounds like carpeted corridors echoing.
  function buildReverb() {
    reverbIn = mkGain(1);
    reverbOut = mkGain(0.55);
    const taps = [0.057, 0.131, 0.227, 0.379];
    const decays = [0.42, 0.30, 0.22, 0.16];
    for (let i = 0; i < 4; i++) {
      const dl = ctx.createDelay(1.5); dl.delayTime.value = taps[i];
      const lp = mkFilter('lowpass', 1800);
      pipe(reverbIn, dl, lp, mkGain(0.55), dl);
      pipe(lp, mkGain(decays[i]), reverbOut);
    }
  }

  // ---- Public API ----------------------------------------------------------

  function start() {
    if (started) return;
    if (!ensureCtx()) return;
    started = true;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch {} }

    masterGain = mkGain(0.0001);
    masterGain.connect(ctx.destination);
    busMusic = mkGain(1); busSfx = mkGain(1);
    busMusic.connect(masterGain); busSfx.connect(masterGain);

    buildReverb();
    reverbOut.connect(busSfx);

    // ---- 1. Fluorescent buzz (persistent) ---------------------------------
    // 60/120/240Hz sines through a 200Hz bandpass, with detuned 60.5 partial
    // and a 0.3Hz LFO wobbling the fundamental for "real-electrical" feel.
    const buzzBP = mkFilter('bandpass', 200, 0.7);
    buzzGain = mkGain(0);
    pipe(buzzBP, buzzGain, busMusic);
    buzzNodes = [
      ['sine', 60,   0.55], ['sine', 60.5, 0.45],
      ['sine', 120,  0.30], ['sine', 240,  0.08],
    ].map(([t, f, g]) => {
      const o = mkOsc(t, f);
      pipe(o, mkGain(g), buzzBP);
      o.start();
      return o;
    });
    buzzLFO = mkOsc('sine', 0.3);
    pipe(buzzLFO, mkGain(0.6), buzzNodes[0].frequency);
    buzzLFO.start();

    // ---- 2. Stale-air subsonic drone (persistent) -------------------------
    // 35/45Hz triangles through an 80Hz lowpass. Filter cutoff sweeps slowly
    // (0.08Hz LFO ± 25Hz) — the room "breathes" without anybody hearing why.
    staleFilter = mkFilter('lowpass', 80, 0.5);
    staleGain = mkGain(0);
    pipe(staleFilter, staleGain, busMusic);
    staleNodes = [['triangle', 35, 0.6], ['triangle', 45, 0.5]].map(([t, f, g]) => {
      const o = mkOsc(t, f);
      pipe(o, mkGain(g), staleFilter);
      o.start();
      return o;
    });
    staleLFO = mkOsc('sine', 0.08);
    pipe(staleLFO, mkGain(25), staleFilter.frequency);
    staleLFO.start();

    // 500ms fade-in on master.
    expTo(masterGain.gain, 1.0, now() + 0.5);

    // Default ambient levels; callers can override anytime.
    playBuzz(0.6);
    playAmbience(0.55);

    applyLiveMix();
    if (!unsubSettings) unsubSettings = onSettingsChange(applyLiveMix);
    scheduleNextDistant();
  }

  function stop() {
    if (!started || !ctx) return;
    started = false;
    const t = now();
    try { masterGain.gain.cancelScheduledValues(t); } catch {}
    expTo(masterGain.gain, 0.0001, t + 0.4);
    setTimeout(() => {
      (buzzNodes || []).forEach(silence);
      (staleNodes || []).forEach(silence);
      silence(buzzLFO); silence(staleLFO);
      if (proxBreath)    { silence(proxBreath.osc); proxBreath = null; }
      silence(proxBreathLFO); proxBreathLFO = null;
      if (proxDiss) { silence(proxDiss.oscA); silence(proxDiss.oscB); proxDiss = null; }
      if (distantTimer) { clearTimeout(distantTimer); distantTimer = null; }
      try { masterGain.disconnect(); } catch {}
      buzzNodes = staleNodes = null;
    }, 450);
    if (unsubSettings) { try { unsubSettings(); } catch {} unsubSettings = null; }
  }

  // Refresh bus gains from the shared settings (called on every settings change).
  function applyLiveMix() {
    if (!started || !ctx) return;
    glide(busMusic.gain, mg('music'), 0.05);
    glide(busSfx.gain, mg('sfx'), 0.05);
  }

  // ---- 1b. Buzz volume setter ---------------------------------------------
  function playBuzz(intensity) {
    if (!started || !buzzGain) return;
    glide(buzzGain.gain, clamp01(intensity) * 0.06, 0.2);
  }

  // ---- 2b. Stale-air drone volume setter ----------------------------------
  function playAmbience(volume) {
    if (!started || !staleGain) return;
    glide(staleGain.gain, clamp01(volume) * 0.04, 0.3);
  }

  // ---- 3. Carpet footstep --------------------------------------------------
  // Bandpass-filtered noise burst, ±5% pitch jitter for variation. The whole
  // sound lives ≈90ms — short enough not to clutter, long enough for warmth.
  function playFootstep(speed) {
    if (!started || !ctx) return;
    playerIsIdle = false;
    setTimeout(() => { playerIsIdle = true; }, 700);
    const s = clamp01(speed);
    const src = mkNoise(1 + (rnd() - 0.5) * 0.1);
    const bp = mkFilter('bandpass', 700 + rnd() * 300, 1.2);
    const t = now();
    const g = mkEnv(t, 0.01, 0.15 * (0.5 + 0.5 * s), 0.08);
    pipe(src, bp, g, busSfx);
    src.start(t, rnd() * 3.5, 0.12);
  }

  // ---- 4. Distant phantom footstep -----------------------------------------
  // Same engine as a carpet step but routed into the delay reverb + panned
  // hard L/R (60% of the time) for "somebody is around the corner" paranoia.
  function playDistantEcho() {
    if (!started || !ctx || !reverbIn) return;
    const src = mkNoise(0.85 + rnd() * 0.2);
    const bp = mkFilter('bandpass', 600 + rnd() * 200, 1.5);
    const lp = mkFilter('lowpass', 1100);
    const t = now();
    const g = mkEnv(t, 0.015, 0.08, 0.12);
    const r = rnd();
    const pan = r < 0.4 ? -0.8 : r < 0.8 ? 0.8 : (rnd() - 0.5) * 0.6;
    const panNode = mkPan(pan);
    if (panNode) pipe(src, bp, lp, g, panNode, reverbIn);
    else pipe(src, bp, lp, g, reverbIn);
    src.start(t, rnd() * 3.5, 0.16);
  }

  function scheduleNextDistant() {
    if (!started) return;
    const delay = 4000 + rnd() * 11000;
    if (distantTimer) clearTimeout(distantTimer);
    distantTimer = setTimeout(() => {
      if (started && playerIsIdle && mg('sfx') > 0.01) playDistantEcho();
      scheduleNextDistant();
    }, delay);
  }

  // ---- 5. Flicker zap ------------------------------------------------------
  function playFlicker() {
    if (!started || !ctx) return;
    const src = mkNoise(1 + rnd() * 0.4);
    const bp = mkFilter('bandpass', 4000, 3.5);
    const t = now();
    const g = mkEnv(t, 0.005, 0.05, 0.075);
    pipe(src, bp, g, busSfx);
    src.start(t, rnd() * 3.5, 0.1);
  }

  // ---- 6. Monster proximity (positional) -----------------------------------
  function ensureProxBreath() {
    if (proxBreath) return;
    // "Breath" = lowpassed noise modulated by 0.4Hz LFO → inhale/exhale rhythm.
    const src = mkNoise(0.5); src.loop = true;
    const bp = mkFilter('bandpass', 380, 1.4);
    const lp = mkFilter('lowpass', 900);
    const g = mkGain(0);
    const panNode = mkPan(0);
    if (panNode) pipe(src, bp, lp, g, panNode, busSfx);
    else pipe(src, bp, lp, g, busSfx);
    proxBreathLFO = mkOsc('sine', 0.4);
    pipe(proxBreathLFO, mkGain(0.4), g.gain);
    src.start(); proxBreathLFO.start();
    proxBreath = { osc: src, gain: g, pan: panNode };
  }

  function ensureProxDiss() {
    if (proxDiss) return;
    // 220 + 233Hz minor second — universally "wrong"-sounding interval.
    const a = mkOsc('sine', 220), b = mkOsc('sine', 233);
    const g = mkGain(0);
    const panNode = mkPan(0);
    a.connect(g); b.connect(g);
    if (panNode) pipe(g, panNode, busSfx);
    else g.connect(busSfx);
    a.start(); b.start();
    proxDiss = { oscA: a, oscB: b, gain: g, pan: panNode };
  }

  function setDistance(d) { monsterDist = mx(0, mn(100, d || 0)); }

  function playMonsterFar(distance, panX) {
    setDistance(distance);
    monsterPan = mx(-1, mn(1, panX || 0));
    updateProximity(0);
  }

  function updateDistance(d) {
    setDistance(d);
    const nowMs = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    const dt = lastTickMs ? (nowMs - lastTickMs) / 1000 : 0.016;
    lastTickMs = nowMs;
    updateProximity(mn(0.1, mx(0, dt)));
  }

  function updateProximity(dt) {
    if (!started || !ctx) return;
    // Breath: fade 0.03 → 0.15 across 30m → 0m.
    if (monsterDist < 30) {
      ensureProxBreath();
      const k = 1 - monsterDist / 30;
      glide(proxBreath.gain.gain, 0.03 + 0.12 * k, 0.25);
      if (proxBreath.pan) glide(proxBreath.pan.pan, monsterPan, 0.15);
    } else if (proxBreath) {
      glide(proxBreath.gain.gain, 0, 0.4);
    }
    // Heartbeat: period 0.6s → 0.25s as monster closes 15m → 0m.
    if (monsterDist < 15) {
      const k = 1 - monsterDist / 15;
      proxHeartT += dt;
      if (proxHeartT >= 0.6 - 0.35 * k) {
        proxHeartT = 0;
        spawnHeartbeat(monsterPan, 0.10 + 0.20 * k);
      }
    } else { proxHeartT = 0; }
    // Dissonant minor-2nd fades in only when <5m — the "oh no" moment.
    if (monsterDist < 5) {
      ensureProxDiss();
      const k = 1 - monsterDist / 5;
      glide(proxDiss.gain.gain, 0.06 * k, 0.2);
      if (proxDiss.pan) glide(proxDiss.pan.pan, monsterPan * 0.6, 0.15);
    } else if (proxDiss) {
      glide(proxDiss.gain.gain, 0, 0.3);
    }
  }

  function spawnHeartbeat(pan, amp) {
    const o = mkOsc('sine', 50);
    const t = now();
    const g = mkEnv(t, 0.02, amp, 0.16);
    const panNode = mkPan(pan);
    if (panNode) pipe(o, g, panNode, busSfx);
    else pipe(o, g, busSfx);
    o.start(t); o.stop(t + 0.25);
  }

  // ---- 7. Jumpscare --------------------------------------------------------
  // Six layers + secondary delayed shriek. Per-event sub-gain at 0.7 keeps the
  // mix on the loud side of safe without driving the master into clipping.
  function playJumpscare() {
    if (!started || !ctx) return;
    const t0 = now();
    const out = mkGain(0.7);
    out.connect(busSfx);

    // Helper: spawn one jumpscare layer (osc, dur, attack, peak, decay).
    const fire = (node, dur, atk, pk, dec, startAt = t0) => {
      pipe(node, mkEnv(startAt, atk, pk, dec), out);
      node.start(startAt);
      if (node.stop) node.stop(startAt + dur);
    };
    // (a) 900→200Hz sawtooth sweep
    const sw = mkOsc('sawtooth', 900);
    sw.frequency.exponentialRampToValueAtTime(200, t0 + 0.25);
    fire(sw, 0.45, 0.01, 0.45, 0.39);
    // (b) 600Hz square pulse, sharp attack
    fire(mkOsc('square', 600), 0.2, 0.005, 0.25, 0.175);
    // (c) white noise burst
    const ns = mkNoise(1.2);
    pipe(ns, mkEnv(t0, 0.01, 0.35, 0.31), out);
    ns.start(t0, rnd() * 3, 0.35);
    // (d) 60Hz sub-bass thump (felt in the chest)
    fire(mkOsc('sine', 60), 0.55, 0.015, 0.6, 0.485);
    // (e) 1200Hz piercing shriek
    fire(mkOsc('sine', 1200), 0.32, 0.008, 0.32, 0.292);
    // (f) 200Hz square through 400Hz lowpass → growl
    const gr = mkOsc('square', 200);
    pipe(gr, mkFilter('lowpass', 400), mkEnv(t0, 0.02, 0.4, 0.43), out);
    gr.start(t0); gr.stop(t0 + 0.5);
    // Secondary 1450Hz shriek 40ms later — the "double-tap" terror.
    fire(mkOsc('sine', 1450), 0.3, 0.008, 0.22, 0.272, t0 + 0.04);
  }

  // ---- 8. Surreal horror sting --------------------------------------------
  // Single tone (220-880Hz) through delay reverb with 4Hz vibrato — sounds
  // like hearing something musical from three rooms away through carpet.
  function playReverbHorror() {
    if (!started || !ctx || !reverbIn) return;
    const t = now();
    const freq = 220 + rnd() * 660;
    const o = mkOsc('sine', freq);
    const vib = mkOsc('sine', 4);
    pipe(vib, mkGain(freq * 0.012), o.frequency);
    // Slow exponential rise then a 1.6s exponential tail — surreal sustain
    // built inline because mkEnv's linear attack would feel too snappy.
    const g = mkGain(1e-4);
    expTo(g.gain, 0.06,  t + 0.15);
    expTo(g.gain, 0.0001, t + 1.6);
    pipe(o, g, reverbIn);
    o.start(t); o.stop(t + 1.7);
    vib.start(t); vib.stop(t + 1.7);
  }

  // ---- 9. Player breathing (paranoia mode) --------------------------------
  // Bandpassed noise gasp with an asymmetric envelope. Caller decides cadence.
  function playBreathing(intensity) {
    if (!started || !ctx) return;
    const inten = clamp01(intensity || 0.4);
    const src = mkNoise(0.7);
    const bp = mkFilter('bandpass', 700, 1.0 + inten * 1.5);
    const lp = mkFilter('lowpass', 1400);
    const t = now();
    const g = mkEnv(t, 0.12, 0.05 + 0.1 * inten, 0.43);
    pipe(src, bp, lp, g, busSfx);
    src.start(t, rnd() * 3, 0.6);
  }

  // ---- Returned controller -------------------------------------------------
  return {
    start, stop,
    playFootstep,
    playBuzz,
    playFlicker,
    playMonsterFar,
    playJumpscare,
    playAmbience,
    playDistantEcho,
    playBreathing,
    playReverbHorror,
    updateDistance,
  };
}
