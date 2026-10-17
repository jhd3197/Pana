// Open waterfront repair shed. Ground origin, open bow/entrance toward +Z.
import * as THREE from 'three';
import { M, mesh, box, tube } from '../core/primitives.js';
import { finish } from '../core/architecture-kit.js';
import { fishingBoat } from './coastal.js';

export function boatRepairYard() {
  const g=new THREE.Group(),wood=M(0x947451),dark=M(0x554b3e),roof=M(0xb46c4d),cream=M(0xe4d1a6),teal=M(0x438b91),steel=M(0x6c8180,{metalness:.35});
  g.add(box(11.5,.22,11,cream,0,.11,0));
  for(const x of [-4.8,4.8])for(const z of [-4.3,0,4.3]) {
    g.add(box(.28,5.8,.28,wood,x,3.12,z),box(.65,.3,.65,dark,x,.37,z));
    g.add(tube([x,4.1,z],[x-Math.sign(x)*1.1,5.9,z],.075,wood));
  }
  for(const z of [-4.3,0,4.3])g.add(box(10,.24,.24,wood,0,5.87,z));
  for(const side of [-1,1]) {
    const panel=box(5.8,.12,10.3,roof,side*2.7,6.6,0);panel.rotation.z=-side*.24;g.add(panel);
    for(let z=-4.8;z<5;z+=.65)g.add(tube([side*.1,7.25,z],[side*5.5,5.93,z],.035,cream));
  }
  for(let i=0;i<14;i++)g.add(box(.62,3.2,.14,i%3?wood:teal,-4.55+i*.7,1.85,-4.3));
  // Rails and a raised timber cradle support the canonical peñero.
  for(const x of [-1.25,1.25])g.add(box(.14,.16,9.8,steel,x,.38,.5));
  for(const z of [-2.3,.4,2.5]) {
    g.add(box(3.7,.2,.45,wood,0,.85,z));
    for(const side of [-1,1])g.add(tube([side*1.3,.45,z],[side*.65,1.35,z],.12,dark));
  }
  const boat=fishingBoat({color:0x418fa4});boat.scale.setScalar(1.12);boat.position.set(0,1.1,.45);g.add(boat);
  g.add(box(1.5,1.2,4.2,wood,3.4,.85,-1.4),box(1.7,.12,4.4,cream,3.4,1.52,-1.4));
  for(const [i,color]of [0xba674d,0x448e87,0xd7b657].entries()) {
    g.add(mesh(new THREE.CylinderGeometry(.25,.25,.55,12),M(color),3.35,1.86,-2.6+i*.8));
    g.add(mesh(new THREE.TorusGeometry(.27,.025,5,12),steel,3.35,2.14,-2.6+i*.8));g.children.at(-1).rotation.x=Math.PI/2;
  }
  g.add(box(2,.95,.15,wood,-3.2,3.2,-4.16));
  for(let i=0;i<4;i++) {const x=-3.8+i*.42;g.add(tube([x,2.83,-4.02],[x,3.5,-4.02],.035,steel),box(.23,.09,.08,steel,x,3.48,-4.02));}
  // Hand winch at the back of the slipway; no live scene or network animation.
  const spool=mesh(new THREE.CylinderGeometry(.36,.36,.7,12),dark,0,1.4,-4.45);spool.rotation.z=Math.PI/2;g.add(spool);
  for(const x of [-.5,.5])g.add(box(.1,1.3,.45,steel,x,.87,-4.45));
  g.add(tube([0,1.4,-4.2],[0,1.6,-3],.025,cream));
  const out=finish(g,'boat-repair-yard');out.userData.assetId='boat-repair-yard';return out;
}
