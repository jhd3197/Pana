import * as THREE from 'three';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton } from '/engine/touch.js';
import { bindRenderer, pixelRatio } from '/engine/settings.js';
import { RiverRoom } from './network.js';
import { standings, FORMATS, COLORS } from './rules.js';
import { RIVER, angle, formatTime } from './river.js';
import { PADDLE, grade } from './paddle.js';
import { createRaceScene } from './scene.js';
import { createCanoe } from './boat.js';
import { addLandscape } from './landscape.js';
import { createRiverFX } from './water-fx.js';

const $ = id => document.getElementById(id), params = new URLSearchParams(location.search), avatar = loadAvatar(), name = loadName();
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
let format = FORMATS[store.get('curiara:format')] ? store.get('curiara:format') : 'todos';
const code = roomFromUrl() || newRoomCode(); params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const keys = new Set(), touch = new Set(), canoes = new Map(), touchButtons = [];
let paused = false, state, world, ready = false, lastPhase = '', lastCountdown = '', lastRace = 0, drawClock = 0, disposed = false, snapshotAt = performance.now();
const room = new RiverRoom({ code, name, avatar, onState: s => { state = s; snapshotAt = performance.now(); }, onStatus: (message, error = false) => { $('connection').textContent = message; $('practice').classList.toggle('hidden', !error); if (error) showNotice(message); } });
state = room.state;

// Strokes keep the pana's own clock; the host maps them onto race time.
const strokes = [], local = { seq: 0, last: null, side: 0, splash: 0, streak: 0 };
const clock = () => performance.now() / 1000;
function clearInput() { keys.clear(); for (const b of touchButtons) b.release(); touch.clear(); }
const menu = createGameMenu({ title: 'Curiara', sound, orientation: 'horizontal', note: () => room.members.size > 1 ? 'La carrera sigue mientras abres el menú.' : 'La carrera está en pausa.',
  controls: [['A / ←', 'Remar a la izquierda'], ['D / →', 'Remar a la derecha'], ['A D A D', 'Alternar: recto y a toda'], ['D D / A A', 'Mismo lado: girar al lado contrario'], ['S / ↓', 'Ciar: frenar; con A o D, pivotar'], ['Espacio', '¡Salpicón! a la curiara de al lado'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: ['Rema justo cuando el anillo pasa por la zona dorada: ¡Remazo!', 'En Parejas, la proa rema y la popa lleva el timón (A/D sostenido), cía y lanza el salpicón. Si la popa toca A o D justo con la remada: ¡Ahora!'],
  invite: () => inviteUrl(code), actions: [{ id: 'local-race', label: 'Abrir carrera local', run: () => goLocal() }], onOpen() { paused = true; clearInput(); }, onClose() { paused = false; } });
const navButton = 'pk-btn pk-btn--sm game-menu-button';
$('game-nav').append(menu.createInviteButton({ id: 'invite', label: 'Invitar', className: navButton }), menu.createSoundButton({ id: 'sound', className: navButton }), menu.createButton({ id: 'menu', className: navButton }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', label: 'Invitar panas', className: 'pk-btn' }));
$('room-code').textContent = code.toUpperCase();
const coarse = matchMedia('(pointer:coarse)').matches;
function showNotice(text) { $('notice').textContent = text; $('notice').classList.remove('hidden'); clearTimeout(showNotice.timer); showNotice.timer = setTimeout(() => $('notice').classList.add('hidden'), 3000); }
function unlock() { try { sound.unlock(); } catch { /* audio blocked */ } }
function goLocal() { room.practice(); room.setFormat(format); $('practice').classList.add('hidden'); }

// What this pana does in its canoe: solo, proa (power) or popa (helm).
const myBoat = () => state.boats.find(b => b.crew.some(c => c.id === room.id));
const myRole = () => { const b = myBoat(); if (!b) return 'solo'; return b.crew.length === 1 ? 'solo' : b.crew.find(c => c.id === room.id).seat ? 'popa' : 'proa'; };

let callTimer = 0;
function call(text, kind = '') { const e = $('call'); e.textContent = text; e.className = `call ${kind}`; e.classList.remove('hidden'); void e.offsetWidth; callTimer = .9; }
function tock(power) { sound.tone(1180, 0, .045, 'triangle', .07 * power); sound.tone(590, .01, .07, 'sine', .08 * power); }
function stroke(side) {
  if (paused) return;
  unlock();
  const t = clock();
  strokes.push([++local.seq, side, t]); if (strokes.length > 8) strokes.shift();
  if (state.phase !== 'racing' && state.phase !== 'countdown') return;
  const role = myRole(), b = myBoat();
  if (!b || b.capsized > 0 || b.finish !== null) { local.last = t; local.side = side; return; }
  // Instant feedback from the same grading the host applies.
  if (role !== 'popa' && !keys.has('KeyS') && !keys.has('ArrowDown') && !touch.has('back')) {
    const gap = local.last == null ? Infinity : t - local.last, g = grade(gap, gap !== Infinity && side === local.side);
    local.streak = g.quality === 'remazo' ? local.streak + 1 : g.quality === 'chapoteo' || g.quality === 'arranque' ? 0 : local.streak;
    if (g.quality === 'remazo') { tock(1); call(local.streak >= 3 ? `¡Remazo ×${local.streak}!` : '¡Remazo!'); }
    else if (g.quality === 'chapoteo') { sound.sweep(900, 300, .12, 'triangle', .05); if (Math.random() < .5) call('¡Chapoteo!', 'is-soft'); }
    else sound.tone(420, 0, .05, 'triangle', .04);
  }
  local.last = t; local.side = side;
}
const STROKE_KEYS = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
window.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || paused) return;
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code in STROKE_KEYS || ['KeyS', 'ArrowDown', 'Space', 'KeyW', 'ArrowUp'].includes(e.code)) {
    e.preventDefault(); unlock();
    if (!e.repeat && e.code in STROKE_KEYS) stroke(STROKE_KEYS[e.code]);
    if (!e.repeat && e.code === 'Space') local.splash++;
    keys.add(e.code);
  }
});
window.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
for (const b of document.querySelectorAll('[data-stroke]')) touchButtons.push(holdButton(b, { paused: () => paused,
  down: () => { touch.add(`s${b.dataset.stroke}`); stroke(Number(b.dataset.stroke)); }, up: () => touch.delete(`s${b.dataset.stroke}`) }));
