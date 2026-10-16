// An authored desert journey: dunes, elevated canyon gates and a living oasis.
import {ROUTE,roadHeight} from './desierto-layout.js';
import {desertEnvironment,desertScenery} from './desierto-world.js';
export default {
  id:'desierto',name:'Pana Desierto',
  blurb:'De Pana Gas a las dunas: sube al cañón de los dos arcos y baja hasta el pozo del oasis.',
  points:ROUTE,rounded:true,hw:9,lineU:.008,elevation:roadHeight,
  previewBounds:[[-445,0,-435],[450,115,325]],
  sectors:[[0,'Pana Gas'],[.18,'Mar de dunas'],[.36,'Subida del cardón'],[.49,'Cañón de los arcos'],[.69,'Oasis del pozo'],[.85,'Camino de las carretas']],
  items:{boxes:[.1,.25,.4,.56,.73,.9],boxLanes:[-6,-2,2,6],pads:[{u:.13,off:0},{u:.31,off:3},{u:.63,off:-3},{u:.94,off:0}]},
  walls:false,chevrons:true,
  palette:{skySeed:43,cloudCover:0.19,horizon:0xc2e1ed,skyTop:0x328fca,hemiSky:0xeaf4ff,hemiGround:0xad7950,hemiInt:1.45,sun:0xffebc8,sunInt:2.5,ground:0xd5a252,track:0xc5a67a,dune:0,fog:[480,1450]},
  environment:desertEnvironment,scenery:desertScenery,
};
