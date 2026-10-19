import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';

export const OPTION_FIELDS = [
  { id: 'stack', label: 'Fichas', default: 1000, choices: [[1000, '1.000'], [5000, '5.000']] },
  { id: 'blinds', label: 'Ciegas', default: 20, choices: [[20, '10/20'], [100, '50/100']] },
  { id: 'turnSeconds', label: 'Turno', default: 20, choices: [[20, '20 s'], [40, '40 s']] },
  { id: 'variant', label: 'Variante', default: 'texas', choices: [['texas', 'Texas'], ['omaha', 'Omaha']], advanced: true },
  { id: 'blindMinutes', label: 'Subida de ciegas', default: 0, choices: [[5, 'Cada 5 min'], [10, 'Cada 10 min'], [0, 'Nunca']], advanced: true },
  { id: 'rebuy', label: 'Recompras', default: true, choices: [[true, 'Sí'], [false, 'No']], advanced: true },
  { id: 'showCards', label: 'Mostrar cartas al final', default: true, choices: [[true, 'Sí'], [false, 'No']], advanced: true },
  { id: 'limit', label: 'Límite', default: 'none', choices: [['none', 'Sin límite'], ['pot', 'Bote'], ['fixed', 'Fijo']], advanced: true },
];
export const DEFAULT_OPTIONS = Object.freeze(optionDefaults(OPTION_FIELDS));
export const changeOptions = (current, patch) => applyRoomOptions(OPTION_FIELDS, current, patch);
