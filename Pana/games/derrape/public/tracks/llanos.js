// Los Llanos — flooded savanna and ranch country: golden grass, marsh ponds
// with lily pads and reeds, moriche palms, Brahman cattle, capybaras in the
// shallows and scarlet ibis overhead. The Hacienda Pana gate straddles the
// dirt road; the red barn and the ranch house sit inside the loop.

import * as THREE from 'three';
import { M, mesh, box, canvasMat } from '../car-kit.js';
import { marketStall, barrel, crate, cooler } from '/engine/plaza-props.js';

// ---------- llanos-only props ----------
// Small deterministic rng so every prop looks the same on every load.
function srand(seed) {
  return (n) => { const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
}

// Gable roof: two slanted slabs plus triangular end walls.
function gableRoof(w, rise, d, roofMat, endMat) {
  const g = new THREE.Group();
  const half = w / 2;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  for (const s of [1, -1]) {
    const slab = box(slope + 0.5, 0.16, d + 0.6, roofMat, s * half / 2, rise / 2 + 0.08, 0);
    slab.rotation.z = -s * ang;
    g.add(slab);
  }
  const tri = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
  const geo = new THREE.ShapeGeometry(tri);
  for (const s of [1, -1]) {
    const end = mesh(geo, endMat, 0, 0, s * d / 2);
    if (s < 0) end.rotation.y = Math.PI;
    g.add(end);
  }
  return g;
}

// Wooden ranch gate straddling the road: pillars at |off| 11, lintel and
// hanging canvas sign with clearance above 5.5.
function haciendaGate() {
  const g = new THREE.Group();
  const wood = M(0x6b4226, { roughness: 0.95 });
  const dark = M(0x4a2c17, { roughness: 0.95 });
  for (const s of [1, -1]) {
    g.add(box(0.8, 7.4, 0.8, wood, s * 11, 3.7, 0));          // pillar
    g.add(box(1.2, 0.5, 1.2, dark, s * 11, 0.25, 0));         // foot
    g.add(box(1.1, 0.45, 1.1, dark, s * 11, 7.2, 0));         // capital
  }
  g.add(box(23.6, 0.9, 0.9, wood, 0, 7.7, 0));                // lintel (bottom at 7.25)
  const sign = canvasMat(512, 128, (ctx) => {
    ctx.fillStyle = '#4a2c17';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#2e1a0c';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '60px "Luckiest Guy", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HACIENDA PANA', 256, 68);
  });
  g.add(mesh(new THREE.BoxGeometry(10.5, 2.0, 0.2), sign, 0, 6.9, 0.35));
  return g;
}

// Red barn: red walls, grey gable roof, white trim and a white-X door.
function barn() {
  const g = new THREE.Group();
  const red = M(0xa8362b, { roughness: 0.85 });
  const white = M(0xf6f1e4, { roughness: 0.8 });
  g.add(box(7, 3.4, 5, red, 0, 1.7, 0));
  const roof = gableRoof(7.8, 2.1, 5.6, M(0x8d8d96, { roughness: 0.9 }), red);
  roof.position.y = 3.4;
  g.add(roof);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(box(0.24, 3.4, 0.24, white, sx * 3.45, 1.7, sz * 2.45));   // corner boards
  }
  g.add(box(2.4, 2.6, 0.12, M(0x5c3a20, { roughness: 0.9 }), 0, 1.3, 2.52));   // door
  for (const s of [1, -1]) {
    const brace = box(0.15, 3.0, 0.06, white, 0, 1.3, 2.6);
    brace.rotation.z = s * 0.72;
    g.add(brace);
  }
  g.add(box(0.9, 0.9, 0.1, white, 0, 4.15, 2.51));              // loft window frame
  g.add(box(0.62, 0.62, 0.12, M(0x3a3430, { roughness: 0.8 }), 0, 4.15, 2.52));
  return g;
}

