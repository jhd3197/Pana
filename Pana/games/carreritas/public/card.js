// Live art for Carreritas's tile on the hub: your pana in El Chamo, turning on
// a little stage. The hub calls mount(canvas) if this file exists.

import * as THREE from 'three';
import { CARS } from './cars.js';
import { loadAvatar } from '/engine/avatar.js';
import { pixelRatio } from '/engine/settings.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(pixelRatio(2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(6.5, 4.2, 8.5);
  camera.lookAt(0, 1.3, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9a07a, 2.0));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const turn = new THREE.Group();
  scene.add(turn);

  let car = null;
  function build(avatar) {
    turn.clear();
    car = CARS[0].build(avatar);
    car.driver.neck.rotation.y = 0.9;   // looking at you
    turn.add(car.root);
  }
  build(loadAvatar());
  window.addEventListener('pana:avatar', (e) => build(e.detail));

  const clock = new THREE.Timer().reset();
  let t = 0;
  (function frame() {
    const dt = Math.min(clock.update().getDelta(), 0.1);
    t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    turn.rotation.y = -0.6 + Math.sin(t * 0.5) * 0.5;
    car.chassis.position.y = Math.abs(Math.sin(t * 3)) * 0.04;
    car.driver.update(dt, { look: Math.sin(t) });
    for (const p of car.danglers) p.rotation.z = Math.sin(t * 2.4) * 0.25;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  })();
}
