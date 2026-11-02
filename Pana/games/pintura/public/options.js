import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  {"id": "mode", "label": loc("Modo"), "default": "ffa", "choices": [["teams", loc("Equipos")], ["ffa", loc("Todos vs todos")], ["ctf", loc("Captura la bandera")], ["dom", loc("Dominación")]], "advanced": false},
  {"id": "duration", "label": loc("Tiempo por ronda"), "default": 180, "choices": [[180, "3 min"], [300, "5 min"]], "advanced": false, "visibleWhen": {"mode": ["teams", "ffa"]}},
  // Capture the flag (ctf.js): captures that win and the time limit.
  {"id": "flagGoal", "label": loc("Capturas para ganar"), "default": 3, "choices": [[3, "3"], [1, "1"], [5, "5"]], "advanced": false, "visibleWhen": {"mode": ["ctf"]}},
  // Domination (domination.js): points that win. Its time limit is the same field as CTF's.
  {"id": "domGoal", "label": loc("Puntos para ganar"), "default": 200, "choices": [[200, "200"], [100, "100"], [300, "300"]], "advanced": false, "visibleWhen": {"mode": ["dom"]}},
  {"id": "flagTime", "label": loc("Tiempo límite"), "default": 600, "choices": [[600, "10 min"], [300, "5 min"], [900, "15 min"]], "advanced": false, "visibleWhen": {"mode": ["ctf", "dom"]}},
  {"id": "toughness", "label": loc("Aguante"), "default": 3, "choices": [[3, loc("3 pepazos")], [1, loc("1 pepazo")], [5, loc("5 pepazos")]], "advanced": false},
  {"id": "lives", "label": loc("Vidas"), "default": 3, "choices": [[3, "3"], [1, "1"], [0, loc("Infinitas")]], "advanced": true, "visibleWhen": {"mode": ["teams", "ffa"]}},
  {"id": "paint", "label": loc("Pintura"), "default": "normal", "choices": [["normal", loc("Normal")], ["sticky", loc("Pegajosa")]], "advanced": true},
  {"id": "weapons", "label": loc("Armas"), "default": "all", "choices": [["all", loc("Todas")], ["pistol", loc("Solo pistola")]], "advanced": true},
  {"id": "friendlyFire", "label": loc("Fuego amigo"), "default": false, "choices": [[false, loc("No")], [true, loc("Sí")]], "advanced": true},
  {"id": "fastReload", "label": loc("Recarga"), "default": false, "choices": [[false, loc("Normal")], [true, loc("Rápida")]], "advanced": true},
  // Auto keeps the classic rule: three bots for a pana alone, none with friends.
  // A number is capped by the free seats (rules.js botCount), so 7 means "fill".
  {"id": "bots", "label": loc("Bots"), "default": "auto", "choices": [["auto", loc("Auto")], [0, "0"], [1, "1"], [2, "2"], [3, "3"], [5, "5"], [7, "7"]], "advanced": true},
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
// Objective rounds (capture the flag, domination) score by the objective, not by paint.
export const objectivePlay = options => options?.mode === 'ctf' || options?.mode === 'dom';
// Team rounds: Equipos and the objective modes. A round's clock: objective modes have their own limit.
export const teamPlay = options => options?.mode === 'teams' || objectivePlay(options);
// Objective rounds always respawn: nobody is out of lives while a flag or a zone is in play.
export const livesOf = options => objectivePlay(options) ? 0 : options?.lives || 0;
export const roundTime = options => objectivePlay(options) ? options.flagTime || 600 : options?.duration || 180;
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
