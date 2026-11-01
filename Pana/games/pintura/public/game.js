import { createArmory } from './armory.js';
import { kitStats, kitRating, MARKERS, WEAPONS, cycleWeapon } from './armory-data.js';
import { readiness } from '/engine/play/melee.js';
import { createLobbyRoster } from '/engine/lobby-roster.js';
import { createRoomOptions } from '/engine/room-options.js';
import { FIELDS, DEFAULT_OPTIONS } from './options.js';
import { prepareScene } from '/engine/game-load.js';
import { createMapPicker } from '/engine/play/map-picker.js';
import { createDifficultyPicker, DEFAULT_DIFFICULTY } from '/engine/play/difficulty.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl } from '/engine/invite.js';
import { roomCode } from '/engine/game-shell.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { fillRoster } from '/engine/results.js';
import { sound } from '/engine/fx.js';
import { createToast } from '/engine/hud.js';
import { PaintConnection } from './network.js';
import { createScene } from './scene.js';
import { createMinimap } from './minimap.js';
import { createCombatHud } from './combat-hud.js';
import { sfx, createSteps } from './sounds.js';
import { pressJump } from '/engine/play/jump.js';
import { createShotCharge } from '/engine/play/shot-charge.js';
import { createLookControls } from '/engine/play/first-person.js';
import { createScopeOverlay } from '/engine/play/scope.js';
import { createFeats } from '/engine/feats.js';
import { createHitFeats } from './feats.js';
import { coverFor, TARGET, segmentBox, paintSeats, variantName } from './rules.js';
import { paintArenaInfo } from '/engine/worlds/arena-layouts.js';
import { loc, locn } from '/engine/i18n.js';

const $ = id => document.getElementById(id), code = roomCode();
const params = new URLSearchParams(location.search);
const held = new Set(), pads = []; let aim = null, firing = false, jumpPress = 0, touchFire = false, queuedFire = false, queuedReload = false, stopped = false, lastPhase = 'lobby', lastEvent = null, lastRound = 0, lastLocal = false, lastKiller = '', wasReloading = false, lastDry = 0; const seenShots = new Map();
const canvas = $('world'), world = createScene(canvas), minimap = createMinimap($('minimap'));
const hitFeats = createHitFeats(createFeats($('toast'))), combat = createCombatHud(document);
// A released grenade rides three inputs (150 ms), so a server tick that only keeps the latest input still sees it.
let weapon = 'pistol', queuedGrenade = null, grenadeSends = 0, lastWeapon = '', throwSends = 0;
// Aim: right mouse or F held, or the Mira button toggled on a phone. Scopes and Miras zoom in.
let mouseAim = false, touchAim = false; const aiming = () => mouseAim || touchAim || held.has('f');
const steps = createSteps(), seenSplats = new Set(), seenBooms = new Set(), scopeView = createScopeOverlay(document);
let cameraView = 'primera', pointerPosition = null;
const room = new PaintConnection({ code, name: loadName(), avatar: loadAvatar(), onState: render, onStatus(text, failed = false) {
  $('connection').dataset.failed = String(failed); $('connection').textContent = text; document.dispatchEvent(new Event('pana:sala-update')); $('recovery-copy').textContent = text; $('recovery').hidden = !failed || room.state.phase === 'lobby';
} });
const toast = createToast($('toast')), armory = createArmory({ room, onPick: value => { weapon = value; }, notify: toast });
// pana.sh may call back when a camo unlocks mid-session (optional in its bridge).
if (typeof window.PanaSh?.onCamoUnlocked === 'function') window.PanaSh.onCamoUnlocked(id => import('./camos.js').then(({ camoById }) => { const c = camoById(id); if (c) { toast(loc('¡Camuflaje {name} desbloqueado!', { name: loc(c.name) })); armory.refreshCamos(); } }));
$('lobby').panaSala = { kitLabel: loc('Armar mi kit'), openKit: () => $('open-armory').click(), read: () => {
  const describe = p => { const stats = kitStats(p.kit || room.kit, room.state.options); return { id: room.link?.state.players.find(m => m.seat === p.id)?.id, kit: stats.name, level: kitRating(p.kit || room.kit, room.state.options), color: p.color || '#ffc629', team: (room.state.options?.mode === 'teams' || room.state.options?.flag) ? (p.team ? loc('Turquesa') : loc('Naranja')) : '' }; };
  const people = room.state.players.filter(p => p.connected && !p.bot).length || 1;
  return { connection: room.local ? 'local' : room.connected ? 'online' : $('connection').dataset.failed === 'true' ? 'offline' : 'connecting', players: room.state.players.map(describe), local: describe({ kit: room.kit }), summary: [locn(people, '{n} pana', '{n} panas'), room.state.options?.mode === 'teams' ? loc('Equipos') : loc('Todos vs todos'), loc('{n} min', { n: (room.state.options?.duration || 180) / 60 })].join(' · ') };
} };
const teamRoster = createLobbyRoster($('team-roster'), { onMove: (from, to) => room.moveSeat(from, to) });
// One copy of the help text: the pause menu and the settings dialog's "Cómo se juega" layer.
const controls = [[loc('WASD / Flechas'), loc('Caminar hacia donde miras')], [loc('Ratón'), loc('Mirar y apuntar (haz clic en la cancha para capturarlo)')], [loc('Clic / Enter'), loc('Disparar pintura')], [loc('Clic derecho / F'), loc('Apuntar (La Lejana mira por la mira telescópica)')], [loc('Clic derecho / F / V'), loc('Con La Chancleta: lanzarla en arco (vuelve sola a tu mano)')], ['Z / X', loc('Arma anterior o siguiente (las de pescozón van al final)')], [loc('Espacio'), loc('Saltar')], ['Shift', loc('Correr (no puedes disparar corriendo)')], ['Tab', loc('Ver la tabla')], ['Q / E', loc('Girar sin ratón')], ['R', loc('Recargar')], ['1 – 6', loc('Chispa / Trueno / Gemelas / Cohetón / Lejana / Bazuca')], ['G', loc('Mantén para cargar la granada y suelta para lanzarla')], ['M', loc('Sonido')], ['Esc', loc('Soltar el ratón y abrir el menú')]];
const tips = [loc('Una pintada suma un punto. Gana quien llegue a diez o lidere al terminar el tiempo. Con vidas limitadas también gana el último pana o equipo en pie. En bandera gana el equipo con tres capturas.'),
  loc('Las barricadas frenan las bolas. Tienes doce por carga; recargas con R o automáticamente al vaciarla.'),
  loc('Vuelves a la cancha 2,5 segundos después de una pintada. Al reaparecer tienes 1,5 segundos de protección; disparar la cancela.'),
  loc('En teléfono camina con las flechas y arrastra el dedo por la pantalla para mirar. Mantén Pinta: la mira se pega al rival visible que tengas delante.'),
  loc('El mapa de la esquina muestra a tu equipo y solo a los rivales que tienes a la vista.'),
  loc('Mantén G para cargar la granada: los puntos marcan su arco y el anillo, hasta dónde pinta. Mira hacia arriba para lanzarla más alto. La mecha corre al soltarla.'),
  loc('La Lejana pinta dos pepazos por tiro, pero sin la mira se desvía. El cohete de La Bazuca saca de una si pega directo: apunta adelante del rival.'),
  loc('Si estás solo, tres bots entran contigo; con amigos la cancha es de ustedes. En Más ajustes eliges cuántos bots juegan. Puedes invitar hasta ocho panas.')];
