// Pana Selva — rainforest river canyon. A loop with an S-bend on the top
// straight; a turquoise river meanders across the inside of the loop and
// crosses under the road twice, where flankBridge turns the ribbon into a
// causeway. Ruins gate, giant ceiba, stilt hut, rope bridge, waterfalls.

import * as THREE from 'three';
import { M, mesh, box, tube } from '../car-kit.js';

// ---------- jungle-only props ----------
// Weathered grey-green stone gate straddling the road. Passage along local
// Z, pillars at |x| = 11.5, lintel underside at y = 6.05 (clearance > 5.5).
function ruinsGate() {
  const g = new THREE.Group();
  const stone = M(0x7a8474, { roughness: 1 });
  const stoneB = M(0x687463, { roughness: 1 });
  const moss = M(0x4d7a3a, { roughness: 1 });
  for (const s of [1, -1]) {
    g.add(box(2.6, 2.4, 2.8, stone, s * 11.5, 1.2, 0));
    g.add(box(2.2, 2.0, 2.4, stoneB, s * 11.6, 3.4, 0.1));
    g.add(box(2.4, 1.8, 2.6, stone, s * 11.4, 5.2, -0.1));
    // mossy patches
    g.add(box(0.9, 0.6, 0.15, moss, s * 9.9, 2.2, 1.35));
    g.add(box(0.6, 0.9, 0.15, moss, s * 12.3, 4.3, 1.25));
    g.add(box(0.7, 0.5, 0.15, moss, s * 10.9, 5.6, -1.35));
  }
  g.add(box(26.5, 1.9, 3, stoneB, 0, 7.0, 0));        // lintel
  g.add(box(7, 1.3, 2.6, stone, -3.5, 8.5, 0.2));     // broken crown chunk
  g.add(box(2.4, 0.5, 0.2, moss, 4, 6.3, 1.5));
  g.add(box(1.4, 0.4, 0.2, moss, -6, 7.6, -1.5));
  return g;
}

// Wooden hut on stilts over the river.
function stiltHut() {
  const g = new THREE.Group();
  const wood = M(0x8a5a33, { roughness: 0.95 });
  const dark = M(0x5c3a20, { roughness: 0.95 });
  for (const [x, z] of [[-1.6, -1.3], [1.6, -1.3], [-1.6, 1.3], [1.6, 1.3], [0, -1.3], [0, 1.3]]) {
    g.add(box(0.22, 3.2, 0.22, dark, x, 0.6, z));
  }
  g.add(box(4.2, 0.18, 3.4, wood, 0, 2.3, 0));          // deck
  g.add(box(3.2, 1.7, 2.5, wood, 0, 3.3, -0.2));        // hut body
  g.add(box(0.8, 1.2, 0.1, dark, 0.6, 3.1, 1.11));      // door
  const roof = mesh(new THREE.ConeGeometry(2.9, 1.8, 4), M(0xc2a35c, { roughness: 1 }), 0, 5.0, -0.2);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return g;
}

// Cliff wall: three big scaled boulders; a waterfall hangs on its face.
function cliff(rock, seed) {
  const g = new THREE.Group();
  const r1 = rock(7, 0x7d8287, seed);
  r1.scale.set(1.5, 2.2, 1.1);
  const r2 = rock(5.5, 0x8a8f94, seed + 1);
  r2.scale.set(1.3, 1.9, 1);
  r2.position.set(6.5, 0, 2);
  const r3 = rock(4.5, 0x757a6e, seed + 2);
  r3.scale.set(1.2, 1.6, 1);
  r3.position.set(-6.5, 0, 1.5);
  g.add(r1, r2, r3);
  return g;
}

function heliconia({ seed = 1 } = {}) {
  const rand = (n) => { const v = Math.sin(seed * 91.7 + n * 47.3) * 43758.5453; return v - Math.floor(v); };
  const g = new THREE.Group();
  g.add(tube([0, 0, 0], [0, 1.8, 0], 0.05, M(0x3d7a34, { roughness: 1 })));
  const cols = [0xe8392a, 0xf4c542];
  const n = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const bract = mesh(new THREE.ConeGeometry(0.26, 0.55, 4), M(cols[i % 2], { roughness: 0.8 }),
      (i % 2 ? 0.14 : -0.14), 0.85 + i * 0.22, 0);
    bract.scale.set(1, 1, 0.4);
    bract.rotation.z = (i % 2 ? -1 : 1) * 0.55;
    g.add(bract);
  }
  return g;
}

