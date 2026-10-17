// Model metadata only: no Three.js, construction or game imports.
export default [
  {
    id: "mango",
    name: "Mango",
    category: "Objetos",
    source: "/engine/models/props/mango.js",
    factory: "makeMango",
    usedBy: ["Bululú","Derrape"],
    previewOptions: null,
    pack: "common"
  },
  {
    id: "gold-mango",
    name: "Mango dorado",
    category: "Objetos",
    source: "/engine/models/props/mango.js",
    factory: "makeMango",
    usedBy: ["Bululú","Derrape"],
    previewOptions: {"gold":true},
    pack: "common"
  },
  {
    id: "china",
    name: "China (tirapiedras)",
    category: "Objetos",
    source: "/engine/models/props/china.js",
    factory: "china",
    usedBy: ["Bululú"],
    previewOptions: null,
    description: "Horqueta de guayabo, dos ligas y una badana de cuero; pull() estira las ligas hacia atrás.",
    tags: ["juguete","china","Bululú","animado"],
    pack: "common"
  },
];
