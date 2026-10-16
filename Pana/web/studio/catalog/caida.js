import { object } from './objects.js';
export const CAIDA = [
  { id: 'caida-card', name: 'Carta española', factory: 'createSpanishCard', description: 'Baraja de Caída: cuatro palos y diez valores. Cara +Y, lado largo Z; 0,64 × 0,96 m.', previewOptions: { rank: 12, suit: 'copas' } },
  { id: 'caida-score-token', name: 'Ficha de Caída', factory: 'createScoreToken', description: 'Ficha dorada para marcar puntos. Origen en la base.' },
].map(def => object({ ...def, source: '/g/caida/models.js', category: 'Objetos', usedBy: ['Caída'], dependencies: ['/g/caida/cards.js', '/g/caida/rules.js', '/engine/models/props/game-table.js'] }));
