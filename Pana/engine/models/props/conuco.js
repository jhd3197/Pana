// A home plot's pieces: the house at each of its tiers, a tilled bed, the crops at
// each growth stage, a scarecrow and a string of paper flags. Metres, +Y up, +Z front,
// origin on the ground. Everything bakes to one or two draws: colours go in the vertices.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { cylinder } from '/engine/models/core/rural-kit.js';

const DOUBLE = { side: THREE.DoubleSide, roughness: 1 };
// All colours in one mesh per finish. The source geometry is released; the baked
// material clones belong to the model.
function baked(group, name) {
  const out = bake(group, { tint: true }); out.name = name;
  const geometry = new Set();
  group.traverse(o => { if (o.geometry) geometry.add(o.geometry); });
  geometry.forEach(g => g.dispose());
  out.userData.dispose = () => {
    out.traverse(o => o.geometry?.dispose());
    for (const material of out.userData.tinted) material.dispose();
  };
  return out;
}

const WOOD = 0x8a6a45, DARK_WOOD = 0x5b4531, THATCH = 0xc2a25a, THATCH_DRY = 0x9a8452, MUD = 0xb98f63;

// ---------- house ----------
function roof(g, w, d, y, rise, overhang, color, thick = .14) {
  const run = w / 2 + overhang, length = Math.hypot(run, rise * (run / (w / 2))), angle = Math.atan2(rise, w / 2);
  for (const side of [-1, 1]) {
    const plane = box(length, thick, d + overhang * 2, M(color, { roughness: 1 }), side * run / 2, y + rise - Math.tan(angle) * run / 2, 0);
    plane.rotation.z = -side * angle;
    g.add(plane);
  }
  g.add(box(.2, .12, d + overhang * 2, M(color, { roughness: 1 }), 0, y + rise + .02, 0));
}
// The triangle that closes a roof over the front and back walls.
function gable(g, w, rise, z, color) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
  const end = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: false }), M(color, { roughness: 1 }));
  end.castShadow = end.receiveShadow = true;
  end.position.z = z - .05;
  return end;
}
function walls(g, w, h, d, color, band) {
  g.add(box(w, h, d, M(color, { roughness: 1 }), 0, h / 2, 0));
  if (band) g.add(box(w + .04, .36, d + .04, M(band, { roughness: 1 }), 0, .18, 0));
}
function door(g, x, z, color, { w = .95, h = 1.95, frame = 0xf2e6cf } = {}) {
  g.add(box(w + .2, h + .12, .06, M(frame, { roughness: 1 }), x, (h + .12) / 2, z));
  g.add(box(w, h, .09, M(color, { roughness: .9 }), x, h / 2, z + .02));
  g.add(box(.09, .09, .05, M(0xe1b64b, { metalness: .4 }), x + w * .36, h * .48, z + .08));
}
function pane(g, x, y, z, { frame = 0xf2e6cf, shutter = null, flowers = false } = {}) {
  g.add(box(1.02, 1.02, .06, M(frame, { roughness: 1 }), x, y, z));
  g.add(box(.84, .84, .08, M(0x34507a, { roughness: .3 }), x, y, z + .01));
  g.add(box(.05, .84, .1, M(frame, { roughness: 1 }), x, y, z + .02));
  g.add(box(.84, .05, .1, M(frame, { roughness: 1 }), x, y, z + .02));
  if (shutter) for (const side of [-1, 1]) g.add(box(.4, 1.02, .05, M(shutter, { roughness: 1 }), x + side * .74, y, z + .02));
  if (flowers) {
    g.add(box(1.04, .18, .2, M(WOOD, { roughness: 1 }), x, y - .62, z + .1));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.IcosahedronGeometry(.09), M(i % 2 ? 0xe8456b : 0xf6c23a), x - .4 + i * .2, y - .46, z + .13));
  }
}
function porch(g, w, d, z, h, roofColor, post = 0xf2e6cf) {
  g.add(box(w, .16, d, M(DARK_WOOD, { roughness: 1 }), 0, .08, z + d / 2));
  for (const x of [-w / 2 + .12, 0, w / 2 - .12]) if (x) g.add(box(.14, h, .14, M(post, { roughness: 1 }), x, h / 2 + .1, z + d - .12));
  const top = box(w + .3, .08, d + .2, M(roofColor, { roughness: 1 }), 0, h + .16, z + d / 2 + .02);
  top.rotation.x = .34;
  g.add(top);
}
// Rows on a pitched roof, so tile and zinc read as such from the plot's camera.
function ribs(g, w, d, y, rise, overhang, color, rows, thick = .05) {
  const run = w / 2 + overhang, angle = Math.atan2(rise, w / 2);
  for (const side of [-1, 1]) for (let i = 0; i < rows; i++) {
    const t = (i + .5) / rows, x = side * run * t;
    const rib = box(.08, thick, d + overhang * 2, M(color, { roughness: 1 }), x, y + rise - Math.tan(angle) * run * t + .1, 0);
    rib.rotation.z = -side * angle;
    g.add(rib);
  }
}

