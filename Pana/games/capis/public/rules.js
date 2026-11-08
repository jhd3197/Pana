// Capis a Pintazos: turn-based paint artillery on destructible ground, between
// two teams of three capybaras or six capis each on their own side (`mode: 'ffa'`).
// A side is a `team` everywhere below: its colour, its shots, its turn. Pure (no DOM, no Three.js): the game,
// the bot and Node tests run the same match.
//
//   const match = createMatch({ seconds: 35 });
//   tickMatch(match, dt, { x, aim, aimTo, face, jump, fire });   // input of the capi whose turn it is
//   for (const e of takeEvents(match)) …                         // what happened: sounds, effects, toasts
//
// Phases of a turn: 'aim' (walk, jump, aim, fire before the clock runs out),
// 'flight' (the shells are in the air; pick a weapon first, weapons.js), 'retreat' (a few seconds to walk away),
// 'settle' (everyone stops sliding), then the other team's turn. 'finished'
// when a team has no capis left.
import { carve, carveLine, splash, drips, solidAt, surfaceY, surfaceNormal } from '../../../engine/play/terrain-mask.js';
import { stepSideWalker, knock, settled } from '../../../engine/play/side-walker.js';
import { dropProp, stepProp, throwProp, propTouches, LOOSE_PROP } from '../../../engine/play/loose-prop.js';
import { aimVelocity, stepFlight, stepBounce, FLIGHT } from '../../../engine/play/ballistic.js';
import { falloff } from '../../../engine/play/lob.js';
import { WEAPONS, FIRST_WEAPON, BASIC_WEAPON, CRATE_LOOT, weaponOf, reachOf, speedOf, anglesOf, startingAmmo } from './weapons.js';
import { draw, clamp, rng } from '../../../engine/random.js';
import { generateMap, spreadSpawns, DEFAULT_SIZE } from './map-rules.js';

export const RULES = Object.freeze({
  radius: .7,          // a capi's body disc
  blast: 3.5,          // crater radius of La Bazuca de pintura
  stain: 5.2,          // paint reaches a little past the crater
  paint: 50,           // paint on a direct hit; it falls off to a quarter at the edge
  knock: 13,           // knockback speed on a direct hit
  speed: 30,           // muzzle speed at full charge (La Bazuca; every weapon's numbers are in weapons.js)
  ammo: Object.freeze(startingAmmo()), // shots per team per match of each limited weapon; La Piñita never runs out
  shoulder: .9,        // La Bazuca rests on the shoulder this high above the feet: it pivots there
  muzzle: 1.1,         // and the shell leaves its barrel this far from that pivot
  retreat: 3,          // seconds to walk away after the shot lands
  settleMax: 5,        // a turn never waits longer than this for sliding capis
  aimMin: -1.2, aimMax: 1.45, aimRate: 1.3,
  flightMax: 12,       // a shell still flying after this is lost
  turnLimit: 60,       // after this many turns the match is decided by who is left (see `byCount`)
  ffaTurnLimit: 90,    // a free-for-all takes five capis out, not three
  airControl: 9, airSpeed: 4.4,   // how much the held key steers a hop
  // Crates: the first on this turn, then one every `every` turns while fewer than `max` lie about, coming
  // down under a parachute. `margin` past touching still collects one, so walking at it always does.
  crate: Object.freeze({ first: 3, every: 3, max: 3, chute: 6, margin: .35 }),
});
// How near a capi's middle has to come to a crate's middle to take it: the two bodies touching, plus the margin.
export const CRATE_REACH = RULES.radius + LOOSE_PROP.height + RULES.crate.margin;
// The shapes a capi's tombstone may take (tombs.js says which a player has).
export const TOMB_SHAPES = Object.freeze(['headstone', 'wooden', 'celtic', 'obelisk']), DEFAULT_TOMB = TOMB_SHAPES[0];
export const TURN_SECONDS = [30, 35, 45];
export const MODES = Object.freeze(['teams', 'ffa']), FFA_SIZE = 'large', FFA_CAPIS = 6;
// The first two are the teams'; a free-for-all paints with all six.
export const TEAM_COLORS = ['#e8569b', '#2ad1b2', '#f5b301', '#8e5cf0', '#3fa7ff', '#ff7a33'];
// Capybara names are content, like a pana's name.
const NAMES = [['Toño', 'Chela', 'Nené'], ['Pancho', 'Lula', 'Gordo']]; // i18n-ignore

