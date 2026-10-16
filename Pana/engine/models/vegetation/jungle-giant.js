import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { TAU, finish, stem, leaf, cushion } from '/engine/models/vegetation/plant-kit.js';

export function jungleGiant({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=11.5+r()*1.5;
  const trunk=new THREE.CylinderGeometry(1,1,1,22,16),p=trunk.attributes.position,colors=[];
  const low=new THREE.Color(0x66563b),high=new THREE.Color(0xa69771);
  for(let i=0;i<p.count;i++) {
    const t=p.getY(i)+0.5,x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x);
    const ridge=Math.pow(Math.max(0,Math.cos(a*6+seed)),3);
    const radius=0.92-t*0.42+Math.pow(1-t,5)*(0.45+ridge*0.55)+ridge*0.05;
    p.setXYZ(i,x*radius+Math.sin(t*Math.PI*0.8)*0.3,t*h,z*radius);
    const c=low.clone().lerp(high,THREE.MathUtils.clamp(0.3+t*0.45+ridge*0.12+Math.sin(t*40+a*3)*0.04,0,1));colors.push(c.r,c.g,c.b);
  }
  trunk.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));trunk.computeVertexNormals();
  g.add(mesh(trunk,M(0xffffff,{vertexColors:true,flatShading:false,roughness:1})));
  // Thin plank buttresses fan out from the base like the walls of a room.
  const fin=M(0x7a6646,{flatShading:false,roughness:1});
  for(let i=0;i<6;i++) {
    const a=i*TAU/6+r()*0.4,reach=2.4+r()*1.1,rise=2.6+r()*1.2,shape=new THREE.Shape();
    shape.moveTo(0.45,0);shape.lineTo(reach,0);shape.quadraticCurveTo(1.1,0.35,0.55,rise);shape.lineTo(0.35,rise);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:0.22,bevelEnabled:true,bevelSize:0.04,bevelThickness:0.04,bevelSegments:1,curveSegments:8});geo.translate(0,0,-0.11);
    const m=mesh(geo,fin);m.rotation.y=-a;g.add(m);
  }
  const tints=[0x4f8d3e,0x5f9a45,0x3f7d3a],vine=M(0x5d6b3a,{flatShading:false,roughness:1});
  for(let i=0;i<5;i++) {
    const a=i*TAU/5+r()*0.5,reach=3.4+r()*1.4,y=h+1.2+r()*1.6,x=Math.cos(a)*reach,z=Math.sin(a)*reach,tint=tints[i%3];
    stem(g,[[0.25,h*0.82,0],[x*0.45,h+0.4,z*0.45],[x,y,z]],0.42,0.12,fin,10);
    cushion(g,[x,y+0.55,z],[2.35+r()*0.5,1.25,2.2+r()*0.4],tint,seed+i);
    cushion(g,[x*1.3,y+0.1,z*1.3],[1.4,0.7,1.3],tints[(i+1)%3],seed+i+9,true);
    for(let j=0;j<7;j++) {
      const angle=j*TAU/7+a,tx=x+Math.cos(angle)*2.05,tz=z+Math.sin(angle)*1.95,ty=y+0.3+r()*0.65;
      cushion(g,[tx,ty,tz],[0.65+r()*0.2,0.48+r()*0.15,0.6+r()*0.2],tints[(i+j)%3],seed+i*7+j,true);
      for(let k=0;k<3;k++)leaf(g,0.48,0.16,[tx,ty+0.3,tz],[0.3,-angle+k*0.5,0.3],k===0?0x8bae51:tint,0.1,5);
    }
    // Lianas drop from each limb; leaves alternate along their length.
    for(let k=0;k<2;k++) {
      const sx=x*(0.55+k*0.4),sz=z*(0.55+k*0.4),len=4+r()*4.5,top=y-0.2;
      const pts=Array.from({length:6},(_,j)=>[sx+Math.sin(j*1.1+seed+k)*0.25,top-len*j/5,sz+Math.cos(j*0.9+i)*0.2]);
      stem(g,pts,0.05,0.03,vine,12);
      for(let j=1;j<6;j++)leaf(g,0.36,0.13,[pts[j][0],pts[j][1]+len*0.08,pts[j][2]],[0,j*2.1+i,-1.1],0x4f8d3e,0.05,4);
    }
    // Bromeliad rosette in the fork.
    const bx=x*0.45,by=h+0.55,bz=z*0.45;
    for(let j=0;j<7;j++)leaf(g,0.55,0.12,[bx,by,bz],[0,j*TAU/7,0.8],j%2?0xc0473a:0x6a9a3f,0.12,5);
  }
  cushion(g,[0.4,h+3.2,0],[3.4,1.5,3.2],0x5a9743,seed+40);
  for(let i=0;i<6;i++) {const a=i*TAU/6+0.5,x=Math.cos(a)*2.4,z=Math.sin(a)*2.4;cushion(g,[x,h+2.2+r()*0.8,z],[2.0,0.95,1.9],tints[i%3],seed+50+i);}
  cushion(g,[-1.2,h+2.4,1.4],[2.2,1.0,2.0],0x4f8d3e,seed+41);
  return finish(g,'jungleGiant');
}
