// ROCKET PUG ARENA — 4 bot pugs in giant kitchen, absurd weapons.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';
import { drawIcon } from '../../src/shared/icons.js';
import { drawPug } from '../../src/shared/pugSprite.js';
import { createMobileControls } from '../../src/shared/mobileControls.js';
import { showGradeCard } from '../../src/shared/gradeCard.js';
import { createKillFeed } from '../../src/shared/killFeed.js';
import { createSettingsMenu } from '../../src/shared/settingsMenu.js';
import { getShakeMul as _shakeMul } from '../../src/shared/screenShake.js';

// --- Custom weapon icons (drawn on canvas; size ~ 18px) -----------------------
// Library doesn't have sausage / toast / bubble, so we draw them inline here in
// the same pixel-art style as the shared icons (centered at x, y).
function drawSausage(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // bun-orange body
  ctx.fillStyle = '#ff8e3c';
  ctx.fillRect(-6 * s, -2 * s, 12 * s, 4 * s);
  ctx.fillRect(-7 * s, -1 * s,  1 * s, 2 * s);
  ctx.fillRect( 6 * s, -1 * s,  1 * s, 2 * s);
  // shading underside
  ctx.fillStyle = '#b35a1c';
  ctx.fillRect(-6 * s,  1 * s, 12 * s, 1 * s);
  // highlight
  ctx.fillStyle = '#ffcc88';
  ctx.fillRect(-5 * s, -2 * s, 4 * s, 1 * s);
  ctx.restore();
}
function drawToast(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // crust outline
  ctx.fillStyle = '#8a5a2c';
  ctx.fillRect(-6 * s, -7 * s, 12 * s, 14 * s);
  ctx.fillRect(-7 * s, -6 * s,  1 * s, 12 * s);
  ctx.fillRect( 6 * s, -6 * s,  1 * s, 12 * s);
  // bread interior
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-5 * s, -6 * s, 10 * s, 12 * s);
  // butter melt highlight
  ctx.fillStyle = '#fff1b0';
  ctx.fillRect(-3 * s, -4 * s, 4 * s, 2 * s);
  ctx.fillRect(-1 * s,  1 * s, 3 * s, 2 * s);
  ctx.restore();
}
function drawBubble(ctx, x, y, size) {
  const s = size / 16;
  ctx.save(); ctx.translate(x, y);
  // outer ring (cyan)
  ctx.strokeStyle = '#4cc9f0';
  ctx.lineWidth = Math.max(1, 1.4 * s);
  ctx.beginPath(); ctx.arc(0, 0, 6 * s, 0, Math.PI * 2); ctx.stroke();
  // inner sheen
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(-2 * s, -2 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const sfx = createSfx({ storageKey: 'rocket:muted' });
sfx.applyButton(document.getElementById('mute-btn'));
const _isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
createSettingsMenu({ gameId: 'rocket-pug', getControlsHelp: () => _isTouch
  ? 'LEFT JOYSTICK move · TAP-anywhere aim · FIRE / JETPACK buttons. Saved to your profile.'
  : 'WASD move · MOUSE aim · CLICK fire · SPACE jetpack burst. Saved to your profile.' });

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => {
  resize();
  // Only rebuild decorative crowd silhouettes (cheap, no gameplay impact).
  // Skip rebuilding stove/obstacles/puddles/pedestal mid-match — that would
  // randomize positions and reset the pedestal cooldown, breaking the run.
  if (crowd && crowd.length) buildCrowd();
}); resize();

const WEAPONS = [
  { id: 'tennis',   name: 'Tennis', drawIconFn: drawIcon.tennisBall, cooldown: 0.4, speed: 480, dmg: 14, color: '#5ef38c', shape: 'ball' },
  { id: 'sausage',  name: 'Sausage', drawIconFn: drawSausage, cooldown: 0.55, speed: 380, dmg: 22, color: '#ff8e3c', shape: 'sausage' },
  { id: 'toaster',  name: 'Toast', drawIconFn: drawToast, cooldown: 0.8, speed: 320, dmg: 30, color: '#ffd23f', shape: 'toast' },
  { id: 'bubble',   name: 'Bubble', drawIconFn: drawBubble, cooldown: 0.3, speed: 240, dmg: 8, color: '#4cc9f0', shape: 'bubble' },
];

let pug, bots, projectiles, particles, popups, sparks, kills, running;
let mouse = { x: 0, y: 0 };
let shakeT = 0, shakeAmp = 0;
let comboT = 0, comboN = 0, comboBannerT = 0;
let lastHitT = 0; // for player hit-flash
// PWNED freeze-frame: when set, tick() pauses physics/AI; render still runs and
// draws the giant PWNED banner over the victim with slight zoom-in.
let pwnedT = 0;     // seconds remaining of freeze (0.6 total)
let pwnedVictim = null; // pug ref — banner anchor + camera zoom center
let crowd = [];
let weaponPickups = []; // {x, y, weapon, t, bob}
let weaponSpawnT = 0;   // seconds until next spawn
// --- Map decor & hazards (kitchen arena) ----------------------------------
let stove = null;       // central hazard {x, y, w, h, burners[]}
let obstacles = [];     // {x, y, w, h, kind, c1, c2}  blocks movement
let puddles = [];       // {x, y, r}  slip zones
let goalPosts = [];     // {x, y, side}  decorative arches
// --- Powerup pedestal -----------------------------------------------------
const BUFF_TYPES = ['shield', 'damage', 'speed'];
let pedestal = null;    // {x, y, ready, t, type}
let pedestalCd = 0;     // seconds until next ready
let activeBuffs = new Map(); // pug -> {type, t}
function shake(amp, dur) { const k = _shakeMul(); shakeAmp = Math.max(shakeAmp, amp * k); shakeT = Math.max(shakeT, dur); }
function popup(x, y, text, color) {
  if (popups.length > 32) popups.shift();
  popups.push({ x, y, vy: -40, text, color: color || '#ffd23f', life: 1.0, t: 0 });
}
function mkPug(x, y, isPlayer, color, mask) {
  return {
    x, y, vx: 0, vy: 0, hp: 100, maxHp: 100,
    isPlayer, color, mask, ang: 0,
    weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)],
    fireCd: 0,
    jetT: 0, jetCd: 0,
    targetAng: 0,
    hitFlashT: 0,
    slipT: 0, // when >0, controls reduced and velocity scaled
  };
}
// Build the central kitchen stove (large rectangle + 4 burners).
function buildStove() {
  const w = 130, h = 90;
  stove = {
    x: W / 2 - w / 2, y: H / 2 - h / 2, w, h,
    burners: [
      { dx: 28,    dy: 24, phase: Math.random() * Math.PI * 2 },
      { dx: w-28,  dy: 24, phase: Math.random() * Math.PI * 2 },
      { dx: 28,    dy: h-24, phase: Math.random() * Math.PI * 2 },
      { dx: w-28,  dy: h-24, phase: Math.random() * Math.PI * 2 },
    ],
  };
}
// 6 fixed kitchen prop obstacles. Sized ~50x40. Placed away from stove + spawn.
function buildObstacles() {
  obstacles = [];
  const stoveCx = W / 2, stoveCy = H / 2;
  const props = [
    { kind: 'fridge',   c1: '#cacad6', c2: '#8a8a9a' },
    { kind: 'microwave',c1: '#2a2a3a', c2: '#4cc9f0' },
    { kind: 'sink',     c1: '#9ec8d8', c2: '#4a7080' },
    { kind: 'trash',    c1: '#3a5a3a', c2: '#2a4a2a' },
    { kind: 'table',    c1: '#8a5a2c', c2: '#5a3a1c' },
    { kind: 'icecream', c1: '#ff8ec7', c2: '#c8589a' },
  ];
  // Six anchor positions relative to screen
  const anchors = [
    { ax: 0.18, ay: 0.22 },
    { ax: 0.82, ay: 0.22 },
    { ax: 0.18, ay: 0.78 },
    { ax: 0.82, ay: 0.78 },
    { ax: 0.50, ay: 0.18 },
    { ax: 0.50, ay: 0.82 },
  ];
  for (let i = 0; i < props.length; i++) {
    const a = anchors[i];
    const w = 50, h = 40;
    const x = a.ax * W - w / 2;
    const y = a.ay * H - h / 2;
    // Skip if too close to stove center
    if (Math.hypot((x + w/2) - stoveCx, (y + h/2) - stoveCy) < 110) continue;
    obstacles.push({ x, y, w, h, ...props[i] });
  }
}
function buildPuddles() {
  puddles = [];
  for (let i = 0; i < 4; i++) {
    let tries = 0;
    while (tries++ < 20) {
      const x = 90 + Math.random() * (W - 180);
      const y = 90 + Math.random() * (H - 180);
      // avoid stove + obstacles
      if (Math.hypot(x - W/2, y - H/2) < 100) continue;
      let ok = true;
      for (const o of obstacles) {
        if (x > o.x - 30 && x < o.x + o.w + 30 && y > o.y - 30 && y < o.y + o.h + 30) { ok = false; break; }
      }
      if (ok) { puddles.push({ x, y, r: 22 + Math.random() * 10, phase: Math.random() * Math.PI * 2 }); break; }
    }
  }
}
function buildGoalPosts() {
  // 4 corner arches (decorative landmarks)
  goalPosts = [
    { x: 60,       y: 60,     side: 'tl' },
    { x: W - 60,   y: 60,     side: 'tr' },
    { x: 60,       y: H - 60, side: 'bl' },
    { x: W - 60,   y: H - 60, side: 'br' },
  ];
}
function buildPedestal() {
  pedestal = { x: W / 2, y: H / 2, ready: false, t: 0, type: BUFF_TYPES[0] };
  pedestalCd = 8;
}
// Rect-circle resolve for obstacles (simple AABB-vs-pug)
function resolveObstacles(p) {
  const pr = 18;
  for (const o of obstacles) {
    const cx = Math.max(o.x, Math.min(p.x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(p.y, o.y + o.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < pr * pr) {
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d, ny = dy / d;
      const push = pr - d;
      p.x += nx * push; p.y += ny * push;
      // dampen velocity into wall
      const dot = p.vx * nx + p.vy * ny;
      if (dot < 0) { p.vx -= nx * dot; p.vy -= ny * dot; }
    }
  }
}
function buffMod(p, key) {
  const b = activeBuffs.get(p); if (!b) return 1;
  if (b.type === 'shield' && key === 'damage_in') return 0.5;
  if (b.type === 'damage' && key === 'damage_out') return 1.5;
  if (b.type === 'speed' && key === 'speed') return 1.4;
  return 1;
}
function buildCrowd() {
  crowd = [];
  // Top + bottom rows of silhouettes outside the stadium walls
  const STEP = 14;
  for (let x = 12; x < W; x += STEP) {
    crowd.push({ x, y: 14, base: 14, phase: Math.random() * Math.PI * 2, c: ['#3a2a5a','#4a3a6a','#5a3a4a','#2a3a5a'][Math.floor(Math.random()*4)], waveT: 0 });
    crowd.push({ x, y: H - 14, base: H - 14, phase: Math.random() * Math.PI * 2, c: ['#3a2a5a','#4a3a6a','#5a3a4a','#2a3a5a'][Math.floor(Math.random()*4)], waveT: 0 });
  }
}
function crowdCheer() {
  // Triggered on kills — sweep wave across the stands
  for (const c of crowd) c.waveT = 0.5 + Math.random() * 0.2;
}
// Scrolling kill feed (top-right) — pushed on each elimination.
const __rocketFeed = createKillFeed({ maxLines: 5, lifespan: 5000 });
function pushKillFeed(killer, victim) {
  const isPlayer = killer === pug;
  const isDeath = victim === pug;
  const color = isPlayer ? '#5ef38c' : isDeath ? '#ff3a3a' : '#c8c0e8';
  const k = isPlayer ? 'YOU' : (killer && killer.color) ? 'BOT' : 'THE ARENA';
  const v = isDeath ? 'YOU' : 'BOT';
  __rocketFeed.push(`${k} ▶ ${v}`, color);
}
function reset() {
  pug = mkPug(W / 2, H - 100, true, '#c8854a', '#1a0d05');
  pug.weapon = WEAPONS[0]; // start with tennis
  bots = [];
  const colors = [['#eac888','#6b3a1c'], ['#5a5a72','#222'], ['#fafaff','#a8a8c8'], ['#ff5a3a','#6a2a14']];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const r = Math.min(W, H) * 0.3;
    const c = colors[i];
    bots.push(mkPug(W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r, false, c[0], c[1]));
  }
  projectiles = []; particles = []; popups = []; sparks = []; kills = 0;
  comboT = 0; comboN = 0; comboBannerT = 0;
  shakeT = 0; shakeAmp = 0;
  weaponPickups = []; weaponSpawnT = 6; // first pickup after 6s
  mouse = { x: W / 2, y: H / 2 };
  activeBuffs = new Map();
  // Reset PWNED freeze so a fresh match doesn't inherit a stuck freeze if the
  // previous match ended while the cam was still up.
  pwnedT = 0; pwnedVictim = null;
  lastHitT = 0;
  buildCrowd();
  buildStove();
  buildObstacles();
  buildPuddles();
  buildGoalPosts();
  buildPedestal();
}
function spawnWeaponPickup() {
  // Pick a random non-current weapon for variety
  const candidates = WEAPONS.filter((w) => !pug || w.id !== pug.weapon.id);
  const w = candidates[Math.floor(Math.random() * candidates.length)] || WEAPONS[0];
  // Spawn at a random arena spot away from any pug
  for (let tries = 0; tries < 30; tries++) {
    const x = 80 + Math.random() * (W - 160);
    const y = 80 + Math.random() * (H - 160);
    let ok = true;
    for (const p of [pug, ...bots]) {
      if (!p) continue;
      if (Math.hypot(p.x - x, p.y - y) < 90) { ok = false; break; }
    }
    if (ok) { weaponPickups.push({ x, y, weapon: w, t: 0, bob: Math.random() * Math.PI * 2 }); return; }
  }
}

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' && !e.repeat) doJet();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
let firing = false;
canvas.addEventListener('mousedown', () => firing = true);
window.addEventListener('mouseup', () => firing = false);
canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; firing = true; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => firing = false);
document.getElementById('jet-btn').addEventListener('click', doJet);
if ('ontouchstart' in window) document.getElementById('jet-btn').style.display = 'block';
// Universal mobile controls — aim-fire layout. Joystick moves, drag-anywhere
// forwards mousemove to the canvas (so existing `firing`/`mouse` logic reads
// from canvas-relative mouse events). FIRE button triggers held-mouse-down.
createMobileControls({
  layout: 'aim-fire',
  keys,
  buttons: [
    { id: 'jet',    label: 'JET',    key: 'Space' },
  ],
  getCanvas: () => canvas,
  onFire: (down) => { firing = down; },
});

