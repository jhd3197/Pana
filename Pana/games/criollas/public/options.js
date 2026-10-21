import { DIFFICULTIES } from '../../../engine/play/difficulty.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
export const CRIOLLAS_OPTIONS = [
  { id: 'target', label: 'Meta de la partida', default: 12, choices: [[12, '12 tantos'], [24, '24 tantos']] },
  { id: 'difficulty', label: 'Dificultad', default: 'normal', choices: DIFFICULTIES.map(d => [d.id, d.label]) },
  { id: 'ballsPerPlayer', label: 'Bolas por pana', default: 4, advanced: true, choices: [[2, '2 · mano corta'], [4, '4 · mano completa']] },
  // ¿Quién empieza? Saved as 'opener': the state's 'starter' is the team opening each hand.
  { ...STARTER_FIELD, id: 'opener', choices: STARTER_FIELD.choices.map(([v, label]) => [v, v === 'cacho' ? 'Moneda' : v === 'revancha' ? 'Revancha: el equipo que perdió' : label]) },
];
export const criollasOptions = (state, patch) => applyRoomOptions(CRIOLLAS_OPTIONS, state, patch);
