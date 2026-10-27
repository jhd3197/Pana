// A hub tile's live 3D art (games/<id>/public/card.js). The tile keeps its own
// scene, lights and camera; this owns the renderer, the draw loop (resizing
// only when the tile does) and freeing everything on pagehide.
//
//   export const mount = canvas => mountCard(canvas, {
//     camera, toneMapping: true,
//     build(scene) { scene.add(…); return { update(dt, t) {…}, dispose() {…} }; },
//   });
//
// Without a dispose of its own, the scene's meshes are freed (disposeModel).
import * as THREE from 'three';
import { pixelRatio } from './settings.js';
import { disposeModel } from './models/props/game-table.js';

export function mountCard(canvas, { camera, toneMapping = false, build }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(pixelRatio(1.5));
  if (toneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), art = build(scene) || {};
  let stopped = false, width = 0, height = 0, previous = performance.now(), t = 0;
  function frame(now) {
    if (stopped) return;
    const dt = Math.min(.05, (now - previous) / 1000); previous = now; t += dt;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h) {
      if (w !== width || h !== height) { width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
      art.update?.(dt, t, now);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const dispose = () => {
    if (stopped) return;
    stopped = true;
    art.dispose ? art.dispose() : disposeModel(scene);
    renderer.dispose();
  };
  addEventListener('pagehide', dispose, { once: true });
  return dispose;
}