// Tiny tree frog: green body, red eyes. Sits on the map sign.
function treeFrog() {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.2, 8, 6), M(0x51b23f, { roughness: 0.7 }), 0, 0.14, 0);
  body.scale.set(1, 0.75, 1.15);
  g.add(body);
  for (const s of [1, -1]) {
    g.add(mesh(new THREE.SphereGeometry(0.07, 7, 5), M(0xe8392a, { roughness: 0.5 }), s * 0.1, 0.26, 0.12));
  }
  return g;
}

// Leaning dead branch for the toucan to perch on.
function perch() {
  const g = new THREE.Group();
  const bark = M(0x6b4a2a, { roughness: 1 });
  g.add(tube([0, 0, 0], [0.4, 3.2, 0], 0.16, bark));
  g.add(tube([0.4, 3.2, 0], [2.2, 3.9, 0.3], 0.09, bark));
  const tuft = mesh(new THREE.SphereGeometry(0.7, 7, 6), M(0x2e7d32, { roughness: 0.9 }), -0.2, 3.7, -0.3);
  tuft.scale.set(1, 0.6, 1);
  g.add(tuft);
  return g;
}

// ---------- the track ----------
export default {
  id: 'selva',
  name: 'Pana Selva',
  blurb: "Curvas de río, ruinas y un largo regreso bajo las ceibas.",
  points: [[-76,28],[-40,60],[15,65],[65,30],[85,-30],[145,-45],[185,0],[230,-15],[270,-80],[240,-145],[175,-155],[120,-115],[70,-145],[25,-210],[-45,-225],[-115,-180],[-120,-105],[-85,-65],[-110,-15]],
  rounded: true,
  sectors: [[0,"Río turquesa"],[0.25,"Ruinas del jaguar"],[0.5,"Bosque de ceibas"],[0.75,"Quebrada escondida"]],
  hw: 9,
  lineU: 0.06,
  ramps: [
    { u: 0.30, len: 9, h: 1.8, hw: 4.2 },
    { u: 0.82, len: 9, h: 2.2, hw: 4.2 },
  ],
  items: {
    boxes: [0.12, 0.31, 0.51, 0.72, 0.91],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.26, off: 0 },
      { u: 0.72, off: -4 },
    ],
  },
  walls: true,
  // fence skips the two river causeways so posts don't fight the rails
  fence: false,
  palette: {
    horizon: 0xb8dcc8,
    skyTop: 0x6fb8d8,
    hemiSky: 0xe8f4dc,
    hemiGround: 0x2e5a34,
    hemiInt: 1.5,
    sun: 0xfff0c8,
    sunInt: 2.0,
    ground: 0x4a7a3a,
    track: 0x9a6b42,
    dune: 0.7,
    fog: [100, 420],
  },

  scenery(group, kit, T) {
    kit.routeLandscape(group,T,{seed:127,color:0x4c7940,tree:'ceiba',height:42});
    const { at } = kit;

    // the river: meanders across the inside of the loop, exits west + south
    const riverPts = [
      [-110, -2], [-79, -8], [-56, 6], [-28, 16], [-4, 2],
      [8, -28], [18, -60], [30, -84], [40, -100],
    ];
    group.add(kit.waterRibbon(riverPts, 14, { color: 0x2fb5a8, y: 0.02 }));

    // causeways where the river crosses under the road
    const crossA = T.paramOf(-80, -8);    // west side, u ~ 0.91
    const crossB = T.paramOf(18, -61);    // bottom straight, u ~ 0.63
    kit.flankBridge(group, T, crossA - 12, crossA + 12);
    kit.flankBridge(group, T, crossB - 14, crossB + 14);

    // entrance: name sign + flag by the start line, frog riding the sign
    const sign = kit.mapSign(['Pana', 'Selva']);
    const frog = treeFrog();
    frog.position.set(1.6, 5.55, 0.25);
    frog.rotation.y = 0.4;
    sign.add(frog);
    const signP = kit.placeOnTrack(T, T.LINE - 16, T.HW + 8);
    at(group, sign, signP, signP.h + Math.PI / 2);
    at(group, kit.flagPole({ h: 10 }), kit.placeOnTrack(T, T.LINE - 24, T.HW + 7));

    // stone ruins gate straddling the road at u ~ 0.45
    const gateP = kit.placeOnTrack(T, T.TOTAL * 0.45, 0);
    at(group, ruinsGate(), gateP, gateP.h);

    // giant ceiba inside the loop
    const giant = kit.ceiba({ seed: 8 }); giant.scale.setScalar(1.8);
    at(group, giant, { x: -14, z: 24 });

    // stilt hut over the river + tied-up rowboat
    at(group, stiltHut(), { x: -4, z: 2, y: -0.2 }, 0.5);
    at(group, kit.rowboat({ color: 0x7a4a2b }), { x: 1, z: -2, y: 0.05 }, 1.1);

    // decorative rope bridge spanning the river, perpendicular to the flow
    const rd = [8 - -4, -28 - 2];   // river tangent near the hut
    at(group, kit.bridge({ len: 18, w: 2.5, rope: true }), { x: 2, z: -13, y: 0.1 }, Math.atan2(-rd[0], -rd[1]));

    // capybara grazing on the riverbank
    at(group, kit.capybara({ seed: 5 }), { x: -9, z: -7 }, 2.2);

    // cliffs with waterfalls + plunge ponds at the loop edges
    const cliffSpots = [
      { x: -145, z: 5, rot: Math.PI / 2, fall: [-136, 5], pond: [-133, 5] },   // west, faces east
      { x: 120, z: 22, rot: -Math.PI / 2, fall: [111, 22], pond: [108, 22] },   // east, faces west
      { x: 16, z: -90, rot: Math.PI, fall: [16, -81], pond: [16, -78] },        // south, faces north
    ];
    for (const [i, c] of cliffSpots.entries()) {
      at(group, cliff(kit.rock, 40 + i * 7), { x: c.x, z: c.z }, c.rot);
      at(group, kit.waterfall(3.2, 12), { x: c.fall[0], z: c.fall[1] }, c.rot);
      at(group, kit.waterPond(6, 5, { color: 0x2fb5a8 }), { x: c.pond[0], z: c.pond[1] });
    }

    // toucan perched on a branch by the top straight
    const perchG = perch();
    const toucan = kit.buildBird({ body: '#16161a', wing: '#16161a', beak: '#f4a259', tail: '#16161a', size: 1.2 });
    toucan.group.position.set(2.2, 3.95, 0.3);
    toucan.group.rotation.y = 0.9;
    perchG.add(toucan.group);
    at(group, perchG, kit.placeOnTrack(T, T.TOTAL * 0.3, T.HW + 5));

    // scarlet macaw circling over the river
    const macaw = kit.buildBird({ body: '#e8392a', wing: '#2a5db8', beak: '#e8e0c8', tail: '#2a5db8', size: 1.3 });
    macaw.flyCircle(group, { cx: -4, cz: -12, cy: 16, r: 20, speed: 0.4, phase: 1 });

    // vegetation, kept clear of the road, river and structures
    const avoid = [
      { x: -14, z: 24, r: 12 }, { x: -4, z: 2, r: 10 }, { x: 2, z: -13, r: 12 },
      { x: -56, z: 6, r: 12 }, { x: -28, z: 16, r: 12 }, { x: 8, z: -28, r: 12 },
      { x: -145, z: 5, r: 18 }, { x: 120, z: 22, r: 18 }, { x: 16, z: -90, r: 18 },
    ];
    for (const [i, p] of kit.scatter(T, { seed: 21, count: 39, min: T.HW + 7, max: T.HW + 26, avoid }).entries()) {
      at(group, kit.palm({ h: 6.5 + p.k * 3.5, seed: 60 + Math.floor(p.s) }), p, p.rot);
    }
    for (const p of kit.scatter(T, { seed: 22, count: 28, min: T.HW + 3.5, max: T.HW + 14, avoid })) {
      at(group, kit.banana({ seed: 70 + Math.floor(p.s) }), p, p.rot);
    }
    for (const p of kit.scatter(T, { seed: 23, count: 22, min: T.HW + 3.5, max: T.HW + 16, avoid })) {
      at(group, heliconia({ seed: 80 + p.s }), p, p.rot);
    }
    for (const p of kit.scatter(T, { seed: 24, count: 22, min: T.HW + 6, max: T.HW + 34, avoid })) {
      at(group, kit.rock(0.9 + p.k * 1.8, 0x6f7a66, p.s), p, p.rot);
    }

    // misty jungle hills on the horizon
    at(group, kit.distantMountains({ r: Math.max(T.bounds.x,T.bounds.z) + 180, count: 9, color: 0x5f8a72, seed: 30, hMin: 22, hMax: 48 }), { x: -8, z: 0 });
  },
};
