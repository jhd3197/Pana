// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana under its wing, in 3D.
// mount(canvas) → dispose.
import * as THREE from 'three';
import { createParapente } from '/engine/models/vehicles/parapente.js';
import { loadAvatar } from '/engine/avatar.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(0, 4.2, 15); camera.lookAt(0, 3.4, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 8, 6); scene.add(sun);
    const wing = createParapente(loadAvatar(), '#2fa3e0'); scene.add(wing.group);
    return {
      update(dt, t, now) {
        wing.group.rotation.y = Math.sin(now / 1800) * .5; wing.group.position.y = Math.sin(now / 900) * .2;
        wing.update(dt, { v: 16, steer: Math.sin(now / 1800) * .6 }, now / 1000);
      },
      dispose() { wing.dispose(); },
    };
  } });
}
