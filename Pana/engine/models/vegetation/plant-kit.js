import * as THREE from 'three';
import { M, mesh } from '/engine/models/core/primitives.js';
import { leafBlade, taperedStem } from '/engine/models/core/botanical-shapes.js';
import { bake } from '/engine/models/core/static-batch.js';

const leafMaterial=M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,flatShading:false,roughness:1});
const bark=M(0x8b7350,{flatShading:false,roughness:1});
const stemMaterial=M(0x527d39,{flatShading:false,roughness:1});
const TAU=Math.PI*2;

function finish(root,name) {
  const result=bake(root);result.name=name;
  const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
  return result;
}
function stem(group,points,radius,tip,material=stemMaterial,segments=8) {
  group.add(mesh(taperedStem(points,radius,tip,segments,6),material));
}
function leaf(group,length,width,position,rotation,tint=0x619e48,bend=0.15,segments=6) {
  const m=mesh(leafBlade(length,width,bend,tint,segments),leafMaterial,...position);
  m.rotation.set(...rotation);group.add(m);return m;
}
function cushion(group,position,size,tint,seed,small=false) {
  const geo=new THREE.SphereGeometry(1,small?8:14,small?6:10),p=geo.attributes.position,colors=[];
  const light=new THREE.Color(tint),dark=light.clone().multiplyScalar(0.55);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+0.1*Math.sin(x*6+seed)*Math.sin(z*5-seed)+0.05*Math.cos(y*7+seed);
    p.setXYZ(i,x*r,y*r,z*r);
    const c=dark.clone().lerp(light,0.62+y*0.3);colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const m=mesh(geo,leafMaterial,...position);m.scale.set(...size);group.add(m);
}


export { leafMaterial, bark, stemMaterial, TAU, finish, stem, leaf, cushion };
