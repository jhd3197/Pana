import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
import { loc } from '../../../engine/i18n.js';

export const OPTION_FIELDS = [
  { id: 'stack', label: loc('Fichas'), default: 1000, choices: [[1000, '1.000'], [5000, '5.000']] },
  { id: 'blinds', label: loc('Ciegas'), default: 20, choices: [[20, '10/20'], [100, '50/100']] },
  { id: 'turnSeconds', label: loc('Tiempo por turno'), default: 20, choices: [[20, '20 s'], [40, '40 s']] },
  { id: 'variant', label: loc('Variante'), default: 'texas', choices: [['texas', 'Texas'], ['omaha', 'Omaha']], advanced: true },
  { id: 'blindMinutes', label: loc('Subida de ciegas'), default: 0, choices: [[5, loc('Cada 5 min')], [10, loc('Cada 10 min')], [0, loc('Nunca')]], advanced: true },
  { id: 'rebuy', label: loc('Recompras'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]], advanced: true },
  { id: 'showCards', label: loc('Mostrar cartas al final'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]], advanced: true },
  { id: 'limit', label: loc('Límite'), default: 'none', choices: [['none', loc('Sin límite')], ['pot', loc('Bote')], ['fixed', loc('Fijo')]], advanced: true },
  STARTER_FIELD,
];
export const DEFAULT_OPTIONS = Object.freeze(optionDefaults(OPTION_FIELDS));
export const changeOptions = (current, patch) => applyRoomOptions(OPTION_FIELDS, current, patch);
