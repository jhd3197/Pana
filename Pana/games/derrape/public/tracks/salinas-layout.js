import { smooth, pondAt, channelAt } from './water-world-math.js';
export const ROUTE = [[-260,-180],[-70,-245],[130,-220],[285,-120],[310,55],[205,150],[215,270],[40,280],[-85,180],[-245,190],[-305,40],[-220,-45]];
export const PONDS = [
  {x:-110,z:-100,rx:120,rz:72,color:0xd38e9e}, {x:130,z:-65,rx:120,rz:90,color:0x55b8b3},
  {x:180,z:130,rx:97,rz:65,color:0xcd899b}, {x:-80,z:75,rx:115,rz:65,color:0x58b4b8},
  {x:425,z:160,rx:100,rz:155,color:0xdb9d9c}, {x:-435,z:-50,rx:100,rz:180,color:0x7cb9b9},
];
export const WATER_Y = .9;
export const CHANNELS = [[[-110,-100],[20,-100],[130,-65]],[[130,-65],[180,30],[180,130]],
  [[-80,75],[30,95],[180,130]],[[180,130],[330,150],[425,160],[560,420]]];
export const channelSample = (x,z) => CHANNELS.map(p=>channelAt(p,x,z)).sort((a,b)=>a.distance-b.distance)[0];
export const roadHeight = (x,z) => 2.8-2.25*(1-smooth(Math.hypot(x-220,z-155),15,100));
export const pondField = (x,z) => Math.min(...PONDS.map(p=>pondAt(p,x,z)));
export const baseHeight = (x,z) => Math.min(-.8+3.4*smooth(pondField(x,z),.83,1.13)+.09*Math.sin(x*.1)*Math.sin(z*.12),-.4+3.1*smooth(channelSample(x,z).distance,3,8));
export const wetness = (x,z,time,T) => {
  if(pondField(x,z)>=1.04&&channelSample(x,z).distance>=8)return 0;
  // Match the rendered road deck, including its 13 cm surface clearance.
  return smooth(WATER_Y-(T?.surfaceAt(x,z)??roadHeight(x,z))-.13,.015,.3);
};
