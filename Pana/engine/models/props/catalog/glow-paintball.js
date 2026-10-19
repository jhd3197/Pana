// Geometry-free metadata; Studio previews the same factories Pepazo's night field uses.
const entry = (id, name, factory, description, previewOptions = {}) => ({
  id, name, category: 'Objetos', source: '/engine/models/props/glow-paintball.js', factory, usedBy: ['¡Pintura!'],
  previewOptions, description, tags: ['paintball', 'noche', 'luces'], pack: 'glow-paintball',
});
export default [
  entry('pallet-bunker', 'Bunker de paletas', 'palletBunker', 'Paletas de madera apiladas y un poco torcidas; llenan su caja de colisión exacta.'),
  entry('inflatable-can', 'Inflable lata', 'inflatableBunker', 'Tambor inflable con cúpula y una franja de color.', { shape: 'can' }),
  entry('inflatable-dorito', 'Inflable dorito', 'inflatableBunker', 'Prisma triangular inflable de esquinas suaves.', { shape: 'dorito', w: 2.2, h: 1.9, d: 2.2 }),
  entry('inflatable-snake', 'Inflable culebra', 'inflatableBunker', 'Tubo inflable largo y bajo, acostado en el suelo.', { shape: 'snake', w: 5, h: 1, d: 1.2 }),
  entry('inflatable-brick', 'Inflable ladrillo', 'inflatableBunker', 'Bloque inflable redondeado con franja.', { shape: 'brick', w: 2.4, h: 1.4, d: 1.4 }),
  entry('tube-bunker', 'Tubo de plástico', 'tubeBunker', 'Tubo grande de plástico con costillas, acostado; se ve a través de él.'),
  entry('floodlight-mast', 'Torre de reflectores', 'floodlightMast', 'Poste de acero con dos reflectores de color para canchas de noche.'),
  entry('led-rope', 'Manguera LED', 'ledRope', 'Manguera de luz tirada en el suelo que marca carriles y bordes de noche.'),
];
