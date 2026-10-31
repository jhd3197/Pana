import { botParticipation } from '../../../engine/room-option-fields.js';
import { applyRoomOptions, optionDefaults } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
export const EMBUSTE_OPTIONS = [
  botParticipation(),
  { id: 'reveal', label: loc('Revelar el papel del expulsado'), default: true, advanced: true, choices: [[true, loc('Sí')], [false, loc('No')]] },
  { id: 'chat', label: loc('Chat libre en las reuniones'), default: true, advanced: true, choices: [[true, loc('Sí')], [false, loc('Solo frases')]] },
];
export const defaultEmbusteOptions = () => optionDefaults(EMBUSTE_OPTIONS);
export const embusteOptions = (current, patch) => applyRoomOptions(EMBUSTE_OPTIONS, current, patch);
