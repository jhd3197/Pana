// The machine's capis. Pure: it reads the match and returns the same input a
// player's keys make, so it can never do what a player cannot. On its turn it
// weighs every weapon its team still has against every rival (a quick search
// with each weapon's real flight, wind included) by the paint the best shot
// would land, minus what a scarce shot is worth keeping (less as the match
// goes on, so its shots get spent): La Bazuca for a good hit, La Lejana for an
// exposed rival at range or one it can finish, El Trueno into a group or at a
// close rival, La Piñita only bounced behind cover or into a hole, or when no
// direct shot lands (its bounces scatter, so a direct weapon that lands is
// preferred; more so by an easy bot). With no shot at anyone, or only a long
// throw, it walks closer (never into the water or off a drop, and not
// forever), then bores a way with La Licuadora if a wall is in the way, else
// lobs La Piñita, which never runs out. It searches angle and power finely
// (each flight simulated once a turn, shared by every rival it weighs),
// misses by an amount set by the difficulty that shrinks as the match goes
// on and when its team is behind (aimErrorOf), waits like a person would and
// fires before the clock runs out.
import { simulateFlight, simulateBounce } from '../../../engine/play/ballistic.js';
import { falloff, solveLob } from '../../../engine/play/lob.js';
import { difficultyInfo } from '../../../engine/play/difficulty.js';
import { rng, clamp } from '../../../engine/random.js';
import { stepSideWalker } from '../../../engine/play/side-walker.js';
import { solidAt } from '../../../engine/play/terrain-mask.js';
import { RULES, activeCapy, alive, center, flightOptions, capiTargets, launch, canUse, teamAlive } from './rules.js';
import { weaponOf, reachOf, BASIC_WEAPON } from './weapons.js';

// The shared difficulty's aimError (radians, tuned for a cue) scaled to a lob.
const ANGLE_ERROR = 3, POWER_ERROR = 1.6;
const DEFAULT_SHOT = { angle: .8, power: .7 };
// A rival farther than this is out of comfortable range: walk closer first,
// for at most WALK_SHARE of the turn (THROW_RANGE once La Bazuca is spent).
export const RANGE = 34, THROW_RANGE = 28;   // the second with only La Piñita left: it carries less far
const WALK_SHARE = .45;

// How each weapon is searched: its arc of angles and the powers tried (La
// Lejana always fires at full charge) on a coarse grid; the shot itself then
// refines around the best few (`refine`).
const SEARCH = {
  bazooka: { a: [-.2, 1.4], p: [.2, 1], grid: [.1, .05] },
  scatter: { a: [-.2, 1.4], p: [.2, 1], grid: [.1, .05] },
  grenade: { a: [-.2, 1.4], p: [.25, 1], grid: [.14, .075], pitches: [.25, .55, .85, 1.15, -.1] },
  sniper: { a: [-1, 1.2], p: [1, 1], grid: [.015, 1], window: .3 },   // only near the straight line to the target
  drill: { a: [-.5, 1.1], p: [.3, 1], grid: [.1, .1] },
};
// What a scarce shot is worth keeping, in paint, at the start of a match: a
// weapon is only fired when it beats La Piñita by more than this. It fades to
// nothing by turn KEEP_TURNS, so a team spends its shots instead of saving them.
const KEEP = { bazooka: 0, sniper: 12, scatter: 2, drill: 0, grenade: 0 }, KEEP_TURNS = 24;
// La Piñita's bounces scatter where it bursts: a direct weapon whose shot
// lands is preferred unless the throw is worth this much more (an easy bot,
// whose throws scatter more, prefers direct weapons more).
const BOUNCE_TAX = { facil: 16, normal: 10, dificil: 8, experto: 7 };
// La Lejana flies flat and ignores the wind: at a rival this far or more it is worth this much more
// (closer, SNIPE_CLOSE less: La Bazuca's blast forgives more there).
const SNIPE_RANGE = 30, SNIPE_BONUS = 8, SNIPE_CLOSE = 16;
// El Trueno's fan at a rival this close, or at one with a team-mate inside the fan.
const SCATTER_CLOSE = 24, SCATTER_BONUS = 14;
// A throw that lands further than this from its rival, this far away, is a weak one: walk closer first.
const WEAK_MISS = 3, WEAK_RANGE = 20;
// With only a throw (or nothing) at a rival farther than this, walk up to it
// first: closer, the direct weapons land and an easy bot's throws scatter less.
export const APPROACH = 22;
// Any rival farther than this: walk towards it before shooting, whatever the
// weapon, before craters and the river cut the teams off from each other.
export const FAR = 44;
// The aim error shrinks as the match goes on (to AIM_FLOOR of it by turn
// AIM_TURNS) and by AIM_BEHIND while its team is behind: a match always ends.
const AIM_TURNS = 30, AIM_FLOOR = .2, AIM_BEHIND = .7;
// Paint worth more than its amount: a rival painted out.
const FINISH = 40;
// How far a shot typically lands from where it was aimed, for valuing it (a bounced throw: further).
const SLIP = 1.2, BOUNCE_SLIP = 2;

