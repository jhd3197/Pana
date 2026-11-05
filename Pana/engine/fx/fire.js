// A fire that looks alive and stays cheap: two draws whatever its size. Licking
// tongues in layers (red-orange outside, orange, a white-hot core) and a soft halo are
// camera-facing cards drawn by one instanced shader, embers one Points object. It owns
// no light: `light` says what a fire does to the warm light you lend it, so the shadows
// dance on a fixed pool of lights. Numbers live in engine/fx/fire-sim.js (FIRE_TUNING);
// docs/SHARED-ENGINE.md, "Fire".
//
//   const fire = createFire({ height: 1.3, radius: .3, seed: 7, quality: 'media', onCrackle });
//   scene.add(fire.group); fire.group.position.set(x, 1.3, z);
//   fire.update(dt, time, { distance });   // embers and crackles only when near
//   fire.feed(1);                          // a log on it: embers, a flare-up, a light spike
//   pool.position.copy(fire.group.position).add(fire.light); pool.intensity = power * fire.light.intensity;
import * as THREE from 'three';
import { addFeed, createCrackle, createEmberPool, flameLayout, fireQuality, FIRE_TUNING, lightState, LAYER, stepFeed } from './fire-sim.js';

const FLAME_VERTEX = /* glsl */`
  uniform float uTime, uFlare, uLevel, uSway;
  attribute vec3 aOffset; attribute vec4 aShape;   // width, height, phase, layer
  varying vec2 vUv; varying float vPhase, vLayer;
  #include <fog_pars_vertex>
  void main() {
    vec4 base = modelMatrix * vec4(aOffset, 1.0);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    float phase = aShape.z, layer = aShape.w, v = position.y + 0.5;
    vec3 world;
    if (layer > 2.5) {
      // The halo hangs in the air, facing the camera.
      vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      float breathe = 0.92 + 0.08 * sin(uTime * 7.1 + phase) + 0.25 * uFlare;
      world = base.xyz + vec3(0.0, aShape.y * 0.26, 0.0) + (right * position.x * aShape.x + up * position.y * aShape.y) * breathe;
    } else {
      // Tongues stand up from their base, leaning and stretching on their own clock.
      right = normalize(vec3(right.x, 0.0, right.z));
      float height = aShape.y * (0.84 + 0.13 * sin(uTime * 5.3 + phase * 3.0) + 0.08 * sin(uTime * 11.7 + phase) + 0.42 * uFlare) * mix(0.25, 1.0, uLevel);
      float lean = (sin(uTime * 2.7 + phase) * 0.55 + sin(uTime * 6.1 + phase * 2.0) * 0.3) * 0.22 * aShape.y * v * v * uSway;
      world = base.xyz + right * (position.x * aShape.x * (1.0 + 0.2 * uFlare) + lean) + vec3(0.0, v * height, 0.0);
    }
    vec4 mvPosition = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vUv = vec2(position.x * 2.0, v); vPhase = phase; vLayer = layer;
    #include <fog_vertex>
  }`;
const FLAME_FRAGMENT = /* glsl */`
  uniform float uTime, uFlare, uLevel;
  uniform vec3 uHot, uYellow, uOrange, uRed, uEmber, uHalo;
  varying vec2 vUv; varying float vPhase, vLayer;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float licks(vec2 p) {
    float n = noise(p) * 0.65;
    #ifdef DETAILED
    n += noise(p * 2.13 + 3.7) * 0.35;
    #else
    n += 0.175;
    #endif
    return n;
  }
  void main() {
    float fog = 1.0;
    #ifdef USE_FOG
    #ifdef FOG_EXP2
    fog = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
    fog = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    #endif
    if (vLayer > 2.5) {
      vec2 q = vec2(vUv.x, vUv.y * 2.0 - 1.0);
      float glow = pow(max(0.0, 1.0 - length(q)), 2.4);
      // Alpha 0: purely added light, so the halo warms what is behind it.
      gl_FragColor = vec4(uHalo * glow * (0.26 + 0.28 * uFlare) * uLevel * fog, 0.0);
      return;
    }
    float t = uTime * (1.5 + vLayer * 0.25) + vPhase * 7.0, y = vUv.y;
    // The air rising through it pushes the tongue sideways, more toward the tip.
    float x = vUv.x + (licks(vec2(vUv.x * 1.3 + vPhase, y * 2.1 - t)) - 0.5) * (0.22 + 0.95 * y);
    // A teardrop: closes at the bottom, narrows to a point.
    float wide = smoothstep(0.0, 0.14, y) * pow(max(0.0, 1.0 - y), 0.72);
    float edge = clamp(1.0 - abs(x) / max(wide, 0.001), 0.0, 1.0);
    // Holes eat in from the tip, so the top tears into separate tongues.
    float tear = licks(vec2(x * 2.3 + vPhase * 3.0, y * 3.4 - t * 1.25));
    // The core fills up: white-hot right across, not just along a thin line.
    if (vLayer > 1.5) edge = sqrt(edge);
    float heat = edge * (1.0 - y * 0.5) - max(0.0, tear - 0.34) * y * 1.5;
    // Outer tongues never get past orange; only the core reaches white.
    heat *= vLayer < 0.5 ? 0.62 : vLayer < 1.5 ? 1.0 : 1.75;
    float a = smoothstep(0.04, 0.2, heat);
    vec3 c = mix(uEmber, uRed, smoothstep(0.03, 0.2, heat));
    c = mix(c, uOrange, smoothstep(0.2, 0.42, heat));
    c = mix(c, uYellow, smoothstep(0.42, 0.68, heat));
    c = mix(c, uHot, smoothstep(0.68, 0.95, heat));
    // Premultiplied, part opaque: a flame keeps its colour in front of a bright lit wall,
    // where adding light alone burns out to white.
    float cover = a * (vLayer < 0.5 ? 0.72 : vLayer < 1.5 ? 0.82 : 0.92) * mix(0.35, 1.0, uLevel) * fog;
    gl_FragColor = vec4(c * cover * (1.0 + uFlare * 0.25), cover);
  }`;
