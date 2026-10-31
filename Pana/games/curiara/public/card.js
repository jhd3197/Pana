import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { createCanoe } from '/engine/models/vehicles/curiara.js';
import { mountCard } from '/engine/card.js';

// Hub tile: the saved pana paddling the same curiara as the race.
export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  camera.position.set(5.6, 3.3, 5.4); camera.lookAt(0, .7, 0);
  return mountCard(canvas, { camera, build(scene) {
    scene.add(new THREE.HemisphereLight(0xf2fff4, 0x3f6a4a, 2.3)); const sun = new THREE.DirectionalLight(0xffe3b0, 2); sun.position.set(-3, 7, 4); scene.add(sun);
    const canoe = createCanoe([{ avatar: loadAvatar() }], '#3f9e7a'); scene.add(canoe.group);
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), new THREE.MeshStandardMaterial({ color: 0x2f6b5c, roughness: .25, metalness: .1 }));
    water.rotation.x = -Math.PI / 2; water.position.y = .02; scene.add(water);
    const boat = { paddle: { last: 0, side: -1 }, capsized: 0 };
    let next = .45;
    return {
      update(dt, t, now) {
        if (t > next) { boat.paddle = { last: t, side: -boat.paddle.side }; next = t + .45; }
        canoe.group.rotation.y = -.6 + Math.sin(now * .0003) * .3; canoe.update(dt, boat, t);
      },
      dispose() { canoe.dispose(); water.geometry.dispose(); water.material.dispose(); },
    };
  } });
}
