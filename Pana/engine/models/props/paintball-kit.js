import * as THREE from 'three';
import { createPaintMarker } from './paintball.js';
// Toy sporting equipment. Origin at the grip, +Z down the barrel.
export function createPaintKit({color='#f28b42',weapon='pistol',attachments=[],charm='none',pattern='splat'}={}) {
 const group=new THREE.Group(), parts=[], geometries=new Set(), materials=new Set();
 const mat=(color)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.42});materials.add(m);return m;};
 const paint=mat(color),dark=mat('#344847'),cream=mat('#f8e9c9');
 const mesh=(geo,m,x,y,z)=>{geometries.add(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);group.add(o);return o;};
 if(weapon==='rocket') {
  const tube=mesh(new THREE.CylinderGeometry(.22,.26,1.35,16),paint,0,.25,.4);tube.rotation.x=Math.PI/2;
  const mouth=mesh(new THREE.CylinderGeometry(.17,.17,.06,16),dark,0,.25,1.09);mouth.rotation.x=Math.PI/2;
  mesh(new THREE.BoxGeometry(.15,.4,.18),dark,0,-.1,.2);
  mesh(new THREE.BoxGeometry(.32,.08,.65),cream,0,.52,.3);
 } else {
  const base=createPaintMarker({color});parts.push(base);group.add(base);
  if(weapon==='scatter') { base.scale.set(1.12,1, .8); const barrel=mesh(new THREE.CylinderGeometry(.105,.105,.65,12),dark,0,.17,.7);barrel.rotation.x=Math.PI/2; }
  if(weapon==='rapid') {base.scale.setScalar(.78);base.position.x=-.28; const second=createPaintMarker({color});second.scale.setScalar(.78);second.position.x=.28;parts.push(second);group.add(second);group.userData.hands=[base,second];}
 }
 if(attachments.includes('barrel')) { const barrel=mesh(new THREE.CylinderGeometry(.06,.07,.3,12),cream,0,.17,1.15);barrel.rotation.x=Math.PI/2; }
 if(attachments.includes('hopper')) mesh(new THREE.SphereGeometry(.23,12,8),paint,0,.7,.12).scale.set(1,.7,1.4);
 if(attachments.includes('stock')) mesh(new THREE.BoxGeometry(.12,.12,.45),cream,0,.1,-.45);
 if(charm!=='none') { const c=mesh(new THREE.SphereGeometry(.09,10,8),mat(charm==='mango'?'#ffc629':color),.23,-.3,.05); if(charm==='mango') c.scale.y=1.4; }
 if(pattern==='stripe') for(let i=0;i<3;i++) mesh(new THREE.BoxGeometry(.2,.02,.04),cream,0,.27,i*.12);
 if(pattern==='dots') for(let i=0;i<3;i++) mesh(new THREE.SphereGeometry(.025,6,4),cream,.105,.15,i*.12);
 group.name={pistol:'La Chispa',scatter:'El Trueno',rapid:'Las Gemelas',rocket:'El Cohetón'}[weapon];
 let disposed=false;group.userData.dispose=()=>{if(disposed)return;disposed=true;parts.forEach(p=>p.userData.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};return group;
}
export function createPaintVest() {
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#344847',roughness:.85}),geometry=new THREE.BoxGeometry(.58,.55,.13);
 for(const z of [-.2,.2]) {const pad=new THREE.Mesh(geometry,material);pad.position.set(0,1.08,z);group.add(pad);}
 for(const x of [-.18,.18]) {const pad=new THREE.Mesh(geometry,material);pad.scale.set(.3,.6,1.2);pad.position.set(x,1.06,.29);group.add(pad);}
 group.name='El Acolchado'; group.userData.dispose=()=>{geometry.dispose();material.dispose();};return group;
}
