import * as THREE from 'three';
import { M, mesh, box, tube, canvasMat, rng } from '/engine/props.js';
import { palm, mangoTree, bush, bake } from '/engine/flora.js';
import { createPlazaProp, marketStall, streetLamp } from '/engine/plaza-props.js';
import { buildCharacter } from '/engine/character.js';
import { MAP_PROPS, STALLS, TREES } from './plaza-layout.js';

function lettering(words, color = '#fff0ca', bg = '#387c82', w = 4, h = 1.1) {
  return mesh(new THREE.PlaneGeometry(w, h), canvasMat(768, 192, ctx => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(12, 12, 744, 168);
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 64px Nunito, sans-serif'; ctx.fillText(words, 384, 100, 710);
  }));
}

function house({ w = 7, h = 6, color = 0xe5b965, seed = 1, label = '' } = {}) {
  const g = new THREE.Group(), wall = M(color), trim = M(0xffe8b7), dark = M(0x51463d), tile = M(0xc76540);
  g.add(box(w, h, 5.4, wall, 0, h / 2, 0));
  g.add(box(w + 0.12, 0.45, 5.5, M(0xd2976e), 0, 0.225, 0));
  g.add(box(w + 0.35, 0.22, 5.7, trim, 0, h - 0.15, 0));
  for (const side of [-1, 1]) {
    const roof = box(w + 0.85, 0.22, 3.35, tile, 0, h + 0.45, side * 1.55);
    roof.rotation.x = side * 0.25;
    g.add(roof);
    for (let x = -w / 2 - 0.1; x < w / 2 + 0.4; x += 0.46) {
      const row = mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.38, 7, 1, true, 0, Math.PI), M((Math.round(x * 7) + seed) % 2 ? 0xd27b4c : 0xbc593a), x, h + 0.55, side * 1.55);
      row.rotation.x = Math.PI / 2 + side * 0.25;
      g.add(row);
    }
  }
  g.add(box(1.65, 2.8, 0.18, trim, 0, 1.4, 2.77));
  g.add(box(1.3, 2.55, 0.2, dark, 0, 1.28, 2.9));
  for (let x = -0.48; x < 0.6; x += 0.24) g.add(box(0.025, 2.4, 0.05, M(0x8c6644), x, 1.25, 3.02));
  for (const x of [-w * 0.31, w * 0.31]) {
    for (const y of (h > 6 ? [2.15, 5] : [2.5])) {
      g.add(box(1.35, 1.6, 0.14, trim, x, y, 2.77));
      g.add(box(1.02, 1.32, 0.18, dark, x, y, 2.88));
      for (const s of [-1, 1]) g.add(box(0.42, 1.45, 0.12, M(seed % 2 ? 0x477d80 : 0x985c40), x + s * 0.73, y, 2.92));
      g.add(box(1.55, 0.17, 0.5, trim, x, y - 0.82, 2.95));
      if (y > 3) {
        g.add(box(1.35, 0.38, 0.38, M(0xba624b), x, y - 0.62, 3.08));
        const flowers = bush({ seed, flowers: true }); flowers.scale.set(0.6, 0.5, 0.4); flowers.position.set(x, y - 0.45, 3.12); g.add(flowers);
      }
    }
  }
  if (label) { const sign = lettering(label, '#ffedb7', seed % 2 ? '#3b7474' : '#a04b36', w * 0.7, 0.85); sign.position.set(0, 3.9, 2.84); g.add(sign); }
  return g;
}

function church() {
  const g = house({ w: 8.5, h: 7.8, color: 0xf2c76e, seed: 3 });
  const tower = new THREE.Group(); tower.position.set(2.3, 7.8, -0.5);
  tower.add(box(3.3, 4.3, 3.3, M(0xf3cd83), 0, 1.7, 0));
  tower.add(box(3.65, 0.25, 3.65, M(0xffe3ae), 0, 3.8, 0));
  tower.add(mesh(new THREE.ConeGeometry(2.55, 2.1, 4), M(0xc76b44), 0, 4.9, 0));
  tower.rotation.y = 0;
  tower.add(box(1.35, 2, 0.05, M(0x5c503d), 0, 2.15, 1.68));
  tower.add(mesh(new THREE.CylinderGeometry(0.4, 0.65, 0.8, 10), M(0xa18442, { metalness: 0.4 }), 0, 2.15, 1.7));
  tower.add(box(0.18, 1.6, 0.18, M(0x86543d), 0, 6.5, 0));
  tower.add(box(1, 0.18, 0.18, M(0x86543d), 0, 6.65, 0));
  g.add(tower);
  const sign = lettering('PLAZA PANA', '#fff1cb', '#b26644', 4.6, 0.85); sign.position.set(-0.5, 5.2, 2.81); g.add(sign);
  return g;
}

