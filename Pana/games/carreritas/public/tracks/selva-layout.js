// World coordinates in metres. The river and forest occupy the whole valley.
import * as THREE from 'three';

// The loop: the original valley circuit, now entered from the north after
// a climb through the jaguar cave, a plateau, a ledge descent and a ford.
export const ROUTE = [[-76,28],[-40,60],[-30,150],[-50,330],[45,490],[240,525],[400,440],[440,270],[375,125],[220,80],[110,50],[68,8],
  [85,-30],[145,-45],[185,0],[230,-15],[270,-80],[240,-145],[175,-155],[120,-115],[70,-145],[25,-210],[-45,-225],[-115,-180],[-120,-105],[-85,-65],[-110,-15]];
// Positions authored on the 1.14 km valley loop keep their place: past the
// new northern section, old u maps to new u by a fixed extra length.
export const LENGTH = 2460.17, VALLEY_LENGTH = 1141.39, NORTH_EXTRA = 1318.7;
export const legacyU = u => (u * VALLEY_LENGTH + NORTH_EXTRA) / LENGTH;

export const TUNNEL = { from: legacyU(0.445), to: legacyU(0.505), halfWidth: 12.6, shoulderHeight: 8.4, height: 16.2 };
// The jaguar cave climbs to the plateau; its temple hall is a Gaussian bump.
export const JAGUAR_CAVE = { from: .032, to: .158, halls: [{ u: .094, wide: 30, tall: 22 }], skylights: [[.089, .099], [.128, .133]] };
const hall = (base, key, spread) => u => JAGUAR_CAVE.halls.reduce((sum, h) => sum + h[key] * Math.exp(-(((u - h.u) / spread) ** 2) / 2), base);
export const JAGUAR_PROFILE = { widthAt: hall(19, 'wide', .016), heightAt: hall(17, 'tall', .018) };
export const PLATEAU = { from: .17, to: .315 }, LEDGE = { from: .335, to: .47 }, FORD = .528;
// The stream falls off the plateau cliff, crosses the road at the ford and
// ends in a pond inside the valley loop.
export const STREAM = [[215,384],[205,300],[225,200],[232,120],[232,84],[205,48],[160,24]];
export const POND = { x: 152, z: 20, r: 11 };

const smoothstep = (x,a,b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// The tepui plateau, 38 m up: a gentle ramp in the cave (west) and on the
// ledge (east), a cliff in between.
export function plateauHeight(x,z) {
  const west = smoothstep(x,20,90), east = smoothstep(x,300,360);
  const lo = (95 + (380 - 95) * west) * (1 - east) + 110 * east, hi = (400 + 40 * west) * (1 - east) + 440 * east;
  return 38 * smoothstep(z, lo, hi);
}
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
  return 3+plateauHeight(x,z)+11*Math.exp(-(((x-215)/105)**2)-((z+125)/145)**2)
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

export function jaguarCaveContains(T,x,z,margin=0) {
  const n=T.nearest(x,z),u=n.s/T.TOTAL;
  return u>JAGUAR_CAVE.from-margin/T.TOTAL&&u<JAGUAR_CAVE.to+margin/T.TOTAL&&n.d<JAGUAR_PROFILE.widthAt(u)+margin;
}
