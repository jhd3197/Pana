// Wiring only: keys, mouse and touch → the match (rules.js) and the bot
// (bot.js) → the 3D scene, the HUD and the sounds. One player against the
// machine, offline: no room, no network.
import { loadName } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton, drawIcons } from '/engine/touch.js';
import { sound } from '/engine/fx.js';
import { sfx } from '/engine/sfx.js';
import { bootGame } from '/engine/game-shell.js';
import { createToast } from '/engine/hud.js';
import { createRoomOptions } from '/engine/room-options.js';
import { createShotCharge, paintCharge } from '/engine/play/shot-charge.js';
import { pressJump } from '/engine/play/jump.js';
import { difficultyInfo } from '/engine/play/difficulty.js';
import { loc } from '/engine/i18n.js';
import { ROOM_OPTIONS, defaultOptions, roomOptions } from './options.js';
import { createMatch, tickMatch, takeEvents, activeCapy, alive, fire } from './rules.js';
import { createBot } from './bot.js';
import { createHud } from './hud.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const HUMAN = 0, STEP = 1 / 60;
let world = null, match = createMatch(), playing = false, bot = null, options = defaultOptions(), acc = 0, lastTick = 0;
const hud = createHud($, { human: HUMAN }), notify = createToast($('toast'), { ms: 2600 });

const panel = createRoomOptions($('room-options'), { title: 'Capis a Pintazos', fields: ROOM_OPTIONS, // i18n-ignore: the game's name
  change: patch => { options = roomOptions(options, patch); panel.update(options, true); },
  reset: () => { options = defaultOptions(); panel.update(options, true); } });
panel.update(options, true);
const menu = createGameMenu({ title: 'Capis a Pintazos · Pana', sound, orientation: 'libre', // i18n-ignore: the game's name
  pad: { move: 'wasd', keys: { a: ['Space', loc('Cargar y disparar')], b: ['Enter', loc('Saltar')], y: ['KeyZ', loc('Ver todo el mapa')] } },
  note: () => loc('La partida está en pausa.'),
  controls: [[loc('A D / ← →'), loc('Caminar')], [loc('W S / ↑ ↓ / ratón'), loc('Apuntar')], [loc('Espacio / clic'), loc('Mantén para cargar, suelta para disparar')],
    ['Enter', loc('Saltar')], ['Z', loc('Ver todo el mapa')], ['M', loc('Activar o silenciar el sonido')]],
  tips: [loc('El viento empuja la pintura: mira la flecha antes de disparar.'), loc('La tierra pintada resbala: los capis se deslizan cuesta abajo.'),
    loc('Un capi con 100 % de pintura o que cae al río queda fuera.'), loc('Después de disparar tienes 3 segundos para cubrirte.')],
});
$('game-nav').append(menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');

// ---------- the match ----------
function start() {
  sound.unlock();
  match = createMatch({ seconds: options.seconds, difficulty: options.difficulty, seed: (Date.now() >>> 0) % 100000 });
  bot = createBot({ team: 1 - HUMAN, difficulty: options.difficulty, seed: match.seed + 1 });
  world?.setMatch(match); hud.build(match);
  playing = true; acc = 0; lastTick = 0; world.wide = false;
  $('results').hidden = true; $('lobby').hidden = true; $('hud').hidden = false; document.body.classList.remove('in-lobby');
  render();
}
function toLobby() {
  playing = false; charge.cancel();
  $('results').hidden = true; $('hud').hidden = true; $('lobby').hidden = false; document.body.classList.add('in-lobby');
  if (world) world.wide = true;
}
$('start').onclick = start;
$('again').onclick = toLobby;

// ---------- input ----------
const keys = new Set(), touch = new Set();
let jumps = 0, mouseAt = null, pendingFire = null, power = null;
const held = (...names) => names.some(name => keys.has(name) || touch.has(name));
const myTurn = () => playing && match.phase === 'aim' && activeCapy(match)?.team === HUMAN && !menu.isOpen;
const charge = createShotCharge({ ready: myTurn, revision: () => match.turn?.n,
  change: p => { power = p; $('power-bar').hidden = p == null; if (p != null) paintCharge($('power'), p, $('power-value')); },
  shoot: p => { pendingFire = p; } });
function input() {
  const me = activeCapy(match);
  if (!myTurn() && match.phase !== 'retreat') return {};
  if (me?.team !== HUMAN) return {};
  const out = { x: Number(held('d', 'arrowright', 'right')) - Number(held('a', 'arrowleft', 'left')), jump: jumps,
    aim: Number(held('w', 'arrowup', 'aim-up')) - Number(held('s', 'arrowdown', 'aim-down')) };
  if (mouseAt && !out.aim && !out.x) {
    const dx = mouseAt.x - me.x, dy = mouseAt.y - (me.y + .7);
    if (Math.hypot(dx, dy) > .8) { out.face = dx < 0 ? -1 : 1; out.aimTo = Math.atan2(dy, Math.abs(dx)); }
  }
  if (pendingFire != null) { out.fire = pendingFire; pendingFire = null; }
  return out;
}
const typing = (event) => event.target.closest?.('input, textarea, select, [contenteditable], dialog');
addEventListener('keydown', (event) => {
  if (menu.isOpen || typing(event) || !playing) return;
  const key = event.key.toLowerCase();
  if (key === 'm' && !event.repeat) toggleMute();
  if (key === 'z' && !event.repeat) world.wide = !world.wide;
  if ((key === 'enter' || key === 'j') && !event.repeat) { event.preventDefault(); jumps = pressJump(jumps); }
  if (key === ' ') { event.preventDefault(); if (!event.repeat) charge.begin(' '); }
  if (/^(w|a|s|d|arrow(up|down|left|right))$/.test(key)) { event.preventDefault(); keys.add(key); if (/w|s|up|down/.test(key)) mouseAt = null; }
});
addEventListener('keyup', (event) => { const key = event.key.toLowerCase(); keys.delete(key); if (key === ' ') charge.release(' '); });
const canvas = $('world');
canvas.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse' && playing && world) mouseAt = world.pick(event.clientX, event.clientY); });
canvas.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'mouse' || event.button !== 0 || !playing) return; mouseAt = world.pick(event.clientX, event.clientY); charge.begin('pointer'); });
addEventListener('pointerup', (event) => { if (event.pointerType === 'mouse') charge.release('pointer'); });
const letGo = () => { keys.clear(); touch.clear(); charge.cancel(); pads.forEach(p => p.release()); };
addEventListener('blur', letGo);
document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });
drawIcons();
const pads = ['left', 'right', 'aim-up', 'aim-down'].map(id => holdButton($(id), { down: () => touch.add(id), up: () => touch.delete(id), paused: () => menu.isOpen }));
pads.push(holdButton($('jump'), { down: () => { jumps = pressJump(jumps); }, paused: () => menu.isOpen }));
pads.push(holdButton($('fire'), { down: () => charge.begin('touch'), up: () => charge.release('touch'), paused: () => menu.isOpen }));
$('zoom').onclick = () => { if (world) world.wide = !world.wide; };

