import { botLevel } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
export const ROOM_OPTIONS = [
  // Stage names are place names and stay Spanish.
  { id: 'stage', label: loc('Escenario'), default: 'verdant-grove', choices: [['verdant-grove', 'La arboleda'], ['salto-angel', 'Salto Ángel'], ['catatumbo', 'Catatumbo'], ['los-roques', 'Los Roques']] }, // i18n-ignore
  { id: 'seats', label: loc('Puestos (se completan con bots)'), default: 6, choices: [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']] },
  { id: 'stocks', label: loc('Vidas'), default: 3, choices: [[1, '1'], [3, '3'], [5, '5']] },
  { id: 'seconds', label: loc('Tiempo por ronda'), default: 180, choices: [[60, '1 min'], [180, '3 min'], [300, '5 min']] },
  { id: 'items', label: loc('Objetos'), default: true, choices: [[true, loc('Sí')], [false, 'No']] },
  botLevel('level', 1, 2, 3),
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
