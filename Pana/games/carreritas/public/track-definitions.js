// Lightweight metadata. Constructors stay in tracks/<id>.js.
// The four public circuits: one Copa Pana. Every other circuit comes from
// premium-tracks.js, an empty hook here that the pana.sh overlay fills.
import { loc } from '../../../engine/i18n.js';
import { WATER_TRACKS } from './tracks/water-track-definitions.js';
import { PREMIUM_TRACKS } from './premium-tracks.js';
export const TRACK_DEFINITIONS = [
  { id:'estadio',name:'El Estadio', // i18n-ignore: track names stay Spanish
  blurb:loc('Un gran premio técnico: frenadas, chicanas, horquillas y la recta de las tribunas.'), },
  { id:'llanos',name:'Los Llanos', // i18n-ignore: track names stay Spanish
  blurb:loc('Corre entre hatos y potreros, cruza los puentes del estero y vuelve por el morichal y la arepera.'), },
  ...WATER_TRACKS,
  {id:'galipan', kitPieces:['car','air'], name:'Galipán de noche', blurb:loc('Sube de noche por la montaña entre chalets iluminados y asómate al mirador con Caracas brillando abajo.')}, // i18n-ignore: track names stay Spanish
  ...PREMIUM_TRACKS,
];
