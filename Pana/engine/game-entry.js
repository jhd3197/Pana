// A light illustrated lobby paints before importing the game's full module graph.
// Controls/settings remain the game's existing DOM, and membership stays in net.js.
import { loadAvatar, loadName } from './avatar.js';
import { cachedPortrait } from './portrait-cache.js';
import { icon } from './icons.js';
import { inviteUrl, roomFromUrl } from './invite.js';

const tag = document.querySelector('script[data-pana-entry]');
const game = location.pathname.match(/\/g\/([^/]+)/)?.[1];
const original = document.querySelector('.pk-lobby');
const el = (name, cls, text) => { const node = document.createElement(name); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };
let link, loaded = false, failed = false, ready = true, signature = '';
let maxPlayers = 8;
const docked = [];
const root = el('section', 'pk-game-lobby'); root.id = 'pana-lobby-shell'; root.setAttribute('aria-label', 'Sala del juego');
root.style.setProperty('--lobby-image', `url("/images/launcher/${game}.${game === 'embuste' ? 'png' : 'jpg'}")`);
const head = el('header', 'pk-game-lobby-head'), back = el('a', 'pk-btn', ' Juegos'); back.prepend(icon('chevronLeft')); back.href = '/';
const title = el('h1', 'pk-title', document.title.split(/[·—]/)[0].trim());
const invite = el('button', 'pk-btn pk-btn--teal', 'Copiar link'); invite.type = 'button';
const roomCode = el('b', 'pk-game-lobby-code');
const roomBox = el('div', 'pk-game-lobby-room'); roomBox.append(roomCode, invite); head.append(back, title, roomBox);
const layout = el('div', 'pk-game-lobby-layout'), rosterBox = el('section', 'pk-game-lobby-roster');
const rosterLabel = el('h2', 'pk-eyebrow', 'Panas en la sala'), roster = el('div', 'pk-game-lobby-players'); roster.id = 'pana-lobby-roster';
rosterBox.append(rosterLabel, roster);
const settings = el('section', 'pk-game-lobby-settings'); settings.append(el('h2', 'pk-eyebrow', 'Ajustes de la sala'));
if (original) { original.inert = true; settings.append(original); }
// Curiara already owns the authoritative boat/seat controls; present those in
// the large roster area instead of creating another team-selection protocol.
function dockSeats() {
  if (game !== 'curiara') return;
  const seats = document.getElementById('seats');
  if (!seats) return;
  rosterBox.append(seats);
  const showSeats = () => { roster.hidden = !seats.classList.contains('hidden'); };
  new MutationObserver(showSeats).observe(seats, { attributes: true, attributeFilter: ['class'] });
  showSeats();
}
layout.append(rosterBox, settings);
const footer = el('footer', 'pk-game-lobby-foot'), status = el('p', 'pk-copy', 'Cargando el juego en segundo plano…'); status.id = 'pana-lobby-status'; status.setAttribute('role', 'status');
const readyButton = el('button', 'pk-btn pk-btn--primary', 'Preparando…'); readyButton.id = 'pana-lobby-ready'; readyButton.disabled = true;
const change = el('a', 'pk-btn', 'Cambiar pana'); change.href = '/#mi-pana';
footer.append(status, change, readyButton); root.append(head, layout, footer); document.body.append(root); document.body.classList.add('pana-in-lobby');
window.PANA_LOBBY_LOADING = true;
document.addEventListener('pana:load-stage', e => { if (!failed) status.textContent = e.detail; });

