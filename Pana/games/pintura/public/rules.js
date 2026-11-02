import { cleanKit, kitStats, grenadeDef, WEAPONS, ownsCamo, FALLBACK_CAMO, rangedDamage } from './armory-data.js';
import { createMelee, startSwing, stepMelee, swingHit, throwStart, stepThrown, aimThrow, inHand } from '../../../engine/play/melee.js';
import { canMoveSeats } from '../../../engine/play/seat-rules.js';
import { DEFAULT_OPTIONS, validOptions, teamPlay, roundTime, livesOf, objectivePlay } from './options.js';
import { isCtf, ctfReset, ctfStep, ctfDrop, ctfOutcome, ctfGoal, carrierSlow } from './ctf.js';
import { isDom, domReset, domStep, domOutcome, domBotGoal } from './domination.js';
import { paintArenaInfo, arenaLayout, ARENA_SPAWNS, validPaintArena } from '../../../engine/worlds/arena-layouts.js';
import { MUELLE_COVERS, MUELLE_SPAWNS, MUELLE_SIZE } from './muelle-layout.js';
import { NOCHE_COVERS, NOCHE_SPAWNS, NOCHE_SIZE } from './noche-layout.js';
import { TERMINAL_COVERS, TERMINAL_SPAWNS, TERMINAL_BOUNDS } from './terminal-layout.js';
import { PLAZA_COVERS } from './plaza-layout.js';
import { DEFAULT_DIFFICULTY, validDifficulty } from '../../../engine/play/difficulty.js';
import { clamp } from '../../../engine/random.js';
import { pickSpawn, pickRespawn, spreadSpawns, MIN_SPAWN_GAP } from './spawn-picker.js';
import { locKey } from '../../../engine/i18n.js';
import { resetJump, jumpCount } from '../../../engine/play/jump.js';
import { stepWalker, axisMove } from '../../../engine/play/walker.js';
import { returnToLobby } from '../../../engine/play/round-lobby.js';
import { segmentBox, launch, sweep } from '../../../engine/play/projectile.js';
import { shotHeight, headHit, aimedPitch } from '../../../engine/play/head-zone.js';
import { lobVelocity, stepLob, traceLob, touched, falloff, solveLob } from '../../../engine/play/lob.js';
import { applyCollisionFixes } from './collision-fixes.js';
export { segmentBox };

// Pepazo plays a 54 m court: every map's cover spreads 1.5× from the centre and
// an outer ring of barricades keeps the long perimeter lanes from staying open.
export const SIZE = 27, SPREAD = 1.5, DURATION = 180, TARGET = 10, SPEED = 7, RADIUS = .55, BALL_SPEED = 34;
// A round holds still until every pana has loaded its court (or READY_TIMEOUT
// seconds passed), then counts COUNTDOWN seconds down before anyone moves.
export const READY_TIMEOUT = 8, COUNTDOWN = 3;
// Level shots fly SHOT_HEIGHT m up (where the scene draws the ball): cover
// whose top is at or under it (sandbags, ammo piles, barrels, the snake bunkers)
// lets them pass over instead of standing as an invisible wall above it.
export const SHOT_HEIGHT = 1.1;
// Cover that stops a level shot: the boxes taller than the ball's flight.
export const shotCover = cover => cover.filter(o => o.shots !== false && (o.h ?? o.height ?? Infinity) > SHOT_HEIGHT);
// Eight seats (game.json `players`): people plus bots never pass it. Bot ids
// start at BOT_ID so they never collide with member seats.
export const SEATS = 8, BOT_ID = 1000, AUTO_BOTS = 3;
// How many bots a round seats for `humans` connected panas. 'auto' is the
// classic rule (AUTO_BOTS for a pana alone, none with friends); a number is
// capped by the free seats so a full room never overflows.
export function botCount(choice, humans, seats = SEATS) {
  const want = Number.isInteger(choice) ? choice : humans <= 1 ? AUTO_BOTS : 0;
  return Math.max(0, Math.min(want, seats - humans));
}
export const COLORS = ['#f28b42', '#29c5cd', '#d363a6', '#a1bd43', '#8d85df', '#f0c34c', '#ed615c', '#64b898'];
const RING = [[11, 21.5, 3.6, 1.6, 2], [-11, -21.5, 3.6, 1.6, 2], [-11, 21.5, 3.6, 1.6, 1.8], [11, -21.5, 3.6, 1.6, 1.8],
  [21.5, -11, 1.6, 3.6, 2], [-21.5, 11, 1.6, 3.6, 2], [21.5, 11, 1.6, 3.6, 1.8], [-21.5, -11, 1.6, 3.6, 1.8]].map(([x, z, w, d, h]) => ({ x, z, w, d, h, height: h }));
