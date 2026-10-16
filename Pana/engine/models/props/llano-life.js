// Reusable Llanos habitat and ranch furniture. Metres, +Y up, +Z front.
import * as THREE from 'three';
import {M,mesh,box,tube,rng} from '/engine/models/core/primitives.js';
import {finish,rounded,curve,sign} from '/engine/models/core/architecture-kit.js';
import {rural,dimension,cylinder,ring,plank} from '/engine/models/core/rural-kit.js';

const rope=M(0xc8b58b,{roughness:1}),cloth=M(0xc46743,{side:THREE.DoubleSide,roughness:1});
function coil(g,x,y,z,r=.28){for(let i=0;i<4;i++){const o=ring(r-i*.05,.022,rope,x,y+i*.008,z);o.rotation.x=-Math.PI/2;g.add(o);}}
function bucket(g,x,y,z){g.add(cylinder(.23,.18,.4,rural.steel,x,y+.2,z));g.add(cylinder(.205,.205,.015,M(0x414d42),x,y+.4,z));const h=ring(.22,.018,rural.steel,x,y+.5,z);g.add(h);}

export function ranchCaney(){
  const g=new THREE.Group(),straw=M(0xb09554,{roughness:1}),edge=M(0x907642);
  for(const x of [-2.7,2.7])for(const z of [-2.1,2.1]){
    g.add(cylinder(.12,.17,2.85,rural.darkWood,x,1.425,z));
    for(const s of [-1,1])g.add(tube([x,2.1,z],[x-s*.7,2.8,z],.055,rural.wood));
  }
  for(const z of [-2.1,2.1])g.add(tube([-2.8,2.8,z],[2.8,2.8,z],.1,rural.darkWood));
  for(const x of [-2.7,2.7])g.add(tube([x,2.8,-2.2],[x,2.8,2.2],.1,rural.darkWood));
  // Layered hipped palm roof, open on every side.
  for(let i=0;i<5;i++){
    const r=1-i*.17,roof=mesh(new THREE.ConeGeometry(1,1,4,1,true),i%2?edge:straw,0,2.8+i*.23+.36,0);roof.rotation.y=Math.PI/4;roof.scale.set(4.8*r,.95,3.9*r);g.add(roof);
  }
  for(const side of [-1,1])for(let i=0;i<38;i++)g.add(tube([-3.35+i*.18,2.74,side*2.7],[-3.35+i*.18,2.58+(i%3)*.03,side*2.7],.022,straw));
  g.add(tube([-1.1,4,0],[1.1,4,0],.1,rural.darkWood));
  return finish(g,'RanchCaney');
}

export function chinchorro(){
  const g=new THREE.Group();for(const side of [-1,1]){
    g.add(cylinder(.09,.14,2.25,rural.darkWood,side*2.4,1.125,0));
    g.add(tube([side*2.4,1.9,0],[side*3,.05,0],.028,rope));
  }
  const bed=new THREE.Group(),ps=[],cs=[],ix=[],palette=[0xc86a47,0xe8ce8d,0x487f75];
  for(let i=0;i<=24;i++)for(let j=0;j<=12;j++){
    const u=i/24,x=(u-.5)*3.7,v=j/12,z=(v-.5)*1.18*Math.pow(Math.sin(Math.PI*u),.5),y=.78+.65*(2*u-1)**2+.15*(2*v-1)**2;
    ps.push(x,y,z);const c=new THREE.Color(palette[Math.floor(j/2)%3]);cs.push(c.r,c.g,c.b);
    if(i<24&&j<12){const a=i*13+j;ix.push(a,a+13,a+1,a+1,a+13,a+14);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cs,3));geo.setIndex(ix);geo.computeVertexNormals();
  bed.add(mesh(geo,M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1})));
  for(const side of [-1,1])for(let j=0;j<7;j++)bed.add(tube([side*2.4,1.97,0],[side*1.5,1.23,(j/6-.5)*.74],.013,rope));
  const fabric=finish(bed,'WovenChinchorro');
  // Swing around the line between the two fixed rope anchors, not ground level.
  fabric.traverse(o=>o.geometry?.translate(0,-1.97,0));fabric.position.y=1.97;
  g.add(fabric);g.name='Chinchorro';g.userData.tick=t=>{fabric.rotation.x=Math.sin(t*.7)*.025;};return g;
}

export function saddleStand(){
  const g=new THREE.Group();for(const x of [-.55,.55])for(const z of [-.65,.65])g.add(tube([x,0,z],[x*.5,1.25,z*.8],.065,rural.darkWood));
  g.add(tube([0,1.27,-.85],[0,1.27,.85],.13,rural.wood));
  const blanket=rounded(1.15,.08,1.1,cloth,0,1.33,0);g.add(blanket);
  for(const x of [-.53,.53])g.add(box(.07,.58,1.1,cloth,x,1.07,0),box(.08,.07,1.12,M(0xe6c779),x,.85,0));
  const seat=mesh(new THREE.TorusGeometry(.36,.13,8,18,Math.PI),M(0x634431),0,1.48,0);seat.rotation.x=Math.PI/2;g.add(seat);
  g.add(rounded(.59,.12,.75,M(0x704a32),0,1.47,0),rounded(.65,.32,.13,M(0x583d2d),0,1.59,-.4),cylinder(.07,.09,.25,rural.darkWood,0,1.67,.32));
  for(const side of [-1,1]){g.add(tube([side*.36,1.4,.1],[side*.66,.58,.1],.025,rural.darkWood));const stirrup=ring(.15,.025,rural.steel,side*.66,.5,.1);stirrup.scale.y=1.2;g.add(stirrup);}
  coil(g,.13,.045,-.96);return finish(g,'SaddleStand');
}

