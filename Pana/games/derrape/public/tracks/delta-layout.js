import { smooth, channelAt } from './water-world-math.js';
export const ROUTE = [[-230,-210],[-60,-245],[120,-215],[240,-120],[245,30],[150,80],[115,200],[-30,245],[-190,195],[-255,70],[-185,-25],[-280,-95]];
export const CHANNELS = [
  [[-360,-420,0],[0,-130,0],[50,40,0],[35,210,0],[180,460,0]],
  [[0,-130,0],[170,-55,0],[420,20,0]],
  [[50,40,0],[-95,25,0],[-400,115,0]],
];
export const riverAt = (x,z) => CHANNELS.map(p=>channelAt(p,x,z)).sort((a,b)=>a.distance-b.distance)[0];
export const roadHeight = (x,z) => 4.5 + 4.5*(1-smooth(Math.hypot(x-240,z+30),35,135));
export const baseHeight = (x,z) => -3.5 + 6.3*smooth(riverAt(x,z).distance,22,47)+.25*Math.sin(x*.02)*Math.cos(z*.018);
export const VILLAGE = [[-190,-160,0],[-135,-150,.2],[-75,-152,-.2],[-15,-90,1.1],[110,-125,-.8],[165,-100,-.6],[-70,80,.7],[-145,75,.4]];
