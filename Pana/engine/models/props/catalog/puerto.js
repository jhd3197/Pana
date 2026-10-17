const entry = (id, name, file, factory, description) => ({ id, name, category: 'Costa', source: `/engine/models/props/${file}.js`, factory, description, usedBy: ['Derrape'], pack: 'puerto' });
export default [
  entry('shipping-container', 'Contenedor de carga', 'port-cargo', 'shippingContainer', 'Contenedor acanalado de doce metros con puertas, cerrojos y esquineras de apilado.'),
  entry('transit-warehouse', 'Almacén del muelle', 'port-cargo', 'transitWarehouse', 'Galpón de carga con portones enrollables, andén y cubierta ventilada.'),
  entry('port-bollard', 'Bolardo del puerto', 'port-cargo', 'portBollard', 'Amarre de hierro con base atornillada y cabeza transversal.'),
  entry('port-crane', 'Grúa del puerto', 'port-crane', 'portCrane', 'Pórtico rojo y azul con pluma de celosía, tirantes, cabina y elevador de contenedores.'),
  entry('cargo-ship', 'Buque portacontenedores', 'cargo-ship', 'cargoShip', 'Carguero con proa curva, puente de mando, barandillas y contenedores compartidos.'),
  entry('coastal-fortress', 'Fortín de la costa', 'coastal-fort', 'coastalFortress', 'Batería inspirada en La Guaira con baluarte circular, garitas, cañones y bandera.'),
];