export function hitchingRail({span=4}={}){
  dimension(span,2,8,'span');const g=new THREE.Group();
  for(const side of [-1,1])g.add(cylinder(.12,.16,1.45,rural.darkWood,side*span/2,.725,0));
  g.add(tube([-span/2-.2,1.27,0],[span/2+.2,1.27,0],.11,rural.wood));
  g.add(curve([[-.5,1.3,0],[-.5,.65,.18],[-.15,.45,.25],[.2,.75,.1],[.2,1.28,0]],.023,rope));
  coil(g,-.4,.025,.5);bucket(g,span/2-.4,0,.5);return finish(g,'HitchingRail');
}

export function campfire(){
  const g=new THREE.Group(),base=new THREE.Group(),random=rng(31);
  base.add(cylinder(.82,.86,.03,M(0x514b3b),0,.015,0));
  for(let i=0;i<11;i++){const a=i*Math.PI*2/11,stone=mesh(new THREE.DodecahedronGeometry(.2+random()*.05),M(i%2?0x8b8b74:0x767b6c),Math.cos(a)*.92,.16,Math.sin(a)*.92);stone.scale.y=.7;base.add(stone);}
  for(let i=0;i<3;i++){const a=i*Math.PI/3,log=tube([-.65*Math.cos(a),.17,-.65*Math.sin(a)],[.65*Math.cos(a),.2,.65*Math.sin(a)],.12,rural.darkWood);base.add(log);}
  g.add(finish(base,'FireRing'));const flames=[];
  for(let i=0;i<5;i++){const f=mesh(new THREE.SphereGeometry(1,7,6),M(i%2?0xffc46b:0xe78b3b,{emissive:i%2?0xffae39:0xdc5926,emissiveIntensity:.7}),Math.sin(i*2.4)*.24,.42,Math.cos(i*2.4)*.24);f.scale.set(.13,.38,.13);g.add(f);flames.push(f);}
  g.name='Campfire';g.userData.tick=t=>flames.forEach((f,i)=>{f.scale.y=.32+Math.sin(t*5+i*1.7)*.08;f.position.y=.24+f.scale.y;});return g;
}

export function coffeeTable(){
  const g=new THREE.Group();for(const x of [-.9,.9])for(const z of [-.36,.36])g.add(tube([x,0,z],[x*.85,.79,z*.8],.065,rural.darkWood));
  for(let j=0;j<5;j++)plank(g,2.25,.1,.18,0,.84,(j-2)*.19);
  for(const side of [-1,1]){g.add(rounded(2.2,.12,.33,rural.wood,0,.47,side*.8));for(const x of [-.83,.83])g.add(box(.1,.44,.18,rural.darkWood,x,.22,side*.8));}
  g.add(cylinder(.13,.14,.44,M(0x477b70),-.52,1.11,0),cylinder(.13,.13,.08,rural.steel,-.52,1.37,0));
  for(const x of [.1,.5]){g.add(cylinder(.085,.065,.15,M(0xeee1c1),x,.965,.1));const handle=ring(.055,.013,M(0xeee1c1),x+.085,.98,.1);g.add(handle);}
  g.add(cylinder(.23,.23,.025,M(0xd3ba82),.3,.905,-.22));return finish(g,'CoffeeTable');
}

// Open dugout, keel y=0. Place at water level minus .18 m; +Z is the bow.
export function riverCanoe(){
  const g=new THREE.Group(),wood=M(0x94673e,{side:THREE.DoubleSide}),inside=M(0xba925d,{side:THREE.DoubleSide});
  const sections=[[-2.9,.025],[-2.3,.42],[-1.2,.59],[.8,.59],[2.2,.38],[3,.015]];
  for(const side of [-1,1])for(const inner of [false,true]){
    const ps=[],ix=[];
    sections.forEach(([z,w],i)=>{const lift=(i===0||i===5)?.28:0;
      for(const [f,y]of [[.22,.04],[.78,.24],[1,.61]])ps.push(side*Math.max(.006,w*f-(inner?.06:0)),y+lift+(inner?.045:0),z);
      if(i<sections.length-1)for(let j=0;j<2;j++){const k=i*3+j;ix.push(k,k+3,k+1,k+1,k+3,k+4);}
    });
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setIndex(ix);geo.computeVertexNormals();g.add(mesh(geo,inner?inside:wood));
  }
  const bottom=[],bottomIx=[];sections.forEach(([z,w],i)=>{const y=(i===0||i===5)?.32:.04;bottom.push(-w*.22,y,z,w*.22,y,z);if(i<5){const k=i*2;bottomIx.push(k,k+1,k+2,k+1,k+3,k+2);}});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(bottom,3));geo.setIndex(bottomIx);geo.computeVertexNormals();g.add(mesh(geo,wood));
  for(const side of [-1,1])g.add(curve(sections.map(([z,w],i)=>[side*w,.63+((i===0||i===5)?.28:0),z]),.045,rural.darkWood,24));
  for(const z of [-1.55,.9])g.add(rounded(.95,.1,.3,rural.wood,0,.56,z));
  g.add(tube([-.5,.68,-1.7],[.5,.74,1.5],.03,rural.wood));const paddle=rounded(.27,.045,.65,rural.wood,.52,.74,1.7);paddle.rotation.y=.3;g.add(paddle);coil(g,0,.15,-.8,.22);
  return finish(g,'RiverCanoe');
}

