import * as THREE from 'three';
import { mesh, rng } from '/engine/models/core/primitives.js';
import { taperedStem } from '/engine/models/core/botanical-shapes.js';
import { leafMaterial, stemMaterial, TAU, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

function splitLeaf(length,tint) {
  // Deep perimeter splits and real holes survive silhouettes and wireframe view.
  const edge=[[0,0],[0.06,0.24],[0.2,0.48],[0.31,0.54],[0.38,0.23],[0.44,0.59],[0.54,0.6],
    [0.59,0.25],[0.65,0.53],[0.73,0.46],[0.78,0.18],[0.84,0.31],[0.94,0.16],[1,0]];
  const outline=[...edge,...edge.slice(1,-1).reverse().map(([x,y])=>[x,-y])];
  const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
  for(const side of [-1,1])for(const x of [0.23,0.49]) {
    const hole=new THREE.Path();hole.absellipse(x,side*0.15,0.047,0.075,0,TAU,true,0.3*side);shape.holes.push(hole);
  }
  const outlineGeometry=new THREE.ShapeGeometry(shape,8),vertices=Array.from(outlineGeometry.attributes.position.array),indices=[],midpoints=new Map();
  // Add interior vertices before bending, preserving shared edges and leaf holes.
  // Bending the outline alone creates long, sharply folded triangles.
  const midpoint=(a,b)=>{
    const key=[Math.min(a,b),Math.max(a,b)].join(':');if(midpoints.has(key))return midpoints.get(key);
    const index=vertices.length/3;for(let i=0;i<3;i++)vertices.push((vertices[a*3+i]+vertices[b*3+i])/2);midpoints.set(key,index);return index;
  };
  const source=outlineGeometry.index.array;
  for(let i=0;i<source.length;i+=3) {
    const a=source[i],b=source[i+1],c=source[i+2],ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
    indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);outlineGeometry.dispose();
  const p=geo.attributes.position,colors=[],light=new THREE.Color(tint),dark=new THREE.Color(0x205c42);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getY(i),y=Math.sin(x*Math.PI)*0.15-x*x*0.14-Math.abs(z)*0.16;
    p.setXYZ(i,x*length,y*length,z*length);
    const c=dark.clone().lerp(light,0.55+x*0.24+(1-Math.abs(z))*0.15);colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

export function monstera({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group();
  for(let i=0;i<5;i++) {
    const a=i*2.4,reach=0.22+r()*0.32,h=1.35+r()*0.7,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[0,0,0],[x*0.3,h*0.6,z*0.3],[x,h,z]],0.035,0.018,stemMaterial);
    const length=0.9+r()*0.5,blade=mesh(splitLeaf(length,i%2?0x39875a:0x4d9b62),leafMaterial,x,h,z);
    blade.rotation.set(0,-a,-0.4-r()*0.4);g.add(blade);
    // Midrib follows the leaf's local curve without sealing its fenestrations.
    const midrib=mesh(taperedStem([[0,0.012,0],[length*0.5,length*0.115+0.012,0],[length,-length*0.14+0.012,0]],0.012,0.003,9,5),stemMaterial);
    midrib.position.copy(blade.position);midrib.rotation.copy(blade.rotation);g.add(midrib);
  }
  return finish(g,'monstera');
}
