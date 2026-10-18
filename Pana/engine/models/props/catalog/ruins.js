// Model metadata only: no Three.js, construction or game imports.
const source = '/engine/models/props/ruins.js';
export default [
  ['prasat', 'Torre prasat', 'prasat', { seed: 71 }, 'Santuario jemer de laterita con nicho, puertas falsas y cuatro pisos coronados en oro.', ['templo', 'torre', 'ruinas', 'jemer']],
  ['prasat-broken', 'Torre prasat derrumbada', 'prasat', { seed: 72, broken: true, laterite: false }, 'Santuario de arenisca con los pisos caídos y escombros al frente.', ['templo', 'torre', 'ruinas', 'escombros']],
  ['bayon-face', 'Rostro de Bayón', 'bayonFace', { seed: 72 }, 'Cabeza tallada gigante con cejas, labios y corona escalonada.', ['templo', 'rostro', 'escultura', 'ruinas']],
  ['olmec-head', 'Cabeza olmeca', 'olmecHead', { seed: 73 }, 'Cabeza de piedra gris verdosa medio enterrada, con musgo en la frente.', ['selva', 'escultura', 'ídolo', 'ruinas']],
  ['ruin-column', 'Columna de tambores', 'ruinColumn', { seed: 74 }, 'Columna de tambores desalineados sobre plinto, con capitel musgoso.', ['columna', 'templo', 'ruinas']],
  ['ruin-column-broken', 'Columna rota', 'ruinColumn', { seed: 9, broken: true }, 'Fuste partido con musgo en el corte y un tambor caído al lado.', ['columna', 'ruinas', 'escombros']],
  ['fallen-column', 'Columna caída', 'fallenColumn', { seed: 75 }, 'Tambores tumbados en hilera con una franja de musgo.', ['columna', 'ruinas', 'suelo']],
  ['ruin-rubble', 'Escombros del templo', 'ruinRubble', { seed: 76 }, 'Montón de bloques labrados y piedras sueltas cubiertas de musgo.', ['escombros', 'bloques', 'ruinas']],
  ['ruin-stairs', 'Escalinata en ruinas', 'ruinStairs', { seed: 77, broken: true }, 'Escalones de piedra con alfardas; la versión rota pierde peldaños.', ['escalera', 'templo', 'ruinas']],
  ['stela', 'Estela de glifos', 'stela', { seed: 78 }, 'Estela de remate redondo con una cuadrícula de glifos tallados.', ['estela', 'glifos', 'ruinas']],
  ['sun-seal', 'Sello solar', 'sunSeal', { seed: 79 }, 'Estrado de piedra con anillos, rayos y clavos de oro incrustados.', ['oro', 'sello', 'suelo', 'ruinas']],
  ['ruin-brazier', 'Pebetero de piedra', 'brazier', { seed: 80 }, 'Pedestal hexagonal con cuenco y llamas animadas; luz opcional.', ['fuego', 'antorcha', 'templo', 'animado']],
  ['plank-bridge', 'Puente de tablas', 'plankBridge', { seed: 81 }, 'Tablas combadas entre dos salientes, barandas de madera y cuerdas.', ['puente', 'tablas', 'abismo']],
  ['plank-bridge-broken', 'Puente de tablas roto', 'plankBridge', { seed: 82, broken: true }, 'Puente partido al centro con tablas y cuerdas colgando.', ['puente', 'roto', 'abismo', 'obstáculo']],
  ['rock-tower', 'Pilar del abismo', 'rockTower', { seed: 82, height: 10 }, 'Pilar de roca con hiladas de piedra y cima enlosada.', ['roca', 'pilar', 'abismo', 'cueva']],
  ['ruin-paving', 'Enlosado del templo', 'ruinPaving', { seed: 83 }, 'Losas gastadas, algunas faltantes y otras cubiertas de musgo.', ['suelo', 'losas', 'ruinas']],
  ['stalagmites', 'Estalagmitas', 'stalagmites', { seed: 84 }, 'Grupo de conos calcáreos que suben del suelo de la cueva.', ['cueva', 'roca', 'formación']],
  ['ruin-gate', 'Portal de la selva', 'ruinGate', { seed: 85 }, 'Pilares apilados, dintel con musgo y lianas, custodiado por dos cabezas.', ['selva', 'portal', 'ruinas', 'entrada']],
  ['carved-stele', 'Piedra tallada antigua', 'carvedStele', { seed: 86 }, 'Estela inclinada con marco escalonado, espirales y fila de glifos.', ['selva', 'estela', 'ídolo', 'ruinas']],
  ['rock-facade', 'Fachada tallada en roca', 'rockFacade', { seed: 87 }, 'Columnata, frontón con disco de oro y nichos oscuros en la pared de roca.', ['templo', 'fachada', 'cueva', 'ruinas']],
].map(([id, name, factory, previewOptions, description, tags]) => ({
  id, name, category: 'Ruinas', source, factory, usedBy: ['Pana Studio'], previewOptions, description, tags, pack: 'ruins',
})).concat([
  ['jaguar-statue', 'Jaguar de piedra', 'jaguarStatue', { seed: 11 }, 'Jaguar sentado tallado en piedra gastada sobre un plinto escalonado, ojos de jade.', ['selva', 'jaguar', 'escultura', 'ruinas']],
  ['jaguar-relief', 'Relieve del jaguar', 'jaguarRelief', { seed: 13 }, 'Dintel con un jaguar caminando en bajorrelieve, rosetas taladradas y greca escalonada.', ['selva', 'jaguar', 'dintel', 'ruinas']],
].map(([id, name, factory, previewOptions, description, tags]) => ({
  id, name, category: 'Ruinas', source: '/engine/models/props/jaguar-stone.js', factory, usedBy: ['Pana Studio'], previewOptions, description, tags, pack: 'ruins',
})));
