import { validArena } from '../../../engine/worlds/arena-layouts.js';
import { DEFAULT_DIFFICULTY, validDifficulty, difficultyInfo } from '../../../engine/play/difficulty.js';
import { rng, seedOf } from '../../../engine/random.js';
import { canMoveSeats } from '../../../engine/play/seat-rules.js';
import { createStarter, starterInput, stepStarter, starterDone, starterResult } from '../../../engine/play/quien-empieza-rules.js';
import { defaultPoolOptions, poolOptions, teamOf, occupiedSeats, canStartPool, poolConnected, nextShooter, passPoolTurn, winPoolRack } from './match-rules.js';
import { loc, locKey } from '../../../engine/i18n.js';

// Casual eight-ball house rules. All physics uses fixed steps in table units.
export const WIDTH = 1000, HEIGHT = 500, RADIUS = 11, POCKET_RADIUS = 25, STEP = 1 / 240;
export const POCKETS = [[0, 0], [500, -6], [1000, 0], [0, 500], [500, 506], [1000, 500]];
// state.message is synced Spanish: a key, { text, vars } (a var may itself be
// one, like the ¿Quién empieza? note) or a list of sentences shown in a row.
export function messageText(message) {
  if (!message) return '';
  if (typeof message === 'string') return loc(message);
  if (Array.isArray(message)) return message.map(messageText).filter(Boolean).join(' ');
  const vars = message.vars && Object.fromEntries(Object.entries(message.vars).map(([k, v]) => [k, v && typeof v === 'object' ? messageText(v) : v]));
  return loc(message.text, vars);
}
export const groupOf = id => id > 0 && id < 8 ? 'solids' : id > 8 && id < 16 ? 'stripes' : null;
export const groupName = group => group === 'solids' ? loc('Lisas') : group === 'stripes' ? loc('Rayadas') : loc('Mesa abierta');
const clone = value => structuredClone(value);
const ball = (id, x, y) => ({ id, x, y, vx: 0, vy: 0, pocketed: false });
// Rolling friction and the cushions, shared by the physics and the predictions.
const FRICTION = 205, CUSHION = .84, CONTACT = .98, FOLLOW = .62, ENGLISH = .22;
export const BOT_ID = 'bot';
export const botPlayer = () => ({ id: BOT_ID, name: 'Pana Bot', avatar: { outfit: 'deportivo', outfitColor: '#3b8bff' }, bot: true }); // i18n-ignore: a name

export function rack(variant = 'eight') {
  const balls = [ball(0, 250, 250)], order = [1, 9, 2, 10, 8, 3, 4, 11, 5, 12, 6, 13, 7, 14, 15];
  let i = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) {
    balls.push(ball(order[i++], 690 + row * (RADIUS * 2 + .25) * Math.sqrt(3) / 2, 250 + (col - row / 2) * (RADIUS * 2 + .25)));
  }
  balls.sort((a, b) => a.id - b.id);
  if (variant === 'nine') {
    const order = [1, 2, 3, 4, 9, 5, 6, 7, 8]; let n = 0;
    for (const [row, count] of [1, 2, 3, 2, 1].entries()) for (let col = 0; col < count; col++) {
      Object.assign(balls[order[n++]], { x: 690 + row * (RADIUS * 2 + .25) * Math.sqrt(3) / 2, y: 250 + (col - (count - 1) / 2) * (RADIUS * 2 + .25) });
    }
    for (const b of balls) if (b.id > 9) b.pocketed = true;
  }
  return balls;
}

// practice: one pana clears the whole rack. bot: a full match against Pana Bot.
export function createGame(practice = false, { bot = false } = {}) {
  const players = Array.from({ length: 6 }, () => ({ id: null, name: locKey('Esperando pana'), avatar: {} }));
  if (bot) players[1] = botPlayer();
  return { phase: 'lobby', mapId: 'plaza', difficulty: DEFAULT_DIFFICULTY, practice: practice && !bot, bot, players,
    balls: rack(), groups: [null, null], turn: 0, revision: 0, round: 0, shots: 0, ballInHand: false,
    options: defaultPoolOptions(), activeSeats: [], teamTurns: [-1, -1], scores: [0, 0], breaker: 0, turnElapsed: 0, starter: null, breakMessage: '',
    shot: null, result: null, message: locKey('La mesa está lista.') };
}

