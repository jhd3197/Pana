import * as THREE from 'three';
import { M, mesh } from '/engine/models/core/primitives.js';
import { leafBlade, taperedStem } from '/engine/models/core/botanical-shapes.js';
import { bake } from '/engine/models/core/static-batch.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';

const windUniform={value:0};
const windStrength={value:1};

function applyWindSway(material,amp=0.055){
  material.onBeforeCompile=shader=>{
    shader.uniforms.uWindTime=windUniform;
    shader.uniforms.uWindStrength=windStrength;
    shader.vertexShader=`uniform float uWindTime;\nuniform float uWindStrength;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float windHeight=clamp((transformed.y-0.15)*0.45,0.0,2.2);
      float windBend=windHeight*windHeight*${amp.toFixed(4)}*uWindStrength;
      float windPhase=uWindTime*1.85+transformed.x*0.37+transformed.z*0.41;
      transformed.x+=sin(windPhase)*windBend;
      transformed.z+=cos(windPhase*0.83+1.2)*windBend*0.65;`
    );
  };
  material.customProgramCacheKey=()=>`pana-wind-${amp}`;
  return material;
}

const leafMaterial=applyWindSway(M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,flatShading:false,roughness:1}),0.06);
const bark=applyWindSway(M(0x8b7350,{flatShading:false,roughness:1}),0.025);
const stemMaterial=applyWindSway(M(0x527d39,{flatShading:false,roughness:1}),0.045);
const TAU=Math.PI*2;

function tickWind(t,strength=1){
  windUniform.value=t;
  windStrength.value=strength;
}

function finish(root,name) {
  const result=bake(root);result.name=name;
  const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
  return result;
}
function stem(group,points,radius,tip,material=stemMaterial,segments=8) {
  group.add(mesh(natureSurface(taperedStem(points,radius,tip,segments,6), 'bark'),material));
}
function leaf(group,length,width,position,rotation,tint=0x619e48,bend=0.15,segments=6) {
  const m=mesh(natureSurface(leafBlade(length,width,bend,tint,segments), 'foliage'),leafMaterial,...position);
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
  const m=mesh(natureSurface(geo, 'foliage'),leafMaterial,...position);m.scale.set(...size);group.add(m);
}


// The tree kit's own shader reads the same clock, so one tickWind moves every plant.
const windUniforms={time:windUniform,strength:windStrength};

export { leafMaterial, bark, stemMaterial, TAU, finish, stem, leaf, cushion, tickWind, applyWindSway, windUniforms };
