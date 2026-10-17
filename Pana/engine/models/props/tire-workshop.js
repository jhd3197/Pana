// Roadside service bay with a giant tire sign, jack, rack and compressor.
import * as THREE from 'three';
import { M, mesh, box, tube } from '../core/primitives.js';
import { finish, curve } from '../core/architecture-kit.js';

export function tireWorkshop() {
  const g=new THREE.Group(),yellow=M(0xe0b447),teal=M(0x377f80),cream=M(0xe5d5b1),rubber=M(0x2f4246),steel=M(0x7e9693,{metalness:.45}),red=M(0xbe624c);
  const tire=(x,y,z,r=.65)=>{const o=mesh(new THREE.TorusGeometry(r,r*.32,8,20),rubber,x,y,z);g.add(o);return o;};
  g.add(box(11.5,.22,8.8,cream,0,.11,0));
  g.add(box(10.5,4.7,.28,teal,0,2.57,-3.8),box(.28,4.7,7.6,teal,-5.1,2.57,0));
  for(const x of [-5.1,1.4,5.1])g.add(box(.28,5,.28,yellow,x,2.72,3.45));
  const roof=box(11.8,.22,9.2,red,0,5.3,-.15);roof.rotation.x=-.06;g.add(roof);
  for(let x=-5.6;x<5.8;x+=.58){const rib=box(.045,.07,9.15,cream,x,5.47,-.15);rib.rotation.x=-.06;g.add(rib);}
  g.add(box(11.2,.85,.3,yellow,0,4.9,4.05));
  tire(0,5.95,4.26,.9);g.add(mesh(new THREE.CircleGeometry(.48,20),cream,0,5.95,4.27));
  // Three shelf levels of recognizable upright tires.
  for(const y of [1,2.3,3.6]) {
    g.add(box(2.4,.13,1,steel,3.5,y,-2.8));
    for(const x of [2.95,4.05])tire(x,y+.5,-2.8,.4);
  }
  for(const x of [2.2,4.8])g.add(box(.1,4.1,.1,steel,x,2.28,-3.25));
  g.add(box(3.4,1.1,1.2,teal,-2.8,.78,-2.9),box(3.6,.16,1.4,cream,-2.8,1.4,-2.9));
  for(let i=0;i<4;i++)g.add(box(.65,.08,.05,yellow,-4+i*.8,1.1,-2.27));
  const tank=mesh(new THREE.CylinderGeometry(.5,.5,1.5,16),red,3.7,1.1,1.2);tank.rotation.z=Math.PI/2;g.add(tank);
  g.add(box(.65,.45,.55,steel,3.7,1.8,1.2));
  for(const x of [3.2,4.2]) {const wheel=mesh(new THREE.CylinderGeometry(.16,.16,.15,10),rubber,x,.43,1.2);wheel.rotation.x=Math.PI/2;g.add(wheel);}
  g.add(curve([[3.5,1.9,1.4],[2.7,.4,2],[1.8,.3,1.6],[1.5,.3,.7],[2.3,.3,.3]],.045,rubber,18));
  // Empty jack and lift arms keep this usable as scenery without a fake racer.
  g.add(box(.85,.18,1.7,red,-1,.38,1.2),tube([-1,.5,.8],[-1,1.3,1.9],.1,steel),tube([-1,.55,.4],[-1,1.7,-.3],.045,rubber));
  const plate=mesh(new THREE.CylinderGeometry(.33,.33,.12,12),steel,-1,1.36,1.9);g.add(plate);
  for(const x of [-3,-.3])g.add(box(.14,.025,4.6,yellow,x,.235,.1));
  const loose=tire(-4.1,.52,2.5,.65);loose.rotation.x=Math.PI/2;
  const out=finish(g,'tire-workshop');out.userData.assetId='tire-workshop';return out;
}