export function remaining(state, seat) {
  if (state.options.variant === 'nine') return state.balls.filter(b => !b.pocketed && b.id > 0);
  const group = state.groups[teamOf(seat)];
  return state.balls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8 && (state.practice || !group || groupOf(b.id) === group));
}
export function legalTarget(state, id, seat = state.turn) {
  if (id === 0) return false;
  if (state.options.variant === 'nine') return id === Math.min(...remaining(state, seat).map(b => b.id));
  if (id === 8) return remaining(state, seat).length === 0;
  return state.practice || !state.groups[teamOf(seat)] || groupOf(id) === state.groups[teamOf(seat)];
}
export function canPlace(state, x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= RADIUS && x <= WIDTH - RADIUS && y >= RADIUS && y <= HEIGHT - RADIUS
    && (!state.ballInHand || state.options.foulPlacement !== 'kitchen' || x <= WIDTH / 4)
    && POCKETS.every(([px, py]) => Math.hypot(x - px, y - py) > POCKET_RADIUS + RADIUS)
    && state.balls.every(b => b.id === 0 || b.pocketed || Math.hypot(x - b.x, y - b.y) >= RADIUS * 2 + .2);
}
function respot(state, id, preferredX = 690) {
  const b = state.balls.find(b => b.id === id);
  for (let y = 250; y < HEIGHT - RADIUS; y += RADIUS * 2 + 1) {
    for (let x = preferredX; x > RADIUS; x -= RADIUS * 2 + 1) {
      if (state.balls.every(other => other.id === id || other.pocketed || Math.hypot(x - other.x, y - other.y) > RADIUS * 2 + .2)) {
        Object.assign(b, { x, y, vx: 0, vy: 0, pocketed: false }); return;
      }
    }
  }
}

// A match's first break: ¿Quién empieza? (engine/play/quien-empieza-rules.js)
// on the table, the highest die breaks. Later racks follow the break policy.
function beginBreak(state) {
  const { order, rolls } = starterResult(state.starter), seat = order[0], note = state.starter.note, roll = rolls[seat];
  state.turn = seat; state.breaker = teamOf(seat); state.phase = 'aiming'; state.turnElapsed = 0;
  // Synced: Spanish keys plus their variables; each client shows it with messageText().
  const vars = { name: state.players[seat].name, roll, note: note ? { text: note } : undefined };
  const text = note ? roll ? locKey('{note}: ¡Rompe {name} con {roll}!') : locKey('{note}: ¡Rompe {name}!')
    : roll ? locKey('¡Rompe {name} con {roll}!') : locKey('¡Rompe {name}!');
  state.message = state.starter.seats.length < 2 ? state.breakMessage : [{ text, vars }, state.breakMessage];
}
// Host only, on its timer: empty seats and Pana Bot shake on their own.
export function stepPoolStarter(state, dt) {
  if (state.phase !== 'starter') return false;
  const bots = state.activeSeats.filter(i => state.players[i].id === null || state.players[i].bot);
  const changed = stepStarter(state.starter, dt, { bots });
  if (starterDone(state.starter)) beginBreak(state);
  if (changed) state.revision++;
  return changed;
}

