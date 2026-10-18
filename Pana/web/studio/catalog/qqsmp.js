import { object } from './objects.js';
const source = '/g/qqsmp/studio-set.js';
export const QQSMP = [
  { id: 'qqsmp-stage', name: 'Tarima del concurso', factory: 'createQuizStage', description: 'Tarima redonda de 18 m con borde dorado, estrella y bombillos. Superficie a 0,3 m.' },
  { id: 'qqsmp-podium', name: 'Podio del concurso', factory: 'createQuizPodium', description: 'Columna que sube con la escalera de mangos, escritorio con luz de respuesta y placa pintada. Frente +Z.', previewOptions: { color: '#2ad1b2' } },
  { id: 'qqsmp-host-desk', name: 'Atril del animador', factory: 'createHostDesk', description: 'Atril dorado hexagonal con micrófono. Superficie a 1,12 m, frente +Z.' },
  { id: 'qqsmp-screen', name: 'Pantalla del concurso', factory: 'createQuizScreen', description: 'Pantalla 16:9 de 8,4 m con marco dorado, pintada en vivo con la pregunta. Centro a 3,6 m.' },
  { id: 'qqsmp-spotlight', name: 'Reflector', factory: 'createStageSpotlight', description: 'Reflector sobre poste de 5,6 m con cono de luz; aim(x, y, z) lo apunta.', previewOptions: { light: false } },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: ['¿Quién quiere ser mi pana?'], dependencies: ['/engine/models/props/game-table.js'] }));
