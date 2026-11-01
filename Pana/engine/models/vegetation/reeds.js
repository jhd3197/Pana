import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { stemMaterial, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

// detail 'low': the same clump with fewer sides and segments (less than half
// the triangles), for backdrops seen from afar.
export function reeds({seed=1,detail='full'}={}) {
  const r=rng(seed),g=new THREE.Group(),brown=M(0x775136,{roughness:1,flatShading:false}),low=detail==='low';
  for(let i=0;i<13;i++) {
    const a=i*2.4,spread=0.15+r()*0.5,x=Math.cos(a)*spread,z=Math.sin(a)*spread,h=1.45+r()*1.15,dx=(r()-0.5)*0.3,dz=(r()-0.5)*0.3;
    stem(g,[[x,0,z],[x+dx*0.35,h*0.55,z+dz*0.35],[x+dx,h,z+dz]],0.025,0.012,stemMaterial,low?4:8);
    if(i%3!==0) {
      const head=mesh(new THREE.CapsuleGeometry(0.073,0.32+r()*0.17,low?2:4,low?5:8),brown,x+dx,h-0.2,z+dz);g.add(head);
      stem(g,[[x+dx,h,z+dz],[x+dx,h+0.14,z+dz]],0.009,0.003,brown,3);
    }
    for(let j=0;j<3;j++) {
      const blade=leaf(g,0.9+r()*0.55,0.055,[x,0.04+j*0.13,z],[0,a+j*2,0.6+r()*0.5],i%2?0x6d974d:0x8aa555,0.23,low?4:10);
      // Narrow blades stay attached at the clump, then arch away from each culm.
      blade.rotation.x=(r()-0.5)*0.2;
    }
  }
  return finish(g,'reeds');
}