// Long axis +Z, deck .95 above origin; open central walkway, one side rail.
export function wetlandLanding({length=7}={}){
  dimension(length,3,16,'length');const g=new THREE.Group(),n=Math.ceil(length/.24);
  for(let i=0;i<n;i++)plank(g,2.25,.12,length/n-.018,0,.89,-length/2+(i+.5)*length/n,{mat:i%4?rural.wood:M(0xa38c60),grain:false});
  for(const x of [-.9,.9])g.add(box(.13,.18,length,rural.darkWood,x,.72,0));
  for(let z=-length/2+.3;z<length/2;z+=2.1)for(const x of [-1,1])g.add(cylinder(.075,.11,1.05,rural.darkWood,x,.525,z));
  for(let z=-length/2+.3;z<length/2;z+=2.1)g.add(cylinder(.06,.08,1,rural.darkWood,-1.03,1.4,z));
  g.add(curve([[-1.03,1.8,-length/2+.3],[-1.03,1.65,0],[-1.03,1.8,length/2-.4]],.025,rope));
  coil(g,.58,.98,length/2-.65);return finish(g,'WetlandLanding');
}

export function floodedFence({span=8,seed=7}={}){
  dimension(span,3,20,'span');const g=new THREE.Group(),random=rng(seed),n=Math.ceil(span/2.5),points=[];
  for(let i=0;i<=n;i++){const x=-span/2+i*span/n,lean=(random()-.5)*.25,h=1.25+random()*.4;g.add(tube([x,0,0],[x+lean,h,.1],.065,rural.darkWood));points.push([x+lean,h-.18,.1]);}
  for(let i=1;i<points.length;i++)for(const dy of [0,.45]){const a=points[i-1],b=points[i];g.add(curve([[a[0],a[1]-dy,a[2]],[(a[0]+b[0])/2,(a[1]+b[1])/2-dy-.18,.1],[b[0],b[1]-dy,b[2]]],.014,rope,7));}
  const rail=box(span*.32,.11,.075,rural.wood,-span*.28,.63,.1);rail.rotation.z=-.18;g.add(rail);return finish(g,'FloodedFence');
}

export function trailSign({label='LAGUNA DEL HATO',secondary='LOS LLANOS'}={}){
  const g=new THREE.Group();g.add(cylinder(.085,.12,2.25,rural.darkWood,0,1.125,-.13),rounded(2.4,.65,.12,rural.wood,0,1.9,0));
  const panel=sign([label,secondary],2.25,.56,{background:'#486556',border:false});panel.position.set(0,1.9,.07);g.add(panel);
  for(const x of [-1.05,1.05])g.add(mesh(new THREE.SphereGeometry(.025,6,4),rural.steel,x,1.9,.09));return finish(g,'LlanoTrailSign');
}

export function termiteMound({seed=7}={}){
  const g=new THREE.Group(),random=rng(seed),earth=M(0xa78050,{roughness:1,flatShading:false});
  const base=new THREE.SphereGeometry(1,12,8),bp=base.attributes.position;
  for(let j=0;j<bp.count;j++){const x=bp.getX(j),z=bp.getZ(j),r=1+.08*Math.sin(x*8+z*6+seed);bp.setXYZ(j,x*.85*r,Math.max(0,bp.getY(j))*.52,z*.72*r);}base.computeVertexNormals();g.add(mesh(base,earth));
  for(let i=0;i<6;i++){
    const h=i===0?1.9:.65+random()*.9,r=i===0?.52:.22+random()*.15,a=i*2.4;
    const geo=new THREE.SphereGeometry(1,10,9);const p=geo.attributes.position;
    for(let j=0;j<p.count;j++){const t=(p.getY(j)+1)/2,rough=1+.1*Math.sin(p.getX(j)*9+p.getZ(j)*6+seed);p.setXYZ(j,p.getX(j)*r*(1-.5*t)*rough,t*h,p.getZ(j)*r*(1-.5*t)*rough);}geo.computeVertexNormals();
    g.add(mesh(geo,earth,i?Math.sin(a)*.48:0,0,i?Math.cos(a)*.4:0));
  }
  return finish(g,'TermiteMound');
}
