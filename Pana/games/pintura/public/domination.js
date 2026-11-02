// Pepazo's domination ("Dominación"): two teams fight over three zones, A on
// orange's side, B in the middle, C on turquoise's side. Stand in a zone alone to
// turn it (a rival's zone is neutralised first); both teams inside freeze it. Every
// zone a team owns earns a point a second; first to the score limit wins, or the
// higher score when the clock runs out (a tie goes to the team holding more zones,
// else a draw). The zone primitives are the engine's (engine/play/objectives.js);
// this file holds Pepazo's zone table, the round start and end, feed lines and
// what bots go for. rules.js calls it; it never imports rules.js, so the server
// room and practice share one copy.
import { createZone, stepZones, zoneOccupants, zonePoints, zonesHeld, zoneTieBreaks, decideWinner } from '../../../engine/play/objectives.js';
import { locKey } from '../../../engine/i18n.js';

export const isDom = options => options?.mode === 'dom';
// Zone size and timing: a 3.5 m ring, 7 s for one pana to turn a neutral zone
// (twice that from a rival's), one point per owned zone per second.
export const DOM_RULES = Object.freeze({ radius: 3.5, captureTime: 7, perSecond: 1 });
export const ZONE_IDS = ['A', 'B', 'C'];
// A sits on team 0's half (ctf.js stands: orange's base), C on team 1's, B in
// the middle. Chosen clear of cover in all three layouts of each map and away from
// the spawns; tests/domination.test.js checks reach, spacing and overlap on every map.
export const DOM_ZONES = {
  terminal: [{ x: -34, z: 0 }, { x: 0, z: 0 }, { x: 34, z: 0 }],
  plaza: [{ x: -14, z: -12 }, { x: 5, z: -2 }, { x: 14, z: 12 }],
  puerto: [{ x: 4.5, z: -11 }, { x: -9, z: 3 }, { x: 2.5, z: 11 }],
  hato: [{ x: -3, z: -10.5 }, { x: 9.5, z: -4 }, { x: -6.5, z: 10.5 }],
  ruinas: [{ x: 12.5, z: -18 }, { x: 7, z: -3 }, { x: 1.5, z: 12 }],
  muelle: [{ x: 6.5, z: -13 }, { x: -.5, z: -2 }, { x: .5, z: 11 }],
  noche: [{ x: 8, z: -10.5 }, { x: -5, z: .5 }, { x: 9.5, z: 9.5 }],
};
export const zonesFor = id => DOM_ZONES[id] || DOM_ZONES.plaza;
export const domGoal = options => options?.domGoal || 200;

// Fresh neutral zones and an empty point bank: every round start and every return to the lobby.
export function domReset(game) {
  game.zones = isDom(game.options) ? zonesFor(game.mapId).map((at, i) => createZone(ZONE_IDS[i], { ...at, radius: DOM_RULES.radius, captureTime: DOM_RULES.captureTime })) : [];
  game.zoneEvents = []; game.zoneSerial = game.zoneSerial || 0; game.domBank = [0, 0];
}
// Who can touch a zone: connected, in play, not waiting to respawn (a painted pana leaves it at once).
export const domActors = game => game.players.map(p => ({ id: p.id, team: p.team, x: p.x, z: p.z, alive: p.connected && !p.eliminated && !p.respawn }));
export const teamName = team => team ? locKey('turquesa') : locKey('naranja');
const LINES = { captured: locKey('El equipo {team} tomó la zona {zone}.'), neutral: locKey('El equipo {team} neutralizó la zona {zone}.') };

// One tick (after movement and paint): turn the zones, pay the holders, record events.
export function domStep(game, dt) {
  const actors = domActors(game);
  for (const e of stepZones(game.zones, actors, dt)) {
    const zone = game.zones.find(z => z.id === e.zone), by = e.type === 'neutral' ? e.by : e.team;
    // Everyone of the team standing in the zone shares the capture.
    if (e.type === 'captured') for (const a of actors) if (a.alive && a.team === e.team && Math.hypot(a.x - zone.x, a.z - zone.z) <= zone.radius) { const p = game.players.find(q => q.id === a.id); p.captures = (p.captures || 0) + 1; p.score += 2; }
    game.zoneEvents = [...game.zoneEvents, { ...e, n: ++game.zoneSerial }].slice(-8);
    if (LINES[e.type]) game.say(LINES[e.type], { team: teamName(by), zone: e.zone });
  }
  zonePoints(game.zones, game.domBank, dt, DOM_RULES.perSecond).forEach((n, t) => { game.teamScores[t] += n; });
}
// null while the round runs; else { winner: team or null (draw), reason }.
export function domOutcome(game) {
  const limit = domGoal(game.options), tie = zoneTieBreaks(game.zones);
  if (game.teamScores.some(s => s >= limit)) return { winner: decideWinner(game.teamScores, tie), reason: 'limit' };
  if (game.time > 0) return null;
  return { winner: decideWinner(game.teamScores, tie), reason: 'time' };
}
export { zonesHeld };