// Small white ranch house with a red roof and a little porch.
function ranchHouse() {
  const g = new THREE.Group();
  const white = M(0xf6f1e4, { roughness: 0.85 });
  const red = M(0xb5462f, { roughness: 0.7 });
  const wood = M(0x6b4226, { roughness: 0.9 });
  g.add(box(5, 2.5, 3.8, white, 0, 1.25, 0));
  const roof = gableRoof(5.6, 1.5, 4.4, red, white);
  roof.position.y = 2.5;
  g.add(roof);
  g.add(box(5, 0.14, 1.5, red, 0, 2.15, 2.55));                 // porch roof
  g.add(box(5, 0.18, 1.5, wood, 0, 0.09, 2.6));                 // porch deck
  for (const sx of [1, -1]) g.add(box(0.16, 2.15, 0.16, wood, sx * 2.2, 1.07, 3.1));
  g.add(box(0.9, 1.8, 0.1, wood, 0, 1.0, 1.92));                // door
  for (const sx of [1, -1]) {
    g.add(box(0.9, 0.9, 0.08, M(0x6d8fae, { roughness: 0.3 }), sx * 1.6, 1.45, 1.92));
  }
  return g;
}

// Brahman cow: cream/grey body, shoulder hump, dewlap and short horns.
// The head bobs down to graze.
function brahmanCow({ seed = 1 } = {}) {
  const rnd = srand(seed);
  const g = new THREE.Group();
  const hide = M([0xe6dcc4, 0xd8d0bc, 0xb9b2a4][Math.floor(rnd(0) * 3)], { roughness: 0.9 });
  const dark = M(0x8a8074, { roughness: 0.9 });
  const phase = rnd(1) * 6;
  g.add(box(1.1, 1.1, 2.3, hide, 0, 1.15, 0));                  // body
  const hump = mesh(new THREE.SphereGeometry(0.42, 8, 6), hide, 0, 1.78, 0.62);
  hump.scale.set(0.9, 0.8, 1.1);
  g.add(hump);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(box(0.22, 0.95, 0.22, hide, sx * 0.38, 0.48, sz * 0.8));
  }
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.5, 1.1);
  headPivot.add(box(0.5, 0.5, 0.65, hide, 0, -0.15, 0.35));     // skull
  headPivot.add(box(0.38, 0.34, 0.3, dark, 0, -0.32, 0.72));    // muzzle
  headPivot.add(box(0.3, 0.45, 0.12, hide, 0, -0.55, 0.1));     // dewlap
  for (const s of [1, -1]) {
    const horn = mesh(new THREE.ConeGeometry(0.07, 0.4, 5), M(0xe8e0cc, { roughness: 0.7 }), s * 0.3, 0.12, 0.28);
    horn.rotation.z = -s * 0.9;
    headPivot.add(horn);
    headPivot.add(box(0.26, 0.12, 0.2, hide, s * 0.36, -0.02, 0.3));   // ear
  }
  g.add(headPivot);
  const tail = box(0.08, 0.9, 0.08, hide, 0, 1.1, -1.2);
  g.add(tail);
  g.userData.tick = (t) => {
    headPivot.rotation.x = 0.55 + Math.sin(t * 0.6 + phase) * 0.45;    // graze head-bob
    tail.rotation.x = Math.sin(t * 1.7 + phase) * 0.25;
  };
  return g;
}

// Cluster of flat lily pads for a pond surface.
function lilyPads({ count = 2, seed = 5 } = {}) {
  const rnd = srand(seed);
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const pad = mesh(new THREE.CircleGeometry(0.35 + rnd(i) * 0.35, 8),
      M(rnd(i + 9) > 0.5 ? 0x3e8f3e : 0x55a047, { roughness: 0.9 }),
      (rnd(i + 1) - 0.5) * 2.2, 0, (rnd(i + 2) - 0.5) * 2.2);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = rnd(i + 3) * Math.PI;
    g.add(pad);
  }
  return g;
}

// Tuft of marsh reeds: a few tilted cones plus an optional cattail.
function reedTuft({ seed = 7 } = {}) {
  const rnd = srand(seed);
  const g = new THREE.Group();
  const greens = [0x5a7a3a, 0x6b8f3f, 0x4c6b32];
  const blades = 4 + Math.floor(rnd(0) * 3);
  for (let i = 0; i < blades; i++) {
    const h = 0.7 + rnd(i + 1) * 0.7;
    const b = mesh(new THREE.ConeGeometry(0.09, h, 5), M(greens[i % 3], { roughness: 1 }),
      (rnd(i + 2) - 0.5) * 0.5, h / 2, (rnd(i + 3) - 0.5) * 0.5);
    b.rotation.set((rnd(i + 4) - 0.5) * 0.35, 0, (rnd(i + 5) - 0.5) * 0.35);
    g.add(b);
  }
  if (rnd(6) > 0.4) {
    g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), M(0x6b4a2a, { roughness: 1 }), 0.1, 1.15, 0));
  }
  return g;
}

