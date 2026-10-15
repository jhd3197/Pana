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
  palette:{horizon:0xe9d3ad,skyTop:0x80b8d0,hemiSky:0xffefd3,hemiGround:0xba9163,hemiInt:1.65,sun:0xffdfad,sunInt:2.4,ground:0xcfac76,track:0xb3a184,dune:0,fog:[480,1450]},
  environment:desertEnvironment,scenery:desertScenery,
};
