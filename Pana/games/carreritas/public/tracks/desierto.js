// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { TRACK_DEFINITIONS } from '../track-definitions.js';
// An authored desert journey: dunes, elevated canyon gates and a living oasis.
import {ROUTE,roadHeight,OASIS} from './desierto-layout.js';
import { libraryForest } from './library-forest.js';
import {desertEnvironment,desertScenery} from './desierto-world.js';
const oasisRing=(x,z)=>Math.hypot((x-OASIS.x)/OASIS.rx,(z-OASIS.z)/OASIS.rz);
export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'desierto'),
  points:ROUTE,rounded:true,hw:9,lineU:.008,elevation:roadHeight,
  previewBounds:[[-445,0,-435],[450,115,325]],
  sectors:[[0,'Pana Gas'],[.18,'Mar de dunas'],[.36,'Subida del cardón'],[.49,'Cañón de los arcos'],[.69,'Oasis del pozo'],[.85,'Camino de las carretas']],
  shortcuts:[{from:[.4459,-6.5],to:[.585,-6.5]}],
  hazards:[{kind:'rock',u:.096},{kind:'rock',u:.096,phase:4.5}],
  items:{boxes:[.1,.25,.4,.56,.73,.9],boxLanes:[-6,-2,2,6],pads:[{u:.13,off:0},{u:.31,off:3},{u:.63,off:-3},{u:.94,off:0}]},
  walls:false,chevrons:true,
  palette:{skySeed:43,cloudCover:0.22,horizon:0xd3f1ec,skyTop:0x1b8cf0,halo:1.2,hemiSky:0xd6e6ff,hemiGround:0xd08a4e,hemiInt:1.45,sun:0xffcf8e,sunInt:2.7,ground:0xeaa955,track:0xdcac76,dune:0,fog:[520,1900]},
  // Cardones over the flats and mesa tops; palms and mangos around the oasis pool.
  forest:{plant:libraryForest,bounds:[-610,-550,600,480],whole:['cactus'],count:60,spacing:14,edge:62,maxSlope:.6,clump:.65,seed:97,
    species:[{name:'cactus',weight:1,scale:[1.1,1.9],where:(x,z)=>oasisRing(x,z)<1.7?.2:1},
      {name:'palm',weight:6,where:(x,z)=>oasisRing(x,z)<1.9?1:0},{name:'mango',weight:2,where:(x,z)=>oasisRing(x,z)<1.6?1:0}]},
  environment:desertEnvironment,scenery:desertScenery,
};
