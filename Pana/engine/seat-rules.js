// Table positions are separate from the room's stable member IDs.
export function swapSeats(players, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to ||
      from < 0 || to < 0 || from >= players.length || to >= players.length) return false;
  [players[from], players[to]] = [players[to], players[from]];
  players.forEach((player, seat) => { if ('seat' in player) player.seat = seat; });
  return true;
}
