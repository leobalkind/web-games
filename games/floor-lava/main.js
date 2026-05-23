// FLOOR IS LAVA: PUG ESCAPE — endless vertical climber.
// Random platforms scroll downward. Lava rises. Pug auto-falls (gravity).
// Double-jump. Treats give score.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'lava:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize); resize();

const GRAV = 1400;
const JUMP_V = -680;
let pug, plats, treats, powerups, blobs, lavaY, height, maxHeight, score, treatsGot, running, lastPlatY;
let jetpackT = 0, freezeT = 0, shrinkT = 0, wingsT = 0;
// Juice + visual layers
let embers = [];      // {x,y,vx,vy,life,max,r}
let lavaBubbles = []; // {x,y,r,life,max}
let popups = [];      // {x,y,vy,life,max,text,color}
let banner = null;    // {text,life,max}
let nextMilestone = 5;
let hitFlashT = 0;
let shakeT = 0, shakeMag = 0;
let caveOffset = 0;   // background parallax y scroll
// Map decor — stalactites/stalagmites + strata bands stored as world-y arrays
let caveSpikes = [];  // {x, y, side: 'top'|'bot'|'left'|'right', h}
let strataBands = []; // {y, color}
// === Doodle Jump-style enemy variety (scales with height) ===
let bats = [];        // {x, y, vx, baseY, ampT, alive} — fly horizontally crossing the play area, can be jumped on
let fireballs = [];   // {x, y, vx, vy, life, max} — spawn from screen edges, traverse the play area
let batSpawnT = 4;    // seconds until next bat spawn
let fireSpawnT = 6;   // seconds until next fireball spawn
// === Icy Tower combo-jumps ===
let lastPlat = null;  // platform reference last landed on (so re-landing same plat doesn't count)
let comboJumps = 0;   // consecutive distinct-platform landings without resting
let comboRestT = 0;   // seconds spent stationary on the SAME platform (resets combo after 0.7s)
// === Geometry Dash biome-shift checkpoints (every 500m) ===
// Three palettes: cave-grey (default), magma-orange, hellscape-red.
const BIOMES = [
  { name: 'CAVE',      sky0: '#0a0716', sky1: '#3a1a14', stratoR: 40, stratoG: 20, stratoB: 20, glow: '180,30,20', rockA: 'rgba(60,18,18,0.55)',  rockB: 'rgba(90,30,20,0.6)',  lava0: '#ff8e3c', lava1: '#ff3a3a', lava2: '#7a0a0a' },
  { name: 'MAGMA',     sky0: '#1a0510', sky1: '#5a2010', stratoR: 80, stratoG: 30, stratoB: 12, glow: '230,90,30',  rockA: 'rgba(90,30,12,0.6)',   rockB: 'rgba(130,50,20,0.62)', lava0: '#ffb04a', lava1: '#ff5a3a', lava2: '#8a1a08' },
  { name: 'HELLSCAPE', sky0: '#1a0008', sky1: '#6a0810', stratoR: 130, stratoG: 18, stratoB: 22, glow: '255,40,40', rockA: 'rgba(120,16,18,0.62)', rockB: 'rgba(160,30,20,0.65)', lava0: '#ffd66a', lava1: '#ff2020', lava2: '#400000' },
];
let biomeIdx = 0;            // currently fully-applied biome index
let nextBiomeAtHeight = 500; // height in m at which the next shift starts
let biomeShiftT = 0;         // seconds remaining in active 2s shift transition
let biomeShiftTarget = 0;    // target biome index during a shift
// Returns the live (possibly mid-transition) biome palette used by render().
function getBiomePalette() {
  const from = BIOMES[biomeIdx];
  if (biomeShiftT <= 0) return from;
  const to = BIOMES[biomeShiftTarget];
  // 2s transition; biomeShiftT counts down from 2 to 0.
  const k = Math.max(0, Math.min(1, 1 - biomeShiftT / 2));
  // Linear blend HEX/RGB-channel colors; we keep things simple by returning
  // strings so render() can use them as fillStyle / gradient stops directly.
  const blendHex = (a, b) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 0xff) * (1 - k) + ((pb >> 16) & 0xff) * k);
    const g = Math.round(((pa >> 8) & 0xff) * (1 - k) + ((pb >> 8) & 0xff) * k);
    const bl = Math.round((pa & 0xff) * (1 - k) + (pb & 0xff) * k);
    return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
  };
  const blendRgbStr = (a, b) => {
    const pa = a.split(',').map(Number), pb = b.split(',').map(Number);
    return `${Math.round(pa[0] * (1 - k) + pb[0] * k)},${Math.round(pa[1] * (1 - k) + pb[1] * k)},${Math.round(pa[2] * (1 - k) + pb[2] * k)}`;
  };
  return {
    name: to.name,
    sky0: blendHex(from.sky0, to.sky0),
    sky1: blendHex(from.sky1, to.sky1),
    stratoR: Math.round(from.stratoR * (1 - k) + to.stratoR * k),
    stratoG: Math.round(from.stratoG * (1 - k) + to.stratoG * k),
    stratoB: Math.round(from.stratoB * (1 - k) + to.stratoB * k),
    glow: blendRgbStr(from.glow, to.glow),
    rockA: from.rockA, // hold these constant during transition — color is in sky+lava
    rockB: from.rockB,
    lava0: blendHex(from.lava0, to.lava0),
    lava1: blendHex(from.lava1, to.lava1),
    lava2: blendHex(from.lava2, to.lava2),
  };
}
function reset() {
  pug = { x: W / 2, y: H - 200, vx: 0, vy: 0, onGround: false, jumpsLeft: 2, w: 22, h: 22 };
  plats = []; treats = []; powerups = []; blobs = [];
  embers = []; lavaBubbles = []; popups = []; banner = null;
  caveSpikes = []; strataBands = [];
  bats = []; fireballs = [];
  batSpawnT = 4; fireSpawnT = 6;
  lastPlat = null; comboJumps = 0; comboRestT = 0;
  biomeIdx = 0; nextBiomeAtHeight = 500; biomeShiftT = 0; biomeShiftTarget = 0;
  nextMilestone = 5;
  hitFlashT = 0; shakeT = 0; shakeMag = 0; caveOffset = 0;
  lastPlatY = H - 100;
  // Initial ground
  plats.push({ x: W / 2 - 80, y: H - 100, w: 160, h: 16, kind: 'normal', baseX: W / 2 - 80, alive: true });
  // Seed initial wall decor (stalactites/stalagmites) above starting view
  for (let yy = H - 200; yy > -2000; yy -= 120) seedCaveSpikes(yy);
  // Strata bands every ~200px world space
  for (let yy = H; yy > -3000; yy -= 200) {
    strataBands.push({ y: yy, color: `rgba(${40 + Math.floor(Math.random()*20)},${20 + Math.floor(Math.random()*15)},${20},${0.08 + Math.random() * 0.06})` });
  }
  for (let i = 0; i < 30; i++) addPlatformAbove();
  lavaY = H + 200;
  height = 0; maxHeight = 0; score = 0; treatsGot = 0;
  jetpackT = 0; freezeT = 0; shrinkT = 0; wingsT = 0;
}
function seedCaveSpikes(yAround) {
  // ~6 per "slice" — split between left/right walls, top/bottom orientation
  for (let i = 0; i < 6; i++) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const orient = Math.random() < 0.5 ? 'top' : 'bot';
    const h = 14 + Math.random() * 18;
    const x = side === 'left' ? 8 + Math.random() * 16 : W - 8 - Math.random() * 16;
    const y = yAround - Math.random() * 120;
    caveSpikes.push({ x, y, side, orient, h });
  }
}
function shake(mag, dur) { shakeMag = Math.max(shakeMag, mag); shakeT = Math.max(shakeT, dur); }
function pop(x, y, text, color) {
  if (popups.length > 80) popups.shift();
  popups.push({ x, y, vy: -40, life: 0, max: 0.9, text, color: color || '#ffd23f' });
}
function addPlatformAbove() {
  lastPlatY -= 80 + Math.random() * 50;
  const w = 70 + Math.random() * 70;
  const x = Math.random() * (W - w);
  // Platform variety based on depth — higher = more variety
  const r = Math.random();
  const depth = (H - lastPlatY) / 100;
  let kind = 'normal';
  if (depth > 3 && r < 0.18) kind = 'crumble';
  else if (depth > 2 && r < 0.30) kind = 'bouncy';
  // ~25% of new platforms drift left-right (skip if it's the very first ground platform)
  const drifts = Math.random() < 0.25 && lastPlatY < H - 150;
  const baseX = x;
  const driftAmp = drifts ? 26 + Math.random() * 12 : 0;
  const driftPhase = Math.random() * Math.PI * 2;
  // 5% chance of a spike on top — but never on the lowest visible platform
  const hasSpike = lastPlatY < H - 200 && Math.random() < 0.05 && kind !== 'crumble' && kind !== 'bouncy';
  // 1/40 chance to spawn WINGS powerup
  const wingsHere = Math.random() < 1 / 40 && !hasSpike;
  plats.push({
    x, y: lastPlatY, w, h: 14, kind, t: 0, alive: true,
    baseX, driftAmp, driftPhase, hasSpike, vine: Math.random() < 0.18,
    crumbleStartT: 0,
  });
  if (!hasSpike && Math.random() < 0.45) treats.push({ x: x + w / 2, y: lastPlatY - 24, baseX: x + w / 2, plat: plats[plats.length - 1] });
  // Wings powerup (rare)
  if (wingsHere) {
    powerups.push({ x: x + w / 2, y: lastPlatY - 38, type: 'wings', plat: plats[plats.length - 1] });
  } else if (depth > 4 && Math.random() < 0.06) {
    const pwTypes = ['jetpack', 'freeze', 'shrink'];
    powerups.push({ x: x + w / 2, y: lastPlatY - 38, type: pwTypes[Math.floor(Math.random() * pwTypes.length)], plat: plats[plats.length - 1] });
  }
  // Lava blob (rare, only deep up)
  if (depth > 6 && Math.random() < 0.08) {
    blobs.push({ x: x + w / 2, y: H + 80, vy: -100 - Math.random() * 60, life: 2.5 });
  }
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' || e.key === 'w' || e.code === 'Space' || e.key === 'ArrowUp') jump();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let touchX = null;
canvas.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { touchX = e.touches[0].clientX; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => touchX = null);
document.getElementById('jump-btn').addEventListener('click', jump);
if ('ontouchstart' in window) document.getElementById('jump-btn').style.display = 'block';
// Universal mobile controls — platformer layout (L/R buttons + JUMP). Synth
// keys feed the keys Set and also trigger the keydown listener above which
// auto-calls jump() on space, so JUMP works without extra wiring.
createMobileControls({ layout: 'platformer', keys });

function jump() {
  if (!running || pug.jumpsLeft <= 0) return;
  pug.vy = JUMP_V * (wingsT > 0 ? 1.1 : 1);
  pug.jumpsLeft--;
  pug.onGround = false;
  sfx.tone(wingsT > 0 ? 990 : (pug.jumpsLeft === 1 ? 660 : 880), 'triangle', 0.08, 0.18);
}
function refillJumps() { pug.jumpsLeft = wingsT > 0 ? 3 : 2; }
// Icy Tower-style combo thresholds — popup + score bonus at 5/10/20/30/...
function checkComboThreshold() {
  // Trigger at 5, 10, 20, then every 10 above
  const hit =
    comboJumps === 5 || comboJumps === 10 || comboJumps === 20 ||
    (comboJumps > 20 && comboJumps % 10 === 0);
  if (!hit) return;
  const bonus = comboJumps * 10;
  score += bonus;
  banner = { text: `COMBO ×${comboJumps}!`, life: 0, max: 1.4 };
  pop(pug.x, pug.y - 30, `+${bonus}`, '#ff3aa1');
  sfx.arp([659, 880, 1320], 'triangle', 0.06, 0.2, 0.22);
  shake(4, 0.22);
}

function tick(dt) {
  if (!running) return;
  // Movement
  let mx = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (touchX !== null) {
    if (touchX < W / 2 - 30) mx = -1;
    else if (touchX > W / 2 + 30) mx = 1;
  }
  // Decay powerup timers
  jetpackT = Math.max(0, jetpackT - dt);
  freezeT = Math.max(0, freezeT - dt);
  shrinkT = Math.max(0, shrinkT - dt);
  wingsT = Math.max(0, wingsT - dt);
  // Drift platforms left/right (sin oscillation around baseX)
  const driftT = performance.now() * 0.001;
  for (const p of plats) {
    if (p.driftAmp > 0) {
      const nx = p.baseX + Math.sin(driftT * Math.PI + p.driftPhase) * p.driftAmp;
      // Move treats/powerups that ride this plat
      const dx = nx - p.x;
      p.x = nx;
      for (const t of treats) if (t.plat === p) t.x += dx;
      for (const pw of powerups) if (pw.plat === p) pw.x += dx;
    }
  }
  pug.vx += mx * 1200 * dt;
  pug.vx *= Math.pow(0.5, dt * 5);
  pug.vy += (jetpackT > 0 ? GRAV * 0.15 : GRAV) * dt;
  if (jetpackT > 0 && keys.has(' ')) pug.vy = Math.max(pug.vy, -200); // hover
  pug.x += pug.vx * dt;
  pug.y += pug.vy * dt;
  // Wrap horizontally
  if (pug.x < -10) pug.x = W;
  if (pug.x > W + 10) pug.x = 0;

  // Platform collision (only when falling)
  pug.onGround = false;
  const hw = (shrinkT > 0 ? pug.w * 0.5 : pug.w) / 2;
  if (pug.vy > 0) {
    for (const p of plats) {
      if (!p.alive) continue;
      if (pug.x + hw > p.x && pug.x - hw < p.x + p.w) {
        if (pug.y + pug.h / 2 > p.y && pug.y + pug.h / 2 < p.y + p.h + 12) {
          // Spike kills on landing
          if (p.hasSpike) { hitFlashT = 0.3; shake(8, 0.4); return die(); }
          if (p.kind === 'bouncy') {
            pug.vy = JUMP_V * 1.3;
            refillJumps();
            sfx.tone(990, 'triangle', 0.08, 0.2);
            shake(2, 0.12);
            // Icy Tower combo: bouncy launch counts as a chained landing.
            if (p !== lastPlat) {
              comboJumps++; lastPlat = p; comboRestT = 0;
              checkComboThreshold();
            }
          } else {
            pug.y = p.y - pug.h / 2;
            pug.vy = 0;
            pug.onGround = true;
            refillJumps();
            // Icy Tower combo: only NEW platform landings count.
            if (p !== lastPlat) {
              comboJumps++;
              lastPlat = p;
              comboRestT = 0;
              checkComboThreshold();
            }
            if (p.kind === 'crumble') {
              if (!p.crumbleStartT) p.crumbleStartT = performance.now();
              const elapsed = performance.now() - p.crumbleStartT;
              if (elapsed > 1500) {
                p.alive = false;
                // shed particles
                for (let i = 0; i < 6; i++) {
                  if (embers.length > 150) break;
                  embers.push({ x: p.x + Math.random() * p.w, y: p.y, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 40, life: 0, max: 0.5, r: 1.5 });
                }
                shake(3, 0.18);
              }
            }
          }
        }
      }
    }
  }
  // Powerup pickup
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (Math.abs(p.x - pug.x) < 20 && Math.abs(p.y - pug.y) < 20) {
      powerups.splice(i, 1);
      if (p.type === 'jetpack') jetpackT = 5;
      else if (p.type === 'freeze') freezeT = 4;
      else if (p.type === 'shrink') shrinkT = 6;
      else if (p.type === 'wings') {
        wingsT = 6;
        pug.jumpsLeft = 3;
        pop(p.x, p.y - 10, 'WINGS!', '#fff7d0');
        shake(3, 0.18);
      }
      sfx.tone(1320, 'triangle', 0.12, 0.22);
    }
  }
  // Lava blobs
  for (let i = blobs.length - 1; i >= 0; i--) {
    const b = blobs[i];
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.y < -200) { blobs.splice(i, 1); continue; }
    if (Math.abs(b.x - pug.x) < 18 && Math.abs(b.y - pug.y) < 18) return die();
  }
  // ===== Doodle Jump-style flying enemies (height-gated spawns) =====
  // Above 500m: bats cross horizontally; can be jumped on (vy>0 stomp = kill
  // + bounce) or touched at any other angle = death. Above 1000m: fireballs
  // launch from the edges and traverse, instant-death on touch.
  if (height >= 500) {
    batSpawnT -= dt;
    if (batSpawnT <= 0) {
      // Spawn around 1.0..2.4s apart, scaling tighter with height.
      batSpawnT = Math.max(1.0, 3.5 - (height - 500) * 0.0015);
      const fromLeft = Math.random() < 0.5;
      const speed = 80 + Math.random() * 60 + Math.min(60, height * 0.04);
      bats.push({
        x: fromLeft ? -20 : W + 20,
        baseY: 40 + Math.random() * (H * 0.55),
        y: 0, // overwritten next tick
        vx: fromLeft ? speed : -speed,
        ampT: Math.random() * Math.PI * 2, alive: true,
      });
    }
  }
  if (height >= 1000) {
    fireSpawnT -= dt;
    if (fireSpawnT <= 0) {
      fireSpawnT = Math.max(0.8, 4.0 - (height - 1000) * 0.001);
      const fromLeft = Math.random() < 0.5;
      const spd = 220 + Math.random() * 100 + Math.min(120, (height - 1000) * 0.06);
      // Fireballs arc slightly toward pug — small vertical drift only so they
      // remain readable as horizontal threats.
      const vy = (Math.random() - 0.5) * 40;
      fireballs.push({
        x: fromLeft ? -16 : W + 16,
        y: 40 + Math.random() * (H * 0.45),
        vx: fromLeft ? spd : -spd, vy,
        life: 0, max: 8, r: 9 + Math.random() * 3,
      });
    }
  }
  // Bat movement + stomp/kill resolution
  for (let i = bats.length - 1; i >= 0; i--) {
    const b = bats[i];
    if (!b.alive) {
      // Dying bats fall — keep them around briefly for a satisfying squash.
      b.y += 240 * dt;
      b.ampT += dt * 6;
      if (b.y > H + 30) bats.splice(i, 1);
      continue;
    }
    b.x += b.vx * dt;
    b.ampT += dt * 3;
    b.y = b.baseY + Math.sin(b.ampT) * 14;
    if (b.x < -40 || b.x > W + 40) { bats.splice(i, 1); continue; }
    if (Math.abs(b.x - pug.x) < 22 && Math.abs(b.y - pug.y) < 22) {
      // Stomp = pug falling onto bat from above (vy>0 and pug center above bat center)
      if (pug.vy > 50 && pug.y < b.y - 4) {
        b.alive = false;
        pug.vy = JUMP_V * 0.85;
        refillJumps();
        comboJumps++; // stomp counts as a combo jump
        comboRestT = 0;
        score += 75;
        pop(b.x, b.y - 10, '+75 STOMP', '#ff8e3c');
        shake(3, 0.18);
        sfx.tone(880, 'triangle', 0.08, 0.2);
      } else {
        return die();
      }
    }
  }
  // Fireballs traverse + check collisions
  for (let i = fireballs.length - 1; i >= 0; i--) {
    const f = fireballs[i];
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.life += dt;
    if (f.life >= f.max || f.x < -30 || f.x > W + 30) { fireballs.splice(i, 1); continue; }
    if (Math.abs(f.x - pug.x) < 18 && Math.abs(f.y - pug.y) < 18) return die();
  }

  // Lava rises — accelerating (paused if freeze powerup active)
  height = Math.max(height, Math.floor((H - 200 - pug.y) / 10));
  maxHeight = Math.max(maxHeight, height);
  // Combo decay: standing on the same platform >0.7s resets the chain.
  if (pug.onGround) {
    comboRestT += dt;
    if (comboRestT > 0.7 && comboJumps > 0) {
      comboJumps = 0; lastPlat = null; comboRestT = 0;
    }
  } else {
    comboRestT = 0;
  }
  // Geometry Dash biome-shift checkpoints (every 500m, 2s transition)
  if (height >= nextBiomeAtHeight && biomeShiftT <= 0 && biomeIdx < BIOMES.length - 1) {
    biomeShiftTarget = biomeIdx + 1;
    biomeShiftT = 2;
    banner = { text: `★ ${BIOMES[biomeShiftTarget].name} ★`, life: 0, max: 1.8 };
    sfx.arp([220, 330, 440, 660], 'sawtooth', 0.08, 0.25, 0.18);
    shake(5, 0.4);
  }
  if (biomeShiftT > 0) {
    biomeShiftT -= dt;
    if (biomeShiftT <= 0) {
      biomeIdx = biomeShiftTarget;
      biomeShiftT = 0;
      nextBiomeAtHeight += 500;
    }
  }
  const lavaSpeed = (freezeT > 0 ? 0 : 50 + height * 0.4);
  lavaY -= lavaSpeed * dt;
  // Camera: when pug is above middle, scroll world down
  if (pug.y < H * 0.4) {
    const dy = H * 0.4 - pug.y;
    pug.y += dy;
    lavaY += dy;
    for (const p of plats) p.y += dy;
    for (const t of treats) t.y += dy;
    for (const pw of powerups) pw.y += dy;
    for (const s of caveSpikes) s.y += dy;
    for (const b of strataBands) b.y += dy;
    lastPlatY += dy;
    // Seed new cave decor as we scroll up
    if (caveSpikes.length && caveSpikes[caveSpikes.length - 1].y > -200) seedCaveSpikes(caveSpikes[caveSpikes.length - 1].y - 120);
    // New strata bands
    while (strataBands.length === 0 || strataBands[strataBands.length - 1].y > -200) {
      const lastY = strataBands.length ? strataBands[strataBands.length - 1].y : H;
      strataBands.push({ y: lastY - 200, color: `rgba(${40 + Math.floor(Math.random()*20)},${20 + Math.floor(Math.random()*15)},${20},${0.08 + Math.random() * 0.06})` });
    }
  }
  // Recycle platforms above viewport
  while (lastPlatY > -200) addPlatformAbove();
  for (let i = plats.length - 1; i >= 0; i--) if (plats[i].y > H + 100) plats.splice(i, 1);
  for (let i = treats.length - 1; i >= 0; i--) if (treats[i].y > H + 100) treats.splice(i, 1);
  for (let i = powerups.length - 1; i >= 0; i--) if (powerups[i].y > H + 100) powerups.splice(i, 1);
  for (let i = caveSpikes.length - 1; i >= 0; i--) if (caveSpikes[i].y > H + 100) caveSpikes.splice(i, 1);
  for (let i = strataBands.length - 1; i >= 0; i--) if (strataBands[i].y > H + 100) strataBands.splice(i, 1);

  // Treats
  for (let i = treats.length - 1; i >= 0; i--) {
    const t = treats[i];
    if (Math.abs(t.x - pug.x) < 20 && Math.abs(t.y - pug.y) < 20) {
      treats.splice(i, 1);
      treatsGot++; score += 50;
      sfx.tone(1320, 'triangle', 0.08, 0.2);
      pop(t.x, t.y - 10, '+50', '#ffd23f');
    }
  }
  score = Math.max(score, height * 10 + treatsGot * 50);

  // Milestone banner every 5m
  if (height >= nextMilestone) {
    banner = { text: `${nextMilestone}m MILESTONE!`, life: 0, max: 1.8 };
    pop(W / 2, H * 0.4, `+${nextMilestone * 5}`, '#5ef38c');
    score += nextMilestone * 5;
    nextMilestone += 5;
    sfx.arp([523, 659, 784], 'triangle', 0.06, 0.18, 0.15);
    shake(3, 0.18);
  }

  // Spawn embers rising from lava (cap at ~150)
  if (embers.length < 150 && lavaY < H + 40) {
    const burst = freezeT > 0 ? 0 : 2;
    for (let i = 0; i < burst; i++) {
      embers.push({
        x: Math.random() * W,
        y: lavaY + Math.random() * 4,
        vx: (Math.random() - 0.5) * 30,
        vy: -40 - Math.random() * 60,
        life: 0, max: 1.6 + Math.random() * 1.2, r: 1 + Math.random() * 2,
      });
    }
  }
  for (let i = embers.length - 1; i >= 0; i--) {
    const e = embers[i];
    e.life += dt; e.x += e.vx * dt; e.y += e.vy * dt;
    e.vy += -20 * dt; // buoyancy
    if (e.life >= e.max || e.y < -20) embers.splice(i, 1);
  }
  // Spawn lava bubbles (cap at ~30)
  if (lavaBubbles.length < 30) {
    if (Math.random() < dt * 6) {
      lavaBubbles.push({
        x: Math.random() * W, y: lavaY + 2 + Math.random() * 8,
        r: 3 + Math.random() * 5, life: 0, max: 0.6 + Math.random() * 0.5,
      });
    }
  }
  for (let i = lavaBubbles.length - 1; i >= 0; i--) {
    const b = lavaBubbles[i];
    b.life += dt;
    if (b.life >= b.max) lavaBubbles.splice(i, 1);
  }
  // Popup floats
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.life += dt; p.y += p.vy * dt; p.vy += 30 * dt;
    if (p.life >= p.max) popups.splice(i, 1);
  }
  // Banner
  if (banner) { banner.life += dt; if (banner.life >= banner.max) banner = null; }
  // Shake/flash decay
  if (shakeT > 0) shakeT -= dt;
  if (hitFlashT > 0) hitFlashT -= dt;
  // Background parallax: scroll with platforms but slower
  caveOffset += 12 * dt;

  // Lava death
  if (pug.y + pug.h / 2 >= lavaY) { hitFlashT = 0.3; shake(8, 0.4); return die(); }
  // Fall too far below
  if (pug.y > H + 80) { hitFlashT = 0.3; shake(6, 0.35); return die(); }
  updateHud();
}

