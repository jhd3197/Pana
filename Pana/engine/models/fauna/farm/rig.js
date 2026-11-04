import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SDFModel } from '/engine/vendor/procedural-animals/core/sdf/sdf.js';
import { meshSDF } from '/engine/vendor/procedural-animals/core/sdf/mesher.js';
import { rng, smoothstep } from '/engine/vendor/procedural-animals/core/math/vec.js';
import { createQuadrupedRig, gaitVariation, newPose, poseQuadruped } from '/engine/models/animation/quadruped-gait.js';

// Horse/chicken/cow sculpt recipes adapted from threejs-procedural-animals (MIT).
// Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors.
// See /engine/vendor/procedural-animals/README.md and LICENSE for provenance.
// Pana adaptation: simplified anatomy, native skinning, matte coats, absolute-time
// idle poses. Ground at y=0; forward +Z; metres. Every instance owns its GPU data.
// Helpers for the sculpt recipes in this folder.
export const ell = (m, c, r, bone = 0, tag = 'coat', k = .06, axis) => m.ell({ c, r, bone, tag, k, axis });
export const cone = (m, a, b, ra, rb, bone = 0, tag = 'coat', k = .035) => m.cone({ a, b, ra, rb, bone, tag, k });
export { SDFModel };

const templates = new Map();
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .88 });
function template(species,sculpt) {
  if (templates.has(species)) return templates.get(species);
  const horse=species==='horse',cow=species==='cow',large=horse||cow;
  const model=sculpt();
  const data = meshSDF(model.prims, large ? [-.65,-.05,-1.05] : [-.3,-.025,-.45],
    large ? [.65,horse?2.35:1.85,1.65] : [.3,.81,.42], large ? .032 : .015);
  const geometry = new THREE.BufferGeometry();
  // Clamp only tiny meshing overshoot at the hoof/toe soles.
  for(let i=1;i<data.positions.length;i+=3) data.positions[i]=Math.max(0,data.positions[i]);
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices,1));
  const indices=new Uint16Array(data.count*4),weights=new Float32Array(data.count*4),tags=[];
  for(let i=0;i<data.count;i++) {
    const x=data.positions[i*3],y=data.positions[i*3+1],z=data.positions[i*3+2];
    const distances=[Infinity,Infinity,Infinity];let nearest=Infinity,tag='coat';
    for(const p of model.prims) {
      const d=SDFModel.dist(p,x,y,z);
      distances[p.bone]=Math.min(distances[p.bone],d);
      if(d<nearest){nearest=d;tag=p.tag;}
    }
    const blend=large?.13:.055;
    const values=distances.map(d=>Math.max(0,1-(d-nearest)/blend)**2),sum=values.reduce((a,b)=>a+b,0);
    for(let j=0;j<3;j++){indices[i*4+j]=j;weights[i*4+j]=values[j]/sum;}
    tags.push(tag);
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const result={geometry,tags,prims:model.prims};templates.set(species,result);return result;
}

function oval(parent,color,at,size) {
  const geometry=new THREE.SphereGeometry(1,16,10);geometry.scale(...size);
  const mesh=new THREE.Mesh(geometry,material(color));mesh.position.set(...at);
  mesh.castShadow=true;parent.add(mesh);return mesh;
}

// Only rigid feather details are merged; the skin, eyes and tail pivots stay live.
function mergeDetails(group) {
  const geometries=[];
  for(const mesh of [...group.children]) {
    mesh.updateMatrix();const geometry=mesh.geometry;
    geometry.applyMatrix4(mesh.matrix);
    const colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3)mesh.material.color.toArray(colors,i);
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometries.push(geometry);mesh.material.dispose();group.remove(mesh);
  }
  const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88}));
  mesh.castShadow=true;group.add(mesh);
}