export const alive = c => !c.out;
// A capi soaks up to HEALTH paint and is out at that: what it has left is its health,
// the number on its tag and in the team list (painted out or in the river: 0).
export const HEALTH = 100;
export const healthOf = c => c.out ? 0 : Math.max(0, Math.round(HEALTH - c.paint));
export const center = c => ({ x: c.x, y: c.y + RULES.radius });
export const activeCapy = m => m.capys.find(c => c.id === m.turn?.capy) || null;
export const teamAlive = (m, team) => m.capys.filter(c => c.team === team && alive(c));
// Is `team` this match's own side of one (a free-for-all)?
export const isFfa = m => m.mode === 'ffa';

// Where La Bazuca pivots on capi `c`'s shoulder; the scene holds the barrel there.
export const shoulder = c => ({ x: c.x, y: c.y + RULES.shoulder });
// Where a shot aimed `angle` from capi `c` starts: the visible barrel's tip.
export function muzzle(c, angle = c.aim, facing = c.facing) {
  const o = shoulder(c);
  return { x: o.x + Math.cos(angle) * facing * RULES.muzzle, y: o.y + Math.sin(angle) * RULES.muzzle };
}

// The flight options of `weapon` for the current ground and wind; the bot and
// the aim preview use the same ones.
export const capiTargets = m => m.capys.filter(alive).map(c => ({ ...center(c), radius: RULES.radius, id: c.id }));
export function flightOptions(m, targets = capiTargets(m), weapon = FIRST_WEAPON) {
  const w = weaponOf(weapon), solid = (x, y) => solidAt(m.mask, x, y);
  return { wind: m.wind, windForce: FLIGHT.windForce * w.wind, gravity: w.gravity, solid, targets, radius: RULES.radius,
    bounds: { water: m.map.water - .3, left: -20, right: m.map.width + 20 },
    ...(w.flight === 'bounce' ? { normal: (x, y) => surfaceNormal(m.mask, x, y, .5), restitution: w.restitution, friction: w.friction } : {}) };
}
// Where each shell of `weapon` fired by capi `c` at `angle`, `facing`, `power` starts.
export function launch(c, weapon, angle, facing, power) {
  const w = weaponOf(weapon), from = muzzle(c, angle, facing), speed = speedOf(w, power);
  return anglesOf(w, angle).map(a => ({ ...from, ...aimVelocity(a, facing, speed) }));
}
// Shots left of `weapon` for `team` (Infinity for La Piñita).
export const ammoLeft = (m, team, weapon) => Number.isFinite(weaponOf(weapon).ammo) ? m.ammo[team][weapon] ?? 0 : Infinity;
export const canUse = (m, team, weapon) => WEAPONS.some(w => w.id === weapon) && ammoLeft(m, team, weapon) > 0;

