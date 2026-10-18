import { THREE,M,mesh,pathDistance } from './world-kit.js';
import { TOWN_STREETS,smooth } from './puerto-layout.js';

// One tessellated surface for the whole street network. Overlapping wide ribbons
// intersected one another and the terraced terrain between their two outer edges.
export function puertoStreets(T,ground) {
  const distances=TOWN_STREETS.map(pathDistance);
  const distance=(x,z)=>Math.min(...distances.map(d=>d(x,z)));
  const positions=[],colors=[],cache=new Map();
  const asphalt=new THREE.Color(0x8b9290),paving=new THREE.Color(0xd7c6a1);
  function vertex(x,z) {
    const key=`${x},${z}`;
    if(!cache.has(key)) {
      const off=Math.abs(T.offsetOf(x,z)),y=ground(x,z)+.22+.35*(1-smooth(off,T.HW+2,T.HW+12));
      cache.set(key,{x,y,z,off});
    }
    return cache.get(key);
  }
  // A two-metre grid samples both axes; classify each cell once at junctions.
  for(let z=-390;z<-10;z+=2)for(let x=-469;x<301;x+=2) {
    const d=distance(x+1,z+1);if(d>8)continue;
    const a=vertex(x,z),b=vertex(x+2,z),c=vertex(x,z+2),e=vertex(x+2,z+2);
    if([a,b,c,e].some(p=>p.off<T.HW-1))continue;
    const color=d<5.5?asphalt:paving;
    for(const p of [a,c,b,b,c,e]) {positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const group=mesh(geo,M(0xffffff,{vertexColors:true,roughness:1,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  group.name='puerto-town-streets';return {group,distance};
}
