// The jaguar cave: the road climbs through the mountain to the plateau. A
// temple hall opens halfway, with a stepped pyramid, a cenote under a rainy
// skylight, torches, jade/gold/turquoise crystals and two live jaguars. Both
// mouths are overgrown Maya-style stone portals; the jaguar is only a small
// carved relief on the lintel, never a giant head.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { placeOnTrack } from '../track-kit.js';
import { hollowGallery } from './water-world-kit.js';
import { lightShaft } from '/engine/models/effects/atmosphere.js';
import { floatingMotes } from '/engine/models/effects/drifting-particles.js';
import { crystalField } from '/engine/models/props/crystals.js';
import { caveCrystals } from './salt-cave.js';
import { rootCurtain, stalactiteCluster } from '/engine/models/props/caves.js';
import { brazier } from '/engine/models/props/ruins.js';
import { jaguar } from '/engine/models/fauna/jaguar.js';
import { mayaPortal, steppedPyramid, cenote } from '/engine/models/props/maya-temple.js';
import { fern, monstera } from '/engine/models/vegetation/index.js';

export const JADE_CRYSTALS = [0x2fd39a, 0xffc94a, 0x37d6e6, 0x8ef0b0];

function finish(source, cellSize = 90) {
  const out = bake(source, { cellSize }), geometries = new Set();
  source.traverse(o => { if (o.geometry) geometries.add(o.geometry); }); geometries.forEach(g => g.dispose());
  return out;
}

