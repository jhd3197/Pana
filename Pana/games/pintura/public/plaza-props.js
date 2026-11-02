// La Plaza's props, one per cover row (plaza-layout.js), each drawn inside
// exactly its row's box so what you see is what stops you and your shots
// (`npm run collision-report -- plaza` measures it). Anything outside a box is
// overhead and out of reach: the glorieta's roof, the stalls' awnings, tree
// canopies and the portico's lintel over the pillars.
//
// Plain shapes in the plaza's colours; every plain material is baked into one
// tinted batch, the paint marks into one mesh per texture.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { crate } from '/engine/models/props/plaza.js';
import { bake } from '/engine/models/core/static-batch.js';
import { splatTexture } from '/engine/models/props/paintball.js';
import { PALETTE } from '/engine/worlds/look.js';
import { rng } from '/engine/random.js';

const C = {
  stone: '#e8dcc6', stoneDark: '#b9a78c', tile: '#c4553a', stucco: '#f2dcae', stuccoBlue: '#9fd0d8', stuccoPink: '#f2b7a8',
  brick: '#c0683f', cream: PALETTE.crema, wood: PALETTE.madera, woodLight: '#c08a57', iron: '#2f3236', water: '#4fb4cc',
  leaf: '#3f9a4a', leafLight: PALETTE.hoja, bark: '#6b4a32', soil: '#4a3426', glass: '#9fc6d6', tyre: '#1f1f22',
};
const BOOTHS = [[PALETTE.amarillo, PALETTE.rojo], [PALETTE.turquesa, PALETTE.crema], [PALETTE.coral, PALETTE.amarillo], [PALETTE.verde, PALETTE.crema]];
const CARS = [PALETTE.azul, '#e2463f', PALETTE.amarillo, '#5aa36b'];

