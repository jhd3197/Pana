import { DIFFICULTIES } from '../../../engine/play/difficulty.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
import { loc } from '../../../engine/i18n.js';
export const CRIOLLAS_OPTIONS = [
  { id: 'target', label: loc('Meta de la partida'), default: 12, choices: [[12, loc('12 tantos')], [24, loc('24 tantos')]] },
  { id: 'difficulty', label: loc('Dificultad'), default: 'normal', choices: DIFFICULTIES.map(d => [d.id, d.label]) },
  { id: 'ballsPerPlayer', label: loc('Bolas por pana'), default: 4, advanced: true, choices: [[2, loc('2 · mano corta')], [4, loc('4 · mano completa')]] },
  { id: 'turnSeconds', label: loc('Tiempo por turno'), default: 60, advanced: true, choices: [[30, '30 s'], [60, '60 s'], [0, loc('Sin límite')]] },
  // ¿Quién empieza? Saved as 'opener': the state's 'starter' is the team opening each hand.
  { ...STARTER_FIELD, id: 'opener', choices: STARTER_FIELD.choices.map(([v, label]) => [v, v === 'cacho' ? loc('Moneda') : v === 'revancha' ? loc('Revancha: el equipo que perdió') : label]) },
];
export const criollasOptions = (state, patch) => applyRoomOptions(CRIOLLAS_OPTIONS, state, patch);
