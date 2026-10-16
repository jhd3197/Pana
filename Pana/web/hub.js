import { createGameMenu } from '/engine/ui.js';

const gamesEl = document.getElementById('games');
const roomsEl = document.getElementById('rooms');
const statusEl = document.getElementById('status');
const nameInput = document.getElementById('name');
const helloName = document.getElementById('hello-name');
const featured = document.getElementById('play-featured');

// Not playable yet; shown so the hub feels like a place that's growing.
const SOON = [
];

// The same settings every game reads (sound, volume, resolution, hints).
const settings = createGameMenu({ title: 'Pana', pause: false, hotkey: false });
document.getElementById('hub-actions').append(settings.createButton({ id: 'open-settings', label: 'Ajustes', kbd: null, className: 'btn btn-ghost' }));

try { nameInput.value = localStorage.getItem('pana:name') || ''; } catch { /* storage off */ }
function syncName() {
  helloName.textContent = playerName();
  try { localStorage.setItem('pana:name', nameInput.value.trim()); } catch { /* storage off */ }
  updateLinks();
}
nameInput.addEventListener('input', syncName);

function playerName() {
  return nameInput.value.trim() || 'pana';
}

function newRoomCode() {
  return Math.random().toString(36).slice(2, 8);
}

function gameUrl(game, room) {
  return `${game.url}?room=${encodeURIComponent(room)}&name=${encodeURIComponent(playerName())}`;
}

let games = [];
function updateLinks() {
  for (const a of document.querySelectorAll('[data-game]')) {
    const game = games.find((g) => g.id === a.dataset.game);
    if (game) a.href = gameUrl(game, newRoomCode());
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function gameCard(game) {
  const card = el('article', 'game');
  if (game.color) card.style.setProperty('--tone', game.color);
  const art = el('canvas', 'game-art');
  art.setAttribute('aria-hidden', 'true');
  card.appendChild(art);
  const body = el('div', 'game-body');
  body.append(el('h3', null, game.name), el('p', null, game.description));
  body.appendChild(el('span', 'meta', game.players > 1 ? `hasta ${game.players} panas` : 'tú contra la máquina'));
  const play = el('a', 'btn btn-play', '¡Jugar!');
  play.dataset.game = game.id;
  play.href = gameUrl(game, newRoomCode());
  play.addEventListener('click', () => { play.href = gameUrl(game, newRoomCode()); });
  body.appendChild(play);
  card.appendChild(body);
  // a game can ship card.js to draw live art on its tile
  if (game.card) {
    import(`${game.url}card.js`)
      .then((m) => m.mount(art))
      .catch(() => { /* no art, the color tile is enough */ });
  }
  return card;
}

function soonCard(s) {
  const card = el('article', 'game soon');
  const art = el('div', 'game-art', s.glyph);
  art.setAttribute('aria-hidden', 'true');
  card.appendChild(art);
  const body = el('div', 'game-body');
  body.append(el('span', 'badge', 'Próximamente'), el('h3', null, s.name), el('p', null, s.description));
  card.appendChild(body);
  return card;
}

async function loadGames() {
  try {
    ({ games } = await fetch('/api/games').then((r) => r.json()));
    gamesEl.innerHTML = '';
    for (const game of games) gamesEl.appendChild(gameCard(game));
    for (const s of SOON) gamesEl.appendChild(soonCard(s));
    if (games[0]) {
      featured.dataset.game = games[0].id;
      featured.href = gameUrl(games[0], newRoomCode());
    }
    statusEl.textContent = `${games.length} juego(s) disponibles`;
  } catch {
    statusEl.textContent = 'no se pudo hablar con el servidor';
  }
}

async function loadRooms() {
  try {
    const { rooms } = await fetch('/api/rooms').then((r) => r.json());
    const playing = rooms.reduce((n, r) => n + r.players, 0);
    document.getElementById('live-count').textContent = playing;
    document.getElementById('live').classList.toggle('on', playing > 0);
    roomsEl.innerHTML = '';
    if (rooms.length === 0) {
      roomsEl.appendChild(el('div', 'empty', 'Nadie jugando todavía. Arranca un juego y comparte el link.'));
      return;
    }
    for (const room of rooms) {
      const row = el('div', 'room');
      const info = el('div');
      info.append(el('div', null, `${room.game} · sala "${room.room}" (${room.players}/${room.max})`), el('div', 'names', room.names.join(', ')));
      const join = el('a', null, 'Unirse →');
      join.href = `/g/${room.game}/?room=${encodeURIComponent(room.room)}&name=${encodeURIComponent(playerName())}`;
      row.append(info, join);
      roomsEl.appendChild(row);
    }
  } catch { /* keep last state */ }
}

helloName.textContent = playerName();
loadGames();
loadRooms();
setInterval(loadRooms, 3000);