function portraitFor(person) {
  let avatar = person.avatar || loadAvatar();
  if (typeof avatar === 'string') { try { avatar = JSON.parse(avatar); } catch { avatar = {}; } }
  const img = el('img'); img.alt = ''; const cached = cachedPortrait(avatar);
  if (cached) img.src = cached;
  if (!cached) {
    img.hidden = true;
    // Snapshot after the game is ready, so portrait rendering never delays game preparation.
    const make = () => import('./portrait.js').then(m => m.portrait(avatar)).then(src => { img.src = src; img.hidden = false; }).catch(() => {});
    if (loaded) make(); else document.addEventListener('pana:game-prepared', make, { once: true });
  }
  return img;
}
function renderRoster() {
  const players = link?.state.players.filter(p => p.connected !== false) || [{ id: 'local', name: loadName(), avatar: loadAvatar(), lobbyReady: ready, assetsReady: loaded }];
  const key = JSON.stringify(players.map(p => [p.id, p.name, p.avatar, p.lobbyReady, p.assetsReady])) + link?.state.host + loaded;
  roomCode.textContent = (link?.code || roomFromUrl() || '').toUpperCase();
  invite.disabled = !roomCode.textContent;
  if (key === signature) return; signature = key;
  rosterLabel.textContent = `Panas en la sala · ${players.length} / ${maxPlayers}`;
  roster.replaceChildren();
  for (const p of players) {
    const mine = p.id === (link?.id || 'local'), host = p.id === link?.state.host || !link;
    const card = el('article', 'pk-game-lobby-player' + (host ? ' is-host' : ''));
    if (host) card.append(el('span', 'pk-game-lobby-host', 'Anfitrión'));
    card.append(portraitFor(p), el('b', '', p.name + (mine ? ' (tú)' : '')));
    card.append(el('span', 'pk-game-lobby-state' + (p.assetsReady && p.lobbyReady ? ' is-ready' : ''), !p.assetsReady ? 'Cargando' : p.lobbyReady ? 'Listo' : 'Esperando'));
    roster.append(card);
  }
  for (let i = players.length; i < maxPlayers; i++) {
    const empty = el('button', 'pk-game-lobby-empty', 'Invitar pana'); empty.type = 'button'; empty.prepend(icon('plus')); empty.addEventListener('click', () => invite.click()); empty.disabled = !roomCode.textContent; roster.append(empty);
  }
}
invite.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(inviteUrl(link?.code || roomFromUrl())); invite.textContent = '¡Copiado!'; }
  catch { status.textContent = 'Comparte el código de sala: ' + roomCode.textContent; }
});
readyButton.addEventListener('click', () => { ready = !ready; link?.send('lobby-ready', { ready }); updateReady(); renderRoster(); });
function updateReady() {
  readyButton.disabled = !loaded;
  readyButton.textContent = !loaded ? 'Preparando…' : ready ? 'Listo · esperar' : '¡Estoy listo!';
  readyButton.setAttribute('aria-pressed', String(ready));
  const waiting = link?.state.players.filter(p => p.id !== link.id && p.connected !== false && (!p.assetsReady || !p.lobbyReady)) || [];
  if (loaded) status.textContent = !ready ? 'Avísales cuando estés listo.' : waiting.length ? `Esperando a ${waiting.map(p => p.name).join(', ')}.` : link && !link.isHost ? 'Todo preparado. El anfitrión inicia la partida.' : 'Todo preparado. Elige los ajustes y comienza la partida.';
}
document.addEventListener('pana:room-link', e => {
  link = e.detail; signature = '';
  link.on('state', () => { renderRoster(); updateReady(); });
  link.send('lobby-ready', { ready, loaded });
  renderRoster(); updateReady();
});
// The game's own start control keeps host permissions and rules. This guard adds
// only the real asset/readiness barrier, also for keyboard activation.
root.addEventListener('click', e => {
  const control = e.target.closest('#start, #play, #practice, #intro-start, #begin');
  if (!control) return;
  const waiting = link?.state.players.some(p => p.connected !== false && (!p.assetsReady || !p.lobbyReady));
  if (!loaded || !ready || (control.id !== 'practice' && waiting)) {
    e.preventDefault(); e.stopImmediatePropagation();
    status.textContent = loaded ? 'Falta que todos los panas estén listos.' : 'El juego todavía se está preparando.';
  }
}, true);
// Some games also start from Space/Enter on the document. Apply the same
// readiness barrier there while keeping inputs, ready toggles and menus usable.
window.addEventListener('keydown', e => {
  if (root.hidden || ![' ', 'Enter'].includes(e.key)) return;
  if (root.contains(e.target) && e.target.closest('button, a')) {
    // Let the native click activate the focused control, without also triggering
    // the game's document-level start shortcut.
    e.stopImmediatePropagation(); return;
  }
  if (e.target.closest('input, textarea, select, dialog, [contenteditable]')) return;
  if (!loaded || !ready || link?.state.players.some(p => p.connected !== false && (!p.assetsReady || !p.lobbyReady))) {
    e.preventDefault(); e.stopImmediatePropagation();
    status.textContent = loaded ? 'Falta que todos los panas estén listos.' : 'El juego todavía se está preparando.';
  }
}, true);
function visibility() {
  if (!loaded || !original) return;
  const hidden = original.hidden || original.classList.contains('hidden') || original.style.display === 'none';
  root.hidden = hidden;
  document.body.classList.toggle('pana-in-lobby', !root.hidden);
  // Games re-set `hidden` on every HUD render, and each set fires the observer.
  // Move a docked control only when it is in the wrong place: re-inserting it
  // would detach it many times a second (lost focus, missed clicks).
  for (const { node, placeholder, target } of docked) {
    if (hidden) { if (node.nextSibling !== placeholder) placeholder.parentNode.insertBefore(node, placeholder); }
    else if (node.parentNode !== target) target.append(node);
  }
}
if (original) new MutationObserver(visibility).observe(original, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
fetch('/api/games').then(r => r.json()).then(data => {
  const info = data.games.find(g => g.id === game); if (!info) return; title.textContent = info.name; maxPlayers = info.players; signature = ''; renderRoster();
}).catch(() => {});
renderRoster();
try {
  // A versioned gateway must also import the game at this deployment's address.
  const prefix = new URL(import.meta.url).pathname.match(/^\/_v\/[^/]+/)?.[0] || '';
  const url = new URL(tag.dataset.panaEntry, location.href); url.pathname = prefix + url.pathname.replace(/^\/_v\/[^/]+/, '');
  const module = await import(url.href);
  await module.sceneReady;
  dockSeats();
  for (const id of ['menu', 'sound', 'invite']) {
    const node = document.getElementById(id);
    if (!node || root.contains(node)) continue;
    const placeholder = document.createComment('lobby control home'); node.before(placeholder);
    const target = id === 'invite' ? roomBox : head;
    docked.push({ node, placeholder, target });
    if (id === 'invite') invite.hidden = true;
  }
  loaded = true; window.PANA_LOBBY_LOADING = false; window.PANA_PREPARED = true;
  if (original) original.inert = false;
  link?.send('lobby-ready', { ready, loaded: true });
  document.dispatchEvent(new Event('pana:game-prepared'));
  updateReady(); renderRoster(); visibility();
} catch (error) {
  failed = true; console.error('Game preparation failed', error);
  status.textContent = 'No pudimos preparar el juego. Comprueba la conexión e inténtalo otra vez.';
  const retry = el('button', 'pk-btn', 'Volver a intentar'); retry.onclick = () => location.reload(); footer.append(retry);
}
