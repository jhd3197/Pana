import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { createGameChair } from '/engine/models/props/game-table.js';
import { createPokerTable, createPokerCard, createPokerChips } from '/engine/models/props/poker.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { createStarterStage } from '/engine/play/quien-empieza.js';
import { tablePlayers } from './rules.js';

const SEATS = [[0, 4.15], [-4.65, 2.2], [-4.65, -2.2], [0, -4.15], [4.65, -2.2], [4.65, 2.2]];
export function createScene(canvas, { onStarter } = {}) {
  const stage = createTableWorld(canvas), { scene, camera, renderer } = stage;
  const table = createPokerTable(); scene.add(table);
  // ¿Quién empieza?: a cacho on the felt in front of each pana. Starter seats are
  // indexes into state.players; each lands where that pana sits for this viewer.
  let current = null;
  const starter = createStarterStage({ root: scene, camera, canvas, scale: .55, onInput: onStarter, spot: seat => {
    const id = current?.players[seat]?.id, slot = seats.find(p => p.id === id)?.slot ?? 0, [x, z] = SEATS[slot], d = Math.hypot(x, z);
    return { position: [x * .6, 1.49, z * .6], out: [x / d, z / d] };
  } });
  const avatars = new Map(), chairs = new Map(), cards = new Map(), chips = new Map();
  const bounds = new THREE.Box3(new THREE.Vector3(-5.7, .45, -4.5), new THREE.Vector3(5.7, 2.8, 4.5));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let seats = [], version = '', view = 'plaza';
  function sync(state, me) {
    stage.setMap(state.mapId); current = state;
    const players = tablePlayers(state), own = players.findIndex(p => p.id === me), ordered = own < 0 ? players : [...players.slice(own), ...players.slice(0, own)];
    const slots = ordered.length <= 2 ? [0, 3] : ordered.length <= 4 ? [0, 2, 3, 5] : [0, 1, 2, 3, 4, 5];
    seats = ordered.map((p, i) => ({ ...p, slot: slots[i] }));
    const liveCards = new Set(), liveChips = new Set();
    function card(key, value, x, z, angle = 0) {
      liveCards.add(key); let entry = cards.get(key);
      if (!entry || entry.model.userData.card !== value) {
        entry?.model.userData.dispose(); const model = createPokerCard({ card: value }); scene.add(model);
        model.position.set(-2.8, 1.52, -.7); entry = { model, target: new THREE.Vector3(), angle }; cards.set(key, entry);
      }
      entry.target.set(x, 1.52, z); entry.angle = angle;
    }
    function stack(key, count, x, z, color) {
      if (!count) return; liveChips.add(key); const size = Math.min(12, Math.max(1, Math.ceil(count / 100)));
      let model = chips.get(key);
      if (!model || model.userData.count !== size) { model?.userData.dispose(); model = createPokerChips({ count: size, color }); model.userData.count = size; chips.set(key, model); scene.add(model); }
      model.position.set(x, 1.5, z);
    }
    state.board.forEach((c, i) => card(`board-${i}`, c, (i - 2) * .77, -.2));
    // No hidden values are inferred: null private cards create only a back texture.
    for (const p of seats) {
      const [x, z] = SEATS[p.slot], angle = Math.atan2(x, z), key = JSON.stringify(normalizeAvatar(p.avatar));
      let avatar = avatars.get(p.id);
      if (!avatar || avatar.key !== key) { avatar?.dispose(); avatar = buildCharacter(p.avatar, { seated: true }); avatar.key = key; avatars.set(p.id, avatar); scene.add(avatar.group); }
      let chair = chairs.get(p.id); if (!chair) { chair = createGameChair(); chairs.set(p.id, chair); scene.add(chair); }
      chair.position.set(x, 0, z); chair.rotation.y = angle + Math.PI;
      avatar.group.position.set(x, .76, z); avatar.group.rotation.y = angle + Math.PI;
      if (!p.folded) p.hole.forEach((c, i) => {
        const offset = (i - (p.hole.length - 1) / 2) * (p.hole.length > 2 ? .55 : .68);
        card(`hand-${p.id}-${i}`, c, x * .67 + Math.cos(angle) * offset, z * .65 - Math.sin(angle) * offset, angle);
      });
      const stackOffset = p.hole.length > 2 ? 1.6 : 1.02;
      stack(`stack-${p.id}`, p.chips, x * .72 - Math.cos(angle) * stackOffset, z * .7 + Math.sin(angle) * stackOffset, '#3a9990');
      stack(`bet-${p.id}`, p.bet, x * .39, z * .4 + .5, '#c15a61');
    }
    stack('pot', state.pot, 0, -.98, '#c9a84c');
    for (const [id, entry] of cards) if (!liveCards.has(id)) { entry.model.userData.dispose(); cards.delete(id); }
    for (const [id, model] of chips) if (!liveChips.has(id)) { model.userData.dispose(); chips.delete(id); }
    for (const [id, avatar] of avatars) if (!players.some(p => p.id === id)) { avatar.dispose(); avatars.delete(id); chairs.get(id)?.userData.dispose(); chairs.delete(id); }
    starter.update(state.starter, { ownSeat: state.players.findIndex(p => p.id === me), names: state.players.map(p => p.name) });
  }
  function draw(state, me, dt) {
    const next = JSON.stringify([state.revision, me, state.players.map(p => [p.id, p.avatar, p.chips, p.connected])]);
    if (next !== version) { version = next; sync(state, me); }
    const { w, h } = stage.resize(), lobby = state.phase === 'lobby', short = h < 520 && w > h, mobile = w < 650;
    const safe = lobby ? w > 760 ? { x: 385, y: 80, width: w - 410, height: h - 105 } : { x: 14, y: 60, width: w - 28, height: Math.max(170, h - 480) }
      : short ? { x: 22, y: 62, width: w - 340, height: h - 82 } : { x: mobile ? 30 : 55, y: mobile ? 113 : 100, width: w - (mobile ? 60 : 110), height: h - (mobile ? 380 : 320) };
    safe.width = Math.max(200, safe.width); safe.height = Math.max(160, safe.height);
    stage.frameCamera(bounds, [lobby ? .2 : 0, view === 'mesa' ? 2.2 : .8, 1], safe);
    for (const p of seats) { const avatar = avatars.get(p.id); avatar.update(dt, {}); avatar.neck.rotation.x = .15; avatar.arms.forEach(arm => arm.rotation.x = p.id === state.turn ? -.75 : -.5); }
    for (const entry of cards.values()) { entry.model.position.lerp(entry.target, reduced.matches ? 1 : 1 - Math.exp(-dt * 10)); entry.model.rotation.y = entry.angle; }
    starter.frame(dt); stage.draw(dt);
  }
  return { renderer, scene, camera, avatars, cards, chips, starter, draw, setView(value) { view = value; },
    anchors() { return seats.map(p => { const [x, z] = SEATS[p.slot], y = p.slot === 0 && camera.aspect > 1 ? .8 : z < 0 ? 3.35 : -.1, q = new THREE.Vector3(x, y, z + .3).project(camera); return { id: p.id, x: (q.x + 1) * 50, y: (1 - q.y) * 50 }; }); },
    dispose() { starter.dispose(); avatars.forEach(a => a.dispose()); chairs.forEach(c => c.userData.dispose()); cards.forEach(c => c.model.userData.dispose()); chips.forEach(c => c.userData.dispose()); table.userData.dispose(); stage.dispose(); },
  };
}
