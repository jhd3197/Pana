import { object } from './objects.js';
const source = '/g/domino/table-model.js';
export const DOMINO = [
  { id: 'domino-table', name: 'Mesa de dominó', factory: 'createDominoTable', description: 'Mesa de madera y paño verde, con café en las esquinas. Superficie a 1,46 m.' },
  { id: 'domino-chair', name: 'Silla de dominó', factory: 'createDominoChair', description: 'Silla de madera de la Plaza Pana. Asiento a 0,745 m, frente +Z.' },
  { id: 'domino-tile', name: 'Ficha de dominó', factory: 'createDominoTile', description: 'Doble seis de marfil y reverso verde. Cara superior +Y; eje largo Z.' },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: def.id === 'domino-tile' ? ['Dominó'] : ['Dominó', 'Caída'], dependencies: ['/g/domino/tiles.js', '/engine/models/props/game-table.js'] }));
