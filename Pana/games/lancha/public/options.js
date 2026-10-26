import { botParticipation, botLevel, migrateRivals } from '../../../engine/room-option-fields.js';
export { migrateRivals };
import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
const field = (id, label, choices, value = choices[0][0], advanced = false) => ({ id, label, choices, default: value, advanced });
export const FIELDS = [
  field('throttle', loc('Acelerador'), [['hold', loc('Sostener W')], ['auto', loc('Automático')]]),
  field('guide', loc('Guía en el agua'), [[true, loc('Sí')], [false, loc('No')]], true),
  botParticipation(),
  botLevel('rivals', 'easy', 'normal', 'hard', { visibleWhen: { bots: [true] } }),
  field('steeringHelp', loc('Ayuda de dirección'), [[true, loc('Sí')], [false, loc('No')]], true, true),
  field('current', loc('Corriente'), [['normal', loc('Normal')], ['slow', loc('Lenta')], ['hard', loc('Brava')]], 'normal', true),
  field('items', loc('Objetos del río'), [[true, loc('Sí')], [false, loc('No')]], true, true),
  field('falls', loc('Raudales'), [[true, loc('Sí')], [false, loc('No')]], true, true),
  field('collisions', loc('Choques'), [['soft', loc('Suaves')], ['hard', loc('Fuertes')]], 'hard', true),
];
export function cleanOptions(raw = {}) {
  return normalizeRoomOptions(FIELDS, migrateRivals(raw));
}
