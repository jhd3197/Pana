// Cave creatures for Reliquia's ruins, cartoon-sized for reading at a glance.
// +Z forward. Each has userData.tick(t) and its own materials (disposed by
// userData.dispose):
//   guacharo   the oilbird of the Venezuelan caves: brown, hooked beak, big
//              speckled wings that flap; flies, origin at its body centre.
//   caveSpider a fat orange-and-black spider with eight jointed legs that
//              scuttle; origin on the floor.
//   cuaima     a coiled bushmaster with a raised head; tick(t, strike) lunges.
import * as THREE from 'three';

function kit() {
  const owned = [], geometries = [];
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra }); owned.push(m); return m; };
  const part = (parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geometries.push(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m;
  };
  return { mat, part, dispose: () => { owned.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); } };
}

export function guacharo({ seed = 1 } = {}) {
  const k = kit(), g = new THREE.Group(); g.name = 'Guácharo';
  const brown = k.mat(0x8a4a24), light = k.mat(0xc98a52), beak = k.mat(0xf2c25a), eye = k.mat(0xfff0a0, { emissive: 0xffd040, emissiveIntensity: 1.6 }), spot = k.mat(0xfff6e0);
  const body = k.part(g, new THREE.SphereGeometry(.22, 14, 10), brown); body.scale.set(.9, .85, 1.35);
  k.part(g, new THREE.SphereGeometry(.15, 12, 10), brown, 0, .08, .24);
  k.part(g, new THREE.ConeGeometry(.05, .14, 8), beak, 0, .04, .4, Math.PI / 2 + .4);
  for (const s of [-1, 1]) k.part(g, new THREE.SphereGeometry(.045, 8, 6), eye, s * .08, .13, .34);
  k.part(g, new THREE.ConeGeometry(.13, .32, 6), light, 0, -.02, -.36, -Math.PI / 2);
  const wings = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(s * .14, .06, 0); g.add(pivot);
    const shape = new THREE.Shape(); shape.moveTo(0, -.18); shape.quadraticCurveTo(.5, -.25, .72, .02); shape.lineTo(.5, .06); shape.lineTo(.36, .02); shape.lineTo(.22, .1); shape.quadraticCurveTo(.1, .16, 0, .14); shape.closePath();
    const wing = k.part(pivot, new THREE.ShapeGeometry(shape), k.mat(0x6e3a1c, { side: THREE.DoubleSide }), 0, 0, 0, -Math.PI / 2, 0, 0); wing.scale.x = s;
    for (let i = 0; i < 4; i++) k.part(pivot, new THREE.SphereGeometry(.018, 6, 4), spot, s * (.2 + i * .12), .01, -.02 - i * .02);
    return pivot;
  });
  g.userData = { assetId: 'guacharo', previewBounds: [[-.8, -.3, -.6], [.8, .5, .6]],
    tick(t) { const flap = Math.sin(t * 14 + seed); wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (.2 + flap * .7); }); body.position.y = Math.sin(t * 14 + seed) * .03; },
    dispose: k.dispose };
  return g;
}

