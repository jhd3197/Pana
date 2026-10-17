// Small working salt yard: feed hopper, inclined belt, piles and bagged harvest.
import * as THREE from 'three';
import { M, mesh, box, tube } from '../core/primitives.js';
import { finish } from '../core/architecture-kit.js';
import { saltPile } from './saltworks.js';

export function saltHarvester() {
  const g=new THREE.Group(),teal=M(0x4b8c87),rust=M(0xb56d4d),steel=M(0x687d7b,{metalness:.3}),belt=M(0x354b4d),salt=M(0xece4cd),sack=M(0xcbb583),wood=M(0x937650);
  g.add(box(14,.18,11,M(0xccbea0),0,.09,0));
  const lift=new THREE.Group();lift.position.set(0,3.4,0);lift.rotation.z=Math.atan2(4,8);
  lift.add(box(9.35,.25,1.6,belt));
  for(const z of [-.95,.95])lift.add(box(9.6,.35,.16,teal,0,0,z));
  for(let i=0;i<13;i++) {
    const x=-4.4+i*.73,roller=mesh(new THREE.CylinderGeometry(.19,.19,1.8,10),steel,x,-.13,0);roller.rotation.x=Math.PI/2;lift.add(roller);
    lift.add(box(.12,.1,1.52,salt,x,.18,0));
  }
  g.add(lift);
  for(const [x,h]of [[-3,1.9],[2.8,4.8]])for(const z of [-1,1]) {
    g.add(box(.16,h,.16,teal,x,h/2+.18,z),box(.65,.15,.6,steel,x,.25,z));
    g.add(tube([x-1,.25,z],[x,h+.18,z],.065,teal));
  }
  const hopper=mesh(new THREE.CylinderGeometry(1.75,.55,2.05,4,1,true),rust,-4,2.7,0);hopper.rotation.y=Math.PI/4;hopper.material=M(0xb56d4d,{side:THREE.DoubleSide});g.add(hopper);
  const fill=mesh(new THREE.CylinderGeometry(1.46,1.46,.08,4),salt,-4,3.5,0);fill.rotation.y=Math.PI/4;g.add(fill);
  for(const x of [-5.2,-2.8])for(const z of [-1.2,1.2])g.add(box(.14,3.5,.14,teal,x,1.93,z));
  const pile=saltPile({radius:2.8,height:2.6,seed:76});pile.position.set(4.6,.18,.1);g.add(pile);
  const motor=box(.9,.65,.7,teal,3.25,4.9,1.4);g.add(motor);
  const wheel=mesh(new THREE.TorusGeometry(.35,.075,6,16),steel,3.65,5.17,1.57);g.add(wheel);
  for(const z of [3,4.7]) {
    g.add(box(4,.17,1.4,wood,-1,.35,z));
    for(let row=0;row<2;row++)for(let i=0;i<4-row;i++) {
      const bag=mesh(new THREE.SphereGeometry(1,10,7),sack,-2.5+i*.95+row*.4,.8+row*.57,z);bag.scale.set(.51,.38,.58);g.add(bag);
      g.add(box(.12,.06,.94,rust,bag.position.x,bag.position.y+.36,z));
    }
  }
  // A harvest rake finishes the human-scale work area.
  g.add(tube([-5,.3,4],[-4.3,2.6,4],.045,wood),box(.95,.1,.13,steel,-5,.35,4));
  for(let i=0;i<7;i++)g.add(box(.04,.08,.35,steel,-5.42+i*.14,.32,4.12));
  const out=finish(g,'salt-harvester');out.userData.assetId='salt-harvester';return out;
}
