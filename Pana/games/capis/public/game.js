// Wiring only: keys, mouse and touch → the match (rules.js) and the bot
// (bot.js) → the 3D scene, the HUD and the sounds. Solo against the machine
// runs the match here; with friends the room's host runs it (network.js,
// online.js) and everyone draws its copy, so the same code shows both.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton, drawIcons } from '/engine/touch.js';
import { sound } from '/engine/fx.js';
import { sfx, pitch } from '/engine/sfx.js';
import { createVoices } from '/engine/voice.js';
import { bootGame } from '/engine/game-shell.js';
import { createToast } from '/engine/hud.js';
import { createRoomOptions } from '/engine/room-options.js';
import { createTeamLobby } from '/engine/team-lobby.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { elapsedClock } from '/engine/live-room.js';
import { createShotCharge, paintCharge } from '/engine/play/shot-charge.js';
import { pressJump } from '/engine/play/jump.js';
import { difficultyInfo } from '/engine/play/difficulty.js';
import { loc } from '/engine/i18n.js';
import { ROOM_OPTIONS, defaultOptions, roomOptions } from './options.js';
import { createMatch, tickMatch, takeEvents, activeCapy, fire, canUse, TEAM_COLORS, FFA_SIZE } from './rules.js';
import { WEAPON_IDS, weaponOf } from './weapons.js';
import { createBot } from './bot.js';
import { createHud, createTombPicker } from './hud.js';
import { TOMBS, createTombStore } from './tombs.js';
import { mapSeed, mapSize, SEED_LIMIT } from './map-rules.js';
import { CapisRoom } from './network.js';
import { PAD } from './pad.js';
import { teamOf, botTeams, sidesOf, freshEvents, TEAM_MAX, setupView } from './online.js';
import { createSetup, choose as chooseMap, place, launch, seedOf, groundOf, spotProblem } from './setup-rules.js';
import { createSetupView, setupError } from './setup-view.js';
import { surfaceY } from '/engine/play/terrain-mask.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const HUMAN = 0, STEP = 1 / 60;
// Every match is a new map from a seed; ?seed=12345 (and ?size=large) replays one.
const newSeed = () => 1 + Math.floor(Math.random() * (SEED_LIMIT - 1));
let options = { ...defaultOptions(), ...(params.has('size') ? { size: mapSize(params.get('size')) } : {}) };
if (params.get('mode') === 'ffa') options = roomOptions(options, { mode: 'ffa' });
let seed = mapSeed(params.get('seed')) ?? newSeed();
// The kind of ground the seed made (map-rules.js KINDS), shown with its number.
const KIND_NAMES = { cerros: loc('Cerros'), cuevas: loc('Montaña de cuevas'), islas: loc('Islas con puentes'), valle: loc('Valle con laguna'),
  terrazas: loc('Terrazas del tepuy'), suave: loc('Lomas suaves') };
const mapLabel = m => loc('Mapa #{n} · {kind}', { n: m.seed, kind: KIND_NAMES[m.kind] || '' });
const preLobby = () => createMatch({ seed, size: options.size, mode: options.mode });
let world = null, match = preLobby(), playing = false, bots = [], acc = 0;

// ---------- the room (with friends) ----------
// `online` once the pana chose Con amigos or came with a ?room= link.
const code = roomFromUrl() || newRoomCode(), notify = createToast($('toast'), { ms: 2600 });
let online = false, seen = -1, lastTime = 0, shownRoom = '';
const room = new CapisRoom({ code, name: loadName(), avatar: loadAvatar(), onState: roomState, onNotice: notify,
  onStatus(text, failed) {
    $('connection').textContent = text;
    // No room after every retry (or a full one): back to single player.
    if (failed && (text === room.texts.offline || text === room.texts.full)) leaveRoom(text);
  } });
