import { botLevel } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
export const ARENA_CHOICES = [['calle', 'La calle'], ['toldo', 'El toldo'], ['mercado', 'El mercado'], ['motos', 'Las motos'], ['manga', 'La manga'], ['cebra', 'El paso de cebra'], ['colonial', 'La colonial']];
export const MODE_CHOICES = [['queda', 'Ganador se queda'], ['libre', 'Trifulca libre'], ['parejas', 'Parejas'], ['torneo', 'Torneo']];
export const ROOM_OPTIONS = [
  { id: 'modo', label: 'Modo', default: 'queda', choices: MODE_CHOICES },
  { id: 'arena', label: 'Arena', default: 'calle', choices: ARENA_CHOICES },
  { id: 'peleas', label: 'Peleas en la noche', default: 8, choices: [[5, '5'], [8, '8'], [12, '12']] },
  { id: 'seconds', label: 'Tiempo por pelea', default: 60, advanced: true, choices: [[45, '45 s'], [60, '60 s'], [90, '90 s']] },
  { id: 'rivales', label: 'Bots adicionales', default: -1, advanced: true, choices: [[-1, 'Automáticos'], [0, 'Ninguno'], [2, '2'], [4, '4']] },
  botLevel('nivel', 0, 1, 2, { advanced: true }),
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
