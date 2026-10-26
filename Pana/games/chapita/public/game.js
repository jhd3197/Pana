// Wiring only: input → rules (through the room) → scene and HUD. The pitch
// and hit clocks start when this screen first sees the chapita leave, so a
// batter's swing and a fielder's catch are timed against what they saw.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { createRoomOptions } from '/engine/room-options.js';
import { ChapitaRoom } from './network.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';
import { ChapitaGame, roleOf } from './rules.js';
import { HEIGHT_TEXT, ROWS } from './field.js';
import { renderScoreboard, renderLobbyRoster, renderResults, matchupText, eventText, shout, SHOUTS } from './hud.js';
import { loc, locKey } from '/engine/i18n.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
let world = null;
// The pitcher's choice stays on this screen until the throw: nobody sees it.
const pick = { kind: 'planea', side: 1, cap: 'plana', row: 1, col: 1, height: 'medio' };
const clocks = { pitch: null, pitchId: 0, hit: null, hitId: 0 };
let swungFor = 0, caughtFor = 0, lastEvent = 0, pitchDeadline = 0;
// The palo follows the pitch's height on its own; W/S (or a tap) takes over
// for that one pitch. Three ticks count the batter in: the third is the moment.
let manualFor = -1, beats = { id: 0, n: 0 };
const nextPitchId = (s) => s.phase === 'flight' && s.pitch ? s.pitch.id : s.pitches + 1;
const swingHeight = (s) => manualFor === s.pitch?.id || !s.pitch?.arrives ? pick.height : s.pitch.arrives;
const BEATS = [-.5, -.25, 0];

const room = new ChapitaRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: 'Chapita', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ pad: { buttons: true, keys: { x: ['Space', loc('Lanzar, batear o atrapar')], rt: ['Space', loc('Lanzar, batear o atrapar')], lb: ['KeyQ', loc('Curva a la izquierda')], rb: ['KeyE', loc('Curva a la derecha')], y: ['KeyC', loc('Chapita plana o doblada')] } }, title: loc('Chapita · Pana'), sound, orientation: 'libre',
  note: () => room.members.size > 1 ? loc('La caimanera sigue mientras estás en el menú.') : loc('La caimanera está en pausa. Los bots te esperan.'),
  controls: [['1 · 2 · 3', loc('Planea, cae de golpe o curva (pitcher)')], [loc('Flechas'), loc('Apuntar: alto, medio, bajo; izquierda o derecha')], ['Q · E', loc('Hacia dónde rompe la curva')], ['C', loc('Chapita plana o doblada')],
    ['W · S', loc('Cambiar la altura del palo (si no, va sola)')], [loc('Espacio'), loc('Lanzar, batear o atrapar')], ['Z', loc('Batear de zurdo')], ['M', loc('Activar o silenciar el sonido')]],
  tips: [loc('Al bate, mira el aro en el plato: otro aro se va cerrando y se pone verde cuando llega la chapita. Batea ahí, en el tercer tic. El palo busca la altura solo.'),
    loc('Donde cae es el batazo: pasar la acera es sencillo, el carro es doble, el poste es triple y por encima de las casas, ¡jonrón!'),
    loc('Si no llega a la acera, es out. Si un pana la atrapa en el aire, también. Fallar una atrapada de cerca es un chapazo… y sale un tuyuyo.'),
    loc('El cuarto bate tiene más chance. Poncharte dos veces y pegarle a la tercera es un Willy Mays. Los bots de vieja escuela tiran muchas que caen; los de nueva escuela, curvas.')],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');
