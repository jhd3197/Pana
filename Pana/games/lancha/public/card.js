import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { createLancha } from '/engine/models/vehicles/lancha.js';

// Hub tile: the saved pana at the tiller of the same lancha as the race.
export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(6.4, 3.4, 6.2); camera.lookAt(0, .7, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3f6a5a, 2.3)); const sun = new THREE.DirectionalLight(0xffe3b0, 2); sun.position.set(-3, 7, 4); scene.add(sun);
  const lancha = createLancha(loadAvatar(), '#e2683c'); scene.add(lancha.group);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), new THREE.MeshStandardMaterial({ color: 0x2f6b5c, roughness: .25, metalness: .1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = .02; scene.add(water);
  let previous = performance.now(), stopped = false, t = 0;
  function frame(now) {
    if (stopped) return;
    const dt = Math.min(.05, (now - previous) / 1000); previous = now; t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); lancha.group.rotation.y = -.7 + Math.sin(now * .0003) * .3; lancha.update(dt, { v: 8, throttle: 1, steer: Math.sin(t * .7) * .6 }, t); renderer.render(scene, camera); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const dispose = () => { stopped = true; lancha.dispose(); water.geometry.dispose(); water.material.dispose(); renderer.dispose(); };
  window.addEventListener('pagehide', dispose, { once: true });
  return dispose;
}
