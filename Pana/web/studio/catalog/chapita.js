import { object } from './objects.js';
const source = '/g/chapita/studio-set.js';
export const CHAPITA = [
  { id: 'chapita-cap', name: 'Chapita', factory: 'createChapita', description: 'Chapa de refresco de 0,2 m (tamaño de juguete) con 21 pliegues y la tapa impresa: Kolita del Ávila, Malta Mañanera, Uvita Sabanera, tricolor u oro. bent dobla la chapa como un mal destapador.', previewOptions: { brand: 'kolita' } },
  { id: 'chapita-cap-doblada', name: 'Chapita doblada', factory: 'createChapita', description: 'La misma chapa, abierta con un destapador malo: más bamboleo en el aire.', previewOptions: { brand: 'malta', bent: .8 } },
  { id: 'chapita-cap-oro', name: 'Chapita de oro', factory: 'createChapita', description: 'Premio de torneo: chapa dorada metálica.', previewOptions: { brand: 'oro' } },
  { id: 'chapita-palo', name: 'Palo de escoba', factory: 'createPalo', description: 'El bate por defecto, 1,25 m. Origen en el mango, el palo hacia +Y. kind: escoba, coleto, tricolor, teipe, dorado.', previewOptions: { kind: 'escoba' } },
  { id: 'chapita-palo-teipe', name: 'Palo con teipe', factory: 'createPalo', description: 'Palo de escoba con el mango forrado en teipe negro.', previewOptions: { kind: 'teipe' } },
  { id: 'chapita-palo-tricolor', name: 'Palo tricolor', factory: 'createPalo', description: 'Palo pintado amarillo, azul y rojo.', previewOptions: { kind: 'tricolor' } },
  { id: 'chapita-palo-dorado', name: 'Palo dorado', factory: 'createPalo', description: 'Premio del torneo del barrio, con mango de cinta clara.', previewOptions: { kind: 'dorado' } },
  { id: 'chapita-ventana', name: 'La ventana de la señora', factory: 'createSenoraWindow', description: 'Ventana con rejas, postigos verdes abiertos y matero en un parche de friso de 2,4 m. La apertura está a 1,35–2,55 m.' },
  { id: 'chapita-calle', name: 'Calle del barrio (piso)', factory: 'createStreetGround', description: 'La T de la calle: calle angosta con aceras, la acera donde empieza la calle transversal (z −12,5), la transversal y la acera de las casas (z −26). Plato de tiza en el origen.' },
  { id: 'chapita-cancha', name: 'Cancha del bloque (piso)', factory: 'createBlockCourt', description: 'Cancha azul con rayas blancas y la raya amarilla de la acera, con las mismas zonas que la calle.' },
  { id: 'chapita-cerca', name: 'Cerca de ciclón', factory: 'createChainFence', description: 'Malla de ciclón de 3 m con postes y pancartas de patrocinantes inventados. Corre a lo largo de +X.', previewOptions: { length: 9, banners: 3 } },
  { id: 'chapita-gradas', name: 'Gradas', factory: 'createBleachers', description: 'Tres escalones de tablones sobre hierro, 6 m; userData.seats son los puestos del público.' },
  { id: 'chapita-superbloque', name: 'Superbloque', factory: 'createSuperbloque', description: 'Torre de vivienda rojo y blanco con franjas por piso, balcones y ventanas encendidas. 3 m por piso.', previewOptions: { floors: 8, width: 16 } },
  { id: 'chapita-tuyuyo', name: 'Tuyuyo', factory: 'createTuyuyo', description: 'El chichón rosado que sale después de un chapazo en la cara.' },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: ['Chapita'], dependencies: ['/engine/models/props/game-table.js'] }));
