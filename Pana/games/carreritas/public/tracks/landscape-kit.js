// Soil, gardens and service paths follow each map's placement surface.
import {THREE,M,mesh,clear,rng} from './world-kit.js';

export function landPatch(T,height,{x,z,rx,rz,color,seed=1,rect=false,step=5,margin=7,raise=.07}) {
  const nx=Math.ceil(rx*2/step),nz=Math.ceil(rz*2/step),positions=[],indices=[],inside=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const px=x-rx+i/nx*rx*2,pz=z-rz+j/nz*rz*2,a=Math.atan2((pz-z)/rz,(px-x)/rx);
    positions.push(px,height(px,pz)+raise,pz);
    inside.push((rect||Math.hypot((px-x)/rx,(pz-z)/rz)<.91+.06*Math.sin(a*5+seed))&&clear(T,px,pz,margin));
    if(i&&j){const k=j*(nx+1)+i;for(const tri of [[k-nx-2,k-1,k-nx-1],[k-nx-1,k-1,k]])if(tri.every(v=>inside[v]))indices.push(...tri);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(g,M(color,{roughness:1,flatShading:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
}

export function landPath(T,height,points,{width=4,color=0xc1ae83,step=4,margin=3,raise=.12}={}) {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))),n=Math.ceil(curve.getLength()/step),positions=[],indices=[],allowed=[];
  for(let i=0;i<=n;i++){
    const p=curve.getPoint(i/n),d=curve.getTangent(i/n);
    for(const side of [-1,1]){const x=p.x+d.z*width/2*side,z=p.z-d.x*width/2*side;positions.push(x,height(x,z)+raise,z);allowed.push(clear(T,x,z,margin));}
    if(i&&[i*2-2,i*2-1,i*2,i*2+1].every(j=>allowed[j])){const a=i*2-2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(g,M(color,{roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
}

export function grove(T,height,centers,{seed=1,scale=2,accept=()=>true,margin=8,minY=.3}={}) {
  const random=rng(seed),out=[];
  for(const [cx,cz,rx,rz,count]of centers)for(let i=0,tries=0;i<count&&tries<count*20;tries++){
    const a=random()*Math.PI*2,r=Math.sqrt(random()),x=cx+Math.cos(a)*rx*r,z=cz+Math.sin(a)*rz*r,y=height(x,z);
    if(y<minY||!clear(T,x,z,margin)||!accept(x,z)||out.some(p=>Math.hypot(p.x-x,p.z-z)<margin))continue;
    out.push({x,z,y,rot:random()*Math.PI*2,scale:scale*(.7+random()*.6)});i++;
  }
  return out;
}
