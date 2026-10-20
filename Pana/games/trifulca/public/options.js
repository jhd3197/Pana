import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
export const ARENA_CHOICES = [['calle', 'La calle'], ['toldo', 'El toldo'], ['mercado', 'El mercado'], ['motos', 'Las motos']];
export const ROOM_OPTIONS = [
  { id: 'arena', label: 'Arena', default: 'calle', choices: ARENA_CHOICES },
  { id: 'peleas', label: 'Peleas en la noche', default: 8, choices: [[5, '5'], [8, '8'], [12, '12']] },
  { id: 'seconds', label: 'Campana', default: 60, advanced: true, choices: [[45, '45 s'], [60, '60 s'], [90, '90 s']] },
  { id: 'rivales', label: 'Bots en la cola', default: -1, advanced: true, choices: [[-1, 'Auto'], [0, 'Ninguno'], [2, 'Dos'], [4, 'Cuatro']] },
  { id: 'nivel', label: 'Bots', default: 1, advanced: true, choices: [[0, 'Tranquilos'], [1, 'Normales'], [2, 'Bravos']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
