import { object } from './objects.js';
const source = '/g/chapita/studio-set.js';
export const CHAPITA = [
  { id: 'chapita-cap', name: 'Chapita', factory: 'createChapita', description: 'Chapa de refresco de 0,2 m (tamaño de juguete) con 21 pliegues y la tapa impresa: Kolita del Ávila, Malta Mañanera, Uvita Sabanera, tricolor u oro. bent dobla la chapa como un mal destapador.', previewOptions: { brand: 'kolita' } },
  { id: 'chapita-cap-doblada', name: 'Chapita doblada', factory: 'createChapita', description: 'La misma chapa, abierta con un destapador malo: más bamboleo en el aire.', previewOptions: { brand: 'malta', bent: .8 } },
  { id: 'chapita-cap-oro', name: 'Chapita de oro', factory: 'createChapita', description: 'Premio de torneo: chapa dorada metálica.', previewOptions: { brand: 'oro' } },
  { id: 'chapita-palo', name: 'Palo de escoba', factory: 'createPalo', description: 'El bate por defecto, 1,25 m. Origen en el mango, el palo hacia +Y. kind: escoba, coleto, tricolor, teipe, dorado.', previewOptions: { kind: 'escoba' } },
  { id: 'chapita-palo-teipe', name: 'Palo con teipe', factory: 'createPalo', description: 'Palo de escoba con el mango forrado en teipe negro.', previewOptions: { kind: 'teipe' } },
  { id: 'chapita-palo-tricolor', name: 'Palo tricolor', factory: 'createPalo', description: 'Palo pintado amarillo, azul y rojo.', previewOptions: { kind: 'tricolor' } },
  { id: 'chapita-palo-dorado', name: 'Palo dorado', factory: 'createPalo', description: 'Premio del torneo del barrio, con mango de cinta clara.', previewOptions: { kind: 'dorado' } },
  { id: 'chapita-ventana', name: 'La ventana de la señora', factory: 'createSenoraWindow', description: 'Ventana con rejas, postigos verdes abiertos y matero en un parche de friso de 2,4 m. La apertura está a 1,35–2,55 m.' },
  { id: 'chapita-calle', name: 'Calle del barrio (piso)', factory: 'createStreetGround', description: 'La T de la calle: calle angosta con aceras, la acera donde empieza la calle transversal (z −12,5), la transversal y la acera de las casas (z −26). Plato de tiza en el origen.' },
  { id: 'chapita-cancha', name: 'Cancha del bloque (piso)', factory: 'createBlockCourt', description: 'Cancha azul con rayas blancas y la raya amarilla de la acera, con las mismas zonas que la calle.' },
  { id: 'chapita-cerca', name: 'Cerca de ciclón', factory: 'createChainFence', description: 'Malla de ciclón de 3 m con postes y pancartas de patrocinantes inventados. Corre a lo largo de +X.', previewOptions: { length: 9, banners: 3 } },
  { id: 'chapita-gradas', name: 'Gradas', factory: 'createBleachers', description: 'Tres escalones de tablones sobre hierro, 6 m; userData.seats son los puestos del público.' },
  { id: 'chapita-superbloque', name: 'Superbloque', factory: 'createSuperbloque', description: 'Torre de vivienda rojo y blanco con franjas por piso, balcones y ventanas encendidas. 3 m por piso.', previewOptions: { floors: 8, width: 16 } },
  { id: 'chapita-tuyuyo', name: 'Tuyuyo', factory: 'createTuyuyo', description: 'El chichón rosado que sale después de un chapazo en la cara.' },
  { id: 'chapita-palo-partido', name: 'Palo partido', factory: 'createPaloPartido', description: 'El palo de escoba partido en dos a 0,7 m del mango: userData.low se queda en la mano, userData.top sale volando. kind como el palo.', previewOptions: { kind: 'escoba' } },
  { id: 'chapita-pelota', name: 'Pelota', factory: 'createPelota', description: 'Pelota de béisbol con costuras rojas, para el equipo Pelota y bate.' },
  { id: 'chapita-bate', name: 'Bate de madera', factory: 'createBate', description: 'Bate de madera del largo de un palo de escoba (1,25 m). Origen en el mango, hacia +Y.' },
  { id: 'chapita-perro', name: 'Perro callejero', factory: 'createPerro', description: 'Perro caramelo a la altura de la rodilla. userData.pose(fase, corriendo, cola) mueve patas y cola; userData.mouth es donde lleva la chapita.' },
  { id: 'chapita-alcantarilla', name: 'Alcantarilla', factory: 'createAlcantarilla', description: 'Rejilla de 0,55 × 0,85 m a ras de la calle. La chapita se pierde ahí.' },
  { id: 'chapita-periodico', name: 'Periódico El Barrio', factory: 'createPeriodico', description: 'El periódico abierto del abuelo, 0,8 × 0,56 m, mirando hacia +Z.' },
  { id: 'chapita-bola-de-paja', name: 'Bola de paja', factory: 'createBolaDePaja', description: 'Ramitas secas que ruedan cuando la calle se queda sola.' },
].map(def => object({ ...def, source, category: 'Objetos', usedBy: ['Chapita'], dependencies: ['/engine/models/props/game-table.js'] }));

