import * as THREE from 'three';
import {M,mesh,tube,rng} from '/engine/models/core/primitives.js';
import {finish} from '/engine/models/core/architecture-kit.js';
import {dimension} from '/engine/models/core/rural-kit.js';
import {natureSurface} from '/engine/models/core/nature-surface.js';

// Moriche has a stout ringed trunk and divided fan leaves, unlike the coconut palm.
export function moriche({seed=7,h=10}={}) {
  dimension(h,4,16,'h');const random=rng(seed),g=new THREE.Group(),lean=.25+random()*.35;
  const bark=M(0x8a7857,{roughness:1}),stalk=M(0x8c9453),dry=M(0x99804d,{side:THREE.DoubleSide});
  const leaves=[0x557f3c,0x6c9442,0x8ba952].map(c=>M(c,{roughness:1,side:THREE.DoubleSide}));
  const trunk=new THREE.CylinderGeometry(.29,.47,h,10,8),p=trunk.attributes.position;
  for(let i=0;i<p.count;i++){const t=(p.getY(i)+h/2)/h;p.setXYZ(i,p.getX(i)+lean*t*t,p.getY(i)+h/2,p.getZ(i));}trunk.computeVertexNormals();g.add(mesh(natureSurface(trunk,'bark'),bark));
  for(let i=1;i<Math.floor(h*2.1);i++){const y=i/2.1,t=y/h,r=mesh(new THREE.TorusGeometry(.47-.18*t,.021,3,10),M(0xb39c70),lean*t*t,y,0);r.rotation.x=Math.PI/2;g.add(r);}
  for(let i=0;i<17;i++){
    const a=i*2.399,lower=i<3,length=lower?1.1+random()*.4:i>12?1.5+random()*.4:1.8+random()*.7;
    const leaf=new THREE.Group();leaf.position.set(lean,h-.2+(i>12?.35:0),0);leaf.rotation.y=a;
    leaf.rotation.z=lower?-.2:i>12?.8+random()*.45:-.1+random()*.72;
    leaf.add(tube([0,0,0],[length*.65,lower?-.4:.6,0],.045,stalk));
    const ps=[],ix=[],n=15;
    for(let j=0;j<n;j++){
      const f=(j/(n-1)-.5)*2.3,l=length*(.8+.2*Math.cos(f)),k=ps.length/3;
      const baseX=length*.54,baseY=lower?-.28:.55;
      const endX=baseX+Math.cos(f)*l,endZ=Math.sin(f)*l;
      // Raised central rib and separated pointed fingers give each fan its folds.
      ps.push(baseX,baseY,0,endX-.1,lower?-1.65:.05,endZ-.11,endX+.13,lower?-1.48:.25,endZ,endX-.1,lower?-1.65:.05,endZ+.11);
      ix.push(k,k+1,k+2,k,k+2,k+3);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setIndex(ix);geo.computeVertexNormals();leaf.add(mesh(natureSurface(geo,'foliage'),lower?dry:leaves[i%3]));g.add(leaf);
  }
  for(let i=0;i<3;i++){
    const bunch=new THREE.Group();bunch.position.set(lean,h-.8,0);bunch.rotation.y=i*2.1;
    bunch.add(tube([0,0,0],[.55,-.8,0],.045,stalk));
    for(let j=0;j<7;j++)bunch.add(mesh(new THREE.IcosahedronGeometry(.11,0),M(0x984c2d),.5+Math.sin(j*2.4)*.14,-.5-j*.09,Math.cos(j*2.4)*.14));g.add(bunch);
  }
  // Encode the small palette into vertices so a grove is one draw per cell.
  const mat=M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1});
  g.traverse(o=>{if(!o.isMesh)return;const colors=[],c=o.material.color;for(let i=0;i<o.geometry.attributes.position.count;i++)colors.push(c.r,c.g,c.b);o.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));o.material=mat;});
  return finish(g,'MorichePalm');
}