$('start').onclick = $('again').onclick = () => { sound.unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();
$('switch').onclick = () => room.action('switch');
$('hand').onclick = () => room.action('hand');
$('throw').onclick = () => throwPitch();
$('swing').onclick = () => swingNow();
$('catch').onclick = () => catchNow();
for (const r of [0, 1, 2]) for (const c of [0, 1, 2]) {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.row = r; b.dataset.col = c;
  b.setAttribute('aria-label', `${loc(HEIGHT_TEXT[ROWS[r]])}, ${loc([locKey('izquierda'), locKey('centro'), locKey('derecha')][c])}`);
  b.onclick = () => choose({ row: r, col: c }); $('aim').append(b);
}
document.querySelectorAll('[data-kind]').forEach(b => { b.onclick = () => choose({ kind: b.dataset.kind }); });
document.querySelectorAll('[data-side]').forEach(b => { b.onclick = () => choose({ side: Number(b.dataset.side) }); });
document.querySelectorAll('[data-cap]').forEach(b => { b.onclick = () => choose({ cap: b.dataset.cap }); });
document.querySelectorAll('[data-height]').forEach(b => { b.onclick = () => chooseHeight(b.dataset.height); });

const mySeat = () => room.seat;
const role = () => roleOf(room.state, mySeat());
function choose(patch) { Object.assign(pick, patch); sound.unlock(); sound.tick?.(1); render(room.state); }
function chooseHeight(height) { manualFor = nextPitchId(room.state); choose({ height }); }

function throwPitch() {
  const s = room.state;
  if (menu.isOpen || s.phase !== 'pitch' || role() !== 'pitcher' || s.hold) return;
  sound.unlock(); room.action('throw', { pitch: { kind: pick.kind, row: pick.row, col: pick.col, side: pick.side, cap: pick.cap } });
}
function swingNow() {
  const s = room.state;
  if (menu.isOpen || s.phase !== 'flight' || role() !== 'batter' || swungFor === s.pitch.id || !clocks.pitch) return;
  swungFor = s.pitch.id; sound.unlock();
  const t = (performance.now() - clocks.pitch) / 1000, height = swingHeight(s);
  world?.swing(mySeat());
  world?.swingFeedback(t - s.pitch.time, ChapitaGame.prototype.window.call(s, s.batter, s.pitch), height === s.pitch.arrives || !s.pitch.arrives);
  room.action('swing', { pitch: s.pitch.id, height, t });
  render(s);
}
function catchNow() {
  const s = room.state, hit = s.hit;
  if (menu.isOpen || s.phase !== 'hit' || hit?.chance?.seat !== mySeat() || caughtFor === hit.id || !clocks.hit) return;
  caughtFor = hit.id; sound.unlock();
  room.action('catch', { hit: hit.id, t: (performance.now() - clocks.hit) / 1000 });
  render(s);
}

function play(event) {
  const k = event.kind;
  if (k === 'jonron') { sound.bonk(1.4); [523, 659, 784, 1047].forEach((f, i) => sound.tone(f, i * .09, .16, 'triangle', .1)); }
  else if (k === 'contact') sound.bonk(1);
  else if (['strike', 'out'].includes(k)) sound.tone(180, 0, .12, 'square', .07);
  else if (k === 'chapazo') sound.boing();
  else if (k === 'window') sound.horn?.('cucaracha');
  else if (['car', 'post', 'sencillo', 'wall'].includes(k)) [440, 660].forEach((f, i) => sound.tone(f, i * .08, .12, 'triangle', .08));
}

function render(state) {
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished', seat = mySeat(), me = state.players[seat];
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby;
  document.body.dataset.phase = state.phase;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? loc('¡Play ball!') : loc('Espera al anfitrión');
  renderLobbyRoster(state, room.id);
  $('switch').disabled = !me || !room.connected; $('hand').disabled = !me || !room.connected;
  $('hand').setAttribute('aria-pressed', String(!!me?.zurdo));

  // The clocks start the first time this screen sees a pitch or a hit.
  const now = performance.now();
  if (state.phase === 'flight' && state.pitch && state.pitch.id !== clocks.pitchId) { clocks.pitchId = state.pitch.id; clocks.pitch = now; }
  if (state.hit && state.hit.id !== clocks.hitId && state.phase === 'hit') { clocks.hitId = state.hit.id; clocks.hit = now; }
  if (state.phase === 'pitch') pitchDeadline = now + Math.max(0, state.deadline - state.clock) * 1000;

  if (!lobby) {
    renderScoreboard(state);
    $('matchup').textContent = ended ? '' : state.hold === 'senora' ? loc('¡La señora está gritando! Esperen…') : state.hold === 'carro' ? loc('¡Carro! Tiempo, tiempo…') : matchupText(state, seat);
    const r = role(), live = room.connected && !ended;
    const pitching = live && r === 'pitcher' && state.phase === 'pitch';
    $('pitch-panel').hidden = !pitching;
    if (pitching) {
      document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === pick.kind)));
      document.querySelectorAll('[data-side]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.side) === pick.side)));
      document.querySelectorAll('[data-cap]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cap === (state.options.caps === 'libre' ? pick.cap : state.options.caps))));
      $('sides').hidden = pick.kind !== 'curva'; $('caps').hidden = state.options.caps !== 'libre';
      document.querySelectorAll('#aim button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.row) === pick.row && Number(b.dataset.col) === pick.col)));
      $('throw').disabled = !!state.hold;
    }
    const batting = live && r === 'batter' && ['pitch', 'flight'].includes(state.phase);
    $('bat-panel').hidden = !batting;
    if (batting) {
      const shown = state.phase === 'flight' && state.pitch ? swingHeight(state) : manualFor === nextPitchId(state) ? pick.height : null;
      document.querySelectorAll('[data-height]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.height === shown)));
      $('swing').disabled = state.phase !== 'flight' || swungFor === state.pitch?.id;
      $('bat-title').textContent = state.phase === 'pitch' ? loc('Al bate: lee al pitcher') : loc('¡Ahí viene!');
      $('bat-count').textContent = `${state.balls}-${state.strikes}`;
    }
    const chance = state.hit?.chance;
    $('catch-panel').hidden = !(live && state.phase === 'hit' && chance?.seat === seat && state.hit.caught === null && caughtFor !== state.hit.id);
  }
  if (state.event && state.event.n !== lastEvent) {
    const first = lastEvent === 0; lastEvent = state.event.n;
    if (!first) {
      $('event').textContent = eventText(state.event);
      const s = SHOUTS[state.event.kind]; if (s) shout(s[0], s[1]);
      play(state.event);
    }
  }
  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;
  if (ended) renderResults(state, room.id);
  world?.update(state, clocks, seat);
}

// The pitch clock and the fielder's closing circle move every frame.
function hudFrame() {
  const s = room.state, now = performance.now();
  if (!$('pitch-panel').hidden) {
    const left = Math.max(0, (pitchDeadline - now) / 1000);
    $('pitch-clock').textContent = s.hold ? loc('¡Tiempo!') : `${Math.ceil(left)} s`;
    $('pitch-clock').classList.toggle('hurry', left < 5);
  }
  if (!$('bat-panel').hidden) {
    const flying = s.phase === 'flight' && clocks.pitch && swungFor !== s.pitch?.id;
    $('bat-timing').hidden = !flying;
    if (flying) {
      const elapsed = (now - clocks.pitch) / 1000, pitch = s.pitch;
      const window = ChapitaGame.prototype.window.call(s, s.batter, pitch), duration = pitch.time + window;
      $('bat-timing').style.setProperty('--zone-start', `${(pitch.time - window) / duration * 100}%`);
      $('bat-timing').style.setProperty('--zone-width', `${2 * window / duration * 100}%`);
      $('bat-timing').style.setProperty('--progress', `${Math.min(99, elapsed / duration * 100)}%`);
      const cue = Math.abs(elapsed - pitch.time) <= window ? loc('¡Ahora!') : elapsed < pitch.time ? loc('Batea cuando el aro se cierre') : loc('Se pasó');
      $('bat-cue').textContent = pitch.arrives ? loc('{cue} · palo {height}', { cue, height: loc(HEIGHT_TEXT[swingHeight(s)]).toLowerCase() }) : loc('Fuera de zona: déjala pasar');
      // Tick, tick, TOCK: the third beat lands right on the arrival.
      if (beats.id !== pitch.id) beats = { id: pitch.id, n: 0 };
      while (beats.n < BEATS.length && elapsed >= pitch.time + BEATS[beats.n]) {
        if (pitch.arrives && elapsed - (pitch.time + BEATS[beats.n]) < .08) sound.tone(beats.n === 2 ? 1320 : 880, 0, beats.n === 2 ? .09 : .05, 'triangle', beats.n === 2 ? .12 : .07);
        beats.n++;
      }
    } else $('bat-cue').textContent = s.phase === 'pitch' ? loc('Mira el aro en el plato: batea cuando se cierre') : loc('Batazo enviado');
  }
  if (!$('catch-panel').hidden && s.hit?.chance && clocks.hit) {
    const left = s.hit.chance.t - (now - clocks.hit) / 1000;
    $('catch-closing').style.setProperty('--closing', String(Math.max(.4, 1 + left * 2.2)));
  }
}

addEventListener('keydown', (event) => {
  if (menu.isOpen || event.repeat || event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase(), r = role(), s = room.state;
  if (key === 'm') toggleMute();
  if (key === 'z' && s.phase === 'lobby') room.action('hand');
  if (r === 'pitcher' && s.phase === 'pitch') {
    if (['1', '2', '3'].includes(key)) choose({ kind: ['planea', 'cae', 'curva'][Number(key) - 1] });
    if (key === 'q') choose({ side: -1 }); if (key === 'e') choose({ side: 1 });
    if (key === 'c' && s.options.caps === 'libre') choose({ cap: pick.cap === 'plana' ? 'doblada' : 'plana' });
    const move = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[key];
    if (move) { event.preventDefault(); choose({ row: Math.max(0, Math.min(2, pick.row + move[0])), col: Math.max(0, Math.min(2, pick.col + move[1])) }); }
  }
  if (r === 'batter') {
    const i = ROWS.indexOf(pick.height);
    if (key === 'w' || key === 'arrowup') { event.preventDefault(); chooseHeight(ROWS[Math.max(0, i - 1)]); }
    if (key === 's' || key === 'arrowdown') { event.preventDefault(); chooseHeight(ROWS[Math.min(2, i + 1)]); }
  }
  if (event.code === 'Space' && !event.target.closest?.('button, a')) {
    event.preventDefault();
    if (s.phase === 'pitch') throwPitch(); else if (s.phase === 'flight') swingNow(); else if (s.phase === 'hit') catchNow();
  }
});

render(room.state); room.connect();
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createChapitaScene($('world')),
  ready: (created) => { world = created; render(room.state); },
  tick: (dt) => room.tick(dt, menu.isOpen && room.members.size <= 1),
  frame: (dt, scene) => { hudFrame(); scene.frame(dt); },
  dispose: () => room.dispose(),
});
if (params.has('debug')) window.chapitaDebug = { room, menu, pick, clocks, get world() { return world; } };
