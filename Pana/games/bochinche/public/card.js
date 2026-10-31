// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana, in 3D. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.3, 5.4); camera.lookAt(0, .85, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
    const pana = buildCharacter(loadAvatar()); scene.add(pana.group);
    return {
      update(dt, t, now) { pana.group.rotation.y = Math.sin(now / 1400) * .5; pana.update(dt, {}); },
      dispose() { pana.dispose(); },
    };
  } });
}
