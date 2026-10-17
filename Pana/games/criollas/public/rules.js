import { createPitch, throwBall, stepPitch, moving, measure, botShot, copy, STEP } from '/engine/bolas-criollas.js';
export { STEP, copy };
export const TEAM_NAMES = ['Rojos', 'Verdes'];
const BOT_NAMES = ['Cheo', 'Yuli', 'Nico', 'Lola'];
export function botPlayer(slot) {
  return { id: null, name: BOT_NAMES[slot], avatar: { outfit: 'deportivo', outfitColor: slot % 2 ? '#299e72' : '#ed5949' } };
}
export function createGame() {
  return { phase: 'lobby', players: Array.from({ length: 4 }, (_, i) => botPlayer(i)), pitch: createPitch(),
    target: 12, scores: [0, 0], remaining: [4, 4, 4, 4], turn: 0, lastSlots: [2, 3],
    hand: 0, starter: 0, revision: 0, shots: 0, elapsed: 0, botTime: 0, result: null };
}
export function nextHand(g) {
  g.hand++; g.pitch = createPitch(Math.sin(g.hand * 2.4) * 1.4, -5.5 - g.hand % 3 * .6);
  g.remaining = [4, 4, 4, 4]; g.lastSlots = [2, 3]; g.result = null;
  g.turn = g.starter; g.phase = 'aiming'; g.elapsed = g.botTime = 0; g.revision++;
}
export function shoot(g, shot) {
  if (g.phase !== 'aiming' || g.remaining[g.turn] <= 0 || !throwBall(g.pitch, g.turn, shot)) return false;
  g.remaining[g.turn]--; g.lastSlots[g.turn % 2] = g.turn;
  g.shots++; g.revision++; g.phase = 'rolling'; g.elapsed = g.botTime = 0; return true;
}
export function acceptAction(g, id, data, hostId) {
  if (!data || data.revision !== g.revision) return false;
  if (data.action === 'target' && id === hostId && g.phase === 'lobby' && [12, 24].includes(data.target)) {
    g.target = data.target; g.revision++; return true;
  }
  if (data.action === 'start' && id === hostId && ['lobby', 'finished'].includes(g.phase)) {
    const { players, target, revision } = g;
    Object.assign(g, createGame(), { players, target, revision }); nextHand(g); return true;
  }
  if (data.action === 'next' && id === hostId && g.phase === 'hand') { nextHand(g); return true; }
  if (data.action === 'shoot' && id !== null && g.players[g.turn].id === id) return shoot(g, data);
  return false;
}
function finishThrow(g) {
  const result = measure(g.pitch), mingoOut = g.pitch.balls[0].out;
  if (mingoOut || g.remaining.every(n => n === 0)) {
    g.result = { ...result, void: mingoOut };
    if (!mingoOut && result.team !== null) { g.scores[result.team] += result.points; g.starter = result.team; }
    else g.starter = 1 - g.starter;
    g.phase = g.scores.some(n => n >= g.target) ? 'finished' : 'hand';
  } else {
    let team = result.team === null ? 1 - g.turn % 2 : 1 - result.team;
    if (!g.remaining.some((n, i) => n && i % 2 === team)) team = 1 - team;
    const next = (g.lastSlots[team] + 2) % 4;
    g.turn = g.remaining[next] ? next : (next + 2) % 4; g.phase = 'aiming';
  }
  g.elapsed = g.botTime = 0; g.revision++;
}
export function step(g) {
  if (g.phase === 'aiming' && g.players[g.turn].id === null) {
    g.botTime += STEP;
    if (g.botTime >= 1.1) return shoot(g, botShot(g.pitch, g.shots + g.hand * 13));
  }
  if (g.phase !== 'rolling') return false;
  g.elapsed += STEP; stepPitch(g.pitch);
  if (!moving(g.pitch)) { finishThrow(g); return true; }
  return false;
}
