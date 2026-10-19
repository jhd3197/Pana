import { object } from './objects.js';
const source = '/g/stop/studio-set.js';
export const STOP = [
  { id: 'stop-table', name: 'Mesa redonda de ¡Stop!', factory: 'createStopTable', description: 'Mesa de plaza de 3 m de radio con tope pintado en sol, borde a rayas y un solo pie. Superficie a 1,42 m.' },
  { id: 'stop-letter-wheel', name: 'Rueda de letras', factory: 'createLetterWheel', description: 'Rueda acostada con las 27 letras (con Ñ), clavijas, flecha amarilla en +Z y botón rojo ¡PARA! que muestra la letra. Radio 1,05 m.' },
  { id: 'stop-notebook', name: 'Libreta de rayas', factory: 'createNotebook', description: 'Libreta de espiral abierta de 0,96 × 0,66 m con rayas azules y margen rojo; garabatea una línea por casilla llena, nunca las palabras.', previewOptions: { cover: '#2ad1b2' } },
  { id: 'stop-pencil', name: 'Lápiz', factory: 'createPencil', description: 'Lápiz amarillo de 0,55 m con borrador rosado; la punta es el origen y el borrador apunta a +Y.' },
  { id: 'stop-plastic-chair', name: 'Silla plástica', factory: 'createPlasticChair', description: 'La silla plástica de la plaza, en colores. Asiento a 0,74 m, respaldo en −Z.', previewOptions: { color: '#2ad1b2' } },
  { id: 'stop-slang-wall', name: 'Muro de palabras', factory: 'createSlangWall', description: 'Muro morado de 14 × 4 m con jerga venezolana pintada (cambur, cotufa, chamo, rascao…), como en el reel.' },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: ['¡Stop!'], dependencies: ['/engine/models/props/game-table.js'] }));
