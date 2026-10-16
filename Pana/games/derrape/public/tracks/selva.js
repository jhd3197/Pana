import { TRACK_DEFINITIONS } from '../track-definitions.js';
// Pana Selva: a river valley with a ruined temple passage under the jungle.
import { jungleHeight } from './selva-layout.js';
import { createJungle, jungleScenery } from './selva-world.js';

export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'selva'),
  points:[[-76,28],[-40,60],[15,65],[65,30],[85,-30],[145,-45],[185,0],[230,-15],[270,-80],[240,-145],
    [175,-155],[120,-115],[70,-145],[25,-210],[-45,-225],[-115,-180],[-120,-105],[-85,-65],[-110,-15]],
  rounded:true,hw:9,lineU:0.06,elevation:jungleHeight,
  previewBounds:[[-225,0,-300],[370,85,130]],
  sectors:[[0,'Río turquesa'],[0.25,'Sendero de los tucanes'],[0.43,'Túnel del jaguar'],[0.6,'Bosque de ceibas'],[0.78,'La cascada']],
  ramps:[{u:0.30,len:9,h:1.8,hw:4.2},{u:0.82,len:9,h:2.2,hw:4.2}],
  items:{boxes:[0.12,0.31,0.51,0.72,0.91],boxLanes:[-6,-2,2,6],pads:[{u:0.26,off:0},{u:0.72,off:-4}]},
  walls:false,fence:false,
  offroad:{fullAt:4.5,speed:0.36,accel:0.48,drag:0.75},
  palette:{skySeed:61,cloudCover:0.43,horizon:0xa8dcd5,skyTop:0x2b9fbe,hemiSky:0xe1f4ff,hemiGround:0x2c6545,hemiInt:1.55,
    sun:0xfff0ce,sunInt:2.3,ground:0x3b8843,track:0xc09d62,dune:0,fog:[150,550]},
  environment:createJungle,scenery:jungleScenery,
};
