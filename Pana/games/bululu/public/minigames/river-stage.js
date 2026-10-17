import { random } from '../online-rules.js';
// Shared bits for the river minigames: water, banks of selva and the four
// panas in their curiaras (the same canoe as Curiara).
import * as THREE from 'three';
import { makeBubble } from '/engine/fx.js';
import { createCanoe } from '/engine/models/vehicles/curiara.js';
import { waterSurface, waterAnimator } from '/engine/models/effects/water-surface.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { reeds } from '/engine/models/vegetation/reeds.js';
import { mangrove } from '/engine/models/vegetation/mangrove.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { rand } from './stage.js';

// A rectangle of flowing water, x in [-w/2, w/2], z in [z0, z1].
export function riverWater(scene, { w = 30, z0 = 20, z1 = -200, color = 0x4f6f3d, deep = 0x24331a, y = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(w, z0 - z1, 12, Math.ceil((z0 - z1) / 4)); geo.rotateX(-Math.PI / 2); geo.translate(0, y, (z0 + z1) / 2);
  const p = geo.attributes.position, flow = [];
  for (let i = 0; i < p.count; i++) flow.push(p.getX(i), -p.getZ(i));
  geo.setAttribute('waterFlow', new THREE.Float32BufferAttribute(flow, 2));
  const water = waterSurface(geo, { kind: 'river', color, depth: 2.5, amplitude: .02 });
  water.material.uniforms.deep.value.setHex(deep); water.material.uniforms.sky.value.setHex(0x8fa48c);
  scene.add(water);
  return waterAnimator(scene);
}

// Jungle banks along both sides of a straight reach.
export function riverBanks(scene, { half = 12, z0 = 20, z1 = -200, seed = 1 } = {}) {
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(80, z0 - z1 + 60), new THREE.MeshStandardMaterial({ color: 0x3f5f2c, roughness: 1 }));
  bank.rotation.x = -Math.PI / 2; bank.position.set(0, .35, (z0 + z1) / 2);
  for (const side of [-1, 1]) { const b = bank.clone(); b.position.x = side * (half + 40); scene.add(b); }
  const palms = [], rushes = [], roots = [];
  for (let z = z0; z > z1 - 20; z -= 5) for (const side of [-1, 1]) {
    rushes.push({ x: side * (half + rand(-.5, 1)), y: .1, z: z + rand(-2, 2), rot: rand(0, 6), scale: rand(.7, 1.1) });
    if (random() < .35) roots.push({ x: side * (half + rand(.5, 2)), y: .1, z: z + rand(-2, 2), rot: rand(0, 6), scale: rand(.7, 1) });
    if (random() < .45) palms.push({ x: side * (half + rand(4, 16)), y: .3, z: z + rand(-2, 2), rot: rand(0, 6), scale: rand(.8, 1.2) });
  }
  instancePlacements(scene, moriche({ seed, h: 11 }), palms, { name: 'Morichales', castShadow: false });
  instancePlacements(scene, reeds({ seed: seed + 1 }), rushes, { name: 'Juncos', castShadow: false });
  instancePlacements(scene, mangrove({ seed: seed + 2 }), roots, { name: 'Manglar', castShadow: false });
}

// One curiara per pana, in their player colour.
export function canoeActors(scene, players) {
  return players.map((p, i) => {
    const canoe = createCanoe([{ avatar: p.avatar }], p.color || '#e2683c');
    scene.add(canoe.group);
    const bubble = makeBubble(); scene.add(bubble.sprite);
    return { i, player: p, canoe, bubble, view: { paddle: null, capsized: 0, vy: 0, air: 0 }, cheer: 0 };
  });
}
// Draws a canoe at (x, y, z) facing `h`, paddling from `paddle` state.
export function drawCanoe(a, dt, time, { x, y = 0, z, h, paddle, capsized = 0, splashAt = -9, splashSide = 1 }) {
  a.canoe.group.position.set(x, y, z); a.canoe.group.rotation.y = h;
  Object.assign(a.view, { paddle, capsized, splashAt, splashSide });
  a.canoe.update(dt, a.view, time);
  if (a.cheer > 0) for (const pana of a.canoe.panas) pana.body.arms.forEach((arm, k) => arm.rotation.set(-2.7 + Math.sin(time * 9 + k) * .2, 0, k ? -.3 : .3));
  a.bubble.sprite.position.set(x, y + 3, z); a.bubble.update(dt);
}
