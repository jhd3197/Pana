// Desert 061–070. Seeded erosion, open passages and grounded machinery.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from './props.js';
import { finish, rounded, sign, curve, palette } from './architecture-kit.js';
import { cactus } from './flora-species.js';
import { rural, dimension, cylinder, ring, wheel, corrugatedRoof, plank } from './rural-kit.js';

function strata(geo) {
  const p=geo.attributes.position,c=[],base=new THREE.Color(0xb87950),light=new THREE.Color(0xe5b779),dark=new THREE.Color(0x95533c);
  for(let i=0;i<p.count;i++){const y=p.getY(i),band=.5+.5*Math.sin(y*4.2+Math.sin(p.getX(i)*.7)*.25);const tint=base.clone().lerp(band>.8?light:dark,band>.8?.48:.12+band*.12);c.push(tint.r,tint.g,tint.b);}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.computeVertexNormals();return geo;
}
const rock=M(0xffffff,{vertexColors:true,roughness:1});

export function giantCactus({height=7.5,seed=61}={}) {
  dimension(height,2,16,'height');const g=new THREE.Group(),plant=cactus({seed});plant.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(plant),s=height/(bounds.max.y-bounds.min.y);plant.scale.setScalar(s);plant.position.y=-bounds.min.y*s;g.add(plant);
  // A small basal shoot makes this read as an established cardón, not a sapling.
  const shoot=cactus({seed:seed+17});shoot.scale.setScalar(s*.22);shoot.position.set(height*.1,.015,-height*.075);shoot.rotation.y=1.8;g.add(shoot);
  return finish(g,'GiantCactus');
}

export function sandDune({width=14,depth=10,height=3.4,seed=62}={}) {
  dimension(width,4,40,'width');dimension(depth,4,40,'depth');dimension(height,.25,10,'height');const r=rng(seed),phase=r()*6,nx=40,nz=32,geo=new THREE.PlaneGeometry(width,depth,nx,nz);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,c=[],sand=new THREE.Color(0xd9b576),crest=new THREE.Color(0xf0d4a0);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),u=x/width*2,v=z/depth*2,envelope=Math.pow(Math.max(0,1-u*u),1.5)*Math.pow(Math.max(0,1-v*v),1.2),ridge=u-.2*Math.sin(v*2+phase),falloff=Math.exp(-Math.pow(ridge+(ridge>0?.15:0),2)*5),ripple=Math.sin(z*9+x*1.1+Math.sin(x*.5))*.026*envelope;
    const y=envelope*height*(.36+.64*falloff)+ripple;p.setY(i,y);const col=sand.clone().lerp(crest,.22+Math.max(0,Math.sin(z*9+x*1.1))*.1+y/height*.28);c.push(col.r,col.g,col.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(c,3));geo.computeVertexNormals();const g=new THREE.Group();g.add(mesh(geo,M(0xffffff,{vertexColors:true,roughness:1,side:THREE.DoubleSide})));return finish(g,'SandDune');
}

export function desertRockArch({span=8,height=7,depth=3,seed=63}={}) {
  dimension(span,4,28,'span');dimension(height,4,18,'height');dimension(depth,1,8,'depth');const r=rng(seed),half=span/2,thick=1.25+span*.025,spring=height*.48,shape=new THREE.Shape();
  shape.moveTo(-half-thick,0);shape.lineTo(-half-thick*1.22,spring*.45);shape.lineTo(-half-thick,spring);
  for(let j=0;j<=20;j++){const a=Math.PI-j*Math.PI/20,rough=1+(r()-.5)*.07;shape.lineTo(Math.cos(a)*(half+thick)*rough,spring+Math.sin(a)*(height-spring+thick)*rough);}
  shape.lineTo(half+thick*1.13,spring*.4);shape.lineTo(half+thick,0);shape.lineTo(half,0);shape.lineTo(half,spring);
  for(let j=0;j<=24;j++){const a=j*Math.PI/24;shape.lineTo(Math.cos(a)*half,spring+Math.sin(a)*(height-spring));}
  shape.lineTo(-half,0);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:20});geo.translate(0,0,-depth/2);
  const g=new THREE.Group();g.add(mesh(strata(geo),rock));
  for(const side of [-1,1])for(let j=0;j<4;j++){const b=mesh(new THREE.DodecahedronGeometry(.33+j*.05,0),M(j%2?0xba8459:0x9d6447),side*(half+thick*.8)+(r()-.5)*.5,.29,-depth*.6+j*depth*.35);b.scale.y=.6;g.add(b);}
  return finish(g,'DesertRockArch');
}

