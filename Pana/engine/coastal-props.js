// Pana-authored coastal kit. Metres, ground origin, front +Z; no external assets.
// Static parts are batched per material. Animated children use absolute time.
import * as THREE from 'three';
import { M, mesh, box, tube } from './props.js';
import { finish, rounded, curve, sign, railing } from './architecture-kit.js';
import { cylinder, ring, plank } from './rural-kit.js';

const C = {
  cream:M(0xf3e5c3), teal:M(0x368e92), coral:M(0xda6850),
  wood:M(0xac8354,{roughness:1}), dark:M(0x514938), rope:M(0xcab98e,{roughness:1}),
  steel:M(0x6c8b8b,{metalness:.45}), black:M(0x243d42), sand:M(0xe8d4a3,{roughness:1}),
};
function asset(group,id,name,batch=true) {
  const out=batch?finish(group,name):group;
  out.name=name;out.userData.assetId=id;return out;
}
function oval(rx,ry,rz,mat,x,y,z) {
  const o=mesh(new THREE.SphereGeometry(1,16,10),mat,x,y,z);o.scale.set(rx,ry,rz);return o;
}
function lifeRing(x=0,y=0,z=0,r=.45) {
  const g=new THREE.Group();g.position.set(x,y,z);
  g.add(ring(r,r*.23,C.cream));
  for(let i=0;i<4;i++)g.add(mesh(new THREE.TorusGeometry(r,r*.24,6,6,.48),C.coral));
  g.children.slice(1).forEach((p,i)=>p.rotation.z=i*Math.PI/2-.24);
  g.add(ring(r*1.35,.018,C.rope));return g;
}
function ropeCoil(g,x,y,z,r=.35) {
  for(let i=0;i<4;i++){const o=ring(r-i*.065,.027,C.rope,x,y+.03,z);o.rotation.x=Math.PI/2;g.add(o);}
}

