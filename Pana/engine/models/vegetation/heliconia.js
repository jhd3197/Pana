import * as THREE from 'three';
import { M, rng } from '/engine/models/core/primitives.js';
import { stemMaterial, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

// detail 'low': three stems with coarser bracts for dense roadside beds.
export function heliconia({seed=1,detail='game'}={}) {
  const r=rng(seed),g=new THREE.Group(),red=M(0xd84c32,{roughness:0.85,flatShading:false}),low=detail==='low';
  for(let i=0;i<(low?3:5);i++) {
    const a=i*2.4,x=Math.cos(a)*0.35,z=Math.sin(a)*0.35,h=1.45+r()*0.65;
    stem(g,[[x,0,z],[x,h*0.5,z],[x+0.05,h,z]],0.035,0.022,stemMaterial,low?4:8);
    for(let j=0;j<(low?4:5);j++) {
      const side=j%2?-1:1,y=h-0.67+j*0.17,bract=new THREE.Group();bract.position.set(x,y,z);bract.rotation.y=a;g.add(bract);
      const points=[[0,0,0],[side*0.19,0.02,0],[side*0.36,0.23,0]];
      stem(bract,points,0.085,0.015,red,low?4:6);
      if(!low)stem(bract,[[side*0.29,0.13,0],[side*0.36,0.23,0],[side*0.37,0.27,0]],0.03,0.003,M(0xf5be38,{roughness:1}),4);
    }
    const leaves=new THREE.Group();leaves.position.set(x,0.5+i*0.12,z);leaves.rotation.y=a;
    leaf(leaves,1.3+r()*0.35,0.27,[0,0,0],[0,0,0.65],i%2?0x559c4c:0x327d49,0.23,low?4:10);g.add(leaves);
  }
  return finish(g,'heliconia');
}
