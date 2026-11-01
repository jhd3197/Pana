// Capis a Pintazos: turn-based paint artillery between two teams of three
// capybaras on destructible ground. Pure (no DOM, no Three.js): the game,
// the bot and Node tests run the same match.
//
//   const match = createMatch({ seconds: 35 });
//   tickMatch(match, dt, { x, aim, aimTo, face, jump, fire });   // input of the capi whose turn it is
//   for (const e of takeEvents(match)) …                         // what happened: sounds, effects, toasts
//
// Phases of a turn: 'aim' (walk, jump, aim, fire before the clock runs out),
// 'flight' (the shell is in the air), 'retreat' (a few seconds to walk away),
// 'settle' (everyone stops sliding), then the other team's turn. 'finished'
// when a team has no capis left.
import { carve, splash, drips, solidAt, surfaceY } from '../../../engine/play/terrain-mask.js';
import { stepSideWalker, knock, settled } from '../../../engine/play/side-walker.js';
import { aimVelocity, stepFlight } from '../../../engine/play/ballistic.js';
import { draw, clamp } from '../../../engine/random.js';
import { generateMap, DEFAULT_SIZE } from './map-rules.js';

export const RULES = Object.freeze({
  radius: .7,          // a capi's body disc
  blast: 3.5,          // crater radius of La Bazuca de pintura
  stain: 5.2,          // paint reaches a little past the crater
  paint: 50,           // paint on a direct hit; it falls off to a quarter at the edge
  knock: 13,           // knockback speed on a direct hit
  speed: 30,           // muzzle speed at full charge
  shoulder: .9,        // La Bazuca rests on the shoulder this high above the feet: it pivots there
  muzzle: 1.1,         // and the shell leaves its barrel this far from that pivot
  retreat: 3,          // seconds to walk away after the shot lands
  settleMax: 5,        // a turn never waits longer than this for sliding capis
  aimMin: -1.2, aimMax: 1.45, aimRate: 1.3,
  flightMax: 12,       // a shell still flying after this is lost
  turnLimit: 60,       // after this many turns the match is decided by who is left (see `byCount`)
});
export const TURN_SECONDS = [30, 35, 45];
export const TEAM_COLORS = ['#e8569b', '#2ad1b2'];
// Capybara names are content, like a pana's name.
const NAMES = [['Toño', 'Chela', 'Nené'], ['Pancho', 'Lula', 'Gordo']]; // i18n-ignore

export const alive = c => !c.out;
export const center = c => ({ x: c.x, y: c.y + RULES.radius });
export const activeCapy = m => m.capys.find(c => c.id === m.turn?.capy) || null;
export const teamAlive = (m, team) => m.capys.filter(c => c.team === team && alive(c));

// Where La Bazuca pivots on capi `c`'s shoulder; the scene holds the barrel there.
export const shoulder = c => ({ x: c.x, y: c.y + RULES.shoulder });
// Where a shot aimed `angle` from capi `c` starts: the visible barrel's tip.
export function muzzle(c, angle = c.aim, facing = c.facing) {
  const o = shoulder(c);
  return { x: o.x + Math.cos(angle) * facing * RULES.muzzle, y: o.y + Math.sin(angle) * RULES.muzzle };
}

// The flight options for the current ground and wind; the bot and the aim
// preview use the same ones.
export function flightOptions(m, targets = m.capys.filter(alive).map(c => ({ ...center(c), radius: RULES.radius, id: c.id }))) {
  return { wind: m.wind, solid: (x, y) => solidAt(m.mask, x, y), targets, radius: RULES.radius,
    bounds: { water: m.map.water - .3, left: -20, right: m.map.width + 20 } };
}

// A match on the map of `seed` and `size` (map-rules.js): the same seed
// gives the same ground, spawns and winds, so a match can be replayed.
export function createMatch({ seconds = 35, difficulty = 'normal', seed = 2026, size = DEFAULT_SIZE, humans = [0], generated = null } = {}) {
  const { map, mask } = generated || generateMap(seed, size);
  const m = { map, mask, seed: map.seed >>> 0, phase: 'aim', winner: null, wind: 0, shot: null, events: [],
    options: { seconds: TURN_SECONDS.includes(seconds) ? seconds : 35, difficulty, size: map.size }, humans,
    last: [-1, -1], turn: null, clock: 0, shots: 0, capys: [] };
  map.spawns.forEach((xs, team) => xs.forEach((x, slot) => {
    m.capys.push({ id: `${team}-${slot}`, team, slot, name: NAMES[team][slot], x, y: surfaceY(mask, x) ?? map.height - 2, vx: 0, vy: 0,
      grounded: false, facing: team ? -1 : 1, aim: .55, paint: 0, out: null, jumpPress: 0, slide: 0 });
  }));
  // Settle everyone onto the ground before the first turn.
  for (let i = 0; i < 60; i++) for (const c of m.capys) stepSideWalker(c, {}, 1 / 60, m.mask, walkerOptions(m, true));
  startTurn(m, 0);
  m.events.length = 0; m.events.push({ type: 'turn', team: 0, capy: m.turn.capy, first: true });
  return m;
}

const walkerOptions = (m, frozen) => ({ radius: RULES.radius, water: m.map.water, frozen });

export function takeEvents(m) { const out = m.events; m.events = []; return out; }

