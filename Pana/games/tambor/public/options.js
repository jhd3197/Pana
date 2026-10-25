import { botLevel } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  { id: 'mode', label: 'Modo', default: 'rueda', choices: [['rueda', 'La Rueda'], ['relevo', 'Relevo'], ['toque', 'Toque libre'], ['golpe', '¡Golpe!']] },
  { id: 'songs', label: 'Canciones', default: 3, choices: [[1, 'Una'], [3, 'Tres'], [5, 'Cinco']] },
  { id: 'place', label: 'Lugar', default: 'playa', choices: [['playa', 'La casita rosada'], ['malecon', 'El malecón de noche']] },
  { id: 'misses', label: 'Fallas para salir', default: 3, advanced: true, choices: [[2, 'Dos'], [3, 'Tres'], [5, 'Cinco']] },
  botLevel('bots', 'facil', 'normal', 'duro', { advanced: true }),
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
