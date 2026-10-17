import { WATER_TRACKS } from './water-track-definitions.js';
import { ROUTE, roadHeight } from './delta-layout.js';
import { deltaWorld } from './delta-world.js';
import { edges } from './world-kit.js';
export default {
  ...WATER_TRACKS.find(t=>t.id==='delta'),points:ROUTE,rounded:true,hw:10,lineU:.025,elevation:roadHeight,walls:false,chevrons:true,
  previewBounds:[[-470,-5,-400],[470,60,410]],
  sectors:[[0,'Embarcadero'],[.16,'Calzada de madera'],[.3,'Puente del caño'],[.48,'Isla de mangles'],[.65,'Mercado del agua'],[.83,'Vuelta de la ribera']],
  items:{boxes:[.1,.26,.42,.58,.74,.9],boxLanes:[-6,-2,2,6],pads:[{u:.14,off:0},{u:.5,off:4},{u:.8,off:-4}]},
  palette:{skySeed:57,cloudCover:.22,horizon:0xf1dbc0,skyTop:0x78b1c5,hemiSky:0xf4e9d9,hemiGround:0x7c8960,hemiInt:1.5,sun:0xffcf94,sunInt:2.1,ground:0x7e9b58,track:0xb0a184,dune:0,fog:[470,1600]},
  environment:deltaWorld,scenery:(g,k,T)=>edges(g,k,T,{style:'rope',step:8}),
};
