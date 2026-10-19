import { prepareScene } from '/engine/game-load.js';
// ¡Embuste! wiring: input → network (room or practice) → view → scene and HUD.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound, Shockwaves, createChargeRing } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';
import { OnlineNight, PracticeNight } from './network.js';
import { createCampWorld, groundAt } from './scene.js';
import { SEATS, zoneAt, zoneById, FIRE, ZONES, BOUNDS, STATIONS, REACH, BELL, VENTS, HIDES, FIXES, stationById, ventById, hideById, distance } from './layout.js';
import { mummyCount, MIN_PLAYERS, taskById, WRAP_RANGE, REPORT_RANGE, BELL_RANGE, VENT_RANGE, HIDE_RANGE, DISGUISES, SABOTAGES } from './rules.js';
import { vineSnare } from '/engine/models/props/embuste.js';
import { guardianModel } from './scene.js';
import { createPlazaProp, propDefinition } from '/engine/models/props/plaza.js';
import { createMeeting } from './ui.js';
import { bandageWrap } from '/engine/models/props/embuste.js';
import { openTask, HINTS } from './tasks.js';
import { setBar } from '/engine/kit.js';
import { createRoomOptions } from '/engine/room-options.js';
import { EMBUSTE_OPTIONS, defaultEmbusteOptions } from './options.js';
import { createToast } from '/engine/hud.js';

const $ = id => document.getElementById(id), show = (id, on) => $(id).classList.toggle('hidden', !on);
const notify = createToast($('toast'), { ms: 3400 });
const qs = new URLSearchParams(location.search), code = roomFromUrl() || newRoomCode();
const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
const avatar = loadAvatar(), name = qs.get('name')?.slice(0, 16) || loadName(), quick = qs.has('quick');
const noRender = qs.has('norender');   // browser suites: many pages on a software renderer
const colors = ['#ffb36b', '#81c8c4', '#d2a0a0', '#a3bc74', '#f2d16b', '#b7a8ce', '#6ea6d0', '#e58fb6', '#c1c5a6'];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true });
renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d22); scene.fog = new THREE.FogExp2(0x0b0d22, 0.018);
const moon = new THREE.HemisphereLight(0x6f7fd8, 0x121226, 0.9); scene.add(moon);
const fireLight = new THREE.PointLight(0xff9a45, 90, 26, 1.5); fireLight.position.set(FIRE.x, 2.2, FIRE.z); scene.add(fireLight);
const lantern = new THREE.PointLight(0xffd08a, 30, 14, 1.4); scene.add(lantern);
const world = createCampWorld(); scene.add(world.group);
const shockwaves = new Shockwaves(scene);
const chargeRing = createChargeRing({ radius: 1.55, color: 0xffc629 }); scene.add(chargeRing.mesh);
let lastFixStep = -1;
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 220);
const cameraTarget = new THREE.Vector3(0, 0, 0), temp = new THREE.Vector3();

// ---------- state ----------
let net = null, view = null, lobby = { phase: 'lobby', players: [], isHost: false }, paused = false, dead = false, phase = '';
const roomOptions = createRoomOptions($('lobby-options'), { title: '¡Embuste!', fields: EMBUSTE_OPTIONS,
  change: patch => net?.options(patch), reset: () => net?.options(defaultEmbusteOptions()) });
let last = performance.now(), elapsed = 0, rosterKey = '', uiClock = 0, endedAt = 0;
const actors = new Map(), keys = new Set(), touch = new Set();
const me = () => view?.me;
const rosterOf = seat => view?.roster.find(r => r.seat === seat);
const nameOf = seat => rosterOf(seat)?.name || 'Alguien';
const colorOf = seat => { const i = view?.roster.findIndex(r => r.seat === seat) ?? 0; return colors[Math.max(0, i) % colors.length]; };

function clearInput() { keys.clear(); touch.clear(); }

const menu = createGameMenu({
  title: '¡Embuste!', heading: 'Un respiro', resumeLabel: 'Volver a la noche', sound, notify,
  note: () => net && !net.online ? 'La práctica está en pausa.' : 'La noche sigue: no te quedes solo.',
  controls: [['W A S D / ↑ ← ↓ →', 'Moverte'], ['E', 'Usar: tareas, escondites, la campana; mantén para reparar'], ['R', 'Reportar una estatua de vendas'], ['Q', 'Envolver (momia)'], ['F', 'Sabotaje (momia)'], ['C', 'Disfraz (momia)'], ['M', 'Sonido']],
  tips: ['Las tareas tapan la pantalla: mira a tu alrededor antes de empezar.', 'Si encuentras a un pana envuelto, repórtalo y discutan en la fogata.', 'Las momias pueden meterse en los troncos huecos y aparecer al otro lado del mapa.'],
  actions: [{ id: 'menu-practice', label: 'Practicar con bots', kind: 'link', visible: () => !!net?.online, run: () => practice() }],
  invite: () => inviteUrl(code),
  onOpen() { paused = true; clearInput(); if (net && !net.online) net.paused = true; },
  onClose() { paused = false; if (net && !net.online) net.paused = false; },
});
const meeting = createMeeting({ act: (a, d) => net?.act(a, d), nameOf: s => nameOf(s), colorOf: s => colorOf(s) });
const navButton = 'pk-btn pk-btn--sm';
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: navButton }), menu.createSoundButton({ id: 'sound', className: navButton }), menu.createButton({ id: 'menu', className: navButton }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));

// ---------- connection ----------
function wire(n) {
  n.on('lobby', l => { lobby = l; updateLobby(); });
  n.on('view', v => receive(v));
  n.on('status', (text, error) => {
    $('connection').textContent = text;
    show('disconnect', !!error && !!view && view.phase !== 'lobby' && n.online);
    updateLobby();
  });
}
async function goOnline() {
  net = new OnlineNight({ code, name, avatar, quick }); wire(net);
  await net.connect(); updateLobby();
}
function practice() {
  net?.leave(); view = null;
  net = new PracticeNight({ name, avatar, quick }); wire(net); net.connect();
  show('disconnect', false); menu.update(); updateLobby();
}

