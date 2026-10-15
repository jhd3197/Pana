// Hato, pastures and connected esteros: a broad countryside race with two river bridges.
import {ROUTE,roadHeight} from './llanos-layout.js';
import {llanosEnvironment,llanosScenery} from './llanos-world.js';
export default {
  id:'llanos',name:'Los Llanos',
  blurb:'Corre entre hatos y potreros, cruza los puentes del estero y vuelve por el morichal y la arepera.',
  points:ROUTE,rounded:true,hw:9,lineU:.013,elevation:roadHeight,
  previewBounds:[[-420,-2,-380],[425,45,300]],
  sectors:[[0,'Hacienda Pana'],[.17,'Puente del estero'],[.32,'Curvas del morichal'],[.5,'Potrero del levante'],[.65,'Paso del caño'],[.81,'Arepera del camino']],
  items:{boxes:[.1,.25,.4,.56,.73,.9],boxLanes:[-6,-2,2,6],pads:[{u:.13,off:0},{u:.35,off:-3},{u:.6,off:3},{u:.94,off:0}]},
  walls:false,chevrons:true,
  palette:{skySeed:19,cloudCover:0.56,horizon:0xe8dfb9,skyTop:0x9ac9d7,hemiSky:0xfff2d6,hemiGround:0x90945b,hemiInt:1.65,sun:0xffdba3,sunInt:2.3,ground:0xb6ad68,track:0xa5926c,dune:0,fog:[450,1500]},
  environment:llanosEnvironment,scenery:llanosScenery,
};
