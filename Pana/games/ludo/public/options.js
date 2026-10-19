import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
export const LUDO_OPTIONS = [
  { id: 'entry', label: 'Salir del patio', default: 'six', choices: [['six', 'Con un 6'], ['one-six', 'Con 1 o 6']] },
  { id: 'captureBonus', label: 'Tirar otra vez al capturar', default: false, advanced: true, choices: [[false, 'No'], [true, 'Sí']] },
  { id: 'threeSixes', label: 'Tres seis seguidos pierden turno', default: true, advanced: true, choices: [[true, 'Sí'], [false, 'No']] },
];
export const defaultLudoOptions = () => optionDefaults(LUDO_OPTIONS);
export const ludoOptions = (current, patch) => applyRoomOptions(LUDO_OPTIONS, current, patch);
