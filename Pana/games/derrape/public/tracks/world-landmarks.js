import { THREE,M,mesh,box,tube,sign,finish } from './world-kit.js';
import { tiledRoof,shutterWindow,archPanel,archFrame,railing } from '/engine/architecture-kit.js';

// Angular glazed mountain terminal, inspired by the supplied Mérida reference.
export function summitTerminal(label='PICO PANA'){
  const g=new THREE.Group(),white=M(0xe6e8df),glass=M(0x4e98ac,{metalness:.3,roughness:.25}),steel=M(0x657c82);
  g.add(box(22,1.2,16,white,0,.6,0),box(17,7,12,glass,0,4.7,0));
  for(const x of [-8.7,8.7])g.add(box(.6,8,12.6,white,x,5,0));
  for(let x=-7;x<=7;x+=2.8)g.add(box(.16,7,.15,white,x,4.7,6.1));
  for(const y of [2,4.5,7.5])g.add(box(17,.16,.16,white,0,y,6.1));
  const roof=box(21,.5,15,white,0,9,0);roof.rotation.z=-.14;g.add(roof);
  for(const x of [-7,7])g.add(tube([x,1,-5],[x,12,-9],.22,steel));
  g.add(box(16,.3,.4,steel,0,12,-9));
  for(let i=0;i<5;i++)g.add(box(10,.24*(i+1),1,white,0,.12*(i+1),10-i*.9));
  const title=sign(['TELEFÉRICO PANA',label],12,1.5);title.position.set(0,2,6.2);g.add(title);
  return finish(g);
}

export function aerialLift(points){
  const group=new THREE.Group(),fixed=new THREE.Group(),steel=M(0x50656b),cream=M(0xdfdfc9),cabs=[];
  for(const side of [-1,1]){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,y,z])=>new THREE.Vector3(x+side*2,y,z)));
    fixed.add(mesh(new THREE.TubeGeometry(curve,100,.085,5),steel));
    for(let i=0;i<3;i++){
      const cab=new THREE.Group(),paint=M(i%2?0xd7ad3a:0xb94d3b);
      cab.add(box(3.6,1.3,2.9,paint,0,-3.3,0),box(3.45,1.65,2.75,M(0x417f94),0,-1.85,0),box(3.8,.22,3.1,cream,0,-.95,0));
      for(const x of [-1.7,0,1.7])for(const z of [-1.4,1.4])cab.add(box(.1,1.7,.1,cream,x,-1.9,z));
      cab.add(tube([0,0,0],[0,-.85,0],.13,steel));
      const out=finish(cab);out.userData.tick=t=>{const u=(i/3+t*.012*(side>0?1:-1)+1000)%1;out.position.copy(curve.getPoint(u));const v=curve.getTangent(u);out.rotation.y=Math.atan2(v.x,v.z);};out.userData.tick(0);group.add(out);cabs.push(out);
    }
  }
  group.add(finish(fixed));
  // The environment updates the lift as a unit, not each child's callback.
  for(const cab of cabs){const tick=cab.userData.tick;delete cab.userData.tick;cab.userData.move=tick;}
  group.userData.tick=t=>cabs.forEach(c=>c.userData.move(t));
  return group;
}

export function cableTower(h=24){
  const g=new THREE.Group(),steel=M(0x5f7277);
  for(const x of [-2.8,2.8])for(const z of [-2.8,2.8])g.add(tube([x,0,z],[x*.22,h,z*.22],.2,steel));
  for(let y=4;y<h;y+=4){const w=2.8*(1-.78*y/h);for(const z of [-w,w]){g.add(tube([-w,y,z],[w,y,z],.14,steel));g.add(tube([-w,y,z],[w*.8,y+3,z*.8],.09,steel));}}
  g.add(box(9,.4,1,steel,0,h,0));return finish(g);
}

export function divingSchool(){
  const g=new THREE.Group(),white=M(0xf0e5ce),teal=M(0x3a9caa),coral=M(0xcf7155);
  g.add(box(15,5.5,9,white,0,2.75,0));
  for(const x of [-5,0,5])g.add(box(3.6,3.6,.12,teal,x,2.1,4.57));
  g.add(box(16,.3,11,coral,0,5.65,.5),box(16,.25,4,white,0,.125,6));
  for(const x of [-7,7])g.add(box(.2,3.8,.2,teal,x,1.9,7.6));
  const awning=box(16,.12,3.4,teal,0,3.9,6.2);awning.rotation.x=.12;g.add(awning);
  const title=sign(['CHI CHI · BUCEO','escuela de buceo'],11,1.3,{background:'#207b8c'});title.position.set(0,4.8,4.65);g.add(title);
  for(let i=0;i<6;i++){
    g.add(mesh(new THREE.CylinderGeometry(.23,.23,1.3,10),M(0xc7d4d1,{metalness:.6}),-4+i*.55,.9,6.1));
    g.add(box(.18,.15,.18,M(0x39494a),-4+i*.55,1.62,6.1));
  }
  const flag=box(1.3,.9,.04,M(0xc94a43),5,6.6,1);g.add(flag,tube([4.3,5.5,1],[4.3,7.4,1],.05,white));
  const stripe=box(1.4,.15,.06,white,5,6.6,1.04);stripe.rotation.z=-.5;g.add(stripe);
  return finish(g);
}

