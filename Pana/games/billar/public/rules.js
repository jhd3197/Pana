import { validArena } from '../../../engine/arena-layouts.js';

// Casual eight-ball house rules. All physics uses fixed steps in table units.
export const WIDTH = 1000, HEIGHT = 500, RADIUS = 11, POCKET_RADIUS = 25, STEP = 1 / 240;
export const POCKETS = [[0, 0], [500, -6], [1000, 0], [0, 500], [500, 506], [1000, 500]];
export const groupOf = id => id > 0 && id < 8 ? 'solids' : id > 8 && id < 16 ? 'stripes' : null;
export const groupName = group => group === 'solids' ? 'Lisas' : group === 'stripes' ? 'Rayadas' : 'Mesa abierta';
const clone = value => structuredClone(value);
const ball = (id, x, y) => ({ id, x, y, vx: 0, vy: 0, pocketed: false });

export function rack() {
  const balls = [ball(0, 250, 250)], order = [1, 9, 2, 10, 8, 3, 4, 11, 5, 12, 6, 13, 7, 14, 15];
  let i = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) {
    balls.push(ball(order[i++], 690 + row * (RADIUS * 2 + .25) * Math.sqrt(3) / 2, 250 + (col - row / 2) * (RADIUS * 2 + .25)));
  }
  return balls.sort((a, b) => a.id - b.id);
}

export function createGame(practice = false) {
  return { phase: 'lobby', mapId: 'plaza', practice, players: [0, 1].map(() => ({ id: null, name: 'Esperando pana', avatar: {} })),
    balls: rack(), groups: [null, null], turn: 0, revision: 0, round: 0, shots: 0, ballInHand: false,
    shot: null, result: null, message: 'La mesa está lista.' };
}

