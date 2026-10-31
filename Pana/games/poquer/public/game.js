import { prepareScene } from '/engine/game-load.js';
import { createRoomOptions } from '/engine/room-options.js';
import { OPTION_FIELDS, DEFAULT_OPTIONS } from './options.js';
import { createTableSeating } from '/engine/play/table-seating.js';
import { createMapPicker } from '/engine/play/map-picker.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl } from '/engine/invite.js';
import { roomCode } from '/engine/game-shell.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { sound } from '/engine/fx.js';
import { PokerConnection } from './network.js';
import { createScene } from './scene.js';
import { renderCards } from './cards.js';
import { HANDS, tablePlayers, messageText } from './rules.js';
import { loc, locn } from '/engine/i18n.js';

const $ = id => document.getElementById(id), code = roomCode();
const params = new URLSearchParams(location.search);
const world = createScene($('world'), { onStarter: (input, power) => { if (!menu.isOpen) { sound.unlock(); room.cacho(input, power); } } }); let stopped = false, lastRevision = -1, lastPhase = 'lobby', lastTurn = null;
let cameraView = 'plaza';
const seatNodes = new Map();
const room = new PokerConnection({ code, name: loadName(), avatar: loadAvatar(), onState: render, onStatus(text, failed = false) {
  $('connection').textContent = text; $('recovery-copy').textContent = text; $('recovery').hidden = !failed || room.state.phase === 'lobby';
} });
const seating = createTableSeating($('table-seating'), (from, to) => {
  const players = room.state.players.filter(p => p.connected);
  room.reseat(room.state.players.indexOf(players[from]), room.state.players.indexOf(players[to]));
});
$('organize-table').onclick = () => room.setup();
const mapPicker = createMapPicker($('map-picker'), mapId => room.setMap(mapId), { table: true, landmarks: true });
const roomOptions = createRoomOptions($('room-options'), { title: loc('Póquer'), fields: OPTION_FIELDS, change: patch => room.configure(patch), reset: () => room.configure(DEFAULT_OPTIONS, 'plaza') });
const menu = createGameMenu({ pad: { buttons: true }, title: loc('Póquer · Pana'), orientation: 'libre', sound,
  options: [{ id: 'view', label: loc('Cámara'), choices: [['plaza', loc('En la plaza')], ['mesa', loc('Sobre la mesa')]], get: () => cameraView, set: value => { cameraView = value; world.setView(value); } }],
  note: () => room.local ? loc('La práctica está en pausa.') : loc('La mesa online sigue. Tienes {n} segundos por turno.', { n: room.state.options.turnSeconds }),
  controls: [[loc('Ratón / dedo'), loc('Elige retirarte, igualar o subir')], [loc('Apuesta total'), loc('Escribe el total que quieres apostar en esta calle')], ['M', loc('Sonido')], ['Esc', loc('Menú')]],
  tips: [loc('¿Quién reparte primero? Al empezar la partida todos sacuden el cacho a la vez: el dado más alto se lleva el botón del repartidor. Si hay empate arriba, solo los empatados sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('Texas reparte dos cartas privadas; Omaha reparte cuatro y exige usar exactamente dos de tu mano y tres de la mesa. Las fichas, ciegas y límites los elige el anfitrión.'),
    loc('Hay cuatro rondas de apuestas: antes del flop, flop (tres cartas), turn (cuarta) y river (quinta). Puedes pasar si no debes fichas, igualar, subir o retirarte.'),
    loc('Subir indica tu apuesta total en esta calle, incluyendo lo que ya pusiste. La subida mínima es la última subida completa. Puedes apostar todas tus fichas aunque no alcancen ese mínimo.'),
    loc('Si alguien va con todo, los pozos secundarios se reparten entre quienes aportaron a cada uno. Una subida incompleta no reabre la opción de subir a quien ya actuó.'),
    loc('De menor a mayor: {hands}. El as también sirve para la escalera A-2-3-4-5. Si las mejores cinco cartas empatan, comparten el pozo.', { hands: HANDS.map(hand => loc(hand, { $ctx: 'mano' })).join(', ') }),
    loc('Al vencer el tiempo elegido pasas si puedes, o te retiras. Si pierdes la conexión, te retiras de esa mano salvo que ya hayas ido con todo. Quien llega con una mano en curso espera la siguiente.'),
    loc('Con recompras, la siguiente mano repone la cantidad inicial a quien quedó en cero. Sin recompras, observa hasta que el anfitrión cambie los ajustes. En límite fijo hay hasta cuatro apuestas por calle; en turn y river la apuesta se duplica.')],
  invite: () => inviteUrl(code), onOpen() { render(room.state); }, onClose() { render(room.state); }, canOpen: () => room.state.phase !== 'finished',
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('room-code').textContent = loc('Sala {code}', { code }); $('roster').translate = false; $('rules').onclick = () => menu.open('controls');
$('start').onclick = () => { sound.unlock(); room.start(); }; $('again').onclick = () => room.start();
for (const id of ['practice', 'fallback']) $(id).onclick = () => { menu.close(); $('recovery').hidden = true; room.practice(); };
$('fold').onclick = () => room.act('fold'); $('call').onclick = () => room.act('call');
$('raise').onclick = () => { const value = Number($('amount').value), legal = room.state.legal; if (!legal || !Number.isInteger(value) || value > legal.max || value < Math.min(legal.min, legal.max)) { $('amount').reportValidity(); return; } room.act('raise', value); };
addEventListener('keydown', event => { if (!menu.isOpen && !event.target.closest?.('input, textarea, select') && event.key.toLowerCase() === 'm') toggleMute(); });
function render(state) {
  const options = state.options || DEFAULT_OPTIONS;
  roomOptions.update(options, room.connected && room.isHost && state.phase === 'lobby');
  if (state.phase !== 'lobby' && roomOptions.isOpen) roomOptions.close();
  $('variant-label').textContent = options.variant === 'omaha' ? 'OMAHA' : 'TEXAS HOLD’EM';
  $('lobby-copy').textContent = options.variant === 'omaha' ? loc('Cuatro cartas solo para ti. Usa exactamente dos de tu mano y tres de la mesa.') : loc('Dos cartas solo para ti. Cinco en la mesa. Igualas, subes… o te guardas el farol.');
  $('initial-stack').textContent = options.stack.toLocaleString('es');
  $('initial-blinds').textContent = `${options.blinds / 2}/${options.blinds}`;
  seating.update(state.players.filter(p => p.connected), { enabled: room.connected && state.phase === 'lobby', canArrange: room.isHost, members: room.link?.state.players || [], ownId: room.id, hostId: room.local ? room.id : room.link?.state.players.find(p => p.id === room.link.state.host)?.seat });
  $('organize-table').disabled = !room.connected || !room.isHost;
  mapPicker.update(state.mapId, room.connected && room.isHost && state.phase === 'lobby');
  const lobby = state.phase === 'lobby', finished = state.phase === 'finished', starter = state.phase === 'starter', legal = state.legal, canAct = !!legal && room.connected && !menu.isOpen;
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('controls').hidden = lobby || finished || starter;
  $('start').disabled = !room.connected || !room.isHost || (!state.canStart && state.players.filter(p => p.connected && !p.bot).length > 1); $('start').textContent = !room.connected ? loc('Conectando…') : room.isHost ? loc('¡Repartir!') : loc('El anfitrión abre la mesa');
  $('invite').disabled = room.local || !room.connected;
  $('roster').textContent = state.players.filter(p => p.connected).map(p => p.name).join(' · ');
  $('street').textContent = { lobby: loc('La mesa está lista'), starter: loc('¿Quién reparte?'), preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River', finished: loc('Mano terminada') }[state.phase];
  $('pot').textContent = lobby || starter ? 'PANA' : loc('Pozo {n}', { n: state.pot });
  const me = state.players.find(p => p.id === room.id), current = state.players.find(p => p.id === state.turn);
  $('turn').textContent = !room.connected ? loc('Reconectando…') : legal ? loc('¡Tu turno!') : me?.folded ? me.hole.length ? loc('Te retiraste. La mano continúa.') : loc('Te sientas en la siguiente mano.') : current?.name ? loc('Turno de {name}', { name: current.name }) : loc('Turno de tu pana');
  $('message').textContent = messageText(state.message);
  $('fold').disabled = $('call').disabled = !canAct; $('raise').disabled = !canAct || !legal?.raise; $('amount').disabled = !canAct || !legal?.raise;
  $('call').textContent = legal?.call ? loc('Igualar {n}', { n: legal.call }) : loc('Pasar');
  if (legal) {
    const min = Math.min(legal.min, legal.max); $('amount').min = min; $('amount').max = legal.max;
    if (state.turn !== lastTurn || lastRevision !== state.revision) $('amount').value = min;
    $('limits').textContent = legal.raise ? loc('{min}–{max} fichas', { min, max: legal.max }) : loc('No puedes subir ahora');
    $('raise').textContent = legal.max < legal.min ? loc('Ir con todo') : state.currentBet ? loc('Subir') : loc('Apostar');
  } else $('limits').textContent = '';
  if (lastRevision !== state.revision || lobby) {
    renderCards($('board'), state.board, 5); renderCards($('hand'), me?.hole || []);
    if (lastRevision >= 0 && state.revision !== lastRevision) sound.tone(500, 0, .045, 'triangle', .045);
  }
  const seated = tablePlayers(state);
  for (const p of seated) {
    let node = seatNodes.get(p.id);
    if (!node) { node = document.createElement('div'); node.className = 'seat'; node.innerHTML = '<b></b><strong></strong><span></span>'; $('seats').append(node); seatNodes.set(p.id, node); }
    node.classList.toggle('is-turn', p.id === state.turn); node.classList.toggle('is-folded', p.folded && !lobby && !starter);
    node.children[0].textContent = p.id === room.id ? loc('{name} · tú', { name: p.name }) : p.bot ? loc('{name} · Bot', { name: p.name }) : p.name;
    node.children[1].textContent = locn(p.chips, '{n} fichas', '{n} fichas');
    node.children[2].textContent = starter ? loc('Con su cacho') : p.action ? loc(p.action, { n: p.actionN }) : p.id === state.dealer ? loc('Reparte') : lobby ? loc('En la mesa') : p.bet ? loc('Apuesta {n}', { n: p.bet }) : loc('En juego');
  }
  for (const [id, node] of seatNodes) if (!seated.some(p => p.id === id)) { node.remove(); seatNodes.delete(id); }
  $('results').hidden = !finished;
  if (finished && state.result) {
    if (menu.isOpen) menu.close();
    const winningIds = new Set(state.result.pots.filter(pot => !pot.refund).flatMap(pot => pot.winners));
    const winners = state.players.filter(p => winningIds.has(p.id));
    $('result-title').textContent = winners.length === 1 ? loc('¡Ganó {name}!', { name: winners[0].name }) : loc('¡Pozo repartido!');
    $('result-copy').textContent = locn(state.result.total, '{n} fichas en juego.', '{n} fichas en juego.') + ' ' + messageText(state.message);
    fillRoster($('result-board'), [...state.players].sort((a, b) => (state.result.payouts[b.id] || 0) - (state.result.payouts[a.id] || 0)).map(p => ({ name: p.name, detail: locn(p.chips, '{n} fichas en la mesa', '{n} fichas en la mesa'), end: state.result.payouts[p.id] ? `+${state.result.payouts[p.id]}` : '0', me: p.id === room.id })));
    if (lastRevision !== state.revision) {
      $('showdown').replaceChildren();
      for (const p of state.players.filter(p => p.hole.length && p.hole.every(c => c !== null))) { const row = document.createElement('div'), label = document.createElement('span'), cards = document.createElement('div'); row.className = 'showdown-row'; label.textContent = p.name + ' · ' + (p.handName ? loc(p.handName, { $ctx: 'mano' }) : loc('Cartas privadas')); cards.className = 'cards'; renderCards(cards, p.hole); row.append(label, cards); $('showdown').append(row); }
    }
    $('again').disabled = !room.isHost || !room.connected || !state.canStart; $('again').textContent = room.isHost ? loc('Siguiente mano') : loc('El anfitrión reparte');
    if (lastPhase !== 'finished') $('again').focus();
  }
  lastRevision = state.revision; lastPhase = state.phase; lastTurn = state.turn;
}
let previous = performance.now(), tickTime = previous;
const timer = setInterval(() => { const now = performance.now(); room.tick((now - tickTime) / 1000, menu.isOpen); tickTime = now;
  if (room.state.legal && room.local) $('turn').textContent = loc('¡Tu turno! · {n} s', { n: Math.max(0, Math.ceil(room.state.options.turnSeconds - room.elapsed)) });
  if (room.state.legal && room.state.deadline && !room.local) $('turn').textContent = loc('¡Tu turno! · {n} s', { n: Math.max(0, Math.ceil((room.state.deadline - room.link.now()) / 1000)) });
}, 100);
function frame(now) { if (stopped) return; const dt = Math.min(.05, (now - previous) / 1000); previous = now; world.draw(room.state, room.id, dt); for (const a of world.anchors()) { const node = seatNodes.get(a.id); if (node) { node.style.left = `${a.x}%`; node.style.top = `${a.y}%`; } } requestAnimationFrame(frame); }
render(room.state); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.poquerDebug = { room, world, menu };

await prepareScene(world);
