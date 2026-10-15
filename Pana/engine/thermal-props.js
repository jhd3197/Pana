// Grounded thermal landmarks shared by Chi Chi and Pana Studio. Front is +Z.
import * as THREE from 'three';
import { M,mesh,box } from './props.js';
import { finish,sign,tiledRoof,shutterWindow,railing } from './architecture-kit.js';
import { addWaterMotion } from './water-details.js';
import { steamField } from './thermal-steam.js';

const mineral=M(0xd8ccaa,{roughness:1}),cream=M(0xeee2c5,{roughness:1}),dark=M(0x68736a,{roughness:1}),wood=M(0x8b7052),teal=M(0x437f7d);
function ring(outer,inner,height,material,seed,y=0){
  const shape=new THREE.Shape(),hole=new THREE.Path(),n=48;
  for(let i=0;i<=n;i++){
    const a=i/n*Math.PI*2,k=1+.045*Math.sin(a*5+seed)+.025*Math.cos(a*9-seed),x=Math.cos(a),z=Math.sin(a);
    if(i===0){shape.moveTo(x*outer*k,z*outer*k);hole.moveTo(x*inner*k,z*inner*k);}else{shape.lineTo(x*outer*k,z*outer*k);hole.lineTo(x*inner*k,z*inner*k);}
  }
  shape.holes.push(hole);const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});geo.rotateX(-Math.PI/2);return mesh(geo,material,0,y,0);
}
function animate(group,callbacks){group.userData.tick=t=>callbacks.forEach(fn=>fn(t));group.userData.tick(0);return group;}

export function hotSpringPool({radius=6,seed=1,steam=true}={}){
  const r=THREE.MathUtils.clamp(radius,3,12),fixed=new THREE.Group();
  fixed.add(mesh(new THREE.CylinderGeometry(r+1,r+1.3,.24,48),mineral,0,.12,0));
  fixed.add(ring(r+.55,r*.76,.52,mineral,seed,.2),ring(r+.05,r*.76,.12,cream,seed,.72));
  const floor=mesh(new THREE.CircleGeometry(r*.78,48),M(0x4aa99b),0,.32,0);floor.rotation.x=-Math.PI/2;fixed.add(floor);
  const water=mesh(new THREE.CircleGeometry(r*.775,48),M(0x4bb8a7,{roughness:.22,metalness:.08,transparent:true,opacity:.9}),0,.65,0);water.rotation.x=-Math.PI/2;fixed.add(water);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7,stone=mesh(new THREE.IcosahedronGeometry(.5+(i%3)*.14,1),dark,Math.cos(a)*(r+.45),.7,Math.sin(a)*(r+.45));stone.scale.y=.65;fixed.add(stone);}
  const group=new THREE.Group();group.name='hot-spring-pool';group.add(finish(fixed));
  const tick=addWaterMotion(group,[[0,.68,0,r*.3],[-r*.35,.68,r*.2,r*.22],[r*.3,.68,-r*.25,r*.18]]),updates=[tick];
  if(steam){const cloud=steamField([[0,.8,0]],{seed,count:10,radius:r*.55,rise:9,opacity:.14,drift:3});group.add(cloud);updates.push(t=>cloud.userData.tick(t));}
  group.userData.previewBounds=[[-r-1.3,0,-r-1.3],[r+1.3,steam?5:2,r+1.3]];
  group.userData.waterLevel=.65;group.userData.radius=r;return animate(group,updates);
}

export function steamVent({seed=2}={}){
  const fixed=new THREE.Group();fixed.add(ring(1.7,.48,.6,dark,seed),ring(1.1,.45,.18,mineral,seed,.6));
  const center=mesh(new THREE.CircleGeometry(.48,24),M(0x346c68),0,.35,0);center.rotation.x=-Math.PI/2;fixed.add(center);
  const group=new THREE.Group();group.name='steam-vent';group.add(finish(fixed));
  const steam=steamField([[0,.6,0]],{seed,radius:1.9,rise:13,count:16,opacity:.35});group.add(steam);
  group.userData.previewBounds=[[-3,0,-3],[3,12,3]];
  return animate(group,[t=>steam.userData.tick(t)]);
}

export function mineralTerraces({seed=3}={}){
  const group=new THREE.Group(),updates=[];group.name='mineral-terraces';
  for(let i=0;i<3;i++){
    const r=6-i*1.1,h=i*1.6,pool=hotSpringPool({radius:r,seed:seed+i,steam:i===2});
    pool.position.set(i*2.8,h,-i*5.5);group.add(pool);updates.push(t=>pool.userData.tick(t));
    if(i)group.add(mesh(new THREE.CylinderGeometry(r+1,r+2,h,40),mineral,i*2.8,h/2,-i*5.5));
    if(i){const spill=box(1.8,1.7,.15,M(0x8dcfc0,{transparent:true,opacity:.7,roughness:.2}),i*2.8,h-.05,-i*5.5+r*.85);group.add(spill);}
  }group.userData.previewBounds=[[-8,0,-17],[12,10,8]];return animate(group,updates);
}

export function thermalBathhouse(){
  const g=new THREE.Group(),wall=M(0xddc999);
  g.add(box(12,.4,8.5,cream,0,.2,0),box(11,5,7,wall,0,2.9,0));
  tiledRoof(g,{w:11,d:7,y:5.5,rise:1.6,wall,seed:18});
  g.add(box(1.5,3.5,.12,teal,0,2.05,3.56));
  for(const x of [-3.5,3.5])shutterWindow(g,x,3,3.58,{w:1.4,h:1.6,color:0x467e73});
  g.add(box(12,.3,3,cream,0,.15,5),box(12,.25,3,wood,0,.42,5),box(12,.22,3.2,teal,0,4.6,5));
  for(const x of [-5.5,5.5])g.add(box(.22,4.6,.22,wood,x,2.3,6.35));
  const label=sign(['AGUAS DEL CIELO','TERMAS · CHI CHI'],8,1.2);label.position.set(0,4.75,3.63);g.add(label);
  for(const x of [-3,3]){
    g.add(box(2.6,.14,.55,wood,x,1.1,5.7),box(2.6,.55,.1,wood,x,1.44,5.96));
    for(const dx of [-1,1])for(const z of [5.5,5.9])g.add(box(.12,.54,.12,wood,x+dx,.8,z));
  }
  return finish(g,'thermal-bathhouse');
}

export function thermalLookout(){
  const g=new THREE.Group();
  for(let z=-4;z<=4;z+=.45)g.add(box(12,.14,.42,wood,0,2,z));
  for(const x of [-5.4,5.4])for(const z of [-3.6,0,3.6])g.add(box(.35,2.1,.35,wood,x,1.05,z));
  railing(g,[-5.8,2.1,-4.1],[5.8,2.1,-4.1],{material:wood,spacing:.7});
  for(const x of [-5.8,5.8])railing(g,[x,2.1,-4.1],[x,2.1,4.1],{material:wood,spacing:.7});
  for(let i=0;i<6;i++)g.add(box(3,.3*(6-i),.5,wood,0,.15*(6-i),4.4+i*.48));
  const panel=sign(['MIRADOR CHI CHI','MONTAÑA · TERMAS · MAR'],4,.85);panel.position.set(0,3.4,-4);g.add(panel);
  return finish(g,'thermal-lookout');
}
