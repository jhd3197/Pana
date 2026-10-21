import { createGameMenu } from '/engine/ui.js';
import { inviteUrl, newRoomCode, playUrl } from '/engine/invite.js';
import { isOnline, meta, gameUrl as linkFor } from './games.js';
import { icon } from '/engine/icons.js';
import { loadAvatar } from '/engine/avatar.js';
import { cachedPortrait } from '/engine/portrait-cache.js';
import { categories, category, artUrl } from './launcher-art.js';
import { padControls } from '/engine/gamepad.js';

const gamesEl = document.getElementById('games');
const roomsEl = document.getElementById('rooms');
const statusEl = document.getElementById('status');
const nameInput = document.getElementById('name');
const featured = document.getElementById('play-featured');
const featureEl = document.getElementById('feature');
const featureArt = document.getElementById('feature-art');
const savedFace = cachedPortrait(loadAvatar());
if (savedFace) document.getElementById('pana-face').src = savedFace;

// The same settings every game reads (sound, volume, resolution, hints).
const settings = createGameMenu({ title: 'Pana', pause: false, hotkey: false });
const gear = settings.createButton({ id: 'open-settings', label: '', kbd: null, className: 'pk-btn icon-btn' });
gear.prepend(icon('gear'));
gear.setAttribute('aria-label', 'Ajustes');
gear.title = 'Ajustes';
document.getElementById('hub-actions').append(gear);
// A controller works the whole hub like a menu: the stick or d-pad moves
// between games and buttons, A presses, the menu button (☰) opens Ajustes
// (engine/gamepad.js).
padControls({ playing: () => false, menu: () => settings.open() });

// The shared lobby song plays on the hub too. Its modules and the song itself
// load once the page has, so the first tap or key (browsers keep audio locked
// until one) starts it at once; where autoplay is allowed it starts on its own.
let hubMusic = null, hubPlaying = false, heard = false;
function hubSong() {
  if (hubPlaying || !hubMusic) return;
  const { sound, music } = hubMusic;
  sound.unlock();
  if (sound.ctx.state !== 'running' && !heard) return;
  hubPlaying = true;
  music.play('lobby', { fallback: false });
}
function loadHubSong() {
  Promise.all([import('/engine/fx.js'), import('/engine/music.js'), import('/engine/settings.js')])
    .then(([{ sound }, { createMusic }, { bindSound }]) => {
      bindSound(sound);
      sound.unlock();
      hubMusic = { sound, music: createMusic(sound) };
      hubMusic.music.preload('lobby');
      hubSong();
    })
    .catch(() => { /* music is a nicety: the hub works without it */ });
}
if (document.readyState === 'complete') loadHubSong();
else addEventListener('load', loadHubSong, { once: true });
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { heard = true; hubSong(); }, { capture: true });

// ---------- views: #jugar (default), #mi-pana, #salas ----------
// The one pana canvas moves between the "Tu pana" card and the creator.
const stage = document.getElementById('pana-stage');
let creatorLoading;
function loadCreator() {
  if (creatorLoading) return;
  const loading = document.getElementById('pana-loading');
  stage.setAttribute('aria-busy', 'true');
  const portrait = cachedPortrait(loadAvatar());
  if (portrait) { const img = document.getElementById('pana-loading-portrait'); img.src = portrait; img.hidden = false; }
  creatorLoading = (async () => {
    // Paint the loading state before cached modules can start building the model.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const module = await import('./pana.js');
    await module.sceneReady;
    loading.hidden = true;
    stage.setAttribute('aria-busy', 'false');
    document.querySelector('.customizer').inert = false;
    document.getElementById('pana-random').disabled = false;
  })().catch(() => {
    document.getElementById('pana-loading-copy').textContent = 'No pudimos preparar tu pana. Intenta otra vez.';
    loading.querySelector('progress').hidden = true;
    const retry = document.getElementById('pana-loading-retry'); retry.hidden = false; retry.onclick = () => location.reload();
    stage.setAttribute('aria-busy', 'false');
  });
}
function showView() {
  if (location.hash === "#mi-pana") { location.replace("/personaje"); return; }
  const view = { '#mi-pana': 'mi-pana', '#salas': 'salas' }[location.hash] || 'jugar';
  document.body.dataset.view = view;
  for (const a of document.querySelectorAll('.nav [data-view]')) {
    if (a.dataset.view === view) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.getElementById(view === 'mi-pana' ? 'creator-slot' : 'tu-pana-slot').append(stage);
  if (view === 'mi-pana') loadCreator();
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

function gameUrl(game, room) {
  return linkFor(game, room, playerName());
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

const shortName = (game) => game.name.split(' · ')[0];
// The small card can carry its own short name (game.json tileName, e.g. QQSMP);
// the banner keeps the full one.
const tileName = (game) => game.tileName || shortName(game);

// a game can ship card.js to draw live art on its tile
function mountArt(game, canvas) {
  if (!game.card) return;
  import(`${game.url}card.js`)
    .then((m) => { if (!canvas.isConnected) return; m.mount(canvas); canvas.dataset.live = ''; })
    .catch(() => { /* no art, the color tile is enough */ });
}

// Tiles load their card.js (a module and a WebGL scene) only when they scroll
// near the screen; most of the grid starts below the fold on a phone.
const waiting = new WeakMap();
const artObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      artObserver.unobserve(entry.target);
      mountArt(waiting.get(entry.target), entry.target);
    }
  }, { rootMargin: '200px' })
  : null;
