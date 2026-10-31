import { botParticipation } from '../../../engine/room-option-fields.js';
import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "kitchen", "label": loc("Cocina"), "default": "mercado", "choices": [["mercado", loc("Mercado")], ["playa", loc("Playa")]], "advanced": false},
  {"id": "duration", "label": loc("Tiempo por ronda"), "default": 180, "choices": [[180, "3 min"], [300, "5 min"]], "advanced": false},
  {"id": "difficulty", "label": loc("Dificultad"), "default": "normal", "choices": [["easy", loc("Fácil")], ["normal", loc("Normal")], ["chaos", loc("Caótica")]], "advanced": false},
  {"id": "orders", "label": loc("Pedidos"), "default": "all", "choices": [["all", loc("Todo el menú")], ["arepa", loc("Solo arepas")]], "advanced": true},
  {"id": "impatient", "label": loc("Clientes apurados"), "default": true, "choices": [[true, loc("Sí")], [false, loc("No")]], "advanced": true},
  {"id": "fire", "label": loc("Fuego"), "default": "normal", "choices": [["normal", loc("Normal")], ["fast", loc("Se quema rápido")]], "advanced": true},
  {"id": "tips", "label": loc("Propinas"), "default": true, "choices": [[true, loc("Sí")], [false, loc("No")]], "advanced": true},
  {"id": "switchKitchen", "label": loc("Cambiar cocina a mitad"), "default": false, "choices": [[false, loc("No")], [true, loc("Sí")]], "advanced": true},
  botParticipation('helpers'),
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
