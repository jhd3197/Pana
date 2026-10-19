import * as THREE from 'three';
import { casaGuipuzcoana } from '../models/props/casa-guipuzcoana.js';
import { sanCarlosFortress } from '../models/props/san-carlos-fortress.js';
import { portSilos } from '../models/props/port-silos.js';
import { portCrane } from '../models/props/port-crane.js';
import { palm } from '../models/vegetation/palm.js';
import { M,box,mesh } from '../models/core/primitives.js';
import { paintFinish } from '../models/core/architecture-kit.js';
import { waterSurface,waterAnimator } from '../models/effects/water-surface.js';
import { disposeModel } from '../models/props/game-table.js';

// Table equipment and panas remain game-owned at y=0. Landmarks are the same
// native factories used by Puerto, with an open central camera / seating area.
export function createPuertoTableEnvironment(id){
  const fort=id==='san-carlos',group=new THREE.Group(),fixed=new THREE.Group();
  group.name=fort?'Fuerte San Carlos':'Casa Guipuzcoana';group.userData.mapId=id;group.userData.mode='table';
  const place=(o,x,y,z,s=1)=>{o.position.set(x,y,z);o.scale.setScalar(s);(o.userData.prototype?group:fixed).add(o);return o;};
  place(fort?sanCarlosFortress({scale:.72}):casaGuipuzcoana({table:true}),0,0,0,fort?1:3.2);
  if(fort){
    const geo=new THREE.PlaneGeometry(320,300,50,50);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.max(Math.abs(x),Math.abs(z));p.setY(i,-.25-Math.max(0,r-47)*.55);}
    geo.computeVertexNormals();fixed.add(mesh(geo,M(0x839664,{flatShading:true})));
  }else fixed.add(box(180,.4,125,M(0xd5bf92),0,-.28,0));
  const seaY=fort?-38:-.8,sea=waterSurface(new THREE.PlaneGeometry(700,600,70,60).rotateX(-Math.PI/2),{kind:'sea',amplitude:.08,color:0x469eaa});
  sea.position.set(0,seaY,170);group.add(sea);
  place(portSilos(),-65,fort?-12:0,24,.6);
  for(const x of [48,69,90])place(portCrane(),x,seaY+1,fort?125:85,.4);
  fixed.add(box(90,2,32,M(0xb8b49f),69,seaY,fort?125:85));
  for(const [i,x]of[-42,42].entries())for(const z of [36,-30])place(palm({seed:75+i,h:9}),x,fort?-.25:0,z);
  group.add(paintFinish(fixed,'puerto-table-landmarks'));
  // Keep cached factory materials alive when one room changes its setting.
  const owned=new Map();group.traverse(o=>{if(o.material){const own=m=>{if(!owned.has(m))owned.set(m,m.clone());return owned.get(m);};o.material=Array.isArray(o.material)?o.material.map(own):own(o.material);}});
  const animate=waterAnimator(group);let disposed=false;
  return {id,group,bounds:new THREE.Box3(new THREE.Vector3(-78,-2,-56),new THREE.Vector3(100,fort?22:20,98)),
    update:t=>animate(t),dispose(){if(disposed)return;disposed=true;group.traverse(o=>o.userData.dispose?.());disposeModel(group);}};
}
