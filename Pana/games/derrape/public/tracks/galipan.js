import * as THREE from 'three';
import { createLayout } from '/engine/worlds/coastal/galipan-layout.js';
import { createWorld, GALIPAN_SCALE } from '/engine/worlds/coastal/galipan-world.js';
import { coastalTrack } from './coastal-track.js';
import { gateRuns } from '../course-rules.js';

const scale = GALIPAN_SCALE;
// Out of the Boca de Tigre hairpin the road dives down el cañón to the
// cliff's lip; there the cars become avionetas and fly a loop out over
// Caracas (no road under it, an invisible wall either side) back onto the
// girasoles terrace (transform-gates.js). Points in layout metres.
const CARACAS_FLIGHT = { fly: true, corridor: true, lift: 3, fromAt: [36 * scale, 236 * scale], toAt: [-206 * scale, 238 * scale] };
// Gold rings mark the flight's line, like checkpoints in the sky.
const RINGS = [.18, .36, .54, .72, .88];

function flightRings(group, T) {
  const run = gateRuns(T).find(g => g.fly);
  if (!run) return;
  const material = new THREE.MeshStandardMaterial({ color: 0xffc629, emissive: 0xffa000, emissiveIntensity: 1.1, roughness: .4, metalness: .3 });
  const geometry = new THREE.TorusGeometry(T.HW + 1, .55, 10, 48);
  for (const f of RINGS) {
    const s = run.s0 + run.len * f, p = T.pointAt(s), q = T.pointAt(s + 1);
    const ring = new THREE.Mesh(geometry, material);
    ring.position.set(p.x, T.heightAtS(s) + CARACAS_FLIGHT.lift + 2.5, p.y);
    ring.rotation.y = Math.atan2(q.x - p.x, q.y - p.y);
    ring.name = 'flight-ring';
    group.add(ring);
  }
}

// Night on the mountain: the moon lights the road from the north-west and
// Caracas glows below. Fog stays far so the city reads from the mirador.
export default coastalTrack('galipan', createLayout(), createWorld, {
  scale,
  palette: { skySeed: 53, cloudCover: .12, horizon: 0x1c2450, skyTop: 0x070c26, daylight: .12,
    sunDisc: false,
    hemiSky: 0x7088d8, hemiGround: 0x2a2838, hemiInt: .9, sun: 0xb0c4ff,
    sunInt: .95, ground: 0x2c5a30, track: 0x8c8a84, dune: 0, fog: [320, 3400] },
  previewBounds: [[-440 * scale, 60, -440 * scale], [440 * scale, 260, 440 * scale]],
  def: { transformGates: [CARACAS_FLIGHT], scenery(group, kit, T) { flightRings(group, T); } },
});