const HOUSES = {
  // Caído: crooked posts, a back wall with gaps, half a thatch roof and loose planks.
  1(g) {
    const random = rng(11);
    for (const [x, z, lean] of [[-2.4, 1.7, .2], [2.4, 1.7, -.32], [-2.4, -1.7, -.08], [2.4, -1.7, .06]]) g.add(tube([x, 0, z], [x + lean, 2.15, z + lean * .4], .09, M(DARK_WOOD, { roughness: 1 })));
    for (let i = 0; i < 11; i++) {
      if (i % 4 === 3) continue;
      const plank = box(.38, 1.25 + random() * .75, .08, M(i % 3 ? THATCH_DRY : WOOD, { roughness: 1 }), -2.25 + i * .45, .8, -1.72);
      plank.rotation.z = (random() - .5) * .08;
      g.add(plank);
    }
    for (let i = 0; i < 4; i++) g.add(box(.09, .85 + random() * .7, .36, M(WOOD, { roughness: 1 }), -2.38, .6, -1.2 + i * .62));
    // What is left of the roof: rows of thatch, one row short and one gone.
    for (let i = 0; i < 8; i++) {
      if (i === 4) continue;
      const span = i === 3 ? 1.7 : 3.1 + random() * .5;
      const row = box(span, .12, .6, M(i % 2 ? THATCH_DRY : 0x8a7545, { roughness: 1 }), -1 + (3.3 - span) / 2 * -.6, 2.32 + (random() - .5) * .08, -2 + i * .55);
      row.rotation.z = -.2 + (random() - .5) * .05; row.rotation.x = (random() - .5) * .08;
      g.add(row);
    }
    // The door, off its hinges against a post.
    const fallen = box(.95, 1.8, .07, M(DARK_WOOD, { roughness: 1 }), 1.75, .86, 1.45);
    fallen.rotation.x = -.34; fallen.rotation.y = -.25;
    g.add(fallen);
    for (let i = 0; i < 5; i++) {
      const loose = box(1.25 + random(), .06, .2, M(i % 2 ? WOOD : DARK_WOOD, { roughness: 1 }), .3 + random() * 2, .05 + i * .025, .7 + random() * 1.2);
      loose.rotation.y = random() * 3;
      g.add(loose);
    }
  },
  // Rancho: mud walls and a whole thatch roof.
  2(g) {
    walls(g, 5, 2.1, 3.6, MUD, 0x8e6b47);
    roof(g, 5, 3.6, 2.1, 1.15, .4, THATCH, .22);
    g.add(gable(g, 5, 1.15, 1.8, MUD)); g.children.at(-1).position.y = 2.1;
    g.add(gable(g, 5, 1.15, -1.8, MUD)); g.children.at(-1).position.y = 2.1;
    door(g, -.9, 1.8, DARK_WOOD, { frame: WOOD });
    g.add(box(.9, .8, .06, M(0x2c2017), 1.1, 1.3, 1.81));
    g.add(box(1.06, .08, .1, M(WOOD, { roughness: 1 }), 1.1, .86, 1.84));
    g.add(box(1.3, .1, .5, M(0x8c8373), -.9, .05, 2.05));
  },
  // Casita: whitewash, zinc roof, a blue door and shutters.
  3(g) {
    walls(g, 5.2, 2.5, 3.8, 0xf0e8d6, 0x4f7fa3);
    roof(g, 5.2, 3.8, 2.5, 1.05, .42, 0x8a9a9c);
    ribs(g, 5.2, 3.8, 2.5, 1.05, .42, 0xa6b5b6, 6);
    g.add(gable(g, 5.2, 1.05, 1.9, 0xf0e8d6)); g.children.at(-1).position.y = 2.5;
    g.add(gable(g, 5.2, 1.05, -1.9, 0xf0e8d6)); g.children.at(-1).position.y = 2.5;
    door(g, -1.1, 1.9, 0x2f6da1);
    pane(g, 1.15, 1.5, 1.9, { shutter: 0x2f6da1 });
    g.add(box(1.4, .12, .6, M(0x9a9385), -1.1, .06, 2.2));
  },
  // Casa: turquoise walls, tile roof, a porch and flowers at the windows.
  4(g) {
    walls(g, 5.6, 2.6, 4, 0x57bfb1, 0xf2e6cf);
    roof(g, 5.6, 4, 2.6, 1.2, .46, 0xc0603a);
    ribs(g, 5.6, 4, 2.6, 1.2, .46, 0xa84e2d, 8);
    g.add(gable(g, 5.6, 1.2, 2, 0x57bfb1)); g.children.at(-1).position.y = 2.6;
    g.add(gable(g, 5.6, 1.2, -2, 0x57bfb1)); g.children.at(-1).position.y = 2.6;
    door(g, 0, 2, 0xf6c23a);
    pane(g, -1.85, 1.55, 2, { flowers: true }); pane(g, 1.85, 1.55, 2, { flowers: true });
    porch(g, 5.6, 1.5, 2, 2.2, 0xa84e2d);
  },
  // Casona: a wide yellow house with white trim, an upper gable, a railing and a flag.
  5(g) {
    walls(g, 6.6, 2.8, 4.2, 0xf6c23a, 0xf2f0e6);
    roof(g, 6.6, 4.2, 2.8, 1.4, .5, 0xb8502f);
    ribs(g, 6.6, 4.2, 2.8, 1.4, .5, 0x9c4326, 10);
    g.add(gable(g, 6.6, 1.4, 2.1, 0xf6c23a)); g.children.at(-1).position.y = 2.8;
    g.add(gable(g, 6.6, 1.4, -2.1, 0xf6c23a)); g.children.at(-1).position.y = 2.8;
    g.add(box(1.1, .95, .08, M(0xf2f0e6, { roughness: 1 }), 0, 3.4, 2.14));
    g.add(box(.84, .72, .1, M(0x34507a, { roughness: .3 }), 0, 3.4, 2.16));
    door(g, 0, 2.1, 0xd9423a, { w: 1.1, h: 2.1 });
    pane(g, -2.25, 1.6, 2.1, { shutter: 0x2f6da1, flowers: true }); pane(g, 2.25, 1.6, 2.1, { shutter: 0x2f6da1, flowers: true });
    porch(g, 6.6, 1.7, 2.1, 2.35, 0x9c4326);
    for (const side of [-1, 1]) {
      g.add(box(2.2, .08, .08, M(0xf2f0e6), side * 2.1, .85, 3.68));
      g.add(box(2.2, .08, .08, M(0xf2f0e6), side * 2.1, .5, 3.68));
      for (const x of [.95, 1.6, 2.25, 2.9]) g.add(box(.07, .75, .07, M(0xf2f0e6), side * x, .5, 3.68));
    }
    g.add(cylinder(.05, .06, 2.2, M(0xd8d8d0, { metalness: .4 }), 2.6, 4.3, -.8, 8));
    for (const [y, color] of [[5.2, 0xf6c23a], [5, 0x2f6da1], [4.8, 0xd9423a]]) g.add(box(.72, .2, .03, M(color, DOUBLE), 2.98, y, -.8));
  },
};


