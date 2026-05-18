// PUG MUTATION LAB — combine 3 ingredients to discover pug species.
// Recipes are deterministic by ingredient set (sorted). Some are pre-named
// legendaries, others are procedurally generated cursed pugs.
import { createSfx } from '../../src/shared/miniSfx.js';
const sfx = createSfx({ storageKey: 'mutlab:muted' });
sfx.applyButton(document.getElementById('mute-btn'));

const INGREDIENTS = [
  { id: 'lava', icon: '🌋', name: 'Lava' },
  { id: 'donut', icon: '🍩', name: 'Donut' },
  { id: 'wizard', icon: '🧙', name: 'Wizard Hat' },
  { id: 'taco', icon: '🌮', name: 'Taco' },
  { id: 'lightning', icon: '⚡', name: 'Lightning' },
  { id: 'bone', icon: '🦴', name: 'Cursed Bone' },
  { id: 'ghost', icon: '👻', name: 'Ghost Wisp' },
  { id: 'crystal', icon: '💎', name: 'Crystal' },
  { id: 'cheese', icon: '🧀', name: 'Forbidden Cheese' },
  { id: 'gear', icon: '⚙', name: 'Mech Gear' },
  { id: 'rainbow', icon: '🌈', name: 'Rainbow Juice' },
  { id: 'eyeball', icon: '👁', name: 'Spare Eyeball' },
  { id: 'tongue', icon: '👅', name: 'Extra Tongue' },
  { id: 'fire', icon: '🔥', name: 'Fire Spark' },
  { id: 'ice', icon: '🧊', name: 'Ice Cube' },
  { id: 'snake', icon: '🐍', name: 'Snake DNA' },
  { id: 'cake', icon: '🍰', name: 'Birthday Cake' },
  { id: 'bat', icon: '🦇', name: 'Bat Wing' },
  { id: 'tentacle', icon: '🐙', name: 'Tentacle' },
  { id: 'leaf', icon: '🌿', name: 'Strange Leaf' },
];

// Legendary named recipes (sorted ingredient ids → result)
const LEGENDARY = {
  'donut,lava,wizard':     { name: 'MOLTEN SPRINKLE MAGE', icon: '🔥🍩🧙', tier: 'LEGENDARY', desc: 'Casts donut-meteors. Glaze is volcanic.' },
  'bone,cheese,ghost':     { name: 'GORGONZOLA SPECTRE',   icon: '👻🧀🦴', tier: 'LEGENDARY', desc: 'Phases through walls, stinks of regret.' },
  'crystal,rainbow,wizard':{ name: 'PRISMATIC ORACLE PUG', icon: '💎🌈🧙', tier: 'LEGENDARY', desc: 'Sees all futures. Mostly futures involving snacks.' },
  'gear,lightning,snake':  { name: 'MECHA-COBRA EMPEROR',  icon: '🐍⚡⚙',  tier: 'LEGENDARY', desc: 'Half snake, half tank. 100% bork.' },
  'ghost,tentacle,eyeball':{ name: 'PUG-THULHU',           icon: '🐙👁👻', tier: 'LEGENDARY', desc: 'Ph\'nglui mglw\'nafh bork bork.' },
};

// Cursed adjectives + nouns for procedural names
const ADJ = ['Molten', 'Cursed', 'Slimy', 'Holy', 'Frozen', 'Toasted', 'Glittered', 'Stinky', 'Spectral', 'Crispy', 'Soggy', 'Galactic', 'Forbidden', 'Burnt', 'Dripping', 'Glowing', 'Wobbly', 'Inverted', 'Possessed', 'Sentient'];
const NOUN = ['Loaf', 'Mage', 'Knight', 'Lord', 'Demon', 'Angel', 'Ghoul', 'Sphere', 'Blob', 'Wraith', 'Thing', 'Hybrid', 'Crab', 'Worm', 'Wisp', 'Beast', 'Mutant', 'Abomination', 'Snack', 'Cryptid'];
const FACE = ['😈', '👹', '🤖', '🧟', '🦄', '🐲', '🦑', '🦎', '🐸', '🐺', '🐯', '🦊', '🐻', '🦝', '🦨', '🐲', '🦖', '🦕', '🪼', '🧠'];
const CAPS = ['"It bork. It haunt. It mid."', '"Tag urself."', '"Do not feed."', '"Was once a good boy."', '"Smells like static."', '"Born in a microwave."', '"Knows what you did."', '"5/7."', '"Sad pug noises."', '"Just vibing."', '"Don\'t look it in the snoot."', '"Vegan now somehow."', '"100% organic chaos."', '"Cannot stop bork."', '"Free to a good home."'];

let beaker = [null, null, null];
let discoveries = {}; // id -> {name, icon, tier, desc}
let experiments = 0;

const collEl = document.getElementById('collection');
const ingEl = document.getElementById('ingredients');
const resEl = document.getElementById('result');
const fuseBtn = document.getElementById('lab-fuse');

