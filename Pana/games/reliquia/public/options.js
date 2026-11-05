import { optionDefaults, applyRoomOptions } from '../../../engine/room-options-rules.js';
import { loc } from '../../../engine/i18n.js';
import { PACTOS, pactoKey } from './pactos.js';
// The same descriptors drive the menu and the authoritative allowlist.
export const FIELDS = [
  // Where the jornadas happen: the buried library first, then the mine, and so on.
  { id: 'place', label: loc('Lugar'), default: 'alternar', choices: [['alternar', loc('Van rotando')], ['biblioteca', loc('Biblioteca')], ['mina', loc('Mina')], ['inundada', loc('Túneles inundados')], ['hongos', loc('Cueva de hongos')], ['templo', loc('Templo caído')], ['congo', loc('Congo')]], advanced: false },
  { id: 'difficulty', label: loc('Dificultad'), default: 'normal', choices: [['easy', loc('Tranquila')], ['normal', loc('Normal')], ['hard', loc('Momia brava')]], advanced: false },
  { id: 'greed', label: loc('La codicia'), default: 'normal', choices: [['soft', loc('Paciente')], ['normal', loc('Normal')], ['fierce', loc('Celosa')]], advanced: false },
  { id: 'revive', label: loc('Revivir pana'), default: true, choices: [[true, loc('Sí')], [false, loc('No')]], advanced: true },
  { id: 'wipeShare', label: loc('Si caen todos'), default: 20, choices: [[20, loc('Se salva 20 %')], [0, loc('Se pierde todo')], [50, loc('Se salva la mitad')]], advanced: true },
  { id: 'map', label: loc('Mapa'), default: true, choices: [[true, loc('Visible')], [false, loc('Escondido')]], advanced: true },
  { id: 'crude', label: loc('Frases'), default: false, choices: [[false, loc('Sanas')], [true, loc('Más criollas')]], advanced: true },
  // One switch per pact; the id is also its rank unlock (progress.js).
  ...PACTOS.map(p => ({ id: pactoKey(p.id), pacto: p.id, label: loc('{name} · +{n}', { name: loc(p.name), n: p.calor }), default: false, choices: [[false, loc('No')], [true, loc(p.label)]], advanced: true })),
];
export const DEFAULT_OPTIONS = optionDefaults(FIELDS);
export const validOptions = patch => applyRoomOptions(FIELDS, DEFAULT_OPTIONS, patch) !== null;
// This screen's menu: a pact your rank has not unlocked only shows once the host
// has it on, so guests see what they are diving with. Rank is a menu matter: the
// rules accept any real pact, and a new host can still turn one off.
export const fieldsFor = isUnlocked => FIELDS.map(f => f.pacto && !isUnlocked(f.id) ? { ...f, visibleWhen: { [f.id]: [true] } } : f);

// "Sustos" is each player's own setting (not the room's): how hard the
// scares hit on this screen. Suaves: no blackouts, softer stingers, flicker
// and shake at 40 %, whispers only far off; the Lector's and the Estatua's
// cues at half (presence.js) and less dust. Apagados: no jump scares,
// flicker, shake, recorded scare sounds or creature cues. Only what this
// screen shows and plays: no enemy behaves differently.
export const SCARES = { id: 'sustos', label: loc('Sustos'), default: 'normal', choices: [['normal', loc('Normales')], ['suaves', loc('Suaves')], ['apagados', loc('Apagados')]] };
const SCARE_KEY = 'pana:reliquia:sustos';
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function loadScares(storage = store()) {
  let value = null; try { value = storage?.getItem(SCARE_KEY); } catch { /* Storage off. */ }
  return SCARES.choices.some(([v]) => v === value) ? value : SCARES.default;
}
export function saveScares(value, storage = store()) {
  if (!SCARES.choices.some(([v]) => v === value)) return false;
  try { storage?.setItem(SCARE_KEY, value); } catch { /* Storage off: this session only. */ }
  return true;
}
// How much camera shake survives the setting (gameplay jolts included).
export const shakeFor = mode => mode === 'apagados' ? 0 : mode === 'suaves' ? .4 : 1;
// How loud the camp's far falls are: never much, and quieter the softer the setting.
export const roarFor = mode => mode === 'apagados' ? .018 : mode === 'suaves' ? .03 : .04;
