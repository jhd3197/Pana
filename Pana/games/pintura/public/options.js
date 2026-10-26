import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "mode", "label": loc("Modo"), "default": "ffa", "choices": [["teams", loc("Equipos")], ["ffa", loc("Todos vs todos")]], "advanced": false},
  {"id": "duration", "label": loc("Tiempo por ronda"), "default": 180, "choices": [[180, "3 min"], [300, "5 min"]], "advanced": false},
  {"id": "toughness", "label": loc("Aguante"), "default": 3, "choices": [[3, loc("3 pepazos")], [1, loc("1 pepazo")], [5, loc("5 pepazos")]], "advanced": false},
  {"id": "lives", "label": loc("Vidas"), "default": 3, "choices": [[3, "3"], [1, "1"], [0, loc("Infinitas")]], "advanced": true},
  {"id": "paint", "label": loc("Pintura"), "default": "normal", "choices": [["normal", loc("Normal")], ["sticky", loc("Pegajosa")]], "advanced": true},
  {"id": "weapons", "label": loc("Armas"), "default": "all", "choices": [["all", loc("Todas")], ["pistol", loc("Solo pistola")]], "advanced": true},
  {"id": "friendlyFire", "label": loc("Fuego amigo"), "default": false, "choices": [[false, loc("No")], [true, loc("Sí")]], "advanced": true},
  {"id": "fastReload", "label": loc("Recarga"), "default": false, "choices": [[false, loc("Normal")], [true, loc("Rápida")]], "advanced": true},
  {"id": "flag", "label": loc("Bandera"), "default": false, "choices": [[false, loc("No")], [true, loc("Sí")]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
