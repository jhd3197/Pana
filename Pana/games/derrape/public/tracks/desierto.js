// Pana Desierto — red rock mesas, saguaros, a gas station in the middle of
// nowhere and an oasis under a wooden bridge. Reference biome: the pattern
// the other maps follow.

import * as THREE from 'three';
import { M, mesh, box, tube, canvasMat } from '../car-kit.js';

// ---------- desert-only props ----------
function saguaro({ h = 5, seed = 1 } = {}) {
  const g = new THREE.Group();
  const green = M(0x4a8f3c, { roughness: 0.9 });
  const trunk = mesh(new THREE.CylinderGeometry(0.4, 0.5, h, 9), green, 0, h / 2, 0);
  g.add(trunk);
  g.add(mesh(new THREE.SphereGeometry(0.4, 9, 6), green, 0, h, 0));
  const rand = (n) => { const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
  const arms = 1 + Math.floor(rand(0) * 2);
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1;
    const y0 = h * (0.4 + rand(1 + i) * 0.25);
    const reach = 0.9 + rand(2 + i) * 0.5;
    g.add(tube([0, y0, 0], [side * reach, y0 + 0.1, 0], 0.28, green));
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 8), green, side * reach, y0 + 0.9, 0));
    g.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), green, side * reach, y0 + 1.7, 0));
  }
  return g;
}

function barrelCactus({ seed = 2 } = {}) {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(0.7, 10, 8), M(0x5a9a44, { roughness: 0.9 }), 0, 0.5, 0);
  b.scale.set(1, 0.8, 1);
  g.add(b);
  const f = mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.25, 7), M(0xe8452c, { roughness: 0.8 }), 0, 1.05, 0);
  g.add(f);
  return g;
}

function agave({ seed = 3 } = {}) {
  const g = new THREE.Group();
  const rand = (n) => { const v = Math.sin(seed * 91.7 + n * 47.3) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand(i) * 0.4;
    const leaf = mesh(new THREE.ConeGeometry(0.22, 1.3, 4), M(0x6fa88a, { roughness: 0.9 }));
    leaf.scale.set(1, 1, 0.35);
    leaf.position.set(Math.cos(a) * 0.4, 0.4, Math.sin(a) * 0.4);
    leaf.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(leaf);
  }
  return g;
}

// Terracotta mesa: stacked, shrinking rock slabs.
function mesa(w, h, { seed = 4 } = {}) {
  const g = new THREE.Group();
  const rand = (n) => { const v = Math.sin(seed * 55.5 + n * 12.9) * 43758.5453; return v - Math.floor(v); };
  const colors = [0xb5654a, 0xc07a52, 0xa8563e];
  let y = 0;
  const slabs = 3 + Math.floor(rand(0) * 2);
  for (let i = 0; i < slabs; i++) {
    const sh = h / slabs;
    const k = 1 - i * 0.14;
    g.add(box(w * k * (0.9 + rand(i) * 0.2), sh * 1.05, w * 0.8 * k, M(colors[i % 3], { roughness: 1 }),
      (rand(i + 9) - 0.5) * 1.5, y + sh / 2, (rand(i + 19) - 0.5) * 1.5));
    y += sh;
  }
  return g;
}

// Natural rock arch straddling the road: legs clear of the car corridor,
// lintel high enough to drive under.
function rockArch() {
  const g = new THREE.Group();
  const rockM = M(0xb5654a, { roughness: 1 });
  const l = box(2.6, 11, 2.4, rockM, -11, 5.5, 0);
  l.rotation.z = 0.08;
  const r = box(2.6, 11, 2.4, rockM, 11, 5.5, 0);
  r.rotation.z = -0.08;
  const top = box(25, 2.8, 2.6, rockM, 0, 11.6, 0);
  top.rotation.z = 0.03;
  g.add(l, r, top);
  return g;
}

function gasStation() {
  const g = new THREE.Group();
  const cream = M(0xf0e2c8, { roughness: 0.9 });
  const red = M(0xcf3f2e, { roughness: 0.7 });
  g.add(box(5, 2.8, 3.4, cream, -1, 1.4, -1));                              // shop
  g.add(box(5.6, 0.3, 4, red, -1, 2.95, -1));                               // shop roof
  g.add(box(6.5, 0.25, 4.5, cream, 0.5, 3.6, 2.2));                         // canopy
  for (const s of [1, -1]) g.add(box(0.22, 3.6, 0.22, M(0x9a9aa4, { metalness: 0.4 }), 0.5 + s * 2.8, 1.8, 2.2));
  for (const s of [1, -1]) {                                                 // pumps
    g.add(box(0.7, 1.3, 0.5, red, 0.5 + s * 1.2, 0.65, 2.2));
    g.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), M(0xf6f1e4), 0.5 + s * 1.2, 1.5, 2.2));
  }
  const sign = canvasMat(256, 96, (ctx) => {
    ctx.fillStyle = '#f0e2c8';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#cf3f2e';
    ctx.font = '52px "Luckiest Guy", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PANA GAS', 128, 52);
  });
  g.add(mesh(new THREE.BoxGeometry(3.6, 1.4, 0.15), sign, -1, 4.2, 0.9));
  return g;
}