// ---------- actors ----------
function label(text, color) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#0e0b24d8'; ctx.beginPath(); ctx.roundRect(8, 7, 240, 48, 8); ctx.fill();
  ctx.fillStyle = color; ctx.font = '800 25px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 32, 224);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })); sprite.scale.set(2.6, 0.65, 1); sprite.position.y = 3.1; sprite.renderOrder = 5; return sprite;
}
function disposeObject(root) {
  const geometries = new Set(), materials = new Set(); root.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => { m.map?.dispose(); m.dispose(); }); root.removeFromParent();
}
function removeActor(a) { a.character.dispose(); disposeObject(a.root); }
function actorFor(seat) {
  const r = rosterOf(seat); if (!r) return null;
  const skin = JSON.stringify(r.avatar) + r.name + (r.role || '');
  let a = actors.get(seat);
  if (a && a.skin === skin) return a;
  if (a) removeActor(a);
  const root = new THREE.Group(), character = buildCharacter(r.avatar);
  const partner = view.partners.includes(seat);
  const tag = label(seat === me().seat ? `${r.name} · tú` : r.name, partner ? '#9fe0c8' : colorOf(seat));
  root.add(character.group, tag); scene.add(root);
  a = { seat, root, character, tag, skin, seen: false }; actors.set(seat, a);
  return a;
}
// Momiitas show as see-through panas to other momiitas.
function ghostly(a, on) {
  if (a.ghostly === on) return; a.ghostly = on;
  a.character.group.traverse(o => { for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { m.transparent = on; m.opacity = on ? 0.42 : 1; m.depthWrite = !on; } });
}
// Wrapped panas: the pana's own model, frozen, under the shared bandages.
const statues = new Map();
function syncStatues() {
  const list = view.phase === 'playing' ? view.statues : [];
  for (const [seat, st] of statues) if (!list.some(s => s.seat === seat)) { st.character.dispose(); disposeObject(st.root); statues.delete(seat); }
  for (const s of list) {
    if (statues.has(s.seat)) continue;
    const r = rosterOf(s.seat); if (!r) continue;
    const root = new THREE.Group(), character = buildCharacter(r.avatar); character.update(0, {});
    const box = new THREE.Box3().setFromObject(character.group), size = box.getSize(new THREE.Vector3());
    const wrap = bandageWrap({ height: size.y * 0.98, radius: Math.max(size.x, size.z) * 0.5 });
    root.add(character.group, wrap); root.position.set(s.x, groundAt(s.x, s.z), s.z); character.group.rotation.y = s.h || 0;
    scene.add(root); statues.set(s.seat, { root, character });
  }
}
// Disguised mummies: a plaza prop where they stand, keyed so a name never leaks.
const props = new Map();
function syncProps() {
  const list = view.phase === 'playing' ? view.players.filter(p => p.prop) : [];
  const keyOf = p => `${p.seat ?? 'k' + p.key}:${p.prop}`, keep = new Set(list.map(keyOf));
  for (const [k, o] of props) if (!keep.has(k)) { o.removeFromParent(); props.delete(k); }
  for (const p of list) {
    let o = props.get(keyOf(p));
    if (!o) { o = createPlazaProp(p.prop); scene.add(o); props.set(keyOf(p), o); }
    o.position.set(p.x, groundAt(p.x, p.z), p.z); o.rotation.y = p.h;
  }
}
// Sandy footprints after a wrap: one instanced mesh, faded by age.
const PRINTS = 90, prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 10), new THREE.MeshBasicMaterial({ color: 0xc9a86b, transparent: true, opacity: 0.7, depthWrite: false }), PRINTS);
prints.count = 0; prints.renderOrder = 2; scene.add(prints);
function syncPrints() {
  const list = view.phase === 'playing' ? (view.footprints || []).slice(-PRINTS) : [], m = new THREE.Object3D();
  list.forEach((f, i) => {
    const side = i % 2 ? 0.14 : -0.14;
    m.position.set(f.x + Math.cos(f.h) * side, groundAt(f.x, f.z) + 0.03, f.z - Math.sin(f.h) * side); m.rotation.set(-Math.PI / 2, 0, f.h); m.scale.set(0.8, 1.4, 1);
    m.scale.multiplyScalar(Math.max(0.3, 1 - f.age / 20)); m.updateMatrix(); prints.setMatrixAt(i, m.matrix);
  });
  prints.count = list.length; prints.instanceMatrix.needsUpdate = true;
}
// Traps only ever reach a mummy's view.
const traps = [];
function syncTraps() {
  const list = view.phase === 'playing' ? view.traps || [] : [];
  while (traps.length > list.length) traps.pop().removeFromParent();
  while (traps.length < list.length) { const t = vineSnare(); scene.add(t); traps.push(t); }
  list.forEach((t, i) => traps[i].position.set(t.x, groundAt(t.x, t.z) + 0.01, t.z));
}
// The guardian of ¡Un, dos, tres, momia! stands at the edge of the fogata.
const guardian = guardianModel(); guardian.position.set(0, 0, -8.6); guardian.visible = false; scene.add(guardian);
function syncActors() {
  for (const [seat, a] of actors) if (!rosterOf(seat)) { removeActor(a); actors.delete(seat); }
  const seen = new Set(view.players.map(p => p.seat));
  const ended = view.phase === 'ended';
  for (const [i, raw] of view.players.entries()) {
    const ring = SEATS[i % SEATS.length], p = ended ? { seat: raw.seat, x: ring.x * 1.3, z: ring.z * 1.3, h: ring.h, moving: false } : raw;
    const a = actorFor(p.seat); if (!a) continue;
    if (!a.seen) a.root.position.set(p.x, groundAt(p.x, p.z), p.z);
    a.seen = true; a.target = p;
    ghostly(a, !!p.ghost);
    a.hiddenNow = !!p.prop || !!p.hidden;
  }
  for (const a of actors.values()) if (!seen.has(a.seat)) { a.seen = false; a.root.visible = false; }
}

