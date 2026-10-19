import { TRACK_DEFINITIONS } from '../track-definitions.js';
// Hato, pastures and connected esteros: a broad countryside race with two river bridges.
import {ROUTE,roadHeight} from './llanos-layout.js';
import {llanosEnvironment,llanosScenery} from './llanos-world.js';
export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'llanos'),
  points:ROUTE,rounded:true,hw:9,lineU:.013,elevation:roadHeight,
  previewBounds:[[-420,-2,-380],[425,45,300]],
  sectors:[[0,'Hacienda Pana'],[.17,'Puente del estero'],[.32,'Curvas del morichal'],[.5,'Potrero del levante'],[.65,'Paso del caño'],[.81,'Arepera del camino']],
  shortcuts:[{from:[.8119,6.5],to:[.9074,6.5]}],
  hazards:[{kind:'cow',u:.55},{kind:'cow',u:.7,phase:7}],
  items:{boxes:[.1,.25,.4,.56,.73,.9],boxLanes:[-6,-2,2,6],pads:[{u:.13,off:0},{u:.35,off:-3},{u:.6,off:3},{u:.94,off:0}]},
  walls:false,chevrons:true,
  palette:{skySeed:19,cloudCover:0.36,horizon:0xcbf1e6,skyTop:0x1689ec,halo:1,hemiSky:0xd3e6ff,hemiGround:0x79ad45,hemiInt:1.5,sun:0xffd593,sunInt:2.5,ground:0x86c24a,track:0xdcab6c,dune:0,fog:[480,1900]},
  environment:llanosEnvironment,scenery:llanosScenery,
};
