import { createRoomOptions } from '/engine/room-options.js';
import { prepareScene } from '/engine/game-load.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound, popCounter } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { holdButton, drawIcons, isTouch } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { createToast } from '/engine/hud.js';
import { elapsedClock } from '/engine/live-room.js';
import { createLookControls, SENSITIVITY_CHOICES } from '/engine/play/first-person.js';
import { FIELDS, DEFAULT_OPTIONS } from './options.js';
import { Expedition, BARKS, interaction } from './rules.js';
import { ExpeditionRoom } from './network.js';
import { createView } from './view.js';
import { createHud, money } from './hud.js';
import { sfx } from './sounds.js';
import { floorOf, FLOOR_NAMES } from './deck.js';
import { ITEMS } from './items.js';

const $ = id => document.getElementById(id), show = (id, on) => $(id).classList.toggle('hidden', !on);
const notify = createToast($('toast'), { ms: 3400 });
const qs = new URLSearchParams(location.search), code = roomFromUrl() || newRoomCode();
const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState(null, '', url);
const avatar = loadAvatar(), name = qs.get('name')?.slice(0, 16) || loadName();
const canvas = $('world'), view = createView(canvas), hud = createHud();
let state = new Expedition().snapshot(), phase = '', lastEvent = 0, failed = false, dead = false, myFloor = 0, uiAt = 0, last = performance.now();
const keys = new Set(), touch = new Set();
function clearInput() { keys.clear(); touch.clear(); }
const solo = () => room.offline || room.members.size === 1;
const playing = () => state.phase === 'playing' && !menu.isOpen;

