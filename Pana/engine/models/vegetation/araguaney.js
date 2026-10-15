import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bark, TAU, finish, stem, leaf, cushion } from '/engine/models/vegetation/plant-kit.js';

export function araguaney({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.6+r()*0.5;
  stem(g,[[0,0,0],[0.09,1.6,0.04],[-0.12,h,0]],0.36,0.12,bark,12);
  for(let i=0;i<5;i++) {
    const a=i*TAU/5+0.3,reach=1.7+r()*0.7,x=Math.cos(a)*reach,z=Math.sin(a)*reach,y=h+0.5+r()*0.6;
    stem(g,[[0,1.4,0],[x*0.25,h-0.55,z*0.25],[x,y,z]],0.19,0.045,bark);
    cushion(g,[x,y+0.23,z],[1.3+r()*0.25,0.75,1.12],[0xeec338,0xf7cf42,0xe3b42e][i%3],seed+i);
    for(let k=0;k<8;k++) {
      const angle=k*TAU/8+r()*0.2,flower=new THREE.Group();
      cushion(g,[x+Math.cos(angle)*1.0,y+0.16+r()*0.15,z+Math.sin(angle)*0.91],
        [0.4,0.32,0.38],k%2?0xf4ce45:0xeec338,seed+k,true);
      flower.position.set(x+Math.cos(angle)*1.08,y+0.62+r()*0.25,z+Math.sin(angle)*0.97);
      flower.rotation.set(Math.sin(angle)*0.5,r()*TAU,Math.cos(angle)*0.5);
      for(let j=0;j<5;j++)leaf(flower,0.27,0.15,[0,0,0],[0,j*TAU/5,0.16],0xffdc4c,0.08,4);
      const core=mesh(new THREE.ConeGeometry(0.085,0.08,7),M(0xcf8e22,{roughness:1}),0,0.04,0);flower.add(core);g.add(flower);
    }
    for(let k=0;k<3;k++)leaf(g,0.5,0.13,[x,y-0.27,z],[0.1,a+k*0.8,0.24],0x5d873f);
  }
  cushion(g,[-0.1,h+1,0],[1.65,0.8,1.48],0xf5ce39,seed+16);
  return finish(g,'araguaney');
}
