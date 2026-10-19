import * as THREE from 'three';
import { CAR_BUILDERS } from '../models/vehicles/cars.js';
import { buildCharacter } from '../models/characters/pana/avatar-model.js';
import { scarletMacaw } from '../models/fauna/birds/scarlet-macaw.js';
import { randomAvatar } from '../avatar.js';
import { rng } from '../random.js';
import { getSettings } from '../settings.js';

// Background life around a table or a court: a pack of Derrape karts racing
// past on a lane, panas strolling along the edge, macaws circling overhead.
// Pure decoration, never in the play area, and driven only by absolute time,
// so every peer, pause and replay shows the same pose for the same moment.
//
//   routes = { lane: [[x, z], [x, z]], walks: [[[x, z], …], …], sky: { x, z, radius, height } }
//
// Everything lives in one group the caller parents (an arena's group), so the
// arena's scale and disposal apply to it too.
const PACK_EVERY = 19, PACK_SPEED = 17, WALK_SPEED = 1.05;

function length(points) { let sum = 0; for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); return sum; }
// A point `d` metres along a polyline, walked there and back again.
function along(points, total, d) {
  d %= total * 2; if (d > total) d = total * 2 - d;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i], l = Math.hypot(bx - ax, bz - az);
    if (d <= l || i === points.length - 1) { const k = l ? Math.min(1, d / l) : 0; return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, dx: bx - ax, dz: bz - az }; }
    d -= l;
  }
  return { x: points[0][0], z: points[0][1], dx: 1, dz: 0 };
}

export function createAmbientLife(routes = {}, { seed = 7 } = {}) {
  const group = new THREE.Group(); group.name = 'Ambient life';
  const low = getSettings().quality === 'baja', random = rng(seed), actors = [];
  // Karts: one pack crosses the lane every PACK_EVERY seconds, alternating directions.
  const karts = [];
  if (routes.lane) {
    const ids = Object.keys(CAR_BUILDERS);
    for (let i = 0; i < (low ? 2 : 3); i++) {
      const car = CAR_BUILDERS[ids[Math.floor(random() * ids.length)]](randomAvatar(random));
      car.root.scale.setScalar(.5); car.root.visible = false; group.add(car.root);
      karts.push({ car, gap: i * 3.4 + random() * 1.2, lean: (random() - .5) * .8 });
    }
  }
  const walkers = (routes.walks || []).slice(0, low ? 2 : 4).map((points, i) => {
    const pana = buildCharacter(randomAvatar(random)); group.add(pana.group);
    return { pana, points, total: length(points), offset: random() * 100, speed: WALK_SPEED * (.85 + random() * .3) };
  });
  const birds = routes.sky ? Array.from({ length: low ? 1 : 2 }, (_, i) => { const b = scarletMacaw({ seed: seed + i }); b.scale.setScalar(.8); group.add(b); return { b, phase: i * 2.3 }; }) : [];
  function update(t, dt = 0) {
    if (routes.lane) {
      const [[ax, az], [bx, bz]] = routes.lane, span = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / span, uz = (bz - az) / span;
      const pack = Math.floor(t / PACK_EVERY), into = (t % PACK_EVERY) * PACK_SPEED, reverse = pack % 2 === 1;
      for (const k of karts) {
        const d = into - k.gap * PACK_SPEED / 6, on = d >= 0 && d <= span;
        k.car.root.visible = on; if (!on) continue;
        const s = reverse ? span - d : d, side = k.lean;
        k.car.root.position.set(ax + ux * s - uz * side, 0, az + uz * s + ux * side);
        k.car.root.rotation.y = Math.atan2(reverse ? -ux : ux, reverse ? -uz : uz);
        k.car.tumble.rotation.z = Math.sin(t * 9 + k.gap) * .025;
        for (const w of k.car.wheels) w.spin.rotation.x = t * PACK_SPEED / (k.car.radius * .5);
      }
    }
    for (const w of walkers) {
      const d = (t + w.offset) * w.speed, lap = Math.floor(d / w.total) % 2, p = along(w.points, w.total, d);
      w.pana.group.position.set(p.x, 0, p.z);
      w.pana.group.rotation.y = Math.atan2(lap ? -p.dx : p.dx, lap ? -p.dz : p.dz);
      w.pana.update(dt, { walk: 1 });
    }
    for (const { b, phase } of birds) {
      const a = t * .22 + phase, { x, z, radius, height } = routes.sky;
      b.position.set(x + Math.cos(a) * radius, height + Math.sin(t * .7 + phase) * .8, z + Math.sin(a) * radius);
      b.rotation.set(0, -a, -.3); b.userData.tick(t);
    }
  }
  update(0);
  return { group, update, get counts() { return { karts: karts.length, walkers: walkers.length, birds: birds.length }; },
    // Detach first: model dispose hooks may remove parts mid-traversal.
    dispose() {
      group.removeFromParent(); walkers.forEach(w => w.pana.dispose());
      const geometries = new Set(), materials = new Set();
      group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [o.material].flat()) if (m) materials.add(m); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    } };
}