export function fishingBoat({color=0x368e92}={}) {
  const g=new THREE.Group(),paint=M(color),sections=[[-3,.8],[-2.4,1.05],[-1,1.15],[1,1],[2.4,.55],[3.4,.015]];
  // Open hull: separate inner and outer skins, joined along the gunwale.
  for(const side of [-1,1]) {
    const positions=[],inner=[],indices=[];
    sections.forEach(([z,w],i)=>{
      const lift=i===5?.5:i===0?.12:0;
      for(const [factor,y] of [[.26,.09],[.72,.48],[1,1.15]]) {
        positions.push(side*w*factor,y+lift,z);
        inner.push(side*Math.max(.005,w*factor-.09),y+lift+.07,z);
      }
      if(i<sections.length-1)for(let j=0;j<2;j++){const a=i*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
    });
    for(const [ps,mat] of [[positions,M(color,{side:THREE.DoubleSide})],[inner,M(0xe8d3a6,{side:THREE.DoubleSide})]]) {
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setIndex(indices);geo.computeVertexNormals();g.add(mesh(geo,mat));
    }
    const rim=sections.map(([z,w],i)=>[side*w,1.2+(i===5?.5:i===0?.12:0),z]);
    g.add(curve(rim,.065,C.cream,32));
    g.add(curve(rim.map(([x,y,z])=>[x*.91,y-.23,z]),.035,C.coral,32));
  }
  const keelPoints=[],keelIndices=[];
  sections.forEach(([z,w],i)=>{
    const y=.09+(i===5?.5:i===0?.12:0);keelPoints.push(-w*.26,y,z,w*.26,y,z);
    if(i<sections.length-1){const a=i*2;keelIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
  });
  const keel=new THREE.BufferGeometry();keel.setAttribute('position',new THREE.Float32BufferAttribute(keelPoints,3));keel.setIndex(keelIndices);keel.computeVertexNormals();
  g.add(mesh(keel,M(color,{side:THREE.DoubleSide})));
  g.add(box(1.58,1,.13,paint,0,.7,-3));
  for(let i=0;i<9;i++){
    const z=-2.4+i*.5;g.add(box(Math.min(1.1,1.45-Math.max(0,z)*.28),.08,.45,C.wood,0,.53,z));
  }
  for(const [z,w] of [[-1.85,1.92],[-.25,2.06],[1.35,1.62]])g.add(rounded(w,.14,.48,C.wood,0,1.02,z));
  // Stern-mounted outboard, tiller, oars and a bow rope.
  g.add(rounded(.54,.64,.6,C.black,0,1.1,-3.18),box(.13,.65,.12,C.steel,0,.43,-3.35));
  g.add(tube([0,1.1,-3.1],[.42,1.15,-2.5],.035,C.black));
  const prop=box(.46,.08,.1,C.steel,0,.14,-3.4);prop.rotation.z=.4;g.add(prop);
  for(const side of [-1,1]){
    g.add(tube([side*.63,1.16,-1.9],[side*.76,1.2,1.8],.035,C.wood));
    g.add(rounded(.19,.055,.65,C.wood,side*.76,1.2,1.95));
  }
  ropeCoil(g,0,1.1,1.35,.24);g.add(lifeRing(.9,1.03,-1.2,.25));
  return asset(g,'fishing-boat','Peñero de pesca');
}

export function coastalLighthouse() {
  const g=new THREE.Group();
  g.add(cylinder(2.35,2.55,.3,C.sand,0,.15),cylinder(1.28,1.9,9.2,C.cream,0,4.9,0,24));
  for(const y of [2.2,5.1,8]) {
    const r=1.9-(y-.3)/9.2*.62;
    const taper=.62/9.2*.525;
    g.add(cylinder(r+.025-taper,r+.025+taper,1.05,C.teal,0,y,0,24));
  }
  g.add(rounded(.86,1.75,.12,C.wood,0,1.18,1.84),box(1,.15,.7,C.sand,0,.38,2.03));
  for(const y of [4,7])g.add(rounded(.42,.72,.12,C.black,0,y,1.94-y*.067));
  g.add(cylinder(2,2,.24,C.teal,0,9.52,0,24));
  for(let i=0;i<20;i++){
    const a=i*Math.PI/10,x=Math.cos(a)*1.83,z=Math.sin(a)*1.83;
    g.add(tube([x,9.64,z],[x,10.55,z],.033,C.cream));
  }
  const rail=ring(1.83,.045,C.cream,0,10.55);rail.rotation.x=Math.PI/2;g.add(rail);
  g.add(cylinder(1.1,1.1,.18,C.black,0,9.72),cylinder(.08,1.45,.9,C.coral,0,11.9,0,16));
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;g.add(tube([Math.cos(a),9.8,Math.sin(a)],[Math.cos(a),11.5,Math.sin(a)],.065,C.cream));
  }
  g.add(cylinder(1.15,1.15,.15,C.cream,0,11.48),oval(.42,.62,.42,M(0xffd27c,{emissive:0xe5a044,emissiveIntensity:.45}),0,10.6,0));
  g.add(tube([0,12.25,0],[0,13.1,0],.045,C.steel));
  return asset(g,'coastal-lighthouse','Faro costero');
}

export function lifeguardTower() {
  const g=new THREE.Group();
  for(const x of [-1.25,1.25])for(const z of [-1,1]) {
    g.add(box(.28,3.2,.28,C.wood,x,1.6,z),box(.65,.16,.65,C.sand,x,.08,z));
  }
  for(const side of [-1,1]){
    g.add(tube([side*1.25,.3,-1],[side*1.25,2.8,1],.08,C.wood));
    g.add(tube([-1.25,.3,side],[1.25,2.8,side],.08,C.wood));
  }
  for(let i=0;i<10;i++)g.add(box(.29,.16,2.7,C.wood,-1.35+i*.3,3.08,0));
  for(const x of [-1.25,1.25])g.add(box(.13,2.15,.13,C.cream,x,4.2,-1));
  for(const x of [-1.25,1.25])g.add(box(.13,2.15,.13,C.cream,x,4.2,1));
  for(const side of [-1,1])railing(g,[side*1.35,3.16,-1.25],[side*1.35,3.16,1.25],{material:C.cream,spacing:.5});
  railing(g,[-1.35,3.16,-1.25],[1.35,3.16,-1.25],{material:C.cream,spacing:.5});
  const roof=mesh(new THREE.ConeGeometry(2.4,.85,4),C.coral,0,5.7);roof.rotation.y=Math.PI/4;roof.scale.z=.9;g.add(roof);
  g.add(rounded(1.5,.13,.62,C.teal,0,3.75,-.45),rounded(1.5,.65,.1,C.teal,0,4.15,-.75));
  for(let i=0;i<7;i++)g.add(box(.9,.12,.32,C.wood,0,.3+i*.43,2.7-i*.2));
  for(const x of [-.52,.52])g.add(tube([x,.15,2.85],[x,3.12,1.3],.07,C.cream));
  g.add(lifeRing(1.36,3.7,.3,.32));g.children.at(-1).rotation.y=Math.PI/2;
  const label=sign(['PLAYA PANA','SALVAVIDAS'],2.35,.65,{background:'#368e92'});label.position.set(0,4.68,1.12);g.add(label);
  return asset(g,'lifeguard-tower','Torre de salvavidas');
}

export function beachVolleyball() {
  const g=new THREE.Group();
  g.add(box(10,.08,17,C.sand,0,.04,0));
  for(const x of [-4,4])g.add(box(.07,.02,16,C.cream,x,.091,0));
  for(const z of [-8,8])g.add(box(8,.02,.07,C.cream,0,.091,z));
  for(const x of [-4.65,4.65]){
    g.add(cylinder(.075,.075,2.85,C.cream,x,1.465),cylinder(.14,.14,1.7,C.teal,x,.94));
    g.add(tube([x,2.7,0],[x*1.06,.1,1.5],.017,C.rope));
  }
  // A real open mesh net, including sag and top/bottom tape.
  const sag=x=>.11*(1-(x/4.65)**2);
  for(let j=0;j<=5;j++)g.add(curve(Array.from({length:13},(_,i)=>{const x=-4.65+i*.775;return [x,2.75-j*.2-sag(x),0];}),j===0||j===5?.025:.009,j===0||j===5?C.cream:C.dark,24));
  for(let i=0;i<=46;i++){const x=-4.6+i*.2;g.add(tube([x,1.75-sag(x),0],[x,2.75-sag(x),0],.009,C.dark));}
  const ball=mesh(new THREE.SphereGeometry(.22,18,12),C.cream,1.6,.3,3.2);g.add(ball);
  for(const rotation of [0,Math.PI/2]){const seam=ring(.22,.012,C.teal,1.6,.3,3.2);seam.rotation.y=rotation;g.add(seam);}
  return asset(g,'beach-volleyball','Cancha de voleibol de playa');
}

export function beachShower() {
  const g=new THREE.Group();
  for(let i=0;i<8;i++)g.add(box(.22,.16,1.9,C.wood,-.805+i*.23,.08,0));
  g.add(cylinder(.09,.09,2.85,C.steel,0,1.585,-.65));
  g.add(curve([[0,2.8,-.65],[0,3.15,-.6],[0,3.24,-.3],[0,3.12,.17]],.055,C.steel));
  g.add(cylinder(.2,.14,.1,C.cream,0,3.07,.17));
  g.add(tube([0,1.22,-.65],[0,1.22,-.42],.05,C.steel));
  g.add(ring(.1,.025,C.coral,0,1.22,-.39));
  for(let i=0;i<7;i++)g.add(box(.28,.012,.025,C.dark,0,.165,-.22+i*.07));
  return asset(g,'beach-shower','Ducha de playa');
}

export function rescueRingStand() {
  const g=new THREE.Group();g.add(cylinder(.55,.65,.12,C.sand,0,.06));
  g.add(box(.13,2.3,.13,C.wood,0,1.27,0),box(1.1,.12,.14,C.wood,0,1.6,0));
  g.add(lifeRing(0,1.38,.16));
  const label=sign('SALVAVIDAS',1.5,.32,{background:'#da6850'});label.position.set(0,2.17,.08);g.add(label);
  g.add(curve([[-.46,1.4,.2],[-.62,.4,.22],[-.3,.3,.25],[.1,.4,.25],[.45,1.42,.2]],.023,C.rope));
  return asset(g,'rescue-ring-stand','Puesto de salvavidas');
}

export function fishingNetRack() {
  const g=new THREE.Group();
  for(const x of [-1.9,1.9])g.add(cylinder(.09,.12,2.65,C.wood,x,1.325),box(.7,.1,.7,C.sand,x,.05,0));
  g.add(tube([-2.15,2.45,0],[2.15,2.45,0],.09,C.wood));
  const point=(x,y)=>[x,2.38-y-.28*(1-(x/1.8)**2),Math.sin(y*2.4+x)*.12];
  for(let i=0;i<19;i++)g.add(curve(Array.from({length:9},(_,j)=>point(-1.8+i*.2,j*.2)),.012,C.rope,12));
  for(let j=0;j<9;j++)g.add(curve(Array.from({length:19},(_,i)=>point(-1.8+i*.2,j*.2)),.012,C.rope,24));
  for(let i=0;i<10;i++){const p=point(-1.8+i*.4,0);g.add(oval(.065,.12,.065,i%2?C.coral:C.cream,...p));}
  ropeCoil(g,1.25,.08,.45,.4);
  return asset(g,'fishing-net-rack','Secadero de redes');
}

export function fishCrates() {
  const g=new THREE.Group();
  for(const [x,y,z] of [[-.58,0,0],[.63,0,.14],[-.58,.62,0]]) {
    const crate=new THREE.Group();crate.position.set(x,y,z);
    crate.add(box(1.08,.1,.78,C.wood,0,.05,0));
    for(const xx of [-.5,.5])for(const zz of [-.34,.34])crate.add(box(.07,.56,.07,C.dark,xx,.32,zz));
    for(let row=0;row<3;row++){
      for(const zz of [-.38,.38])plank(crate,1.1,.12,.07,0,.19+row*.17,zz);
      for(const xx of [-.53,.53])crate.add(box(.07,.12,.72,C.wood,xx,.19+row*.17,0));
    }
    // Stylized silver catch: solid fish silhouettes, separate from live reef fauna.
    for(let i=0;i<4;i++){
      const xx=-.36+i*.24,yy=.48+(i%2)*.04;
      crate.add(oval(.09,.07,.27,C.steel,xx,yy,0));
      const tail=mesh(new THREE.ConeGeometry(.12,.16,3),C.steel,xx,yy,-.3);tail.rotation.x=-Math.PI/2;tail.scale.z=.35;crate.add(tail);
      crate.add(oval(.025,.012,.025,C.black,xx,yy+.06,.17));
    }
    g.add(crate);
  }
  return asset(g,'fish-crates','Cajas de pesca');
}

export function channelBuoy() {
  const g=new THREE.Group(),body=new THREE.Group();
  body.add(cylinder(.54,.7,.32,C.coral,0,.3,0,20),cylinder(.3,.54,.65,C.coral,0,.785,0,20));
  body.add(cylinder(.29,.32,.22,C.cream,0,.84,0,20),cylinder(.045,.045,1.05,C.steel,0,1.46));
  body.add(mesh(new THREE.ConeGeometry(.24,.38,16),C.coral,0,2.08));
  body.add(ring(.1,.028,C.steel,0,2.35));
  const bob=finish(body,'Boya');g.add(bob);
  g.userData.tick=(t=0)=>{if(!Number.isFinite(t))return;bob.position.y=.045*Math.sin(t*1.4);bob.rotation.z=.045*Math.sin(t*.9);bob.rotation.x=.025*Math.sin(t*1.2);};
  g.userData.tick(0);return asset(g,'channel-buoy','Boya de canal',false);
}

export function beachCrab() {
  const g=new THREE.Group(),fixed=new THREE.Group(),shell=M(0xd56b43),light=M(0xec9b61);
  fixed.add(oval(.44,.23,.32,shell,0,.39,0),oval(.35,.055,.24,light,0,.23,0));
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const z=-.24+i*.16,x=.68+Math.sin(i*.9)*.13;
    fixed.add(tube([side*.3,.35,z],[side*x,.29,z-.17],.041,shell));
    fixed.add(tube([side*x,.29,z-.17],[side*(x+.12),.035,z-.29],.028,light));
  }
  for(const side of [-1,1]){
    fixed.add(tube([side*.19,.5,.2],[side*.21,.7,.28],.028,light));
    fixed.add(oval(.066,.075,.063,C.black,side*.21,.73,.28));
    fixed.add(oval(.019,.025,.016,C.cream,side*.205,.75,.332));
  }
  g.add(finish(fixed,'Caparazón y patas'));
  const claws=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group(),claw=new THREE.Group();pivot.position.set(side*.35,.38,.2);
    claw.add(tube([0,0,0],[side*.21,.02,.21],.06,shell));
    claw.add(oval(.16,.13,.22,shell,side*.23,.08,.35));
    for(const edge of [-1,1]){
      const finger=mesh(new THREE.ConeGeometry(.073,.24,8),light,side*.23+edge*.095,.08,.57);
      finger.rotation.x=Math.PI/2;finger.rotation.z=-edge*.2;claw.add(finger);
    }
    pivot.add(finish(claw,'Pinza'));g.add(pivot);claws.push(pivot);
  }
  g.userData.species='crab';
  g.userData.tick=(t=0)=>{if(Number.isFinite(t))claws.forEach((p,i)=>{p.rotation.x=Math.sin(t*1.7+i*2)*.18;p.rotation.y=Math.sin(t*.8+i)*.1;});};
  g.userData.tick(0);return asset(g,'beach-crab','Cangrejo de playa',false);
}

// Match the small animal's planted feet to sloping beach terrain, preserving yaw.
export function groundBeachCrab(crab,groundAt,yaw=0) {
  const {x,z}=crab.position;
  const normal=new THREE.Vector3(groundAt(x-.5,z)-groundAt(x+.5,z),1,groundAt(x,z-.5)-groundAt(x,z+.5)).normalize();
  crab.position.y=groundAt(x,z)+.005;
  crab.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);crab.rotateY(yaw);
}
