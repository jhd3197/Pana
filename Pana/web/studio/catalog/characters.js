import { DEFAULT_AVATAR } from '/engine/avatar.js';
const shared = ['Bululú', 'Derrape', 'Escondidas', 'Cocina'];
const character = (id, name, options = {}) => ({ id, name, category: 'Personajes', source: '/engine/models/characters/pana/avatar-model.js', factory: 'buildCharacter', usedBy: options.seated?['Derrape']:options.chef?['Cocina']:shared, previewOptions: options,
  async build() { const { buildCharacter } = await import('/engine/models/characters/pana/avatar-model.js'); const model = buildCharacter(DEFAULT_AVATAR, { quality: 'studio', ...options }); return { group: model.group, update: (t, dt) => model.update(dt), dispose: () => model.dispose() }; },
});

export const CHARACTERS = [
  character('pana', 'Pana original'),
  character('pana-chef', 'Pana cocinero', { chef: true }),
  character('pana-driver', 'Pana conductor', { seated: true }),
  ...[['shirt', 'Franela'], ['chef', 'Delantal y gorro'], ['hoodie', 'Suéter y gorra'], ['tropical', 'Camisa tropical'], ['sport', 'Conjunto deportivo']].map(([outfit, name]) => ({
    id: `outfit-${outfit}`, name, category: 'Vestuario', source: '/engine/models/characters/pana/model.js', factory: 'buildSoftCharacter', usedBy: shared, tags: ['outfits.js'],
    async build() { const { buildSoftCharacter } = await import('/engine/models/characters/pana/model.js'); const model = buildSoftCharacter({ outfit }); return { group: model.group, update: (t, dt) => model.update(dt), dispose: () => model.dispose() }; },
  })),
];
