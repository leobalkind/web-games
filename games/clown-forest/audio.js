// CLOWN FOREST — procedural horror audio. Pure WebAudio, zero samples.
//
// Design pillars (Outlast / Slender / Resident Evil dread playbook):
//   FOREST BED   3 loop layers (crickets / leaves / air drift) for the
//                "still alive" baseline. Always on during gameplay.
//   STARTLE FX   Twig snaps, owls, wind gusts. Sharp transients punched
//                LOUD against the bed so the player jolts.
//   CLOWN VOICES Synthesised laugh / breath / step / knife-drag. All
//                distance-attenuated + stereo-panned so the clown has a
//                location in the woods before you can see him.
//   3-PHASE MUSIC stalk -> hunt -> chase, additive layers. Strings drift
//                in STALK; 60Hz pulse + tritone joins in HUNT; 130BPM
//                percussion + sub-riser slam in for CHASE. stopAllMusic()
//                cross-fades them out over 0.6s.
//   PAY-OFFS     jumpscare (6 layers @ 0.7), kill (1.5s chaos @ 0.85),
//                win (rising violin + A-major arpeggio).
//
// Every gain routes through bus structure (ambient/music/sfx), all of
// which sit behind getMasterGain() so the global settings sliders + master
// mute drive the mix live via onSettingsChange.

import { getMasterGain, onSettingsChange } from '../../src/shared/settingsMenu.js';

