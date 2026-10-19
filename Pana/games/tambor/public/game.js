// Wiring only: keys → the local judge (against my own music) → counters in
// the room's input; snapshots → the music, the scene and the HUD.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';
import { holdButton, drawIcons } from '/engine/touch.js';
import { sound } from '/engine/fx.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { createRoomOptions } from '/engine/room-options.js';
import { TamborRoom } from './network.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';
import { rankPlayers } from './rules.js';
import { songFor, secondsPerBeat } from './songs.js';
import { Judge } from './judge.js';
import { createTambor, SPOKEN } from './beat.js';
import { createHud } from './hud.js';
import { createCalibration, loadLatency } from './calibrate.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
const SHOUTED = new Set(['kick', 'enter', 'relevo', 'duelo', 'song', 'golpe', 'end', 'final', 'mcp', 'entrar']);
const SPOKEN_EVENTS = new Set(['kick', 'enter', 'relevo', 'duelo', 'golpe', 'final']);
let world = null, latency = loadLatency(), seenEvent = null, seenCall = null, lastView = '', quiet = false;
const judge = new Judge(), tambor = createTambor(sound), holds = new Map();
const room = new TamborRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: 'La Rueda de Tambor', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ title: 'La Rueda de Tambor · Pana', sound, orientation: 'libre',
  note: () => room.members.size > 1 ? 'La rueda sigue sonando mientras estás en el menú.' : 'La rueda está en pausa.',
  controls: [['← → (o F J)', 'Mano: un cuero con cada mano'], ['Espacio', 'Palo, charrasca y caracol (mantén en las notas largas)'],
    ['← → ↑ ↓ y Espacio', 'Bailar lo que canta el MCP'], ['Espacio', 'En la gente: aplaudir en el golpe'], ['1 – 4', 'Echar un dicho'],
    ['Q', '¡Quiero entrar! (una vez por canción)'], ['E', 'Relevo: entrar al centro en el ¡Golpe!'], ['M', 'Activar o silenciar el sonido']],
  tips: [
    'Cada quien oye la música en su compu y se juzga contra ella: el retraso de Discord no importa. Ajusta el golpe una vez en la sala.',
    'Los tamboreros llenan el Sabor. Con mucho Sabor el MCP canta con calma; si el tambor se cae, los llamados vienen más rápido y más apretados.',
    'Los bailadores siguen al MCP: ¡Cadera!, ¡Vuelta!, ¡Pañuelo!, ¡Pégate!, ¡Abajo! y ¡Golpe!. Tres fallas y te saca de la rueda.',
    'En la gente aplaude en el golpe: la Bulla le da más tiempo a los que bailan.',
    'Al final de cada canción los tamboreros y la gente cambian de lugar. Todos bailan.',
  ],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');
