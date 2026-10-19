// Where the rueda plays: the beach by the pink shack in the sun, or the
// malecón at night under string lights. Everything placed here comes from the
// shared model library (engine/models) or the tambor set (rueda-set.js).
// The rueda itself (center at the origin, radius RING) stays clear.
import * as THREE from 'three';
import { WARM_DAY } from '/engine/look.js';
import { smoothstep, rng } from '/engine/random.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { beachShade, driftwood } from '/engine/models/props/beach.js';
import { fishingBoat } from '/engine/models/props/coastal.js';
import { buntingLine } from '/engine/models/props/fiesta.js';
import { streetLamp } from '/engine/models/props/plaza.js';
import { waterSurface, waterAnimator } from '/engine/models/effects/water-surface.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { createPinkShack, createStringLights, createMural, createRuedaRing } from './rueda-set.js';

export const RING = 3.4;
export const PLACES = {
  playa: { name: 'La casita rosada', night: false },
  malecon: { name: 'El malecón de noche', night: true },
};
// Light for each place: hemisphere, key light (sun or moon), sky, exposure.
export const LIGHTS = {
  playa: { background: WARM_DAY.background, fog: [45, 120], hemi: ['#fff3da', '#c08a5a', 2.1], key: ['#ffd9a0', 3.1], keyAt: [-12, 22, 10],
    sky: WARM_DAY.sky, daylight: 1, exposure: WARM_DAY.exposure },
  malecon: { background: '#141a3a', fog: [30, 95], hemi: ['#6f80c8', '#2a2034', 1.1], key: ['#a9bcff', 1.1], keyAt: [14, 20, -8],
    sky: { skyTop: '#0c1638', horizon: '#3b3166', cloudCover: .25, sunDisc: false }, daylight: .1, exposure: 1.2 },
};

function place(group, object, x, z, { y = 0, angle = 0, scale = 1 } = {}) {
  object.position.set(x, y, z); object.rotation.y = angle; object.scale.multiplyScalar(scale);
  object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(object); return object;
}

// Sand that slopes into the sea behind the rueda (day), or a paved malecón
// that ends in a seawall (night). Vertex colours: dry sand to wet sand.
function ground(night) {
  const geometry = new THREE.PlaneGeometry(160, 100, 80, 50).rotateX(-Math.PI / 2), p = geometry.attributes.position, colors = [];
  const dry = new THREE.Color(night ? '#9b927f' : '#f4dcaa'), wet = new THREE.Color(night ? '#7b7466' : '#d2b47c'), c = new THREE.Color(), r = rng(5);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), shore = night ? 0 : smoothstep((-10 - z) / 7);
    p.setY(i, night ? (z < -9 ? -2.4 : 0) : -shore * 1.5 + (r() - .5) * .04 * (1 - shore));
    c.copy(dry).lerp(wet, night ? (Math.abs(Math.round(x / 2) + Math.round(z / 2)) % 2) * .35 : shore * .9 + r() * .06);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true; mesh.name = night ? 'Malecón' : 'Arena';
  return mesh;
}

export function buildPlace(id) {
  const night = PLACES[id]?.night ?? false, group = new THREE.Group(), lights = [];
  group.name = PLACES[id]?.name ?? 'Playa';
  group.add(ground(night));
  const sea = waterSurface(new THREE.PlaneGeometry(420, 220, 70, 36).rotateX(-Math.PI / 2), { kind: 'sea', amplitude: .08, color: night ? '#1f4f74' : '#3fb7c4' });
  sea.position.set(0, night ? -1.7 : -.5, -122); group.add(sea);
  place(group, createRuedaRing({ radius: RING }), 0, 0);
  // The pink shack sits off to the left, behind the drums.
  place(group, createPinkShack({ night }), -9.2, -5.8, { angle: .5 });
  const palms = [[-13, -2, 7.5, 1], [-12.5, -9, 8.5, 2], [10.5, -7.5, 8, 3], [12.5, -1.5, 7, 4], [-14.5, 5, 6.5, 5], [14, 6, 7.5, 6], [6.5, -11, 9, 7]];
  for (const [x, z, h, seed] of palms) place(group, palm({ h, seed }), x, z);
  const bunting = buntingLine({ span: 15, seed: 3, height: 4.4 });
  place(group, bunting, 0, -6.8, { angle: Math.PI / 2 });
  if (!night) {
    place(group, beachShade(0xff6f61), 9.5, 3.5, { angle: -.5 });
    place(group, beachShade(0x2fb5c9), 11.5, -3.8, { angle: -.9 });
    place(group, driftwood(), 6, -9.3, { angle: .4 });
    place(group, driftwood(), -5, -10.5, { angle: -.8 });
    place(group, fishingBoat({ color: 0xe8402f }), -16, -30, { y: -.55, angle: .6 });
    place(group, fishingBoat({ color: 0x2f6fd6 }), 20, -46, { y: -.55, angle: -.3 });
  } else {
    // The seawall and its railing, lamps along the edge.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(160, 2.4, .7), new THREE.MeshStandardMaterial({ color: '#c9bfae', roughness: .9 }));
    wall.position.set(0, -1.2, -9.3); wall.receiveShadow = true; group.add(wall);
    const rail = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: .5 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(60, .09, .09), rail); top.position.set(0, 1, -9); group.add(top);
    for (let x = -30; x <= 30; x += 1.5) { const post = new THREE.Mesh(new THREE.BoxGeometry(.07, 1, .07), rail); post.position.set(x, .5, -9); group.add(post); }
    for (const x of [-15, -8, 8, 15]) {
      place(group, streetLamp(), x, -8.3);
      const glow = new THREE.PointLight('#ffc27a', 9, 12, 2); glow.position.set(x, 3.9, -8); group.add(glow); lights.push(glow);
    }
    place(group, createMural({ title: 'CHORONÍ' }), -11, 1.5, { angle: Math.PI / 2 - .35 });
    // String lights fan out from two poles behind the drums to the palms at the sides.
    for (const [z, span] of [[-6.2, 17], [-1.4, 19]]) place(group, createStringLights({ span, sag: 1, bulbs: 24 }), 0, z, { y: 5.6 });
    for (const x of [-8.5, 8.5]) for (const z of [-6.2, -1.4]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 5.7, 8), new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: .6 }));
      pole.position.set(x * (z === -1.4 ? 1.12 : 1), 2.85, z); group.add(pole);
    }
    for (const x of [-3.2, 3.2]) { const warm = new THREE.PointLight('#ffcf8a', 26, 18, 2); warm.position.set(x, 4.6, .4); group.add(warm); lights.push(warm); }
  }
  const tickWater = waterAnimator(group);
  return {
    group, night, lights,
    tick(t) { tickWater(t); },
    dispose() {
      const owners = []; group.traverse(o => { if (o !== group && o.userData.dispose) owners.push(o); });
      owners.forEach(o => o.userData.dispose()); disposeModel(group); group.removeFromParent();
    },
  };
}
