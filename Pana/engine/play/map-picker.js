import { ARENAS, TABLE_ARENAS, COURT_ARENAS, PAINT_ARENAS, arenaInfo, tableArenaInfo, courtArenaInfo, paintArenaInfo } from '../worlds/arena-layouts.js';
import { loc } from '../i18n.js';
// In the lobby the host chooses, or the lone player once there is no room to
// answer to (`room.solo`). A guest stays read-only, also while connecting.
export const canChangeMap = (room, phase) => phase === 'lobby' && (room.connected ? !!room.isHost : !!room.solo);
// The host chooses; everyone sees the same selection and live world preview.
// With `room`, a choice made without a connection lands in room.state, which
// practice() and a later room both start from.
export function createMapPicker(parent, onChange, { table = false, landmarks = false, courts = false, paint = false, room = null } = {}) {
  const field = document.createElement('div'); field.className = 'pk-field pk-map-picker';
  const label = document.createElement('label'); label.className = 'pk-eyebrow'; label.htmlFor = 'map-choice'; label.textContent = table ? loc('¿Dónde ponemos la mesa?') : courts ? loc('¿Dónde jugamos?') : loc('Elige el mapa');
  const select = document.createElement('select'); select.id = 'map-choice'; select.className = 'pk-select'; select.setAttribute('aria-describedby', 'map-description');
  for (const map of courts ? COURT_ARENAS : landmarks ? TABLE_ARENAS : paint ? PAINT_ARENAS : ARENAS) { const option = document.createElement('option'); option.value = map.id; option.textContent = map.name; select.append(option); }
  const description = document.createElement('small'); description.id = 'map-description'; description.className = 'pk-copy';
  field.append(label, select, description); parent.append(field); const info = courts ? courtArenaInfo : table ? tableArenaInfo : paint ? paintArenaInfo : arenaInfo;
  select.addEventListener('change', () => { description.textContent = loc(info(select.value).description); if (room && !room.connected) { room.state.mapId = select.value; room.onState(room.state); } else onChange(select.value); });
  return { update(id, enabled) { const map = info(id); select.value = map.id; select.dataset.map = map.id; select.disabled = !enabled; description.textContent = loc(map.description); } };
}
