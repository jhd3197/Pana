// Authored mountain-to-coast journey; shared coordinates for terrain and landmarks.
import { smooth,hill,pathDistance } from './world-kit.js';
export const ROUTE=[[-260,-500],[-140,-510],[-20,-500],[120,-460],[200,-400],[210,-320],[135,-290],[55,-330],[-30,-340],[-100,-300],[-250,-315],[-360,-270],[-350,-210],[-230,-180],[-105,-205],[0,-175],[30,-105],[-70,-70],[-200,-100],[-315,-45],[-300,30],[-170,55],[-75,30],[0,70],[20,145],[-75,175],[-155,145],[-230,195],[-180,260],[-75,285],[40,300],[170,275],[290,220],[350,135],[320,60],[240,15],[230,-65],[315,-110],[380,-200],[385,-310],[340,-410],[280,-520],[150,-585],[0,-620],[-160,-610],[-300,-585],[-365,-535],[-350,-480]];
export const THERMAL={x:65,z:-408,y:173,r:66};
export const roadHeight=(x,z)=>{
  const mountain=5+195*smooth(-z,-300,620);
  // The upper road meets the pool terrace, giving drivers an open view across it.
  const shelf=(1-smooth(Math.hypot((x-THERMAL.x)*.65,z-THERMAL.z),65,135))*smooth(-z,360,440);
  return mountain*(1-shelf)+(THERMAL.y+1)*shelf;
};
export const RIVER=[[325,-365],[300,-270],[330,-170],[275,-95],[285,-20],[305,50],[265,130],[215,205],[165,280],[150,420]];
export const riverDistance=pathDistance(RIVER);
export const coast=x=>350+.0016*x*x;
export function wetnessAt(x,z){
  const thermal=1-smooth(Math.hypot((x-THERMAL.x)/1.5,z-THERMAL.z),78,142);
  const crossing=(1-smooth(riverDistance(x,z),9,28))*(1-smooth(z,305,335));
  return Math.max(thermal,crossing*.75);
}
export const gripAt=(x,z)=>1-.46*wetnessAt(x,z);
export function baseHeight(x,z){
  const beach=coast(x),sea=smooth(z,beach-16,beach+40);
  let h=roadHeight(x,z)+hill(x,z,-495,-180,140,350,210)+hill(x,z,465,-165,135,330,170)+hill(x,z,-35,-740,390,125,150)-hill(x,z,-70,-80,145,280,28);
  h+=(Math.sin(x*.029+z*.018)*Math.cos(z*.035)*9+Math.sin(x*.065-z*.046)*4)*smooth(h,35,170);
  // A natural terrace supports the springs, boardwalks and bath house.
  const plateau=smooth(Math.hypot(x-THERMAL.x,z-THERMAL.z),64,94);h=h*plateau+THERMAL.y*(1-plateau);
  h=h*(1-sea)-17*sea;
  const d=riverDistance(x,z);return h*smooth(d,7,17)+(roadHeight(x,z)-6)*(1-smooth(d,7,17));
}
