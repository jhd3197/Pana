// Model metadata only: no Three.js, construction or game imports.
const source = '/engine/models/props/crystals.js';
export default [
  ['crystal-cluster', 'Racimo de cristales', 'crystalCluster', { size: 1.6, color: 0 }, 'Prismas hexagonales que brotan de la roca siguiendo su normal; brillo que late desfasado.', ['cueva', 'cristal', 'brillo', 'animado']],
  ['crystal-garden', 'Cristales del arcoíris', 'crystalGarden', { radius: 4, clusters: 8 }, 'Racimos en todos los colores del espectro, una malla instanciada por color. Se aprecia mejor sobre fondo oscuro.', ['cueva', 'cristal', 'arcoíris', 'animado']],
].map(([id, name, factory, previewOptions, description, tags]) => ({
  id, name, category: 'Mina', source, factory, usedBy: ['Pana Studio'], previewOptions, description, tags, pack: 'crystal-caves',
})).concat([
  ['glow-mushrooms', 'Hongos luminosos', { seed: 7, halo: true }, 'Hongos azules y morados que brillan solos, sin luz propia: baratos para sembrar toda una cueva.', ['cueva', 'hongos', 'brillo', 'suelo']],
  ['glow-mushroom-shelf', 'Repisa de hongos luminosos', { seed: 7, wall: true, count: 5, halo: true }, 'Hongos de repisa que brotan de la pared en azul o morado.', ['cueva', 'hongos', 'brillo', 'pared']],
].map(([id, name, previewOptions, description, tags]) => ({
  id, name, category: 'Mina', source: '/engine/models/props/glow-mushrooms.js', factory: 'glowMushrooms', usedBy: ['Fosa'], previewOptions, description, tags, pack: 'crystal-caves',
})));