function doJet() {
  if (!running || pug.jetCd > 0) return;
  pug.jetT = 1.6;
  pug.jetCd = 5;
  sfx.tone(880, 'square', 0.3, 0.22);
}

function fire(shooter, ang) {
  if (shooter.fireCd > 0) return;
  shooter.fireCd = shooter.weapon.cooldown;
  const w = shooter.weapon;
  projectiles.push({
    x: shooter.x + Math.cos(ang) * 22, y: shooter.y + Math.sin(ang) * 22,
    vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
    owner: shooter, dmg: w.dmg, color: w.color, shape: w.shape, life: 2.0, ang,
  });
  sfx.tone(380 + Math.random() * 100, w.shape === 'bubble' ? 'sine' : 'square', 0.06, 0.18);
}

function tick(dt) {
  if (!running) return;
  // PWNED freeze: pause world for 0.6s after a kill (Rocket League goal cam).
  // Only the freeze timer + render flow advance during this window.
  if (pwnedT > 0) {
    pwnedT = Math.max(0, pwnedT - dt);
    if (pwnedT === 0) pwnedVictim = null;
    return;
  }
  // Weapon pickups — periodic spawn + collision check
  weaponSpawnT -= dt;
  if (weaponSpawnT <= 0 && weaponPickups.length < 2) {
    spawnWeaponPickup();
    weaponSpawnT = 9 + Math.random() * 4; // every 9-13s
  }
  for (let i = weaponPickups.length - 1; i >= 0; i--) {
    const wp = weaponPickups[i];
    wp.t += dt; wp.bob += dt * 3;
    // Player pickup
    if (pug.hp > 0 && Math.hypot(pug.x - wp.x, pug.y - wp.y) < 28) {
      pug.weapon = wp.weapon;
      popup(pug.x, pug.y - 20, wp.weapon.name.toUpperCase() + '!', wp.weapon.color);
      sfx.tone(880, 'triangle', 0.1, 0.25);
      sfx.tone(1320, 'triangle', 0.1, 0.18);
      weaponPickups.splice(i, 1);
      continue;
    }
    // Bot pickup
    for (const b of bots) {
      if (b.hp <= 0) continue;
      if (Math.hypot(b.x - wp.x, b.y - wp.y) < 26) {
        b.weapon = wp.weapon;
        weaponPickups.splice(i, 1);
        break;
      }
    }
  }
  // Player movement (controls disabled while slipping)
  let mx = 0, my = 0;
  if (pug.slipT <= 0) {
    if (keys.has('w')) my -= 1;
    if (keys.has('s')) my += 1;
    if (keys.has('a')) mx -= 1;
    if (keys.has('d')) mx += 1;
  }
  if (mx || my) {
    const l = Math.hypot(mx, my);
    const sp = (pug.jetT > 0 ? 480 : 220) * buffMod(pug, 'speed');
    pug.vx += (mx / l) * sp * dt * 3;
    pug.vy += (my / l) * sp * dt * 3;
  }
  pug.jetT = Math.max(0, pug.jetT - dt);
  pug.jetCd = Math.max(0, pug.jetCd - dt);
  pug.fireCd = Math.max(0, pug.fireCd - dt);
  // Aim
  pug.ang = Math.atan2(mouse.y - pug.y, mouse.x - pug.x);
  if (firing) fire(pug, pug.ang);

  // Bots AI
  for (const b of bots) {
    if (b.hp <= 0) continue;
    b.fireCd = Math.max(0, b.fireCd - dt);
    // pick nearest enemy (player or other bot)
    const all = [pug, ...bots.filter((x) => x !== b)];
    let target = null, bestD = Infinity;
    for (const o of all) {
      if (o.hp <= 0) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < bestD) { bestD = d; target = o; }
    }
    if (target) {
      const tx = target.x, ty = target.y;
      const angTo = Math.atan2(ty - b.y, tx - b.x);
      b.ang = angTo;
      if (bestD > 200) {
        b.vx += Math.cos(angTo) * 800 * dt;
        b.vy += Math.sin(angTo) * 800 * dt;
      } else if (bestD < 100) {
        b.vx -= Math.cos(angTo) * 700 * dt;
        b.vy -= Math.sin(angTo) * 700 * dt;
      } else {
        // strafe
        b.vx += Math.cos(angTo + Math.PI / 2) * 500 * dt;
        b.vy += Math.sin(angTo + Math.PI / 2) * 500 * dt;
      }
      fire(b, angTo);
    }
  }
  // Physics
  for (const p of [pug, ...bots]) {
    if (p.hp <= 0) continue;
    // Slip on puddles — boost velocity and freeze input briefly on entry
    for (const pud of puddles) {
      if (Math.hypot(p.x - pud.x, p.y - pud.y) < pud.r) {
        if (p.slipT <= 0) {
          p.slipT = 0.5;
          p.vx *= 2; p.vy *= 2;
          if (p === pug) popup(p.x, p.y - 26, 'SLIP!', '#4cc9f0');
        }
        break;
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    // Friction (less when slipping — keeps the slide alive)
    const fric = p.slipT > 0 ? 1.5 : 4;
    p.vx *= Math.pow(0.5, dt * fric); p.vy *= Math.pow(0.5, dt * fric);
    p.x = Math.max(30, Math.min(W - 30, p.x));
    p.y = Math.max(30, Math.min(H - 30, p.y));
    // Obstacle collision
    resolveObstacles(p);
    // Stove hazard — flames damage anyone within 26px of any burner
    if (stove) {
      for (const b of stove.burners) {
        const bx = stove.x + b.dx, by = stove.y + b.dy;
        if (Math.hypot(p.x - bx, p.y - by) < 26) {
          const dmg = 8 * dt * buffMod(p, 'damage_in');
          p.hp -= dmg;
          if (p === pug) { lastHitT = Math.max(lastHitT, 0.15); }
          // periodic popup so it doesn't spam
          if (Math.random() < dt * 1.5) popup(p.x, p.y - 24, 'FIRE!', '#ff5a3a');
          if (p.hp > 0 && Math.random() < dt * 8 && particles.length < 200) {
            const ang = Math.random() * Math.PI * 2;
            particles.push({ x: p.x, y: p.y, vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40 - 30, color: '#ff8e3c', life: 0.4, t: 0, size: 3 });
          }
          break;
        }
      }
    }
    p.slipT = Math.max(0, p.slipT - dt);
  }
  // Decay buffs
  for (const [p, b] of activeBuffs) {
    b.t -= dt;
    if (b.t <= 0 || p.hp <= 0) activeBuffs.delete(p);
  }
  // Pedestal — refill timer, then ready; first pug to enter claims buff
  if (pedestal) {
    if (!pedestal.ready) {
      pedestalCd -= dt;
      if (pedestalCd <= 0) {
        pedestal.ready = true; pedestal.t = 0;
        pedestal.type = BUFF_TYPES[Math.floor(Math.random() * BUFF_TYPES.length)];
        sfx.tone(740, 'triangle', 0.12, 0.20);
        if (pug && pug.hp > 0) popup(pedestal.x, pedestal.y - 60, 'PEDESTAL READY', '#fff');
      }
    } else {
      pedestal.t += dt;
      for (const p of [pug, ...bots]) {
        if (p.hp <= 0) continue;
        if (Math.hypot(p.x - pedestal.x, p.y - pedestal.y) < 26) {
          activeBuffs.set(p, { type: pedestal.type, t: 12 });
          const tname = pedestal.type === 'shield' ? 'SHIELD' : pedestal.type === 'damage' ? 'DMG BOOST' : 'SPEED';
          const tcol = pedestal.type === 'shield' ? '#4cc9f0' : pedestal.type === 'damage' ? '#ff5a3a' : '#ffd23f';
          popup(p.x, p.y - 28, tname + '!', tcol);
          sfx.tone(1100, 'triangle', 0.15, 0.25);
          shake(3, 0.15);
          pedestal.ready = false;
          pedestalCd = 18;
          break;
        }
      }
    }
  }
  // Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    // Wall sparks if it flew offscreen
    if (pr.x < 8 || pr.x > W - 8 || pr.y < 8 || pr.y > H - 8) {
      spawnSpark(Math.max(4, Math.min(W - 4, pr.x)), Math.max(4, Math.min(H - 4, pr.y)));
    }
    if (pr.life <= 0 || pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) { projectiles.splice(i, 1); continue; }
    // Hit check
    for (const target of [pug, ...bots]) {
      if (target === pr.owner || target.hp <= 0) continue;
      const d = Math.hypot(target.x - pr.x, target.y - pr.y);
      if (d < 22) {
        const outMul = pr.owner ? buffMod(pr.owner, 'damage_out') : 1;
        const inMul = buffMod(target, 'damage_in');
        const finalDmg = pr.dmg * outMul * inMul;
        target.hp -= finalDmg;
        target.hitFlashT = 0.18;
        // SMASH-BROS knockback: scales with (1 - hp%) so low-HP pugs ragdoll
        // far, full-HP barely flinch. Direction = projectile travel direction
        // (so a back-shot launches them away from the shooter).
        {
          const hpPct = Math.max(0, target.hp) / target.maxHp;
          const intensity = 1 - hpPct;           // 0 at full HP, ~1 near death
          const baseKick = 60 + finalDmg * 6;    // baseline pop
          const kick = baseKick + intensity * intensity * 720; // quadratic ramp
          const vlen = Math.hypot(pr.vx, pr.vy) || 1;
          const nx = pr.vx / vlen, ny = pr.vy / vlen;
          target.vx += nx * kick;
          target.vy += ny * kick;
          // Low-HP targets briefly lose footing for visual "ragdoll" feel.
          if (intensity > 0.5) target.slipT = Math.max(target.slipT, 0.35);
        }
        spawnHit(pr.x, pr.y, pr.color);
        sfx.tone(220, 'square', 0.05, 0.18);
        if (target === pug) { lastHitT = 0.25; shake(4, 0.18); }
        if (target.hp <= 0) {
          if (pr.owner === pug && target !== pug) {
            kills++;
            // combo
            if (comboT > 0) comboN++; else comboN = 1;
            comboT = 3.0;
            if (comboN >= 2) comboBannerT = 1.4;
            popup(target.x, target.y - 30, '+25', '#5ef38c');
            shake(8, 0.28);
          } else {
            shake(5, 0.18);
          }
          try { pushKillFeed(pr.owner, target); } catch (e) { /* */ }
          crowdCheer();
          spawnDeath(target.x, target.y, target.color);
          sfx.sweep(440, 110, 'sawtooth', 0.25, 0.22);
          // ROCKET-LEAGUE freeze frame: 0.6s freeze + giant PWNED + slow zoom
          // over the victim. Skip if the player is the victim (death already
          // shows end overlay; freeze would feel like a hang on game-over).
          if (target !== pug) {
            pwnedT = 0.6;
            pwnedVictim = target;
            sfx.tone(880, 'square', 0.12, 0.3);
          }
        }
        projectiles.splice(i, 1);
        break;
      }
    }
  }
  // particle cap (oldest first)
  if (particles.length > 220) particles.splice(0, particles.length - 220);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.t >= p.life) particles.splice(i, 1);
  }
  // sparks
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    s.vx *= 0.86; s.vy *= 0.86;
    if (s.t >= s.life) sparks.splice(i, 1);
  }
  // popups
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt; p.y += p.vy * dt; p.vy *= 0.9;
    if (p.t >= p.life) popups.splice(i, 1);
  }
  // timers
  shakeT = Math.max(0, shakeT - dt); if (shakeT === 0) shakeAmp = 0;
  comboT = Math.max(0, comboT - dt); if (comboT === 0) comboN = 0;
  comboBannerT = Math.max(0, comboBannerT - dt);
  lastHitT = Math.max(0, lastHitT - dt);
  for (const p of [pug, ...bots]) p.hitFlashT = Math.max(0, p.hitFlashT - dt);
  // crowd ambient sway uses real-time, no state to update

  // End check
  if (pug.hp <= 0) return end(false);
  if (bots.every((b) => b.hp <= 0)) return end(true);
  updateHud();
}