export function conucoHouse({ tier = 1 } = {}) {
  const g = new THREE.Group(), build = HOUSES[tier] ?? HOUSES[1];
  build(g);
  return baked(g, `conuco-house-${tier}`);
}

// ---------- bed ----------
export function conucoBed({ size = 2.2, seed = 3 } = {}) {
  const g = new THREE.Group(), random = rng(seed), half = size / 2, soil = M(0x5c3d26, { roughness: 1 }), dark = M(0x472d1b, { roughness: 1 });
  g.add(box(size, .1, size, dark, 0, .05, 0));
  for (let i = 0; i < 4; i++) g.add(box(size - .2, .09 + random() * .03, .34, soil, 0, .13, -half + .36 + i * .49));
  for (const side of [-1, 1]) {
    g.add(box(size + .14, .2, .12, M(WOOD, { roughness: 1 }), 0, .1, side * (half + .01)));
    g.add(box(.12, .2, size, M(WOOD, { roughness: 1 }), side * (half + .01), .1, 0));
  }
  return baked(g, 'conuco-bed');
}

// ---------- crops ----------
const BROWN = new THREE.Color(0x9c7a45);
const tone = (color, dry) => dry ? new THREE.Color(color).lerp(BROWN, .72).getHex() : color;
// A long tapered leaf from (x, y, z), leaning `lean` from upright towards `yaw`.
function leaf(g, x, y, z, length, width, yaw, lean, color) {
  const geo = new THREE.CylinderGeometry(0, width, length, 4);
  geo.translate(0, length / 2, 0); geo.scale(1, 1, .16);
  const m = mesh(geo, M(color, DOUBLE), x, y, z);
  m.rotation.order = 'YXZ'; m.rotation.y = yaw; m.rotation.x = lean;
  g.add(m);
}
const ball = (g, r, color, x, y, z, sy = 1) => { const m = mesh(new THREE.IcosahedronGeometry(r, 1), M(color, { roughness: .55 }), x, y, z); m.scale.y = sy; g.add(m); return m; };
const stem = (g, h, r, color, x, z) => g.add(cylinder(r * .7, r, h, M(color, { roughness: 1 }), x, h / 2, z, 6));
function whorl(g, x, y, z, n, length, width, lean, color, random) {
  for (let i = 0; i < n; i++) leaf(g, x, y + (i % 3) * .02, z, length * (.8 + random() * .3), width, i * 2.4 + random() * .4, lean, color);
}

