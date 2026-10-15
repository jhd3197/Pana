import * as THREE from 'three';
import { mesh, rng } from '/engine/models/core/primitives.js';
import { leafMaterial, TAU, finish } from '/engine/models/vegetation/plant-kit.js';

function succulentBlade(length,width,rise) {
  const vertices=[],colors=[],indices=[],green=new THREE.Color(0x68a395),cream=new THREE.Color(0xc6d6a0);
  for(let i=0;i<=12;i++) {
    const t=i/12,w=Math.sin(Math.PI*t)**0.8*width,y=rise*(1-(1-t)**2),thickness=w*0.26;
    for(const [z,offset,edge] of [[-w,0,1],[0,thickness,0],[w,0,1],[0,-thickness,0]]) {
      vertices.push(t*length,y+offset,z);const c=(edge?cream:green).clone().multiplyScalar(0.72+t*0.28);colors.push(c.r,c.g,c.b);
    }
    if(i<12)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b,a+4,b,b+4,a+4);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function agave({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group();
  for(let layer=0;layer<3;layer++)for(let i=0;i<9-layer*2;i++) {
    const length=1.65-layer*0.48+r()*0.2,rise=0.35+layer*0.5+r()*0.12;
    const blade=mesh(succulentBlade(length,0.23-layer*0.035,rise),leafMaterial,0,0.06,0);
    blade.rotation.y=i*TAU/(9-layer*2)+layer*0.44+r()*0.12;g.add(blade);
  }
  return finish(g,'agave');
}
