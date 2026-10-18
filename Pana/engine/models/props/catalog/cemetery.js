// Model metadata only: no Three.js, construction or game imports.
const source = '/engine/models/props/cemetery.js';
const entry = (id, name, factory, previewOptions, description, tags, file = source) => ({
  id, name, category: 'Cementerio', source: file, factory, usedBy: ['Pana Studio'],
  previewOptions, description, tags: ['cementerio', ...tags], pack: 'cemetery',
});

export default [
  ...[
    ['headstone', 'Lápida redondeada', 'Lápida de arco con inscripción tallada y cruz.'],
    ['celtic', 'Cruz celta', 'Cruz de piedra con anillo sobre un pedestal.'],
    ['obelisk', 'Obelisco funerario', 'Obelisco de cuatro caras con remate piramidal.'],
    ['ledger', 'Losa sepulcral', 'Tumba baja de losa con cruz en relieve.'],
    ['wooden', 'Cruz de madera', 'Cruz sencilla de tablas, algo inclinada.'],
  ].map(([type, name, description]) => entry(`grave-${type}`, name, 'grave', { type, seed: 7 }, `${description} Puede llevar musgo, velas o una calabaza.`, ['tumba', 'lápida'])),
  entry('jack-o-lantern', 'Calabaza tallada', 'pumpkin', { size: 0.6, lit: true, seed: 3 }, 'Calabaza de tres lóbulos con cara encendida.', ['calabaza', 'halloween', 'luz']),
  entry('skull', 'Calavera', 'skull', { size: 0.5 }, 'Cráneo de hueso con cuencas oscuras.', ['hueso', 'calavera']),
  entry('grave-candles', 'Velas de tumba', 'graveCandles', { count: 5, seed: 4 }, 'Grupo de velas de cera con llamas.', ['velas', 'luz']),
  entry('coffin', 'Ataúd cerrado', 'coffin', { open: false }, 'Ataúd hexagonal de madera con cruz de hierro.', ['ataúd']),
  entry('coffin-open', 'Ataúd abierto', 'coffin', { open: true }, 'Ataúd con la tapa corrida a un lado.', ['ataúd']),
  entry('open-grave', 'Fosa abierta', 'openGrave', { seed: 5 }, 'Fosa recién cavada con ataúd, montón de tierra y pala.', ['fosa', 'ataúd']),
  entry('iron-fence', 'Reja de hierro', 'ironFence', { length: 8, seed: 3 }, 'Barrotes con puntas de lanza; faltan o se doblan algunos.', ['reja', 'cerca']),
  ...[['urn', 'urna'], ['skull', 'calavera'], ['lantern', 'farol']].map(([top, word]) =>
    entry(`stone-pillar-${top}`, `Pilar de piedra con ${word}`, 'stonePillar', { height: 2.4, top }, `Pilar de esquina rematado con ${word}.`, ['pilar', 'piedra'])),
  entry('cemetery-lantern', 'Farol de hierro', 'cemeteryLantern', {}, 'Farol enrejado con núcleo cálido y asa.', ['farol', 'luz']),
  entry('cemetery-lamp-post', 'Poste de farol', 'cemeteryLampPost', {}, 'Poste de hierro con voluta y farol colgante.', ['farol', 'poste', 'luz']),
  ...[['dark', 'puerta cerrada', 'Puerta ojival de madera oscura.'], ['barred', 'reja', 'Entrada ojival cerrada con barrotes.'], ['glow', 'brillo verde', 'Puerta entreabierta con luz verde y velas.']].map(([door, word, text]) =>
    entry(`mausoleum-${door}`, `Mausoleo con ${word}`, 'mausoleum', { door, seed: 7 }, `Mausoleo con pórtico de columnas, frontón y techo de pizarra. ${text}`, ['mausoleo', 'cripta'])),
  entry('cemetery-gate', 'Portón del cementerio', 'cemeteryGate', { walls: 6, seed: 3 }, 'Pilares con calaveras, arco de hierro con letrero y rejas abiertas.', ['portón', 'entrada', 'letrero']),
  entry('cemetery-chapel', 'Capilla en ruinas', 'cemeteryChapel', { seed: 7 }, 'Capilla gótica con rosetón, vitrales, techo hundido y campanario.', ['capilla', 'iglesia', 'ruinas'], '/engine/models/props/cemetery-chapel.js'),
  entry('crooked-mansion', 'Mansión embrujada', 'crookedMansion', { seed: 7 }, 'Casona torcida con torre, ventanas encendidas, porche y reja con calaveras.', ['mansión', 'casa', 'embrujada'], '/engine/models/props/crooked-mansion.js'),
  entry('scarecrow', 'Espantapájaros', 'scarecrow', { seed: 2 }, 'Saco relleno de paja con cabeza de calabaza y sombrero.', ['espantapájaros', 'calabaza']),
  entry('graveyard-well', 'Pozo de piedra', 'graveyardWell', { seed: 2 }, 'Brocal de piedra con torno, cubo y tejadillo de pizarra.', ['pozo', 'piedra']),
  entry('swamp-boardwalk', 'Pasarela del pantano', 'boardwalk', { length: 16, seed: 2 }, 'Tablones curvos sobre pilotes con una baranda.', ['pantano', 'pasarela', 'madera']),
  entry('stilt-shack', 'Choza sobre pilotes', 'stiltShack', {}, 'Choza del pantano con ventana encendida, farol y escalera.', ['pantano', 'choza', 'pilotes']),
  entry('rowboat', 'Bote de remos', 'rowboat', { sunk: false }, 'Bote sencillo de tablas con remo.', ['bote', 'pantano']),
  entry('rowboat-sunk', 'Bote medio hundido', 'rowboat', { sunk: true }, 'El mismo bote escorado, para dejar medio hundido.', ['bote', 'pantano']),
  entry('wisp', 'Fuego fatuo', 'wisp', { seed: 3, radius: 2 }, 'Luz verde que flota en círculos con un halo aditivo.', ['fuego fatuo', 'luz', 'animado']),
];
