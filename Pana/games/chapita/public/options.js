import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
export const ROOM_OPTIONS = [
  { id: 'mode', label: loc('Modo'), default: 'caimanera', choices: [['caimanera', loc('Caimanera')], ['derby', loc('¡Jonrón! (derby)')]] },
  { id: 'innings', label: loc('Entradas'), default: 3, choices: [[3, loc('3 entradas')], [5, loc('5 entradas')], [7, loc('7 entradas')]] },
  { id: 'map', label: loc('Campo'), default: 'calle', choices: [['calle', 'La calle del barrio'], ['cancha', 'La cancha del bloque']] },   // i18n-ignore: map names
  { id: 'houseRules', label: loc('Reglas de la casa'), default: 'ruleta', choices: [['ruleta', loc('Ruleta')], ['ninguna', loc('Sin reglas extra')]] },
  { id: 'equipo', label: loc('Equipo'), default: 'chapita', choices: [['chapita', loc('Chapita y escoba')], ['pelota', loc('Pelota y bate')]] },
  { id: 'caps', label: loc('Chapitas'), default: 'libre', advanced: true, choices: [['libre', loc('Elige el pitcher')], ['plana', loc('Solo planas')], ['doblada', loc('Solo dobladas')]] },
  { id: 'cpuSeconds', label: loc('Velocidad de bots'), default: 1.2, advanced: true, choices: [[1.2, loc('Normal')], [.5, loc('Rápida')]] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
