import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight, wetness } from './salinas-layout.js';
import { salinasWorld } from './salinas-world.js';
import { vergePosts } from './country-details.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='salinas'),points:ROUTE,rounded:true,hw:12,lineU:.025,elevation:roadHeight,waterAt:wetness,walls:false,chevrons:true,
  previewBounds:[[-560,-3,-400],[560,70,440]],
  sectors:[[0,'Salinas del pueblo'],[.18,'Llanura blanca'],[.35,'Curvas de los estanques'],[.48,'Cruce del agua'],[.63,'Calzadas de sal'],[.8,'Patio de carga']],
  items:{boxes:[.1,.26,.42,.6,.75,.9],boxLanes:[-8,-3,3,8],pads:[{u:.13,off:0},{u:.65,off:4},{u:.87,off:-4}]},
  palette:{skySeed:59,cloudCover:.16,horizon:0xd3e7e5,skyTop:0x75b7d0,hemiSky:0xe1edef,hemiGround:0xc4baa1,hemiInt:1.3,sun:0xfff1d5,sunInt:1.8,ground:0xdedbce,track:0xb4aca0,dune:0,fog:[600,2400]},
  environment:salinasWorld,scenery:(g,k,T)=>g.add(vergePosts(T,{color:0x486c77,step:18})),
};