function fountain() {
  const g = new THREE.Group(), stone = M(0xe5caa0), rim = M(0xf6dfb8);
  g.add(mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.3, 16), stone, 0, 0.15, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.88, 3.02, 0.55, 16), rim, 0, 0.46, 0));
  const water = mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.05, 32), M(0x47bec1, { metalness: 0.15, roughness: 0.25 }), 0, 0.76, 0); g.add(water);
  g.add(mesh(new THREE.CylinderGeometry(0.8, 1.05, 1.8, 8), stone, 0, 1.35, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.24, 12), rim, 0, 2.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.03, 24), M(0x69d2d0), 0, 2.44, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.65, 0.8, 1.2, 8), stone, 0, 2.9, 0));
  const capy = buildCharacter({ fur: '#e8b97f', hat: 'corona', glasses: 'none', outfit: 'nada', face: 'feliz' });
  capy.group.position.y = 3.5; capy.group.scale.setScalar(1.15); g.add(capy.group);
  const streams = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.cos(a) * 1.35, 2.4, Math.sin(a) * 1.35), new THREE.Vector3(Math.cos(a) * 2.2, 2.2, Math.sin(a) * 2.2), new THREE.Vector3(Math.cos(a) * 2.35, 0.8, Math.sin(a) * 2.35));
    streams.add(mesh(new THREE.TubeGeometry(curve, 10, 0.045, 4, false), M(0x91e5e1, { transparent: true, opacity: 0.75 })));
  }
  g.add(streams);
  return { group: g, streams, water };
}