// What screens show, kept here so Node tests read it. A zone's colour by owner
// (team colours, cream for nobody), the sound cue an event is for your team, the
// zone you stand in, and what you are doing there.
const TEAM = ['#f28b42', '#29c5cd'], NEUTRAL = '#f8f0d2';
export const zoneColor = team => team === 0 || team === 1 ? TEAM[team] : NEUTRAL;
export function zoneCue(e, myTeam) {
  if (e.type === 'captured') return e.team === myTeam ? 'captured' : 'lost';
  if (e.type === 'neutral') return e.team === myTeam ? 'lost' : 'neutral';
  if (e.type === 'contested') return 'contested';
  return null;
}
export const zoneOf = (zones, me) => me && !me.respawn && !me.eliminated && me.connected !== false ? zones.find(z => Math.hypot(me.x - z.x, me.z - z.z) <= z.radius) || null : null;
// { kind: contested | held | neutralizing | capturing, zone, n (percent) }, or null outside.
export function zoneStatus(zone, team) {
  if (!zone) return null;
  if (zone.contested) return { kind: 'contested', zone: zone.id, n: 0 };
  if (zone.owner === team && zone.claim === team) return { kind: 'held', zone: zone.id, n: Math.round(zone.progress * 100) };
  if (zone.claim !== team && zone.progress > 0) return { kind: 'neutralizing', zone: zone.id, n: Math.round((1 - zone.progress) * 100) };
  return { kind: 'capturing', zone: zone.id, n: Math.round(zone.progress * 100) };
}

// Bots: each team's bots take roles by order (capture, defend, capture, support).
// Capturers head for the nearest zone their team does not own (the second one
// for the next capturer, so they split up); a defender holds the owned zone that
// is under attack, else the owned zone nearest the middle; support answers any
// owned zone under attack, else captures. With every zone owned, all but the
// defender hunt rivals (null: rules.js fights as usual).
// Returns { x, z, near }: walk there; inside `near` m the bot fights as usual.
const ROLES = ['capture', 'defend', 'capture', 'support'];
export function domBotGoal(game, p) {
  const zones = game.zones; if (!zones?.length) return null;
  const team = game.players.filter(q => q.bot && q.team === p.team && q.connected).sort((a, b) => a.id - b.id);
  const slot = Math.max(0, team.indexOf(p)), role = ROLES[slot % ROLES.length];
  const far = z => Math.hypot(z.x - p.x, z.z - p.z), go = z => ({ x: z.x, z: z.z, near: z.radius * .5 });
  const actors = domActors(game);
  // Ours, with rivals inside or being drained: needs help.
  const threatened = zones.filter(z => z.owner === p.team && ((zoneOccupants(z, actors).get(1 - p.team) || 0) > 0 || z.progress < 1)).sort((a, b) => far(a) - far(b));
  const targets = zones.filter(z => z.owner !== p.team).sort((a, b) => far(a) - far(b));
  const owned = zones.filter(z => z.owner === p.team);
  if (role === 'defend') {
    if (threatened.length) return go(threatened[0]);
    if (owned.length) return go(owned.sort((a, b) => Math.abs(zones.indexOf(a) - 1) - Math.abs(zones.indexOf(b) - 1) || far(a) - far(b))[0]);
  }
  if (role === 'support' && threatened.length) return go(threatened[0]);
  if (!targets.length) return role === 'defend' && owned.length ? go(owned[0]) : null;
  const capturers = team.filter((_, i) => ROLES[i % ROLES.length] === 'capture'), order = Math.max(0, capturers.indexOf(p));
  return go(targets[role === 'capture' ? Math.min(order, targets.length - 1) : 0]);
}
