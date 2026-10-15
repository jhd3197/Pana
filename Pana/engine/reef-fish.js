// Pana-authored coastal fish. Forward +Z, metres; a school orbits its local origin.
// No external model or texture dependency. Animation is a pure function of time.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './props.js';

function fin(points) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  geometry.setIndex([0,1,2]);geometry.computeVertexNormals();return geometry;
}

export function reefFish({seed=7}={}) {
  if(!Number.isInteger(seed))throw new RangeError('Fish seed must be an integer');
  const random=rng(seed),group=new THREE.Group(),parts=[];
  const colors=[0xd9b855,0x63a5ad,0xc98961],base=new THREE.Color(colors[seed%3<0?(seed%3)+3:seed%3]);
  const add=(geometry,color,position=[0,0,0])=>{
    geometry.translate(...position);const rgb=[];
    for(let i=0;i<geometry.attributes.position.count;i++)rgb.push(color.r,color.g,color.b);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));parts.push(geometry.toNonIndexed());geometry.dispose();
  };
  const body=new THREE.SphereGeometry(1,20,12);body.scale(.105,.19,.34);
  const rgb=[],p=body.attributes.position;
  for(let i=0;i<p.count;i++) {
    const z=p.getZ(i),belly=THREE.MathUtils.smoothstep(-p.getY(i),-.03,.16);
    const c=base.clone().lerp(new THREE.Color(0xf1dfac),belly*.6);
    if(z<.17&&z>-.25&&Math.sin((z+.24)*37)>.6)c.multiplyScalar(.48);
    rgb.push(c.r,c.g,c.b);
  }
  body.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));parts.push(body.toNonIndexed());body.dispose();
  const finColor=base.clone().multiplyScalar(.83);
  add(fin([[0,.12,.13],[0,.29,-.11],[0,.1,-.25]]),finColor);
  add(fin([[0,-.12,.04],[0,-.26,-.15],[0,-.1,-.25]]),finColor);
  for(const side of [-1,1]) {
    add(fin([[side*.07,-.02,.12],[side*.23,-.1,-.09],[side*.085,-.09,-.12]]),finColor);
    const eye=new THREE.SphereGeometry(.022,10,7);add(eye,new THREE.Color(0x202a28),[side*.079,.04,.23]);
  }
  parts.forEach(g=>g.deleteAttribute('uv'));
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.58,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(mergeGeometries(parts),material);parts.forEach(g=>g.dispose());group.add(mesh);
  const tail=new THREE.Group();tail.position.z=-.28;group.add(tail);
  const tailGeo=new THREE.BufferGeometry();
  tailGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,.18,-.24,0,0,-.17,0,-.18,-.24],3));
  tailGeo.setIndex([0,1,2,0,2,3]);tailGeo.computeVertexNormals();
  tail.add(new THREE.Mesh(tailGeo,new THREE.MeshStandardMaterial({color:finColor,roughness:.6,side:THREE.DoubleSide})));
  group.name='Pez de arrecife';group.userData.species='fish';group.userData.seed=seed;
  const phase=random()*Math.PI*2;
  group.userData.tick=(t=0)=>{if(Number.isFinite(t))tail.rotation.y=Math.sin(t*7+phase)*.38;};
  let disposed=false;
  group.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    group.traverse(o=>o.material?.dispose());
  };
  group.userData.tick(0);return group;
}

export function reefFishSchool({seed=7,count=6,radius=2.4}={}) {
  if(!Number.isInteger(seed)||!Number.isInteger(count)||count<1||count>16||!Number.isFinite(radius)||radius<1||radius>8)
    throw new RangeError('School requires integer seed, 1–16 fish and a 1–8 m radius');
  const group=new THREE.Group(),random=rng(seed),fish=[];
  for(let i=0;i<count;i++) {
    const object=reefFish({seed:seed+i*17}),phase=random()*Math.PI*2;
    const r=radius*(.55+random()*.3),depth=(random()-.5)*.3;
    object.scale.setScalar(.8+random()*.4);group.add(object);fish.push({object,phase,r,depth});
  }
  group.name='Cardumen costero';group.userData.assetId='reef-fish-school';
  group.userData.footprintRadius=radius+.65;
  group.userData.previewBounds=[[-radius-.65,-.6,-radius-.65],[radius+.65,.6,radius+.65]];
  group.userData.tick=(t=0)=>{
    if(!Number.isFinite(t))return;
    for(const {object,phase,r,depth} of fish) {
      const a=t*.22+phase;object.position.set(Math.cos(a)*r,depth+Math.sin(t*.6+phase)*.07,Math.sin(a)*r*.65);
      object.rotation.y=Math.atan2(-Math.sin(a),Math.cos(a)*.65);object.userData.tick(t);
    }
  };
  group.userData.tick(0);return group;
}

// Check the whole swimming envelope, not just its centre, against land and paths.
export function placeReefSchools(parent,{spots,groundAt,waterY=0,clearance=()=>true,seed=71}) {
  const schools=[];
  for(const [i,[x,z]]of spots.entries()) {
    const radius=3.05,y=waterY-1.1;
    const samples=[[0,0],...[1.5,radius].flatMap(r=>Array.from({length:32},(_,j)=>[Math.cos(j*Math.PI/16)*r,Math.sin(j*Math.PI/16)*r]))];
    if(!clearance(x,z,radius)||samples.some(([dx,dz])=>groundAt(x+dx,z+dz)>y-.65))continue;
    const school=reefFishSchool({seed:seed+i*19});school.position.set(x,y,z);school.userData.waterY=waterY;parent.add(school);schools.push(school);
  }
  return schools;
}
