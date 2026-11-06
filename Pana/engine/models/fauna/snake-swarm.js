// A swarm of snakes in three draw calls, however many there are: one instanced
// mesh for every body segment, one for the eyes, one for the cracks they pour
// from. createSnakeInstances() takes chains of points (engine/play/verlet-chains.js)
// and writes matrices straight into the instance buffers, allocating nothing.
// +Z forward. snakeSwarm() is a still pile of them for Pana Studio.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SKINS = [0xc9963e, 0xa98438, 0x8d8a4a, 0xb56f34], BAND = 0x7a5526, HEAD = 0x6a4a22;

function eyesGeometry() {
  const pair = [-1, 1].map(s => { const g = new THREE.SphereGeometry(.018, 6, 4); g.translate(s * .058, .04, .055); return g; });
  const merged = mergeGeometries(pair); pair.forEach(g => g.dispose());
  return merged;
}
// A jagged black mouth in the floor with a few chips of stone thrown up around it.
function crackGeometry() {
  const mouth = new THREE.CircleGeometry(1, 14), at = mouth.attributes.position;
  for (let i = 1; i < at.count; i++) { const r = .55 + .45 * Math.abs(Math.sin(i * 2.7)); at.setXY(i, at.getX(i) * r, at.getY(i) * r * .8); }
  mouth.rotateX(-Math.PI / 2); mouth.translate(0, .015, 0);
  const parts = [mouth.toNonIndexed()]; mouth.dispose();
  for (let i = 0; i < 6; i++) { const chip = new THREE.TetrahedronGeometry(.07 + (i % 3) * .03), a = i * 1.1; chip.translate(Math.cos(a) * 1.05, .03, Math.sin(a) * .9); parts.push(chip); }
  for (const part of parts) { part.deleteAttribute('uv'); part.computeVertexNormals(); }
  const merged = mergeGeometries(parts); parts.forEach(g => g.dispose());
  return merged;
}

