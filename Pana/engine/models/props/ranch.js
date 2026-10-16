// Llanos 041–050. Ground origin, front +Z, independent owned geometry.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { finish, rounded, sign, curve, tiledRoof, shutterWindow, palette } from '/engine/models/core/architecture-kit.js';
import { rural, dimension, cylinder, ring, wheel, corrugatedRoof, ladder, plank } from '/engine/models/core/rural-kit.js';
import { waterPool } from '/engine/models/effects/water-surface.js';

export function llaneroRanchHouse() {
  const g=new THREE.Group(),white=M(0xeadfba,{roughness:1}),teal=M(0x397c77,{roughness:.9});
  g.add(box(7.6,.25,7.1,palette.stone,0,.125,.8),box(7,2.9,4.5,white,0,1.7,-.4),box(7.04,.55,4.54,M(0xc1a16a),0,.52,-.4));
  const roof=new THREE.Group();roof.position.z=-.4;tiledRoof(roof,{w:7.9,d:5.5,y:3.2,rise:1.25});g.add(roof);
  g.add(rounded(1.38,2.3,.12,palette.dark,0,1.4,1.9));
  for(let i=0;i<6;i++)plank(g,.19,2.2,.06,-.58+i*.23,1.4,1.99,{mat:teal,grain:false});
  g.add(mesh(new THREE.SphereGeometry(.055,8,5),palette.brass,.46,1.35,2.06));
  for(const x of [-2.25,2.25])shutterWindow(g,x,1.8,1.9,{w:1.2,h:1.4,color:0x397c77});
  const rear=new THREE.Group();rear.rotation.y=Math.PI;rear.position.z=-2.7;shutterWindow(rear,-1.8,1.8,0,{color:0x397c77});shutterWindow(rear,1.8,1.8,0,{color:0x397c77});g.add(rear);
  for(const x of [-3.35,0,3.35])g.add(box(.17,2.7,.17,rural.darkWood,x,1.6,3.75),box(.31,.28,.31,palette.stone,x,.39,3.75));
  g.add(box(7.1,.18,.2,rural.darkWood,0,2.95,3.75));
  const awning=box(7.8,.12,2.45,M(0xb7754a),0,3.14,2.88);awning.rotation.x=.16;g.add(awning);
  for(let x=-3.7;x<3.8;x+=.22)g.add(tube([x,3.37,1.65],[x,2.98,4.1],.055,M(0xc58453)));
  g.add(box(2.2,.13,.48,palette.stone,0,.065,4.5));
  // Hanging woven chinchorro between the porch columns.
  for(let j=0;j<12;j++) {const z=3.15+j*.045;g.add(curve([[-3.2,1.95,3.6],[-2.8,1.18,z],[-1.45,.92,z],[-.2,1.95,3.6]],.018,M(j%3===0?0xc65a40:j%3===1?0xc9ad63:0x5b8e84),16));}
  for(let i=0;i<10;i++){const x=-2.75+i*.24,y=.94+.2*Math.pow((x+1.5)/1.25,2);g.add(tube([x,y,3.15],[x,y,3.66],.013,rural.straw));}
  for(const x of [2.7,3.1])g.add(cylinder(.18,.27,.5,M(0xb86c46),x,.5,2.8),cylinder(.13,.16,.09,palette.dark,x,.79,2.8));
  const name=sign(['HATO PANA','LOS LLANOS'],1.7,.52);name.position.set(0,2.78,2.03);g.add(name);
  return finish(g,'LlaneroRanchHouse');
}

export function corralGate({span=6,open=.82}={}) {
  dimension(span,3,24,'span');dimension(open,0,1,'open');const g=new THREE.Group(),fixed=new THREE.Group(),leaves=[];
  for(const side of [-1,1]) {
    fixed.add(rounded(.32,2.1,.32,rural.darkWood,side*span/2,1.05,0));
    const pivot=new THREE.Group();pivot.name=side<0?'GateLeft':'GateRight';pivot.position.set(side*span/2,0,0);const leaf=new THREE.Group(),w=span/2-.2,c=-side*w/2;
    for(const y of [.45,1.05,1.65])plank(leaf,w,.19,.13,c,y,0);
    for(const x of [0,-side*w])leaf.add(box(.13,1.45,.16,rural.wood,x,1.05,0));
    leaf.add(tube([0,.4,.06],[-side*w,1.7,.06],.065,rural.darkWood));
    for(const y of [.5,1.6])leaf.add(cylinder(.075,.075,.22,rural.steel,0,y,0),box(.42,.09,.04,rural.steel,-side*.15,y,.1));
    pivot.add(finish(leaf,'GateLeaf'));g.add(pivot);leaves.push({pivot,side});
  }
  g.add(finish(fixed,'GatePosts'));g.name='CorralGate';
  g.userData.setOpen=value=>{dimension(value,0,1,'open');for(const {pivot,side}of leaves)pivot.rotation.y=side*value*Math.PI/2;};g.userData.setOpen(open);return g;
}