function spawnHit(x, y, color) {
  for (let i = 0; i < 6; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 100;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color, life: 0.3, t: 0, size: 3 });
  }
}
function spawnDeath(x, y, color) {
  for (let i = 0; i < 16; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 200;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color, life: 0.8, t: 0, size: 4 });
  }
}
function spawnSpark(x, y) {
  if (sparks.length > 60) return;
  for (let i = 0; i < 4; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 100 + Math.random() * 160;
    sparks.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.25, t: 0 });
  }
}
function spawnJet(x, y) {
  if (particles.length > 200) return;
  for (let i = 0; i < 2; i++) {
    const ang = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const sp = 120 + Math.random() * 120;
    const cols = ['#ffd23f', '#ff8e3c', '#ff5a3a'];
    particles.push({
      x: x + (Math.random() - 0.5) * 6, y: y + 14,
      vx: Math.cos(ang) * sp * 0.4, vy: Math.sin(ang) * sp,
      color: cols[Math.floor(Math.random() * cols.length)],
      life: 0.35, t: 0, size: 3 + Math.random() * 3,
    });
  }
}

function render() {
  // screen-shake offset
  const sx = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  const sy = shakeAmp > 0 ? (Math.random() - 0.5) * shakeAmp * 2 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  // PWNED slow zoom — ramps from 1.0 → 1.18 over the 0.6s freeze, centered
  // on victim. Applied as scale+translate inside the existing shake save block
  // so the matching ctx.restore() at the bottom of render() unwinds both.
  if (pwnedT > 0 && pwnedVictim) {
    const k = 1 - (pwnedT / 0.6);             // 0 → 1
    const zoom = 1 + 0.18 * k;
    const vx = pwnedVictim.x, vy = pwnedVictim.y;
    ctx.translate(vx, vy);
    ctx.scale(zoom, zoom);
    ctx.translate(-vx, -vy);
  }

  // Stadium floor: warm tone with a parking-lot/stadium grid
  ctx.fillStyle = '#5a3a1c'; ctx.fillRect(-12, -12, W + 24, H + 24);
  // big tile alternation
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  for (let y = 0; y < H; y += 48) for (let x = 0; x < W; x += 48)
    if ((x + y) % 96 === 0) ctx.fillRect(x, y, 48, 48);
  // grid lines (parking-lot feel)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 48) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 48) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  // center circle (stadium midfield)
  ctx.strokeStyle = 'rgba(255,210,63,0.15)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 6); ctx.lineTo(W / 2, H / 2 + 6); ctx.moveTo(W / 2 - 6, H / 2); ctx.lineTo(W / 2 + 6, H / 2); ctx.stroke();
  // Water puddles (drawn under everything else so pugs slide on top)
  for (const pud of puddles) {
    pud.phase += 0.01;
    ctx.save();
    ctx.fillStyle = 'rgba(76,201,240,0.35)';
    ctx.beginPath(); ctx.ellipse(pud.x, pud.y, pud.r, pud.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,230,255,0.55)';
    ctx.beginPath(); ctx.ellipse(pud.x - pud.r * 0.3, pud.y - pud.r * 0.2, pud.r * 0.3, pud.r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    // ripple ring
    const rk = (Math.sin(pud.phase * 3) + 1) * 0.5;
    ctx.strokeStyle = `rgba(180,230,255,${0.4 - rk * 0.3})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(pud.x, pud.y, pud.r * (0.5 + rk * 0.4), pud.r * (0.35 + rk * 0.3), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // Goal posts at corners (red glowing arches)
  for (const g of goalPosts) {
    ctx.save();
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.004 + (g.x + g.y) * 0.01);
    ctx.shadowColor = '#ff3a3a';
    ctx.shadowBlur = 14 * pulse;
    ctx.strokeStyle = '#ff3a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(g.x, g.y, 22, Math.PI, 0); ctx.stroke();
    ctx.shadowBlur = 0;
    // posts
    ctx.fillStyle = '#ff3a3a';
    ctx.fillRect(g.x - 24, g.y, 4, 16);
    ctx.fillRect(g.x + 20, g.y, 4, 16);
    // net hint
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    for (let i = -20; i <= 20; i += 6) {
      ctx.beginPath(); ctx.moveTo(g.x + i, g.y); ctx.lineTo(g.x + i, g.y + 14); ctx.stroke();
    }
    ctx.restore();
  }
  // Kitchen obstacle props (block movement) — varied art per kind
  for (const o of obstacles) {
    ctx.save();
    // shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(o.x + 2, o.y + o.h - 2, o.w - 2, 4);
    ctx.fillStyle = o.c1;
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = o.c2;
    if (o.kind === 'fridge') {
      ctx.fillRect(o.x, o.y, o.w, 4); // top trim
      ctx.fillRect(o.x, o.y + o.h * 0.4, o.w, 3); // door split
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(o.x + o.w - 6, o.y + 8, 3, 8);
      ctx.fillRect(o.x + o.w - 6, o.y + o.h * 0.5, 3, 8);
    } else if (o.kind === 'microwave') {
      ctx.fillRect(o.x + 4, o.y + 6, o.w - 18, o.h - 14); // window
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(o.x + o.w - 10, o.y + 8, 4, 2); // power LED
      ctx.fillStyle = '#fff';
      ctx.fillRect(o.x + o.w - 10, o.y + 14, 6, 2); ctx.fillRect(o.x + o.w - 10, o.y + 18, 6, 2);
    } else if (o.kind === 'sink') {
      ctx.fillRect(o.x + 4, o.y + 6, o.w - 8, o.h - 14); // basin (darker)
      ctx.fillStyle = '#cacad6';
      ctx.fillRect(o.x + o.w / 2 - 4, o.y - 4, 8, 6); // faucet
      ctx.fillRect(o.x + o.w / 2 - 1, o.y - 6, 2, 4);
    } else if (o.kind === 'trash') {
      ctx.fillRect(o.x, o.y - 4, o.w, 4); // lid
      ctx.fillStyle = '#1a0d05';
      ctx.fillRect(o.x + 8, o.y + 8, 4, 4); // hole
      ctx.fillStyle = '#5ef38c';
      ctx.fillRect(o.x + 14, o.y + 10, 6, 6); // peeking apple
    } else if (o.kind === 'table') {
      ctx.fillRect(o.x, o.y, o.w, 6); // tabletop
      ctx.fillRect(o.x + 4, o.y + 6, 4, o.h - 6); // legs
      ctx.fillRect(o.x + o.w - 8, o.y + 6, 4, o.h - 6);
    } else if (o.kind === 'icecream') {
      ctx.fillRect(o.x + 4, o.y + 4, o.w - 8, 8); // sign
      ctx.fillStyle = '#fff';
      ctx.font = "6px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      ctx.fillText('ICE', o.x + o.w / 2, o.y + 10);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h - 8, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // CENTRAL STOVE — strong landmark with 4 flickering burners
  if (stove) {
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(stove.x + 4, stove.y + stove.h - 4, stove.w - 4, 6);
    // body
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(stove.x, stove.y, stove.w, stove.h);
    // chrome top trim
    ctx.fillStyle = '#cacad6';
    ctx.fillRect(stove.x, stove.y, stove.w, 5);
    ctx.fillRect(stove.x, stove.y + stove.h - 5, stove.w, 5);
    // control knobs (front)
    ctx.fillStyle = '#1a0d05';
    for (let i = 0; i < 4; i++) {
      const kx = stove.x + 16 + i * ((stove.w - 32) / 3);
      ctx.beginPath(); ctx.arc(kx, stove.y + stove.h - 10, 3, 0, Math.PI * 2); ctx.fill();
    }
    // 4 burners with flickering flame
    const tNow = performance.now() * 0.001;
    for (const b of stove.burners) {
      const bx = stove.x + b.dx, by = stove.y + b.dy;
      // burner pan
      ctx.fillStyle = '#1a0d05';
      ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a5a72'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI * 2); ctx.stroke();
      // flame glow
      const flick = 0.7 + 0.3 * Math.sin(tNow * 12 + b.phase);
      const grad = ctx.createRadialGradient(bx, by, 2, bx, by, 28);
      grad.addColorStop(0, `rgba(255,210,63,${0.9 * flick})`);
      grad.addColorStop(0.5, `rgba(255,90,58,${0.5 * flick})`);
      grad.addColorStop(1, 'rgba(255,90,58,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI * 2); ctx.fill();
      // flame tongues
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(bx - 4, by);
      ctx.lineTo(bx, by - 8 - flick * 6);
      ctx.lineTo(bx + 4, by);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff5a3a';
      ctx.beginPath();
      ctx.moveTo(bx - 2, by);
      ctx.lineTo(bx, by - 4 - flick * 3);
      ctx.lineTo(bx + 2, by);
      ctx.closePath(); ctx.fill();
    }
    // hazard ring
    ctx.strokeStyle = 'rgba(255,90,58,0.25)'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(stove.x - 4, stove.y - 4, stove.w + 8, stove.h + 8);
    ctx.setLineDash([]);
    ctx.restore();
  }
  // PEDESTAL — beam of light + glowing dais when ready
  if (pedestal) {
    ctx.save();
    const tNow = performance.now() * 0.001;
    // dais base
    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath(); ctx.ellipse(pedestal.x, pedestal.y + 6, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.ellipse(pedestal.x, pedestal.y + 2, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (pedestal.ready) {
      const col = pedestal.type === 'shield' ? '#4cc9f0' : pedestal.type === 'damage' ? '#ff5a3a' : '#ffd23f';
      // rotating beam (own save/restore so we don't break outer translate)
      ctx.save();
      ctx.translate(pedestal.x, pedestal.y);
      ctx.rotate(tNow * 1.8);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        const grad = ctx.createLinearGradient(0, 0, 0, -130);
        grad.addColorStop(0, col + 'cc');
        grad.addColorStop(1, col + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(4, -130); ctx.lineTo(-4, -130); ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
      // glowing orb on top
      const pulse = 0.7 + 0.3 * Math.sin(tNow * 6);
      ctx.shadowColor = col; ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(pedestal.x, pedestal.y - 4, 6 + pulse * 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // label
      ctx.fillStyle = '#fff'; ctx.font = "7px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
      const tname = pedestal.type === 'shield' ? 'SHIELD' : pedestal.type === 'damage' ? 'DAMAGE' : 'SPEED';
      ctx.fillText(tname, pedestal.x, pedestal.y + 22);
    } else {
      // recharging indicator (faint ring + countdown spot)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(pedestal.x, pedestal.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(pedestal.x - 1, pedestal.y - 8, 2, 2);
    }
    ctx.restore();
  }
  // Weapon pickups — glowing crate with floating weapon icon
  for (const wp of weaponPickups) {
    const bobY = wp.y + Math.sin(wp.bob) * 4;
    // ground glow
    const glow = ctx.createRadialGradient(wp.x, wp.y + 8, 4, wp.x, wp.y + 8, 38);
    glow.addColorStop(0, wp.weapon.color + 'cc');
    glow.addColorStop(1, wp.weapon.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(wp.x, wp.y + 8, 38, 0, Math.PI * 2); ctx.fill();
    // crate
    ctx.fillStyle = '#3a2a14';
    ctx.fillRect(wp.x - 14, wp.y - 4, 28, 18);
    ctx.fillStyle = wp.weapon.color;
    ctx.fillRect(wp.x - 14, wp.y - 4, 28, 2);
    ctx.fillRect(wp.x - 14, wp.y + 12, 28, 2);
    // floating icon
    if (wp.weapon.drawIconFn) wp.weapon.drawIconFn(ctx, wp.x, bobY - 12, 18);
    // label
    ctx.fillStyle = '#fff'; ctx.font = "8px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(wp.weapon.name.toUpperCase(), wp.x, wp.y + 26);
  }

  // Stadium walls (chrome rails) at edges
  ctx.fillStyle = '#1a0d05';
  ctx.fillRect(0, 0, W, 8); ctx.fillRect(0, H - 8, W, 8);
  ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, H - 8, W, 2);

  // Crowd silhouettes — waving heads (above/below the walls). waveT scales on kill.
  if (crowd.length) {
    const tNow = performance.now() * 0.001;
    for (const c of crowd) {
      const sway = Math.sin(tNow * 1.8 + c.phase) * 2;
      const scale = c.waveT > 0 ? 1.15 : 1;
      if (c.waveT > 0) c.waveT -= 1 / 60;
      ctx.fillStyle = c.c;
      ctx.beginPath();
      ctx.arc(c.x, c.base + sway - (scale - 1) * 4, 5 * scale, 0, Math.PI * 2); ctx.fill();
    }
  }

  // pugs
  for (const p of [pug, ...bots]) {
    if (p.hp <= 0) continue;
    // jetpack thruster particles (player only)
    if (p === pug && pug.jetT > 0) spawnJet(p.x, p.y);
    // buff aura
    const buff = activeBuffs.get(p);
    if (buff) {
      const col = buff.type === 'shield' ? '#4cc9f0' : buff.type === 'damage' ? '#ff5a3a' : '#ffd23f';
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.008);
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 14 * pulse;
      ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // body — high-detail sprite (hit flash via canvas filter)
    if (p.hitFlashT > 0) {
      ctx.save(); ctx.filter = `brightness(${1 + p.hitFlashT * 3})`;
      drawPug(ctx, p.x, p.y, { size: 36, body: p.color, mask: p.mask });
      ctx.filter = 'none'; ctx.restore();
    } else {
      drawPug(ctx, p.x, p.y, { size: 36, body: p.color, mask: p.mask });
    }
    // weapon (custom canvas icon, centered ~22px out along aim)
    if (p.weapon.drawIconFn) {
      p.weapon.drawIconFn(ctx, p.x + Math.cos(p.ang) * 22, p.y + Math.sin(p.ang) * 22, 18);
    }
    // hp bar
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 18, p.y - 28, 36, 4);
    ctx.fillStyle = p.hp > 50 ? '#5ef38c' : (p.hp > 25 ? '#ffd23f' : '#ff3a3a');
    ctx.fillRect(p.x - 18, p.y - 28, 36 * Math.max(0, p.hp) / p.maxHp, 4);
    // jetpack flame (bigger, glowy)
    if (p === pug && pug.jetT > 0) {
      ctx.fillStyle = '#ff8e3c';
      ctx.fillRect(p.x - 4, p.y + 16, 8, 14);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(p.x - 2, p.y + 16, 4, 8);
    }
  }
  // Projectiles
  for (const pr of projectiles) {
    if (pr.shape === 'ball') {
      ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
    } else if (pr.shape === 'sausage') {
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(pr.ang);
      ctx.fillStyle = pr.color; ctx.fillRect(-10, -3, 20, 6);
      ctx.restore();
    } else if (pr.shape === 'toast') {
      ctx.fillStyle = pr.color; ctx.fillRect(pr.x - 6, pr.y - 8, 12, 16);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(pr.x - 6, pr.y - 8, 12, 2);
      ctx.fillRect(pr.x - 6, pr.y + 6, 12, 2);
    } else if (pr.shape === 'bubble') {
      ctx.strokeStyle = pr.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,0.3)`;
      ctx.beginPath(); ctx.arc(pr.x - 3, pr.y - 3, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Sparks (wall hits)
  for (const s of sparks) {
    const a = 1 - s.t / s.life;
    ctx.strokeStyle = `rgba(255,210,63,${a})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.02, s.y - s.vy * 0.02); ctx.stroke();
  }
  // Particles
  for (const p of particles) {
    ctx.globalAlpha = 1 - (p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  // Score popups
  for (const p of popups) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color; ctx.font = "bold 14px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y);
    ctx.globalAlpha = 1;
  }
  // Aim line for player
  if (running && pug.hp > 0) {
    ctx.strokeStyle = 'rgba(255,210,63,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(pug.x, pug.y); ctx.lineTo(pug.x + Math.cos(pug.ang) * 200, pug.y + Math.sin(pug.ang) * 200); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Hit vignette when player just got hit
  if (lastHitT > 0) {
    const a = (lastHitT / 0.25) * 0.35;
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.7);
    grad.addColorStop(0, 'rgba(255,58,58,0)');
    grad.addColorStop(1, `rgba(255,58,58,${a})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  // Combo banner
  if (comboBannerT > 0 && comboN >= 2) {
    const a = Math.min(1, comboBannerT / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffd23f';
    ctx.font = "bold 22px 'Press Start 2P', monospace"; ctx.textAlign = 'center';
    ctx.fillText('x' + comboN + ' COMBO!', W / 2, 70);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // PWNED freeze-frame banner — screen-space, drawn after restore so the
  // big yellow text doesn't get scaled with the world zoom.
  if (pwnedT > 0 && pwnedVictim) {
    const k = 1 - (pwnedT / 0.6);
    // dim flash that punches the screen at the moment of kill
    ctx.fillStyle = `rgba(0,0,0,${0.35 - k * 0.25})`;
    ctx.fillRect(0, 0, W, H);
    // banner sized big with subtle pop-in
    const popK = Math.min(1, k * 3);              // 0→1 quickly
    const size = 64 * (0.7 + popK * 0.35);
    ctx.save();
    ctx.font = `bold ${Math.round(size)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    const cx = W / 2, cy = H / 2 - 20;
    // black thick stroke first for legibility
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a0d05';
    ctx.strokeText('PWNED!', cx, cy);
    // yellow fill with glow
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 18 + popK * 14;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('PWNED!', cx, cy);
    ctx.shadowBlur = 0;
    // small "killer" subline (skip if killed by arena/hazard with no shooter)
    ctx.font = "bold 12px 'Press Start 2P', monospace";
    ctx.fillStyle = '#fff';
    ctx.fillText('▼ ELIMINATED ▼', cx, cy + 36);
    ctx.restore();
  }
}

function updateHud() {
  const hpEl = document.getElementById('hud-hp');
  hpEl.textContent = Math.max(0, Math.ceil(pug.hp));
  // low-HP pulse
  const hud = document.getElementById('hud');
  if (pug.hp <= 25 && pug.hp > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.012);
    hud.style.filter = `drop-shadow(0 0 ${6 + pulse * 8}px rgba(255,58,58,${0.4 + pulse * 0.4}))`;
  } else {
    hud.style.filter = '';
  }
  document.getElementById('hud-kills').textContent = kills;
  document.getElementById('hud-left').textContent = bots.filter((b) => b.hp > 0).length;
  document.getElementById('hud-weapon').textContent = pug.weapon.name.toUpperCase();
  document.getElementById('hud-jet').textContent = pug.jetCd > 0 ? pug.jetCd.toFixed(1) + 's' : 'READY';
  const best = loadBest('rocket-pug');
  document.getElementById('hud-best').textContent = best ? best.kills : 0;
}

function end(won) {
  running = false;
  document.getElementById('end-title').textContent = won ? 'LAST PUG STANDING' : 'YOU GOT TOASTED';
  document.getElementById('end-sub').textContent = won ? 'The kitchen is yours.' : 'Try a different weapon next time.';
  document.getElementById('end-kills').textContent = kills;
  const { isNewBest, current } = submitRun('rocket-pug', { score: kills, kills, won });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { kills };
    bestEl.innerHTML = `Best: <b>${b.kills} kills</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('end-overlay').hidden = false;
  document.getElementById('end-overlay').classList.remove('is-hidden');
  // S/A/B/C/D grade card layered above the existing end-overlay.
  try {
    const killsPct  = Math.max(0, Math.min(100, (kills / 8) * 100));
    const winPct    = won ? 100 : 0;
    const survivPct = Math.max(0, Math.min(100, (pug.hp / 100) * 100));
    showGradeCard({
      title: won ? 'LAST PUG STANDING' : 'KITCHEN CLOSED',
      subtitle: `${kills} kill${kills === 1 ? '' : 's'} · ${won ? 'VICTORY' : 'DEFEAT'}`,
      stats: [
        { label: 'Kills',    value: killsPct,   weight: 0.55 },
        { label: 'Victory',  value: winPct,     weight: 0.3 },
        { label: 'Survival', value: survivPct,  weight: 0.15 },
      ],
      breakdown: [
        { label: 'Kills',         value: kills,                max: 8 },
        { label: 'Won match',     value: won ? 1 : 0,           max: 1 },
        { label: 'HP remaining',  value: Math.max(0, Math.round(pug.hp)), max: 100 },
      ],
      onRestart: () => start(),
    });
  } catch (e) { /* */ }
}

document.getElementById('start-btn').addEventListener('click', start);
document.getElementById('end-restart').addEventListener('click', start);
function start() {
  reset(); running = true;
  firing = false; // safety: don't auto-fire if mouse was held during restart click
  keys.clear();   // wipe any stuck keys from prior match
  // Wipe stale kill-feed lines from a previous match so they don't bleed into
  // the new round (otherwise the ticker shows "you killed X" from last run).
  try { __rocketFeed.clear(); } catch (e) { /* */ }
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
      showTip('WASD move · MOUSE aim · CLICK fire · SPACE = jetpack burst', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
