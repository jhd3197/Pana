// Live art for Bululú's tile on the hub: your pana on a party pedestal, a
// golden mango and the die floating around. The hub calls mount(canvas).

import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/character.js';
import { makeMango } from '/engine/props.js';
import { createDie } from './board.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(4.2, 3.4, 7.5);
  camera.lookAt(0, 1.4, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6aa8, 2.0));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.set(4, 8, 6);
  scene.add(key);

  const stage = new THREE.Group();
  scene.add(stage);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.35, 24),
    new THREE.MeshStandardMaterial({ color: '#ff4b4b', roughness: 0.5, flatShading: true }));
  base.position.y = 0.17;
  stage.add(base);
  const mango = makeMango({ gold: true });
  mango.position.set(-1.4, 2.6, 0.2);
  stage.add(mango);
  const die = createDie();
  die.show(6);
  die.mesh.scale.setScalar(0.6);
  die.mesh.position.set(1.4, 2.9, 0);
  stage.add(die.mesh);

  let pana = null;
  function build(avatar) {
    if (pana) stage.remove(pana.group);
    pana = buildCharacter(avatar);
    pana.group.position.y = 0.35;
    stage.add(pana.group);
  }
  build(loadAvatar());
  window.addEventListener('pana:avatar', (e) => build(e.detail));

  const clock = new THREE.Clock();
  let t = 0;
  (function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    stage.rotation.y = Math.sin(t * 0.5) * 0.4;
    const hop = Math.abs(Math.sin(t * 2.2));
    pana.group.position.y = 0.35 + hop * 0.35;
    pana.armL.rotation.x = pana.armR.rotation.x = -0.55 - hop * 1.6;
    pana.update(dt, { open: hop > 0.7, look: Math.sin(t) });
    mango.position.y = 2.6 + Math.sin(t * 1.7) * 0.2;
    mango.rotation.y += dt * 1.2;
    die.mesh.rotation.x += dt * 0.9;
    die.mesh.rotation.y += dt * 1.3;
    die.mesh.position.y = 2.9 + Math.cos(t * 1.5) * 0.2;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  })();
}
