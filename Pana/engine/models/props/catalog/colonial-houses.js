import { HOUSE_PRESETS } from '../colonial-house-definitions.js';

export default HOUSE_PRESETS.map(({ id, name, ...previewOptions }) => ({
  id, name, category: 'Objetos', pack: 'casas-coloniales',
  source: '/engine/models/props/colonial-house.js', factory: 'colonialHouse',
  usedBy: ['Pana Studio', 'Carreritas'], previewOptions, houseMaker: true,
  description: 'Casa modular con puertas altas, rejas, tejas, plantas y acabados de pared: pintura a la cal, ladrillos pintados o a la vista. Cambia la receta en el creador de casas.',
  tags: ['casa', 'colonial', 'Venezuela', 'creador', 'semilla', previewOptions.family],
}));
