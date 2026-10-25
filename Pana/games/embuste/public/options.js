import { botParticipation } from '../../../engine/room-option-fields.js';
import { applyRoomOptions, optionDefaults } from '../../../engine/room-options-rules.js';
export const EMBUSTE_OPTIONS = [
  botParticipation(),
  { id: 'reveal', label: 'Revelar el papel del expulsado', default: true, advanced: true, choices: [[true, 'Sí'], [false, 'No']] },
  { id: 'chat', label: 'Chat libre en las reuniones', default: true, advanced: true, choices: [[true, 'Sí'], [false, 'Solo frases']] },
];
export const defaultEmbusteOptions = () => optionDefaults(EMBUSTE_OPTIONS);
export const embusteOptions = (current, patch) => applyRoomOptions(EMBUSTE_OPTIONS, current, patch);
