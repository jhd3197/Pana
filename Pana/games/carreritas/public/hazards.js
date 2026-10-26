// Moving hazards that cross the road: cows on Los Llanos, a camionetica bus
// in Plaza Pana, boulders rolling over the desert road. Each one runs on the
// race clock, so every screen in an online race sees it in the same place.
// Track defs list them as hazards: [{ kind, u, period, phase }].

import * as THREE from 'three';
import { hatoCow } from '/engine/models/fauna/farm/hato-cow.js';
import { rock } from '/engine/models/props/rock.js';
import { locKey } from '/engine/i18n.js';

const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });

// A Venezuelan camionetica (por puesto bus): boxy, two-tone, roof rack.
function makeBus() {
  const g = new THREE.Group();
  const box = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  box(2.6, 1.7, 7.4, 0xf2c230, 0, 1.55, 0);
  box(2.62, 0.5, 7.42, 0x2d8a5e, 0, 0.95, 0);
  box(2.64, 0.75, 6.2, 0x2a3b45, 0, 2.05, -0.4);          // windows
  box(2.4, 0.08, 6.6, 0x6b5a46, 0, 2.5, -0.3);            // roof rack
  box(2.66, 0.25, 0.3, 0xe8452c, 0, 2.3, 3.6);            // route sign
  box(1.2, 0.5, 0.2, 0xfff3d6, 0, 1.2, 3.72);             // grille
  for (const [x, z] of [[-1.25, 2.4], [1.25, 2.4], [-1.25, -2.3], [1.25, -2.3]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10), mat(0x1d1d22));
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w);
  }
  return g;
}

const KINDS = {
  // Cows amble from shoulder to shoulder and stop for a while in between.
  cow: { reach: -1.6, cross: 9, period: 16, radius: 1.9, power: 12, make: (i) => { const m = hatoCow({ seed: 11 + i }); m.scale.setScalar(1.15); return m; }, line: [locKey('¡Muuu!'), locKey('¡Cuidado con la vaca!')] },
  // The bus barrels across a cross street and is gone again.
  bus: { reach: 9, cross: 3.2, period: 12, radius: 3.2, power: 16, make: () => makeBus(), line: [locKey('¡La camionetica!'), locKey('¡Pare, chofer!')] },
  // Boulders bounce down the dunes and across the road.
  rock: { reach: 5, cross: 2.6, period: 9, radius: 1.8, power: 14, make: (i) => rock(1.5, 0x9a6b4a, 5 + i), line: [locKey('¡Una piedra!'), locKey('¡Esquiva!')] },
};

// Pure: position of a hazard across the road at race time t, from -1 (one
// side) to +1 (the other), and whether it is on the move.
export function hazardCross(kind, t, phase = 0, period) {
  const k = KINDS[kind];
  const cycle = period ?? k.period;
  const local = ((t + phase) % cycle + cycle) % cycle;
  const back = Math.floor(((t + phase) / cycle)) % 2 === 1;   // alternate direction each pass
  const f = Math.min(1, local / k.cross);
  const x = -1 + 2 * (f * f * (3 - 2 * f));
  return { x: back ? -x : x, moving: local < k.cross };
}

export function createHazards(T, scene) {
  const list = (T.def.hazards || []).map((h, i) => {
    const k = KINDS[h.kind];
    const s = h.u * T.TOTAL, p = T.pointAt(s), q = T.pointAt(s + 0.5);
    const tx = q.x - p.x, tz = q.y - p.y, l = Math.hypot(tx, tz) || 1;
    const m = k.make(i);
    m.name = `hazard-${h.kind}`;
    scene.add(m);
    return { ...h, k, m, p, nx: -tz / l, nz: tx / l, roadH: Math.atan2(tx, tz), y: T.heightAtS(s), x: 0, z: 0, hitT: new Map() };
  });

  // Moves every hazard to race time t and knocks over any car it touches.
  function update(t, dt, cars, hit) {
    for (const hz of list) {
      const { x: f, moving } = hazardCross(hz.kind, t, hz.phase || 0, hz.period);
      // Cows stay inside the roadside fences; buses and rocks come from beyond.
      const half = T.HW + hz.k.reach;
      const off = f * half;
      hz.x = hz.p.x + hz.nx * off;
      hz.z = hz.p.y + hz.nz * off;
      const y = T.groundAt(hz.x, hz.z);
      hz.m.position.set(hz.x, y + (hz.kind === 'rock' ? 1.4 : 0), hz.z);
      const dir = Math.sign(hazardCross(hz.kind, t + 0.05, hz.phase || 0, hz.period).x - f) || 1;
      hz.m.rotation.y = hz.roadH + (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + (hz.kind === 'cow' && !moving ? 0.6 : 0);
      if (hz.kind === 'rock' && moving) hz.m.rotation.x += dt * 6 * dir;
      hz.m.userData.tick?.(t);
      for (const c of cars) {
        if (c.remote || c.done || c.ghost || c.phaseT > 0 || c.phaseRemote || c.rescueT > 0) continue;
        const last = hz.hitT.get(c) ?? -9;
        if (t - last < 1.5) continue;
        if (Math.hypot(c.x - hz.x, c.z - hz.z) < hz.k.radius + 1.4 && Math.abs(c.y - y) < 3) {
          hz.hitT.set(c, t);
          hit(c, hz.k.power, Math.sign((c.x - hz.x) * hz.nx + (c.z - hz.z) * hz.nz) || 1, hz);
        }
      }
    }
  }

  function dispose() { for (const hz of list) hz.m.removeFromParent(); }
  return { list, update, dispose, lines: (hz) => hz.k.line };
}
