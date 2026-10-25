// Scenery batching shared by the hand-built mountain worlds (Tovar, Sarisariñama).
//
// cellInstances: one InstancedMesh per map cell instead of one per kind across
// the whole map, so the camera's frustum skips cells behind and beside the
// car. A single map-wide batch is never culled.
//
// billboardCloud: a bank of camera-facing cloud cards (fog, mist, a sea of
// clouds, spray) in one draw. A Sprite each was one draw and one material
// update per card; hundreds of large transparent cards cost more in draw calls
// than in pixels. Every card in a bank shares one colour, so blending them in
// any order looks the same as the sorted sprites did. Drift, orbit and spray
// motion run in the vertex shader on the `uT` clock.
import * as THREE from 'three';

export function cellInstances(scene, list, geo, mat, { cast = true, cell = 160, pad = 3, color = new THREE.Color('#ffffff') } = {}) {
  if (!list.length) return [];
  const cells = new Map(), p = new THREE.Vector3();
  for (const it of list) {
    p.setFromMatrixPosition(it.m);
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(it);
  }
  return [...cells.values()].map(items => {
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || color); });
    im.castShadow = cast; im.receiveShadow = true;
    im.computeBoundingSphere(); im.boundingSphere.radius += pad; // wind sway stays inside
    scene.add(im);
    return im;
  });
}

const VERTEX = /* glsl */`
  attribute vec3 iCenter;
  attribute vec2 iSize;
  attribute vec4 iAnim;   // phase, strength, drift x (or spray speed), bob y
  attribute vec4 iOrbit;  // centre x, centre z, radius (0: no orbit), start angle
  uniform float uT;
  uniform vec4 uMotion;   // drift x speed, bob speed, orbit speed, spray (1) or not (0)
  varying vec2 vUv;
  varying float vAlpha;
  #include <fog_pars_vertex>
  void main() {
    vec3 c = iCenter;
    float ph = iAnim.x;
    vAlpha = iAnim.y;
    if (uMotion.w > 0.5) {
      float k = fract(uT * iAnim.z * 0.5 + ph);
      c.y += k * 1.6;
      vAlpha *= 1.0 - k;
    } else {
      if (iOrbit.z > 0.0) {
        float a = iOrbit.w + uT * uMotion.z;
        c.x = iOrbit.x + cos(a) * iOrbit.z;
        c.z = iOrbit.y + sin(a) * iOrbit.z;
      } else c.x += sin(uT * uMotion.x + ph) * iAnim.z;
      c.y += sin(uT * uMotion.y + ph) * iAnim.w;
    }
    vec4 mvPosition = modelViewMatrix * vec4(c, 1.0);
    vec2 world = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
    mvPosition.xy += position.xy * iSize * world;
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    #include <fog_vertex>
  }`;

const FRAGMENT = /* glsl */`
  uniform sampler2D map;
  uniform vec3 color;
  uniform float uLevel;
  uniform float uGain;
  uniform float uMax;
  varying vec2 vUv;
  varying float vAlpha;
  #include <fog_pars_fragment>
  void main() {
    vec4 tex = texture2D(map, vUv);
    gl_FragColor = vec4(color * tex.rgb, tex.a * clamp(vAlpha * uLevel * uGain, 0.0, uMax));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

// cards: [{ x, y, z, w, h, ph, k = 1, drift = 0, bob = 0, orbit: { x, z, r, a } }]
// motion: { drift, bob, orbit } speeds, or { spray: true } (cards rise 1.6 and
// fade; `drift` is then each card's speed). The card's opacity is
// clamp(k * level * gain, 0, max); change `uniforms.uLevel.value` to fade a bank.
export function billboardCloud(scene, cards, { map, color, fog = true, gain = 1, max = 1, level = 1, motion = {} }) {
  const geo = new THREE.InstancedBufferGeometry();
  const plane = new THREE.PlaneGeometry(1, 1);
  geo.index = plane.index;
  geo.setAttribute('position', plane.attributes.position);
  geo.setAttribute('uv', plane.attributes.uv);
  const n = cards.length, center = new Float32Array(n * 3), size = new Float32Array(n * 2), anim = new Float32Array(n * 4), orbit = new Float32Array(n * 4);
  cards.forEach((c, i) => {
    center.set([c.x, c.y, c.z], i * 3); size.set([c.w, c.h], i * 2);
    anim.set([c.ph || 0, c.k ?? 1, c.drift || 0, c.bob || 0], i * 4);
    if (c.orbit) orbit.set([c.orbit.x, c.orbit.z, c.orbit.r, c.orbit.a], i * 4);
  });
  geo.setAttribute('iCenter', new THREE.InstancedBufferAttribute(center, 3));
  geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2));
  geo.setAttribute('iAnim', new THREE.InstancedBufferAttribute(anim, 4));
  geo.setAttribute('iOrbit', new THREE.InstancedBufferAttribute(orbit, 4));
  geo.instanceCount = n;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    map: { value: null }, color: { value: new THREE.Color(color) }, uT: { value: 0 },
    uLevel: { value: level }, uGain: { value: gain }, uMax: { value: max },
    uMotion: { value: new THREE.Vector4(motion.drift || 0, motion.bob || 0, motion.orbit || 0, motion.spray ? 1 : 0) },
  }]);
  uniforms.map.value = map;
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // cards drift; the bank is one draw either way
  mesh.raycast = () => {};
  mesh.name = 'cloud-bank';
  scene.add(mesh);
  return { mesh, uniforms };
}
