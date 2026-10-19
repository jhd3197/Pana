// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana slapping a culo e' puya to the
// beat. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { createCuloEPuyaSet } from './rueda-set.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.6, 5.2); camera.lookAt(0, .8, 0);
  scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
  const pana = buildCharacter(loadAvatar()); pana.group.position.z = -.35; scene.add(pana.group);
  const drums = createCuloEPuyaSet(); drums.position.set(0, 0, .2); scene.add(drums);
  let stopped = false, last = performance.now(), t = 0;
  function frame(now) {
    if (stopped) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      const beat = t * 112 / 60, left = Math.exp(-(beat % 1) * 6), right = Math.exp(-((beat + .5) % 1) * 6);
      pana.armL.rotation.set(-.85 - .65 * (1 - left), 0, .28); pana.armR.rotation.set(-.85 - .65 * (1 - right), 0, -.28);
      pana.update(dt, { open: left > .7 });
      pana.body.position.y += .03 * Math.abs(Math.sin(beat * Math.PI));
      scene.rotation.y = Math.sin(now / 1800) * .35;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const dispose = () => { stopped = true; pana.dispose(); drums.userData.dispose(); renderer.dispose(); };
  addEventListener('pagehide', dispose, { once: true });
  return dispose;
}
