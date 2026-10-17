// Model metadata only: no Three.js, construction or game imports.
export default [
  {
    id: "house",
    name: "Casa del pueblo",
    category: "Objetos",
    source: "/engine/models/props/plaza-buildings.js",
    factory: "house",
    usedBy: ["Escondidas","Cocina","Derrape","Billar","Póquer","¡Pintura!"],
    previewOptions: {style:"tejas",h:7.3},
    description: "Tejas de barro, puerta arqueada y contraventanas. Semillas deterministas; cuatro fachadas distintas.",
    pack: "plaza-buildings"
  },
  ...[
    ['house-balcony','Casa con balcón','balcon',0x5c9da7],
    ['house-shop','Bodeguita del pueblo','tienda',0xe79874],
    ['house-terrace','Casa con terraza','terraza',0x8ba776],
  ].map(([id,name,style,color])=>({
    id,name,category:'Objetos',source:'/engine/models/props/plaza-buildings.js',factory:'house',
    usedBy:['Escondidas','Cocina','Derrape','Billar','Póquer','¡Pintura!'],previewOptions:{style,color,h:7.8,seed:11},pack:'plaza-buildings',
  })),
  {
    id: "plaza-fountain",
    name: "Fuente de Plaza Pana",
    category: "Emblemas",
    source: "/engine/models/props/plaza-buildings.js",
    factory: "plazaFountain",
    usedBy: ["Escondidas","Cocina","Derrape","Billar","Póquer"],
    previewOptions: null,
    description: "Capibara coronado, mosaicos turquesa y chorros con ondas animadas.",
    tags: ["pana","fuente","agua","plaza"],
    pack: "plaza-buildings"
  },
];
