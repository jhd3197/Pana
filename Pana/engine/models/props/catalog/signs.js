// Geometry-free metadata; Studio previews the same factories used in the races.
export default [
  { id: 'wood-sign', name: 'Letrero de madera', category: 'Pueblo', source: '/engine/models/props/wood-sign.js', factory: 'woodSign', usedBy: ['Derrape'],
    previewOptions: { lines: ['CURVA', 'DEL RÍO'] }, description: 'Letrero de tablones sobre dos postes; cada línea se encoge para caber.', tags: ['letrero', 'madera', 'pista'], pack: 'signs' },
  { id: 'sign-board', name: 'Tablero pintado', category: 'Pueblo', source: '/engine/models/props/wood-sign.js', factory: 'signBoard', usedBy: ['Derrape'],
    previewOptions: { lines: ['¡DALE', 'PANA!'], w: 8, h: 2.6 }, description: 'Tablero de madera con ribete de color y letras de caricatura; el texto siempre cabe.', tags: ['letrero', 'pancarta', 'pista'], pack: 'signs' },
];
