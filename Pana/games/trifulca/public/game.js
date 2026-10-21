// Wiring only: controls → rules (through the room) → scene, HUD and narrator.
import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { roomCode, bootGame } from '/engine/game-shell.js';
import { TrifulcaRoom } from './network.js';
import { createRoomOptions } from '/engine/room-options.js';
import { ROOM_OPTIONS, defaultOptions } from './options.js';
import { createControls } from './controls.js';
import { createHud } from './hud.js';
import { sfx, hush } from './narrator.js';

const $ = (id) => document.getElementById(id), params = new URLSearchParams(location.search);
const code = roomCode();
let world = null, hud = null, seen = -1;
const VOICE_KEY = 'trifulca:narrador';
let voiceOn = (() => { try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; } })();

const room = new TrifulcaRoom({ code, name: loadName(), avatar: loadAvatar(), onState: render,
  onNotice: (text) => hud?.call(text),
  onStatus(text, failed = false) { $('connection').textContent = text; $('practice').hidden = !failed; render(room.state); },
});
const roomOptions = createRoomOptions($('room-options'), { title: 'Trifulca', fields: ROOM_OPTIONS,
  change: options => room.action('options', { options }), reset: () => room.action('options', { options: defaultOptions() }) });
const menu = createGameMenu({ pad: { native: true, help: [['Stick izq. / Cruceta', 'Moverte'], ['A', "Golpe; mantén pa'l trompón"], ['B', 'Esquivar'], ['X', 'Agarrar'], ['Y', '¡Dale!'], ['LB / RB / LT / RT', 'Cubrirte']] }, title: 'Trifulca · Pana', sound, orientation: 'libre',
  note: () => room.members.size > 1 ? 'La trifulca sigue mientras estás en el menú.' : 'La noche está en pausa.',
  controls: [['W A S D / flechas', 'Moverse: tú siempre a la izquierda, derecha es hacia tu rival'], ['J o clic izquierdo', 'Golpe: toque = jab, mantener = trompón'],
    ['K o clic derecho', 'Cubrirse'], ['Espacio', 'Esquivar (con dirección: paso al lado)'], ['L', 'Agarrar y empujar · en el público: ¡cálmate! · al final: mano de caballero'],
    ['T', '¡Dale! (el público se prende, quedas abierto)'], ['1 / 2', 'Apostar al rojo o al azul antes de la campana'], ['Control', 'A golpe · B esquivar · X agarrar · Y ¡dale! · gatillos cubrirse'], ['M', 'Activar o silenciar el sonido']],
  tips: ['Jab le gana al trompón que todavía carga; cubrirse le gana al jab; esquivar le gana al trompón; agarrar le gana a cubrirse.',
    'Sin barra de vida: los golpes llenan tu mareo. Mareado, un golpe limpio te tumba. Tres caídas es K.O.',
    'Si no estás peleando eres el ring: empuja al que se sale pa\' dentro y gana dolitas.', 'Ganador se queda: el que gana sigue, el que pierde va a la cola.'],
  invite: () => room.offline ? null : inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
// First time alone, Start opens the tutorial; the lobby button always does.
const TUTORIAL_KEY = 'trifulca:tutorial';
const tutorialDone = () => { try { return localStorage.getItem(TUTORIAL_KEY) === 'done'; } catch { return true; } };
const markTutorial = () => { try { localStorage.setItem(TUTORIAL_KEY, 'done'); } catch { /* per-viewer nicety */ } };
const humans = () => room.state.players.filter(p => !p.bot).length;
$('rules').onclick = () => { if (room.isHost && room.connected) { sound.unlock(); room.action('tutorial'); } else menu.open('controls'); };
$('start').onclick = () => { sound.unlock(); room.action(!tutorialDone() && humans() <= 1 ? 'tutorial' : 'start'); };
$('again').onclick = () => { sound.unlock(); room.action('start'); };
$('tutorial-go').onclick = $('tutorial-skip').onclick = () => { markTutorial(); sound.unlock(); room.action('start'); };
$('practice').onclick = () => room.practice();
// Bets by corner (the buttons) or by number (keys 1 to 4, in the corners' order).
const bet = (pick) => {
  if (room.state.phase !== 'intro') return;
  const corners = Object.keys(room.state.fight?.odds || {}), corner = typeof pick === 'number' ? corners[pick] : pick;
  if (corner) room.action('bet', { corner });
};
document.addEventListener('trifulca:bet', (event) => bet(event.detail));
const voiceButton = $('voice');
const showVoice = () => { voiceButton.textContent = voiceOn ? 'Voz: sí' : 'Voz: no'; voiceButton.setAttribute('aria-pressed', String(voiceOn)); };
voiceButton.onclick = () => { voiceOn = !voiceOn; if (!voiceOn) hush(); try { localStorage.setItem(VOICE_KEY, voiceOn ? 'on' : 'off'); } catch { /* per-viewer nicety */ } showVoice(); };
showVoice();

const controls = createControls({ paused: () => menu.isOpen, onBet: bet });
addEventListener('keydown', (event) => { if (!menu.isOpen && event.key.toLowerCase() === 'm' && !event.repeat) toggleMute(); });
addEventListener('pointerdown', () => sound.unlock(), { once: true });

// The stick is read against the camera: right on screen is right in the world.
function input() {
  const c = controls.read(), basis = world?.stickBasis();
  const x = basis ? basis.right.x * c.sx + basis.forward.x * c.sy : c.sx, z = basis ? basis.right.z * c.sx + basis.forward.z * c.sy : -c.sy;
  return { x, z, g: c.g, b: c.b, gp: c.gp, e: c.e, a: c.a, t: c.t };
}

hud = createHud({ me: () => room.id, voice: () => voiceOn });

function render(state) {
  const lobby = state.phase === 'lobby';
  roomOptions.update(state.options, lobby && room.isHost);
  if (!lobby && roomOptions.isOpen) roomOptions.close();
  document.body.classList.toggle('in-lobby', lobby); $('lobby').hidden = !lobby; $('hud').hidden = lobby;
  document.body.dataset.phase = state.phase;
  $('start').disabled = !world || !room.connected || !room.isHost;
  $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡A la trifulca!' : 'Espera al anfitrión';
  $('again').disabled = !room.connected || !room.isHost;
  fillRoster($('roster'), state.players.map((p, i) => ({ rank: i + 1, name: p.id === room.id ? `${p.name} · tú` : p.name, detail: p.bot ? 'Bot' : p.nick || 'Pana', me: p.id === room.id })));
  hud.update(state, { replaying: world?.replaying });
  // New events once each: the first snapshot only marks where we are.
  const events = state.events || [];
  if (seen < 0 || events.at(-1)?.n < seen) seen = events.at(-1)?.n ?? 0;
  for (const e of events) {
    if (e.n <= seen) continue;
    seen = e.n;
    if (world) { const extra = world.react(e); if (extra) hud.react({ type: extra }); }
    hud.react(e); sfx(e);
    if (e.type === 'tutorial-fin') markTutorial();
  }
  world?.update(state);
  hud.update(state, { replaying: world?.replaying });
}

render(room.state); room.connect();
export const { sceneReady } = bootGame({
  load: async () => (await import('./scene.js')).createTrifulcaScene($('world'), { me: () => room.id }),
  ready: (created) => { world = created; render(room.state); },
  tickMs: 50,
  tick: (dt) => room.tick(dt, input(), menu.isOpen && room.members.size <= 1),
  frame: (dt, scene) => { scene.frame(dt); hud.tick(dt); hud.keys(controls.read()); },
  dispose: () => { hush(); room.dispose(); },
});
if (params.has('debug')) window.trifulcaDebug = { room, menu, input, controls, get world() { return world; } };
