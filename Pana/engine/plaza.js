import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { bush } from '/engine/models/vegetation/bush.js';
import { bake } from '/engine/models/core/static-batch.js';
import { createPlazaProp, marketStall, streetLamp } from '/engine/models/props/plaza.js';
import { MAP_PROPS, STALLS, TREES } from '/engine/plaza-layout.js';
import { streetFoodKiosk, plazaClockTower, parkBench, streetlightPole } from '/engine/models/props/pueblo.js';
import { capybaraTopiary } from '/engine/models/props/monuments.js';

import { house, church, fountain } from '/engine/models/props/plaza-buildings.js';
export { house, plazaFountain } from '/engine/models/props/plaza-buildings.js';

export function createPlazaEnvironment({ cooking = false, clearance = () => true, town = false } = {}) {
  const scene = new THREE.Group();
  const additions=[],assetCounts={};
  const addDetail=(id,factory,x,z,radius,rotation=0)=>{
    if(!clearance(x,z,radius))return;
    const object=factory();object.position.set(x,0,z);object.rotation.y=rotation;
    object.userData.assetId=id;object.userData.footprintRadius=radius;
    scene.add(object);additions.push(object);assetCounts[id]=(assetCounts[id]||0)+1;
  };
  const staticGroup = new THREE.Group(), random = rng(32);
  const floor = mesh(new THREE.PlaneGeometry(town ? 64 : 170, town ? 54 : 170), M(0xc6b388)); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.08; staticGroup.add(floor);
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
    if (town && !clearance(side * 27, -17 + i * 8, 5)) continue;
    const o = house({ w: 7.5, h: 6 + (i % 3), color: [0xe8b65d, 0x73aaa5, 0xe7916d, 0xa7b87e, 0xe7c782][(i + (side + 1)) % 5], seed: i, label: i === 2 ? 'HECHO CON CARIÑO' : '' });
    o.position.set(side * 27, 0, -17 + i * 8); o.rotation.y = -side * Math.PI / 2; staticGroup.add(o);
  }
  // Low front garden wall preserves the overview and defines the south edge.
  if (!town) staticGroup.add(box(48, 0.8, 0.65, M(0xd7a77c), 0, 0.4, 20.1));
  for (let x = -22; x <= 22; x += 4) {
    if (town && !clearance(x, 20.2, 2)) continue;
    const o = bush({ seed: x + 30, flowers: true }); o.position.set(x, 0.6, 20.2); staticGroup.add(o);
  }
  const trees = cooking ? [[-21, -12], [22, 8], [-21, 12], [20, -15], [-9, -17], [16, 17]] : TREES;
  for (const [i, [x, z]] of trees.entries()) {
    if (!clearance(x, z, 2)) continue;
    const tree = i === 2 ? mangoTree({ h: 4.7, seed: 3 }) : palm({ h: 7 + i % 3, seed: 20 + i });
    tree.position.set(x, 0, z); staticGroup.add(tree);
    const bed = mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.2, 10), M(0xd49662), x, 0.05, z); staticGroup.add(bed);
  }
  const stalls = cooking ? [{ x: -17, z: -6, h: 0, seed: 1 }, { x: 17, z: -6, h: 0, seed: 2 }] : STALLS;
  for (const s of stalls) {
    if (!clearance(s.x, s.z, 3.5)) continue;
    const o = cooking ? streetFoodKiosk() : marketStall({ seed: s.seed, colors: s.seed === 2 ? [0x488e94, 0xf3dc9f] : [0xd95845, 0xf1bd45] });
    if(cooking)assetCounts['street-food-kiosk']=(assetCounts['street-food-kiosk']||0)+1;
    o.position.set(s.x, 0, s.z); o.rotation.y = s.h; staticGroup.add(o);
  }
  for (const p of MAP_PROPS) {
    if (!clearance(p.x, p.z, 1.8)) continue;
    if (cooking && Math.abs(p.x) < 16 && p.z > -16) continue;
    const o = createPlazaProp(p.type); o.position.set(p.x, 0, p.z); o.rotation.y = p.h; staticGroup.add(o);
  }
  for (const [i,[x, z]] of [[-19, -7], [19, 7], [-5, 7], [5, -7], [-20, 15], [20, -16]].entries()) {
    if (!clearance(x, z, 1)) continue;
    if (cooking && Math.abs(x) < 16) continue;
    const o = i%2?streetlightPole():streetLamp(); o.position.set(x, 0, z); staticGroup.add(o);
    if(i%2)assetCounts['streetlight-pole']=(assetCounts['streetlight-pole']||0)+1;
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
    if (town) continue; // The expanded pueblo supplies its own distant hills.
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
  const batch=bake(staticGroup),textures=new Set(),geometry=new Set();
  staticGroup.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material?.map?.isCanvasTexture)textures.add(o.material.map);});
  // The fountain's character has already been frozen into the batch.
  f.capy.dispose();geometry.forEach(g=>g.dispose());
  batch.userData.dispose=()=>textures.forEach(t=>t.dispose());scene.add(batch);
  // The south garden is outside both games' movement bounds. Town consumers
  // still supply road clearance, including the complete footprint of each prop.
  addDetail('plaza-clock-tower',plazaClockTower,town?-21:-23,town?17:24,2.4);
  for(const x of [-7,7])addDetail('park-bench',parkBench,x,22,1.6,Math.PI);
  for(const side of [-1,1])addDetail('capybara-topiary',capybaraTopiary,side*(town?16:13),town?18.2:23,2.2,Math.PI);
  scene.userData.assetCounts=assetCounts;
  // Animated water sparkles are kept outside the static batch.
  const sparkles = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const a = random() * Math.PI * 2, r = 1.3 + random() * 1.25;
    const dot = mesh(new THREE.SphereGeometry(0.035, 4, 3), M(0xe1ffed, { emissive: 0xa1e9df, emissiveIntensity: 0.4 }), Math.cos(a) * r, 0.8, Math.sin(a) * r);
    sparkles.add(dot);
  }
  scene.add(sparkles);
  if (cooking) sparkles.position.z = -11;
  return { group: scene, update(t) { additions.forEach(o=>o.userData.tick?.(t));sparkles.children.forEach((m, i) => { m.position.y = 0.85 + Math.abs(Math.sin(t * 2.1 + i)) * 0.3; }); } };
}

export function createPlaza(options = {}) {
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
  const environment = createPlazaEnvironment(options);
  scene.add(environment.group);
  return { scene, update: environment.update };
}
