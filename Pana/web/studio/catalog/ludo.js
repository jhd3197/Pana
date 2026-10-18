import { object } from './objects.js';
export const LUDO = [
  {id:'ludo-board',name:'Tablero de Ludo',factory:'createLudoBoard',description:'Tablero de madera, cuatro patios y casillas seguras. Superficie a 0,12 m; lado de 5,65 m.'},
  {id:'ludo-pawn',name:'Ficha de Ludo',factory:'createLudoPawn',description:'Ficha numerada con halo de selección. Origen en la base; altura de 0,42 m.'},
  {id:'ludo-die',name:'Dado de Ludo',factory:'createLudoDie',description:'Dado con seis caras y puntos. Origen en la base; lado de 0,43 m.'},
].map(def=>object({...def,source:'/g/ludo/board-model.js',category:'Objetos',usedBy:['Ludo'],dependencies:['/g/ludo/rules.js','/engine/models/props/game-table.js']}));
