import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
const field=(id,label,choices,value=choices[0][0],advanced=false)=>({id,label,choices,default:value,advanced});
export const FIELDS=[
 field('mode','Modo',[['teams','Equipos'],['individual','Individual']]),
 field('seats','Puestos',[[4,'4'],[6,'6']],4,true),
 field('target','Meta',[[100,'100'],[200,'200']]),
 field('turnSeconds','Tiempo por turno',[[15,'15 s'],[30,'30 s'],[0,'Sin límite']],0),
 field('opener','Salida',[['double6','Doble seis'],['winner','Ganador anterior'],['random','Al azar']],'winner',true),
 // Who opens the first mano: Salida's own rule, or ¿Quién empieza? (the cachos and friends).
 {...STARTER_FIELD,default:'regla',choices:[['regla','Según la salida'],...STARTER_FIELD.choices]},
 field('passScore','Pase',[[true,'Se anota (+10)'],[false,'No se anota']],false,true),
 field('blocked','Tranque',[['lower','Gana menos puntos'],['redeal','Se reparte']],'lower',true),
 field('capicua','Capicúa',[['25','Vale 25'],['double','Vale doble'],['normal','Normal']],'normal',true),
 field('handSize','Fichas por jugador',[[7,'7'],[10,'10']],7,true),
 field('quickChat','Chat rápido',[[true,'Sí'],[false,'No']],true,true),
];
export const cleanOptions=raw=>normalizeRoomOptions(FIELDS,raw);
export const maxPip=options=>options.seats*options.handSize<=28?6:options.seats*options.handSize<=55?9:12;
export const groupOf=(state,seat)=>state?.options?.mode==='individual'?seat:seat%2;
export const CHAT=['¡Buena esa!','¡Vamos, pana!','Voy pensando…'];
