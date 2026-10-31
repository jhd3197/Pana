import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
// Toy sporting equipment, four silhouettes you can tell apart in one glance:
// La Chispa a slim pistol with its gas tank, El Trueno a long double-barrelled
// pump, Las Gemelas two drum-fed twins, El Cohetón a fat shoulder tube with a nose cone.
// Origin at the grip, +Z down the barrel. `userData.tip` is the muzzle's z.
export function createPaintKit({color='#f28b42',weapon='pistol',attachments=[],charm='none',pattern='splat'}={}) {
 const group=new THREE.Group(), geometries=new Set(), materials=new Set();
 const mat=(c,o={})=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.42,...o});materials.add(m);return m;};
 const paint=mat(color),dark=mat('#344847',{roughness:.55}),cream=mat('#f8e9c9'),steel=mat('#a9bfc0',{metalness:.6,roughness:.3}),ink=mat('#16161a',{roughness:.6}),coral=mat('#ff4b4b'),wood=mat('#8b5e3c',{roughness:.7});
 const put=(geo,m,x,y,z,to=group)=>{geometries.add(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);to.add(o);return o;};
 const box=(w,h,d,m,x,y,z,to,r=.03)=>put(new RoundedBoxGeometry(w,h,d,2,r),m,x,y,z,to);
 // Cylinders lie along Z: `front` radius first, then `rear`.
 const tube=(front,rear,len,m,x,y,z,to)=>{const o=put(new THREE.CylinderGeometry(front,rear,len,16),m,x,y,z,to);o.rotation.x=Math.PI/2;return o;};
 const blob=(r,m,x,y,z,sx,sy,sz,to)=>{const o=put(new THREE.SphereGeometry(r,16,12),m,x,y,z,to);o.scale.set(sx,sy,sz);return o;};
 const lean=(o,x)=>{o.rotation.x=x;return o;};
 let tip=1.05,top=.28;
 if(weapon==='rocket') {
  tip=1.4;top=.46;
  tube(.19,.21,1.35,paint,0,.2,.4,group);
  lean(put(new THREE.ConeGeometry(.19,.4,16),coral,0,.2,1.28),Math.PI/2);
  tube(.2,.3,.22,dark,0,.2,-.36,group);
  for(const z of [.05,.62]) tube(.22,.22,.07,cream,0,.2,z,group);
  lean(box(.13,.38,.16,dark,0,-.12,.18),-.2);
  box(.12,.3,.12,dark,0,-.06,.68);
  box(.06,.12,.22,ink,0,.45,.28);
 } else if(weapon==='scatter') {
  tip=1.55;top=.3;
  box(.2,.2,.52,paint,0,.14,.08);
  for(const x of [-.075,.075]) { tube(.075,.075,1,steel,x,.2,.85,group); tube(.1,.075,.14,coral,x,.2,1.48,group); }
  tube(.055,.055,.8,dark,0,.04,.72,group);
  box(.2,.15,.38,wood,0,-.01,.8);
  lean(box(.17,.3,.58,wood,0,.0,-.46),.12);
  box(.19,.34,.04,ink,0,-.03,-.76);
  lean(box(.13,.3,.14,dark,0,-.14,-.02),-.25);
  box(.05,.07,.05,ink,0,.31,1.2);
 } else if(weapon==='rapid') {
  tip=.98;top=.46;
  const hands=[-1,1].map(side=>{
   const hand=new THREE.Group();hand.position.x=side*.3;group.add(hand);
   box(.16,.2,.6,paint,0,.14,.18,hand);
   lean(box(.13,.3,.15,dark,0,-.1,.0,hand),-.2);
   tube(.07,.07,.5,dark,0,.15,.68,hand);
   for(let i=0;i<3;i++) tube(.08,.08,.03,cream,0,.15,.5+i*.12,hand);
   tube(.052,.052,.05,coral,0,.15,.95,hand);
   put(new THREE.CylinderGeometry(.16,.16,.16,18),cream,0,.35,.2,hand);
   blob(.13,paint,0,.43,.2,1,.55,1,hand);
   return hand;
  });
  group.userData.hands=hands;
 } else {
  box(.17,.18,.72,paint,0,.17,.3);
  box(.15,.1,.5,dark,0,.06,.2);
  lean(box(.14,.36,.17,dark,0,-.12,.02),-.2);
  box(.03,.1,.04,ink,0,0,.14,undefined,.01);
  tube(.045,.045,.4,steel,0,.17,.82,group);
  tube(.07,.07,.06,coral,0,.17,1.03,group);
  tube(.05,.05,.36,steel,0,-.03,.55,group); tube(.058,.058,.05,cream,0,-.03,.76,group);
  box(.03,.05,.05,ink,0,.29,.62,undefined,.01); box(.08,.04,.04,ink,0,.29,-.02,undefined,.01);
 }
 group.userData.tip=tip;
 if(attachments.includes('barrel')) tube(.06,.07,.3,cream,0,top-.11,tip+.1,group);
 if(attachments.includes('hopper')) blob(.23,paint,0,top+.42,.12,1,.7,1.4,group);
 if(attachments.includes('stock')) box(.12,.12,.45,cream,0,.1,-.45,group,.02);
 if(charm!=='none') { const c=put(new THREE.SphereGeometry(.09,10,8),mat(charm==='mango'?'#ffc629':color),.23,-.3,.05); if(charm==='mango') c.scale.y=1.4; }
 if(pattern==='stripe') for(let i=0;i<3;i++) put(new THREE.BoxGeometry(.2,.02,.04),cream,0,top-.01,i*.12);
 if(pattern==='dots') for(let i=0;i<3;i++) put(new THREE.SphereGeometry(.025,6,4),cream,.105,top-.13,i*.12);
 group.name={pistol:'La Chispa',scatter:'El Trueno',rapid:'Las Gemelas',rocket:'El Cohetón'}[weapon];
 let disposed=false;group.userData.dispose=()=>{if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};return group;
}
export function createPaintVest() {
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#344847',roughness:.85}),geometry=new THREE.BoxGeometry(.58,.55,.13);
 for(const z of [-.2,.2]) {const pad=new THREE.Mesh(geometry,material);pad.position.set(0,1.08,z);group.add(pad);}
 for(const x of [-.18,.18]) {const pad=new THREE.Mesh(geometry,material);pad.scale.set(.3,.6,1.2);pad.position.set(x,1.06,.29);group.add(pad);}
 group.name='El Acolchado'; group.userData.dispose=()=>{geometry.dispose();material.dispose();};return group;
}
