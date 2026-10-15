// Model metadata only: no Three.js, construction or game imports.
export default [
  {
    id: "house",
    name: "Casa del pueblo",
    category: "Objetos",
    source: "/engine/models/props/plaza-buildings.js",
    factory: "house",
    usedBy: ["Escondidas","Cocina","Derrape"],
    previewOptions: null,
    pack: "plaza-buildings"
  },
  {
    id: "plaza-fountain",
    name: "Fuente de Plaza Pana",
    category: "Emblemas",
    source: "/engine/models/props/plaza-buildings.js",
    factory: "plazaFountain",
    usedBy: ["Escondidas","Cocina","Derrape"],
    previewOptions: null,
    description: "Capibara coronado, mosaicos turquesa y chorros con ondas animadas.",
    tags: ["pana","fuente","agua","plaza"],
    pack: "plaza-buildings"
  },
];
