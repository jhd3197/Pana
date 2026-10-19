// Model metadata only: no Three.js, construction or game imports.
const source = '/engine/models/props/crystals.js';
export default [
  ['crystal-cluster', 'Racimo de cristales', 'crystalCluster', { size: 1.6, color: 0 }, 'Prismas hexagonales que brotan de la roca siguiendo su normal; brillo que late desfasado.', ['cueva', 'cristal', 'brillo', 'animado']],
  ['crystal-garden', 'Cristales del arcoíris', 'crystalGarden', { radius: 4, clusters: 8 }, 'Racimos en todos los colores del espectro, una malla instanciada por color. Se aprecia mejor sobre fondo oscuro.', ['cueva', 'cristal', 'arcoíris', 'animado']],
].map(([id, name, factory, previewOptions, description, tags]) => ({
  id, name, category: 'Mina', source, factory, usedBy: ['Pana Studio'], previewOptions, description, tags, pack: 'crystal-caves',
}));