function render() {
  // Screen shake transform
  let sx = 0, sy = 0;
  if (shakeT > 0) {
    const k = Math.min(1, shakeT / 0.3);
    sx = (Math.random() - 0.5) * shakeMag * 2 * k;
    sy = (Math.random() - 0.5) * shakeMag * 2 * k;
  }
  ctx.save();
  ctx.translate(sx, sy);
  const biome = getBiomePalette();
  // Sky gradient (biome-tinted)
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, biome.sky0); grd.addColorStop(1, biome.sky1);
  ctx.fillStyle = grd; ctx.fillRect(-8, -8, W + 16, H + 16);
  // Distant pulsing red glow — palette-driven so it shifts with the biome.
  const glowPulse = 0.55 + 0.25 * Math.sin(performance.now() * 0.0008);
  const coreGrad = ctx.createRadialGradient(W / 2, H * 0.55, 40, W / 2, H * 0.55, Math.max(W, H) * 0.7);
  coreGrad.addColorStop(0, `rgba(${biome.glow},${0.25 * glowPulse})`);
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGrad; ctx.fillRect(0, 0, W, H);
  // Strata bands — decorative horizontal bands
  for (const sb of strataBands) {
    if (sb.y < -20 || sb.y > H + 20) continue;
    ctx.fillStyle = sb.color;
    ctx.fillRect(0, sb.y, W, 6);
  }
  // 20m level markers — when world altitude crosses a "20m line" draw small chip
  // Background parallax: distant cave walls (slow scroll, repeating)
  const parY = (caveOffset * 0.4) % 200;
  ctx.fillStyle = biome.rockA;
  for (let yy = -200; yy < H + 200; yy += 200) {
    for (let i = 0; i < 6; i++) {
      const cx = (i / 5) * W;
      const cy = yy + parY + (i % 2) * 80;
      ctx.beginPath();
      ctx.moveTo(cx - 60, cy);
      ctx.lineTo(cx - 30, cy - 40);
      ctx.lineTo(cx + 30, cy - 30);
      ctx.lineTo(cx + 60, cy);
      ctx.closePath(); ctx.fill();
    }
  }
  // Mining cart tracks (decorative) — rust rails on left wall, repeating
  const rk = (caveOffset * 1.0) % 90;
  for (let yy = -90; yy < H + 90; yy += 90) {
    const ty = yy + rk;
    ctx.fillStyle = 'rgba(120,60,30,0.5)';
    ctx.fillRect(2, ty, 4, 60); ctx.fillRect(W - 6, ty, 4, 60);
    ctx.fillStyle = 'rgba(180,90,40,0.4)';
    ctx.fillRect(2, ty + 14, 4, 1); ctx.fillRect(W - 6, ty + 14, 4, 1);
    // ties
    for (let cy = 0; cy < 60; cy += 14) {
      ctx.fillStyle = 'rgba(70,40,20,0.5)';
      ctx.fillRect(0, ty + cy, 8, 3); ctx.fillRect(W - 8, ty + cy, 8, 3);
    }
  }
  // Stalactites/stalagmites (cave spikes) — cone shapes hugging side walls
  for (const s of caveSpikes) {
    if (s.y < -30 || s.y > H + 30) continue;
    ctx.save();
    ctx.fillStyle = '#5a3a1c';
    ctx.beginPath();
    if (s.side === 'left') {
      // narrow cones pointing right
      if (s.orient === 'top') {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8);
      } else {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8);
      }
    } else {
      if (s.orient === 'top') {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8);
      } else {
        ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8);
      }
    }
    ctx.closePath(); ctx.fill();
    // darker shading
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    if (s.side === 'left') {
      if (s.orient === 'top') { ctx.moveTo(s.x, s.y + 4); ctx.lineTo(s.x + s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8); }
      else { ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x + s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8); }
    } else {
      if (s.orient === 'top') { ctx.moveTo(s.x, s.y + 4); ctx.lineTo(s.x - s.h, s.y + 3); ctx.lineTo(s.x, s.y + 8); }
      else { ctx.moveTo(s.x, s.y - 4); ctx.lineTo(s.x - s.h, s.y - 3); ctx.lineTo(s.x, s.y - 8); }
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // Mid parallax: closer rocks (faster)
  const parY2 = (caveOffset * 0.85) % 160;
  ctx.fillStyle = biome.rockB;
  for (let yy = -160; yy < H + 160; yy += 160) {
    for (let i = 0; i < 4; i++) {
      const cx = (i / 3) * W + 40;
      const cy = yy + parY2;
      ctx.fillRect(cx - 18, cy - 12, 36, 24);
      ctx.fillRect(cx - 22, cy + 8, 44, 6);
    }
  }
  // Glow embers (cheap, additive)
  ctx.globalCompositeOperation = 'lighter';
  for (const e of embers) {
    const a = 1 - e.life / e.max;
    ctx.fillStyle = `rgba(255,${140 + Math.floor(80 * a)},40,${a * 0.7})`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // Platforms (color by kind) with grain/moss
  for (const p of plats) {
    if (!p.alive) continue;
    const isCrumble = p.kind === 'crumble';
    const isBouncy = p.kind === 'bouncy';
    // crumble turns red after 0.5s of standing
    const crumbleAge = p.crumbleStartT ? (performance.now() - p.crumbleStartT) : 0;
    const crumbleRed = isCrumble && crumbleAge > 500;
    const color = crumbleRed ? '#a83830' : (isBouncy ? '#b055ff' : (isCrumble ? '#8a6a4a' : '#5a3a1c'));
    const topColor = crumbleRed ? '#d05050' : (isBouncy ? '#d59aff' : (isCrumble ? '#a68a6a' : '#7a5a3a'));
    const grassColor = isBouncy ? '#ff8aa8' : (isCrumble ? '#ff8e3c' : '#5ef38c');
    ctx.fillStyle = color; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = topColor; ctx.fillRect(p.x, p.y, p.w, 3);
    ctx.fillStyle = grassColor; ctx.fillRect(p.x, p.y - 3, p.w, 3);
    // SPIKE on top (kills on landing)
    if (p.hasSpike) {
      const sx = p.x + p.w / 2;
      ctx.fillStyle = '#cacad6';
      ctx.beginPath();
      ctx.moveTo(sx - 5, p.y - 3); ctx.lineTo(sx + 5, p.y - 3); ctx.lineTo(sx, p.y - 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a8a9a';
      ctx.beginPath();
      ctx.moveTo(sx, p.y - 3); ctx.lineTo(sx + 5, p.y - 3); ctx.lineTo(sx, p.y - 14);
      ctx.closePath(); ctx.fill();
      // base
      ctx.fillStyle = '#5a5a72';
      ctx.fillRect(sx - 6, p.y - 4, 12, 2);
    }
    // Hanging vines under platform
    if (p.vine && !isCrumble) {
      const vx = p.x + 12;
      const sway = Math.sin(performance.now() * 0.002 + p.x * 0.05) * 4;
      ctx.strokeStyle = '#3a8e4c'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, p.y + p.h);
      ctx.quadraticCurveTo(vx + sway, p.y + p.h + 14, vx + sway, p.y + p.h + 28);
      ctx.stroke();
      ctx.fillStyle = '#5ef38c';
      ctx.fillRect(vx + sway - 2, p.y + p.h + 26, 4, 4);
    }
    // Wood-grain texture (vertical streaks)
    if (!isBouncy) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      const seed = Math.floor(p.x * 13 + p.w * 7) % 11;
      for (let i = 0; i < Math.floor(p.w / 14); i++) {
        const gx = p.x + 4 + i * 14 + ((seed + i) % 4);
        ctx.fillRect(gx, p.y + 4, 1, p.h - 6);
      }
    }
    // Moss tufts on top of normal platforms
    if (!isBouncy && !isCrumble && p.w > 80) {
      ctx.fillStyle = '#3a8e4c';
      ctx.fillRect(p.x + 8, p.y - 4, 3, 1);
      ctx.fillRect(p.x + p.w - 14, p.y - 4, 3, 1);
    }
    // crumble indicator: cracks if started crumbling
    if (isCrumble && p.crumbleStartT) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x + 6, p.y + 4, 4, 2);
      ctx.fillRect(p.x + p.w - 14, p.y + 6, 4, 2);
      ctx.fillRect(p.x + p.w / 2 - 2, p.y + 3, 1, p.h - 4);
    }
  }
  // Powerups — jetpack uses pixel-art flame; freeze/shrink/wings use primitives.
  for (const p of powerups) {
    const colors = { jetpack: '#ff8e3c', freeze: '#4cc9f0', shrink: '#b055ff', wings: '#fff7d0' };
    ctx.shadowColor = colors[p.type]; ctx.shadowBlur = 12;
    ctx.fillStyle = colors[p.type]; ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
    ctx.shadowBlur = 0;
    if (p.type === 'jetpack') {
      drawIcon.flame(ctx, p.x, p.y, 16);
    } else if (p.type === 'freeze') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.x - 7, p.y - 1, 14, 2);
      ctx.fillRect(p.x - 1, p.y - 7, 2, 14);
      ctx.fillRect(p.x - 5, p.y - 5, 2, 2); ctx.fillRect(p.x + 3, p.y - 5, 2, 2);
      ctx.fillRect(p.x - 5, p.y + 3, 2, 2); ctx.fillRect(p.x + 3, p.y + 3, 2, 2);
    } else if (p.type === 'shrink') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y - 5); ctx.lineTo(p.x + 7, p.y - 5); ctx.lineTo(p.x, p.y + 7);
      ctx.closePath(); ctx.fill();
    } else if (p.type === 'wings') {
      // Pair of small wing shapes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(p.x - 1, p.y);
      ctx.quadraticCurveTo(p.x - 9, p.y - 6, p.x - 8, p.y + 3);
      ctx.quadraticCurveTo(p.x - 5, p.y + 1, p.x - 1, p.y + 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x + 1, p.y);
      ctx.quadraticCurveTo(p.x + 9, p.y - 6, p.x + 8, p.y + 3);
      ctx.quadraticCurveTo(p.x + 5, p.y + 1, p.x + 1, p.y + 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(p.x - 1, p.y - 1, 2, 4);
    }
  }
  // Lava blobs
  for (const b of blobs) {
    ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(b.x - 3, b.y - 3, 2, 2);
    ctx.fillRect(b.x + 1, b.y - 3, 2, 2);
  }
  // Bats — pixel-art shape (body + flapping wings). Dying bats roll over.
  for (const b of bats) {
    const flap = Math.sin(b.ampT * 4) * 6;
    ctx.save();
    ctx.translate(b.x, b.y);
    if (!b.alive) ctx.rotate(Math.PI); // upside-down on death
    // Wings
    ctx.fillStyle = '#3a1a4a';
    ctx.beginPath();
    ctx.moveTo(-3, 0); ctx.lineTo(-14, -2 - flap); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, 0); ctx.lineTo(14, -2 - flap); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
    // Body
    ctx.fillStyle = b.alive ? '#2a0a3a' : '#5a3a5a';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    // Glowing eyes
    if (b.alive) {
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(-3, -1, 2, 2); ctx.fillRect(1, -1, 2, 2);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillText('x', -2, 1); ctx.fillText('x', 2, 1);
    }
    // Tiny pointy ears
    ctx.fillStyle = b.alive ? '#2a0a3a' : '#5a3a5a';
    ctx.fillRect(-4, -7, 2, 3); ctx.fillRect(2, -7, 2, 3);
    ctx.restore();
  }
  // Fireballs — pulsing red/orange ball with trail
  for (const f of fireballs) {
    const t = performance.now() * 0.01;
    // Tail behind
    ctx.fillStyle = 'rgba(255,180,60,0.45)';
    for (let i = 1; i <= 4; i++) {
      const tx = f.x - (f.vx / 220) * i * 5;
      const ty = f.y - (f.vy / 220) * i * 5;
      ctx.beginPath(); ctx.arc(tx, ty, f.r - i * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // Core
    ctx.fillStyle = '#ff3a3a';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(f.x - 1, f.y - 1, f.r * 0.55, 0, Math.PI * 2); ctx.fill();
    // Flicker highlight
    ctx.fillStyle = '#fff';
    ctx.fillRect(f.x - 2, f.y - 3, 2, 2);
  }
  // Treats
  for (const t of treats) {
    ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(t.x - 6, t.y - 6, 12, 12);
    ctx.shadowBlur = 0;
  }
  // Lava: gradient body (biome-tinted)
  const lgrd = ctx.createLinearGradient(0, lavaY, 0, H);
  lgrd.addColorStop(0, biome.lava0); lgrd.addColorStop(0.3, biome.lava1); lgrd.addColorStop(1, biome.lava2);
  ctx.fillStyle = lgrd; ctx.fillRect(-8, lavaY, W + 16, H + 16 - lavaY);
  // Lava swirl streaks
  ctx.fillStyle = 'rgba(255,210,63,0.35)';
  const t = performance.now() / 600;
  for (let i = 0; i < 6; i++) {
    const wx = ((i * 137 + t * 30) % (W + 80)) - 40;
    const wy = lavaY + 14 + Math.sin(t + i) * 4 + i * 6;
    ctx.fillRect(wx, wy, 50, 2);
  }
  // Bubble pops (animated arc + crown)
  for (const bb of lavaBubbles) {
    const k = bb.life / bb.max;
    const r = bb.r * (k < 0.5 ? k * 2 : (1 - k) * 2);
    if (r < 0.5) continue;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(bb.x, bb.y - r * 0.3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(bb.x - r * 0.4, bb.y - r * 0.6, r * 0.4, r * 0.3);
  }
  ctx.fillStyle = biome.lava0;
  ctx.fillRect(-8, lavaY, W + 16, 4);
  // Surface wave bumps
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 14; i++) {
    const x = (i * 73 + performance.now() / 5) % W;
    ctx.beginPath(); ctx.arc(x, lavaY + 4 + Math.sin(t * 2 + i) * 2, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Pug — high-detail climber sprite (with hit-flash brightness overlay)
  if (hitFlashT > 0) {
    ctx.save(); ctx.filter = 'brightness(2.5)';
    drawPug(ctx, pug.x, pug.y, { size: 30 });
    ctx.filter = 'none'; ctx.restore();
  } else {
    drawPug(ctx, pug.x, pug.y, { size: 30 });
  }
  // Jump indicator (more dots if wings active)
  ctx.fillStyle = wingsT > 0 ? '#fff7d0' : '#5ef38c';
  for (let i = 0; i < pug.jumpsLeft; i++) ctx.fillRect(pug.x - 8 + i * 6, pug.y - 24, 4, 4);
  // Wings flap behind pug
  if (wingsT > 0) {
    const flap = Math.sin(performance.now() * 0.025) * 4;
    ctx.fillStyle = 'rgba(255,247,208,0.85)';
    ctx.beginPath();
    ctx.moveTo(pug.x - 10, pug.y); ctx.quadraticCurveTo(pug.x - 18, pug.y - 4 - flap, pug.x - 14, pug.y + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pug.x + 10, pug.y); ctx.quadraticCurveTo(pug.x + 18, pug.y - 4 - flap, pug.x + 14, pug.y + 6); ctx.closePath(); ctx.fill();
  }
  // Active powerup HUD chips (bottom-left). `iconDraw` is an optional pixel-art icon drawer.
  let py = H - 30;
  const chip = (label, t, color, iconDraw) => {
    if (t <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(12, py - 16, 130, 22);
    ctx.fillStyle = color;
    ctx.fillRect(12, py - 16, 130 * Math.min(1, t / 5), 4);
    if (iconDraw) iconDraw(22, py - 6);
    ctx.fillStyle = '#fff'; ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'left';
    ctx.fillText(`${label} ${t.toFixed(1)}s`, 32, py);
    py -= 26;
  };
  chip('JETPACK', jetpackT, '#ff8e3c', (cx, cy) => drawIcon.flame(ctx, cx, cy, 12));
  chip('FREEZE', freezeT, '#4cc9f0', (cx, cy) => {
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(cx - 5, cy - 1, 10, 2); ctx.fillRect(cx - 1, cy - 5, 2, 10);
  });
  chip('SHRINK', shrinkT, '#b055ff', (cx, cy) => {
    ctx.fillStyle = '#b055ff';
    ctx.beginPath(); ctx.moveTo(cx - 5, cy - 4); ctx.lineTo(cx + 5, cy - 4); ctx.lineTo(cx, cy + 5); ctx.closePath(); ctx.fill();
  });
  chip('WINGS', wingsT, '#fff7d0', (cx, cy) => {
    ctx.fillStyle = '#fff7d0';
    ctx.beginPath(); ctx.moveTo(cx - 1, cy); ctx.quadraticCurveTo(cx - 6, cy - 4, cx - 6, cy + 2); ctx.quadraticCurveTo(cx - 3, cy + 1, cx - 1, cy + 1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 1, cy); ctx.quadraticCurveTo(cx + 6, cy - 4, cx + 6, cy + 2); ctx.quadraticCurveTo(cx + 3, cy + 1, cx + 1, cy + 1); ctx.closePath(); ctx.fill();
  });
  // Combo HUD (top-center). Always visible once chain hits 2+, even before
  // crossing a threshold so the player understands a chain is building.
  if (comboJumps >= 2) {
    const cw = 150, ch = 26;
    const cx = W / 2 - cw / 2, cy = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = comboJumps >= 10 ? '#ff3aa1' : (comboJumps >= 5 ? '#ffd23f' : '#5ef38c');
    ctx.fillRect(cx, cy, cw, 3);
    ctx.fillStyle = '#fff';
    ctx.font = "10px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(`COMBO ×${comboJumps}`, W / 2, cy + 18);
  }
  // Biome tag (top-right small chip)
  {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W - 108, 36, 96, 18);
    ctx.fillStyle = biomeShiftT > 0 ? '#ff3a3a' : '#c8c8d8';
    ctx.font = "9px 'Press Start 2P', monospace"; ctx.textAlign = 'right';
    ctx.fillText(biome.name, W - 14, 49);
  }
  // Score popups
  ctx.textAlign = 'center';
  ctx.font = "12px 'Press Start 2P', monospace";
  for (const pp of popups) {
    const a = 1 - pp.life / pp.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#000'; ctx.fillText(pp.text, pp.x + 1, pp.y + 1);
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, pp.x, pp.y);
    ctx.globalAlpha = 1;
  }
  // Milestone banner
  if (banner) {
    const a = banner.life < 0.3 ? banner.life / 0.3 : (banner.life > banner.max - 0.4 ? (banner.max - banner.life) / 0.4 : 1);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(W / 2 - 180, H * 0.25 - 24, 360, 48);
    ctx.fillStyle = '#5ef38c';
    ctx.fillRect(W / 2 - 180, H * 0.25 - 24, 360, 3);
    ctx.fillRect(W / 2 - 180, H * 0.25 + 21, 360, 3);
    ctx.fillStyle = '#ffd23f';
    ctx.font = "18px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.fillText(banner.text, W / 2, H * 0.25 + 6);
    ctx.globalAlpha = 1;
  }
  // Hit flash overlay (red tint)
  if (hitFlashT > 0) {
    ctx.fillStyle = `rgba(255,58,58,${Math.min(0.6, hitFlashT * 2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function updateHud() {
  document.getElementById('hud-height').textContent = height + 'm';
  document.getElementById('hud-score').textContent = score;
  const best = loadBest('floor-lava');
  document.getElementById('hud-best').textContent = (best ? best.height : 0) + 'm';
}

function die() {
  running = false;
  sfx.sweep(440, 110, 'sawtooth', 0.6, 0.25);
  document.getElementById('end-height').textContent = maxHeight + 'm';
  document.getElementById('end-treats').textContent = treatsGot;
  const { isNewBest, current } = submitRun('floor-lava', { score: maxHeight * 10 + treatsGot * 50, height: maxHeight });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { height: maxHeight };
    bestEl.innerHTML = `Best: <b>${b.height}m</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  document.getElementById('overlay').hidden = true; document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('end-overlay').hidden = true; document.getElementById('end-overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  sfx.resume();
}
let lastT = performance.now();
(function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now; tick(dt); if (running) render();
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('A/D move · SPACE jump · avoid SPIKES on platforms · grab WINGS for triple-jump', 6500);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
