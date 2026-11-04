import { createRoomOptions } from '/engine/room-options.js';
import { prepareScene } from '/engine/game-load.js';
import { loadAvatar, loadName } from '/engine/avatar.js';
import { sound, popCounter } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { inviteUrl } from '/engine/invite.js';
import { roomCode } from '/engine/game-shell.js';
import { holdButton, drawIcons } from '/engine/touch.js';
import { shout } from '/engine/kit.js';
import { createToast } from '/engine/hud.js';
import { createHoldOverlay } from '/engine/hold-overlay.js';
import { elapsedClock } from '/engine/live-room.js';
import { createLookControls } from '/engine/play/first-person.js';
import { pressJump } from '/engine/play/jump.js';
import { createFootsteps } from '/engine/play/footsteps.js';
import { sfx as sfxLib } from '/engine/sfx.js';
import { fieldsFor, DEFAULT_OPTIONS, SCARES, loadScares, saveScares, shakeFor } from './options.js';
import { createEerieFx } from './eerie-fx.js';
import { Expedition, BARKS, interaction } from './rules.js';
import { spawnEnemy } from './enemies.js';
import { startSwarm } from './swarm.js';
import { startSuceso } from './sucesos.js';
import { ExpeditionRoom } from './network.js';
import { createView } from './view.js';
import { createHud, money } from './hud.js';
import { createFosaProgress } from './progress.js';
import { createFosaDaily } from './daily.js';
import { sfx } from './sounds.js';
import { createAmbience } from './ambience.js';
import { createSamples } from './samples.js';
import { createPresence } from './presence.js';
import { floorOf, jornadaName, themeOf } from './deck.js';
import { ITEMS, say } from './items.js';
import { loc } from '/engine/i18n.js';

const $ = id => document.getElementById(id), show = (id, on) => $(id).classList.toggle('hidden', !on);
const notify = createToast($('toast'), { ms: 3400 });
const qs = new URLSearchParams(location.search), code = roomCode();
const avatar = loadAvatar(), name = qs.get('name')?.slice(0, 16) || loadName();
const canvas = $('world'), view = createView(canvas), hud = createHud(), ambience = createAmbience(), samples = createSamples(), diver = createFosaProgress();
// Scares are cosmetic and this screen's own; "Sustos" softens or stops them.
let scares = loadScares(), dreadShown = -1; view.shakeScale = shakeFor(scares); view.scares = scares;
const presence = createPresence({ view, ambience, samples });
view.swarm.onHiss = (x, z) => ambience.at('slither', me(), view.heading, x, z, 16);
const fx = createEerieFx({ view, ambience, samples, dread: v => { const r = Math.round(v * 20) / 20; if (r !== dreadShown) { dreadShown = r; $('dread').style.opacity = r; } } });
let state = new Expedition().snapshot(), phase = '', lastEvent = 0, failed = false, dead = false, myFloor = 0, uiAt = 0, last = performance.now();
const keys = new Set(), touch = new Set();
let jumpPress = 0;
const heard = {};   // what samples.js reads each frame, reused
const feet = createFootsteps();   // steps by distance walked, plus take-off and landing
// Recorded steps on boards and stone once they load; the synth meanwhile and on dirt.
const stepSink = { step: (surface, o) => samples.step(surface, o) || sfxLib.step(surface, o), jump: sfxLib.jump, land: sfxLib.land };
function jump(){if(playing())jumpPress=pressJump(jumpPress);}
function clearInput() { keys.clear(); touch.clear(); }
const solo = () => room.offline || room.members.size === 1;
const playing = () => state.phase === 'playing' && !menu.isOpen;
// Map, compass, the jornada's numbers and the team: only while Tab / View is held.
const intel = createHoldOverlay({ keys: ['Tab'], enabled: () => playing(), change: on => hud.info(on) });

