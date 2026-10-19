import * as THREE from 'three';
import { createArenaSlot } from '/engine/worlds/arenas.js';
import { createSky } from '/engine/worlds/sky.js';
import { bindRenderer, shadowSize } from '/engine/settings.js';
import { WARM_DAY } from '/engine/worlds/look.js';

// Shared outdoor stage for every table game (Billar, Póquer, Ludo, Dominó,
// Caída): renderer, sky, light, sun shadows and the plaza arena around the
// table. Gameplay owns its meshes. Options tune the light for each table;
// the defaults are the shared warm day (engine/worlds/look.js).
const STAGE = {
  exposure: WARM_DAY.exposure, background: WARM_DAY.background, fog: [40, 115], sky: true, fov: 42,
  hemi: [...WARM_DAY.hemi.slice(0, 2), 2.2],
  sun: { color: WARM_DAY.sun.color, intensity: 3, position: [-12, 22, 10], box: 15, far: 55, bias: -.0001 },
  plazaScale: .85,
  fit: 'canvas',   // a stage inside the page; full-window tables pass 'window'
  arena: true,     // false: no plaza, the game builds its own surroundings (Chapita's street)
};

export function createTableWorld(canvas, options = {}) {
  const o = { ...STAGE, ...options, sun: { ...STAGE.sun, ...options.sun } };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure;
  const unbind = bindRenderer(renderer, 1.5, { fit: o.fit }), scene = new THREE.Scene();
  scene.background = new THREE.Color(o.background); scene.fog = new THREE.Fog(o.background, ...o.fog);
  const sky = o.sky ? createSky(WARM_DAY.sky) : null; if (sky) scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(...o.hemi));
  const sun = new THREE.DirectionalLight(o.sun.color, o.sun.intensity); sun.position.set(...o.sun.position); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(shadowSize(2048)); Object.assign(sun.shadow.camera, { left: -o.sun.box, right: o.sun.box, top: o.sun.box, bottom: -o.sun.box, near: .5, far: o.sun.far });
  sun.shadow.normalBias = .025; sun.shadow.bias = o.sun.bias; scene.add(sun);
  const plaza = o.arena ? createArenaSlot(scene, { mode: 'table', plazaScale: o.plazaScale }) : null; plaza?.setMap('plaza');
  const camera = new THREE.PerspectiveCamera(o.fov, 1, .1, 150);
  const target = new THREE.Vector3(), direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), point = new THREE.Vector3();
  let time = 0;
  function resize() {
    // The canvas fills its CSS box; only its resolution follows that box.
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
  function draw(dt) { time += dt; plaza?.update(time, dt); sky?.update(time); renderer.render(scene, camera); }
  return { renderer, scene, camera, plaza, sun, resize, frameCamera, draw, setMap: id => plaza?.setMap(id),
    dispose() { unbind(); sky?.dispose(); plaza?.dispose(); renderer.dispose(); },
  };
}
