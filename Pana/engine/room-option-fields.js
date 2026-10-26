import { loc } from './i18n.js';
// Shared vocabulary; games retain their own serialized values and rules.
export function botParticipation(id = 'bots', on = true, off = false, value = on) {
  return { id, label: loc('Jugar con'), default: value, choices: [[off, loc('Solo panas')], [on, loc('Panas y bots')]] };
}

export function botLevel(id, easy, normal, hard, extra = {}) {
  return { id, label: loc('Nivel de bots'), default: normal,
    choices: [[easy, loc('Fácil')], [normal, loc('Normal')], [hard, loc('Difícil')]], ...extra };
}

export function isRoomFieldVisible(field, values) {
  return !field.visibleWhen || Object.entries(field.visibleWhen).every(([key, allowed]) => allowed.includes(values[key]));
}

// Lancha and Parapente used the skill value to disable bot filling.
export const migrateRivals = raw => raw?.rivals === 'none'
  ? { ...raw, rivals: 'normal', bots: Object.hasOwn(raw, 'bots') ? raw.bots : false }
  : raw;
