// src/shared/ingredientIcons.js
// Pixel-art ingredient icons for PUG MUTATION LAB.
//
//   drawIngredient(ctx, name, x, y, size)
//     -> Canvas2D draw function. Draws a chunky pixel-art mini-icon centered
//        on (x, y), sized to roughly `size` px. Uses fillRect-style 16x16
//        normalized grid so icons stay crisp at 32px and 64px.
//
//   drawIngredientToDataUrl(name, size)
//     -> Returns a data: URL with the icon rasterised at `size`x`size` (useful
//        for <img> slots).
//
// `name` is the ingredient *id* (e.g. 'lava', 'donut', 'bone'). Defaults to a
// generic "?" placeholder when an unknown id is passed.
//
// Self-contained — no project imports. Mirrors the pixel-art style used by
// src/shared/icons.js (centred origin, ~16x16 grid scaled by size/16).

// --- palette ---------------------------------------------------------------
const C = {
  // base
  bg:        '#0a0716',
  white:     '#ffffff',
  black:     '#000000',
  shadow:    'rgba(0,0,0,0.32)',
  // lava
  lavaRed:   '#ff3a1a',
  lavaOrange:'#ff8e3c',
  lavaHi:    '#ffd23f',
  lavaDeep:  '#8a1a08',
  // donut
  donutDough:'#c8954a',
  donutShade:'#8a5a2a',
  donutIcing:'#ff3aa1',
  donutIcing2:'#ff8ac8',
  sprinkleY: '#ffd23f',
  sprinkleC: '#4cc9f0',
  sprinkleG: '#5ef38c',
  // wizard
  wizPurple: '#6a2080',
  wizPurple2:'#b055ff',
  wizBrim:   '#3a1050',
  starY:     '#ffd23f',
  // taco
  tacoShell: '#f0b840',
  tacoShade: '#a87820',
  tacoLettuce:'#5ef38c',
  tacoMeat:  '#b03030',
  tacoMeatHi:'#d85050',
  // lightning
  boltY:     '#ffd23f',
  boltHi:    '#ffffff',
  boltShade: '#ff8e3c',
  // bone
  boneIvory: '#f4ecd2',
  boneShade: '#d7c89c',
  boneGlow:  'rgba(176,85,255,0.55)',
  // ghost
  ghostWhite:'#ffffff',
  ghostShade:'#c8c8d8',
  // crystal
  crystalC:  '#4cc9f0',
  crystalC2: '#b0e8ff',
  crystalDk: '#2a6a90',
  // cheese
  cheeseY:   '#f6c84a',
  cheeseDk:  '#c89020',
  cheeseHole:'#7a4a25',
  cheeseAura:'rgba(176,85,255,0.55)',
  // gear
  gearGrey:  '#9aa0b0',
  gearDk:    '#5a5a6a',
  gearBolt:  '#2a2a32',
  // rainbow juice
  bottleGlass:'#9ad8ff',
  bottleCap: '#5a3a1a',
  rR: '#ff3a3a', rO: '#ff8e3c', rY: '#ffd23f', rG: '#5ef38c', rB: '#4cc9f0', rP: '#b055ff',
  // eyeball
  eyeWhite:  '#ffffff',
  eyeIris:   '#3aa860',
  eyeIris2:  '#1a5a30',
  eyePupil:  '#000000',
  eyeVein:   '#ff3a3a',
  // tongue
  tonguePink:'#ff8ac8',
  tongueDk:  '#c84a8a',
  // fire
  fireY:     '#ffd23f',
  fireO:     '#ff8e3c',
  fireR:     '#ff3a3a',
  fireCore:  '#ffffff',
  // ice
  iceC:      '#b0e8ff',
  iceShade:  '#4cc9f0',
  iceDeep:   '#2a6a90',
  // snake DNA
  helixG:    '#5ef38c',
  helixDk:   '#2a8a40',
  // cake
  cakeBase:  '#f4ecd2',
  cakeMid:   '#ff8ac8',
  cakeTop:   '#ff3aa1',
  cakeCandle:'#ffd23f',
  cakeFlame: '#ff8e3c',
  cakeShade: '#c84a8a',
  // bat wing
  batPurple: '#6a2080',
  batPurple2:'#b055ff',
  batBone:   '#3a1050',
  // tentacle
  tentP:     '#b055ff',
  tentDk:    '#6a2080',
  tentSucker:'#ff8ac8',
  // leaf
  leafG:     '#5ef38c',
  leafDk:    '#2a8a40',
  leafVein:  '#0a3a18',
};

// --- helpers ---------------------------------------------------------------
function _setup(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  return size / 16; // scale per cell of the 16x16 grid (origin at centre)
}
function _restore(ctx) { ctx.restore(); }

