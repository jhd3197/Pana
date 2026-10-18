import { ARENAS, TABLE_ARENAS, COURT_ARENAS, arenaInfo, tableArenaInfo, courtArenaInfo } from './arena-layouts.js';

// The host chooses; everyone sees the same selection and live world preview.
export function createMapPicker(parent, onChange, { table = false, landmarks = false, courts = false } = {}) {
  const field = document.createElement('div'); field.className = 'pk-field pk-map-picker';
  const label = document.createElement('label'); label.className = 'pk-eyebrow'; label.htmlFor = 'map-choice'; label.textContent = table ? '¿Dónde ponemos la mesa?' : courts ? '¿Dónde jugamos?' : 'Elige el mapa';
  const select = document.createElement('select'); select.id = 'map-choice'; select.className = 'pk-select'; select.setAttribute('aria-describedby', 'map-description');
  for (const map of courts ? COURT_ARENAS : landmarks ? TABLE_ARENAS : ARENAS) { const option = document.createElement('option'); option.value = map.id; option.textContent = map.name; select.append(option); }
  const description = document.createElement('small'); description.id = 'map-description'; description.className = 'pk-copy';
  field.append(label, select, description); parent.append(field); select.addEventListener('change', () => onChange(select.value));
  return { update(id, enabled) { const map = (courts ? courtArenaInfo : table ? tableArenaInfo : arenaInfo)(id); select.value = map.id; select.disabled = !enabled; description.textContent = map.description; } };
}
