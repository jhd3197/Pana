import { botParticipation, botLevel } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
import { PACKS } from './categories.js';
import { loc, locn } from '../../../engine/i18n.js';
// Stop rápido plays three categories in 30 s and ignores count and seconds.
// `set` is the pack; the lobby shows it as a picker (game.js), not buttons.
export const ROOM_OPTIONS = [
  botParticipation('withBots'),
  { id: 'mode', label: loc('Modo'), default: 'normal', choices: [['normal', loc('Normal')], ['rapido', loc('Stop rápido')]] },
  { id: 'set', label: loc('Categorías'), default: 'clasicas', choices: PACKS.map(p => [p.id, loc(p.name)]) },
  { id: 'rounds', label: loc('Rondas'), default: 5, advanced: true, choices: [3, 5, 7].map(n => [n, locn(n, '{n} ronda', '{n} rondas')]) },
  { id: 'count', label: loc('Cuántas categorías'), default: 8, advanced: true, choices: [[6, '6'], [7, '7'], [8, '8'], [9, '9'], [10, '10']] },
  { id: 'seconds', label: loc('Tiempo para escribir'), default: 90, advanced: true, choices: [[60, '60 s'], [90, '90 s'], [120, '2 min']] },
  { id: 'letters', label: loc('Letras'), default: 'normales', choices: [['faciles', loc('Fáciles')], ['normales', loc('Normales')], ['todas', loc('Todas (con Ñ, Q, X…)')]] },
  { id: 'cep', label: loc('Ciudad, estado y país'), default: false, advanced: true, choices: [[false, loc('Cada una aparte')], [true, loc('En una sola casilla')]] },
  { id: 'criollo', label: loc('Más criollo'), default: false, advanced: true, choices: [[false, loc('Apto para todos')], [true, loc('Sin filtro')]] },
  botLevel('bots', 'faciles', 'normales', 'dificiles', { advanced: true, visibleWhen: { withBots: [true] } }),
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
