import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
export const FIELDS = [
  { id: 'format', label: 'Cómo jugamos', default: 'individual', choices: [['individual', 'Individual'], ['teams', 'Equipos']] },
  { id: 'cantos', label: 'Cantos clásicos', default: true, choices: [[true, 'Con cantos'], [false, 'Sin cantos']], advanced: true },
  { id: 'difficulty', label: 'Los bots', default: 'normal', choices: [['easy', 'Tranquilos'], ['normal', 'Pilas'], ['hard', 'Memoriosos']], advanced: true },
  { ...STARTER_FIELD, label: '¿Quién reparte primero?' },
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
