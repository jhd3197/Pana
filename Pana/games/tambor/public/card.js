// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana slapping a culo e' puya to the
// beat. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { createCuloEPuyaSet } from './rueda-set.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.6, 5.2); camera.lookAt(0, .8, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
    const pana = buildCharacter(loadAvatar()); pana.group.position.z = -.35; scene.add(pana.group);
    const drums = createCuloEPuyaSet(); drums.position.set(0, 0, .2); scene.add(drums);
    return {
      update(dt, t, now) {
        const beat = t * 112 / 60, left = Math.exp(-(beat % 1) * 6), right = Math.exp(-((beat + .5) % 1) * 6);
        pana.armL.rotation.set(-.85 - .65 * (1 - left), 0, .28); pana.armR.rotation.set(-.85 - .65 * (1 - right), 0, -.28);
        pana.update(dt, { open: left > .7 });
        pana.body.position.y += .03 * Math.abs(Math.sin(beat * Math.PI));
        scene.rotation.y = Math.sin(now / 1800) * .35;
      },
      dispose() { pana.dispose(); drums.userData.dispose(); },
    };
  } });
}
