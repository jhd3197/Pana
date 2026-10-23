// Wiring only: input → rules (through the room) → river scene and HUD.
import * as THREE from 'three';
import { createRoomOptions } from '/engine/room-options.js';
import { prepareScene } from '/engine/game-load.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound, pulseSpeedLines, setSpeedLines } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton } from '/engine/touch.js';
import { bindRenderer, pixelRatio } from '/engine/settings.js';
import { createMusic } from '/engine/music.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { createLancha } from '/engine/models/vehicles/lancha.js';
import { createRaceScene, createRiverWorld } from '/engine/river/scene.js';
import { addLandscape } from '/engine/river/landscape.js';
import { createRiverFX } from '/engine/river/water-fx.js';
import { createRiverGuide } from '/engine/river/guide.js';
import { createRiverMinimap } from '/engine/river/minimap.js';
import { angle, formatTime } from '/engine/river/river.js';
import { FIELDS, cleanOptions } from './options.js';
import { RIVER as DEFAULT_RIVER, courseRiver } from './course.js';
import { standings, COLORS, TURBO, SLOTS } from './rules.js';
import { LanchaRoom } from './network.js';
import { createToast } from '/engine/hud.js';

let RIVER = DEFAULT_RIVER;
const $ = id => document.getElementById(id), params = new URLSearchParams(location.search), avatar = loadAvatar(), name = loadName();
const showNotice = createToast($('notice'), { ms: 3000 });
const code = roomFromUrl() || newRoomCode(); params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const keys = new Set(), touch = new Set(), boats3d = new Map(), touchButtons = [], local = { turbo: 0 };
let paused = false, quiet = false, state, world, ready = false, lastPhase = '', lastCountdown = '', lastRace = 0, drawClock = 0, disposed = false, snapshotAt = performance.now();
const room = new LanchaRoom({ code, name, avatar, onState: s => { state = s; snapshotAt = performance.now(); },
  onNotice: text => showNotice(text),
  onStatus: (message, error = false) => { $('connection').textContent = message; $('practice').classList.toggle('hidden', !error); if (error) showNotice(message); } });