const myTeam = () => online ? teamOf(room.state.players, room.id) ?? 0 : HUMAN;
const nameOfPana = id => room.state.players.find(p => p.id === id)?.name || '';
// Who plays the capi on its turn: 'me', another pana's name, or null (the machine).
const side = {
  team: myTeam,
  player: m => online ? (room.state.controller == null ? null : room.state.controller === room.id ? 'me' : nameOfPana(room.state.controller) || null) : activeCapy(m)?.team === HUMAN ? 'me' : null,
  teamName: team => team === myTeam() ? loc('Tus capis') : !online || botTeams(room.state.players, sidesOf(options)).includes(team) ? loc('La máquina') : loc('Rivales'),
};
const hud = createHud($, { side, pick: id => choose(id) });
// The tombstone this player's capis leave. Shapes still locked wait for the shop (tombs.js).
const tombs = createTombStore(), looks = () => ({ [HUMAN]: tombs.chosen() });
let tombAsked = null;
const tellTomb = () => { if (online && room.connected && tombAsked !== tombs.chosen()) { tombAsked = tombs.chosen(); room.action('tomb', { shape: tombAsked }); } };
createTombPicker($('tomb-list'), { tombs, shapes: TOMBS, change: tellTomb, locked: () => notify(loc('Muy pronto')) });
const TEAM_TITLES = [loc('Rosados'), loc('Verdes')];
const roster = createTeamLobby($('capis-roster'), { titles: TEAM_TITLES, colors: TEAM_COLORS, onMove: (from, to) => {
  const p = seatList()[from]?.player;
  if (p?.id != null) room.action('team', { id: p.id, team: Math.floor(to / TEAM_MAX) });
} });
function seatList() {
  const bots = botTeams(room.state.players);
  return [0, 1].flatMap(team => { const list = room.state.players.filter(p => p.team === team);
    return Array.from({ length: TEAM_MAX }, (_, i) => ({ key: team * TEAM_MAX + i, team,
      player: list[i] ? { ...list[i] } : bots.includes(team) && !i ? { id: null, bot: true, name: loc('La máquina') } : null })); });
}

