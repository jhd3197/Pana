import { smooth, hill, channelAt } from './water-world-math.js';
export const ROUTE = [[-260,-340],[-70,-370],[140,-310],[300,-170],[350,40],[240,220],[30,280],[-180,210],[-220,70],[-125,-35],[40,-55],[135,-140],[55,-220],[-110,-210],[-285,-150],[-380,-240]];
export const roadHeight = (x,z) => 12 + 78 * smooth(-z,-160,460);
export const OUTLET = [[0,0,7],[25,80,6],[65,160,4],[100,290,2],[160,600,0]];
export const riverAt = (x,z) => {
  const channel=channelAt(OUTLET,x,z),poolDistance=Math.max(0,Math.hypot(x,z)-65);
  // The full curtain lands in an excavated basin, which feeds the outlet.
  return poolDistance<channel.distance?{...channel,distance:poolDistance,height:7}:channel;
};
export const baseHeight = (x,z) => {
  const river = riverAt(x,z), bank = smooth(river.distance,18,65);
  const valley = roadHeight(x,z) + hill(x,z,-430,-30,125,320,85) + hill(x,z,470,-140,160,360,120);
  return (river.height-4)*(1-bank)+valley*bank;
};
export const GALLERY = { from: .58, to: .77 };
export const wetness = (x,z) => (1-smooth(Math.abs(x),55,120))*(1-smooth(Math.abs(z+55),12,50));