export function createAudio() {
  let ctx = null, started = false;
  let masterGain = null, busAmbient = null, busMusic = null, busSfx = null;
  let reverbIn = null, reverbOut = null;
  let unsubSettings = null, _noiseBuf = null;
  // Persistent state
  let bed = null, bedGain = null, clownBreath = null;
  let mStalk = null, mHunt = null, mChase = null;
  // Heartbeat persistent loop — sub-thump tied to setHeartbeatRate, fades when
  // player is far from clown (target ~0 instead of a constant low loop).
  let heart = null;
  // Item-hum persistent oscillator — drives a faint positional tone whose
  // gain rises as player nears an item (within 3m).
  let itemHum = null;
  // Rain-on-shelter loop — layered low tone that fades up when the player is
  // within 12m of the cabin while it's raining.
  let shelterRain = null;
  // Wind whistle — set of tones layered over the bed during a gust.
  let windWhistle = null;
  // Beacon rising siren — long one-shot, tracked so a second call no-ops.
  let beaconRising = null;
  // Distant car horn — throttled so back-to-back random calls don't pile up.
  let _lastDistantCarAt = -1e9;
  // Surface palette for footsteps — 'dirt' (default), 'grass' (softer high
  // band), 'path' (slightly brighter + thinner). setSurface() updates this.
  let currentSurface = 'dirt';

  const rnd = Math.random, mx = Math.max, mn = Math.min;
  const now = () => ctx ? ctx.currentTime : 0;
  const mg = (k) => getMasterGain(k);
  const c01 = (v) => mx(0, mn(1, v || 0));
  const cPan = (v) => mx(-1, mn(1, v || 0));
  // Inverse-ish distance attenuation: 1.0 at 0m, ~0.14 at 100m.
  const att = (d) => 1 / (1 + mx(0, d || 0) * 0.06);

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    return ctx = new AC();
  }

  // ---- Primitives (reused everywhere) -------------------------------------
  function nbuf() {
    if (_noiseBuf) return _noiseBuf;
    const sr = ctx.sampleRate;
    _noiseBuf = ctx.createBuffer(1, sr * 4, sr);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    return _noiseBuf;
  }
  function osc(t, f) { const o = ctx.createOscillator(); o.type = t; o.frequency.value = f; return o; }
  function nz(r = 1) { const s = ctx.createBufferSource(); s.buffer = nbuf(); s.playbackRate.value = r; return s; }
  function flt(t, f, Q = 1) { const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = f; x.Q.value = Q; return x; }
  function gn(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function pan(p) { try { const n = ctx.createStereoPanner(); n.pan.value = cPan(p); return n; } catch { return null; } }
  function env(t0, atk, pk, dec) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(pk, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dec);
    return g;
  }
  function pipe(...ns) { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; }
  function stop_(n) { if (n) try { n.stop(); } catch {} }
  function gl(p, v, t) { try { p.setTargetAtTime(v, now(), t); } catch {} }
  function ex(p, v, at) { try { p.exponentialRampToValueAtTime(mx(1e-4, v), at); } catch {} }
  // Connect src -> optionally panNode -> dest.
  function panTo(src, p, dest) {
    const pn = pan(p);
    if (pn) pipe(src, pn, dest); else src.connect(dest);
  }

  // 4-tap delay reverb (woods echo).
  function buildReverb() {
    reverbIn = gn(1); reverbOut = gn(0.5);
    const taps = [0.041, 0.093, 0.187, 0.311], dks = [0.45, 0.32, 0.22, 0.15];
    for (let i = 0; i < 4; i++) {
      const dl = ctx.createDelay(1.5); dl.delayTime.value = taps[i];
      const lp = flt('lowpass', 2200);
      pipe(reverbIn, dl, lp, gn(0.5), dl);
      pipe(lp, gn(dks[i]), reverbOut);
    }
  }

  // ---- Lifecycle ----------------------------------------------------------
  function start() {
    if (started) return;
    if (!ensureCtx()) return;
    started = true;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch {} }
    masterGain = gn(0.0001); masterGain.connect(ctx.destination);
    busAmbient = gn(1); busMusic = gn(1); busSfx = gn(1);
    busAmbient.connect(masterGain); busMusic.connect(masterGain); busSfx.connect(masterGain);
    buildReverb(); reverbOut.connect(busSfx);
    ex(masterGain.gain, 1.0, now() + 0.5);
    if (!unsubSettings) unsubSettings = onSettingsChange(applyMix);
    applyMix();
  }

  function stop() {
    if (!started || !ctx) return;
    started = false;
    ex(masterGain.gain, 0.0001, now() + 0.5);
    setTimeout(() => {
      stopBed(); stopClownBreath(); stopAllMusic();
      stopHeart(); stopItemHum(); stopShelterRain(); stopWindWhistle();
      try { masterGain.disconnect(); } catch {}
    }, 550);
    if (unsubSettings) { try { unsubSettings(); } catch {} unsubSettings = null; }
  }

  function applyMix() {
    if (!started || !ctx) return;
    gl(busAmbient.gain, mg('music'), 0.05);
    gl(busMusic.gain, mg('music'), 0.05);
    gl(busSfx.gain, mg('sfx'), 0.05);
  }

  // ---- 1. FOREST AMBIENCE BED ---------------------------------------------
  // L1 crickets: pulsed 4kHz sine bursts at irregular intervals.
  // L2 leaves:   noise -> 1500Hz bandpass + slow amp LFO.
  // L3 air:      80-200Hz lowpassed noise + 0.05Hz LFO drift.
  function playForestAmbience(volume) {
    if (!started || !ctx) return;
    if (!bed) {
      bedGain = gn(0); bedGain.connect(busAmbient);
      // Leaves
      const lv = nz(0.8); lv.loop = true;
      const lvG = gn(0.18);
      pipe(lv, flt('bandpass', 1500, 0.9), lvG, bedGain);
      const lvLFO = osc('sine', 0.18);
      pipe(lvLFO, gn(0.07), lvG.gain);
      lv.start(); lvLFO.start();
      // Air
      const ar = nz(0.6); ar.loop = true;
      const arG = gn(0.15);
      pipe(ar, flt('lowpass', 200), arG, bedGain);
      const arLFO = osc('sine', 0.05);
      pipe(arLFO, gn(0.05), arG.gain);
      ar.start(); arLFO.start();
      // Crickets (recursive scheduler with irregular cadence 80-1200ms).
      const tick = () => {
        if (!bed) return;
        const t = now();
        const o = osc('sine', 3900 + rnd() * 300);
        pipe(o, flt('bandpass', 4000, 18), env(t, 0.003, 0.045, 0.05), bedGain);
        o.start(t); o.stop(t + 0.09);
        bed.timer = setTimeout(tick, 80 + rnd() * 1100);
      };
      bed = { lv, lvLFO, ar, arLFO, timer: null };
      tick();
    }
    gl(bedGain.gain, c01(volume) * 0.05, 0.4);
  }

  function stopBed() {
    if (!bed) return;
    if (bed.timer) clearTimeout(bed.timer);
    [bed.lv, bed.lvLFO, bed.ar, bed.arLFO].forEach(stop_);
    bed = null; bedGain = null;
  }

  // ---- 2. WIND GUST -------------------------------------------------------
  function playWindGust() {
    if (!started || !ctx) return;
    const t = now();
    const src = nz(0.9); src.loop = true;
    const bp = flt('bandpass', 2000, 1.2);
    bp.frequency.setValueAtTime(2000, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 2.5);
    bp.frequency.exponentialRampToValueAtTime(2000, t + 5);
    const g = env(t, 0.6, 0.18, 4.4);
    panTo(pipe(src, bp, g), (rnd() - 0.5) * 1.6, busSfx);
    g.connect(reverbIn);
    src.start(t); src.stop(t + 5.1);
  }

  // ---- 3. TWIG SNAP (startle, LOUDER than ambient) ------------------------
  function playTwigSnap() {
    if (!started || !ctx) return;
    const t = now();
    const src = nz(1 + (rnd() - 0.5) * 0.3);
    const g = env(t, 0.001, 0.4, 0.03);
    panTo(pipe(src, flt('highpass', 3000, 1.2), g), (rnd() - 0.5) * 1.4, busSfx);
    src.start(t, rnd() * 3, 0.05);
  }

  // ---- 4. LEAF SWIRL ------------------------------------------------------
  function playLeafSwirl() {
    if (!started || !ctx) return;
    const t = now();
    const src = nz(0.7); src.loop = true;
    const g = env(t, 0.15, 0.14, 0.85);
    panTo(pipe(src, flt('bandpass', 2400, 1.5), g), (rnd() - 0.5) * 1.2, busSfx);
    src.start(t); src.stop(t + 1.05);
  }

  // ---- 5. OWL (two hoots with falling vibrato) ----------------------------
  function playOwl() {
    if (!started || !ctx) return;
    const t = now();
    const p = (rnd() - 0.5) * 1.6;
    const hoot = (s, d) => {
      const o = osc('sine', 200);
      const vib = osc('sine', 5);
      pipe(vib, gn(8), o.frequency);
      o.frequency.setValueAtTime(220, s);
      o.frequency.exponentialRampToValueAtTime(170, s + d);
      const g = env(s, 0.05, 0.12, d - 0.05);
      const pn = pan(p);
      if (pn) pipe(o, g, pn, reverbIn); else pipe(o, g, reverbIn);
      o.start(s); o.stop(s + d + 0.02);
      vib.start(s); vib.stop(s + d + 0.02);
    };
    hoot(t, 0.4); hoot(t + 0.6, 0.4);
  }

  // ---- 6. CLOWN LAUGH (the showpiece) -------------------------------------
  // 8 staccato HEH-HA bursts over 2.5s. Each burst = 180Hz saw (3Hz vibrato)
  // + 360Hz square + jittered top harmonic. Reverb tail = woods echo.
  function playClownLaugh(panX, dist) {
    if (!started || !ctx) return;
    const t0 = now();
    const a = att(dist), p = cPan(panX);
    const out = gn(0.6 * a);
    const dry = gn(0.25 * a);
    panTo(out, p, reverbIn);
    panTo(dry, p, busSfx);
    const vib = osc('sine', 3);
    const vAmt = gn(6); pipe(vib, vAmt);
    vib.start(t0); vib.stop(t0 + 2.7);
    const offsets = [0, 0.22, 0.46, 0.74, 1.05, 1.38, 1.78, 2.18];
    for (let i = 0; i < offsets.length; i++) {
      const ts = t0 + offsets[i];
      const j = 1 + (rnd() - 0.5) * 0.15;
      const o1 = osc('sawtooth', 180 * j);
      vAmt.connect(o1.frequency);
      const o2 = osc('square', 360 * j);
      const o3 = osc('triangle', 540 + rnd() * 300);
      const mix = gn(1);
      pipe(o1, gn(0.5), mix);
      pipe(o2, gn(0.18), mix);
      pipe(o3, gn(0.12), mix);
      pipe(mix, env(ts, 0.08, 0.55, 0.15), out);
      pipe(mix, gn(0.25), dry);
      [o1, o2, o3].forEach((o) => { o.start(ts); o.stop(ts + 0.25); });
    }
  }

  // ---- 7. CLOWN STEP ------------------------------------------------------
  function playClownStep(panX, dist) {
    if (!started || !ctx) return;
    const t = now();
    const src = nz(0.9 + (rnd() - 0.5) * 0.2);
    const g = env(t, 0.005, 0.32 * att(dist), 0.18);
    panTo(pipe(src, flt('bandpass', 300, 1.8), g), panX, busSfx);
    pipe(g, gn(0.4), reverbIn);
    src.start(t, rnd() * 3, 0.22);
  }

  // ---- 8. CLOWN BREATH (persistent positional, close-range only) ----------
  function playClownBreath(dist) {
    if (!started || !ctx) return;
    if (!clownBreath) {
      const src = nz(0.6); src.loop = true;
      const g = gn(0);
      const p = pan(0);
      if (p) pipe(src, flt('bandpass', 1200, 4), g, p, busSfx);
      else pipe(src, flt('bandpass', 1200, 4), g, busSfx);
      const lfo = osc('sine', 0.4);
      pipe(lfo, gn(0.5), g.gain);
      src.start(); lfo.start();
      clownBreath = { src, lfo, g, p };
    }
    const d = mx(0, dist || 0);
    const k = mx(0, 1 - d / 12);
    gl(clownBreath.g.gain, 0.15 * k, 0.3);
  }

  function stopClownBreath() {
    if (!clownBreath) return;
    stop_(clownBreath.src); stop_(clownBreath.lfo);
    clownBreath = null;
  }

  // ---- 9. KNIFE DRAG (always behind player — caller passes -panX) --------
  function playKnifeDrag(panX, dist) {
    if (!started || !ctx) return;
    const t = now();
    const dur = 0.05 + rnd() * 0.15;
    const src = nz(1.1); src.loop = true;
    const bp = flt('bandpass', 5000 + rnd() * 1500, 6);
    const lfo = osc('sine', 7);
    pipe(lfo, gn(800), bp.frequency);
    const g = env(t, 0.01, 0.18 * att(dist), dur);
    panTo(pipe(src, flt('highpass', 4000), bp, g), cPan(panX), busSfx);
    pipe(g, gn(0.5), reverbIn);
    src.start(t); src.stop(t + dur + 0.05);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }

  // ---- 10. LIGHTNING (crack + 0.5-2s later: rolling rumble) ---------------
  function playLightning() {
    if (!started || !ctx) return;
    const t = now();
    const ck = nz(1.4);
    pipe(ck, flt('highpass', 1500), env(t, 0.005, 0.05, 0.18), busSfx);
    ck.start(t, rnd() * 3, 0.22);
    const t2 = t + 0.5 + rnd() * 1.5;
    const rb = nz(0.5); rb.loop = true;
    pipe(rb, flt('lowpass', 80, 0.7), env(t2, 0.4, 0.05, 4), busSfx);
    rb.start(t2); rb.stop(t2 + 4.5);
  }

  // ---- 11/12/13. MUSIC LAYERS ---------------------------------------------
  // Stalk = 3 detuned saws (low) through heavy LP, slow vib, never resolves.
  function buildStalk() {
    if (mStalk) return mStalk;
    const g = gn(0); g.connect(busMusic);
    const lp = flt('lowpass', 700, 0.8); lp.connect(g);
    const a = osc('sawtooth', 110), b = osc('sawtooth', 165.5), c = osc('sawtooth', 220.4);
    [a, b, c].forEach((o) => { pipe(o, gn(0.16), lp); o.start(); });
    const vib = osc('sine', 0.27);
    pipe(vib, gn(2.5), a.frequency);
    pipe(vib, gn(3), b.frequency);
    vib.start();
    return mStalk = { g, oscs: [a, b, c, vib] };
  }

  // Hunt = tritone (D + G#) + 60Hz sub thump every 4 beats @ 60 BPM.
  function buildHunt() {
    if (mHunt) return mHunt;
    const g = gn(0); g.connect(busMusic);
    const d = osc('sawtooth', 146.83), gs = osc('sawtooth', 207.65);
    const lp = flt('lowpass', 1100, 1.1); lp.connect(g);
    pipe(d, gn(0.14), lp); pipe(gs, gn(0.12), lp);
    d.start(); gs.start();
    let beat = 0;
    const tick = () => {
      if (!mHunt) return;
      if (beat++ % 4 === 0) {
        const t = now();
        const sub = osc('sine', 60);
        pipe(sub, env(t, 0.01, 0.22, 0.45), g);
        sub.start(t); sub.stop(t + 0.55);
      }
      mHunt.timer = setTimeout(tick, 1000);
    };
    mHunt = { g, oscs: [d, gs], timer: null };
    tick();
    return mHunt;
  }

  // Chase = 130 BPM noise-kick + dissonant stab on every other beat
  // + slow sub-bass riser that restarts every 32 beats.
  function buildChase() {
    if (mChase) return mChase;
    const g = gn(0); g.connect(busMusic);
    const riser = osc('sawtooth', 40);
    pipe(riser, gn(0.08), g);
    riser.start();
    const restartRiser = () => {
      const tn = now();
      try {
        riser.frequency.cancelScheduledValues(tn);
        riser.frequency.setValueAtTime(40, tn);
        riser.frequency.exponentialRampToValueAtTime(180, tn + 12);
      } catch {}
    };
    restartRiser();
    const interval = 60000 / 130;
    let beat = 0;
    const tick = () => {
      if (!mChase) return;
      const t = now();
      const k = nz(0.8);
      pipe(k, flt('lowpass', 200, 1.6), env(t, 0.002, 0.22, 0.14), g);
      k.start(t, rnd() * 3, 0.18);
      if (beat % 2 === 1) {
        const s1 = osc('sine', 1320), s2 = osc('square', 1397);
        const se = env(t, 0.005, 0.06, 0.12);
        pipe(s1, gn(0.5), se); pipe(s2, gn(0.3), se);
        se.connect(g);
        [s1, s2].forEach((o) => { o.start(t); o.stop(t + 0.16); });
      }
      if (++beat % 32 === 0) restartRiser();
      mChase.timer = setTimeout(tick, interval);
    };
    mChase = { g, oscs: [riser], timer: null };
    tick();
    return mChase;
  }

  function fadeIn(layer, target, secs) { if (layer) gl(layer.g.gain, target, secs); }
  function fadeOut(layer, secs, then) {
    if (!layer) { then && then(); return; }
    gl(layer.g.gain, 0, secs);
    setTimeout(() => {
      (layer.oscs || []).forEach(stop_);
      if (layer.timer) clearTimeout(layer.timer);
      try { layer.g.disconnect(); } catch {}
      then && then();
    }, secs * 1000 + 50);
  }

  function playStalkMusic() { if (!started) return; buildStalk(); fadeIn(mStalk, 0.04, 2.5); }
  function playHuntMusic()  { if (!started) return; buildStalk(); buildHunt();
                              fadeIn(mStalk, 0.04, 1.5); fadeIn(mHunt, 0.08, 8); }
  function playChaseMusic() { if (!started) return; buildStalk(); buildHunt(); buildChase();
                              fadeIn(mStalk, 0.03, 1); fadeIn(mHunt, 0.06, 1); fadeIn(mChase, 0.12, 1.2); }

  function stopAllMusic() {
    fadeOut(mStalk, 0.6, () => mStalk = null);
    fadeOut(mHunt,  0.6, () => mHunt = null);
    fadeOut(mChase, 0.6, () => mChase = null);
  }

  // ---- 14. JUMPSCARE (6 layers + 40ms delayed secondary shriek) -----------
  function playJumpscare() {
    if (!started || !ctx) return;
    const t0 = now();
    const out = gn(0.7); out.connect(busSfx);
    const fire = (node, dur, atk, pk, dec, at = t0) => {
      pipe(node, env(at, atk, pk, dec), out);
      node.start(at); if (node.stop) node.stop(at + dur);
    };
    const sw = osc('sawtooth', 900);
    sw.frequency.exponentialRampToValueAtTime(200, t0 + 0.25);
    fire(sw, 0.45, 0.005, 0.45, 0.39);
    fire(osc('square', 600), 0.2, 0.005, 0.25, 0.175);
    const ns = nz(1.2);
    pipe(ns, env(t0, 0.01, 0.35, 0.31), out);
    ns.start(t0, rnd() * 3, 0.35);
    fire(osc('sine', 60), 0.55, 0.015, 0.6, 0.485);
    fire(osc('sine', 1200), 0.32, 0.008, 0.32, 0.292);
    const gr = osc('square', 200);
    pipe(gr, flt('lowpass', 400), env(t0, 0.02, 0.4, 0.43), out);
    gr.start(t0); gr.stop(t0 + 0.5);
    fire(osc('sine', 1450), 0.3, 0.008, 0.22, 0.272, t0 + 0.04);
  }

  // ---- 15. KILL SCREAM (extended chaotic 1.5s) ----------------------------
  function playKill() {
    if (!started || !ctx) return;
    const t0 = now();
    const out = gn(0.85); out.connect(busSfx);
    pipe(out, gn(0.4), reverbIn);
    const sw = osc('sawtooth', 1100);
    sw.frequency.exponentialRampToValueAtTime(140, t0 + 1.4);
    pipe(sw, env(t0, 0.005, 0.5, 1.5), out);
    sw.start(t0); sw.stop(t0 + 1.55);
    const ns = nz(1); ns.loop = true;
    pipe(ns, flt('bandpass', 1800, 1.4), env(t0, 0.01, 0.4, 1.5), out);
    ns.start(t0); ns.stop(t0 + 1.6);
    [0, 0.18, 0.42].forEach((off, i) => {
      const sh = osc('sine', 900 + i * 250 + rnd() * 200);
      pipe(sh, env(t0 + off, 0.008, 0.35, 0.7), out);
      sh.start(t0 + off); sh.stop(t0 + off + 0.75);
    });
    const gr = osc('square', 80);
    pipe(gr, flt('lowpass', 350), env(t0, 0.02, 0.5, 1.45), out);
    gr.start(t0); gr.stop(t0 + 1.5);
    const sh2 = osc('sine', 1500);
    pipe(sh2, env(t0 + 0.05, 0.008, 0.3, 0.5), out);
    sh2.start(t0 + 0.05); sh2.stop(t0 + 0.6);
  }

  // ---- 16. WIN (rising violin + A-major arpeggio) -------------------------
  function playWin() {
    if (!started || !ctx) return;
    const t0 = now();
    const out = gn(0.3); out.connect(busMusic);
    pipe(out, gn(0.4), reverbIn);
    const v = osc('sawtooth', 220);
    v.frequency.linearRampToValueAtTime(440, t0 + 4);
    const vib = osc('sine', 5.5);
    pipe(vib, gn(3), v.frequency);
    pipe(v, flt('lowpass', 1800, 0.9), env(t0, 0.6, 0.45, 4), out);
    v.start(t0); v.stop(t0 + 4.6);
    vib.start(t0); vib.stop(t0 + 4.6);
    [220, 277.18, 329.63, 440].forEach((f, i) => {
      const ts = t0 + 0.4 + i * 0.5;
      const o = osc('triangle', f);
      pipe(o, env(ts, 0.04, 0.18, 0.95), out);
      o.start(ts); o.stop(ts + 1.05);
    });
  }

  // ---- 17. FOOTSTEP (player) — speed shapes brightness + amplitude --------
  // Surface palette modulates filter centre + Q + amplitude:
  //   dirt  (default) — 600+s*800 Hz bandpass, baseline
  //   grass — lower centre + lower amplitude (softer step on grass)
  //   path  — slightly brighter + tighter band (drier tile-tap)
  function playFootstep(speed) {
    if (!started || !ctx) return;
    const s = c01(speed), t = now();
    const src = nz(0.9 + (rnd() - 0.5) * 0.1);
    let centre = 600 + s * 800, Q = 1.4, ampScale = 1.0;
    if (currentSurface === 'grass')      { centre = 380 + s * 540; Q = 1.1; ampScale = 0.62; }
    else if (currentSurface === 'path')  { centre = 820 + s * 980; Q = 2.0; ampScale = 1.10; }
    const pk = (0.12 + 0.18 * s) * ampScale;
    pipe(src, flt('bandpass', centre, Q),
         env(t, 0.005, pk, 0.09 + 0.05 * (1 - s)), busSfx);
    src.start(t, rnd() * 3, 0.16);
  }
  // setSurface — caller picks 'dirt' (default) / 'grass' / 'path' to change
  // the footstep tone palette. Ignored when audio is not started.
  function setSurface(surface) {
    if (surface !== 'dirt' && surface !== 'grass' && surface !== 'path') return;
    currentSurface = surface;
  }

  // ---- 18. FLASHLIGHT CLICK -----------------------------------------------
  function playFlashlightClick() {
    if (!started || !ctx) return;
    const t = now();
    const a = osc('square', 3400), b = osc('triangle', 1800);
    const e = env(t, 0.001, 0.25, 0.04);
    pipe(a, gn(0.5), e); pipe(b, gn(0.3), e); e.connect(busSfx);
    [a, b].forEach((o) => { o.start(t); o.stop(t + 0.06); });
    const ns = nz(1.4);
    pipe(ns, flt('highpass', 2500), env(t, 0.001, 0.18, 0.03), busSfx);
    ns.start(t, 0, 0.04);
  }

  // ---- 19. FLASHLIGHT FLICKER ---------------------------------------------
  function playFlashlightFlicker() {
    if (!started || !ctx) return;
    const t = now();
    const o1 = osc('square', 60), o2 = osc('square', 180);
    const bp = flt('bandpass', 220, 0.8);
    pipe(o1, gn(0.5), bp); pipe(o2, gn(0.25), bp);
    pipe(bp, env(t, 0.005, 0.08, 0.18), busSfx);
    [o1, o2].forEach((o) => { o.start(t); o.stop(t + 0.22); });
    const ns = nz(1.1);
    pipe(ns, flt('highpass', 3500), env(t, 0.003, 0.07, 0.12), busSfx);
    ns.start(t, rnd() * 3, 0.15);
  }

  // ---- 20. ITEM PICKUP (subdued 2-note chime: E5 -> A5) -------------------
  function playItemPickup() {
    if (!started || !ctx) return;
    const t = now();
    const out = gn(0.4); out.connect(busSfx);
    pipe(out, gn(0.3), reverbIn);
    [[659.25, 0], [880, 0.12]].forEach(([f, off]) => {
      const ts = t + off;
      const o = osc('triangle', f);
      pipe(o, flt('lowpass', 2500), env(ts, 0.01, 0.22, 0.4), out);
      o.start(ts); o.stop(ts + 0.45);
    });
  }

  // ---- 21. BEACON ACTIVATED (industrial siren) ----------------------------
  function playBeaconActivated() {
    if (!started || !ctx) return;
    const t0 = now();
    const out = gn(0.35); out.connect(busSfx);
    pipe(out, gn(0.3), reverbIn);
    const siren = osc('sawtooth', 240);
    siren.frequency.exponentialRampToValueAtTime(880, t0 + 2.5);
    pipe(siren, flt('bandpass', 900, 2), env(t0, 0.15, 0.45, 2.4), out);
    siren.start(t0); siren.stop(t0 + 2.7);
    const sub = osc('sine', 80);
    pipe(sub, env(t0, 0.002, 0.5, 0.7), out);
    sub.start(t0); sub.stop(t0 + 0.75);
    const cl = nz(1);
    pipe(cl, flt('bandpass', 1400, 4), env(t0, 0.002, 0.3, 0.35), out);
    cl.start(t0, rnd() * 3, 0.4);
  }

  // ---- 22. CROUCH — subtle joint creak ------------------------------------
  // Two short pitched-down clicks layered through a tight bandpass — reads as
  // tendon/cloth tension when transitioning into crouch.
  function playCrouch() {
    if (!started || !ctx) return;
    const t = now();
    const out = gn(0.2); out.connect(busSfx);
    // Click 1: 280Hz sine dropping
    const o1 = osc('sine', 280);
    o1.frequency.exponentialRampToValueAtTime(160, t + 0.18);
    pipe(o1, flt('bandpass', 240, 4), env(t, 0.01, 0.18, 0.2), out);
    o1.start(t); o1.stop(t + 0.22);
    // Click 2: short fabric rustle
    const ns = nz(0.7);
    pipe(ns, flt('bandpass', 1200, 3), env(t + 0.04, 0.005, 0.08, 0.18), out);
    ns.start(t + 0.04, rnd() * 3, 0.20);
  }

  // ---- 23. GASP — exhausted breath (stamina = 0) --------------------------
  // Sharp inhale + drawn-out exhale through a low-band noise. Layered with a
  // bit of throat-tone (sine ~180Hz) for human weight.
  function playGasp() {
    if (!started || !ctx) return;
    const t = now();
    const out = gn(0.4); out.connect(busSfx);
    // Inhale (sharp, brief, brighter)
    const inh = nz(0.9);
    pipe(inh, flt('bandpass', 900, 1.2), env(t, 0.05, 0.35, 0.25), out);
    inh.start(t, rnd() * 3, 0.32);
    // Exhale (slower, lower, longer)
    const exh = nz(0.7);
    pipe(exh, flt('bandpass', 500, 1.4), env(t + 0.35, 0.15, 0.32, 0.55), out);
    exh.start(t + 0.35, rnd() * 3, 0.72);
    // Throat tone — gives the gasp a body
    const o = osc('sine', 180);
    o.frequency.linearRampToValueAtTime(140, t + 0.6);
    pipe(o, gn(0.18), env(t + 0.05, 0.08, 0.18, 0.6), out);
    o.start(t + 0.05); o.stop(t + 0.7);
  }

  // ---- 24. ITEM HUM (positional, modulated by distance) -------------------
  // Persistent low/high two-osc tone that swells as the player nears an item
  // (within 3m).  Caller passes the distance each frame; we ease the gain.
  // Lazily created on first call.
  function playItemHum(dist) {
    if (!started || !ctx) return;
    if (!itemHum) {
      const g = gn(0); g.connect(busSfx);
      const a = osc('sine', 220);
      const b = osc('sine', 327);
      const tremolo = osc('sine', 4);
      const tg = gn(0.04);
      pipe(tremolo, tg, g.gain);
      pipe(a, gn(0.18), g);
      pipe(b, gn(0.12), g);
      a.start(); b.start(); tremolo.start();
      itemHum = { g, a, b, tremolo, tg };
    }
    // 3m falloff: at 0m gain ~0.18, at 3m+ gain 0.
    const d = mx(0, dist || 0);
    const k = mx(0, 1 - d / 3);
    gl(itemHum.g.gain, 0.18 * k, 0.18);
  }
  function stopItemHum() {
    if (!itemHum) return;
    stop_(itemHum.a); stop_(itemHum.b); stop_(itemHum.tremolo);
    itemHum = null;
  }

  // ---- 25. BEACON RISING (30s industrial siren ramp) ----------------------
  // Long-form one-shot. Cumulative siren that climbs over 30s and falls back.
  // Caller schedules at items==5 + 30s. Second invocation no-ops while one is
  // already in flight (prevents stacking).
  function playBeaconRising() {
    if (!started || !ctx) return;
    if (beaconRising) return;
    const t0 = now();
    const out = gn(0.0); out.connect(busSfx);
    pipe(out, gn(0.4), reverbIn);
    // Slow siren ramp 220Hz -> 660Hz over 24s, then fall 660 -> 200 in 6s.
    const siren = osc('sawtooth', 220);
    siren.frequency.linearRampToValueAtTime(660, t0 + 24);
    siren.frequency.linearRampToValueAtTime(200, t0 + 30);
    pipe(siren, flt('bandpass', 700, 1.8), gn(0.35), out);
    // Sub-rumble grows underneath.
    const sub = osc('sine', 55);
    pipe(sub, gn(0.22), out);
    [siren, sub].forEach((o) => o.start(t0));
    // Envelope: fade in over 4s, hold, fade out over 5s.
    gl(out.gain, 0.45, 4);
    setTimeout(() => { if (started) gl(out.gain, 0, 5); }, 25000);
    setTimeout(() => {
      stop_(siren); stop_(sub);
      try { out.disconnect(); } catch {}
      beaconRising = null;
    }, 31000);
    beaconRising = { out, siren, sub };
  }

  // ---- 26. DISTANT CAR HORN (rare ambient cue) ----------------------------
  // Two short honks of a faded car horn. Highly attenuated + heavy reverb so it
  // reads as "very far away — civilisation exists somewhere". Throttled to
  // once-per-30s to avoid pile-up if called from a tight loop.
  function playDistantCar() {
    if (!started || !ctx) return;
    const t = now();
    if (t - _lastDistantCarAt < 30) return;
    _lastDistantCarAt = t;
    const out = gn(0.12); out.connect(busSfx);
    pipe(out, gn(0.85), reverbIn);
    // Two-tone car horn (slight pitch beating).
    const honk = (s, dur) => {
      const a = osc('square', 220);
      const b = osc('square', 277);
      const lp = flt('lowpass', 1200, 0.8);
      pipe(a, gn(0.5), lp); pipe(b, gn(0.4), lp);
      pipe(lp, env(s, 0.02, 0.5, dur - 0.02), out);
      [a, b].forEach((o) => { o.start(s); o.stop(s + dur + 0.05); });
    };
    honk(t, 0.45);
    honk(t + 0.55, 0.6);
  }

  // ---- 27. WIND WHISTLE (during gusts) ------------------------------------
  // Two detuned filtered tones layered over the bed. Intensity (0..1) drives
  // gain and the high-band frequency. Always lazy-create; second call eases
  // the running gain toward the new target.
  function playWindWhistle(intensity) {
    if (!started || !ctx) return;
    const k = c01(intensity);
    if (!windWhistle) {
      const g = gn(0); g.connect(busAmbient);
      const a = osc('sine', 880);
      const b = osc('sine', 1310);
      // Add a noise band so it reads as airflow, not a synth lead.
      const ns = nz(0.8); ns.loop = true;
      const bp = flt('bandpass', 2100, 12);
      pipe(ns, bp, gn(0.07), g);
      pipe(a, gn(0.06), g);
      pipe(b, gn(0.04), g);
      a.start(); b.start(); ns.start();
      windWhistle = { g, a, b, ns };
    }
    gl(windWhistle.g.gain, 0.12 * k, 0.6);
  }
  function stopWindWhistle() {
    if (!windWhistle) return;
    stop_(windWhistle.a); stop_(windWhistle.b); stop_(windWhistle.ns);
    windWhistle = null;
  }

  // ---- 28. RAIN ON SHELTER (near cabin during rain) -----------------------
  // Layered low-rumble + soft pitter; tells the player they're under shelter.
  // Caller passes a normalised volume 0..1 (typically 1 - dist/12).  Lazy-init.
  function playRainOnShelter(volume) {
    if (!started || !ctx) return;
    const k = c01(volume);
    if (!shelterRain) {
      const g = gn(0); g.connect(busAmbient);
      const drum = nz(0.5); drum.loop = true;
      const lp = flt('lowpass', 400, 1.0);
      pipe(drum, lp, gn(0.35), g);
      const patter = nz(0.9); patter.loop = true;
      const bp = flt('bandpass', 1800, 2);
      pipe(patter, bp, gn(0.18), g);
      drum.start(); patter.start();
      shelterRain = { g, drum, patter };
    }
    gl(shelterRain.g.gain, 0.18 * k, 0.5);
  }
  function stopShelterRain() {
    if (!shelterRain) return;
    stop_(shelterRain.drum); stop_(shelterRain.patter);
    shelterRain = null;
  }

  // ---- 29. RAIN ON / OFF (overall ambient) -------------------------------
  // Background rain ambience that fades up/down. Called by main.js's rain
  // system at rain-start / rain-end. Reuses the shelter rain primitives for
  // the patter layer but adds a wider noise bed so it reads as "outdoors in
  // the rain" without the shelter low-pass dampening.
  let rainBed = null;
  function playRainOn() {
    if (!started || !ctx) return;
    if (!rainBed) {
      const g = gn(0); g.connect(busAmbient);
      const wide = nz(0.7); wide.loop = true;
      const hp = flt('highpass', 600, 0.6);
      pipe(wide, hp, gn(0.22), g);
      const fall = nz(0.9); fall.loop = true;
      const bp = flt('bandpass', 2400, 1.8);
      pipe(fall, bp, gn(0.12), g);
      wide.start(); fall.start();
      rainBed = { g, wide, fall };
    }
    gl(rainBed.g.gain, 0.22, 3);
  }
  function playRainOff() {
    if (!rainBed) return;
    gl(rainBed.g.gain, 0, 3);
    const ref = rainBed; rainBed = null;
    setTimeout(() => {
      stop_(ref.wide); stop_(ref.fall);
      try { ref.g.disconnect(); } catch {}
    }, 3500);
  }

  // ---- 30. HEARTBEAT (positional, fades to zero when far from clown) ------
  // Persistent low sub-thump scheduler. setHeartbeatRate(rate) updates the
  // beats-per-second + the breath-band gain envelope. When the rate is set to
  // a low value (player far from clown), the gain fades to ~0 so the loop is
  // silent, not "constantly low".
  function _ensureHeart() {
    if (heart) return heart;
    const g = gn(0); g.connect(busSfx);
    heart = { g, rateHz: 0.0, timer: null, gainTarget: 0 };
    const tick = () => {
      if (!heart) return;
      // Schedule a single thump if gain is high enough to be audible.
      if (heart.gainTarget > 0.02 && started && ctx) {
        const t = now();
        const o = osc('sine', 58);
        const e = env(t, 0.01, 0.22 * heart.gainTarget, 0.18);
        pipe(o, e, g);
        o.start(t); o.stop(t + 0.22);
      }
      // Reschedule based on current rate; clamp so 0 rate => long pause.
      const interval = heart.rateHz > 0.05 ? 1000 / heart.rateHz : 1500;
      heart.timer = setTimeout(tick, interval);
    };
    tick();
    return heart;
  }
  function setHeartbeatRate(rate) {
    if (!started || !ctx) return;
    _ensureHeart();
    // rate 0..2 Hz. Player FAR => low rate => gain target near 0.
    // Player NEAR => higher rate => gain target near 1.
    const r = mx(0, mn(2, rate || 0));
    heart.rateHz = r;
    // gain target follows rate: <0.5 Hz silent (was the old "low loop").
    heart.gainTarget = r < 0.5 ? 0 : mn(1, (r - 0.5) / 1.0);
    // Ease the heartbeat-bus gain too so the silent state really is silent.
    gl(heart.g.gain, heart.gainTarget, 0.6);
  }
  function stopHeart() {
    if (!heart) return;
    if (heart.timer) clearTimeout(heart.timer);
    try { heart.g.disconnect(); } catch {}
    heart = null;
  }

  // ---- 31. UPDATE CLOWN DISTANCE (drives breath) --------------------------
  // Caller passes the live clown<->player distance each frame. We use it to
  // drive the existing clown-breath gain (lazy-creating on first nearby call).
  function updateClownDistance(dist) {
    if (!started || !ctx) return;
    const d = mx(0, dist || 0);
    // Above 15m breath is inaudible — don't even create the loop.
    if (d > 15) {
      if (clownBreath) gl(clownBreath.g.gain, 0, 0.3);
      return;
    }
    // Create the breath if needed and ramp gain toward distance-derived level.
    playClownBreath(d);
  }

  return {
    start, stop,
    playFootstep, setSurface,
    playFlashlightClick, playFlashlightFlicker,
    playForestAmbience, playWindGust, playTwigSnap, playLeafSwirl, playOwl,
    playClownLaugh, playClownStep, playClownBreath, playKnifeDrag,
    playLightning,
    playStalkMusic, playHuntMusic, playChaseMusic, stopAllMusic,
    playJumpscare, playKill, playWin,
    playItemPickup, playBeaconActivated,
    // Round-3 additions
    playCrouch, playGasp,
    playItemHum, playBeaconRising,
    playDistantCar, playWindWhistle,
    playRainOn, playRainOff, playRainOnShelter,
    setHeartbeatRate, updateClownDistance,
  };
}
