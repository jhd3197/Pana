import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight, wetness } from './salto-layout.js';
import { saltoWorld } from './salto-world.js';
import { edges } from './world-kit.js';
import { festive } from './festive.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='salto'),points:ROUTE,rounded:true,hw:11,lineU:.025,elevation:roadHeight,
  gripAt:(x,z)=>1-.3*wetness(x,z),walls:false,chevrons:true,
  previewBounds:[[-500,0,-460],[500,190,440]],
  sectors:[[0,'Campamento del río'],[.12,'Cornisa del tepuy'],[.26,'Bajada del cañón'],[.42,'Puente del salto'],[.58,'Galería del agua'],[.78,'Subida del bosque']],
  items:{boxes:[.08,.23,.39,.54,.7,.86],boxLanes:[-7,-2,2,7],pads:[{u:.1,off:0},{u:.47,off:-4},{u:.85,off:4}]},
  palette:{skySeed:56,cloudCover:.38,horizon:0xc4f0e8,skyTop:0x1a8de8,halo:1.1,hemiSky:0xd2e6ff,hemiGround:0x5ea25a,hemiInt:1.6,sun:0xffd598,sunInt:2.5,ground:0x5fae5a,track:0xd8b884,dune:0,fog:[460,1900]},
  environment:saltoWorld,
  scenery(g,k,T){
    edges(g,k,T,{style:'rope',step:7});
    // Tepuy country: heliconia-red beds, macaws and morphos, and a ring of
    // sheer table mountains on the horizon.
    festive(g,T,{seed:56,maxDrop:3,stands:420,banners:520,bunting:260,balloons:260,flags:320,butterflies:60,
      colors:[0xff4f6d,0xffc93c,0x3ec1ff,0x52d273,0xff8a3d],
      trees:[['bucare',14,[1,20]],['apamate',12,[1,20]],['araguaney',10,[1,20]]],
      plants:[['heliconia',40],['bromeliad',40,[0,6]],['mossRock',30,[0,12]]],
      birds:[{kind:'macaw',flocks:3,size:5}],
      vista:{shape:'mesa',radius:1150,hills:18,height:[200,380],colors:[0xa8583f,0x9a4e45,0xb8683f],top:0x3fa84a,balloons:2}});
  },
};