// The mounted horse's skeleton, in rest coordinates [y,z]. Knee and hock bend
// opposite ways; the toe is the front of the hoof's sole.
const HORSE_LEGS={
  front:{hip:[1.15,.49],knee:[.56,.53],fetlock:[.18,.52],toe:[0,.695],bend:1},
  hind:{hip:[1.15,-.59],knee:[.56,-.73],fetlock:[.17,-.65],toe:[0,-.464],bend:-1},
};
const MANE_BONES=[[1.6,.45],[1.78,.62],[1.95,.79]];
const TAIL_ROOT=[1.48,-.82];

function addBone(parent,name,y,z,x=0){const bone=new THREE.Bone();bone.name=name;bone.position.set(x,y,z);parent.add(bone);return bone;}

// The horse's legs skin only the legs. The belly stays on the body, so a swinging
// leg never drags the ribcage with it. Slots: body, upper, lower, then the hoof
// (or the neck, where a shoulder meets it).
function skinHorseLeg(i,leg,p,indices,weights){
  const x=Math.abs(p.getX(i)),y=p.getY(i),z=Math.abs(p.getZ(i));
  const top=leg.front?1.22:1.32;if(y>=top)return;
  const near=smoothstep(.06,.15,x)*(leg.front?smoothstep(.12,.3,z):smoothstep(.18,.36,z));
  const influence=(1-smoothstep(leg.front?.88:.8,top,y))*Math.max(near,1-smoothstep(.72,.9,y));
  if(influence<=0)return;
  const body=weights.getX(i),neck=weights.getY(i)+weights.getZ(i),rest=(1-influence)/(body+neck||1);
  const lower=1-smoothstep(.46,.64,y),hoof=1-smoothstep(.13,.23,y);
  indices.setXYZW(i,0,leg.index,leg.index+1,hoof>0?leg.index+2:1);
  weights.setXYZW(i,body*rest,influence*(1-lower),influence*lower*(1-hoof),hoof>0?influence*lower*hoof:neck*rest);
}

// Hair deep in a lock follows the mane bones; where it meets the coat it stays
// on the neck, so the mesh stretches instead of tearing.
function skinMane(i,source,bones,p,indices,weights){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  let hair=Infinity,coat=Infinity,headBone=false;
  for(const prim of source.prims){
    const d=SDFModel.dist(prim,x,y,z);
    if(prim.tag!=='mane')coat=Math.min(coat,d);
    else if(d<hair){hair=d;headBone=prim.bone===2;}
  }
  if(headBone)return;
  const free=smoothstep(.004,.05,coat),t=Math.min(1.999,Math.max(0,(y-1.57)/.45*2)),at=Math.floor(t),mix=t-at,head=weights.getZ(i);
  indices.setXYZW(i,1,bones[at],bones[at+1],2);
  weights.setXYZW(i,(1-free)*(1-head),free*(1-head)*(1-mix),free*(1-head)*mix,head);
}

// Carried by the skin rather than its own meshes: same triangles, two draws
// fewer, and the tail can bend along its length.
function skinTail(geometry,hairColor,bones) {
  const pieces=[geometry];
  const curve=new THREE.CatmullRomCurve3([[0,0,0],[0,-.15,-.13],[.02,-.55,-.16],[.025,-.98,-.1]].map(v=>new THREE.Vector3(...v)));
  const tube=new THREE.TubeGeometry(curve,10,.065,7,false),tuft=new THREE.SphereGeometry(1,16,10);
  tuft.scale(.078,.15,.065);tuft.translate(.025,-.9,-.1);
  for(const piece of [tube,tuft]) {
    piece.deleteAttribute('uv');piece.translate(0,TAIL_ROOT[0],TAIL_ROOT[1]);
    const count=piece.attributes.position.count,index=new Uint16Array(count*4),weight=new Float32Array(count*4),rgb=new Float32Array(count*3);
    for(let i=0;i<count;i++) {
      const down=TAIL_ROOT[0]-piece.attributes.position.getY(i);
      const mid=smoothstep(.25,.45,down),tip=smoothstep(.6,.8,down);
      index.set([bones[0],bones[1],bones[2],0],i*4);weight.set([1-mid,mid-tip,tip,0],i*4);
      hairColor.toArray(rgb,i*3);
    }
    piece.setAttribute('color',new THREE.BufferAttribute(rgb,3));
    piece.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(index,4));
    piece.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weight,4));
    pieces.push(piece);
  }
  const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());return merged;
}