const spread = cover => [...cover.map(o => ({ ...o, x: o.x * SPREAD, z: o.z * SPREAD, w: o.w * 1.15, d: o.d * 1.15 })), ...RING];
// La Plaza (plaza-layout.js): its own three layouts, already at court scale.
export const COVER = PLAZA_COVERS[0];
export const SPAWNS = [{ x: -14, z: -14 }, { x: 14, z: 14 }, { x: 14, z: -14 }, { x: -14, z: 14 }, { x: 0, z: -15 }, { x: 0, z: 15 }, { x: -15, z: 0 }, { x: 15, z: 0 }].map(p => ({ x: p.x * SPREAD, z: p.z * SPREAD }));
const PAINT_SPAWNS = ARENA_SPAWNS.map(p => ({ x: p.x * SPREAD, z: p.z * SPREAD }));
// Bot marksmanship per difficulty: aim wobble (radians) and how much of the
// time a bot with a clear line keeps the trigger down (sine threshold), and how
// stale (seconds) the rival's position is when it aims: paintballs fly 85 m/s, so
// without that lag bots would rarely miss a strafing rival at range.
export const BOT_SKILL = { facil: { wobble: .16, trigger: .45, reaction: .15 }, normal: { wobble: .07, trigger: -.2, reaction: .4 }, dificil: { wobble: .035, trigger: -.5, reaction: .5 }, experto: { wobble: .012, trigger: -.8, reaction: .6 } };
// A thrown grenade leaves the hand 1.45 m up and 0.45 m ahead. Its elevation is
// the look's pitch (clamped to the camera's own limits) plus `lift`, so a level
// look still lobs at about 26 degrees. TICK is the simulation step, which the aim
// preview and the bots' throw search also use, so they predict the server exactly.
export const THROW = Object.freeze({ hand: 1.45, ahead: .45, lift: .45, down: -.7, up: .55 }), TICK = .05;
// A marker with `headshot` (La Lejana) shoots a ray from the eye (scene.js EYE) at
// the look's pitch. Where it meets a pana at HEAD_Y or higher (lifted by their jump)
// it is a head hit; lower is the body. Bots aim at CHEST_Y. A shot with no look
// (Ver la cancha, any non first-person view) gets a pitch from the server instead
// (engine/play/head-zone.js aimedPitch): at HEAD_AIM of the closest rival inside
// HEAD_CONE of its line when it passes within HEAD_WIDTH m of their centre, else
// at their chest; it only counts on the pana it was aimed at.
export const EYE = 1.55, HEAD_Y = 1.4, CHEST_Y = 1.1, HEAD_AIM = 1.6, HEAD_CONE = .12, HEAD_WIDTH = .25;
export { shotHeight };
export function cleanInput(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const num = n => Number.isFinite(n) ? clamp(n, -1, 1) : 0;
  const pitch = Number.isFinite(input.pitch) ? clamp(input.pitch, THROW.down, THROW.up) : 0, charge = Number.isFinite(input.charge) ? clamp(input.charge, 0, 1) : 0;
  let x = num(input.x), z = num(input.z), length = Math.hypot(x, z); if (length > 1) { x /= length; z /= length; }
  let ax = num(input.ax), az = num(input.az); length = Math.hypot(ax, az); if (length > .01) { ax /= length; az /= length; } else { ax = 0; az = -1; }
  // `alt` (also sent as `throw`) is the alternate attack: La Chancleta's throw.
  // `look` says a real pitch came (first person); without it no shot can reach a head.
  return { look: Number.isFinite(input.pitch), x, z, ax, az, weapon: WEAPONS.some(m => m.id === input.weapon) ? input.weapon : null, fire: input.fire === true, alt: input.alt === true || input.throw === true, aim: input.aim === true, reload: input.reload === true, sprint: input.sprint === true, grenade: input.grenade === true, pitch, charge, jump: jumpCount(input) };
}
// Where a thrown melee weapon leaves pana p's hand: like a grenade, 1.45 m up and
// 0.45 m ahead, never reaching through the cover p stands against.
export function handAt(p, ax, az, cover = []) {
  const length = Math.hypot(ax, az) || 1; ax /= length; az /= length;
  let ahead = THROW.ahead;
  for (const o of cover) { const t = segmentBox(p.x, p.z, ax * ahead, az * ahead, o, .15); if (t !== null) ahead = Math.min(ahead, Math.max(0, t * ahead - .02)); }
  return { x: p.x + ax * ahead, y: THROW.hand + (p.jumpHeight || 0), z: p.z + az * ahead, ax, az };
}
// A fresh melee state that keeps the swing and throw counts (clients play each one once).
const freshMelee = p => ({ ...createMelee(), swings: p.melee?.swings || 0, throws: p.melee?.throws || 0 });
export const spawnsFor = id => id === 'muelle' ? MUELLE_SPAWNS : id === 'noche' ? NOCHE_SPAWNS : id === 'terminal' ? TERMINAL_SPAWNS : arenaLayout(id) ? PAINT_SPAWNS : SPAWNS;
// Half-extents of each map's court. Most are square; El Puerto runs long between its two bases.
const BOUNDS = new Map([['muelle', { x: MUELLE_SIZE, z: MUELLE_SIZE }], ['noche', { x: NOCHE_SIZE, z: NOCHE_SIZE }], ['terminal', TERMINAL_BOUNDS]]);
export const boundsFor = id => BOUNDS.get(id) || { x: SIZE, z: SIZE };
// The larger half-extent, for whatever frames the whole court.
export const sizeFor = id => { const { x, z } = boundsFor(id); return Math.max(x, z); };
const outside = (id, x, z, margin = 0) => { const b = boundsFor(id); return Math.abs(x) > b.x - margin || Math.abs(z) > b.z - margin; };
// Where and how fast pana p's grenade leaves the hand for a clean input
// ({ ax, az, pitch, charge }): the server's throw, the aim preview and the bots
// all start here. The hand never reaches through cover the pana stands against.
export function grenadeStart(p, { ax = 0, az = -1, pitch = 0, charge = 0 }, kind, cover = []) {
  const def = grenadeDef(kind), [slow, fast] = def.speed, hand = handAt(p, ax, az, cover);
  const elevation = clamp(pitch, THROW.down, THROW.up) + THROW.lift;
  return { x: hand.x, y: hand.y, z: hand.z, ...lobVelocity(hand.ax, hand.az, elevation, slow + (fast - slow) * clamp(charge, 0, 1)) };
}
// The bounce rules of a grenade kind on map `mapId` (no map: open ground, for range sums).
export function grenadeFlight(kind, cover = [], mapId = null) {
  const def = grenadeDef(kind);
  return { boxes: cover, bounds: mapId ? boundsFor(mapId) : null, restitution: def.restitution ?? .4, friction: def.friction ?? .7, roll: def.roll ?? 3, sticky: !!def.sticky };
}
// Every map has three fixed layouts and the round number picks one, so a rematch
// plays a different court. Not random: everyone learns them.
export const VARIANTS = 3;
// Spanish keys: clients show them with loc().
const VARIANT_NAMES = { muelle: [locKey('Patio'), locKey('Laberinto'), locKey('Torres')], terminal: [locKey('Pasillos'), locKey('Fortaleza'), locKey('Laberinto')], noche: [locKey('Torre'), locKey('Inflables'), locKey('Tubos')], plaza: [locKey('Clásica'), locKey('Mercado'), locKey('Fiesta')], default: [locKey('Clásica'), locKey('Girada'), locKey('Cerrada')] };
export const variantName = (id, variant = 0) => (VARIANT_NAMES[id] || VARIANT_NAMES.default)[variant % VARIANTS];
const gap = (a, b) => Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2, Math.abs(a.z - b.z) - (a.d + b.d) / 2);
// "Girada" turns the cover a quarter; the spawns and ring are symmetric under it.
const rotate = cover => cover.map(o => ({ ...o, x: o.z, z: -o.x, w: o.d, d: o.w }));
// "Cerrada" fills open lanes with crate stacks wherever they keep 2.4 m passages.
const FILL = [[7.5, 15], [15, 7.5], [0, 15], [15, 0], [7.5, 7.5], [18, 18], [0, 7.5], [7.5, 0], [22, 4], [4, 22]]
  .flatMap(([x, z]) => [[x, z], [-x, -z], [-z, x], [z, -x]]);
