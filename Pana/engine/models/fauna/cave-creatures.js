// Cave creatures for Reliquia's ruins, cartoon-sized for reading at a glance.
// +Z forward. Each has userData.tick(t) and its own materials (disposed by
// userData.dispose):
//   caveBat    a dark furry bat with big ears and leathery wings that flutter in
//              stuttering bursts; flies, origin at its body centre; hangs asleep.
//   caveSpider a fat orange-and-black spider with eight jointed legs that
//              scuttle; origin on the floor.
//   cuaima     a coiled bushmaster with a raised head; tick(t, strike) lunges.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function kit() {
  const owned = [], geometries = [];
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .7, ...extra }); owned.push(m); return m; };
  const part = (parent, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    geometries.push(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m;
  };
  return { mat, part, dispose: () => { owned.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); } };
}

// A roost's worth of bats folded on the ceiling, far cheaper than caveBat: one
// instanced draw at any count, nothing that flaps. userData.place(list) hangs
// them at { x, y, z, h, s }; y is the ceiling they hang from.
export function batColony({ count = 24, spread = 1.4, seed = 1 } = {}) {
  const k = kit(), g = new THREE.Group(); g.name = 'Colonia de murciélagos';
  const parts = [new THREE.SphereGeometry(.13, 7, 5).scale(1, 1.55, .8).translate(0, -.2, 0), new THREE.ConeGeometry(.15, .34, 6).scale(1, 1, .45).translate(0, -.26, -.04)];
  for (const s of [-1, 1]) parts.push(new THREE.ConeGeometry(.04, .12, 4).translate(s * .06, -.42, .02).rotateZ(s * .2));
  const flat = parts.map(p => p.index ? p.toNonIndexed() : p), geometry = mergeGeometries(flat, false), bats = new THREE.InstancedMesh(geometry, k.mat(0x2b2029, { roughness: .95, flatShading: true }), count);
  parts.forEach(p => p.dispose()); flat.forEach(p => p.dispose()); bats.frustumCulled = false; bats.count = 0; g.add(bats);
  const o = new THREE.Object3D();
  g.userData = {
    place(list) {
      bats.count = Math.min(count, list.length);
      for (let i = 0; i < bats.count; i++) { const b = list[i]; o.position.set(b.x, b.y, b.z); o.rotation.set(0, b.h || 0, 0); o.scale.setScalar(b.s || 1); o.updateMatrix(); bats.setMatrixAt(i, o.matrix); }
      bats.instanceMatrix.needsUpdate = true;
    },
    dispose: () => { k.dispose(); geometry.dispose(); bats.dispose(); },
  };
  // On its own (Studio) it shows a little colony hanging from nothing.
  const list = []; let n = seed; for (let i = 0; i < Math.min(count, 24); i++) { const a = (n += 2.4), r = Math.sqrt(i) * spread * .25; list.push({ x: Math.cos(a) * r, y: 1.2, z: Math.sin(a) * r, h: a * 3, s: .9 + (i % 4) * .1 }); }
  g.userData.place(list);
  return g;
}

