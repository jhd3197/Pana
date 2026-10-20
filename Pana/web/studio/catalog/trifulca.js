import { object } from './objects.js';
const source = '/g/trifulca/set.js';
export const TRIFULCA = [
  { id: 'trifulca-guante', name: 'Guante de boxeo', factory: 'boxingGlove', description: 'Guante grande de caricatura con puño hacia −Y, pulgar hacia +Z y puño de color; cuelga de la mano del pana.', previewOptions: { color: '#e8443a' } },
  { id: 'trifulca-guante-azul', name: 'Guante de boxeo azul', factory: 'boxingGlove', description: 'El guante de la esquina azul.', previewOptions: { color: '#2f6fe0', cuff: '#ffc629' } },
  { id: 'trifulca-casco', name: 'Casco de moto abierto', factory: 'motoHelmet', description: 'Casco de moto abierto, un poco grande, usado como protector. Origen en el centro de la cabeza del pana, cara abierta hacia +Z.', previewOptions: { color: '#ffc629' } },
  { id: 'trifulca-ring', name: 'Ring bajo toldo', factory: 'tentRing', description: 'Ring de 6 × 6 m con lona a 0,6 m, postes acolchados, tres cuerdas (hijo ropes) y carpa negra de truss con pancartas en blanco.' },
  { id: 'trifulca-avila', name: 'El Ávila', factory: 'avilaRidge', description: 'La fila verde del Ávila, 220 m de ancho y hasta 46 m de alto, subiendo hacia −Z.', previewOptions: { width: 120, height: 30, depth: 40 } },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: ['Trifulca'], dependencies: ['/engine/models/props/game-table.js'] }));
