// Tonina: the pink river dolphin of the Orinoco and Amazonas (Inia).
// About 2.2 m long, +Z forward, origin at the middle of the body.
// userData.swim(t) flexes the fluke; games move and arc the whole group.
import * as THREE from 'three';

function painted(geo, paint) {
  const p = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { paint(c, p.getX(i), p.getY(i), p.getZ(i)); colors.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

export function tonina({ seed = 7, pink = .8 } = {}) {
  if (!(pink >= 0 && pink <= 1)) throw new RangeError('pink must be 0–1');
  const group = new THREE.Group(); group.name = 'Tonina';
  const back = new THREE.Color(0x8f8792), blush = new THREE.Color(0xe79aa6).lerp(new THREE.Color(0xf0b9c0), (seed % 5) / 8);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 });
  const skin = (c, x, y) => c.copy(back).lerp(blush, THREE.MathUtils.clamp(.35 + pink * .6 - y * 1.6, 0, 1));
  // Body: a long spindle with the melon high at the front and a flat belly.
  const body = new THREE.SphereGeometry(1, 24, 14), p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (z + 1) / 2;
    const r = Math.sin(Math.PI * Math.pow(t, .8)) * (.28 - .08 * (1 - t));
    p.setXYZ(i, x * r, y * r * (y < 0 ? .85 : 1.05) + (t > .78 ? (t - .78) * .35 : 0) * (y > 0 ? 1 : .4), z * 1.05);
  }
  group.add(new THREE.Mesh(painted(body, skin), mat));
  // The long, thin beak and the low dorsal ridge.
  const beak = new THREE.CylinderGeometry(.035, .07, .5, 10); beak.rotateX(Math.PI / 2); beak.translate(0, -.02, 1.22);
  group.add(new THREE.Mesh(painted(beak, c => c.copy(blush)), mat));
  const ridge = new THREE.ConeGeometry(.07, .2, 8); ridge.scale(1, 1, 3.2); ridge.translate(0, .27, -.15);
  group.add(new THREE.Mesh(painted(ridge, c => c.copy(back)), mat));
  for (const s of [-1, 1]) {
    const fin = new THREE.SphereGeometry(1, 10, 6); fin.scale(.22, .03, .12); fin.rotateY(s * .5); fin.rotateZ(s * -.45); fin.translate(s * .26, -.12, .45);
    group.add(new THREE.Mesh(painted(fin, c => c.copy(blush)), mat));
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshStandardMaterial({ color: 0x1a1414 }));
    eye.position.set(s * .15, .06, .9); group.add(eye);
  }
  // Fluke on its own pivot at the tail stock.
  const tail = new THREE.Group(); tail.position.set(0, 0, -1); group.add(tail);
  const fluke = new THREE.Shape(); fluke.moveTo(0, 0); fluke.quadraticCurveTo(.25, -.05, .34, -.24); fluke.quadraticCurveTo(.12, -.17, 0, -.2); fluke.quadraticCurveTo(-.12, -.17, -.34, -.24); fluke.quadraticCurveTo(-.25, -.05, 0, 0);
  const flukeGeo = new THREE.ShapeGeometry(fluke, 6); flukeGeo.rotateX(-Math.PI / 2);
  const flukeMesh = new THREE.Mesh(painted(flukeGeo, c => c.copy(back).lerp(blush, .4)), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, side: THREE.DoubleSide }));
  tail.add(flukeMesh);
  group.userData.swim = t => { tail.rotation.x = Math.sin(t * 6) * .35; };
  group.userData.tick = t => group.userData.swim(t);
  group.userData.dispose = () => { group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); };
  return group;
}
