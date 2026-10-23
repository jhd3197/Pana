// Geometry-free metadata; Studio previews the same factories used in the races.
const entry = (id, name, factory, description, previewOptions = { seed: 3 }) => ({
  id, name, category: 'Pueblo', source: '/engine/models/props/fiesta.js', factory, usedBy: ['Carreritas'],
  previewOptions, description, tags: ['fiesta', 'feria', 'colores'], pack: 'fiesta',
});
export default [
  entry('balloon-bunch', 'Racimo de globos', 'balloonBunch', 'Seis globos brillantes atados a una pesa; se mecen con el viento.'),
  entry('fiesta-flags', 'Banderas de pluma', 'fiestaFlags', 'Tres banderas altas de colores, en fila, para bordes de pista y plazas.'),
  entry('bunting-line', 'Guirnalda de banderines', 'buntingLine', 'Dos postes y una cuerda colgante de banderines triangulares.', { seed: 3, span: 16 }),
  entry('checkered-banner', 'Pancarta a cuadros', 'checkeredBanner', 'Pancarta de carrera a cuadros blancos y negros sobre dos postes de color.', { width: 7 }),
  entry('hot-air-balloon', 'Globo aerostático', 'hotAirBalloon', 'Globo a rayas con cesta de mimbre y cuerdas, para cielos lejanos.', { seed: 3, size: 3 }),
];
