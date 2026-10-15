// Pana-authored wildlife shared by Studio and Derrape. +Z is the bill/snout.
// Flying birds have their feet above y=0; the orbit translates this local pose.
// Every factory owns its geometry and uses cached, untextured materials.
import * as THREE from 'three';
import { M, mesh, tube, rng } from './props.js';
import { finish } from './architecture-kit.js';
import { capybaraForm } from './landmarks.js';

const dark=M(0x202627,{roughness:.85,flatShading:false});
const mat=color=>M(color,{roughness:.88,flatShading:false});
function oval(g,color,at,scale,rotation=0){
  const o=mesh(new THREE.SphereGeometry(1,12,8),typeof color==='number'?mat(color):color,...at);
  o.scale.set(...scale);o.rotation.x=rotation;g.add(o);return o;
}
function feather(g,color,from,to,width){
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),mid=a.clone().add(b).multiplyScalar(.5);
  const o=oval(g,color,mid.toArray(),[width,.045,a.distanceTo(b)*.5]);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),b.sub(a).normalize());return o;
}
function bill(g,points,radius,color=dark){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  // Taper to a closed point along the curve instead of a blunt tube end.
  const geometry=new THREE.TubeGeometry(curve,18,radius,8,false),p=geometry.attributes.position;
  for(let i=0;i<=18;i++){
    const center=curve.getPointAt(i/18),scale=Math.max(.015,1-i/18);
    for(let j=0;j<=8;j++){const k=i*9+j;p.setXYZ(k,center.x+(p.getX(k)-center.x)*scale,center.y+(p.getY(k)-center.y)*scale,center.z+(p.getZ(k)-center.z)*scale);}
  }
  geometry.computeVertexNormals();g.add(mesh(geometry,color));
}
const species={
  macaw:{id:'scarlet-macaw',name:'Guacamaya roja',body:0xcd3d30,wing:0xd04332,tip:0x286bb3,span:1.55,flap:.55,rate:5.4,tail:1.0},
  ibis:{id:'scarlet-ibis',name:'Corocora roja',body:0xd9513a,wing:0xdc543d,tip:0x392b29,span:1.5,flap:.48,rate:4.3,tail:.26},
  vulture:{id:'soaring-vulture',name:'Zamuro planeador',body:0x383c3b,wing:0x343a3b,tip:0x777e7d,span:2.1,flap:.09,rate:1.4,tail:.4},
};
function bird(kind,{seed=7}={}){
  const spec=species[kind],phase=rng(seed)()*Math.PI*2,g=new THREE.Group(),body=new THREE.Group(),wings=[];
  oval(body,spec.body,[0,1.05,0],[kind==='ibis'?.19:.26,.26,.49]);
  const head=kind==='ibis'?[0,1.44,.67]:[0,1.38,.4];
  if(kind==='ibis'){
    body.add(tube([0,1.03,.24],[0,1.42,.56],.115,mat(spec.body)));
    oval(body,spec.body,[0,1.36,.55],[.13,.2,.14],-.5);
  }
  oval(body,kind==='vulture'?0x77736b:spec.body,head,kind==='vulture'?[.14,.16,.2]:[.19,.2,.21]);
  if(kind==='macaw'){
    for(const s of [-1,1])oval(body,0xf2e5cd,[s*.155,1.4,.49],[.055,.12,.13]);
    oval(body,0xdcc9aa,[0,1.38,.6],[.15,.15,.15]);
    bill(body,[[0,1.44,.64],[0,1.41,.79],[0,1.26,.73]],.11);
  }else if(kind==='ibis')bill(body,[[0,1.45,.79],[0,1.41,1.02],[0,1.29,1.22],[0,1.17,1.29]],.065);
  else bill(body,[[0,1.4,.55],[0,1.37,.69],[0,1.29,.66]],.075,mat(0xc1b8a4));
  for(const s of [-1,1]){
    oval(body,0xcfa252,[s*(kind==='vulture'?.137:.18),head[1]+.04,head[2]+.07],[.035,.04,.038]);
    oval(body,dark,[s*(kind==='vulture'?.16:.203),head[1]+.04,head[2]+.08],[.018,.024,.023]);
    // Legs trail behind the body in flight; three curved toes remain visible.
    const y=kind==='ibis'?.74:.82,z=kind==='ibis'?-1.05:-.36;
    body.add(tube([s*.12,.93,-.15],[s*.12,y,z],.022,kind==='ibis'?mat(0x914438):dark));
    for(let toe=-1;toe<=1;toe++)body.add(tube([s*.12,y,z],[s*.12+toe*.045,y-.055,z-.12],.013,dark));
  }
  for(let i=-2;i<=2;i++)feather(body,kind==='macaw'?(i%2?0x2e68a2:0xbb3532):spec.body,[i*.05,1.03,-.34],[i*.1,.85,-.55-spec.tail*(1-Math.abs(i)*.12)],.075);
  g.add(finish(body,`${spec.name} · cuerpo`));
  for(const side of [-1,1]){
    const wing=new THREE.Group(),pieces=new THREE.Group();
    // A continuous flight surface joins the feather roots all the way to the
    // wrist. Primaries project beyond it; individual feathers never float apart.
    const outline=new THREE.Shape();
    [[.02,.12],[.5,.15],[spec.span*.72,-.08],[spec.span,-.22],[spec.span,-.51],[.6,-.55],[.04,-.3]].forEach(([x,z],i)=>i?outline.lineTo(side*x,z):outline.moveTo(side*x,z));
    outline.closePath();
    const surface=new THREE.ExtrudeGeometry(outline,{depth:.05,bevelEnabled:false,steps:1});
    surface.rotateX(Math.PI/2);surface.translate(0,.01,0);pieces.add(mesh(surface,mat(spec.wing)));
    oval(pieces,spec.wing,[side*.36,0,-.06],[.48,.09,.26]);
    for(let i=0;i<9;i++){
      const t=i/8,x=.25+t*(spec.span-.35),length=(kind==='vulture'?.58:.44)+t*.16;
      feather(pieces,i>(kind==='macaw'?4:6)?spec.tip:spec.wing,[side*x,0,.08-t*.22],[side*(x+.22),-.025,-length-t*.16],.085);
      if(kind==='macaw'&&i<7)feather(pieces,0xe6b73d,[side*x,.045,.04-t*.16],[side*(x+.14),.045,-.24-t*.16],.07);
    }
    wing.add(finish(pieces,`${spec.name} · ala`));wing.position.set(side*.18,1.15,0);g.add(wing);wings.push(wing);
  }
  g.name=spec.name;g.userData={assetId:spec.id,species:kind,footprintRadius:spec.span+.3,
    previewBounds:[[-spec.span-.4,0,-1.7],[spec.span+.4,2.6,1.4]],
    tick(t){const flap=Math.sin(t*spec.rate+phase)*spec.flap;wings[0].rotation.z=-flap;wings[1].rotation.z=flap;},
  };
  g.userData.tick(0);return g;
}
export const scarletMacaw=options=>bird('macaw',options);
export const scarletIbis=options=>bird('ibis',options);
export const soaringVulture=options=>bird('vulture',options);

