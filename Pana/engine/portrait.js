// Render a wardrobe once, then use its cached image in every roster/menu.
import * as THREE from 'three';
import { buildCharacter } from './models/characters/pana/avatar-model.js';
import { normalizeAvatar } from './avatar.js';
import { cachedPortrait, savePortrait } from './portrait-cache.js';
import { snapshot } from './snapshot.js';
let stage = null;
// The lit head-and-shoulders set, rendered on the shared offscreen renderer.
function portraitStage() {
  if (stage) return stage;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(16, 1, .1, 30);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b48a, 2.2), new THREE.AmbientLight(0xffffff, .5));
  const light = new THREE.DirectionalLight(0xfff4e6, 1.8); light.position.set(1, 3, 6); scene.add(light);
  return (stage = { scene, camera });
}
export function portrait(avatar, { current = false } = {}) {
  const cached = cachedPortrait(avatar);
  if (cached) { if (current) savePortrait(avatar, cached, true); return Promise.resolve(cached); }
  return snapshot(async renderer => {
    const hit = cachedPortrait(avatar);
    if (hit) { if (current) savePortrait(avatar, hit, true); return hit; }
    await new Promise(resolve => setTimeout(resolve, 0));
    const { scene, camera } = portraitStage();
    renderer.setSize(256, 256); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.NoToneMapping;
    const model = buildCharacter(normalizeAvatar(avatar)); scene.add(model.group);
    model.group.updateMatrixWorld(true); const neck = new THREE.Vector3(); model.neck.getWorldPosition(neck);
    camera.position.set(0, neck.y + .55, 4.2); camera.lookAt(0, neck.y + .45, 0);
    try {
      await renderer.compileAsync(scene, camera);
      renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL('image/webp', .85);
      savePortrait(avatar, image, current); return image;
    } finally { scene.remove(model.group); model.dispose(); }
  });
}
