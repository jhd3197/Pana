import { smooth, pondAt, channelAt } from './water-world-math.js';
// The salt flats loop, then a long detour north under the salt mountain.
export const ROUTE = [[-260,-180],[-70,-245],[130,-220],[285,-120],[310,55],[205,150],[215,270],[300,470],[260,700],[60,800],
  [-160,760],[-280,590],[-320,400],[-245,190],[-305,40],[-220,-45]];
export const PONDS = [
  {x:-110,z:-100,rx:120,rz:72,color:0xf08fb4}, {x:130,z:-65,rx:120,rz:90,color:0x2fd2cc},
  {x:180,z:130,rx:97,rz:65,color:0xf39ab8}, {x:-80,z:75,rx:115,rz:65,color:0x36cfd2},
  {x:425,z:160,rx:100,rz:155,color:0xf5a6bd}, {x:-435,z:-50,rx:100,rz:180,color:0x4fd8d0},
];
export const WATER_Y = .9;
export const CHANNELS = [[[-110,-100],[20,-100],[130,-65]],[[130,-65],[180,30],[180,130]],
  [[-80,75],[30,95],[180,130]],[[180,130],[330,150],[425,160],[560,420]]];
export const channelSample = (x,z) => CHANNELS.map(p=>channelAt(p,x,z)).sort((a,b)=>a.distance-b.distance)[0];
// North of the flats the road dives 32 m down an open salt cut into the mine.
export const MINE_DEPTH = 32;
export const roadHeight = (x,z) => 2.8-2.25*(1-smooth(Math.hypot(x-220,z-155),15,100))-MINE_DEPTH*smooth(z,380,600);
export const crossfall = (s,off,T) => .6*Math.max(0,Math.min(1,off/T.HW))*(1-smooth(T.heightAtS(s),.75,1.4));
export const pondField = (x,z) => Math.min(...PONDS.map(p=>pondAt(p,x,z)));
export const baseHeight = (x,z) => Math.min(-.8+3.4*smooth(pondField(x,z),.83,1.13)+.09*Math.sin(x*.1)*Math.sin(z*.12),-.4+3.1*smooth(channelSample(x,z).distance,3,8));
export const wetness = (x,z,time,T) => {
  if(pondField(x,z)>=1.04&&channelSample(x,z).distance>=8)return 0;
  // Match the rendered road deck, including its 13 cm surface clearance.
  return smooth(WATER_Y-(T?.surfaceAt(x,z)??roadHeight(x,z))-.13,.015,.3);
};

// The salt mine under the northern flats: a closed tunnel from where the cut
// is deep enough, opening into three domed halls. No openings in the roof.
export const CAVE = {
  from: .415, to: .727,
  halls: [{ u: .48, wide: 22, tall: 11 }, { u: .565, wide: 26, tall: 12, sides: [-1] }, { u: .655, wide: 22, tall: 11 }],
  skylights: [],
};
// Gaussian halls on a 22 m half-width, 16 m tall tunnel (same as salt-cave.js
// caveProfile, kept here so Node tests can import the layout without Three).
const halls = (base, key, spread) => u => CAVE.halls.reduce((sum, h) => sum + h[key] * Math.exp(-(((u - h.u) / spread) ** 2) / 2), base);
export const CAVE_PROFILE = { widthAt: halls(22, 'wide', .02), heightAt: halls(16, 'tall', .022) };
