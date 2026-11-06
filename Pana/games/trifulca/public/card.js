// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana in gloves and the kart helmet,
// bouncing in guard and throwing the odd jab. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { createAccessories } from '/engine/models/characters/pana/accessories.js';
import { wearGlove, settleGlove } from './glove-rig.js';
import { handRoll } from './glove-shape.js';
import { HEAD_SIZE, GLOVE_SIZE, helmetSwap } from './fighter-look.js';
import { mountCard } from '/engine/card.js';

export function mount(canvas) {
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.4, 5.6); camera.lookAt(0, .95, 0);
  return mountCard(canvas, { camera, toneMapping: true, build(scene) {
    scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
    const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
    const pana = buildCharacter(loadAvatar(), { head: HEAD_SIZE }); scene.add(pana.group);
    const gloves = [pana.armL, pana.armR].map((arm, i) => {
      return wearGlove(arm, { side: i ? -1 : 1 });
    });
    const helmet = createAccessories(pana, { hat: 'casco', glasses: null, neck: null, back: null, extras: {} });
    helmetSwap(pana.head, helmet.hats.casco.root).on(); helmet.color('hat', 'casco', 'main', '#ffc629');
    return {
      update(dt, _t, now) {
        const t = now / 1000, jab = Math.max(0, Math.sin(t * 2.2) - .85) / .15;
        pana.group.rotation.y = Math.sin(t * .7) * .45; pana.group.position.y = Math.abs(Math.sin(t * 6)) * .05;
        pana.update(dt, {});
        pana.armL.rotation.set(-1.85 + .25 * jab, 0, -.3 + .24 * jab); pana.armL.scale.y = 1.15 + .5 * jab;
        pana.armR.rotation.set(-1.85, 0, .3); pana.armR.scale.y = 1.15;
        const rolls = [handRoll('jab', { striking: true, extension: jab }), handRoll('idle')];
        gloves.forEach((g, i) => settleGlove(g, [pana.armL, pana.armR][i], pana.group, GLOVE_SIZE, rolls[i]));
      },
      dispose() { gloves.forEach(g => g.userData.dispose()); helmet.dispose(); pana.dispose(); },
    };
  } });
}
