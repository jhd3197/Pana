import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { TAU, finish, stem, leaf, cushion } from '/engine/models/vegetation/plant-kit.js';

export function tropicalBush({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),red=M(0xd8333b,{roughness:0.8,flatShading:false});
  for(let i=0;i<3;i++) {const a=i*TAU/3+r();cushion(g,[Math.cos(a)*0.4,0.4,Math.sin(a)*0.4],[0.55,0.35,0.5],0x2e6139,seed+i);}
  for(let i=0;i<30;i++) {
    const a=i*2.4+r()*0.3,tier=i%3,reach=0.45+tier*0.25,y=0.55+tier*0.45+r()*0.2,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[x*0.3,0.2,z*0.3],[x*0.7,y*0.8,z*0.7],[x,y,z]],0.03,0.015);
    const tint=i%6===0?0xc0a648:i%2?0x286c42:0x50974b;
    const blade=leaf(g,0.85+r()*0.35,0.3+r()*0.12,[x,y,z],[0.15*Math.sin(a),-a,0.3-tier*0.32],tint,0.28,12);
    const p=blade.geometry.attributes.position,c=blade.geometry.attributes.color;
    for(let j=0;j<p.count;j++) {
      const t=Math.floor(j/3)/12,edge=j%3!==1;
      p.setY(j,p.getY(j)+(edge?Math.sin(t*Math.PI*4)*0.035:0));
      if(!edge || (i%6===0 && Math.floor(t*12)%3===0))c.setXYZ(j,0.48,0.61,0.23);
    }
    blade.geometry.computeVertexNormals();
  }
  for(let i=0;i<4;i++) {
    const a=i*TAU/4+0.6,x=Math.cos(a)*0.75,z=Math.sin(a)*0.75,top=1.6+r()*0.4;
    stem(g,[[x*0.4,0.3,z*0.4],[x*0.8,top*0.7,z*0.8],[x,top,z]],0.025,0.015);
    for(let j=0;j<6;j++) for(let k=0;k<3;k++) {
      const a=k*TAU/3+j*1.1,radius=0.1*(1-j*0.1);
      const bract=mesh(new THREE.SphereGeometry(1,8,6),red,x+Math.cos(a)*radius,top+j*0.085,z+Math.sin(a)*radius);
      bract.scale.set(0.07*(1-j*0.08),0.12,0.07);bract.rotation.z=Math.cos(a)*0.35;g.add(bract);
    }
  }
  return finish(g,'tropicalBush');
}
