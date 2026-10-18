// Render a wardrobe once, then use its cached image in every roster/menu.
import * as THREE from 'three';
import { buildCharacter } from './models/characters/pana/avatar-model.js';
import { normalizeAvatar } from './avatar.js';
import { cachedPortrait, savePortrait } from './portrait-cache.js';
let queue = Promise.resolve();
export function portrait(avatar, { current = false } = {}) {
  const cached = cachedPortrait(avatar);
  if (cached) { if (current) savePortrait(avatar, cached, true); return Promise.resolve(cached); }
  const job = queue.then(async () => {
    const hit = cachedPortrait(avatar);
    if (hit) { if (current) savePortrait(avatar, hit, true); return hit; }
    await new Promise(resolve => setTimeout(resolve, 0));
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(256, 256); renderer.setPixelRatio(1);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(16, 1, .1, 30);
    const model = buildCharacter(normalizeAvatar(avatar)); scene.add(model.group);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b48a, 2.2), new THREE.AmbientLight(0xffffff, .5));
    const light = new THREE.DirectionalLight(0xfff4e6, 1.8); light.position.set(1, 3, 6); scene.add(light);
    model.group.updateMatrixWorld(true); const neck = new THREE.Vector3(); model.neck.getWorldPosition(neck);
    camera.position.set(0, neck.y + .55, 4.2); camera.lookAt(0, neck.y + .45, 0);
    try {
      await renderer.compileAsync(scene, camera);
      renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL('image/webp', .85);
      savePortrait(avatar, image, current); return image;
    } finally { model.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
  });
  queue = job.catch(() => {});
  return job;
}
