import * as THREE from 'three';
import {M,mesh,rng} from '/engine/models/core/primitives.js';
import {dimension} from '/engine/models/core/rural-kit.js';

// One vertex-coloured mesh: cheap enough for broad, spatially instanced meadows.
export function savannaGrass({seed=7,height=1.2,dry=false,detail='full'}={}) {
  dimension(height,.25,2.5,'height');
  if(detail==='ground')return groundTuft(seed,height,dry);
  const random=rng(seed),positions=[],colors=[],indices=[];
  const root=new THREE.Color(dry?0x8b7941:0x526c35),tip=new THREE.Color(dry?0xd9bb70:0xa6ae59);
  for(let blade=0;blade<26;blade++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*.65,h=height*(.4+random()*.6);
    const x=Math.cos(a)*r,z=Math.sin(a)*r,bend=.25+random()*.55,w=.035+random()*.045,start=positions.length/3;
    for(let j=0;j<=5;j++){
      const t=j/5,width=w*(1-t),c=root.clone().lerp(tip,t*.85+random()*.1);
      for(const side of [-1,1]){
        positions.push(x+Math.cos(a)*bend*t*t-Math.sin(a)*width*side,h*(t-.2*t*t),z+Math.sin(a)*bend*t*t+Math.cos(a)*width*side);
        colors.push(c.r,c.g,c.b);
      }
      if(j<5){const k=start+j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const g=new THREE.Group();g.add(mesh(geo,M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1,flatShading:false})));g.name='SavannaGrass';return g;
}

// Seven broad, bent blades (21 triangles). The full meadow model above keeps
// its original geometry; races instance this silhouette thousands of times.
function groundTuft(seed,height,dry) {
  const random=rng(seed),positions=[],colors=[],indices=[];
  const root=new THREE.Color(dry?0x786b35:0x365d2b),tip=new THREE.Color(dry?0xc4ae62:0x83a94b);
  for(let blade=0;blade<7;blade++) {
    const a=random()*Math.PI*2,r=Math.sqrt(random())*.48,h=height*(.55+random()*.45);
    const x=Math.cos(a)*r,z=Math.sin(a)*r,bend=.23+random()*.35,w=.065+random()*.065,start=positions.length/3;
    for(const [t,side]of[[0,-1],[0,1],[.55,-1],[.55,1],[1,0]]) {
      const width=w*(1-t),c=root.clone().lerp(tip,t*.88);
      positions.push(x+Math.cos(a)*bend*t*t-Math.sin(a)*width*side,h*t,z+Math.sin(a)*bend*t*t+Math.cos(a)*width*side);
      colors.push(c.r,c.g,c.b);
    }
    indices.push(start,start+1,start+2,start+1,start+3,start+2,start+2,start+3,start+4);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const g=new THREE.Group();g.add(mesh(geo,M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1,flatShading:false})));g.name='GroundGrass';return g;
}
