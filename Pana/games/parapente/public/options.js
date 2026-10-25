import { botParticipation, botLevel, migrateRivals } from '../../../engine/room-option-fields.js';
export { migrateRivals };
import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
export const ROOM_OPTIONS = [
  botParticipation(),
  botLevel('rivals', 'easy', 'normal', 'hard', { visibleWhen: { bots: [true] } }),
  { id: 'guide', label: 'Flecha guía', default: true, choices: [[true, 'Sí'], [false, 'No']] },
  { id: 'thermals', label: 'Térmicas', default: 'normal', advanced: true, choices: [['weak', 'Flojas'], ['normal', 'Normales'], ['strong', 'Fuertes']] },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
export const roomOptions = (current, patch) => applyRoomOptions(ROOM_OPTIONS, migrateRivals(current), migrateRivals(patch));
