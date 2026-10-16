// World coordinates in metres. The river and forest occupy the whole valley.
import * as THREE from 'three';

export const TUNNEL = { from: 0.445, to: 0.505, halfWidth: 12.6, shoulderHeight: 8.4, height: 16.2 };
export const RIVER = [[-340,115],[-240,70],[-155,27],[-108,-9],[-75,-33],[-40,-64],[-10,-75],
  [14,-103],[20,-135],[0,-159],[-22,-178],[-43,-184]];
const riverCurve = new THREE.CatmullRomCurve3(RIVER.map(([x,z])=>new THREE.Vector3(x,0,z)));
export const RIVER_SAMPLES = riverCurve.getSpacedPoints(160);

export function riverDistance(x,z) {
  let distance=Infinity;
  for(let i=1;i<RIVER_SAMPLES.length;i++) {
    const a=RIVER_SAMPLES[i-1],b=RIVER_SAMPLES[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    distance=Math.min(distance,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
  }
  return distance;
}

export function jungleHeight(x,z) {
  return 3+11*Math.exp(-(((x-215)/105)**2)-((z+125)/145)**2)
    +5*Math.exp(-(((x+155)/95)**2)-((z+120)/110)**2);
}

// An interior watershed separates the early loop from the tunnel exit. Unlike
// the distant valley rim, this ridge blocks car-height views across the course.
export function jungleRidgeHeight(x,z) {
  let h=0;
  for(const [cx,cz,rx,rz,peak] of [[119,-79,41,29,38],[151,-94,36,25,34],[185,-111,30,23,27]]) {
    h=Math.max(h,peak*Math.exp(-(((x-cx)/rx)**2)-((z-cz)/rz)**2));
  }
  return h*(1+0.065*Math.sin(x*0.15+z*0.09)*Math.cos(z*0.13));
}

export function tunnelContains(T,x,z,margin=0) {
  const s=T.paramOf(x,z),u=s/T.TOTAL;
  return u>TUNNEL.from-margin/T.TOTAL&&u<TUNNEL.to+margin/T.TOTAL&&Math.abs(T.offsetOf(x,z))<40+margin;
}
