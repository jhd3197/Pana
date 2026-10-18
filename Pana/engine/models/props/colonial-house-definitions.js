// Plain recipe metadata shared by the generator, catalog and Studio controls.
export const HOUSE_VERSION = 3;
export const HOUSE_FINISHES = [
  { id: 'lisa', name: 'Pintura lisa' },
  { id: 'cal', name: 'Pintura a la cal' },
  { id: 'ladrillo-pintado', name: 'Relieve de ladrillo pintado' },
  { id: 'ladrillo-visto', name: 'Revoque con ladrillos a la vista' },
];
export const HOUSE_WINDOWS = [
  { id: 'reja', name: 'Reja recta' },
  { id: 'reja-curva', name: 'Reja saliente con adorno' },
  { id: 'postigos', name: 'Postigos abiertos' },
  { id: 'arco', name: 'Ventana de arco' },
  { id: 'doble', name: 'Ventana doble ancha' },
  { id: 'celosia', name: 'Celosía de madera' },
];
export const HOUSE_ROOFS = [
  { id: 'tejas', name: 'Tejas a dos aguas' },
  { id: 'cuatro-aguas', name: 'Tejas a cuatro aguas' },
  { id: 'azotea', name: 'Azotea con pretil' },
];
export const HOUSE_LAYOUTS = [
  { id: 'clasica', name: 'Fachada clásica' },
  { id: 'lateral', name: 'Entrada lateral' },
  { id: 'amplia', name: 'Menos vanos, más anchos' },
];
export const HOUSE_FAMILIES = [
  { id: 'casa-baja', name: 'Casa baja', floors: [1, 2], width: 7.2 },
  { id: 'casa-larga', name: 'Casa larga', floors: [1], width: 10.8 },
  { id: 'casa-esquina', name: 'Casa de esquina', floors: [1, 2], width: 7.8 },
  { id: 'casa-balcon', name: 'Casa con balcón', floors: [2], width: 7.2 },
  { id: 'casa-portal', name: 'Casa con portal', floors: [1], width: 7.8 },
  { id: 'casa-remate', name: 'Casa con remate', floors: [1, 2], width: 7.8 },
];
export const HOUSE_PALETTES = [
  { id: 'amarillo', name: 'Amarillo y crema', wall: 0xf1b72e, upper: 0xf1b72e, base: 0xf0dfbc, trim: 0xffe8c5, joinery: 0x68402c },
  { id: 'azul', name: 'Azul colonial', wall: 0x3889ba, upper: 0x3889ba, base: 0xf0dfbc, trim: 0xffe8c5, joinery: 0x643a27 },
  { id: 'coral-crema', name: 'Coral y crema', wall: 0xe5765a, upper: 0xf6e2bc, base: 0xc96044, trim: 0xffe8c5, joinery: 0x23546a },
  { id: 'turquesa', name: 'Turquesa y terracota', wall: 0x35a6a5, upper: 0x35a6a5, base: 0xcd6049, trim: 0xffe8c5, joinery: 0x61402c },
  { id: 'cielo', name: 'Celeste y añil', wall: 0x82b8df, upper: 0x82b8df, base: 0x326991, trim: 0xffe8c5, joinery: 0x23546a },
  { id: 'crema', name: 'Crema y azul', wall: 0xf0dfbd, upper: 0xf0dfbd, base: 0x3e7f9e, trim: 0x3e7f9e, joinery: 0x68402c },
];
export const HOUSE_PLANTING = [
  { id: 'entrada', name: 'Macetas en la entrada' },
  { id: 'balcon', name: 'Hojas colgantes' },
  { id: 'flores', name: 'Trinitaria y flores' },
  { id: 'ventanas', name: 'Jardineras' },
  { id: 'ninguna', name: 'Sin plantas' },
];
export const HOUSE_PRESETS = [
  { id: 'colonial-yellow', name: 'Casa amarilla', family: 'casa-baja', width: 7.2, depth: 5.8, floors: 1, seed: 11, palette: 'amarillo', planting: 'entrada', door: 'square', windowStyle: 'reja', roof: 'tejas', layout: 'clasica' },
  { id: 'colonial-balcony', name: 'Casa azul con balcón', family: 'casa-balcon', width: 7.2, depth: 5.8, floors: 2, seed: 22, palette: 'azul', planting: 'balcon', door: 'square', windowStyle: 'reja-curva', roof: 'tejas', layout: 'clasica' },
  { id: 'colonial-crest', name: 'Casa de la trinitaria', family: 'casa-remate', width: 7.8, depth: 5.8, floors: 1, seed: 33, palette: 'cielo', planting: 'flores', door: 'arch', windowStyle: 'arco', roof: 'tejas', layout: 'clasica' },
  { id: 'colonial-long', name: 'Casa larga del pueblo', family: 'casa-larga', width: 10.8, depth: 5.8, floors: 1, seed: 44, palette: 'amarillo', planting: 'ventanas', windowStyle: 'postigos', roof: 'tejas', layout: 'clasica' },
  { id: 'colonial-corner', name: 'Casa de la esquina', family: 'casa-esquina', width: 7.8, depth: 5.8, seed: 55, palette: 'coral-crema', planting: 'entrada', floors: 2, windowStyle: 'doble', roof: 'cuatro-aguas', layout: 'clasica' },
  { id: 'colonial-porch', name: 'Casa del portal', family: 'casa-portal', width: 7.8, depth: 5.8, floors: 1, seed: 66, palette: 'turquesa', planting: 'entrada', windowStyle: 'celosia', roof: 'tejas', layout: 'clasica' },
];
