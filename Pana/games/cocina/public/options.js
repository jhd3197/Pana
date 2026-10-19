import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "kitchen", "label": "Cocina", "default": "mercado", "choices": [["mercado", "Mercado"], ["playa", "Playa"]], "advanced": false},
  {"id": "duration", "label": "Turno", "default": 180, "choices": [[180, "3 min"], [300, "5 min"]], "advanced": false},
  {"id": "difficulty", "label": "Dificultad", "default": "normal", "choices": [["easy", "Fácil"], ["normal", "Normal"], ["chaos", "Caótica"]], "advanced": false},
  {"id": "orders", "label": "Pedidos", "default": "all", "choices": [["all", "Todo el menú"], ["arepa", "Solo arepas"]], "advanced": true},
  {"id": "impatient", "label": "Clientes apurados", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
  {"id": "fire", "label": "Fuego", "default": "normal", "choices": [["normal", "Normal"], ["fast", "Se quema rápido"]], "advanced": true},
  {"id": "tips", "label": "Propinas", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
  {"id": "switchKitchen", "label": "Cambiar cocina a mitad", "default": false, "choices": [[false, "No"], [true, "Sí"]], "advanced": true},
  {"id": "helpers", "label": "Ayudantes cuando falten panas", "default": true, "choices": [[true, "Sí"], [false, "No"]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
