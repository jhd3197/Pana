import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  { id: 'mode', label: 'Modo', default: 'caimanera', choices: [['caimanera', 'Caimanera'], ['derby', '¡Jonrón! (derby)']] },
  { id: 'innings', label: 'Entradas', default: 3, choices: [[3, '3 entradas'], [5, '5 entradas'], [7, '7 entradas']] },
  { id: 'map', label: 'Campo', default: 'calle', choices: [['calle', 'La calle del barrio'], ['cancha', 'La cancha del bloque']] },
  { id: 'houseRules', label: 'Reglas de la casa', default: 'ruleta', choices: [['ruleta', 'Ruleta'], ['ninguna', 'Sin reglas extra']] },
  { id: 'caps', label: 'Chapitas', default: 'libre', advanced: true, choices: [['libre', 'Elige el pitcher'], ['plana', 'Solo planas'], ['doblada', 'Solo dobladas']] },
  { id: 'cpuSeconds', label: 'Velocidad de bots', default: 1.2, advanced: true, choices: [[1.2, 'Normal'], [.5, 'Rápida']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
