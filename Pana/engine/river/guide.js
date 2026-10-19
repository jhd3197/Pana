// The guide drawn on the water around your own boat (Curiara, Lancha): a ring
// with a pointer toward the best line, and a trail of chevrons along that
// line ahead (river.guideAt, which also swerves round swimming caimanes). It
// keeps your eyes on the river instead of the minimap, and matters most where
// the river opens up and the banks stop telling you where to go.
// The pointer goes gold on the line, coral when you point away; it pulses
// faster the further off you are.
import * as THREE from 'three';
import { angle } from './river.js';

const GOLD = new THREE.Color(0xffc629), CORAL = new THREE.Color(0xff6b5a), SOFT = new THREE.Color(0xfff4d0);

function chevron(width, depth) {
  const w = width / 2, shape = new THREE.Shape();
  shape.moveTo(-w, -depth / 2); shape.lineTo(0, depth / 2 - .25); shape.lineTo(w, -depth / 2); shape.lineTo(w, -depth / 2 + .32); shape.lineTo(0, depth / 2 + .1); shape.lineTo(-w, -depth / 2 + .32);
  // Lying flat with the tip down +Z, the heading's forward (double-sided).
  const geo = new THREE.ShapeGeometry(shape); geo.rotateX(Math.PI / 2); return geo;
}

export function createRiverGuide({ radius = 3.4, ahead = 14, spacing = 6, count = 7, first = 8, size = 1 } = {}) {
  const group = new THREE.Group(); group.name = 'Guía en el agua'; group.visible = false;
  const glow = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, side: THREE.DoubleSide };
  const ringGeo = new THREE.RingGeometry(radius - .07, radius + .07, 72); ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: SOFT, opacity: .28, ...glow })); ring.renderOrder = 5; group.add(ring);
  const pointer = new THREE.Mesh(chevron(1.3, 1.1), new THREE.MeshBasicMaterial({ color: GOLD, opacity: .95, ...glow })); pointer.renderOrder = 6; group.add(pointer);
  const trail = new THREE.InstancedMesh(chevron(2.2 * size, 1.5 * size), new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: .9, ...glow }), count);
  trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage); trail.frustumCulled = false; trail.renderOrder = 5; group.add(trail);
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < count; i++) trail.setColorAt(i, tint.setRGB(0, 0, 0));

  // `b` is your boat from the snapshot (x, z, h, s, channel); `time` the race clock.
  function update(river, b, time, { on = true, clock = time } = {}) {
    group.visible = !!(on && b && b.finish == null && b.channel !== 'branch' && !(b.capsized > 0));
    if (!group.visible) return;
    const where = river.locate(b.x, b.z, b), s = where.s, y = river.levelAt(s, where.offset) + .06;
    const goal = river.at(Math.min(river.LENGTH, s + ahead), river.guideAt(s + ahead, time));
    const toward = Math.atan2(goal.x - b.x, goal.z - b.z), err = Math.abs(angle(toward - b.h));
    ring.position.set(b.x, y, b.z);
    const pulse = .5 + .5 * Math.sin(clock * (3 + err * 7));
    pointer.position.set(b.x + Math.sin(toward) * radius, y + .3, b.z + Math.cos(toward) * radius); pointer.rotation.set(-.6, toward, 0, 'YXZ');
    pointer.scale.setScalar(.9 + pulse * .25);
    pointer.material.color.copy(GOLD).lerp(CORAL, Math.min(1, Math.max(0, (err - .35) / .8)));
    ring.material.opacity = .18 + .14 * pulse;
    // Chevrons light up in a wave that runs downstream, like runway lights.
    for (let i = 0; i < count; i++) {
      const at = s + first + i * spacing;
      if (at > river.LENGTH - 2) { dummy.scale.setScalar(0); dummy.updateMatrix(); trail.setMatrixAt(i, dummy.matrix); continue; }
      const p = river.at(at, river.guideAt(at, time)), next = river.at(at + 1.5, river.guideAt(at + 1.5, time));
      // Stood up, leaning back toward the boat: flat on the water a chase
      // camera sees them edge-on.
      dummy.position.set(p.x, river.levelAt(at, river.guideAt(at, time)) + .55 * size + .12 * Math.sin(clock * 3 - i), p.z); dummy.rotation.set(-1.05, Math.atan2(next.x - p.x, next.z - p.z), 0, 'YXZ'); dummy.scale.setScalar(1);
      dummy.updateMatrix(); trail.setMatrixAt(i, dummy.matrix);
      const wave = Math.max(0, Math.sin(clock * 4 - i * .9)), fade = 1 - i / (count + 1);
      trail.setColorAt(i, tint.copy(GOLD).multiplyScalar((.25 + .75 * wave) * fade));
    }
    trail.instanceMatrix.needsUpdate = true; trail.instanceColor.needsUpdate = true;
  }
  return { group, update,
    dispose() { for (const o of [ring, pointer, trail]) { o.geometry.dispose(); o.material.dispose(); } trail.dispose(); group.removeFromParent(); } };
}
