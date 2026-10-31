import { botParticipation, botLevel } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '/engine/room-options-rules.js';
import { loc, locn } from '../../../engine/i18n.js';
const seconds = n => locn(n, '{n} segundo', '{n} segundos');
export const ROOM_OPTIONS = [
  botParticipation('mode', 'bots', 'panas'),
  { id: 'pack', label: loc('Tema'), default: 'venezuela', choices: [['venezuela', 'Venezuela'], ['general', loc('Cultura general')], ['todo', loc('De todo')]] },
  { id: 'questions', label: loc('Preguntas'), default: 12, choices: [[12, loc('12 y la final')], [8, loc('8 y la final')]] },
  { id: 'seconds', label: loc('Tiempo por pregunta'), default: 30, choices: [[30, seconds(30)], [45, seconds(45)], [20, seconds(20)], [15, seconds(15)], [10, seconds(10)]] },
  botLevel('bots', 'gafos', 'normal', 'genios', { advanced: true, visibleWhen: { mode: ['bots'] } }),
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, current, patch);
