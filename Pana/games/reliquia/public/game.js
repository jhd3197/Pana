import { createRoomOptions } from '/engine/room-options.js';
import { prepareScene } from '/engine/game-load.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound, popCounter } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl } from '/engine/invite.js';
import { roomCode } from '/engine/game-shell.js';
import { holdButton, drawIcons, isTouch } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { createToast } from '/engine/hud.js';
import { elapsedClock } from '/engine/live-room.js';
import { createLookControls } from '/engine/play/first-person.js';
import { pressJump } from '/engine/play/jump.js';
import { createFootsteps } from '/engine/play/footsteps.js';
import { sfx as sfxLib } from '/engine/sfx.js';
import { FIELDS, DEFAULT_OPTIONS } from './options.js';
import { Expedition, BARKS, interaction } from './rules.js';
import { ExpeditionRoom } from './network.js';
import { createView } from './view.js';
import { createHud, money } from './hud.js';
import { sfx } from './sounds.js';
import { createAmbience } from './ambience.js';
import { floorOf, FLOOR_NAMES } from './deck.js';
import { ITEMS, say } from './items.js';
import { loc } from '/engine/i18n.js';

const $ = id => document.getElementById(id), show = (id, on) => $(id).classList.toggle('hidden', !on);
const notify = createToast($('toast'), { ms: 3400 });
const qs = new URLSearchParams(location.search), code = roomCode();
const avatar = loadAvatar(), name = qs.get('name')?.slice(0, 16) || loadName();
const canvas = $('world'), view = createView(canvas), hud = createHud(), ambience = createAmbience();
let state = new Expedition().snapshot(), phase = '', lastEvent = 0, failed = false, dead = false, myFloor = 0, uiAt = 0, last = performance.now();
const keys = new Set(), touch = new Set();
let jumpPress = 0;
const feet = createFootsteps();   // steps by distance walked, plus take-off and landing
function jump(){if(playing())jumpPress=pressJump(jumpPress);}
function clearInput() { keys.clear(); touch.clear(); }
const solo = () => room.offline || room.members.size === 1;
const playing = () => state.phase === 'playing' && !menu.isOpen;

