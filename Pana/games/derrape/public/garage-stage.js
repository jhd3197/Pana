// Studio lighting for the garage turntable, its car cards and portraits: a
// procedural PMREM room (dark violet floor, soft light boxes) so paint and
// chrome have something to reflect, plus a warm key and violet/cyan rims.
// The race scenes never use this environment, so race lighting is unchanged.
import * as THREE from 'three';

const cache = new WeakMap();
export function studioEnvironment(renderer) {
  if (cache.has(renderer)) return cache.get(renderer);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(vec3(0.05, 0.03, 0.09), vec3(0.32, 0.28, 0.42), smoothstep(-0.2, 0.9, h)), 1.0); }',
  })));
  const panel = (color, w, h, at) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 2, 0);
    room.add(m);
  };
  panel(0x9c98a8, 30, 8, [0, 22, 0]);
  panel(0x8a7fa6, 6, 18, [-24, 6, 6]);
  panel(0x6e98a6, 6, 18, [22, 6, -10]);
  panel(0xa08890, 18, 3, [0, 4, 26]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  cache.set(renderer, texture);
  return texture;
}

// Warm key from the front, violet and cyan rims behind: added to a scene.
export function studioRims(scene, scale = 1) {
  const violet = new THREE.DirectionalLight(0xa58bff, 1.1 * scale);
  violet.position.set(-8, 3, -5);
  const cyan = new THREE.DirectionalLight(0x56d8ff, 0.8 * scale);
  cyan.position.set(8, 2, -6);
  scene.add(violet, cyan);
  return [violet, cyan];
}