function lazyArt(game, canvas) {
  if (!game.card) return;
  if (!artObserver) return mountArt(game, canvas);
  waiting.set(canvas, game);
  artObserver.observe(canvas);
}

// The card is a plain block with a real heading (tests and screen readers
// find games by it); a stretched button on top handles the pick.
function gameCard(game) {
  const card = el('article', 'game');
  card.dataset.id = game.id;
  if (game.color) card.style.setProperty('--tone', game.color);
  const url = artUrl(game, true);
  const art = el(url ? 'img' : 'canvas', 'game-art');
  if (url) { art.src = url; art.alt = ''; art.loading = 'lazy'; art.decoding = 'async'; }
  art.setAttribute('aria-hidden', 'true');
  const name = el('h3', 'game-name', tileName(game));
  name.setAttribute('aria-label', game.name);
  const body = el('div', 'game-body');
  body.append(name, el('span', 'game-meta', meta(game)));
  const pick = el('button', 'game-pick');
  pick.type = 'button';
  pick.setAttribute('aria-pressed', 'false');
  pick.setAttribute('aria-label', `${game.name}: ${meta(game)}`);
  // A controller or the keyboard moving onto a card shows it in the banner,
  // so pressing it then plays; a tap or click only shows it.
  const stepped = () => pick.classList.contains('pana-pad-focus') || pick.matches(':focus-visible');
  pick.addEventListener('focus', () => { if (stepped()) { feature(game); showRow(card); } });
  pick.addEventListener('click', () => {
    if (feat === game && stepped()) { launch(game, gameUrl(game, newRoomCode())); return; }
    feature(game);
    if (matchMedia('(max-width: 760px)').matches) featureEl.scrollIntoView({ behavior: 'smooth' });
  });
  card.append(art, body, pick);
  if (!url) lazyArt(game, art);
  return card;
}

// The hero shows one game at a time. card.js never unmounts, so the old
// hero canvas loses its WebGL context instead of piling up live ones.
function feature(game) {
  if (feat === game) return;
  feat = game;
  try { localStorage.setItem('pana:featured', game.id); } catch { /* storage off */ }
  featureEl.style.setProperty('--tone', game.color || 'var(--pk-coral)');
  document.getElementById('feature-tag').textContent = category(game);
  document.getElementById('feature-name').textContent = shortName(game);
  document.getElementById('feature-copy').textContent = game.description;
  document.getElementById('feature-players').textContent = meta(game);
  document.getElementById('feature-mode').textContent = isOnline(game) ? 'En línea · Práctica' : 'Individual';
  featured.dataset.game = game.id;
  featured.dataset.online = String(isOnline(game));
  featured.href = gameUrl(game, newRoomCode());
  document.getElementById('create-room').hidden = !isOnline(game);
  document.getElementById('join-code').hidden = !isOnline(game);
  document.dispatchEvent(new CustomEvent('pana:featured', { detail: { game: game.id } }));
  for (const c of gamesEl.querySelectorAll('.game')) c.querySelector('.game-pick').setAttribute('aria-pressed', String(c.dataset.id === game.id));

  for (const old of featureArt.querySelectorAll('canvas')) {
    if ('live' in old.dataset) old.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    old.remove();
  }
  featureArt.replaceChildren();
  const url = artUrl(game);
  const art = el(url ? 'img' : 'canvas');
  art.setAttribute('aria-hidden', 'true');
  if (url) { art.src = url; art.alt = ''; art.fetchPriority = 'high'; }
  featureArt.append(art);
  if (!url) mountArt(game, art);
}

// On a desktop the rows scroll under the banner: the row in focus moves to
// the top of that strip, like a TV app.
function showRow(card) {
  const wrap = gamesEl.parentElement, row = card.closest('.game-row');
  if (!row || getComputedStyle(wrap).overflowY !== 'auto') return;
  requestAnimationFrame(() => wrap.scrollTo({ top: wrap.scrollTop + row.getBoundingClientRect().top - wrap.getBoundingClientRect().top, behavior: 'smooth' }));
}