// A match on the map of `seed` and `size` (map-rules.js): the same seed
// gives the same ground, spawns and winds, so a match can be replayed.
export function createMatch({ seconds = 35, difficulty = 'normal', seed = 2026, size = DEFAULT_SIZE, humans = [0], generated = null, looks = {}, mode = 'teams' } = {}) {
  mode = MODES.includes(mode) ? mode : 'teams';
  // A free-for-all needs the room: six capis, spread out, always on the big map.
  const { map, mask } = generated || generateMap(seed, mode === 'ffa' ? FFA_SIZE : size, { mode });
  const sides = mode === 'ffa' ? FFA_CAPIS : 2;
  const m = { map, mask, mode, teams: sides, seed: map.seed >>> 0, phase: 'aim', winner: null, wind: 0, shot: null, events: [],
    options: { seconds: TURN_SECONDS.includes(seconds) ? seconds : 35, difficulty, size: map.size, mode }, humans,
    last: Array(sides).fill(-1), turn: null, clock: 0, shots: 0, shells: [], capys: [], ammo: Array.from({ length: sides }, startingAmmo), used: {}, crates: [], crateN: 0, tombs: [], looks,
    // Every change to the ground, in order: replayed on the same seed's map it
    // rebuilds this ground exactly (applyEdit), so a room never sends the mask.
    edits: [], teamTurns: Array(sides).fill(0) };
  const capi = (id, team, slot, name, x, facing) => m.capys.push({ id, team, slot, name, x, y: surfaceY(mask, x) ?? map.height - 2, vx: 0, vy: 0,
    grounded: false, facing, aim: .55, paint: 0, out: null, jumpPress: 0, slide: 0, weapon: FIRST_WEAPON });
  // In a free-for-all each capi is its own side, facing the middle of the map.
  if (mode === 'ffa') spreadSpawns(map, mask, FFA_CAPIS).forEach((x, team) => capi(`f${team}`, team, 0, NAMES.flat()[team], x, x < map.width / 2 ? 1 : -1));
  else map.spawns.forEach((xs, team) => xs.forEach((x, slot) => capi(`${team}-${slot}`, team, slot, NAMES[team][slot], x, team ? -1 : 1)));
  // Settle everyone onto the ground before the first turn.
  for (let i = 0; i < 60; i++) for (const c of m.capys) stepSideWalker(c, {}, 1 / 60, m.mask, walkerOptions(m, true));
  startTurn(m, 0);
  m.events.length = 0; m.events.push({ type: 'turn', team: 0, capy: m.turn.capy, first: true });
  return m;
}

// The held key steers a capi in the air: a hop started a little short of a ledge still reaches it.
export const walkerOptions = (m, frozen = false) => ({ radius: RULES.radius, water: m.map.water, frozen, airControl: RULES.airControl, airSpeed: RULES.airSpeed });

export function takeEvents(m) { const out = m.events; m.events = []; return out; }

function startTurn(m, team) {
  const squad = m.capys.filter(c => c.team === team);
  let pick = null;
  for (let k = 1; k <= squad.length && !pick; k++) { const c = squad[(m.last[team] + k + squad.length) % squad.length]; if (alive(c)) pick = c; }
  m.last[team] = pick.slot;
  // A capi keeps the weapon it last held while its team has shots of it; else La Piñita.
  if (!canUse(m, team, pick.weapon)) pick.weapon = BASIC_WEAPON;
  m.wind = Math.round((draw(m) * 2 - 1) * 10) / 10;
  // `k`: this team's own turn count, so teammates in a room take turns (online.js controllerOf).
  m.turn = { n: (m.turn?.n || 0) + 1, k: ++m.teamTurns[team], team, capy: pick.id, time: m.options.seconds, retreat: 0, settle: 0 };
  m.phase = 'aim'; m.shot = null; m.shells = [];
  m.events.push({ type: 'turn', team, capy: pick.id });
  dropCrate(m);
}

// A crate comes down on this turn's schedule, somewhere dry on top of the land
// and not on anyone's head. Its own stream, so crates never change the winds.
function dropCrate(m) {
  const { first, every, max, chute } = RULES.crate, n = m.turn.n, { width, height, water } = m.map;
  if (n < first || (n - first) % every || m.crates.length >= max) return;
  const r = rng((m.map.seed * 31 + n * 7919) >>> 0), loot = CRATE_LOOT[Math.floor(r() * CRATE_LOOT.length)];
  for (let i = 0; i < 16; i++) {
    const x = 4 + r() * (width - 8), y = surfaceY(m.mask, x);
    if (y === null || y < water + 1.2) continue;
    if (m.capys.some(c => alive(c) && Math.abs(c.x - x) < 3) || m.crates.some(k => Math.abs(k.x - x) < 6)) continue;
    const crate = dropProp({ id: ++m.crateN, x, y: height, chute, ...loot });
    m.crates.push(crate);
    m.events.push({ type: 'crate', id: crate.id, x, weapon: loot.weapon });
    return;
  }
}

