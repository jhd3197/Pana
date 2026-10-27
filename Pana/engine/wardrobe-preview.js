// Static full-body accessory thumbnails shared by wardrobe consumers.
import * as THREE from 'three';
import { buildCharacter } from './models/characters/pana/avatar-model.js';
import { wardrobeToAvatar } from './avatar.js';
import { snapshot } from './snapshot.js';
let stage;
const cache = new Map();
export function wardrobePreview(look, view = 'body') {
  const avatar = wardrobeToAvatar(look), key = view + JSON.stringify(avatar);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return snapshot(async renderer => {
    if (cache.has(key)) return cache.get(key);
    if (!stage) {
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 40);
      scene.add(new THREE.HemisphereLight('#fff4df', '#584474', 2));
      const light = new THREE.DirectionalLight('#fff3df', 3); light.position.set(2, 5, 4); scene.add(light);
      stage = { scene, camera };
    }
    const { scene, camera } = stage;
    renderer.setSize(192, 192); renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const model = buildCharacter(avatar); scene.add(model.group);
    camera.position.set(view === 'back' ? -2.4 : 2, 2, view === 'back' ? -5.4 : 5.4);
    camera.lookAt(0, 1.2, 0);
    try {
      await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL('image/webp', .85);
      cache.set(key, image); if (cache.size > 100) cache.delete(cache.keys().next().value);
      return image;
    } finally { scene.remove(model.group); model.dispose(); }
  });
}
