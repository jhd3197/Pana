import * as THREE from 'three';
import { mummy, sunRelic } from '/engine/models/props/reliquia.js';
export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40); camera.position.set(4.5, 3.8, 7.5); camera.lookAt(0, 1.3, 0);
  scene.add(new THREE.HemisphereLight(0xffe5ae, 0x3c7562, 3)); const key = new THREE.DirectionalLight(0xffd083, 3); key.position.set(-4, 6, 5); scene.add(key);
  const guardian = mummy(); guardian.position.set(1.1, 0, -0.6); guardian.rotation.y = -0.3; scene.add(guardian);
  const treasure = sunRelic(); treasure.position.set(-0.7, 0.6, 0.5); scene.add(treasure);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x3c6958, roughness: 1 })); pedestal.position.set(-0.7, 0.25, 0.5); scene.add(pedestal);
  function frame(t) {
    if (!canvas.isConnected) { scene.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); }); renderer.dispose(); return; }
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); guardian.userData.animate(t / 1000, false); treasure.rotation.y = Math.sin(t / 1700) * 0.4; treasure.position.y = 0.6 + Math.sin(t / 800) * 0.06; renderer.render(scene, camera); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
