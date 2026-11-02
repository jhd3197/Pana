// Objective primitives for team modes: flags (capture the flag) and capture
// zones (domination, king of the hill). Pure data and functions, no Three.js and
// no DOM, so a server room, a practice host and a unit test run the same rules.
//
// An "actor" is anything that can touch an objective: { id, team, x, z, alive }.
// The game builds that list from its own players each tick (alive = connected,
// in play, not respawning). Every step returns events ({ type, team, actor, ... })
// the game turns into its feed lines, scores and sounds.

const near = (a, x, z, r) => Math.hypot(a.x - x, a.z - z) <= r;
// Nearest first; ties go to the lower id so a simultaneous touch is deterministic.
const byDistance = (x, z) => (a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z) || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);

// --- Flags -------------------------------------------------------------------

// Defaults: touch within 1.5 m, score within 2.2 m of your own stand, a dropped
// flag goes home after 30 s on the ground.
export const FLAG_RULES = Object.freeze({ pickup: 1.5, capture: 2.2, returnAfter: 30 });

// A flag at its stand. `taken` counts how many times the other side lifted it
// (a time-limit tie-break), `idle` the seconds it has lain on the ground.
export function createFlag(team, { x, z }) {
  return { team, homeX: x, homeZ: z, x, z, state: 'home', carrier: null, idle: 0, taken: 0 };
}
export const flagHome = flag => flag.state === 'home';
export function returnFlag(flag) { Object.assign(flag, { x: flag.homeX, z: flag.homeZ, state: 'home', carrier: null, idle: 0 }); return flag; }
export function dropFlag(flag, x = flag.x, z = flag.z) { Object.assign(flag, { x, z, state: 'dropped', carrier: null, idle: 0 }); return flag; }
export function takeFlag(flag, actor) { if (flag.state === 'home') flag.taken++; Object.assign(flag, { x: actor.x, z: actor.z, state: 'carried', carrier: actor.id, idle: 0 }); return flag; }
// The flag `id` carries, if any.
export const carriedBy = (flags, id) => flags.find(f => f.state === 'carried' && f.carrier === id) || null;

// Drops whatever `actor` carries where they stand (death, disconnect, leaving).
export function dropCarried(flags, actor) {
  const flag = carriedBy(flags, actor.id); if (!flag) return null;
  dropFlag(flag, actor.x, actor.z); return { type: 'drop', team: flag.team, actor: actor.id, x: flag.x, z: flag.z };
}

// One tick of every flag. Order, so simultaneous contact has one answer:
// 1. carried flags follow their carrier, or drop where it was last seen when the
//    carrier is gone (dead, disconnected, left);
// 2. captures: a carrier inside its own stand's radius scores only while its own
//    flag is home;
// 3. contact: a dropped flag touched by its own team goes home at once (a
//    defender's return beats an attacker's pickup in the same tick); otherwise the
//    nearest rival not already carrying lifts it, from its stand or the ground;
// 4. a dropped flag left alone for `returnAfter` seconds goes home.
export function stepFlags(flags, actors, dt, rules = {}) {
  const { pickup, capture, returnAfter } = { ...FLAG_RULES, ...rules }, events = [];
  const live = actors.filter(a => a.alive), byId = new Map(actors.map(a => [a.id, a]));
  for (const flag of flags) {
    if (flag.state !== 'carried') continue;
    const carrier = byId.get(flag.carrier);
    if (carrier?.alive) { flag.x = carrier.x; flag.z = carrier.z; }
    else { const at = carrier || flag; dropFlag(flag, at.x, at.z); events.push({ type: 'drop', team: flag.team, actor: carrier?.id ?? null, x: flag.x, z: flag.z }); }
  }
  for (const flag of flags) {
    if (flag.state !== 'carried') continue;
    const carrier = byId.get(flag.carrier), own = flags.find(f => f.team === carrier.team);
    if (own && flagHome(own) && near(carrier, own.homeX, own.homeZ, capture)) {
      returnFlag(flag); events.push({ type: 'capture', team: carrier.team, flag: flag.team, actor: carrier.id });
    }
  }
  for (const flag of flags) {
    if (flag.state === 'carried') continue;
    const touching = live.filter(a => near(a, flag.x, flag.z, pickup)).sort(byDistance(flag.x, flag.z));
    if (flag.state === 'dropped') {
      const owner = touching.find(a => a.team === flag.team);
      if (owner) { returnFlag(flag); events.push({ type: 'return', team: flag.team, actor: owner.id }); continue; }
    }
    const rival = touching.find(a => a.team !== flag.team && !carriedBy(flags, a.id));
    if (rival) { const from = flag.state; takeFlag(flag, rival); events.push({ type: 'pickup', team: flag.team, actor: rival.id, from }); }
  }
  for (const flag of flags) {
    if (flag.state !== 'dropped') continue;
    flag.idle += dt;
    if (flag.idle >= returnAfter) { returnFlag(flag); events.push({ type: 'return', team: flag.team, actor: null, auto: true }); }
  }
  return events;
}

