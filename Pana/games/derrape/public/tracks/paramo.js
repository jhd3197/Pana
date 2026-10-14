// Pana Páramo — high Andean moorland Mérida style: frailejones everywhere,
// a cold laguna with a stone causeway, red-roof cabins, the Pico Pana summit
// sign and a teleférico crossing the whole map. Misty, hilly, snow peaks.

import * as THREE from 'three';
import { M, mesh, box, tube, canvasMat } from '../car-kit.js';

// ---------- páramo-only props ----------

// Frailejón: THE páramo plant. Fuzzy trunk with a rosette of pale sage
// leaves radiating upward.
function frailejon({ h = 1.2, seed = 1 } = {}) {
  const g = new THREE.Group();
  const rand = (n) => { const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
  g.add(mesh(new THREE.CylinderGeometry(0.13, 0.18, h, 7), M(0x9a8a68, { roughness: 1 }), 0, h / 2, 0));
  const sage = M(0xb8c48a, { roughness: 0.9 });
  const sageLight = M(0xccd69e, { roughness: 0.9 });
  const leaves = 8 + Math.floor(rand(99) * 3);
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand(i) * 0.35;
    const leaf = mesh(new THREE.ConeGeometry(0.24, 1.35, 5), i % 3 === 0 ? sageLight : sage);
    leaf.scale.set(1, 1, 0.35);                       // flattened, elongated
    leaf.position.set(Math.cos(a) * 0.28, h + 0.3, Math.sin(a) * 0.28);
    leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);   // radiating upward
    g.add(leaf);
  }
  g.add(mesh(new THREE.SphereGeometry(0.2, 7, 6), sageLight, 0, h + 0.42, 0));   // pale bud
  return g;
}

// Red-roof wooden cabin with a stone chimney.
function cabin({ w = 4.4, d = 3.6, h = 2.6, seed = 1 } = {}) {
  const g = new THREE.Group();
  const wood = M(0x7a5230, { roughness: 0.95 });
  const red = M(0xb5462f, { roughness: 0.7 });
  g.add(box(w, h, d, wood, 0, h / 2, 0));
  for (const s of [1, -1]) {                          // gable roof: two tilted slabs
    const slab = box(w + 0.7, 0.16, d * 0.72, red, 0, h + 0.72, s * d * 0.26);
    slab.rotation.x = -s * 0.62;
    g.add(slab);
  }
  g.add(box(0.95, 1.7, 0.12, M(0x4a2c17, { roughness: 0.9 }), 0.9, 0.85, d / 2 + 0.02));   // door
  g.add(box(1, 0.9, 0.12, M(0xf6e8b0, { emissive: 0x4a3f1a }), -1, 1.55, d / 2 + 0.02));   // warm window
  g.add(box(0.62, 1.7, 0.62, M(0x8d8d96, { roughness: 1 }), -w / 2 + 0.6, h + 0.9, -d * 0.15));   // chimney
  return g;
}

// Summit sign: brown posts, painted panel, little snow peak.
function summitSign() {
  const g = new THREE.Group();
  const wood = M(0x6b4226, { roughness: 0.95 });
  for (const s of [1, -1]) g.add(box(0.3, 3.4, 0.3, wood, s * 1.7, 1.7, 0));
  const panel = canvasMat(512, 256, (ctx) => {
    ctx.fillStyle = '#5c3a20';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#6a6a7a';
    ctx.beginPath();
    ctx.moveTo(30, 226); ctx.lineTo(96, 96); ctx.lineTo(162, 226);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6f6f8';
    ctx.beginPath();
    ctx.moveTo(70, 152); ctx.lineTo(96, 96); ctx.lineTo(122, 152);
    ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '76px "Luckiest Guy", system-ui, sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#16161a';
    ctx.fillStyle = '#fdf6e3';
    ctx.strokeText('PICO PANA', 330, 100);
    ctx.fillText('PICO PANA', 330, 100);
    ctx.font = '52px "Luckiest Guy", system-ui, sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.strokeText('4.765 m.s.n.m.', 330, 180);
    ctx.fillText('4.765 m.s.n.m.', 330, 180);
  });
  g.add(mesh(new THREE.BoxGeometry(4.4, 2.2, 0.2), panel, 0, 2.7, 0.06));
  return g;
}

// Teleférico tower: steel lattice like a windmill, with a crossarm on top.
function telefericoTower({ h = 18 } = {}) {
  const g = new THREE.Group();
  const steel = M(0x5a5a66, { metalness: 0.4, roughness: 0.6 });
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(tube([sx * 2.1, 0, sz * 2.1], [sx * 0.45, h, sz * 0.45], 0.12, steel));
  }
  for (const y of [h * 0.3, h * 0.6, h * 0.85]) {
    const w = 2.1 - (y / h) * 1.6;
    g.add(box(w * 2, 0.09, 0.09, steel, 0, y, w));
    g.add(box(w * 2, 0.09, 0.09, steel, 0, y, -w));
    g.add(box(0.09, 0.09, w * 2, steel, w, y, 0));
    g.add(box(0.09, 0.09, w * 2, steel, -w, y, 0));
  }
  g.add(box(5, 0.32, 0.45, steel, 0, h, 0));                       // crossarm
  for (const s of [1, -1]) g.add(box(0.34, 0.7, 0.34, steel, s * 2.1, h + 0.4, 0));   // cable saddles
  return g;
}