// The jugadas locas: each page loops one jugada with the live game's own motion code.
const JUGADA_PAGES = [['hit', 'Lanzar y batear', 'Contacto: destello, estrellas y ¡PRAAA!'], ['swing', 'Solo batear', 'El rastro blanco del palo en cada swing.'],
  ['miss', 'Swing fallido', 'Ponche abanicando: da la vuelta y cae sentado, mareado.'], ['helicopter', 'Helicóptero', 'Ponche abanicando: el swing lo levanta del piso.'],
  ['pitch', 'Solo lanzar', 'Strike mirando: ¡STRIKE!'], ['argue', 'Discusión', 'Strike mirando: ¡STRIKE! ¡BOLA! ¡QUE FUE BOLA!'],
  ['slip', 'Palo zafado', 'Strike abanicando: el palo se le zafa y el pitcher se agacha.'], ['boomerang', 'Bumerán', 'Bola con chapita doblada: la chapita vuelve a la mano del pitcher.'],
  ['bean', 'Chapazo', 'Chapazo al bateador (camina a primera) o a un fildeador: ¡TOING! y tuyuyo.'], ['window', 'La ventana', 'Batazo a la ventana de la señora: ¡CRASH!, ¡MUCHACHOS!, ¡CORRAN!'],
  ['catch', 'Atrapada', 'Atrapada en el aire, de lado: ¡OUT!'], ['broken', 'Palo partido', 'Contacto flojo: el palo se parte en dos.'],
  ['home', 'Jonrón', 'Jonrón: bat flip, confeti y el pitcher con las manos en la cabeza.'], ['dog', 'El perro', 'Sencillo rodado: un perro se lleva la chapita.'],
  ['roof', "Pa'l techo", 'A la azotea o contra la pared: la chapita rueda del techo a la cabeza de un pana.'], ['drain', 'Alcantarilla', 'Rodado corto o foul por el piso: se va por la alcantarilla. ¡Tengo otra!'],
  ['pinball', 'Pinball', 'Triple al poste: rebota en la pared, el carro y la cabeza del pitcher. ¡JACKPOT!'], ['grandpa', 'El abuelo', 'Foul: el abuelo la atrapa sin dejar de leer y se la devuelve al pitcher.'],
  ['car', '¡Carro!', 'Regla de la casa: todos a la acera, pasa el carro, sigue el juego.'], ['dinner', '¡A comer!', 'Cambio de bando: la señora llama a comer y el bateador se va corriendo.'],
  ['dance', 'Celebración', 'Fin de la caimanera: el equipo ganador baila.']];
for (const [jugada, name, what] of JUGADA_PAGES) CHAPITA.push(object({ id: `chapita-jugada-${jugada}`, name: `Chapita · ${name}`, category: 'Objetos', usedBy: ['Chapita'],
  description: `${what} Jugada de la partida; enciende Animación para verla en bucle.`, source: '/g/chapita/studio-preview.js', factory: 'createChapitaJugadaPreview', previewOptions: { jugada },
  dependencies: ['/g/chapita/studio-set.js', '/g/chapita/jugada-motion.js', '/g/chapita/jugada-fx.js', '/g/chapita/jugadas.js', '/engine/models/vehicles/cars.js', '/engine/models/props/game-table.js'] }));