// ---------- view ----------
// Endings. Sunrise: the relic blazes and the mummies' bandages fall off.
// Endless night: the panas end up wrapped and the guardian keeps watch.
const DAY = { sky: new THREE.Color(0xe9a46a), night: new THREE.Color(0x0b0d22), void: new THREE.Color(0x04030c) };
const endingWraps = [];
function startEnding() {
  clearEnding();
  const panas = view.ending.winner === 'panas';
  for (const r of view.roster) {
    const a = actors.get(r.seat); if (!a || r.spectator || (panas ? r.role !== 'momia' : r.role === 'momia')) continue;
    const box = new THREE.Box3().setFromObject(a.character.group), size = box.getSize(new THREE.Vector3());
    const wrap = bandageWrap({ height: size.y * 0.98, radius: Math.max(size.x, size.z) * 0.5 });
    a.root.add(wrap); endingWraps.push({ wrap, falling: panas });
    if (!panas) wrap.scale.y = 0.01;
  }
  shout(panas ? '¡Amaneció!' : 'La noche no termina', { tone: panas ? 'yellow' : 'coral' });
  sound.tone(panas ? 523 : 110, 0, 0.5, 'triangle', 0.08); sound.tone(panas ? 784 : 82, 0.4, 0.9, 'triangle', 0.07);
}
function clearEnding() { while (endingWraps.length) endingWraps.pop().wrap.removeFromParent(); }
function mood(dt) {
  const end = view?.phase === 'ended' && view.ending, dawn = end?.winner === 'panas', gloom = end && !dawn;
  scene.background.lerp(dawn ? DAY.sky : gloom ? DAY.void : DAY.night, Math.min(1, dt * 0.8));
  scene.fog.color.copy(scene.background); scene.fog.density = THREE.MathUtils.damp(scene.fog.density, dawn ? 0.006 : 0.018, 1, dt);
  moon.intensity = THREE.MathUtils.damp(moon.intensity, dawn ? 2.6 : gloom ? 0.4 : 0.9, 1, dt);
  for (const e of endingWraps) {
    if (e.falling) { e.wrap.position.y = Math.max(-1.6, e.wrap.position.y - dt * 0.5); e.wrap.scale.y = Math.max(0.05, e.wrap.scale.y - dt * 0.25); }
    else e.wrap.scale.y = Math.min(1, e.wrap.scale.y + dt * 0.5);
  }
}

// Night jungle: crickets and the odd frog, and a heartbeat when a mummy is close.
let nextChirp = 0, nextBeat = 0;
function ambience() {
  if (view?.phase !== 'playing' || paused) return;
  if (elapsed > nextChirp) {
    nextChirp = elapsed + 0.4 + Math.random() * 1.6;
    if (Math.random() < 0.7) { const f = 3900 + Math.random() * 700; sound.tone(f, 0, 0.035, 'sine', 0.006); sound.tone(f * 1.04, 0.07, 0.035, 'sine', 0.006); }
    else sound.tone(260 + Math.random() * 80, 0, 0.12, 'triangle', 0.012);
  }
  const hb = me()?.heartbeat || 0;
  if (hb > 0 && elapsed > nextBeat) {
    nextBeat = elapsed + THREE.MathUtils.lerp(1.1, 0.42, hb);
    sound.tone(58, 0, 0.11, 'sine', 0.05 + hb * 0.12); sound.tone(52, 0.16, 0.11, 'sine', 0.04 + hb * 0.1);
  }
}

