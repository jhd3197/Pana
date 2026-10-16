// Hub tile: the fogata at night, the relic glowing and a mummy peeking in.
import * as THREE from 'three';
import { mummy, sunRelic } from '/engine/models/props/reliquia.js';
import { campfire } from '/engine/models/props/llano-life.js';
export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40); camera.position.set(0.6, 3.2, 8); camera.lookAt(0, 1.1, 0);
  scene.add(new THREE.HemisphereLight(0x5c6bb8, 0x101024, 1.1));
  const glow = new THREE.PointLight(0xffa04a, 30, 12, 1.6); glow.position.set(0, 1.2, 0.6); scene.add(glow);
  const fire = campfire(); fire.position.set(0, 0, 0.6); scene.add(fire);
  const relic = sunRelic(); relic.scale.setScalar(0.7); relic.position.set(-1.9, 0.4, -0.4); scene.add(relic);
  const sneak = mummy(); sneak.position.set(1.9, 0, -0.8); sneak.rotation.y = -0.5; scene.add(sneak);
  function frame(t) {
    if (!canvas.isConnected) { scene.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); }); renderer.dispose(); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight, s = t / 1000;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      fire.userData.tick?.(s); glow.intensity = 26 + Math.sin(s * 9) * 3 + Math.sin(s * 23) * 2;
      sneak.userData.animate(s, false, Math.sin(s * 0.7) > 0.6); sneak.position.x = 1.9 + Math.sin(s * 0.7) * 0.25;
      relic.rotation.y = s * 0.5; renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
