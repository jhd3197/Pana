import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createPreview(canvas, thumbnail = false) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.01, 12000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: thumbnail });
  renderer.setPixelRatio(thumbnail ? 1 : Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.background = new THREE.Color('#eef0ee');
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture; room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff4df', '#b79d81', 1.5));
  const key = new THREE.DirectionalLight('#fff2df', 2.3); key.position.set(-3.5, 7, 5); scene.add(key);
  const fill = new THREE.DirectionalLight('#edf2ff', 1); fill.position.set(4, 3, -4); scene.add(fill);
  return { scene, camera, renderer, dispose() { environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); } };
}

export function release(runtime) {
  if (!runtime) return;
  const geometries = new Set(), materials = new Set(), owned = [];
  runtime.group.traverse(o => {
    if (o.userData.dispose) owned.push(o.userData.dispose);
    if (o.geometry) geometries.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(material);
  });
  runtime.dispose?.(); owned.forEach(dispose => dispose());
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); runtime.group.removeFromParent();
}

export function ownMaterials(runtime, wireframe = false) {
  // Factories may cache materials. Preview controls must never mutate those.
  const clones = new Map();
  runtime.group.traverse(o => {
    if (!o.material) return;
    const own = m => { if (!clones.has(m)) { const copy = m.clone(); copy.wireframe = wireframe; clones.set(m, copy); } return clones.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
}

export function inspect(runtime) {
  runtime.group.updateMatrixWorld(true);
  const bounds = new THREE.Box3(), materials = new Set(), textures = new Set();
  let meshes = 0, triangles = 0, vertices = 0;
  runtime.group.traverseVisible(o => {
    if (!o.isMesh) return;
    meshes++; vertices += o.geometry.attributes.position.count;
    triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
    bounds.union(new THREE.Box3().setFromObject(o));
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m); Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); });
    }
  });
  return { bounds, frameBounds: runtime.bounds?.clone() || bounds.clone(), stats: {
    meshes, triangles: Math.round(triangles), vertices, materials: materials.size, textures: textures.size,
    dimensions: bounds.getSize(new THREE.Vector3()).toArray(),
  } };
}

export function fitCamera(camera, bounds, map = false, view = 'perspective') {
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const extent = view === 'top' ? Math.max(size.z, size.x / camera.aspect) : view === 'side' ? Math.max(size.y, size.z / camera.aspect) : Math.max(size.y, size.x / camera.aspect, size.z * 0.7);
  const distance = Math.max(0.1, extent) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.45;
  const direction = view === 'front' ? new THREE.Vector3(0, 0, 1) : view === 'side' ? new THREE.Vector3(1, 0, 0) : view === 'top' ? new THREE.Vector3(0, 1, 0.0001) : new THREE.Vector3(-0.58, map ? 0.95 : 0.25, 1);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(distance)); camera.lookAt(center);
  camera.near = Math.max(0.01, distance / 2000); camera.far = Math.max(100, distance * 12); camera.updateProjectionMatrix();
  return { center, distance };
}

export function thumbnailRenderer() {
  const canvas = document.createElement('canvas'), stage = createPreview(canvas, true);
  stage.renderer.setSize(320, 240, false); stage.camera.aspect = 4 / 3;
  return {
    async capture(asset) {
      let runtime;
      try {
        runtime = await asset.build(); ownMaterials(runtime); runtime.update?.(0, 0);
        stage.scene.add(runtime.group); const { stats, frameBounds } = inspect(runtime);
        fitCamera(stage.camera, frameBounds, asset.category === 'Mapas'); stage.renderer.render(stage.scene, stage.camera);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('No se pudo crear la miniatura.')), 'image/webp', 0.84));
        return { blob, stats };
      } finally { release(runtime); stage.renderer.renderLists.dispose(); }
    },
    dispose: stage.dispose,
  };
}
