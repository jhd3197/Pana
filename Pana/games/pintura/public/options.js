import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "mode", "label": "Modo", "default": "ffa", "choices": [["teams", "Equipos"], ["ffa", "Todos vs todos"]], "advanced": false},
  {"id": "duration", "label": "Tiempo", "default": 180, "choices": [[180, "3 min"], [300, "5 min"]], "advanced": false},
  {"id": "toughness", "label": "Aguante", "default": 3, "choices": [[3, "3 pepazos"], [1, "1 pepazo"], [5, "5 pepazos"]], "advanced": false},
  {"id": "lives", "label": "Vidas", "default": 3, "choices": [[3, "3"], [1, "1"], [0, "Infinitas"]], "advanced": true},
  {"id": "paint", "label": "Pintura", "default": "normal", "choices": [["normal", "Normal"], ["sticky", "Pegajosa"]], "advanced": true},
  {"id": "weapons", "label": "Armas", "default": "all", "choices": [["all", "Todas"], ["pistol", "Solo pistola"]], "advanced": true},
  {"id": "friendlyFire", "label": "Fuego amigo", "default": false, "choices": [[false, "No"], [true, "Sí"]], "advanced": true},
  {"id": "fastReload", "label": "Recarga", "default": false, "choices": [[false, "Normal"], [true, "Rápida"]], "advanced": true},
  {"id": "flag", "label": "Bandera", "default": false, "choices": [[false, "No"], [true, "Sí"]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
