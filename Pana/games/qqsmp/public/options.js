import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  { id: 'pack', label: 'Tema', default: 'venezuela', choices: [['venezuela', 'Venezuela'], ['general', 'Cultura general'], ['todo', 'De todo']] },
  { id: 'questions', label: 'Preguntas', default: 12, choices: [[12, '12 y la final'], [8, '8 y la final']] },
  { id: 'seconds', label: 'Tiempo', default: 15, choices: [[15, '15 segundos'], [10, '10 segundos'], [20, '20 segundos']] },
  { id: 'bots', label: 'Bots', default: 'normal', advanced: true, choices: [['normal', 'Normales'], ['genios', 'Sabelotodo'], ['gafos', 'Despistados']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