export function caveSpider({ seed = 1 } = {}) {
  const k = kit(), g = new THREE.Group(); g.name = 'Araña de la cueva';
  const black = k.mat(0x1e1622, { roughness: .5 }), orange = k.mat(0xff7a2a, { roughness: .5 }), eye = k.mat(0xff3d5a, { emissive: 0xff2040, emissiveIntensity: 1.5 });
  const body = new THREE.Group(); body.position.y = .32; g.add(body);
  const abdomen = k.part(body, new THREE.SphereGeometry(.3, 14, 10), black, 0, .06, -.32); abdomen.scale.set(1, .85, 1.15);
  for (let i = 0; i < 3; i++) k.part(body, new THREE.TorusGeometry(.2 - i * .05, .03, 6, 16), orange, 0, .2 - i * .04, -.32 - i * .08, Math.PI / 2 - .5);
  k.part(body, new THREE.SphereGeometry(.18, 12, 10), black, 0, 0, .05);
  for (const s of [-1, 1]) for (const r of [0, 1]) k.part(body, new THREE.SphereGeometry(.03 + r * .015, 6, 4), eye, s * (.05 + r * .05), .07 + r * .02, .2);
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const hip = new THREE.Group(); hip.position.set(s * .14, 0, .14 - i * .1); hip.rotation.y = s * (Math.PI / 2 - .5 + i * .35); body.add(hip);
    k.part(hip, new THREE.CylinderGeometry(.025, .03, .34, 6), black, 0, .1, .17, Math.PI / 2 - .7);
    const knee = new THREE.Group(); knee.position.set(0, .22, .33); hip.add(knee);
    k.part(knee, new THREE.CylinderGeometry(.018, .025, .45, 6), i % 2 ? orange : black, 0, -.2, .1, .4);
    legs.push({ hip, phase: i * 1.4 + (s > 0 ? Math.PI : 0) });
  }
  g.userData = { assetId: 'cave-spider', pace: 1, previewBounds: [[-.8, 0, -.8], [.8, .7, .7]],
    tick(t) { const pace = g.userData.pace; legs.forEach(l => { l.hip.rotation.x = Math.sin(t * 16 * pace + l.phase) * .25 * pace; }); body.position.y = .32 + Math.abs(Math.sin(t * 16 * pace)) * .02 * pace; },
    dispose: k.dispose };
  return g;
}

export function cuaima({ seed = 1 } = {}) {
  const k = kit(), g = new THREE.Group(); g.name = 'Cuaima';
  const skin = k.mat(0xc9963e, { roughness: .45 }), dark = k.mat(0x3a2414, { roughness: .5 }), belly = k.mat(0xf0dca0), eye = k.mat(0xffe24a, { emissive: 0xffb000, emissiveIntensity: 1.2 }), tongue = k.mat(0xe0304a);
  // Three coils of tube on the floor, then a neck rising to the head.
  const points = [];
  for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 5, r = .45 - i / 60 * .2; points.push(new THREE.Vector3(Math.cos(a) * r, .1 + i / 60 * .12, Math.sin(a) * r)); }
  const coil = new THREE.CatmullRomCurve3(points);
  k.part(g, new THREE.TubeGeometry(coil, 80, .09, 8), skin);
  for (let i = 2; i < 60; i += 5) { const p = coil.getPointAt(i / 60); k.part(g, new THREE.SphereGeometry(.07, 6, 4), dark, p.x, p.y + .06, p.z).scale.set(1, .4, 1.4); }
  const neck = new THREE.Group(); neck.position.set(.25, .2, .1); g.add(neck);
  k.part(neck, new THREE.CylinderGeometry(.075, .09, .5, 8), skin, 0, .22, 0, .25);
  const head = new THREE.Group(); head.position.set(0, .48, .1); neck.add(head);
  const skull = k.part(head, new THREE.SphereGeometry(.12, 12, 8), skin); skull.scale.set(1, .7, 1.4);
  k.part(head, new THREE.BoxGeometry(.16, .04, .2), belly, 0, -.05, .05);
  for (const s of [-1, 1]) k.part(head, new THREE.SphereGeometry(.03, 6, 4), eye, s * .08, .04, .1);
  const fork = k.part(head, new THREE.BoxGeometry(.02, .01, .14), tongue, 0, -.03, .2);
  g.userData = { assetId: 'cuaima', strike: 0, previewBounds: [[-.6, 0, -.6], [.6, .8, .7]],
    tick(t, strike = g.userData.strike) { neck.rotation.x = -strike * .9 + Math.sin(t * 2 + seed) * .06; neck.position.z = .1 + strike * .35; head.rotation.y = Math.sin(t * 1.5 + seed) * .2 * (1 - strike); fork.visible = Math.sin(t * 9) > .2; },
    dispose: k.dispose };
  return g;
}
