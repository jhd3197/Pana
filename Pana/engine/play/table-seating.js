import { createTeamLobby } from '../team-lobby.js';
import { loc } from '../i18n.js';
// Table games: alternating positions remain authoritative (team = seat % 2),
// so the team lobby groups partners; without teams, one panel of the table.
export function createTableSeating(container, onSwap) {
  const lobby = createTeamLobby(container, { onMove: onSwap, list: { title: loc('Panas en la mesa') } });
  return {
    update(players, { teams = false, enabled = false, canArrange = false, ownId = null, hostId = null, members = [] } = {}) {
      lobby.update({ teams, seats: players.map((player, key) => ({ key, team: key % 2, player })), enabled, canArrange, ownId, hostId, members });
    },
    dispose: () => lobby.dispose(),
  };
}
