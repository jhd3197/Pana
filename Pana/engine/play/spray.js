// Pooled flying bits: paint droplets, dirt clods, water spray, sparks. Every
// bit of one spray is an instance of a single mesh, so a spray is one draw
// call however many bits fly, and nothing is allocated per frame or per bit.
// Bits fall with gravity and drag, spin, shrink at the end of their life, and
// may stick where `solid(x, y)` says there is ground (a drop of paint stays a
// moment, flattened, before it soaks in) or die on the water line, with a
// callback so the game can ring the water there.
//
//   const drops = createSpray(scene, { shape: 'drop' });               // round, lit
//   const sparks = createSpray(scene, { shape: 'spark', additive: true }); // glowing, fades to black
//   drops.burst({ x, y, z }, { count: 24, color: '#e8569b', speed: 9, dir: { x: 0, y: 1 }, cone: 1.2, size: .14, life: 1.2 });
//   drops.update(dt, { solid: (x, y) => solidAt(mask, x, y), water: 4.2, onWater: (x, z) => … });
import * as THREE from 'three';

const SHAPES = {
  drop: () => new THREE.IcosahedronGeometry(1, 1),
  clod: () => new THREE.DodecahedronGeometry(1, 0),
  chip: () => new THREE.TetrahedronGeometry(1, 0),
  spark: () => new THREE.OctahedronGeometry(1, 0),
  ring: () => new THREE.RingGeometry(.82, 1, 28).rotateX(-Math.PI / 2),
};
const STRIDE = 16;   // x y z, vx vy vz, age life, size, spin, stuck, r g b, flat, grow
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// shape: drop | clod | chip | spark | ring (a flat ring that grows, for water); additive bits glow and fade.
export function createSpray(scene, { shape = 'drop', capacity = 256, additive = false, gravity = 18, drag = .6, roughness = .35, flat = false } = {}) {
  const geometry = SHAPES[shape](), material = additive
    ? new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })
    : new THREE.MeshStandardMaterial({ roughness, metalness: 0, flatShading: flat || shape === 'clod' || shape === 'chip' });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; mesh.raycast = () => {};
  mesh.name = `spray · ${shape}`;
  scene.add(mesh);
  const data = new Float32Array(capacity * STRIDE), ring = shape === 'ring';
  let count = 0, seed = 1;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  // dir: the main direction (x, y; z is spread only); cone: radians either side of it;
  // speed: metres/s (± jitter); up: added to vy; size; life seconds; grow: a ring's final size.
  function burst(at, { count: n = 12, color = '#ffffff', speed = 6, jitter = .5, dir = null, cone = Math.PI, up = 0, depth = .4, size = .12, life = 1, grow = 0, spread = 0 } = {}) {
    _c.set(color);
    const base = dir ? Math.atan2(dir.y, dir.x) : Math.PI / 2;
    for (let i = 0; i < n; i++) {
      // Full: the oldest bit makes room (it is the one about to go anyway).
      if (count === capacity) remove(0);
      const o = count++ * STRIDE, a = base + (rand() * 2 - 1) * cone, v = speed * (1 - jitter / 2 + rand() * jitter);
      data[o] = at.x + (rand() - .5) * spread; data[o + 1] = at.y + (rand() - .5) * spread; data[o + 2] = at.z + (rand() - .5) * spread * .5;
      data[o + 3] = Math.cos(a) * v; data[o + 4] = Math.sin(a) * v + up; data[o + 5] = (rand() - .5) * 2 * depth * v * .3;
      data[o + 6] = 0; data[o + 7] = life * (.7 + rand() * .6); data[o + 8] = size * (.6 + rand() * .8); data[o + 9] = rand() * 6.28;
      data[o + 10] = 0; data[o + 11] = _c.r; data[o + 12] = _c.g; data[o + 13] = _c.b; data[o + 14] = 1; data[o + 15] = grow;
    }
    mesh.visible = true;
  }

  function remove(n) {
    const last = --count;
    if (n !== last) data.copyWithin(n * STRIDE, last * STRIDE, last * STRIDE + STRIDE);
  }

  // solid(x, y): ground there; water: the water line (bits below it die and call onWater(x, z)).
  function update(dt, { solid = null, water = -Infinity, onWater = null } = {}) {
    if (!count && !mesh.visible) return;
    const slow = Math.exp(-drag * dt);
    for (let n = 0; n < count;) {
      const o = n * STRIDE;
      data[o + 6] += dt;
      if (data[o + 6] >= data[o + 7]) { remove(n); continue; }
      if (!ring && !data[o + 10]) {
        data[o + 4] -= gravity * dt;
        data[o + 3] *= slow; data[o + 4] *= slow; data[o + 5] *= slow;
        const x = data[o] + data[o + 3] * dt, y = data[o + 1] + data[o + 4] * dt;
        if (solid && data[o + 4] < 0 && solid(x, y)) {
          // Stuck: a flattened blob that soaks in over what is left of its life (at most .8 s).
          data[o + 10] = 1; data[o + 14] = .35; data[o + 7] = Math.min(data[o + 7], data[o + 6] + .8);
        } else if (y < water && data[o + 4] < 0) {
          if (onWater) onWater(x, data[o + 2]);
          remove(n); continue;
        } else { data[o] = x; data[o + 1] = y; data[o + 2] += data[o + 5] * dt; data[o + 9] += dt * 7; }
      }
      n++;
    }
    for (let n = 0; n < count; n++) {
      const o = n * STRIDE, k = data[o + 6] / data[o + 7];
      let s = data[o + 8];
      if (ring) s = data[o + 8] + (data[o + 15] - data[o + 8]) * (1 - (1 - k) ** 2);
      else s *= k > .7 ? 1 - (k - .7) / .3 : 1;
      const fade = additive ? (1 - k) ** 1.5 : 1;
      _p.set(data[o], data[o + 1], data[o + 2]);
      if (ring) _q.identity(); else _q.setFromEuler(_e.set(data[o + 9], data[o + 9] * .7, 0));
      _s.set(s, ring ? 1 : s * data[o + 14], s);
      mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      mesh.setColorAt(n, _c.setRGB(data[o + 11] * fade, data[o + 12] * fade, data[o + 13] * fade));
    }
    mesh.count = count; mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }

  return {
    mesh, burst, update,
    get active() { return count; },
    clear() { count = 0; mesh.count = 0; mesh.visible = false; },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); mesh.dispose(); },
  };
}
