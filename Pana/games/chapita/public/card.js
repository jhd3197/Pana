// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana at the plate with the palo de
// escoba up and a chapita floating in, in 3D. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar, normalizeAvatar } from '/engine/avatar.js';
import { createChapita, createPalo } from './studio-set.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(1.2, 1.3, 5.2); camera.lookAt(0, .95, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
    const pana = buildCharacter(normalizeAvatar({ ...loadAvatar(), outfit: 'franela', outfitColor: '#e8453c' })); scene.add(pana.group);
    pana.group.rotation.y = .9;
    const palo = createPalo(); palo.scale.setScalar(1.35); palo.position.set(0, -.7, .05); palo.rotation.x = Math.PI / 2 - .2; pana.armR.add(palo);
    const cap = createChapita({ brand: 'kolita' }); cap.scale.setScalar(1.6); scene.add(cap);
    return {
      update(dt, _t, now) {
        pana.update(dt, {});
        pana.armR.rotation.set(-1.9, 0, -.6); pana.armL.rotation.set(-1.7, 0, .9);
        const t = (now / 1600) % 1;
        cap.position.set(-1.6 + t * 1.9, 1.5 - Math.sin(t * Math.PI) * .25 - t * t * .4, -1.2 + t * 1.2); cap.rotation.y += dt * 14; cap.rotation.x = .6;
      },
      dispose() { pana.dispose(); palo.userData.dispose(); cap.userData.dispose(); },
    };
  } });
}