const menu = createGameMenu({
  pad: { move: 'wasd', look: loc('Mirar'), keys: { rt: ['KeyV', loc('Usar lo de la mano derecha')], a: ['Space', loc('Saltar')], lt: ['KeyF', loc('Usar lo de la mano izquierda')], x: ['KeyE', loc('Agarrar o abrir; mantén para girar')], b: ['KeyQ', loc('Soltar')], y: ['KeyG', loc('Lanzar')], rb: ['KeyR', loc('Arrastrar a un pana')], lb: ['ShiftLeft', loc('Correr')], ls: ['ShiftLeft', loc('Correr')], view: ['Tab', loc('Ver el mapa y la expedición')] } },
  title: 'Fosa', heading: loc('Un respiro'), resumeLabel: loc('Volver a la mina'), sound, notify,
  note: () => solo() ? loc('La expedición está en pausa.') : loc('Tus panas siguen en la mina.'),
  options: [{ ...SCARES, get: () => scares, set: v => { if (saveScares(v)) { scares = v; view.shakeScale = shakeFor(v); view.scares = v; } } }],
  actions: [{ id: 'offline', label: loc('Abrir expedición local'), kind: 'link', visible: () => failed, run: () => room.practice() }],
  invite: () => inviteUrl(code),
  onOpen() { clearInput(); looking.release(); intel.release(); }, onClose() {},
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn pk-btn--sm' }), menu.createSoundButton({ id: 'sound', className: 'pk-btn pk-btn--sm' }), menu.createButton({ id: 'menu', className: 'pk-btn pk-btn--sm' }));
$('lobby-cta').append(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
const room = new ExpeditionRoom({ code, name, avatar, onState: receive, onNotice: notify,
  onStatus(text, error = false) { failed = error; $('connection').textContent = text; show('practice', error); show('disconnect', error && state.phase === 'playing'); menu.update(); lobby(); },
});
// The tagline sits beside the name in the shared lobby's header.
{ const tagline = document.createElement('p'); tagline.className = 'lobby-tagline'; tagline.textContent = loc('Bajen juntos. No se desarmen.'); document.querySelector('.pk-game-lobby-head > .pk-title')?.after(tagline); }
const optionsUI = createRoomOptions($('room-options'), { title: 'Fosa', fields: fieldsFor(diver.progress.isUnlocked), change: options => room.action('configure', { options }), reset: () => room.action('configure', { options: DEFAULT_OPTIONS }) });
const showCalor = diver.calorChip($('room-options').querySelector('.pk-room-primary'));
const daily = createFosaDaily({ progress: diver.progress, shout, start: day => { sound.unlock(); room.action('start', { daily: day }); } });
// A guest draws its own explorer where it predicts it, not a round trip behind.
const me = () => { const p = state.players.find(p => p.id === room.id); const predicted = room.predicted; return predicted && p ? { ...p, x: predicted.x, z: predicted.z, y: predicted.y, vx: predicted.vx, vz: predicted.vz, moving: predicted.moving, stamina: predicted.stamina, jumpHeight: predicted.jumpHeight ?? p.jumpHeight } : p; };
const looking = createLookControls(canvas, { enabled: () => playing(), look: (yaw, pitch) => view.look(yaw, pitch),
  press(event) { sound.unlock(); if (event.button === 0) act('use', { hand: 0 }); if (event.button === 2) act('use', { hand: 1 }); },
  unlocked: () => { if (state.phase === 'playing') menu.open('game'); } });

function lobby() {
  optionsUI.update(state.options || DEFAULT_OPTIONS, room.connected && room.isHost && state.phase !== 'playing'); showCalor(state.options);
  if (state.phase === 'playing' && optionsUI.isOpen) optionsUI.close();
  show('lobby', state.phase === 'lobby'); show('hud', state.phase === 'playing'); show('results', state.phase === 'results');
  $('start').disabled = !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? loc('Conectando…') : room.isHost ? loc('¡A la mina!') : loc('El anfitrión prepara la salida');
  daily.update(state, room);
  if (state.phase === 'results') { hud.results(state, room); diver.settle(state, room.id, daily.settled); }
}

// Big tilted callouts for the beats of a run; the toast keeps the full sentence.
const SHOUTS = { seal: [loc('¡Se abrió la bajada!'), 'teal'], boss: [loc('¡Despertó algo grande!'), 'coral'], guardian: [loc('¡Guardián vencido!'), 'yellow'], 'silbon-down': [loc('¡Se fue al abismo!'), 'yellow'], jaguar: [loc('¡Jaguar vencido!'), 'yellow'],
  curse: [loc('¡Maldición!'), 'coral'], collapse: [loc('¡Derrumbe!'), 'coral'], stalker: [loc('¡Los están cazando!'), 'coral'], down: [loc('¡Pana caído!'), 'coral'], reveal: [loc('¡Sala escondida!'), 'teal'], 'encargo-paid': [loc('¡Encargo cumplido!'), 'yellow'] };
const QUIET = new Set(['suceso', 'encargo', 'pick', 'hit', 'swing', 'shot', 'hurt', 'throw', 'drop', 'trap', 'pounce', 'bark', 'chest', 'winch', 'search']);
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
    // A searched hiding spot: what it gave is news for everyone; dust only for you.
    case 'search': if (said && (mine || e.found || e.trap)) notify(said); if (near) { sfx.search(e.found, !e.found && !!e.item); samples.searched(e.spot); } if (e.trap) { sfx.awaken(); view.shake(.3); } if (e.found) { const sp = view.world.run.spots.find(s => s.id === e.spot); if (sp) view.waves.sparkle({ x: sp.x, y: 1, z: sp.z }, { color: 0xd8dde6, count: 8 }); } break;
    case 'chest': sfx.chest(); { const c = view.world.run.chests.find(c => c.id === e.chest); if (c) view.waves.sparkle({ x: c.x, y: 1, z: c.z }, { color: 0xffd36a, count: 10 }); } break;
    case 'bank': sfx.bank(e.big); popCounter($('haul')); break;
    case 'throw': if (near) sfx.throw(); break;
    case 'bonk': sfx.bonk(); if (mine || e.player === room.id) view.shake(.5); break;
    case 'tip': sfx.tip(); break;
    case 'lost': sfx.lost(); break;
    case 'curse': sfx.curse(); view.shake(.3); break;
    case 'seal': sfx.seal(); view.shake(.5); break;
    case 'descend': if (e.players?.includes(room.id)) shout(loc('Jornada {n} · {place}', { n: state.level, place: loc(jornadaName(state.level, themeOf(state))) }), { tone: 'yellow' }); break;
    case 'trap': if (near) sfx.trap(); break;
    case 'hurt': if (mine) { sfx.hurt(); view.shake(.35); } break;
    case 'down': sfx.down(); break;
    case 'revive': sfx.revive(); break;
    case 'awaken': sfx.awaken(); break;
    case 'boss': sfx.boss(); view.shake(.4); break;
    case 'pounce': { sfx.pounce(); if (p) view.shake(Math.max(0, 1 - Math.hypot(e.x - p.x, e.z - p.z) / 18)); view.waves.ring({ x: e.x, y: .1, z: e.z }, { color: 0xffc23d, maxRadius: 3 }); break; }
    case 'greed': sfx.greed(); view.shake(.4); shout(said, { tone: 'coral' }); break;
    case 'collapse': sfx.collapse(); view.shake(.9); break;
    // What the jornada does on its own: the whole sentence is the shout.
    case 'suceso': shout(said, { tone: 'coral' }); if (e.suceso === 'apagon') sfx.blackout(); else if (e.suceso === 'murcielagos') sfx.flap(); else sfx.shaking(); view.shake(.45); break;
    case 'encargo': shout(said, { tone: 'teal' }); break;
    case 'rock': { const d = p ? Math.hypot(e.x - p.x, e.z - p.z) : 99, close = p && floorOf(e.x) === floorOf(p.x) ? Math.max(0, 1 - d / 14) : 0; if (close) { sfx.rock(close); view.shake(close * .7); view.puffs.spawn({ x: e.x, y: .3, z: e.z }, { color: 0xb8a888, count: 8, spread: 1, size: .7, rise: 1, life: .9 }); } break; }
    case 'crack': if (p && floorOf(e.x) === floorOf(p.x)) { sfx.trap(); view.puffs.spawn({ x: e.x, y: 4.2, z: e.z }, { color: 0xc9b48a, count: 6, spread: .5, size: .4, rise: -2.8, life: 1 }); } break;
    case 'spores': if (p && floorOf(e.x) === floorOf(p.x)) { sfx.spores(); view.puffs.spawn({ x: e.x, y: .5, z: e.z }, { color: 0x9fe05a, count: 14, spread: 1.6, size: 1, rise: .7, life: 2 }); } break;
    case 'flare': sfx.flare(); break;
    case 'rope': case 'tied': if (near) sfx.rope(); break;
    case 'twin': sound.clickDown(); break;
    case 'encargo-paid': sfx.bank(true); popCounter($('mangos')); break;
    case 'laugh': sfx.laugh(); break;
    case 'level': sfx.win(); shout(loc('¡Jornada {n} lista!', { n: e.level }), { tone: 'yellow' }); break;
    case 'buy': sfx.bank(false); break;
    case 'cargo': sfx.lift(); break;
    case 'delivered': sfx.bank(true); popCounter($('mangos')); if (e.met) shout(loc('¡Cuota lista! Al montacargas'), { tone: 'teal' }); break;
    case 'spider': sfx.awaken(); view.shake(.2); break;
    case 'scatter': if (near) sfx.flap(); break;
    // The swarm's telegraph: a hiss from each crack, heard across the floor.
    case 'swarm': if (p && floorOf(p.x) === e.floor) { for (const h of e.holes) ambience.at('swarmHiss', p, view.heading, h.x, h.z, 70); view.shake(.15); } break;
    case 'snake-scatter': view.swarm.scatter(e); break;
    case 'screech': if (p) ambience.at('screech', p, view.heading, e.x, e.z, 26); break;
    case 'silbon-falling': { const b = state.enemies.find(q => q.id === e.enemy); if (p && b) ambience.at('plummet', p, view.heading, b.x, b.z, 40); view.shake(.3); break; }
    case 'silbon-down': sfx.seal(); view.shake(.6); break;
    case 'flush': sfx.bonk(); if (mine) view.shake(.7); break;
    case 'cart-spill': case 'cart-bounce': sfx.tip(); break;
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
  view.reseed(state.seed, state.level || 1, themeOf(state));
  if (phase !== state.phase) {
    phase = state.phase; menu.close(); clearInput(); document.body.classList.toggle('playing', phase === 'playing');
    if (phase === 'playing') { const p = state.players.find(p => p.id === room.id); if (p) view.heading = p.h; if (qs.has('debug') && Number(qs.get('jornada')) > 1) queueMicrotask(() => window.reliquia?.jornada(Number(qs.get('jornada')))); if (qs.has('debug') && Number(qs.get('snakes')) > 0) queueMicrotask(() => window.reliquia?.snakes(Number(qs.get('snakes')))); lastEvent = Math.max(lastEvent, ...state.events.filter(e => e.kind !== 'start').map(e => e.id), 0); }
    if (phase !== 'playing') looking.release(); intel.release();
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
$('start').onclick = () => { sound.unlock(); room.action('start', daily.startOptions()); }; $('again').onclick = () => room.action('start');
$('practice').onclick = $('offline-inline').onclick = () => room.practice();
// Touch: hold buttons for moving and grabbing, taps for the rest.
drawIcons();
const pads = [];
for (const button of document.querySelectorAll('[data-move]')) pads.push(holdButton(button, { paused: () => !playing(), down: () => touch.add(button.dataset.move), up: () => touch.delete(button.dataset.move) }));
pads.push(holdButton($('t-intel'), { paused: () => !playing(), down: () => intel.toggle('touch') }));
pads.push(holdButton($('t-grab'), { paused: () => !playing(), down: () => { touch.add('e'); act('interact'); }, up: () => touch.delete('e') }));
let touchBark = 0;
for (const [id, run] of [['t-jump', jump], ['t-use', () => act('use', { hand: 0 })], ['t-left', () => act('use', { hand: 1 })], ['t-throw', () => act('throw')], ['t-drop', () => act('drop')], ['t-bark', () => { act('bark', { line: touchBark }); touchBark = (touchBark + 1) % BARKS.length; }]])
  pads.push(holdButton($(id), { paused: () => !playing(), down: run }));
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || menu.isOpen) return;
  const key = e.key.toLowerCase();
  if (key === 'tab') return;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) e.preventDefault();
  if (!playing()) return;
  keys.add(key); if (e.repeat) return;
  if (key === ' ') jump(); if (key === 'v') act('use', { hand: 0 }); if (key === 'f') act('use', { hand: 1 });
  if (key === 'e') act('interact'); if (key === 'q') act('drop'); if (key === 'g') act('throw'); if (key === 'r') act('drag');
  if (/^[1-7]$/.test(key)) act('bark', { line: Number(key) - 1 });
  if (key === 'm') toggleMute();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
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
  const theme = view.world.run.theme;
  const surface = p && floorOf(p.x) ? theme === 'biblioteca' ? 'wood' : theme === 'inundada' ? 'water' : theme === 'hongos' ? 'dirt' : 'stone' : 'dirt';
  ambience.update(state, p, view.heading, dt, theme, !samples.ownSteps(surface));
  heard.state = state; heard.me = p; heard.heading = view.heading; heard.paused = menu.isOpen; heard.theme = theme; heard.floor = p ? view.world.floors.get(floorOf(p.x)) : null; heard.run = view.world.run;
  samples.update(dt, heard);   // wind, drips, chandeliers, and hiding spots creaking as a search starts
  fx.update(dt, { state, me: p, heading: view.heading, paused: menu.isOpen, scares, run: view.world.run });
  presence.update(dt, { state, me: p, heading: view.heading, paused: menu.isOpen, scares });   // mummies felt before seen
  if (p && state.phase === 'playing' && !p.downed && !p.spectator) { const speed = p.moving ? Math.hypot(p.vx, p.vz) : 0; feet.update(dt, { speed, height: p.jumpHeight || 0, sprint: speed > 5.4, surface, volume: .8 }, stepSink); }
  else feet.reset();
  intel.check();
  uiAt -= dt; if (uiAt <= 0 && state.phase === 'playing') { uiAt = .066; hud.update(state, p, room, { heading: view.heading, paused: menu.isOpen }); }
  requestAnimationFrame(frame);
}
show('loading', false); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { dead = true; clearInterval(ticker); notify.dispose(); intel.dispose(); room.dispose(); menu.dispose?.(); looking.dispose(); fx.dispose(); view.dispose(); });
if (qs.has('debug')) window.reliquia = { room, view, menu, input, interaction, money,
  get state() { return state; }, get me() { return me(); },
  step(seconds) { if (!room.isHost) return; for (let t = 0; t < seconds; t += .05) room.game.update(Math.min(.05, seconds - t), room.inputs); room.publish(); },
  place(id, x, z, h) { const p = room.game?.players.find(p => p.id === id); if (p) { p.x = x; p.z = z; if (h !== undefined) p.h = h; room.publish(); } },
  face(h, pitch) { view.heading = h; if (pitch !== undefined) view.pitch = pitch; },
  // Force a scare now: silhouette, jumpscare, bookFall, flicker, candleOut, slam, thud, whisper, heartbeat, fogSurge, farolStutter.
  scare(kind) { fx.force(kind, { state, me: me(), heading: view.heading }); },
  // Stand in front of a hiding spot (the nth on this floor, or of a kind) and look at it.
  spot(which = 0) { const run = view.world.run, list = run.spots.filter(s => typeof which !== 'string' || s.kind === which), sp = typeof which === 'number' ? run.spots[which] : list[0]; if (!sp) return null; const d = (sp.wall ? .75 : .9) + 1, x = sp.x + Math.sin(sp.h) * d, z = sp.z + Math.cos(sp.h) * d, h = Math.atan2(sp.x - x, sp.z - z); this.place(room.id, x, z, h); view.heading = h; view.pitch = -.3; return sp; },
  // Skip ahead to jornada n (with Alternar, odd jornadas are the library): host only.
  jornada(n) { const g = room.game; if (!room.isHost || !g || g.phase !== 'playing') return false; while (g.level < n) g.completeLevel(); room.publish(); return g.level; },
  // Spawn an enemy `ahead` metres in front of you (`side` to the right): host only.
  // (or on the nearest open floor around that point).
  spawn(kind, ahead = 3, side = 0) {
    const g = room.game, p = g?.players.find(p => p.id === room.id); if (!room.isHost || !p) return null;
    const h = p.h, x = p.x + Math.sin(h) * ahead - Math.cos(h) * side, z = p.z + Math.cos(h) * ahead + Math.sin(h) * side;
    let e = null; for (let r = 0; r < 3 && !e; r += .5) for (let a = 0; a < 8 && !e; a++) e = spawnEnemy(g, kind, x + Math.cos(a * .785) * r, z + Math.sin(a * .785) * r, { born: g.time - 9, awake: true, h: h + Math.PI });
    room.publish(); return e && { id: e.id, x: e.x, z: e.z };
  },
  // A swarm of n snakes now, on your floor (first down the shaft if you are at the camp): host only. Also ?debug&snakes=n.
  snakes(n = 60) {
    const g = room.game, p = g?.players.find(q => q.id === room.id); if (!room.isHost || !p || g.phase !== 'playing') return false;
    if (!floorOf(p.x)) { const stop = g.layout.run.lifts.find(l => l.floor === 1); Object.assign(p, { x: stop.x, z: stop.z - 5, h: Math.PI }); }
    g.swarm = null; g.swarmSim = null;
    const started = startSwarm(g, floorOf(p.x), n); room.publish(); return started;
  },
  // Force a suceso now (apagon, murcielagos, derrumbe, creciente, esporada): host only.
  suceso(kind) { const g = room.game; if (!room.isHost || !g) return false; const ok = startSuceso(g, kind); room.publish(); return ok; },
  fx, samples,
  // The Tab / View layer: reliquia.info (open?) and reliquia.showInfo(true | false).
  get info() { return hud.infoOpen; }, showInfo(on) { intel.release(); if (on) intel.toggle('debug'); },
};

await prepareScene({ renderer: view.renderer, scene: view.scene, camera: view.camera });