// Where a shot of `weapon` from `start` ends: { x, y, hit, victim }. A drill's
// end is the far end of the tunnel it would bore; a grenade's where its fuse runs out.
function shotEnd(weapon, start, options) {
  const w = weaponOf(weapon);
  // The rules fly shells in 1/120 s steps (rules.js tickMatch); a bounce is chaotic enough to need the same.
  if (w.flight === 'bounce') return simulateBounce(start, options, { dt: 1 / 120, fuse: w.fuse, every: 1e9 });
  const end = simulateFlight(start, options, { dt: 1 / 60, maxTime: 7, every: 1e9 });
  if (w.flight === 'drill' && end.hit === 'ground') {
    const l = Math.hypot(end.vx, end.vy) || 1;
    return { ...end, at: { x: end.x, y: end.y }, x: end.x + end.vx / l * w.tunnel.length, y: end.y + end.vy / l * w.tunnel.length };
  }
  return end;
}

// The best shot of `weapon` from `capy` at `target` (a point; its `id` is a
// capi struck directly), searched on the weapon's coarse grid over the whole
// arc (or starting from `seed`, the `top` of an earlier coarse search) and,
// when `fine`, refined twice around the three best. Returns { angle, power,
// facing, miss, weapon, top } where miss is how far it ends.
export function bestShot(m, capy, target, { avoid = [], weapon = 'bazooka', fine = true, seed = null, cache = null } = {}) {
  const w = weaponOf(weapon), s = SEARCH[w.id], facing = target.x >= capy.x ? 1 : -1, [da, dp] = s.grid;
  // The arc searched: all of it, or (La Lejana) a window round the straight line from the shoulder.
  const line = Math.atan2(target.y - capy.y - RULES.shoulder, Math.abs(target.x - capy.x) || 1e-6);
  const lo = s.window ? Math.max(s.a[0], line - s.window) : s.a[0], hi = s.window ? Math.min(s.a[1], line + s.window) : s.a[1];
  // La Lejana is judged by what it strikes, so it flies among the capis; the rest land on the ground.
  const options = cache?.options?.[w.id] || flightOptions(m, w.direct ? capiTargets(m) : [], w.id), keep = (w.crater + 1) ** 2;
  if (cache) (cache.options ||= {})[w.id] = options;
  // Where a shot ends does not depend on the target: one flight per angle and power, shared by every rival weighed.
  const endOf = (angle, power) => {
    const key = cache && `${w.id}${facing}${angle.toFixed(4)}${power.toFixed(4)}`;
    let end = key && cache.get(key);
    if (!end) { const shells = launch(capy, w.id, angle, facing, power); end = shotEnd(w.id, shells[(shells.length - 1) / 2], options); if (key) cache.set(key, end); }
    return end;
  };
  const missOf = (angle, power) => {
    const end = endOf(angle, power);
    if (!end.hit) return Infinity;
    let miss = end.victim ? (end.victim.id === target.id ? 0 : Math.hypot(end.victim.x - target.x, end.victim.y - target.y)) : Math.hypot(end.x - target.x, end.y - target.y);
    if (end.hit === 'water' || end.hit === 'out') miss += 50;
    for (const a of avoid) if ((end.x - a.x) ** 2 + (end.y - a.y) ** 2 < keep) miss += 30;
    if (end.victim && avoid.some(a => a.id === end.victim.id)) miss += 50;
    return miss;
  };
  let top = seed ? seed.filter(c => c.weapon === w.id && c.facing === facing).map(c => ({ ...c })) : [];
  const consider = (angle, power) => {
    if (angle < lo - 1e-9 || angle > hi + 1e-9 || power < s.p[0] - 1e-4 || power > s.p[1] + 1e-4) return;
    const miss = missOf(angle, power);
    if (!Number.isFinite(miss) || (top.length >= 3 && miss >= top[2].miss)) return;
    top.push({ angle, power, facing, miss, weapon: w.id }); top.sort((a, b) => a.miss - b.miss); top = top.slice(0, 3);
  };
  // Bounces scatter where a grid lands: per throw angle, bisect the power for the distance (lob.js solveLob).
  if (!top.length && s.pitches) {
    const dist = facing * (target.x - capy.x), toPower = k => s.p[0] + (s.p[1] - s.p[0]) * k;
    const reach = (pitch, k) => facing * (endOf(pitch, toPower(k)).x - capy.x);
    for (const pitch of s.pitches) { const r = solveLob(reach, dist, { pitches: [pitch], tolerance: .3, iterations: 9 }); if (r) consider(pitch, toPower(r.power)); }
  }
  if (!top.length) for (let angle = lo; angle <= hi + 1e-9; angle += da) for (let power = s.p[0]; power <= s.p[1] + 1e-4; power += dp) consider(angle, power);
  if (fine) for (const k of [3, 9]) {
    for (const c of top.slice(0, k === 3 ? 3 : 1)) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i || j) consider(c.angle + i * da / k, Math.min(s.p[1], c.power + j * dp / k));
  }
  return top[0] ? { ...top[0], top } : { ...DEFAULT_SHOT, facing, miss: Infinity, weapon: w.id, top };
}

