// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana in gloves and the kart helmet,
// bouncing in guard and throwing the odd jab. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { createAccessories } from '/engine/models/characters/pana/accessories.js';
import { boxingGlove } from './set.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.4, 5.6); camera.lookAt(0, .95, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
    const pana = buildCharacter(loadAvatar()); scene.add(pana.group);
    const gloves = [pana.armL, pana.armR].map((arm, i) => {
      const glove = boxingGlove({ side: i ? -1 : 1 }); glove.scale.setScalar(1 / .6); glove.position.set(0, -.86, .04); arm.add(glove); return glove;
    });
    pana.wardrobe.setHeadwear('none'); pana.head.children.forEach(o => { if (o.name.startsWith('hat:')) o.visible = false; });
    const helmet = createAccessories(pana, { hat: 'casco', glasses: null, neck: null, back: null, extras: {} });
    helmet.show('hat', 'casco'); helmet.color('hat', 'casco', 'main', '#ffc629');
    return {
      update(dt, _t, now) {
        const t = now / 1000, jab = Math.max(0, Math.sin(t * 2.2) - .85) / .15;
        pana.group.rotation.y = Math.sin(t * .7) * .45; pana.group.position.y = Math.abs(Math.sin(t * 6)) * .05;
        pana.update(dt, {});
        pana.armL.rotation.set(-1.85 + .25 * jab, 0, -.3 + .24 * jab); pana.armL.scale.y = 1.15 + .5 * jab;
        pana.armR.rotation.set(-1.85, 0, .3); pana.armR.scale.y = 1.15;
        gloves.forEach((g, i) => g.scale.set(1 / .6, 1 / .6 / [pana.armL, pana.armR][i].scale.y, 1 / .6));
      },
      dispose() { gloves.forEach(g => g.userData.dispose()); helmet.dispose(); pana.dispose(); },
    };
  } });
}
