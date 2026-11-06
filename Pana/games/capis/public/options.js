// Match settings: the shared room panel (engine/room-options.js) drives them,
// even offline, so the lobby looks like every other game's.
import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY } from '../../../engine/play/difficulty.js';
import { loc } from '../../../engine/i18n.js';
import { TURN_SECONDS, FFA_SIZE } from './rules.js';
import { DEFAULT_SIZE } from './map-rules.js';

export const ROOM_OPTIONS = [
  { id: 'mode', label: loc('Modo'), default: 'teams', choices: [['teams', loc('Equipos')], ['ffa', loc('Todos contra todos')]] },
  { id: 'seconds', label: loc('Tiempo por turno'), default: 35, choices: TURN_SECONDS.map(s => [s, `${s} s`]) },
  { id: 'difficulty', label: loc('La máquina'), default: DEFAULT_DIFFICULTY, choices: DIFFICULTIES.map(d => [d.id, d.label]) },
  { id: 'size', label: loc('Tamaño del mapa'), default: DEFAULT_SIZE, choices: [['small', loc('Pequeño')], ['medium', loc('Mediano')], ['large', loc('Grande')]], visibleWhen: { mode: ['teams'] } },
];
export const defaultOptions = () => optionDefaults(ROOM_OPTIONS);
// A free-for-all is always on the big map.
export const roomOptions = (current, patch) => {
  const next = applyRoomOptions(ROOM_OPTIONS, current, patch);
  if (next?.mode === 'ffa') next.size = FFA_SIZE;
  return next;
};