// The paint a shot of `weapon` would put on each capi (all of El Trueno's
// pellets), scored for `capy`'s team: paint on rivals (more for one it
// paints out), paint on its own team counted against it.
export function shotValue(m, capy, weapon, shot, cache = null) {
  const w = weaponOf(weapon), options = cache?.options?.[w.id] || flightOptions(m, w.direct ? capiTargets(m) : [], w.id), reach = reachOf(w, RULES.radius);
  const slip = w.flight === 'bounce' ? BOUNCE_SLIP : w.pellets ? SLIP / 2 : SLIP;
  const ends = launch(capy, w.id, shot.angle, shot.facing, shot.power).map(s => shotEnd(w.id, s, options)).filter(e => e.hit && e.hit !== 'water' && e.hit !== 'out');
  let value = 0;
  for (const c of m.capys) {
    if (!alive(c)) continue;
    const o = center(c);
    let paint = 0;
    for (const e of ends) {
      if (w.flight === 'drill') continue;
      const d = e.victim?.id === c.id ? 0 : Math.hypot(o.x - e.x, o.y - e.y);
      // Half as if it landed where aimed, half a typical slip (SLIP) further: a bigger blast forgives
      // more, and so does El Trueno's fan (half the slip); bounces scatter a throw more (BOUNCE_SLIP).
      const f = k => w.paint * falloff(k, reach, { inner: w.inner || 0, min: w.min });
      paint += e.victim?.id === c.id ? w.paint : (f(d) + f(d + slip)) / 2;
    }
    if (!paint) continue;
    const out = c.paint + paint >= 100;
    value += c.team === capy.team ? -(paint * 1.5 + (out ? 2 * FINISH : 0)) : Math.min(paint, 100 - c.paint) + (out ? FINISH : 0);
  }
  return value;
}

// A landing this close counts as a shot the bot can take (La Bazuca's; each
// weapon's scales with its blast).
export const FEASIBLE = 2.5;
const feasibleOf = w => w.direct ? .01 : w.pellets ? 2 : FEASIBLE;
const aimAt = c => ({ x: c.x, y: c.y + RULES.radius * .5, id: c.id });
const nearest = (capy, list) => list.reduce((a, b) => Math.abs(a.x - capy.x) <= Math.abs(b.x - capy.x) ? a : b);
const ownTeam = (m, capy) => m.capys.filter(c => alive(c) && c.team === capy.team).map(c => ({ ...center(c), id: c.id }));