// One row per category, plus the games played last on top.
function gameRow(label, list) {
  const row = el('section', 'game-row');
  row.dataset.row = label;
  const title = el('h3', 'game-row-title', label);
  title.append(el('span', 'game-row-count', String(list.length)));
  const head = el('div', 'game-row-head');
  const rail = el('div', 'games');
  for (const game of list) { const card = gameCard(game); card.dataset.category = category(game); rail.append(card); }
  head.append(title);
  // Arrows instead of a scrollbar, only on a row with more games than fit;
  // the keyboard and a controller step card by card instead.
  const arrows = [-1, 1].map(step => {
    const arrow = el('button', 'rail-arrow', step < 0 ? '←' : '→');
    arrow.type = 'button'; arrow.tabIndex = -1; arrow.dataset.padSkip = '';
    arrow.setAttribute('aria-label', `${step < 0 ? 'Anteriores' : 'Más juegos'}: ${label}`);
    arrow.addEventListener('click', () => rail.scrollBy({ left: step * rail.clientWidth * .8, behavior: 'smooth' }));
    head.append(arrow);
    return arrow;
  });
  const fit = () => {
    const room = rail.scrollWidth - rail.clientWidth;
    row.toggleAttribute('data-overflow', room > 2);
    arrows[0].disabled = rail.scrollLeft <= 2;
    arrows[1].disabled = rail.scrollLeft >= room - 2;
  };
  rail.addEventListener('scroll', fit, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(rail);
  requestAnimationFrame(fit);
  row.append(head, rail);
  return row;
}
function recentGames() {
  try { return JSON.parse(localStorage.getItem('pana:recent')) || []; } catch { return []; }
}

// Hosting sites can cancel this event to apply their party/account rules.
// The account-free launcher works unchanged without an integration.
function launch(game, url, source = 'play') {
  const event = new CustomEvent('pana:launch', { cancelable: true, detail: { game: game.id, url, source } });
  if (!document.dispatchEvent(event)) return;
  try { localStorage.setItem('pana:recent', JSON.stringify([game.id, ...recentGames().filter(id => id !== game.id)].slice(0, 8))); } catch { /* storage off */ }
  location.href = url;
}
featured.addEventListener('click', e => {
  e.preventDefault();
  if (feat) launch(feat, gameUrl(feat, newRoomCode()));
});

// A private room previews the invite link before entering.
document.getElementById('create-room').addEventListener('click', () => {
  if (!feat || !isOnline(feat)) return;
  const dialog = document.getElementById('room-dialog');
  const room = newRoomCode();
  document.getElementById('room-title').textContent = `Sala de ${shortName(feat)}`;
  document.getElementById('room-link').value = inviteUrl(room, feat.url);
  document.getElementById('room-copy').textContent = 'Copiar link';
  document.getElementById('room-enter').onclick = () => launch(feat, gameUrl(feat, room), 'private');
  dialog.showModal();
});

document.getElementById('room-copy').addEventListener('click', async e => {
  const button = e.currentTarget;
  try { await navigator.clipboard.writeText(document.getElementById('room-link').value); button.textContent = 'Link copiado'; }
  catch { document.getElementById('room-link').select(); }
});
document.getElementById('join-code').addEventListener('click', () => document.getElementById('code-dialog').showModal());
document.getElementById('code-form').addEventListener('submit', e => {
  e.preventDefault();
  const code = document.getElementById('room-code').value.trim();
  if (feat && /^[a-z0-9-]{1,24}$/i.test(code)) launch(feat, gameUrl(feat, code), 'join');
});
for (const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => button.closest('dialog').close());

async function loadGames() {
  try {
    ({ games } = await fetch('/api/games').then((r) => r.json()));
    gamesEl.innerHTML = '';
    const order = ['derrape', 'galope', 'curiara', 'domino', 'ludo', 'caida', 'poquer', 'billar', 'criollas', 'bululu', 'cocina', 'escondidas', 'pintura', 'embuste', 'reliquia'];
    // Unlisted (new) games go after the curated order, not before it.
    const rank = (g) => { const i = order.indexOf(g.id); return i < 0 ? order.length : i; };
    games.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const recent = recentGames().map(id => games.find(g => g.id === id)).filter(Boolean);
    if (recent.length) gamesEl.append(gameRow('Seguir jugando', recent));
    for (const label of categories.filter(c => c !== 'Todos')) {
      const list = games.filter(g => category(g) === label);
      if (list.length) gamesEl.append(gameRow(label, list));
    }
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
      join.href = playUrl(`/g/${room.game}/`, room.room, playerName());
      join.addEventListener('click', e => { e.preventDefault(); if (game) launch(game, join.href, 'join'); });
      join.setAttribute('aria-label', `Unirse a la sala ${room.room} de ${game?.name || room.game}`);
      row.append(bar, info, join);
      roomsEl.appendChild(row);
    }
  } catch { /* keep last state */ }
}

syncName();
loadGames();
// Live rooms refresh every 3 s while the hub is visible, and at once on return.
setInterval(() => { if (!document.hidden) loadRooms(); }, 3000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadRooms(); });
