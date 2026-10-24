import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  { id: 'stage', label: 'Escenario', default: 'verdant-grove', choices: [['verdant-grove', 'La arboleda'], ['salto-angel', 'Salto Ángel'], ['catatumbo', 'Catatumbo'], ['los-roques', 'Los Roques']] },
  { id: 'seats', label: 'Luchadores (con bots)', default: 6, choices: [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']] },
  { id: 'stocks', label: 'Vidas', default: 3, choices: [[1, '1'], [3, '3'], [5, '5']] },
  { id: 'seconds', label: 'Tiempo límite', default: 180, choices: [[60, '1 min'], [180, '3 min'], [300, '5 min']] },
  { id: 'items', label: 'Objetos', default: true, choices: [[true, 'Sí'], [false, 'No']] },
  { id: 'level', label: 'Nivel de los bots', default: 2, choices: [[1, 'Suave'], [2, 'Normal'], [3, 'Bravo']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