// Which rival to shoot, and with what, from where `capy` stands: every
// weapon its team has shots of gets a quick search at every rival (El Trueno
// only at a close rival or one with a team-mate near it) and a value: the
// paint the best shot lands (shotValue), less what the shot is worth keeping
// (keepOf), a little for distance (a long arc is harder to land; La Lejana
// flies flat), plus a bonus for the shot each weapon is for (bonusOf) and
// `noise` (an easy bot chooses less well). La Piñita is only taken over a
// direct weapon that lands when it is worth BOUNCE_TAX more. The best
// feasible one (`weak` when it is only a long throw that lands wide), else the
// nearest rival with `feasible: false` and La Piñita. `cache` (a Map) shares
// the flights with later searches from the same spot this turn; `only` limits the rivals weighed.
export function pickTarget(m, capy, { noise = () => 0, difficulty = 'normal', cache = new Map(), only = null } = {}) {
  // The nearest rivals first (or just those in `only`): a good shot found early lets the searches that cannot beat it be skipped.
  const rivals = (only || m.capys.filter(c => alive(c) && c.team !== capy.team)).sort((a, b) => Math.abs(a.x - capy.x) - Math.abs(b.x - capy.x));
  if (!rivals.length) return null;
  // La Lejana and La Bazuca first: a search that cannot beat what is already found is skipped.
  const avoid = ownTeam(m, capy), weapons = ['sniper', 'bazooka', 'scatter', 'grenade'].filter(id => canUse(m, capy.team, id));
  const tax = BOUNCE_TAX[difficulty] ?? BOUNCE_TAX.normal;
  let best = null, throw_ = null;
  for (const id of weapons) {
    const w = weaponOf(id), keep = keepOf(m, capy.team, id);
    for (const rival of rivals) {
      const far = Math.hypot(rival.x - capy.x, rival.y - capy.y), bonus = bonusOf(id, capy, rival, rivals);
      if (id === 'scatter' && far > 40) continue;
      // The grenade must beat the best direct shot by its tax; nothing it can land beats that: skip.
      const bar = id === 'grenade' ? Math.max(throw_?.value ?? -Infinity, (best?.value ?? -Infinity) + tax) : best?.value;
      if (bar != null && bar >= ceiling(w, rival, rivals, far) - keep + bonus + 6) continue;
      const shot = bestShot(m, capy, aimAt(rival), { avoid, weapon: id, fine: false, cache });
      // A scarce shot must land close; La Piñita only has to paint someone.
      if (Number.isFinite(w.ammo) && !(shot.miss < feasibleOf(w))) continue;
      const value = shotValue(m, capy, id, shot, cache) - keep + bonus - (w.direct ? 0 : .03 * far) + noise();
      if (value <= 8) continue;
      const pick = { rival, value, miss: shot.miss, weapon: id, shot, far };
      if (id === 'grenade') { if (!throw_ || value > throw_.value) throw_ = pick; }
      else if (!best || value > best.value) best = pick;
    }
  }
  if (throw_ && (!best || throw_.value > best.value + tax)) best = throw_;
  if (!best) return { rival: nearest(capy, rivals), feasible: false, weapon: BASIC_WEAPON };
  const weak = best.weapon === BASIC_WEAPON && best.miss > WEAK_MISS && best.far > WEAK_RANGE;
  return { rival: best.rival, feasible: true, weak, miss: best.miss, weapon: best.weapon, value: best.value, shot: best.shot };
}

