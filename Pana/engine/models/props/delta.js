// Palafito family. Metres, +Z front, origin at the water/ground line.
// Static geometry belongs to the returned group; cached materials stay shared.
import * as THREE from 'three';
import { M, box, tube } from '../core/primitives.js';

export function landingShelter({width=5,depth=5,deck=1,height=3,color=0x7fa5a0}={}) {
  const g=new THREE.Group(),wood=M(0x80654a),roof=M(color,{roughness:.85,side:THREE.DoubleSide});
  for(const x of [-width/2,width/2])for(const z of [-depth/2,depth/2])g.add(box(.22,deck+height+.6,.22,wood,x,(deck+height-.6)/2,z));
  for(let i=0;i<Math.ceil(depth/.35);i++)g.add(box(width+.5,.15,.31,M(i%4?0xb29b74:0x927d5b),0,deck,-depth/2+i*.35));
  for(const side of [-1,1]){
    const panel=box(width*.59,.12,depth+.8,roof,side*width*.26,deck+height,0);panel.rotation.z=-side*.3;g.add(panel);
    g.add(tube([side*width/2,deck+height-.5,-depth/2],[0,deck+height+.4,-depth/2],.09,wood));
  }
  g.name='landing-shelter';g.userData.footprint=[width+.6,depth+.8];return g;
}

export function palafitoHouse({variant=0,color=0xc48256}={}) {
  const g=landingShelter({width:7,depth:8,deck:3.3,height:4,color:variant%2?0x648e8e:0xaa785d});
  const wall=M(color),trim=M(0xe4d6b3),dark=M(0x435a58),wood=M(0x705940);
  for(const x of [-2.7,2.7])g.add(box(.18,3.4,5.4,wall,x,5.08,-.7));
  g.add(box(5.5,3.4,.18,wall,0,5.08,-3.4));
  for(const x of [-1.9,1.9])g.add(box(1.7,3.4,.18,wall,x,5.08,2));
  g.add(box(2.1,.65,.2,wall,0,6.5,2),box(1.7,2.6,.1,dark,0,4.65,2));
  for(const x of [-2.73,2.73])for(const z of [-2,.7]){
    g.add(box(.08,1.2,1.2,dark,x,5.25,z));
    for(const dz of [-.66,.66])g.add(box(.13,1.35,.13,trim,x,5.25,z+dz));
  }
  for(let z=-3;z<3;z+=.5)for(const x of [-2.81,2.81])g.add(box(.05,.06,.42,trim,x,4.1+(Math.round(z*2)%3)*.45,z));
  for(const x of [-3.45,3.45])g.add(tube([x,4.2,2.3],[x,4.2,4],.07,wood));
  // Access ramp on +Z connects to the village pedestrian landing.
  const ramp=box(1.8,.16,4.8,wood,0,2.6,6);ramp.rotation.x=.3;g.add(ramp);
  g.name='palafito-house';g.userData.footprint=[8,15];return g;
}
