import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight } from './cuevas-layout.js';
import { cuevasWorld } from './cuevas-world.js';
import { vergePosts } from './country-details.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='cuevas'),points:ROUTE,rounded:true,hw:11,lineU:.025,elevation:roadHeight,walls:false,chevrons:true,
  previewBounds:[[-500,0,-390],[470,155,430]],
  sectors:[[0,'Bosque de entrada'],[.1,'Boca del río'],[.28,'Sala de luz'],[.4,'Cornisa mineral'],[.52,'Puente de la poza'],[.62,'Salida de raíces'],[.8,'Vuelta del valle']],
  items:{boxes:[.08,.23,.37,.52,.68,.85],boxLanes:[-7,-2,2,7],pads:[{u:.08,off:0},{u:.38,off:4},{u:.7,off:-4}]},
  palette:{skySeed:58,cloudCover:.25,horizon:0xcadfd8,skyTop:0x689eae,hemiSky:0xd5e2df,hemiGround:0x6b7870,hemiInt:1.35,sun:0xffe6c3,sunInt:2.2,ground:0x7e9a62,track:0xbcb8a8,dune:0,fog:[450,1500]},
  environment:cuevasWorld,scenery:(g,k,T)=>g.add(vergePosts(T,{color:0xd4c89e,step:14})),
};