function receive(v) {
  view = v;
  if (phase !== v.phase) enterPhase(v.phase);
  syncActors(); syncStatues(); syncProps(); syncPrints(); syncTraps();
  for (const e of v.events) handleEvent(e);
  updateHud();
  if (v.phase === 'meeting') meeting.render(v);
  overlays();
}
function enterPhase(next) {
  const was = phase; phase = next;
  menu.close(); clearInput();
  document.body.classList.toggle('playing', next === 'playing');
  if (next !== 'playing') closeTask(false);
  if (next === 'reveal') showReveal();
  if (next === 'ended') { endedAt = performance.now(); syncActors(); startEnding(); setTimeout(updateLobby, 4300); } else clearEnding();
  if (was === 'meeting') dock();
  if (next === 'playing' && was === 'reveal') { const p = me(); if (p) cameraTarget.set(p.x ?? 0, 0, p.z ?? 0); }
  if (next === 'playing') setTimeout(minimap, 0);
  updateLobby();
}
function handleEvent(e) {
  if (e.kind === 'task') {
    if (openPanel) closeTask(false);
    if (e.complete) { sound.tone(660, 0, 0.12, 'sine', 0.07); sound.tone(990, 0.1, 0.16, 'sine', 0.06); notify(e.fake ? 'Fingiste la tarea. Nadie lo notó… ¿o sí?' : '¡Tarea lista!'); }
    else if (e.fake) notify('Fingiste la tarea. Nadie lo notó… ¿o sí?');
    else notify('Primera parte lista. Sigue con la segunda.');
  }
  if (e.kind === 'visual') sound.tone(520, 0, 0.3, 'triangle', 0.05);
  if (e.kind === 'alarm') { horn(); shout(SABOTAGES[e.sabotage].name, { tone: 'coral' }); }
  if (e.kind === 'fixed') {
    notify(`${SABOTAGES[e.sabotage].name}: ¡arreglado!`);
    sound.tone(660, 0, 0.15, 'sine', 0.07); sound.tone(880, 0.12, 0.2, 'sine', 0.06);
    const mine = myPose();
    if (mine) shockwaves.ring(mine.x, groundAt(mine.x, mine.z) + 0.08, mine.z, { color: 0x2ad1b2, maxRadius: 4.5, duration: 0.45 });
  }
  if (e.kind === 'sabotaged' && e.sabotage === 'bejuco') notify('Trampa puesta. Solo las momias la ven.');
  if (e.kind === 'look') { shout('¡Momia!', { tone: 'coral' }); sound.tone(98, 0, 0.5, 'square', 0.06); }
  if (e.kind === 'frozen') notify('¡Te moviste! El guardián te congeló un momento.');
  if (e.kind === 'snared') { sound.tone(140, 0, 0.3, 'triangle', 0.06); notify(e.seat === me().seat ? '¡Un bejuco te agarró el pie!' : `Un bejuco agarró a ${nameOf(e.seat)}.`); }
  if (e.kind === 'shake') { world.shake(e.spot); sound.tone(90, 0, 0.18, 'triangle', 0.04); }
  if (e.kind === 'kicked') notify(`Ya no cabes en ${hideById(e.spot)?.name.toLowerCase() || 'el escondite'}. ¡A moverse!`);
  if (e.kind === 'wrap') {
    const mine = me().seat, by = nameOf(e.by), who = nameOf(e.seat);
    if (e.seat === mine) { shout('¡Te envolvieron!', { tone: 'coral' }); notify(`${by} te envolvió. Ahora eres una momiita: sigue haciendo tareas.`); }
    else if (e.by === mine) notify(`Envolviste a ${who}. Aléjate antes de que alguien llegue.`);
    else if (view.partners.includes(e.by)) notify(`Tu compinche envolvió a ${who}.`);
    else { shout('¡Lo viste todo!', { tone: 'coral' }); notify(`¡${by} envolvió a ${who}! Repórtalo.`); }
    sound.tone(110, 0, 0.5, 'sawtooth', 0.05);
  }
  if (e.kind === 'meeting') { horn(); shout(e.body != null ? '¡Estatua de vendas!' : '¡Reunión!', { tone: 'coral' }); }
  if (e.kind === 'vote') { shout('¡A votar!', { tone: 'yellow' }); sound.tone(440, 0, 0.15, 'square', 0.05); }
  if (e.kind === 'eject') sound.tone(196, 0, 0.9, 'triangle', 0.06);
  if (e.kind === 'morning') notify('La noche sigue. Cuidado con quedarte solo.');
  if (e.kind === 'night') shout('¡Cayó la noche!', { tone: 'yellow' });
  if (e.kind === 'left') notify(`${e.name} se fue del campamento${e.role === 'momia' ? ': era una momia.' : '.'}`);
  if (e.kind === 'end') sound.tone(e.winner === 'panas' ? 660 : 160, 0, 0.6, 'triangle', 0.08);
}
function showReveal() {
  const role = me()?.role, mummy = role === 'momia';
  $('reveal').classList.toggle('is-mummy', mummy);
  $('reveal-title').textContent = mummy ? 'Una momia' : 'Un pana';
  const partners = view.partners.map(s => rosterOf(s)?.name).filter(Boolean);
  $('reveal-copy').textContent = mummy
    ? `Tienes vendas debajo de la camisa. Finge las tareas, envuelve a los panas cuando estén solos y que nadie lo sepa.${partners.length ? ` Tu compinche: ${partners.join(', ')}.` : ''}`
    : 'Mantén el campamento funcionando hasta que amanezca. Si ves algo raro, llama a una reunión en la fogata.';
  sound.tone(mummy ? 140 : 520, 0, 0.5, 'triangle', 0.08);
}

function updateLobby() {
  const inLobby = !view || view.phase === 'lobby' || lobby.phase === 'lobby';
  show('lobby', inLobby); show('loading', false); show('story', inLobby);
  show('reveal', view?.phase === 'reveal'); show('hud', !!view && ['playing'].includes(view.phase));
  overlays();
  show('results', view?.phase === 'ended' && performance.now() - endedAt > 4200);
  const connected = !!net?.connected, host = lobby.isHost;
  const count = lobby.players.length, filled = lobby.bots ? Math.max(6, count) : count;
  $('start').disabled = !connected || !host || (!lobby.bots && count < MIN_PLAYERS && !quick);
  $('start').textContent = !connected ? 'Conectando…' : !host ? 'El anfitrión prende la fogata' : !lobby.bots && count < MIN_PLAYERS ? `Faltan panas (mínimo ${MIN_PLAYERS})` : '¡Que caiga la noche!';
  $('stat-mummies').textContent = mummyCount(Math.min(8, filled));
  roomOptions.update({ ...defaultEmbusteOptions(), ...lobby }, !!host && inLobby);
  if (!inLobby && roomOptions.isOpen) roomOptions.close();
  $('practice').textContent = net && !net.online ? 'Volver a la sala online' : 'Practicar con bots en este navegador';
  const key = lobby.players.map(p => `${p.seat}:${p.name}:${p.host}`).join('|');
  if (key !== rosterKey) {
    rosterKey = key;
    $('lobby-team').replaceChildren(...lobby.players.map((p, i) => {
      const chip = document.createElement('span'), dot = document.createElement('i'); chip.className = 'pk-chip'; dot.className = 'pk-dot'; dot.style.background = colors[i % colors.length];
      chip.append(dot, document.createTextNode(`${p.name}${p.me ? ' · tú' : ''}${p.host ? ' · anfitrión' : ''}`)); return chip;
    }));
  }
  $('again').disabled = $('to-lobby').disabled = !host;
  $('again').textContent = host ? 'Otra noche' : 'Esperando al anfitrión…';
}