export function makeAnimal(species,sculpt,{seed=7,coat,locomotion=false}={}) {
  if(!Number.isInteger(seed))throw new RangeError('Animal seed must be an integer');
  const horse=species==='horse',cow=species==='cow',large=horse||cow,random=rng(seed);
  const coats=horse?{bay:0x995b38,palomino:0xc59b5b,grey:0xb7b2a4}:cow?{pinto:0xe8dcc2,brown:0xa57850}:{red:0xb85e31,cream:0xe5d8b9};
  const coatName=coat??Object.keys(coats)[Math.floor(random()*Object.keys(coats).length)];
  if(!Object.hasOwn(coats,coatName))throw new RangeError(`Unknown ${species} coat: ${coatName}`);
  const source=template(species,sculpt),geometry=source.geometry.clone();
  const base=new THREE.Color(coats[coatName]),hair=horse?(coatName==='palomino'?0xe2cda0:0x392d26):0x594332;
  const colors={coat:base,neck:base.clone().lerp(new THREE.Color(0xe4ab5d),.25),
    hoof:new THREE.Color(0x3a3029),mane:new THREE.Color(hair),muzzle:base.clone().multiplyScalar(.64),
    beak:new THREE.Color(0xc89442),red:new THREE.Color(0xba382d),
    udder:new THREE.Color(0xc59680),horn:new THREE.Color(0xdac9a3)};
  if(cow)colors.muzzle=new THREE.Color(0x9f7566);
  const rgb=new Float32Array(source.tags.length*3),p=geometry.attributes.position;
  for(let i=0;i<source.tags.length;i++) {
    let color=colors[source.tags[i]];
    // A blaze and rear socks make the horse read clearly at racing distance.
    if(horse&&source.tags[i]==='coat'&&((p.getY(i)<.35&&p.getZ(i)<0)||(Math.abs(p.getX(i))<.031&&p.getY(i)>1.72&&p.getY(i)<1.99&&p.getZ(i)>1.06)))color=new THREE.Color(0xe8d8b9);
    if(cow&&coatName==='pinto'&&source.tags[i]==='coat') {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const patch=Math.sin(z*6+seed*.3)+Math.cos(y*7+x*4)+.35*Math.sin(z*13-y*9);
      if(y>.32)color=color.clone().lerp(new THREE.Color(0x694b34),smoothstep(.48,.85,patch));
    }
    color.toArray(rgb,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
  const group=new THREE.Group(),shape=new THREE.Group();group.name=horse?'Caballo llanero':cow?'Vaca del hato':'Gallina de patio';group.add(shape);
  const root=new THREE.Bone(),neck=new THREE.Bone(),head=new THREE.Bone();
  root.name='AnimalRoot';neck.name='AnimalNeck';head.name='AnimalHead';
  const neckAt=horse?[0,1.43,.48]:cow?[0,1.12,.55]:[0,.3,.1],headAt=horse?[0,1.91,.94]:cow?[0,1.38,1.04]:[0,.61,.19];
  neck.position.set(...neckAt);head.position.set(...headAt).sub(neck.position);root.add(neck);neck.add(head);
  const gaited=horse&&locomotion;
  const skin=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86}));
  skin.name='AnimalSkin';skin.castShadow=true;skin.receiveShadow=true;skin.add(root);shape.add(skin);
  const bones=[root,neck,head],legs=[];
  // Opt-in running rig (the horse for riding, the cow for Bululú's coleo).
  // Default Studio/grazing animals retain their original skin.
  const legRig=horse?{x:.25,hip:1.15,front:.49,rear:-.59,knee:[[0,-.59,.04],[0,-.59,-.14]],cut:1.18,from:.88,low:[.44,.66],inner:0}
    :cow?{x:.28,hip:.98,front:.47,rear:-.6,knee:[[0,-.42,-.07],[0,-.4,-.18]],cut:1,from:.74,low:[.46,.6],inner:.17}:null;
  const mane=[],tailBones=[];
  if(gaited){
    for(const front of [true,false])for(const side of [-1,1]){
      const rest=front?HORSE_LEGS.front:HORSE_LEGS.hind,name=`${front?'Front':'Rear'}${side<0?'Right':'Left'}Leg`;
      const upper=addBone(root,name,rest.hip[0],rest.hip[1],side*legRig.x);
      const lower=addBone(upper,`${name}Lower`,rest.knee[0]-rest.hip[0],rest.knee[1]-rest.hip[1]);
      const hoof=addBone(lower,`${name}Hoof`,rest.fetlock[0]-rest.knee[0],rest.fetlock[1]-rest.knee[1]);
      legs.push({upper,lower,hoof,front,side,index:bones.length});bones.push(upper,lower,hoof);
    }
    MANE_BONES.forEach(([y,z],i)=>{
      const [py,pz]=i?MANE_BONES[i-1]:[neckAt[1],neckAt[2]];
      mane.push(addBone(i?mane[i-1]:neck,`AnimalMane${i}`,y-py,z-pz));
    });
    const maneAt=mane.map((bone,i)=>bones.length+i);bones.push(...mane);
    const tailRoot=addBone(root,'AnimalTail',...TAIL_ROOT),tailMid=addBone(tailRoot,'AnimalTailMid',-.35,-.16),tailTip=addBone(tailMid,'AnimalTailTip',-.35,.03);
    tailBones.push(tailRoot,tailMid,tailTip);const tailAt=tailBones.map((bone,i)=>bones.length+i);bones.push(...tailBones);
    const indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
    for(let i=0;i<p.count;i++){
      if(source.tags[i]==='mane'){skinMane(i,source,maneAt,p,indices,weights);continue;}
      skinHorseLeg(i,legs.find(l=>l.front===(p.getZ(i)>0)&&l.side===(p.getX(i)<0?-1:1)),p,indices,weights);
    }
    skin.geometry=skinTail(geometry,colors.mane,tailAt);geometry.dispose();
  }else if(legRig&&locomotion){
    for(const front of [true,false])for(const side of [-1,1]){
      const upper=new THREE.Bone(),lower=new THREE.Bone();
      upper.name=`${front?'Front':'Rear'}${side<0?'Left':'Right'}Leg`;
      lower.name=`${upper.name}Lower`;
      upper.position.set(side*legRig.x,legRig.hip,front?legRig.front:legRig.rear);
      lower.position.set(...legRig.knee[front?0:1]);
      root.add(upper);upper.add(lower);legs.push({upper,lower,front,side,index:bones.length});bones.push(upper,lower);
    }
    const indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
    for(let i=0;i<p.count;i++){
      // The cow's udder and belly sit between its legs: keep them on the body.
      const y=p.getY(i);if(y>=legRig.cut||Math.abs(p.getX(i))<legRig.inner||source.tags[i]==='udder')continue;
      const leg=legs.find(l=>l.front===(p.getZ(i)>0)&&l.side===(p.getX(i)<0?-1:1));
      const influence=1-smoothstep(legRig.from,legRig.cut,y),lower=1-smoothstep(...legRig.low,y);
      indices.setXYZW(i,0,leg.index,leg.index+1,0);weights.setXYZW(i,1-influence,influence*(1-lower),influence*lower,0);
    }
  }
  const skeleton=new THREE.Skeleton(bones);skin.bind(skeleton);
  // Explicitly generous animation bounds (meshes can graze outside the bind pose).
  skin.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,large?1:.4,0),large?2.5:1);
  const eyes=[];
  for(const s of [-1,1]) {
    const eye=oval(head,0x241c17,horse?[s*.13,.015,.08]:cow?[s*.155,.005,.075]:[s*.07,.016,.026],large?[.026,.023,.025]:[.014,.015,.014]);
    eyes.push(eye);
    oval(eye,0xffeed4,large?[s*.015,.009,.013]:[s*.009,.006,.007],large?[.007,.007,.007]:[.004,.004,.004]);
    if(horse)oval(head,0x382a22,[s*.083,-.265,.445],[.02,.027,.014]);
    if(cow)oval(head,0x48382c,[s*.095,-.28,.452],[.027,.018,.013]);
  }
  // A mounted horse's tail is three bones in the skin; everyone else's a rigid pivot.
  const tail=gaited?tailBones[0]:new THREE.Group();
  if(!gaited){tail.name='AnimalTail';tail.position.set(0,horse?1.48:cow?1.35:.49,large?-.82:-.27);shape.add(tail);}
  if(large&&!gaited) {
    const curve=new THREE.CatmullRomCurve3([[0,0,0],[0,-.15,-.13],[.02,-.55,-.16],[.025,-.98,-.1]].map(v=>new THREE.Vector3(...v)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,10,cow?.025:.065,7,false),material(cow?base:hair));mesh.castShadow=true;tail.add(mesh);
    oval(tail,hair,[.025,-.9,-.1],[.078,.15,.065]);
  } else if(!large) {
    for(let i=0;i<5;i++) {
      const feather=oval(tail,hair,[(i-2)*.035,.065,-.075],[.036,.13,.046]);feather.rotation.x=-.6;feather.rotation.z=-(i-2)*.17;
    }
    mergeDetails(tail);
    const wings=new THREE.Group();wings.name='FoldedWings';shape.add(wings);
    for(const s of [-1,1])for(let i=0;i<3;i++) {
      const wing=oval(wings,base.clone().multiplyScalar(.82+i*.055),[s*(.13+i*.008),.37-i*.024,-.08-i*.022],[.034,.095,.17-i*.012]);wing.rotation.x=-.26;
    }
    mergeDetails(wings);
  }
  shape.scale.set(horse?.98+random()*.07:.98+random()*.08,1,1);
  const phase=random()*Math.PI*2;
  group.userData.species=species;group.userData.seed=seed;group.userData.coat=coatName;
  let posed=false;
  const clearGait=()=>{
    posed=false;shape.position.y=0;shape.rotation.x=0;
    for(const leg of legs){
      const rest=leg.front?HORSE_LEGS.front:HORSE_LEGS.hind;
      leg.upper.position.z=rest.hip[1];leg.upper.rotation.x=0;leg.lower.rotation.x=0;leg.hoof.rotation.x=0;
    }
    for(const bone of mane)bone.rotation.set(0,0,0);
    for(const bone of tailBones)bone.rotation.set(0,0,0);
  };
  group.userData.tick=(t=0)=>{
    if(!Number.isFinite(t))return;
    if(posed)clearGait();
    const time=t+phase,cycle=(Math.sin(time*(large?.22:.8))+1)*.5;
    const feed=smoothstep(.58,.93,cycle);
    // Extend the poll while lowering the neck; counter-rotate the horse's head
    // so the muzzle approaches the grass instead of folding under its chest.
    neck.position.y=neckAt[1]-(horse?.18:0)*feed;
    head.position.y=headAt[1]-neckAt[1]+(horse?.12:0)*feed;
    head.position.z=headAt[2]-neckAt[2]+(horse?.3:.03)*feed;
    neck.rotation.x=(horse?1.43:cow?.48:1.54)*feed+Math.sin(time*.7)*.025;
    head.rotation.x=(horse?-.82:cow?-.18:.27)*feed+Math.sin(time*(large?1.8:5))*(large?.035:.07)*feed;
    head.rotation.y=Math.sin(time*.39)*(horse?.045:.08)*(1-feed);
    tail.rotation.z=Math.sin(time*(horse?1.8:1.1))*(horse?.13:.045);
    const blink=1-.91*Math.exp(-(((Math.sin(time*.53)-.996)/.016)**2));
    eyes.forEach(eye=>{eye.scale.y=blink;});
    skin.updateMatrixWorld(true);
    // Box3/Studio must recompute skinned bounds after every sampled pose.
    skin.boundingBox=null;
  };
  if(gaited){
    // A pure pose from the arguments: legs in LH, RH, LF, RF order. The animal's
    // left is +x (it faces +z).
    const front=HORSE_LEGS.front,hind=HORSE_LEGS.hind;
    const gaitRig=createQuadrupedRig({legs:[hind,hind,front,front],neck:neckAt.slice(1),head:headAt.slice(1),bit:[1.92,.89]});
    const pose=newPose(gaitRig),variation=gaitVariation(seed);
    const ordered=[legs.find(l=>!l.front&&l.side>0),legs.find(l=>!l.front&&l.side<0),legs.find(l=>l.front&&l.side>0),legs.find(l=>l.front&&l.side<0)];
    group.userData.gait={rig:gaitRig,pose,variation};
    group.userData.gallop=(phase=0,speed=0,jump=0,climb=0)=>{
      posed=true;poseQuadruped(gaitRig,phase,speed,jump,climb,pose,variation);
      shape.position.y=pose.bob;shape.rotation.x=pose.pitch;
      neck.position.set(0,neckAt[1],neckAt[2]);head.position.set(0,headAt[1]-neckAt[1],headAt[2]-neckAt[2]);
      neck.rotation.set(pose.neck,0,0);head.rotation.set(pose.head,0,0);
      for(let i=0;i<4;i++){
        const bones=ordered[i],solved=pose.legs[i];
        bones.upper.position.z=gaitRig.legs[i].hip[1]+solved.slide;
        bones.upper.rotation.x=solved.upper;bones.lower.rotation.x=solved.lower;bones.hoof.rotation.x=solved.hoof;
      }
      for(let i=0;i<3;i++){
        mane[i].rotation.set(pose.mane[i].x,0,pose.mane[i].z);
        tailBones[i].rotation.set(pose.tail[i].x,0,pose.tail[i].z);
      }
      skin.updateMatrixWorld(true);skin.boundingBox=null;
    };
  }else if(legs.length)group.userData.gallop=(phase=0,speed=0,jump=0)=>{
    const amount=Math.min(1,Math.max(0,speed)/5);
    neck.position.set(...neckAt);
    head.position.set(...headAt).sub(neck.position);
    neck.rotation.set(-.12*amount+Math.sin(phase*2)*.035*amount,0,0);
    head.rotation.set(.06*amount,0,0);
    for(const leg of legs){
      const cycle=phase+(leg.front?0:2.1)+(leg.side<0?.5:0);
      leg.upper.rotation.x=(Math.sin(cycle)*.65+(leg.front?-.12:.12))*amount+(jump>0?(leg.front?-.5:.3):0);
      leg.lower.rotation.x=Math.max(0,Math.cos(cycle))*(leg.front?1:-1)*.95*amount;
    }
    shape.position.y=Math.abs(Math.sin(phase))*.08*amount;
    shape.rotation.x=Math.sin(phase)*.025*amount;
    tail.rotation.set(-.25*amount,0,Math.sin(phase*.7)*.12);
    skin.updateMatrixWorld(true);skin.boundingBox=null;
  };
  let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;skeleton.dispose();group.traverse(o=>o.material?.dispose());};
  // Frame the whole grazing envelope, independent of the sampled thumbnail pose.
  group.userData.previewBounds=horse?[[-.65,0,-1.12],[.65,2.3,2.08]]:cow?[[-.65,0,-1.12],[.65,1.8,1.85]]:[[-.25,0,-.5],[.25,.81,.64]];
  group.userData.tick(0);
  return group;
}