const menu = createGameMenu({
  title: 'Reliquia', heading: 'Un respiro', resumeLabel: 'Volver a la mina', sound, notify,
  note: () => solo() ? 'La expedición está en pausa.' : 'Tus panas siguen en la mina.',
  options: [{ id: 'mouse', label: 'Sensibilidad al mirar', choices: SENSITIVITY_CHOICES, get: () => looking.sensitivity, set: value => { looking.sensitivity = value; } }],
  controls: [['W A S D', 'Caminar hacia donde miras'], ['Ratón', 'Mirar (haz clic en la pantalla para capturarlo)'], ['Clic / Espacio', 'Usar lo de la mano derecha'], ['Clic derecho / F', 'Usar lo de la mano izquierda'],
    ['E', 'Agarrar, abrir; mantén para girar ruedas, levantar panas o atrapar lo que te lanzan'], ['Q', 'Soltar'], ['G', 'Lanzar lo que tienes en la mano'], ['R', 'Arrastrar a un pana caído'],
    ['Shift', 'Correr'], ['1 – 7', '¿Nos vamos ya? · ¡Una sala más! · y otros gritos'], ['Tab', 'Ver al equipo'], ['M', 'Sonido'], ['Esc', 'Soltar el ratón y abrir el menú']],
  tips: ['El botín solo cuenta cuando llega al camión del campamento. El morral se vacía solo al acercarte.',
    'Los tesoros grandes piden dos, tres o cuatro panas: cada uno agarra un lado (E) y caminan juntos. Solo se arrastran despacito.',
    'El farol congela a las momias que alumbra. En la oscuridad corren más.',
    'Cada tesoro que levantan sube la codicia: más trampas, momias bravas, túneles que se derrumban y un jaguar negro que los caza.',
    'Al final de cada piso se abre la bajada. ¿Se van con lo que tienen o bajan un piso más?', 'Si caen todos, del camión solo se salva una parte.'],
  actions: [{ id: 'offline', label: 'Abrir expedición local', kind: 'link', visible: () => failed, run: () => room.practice() }],
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
const me = () => { const p = state.players.find(p => p.id === room.id); const predicted = room.predicted; return predicted && p ? { ...p, x: predicted.x, z: predicted.z, y: predicted.y, vx: predicted.vx, vz: predicted.vz, moving: predicted.moving, stamina: predicted.stamina } : p; };
const looking = createLookControls(canvas, { enabled: () => playing(), look: (yaw, pitch) => view.look(yaw, pitch),
  press(event) { sound.unlock(); if (event.button === 0) act('use', { hand: 0 }); if (event.button === 2) act('use', { hand: 1 }); },
  unlocked: () => { if (state.phase === 'playing') menu.open('game'); } });

function lobby() {
  optionsUI.update(state.options || DEFAULT_OPTIONS, room.connected && room.isHost && state.phase !== 'playing');
  if (state.phase === 'playing' && optionsUI.isOpen) optionsUI.close();
  show('lobby', state.phase === 'lobby'); show('hud', state.phase === 'playing'); show('results', state.phase === 'results');
  $('lobby-floors').textContent = state.options?.floors || 3;
  $('start').disabled = !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡A la mina!' : 'El anfitrión prepara la salida';
  if (state.phase === 'results') hud.results(state, room);
}

// Big tilted callouts for the beats of a run; the toast keeps the full sentence.
const SHOUTS = { seal: ['¡Se abrió la bajada!', 'teal'], boss: ['¡Despertó algo grande!', 'coral'], guardian: ['¡Guardián vencido!', 'yellow'], jaguar: ['¡Jaguar vencido!', 'yellow'],
  curse: ['¡Maldición!', 'coral'], collapse: ['¡Derrumbe!', 'coral'], stalker: ['¡Los están cazando!', 'coral'], down: ['¡Pana caído!', 'coral'], reveal: ['¡Sala escondida!', 'teal'] };
const QUIET = new Set(['pick', 'hit', 'swing', 'shot', 'hurt', 'stairs', 'throw', 'drop', 'trap', 'pounce', 'bark', 'chest', 'winch']);
function handle(e) {
  const mine = e.player === room.id, p = me(), seat = state.players.find(q => q.id === e.player)?.seat ?? 0;
  const near = p && e.player != null ? (() => { const q = state.players.find(q => q.id === e.player); return q && floorOf(q.x) === floorOf(p.x) ? Math.max(.25, 1 - Math.hypot(q.x - p.x, q.z - p.z) / 30) : 0; })() : 1;
  if (e.text && !QUIET.has(e.kind)) notify(e.text);
  const big = SHOUTS[e.kind]; if (big) shout(e.kind === 'greed' ? e.text : big[0], { tone: big[1] });
  switch (e.kind) {
    case 'pick': if (near) (ITEMS[e.item].size === 'bag' ? ['emerald', 'pearl'].includes(e.item) ? sfx.gem : sfx.coin : sfx.grab)(); break;
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
    case 'descend': shout(`Piso ${e.floor}: ${FLOOR_NAMES[e.floor] || 'el oro profundo'}`, { tone: 'yellow' }); break;
    case 'trap': if (near) sfx.trap(); break;
    case 'hurt': if (mine) { sfx.hurt(); view.shake(.35); } break;
    case 'down': sfx.down(); break;
    case 'revive': sfx.revive(); break;
    case 'awaken': sfx.awaken(); break;
    case 'boss': sfx.boss(); view.shake(.4); break;
    case 'pounce': { sfx.pounce(); if (p) view.shake(Math.max(0, 1 - Math.hypot(e.x - p.x, e.z - p.z) / 18)); view.waves.ring({ x: e.x, y: .1, z: e.z }, { color: 0xffc23d, maxRadius: 3 }); break; }
    case 'greed': sfx.greed(); view.shake(.4); shout(e.text, { tone: 'coral' }); break;
    case 'collapse': sfx.collapse(); view.shake(.9); break;
    case 'laugh': sfx.laugh(); break;
    case 'cart-load': case 'cart-catch': case 'cart-big': sfx.coin(); if (e.kind !== 'cart-load') sfx.bank(false); break;
    case 'cart-grab': sfx.grab(); break;
    case 'lift': sound.clickUp(); sfx.stairs(); if (e.players?.includes(room.id)) fade(); break;
    case 'winch': sound.clickUp(); break;
    case 'extracted': sfx.win(); break;
    case 'wipe': sfx.wipe(); break;
    case 'bark': {
      const text = e.text || BARKS[e.line]; view.bark(e.player, text); sfx.bark(seat, near || .3); hud.vote(e.player, e.line, state.time);
      if (!mine && !near) notify(`${state.players.find(q => q.id === e.player)?.name}: ${text}`);
      break;
    }
  }
  // Your own trip up or down the stairs fades to black and back.
  if (e.kind === 'stairs' && (mine || e.players?.includes(room.id))) { sfx.stairs(); fade(); }
}
function fade() { $('fade').classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => $('fade').classList.remove('on'))); }
function receive(next) {
  state = next;
  view.reseed(state.seed, state.options?.floors || 3);
  if (phase !== state.phase) {
    phase = state.phase; menu.close(); clearInput(); document.body.classList.toggle('playing', phase === 'playing');
    if (phase === 'playing') { const p = state.players.find(p => p.id === room.id); if (p) view.heading = p.h; lastEvent = Math.max(lastEvent, ...state.events.filter(e => e.kind !== 'start').map(e => e.id), 0); }
    if (phase !== 'playing') looking.release();
  }
  // Local practice and a fresh host start a new count.
  const top = Math.max(0, ...state.events.map(e => e.id)); if (top < lastEvent) lastEvent = top;
  for (const e of state.events) if (e.id > lastEvent) { lastEvent = e.id; if (state.phase !== 'lobby') handle(e); }
  // Arriving on a new floor turns you the way the stairs face.
  const p = state.players.find(p => p.id === room.id);
  if (p && floorOf(p.x) !== myFloor) { myFloor = floorOf(p.x); view.heading = p.h; }
  lobby();
}
function act(action, extra = {}) { if (playing()) room.action(action, extra); }
$('start').onclick = () => { sound.unlock(); room.action('start'); }; $('again').onclick = () => room.action('start');
$('practice').onclick = $('offline-inline').onclick = () => room.practice();
// Touch: hold buttons for moving and grabbing, taps for the rest.
drawIcons();
if (isTouch()) { $('hand-0').querySelector('.pk-slot-n').textContent = 'Usar'; $('hand-1').querySelector('.pk-slot-n').textContent = 'Izq.'; }
const pads = [];
for (const button of document.querySelectorAll('[data-move]')) pads.push(holdButton(button, { paused: () => !playing(), down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) }));
pads.push(holdButton($('t-grab'), { paused: () => !playing(), down: () => { touch.add('e'); act('interact'); }, up: () => touch.delete('e') }));
let touchBark = 0;
for (const [id, run] of [['t-use', () => act('use', { hand: 0 })], ['t-left', () => act('use', { hand: 1 })], ['t-throw', () => act('throw')], ['t-drop', () => act('drop')], ['t-bark', () => { act('bark', { line: touchBark }); touchBark = (touchBark + 1) % BARKS.length; }]])
  pads.push(holdButton($(id), { paused: () => !playing(), down: run }));
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || menu.isOpen) return;
  const key = e.key.toLowerCase();
  if (key === 'tab') { e.preventDefault(); if (state.phase === 'playing') hud.board(true, state, room); return; }
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) e.preventDefault();
  if (!playing()) return;
  keys.add(key); if (e.repeat) return;
  if (key === ' ') act('use', { hand: 0 }); if (key === 'f') act('use', { hand: 1 });
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
  return { ...view.movement(x, z), h: view.heading, pitch: view.pitch, sprint: keys.has('shift'), hold: k('e') };
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
  uiAt -= dt; if (uiAt <= 0 && state.phase === 'playing') { uiAt = .066; hud.update(state, p, room, { heading: view.heading, paused: menu.isOpen }); }
  requestAnimationFrame(frame);
}
show('loading', false); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { dead = true; clearInterval(ticker); notify.dispose(); room.dispose(); menu.dispose?.(); looking.dispose(); view.dispose(); });
if (qs.has('debug')) window.reliquia = { room, view, menu, input, interaction, money,
  get state() { return state; }, get me() { return me(); },
  step(seconds) { if (!room.isHost) return; for (let t = 0; t < seconds; t += .05) room.game.update(Math.min(.05, seconds - t), room.inputs); room.publish(); },
  place(id, x, z, h) { const p = room.game?.players.find(p => p.id === id); if (p) { p.x = x; p.z = z; if (h !== undefined) p.h = h; room.publish(); } },
  face(h) { view.heading = h; },
};

await prepareScene({ renderer: view.renderer, scene: view.scene, camera: view.camera });
