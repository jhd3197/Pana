import { object } from './objects.js';
export const LUDO = [
  {id:'ludo-board',name:'Tablero de Ludo',factory:'createLudoBoard',description:'Tablero de madera, cuatro patios y casillas seguras. Superficie a 0,12 m; lado de 5,65 m.'},
  {id:'ludo-pawn',name:'Ficha de Ludo',factory:'createLudoPawn',description:'Ficha numerada con halo de selección. Origen en la base; altura de 0,42 m.'},
  {id:'ludo-die',name:'Dado de Ludo',factory:'createLudoDie',description:'Dado con seis caras y puntos. Origen en la base; lado de 0,43 m.'},
].map(def=>object({...def,source:'/g/ludo/board-model.js',category:'Objetos',usedBy:['Ludo'],dependencies:['/g/ludo/rules.js','/g/ludo/studio-finish.js','/engine/models/props/game-table.js']}));

for(const [style,name] of [['highfive','Chócala'],['slip','Resbalón'],['rollbarrel','Rodar'],['moonwalk','Moonwalk'],['spring','Resorte'],['dodge','Esquivar'],['piggy','Caballito'],['umbrella','Paraguas'],['tunnel','Túnel'],['gum','Chicle']]) {
  LUDO.push(object({id:`ludo-${style}`,name:`Ludo · ${name}`,category:'Objetos',usedBy:['Ludo'],
    description:'Animación del camino usada en la partida. El movimiento es decorativo: respeta las casillas del dado.',
    source:'/g/ludo/studio-preview.js',factory:'createLudoMotionPreview',previewOptions:{style},
    dependencies:['/g/ludo/board-model.js','/g/ludo/rules.js','/g/ludo/studio-finish.js','/g/ludo/camino-motion.js','/g/ludo/motion-props.js','/g/ludo/motion-choice.js','/engine/models/props/game-table.js']}));
}

for(const [kind,name] of [['intro','Inicio de partida'],['turn','Tu turno'],['suspense','Dado en suspenso'],['safe','Casilla segura'],['block','Bloqueo'],['leap','Salto de rana'],['sprint','Recta final'],['nearmiss','¡Casi!'],['nomoves','Sin movimientos'],['sleep','A dormir'],['podium','Podio']]) {
  LUDO.push(object({id:`ludo-${kind}`,name:`Ludo · ${name}`,category:'Objetos',usedBy:['Ludo'],
    description:kind==='block'?'Reacción decorativa de fichas juntas. No bloquea las jugadas.':'Momento del estudio conectado a los eventos de la partida.',
    source:'/g/ludo/studio-preview.js',factory:'createLudoMomentPreview',previewOptions:{kind},
    dependencies:['/g/ludo/board-model.js','/g/ludo/rules.js','/g/ludo/moment-visual.js','/g/ludo/moment-events.js','/g/ludo/studio-finish.js','/g/ludo/camino-motion.js','/g/ludo/motion-props.js','/engine/models/props/game-table.js']}));
}
