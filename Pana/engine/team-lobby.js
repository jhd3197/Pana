// The lobby's team panels, the same in every team game. One call renders the
// room's seats as team panels (title, colour, count, Unirme aquí, Cambiarme
// aquí, Organizar) when the round is a team round, and as one list otherwise.
//
//   const lobby = createTeamLobby($('team-lobby'), { onMove: (from, to) => room.moveSeat(from, to) });
//   lobby.update({ teams: teamPlay(options), seats: players.map((player, key) => ({ key, team: key % 2, player })),
//     ownId, hostId, enabled, canArrange, members });
//
// The game owns the seats: `key` is what onMove receives, `team` is the panel a
// seat belongs to (0, 1, … ; Curiara has one per canoe). Titles and colours
// default to Equipo A / Equipo B in coral and teal; pass `titles` (an array or
// team => text) and `colors` for the game's own sides. Without teams the seats
// show as one panel titled `list.title`, or, with `list: null`, the container
// hides and the lobby shell's player cards show instead (engine/game-entry.js
// docks this container in the main lobby, never in "Más ajustes").
// Which team a newcomer joins is engine/play/team-balance.js (openSeat).
import { createLobbyRoster } from './lobby-roster.js';
import { loc } from './i18n.js';

export const TEAM_COLORS = ['var(--pk-coral)', 'var(--pk-teal)', 'var(--pk-yellow)', 'var(--pk-violet, #8e4de8)'];
export const teamTitle = team => [loc('Equipo A'), loc('Equipo B'), loc('Equipo C'), loc('Equipo D')][team] ?? loc('Equipo {n}', { n: team + 1 });

export function createTeamLobby(container, { onMove, titles = null, colors = TEAM_COLORS, list = null, detail = null } = {}) {
  container.dataset.panaTeamLobby = '';
  const roster = createLobbyRoster(container, { onMove, detail });
  const title = team => (typeof titles === 'function' ? titles(team) : titles?.[team]) ?? teamTitle(team);
  return {
    update({ teams = false, seats = [], ...options } = {}) {
      let groups;
      if (teams) {
        const ids = [...new Set(seats.map(s => s.team))].sort((a, b) => a - b);
        groups = ids.map(team => ({ id: team, title: title(team), color: colors[team % colors.length], seats: seats.filter(s => s.team === team).map(({ team: _, ...seat }) => seat) }));
      } else if (list) {
        groups = [{ id: 'all', title: list.title, color: list.color || 'var(--pk-game)', seats: seats.map(({ team: _, ...seat }) => seat) }];
      }
      // A hidden panel keeps no cards: the shell's own cards are the only ones then.
      container.hidden = !groups;
      roster.update(groups || [], groups ? options : {});
    },
    dispose: () => roster.dispose(),
  };
}
