import { smooth,hill,pathDistance } from './world-kit.js';

export const ROUTE=[[-310,180],[-180,180],[-70,210],[45,185],[165,210],[285,185],[330,95],[300,25],[205,0],[165,-65],[225,-130],[310,-155],[330,-240],[255,-300],[145,-275],[75,-200],[-15,-180],[-95,-225],[-200,-220],[-265,-140],[-230,-60],[-140,-20],[-165,55],[-260,45],[-335,95]];
// A continuous caño connects the esteros and passes below two road bridges.
export const RIVER=[[180,-650],[135,-430],[78,-310],[74,-230],[80,-150],[112,-65],[90,35],[109,125],[122,225],[105,340],[155,440],[200,650]];
export const riverDistance=pathDistance(RIVER);
export const ESTEROS=[{x:80,z:87,rx:67,rz:76},{x:124,z:140,rx:65,rz:46},{x:5,z:-75,rx:48,rz:32}];
export const WATER_Y=.65;
export const roadHeight=(x,z)=>3.9+hill(x,z,-220,160,145,110,2.3)+hill(x,z,290,-235,120,110,1.8);
export const wetlandDistance=(x,z)=>Math.min(...ESTEROS.map(p=>Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz)));
export function baseHeight(x,z){
  const field=2.2+.7*Math.sin(x*.018)*Math.cos(z*.022)+hill(x,z,-230,190,165,110,3.2);
  const blend=Math.min(smooth(riverDistance(x,z),10,28),smooth(wetlandDistance(x,z),.85,1.28));
  return -1.8+(field+1.8)*blend;
}