// The meeting card while they talk and vote; the verdict over the river after.
function overlays() {
  const stage = view?.phase === 'meeting' ? view.meeting?.stage : null;
  show('meeting', !!stage && stage !== 'eject'); show('eject', stage === 'eject');
  if (stage === 'eject') { const v = meeting.verdict(view); if (v) { $('eject-title').textContent = v.title; $('eject-copy').textContent = v.copy; } }
}
const myPose = () => view?.players.find(q => q.seat === view.me.seat);
let tasksKey = '';
function updateHud() {
  const p = me(); if (!p) return;
  const mine = myPose();
  if (mine) $('zone').textContent = zoneAt(mine).name;
  if (view.phase === 'ended') showResults();
  if (view.phase !== 'playing') { closeTask(false); return; }
  const mummy = p.role === 'momia';
  $('objective').textContent = p.ghost ? 'Sigue ayudando, momiita' : mummy ? 'Finge que trabajas' : 'Mantén la reliquia encendida';
  const key = p.tasks.map(t => `${t.id}:${t.step}:${mine && !t.done && distance(mine, stationById(t.station)) < REACH + 1 ? 1 : 0}`).join('|');
  if (key !== tasksKey) {
    tasksKey = key;
    $('task-list').replaceChildren(...p.tasks.map(t => {
      const li = document.createElement('li'), s = stationById(t.station), near = mine && !t.done && distance(mine, s) < REACH + 1;
      li.className = t.done ? 'is-done' : near ? 'is-near' : '';
      li.append(document.createTextNode(t.steps > 1 && !t.done ? `${t.name} (${t.step + 1}/${t.steps})` : t.name));
      const where = document.createElement('small'); where.textContent = zoneById(s.zone).name.replace(/^(La|El|Los|Las) /, ''); li.append(where);
      return li;
    }));
    mapStations = new Set(p.tasks.filter(t => !t.done).map(t => t.station));
    world.mark(mapStations);
  }
  setBar($('dawn-bar'), view.bar.total ? view.bar.done / view.bar.total : 0);
  alarm(p);
  $('task-list').parentElement.classList.toggle('is-jammed', !!view.world.jammed);
  const use = useTarget();
  $('use').disabled = !use || use.wait; $('use-label').textContent = use?.label || 'Usar';
  document.body.classList.toggle('ghost', !!p.ghost); document.body.classList.toggle('mummy', mummy && !p.ghost);
  show('ghost-note', !!p.ghost);
  for (const id of ['wrap', 'sabotage', 'disguise']) show(id, mummy && !p.ghost);
  $('report').disabled = !statueInReach() || !!view.world.jammed; show('report', !p.ghost);
  $('sabotage').disabled = p.sabCooldown > 0 && !view.sabotage;
  $('sabotage').style.setProperty('--cool', String(mummy ? Math.min(1, (p.sabCooldown || 0) / 30) : 0));
  if (!mummy || p.ghost) show('sabotage-menu', false); else if (!$('sabotage-menu').classList.contains('hidden')) sabotageMenu();
  $('wrap').disabled = !wrapInReach();
  show('vent', mummy && p.hidden?.kind === 'vent');
  $('disguise').disabled = !p.disguise && (!p.disguises || !!p.hidden);
  $('disguise-label').textContent = p.disguise ? 'Quitar disfraz' : `Disfraz ×${p.disguises ?? 0}`;
  if (p.disguise || !mummy) show('disguise-menu', false);
  const hidden = p.hidden && (p.hidden.kind === 'vent' ? ventById(p.hidden.id) : hideById(p.hidden.id));
  show('hidden-note', !!hidden || !!p.disguise);
  if (hidden) { $('hidden-title').textContent = p.hidden.kind === 'vent' ? 'Dentro del tronco' : 'Escondido'; $('hidden-copy').textContent = p.hidden.kind === 'vent' ? `${hidden.name}. Cruza al otro lado o sal con E.` : `${hidden.name} · te sacan en ${Math.ceil(p.hidden.t)} s`; }
  else if (p.disguise) { $('hidden-title').textContent = `Eres ${propDefinition(p.disguise.prop)?.label.toLowerCase()}`; $('hidden-copy').textContent = `No te muevas: ${Math.ceil(p.disguise.t)} s de disfraz.`; }
  $('wrap').style.setProperty('--cool', String(mummy ? Math.min(1, (p.cooldown || 0) / 25) : 0));
  if (openPanel && !p.task && performance.now() - openPanel.opened > 1500) closeTask(false);
}

