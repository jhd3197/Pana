import { botParticipation } from '../../../engine/room-option-fields.js';
import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
const field = (id, label, choices, value = choices[0][0], advanced = false) => ({ id, label, choices, default: value, advanced });
export const FIELDS = [
  botParticipation(),
  field('river', loc('Río'), [['amazonas', 'Amazonas'], ['caroni', 'Caroní'], ['orinoco', 'Orinoco']]), // i18n-ignore: river names
  field('rapids', loc('Rápidos'), [['easy', loc('Suaves')], ['hard', loc('Bravos')]], 'hard'),
  field('guide', loc('Guía en el agua'), [[true, loc('Sí')], [false, loc('No')]], true),
  field('crew', loc('Modo'), [['todos', loc('Individual')], ['duos', loc('En pareja · 2×2')], ['triples', '2×2×2'], ['parejas', '2×2×2×2']]),
  field('current', loc('Corriente'), [['normal', loc('Normal')], ['slow', loc('Lenta')], ['hard', loc('Brava')]], 'normal', true),
  field('paddling', loc('Remadas'), [['tap', loc('Toque')], ['rhythm', loc('Ritmo')]], 'rhythm', true),
  field('items', loc('Objetos del río'), [[true, loc('Sí')], [false, loc('No')]], true, true),
  field('falls', loc('Cascadas'), [[true, loc('Sí')], [false, loc('No')]], true, true),
  field('collisions', loc('Choques'), [['soft', loc('Suaves')], ['hard', loc('Fuertes')]], 'hard', true),
  field('steeringHelp', loc('Ayuda de dirección'), [[true, loc('Sí')], [false, loc('No')]], false, true),
];
export function cleanOptions(raw = {}) {
  return normalizeRoomOptions(FIELDS, raw);
}
