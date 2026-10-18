import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "temple", "label": "Templo", "default": "selva", "choices": [["selva", "Selva"], ["tepuy", "Tepuy"]], "advanced": false},
  {"id": "difficulty", "label": "Dificultad", "default": "normal", "choices": [["easy", "Fácil"], ["normal", "Normal"], ["hard", "Momia brava"]], "advanced": false},
  {"id": "lightAllocation", "label": "Linterna", "default": "shared", "choices": [["shared", "Compartida"], ["each", "Una por pana"]], "advanced": false},
  {"id": "mummies", "label": "Momias", "default": 2, "choices": [[1, "1"], [2, "2"], [3, "3"]], "advanced": true},
  {"id": "traps", "label": "Trampas", "default": "normal", "choices": [["normal", "Normal"], ["few", "Pocas"], ["many", "Muchas"]], "advanced": true},
  {"id": "revive", "label": "Revivir pana", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
  {"id": "map", "label": "Mapa", "default": true, "choices": [[true, "Visible"], [false, "Escondido"]], "advanced": true},
  {"id": "hints", "label": "Pistas", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
  {"id": "lanterns", "label": "Linternas", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
