import { cachedPortrait } from './portrait-cache.js';
import { icon } from './icons.js';
const node = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text != null) el.textContent = text; return el; };

// Seat keys belong to the game, not DOM order or member IDs.
export function createLobbyRoster(container, { onMove }) {
  container.classList.add('pk-lobby-team-roster'); container.dataset.panaRoster = '';
  let groups = [], options = {}, selected = null, selectedPlayerId, signature = '', disposed = false;
  const portraits = new Map();
  function portrait(player) {
    const member = options.members?.find(m => m.id === player.id || m.seat === player.id);
    let avatar = player.avatar || member?.avatar || {};
    if (typeof avatar === 'string') { try { avatar = JSON.parse(avatar); } catch { avatar = {}; } }
    const key = JSON.stringify(avatar), img = node('img', 'pk-roster-portrait'); img.alt = '';
    const cached = cachedPortrait(avatar); if (cached) img.src = cached;
    else {
      img.hidden = true;
      const make = () => {
        if (disposed) return;
        if (!portraits.has(key)) portraits.set(key, import('./portrait.js').then(m => m.portrait(avatar)));
        portraits.get(key).then(src => { if (img.isConnected) { img.src = src; img.hidden = false; } }).catch(() => {});
      };
      if (window.PANA_PREPARED) make(); else document.addEventListener('pana:game-prepared', make, { once: true });
    }
    return img;
  }
  function button(text, action, key, disabled = false) {
    const el = node('button', 'pk-roster-action', text); el.type = 'button'; el.disabled = disabled;
    if (key != null) el.dataset.rosterMove = String(key);
    el.onclick = action; return el;
  }
  function render() {
    const active = container.contains(document.activeElement) ? document.activeElement : null;
    const focusMove = active?.dataset.rosterMove, focusSelect = active?.dataset.rosterSelect;
    const seats = groups.flatMap(g => g.seats), own = seats.find(s => s.player?.id != null && s.player.id === options.ownId);
    if (!options.enabled || !options.canArrange || !seats.some(s => s.key === selected && s.player)) selected = null;
    const source = selected ?? own?.key;
    const move = target => { if (!options.enabled || source == null || source === target) return; onMove(source, target); selected = null; render(); };
    container.replaceChildren(); container.style.setProperty('--roster-groups', Math.min(groups.length, 2));
    for (const group of groups) {
      const section = node('section', 'pk-roster-group'); section.dataset.rosterGroup = group.id;
      if (group.color) section.style.setProperty('--roster-color', group.color);
      const inGroup = group.seats.some(s => s.player?.id != null && s.player.id === options.ownId);
      const header = node('div', 'pk-roster-heading');
      header.append(node('h3', '', group.title), node('span', 'pk-roster-count', `${group.seats.filter(s => s.player?.id != null && !s.player.bot).length} / ${group.seats.length}`));
      if (inGroup && groups.length > 1) header.append(node('span', 'pk-roster-own', 'Tu equipo'));
      if (!inGroup && groups.length > 1 && own) {
        const target = group.seats.find(s => !s.player || s.player.id == null || s.player.bot) || group.seats[0];
        if (target) header.append(button('Cambiarme aquí', () => { if (options.enabled) onMove(own.key, target.key); }, null, !options.enabled));
      }
      section.append(header);
      const cards = node('div', 'pk-roster-cards'); cards.style.setProperty('--roster-seats', Math.min(group.seats.length, 3));
      for (const seat of group.seats) {
        const p = seat.player, occupied = p && (p.id != null || p.bot), mine = occupied && p.id != null && p.id === options.ownId;
        const card = node('article', `pk-roster-card${mine ? ' is-own' : ''}${selected === seat.key ? ' is-selected' : ''}${occupied ? '' : ' is-empty'}`);
        card.dataset.rosterSeat = String(seat.key);
        if (seat.label) card.append(node('span', 'pk-roster-status', seat.label));
        if (occupied) {
          if (p.id != null && p.id === options.hostId) card.append(node('span', 'pk-roster-host', 'Anfitrión'));
          const member = options.members?.find(m => m.id === p.id || m.seat === p.id);
          const status = p.bot ? 'CPU' : member && 'assetsReady' in member ? !member.assetsReady ? 'Cargando' : member.lobbyReady ? 'Listo' : 'Esperando' : 'En la sala';
          card.append(portrait(p), node('strong', 'pk-roster-name', `${p.name}${mine ? ' (tú)' : ''}`), node('span', 'pk-roster-status', status));
          if (!mine || selected != null) card.append(button(selected != null ? 'Mover aquí' : 'Cambiar', () => move(seat.key), seat.key, !options.enabled || source == null || source === seat.key));
          if (options.canArrange) {
            const pick = button(selected === seat.key ? 'Cancelar' : 'Organizar', () => { selected = selected === seat.key ? null : seat.key; selectedPlayerId = p.id; render(); }, null, !options.enabled);
            pick.dataset.rosterSelect = String(seat.key); pick.setAttribute('aria-pressed', String(selected === seat.key)); card.append(pick);
          }
        } else {
          card.append(icon('plus'), node('strong', 'pk-roster-name', 'Puesto libre'), button(selected != null ? 'Mover aquí' : 'Unirme aquí', () => move(seat.key), seat.key, !options.enabled || source == null));
        }
        cards.append(card);
      }
      section.append(cards); container.append(section);
    }
    if (focusMove != null) [...container.querySelectorAll('[data-roster-move]')].find(b => b.dataset.rosterMove === focusMove)?.focus({ preventScroll: true });
    else if (focusSelect != null) [...container.querySelectorAll('[data-roster-select]')].find(b => b.dataset.rosterSelect === focusSelect)?.focus({ preventScroll: true });
  }
  return {
    update(nextGroups, nextOptions = {}) {
      const next = JSON.stringify([nextGroups, nextOptions]);
      // Another player's self-swap must not silently change whom the host picked.
      if (selected != null && selectedPlayerId !== nextGroups.flatMap(g => g.seats).find(s => s.key === selected)?.player?.id) selected = null;
      groups = nextGroups; options = nextOptions;
      if (signature === next) return; signature = next; render();
    },
    dispose() { disposed = true; container.replaceChildren(); portraits.clear(); },
  };
}
