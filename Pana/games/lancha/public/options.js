import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
const field = (id, label, choices, value = choices[0][0], advanced = false) => ({ id, label, choices, default: value, advanced });
export const FIELDS = [
  field('throttle', 'Acelerador', [['hold', 'Sostener W'], ['auto', 'Automático']]),
  field('guide', 'Guía en el agua', [[true, 'Sí'], [false, 'No']], true),
  field('rivals', 'Lanchas del río', [['easy', 'Tranquilas'], ['normal', 'Normales'], ['hard', 'Bravas'], ['none', 'Ninguna']], 'normal'),
  field('steeringHelp', 'Ayuda de dirección', [[true, 'Sí'], [false, 'No']], true, true),
  field('current', 'Corriente', [['normal', 'Normal'], ['slow', 'Lenta'], ['hard', 'Brava']], 'normal', true),
  field('items', 'Objetos del río', [[true, 'Sí'], [false, 'No']], true, true),
  field('falls', 'Raudales', [[true, 'Sí'], [false, 'No']], true, true),
  field('collisions', 'Choques', [['soft', 'Suaves'], ['hard', 'Fuertes']], 'hard', true),
];
export function cleanOptions(raw = {}) {
  return normalizeRoomOptions(FIELDS, raw);
}
