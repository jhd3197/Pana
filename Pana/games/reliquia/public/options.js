import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  { id: 'difficulty', label: loc('Dificultad'), default: 'normal', choices: [['easy', loc('Tranquila')], ['normal', loc('Normal')], ['hard', loc('Momia brava')]], advanced: false },
  { id: 'greed', label: loc('La codicia'), default: 'normal', choices: [['soft', loc('Paciente')], ['normal', loc('Normal')], ['fierce', loc('Celosa')]], advanced: false },
  { id: 'revive', label: loc('Revivir pana'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]], advanced: true },
  { id: 'wipeShare', label: loc('Si caen todos'), default: 20, choices: [[20, loc('Se salva 20 %')], [0, loc('Se pierde todo')], [50, loc('Se salva la mitad')]], advanced: true },
  { id: 'map', label: loc('Mapa'), default: true, choices: [[true, loc('Visible')], [false, loc('Escondido')]], advanced: true },
  { id: 'crude', label: loc('Frases'), default: false, choices: [[false, loc('Sanas')], [true, loc('Más criollas')]], advanced: true },
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
