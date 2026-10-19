import { createRoomOptions } from '/engine/room-options.js';
import { FIELDS, cleanOptions } from './options.js';
import { prepareScene } from '/engine/game-load.js';
import { createLobbyRoster } from '/engine/lobby-roster.js';
import * as THREE from 'three';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound, pulseSpeedLines, setSpeedLines } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton } from '/engine/touch.js';
import { bindRenderer, pixelRatio } from '/engine/settings.js';
import { RiverRoom } from './network.js';
import { standings, FORMATS, COLORS, crewGrid } from './rules.js';
import { RIVER as DEFAULT_RIVER, configuredRiver, angle, formatTime } from './river.js';
import { PADDLE, grade } from '/engine/play/paddle.js';
import { createRaceScene, createRiverWorld } from '/engine/river/scene.js';
import { createCanoe } from '/engine/models/vehicles/curiara.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { addLandscape } from '/engine/river/landscape.js';
import { createRiverFX } from '/engine/river/water-fx.js';
import { createRiverGuide } from '/engine/river/guide.js';
import { createRiverMinimap } from '/engine/river/minimap.js';
import { createMusic } from '/engine/music.js';
import { createToast } from '/engine/hud.js';

let RIVER=DEFAULT_RIVER;
const $ = id => document.getElementById(id), params = new URLSearchParams(location.search), avatar = loadAvatar(), name = loadName();
const showNotice = createToast($('notice'), { ms: 3000 });
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
let format = FORMATS[store.get('curiara:format')] ? store.get('curiara:format') : 'todos';
const code = roomFromUrl() || newRoomCode(); params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const keys = new Set(), touch = new Set(), canoes = new Map(), touchButtons = [];
let paused = false, quiet = false, state, world, ready = false, lastPhase = '', lastCountdown = '', lastRace = 0, drawClock = 0, disposed = false, snapshotAt = performance.now();
const room = new RiverRoom({ code, name, avatar, onState: s => { state = s; snapshotAt = performance.now(); }, onStatus: (message, error = false) => { $('connection').textContent = message; $('practice').classList.toggle('hidden', !error); if (error) showNotice(message); } });
state = room.state;
const crewRoster = createLobbyRoster($('seats'), { onMove: (from, to) => room.moveSeat(from, to) });