export function createSnakeInstances({ snakes, segments, link, cracks = 4 }) {
  const group = new THREE.Group(); group.name = 'Enjambre de culebras';
  const bodyGeometry = new THREE.SphereGeometry(1, 7, 4), eyeGeometry = eyesGeometry(), mouthGeometry = crackGeometry();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffe24a });
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
  const body = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, snakes * segments), eyes = new THREE.InstancedMesh(eyeGeometry, eyeMaterial, snakes), holes = new THREE.InstancedMesh(mouthGeometry, mouthMaterial, cracks);
  for (const mesh of [body, eyes, holes]) { mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(mesh); }
  // Each slot keeps its colour: bands along the body, a skin per snake. Set once.
  const tint = new THREE.Color(), band = new THREE.Color(BAND), head = new THREE.Color(HEAD);
  for (let c = 0; c < snakes; c++) {
    const skin = new THREE.Color(SKINS[c % SKINS.length]);
    for (let i = 0; i < segments; i++) body.setColorAt(c * segments + i, i === 0 ? head : i % 3 === 1 ? tint.copy(band) : tint.copy(skin).multiplyScalar(.82 + .18 * Math.sin(c * 3.1 + i)));
  }
  body.instanceColor.needsUpdate = true;
  // Half-width of each segment: a broad head, a thin neck, a body tapering to nothing.
  const width = new Float32Array(segments), height = new Float32Array(segments), length = link * .68;
  for (let i = 0; i < segments; i++) { const t = i / (segments - 1); width[i] = i === 0 ? .1 : i === 1 ? .055 : .022 + .06 * Math.sin(Math.PI * Math.pow(t, .62)); height[i] = i === 0 ? .062 : width[i] * .85; }
  const matrices = body.instanceMatrix.array, eyeMatrices = eyes.instanceMatrix.array;
  let bodyCount = 0, eyeCount = 0;
  // A column-major transform: forward along (fx, fy, fz), level, scaled, at (x, y, z).
  function write(out, o, x, y, z, fx, fy, fz, sx, sy, sz) {
    const flat = Math.sqrt(fx * fx + fz * fz), rx = flat > 1e-5 ? fz / flat : 1, rz = flat > 1e-5 ? -fx / flat : 0;
    const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
    out[o] = rx * sx; out[o + 1] = 0; out[o + 2] = rz * sx; out[o + 3] = 0;
    out[o + 4] = ux * sy; out[o + 5] = uy * sy; out[o + 6] = uz * sy; out[o + 7] = 0;
    out[o + 8] = fx * sz; out[o + 9] = fy * sz; out[o + 10] = fz * sz; out[o + 11] = 0;
    out[o + 12] = x; out[o + 13] = y; out[o + 14] = z; out[o + 15] = 1;
  }
  return {
    group, body, eyes, holes,
    begin() { bodyCount = eyeCount = 0; },
    // One chain: `segments` points from index `start`. ground(x, z) is the floor under a point.
    chain(xs, ys, zs, start, ground) {
      let fx = 0, fy = 0, fz = 1;
      for (let i = 0; i < segments; i++) {
        const k = start + i, a = i === 0 ? k + 1 : k - 1;
        let dx = i === 0 ? xs[k] - xs[a] : xs[a] - xs[k], dy = i === 0 ? ys[k] - ys[a] : ys[a] - ys[k], dz = i === 0 ? zs[k] - zs[a] : zs[a] - zs[k];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 1e-4) { fx = dx / d; fy = dy / d; fz = dz / d; }
        const y = ground(xs[k], zs[k]) + ys[k] + height[i];
        write(matrices, bodyCount * 16, xs[k], y, zs[k], fx, fy, fz, width[i], height[i], i === 0 ? .13 : length);
        bodyCount++;
        if (i === 0) write(eyeMatrices, eyeCount++ * 16, xs[k], y, zs[k], fx, fy, fz, 1, 1, 1);
      }
    },
    end() {
      body.count = bodyCount; eyes.count = eyeCount;
      body.instanceMatrix.needsUpdate = eyes.instanceMatrix.needsUpdate = true;
    },
    // Where the cracks are: [{ x, y, z, h, size }].
    crack(i, x, y, z, h, size) { write(holes.instanceMatrix.array, i * 16, x, y, z, Math.sin(h), 0, Math.cos(h), size, 1, size); },
    cracks(count) { holes.count = count; holes.instanceMatrix.needsUpdate = true; },
    clear() { body.count = eyes.count = holes.count = 0; },
    dispose() {
      group.removeFromParent();
      for (const mesh of [body, eyes, holes]) mesh.dispose();
      for (const g of [bodyGeometry, eyeGeometry, mouthGeometry]) g.dispose();
      for (const m of [bodyMaterial, eyeMaterial, mouthMaterial]) m.dispose();
    },
  };
}

// A pile of them around a crack, for looking at. tick(t) makes them writhe.
export function snakeSwarm({ snakes = 14, segments = 12, link = .17 } = {}) {
  const swarm = createSnakeInstances({ snakes, segments, link, cracks: 1 }), g = swarm.group, flat = () => 0;
  const xs = new Float32Array(snakes * segments), ys = new Float32Array(snakes * segments), zs = new Float32Array(snakes * segments);
  swarm.crack(0, 0, 0, 0, .4, .9); swarm.cracks(1);
  g.userData = { assetId: 'snake-swarm', previewBounds: [[-2.4, 0, -2.4], [2.4, .4, 2.4]], dispose: swarm.dispose,
    tick(t = 0) {
      // The pile drifts a little as a whole too, and is back in place at t = 0.
      g.rotation.y = Math.sin(t * .4) * .15;
      swarm.begin();
      for (let c = 0; c < snakes; c++) {
        const a = c * 2.4, r0 = .3 + (c % 4) * .28, start = c * segments;
        for (let i = 0; i < segments; i++) {
          const k = start + i, r = r0 + (segments - i) * link * .9, s = Math.sin(t * 3 + c + i * .6) * .16;
          xs[k] = Math.cos(a + s) * r; ys[k] = 0; zs[k] = Math.sin(a + s) * r;
        }
        swarm.chain(xs, ys, zs, start, flat);
      }
      swarm.end();
    } };
  g.userData.tick(0);
  return g;
}
