// Selva's physical world boundary: trunks, banks, water and the tunnel masonry.
// No snapping or steering toward the racing spline on ordinary grass.
import { TUNNEL, riverDistance } from './selva-layout.js';
import { tunnelRoofHeight } from './selva-temple.js';

export function jungleDriving(T,height,plants,reservations) {
  const radii={ceiba:0.8,jungleGiant:2.4,palm:0.25,papaya:0.22,araguaney:0.4,bamboo:0.65,mangrove:0.4};
  const colliders=plants.filter(p=>p.zone!=='roof'&&radii[p.kind]).map(p=>({x:p.x,z:p.z,
    radius:radii[p.kind]*p.scale,base:p.y,top:p.y+7*p.scale,kind:p.kind}));
  colliders.push(...reservations.map(p=>({...p,radius:p.r,base:height(p.x,p.z)-2,top:height(p.x,p.z)+22,kind:'ruin'})));
  const cells=new Map(),cellSize=24;
  for(const p of colliders) {
    const radius=p.radius+1.5;
    for(let x=Math.floor((p.x-radius)/cellSize);x<=Math.floor((p.x+radius)/cellSize);x++)for(let z=Math.floor((p.z-radius)/cellSize);z<=Math.floor((p.z+radius)/cellSize);z++) {
      const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);
    }
  }
  function blocked(x,z,c,previous) {
    const off=Math.abs(T.offsetOf(x,z));
    if(off<=T.HW-1.4)return false;
    const s=T.paramOf(x,z),u=s/T.TOTAL;
    if(u>TUNNEL.from-0.004&&u<TUNNEL.to+0.004&&c.y<T.heightAtS(s)+tunnelRoofHeight(off)+1) {
      // Only the physical shell blocks movement, not its projection across
      // the whole valley. Allow escape if a car starts inside the masonry.
      const depth=value=>Math.max(0,Math.min(value-TUNNEL.halfWidth+1.5,41.5-value));
      if(depth(off)>depth(Math.abs(T.offsetOf(previous.x,previous.z))))return true;
    }
    for(const p of cells.get(`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`)||[]) {
      if(c.y>p.top||c.y+3<p.base)continue;
      const distance=Math.hypot(x-p.x,z-p.z);
      if(distance<p.radius+1.5&&distance<Math.hypot(previous.x-p.x,previous.z-p.z))return true;
    }
    if(off<T.HW+0.3)return false;
    const here=height(x,z);
    // Grounded vehicles cannot drive up a cliff. A legitimate ramp jump keeps
    // its flight; it does not collide with terrain far beneath the car.
    if(c.y>here+3)return false;
    // A car that lands in water can still move toward either bank; equal-depth
    // riverbed triangles must not trap it after a jump or another car's shove.
    if(here<-0.25&&riverDistance(x,z)<=riverDistance(previous.x,previous.z))return true;
    const dx=x-previous.x,dz=z-previous.z,length=Math.hypot(dx,dz);
    return length>1e-5&&height(x+dx/length*1.4,z+dz/length*1.4)-here>1.1;
  }
  function constrainMotion(c,previous) {
    if(!blocked(c.x,c.z,c,previous))return;
    const x=c.x,z=c.z;
    // Slide along the obstacle while removing the blocked velocity component.
    // Escape from an overlap is allowed, including reversing away from a trunk.
    if(!blocked(x,previous.z,c,previous)) {c.z=previous.z;c.vz=0;}
    else if(!blocked(previous.x,z,c,previous)) {c.x=previous.x;c.vx=0;}
    else {c.x=previous.x;c.z=previous.z;c.vx=0;c.vz=0;}
  }
  return {colliders,constrainMotion};
}
