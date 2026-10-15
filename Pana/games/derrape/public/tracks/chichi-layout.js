import { smooth,hill,pathDistance } from './world-kit.js';
export const ROUTE=[[-230,-230],[-130,-225],[-50,-195],[-20,-140],[-70,-110],[-150,-135],[-220,-110],[-235,-50],[-170,-15],[-95,-35],[-25,-15],[10,40],[-35,80],[-105,65],[-160,105],[-130,155],[-50,175],[40,195],[135,180],[215,130],[235,60],[195,10],[140,-20],[165,-85],[235,-125],[245,-200],[170,-245],[70,-265],[-50,-285],[-165,-300],[-255,-305],[-315,-270],[-315,-225],[-280,-210]];
export const roadHeight=(x,z)=>4+100*smooth(-z,-120,330);
export const RIVER=[[220,-215],[200,-135],[195,-70],[170,-5],[180,50],[150,115],[105,180],[90,240]];
export const riverDistance=pathDistance(RIVER);
export const coast=x=>210+.0018*x*x;
export function baseHeight(x,z){
  const beach=coast(x),sea=smooth(z,beach-12,beach+35);
  let h=roadHeight(x,z)+hill(x,z,-335,-35,90,240,150)+hill(x,z,320,-90,85,210,140)+hill(x,z,0,-360,280,100,100);
  h+=Math.sin(x*.025)*Math.cos(z*.021)*4*smooth(-z,-120,240);
  h+=(Math.sin(x*.056+z*.03)*Math.cos(z*.048)*8+Math.sin(x*.11-z*.07)*3)*smooth(h,40,160);
  h=h*(1-sea)-14*sea;const river=riverDistance(x,z);
  return h*smooth(river,5,14)+(roadHeight(x,z)-4)*(1-smooth(river,5,14));
}