// What a shot of `id` is worth keeping for `team` now: KEEP early in the
// match, fading to nothing by KEEP_TURNS (the team's shots get spent).
export function keepOf(m, team, id) {
  return (KEEP[id] || 0) * clamp(1 - (m.turn.n - 1) / KEEP_TURNS, 0, 1);
}
// Rivals inside El Trueno's fan round `rival` (its spread at that distance, plus a blast).
function groupOf(capy, rival, rivals) {
  const far = Math.hypot(rival.x - capy.x, rival.y - capy.y), w = weaponOf('scatter');
  const width = far * w.spread * (w.pellets - 1) / 2 + reachOf(w, RULES.radius);
  return rivals.some(r => r !== rival && Math.hypot(r.x - rival.x, r.y - rival.y) < width);
}
// The shot each weapon is for: La Lejana at an exposed rival far away, El Trueno at a close one or into a group.
function bonusOf(id, capy, rival, rivals) {
  const far = Math.hypot(rival.x - capy.x, rival.y - capy.y);
  if (id === 'sniper') return far >= SNIPE_RANGE ? SNIPE_BONUS : -SNIPE_CLOSE;
  if (id === 'scatter') return far <= SCATTER_CLOSE || groupOf(capy, rival, rivals) ? SCATTER_BONUS : 0;
  return 0;
}

// How much a bot of `difficulty` misses by on turn `turn` (radians, the
// shared difficulty's aimError): the whole of it early, shrinking to AIM_FLOOR
// of it by AIM_TURNS, and by AIM_BEHIND while its team is `behind`.
export function aimErrorOf(difficulty, turn = 1, behind = false) {
  const late = clamp((turn - 1) / AIM_TURNS, 0, 1);
  return difficultyInfo(difficulty).aimError * (1 - (1 - AIM_FLOOR) * late) * (behind ? AIM_BEHIND : 1);
}
// Is `team` behind: fewer capis standing, or as many with clearly more paint on them?
export function behindOf(m, team) {
  const mine = teamAlive(m, team), theirs = teamAlive(m, 1 - team), paint = list => list.reduce((s, c) => s + c.paint, 0);
  return mine.length < theirs.length || (mine.length === theirs.length && paint(mine) > paint(theirs) + 30);
}

// The most a shot of `w` at `rival` could be worth: all its paint on it and
// on every rival standing within its reach.
function ceiling(w, rival, rivals, far) {
  const reach = reachOf(w, RULES.radius) + 1;
  // El Trueno's fan: as wide as its spread at that distance, and only the pellets that close together reach one capi.
  const width = w.pellets ? far * w.spread * (w.pellets - 1) / 2 + reach : reach;
  const per = w.pellets ? Math.min(w.pellets, 1 + 2 * Math.floor(reach / Math.max(.01, far * w.spread))) : 1;
  return rivals.filter(r => Math.hypot(r.x - rival.x, r.y - rival.y) < width || r === rival)
    .reduce((sum, r) => { const paint = w.paint * per; return sum + Math.min(paint, 100 - r.paint) + (r.paint + paint >= 100 ? FINISH : 0); }, 0);
}

// No shot at anyone, even after walking: bore towards `rival` with La
// Licuadora when its tunnel would end at the rival (dropping it) or when a
// wall stands close in the way (opening a path), else null.
export function drillPlan(m, capy, rival, cache = null) {
  if (!canUse(m, capy.team, 'drill')) return null;
  const shot = bestShot(m, capy, aimAt(rival), { avoid: ownTeam(m, capy), weapon: 'drill', fine: false, cache });
  if (!Number.isFinite(shot.miss)) return null;
  const options = flightOptions(m, [], 'drill'), start = launch(capy, 'drill', shot.angle, shot.facing, shot.power)[0], end = shotEnd('drill', start, options);
  if (end.hit !== 'ground') return null;
  const gap = Math.hypot(rival.x - capy.x, rival.y - capy.y), wall = Math.hypot(end.at.x - capy.x, end.at.y - capy.y);
  // Its tunnel only nudges (8 paint): it may start right by the capi, to bore out of a pit.
  if (clearance(m, capy, 'drill', shot, cache) < -RULES.radius) return null;
  return shot.miss < 3 || (wall < 15 && shot.miss < gap - 4) ? shot : null;
}

