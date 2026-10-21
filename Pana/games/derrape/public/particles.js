// Glowing point particles: one THREE.Points draw for a whole pool of soft
// round sprites, shaded in the fragment (a hot core fading to a halo), so a
// spark costs one vertex instead of a low-poly puff's dozens of triangles.
// Drift sparks (additive, they glow) and the lancha's water spray (normal
// blending, droplets) each own one field.
//
// A field advances itself in onBeforeRender with the real frame time (capped),
// so nothing in game.js has to tick it; with nothing alive it draws nothing.
import * as THREE from 'three';

const VERT = `
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vAlpha = alpha; vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (520.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

// `core` whitens the centre: hot sparks burn white inside their colour.
const FRAG = `
uniform float core;
varying float vAlpha;
varying vec3 vTint;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  float halo = pow(1.0 - r, 2.2);
  float hot = smoothstep(0.35, 0.0, r) * core;
  gl_FragColor = vec4(mix(vTint, vec3(1.0), hot), vAlpha * halo);
}`;

export function createParticleField(scene, { capacity = 600, additive = true, core = 0.8, name = 'particle-field' } = {}) {
  const geometry = new THREE.BufferGeometry();
  const pos = new Float32Array(capacity * 3), tint = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity), alpha = new Float32Array(capacity);
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint', new THREE.BufferAttribute(tint, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { core: { value: core } },
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.frustumCulled = false;   // particles spread over the map
  points.renderOrder = 3;
  // Per particle: velocity (3), age, life, base size, gravity, drag.
  const sim = new Float32Array(capacity * 8);
  const color = new THREE.Color();
  let count = 0, last = 0;

  function step(dt) {
    let n = 0;
    for (let i = 0; i < count; i++) {
      const s = i * 8, p = i * 3;
      const age = sim[s + 3] + dt, life = sim[s + 4];
      if (age >= life) continue;
      const drag = Math.exp(-sim[s + 7] * dt);
      let vx = sim[s] * drag, vy = (sim[s + 1] - sim[s + 6] * dt) * drag, vz = sim[s + 2] * drag;
      // compact live particles to the front as we go
      const d = n * 8, q = n * 3;
      pos[q] = pos[p] + vx * dt; pos[q + 1] = pos[p + 1] + vy * dt; pos[q + 2] = pos[p + 2] + vz * dt;
      tint[q] = tint[p]; tint[q + 1] = tint[p + 1]; tint[q + 2] = tint[p + 2];
      sim[d] = vx; sim[d + 1] = vy; sim[d + 2] = vz; sim[d + 3] = age; sim[d + 4] = life;
      sim[d + 5] = sim[s + 5]; sim[d + 6] = sim[s + 6]; sim[d + 7] = sim[s + 7];
      const t = age / life;
      size[n] = sim[d + 5] * (1 - t * 0.6);
      alpha[n] = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      n++;
    }
    count = n;
    geometry.setDrawRange(0, count);
    for (const name of ['position', 'tint', 'size', 'alpha']) geometry.attributes[name].needsUpdate = true;
  }

  points.onBeforeRender = () => {
    const now = performance.now(), dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (count) step(dt);
  };

  return {
    points,
    get count() { return count; },
    // One particle: at (x, y, z) moving (vx, vy, vz) m/s.
    emit(x, y, z, vx, vy, vz, { color: hex = 0xffffff, size: px = 0.5, life = 0.4, gravity = 9, drag = 1.5 } = {}) {
      if (points.parent !== scene) scene.add(points);   // a cleared scene may have dropped it
      if (!count) last = performance.now();
      if (count === capacity) return;
      const i = count++, s = i * 8, p = i * 3;
      color.set(hex);
      pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
      tint[p] = color.r; tint[p + 1] = color.g; tint[p + 2] = color.b;
      sim[s] = vx; sim[s + 1] = vy; sim[s + 2] = vz; sim[s + 3] = 0; sim[s + 4] = life * (0.75 + Math.random() * 0.5);
      sim[s + 5] = px * (0.7 + Math.random() * 0.6); sim[s + 6] = gravity; sim[s + 7] = drag;
      size[i] = sim[s + 5]; alpha[i] = 0;
      geometry.setDrawRange(0, count);
    },
    clear() { count = 0; geometry.setDrawRange(0, 0); },
  };
}