for (const b of document.querySelectorAll('[data-input]')) touchButtons.push(holdButton(b, { paused: () => paused,
  down: () => { touch.add(b.dataset.input); unlock(); if (b.dataset.input === 'splash') local.splash++; }, up: () => touch.delete(b.dataset.input) }));
function input() {
  if (paused) return { strokes: strokes.slice(), splash: local.splash };
  const left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.has('s-1'), right = keys.has('KeyD') || keys.has('ArrowRight') || touch.has('s1');
  return { strokes: strokes.slice(), back: keys.has('KeyS') || keys.has('ArrowDown') || touch.has('back'), steer: Number(right) - Number(left), splash: local.splash };
}

// Lobby: format and, in Parejas, the seat picker.
function chooseFormat(value) {
  format = value; store.set('curiara:format', value);
  for (const b of document.querySelectorAll('[data-format]')) b.setAttribute('aria-pressed', String(b.dataset.format === value));
  room.setFormat(value);
}
for (const b of document.querySelectorAll('[data-format]')) b.onclick = () => { if (room.isHost) chooseFormat(b.dataset.format); };
function drawSeats() {
  const grid = $('seats'), pairs = state.format === 'parejas';
  grid.classList.toggle('hidden', !pairs);
  $('format-copy').textContent = pairs ? 'Dos panas por curiara: la proa rema, la popa lleva el timón. Elige tu puesto.' : 'Una curiara por pana. Ocho curiaras en el agua.';
  for (const b of document.querySelectorAll('[data-format]')) { b.setAttribute('aria-pressed', String(b.dataset.format === state.format)); b.disabled = !room.isHost; }
  if (!pairs) { grid.replaceChildren(); return; }
  const key = JSON.stringify(state.players.map(p => [p.id, p.name, p.seat]));
  if (grid.dataset.key === key) return; grid.dataset.key = key;
  grid.replaceChildren(...Array.from({ length: FORMATS.parejas.boats }, (_, boat) => {
    const row = document.createElement('div'); row.className = 'seat-boat'; row.style.setProperty('--boat', COLORS[boat]);
    const dot = document.createElement('i'); row.append(dot);
    for (const pos of [0, 1]) {
      const who = state.players.find(p => p.seat && p.seat.boat === boat && p.seat.pos === pos), mine = who && who.id === room.id;
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('aria-pressed', String(!!mine)); button.disabled = !!who && !mine;
      button.textContent = who ? who.name : pos ? 'Popa' : 'Proa';
      const small = document.createElement('small'); small.textContent = pos ? 'timón' : 'remo'; button.append(small);
      button.setAttribute('aria-label', `Curiara ${boat + 1}, ${pos ? 'popa' : 'proa'}${who ? `, ${who.name}` : ''}`);
      button.onclick = () => room.chooseSeat(mine ? null : { boat, pos });
      row.append(button);
    }
    return row;
  }));
}
$('start').onclick = $('again').onclick = () => { unlock(); room.start($('bots').checked); };
$('practice').onclick = () => goLocal();