// Boxed in, every throw at `target` lands by its own team: the throw that
// lands safely closest to it (towards it, else anywhere), else the one that
// lands furthest from the team (a capi in a pocket, digging itself out).
function safeShot(m, capy, target, weapon, shot, cache) {
  let best = null;
  for (const facing of [Math.sign(target.x - capy.x) || 1, -(Math.sign(target.x - capy.x) || 1)]) {
    for (const angle of [-.2, .2, .6, 1, 1.35]) for (const power of [.35, .65, 1]) {
      const s = { angle, power, facing }, gap = clearance(m, capy, weapon, s, cache);
      const shells = launch(capy, weapon, angle, facing, power), end = shotEnd(weapon, shells[(shells.length - 1) / 2], cache?.options?.[weapon] || flightOptions(m, [], weapon));
      const miss = end.hit && end.hit !== 'water' && end.hit !== 'out' ? Math.hypot(end.x - target.x, end.y - target.y) : Infinity;
      const score = gap >= SAFE ? 1000 - miss : gap;
      if (Number.isFinite(miss) && (!best || score > best.score)) best = { ...shot, angle, power, facing, miss, score };
    }
  }
  return best || shot;
}

// How far the blast of `shot` (La Licuadora's whole tunnel) stays outside the
// reach of `capy`'s own team; below SAFE an aim error could paint them.
const SAFE = 1.5;
export function clearance(m, capy, weapon, shot, cache = null) {
  const w = weaponOf(weapon), options = cache?.options?.[w.id] || flightOptions(m, w.direct ? capiTargets(m) : [], w.id);
  const shells = launch(capy, w.id, shot.angle, shot.facing, shot.power);
  let gap = Infinity;
  for (const s of shells) {
    const e = shotEnd(w.id, s, options);
    if (!e.hit || e.hit === 'water' || e.hit === 'out') continue;
    const from = e.at || e, reach = w.flight === 'drill' ? w.tunnel.radius + RULES.radius : reachOf(w, RULES.radius);
    for (const c of ownTeam(m, capy)) {
      const dx = e.x - from.x, dy = e.y - from.y, l2 = dx * dx + dy * dy || 1, t = clamp(((c.x - from.x) * dx + (c.y - from.y) * dy) / l2, 0, 1);
      gap = Math.min(gap, Math.hypot(c.x - from.x - dx * t, c.y - from.y - dy * t) - reach);
    }
  }
  return gap;
}

// Shut in (a pit, a tunnel, a wall between): no shot lands near `rival` and
// walking does not get there. Blast the first ground on the straight line to
// it instead, DIG_FROM to DIG_TO away (never closer than its own blast
// reaches), so the next turns can walk or shoot through. Returns the shot
// with its `target` point, or null when the line is open or nothing lands there.
const DIG_FROM = 5.5, DIG_TO = 26, DIG_MISS = 6;
export function digPlan(m, capy, rival, { weapon = BASIC_WEAPON, cache = null } = {}) {
  const ox = capy.x, oy = capy.y + RULES.shoulder, r = center(rival), d = Math.hypot(r.x - ox, r.y - oy), ux = (r.x - ox) / d, uy = (r.y - oy) / d;
  let wall = null;
  for (let k = 1.5; k < Math.min(d - 2, DIG_TO); k += .5) if (solidAt(m.mask, ox + ux * k, oy + uy * k)) { wall = k; break; }
  if (wall === null) return null;
  // Into the wall on the line, else (a wall too close to blast safely) the top of it.
  const into = Math.max(wall, DIG_FROM), top = { x: ox + ux * into, y: oy + uy * into }, avoid = ownTeam(m, capy);
  for (let y = top.y; y < m.map.height; y += .5) if (!solidAt(m.mask, top.x, y)) { top.y = y; break; }
  for (const target of [{ x: ox + ux * into, y: oy + uy * into }, top]) {
    const shot = bestShot(m, capy, target, { avoid, weapon, fine: false, cache });
    if (shot.miss < 3 && clearance(m, capy, weapon, shot, cache) >= SAFE) return { ...shot, target };
  }
  return null;
}

