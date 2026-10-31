// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight, lagoonWaterAt } from './delta-layout.js';
import { deltaWorld } from './delta-world.js';
import { edges } from './world-kit.js';
import { festive } from './festive.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='delta'),points:ROUTE,rounded:true,hw:10,lineU:.025,elevation:roadHeight,walls:false,chevrons:true,
  previewBounds:[[-470,-5,-400],[470,60,410]],
  sectors:[[0,'Embarcadero'],[.16,'Calzada de madera'],[.3,'Puente del caño'],[.48,'Isla de mangles'],[.65,'Mercado del agua'],[.83,'Vuelta de la ribera']],
  // The road ramps down into the laguna: cars cross it as lanchas, anywhere
  // inside its shore (course-rules.js, transform-gates.js).
  transformGates:[{below:.3,open:true}],lagoonAt:lagoonWaterAt,
  items:{boxes:[.1,.26,.42,.58,.74,.9],boxLanes:[-6,-2,2,6],pads:[{u:.14,off:0},{u:.5,off:4},{u:.8,off:-4}]},
  palette:{skySeed:57,cloudCover:.26,horizon:0xffe7c4,skyTop:0x2a98e6,halo:1.3,hemiSky:0xd8e4ff,hemiGround:0x6fa650,hemiInt:1.55,sun:0xffc781,sunInt:2.5,ground:0x74b450,track:0xd6a873,dune:0,fog:[500,1900]},
  environment:deltaWorld,
  scenery(g,k,T){
    edges(g,k,T,{style:'rope',step:8,skip:s=>T.heightAtS(s)<.8});
    // Orinoco delta: scarlet ibis flocks, bucare and apamate on the banks,
    // market bunting and flower beds by the palafitos.
    festive(g,T,{seed:57,skip:s=>T.heightAtS(s)<1.5,minY:.45,maxDrop:2.5,stands:300,banners:480,bunting:200,balloons:200,flags:260,butterflies:40,
      trees:[['bucare',14,[1,18]],['apamate',12,[1,18]],['palm',16,[0,14]]],
      plants:[['heliconia',30],['hibiscus',20],['trinitaria',8,[0,10],.8]],
      birds:[{kind:'ibis',flocks:3,size:5,height:[10,20]},{kind:'macaw',flocks:1,size:4}],
      vista:{shape:'hill',hills:20,height:[50,120],colors:[0x3f9a5a,0x4fae62,0x5fa86e],balloons:3}});
  },
};
