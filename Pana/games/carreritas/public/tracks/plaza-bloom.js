import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

// The roadside instances keep their species names after baking. Opt in only
// their crowns; the same shared source material also serves unrelated plants.
export function plazaBloom(group) {
  const crowns = [], emitters = [], matrix = new THREE.Matrix4();
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(o => {
    const pink = o.name === 'festive-apamate';
    if (!o.isInstancedMesh || (!pink && o.name !== 'festive-araguaney')) return;
    const tags = o.geometry.attributes.natureSurface;
    if (!tags || !tags.array.includes(170)) return;
    o.userData.bloom = true; crowns.push(o);
    o.geometry.computeBoundingBox();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, matrix); matrix.premultiply(o.matrixWorld).premultiply(inverse);
      const bounds = o.geometry.boundingBox.clone().applyMatrix4(matrix);
      const base = new THREE.Vector3().setFromMatrixPosition(matrix);
      emitters.push({ x: (bounds.min.x + bounds.max.x) / 2, z: (bounds.min.z + bounds.max.z) / 2,
        y: base.y, height: Math.max(1, bounds.max.y - base.y),
        radius: Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z) * 0.35,
        color: pink ? 0xf4a4d4 : 0xffd43d });
    }
  });
  if (!emitters.length) return null;
  const random = rng(711), origins = [], seeds = [], colors = [];
  // Interleave trees so every quality tier retains petals at every location.
  for (let i = 0; i < 36; i++) for (const e of emitters) {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * e.radius;
    origins.push(e.x + Math.cos(angle) * radius, e.y, e.z + Math.sin(angle) * radius, e.height * (0.65 + random() * 0.25));
    seeds.push(random(), random(), random(), random());
    new THREE.Color(e.color).toArray(colors, colors.length);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5,-.5,0, .5,-.5,0, .5,.5,0, -.5,.5,0], 3));
  geometry.setIndex([0,1,2,0,2,3]);
  geometry.setAttribute('petalOrigin', new THREE.InstancedBufferAttribute(new Float32Array(origins), 4));
  geometry.setAttribute('petalSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4));
  geometry.setAttribute('petalColor', new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));
  geometry.instanceCount = origins.length / 4;
  geometry.boundingBox = new THREE.Box3();
  for (let i = 0; i < origins.length; i += 4) {
    geometry.boundingBox.expandByPoint(new THREE.Vector3(origins[i], origins[i + 1], origins[i + 2]));
    geometry.boundingBox.expandByPoint(new THREE.Vector3(origins[i], origins[i + 1] + origins[i + 3], origins[i + 2]));
  }
  geometry.boundingBox.expandByScalar(2.5);
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const material = new THREE.ShaderMaterial({
    uniforms: { ...THREE.UniformsLib.fog, bloomTime: { value: 0 } },
    transparent: true, depthWrite: false, fog: true,
    vertexShader: /* glsl */`
      attribute vec4 petalOrigin, petalSeed;
      attribute vec3 petalColor;
      uniform float bloomTime;
      varying vec2 petalUv;
      varying vec3 petalTint;
      varying float petalAlpha;
      #include <fog_pars_vertex>
      void main() {
        float t = bloomTime, phase = petalSeed.x * 6.283185;
        float age = fract(t * (0.055 + petalSeed.y * 0.025) + petalSeed.z);
        vec3 p = petalOrigin.xyz;
        p.y += 0.4 + (1.0 - age) * petalOrigin.w;
        p.xz += vec2(sin(t * 0.7 + phase), cos(t * 0.53 + phase)) * 0.45
          + vec2(1.6, 0.6) * age;
        vec4 world = modelMatrix * vec4(p, 1.0);
        float d = distance(cameraPosition, world.xyz);
        float bloom = 0.56 + 0.44 * cos(t * 0.034906585);
        petalAlpha = smoothstep(0.0, 0.12, age) * (1.0 - smoothstep(0.8, 1.0, age))
          * smoothstep(1.0, 2.5, d) * (1.0 - smoothstep(65.0, 100.0, d)) * (0.3 + bloom * 0.7);
        vec4 mvPosition = viewMatrix * world;
        float spin = t * (1.0 + petalSeed.w) + phase;
        vec2 shape = position.xy * vec2(0.5 + 0.5 * abs(sin(spin * 0.7)), 1.0);
        mvPosition.xy += mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * shape * (0.17 + petalSeed.w * 0.12);
        gl_Position = projectionMatrix * mvPosition;
        petalUv = position.xy * 2.0; petalTint = petalColor;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      varying vec2 petalUv;
      varying vec3 petalTint;
      varying float petalAlpha;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = petalUv;
        float edge = dot(p * vec2(1.15, 1.0), p * vec2(1.15, 1.0));
        float notch = smoothstep(0.08, 0.2, abs(p.x) + (1.0 - p.y) * 0.5);
        float a = (1.0 - smoothstep(0.65, 1.0, edge)) * notch * petalAlpha;
        if (a < 0.015) discard;
        gl_FragColor = vec4(petalTint * (0.85 + 0.15 * p.y), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const petals = new THREE.Mesh(geometry, material);
  petals.name = 'plaza-petals';
  petals.userData.petalField = { full: geometry.instanceCount, medium: emitters.length * 12, trees: emitters.length };
  // Read live materials: Studio clones them for its own preview controls.
  petals.userData.tick = t => {
    t = Number.isFinite(t) ? Math.max(0, t) : 0;
    petals.material.uniforms.bloomTime.value = t;
    for (const crown of crowns) for (const m of [].concat(crown.material)) {
      if (m.userData.bloomTime) m.userData.bloomTime.value = t;
    }
  };
  let released = false;
  petals.userData.dispose = () => { if (!released) { released = true; material.dispose(); } };
  group.add(petals);
  return petals;
}
