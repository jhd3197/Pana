export const LEGACY_PROFILE_FIXTURES = [
  {
    id: 'empty',
    setup: { mode: 'race', difficulty: 'normal', laps: 3, mirror: false, split: false },
    trophies: {},
    wallet: null,
  },
  {
    id: 'mango-gold',
    setup: { mode: 'mango', difficulty: 'dificil', laps: 2, mirror: true, split: false },
    trophies: { mango: 'oro' },
    wallet: { coins: 90, owned: ['paint:caribe', 'paint:oro'], paint: { chamo: 'caribe' }, horn: 'meep', flame: 'fuego' },
  },
  {
    id: 'arepa-silver',
    setup: { mode: 'arepa', difficulty: 'normal', laps: 3, mirror: false, split: true },
    trophies: { arepa: 'plata' },
    wallet: { coins: 41, owned: ['flame:hielo'], paint: {}, horn: 'propio', flame: 'hielo' },
  },
  {
    id: 'mango-bronze',
    setup: { mode: 'mango', difficulty: 'facil', laps: 1, mirror: false, split: false },
    trophies: { mango: 'bronce' },
    wallet: { coins: 15, owned: ['horn:fiesta'], paint: {}, horn: 'fiesta', flame: 'fuego' },
  },
  {
    id: 'both-legacy-cups',
    setup: { mode: 'arepa', difficulty: 'normal', laps: 5, mirror: true, split: false },
    trophies: { mango: 'oro', arepa: 'bronce' },
    wallet: { coins: 140, owned: ['paint:oro', 'flame:arcoiris'], paint: { bala: 'oro' }, horn: 'grave', flame: 'arcoiris' },
  },
  {
    id: 'malformed',
    raw: { setup: '{not json', trophies: '[]', wallet: '"wrong shape"' },
  },
  {
    id: 'blocked-storage',
    setup: { mode: 'mango', difficulty: 'normal', laps: 3 },
    trophies: { mango: 'plata' },
    wallet: { coins: 22, owned: ['paint:pasion'] },
    blocked: true,
  },
];
