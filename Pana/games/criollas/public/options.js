import { DIFFICULTIES } from '../../../engine/difficulty.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
export const CRIOLLAS_OPTIONS = [
  { id: 'target', label: 'Meta de la partida', default: 12, choices: [[12, '12 tantos'], [24, '24 tantos']] },
  { id: 'difficulty', label: 'Dificultad', default: 'normal', choices: DIFFICULTIES.map(d => [d.id, d.label]) },
  { id: 'ballsPerPlayer', label: 'Bolas por pana', default: 4, advanced: true, choices: [[2, '2 · mano corta'], [4, '4 · mano completa']] },
];
export const criollasOptions = (state, patch) => applyRoomOptions(CRIOLLAS_OPTIONS, state, patch);
