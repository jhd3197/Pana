// Model metadata only: no Three.js, construction or game imports.
export default [
  {
    id: "conuco-house",
    name: "Casa del conuco",
    category: "Pueblo",
    source: "/engine/models/props/conuco.js",
    factory: "conucoHouse",
    usedBy: ["pana.sh"],
    previewOptions: { tier: 5 },
    description: "Cinco niveles, del rancho caído a la casona amarilla.",
    tags: ["conuco","casa","rancho","home plot"],
    pack: "conuco"
  },
  {
    id: "conuco-bed",
    name: "Cantero de tierra",
    category: "Vegetación",
    source: "/engine/models/props/conuco.js",
    factory: "conucoBed",
    usedBy: ["pana.sh"],
    previewOptions: null,
    description: "Tierra arada con surcos y marco de madera.",
    tags: ["conuco","tierra","cantero"],
    pack: "conuco"
  },
  {
    id: "conuco-crop",
    name: "Siembra del conuco",
    category: "Vegetación",
    source: "/engine/models/props/conuco.js",
    factory: "conucoCrop",
    usedBy: ["pana.sh"],
    previewOptions: { crop: "cambur", stage: "ready" },
    description: "Maíz, caraota, ají, cambur, parchita, patilla y cacao, en cinco etapas.",
    tags: ["conuco","cultivo","siembra","crop"],
    pack: "conuco"
  },
  {
    id: "conuco-scarecrow",
    name: "Espantapájaros",
    category: "Vida llanera",
    source: "/engine/models/props/conuco.js",
    factory: "conucoScarecrow",
    usedBy: ["pana.sh"],
    previewOptions: null,
    description: "Hombre de paja con sombrero y camisa roja.",
    tags: ["conuco","espantapajaros"],
    pack: "conuco"
  },
  {
    id: "conuco-bunting",
    name: "Banderines de papel",
    category: "Vida llanera",
    source: "/engine/models/props/conuco.js",
    factory: "conucoBunting",
    usedBy: ["pana.sh"],
    previewOptions: null,
    description: "Cuerda entre dos palos con banderines de tres colores.",
    tags: ["conuco","banderines","fiesta"],
    pack: "conuco"
  }
];
