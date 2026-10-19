// Room options are validated against the same values shown in the lobby.
import { optionDefaults, normalizeRoomOptions, applyRoomOptions } from '../../../engine/room-options-rules.js';
export const OPTION_FIELDS = [
  // Solo minijuegos skips the board: `rounds` minigames back to back, +10 a win.
  { id: 'mode', label: 'Partida', default: 'board', choices: [['board', 'Con tablero'], ['minis', 'Solo minijuegos']] },
  { id: 'board', label: 'Tablero', default: 'isla', choices: [['isla', 'Isla del Mango'], ['muelle', 'Muelle']] },
  { id: 'rounds', label: 'Rondas', default: 10, choices: [[5, '5'], [10, '10'], [15, '15'], [20, '20']] },
  { id: 'minigames', label: 'Minijuegos', default: 'all', choices: [['all', 'Todos'], ['calm', 'Tranquilos']] },
  { id: 'startCoins', label: 'Monedas al inicio', default: 10, choices: [[10, '10'], [5, '5'], [20, '20']], advanced: true },
  { id: 'surprises', label: 'Casillas sorpresa', default: 'normal', choices: [['normal', 'Normal'], ['few', 'Pocas'], ['many', 'Muchas']], advanced: true },
  { id: 'stealing', label: 'Robar mangos', default: true, choices: [[true, 'Sí'], [false, 'No']], advanced: true },
  { id: 'finalBonus', label: 'Bonus final', default: true, choices: [[true, 'Sí'], [false, 'No']], advanced: true },
  { id: 'dice', label: 'Dados', default: 2, choices: [[1, '1'], [2, '2']], advanced: true },
  { id: 'cpu', label: 'Velocidad CPU', default: 'normal', choices: [['normal', 'Normal'], ['fast', 'Rápida']], advanced: true },
];
export const DEFAULT_OPTIONS = Object.freeze(optionDefaults(OPTION_FIELDS));
export const cleanOptions = (value = {}) => normalizeRoomOptions(OPTION_FIELDS, value);
export const applyOptions = (current, patch) => applyRoomOptions(OPTION_FIELDS, current, patch);
export const CALM_MINIGAMES = Object.freeze(['caida', 'embuste', 'criollas']);
export const minigamePool = (list, options) => options.minigames === 'calm' ? list.filter(m => CALM_MINIGAMES.includes(m.id)) : list;
// Bots' board turns run faster than a human's even at Normal: watching five
// bots roll and hop at full length made two thirds of a game waiting.
export const cpuPace = (options, humanTurn) => humanTurn ? 1 : options.cpu === 'fast' ? 2.5 : 1.5;

// Surprise frequency is visible on the tiles, not a hidden dice roll on landing.
export function configuredTileKind(index, original, frequency) {
  if (original === 'start' || original === 'tree') return original;
  if (frequency === 'normal') return original;
  if (frequency === 'few') return original === 'event' && index % 2 ? 'blue' : original;
  return index % 3 === 1 ? 'event' : original;
}

export function stealMango(players, taker, enabled) {
  if (!enabled) return null;
  const target = players.filter(p => p !== taker && p.mangos > 0)
    .sort((a, b) => b.mangos - a.mangos || b.coins - a.coins || a.i - b.i)[0];
  if (!target) return null;
  target.mangos--; taker.mangos++;
  return target;
}

// Most minigame victories earn one golden mango; a tie awards each leader.
export function awardFinalBonus(players, enabled) {
  if (!enabled) return [];
  const best = Math.max(...players.map(p => p.miniWins || 0));
  const winners = best > 0 ? players.filter(p => p.miniWins === best) : [];
  for (const p of winners) p.mangos++;
  return winners.map(p => p.i);
}

// The lobby's plain-language summary of what the chosen options mean.
export function rulesSummary(options, rounds) {
  const bonus = options.finalBonus ? ['Al final, quien haya ganado más minijuegos se lleva un Mango de oro extra.'] : [];
  if (options.mode === 'minis') return [`${rounds} minijuegos seguidos, sin tablero. Cada victoria vale 10 monedas.`, ...bonus];
  return [...(rounds <= 5 ? [`${rounds} rondas: una fiesta corta.`] : []), ...bonus, ...(options.stealing ? ['Ojo: una casilla sorpresa puede robarle un Mango de oro al pana que más tiene.'] : [])];
}