const EMBER_VERTEX = /* glsl */`
  uniform float uPx, uSize, uTime;
  attribute float aLife, aPhase;
  varying float vLife, vBlink;
  #include <fog_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vLife = aLife;
    // Sparks blink as they tumble.
    vBlink = 0.6 + 0.4 * sin(uTime * (14.0 + aPhase * 4.0) + aPhase * 9.0);
    gl_PointSize = aLife <= 0.0 ? 0.0 : uSize * (0.55 + 0.45 * aLife) * uPx * projectionMatrix[1][1] / max(0.2, -mvPosition.z);
    #include <fog_vertex>
  }`;
const EMBER_FRAGMENT = /* glsl */`
  uniform vec3 uYellow, uOrange, uRed;
  varying float vLife, vBlink;
  #include <fog_pars_fragment>
  void main() {
    float fog = 1.0;
    #ifdef USE_FOG
    #ifndef FOG_EXP2
    fog = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    #endif
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float a = pow(max(0.0, 1.0 - dot(q, q)), 1.6);
    vec3 c = mix(uRed, uOrange, smoothstep(0.05, 0.45, vLife)); c = mix(c, uYellow, smoothstep(0.45, 0.9, vLife));
    gl_FragColor = vec4(c * a * smoothstep(0.0, 0.3, vLife) * vBlink * 1.5 * fog, 1.0);
  }`;
const PALETTE = { uHot: 0xfff7d6, uYellow: 0xffc62e, uOrange: 0xff7410, uRed: 0xc92a06, uEmber: 0x5a0e00, uHalo: 0xff7a24 };
const srgb = hex => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
const fogUniforms = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
const blend = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const premultiplied = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };
const quad = new THREE.PlaneGeometry(1, 1);