// The shot the bot will take this turn with `weapon` at `target` (a rival's
// id; the nearest rival by default), or at the point `at` (digging), with its difficulty's error applied.
export function planShot(m, capy, { difficulty = 'normal', random = Math.random, target: id = null, weapon = 'bazooka', seed = null, cache = null, at = null } = {}) {
  const rivals = m.capys.filter(c => alive(c) && c.team !== capy.team);
  if (!rivals.length) return { ...DEFAULT_SHOT, facing: capy.facing, miss: Infinity, weapon };
  const target = rivals.find(c => c.id === id) || nearest(capy, rivals), w = weaponOf(weapon);
  let shot = bestShot(m, capy, at || aimAt(target), { avoid: ownTeam(m, capy), weapon, seed, cache });
  // A hopeless lob that would paint its own team (the only landing is at its feet): throw it
  // somewhere harmless on the way to the rival instead.
  if (shot.miss > DIG_MISS && clearance(m, capy, weapon, shot, cache) < SAFE) shot = safeShot(m, capy, target, weapon, shot, cache);
  // Out of reach: no shot lands at all, take the default lob; one that only lands far still goes the right way.
  if (!Number.isFinite(shot.miss)) return { ...DEFAULT_SHOT, facing: target.x >= capy.x ? 1 : -1, miss: shot.miss, target: target.id, weapon };
  if (shot.miss > 25) return { ...shot, target: target.id };
  const err = aimErrorOf(difficulty, m.turn.n, behindOf(m, capy.team)), wobble = () => random() + random() - 1;
  return { ...shot, target: target.id,
    angle: clamp(shot.angle + wobble() * err * ANGLE_ERROR, RULES.aimMin, RULES.aimMax),
    // A bounced throw's power carries further along the ground: half the power error.
    power: w.floor > .5 ? 1 : clamp(shot.power + wobble() * err * POWER_ERROR * (w.flight === 'bounce' ? .5 : 1), .1, 1) };
}

// A bot for one team. input(m, dt) is called every tick of its turns.
export function createBot({ team = 1, difficulty = 'normal', seed = 7 } = {}) {
  // An easy bot also chooses less well (`noise` on each shot's value), less so as the match goes on.
  const random = rng(seed);
  let spread = 0;
  const noise = () => (random() - .5) * spread;
  let turn = 0, plan = null, cache = null;
  // The flights searched from where the capi stands this turn, shared by every search from there.
  const cacheAt = c => { const at = `${turn}:${c.x.toFixed(3)}:${c.y.toFixed(3)}`; if (cache?.at !== at) { cache = new Map(); cache.at = at; } return cache; };
  return {
    get plan() { return plan; },   // this turn's choice, for tests and match reports
    input(m) {
      const capy = activeCapy(m);
      if (!capy || capy.team !== team || m.phase !== 'aim' || !alive(capy)) return {};
      if (m.turn.n !== turn) {
        turn = m.turn.n; spread = aimErrorOf(difficulty, turn, behindOf(m, team)) * 400;
        // The best rival and weapon from here (every rival far away: only the nearest is weighed, as the
        // capi walks closer first anyway). With no shot at any, only a long throw (or a wide one), or any
        // rival far away, walk towards it first and weigh the shots again from where the walk ends.
        const rivals = m.capys.filter(c => alive(c) && c.team !== team), close = rivals.length ? nearest(capy, rivals) : null;
        const far = !!close && Math.abs(close.x - capy.x) > FAR;
        const pick = pickTarget(m, capy, { noise, difficulty, cache: cacheAt(capy), only: far ? [close] : null }), rival = pick?.rival;
        plan = { rival: rival?.id, weapon: pick?.weapon || BASIC_WEAPON, seed: pick?.shot?.top || null, feasible: !!pick?.feasible, walkUntil: m.clock + m.turn.time * WALK_SHARE,
          dir: rival ? Math.sign(rival.x - capy.x) : 0, walking: far || !pick?.feasible || !!pick?.weak || (rival && pick.weapon === BASIC_WEAPON && Math.abs(rival.x - capy.x) > APPROACH),
          approach: pick?.weapon === BASIC_WEAPON,
          think: .9 + random() * 1.3, shot: null, startX: capy.x, fireAt: Infinity, last: capy.x, lastAt: m.clock, hopped: false, jumps: capy.jumpPress || 0 };
      }
      const hurry = m.turn.time < 2;
      if (plan.walking) plan.walking = !hurry && keepWalking(m, capy, plan);
      if (plan.walking) {
        // Stuck against a bump: hop once if the landing is dry far enough ahead, then give up walking.
        if (m.clock - plan.lastAt > .8) {
          if (Math.abs(capy.x - plan.last) < .3) { if (plan.hopped || !safeWalk(m, capy, plan.dir, true)) { plan.walking = false; } else { plan.hopped = true; plan.jumps++; } }
          plan.last = capy.x; plan.lastAt = m.clock;
        }
        if (plan.walking) return { x: plan.dir, jump: plan.jumps };
      }
      if (!plan.shot) {
        // After a walk, look again from the new spot (only when the walk moved it).
        if (Math.abs(capy.x - plan.startX) > 1 && !hurry) {
          const again = pickTarget(m, capy, { noise, difficulty, cache: cacheAt(capy) });
          if (again?.feasible) Object.assign(plan, { rival: again.rival.id, weapon: again.weapon, seed: again.shot.top, feasible: true });
        }
        // Still nothing: bore a way with La Licuadora; else, when even a lob lands wide, blast the
        // ground in the way (digPlan); else lob La Piñita (it never runs out).
        if (!plan.feasible && !hurry) {
          const rival = m.capys.find(c => c.id === plan.rival), cache = cacheAt(capy);
          const bore = rival && drillPlan(m, capy, rival, cache);
          const wide = !bore && rival && !(bestShot(m, capy, aimAt(rival), { avoid: ownTeam(m, capy), weapon: BASIC_WEAPON, fine: false, cache }).miss < DIG_MISS);
          const dig = wide && digPlan(m, capy, rival, { cache });
          Object.assign(plan, bore ? { weapon: 'drill', seed: bore.top } : dig ? { weapon: BASIC_WEAPON, seed: dig.top, at: dig.target } : { weapon: BASIC_WEAPON, seed: null });
        }
        if (!canUse(m, capy.team, plan.weapon)) plan.weapon = BASIC_WEAPON;
        plan.shot = planShot(m, capy, { difficulty, random, target: plan.rival, weapon: plan.weapon, seed: plan.seed, cache: hurry ? null : cacheAt(capy), at: plan.at }); plan.fireAt = m.clock + plan.think;
      }
      const s = plan.shot, aimed = Math.abs(capy.aim - s.angle) < .02 && capy.facing === s.facing;
      // Swing the barrel at a person's speed, then hold and fire.
      const step = RULES.aimRate / 60, aimTo = capy.aim + clamp(s.angle - capy.aim, -step, step);
      if ((aimed && m.clock >= plan.fireAt) || hurry) return { weapon: plan.weapon, face: s.facing, aimTo: s.angle, fire: s.power, jump: plan.jumps };
      return { weapon: plan.weapon, face: s.facing, aimTo, jump: plan.jumps };
    },
  };
}