// What E does here, nearest first: your task, (later) hiding, vents, the bell.
function useTarget() {
  const p = me(), mine = myPose(); if (!p || !mine || openPanel) return null;
  if (p.hidden?.kind === 'hide') return { label: 'Salir del escondite', run: () => net.act('hide') };
  if (view.sabotage && !p.ghost && !p.hidden && (FIXES[view.sabotage.kind] || []).some(f => distance(mine, f) <= f.r)) return { label: 'Mantén E: arreglar', hold: true };
  if (p.hidden?.kind === 'vent') return { label: 'Salir del tronco', run: () => net.act('vent') };
  if (p.disguise) return null;
  const t = p.tasks.filter(t => !t.done).map(t => ({ t, s: stationById(t.station) })).filter(({ s }) => distance(mine, s) <= REACH)
    .sort((a, b) => distance(mine, a.s) - distance(mine, b.s))[0];
  if (t) return { label: t.t.name, run: () => startTask(t.t) };
  const log = p.role === 'momia' && !p.ghost && VENTS.find(v => distance(mine, v) <= VENT_RANGE);
  if (log) return { label: `Meterse: ${log.name.toLowerCase()}`, run: () => net.act('vent') };
  const spot = !p.ghost && HIDES.find(h => distance(mine, h) <= HIDE_RANGE);
  if (spot) return p.hideCooldown > 0 ? { label: `Esconderse en ${Math.ceil(p.hideCooldown)} s`, wait: true } : { label: `Esconderse: ${spot.name.toLowerCase()}`, run: () => net.act('hide') };
  if (!p.ghost && p.emergencies > 0 && distance(mine, BELL) <= BELL_RANGE) {
    return p.bellIn > 0 ? { label: `Campana en ${Math.ceil(p.bellIn)} s`, wait: true } : { label: 'Tocar la campana', run: () => net.act('bell') };
  }
  return null;
}
const statueInReach = () => { const mine = myPose(); return !me()?.ghost && mine && view.statues.find(s => distance(mine, s) <= REPORT_RANGE); };
// Client-side guess at a wrap target; the room decides.
function wrapInReach() {
  const p = me(), mine = myPose();
  if (!mine || p.role !== 'momia' || p.ghost || p.cooldown > 0) return null;
  return view.players.find(q => q.seat !== p.seat && !q.ghost && !q.prop && !view.partners.includes(q.seat) && distance(mine, q) <= WRAP_RANGE);
}
const doWrap = () => { if (wrapInReach()) net.act('wrap'); };
// The alarm card: what broke, how to fix it, and the fix (or flood) meter.
function alarm(p) {
  const sab = view.sabotage, def = sab && SABOTAGES[sab.kind];
  show('alarm', !!def); document.body.classList.toggle('alarmed', !!def);
  if (!def) return;
  const looking = view.world.guardian === 'look';
  $('alarm-title').textContent = def.name;
  $('alarm-copy').textContent = sab.kind === 'momia' ? (looking ? '¡El guardián está mirando! No te muevas.' : p.role === 'momia' && sab.next != null ? `Gira en ${Math.ceil(sab.next)} s. Tú sí puedes moverte.` : 'Un, dos, tres… ¡atento!')
    : def.critical ? `${def.hint} Quedan ${Math.ceil(sab.t)} s.` : def.hint;
  setBar($('alarm-bar'), sab.kind === 'momia' ? (looking ? 1 : 0) : sab.progress);
}
// Built once; each view only refreshes what can be picked (a rebuilt button can't be clicked).
function sabotageMenu() {
  const p = me(), busy = !!view.sabotage, menuNode = $('sabotage-menu');
  if (!menuNode.children.length) menuNode.replaceChildren(...Object.entries(SABOTAGES).map(([kind, def]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pk-btn pk-btn--sm'; b.dataset.kind = kind;
    b.append(document.createTextNode(def.name), document.createElement('small'));
    b.onclick = () => { net.act('sabotage', { kind }); show('sabotage-menu', false); }; return b;
  }));
  for (const b of menuNode.children) {
    const kind = b.dataset.kind, def = SABOTAGES[kind];
    b.disabled = p.sabCooldown > 0 || (kind !== 'bejuco' && busy) || (kind === 'bejuco' && p.ghost);
    const note = p.sabCooldown > 0 ? `${Math.ceil(p.sabCooldown)} s` : def.critical ? 'crítico' : '';
    if (b.lastChild.textContent !== note) b.lastChild.textContent = note;
  }
}
function toggleSabotage() {
  const p = me(); if (!p || p.role !== 'momia' || p.ghost) return;
  const open = $('sabotage-menu').classList.contains('hidden');
  if (open) { sabotageMenu(); show('disguise-menu', false); }
  show('sabotage-menu', open);
}
const crossVent = () => { if (me()?.hidden?.kind === 'vent') net.act('vent', { move: true }); };
function doDisguise() {
  const p = me(); if (!p || p.role !== 'momia' || p.ghost) return;
  if (p.disguise) { net.act('disguise'); return; }
  if (p.disguises > 0) show('disguise-menu', $('disguise-menu').classList.contains('hidden'));
}
$('disguise-menu').replaceChildren(...DISGUISES.map((prop, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pk-btn pk-btn--sm';
  b.append(document.createTextNode(propDefinition(prop).label)); const k = document.createElement('small'); k.textContent = String(i + 1); b.append(k);
  b.onclick = () => { net.act('disguise', { prop }); show('disguise-menu', false); }; return b;
}));
const doReport = () => { if (statueInReach()) net.act('report'); };
function horn() { sound.tone(196, 0, 0.35, 'sawtooth', 0.06); sound.tone(147, 0.32, 0.6, 'sawtooth', 0.06); }

// ---------- the task panel ----------
let openPanel = null;
function startTask(t) {
  if (openPanel) return;
  net.act('task', { station: t.station });
  const s = stationById(t.station), def = taskById(t.id);
  $('task-title').textContent = def.name; $('task-where').textContent = zoneById(s.zone).name;
  $('task-hint').textContent = HINTS[t.id] || '';
  show('task', true); clearInput();
  const panel = { station: t.station, opened: performance.now(), sent: 0 };
  panel.dispose = openTask(t.id, $('task-body'), { step: t.step, done: () => finishTask(panel) });
  openPanel = panel;
}
function finishTask(panel) {
  if (openPanel !== panel) return;
  panel.finished = true;
  // The room only accepts a chore after its least time; keep asking until it closes.
  const send = () => { if (openPanel !== panel) return; net.act('done', { station: panel.station }); panel.retry = setTimeout(send, 350); };
  send();
}
function closeTask(cancel = true) {
  if (!openPanel) return;
  if (cancel && !openPanel.finished) net.act('cancel');
  clearTimeout(openPanel.retry); openPanel.dispose(); openPanel = null; show('task', false);
}
$('task-close').onclick = () => closeTask(true);

function showResults() {
  const e = view.ending; if (!e) return;
  const panas = e.winner === 'panas', mine = me()?.role === (panas ? 'pana' : 'momia');
  $('result-eyebrow').textContent = panas ? 'Amaneció' : 'La noche no termina';
  $('result-title').textContent = mine ? '¡Ganaste!' : panas ? 'Ganaron los panas' : 'Ganaron las momias';
  $('result-copy').textContent = {
    tasks: 'La reliquia brilló, salió el sol y las momias volvieron a ser panas (un poco avergonzados).',
    votes: 'Mandaron a todas las momias río abajo en la curiara. El bote llega al amanecer.',
    numbers: 'Ya no quedan suficientes panas para mantener la reliquia encendida.',
    flood: 'Nadie cerró la represa a tiempo y el río se llevó el campamento.',
  }[e.reason] || '';
  $('result-roster').replaceChildren(...view.roster.filter(r => !r.spectator).map(r => {
    const li = document.createElement('li'); li.className = `pk-row${r.seat === me().seat ? ' is-me' : ''}${r.role === 'momia' ? ' is-mummy' : ''}`;
    const nameNode = document.createElement('span'); nameNode.className = 'pk-row-name'; nameNode.textContent = r.name;
    const end = document.createElement('b'); end.className = 'pk-row-end'; end.textContent = r.role === 'momia' ? 'Momia' : 'Pana';
    li.append(nameNode, end); return li;
  }));
}

