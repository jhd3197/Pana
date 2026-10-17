// Open octagonal music pavilion. Metres, ground origin, entrance toward +Z.
import * as THREE from 'three';
import { M, mesh, box, tube } from '../core/primitives.js';
import { finish, railing } from '../core/architecture-kit.js';

export function plazaBandstand() {
  const g=new THREE.Group(),cream=M(0xe9d8b2),teal=M(0x388b87),clay=M(0xba6347),dark=M(0x344d50),wood=M(0xa5744c),brass=M(0xd5ae61,{metalness:.35});
  const polygon=(r,h,mat,y)=>{const o=mesh(new THREE.CylinderGeometry(r,r,h,8),mat,0,y,0);o.rotation.y=Math.PI/8;return o;};
  g.add(polygon(6.2,.35,cream,.175),polygon(5.8,.65,clay,.675),polygon(5.95,.2,cream,1.1),polygon(5.6,.08,wood,1.24));
  for(let i=0;i<8;i++) {
    const a=(i+.5)*Math.PI/4,b=(i+1.5)*Math.PI/4,x=Math.sin(a)*5.1,z=Math.cos(a)*5.1;
    g.add(box(.34,4.8,.34,teal,x,3.6,z),box(.65,.22,.65,cream,x,1.39,z),box(.68,.25,.68,cream,x,5.84,z));
    const nx=Math.sin(b)*5.1,nz=Math.cos(b)*5.1;
    g.add(tube([x,5.7,z],[nx,5.7,nz],.12,teal));
    // The front bay stays open for the stairs and the audience sightline.
    if(i!==7)railing(g,[x,1.3,z],[nx,1.3,nz],{height:1.02,material:teal,spacing:.65});
    for(const d of [-1,1])g.add(tube([x,4.8,z],[x+Math.cos(a)*d*.85,5.7,z-Math.sin(a)*d*.85],.07,cream));
  }
  for(let i=0;i<5;i++)g.add(box(3.2,1.2-i*.22,.72,cream,0,(1.2-i*.22)/2,5.05+i*.68));
  const roof=mesh(new THREE.ConeGeometry(6.9,2.15,8),clay,0,7.05,0);roof.rotation.y=Math.PI/8;g.add(roof);
  g.add(polygon(6.9,.2,teal,5.96));
  for(let i=0;i<8;i++) {
    const a=(i+.5)*Math.PI/4;
    g.add(tube([Math.sin(a)*6.85,6.03,Math.cos(a)*6.85],[0,8.12,0],.055,cream));
  }
  g.add(mesh(new THREE.SphereGeometry(.22,10,7),brass,0,8.3,0),tube([0,8.3,0],[0,8.8,0],.035,brass));
  // A small backline gives the stage a purpose without placing fake spectators.
  for(const x of [-3.6,3.6]) {
    g.add(box(1.05,1.65,.8,dark,x,2.08,-2.8));
    for(const y of [1.78,2.4])g.add(mesh(new THREE.CylinderGeometry(.3,.3,.04,16),teal,x,y,-2.37));
    g.children.slice(-2).forEach(o=>o.rotation.x=Math.PI/2);
  }
  const drum=mesh(new THREE.CylinderGeometry(.68,.68,.7,18),clay,0,1.95,-2.2);drum.rotation.x=Math.PI/2;g.add(drum);
  const skin=mesh(new THREE.CircleGeometry(.62,18),cream,0,1.95,-1.84);g.add(skin);
  for(const x of [-1.2,1.3]) {
    g.add(tube([x,1.3,-2.1],[x,3.1,-2.1],.035,dark));
    const cymbal=mesh(new THREE.ConeGeometry(.52,.12,18),brass,x,3.15,-2.1);g.add(cymbal);
  }
  g.add(tube([0,1.3,1.7],[0,3.1,1.7],.035,dark),tube([0,3.1,1.7],[.65,3.25,1.7],.035,dark));
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;g.add(tube([0,1.65,1.7],[Math.sin(a)*.48,1.3,1.7+Math.cos(a)*.48],.03,dark));}
  const out=finish(g,'plaza-bandstand');out.userData.assetId='plaza-bandstand';return out;
}