export function hayBale() {
  const g=new THREE.Group(),body=cylinder(.79,.79,1.6,rural.straw,0,.8,0,24);body.rotation.z=Math.PI/2;g.add(body);
  for(const x of [-.53,.53]){const strap=ring(.797,.024,rural.darkWood,x,.8,0);strap.rotation.y=Math.PI/2;g.add(strap);}
  for(const side of [-1,1]) {
    const points=[];for(let i=0;i<=100;i++){const a=i*.28,r=.05+i*.0067;points.push([side*.81,.8+Math.cos(a)*r,Math.sin(a)*r]);}g.add(curve(points,.014,M(0xa7863e),100));
  }
  for(let j=0;j<36;j++){const a=j*Math.PI/18;g.add(tube([-.78,.8+Math.cos(a)*.792,Math.sin(a)*.792],[.78,.8+Math.cos(a+.02)*.795,Math.sin(a+.02)*.795],.009,M(j%2?0xe1c377:0xb79748)));}
  return finish(g,'HayBale');
}

export function waterWindmill({height=9}={}) {
  dimension(height,5,16,'height');const g=new THREE.Group(),base=new THREE.Group(),h=height-1.5;
  for(const x of [-1,1])for(const z of [-1,1]) {
    base.add(box(.5,.18,.5,palette.stone,x,.09,z),tube([x,.15,z],[x*.27,h,z*.27],.065,rural.steel));
  }
  for(let y=.5;y<h-.5;y+=1.25) {
    const a=1-y/h*.73,b=1-(y+1.25)/h*.73;
    for(const s of [-1,1]){base.add(tube([-a,y,s*a],[b,y+1.25,s*b],.026,rural.steel),tube([a,y,s*a],[-b,y+1.25,s*b],.026,rural.steel),tube([s*a,y,-a],[s*b,y+1.25,b],.026,rural.steel),tube([-a,y,s*a],[a,y,s*a],.032,rural.steel));}
  }
  base.add(cylinder(.12,.12,h+.3,rural.darkWood,0,(h+.3)/2,0));
  base.add(tube([0,h,0],[0,h,-2],.08,rural.steel),box(1.1,.7,.04,M(0xb66846),0,h,-2));
  const tail=sign('PANA',.78,.3,{background:'#b66846'});tail.position.set(0,h,-1.97);base.add(tail);
  base.add(curve([[0,.4,0],[.2,.35,.4],[1.5,.35,.4],[1.65,.6,.4]],.085,rural.steel));ladder(base,.35,0,.38,h-1,{width:.35});
  g.add(finish(base,'WindPumpTower'));
  const rotor=new THREE.Group();rotor.name='WindRotor';rotor.position.set(0,h,.42);const blades=new THREE.Group();
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,b=box(.31,.77,.045,i%4===0?rural.rust:rural.steel,Math.sin(a)*.91,Math.cos(a)*.91,0);b.rotation.z=-a+.18;blades.add(b,tube([0,0,0],[Math.sin(a)*.65,Math.cos(a)*.65,0],.025,rural.steel));
  }
  blades.add(ring(.58,.025,rural.steel),mesh(new THREE.SphereGeometry(.19,12,8),M(0xb75a3c),0,0,.08));rotor.add(finish(blades,'WindBlades'));g.add(rotor);
  const rod=cylinder(.025,.025,h-1.1,rural.steel,.13,h/2,.1);rod.name='PumpRod';g.add(rod);
  g.name='WaterWindmill';g.userData.tick=t=>{rotor.rotation.z=-t*.7;rod.position.y=h/2+Math.sin(t*1.4)*.1;};return g;
}