export function abandonedGasStation() {
  const g=new THREE.Group(),wall=M(0xd5c39e,{roughness:1}),paint=M(0x56867e,{roughness:1});
  g.add(box(9.4,.14,7.7,palette.stone,0,.07,.5),box(5.5,2.8,3.1,wall,-1.2,1.54,-1.55));
  const roof=new THREE.Group();roof.position.set(-1.2,0,-1.55);corrugatedRoof(roof,{w:6,d:3.6,y:3,rise:.45,color:0x948e78});g.add(roof);
  g.add(box(1,2.15,.06,palette.dark,.15,1.22,.035),box(2,1.15,.05,M(0x466969),-2.1,1.9,.035));
  for(let i=0;i<3;i++){const board=box(2.1,.17,.07,rural.wood,-2.1,1.52+i*.36,.09);board.rotation.z=(i-1)*.09;g.add(board);}
  for(const x of [-3.8,3.8])g.add(box(.13,3.15,.13,rural.rust,x,1.72,3.5));
  g.add(box(8.3,.18,4.3,rural.steel,0,3.36,2),box(8.3,.27,.13,paint,0,3.35,4.16));
  for(let i=0;i<12;i++){const x=-3.8+i*.68;g.add(box(.42,.012,.7,rural.rust,x,3.46,1+(i%3)*.8));}
  for(const x of [-1.7,1.7]) {
    g.add(rounded(.6,1.4,.55,paint,x,.84,2.7),rounded(.8,.68,.65,wall,x,1.87,2.7),box(.58,.27,.025,palette.dark,x,1.96,3.04));
    const screen=sign('00.00',.49,.18,{background:'#263c3c',color:'#d8d5a7',border:false});screen.position.set(x,1.98,3.06);g.add(screen);
    g.add(curve([[x+.37,1.9,2.7],[x+.72,1.2,2.72],[x+.66,.45,2.9],[x+.35,.55,3.06],[x+.36,1.45,3.07]],.035,rural.rubber));
    g.add(box(.08,.25,.13,rural.steel,x+.36,1.5,3.07),box(.23,.08,.1,rural.steel,x+.29,1.62,3.07));
  }
  const title=sign('PANA GAS',2.9,.48,{background:'#56867e'});title.position.set(0,3.35,4.24);g.add(title);
  const closed=sign('CERRADO',1.2,.32,{background:'#925137'});closed.position.set(-2.1,2.15,.15);closed.rotation.z=-.1;g.add(closed);
  g.add(box(.14,4.7,.14,rural.rust,4.4,2.35,-1.8));const road=sign(['GASOLINA','SIN SERVICIO'],1.8,.9,{background:'#aa774c'});road.position.set(4.4,4.3,-1.72);road.rotation.z=.08;g.add(road);
  for(let i=0;i<8;i++)g.add(box(.2+i%3*.11,.12,.014,rural.rust,-3.7+i*.56,.42+i%3*.1,.035));
  const fallen=box(1.1,.06,.9,rural.steel,3.3,.32,-1.1);fallen.rotation.z=.5;g.add(fallen);
  return finish(g,'AbandonedGasStation');
}