// Walk on while the rival is out of range, the turn's walking time lasts, and
// the ground a step ahead (or below a ledge) is dry.
function keepWalking(m, capy, plan) {
  const rival = m.capys.find(c => c.id === plan.rival);
  if (!rival || !alive(rival) || !plan.dir || m.clock >= plan.walkUntil) return false;
  if (Math.abs(rival.x - capy.x) <= (plan.approach ? APPROACH : canUse(m, capy.team, 'bazooka') ? RANGE : THROW_RANGE)) return false;
  if (!capy.grounded) return true;
  // Look ahead with the real walker (a ledge, a steep bank, a painted slope can carry it on), a few times a second.
  if (!plan.checkAt || m.clock >= plan.checkAt) { plan.safe = safeWalk(m, capy, plan.dir, false); plan.checkAt = m.clock + .2; }
  return plan.safe;
}
// Would walking (or hopping) `dir` for the next two seconds keep the capi out of the river?
function safeWalk(m, capy, dir, hop) {
  const ghost = { x: capy.x, y: capy.y, vx: capy.vx, vy: capy.vy, grounded: capy.grounded, facing: capy.facing, jumpPress: capy.jumpPress || 0, slide: capy.slide || 0 };
  const options = { radius: RULES.radius, water: m.map.water };
  for (let i = 0; i < 120; i++) {
    const r = stepSideWalker(ghost, { x: dir, jump: (capy.jumpPress || 0) + (hop ? 1 : 0) }, 1 / 60, m.mask, options);
    if (r.drowned || ghost.y < m.map.water + 1) return false;
  }
  // And it ends on the ground, not still falling towards the water.
  return ghost.grounded || ghost.y > m.map.water + 4;
}

