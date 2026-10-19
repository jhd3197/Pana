// Blue morpho butterflies drifting over a jungle stream. A few wing pairs
// share one material; userData.tick(t) flaps and loops them around the
// origin. Metres; the swarm floats about 1–3 m above y = 0.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

function wingGeometry() {
  // One forewing and hindwing on +X, hinged on the Z axis.
  const s = new THREE.Shape();
  s.moveTo(0, .02); s.bezierCurveTo(.08, .16, .22, .17, .25, .08); s.bezierCurveTo(.26, .02, .2, -.02, .12, -.03);
  s.bezierCurveTo(.2, -.07, .2, -.17, .1, -.18); s.bezierCurveTo(.04, -.17, .01, -.08, 0, -.05);
  const geo = new THREE.ShapeGeometry(s, 6); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    // Iridescent blue that darkens to a black rim.
    c.setHex(0x2a7fe0).lerp(new THREE.Color(0x69d4ff), Math.max(0, .5 - r * 1.6)).lerp(new THREE.Color(0x111a2a), THREE.MathUtils.smoothstep(r, .17, .26));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export function morphoSwarm({ seed = 7, count = 5, radius = 3 } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 24) throw new RangeError('count must be 1–24');
  const group = new THREE.Group(), random = rng(seed), wing = wingGeometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .4, metalness: .15, emissive: 0x0c2a55, emissiveIntensity: .35 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: .9 }), body = new THREE.CylinderGeometry(.012, .008, .16, 5); body.rotateX(Math.PI / 2);
  group.name = 'Mariposas morpho';
  const flies = Array.from({ length: count }, () => {
    const fly = new THREE.Group(), left = new THREE.Mesh(wing, mat), right = new THREE.Mesh(wing, mat);
    right.scale.x = -1; fly.add(left, right, new THREE.Mesh(body, bodyMat));
    group.add(fly);
    return { fly, left, right, phase: random() * 6.28, r: radius * (.4 + random() * .6), speed: .25 + random() * .35, y: 1 + random() * 2, flap: 9 + random() * 5 };
  });
  group.userData.tick = t => {
    for (const f of flies) {
      const a = t * f.speed + f.phase;
      f.fly.position.set(Math.cos(a) * f.r + Math.sin(a * 2.3) * .4, f.y + Math.sin(t * 1.7 + f.phase) * .35, Math.sin(a * 1.3) * f.r);
      f.fly.rotation.y = -a + Math.PI / 2;
      const beat = Math.sin(t * f.flap + f.phase) * .9 + .2;
      f.left.rotation.z = beat; f.right.rotation.z = -beat;
    }
  };
  group.userData.tick(0);
  group.userData.dispose = () => { wing.dispose(); body.dispose(); mat.dispose(); bodyMat.dispose(); };
  return group;
}

// The same morphos for whole roadsides: every butterfly in one instanced
// draw for wings and one for bodies. points: [{x, y, z}] hover centres.
export function morphoField({ points = [], seed = 7, radius = 2.2, scale = 1 } = {}) {
  const random = rng(seed), group = new THREE.Group(), wing = wingGeometry(), n = Math.max(1, points.length);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .4, metalness: .15, emissive: 0x0c2a55, emissiveIntensity: .35 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: .9 }), body = new THREE.CylinderGeometry(.012, .008, .16, 5); body.rotateX(Math.PI / 2);
  const wings = new THREE.InstancedMesh(wing, mat, n * 2), bodies = new THREE.InstancedMesh(body, bodyMat, n);
  wings.count = points.length * 2; bodies.count = points.length;
  // Decorative: never block camera, item or clearance rays.
  for (const m of [wings, bodies]) { m.frustumCulled = false; m.castShadow = false; m.raycast = () => {}; group.add(m); }
  group.name = 'Mariposas morpho · campo';
  const flies = points.map(p => ({ p, phase: random() * 6.28, r: radius * (.4 + random() * .6), speed: .25 + random() * .35, y: 1 + random() * 2, flap: 9 + random() * 5 }));
  const o = new THREE.Object3D(), w = new THREE.Object3D(), m = new THREE.Matrix4();
  group.userData.tick = t => {
    flies.forEach((f, i) => {
      const a = t * f.speed + f.phase;
      o.position.set(f.p.x + Math.cos(a) * f.r + Math.sin(a * 2.3) * .4, f.p.y + f.y + Math.sin(t * 1.7 + f.phase) * .35, f.p.z + Math.sin(a * 1.3) * f.r);
      o.rotation.y = -a + Math.PI / 2; o.scale.setScalar(scale); o.updateMatrix(); bodies.setMatrixAt(i, o.matrix);
      const beat = Math.sin(t * f.flap + f.phase) * .9 + .2;
      for (const s of [0, 1]) { w.rotation.z = s ? -beat : beat; w.scale.x = s ? -1 : 1; w.updateMatrix(); wings.setMatrixAt(i * 2 + s, m.multiplyMatrices(o.matrix, w.matrix)); }
    });
    wings.instanceMatrix.needsUpdate = bodies.instanceMatrix.needsUpdate = true;
  };
  group.userData.tick(0);
  group.userData.dispose = () => { wing.dispose(); body.dispose(); mat.dispose(); bodyMat.dispose(); };
  return group;
}