export function rustedPickup() {
  const g=new THREE.Group(),paint=M(0x76968b,{roughness:.95}),rust=rural.rust,glass=M(0x679394,{transparent:true,opacity:.55,roughness:.3,side:THREE.DoubleSide}),dark=M(0x39413b);
  for(const z of [-1.45,1.35])for(const side of [-1,1]){const w=wheel(.48,.28,{hub:0x9b8c68});w.position.set(side*.98,.48,z);g.add(w);}
  g.add(box(1.85,.22,4.2,rust,0,.65,0),rounded(1.8,.34,1.25,paint,0,1,1.48,.07),box(1.6,.3,.08,dark,0,.96,2.14));
  g.add(box(1.8,.4,.12,paint,0,1.36,.88));
  for(const side of [-1,1])for(const z of [-1.45,1.35]){
    const fender=mesh(new THREE.CylinderGeometry(.56,.56,.32,14,1,true,0,Math.PI),paint,side*.99,.48,z);fender.rotation.z=Math.PI/2;g.add(fender);
  }
  for(let x=-.6;x<.65;x+=.16)g.add(box(.06,.21,.03,rural.steel,x,.97,2.19));
  for(const x of [-.68,.68]){const head=cylinder(.16,.16,.07,x<0?palette.cream:dark,x,1.12,2.14);head.rotation.x=Math.PI/2;g.add(head);}
  g.add(box(2.1,.12,.17,rural.steel,0,.62,2.29),box(2,.12,.16,rust,0,.65,-2.23));
  // Cab shell and visible interior; side window openings are not filled boxes.
  g.add(box(1.8,.18,1.5,paint,0,.83,.2),box(1.8,.62,.1,paint,0,1.2,-.55),rounded(1.9,.14,1.65,paint,0,2.17,.2));
  for(const side of [-1,1]){g.add(box(.12,.66,1.44,paint,side*.87,1.2,.2),box(.09,.65,.09,paint,side*.87,1.83,.88),box(.09,.65,.09,paint,side*.87,1.83,-.5),box(.18,.04,.06,rural.steel,side*.94,1.36,-.18));g.add(box(.3,.15,.07,dark,side*1.08,1.7,.75));}
  const windshield=box(1.64,.53,.025,glass,0,1.85,.89);g.add(windshield);
  g.add(tube([-.6,1.6,.92],[-.1,1.85,.92],.012,dark),tube([.3,1.6,.92],[.65,1.8,.92],.012,dark));
  g.add(rounded(1.45,.18,.5,rural.darkWood,0,1.15,-.15),rounded(1.45,.5,.12,rural.darkWood,0,1.42,-.4),box(1.55,.15,.3,dark,0,1.5,.66));
  const steering=ring(.2,.022,dark,-.45,1.58,.4);steering.rotation.x=-.75;g.add(steering);
  // Open cargo bed with worn floorboards, inner wheel humps and tailgate.
  for(let i=0;i<8;i++)plank(g,.19,.07,1.55,-.72+i*.205,.87,-1.36,{grain:false});
  for(const side of [-1,1]){g.add(box(.12,.57,1.6,paint,side*.88,1.12,-1.36),box(.18,.07,1.65,rust,side*.88,1.42,-1.36),rounded(.3,.3,.6,rust,side*.69,1.02,-1.45));}
  g.add(box(1.8,.55,.1,paint,0,1.12,-2.12));for(const side of [-1,1])g.add(box(.15,.22,.04,M(0x9e4234),side*.78,1.06,-2.19));
  const r=rng(65);for(const side of [-1,1])for(let i=0;i<20;i++){const z=-2+r()*4;g.add(box(.013,.04+r()*.08,.08+r()*.18,rust,side*.945,.85+r()*.47,z));}
  for(let i=0;i<8;i++)g.add(box(.15,.014,.12,rust,(r()-.5)*1.5,1.18,1.1+r()*.8));
  const plate=sign('VZLA · 065',.6,.15,{background:'#d5c39e',color:'#49463d',border:false});plate.position.set(0,.7,2.39);g.add(plate);
  return finish(g,'RustedPickup');
}

