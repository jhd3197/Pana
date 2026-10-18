// Lightweight metadata. Constructors stay in tracks/<id>.js.
import { WATER_TRACKS } from './tracks/water-track-definitions.js';
export const TRACK_DEFINITIONS = [
  { id:'estadio',name:'El Estadio',
  blurb:'Un gran premio técnico: frenadas, chicanas, horquillas y la recta de las tribunas.', },
  { id:'desierto',name:'Pana Desierto',
  blurb:'De Pana Gas a las dunas: sube al cañón de los dos arcos y baja hasta el pozo del oasis.', },
  { id:'llanos',name:'Los Llanos',
  blurb:'Corre entre hatos y potreros, cruza los puentes del estero y vuelve por el morichal y la arepera.', },
  { id:'chichi',name:'Chi Chi',
  blurb:'De las termas entre nubes al pueblo de buceo: curvas de montaña, bosque húmedo, playa y una larga subida junto al río.', },
  { id:'selva',name:'Pana Selva',
  blurb:'Sube por la cueva del jaguar hasta la meseta de las flores, baja por la cornisa, cruza el vado y el río de los mangles entre ceibas y ruinas.', },
  { id:'paramo',name:'Pana Páramo',
  blurb:'Sube entre frailejones, enlaza las horquillas de la laguna y corona el teleférico.', },
  { id: 'plaza', name: 'Plaza Pana',
  blurb: 'Del casco histórico a Casas Botes: cruza el gran puente del lago y vuelve por el mirador.', },
  { id:'bululu',name:'Isla Bululú',
  blurb:'Los Roques entre cayos y lagunas: la marea invade los bordes de la lengua de arena. Busca el centro seco.', },
  ...WATER_TRACKS,
  { id:'puerto',name:'Puerto',defaultLaps:1,
  blurb:'Una vuelta de aventura: tres grúas, calles del puerto, subida de barro, baluartes de San Carlos, salto y túnel bajo el agua.' },
];
