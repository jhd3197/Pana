import { smooth,hill } from './world-kit.js';
export const ROUTE=[[-230,210],[-140,210],[-60,185],[40,205],[155,190],[225,135],[215,70],[145,45],[65,55],[-25,65],[-120,40],[-175,-10],[-140,-65],[-45,-65],[55,-45],[150,-75],[215,-125],[195,-190],[110,-220],[5,-195],[-100,-225],[-200,-190],[-245,-125],[-275,-35],[-285,65],[-280,145]];
export const roadHeight=(x,z)=>6+96*smooth(-z,-220,260);
export const LAKE={x:35,z:-125,rx:47,rz:30,y:72};
export function baseHeight(x,z){
  let h=roadHeight(x,z)+hill(x,z,-110,-315,145,90,125)+hill(x,z,290,-285,90,150,110)+hill(x,z,-355,-80,70,240,90)+hill(x,z,25,110,80,38,22);
  h+=hill(x,z,-150,-470,135,110,170)+hill(x,z,100,-455,110,115,200)+hill(x,z,385,-400,110,145,155);
  h+=(Math.sin(x*.035)*Math.cos(z*.028)*4+Math.sin(x*.081+z*.04)*Math.cos(z*.05)*7)*smooth(h,40,170);
  const d=Math.hypot((x-LAKE.x)/LAKE.rx,(z-LAKE.z)/LAKE.rz);h=h*smooth(d,.9,1.45)+(LAKE.y-3)*(1-smooth(d,.9,1.45));
  for(const [cx,cz,top] of [[-35,-275,125],[40,130,24]]){const blend=smooth(Math.hypot(x-cx,z-cz),23,47);h=h*blend+top*(1-blend);}
  return h;
}