// Red cable-car cabin hanging from the wire; tick shuttles it back and forth.
function cableCabin(curve, phase) {
  const g = new THREE.Group();
  const red = M(0xcf3f2e, { roughness: 0.6 });
  g.add(tube([0, 0, 0], [0, -0.9, 0], 0.06, M(0x3a3a44, { metalness: 0.4 })));   // hanger arm
  g.add(box(0.5, 0.22, 0.3, M(0x3a3a44, { metalness: 0.4 }), 0, 0.05, 0));       // wheel truck
  g.add(box(1.7, 0.18, 1.5, red, 0, -1.0, 0));                                   // roof
  g.add(box(1.5, 0.75, 1.3, M(0x9ec8e0, { roughness: 0.2, metalness: 0.3 }), 0, -1.5, 0));   // glass band
  g.add(box(1.6, 0.7, 1.4, red, 0, -2.2, 0));                                    // body
  g.userData.tick = (t) => {
    const u = 0.5 + 0.44 * Math.sin(t * 0.1 + phase);
    g.position.copy(curve.getPoint(u));
    const tan = curve.getTangent(u);
    g.rotation.y = Math.atan2(tan.x, tan.z);
  };
  return g;
}

// Stone causeway: like kit.flankBridge but chunky grey stone posts and
// lintels — the Mucubají stone bridge look.
function stoneSpan(group, kit, T, s0, s1) {
  const stone = M(0x8d8d96, { roughness: 1 });
  const dark = M(0x6f6f78, { roughness: 1 });
  for (const side of [1, -1]) {
    const off = side * (T.HW + 0.6);
    let prev = null;
    for (let s = s0; s <= s1; s += 3.2) {
      const p = kit.placeOnTrack(T, s, off);
      group.add(box(0.55, 1.9, 0.55, stone, p.x, 0.95, p.z));
      if (prev) {
        const len = Math.hypot(p.x - prev.x, p.z - prev.z);
        const rail = box(len + 0.5, 0.4, 0.35, dark, (p.x + prev.x) / 2, 1.9, (p.z + prev.z) / 2);
        rail.rotation.y = Math.atan2(p.x - prev.x, p.z - prev.z) - Math.PI / 2;
        group.add(rail);
      }
      prev = p;
    }
  }
  // arch markers at both ends of the span
  for (const s of [s0, s1]) {
    for (const side of [1, -1]) {
      const p = kit.placeOnTrack(T, s, side * (T.HW + 0.6));
      group.add(box(0.9, 2.6, 0.9, dark, p.x, 1.3, p.z));
      group.add(box(1.2, 0.35, 1.2, stone, p.x, 2.75, p.z));
    }
  }
}