// ---------- events → sound, effects, toasts ----------
const nameOf = id => match.capys.find(c => c.id === id)?.name || '';
// How loud a sound at (x, y) is from where the camera looks: far ones are quieter and muffled.
const heard = (x, y) => world && Number.isFinite(x) ? world.hearing(x, y) : { volume: 1, far: 0 };
function handle(e) {
  world?.event(e);
  switch (e.type) {
    case 'turn': sfx.chime(); notify(match.turn.team === HUMAN ? loc('Tu turno: {name}', { name: nameOf(e.capy) }) : loc('Turno de la máquina: {name}', { name: nameOf(e.capy) })); break;
    case 'fire': sfx.shot('bazuca'); break;
    case 'blast': {
      // The boom, the wet splat, the earth raining back and the drops pattering down.
      const { volume, far } = heard(e.x, e.y);
      sfx.boom(1.2, { volume: .85 * volume, far }); sfx.splat(1.2 * volume);
      sfx.debris(1.1, { volume: .9 * volume, delay: .3 }); sfx.patter(7, { volume: .8 * volume, delay: .45 });
      break;
    }
    case 'hit': sfx.squeak(); sfx.splat(.5); world?.react(e.team === HUMAN ? 'ouch' : e.by === HUMAN ? 'cheer' : 'idle'); break;
    case 'jump': sfx.boing(.8); break;
    case 'land': sfx.land('grass', { power: .4, volume: .7 }); break;
    case 'plop': sfx.splash(.8, { volume: heard(e.x, e.y).volume }); sfx.patter(4, { volume: .5, delay: .35 }); break;
    case 'out':
      if (e.reason === 'water') { sfx.splash(1.3); sfx.patter(5, { volume: .6, delay: .4 }); notify(loc('¡{name} se fue al río!', { name: nameOf(e.capy) })); }
      else notify(loc('¡{name} quedó pintado de pies a cabeza!', { name: nameOf(e.capy) }));
      break;
    case 'timeout': notify(loc('¡Se acabó el tiempo!')); break;
    case 'finished': sfx.sting(e.winner === HUMAN); world?.react(e.winner === HUMAN ? 'win' : 'lose'); charge.cancel(); setTimeout(() => { if (match.phase === 'finished') hud.results(match); }, 1400); break;
  }
}

function step(dt) {
  if (!playing || menu.isOpen || match.phase === 'finished') return;
  acc = Math.min(acc + dt, .25);
  while (acc >= STEP) {
    acc -= STEP;
    const me = activeCapy(match), mine = me?.team === HUMAN;
    const before = Math.ceil(match.turn.time);
    tickMatch(match, STEP, mine ? input() : bot.input(match));
    if (match.phase === 'aim' && Math.ceil(match.turn.time) < before && before <= 5) sfx.tick(5 - before);
    for (const e of takeEvents(match)) handle(e);
    if (match.phase === 'finished') break;
  }
  if (match.phase !== 'aim' || activeCapy(match)?.team !== HUMAN) charge.cancel();
}

function render() {
  if (!playing) return;
  hud.update(match);
}

export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createCapisScene($('world'), match),
  ready: (created) => {
    world = created; world.wide = true; hud.build(match);
    $('start').disabled = false; $('start').textContent = loc('¡A pintar!');
  },
  frame: (dt, scene) => {
    step(dt); charge.update(); render();
    scene.frame(dt, { playing, power: power ?? null, difficulty: difficultyInfo(options.difficulty), labels: playing ? hud.labels : null });
  },
});
if (params.has('debug')) window.capisDebug = { get match() { return match; }, get world() { return world; }, start, fire: (p) => fire(match, p), options: () => options, get playing() { return playing; } };