export function acceptAction(state, id, action, hostId) {
  // Every pana shakes at once, so a cacho never waits for the latest revision.
  if (action?.action === 'starter') {
    const seat = state.players.findIndex(p => p.id === id);
    if (state.phase !== 'starter' || seat < 0 || !starterInput(state.starter, seat, action.cacho, action.power)) return false;
    state.revision++; return true;
  }
  if (!action || action.revision !== state.revision) return false;
  if (action.action === 'reset-options') {
    if (id !== hostId || state.phase !== 'lobby') return false;
    Object.assign(state, { options: defaultPoolOptions(), mapId: 'plaza', difficulty: DEFAULT_DIFFICULTY,
      scores: [0, 0], balls: rack(), revision: state.revision + 1 });
    return true;
  }
  if (action.action === 'setup') {
    // After a rack, or mid-rack when a playing seat emptied: nobody can shoot until it fills.
    const stranded = !['lobby', 'finished'].includes(state.phase) && !poolConnected(state);
    if (id !== hostId || (state.phase !== 'finished' && !stranded)) return false;
    const { players, options, mapId, difficulty, practice, bot, revision } = state;
    Object.assign(state, createGame(practice, { bot }), { players, options, mapId, difficulty, revision: revision + 1, balls: rack(options.variant) });
    return true;
  }
  if (action.action === 'swap') {
    if (state.options.format === 'duel' && (action.from > 1 || action.to > 1)) return false;
    if (state.phase !== 'lobby' || !canMoveSeats(state.players, action.from, action.to, id, hostId)) return false;
    [state.players[action.from], state.players[action.to]] = [state.players[action.to], state.players[action.from]];
    state.revision++; return true;
  }
  if (action.action === 'options') {
    if (id !== hostId || !['lobby', 'finished'].includes(state.phase)) return false;
    const options = poolOptions(state.options, action.options); if (!options) return false;
    if (options.format !== state.options.format && state.phase !== 'lobby') return false;
    if (options.format === 'duel' && occupiedSeats(state).length > 2) return false;
    if (options.format === 'duel' && state.phase === 'lobby') state.players.sort((a,b) => Number(b.id !== null) - Number(a.id !== null));
    state.options = options; state.scores = [0, 0]; if (state.result) state.result.matchFinished = true;
    if (state.phase === 'lobby') state.balls = rack(options.variant);
    state.revision++; return true;
  }
  if (action.action === 'map') {
    if (id !== hostId || state.phase !== 'lobby' || !validArena(action.mapId)) return false;
    state.mapId = action.mapId; state.revision++; return true;
  }
  if (action.action === 'difficulty') {
    // Online it is fixed for the match; a local table may change it any time.
    const local = state.practice || state.bot;
    if (id !== hostId || (!local && !['lobby', 'finished'].includes(state.phase)) || !validDifficulty(action.difficulty)) return false;
    state.difficulty = action.difficulty; state.revision++; return true;
  }
  if (action.action === 'start') {
    if (id !== hostId || !['lobby', 'finished'].includes(state.phase) || !canStartPool(state)) return false;
    const fresh = createGame(state.practice, { bot: state.bot });
    const continuing = state.phase === 'finished' && state.result?.matchFinished === false;
    // Revancha: a pana of the team that lost the last rack breaks.
    const last = state.result?.team != null ? state.activeSeats.find(i => teamOf(i) !== state.result.team) ?? null : null;
    const breaker = continuing ? state.options.breakPolicy === 'alternate' ? 1 - state.breaker : state.options.breakPolicy === 'winner' ? state.result.team : 1 - state.result.team : 0;
    Object.assign(state, fresh, { players: state.players, mapId: state.mapId, difficulty: state.difficulty, revision: state.revision + 1, round: state.round + 1,
      options: state.options, balls: rack(state.options.variant), activeSeats: occupiedSeats(state), scores: continuing ? state.scores : [0, 0], breaker,
      phase: 'aiming', message: state.options.variant === 'nine' ? locKey('¡A romper! Toca primero la bola de menor número y busca la nueve.') : state.practice ? locKey('Deja la ocho para el final.') : locKey('¡A romper! La primera bola legal elige tu grupo.') });
    state.turn = nextShooter(state, breaker);
    if (state.options.variant === 'nine') state.message = locKey('Bola 9: toca primero la bola de menor número. La nueve gana la mesa.');
    if (continuing) return true;
    // Seeded by the panas' connection ids, so a replayed snapshot rolls the same dice.
    state.breakMessage = state.message;
    state.starter = createStarter({ seats: state.activeSeats, need: 'first', seed: seedOf(`${state.round}:${state.revision}:${state.activeSeats.map(i => state.players[i].id).join()}`), option: state.options.starter, last });
    if (starterDone(state.starter)) beginBreak(state);
    else { state.phase = 'starter'; state.message = locKey('¿Quién rompe? Sacude el cacho: el dado más alto rompe.'); }
    return true;
  }
  if (state.phase !== 'aiming' || state.players[state.turn].id !== id || !poolConnected(state)) return false;
  if (action.action === 'place') {
    if (!state.ballInHand || !canPlace(state, action.x, action.y)) return false;
    Object.assign(state.balls[0], { x: action.x, y: action.y, pocketed: false });
    state.ballInHand = false; state.kitchenShot = state.options.foulPlacement === 'kitchen'; state.revision++; state.message = locKey('Blanca colocada. Apunta y tira.'); return true;
  }
  if (action.action !== 'shoot' || state.ballInHand || !Number.isFinite(action.angle) || !Number.isFinite(action.power) || action.power < .05 || action.power > 1) return false;
  if (state.options.calledPocket && (!Number.isInteger(action.pocket) || action.pocket < 0 || action.pocket >= POCKETS.length)) return false;
  const spin = action.spin ?? { x: 0, y: 0 };
  if (![spin.x, spin.y].every(v => Number.isFinite(v) && Math.abs(v) <= 1)) return false;
  state.shot = { first: null, rail: false, pocketed: [], elapsed: 0, eligible: remaining(state, state.turn).length === 0, breaking: state.shots === 0,
    spin: { x: spin.x, y: spin.y }, dir: { x: Math.cos(action.angle), y: Math.sin(action.angle) }, english: 2,
    lowest: Math.min(...remaining(state, state.turn).map(b => b.id)), called: action.pocket ?? null, pockets: {}, kitchen: !!state.kitchenShot, crossed: false, kitchenFoul: false };
  state.kitchenShot = false;
  const speed = 180 + action.power * 1600;
  state.balls[0].vx = Math.cos(action.angle) * speed; state.balls[0].vy = Math.sin(action.angle) * speed;
  state.phase = 'rolling'; state.shots++; state.revision++; state.message = locKey('Bolas en movimiento…');
  return true;
}

