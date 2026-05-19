// PUG CAFÉ PANIC — order management with chaotic pug staff.
import { submitRun, loadBest } from '../../src/persistence/highScores.js';
import { createSfx } from '../../src/shared/miniSfx.js';
import { showTip } from '../../src/shared/tutorialTip.js';

const sfx = createSfx({ storageKey: 'cafe:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

const INGREDIENTS = [
  { id: 'bacon', icon: '🥓', name: 'Bacon' },
  { id: 'cake',  icon: '🧁', name: 'Pupcake' },
  { id: 'slime', icon: '🟢', name: 'Slime' },
  { id: 'noodle', icon: '🍜', name: 'Glow Noodle' },
  { id: 'fish',  icon: '🐟', name: 'Fish' },
  { id: 'milk',  icon: '🥛', name: 'Milk' },
  { id: 'bone',  icon: '🦴', name: 'Bone' },
  { id: 'cheese', icon: '🧀', name: 'Cheese' },
  { id: 'pickle', icon: '🥒', name: 'Pickle' },
  { id: 'donut', icon: '🍩', name: 'Donut' },
];

const RECIPES = [
  { name: 'Triple Bacon Pupcake', items: ['bacon', 'bacon', 'cake'], pay: 30 },
  { name: 'Slime Smoothie',       items: ['slime', 'milk'], pay: 18 },
  { name: 'Glowing Noodles',      items: ['noodle', 'cheese'], pay: 22 },
  { name: 'Fish Bone Stew',       items: ['fish', 'bone'], pay: 20 },
  { name: 'Pickle Donut',         items: ['pickle', 'donut'], pay: 16 },
  { name: 'Bacon Cheesebone',     items: ['bacon', 'cheese', 'bone'], pay: 32 },
  { name: 'Triple Slime',         items: ['slime', 'slime', 'slime'], pay: 38 },
  { name: 'Pup Pizza',            items: ['cheese', 'bacon', 'donut'], pay: 40 },
  { name: 'Fish Smoothie',        items: ['fish', 'milk'], pay: 18 },
  { name: 'Glow Donut Stack',     items: ['noodle', 'donut', 'cake'], pay: 42 },
];

const STAFF_EVENTS = [
  'A pug ATE your bacon.',
  'A pug fell asleep on the milk.',
  'A pug chased a pigeon out the window.',
  'A pug knocked over the noodles.',
  'A pug snored. Order delayed.',
  'A pug sat in the cake.',
  'A pug barked at the door for 20 seconds.',
  'A pug brought you a stick instead.',
];

let orders, bench, money, served, lives, spawnT, eventT, running;
function reset() {
  orders = []; bench = []; money = 0; served = 0; lives = 3;
  spawnT = 1.5; eventT = 5;
}

function spawnOrder() {
  const r = RECIPES[Math.floor(Math.random() * RECIPES.length)];
  orders.push({
    recipe: r,
    items: r.items.map((i) => ({ id: i, done: false })),
    time: 22,
    maxTime: 22,
  });
  renderOrders();
}

function renderKitchen() {
  const k = document.getElementById('kitchen');
  k.innerHTML = '';
  for (const ing of INGREDIENTS) {
    const el = document.createElement('div');
    el.className = 'station';
    el.innerHTML = `<div class="station__icon">${ing.icon}</div><div class="station__name">${ing.name}</div>`;
    el.addEventListener('click', () => grab(ing));
    k.appendChild(el);
  }
}

function renderOrders() {
  const el = document.getElementById('orders');
  el.innerHTML = '';
  if (orders.length === 0) {
    el.innerHTML = '<span style="color:var(--muted);font-size:0.5rem;padding:6px;">No orders yet…</span>';
    return;
  }
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const div = document.createElement('div');
    let cls = 'order';
    const k = o.time / o.maxTime;
    if (k < 0.3) cls += ' crit';
    else if (k < 0.6) cls += ' warn';
    div.className = cls;
    div.innerHTML = `
      <h4>${o.recipe.name}</h4>
      <ul>${o.items.map((it) => {
        const ing = INGREDIENTS.find((g) => g.id === it.id);
        return `<li class="${it.done ? 'done' : ''}"><span>${ing.icon}</span><span>${ing.name}</span></li>`;
      }).join('')}</ul>
      <div class="order__timer"><div class="order__timer-fill" style="width:${k * 100}%;background:${k < 0.3 ? '#ff3a3a' : (k < 0.6 ? '#ffd23f' : '#5ef38c')}"></div></div>
      <button class="serve-btn" data-idx="${i}" style="margin-top:6px;width:100%;">SERVE $${o.recipe.pay}</button>
    `;
    el.appendChild(div);
  }
  el.querySelectorAll('.serve-btn').forEach((b) => b.addEventListener('click', () => serve(+b.dataset.idx)));
}

function renderBench() {
  const b = document.getElementById('bench');
  b.innerHTML = '';
  if (bench.length === 0) {
    b.innerHTML = '<span style="color:var(--muted);font-size:0.5rem;">empty bench</span>';
    return;
  }
  for (let i = 0; i < bench.length; i++) {
    const ing = INGREDIENTS.find((g) => g.id === bench[i]);
    const el = document.createElement('div');
    el.className = 'bench__held';
    el.innerHTML = `<div class="station__icon">${ing.icon}</div><div class="station__name">${ing.name}</div>`;
    el.addEventListener('click', () => { bench.splice(i, 1); renderBench(); });
    b.appendChild(el);
  }
}

function grab(ing) {
  if (bench.length >= 4) { showEvent('Bench full!'); return; }
  bench.push(ing.id);
  sfx.tone(660, 'triangle', 0.06, 0.18);
  renderBench();
}

function serve(idx) {
  const o = orders[idx];
  if (!o) return;
  // Check that bench contains all needed items
  const need = o.recipe.items.slice();
  const benchCopy = bench.slice();
  for (const n of need) {
    const i = benchCopy.indexOf(n);
    if (i === -1) { showEvent('Missing ingredient!'); sfx.tone(165, 'sawtooth', 0.1, 0.18); return; }
    benchCopy.splice(i, 1);
  }
  // Success
  bench = benchCopy;
  money += o.recipe.pay;
  served++;
  orders.splice(idx, 1);
  sfx.arp([523, 659, 784], 'triangle', 0.07, 0.22, 0.2);
  renderBench(); renderOrders();
  updateHud();
}

function tick(dt) {
  if (!running) return;
  spawnT -= dt;
  if (spawnT <= 0) { spawnOrder(); spawnT = Math.max(1.6, 4 - served * 0.05); }
  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i];
    o.time -= dt;
    if (o.time <= 0) {
      orders.splice(i, 1);
      lives--;
      sfx.sweep(220, 110, 'sawtooth', 0.3, 0.22);
      if (lives <= 0) return end();
      updateHud();
    }
  }
  eventT -= dt;
  if (eventT <= 0) {
    eventT = 8 + Math.random() * 6;
    chaosEvent();
  }
  renderOrders();
}