// ---------- the track ----------
export default {
  id: 'paramo',
  name: 'Pana Páramo',
  blurb: 'Frailejones, laguna fría y el teleférico del Pico Pana.',
  points: [
    [-65, 39], [-28, 54], [11, 52], [48, 41], [70, 20],
    [60, -6], [66, -32], [37, -50], [-7, -54], [-46, -43],
    [-71, -20], [-78, 7],
  ],
  hw: 9,
  lineU: 0.06,
  ramps: [
    { u: 0.38, len: 9, h: 1.8, hw: 4.2 },
    { u: 0.88, len: 9, h: 2.2, hw: 4.2 },
  ],
  items: {
    boxes: [0.16, 0.52],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.34, off: 0 },
      { u: 0.72, off: -4 },
      { u: 0.84, off: 4 },
    ],
  },
  walls: true,
  fence: {},
  palette: {
    horizon: 0xdfe8f0,
    skyTop: 0x8fb8e8,
    hemiSky: 0xf0f4fa,
    hemiGround: 0x7a8a5a,
    hemiInt: 1.5,
    sun: 0xfff4e0,
    sunInt: 2.2,
    ground: 0x9aa06a,
    track: 0xb59a6a,
    dune: 1.4,
    fog: [40, 170],
  },

  scenery(group, kit, T) {
    const { at } = kit;
    const center = { x: -3, z: 0 };
    const laguna = { x: -16, z: 6 };

    // entrance: name sign + flag by the start line
    at(group, kit.mapSign(['Pana', 'Páramo']), kit.placeOnTrack(T, T.LINE - 16, T.HW + 8), Math.PI * 0.5);
    at(group, kit.flagPole({ h: 10 }), kit.placeOnTrack(T, T.LINE - 24, T.HW + 7));

    // the laguna: cold water, rocky shore, small dock and a rowboat
    at(group, kit.waterPond(20, 15, { color: 0x3a7a9a }), laguna);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + 0.3;
      const r = 1 + Math.sin(i * 2.7) * 0.06;
      at(group, kit.rock(0.7 + (i % 3) * 0.35, 0x8d8d96, 40 + i),
        { x: laguna.x + Math.cos(a) * 20.5 * r, z: laguna.z + Math.sin(a) * 15.5 * r }, i);
    }
    at(group, kit.dock({ len: 6.5 }), { x: laguna.x + 14, z: laguna.z + 9, y: 0.08 }, -Math.PI / 4);
    at(group, kit.rowboat({ color: 0xb5462f }), { x: laguna.x + 10, z: laguna.z + 4, y: 0.1 }, 0.7);

    // stream from the laguna flowing south, under the road and away;
    // the road crosses it over a stone causeway
    const sCross = T.paramOf(-15, -52);
    const crossP = kit.placeOnTrack(T, sCross, 0);
    group.add(kit.waterRibbon(
      [[laguna.x, laguna.z - 14], [-17, -25], [crossP.x, crossP.z], [-21, -72], [-24, -88]],
      8, { color: 0x3a7a9a, y: 0.015 }));
    stoneSpan(group, kit, T, sCross - 9, sCross + 9);

    // red-roof cabins by the laguna
    at(group, cabin({ seed: 1 }), { x: -40, z: 20 }, Math.PI * 0.35);
    at(group, cabin({ seed: 2, w: 3.8, d: 3.2 }), { x: 6, z: 26 }, -Math.PI * 0.6);

    // summit sign at the top bend, the highest-feeling stretch
    const summitP = kit.placeOnTrack(T, T.TOTAL * 0.16, T.HW + 6);
    at(group, summitSign(), summitP, summitP.h + Math.PI);

    // arepas beside the road, after the causeway
    const arepaP = kit.placeOnTrack(T, T.TOTAL * 0.72, T.HW + 7);
    at(group, kit.arepaStand({ label: 'AREPAS' }), arepaP, arepaP.h + Math.PI);

    // teleférico: two lattice towers on opposite sides of the map, a sagging
    // cable high overhead and red cabins shuttling along it
    const towerA = { x: 96, z: 24 };
    const towerB = { x: -98, z: -14 };
    at(group, telefericoTower({ h: 18 }), towerA, 0.4);
    at(group, telefericoTower({ h: 18 }), towerB, 0.4);
    const cableCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(towerA.x, 17, towerA.z),
      new THREE.Vector3((towerA.x + towerB.x) / 2, 12.5, (towerA.z + towerB.z) / 2),
      new THREE.Vector3(towerB.x, 17, towerB.z),
    );
    group.add(mesh(new THREE.TubeGeometry(cableCurve, 40, 0.07, 5), M(0x2a2a30, { metalness: 0.5, roughness: 0.5 })));
    for (let i = 0; i < 3; i++) group.add(cableCabin(cableCurve, i * 2.1));

    // waterfalls spilling from rocky outcrops, one feeding the stream outlet
    for (const [i, w] of [
      { x: -28, z: -70, r: 4.5, rot: 0.6, fw: 3, fh: 7 },
      { x: 32, z: 18, r: 3.6, rot: -2.2, fw: 2.4, fh: 5.5 },
    ].entries()) {
      at(group, kit.rock(w.r, 0x7f7f88, 60 + i), { x: w.x, z: w.z });
      at(group, kit.rock(w.r * 0.7, 0x8d8d96, 70 + i), { x: w.x + w.r, z: w.z + 2 });
      at(group, kit.waterfall(w.fw, w.fh), { x: w.x, z: w.z, y: 0.05 }, w.rot);
    }

    // frailejones everywhere: the signature rosette of the páramo
    const avoid = [
      { x: laguna.x, z: laguna.z, r: 26 },
      { x: -40, z: 20, r: 8 }, { x: 6, z: 26, r: 8 },
      { x: crossP.x, z: crossP.z, r: 14 },
      { x: towerA.x, z: towerA.z, r: 8 }, { x: towerB.x, z: towerB.z, r: 8 },
      { x: -28, z: -70, r: 9 }, { x: 32, z: 18, r: 8 },
    ];
    for (const p of kit.scatter(T, { seed: 21, count: 28, min: T.HW + 3, max: T.HW + 26, avoid })) {
      at(group, frailejon({ h: 1 + p.k * 0.6, seed: 200 + p.s }), p, p.rot);
    }
    for (const p of kit.scatter(T, { seed: 22, count: 12, min: T.HW + 5, max: T.HW + 34, avoid })) {
      at(group, kit.rock(0.8 + p.k * 1.4, 0x8d8d96, p.s), p, p.rot);
    }

    // el cóndor pasa: circling slow and high over the moor
    const condor = kit.buildBird({ body: '#1c1a18', wing: '#1c1a18', beak: '#c9b8a8', tail: '#1c1a18', size: 2.2 });
    condor.flyCircle(group, { cx: center.x, cz: center.z, cy: 30, r: 30, speed: 0.15 });

    // snow peaks looming close in the mist
    at(group, kit.distantMountains({ r: 190, count: 12, color: 0x6a6a7a, snow: true, seed: 8, hMin: 50, hMax: 95 }),
      { x: center.x, z: center.z });
  },
};