await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 30)));
world = createRaceScene($('world'), RIVER, { dress: addLandscape }); const { renderer, scene, camera, sun } = world;
renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
const fx = createRiverFX(RIVER); scene.add(fx.group);
$('map-length').textContent = `${Math.round(RIVER.LENGTH)} M`; $('stat-length').textContent = `${Math.round(RIVER.LENGTH)} m`;

// Minimap: the river's real shape, drawn once.
const mapCtx = $('map').getContext('2d'), MAP = { w: 140, h: 240 }, mapBase = document.createElement('canvas'); mapBase.width = MAP.w; mapBase.height = MAP.h;
const pts = [...RIVER.main.samples, ...(RIVER.branch?.path.samples || [])], bx = [Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x))], bz = [Math.min(...pts.map(p => p.z)), Math.max(...pts.map(p => p.z))];
const mapScale = Math.min((MAP.w - 20) / (bx[1] - bx[0] || 1), (MAP.h - 20) / (bz[1] - bz[0] || 1));
// North (upstream) at the top: larger z is drawn higher up.
const xy = (x, z) => [MAP.w / 2 + (x - (bx[0] + bx[1]) / 2) * mapScale, MAP.h / 2 - (z - (bz[0] + bz[1]) / 2) * mapScale];
{
  const c = mapBase.getContext('2d'); c.lineCap = c.lineJoin = 'round';
  const path = (samples, width, color) => { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); samples.forEach((p, i) => i ? c.lineTo(...xy(p.x, p.z)) : c.moveTo(...xy(p.x, p.z))); c.stroke(); };
  if (RIVER.branch) path(RIVER.branch.path.samples, 3, '#3d6a4a');
  path(RIVER.main.samples, 5, '#4f8f8a');
  for (const d of RIVER.drops) { const p = RIVER.at(d.s); c.fillStyle = '#e8f4f0'; c.fillRect(...xy(p.x, p.z).map(v => v - 2.5), 5, 5); }
  const end = RIVER.at(RIVER.LENGTH); c.fillStyle = '#ffc629'; c.beginPath(); c.arc(...xy(end.x, end.z), 4, 0, Math.PI * 2); c.fill();
}
function drawMap(own) {
  const c = mapCtx; c.clearRect(0, 0, MAP.w, MAP.h); c.drawImage(mapBase, 0, 0);
  for (const b of state.boats) { c.fillStyle = b.color; c.beginPath(); c.arc(...xy(b.x, b.z), b === own ? 4.5 : 2.8, 0, Math.PI * 2); c.fill(); if (b === own) { c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); } }
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
  if (myRole() === 'popa') return 'Sostén A o D para el timón. Toca justo con la remada: ¡Ahora!';
  if (b.whirl > .15) return '¡Remolino! Rema fuerte hacia afuera. Por el borde, la corriente te lleva.';
  if (b.boost > 0) return '¡La estela de las toninas te empuja!';
  if (b.eddy > .3) return 'Remanso: el agua te frena. Rema hacia el chorro.';
  const drop = RIVER.drops.find(d => b.s > d.s - d.span - 40 && b.s < d.s - d.span + 2);
  if (drop) return 'Raudal adelante: elige carril. El rápido cae de golpe; ¡llega recto!';
  if (b.channel === 'branch') return 'Atajo del igapó: corto, lento y lleno de troncos.';
  if (b.paddle?.quality === 'chapoteo') return 'Más despacio: alterna A y D con ritmo.';
  if (b.tip > 60) return 'Endereza la curiara: rema recto para calmarla.';
  return 'Alterna A y D. Rema cuando el anillo llegue a la zona dorada.';
}
// What just happened to this pana's canoe, from the snapshot's counters.
let seen = null;
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
  const lobby = state.phase === 'lobby', done = state.phase === 'finished', playing = !lobby && !done;
  document.body.classList.toggle('in-lobby', lobby); $('lobby').classList.toggle('hidden', !lobby); $('hud').classList.toggle('hidden', !playing); $('results').classList.toggle('hidden', !done);
  $('start').disabled = !room.connected || !room.isHost || !ready; $('start').firstChild.textContent = !room.connected ? 'Conectando… ' : room.isHost ? '¡Al agua! ' : 'Esperando al anfitrión… ';
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
  const loaded = own && own.splashCd <= 0; $('splash-state').textContent = loaded ? 'Salpicón listo' : `Salpicón ${Math.ceil(own?.splashCd || 0)} s`; $('splash-state').classList.toggle('is-ready', !!loaded);
  $('keys-hint').classList.toggle('hidden', role === 'popa');
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
    $('result-copy').textContent = own?.finish != null ? `${place}.º lugar · ${formatTime(own.finish)} · ${own.remazos} remazos · ${own.capsizes} vueltas de campana` : 'La próxima es tuya. Rema en ritmo y busca el chorro.';
    fillRoster($('result-board'), ordered.map((b, i) => ({ rank: i + 1, name: crewName(b) + (b.crew.every(c => c.bot || c.empty) ? ' · del río' : ''), detail: `${b.remazos} remazos${b.capsizes ? ` · volcó ${b.capsizes}` : ''}`, end: b.finish === null ? 'Sin llegar' : formatTime(b.finish), me: b === own })));
    if (lastPhase !== state.phase) sound.tone(660, 0, .25, 'triangle', .08);
  }
  lastPhase = state.phase; drawMap(own);
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
    cameraGoal.set(q.x - Math.sin(camH) * 8, q.y + 3.1, q.z - Math.cos(camH) * 8);
    look.set(q.x + Math.sin(camH) * 7, q.y + 1, q.z + Math.cos(camH) * 7);
  }
  const floor = RIVER.groundAt(cameraGoal.x, cameraGoal.z) + 1.2; if (cameraGoal.y < floor) cameraGoal.y = floor;
  if (!cameraReady || camera.position.distanceTo(cameraGoal) > 30) { camera.position.copy(cameraGoal); cameraReady = true; } else camera.position.lerp(cameraGoal, 1 - Math.exp(-dt * 5));
  camera.lookAt(look);
  // Raudal landings and bumps shake the camera a little.
  if (shake > 0) { shake = Math.max(0, shake - dt); const k = shake * shakePower; camera.position.x += (Math.random() - .5) * k; camera.position.y += (Math.random() - .5) * k; }
  sun.position.set(q.x - 40, q.y + 70, q.z + 30); sun.target.position.copy(q); sun.target.updateMatrixWorld();
  world.world.update(elapsed, dt); world.world.cull(camera); world.world.race(state, t); world.sky.update(elapsed);
  fx.update(elapsed, boats.filter(b => b.id !== 'preview'), canoes, q, t);
  if (callTimer > 0) { callTimer -= dt; if (callTimer <= 0) $('call').classList.add('hidden'); }
  if (state.phase === 'racing' || state.phase === 'countdown') drawRing(own, t);
  drawClock += dt; if (drawClock > .1) { updateUI(); drawClock = 0; }
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Simulation runs at 20 Hz independent of rendering; guests send inputs at 20 Hz.
let simulationTime = performance.now();
const simulation = setInterval(() => { const now = performance.now(), dt = (now - simulationTime) / 1000; simulationTime = now; if (params.has('manual')) return; room.tick(dt, input(), paused && room.members.size <= 1); }, 50);
if (params.has('debug')) window.curiara = { room, get state() { return state; }, world, canoes, input, RIVER, updateUI, stroke,
  manual(value) { if (value) params.set('manual', ''); else params.delete('manual'); simulationTime = performance.now(); },
  step(seconds, controls) { for (let t = 0; t < seconds; t += .05) room.tick(.05, controls ? controls() : input()); updateUI(); },
  place(id, s, offset = 0) { const b = room.game.boatOf(id), q = RIVER.at(s, offset); Object.assign(b, { x: q.x, z: q.z, h: q.h, s, progress: s, checkpoint: RIVER.gates.filter(g => g <= s).length, v: 0, lat: 0, w: 0, y: RIVER.levelAt(s, offset), vy: 0, air: 0, tip: 0, capsized: 0, grace: 0, channel: 'main' }); room.publish(); } };
window.addEventListener('pagehide', () => { disposed = true; clearInterval(simulation); room.dispose(); for (const c of canoes.values()) c.dispose(); world.world.dispose(); world.sky.dispose(); unbind?.(); renderer.dispose(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
