import * as THREE from 'three';
import { createGameTable } from '/engine/models/props/game-table.js';
import { createSpanishCard, createScoreToken } from '/engine/models/props/spanish-cards.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 40); camera.position.set(4, 9, 9); camera.lookAt(0, 1.4, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff2d1', '#557b63', 2.6)); const sun = new THREE.DirectionalLight('#ffe2af', 3); sun.position.set(-3, 8, 4); scene.add(sun);
    const table = createGameTable({ caption: 'CAÍDA · ENTRE PANAS' }); // i18n-ignore: the game's name painted on the table
    scene.add(table); const pieces = [];
    for (const [i, card] of [{ rank: 1, suit: 'oros' }, { rank: 12, suit: 'copas' }, { rank: 7, suit: 'bastos' }].entries()) { const model = createSpanishCard(card); model.scale.setScalar(1.6); model.position.set((i - 1) * 1.1, 1.5, 0); model.rotation.y = (i - 1) * -.2; scene.add(model); pieces.push(model); }
    for (let i = 0; i < 6; i++) { const chip = createScoreToken(); chip.position.set(1.6 + i % 2 * .23, 1.48 + Math.floor(i / 2) * .04, 1.8); scene.add(chip); pieces.push(chip); }
    return { dispose() { table.userData.dispose(); pieces.forEach(p => p.userData.dispose()); } };
  } });
}
