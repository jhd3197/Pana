import * as THREE from 'three';
import { createPlazaEnvironment } from '/engine/plaza.js';
import { createGameTable, createGameChair, disposeModel } from '/engine/models/props/game-table.js';
import { buildCharacter } from '/engine/character.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { bindRenderer } from '/engine/settings.js';
import { createSpanishCard, createScoreToken } from './models.js';
import { deck, previewPlay, teamOf } from './rules.js';

const UP = new THREE.Vector3(0, 1, 0), Y = 1.48;
const LOOKS = [{ hat: 'llanero', outfitColor: '#dc7854' }, { hat: 'pesca', hatColor: '#ddad58', outfitColor: '#4c9385', glasses: 'redondos', face: 'feliz' }, { hat: 'gorra', outfitColor: '#b8c279' }, { hat: 'band', outfitColor: '#c96c59' }];

export async function createCaidaScene(canvas, { onCard, onLoading = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
  const unbind = bindRenderer(renderer, 1.5), scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8c69e'); scene.fog = new THREE.Fog('#d8c69e', 24, 60);
  const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, .1, 100);
  scene.add(new THREE.HemisphereLight('#e8f2ed', '#997a57', 2.4));
  const sun = new THREE.DirectionalLight('#ffe3ad', 3.1); sun.position.set(-6, 14, 8); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.normalBias = .025; sun.shadow.bias = -.0001; scene.add(sun);
  onLoading('Preparando el patio…'); await new Promise(requestAnimationFrame);
  const plaza = createPlazaEnvironment({ cooking: true, clearance: (x, z) => Math.hypot(x, z) > 9 }); plaza.group.scale.setScalar(.72); scene.add(plaza.group);
  const table = createGameTable({ feltColor: '#245e50', caption: 'CAÍDA · ENTRE PANAS' }); scene.add(table);
  const cards = new Map(), chairs = [], characters = [], characterKeys = [], labels = [], tokens = [];
  let state, ownSeat = 0, selected = null, cameraMode = 'patio', disposed = false, time = 0, hover = null, geometryVersion = '', animationId = 0;
  const desiredCamera = new THREE.Vector3(), target = new THREE.Vector3(), projected = new THREE.Vector3();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  for (const card of deck()) {
    const model = createSpanishCard(card); model.userData.cardId = card.id; scene.add(model);
    cards.set(card.id, { model, target: new THREE.Vector3(-2.45, Y, -.6), rotation: new THREE.Quaternion(), visible: true, playable: false, initialized: false, lift: 0 });
  }
  for (let seat = 0; seat < 4; seat++) {
    const chair = createGameChair(); scene.add(chair); chairs.push(chair);
    const label = document.createElement('div'); label.className = 'world-label'; label.hidden = true; document.getElementById('world-labels').append(label); labels.push(label);
    const scoreTokens = Array.from({ length: 12 }, () => { const token = createScoreToken(); scene.add(token); return token; }); tokens.push(scoreTokens);
  }
  const angleOf = seat => seat * Math.PI * 2 / (state?.players.length || 2);
  function cameraTarget(immediate = false) {
    const mobile = innerWidth < 700, angle = angleOf(ownSeat) + (cameraMode === 'mesa' ? .02 : .17);
    const crowded = (state?.players.length || 2) > 2;
    const radius = mobile ? cameraMode === 'mesa' ? 7.5 : crowded ? 18 : 15 : cameraMode === 'mesa' ? 6.8 : 10.4;
    const height = mobile ? cameraMode === 'mesa' ? 20 : crowded ? 23 : 19 : cameraMode === 'mesa' ? 15.5 : 12.4;
    desiredCamera.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius); target.set(0, mobile ? 1.2 : .45, 0);
    camera.aspect = innerWidth / innerHeight; camera.fov = mobile ? 42 : 36;
    if (state?.phase === 'lobby' && innerWidth > 1000) camera.setViewOffset(innerWidth, innerHeight, -155, 15, innerWidth, innerHeight); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); if (immediate || reduced.matches) camera.position.copy(desiredCamera);
  }
  cameraTarget(true); camera.lookAt(target);

  async function syncCharacters(players) {
    for (const p of players) {
      if (disposed) return;
      const avatar = normalizeAvatar(p.id === null ? LOOKS[p.seat] : p.avatar), key = JSON.stringify(avatar);
      if (characterKeys[p.seat] !== key) {
        characterKeys[p.seat] = key; characters[p.seat]?.dispose();
        const character = buildCharacter(avatar, { seated: true }); characters[p.seat] = character; scene.add(character.group);
      }
      const character = characters[p.seat], a = angleOf(p.seat);
      chairs[p.seat].position.set(Math.sin(a) * 4.05, 0, Math.cos(a) * 4.05); chairs[p.seat].rotation.y = a + Math.PI;
      character.group.position.copy(chairs[p.seat].position); character.group.position.y = .76; character.group.rotation.y = a + Math.PI; character.group.visible = true;
      renderer.render(scene, camera); await new Promise(requestAnimationFrame);
    }
    for (let i = players.length; i < 4; i++) { if (characters[i]) characters[i].group.visible = false; }
  }
  onLoading('Barajando las cartas…');
  await syncCharacters(LOOKS.slice(0, 2).map((_, seat) => ({ seat, id: null })));

  function update(value, seat, chosen = null) {
    if (disposed) return; state = value; ownSeat = Math.max(0, seat); selected = chosen; cameraTarget();
    const version = JSON.stringify(state.players.map(p => [p.id, p.avatar]));
    if (version !== geometryVersion) { geometryVersion = version; syncCharacters(state.players); }
    const preview = selected ? previewPlay(state, state.players[ownSeat].hand.find(c => c.id === selected), ownSeat) : null;
    const lastPlay = [...state.history].reverse().find(e => e.kind === 'play');
    const newlyPlayed = lastPlay && lastPlay.id !== animationId;
    if (lastPlay) animationId = lastPlay.id;
    for (const [id, entry] of cards) {
      entry.playable = false; let face = false, zone = 'stock';
      const index = state.table.findIndex(c => c.id === id), player = state.players.find(p => p.hand.some(c => c.id === id)), capturedBy = state.players.find(p => p.captured.some(c => c.id === id));
      if (index >= 0) {
        const columns = Math.min(5, state.table.length), rows = Math.ceil(state.table.length / columns);
        entry.target.set((index % columns - (columns - 1) / 2) * .79, Y + .015, (Math.floor(index / columns) - (rows - 1) / 2) * 1.07 - .12);
        entry.rotation.setFromAxisAngle(UP, angleOf(ownSeat)); face = true; zone = 'table';
      } else if (player) {
        const i = player.hand.findIndex(c => c.id === id), a = angleOf(player.seat), offset = i - (player.hand.length - 1) / 2;
        entry.target.set(offset * .56, Y + .19 + (id === selected ? .24 : 0), 2.35 + Math.abs(offset) * .05).applyAxisAngle(UP, a);
        entry.rotation.setFromEuler(new THREE.Euler(0, a, 0)); entry.rotation.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.7, offset * -.07, offset * -.12)));
        face = player.seat === seat; zone = 'hand'; entry.playable = state.phase === 'playing' && state.turn === seat && player.seat === seat;
      } else if (capturedBy) {
        const a = angleOf(capturedBy.seat), n = capturedBy.captured.findIndex(c => c.id === id);
        entry.target.set(2.25, Y + n * .025, 2.05).applyAxisAngle(UP, a); entry.rotation.setFromAxisAngle(UP, a + .07 * Math.sin(n)); zone = 'captured';
      } else if (state.phase === 'lobby') {
        const demo = ['oros-1', 'copas-12', 'espadas-3', 'bastos-7'].indexOf(id);
        if (demo >= 0) { entry.target.set((demo - 1.5) * .83, Y + .03, -.4); entry.rotation.setFromAxisAngle(UP, (demo - 1.5) * -.08); face = true; }
        else { const n = deck().findIndex(c => c.id === id); entry.target.set(-2.25, Y + n * .024, .6); entry.rotation.identity(); }
      } else {
        const n = state.stock.findIndex(c => c.id === id); entry.target.set(-2.35, Y + Math.max(0, n) * .024, -.4); entry.rotation.identity();
      }
      entry.model.userData.faceUp(face); entry.model.userData.highlight(id === selected || preview?.capture.includes(id));
      if (newlyPlayed && lastPlay && (lastPlay.card.id === id || lastPlay.captured.includes(id))) entry.lift = reduced.matches ? 0 : 1;
      if (!entry.initialized || reduced.matches) { entry.model.position.copy(entry.target); entry.model.quaternion.copy(entry.rotation); entry.initialized = true; }
      entry.zone = zone;
    }
    for (let i = 0; i < 4; i++) {
      const p = state.players[i]; chairs[i].visible = !!p; labels[i].hidden = !p || (i === seat && state.phase === 'playing');
      tokens[i].forEach((token, j) => {
        token.visible = !!p && j < Math.min(12, state.scores[teamOf(state, i)] || 0);
        const a = angleOf(i); token.position.set(-2.3 + (j % 4) * .22, Y + Math.floor(j / 4) * .04, 2.2).applyAxisAngle(UP, a);
      });
      if (!p) continue;
      const label = labels[i]; label.replaceChildren(); label.classList.toggle('active', state.phase === 'playing' && state.turn === i);
      const title = document.createElement('strong'), note = document.createElement('span'); title.textContent = p.id === null ? `${p.name} · bot` : p.name;
      note.textContent = state.phase === 'playing' && state.turn === i ? 'Su turno' : i === seat ? 'Tu puesto' : state.options.mode === 'teams' && i % 2 === ownSeat % 2 ? 'Tu pareja' : 'En la mesa'; label.append(title, note);
    }
  }
  const cursor = new THREE.Vector2(), ray = new THREE.Raycaster(); let down;
  function pick(event) {
    cursor.set(event.clientX / innerWidth * 2 - 1, -event.clientY / innerHeight * 2 + 1); ray.setFromCamera(cursor, camera);
    const hits = ray.intersectObjects([...cards.values()].filter(c => c.playable).map(c => c.model), true);
    if (!hits.length) return null; let node = hits[0].object; while (node && !node.userData.cardId) node = node.parent; return node?.userData.cardId || null;
  }
  const pointerMove = e => { hover = pick(e); canvas.style.cursor = hover ? 'pointer' : 'default'; };
  const pointerDown = e => { down = [e.clientX, e.clientY]; };
  const pointerUp = e => { if (down && Math.hypot(down[0] - e.clientX, down[1] - e.clientY) < 12) { const id = pick(e); if (id) onCard?.(id); } down = null; };
  canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointerup', pointerUp);
  function frame(dt) {
    if (disposed) return; time += dt; plaza.update(time); camera.position.lerp(desiredCamera, 1 - Math.exp(-dt * 5)); camera.lookAt(target);
    for (const [id, card] of cards) {
      card.lift = Math.max(0, card.lift - dt * 1.6); const dest = card.target.clone(); dest.y += Math.sin(card.lift * Math.PI) * .7 + (id === hover ? .08 : 0);
      card.model.position.lerp(dest, reduced.matches ? 1 : 1 - Math.exp(-dt * 9)); card.model.quaternion.slerp(card.rotation, reduced.matches ? 1 : 1 - Math.exp(-dt * 10));
    }
    characters.forEach((c, i) => {
      if (!c?.group.visible) return; c.update(dt, {});
      c.neck.rotation.x = .12; c.neck.rotation.y = reduced.matches ? 0 : Math.sin(time * .5 + i) * .1;
      const active = state?.phase === 'playing' && state.turn === i;
      c.arms.forEach((arm, j) => arm.rotation.set(-.62 - (active ? .08 : 0), 0, (j ? -1 : 1) * .13));
      projected.copy(c.group.position); projected.y = 3.1; projected.project(camera);
      labels[i].style.left = `${THREE.MathUtils.clamp((projected.x * .5 + .5) * innerWidth, 65, innerWidth - 65)}px`; labels[i].style.top = `${(-projected.y * .5 + .5) * innerHeight}px`;
    });
    renderer.render(scene, camera);
  }
  const resize = () => { renderer.setSize(innerWidth, innerHeight); cameraTarget(); }; addEventListener('resize', resize);
  return { scene, camera, renderer, cards, characters, update, frame, setView(value) { cameraMode = value; cameraTarget(); },
    dispose() {
      disposed = true; unbind(); removeEventListener('resize', resize); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointerup', pointerUp);
      cards.forEach(c => c.model.userData.dispose()); tokens.flat().forEach(t => t.userData.dispose()); characters.forEach(c => c?.dispose()); chairs.forEach(c => c.userData.dispose()); labels.forEach(l => l.remove()); table.userData.dispose(); disposeModel(plaza.group); renderer.dispose();
    },
  };
}
