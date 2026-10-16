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
// Two different landforms, not scaled copies of a pond. Tapered channels blend
// continuously into coves; the same signed field drives terrain, water and plants.
export const WETLANDS = [
  {x:56,z:42,name:'Laguna del Hato',kind:'lagoon',
    channel:[[43,44,10],[57,42,16],[75,53,17],[89,70,24],[111,77,17],[125,69,10]],
    islands:[{x:94,z:74,rx:6.8,rz:4.5}]},
  {x:-62,z:-31,name:'Caño del Morichal',kind:'creek',
    channel:[[-53,-13,6],[-62,-30,14],[-81,-35,8],[-101,-47,10],[-99,-64,6],[-89,-78,7],[-106,-91,11],[-122,-96,5]],
    islands:[]},
];
export const WATER_Y = .68;
export function wetlandDistance(w,x,z) {
  let d=Infinity;
  for(let i=1;i<w.channel.length;i++){
    const a=w.channel[i-1],b=w.channel[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
    const next=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/(a[2]+(b[2]-a[2])*t);
    // Smooth union prevents pinched joins between channel segments.
    const h=Math.max(.18-Math.abs(d-next),0)/.18;
    d=Math.min(d,next)-h*h*.045;
  }
  return d+(Math.sin(x*.23+z*.15)+.5*Math.sin(z*.43-x*.19))*.055;
}
export function groundAt(x,z) {
  let y=1.16+.15*Math.sin(x*.055)*Math.cos(z*.065);
  for(const w of WETLANDS) {
    y=Math.min(y,.12+1.08*smooth(.42,1.18,wetlandDistance(w,x,z)));
  }
  for(const w of WETLANDS)for(const island of w.islands){
    const r=Math.hypot((x-island.x)/island.rx,(z-island.z)/island.rz);
    y=Math.max(y,.12+1.14*(1-smooth(.3,1.55,r)));
  }
  return y;
}
export function waterDepth(x,z) {return Math.max(0,WATER_Y-groundAt(x,z));}
export const JUMPS = [.26,.59,.82].map((u,i)=>({s:u*LENGTH,height:.5,id:i}));
export const SECTORS = [[0,'Hato Pana'],[.16,'Laguna del Hato'],[.32,'Potrero abierto'],[.5,'Sabana del sol'],[.69,'Caño del Morichal'],[.87,'Recta del hato']];
export function sector(s){const u=wrap(s,LENGTH)/LENGTH;return SECTORS.filter(([v])=>u>=v).at(-1)[1];}
export function formatTime(seconds) {return `${Math.floor(seconds/60)}:${(seconds%60).toFixed(2).padStart(5,'0')}`;}
// The Studio tour reads this same route; it owns no gameplay state.
export const DAYLIGHT={horizon:0xb4e0ed,skyTop:0x238bce,cloudCover:.34,skySeed:19,hemiSky:0xe4f5ff,hemiGround:0x588343,hemiInt:1.5,sun:0xfff1d5,sunInt:2.3,fog:[145,340]};
export const courseRoute={id:'galope',TOTAL:LENGTH,LINE:0,ramps:[],groundAt,offsetOf:(x,z)=>nearest(x,z).offset,def:{palette:DAYLIGHT},
  pointAt(s){const p=at(s);return {x:p.x,y:p.z};},
  heightAtS(s){const p=at(s);return groundAt(p.x,p.z);}
};