function closed(cover, id) {
  const all = [...cover], size = sizeFor(id);
  for (const [x, z] of FILL) {
    const o = { x, z, w: 2.6, d: 2.6, h: 2.65, height: 2.65 };
    if (all.every(c => gap(c, o) >= 2.4) && size - Math.max(Math.abs(x), Math.abs(z)) - 1.3 >= 2.4
      && spawnsFor(id).every(s => Math.abs(s.x - x) > 3.6 || Math.abs(s.z - z) > 3.6)) all.push(o);
  }
  return all;
}
const covers = new Map();
export function coverFor(id, variant = 0) {
  variant = Number.isInteger(variant) ? ((variant % VARIANTS) + VARIANTS) % VARIANTS : 0;
  const key = `${id}:${variant}`; if (covers.has(key)) return covers.get(key);
  let cover;
  if (id === 'muelle') cover = MUELLE_COVERS[variant];
  else if (id === 'noche') cover = NOCHE_COVERS[variant];
  else if (id === 'terminal') cover = TERMINAL_COVERS[variant];
  else if (!arenaLayout(id)) cover = PLAZA_COVERS[variant];
  else { const base = spread(arenaLayout(id).cover); cover = [base, rotate(base), closed(base, id)][variant]; }
  // The collision audit's fixes (collision-fixes.js) fit boxes to what the scene shows.
  cover = applyCollisionFixes(id, variant, cover);
  covers.set(key, cover); return cover;
}
export function blocked(x, z, radius = RADIUS, mapId = 'plaza', variant = 0) {
  return outside(mapId, x, z, radius) || coverFor(mapId, variant).some(o => Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}
// Bots walk to rivals they cannot see: open 1 m cells per layout, and a
// breadth-first distance field from the target's cell, refreshed twice a second.
const grids = new Map();
function navGrid(id, variant) {
  const key = `${id}:${variant}`; if (grids.has(key)) return grids.get(key);
  const b = boundsFor(id), nx = Math.floor(b.x * 2), nz = Math.floor(b.z * 2), open = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) open[j * nx + i] = blocked(i + .5 - b.x, j + .5 - b.z, .6, id, variant) ? 0 : 1;
  const grid = { b, nx, nz, open, cell: (x, z) => clamp(Math.floor(z + b.z), 0, nz - 1) * nx + clamp(Math.floor(x + b.x), 0, nx - 1) };
  grids.set(key, grid); return grid;
}
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function distanceField(grid, target) {
  const { nx, nz, open } = grid, far = new Int32Array(nx * nz).fill(-1), queue = new Int32Array(nx * nz); let head = 0, tail = 0;
  far[target] = 0; queue[tail++] = target;
  while (head < tail) {
    const c = queue[head++], i = c % nx, j = (c - i) / nx;
    for (const [di, dj] of STEPS.slice(0, 4)) { const a = i + di, b = j + dj, n = b * nx + a; if (a >= 0 && b >= 0 && a < nx && b < nz && open[n] && far[n] < 0) { far[n] = far[c] + 1; queue[tail++] = n; } }
  }
  return far;
}
export class Arena {
  constructor(mapId = 'terminal', difficulty = DEFAULT_DIFFICULTY, options = {}) { this.options = { ...DEFAULT_OPTIONS, ...(validOptions(options) ? options : {}) }; this.flags = []; this.flagEvents = []; this.flagSerial = 0; this.zones = []; this.zoneEvents = []; this.zoneSerial = 0; this.domBank = [0, 0]; this.outcome = null; this.teamScores = [0, 0]; this.mapId = paintArenaInfo(mapId).id; this.variant = 0; this.events = []; this.eventSerial = 0; this.difficulty = validDifficulty(difficulty) ? difficulty : DEFAULT_DIFFICULTY; this.phase = 'lobby'; this.players = []; this.balls = []; this.splats = []; this.grenades = []; this.thrown = []; this.puddles = []; this.booms = []; this.time = DURATION; this.round = 0; this.serial = 0; this.message = locKey('La cancha está lista.'); this.messageVars = null; this.loading = 0; this.countdown = 0; this.ready = new Set(); this.random = Math.random; this.camoOwners = new Map(); }
  // A camo the seat does not own falls back to the first solid one (camoRefusal names it for the client).
  selectKit(id, value) { const p=this.players.find(p=>p.id===id && p.connected); if(!p || this.phase==='playing') return false; p.kit=cleanKit(value); if(!ownsCamo(p.kit.camo,this.camoOwners.get(id))) p.kit.camo=FALLBACK_CAMO; p.weapon=p.kit.weapon; return true; }
  // The camos a seat owns beyond the solid ones: the room passes the gateway's signed list, practice the local one.
  // Never in view(): what someone owns is not broadcast.
  setCamos(id, owned) { this.camoOwners.set(id, new Set(owned || [])); }
  // The camo id `value` asks for that this seat does not own ('' when it may wear it).
  camoRefusal(id, value) { const camo=cleanKit(value).camo; return ownsCamo(camo,this.camoOwners.get(id)) ? '' : camo; }
  // Why selectKit would refuse this seat right now ('' when it would accept): the client says so instead of dropping the pick.
  kitRejection(id) { return !this.players.some(p=>p.id===id && p.connected) ? 'absent' : this.phase==='playing' ? 'playing' : ''; }
  configure(options) { if (this.phase === 'playing' || !validOptions(options)) return false; Object.assign(this.options, options); this.players.forEach(p => { p.color = COLORS[teamPlay(this.options) ? p.team : p.seat]; }); this.parkLobby(); return true; }
  moveSeat(actorId, from, to, hostId) {
    if (!['lobby', 'finished'].includes(this.phase) || !teamPlay(this.options)) return false;
    const seats = paintSeats(this.players);
    if (!canMoveSeats(seats, from, to, actorId, hostId) || !this.players.some(p => p.connected && p.id === actorId)) return false;
    [seats[from], seats[to]] = [seats[to], seats[from]];
    seats.forEach((p, seat) => { if (p) Object.assign(p, { seat, team: seat % 2, color: COLORS[seat % 2] }); });
    return true;
  }
  canStart() { const people = this.players.filter(p => p.connected); return !teamPlay(this.options) || people.length < 2 || new Set(people.map(p => p.team)).size === 2; }
  get cover() { return coverFor(this.mapId, this.variant); }
  sameTeam(a, b) { return teamPlay(this.options) && a?.team === b?.team; }
  selectMap(id) {
    if (this.phase !== 'lobby' || !validPaintArena(id)) return false;
    this.mapId = id; this.players.forEach((p, i) => Object.assign(p, spawnsFor(id)[i % 8])); this.parkLobby(); return true;
  }
  selectDifficulty(id) {
    if (this.phase === 'playing' || !validDifficulty(id)) return false;
    this.difficulty = id; return true;
  }
  // `want` is a preferred free seat (seatBots balances teams with it).
  add(id, info, want) {
    let p = this.players.find(p => p.id === id);
    const occupied = this.players.filter(other => other !== p && other.connected).map(other => other.seat);
    const free = Array.from({ length: SEATS }, (_, i) => i).filter(i => !occupied.includes(i));
    const seat = p && !occupied.includes(p.seat) ? p.seat : free.includes(want) ? want : free[0];
    if (seat === undefined) return null;
    const team = seat % 2, color = COLORS[teamPlay(this.options) ? team : seat];
    // Arriving after the wait (mid-countdown or mid-round) counts as ready.
    if (this.phase === 'playing' && !this.loading) this.ready.add(id);
    if (p) { Object.assign(p, info, { connected: true, seat, team, color }); this.parkLobby(); return p; }
    p = { id, ...info, connected: true, seat, team, eliminated: false, slow: 0, weapon: 'pistol', kit: cleanKit(), grenadeReady: true, grenadeHeld: false, altHeld: false, melee: createMelee(), smacks: 0, recalls: 0, shots: 0, fired: 0, jumpPress: 0, jumpHeight: 0, jumpVelocity: 0, reserve: 0, ...spawnsFor(this.mapId)[this.players.length % 8], ax: 0, az: -1, score: 0, hits: 0, paint: 0, stains: [], calm: 0, streak: 0, nemesis: null, stamina: 1, sprint: false, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5, color };
    this.players.push(p);
    // A late arrival mid-round lands like a respawn, away from the living rivals.
    if (this.phase === 'playing') Object.assign(p, this.spawnPoint(p, this.rivalsOf(p))); else this.parkLobby();
    return p;
  }
  // Seats this round's bots from the `bots` option: the old bots leave, then
  // botCount() new ones join, each on the smaller team in team and flag
  // rounds. `make(i)` gives bot i its name and avatar. Lobby only.
  seatBots(make) {
    if (this.phase !== 'lobby') return 0;
    this.players = this.players.filter(p => !p.bot && p.connected);
    const count = botCount(this.options.bots, this.players.length), teams = teamPlay(this.options);
    for (let i = 0; i < count; i++) {
      const people = this.players.filter(p => p.connected), taken = new Set(people.map(p => p.seat));
      const free = Array.from({ length: SEATS }, (_, s) => s).filter(s => !taken.has(s));
      const size = team => people.filter(p => p.team === team).length;
      const team = size(0) === size(1) ? free[0] % 2 : size(0) < size(1) ? 0 : 1;
      this.add(BOT_ID + i, { ...make(i), bot: true }, teams ? free.find(s => s % 2 === team) : free[0]);
    }
    return count;
  }
  // "Otra ronda": back to the lobby so the host can pick the next map. The
  // round count stays, so the next court still rotates its layout.
  toLobby({ keepBots = false } = {}) {
    return returnToLobby(this, { keepBots, reset: g => {
      Object.assign(g, { survivors: null, outcome: null, flagEvents: [], loading: 0, countdown: 0, time: roundTime(g.options), balls: [], splats: [], grenades: [], thrown: [], puddles: [], booms: [], flags: [], zones: [], zoneEvents: [], teamScores: [0, 0] }); g.ready = new Set();
      g.players.forEach((p, i) => Object.assign(p, spawnsFor(g.mapId)[i % 8], { respawn: 0, eliminated: false })); g.parkLobby();
      g.say(locKey('La cancha está lista.'));
    } });
  }
  // Only from the lobby: a finished round goes through toLobby() first.
  start() {
    if (this.phase !== 'lobby' || !this.canStart()) return false;
    this.players = this.players.filter(p => p.connected); this.phase = 'playing'; this.survivors = null; this.round++; this.variant = (this.round - 1) % VARIANTS; this.time = roundTime(this.options); this.teamScores = [0, 0]; this.outcome = null; ctfReset(this); domReset(this); this.balls = []; this.splats = []; this.grenades = []; this.thrown = []; this.puddles = []; this.booms = [];
    this.players.forEach((p, i) => Object.assign(p, { eliminated: false, slow: 0, color: teamPlay(this.options) ? COLORS[p.team] : COLORS[i % 8], score: 0, hits: 0, paint: 0, stains: [], calm: 0, streak: 0, nemesis: null, stamina: 1, sprint: false, ammo: 12, reload: 0, cooldown: 0, respawn: 0, shield: 1.5, jumpHeight: 0, jumpVelocity: 0, jumpPending: false }));
    this.players.forEach(p => this.refill(p));
    if (this.teamRound) {
      // One by one, so each pana spawns away from the rivals already placed and on a free spot of its side.
      const placed = [];
      for (const p of this.players) { Object.assign(p, this.spawnPoint(p, placed.filter(q => !this.sameTeam(p, q)), placed.map(q => q.spawn))); placed.push(p); }
    } else this.spread(this.random);
    this.ready = new Set(); this.loading = READY_TIMEOUT; this.countdown = 0; this.checkReady();
    this.say(locKey('¡A pintar! Cancha {variant}.'), { variant: variantName(this.mapId, this.variant) }); return true;
  }
  // Nothing moves, fires or takes paint, and the clock waits, until the 3-2-1 ends.
  get live() { return this.phase === 'playing' && !this.loading && !this.countdown; }
  // A pana's client loaded this round's court. Bots never wait; nor do rounds without people.
  markReady(id, round) {
    if (this.phase !== 'playing' || !this.loading || !Number.isInteger(round) || round !== this.round || !this.players.some(p => p.id === id && p.connected && !p.bot)) return false;
    this.ready.add(id); this.checkReady(); return true;
  }
  checkReady() { if (this.loading && this.players.every(p => p.bot || !p.connected || this.ready.has(p.id))) { this.loading = 0; this.countdown = COUNTDOWN; } }
  // Skip the wait and the countdown: the armory's range and tests that only exercise play.
  go() { this.loading = this.countdown = 0; }
  freezeJumps(inputs) { for (const p of this.players) if (!p.bot) resetJump(p, inputs.get(p.id)); }
  refill(p) { const stats=kitStats(p.kit,this.options); p.ammo=stats.magazine; p.reserve=stats.reserve ?? 0; p.weapon=stats.id; p.grenadeReady=true; p.grenadeHeld=false; p.lobAt=null; p.shots=0; p.melee=freshMelee(p); }
  // Respawn protection: 1.5 s of shield (the ring blinks in the scene) so nobody is
  // painted on arrival; firing or throwing cancels it early.
  respawn(p) {
    const spawn = this.spawnPoint(p, this.rivalsOf(p));
    Object.assign(p, spawn, { ammo: 12, reload: 0, cooldown: 0, shield: 1.5, paint: 0, soak: 0, stains: [], calm: 0, stamina: 1, jumpHeight: 0, jumpVelocity: 0, jumpPending: false }); this.refill(p);
  }
  // A spawn far from these rivals, out of their sight if possible and not p's last one.
  // Team rounds keep each side on its own half of the spawns: even indices are team 0's
  // (El Puerto's west base and the orange flag), odd ones team 1's.
  // Free-for-all goes distance first (pickRespawn: MIN_SPAWN_GAP from the nearest rival when a spawn allows it).
  spawnPoint(p, enemies, taken = []) {
    const spawns = spawnsFor(this.mapId), teams = this.teamRound;
    const sees = (e, s) => !this.cover.some(o => segmentBox(e.x, e.z, s.x - e.x, s.z - e.z, o) !== null);
    const options = { enemies, taken, last: p.spawn ?? -1, allowed: teams ? spawns.map((_, i) => i).filter(i => i % 2 === p.team) : null, sees, rng: this.random };
    p.spawn = teams ? pickSpawn(spawns, options) : pickRespawn(spawns, options);
    const { x, z } = spawns[p.spawn]; return { x, z };
  }
  get teamRound() { return teamPlay(this.options); }
  // The living rivals p must keep away from.
  rivalsOf(p) { return this.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated && !this.sameTeam(p, q)); }
  // Free-for-all round start: every pana on its own spawn, all of them at least
  // MIN_SPAWN_GAP apart (or as far apart as the court allows), people before bots
  // on the most isolated spots. spawnReport says what the court managed; set
  // PANA_LOG_SPAWNS (or arena.logSpawns) to print it once per round.
  spread(rng, log = true) {
    const spawns = spawnsFor(this.mapId), people = this.players.filter(p => !p.bot), bots = this.players.filter(p => p.bot);
    const { indices, minGap, fallback } = spreadSpawns(spawns, this.players.length, { rng, first: people.length });
    [...people, ...bots].forEach((p, k) => { p.spawn = indices[k]; Object.assign(p, spawns[indices[k]]); });
    this.spawnReport = { arena: this.mapId, count: this.players.length, minGap: Math.round(minGap * 10) / 10, fallback, gap: MIN_SPAWN_GAP };
    if (log && (this.logSpawns ?? globalThis.process?.env?.PANA_LOG_SPAWNS)) console.log(`pepazo spawns ${JSON.stringify(this.spawnReport)}`);
  }
  // Lobby: free-for-all panas wait on the spots a round would spread them to (no rng drawn).
  parkLobby() { if (!this.teamRound && this.phase === 'lobby' && this.players.length) this.spread(() => 0, false); }
  // A unit step for bot p along open cells toward (tx, tz), or null when no route is known.
  route(p, tx, tz) {
    const grid = navGrid(this.mapId, this.variant), target = grid.cell(tx, tz);
    this.routes ||= new Map(); let route = this.routes.get(p.id);
    if (!route || route.map !== `${this.mapId}:${this.variant}` || (route.target !== target && route.time - this.time > .5)) {
      route = { map: `${this.mapId}:${this.variant}`, target, time: this.time, far: distanceField(grid, target) }; this.routes.set(p.id, route);
    }
    const { nx, nz, open } = grid, here = grid.cell(p.x, p.z), i = here % nx, j = (here - i) / nx; let best = null, score = route.far[here] >= 0 ? route.far[here] : Infinity;
    for (const [di, dj] of STEPS) {
      const a = i + di, b = j + dj, n = b * nx + a;
      if (a < 0 || b < 0 || a >= nx || b >= nz || route.far[n] < 0 || (di && dj && (!open[j * nx + a] || !open[b * nx + i]))) continue;
      const cost = route.far[n] + (di && dj ? .4 : 0); if (cost < score) { score = cost; best = n; }
    }
    if (best === null) return null;
    const x = best % nx + .5 - grid.b.x - p.x, z = Math.floor(best / nx) + .5 - grid.b.z - p.z, length = Math.hypot(x, z) || 1;
    return { x: x / length, z: z / length };
  }
  // Where bot p thinks rival q is: a sample of q refreshed every `reaction` seconds.
  botAim(p, q, reaction) {
    const book = this.botSight ||= new Map(), now = DURATION - this.time, seen = book.get(p.id);
    if (!seen || seen.id !== q.id || now - seen.at >= reaction || now < seen.at) book.set(p.id, { id: q.id, x: q.x, z: q.z, at: now });
    return book.get(p.id);
  }
  bot(p) {
    const enemies = this.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated && !this.sameTeam(p, q)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const q = enemies[0]; if (!q) return cleanInput();
    const dx = q.x - p.x, dz = q.z - p.z, length = Math.hypot(dx, dz) || 1;
    const clear = !shotCover(this.cover).some(o => segmentBox(p.x, p.z, dx, dz, o) !== null);
    const t = (DURATION - this.time) * .7 + p.id, strafe = Math.sin(t) > 0 ? 1 : -1, skill = BOT_SKILL[this.difficulty] || BOT_SKILL.normal;
    // A deterministic wobble around the true line: weaker bots spray, sharp ones rarely miss.
    const ref = this.botAim(p, q, skill.reaction), rx = ref.x - p.x, rz = ref.z - p.z, rl = Math.hypot(rx, rz) || 1;
    const wobble = Math.sin(t * 2.3 + p.id * 1.7) * skill.wobble, aimX = rx / rl * Math.cos(wobble) - rz / rl * Math.sin(wobble), aimZ = rx / rl * Math.sin(wobble) + rz / rl * Math.cos(wobble);
    let x = clear ? dx / length * (length > 9 ? .8 : -.25) - dz / length * strafe * .6 : Math.cos(t * .6);
    let z = clear ? dz / length * (length > 9 ? .8 : -.25) + dx / length * strafe * .6 : Math.sin(t * .6);
    // Capture the flag (ctf.js ctfGoal) or domination (domination.js domBotGoal): walk the lanes to the bot's goal; inside `near` m it fights as usual.
    const goal = (isCtf(this.options) && ctfGoal(this, p)) || (isDom(this.options) && domBotGoal(this, p)), gx = goal && goal.x - p.x, gz = goal && goal.z - p.z, gd = goal ? Math.hypot(gx, gz) || 1 : 0;
    // A rival out of sight and far away, and no objective to walk to: walk the open lanes toward them.
    const hunt = !clear && length > 12 && !isCtf(this.options) && !goal && this.route(p, q.x, q.z);
    if (hunt) ({ x, z } = hunt);
    else if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { x = -dz / length; z = dx / length; }
    if (goal && gd > goal.near) {
      x = gx / gd; z = gz / gd;
      const step = gd > 2 && this.route(p, goal.x, goal.z); if (step) ({ x, z } = step);
      else if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { const swap = x; x = -z; z = swap; }
    }
    const stats = kitStats(p.kit, this.options);
    if (stats.melee) return this.meleeBot(p, q, { clear, length, x, z, ax: aimX, az: aimZ, fire: Math.sin(t * 3) > skill.trigger }, stats);
    const lob = this.botGrenade(p, q, clear);
    // A headshot marker aims at the chest, so bots do not knock out with every shot.
    const chest = stats.headshot ? { pitch: -Math.atan((EYE - CHEST_Y) / length) } : {};
    return cleanInput({ ...chest, x, z, ax: aimX, az: aimZ, fire: !lob && clear && length < 34 && Math.sin(t * 3) > skill.trigger, reload: p.ammo < 3 && !clear, ...lob });
  }
  // A bot holding a melee weapon walks straight at the nearest rival it can see and
  // swings once inside the reach. With a throwable one (La Chancleta) it throws at a
  // rival 5–22 m away in sight, pitched by aimThrow; the recall is its cooldown.
  meleeBot(p, q, { clear, length, x, z, ax, az, fire }, stats) {
    if (clear && !objectivePlay(this.options)) {
      x = (q.x - p.x) / length; z = (q.z - p.z) / length;
      if (blocked(p.x + x * 1.4, p.z + z * 1.4, RADIUS, this.mapId, this.variant)) { const swap = x; x = -z; z = swap; }
    }
    const shot = stats.throwable && fire && clear && length > 5 && length < 22 && p.melee.phase === 'ready' && aimThrow(stats, length);
    return cleanInput({ x, z, ax, az, fire: clear && length - RADIUS <= stats.reach * .95, alt: !!shot, pitch: shot ? shot.pitch : 0 });
  }
  // A throw from p that blows up at (tx, tz), solved with the server's own flight
  // on open ground: { ax, az, pitch, charge, x, z } with where it would really blow
  // (cover and the fence included), or null when no throw gets close.
  aimGrenade(p, tx, tz) {
    const def = grenadeDef(p.kit.grenade), dx = tx - p.x, dz = tz - p.z, distance = Math.hypot(dx, dz);
    if (distance < .5) return null;
    const ax = dx / distance, az = dz / distance, open = grenadeFlight(def.id), at = { x: 0, z: 0 }, path = { time: def.fuse, dt: TICK, out: [], land: true };
    const reach = (pitch, charge) => traceLob(grenadeStart(at, { ax: 1, az: 0, pitch, charge }, def.id), open, path).x;
    const shot = solveLob(reach, distance, { pitches: [0, -.2, -.4, -.55, -.7, .25, .5], tolerance: .5 });
    if (!shot) return null;
    const input = { ax, az, pitch: shot.pitch, charge: shot.power }, end = traceLob(grenadeStart(p, input, def.id, this.cover), grenadeFlight(def.id, this.cover, this.mapId), path);
    return { ...input, x: end.x, z: end.z };
  }
  // Bots throw their grenade only at a rival 6–28 m away that they can see or
  // that hides right behind cover, and only when the solved throw lands the blast
  // on them. They look again every two seconds, never in the first three of a life.
  botGrenade(p, q, clear) {
    const now = DURATION - this.time;
    if (!p.grenadeReady || !this.live) return null;
    if (p.lobAt == null) { p.lobAt = now + 3; return null; }
    if (now < p.lobAt) return null;
    p.lobAt = now + 2;
    const distance = Math.hypot(q.x - p.x, q.z - p.z), def = grenadeDef(p.kit.grenade);
    const hiding = !clear && this.cover.some(o => Math.abs(q.x - o.x) < o.w / 2 + 2.5 && Math.abs(q.z - o.z) < o.d / 2 + 2.5);
    if (distance < 6 || distance > 28 || !(clear || hiding)) return null;
    const aim = this.aimGrenade(p, q.x, q.z);
    if (!aim || Math.hypot(aim.x - q.x, aim.z - q.z) > def.radius * .6) return null;
    return { ax: aim.ax, az: aim.az, pitch: aim.pitch, charge: aim.charge, grenade: true };
  }
  step(dt, inputs = new Map()) {
    if (this.phase !== 'playing') return; dt = clamp(dt, 0, .05);
    // A press made while everything is frozen is spent, not saved for the YA.
    if (this.loading) { this.freezeJumps(inputs); this.loading = Math.max(0, this.loading - dt); if (this.loading) this.checkReady(); else this.countdown = COUNTDOWN; return; }
    if (this.countdown) { this.freezeJumps(inputs); this.countdown = Math.max(0, this.countdown - dt); return; }
    this.time = Math.max(0, this.time - dt);
    for (const p of this.players) {
      if (!p.connected || p.eliminated) continue;
      p.slow = Math.max(0, (p.slow || 0) - dt);
      if (p.respawn > 0) { p.respawn = Math.max(0, p.respawn - dt); resetJump(p, inputs.get(p.id)); if (!p.respawn) this.respawn(p); continue; }
      p.shield = Math.max(0, p.shield - dt); p.cooldown = Math.max(0, p.cooldown - dt);
      // Paint wears off after four quiet seconds, one pepazo every 1.5 s.
      if ((p.paint > 0 || p.soak > 0) && (p.calm += dt) >= 4) { if (p.paint > 0) { p.paint--; p.stains = p.stains.slice(1); } p.soak = 0; p.calm = 2.5; }
      let stats=kitStats(p.kit,this.options);
      if (p.reload > 0) { p.reload = Math.max(0, p.reload - dt); if (!p.reload) { p.ammo = stats.reserve != null ? Math.min(stats.magazine,p.reserve) : stats.magazine; if(stats.reserve != null) p.reserve-=p.ammo; } }
      const input = p.bot ? this.bot(p) : cleanInput(inputs.get(p.id));
      // A thrown chancla has to come back before the pana can change weapon.
      if(input.weapon && input.weapon !== p.kit.weapon && this.options.weapons !== 'pistol' && inHand(p.melee)) {
        // Parts that do not fit the new marker come off, exactly as the client's armory drops them.
        p.kit=cleanKit({...p.kit,weapon:input.weapon}); stats=kitStats(p.kit,this.options);
        p.ammo=Math.min(p.ammo,stats.magazine); p.reserve=0;
        if(p.shots>0 && !stats.melee) { p.ammo=0; p.reload=stats.reload; }
        // A switch mid-swing drops the blow but not the wait.
        if(p.melee.phase==='windup') { p.melee.phase='recover'; p.melee.t+=.3; }
      }
      p.weapon=stats.id;
      if(stats.melee) {
        const event=stepMelee(p.melee,stats,dt);
        if(event==='strike') this.strike(p,stats);
        if(event==='return') p.recalls++;
        if(input.alt && !p.altHeld) this.throwMelee(p,input,stats);
      }
      p.altHeld=input.alt;
      if(input.grenade && !p.grenadeHeld && p.grenadeReady) this.throwGrenade(p,input);
      p.grenadeHeld=input.grenade;
      p.ax = input.ax; p.az = input.az;
      // A scope (La Lejana, El Zamuro) or a Mira steadies the shot and halves the walk while it is up.
      p.aim = input.aim && stats.aims;
      // Shift sprints 45% faster for up to three seconds; sprinting holds fire. A flag carrier is slower (ctf.js).
      const walk = SPEED * stats.mobility * (p.slow > 0 ? .45 : 1) * (p.aim ? .5 : 1) * carrierSlow(this, p);
      const sprinting = stepWalker(p, input, dt, { walk, run: walk * 1.45, canSprint: !!stats.sprint && !input.fire && !p.aim, regen: 5, move: axisMove((x, z) => blocked(x, z, RADIUS, this.mapId, this.variant)) }).sprinting; p.sprint = sprinting;
      p.walk = !!(input.x || input.z);
      if ((input.reload || p.ammo === 0) && !p.reload && p.ammo < stats.magazine && (stats.reserve == null || p.reserve > 0)) p.reload = stats.reload;
      // Melee: the trigger swings (no ammo); the blow lands when the windup ends.
      if (stats.melee) { if (input.fire && !sprinting && startSwing(p.melee, stats)) p.shield = 0; }
      else if (input.fire && !sprinting && !p.cooldown && !p.reload && p.ammo > 0) {
        const rivals=stats.headshot && !input.look ? this.shotTargets(p) : null;
        p.ammo--; p.shots++; p.fired++; p.cooldown=stats.cadence; p.shield=0;
        const spread=p.aim && stats.aimSpread!=null ? stats.aimSpread : stats.spread;
        const jitter=stats.pellets===1 ? Math.sin(p.shots*2.4)*spread : 0;
        // Several pellets fan evenly across the spread (three: left, centre, right).
        const angles=stats.pellets>1 ? Array.from({length:stats.pellets},(_,i)=>spread*(2*i/(stats.pellets-1)-1)) : [jitter];
        for(const angle of angles) {
          const flight=launch(p.ax, p.az, stats.speed, angle), y0=EYE + (p.jumpHeight || 0);
          // A headshot marker fired without a look: the server's own pitch at the rival it is aimed at.
          const aimed=rivals && aimedPitch({ x:p.x, z:p.z, y0 }, { x:flight.vx, z:flight.vz }, rivals, { cone:HEAD_CONE, width:HEAD_WIDTH, head:HEAD_AIM, chest:CHEST_Y });
          this.balls.push({ id:++this.serial, owner:p.id, color:p.color, x:p.x, z:p.z, ...flight,
          life:stats.life, kind:stats.id, rocket:!!stats.splash, direct:!!stats.direct, damage:stats.damage, falloff:stats.falloff || null, splash:stats.splash || 0, pattern:p.kit.pattern, hand:p.weapon==='rapid'?p.shots%2:0,
          // Where it left (damage fades with the distance flown) and, for a headshot marker,
          // the eye height and pitch its ray climbs or drops at (`aimed`: the pana a derived pitch is for).
          x0:p.x, z0:p.z, y0, pitch:stats.headshot && input.look ? input.pitch : aimed ? aimed.pitch : null, aimed:aimed ? aimed.target : null });
        }
      }
    }
    for (const ball of this.balls) {
      const owner = this.players.find(q => q.id === ball.owner);
      const targets = this.shotTargets(owner, ball.owner);
      const { t, victim, dx, dz } = sweep(ball, dt, { boxes: this.cover, targets, padding: .12, y: SHOT_HEIGHT });
      ball.x += dx * Math.min(1, t); ball.z += dz * Math.min(1, t); ball.life -= dt;
      if (t <= 1 || outside(this.mapId, ball.x, ball.z)) {
        ball.life = 0; this.splats.push({ id: ball.id, x: ball.x, z: ball.z, color: ball.color, life: 9, pattern: ball.pattern });
        // La Bazuca's direct hit knocks out at once; its splash then catches only the panas beside.
        // La Lejana's head hit knocks out too; its body hits fade with the distance flown.
        if (victim && (ball.direct || !ball.rocket)) {
          const travel = Math.hypot(ball.x - ball.x0, ball.z - ball.z0), head = (ball.aimed == null || ball.aimed === victim.id) && headHit(ball, travel, HEAD_Y, victim.jumpHeight || 0);
          this.hit(victim, owner, ball.color, { x: ball.vx, z: ball.vz, weapon: ball.kind, ...(head ? { zone: 'head', headshot: true } : {}) }, ball.direct || head ? Infinity : rangedDamage(ball, travel));
        }
        if (ball.rocket) this.blast(ball,ball.splash);
      }
    }
    for(const ball of this.balls) if(ball.rocket && ball.life<=0 && !ball.exploded) this.blast(ball,ball.splash);
    this.stepGrenades(dt); this.flyThrown(dt);
    this.balls = this.balls.filter(b => b.life > 0); this.booms = this.booms.filter(b => (b.life -= dt) > 0); this.splats = this.splats.filter(s => (s.life -= dt) > 0).slice(-64);
    if (isCtf(this.options)) ctfStep(this, dt);
    if (isDom(this.options)) domStep(this, dt);
    const alive = this.players.filter(p => p.connected && !p.eliminated), teams = teamPlay(this.options);
    const eliminatedEnd = livesOf(this.options) > 0 && this.players.some(p => p.eliminated) && this.players.length > 1 && (teams ? new Set(alive.map(p => p.team)).size <= 1 : alive.length <= 1);
    if (eliminatedEnd) this.survivors = alive.map(p => p.id);
    const ctf = (isCtf(this.options) && ctfOutcome(this)) || (isDom(this.options) && domOutcome(this)); if (ctf) this.outcome = ctf;
    if (ctf || this.time <= 0 || eliminatedEnd || (!objectivePlay(this.options) && (teams ? this.teamScores.some(s => s >= TARGET) : this.players.some(p => p.score >= TARGET)))) { this.phase = 'finished'; this.balls = []; this.thrown = []; }
  }
  // The grenade leaves the hand on release (its fuse starts then: a held grenade
  // never cooks, so lag can never blow one up in a pana's hand).
  throwGrenade(p,input) {
    p.grenadeReady=false; p.shield=0;
    const def=grenadeDef(p.kit.grenade);
    this.grenades.push({id:++this.serial,owner:p.id,color:p.color,kind:def.id,...grenadeStart(p,input,def.id,this.cover),t:0,bounces:0,rolling:false,resting:false,life:def.fuse,total:def.fuse,radius:def.radius,damage:def.damage});
  }
  // Who p's blows and throws can paint now: rivals in play, unshielded (team mates with friendly fire).
  targetsOf(p) { return this.players.filter(q => q.id !== p?.id && q.connected && !q.respawn && !q.eliminated && !q.shield && (this.options.friendlyFire || !this.sameTeam(q, p))); }
  // A melee blow lands: ONE pana, the nearest in reach and in front with no cover
  // between (engine/play/melee.js swingHit), takes the weapon's whole stack of
  // paint, is shoved back `knockback` metres and slowed `stun` seconds.
  strike(p, stats) {
    const hit = swingHit(p, this.targetsOf(p), stats, { boxes: this.cover, radius: RADIUS }); if (!hit) return null;
    const victim = hit.target, dx = victim.x - p.x, dz = victim.z - p.z, length = Math.hypot(dx, dz) || 1;
    p.smacks++; this.splats.push({ id: ++this.serial, x: victim.x, z: victim.z, color: p.color, life: 9, pattern: p.kit.pattern, radius: 1.3 });
    if (stats.stun) victim.slow = Math.max(victim.slow || 0, stats.stun);
    // The shove moves in small steps and stops at cover or the fence.
    for (let i = 0, n = Math.ceil(stats.knockback / .2); i < n; i++) {
      const s = stats.knockback / n, x = victim.x + dx / length * s, z = victim.z + dz / length * s;
      if (blocked(x, z, RADIUS, this.mapId, this.variant)) break; victim.x = x; victim.z = z;
    }
    this.hit(victim, p, p.color, { x: dx, z: dz, weapon: stats.id, melee: true }, hit.damage);
    return victim;
  }
  // La Chancleta leaves the hand on an arc (engine/play/melee.js throwStart) and is
  // back `recall` seconds later whether it hit or not.
  throwMelee(p, input, stats) {
    const hand = handAt(p, input.ax, input.az, this.cover);
    const flying = throwStart(p.melee, stats, { ...hand, pitch: input.pitch }); if (!flying) return null;
    p.shield = 0;
    const item = { id: ++this.serial, owner: p.id, kind: stats.id, color: p.color, t: 0, ...flying };
    this.thrown.push(item); return item;
  }
  // Thrown weapons fly, swept against cover, the fence, the ground and panas: the
  // first pana it meets takes the throw's paint (the strike's whole stack).
  flyThrown(dt) {
    for (const f of this.thrown) {
      const owner = this.players.find(q => q.id === f.owner);
      const r = stepThrown(f, dt, { boxes: this.cover, targets: this.targetsOf(owner || { id: f.owner }), radius: RADIUS }); f.t += dt;
      if (!r.hit && outside(this.mapId, f.x, f.z)) { f.life = 0; r.hit = 'cover'; }
      if (!r.hit) continue;
      this.splats.push({ id: ++this.serial, x: f.x, z: f.z, color: f.color, life: 9, pattern: owner?.kit.pattern || 'splat' });
      if (r.victim) { if (owner) owner.smacks++; this.hit(r.victim, owner, f.color, { x: f.vx, z: f.vz, weapon: f.kind, melee: true, thrown: true }, f.damage); }
    }
    this.thrown = this.thrown.filter(f => f.life > 0);
  }
  // A blast paints everyone in `radius` it can see: `damage` pepazos inside 40% of
  // the radius, fewer towards the edge (never under one). Cover lower than the
  // blast does not shield; one hit per victim.
  blast(b,radius,damage=1) {
    if(b.exploded) return; b.exploded=true;
    const owner=this.players.find(p=>p.id===b.owner), y=b.y||0;
    for(const p of this.players) {
      if(p.id===b.owner || !p.connected || p.respawn || p.eliminated || p.shield || (!this.options.friendlyFire && this.sameTeam(p,owner))) continue;
      const share=falloff(Math.hypot(p.x-b.x,p.z-b.z,Math.max(0,y-1.8)),radius);
      if(!share || this.cover.some(o=>(o.h ?? o.height ?? Infinity)>y && segmentBox(b.x,b.z,p.x-b.x,p.z-b.z,o,.01)!==null)) continue;
      this.hit(p,owner,b.color,{ x:p.x-b.x, z:p.z-b.z, blast:true, weapon:b.kind },Math.max(1,Math.round(damage*share)));
    }
    this.splats.push({id:++this.serial,x:b.x,y,z:b.z,color:b.color,life:9,radius:Math.max(radius,1.6),blast:true,pattern:'splat'});
    // Clients turn each new boom into a flash, a fireball, smoke and a shake sized by the radius.
    this.booms.push({id:++this.serial,x:b.x,y,z:b.z,kind:b.kind||'grenade',color:b.color,radius,life:.6});
  }
  stepGrenades(dt) {
    for(const g of this.grenades) {
      stepLob(g,dt,grenadeFlight(g.kind,this.cover,this.mapId));
      g.life=Math.max(0,g.life-dt); g.late=(g.late||0)+(g.life?0:dt);
      // A high lob still in its first flight when the fuse ends blows on touchdown, not in the air.
      if(g.life<=1e-6 && (touched(g) || g.late>4)) { this.blast(g,g.radius,g.damage); const def=grenadeDef(g.kind); if(def.puddle) this.puddles.push({id:++this.serial,owner:g.owner,x:g.x,z:g.z,color:g.color,radius:def.puddle,life:5}); }
    }
    this.grenades=this.grenades.filter(g=>!g.exploded);
    for(const pool of this.puddles) {
      pool.life-=dt; const owner=this.players.find(p=>p.id===pool.owner);
      for(const p of this.players) if(p.id!==pool.owner && !this.sameTeam(p,owner) && !p.shield && Math.hypot(p.x-pool.x,p.z-pool.z)<pool.radius) p.slow=Math.max(p.slow,.2);
    }
    this.puddles=this.puddles.filter(p=>p.life>0);
  }
  // Who a shot from `owner` can hit: standing, unshielded, and a rival unless friendly fire is on.
  shotTargets(owner, id = owner?.id) { return this.players.filter(p => p.id !== id && p.connected && !p.respawn && !p.eliminated && !p.shield && (this.options.friendlyFire || !this.sameTeam(p, owner))); }
  // A pepazo stains the victim; the last one their aguante allows takes them out.
  // `damage` pepazos land at once: La Lejana's 1 to 3, Infinity for a direct rocket or a
  // head hit (impact.headshot, which also sets impact.zone 'head').
  hit(victim, owner, color, impact = {}, damage = 1) {
    // Under a whole pepazo (La Fumigadora's drops, La China's stones, La Licuadora's
    // balls) the victim soaks it; once a whole one has soaked in, that is the pepazo.
    if (damage < 1) {
      victim.soak = (victim.soak || 0) + damage; victim.calm = 0;
      if (victim.soak < 1 - 1e-9) return;
      victim.soak -= 1; if (victim.soak < 1e-9) victim.soak = 0; damage = 1;
    }
    const dx = impact.x ?? (victim.x - (owner?.x ?? victim.x)), dz = impact.z ?? (victim.z - (owner?.z ?? victim.z));
    const length = Math.hypot(dx, dz) || 1;
    victim.impact = { x: dx / length, z: dz / length, zone: impact.zone === 'head' ? 'head' : 'body', blast: !!impact.blast, n: this.eventSerial + 1 };
    const distance = owner ? Math.round(Math.hypot(owner.x - victim.x, owner.z - victim.z)) : 0;
    const toughness = kitStats(victim.kit,this.options).toughness, weapon = impact.weapon || null, thrown = !!impact.thrown;
    victim.paint = Math.min(toughness, victim.paint + Math.max(1, damage)); victim.stains = [...victim.stains, color].slice(-5); victim.calm = 0;
    if (victim.paint < toughness) { this.event('hit', owner, victim, distance, { weapon, thrown }); return; }
    victim.respawn = 2.5; victim.hits++; victim.slow = this.options.paint === 'sticky' ? 7 : 0; victim.eliminated = livesOf(this.options) > 0 && victim.hits >= livesOf(this.options);
    const rival = !!owner && !this.sameTeam(owner, victim), revenge = rival && owner.nemesis === victim.id;
    if (rival) { owner.score++; owner.streak++; if (revenge) owner.nemesis = null; victim.nemesis = owner.id; if (!objectivePlay(this.options)) this.teamScores[owner.team]++; }
    victim.streak = 0;
    if (isCtf(this.options)) ctfDrop(this, victim);
    if (owner) this.say(locKey('{owner} pintó a {victim} · {distance} m'), { owner: owner.name, victim: victim.name, distance }); else this.say(locKey('Un pana pintó a {victim} · {distance} m'), { victim: victim.name, distance });
    this.event('out', owner, victim, distance, { streak: rival ? owner.streak : 0, revenge, weapon, thrown, direct: damage === Infinity && !impact.headshot, headshot: !!impact.headshot });
  }
  // The feed line is synced: a Spanish key plus its variables, shown with loc() on each client.
  say(message, vars = null) { this.message = message; this.messageVars = vars; }
  event(type, owner, victim, distance, extra = {}) {
    this.events = [...this.events, { n: ++this.eventSerial, type, owner: owner?.id ?? null, victim: victim.id, color: owner?.color || victim.color, distance, impact: { ...victim.impact }, ...extra }].slice(-12);
  }
  winners() {
    const teams = teamPlay(this.options);
    // Objective rounds: the winning team, or everyone on a draw (ctfOutcome, domOutcome).
    if (!this.survivors?.length && objectivePlay(this.options) && this.outcome) return this.players.filter(p => this.outcome.winner === null || p.team === this.outcome.winner).map(p => p.id);
    if (this.survivors?.length) { const survivors = this.players.filter(p => this.survivors.includes(p.id)); return teams ? this.players.filter(p => p.team === survivors[0].team).map(p => p.id) : this.survivors; }
    const best = teams ? Math.max(...this.teamScores) : Math.max(...this.players.map(p => p.score));
    return this.players.filter(p => (teams ? this.teamScores[p.team] : p.score) === best).map(p => p.id);
  }
  view() { return { winners: this.winners(), options: { ...this.options }, flags: this.flags.map(f => ({ ...f })), flagEvents: this.flagEvents.map(e => ({ ...e })), zones: this.zones.map(z => ({ ...z })), zoneEvents: this.zoneEvents.map(e => ({ ...e })), outcome: this.outcome ? { ...this.outcome } : null, teamScores: [...this.teamScores], mapId: this.mapId, variant: this.variant, events: this.events.map(e => ({ ...e })), difficulty: this.difficulty, phase: this.phase, round: this.round, loading: this.loading, countdown: this.countdown, time: this.time, players: this.players.map(p => ({ ...p, melee: { ...p.melee }, impact: p.impact ? { ...p.impact } : null, stains: [...p.stains] })), thrown: this.thrown.map(f => ({ ...f })), grenades:this.grenades.map(g=>({...g})), booms:this.booms.map(b=>({...b})), puddles:this.puddles.map(p=>({...p})), balls: this.balls.map(b => ({ ...b })), splats: this.splats.map(s => ({ ...s })), message: this.message, messageVars: this.messageVars ? { ...this.messageVars } : null }; }
}

// Stable lobby positions are independent of member IDs and survive roster changes.
export function paintSeats(players) { return Array.from({ length: 8 }, (_, seat) => players.find(p => p.connected && p.seat === seat) || null); }