const optionsUI = createRoomOptions($('room-options'), { title: 'Pepazo', fields: FIELDS, help: { controls, tips }, change: options => room.configure(options), reset() {
  room.configure(DEFAULT_OPTIONS); room.selectMap('terminal'); room.selectDifficulty(DEFAULT_DIFFICULTY);
} });
const mapPicker = createMapPicker($('map-picker'), mapId => room.selectMap(mapId), { paint: true });
const difficultyPicker = createDifficultyPicker($('difficulty-picker'), difficulty => room.selectDifficulty(difficulty), { label: loc('Puntería de los bots'),
  notes: { facil: loc('Los bots fallan seguido y disparan menos.'), normal: loc('Bots con buena mano, pero se les va alguna.'), dificil: loc('Los bots apuntan fino y no sueltan el gatillo.'), experto: loc('Casi no fallan: muévete y cúbrete.') } });
const menu = createGameMenu({ pad: { move: 'wasd', look: loc('Mirar y apuntar'), keys: { rt: ['Enter', loc('Disparar')], lt: ['KeyF', loc('Apuntar')], a: ['Space', loc('Saltar')], x: ['KeyR', loc('Recargar')], rb: ['KeyG', loc('Lanzar granada')], y: ['KeyX', loc('Siguiente marcadora')], rs: ['KeyV', loc('Lanzar la chancleta')], lb: ['ShiftLeft', loc('Correr')], ls: ['ShiftLeft', loc('Correr')], view: ['Tab', loc('Ver la tabla')] } }, title: 'Pepazo · Pana', orientation: 'libre', sound, // i18n-ignore: game name
 
  options: [{ id: 'weapon', label: loc('Marcadora (si la sala permite todas)'), choices: WEAPONS.map(m=>[m.id,m.name]), get: () => weapon, set: value => armory.setWeapon(value) },
    { id: 'view', label: loc('Cámara'), choices: [['primera', loc('Primera persona')], ['cancha', loc('Ver la cancha')]], get: () => cameraView, set: value => { cameraView = value; world.setView(value); } }],
  note: () => room.local ? loc('La práctica está en pausa.') : loc('La ronda online sigue mientras estás en el menú.'),
  controls, tips,
  invite: () => inviteUrl(code), onOpen() { clearInput(); looking.release(); }, onClose() {}, canOpen: () => room.state.phase !== 'finished',
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('room-code').textContent = loc('Sala {code}', { code }); $('rules').onclick = () => menu.open('controls');
$('start').onclick = () => { sound.unlock(); if (!room.connected && $('connection').dataset.failed === 'true') room.practice(); else room.start(); }; $('again').onclick = () => room.toLobby();
for (const id of ['practice', 'fallback']) $(id).onclick = () => { menu.close(); $('recovery').hidden = true; room.practice(); };
function clearInput() { grenadeCharge.cancel(); queuedGrenade = null; throwSends = 0; held.clear(); firing = touchFire = queuedFire = queuedReload = mouseAim = touchAim = false; $('aim').setAttribute('aria-pressed', 'false'); pads.forEach(p => p.release()); room.input({ jump: jumpPress }); }
// Space or the Saltar button. The count rides every input, so frozen play (loading, the 3-2-1) spends it.
function jump() { const s = room.state; if (active() && !s.loading && !s.countdown) jumpPress = pressJump(jumpPress); }
function active() { return !$('armory').open && room.connected && room.state.phase === 'playing' && !menu.isOpen; }
const myPana = () => room.state.players.find(p => p.id === room.id);
// La Chancleta in hand: the aim inputs (right mouse, F, LT, the Mira button) and V throw it
// (melee never aims). The throw rides three inputs, like a grenade, so a tick never misses it.
const throwable = () => { const me = myPana(); return !!me && !!kitStats(me.kit, room.state.options).throwable; };
function throwNow() { if (!active() || !throwable()) return false; sound.unlock(); throwSends = 3; return true; }
// Hold G (or the Granada button) to charge the throw, release to throw it: the
// power swings up and down (engine/play/shot-charge.js) and rides the next input
// as `charge`, with the look's pitch. The fuse only starts when it leaves the hand.
const grenadeCharge = createShotCharge({ min: 0, ready: () => { const me = myPana(); return active() && !!me?.grenadeReady && !me.respawn && !me.eliminated && !room.state.loading && !room.state.countdown; },
  revision: () => room.state.round, change: power => { $('gear').classList.toggle('charging', power !== null); $('gear').style.setProperty('--charge', String(power ?? 0)); },
  shoot: power => { queuedGrenade = power; grenadeSends = 3; } });
function chargeGrenade(source) { sound.unlock(); if (grenadeCharge.begin(source)) sfx.pin(); }
for (const [id, key] of [['up', 'w'], ['left', 'a'], ['down', 's'], ['right', 'd'], ['reload', 'r']]) pads.push(holdButton($(id), { down: () => { held.add(key); if (key === 'r') queuedReload = true; }, up: () => held.delete(key), paused: () => !active() }));
pads.push(holdButton($('jump'), { down: jump, up: () => {}, paused: () => !active() }));
pads.push(holdButton($('grenade'), { down: () => chargeGrenade('pointer'), up: () => grenadeCharge.release('pointer'), paused: () => !active() }));
pads.push(holdButton($('fire'), { down: () => { touchFire = queuedFire = true; sound.unlock(); }, up: () => { touchFire = false; }, paused: () => !active() }));
// A phone has one thumb for aim and fire, so Mira toggles instead of being held.
// Previous / next marker in class order (Z / X on a keyboard).
for (const [id, step] of [['weapon-prev', -1], ['weapon-next', 1]]) pads.push(holdButton($(id), { down: () => cycle(step), up: () => {}, paused: () => !active() }));
pads.push(holdButton($('aim'), { down: () => { if (throwNow()) return; touchAim = !touchAim; $('aim').setAttribute('aria-pressed', String(touchAim)); }, up: () => {}, paused: () => !active() }));
// Through a scope the look slows with the zoom, and a Mira's own `sens` on top, so a small drag still lands on target.
const looking = createLookControls(canvas, { enabled: () => active() && cameraView === 'primera', look: (yaw, pitch) => { const k = world.sensitivity(); world.look(yaw * k, pitch * k); },
  press(event) { sound.unlock(); if (event.button === 0) firing = queuedFire = true; if (event.button === 2 && !throwNow()) mouseAim = true; },
  release(event) { if (event.button === 0 || event.type === 'pointercancel') firing = false; if (event.button === 2 || event.type === 'pointercancel') mouseAim = false; },
  unlocked: () => menu.open('game') });
// The overview keeps the plane-projected mouse aim.
canvas.addEventListener('pointermove', event => { if (active() && cameraView === 'cancha') { pointerPosition = [event.clientX, event.clientY]; aim = world.point(...pointerPosition); } });
canvas.addEventListener('pointerdown', event => {
  if (!active() || cameraView !== 'cancha' || event.button !== 0) return; event.preventDefault(); sound.unlock();
  pointerPosition = [event.clientX, event.clientY]; aim = world.point(...pointerPosition); firing = queuedFire = true;
});
for (const type of ['pointerup', 'pointercancel']) canvas.addEventListener(type, () => { if (cameraView === 'cancha') firing = false; });
addEventListener('blur', clearInput); document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
// Collision debug (?debugCollision=1, F9 toggles, Shift+F9 saves the report): loaded only when asked.
let collisionDebug = null;
const debugCollision = () => collisionDebug ??= import('./collision-debug.js').then(m => m.attachCollisionDebug(world, () => room.state));
if (params.get('debugCollision') === '1') debugCollision().then(d => d.toggle(true));
addEventListener('keydown', event => { if (event.key === 'F9') { event.preventDefault(); debugCollision().then(d => event.shiftKey ? d.download() : d.toggle()); } });
addEventListener('keydown', event => {
  if (menu.isOpen || event.target.closest?.('input, button, textarea, select, a')) return;
  const key = event.key.toLowerCase(), slot = Number(key);
  // A number picks the marker for this round and the saved kit (pistol-only rooms keep La Chispa);
  // Z/X and [ ] step through every marker in class order (Q/E already turn the view).
  if (slot >= 1 && slot <= Math.min(9, MARKERS.length) && room.state.options?.weapons !== 'pistol') armory.setWeapon(MARKERS[slot - 1].id); if (key === 'm') toggleMute();
  if ((key === 'z' || key === '[') && !event.repeat) cycle(-1); if ((key === 'x' || key === ']') && !event.repeat) cycle(1);
  if (key === 'g' && active() && !event.repeat) chargeGrenade('g');
  if ((key === 'v' || key === 'f') && !event.repeat && throwNow()) event.preventDefault();
  if (key === 'tab') { event.preventDefault(); if (room.state.phase === 'playing') showBoard(true); }
  if (['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'v', ' ', 'enter', 'shift', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) { event.preventDefault(); if (active()) { held.add(key); if (key === ' ' && !event.repeat) jump(); if (key === 'enter') queuedFire = true; if (key === 'r') queuedReload = true; } }
});
addEventListener('keyup', event => { const key = event.key.toLowerCase(); held.delete(key); if (key === 'g') grenadeCharge.release('g'); if (key === 'tab') showBoard(false); });
function cycle(step) { if (room.state.options?.weapons !== 'pistol') armory.setWeapon(cycleWeapon(armory.kit.weapon, step)); }
// Hold Tab: everyone's knockouts, times painted and current streak.
function showBoard(open) {
  $('scoreboard').hidden = !open; if (!open) return;
  const state = room.state, teams = state.options?.mode === 'teams' || state.options?.flag;
  $('board-title').textContent = teams ? teamScore(state) : loc('{court} · ronda {round}', { court: loc(variantName(state.mapId, state.variant || 0)), round: state.round });
  fillRoster($('board-list'), [...state.players].filter(p => p.connected).sort((a, b) => b.score - a.score || a.hits - b.hits).map((p, i) => ({ rank: i + 1, name: p.name,
    detail: [locn(p.hits, '{n} recibida', '{n} recibidas'), p.streak > 1 && loc('racha de {n}', { n: p.streak }), p.bot && loc('Bot')].filter(Boolean).join(' · '), end: p.score, score: true, me: p.id === room.id })));
}
// Where the crosshair (first person) or the mouse on the court (overview) points.
function aimOf(me) {
  if (cameraView === 'primera') { const f = world.forward(); return [f.x, f.z]; }
  if (pointerPosition) aim = world.point(...pointerPosition);
  return aim ? [aim.x - me.x, aim.z - me.z] : [me.ax, me.az];
}
// The throw being charged, exactly as input() will send it: the scene draws its arc.
function grenadeAim() {
  const me = myPana(); if (!grenadeCharge.active || !me) return null;
  const [ax, az] = aimOf(me), length = Math.hypot(ax, az) || 1;
  return { ax: ax / length, az: az / length, pitch: cameraView === 'primera' ? world.pitch : 0, charge: grenadeCharge.update() ?? 0 };
}
function input() {
  if (!active()) return { jump: jumpPress };
  const me = myPana(); if (!me) return { jump: jumpPress };
  let [ax, az] = aimOf(me);
  if (touchFire && queuedGrenade === null) {
    // Touch aim assist: the visible rival closest to the crosshair (in first person, within 20°).
    const length = Math.hypot(ax, az) || 1, rivals = room.state.players.filter(p => p.id !== me.id && p.connected && !p.respawn && !p.eliminated && !p.shield && (!(room.state.options?.mode === 'teams' || room.state.options?.flag) || p.team !== me.team) && !coverFor(room.state.mapId, room.state.variant || 0).some(o => segmentBox(me.x, me.z, p.x - me.x, p.z - me.z, o) !== null));
    const off = p => Math.acos(Math.max(-1, Math.min(1, ((p.x - me.x) * ax + (p.z - me.z) * az) / length / (Math.hypot(p.x - me.x, p.z - me.z) || 1))));
    const target = cameraView === 'primera' ? rivals.filter(p => off(p) < .35 && Math.hypot(p.x - me.x, p.z - me.z) < 40).sort((a, b) => off(a) - off(b))[0]
      : rivals.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (target) { ax = target.x - me.x; az = target.z - me.z; }
  }
  const length = Math.hypot(ax, az) || 1, fire = queuedFire || firing || touchFire || held.has('enter');
  // Pulling the trigger mid-reload clicks, so the wait is never silent.
  if (fire && me.reload > 0 && performance.now() - lastDry > 450) { lastDry = performance.now(); sfx.dry(); }
  return { weapon, grenade: queuedGrenade !== null, charge: queuedGrenade ?? 0, pitch: cameraView === 'primera' ? world.pitch : null, ...world.movement(Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft')),
    Number(held.has('s') || held.has('arrowdown')) - Number(held.has('w') || held.has('arrowup'))), sprint: held.has('shift'),
    ax: ax / length, az: az / length, jump: jumpPress, fire, aim: aiming() && cameraView === 'primera', alt: throwSends > 0, reload: queuedReload || held.has('r') };
}
// A short CSS pulse: a hit marker on the crosshair or a paint flash when hit.
function flash(name) { document.body.classList.remove(name); void document.body.offsetWidth; document.body.classList.add(name); }
// Knockout callouts: the distance always, plus the moments worth shouting about.
function callout(e, state) {
  const victim = state.players.find(p => p.id === e.victim)?.name || loc('un pana');
  const title = e.revenge ? loc('¡Venganza!') : e.streak >= 5 ? loc('¡Imparable!') : e.streak === 4 ? loc('¡Cuádruple!') : e.streak === 3 ? loc('¡Triple!') : e.streak === 2 ? loc('¡Doble pepazo!')
    : e.thrown ? loc('¡Chancletazo!') : WEAPONS.find(m => m.id === e.weapon)?.melee ? loc('¡Pescozón!') : e.direct ? loc('¡Bazucazo!') : e.headshot ? loc('¡A la cabeza!') : MARKERS.find(m => m.id === e.weapon)?.scope ? loc('¡Francotirador!') : loc('¡Pepazo!');
  $('callout-title').textContent = title; $('callout-detail').textContent = e.distance >= 25 ? loc('{victim} · {distance} m · ¡Tiro largo!', { victim, distance: e.distance }) : e.distance <= 4 ? loc('{victim} · {distance} m · ¡A quemarropa!', { victim, distance: e.distance }) : loc('{victim} · {distance} m', { victim, distance: e.distance });
  $('callout').classList.toggle('callout--long', e.distance >= 25); flash('called');
  clearTimeout(callout.timer); callout.timer = setTimeout(() => document.body.classList.remove('called'), 1900);
}
function feedLine(e, state) {
  const owner = state.players.find(p => p.id === e.owner), victim = state.players.find(p => p.id === e.victim), item = document.createElement('li');
  const name = (p, fallback) => { const b = document.createElement('b'); b.translate = !p; b.textContent = p?.name || fallback; b.style.color = p?.color || ''; return b; };
  // One translated sentence; the coloured names go where its placeholders are.
  const line = e.distance >= 25 ? loc('{owner} pintó a {victim} · {distance} m · tiro largo', { distance: e.distance }) : loc('{owner} pintó a {victim} · {distance} m', { distance: e.distance });
  const parts = { owner: name(owner, loc('Un pana')), victim: name(victim, loc('un pana')) };
  item.append(...line.split(/(\{owner\}|\{victim\})/).filter(Boolean).map(piece => parts[piece.slice(1, -1)] || piece));
  item.classList.toggle('me', e.owner === room.id); item.classList.toggle('out', e.victim === room.id);
  $('killfeed').prepend(item); while ($('killfeed').children.length > 4) $('killfeed').lastChild.remove();
  setTimeout(() => item.remove(), 6000);
}
function announce(e, state) {
  const mine = e.owner === room.id, me = e.victim === room.id;
  if (e.type === 'out') feedLine(e, state);
  // Every rival you paint counts for that weapon's camo (pana.sh unlocks it), knockout blows too.
  if (mine && !me && !(teamsOn(state) && state.players.find(p => p.id === e.victim)?.team === myPana()?.team)) hitFeats.weaponHit(e.weapon);
  if (mine && e.type === 'hit') { sfx.hitTick(); flash('hitmark'); navigator.vibrate?.(18); hitFeats.hit(state.players.find(p => p.id === e.victim)?.name || loc('un pana')); }
  if (mine && e.type === 'out') { sfx.knockout(e.distance >= 25, e.streak || 1); flash('scored'); combat.streak(e.streak || 1); callout(e, state); }
  if (me) {
    document.body.style.setProperty('--paint-hurt', `${e.color}aa`); flash('painted');
    combat.hit(e, state, room.id, world.forward());
    if (e.type === 'out') { const killer = state.players.find(p => p.id === e.owner); sfx.out(); combat.streak(0); lastKiller = { name: killer?.name || loc('Un pana'), distance: e.distance, color: killer?.color || '' }; } else sfx.hurt();
  }
}
// Hearing and seeing the court: every shot pops, flashes and puffs, quieter with distance.
// Shots are counted per pana (`fired`), not by ball: a point-blank ball is gone in one step.
// Melee: a whoosh on every swing or throw, the weapon's own blow when one lands, and a pop
// when your thrown chancla is back in the hand; counted per pana like shots.
const seenMelee = new Map();
function blows(state, me) {
  for (const p of state.players) {
    const now = [p.melee?.swings || 0, p.melee?.throws || 0, p.smacks || 0, p.recalls || 0], before = seenMelee.get(p.id); seenMelee.set(p.id, now);
    if (!before) continue;
    const mine = p.id === room.id, volume = mine ? 1 : me ? .8 / (1 + Math.hypot(p.x - me.x, p.z - me.z) / 6) : .3;
    if (now[0] > before[0] || now[1] > before[1]) sfx.swing(p.weapon, volume);
    if (now[2] > before[2]) sfx.smack(p.weapon, volume);
    if (mine && now[3] > before[3]) sfx.pop();
  }
}
function shots(state, me) {
  const first = document.body.classList.contains('first-person');
  blows(state, me);
  for (const p of state.players) {
    const before = seenShots.get(p.id); seenShots.set(p.id, p.fired || 0);
    if (before === undefined || !(p.fired > before)) continue;
    const mine = p.id === room.id, d = me ? Math.hypot(p.x - me.x, p.z - me.z) : 20;
    sfx.shot(mine ? 1 : .7 / (1 + d / 7), p.weapon);
    if (mine) { flash('muzzle'); flash('kicked'); }
    if (!(mine && first)) world.muzzle(p);
    if (MARKERS.find(m => m.id === p.weapon)?.scope) world.tracer(p, state, mine && first);
  }
}
// Explosions are heard everywhere, quieter with distance; the scene draws and shakes them.
function booms(state, me) {
  for (const b of state.booms || []) {
    if (seenBooms.has(b.id)) continue; seenBooms.add(b.id);
    sfx.boom(b.kind, me ? 1.1 / (1 + Math.hypot(b.x - me.x, b.z - me.z) / 10) : .5);
  }
  if (seenBooms.size > 64) for (const id of seenBooms) if (!(state.booms || []).some(b => b.id === id)) seenBooms.delete(id);
}
// Grenades are heard as they fly: the throw's whoosh, a clink on each bounce and
// the fuse beeping, every half second and then quickly through the last half.
const seenGrenades = new Map();
function grenades(state, me) {
  for (const g of state.grenades || []) {
    const volume = me ? 1 / (1 + Math.hypot(g.x - me.x, g.z - me.z) / 8) : .4, seen = seenGrenades.get(g.id);
    const beat = g.life < .5 ? Math.floor(g.life / .125) : g.life < 1.5 ? 10 + Math.floor(g.life / .5) : -1;
    if (!seen) { seenGrenades.set(g.id, { bounces: g.bounces || 0, beat }); if ((g.t || 0) < .3) sfx.whoosh(g.owner === room.id ? 1 : volume); continue; }
    if ((g.bounces || 0) > seen.bounces) sfx.clink(volume);
    if (beat >= 0 && beat !== seen.beat) sfx.beep(volume, g.life < .5);
    seen.bounces = g.bounces || 0; seen.beat = beat;
  }
  for (const id of seenGrenades.keys()) if (!(state.grenades || []).some(g => g.id === id)) seenGrenades.delete(id);
}
// A ball that lands splats: heard where it lands, quieter with distance.
function splats(state, me) {
  for (const s of state.splats) { if (seenSplats.has(s.id)) continue; seenSplats.add(s.id); if (s.life > 8.6 && me) sfx.impact(.9 / (1 + Math.hypot(s.x - me.x, s.z - me.z) / 8)); }
  if (seenSplats.size > 400) for (const id of seenSplats) if (!state.splats.some(s => s.id === id)) seenSplats.delete(id);
}
// The crosshair ring and the HUD bar fill while the marker reloads or (slow markers) cools down.
function cooldown(state, me) {
  const stats = kitStats(me?.kit, state.options), melee = !!stats.melee && !!me?.melee, reloading = !melee && me?.reload > 0;
  // A melee weapon's ring and bar fill through each swing and while the chancla is away.
  const cooling = melee ? readiness(me.melee, stats) < 1 : !reloading && stats.cadence >= .4 && me?.cooldown > 0;
  const progress = melee ? readiness(me.melee, stats) : reloading ? 1 - me.reload / stats.reload : cooling ? 1 - me.cooldown / stats.cadence : 1;
  document.body.classList.toggle('reloading', !!reloading); document.body.classList.toggle('cooling', !!cooling);
  document.body.style.setProperty('--cd', Math.min(1, Math.max(0, progress)).toFixed(3));
  if (me && lastWeapon && me.weapon !== lastWeapon) sfx.swap();
  lastWeapon = me?.weapon || '';
  if (reloading && !wasReloading) sfx.reload(me.weapon, stats.reload);
  if (wasReloading && !reloading && me?.ammo > 0) { sfx.reloaded(); flash('reloaded'); }
  wasReloading = !!reloading;
}
function aguante(state, me) {
  const total = kitStats(me?.kit,state.options).toughness, left = me ? Math.max(0, total - (me.paint || 0)) : total, key = `${total}:${left}`;
  if ($('aguante').dataset.key === key) return; $('aguante').dataset.key = key;
  $('aguante').replaceChildren(...Array.from({ length: total }, (_, i) => { const pip = document.createElement('i'); pip.className = i < left ? 'pip' : 'pip pip--painted'; return pip; }));
  $('aguante').setAttribute('aria-label', loc('Aguante {left} de {total}', { left, total }));
}
// Each round: build its court and compile it, then tell the room this pana can play.
let preparedRound = 0, preparingRound = 0, lastCount = 0;
async function prepareRound(state) {
  const round = preparingRound = state.round;
  if (!window.PANA_PREPARED) await new Promise(resolve => document.addEventListener('pana:game-prepared', resolve, { once: true }));
  await world.setMap(state.mapId, state.variant || 0); await world.renderer.compileAsync(world.scene, world.camera).catch(() => {});
  if (preparingRound !== round) return;
  preparedRound = round; room.ready(round); render(room.state);
}
// The loading card while anyone loads, then 3, 2, 1 and ¡YA! from the room's countdown.
function roundStart(state) {
  const round = state.phase === 'playing' ? state.round : 0;
  if (round && preparingRound !== round) prepareRound(state);
  const preparing = !!round && (state.loading > 0 || preparedRound !== round);
  $('round-loading').hidden = !preparing;
  if (preparing) {
    $('loading-map').textContent = paintArenaInfo(state.mapId).name; $('loading-court').textContent = loc('Cancha {court}', { court: loc(variantName(state.mapId, state.variant || 0)) });
    $('loading-copy').textContent = preparedRound === round ? loc('Esperando a los demás panas…') : loc('Cargando la cancha…');
  }
  const count = round && !preparing && state.countdown > 0 ? Math.ceil(state.countdown) : 0;
  if (count === lastCount) return;
  clearTimeout(roundStart.timer);
  if (count) { $('countdown').textContent = String(count); flash('counting'); sfx.count(count); }
  else if (round && !preparing) { $('countdown').textContent = loc('¡YA!'); flash('counting'); flash('round-start'); sfx.go(); roundStart.timer = setTimeout(() => document.body.classList.remove('counting'), 1000); }
  else document.body.classList.remove('counting');
  lastCount = count;
}
const teamsOn = state => state.options?.mode === 'teams' || !!state.options?.flag;
const teamScore = state => loc('Naranja {orange} — Turquesa {teal}', { orange: state.teamScores?.[0] || 0, teal: state.teamScores?.[1] || 0 });
function render(state) {
  optionsUI.update(state.options || DEFAULT_OPTIONS, room.connected && room.isHost && state.phase !== 'playing');
  if (['playing', 'hide', 'hunt'].includes(state.phase) && optionsUI.isOpen) optionsUI.close();
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  difficultyPicker.update(state.difficulty, room.connected && room.isHost && state.phase !== 'playing');
  $('round-minutes').textContent = loc('{n} min', { n: (state.options?.duration || 180) / 60 });
  $('win-target').textContent = state.options?.flag ? 3 : TARGET;
  $('win-target-label').textContent = state.options?.flag ? loc('banderas para ganar') : loc('pintadas para ganar');
  const lobby = state.phase === 'lobby', finished = state.phase === 'finished';
  $('lobby').hidden = !lobby; $('hud').hidden = lobby || finished; document.body.classList.toggle('in-lobby', lobby);
  const teams = state.options?.mode === 'teams' || state.options?.flag, people = state.players.filter(p => p.connected);
  const missingTeam = teams && people.length > 1 && new Set(people.map(p => p.team)).size < 2;
  $('team-roster').hidden = !teams;
  $('roster').hidden = teams;
  if (teams) teamRoster.update([loc('Naranja'), loc('Turquesa')].map((title, team) => ({ id: team, title, color: team ? '#29c5cd' : '#f28b42', seats: paintSeats(state.players).map((player, key) => ({ key, player })).filter(s => s.key % 2 === team) })), { ownId: room.id, hostId: room.local ? room.id : room.link?.state.players.find(p => p.id === room.link.state.host)?.seat, enabled: room.connected && lobby, canArrange: room.isHost, members: room.link?.state.players || [] });
  $('start').disabled = (!room.connected ? $('connection').dataset.failed !== 'true' : !room.isHost || missingTeam); $('start').textContent = !room.connected ? loc('Conectando…') : missingTeam ? loc('Falta un pana en el otro equipo') : room.isHost ? loc('¡A pepear!') : loc('El anfitrión inicia la ronda');
  $('invite').disabled = room.local || !room.connected; $('roster').textContent = state.players.filter(p => p.connected).map(p => p.name).join(' · ');
  const me = state.players.find(p => p.id === room.id), order = [...state.players].sort((a, b) => b.score - a.score || a.hits - b.hits);
  combat.render(state, me, room.id);
  const feed = state.message && !combat.duplicate(state.message) ? loc(state.message, state.messageVars?.variant ? { ...state.messageVars, variant: loc(state.messageVars.variant).toLowerCase() } : state.messageVars || undefined) : '';
  $('feed').textContent = feed; $('respawn').hidden = !me?.respawn && !me?.eliminated; $('respawn').style.setProperty('--pc', lastKiller?.color || '');
  $('respawn').textContent = me?.eliminated ? lastKiller ? loc('{name} te pintó desde {distance} m · sin vidas, observando la ronda', lastKiller) : loc('¡Te pintaron! · sin vidas, observando la ronda')
    : lastKiller ? loc('{name} te pintó desde {distance} m · vuelves en {n}', { ...lastKiller, n: Math.ceil(me?.respawn || 0) }) : loc('¡Te pintaron! · vuelves en {n}', { n: Math.ceil(me?.respawn || 0) });
  // Events and balls are numbered per simulation: starting practice begins a new count.
  if (room.local !== lastLocal) { lastLocal = room.local; lastEvent = null; seenShots.clear(); seenMelee.clear(); lastRound = 0; preparedRound = preparingRound = 0; }
  roundStart(state);
  const events = state.events || [];
  if (lastEvent === null) lastEvent = Math.max(0, ...events.map(e => e.n));
  for (const e of events) if (e.n > lastEvent) { lastEvent = e.n; if (state.phase === 'playing') announce(e, state); }
  if (state.phase === 'playing') { shots(state, me); cooldown(state, me); splats(state, me); booms(state, me); grenades(state, me); } else { seenShots.clear(); seenMelee.clear(); seenSplats.clear(); seenBooms.clear(); seenGrenades.clear(); steps.reset(); lastWeapon = ''; wasReloading = false; document.body.classList.remove('reloading', 'cooling'); }
  aguante(state, me); const label = throwable() ? loc('Lanzar') : loc('Mira'); if ($('aim').textContent !== label) $('aim').textContent = label; $('grenade').disabled=!me?.grenadeReady; $('grenade').textContent=me?.grenadeReady?loc('Granada'):loc('Sin granada');
  if(state.phase==='playing' && $('armory').open) $('armory').close();
  $('stamina').style.setProperty('--left', String(me?.stamina ?? 1)); $('stamina').classList.toggle('stamina--full', (me?.stamina ?? 1) >= 1);
  if (!$('scoreboard').hidden) showBoard(true);
  if (state.phase === 'playing' && state.round !== lastRound) { lastRound = state.round; $('variant').textContent = loc('Cancha {court}', { court: loc(variantName(state.mapId, state.variant || 0)) }); hitFeats.reset(); combat.reset(); }
  $('results').hidden = !finished;
  if (finished) {
    menu.close(); looking.release(); showBoard(false); const winners = order.filter(p => state.winners?.includes(p.id));
    if (state.winners?.includes(room.id)) hitFeats.win();
    $('result-title').textContent = winners.length > 1 ? loc('¡Empate de pintura!') : loc('¡Ganó {name}!', { name: winners[0]?.name });
    if (state.options?.mode === 'teams' || state.options?.flag) $('result-title').textContent = new Set(winners.map(p => p.team)).size !== 1 ? loc('¡Empate de equipos!') : winners[0]?.team === 0 ? loc('¡Ganó el equipo naranja!') : loc('¡Ganó el equipo turquesa!');
    $('result-copy').textContent = locn(order[0]?.score || 0, '{n} pintada en la mejor marca. ¿Otra ronda?', '{n} pintadas en la mejor marca. ¿Otra ronda?');
    fillRoster($('result-board'), order.map((p, i) => ({ rank: i + 1, name: p.name, detail: [locn(p.hits, '{n} recibida', '{n} recibidas'), p.bot && loc('Bot')].filter(Boolean).join(' · '), end: p.score, score: true, me: p.id === room.id })));
    $('again').disabled = !room.isHost || !room.connected; $('again').textContent = room.isHost ? loc('Otra ronda') : loc('El anfitrión prepara la revancha');
    if (lastPhase !== 'finished') { clearInput(); $('again').focus(); }
  }
  lastPhase = state.phase; document.dispatchEvent(new Event('pana:sala-update'));
}
let previous = performance.now(), stoppedAt = previous;
const timer = setInterval(() => { const now = performance.now(), dt = (now - stoppedAt) / 1000; stoppedAt = now; room.input(input()); queuedFire = queuedReload = false; if (--grenadeSends <= 0) queuedGrenade = null; throwSends = Math.max(0, throwSends - 1); room.tick(dt, menu.isOpen); }, 50);
function frame(now) {
  if (stopped) return; const dt = Math.min(.05, (now - previous) / 1000); previous = now;
  if (active()) world.look((Number(held.has('q')) - Number(held.has('e'))) * dt * 2.2);
  document.body.classList.toggle('first-person', cameraView === 'primera' && room.state.phase === 'playing');
  world.setAim(active() && aiming()); world.aimGrenade(grenadeAim());
  armory.update(dt); world.draw(room.state, room.id, dt, aim);
  const scoped = world.scope.scoped; scopeView.set(scoped ? world.scope.amount : 0); document.body.classList.toggle('scoped', scoped); steps.update(room.state, room.id, world.avatars, dt); minimap.draw(room.state, room.id, world.forward()); requestAnimationFrame(frame);
}
render(room.state); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); scopeView.dispose(); armory.dispose(); teamRoster.dispose(); looking.dispose(); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.pinturaDebug = { room, world, menu, input, armory, grenade: grenadeCharge };

await prepareScene(world);