state = room.state;
const roomOptions = createRoomOptions($('room-options'), { title: 'Lancha', fields: FIELDS, change: patch => room.action('options', { options: patch }), reset: () => room.action('options', { options: cleanOptions() }) });
function clearInput() { keys.clear(); for (const b of touchButtons) b.release(); touch.clear(); }
const menu = createGameMenu({ pad: { move: 'wasd', keys: { rt: ['KeyW', 'Acelerar'], a: ['KeyW', 'Acelerar'], lt: ['KeyS', 'Frenar o retroceder'], b: ['KeyS', 'Frenar o retroceder'], x: ['Space', 'Turbo'], rb: ['Space', 'Turbo'] } }, title: 'Lancha', sound, orientation: 'libre', note: () => room.members.size > 1 ? 'La carrera sigue mientras abres el menú.' : 'La carrera está en pausa.',
  controls: [['W / ↑ sostenido', 'Acelerar'], ['A D / ← →', 'Girar el motor'], ['S / ↓', 'Frenar; sostenido, retroceder'], ['Espacio', 'Turbo (gasta media barra)'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: ['Sostén W todo el tiempo: machacarlo hace que la lancha vaya más lenta.', 'Sigue las flechas doradas en el agua: marcan el chorro, el carril rápido del raudal y esquivan los caimanes.', 'En el Orinoco las boyas marcan el canal: coral a la izquierda, verde a la derecha.', 'El chorro, los saltos derechos y la estela de las toninas llenan el turbo.', 'Cae derecho de los raudales o se te ahoga el motor.'],
  invite: () => inviteUrl(code), actions: [{ id: 'local-race', label: 'Abrir carrera local', run: () => goLocal() }],
  onOpen() { paused = true; clearInput(); if (room.members.size <= 1) music.pause(); }, onClose() { paused = false; music.resume(); } });
const navButton = 'pk-btn pk-btn--sm game-menu-button';
$('game-nav').append(menu.createInviteButton({ id: 'invite', label: 'Invitar', className: navButton }), menu.createSoundButton({ id: 'sound', className: navButton }), menu.createButton({ id: 'menu', className: navButton }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', label: 'Invitar panas', className: 'pk-btn' }));
$('room-code').textContent = code.toUpperCase();
const music = createMusic(sound);
function unlock() { try { sound.unlock(); } catch { /* audio blocked */ } }
function goLocal() { room.practice(); $('practice').classList.add('hidden'); }
const myBoat = () => state.boats.find(b => b.driver.id === room.id);

// Keyboard and touch feed one set of held controls; turbo is a press counter.
const KEYS = ['KeyW', 'ArrowUp', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'KeyS', 'ArrowDown', 'Space'];
window.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || paused || roomOptions.isOpen) return;
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (!KEYS.includes(e.code)) return;
  e.preventDefault(); unlock();
  if (e.code === 'Space' && !e.repeat) local.turbo++;
  // Pressing W again and again: one reminder that holding is faster.
  if ((e.code === 'KeyW' || e.code === 'ArrowUp') && !e.repeat) { const now = performance.now(); local.taps = (local.taps || []).filter(t => now - t < 1200); local.taps.push(now); if (local.taps.length >= 4 && state.options.throttle !== 'auto') { call('¡Sostenlo!', 'is-soft'); local.taps = []; } }
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
for (const b of document.querySelectorAll('[data-input]')) touchButtons.push(holdButton(b, { paused: () => paused,
  down: () => { touch.add(b.dataset.input); unlock(); if (b.dataset.input === 'turbo') local.turbo++; }, up: () => touch.delete(b.dataset.input) }));
const held = (...codes) => codes.some(c => keys.has(c));
function input() {
  if (paused) return { turbo: local.turbo };
  const left = held('KeyA', 'ArrowLeft') || touch.has('left'), right = held('KeyD', 'ArrowRight') || touch.has('right');
  return { throttle: held('KeyW', 'ArrowUp') || touch.has('gas'), steer: Number(right) - Number(left), back: held('KeyS', 'ArrowDown') || touch.has('back'), turbo: local.turbo };
}
$('start').onclick = $('again').onclick = () => { unlock(); room.action('start'); };
$('practice').onclick = () => goLocal();

await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));
world = createRaceScene($('world'), RIVER, { dress: addLandscape }); const { renderer, scene, camera, sun } = world;
renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
let fx = createRiverFX(RIVER); scene.add(fx.group);
const guide = createRiverGuide({ radius: 4.4, ahead: 26, spacing: 10, first: 14, count: 7, size: 1.4 }); scene.add(guide.group);
const minimap = createRiverMinimap($('map'), RIVER);
const lengthText = () => { $('map-length').textContent = `${Math.round(RIVER.LENGTH)} M`; $('stat-length').textContent = `${Math.round(RIVER.LENGTH)} m`; };
lengthText();
let riverKey = JSON.stringify([true, true]);
function applyRiverOptions() {
  const key = JSON.stringify([state.options.falls, state.options.items]); if (key === riverKey) return; riverKey = key;
  RIVER = courseRiver(state.options); world.world.dispose(); fx.dispose();
  world.world = createRiverWorld(RIVER, { dress: addLandscape }); scene.add(world.world.group); fx = createRiverFX(RIVER); scene.add(fx.group);
  minimap.rebuild(RIVER); lengthText();
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
resize(); window.addEventListener('resize', resize);
function previewBoat() { const q = RIVER.at(30, 0); return { id: 'preview', driver: { id: room.id ?? 'me', avatar }, color: COLORS[0], x: q.x, z: q.z, h: q.h, s: 30, y: RIVER.levelAt(30, 0), v: 0, throttle: 0, steer: 0 }; }
function ensureBoats() {
  const boats = state.boats.length ? state.boats : [previewBoat()];
  for (const [id, m] of boats3d) if (!boats.some(b => b.id === id)) { m.dispose(); boats3d.delete(id); }
  for (const b of boats) {
    const key = JSON.stringify([b.color, b.driver.avatar]), old = boats3d.get(b.id);
    if (old?.key === key) continue;
    old?.dispose();
    const m = createLancha(b.driver.avatar || {}, b.color); m.key = key; m.group.position.set(b.x, b.y, b.z); m.group.rotation.y = b.h; scene.add(m.group); boats3d.set(b.id, m);
  }
  return boats;
}

let callTimer = 0;
function call(text, kind = '') { const e = $('call'); e.textContent = text; e.className = `call ${kind}`; e.classList.remove('hidden'); void e.offsetWidth; callTimer = .9; }
function driveTip(b) {
  if (!b) return 'Corres en la próxima.';
  if (b.finish !== null) return '¡En Puerto Ayacucho! Esperando a tus panas.';
  if (b.stalled > 0) return '¡Se ahogó el motor! Ya arranca otra vez…';
  const caiman = state.options.items && RIVER.caimanesAt(state.time).find(c => c.s > b.s && c.s < b.s + 45 && Math.abs(c.offset - (b.offset || 0)) < 9);
  if (caiman) return '¡Caimán cruzando adelante! Sigue las flechas doradas para esquivarlo.';
  if (b.whirl > .15) return '¡Remolino! Acelera hacia afuera; por el borde te lleva la corriente.';
  if (b.boost > 0) return '¡La estela de las toninas te empuja!';
  const drop = RIVER.drops.find(d => b.s > d.s - d.span - 70 && b.s < d.s - d.span + 2);
  if (drop) return 'Raudal adelante: el carril rápido salta más alto. ¡Cae derecho!';
  if (b.channel === 'branch') return 'Atajo del igapó: corto, angosto y lleno de troncos.';
  if (state.options.throttle !== 'auto' && b.throttle === 0 && !b.back && state.phase === 'racing') return 'Sostén W para acelerar. No lo machaques: sostenido vas más rápido.';
  if (b.meter >= TURBO.cost && b.turbo <= 0) return '¡Turbo listo! Espacio en una recta.';
  if (RIVER.buoys.some(x => Math.abs(x.s - b.s) < 70)) return 'Río abierto: pasa entre las boyas y sigue las flechas doradas.';
  return 'Busca el chorro: el agua rápida llena el turbo.';
}
// What just happened to this pana's lancha, from the snapshot's counters.
let seen = null, lastPhoto = null, shake = 0, shakePower = 0;
function flash() { const e = $('flash'); e.classList.remove('is-on'); void e.offsetWidth; e.classList.add('is-on'); sound.tone(1600, 0, .05, 'square', .05); }
function events(own) {
  if (!own) return;
  const now = { bitten: own.bitten, jumps: own.jumps, crashes: own.crashes || 0, hits: own.hits, toninas: own.toninas, turbos: own.turbos, bumps: own.bumps };
  if (seen) {
    if (now.bitten > seen.bitten) { call('¡Un babo!'); sound.bonk(1); shake = .4; shakePower = .45; }
    else if (now.crashes > seen.crashes) { call('¡Caíste de lado!', 'is-soft'); sound.splat(); shake = .5; shakePower = .5; }
    else if (now.hits > seen.hits) { call('¡Pegaste!', 'is-soft'); sound.bonk(.8); shake = .35; shakePower = .4; }
    else if (now.jumps > seen.jumps) { call('¡Volaste!', 'is-teal'); sound.plop(); shake = .3; shakePower = .3; }
    else if (now.turbos > seen.turbos) { call('¡Turbo!'); sound.turbo(); pulseSpeedLines(500, .9); }
    else if (now.toninas > seen.toninas) { call('¡Toninas!', 'is-teal'); sound.sweep(600, 1100, .3, 'sine', .07); }
    if (now.bumps > seen.bumps) { shake = Math.max(shake, .2); shakePower = Math.max(shakePower, .2); sound.bonk(.5); }
  }
  seen = now;
}
function updateUI() {
  applyRiverOptions();
  roomOptions.update(state.options || cleanOptions(), room.isHost && room.connected && ['lobby', 'finished'].includes(state.phase));
  const lobby = state.phase === 'lobby', done = state.phase === 'finished', playing = !lobby && !done;
  document.body.classList.toggle('in-lobby', lobby); $('lobby').classList.toggle('hidden', !lobby); $('hud').classList.toggle('hidden', !playing); $('results').classList.toggle('hidden', !done);
  const full = state.players.length > SLOTS;
  $('start').disabled = !room.connected || !room.isHost || !ready || full; $('start').firstChild.textContent = !room.connected ? 'Conectando… ' : full ? 'Máximo 8 lanchas ' : room.isHost ? '¡Al agua! ' : 'Esperando al anfitrión… ';
  $('again').disabled = !room.connected || !room.isHost; $('again').firstChild.textContent = room.isHost ? 'Otra carrera ' : 'Esperando al anfitrión… ';
  if (lobby) fillRoster($('roster'), state.players.map((p, i) => ({ rank: i + 1, name: p.id === room.id ? `${p.name} · tú` : p.name, detail: p.id === room.hostId ? 'Anfitrión' : 'Pana', end: '', me: p.id === room.id })));
  const own = myBoat(), ordered = standings(state), place = own ? ordered.indexOf(own) + 1 : 0;
  $('place').textContent = place || '—'; $('field-size').textContent = `de ${ordered.length}`;
  $('timer').textContent = formatTime(own?.finish ?? state.time);
  $('left').textContent = `${Math.max(0, Math.round(RIVER.LENGTH - (own?.progress || 0)))} m`;
  $('sector').textContent = own ? RIVER.sector(own.s) : 'Mirando';
  $('speed').textContent = own ? Math.round(Math.hypot(own.gx || 0, own.gz || 0) * 3.6) : 0;
  const meter = own?.meter || 0, readyTurbo = meter >= TURBO.cost;
  $('turbo-fill').style.width = `${meter}%`; $('turbo-fill').parentElement.classList.toggle('is-ready', readyTurbo);
  $('turbo-label').textContent = own?.turbo > 0 ? '¡a fondo!' : readyTurbo ? 'listo · Espacio' : 'cargando';
  $('drive-tip').textContent = driveTip(own);
  $('motor').textContent = own?.stalled > 0 ? 'Motor ahogado' : 'Motor en marcha'; $('motor').classList.toggle('is-dead', own?.stalled > 0);
  $('throttle-state').textContent = state.options.throttle === 'auto' ? 'Acelerador automático' : own?.throttle > 0 ? 'Acelerando' : own?.back ? 'Frenando' : 'Sin gas';
  $('leaderboard').replaceChildren(...ordered.slice(0, 8).map((b, i) => {
    const li = document.createElement('li'); li.className = b === own ? 'pk-row is-me' : 'pk-row';
    const n = document.createElement('b'); n.className = 'pk-row-n'; n.textContent = i + 1;
    const dot = document.createElement('i'); dot.className = 'boat-dot'; dot.style.setProperty('--boat', b.color);
    const span = document.createElement('span'); span.className = 'row-name'; span.textContent = b.driver.name + (b === own ? ' · tú' : '');
    const end = document.createElement('span'); end.className = 'pk-row-end'; end.textContent = b.finish !== null ? formatTime(b.finish) : b.stalled > 0 ? 'ahogado' : '';
    li.append(n, dot, span, end); return li;
  }));
  const count = state.phase === 'countdown' ? String(Math.max(1, Math.ceil(state.countdown))) : state.phase === 'racing' && state.time < .75 ? '¡DALE!' : '';
  $('countdown').classList.toggle('hidden', !count); $('countdown').textContent = count;
  if (count && count !== lastCountdown) { sound.tone(count === '¡DALE!' ? 740 : 370, 0, .12, 'triangle', .06); lastCountdown = count; }
  if (state.raceId !== lastRace) { lastRace = state.raceId; cameraReady = false; clearInput(); fx.reset(); seen = null; }
  if (playing) events(own);
  if (done && (lastPhase !== state.phase || $('result-board').childElementCount !== ordered.length)) {
    $('result-title').textContent = place === 1 ? '¡Ganaste, pana!' : own?.finish != null ? '¡Llegaste, pana!' : '¡Se cerró la carrera!';
    $('result-copy').textContent = own?.finish != null ? `${place}.º lugar · ${formatTime(own.finish)} · ${own.jumps} ${own.jumps === 1 ? 'salto' : 'saltos'} · ${own.turbos} turbos` : 'La próxima es tuya. Sostén el acelerador y sigue las flechas.';
    fillRoster($('result-board'), ordered.map((b, i) => ({ rank: i + 1, name: b.driver.name + (b.driver.bot ? ' · del río' : ''), detail: `${b.jumps} saltos · ${b.turbos} turbos${b.bitten ? ` · ${b.bitten} babo${b.bitten > 1 ? 's' : ''}` : ''}`, end: b.finish === null ? 'Sin llegar' : formatTime(b.finish), me: b === own })));
    if (lastPhase !== state.phase) sound.tone(660, 0, .25, 'triangle', .08);
  }
  if (state.phase === 'racing' && !music.playing && !paused) music.play('lancha-orinoco', { fallback: 'amazonas' });
  if (state.phase !== 'racing' && state.phase !== 'countdown' && music.playing) music.stop();
  const lead = ordered[0];
  music.setTempo(state.slowmo > 0 ? .6 : lead && RIVER.LENGTH - lead.progress < 200 ? 1.14 : 1);
  if (state.photo && state.photo.at !== lastPhoto) { lastPhoto = state.photo.at; call('¡Foto finish!', 'is-teal'); flash(); }
  // The motor drone follows your own lancha.
  if (playing && own && !paused) { sound.startEngine(); sound.setEngine(own.stalled > 0 ? 0 : Math.abs(own.v) * 1.6 + (own.turbo > 0 ? 8 : 0)); } else sound.stopEngine();
  lastPhase = state.phase; minimap.draw(state.boats, own);
}
ensureBoats(); ready = true; $('loading').classList.add('hidden'); room.connect(); updateUI();
const look = new THREE.Vector3(), cameraGoal = new THREE.Vector3(), target = new THREE.Vector3(); let cameraReady = false, elapsed = 0, camH = 0;
const frameClock = new THREE.Timer().reset();
function frame() {
  if (disposed) return;
  const dt = Math.min(frameClock.update().getDelta(), .08), frozen = paused && room.members.size <= 1; if (!frozen) elapsed += dt;
  const boats = ensureBoats(), t = state.time + (state.phase === 'racing' && !frozen ? Math.min(.1, (performance.now() - snapshotAt) / 1000) : 0);
  for (const shown of boats) {
    // Your own lancha where you predict it (LanchaRoom's predict), not a round trip behind.
    const b = shown.driver.id === room.id ? room.predicted ?? shown : shown;
    const m = boats3d.get(b.id), blend = 1 - Math.exp(-dt * 16);
    // Teleports (host migration, a fresh race) snap instead of gliding.
    target.set(b.x, b.y, b.z); if (m.group.position.distanceTo(target) > 20) m.group.position.copy(target); else m.group.position.lerp(target, blend);
    m.group.rotation.y += angle(b.h - m.group.rotation.y) * blend;
    m.update(frozen ? 0 : dt, b, t);
  }
  const own = myBoat(), focus = own || standings(state)[0] || boats[0], m = boats3d.get(focus.id), q = m.group.position;
  // Chase camera: a blend of the lancha's heading and the river's.
  const flow = RIVER.at(focus.s ?? 30).h, wantH = state.phase === 'lobby' ? flow : flow + angle(m.group.rotation.y - flow) * .65;
  camH = cameraReady ? camH + angle(wantH - camH) * (1 - Math.exp(-dt * 3.5)) : wantH;
  const speed = Math.hypot(focus.gx || 0, focus.gz || 0);
  if (state.phase === 'lobby') {
    const side = innerWidth < 700 ? 0 : 2;
    cameraGoal.set(q.x - Math.sin(camH) * 8 + Math.cos(camH) * 5.5, q.y + 3.6, q.z - Math.cos(camH) * 8 - Math.sin(camH) * 5.5);
    look.set(q.x + Math.cos(camH) * side, q.y + 1, q.z - Math.sin(camH) * side);
  } else {
    const tall = innerHeight > innerWidth, back = (tall ? 11.5 : 9.5) + Math.min(3, speed * .12);
    cameraGoal.set(q.x - Math.sin(camH) * back, q.y + (tall ? 4.4 : 3.8), q.z - Math.cos(camH) * back);
    look.set(q.x + Math.sin(camH) * 10, q.y + (tall ? -1.4 : 1), q.z + Math.cos(camH) * 10);
  }
  if (state.slowmo > 0 && state.photo) {
    const line = RIVER.at(RIVER.LENGTH - 6, 0), side = RIVER.at(RIVER.LENGTH - 6, RIVER.halfWidth(RIVER.LENGTH - 6) - 3);
    cameraGoal.set(side.x, q.y + 2, side.z); look.set(line.x, q.y + .6, line.z); camera.position.copy(cameraGoal);
  }
  const floor = RIVER.groundAt(cameraGoal.x, cameraGoal.z) + 1.4; if (cameraGoal.y < floor) cameraGoal.y = floor;
  if (!cameraReady || camera.position.distanceTo(cameraGoal) > 40) { camera.position.copy(cameraGoal); cameraReady = true; } else camera.position.lerp(cameraGoal, 1 - Math.exp(-dt * 5));
  camera.lookAt(look);
  const wantFov = 54 + Math.min(10, speed * .45) + (focus.turbo > 0 ? 6 : 0);
  if (Math.abs(camera.fov - wantFov) > .05) { camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
  setSpeedLines(own?.turbo > 0 ? .8 : own && speed > 15 ? .3 : 0);
  if (shake > 0) { shake = Math.max(0, shake - dt); const k = shake * shakePower; camera.position.x += (Math.random() - .5) * k; camera.position.y += (Math.random() - .5) * k; }
  sun.position.set(q.x - 40, q.y + 70, q.z + 30); sun.target.position.copy(q); sun.target.updateMatrixWorld();
  tickWind(elapsed, .9);
  world.world.update(elapsed, dt); world.world.cull(camera, 240); world.world.race(state, t); world.sky.update(elapsed);
  fx.update(elapsed, boats.filter(b => b.id !== 'preview'), boats3d, q, t);
  const mine = own && boats3d.get(own.id);
  guide.update(RIVER, mine ? { ...own, x: mine.group.position.x, z: mine.group.position.z, h: mine.group.rotation.y } : null, t, { on: state.options.guide && state.phase === 'racing', clock: elapsed });
  if (callTimer > 0) { callTimer -= dt; if (callTimer <= 0) $('call').classList.add('hidden'); }
  drawClock += dt; if (drawClock > .1) { updateUI(); drawClock = 0; }
  if (!quiet) renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Simulation runs at 20 Hz independent of rendering; guests send inputs at 20 Hz.
let simulationTime = performance.now();
const simulation = setInterval(() => { const now = performance.now(), dt = (now - simulationTime) / 1000; simulationTime = now; if (params.has('manual')) return; room.tick(dt, input(), paused && room.members.size <= 1); }, 50);
if (params.has('debug')) window.lanchaDebug = { room, get state() { return state; }, world, boats: boats3d, input, get RIVER() { return RIVER; }, updateUI, guide,
  // Suites skip drawing while timing keys: software WebGL starves the tab.
  quiet(value) { quiet = !!value; },
  manual(value) { if (value) params.set('manual', ''); else params.delete('manual'); simulationTime = performance.now(); },
  step(seconds, controls) { for (let t = 0; t < seconds; t += .05) room.tick(.05, controls ? controls() : input()); updateUI(); },
  place(id, s, offset = 0) { const b = room.game.boatOf(id), q = RIVER.at(s, offset); Object.assign(b, { x: q.x, z: q.z, h: q.h, s, progress: s, checkpoint: RIVER.gates.filter(g => g <= s).length, v: 0, lat: 0, w: 0, y: RIVER.levelAt(s, offset), vy: 0, air: 0, stalled: 0, channel: 'main' }); room.publish(); } };
window.addEventListener('pagehide', () => { disposed = true; clearInterval(simulation); sound.stopEngine(); music.stop(); roomOptions.dispose(); room.dispose(); for (const m of boats3d.values()) m.dispose(); guide.dispose(); world.world.dispose(); fx.dispose(); world.sky.dispose(); unbind?.(); renderer.dispose(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

await prepareScene(world);
