import * as THREE from 'three';
import { createPlazaEnvironment } from '/engine/plaza.js';
import { createSky } from '/engine/sky.js';
import { bindRenderer } from '/engine/settings.js';
import { disposeModel } from '/engine/models/props/game-table.js';

// Shared outdoor stage for the pool and poker tables. Gameplay owns its meshes.
export function createTableWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const unbind = bindRenderer(renderer, 1.5), scene = new THREE.Scene();
  scene.background = new THREE.Color('#c7e1e8'); scene.fog = new THREE.Fog('#c7e1e8', 40, 115);
  const sky = createSky(); scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight('#e6f6ff', '#b38b60', 2.2));
  const sun = new THREE.DirectionalLight('#ffe1ab', 3); sun.position.set(-12, 22, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, far: 55 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.0001; scene.add(sun);
  const plaza = createPlazaEnvironment({ cooking: true, clearance: (x, z, radius = 0) => Math.hypot(x, z) - radius > 10 });
  plaza.group.scale.setScalar(.85); scene.add(plaza.group);
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 150);
  const target = new THREE.Vector3(), direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), point = new THREE.Vector3();
  let time = 0;
  function resize() {
    // bindRenderer owns resolution, but its window-sized inline styles must not own layout.
    canvas.style.width = '100%'; canvas.style.height = '100%';
    const rect = canvas.getBoundingClientRect(), w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    return { w, h };
  }
  function frameCamera(bounds, view, safe) {
    const { w, h } = resize();
    target.copy(bounds.getCenter(new THREE.Vector3())); direction.set(...view).normalize();
    right.crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize(); up.crossVectors(direction, right);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let distance = 1;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      point.set(x, y, z).sub(target);
      distance = Math.max(distance, point.dot(direction) + Math.max(Math.abs(point.dot(right)) / (tan * safe.width / h), Math.abs(point.dot(up)) / (tan * safe.height / h)));
    }
    camera.aspect = w / h; camera.position.copy(target).addScaledVector(direction, distance * 1.04); camera.lookAt(target);
    camera.setViewOffset(w, h, w / 2 - safe.x - safe.width / 2, h / 2 - safe.y - safe.height / 2, w, h);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function draw(dt) { time += dt; plaza.update(time); sky.update(time); renderer.render(scene, camera); }
  return { renderer, scene, camera, plaza, resize, frameCamera, draw,
    dispose() { unbind(); sky.dispose(); disposeModel(plaza.group); renderer.dispose(); },
  };
}