// Whoever touches a crate takes it, on any phase of any turn: its team gets the shots.
function collectCrates(m) {
  for (const k of [...m.crates]) {
    const c = m.capys.find(q => alive(q) && propTouches(k, center(q).x, center(q).y, CRATE_REACH));
    if (!c) continue;
    m.ammo[c.team][k.weapon] = (m.ammo[c.team][k.weapon] || 0) + k.shots;
    m.crates.splice(m.crates.indexOf(k), 1);
    m.events.push({ type: 'pickup', id: k.id, capy: c.id, team: c.team, weapon: k.weapon, shots: k.shots, x: k.x, y: k.y });
  }
}
function stepCrates(m, dt) {
  for (const k of [...m.crates]) {
    const r = stepProp(k, dt, m.mask, { water: m.map.water });
    if (r.sunk) gone(m, k, 'water');
    else if (r.landed) m.events.push({ type: 'crate-land', id: k.id, x: k.x, y: k.y });
  }
}
function gone(m, k, reason) {
  m.crates.splice(m.crates.indexOf(k), 1);
  m.events.push({ type: 'crate-gone', id: k.id, x: k.x, y: k.y, reason });
}
// A blast smashes a crate in its crater and throws the ones in its reach; a capi going for one gets the same blast.
function blastCrates(m, x, y, w) {
  const reach = reachOf(w, RULES.radius);
  for (const k of [...m.crates]) {
    const d = Math.hypot(k.x - x, k.y + LOOSE_PROP.height - y);
    if (d < Math.max(w.crater * .75, .9)) gone(m, k, 'blast');
    else if (d < reach) throwProp(k, x, y, w.knock * (.3 + .7 * (1 - d / reach)));
  }
  for (const t of m.tombs) {
    const d = Math.hypot(t.x - x, t.y + LOOSE_PROP.height - y);
    if (d < reach) throwProp(t, x, y, w.knock * (.3 + .7 * (1 - d / reach)));
  }
}

// The capi whose turn it is takes `weapon` in its paws (only while aiming,
// and only one its team still has shots of).
export function selectWeapon(m, weapon) {
  const c = activeCapy(m);
  if (m.phase !== 'aim' || !c || !alive(c) || !canUse(m, c.team, weapon)) return false;
  if (c.weapon !== weapon) { c.weapon = weapon; m.events.push({ type: 'weapon', capy: c.id, team: c.team, weapon }); }
  return true;
}

// Fires the weapon of the capi whose turn it is, at `power` 0..1: one shell,
// or El Trueno's fan of five. A team out of shots of it throws La Piñita.
export function fire(m, power) {
  const c = activeCapy(m);
  if (m.phase !== 'aim' || !c || !alive(c) || m.turn.time <= 0) return false;
  if (!canUse(m, c.team, c.weapon)) c.weapon = BASIC_WEAPON;
  const w = weaponOf(c.weapon), p = clamp(power, .05, 1);
  if (Number.isFinite(w.ammo)) m.ammo[c.team][w.id]--;
  m.used[w.id] = (m.used[w.id] || 0) + 1;
  m.shells = launch(c, w.id, c.aim, c.facing, p).map((s, i) => ({ ...s, t: 0, team: c.team, owner: c.id, weapon: w.id, pellet: i }));
  m.shot = m.shells[0];
  m.phase = 'flight'; m.shots++;
  m.events.push({ type: 'fire', capy: c.id, team: c.team, power: p, x: m.shot.x, y: m.shot.y, weapon: w.id });
  return true;
}