// --- per-ingredient drawers ------------------------------------------------
const drawers = {

  lava(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // deep base puddle
    ctx.fillStyle = C.lavaDeep;
    ctx.fillRect(-6 * s,  3 * s, 12 * s, 2 * s);
    ctx.fillRect(-5 * s,  5 * s, 10 * s, 1 * s);
    // bright orange body (irregular blob with drips)
    ctx.fillStyle = C.lavaOrange;
    ctx.fillRect(-5 * s, -3 * s, 10 * s, 6 * s);
    ctx.fillRect(-4 * s, -5 * s,  8 * s, 2 * s);
    ctx.fillRect(-6 * s, -1 * s,  1 * s, 4 * s);
    ctx.fillRect( 5 * s, -1 * s,  1 * s, 4 * s);
    // hot red core
    ctx.fillStyle = C.lavaRed;
    ctx.fillRect(-3 * s, -2 * s, 6 * s, 4 * s);
    ctx.fillRect(-2 * s, -4 * s, 4 * s, 2 * s);
    // bright highlight
    ctx.fillStyle = C.lavaHi;
    ctx.fillRect(-2 * s, -2 * s, 2 * s, 2 * s);
    ctx.fillRect(-1 * s, -3 * s, 1 * s, 1 * s);
    // drips below
    ctx.fillStyle = C.lavaRed;
    ctx.fillRect(-3 * s,  5 * s, 1 * s, 2 * s);
    ctx.fillRect( 2 * s,  5 * s, 1 * s, 2 * s);
    // tiny ember
    ctx.fillStyle = C.lavaHi;
    ctx.fillRect( 3 * s, -4 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  donut(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // dough ring
    ctx.fillStyle = C.donutDough;
    ctx.fillRect(-5 * s, -3 * s, 10 * s, 6 * s);
    ctx.fillRect(-3 * s, -5 * s,  6 * s, 2 * s);
    ctx.fillRect(-3 * s,  3 * s,  6 * s, 2 * s);
    // hole
    ctx.clearRect(-2 * s, -1 * s, 4 * s, 2 * s);
    // dough shading
    ctx.fillStyle = C.donutShade;
    ctx.fillRect(-5 * s,  2 * s, 10 * s, 1 * s);
    ctx.fillRect(-3 * s,  4 * s,  6 * s, 1 * s);
    // pink icing on top half
    ctx.fillStyle = C.donutIcing;
    ctx.fillRect(-5 * s, -3 * s, 10 * s, 2 * s);
    ctx.fillRect(-3 * s, -5 * s,  6 * s, 2 * s);
    // icing inner edge near hole
    ctx.fillRect(-2 * s, -2 * s, 4 * s, 1 * s);
    // drippy curve down sides
    ctx.fillRect(-5 * s, -1 * s, 1 * s, 1 * s);
    ctx.fillRect( 4 * s, -1 * s, 1 * s, 1 * s);
    // icing highlight
    ctx.fillStyle = C.donutIcing2;
    ctx.fillRect(-2 * s, -4 * s, 2 * s, 1 * s);
    // sprinkles
    ctx.fillStyle = C.sprinkleY;
    ctx.fillRect(-3 * s, -3 * s, 1 * s, 1 * s);
    ctx.fillStyle = C.sprinkleC;
    ctx.fillRect( 1 * s, -4 * s, 1 * s, 1 * s);
    ctx.fillStyle = C.sprinkleG;
    ctx.fillRect( 2 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillStyle = C.white;
    ctx.fillRect( 0 * s, -3 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  wizard(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // brim
    ctx.fillStyle = C.wizBrim;
    ctx.fillRect(-7 * s,  3 * s, 14 * s, 2 * s);
    // cone (stepped triangle)
    ctx.fillStyle = C.wizPurple;
    ctx.fillRect(-5 * s,  1 * s, 10 * s, 2 * s);
    ctx.fillRect(-4 * s, -1 * s,  8 * s, 2 * s);
    ctx.fillRect(-3 * s, -3 * s,  6 * s, 2 * s);
    ctx.fillRect(-2 * s, -5 * s,  4 * s, 2 * s);
    ctx.fillRect(-1 * s, -7 * s,  2 * s, 2 * s);
    // tip flop
    ctx.fillRect( 1 * s, -7 * s,  2 * s, 1 * s);
    // cone highlight
    ctx.fillStyle = C.wizPurple2;
    ctx.fillRect(-4 * s,  0 * s, 1 * s, 1 * s);
    ctx.fillRect(-3 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect(-2 * s, -4 * s, 1 * s, 1 * s);
    // gold stars
    ctx.fillStyle = C.starY;
    ctx.fillRect( 1 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s, -1 * s, 1 * s, 1 * s);
    ctx.fillRect(-1 * s, -4 * s, 1 * s, 1 * s);
    // brim band glint
    ctx.fillStyle = C.starY;
    ctx.fillRect(-7 * s,  3 * s, 14 * s, 1 * s);
    _restore(ctx);
  },

  taco(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // shell (U-shape)
    ctx.fillStyle = C.tacoShell;
    ctx.fillRect(-7 * s, -1 * s, 14 * s, 5 * s);
    ctx.fillRect(-6 * s,  4 * s, 12 * s, 1 * s);
    // shell inner shadow
    ctx.fillStyle = C.tacoShade;
    ctx.fillRect(-7 * s,  3 * s, 14 * s, 1 * s);
    // lettuce frill at the top of the opening
    ctx.fillStyle = C.tacoLettuce;
    ctx.fillRect(-5 * s, -2 * s, 10 * s, 1 * s);
    ctx.fillRect(-6 * s, -1 * s,  2 * s, 1 * s);
    ctx.fillRect(-2 * s, -3 * s,  2 * s, 1 * s);
    ctx.fillRect( 2 * s, -2 * s,  2 * s, 1 * s);
    ctx.fillRect( 5 * s, -1 * s,  1 * s, 1 * s);
    // meat layer
    ctx.fillStyle = C.tacoMeat;
    ctx.fillRect(-4 * s,  0 * s, 8 * s, 2 * s);
    ctx.fillStyle = C.tacoMeatHi;
    ctx.fillRect(-3 * s,  0 * s, 2 * s, 1 * s);
    ctx.fillRect( 1 * s,  1 * s, 2 * s, 1 * s);
    // cheese flecks
    ctx.fillStyle = C.cheeseY;
    ctx.fillRect(-2 * s,  2 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s,  2 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  lightning(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // glow halo
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.fillRect(-4 * s, -6 * s, 8 * s, 13 * s);
    // bolt body (zigzag, two-tone)
    ctx.fillStyle = C.boltY;
    // upper blade
    ctx.fillRect( 0 * s, -7 * s, 3 * s, 1 * s);
    ctx.fillRect(-1 * s, -6 * s, 4 * s, 1 * s);
    ctx.fillRect(-2 * s, -5 * s, 4 * s, 1 * s);
    ctx.fillRect(-3 * s, -4 * s, 4 * s, 1 * s);
    // wide middle joint
    ctx.fillRect(-2 * s, -3 * s, 5 * s, 1 * s);
    ctx.fillRect( 0 * s, -2 * s, 3 * s, 1 * s);
    ctx.fillRect( 1 * s, -1 * s, 2 * s, 1 * s);
    // lower blade
    ctx.fillRect(-1 * s,  0 * s, 3 * s, 1 * s);
    ctx.fillRect(-2 * s,  1 * s, 3 * s, 1 * s);
    ctx.fillRect(-3 * s,  2 * s, 3 * s, 1 * s);
    ctx.fillRect(-4 * s,  3 * s, 3 * s, 1 * s);
    ctx.fillRect(-5 * s,  4 * s, 2 * s, 1 * s);
    // bright leading edge
    ctx.fillStyle = C.boltHi;
    ctx.fillRect( 0 * s, -7 * s, 1 * s, 1 * s);
    ctx.fillRect(-1 * s, -5 * s, 1 * s, 1 * s);
    ctx.fillRect(-3 * s,  2 * s, 1 * s, 1 * s);
    // orange trailing edge
    ctx.fillStyle = C.boltShade;
    ctx.fillRect( 2 * s, -6 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect(-1 * s,  1 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  bone(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // purple curse glow underneath
    ctx.fillStyle = C.boneGlow;
    ctx.fillRect(-7 * s,  3 * s, 14 * s, 3 * s);
    ctx.fillRect(-5 * s,  2 * s, 10 * s, 1 * s);
    // bone shaft
    ctx.fillStyle = C.boneIvory;
    ctx.fillRect(-4 * s, -1 * s, 8 * s, 2 * s);
    // knuckles
    ctx.fillRect(-6 * s, -3 * s, 3 * s, 3 * s);
    ctx.fillRect(-6 * s,  0 * s, 3 * s, 3 * s);
    ctx.fillRect( 3 * s, -3 * s, 3 * s, 3 * s);
    ctx.fillRect( 3 * s,  0 * s, 3 * s, 3 * s);
    // shading
    ctx.fillStyle = C.boneShade;
    ctx.fillRect(-4 * s,  0 * s, 8 * s, 1 * s);
    ctx.fillRect(-6 * s,  2 * s, 3 * s, 1 * s);
    ctx.fillRect( 3 * s,  2 * s, 3 * s, 1 * s);
    // tiny crack
    ctx.fillStyle = C.wizPurple;
    ctx.fillRect(-1 * s, -1 * s, 1 * s, 2 * s);
    _restore(ctx);
  },

  ghost(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // wispy white body
    ctx.fillStyle = C.ghostWhite;
    ctx.fillRect(-3 * s, -6 * s,  6 * s, 1 * s);
    ctx.fillRect(-5 * s, -5 * s, 10 * s, 2 * s);
    ctx.fillRect(-6 * s, -3 * s, 12 * s, 7 * s);
    // wavy bottom — three lobes
    ctx.fillRect(-6 * s,  4 * s,  3 * s, 1 * s);
    ctx.fillRect(-1 * s,  4 * s,  3 * s, 1 * s);
    ctx.fillRect( 4 * s,  4 * s,  2 * s, 1 * s);
    // soft shade band
    ctx.fillStyle = C.ghostShade;
    ctx.fillRect(-6 * s,  3 * s, 12 * s, 1 * s);
    ctx.fillRect(-5 * s, -5 * s,  1 * s, 1 * s);
    // big black eyes
    ctx.fillStyle = C.black;
    ctx.fillRect(-3 * s, -2 * s, 2 * s, 2 * s);
    ctx.fillRect( 1 * s, -2 * s, 2 * s, 2 * s);
    // tiny "o" mouth
    ctx.fillRect(-1 * s,  1 * s, 2 * s, 2 * s);
    // eye glints
    ctx.fillStyle = C.white;
    ctx.fillRect(-2 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s, -2 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  crystal(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // top point
    ctx.fillStyle = C.crystalC;
    ctx.fillRect(-1 * s, -7 * s, 2 * s, 1 * s);
    ctx.fillRect(-2 * s, -6 * s, 4 * s, 1 * s);
    ctx.fillRect(-3 * s, -5 * s, 6 * s, 1 * s);
    ctx.fillRect(-4 * s, -4 * s, 8 * s, 1 * s);
    // widest band
    ctx.fillRect(-5 * s, -3 * s, 10 * s, 2 * s);
    // taper down to base point
    ctx.fillRect(-4 * s, -1 * s, 8 * s, 1 * s);
    ctx.fillRect(-3 * s,  0 * s, 6 * s, 1 * s);
    ctx.fillRect(-2 * s,  1 * s, 4 * s, 1 * s);
    ctx.fillRect(-1 * s,  2 * s, 2 * s, 1 * s);
    // facet shading right side
    ctx.fillStyle = C.crystalDk;
    ctx.fillRect( 1 * s, -3 * s, 4 * s, 2 * s);
    ctx.fillRect( 1 * s, -1 * s, 3 * s, 1 * s);
    ctx.fillRect( 1 * s,  0 * s, 2 * s, 1 * s);
    // bright highlight ridge
    ctx.fillStyle = C.crystalC2;
    ctx.fillRect(-2 * s, -5 * s, 1 * s, 2 * s);
    ctx.fillRect(-3 * s, -3 * s, 1 * s, 2 * s);
    // sparkle
    ctx.fillStyle = C.white;
    ctx.fillRect( 3 * s, -6 * s, 1 * s, 1 * s);
    ctx.fillRect(-4 * s,  1 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  cheese(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // purple aura
    ctx.fillStyle = C.cheeseAura;
    ctx.fillRect(-7 * s, -6 * s, 14 * s, 12 * s);
    // wedge triangle
    ctx.fillStyle = C.cheeseY;
    ctx.fillRect(-6 * s,  3 * s, 12 * s, 2 * s);
    ctx.fillRect(-5 * s,  1 * s, 10 * s, 2 * s);
    ctx.fillRect(-3 * s, -1 * s,  7 * s, 2 * s);
    ctx.fillRect(-1 * s, -3 * s,  4 * s, 2 * s);
    ctx.fillRect( 1 * s, -5 * s,  2 * s, 2 * s);
    // rind / crust shading
    ctx.fillStyle = C.cheeseDk;
    ctx.fillRect(-6 * s,  4 * s, 12 * s, 1 * s);
    // holes
    ctx.fillStyle = C.cheeseHole;
    ctx.fillRect(-3 * s,  2 * s, 2 * s, 2 * s);
    ctx.fillRect( 1 * s,  3 * s, 2 * s, 1 * s);
    ctx.fillRect( 0 * s, -1 * s, 1 * s, 1 * s);
    // little forbidden-glow spark
    ctx.fillStyle = C.wizPurple2;
    ctx.fillRect(-5 * s, -4 * s, 1 * s, 1 * s);
    ctx.fillRect( 5 * s, -2 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  gear(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // 8 teeth (outer cross + diagonals)
    ctx.fillStyle = C.gearGrey;
    // top / bottom / left / right teeth
    ctx.fillRect(-1 * s, -7 * s, 2 * s, 2 * s);
    ctx.fillRect(-1 * s,  5 * s, 2 * s, 2 * s);
    ctx.fillRect(-7 * s, -1 * s, 2 * s, 2 * s);
    ctx.fillRect( 5 * s, -1 * s, 2 * s, 2 * s);
    // diagonal teeth
    ctx.fillRect(-5 * s, -5 * s, 2 * s, 2 * s);
    ctx.fillRect( 3 * s, -5 * s, 2 * s, 2 * s);
    ctx.fillRect(-5 * s,  3 * s, 2 * s, 2 * s);
    ctx.fillRect( 3 * s,  3 * s, 2 * s, 2 * s);
    // gear body
    ctx.fillRect(-5 * s, -3 * s, 10 * s, 6 * s);
    ctx.fillRect(-4 * s, -4 * s,  8 * s, 1 * s);
    ctx.fillRect(-4 * s,  3 * s,  8 * s, 1 * s);
    ctx.fillRect(-3 * s, -5 * s,  6 * s, 1 * s);
    ctx.fillRect(-3 * s,  4 * s,  6 * s, 1 * s);
    // shading
    ctx.fillStyle = C.gearDk;
    ctx.fillRect(-5 * s,  2 * s, 10 * s, 1 * s);
    ctx.fillRect(-4 * s,  3 * s,  8 * s, 1 * s);
    // central hub hole
    ctx.fillStyle = C.gearBolt;
    ctx.fillRect(-2 * s, -2 * s, 4 * s, 4 * s);
    // bolts (4 small dots in the body)
    ctx.fillStyle = C.gearBolt;
    ctx.fillRect(-4 * s, -3 * s, 1 * s, 1 * s);
    ctx.fillRect( 3 * s, -3 * s, 1 * s, 1 * s);
    ctx.fillRect(-4 * s,  2 * s, 1 * s, 1 * s);
    ctx.fillRect( 3 * s,  2 * s, 1 * s, 1 * s);
    // highlight glint
    ctx.fillStyle = C.white;
    ctx.fillRect(-4 * s, -2 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  rainbow(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // bottle cap
    ctx.fillStyle = C.bottleCap;
    ctx.fillRect(-2 * s, -7 * s, 4 * s, 2 * s);
    // neck
    ctx.fillStyle = C.bottleGlass;
    ctx.fillRect(-2 * s, -5 * s, 4 * s, 1 * s);
    // glass body outline
    ctx.fillRect(-4 * s, -4 * s, 8 * s, 10 * s);
    ctx.fillRect(-3 * s,  6 * s, 6 * s, 1 * s);
    // rainbow stripes inside
    ctx.fillStyle = C.rR;
    ctx.fillRect(-4 * s, -4 * s, 8 * s, 1 * s);
    ctx.fillStyle = C.rO;
    ctx.fillRect(-4 * s, -3 * s, 8 * s, 1 * s);
    ctx.fillStyle = C.rY;
    ctx.fillRect(-4 * s, -2 * s, 8 * s, 1 * s);
    ctx.fillStyle = C.rG;
    ctx.fillRect(-4 * s, -1 * s, 8 * s, 2 * s);
    ctx.fillStyle = C.rB;
    ctx.fillRect(-4 * s,  1 * s, 8 * s, 2 * s);
    ctx.fillStyle = C.rP;
    ctx.fillRect(-4 * s,  3 * s, 8 * s, 3 * s);
    // glass highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-3 * s, -3 * s, 1 * s, 7 * s);
    // cap glint
    ctx.fillStyle = C.starY;
    ctx.fillRect(-1 * s, -7 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  eyeball(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // outer eyeball (white)
    ctx.fillStyle = C.eyeWhite;
    ctx.fillRect(-5 * s, -4 * s, 10 * s, 8 * s);
    ctx.fillRect(-6 * s, -3 * s,  1 * s, 6 * s);
    ctx.fillRect( 5 * s, -3 * s,  1 * s, 6 * s);
    ctx.fillRect(-4 * s, -5 * s,  8 * s, 1 * s);
    ctx.fillRect(-4 * s,  4 * s,  8 * s, 1 * s);
    // bloodshot veins
    ctx.fillStyle = C.eyeVein;
    ctx.fillRect(-5 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect( 4 * s,  1 * s, 1 * s, 1 * s);
    ctx.fillRect(-3 * s,  3 * s, 2 * s, 1 * s);
    ctx.fillRect( 1 * s, -3 * s, 2 * s, 1 * s);
    // green iris
    ctx.fillStyle = C.eyeIris;
    ctx.fillRect(-2 * s, -2 * s, 4 * s, 4 * s);
    ctx.fillRect(-3 * s, -1 * s, 6 * s, 2 * s);
    // iris shade
    ctx.fillStyle = C.eyeIris2;
    ctx.fillRect( 0 * s, -1 * s, 3 * s, 2 * s);
    ctx.fillRect(-2 * s,  1 * s, 4 * s, 1 * s);
    // black pupil
    ctx.fillStyle = C.eyePupil;
    ctx.fillRect(-1 * s, -1 * s, 2 * s, 2 * s);
    // glint
    ctx.fillStyle = C.white;
    ctx.fillRect(-1 * s, -1 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  tongue(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // curled tongue — upper lobe
    ctx.fillStyle = C.tonguePink;
    ctx.fillRect(-5 * s, -5 * s, 10 * s, 4 * s);
    ctx.fillRect(-6 * s, -4 * s,  1 * s, 2 * s);
    ctx.fillRect( 5 * s, -4 * s,  1 * s, 2 * s);
    // mid (twist down)
    ctx.fillRect(-4 * s, -1 * s,  8 * s, 3 * s);
    ctx.fillRect(-5 * s,  0 * s,  1 * s, 2 * s);
    ctx.fillRect( 4 * s,  0 * s,  1 * s, 2 * s);
    // tip curl
    ctx.fillRect(-2 * s,  2 * s,  6 * s, 3 * s);
    ctx.fillRect(-3 * s,  3 * s,  1 * s, 2 * s);
    ctx.fillRect( 4 * s,  3 * s,  1 * s, 2 * s);
    ctx.fillRect( 0 * s,  5 * s,  3 * s, 1 * s);
    // center crease line (darker pink)
    ctx.fillStyle = C.tongueDk;
    ctx.fillRect( 0 * s, -4 * s, 1 * s, 3 * s);
    ctx.fillRect( 1 * s,  0 * s, 1 * s, 2 * s);
    ctx.fillRect( 2 * s,  3 * s, 1 * s, 2 * s);
    // bottom shading edge
    ctx.fillStyle = C.tongueDk;
    ctx.fillRect(-5 * s, -2 * s, 10 * s, 1 * s);
    ctx.fillRect(-4 * s,  1 * s,  8 * s, 1 * s);
    // top highlight
    ctx.fillStyle = C.white;
    ctx.fillRect(-3 * s, -5 * s, 2 * s, 1 * s);
    _restore(ctx);
  },

  fire(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // outer flame (red)
    ctx.fillStyle = C.fireR;
    ctx.fillRect(-1 * s, -7 * s, 2 * s, 1 * s);
    ctx.fillRect(-2 * s, -6 * s, 4 * s, 1 * s);
    ctx.fillRect(-3 * s, -5 * s, 6 * s, 2 * s);
    ctx.fillRect(-4 * s, -3 * s, 8 * s, 3 * s);
    ctx.fillRect(-5 * s,  0 * s, 10 * s, 3 * s);
    ctx.fillRect(-4 * s,  3 * s, 8 * s, 2 * s);
    ctx.fillRect(-3 * s,  5 * s, 6 * s, 1 * s);
    // orange inner
    ctx.fillStyle = C.fireO;
    ctx.fillRect(-1 * s, -5 * s, 2 * s, 1 * s);
    ctx.fillRect(-2 * s, -4 * s, 4 * s, 2 * s);
    ctx.fillRect(-3 * s, -2 * s, 6 * s, 3 * s);
    ctx.fillRect(-2 * s,  1 * s, 4 * s, 2 * s);
    ctx.fillRect(-1 * s,  3 * s, 2 * s, 1 * s);
    // yellow core
    ctx.fillStyle = C.fireY;
    ctx.fillRect(-1 * s, -3 * s, 2 * s, 1 * s);
    ctx.fillRect(-2 * s, -2 * s, 3 * s, 2 * s);
    ctx.fillRect(-1 * s,  0 * s, 2 * s, 2 * s);
    // white hot spark
    ctx.fillStyle = C.fireCore;
    ctx.fillRect(-1 * s, -1 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  ice(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // cube body
    ctx.fillStyle = C.iceC;
    ctx.fillRect(-5 * s, -4 * s, 10 * s, 9 * s);
    // cube front face shadow
    ctx.fillStyle = C.iceShade;
    ctx.fillRect(-5 * s,  4 * s, 10 * s, 1 * s);
    ctx.fillRect( 4 * s, -4 * s,  1 * s, 9 * s);
    // bottom deep edge
    ctx.fillStyle = C.iceDeep;
    ctx.fillRect(-5 * s,  5 * s, 10 * s, 1 * s);
    // top-face slant (isometric look)
    ctx.fillStyle = C.iceC;
    ctx.fillRect(-3 * s, -6 * s, 10 * s, 2 * s);
    ctx.fillRect(-4 * s, -5 * s, 10 * s, 1 * s);
    // top face highlight band
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(-3 * s, -6 * s, 10 * s, 1 * s);
    // shine highlight on front
    ctx.fillStyle = C.white;
    ctx.fillRect(-3 * s, -3 * s, 2 * s, 1 * s);
    ctx.fillRect(-3 * s, -2 * s, 1 * s, 3 * s);
    // bottom-left frost crack
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect( 1 * s,  1 * s, 1 * s, 2 * s);
    _restore(ctx);
  },

  snake(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // helix rungs (horizontal connections)
    ctx.fillStyle = C.helixDk;
    ctx.fillRect(-3 * s, -5 * s, 6 * s, 1 * s);
    ctx.fillRect(-3 * s, -2 * s, 6 * s, 1 * s);
    ctx.fillRect(-3 * s,  1 * s, 6 * s, 1 * s);
    ctx.fillRect(-3 * s,  4 * s, 6 * s, 1 * s);
    // left strand (sinusoidal)
    ctx.fillStyle = C.helixG;
    ctx.fillRect(-4 * s, -7 * s, 2 * s, 2 * s);
    ctx.fillRect(-3 * s, -4 * s, 2 * s, 2 * s);
    ctx.fillRect(-4 * s, -1 * s, 2 * s, 2 * s);
    ctx.fillRect(-3 * s,  2 * s, 2 * s, 2 * s);
    ctx.fillRect(-4 * s,  5 * s, 2 * s, 2 * s);
    // right strand (opposite phase)
    ctx.fillRect( 2 * s, -7 * s, 2 * s, 2 * s);
    ctx.fillRect( 1 * s, -4 * s, 2 * s, 2 * s);
    ctx.fillRect( 2 * s, -1 * s, 2 * s, 2 * s);
    ctx.fillRect( 1 * s,  2 * s, 2 * s, 2 * s);
    ctx.fillRect( 2 * s,  5 * s, 2 * s, 2 * s);
    // strand highlights
    ctx.fillStyle = C.white;
    ctx.fillRect(-4 * s, -7 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s,  5 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  cake(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // bottom layer (sponge)
    ctx.fillStyle = C.cakeBase;
    ctx.fillRect(-6 * s,  2 * s, 12 * s, 4 * s);
    // bottom layer shadow
    ctx.fillStyle = C.cakeShade;
    ctx.fillRect(-6 * s,  5 * s, 12 * s, 1 * s);
    // mid frosting drip
    ctx.fillStyle = C.cakeMid;
    ctx.fillRect(-6 * s,  1 * s, 12 * s, 1 * s);
    ctx.fillRect(-5 * s,  2 * s,  1 * s, 1 * s);
    ctx.fillRect( 4 * s,  2 * s,  1 * s, 1 * s);
    ctx.fillRect(-1 * s,  2 * s,  1 * s, 1 * s);
    // top layer (smaller, frosted)
    ctx.fillStyle = C.cakeTop;
    ctx.fillRect(-4 * s, -2 * s, 8 * s, 3 * s);
    // top layer base (cake)
    ctx.fillStyle = C.cakeBase;
    ctx.fillRect(-4 * s, -1 * s, 8 * s, 2 * s);
    // top frosting again above
    ctx.fillStyle = C.cakeTop;
    ctx.fillRect(-4 * s, -2 * s, 8 * s, 1 * s);
    // candle
    ctx.fillStyle = C.cakeCandle;
    ctx.fillRect(-1 * s, -5 * s, 2 * s, 3 * s);
    // candle stripe
    ctx.fillStyle = C.cakeShade;
    ctx.fillRect(-1 * s, -4 * s, 2 * s, 1 * s);
    // flame
    ctx.fillStyle = C.cakeFlame;
    ctx.fillRect(-1 * s, -7 * s, 2 * s, 2 * s);
    ctx.fillStyle = C.fireY;
    ctx.fillRect( 0 * s, -7 * s, 1 * s, 1 * s);
    ctx.fillStyle = C.white;
    ctx.fillRect( 0 * s, -6 * s, 1 * s, 1 * s);
    // sprinkle dots
    ctx.fillStyle = C.sprinkleC;
    ctx.fillRect(-3 * s,  3 * s, 1 * s, 1 * s);
    ctx.fillStyle = C.sprinkleY;
    ctx.fillRect( 2 * s,  4 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  bat(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // wing membrane
    ctx.fillStyle = C.batPurple;
    // outer arc (right wing shape)
    ctx.fillRect(-6 * s, -5 * s, 12 * s, 3 * s);
    ctx.fillRect(-7 * s, -3 * s,  8 * s, 3 * s);
    ctx.fillRect( 1 * s, -3 * s,  7 * s, 2 * s);
    ctx.fillRect(-5 * s,  0 * s,  5 * s, 3 * s);
    ctx.fillRect( 2 * s, -1 * s,  4 * s, 3 * s);
    // wing scallops (bottom edge)
    ctx.fillRect(-6 * s,  3 * s, 3 * s, 1 * s);
    ctx.fillRect(-1 * s,  3 * s, 3 * s, 1 * s);
    ctx.fillRect( 3 * s,  2 * s, 2 * s, 1 * s);
    // wing highlight
    ctx.fillStyle = C.batPurple2;
    ctx.fillRect(-5 * s, -4 * s, 8 * s, 1 * s);
    ctx.fillRect(-4 * s, -2 * s, 1 * s, 2 * s);
    // bone struts (dark)
    ctx.fillStyle = C.batBone;
    ctx.fillRect(-6 * s, -5 * s, 1 * s, 8 * s);
    ctx.fillRect( 0 * s, -5 * s, 1 * s, 7 * s);
    ctx.fillRect( 4 * s, -5 * s, 1 * s, 6 * s);
    // claw at top
    ctx.fillStyle = C.boneIvory;
    ctx.fillRect(-6 * s, -7 * s, 2 * s, 2 * s);
    ctx.fillRect(-7 * s, -6 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  tentacle(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // S-curl tentacle body (top → bottom)
    ctx.fillStyle = C.tentP;
    // top thick base
    ctx.fillRect(-2 * s, -7 * s, 5 * s, 3 * s);
    ctx.fillRect(-1 * s, -4 * s, 4 * s, 2 * s);
    // curl right
    ctx.fillRect( 1 * s, -2 * s, 5 * s, 2 * s);
    ctx.fillRect( 4 * s,  0 * s, 2 * s, 2 * s);
    // curl back left
    ctx.fillRect(-1 * s,  2 * s, 6 * s, 2 * s);
    ctx.fillRect(-3 * s,  4 * s, 4 * s, 2 * s);
    // tapered tip
    ctx.fillRect(-4 * s,  5 * s, 2 * s, 1 * s);
    ctx.fillRect(-5 * s,  6 * s, 1 * s, 1 * s);
    // shading (darker underside)
    ctx.fillStyle = C.tentDk;
    ctx.fillRect(-2 * s, -5 * s, 5 * s, 1 * s);
    ctx.fillRect( 1 * s, -1 * s, 5 * s, 1 * s);
    ctx.fillRect(-1 * s,  3 * s, 6 * s, 1 * s);
    // suckers (pink circles along underside)
    ctx.fillStyle = C.tentSucker;
    ctx.fillRect(-1 * s, -6 * s, 1 * s, 1 * s);
    ctx.fillRect( 1 * s, -5 * s, 1 * s, 1 * s);
    ctx.fillRect( 3 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s,  3 * s, 1 * s, 1 * s);
    ctx.fillRect( 0 * s,  4 * s, 1 * s, 1 * s);
    ctx.fillRect(-2 * s,  5 * s, 1 * s, 1 * s);
    // highlight
    ctx.fillStyle = C.white;
    ctx.fillRect(-1 * s, -7 * s, 1 * s, 1 * s);
    _restore(ctx);
  },

  leaf(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    // leaf body (pointed oval)
    ctx.fillStyle = C.leafG;
    ctx.fillRect(-1 * s, -7 * s, 2 * s, 1 * s);
    ctx.fillRect(-2 * s, -6 * s, 4 * s, 1 * s);
    ctx.fillRect(-3 * s, -5 * s, 6 * s, 2 * s);
    ctx.fillRect(-4 * s, -3 * s, 8 * s, 2 * s);
    ctx.fillRect(-5 * s, -1 * s, 9 * s, 3 * s);
    ctx.fillRect(-4 * s,  2 * s, 8 * s, 1 * s);
    ctx.fillRect(-3 * s,  3 * s, 6 * s, 1 * s);
    ctx.fillRect(-2 * s,  4 * s, 4 * s, 1 * s);
    ctx.fillRect(-1 * s,  5 * s, 2 * s, 1 * s);
    // dark green shading
    ctx.fillStyle = C.leafDk;
    ctx.fillRect( 2 * s, -3 * s, 2 * s, 2 * s);
    ctx.fillRect( 3 * s, -1 * s, 1 * s, 2 * s);
    ctx.fillRect(-5 * s,  0 * s, 1 * s, 2 * s);
    // central vein
    ctx.fillStyle = C.leafVein;
    ctx.fillRect( 0 * s, -6 * s, 1 * s, 11 * s);
    // side veins (angled)
    ctx.fillRect(-2 * s, -4 * s, 1 * s, 1 * s);
    ctx.fillRect(-3 * s, -3 * s, 1 * s, 1 * s);
    ctx.fillRect( 1 * s, -3 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s, -2 * s, 1 * s, 1 * s);
    ctx.fillRect(-2 * s,  0 * s, 1 * s, 1 * s);
    ctx.fillRect(-3 * s,  1 * s, 1 * s, 1 * s);
    ctx.fillRect( 1 * s,  0 * s, 1 * s, 1 * s);
    ctx.fillRect( 2 * s,  1 * s, 1 * s, 1 * s);
    // stem
    ctx.fillStyle = '#7a4a25';
    ctx.fillRect( 0 * s,  6 * s, 1 * s, 2 * s);
    _restore(ctx);
  },

  // generic fallback (?)
  unknown(ctx, x, y, size) {
    const s = _setup(ctx, x, y, size);
    ctx.fillStyle = '#444';
    ctx.fillRect(-5 * s, -5 * s, 10 * s, 10 * s);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-1 * s, -3 * s, 2 * s, 2 * s);
    ctx.fillRect(-1 * s,  0 * s, 2 * s, 3 * s);
    ctx.fillRect(-1 * s,  4 * s, 2 * s, 1 * s);
    _restore(ctx);
  },
};

// --- public API ------------------------------------------------------------

/**
 * Draws an ingredient icon centred on (x, y), sized roughly `size`x`size`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name  ingredient id (e.g. 'lava', 'bone'). Unknown -> '?'
 * @param {number} x     centre x in px
 * @param {number} y     centre y in px
 * @param {number} size  target size (default 32)
 */
export function drawIngredient(ctx, name, x, y, size = 32) {
  const fn = drawers[name] || drawers.unknown;
  fn(ctx, x, y, size);
}

/**
 * Rasterises an ingredient icon to a data: URL (usable directly as <img src>).
 * @param {string} name
 * @param {number} size  px (square). Default 48.
 * @returns {string} data:image/png URL
 */
export function drawIngredientToDataUrl(name, size = 48) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawIngredient(ctx, name, size / 2, size / 2, size);
  return cv.toDataURL('image/png');
}

/**
 * Convenience: build an off-screen <canvas> element with the ingredient
 * pre-drawn — for direct DOM insertion. HiDPI-aware.
 * @param {string} name
 * @param {number} size  CSS pixels (square). Default 48.
 * @returns {HTMLCanvasElement}
 */
export function makeIngredientCanvas(name, size = 48) {
  const cv = document.createElement('canvas');
  const dpr = Math.max(1, Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  cv.width = Math.round(size * dpr);
  cv.height = Math.round(size * dpr);
  cv.style.width = size + 'px';
  cv.style.height = size + 'px';
  cv.style.display = 'block';
  cv.style.imageRendering = 'pixelated';
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawIngredient(ctx, name, size / 2, size / 2, size);
  return cv;
}