// `onCrackle({ strength, x, y, z })` when a spark pops (local to the group's parent);
// `calm` for reduced motion; `reach` how close a viewer must be for embers and crackles.
export function createFire({ height = 1, radius = .25, seed = 1, quality = 'media', calm = false, reach = 16, emberSize = .042, onCrackle = null } = {}) {
  const group = new THREE.Group(); group.name = 'fire';
  const phase = (seed * 2.399963) % 6.2831;
  let level = fireQuality(quality), flare = 0, dim = 1;
  const palette = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, { value: srgb(v) }]));
  const flameUniforms = { ...fogUniforms(), ...palette, uTime: { value: 0 }, uFlare: { value: 0 }, uLevel: { value: 1 }, uSway: { value: calm ? .45 : 1 } };
  const flameMaterial = new THREE.ShaderMaterial({ uniforms: flameUniforms, vertexShader: FLAME_VERTEX, fragmentShader: FLAME_FRAGMENT, fog: true, side: THREE.DoubleSide, ...premultiplied });
  const flameGeometry = new THREE.InstancedBufferGeometry();
  flameGeometry.index = quad.index; flameGeometry.setAttribute('position', quad.attributes.position);
  const most = Math.max(...Object.values(FIRE_TUNING.layers).map(l => l.halo + l.outer + l.mid + l.core));
  const offsets = new THREE.InstancedBufferAttribute(new Float32Array(most * 3), 3), shapes = new THREE.InstancedBufferAttribute(new Float32Array(most * 4), 4);
  flameGeometry.setAttribute('aOffset', offsets); flameGeometry.setAttribute('aShape', shapes);
  // Instanced cards are placed in the shader: the sphere covers the whole fire and its halo.
  flameGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * .5, 0), height * 2.2 + radius);
  const flames = new THREE.Mesh(flameGeometry, flameMaterial); flames.renderOrder = 4; group.add(flames);

  // Embers: the pool is the largest quality's; a lower one only uses part of it.
  const pool = createEmberPool({ cap: Math.max(...Object.values(FIRE_TUNING.embers.cap)), seed, radius, height });
  const emberGeometry = new THREE.BufferGeometry();
  const emberPositions = new THREE.BufferAttribute(pool.positions, 3).setUsage(THREE.DynamicDrawUsage), emberLives = new THREE.BufferAttribute(pool.lives, 1).setUsage(THREE.DynamicDrawUsage);
  emberGeometry.setAttribute('position', emberPositions); emberGeometry.setAttribute('aLife', emberLives); emberGeometry.setAttribute('aPhase', new THREE.BufferAttribute(pool.phases, 1));
  emberGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height, 0), height * 3 + 2);
  const emberUniforms = { ...fogUniforms(), uYellow: palette.uYellow, uOrange: palette.uOrange, uRed: palette.uRed, uPx: { value: 400 }, uSize: { value: emberSize }, uTime: { value: 0 } };
  const emberMaterial = new THREE.ShaderMaterial({ uniforms: emberUniforms, vertexShader: EMBER_VERTEX, fragmentShader: EMBER_FRAGMENT, fog: true, ...blend });
  const embers = new THREE.Points(emberGeometry, emberMaterial); embers.renderOrder = 5; group.add(embers);
  embers.onBeforeRender = renderer => { emberUniforms.uPx.value = renderer.domElement.height / 2; };
  const crackle = createCrackle({ seed }), light = { intensity: 1, x: 0, y: 0, z: 0, warmth: .5 };

  function setQuality(next) {
    level = fireQuality(next);
    const cards = flameLayout({ quality: level, height, radius, seed });
    cards.forEach((c, i) => { offsets.setXYZ(i, c.x, 0, c.z); shapes.setXYZW(i, c.width, c.height, c.phase, c.layer); });
    offsets.needsUpdate = shapes.needsUpdate = true; flameGeometry.instanceCount = cards.length;
    pool.setCap(FIRE_TUNING.embers.cap[level]);
    const detailed = level !== 'baja';
    if (!!flameMaterial.defines.DETAILED !== detailed) { if (detailed) flameMaterial.defines.DETAILED = 1; else delete flameMaterial.defines.DETAILED; flameMaterial.needsUpdate = true; }
    return cards;
  }
  setQuality(level);

  return {
    group, light, embers: pool,
    get flare() { return flare; },
    get quality() { return level; },
    get cards() { return flameGeometry.instanceCount; },
    get level() { return dim; },
    setQuality,
    // Everything that dims a fire without killing it (a blackout): 0..1.
    setLevel(value) { dim = value; flameUniforms.uLevel.value = value; },
    // Something to burn: a burst of embers, a taller flame and a spike in its light.
    feed(strength = 1) {
      flare = addFeed(flare, strength);
      pool.spawn(Math.round(strength * Math.min(FIRE_TUNING.feed.embers, FIRE_TUNING.embers.cap[level])));
      return flare;
    },
    update(dt, time, { distance = 0 } = {}) {
      flare = stepFeed(flare, dt);
      flameUniforms.uTime.value = emberUniforms.uTime.value = time;
      flameUniforms.uFlare.value = flare;
      lightState(time, phase, flare, calm, light);
      const near = distance < reach && dim > .15;
      embers.visible = near || pool.alive > 0;
      if (!embers.visible) return;
      if (near) {
        const pops = crackle.step(dt, flare);
        if (pops) { pool.spawn(pops); onCrackle?.({ strength: Math.min(1, pops / 3 + flare * .3), x: group.position.x, y: group.position.y + height * .4, z: group.position.z }); }
      }
      pool.step(dt, time, near ? pool.cap / 1.2 : 0);
      emberPositions.needsUpdate = emberLives.needsUpdate = true;
    },
    dispose() { flameGeometry.dispose(); flameMaterial.dispose(); emberGeometry.dispose(); emberMaterial.dispose(); group.removeFromParent(); },
  };
}
export { LAYER };
