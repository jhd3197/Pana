import { TRACK_DEFINITIONS } from '../track-definitions.js';
// Pana Selva: a river valley with a ruined temple passage under the jungle.
import { jungleHeight, ROUTE, legacyU as L } from './selva-layout.js';
import { createJungle, jungleScenery } from './selva-world.js';

export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'selva'),
  points:ROUTE,
  rounded:true,hw:9,lineU:0.02,elevation:jungleHeight,
  previewBounds:[[-225,0,-300],[480,110,570]],
  sectors:[[0,'Río turquesa'],[0.03,'Cueva del jaguar'],[0.165,'Meseta de las flores'],[0.33,'Cornisa de los caballetes'],[0.49,'Vado de la cascada'],
    [L(0.25),'Sendero de los tucanes'],[L(0.43),'Paso del templo'],[L(0.6),'Bosque de ceibas'],[L(0.78),'La cascada']],
  ramps:[{u:L(0.30),len:9,h:1.8,hw:4.2},{u:L(0.82),len:9,h:2.2,hw:4.2}],
  rain:0.7,
  items:{boxes:[0.06,0.13,0.21,0.28,0.4,0.54,L(0.31),L(0.51),L(0.72),L(0.91)],boxLanes:[-6,-2,2,6],pads:[{u:0.22,off:0},{u:0.5,off:3},{u:L(0.26),off:0},{u:L(0.72),off:-4}]},
  walls:false,fence:false,
  offroad:{fullAt:4.5,speed:0.36,accel:0.48,drag:0.75},
  palette:{skySeed:61,cloudCover:0.43,horizon:0xa8dcd5,skyTop:0x2b9fbe,hemiSky:0xe1f4ff,hemiGround:0x2c6545,hemiInt:1.55,
    sun:0xfff0ce,sunInt:2.3,ground:0x3b8843,track:0xc09d62,dune:0,fog:[150,550]},
  environment:createJungle,scenery:jungleScenery,
};
