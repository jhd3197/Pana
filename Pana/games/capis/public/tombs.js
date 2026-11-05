// The tombstone a capi leaves behind, and which shapes this player has. The
// plain one is free; the others wait for the shop: each names its `unlock`, and
// `grant(unlock)` is all a purchase needs to call. Until then they show locked.
//
//   const tombs = createTombStore();
//   tombs.owns('celtic');            // false
//   tombs.grant('tomb-celtic');      // what the shop will do
//   tombs.choose('celtic');          // true; createMatch({ looks: { [team]: tombs.chosen() } })
import { loc } from '../../../engine/i18n.js';
import { DEFAULT_TOMB } from './rules.js';

export const TOMBS = Object.freeze([
  Object.freeze({ id: DEFAULT_TOMB, name: loc('Lápida'), icon: 'tombHeadstone' }),
  Object.freeze({ id: 'wooden', name: loc('Cruz de palo'), icon: 'tombWooden', unlock: 'tomb-wooden' }),
  Object.freeze({ id: 'celtic', name: loc('Cruz celta'), icon: 'tombCeltic', unlock: 'tomb-celtic' }),
  Object.freeze({ id: 'obelisk', name: loc('Obelisco'), icon: 'tombObelisk', unlock: 'tomb-obelisk' }),
]);
const KEY = 'pana:capis:tombs';
const browserStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function createTombStore({ storage = browserStorage() } = {}) {
  let saved = {};
  try { saved = JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { saved = {}; }
  const owned = new Set(Array.isArray(saved.owned) ? saved.owned : []);
  let chosen = saved.chosen;
  const save = () => { try { storage?.setItem(KEY, JSON.stringify({ chosen, owned: [...owned] })); } catch { /* a full or blocked storage only forgets the choice */ } };
  const owns = id => { const t = TOMBS.find(k => k.id === id); return !!t && (!t.unlock || owned.has(t.unlock)); };
  return {
    owns,
    chosen: () => owns(chosen) ? chosen : DEFAULT_TOMB,
    choose(id) { if (!owns(id)) return false; chosen = id; save(); return true; },
    grant(unlock) { owned.add(unlock); save(); },
  };
}
