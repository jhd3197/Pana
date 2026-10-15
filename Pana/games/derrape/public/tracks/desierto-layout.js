import { smooth,hill } from './world-kit.js';

export const ROUTE=[[-260,210],[-150,210],[-40,225],[65,210],[130,155],[220,175],[290,125],[320,35],[255,-30],[160,-15],[125,-80],[170,-150],[260,-190],[265,-275],[170,-330],[70,-285],[0,-300],[-85,-260],[-100,-180],[-35,-125],[-60,-65],[-150,-50],[-230,-90],[-310,-40],[-330,50],[-300,125]];
export const OASIS={x:-177,z:-190,rx:48,rz:35};
export const roadHeight=(x,z)=>3+28*smooth(-z,-40,260)+hill(x,z,265,-165,140,160,8);
OASIS.y=roadHeight(OASIS.x,OASIS.z)-4;
export const MESAS=[[-30,45,48,39],[55,-105,46,48],[335,-140,55,57],[165,-385,80,63],[-205,-330,68,45],[-375,-155,60,42],[410,45,58,35]];
export function baseHeight(x,z){
  let h=roadHeight(x,z)-1.5+Math.sin(x*.028)*Math.cos(z*.022)*3;
  for(const [cx,cz,r,top]of MESAS){
    const dx=x-cx,dz=z-cz,a=Math.atan2(dz,dx);
    const edge=1+.1*Math.sin(a*5+cx)+.065*Math.sin(a*9+cz);
    const d=Math.hypot(dx/r,dz/(r*.78))/edge;
    // Broad summits, a steep eroded wall and an apron of fallen stone.
    h+=top*(.78*(1-smooth(d,.72,1.03))+.22*(1-smooth(d,.9,1.55)));
  }
  h+=hill(x,z,140,65,140,60,14)+hill(x,z,-390,250,160,90,15);
  const d=Math.hypot((x-OASIS.x)/OASIS.rx,(z-OASIS.z)/OASIS.rz),blend=smooth(d,.82,1.4);
  return h*blend+(OASIS.y-3)*(1-blend);
}
