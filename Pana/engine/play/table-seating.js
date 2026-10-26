import { createLobbyRoster } from '../lobby-roster.js';
import { loc } from '../i18n.js';
// Alternating positions remain authoritative; the roster groups teammates.
export function createTableSeating(container, onSwap) {
  const roster = createLobbyRoster(container, { onMove: onSwap });
  return {
    update(players, { teams = false, enabled = false, canArrange = false, ownId = null, hostId = null, members = [] } = {}) {
      const seats = players.map((player, key) => ({ key, player }));
      const groups = teams ? [
        { id: 'a', title: loc('Equipo A'), color: 'var(--pk-coral)', seats: seats.filter(s => s.key % 2 === 0) },
        { id: 'b', title: 'Equipo B', color: 'var(--pk-teal)', seats: seats.filter(s => s.key % 2 === 1) },
      ] : [{ id: 'table', title: loc('Panas en la mesa'), color: 'var(--pk-game)', seats }];
      roster.update(groups, { enabled, canArrange, ownId, hostId, members });
    },
    dispose: () => roster.dispose(),
  };
}
