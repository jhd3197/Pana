import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
import { loc } from '../../../engine/i18n.js';
export const LUDO_OPTIONS = [
  // Five and six seats play on a star board; empty seats are bots.
  { id: 'seats', label: loc('Jugadores'), default: 4, choices: [[4, '4'], [5, '5'], [6, '6']] },
  { id: 'entry', label: loc('Salir del patio'), default: 'six', choices: [['six', loc('Con un 6')], ['one-six', loc('Con 1 o 6')]] },
  // A 1 that moves earns another roll, at most three extra rolls in a row
  // (EXTRA_ONE_CAP in rules.js). Read as `!== false`: older rooms get it on.
  { id: 'extraOnOne', label: loc('Tirar otra vez con un 1 (máx. 3 seguidas)'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]] },
  { id: 'captureBonus', label: loc('Tirar otra vez al capturar'), default: false, advanced: true, choices: [[false, loc('No')], [true, loc('Sí')]] },
  { id: 'threeSixes', label: loc('Tres seis seguidos pierden turno'), default: true, advanced: true, choices: [[true, loc('Sí')], [false, loc('No')]] },
  { id: 'assistedEntry', label: loc('Salida asistida'), default: true, advanced: true, choices: [[true, loc('Ayuda tras 3–5 intentos')], [false, loc('Azar clásico')]] },
  { id: 'turnSeconds', label: loc('Tiempo por turno'), default: 60, advanced: true, choices: [[30, '30 s'], [60, '60 s'], [0, loc('Sin límite')]] },
  STARTER_FIELD,
];
export const defaultLudoOptions = () => optionDefaults(LUDO_OPTIONS);
export const ludoOptions = (current, patch) => applyRoomOptions(LUDO_OPTIONS, current, patch);
