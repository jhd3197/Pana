// Canonical expedition models, shared by Reliquia and Studio. Metres, +Y up.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
const material = (color, extra = {}) => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  m.userData.reliquiaOwned = true; return m;
};
function part(parent, geometry, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
const box = (g, mat, w, h, d, x, y, z) => part(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const ring = (g, mat, r, tube, x, y, z) => part(g, new THREE.TorusGeometry(r, tube, 5, 16), mat, x, y, z);
export function mummy({ guardian = false } = {}) {
  const group = new THREE.Group(); group.name = guardian ? 'Guardián del sol' : 'Momia del templo';
  const cloth = material(guardian ? 0xbba981 : 0xd6c49b), band = material(0x9c8d6f), dark = material(0x263a35), gold = material(0xc49b4f, { metalness: 0.55 }), jade = material(0x70e2bd, { emissive: 0x269d7c, emissiveIntensity: 1 });
  const torso = new THREE.Group(); torso.position.y = 1.25; group.add(torso);
  part(torso, new THREE.CylinderGeometry(0.48, 0.36, 1.1, 9), cloth, 0, 0.1, 0);
  for (let i = 0; i < 8; i++) { const r = ring(torso, i % 3 ? cloth : band, 0.4 + i * 0.009, 0.044, 0, -0.38 + i * 0.13, 0); r.rotation.x = Math.PI / 2 + (i % 2 ? 0.06 : -0.06); r.scale.y = 0.8; }
  const head = new THREE.Group(); head.position.y = 0.97; torso.add(head);
  part(head, new THREE.SphereGeometry(0.42, 12, 9), cloth, 0, 0, 0).scale.set(0.88, 1.12, 0.86);
  box(head, dark, 0.64, 0.17, 0.11, 0, 0.08, 0.32);
  for (const s of [-1, 1]) part(head, new THREE.SphereGeometry(0.07, 8, 6), jade, s * 0.15, 0.09, 0.4);
  for (const y of [-0.24, -0.11, 0.24, 0.36]) { const r = ring(head, y < 0 ? band : cloth, 0.35, 0.037, 0, y, 0); r.rotation.x = Math.PI / 2; r.scale.y = 0.87; }
  const limbs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 0.55, 0.52, 0); torso.add(arm); limbs.push(arm);
    part(arm, new THREE.CylinderGeometry(0.16, 0.12, 0.94, 7), cloth, 0, -0.43, 0);
    for (let i = 0; i < 5; i++) { const r = ring(arm, band, 0.145, 0.025, 0, -i * 0.18, 0); r.rotation.x = Math.PI / 2; }
    part(arm, new THREE.SphereGeometry(0.17, 8, 6), cloth, 0, -0.96, 0.06);
    const leg = new THREE.Group(); leg.position.set(s * 0.23, 0.85, 0); group.add(leg); limbs.push(leg);
    part(leg, new THREE.CylinderGeometry(0.18, 0.14, 0.7, 7), cloth, 0, -0.31, 0);
    box(leg, band, 0.34, 0.2, 0.48, 0, -0.75, 0.09);
    for (let i = 0; i < 4; i++) { const r = ring(leg, band, 0.17, 0.024, 0, -i * 0.18, 0); r.rotation.x = Math.PI / 2; }
  }
  const sash = box(torso, band, 0.16, 1.25, 0.07, 0.12, 0.1, 0.43); sash.rotation.z = -0.4;
  if (guardian) {
    group.scale.setScalar(1.7);
    const collar = ring(torso, gold, 0.49, 0.13, 0, 0.62, 0); collar.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { box(head, gold, 0.18, 0.93, 0.4, s * 0.44, 0.05, 0); box(torso, gold, 0.3, 0.3, 0.65, s * 0.63, 0.48, 0); }
    box(head, gold, 1.1, 0.18, 0.55, 0, 0.47, 0);
    part(head, new THREE.OctahedronGeometry(0.18), jade, 0, 0.68, 0);
  }
  // Batch each rigid part independently so animation keeps its pivots without
  // paying one draw call for every wrap of cloth on every enemy.
  for (const pivot of [group, torso, head, ...limbs]) {
    const rigid = new THREE.Group();
    for (const child of [...pivot.children]) if (child.isMesh) rigid.add(child);
    if (!rigid.children.length) continue;
    pivot.add(bake(rigid)); rigid.traverse(o => o.geometry?.dispose());
  }
  group.userData.animate = (t, moving = true, winding = false) => {
    torso.rotation.z = Math.sin(t * 2.2) * 0.035; head.rotation.y = Math.sin(t) * 0.1;
    limbs.forEach((limb, i) => { limb.rotation.x = winding ? (i % 2 === 0 ? -2.3 : 0) : (i % 2 === 0 ? -0.6 : 0) + (moving ? Math.sin(t * 6 + (i < 2 ? 0 : Math.PI)) * 0.35 : 0); });
  };
  group.userData.tick = t => group.userData.animate(t);
  return group;
}
export function sunRelic() {
  const g = new THREE.Group(); g.name = 'Reliquia del sol';
  const gold = material(0xe6b65d, { metalness: 0.7, roughness: 0.3 }), jade = material(0x76e5c8, { metalness: 0.25, emissive: 0x1e785e, emissiveIntensity: 0.6 });
  ring(g, gold, 0.66, 0.11, 0, 0.85, 0);
  part(g, new THREE.OctahedronGeometry(0.43), jade, 0, 0.85, 0);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const ray = part(g, new THREE.ConeGeometry(0.12, 0.4, 4), gold, Math.sin(a) * 0.91, 0.85 + Math.cos(a) * 0.91, 0); ray.rotation.z = -a; }
  box(g, gold, 0.44, 0.14, 0.34, 0, 0.05, 0);
  return g;
}
export function expeditionWinch() {
  const g = new THREE.Group(); g.name = 'Rueda del templo';
  const stone = material(0x5c7465), gold = material(0xbc9858, { metalness: 0.4 }), wood = material(0x574533);
  box(g, stone, 1.7, 0.3, 1.4, 0, 0.15, 0); box(g, stone, 0.8, 1.3, 0.7, 0, 0.8, 0);
  const wheel = new THREE.Group(); wheel.position.set(0, 1.55, 0.5); g.add(wheel);
  ring(wheel, gold, 0.68, 0.1, 0, 0, 0);
  for (let i = 0; i < 6; i++) { const spoke = box(wheel, wood, 0.1, 1.3, 0.1, 0, 0, 0); spoke.rotation.z = i * Math.PI / 3; }
  part(wheel, new THREE.SphereGeometry(0.18, 8, 6), gold);
  g.userData.wheel = wheel; return g;
}
export function expeditionLantern() {
  const g = new THREE.Group(); g.name = 'Farol de expedición';
  const metal = material(0x3a3a2d, { metalness: 0.5 }), glow = material(0xffd88b, { emissive: 0xffa83c, emissiveIntensity: 1.5 });
  part(g, new THREE.CylinderGeometry(0.18, 0.22, 0.09, 8), metal, 0, 0.05, 0);
  part(g, new THREE.CylinderGeometry(0.14, 0.17, 0.32, 8), glow, 0, 0.25, 0);
  part(g, new THREE.ConeGeometry(0.23, 0.16, 8), metal, 0, 0.5, 0);
  for (const s of [-1, 1]) box(g, metal, 0.025, 0.39, 0.025, s * 0.16, 0.27, 0);
  ring(g, metal, 0.13, 0.025, 0, 0.64, 0); return g;
}
