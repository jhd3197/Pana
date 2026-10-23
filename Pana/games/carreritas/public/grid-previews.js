import * as THREE from 'three';
import { paintNext } from './loading.js';

// One temporary renderer, borrowed race geometry: each image is the entrant's
// actual assembled car, including their driver, paint, wheels and parts.
export async function gridPreviews(cars, receive, active) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(1); renderer.setSize(480, 300);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff3db, 0x393354, 3));
  const key = new THREE.DirectionalLight(0xfff3dd, 4); key.position.set(4, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x94adff, 2); rim.position.set(-4, 3, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(35, 480 / 300, .01, 200);
  try {
    for (const car of cars) {
      await paintNext(); if (!active()) return;
      const model = car.car.root.clone(true);
      model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.setScalar(1);
      const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
      model.position.sub(center); scene.add(model);
      const distance = .78 * box.getSize(new THREE.Vector3()).length() / (2 * Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)));
      camera.position.set(distance * .62, distance * .34, distance * .7); camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      await receive(car, renderer.domElement.toDataURL('image/png'));
      scene.remove(model);
    }
  } finally {
    renderer.dispose(); renderer.forceContextLoss();
  }
}
