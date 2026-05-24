// Tiny shared WebAudio synth for mini-games.
// Usage:
//   import { createSfx } from '../../src/shared/miniSfx.js';
//   const sfx = createSfx({ storageKey: 'pug-tongue:muted' });
//   sfx.tone(880, 'triangle', 0.1, 0.2);
//   sfx.toggleMute();
//   sfx.applyButton(document.getElementById('mute-btn'));
//
// Routes every voice through a per-instance master gain whose value is sourced
// from `wg:settings:sfx` (set by src/shared/settingsMenu.js) so the universal
// settings panel controls volume across every game uniformly. The legacy
// per-game `storageKey` still controls a hard local mute (kept for backwards
// compat, e.g. the per-game 🔊 button), but the new global mute is ORed in.
import { getMasterGain, onSettingsChange } from './settingsMenu.js';
export function createSfx({ storageKey = 'wg:muted' } = {}) {
  let actx = null;
  let muted = localStorage.getItem(storageKey) === '1';
  let master = null;
  const audio = () => {
    if (actx) return actx;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = getMasterGain('sfx');
      master.connect(actx.destination);
    } catch {}
    return actx;
  };
  // Re-read master volume when the user adjusts the global slider/mute.
  onSettingsChange(() => { if (master) master.gain.value = getMasterGain('sfx'); });
  const _dest = () => { audio(); return master || (actx && actx.destination) || null; };
  const _peak = (p) => p; // Engine-side peaks normalised to <=0.22 (≈-6dB)
  const tone = (freq, type = 'square', dur = 0.08, peak = 0.18) => {
    if (muted) return;
    const c = audio(); if (!c) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(_peak(peak), c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(_dest());
    o.start(); o.stop(c.currentTime + dur + 0.02);
  };
  const sweep = (f0, f1, type = 'sawtooth', dur = 0.2, peak = 0.18) => {
    if (muted) return;
    const c = audio(); if (!c) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(f1, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(_peak(peak), c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(_dest());
    o.start(); o.stop(c.currentTime + dur + 0.02);
  };
  const noise = (dur = 0.1, peak = 0.2, hp = 0) => {
    if (muted) return;
    const c = audio(); if (!c) return;
    const buf = c.createBuffer(1, Math.floor(dur * c.sampleRate), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(_peak(peak), c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    if (hp) {
      const f = c.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = hp;
      src.connect(f).connect(g).connect(_dest());
    } else {
      src.connect(g).connect(_dest());
    }
    src.start(); src.stop(c.currentTime + dur + 0.02);
  };
  const arp = (freqs, type = 'square', step = 0.07, peak = 0.2, dur = 0.3) => {
    freqs.forEach((f, i) => setTimeout(() => tone(f, type, dur, peak), i * step * 1000));
  };
  // === Uniform UX helpers (cross-game polish) ===
  // click — short tick, all UI button presses (kept quieter than gameplay SFX)
  const click = () => tone(720, 'square', 0.04, 0.10);
  // popup — ascending 3-note arpeggio, every notification/toast
  const popup = () => arp([523, 659, 784], 'triangle', 0.06, 0.16, 0.18);
  // damage — multi-layer hit: bass thump + click + lowpass tail
  const damage = () => {
    if (muted) return;
    const c = audio(); if (!c) return;
    // Layer 1: bass thump (sub punch)
    const b = c.createOscillator();
    b.type = 'sine';
    b.frequency.setValueAtTime(160, c.currentTime);
    b.frequency.exponentialRampToValueAtTime(48, c.currentTime + 0.16);
    const bg = c.createGain();
    bg.gain.setValueAtTime(0, c.currentTime);
    bg.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.005);
    bg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
    b.connect(bg).connect(_dest());
    b.start(); b.stop(c.currentTime + 0.2);
    // Layer 2: bright click transient
    const t = c.createOscillator();
    t.type = 'square';
    t.frequency.setValueAtTime(1800, c.currentTime);
    const tg = c.createGain();
    tg.gain.setValueAtTime(0, c.currentTime);
    tg.gain.linearRampToValueAtTime(0.10, c.currentTime + 0.001);
    tg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04);
    t.connect(tg).connect(_dest());
    t.start(); t.stop(c.currentTime + 0.05);
    // Layer 3: noise tail with lowpass sweep
    const buf = c.createBuffer(1, Math.floor(0.18 * c.sampleRate), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2400, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.18);
    src.connect(f).connect(g).connect(_dest());
    src.start(); src.stop(c.currentTime + 0.2);
  };
  // pickup — bright ascending triple chime with overtones (rewarding)
  const pickup = () => {
    tone(880, 'triangle', 0.05, 0.18);
    tone(1320, 'sine', 0.06, 0.10);
    setTimeout(() => { tone(1320, 'triangle', 0.06, 0.18); tone(1760, 'sine', 0.04, 0.08); }, 50);
    setTimeout(() => tone(1760, 'triangle', 0.07, 0.14), 110);
  };
  // death — dramatic low-pitched fall + sub-bass thump + noise wash
  const death = () => {
    if (muted) return;
    const c = audio(); if (!c) return;
    // Long descending sawtooth
    sweep(330, 55, 'sawtooth', 0.8, 0.22);
    // Sub-bass thud
    const sub = c.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, c.currentTime);
    sub.frequency.exponentialRampToValueAtTime(28, c.currentTime + 0.6);
    const sg = c.createGain();
    sg.gain.setValueAtTime(0, c.currentTime);
    sg.gain.linearRampToValueAtTime(0.22, c.currentTime + 0.01);
    sg.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.7);
    sub.connect(sg).connect(_dest());
    sub.start(); sub.stop(c.currentTime + 0.75);
    // Noise wash
    noise(0.4, 0.10, 80);
  };
  // combo — distinct stinger per combo level (1..). Higher = higher pitch + brighter.
  const combo = (level = 1) => {
    if (muted) return;
    const lvl = Math.max(1, Math.min(8, level | 0));
    const base = 440 * Math.pow(1.18, lvl - 1); // climb roughly a minor 3rd per level
    tone(base, 'square', 0.06, 0.16);
    setTimeout(() => tone(base * 1.5, 'triangle', 0.08, 0.18), 40);
    if (lvl >= 3) setTimeout(() => tone(base * 2, 'triangle', 0.07, 0.14), 90);
    if (lvl >= 5) setTimeout(() => tone(base * 2.5, 'sine', 0.10, 0.12), 150);
  };
  // === UI events — `playUI(eventName)` for menus/modals/buttons ============
  const _uiEvents = {
    click: () => tone(720, 'square', 0.04, 0.10),
    hover: () => tone(2400, 'sine',   0.02, 0.03),   // very subtle high-frequency tick
    open:  () => arp([392, 523, 659], 'triangle', 0.05, 0.10, 0.14),
    close: () => arp([659, 523, 392], 'triangle', 0.05, 0.10, 0.14),
    error: () => { sweep(220, 110, 'sawtooth', 0.18, 0.14); },
    success: () => arp([523, 659, 784, 1047], 'triangle', 0.06, 0.16, 0.16),
    coin: () => { tone(988, 'square', 0.04, 0.14); setTimeout(() => tone(1319, 'square', 0.08, 0.16), 50); },
  };
  const playUI = (name) => {
    if (muted) return;
    const fn = _uiEvents[name];
    if (fn) try { fn(); } catch {}
  };
  // === Stereo / positional helper — pan voice based on world X vs screen center
  // panX(...) accepts a callback; returns object whose gain is positioned via
  // a StereoPannerNode (graceful fallback to mono if unsupported).
  // Usage from games:
  //   sfx.tonePanned(440, 'triangle', 0.1, 0.2, pan);
  // where pan in [-1..1]. Helpers below compute pan from world coords.
  const _pan = (peakNode, panVal) => {
    const c = audio(); if (!c) return peakNode;
    try {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, panVal || 0));
      peakNode.connect(p);
      p.connect(_dest());
      return p;
    } catch { return peakNode; }
  };
  // Helper: convert a worldX + screen center to pan -1..1 (clamped, eased).
  const panFromWorld = (worldX, centerX, halfWidth = 360) => {
    const dx = (worldX - centerX) / Math.max(40, halfWidth);
    return Math.max(-1, Math.min(1, dx));
  };
  // Same tone() but stereo-panned. Skips pan if value ~0 for perf.
  const tonePanned = (freq, type, dur, peak, pan) => {
    if (muted) return;
    const c = audio(); if (!c) return;
    if (!pan || Math.abs(pan) < 0.05) return tone(freq, type, dur, peak);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(_peak(peak), c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g);
    try {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(_dest());
    } catch { g.connect(_dest()); }
    o.start(); o.stop(c.currentTime + dur + 0.02);
  };
  const isMuted = () => muted;
  const setMuted = (v) => { muted = !!v; localStorage.setItem(storageKey, muted ? '1' : '0'); };
  const toggleMute = () => { setMuted(!muted); return muted; };
  const resume = () => audio()?.resume?.();
  const applyButton = (btn) => {
    if (!btn) return;
    // The shared settings modal now owns the mute UI — hide the legacy 🔊
    // button so it doesn't visually duplicate the gear control. We still
    // honour clicks on it in case any custom theme keeps it visible.
    btn.style.display = 'none';
    const sync = () => { btn.textContent = muted ? '🔇' : '🔊'; btn.classList.toggle('muted', muted); };
    sync();
    btn.addEventListener('click', () => { resume(); toggleMute(); sync(); });
  };
  // Auto-resume the audio context on first user interaction (mobile autoplay policy).
  const _resumeOnce = () => { resume(); document.removeEventListener('pointerdown', _resumeOnce); document.removeEventListener('keydown', _resumeOnce); };
  document.addEventListener('pointerdown', _resumeOnce, { once: false });
  document.addEventListener('keydown', _resumeOnce, { once: false });
  return {
    tone, sweep, noise, arp,
    click, popup, damage, pickup, death, combo,
    playUI,
    tonePanned, panFromWorld,
    isMuted, setMuted, toggleMute, resume, applyButton,
  };
}

// =============================================================================
// Singleton UI SFX for the HUB (no per-game sfx instance exists there).
// Use playUI('event') anywhere — auto-routes through the shared master gain.
// =============================================================================
let _hubSfx = null;
function _hubInstance() {
  if (_hubSfx) return _hubSfx;
  _hubSfx = createSfx({ storageKey: 'hub:muted' });
  return _hubSfx;
}
export function playUI(name) {
  try { _hubInstance().playUI(name); } catch {}
}