// Paint and a push on every capi within reach of (x, y): `w.paint` on a
// direct hit (the `victim`'s id: a shell that struck a capi, La Lejana's
// shot) falling off to `w.min` of it at the edge (lob.js `falloff`).
function hurt(m, x, y, w, team, victim = null) {
  const reach = reachOf(w, RULES.radius);
  for (const c of m.capys.filter(alive)) {
    const o = center(c), dx = o.x - x, dy = o.y - y, d = c.id === victim ? 0 : Math.hypot(dx, dy);
    if (d >= reach) continue;
    const paint = Math.round(w.paint * falloff(d, reach, { inner: w.inner || 0, min: w.min }));
    const near = 1 - d / reach, l = Math.hypot(dx, dy + 1) || 1, speed = w.knock * (.3 + .7 * near);
    hit(m, c, paint, team, dx / l * speed, (dy + 1) / l * speed, w.id);
  }
}
function hit(m, c, paint, team, vx, vy, weapon) {
  c.paint = Math.min(HEALTH, c.paint + paint);
  c.by = team;   // whose colour soaks in
  knock(c, vx, vy);
  m.events.push({ type: 'hit', capy: c.id, team: c.team, paint, by: team, weapon });
  if (c.paint >= HEALTH) { c.out = 'paint'; layTomb(m, c, c.x, c.y); m.events.push({ type: 'out', capy: c.id, team: c.team, reason: 'paint' }); }
}

// A capi out leaves a tombstone where it fell: it falls with the ground like a
// crate, a blast throws it, the water takes it. One lost in the river leaves it
// on the nearest dry ground, so the spot still shows.
function layTomb(m, c, x, y) {
  const looks = m.looks?.[c.team], shape = TOMB_SHAPES.includes(looks) ? looks : DEFAULT_TOMB;
  m.tombs.push(dropProp({ id: c.id, team: c.team, shape, x, y }));
}
function layTombAshore(m, c) {
  const { width, water } = m.map, from = clamp(c.x, 1, width - 1), dry = at => { const y = at >= 0 && at <= width ? surfaceY(m.mask, at) : null; return y !== null && y > water + .3 ? y : null; };
  for (let d = 0; d < width; d += .5) for (const at of [from - d, from + d]) { const y = dry(at); if (y !== null) { layTomb(m, c, at, y + .1); return; } }
}
function stepTombs(m, dt) {
  for (const t of [...m.tombs]) if (stepProp(t, dt, m.mask, { water: m.map.water }).sunk) m.tombs.splice(m.tombs.indexOf(t), 1);
}

// A shell bursts: a round crater, paint on the ground (La Bazuca's also runs
// down through the earth and throws blobs past the rim), paint and a push on
// every capi near it. `weapon` defaults to La Bazuca.
export function explode(m, x, y, team, weapon = FIRST_WEAPON, victim = null) {
  const w = weaponOf(weapon);
  edit(m, { op: 'blast', x, y, team, weapon: w.id, seed: m.shots * 7919 + Math.round(x * 10) * 31 + Math.round(y * 10) });
  m.events.push({ type: 'blast', x, y, team, weapon: w.id, size: w.crater });
  hurt(m, x, y, w, team, victim);
  blastCrates(m, x, y, w);
}

// One change to the ground (a burst or a tunnel), applied to `mask`. The
// match and a room guest's copy of it both run this, from the same numbers.
export function applyEdit(mask, e) {
  if (e.op === 'blast') {
    const w = weaponOf(e.weapon);
    carve(mask, e.x, e.y, w.crater);
    splash(mask, e.x, e.y, w.stain, e.team);
    if (w.drips) drips(mask, e.x, e.y, w.stain - .4, e.team, { seed: e.seed });
  } else if (e.op === 'drill') {
    const { radius } = weaponOf('drill').tunnel, { x0, y0, x1, y1, team } = e, w = weaponOf('drill');
    carveLine(mask, x0, y0, x1, y1, radius);
    for (let k = 0; k <= 4; k++) splash(mask, x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * k / 4, radius + .5, team, 150);
    splash(mask, x1, y1, w.stain, team);
  }
}
function edit(m, e) { m.edits.push(e); applyEdit(m.mask, e); }