// The root owns one callback: the track collector must not tick wings twice.
// +Z follows the circle tangent (the previous bird flew sideways).
export function orbitBird(bird,{cx,cz,cy=14,r=16,speed=.5,phase=0}){
  const pose=bird.userData.tick;
  bird.userData.flight={cx,cz,cy,r,speed,phase};
  bird.userData.tick=t=>{
    pose(t);const a=t*speed+phase;
    bird.position.set(cx+Math.cos(a)*r,cy+Math.sin(t*1.3+phase)*.8,cz+Math.sin(a)*r);
    bird.rotation.set(0,-a+(speed<0?Math.PI:0),-.10*Math.sign(speed));
  };
  bird.userData.tick(0);return bird;
}

export function wildCapybara({seed=7}={}){
  const g=capybaraForm(mat(0x92704c),{eyes:dark}),phase=rng(seed)()*6;
  const ears=[g.children[1],g.children[4]],rest=ears.map(o=>o.rotation.x);
  g.name='Chigüire';g.userData={assetId:'wild-capybara',species:'capybara',footprintRadius:1.8,
    tick(t){ears.forEach((ear,i)=>{ear.rotation.x=rest[i]+Math.sin(t*1.5+phase+i)*.055;});},
  };
  g.userData.tick(0);return g;
}
