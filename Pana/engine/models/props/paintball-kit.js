import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bake } from '/engine/models/core/static-batch.js';
// Toy sporting equipment, six silhouettes you can tell apart in one glance:
// La Chispa a slim pistol with its gas tank, El Trueno a long double-barrelled
// pump, Las Gemelas two drum-fed twins, El Cohetón a fat shoulder tube with a nose cone,
// La Lejana a long scoped rifle, La Bazuca a slim launcher with its warhead showing.
// Origin at the grip, +Z down the barrel. `userData.tip` is the muzzle's z.
// The shared kit of parts: every piece's geometry and material is disposed with the model.
function parts(group) {
 const geometries=new Set(), materials=new Set();
 const mat=(c,o={})=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.42,...o});materials.add(m);return m;};
 const put=(geo,m,x,y,z,to=group)=>{geometries.add(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);to.add(o);return o;};
 const box=(w,h,d,m,x,y,z,to,r=.03)=>put(new RoundedBoxGeometry(w,h,d,2,r),m,x,y,z,to);
 // A plain block for small fittings: 12 triangles instead of a rounded box's few hundred.
 const cube=(w,h,d,m,x,y,z,to)=>put(new THREE.BoxGeometry(w,h,d),m,x,y,z,to);
 // Cylinders lie along Z: `front` radius first, then `rear`.
 const tube=(front,rear,len,m,x,y,z,to,sides=16)=>{const o=put(new THREE.CylinderGeometry(front,rear,len,sides),m,x,y,z,to);o.rotation.x=Math.PI/2;return o;};
 const blob=(r,m,x,y,z,sx,sy,sz,to)=>{const o=put(new THREE.SphereGeometry(r,16,12),m,x,y,z,to);o.scale.set(sx,sy,sz);return o;};
 const lean=(o,x)=>{o.rotation.x=x;return o;};
 let disposed=false; const dispose=()=>{if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
 return {mat,put,box,cube,tube,blob,lean,dispose};
}
export function createPaintKit({color='#f28b42',weapon='pistol',attachments=[],charm='none',pattern='splat'}={}) {
 const group=new THREE.Group(), {mat,put,box,cube,tube,blob,lean,dispose}=parts(group);
 const paint=mat(color),dark=mat('#344847',{roughness:.55}),cream=mat('#f8e9c9'),steel=mat('#a9bfc0',{metalness:.6,roughness:.3}),ink=mat('#16161a',{roughness:.6}),coral=mat('#ff4b4b'),wood=mat('#8b5e3c',{roughness:.7});
 const lens=()=>mat('#5fd8ff',{emissive:'#1b6f8a',roughness:.1,metalness:.3});
 let tip=1.05,top=.28;
 if(weapon==='sniper') {
  // A bolt rifle: wooden stock, painted receiver, long steel barrel, a fat scope on top.
  tip=1.78;top=.28;
  box(.15,.17,.72,paint,0,.16,.22);
  lean(box(.13,.25,.62,wood,0,.05,-.42),.1);
  cube(.15,.3,.05,ink,0,.02,-.75);
  cube(.09,.06,.3,wood,0,.21,-.36);
  lean(box(.12,.3,.14,dark,0,-.12,.02),-.25);
  cube(.03,.08,.12,ink,0,-.02,.13);
  cube(.1,.16,.14,dark,0,.0,.32);
  cube(.13,.11,.5,dark,0,.12,.78);
  tube(.04,.046,1.1,steel,0,.17,1.12,group,12);
  tube(.065,.065,.14,dark,0,.17,1.7,group,12);
  tube(.068,.068,.03,coral,0,.17,1.6,group,12);
  tube(.046,.046,.62,ink,0,.36,.26,group,14);
  tube(.07,.048,.16,ink,0,.36,.62,group,14);
  tube(.05,.062,.12,ink,0,.36,-.1,group,14);
  tube(.06,.06,.012,lens(),0,.36,.705,group,14);
  for(const z of [.08,.42]) cube(.05,.1,.05,dark,0,.28,z);
  put(new THREE.CylinderGeometry(.024,.024,.05,10),cream,0,.42,.26);
  const bolt=put(new THREE.CylinderGeometry(.018,.018,.15,8),steel,.1,.2,.02); bolt.rotation.z=Math.PI/2;
  put(new THREE.SphereGeometry(.035,8,6),ink,.18,.2,.02);
  for(const x of [-.04,.04]) cube(.025,.025,.42,dark,x,.08,1.02);
 } else if(weapon==='bazooka') {
  // A long, slim launcher on the shoulder: flared rear bell, the warhead poking
  // out of the front, a box sight on the left and two grips under it.
  tip=1.62;top=.37;
  tube(.13,.13,1.9,paint,0,.24,.25);
  tube(.16,.14,.12,dark,0,.24,1.2);
  blob(.13,coral,0,.24,1.32,1,1,1.6);
  lean(put(new THREE.ConeGeometry(.055,.16,12),cream,0,.24,1.58),Math.PI/2);
  tube(.14,.22,.3,dark,0,.24,-.82);
  for(const z of [.85,-.4]) tube(.137,.137,.06,cream,0,.24,z);
  box(.12,.1,.42,ink,0,.09,-.24);
  lean(box(.12,.3,.14,dark,0,-.08,.0),-.2);
  cube(.03,.08,.12,ink,0,.02,.12);
  lean(box(.1,.26,.11,dark,0,-.03,.56),.1);
  box(.08,.14,.22,dark,-.19,.32,.3);
  tube(.035,.035,.03,lens(),-.19,.34,.42,group,10);
  cube(.03,.1,.03,ink,0,.41,.98); cube(.07,.08,.03,ink,0,.41,-.1);
 } else if(weapon==='rocket') {
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
 // `sight`: the height of the sight line (the scope's axis on La Lejana), for aiming poses.
 group.userData.tip=tip; group.userData.sight=weapon==='sniper'?.36:top;
 if(attachments.includes('barrel')) tube(.06,.07,.3,cream,0,top-.11,tip+.1,group);
 if(attachments.includes('hopper')) blob(.23,paint,0,top+.42,.12,1,.7,1.4,group);
 if(attachments.includes('stock')) box(.12,.12,.45,cream,0,.1,-.45,group,.02);
 if(charm!=='none') { const c=put(new THREE.SphereGeometry(.09,10,8),mat(charm==='mango'?'#ffc629':color),.23,-.3,.05); if(charm==='mango') c.scale.y=1.4; }
 if(pattern==='stripe') for(let i=0;i<3;i++) put(new THREE.BoxGeometry(.2,.02,.04),cream,0,top-.01,i*.12);
 if(pattern==='dots') for(let i=0;i<3;i++) put(new THREE.SphereGeometry(.025,6,4),cream,.105,top-.13,i*.12);
 group.name={pistol:'La Chispa',scatter:'El Trueno',rapid:'Las Gemelas',rocket:'El Cohetón',sniper:'La Lejana',bazooka:'La Bazuca'}[weapon];
 group.userData.dispose=dispose;return group;
}
// The barrel's axis height above the grip, per marker: where a muzzle flash or
// a shell leaves the barrel.
export const PAINT_KIT_BORE={pistol:.17,scatter:.2,rapid:.15,rocket:.2,sniper:.17,bazooka:.24};
// The same marker batched into a few draws (one per surface finish instead of
// one per part), for scenes that show several held at once in third person.
// Same look and the same `userData.tip`/`sight`, plus `bore`; geometry is new
// and owned, so clones (`.clone()`) share it. `userData.dispose` frees it.
export function bakePaintKit(options={}) {
 const kit=createPaintKit(options), out=bake(kit,{tint:true});
 out.name=kit.name; Object.assign(out.userData,{tip:kit.userData.tip,sight:kit.userData.sight,bore:PAINT_KIT_BORE[options.weapon||'pistol']});
 const tinted=out.userData.tinted;
 out.userData.dispose=()=>{out.traverse(o=>{if(o.isMesh)o.geometry.dispose();});tinted.forEach(m=>m.dispose());kit.userData.dispose();};
 return out;
}
// La Bazuca's rocket in flight: painted body, coral warhead, four fins and a glowing
// motor at the back. Centred, +Z is the nose; about 0.75 m long.
export function createPaintRocket({color='#f28b42'}={}) {
 const group=new THREE.Group(), {mat,put,tube,blob,lean,dispose}=parts(group);
 const paint=mat(color),coral=mat('#ff4b4b'),cream=mat('#f8e9c9'),dark=mat('#344847',{roughness:.55});
 tube(.075,.075,.42,paint,0,0,0,group,12);
 blob(.075,coral,0,0,.25,1,1,1.9);
 tube(.078,.078,.04,cream,0,0,.12,group,12);
 tube(.06,.08,.1,dark,0,0,-.26,group,12);
 const fin=new THREE.BoxGeometry(.012,.12,.14);
 for(let i=0;i<4;i++){const f=put(fin,dark,Math.cos(i*Math.PI/2)*.1,Math.sin(i*Math.PI/2)*.1,-.17);f.rotation.z=i*Math.PI/2+Math.PI/2;}
 lean(put(new THREE.ConeGeometry(.055,.2,10,1,true),mat('#ffb347',{emissive:'#ff7a1a',emissiveIntensity:2.5,transparent:true,opacity:.85,side:THREE.DoubleSide}),0,0,-.4),-Math.PI/2);
 group.name='Cohete de La Bazuca';
 group.userData.dispose=dispose;return group;
}
export function createPaintVest() {
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#344847',roughness:.85}),geometry=new THREE.BoxGeometry(.58,.55,.13);
 for(const z of [-.2,.2]) {const pad=new THREE.Mesh(geometry,material);pad.position.set(0,1.08,z);group.add(pad);}
 for(const x of [-.18,.18]) {const pad=new THREE.Mesh(geometry,material);pad.scale.set(.3,.6,1.2);pad.position.set(x,1.06,.29);group.add(pad);}
 group.name='El Acolchado'; group.userData.dispose=()=>{geometry.dispose();material.dispose();};return group;
}