export function jaguarCave(T, cave, { widthAt, heightAt }, { seed = 61 } = {}) {
  const group = new THREE.Group(), statics = new THREE.Group(), random = rng(seed), ticks = [];
  group.name = 'selva-jaguar-cave';
  const at = (u, off) => placeOnTrack(T, u * T.TOTAL, off), road = u => T.heightAtS(u * T.TOTAL);
  const inward = (p, side) => [side * Math.cos(p.h), 0, -side * Math.sin(p.h)];
  const skylit = u => cave.skylights.some(([a, b]) => u > a - .005 && u < b + .005);

  const shell = hollowGallery(T, { from: cave.from, to: cave.to, skylights: [], widthAt, heightAt, color: 0xb9a77f, name: 'selva-cave-shell' });
  const m = shell.children[0], c = m.geometry.attributes.color, tint = new THREE.Color();
  const ring = [0xc9a870, 0xd8bf88, 0x9fcf96, 0x6cc0a8, 0x9fcf96, 0xd8bf88, 0xc9a870].map(h => new THREE.Color(h));
  for (let i = 0; i < c.count; i++) { tint.copy(ring[i % 7]).multiplyScalar(.9 + .2 * Math.sin(i * 1.3) * Math.sin(i * .29)); c.setXYZ(i, tint.r, tint.g, tint.b); }
  m.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true, side: THREE.DoubleSide, emissive: 0x2a7a64, emissiveIntensity: .6 });
  group.add(shell);

  // Crystals in jade, gold and turquoise, stuck to the rock.
  const crystals = caveCrystals(T, cave, { widthAt }, shell, { palette: JADE_CRYSTALS, seed, step: 7, stretch: .04, glow: 1.2, density: .7, name: 'selva-cave-crystals' });
  group.add(crystals); ticks.push(crystals.userData.tick);

  // The temple hall: pyramid on the inner side, cenote on the outer side.
  const hall = cave.halls[0], hallY = road(hall.u) - .6;
  {
    const p = at(hall.u, -(T.HW + 21)), temple = steppedPyramid({ seed });
    temple.position.set(p.x, hallY, p.z); temple.rotation.y = p.h - Math.PI / 2; statics.add(temple);
    const prowl = jaguar({ pose: 'prowl', seed: 3, pace: .7 }), q = at(hall.u + .012, -(T.HW + 7));
    prowl.position.set(q.x, hallY, q.z); prowl.rotation.y = p.h + Math.PI; prowl.scale.setScalar(1.3); group.add(prowl); ticks.push(prowl.userData.tick);
    const sit = jaguar({ pose: 'sit', seed: 4 }), top = at(hall.u - .004, -(T.HW + 9.5));
    sit.position.set(top.x, hallY + .1, top.z); sit.rotation.y = p.h + Math.PI / 2; sit.scale.setScalar(1.3); group.add(sit); ticks.push(sit.userData.tick);
  }
  {
    const u = (cave.skylights[0][0] + cave.skylights[0][1]) / 2, p = at(u, T.HW + 17);
    const pool = cenote({ radius: 9, seed }); pool.position.set(p.x, hallY, p.z); group.add(pool); ticks.push(pool.userData.tick);
    const beam = lightShaft({ radius: 3.5, height: heightAt(u) * .93, spread: 2.6, tilt: 0, fresnel: true, sky: 0xf4ffe6, color: 0xf6ffd8, opacity: .14, dustCount: 160, rain: 220, seed: 61 });
    beam.position.set(p.x, hallY, p.z); group.add(beam); ticks.push(beam.userData.tick);
  }
  for (const [a, b] of cave.skylights.slice(1)) {
    const u = (a + b) / 2, p = at(u, 0);
    const beam = lightShaft({ radius: 2.6, height: heightAt(u) * .93, spread: 2.6, tilt: 0, fresnel: true, sky: 0xf4ffe6, color: 0xf6ffd8, opacity: .11, dustCount: 120, rain: 140, seed: 62 });
    beam.position.set(p.x, road(u) - .6, p.z); group.add(beam); ticks.push(beam.userData.tick);
  }
  // Giant crystals in the hall carry the cave's only real lights.
  const giants = [[-1, -.016, 1], [1, .018, 0], [-1, .02, 2], [1, -.02, 3]].map(([side, du, color]) => {
    const p = at(hall.u + du, side * (T.HW + 10));
    return { x: p.x, y: hallY, z: p.z, size: 5 + random() * 1.5, count: 12, color };
  });
  const giantField = crystalField(giants, { palette: JADE_CRYSTALS, seed: seed + 9, glow: 1.5 });
  giantField.name = 'selva-cave-giants'; group.add(giantField); ticks.push(giantField.userData.tick);
  for (const g of giants) {
    const light = new THREE.PointLight(JADE_CRYSTALS[g.color], 700, 60, 1.6); light.position.set(g.x, g.y + g.size, g.z); group.add(light);
  }

  // Torches line the road; roots hang at the openings; a few stalactites.
  let torches = 0;
  for (let u = cave.from + .012; u < cave.to - .006; u += 55 / T.TOTAL) for (const side of [-1, 1]) {
    const p = at(u, side * (T.HW + 2.2)), fire = brazier({ seed: 80 + torches, lit: true });
    fire.position.set(p.x, road(u) - .5, p.z); fire.scale.setScalar(1.3); group.add(fire); ticks.push(fire.userData.tick); torches++;
  }
  for (const [a, b] of cave.skylights) for (const side of [-1, 1]) {
    const u = side < 0 ? a : b, p = at(u, side * 7);
    const roots = rootCurtain({ seed: seed + torches, length: 8, width: 7 }); roots.position.set(p.x, road(u) + shell.userData.corridor.surface(u, side * 7) + .3, p.z); roots.rotation.y = p.h; statics.add(roots);
  }
  for (let u = cave.from + .01; u < cave.to - .01; u += 26 / T.TOTAL) {
    if (skylit(u)) continue;
    const off = (random() - .5) * widthAt(u), p = at(u, off), drip = stalactiteCluster({ seed: seed + Math.round(u * 999), length: 4 });
    drip.position.set(p.x, road(u) + shell.userData.corridor.surface(u, off) + .3, p.z); statics.add(drip);
  }
  // Portals at both mouths with braziers and jungle creeping round their feet.
  const span = T.HW + 3;
  for (const [u, facing] of [[cave.from, Math.PI], [cave.to, 0]]) {
    const p = at(u, 0), gate = mayaPortal({ span, seed: seed + Math.round(u * 100) });
    gate.position.set(p.x, p.y - .3, p.z); gate.rotation.y = p.h + facing; statics.add(gate);
    for (const side of [-1, 1]) {
      const q = at(u + (facing ? -1 : 1) * 4 / T.TOTAL, side * (span + 3.5)), fire = brazier({ seed: 90 + side, lit: true });
      fire.position.set(q.x, road(u) - .4, q.z); fire.scale.setScalar(1.6); group.add(fire); ticks.push(fire.userData.tick);
      for (let i = 0; i < 4; i++) {
        const f = at(u + (facing ? -1 : 1) * (6 + i * 3) / T.TOTAL, side * (span + 5 + random() * 6)), plant = (i % 2 ? fern : monstera)({ seed: 30 + i });
        plant.position.set(f.x, road(u) - .4, f.z); plant.scale.setScalar(1.6 + random() * .6); statics.add(plant);
      }
    }
  }
  group.add(finish(statics));
  // Fireflies drifting through the hall.
  const points = [];
  for (let i = 0; i < 500; i++) {
    const u = cave.from + random() * (cave.to - cave.from), p = at(u, (random() * 2 - 1) * widthAt(u) * .8);
    points.push([p.x, road(u) + 1 + random() * heightAt(u) * .5, p.z]);
  }
  const motes = floatingMotes({ kind: 'sparkle', color: 0xd8ff8a, size: .4, points, seed });
  motes.name = 'selva-cave-fireflies'; group.add(motes); ticks.push(motes.userData.tick);
  group.userData.assetCounts = { torches, giants: giants.length };
  return { group, update: (t, dt) => ticks.forEach(tick => tick(t, dt)) };
}
