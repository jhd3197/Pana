import { MathUtils } from 'three';
import { tideZone } from './bululu-tide.js';

const smooth=MathUtils.smoothstep;
const dome=(x,z,cx,cz,rx,rz,h)=>h*Math.max(0,1-((x-cx)/rx)**2-((z-cz)/rz)**2)**2;
const hill=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-(((x-cx)/rx)**2)-((z-cz)/rz)**2);
export const SCALE=1.23;
export const ROUTE=[[-260,80],[-260,155],[-170,210],[-70,220],[10,170],[15,100],[65,60],[140,75],[220,130],[300,110],[335,35],[300,-35],[230,-70],[170,-130],[90,-195],[-5,-215],[-90,-175],[-120,-100],[-185,-65],[-255,-20]].map(([x,z])=>[x*SCALE,z*SCALE]);

// Broad, compact crests: no change to the tidal crossing or its approaches.
export function coastalRise(x,z){
  return dome(x,z,-110,250,190,120,14)+dome(x,z,365,65,120,180,11);
}
export function coastalLandform(x,z){
  return coastalRise(x,z)+dome(x,z,-43,177,75,65,24)+dome(x,z,320,50,85,100,16);
}
export function roadHeight(x,z){
  const dry=1-tideZone(x,z);
  return (3.2+hill(x,z,-270,-120,120,95,7)+coastalRise(x,z))*dry+.48*(1-dry);
}
export function coastalBank(s,off,T){
  const u=((s/T.TOTAL)%1+1)%1;
  const window=(a,b,c,d)=>smooth(u,a,b)*(1-smooth(u,c,d));
  const left=14*window(.085,.12,.185,.225)+12*window(.365,.40,.485,.535);
  const right=9*window(.235,.26,.30,.335);
  const across=MathUtils.clamp(off,-T.HW-4,T.HW+4);
  return Math.tan(left*Math.PI/180)*(T.HW+across)+Math.tan(right*Math.PI/180)*(T.HW-across);
}
// Pale stone belongs to the village and lookout; the beach stays warm sand.
export function roadStyle(x,z){
  return x<-265&&z<190 || coastalRise(x,z)>8 ? 'stone' : 'sand';
}
