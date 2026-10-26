import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "rounds", "label": loc("Rondas"), "default": 4, "choices": [[3, "3"], [4, "4"], [6, "6"], [8, "8"]], "advanced": false},
  {"id": "disguises", "label": loc("Disfraces"), "default": "all", "choices": [["barrels", loc("Barriles")], ["all", loc("Todo vale")]], "advanced": false},
  {"id": "seekers", "label": loc("Buscadores"), "default": 1, "choices": [[1, "1"], [2, "2"]], "advanced": true},
  {"id": "hideSeconds", "label": loc("Tiempo para esconderse"), "default": 30, "choices": [[15, "15 s"], [20, "20 s"], [30, "30 s"], [45, "45 s"], [60, "60 s"]], "advanced": true},
  {"id": "hints", "label": loc("Pistas"), "default": "none", "choices": [["none", loc("Ninguna")], ["sound", loc("Sonido")], ["whistle", loc("Silbato")]], "advanced": true},
  {"id": "moveDisguised", "label": loc("Moverse disfrazado"), "default": true, "choices": [[true, loc("Sí")], [false, "No"]], "advanced": true},
  {"id": "seekerMap", "label": loc("Mapa del buscador"), "default": false, "choices": [[false, "No"], [true, loc("Sí")]], "advanced": true},
  {"id": "huntSeconds", "label": loc("Tiempo de ronda"), "default": 180, "choices": [[180, "3 min"], [120, "2 min"], [240, "4 min"]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