export function finishShot(state) {
  const shot = state.shot, seat = state.turn, team = teamOf(seat);
  const scratch = shot.pocketed.includes(0);
  const called = id => !state.options.calledPocket || shot.pockets?.[id] === shot.called;
  if (state.options.variant === 'nine') {
    const foul = scratch || shot.kitchenFoul || shot.first !== shot.lowest || (!shot.rail && !shot.pocketed.length);
    if (shot.pocketed.includes(9) && !foul && called(9)) { winPoolRack(state, team, locKey('¡La nueve entró limpia!')); return; }
    if (shot.pocketed.includes(9)) respot(state, 9);
    const keep = !foul && shot.pocketed.some(id => id > 0 && id !== 9 && called(id));
    passPoolTurn(state, keep); state.ballInHand = foul;
    if (scratch) respot(state, 0, 200);
    state.phase = 'aiming'; state.shot = null; state.revision++;
    state.message = foul ? locKey('Falta. Coloca la blanca.') : keep ? locKey('Buena bola. Sigue tu equipo.') : locKey('Cambio de turno.');
    return;
  }
  let foul = scratch ? locKey('La blanca cayó.') : shot.kitchenFoul ? locKey('La blanca debe salir de la cocina antes de tocar una bola.') : shot.first === null ? locKey('La blanca no tocó ninguna bola.')
    : shot.first === 8 ? !shot.eligible ? locKey('Tocaste la ocho antes de tiempo.') : ''
      : !state.practice && state.groups[team] && groupOf(shot.first) !== state.groups[team] ? locKey('Tocaste primero una bola rival.') : '';
  if (!foul && !shot.rail && !shot.pocketed.length) foul = locKey('Ninguna bola llegó a una banda después del contacto.');
  const eight = shot.pocketed.includes(8);
  if (eight && shot.breaking) respot(state, 8);
  else if (eight) {
    const won = shot.eligible && !foul && called(8);
    winPoolRack(state, won ? team : state.practice ? null : 1 - team,
      won ? locKey('¡La ocho entró limpia!') : scratch ? locKey('La ocho entró con la blanca.') : !called(8) ? locKey('La ocho entró en otra tronera.') : locKey('La ocho entró antes de tiempo.')); return;
  }
  if (!state.practice && !state.groups[team] && !foul) {
    const first = shot.pocketed.find(id => groupOf(id) && called(id));
    if (first) { state.groups[team] = groupOf(first); state.groups[1 - team] = groupOf(first) === 'solids' ? 'stripes' : 'solids'; }
  }
  const keep = !foul && shot.pocketed.some(id => groupOf(id) && called(id) && (state.practice || groupOf(id) === state.groups[team]));
  passPoolTurn(state, keep);
  state.ballInHand = !!foul;
  if (scratch) respot(state, 0, 250);
  state.phase = 'aiming'; state.shot = null; state.revision++;
  state.message = foul ? [foul, state.practice ? locKey('Coloca la blanca y sigue.') : locKey('Bola en mano para tu rival.')]
    : eight && shot.breaking ? locKey('La ocho vuelve a la mesa después del saque.') : keep ? locKey('¡Buena bola! Sigue tu equipo.') : locKey('Cambio de turno.');
}

