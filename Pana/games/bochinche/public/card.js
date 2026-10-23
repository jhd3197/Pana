// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana, in 3D. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.3, 5.4); camera.lookAt(0, .85, 0);
  scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
  const pana = buildCharacter(loadAvatar()); scene.add(pana.group);
  let stopped = false, last = performance.now();
  function frame(now) {
    if (stopped) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, dt = Math.min(.05, (now - last) / 1000); last = now;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      pana.group.rotation.y = Math.sin(now / 1400) * .5; pana.update(dt, {}); renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const dispose = () => { stopped = true; pana.dispose(); renderer.dispose(); };
  addEventListener('pagehide', dispose, { once: true });
  return dispose;
}