// Each plant at (x, z), full size. `fruit` false is the plant before it bears;
// `dry` is the plant wilted: browner and with its leaves hanging.
const PLANTS = {
  maiz(g, x, z, random, { fruit, dry }) {
    const green = tone(0x5aa23c, dry), h = 1.05 + random() * .2;
    stem(g, h, .05, tone(0x77a948, dry), x, z);
    for (let i = 0; i < 6; i++) leaf(g, x, .28 + i * .15, z, .62, .09, i * 2.1, (dry ? 1.95 : 1.05) + random() * .2, green);
    if (fruit) {
      ball(g, .08, tone(0xf2c52e, dry), x + .09, .62, z + .05, 2.1);
      leaf(g, x, h, z, .24, .05, 0, .1, tone(0xd9c07a, dry));
    }
  },
  caraota(g, x, z, random, { fruit, dry }) {
    stem(g, .4, .03, tone(0x60913b, dry), x, z);
    whorl(g, x, .25, z, 8, .36, .14, dry ? 1.8 : 1.05, tone(0x4c9a44, dry), random);
    if (fruit) for (let i = 0; i < 4; i++) { const a = i * 1.7; ball(g, .05, tone(0x3f2a4d, dry), x + Math.cos(a) * .17, .24 + i * .03, z + Math.sin(a) * .17, 2); }
  },
  aji(g, x, z, random, { fruit, dry }) {
    stem(g, .5, .035, tone(0x6d8f3c, dry), x, z);
    whorl(g, x, .36, z, 9, .3, .13, dry ? 1.9 : 1, tone(0x3f9140, dry), random);
    if (fruit) for (let i = 0; i < 6; i++) { const a = i * 1.05; ball(g, .055, tone(i % 2 ? 0xe2402c : 0xf28a1f, dry), x + Math.cos(a) * .17, .3 + i * .03, z + Math.sin(a) * .17, 1.7); }
  },
  cambur(g, x, z, random, { fruit, dry }) {
    stem(g, 1.1, .1, tone(0x7c9a45, dry), x, z);
    whorl(g, x, 1.02, z, 7, .95, .24, dry ? 2 : 1.05, tone(0x57a93f, dry), random);
    if (fruit) for (let i = 0; i < 7; i++) { const a = i * .9, y = .64 + (i % 3) * .1; const m = ball(g, .05, tone(0xf4d440, dry), x + Math.cos(a) * .15, y, z + Math.sin(a) * .15, 2.3); m.rotation.z = Math.cos(a) * .4; }
  },
  parchita(g, x, z, random, { fruit, dry }) {
    for (const side of [-1, 1]) g.add(cylinder(.03, .04, 1.45, M(DARK_WOOD, { roughness: 1 }), x + side * .78, .72, z, 6));
    g.add(box(1.7, .04, .04, M(DARK_WOOD, { roughness: 1 }), x, 1.4, z));
    g.add(box(1.6, .03, .03, M(WOOD, { roughness: 1 }), x, .8, z));
    for (let i = 0; i < 16; i++) leaf(g, x - .75 + i * .1, .35 + (i * 37 % 10) / 10, z, .24, .11, i * 2.4, dry ? 2 : 1.25, tone(0x44923e, dry));
    if (fruit) for (let i = 0; i < 5; i++) ball(g, .085, tone(i % 2 ? 0xe9c531 : 0x6c3f8a, dry), x - .55 + i * .28, .5 + (i % 3) * .25, z + .09);
  },
  patilla(g, x, z, random, { fruit, dry }) {
    for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .25 + i * .07; leaf(g, x + Math.cos(a) * r, .13, z + Math.sin(a) * r, .34, .16, a, dry ? 1.55 : 1.15, tone(0x4f9c40, dry)); }
    if (fruit) for (const [mx, mz] of [[-.32, .1], [.38, -.22]]) {
      const melon = ball(g, .31, tone(0x2e7a3a, dry), x + mx, .28, z + mz, .85); melon.scale.x = 1.25;
      for (const off of [-.14, 0, .14]) { const stripe = box(.04, .46, .5, M(tone(0x7cc06a, dry)), x + mx + off, .28, z + mz); g.add(stripe); }
    }
  },
  cacao(g, x, z, random, { fruit, dry }) {
    stem(g, 1.25, .08, tone(0x6f5237, dry && false), x, z);
    for (const [ly, ln] of [[1.2, .78], [1, .72], [.82, .62]]) whorl(g, x, ly, z, 7, ln, .17, dry ? 2.1 : 1.1, tone(ly > 1.1 ? 0x3f8d3f : 0x356f36, dry), random);
    if (fruit) for (let i = 0; i < 5; i++) { const a = i * 1.26; ball(g, .085, tone(i % 2 ? 0xe58b1f : 0xcf5a22, dry), x + Math.cos(a) * .11, .45 + i * .12, z + Math.sin(a) * .11, 1.65); }
  },
};
// Where a kind stands inside a bed; big plants take the bed alone.
const SPOTS = {
  many: [[-.55, -.55], [.55, -.55], [-.55, .55], [.55, .55]],
  few: [[-.48, -.3], [.48, .3]],
  one: [[0, 0]],
};
const LAYOUT = { maiz: 'many', caraota: 'many', aji: 'many', cambur: 'few', parchita: 'one', patilla: 'one', cacao: 'one' };


