// Small reusable cave details; the game owns its hollow shell and camera space.
import * as THREE from 'three';
import { M, mesh, tube, rng } from '../core/primitives.js';
export function stalactiteCluster({seed=56,length=4}={}) {
  const g=new THREE.Group(),r=rng(seed),stone=M(0x8b968c,{roughness:.9});
  for(let i=0;i<9;i++){
    const h=length*(.35+r()*.65),p=mesh(new THREE.ConeGeometry(.2+r()*.5,h,6),stone,(r()-.5)*5,-h/2,(r()-.5)*3);
    p.rotation.z=Math.PI;g.add(p);
  }
  g.name='stalactite-cluster';return g;
}
export function rootCurtain({seed=57,length=7,width=8}={}) {
  const g=new THREE.Group(),r=rng(seed),root=M(0x796a48),leaf=M(0x698758);
  for(let i=0;i<12;i++){
    const x=(r()-.5)*width,h=length*(.5+r()*.5),z=(r()-.5)*1.5;
    const points=Array.from({length:7},(_,j)=>[x+Math.sin(j+seed+i)*.15,-h*j/6,z+Math.sin(j*.8)*.22]);
    for(let j=1;j<points.length;j++)g.add(tube(points[j-1],points[j],.04+r()*.025,root));
    for(let j=1;j<5;j++){const p=mesh(new THREE.IcosahedronGeometry(.22,0),leaf,...points[j]);p.scale.set(1,.35,1.4);g.add(p);}
  }
  g.name='root-curtain';return g;
}