const roomOptions=createRoomOptions($('room-options'),{title:'Curiara',fields:FIELDS,change:patch=>{if(patch.crew){format=patch.crew;store.set('curiara:format',format);}room.configure(patch);},reset:()=>{$('bots').checked=true;room.configure(cleanOptions());}});
for(const button of document.querySelectorAll('[data-room-option=crew]'))button.dataset.format=button.dataset.value;
// Strokes keep the pana's own clock; the host maps them onto race time.
const strokes = [], local = { seq: 0, last: null, side: 0, splash: 0, streak: 0, mash: 0 };
const clock = () => performance.now() / 1000;
function clearInput() { keys.clear(); for (const b of touchButtons) b.release(); touch.clear(); }
const menu = createGameMenu({ title: 'Curiara', sound, orientation: 'libre', note: () => room.members.size > 1 ? 'La carrera sigue mientras abres el menú.' : 'La carrera está en pausa.',
  controls: [['W / ↑ sostenido', 'Remo automático; A y D llevan el timón'], ['A / ←', 'Remar a la izquierda'], ['D / →', 'Remar a la derecha'], ['A D A D', 'Alternar: recto y a toda'], ['D D / A A', 'Mismo lado: girar al lado contrario'], ['S / ↓', 'Ciar: frenar; con A o D, pivotar'], ['Espacio', '¡Salpicón! a la curiara de al lado'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: ['¿Te cuesta el ritmo? Sostén W: la curiara rema sola y tú solo giras con A y D.', 'Machacar las teclas frena la curiara. Con calma se va más rápido.', 'Sigue las flechas doradas en el agua: marcan el chorro y esquivan los caimanes.', 'Rema justo cuando el anillo pasa por la zona dorada: ¡Remazo!', 'En Parejas, la proa rema y la popa lleva el timón (A/D sostenido), cía y lanza el salpicón. Si la popa toca A o D justo con la remada: ¡Ahora!'],
  invite: () => inviteUrl(code), actions: [{ id: 'local-race', label: 'Abrir carrera local', run: () => goLocal() }],
  onOpen() { paused = true; clearInput(); if (room.members.size <= 1) music.pause(); }, onClose() { paused = false; music.resume(); } });
const navButton = 'pk-btn pk-btn--sm game-menu-button';
$('game-nav').append(menu.createInviteButton({ id: 'invite', label: 'Invitar', className: navButton }), menu.createSoundButton({ id: 'sound', className: navButton }), menu.createButton({ id: 'menu', className: navButton }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', label: 'Invitar panas', className: 'pk-btn' }));
$('room-code').textContent = code.toUpperCase();
const coarse = matchMedia('(pointer:coarse)').matches, music = createMusic(sound);
function unlock() { try { sound.unlock(); } catch { /* audio blocked */ } }
function goLocal() { room.practice(); $('practice').classList.add('hidden'); }

// What this pana does in its canoe: solo, proa (power) or popa (helm).
const myBoat = () => state.boats.find(b => b.crew.some(c => c.id === room.id));
const myRole = () => { const b = myBoat(); if (!b) return 'solo'; return b.crew.length === 1 ? 'solo' : b.crew.find(c => c.id === room.id).seat ? 'popa' : 'proa'; };

let callTimer = 0;
function call(text, kind = '') { const e = $('call'); e.textContent = text; e.className = `call ${kind}`; e.classList.remove('hidden'); void e.offsetWidth; callTimer = .9; }
function tock(power) { sound.tone(1180, 0, .045, 'triangle', .07 * power); sound.tone(590, .01, .07, 'sine', .08 * power); }
// `at` is the input event's own timestamp, so a slow frame never bends the rhythm.
function stroke(side, at) {
  if (paused || roomOptions.isOpen) return;
  unlock();
  if (autoHeld() && myRole() !== 'popa') return;
  const now = clock(), t = at > 0 && at <= now + .01 ? at : now;
  strokes.push([++local.seq, side, t]); if (strokes.length > 8) strokes.shift();
  if (state.phase !== 'racing' && state.phase !== 'countdown') return;
  const role = myRole(), b = myBoat();
  if (!b || b.capsized > 0 || b.finish !== null) { local.last = t; local.side = side; return; }
  // Instant feedback from the same grading the host applies.
  if (role !== 'popa' && !keys.has('KeyS') && !keys.has('ArrowDown') && !touch.has('back')) {
    const gap = local.last == null ? Infinity : t - local.last, g = state.options.paddling==='tap'?{quality:'bueno'}:grade(gap, gap !== Infinity && side === local.side);
    local.streak = g.quality === 'remazo' ? local.streak + 1 : g.quality === 'chapoteo' || g.quality === 'arranque' ? 0 : local.streak;
    if (g.quality === 'remazo') { tock(1); sound.whoosh(); pulseSpeedLines(220, 0.55); call(local.streak >= 3 ? `¡Remazo ×${local.streak}!` : '¡Remazo!'); }
    else if (g.quality === 'chapoteo') { sound.sweep(900, 300, .12, 'triangle', .05); call(++local.mash % 3 ? '¡Chapoteo!' : '¡Más calma!', 'is-soft'); }
    else sound.tone(420, 0, .05, 'triangle', .04);
  }
  local.last = t; local.side = side;
}
const STROKE_KEYS = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
window.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || paused || roomOptions.isOpen) return;
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code in STROKE_KEYS || ['KeyS', 'ArrowDown', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
    e.preventDefault(); unlock();
    if (!e.repeat && e.code in STROKE_KEYS) stroke(STROKE_KEYS[e.code], e.timeStamp / 1000);
    if (!e.repeat && e.code === 'Space') local.splash++;
    keys.add(e.code);
  }
});
window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
for (const b of document.querySelectorAll('[data-stroke]')) touchButtons.push(holdButton(b, { paused: () => paused,
  down: e => { touch.add(`s${b.dataset.stroke}`); stroke(Number(b.dataset.stroke), e?.timeStamp / 1000); }, up: () => touch.delete(`s${b.dataset.stroke}`) }));
for (const b of document.querySelectorAll('[data-input]')) touchButtons.push(holdButton(b, { paused: () => paused,
  down: () => { touch.add(b.dataset.input); unlock(); if (b.dataset.input === 'splash') local.splash++; }, up: () => touch.delete(b.dataset.input) }));
const autoHeld = () => keys.has('KeyW') || keys.has('ArrowUp') || touch.has('auto');
function input() {
  if (paused) return { strokes: strokes.slice(), splash: local.splash };
  const left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.has('s-1'), right = keys.has('KeyD') || keys.has('ArrowRight') || touch.has('s1');
  return { strokes: strokes.slice(), back: keys.has('KeyS') || keys.has('ArrowDown') || touch.has('back'), steer: Number(right) - Number(left), splash: local.splash, auto: autoHeld() };
}

// Lobby: format and, in Parejas, the seat picker.
function drawSeats() {
  const pairs = FORMATS[state.format].seats === 2, capacity = FORMATS[state.format].boats * FORMATS[state.format].seats;
  const people = state.players.filter(p => !p.bot).length;
  $('seats').hidden = !pairs;
  $('format-copy').textContent = people > capacity ? `Hay ${people} panas y ${capacity} puestos. Elige más curiaras para dar la salida.` : pairs ? `${FORMATS[state.format].boats} curiaras de dos panas: la proa rema, la popa lleva el timón. Elige tu puesto.` : 'Una curiara por pana. Ocho curiaras en el agua.';
  for (const b of document.querySelectorAll('[data-format]')) { b.setAttribute('aria-pressed', String(b.dataset.format === state.format)); b.disabled = !room.isHost || !room.connected; }
  if (!pairs) return;
  crewRoster.update(crewGrid(state.players, state.format).map((crew, boat) => ({ id: boat, title: `Curiara ${boat + 1}`, color: COLORS[boat], seats: crew.map((player, pos) => ({ key: boat * 2 + pos, player, label: pos ? 'Popa · timón' : 'Proa · remo' })) })),
    { ownId: room.id, hostId: room.hostId, enabled: room.connected && ['lobby', 'finished'].includes(state.phase), canArrange: room.isHost, members: room.link?.state.players || [...room.members.values()] });
}
$('start').onclick = $('again').onclick = () => { unlock(); room.start($('bots').checked); };
$('practice').onclick = () => goLocal();

await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));
world = createRaceScene($('world'), RIVER, { dress: addLandscape }); const { renderer, scene, camera, sun } = world;
renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
let fx = createRiverFX(RIVER); scene.add(fx.group);
$('map-length').textContent = `${Math.round(RIVER.LENGTH)} M`; $('stat-length').textContent = `${Math.round(RIVER.LENGTH)} m`;

