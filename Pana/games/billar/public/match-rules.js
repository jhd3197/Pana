import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';

export const POOL_OPTIONS = [
  { id: 'variant', label: 'Modo', default: 'eight', choices: [['eight', 'Bola 8'], ['nine', 'Bola 9']] },
  { id: 'format', label: 'Jugadores', default: 'teams', choices: [['duel', 'Individual · 1 contra 1'], ['teams', 'Por equipos']] },
  { id: 'venue', label: 'Mesa', default: 'plaza', choices: [['plaza', 'Plaza'], ['cafe', 'Café']] },
  { id: 'guide', label: 'Ayuda de tiro', default: 'difficulty', choices: [['difficulty', 'Según dificultad'], ['long', 'Larga'], ['short', 'Corta'], ['none', 'Sin ayuda']] },
  { id: 'breakPolicy', label: 'Saque', default: 'alternate', advanced: true, choices: [['alternate', 'Alterno'], ['winner', 'Ganador'], ['loser', 'Perdedor']] },
  { id: 'foulPlacement', label: 'Falta', default: 'anywhere', advanced: true, choices: [['anywhere', 'Bola en mano'], ['kitchen', 'Cocina']] },
  { id: 'calledPocket', label: 'Cantar tronera', default: false, advanced: true, choices: [[true, 'Sí'], [false, 'No']] },
  { id: 'bestOf', label: 'Mejor de', default: 1, advanced: true, choices: [[1, '1'], [3, '3'], [5, '5']] },
  { id: 'shotSeconds', label: 'Tiempo por tiro', default: 0, advanced: true, choices: [[30, '30 s'], [60, '60 s'], [0, 'Sin límite']] },
  STARTER_FIELD,
];
export const defaultPoolOptions = () => optionDefaults(POOL_OPTIONS);
export const poolOptions = (current, patch) => applyRoomOptions(POOL_OPTIONS, current, patch);
export const teamOf = seat => seat % 2;
export const occupiedSeats = state => state.players.flatMap((p, i) => p.id === null ? [] : [i]);
export const playingSeats = state => state.activeSeats?.length ? state.activeSeats : occupiedSeats(state);
export function canStartPool(state) {
  if (state.practice) return state.players[0].id !== null;
  const seats = occupiedSeats(state), a = seats.filter(i => teamOf(i) === 0).length;
  return a > 0 && a * 2 === seats.length && (state.options.format !== 'duel' || seats.length === 2);
}
export const poolConnected = state => state.practice || playingSeats(state).length >= 2 && playingSeats(state).every(i => state.players[i].id !== null);
export function nextShooter(state, team) {
  const seats = playingSeats(state).filter(i => teamOf(i) === team);
  const last = state.teamTurns?.[team] ?? -1;
  return seats.find(i => i > last) ?? seats[0] ?? team;
}
export function passPoolTurn(state, keep = false) {
  if (!state.practice) {
    const team = teamOf(state.turn);
    state.teamTurns[team] = state.turn;
    state.turn = nextShooter(state, keep ? team : 1 - team);
  }
  state.turnElapsed = 0;
}
export function winPoolRack(state, team, reason) {
  const winner = team === null ? null : playingSeats(state).find(i => teamOf(i) === team);
  if (team !== null) state.scores[team]++;
  state.result = { winner, team, reason, matchFinished: state.practice || team === null || state.scores[team] >= Math.ceil(state.options.bestOf / 2) };
  state.phase = 'finished'; state.message = reason; state.shot = null; state.revision++;
}
