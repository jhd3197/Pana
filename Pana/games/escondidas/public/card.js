// Live hub artwork uses the very same reusable props as the playable map.
import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { barrel, crate, planter } from '/engine/models/props/plaza.js';
import { pixelRatio } from '/engine/settings.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(pixelRatio(1.5));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, 0.1, 40);
  camera.position.set(4, 3.4, 7); camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb69062, 2.5));
  const sun = new THREE.DirectionalLight(0xffe6a9, 2.5); sun.position.set(-3, 6, 5); scene.add(sun);
  const b = barrel(), c = crate(), p = planter();
  b.position.set(0.9, 0, 0.5); c.position.set(-0.8, 0, -0.3); p.position.set(1.5, 0, -1.2); scene.add(b, c, p);
  let pana = buildCharacter(loadAvatar()); scene.add(pana.group);
  const update = e => { pana.dispose(); pana = buildCharacter(e.detail); scene.add(pana.group); };
  addEventListener('pana:avatar', update);
  let previous = performance.now();
  function frame(now) {
    if (!canvas.isConnected) { renderer.dispose(); removeEventListener('pana:avatar', update); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      const dt = Math.min((now - previous) / 1000, 0.1); previous = now;
      pana.group.position.set(-0.3, 0.18 + Math.sin(now * 0.0015) * 0.18, 0.8);
      pana.group.rotation.y = 0.3 + Math.sin(now * 0.0005) * 0.4;
      pana.update(dt, { look: Math.sin(now * 0.001) }); renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