// La Licuadora bores in where it strikes: a tunnel `tunnel.length` long along
// its flight (a capsule, terrain-mask.js carveLine), a lick of paint on its
// walls, a nudge and a little paint for any capi in the way. Aimed down at a
// rival's feet it opens a shaft under it; aimed level at a hill, a way through.
export function drill(m, x, y, vx, vy, team) {
  const w = weaponOf('drill'), { length, radius } = w.tunnel, l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l;
  const x0 = x - ux * .4, y0 = y - uy * .4, x1 = x + ux * length, y1 = y + uy * length;
  edit(m, { op: 'drill', x0, y0, x1, y1, team });
  m.events.push({ type: 'drill', x: x0, y: y0, x1, y1, team, weapon: w.id });
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, reach = radius + RULES.radius;
  for (const c of m.capys.filter(alive)) {
    const o = center(c), t = clamp(((o.x - x0) * dx + (o.y - y0) * dy) / l2, 0, 1);
    if (Math.hypot(o.x - x0 - dx * t, o.y - y0 - dy * t) >= reach) continue;
    hit(m, c, w.paint, team, ux * w.knock, Math.max(uy, .2) * w.knock, w.id);
  }
  // A crate in the tunnel's way is smashed.
  for (const k of [...m.crates]) {
    const t = clamp(((k.x - x0) * dx + (k.y + LOOSE_PROP.height - y0) * dy) / l2, 0, 1);
    if (Math.hypot(k.x - x0 - dx * t, k.y + LOOSE_PROP.height - y0 - dy * t) < radius + LOOSE_PROP.height) gone(m, k, 'blast');
  }
}

const sidesOf = m => Array.from({ length: m.teams }, (_, team) => team);
function winnerOf(m) {
  const standing = sidesOf(m).filter(team => teamAlive(m, team).length);
  return standing.length > 1 ? null : standing.length ? standing[0] : -1;
}
// The next side still standing after `team` (itself, when it is the last).
function nextTeam(m, team) {
  for (let k = 1; k <= m.teams; k++) { const next = (team + k) % m.teams; if (teamAlive(m, next).length) return next; }
  return team;
}

// At the turn limit: the team with more capis standing wins, then the one
// with less paint on them; else a draw. (Two teams that cannot reach each
// other, a capi stuck in a pit, never stall a match.)
export function byCount(m) {
  const score = sidesOf(m).map(team => { const left = teamAlive(m, team); return { team, left: left.length, paint: left.reduce((s, c) => s + c.paint, 0) }; });
  const most = Math.max(...score.map(s => s.left)), first = score.filter(s => s.left === most), least = Math.min(...first.map(s => s.paint));
  const best = first.filter(s => s.paint - least < 1);
  return best.length === 1 ? best[0].team : -1;
}

function finish(m, winner, by = 'out') {
  m.phase = 'finished'; m.winner = winner; m.shot = null; m.endedBy = by;
  m.events.push({ type: 'finished', winner, by });
}

