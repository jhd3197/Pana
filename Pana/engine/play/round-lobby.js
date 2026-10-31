// The end of a match goes back to the lobby, never straight into a replay of
// the same map: the host picks the next map (or arena) in the shared picker,
// panas swap seats or change options, and the host starts from there. Seats,
// the host and the room options stay; what belongs to the finished match is
// cleared by the game's own `reset`.
//
//   toLobby() { return returnToLobby(this, { reset: g => { g.round = 0; } }); }
//
// LiveRoom rooms answer a host's `room.action('lobby')` with `game.toLobby()`
// (engine/live-room.js); other rooms send their own 'lobby' message to it.
// Pure: rules.js and server rooms import it by relative path.

// Moves `game` (with `phase` and `players`) from one of `from` to the lobby.
// Bots leave unless `keepBots` (a local practice whose start adds none).
export function returnToLobby(game, { from = ['finished'], keepBots = false, reset } = {}) {
  if (!game || !from.includes(game.phase)) return false;
  game.phase = 'lobby';
  if (!keepBots && Array.isArray(game.players)) game.players = game.players.filter(p => !p.bot);
  reset?.(game);
  return true;
}
