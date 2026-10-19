// Pure room-option validation for both host simulations and server rooms.
export const optionDefaults = fields => Object.fromEntries(fields.map(f => [f.id, f.default]));
export function normalizeRoomOptions(fields, values) {
  return Object.fromEntries(fields.map(f => [f.id, f.choices.some(([v]) => v === values?.[f.id]) ? values[f.id] : f.default]));
}
export function applyRoomOptions(fields, current, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return null;
  const entries = Object.entries(patch);
  if (!entries.length || entries.some(([key, value]) => !fields.find(f => f.id === key)?.choices.some(([v]) => v === value))) return null;
  return { ...normalizeRoomOptions(fields, current), ...patch };
}