export function createPlaza({ cooking = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9ed8ed);
  scene.fog = new THREE.Fog(0xc2dece, 55, 145);
  scene.add(new THREE.HemisphereLight(0xe6f6ff, 0xc98d62, 2));
  const sun = new THREE.DirectionalLight(0xffe1ab, 3.2);
  sun.position.set(-24, 38, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
  sun.shadow.camera.top = 32; sun.shadow.camera.bottom = -32; sun.shadow.camera.far = 100;
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0001;
  scene.add(sun);
  const staticGroup = new THREE.Group(), random = rng(32);
  const floor = mesh(new THREE.PlaneGeometry(170, 170), M(0xc6b388)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.08; staticGroup.add(floor);
  // Individual paving slabs give the plaza its warm, tactile scale.
  const stoneColors = [0xe3c58f, 0xe7c896, 0xeacf9e, 0xdabd8c, 0xedd2a3, 0xe5c094];
  for (let z = -22; z < 22; z += 1.5) for (let x = -26; x < 26; x += 2.25) {
    staticGroup.add(box(2.2, 0.08, 1.45, M(stoneColors[Math.floor(random() * stoneColors.length)]), x + (Math.round(z / 1.5) % 2) * 1.12, -0.02, z));
  }
  // The north facade and side streets frame a playable, open courtyard.
  const houses = [
    [-18, -23, 7, 7.3, 0xe3ad54, 'CAFÉ COCO'], [-10.5, -23, 7, 8.4, 0x5c9da7, 'BUENA GENTE'],
    [11, -23, 7, 7.3, 0xe79874, 'LA BODEGUITA'], [18.5, -23, 7, 8.6, 0x8ba776, 'MÁS PANAS'],
  ];
  for (const [i, [x, z, w, h, color, label]] of houses.entries()) {
    const o = house({ w, h, color, seed: i, label }); o.position.set(x, 0, z); staticGroup.add(o);
  }
  const chapel = church(); chapel.position.set(0, 0, -23); staticGroup.add(chapel);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const o = house({ w: 7.5, h: 6 + (i % 3), color: [0xe8b65d, 0x73aaa5, 0xe7916d, 0xa7b87e, 0xe7c782][(i + (side + 1)) % 5], seed: i, label: i === 2 ? 'HECHO CON CARIÑO' : '' });
    o.position.set(side * 27, 0, -17 + i * 8); o.rotation.y = -side * Math.PI / 2; staticGroup.add(o);
  }
  // Low front garden wall preserves the overview and defines the south edge.
  staticGroup.add(box(48, 0.8, 0.65, M(0xd7a77c), 0, 0.4, 20.1));
  for (let x = -22; x <= 22; x += 4) {
    const o = bush({ seed: x + 30, flowers: true }); o.position.set(x, 0.6, 20.2); staticGroup.add(o);
  }
  const trees = cooking ? [[-21, -12], [22, 8], [-21, 12], [20, -15], [-9, -17], [16, 17]] : TREES;
  for (const [i, [x, z]] of trees.entries()) {
    const tree = i === 2 ? mangoTree({ h: 4.7, seed: 3 }) : palm({ h: 7 + i % 3, seed: 20 + i });
    tree.position.set(x, 0, z); staticGroup.add(tree);
    const bed = mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.2, 10), M(0xd49662), x, 0.05, z); staticGroup.add(bed);
  }
  const stalls = cooking ? [{ x: -17, z: -6, h: 0, seed: 1 }, { x: 17, z: -6, h: 0, seed: 2 }] : STALLS;
  for (const s of stalls) {
    const o = marketStall({ seed: s.seed, colors: s.seed === 2 ? [0x488e94, 0xf3dc9f] : [0xd95845, 0xf1bd45] });
    o.position.set(s.x, 0, s.z); o.rotation.y = s.h; staticGroup.add(o);
  }
  for (const p of MAP_PROPS) {
    if (cooking && Math.abs(p.x) < 16 && p.z > -16) continue;
    const o = createPlazaProp(p.type); o.position.set(p.x, 0, p.z); o.rotation.y = p.h; staticGroup.add(o);
  }
  for (const [x, z] of [[-19, -7], [19, 7], [-5, 7], [5, -7], [-20, 15], [20, -16]]) {
    if (cooking && Math.abs(x) < 16) continue;
    const o = streetLamp(); o.position.set(x, 0, z); staticGroup.add(o);
  }
  // Bunting casts little triangular shadows across the market.
  for (const z of (cooking ? [-15] : [-10, 9])) {
    staticGroup.add(tube([-24, 8, z], [24, 8, z], 0.025, M(0x78634c)));
    for (let x = -23; x < 24; x += 1.5) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0.5, -1.25, 0], 3)); geo.computeVertexNormals();
      staticGroup.add(mesh(geo, M([0xe7614b, 0xf2c34d, 0x438a9f, 0xf3dfaa][Math.abs(Math.round(x * 2)) % 4], { side: THREE.DoubleSide }), x, 8 - Math.sin((x + 24) / 48 * Math.PI) * 0.4, z));
    }
  }
  for (let i = 0; i < 17; i++) {
    const mountain = mesh(new THREE.IcosahedronGeometry(1, 2), M(i % 2 ? 0x699b88 : 0x7398a3, { flatShading: false }), -120 + i * 16, -3, -78 - random() * 22);
    mountain.scale.set(17 + random() * 10, 13 + random() * 17, 12 + random() * 8);
    mountain.rotation.y = random() * 4; staticGroup.add(mountain);
  }
  for (const [x, y, z] of [[-43, 34, -66], [35, 39, -80], [71, 29, -64], [-7, 43, -100]]) {
    for (let j = 0; j < 5; j++) {
      const cloud = mesh(new THREE.SphereGeometry(3.1 + random() * 1.3, 10, 7), M(0xf1f2e9, { flatShading: false }), x + j * 3.8, y + Math.sin(j) * 1.6, z);
      cloud.scale.set(1.35, 0.65, 0.85); cloud.castShadow = false; staticGroup.add(cloud);
    }
  }
  const f = fountain(); if (cooking) f.group.position.z = -11; staticGroup.add(f.group);
  scene.add(bake(staticGroup));
  // Animated water sparkles are kept outside the static batch.
  const sparkles = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const a = random() * Math.PI * 2, r = 1.3 + random() * 1.25;
    const dot = mesh(new THREE.SphereGeometry(0.035, 4, 3), M(0xe1ffed, { emissive: 0xa1e9df, emissiveIntensity: 0.4 }), Math.cos(a) * r, 0.8, Math.sin(a) * r);
    sparkles.add(dot);
  }
  scene.add(sparkles);
  if (cooking) sparkles.position.z = -11;
  return { scene, update(t) { sparkles.children.forEach((m, i) => { m.position.y = 0.85 + Math.abs(Math.sin(t * 2.1 + i)) * 0.3; }); } };
}