// Advance the match by dt seconds with the input of the capi whose turn it is.
export function tickMatch(m, dt, input = {}) {
  if (m.phase === 'finished') return;
  m.clock += dt;
  const active = activeCapy(m), t = m.turn;
  const controls = (m.phase === 'aim' || m.phase === 'retreat') && active && alive(active);
  if (m.phase === 'aim' && controls) {
    if (Number.isFinite(input.aimTo)) active.aim = clamp(input.aimTo, RULES.aimMin, RULES.aimMax);
    else if (input.aim) active.aim = clamp(active.aim + Math.sign(input.aim) * RULES.aimRate * dt, RULES.aimMin, RULES.aimMax);
    if (input.face === 1 || input.face === -1) active.facing = input.face;
    if (input.weapon && input.weapon !== active.weapon) selectWeapon(m, input.weapon);
  }
  for (const c of m.capys) {
    if (!alive(c)) continue;
    const mine = controls && c === active;
    const r = stepSideWalker(c, mine ? { x: input.x || 0, jump: input.jump } : { jump: c.jumpPress }, dt, m.mask, walkerOptions(m, !mine));
    if (r.jumped) m.events.push({ type: 'jump', capy: c.id });
    if (r.landed) m.events.push({ type: 'land', capy: c.id });
    if (r.drowned) { c.out = 'water'; layTombAshore(m, c); m.events.push({ type: 'out', capy: c.id, team: c.team, reason: 'water', x: c.x }); }
  }
  stepCrates(m, dt);
  stepTombs(m, dt);
  collectCrates(m);
  if (m.phase === 'aim') {
    t.time = Math.max(0, t.time - dt);
    if (Number.isFinite(input.fire) && fire(m, input.fire)) return;
    if (t.time <= 0 || !alive(active)) { m.phase = 'settle'; m.events.push({ type: 'timeout', capy: active.id }); }
  } else if (m.phase === 'flight') {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps && m.shells.length; i++) {
      for (const shell of [...m.shells]) if (flyShell(m, shell, dt / steps)) m.shells.splice(m.shells.indexOf(shell), 1);
      m.shot = m.shells[0] || null;
    }
    if (!m.shells.length) landed(m);
  } else if (m.phase === 'retreat') {
    t.retreat -= dt;
    if (t.retreat <= 0 || !alive(active)) m.phase = 'settle';
  } else if (m.phase === 'settle') {
    t.settle += dt;
    if (m.capys.every(c => !alive(c) || settled(c)) || t.settle > RULES.settleMax) {
      const winner = winnerOf(m);
      if (winner !== null) finish(m, winner);
      else if (t.n >= (isFfa(m) ? RULES.ffaTurnLimit : RULES.turnLimit)) finish(m, byCount(m), 'turns');
      else startTurn(m, nextTeam(m, t.team));
    }
  }
}

// One step of one shell; true once it is gone (burst, in the water, lost).
function flyShell(m, s, dt) {
  // La Piñita falls past the capis (it bursts on its fuse, at their feet), the rest strike them.
  const w = weaponOf(s.weapon), options = flightOptions(m, w.flight === 'bounce' ? [] : undefined, w.id);
  if (w.flight === 'bounce') {
    const r = stepBounce(s, dt, options);
    if (r.hit === 'bounce' && !s.resting) m.events.push({ type: 'bounce', x: s.x, y: s.y, team: s.team });
    if (r.hit === 'water' || r.hit === 'out') { m.events.push({ type: r.hit === 'water' ? 'plop' : 'lost', x: s.x, y: s.y, team: s.team }); return true; }
    if (s.t >= w.fuse - 1e-9) { explode(m, s.x, s.y, s.team, w.id); return true; }
    return false;
  }
  const r = stepFlight(s, dt, options);
  if (r.hit === 'ground' || r.hit === 'target') {
    if (w.flight === 'drill') drill(m, s.x, s.y, s.vx, s.vy, s.team);
    else explode(m, s.x, s.y, s.team, w.id, r.victim?.id ?? null);
    return true;
  }
  if (r.hit || s.t > RULES.flightMax) { m.events.push({ type: r.hit === 'water' ? 'plop' : 'lost', x: s.x, y: s.y, team: s.team }); return true; }
  return false;
}

function landed(m) { m.shot = null; m.shells = []; m.phase = 'retreat'; m.turn.retreat = RULES.retreat; }

// Standings for the results screen: the winning team first, least paint first.
export function standings(m) {
  return [...m.capys].sort((a, b) => (b.team === m.winner) - (a.team === m.winner) || !!a.out - !!b.out || a.paint - b.paint);
}
