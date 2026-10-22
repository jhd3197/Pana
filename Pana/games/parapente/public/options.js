import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  { id: 'rivals', label: 'Pilotos del cerro', default: 'normal', choices: [['easy', 'Tranquilos'], ['normal', 'Normales'], ['hard', 'Bravos'], ['none', 'Ninguno']] },
  { id: 'guide', label: 'Flecha guía', default: true, choices: [[true, 'Sí'], [false, 'No']] },
  { id: 'thermals', label: 'Térmicas', default: 'normal', advanced: true, choices: [['weak', 'Flojas'], ['normal', 'Normales'], ['strong', 'Fuertes']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
