// Pepazo's capture the flag ("Captura la bandera"): two teams, a flag at each
// base. Touch the rival flag to lift it, carry it to your own stand to score,
// and only while your own flag is home. The flag primitives are the engine's
// (engine/play/objectives.js); this file holds Pepazo's stands, its round
// start and end, the feed lines and what bots chase. rules.js calls it; it
// never imports rules.js, so the server and practice share one copy.
import { createFlag, stepFlags, dropCarried, carriedBy, flagHome, reachedLimit, decideWinner, flagTieBreaks } from '../../../engine/play/objectives.js';
import { locKey } from '../../../engine/i18n.js';

export const isCtf = options => options?.mode === 'ctf';
// Team 0 (orange) defends the first stand, team 1 (turquoise) the second. Each
// sits a few metres in front of its team's spawns (rules.js spawnsFor: even
// spawns are team 0's), clear of cover in all three layouts of the map.
// tests/ctf.test.js checks every map: both stands open, reachable, far apart.
export const FLAG_STANDS = {
  terminal: [{ x: -48.5, z: 0 }, { x: 48.5, z: 0 }],
  plaza: [{ x: 0, z: -18 }, { x: 0, z: 18 }],
  puerto: [{ x: 0, z: -19 }, { x: 0, z: 19 }],
  hato: [{ x: 0, z: -19 }, { x: 0, z: 19 }],
  ruinas: [{ x: 1, z: -18.5 }, { x: -1, z: 18.5 }],
  muelle: [{ x: -1, z: -25 }, { x: 1, z: 24.5 }],
  noche: [{ x: 0, z: -19 }, { x: 0, z: 19 }],
};
export const standsFor = id => FLAG_STANDS[id] || FLAG_STANDS.plaza;
// Touch, capture and auto-return (s) for Pepazo's flags.
export const CTF_RULES = Object.freeze({ pickup: 1.5, capture: 2.2, returnAfter: 30 });
// A flag carrier walks and runs 15% slower, so defenders can catch a runner.
// rules.js applies it to every pana's walk, bots included.
export const FLAG_CARRIER_SLOW = .85;
export const carrierSlow = (game, p) => (game.flags?.length && carriedBy(game.flags, p.id) ? FLAG_CARRIER_SLOW : 1);

// Fresh flags at both stands: every round start and every return to the lobby.
export function ctfReset(game) {
  game.flags = isCtf(game.options) ? standsFor(game.mapId).map((stand, team) => createFlag(team, stand)) : [];
  game.flagEvents = []; game.flagSerial = game.flagSerial || 0;
}
const actorsOf = game => game.players.map(p => ({ id: p.id, team: p.team, x: p.x, z: p.z, alive: p.connected && !p.eliminated && !p.respawn }));
const LINES = {
  pickup: locKey('{name} tomó la bandera {flag}.'),
  drop: locKey('{name} soltó la bandera {flag}.'),
  return: locKey('{name} devolvió la bandera {flag}.'),
  auto: locKey('La bandera {flag} volvió a su base.'),
  capture: locKey('{name} capturó la bandera {flag}.'),
};
export const flagName = team => team ? locKey('turquesa') : locKey('naranja');
// Events go to the room view (clients play sounds and markers from them), the
// scores and the feed line.
function record(game, events) {
  for (const e of events) {
    const p = game.players.find(q => q.id === e.actor);
    if (e.type === 'capture') { game.teamScores[e.team]++; if (p) { p.score += 3; p.captures = (p.captures || 0) + 1; } }
    if (e.type === 'return' && p) p.returns = (p.returns || 0) + 1;
    if (e.type === 'pickup' && p) p.shield = 0;
    game.flagEvents = [...(game.flagEvents || []), { ...e, n: ++game.flagSerial }].slice(-8);
    game.say(e.auto ? LINES.auto : LINES[e.type], { name: p?.name || '', flag: flagName(e.type === 'capture' ? e.flag : e.team) });
  }
}
// One tick of the flags (after movement and paint).
export function ctfStep(game, dt) { record(game, stepFlags(game.flags, actorsOf(game), dt, CTF_RULES)); }
// A carrier painted out, disconnected or gone: the flag falls where they stood.
export function ctfDrop(game, p) { const e = dropCarried(game.flags, p); if (e) record(game, [e]); }
export const goalOf = game => game.options.flagGoal || 3;
// null while the round runs; else { winner: team or null (draw), reason }.
export function ctfOutcome(game) {
  const limit = reachedLimit(game.teamScores, goalOf(game));
  if (limit !== null) return { winner: limit, reason: 'limit' };
  if (game.time > 0) return null;
  return { winner: decideWinner(game.teamScores, flagTieBreaks(game.flags)), reason: 'time' };
}

// Bots: each team's bots split into roles by their order (attack, defend, attack,
// escort, …) and the flags override the role: a carrier runs home, a dropped own
// flag pulls the nearest bot (and every defender) to return it, a rival carrier
// is chased by defenders and the nearest bot, a team mate's carrier is escorted.
// Returns { x, z, near } — walk there; inside `near` m the bot fights as usual.
const ROLES = ['attack', 'defend', 'attack', 'escort'];
export function ctfGoal(game, p) {
  const flags = game.flags; if (flags.length < 2) return null;
  const own = flags[p.team], rival = flags[1 - p.team], mine = carriedBy(flags, p.id);
  if (mine) return { x: own.homeX, z: own.homeZ, near: 0 };
  const team = game.players.filter(q => q.bot && q.team === p.team && q.connected).sort((a, b) => a.id - b.id);
  const role = ROLES[Math.max(0, team.indexOf(p)) % ROLES.length];
  const nearest = (x, z) => game.players.filter(q => q.team === p.team && q.connected && !q.respawn && !q.eliminated && !carriedBy(flags, q.id))
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]?.id === p.id;
  if (own.state === 'dropped' && (role === 'defend' || nearest(own.x, own.z))) return { x: own.x, z: own.z, near: 0 };
  if (own.state === 'carried' && (role === 'defend' || nearest(own.x, own.z))) return { x: own.x, z: own.z, near: 4 };
  const friend = rival.state === 'carried' && game.players.find(q => q.id === rival.carrier);
  if (friend && role !== 'defend') return { x: friend.x, z: friend.z, near: 5 };
  if (role === 'defend') return { x: own.homeX, z: own.homeZ, near: 7 };
  return { x: rival.x, z: rival.z, near: 0 };
}
export { flagHome };
