// Wiring only: input → rules (through the room) → Galipán scene and HUD.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';
import { holdButton, drawIcons } from '/engine/touch.js';
import { sound } from '/engine/fx.js';
import { createToast } from '/engine/hud.js';
import { createMusic } from '/engine/music.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { createRoomOptions } from '/engine/room-options.js';
import { ParapenteRoom } from './network.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';
import { standings, SLOTS } from './rules.js';
import { targetOf } from './course.js';
import { galipanCourse } from './galipan.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode(), notice = createToast($('event'), { ms: 3000 }), music = createMusic(sound);
let world = null, state = null, paused = false, quiet = false;
const room = new ParapenteRoom({ code, name: loadName(), avatar: loadAvatar(), onState: s => { state = s; world?.update(s, room); },
  onNotice: text => notice(text),
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; if (failed) notice(text); },
});
state = room.state;
const roomOptions = createRoomOptions($('room-options'), { title: 'Parapente', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ title: 'Parapente · Pana', sound, orientation: 'libre',
  pad: { move: 'wasd', keys: { rt: ['KeyW', 'Acelerador'], a: ['KeyW', 'Acelerador'], lt: ['KeyS', 'Frenos'], b: ['KeyS', 'Frenos'], x: ['Space', 'Orejas'], rb: ['Space', 'Orejas'] } },
  note: () => room.members.size > 1 ? 'El vuelo sigue mientras estás en el menú.' : 'El vuelo está en pausa.',
  controls: [['A D / ← →', 'Girar la vela'], ['W / ↑', 'Acelerador: más rápido, bajas más'], ['S / ↓', 'Frenos: más lento y giro cerrado'], ['Espacio', 'Orejas: bajar rápido'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: ['Pasa las balizas en orden: entra en el cilindro a cualquier altura.', 'Las térmicas (polvo dorado y zamuros dando vueltas) te suben: gira cerrado con frenos dentro.', 'Con altura de sobra, el acelerador gana tiempo; sin altura, te deja en el suelo.', 'Los aros dorados te empujan unos segundos.', 'Al final, baja con orejas o en espiral y aterriza en la diana de Boca de Tigre.'],
  invite: () => room.offline ? null : inviteUrl(code), actions: [{ id: 'local-flight', label: 'Abrir vuelo local', run: () => room.practice() }],
  onOpen() { paused = true; clearInput(); if (room.members.size <= 1) music.pause(); }, onClose() { paused = false; music.resume(); },
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--sm' }), menu.createSoundButton({ id: 'sound', className: 'pk-btn pk-btn--sm' }), menu.createButton({ id: 'menu', className: 'pk-btn pk-btn--sm' }));
$('rules').onclick = () => menu.open('controls');
const unlock = () => { try { sound.unlock(); } catch { /* audio blocked */ } };
$('start').onclick = $('again').onclick = () => { unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();

// Keyboard, gamepad (through the menu's pad map) and touch feed one set of held controls.
const keys = new Set(), touch = new Set(), buttons = [];
const KEYS = ['KeyW', 'ArrowUp', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight', 'KeyS', 'ArrowDown', 'Space'];
function clearInput() { keys.clear(); touch.clear(); for (const b of buttons) b.release(); }
addEventListener('keydown', (event) => {
  if (paused || roomOptions.isOpen || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (event.code === 'KeyM' && !event.repeat) { toggleMute(); return; }
  if (!KEYS.includes(event.code)) return;
  event.preventDefault(); unlock(); keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
drawIcons();
for (const b of document.querySelectorAll('[data-input]')) buttons.push(holdButton(b, { paused: () => paused, down: () => { unlock(); touch.add(b.dataset.input); }, up: () => touch.delete(b.dataset.input) }));
const held = (name, ...codes) => touch.has(name) || codes.some(c => keys.has(c));
function input() {
  if (paused) return {};
  return { steer: Number(held('right', 'KeyD', 'ArrowRight')) - Number(held('left', 'KeyA', 'ArrowLeft')), bar: held('bar', 'KeyW', 'ArrowUp'), brake: held('brake', 'KeyS', 'ArrowDown'), ears: held('ears', 'Space') };
}

const clock = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const metres = n => `${Math.max(0, Math.round(n))} m`;
let callTimer = 0;
function call(text, kind = '') { const e = $('call'); e.textContent = text; e.className = `call ${kind}`; e.hidden = false; callTimer = 1.1; }
function tip(p, course) {
  if (!p) return 'Miras el vuelo: vuelas en el próximo.';
  if (p.finish !== null) return p.penalty > 0 ? `Aterrizaste a ${Math.round(p.miss)} m del centro: +${p.penalty.toFixed(1)} s. Esperando a tus panas.` : '¡En la diana! Esperando a tus panas.';
  if (p.down > 0) return 'Aterrizaje forzoso. Te suben otra vez sobre la última baliza…';
  const last = p.beacon >= course.beacons.length, to = targetOf(course, p.beacon), dist = Math.hypot(to.x - p.x, to.z - p.z), agl = p.y - (last ? course.landing.y : course.groundAt(to.x, to.z));
  if (p.lift > 1.5) return 'Estás en una térmica: gira cerrado con frenos (S + A o D) y sube.';
  if (last && agl / Math.max(1, dist) > .35) return 'Muy alto para la diana: orejas (Espacio) o una espiral para bajar.';
  if (last) return 'Directo a la diana de Boca de Tigre. Frena justo antes de tocar el suelo.';
  if (agl < dist / 10) return 'Vas bajo para la próxima baliza: busca el polvo dorado de una térmica.';
  if (p.bar) return 'Acelerador a fondo: más rápido, pero bajas más.';
  return `Rumbo a ${to.name}. Con altura de sobra, el acelerador (W) gana tiempo.`;
}
// What just happened to this pana's wing, from the snapshot's counters.
let seen = null, lastLift = 0, varioClock = 0, lastPhase = '', lastCount = '', lastRace = 0;
function events(p) {
  if (!p) { seen = null; return; }
  const now = { beacon: p.beacon, rings: p.rings.length, downs: p.downs, finish: p.finish };
  if (seen) {
    if (now.finish !== null && seen.finish === null) { call(p.penalty > 0 ? '¡Aterrizaste!' : '¡En la diana!', 'is-lift'); sound.tone(880, 0, .2, 'triangle', .08); sound.tone(1320, .15, .3, 'triangle', .08); }
    else if (now.downs > seen.downs) { call('¡Aterrizaje forzoso!', 'is-soft'); sound.bonk(.8); }
    else if (now.beacon > seen.beacon) { call(`¡Baliza ${now.beacon}!`); sound.tone(990, 0, .12, 'square', .06); }
    else if (now.rings > seen.rings) { call('¡Aro!', 'is-lift'); sound.whoosh(); }
  }
  if (p.lift > 2 && lastLift <= 2) call('¡Térmica!', 'is-lift');
  lastLift = p.lift; seen = now;
}
// The variometer: beeps faster and higher the harder you climb.
function vario(p, dt) {
  if (!p || p.finish !== null || p.down > 0 || state.phase !== 'racing' || paused) return;
  varioClock -= dt;
  if (p.vy > .4 && varioClock <= 0) { sound.tone(520 + p.vy * 90, 0, .07, 'sine', .05); varioClock = Math.max(.12, .55 - p.vy * .07); }
}

function render() {
  const s = state, lobby = s.phase === 'lobby', done = s.phase === 'finished', playing = !lobby && !done, course = world?.course ?? galipanCourse(s.options);
  roomOptions.update(s.options, room.isHost && room.connected && (lobby || done));
  if (!lobby && !done && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = !playing; $('results').hidden = !done;
  const full = s.players.length > SLOTS;
  $('start').disabled = !world || !room.connected || !room.isHost || full;
  $('start').textContent = !room.connected ? 'Conectando…' : full ? 'Máximo 8 pilotos' : room.isHost ? '¡A volar!' : 'Espera al anfitrión';
  $('again').disabled = !room.connected || !room.isHost; $('again').textContent = room.isHost ? 'Otro vuelo' : 'Esperando al anfitrión…';
  if (lobby) fillRoster($('roster'), s.players.map((p, i) => ({ rank: i + 1, name: p.id === room.id ? `${p.name} · tú` : p.name, detail: p.id === room.hostId ? 'Anfitrión' : 'Pana', end: '', me: p.id === room.id })));
  const shown = s.pilots.find(p => p.id === room.id), own = shown && (room.predicted ?? shown), order = standings(s), place = shown ? order.indexOf(shown) + 1 : 0;
  $('place').textContent = place ? `${place}.º` : '—'; $('field').textContent = `de ${order.length}`;
  $('timer').textContent = clock(own?.finish ?? s.time);
  const to = own && targetOf(course, own.beacon), last = own && own.beacon >= course.beacons.length;
  $('next').textContent = !own ? 'Mirando' : own.finish !== null ? 'Aterrizado' : `${last ? 'Diana' : `Baliza ${own.beacon + 1}`} · ${to.name} · ${metres(Math.hypot(to.x - own.x, to.z - own.z))}`;
  $('altitude').textContent = metres(own?.agl ?? 0);
  const vy = own?.vy ?? 0; $('vario').textContent = `${vy > 0 ? '+' : ''}${vy.toFixed(1).replace('.', ',')}`;
  $('vario').classList.toggle('is-up', vy > .3); $('vario').classList.toggle('is-down', vy < -2.5);
  $('speed').textContent = `${Math.round((own?.v ?? 0) * 3.6)} km/h`;
  $('wing-state').textContent = !own ? '' : own.boost > 0 ? '¡Empuje del aro!' : own.ears ? 'Orejas: bajando rápido' : own.bar ? 'Acelerador a fondo' : own.brake ? 'Frenos' : 'Vela en trim';
  $('tip').textContent = tip(own, course);
  $('leaderboard').replaceChildren(...order.map((p, i) => {
    const li = document.createElement('li'); li.className = p === shown ? 'pk-row is-me' : 'pk-row';
    const n = document.createElement('b'); n.className = 'pk-row-n'; n.textContent = i + 1;
    const dot = document.createElement('i'); dot.className = 'wing-dot'; dot.style.setProperty('--wing', p.color);
    const name = document.createElement('span'); name.className = 'row-name'; name.textContent = p.name + (p === shown ? ' · tú' : '');
    const end = document.createElement('span'); end.className = 'pk-row-end'; end.textContent = p.finish !== null ? clock(p.finish) : p.down > 0 ? 'en tierra' : `${p.beacon}/${course.beacons.length}`;
    li.append(n, dot, name, end); return li;
  }));
  const count = s.phase === 'countdown' ? String(Math.max(1, Math.ceil(s.countdown))) : s.phase === 'racing' && s.time < .8 ? '¡A VOLAR!' : '';
  $('countdown').hidden = !count; $('countdown').textContent = count;
  if (count && count !== lastCount) sound.tone(count.length > 1 ? 740 : 370, 0, .12, 'triangle', .06);
  lastCount = count;
  if (s.raceId !== lastRace) { lastRace = s.raceId; seen = null; clearInput(); }
  if (playing) events(own);
  if (done && lastPhase !== 'finished') {
    $('result-title').textContent = place === 1 ? '¡Ganaste el vuelo, pana!' : shown?.finish != null ? '¡Aterrizaste, pana!' : '¡Se cerró el vuelo!';
    $('result-copy').textContent = shown?.finish != null ? `${place}.º lugar · ${clock(shown.finish)} · ${shown.rings.length} aros${shown.penalty ? ` · +${shown.penalty.toFixed(1)} s fuera de la diana` : ''}` : 'La próxima es tuya: sube en las térmicas y baja en la diana.';
    fillRoster($('result-roster'), order.map((p, i) => ({ rank: i + 1, name: p.name + (p.bot ? ' · del cerro' : ''), detail: `${p.beacon}/${course.beacons.length} balizas · ${p.rings.length} aros${p.downs ? ` · ${p.downs} en tierra` : ''}`, end: p.finish === null ? 'Sin aterrizar' : clock(p.finish), me: p === shown })));
    sound.tone(660, 0, .25, 'triangle', .08);
  }
  if (s.phase === 'racing' && !music.playing && !paused) music.play('derrape-salto', { fallback: 'andina' });
  if (!playing && music.playing) music.stop();
  lastPhase = s.phase;
}

render(); room.connect();
let uiClock = 0;
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createParapenteScene($('world'), { course: galipanCourse }),
  ready: (created) => { world = created; world.update(state, room); render(); },
  tickMs: 50,
  tick: (dt) => room.tick(dt, input(), paused && room.members.size <= 1),
  frame: (dt, scene) => {
    if (!quiet) scene.frame(dt);
    const shown = state.pilots.find(p => p.id === room.id);
    vario(shown && (room.predicted ?? shown), dt);
    if (callTimer > 0 && (callTimer -= dt) <= 0) $('call').hidden = true;
    if ((uiClock += dt) > .1) { uiClock = 0; render(); }
  },
  dispose: () => { music.stop(); roomOptions.dispose(); room.dispose(); },
});
if (params.has('debug')) window.parapenteDebug = { room, menu, input, render, get state() { return state; }, get world() { return world; },
  // Suites skip drawing while timing keys: software WebGL starves the tab.
  quiet(value) { quiet = !!value; } };
