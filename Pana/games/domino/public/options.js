import { normalizeRoomOptions } from '../../../engine/room-options-rules.js';
import { STARTER_FIELD } from '../../../engine/play/quien-empieza-rules.js';
import { loc } from '../../../engine/i18n.js';
const field=(id,label,choices,value=choices[0][0],advanced=false)=>({id,label,choices,default:value,advanced});
export const FIELDS=[
 field('mode',loc('Modo'),[['teams',loc('Equipos')],['individual',loc('Individual')]]),
 field('seats',loc('Puestos'),[[4,'4'],[6,'6']],4,true),
 field('target',loc('Meta'),[[100,'100'],[200,'200']]),
 field('turnSeconds',loc('Tiempo por turno'),[[15,'15 s'],[30,'30 s'],[0,loc('Sin límite')]],0),
 field('opener',loc('Salida'),[['double6',loc('Doble seis')],['winner',loc('Ganador anterior')],['random',loc('Al azar')]],'winner',true),
 // Who opens the first mano: Salida's own rule, or ¿Quién empieza? (the cachos and friends).
 {...STARTER_FIELD,default:'regla',choices:[['regla',loc('Según la salida')],...STARTER_FIELD.choices]},
 field('passScore',loc('Pase'),[[true,loc('Se anota (+10)')],[false,loc('No se anota')]],false,true),
 field('blocked',loc('Tranque'),[['lower',loc('Gana menos puntos')],['redeal',loc('Se reparte')]],'lower',true),
 field('capicua',loc('Capicúa'),[['25',loc('Vale 25')],['double',loc('Vale doble')],['normal',loc('Normal')]],'normal',true),
 field('handSize',loc('Fichas por jugador'),[[7,'7'],[10,'10']],7,true),
 field('quickChat',loc('Chat rápido'),[[true,loc('Sí')],[false,loc('No')]],true,true),
];
export const cleanOptions=raw=>normalizeRoomOptions(FIELDS,raw);
export const maxPip=options=>options.seats*options.handSize<=28?6:options.seats*options.handSize<=55?9:12;
export const groupOf=(state,seat)=>state?.options?.mode==='individual'?seat:seat%2;
// Sent by index; each client shows the phrase in its own language.
export const CHAT=[loc('¡Buena esa!'),loc('¡Vamos, pana!'),loc('Voy pensando…')];
