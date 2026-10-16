import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { leafMaterial, TAU, finish, stem } from '/engine/models/vegetation/plant-kit.js';

export function mountainPine({seed=57,h=7}={}) {
  if(!Number.isFinite(h)||h<3||h>14)throw new RangeError('Mountain pine height must be between 3 and 14');
  const r=rng(seed),g=new THREE.Group(),wood=M(0x79624b,{roughness:1,flatShading:false});
  stem(g,[[0,0,0],[-0.1,h*0.45,0.04],[0.12,h,0]],0.27,0.045,wood,16);
  const greens=[0x315b4c,0x416e57,0x527961];
  for(let tier=0;tier<7;tier++) {
    const y=h*(0.15+tier*0.115),reach=(1-tier*0.135)*h*0.32,phase=r()*TAU;
    for(let i=0;i<7;i++) {
      const a=i*TAU/7+phase,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
      stem(g,[[0,y+0.2,0],[x*0.55,y-0.04,z*0.55],[x*.88,y+0.06,z*.88]],0.065*(1-tier*.12),0.012,wood,6);
    }
    // Broad drooping boughs form a continuous crown with irregular seven-lobed
    // edges. Dark undersides keep the overlapping branch tiers readable.
    const positions=[],colors=[],indices=[],segments=28,lift=h*(.235-tier*.012);
    const profile=[[0,.14],[.09,1],[.34,.88],[.68,.48],[1,.015]];
    const base=new THREE.Color(greens[tier%3]),shadow=base.clone().multiplyScalar(.55);
    profile.forEach(([up,width],j)=>{
      for(let i=0;i<segments;i++){
        const a=i*TAU/segments+phase,lobes=.84+.16*Math.cos((a-phase)*7);
        const radius=reach*width*lobes*(1+Math.sin(a*11+seed+tier)*.035);
        const droop=(j===1||j===2)?-.14*h/7*Math.cos((a-phase)*7):0;
        positions.push(Math.cos(a)*radius,y+up*lift+droop,Math.sin(a)*radius);
        colors.push(...shadow.clone().lerp(base,j===0?.05:.48+up*.48+(Math.sin(a*5+seed)+1)*.035).toArray());
        if(j<profile.length-1){const n=j*segments+i,next=j*segments+(i+1)%segments;indices.push(n,n+segments,next,next,n+segments,next+segments);}
      }
    });
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    g.add(mesh(geo,leafMaterial));
  }
  g.add(mesh(new THREE.ConeGeometry(h*.048,h*.22,9),M(0x416e57,{roughness:1}),0.12,h*.94,0));
  return finish(g,'mountainPine');
}
