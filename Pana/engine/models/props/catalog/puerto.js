const entry = (id, name, file, factory, description) => ({ id, name, category: 'Costa', source: `/engine/models/props/${file}.js`, factory, description, usedBy: ['Carreritas'], pack: 'puerto' });
export default [
  {...entry('casa-guipuzcoana','Casa Guipuzcoana','casa-guipuzcoana','casaGuipuzcoana','Casa del puerto con patio abierto, columnas, galerías y balcones de madera.'),usedBy:['Carreritas','Caída','Dominó','Póquer']},
  {...entry('san-carlos-fortress','Fuerte San Carlos','san-carlos-fortress','sanCarlosFortress','Castillo con cuatro baluartes, patio abierto, portal, garitas y cañones.'),usedBy:['Carreritas','Caída','Dominó','Póquer']},
  {...entry('port-silos','Silos del puerto','port-silos','portSilos','Doce silos con aletas blancas, torre de ladrillo, hormigón y galería de carga.'),usedBy:['Carreritas','Caída','Dominó','Póquer']},
  entry('shipping-container', 'Contenedor de carga', 'port-cargo', 'shippingContainer', 'Contenedor acanalado de doce metros con puertas, cerrojos y esquineras de apilado.'),
  entry('transit-warehouse', 'Almacén del muelle', 'port-cargo', 'transitWarehouse', 'Galpón de carga con portones enrollables, andén y cubierta ventilada.'),
  entry('port-bollard', 'Bolardo del puerto', 'port-cargo', 'portBollard', 'Amarre de hierro con base atornillada y cabeza transversal.'),
  entry('port-crane', 'Grúa del puerto', 'port-crane', 'portCrane', 'Pórtico rojo y azul con pluma de celosía, tirantes, cabina y elevador de contenedores.'),
  {...entry('yard-gantry', 'Grúa pórtico del patio', 'port-crane', 'yardGantry', 'Pórtico azul sobre cauchos que cruza el patio de contenedores, con carro rojo, cabina y spreader amarillo.'),usedBy:['Pepazo']},
  {...entry('steel-shed', 'Galpón de acero', 'port-cargo', 'steelShed', 'Galpón abierto de columnas rojas, techo de zinc a dos aguas y entrepiso de rejilla con baranda amarilla.'),usedBy:['Pepazo']},
  {...entry('oil-drum', 'Tambor de aceite', 'port-cargo', 'oilDrum', 'Tambor de acero pintado con aros y tapón en la tapa.'),usedBy:['Pepazo']},
  entry('cargo-ship', 'Buque portacontenedores', 'cargo-ship', 'cargoShip', 'Carguero con proa curva, puente de mando, barandillas y contenedores compartidos.'),
  entry('coastal-fortress', 'Fortín de la costa', 'coastal-fort', 'coastalFortress', 'Batería inspirada en La Guaira con baluarte circular, garitas, cañones y bandera.'),
];
