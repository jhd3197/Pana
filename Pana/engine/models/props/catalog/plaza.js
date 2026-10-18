// Reuse gameplay dimensions and labels; no second copy in the catalog.
import { PLAZA_PROPS } from '../plaza-definitions.js';
export default [
  ...PLAZA_PROPS.map(p => ({
    id: p.id, name: p.label, category: 'Objetos', source: '/engine/models/props/plaza.js',
    factory: p.id, usedBy: ['Escondidas', 'Cocina', 'Derrape', 'Billar', 'Caída', ...(['barrel', 'crate', 'cooler'].includes(p.id) ? ['¡Embuste!'] : []), ...(['barrel', 'crate'].includes(p.id) ? ['¡Pintura!'] : [])], previewOptions: null,
    dimensions: [p.width, p.height, p.depth], pack: 'plaza',
  })),
  {
    id: "market-stall",
    name: "Puesto de mercado",
    category: "Objetos",
    source: "/engine/models/props/plaza.js",
    factory: "marketStall",
    usedBy: ["Escondidas","Derrape","¡Pintura!","Billar","Caída"],
    previewOptions: null,
    pack: "plaza"
  },
  {
    id: "street-lamp",
    name: "Farol de plaza",
    category: "Objetos",
    source: "/engine/models/props/plaza.js",
    factory: "streetLamp",
    usedBy: ["Escondidas","Cocina","Derrape","Billar","Póquer","¡Pintura!"],
    previewOptions: null,
    pack: "plaza"
  },
];
