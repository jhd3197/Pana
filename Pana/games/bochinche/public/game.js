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

import { createFightHud, HUD_LAYOUTS } from './fight-hud.js';
import { createPanaPicker, savedPana } from './pana-picker.js';
import { createResultsScreen } from './results-screen.js';
import { costumeAvatar } from './costume.js';
import { panaById } from './panas.js';
import { cachedPortrait } from '/engine/portrait-cache.js';

import { createControls } from './controls.js';

import { ROOM_OPTIONS, defaultOptions } from './options.js';

import { loc, locn } from '/engine/i18n.js';


const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);

const code = roomCode();

let world = null;
// HUD layout is a per-viewer convenience: clásico, esquinas or mínimo.
let hudLayout = 'clasico';
try { hudLayout = HUD_LAYOUTS.some(([id]) => id === localStorage.getItem('bochinche:hud')) ? localStorage.getItem('bochinche:hud') : 'clasico'; } catch {}
document.body.dataset.hud = hudLayout;

const room = new BochincheRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,

  onNotice: (text) => { $('event').textContent = loc(text); },
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },

});

const roomOptions = createRoomOptions($('room-options'), { title: 'Bochinche', fields: ROOM_OPTIONS,

  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });

const menu = createGameMenu({ title: 'Bochinche · Pana', sound, orientation: 'horizontal', // i18n-ignore: the game's name
  pad: { move: 'wasd', keys: { a: ['Space', loc('Saltar')], x: ['KeyJ', loc('Golpe')], b: ['KeyK', loc('Especial')], y: ['KeyL', loc('Agarre')], lb: ['ShiftLeft', loc('Escudo')] } },
  note: () => room.members.size > 1 ? loc('La ronda sigue mientras estás en el menú.') : loc('La ronda está en pausa.'),
  options: [{ id: 'hud', label: loc('Diseño del HUD'), choices: HUD_LAYOUTS.map(([id, label]) => [id, loc(label)]), get: () => hudLayout,
    set: (value) => { hudLayout = value; document.body.dataset.hud = value; try { localStorage.setItem('bochinche:hud', value); } catch {} } }],
  controls: [[loc('A D / flechas'), loc('Moverse')], [loc('Espacio'), loc('Saltar · dos saltos')], [loc('J + dirección'), loc('Golpe / ataque aéreo')], ['K', loc('El poder de tu pana')], ['K + lado', loc('Candela')], ['K + abajo', loc('Hielo')], ['K + arriba', loc('Volver al escenario')], ['J + toque lateral', loc('Jonrón')], [loc('Shift + dirección'), loc('Escudo / esquivar')], ['L', loc('Agarrar · dirección para lanzar')], ['I', loc('Agarrar objetos')]],
  tips: [loc('Cuanto más daño acumulas, más lejos te mandan los golpes.'), loc('Gana quien conserve vidas. Si empatan al sonar la campana, hay muerte súbita.'), loc('Escoge tu pana y tu estilo en la sala: cada pana tiene su poder en K.')],
  invite: () => room.offline ? null : inviteUrl(code),

});

$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));

$('rules').onclick = () => menu.open('controls');

$('start').onclick = $('again').onclick = () => { sound.unlock(); room.action('start'); };

$('practice').onclick = () => room.practice();

$('back-lobby').onclick = () => room.action('lobby');

const picker = createPanaPicker({ avatar: loadAvatar, pick: (pana, traje) => room.action('pana', { pana, traje }) });
$('pana-change').onclick = () => { const me = room.state.players.find(p => p.id === room.id); picker.open(me && { pana: me.pana, traje: me.traje }); };
const results = createResultsScreen();
// The sala card: your costume, who you are and your poder.
let cardKey = '', savedSent = false;
function panaCard(me) {
  if (!me) return;
  const pana = panaById(me.pana), look = costumeAvatar(loadAvatar(), pana.id, me.traje ?? 0), key = JSON.stringify(look);
  $('pana-card').style.setProperty('--c', pana.trajes[me.traje ?? 0]);
  $('pana-card-who').textContent = pana.who; $('pana-card-poder').textContent = loc('Poder: {poder}', { poder: loc(pana.poder) });
  if (key === cardKey) return;
  cardKey = key; const img = $('pana-card-img'), hit = cachedPortrait(look);
  if (hit) img.src = hit; else import('/engine/portrait.js').then(({ portrait }) => portrait(look)).then(src => { if (cardKey === key) img.src = src; }).catch(() => {});
}
for (const button of document.querySelectorAll('[data-style]')) button.onclick = () => room.action('style', { style: Number(button.dataset.style) });



const controls = createControls(menu);

const input = () => controls.read();



const fightHud = createFightHud({ screenOf: slot => world?.screenOf(slot) });

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

  $('start').textContent = !room.connected ? loc('Conectando…') : room.isHost ? loc('¡A pelear!') : loc('Espera al anfitrión');
  const fighters = state.fight?.fighters ?? [];

  const ranked = state.players.map((p, i) => ({ ...p, stocks: fighters[i]?.stocks ?? state.options.stocks, percent: fighters[i]?.percent ?? 0 })).sort((a,b) => Number(b.id === state.winner) - Number(a.id === state.winner) || b.stocks - a.stocks || a.percent - b.percent);

  const rows = ranked.map((p, i) => ({ rank: i + 1, name: p.id === room.id ? loc('{name} · tú', { name: p.name }) : p.name, detail: p.bot ? loc('Bot') : loc(STYLE_NAMES[p.style]), end: locn(p.stocks, '{n} vidas · {percent}%', '{n} vidas · {percent}%', { percent: Math.round(p.percent) }), score: false, me: p.id === room.id }));
  fillRoster($('roster'), rows);

  const me = state.players.find(p => p.id === room.id);

  const seconds = Math.ceil((state.fight?.remainingTimeMs ?? state.options.seconds*1000)/1000);

  $('timer').textContent = state.fight?.suddenDeath ? loc('MUERTE SÚBITA') : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
  fightHud.update(state);

  for (const b of document.querySelectorAll('[data-style]')) { b.disabled = !lobby; b.setAttribute('aria-pressed', String(Number(b.dataset.style) === me?.style)); }

  $('score').textContent = me ? loc('{poder} · {style}', { poder: loc(panaById(me.pana).poder), style: loc(STYLE_NAMES[me.style]) }) : loc('Entras en la próxima ronda');
  panaCard(me); $('pana-change').disabled = !lobby; picker.others(state.players, room.id);
  if (!lobby && picker.isOpen) picker.close();
  // Your last pick follows you into every new sala.
  const saved = savedPana();
  if (lobby && me && saved && !savedSent && room.connected) { savedSent = true; if (saved.pana !== me.pana || saved.traje !== me.traje) room.action('pana', saved); }
  $('back-lobby').disabled = !room.isHost;

  $('results').hidden = !ended; $('again').disabled = !room.connected || !room.isHost;

  if (ended) results.update(state, room.id, ranked, `bochinche:${code}:${state.seed}:${state.round}`);


  world?.update(state, room.id);

}



render(room.state); room.connect();

export const { sceneReady } = bootGame({

  load: async () => (await import('./scene.js')).createBochincheScene($('world')),

  ready: (created) => { world = created; render(room.state); },

  tickMs: 50,

  tick: (dt) => room.tick(dt, input(), menu.isOpen && room.members.size <= 1),

  frame: (dt, scene) => { scene.frame(dt); fightHud.frame(hudLayout); },

  dispose: () => { controls.dispose(); room.dispose(); },

});

if (params.has('debug')) window.bochincheDebug = { room, menu, input, get world() { return world; } };



