import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { TAU, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

export function frailejon({seed=51,h=1.5}={}) {
  if(!Number.isFinite(h)||h<0.8||h>3.5)throw new RangeError('Frailejón height must be between 0.8 and 3.5');
  const r=rng(seed),g=new THREE.Group(),dead=M(0x8c8064,{roughness:1,flatShading:false});
  g.add(mesh(new THREE.CylinderGeometry(0.15,0.23,h,12,5),dead,0,h/2,0));
  for(let i=0;i<48;i++) {
    const a=i*2.4, y=0.48+r()*Math.max(0.05,h-0.6);
    leaf(g,0.28+r()*0.18,0.07,[Math.cos(a)*0.15,y,Math.sin(a)*0.15],[0,-a,-1.25],i%2?0x8a8067:0xa39877,0.03,5);
  }
  for(let tier=0;tier<3;tier++)for(let i=0;i<11;i++) {
    const a=i*TAU/11+tier*0.33, length=0.92-tier*0.2+r()*0.15;
    const blade=leaf(g,length,0.16-tier*0.025,[0,h-0.12+tier*0.12,0],[0,-a,-0.15+tier*0.52],i%3?0xa5b7a0:0xc1c7aa,0.18,12);
    const colors=blade.geometry.attributes.color;
    for(let j=0;j<colors.count;j++) {
      const mottling=0.94+r()*0.08;
      colors.setXYZ(j,colors.getX(j)*mottling,colors.getY(j)*mottling,colors.getZ(j)*mottling);
    }
  }
  const flower=M(0xe6ba42,{roughness:1,flatShading:false}),heart=M(0x846738,{roughness:1});
  for(let i=0;i<3;i++) {
    const a=i*TAU/3+0.5,x=Math.cos(a)*0.42,z=Math.sin(a)*0.42,y=h+0.6+r()*0.3;
    stem(g,[[0,h*0.6,0],[x*0.5,h+0.1,z*0.5],[x,y,z]],0.035,0.018,dead,10);
    for(let j=0;j<3;j++) {
      const b=j*TAU/3,fx=x+Math.cos(b)*0.16,fz=z+Math.sin(b)*0.16;
      stem(g,[[x,y-0.16,z],[fx,y+0.08,fz]],0.015,0.009,dead,3);
      g.add(mesh(new THREE.SphereGeometry(0.06,8,6),heart,fx,y+0.1,fz));
      for(let k=0;k<9;k++) {
        const angle=k*TAU/9,petal=mesh(new THREE.SphereGeometry(1,6,4),flower,fx+Math.cos(angle)*0.08,y+0.1,fz+Math.sin(angle)*0.08);
        petal.scale.set(0.075,0.018,0.033);petal.rotation.y=-angle;g.add(petal);
      }
    }
  }
  return finish(g,'frailejon');
}
