// A horse-sized circuit. Pure geometry shared by simulation, scenery and minimap.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrap = (v, n) => (v % n + n) % n;
export const angle = v => Math.atan2(Math.sin(v), Math.cos(v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const HALF_WIDTH = 4.8;
export const LAPS = 2;
// Start midway down the ranch straight, with a gentle run-up for the whole grid.
const nodes = [[-19,55],[25,49],[63,35],[78,5],[65,-23],[30,-29],[15,-58],[-18,-72],[-57,-59],[-74,-29],[-46,-5],[-65,22],[-63,51]];
const curve = t => {
  const k = Math.floor(t), u = t - k, p = [-1,0,1,2].map(i => nodes[wrap(k+i,nodes.length)]);
  return [0,1].map(axis => .5 * (2*p[1][axis] + (-p[0][axis]+p[2][axis])*u + (2*p[0][axis]-5*p[1][axis]+4*p[2][axis]-p[3][axis])*u*u + (-p[0][axis]+3*p[1][axis]-3*p[2][axis]+p[3][axis])*u*u*u));
};
export const samples = [];
let length = 0;
for (let i=0;i<=520;i++) {
  const [x,z] = curve(i/520*nodes.length);
  if(i) length += Math.hypot(x-samples[i-1].x,z-samples[i-1].z);
  samples.push({x,z,s:length});
}
export const LENGTH = length;
export function at(s, offset=0) {
  s = wrap(s,LENGTH);
  let lo=0,hi=samples.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].s<s)lo=mid;else hi=mid;}
  const a=samples[lo],b=samples[hi],t=(s-a.s)/(b.s-a.s),h=Math.atan2(b.x-a.x,b.z-a.z);
  return {x:a.x+(b.x-a.x)*t+Math.cos(h)*offset,z:a.z+(b.z-a.z)*t-Math.sin(h)*offset,h,s};
}
export function nearest(x,z) {
  let best={distance:Infinity};
  for(let i=0;i<samples.length-1;i++) {
    const a=samples[i],b=samples[i+1],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+dx*t,pz=a.z+dz*t,d2=(x-px)**2+(z-pz)**2;
    if(d2<best.distance)best={x:px,z:pz,distance:d2,s:a.s+(b.s-a.s)*t,h:Math.atan2(dx,dz)};
  }
  best.distance=Math.sqrt(best.distance);
  best.offset=(x-best.x)*Math.cos(best.h)-(z-best.z)*Math.sin(best.h);
  return best;
}
// Each connected depression has one water surface and a smooth, wadeable bed.
export const WETLANDS = [
  {x:56,z:42,rx:25,rz:19,name:'Paso del estero'},
  {x:-62,z:-31,rx:22,rz:22,name:'Bajo del morichal'},
];
export const WATER_Y = .68;
export function groundAt(x,z) {
  let y=1.16+.15*Math.sin(x*.055)*Math.cos(z*.065);
  for(const w of WETLANDS) {
    const r=Math.hypot((x-w.x)/w.rx,(z-w.z)/w.rz);
    y=Math.min(y,.12+1.08*smooth(.42,1.18,r));
  }
  return y;
}
export function waterDepth(x,z) {return Math.max(0,WATER_Y-groundAt(x,z));}
export const JUMPS = [.26,.59,.82].map((u,i)=>({s:u*LENGTH,height:.5,id:i}));
export const SECTORS = [[0,'Hato Pana'],[.16,'Paso del estero'],[.32,'Potrero abierto'],[.5,'Sabana del sol'],[.69,'Bajo del morichal'],[.87,'Recta del hato']];
export function sector(s){const u=wrap(s,LENGTH)/LENGTH;return SECTORS.filter(([v])=>u>=v).at(-1)[1];}
export function formatTime(seconds) {return `${Math.floor(seconds/60)}:${(seconds%60).toFixed(2).padStart(5,'0')}`;}
// The Studio tour reads this same route; it owns no gameplay state.
export const courseRoute={id:'galope',TOTAL:LENGTH,LINE:0,ramps:[],groundAt,offsetOf:(x,z)=>nearest(x,z).offset,def:{palette:{horizon:0xd6dfc2,skyTop:0x508fb9,cloudCover:.56,skySeed:19,fog:[110,290]}},
  pointAt(s){const p=at(s);return {x:p.x,y:p.z};},
  heightAtS(s){const p=at(s);return groundAt(p.x,p.z);}
};
