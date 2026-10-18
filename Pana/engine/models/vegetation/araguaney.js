import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bark, TAU, finish, stem, leaf, cushion } from '/engine/models/vegetation/plant-kit.js';

// Bloom palettes for the Tabebuia family: araguaney gold, apamate pink and
// the coral of a flowering bucare share the same crown form.
const BLOOMS = {
  gold: { crown: [0xeec338, 0xf7cf42, 0xe3b42e], bud: [0xeec338, 0xf4ce45], top: 0xf5ce39, petal: [0xffdc4c], core: 0xcf8e22 },
  pink: { crown: [0xf28cc0, 0xf9a6cf, 0xe676b0], bud: [0xf28cc0, 0xf79ac8], top: 0xf7a0cb, petal: [0xffb6d9], core: 0xc4507e },
  coral: { crown: [0xf26a3c, 0xf8834a, 0xe5552e], bud: [0xf26a3c, 0xf8834a], top: 0xf47a42, petal: [0xff9a5c], core: 0xb8401f },
};

// detail 'low' keeps the silhouette and bloom colour for dense roadside use:
// coarser cushions, two flowers per branch, about a fifth of the triangles.
export function araguaney({seed=1,detail='game',bloom='gold'}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.6+r()*0.5,low=detail==='low',colors=BLOOMS[bloom]||BLOOMS.gold;
  stem(g,[[0,0,0],[0.09,1.6,0.04],[-0.12,h,0]],0.36,0.12,bark,low?6:12);
  for(let i=0;i<5;i++) {
    const a=i*TAU/5+0.3,reach=1.7+r()*0.7,x=Math.cos(a)*reach,z=Math.sin(a)*reach,y=h+0.5+r()*0.6;
    stem(g,[[0,1.4,0],[x*0.25,h-0.55,z*0.25],[x,y,z]],0.19,0.045,bark,low?4:8);
    cushion(g,[x,y+0.23,z],[1.3+r()*0.25,0.75,1.12],colors.crown[i%3],seed+i,low);
    const flowers=low?2:8;
    for(let k=0;k<flowers;k++) {
      const angle=k*TAU/flowers+r()*0.2,flower=new THREE.Group();
      if(!low)cushion(g,[x+Math.cos(angle)*1.0,y+0.16+r()*0.15,z+Math.sin(angle)*0.91],
        [0.4,0.32,0.38],k%2?colors.bud[1]:colors.bud[0],seed+k,true);
      flower.position.set(x+Math.cos(angle)*1.08,y+0.62+r()*0.25,z+Math.sin(angle)*0.97);
      flower.rotation.set(Math.sin(angle)*0.5,r()*TAU,Math.cos(angle)*0.5);
      for(let j=0;j<5;j++)leaf(flower,low?0.4:0.27,low?0.22:0.15,[0,0,0],[0,j*TAU/5,0.16],colors.petal[0],0.08,low?2:4);
      const core=mesh(new THREE.ConeGeometry(0.085,0.08,low?5:7),M(colors.core,{roughness:1}),0,0.04,0);flower.add(core);g.add(flower);
    }
    for(let k=0;k<(low?1:3);k++)leaf(g,0.5,0.13,[x,y-0.27,z],[0.1,a+k*0.8,0.24],0x5d873f,0.15,low?3:6);
  }
  cushion(g,[-0.1,h+1,0],[1.65,0.8,1.48],colors.top,seed+16,low);
  return finish(g,'araguaney');
}
