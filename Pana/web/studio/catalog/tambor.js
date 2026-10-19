import { object } from './objects.js';
const source = '/g/tambor/rueda-set.js';
export const TAMBOR = [
  { id: 'tambor-culo-e-puya', name: 'Culo e\' puya', factory: 'createCuloEPuya', description: 'Tambor delgado de dos cueros con franjas pintadas y amarre de mecate. Eje +Y, 0,78–0,95 m según el tamaño (prima, cruzao, pujao).', previewOptions: { size: 'pujao' } },
  { id: 'tambor-culo-e-puya-set', name: 'Juego de culo e\' puya', factory: 'createCuloEPuyaSet', description: 'Los tres culo e\' puya inclinados sobre una base baja, con los cueros hacia el tamborero (−Z).' },
  { id: 'tambor-mina', name: 'Tambor largo con horqueta', factory: 'createMina', description: 'Tambor de 2,1 m apoyado en su horqueta, con la curbata al lado y los palos encima. Frente +Z.' },
  { id: 'tambor-charrasca', name: 'Charrasca', factory: 'createCharrasca', description: 'Tubo de metal estriado con su raspador, sobre una caja de 0,55 m.' },
  { id: 'tambor-maraca', name: 'Maraca', factory: 'createMaraca', description: 'Maraca de 0,3 m con franja roja; el mango en el origen.' },
  { id: 'tambor-maracas', name: 'Maracas', factory: 'createMaracas', description: 'Un par de maracas cruzadas.' },
  { id: 'tambor-caracol', name: 'Caracol', factory: 'createCaracol', description: 'Caracol de 0,45 m con espiral, puntas y labio rosado; boquilla hacia −X.' },
  { id: 'tambor-panuelo', name: 'Pañuelo', factory: 'createPanuelo', description: 'Pañuelo rojo de 0,42 m que ondea; se cuelga de la mano en el origen.' },
  { id: 'tambor-violin', name: 'Nube de violín', factory: 'createViolinCloud', description: 'Nubecita verde con rayitas de olor que sigue al que bailó demasiado.' },
  { id: 'tambor-casita-rosada', name: 'La casita rosada', factory: 'createPinkShack', description: 'Rancho de playa rosado con techo de zinc, ventana de despacho, letrero pintado, banquitos y cava. 4,6 × 3,4 m, frente +Z.' },
  { id: 'tambor-bombillos', name: 'Bombillos', factory: 'createStringLights', description: 'Cable con bombillos de colores que cuelga 0,8 m entre dos puntos a 10 m.' },
  { id: 'tambor-mural', name: 'Mural del malecón', factory: 'createMural', description: 'Muro de 9 × 3 m con un atardecer, palmeras y bailadores pintados.' },
  { id: 'tambor-rueda', name: 'Rueda de conchas', factory: 'createRuedaRing', description: 'Círculo de arena pisada de 3,4 m de radio con un borde de conchas.' },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: ['La Rueda de Tambor'], dependencies: ['/engine/models/props/game-table.js'] }));
