// The camp's wardrobe: which earned trims this pana wears, one row per kind in the
// lobby's settings column, built from the room options' own field and segmented
// buttons. A trim not yet earned stays greyed, titled with the rank that earns it.
// Looks only, local to this pana: the pick goes to suit-look.js chosenLook.
import { loc } from '../../../engine/i18n.js';
import { ROPERO, ROPERO_KINDS, chosenLook } from './suit-look.js';
import { RANKS } from './progress.js';

// The picks on this device. Storage is injectable and falls back to memory when
// blocked; anything malformed is dropped, so that kind wears its default.
export const LOOK_KEY = 'pana:reliquia:look';
const cleanPicks = value => {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const kind of Object.keys(ROPERO)) if (Object.hasOwn(value, kind) && ROPERO[kind].some(o => o.id === value[kind])) out[kind] = value[kind];
  return out;
};
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function createLookPicks({ storage = defaultStorage() } = {}) {
  let memory = {}, stuck = false;
  const read = () => {
    if (stuck) return memory;
    try { const raw = storage?.getItem(LOOK_KEY); if (raw != null) memory = cleanPicks(JSON.parse(raw)); } catch { /* blocked or malformed */ }
    return memory;
  };
  return {
    get: () => ({ ...read() }),
    // id: one of ROPERO[kind]'s ids, null for plain. Returns the picks now held.
    set(kind, id) {
      if (!ROPERO[kind]?.some(o => o.id === id)) return { ...read() };
      memory = cleanPicks({ ...read(), [kind]: id });
      try { storage?.setItem(LOOK_KEY, JSON.stringify(memory)); stuck = false; } catch { stuck = true; }
      return { ...memory };
    },
  };
}

const rankFor = unlock => RANKS.find(r => r.unlocks.includes(unlock));

// parent: the lobby's .pk-room-primary. wear(picks): re-dress now with these picks.
export function createRopero({ parent, progress, wear, picks = createLookPicks() }) {
  const el = Object.assign(document.createElement('div'), { id: 'ropero' });
  el.setAttribute('aria-label', loc('Ropero'));
  const rows = ROPERO_KINDS.map(([kind, label]) => {
    const group = Object.assign(document.createElement('fieldset'), { className: 'pk-room-field', id: `ropero-${kind}` });
    const legend = Object.assign(document.createElement('legend'), { textContent: loc(label) });
    const seg = Object.assign(document.createElement('div'), { className: 'pk-seg' });
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', loc(label));
    seg.style.setProperty('--seg-cols', ROPERO[kind].length);
    const buttons = ROPERO[kind].map(o => {
      const b = Object.assign(document.createElement('button'), { type: 'button', id: `ropero-${kind}-${o.id ?? 'plain'}`, textContent: loc(o.name) });
      b.dataset.ropero = kind; b.dataset.value = o.id ?? '';
      b.onclick = () => { wear(picks.set(kind, o.id)); draw(); };
      seg.append(b); return { b, o };
    });
    group.append(legend, seg); el.append(group);
    return { kind, buttons };
  });
  function draw() {
    const look = chosenLook(progress.isUnlocked, picks.get());
    for (const { kind, buttons } of rows) for (const { b, o } of buttons) {
      const earned = !o.unlock || progress.isUnlocked(o.unlock), rank = rankFor(o.unlock);
      b.disabled = !earned;
      b.title = earned || !rank ? '' : loc('Se gana con el rango {rank}', { rank: loc(rank.title) });
      b.setAttribute('aria-pressed', String(look[kind] === o.id));
    }
  }
  parent.append(el); wear(picks.get()); draw();
  const off = progress.onChange(draw);
  return { el, picks, draw, dispose() { off(); el.remove(); } };
}
