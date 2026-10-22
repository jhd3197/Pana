import { smooth, hill, channelAt } from './water-world-math.js';
export const ROUTE = [[-260,210],[-335,60],[-310,-110],[-160,-225],[20,-220],[175,-155],[260,-25],[175,75],[265,195],[155,280],[-15,240],[-120,300]];
export const roadHeight = (x,z) => 8+28*smooth(-z,-220,290);
export const RIVER = [[-410,-230,25],[-170,-160,22],[10,-155,19],[135,-70,14],[120,80,9],[10,160,5],[-70,460,0]];
export const riverAt = (x,z) => channelAt(RIVER,x,z);
export const baseHeight = (x,z) => {
  const r=riverAt(x,z), river=smooth(r.distance,12,40);
  return (r.height-4)*(1-river)+(roadHeight(x,z)-2+hill(x,z,-460,-160,170,310,115)+hill(x,z,400,-260,240,190,95))*river;
};
export const CAVE = { from: .1, to: .61, skylights: [[.27,.30],[.43,.46]] };
