// Geometry-free metadata; Studio previews the same factories used in the races.
export default [
  { id: 'wood-sign', name: 'Letrero de madera', category: 'Pueblo', source: '/engine/models/props/wood-sign.js', factory: 'woodSign', usedBy: ['Carreritas'],
    previewOptions: { lines: ['CURVA', 'DEL RÍO'] }, description: 'Letrero de tablones sobre dos postes; cada línea se encoge para caber.', tags: ['letrero', 'madera', 'pista'], pack: 'signs' },
  { id: 'sign-banner', name: 'Pancarta pintada', category: 'Pueblo', source: '/engine/models/props/wood-sign.js', factory: 'signBanner', usedBy: ['Carreritas'],
    previewOptions: { lines: ['¡DALE', 'PANA!'], w: 8, h: 2.6 }, description: 'Tablero de madera sobre dos postes, ribete de color y letras de caricatura en ambas caras; el texto siempre cabe.', tags: ['letrero', 'pancarta', 'pista'], pack: 'signs' },
  { id: 'reflector-post', name: 'Delineador de carretera', category: 'Pueblo', source: '/engine/models/props/wood-sign.js', factory: 'reflectorPost', usedBy: ['Carreritas'],
    previewOptions: null, description: 'Poste redondeado con franja de color y reflectores ámbar a cada lado, para bordes de carretera.', tags: ['carretera', 'poste', 'reflector', 'pista'], pack: 'signs' },
];
