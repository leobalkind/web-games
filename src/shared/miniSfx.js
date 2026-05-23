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
  // click — short tick, all UI button presses
  const click = () => tone(720, 'square', 0.04, 0.14);
  // popup — ascending 3-note arpeggio, every notification/toast
  const popup = () => arp([523, 659, 784], 'triangle', 0.06, 0.16, 0.18);
  // damage — noise burst with low-pass sweep
  const damage = () => {
    if (muted) return;
    const c = audio(); if (!c) return;
    const buf = c.createBuffer(1, Math.floor(0.18 * c.sampleRate), c.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.2, c.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2400, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.18);
    src.connect(f).connect(g).connect(_dest());
    src.start(); src.stop(c.currentTime + 0.2);
  };
  // pickup — bright ascending double-beep
  const pickup = () => { tone(880, 'triangle', 0.05, 0.18); setTimeout(() => tone(1320, 'triangle', 0.06, 0.18), 50); };
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
  return { tone, sweep, noise, arp, click, popup, damage, pickup, isMuted, setMuted, toggleMute, resume, applyButton };
}
