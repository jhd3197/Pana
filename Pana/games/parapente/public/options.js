import { botParticipation, botLevel, migrateRivals } from '../../../engine/room-option-fields.js';
export { migrateRivals };
import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
export const ROOM_OPTIONS = [
  botParticipation(),
  botLevel('rivals', 'easy', 'normal', 'hard', { visibleWhen: { bots: [true] } }),
  { id: 'guide', label: loc('Flecha guía'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]] },
  { id: 'thermals', label: loc('Térmicas'), default: 'normal', advanced: true, choices: [['weak', loc('Flojas')], ['normal', loc('Normales')], ['strong', loc('Fuertes')]] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, migrateRivals(current), migrateRivals(patch));