export function remaining(state, seat) {
  return state.balls.filter(b => !b.pocketed && b.id !== 0 && b.id !== 8 && (state.practice || !state.groups[seat] || groupOf(b.id) === state.groups[seat]));
}
export function legalTarget(state, id, seat = state.turn) {
  if (id === 0) return false;
  if (id === 8) return remaining(state, seat).length === 0;
  return state.practice || !state.groups[seat] || groupOf(id) === state.groups[seat];
}
export function canPlace(state, x, y) {
  return Number.isFinite(x) && Number.isFinite(y) && x >= RADIUS && x <= WIDTH - RADIUS && y >= RADIUS && y <= HEIGHT - RADIUS
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

export function acceptAction(state, id, action, hostId) {
  if (!action || action.revision !== state.revision) return false;
  if (action.action === 'map') {
    if (id !== hostId || state.phase !== 'lobby' || !validArena(action.mapId)) return false;
    state.mapId = action.mapId; state.revision++; return true;
  }
  if (action.action === 'start') {
    if (id !== hostId || !['lobby', 'finished'].includes(state.phase) || (!state.practice && state.players.some(p => p.id === null))) return false;
    const fresh = createGame(state.practice);
    Object.assign(state, fresh, { players: state.players, mapId: state.mapId, revision: state.revision + 1, round: state.round + 1,
      phase: 'aiming', message: state.practice ? 'Practica: mete las 15 bolas. Deja la ocho para el final.' : '¡A romper! La primera bola legal elige tu grupo.' });
    return true;
  }
  if (state.phase !== 'aiming' || state.players[state.turn].id !== id || (!state.practice && state.players.some(p => p.id === null))) return false;
  if (action.action === 'place') {
    if (!state.ballInHand || !canPlace(state, action.x, action.y)) return false;
    Object.assign(state.balls[0], { x: action.x, y: action.y, pocketed: false });
    state.ballInHand = false; state.revision++; state.message = 'Blanca colocada. Apunta y tira.'; return true;
  }
  if (action.action !== 'shoot' || state.ballInHand || !Number.isFinite(action.angle) || !Number.isFinite(action.power) || action.power < .05 || action.power > 1) return false;
  state.shot = { first: null, rail: false, pocketed: [], elapsed: 0, eligible: remaining(state, state.turn).length === 0, breaking: state.shots === 0 };
  const speed = 180 + action.power * 1600;
  state.balls[0].vx = Math.cos(action.angle) * speed; state.balls[0].vy = Math.sin(action.angle) * speed;
  state.phase = 'rolling'; state.shots++; state.revision++; state.message = 'Bolas en movimiento…';
  return true;
}

export function finishShot(state) {
  const shot = state.shot, seat = state.turn;
  const scratch = shot.pocketed.includes(0);
  let foul = scratch ? 'La blanca cayó.' : shot.first === null ? 'La blanca no tocó ninguna bola.'
    : shot.first === 8 ? !shot.eligible ? 'Tocaste la ocho antes de tiempo.' : ''
      : !state.practice && state.groups[seat] && groupOf(shot.first) !== state.groups[seat] ? 'Tocaste primero una bola rival.' : '';
  if (!foul && !shot.rail && !shot.pocketed.length) foul = 'Ninguna bola llegó a una banda después del contacto.';
  const eight = shot.pocketed.includes(8);
  if (eight && shot.breaking) respot(state, 8);
  else if (eight) {
    const won = shot.eligible && !foul;
    state.result = { winner: won ? seat : state.practice ? null : 1 - seat,
      reason: won ? '¡La ocho entró limpia!' : scratch ? 'La ocho entró con la blanca.' : 'La ocho entró antes de tiempo.' };
    state.phase = 'finished'; state.message = state.result.reason; state.shot = null; state.revision++; return;
  }
  if (!state.practice && !state.groups[seat] && !foul) {
    const first = shot.pocketed.find(id => groupOf(id));
    if (first) { state.groups[seat] = groupOf(first); state.groups[1 - seat] = groupOf(first) === 'solids' ? 'stripes' : 'solids'; }
  }
  const keep = !foul && shot.pocketed.some(id => groupOf(id) && (state.practice || groupOf(id) === state.groups[seat]));
  if (!state.practice && !keep) state.turn = 1 - seat;
  state.ballInHand = !!foul;
  if (scratch) respot(state, 0, 250);
  state.phase = 'aiming'; state.shot = null; state.revision++;
  state.message = foul ? `${foul} ${state.practice ? 'Coloca la blanca y sigue.' : 'Bola en mano para tu rival.'}`
    : eight && shot.breaking ? 'La ocho vuelve a la mesa después del saque.' : keep ? '¡Buena bola! Sigue tu turno.' : 'Cambio de turno.';
}

export function step(state) {
  if (state.phase !== 'rolling') return false;
  const shot = state.shot, live = state.balls.filter(b => !b.pocketed);
  shot.elapsed += STEP;
  for (const b of live) {
    b.x += b.vx * STEP; b.y += b.vy * STEP;
    if (POCKETS.some(([x, y]) => Math.hypot(b.x - x, b.y - y) < POCKET_RADIUS)) {
      b.pocketed = true; b.vx = b.vy = 0; shot.pocketed.push(b.id); continue;
    }
    let rail = false;
    if (b.x < RADIUS) { b.x = RADIUS; b.vx = Math.abs(b.vx) * .84; rail = true; }
    if (b.x > WIDTH - RADIUS) { b.x = WIDTH - RADIUS; b.vx = -Math.abs(b.vx) * .84; rail = true; }
    if (b.y < RADIUS) { b.y = RADIUS; b.vy = Math.abs(b.vy) * .84; rail = true; }
    if (b.y > HEIGHT - RADIUS) { b.y = HEIGHT - RADIUS; b.vy = -Math.abs(b.vy) * .84; rail = true; }
    if (rail && shot.first !== null) shot.rail = true;
  }
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j]; if (a.pocketed || b.pocketed) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d >= RADIUS * 2) continue;
    const nx = d ? dx / d : 1, ny = d ? dy / d : 0, overlap = (RADIUS * 2 - d) / 2 + .001;
    a.x -= nx * overlap; a.y -= ny * overlap; b.x += nx * overlap; b.y += ny * overlap;
    const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    if (approach <= 0) continue;
    const impulse = approach * .98;
    a.vx -= impulse * nx; a.vy -= impulse * ny; b.vx += impulse * nx; b.vy += impulse * ny;
    if (shot.first === null && (a.id === 0 || b.id === 0)) shot.first = a.id === 0 ? b.id : a.id;
  }
  let moving = false;
  for (const b of live) {
    if (b.pocketed) continue;
    const speed = Math.hypot(b.vx, b.vy), next = Math.max(0, speed - 205 * STEP);
    const ratio = speed > 5 ? next / speed : 0;
    b.vx *= ratio; b.vy *= ratio; if (ratio > 0) moving = true;
  }
  if (!moving || shot.elapsed > 14) {
    state.balls.forEach(b => { b.vx = b.vy = 0; }); finishShot(state); return true;
  }
  return false;
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

export const snapshot = clone;
