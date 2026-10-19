// Static full-body accessory thumbnails shared by wardrobe consumers.
import * as THREE from 'three';
import { buildCharacter } from './models/characters/pana/avatar-model.js';
import { wardrobeToAvatar } from './avatar.js';
let stage, queue = Promise.resolve(), idle;
const cache = new Map();
export function wardrobePreview(look, view = 'body') {
  const avatar = wardrobeToAvatar(look), key = view + JSON.stringify(avatar);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  const job = queue.then(async () => {
    if (cache.has(key)) return cache.get(key);
    clearTimeout(idle);
    if (!stage) {
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(192, 192); renderer.setPixelRatio(1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 40);
      scene.add(new THREE.HemisphereLight('#fff4df', '#584474', 2));
      const light = new THREE.DirectionalLight('#fff3df', 3); light.position.set(2, 5, 4); scene.add(light);
      stage = { renderer, scene, camera };
    }
    const { renderer, scene, camera } = stage;
    const model = buildCharacter(avatar); scene.add(model.group);
    camera.position.set(view === 'back' ? -2.4 : 2, 2, view === 'back' ? -5.4 : 5.4);
    camera.lookAt(0, 1.2, 0);
    try {
      await renderer.compileAsync(scene, camera); renderer.render(scene, camera);
      const image = renderer.domElement.toDataURL('image/webp', .85);
      cache.set(key, image); if (cache.size > 100) cache.delete(cache.keys().next().value);
      return image;
    } finally {
      model.dispose();
      idle = setTimeout(() => { renderer.dispose(); renderer.forceContextLoss(); stage = null; }, 4000);
    }
  });
  queue = job.catch(() => {});
  return job;
}
