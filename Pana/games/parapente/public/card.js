// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana under its wing, in 3D.
// mount(canvas) → dispose.
import * as THREE from 'three';
import { createParapente } from '/engine/models/vehicles/parapente.js';
import { loadAvatar } from '/engine/avatar.js';
import { pixelRatio } from '/engine/settings.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(pixelRatio(1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(0, 4.2, 15); camera.lookAt(0, 3.4, 0);
  scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 8, 6); scene.add(sun);
  const wing = createParapente(loadAvatar(), '#2fa3e0'); scene.add(wing.group);
  let stopped = false, last = performance.now();
  function frame(now) {
    if (stopped) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, dt = Math.min(.05, (now - last) / 1000); last = now;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      wing.group.rotation.y = Math.sin(now / 1800) * .5; wing.group.position.y = Math.sin(now / 900) * .2;
      wing.update(dt, { v: 16, steer: Math.sin(now / 1800) * .6 }, now / 1000); renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const dispose = () => { stopped = true; wing.dispose(); renderer.dispose(); };
  addEventListener('pagehide', dispose, { once: true });
  return dispose;
}
