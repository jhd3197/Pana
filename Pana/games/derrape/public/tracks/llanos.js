import { TRACK_DEFINITIONS } from '../track-definitions.js';
// Hato, pastures and connected esteros: a broad countryside race with two river bridges.
import {ROUTE,roadHeight} from './llanos-layout.js';
import {llanosEnvironment,llanosScenery} from './llanos-world.js';
export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'llanos'),
  points:ROUTE,rounded:true,hw:9,lineU:.013,elevation:roadHeight,
  previewBounds:[[-420,-2,-380],[425,45,300]],
  sectors:[[0,'Hacienda Pana'],[.17,'Puente del estero'],[.32,'Curvas del morichal'],[.5,'Potrero del levante'],[.65,'Paso del caño'],[.81,'Arepera del camino']],
  items:{boxes:[.1,.25,.4,.56,.73,.9],boxLanes:[-6,-2,2,6],pads:[{u:.13,off:0},{u:.35,off:-3},{u:.6,off:3},{u:.94,off:0}]},
  walls:false,chevrons:true,
  palette:{skySeed:19,cloudCover:0.34,horizon:0xb4e0ed,skyTop:0x238bce,hemiSky:0xe4f5ff,hemiGround:0x588343,hemiInt:1.5,sun:0xfff1d5,sunInt:2.3,ground:0x76a444,track:0xbfa06a,dune:0,fog:[450,1500]},
  environment:llanosEnvironment,scenery:llanosScenery,
};