export function coastalFort(){
  const g=new THREE.Group(),wall=M(0xe9e1c8);
  g.add(box(16,3.6,10,wall,0,1.8,0));
  for(const z of [-4.7,4.7])g.add(box(16,1,.6,wall,0,4,z));
  for(const x of [-7.5,7.5]){
    g.add(mesh(new THREE.CylinderGeometry(1.4,1.6,4.2,16),wall,x,5.2,0));
    g.add(mesh(new THREE.SphereGeometry(1.5,16,8,0,Math.PI*2,0,Math.PI/2),wall,x,7.3,0));
    g.add(box(.52,1.3,.08,M(0x617a78),x,5.8,1.42));
  }return finish(g);
}

// Five concrete portal pylons and paired stays, with the driving deck at y=10.
export function maracaiboBridge({length=300,width=23,deck=10}={}){
  const g=new THREE.Group(),concrete=M(0xd9d3bb),cable=M(0x7d918f,{metalness:.35});
  g.add(box(length,.7,width,concrete,0,deck-.45,0));
  for(const z of [-width/2,width/2]){
    g.add(box(length,.8,.4,concrete,0,deck+.4,z),box(length,1.2,.6,concrete,0,deck-1.3,z*.75));
    for(let x=-length/2;x<=length/2;x+=18)g.add(box(.35,1.4,.35,concrete,x,deck+.7,z));
    g.add(tube([-length/2,deck+1.35,z],[length/2,deck+1.35,z],.07,cable));
  }
  for(const x of [-120,-60,0,60,120]){
    for(const z of [-width/2-1,width/2+1]){
      for(const side of [-1,1])g.add(tube([x+side*11,-3,z+Math.sign(z)*2],[x,43,z],.85,concrete));
      g.add(box(3.2,1.1,5,concrete,x,43,z));
      for(const d of [-27,-19,19,27])g.add(tube([x,41.8,z],[x+d,deck+.1,Math.sign(z)*(width/2-.2)],.085,cable));
    }
    g.add(box(2,1.2,width+4,concrete,x,43,0));
  }
  for(let x=-length/2;x<=length/2;x+=25)for(const z of [-7,7])g.add(box(1.1,deck+3,1.1,concrete,x,(deck-3)/2,z));
  const out=finish(g);out.name='maracaibo-bridge';return out;
}

export function grandstand({length=90,rows=9,color=0xe4b748}={}){
  const g=new THREE.Group(),concrete=M(0x8f9c9d),paint=M(color),white=M(0xe9e4d4),steel=M(0x435861);
  for(let row=0;row<rows;row++){
    g.add(box(length,1+row*.85,1.9,concrete,0,(1+row*.85)/2,-row*1.85));
    for(let x=-length/2+1;x<length/2;x+=2)g.add(box(1.35,.35,.9,row%3?paint:white,x,1.2+row*.85,-row*1.85));
  }
  const h=rows*.85+5;g.add(box(length+4,.3,rows*1.85+4,white,0,h,-rows*.8));
  for(let x=-length/2;x<=length/2;x+=15){g.add(box(.3,h,.3,steel,x,h/2,-rows*1.8));g.add(tube([x,h-4,-rows*1.8],[x,h,2],.13,steel));}
  return finish(g);
}

// Two-storey waterfront villas with canal-facing balconies and tiled roofs.
export function canalVilla({seed=1,color=0xe5cc9c}={}){
  const g=new THREE.Group(),wall=M(color),cream=M(0xece0bf),iron=M(0x3e625f),door=M(0x52797c);
  g.add(box(9,8,7,wall,0,4.2,0),box(9.3,.4,7.3,cream,0,.2,0));
  for(const y of [.8,4.2,8.2])g.add(box(9.2,.18,7.2,cream,0,y,0));
  for(const x of [-3,0,3]){
    g.add(archPanel(1.7,3,.1,door,x,.4,3.55),archFrame(1.7,3,.16,cream,x,.4,3.62));
    shutterWindow(g,x,6.15,3.58,{w:1.4,h:2.2,color:0x52797c});
  }
  g.add(box(9.4,.24,1.7,cream,0,4.2,4.2));
  for(const x of [-4.3,4.3])g.add(box(.25,4,.25,cream,x,2.2,4.85));
  railing(g,[-4.55,4.32,5.02],[4.55,4.32,5.02],{height:.95,material:iron,spacing:.5});
  for(const x of [-4.55,4.55])railing(g,[x,4.32,3.55],[x,4.32,5.02],{height:.95,material:iron,spacing:.5});
  tiledRoof(g,{w:9,d:7,y:8.3,rise:1.8,wall,seed});
  const rear=new THREE.Group();rear.rotation.y=Math.PI;
  for(const x of [-2.7,2.7])for(const y of [2.1,6.1])shutterWindow(rear,x,y,3.57,{w:1.2,h:1.8,color:0x52797c});g.add(rear);
  return finish(g);
}