export function roadsideTirePile() {
  const g=new THREE.Group();
  for(let i=0;i<4;i++) {
    const t=new THREE.Group(),rubber=M(i%2?0x41433c:0x353a36,{roughness:1});t.add(ring(.39,.15,rubber));
    for(let j=0;j<24;j++){const a=j*Math.PI/12,b=box(.12,.04,.22,rubber,Math.sin(a)*.525,Math.cos(a)*.525,0);b.rotation.z=-a;t.add(b);}
    if(i<3){t.rotation.x=Math.PI/2;t.position.set(0,.15+i*.3,0);}else{t.rotation.y=.4;t.rotation.x=.35;t.position.set(1,.55,.15);}g.add(t);
  }
  return finish(g,'RoadsideTirePile');
}

export function canyonSpire({height=12,seed=67}={}) {
  dimension(height,3,24,'height');const r=rng(seed),positions=[],indices=[],n=11,layers=14,angles=Array.from({length:n},()=>.88+r()*.22);
  for(let row=0;row<=layers;row++) {
    const v=row/layers,radius=(1-v*.72)*(1.9+(r()-.5)*.55),cx=Math.sin(v*2.3)*.7;
    for(let j=0;j<n;j++){
      const a=j*Math.PI*2/n,eroded=angles[j]*(.86+r()*.28),y=row===0?0:v*height+(row===layers?(r()-.5)*height*.055:Math.sin(j*2+row)*height*.009);
      positions.push(cx+Math.cos(a)*radius*eroded,y,Math.sin(a)*radius*eroded*.8+v*v*.5);
    }
  }
  for(let row=0;row<layers;row++)for(let j=0;j<n;j++){const a=row*n+j,b=row*n+(j+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);}
  for(let j=1;j<n-1;j++){indices.push(0,j,(j+1));const top=layers*n;indices.push(top,top+j+1,top+j);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);const g=new THREE.Group();g.add(mesh(strata(geo.toNonIndexed()),rock));geo.dispose();
  for(let i=0;i<3;i++){const b=mesh(new THREE.DodecahedronGeometry(.65+i*.13,0),M(0xae7953),-1.4+i*1.6,(.65+i*.13)*.6,1.15);b.scale.y=.6;g.add(b);}
  return finish(g,'CanyonRockSpire');
}

function wagonWheel(broken=false) {
  const g=new THREE.Group(),rim=ring(.6,.055,rural.darkWood);rim.rotation.y=Math.PI/2;g.add(rim);const band=ring(.63,.025,rural.steel);band.rotation.y=Math.PI/2;g.add(band);
  const hub=cylinder(.13,.13,.23,rural.darkWood);hub.rotation.z=Math.PI/2;g.add(hub);
  for(let j=0;j<10;j++){if(broken&&j>1&&j<5)continue;const a=j*Math.PI/5;g.add(tube([0,0,0],[0,Math.cos(a)*.57,Math.sin(a)*.57],.033,rural.wood));}return g;
}
export function brokenWagon() {
  const g=new THREE.Group();
  for(const z of [-.95,.95]){g.add(tube([-1.12,.66,z],[1.12,.66,z],.07,rural.steel));for(const side of [-1,1]){const w=wagonWheel(z<0&&side<0);w.position.set(side*1.1,.655,z);g.add(w);}}
  for(let i=0;i<8;i++){if(i===5)continue;const p=box(.2,.11,2.8,rural.wood,-.77+i*.22,1.04,0);p.rotation.z=i===4?.08:0;g.add(p);}
  for(const x of [-.87,.87])for(const z of [-1.35,1.35])g.add(box(.12,1,.12,rural.darkWood,x,1.48,z));
  for(const side of [-1,1])for(let j=0;j<3;j++){if(side<0&&j===2)continue;g.add(box(.1,.19,2.8,rural.wood,side*.9,1.25+j*.26,0));}
  for(let j=0;j<3;j++)plank(g,1.85,.19,.1,0,1.25+j*.26,-1.4);
  for(const side of [-1,1])g.add(tube([side*.7,1,1.15],[side*.57,.6,3.2],.055,rural.darkWood));
  const loose=box(.22,.07,1.4,rural.wood,1.8,.07,-.2);loose.rotation.y=.45;g.add(loose);
  for(const x of [-.87,.87])for(const y of [1.3,1.8])g.add(box(.15,.09,.14,rural.steel,x,y,-1.43));
  return finish(g,'BrokenWoodenWagon');
}

