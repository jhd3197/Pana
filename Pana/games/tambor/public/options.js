import { botLevel } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
export const ROOM_OPTIONS = [
  { id: 'mode', label: loc('Modo'), default: 'rueda', choices: [['rueda', loc('La Rueda')], ['relevo', loc('Relevo')], ['toque', loc('Toque libre')], ['golpe', loc('¡Golpe!')]] },
  { id: 'songs', label: loc('Canciones'), default: 3, choices: [[1, loc('Una')], [3, loc('Tres')], [5, loc('Cinco')]] },
  { id: 'place', label: loc('Lugar'), default: 'playa', choices: [['playa', 'La casita rosada'], ['malecon', 'El malecón de noche']] }, // i18n-ignore: place names
  { id: 'misses', label: loc('Fallas para salir'), default: 3, advanced: true, choices: [[2, loc('Dos')], [3, loc('Tres')], [5, loc('Cinco')]] },
  botLevel('bots', 'facil', 'normal', 'duro', { advanced: true }),
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
