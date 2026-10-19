// Compose shared model data with Studio-only scene and character adapters.
import { MODEL_DEFINITIONS } from '/engine/models/catalog.js';
import { object } from './catalog/objects.js';
import { CHARACTERS } from './catalog/characters.js';
import { KITCHEN } from './catalog/kitchen.js';
import { VEHICLES } from './catalog/vehicles.js';
import { MAPS } from './catalog/maps.js';
import { DOMINO } from './catalog/domino.js';
import { CAIDA } from './catalog/caida.js';
import { LUDO } from './catalog/ludo.js';
import { QQSMP } from './catalog/qqsmp.js';
import { TAMBOR } from './catalog/tambor.js';

const adapted = (assets, source) => assets.map(asset => ({...asset, dependencies: [...(asset.dependencies || []), source]}));
export const ASSETS = [
  ...MODEL_DEFINITIONS.map(object),
  ...adapted(CHARACTERS, '/studio/catalog/characters.js'),
  ...adapted(KITCHEN, '/studio/catalog/kitchen.js'),
  ...adapted(VEHICLES, '/studio/catalog/vehicles.js'),
  ...adapted(MAPS, '/studio/catalog/maps.js'),
  ...adapted(DOMINO, '/studio/catalog/domino.js'),
  ...adapted(CAIDA, '/studio/catalog/caida.js'),
  ...adapted(LUDO, '/studio/catalog/ludo.js'),
  ...adapted(QQSMP, '/studio/catalog/qqsmp.js'),
  ...adapted(TAMBOR, '/studio/catalog/tambor.js'),
];
export const CATEGORIES = ['Todos', 'Personajes', 'Vestuario', 'Objetos', 'Fauna', 'Emblemas', 'Pueblo', 'Selva', 'Llanos', 'Vida llanera', 'Páramo', 'Desierto', 'Termales', 'Costa', 'Ruinas', 'Mina', 'Cementerio', 'Campamento', 'Atmósfera', 'Vegetación', 'Vehículos', 'Mapas'];
export function sourcePath(url) {
  if (url.startsWith('/engine/')) return `Pana${url}`;
  if (url.startsWith('/studio/')) return `Pana/web${url}`;
  return url.replace(/^\/g\/([^/]+)\//, 'Pana/games/$1/public/');
}
export function assetContext(asset) {
  return `Pana Studio — ${asset.name}\nID: ${asset.id}\nCategoría: ${asset.category}\nStudio: /studio/assets/${encodeURIComponent(asset.id)}\nFuente: ${sourcePath(asset.source)}\nConstructor: ${asset.factory}\nUsado en: ${asset.usedBy.join(', ')}\nDependencias declaradas: ${(asset.dependencies || []).map(sourcePath).join(', ') || 'Ninguna adicional'}\nOpciones de vista previa: ${JSON.stringify(asset.previewOptions || {})}\n\nLee AGENTS.md y docs/knowledge/pana-studio.md. Modifica la fuente compartida sin duplicar el modelo. Conserva escala, origen y contratos de los consumidores. Registra modelos en Pana/engine/models y adaptadores de escenas en Pana/web/studio/catalog y verifica la vista previa y los juegos afectados. Anota la prueba y cualquier limitación.`;
}