// --- Capture zones -------------------------------------------------------------

// A zone owned by nobody. `progress` 0..1 belongs to `claim` (the team turning it).
export function createZone(id, { x, z, radius = 4, captureTime = 8 } = {}) {
  return { id, x, z, radius, captureTime, owner: null, claim: null, progress: 0, contested: false };
}
// The teams standing in the zone and how many of each.
export function zoneOccupants(zone, actors) {
  const teams = new Map();
  for (const a of actors) if (a.alive && near(a, zone.x, zone.z, zone.radius)) teams.set(a.team, (teams.get(a.team) || 0) + 1);
  return teams;
}
// One tick: a lone team inside turns the zone (more panas, faster: +50% each,
// up to 3×); a rival owner's zone is first neutralised, then claimed. Two teams
// inside contest it and nothing moves. An empty zone drifts back to its owner:
// unfinished progress of a claimer fades at half speed, a drained owner's zone
// refills at half speed. The owner alone inside refills it at full speed.
// Events: `contested` when a second team steps in, `neutral`, `captured`.
export function stepZone(zone, actors, dt) {
  const teams = zoneOccupants(zone, actors), events = [], was = zone.contested;
  zone.contested = teams.size > 1;
  if (zone.contested && !was) events.push({ type: 'contested', zone: zone.id, team: zone.owner });
  if (teams.size > 1) return events;
  if (!teams.size) {
    const drift = dt / zone.captureTime / 2;
    if (zone.claim !== zone.owner) { zone.progress = Math.max(0, zone.progress - drift); if (!zone.progress) zone.claim = zone.owner; }
    else if (zone.owner !== null) zone.progress = Math.min(1, zone.progress + drift);
    return events;
  }
  const [[team, count]] = teams, rate = dt / zone.captureTime * Math.min(3, 1 + (count - 1) * .5);
  if (zone.owner === team && zone.claim === team) { zone.progress = Math.min(1, zone.progress + rate); return events; }
  if (zone.claim !== team) {
    zone.progress -= rate;
    if (zone.progress <= 0) {
      zone.progress = 0; zone.claim = team;
      if (zone.owner !== null && zone.owner !== team) { events.push({ type: 'neutral', zone: zone.id, team: zone.owner, by: team }); zone.owner = null; }
    }
    return events;
  }
  zone.progress = Math.min(1, zone.progress + rate);
  if (zone.progress >= 1 && zone.owner !== team) { zone.owner = team; events.push({ type: 'captured', zone: zone.id, team }); }
  return events;
}
// Every zone in one tick; events in zone order.
export const stepZones = (zones, actors, dt) => zones.flatMap(zone => stepZone(zone, actors, dt));
// How many zones each team owns right now.
export const zonesHeld = (zones, teams = 2) => Array.from({ length: teams }, (_, t) => zones.filter(z => z.owner === t).length);
// Hold scoring: every owned zone earns `perSecond` points. Fractions wait in
// `bank` (one number per team, mutated) so whole points land on time; returns
// the whole points each team earned this tick.
export function zonePoints(zones, bank, dt, perSecond = 1) {
  return zonesHeld(zones, bank.length).map((held, t) => { bank[t] += held * perSecond * dt; const whole = Math.floor(bank[t] + 1e-9); bank[t] -= whole; return whole; });
}

// --- Match end -------------------------------------------------------------------

// The team that reached `limit` (score limit), or null.
export const reachedLimit = (scores, limit) => { const i = scores.findIndex(s => s >= limit); return i < 0 ? null : i; };
// The winning team index, or null for a draw. Higher score wins; a tie goes
// through `tieBreaks` in order, each an array of numbers per team where higher
// is better (for flags: [own flag at home ? 1 : 0], [-times own flag taken]).
export function decideWinner(scores, tieBreaks = []) {
  for (const row of [scores, ...tieBreaks]) {
    const best = Math.max(...row), top = row.map((v, i) => v === best ? i : -1).filter(i => i >= 0);
    if (top.length === 1) return top[0];
  }
  return null;
}
// Flag tie-breaks for decideWinner: a flag at home beats one away, then the team
// whose flag was taken fewer times.
export const flagTieBreaks = (flags, teams = 2) => {
  const of = t => flags.find(f => f.team === t);
  return [Array.from({ length: teams }, (_, t) => (of(t) && flagHome(of(t)) ? 1 : 0)), Array.from({ length: teams }, (_, t) => -(of(t)?.taken || 0))];
};
// Zone tie-break for decideWinner: the team holding more zones right now.
export const zoneTieBreaks = (zones, teams = 2) => [zonesHeld(zones, teams)];