export function horseStable() {
  const g=new THREE.Group();g.add(box(8.6,.15,5.5,palette.stone,0,.075,0));
  for(let y=.35;y<2.6;y+=.24)plank(g,8.3,.21,.12,0,y,-2.4);
  for(const x of [-4.1,-1.37,1.37,4.1]) {
    g.add(box(.19,3.3,.19,rural.darkWood,x,1.8,2.3),box(.19,3.3,.19,rural.darkWood,x,1.8,-2.3));
    for(let y=.35;y<1.65;y+=.26)g.add(box(.12,.21,4.6,rural.wood,x,y,0));
    g.add(tube([x,2.5,1.7],[x,3.35,2.3],.075,rural.darkWood));
  }
  g.add(box(8.5,.24,.22,rural.darkWood,0,3.35,2.3));corrugatedRoof(g,{w:9.2,d:5.9,y:3.5,rise:1.15,color:0x708980});
  for(const x of [-2.75,2.75])for(const y of [.6,1.1])plank(g,2.5,.24,.13,x,y,2.3);
  // Middle stall remains open from the front to its bedding.
  for(const x of [-2.75,0,2.75]){g.add(box(1.7,.08,1.5,rural.straw,x,.19,-1.1));const bucket=cylinder(.22,.17,.4,rural.steel,x+.7,.37,.5);g.add(bucket);const handle=ring(.22,.018,rural.steel,x+.7,.66,.5);g.add(handle);}
  const bale=hayBale();bale.scale.setScalar(.65);bale.position.set(-2.8,.15,-1.25);g.add(bale);
  const label=sign('CABALLERIZA',2.4,.48);label.position.set(0,3.3,2.45);g.add(label);
  return finish(g,'HorseStable');
}

export function feedingTrough() {
  const g=new THREE.Group();for(const x of [-1.35,1.35])for(const z of [-.4,.4])g.add(box(.13,.7,.13,rural.darkWood,x,.35,z));
  g.add(box(3.25,.12,.48,rural.wood,0,.53,0));
  for(const side of [-1,1]){const wall=box(3.4,.53,.09,rural.wood,0,.78,side*.39);wall.rotation.x=side*.36;g.add(wall);g.add(box(3.5,.08,.1,rural.darkWood,0,1.03,side*.48));}
  for(const x of [-1.64,1.64])g.add(box(.11,.5,.74,rural.wood,x,.78,0));
  const r=rng(46);for(let i=0;i<40;i++) {const x=(r()-.5)*2.9,z=(r()-.5)*.5;g.add(tube([x,.72,z],[x+.22,.77+r()*.05,z+.09],.018,i%2?rural.straw:M(0xdfc780)));}
  return finish(g,'CattleFeedingTrough');
}

export function ranchFence({span=8}={}) {
  dimension(span,2,30,'span');const g=new THREE.Group(),n=Math.ceil(span/2.5);
  for(let i=0;i<=n;i++)g.add(rounded(.19,1.65,.19,rural.darkWood,-span/2+i*span/n,.825,0));
  for(const y of [.45,.9,1.35])plank(g,span,.16,.11,0,y,.06);
  for(let i=0;i<n;i++)g.add(tube([-span/2+i*span/n,.37,-.02],[-span/2+(i+1)*span/n,1.42,-.02],.045,rural.wood));
  return finish(g,'RanchFence');
}

export function oldTractor() {
  const g=new THREE.Group(),paint=M(0xa74f38,{roughness:.9}),dark=M(0x394947,{metalness:.4,roughness:.8});
  for(const z of [-1.05,1.25])for(const side of [-1,1]){const r=z<0?.9:.53,w=wheel(r,z<0?.43:.28,{hub:0xc3b88a});w.position.set(side*(z<0?1.02:.77),r,z);g.add(w);}
  g.add(box(1.4,.25,3.4,dark,0,.74,0),rounded(1.12,.94,1.65,paint,0,1.4,.9,.12));
  g.add(box(.99,.66,.04,dark,0,1.34,1.75));for(let x=-.42;x<.44;x+=.105)g.add(box(.036,.57,.035,rural.steel,x,1.34,1.79));
  g.add(box(1.65,.15,.23,rural.steel,0,.75,1.98));
  for(const x of [-.46,.46]){const lamp=cylinder(.13,.13,.12,palette.cream,x,1.78,1.72);lamp.rotation.x=Math.PI/2;g.add(lamp);}
  for(const side of [-1,1]){
    const fender=mesh(new THREE.CylinderGeometry(1.01,1.01,.55,20,1,true,0,Math.PI),paint,side*1.02,.9,-1.05);fender.rotation.z=Math.PI/2;g.add(fender);
    g.add(tube([side*.55,1.25,-1.05],[side*.85,1.85,-1.05],.035,dark));
    g.add(box(.2,.14,.7,rural.steel,side*.72,.67,-.12));
    for(let i=0;i<6;i++)g.add(box(.025,.4,.08,rural.darkWood,side*.575,1.4,.5+i*.17));
    for(let i=0;i<4;i++)g.add(cylinder(.09,.09,.36,dark,side*.54,.87,.4+i*.26));
  }
  g.add(cylinder(.055,.065,1.48,dark,.35,2.1,1.1),cylinder(.08,.08,.32,rural.rust,.35,1.6,1.1),box(.17,.035,.16,dark,.35,2.86,1.08));
  g.add(cylinder(.08,.12,.5,dark,0,1,-1.05),rounded(.72,.14,.62,rural.darkWood,0,1.3,-1.05),rounded(.7,.47,.12,rural.darkWood,0,1.55,-1.31));
  g.add(tube([0,1.1,-.25],[0,1.87,-.5],.045,dark));const steering=ring(.27,.025,dark,0,1.88,-.5);steering.rotation.x=-1.23;g.add(steering);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3;g.add(tube([0,1.88,-.5],[Math.cos(a)*.24,1.88+Math.sin(a)*.08,-.5+Math.sin(a)*.23],.015,dark));}
  g.add(tube([-.32,.7,-1.65],[0,.52,-2],.07,rural.steel),tube([.32,.7,-1.65],[0,.52,-2],.07,rural.steel));
  const badge=sign('PANA 48',.65,.16,{background:'#a74f38'});badge.position.set(0,1.7,1.78);g.add(badge);
  for(let i=0;i<5;i++)g.add(box(.12+i%2*.08,.04,.01,rural.rust,-.36+i*.16,1.56-i%2*.1,1.785));
  return finish(g,'OldTractor');
}