// Minimap: the river's real shape, drawn once; the guide on the water.
const minimap = createRiverMinimap($('map'), RIVER);
const guide = createRiverGuide(); scene.add(guide.group);
let riverKey=JSON.stringify(['amazonas',true,true]);
function applyRiverOptions(){
 const key=JSON.stringify([state.options.river,state.options.falls,state.options.items]);if(key===riverKey)return;riverKey=key;
 RIVER=configuredRiver(state.options);world.world.dispose();fx.dispose();world.world=createRiverWorld(RIVER,{dress:addLandscape});scene.add(world.world.group);fx=createRiverFX(RIVER);scene.add(fx.group);
 $('map-length').textContent=`${Math.round(RIVER.LENGTH)} M`;$('stat-length').textContent=`${Math.round(RIVER.LENGTH)} m`;minimap.rebuild(RIVER);
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
resize(); window.addEventListener('resize', resize);
function previewBoat() { const q = RIVER.at(18, 0); return { id: 'preview', crew: [{ id: room.id ?? 'me', avatar }], color: COLORS[0], x: q.x, z: q.z, h: q.h, y: RIVER.levelAt(18, 0), paddle: {}, capsized: 0, v: 0 }; }
function ensureCanoes() {
  const boats = state.boats.length ? state.boats : [previewBoat()];
  for (const [id, c] of canoes) if (!boats.some(b => b.id === id)) { c.dispose(); canoes.delete(id); }
  for (const b of boats) {
    const key = JSON.stringify([b.color, b.crew.map(c => [c.avatar, !!c.empty])]), old = canoes.get(b.id);
    if (old?.key === key) continue;
    old?.dispose();
    const c = createCanoe(b.crew, b.color); c.key = key; c.group.position.set(b.x, b.y, b.z); c.group.rotation.y = b.h; scene.add(c.group); canoes.set(b.id, c);
  }
  return boats;
}

// The stroke ring: a lap is PADDLE.rhythm[1] seconds; gold is the sweet spot.
const ring = $('ring').getContext('2d');
function drawRing(own, t) {
  const c = ring, R = 54, cx = 66, cy = 66, full = PADDLE.rhythm[1], a0 = -Math.PI / 2, popa = myRole() === 'popa';
  c.clearRect(0, 0, 132, 132); c.lineCap = 'round';
  c.lineWidth = 12; c.strokeStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#ffc629'; c.beginPath(); c.arc(cx, cy, R, a0 + PADDLE.sweet[0] / full * Math.PI * 2, a0 + PADDLE.sweet[1] / full * Math.PI * 2); c.stroke();
  c.strokeStyle = 'rgba(255,107,90,.65)'; c.beginPath(); c.arc(cx, cy, R, a0, a0 + PADDLE.rhythm[0] / full * Math.PI * 2); c.stroke();
  // Popa reads the proa's strokes (from the snapshot); everyone else their own.
  const last = popa ? (own?.paddle?.last == null ? null : t - (state.time - own.paddle.last)) : local.last;
  const since = last == null ? Infinity : clock() - last, key = $('next-key');
  if (since < full) {
    const a = a0 + since / full * Math.PI * 2; c.lineWidth = 5; c.strokeStyle = '#fff'; c.beginPath(); c.arc(cx, cy, R, a0, a); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 8, 0, Math.PI * 2); c.fill();
  }
  const sweet = since >= PADDLE.sweet[0] && since <= PADDLE.sweet[1];
  key.classList.toggle('is-sweet', sweet);
  const next = popa ? '¡Ya!' : local.side < 0 ? (coarse ? 'Der.' : 'D') : (coarse ? 'Izq.' : 'A');
  if (key.textContent !== next) key.textContent = next;
}
function tipText(b) {
  if (!b) return 'Corres en la próxima.';
  if (b.finish !== null) return '¡En la churuata! Esperando a tus panas.';
  if (b.capsized > 0) return '¡Volcaste! Nadando de vuelta a la curiara…';
  if (b.sprayed > 0) return '¡Salpicón! No ves nada, sigue remando.';
  const caiman = RIVER.caimanesAt(state.time).find(c => c.s > b.s && c.s < b.s + 30 && Math.abs(c.offset - (b.offset || 0)) < 7);
  if (caiman && state.options.items) return '¡Caimán cruzando adelante! Sigue las flechas doradas para esquivarlo.';
  if (b.paddle?.quality === 'chapoteo' && myRole() !== 'popa') return 'Machacar frena la curiara. Alterna A y D con calma, o sostén W y rema solo.';
  if (autoHeld() && myRole() !== 'popa') return 'Remo automático: A y D llevan el timón. Con ritmo propio vas más rápido.';
  if(state.options.paddling==='tap'&&myRole()!=='popa')return 'Toca A y D para remar. Cada toque vale igual; evita machacar las teclas.';
  if (myRole() === 'popa') return 'Sostén A o D para el timón. Toca justo con la remada: ¡Ahora!';
  if (b.whirl > .15) return '¡Remolino! Rema fuerte hacia afuera. Por el borde, la corriente te lleva.';
  if (b.boost > 0) return '¡La estela de las toninas te empuja!';
  if (b.eddy > .3) return 'Remanso: el agua te frena. Rema hacia el chorro.';
  const drop = RIVER.drops.find(d => b.s > d.s - d.span - 40 && b.s < d.s - d.span + 2);
  if (drop) return 'Raudal adelante: elige carril. El rápido cae de golpe; ¡llega recto!';
  if (b.channel === 'branch') return 'Atajo del igapó: corto, lento y lleno de troncos.';
  if (b.tip > 60) return 'Endereza la curiara: rema recto para calmarla.';
  return 'Alterna A y D en la zona dorada del anillo, o sostén W y rema solo.';
}
// What just happened to this pana's canoe, from the snapshot's counters.
let seen = null, lastPhoto = null;
function flash() { const e = $('flash'); e.classList.remove('is-on'); void e.offsetWidth; e.classList.add('is-on'); sound.tone(1600, 0, .05, 'square', .05); }
function events(own) {
  if (!own) return;
  const now = { caps: own.capsizes, bitten: own.bitten || 0, drops: own.drops || 0, toninas: own.toninas || 0, sprayed: own.splashedAt || 0, soaked: own.soaked || 0, bumps: own.bumps || 0, syncs: own.paddle?.syncs || 0 };
  if (seen) {
    if (now.caps > seen.caps) { call('¡Volcaste!', 'is-soft'); sound.sweep(500, 90, .5, 'sine', .14); shake = .5; shakePower = .5; }
    else if (now.bitten > seen.bitten) { call('¡Un babo!'); sound.bonk(1); shake = .35; shakePower = .4; }
    else if (now.drops > seen.drops) { call(own.tip > 60 ? '¡Uy, casi!' : '¡Raudal!', 'is-teal'); sound.plop(); shake = .4; shakePower = .35; }
    else if (now.sprayed > seen.sprayed) { call('¡Salpicón!', 'is-soft'); sound.splat?.(); }
    else if (now.soaked > seen.soaked) { call('¡Te mojé!', 'is-teal'); sound.splat?.(); }
    else if (now.toninas > seen.toninas) { call('¡Toninas!', 'is-teal'); sound.sweep(600, 1100, .3, 'sine', .07); }
    else if (now.syncs > seen.syncs && myRole() !== 'solo') { call('¡Ahora!', 'is-teal'); tock(.8); }
    if (now.bumps > seen.bumps) { shake = Math.max(shake, .2); shakePower = Math.max(shakePower, .2); sound.bonk(.5); }
  }
  seen = now;
}
function crewName(b) { return b.crew.filter(c => !c.empty).map(c => c.name).join(' y '); }
function updateUI() {
  applyRiverOptions();
  roomOptions.update(state.options||cleanOptions(),room.isHost&&room.connected&&state.phase==='lobby');
  $('bots').disabled = !room.connected || !room.isHost;
  const lobby = state.phase === 'lobby', done = state.phase === 'finished', playing = !lobby && !done;
  document.body.classList.toggle('in-lobby', lobby); $('lobby').classList.toggle('hidden', !lobby); $('hud').classList.toggle('hidden', !playing); $('results').classList.toggle('hidden', !done);
  $('start').disabled = !room.connected || !room.isHost || !ready || state.players.filter(p=>!p.bot).length>FORMATS[state.format].boats*FORMATS[state.format].seats; $('start').firstChild.textContent = !room.connected ? 'Conectando… ' : room.isHost ? '¡Al agua! ' : 'Esperando al anfitrión… ';
  $('again').disabled = !room.connected || !room.isHost; $('again').firstChild.textContent = room.isHost ? 'Otra carrera ' : 'Esperando al anfitrión… ';
  if (lobby) drawSeats();
  const own = myBoat(), ordered = standings(state), place = own ? ordered.indexOf(own) + 1 : 0, role = myRole();
  $('place').textContent = place || '—'; $('field-size').textContent = `de ${ordered.length}`;
  $('timer').textContent = formatTime(own?.finish ?? state.time);
  $('left').textContent = `${Math.max(0, Math.round(RIVER.LENGTH - (own?.progress || 0)))} m`;
  $('sector').textContent = own ? RIVER.sector(own.s) : 'Mirando';
  $('speed').textContent = own ? Math.round(Math.hypot(own.gx || 0, own.gz || 0) * 3.6) : 0;
  const tip = own?.tip || 0;
  $('tip-fill').style.width = `${own?.capsized > 0 ? 100 : tip}%`;
  $('tip-fill').parentElement.className = `pk-bar tip-bar${own?.capsized > 0 || tip > 80 ? ' is-danger' : tip > 55 ? ' is-warn' : ''}`;
  $('tip-label').textContent = own?.capsized > 0 ? '¡Volcó!' : tip > 80 ? '¡Cuidado!' : tip > 45 ? 'se mece' : 'firme';
  $('paddle-tip').textContent = tipText(own);
  $('role').classList.toggle('hidden', role === 'solo'); $('role').textContent = role === 'popa' ? 'Popa · timón' : 'Proa · remo';
  const loaded = state.options.items && own && own.splashCd <= 0; $('splash-state').textContent = !state.options.items ? 'Sin objetos' : loaded ? 'Salpicón listo' : `Salpicón ${Math.ceil(own?.splashCd || 0)} s`; $('splash-state').classList.toggle('is-ready', !!loaded);
  document.querySelector('[data-input="splash"]').disabled=!state.options.items;
  $('keys-hint').classList.toggle('hidden', role === 'popa'); $('helm-hint').classList.toggle('hidden', role !== 'popa');
  $('spray').classList.toggle('is-on', (own?.sprayed || 0) > 0);
  $('leaderboard').replaceChildren(...ordered.slice(0, 8).map((b, i) => {
    const li = document.createElement('li'); li.className = b === own ? 'pk-row is-me' : 'pk-row';
    const n = document.createElement('b'); n.className = 'pk-row-n'; n.textContent = i + 1;
    const dot = document.createElement('i'); dot.className = 'boat-dot'; dot.style.setProperty('--boat', b.color);
    const span = document.createElement('span'); span.className = 'row-name'; span.textContent = crewName(b) + (b === own ? ' · tú' : '');
    const end = document.createElement('span'); end.className = 'pk-row-end'; end.textContent = b.finish !== null ? formatTime(b.finish) : b.capsized > 0 ? 'volcó' : '';
    li.append(n, dot, span, end); return li;
  }));
  const count = state.phase === 'countdown' ? String(Math.max(1, Math.ceil(state.countdown))) : state.phase === 'racing' && state.time < .75 ? '¡REMA!' : '';
  $('countdown').classList.toggle('hidden', !count); $('countdown').textContent = count;
  if (count && count !== lastCountdown) { sound.tone(count === '¡REMA!' ? 740 : 370, 0, .12, 'triangle', .06); lastCountdown = count; }
  if (state.raceId !== lastRace) { lastRace = state.raceId; cameraReady = false; clearInput(); local.last = null; local.side = 0; local.streak = 0; fx.reset(); seen = null; }
  if (playing) events(own);
  if (done && (lastPhase !== state.phase || $('result-board').childElementCount !== ordered.length)) {
    $('result-title').textContent = place === 1 ? (role === 'solo' ? '¡Ganaste, pana!' : '¡Ganaron, panas!') : own?.finish != null ? '¡Llegaste, pana!' : '¡Se cerró la carrera!';
    $('result-copy').textContent = own?.finish != null ? `${place}.º lugar · ${formatTime(own.finish)} · ${own.remazos} remazos · ${own.capsizes} ${own.capsizes === 1 ? 'vuelta' : 'vueltas'} de campana` : 'La próxima es tuya. Rema en ritmo y busca el chorro.';
    fillRoster($('result-board'), ordered.map((b, i) => ({ rank: i + 1, name: crewName(b) + (b.crew.every(c => c.bot || c.empty) ? ' · del río' : ''), detail: `${b.remazos} remazos${b.capsizes ? ` · volcó ${b.capsizes}` : ''}`, end: b.finish === null ? 'Sin llegar' : formatTime(b.finish), me: b === own })));
    if (lastPhase !== state.phase) sound.tone(660, 0, .25, 'triangle', .08);
  }
  if (state.phase === 'racing' && !music.playing && !paused) music.play('curiara-amazonas', { fallback: 'amazonas' });
  if (state.phase !== 'racing' && state.phase !== 'countdown' && music.playing) music.stop();
  const lead = ordered[0];
  music.setTempo(state.slowmo > 0 ? .6 : lead && RIVER.LENGTH - lead.progress < 120 ? 1.14 : 1);
  if (state.photo && state.photo.at !== lastPhoto) { lastPhoto = state.photo.at; call('¡Foto finish!', 'is-teal'); flash(); }
  lastPhase = state.phase; minimap.draw(state.boats, own);
}
ensureCanoes(); ready = true; $('loading').classList.add('hidden'); room.connect(); updateUI();
const look = new THREE.Vector3(), cameraGoal = new THREE.Vector3(), target = new THREE.Vector3(); let cameraReady = false, elapsed = 0, camH = 0, shake = 0, shakePower = 0;
const frameClock = new THREE.Clock();
function frame() {
  if (disposed) return;
  const dt = Math.min(frameClock.getDelta(), .08), frozen = paused && room.members.size <= 1; if (!frozen) elapsed += dt;
  const boats = ensureCanoes(), t = state.time + (state.phase === 'racing' && !frozen ? Math.min(.1, (performance.now() - snapshotAt) / 1000) : 0);
  for (const b of boats) {
    const c = canoes.get(b.id), blend = 1 - Math.exp(-dt * 16);
    // Teleports (host migration, a fresh race) snap instead of gliding.
    target.set(b.x, b.y, b.z); if (c.group.position.distanceTo(target) > 12) c.group.position.copy(target); else c.group.position.lerp(target, blend);
    c.group.rotation.y += angle(b.h - c.group.rotation.y) * blend;
    c.update(frozen ? 0 : dt, b, t);
  }
  const own = myBoat(), focus = own || standings(state)[0] || boats[0], c = canoes.get(focus.id), q = c.group.position;
  // Chase camera looks downstream: a blend of the canoe and the river.
  const flow = RIVER.at(focus.s ?? 18).h, wantH = state.phase === 'lobby' ? flow : flow + angle(c.group.rotation.y - flow) * .55;
  camH = cameraReady ? camH + angle(wantH - camH) * (1 - Math.exp(-dt * 3)) : wantH;
  if (state.phase === 'lobby') {
    const side = innerWidth < 700 ? 0 : 1.6;
    cameraGoal.set(q.x - Math.sin(camH) * 6.5 + Math.cos(camH) * 4.5, q.y + 3.2, q.z - Math.cos(camH) * 6.5 - Math.sin(camH) * 4.5);
    look.set(q.x + Math.cos(camH) * side, q.y + .9, q.z - Math.sin(camH) * side);
  } else {
    // Portrait phones look a little lower so the canoe clears the paddle panel.
    const tall = innerHeight > innerWidth, back = tall ? 9.5 : 8;
    cameraGoal.set(q.x - Math.sin(camH) * back, q.y + (tall ? 3.6 : 3.1), q.z - Math.cos(camH) * back);
    look.set(q.x + Math.sin(camH) * 7, q.y + (tall ? -1.6 : 1), q.z + Math.cos(camH) * 7);
  }
  if (state.slowmo > 0 && state.photo) {
    const line = RIVER.at(RIVER.LENGTH - 3.5, 0), side = RIVER.at(RIVER.LENGTH - 3.5, RIVER.halfWidth(RIVER.LENGTH - 3.5) - 2);
    cameraGoal.set(side.x, q.y + 1.6, side.z); look.set(line.x, q.y + .5, line.z);
    camera.position.copy(cameraGoal);
  }
  const floor = RIVER.groundAt(cameraGoal.x, cameraGoal.z) + 1.2; if (cameraGoal.y < floor) cameraGoal.y = floor;
  if (!cameraReady || camera.position.distanceTo(cameraGoal) > 30) { camera.position.copy(cameraGoal); cameraReady = true; } else camera.position.lerp(cameraGoal, 1 - Math.exp(-dt * 5));
  camera.lookAt(look);
  const wantFov = (focus.boost > 0 || (focus.paddle?.quality === 'remazo' && t - (focus.paddle?.last || 0) < 0.35)) ? 59 : 52;
  if (Math.abs(camera.fov - wantFov) > 0.05) {
    camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();
  }
  if (own?.boost > 0) setSpeedLines(0.75);
  // Raudal landings and bumps shake the camera a little.
  if (shake > 0) { shake = Math.max(0, shake - dt); const k = shake * shakePower; camera.position.x += (Math.random() - .5) * k; camera.position.y += (Math.random() - .5) * k; }
  sun.position.set(q.x - 40, q.y + 70, q.z + 30); sun.target.position.copy(q); sun.target.updateMatrixWorld();
  tickWind(elapsed, 0.9);
  world.world.update(elapsed, dt); world.world.cull(camera); world.world.race(state, t); world.sky.update(elapsed);
  fx.update(elapsed, boats.filter(b => b.id !== 'preview'), canoes, q, t);
  guide.update(RIVER, own && canoes.get(own.id) ? { ...own, x: canoes.get(own.id).group.position.x, z: canoes.get(own.id).group.position.z, h: canoes.get(own.id).group.rotation.y } : null, t, { on: state.options.guide && state.phase === 'racing', clock: elapsed });
  if (callTimer > 0) { callTimer -= dt; if (callTimer <= 0) $('call').classList.add('hidden'); }
  const steady = state.options.paddling === 'tap' || (autoHeld() && myRole() !== 'popa');
  $('ring').classList.toggle('hidden', steady);
  if (steady) $('next-key').textContent = autoHeld() ? 'W' : 'A / D';
  else if (state.phase === 'racing' || state.phase === 'countdown') drawRing(own, t);
  drawClock += dt; if (drawClock > .1) { updateUI(); drawClock = 0; }
  if (!quiet) renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Simulation runs at 20 Hz independent of rendering; guests send inputs at 20 Hz.
let simulationTime = performance.now();
const simulation = setInterval(() => { const now = performance.now(), dt = (now - simulationTime) / 1000; simulationTime = now; if (params.has('manual')) return; room.tick(dt, input(), paused && room.members.size <= 1); }, 50);
if (params.has('debug')) window.curiara = { room, get state() { return state; }, world, canoes, input, get RIVER(){return RIVER;}, updateUI, stroke, music,
  // Suites skip drawing while timing keys: software WebGL starves the tab.
  quiet(value) { quiet = !!value; },
  manual(value) { if (value) params.set('manual', ''); else params.delete('manual'); simulationTime = performance.now(); },
  step(seconds, controls) { for (let t = 0; t < seconds; t += .05) room.tick(.05, controls ? controls() : input()); updateUI(); },
  place(id, s, offset = 0) { const b = room.game.boatOf(id), q = RIVER.at(s, offset); Object.assign(b, { x: q.x, z: q.z, h: q.h, s, progress: s, checkpoint: RIVER.gates.filter(g => g <= s).length, v: 0, lat: 0, w: 0, y: RIVER.levelAt(s, offset), vy: 0, air: 0, tip: 0, capsized: 0, grace: 0, channel: 'main' }); room.publish(); } };
window.addEventListener('pagehide', () => { disposed = true; clearInterval(simulation); music.stop(); crewRoster.dispose(); roomOptions.dispose();room.dispose(); guide.dispose(); for (const c of canoes.values()) c.dispose(); world.world.dispose();fx.dispose(); world.sky.dispose(); unbind?.(); renderer.dispose(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });

await prepareScene(world);