function chaosEvent() {
  const which = Math.floor(Math.random() * 4);
  let msg;
  if (which === 0 && bench.length > 0) {
    bench.splice(Math.floor(Math.random() * bench.length), 1);
    msg = STAFF_EVENTS[0];
    renderBench();
  } else if (which === 1) {
    msg = STAFF_EVENTS[1 + Math.floor(Math.random() * (STAFF_EVENTS.length - 1))];
    // shorten oldest order time
    if (orders.length > 0) orders[0].time = Math.max(2, orders[0].time - 3);
  } else if (which === 2) {
    msg = 'A pigeon stole a tip. -$8';
    money = Math.max(0, money - 8);
  } else {
    msg = 'A regular tipped extra! +$15';
    money += 15;
  }
  showEvent(msg);
  updateHud();
}

function showEvent(text) {
  const c = document.getElementById('staff-events');
  const div = document.createElement('div');
  div.className = 'staff__event';
  div.textContent = text;
  c.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function updateHud() {
  document.getElementById('hud-money').textContent = '$' + money;
  document.getElementById('hud-served').textContent = served;
  document.getElementById('hud-lives').textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  const best = loadBest('pug-cafe');
  document.getElementById('hud-best').textContent = best ? '$' + best.money : '$0';
}

function end() {
  running = false;
  sfx.sweep(330, 80, 'sawtooth', 0.5, 0.22);
  document.getElementById('end-money').textContent = '$' + money;
  document.getElementById('end-served').textContent = served;
  const { isNewBest, current } = submitRun('pug-cafe', { score: money, money, served });
  const bestEl = document.getElementById('end-best');
  if (bestEl) {
    const b = current || { money, served };
    bestEl.innerHTML = `Best: <b>$${b.money}</b>${isNewBest ? ' <span style="color:var(--neon-yellow)">★ NEW</span>' : ''}`;
  }
  document.getElementById('hud').hidden = true;
  document.getElementById('cafe').hidden = true;
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
  document.getElementById('cafe').hidden = false;
  renderKitchen(); renderBench(); renderOrders();
  updateHud();
  sfx.resume();
}

let lastT = performance.now();
(function loop(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now; tick(dt);
  requestAnimationFrame(loop);
})(performance.now());

// Tutorial tip — shows briefly when the game starts (every match)
const _startOv = document.getElementById('overlay');
if (_startOv) {
  const _showOnHide = () => {
    if (_startOv.classList.contains('is-hidden') || _startOv.hidden) {
      showTip('Tap an ingredient → tap SERVE on the right order before timer ends', 6000);
    }
  };
  new MutationObserver(_showOnHide).observe(_startOv, { attributes: true, attributeFilter: ['hidden', 'class'] });
}
