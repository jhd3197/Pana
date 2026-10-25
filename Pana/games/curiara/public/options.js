import { botParticipation } from '../../../engine/room-option-fields.js';
import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
const field = (id, label, choices, value = choices[0][0], advanced = false) => ({ id, label, choices, default: value, advanced });
export const FIELDS = [
  botParticipation(),
  field('river', 'Río', [['amazonas', 'Amazonas'], ['caroni', 'Caroní'], ['orinoco', 'Orinoco']]),
  field('rapids', 'Rápidos', [['easy', 'Suaves'], ['hard', 'Bravos']], 'hard'),
  field('guide', 'Guía en el agua', [[true, 'Sí'], [false, 'No']], true),
  field('crew', 'Modo', [['todos', 'Individual'], ['duos', 'En pareja · 2×2'], ['triples', '2×2×2'], ['parejas', '2×2×2×2']]),
  field('current', 'Corriente', [['normal', 'Normal'], ['slow', 'Lenta'], ['hard', 'Brava']], 'normal', true),
  field('paddling', 'Remadas', [['tap', 'Toque'], ['rhythm', 'Ritmo']], 'rhythm', true),
  field('items', 'Objetos del río', [[true, 'Sí'], [false, 'No']], true, true),
  field('falls', 'Cascadas', [[true, 'Sí'], [false, 'No']], true, true),
  field('collisions', 'Choques', [['soft', 'Suaves'], ['hard', 'Fuertes']], 'hard', true),
  field('steeringHelp', 'Ayuda de dirección', [[true, 'Sí'], [false, 'No']], false, true),
];
export function cleanOptions(raw = {}) {
  return normalizeRoomOptions(FIELDS, raw);
}
