// The board camera. It always looks from the front (+Z) at a 3/4 angle, like
// the box art, so the board keeps one orientation: the plateau and hill rise
// at the back and nothing tall stands between the camera and the path.
// "Ver tablero" hands it to the player: drag to orbit, scroll to zoom, Tab or
// the button to return; the scenic spots and the minimap jump it somewhere.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';

const SHOTS = {
  far: [0, 30, 36],        // a big chunk of the island (the minimap shows all of it)
  mid: [0, 14, 17],        // a pana and its neighborhood
  close: [0, 8, 10.5],     // buying, events, the winner
};
const SCENIC_SPOTS = {
  island: { target: [0, 12, -12], camera: [0, 156, 285] },
  beach: { target: [12, 2, 90], camera: [34, 24, 137] },
  waterfall: { target: [130, 64, -310], camera: [245, 115, 15] },
  harbor: { target: [123, 3, 24], camera: [162, 26, 66] },
};

// camera: the board's PerspectiveCamera; canLook(): the board is on screen;
// lookButton and places: the "Ver tablero" button and the scenic-spot select.
export function createBoardCamera({ camera, dom, canLook, lookButton, places }) {
  // Where the camera is and looks now, and where it is easing to.
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), wantPos: new THREE.Vector3(), wantLook: new THREE.Vector3(), kind: 'mid' };
  const looker = new OrbitControls(camera, dom);
  Object.assign(looker, { enabled: false, enableDamping: true, maxPolarAngle: 1.42, minDistance: 6, maxDistance: 360 });
  let freeLook = false;

  function focus(at, kind = 'mid') {
    const o = SHOTS[kind];
    cam.kind = kind;
    cam.wantLook.set(at.x, at.y + 1, at.z);
    cam.wantPos.set(at.x + o[0], at.y + o[1], at.z + o[2]);
  }
  function setFreeLook(on) {
    if (on && !canLook()) return;
    freeLook = on;
    looker.enabled = on;
    if (on) looker.target.copy(cam.look);
    else {
      cam.pos.copy(camera.position);
      cam.look.copy(looker.target);
    }
    lookButton.classList.toggle('on', on);
    lookButton.innerHTML = `${on ? 'Volver' : 'Ver tablero'} <kbd class="pk-kbd" data-pana-hint>Tab</kbd>`;
    if (!on) places.value = '';
  }
  // Free look at a point from above and south of it (the minimap's tap).
  function lookAt(x, y, z) {
    if (!freeLook) setFreeLook(true);
    looker.target.set(x, y, z);
    camera.position.set(x, y + 34, z + 40);
  }
  lookButton.onclick = () => setFreeLook(!freeLook);
  places.addEventListener('change', (event) => {
    const spot = SCENIC_SPOTS[event.target.value];
    if (!spot || !canLook()) return;
    setFreeLook(true);
    looker.target.set(...spot.target);
    camera.position.set(...spot.camera);
    looker.update();
  });

  return {
    cam, focus, setFreeLook, lookAt,
    get freeLook() { return freeLook; },
    // What the camera is looking at: the orbit target in free look.
    get target() { return freeLook ? looker.target : cam.look; },
    // Jump straight to the wanted shot (no easing), e.g. at the start.
    snap() { cam.pos.copy(cam.wantPos); cam.look.copy(cam.wantLook); },
    update(dt) {
      if (freeLook) { looker.update(); return; }
      cam.pos.lerp(cam.wantPos, Math.min(1, dt * 2.2));
      cam.look.lerp(cam.wantLook, Math.min(1, dt * 2.8));
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
    },
  };
}
