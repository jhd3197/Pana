import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  { id: 'floors', label: 'Pisos', default: 3, choices: [[2, '2'], [3, '3'], [4, '4']], advanced: false },
  { id: 'difficulty', label: 'Dificultad', default: 'normal', choices: [['easy', 'Tranquila'], ['normal', 'Normal'], ['hard', 'Momia brava']], advanced: false },
  { id: 'greed', label: 'La codicia', default: 'normal', choices: [['soft', 'Paciente'], ['normal', 'Normal'], ['fierce', 'Celosa']], advanced: false },
  { id: 'revive', label: 'Revivir pana', default: true, choices: [[true, 'Sí'], [false, 'No']], advanced: true },
  { id: 'wipeShare', label: 'Si caen todos', default: 20, choices: [[20, 'Se salva 20 %'], [0, 'Se pierde todo'], [50, 'Se salva la mitad']], advanced: true },
  { id: 'map', label: 'Mapa', default: true, choices: [[true, 'Visible'], [false, 'Escondido']], advanced: true },
  { id: 'crude', label: 'Frases', default: false, choices: [[false, 'Sanas'], [true, 'Más criollas']], advanced: true },
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
