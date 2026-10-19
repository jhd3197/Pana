import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
// Stop rápido plays three categories in 30 s and ignores count and seconds.
export const ROOM_OPTIONS = [
  { id: 'mode', label: 'Partida', default: 'normal', choices: [['normal', 'Normal'], ['rapido', 'Stop rápido']] },
  { id: 'set', label: 'Categorías', default: 'clasicas', choices: [['clasicas', 'Clásicas'], ['criollas', 'Criollas'], ['mezcla', 'Mezcla'], ['azar', 'Al azar']] },
  { id: 'rounds', label: 'Rondas', default: 5, advanced: true, choices: [[3, '3 rondas'], [5, '5 rondas'], [7, '7 rondas']] },
  { id: 'count', label: 'Cuántas categorías', default: 8, advanced: true, choices: [[6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10']] },
  { id: 'seconds', label: 'Tiempo para escribir', default: 90, advanced: true, choices: [[60, '60 s'], [90, '90 s'], [120, '2 min']] },
  { id: 'hard', label: 'Letras difíciles (Ñ, Q, W, X, Y, Z)', default: false, advanced: true, choices: [[false, 'Fuera'], [true, 'Adentro']] },
  { id: 'criollo', label: 'Más criollo', default: false, advanced: true, choices: [[false, 'Apto para todos'], [true, 'Sin filtro']] },
  { id: 'bots', label: 'Bots', default: 'normales', advanced: true, choices: [['faciles', 'Tranquilos'], ['normales', 'Normales'], ['dificiles', 'Cuarto bate']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
