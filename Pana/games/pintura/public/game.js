import { loadName, loadAvatar } from '/engine/avatar.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { holdButton } from '/engine/touch.js';
import { fillRoster } from '/engine/results.js';
import { sound } from '/engine/fx.js';
import { PaintConnection } from './network.js';
import { createScene } from './scene.js';
import { COVER, TARGET, segmentBox } from './rules.js';

const $ = id => document.getElementById(id), code = roomFromUrl() || newRoomCode();
const params = new URLSearchParams(location.search); params.set('room', code); history.replaceState(null, '', `${location.pathname}?${params}`);
const held = new Set(), pads = []; let aim = null, firing = false, touchFire = false, queuedFire = false, queuedReload = false, stopped = false, lastPhase = 'lobby', lastAmmo = 12, lastHits = 0;
const world = createScene($('world'));
const room = new PaintConnection({ code, name: loadName(), avatar: loadAvatar(), onState: render, onStatus(text, failed = false) {
  $('connection').textContent = text; $('recovery-copy').textContent = text; $('recovery').hidden = !failed || room.state.phase === 'lobby';
} });
const menu = createGameMenu({ title: '¡Pintura! · Pana', orientation: 'libre', sound,
  note: () => room.local ? 'La práctica está en pausa.' : 'La ronda online sigue mientras estás en el menú.',
  controls: [['WASD / Flechas', 'Moverte por la cancha'], ['Ratón / tocar cancha', 'Apuntar'], ['Clic / Espacio', 'Disparar pintura'], ['R', 'Recargar'], ['M', 'Sonido'], ['Esc', 'Menú']],
  tips: ['Una pintada suma un punto. Gana quien llegue a diez o tenga más al terminar los dos minutos. Si empatan, comparten la victoria.',
    'Las barricadas frenan las bolas. Tienes doce por carga; recargas con R o automáticamente al vaciarla.',
    'Vuelves a la cancha 2,5 segundos después de una pintada. Al reaparecer tienes 1,5 segundos de protección; disparar la cancela.',
    'En teléfono usa las flechas y mantén Pinta: apuntas al rival visible más cercano. También puedes tocar la cancha para apuntar.',
    'Si estás solo, tres bots entran contigo. Con amigos la cancha es de ustedes. Puedes invitar hasta ocho panas.'],
  invite: () => inviteUrl(code), onOpen: clearInput, onClose() {}, canOpen: () => room.state.phase !== 'finished',
});
$('game-nav').append(menu.createInviteButton({ id: 'invite', className: 'pk-btn' }), menu.createButton({ id: 'menu', className: 'pk-btn' }));
$('room-code').textContent = `Sala ${code}`; $('rules').onclick = () => menu.open('controls');
$('start').onclick = () => { sound.unlock(); room.start(); }; $('again').onclick = () => room.start();
for (const id of ['practice', 'fallback']) $(id).onclick = () => { menu.close(); $('recovery').hidden = true; room.practice(); };
function clearInput() { held.clear(); firing = touchFire = queuedFire = queuedReload = false; pads.forEach(p => p.release()); room.input({}); }
function active() { return room.connected && room.state.phase === 'playing' && !menu.isOpen; }
for (const [id, key] of [['up', 'w'], ['left', 'a'], ['down', 's'], ['right', 'd'], ['reload', 'r']]) pads.push(holdButton($(id), { down: () => { held.add(key); if (key === 'r') queuedReload = true; }, up: () => held.delete(key), paused: () => !active() }));
pads.push(holdButton($('fire'), { down: () => { touchFire = queuedFire = true; sound.unlock(); }, up: () => { touchFire = false; }, paused: () => !active() }));
$('world').addEventListener('pointermove', event => { if (active()) aim = world.point(event.clientX, event.clientY); });
$('world').addEventListener('pointerdown', event => { if (!active() || event.button !== 0) return; event.preventDefault(); $('world').focus({ preventScroll: true }); aim = world.point(event.clientX, event.clientY); firing = queuedFire = true; sound.unlock(); $('world').setPointerCapture(event.pointerId); });
for (const type of ['pointerup', 'pointercancel']) $('world').addEventListener(type, () => { firing = false; });
addEventListener('blur', clearInput); document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
addEventListener('keydown', event => {
  if (menu.isOpen || event.target.closest?.('input, button, textarea, select, a')) return;
  const key = event.key.toLowerCase(); if (key === 'm') toggleMute();
  if (['w', 'a', 's', 'd', 'r', ' ', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) { event.preventDefault(); if (active()) { held.add(key); if (key === ' ') queuedFire = true; if (key === 'r') queuedReload = true; } }
});
addEventListener('keyup', event => held.delete(event.key.toLowerCase()));
function input() {
  if (!active()) return {};
  const me = room.state.players.find(p => p.id === room.id); if (!me) return {};
  let ax = aim ? aim.x - me.x : me.ax, az = aim ? aim.z - me.z : me.az;
  if (touchFire) {
    const nearest = room.state.players.filter(p => p.id !== me.id && p.connected && !p.respawn && !p.shield && !COVER.some(o => segmentBox(me.x, me.z, p.x - me.x, p.z - me.z, o) !== null))
      .sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
    if (nearest) { ax = nearest.x - me.x; az = nearest.z - me.z; }
  }
  const length = Math.hypot(ax, az) || 1;
  return { x: Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft')),
    z: Number(held.has('s') || held.has('arrowdown')) - Number(held.has('w') || held.has('arrowup')),
    ax: ax / length, az: az / length, fire: queuedFire || firing || touchFire || held.has(' '), reload: queuedReload || held.has('r') };
}
function render(state) {
  const lobby = state.phase === 'lobby', finished = state.phase === 'finished';
  $('lobby').hidden = !lobby; $('hud').hidden = lobby || finished; document.body.classList.toggle('in-lobby', lobby);
  $('start').disabled = !room.connected || !room.isHost; $('start').textContent = !room.connected ? 'Conectando…' : room.isHost ? '¡A la cancha!' : 'El anfitrión inicia la ronda';
  $('invite').disabled = room.local || !room.connected; $('roster').textContent = state.players.filter(p => p.connected).map(p => p.name).join(' · ');
  const me = state.players.find(p => p.id === room.id), order = [...state.players].sort((a, b) => b.score - a.score || a.hits - b.hits);
  $('score').textContent = `${me?.score || 0} / ${TARGET}`; $('position').textContent = `${Math.max(1, order.findIndex(p => p.id === room.id) + 1)} de ${state.players.length} panas`;
  const seconds = Math.ceil(state.time); $('timer').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('ammo').textContent = me?.reload > 0 ? `Recargando ${me.reload.toFixed(1)} s` : `${me?.ammo ?? 12} / 12 bolas`;
  $('feed').textContent = state.message; $('respawn').hidden = !me?.respawn; $('respawn').textContent = `¡Te pintaron! Vuelves en ${Math.ceil(me?.respawn || 0)}`;
  if (me && state.phase === 'playing') { if (me.ammo < lastAmmo) sound.tone(260, 0, .045, 'triangle', .05); if (me.hits > lastHits) sound.tone(130, 0, .16, 'sine', .1); lastAmmo = me.ammo; lastHits = me.hits; }
  $('results').hidden = !finished;
  if (finished) {
    menu.close(); const winners = order.filter(p => p.score === order[0]?.score);
    $('result-title').textContent = winners.length > 1 ? '¡Empate de pintura!' : `¡Ganó ${winners[0]?.name}!`;
    $('result-copy').textContent = `${order[0]?.score || 0} pintadas en la mejor marca. ¿Otra ronda?`;
    fillRoster($('result-board'), order.map((p, i) => ({ rank: i + 1, name: p.name, detail: `${p.hits} recibidas${p.bot ? ' · Bot' : ''}`, end: p.score, score: true, me: p.id === room.id })));
    $('again').disabled = !room.isHost || !room.connected; $('again').textContent = room.isHost ? 'Otra ronda' : 'El anfitrión prepara la revancha';
    if (lastPhase !== 'finished') { clearInput(); $('again').focus(); }
  }
  lastPhase = state.phase;
}
let previous = performance.now(), stoppedAt = previous;
const timer = setInterval(() => { const now = performance.now(), dt = (now - stoppedAt) / 1000; stoppedAt = now; room.input(input()); queuedFire = queuedReload = false; room.tick(dt, menu.isOpen); }, 50);
function frame(now) { if (stopped) return; const dt = Math.min(.05, (now - previous) / 1000); previous = now; world.draw(room.state, room.id, dt, aim); requestAnimationFrame(frame); }
render(room.state); room.connect(); requestAnimationFrame(frame);
addEventListener('pagehide', () => { stopped = true; clearInterval(timer); room.dispose(); world.dispose(); }, { once: true });
if (params.has('debug')) window.pinturaDebug = { room, world, menu, input };
