// Pure metadata shared by the runtime, room validation and Studio.
import { loc } from '../../../../engine/i18n.js';
export const WATER_TRACKS = [
  { id: 'salto', name: 'Salto del Tepuy', blurb: loc('De la cornisa al cañón: baja junto al gran salto, cruza el río y pasa detrás de la cortina de agua.') }, // i18n-ignore: track names stay Spanish
  { id: 'delta', kitPieces: ['car','boat'], name: 'Delta de los Caños', blurb: loc('Palafitos, mangles y curiaras: enlaza los puentes del pueblo, cruza la laguna en lancha y vuelve por la ribera.') }, // i18n-ignore: track names stay Spanish
  { id: 'cuevas', name: 'Cuevas del Río', blurb: loc('Sigue el río bajo la montaña, cruza las salas de luz y sal al valle entre raíces.') }, // i18n-ignore: track names stay Spanish
  { id: 'salinas', name: 'Salinas del Viento', blurb: loc('Lagunas rosadas y sal blanca: elige tu línea en el cruce de agua y entra a la mina de sal, entre cristales que brillan.') }, // i18n-ignore: track names stay Spanish
];
