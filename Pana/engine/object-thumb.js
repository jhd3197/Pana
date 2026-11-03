// Still pictures of 3D objects for menu cards (a gun, a part, a prop). Each one
// is built, framed by its own bounds, drawn once on the shared offscreen
// renderer (snapshot.js, one extra WebGL context that lets go when idle) and
// kept by key, so a list of two dozen cards costs two dozen renders once per
// page. Jobs take turns and yield a frame between them, so the page keeps its pace.
import * as THREE from 'three';
import { snapshot } from './snapshot.js';

const cache = new Map();
let stage = null;
// Lit like a showroom: a warm sky, a cool floor, a key light over the shoulder and a low fill.
function thumbStage() {
  if (stage) return stage;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(22, 1, .01, 100);
  scene.add(new THREE.HemisphereLight(0xfff5df, 0x444466, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(2, 5, 6);
  // A fill from below the lens, so undersides do not sink into a dark card.
  const fill = new THREE.DirectionalLight(0xfff1e0, 1.2); fill.position.set(-2, -3, 6); scene.add(key, fill);
  return (stage = { scene, camera });
}
const nextFrame = () => new Promise(resolve => setTimeout(resolve, 16));

// objectThumb(key, build, options) → Promise of an image URL (WebP).
// build(): returns { object, dispose? } (or a bare Object3D with userData.dispose).
// options: width/height (CSS pixels; drawn at twice that), turn ([x, y, z]
// Euler radians applied before framing, e.g. [0, Math.PI / 2, 0] turns +Z to
// face right), tilt (the camera's look down, radians), keep(mesh): only meshes
// it accepts are drawn and framed, margin (1 = edge to edge).
export function objectThumb(key, build, { width = 128, height = 80, turn = [0, 0, 0], tilt = .28, keep = null, margin = 1.12 } = {}) {
  if (cache.has(key)) return cache.get(key);
  const job = snapshot(async renderer => {
    await nextFrame();
    const { scene, camera } = thumbStage(), made = build(), object = made?.isObject3D ? made : made.object;
    const dispose = made?.isObject3D ? made.userData.dispose : made.dispose;
    const holder = new THREE.Group(); holder.rotation.set(...turn); holder.add(object); scene.add(holder);
    try {
      holder.updateMatrixWorld(true);
      const box = new THREE.Box3();
      object.traverse(o => { if (!o.isMesh) return; if (keep && !keep(o)) { o.visible = false; return; } box.expandByObject(o); });
      if (box.isEmpty()) return '';
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      const aspect = width / height, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fit = Math.max(size.y / 2 / t, size.x / 2 / (t * aspect)) * margin + size.z / 2;
      camera.aspect = aspect; camera.updateProjectionMatrix();
      camera.position.set(center.x, center.y + Math.sin(tilt) * fit, center.z + Math.cos(tilt) * fit); camera.lookAt(center);
      renderer.setPixelRatio(1); renderer.setSize(width * 2, height * 2); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/webp', .85);
    } finally { scene.remove(holder); dispose?.(); }
  });
  // A failed render is not kept: the next ask tries again.
  job.catch(() => cache.delete(key));
  cache.set(key, job);
  return job;
}