// ---------- the track ----------
export default {
  id: 'llanos',
  name: 'Los Llanos',
  blurb: "Del corral a los esteros: rectas de sabana y curvas entre morichales.",
  points: [[-70,40],[-15,60],[50,45],[90,0],[150,15],[215,65],[275,30],[285,-40],[230,-90],[170,-85],[130,-140],[60,-190],[-25,-180],[-60,-120],[-125,-110],[-170,-50],[-150,15]],
  rounded: true,
  sectors: [[0,"Hacienda Pana"],[0.25,"Camino del hato"],[0.5,"Los esteros"],[0.75,"Morichal"]],
  hw: 9,
  lineU: 0.06,
  ramps: [
    { u: 0.45, len: 9, h: 1.8, hw: 4.2 },
    { u: 0.78, len: 9, h: 2.2, hw: 4.2 },
  ],
  items: {
    boxes: [0.12, 0.31, 0.51, 0.72, 0.91],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.41, off: 0 },
      { u: 0.74, off: -4 },
    ],
  },
  walls: true,
  fence: {},
  palette: {
    horizon: 0xffe0b0,
    skyTop: 0x7ec0ee,
    hemiSky: 0xfff4dc,
    hemiGround: 0xb09a58,
    hemiInt: 1.6,
    sun: 0xffe8b0,
    sunInt: 2.4,
    ground: 0xd8c26a,
    track: 0xa87b4a,
    dune: 0.4,
    fog: [100, 420],
  },

  scenery(group, kit, T) {
    kit.routeLandscape(group,T,{seed:111,color:0x999b50,tree:'palm',height:12});
    for (const u of [0.3,0.52,0.76]) {
      const p=kit.placeOnTrack(T,T.TOTAL*u,T.HW+25);
      kit.at(group,barn(),{...p,y:T.terrainAt(p.x,p.z)},p.h+Math.PI/2);
      for(let i=0;i<4;i++) {
        const q=kit.placeOnTrack(T,T.TOTAL*u+i*6,T.HW+14);
        kit.at(group,brahmanCow({seed:i+70}),q,q.h);
      }
    }
    const { at } = kit;

    // entrance: name sign + Venezuelan flag by the start line
    const signP = kit.placeOnTrack(T, T.LINE - 16, T.HW + 8);
    at(group, kit.mapSign(['Los', 'Llanos']), signP, signP.h + Math.PI / 2);
    at(group, kit.flagPole({ h: 10 }), kit.placeOnTrack(T, T.LINE - 24, T.HW + 7));

    // Hacienda Pana gate straddling the road (rotY = heading: spans the ribbon)
    const gateP = kit.placeOnTrack(T, T.TOTAL * 0.3, 0);
    at(group, haciendaGate(), gateP);

    // roadside arepa stand facing the drivers
    const standP = kit.placeOnTrack(T, T.TOTAL * 0.14, T.HW + 6.5);
    at(group, kit.arepaStand(), standP, standP.h + Math.PI / 2);

    // The same market kit used for scenery and disguises in Escondidas.
    const marketP = kit.placeOnTrack(T, T.TOTAL * 0.18, T.HW + 9);
    const market = new THREE.Group();
    market.add(marketStall({ seed: 4 }));
    for (const [prop, x, z] of [[barrel(), -3.5, 0], [crate(), 3.5, 0.4], [cooler(), 1.7, 2.1]]) {
      prop.position.set(x, 0, z); market.add(prop);
    }
    at(group, market, marketP, marketP.h + Math.PI / 2);

    // ranch cluster inside the loop: red barn, white house, windmill
    at(group, barn(), { x: 30, z: -24, y: 0.1 }, 0.6);
    at(group, ranchHouse(), { x: 40, z: -16, y: 0.2 }, -0.5);
    at(group, kit.windmill({ h: 9 }), { x: 2, z: -14, y: 0.1 });

    // marsh ponds inside the loop; pond y lifted so the water covers the
    // gentle terrain bumps (dune 0.4). Shores get reeds + grey rocks.
    const ponds = [
      { x: -10, z: 20, rx: 15, rz: 11, y: 0.45, pads: 5, seed: 21 },   // biggest: dock + rowboat
      { x: -40, z: -16, rx: 9, rz: 7, y: 0.3, pads: 3, seed: 22 },
      { x: -10, z: -28, rx: 8, rz: 6, y: 0.15, pads: 3, seed: 23 },
      { x: 36, z: 30, rx: 8, rz: 6, y: 0.35, pads: 3, seed: 24 },
    ];
    for (const p of ponds) {
      at(group, kit.waterPond(p.rx, p.rz, { color: 0x6c9f8b, y: p.y }), { x: p.x, z: p.z });
      for (let i = 0; i < p.pads; i++) {
        const a = (i / p.pads) * Math.PI * 2 + p.seed;
        at(group, lilyPads({ count: 2, seed: p.seed * 10 + i }),
          { x: p.x + Math.cos(a) * p.rx * 0.45, z: p.z + Math.sin(a) * p.rz * 0.45, y: p.y + 0.03 }, a);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + p.seed * 0.7;
        at(group, reedTuft({ seed: p.seed * 20 + i }),
          { x: p.x + Math.cos(a) * (p.rx + 1.2), z: p.z + Math.sin(a) * (p.rz + 1.2) }, a);
        const a2 = a + 0.5;
        at(group, kit.rock(0.5 + ((i * 7 + p.seed) % 5) * 0.14, 0x8d8d96, p.seed * 30 + i),
          { x: p.x + Math.cos(a2) * (p.rx + 1.8), z: p.z + Math.sin(a2) * (p.rz + 1.8) }, a2);
      }
    }

    // dock + rowboat on the biggest pond (west shore, reaching into the water)
    at(group, kit.dock({ len: 7, w: 2.2 }), { x: -22.5, z: 20 });
    at(group, kit.rowboat({ color: 0xb5462f }), { x: -19, z: 22.5, y: 0.45 }, 0.7);

    // capybaras at the pond edges, facing the water
    const capys = [
      { x: -24, z: 18, p: ponds[0] },
      { x: -32, z: -12, p: ponds[1] },
      { x: 28, z: 28, p: ponds[3] },
    ];
    capys.forEach((c, i) => {
      at(group, kit.capybara({ seed: 40 + i }), { x: c.x, z: c.z }, Math.atan2(c.p.x - c.x, c.p.z - c.z));
    });

    // Brahman cattle grazing inside the loop, clear of the road
    const cows = [
      { x: 46, z: -2, rot: 2.2 }, { x: -48, z: 12, rot: 0.8 },
      { x: -28, z: 6, rot: 4.0 }, { x: 10, z: -20, rot: 5.4 },
    ];
    cows.forEach((c, i) => at(group, brahmanCow({ seed: 50 + i }), { x: c.x, z: c.z }, c.rot));

    // scarlet ibis circling over the marshes
    const ibis = { body: '#e8392a', wing: '#c22a1e', beak: '#3a3a3a', tail: '#7a1610' };
    const flights = [
      { cx: -10, cz: 20, cy: 14, r: 16, speed: 0.4, phase: 0 },
      { cx: -25, cz: -22, cy: 16, r: 14, speed: 0.32, phase: 2.1 },
      { cx: -18, cz: 0, cy: 18, r: 22, speed: 0.27, phase: 4.4 },
    ];
    for (const f of flights) kit.buildBird(ibis).flyCircle(group, f);

    // moriche palms: scattered along the road + clustered at the marshes
    const avoid = ponds.map((p) => ({ x: p.x, z: p.z, r: Math.max(p.rx, p.rz) + 5 }))
      .concat([{ x: 30, z: -24, r: 10 }, { x: 40, z: -16, r: 9 }, { x: 2, z: -14, r: 7 }]);
    for (const p of kit.scatter(T, { seed: 60, count: 39, min: T.HW + 4, max: T.HW + 28, avoid })) {
      at(group, kit.palm({ h: 6 + p.k * 4, seed: 70 + Math.floor(p.s) }), p, p.rot);
    }
    const marshPalms = [
      { x: -26, z: 26 }, { x: 6, z: 24 }, { x: -46, z: -6 },
      { x: -30, z: -26 }, { x: 2, z: -34 }, { x: 44, z: 34 },
    ];
    marshPalms.forEach((m, i) => at(group, kit.palm({ h: 7 + (i % 3), seed: 90 + i }), m, i * 1.1));

    // distant flat-topped tepui hills, low and far
    at(group, kit.distantMountains({ r: Math.max(T.bounds.x,T.bounds.z) + 180, count: 10, color: 0x7d8f6a, seed: 3, hMin: 18, hMax: 35 }), { x: -5, z: 0 });
  },
};
