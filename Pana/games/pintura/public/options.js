import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
// The same descriptors drive the menu and the authoritative allowlist.
// `mode` and `hardcore` come from the lobby's Partida and Modo choices
// (MENU_FIELDS below); everything else lives in "Más ajustes".
export const FIELDS = [
  {"id": "mode", "label": loc("Modo"), "default": "ffa", "choices": [["teams", loc("Equipos")], ["ffa", loc("Todos vs todos")], ["ctf", loc("Captura la bandera")], ["dom", loc("Dominación")]], "advanced": false},
  // Hardcore: one pepazo knocks a pana out (hitsToKill in rules.js), in teams or every pana for themselves.
  {"id": "hardcore", "label": loc("Hardcore"), "default": false, "choices": [[false, loc("No")], [true, loc("Sí")]], "advanced": false, "menu": false},
  {"id": "duration", "label": loc("Tiempo por ronda"), "default": 180, "choices": [[180, "3 min"], [300, "5 min"]], "advanced": true, "visibleWhen": {"mode": ["teams", "ffa"]}},
  // Capture the flag (ctf.js): captures that win and the time limit.
  {"id": "flagGoal", "label": loc("Capturas para ganar"), "default": 3, "choices": [[3, "3"], [1, "1"], [5, "5"]], "advanced": true, "visibleWhen": {"mode": ["ctf"]}},
  // Domination (domination.js): points that win. Its time limit is the same field as CTF's.
  {"id": "domGoal", "label": loc("Puntos para ganar"), "default": 200, "choices": [[200, "200"], [100, "100"], [300, "300"]], "advanced": true, "visibleWhen": {"mode": ["dom"]}},
  {"id": "flagTime", "label": loc("Tiempo límite"), "default": 600, "choices": [[600, "10 min"], [300, "5 min"], [900, "15 min"]], "advanced": true, "visibleWhen": {"mode": ["ctf", "dom"]}},
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
// Hardcore rides the paint modes (Pintadas in teams, todos contra todos).
export const hardcorePlay = options => !!options?.hardcore && !objectivePlay(options);

// What the lobby calls the round: 'teams' (Pintadas), 'ffa', 'ctf', 'dom' or 'hardcore'.
export const playOf = options => hardcorePlay(options) ? 'hardcore' : options?.mode || DEFAULT_OPTIONS.mode;
// Each game mode brings its own clock, goal and lives, so nobody has to set
// anything. Switching mode (or between teams and todos contra todos) resets
// these to the new mode's values; a patch that names one keeps its own value.
export const MODE_DEFAULTS = {
  teams: { duration: 180, lives: 3 },
  ffa: { duration: 180, lives: 3 },
  ctf: { flagTime: 600, flagGoal: 3 },
  dom: { flagTime: 600, domGoal: 200 },
  // One pepazo is a knockout: endless lives and a quicker respawn keep it moving.
  hardcore: { duration: 180, lives: 0 },
};
export function withModeDefaults(current, patch) {
  const next = { ...current, ...patch }, play = playOf(next);
  if (play === playOf(current) && next.mode === current?.mode) return patch;
  return { ...MODE_DEFAULTS[play], ...patch };
}
// Retired options a saved or synced room may still carry ("Aguante", now the
// Hardcore mode): dropped, never a reason to refuse the rest.
const LEGACY = ['toughness'];
export const withoutLegacy = patch => patch && typeof patch === 'object' && !Array.isArray(patch) ? Object.fromEntries(Object.entries(patch).filter(([key]) => !LEGACY.includes(key))) : patch;
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;

// The lobby asks two things: teams or everyone for themselves (Partida), then
// the game mode (Modo). Both write the room's `mode` and `hardcore`, so the
// rules, the allowlist and saved options stay as they are.
export const SIDES_FIELD = { id: 'sides', label: loc('Partida'), default: 'ffa', choices: [['teams', loc('Equipos')], ['ffa', loc('Todos contra todos')]], advanced: false };
const PLAY_LABEL = loc('Modo');
export const MENU_FIELDS = [SIDES_FIELD,
  { id: 'teamMode', label: PLAY_LABEL, default: 'teams', choices: [['teams', loc('Pintadas')], ['ctf', loc('Bandera')], ['dom', loc('Dominación')], ['hardcore', loc('Hardcore')]], advanced: false, visibleWhen: { sides: ['teams'] } },
  { id: 'ffaMode', label: PLAY_LABEL, default: 'ffa', choices: [['ffa', loc('Pintadas')], ['hardcore', loc('Hardcore')]], advanced: false, visibleWhen: { sides: ['ffa'] } },
  // A mode's own values count as its defaults, so "Más ajustes" only flags real changes.
  ...FIELDS.filter(f => f.advanced).map(f => ({ ...f, defaultOf: values => MODE_DEFAULTS[playOf(values)]?.[f.id] ?? f.default }))];
export const menuValues = options => { const play = playOf(options), teams = teamPlay(options); return { ...options, sides: teams ? 'teams' : 'ffa', teamMode: teams ? play : 'teams', ffaMode: teams ? 'ffa' : play }; };
// A lobby choice as a room patch. Equipos and Todos contra todos keep Hardcore
// when it is on; Equipos also keeps a team game already picked.
export function menuPatch(patch, options) {
  if ('sides' in patch) {
    const hardcore = hardcorePlay(options);
    return patch.sides === 'ffa' ? { mode: 'ffa', hardcore } : { mode: teamPlay(options) ? options.mode : 'teams', hardcore };
  }
  if ('ffaMode' in patch) return { mode: 'ffa', hardcore: patch.ffaMode === 'hardcore' };
  if ('teamMode' in patch) return patch.teamMode === 'hardcore' ? { mode: 'teams', hardcore: true } : { mode: patch.teamMode, hardcore: false };
  return patch;
}
