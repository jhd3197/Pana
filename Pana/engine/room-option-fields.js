// Shared vocabulary; games retain their own serialized values and rules.
export function botParticipation(id = 'bots', on = true, off = false, value = on) {
  return { id, label: 'Jugar con', default: value, choices: [[off, 'Solo panas'], [on, 'Panas y bots']] };
}

export function botLevel(id, easy, normal, hard, extra = {}) {
  return { id, label: 'Nivel de bots', default: normal,
    choices: [[easy, 'Fácil'], [normal, 'Normal'], [hard, 'Difícil']], ...extra };
}

export function isRoomFieldVisible(field, values) {
  return !field.visibleWhen || Object.entries(field.visibleWhen).every(([key, allowed]) => allowed.includes(values[key]));
}

// Lancha and Parapente used the skill value to disable bot filling.
export const migrateRivals = raw => raw?.rivals === 'none'
  ? { ...raw, rivals: 'normal', bots: Object.hasOwn(raw, 'bots') ? raw.bots : false }
  : raw;
