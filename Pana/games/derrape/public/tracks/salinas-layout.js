import { smooth, pondAt, channelAt } from './water-world-math.js';
// The salt flats loop, then a long detour north under the salt mountain.
export const ROUTE = [[-260,-180],[-70,-245],[130,-220],[285,-120],[310,55],[205,150],[215,270],[300,470],[260,700],[60,800],
  [-160,760],[-280,590],[-320,400],[-245,190],[-305,40],[-220,-45]];
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
export const crossfall = (s,off,T) => .6*Math.max(0,Math.min(1,off/T.HW))*(1-smooth(T.heightAtS(s),.75,1.4));
export const pondField = (x,z) => Math.min(...PONDS.map(p=>pondAt(p,x,z)));
export const baseHeight = (x,z) => Math.min(-.8+3.4*smooth(pondField(x,z),.83,1.13)+.09*Math.sin(x*.1)*Math.sin(z*.12),-.4+3.1*smooth(channelSample(x,z).distance,3,8));
export const wetness = (x,z,time,T) => {
  if(pondField(x,z)>=1.04&&channelSample(x,z).distance>=8)return 0;
  // Match the rendered road deck, including its 13 cm surface clearance.
  return smooth(WATER_Y-(T?.surfaceAt(x,z)??roadHeight(x,z))-.13,.015,.3);
};

// The salt mine under the northern mountain: three domed halls, skylights in
// the first and last. The middle hall keeps its inner side for the shortcut.
export const CAVE = {
  from: .385, to: .765,
  halls: [{ u: .45, wide: 30, tall: 24 }, { u: .565, wide: 34, tall: 28, sides: [-1] }, { u: .68, wide: 28, tall: 22 }],
  skylights: [[.444, .456], [.675, .685]],
};
// Gaussian halls on a 29 m half-width, 24 m tall tunnel (same as salt-cave.js
// caveProfile, kept here so Node tests can import the layout without Three).
const halls = (base, key, spread) => u => CAVE.halls.reduce((sum, h) => sum + h[key] * Math.exp(-(((u - h.u) / spread) ** 2) / 2), base);
export const CAVE_PROFILE = { widthAt: halls(29, 'wide', .022), heightAt: halls(24, 'tall', .024) };
