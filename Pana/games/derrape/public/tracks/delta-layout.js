import { smooth, channelAt } from './water-world-math.js';
export const ROUTE = [[-230,-210],[-60,-245],[120,-215],[240,-120],[245,30],[150,80],[115,200],[-30,245],[-190,195],[-255,70],[-185,-25],[-280,-95]];
export const CHANNELS = [
  [[-360,-420,0],[0,-130,0],[50,40,0],[35,210,0],[180,460,0]],
  [[0,-130,0],[170,-55,0],[420,20,0]],
  [[50,40,0],[-95,25,0],[-400,115,0]],
];
export const riverAt = (x,z) => CHANNELS.map(p=>channelAt(p,x,z)).sort((a,b)=>a.distance-b.distance)[0];
// The laguna where the main caño widens under the route: an ellipse with a
// wobbly shore (lagoonR < 1 is water) and three mangrove islets. The road
// ramps down into it on both sides and runs under the water between them,
// where cars cross as lanchas (course-rules.js).
export const LAGOON = { x:25, z:240, rx:115, rz:75, islets:[[55,280,14],[-25,198,10],[112,238,9]] };
export const lagoonR = (x,z) => {
  const dx=(x-LAGOON.x)/LAGOON.rx, dz=(z-LAGOON.z)/LAGOON.rz, a=Math.atan2(dz,dx);
  return Math.hypot(dx,dz)/(1+.06*Math.sin(a*5+1)+.04*Math.sin(a*9));
};
const isletAt = (x,z) => LAGOON.islets.reduce((h,[ix,iz,r])=>Math.max(h,1-smooth(Math.hypot(x-ix,z-iz),r*.6,r)),0);
export const roadHeight = (x,z) => {
  const h = 4.5 + 4.5*(1-smooth(Math.hypot(x-240,z+30),35,135));
  return h + (-.8-h)*(1-smooth(lagoonR(x,z),.92,1.45));
};
export const baseHeight = (x,z) => {
  const h = -3.5 + 6.3*smooth(riverAt(x,z).distance,22,47)+.25*Math.sin(x*.02)*Math.cos(z*.018);
  const r = lagoonR(x,z);
  if (r > 1.15) return h;
  const bed = Math.min(h, -2.5 + (h+2.5)*smooth(r,.85,1.1));
  return bed + (.7-bed)*isletAt(x,z);
};
// Open water for the boats: the laguna, never the caños leading out of it.
export const lagoonWaterAt = (x,z) => lagoonR(x,z) < 1.15 ? 0 : null;
export const VILLAGE = [[-190,-160,0],[-135,-150,.2],[-75,-152,-.2],[-15,-90,1.1],[110,-125,-.8],[165,-100,-.6],[-70,80,.7],[-145,75,.4]];
