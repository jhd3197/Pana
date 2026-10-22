// Life on Derrape's open lagoons (course-rules.js): peñeros anchored out on the
// water with two chigüires fishing in each, rods over the side and a bobber
// on the line, and boats going round a loop. All of them are solid:
// transform-gates.js bounces lanchas off them, and a moving boat's wake
// kicks a hop, so they are something to steer around, not just scenery.
import { THREE, M, mesh, tube, put } from './world-kit.js';
import { fishingBoat } from '/engine/models/props/coastal.js';
import { wildCapybara } from '/engine/models/fauna/capybara/wild-capybara.js';
import { riverCanoe } from '/engine/models/props/llano-life.js';

const HULLS = [0x368e92, 0xd8573a, 0x2f6fb8, 0xe0a72e];
const ROD = M(0x5a3d22), LINE = M(0xf2f2f2), BOBBER = M(0xe8382c);

// spots: [x, z, heading] in race metres, on water at height y.
export function fishermen(T, spots, { y = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'lagoon-fishermen';
  const boats = spots.map(([x, z, h], i) => {
    const boat = put(group, fishingBoat({ color: HULLS[i % HULLS.length] }), x, z, y - 0.2, h);
    const bobbers = [];
    // One chigüire on the bow bench and one on the stern bench, each
    // fishing over its own side.
    for (const [side, along] of [[1, 1.35], [-1, -1.85]]) {
      const capy = wildCapybara({ seed: 11 + i * 2 + (side > 0 ? 0 : 1) });
      capy.scale.setScalar(0.72);
      capy.position.set(-side * 0.1, 0.8, along);
      capy.rotation.y = side * Math.PI / 2;
      boat.add(capy);
      const tip = [side * 3.4, 3.1, along + 0.4], dip = [side * 3.9, 0.2, along + 0.4];
      boat.add(tube([side * 0.75, 1.35, along + 0.2], tip, 0.04, ROD), tube(tip, dip, 0.01, LINE));
      const bobber = mesh(new THREE.SphereGeometry(0.14, 8, 6), BOBBER, ...dip);
      boat.add(bobber);
      bobbers.push(bobber);
    }
    return { boat, bobbers, x, z, phase: i * 1.7 };
  });
  // The chigüires' own ticks (ears) run from the scenery traversal.
  group.userData.tick = t => boats.forEach(b => {
    b.boat.position.y = y - 0.2 + Math.sin(t * 1.3 + b.phase) * 0.07;
    b.boat.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.04;
    b.bobbers.forEach((o, k) => { o.position.y = 0.2 + Math.max(0, Math.sin(t * 2.1 + b.phase + k * 2)) * 0.12; });
  });
  T.waterObstacles.push(() => boats.map(b => ({ x: b.x, z: b.z, r: 3 })));
  return group;
}

// Curiaras going round a closed loop of [x, z] points at `speed` m/s, spread
// evenly. Positions come from the race clock, so every client agrees.
export function boatLoop(T, points, { count = 2, speed = 9, y = 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'lagoon-boat-loop';
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal'), len = curve.getLength();
  const boats = Array.from({ length: count }, (_, i) => {
    const g = put(group, riverCanoe(), 0, 0, y), skipper = wildCapybara({ seed: 31 + i });
    skipper.scale.setScalar(0.6); skipper.position.set(0, 0.25, -1.2); g.add(skipper);   // a chigüire at the stern
    return { g, phase: i / count, x: 0, z: 0, h: 0 };
  });
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  group.userData.tick = t => boats.forEach(b => {
    const u = ((t * speed / len + b.phase) % 1 + 1) % 1;
    curve.getPointAt(u, p); curve.getPointAt((u + 0.002) % 1, q);
    b.x = p.x; b.z = p.z; b.h = Math.atan2(q.x - p.x, q.z - p.z);
    b.g.position.set(p.x, y - 0.1 + Math.abs(Math.sin(t * 5 + b.phase * 9)) * 0.08, p.z);
    b.g.rotation.set(-0.05, b.h, Math.sin(t * 2.6 + b.phase) * 0.04);
  });
  group.userData.tick(0);
  T.waterObstacles.push(() => boats.map(b => ({ x: b.x, z: b.z, r: 2.6, h: b.h, v: speed, vx: Math.sin(b.h) * speed, vz: Math.cos(b.h) * speed })));
  return group;
}
