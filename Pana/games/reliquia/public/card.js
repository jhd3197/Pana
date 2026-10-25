import * as THREE from 'three';
import { mummy } from '/engine/models/props/reliquia.js';
import { sunDisk, coinPile, emerald, laughingIdol } from '/engine/models/props/reliquia-treasure.js';
import { pixelRatio } from '/engine/settings.js';
// The hub card: a mummy guarding a pile of loot under torchlight.
export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(pixelRatio(1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40); camera.position.set(4.2, 3.2, 7.2); camera.lookAt(0, 1.1, 0);
  scene.add(new THREE.HemisphereLight(0xffe5ae, 0x5a3a6a, 2.4)); const key = new THREE.DirectionalLight(0xffc070, 3.2); key.position.set(-4, 6, 5); scene.add(key);
  const torch = new THREE.PointLight(0xff9a3a, 14, 9, 1.6); torch.position.set(-1.6, 2.2, 1.6); scene.add(torch);
  const guardian = mummy(); guardian.position.set(1.5, 0, -0.8); guardian.rotation.y = -0.5; scene.add(guardian);
  const disk = sunDisk(); disk.position.set(-0.6, 0, -0.4); disk.rotation.y = 0.35; scene.add(disk);
  const loot = [coinPile({ seed: 4 }), coinPile({ seed: 8, count: 12 }), emerald(), laughingIdol()];
  [[0.4, 0.9], [-1.2, 1.1], [0.1, 1.5], [-0.2, 0.6]].forEach(([x, z], i) => { loot[i].position.set(x, 0, z); loot[i].scale.setScalar(1.6); scene.add(loot[i]); });
  function frame(t) {
    if (!canvas.isConnected) { guardian.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); [disk, ...loot].forEach(m => m.userData.dispose?.()); renderer.dispose(); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      guardian.userData.animate(t / 1000, false); torch.intensity = 13 + Math.sin(t / 90) * 1.5 + Math.sin(t / 37) * 1;
      loot[3].rotation.y = Math.sin(t / 900) * 0.6; renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