export function createPlazaProps(cover) {
  const group = new THREE.Group(), statics = new THREE.Group(), materials = new Map(), geometries = [];
  const mat = (color, roughness = .85) => { const key = `${color}:${roughness}`; if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness })); return materials.get(key); };
  const keep = g => { geometries.push(g); return g; };
  // A box (w, h, d) whose base sits at y, centred at (x, z) in the prop's frame.
  const box = (parent, w, h, d, color, x, y, z, rough) => { const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat(color, rough)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const cyl = (parent, r0, r1, h, color, x, y, z, sides = 10, rough) => { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r0, r1, h, sides)), mat(color, rough)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const bounds = [], r = rng(31);

  // Each prop is built along its long axis on x (w along x, d along z), then turned.
  const BUILD = {
    kiosk(g, w, d, h) {
      box(g, w, h - .2, d, C.stone, 0, 0, 0); box(g, w, .2, d, PALETTE.terracota, 0, h - .2, 0);
      box(g, w - .3, .25, d - .3, C.stoneDark, 0, h - .2 + .02, 0);
      const inset = .3, top = 3.7;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, x = Math.sign(Math.round(Math.cos(a) * 10)) * (w / 2 - inset), z = Math.sign(Math.round(Math.sin(a) * 10)) * (d / 2 - inset);
        cyl(g, .09, .11, top - h, C.cream, x, h, z, 8);
      }
      for (const s of [-1, 1]) { box(g, w - .5, .07, .07, C.cream, 0, h + .8, s * (d / 2 - inset)); box(g, .07, .07, d - .5, C.cream, s * (w / 2 - inset), h + .8, 0); }
      const roof = new THREE.Mesh(keep(new THREE.ConeGeometry(w * .68, 1.5, 8)), mat(PALETTE.verde, .7)); roof.position.y = top + .75; roof.rotation.y = Math.PI / 8; roof.castShadow = true; g.add(roof);
      box(g, w * .95, .14, d * .95, C.cream, 0, top - .07, 0); cyl(g, .05, .05, .7, PALETTE.amarillo, 0, top + 1.4, 0, 6);
    },
    fountain(g, w, d, h) {
      const t = .35;
      for (const s of [-1, 1]) { box(g, w, h, t, C.stone, 0, 0, s * (d - t) / 2); box(g, t, h, d - 2 * t, C.stone, s * (w - t) / 2, 0, 0); }
      for (const s of [-1, 1]) { box(g, w + .02, .12, t * .6, PALETTE.azul, 0, h * .55, s * (d - t) / 2); box(g, t * .6, .12, d - 2 * t, PALETTE.azul, s * (w - t) / 2, h * .55, 0); }
      box(g, w - 2 * t, h - .25, d - 2 * t, C.water, 0, 0, 0, .06);
      cyl(g, .3, .4, h + .1, C.stone, 0, 0, 0, 10); cyl(g, .75, .45, .14, C.stone, 0, h + .1, 0, 12);
    },
    bench(g, w, d, h) {
      box(g, w, .07, d * .82, C.woodLight, 0, .42, -d * .09); box(g, w, .3, .07, C.woodLight, 0, h - .3, d / 2 - .07);
      for (const s of [-1, 1]) box(g, .08, .45, d, C.iron, s * (w / 2 - .2), 0, 0); box(g, w, .04, .04, C.iron, 0, h - .04, d / 2 - .05);
    },
    planter(g, w, d, h) {
      box(g, w, h - .08, d, PALETTE.terracota, 0, 0, 0); box(g, w, .08, d, C.cream, 0, h - .08, 0); box(g, w - .2, .04, d - .2, C.soil, 0, h - .06, 0);
      for (let i = 0; i < 5; i++) { const flower = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(.22, 0)), mat([PALETTE.rosa, PALETTE.amarillo, PALETTE.coral, C.leafLight][i % 4])); flower.position.set((r() - .5) * (w - .6), h + .05, (r() - .5) * (d - .6)); g.add(flower); }
    },
    tree(g, w, d, h) {
      cyl(g, w * .36, w * .46, h - .3, C.bark, 0, 0, 0, 8);
      for (const [x, y, z, s, c] of [[0, h + .6, 0, 1.9, C.leaf], [.8, h + .2, .4, 1.2, C.leafLight], [-.7, h + .3, -.5, 1.3, C.leaf]]) { const crown = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(s, 0)), mat(c, .9)); crown.position.set(x, y, z); crown.castShadow = true; g.add(crown); }
    },
    stall(g, w, d, h, n) {
      const [main, trim] = BOOTHS[n % BOOTHS.length];
      box(g, w, h - .3, d, main, 0, 0, 0); box(g, w, .3, d, C.wood, 0, h - .3, 0); box(g, w + .02, .12, d + .02, trim, 0, 1, 0);
      box(g, w - .5, .5, .04, C.wood, 0, 1.2, -d / 2 - .01);
      // The striped awning leans out over the front (−z), above head height.
      for (let i = 0; i < 6; i++) { const stripe = box(g, w / 6, .05, 1.1, i % 2 ? trim : main, -w / 2 + w / 12 + i * w / 6, 0, 0); stripe.position.set(stripe.position.x, h + .15, -d / 2 + .1); stripe.rotation.x = -.25; }
    },
    car(g, w, d, h, n) {
      // Built nose along x: w is the length here (rows give the car's long side to x before the turn).
      const body = CARS[n % CARS.length];
      box(g, w, .78, d, body, 0, .32, 0, .5); box(g, w * .5, h - 1.1, d - .2, C.glass, -w * .05, 1.1, 0, .3); box(g, w * .52, .06, d - .16, body, -w * .05, h - .06, 0, .5);
      box(g, .1, .2, d, C.stoneDark, w / 2 - .05, .35, 0, .4); box(g, .1, .2, d, C.stoneDark, -w / 2 + .05, .35, 0, .4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wheel = cyl(g, .34, .34, .24, C.tyre, sx * w * .3, 0, sz * (d / 2 - .12), 12); wheel.rotation.x = Math.PI / 2; wheel.position.y = .34; }
    },
    cart(g, w, d, h) {
      box(g, w, .4, d, C.woodLight, 0, .45, 0); box(g, w, .05, d, C.wood, 0, .85, 0);
      for (const s of [-1, 1]) { const wheel = cyl(g, .42, .42, .07, C.wood, 0, 0, s * (d / 2 - .04), 12); wheel.rotation.x = Math.PI / 2; wheel.position.y = .42; }
      for (let i = 0; i < 7; i++) { const fruit = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(.13, 0)), mat([PALETTE.amarillo, PALETTE.rojo, PALETTE.verde, '#f39c34'][i % 4], .6)); fruit.position.set((i % 4 - 1.5) * w * .2, .95, (i < 4 ? -.15 : .15) * d); g.add(fruit); }
    },
    wall(g, w, d, h) {
      if (h <= 1.2) { box(g, w, h - .08, d, C.brick, 0, 0, 0, .95); box(g, w + .04, .08, d + .04, C.cream, 0, h - .08, 0); return; }
      box(g, w, h - .2, d, C.stuccoBlue, 0, 0, 0); box(g, w + .02, .3, d + .02, C.stoneDark, 0, 0, 0); box(g, w + .06, .2, d + .06, C.tile, 0, h - .2, 0);
      box(g, w * .7, h * .45, d + .02, PALETTE.amarillo, 0, h * .3, 0); box(g, w * .4, h * .2, d + .03, PALETTE.coral, -w * .1, h * .42, 0);
    },
    corner(g, w, d, h, n) {
      box(g, w, h - .2, d, n % 2 ? C.stuccoPink : C.stucco, 0, 0, 0); box(g, w + .02, .35, d + .02, C.stoneDark, 0, 0, 0); box(g, w + .1, .2, d + .1, C.tile, 0, h - .2, 0);
      for (const s of [-1, 1]) { box(g, .3, h - .2, d + .04, C.cream, s * (w / 2 - .15), 0, 0); box(g, .8, 1, d + .03, '#3a4a5c', s * w * .2, 1.1, 0, .4); }
    },
    pillar(g, w, d, h) {
      box(g, w, .3, d, C.stoneDark, 0, 0, 0); box(g, w * .74, h - .6, d * .74, C.cream, 0, .3, 0); box(g, w, .3, d, C.stone, 0, h - .3, 0);
    },
    stage(g, w, d, h) {
      box(g, w, h - .12, d, PALETTE.coral, 0, 0, 0); box(g, w + .04, .12, d + .04, C.woodLight, 0, h - .12, 0);
      for (const s of [-1, 1]) { box(g, .6, .9, .5, C.iron, s * (w / 2 - .4), h, d / 2 - .35); box(g, .12, 2.2, .12, C.iron, s * (w / 2 - .06), h, d / 2 - .06); }
      box(g, w, .5, .05, PALETTE.amarillo, 0, h + 1.7, d / 2 - .06);
    },
  };

  // Drink crates: the library crate fitted into the box, a column per 2 m.
  const crates = new THREE.Group();
  function crateStack(o) {
    const columns = Math.ceil(o.w / 2), rows = Math.ceil(o.d / 2);
    for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) {
      const model = crate(), box3 = new THREE.Box3().setFromObject(model), size = box3.getSize(new THREE.Vector3()), wrapper = new THREE.Group();
      model.position.sub(box3.min); wrapper.add(model); wrapper.scale.set(o.w / columns / size.x, o.h / size.y, o.d / rows / size.z);
      wrapper.position.set(o.x - o.w / 2 + x * o.w / columns, 0, o.z - o.d / 2 + z * o.d / rows); crates.add(wrapper);
    }
    const band = box(statics, o.w + .01, .24, o.d + .01, o.x > 0 ? PALETTE.coral : PALETTE.turquesa, o.x, o.h * .7 - .12, o.z); band.userData.band = true;
  }

  const counts = {};
  for (const o of cover) {
    bounds.push(new THREE.Box3(new THREE.Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new THREE.Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)));
    const n = counts[o.kind] = (counts[o.kind] ?? -1) + 1;
    if (o.kind === 'crate' || !BUILD[o.kind]) { crateStack(o); continue; }
    // Long side on the prop's x. A car's nose and a stall's front face the square.
    const along = o.kind === 'car' ? o.d >= o.w : o.d > o.w, prop = new THREE.Group(), w = along ? o.d : o.w, d = along ? o.w : o.d;
    BUILD[o.kind](prop, w, d, o.h, n);
    prop.position.set(o.x, 0, o.z);
    // Front (−z in the prop's frame) towards the court's middle line it faces.
    if (along) prop.rotation.y = o.x > 0 ? Math.PI / 2 : -Math.PI / 2; else if (o.z < 0) prop.rotation.y = Math.PI;
    statics.add(prop);
  }

  // The portico: a lintel and a tiled cap over each line of pillars, overhead only.
  const lines = new Map();
  for (const o of cover) if (o.kind === 'pillar') { const k = o.x; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(o); }
  for (const [x, pillars] of lines) {
    if (pillars.length < 2) continue;
    const z0 = Math.min(...pillars.map(o => o.z - o.d / 2)), z1 = Math.max(...pillars.map(o => o.z + o.d / 2)), { w, h } = pillars[0];
    box(statics, w * .55, .3, z1 - z0, C.cream, x, h, (z0 + z1) / 2); box(statics, w * .75, .1, z1 - z0 + .3, C.tile, x, h + .3, (z0 + z1) / 2);
  }

  // Paint from earlier battles: one mark on the tall rows' faces, merged per texture.
  const marks = new Map(), textures = [1, 2, 3, 4].map(seed => splatTexture(seed)), paint = [PALETTE.rojo, PALETTE.azul, PALETTE.amarillo, PALETTE.turquesa, PALETTE.verde];
  cover.forEach((o, i) => {
    if (o.h < 1.2 || o.kind === 'tree' || o.kind === 'pillar') return;
    const face = Math.floor(r() * 4), size = .8 + r() * .7, u = (r() - .5) * .6, v = Math.min(o.h * (.3 + r() * .4), o.h - size / 2);
    const plane = new THREE.PlaneGeometry(size, size), m = new THREE.Object3D();
    if (face < 2) m.position.set(o.x + u * o.w, v, o.z + (face ? 1 : -1) * (o.d / 2 + .03)); else m.position.set(o.x + (face === 3 ? 1 : -1) * (o.w / 2 + .03), v, o.z + u * o.d);
    m.rotation.set(0, face === 1 ? 0 : face === 0 ? Math.PI : face === 3 ? Math.PI / 2 : -Math.PI / 2, 0); m.rotateZ(r() * 6); m.updateMatrix();
    plane.applyMatrix4(m.matrix); const key = `${paint[i % paint.length]}:${i % 4}`; if (!marks.has(key)) marks.set(key, []); marks.get(key).push(plane);
  });
  const decals = [];
  for (const [key, planes] of marks) {
    const [color, t] = key.split(':'), material = new THREE.MeshStandardMaterial({ color, map: textures[t], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(mergeGeometries(planes), material); planes.forEach(p => p.dispose()); decals.push(mesh); group.add(mesh);
  }

  statics.add(crates);
  const batch = bake(statics, { tint: true }); group.add(batch);
  geometries.forEach(g => g.dispose()); crates.traverse(o => o.geometry?.dispose());
  return {
    group, bounds,
    dispose() {
      group.removeFromParent(); group.traverse(o => o.geometry?.dispose());
      batch.userData.tinted?.forEach(m => m.dispose()); materials.forEach(m => m.dispose()); decals.forEach(d => d.material.dispose()); textures.forEach(t => t.dispose());
    },
  };
}