export function mudPuddle({rx=2.8,rz=1.8,seed=49}={}) {
  dimension(rx,.5,12,'rx');dimension(rz,.5,12,'rz');const g=new THREE.Group(),mud=new THREE.Group(),r=rng(seed),earth=M(0x705239,{roughness:.94});
  const rim=mesh(new THREE.CircleGeometry(1,48),earth);rim.rotation.x=-Math.PI/2;rim.scale.set(rx*1.12,rz*1.12,1);rim.position.y=.012;mud.add(rim);
  for(let i=0;i<25;i++){const a=i*Math.PI*2/25,b=mesh(new THREE.DodecahedronGeometry(.08+r()*.08,0),earth,Math.cos(a)*rx*1.02,.07,Math.sin(a)*rz*1.02);b.scale.set(1,.45,1);mud.add(b);}
  for(const z of [-rz*.68,rz*.68])for(let i=0;i<12;i++){const tread=box(rx*.1,.012,.12,M(0x463b2d),-rx*.65+i*rx*.12,.026,z);tread.rotation.y=.3;mud.add(tread);}
  g.add(finish(mud,'MudBank'));const water=waterPool(rx,rz,{color:0x896849,depth:.28});water.position.y=.035;water.material.uniforms.amplitude.value=.003;water.material.uniforms.sky.value.set(0xa49a79);g.add(water);g.name='MudPuddle';g.userData.tick=t=>water.userData.tick(t);return g;
}

export function ranchWaterTower() {
  const g=new THREE.Group(),steel=M(0x82918a,{metalness:.5,roughness:.75});
  for(const x of [-1.2,1.2])for(const z of [-1.2,1.2])g.add(box(.5,.18,.5,palette.stone,x,.09,z),tube([x,.18,z],[x*.8,5.6,z*.8],.11,rural.darkWood));
  for(const side of [-1,1])for(let y=.4;y<4.6;y+=2.1){g.add(tube([-1.1,y,side*1.1],[1.05,y+2,side*1.05],.055,rural.wood),tube([1.1,y,side*1.1],[-1.05,y+2,side*1.05],.055,rural.wood),tube([side*1.1,y,-1.1],[side*1.05,y+2,1.05],.055,rural.wood));}
  g.add(box(3.3,.19,3.3,rural.darkWood,0,5.5,0),cylinder(1.25,1.25,2.45,steel,0,6.83,0,32));
  for(let y=5.7;y<8;y+=.23){const hoop=ring(1.255,.032,steel,0,y,0);hoop.rotation.x=Math.PI/2;g.add(hoop);}
  for(const y of [5.75,7.86]){const hoop=ring(1.27,.055,rural.darkWood,0,y,0);hoop.rotation.x=Math.PI/2;g.add(hoop);}
  g.add(cylinder(0,1.38,.6,rural.steel,0,8.35,0,24));ladder(g,1.48,0,1.3,8.2);
  g.add(curve([[0,5.65,0],[.9,5.4,0],[1.35,5,0],[1.35,.55,0],[1.7,.55,.4]],.065,rural.steel));
  const valve=ring(.17,.025,M(0xb85538),1.35,1.2,.12);g.add(valve);
  const label=sign(['AGUA','HATO PANA'],1.2,.55,{background:'#82918a'});label.position.set(0,6.9,1.265);g.add(label);
  return finish(g,'RanchWaterTower');
}
