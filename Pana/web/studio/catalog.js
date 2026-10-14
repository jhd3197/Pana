// Agent-editable catalog. Import existing definitions/factories; never copy a model.
import { PLAZA_PROPS } from '/engine/plaza-catalog.js';
import { TRACKS, makeTrack } from '/g/derrape/tracks.js';
import { CARS } from '/g/derrape/cars.js';
import { RECIPES, STATIONS } from '/g/cocina/rules.js';
import { DEFAULT_AVATAR } from '/engine/avatar.js';
import { Box3, Vector3 } from 'three';

const shared = ['Bululú', 'Derrape', 'Escondidas', 'Cocina'];
const object = (id, name, category, source, factory, usedBy, options) => ({
  id, name, category, source, factory, usedBy, previewOptions: options ?? null,
  async build() { const module = await import(source); return { group: module[factory](options) }; },
});
const character = (id, name, options = {}) => ({ id, name, category: 'Personajes', source: '/engine/character.js', factory: 'buildCharacter', usedBy: shared, previewOptions: options,
  async build() { const { buildCharacter } = await import('/engine/character.js'); const model = buildCharacter(DEFAULT_AVATAR, { quality: 'studio', ...options }); return { group: model.group, update: (t, dt) => model.update(dt), dispose: () => model.dispose() }; },
});
export const ASSETS = [
  character('pana', 'Pana original'),
  character('pana-chef', 'Pana cocinero', { chef: true }),
  character('pana-driver', 'Pana conductor', { seated: true }),
  ...[['shirt', 'Franela'], ['chef', 'Delantal y gorro'], ['hoodie', 'Suéter y gorra'], ['tropical', 'Camisa tropical'], ['sport', 'Conjunto deportivo']].map(([outfit, name]) => ({
    id: `outfit-${outfit}`, name, category: 'Vestuario', source: '/engine/soft-character/model.js', factory: 'buildSoftCharacter', usedBy: shared, tags: ['outfits.js'],
    async build() { const { buildSoftCharacter } = await import('/engine/soft-character/model.js'); const model = buildSoftCharacter({ outfit }); return { group: model.group, update: (t, dt) => model.update(dt), dispose: () => model.dispose() }; },
  })),
  ...PLAZA_PROPS.map(p => ({ ...object(p.id, p.label, 'Objetos', '/engine/plaza-props.js', p.id, ['Escondidas', 'Cocina', 'Derrape']), dimensions: [p.width, p.height, p.depth] })),
  object('market-stall', 'Puesto de mercado', 'Objetos', '/engine/plaza-props.js', 'marketStall', ['Escondidas', 'Cocina', 'Derrape']),
  object('street-lamp', 'Farol de plaza', 'Objetos', '/engine/plaza-props.js', 'streetLamp', ['Escondidas', 'Cocina', 'Derrape']),
  object('house', 'Casa del pueblo', 'Objetos', '/engine/plaza.js', 'house', ['Escondidas', 'Cocina', 'Derrape']),
  object('mango', 'Mango', 'Objetos', '/engine/props.js', 'makeMango', ['Bululú', 'Derrape']),
  object('gold-mango', 'Mango dorado', 'Objetos', '/engine/props.js', 'makeMango', ['Bululú', 'Derrape'], { gold: true }),
  ...[['palm', 'Palmera'], ['mangoTree', 'Árbol de mango'], ['ceiba', 'Ceiba'], ['pine', 'Pino'], ['banana', 'Mata de cambur'], ['bush', 'Arbusto'], ['casita', 'Casita de isla']].map(([factory, name]) => object(factory, name, factory === 'casita' ? 'Objetos' : 'Vegetación', '/engine/flora.js', factory, shared, { seed: 7 })),
  ...[['beachShade', 'Sombrilla de playa'], ['beachHut', 'Rancho de playa'], ['driftwood', 'Tronco de playa']].map(([factory, name]) => object(factory, name, 'Objetos', '/engine/beach-props.js', factory, ['Bululú', 'Derrape'])),
  ...RECIPES.map(r => ({ ...object(`food-${r.id}`, r.name, 'Objetos', '/engine/kitchen-props.js', 'food', ['Cocina'], r.id), tags: ['comida', 'cocina'] })),
  object('corn', 'Mazorca', 'Objetos', '/engine/kitchen-props.js', 'corn', ['Cocina']),
  object('cheese', 'Queso', 'Objetos', '/engine/kitchen-props.js', 'cheese', ['Cocina']),
  object('sink', 'Fregadero', 'Objetos', '/engine/kitchen-props.js', 'sink', ['Cocina']),
  ...STATIONS.filter((s, i, all) => all.findIndex(a => a.type === s.type) === i).map(s => object(`station-${s.type}`, `Estación · ${s.label}`, 'Objetos', '/engine/kitchen-props.js', 'kitchenStation', ['Cocina'], s)),
  ...CARS.map(car => ({ id: `car-${car.id}`, name: car.name, category: 'Vehículos', source: '/g/derrape/cars.js', factory: `CARS.find(c => c.id === '${car.id}').build`, usedBy: ['Derrape'], description: car.blurb,
    async build() { const model = car.build(DEFAULT_AVATAR); return { group: model.root, update: (t, dt) => model.driver.update(dt), dispose: () => model.driver.dispose() }; },
  })),
  { id: 'plaza', name: 'Plaza Pana', category: 'Mapas', source: '/engine/plaza.js', factory: 'createPlazaEnvironment', usedBy: ['Escondidas', 'Cocina', 'Derrape'], game: '/g/escondidas/',
    async build() { const { createPlazaEnvironment } = await import('/engine/plaza.js'); return { ...createPlazaEnvironment(), bounds: new Box3(new Vector3(-25, 0, -22), new Vector3(25, 15, 22)) }; },
  },
  { id: 'cocina', name: 'Cocina de la plaza', category: 'Mapas', source: '/g/cocina/scene.js', factory: 'createKitchenScene', usedBy: ['Cocina'], game: '/g/cocina/',
    async build() {
      const { createKitchenScene } = await import('/g/cocina/scene.js'); const model = createKitchenScene({ labelsRoot: null });
      const lights = []; model.scene.traverse(o => { if (o.isLight) lights.push(o); }); lights.forEach(o => o.removeFromParent());
      const state = { phase: 'lobby', stations: STATIONS.map(s => ({ id: s.id, item: null, fire: 0, progress: 0 })) };
      return { group: model.scene, bounds: new Box3(new Vector3(-24, 0, -20), new Vector3(24, 15, 20)), update: t => model.update(t, state, null, null, false), dispose: () => model.dispose() };
    },
  },
  { id: 'isla', name: 'Isla Bululú', category: 'Mapas', source: '/engine/island-terrain.js', factory: 'buildIsland', usedBy: ['Bululú', 'Derrape'], game: '/g/bululu/', description: 'Terreno compartido de la isla. Cada juego añade sus rutas y decoraciones.',
    async build() { const { buildIsland } = await import('/engine/island-terrain.js'); return buildIsland([], []); },
  },
  ...TRACKS.map(track => ({ id: `track-${track.id}`, name: `Circuito · ${track.name}`, category: 'Mapas', source: `/g/derrape/tracks/${track.id}.js`, dependencies: ['/g/derrape/tracks.js'], factory: 'makeTrack(definition).build', usedBy: ['Derrape'], description: track.blurb, game: '/g/derrape/',
    async build() { const model = makeTrack(track); return { group: model.build(), bounds: new Box3(new Vector3(-model.bounds.x - 20, 0, -model.bounds.z - 20), new Vector3(model.bounds.x + 20, 35, model.bounds.z + 20)), update: (t, dt) => model.animated.forEach(o => o.userData.tick?.(t, dt)) }; },
  })),
];
export const CATEGORIES = ['Todos', 'Personajes', 'Vestuario', 'Objetos', 'Vegetación', 'Vehículos', 'Mapas'];
export function sourcePath(url) {
  return url.startsWith('/engine/') ? `Pana${url}` : url.replace(/^\/g\/([^/]+)\//, 'Pana/games/$1/public/');
}
export function assetContext(asset) {
  return `Pana Studio — ${asset.name}\nID: ${asset.id}\nCategoría: ${asset.category}\nFuente: ${sourcePath(asset.source)}\nConstructor: ${asset.factory}\nUsado en: ${asset.usedBy.join(', ')}\n\nLee Pana/AGENTS.md y docs/knowledge/pana-studio.md. Modifica la fuente compartida sin duplicar el modelo. Conserva escala, origen y contratos de los consumidores. Registra variantes en Pana/web/studio/catalog.js y verifica la vista previa y los juegos afectados.`;
}
