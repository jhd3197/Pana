// La china: a guava-wood fork, two rubber bands and a leather pouch. About
// 22 cm tall, origin at the bottom of the grip, fork up +Y, shooting toward +Z
// (the pouch is drawn back toward -Z). userData.pull(0..1) stretches the bands;
// userData.pouch is the object a loaded stone rides on.
import * as THREE from 'three';

export function china({ wood = 0x8b5a33, band = 0xc8442a, leather = 0x5a3a22 } = {}) {
  const group = new THREE.Group(); group.name = 'China';
  const woodMat = new THREE.MeshStandardMaterial({ color: wood, roughness: 0.85, flatShading: true });
  const bandMat = new THREE.MeshStandardMaterial({ color: band, roughness: 0.6 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: leather, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
  const stick = (a, b, r1, r2) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
    const geo = new THREE.CylinderGeometry(r2, r1, len, 7); geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, woodMat); m.position.copy(va);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    m.castShadow = true; group.add(m); return m;
  };
  // the forked branch, slightly crooked like a real horqueta de guayabo
  stick([0, 0, 0], [0.004, 0.11, 0], 0.012, 0.011);
  stick([0.004, 0.11, 0], [-0.045, 0.2, 0.004], 0.011, 0.008);
  stick([0.004, 0.11, 0], [0.05, 0.195, -0.003], 0.011, 0.008);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 7, 5), woodMat); knot.position.set(0.004, 0.11, 0); group.add(knot);
  const tips = [new THREE.Vector3(-0.045, 0.19, 0.004), new THREE.Vector3(0.05, 0.185, -0.003)];
  // rubber bands are unit cylinders aimed and stretched on every pull
  const bandGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5); bandGeo.translate(0, 0.5, 0);
  const bands = tips.map(() => { const m = new THREE.Mesh(bandGeo, bandMat); group.add(m); return m; });
  const pouch = new THREE.Group(); group.add(pouch);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 10, 1, true, 0, Math.PI), leatherMat);
  pad.rotation.set(0, Math.PI / 2, Math.PI / 2); pouch.add(pad);
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  let amount = 0;
  group.userData.pull = k => {
    amount = THREE.MathUtils.clamp(k, 0, 1);
    pouch.position.set(0.002, 0.19 - amount * 0.03, -0.02 - amount * 0.32);
    bands.forEach((b, i) => {
      const from = tips[i], to = pouch.position.clone().add(new THREE.Vector3(i ? 0.018 : -0.018, 0, 0));
      dir.subVectors(to, from); b.position.copy(from); b.scale.set(1, dir.length(), 1);
      b.quaternion.setFromUnitVectors(up, dir.normalize());
    });
  };
  group.userData.amount = () => amount;
  // a lazy draw-and-release loop, for previews
  group.userData.tick = t => group.userData.pull(Math.max(0, Math.sin(t * 1.8)));
  group.userData.pouch = pouch;
  group.userData.dispose = () => { group.traverse(o => o.geometry?.dispose()); [woodMat, bandMat, leatherMat].forEach(m => m.dispose()); };
  group.userData.pull(0);
  return group;
}
