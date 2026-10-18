import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "rounds", "label": "Rondas", "default": 4, "choices": [[3, "3"], [4, "4"], [6, "6"], [8, "8"]], "advanced": false},
  {"id": "disguises", "label": "Disfraces", "default": "all", "choices": [["barrels", "Barriles"], ["all", "Todo vale"]], "advanced": false},
  {"id": "seekers", "label": "Buscadores", "default": 1, "choices": [[1, "1"], [2, "2"]], "advanced": true},
  {"id": "hideSeconds", "label": "Tiempo para esconderse", "default": 30, "choices": [[15, "15 s"], [20, "20 s"], [30, "30 s"], [45, "45 s"], [60, "60 s"]], "advanced": true},
  {"id": "hints", "label": "Pistas", "default": "none", "choices": [["none", "Ninguna"], ["sound", "Sonido"], ["whistle", "Silbato"]], "advanced": true},
  {"id": "moveDisguised", "label": "Moverse disfrazado", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
  {"id": "seekerMap", "label": "Mapa del buscador", "default": false, "choices": [[false, "No"], [true, "Sí"]], "advanced": true},
  {"id": "huntSeconds", "label": "Tiempo de ronda", "default": 180, "choices": [[180, "3 min"], [120, "2 min"], [240, "4 min"]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