function goOnline() {
  if (online) return;
  // A room that gave up (offline) never reconnects: open its link afresh.
  if (room.offline) { location.assign(inviteUrl(code)); return; }
  online = true; seen = -1;
  params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
  $('connection').textContent = room.texts.connecting;
  room.connect(); lobbyView();
}
function leaveRoom(text) {
  if (!online) return;
  online = false; room.practice(); params.delete('room');
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`);
  if (text) notify(text);
  if (playing) toLobby(); else { match = preLobby(); preview(); }
  lobbyView();
}
$('online').onclick = goOnline;

// Every snapshot (the host's own too): the lobby, the match and its events.
function roomState(state) {
  if (!online) return;
  if (state.phase === 'setup' && state.setup) showSetup(state.setup);
  if (state.phase === 'lobby') {
    if (state.players.some(p => p.id === room.id)) tellTomb();
    const played = playing || match === room.view;
    if (playing || inSetup) toLobby();
    options = { ...state.options };
    // The lobby previews the room's map; after a match, the ground comes back whole.
    if (played) { seed = state.seed; match = preLobby(); }
    if (played || state.seed !== seed || !previewed()) { seed = state.seed; preview(); }
  }
  const m = room.match;
  if (state.phase === 'play' && m) {
    if (m !== match) { match = m; world?.setMatch(match); hud.build(match); begin(); }
    // A rematch on the same map: the results card goes away.
    else if (!playing || (!$('results').hidden && m.phase !== 'finished')) begin();
  }
  // A pana who just arrived hears nothing of what happened before.
  const events = freshEvents(state, seen);
  if (seen < 0) seen = Math.max(0, ...state.events.map(e => e.n));
  else for (const e of events) { seen = e.n; handle(e); }
  // The lobby only when something it shows changed (snapshots come 20 a second).
  const key = [state.phase, state.revision, room.id, room.hostId, room.connected, ...(room.link?.state.players || []).map(p => `${p.seat}:${p.lobbyReady}:${p.assetsReady}`)].join('|');
  if (key !== shownRoom) { shownRoom = key; lobbyView(); }
}

// The lobby's buttons, team cards and settings for solo or for the room.
function lobbyView() {
  const host = !online || room.isHost;
  $('online').hidden = online;
  $('connection').hidden = !online;
  $('start').disabled = !world || (online && (!room.connected || !room.isHost));
  $('start').textContent = !world ? loc('Preparando…') : !online ? loc('Jugar solo') : !room.connected ? loc('Conectando…') : room.isHost ? loc('¡A pintar!') : loc('Espera al anfitrión');
  panel.update(options, host);
  $('seed-input').disabled = $('seed-new').disabled = !host;
  roster.update({ teams: online && options.mode !== 'ffa', seats: online ? seatList() : [], ownId: room.id, hostId: room.hostId, enabled: room.connected, canArrange: room.isHost, members: room.link?.state.players || [] });
  for (const id of ['again', 'same-map']) $(id).disabled = online && !room.isHost;
  $('again').textContent = online && !room.isHost ? loc('Espera al anfitrión') : loc('Otra partida');
}

// The lobby shows the map the match will be played on.
const previewed = () => match.map.seed === seed && match.map.size === (options.mode === 'ffa' ? FFA_SIZE : options.size) && match.mode === options.mode;
function preview() {
  if (!previewed()) match = preLobby();
  world?.setMatch(match); hud.build(match);
  $('seed-input').value = String(seed); $('lobby-seed').textContent = mapLabel(match.map);
}
const changeOptions = patch => {
  if (online) { room.action('options', { options: patch }); return; }
  options = roomOptions(options, patch) || options; panel.update(options, true); preview();
};
const panel = createRoomOptions($('room-options'), { title: 'Capis a Pintazos', fields: ROOM_OPTIONS, // i18n-ignore: the game's name
  change: changeOptions, reset: () => changeOptions(defaultOptions()) });
panel.update(options, true);
$('seed-input').value = String(seed); $('lobby-seed').textContent = mapLabel(match.map);
const pickSeed = next => { if (online) room.action('seed', { seed: next }); else { seed = next; preview(); } };
$('seed-input').addEventListener('change', () => pickSeed(mapSeed($('seed-input').value) ?? seed));
$('seed-new').onclick = () => pickSeed(newSeed());
const menu = createGameMenu({ title: 'Capis a Pintazos · Pana', sound, orientation: 'libre', // i18n-ignore: the game's name
  pad: PAD,
  note: () => online ? loc('La partida sigue mientras estás en el menú.') : loc('La partida está en pausa.'),
  invite: () => inviteUrl(code),
});
$('game-nav').append(menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('rules').onclick = () => menu.open('controls');

// ---------- the free-for-all's setup ----------
// Between start and the first turn: three maps (the host switches), each pana
// places its own capis by tapping the whole-map view, the host starts any time.
// Solo runs setup-rules.js here; online the room's host runs it (online.js).
let soloSetup = null, inSetup = false, selected = null, lastReject = 0;
const meId = () => online ? room.id : 'me';
const currentSetup = () => online ? (room.state.phase === 'setup' ? room.state.setup : null) : soloSetup && setupView(soloSetup);
const mineOf = v => Object.entries(v.owners).filter(([, id]) => id === meId()).map(([capi]) => Number(capi)).sort((a, b) => a - b);
const setupUi = createSetupView($, { pick: pickMap, select: capi => { selected = capi; showSetup(currentSetup()); }, go: () => start(), back: () => {
  if (online) { if (room.isHost) room.action('lobby'); return; }
  soloSetup = null; toLobby(); preview();
} });
function showSetup(v) {
  if (!v) return;
  if (!inSetup) {
    inSetup = true; playing = false; charge.cancel(); setupUi.reset();
    $('lobby').hidden = true; $('hud').hidden = true; $('results').hidden = true; $('setup').hidden = false;
    document.body.classList.remove('in-lobby'); document.body.classList.add('in-setup');
  }
  if (world) world.wide = true;
  // The chosen map, every capi standing where it would start.
  const at = v.seeds[v.pick];
  if (match.map.seed !== at || match.mode !== 'ffa') { match = createMatch({ seed: at, mode: 'ffa', spawnXs: v.spawns }); world?.setMatch(match); hud.build(match); }
  for (const c of match.capys) { const x = v.spawns[c.team]; if (Number.isFinite(x)) { c.x = x; c.y = surfaceY(match.mask, x) ?? c.y; } }
  const mine = mineOf(v);
  if (!mine.includes(selected)) selected = mine.find(capi => !Object.hasOwn(v.places, capi)) ?? mine[0] ?? null;
  const reject = online && v.rejects?.[room.id];
  if (reject && reject.n > lastReject) { sfx.dry(); notify(setupError(reject.reason)); lastReject = reject.n; }
  setupUi.render({ ...v, mine, selected, host: !online || room.isHost, names: match.capys.map(c => c.name) });
  $('setup-back').disabled = online && !room.isHost;
}
// The setup's view: the whole ground between the top bar and the setup bar.
function fitSetup() {
  if (!world) return;
  if (!inSetup) { world.fit = null; return; }
  let top = match.map.water;
  for (let x = 0; x <= match.map.width; x += 2) top = Math.max(top, surfaceY(match.mask, x) ?? 0);
  const bar = $('setup').getBoundingClientRect(), head = document.querySelector('.topbar')?.getBoundingClientRect();
  world.fit = { top: top + 3, bottom: match.map.water - 2, above: (head?.bottom ?? 0) + 4, below: innerHeight - bar.top + 8 };
}
function pickMap(index) {
  const v = currentSetup(); if (!v) return;
  if (online) { room.action('setup', { step: 'pick', index, rev: v.rev }); return; }
  chooseMap(soloSetup, 'me', index, soloSetup.rev); showSetup(currentSetup());
}
// Put the chosen capi at map x: checked here first for a quick answer; online the host has the last word.
function placeAt(x) {
  const v = currentSetup(); if (!v || selected == null) return;
  const bad = spotProblem({ places: v.places }, selected, x, groundOf(v.seeds[v.pick]));
  if (bad) { sfx.dry(); notify(setupError(bad)); $('setup-note').textContent = setupError(bad); return; }
  sfx.land('grass', { power: .4, volume: .7 });
  if (online) { room.action('setup', { step: 'place', capi: selected, x, rev: v.rev }); return; }
  const r = place(soloSetup, 'me', selected, x, groundOf(seedOf(soloSetup)), soloSetup.rev);
  if (!r.ok) notify(setupError(r.reason));
  showSetup(currentSetup());
}

// ---------- the match ----------
function start(again = false) {
  sound.unlock();
  if (online) { room.action('start'); return; }
  let spawnXs = null;
  if (options.mode === 'ffa' && !again) {
    if (!soloSetup) { soloSetup = createSetup({ setupSeed: seed, hostId: 'me', owners: { [HUMAN]: 'me' } }); showSetup(currentSetup()); return; }
    const done = launch(soloSetup, 'me', groundOf(seedOf(soloSetup)));
    seed = done.seed; spawnXs = done.spawns; soloSetup = null;
  }
  match = createMatch({ seconds: options.seconds, difficulty: options.difficulty, seed, size: options.size, mode: options.mode, looks: looks(), spawnXs });
  // The address replays this map: share it, or reload it, for the same ground.
  const url = new URL(location.href); url.searchParams.set('seed', String(seed)); url.searchParams.set('size', options.size); if (options.mode === 'ffa') url.searchParams.set('mode', 'ffa'); else url.searchParams.delete('mode'); history.replaceState(null, '', url);
  // The machine plays every side but ours.
  bots = Array.from({ length: match.teams }, (_, team) => team === HUMAN ? null : createBot({ team, difficulty: options.difficulty, seed: match.seed + 1 + team }));
  world?.setMatch(match); hud.build(match);
  acc = 0; begin();
}
function begin() {
  sound.unlock(); playing = true; inSetup = false; if (world) world.wide = false;
  $('setup').hidden = true; document.body.classList.remove('in-setup');
  $('map-seed').textContent = mapLabel(match.map);
  $('results').hidden = true; $('lobby').hidden = true; $('hud').hidden = false; document.body.classList.remove('in-lobby');
  render();
}
function toLobby() {
  playing = false; inSetup = false; charge.cancel();
  $('setup').hidden = true; document.body.classList.remove('in-setup');
  $('results').hidden = true; $('hud').hidden = true; $('lobby').hidden = false; document.body.classList.add('in-lobby');
  if (world) world.wide = true;
}
$('start').onclick = () => start();
// Another match: a new map in the lobby, or a rematch on this one (online, the host's call).
$('again').onclick = () => { if (online) room.action('lobby'); else { seed = newSeed(); toLobby(); preview(); } };
$('same-map').onclick = () => start(true);

// ---------- input ----------
const keys = new Set(), touch = new Set();
let jumps = 0, mouseAt = null, pendingFire = null, power = null, wanted = null;
const held = (...names) => names.some(name => keys.has(name) || touch.has(name));
const myTurn = () => playing && match.phase === 'aim' && side.player(match) === 'me' && !menu.isOpen;
const charge = createShotCharge({ ready: myTurn, revision: () => match.turn?.n,
  change: p => { power = p; $('power-bar').hidden = p == null; if (p != null) paintCharge($('power'), p, $('power-value')); },
  shoot: p => {
    if (!online) { pendingFire = p; return; }
    // The shot leaves at the aim this screen shows (the host may be a step behind).
    const me = activeCapy(match), i = keysInput();
    room.action('fire', { power: p, aim: i.aimTo ?? me?.aim, face: i.face ?? me?.facing });
  } });
// The keys and pointer of whoever plays this screen: walk, aim, face, jump presses.
function keysInput() {
  const me = activeCapy(match);
  if ((!myTurn() && match.phase !== 'retreat') || side.player(match) !== 'me' || !me) return { jump: jumps };
  const out = { x: Number(held('d', 'arrowright', 'right')) - Number(held('a', 'arrowleft', 'left')), jump: jumps,
    aim: Number(held('w', 'arrowup', 'aim-up')) - Number(held('s', 'arrowdown', 'aim-down')) };
  if (mouseAt && !out.aim && !out.x) {
    const dx = mouseAt.x - me.x, dy = mouseAt.y - (me.y + .7);
    if (Math.hypot(dx, dy) > .8) { out.face = dx < 0 ? -1 : 1; out.aimTo = Math.atan2(dy, Math.abs(dx)); }
  }
  return out;
}
function input() {
  const out = keysInput();
  if (side.player(match) !== 'me') return {};
  if (wanted) { out.weapon = wanted; wanted = null; }
  if (pendingFire != null) { out.fire = pendingFire; pendingFire = null; }
  return out;
}
// Take another weapon on your turn (the picker, 1-5, Q E, Tab); `step` cycles through the ones with shots left.
function choose(id, step = 0) {
  const me = activeCapy(match);
  if (!myTurn() || !me) return;
  if (step) { const at = WEAPON_IDS.indexOf(wanted || me.weapon); for (let k = 1; k <= WEAPON_IDS.length && !id; k++) { const next = WEAPON_IDS[(at + step * k + WEAPON_IDS.length * k) % WEAPON_IDS.length]; if (canUse(match, me.team, next)) id = next; } }
  if (!id) return;
  if (!canUse(match, me.team, id)) { sfx.dry(); notify(loc('Ya no quedan tiros de {name}.', { name: weaponOf(id).name })); return; }
  if (online) room.action('weapon', { weapon: id }); else wanted = id;
}
const typing = (event) => event.target.closest?.('input, textarea, select, [contenteditable], dialog');
addEventListener('keydown', (event) => {
  if (menu.isOpen || typing(event) || !playing) return;
  const key = event.key.toLowerCase();
  if (key === 'm' && !event.repeat) toggleMute();
  if (key === 'z' && !event.repeat) world.wide = !world.wide;
  if ((key === 'enter' || key === 'j') && !event.repeat) { event.preventDefault(); jumps = pressJump(jumps); }
  if (key === ' ') { event.preventDefault(); if (!event.repeat) charge.begin(' '); }
  if (/^[1-9]$/.test(key) && !event.repeat && WEAPON_IDS[key - 1]) choose(WEAPON_IDS[key - 1]);
  if ((key === 'q' || key === 'e' || key === 'tab') && !event.repeat) { if (key === 'tab') event.preventDefault(); choose(null, key === 'q' || (key === 'tab' && event.shiftKey) ? -1 : 1); }
  if (/^(w|a|s|d|arrow(up|down|left|right))$/.test(key)) { event.preventDefault(); keys.add(key); if (/w|s|up|down/.test(key)) mouseAt = null; }
});
addEventListener('keyup', (event) => { const key = event.key.toLowerCase(); keys.delete(key); if (key === ' ') charge.release(' '); });
const canvas = $('world');
canvas.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse' && playing && world) mouseAt = world.pick(event.clientX, event.clientY); });
canvas.addEventListener('pointerdown', (event) => { if (event.pointerType !== 'mouse' || event.button !== 0 || !playing) return; mouseAt = world.pick(event.clientX, event.clientY); charge.begin('pointer'); });
addEventListener('pointerup', (event) => { if (event.pointerType === 'mouse') charge.release('pointer'); });
// Setup: a tap or a click on the whole map puts the chosen capi there (mouse and touch alike).
canvas.addEventListener('pointerdown', (event) => { if (!inSetup || !world || menu.isOpen || (event.pointerType === 'mouse' && event.button !== 0)) return; const at = world.pick(event.clientX, event.clientY); if (at) placeAt(at.x); });
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
// Each capi's own little voice (engine/voice.js), as loud as where it stands.
const voices = createVoices({ sound, pitch });
const voice = (id, line, { volume = 1, delay = 0 } = {}) => { const c = match.capys.find(k => k.id === id); if (c) voices.say(id, line, { volume: volume * heard(c.x, c.y).volume, delay }); };
function turnText(e) {
  const who = side.player(match), name = nameOf(e.capy);
  return who === 'me' ? loc('Tu turno: {name}', { name }) : who ? loc('Turno de {pana}: {name}', { pana: who, name }) : loc('Turno de la máquina: {name}', { name });
}
function handle(e) {
  world?.event(e);
  const mine = myTeam();
  switch (e.type) {
    case 'turn': sfx.chime(); notify(turnText(e)); break;
    case 'fire': if (e.weapon === 'grenade') sfx.swish(1.2); else sfx.shot({ bazooka: 'bazuca', sniper: 'sniper', drill: 'minigun', scatter: 'scatter' }[e.weapon] || 'bazuca'); break;
    case 'weapon': sfx.swap(); break;
    case 'bounce': sfx.land('dirt', { power: .3, volume: .5 * heard(e.x, e.y).volume }); break;
    case 'drill': { const { volume, far } = heard(e.x, e.y); sfx.debris(1.3, { volume: volume * .9 }); sfx.boom(.6, { volume: .5 * volume, far }); break; }
    case 'blast': {
      // The boom, the wet splat, the earth raining back and the drops pattering down: as big as the crater.
      const { volume, far } = heard(e.x, e.y), k = Math.min(1.2, .35 + (e.size ?? 3.5) / 4);
      sfx.boom(k, { volume: .85 * volume, far }); sfx.splat(k * volume);
      if (k > .6) { sfx.debris(k, { volume: .9 * volume, delay: .3 }); sfx.patter(Math.round(7 * k), { volume: .8 * volume, delay: .45 }); }
      break;
    }
    case 'hit': voice(e.capy, e.paint >= 30 ? 'oof' : 'hurt'); sfx.splat(.5); world?.react(e.team === mine ? 'ouch' : e.by === mine ? 'cheer' : 'idle'); break;
    case 'jump': sfx.boing(.8); voice(e.capy, 'jump', { volume: .8 }); break;
    case 'land': sfx.land('grass', { power: .4, volume: .7 }); break;
    case 'plop': sfx.splash(.8, { volume: heard(e.x, e.y).volume }); sfx.patter(4, { volume: .5, delay: .35 }); break;
    case 'out':
      voice(e.capy, 'ko', { delay: e.reason === 'water' ? .25 : 0 });
      if (e.reason === 'water') { sfx.splash(1.3); sfx.patter(5, { volume: .6, delay: .4 }); notify(loc('¡{name} se fue al río!', { name: nameOf(e.capy) })); }
      else notify(loc('¡{name} quedó pintado de pies a cabeza!', { name: nameOf(e.capy) }));
      break;
    case 'timeout': notify(loc('¡Se acabó el tiempo!')); break;
    case 'crate': sfx.swish(.7); notify(loc('¡Cayó una caja!')); break;
    case 'crate-land': sfx.land('dirt', { power: .5, volume: .6 * heard(e.x, e.y).volume }); break;
    case 'crate-gone': if (e.reason === 'water') sfx.splash(.5, { volume: heard(e.x, e.y).volume }); else sfx.debris(.5, { volume: .8 * heard(e.x, e.y).volume, delay: 0 }); break;
    case 'pickup': sfx.swap(); sfx.chime(); notify(loc('¡{name} agarró {weapon} +{n}!', { name: nameOf(e.capy), weapon: weaponOf(e.weapon).name, n: e.shots })); break;
    case 'finished': if (e.by === 'turns') notify(loc('¡Se acabaron los turnos!')); sfx.sting(e.winner === mine); voice(match.capys.find(c => c.team === e.winner && !c.out)?.id, 'win', { volume: .8, delay: 1 }); world?.react(e.winner === mine ? 'win' : 'lose'); charge.cancel(); setTimeout(() => { if (playing && match.phase === 'finished') hud.results(match); }, 1400); break;
  }
}

function step(dt) {
  if (online || !playing || menu.isOpen || match.phase === 'finished') return;
  acc = Math.min(acc + dt, .25);
  while (acc >= STEP) {
    acc -= STEP;
    const team = activeCapy(match)?.team;
    tickMatch(match, STEP, team === HUMAN ? input() : bots[team]?.input(match) ?? {});
    for (const e of takeEvents(match)) handle(e);
    if (match.phase === 'finished') break;
  }
}
// The last five seconds of a turn tick, solo or online.
function clockTicks() {
  const now = playing && match.phase === 'aim' ? Math.ceil(match.turn.time) : 0;
  if (now < lastTime && lastTime <= 5) sfx.tick(5 - lastTime);
  lastTime = now;
}
// With friends the room steps on its own timer (a background host keeps the game going).
const clock = elapsedClock();
const roomTimer = setInterval(() => { const dt = clock(); if (online) room.tick(dt, keysInput()); }, 50);
addEventListener('pagehide', () => { clearInterval(roomTimer); room.dispose(); }, { once: true });
// Solo steps on the wall clock too, not the frame's dt (capped at .05 s by the
// shell): on a slow frame the match catches up to .25 s, so turns and flights
// keep real time down to a few frames a second instead of slowing with them.
const soloClock = elapsedClock();

function render() {
  if (!playing) return;
  hud.update(match);
  if (match.phase !== 'aim' || side.player(match) !== 'me') charge.cancel();
}

export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createCapisScene($('world'), match),
  ready: (created) => {
    world = created; world.wide = !playing; if (world.match !== match) world.setMatch(match); hud.build(match);
    lobbyView();
  },
  frame: (dt, scene) => {
    step(soloClock()); clockTicks(); charge.update(); render(); fitSetup();
    scene.frame(dt, { playing, power: power ?? null, weapon: activeCapy(match)?.weapon, difficulty: difficultyInfo(options.difficulty), labels: playing ? hud.labels : null });
  },
});
// A party or invite link (?room=) joins that room at once.
if (roomFromUrl()) goOnline(); else lobbyView();
if (params.has('debug')) window.capisDebug = { get match() { return match; }, get world() { return world; }, start, fire: (p) => fire(match, p), choose, options: () => options, get playing() { return playing; }, room, get online() { return online; }, tombs, charge,
  get setup() { return currentSetup(); }, get inSetup() { return inSetup; }, get selected() { return selected; }, placeAt, pickMap };
