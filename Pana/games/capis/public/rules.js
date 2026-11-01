// Capis a Pintazos: turn-based paint artillery between two teams of three
// capybaras on destructible ground. Pure (no DOM, no Three.js): the game,
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
import { aimVelocity, stepFlight, stepBounce, FLIGHT } from '../../../engine/play/ballistic.js';
import { falloff } from '../../../engine/play/lob.js';
import { WEAPONS, FIRST_WEAPON, BASIC_WEAPON, weaponOf, reachOf, speedOf, anglesOf, startingAmmo } from './weapons.js';
import { draw, clamp } from '../../../engine/random.js';
import { generateMap, DEFAULT_SIZE } from './map-rules.js';

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
export function createMatch({ seconds = 35, difficulty = 'normal', seed = 2026, size = DEFAULT_SIZE, humans = [0], generated = null } = {}) {
  const { map, mask } = generated || generateMap(seed, size);
  const m = { map, mask, seed: map.seed >>> 0, phase: 'aim', winner: null, wind: 0, shot: null, events: [],
    options: { seconds: TURN_SECONDS.includes(seconds) ? seconds : 35, difficulty, size: map.size }, humans,
    last: [-1, -1], turn: null, clock: 0, shots: 0, shells: [], capys: [], ammo: [startingAmmo(), startingAmmo()], used: {} };
  map.spawns.forEach((xs, team) => xs.forEach((x, slot) => {
    m.capys.push({ id: `${team}-${slot}`, team, slot, name: NAMES[team][slot], x, y: surfaceY(mask, x) ?? map.height - 2, vx: 0, vy: 0,
      grounded: false, facing: team ? -1 : 1, aim: .55, paint: 0, out: null, jumpPress: 0, slide: 0, weapon: FIRST_WEAPON });
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
  // A capi keeps the weapon it last held while its team has shots of it; else La Piñita.
  if (!canUse(m, team, pick.weapon)) pick.weapon = BASIC_WEAPON;
  m.wind = Math.round((draw(m) * 2 - 1) * 10) / 10;
  m.turn = { n: (m.turn?.n || 0) + 1, team, capy: pick.id, time: m.options.seconds, retreat: 0, settle: 0 };
  m.phase = 'aim'; m.shot = null; m.shells = [];
  m.events.push({ type: 'turn', team, capy: pick.id });
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
  c.paint = Math.min(100, c.paint + paint);
  knock(c, vx, vy);
  m.events.push({ type: 'hit', capy: c.id, team: c.team, paint, by: team, weapon });
  if (c.paint >= 100) { c.out = 'paint'; m.events.push({ type: 'out', capy: c.id, team: c.team, reason: 'paint' }); }
}

// A shell bursts: a round crater, paint on the ground (La Bazuca's also runs
// down through the earth and throws blobs past the rim), paint and a push on
// every capi near it. `weapon` defaults to La Bazuca.
export function explode(m, x, y, team, weapon = FIRST_WEAPON, victim = null) {
  const w = weaponOf(weapon);
  carve(m.mask, x, y, w.crater);
  splash(m.mask, x, y, w.stain, team);
  if (w.drips) drips(m.mask, x, y, w.stain - .4, team, { seed: m.shots * 7919 + Math.round(x * 10) * 31 + Math.round(y * 10) });
  m.events.push({ type: 'blast', x, y, team, weapon: w.id, size: w.crater });
  hurt(m, x, y, w, team, victim);
}

// La Licuadora bores in where it strikes: a tunnel `tunnel.length` long along
// its flight (a capsule, terrain-mask.js carveLine), a lick of paint on its
// walls, a nudge and a little paint for any capi in the way. Aimed down at a
// rival's feet it opens a shaft under it; aimed level at a hill, a way through.
export function drill(m, x, y, vx, vy, team) {
  const w = weaponOf('drill'), { length, radius } = w.tunnel, l = Math.hypot(vx, vy) || 1, ux = vx / l, uy = vy / l;
  const x0 = x - ux * .4, y0 = y - uy * .4, x1 = x + ux * length, y1 = y + uy * length;
  carveLine(m.mask, x0, y0, x1, y1, radius);
  for (let k = 0; k <= 4; k++) splash(m.mask, x0 + (x1 - x0) * k / 4, y0 + (y1 - y0) * k / 4, radius + .5, team, 150);
  splash(m.mask, x1, y1, w.stain, team);
  m.events.push({ type: 'drill', x: x0, y: y0, x1, y1, team, weapon: w.id });
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, reach = radius + RULES.radius;
  for (const c of m.capys.filter(alive)) {
    const o = center(c), t = clamp(((o.x - x0) * dx + (o.y - y0) * dy) / l2, 0, 1);
    if (Math.hypot(o.x - x0 - dx * t, o.y - y0 - dy * t) >= reach) continue;
    hit(m, c, w.paint, team, ux * w.knock, Math.max(uy, .2) * w.knock, w.id);
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
    if (input.weapon && input.weapon !== active.weapon) selectWeapon(m, input.weapon);
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
      else if (t.n >= RULES.turnLimit) finish(m, byCount(m), 'turns');
      else startTurn(m, teamAlive(m, 1 - t.team).length ? 1 - t.team : t.team);
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
