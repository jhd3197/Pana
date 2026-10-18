import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight } from './cuevas-layout.js';
import { cuevasWorld } from './cuevas-world.js';
import { vergePosts } from './country-details.js';
import { festive } from './festive.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='cuevas'),points:ROUTE,rounded:true,hw:11,lineU:.025,elevation:roadHeight,walls:false,chevrons:true,
  previewBounds:[[-500,0,-390],[470,155,430]],
  sectors:[[0,'Bosque de entrada'],[.1,'Boca del río'],[.28,'Sala de luz'],[.4,'Cornisa mineral'],[.52,'Puente de la poza'],[.62,'Salida de raíces'],[.8,'Vuelta del valle']],
  items:{boxes:[.08,.23,.37,.52,.68,.85],boxLanes:[-7,-2,2,7],pads:[{u:.08,off:0},{u:.38,off:4},{u:.7,off:-4}]},
  palette:{skySeed:58,cloudCover:.3,horizon:0xc4f0e6,skyTop:0x1d8ee6,halo:1,hemiSky:0xd4e4ff,hemiGround:0x6aa660,hemiInt:1.5,sun:0xffd598,sunInt:2.5,ground:0x6fb45a,track:0xc9a882,dune:0,fog:[480,1800]},
  environment:cuevasWorld,
  scenery(g,k,T){
    g.add(vergePosts(T,{color:0xd4c89e,step:14}));
    // The open valley blooms; under the mountain the terrain check keeps it clear.
    festive(g,T,{seed:58,maxDrop:2.5,stands:400,banners:520,bunting:260,balloons:240,flags:300,butterflies:60,
      trees:[['apamate',16,[1,20]],['araguaney',12,[1,20]],['bucare',8,[1,20]]],
      plants:[['heliconia',30],['bromeliad',40,[0,6]],['mossRock',40,[0,12]]],
      birds:[{kind:'macaw',flocks:2,size:5}],
      vista:{shape:'peak',hills:22,height:[200,360],colors:[0x5fa585,0x6fae7a,0x7aa0b8],balloons:3}});
  },
};