const menu = createGameMenu({
  pad: { move: 'wasd', look: loc('Mirar'), keys: { rt: ['KeyV', loc('Usar lo de la mano derecha')], a: ['Space', loc('Saltar')], lt: ['KeyF', loc('Usar lo de la mano izquierda')], x: ['KeyE', loc('Agarrar o abrir; mantén para girar')], b: ['KeyQ', loc('Soltar')], y: ['KeyG', loc('Lanzar')], rb: ['KeyR', loc('Arrastrar a un pana')], lb: ['ShiftLeft', loc('Correr')], ls: ['ShiftLeft', loc('Correr')], view: ['Tab', loc('Ver al equipo')] } },
  title: 'Reliquia', heading: loc('Un respiro'), resumeLabel: loc('Volver a la mina'), sound, notify,
  note: () => solo() ? loc('La expedición está en pausa.') : loc('Tus panas siguen en la mina.'),
  controls: [['W A S D', loc('Caminar hacia donde miras')], [loc('Ratón'), loc('Mirar (haz clic en la pantalla para capturarlo)')], [loc('Espacio'), loc('Saltar')], [loc('Clic / V'), loc('Usar lo de la mano derecha')], [loc('Clic derecho / F'), loc('Usar lo de la mano izquierda')],
    ['E', loc('Agarrar, abrir; mantén para girar ruedas, levantar panas o atrapar lo que te lanzan')], ['Q', loc('Soltar')], ['G', loc('Lanzar lo que tienes en la mano')], ['R', loc('Arrastrar a un pana caído')],
    ['Shift', loc('Correr')], ['1 – 7', loc('¿Nos vamos ya? · ¡Una sala más! · y otros gritos')], ['Tab', loc('Ver al equipo')], ['M', loc('Sonido')], ['Esc', loc('Soltar el ratón y abrir el menú')]],
  tips: [loc('Apunta con el punto del centro a lo que quieres usar: palancas, carrito, tesoros, la tienda.'),
    loc('Cada jornada pide una cuota: llenen el carrito, empújenlo a la plataforma de carga y apriétenle el botón amarillo. Cuando la carga subida alcance la cuota, el montacargas los sube y la jornada termina.'),
    loc('El que se quede abajo cuando el montacargas suba vuelve al campamento con un hilito de vida.'),
    loc('Cada mano lleva un tesoro, una herramienta o un puñado de cuatro piezas: échalas al carrito (E) o lánzalas adentro (G).'),
    loc('Solo puedes llevar un arma a la vez: al agarrar otra, sueltas la que tenías.'),
    loc('Los tesoros grandes piden dos, tres o cuatro panas: cada uno agarra un lado (E) y caminan juntos. Solo se arrastran despacito.'),
    loc('El farol congela a las momias que alumbra. En la oscuridad corren más.'),
    loc('Cada tesoro que levantan sube la codicia: más trampas, momias bravas, túneles que se derrumban y un jaguar negro que los caza.'),
    loc('Al final de cada piso se abre la bajada. ¿Se van con lo que tienen o bajan un piso más?'), loc('Si caen todos, del camión solo se salva una parte.')],
  actions: [{ id: 'offline', label: loc('Abrir expedición local'), kind: 'link', visible: () => failed, run: () => room.practice() }],
  invite: () => inviteUrl(code),
  onOpen() { clearInput(); looking.release(); }, onClose() {},
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--sm' }), menu.createSoundButton({ id: 'sound', className: 'pk-btn pk-btn--sm' }), menu.createButton({ id: 'menu', className: 'pk-btn pk-btn--sm' }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
const room = new ExpeditionRoom({ code, name, avatar, onState: receive, onNotice: notify,
  onStatus(text, error = false) { failed = error; $('connection').textContent = text; show('practice', error); show('disconnect', error && state.phase === 'playing'); menu.update(); lobby(); },
});
const optionsUI = createRoomOptions($('room-options'), { title: 'Reliquia', fields: FIELDS, change: options => room.action('configure', { options }), reset: () => room.action('configure', { options: DEFAULT_OPTIONS }) });
// A guest draws its own explorer where it predicts it, not a round trip behind.
const me = () => { const p = state.players.find(p => p.id === room.id); const predicted = room.predicted; return predicted && p ? { ...p, x: predicted.x, z: predicted.z, y: predicted.y, vx: predicted.vx, vz: predicted.vz, moving: predicted.moving, stamina: predicted.stamina, jumpHeight: predicted.jumpHeight ?? p.jumpHeight } : p; };
const looking = createLookControls(canvas, { enabled: () => playing(), look: (yaw, pitch) => view.look(yaw, pitch),
  press(event) { sound.unlock(); if (event.button === 0) act('use', { hand: 0 }); if (event.button === 2) act('use', { hand: 1 }); },
  unlocked: () => { if (state.phase === 'playing') menu.open('game'); } });

function lobby() {
  optionsUI.update(state.options || DEFAULT_OPTIONS, room.connected && room.isHost && state.phase !== 'playing');
  if (state.phase === 'playing' && optionsUI.isOpen) optionsUI.close();
  show('lobby', state.phase === 'lobby'); show('hud', state.phase === 'playing'); show('results', state.phase === 'results');
  $('start').disabled = !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? loc('Conectando…') : room.isHost ? loc('¡A la mina!') : loc('El anfitrión prepara la salida');
  if (state.phase === 'results') hud.results(state, room);
}

// Big tilted callouts for the beats of a run; the toast keeps the full sentence.
const SHOUTS = { seal: [loc('¡Se abrió la bajada!'), 'teal'], boss: [loc('¡Despertó algo grande!'), 'coral'], guardian: [loc('¡Guardián vencido!'), 'yellow'], jaguar: [loc('¡Jaguar vencido!'), 'yellow'],
  curse: [loc('¡Maldición!'), 'coral'], collapse: [loc('¡Derrumbe!'), 'coral'], stalker: [loc('¡Los están cazando!'), 'coral'], down: [loc('¡Pana caído!'), 'coral'], reveal: [loc('¡Sala escondida!'), 'teal'] };
const QUIET = new Set(['pick', 'hit', 'swing', 'shot', 'hurt', 'throw', 'drop', 'trap', 'pounce', 'bark', 'chest', 'winch']);
function handle(e) {
  const mine = e.player === room.id, p = me(), seat = state.players.find(q => q.id === e.player)?.seat ?? 0;
  const near = p && e.player != null ? (() => { const q = state.players.find(q => q.id === e.player); return q && floorOf(q.x) === floorOf(p.x) ? Math.max(.25, 1 - Math.hypot(q.x - p.x, q.z - p.z) / 30) : 0; })() : 1;
  // Events carry Spanish keys and vars from the host; this client's language here.
  const said = say(e.text, e.vars);
  if (said && !QUIET.has(e.kind)) notify(said);
  const big = SHOUTS[e.kind]; if (big) shout(e.kind === 'greed' ? said : big[0], { tone: big[1] });
  switch (e.kind) {
    case 'pick': if (near) (ITEMS[e.item].size === 'small' ? ['emerald', 'pearl'].includes(e.item) ? sfx.gem : sfx.coin : sfx.grab)(); break;
    case 'grab': sfx.grab(); break;
    case 'swing': if (near) sfx.swing(); break;
    case 'hit': if (near) sfx.hit(); break;
    case 'shot': if (near) sfx.shot(); break;
    case 'chest': sfx.chest(); { const c = view.world.run.chests.find(c => c.id === e.chest); if (c) view.waves.sparkle({ x: c.x, y: 1, z: c.z }, { color: 0xffd36a, count: 10 }); } break;
    case 'bank': sfx.bank(e.big); popCounter($('haul')); break;
    case 'throw': if (near) sfx.throw(); break;
    case 'bonk': sfx.bonk(); if (mine || e.player === room.id) view.shake(.5); break;
    case 'tip': sfx.tip(); break;
    case 'lost': sfx.lost(); break;
    case 'curse': sfx.curse(); view.shake(.3); break;
    case 'seal': sfx.seal(); view.shake(.5); break;
    case 'descend': if (e.players?.includes(room.id)) shout(loc('Piso {n}: {place}', { n: e.floor, place: FLOOR_NAMES[e.floor] ? loc(FLOOR_NAMES[e.floor]) : loc('el oro profundo') }), { tone: 'yellow' }); break;
    case 'trap': if (near) sfx.trap(); break;
    case 'hurt': if (mine) { sfx.hurt(); view.shake(.35); } break;
    case 'down': sfx.down(); break;
    case 'revive': sfx.revive(); break;
    case 'awaken': sfx.awaken(); break;
    case 'boss': sfx.boss(); view.shake(.4); break;
    case 'pounce': { sfx.pounce(); if (p) view.shake(Math.max(0, 1 - Math.hypot(e.x - p.x, e.z - p.z) / 18)); view.waves.ring({ x: e.x, y: .1, z: e.z }, { color: 0xffc23d, maxRadius: 3 }); break; }
    case 'greed': sfx.greed(); view.shake(.4); shout(said, { tone: 'coral' }); break;
    case 'collapse': sfx.collapse(); view.shake(.9); break;
    case 'laugh': sfx.laugh(); break;
    case 'level': sfx.win(); shout(loc('¡Jornada {n} lista!', { n: e.level }), { tone: 'yellow' }); break;
    case 'buy': sfx.bank(false); break;
    case 'cargo': sfx.lift(); break;
    case 'delivered': sfx.bank(true); popCounter($('mangos')); if (e.met) shout(loc('¡Cuota lista! Al montacargas'), { tone: 'teal' }); break;
    case 'spider': sfx.awaken(); view.shake(.2); break;
    case 'scatter': if (near) sfx.flap(); break;
    case 'cart-load': case 'cart-catch': case 'cart-big': sfx.coin(); if (e.kind !== 'cart-load') sfx.bank(false); break;
    case 'cart-grab': sfx.grab(); break;
    case 'lift': sfx.lift(); if (e.players?.includes(room.id)) view.shake(.25); break;
    case 'lift-arrive': sfx.bell(); if (e.players?.includes(room.id)) view.shake(.2); break;
    case 'winch': sound.clickUp(); break;
    case 'extracted': sfx.win(); break;
    case 'wipe': sfx.wipe(); break;
    case 'bark': {
      const text = said || loc(BARKS[e.line]); view.bark(e.player, text); sfx.bark(seat, near || .3); hud.vote(e.player, e.line, state.time);
      if (!mine && !near) notify(loc('{name}: {text}', { name: state.players.find(q => q.id === e.player)?.name, text }));
      break;
    }
  }
}
function receive(next) {
  state = next;
  view.reseed(state.seed, state.level || 1);
  if (phase !== state.phase) {
    phase = state.phase; menu.close(); clearInput(); document.body.classList.toggle('playing', phase === 'playing');
    if (phase === 'playing') { const p = state.players.find(p => p.id === room.id); if (p) view.heading = p.h; lastEvent = Math.max(lastEvent, ...state.events.filter(e => e.kind !== 'start').map(e => e.id), 0); }
    if (phase !== 'playing') looking.release();
  }
  // Local practice and a fresh host start a new count.
  const top = Math.max(0, ...state.events.map(e => e.id)); if (top < lastEvent) lastEvent = top;
  for (const e of state.events) if (e.id > lastEvent) { lastEvent = e.id; if (state.phase !== 'lobby') handle(e); }
  // Off the montacargas on a new floor, you face out of the cage.
  const p = state.players.find(p => p.id === room.id);
  if (p && floorOf(p.x) !== myFloor) { myFloor = floorOf(p.x); view.heading = p.h; }
  lobby();
}
function act(action, extra = {}) { if (playing()) room.action(action, extra); }
$('start').onclick = () => { sound.unlock(); room.action('start'); }; $('again').onclick = () => room.action('start');
$('practice').onclick = $('offline-inline').onclick = () => room.practice();
// Touch: hold buttons for moving and grabbing, taps for the rest.
drawIcons();
if (isTouch()) { $('hand-0').querySelector('.pk-slot-n').textContent = loc('Usar'); $('hand-1').querySelector('.pk-slot-n').textContent = loc('Izq.'); }
const pads = [];
for (const button of document.querySelectorAll('[data-move]')) pads.push(holdButton(button, { paused: () => !playing(), down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) }));
pads.push(holdButton($('t-grab'), { paused: () => !playing(), down: () => { touch.add('e'); act('interact'); }, up: () => touch.delete('e') }));
let touchBark = 0;
for (const [id, run] of [['t-jump', jump], ['t-use', () => act('use', { hand: 0 })], ['t-left', () => act('use', { hand: 1 })], ['t-throw', () => act('throw')], ['t-drop', () => act('drop')], ['t-bark', () => { act('bark', { line: touchBark }); touchBark = (touchBark + 1) % BARKS.length; }]])
  pads.push(holdButton($(id), { paused: () => !playing(), down: run }));
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || menu.isOpen) return;
  const key = e.key.toLowerCase();
  if (key === 'tab') { e.preventDefault(); if (state.phase === 'playing') hud.board(true, state, room); return; }
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) e.preventDefault();
  if (!playing()) return;
  keys.add(key); if (e.repeat) return;
  if (key === ' ') jump(); if (key === 'v') act('use', { hand: 0 }); if (key === 'f') act('use', { hand: 1 });
  if (key === 'e') act('interact'); if (key === 'q') act('drop'); if (key === 'g') act('throw'); if (key === 'r') act('drag');
  if (/^[1-7]$/.test(key)) act('bark', { line: Number(key) - 1 });
  if (key === 'm') toggleMute();
});
addEventListener('keyup', e => { const key = e.key.toLowerCase(); keys.delete(key); if (key === 'tab') hud.board(false, state, room); });
addEventListener('blur', clearInput); document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
function input() {
  if (!playing()) return { x: 0, z: 0, hold: false, h: view.heading, pitch: view.pitch };
  const k = name => keys.has(name) || touch.has(name);
  const x = +k('d') - +k('a'), z = +(k('s') || k('arrowdown')) - +(k('w') || k('arrowup'));
  return { ...view.movement(x, z), h: view.heading, pitch: view.pitch, sprint: keys.has('shift'), hold: k('e'), jump: jumpPress };
}
// Real elapsed time: a host in a background tab gets timers once a second.
const simClock = elapsedClock();
const ticker = setInterval(() => { const dt = simClock(); if (!qs.has('manual')) room.tick(dt, input(), menu.isOpen && solo()); }, 50);
function frame(now) {
  if (dead) return;
  const dt = Math.min(.06, (now - last) / 1000); last = now;
  const p = me();
  // Without a mouse the left and right arrows turn.
  if (playing() && (keys.has('arrowleft') || keys.has('arrowright'))) view.look((+keys.has('arrowleft') - +keys.has('arrowright')) * dt * 2.2);
  // Keep the eyes on your pana after the run ends; never draw your own body.
  view.draw(state, state.phase === 'lobby' ? null : p, dt, { self: room.id });
  ambience.update(state, p, view.heading, dt);
  if (p && state.phase === 'playing' && !p.downed && !p.spectator) { const speed = p.moving ? Math.hypot(p.vx, p.vz) : 0; feet.update(dt, { speed, height: p.jumpHeight || 0, sprint: speed > 5.4, surface: floorOf(p.x) ? 'stone' : 'dirt', volume: .8 }, sfxLib); }
  else feet.reset();
  uiAt -= dt; if (uiAt <= 0 && state.phase === 'playing') { uiAt = .066; hud.update(state, p, room, { heading: view.heading, paused: menu.isOpen }); }
  requestAnimationFrame(frame);
}
show('loading', false); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { dead = true; clearInterval(ticker); notify.dispose(); room.dispose(); menu.dispose?.(); looking.dispose(); view.dispose(); });
if (qs.has('debug')) window.reliquia = { room, view, menu, input, interaction, money,
  get state() { return state; }, get me() { return me(); },
  step(seconds) { if (!room.isHost) return; for (let t = 0; t < seconds; t += .05) room.game.update(Math.min(.05, seconds - t), room.inputs); room.publish(); },
  place(id, x, z, h) { const p = room.game?.players.find(p => p.id === id); if (p) { p.x = x; p.z = z; if (h !== undefined) p.h = h; room.publish(); } },
  face(h, pitch) { view.heading = h; if (pitch !== undefined) view.pitch = pitch; },
};

await prepareScene({ renderer: view.renderer, scene: view.scene, camera: view.camera });