export function step(state) {
  if (state.phase !== 'rolling') return false;
  const shot = state.shot, live = state.balls.filter(b => !b.pocketed);
  shot.elapsed += STEP;
  for (const b of live) {
    b.x += b.vx * STEP; b.y += b.vy * STEP;
    if (b.id === 0 && b.x > WIDTH / 4) shot.crossed = true;
    const pocket = POCKETS.findIndex(([x, y]) => Math.hypot(b.x - x, b.y - y) < POCKET_RADIUS);
    if (pocket >= 0) {
      b.pocketed = true; b.vx = b.vy = 0; shot.pocketed.push(b.id); shot.pockets[b.id] = pocket; continue;
    }
    let rail = false;
    if (b.x < RADIUS) { b.x = RADIUS; b.vx = Math.abs(b.vx) * CUSHION; rail = true; }
    if (b.x > WIDTH - RADIUS) { b.x = WIDTH - RADIUS; b.vx = -Math.abs(b.vx) * CUSHION; rail = true; }
    if (b.y < RADIUS) { b.y = RADIUS; b.vy = Math.abs(b.vy) * CUSHION; rail = true; }
    if (b.y > HEIGHT - RADIUS) { b.y = HEIGHT - RADIUS; b.vy = -Math.abs(b.vy) * CUSHION; rail = true; }
    if (rail && shot.first !== null) shot.rail = true;
    // Side spin bends the cue ball's first two cushion rebounds.
    if (rail && b.id === 0 && shot.spin?.x && shot.english > 0) { shot.english--; [b.vx, b.vy] = turn(b.vx, b.vy, shot.spin.x * ENGLISH); }
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (a.pocketed || b.pocketed) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= RADIUS * 2) continue;
    const nx = d ? dx / d : 1, ny = d ? dy / d : 0, overlap = (RADIUS * 2 - d) / 2 + .001;
    a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
    const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (approach <= 0) continue;
    const impulse = approach * CONTACT;
    a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
    if (shot.first === null && (a.id === 0 || b.id === 0)) {
      shot.first = a.id === 0 ? b.id : a.id;
      shot.kitchenFoul = shot.kitchen && !shot.crossed;
      // Follow (top spin) keeps the cue ball rolling on; draw pulls it back.
      const cue = a.id === 0 ? a : b, follow = (shot.spin?.y || 0) * FOLLOW * impulse;
      if (shot.dir) { cue.vx += shot.dir.x * follow; cue.vy += shot.dir.y * follow; }
    }
  }
  let moving = false;
  for (const b of live) {
    if (b.pocketed) continue;
    const speed = Math.hypot(b.vx, b.vy), next = Math.max(0, speed - FRICTION * STEP);
    const ratio = speed > 5 ? next / speed : 0;
    b.vx *= ratio; b.vy *= ratio; if (ratio > 0) moving = true;
  }
  if (!moving || shot.elapsed > 14) {
    state.balls.forEach(b => { b.vx = b.vy = 0; }); finishShot(state); return true;
  }
  return false;
}

export function advanceShotClock(state, dt) {
  if (state.phase !== 'aiming' || !state.options.shotSeconds || !poolConnected(state)) return false;
  state.turnElapsed += Math.max(0, dt);
  if (state.turnElapsed < state.options.shotSeconds) return false;
  passPoolTurn(state); state.ballInHand = true; state.revision++;
  state.message = locKey('Se acabó el tiempo. Bola en mano para el otro equipo.');
  return true;
}