// Wooden signpost with a cow skull.
function skullSign() {
  const g = new THREE.Group();
  const wood = M(0x6b4226, { roughness: 0.95 });
  g.add(box(0.18, 2.6, 0.18, wood, 0, 1.3, 0));
  g.add(box(1.8, 0.4, 0.08, wood, 0.6, 2.2, 0));
  const skull = mesh(new THREE.SphereGeometry(0.32, 8, 6), M(0xf0ead8, { roughness: 0.8 }), -0.2, 2.75, 0);
  skull.scale.set(1, 0.85, 1.1);
  g.add(skull);
  for (const s of [1, -1]) {
    const horn = tube([s * 0.2 - 0.2, 2.8, 0], [s * 0.75 - 0.2, 3.05, 0], 0.07, M(0xe0d8c0, { roughness: 0.8 }));
    g.add(horn);
  }
  return g;
}

// Sunning iguana.
function iguana() {
  const g = new THREE.Group();
  const skin = M(0x7a9a4a, { roughness: 0.9 });
  const body = mesh(new THREE.SphereGeometry(0.4, 8, 6), skin, 0, 0.22, 0);
  body.scale.set(1, 0.55, 1.6);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.2, 7, 5), skin, 0, 0.25, 0.7));
  const tail = mesh(new THREE.ConeGeometry(0.12, 1.1, 6), skin, 0, 0.18, -0.95);
  tail.rotation.x = -Math.PI / 2;
  g.add(tail);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    g.add(box(0.09, 0.09, 0.3, skin, sx * 0.35, 0.08, sz * 0.35));
  }
  for (let i = 0; i < 4; i++) {
    g.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), M(0xd8c49a), 0, 0.45, 0.4 - i * 0.25));
  }
  return g;
}

