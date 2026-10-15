import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { food, kitchenStation } from '/engine/models/props/kitchen.js';
import { bake } from '/engine/models/core/static-batch.js';
export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40); camera.position.set(4, 3.5, 6); camera.lookAt(0, 1.2, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbb8543, 2.5)); const sun = new THREE.DirectionalLight(0xffe2b6, 2.5); sun.position.set(-3, 5, 4); scene.add(sun);
  const stove = bake(kitchenStation({ type: 'stove', w: 2.7, d: 2.2 })); stove.position.set(1.3, 0, -0.8); stove.scale.setScalar(0.8); scene.add(stove);
  const meal = bake(food('cachapa')); meal.position.set(1.3, 1.45, -0.8); meal.scale.setScalar(0.7); scene.add(meal);
  let pana;
  function build(a) { if (pana) { pana.carry.clear(); pana.dispose(); } pana = buildCharacter(a, { chef: true }); const held = food('arepa'); held.scale.setScalar(0.65); pana.carry.add(held); pana.group.position.set(-0.5, 0, 0.6); pana.group.rotation.y = 0.4; scene.add(pana.group); }
  build(loadAvatar()); const update = e => build(e.detail); addEventListener('pana:avatar', update); let previous = performance.now();
  function frame(now) {
    if (!canvas.isConnected) { renderer.dispose(); removeEventListener('pana:avatar', update); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); pana.update(Math.min(0.1, (now - previous) / 1000), { carry: true, walk: 0 }); pana.neck.rotation.z = Math.sin(now * 0.002) * 0.1; renderer.render(scene, camera); }
    previous = now; requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