// The body is one merged, vertex-coloured mesh and each wing two panels: six
// draws, so a flock stays cheap. Set userData.hang to fold it up on the ceiling.
export function caveBat({ seed = 1 } = {}) {
  const k = kit(), g = new THREE.Group(); g.name = 'Murciélago';
  const fur = 0x120d14, chest = 0x1d1518, skin = 0x0c080c, ear = 0x24151a, tooth = 0x8a8476;
  const pieces = [], paint = (geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    const shape = geometry.applyMatrix4(o.matrix), flat = shape.index ? shape.toNonIndexed() : shape, c = new THREE.Color(color), n = flat.attributes.position.count, colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    flat.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(flat);
  };
  paint(new THREE.SphereGeometry(.17, 10, 8), fur, 0, 0, 0, 0, 0, 0, .95, .9, 1.25);
  paint(new THREE.SphereGeometry(.12, 8, 6), chest, 0, -.05, .06, 0, 0, 0, 1, .9, 1.1);
  paint(new THREE.SphereGeometry(.115, 10, 8), fur, 0, .07, .2);
  paint(new THREE.ConeGeometry(.05, .1, 6), skin, 0, .05, .31, Math.PI / 2);
  for (const s of [-1, 1]) {
    paint(new THREE.ConeGeometry(.055, .2, 5), ear, s * .08, .23, .17, -.1, 0, s * -.28, 1, 1, .45);
    paint(new THREE.ConeGeometry(.009, .04, 4), tooth, s * .028, -.015, .3, Math.PI);
    paint(new THREE.ConeGeometry(.026, .14, 5), fur, s * .05, -.13, -.17, -Math.PI / 2 - .25);
  }
  const merged = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose());
  const bodyMat = k.mat(0xffffff, { vertexColors: true, roughness: .95 }), body = k.part(g, merged, bodyMat);
  // Two small lit eyes, one draw.
  const eyes = mergeGeometries([-1, 1].map(s => new THREE.SphereGeometry(.018, 6, 5).translate(s * .05, .1, .3)), false);
  k.part(g, eyes, k.mat(0x402008, { emissive: 0xff8a18, emissiveIntensity: 1.6 }));
  const skinMat = k.mat(0x170f18, { side: THREE.DoubleSide, roughness: .85 });
  const panel = points => { const shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]); for (let i = 1; i < points.length; i += 2) shape.quadraticCurveTo(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]); return new THREE.ShapeGeometry(shape); };
  // The membrane scallops between long finger bones: inner panel at the shoulder,
  // outer panel on a joint halfway, so a beat folds like a hand, not a board.
  const wings = [-1, 1].map(s => {
    const shoulder = new THREE.Group(); shoulder.position.set(s * .13, .05, .02); g.add(shoulder);
    const inner = k.part(shoulder, panel([[0, .14], [.2, .2], [.36, .14], [.34, .03], [.36, -.14], [.2, -.1], [.12, -.2], [.05, -.1], [0, -.16]]), skinMat, 0, 0, 0, -Math.PI / 2); inner.scale.x = s;
    const elbow = new THREE.Group(); elbow.position.x = s * .36; shoulder.add(elbow);
    const outer = k.part(elbow, panel([[0, .14], [.28, .22], [.46, .02], [.3, -.01], [.28, -.13], [.14, -.07], [0, -.14]]), skinMat, 0, 0, 0, -Math.PI / 2); outer.scale.x = s;
    return { shoulder, elbow, s };
  });
  g.userData = { assetId: 'cave-bat', hang: false, previewBounds: [[-.85, -.3, -.3], [.85, .35, .4]],
    tick(t) {
      const hang = g.userData.hang;
      if (hang) {
        // Asleep upside down, wrapped in its own wings, breathing.
        g.rotation.x = Math.PI; body.position.y = Math.sin(t * 1.4 + seed) * .004;
        for (const w of wings) { w.shoulder.rotation.z = w.s * -1.25; w.elbow.rotation.z = w.s * -2.3; }
        return;
      }
      g.rotation.x = 0;
      // Not a steady beat: bursts of flutter that stutter and catch, a glide now and then.
      const warp = t * 21 + Math.sin(t * 5.3 + seed) * 1.6 + Math.sin(t * 2.1 + seed * 2) * 1.2, glide = Math.max(0, Math.sin(t * .9 + seed)) ** 6, beat = Math.sin(warp) * (1 - glide * .8);
      for (const w of wings) { w.shoulder.rotation.z = w.s * (.12 + beat * .75); w.elbow.rotation.z = w.s * (.22 - Math.cos(warp) * .55 * (1 - glide * .8)); }
      body.position.y = -beat * .025; g.rotation.z = Math.sin(t * 7.7 + seed) * .22;
    },
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
