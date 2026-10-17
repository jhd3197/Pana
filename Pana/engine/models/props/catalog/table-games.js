export default [
  ['pool-table', 'Mesa de billar', 'pool', 'createPoolTable', 'Billar', {}],
  ['pool-ball', 'Bola de billar', 'pool', 'createPoolBall', 'Billar', { number: 9 }],
  ['pool-cue', 'Taco de billar', 'pool', 'createPoolCue', 'Billar', {}],
  ['poker-table', 'Mesa de póquer', 'poker', 'createPokerTable', 'Póquer', {}],
  ['poker-card', 'Carta de póquer', 'poker', 'createPokerCard', 'Póquer', { card: 38 }],
  ['poker-chips', 'Fichas de póquer', 'poker', 'createPokerChips', 'Póquer', {}],
  ['paint-marker', 'Marcadora de pintura', 'paintball', 'createPaintMarker', '¡Pintura!', {}],
].map(([id, name, module, factory, game, previewOptions]) => ({ id, name, category: 'Objetos', source: `/engine/models/props/${module}.js`, factory, usedBy: [game], pack: 'table-games', previewOptions }));