$('start').onclick = $('again').onclick = () => { sound.unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();
const hud = createHud($, { onDicho: (i) => room.action('dicho', { i }) });
const calibration = createCalibration($, { sound, voices: tambor.voices, onDone: (ms) => { latency = ms; showLatency(); } });
$('calibrate').onclick = () => calibration.open();
function showLatency() { $('latency').textContent = latency ? `Ajuste: ${latency > 0 ? '+' : ''}${latency} ms` : 'Sin ajustar'; }
showLatency();

// My song time in seconds; `raw` keeps the latency in (for visuals in step with the sound).
function songTime(raw = false) {
  const s = room.state.song;
  return s ? (room.clock() - s.startAt) / 1000 - (raw ? 0 : latency / 1000) : null;
}
const me = () => room.state.players.find(p => p.id === room.id);

// ---------- input ----------
function press(key) {
  sound.unlock();
  const t = songTime();
  if (t == null || room.state.phase !== 'song' || menu.isOpen) return;
  const result = judge.press(key, t), p = me();
  if (!result || !p) return;
  if (result.kind === 'drum') {
    if (p.station === 'charrasca' || p.station === 'caracol') { holds.get(key)?.stop(); holds.set(key, tambor.hit(p.station)); world?.mine('hold'); }
    else { tambor.hit(p.station, result.lane); world?.mine('drum', result.lane); }
  }
  if (result.kind === 'tap') { tambor.hit('tap', result.lane); world?.mine('tap', result.lane); }
  if (result.kind === 'clap') { tambor.hit('clap'); world?.mine('clap'); }
  if (result.kind === 'dance') { tambor.hit('stomp'); if (result.grade === 'miss') world?.markMiss(result.id); }
}
function release(key) {
  holds.get(key)?.stop(); holds.delete(key); world?.mine('release');
  const t = songTime();
  if (t == null || room.state.phase !== 'song') return;
  const result = judge.release(key, t);
  if (result?.kind === 'dance' && result.grade === 'miss') world?.markMiss(result.id);
}
function wantIn() { if (room.state.phase === 'song') room.action('entrar'); }
function jump() {
  const t = songTime(), p = me();
  if (t == null || room.state.phase !== 'song' || room.state.options.mode !== 'relevo' || p?.role !== 'crowd' || p.benched) return;
  room.action('jump', judge.jump(t)); tambor.hit('stomp');
}

const KEYS = { arrowleft: 'left', a: 'left', f: 'left', arrowright: 'right', d: 'right', j: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', ' ': 'space' };
addEventListener('keydown', (event) => {
  if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const key = event.key.toLowerCase();
  if (calibration.isOpen) { if (key === ' ') { event.preventDefault(); if (!event.repeat) calibration.tap(); } return; }
  if (menu.isOpen) return;
  if (key === 'm' && !event.repeat) toggleMute();
  if (KEYS[key]) { event.preventDefault(); if (!event.repeat) press(KEYS[key]); }
  if (event.repeat) return;
  if (key === 'q') wantIn();
  if (key === 'e') jump();
  if (/^[1-4]$/.test(key) && room.state.phase !== 'lobby') room.action('dicho', { i: Number(key) - 1 });
});
addEventListener('keyup', (event) => { const key = KEYS[event.key.toLowerCase()]; if (key) release(key); });
addEventListener('blur', () => { for (const key of [...holds.keys()]) release(key); });
addEventListener('pointerdown', () => sound.unlock(), { once: true });
drawIcons();
for (const [id, key] of [['t-left', 'left'], ['t-right', 'right'], ['t-up', 'up'], ['t-down', 'down'], ['t-space', 'space']]) {
  holdButton($(id), { down: () => press(key), up: () => release(key), paused: () => menu.isOpen });
}
$('clap').addEventListener('pointerdown', (e) => { e.preventDefault(); press('space'); release('space'); });
$('want-in').onclick = wantIn;
$('jump').onclick = jump;

// ---------- snapshots ----------
function react(state) {
  const events = state.events || [], calls = state.calls || [];
  // A fresh page doesn't replay what happened before it arrived.
  if (seenEvent == null) { seenEvent = events.at(-1)?.n ?? 0; seenCall = calls.reduce((m, c) => Math.max(m, c.id), 0); return; }
  for (const e of events.filter(e => e.n > seenEvent)) {
    seenEvent = e.n;
    world?.event(e);
    if (SHOUTED.has(e.kind) || (e.kind === 'miss' && e.id === room.id)) hud.shout(e.text);
    if (SPOKEN_EVENTS.has(e.kind)) tambor.say(e.text, { urgent: e.kind === 'kick' || e.kind === 'enter' });
    if (e.kind === 'kick') sound.bonk?.(.8);
    if (e.kind === 'final') sound.pickup?.(6);
  }
  const fresh = calls.filter(c => c.id > seenCall);
  if (fresh.length) {
    seenCall = Math.max(...fresh.map(c => c.id));
    const mine = fresh.find(c => c.to === room.id), call = mine || fresh[0];
    world?.announce(call);
    tambor.say(SPOKEN[call.move], { urgent: !!mine, rate: 1.3, pitch: .8 });
  }
}

function render(state) {
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished';
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby || ended;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡Que suene el tambor!' : 'Espera al anfitrión';
  judge.sync(state, room.id);
  tambor.follow(state, room.id, () => room.clock());
  react(state);
  const ranked = rankPlayers(state.players, state.options.mode), relevo = state.options.mode === 'relevo';
  const rows = ranked.map((p, i) => ({ rank: i + 1, name: p.id === room.id ? `${p.name} · tú` : p.name, detail: p.bot ? 'Bot' : 'Pana',
    end: relevo && !lobby ? `${Math.round(p.stats.danceBeats)} tiempos` : Math.round(p.score), score: !relevo || lobby, me: p.id === room.id }));
  fillRoster($('roster'), rows);
  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;
  if (ended) {
    const final = [...(state.events || [])].reverse().find(e => e.kind === 'final');
    $('result-title').textContent = final?.text ?? '¡Se acabó la rueda!';
    $('titles').replaceChildren(...(state.titles || []).map(t => {
      const li = document.createElement('li'), b = document.createElement('b'), span = document.createElement('span');
      const who = state.players.find(p => p.id === t.id);
      b.textContent = `${t.title}: ${who?.name ?? '—'}`; span.textContent = t.detail; li.append(b, span); return li;
    }));
    fillRoster($('result-roster'), rows);
  }
  const view = `${state.phase}:${me()?.role}`;
  if (view !== lastView) { lastView = view; requestAnimationFrame(() => requestAnimationFrame(fitCamera)); }
  world?.update(state, room.id);
}

// Keep the rueda clear of whichever panel is showing: the call card below it,
// the drum lane or the crowd's buttons beside it (below it on a phone).
function fitCamera() {
  const panel = ['drum', 'crowd', 'call'].map($).find(el => !el.hidden && !$('hud').hidden), rect = panel?.getBoundingClientRect();
  const beside = rect && rect.left > innerWidth / 2;
  world?.setSafe({ bottom: rect && !beside ? innerHeight - rect.top + 12 : 40, right: beside ? innerWidth - rect.left + 12 : 12 });
}

render(room.state); room.connect();
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createTamborScene($('world')),
  ready: (created) => { world = created; render(room.state); fitCamera(); },
  tickMs: 50,
  tick: (dt) => room.tick(dt, judge.input(), menu.isOpen && room.members.size <= 1),
  frame: (dt, scene) => {
    const state = room.state, t = songTime(), playing = state.song && ['song', 'break'].includes(state.phase);
    if (t != null && state.phase === 'song' && !menu.isOpen) judge.update(t);
    hud.render(state, { me: room.id, judge, t });
    const raw = songTime(true);
    if (!quiet) scene.frame(dt, playing && raw != null ? raw / secondsPerBeat(songFor(state.song.track)) : null);
  },
  dispose: () => { tambor.stop(); room.dispose(); },
});
addEventListener('resize', fitCamera);
if (params.has('debug')) window.tamborDebug = { room, menu, judge, tambor, songTime, press, release, get world() { return world; },
  // Suites skip drawing while timing calls: software WebGL draws the eight
  // dressed panas at a few frames a second, which starves snapshots and ticks.
  quiet(value) { quiet = !!value; } };
