// Lightweight metadata. Constructors stay in tracks/<id>.js.
import { loc } from '../../../engine/i18n.js';
import { WATER_TRACKS } from './tracks/water-track-definitions.js';
export const TRACK_DEFINITIONS = [
  { id:'estadio',name:'El Estadio', // i18n-ignore: track names stay Spanish
  blurb:loc('Un gran premio técnico: frenadas, chicanas, horquillas y la recta de las tribunas.'), },
  { id:'desierto',name:'Pana Desierto', // i18n-ignore: track names stay Spanish
  blurb:loc('De Pana Gas a las dunas: sube al cañón de los dos arcos y baja hasta el pozo del oasis.'), },
  { id:'llanos',name:'Los Llanos', // i18n-ignore: track names stay Spanish
  blurb:loc('Corre entre hatos y potreros, cruza los puentes del estero y vuelve por el morichal y la arepera.'), },
  { id:'chichi',name:'Chi Chi', // i18n-ignore: track names stay Spanish
  blurb:loc('De las termas entre nubes al pueblo de buceo: curvas de montaña, bosque húmedo, playa y una larga subida junto al río.'), },
  { id:'selva',name:'Pana Selva', // i18n-ignore: track names stay Spanish
  blurb:loc('Sube por la cueva del jaguar hasta la meseta de las flores, baja por la cornisa, cruza el vado y el río de los mangles entre ceibas y ruinas.'), },
  { id:'paramo',name:'Pana Páramo', // i18n-ignore: track names stay Spanish
  blurb:loc('Sube entre frailejones, enlaza las horquillas de la laguna y corona el teleférico.'), },
  { id: 'plaza', name: 'Plaza Pana', // i18n-ignore: track names stay Spanish
  blurb: loc('Del casco histórico a Casas Botes: cruza el gran puente del lago y vuelve por el mirador.'), },
  { id:'bululu',name:'Isla Bululú', // i18n-ignore: track names stay Spanish
  blurb:loc('Los Roques entre cayos y lagunas: la marea invade los bordes de la lengua de arena. Busca el centro seco.'), },
  ...WATER_TRACKS,
  { id:'puerto',name:'Puerto',defaultLaps:1, // i18n-ignore: track names stay Spanish
  blurb:loc('Una vuelta de aventura: tres grúas, calles del puerto, subida de barro, baluartes de San Carlos, salto y túnel bajo el agua.') },
  {id:'cata', name:'Bahía de Cata', blurb:loc('Baja entre montañas, cruza el cocotal y corre por el banco de arena hasta la isla.')}, // i18n-ignore: track names stay Spanish
  {id:'choroni', name:'Choroní', blurb:loc('Curvas de montaña, bosque nublado, Puerto Colombia y Playa Grande.'), // i18n-ignore: track names stay Spanish
    // the river spills over the east-bank road: cars run it as lanchas (transform-gates.js)
    transformGates:[{from:.905,to:.975}]},
  {id:'chuao', kitPieces:['car','boat'], name:'Chuao · La quebrada', blurb:loc('Del cacaotal al pueblo: sube al salto y baja con tu carro por la quebrada.')}, // i18n-ignore: track names stay Spanish
  {id:'tovar', name:'Colonia Tovar', blurb:loc('Sube entre hortensias y pinos, métete en la neblina y cruza el pueblo alemán y el mercado de fresas.')}, // i18n-ignore: track names stay Spanish
  {id:'galipan', kitPieces:['car','air'], name:'Galipán de noche', blurb:loc('Sube de noche por la montaña entre chalets iluminados y asómate al mirador con Caracas brillando abajo.')}, // i18n-ignore: track names stay Spanish
  {id:'maracaibo', name:'Maracaibo · El puente', blurb:loc('Cruza el puente sobre el lago, pasa los palafitos, el casco de colores y La Chinita bajo los relámpagos del Catatumbo.')}, // i18n-ignore: track names stay Spanish
  {id:'margarita', kitPieces:['car','boat'], name:'Isla Margarita', blurb:loc('Del castillo de Pampatar a Playa El Agua, por los manglares de La Restinga hasta Juan Griego.')}, // i18n-ignore: track names stay Spanish
  {id:'sarisarinama', name:'Sarisariñama', blurb:loc('Baja en espiral por la sima del tepuy, cruza las cuevas por debajo y sube a la luz por la otra.')}, // i18n-ignore: track names stay Spanish
  {id:'sabana', name:'Gran Sabana', blurb:loc('Corre por la sabana con los tepuyes al fondo, pasa la Quebrada de Jaspe y el Salto Kama antes del aguacero.')}, // i18n-ignore: track names stay Spanish
  {id:'cosmos', name:'Cosmos', defaultLaps:1, blurb:loc('De la base lunar a los anillos de Araguaney y el túnel del cosmos.')}, // i18n-ignore: track names stay Spanish
  {id:'merida', kitPieces:['car','boat'], name:'Mérida', blurb:loc('Del pueblo andino al teleférico: curvas de montaña y una travesía por la laguna.')}, // i18n-ignore: track names stay Spanish
  {id:'arrecife', name:'Arrecife', blurb:loc('Corre bajo el mar entre corales, un galeón y las luces de la fosa.')}, // i18n-ignore: track names stay Spanish
  {id:'volcan', name:'Volcán', defaultLaps:1, blurb:loc('Sube al cráter entre ceniza, puentes de basalto y ríos de lava.')}, // i18n-ignore: track names stay Spanish
  {id:'nubes', name:'Nubes', blurb:loc('Salta de isla en isla por puentes colgantes y una carretera de arcoíris.')}, // i18n-ignore: track names stay Spanish
  {id:'dulce', name:'Dulce', blurb:loc('Una vuelta entre quesillo, chocolate, caramelos y montañas de merengue.')}, // i18n-ignore: track names stay Spanish
];