// ---------- input ----------
function input() {
  if (paused || openPanel || view?.phase !== 'playing') return { x: 0, z: 0, hold: false };
  const x = +(keys.has('d') || keys.has('arrowright') || touch.has('right')) - +(keys.has('a') || keys.has('arrowleft') || touch.has('left'));
  const z = +(keys.has('s') || keys.has('arrowdown') || touch.has('down')) - +(keys.has('w') || keys.has('arrowup') || touch.has('up'));
  return { x, z, hold: keys.has('e') || touch.has('use') };
}
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || paused) return;
  const key = e.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) e.preventDefault();
  keys.add(key); if (e.repeat) return;
  if (key === 'm') toggleMute();
  if (key === 'e' && !openPanel) useTarget()?.run?.();
  if (key === 'q' && !openPanel) doWrap();
  if (key === 'v' && !openPanel) crossVent();
  if (key === 'c' && !openPanel) doDisguise();
  if (key === 'f' && !openPanel) toggleSabotage();
  if (!$('disguise-menu').classList.contains('hidden') && /^[1-4]$/.test(key)) { net.act('disguise', { prop: DISGUISES[Number(key) - 1] }); show('disguise-menu', false); }
  if (key === 'r' && !openPanel) doReport();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase())); addEventListener('blur', clearInput); document.addEventListener('visibilitychange', clearInput);
for (const button of document.querySelectorAll('[data-move]')) holdButton(button, { paused: () => paused, down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) });

holdButton($('use'), { paused: () => paused, down: () => { touch.add('use'); if (!openPanel) useTarget()?.run?.(); }, up: () => touch.delete('use') });
$('wrap').onclick = doWrap; $('report').onclick = doReport; $('vent').onclick = crossVent; $('sabotage').onclick = toggleSabotage; $('disguise').onclick = doDisguise;
$('start').onclick = () => net?.start();
$('again').onclick = () => net?.start();
$('to-lobby').onclick = () => net?.toLobby();
$('practice').onclick = () => (net && !net.online ? (net.leave(), view = null, goOnline()) : practice());
$('offline-inline').onclick = () => practice();

// ---------- frame ----------
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const ticker = setInterval(() => { if (net?.connected && view && view.phase !== 'lobby') net.input(input()); }, 50);

function frame(now) {
  if (dead) return;
  const dt = Math.min(0.06, (now - last) / 1000); last = now; elapsed += dt;
  for (const a of actors.values()) {
    const p = a.target; if (!a.seen || !p) continue;
    a.root.visible = !a.hiddenNow;
    temp.set(p.x, p.ghost ? 0.6 + Math.sin(elapsed * 2 + a.seat) * 0.15 : groundAt(p.x, p.z), p.z); if (a.root.position.distanceTo(temp) > 6) a.root.position.copy(temp); else a.root.position.lerp(temp, Math.min(1, dt * 14));
    const diff = Math.atan2(Math.sin(p.h - a.character.group.rotation.y), Math.cos(p.h - a.character.group.rotation.y)); a.character.group.rotation.y += diff * Math.min(1, dt * 12);
    a.character.update(dt, { walk: p.moving ? 1 : 0, dizzy: !!(a.seat === me()?.seat && (me().frozen || me().stuck)) });
  }
  const mine = view && actors.get(me()?.seat);
  if (!view || view.phase === 'lobby') {
    const a = elapsed * 0.08; camera.position.set(Math.sin(a) * 26, 17, Math.cos(a) * 26); camera.lookAt(0, 0, 0);
  } else if (view.phase === 'ended') {
    const a = elapsed * 0.12; camera.position.set(Math.sin(a) * 12, 6.5, Math.cos(a) * 12); camera.lookAt(0, 1, 0);
  } else if (view.phase === 'meeting' && view.meeting?.stage === 'eject' && view.meeting.result) {
    river(dt);
  } else if (view.phase === 'meeting') {
    camera.position.lerp(temp.set(0, 13, 12), Math.min(1, dt * 3)); camera.lookAt(0, 0.5, 0);
  } else if (view.phase === 'reveal' && mine) {
    temp.copy(mine.root.position); camera.position.lerp(temp.clone().add(new THREE.Vector3(0, 2.4, 5.2)), Math.min(1, dt * 3)); camera.lookAt(temp.x, 1.2, temp.z);
  } else if (mine) {
    temp.copy(mine.root.position); cameraTarget.lerp(temp, Math.min(1, dt * 8));
    // Portrait phones see less across, so the camera backs off.
    const far = camera.aspect < 0.8 ? 1.55 : 1;
    camera.position.set(cameraTarget.x, 16 * far, cameraTarget.z + 11 * far); camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
  }
  if (view?.meeting?.stage !== 'eject') lantern.intensity = 30;
  if (mine && view?.meeting?.stage !== 'eject') lantern.position.set(mine.root.position.x + 0.8, 4.2, mine.root.position.z + 1.2);
  darkness(mine);
  const w = view?.world || {};
  guardian.visible = (!!w.guardian && view.phase === 'playing') || (view?.phase === 'ended' && view.ending?.winner === 'momias');
  if (guardian.visible) { guardian.rotation.y = THREE.MathUtils.damp(guardian.rotation.y, w.guardian === 'look' ? 0 : Math.PI, 8, dt); guardian.userData.animate(elapsed, false, w.guardian === 'look'); }
  fireLight.intensity = THREE.MathUtils.damp(fireLight.intensity, w.lightsOut ? 12 : 90, 3, dt);
  mood(dt); ambience();
  shockwaves.update(dt);
  if (mine && view?.phase === 'playing' && useTarget()?.hold && input().hold && view.sabotage && view.sabotage.kind !== 'momia') {
    const prog = Math.max(0.05, view.sabotage.progress || 0);
    chargeRing.set(mine.root.position.x, groundAt(mine.root.position.x, mine.root.position.z), mine.root.position.z, prog);
    const step = Math.floor(prog * 8);
    if (step > lastFixStep) { lastFixStep = step; sound.tick(step); }
  } else {
    chargeRing.hide();
    lastFixStep = -1;
  }
  world.update(elapsed, view, dt); if (!noRender) renderer.render(scene, camera);
  uiClock += dt; if (uiClock > 0.1 && view?.phase === 'playing') { uiClock = 0; minimap(); }
  requestAnimationFrame(frame);
}
// The curiara carries whoever was voted out down the river.
let rider = null;
function river(dt) {
  const r = view.meeting.result, t = 1 - view.meeting.t / Math.max(0.1, (view.meeting.total || 6));
  if (rider?.seat !== r.ejected) {
    if (rider) { rider.character.dispose(); rider.character.group.removeFromParent(); rider = null; }
    const who = r.ejected != null && rosterOf(r.ejected);
    if (who) { const character = buildCharacter(who.avatar, { seated: true }); character.group.position.set(0, 0.62, -0.4); character.group.rotation.y = 0; world.canoe.add(character.group); rider = { seat: r.ejected, character }; }
  }
  rider?.character.update(dt, {});
  world.canoe.position.x = THREE.MathUtils.lerp(world.canoe.position.x, r.ejected != null ? 22 - Math.min(1, Math.max(0, t)) * 42 : 23, Math.min(1, dt * 2));
  camera.position.lerp(temp.set(world.canoe.position.x + 4, 6, 50), Math.min(1, dt * 2.5)); camera.lookAt(world.canoe.position.x, 0, 37);
  lantern.position.set(world.canoe.position.x, 7, 37); lantern.intensity = 55;
}
function dock() {
  if (rider) { rider.character.dispose(); rider.character.group.removeFromParent(); rider = null; }
  world.canoe.position.x = 23;
}

