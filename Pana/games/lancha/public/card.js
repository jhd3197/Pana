import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { createLancha } from '/engine/models/vehicles/lancha.js';
import { mountCard } from '/engine/card.js';

// Hub tile: the saved pana at the tiller of the same lancha as the race.
export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(6.4, 3.4, 6.2); camera.lookAt(0, .7, 0);
  return mountCard(canvas, { camera, build(scene) {
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3f6a5a, 2.3)); const sun = new THREE.DirectionalLight(0xffe3b0, 2); sun.position.set(-3, 7, 4); scene.add(sun);
    const lancha = createLancha(loadAvatar(), '#e2683c'); scene.add(lancha.group);
    const water = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), new THREE.MeshStandardMaterial({ color: 0x2f6b5c, roughness: .25, metalness: .1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = .02; scene.add(water);
    return {
      update(dt, t, now) { lancha.group.rotation.y = -.7 + Math.sin(now * .0003) * .3; lancha.update(dt, { v: 8, throttle: 1, steer: Math.sin(t * .7) * .6 }, t); },
      dispose() { lancha.dispose(); water.geometry.dispose(); water.material.dispose(); },
    };
  } });
}
