import * as THREE from 'three';
import { createGameTable } from '/engine/models/props/game-table.js';
import { createSpanishCard, createScoreToken } from '/engine/models/props/spanish-cards.js';
import { pixelRatio } from '/engine/settings.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); renderer.setPixelRatio(pixelRatio(1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 40); camera.position.set(4, 9, 9); camera.lookAt(0, 1.4, 0);
  scene.add(new THREE.HemisphereLight('#fff2d1', '#557b63', 2.6)); const sun = new THREE.DirectionalLight('#ffe2af', 3); sun.position.set(-3, 8, 4); scene.add(sun);
  const table = createGameTable({ caption: 'CAÍDA · ENTRE PANAS' }); // i18n-ignore: the game's name painted on the table
  scene.add(table); const pieces = [];
  for (const [i, card] of [{ rank: 1, suit: 'oros' }, { rank: 12, suit: 'copas' }, { rank: 7, suit: 'bastos' }].entries()) { const model = createSpanishCard(card); model.scale.setScalar(1.6); model.position.set((i - 1) * 1.1, 1.5, 0); model.rotation.y = (i - 1) * -.2; scene.add(model); pieces.push(model); }
  for (let i = 0; i < 6; i++) { const chip = createScoreToken(); chip.position.set(1.6 + i % 2 * .23, 1.48 + Math.floor(i / 2) * .04, 1.8); scene.add(chip); pieces.push(chip); }
  let stopped = false, width = 0, height = 0;
  function frame() { if (stopped) return; const w = canvas.clientWidth, h = canvas.clientHeight; if (w && h) { if (width !== w || height !== h) { width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } renderer.render(scene, camera); } requestAnimationFrame(frame); } requestAnimationFrame(frame);
  addEventListener('pagehide', () => { stopped = true; table.userData.dispose(); pieces.forEach(p => p.userData.dispose()); renderer.dispose(); }, { once: true });
}
