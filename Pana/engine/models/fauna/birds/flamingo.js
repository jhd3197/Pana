// Wading flamingo, feet at y=0, looking +Z. Static poses can be instanced.
import * as THREE from 'three';
import { M, mesh, tube } from '../../core/primitives.js';
import { curve, finish } from '../../core/architecture-kit.js';

export function flamingo({pose='stand',seed=1}={}) {
  const g=new THREE.Group(),pink=M(0xeaa49e),wing=M(0xcf797f),leg=M(0xa76b67),cream=M(0xf2d8b8),black=M(0x34464b);
  const oval=(x,y,z,sx,sy,sz,material)=>{const o=mesh(new THREE.SphereGeometry(1,14,9),material,x,y,z);o.scale.set(sx,sy,sz);g.add(o);return o;};
  oval(0,1.28,0,.3,.34,.57,pink);
  for(const side of [-1,1]) {
    oval(side*.25,1.3,-.06,.11,.25,.43,wing);
    const knee=side===-1&&seed%3===0?.22:0;
    g.add(tube([side*.12,1.17,-.05],[side*.13,.59,-.13-knee],.025,leg),tube([side*.13,.59,-.13-knee],[side*.13,.055,.03],.022,leg));
    for(const toe of [-1,0,1])g.add(tube([side*.13,.045,.03],[side*.13+toe*.09,.025,.21],.018,leg));
  }
  const feeding=pose==='feed',head=feeding?[0,.28,.91]:[0,2.22,.38];
  const points=feeding?[[0,1.32,.39],[0,1.46,.66],[0,1.12,.87],[0,.62,.81],head]:[[0,1.37,.37],[0,1.7,.5],[0,1.87,.24],[0,2.11,.18],head];
  g.add(curve(points,.09,pink,20));oval(...head,.15,.15,.19,pink);
  const h=new THREE.Vector3(...head),beakBase=h.clone().add(new THREE.Vector3(0,-.03,.2)),tip=h.clone().add(new THREE.Vector3(0,-.22,.31));
  g.add(tube(h.toArray(),beakBase.toArray(),.08,cream),tube(beakBase.toArray(),tip.toArray(),.065,black));
  for(const side of [-1,1]) {
    oval(side*.135,head[1]+.03,head[2]+.075,.018,.025,.024,cream);
    oval(side*.15,head[1]+.03,head[2]+.08,.009,.015,.013,black);
  }
  const tail=mesh(new THREE.ConeGeometry(.13,.35,8),wing,0,1.36,-.61);tail.rotation.x=-Math.PI/2;g.add(tail);
  const out=finish(g,'flamingo');out.userData.assetId='flamingo';return out;
}
