// Geometry-free metadata for the barrio street props (props/barrio.js).
const entry = (id, name, factory, description, previewOptions = null, tags = [], usedBy = ['Trifulca']) => ({
  id, name, category: 'Pueblo', source: '/engine/models/props/barrio.js', factory, usedBy,
  previewOptions, description, tags: ['barrio', 'calle', ...tags], pack: 'barrio',
});
export default [
  entry('parked-moto', 'Moto estacionada', 'parkedMoto', 'Moto de calle en su pata de cabra, 2 × 0,7 × 1,1 m. El hijo tipper gira sobre su lado izquierdo para caer como dominó.', { color: '#e8443a', seed: 2 }, ['moto', 'vehículo']),
  entry('cable-pole', 'Esquina de los cables', 'cablePole', 'Poste de concreto de 8 m con cruceta, transformador y un espagueti de cables colgando.', { height: 8 }, ['poste', 'cables']),
  entry('cable-span', 'Cables entre postes', 'cableSpan', 'Varios cables caídos entre dos puntos, para cruzar la calle de poste a poste.', { from: [-5, 7.5, 0], to: [5, 7.5, 0] }, ['cables']),
  entry('produce-crates', 'Pila de cajas de verdura', 'produceCrates', 'Cajas de cartón y plástico con repollos, tomates, plátanos y naranjas; llena su caja w × d × h exacta.', { w: 1.6, d: 1, h: 1.2, seed: 3 }, ['mercado', 'cajas', 'verdura']),
  entry('market-hand-truck', 'Carretilla de mercado', 'marketHandTruck', 'Carretilla roja de dos ruedas con cajas amarradas, 0,6 × 0,5 × 1,3 m.', { load: true }, ['mercado', 'carretilla']),
  entry('plastic-chair', 'Silla plástica', 'plasticChair', 'La silla plástica de la plaza, en colores. Asiento a 0,74 m, respaldo en −Z.', { color: '#2ad1b2' }, ['silla'], ['¡Stop!', 'Trifulca']),
  entry('wooden-stands', 'Gradas de madera', 'woodenStands', 'Gradas escalonadas de madera pintada con techo de zinc, para una manga de coleo o una cancha; userData.seats son los puestos.', { length: 10, rows: 4 }, ['gradas', 'coleo', 'público']),
  entry('lake-bridge', 'Puente sobre el lago', 'lakeBridge', 'Puente largo de concreto con pilones en A, tirantes blancos y faroles encendidos sobre la baranda; visto desde abajo.', { length: 80, span: 40 }, ['puente', 'ciudad', 'noche']),
];
