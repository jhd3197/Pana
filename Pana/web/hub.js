const gamesEl = document.getElementById('games');
const roomsEl = document.getElementById('rooms');
const statusEl = document.getElementById('status');
const nameInput = document.getElementById('name');

nameInput.value = localStorage.getItem('pana:name') || '';
nameInput.addEventListener('input', () => {
  localStorage.setItem('pana:name', nameInput.value.trim());
});

function playerName() {
  return nameInput.value.trim() || 'pana';
}

function newRoomCode() {
  return Math.random().toString(36).slice(2, 8);
}

function gameUrl(game, room) {
  return `${game.url}?room=${encodeURIComponent(room)}&name=${encodeURIComponent(playerName())}`;
}

async function loadGames() {
  try {
    const { games } = await fetch('/api/games').then((r) => r.json());
    gamesEl.innerHTML = '';
    for (const game of games) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3></h3>
        <p></p>
        <span class="meta">hasta ${game.players} panas</span>
        <a target="_blank" rel="noopener">Crear sala</a>
      `;
      card.querySelector('h3').textContent = game.name;
      card.querySelector('p').textContent = game.description;
      card.querySelector('a').href = gameUrl(game, newRoomCode());
      card.querySelector('a').addEventListener('click', (ev) => {
        ev.target.href = gameUrl(game, newRoomCode());
      });
      gamesEl.appendChild(card);
    }
    statusEl.textContent = `${games.length} juego(s) disponibles`;
  } catch {
    statusEl.textContent = 'no se pudo hablar con el servidor';
  }
}

async function loadRooms() {
  try {
    const { rooms } = await fetch('/api/rooms').then((r) => r.json());
    roomsEl.innerHTML = '';
    if (rooms.length === 0) {
      roomsEl.innerHTML = '<div class="empty">Nadie jugando todavía — crea una sala arriba.</div>';
      return;
    }
    for (const room of rooms) {
      const el = document.createElement('div');
      el.className = 'room';
      const info = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = `${room.game} · sala "${room.room}" (${room.players}/${room.max})`;
      const names = document.createElement('div');
      names.className = 'names';
      names.textContent = room.names.join(', ');
      info.append(title, names);
      const join = document.createElement('a');
      join.textContent = 'Unirse →';
      join.href = `/g/${room.game}/?room=${encodeURIComponent(room.room)}&name=${encodeURIComponent(playerName())}`;
      el.append(info, join);
      roomsEl.appendChild(el);
    }
  } catch { /* keep last state */ }
}

loadGames();
loadRooms();
setInterval(loadRooms, 3000);