// One bed's planting at a stage. `seed` is mounds with a speck of green, `sprout` a
// pair of leaves, `young` the plant before fruit, `ready` with it, `wilted` hanging.
export function conucoCrop({ crop = 'maiz', stage = 'ready', seed = 5 } = {}) {
  const g = new THREE.Group(), random = rng(seed), make = PLANTS[crop] ?? PLANTS.maiz, spots = SPOTS[LAYOUT[crop] ?? 'many'];
  for (const [x, z] of spots) {
    if (stage === 'seed') {
      ball(g, .13, 0x6b4a30, x, .16, z, .5);
      ball(g, .03, 0x7cc24e, x, .24, z);
    } else if (stage === 'sprout') {
      stem(g, .2, .018, 0x76b348, x, z);
      leaf(g, x, .18, z, .2, .08, 0, 1.05, 0x7cc24e); leaf(g, x, .18, z, .2, .08, Math.PI, 1.05, 0x7cc24e);
    } else if (stage === 'young') {
      const part = new THREE.Group();
      make(part, 0, 0, random, { fruit: false, dry: false });
      part.position.set(x, .12, z); part.scale.setScalar(.66);
      g.add(part);
    } else {
      const part = new THREE.Group(), dry = stage === 'wilted';
      make(part, 0, 0, random, { fruit: true, dry });
      part.position.set(x, .12, z);
      if (dry) { part.scale.set(1, .84, 1); part.rotation.z = .1 * (x >= 0 ? 1 : -1); }
      g.add(part);
    }
  }
  return baked(g, `conuco-crop-${crop}-${stage}`);
}