function renderIngredients() {
  ingEl.innerHTML = '';
  for (const ing of INGREDIENTS) {
    const el = document.createElement('div');
    el.className = 'lab-item';
    el.innerHTML = `<div class="lab-item__icon">${ing.icon}</div><div class="lab-item__name">${ing.name}</div>`;
    el.addEventListener('click', () => addToBeaker(ing));
    ingEl.appendChild(el);
  }
}

function addToBeaker(ing) {
  const slot = beaker.findIndex((s) => s == null);
  if (slot === -1) return;
  beaker[slot] = ing;
  sfx.tone(440 + slot * 110, 'triangle', 0.08, 0.18);
  syncBeaker();
}

function syncBeaker() {
  document.querySelectorAll('.lab-slot').forEach((el, i) => {
    if (beaker[i]) {
      el.textContent = beaker[i].icon;
      el.classList.add('filled');
    } else {
      el.textContent = '+';
      el.classList.remove('filled');
    }
  });
  fuseBtn.disabled = beaker.some((s) => s == null);
}

document.querySelectorAll('.lab-slot').forEach((el, i) => {
  el.addEventListener('click', () => { beaker[i] = null; syncBeaker(); });
});

fuseBtn.addEventListener('click', fuse);

function fuse() {
  const ids = beaker.map((b) => b.id).sort();
  const key = ids.join(',');
  experiments++;
  let result;
  if (LEGENDARY[key]) {
    result = { ...LEGENDARY[key], key, legendary: true };
  } else {
    // Procedural mutant: derive name from hashed ingredient ids
    const hash = ids.reduce((h, s) => (h * 31 + s.charCodeAt(0)) >>> 0, 7);
    const adj = ADJ[hash % ADJ.length];
    const noun = NOUN[(hash >> 4) % NOUN.length];
    const face = FACE[(hash >> 8) % FACE.length];
    const cap = CAPS[(hash >> 12) % CAPS.length];
    const cursed = (hash & 0xff) < 60;  // ~23% cursed
    result = {
      key, name: `${adj.toUpperCase()} ${noun.toUpperCase()} PUG`, icon: face,
      tier: cursed ? 'CURSED' : 'COMMON', desc: cap, cursed,
    };
  }
  const isNew = !discoveries[key];
  if (isNew) discoveries[key] = result;
  showResult(result, isNew);
  beaker = [null, null, null];
  syncBeaker();
  save();
  renderCollection();
  updateHud();
}

function showResult(r, isNew) {
  resEl.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'lab-result' + (r.legendary ? ' legendary' : (r.cursed ? ' cursed' : ''));
  div.innerHTML = `
    <div class="lab-result__pug">${r.icon}</div>
    <div class="lab-result__name">${r.name}</div>
    <div class="lab-result__rarity">${r.tier}${isNew ? ' · ★ NEW' : ''}</div>
    <div class="lab-result__caption">${r.desc}</div>
  `;
  resEl.appendChild(div);
  if (r.legendary) {
    sfx.arp([523, 659, 784, 1047, 1319], 'triangle', 0.1, 0.25, 0.3);
  } else if (r.cursed) {
    sfx.sweep(220, 80, 'sawtooth', 0.5, 0.22);
  } else {
    sfx.arp([330, 440, 523], 'square', 0.08, 0.2, 0.25);
  }
  setTimeout(() => { div.style.transition = 'opacity 1s'; div.style.opacity = '0.4'; }, 3500);
}

function renderCollection() {
  collEl.innerHTML = '';
  const list = Object.values(discoveries);
  if (list.length === 0) {
    collEl.innerHTML = '<div style="color:var(--muted);font-size:0.45rem;padding:6px;">No pugs discovered yet</div>';
    return;
  }
  for (const d of list) {
    const el = document.createElement('div');
    el.className = 'lab-item';
    el.title = `${d.name} — ${d.desc}`;
    el.innerHTML = `<div class="lab-item__icon">${d.icon}</div><div class="lab-item__name" style="color:${d.legendary ? 'var(--neon-yellow)' : (d.cursed ? 'var(--crimson)' : 'var(--text-soft)')}">${d.name.split(' ').slice(0, 2).join(' ')}</div>`;
    collEl.appendChild(el);
  }
}

function updateHud() {
  const total = Object.keys(discoveries).length;
  const legCount = Object.values(discoveries).filter((d) => d.legendary).length;
  document.getElementById('hud-discovered').textContent = `${total}/40`;
  document.getElementById('hud-legendary').textContent = `${legCount}/${Object.keys(LEGENDARY).length}`;
  document.getElementById('hud-exp').textContent = experiments;
}

function save() { try { localStorage.setItem('mutlab:state', JSON.stringify({ discoveries, experiments })); } catch {} }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem('mutlab:state') || '{}');
    if (s.discoveries) discoveries = s.discoveries;
    if (s.experiments) experiments = s.experiments;
  } catch {}
}

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('overlay').hidden = true;
  document.getElementById('overlay').classList.add('is-hidden');
  document.getElementById('hud').hidden = false;
  document.getElementById('lab').hidden = false;
  load();
  renderIngredients();
  renderCollection();
  updateHud();
  sfx.resume();
});