// Find the first contact for the visible aim guide; no prediction through balls.
export function aimGuide(state, angle) {
  const cue = state.balls[0], dx = Math.cos(angle), dy = Math.sin(angle);
  let distance = Math.min(dx > 0 ? (WIDTH - RADIUS - cue.x) / dx : dx < 0 ? (RADIUS - cue.x) / dx : Infinity,
    dy > 0 ? (HEIGHT - RADIUS - cue.y) / dy : dy < 0 ? (RADIUS - cue.y) / dy : Infinity), target = null;
  for (const b of state.balls) {
    if (b.id === 0 || b.pocketed) continue;
    const x = b.x - cue.x, y = b.y - cue.y, along = x * dx + y * dy, side2 = x * x + y * y - along * along;
    if (along < 0 || side2 > (RADIUS * 2) ** 2) continue;
    const hit = along - Math.sqrt(Math.max(0, (RADIUS * 2) ** 2 - side2));
    if (hit >= 0 && hit < distance) { distance = hit; target = b; }
  }
  return { x: cue.x + dx * distance, y: cue.y + dy * distance, target };
}

// Rotates a velocity by an angle (side spin off a cushion).
function turn(x, y, a) { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
const launch = power => 180 + power * 1600;

// Follows a ball rolling at `speed` from (x, y) along (dx, dy): cushion
// rebounds, friction and pockets, with the same constants as step().
export function trace(x, y, dx, dy, speed, { bounces = 0, english = 0 } = {}) {
  const points = [{ x, y }];
  let length = Math.hypot(dx, dy); if (!length || speed <= 5) return points;
  dx /= length; dy /= length;
  for (let leg = 0; leg <= bounces; leg++) {
    const reach = speed * speed / (2 * FRICTION);
    const toRail = Math.min(dx > 0 ? (WIDTH - RADIUS - x) / dx : dx < 0 ? (RADIUS - x) / dx : Infinity,
      dy > 0 ? (HEIGHT - RADIUS - y) / dy : dy < 0 ? (RADIUS - y) / dy : Infinity);
    let distance = Math.min(reach, Math.max(0, toRail));
    for (const [px, py] of POCKETS) {
      const along = (px - x) * dx + (py - y) * dy, side = Math.abs((px - x) * dy - (py - y) * dx);
      if (along > 0 && along <= distance + POCKET_RADIUS && side < POCKET_RADIUS) { points.push({ x: x + dx * along, y: y + dy * along, pocket: true }); return points; }
    }
    x += dx * distance; y += dy * distance; points.push({ x, y });
    if (distance >= reach || leg === bounces) break;
    // A cushion damps only the speed into it, exactly like step().
    speed = Math.sqrt(Math.max(0, speed * speed - 2 * FRICTION * distance));
    let vx = dx * speed, vy = dy * speed;
    if (x <= RADIUS + 1e-6 || x >= WIDTH - RADIUS - 1e-6) vx = -vx * CUSHION;
    if (y <= RADIUS + 1e-6 || y >= HEIGHT - RADIUS - 1e-6) vy = -vy * CUSHION;
    if (english && leg < 2) [vx, vy] = turn(vx, vy, english * ENGLISH);
    speed = Math.hypot(vx, vy); dx = vx / speed; dy = vy / speed;
  }
  return points;
}

// The whole predicted shot for the aiming guide: the cue ball's line to the
// first contact, then where the object ball and the cue ball go. Ignores later
// collisions, like any player reading the table.
export function predictShot(state, angle, power = .65, spin = { x: 0, y: 0 }, { bounces = 2 } = {}) {
  const cue = state.balls[0], aim = aimGuide(state, angle), dx = Math.cos(angle), dy = Math.sin(angle);
  const travelled = Math.hypot(aim.x - cue.x, aim.y - cue.y), v0 = launch(power);
  const v1 = Math.sqrt(Math.max(0, v0 * v0 - 2 * FRICTION * travelled));
  if (!aim.target) {
    const path = trace(cue.x, cue.y, dx, dy, v0, { bounces, english: spin.x });
    return { contact: { x: aim.x, y: aim.y }, target: null, cuePath: path.slice(1), objectPath: [] };
  }
  let nx = aim.target.x - aim.x, ny = aim.target.y - aim.y; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const along = dx * nx + dy * ny, hit = v1 * along * CONTACT;
  const objectPath = trace(aim.target.x, aim.target.y, nx, ny, hit, { bounces });
  const cx = dx * v1 - nx * hit + dx * spin.y * FOLLOW * hit, cy = dy * v1 - ny * hit + dy * spin.y * FOLLOW * hit;
  const cuePath = trace(aim.x, aim.y, cx, cy, Math.hypot(cx, cy), { bounces, english: spin.x });
  return { contact: { x: aim.x, y: aim.y }, target: aim.target, objectPath, cuePath };
}

// --- Pana Bot -------------------------------------------------------------
// Ghost-ball aiming: for every legal ball and pocket, find the clear, least cut
// shot. The difficulty's aimError then spoils the angle a little.
function clearPath(state, ax, ay, bx, by, ignore) {
  const dx = bx - ax, dy = by - ay, length2 = dx * dx + dy * dy || 1;
  return state.balls.every(o => {
    if (o.pocketed || ignore.includes(o.id)) return true;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / length2));
    return Math.hypot(o.x - ax - dx * t, o.y - ay - dy * t) >= RADIUS * 2;
  });
}
function plans(state, from = state.balls[0]) {
  const out = [];
  const kitchen = state.kitchenShot || state.ballInHand && state.options.foulPlacement === 'kitchen';
  for (const t of state.balls) {
    if (t.pocketed || !legalTarget(state, t.id)) continue;
    for (const [pocket, [px, py]] of POCKETS.entries()) {
      const mx = px + (px === 0 ? 8 : px === WIDTH ? -8 : 0), my = py + (py <= 0 ? 8 : -8);
      let ux = mx - t.x, uy = my - t.y; const far = Math.hypot(ux, uy); ux /= far; uy /= far;
      const gx = t.x - ux * RADIUS * 2, gy = t.y - uy * RADIUS * 2;
      if (gx < RADIUS || gx > WIDTH - RADIUS || gy < RADIUS || gy > HEIGHT - RADIUS) continue;
      if (kitchen && gx <= WIDTH / 4) continue;
      const near = Math.hypot(gx - from.x, gy - from.y); if (near < 1) continue;
      const cut = ((gx - from.x) * ux + (gy - from.y) * uy) / near;
      if (cut < .3 || !clearPath(state, from.x, from.y, gx, gy, [0, t.id]) || !clearPath(state, t.x, t.y, mx, my, [0, t.id])) continue;
      const objectSpeed = Math.sqrt(2 * FRICTION * far * 1.25 + 60 * 60), cueSpeed = objectSpeed / (CONTACT * cut);
      const power = (Math.sqrt(cueSpeed * cueSpeed + 2 * FRICTION * near) * 1.12 - 180) / 1600;
      if (power > 1) continue;
      out.push({ angle: Math.atan2(gy - from.y, gx - from.x), pocket, power: Math.max(.12, power), score: cut * cut * 1000 / (near + far * 1.4 + 60) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
export function botShot(state, seed = state.round * 977 + state.shots * 31) {
  const random = rng(seed), error = difficultyInfo(state.difficulty).aimError, cue = state.balls[0];
  const noise = () => (random() + random() + random() - 1.5) * 1.4;
  let shot = plans(state)[0];
  if (state.shots === 0) shot = { angle: Math.atan2(250 - cue.y, 690 - RADIUS * 2 - cue.x), power: 1 };
  if (!shot) {
    // Safety: roll firmly into the nearest legal ball so something reaches a cushion.
    const t = state.balls.filter(b => !b.pocketed && legalTarget(state, b.id)).sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
    const bank = state.kitchenShot && t && t.x - RADIUS * 2 <= WIDTH / 4;
    shot = { angle: t ? Math.atan2(t.y - cue.y, (bank ? 2 * (WIDTH - RADIUS) - t.x : t.x) - cue.x) : random() * Math.PI * 2, power: bank ? .85 : .55 };
  }
  return { angle: shot.angle + noise() * error, power: Math.max(.05, Math.min(1, shot.power * (1 + noise() * error * 3))), spin: { x: 0, y: 0 }, pocket: shot.pocket ?? 0 };
}
// Ball in hand: the free spot that leaves the best straight shot.
export function botPlacement(state) {
  let best = null;
  for (let x = 60; x <= WIDTH - 60; x += 40) for (let y = 50; y <= HEIGHT - 50; y += 40) {
    if (!canPlace(state, x, y)) continue;
    const score = plans(state, { x, y })[0]?.score ?? 0;
    if (!best || score > best.score) best = { x, y, score };
  }
  return best ? { x: best.x, y: best.y } : { x: 250, y: 250 };
}

export const snapshot = clone;
