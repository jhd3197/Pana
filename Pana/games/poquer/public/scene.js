import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { bindRenderer } from '/engine/settings.js';
import { tablePlayers } from './rules.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-14, 14, 10, -10, .1, 100), avatars = new Map();
  camera.position.set(0, 16, 22); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff2d6', '#31544c', 2.5));
  const lamp = new THREE.DirectionalLight('#ffe5b3', 3.5); lamp.position.set(-5, 18, 7); lamp.castShadow = true; Object.assign(lamp.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12 }); lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp);
  const materials = [];
  function mat(color) { const m = new THREE.MeshStandardMaterial({ color, roughness: .8 }); materials.push(m); return m; }
  function oval(radius, height, y, color) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 80), mat(color)); mesh.scale.z = .57; mesh.position.y = y; mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; }
  oval(10.2, .6, .8, '#6b4230'); oval(9.7, .3, 1.13, '#322d33'); oval(9.1, .12, 1.32, '#226b58');
  const trim = new THREE.Mesh(new THREE.TorusGeometry(9.45, .045, 6, 90), mat('#d7ad64')); trim.rotation.x = Math.PI / 2; trim.scale.y = .57; trim.position.y = 1.33; scene.add(trim);
  const chipGeo = new THREE.CylinderGeometry(.25, .25, .09, 20), chipMats = ['#e7c86f', '#c15a61', '#69aea0'].map(mat);
  for (let i = 0; i < 12; i++) for (let j = 0; j < 3 + i % 5; j++) { const chip = new THREE.Mesh(chipGeo, chipMats[i % 3]); chip.position.set(-2.8 + i % 6 * 1.1, 1.46 + j * .1, (i < 6 ? -1 : 1) * 3.6); scene.add(chip); }
  const seatPositions = [[0, 6.5], [-9, 3.2], [-9, -3.2], [0, -6.5], [9, -3.2], [9, 3.2]];
  function position(slot) { return seatPositions[slot % 6]; }
  let seats = [];
  return { renderer, scene, camera, avatars,
    draw(state, me, dt) {
      canvas.style.width = '100%'; canvas.style.height = '100%';
      const w = canvas.clientWidth, h = canvas.clientHeight, aspect = w / h;
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
      const half = Math.max(7.4, 12.3 / aspect);
      camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
      const players = tablePlayers(state), own = players.findIndex(p => p.id === me); const ordered = own < 0 ? players : [...players.slice(own), ...players.slice(0, own)];
      const slots = ordered.length <= 2 ? [0, 3] : ordered.length <= 4 ? [0, 2, 3, 5] : [0, 1, 2, 3, 4, 5];
      seats = ordered.map((p, i) => ({ ...p, slot: slots[i] }));
      for (const p of seats) {
        let character = avatars.get(p.id);
        if (!character) { character = buildCharacter(p.avatar, { seated: true }); scene.add(character.group); avatars.set(p.id, character); }
        const [x, z] = position(p.slot); character.group.position.set(x, .5, z); character.group.rotation.y = Math.atan2(-x, -z); character.update(dt, {});
      }
      for (const [id, avatar] of avatars) if (!players.some(p => p.id === id)) { avatar.dispose(); avatars.delete(id); }
      renderer.render(scene, camera);
    },
    anchors() { return seats.map(p => { const [x, z] = position(p.slot); const q = new THREE.Vector3(x, z < -2 ? 3.5 : -.65, z + .4).project(camera); return { id: p.id, x: (q.x + 1) / 2 * 100, y: (1 - q.y) / 2 * 100 }; }); },
    dispose() { avatars.forEach(a => a.dispose()); scene.traverse(o => o.geometry?.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); },
  };
}
