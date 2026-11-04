// A first-person hand: a gloved fist or open hand, a brass cuff and a suit sleeve
// that runs off the bottom of the screen. Low poly, no shadows, no lights. One kit
// shares its geometries and materials across every hand it makes; a hand is three
// draws. `viewmodel.js` is the motion that poses it.
//
//   const kit = createHandKit({ sleeve: color });
//   const right = kit.hand({ parent: camera, side: 1 });   // side -1 is a left hand
//   right.slot.add(model);            // the item: +Y runs up through the fist
//   right.setGrip('fist');            // 'fist' round a handle, 'open' at rest, 'cup' palm up
//   applyHeld(right.hand, pose, carry); right.update();    // or right.follow(object): take its pose
//   right.visible = false; kit.setColor(c); kit.dispose();
//
// The forearm is a one-bone reach: however the hand turns, the sleeve goes from the
// wrist to a fixed elbow past the screen's edge (`right.elbow`, in the parent's space).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0), wrist = new THREE.Vector3(), reach = new THREE.Vector3();

// A rounded bar from a to b.
function bar(a, b, radius) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from), g = new THREE.CapsuleGeometry(radius, Math.max(.001, d.length()), 2, 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return g;
}
function lump([x, y, z], [rx, ry, rz]) { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(rx, ry, rz); g.translate(x, y, z); return g; }

// A right hand round a handle along Y: back of the hand on +X, wrist on +Z, fingers
// wrapped across -Z and back along -X, thumb over the top.
function fistGeometry() {
  const parts = [lump([.036, 0, .008], [.024, .056, .052]), lump([.018, -.004, .056], [.036, .042, .036])];
  for (const y of [-.042, -.014, .014, .042]) parts.push(bar([.032, y, -.04], [-.028, y, -.04], .0155), bar([-.036, y, -.036], [-.036, y, .012], .015));
  parts.push(bar([.006, .05, .048], [-.038, .056, .004], .017));
  return mergeGeometries(parts);
}
// A relaxed right hand, palm down (-Y), fingers on -Z with a slight curl, wrist on +Z.
function openGeometry() {
  const parts = [lump([0, 0, 0], [.05, .02, .056]), lump([0, -.002, .054], [.038, .024, .03])];
  for (const [x, far] of [[-.034, .03], [-.012, .04], [.012, .04], [.034, .032]]) parts.push(bar([x, 0, -.05], [x, -.004, -.05 - far], .0125), bar([x, -.004, -.05 - far], [x, -.024, -.07 - far], .0115));
  parts.push(bar([-.042, -.004, .018], [-.074, -.016, -.036], .014));
  return mergeGeometries(parts);
}
// The wrist each shape reaches the sleeve from.
const WRIST = { fist: [.016, -.004, .082], open: [0, -.002, .076] };

// glow: how much of its own colour each part shows with no light on it, so a hand
// stays readable in a dark game.
export function createHandKit({ sleeve = 0xb07a4a, glove = 0x3a2a20, cuff = 0xc9a35a, scale = 1, glow = 0 } = {}) {
  const sleeveMaterial = new THREE.MeshStandardMaterial({ color: sleeve, emissive: sleeve, emissiveIntensity: glow, roughness: .85, flatShading: true });
  const gloveMaterial = new THREE.MeshStandardMaterial({ color: glove, emissive: glove, emissiveIntensity: glow * 3.5, roughness: .9 })   // dark, so it needs more to read;
  const cuffMaterial = new THREE.MeshStandardMaterial({ color: cuff, emissive: cuff, emissiveIntensity: glow, roughness: .5, metalness: .25, flatShading: true });
  const fist = fistGeometry(), open = openGeometry();
  // Wrist at y 0, elbow at y 1: the sleeve's length is its y scale.
  const forearm = new THREE.CylinderGeometry(.064, .043, 1, 8, 1, true).translate(0, .5, 0);
  const rings = mergeGeometries([new THREE.CylinderGeometry(.05, .048, .034, 10), new THREE.CylinderGeometry(.052, .052, .012, 10).translate(0, .03, 0)]);
  const made = [];
  const part = (geometry, material, parent) => { const m = new THREE.Mesh(geometry, material); parent.add(m); return m; };
  return {
    setColor(color) { sleeveMaterial.color.set(color); sleeveMaterial.emissive.set(color); },
    // parent: what the hand rides on (the camera). elbow: past the screen's edge, for the right hand.
    hand({ parent, side = 1, elbow = [.42, -.7, .06] } = {}) {
      const root = new THREE.Group(), hand = new THREE.Group(), arm = new THREE.Group(), slot = new THREE.Group();
      hand.scale.setScalar(scale); arm.scale.setScalar(scale); hand.add(slot); root.add(hand, arm); parent?.add(root);
      const glover = part(fist, gloveMaterial, hand), sleeveMesh = part(forearm, sleeveMaterial, arm); part(rings, cuffMaterial, arm);
      const rig = {
        root, hand, arm, slot, side, grip: 'fist',
        elbow: new THREE.Vector3(elbow[0] * side, elbow[1], elbow[2]),
        get visible() { return root.visible; }, set visible(on) { root.visible = on; },
        setGrip(name) {
          rig.grip = name; glover.geometry = name === 'fist' ? fist : open;
          glover.scale.set(side, name === 'cup' ? -1 : 1, 1);
        },
        // Takes another object's pose: the hand wraps its origin.
        follow(object) { hand.position.copy(object.position); hand.quaternion.copy(object.quaternion); rig.update(); },
        update() {
          const w = WRIST[rig.grip === 'fist' ? 'fist' : 'open'];
          wrist.set(w[0] * side * scale, w[1] * scale * (rig.grip === 'cup' ? -1 : 1), w[2] * scale).applyQuaternion(hand.quaternion).add(hand.position);
          arm.position.copy(wrist);
          reach.copy(rig.elbow).sub(wrist); const length = reach.length();
          arm.quaternion.setFromUnitVectors(UP, reach.divideScalar(length || 1));
          sleeveMesh.scale.y = length / scale;
        },
      };
      rig.setGrip('fist'); made.push(root);
      return rig;
    },
    dispose() {
      for (const root of made) root.removeFromParent();
      [fist, open, forearm, rings].forEach(g => g.dispose()); [sleeveMaterial, gloveMaterial, cuffMaterial].forEach(m => m.dispose());
    },
  };
}
