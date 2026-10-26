import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
import { loc } from '../../../engine/i18n.js';

export const POOL_OPTIONS = [
  { id: 'variant', label: loc('Modo'), default: 'eight', choices: [['eight', loc('Bola 8')], ['nine', loc('Bola 9')]] },
  { id: 'format', label: loc('Jugadores'), default: 'teams', choices: [['duel', loc('Individual · 1 contra 1')], ['teams', loc('Por equipos')]] },
  { id: 'venue', label: loc('Mesa'), default: 'plaza', choices: [['plaza', loc('Plaza')], ['cafe', loc('Café')]] },
  { id: 'guide', label: loc('Ayuda de tiro'), default: 'difficulty', choices: [['difficulty', loc('Según dificultad')], ['long', loc('Larga')], ['short', loc('Corta')], ['none', loc('Sin ayuda')]] },
  { id: 'breakPolicy', label: loc('Saque'), default: 'alternate', advanced: true, choices: [['alternate', loc('Alterno')], ['winner', loc('Ganador')], ['loser', loc('Perdedor')]] },
  { id: 'foulPlacement', label: loc('Falta'), default: 'anywhere', advanced: true, choices: [['anywhere', loc('Bola en mano')], ['kitchen', loc('Cocina')]] },
  { id: 'calledPocket', label: loc('Cantar tronera'), default: false, advanced: true, choices: [[true, loc('Sí')], [false, loc('No')]] },
  { id: 'bestOf', label: loc('Mejor de'), default: 1, advanced: true, choices: [[1, '1'], [3, '3'], [5, '5']] },
  { id: 'shotSeconds', label: loc('Tiempo por tiro'), default: 0, advanced: true, choices: [[30, '30 s'], [60, '60 s'], [0, loc('Sin límite')]] },
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
