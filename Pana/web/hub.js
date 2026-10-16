import { createGameMenu } from '/engine/ui.js';

const gamesEl = document.getElementById('games');
const roomsEl = document.getElementById('rooms');
const statusEl = document.getElementById('status');
const nameInput = document.getElementById('name');
const featured = document.getElementById('play-featured');
const featureEl = document.getElementById('feature');
const featureArt = document.getElementById('feature-art');

// The same settings every game reads (sound, volume, resolution, hints).
const settings = createGameMenu({ title: 'Pana', pause: false, hotkey: false });
const gear = settings.createButton({ id: 'open-settings', label: '⚙︎', kbd: null, className: 'pk-btn icon-btn' });
gear.setAttribute('aria-label', 'Ajustes');
gear.title = 'Ajustes';
document.getElementById('hub-actions').append(gear);

// ---------- views: #jugar (default), #mi-pana, #salas ----------
// The one pana canvas moves between the "Tu pana" card and the creator.
const stage = document.getElementById('pana-stage');
function showView() {
  const view = { '#mi-pana': 'mi-pana', '#salas': 'salas' }[location.hash] || 'jugar';
  document.body.dataset.view = view;
  for (const a of document.querySelectorAll('.nav [data-view]')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.getElementById(view === 'mi-pana' ? 'creator-slot' : 'tu-pana-slot').append(stage);
  scrollTo(0, 0);
}
addEventListener('hashchange', showView);
showView();

// ---------- name ----------
try { nameInput.value = localStorage.getItem('pana:name') || ''; } catch { /* storage off */ }
function syncName() {
  for (const e of document.querySelectorAll('[data-name]')) e.textContent = playerName();
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
let feat = null;
function updateLinks() {
  for (const a of document.querySelectorAll('a[data-game]')) {
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

const meta = (game) => game.players > 1 ? `hasta ${game.players} panas` : 'tú vs la máquina';
const shortName = (game) => game.name.split(' · ')[0];

// a game can ship card.js to draw live art on its tile
function mountArt(game, canvas) {
  if (!game.card) return;
  import(`${game.url}card.js`)
    .then((m) => { if (!canvas.isConnected) return; m.mount(canvas); canvas.dataset.live = ''; })
    .catch(() => { /* no art, the color tile is enough */ });
}

// The card is a plain block with a real heading (tests and screen readers
// find games by it); a stretched button on top handles the pick.
function gameCard(game) {
  const card = el('article', 'game');
  card.dataset.id = game.id;
  if (game.color) card.style.setProperty('--tone', game.color);
  const art = el('canvas', 'game-art');
  art.setAttribute('aria-hidden', 'true');
  const name = el('h3', 'game-name', shortName(game));
  name.setAttribute('aria-label', game.name);
  const body = el('div', 'game-body');
  body.append(name, el('span', 'game-meta', meta(game)));
  const pick = el('button', 'game-pick');
  pick.type = 'button';
  pick.setAttribute('aria-pressed', 'false');
  pick.setAttribute('aria-label', `${game.name}: ${meta(game)}`);
  pick.addEventListener('click', () => {
    feature(game);
    if (matchMedia('(max-width: 760px)').matches) featureEl.scrollIntoView({ behavior: 'smooth' });
  });
  card.append(art, body, pick);
  mountArt(game, art);
  return card;
}

// The hero shows one game at a time. card.js never unmounts, so the old
// hero canvas loses its WebGL context instead of piling up live ones.
function feature(game) {
  if (feat === game) return;
  feat = game;
  try { localStorage.setItem('pana:featured', game.id); } catch { /* storage off */ }
  featureEl.style.setProperty('--tone', game.color || 'var(--pk-coral)');
  document.getElementById('feature-tag').textContent = `Destacado · ${meta(game)}`;
  document.getElementById('feature-name').textContent = game.name;
  document.getElementById('feature-copy').textContent = game.description;
  featured.dataset.game = game.id;
  featured.href = gameUrl(game, newRoomCode());
  for (const c of gamesEl.children) c.querySelector('.game-pick').setAttribute('aria-pressed', String(c.dataset.id === game.id));

  for (const old of featureArt.querySelectorAll('canvas')) {
    if ('live' in old.dataset) old.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    old.remove();
  }
  const art = el('canvas');
  art.setAttribute('aria-hidden', 'true');
  featureArt.append(art);
  mountArt(game, art);
}

featured.addEventListener('click', () => { if (feat) featured.href = gameUrl(feat, newRoomCode()); });

// "Crear sala": a fresh room, its invite link on the clipboard, then go.
document.getElementById('create-room').addEventListener('click', async (e) => {
  if (!feat) return;
  const room = newRoomCode();
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(`${location.origin}${feat.url}?room=${room}`);
    btn.textContent = '¡Link copiado!';
  } catch { /* no clipboard, the game can still invite */ }
  setTimeout(() => { location.href = gameUrl(feat, room); }, 350);
});

async function loadGames() {
  try {
    ({ games } = await fetch('/api/games').then((r) => r.json()));
    gamesEl.innerHTML = '';
    for (const game of games) gamesEl.appendChild(gameCard(game));
    let saved = null;
    try { saved = localStorage.getItem('pana:featured'); } catch { /* storage off */ }
    const first = games.find((g) => g.id === saved) || games.find((g) => g.id === 'derrape') || games[0];
    if (first) feature(first);
    statusEl.textContent = `${games.length} juegos disponibles`;
    loadRooms();
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
    document.getElementById('rooms-count').textContent = rooms.length;
    roomsEl.innerHTML = '';
    if (rooms.length === 0) {
      roomsEl.appendChild(el('div', 'empty', 'Nadie jugando todavía. Arranca un juego y comparte el link.'));
      return;
    }
    for (const room of rooms) {
      const game = games.find((g) => g.id === room.game);
      const row = el('div', 'room');
      const bar = el('i', 'room-tone');
      if (game?.color) bar.style.background = game.color;
      const info = el('div', 'room-info');
      info.append(el('b', null, `${game ? shortName(game) : room.game} · ${room.players}/${room.max}`), el('span', 'names', room.names.join(', ')));
      const join = el('a', null, 'Unirse →');
      join.href = `/g/${room.game}/?room=${encodeURIComponent(room.room)}&name=${encodeURIComponent(playerName())}`;
      join.setAttribute('aria-label', `Unirse a la sala ${room.room} de ${game?.name || room.game}`);
      row.append(bar, info, join);
      roomsEl.appendChild(row);
    }
  } catch { /* keep last state */ }
}

syncName();
loadGames();
setInterval(loadRooms, 3000);