// ---------- the track ----------
export default {
  id: 'desierto',
  name: 'Pana Desierto',
  blurb: "Cruza el cañón, rodea las mesas y vuelve por las curvas del oasis.",
  points: [[-72,42],[-28,56],[18,50],[65,40],[135,80],[200,75],[235,15],[195,-35],[120,-40],[110,-105],[170,-145],[160,-205],[85,-240],[0,-220],[-50,-160],[-38,-100],[-66,-60],[-95,-20]],
  rounded: true,
  sectors: [[0,"Pana Gas"],[0.23,"Cañón colorado"],[0.48,"Curvas del oasis"],[0.72,"Valle de las mesas"]],
  hw: 9,
  lineU: 0.06,
  ramps: [
    { u: 0.38, len: 9, h: 1.8, hw: 4.2 },
    { u: 0.82, len: 9, h: 2.2, hw: 4.2 },
  ],
  items: {
    boxes: [0.12, 0.31, 0.51, 0.72, 0.91],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.34, off: 0 },
      { u: 0.68, off: -4 },
      { u: 0.9, off: 4 },
    ],
  },
  walls: true,
  fence: {},
  palette: {
    horizon: 0xffd6a0,
    skyTop: 0x6fb7e8,
    hemiSky: 0xfff1d6,
    hemiGround: 0xc08a5a,
    hemiInt: 1.6,
    sun: 0xffd9a0,
    sunInt: 2.4,
    ground: 0xe8b57a,
    track: 0xb5763f,
    dune: 1.1,
    fog: [100, 420],
  },

  scenery(group, kit, T) {
    kit.routeLandscape(group,T,{seed:107,color:0xb96c48,tree:null,height:32});
    for (let i=0;i<9;i++) {
      const p=kit.placeOnTrack(T,T.TOTAL*(0.25+i*0.07),(i%2?1:-1)*(T.HW+37));
      if(Math.abs(T.offsetOf(p.x,p.z))<T.HW+24) continue;
      kit.at(group,mesa(23,18+i%3*6,{seed:i+40}),{...p,y:T.terrainAt(p.x,p.z)});
    }
    const { at } = kit;
    const center = { x: -5, z: 2 };

    // entrance: name sign + flag by the start line
    at(group, kit.mapSign(['Pana', 'Desierto']), kit.placeOnTrack(T, T.LINE - 16, T.HW + 8), Math.PI * 0.5);
    at(group, kit.flagPole({ h: 10 }), kit.placeOnTrack(T, T.LINE - 24, T.HW + 7));

    // mesa cluster inside the loop, watchtower on the tall one
    const mesaSpots = [
      { x: -30, z: 8, w: 22, h: 14, tower: true },
      { x: 8, z: 18, w: 16, h: 10 },
      { x: -12, z: -14, w: 13, h: 8 },
      { x: 30, z: -8, w: 18, h: 12 },
    ];
    for (const [i, m] of mesaSpots.entries()) {
      at(group, mesa(m.w, m.h, { seed: 10 + i }), { x: center.x + m.x, z: center.z + m.z });
      if (m.tower) at(group, kit.watchtower({ h: 5, roof: 'thatch' }), { x: center.x + m.x, z: center.z + m.z, y: m.h - 0.4 });
    }

    // rock arch straddling the road on the far bend (rotation.y = p.h puts
    // the arch's span across the road, perpendicular to travel)
    const archP = kit.placeOnTrack(T, T.TOTAL * 0.52, 0);
    at(group, rockArch(), archP, archP.h);

    // gas station + windmill on the outside of the home straight
    at(group, gasStation(), kit.placeOnTrack(T, T.TOTAL * 0.22, -(T.HW + 12)), Math.PI * 0.1);
    at(group, kit.windmill({ h: 9 }), kit.placeOnTrack(T, T.TOTAL * 0.3, -(T.HW + 10)));

    // oasis: pond, palms and a bridge over the water
    const oasis = { x: center.x + 42, z: center.z + 20 };
    at(group, kit.waterPond(13, 9), oasis);
    at(group, kit.bridge({ len: 16, w: 3 }), { x: oasis.x, z: oasis.z, y: 0.1 }, Math.PI / 3);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      at(group, kit.palm({ h: 6 + (i % 3), seed: 30 + i }), { x: oasis.x + Math.cos(a) * 15, z: oasis.z + Math.sin(a) * 11 });
    }

    // vegetation + rocks scattered off the road
    const avoid = [
      { x: center.x - 30, z: center.z + 8, r: 26 }, { x: center.x + 8, z: center.z + 18, r: 18 },
      { x: center.x - 12, z: center.z - 14, r: 15 }, { x: center.x + 30, z: center.z - 8, r: 20 },
      { x: oasis.x, z: oasis.z, r: 20 },
    ];
    for (const p of kit.scatter(T, { seed: 7, count: 73, min: T.HW + 4, max: T.HW + 26, avoid })) {
      at(group, saguaro({ h: 4 + p.k * 3.5, seed: 100 + p.s }), p, p.rot);
    }
    for (const p of kit.scatter(T, { seed: 8, count: 45, min: T.HW + 3.5, max: T.HW + 20, avoid })) {
      at(group, p.k > 0.5 ? barrelCactus({ seed: p.s }) : agave({ seed: p.s }), p, p.rot);
    }
    for (const p of kit.scatter(T, { seed: 9, count: 39, min: T.HW + 5, max: T.HW + 40, avoid })) {
      at(group, kit.rock(0.8 + p.k * 1.6, 0xa86048, p.s), p, p.rot);
    }

    // critters: iguanas on rocks, skull sign, zamuros circling overhead
    at(group, skullSign(), kit.placeOnTrack(T, T.TOTAL * 0.75, T.HW + 5), -0.4);
    const ig = kit.scatter(T, { seed: 11, count: 11, min: T.HW + 6, max: T.HW + 16, avoid });
    for (const p of ig) {
      const r = kit.rock(0.9, 0x9a6a50, p.s);
      at(group, r, p);
      at(group, iguana(), { x: p.x, z: p.z, y: 0.7 }, p.rot);
    }
    for (let i = 0; i < 2; i++) {
      const bird = kit.buildBird({ body: '#3a3430', wing: '#241f1c', beak: '#c9b98a', tail: '#241f1c', size: 1.6 });
      bird.flyCircle(group, { cx: center.x, cz: center.z, cy: 22 + i * 3, r: 20 + i * 6, speed: 0.25, phase: i * 3 });
    }

    at(group, kit.distantMountains({ r: Math.max(T.bounds.x,T.bounds.z) + 180, count: 9, color: 0xb0705a, seed: 12, hMin: 26, hMax: 55 }), { x: center.x, z: center.z });
  },
};
