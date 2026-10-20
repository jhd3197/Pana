// Babo (spectacled caimán) lying at the waterline like a log. About 2.4 m,
// +Z forward, origin under its belly. userData.snap(amount) opens the jaws
// and lunges (0 rest … 1 full snap); userData.tick(t) breathes and blinks.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

export function caiman({ seed = 7 } = {}) {
  const random = rng(seed), group = new THREE.Group(); group.name = 'Babo';
  const skin = new THREE.MeshStandardMaterial({ color: 0x4a4f34, roughness: .9, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: 0xa79a6a, roughness: .9, flatShading: true });
  const scute = new THREE.MeshStandardMaterial({ color: 0x3b3f2a, roughness: 1, flatShading: true });
  const iris = new THREE.MeshStandardMaterial({ color: 0xc9b04a, roughness: .4 }), pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const gum = new THREE.MeshStandardMaterial({ color: 0xc46a5d, roughness: .7 }), ivory = new THREE.MeshStandardMaterial({ color: 0xf1ead2 });
  const body = new THREE.Group(); group.add(body);
  // Trunk: a flattened, lumpy cylinder lying along Z.
  const trunk = new THREE.CylinderGeometry(.24, .27, 1.1, 10, 4); trunk.rotateX(Math.PI / 2); trunk.scale(1.15, .6, 1);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, tp.getY(i) + .03 * Math.sin(tp.getZ(i) * 9 + seed));
  trunk.computeVertexNormals();
  const torso = new THREE.Mesh(trunk, skin); torso.position.set(0, .17, 0); body.add(torso);
  const under = new THREE.Mesh(new THREE.BoxGeometry(.42, .06, 1.05), belly); under.position.set(0, .06, 0); body.add(under);
  // Tail: segments that taper and sway.
  const tail = new THREE.Group(); tail.position.set(0, .16, -.55); body.add(tail);
  let link = tail;
  for (let i = 0; i < 6; i++) {
    const r = .22 * (1 - i / 7), seg = new THREE.Mesh(new THREE.CylinderGeometry(r * .82, r, .24, 8), skin);
    seg.rotation.x = Math.PI / 2; seg.scale.set(1, 1, .55); seg.position.z = -.12; link.add(seg);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(.04, .08, .16), scute); ridge.position.set(0, r * .55, -.12); link.add(ridge);
    const next = new THREE.Group(); next.position.z = -.24; link.add(next); link = next;
  }
  // Rows of scutes down the back.
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, .08), scute); k.position.set(s * (.07 + (i % 2) * .05), .32, .45 - i * .11); body.add(k);
  }
  // Splayed legs.
  for (const [x, z] of [[1, .38], [-1, .38], [1, -.38], [-1, -.38]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, .28, 6), skin);
    leg.position.set(x * .3, .1, z); leg.rotation.z = x * 1.1; body.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.13, .03, .1), skin); foot.position.set(x * .42, .02, z + .04); body.add(foot);
  }
  // Head with eyes on top and a hinged lower jaw.
  const head = new THREE.Group(); head.position.set(0, .2, .55); body.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(.32, .14, .32), skin); skull.position.set(0, .02, .1); head.add(skull);
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(.08, .13, .5, 8), skin); snout.rotation.x = Math.PI / 2; snout.scale.set(1.25, 1, .6); snout.position.set(0, 0, .5); head.add(snout);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), iris); eye.position.set(s * .09, .1, .14); head.add(eye);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(.012, .05, .02), pupilMat); pupil.position.set(s * .09, .1, .184); head.add(pupil);
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -.05, .1); head.add(jaw);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(.24, .05, .7), belly); lower.position.set(0, -.02, .3); jaw.add(lower);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.2, .02, .6), gum); mouth.position.set(0, .01, .32); jaw.add(mouth);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { const tooth = new THREE.Mesh(new THREE.ConeGeometry(.012, .04, 4), ivory); tooth.position.set(s * .095, .03, .1 + i * .08); jaw.add(tooth); }
  group.userData.jaw = jaw; group.userData.head = head;
  let snapAmount = 0;
  group.userData.snap = amount => {
    snapAmount = THREE.MathUtils.clamp(amount, 0, 1);
    jaw.rotation.x = snapAmount * .75; head.rotation.x = -snapAmount * .35; body.position.z = snapAmount * .45; body.position.y = snapAmount * .12;
  };
  const sway = random() * 6;
  group.userData.tick = t => {
    let k = tail.children.find(o => o.isGroup);
    for (let i = 0; k; i++) { k.rotation.y = Math.sin(t * .8 + sway + i * .6) * .06 * (1 + snapAmount * 3); k = k.children.find(o => o.isGroup); }
    torso.scale.y = 1 + Math.sin(t * 1.3 + sway) * .03;
  };
  group.userData.dispose = () => { group.traverse(o => o.geometry?.dispose()); [skin, belly, scute, iris, pupilMat, gum, ivory].forEach(m => m.dispose()); };
  return group;
}