function startTurn(m, team) {
  const squad = m.capys.filter(c => c.team === team);
  let pick = null;
  for (let k = 1; k <= squad.length && !pick; k++) { const c = squad[(m.last[team] + k + squad.length) % squad.length]; if (alive(c)) pick = c; }
  m.last[team] = pick.slot;
  m.wind = Math.round((draw(m) * 2 - 1) * 10) / 10;
  m.turn = { n: (m.turn?.n || 0) + 1, team, capy: pick.id, time: m.options.seconds, retreat: 0, settle: 0 };
  m.phase = 'aim'; m.shot = null;
  m.events.push({ type: 'turn', team, capy: pick.id });
}

// Fires La Bazuca de pintura from the capi whose turn it is, at `power` 0..1.
export function fire(m, power) {
  const c = activeCapy(m);
  if (m.phase !== 'aim' || !c || !alive(c) || m.turn.time <= 0) return false;
  const p = clamp(power, .05, 1), from = muzzle(c);
  m.shot = { ...from, ...aimVelocity(c.aim, c.facing, p * RULES.speed), t: 0, team: c.team, owner: c.id };
  m.phase = 'flight'; m.shots++;
  m.events.push({ type: 'fire', capy: c.id, team: c.team, power: p, x: from.x, y: from.y });
  return true;
}

// The paint shell lands: a crater, paint on the ground (running down through
// the earth and thrown in blobs past the rim), paint and a push on every capi
// near it.
export function explode(m, x, y, team) {
  carve(m.mask, x, y, RULES.blast);
  splash(m.mask, x, y, RULES.stain, team);
  drips(m.mask, x, y, RULES.stain - .4, team, { seed: m.shots * 7919 + Math.round(x * 10) * 31 + Math.round(y * 10) });
  m.events.push({ type: 'blast', x, y, team });
  const reach = RULES.blast + RULES.radius;
  for (const c of m.capys.filter(alive)) {
    const o = center(c), dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
    if (d >= reach) continue;
    const k = 1 - d / reach, paint = Math.round(RULES.paint * (.25 + .75 * k));
    c.paint = Math.min(100, c.paint + paint);
    const l = Math.hypot(dx, dy + 1) || 1, speed = RULES.knock * (.3 + .7 * k);
    knock(c, dx / l * speed, (dy + 1) / l * speed);
    m.events.push({ type: 'hit', capy: c.id, team: c.team, paint, by: team });
    if (c.paint >= 100) { c.out = 'paint'; m.events.push({ type: 'out', capy: c.id, team: c.team, reason: 'paint' }); }
  }
}

function winnerOf(m) {
  const standing = [0, 1].filter(team => teamAlive(m, team).length);
  return standing.length === 2 ? null : standing.length ? standing[0] : -1;
}

// At the turn limit: the team with more capis standing wins, then the one
// with less paint on them; else a draw. (Two teams that cannot reach each
// other, a capi stuck in a pit, never stall a match.)
export function byCount(m) {
  const left = [0, 1].map(team => teamAlive(m, team)), paint = left.map(list => list.reduce((s, c) => s + c.paint, 0));
  if (left[0].length !== left[1].length) return left[0].length > left[1].length ? 0 : 1;
  if (Math.abs(paint[0] - paint[1]) >= 1) return paint[0] < paint[1] ? 0 : 1;
  return -1;
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
  }
  for (const c of m.capys) {
    if (!alive(c)) continue;
    const mine = controls && c === active;
    const r = stepSideWalker(c, mine ? { x: input.x || 0, jump: input.jump } : { jump: c.jumpPress }, dt, m.mask, walkerOptions(m, !mine));
    if (r.jumped) m.events.push({ type: 'jump', capy: c.id });
    if (r.landed) m.events.push({ type: 'land', capy: c.id });
    if (r.drowned) { c.out = 'water'; m.events.push({ type: 'out', capy: c.id, team: c.team, reason: 'water', x: c.x }); }
  }
  if (m.phase === 'aim') {
    t.time = Math.max(0, t.time - dt);
    if (Number.isFinite(input.fire) && fire(m, input.fire)) return;
    if (t.time <= 0 || !alive(active)) { m.phase = 'settle'; m.events.push({ type: 'timeout', capy: active.id }); }
  } else if (m.phase === 'flight') {
    const shot = m.shot, steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < steps && m.phase === 'flight'; i++) {
      const r = stepFlight(shot, dt / steps, flightOptions(m));
      if (r.hit === 'ground' || r.hit === 'target') { explode(m, shot.x, shot.y, shot.team); landed(m); }
      else if (r.hit) { m.events.push({ type: r.hit === 'water' ? 'plop' : 'lost', x: shot.x, y: shot.y }); landed(m); }
      else if (shot.t > RULES.flightMax) { m.events.push({ type: 'lost', x: shot.x, y: shot.y }); landed(m); }
    }
  } else if (m.phase === 'retreat') {
    t.retreat -= dt;
    if (t.retreat <= 0 || !alive(active)) m.phase = 'settle';
  } else if (m.phase === 'settle') {
    t.settle += dt;
    if (m.capys.every(c => !alive(c) || settled(c)) || t.settle > RULES.settleMax) {
      const winner = winnerOf(m);
      if (winner !== null) finish(m, winner);
      else if (t.n >= RULES.turnLimit) finish(m, byCount(m), 'turns');
      else startTurn(m, teamAlive(m, 1 - t.team).length ? 1 - t.team : t.team);
    }
  }
}

function landed(m) { m.shot = null; m.phase = 'retreat'; m.turn.retreat = RULES.retreat; }

// Standings for the results screen: the winning team first, least paint first.
export function standings(m) {
  return [...m.capys].sort((a, b) => (b.team === m.winner) - (a.team === m.winner) || !!a.out - !!b.out || a.paint - b.paint);
}
