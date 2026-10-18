import { createRoomOptions } from '/engine/room-options.js';
import { FIELDS, DEFAULT_OPTIONS } from './options.js';
import { prepareScene } from '/engine/game-load.js';
import { createTableSeating } from '/engine/table-seating.js';
import { createMapPicker } from '/engine/map-picker.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { CaidaRoom } from './network.js';
import { CaidaGame, canto, cantoDescription, chooseMove, previewPlay, teamOf, nextDealer, cardName, MODES } from './rules.js';
import { cardButton } from './cards.js';
import { createDealerUI } from './dealer-ui.js';
import { barksFor } from './barks.js';

const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomFromUrl() || newRoomCode();
params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
let world = null, ready = false, stopped = false, selected = null, previousEvent = 0, barksPrimed = false, shownResult = '', resultTimer, toastTimer, announcementTimer;
const audio = { muted: false, volume: .8, unlocked: false, impl: null,
  unlock() { this.unlocked = true; this.impl?.unlock(); }, setVolume(v) { this.volume = v; this.impl?.setVolume(v); },
  tone(...args) { if (this.impl) { this.impl.muted = this.muted; this.impl.tone(...args); } },
};
import('/engine/fx.js').then(({ sound }) => { audio.impl = sound; sound.setVolume(audio.volume); if (audio.unlocked) sound.unlock(); }).catch(() => {});
function notify(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3600); }
const room = new CaidaRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render, onNotice: notify,
  onStatus(message, failed) { $('connection').textContent = message; $('practice').hidden = !failed; $('invite').disabled = $('lobby-invite').disabled = !room.connected || room.offline; render(room.state); },
});
const optionsUI = createRoomOptions($('room-options'), { title: 'Caída', fields: FIELDS, change: options => room.action('configure', { options }), reset: () => room.action('configure', { options: { ...DEFAULT_OPTIONS, mapId: 'plaza' } }) });
const seating = createTableSeating($('table-seating'), (from, to) => room.action('seat', { from, to }));
$('organize-table').onclick = () => room.action('setup');
const mapPicker = createMapPicker($('map-picker'), mapId => room.action('configure', { options: { mapId } }), { table: true, landmarks: true });
const dealerUI = createDealerUI(room, () => audio.unlock());
const menu = createGameMenu({ title: 'Caída · Pana', sound: audio,
  note: () => room.members.size > 1 ? 'La mesa sigue jugando mientras estás en el menú.' : 'La partida está en pausa. Los bots te esperan.',
  controls: [['1 2 3', 'Seleccionar una carta'], ['Enter', 'Jugar la carta seleccionada'], ['C', 'Cantar antes de jugar la primera carta'], ['H', 'Pedir una pista'], ['M', 'Activar o silenciar sonido'], ['Esc', 'Abrir o cerrar el menú']],
  tips: [
    'Gana quien llegue primero a 24 puntos. Son 40 cartas: as, 2, 3, 4, 5, 6, 7, sota (10), caballo (11) y rey (12), en cuatro palos. Los palos no cambian las capturas.',
    'Se dan tres cartas por persona y cuatro cartas distintas a la mesa. El siguiente al repartidor empieza. Cuando todos juegan sus tres cartas, se reparten tres más. El repartidor cambia después de agotar la baraja.',
    'Juega una carta del mismo número que una de la mesa para recoger ambas y todas las consecutivas que le sigan, sin saltos: después del 7 viene la sota. Si no hay coincidencia, tu carta se queda en la mesa.',
    '¡Caída! Solo si recoges la carta que el jugador anterior acaba de dejar: as a 7, un punto; sota, dos; caballo, tres; rey, cuatro. Recoger una carta vieja no es caída. En equipos no se puntúa una caída al compañero.',
    'Mesa limpia suma cuatro puntos si aún quedan cartas por repartir. En últimas no vale. En esta mesa, caída y mesa limpia suman juntas.',
    'En cada reparto, quien reparte puede cortar la baraja una vez, boca abajo, y elige empezar por 1 o por 4: 1–2–3–4 o 4–3–2–1. Cada acierto suma el número cantado. Sin aciertos: mal echada, un punto para el siguiente jugador. Los números repetidos se devuelven al fondo antes de continuar.',
    'Cantos clásicos de esta mesa: ronda (pareja), 1–4 según la carta; rondín (tres iguales), 5; patrulla, también llamada patria (tres consecutivas), 6; vigía (pareja y carta adyacente), 7; registro (as, caballo, rey), 8. Solo el canto de mayor valor, antes de jugar tu primera carta. Puedes jugar sin cantarlo.',
    'Aquí no se juega flor, matar cantos ni victoria automática por rondín. Puedes desactivar todos los cantos al abrir la mesa.',
    'La última persona que recoge se lleva las cartas sobrantes, sin puntos de mesa limpia. Al contar, suma cada carta por encima de 20 en uno contra uno o parejas, 13 con tres personas, 10 con cuatro individuales y 6 con seis individuales. Los equipos de tres usan la base de 20. Si varios llegan a 24 al contar, se resuelve desde quien es mano.',
    'En parejas o equipos de tres, los compañeros ocupan puestos alternos y comparten puntos y cartas recogidas. Los puestos vacíos los juegan bots. Un pana nuevo toma un puesto de bot; los demás observan hasta que haya espacio.',
  ],
  actions: [{ id: 'new-table', label: 'Abrir otra mesa', run: () => { location.href = '/g/caida/'; } }],
  invite: () => inviteUrl(code),
  canOpen: () => !$('result').open,
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('lobby-invite-slot').replaceWith(menu.createInviteButton({ id: 'lobby-invite', className: 'pk-btn' }));
$('lobby-room').textContent = `Sala ${code}`;
$('rules').onclick = () => menu.open('controls'); $('practice').onclick = () => room.practice();
$('start').onclick = () => { audio.unlock(); room.action('start'); }; $('next-round').onclick = () => room.action('start');
let view = 'patio'; $('camera-view').onclick = () => { view = view === 'patio' ? 'mesa' : 'patio'; world?.setView(view); $('camera-view').textContent = view === 'mesa' ? 'Vista del patio' : 'Vista de mesa'; $('camera-view').setAttribute('aria-pressed', String(view === 'mesa')); };
$('play').onclick = playSelected; $('chant').onclick = () => room.action('chant'); $('hint').onclick = hint;
$('review').onclick = closeResult; $('round-result').onclick = showResult;
$('result').addEventListener('cancel', e => { e.preventDefault(); closeResult(); });
function ownTurn() { return ready && room.connected && room.state.phase === 'playing' && room.seat >= 0 && room.state.turn === room.seat; }
function selectCard(id) { if (!ownTurn() || menu.isOpen) return; selected = selected === id ? null : id; renderHand(room.state); }
function playSelected() { if (!ownTurn() || !selected) return; const id = selected; selected = null; room.action('play', { card: id }); }
function hint() {
  if (!ownTurn()) return;
  const move = chooseMove(room.state, room.seat); if (!move) return;
  selected = move.card; renderHand(room.state);
  const card = room.state.players[room.seat].hand.find(c => c.id === selected), preview = previewPlay(room.state, card, room.seat);
  notify(`${cardName(card)}: ${preview.points ? `puedes sumar ${preview.points} puntos.` : preview.capture.length ? `recoges ${preview.capture.length + 1} cartas.` : 'la dejas sobre la mesa.'}`);
}
function render(state) {
  optionsUI.update(state.options, room.connected && room.isHost && state.phase === 'lobby');
  if (state.phase !== 'lobby' && optionsUI.isOpen) optionsUI.close();
  seating.update(state.players, { teams: MODES[state.options.mode].teams, enabled: room.connected && state.phase === 'lobby', canArrange: room.isHost, members: room.link?.state.players || [], ownId: room.id, hostId: room.hostId });
  $('organize-table').disabled = !room.connected || !room.isHost;
  $('organize-table').textContent = MODES[state.options.mode].teams ? 'Cambiar equipos · empezar de cero' : 'Organizar mesa · empezar de cero';
  mapPicker.update(state.mapId, ready && room.connected && room.isHost && state.phase === 'lobby');
  document.body.classList.toggle('in-lobby', state.phase === 'lobby'); $('welcome').hidden = state.phase !== 'lobby';
  $('start').disabled = !ready || !room.connected || !room.isHost;
  $('start').textContent = !ready ? 'Preparando la mesa…' : !room.connected ? 'Conectando…' : room.isHost ? 'Abrir la mesa' : 'El anfitrión abre la mesa';
  $('lobby-roster').textContent = state.players.map(p => p.id === room.id ? 'Tú' : p.name).join(' · ');
  $('round-label').textContent = state.phase === 'lobby' ? 'Mesa abierta' : state.phase === 'dealing' ? `Reparto ${state.round} · preparando` : `Reparto ${state.round} · mano ${state.handNumber}`;
  $('deck-info').textContent = state.phase === 'lobby' ? MODES[state.options.mode].label : `${state.stock.length} por repartir · ${state.table.length} en la mesa`;
  $('last-hand').hidden = state.phase !== 'playing' || state.stock.length > 0;
  $('scores').replaceChildren();
  const ownTeam = room.seat >= 0 ? teamOf(state, room.seat) : -1;
  state.scores.forEach((score, team) => {
    const players = state.players.filter(p => teamOf(state, p.seat) === team), row = document.createElement('div'); row.className = `score-row${team === ownTeam ? ' active' : ''}`;
    const name = document.createElement('span'), number = document.createElement('strong'), sub = document.createElement('small'), progress = document.createElement('div');
    name.className = 'score-name pk-eyebrow'; number.className = 'pk-num'; name.textContent = MODES[state.options.mode].teams ? team === ownTeam ? 'Nosotros' : 'Ellos' : players[0].id === room.id ? 'Tú' : players[0].name;
    number.textContent = score; sub.textContent = score >= 12 ? 'En buena' : MODES[state.options.mode].teams ? players.map(p => p.name).join(' + ') : `${players[0].captured.length} cartas recogidas`;
    progress.className = 'progress'; for (let i = 0; i < 24; i++) { const tick = document.createElement('i'); if (i < score) tick.className = 'filled'; progress.append(tick); }
    row.append(name, number, sub, progress); $('scores').append(row);
  });
  $('history').replaceChildren();
  for (const e of state.history.filter(e => e.kind !== 'deal').slice(-4).reverse()) { const li = document.createElement('li'), name = document.createElement('strong'); li.className = e.kind; name.textContent = e.name; li.append(name, document.createTextNode(e.text)); $('history').append(li); }
  const newEvents = state.history.filter(e => e.id > previousEvent);
  if (newEvents.length) {
    const event = [...newEvents].reverse().find(e => e.kind === 'score' || (e.kind === 'deal' && e.text.startsWith('¡Últimas!')));
    if (event) { $('announcement').textContent = event.kind === 'deal' ? '¡Últimas! Última mano · ya no hay cuatro de mesa.' : `${event.name}: ${event.text}`; $('announcement').classList.add('show'); clearTimeout(announcementTimer); announcementTimer = setTimeout(() => $('announcement').classList.remove('show'), 4200); }
    if (newEvents.some(e => e.kind === 'play')) audio.tone(370, 0, .06, 'triangle', .06);
    if (event) audio.tone(720, .08, .12, 'sine', .05);
    // Arriving mid-game replays the whole history: only bark at what happens live.
    if (barksPrimed) for (const bark of barksFor(state, newEvents)) world?.say(bark.seat, bark.text, bark.time);
  }
  if (world) barksPrimed = true;
  previousEvent = state.eventId;
  renderHand(state);
  const ended = ['round-over', 'finished'].includes(state.phase);
  if (ended) {
    renderResult(state); const key = `${state.round}:${state.phase}`;
    if (shownResult !== key) { shownResult = key; clearTimeout(resultTimer); resultTimer = setTimeout(showResult, 700); }
  } else { clearTimeout(resultTimer); if ($('result').open) closeResult(); shownResult = ''; }
  dealerUI.update(state, ready);
}
function positionTools() {
  document.querySelector('.table-tools').style.top = room.state.phase === 'lobby' ? '' : `${Math.max(innerWidth <= 720 ? 106 : 132, document.querySelector('.scoreboard').getBoundingClientRect().bottom + 10)}px`;
}
addEventListener('resize', positionTools);
function renderHand(state) {
  const player = state.players[room.seat], turn = ownTurn(), hand = player?.hand || [], ended = ['round-over', 'finished'].includes(state.phase);
  if (!turn || !hand.some(c => c.id === selected)) selected = null;
  const focus = document.activeElement?.dataset?.card; $('hand').replaceChildren();
  hand.forEach((card, i) => { const button = cardButton(card, i); button.disabled = !turn; button.classList.toggle('selected', selected === card.id); button.setAttribute('aria-pressed', String(selected === card.id)); button.onclick = () => selectCard(card.id); $('hand').append(button); });
  if (focus) $('hand').querySelector(`[data-card="${focus}"]:not(:disabled)`)?.focus({ preventScroll: true });
  $('your-name').textContent = player ? `${player.name} · ${hand.length} cartas` : 'Estás mirando';
  $('capture-count').textContent = `${player?.captured.length || 0} RECOGIDAS`;
  $('turn-status').textContent = !room.connected ? 'Reconectando…' : ended ? 'Reparto terminado' : state.phase === 'lobby' ? 'La mesa te espera.' : state.phase === 'dealing' ? `${state.players[state.dealer].name} prepara el reparto` : turn ? `¡Tu turno! · ${selected ? 'juégala o cambia' : 'elige una carta'}` : `Juega ${state.players[state.turn].name}`;
  $('turn-status').classList.toggle('active', turn); $('hint').disabled = !turn; $('play').disabled = !turn || !selected; $('play').hidden = ended; $('round-result').hidden = !ended;
  const chant = state.phase === 'playing' && state.options.cantos && player && !player.announced ? canto(hand) : null;
  $('chant').hidden = !chant; $('chant').disabled = !turn; $('chant').textContent = chant ? `Cantar ${chant.name.toLowerCase()} +${chant.points}` : '';
  $('canto-preview').hidden = !chant;
  $('canto-name').textContent = chant ? `${chant.name} · +${chant.points}` : '';
  $('canto-help').textContent = chant ? `${cantoDescription(chant.name)}. ${turn ? 'Canta antes de jugar.' : 'Cántala cuando te toque.'}` : '';
  const card = hand.find(c => c.id === selected), preview = previewPlay(state, card, room.seat);
  $('table-cards').hidden = state.phase === 'lobby'; $('table-cards').replaceChildren();
  for (const tableCard of [...state.table].sort((a, b) => a.rank - b.rank)) {
    const chip = document.createElement('button'); chip.className = `table-rank${preview.capture.includes(tableCard.id) ? ' will-capture' : ''}`;
    chip.textContent = tableCard.rank; chip.setAttribute('aria-label', cardName(tableCard)); chip.title = cardName(tableCard); chip.onclick = () => notify(`${cardName(tableCard)}${state.last?.id === tableCard.id ? ' · última carta jugada' : ''}`); $('table-cards').append(chip);
  }
  positionTools();
  $('instruction').textContent = room.seat < 0 ? 'Mesa completa. Entras cuando se libere un puesto.' : ended ? 'Las cuentas claras, la revancha lista.' : !turn ? 'Mira las cartas y prepara tu jugada.' : !card ? 'Elige una carta para ver tu jugada.' : preview.capture.length ? `${preview.fall ? '¡Caída! ' : ''}Recoges ${preview.capture.length + 1} cartas${preview.clean ? ' · mesa limpia' : ''}${preview.points ? ` · +${preview.points} puntos` : ''}.` : `${cardName(card)} se queda en la mesa.`;
  world?.update(state, room.seat, selected);
}
function renderResult(state) {
  const won = state.result.winner !== null && room.seat >= 0 && state.result.winner === teamOf(state, room.seat);
  $('result-kicker').textContent = state.phase === 'finished' ? 'PARTIDA TERMINADA' : `REPARTO ${state.round} · CUENTA LAS CARTAS`;
  $('result-title').textContent = state.phase === 'finished' ? won ? '¡Esa partida es tuya!' : '¡Vamos por la revancha!' : 'Vamos a contar.';
  $('result-description').textContent = state.phase === 'finished' ? `Se alcanzaron los 24 puntos. ${state.result.reason}.` : `Cada carta por encima de ${state.result.baseline} suma un punto. La última recogida se lleva las sobrantes.`;
  fillRoster($('result-details'), state.scores.map((score, team) => ({
    className: 'result-detail', me: room.seat >= 0 && team === teamOf(state, room.seat), end: `${score} / 24`, score: true,
    name: state.players.filter(p => teamOf(state, p.seat) === team).map(p => p.name).join(' + '),
    detail: `${state.result.counts[team] || 0} cartas${state.result.bonuses.length ? ` · +${state.result.bonuses[team]} al contar` : ''}` })));
  const canStart = room.isHost || (state.phase === 'round-over' && room.seat === nextDealer(state));
  $('next-round').disabled = !canStart || !room.connected;
  $('next-round').textContent = !canStart ? state.phase === 'finished' ? 'El anfitrión abre la revancha' : `Ahora reparte ${state.players[nextDealer(state)].name}` : state.phase === 'finished' ? 'Jugar la revancha →' : 'Preparar siguiente reparto →';
}
function showResult() { if (!['round-over', 'finished'].includes(room.state.phase)) return; menu.close(); if (!$('result').open) $('result').showModal(); }
function closeResult() { $('result').close(); }
addEventListener('keydown', event => {
  if (menu.isOpen || $('result').open || event.repeat || event.target.closest?.('input,textarea,select,[contenteditable]')) return;
  const key = event.key.toLowerCase(); if (key === 'm') toggleMute(); if (key === 'h') hint();
  if (!ownTurn()) return;
  if (/^[123]$/.test(key)) { event.preventDefault(); const card = room.state.players[room.seat].hand[Number(key) - 1]; if (card) selectCard(card.id); }
  if (key === 'enter' && selected) { event.preventDefault(); playSelected(); }
  if (key === 'c') room.action('chant');
});
let lastTick = performance.now(); const timer = setInterval(() => { const now = performance.now(), dt = Math.min(.25, (now - lastTick) / 1000); lastTick = now; room.tick(dt, menu.isOpen && room.members.size <= 1); }, 100);
let frameTime = performance.now(); function frame(now) { if (stopped) return; const dt = Math.min(.05, (now - frameTime) / 1000); frameTime = now; world?.frame(dt); requestAnimationFrame(frame); } requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); clearTimeout(resultTimer); clearTimeout(toastTimer); clearTimeout(announcementTimer); room.dispose(); world?.dispose(); }, { once: true });
render(room.state); room.connect();
export const sceneReady = import('./scene.js').then(m => m.createCaidaScene($('world'), { onCard: selectCard, onLoading: text => { $('loading-copy').textContent = text; } })).then(async scene => {
  if (stopped) { scene.dispose(); return; }
  // Room snapshots can arrive during compilation. Keep them from replacing
  // avatar materials until the initial scene has finished preparing.
  await prepareScene(scene);
  if (stopped) { scene.dispose(); return; }
  world = scene; ready = true; render(room.state); $('loading').hidden = true;
}).catch(error => { console.error(error); $('loading-copy').textContent = 'No pudimos cargar la mesa. Comprueba tu conexión y WebGL.'; const button = document.createElement('button'); button.className = 'pk-btn pk-btn--primary'; button.textContent = 'Volver a intentar'; button.onclick = () => location.reload(); $('loading').append(button); throw error; });
if (params.has('debug')) window.caidaDebug = { room, menu, CaidaGame, chooseMove, previewPlay, canto, render, get world() { return world; } };
