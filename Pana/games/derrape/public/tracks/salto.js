import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight, wetness } from './salto-layout.js';
import { saltoWorld } from './salto-world.js';
import { edges } from './world-kit.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='salto'),points:ROUTE,rounded:true,hw:11,lineU:.025,elevation:roadHeight,
  gripAt:(x,z)=>1-.3*wetness(x,z),walls:false,chevrons:true,
  previewBounds:[[-500,0,-460],[500,190,440]],
  sectors:[[0,'Campamento del río'],[.12,'Cornisa del tepuy'],[.26,'Bajada del cañón'],[.42,'Puente del salto'],[.58,'Galería del agua'],[.78,'Subida del bosque']],
  items:{boxes:[.08,.23,.39,.54,.7,.86],boxLanes:[-7,-2,2,7],pads:[{u:.1,off:0},{u:.47,off:-4},{u:.85,off:4}]},
  palette:{skySeed:56,cloudCover:.38,horizon:0xc2dfe1,skyTop:0x4e97bd,hemiSky:0xe3f0ef,hemiGround:0x6d8264,hemiInt:1.5,sun:0xffe5c5,sunInt:2.1,ground:0x66835c,track:0xb6b1a2,dune:0,fog:[420,1500]},
  environment:saltoWorld,scenery:(g,k,T)=>edges(g,k,T,{style:'rope',step:7}),
};
