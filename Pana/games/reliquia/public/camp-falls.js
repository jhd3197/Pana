// What moves or glows in the far cavern, all of it cheap: the falls as scrolling
// strips, the amber light cones, the lake's dark sheet, spores on the air and one
// draw of far halos. No lights, no particles per frame: shaders read one clock.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/random.js';
import { LAKE_Y, FALLS } from './camp-vista.js';

const CAMP = [0, 14], CAMP_HALF = [20, 18];

// Tall thin strips with a little bulge at the top, facing the camp. One draw.
export function createFallsMesh() {
  const parts = [];
  for (const f of FALLS) {
    const height = f.top - LAKE_Y, g = new THREE.PlaneGeometry(f.width, height, 1, 8);
    const p = g.attributes.position;
    // Fans out as it falls, and hangs out from the lip.
    for (let i = 0; i < p.count; i++) { const k = .5 - p.getY(i) / height; p.setX(i, p.getX(i) * (.72 + k * .55)); p.setZ(i, 3 * Math.sin(Math.min(1, k * 7) * 1.57)); }
    g.translate(0, LAKE_Y + height / 2, 0); g.rotateY(Math.atan2(10 - f.x, 5 - f.z)); g.translate(f.x, 0, f.z);
    parts.push(g);
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float n(vec2 p) { return fract(sin(dot(floor(p), vec2(12.9, 78.2))) * 43758.5); }
      float sn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(n(i), n(i + vec2(1, 0)), f.x), mix(n(i + vec2(0, 1)), n(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float edge = smoothstep(0.0, .28, vUv.x) * smoothstep(1.0, .72, vUv.x);
        float flow = sn(vec2(vUv.x * 9.0, vUv.y * 26.0 + uTime * 1.4)) * .6 + sn(vec2(vUv.x * 21.0, vUv.y * 60.0 + uTime * 2.3)) * .4;
        float a = smoothstep(.25, .8, flow + edge * .3) * edge * (.32 + vUv.y * .26) + smoothstep(.2, .0, vUv.y) * edge * .3;
        gl_FragColor = vec4(vec3(.42, .68, .82) * a, 1.0); }`,
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), material); mesh.name = 'Cascadas'; mesh.renderOrder = 2;
  parts.forEach(g => g.dispose());
  return mesh;
}

// Light cones: open cylinders, brightest at the source, soft at the edges. One draw for all.
export function createBeams(beams) {
  const parts = [], up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (const { from, to, near, far, color, strength = 1 } of beams) {
    dir.set(from[0] - to[0], from[1] - to[1], from[2] - to[2]);
    const length = dir.length(), g = new THREE.CylinderGeometry(near, far, length, 18, 1, true);
    g.applyQuaternion(q.setFromUnitVectors(up, dir.normalize())); g.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
    c.set(color).convertLinearToSRGB(); const tint = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < tint.length; i += 3) { tint[i] = c.r * strength; tint[i + 1] = c.g * strength; tint[i + 2] = c.b * strength; }
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3)); parts.push(g);
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { uBreath: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 tint; varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying vec3 vTint;
      void main() { vUv = uv; vTint = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uBreath; varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying vec3 vTint;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 1.3), along = pow(vUv.y, 2.0) * .55 + .45;
        float streak = .94 + .06 * sin(vUv.x * 24.0 + sin(vUv.x * 11.0) * 2.0);
        gl_FragColor = vec4(vTint * edge * along * streak * uBreath * .46, 1.0); }`,
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), material); mesh.name = 'Haces de luz'; mesh.renderOrder = 3;
  parts.forEach(g => g.dispose());
  return mesh;
}

// The still lake: a dark sheet you partly see through to the mirrored rock under it,
// clearer at a grazing look, with ripples only near the shore.
export function createLake() {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCamp: { value: new THREE.Vector2(...CAMP) }, uHalf: { value: new THREE.Vector2(...CAMP_HALF) } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec2 uCamp, uHalf; varying vec3 vP;
      void main() {
        vec3 V = normalize(cameraPosition - vP);
        float grazing = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5);
        vec2 q = abs(vP.xz - uCamp) - uHalf; float shore = length(max(q, vec2(0.0)));
        float near = exp(-shore / 16.0), ripple = sin(shore * 1.5 - uTime * .55 + sin(vP.x * .12 + vP.z * .09) * 2.0);
        float band = .5 + .5 * sin(vP.z * .55 + sin(vP.x * .04) * 4.0 + uTime * .05);
        float alpha = mix(.9, .46, grazing) + band * .05 + ripple * near * .08;
        vec3 color = mix(vec3(.003, .008, .022), vec3(.012, .036, .062), grazing) + vec3(.03, .05, .07) * max(0.0, ripple) * near * near;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0)); }`,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(460, 48).rotateX(-Math.PI / 2).translate(10, LAKE_Y, 5), material); mesh.name = 'Lago'; mesh.renderOrder = 1;
  return mesh;
}

// Spores and dust on the air around the camp: a shader's drift, one draw.
export function createSpores(uniforms) {
  const count = 170, R = rng(61), positions = new Float32Array(count * 3), phases = new Float32Array(count), colors = new Float32Array(count * 3), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    positions.set([-46 + R() * 110, -8 + R() * 34, -34 + R() * 96], i * 3); phases[i] = R() * 100;
    c.set(R() < .46 ? 0x4e9dff : R() < .66 ? 0xb06cff : 0xa8bcd0); c.toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1)); geometry.setAttribute('tint', new THREE.BufferAttribute(colors, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(9, 9, 14), 90);
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; attribute float phase; attribute vec3 tint; varying vec3 vC;
      void main() {
        vec3 p = position + vec3(sin(uTime * .11 + phase) * 2.2, mod(uTime * .22 * (.5 + fract(phase)) + phase, 8.0) - 4.0, cos(uTime * .09 + phase * 1.7) * 2.2);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vC = tint * (.4 + .6 * sin(uTime * .7 + phase * 3.0) * sin(uTime * .7 + phase * 3.0));
        gl_PointSize = clamp(60.0 / -mv.z * (.5 + fract(phase * 7.0)), 1.0, 7.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying vec3 vC; void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vC * (1.0 - smoothstep(.05, .5, d)) * .8, 1.0); }',
  }));
  points.name = 'Esporas'; points.renderOrder = 3;
  return points;
}

// Halos far past the fog: mushrooms, lanterns and mist, each with its own size, one draw.
export function createFarGlows(glows, map) {
  const positions = new Float32Array(glows.length * 3), colors = new Float32Array(glows.length * 3), sizes = new Float32Array(glows.length), c = new THREE.Color();
  glows.forEach((g, i) => { positions.set([g.x, g.y, g.z], i * 3); c.set(g.color).toArray(colors, i * 3); sizes[i] = g.size; });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('tint', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uScale: { value: 500 }, uGlow: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uScale; attribute vec3 tint; attribute float size; varying vec3 vC;
      void main() { vC = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, size * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform sampler2D map; uniform float uGlow; varying vec3 vC; void main() { gl_FragColor = vec4(vC * texture2D(map, gl_PointCoord).rgb * texture2D(map, gl_PointCoord).a * uGlow * .4, 1.0); }',
  });
  const points = new THREE.Points(geometry, material); points.name = 'Halos lejanos'; points.renderOrder = 2;
  return points;
}
