// Shared pre-game presentation for every game. Games retain
// every room action; game-entry owns membership, readiness and the start barrier.
import { ratingBadge } from './kit-rating.js';
import { loc } from './i18n.js';
export async function createSala({ root, original, status, footer, actionTray, change, readyButton }) {
  const config = original.panaSala;
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/engine/sala.css'; const styled = new Promise(resolve => { style.onload = style.onerror = resolve; }); document.head.append(style);
  root.classList.add('prototype-sala', 'pana-sala');
  root.dataset.customSala = String(Boolean(config));
  // Most games need only the layout. Keep their real controls and start labels.
  if (!config) {
    await styled;
    return { refresh() {}, signature: () => '', decorate() {} };
  }
  // `image: null` keeps the launcher art; games without a sala picture of their own pass it.
  const game = location.pathname.includes('/carreritas/') ? 'carreritas' : 'pepazo';
  const image = config.image === undefined ? `/images/sala/${game}.jpg` : config.image;
  if (image) root.style.setProperty('--lobby-image', `url('${image}')`);
  const startLabel = config.startLabel || (game === 'carreritas' ? loc('¡Arrancar!') : loc('¡A pepear!'));
  const settings = root.querySelector('.pk-game-lobby-settings');
  const summary = document.createElement('p'); summary.className = 'sala-summary'; settings.querySelector('h2').after(summary);
  const note = document.createElement('p'); note.className = 'sala-mirror-note'; settings.append(note);
  const connection = document.createElement('div'); connection.className = 'sala-connection'; connection.setAttribute('role', 'status');
  const message = document.createElement('span'), retry = document.createElement('button'); retry.type = 'button'; retry.textContent = loc('Reintentar'); retry.onclick = () => location.reload(); connection.append(message, retry); settings.append(connection);
  const armory = document.getElementById('open-armory'), kit = armory || document.createElement('button'); kit.type = 'button'; kit.className = 'pk-btn sala-kit'; kit.id ||= 'sala-kit'; kit.textContent = config.kitLabel;
  // Preserve the armory's existing handler when moving its real button.
  if (!armory) kit.onclick = config.openKit;
  footer.insertBefore(kit, actionTray); footer.insertBefore(change, kit);
  const teams = document.getElementById('team-roster');
  if (teams) { document.querySelector('#pana-room-dialog .pk-room-extras').prepend(teams); }
  const map = document.getElementById('map-choice');
  if (map) {
    const nav = document.createElement('div'); nav.className = 'sala-map';
    const name = document.createElement('b');
    const arrows = [-1, 1].map(delta => { const b = document.createElement('button'); b.type = 'button'; b.textContent = delta < 0 ? '‹' : '›'; b.setAttribute('aria-label', delta < 0 ? loc('Mapa anterior') : loc('Mapa siguiente')); b.onclick = () => { if (map.disabled) return; map.selectedIndex = (map.selectedIndex + delta + map.options.length) % map.options.length; map.dispatchEvent(new Event('change')); }; return b; });
    nav.append(arrows[0], name, arrows[1]); map.after(nav); map.classList.add('sala-native-map');
    const updateMap = () => { name.textContent = map.selectedOptions[0]?.textContent || ''; arrows.forEach(b => b.disabled = map.disabled); };
    new MutationObserver(updateMap).observe(map, { attributes: true }); map.addEventListener('change', updateMap); updateMap();
    document.addEventListener('pana:sala-update', updateMap);
  }
  root.addEventListener('click', event => { if(event.target.closest('#start') && config.read().connection === 'connecting') { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  let data = {};
  const read = () => config.read();
  const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  function refresh() {
    data = read(); const state = data.connection;
    setText(summary, data.summary);
    connection.dataset.state = state;
    setText(message, ({ online: loc('Sala abierta. Tus panas pueden entrar con el código.'), local: loc('En local. Puedes abrir una sala para invitar panas.'), connecting: loc('Conectando con tus panas…'), offline: loc('Sin conexión. Puedes jugar en local.') })[state]);
    retry.hidden = state !== 'offline';
    const mirror = document.getElementById('mirror'); setText(note, mirror?.disabled ? loc('Gana un trofeo en una copa para desbloquear el espejo.') : ''); note.hidden = !note.textContent;
    const start = document.getElementById('start');
    if (state === 'offline' || state === 'local') { const label = startLabel; if (start.textContent !== label + loc(' en local')) { const suffix = document.createElement('small'); suffix.textContent = loc(' en local'); start.replaceChildren(document.createTextNode(label), suffix); } }
    else if (state === 'connecting') setText(start, loc('Conectando…'));
    else if (!start.disabled) setText(start, startLabel);
    const personal = document.getElementById('pana-lobby-roster')?.querySelector('.is-own');
    if (personal) personal.setAttribute('aria-pressed', readyButton.getAttribute('aria-pressed') || 'true');
    // Team arrangement is a room setting; all eight pana cards keep their place.
    if (teams) document.getElementById('pana-room-more').dataset.teams = String(!teams.hidden);
  }
  await styled;
  return {
    refresh,
    signature: () => JSON.stringify(read().players) + JSON.stringify(read().local),
    decorate(card, player, mine) {
      const state = read(); const meta = state.players?.find(p => p.id === player.id) || (mine ? state.local : null);
      if (!meta?.kit) return;
      card.style.setProperty('--pana-color', meta.color || '#ffc629');
      const kitLine = document.createElement('span'); kitLine.className = 'sala-player-kit'; kitLine.textContent = meta.kit;
      kitLine.insertAdjacentHTML('beforeend', ratingBadge(meta.level));
      if (meta.team) { const team = document.createElement('small'); team.textContent = meta.team; kitLine.append(team); }
      card.querySelector('.pk-game-lobby-state').before(kitLine);
    },
  };
}
