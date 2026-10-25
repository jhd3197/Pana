import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  { id: 'mode', label: 'Jugar con', default: 'bots', choices: [['bots', 'Panas y bots'], ['panas', 'Solo panas']] },
  { id: 'pack', label: 'Tema', default: 'venezuela', choices: [['venezuela', 'Venezuela'], ['general', 'Cultura general'], ['todo', 'De todo']] },
  { id: 'questions', label: 'Preguntas', default: 12, choices: [[12, '12 y la final'], [8, '8 y la final']] },
  { id: 'seconds', label: 'Tiempo', default: 30, choices: [[30, '30 segundos'], [45, '45 segundos'], [20, '20 segundos'], [15, '15 segundos'], [10, '10 segundos']] },
  { id: 'bots', label: 'Nivel de bots', default: 'normal', advanced: true, choices: [['normal', 'Normales'], ['genios', 'Sabelotodo'], ['gafos', 'Despistados']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