export function desertWarningSign() {
  const g=new THREE.Group();g.add(box(.16,2.7,.16,rural.darkWood,0,1.35,0));
  const board=box(1.3,1.3,.09,M(0xcba34c),0,2.4,.15);board.rotation.z=Math.PI/4;g.add(board);
  const warning=sign('!',.65,.9,{background:'#cba34c',color:'#473d30',border:false});warning.position.set(0,2.4,.201);g.add(warning);
  const label=sign(['PELIGRO','CAÑÓN'],1.6,.55,{background:'#906b42'});label.position.set(0,1.22,.1);label.rotation.z=-.07;g.add(label);
  for(const y of [1.1,1.34,2.85,1.95])g.add(mesh(new THREE.SphereGeometry(.035,6,4),rural.steel,0,y,y>1.5?.21:.13));
  for(const side of [-1,1])g.add(box(.12,.07,.008,rural.rust,side*.51,2.4,.201));
  return finish(g,'DesertWarningSign');
}

export function desertWell() {
  const g=new THREE.Group(),stone=M(0xb6a184,{roughness:1});
  // Individual wedge stones keep the entire mouth open, down to the water.
  for(let row=0;row<4;row++)for(let j=0;j<16;j++){
    const a=(j+row%2*.5)*Math.PI/8,shape=new THREE.Shape(),r1=1.02,r2=1.38,gap=.018;
    shape.absarc(0,0,r2,a+gap,a+Math.PI/8-gap,false);shape.absarc(0,0,r1,a+Math.PI/8-gap,a+gap,true);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.285,bevelEnabled:false,curveSegments:3});geo.rotateX(-Math.PI/2);geo.translate(0,row*.3,0);g.add(mesh(geo,row%2?stone:M(0xa9987f,{roughness:1})));
  }
  for(const x of [-1.55,1.55])g.add(box(.2,3.1,.2,rural.darkWood,x,1.55,0));
  g.add(tube([-1.7,2,0],[1.8,2,0],.1,rural.darkWood));
  const spool=cylinder(.17,.17,.6,rural.wood,0,2,0);spool.rotation.z=Math.PI/2;g.add(spool);
  for(let i=0;i<14;i++){const rope=ring(.175,.013,M(0xb5a37b),-.27+i*.04,2,0);rope.rotation.y=Math.PI/2;g.add(rope);}
  g.add(tube([0,1.99,.18],[0,.63,.18],.018,M(0xb5a37b)),tube([1.8,2,0],[1.8,1.62,0],.045,rural.steel),tube([1.8,1.62,0],[2.06,1.62,0],.045,rural.wood));
  const bucket=mesh(new THREE.CylinderGeometry(.23,.17,.4,12,1,true),M(0x647d77,{side:THREE.DoubleSide,metalness:.4,roughness:.8}),0,.47,.18);g.add(bucket);const handle=ring(.22,.018,rural.steel,0,.7,.18);g.add(handle);
  const water=mesh(new THREE.CircleGeometry(1.02,32),M(0x344a45,{roughness:.2}));water.rotation.x=-Math.PI/2;water.position.y=.035;g.add(water);
  corrugatedRoof(g,{w:3.9,d:2.4,y:3.05,rise:.62,color:0x9c7f59});
  return finish(g,'OldDesertWell');
}
