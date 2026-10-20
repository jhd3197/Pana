// The hub tile's live art, shown while the game has no launcher illustration
// in web/launcher-art.js: the player's own pana in gloves and a moto helmet,
// bouncing in guard and throwing the odd jab. mount(canvas) → dispose.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { boxingGlove, motoHelmet } from './set.js';

export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .1, 30);
  camera.position.set(0, 1.4, 5.6); camera.lookAt(0, .95, 0);
  scene.add(new THREE.HemisphereLight('#fff6df', '#6d5a48', 3));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 5, 4); scene.add(sun);
  const pana = buildCharacter(loadAvatar()); scene.add(pana.group);
  const gloves = [pana.armL, pana.armR].map((arm, i) => {
    const glove = boxingGlove({ side: i ? -1 : 1 }); glove.scale.setScalar(1 / .6); glove.position.set(0, -.86, .04); arm.add(glove); return glove;
  });
  const helmet = motoHelmet({ color: '#ffc629' }); helmet.scale.setScalar(1 / .6 * 1.04); helmet.position.y = .06; pana.head.add(helmet);
  let stopped = false, last = performance.now();
  function frame(now) {
    if (stopped) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, dt = Math.min(.05, (now - last) / 1000); last = now;
    if (w && h) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      const t = now / 1000, jab = Math.max(0, Math.sin(t * 2.2) - .85) / .15;
      pana.group.rotation.y = Math.sin(t * .7) * .45; pana.group.position.y = Math.abs(Math.sin(t * 6)) * .05;
      pana.update(dt, {});
      pana.armL.rotation.set(-2.15 + .55 * jab, 0, -.38 + .3 * jab); pana.armL.scale.y = 1 + .5 * jab;
      pana.armR.rotation.set(-2.15, 0, .38); pana.armR.scale.y = 1;
      gloves[0].scale.set(1 / .6, 1 / .6 / pana.armL.scale.y, 1 / .6);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const dispose = () => { stopped = true; gloves.forEach(g => g.userData.dispose()); helmet.userData.dispose(); pana.dispose(); renderer.dispose(); };
  addEventListener('pagehide', dispose, { once: true });
  return dispose;
}
