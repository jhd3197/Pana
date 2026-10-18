import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight, wetness, crossfall, CAVE } from './salinas-layout.js';
import { salinasWorld } from './salinas-world.js';
import { vergePosts } from './country-details.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='salinas'),points:ROUTE,rounded:true,layered:true,hw:12,lineU:.025,elevation:roadHeight,crossfall,waterAt:wetness,walls:false,chevrons:true,
  previewBounds:[[-600,-3,-400],[560,100,900]],indoors:[[CAVE.from,CAVE.to]],
  sectors:[[0,'Salinas del pueblo'],[.12,'Llanura blanca'],[.24,'Cruce del agua'],[.36,'Boca de la mina'],[.43,'Sala de los cristales'],[.54,'Gran domo de sal'],[.66,'Cascada rosada'],[.78,'Salida de la mina'],[.88,'Calzadas de sal']],
  items:{boxes:[.08,.19,.33,.43,.53,.63,.73,.84,.94],boxLanes:[-8,-3,3,8],pads:[{u:.13,off:0},{u:.5,off:-4},{u:.71,off:4},{u:.9,off:-4}]},
  shortcuts:[{from:[.515,7],to:[.615,7],w:7,arch:.8}],
  palette:{skySeed:59,cloudCover:.16,horizon:0xd8eef0,skyTop:0x4fb0e6,hemiSky:0xeaf4ff,hemiGround:0xf2c9d6,hemiInt:1.45,sun:0xffdcae,sunInt:2.3,ground:0xfdf3f6,track:0xd8a08a,dune:0,fog:[600,2400]},
  environment:salinasWorld,scenery:(g,k,T)=>g.add(vergePosts(T,{color:0x486c77,step:18})),
};
