// Wiring only: input → rules (through the room) → scene and HUD.
// Milestone toasts are opt-in: createFeats from /engine/feats.js on a .pk-toast element.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';

import { sound } from '/engine/fx.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { BochincheRoom } from './network.js';
import { createRoomOptions } from '/engine/room-options.js';
import { STYLE_NAMES } from './rules.js';
import { createFightHud } from './fight-hud.js';
import { createControls } from './controls.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
let world = null;
const room = new BochincheRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => { $('event').textContent = text; },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: 'Bochinche', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ title: 'Bochinche · Pana', sound, orientation: 'horizontal',
  pad: { move: 'wasd', keys: { a: ['Space', 'Saltar'], x: ['KeyJ', 'Golpe'], b: ['KeyK', 'Especial'], y: ['KeyL', 'Agarre'], lb: ['ShiftLeft', 'Escudo'] } },
  note: () => room.members.size > 1 ? 'La ronda sigue mientras estás en el menú.' : 'La ronda está en pausa.',
  controls: [['A D / flechas', 'Moverse'], ['Espacio', 'Saltar · dos saltos'], ['J + dirección', 'Golpe / ataque aéreo'], ['K + dirección', 'Especial · arriba para volver'], ['Shift + dirección', 'Escudo / esquivar'], ['L', 'Agarrar · dirección para lanzar'], ['I', 'Agarrar objetos']],
  tips: ['Cuanto más daño acumulas, más lejos te mandan los golpes.', 'Gana quien conserve vidas. Si empatan al sonar la campana, hay muerte súbita.', 'Escoge tu estilo en la sala; tu pana conserva su aspecto.'],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');
$('start').onclick = $('again').onclick = () => { sound.unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();
$('back-lobby').onclick = () => room.action('lobby');
for (const button of document.querySelectorAll('[data-style]')) button.onclick = () => room.action('style', { style: Number(button.dataset.style) });

const controls = createControls(menu);
const input = () => controls.read();

const updateFightHud = createFightHud();
let lastSoundFrame = -1, soundRound = -1;
function render(state) {
  if (state.round !== soundRound) { soundRound = state.round; lastSoundFrame = -1; }
  if (state.fight && state.fight.frame > lastSoundFrame) {
    const since = lastSoundFrame; lastSoundFrame = state.fight.frame;
    for (const e of state.fight.events) {
      if (e.frame <= since) continue;
      if (e.type === "hit") { sound.tone(95 + Math.min(140,(e.damage??5)*8), 0, .1, "triangle", .25); sound.tone(65, .025, .12, "sine", .15); }
      if (e.type === "shield-hit") sound.tone(900, 0, .07, "sine", .1);
      if (e.type === "ko") sound.horn("fiesta");
      if (e.type === "jump") sound.tone(430, 0, .08, "sine", .06);
      if (e.type === "countdown") sound.tone(600, 0, .12, "sine", .08);
    }
  }
  const lobby = state.phase === 'lobby', ended = state.phase === 'finished';
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡A pelear!' : 'Espera al anfitrión';
  const fighters = state.fight?.fighters ?? [];
  const ranked = state.players.map((p, i) => ({ ...p, stocks: fighters[i]?.stocks ?? state.options.stocks, percent: fighters[i]?.percent ?? 0 })).sort((a,b) => Number(b.id === state.winner) - Number(a.id === state.winner) || b.stocks - a.stocks || a.percent - b.percent);
  const rows = ranked.map((p, i) => ({ rank: i + 1, name: p.id === room.id ? `${p.name} · tú` : p.name, detail: p.bot ? 'Bot' : STYLE_NAMES[p.style], end: `${p.stocks} vidas · ${Math.round(p.percent)}%`, score: false, me: p.id === room.id }));
  fillRoster($('roster'), rows);
  const me = state.players.find(p => p.id === room.id);
  const seconds = Math.ceil((state.fight?.remainingTimeMs ?? state.options.seconds*1000)/1000);
  $('timer').textContent = state.fight?.suddenDeath ? 'MUERTE SÚBITA' : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
  updateFightHud(state);
  for (const b of document.querySelectorAll('[data-style]')) { b.disabled = !lobby; b.setAttribute('aria-pressed', String(Number(b.dataset.style) === me?.style)); }
  $('score').textContent = me ? STYLE_NAMES[me.style] : 'Entras en la próxima ronda';
  $('back-lobby').disabled = !room.isHost;
  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;
  if (ended) {
    $('result-title').textContent = `¡Ganó ${state.players.find(p => p.id === state.winner)?.name ?? 'nadie'}!`;
    fillRoster($('result-roster'), rows);
  }
  world?.update(state);
}

render(room.state); room.connect();
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createBochincheScene($('world')),
  ready: (created) => { world = created; render(room.state); },
  tickMs: 50,
  tick: (dt) => room.tick(dt, input(), menu.isOpen && room.members.size <= 1),
  frame: (dt, scene) => scene.frame(dt),
  dispose: () => { controls.dispose(); room.dispose(); },
});
if (params.has('debug')) window.bochincheDebug = { room, menu, input, get world() { return world; } };

