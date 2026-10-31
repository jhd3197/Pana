// Room options are validated against the same values shown in the lobby.
import { optionDefaults, normalizeRoomOptions, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
import { loc } from '../../../engine/i18n.js';
export const OPTION_FIELDS = [
  // Solo minijuegos skips the board: `rounds` minigames back to back, +10 a win.
  { id: 'mode', label: loc('Modo'), default: 'board', choices: [['board', loc('Con tablero')], ['minis', loc('Solo minijuegos')]] },
  { id: 'board', label: loc('Tablero'), default: 'isla', choices: [['isla', 'Isla del Mango'], ['muelle', 'Muelle']] },   // i18n-ignore: board names
  { id: 'rounds', label: loc('Rondas'), default: 10, choices: [[5, '5'], [10, '10'], [15, '15'], [20, '20']] },
  { id: 'minigames', label: loc('Minijuegos'), default: 'all', choices: [['all', loc('Todos')], ['calm', loc('Tranquilos')]] },
  { id: 'startCoins', label: loc('Monedas al inicio'), default: 10, choices: [[10, '10'], [5, '5'], [20, '20']], advanced: true },
  { id: 'surprises', label: loc('Casillas sorpresa'), default: 'normal', choices: [['normal', loc('Normal')], ['few', loc('Pocas')], ['many', loc('Muchas')]], advanced: true },
  { id: 'stealing', label: loc('Robar mangos'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]], advanced: true },
  { id: 'finalBonus', label: loc('Bonus final'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]], advanced: true },
  { id: 'dice', label: loc('Dados'), default: 2, choices: [[1, '1'], [2, '2']], advanced: true },
  { id: 'cpu', label: loc('Velocidad de bots'), default: 'normal', choices: [['normal', loc('Normal')], ['fast', loc('Rápida')]], advanced: true },
  STARTER_FIELD,
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
  const bonus = options.finalBonus ? [loc('Al final, quien haya ganado más minijuegos se lleva un Mango de oro extra.')] : [];
  if (options.mode === 'minis') return [loc('{n} minijuegos seguidos, sin tablero. Cada victoria vale 10 monedas.', { n: rounds }), ...bonus];
  return [...(rounds <= 5 ? [loc('{n} rondas: una fiesta corta.', { n: rounds })] : []), ...bonus, ...(options.stealing ? [loc('Ojo: una casilla sorpresa puede robarle un Mango de oro al pana que más tiene.')] : [])];
}
