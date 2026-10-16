// Compose shared model data with Studio-only scene and character adapters.
import { MODEL_DEFINITIONS } from '/engine/models/catalog.js';
import { object } from './catalog/objects.js';
import { CHARACTERS } from './catalog/characters.js';
import { KITCHEN } from './catalog/kitchen.js';
import { VEHICLES } from './catalog/vehicles.js';
import { MAPS } from './catalog/maps.js';

const adapted = (assets, source) => assets.map(asset => ({...asset, dependencies: [...(asset.dependencies || []), source]}));
export const ASSETS = [
  ...MODEL_DEFINITIONS.map(object),
  ...adapted(CHARACTERS, '/studio/catalog/characters.js'),
  ...adapted(KITCHEN, '/studio/catalog/kitchen.js'),
  ...adapted(VEHICLES, '/studio/catalog/vehicles.js'),
  ...adapted(MAPS, '/studio/catalog/maps.js'),
];
export const CATEGORIES = ['Todos', 'Personajes', 'Vestuario', 'Objetos', 'Fauna', 'Emblemas', 'Pueblo', 'Selva', 'Llanos', 'Vida llanera', 'Páramo', 'Desierto', 'Termales', 'Costa', 'Vegetación', 'Vehículos', 'Mapas'];
export function sourcePath(url) {
  return url.startsWith('/engine/') ? `Pana${url}` : url.replace(/^\/g\/([^/]+)\//, 'Pana/games/$1/public/');
}
export function assetContext(asset) {
  return `Pana Studio — ${asset.name}\nID: ${asset.id}\nCategoría: ${asset.category}\nFuente: ${sourcePath(asset.source)}\nConstructor: ${asset.factory}\nUsado en: ${asset.usedBy.join(', ')}\n\nLee Pana/AGENTS.md y docs/knowledge/pana-studio.md. Modifica la fuente compartida sin duplicar el modelo. Conserva escala, origen y contratos de los consumidores. Registra modelos en Pana/engine/models y adaptadores de escenas en Pana/web/studio/catalog y verifica la vista previa y los juegos afectados.`;
}
