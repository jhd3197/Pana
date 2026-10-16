import * as THREE from 'three';
import { createPlazaEnvironment } from '/engine/plaza.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { bindRenderer } from '/engine/settings.js';
import { createDominoTable, createDominoChair, createDominoTile, disposeModel } from './table-model.js';
import { chainLayout } from './tiles.js';
import { deck, legalEnds } from './rules.js';

const Y = 1.46, UP = new THREE.Vector3(0, 1, 0);
const BOT_LOOKS = [
  { hat: 'llanero', outfitColor: '#cf8a45', face: 'feliz' },
  { hat: 'gorra', hatColor: '#cf8a45', outfitColor: '#e4ae4b', face: 'feliz' },
  { hat: 'pesca', hatColor: '#6d997d', outfitColor: '#4d8f78', glasses: 'redondos' },
  { hat: 'band', hatColor: '#ee886a', outfitColor: '#cf7959', face: 'wow' },
];
const nextFrame = () => new Promise(requestAnimationFrame);
export async function createDominoScene(canvas, { onTile, onEnd, onLoading = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const unbind = bindRenderer(renderer, 1.5);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e5cd9f'); scene.fog = new THREE.Fog('#e5cd9f', 28, 65);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 100);
  scene.add(new THREE.HemisphereLight('#e4f1ff', '#a4815a', 2.2));
  const sun = new THREE.DirectionalLight('#ffe4b1', 3.5); sun.position.set(-8, 16, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: .5, far: 50 }); sun.shadow.normalBias = .025; sun.shadow.bias = -.00015; sun.shadow.radius = 3; scene.add(sun);
  onLoading('Abriendo la plaza…'); await nextFrame();
  const plaza = createPlazaEnvironment({ cooking: true, clearance: (x, z) => Math.hypot(x, z) > 9 });
  plaza.group.scale.setScalar(.72); scene.add(plaza.group);
  const table = createDominoTable(); scene.add(table);
  const chairs = [], characters = Array(4).fill(null), characterKeys = Array(4).fill(''), labels = [];
  for (let seat = 0; seat < 4; seat++) {
    const angle = seat * Math.PI / 2, chair = createDominoChair();
    chair.position.set(Math.sin(angle) * 4.05, 0, Math.cos(angle) * 4.05); chair.rotation.y = angle + Math.PI;
    scene.add(chair); chairs.push(chair);
    const label = document.createElement('div'); label.className = 'world-label'; label.hidden = true; document.getElementById('world-labels').append(label); labels.push(label);
  }
  const tiles = new Map();
  for (const tile of deck()) {
    const model = createDominoTile(tile); model.userData.tileId = tile.id; scene.add(model);
    tiles.set(tile.id, { model, target: new THREE.Vector3(), rotation: new THREE.Quaternion(), lift: 0, initialized: false });
  }
  const tips = ['left', 'right'].map((end, index) => {
    const element = document.createElement('button'); element.className = 'world-end'; element.hidden = true;
    element.onclick = () => onEnd?.(end); element.dataset.end = end;
    document.getElementById('world-labels').append(element);
    return { element, index, position: new THREE.Vector3() };
  });
  const cursor = new THREE.Vector2(), ray = new THREE.Raycaster(); let down, hover = null;
  const pick = event => {
    cursor.set(event.clientX / innerWidth * 2 - 1, -event.clientY / innerHeight * 2 + 1); ray.setFromCamera(cursor, camera);
    for (const hit of ray.intersectObjects([...tiles.values()].filter(t => t.playable).map(t => t.model), true)) {
      let node = hit.object; while (node && !node.userData.tileId) node = node.parent;
      if (node) return node.userData.tileId;
    }
    return null;
  };
  const move = event => { hover = pick(event); canvas.style.cursor = hover ? 'pointer' : 'default'; };
  const pointerDown = event => { down = { x: event.clientX, y: event.clientY }; };
  const pointerUp = event => { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 12) { const id = pick(event); if (id) onTile?.(id); } down = null; };
  canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp);
  let state = null, ownSeat = 0, selected = null, cameraMode = 'plaza', disposed = false, time = 0, lastEvent = '', actingSeat = -1, actTime = 0;
  const desiredCamera = new THREE.Vector3(), target = new THREE.Vector3(), projected = new THREE.Vector3();
  function cameraTarget(immediate = false) {
    const mobile = innerWidth < 700, angle = ownSeat * Math.PI / 2 + (cameraMode === 'mesa' ? .04 : .31);
    const radius = mobile ? 21 : 13.2, height = cameraMode === 'mesa' ? mobile ? 23 : 15.6 : mobile ? 17 : 11.5;
    desiredCamera.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    // The foreground is reserved for the accessible hand, without covering the table.
    target.set(0, mobile ? .7 : .1, 0);
    if (immediate) camera.position.copy(desiredCamera);
    camera.aspect = innerWidth / innerHeight; camera.fov = mobile ? 43 : 38;
    if (state?.phase === 'lobby' && innerWidth >= 900) camera.setViewOffset(innerWidth, innerHeight, -80, 0, innerWidth, innerHeight);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  cameraTarget(true); camera.lookAt(target);
  async function syncCharacters(players) {
    for (const p of players) {
      if (disposed) return;
      const avatar = normalizeAvatar(p.id === null ? BOT_LOOKS[p.seat] : p.avatar), key = JSON.stringify(avatar);
      if (key === characterKeys[p.seat]) continue;
      characterKeys[p.seat] = key;
      characters[p.seat]?.dispose();
      const character = buildCharacter(avatar, { seated: true });
      character.group.position.copy(chairs[p.seat].position); character.group.position.y = .76; character.group.rotation.y = chairs[p.seat].rotation.y;
      scene.add(character.group); characters[p.seat] = character;
      renderer.render(scene, camera); await nextFrame();
    }
  }
  onLoading('Sentando a tus panas…');
  await syncCharacters(BOT_LOOKS.map((_, seat) => ({ seat, id: null })));
  function update(stateValue, seat, chosen = null) {
    if (disposed) return;
    state = stateValue; ownSeat = Math.max(0, seat); selected = chosen; cameraTarget();
    syncCharacters(state.players);
    const event = state.history.at(-1), key = `${state.round}:${state.history.length}`;
    if (lastEvent && key !== lastEvent && event) { actingSeat = event.seat; actTime = .9; }
    lastEvent = key;
    const perRow = 7, positions = chainLayout(state.chain.length, perRow);
    const bounds = positions.reduce((b, p) => ({ minX: Math.min(b.minX, p.x - 38), maxX: Math.max(b.maxX, p.x + 38), minZ: Math.min(b.minZ, p.y - 38), maxZ: Math.max(b.maxZ, p.y + 38) }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
    const factor = .0076, midX = (bounds.minX + bounds.maxX) / 2, midZ = (bounds.minZ + bounds.maxZ) / 2;
    const chainIds = new Set(state.chain.map(t => t.id));
    for (const [id, entry] of tiles) {
      const index = state.chain.findIndex(t => t.id === id), p = state.players.find(p => p.hand.some(t => t.id === id));
      entry.playable = false;
      if (index >= 0) {
        const pos = positions[index]; entry.target.set((pos.x - midX) * factor, Y, (pos.y - midZ) * factor);
        entry.rotation.setFromAxisAngle(UP, Math.PI / 2 - pos.angle * Math.PI / 180);
        const placed = state.chain[index], original = id.split('-').map(Number);
        if (placed.a !== original[0]) entry.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI));
        entry.model.scale.setScalar(1.02); entry.model.userData.faceUp(true);
        if (!entry.onBoard && entry.initialized) entry.lift = 1;
      } else if (p) {
        const i = p.hand.findIndex(t => t.id === id), angle = p.seat * Math.PI / 2;
        entry.target.set((i - (p.hand.length - 1) / 2) * .36, Y + .17, 2.65).applyAxisAngle(UP, angle);
        entry.rotation.setFromAxisAngle(UP, angle); entry.rotation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.22));
        entry.model.scale.setScalar(1); entry.model.userData.faceUp(p.seat === seat || ['round-over', 'finished'].includes(state.phase));
        entry.playable = state.phase === 'playing' && state.turn === seat && p.seat === seat && legalEnds(state, p.hand[i]).length > 0;
      } else {
        const n = Number(id[0]) * 7 + Number(id[2]);
        entry.target.set((n % 7 - 3) * .43, Y, (Math.floor(n / 7) - 3) * .39);
        entry.rotation.setFromAxisAngle(UP, Math.sin(n * 39) * 3); entry.model.scale.setScalar(1); entry.model.userData.faceUp(false);
      }
      entry.onBoard = chainIds.has(id); entry.model.userData.highlight(entry.playable || id === selected);
      if (!entry.initialized) { entry.model.position.copy(entry.target); entry.model.quaternion.copy(entry.rotation); entry.initialized = true; }
    }
    for (const p of state.players) {
      const label = labels[p.seat]; label.hidden = p.seat === seat && state.phase === 'playing'; label.replaceChildren();
      label.classList.toggle('active', state.phase === 'playing' && state.turn === p.seat); label.classList.toggle('partner', p.seat % 2 === ownSeat % 2);
      const title = document.createElement('strong'), note = document.createElement('span');
      title.textContent = p.seat === seat ? `${p.name} · tú` : p.name;
      note.textContent = state.phase === 'playing' && state.turn === p.seat ? p.seat === seat ? '¡Te toca!' : 'Pensando…' : `${p.seat === seat ? 'Tus fichas' : p.seat % 2 === ownSeat % 2 ? 'Tu pareja' : 'Rival'}${p.id === null ? ' · bot' : ''}`;
      label.append(title, note);
    }
    for (const tip of tips) {
      tip.element.hidden = !state.chain.length || state.phase === 'lobby';
      if (!state.chain.length) continue;
      const piece = state.chain[tip.index ? state.chain.length - 1 : 0];
      tip.element.textContent = `${tip.index ? 'B' : 'A'} · ${tip.index ? piece.b : piece.a}`;
      tip.element.setAttribute('aria-label', `Colocar en la punta ${tip.index ? 'B' : 'A'}`);
      const tile = state.players[ownSeat].hand.find(t => t.id === selected);
      tip.element.disabled = !selected || !legalEnds(state, tile).includes(tip.index ? 'right' : 'left');
      tip.position.copy(tiles.get(piece.id).target); tip.position.y += .18;
      tip.position.z += tip.index ? .36 : -.36;
    }
  }
  function frame(dt) {
    if (disposed) return;
    time += dt; plaza.update(time); actTime = Math.max(0, actTime - dt);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 4)); camera.lookAt(target);
    for (const [id, t] of tiles) {
      const lift = id === hover || id === selected ? .1 : 0;
      t.lift = Math.max(0, t.lift - dt * 1.8);
      const dest = t.target.clone(); dest.y += Math.sin(t.lift * Math.PI) * .5 + lift;
      t.model.position.lerp(dest, 1 - Math.exp(-dt * 10)); t.model.quaternion.slerp(t.rotation, 1 - Math.exp(-dt * 9));
    }
    characters.forEach((character, i) => {
      if (!character) return;
      character.update(dt, {});
      const active = state?.phase === 'playing' && state.turn === i, reach = actingSeat === i ? Math.sin(actTime / .9 * Math.PI) : 0;
      character.neck.rotation.x = active ? .15 + Math.sin(time * 2) * .025 : .07;
      character.neck.rotation.y = Math.sin(time * .4 + i * 3) * .12;
      const won = state?.result?.winner === i % 2;
      character.arms.forEach((arm, j) => arm.rotation.set(won ? -1.7 + Math.sin(time * 7 + j) * .3 : -.55 - (j ? 0 : reach * .75), 0, (j ? -1 : 1) * (won ? .65 : .12)));
      if (labels[i]) {
        projected.copy(character.group.position); projected.y = 3.05; projected.project(camera);
        const half = labels[i].offsetWidth / 2;
        labels[i].style.left = `${THREE.MathUtils.clamp((projected.x * .5 + .5) * innerWidth, half + 8, innerWidth - half - 8)}px`;
        labels[i].style.top = `${(-projected.y * .5 + .5) * innerHeight}px`;
      }
    });
    for (const tip of tips) {
      if (tip.element.hidden) continue;
      projected.copy(tip.position).project(camera);
      tip.element.style.left = `${(projected.x * .5 + .5) * innerWidth}px`; tip.element.style.top = `${(-projected.y * .5 + .5) * innerHeight}px`;
    }
    renderer.render(scene, camera);
  }
  const resize = () => { renderer.setSize(innerWidth, innerHeight); cameraTarget(); }; addEventListener('resize', resize);
  return { scene, camera, renderer, characters, tiles, update, frame,
    setView(value) { cameraMode = value; cameraTarget(); },
    dispose() {
      disposed = true; unbind(); removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp);
      characters.forEach(c => c?.dispose()); labels.forEach(l => l.remove()); tips.forEach(t => t.element.remove()); tiles.forEach(t => t.model.userData.dispose()); chairs.forEach(c => c.userData.dispose()); table.userData.dispose(); disposeModel(plaza.group); renderer.dispose();
    },
  };
}