// ---------- decorations ----------
// Espantapájaros: a straw man on a cross with a hat and a checked shirt.
export function conucoScarecrow() {
  const g = new THREE.Group(), pole = M(DARK_WOOD, { roughness: 1 }), straw = M(THATCH, { roughness: 1 });
  g.add(cylinder(.05, .06, 1.9, pole, 0, .95, 0, 6));
  g.add(box(1.5, .07, .07, pole, 0, 1.35, 0));
  g.add(box(.56, .72, .3, M(0xc6452f, { roughness: 1 }), 0, 1.2, 0));
  for (const side of [-1, 1]) {
    g.add(box(.46, .18, .2, M(0x2f6da1, { roughness: 1 }), side * .44, 1.36, 0));
    leaf(g, side * .7, 1.36, 0, .16, .07, Math.PI / 2 * side, 1.5, 0xd9bf6f);
  }
  g.add(box(.58, .08, .32, M(0x5b4531), 0, .9, 0));
  const head = mesh(new THREE.IcosahedronGeometry(.2, 1), straw, 0, 1.76, 0); g.add(head);
  for (const side of [-1, 1]) g.add(box(.05, .05, .02, M(0x271a10), side * .07, 1.79, .19));
  g.add(cylinder(.34, .36, .03, M(0xa7813f, { roughness: 1 }), 0, 1.91, 0, 10));
  g.add(cylinder(.13, .17, .17, M(0xa7813f, { roughness: 1 }), 0, 2, 0, 10));
  return baked(g, 'conuco-scarecrow');
}

// Banderines: two poles and a sagging string of paper flags in three colours.
export function conucoBunting({ span = 8, flags = 13 } = {}) {
  const g = new THREE.Group(), half = span / 2, colors = [0xf6c23a, 0x2f6da1, 0xd9423a];
  for (const side of [-1, 1]) g.add(cylinder(.05, .07, 2.8, M(DARK_WOOD, { roughness: 1 }), side * half, 1.4, 0, 6));
  const shape = new THREE.Shape([new THREE.Vector2(-.17, 0), new THREE.Vector2(.17, 0), new THREE.Vector2(0, -.36)]);
  const y = t => 2.7 - .55 * (1 - (2 * t - 1) ** 2);
  for (let i = 0; i < 16; i++) { const a = i / 16, b = (i + 1) / 16; g.add(tube([-half + a * span, y(a), 0], [-half + b * span, y(b), 0], .012, M(0xe8e0cc, { roughness: 1 }))); }
  for (let i = 0; i < flags; i++) {
    const t = (i + .5) / flags, flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), M(colors[i % 3], DOUBLE));
    flag.position.set(-half + t * span, y(t), 0); flag.castShadow = true;
    g.add(flag);
  }
  return baked(g, 'conuco-bunting');
}