// Minimap: the zones, your task stations and you (others only if your view has them).
const mapCtx = $('minimap').getContext('2d');
const MAP_W = 174, MAP_H = 196, mapScale = Math.min((MAP_W - 8) / (BOUNDS.maxX - BOUNDS.minX), (MAP_H - 8) / (BOUNDS.maxZ - BOUNDS.minZ));
const mx = x => 4 + (x - BOUNDS.minX) * mapScale, mz = z => 4 + (z - BOUNDS.minZ) * mapScale;
function minimap() {
  const c = mapCtx; c.clearRect(0, 0, MAP_W, MAP_H);
  for (const z of ZONES) { c.fillStyle = z.lit ? '#6b4a33' : z.path ? '#2d2650' : '#3b3270'; c.fillRect(mx(z.x - z.w / 2), mz(z.z - z.d / 2), z.w * mapScale, z.d * mapScale); }
  if (view.world?.bridgeCut) { c.fillStyle = '#ff4b4b'; c.fillRect(mx(-20), mz(-3), 6 * mapScale, 6 * mapScale); }
  for (const id of mapStations) { const s = STATIONS.find(q => q.id === id); if (!s) continue; c.fillStyle = '#ffc629'; c.beginPath(); c.arc(mx(s.x), mz(s.z), 3, 0, Math.PI * 2); c.fill(); }
  for (const p of view.players) {
    const mine = p.seat === me()?.seat; c.fillStyle = mine ? '#ffffff' : view.partners.includes(p.seat) ? '#9fe0c8' : colorOf(p.seat);
    c.globalAlpha = p.ghost && !mine ? 0.5 : 1; c.beginPath(); c.arc(mx(p.x), mz(p.z), mine ? 3.6 : 2.6, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
  }
}
let mapStations = new Set();

// The lantern circle on screen: an ellipse around your pana, sized by your vision.
function darkness(mine) {
  const dark = $('dark'), p = me();
  document.body.classList.toggle('ghost', !!p?.ghost);
  if (!mine || !p || !p.vision) return;
  const center = mine.root.position.clone().project(camera), side = mine.root.position.clone().add(new THREE.Vector3(p.vision, 0, 0)).project(camera), depth = mine.root.position.clone().add(new THREE.Vector3(0, 0, -p.vision)).project(camera);
  const w = innerWidth / 2, h = innerHeight / 2;
  dark.style.setProperty('--fx', `${(center.x + 1) * w}px`); dark.style.setProperty('--fy', `${(1 - center.y) * h}px`);
  dark.style.setProperty('--rx', `${Math.abs(side.x - center.x) * w}px`); dark.style.setProperty('--ry', `${Math.abs(depth.y - center.y) * h}px`);
}

if (qs.has('practice')) practice(); else goOnline();
requestAnimationFrame(frame);
addEventListener('pagehide', () => {
  dead = true; clearInterval(ticker); notify.dispose(); net?.leave(); menu.dispose?.(); unbind?.();
  actors.forEach(removeActor); shockwaves.dispose(); chargeRing.dispose(); world.dispose(); renderer.dispose();
});
if (qs.has('debug')) window.embuste = { scene, camera, renderer, actors, world, menu, input,
  debug: (m) => net?.debug?.(m),
  use: () => useTarget()?.run(), solve: () => openPanel && finishTask(openPanel), get panel() { return openPanel; },
  get net() { return net; }, get view() { return view; }, get lobby() { return lobby; } };

await prepareScene({ renderer, scene, camera });
