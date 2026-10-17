import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';

// One short-lived renderer makes portraits from the player's actual saved sculpt.
export function portrait(avatar) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(160, 160); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 20);
  const character = buildCharacter(normalizeAvatar(avatar));
  try {
    scene.add(character.group); character.group.rotation.y = -.2;
    scene.add(new THREE.HemisphereLight('#fff1d2', '#4c7564', 2.8));
    const key = new THREE.DirectionalLight('#fff3db', 3); key.position.set(-3, 5, 5); scene.add(key);
    camera.position.set(0, 1.6, 5.5); camera.lookAt(0, 1.25, 0); renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally { character.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
}
