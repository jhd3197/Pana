// Team balance on join: pure, no DOM, safe in rules.js and on the server
// (import it by relative path from code a room loads).
//
//   smallestTeam([2, 1])          // 1
//   smallestTeam([1, 1], 1)       // 1: a tie keeps the game's own pick
//   openSeat(players, { teamOf: seat => seat % 2 })  // seat index for a newcomer
//
// A game keeps its own seat model; this only says which team a newcomer joins.
// Players still move afterwards (Unirme aquí, Cambiarme aquí, Organizar).

// The team with the fewest players. On a tie, `prefer` wins when it is one of
// the tied teams (the game's previous rule); otherwise the lowest index.
// Teams counted as Infinity (full, closed) are never picked unless all are.
export function smallestTeam(counts, prefer = null) {
  if (!counts?.length) return null;
  const least = Math.min(...counts);
  if (prefer != null && counts[prefer] === least) return prefer;
  return counts.indexOf(least);
}

// How many seated players each team has. `teamOf(seat)` names a seat's team.
export function teamCounts(players, teamOf, teams = 2, counts = p => p?.id != null && !p.bot) {
  const out = Array(teams).fill(0);
  players.forEach((p, seat) => { const t = teamOf(seat, p); if (counts(p) && t >= 0 && t < teams) out[t]++; });
  return out;
}

// The seat a newcomer takes: the first free seat of the smallest team that
// still has one. Ties keep the old rule (the first free seat overall), so a
// table that fills in seat order behaves exactly as before.
// `free(p, seat)` says which seats can be taken (bot or empty by default).
// Returns -1 when no seat is free.
export function openSeat(players, { teamOf = null, teams = 2, free = p => p?.id == null || !!p.bot, counts } = {}) {
  const open = players.map((p, seat) => free(p, seat) ? seat : -1).filter(seat => seat >= 0);
  if (!open.length) return -1;
  if (!teamOf) return open[0];
  const sizes = teamCounts(players, teamOf, teams, counts).map((n, t) => open.some(seat => teamOf(seat, players[seat]) === t) ? n : Infinity);
  const team = smallestTeam(sizes, teamOf(open[0], players[open[0]]));
  return open.find(seat => teamOf(seat, players[seat]) === team) ?? open[0];
}

// Whether `p` is on `me`'s side in a team round (never `me` itself, never without teams).
export const isTeammate = (me, p, teams) => !!teams && !!me && !!p && p.id !== me.id && p.team === me.team;
