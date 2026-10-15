// Horse/chicken/cow sculpt recipes adapted from threejs-procedural-animals (MIT).
// Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors.
// See vendor/procedural-animals/README.md and LICENSE for provenance.
// Pana adaptation: simplified anatomy, native skinning, matte coats, absolute-time
// idle poses. Ground at y=0; forward +Z; metres. Every instance owns its GPU data.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SDFModel } from './vendor/procedural-animals/core/sdf/sdf.js';
import { meshSDF } from './vendor/procedural-animals/core/sdf/mesher.js';
import { rng, smoothstep } from './vendor/procedural-animals/core/math/vec.js';

const templates = new Map();
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .88 });
const ell = (m, c, r, bone = 0, tag = 'coat', k = .06, axis) => m.ell({ c, r, bone, tag, k, axis });
const cone = (m, a, b, ra, rb, bone = 0, tag = 'coat', k = .035) => m.cone({ a, b, ra, rb, bone, tag, k });

function horseSculpt() {
  const m = new SDFModel();
  // Upstream ribcage / girth / abdomen / flank / withers recipe, broadened for
  // Pana's soft toy proportions. Lower limb anatomy retains the hock and pastern.
  for (const [c,r] of [
    [[0,1.26,.14],[.32,.345,.56]], [[0,1.22,.46],[.27,.29,.2]],
    [[0,1.25,-.16],[.32,.29,.32]], [[0,1.32,-.38],[.29,.22,.22]],
    [[0,1.5,.44],[.1,.12,.22]], [[0,1.46,.08],[.2,.085,.36]],
    [[0,1.41,-.6],[.3,.24,.28]], [[0,1.08,.64],[.2,.16,.17]],
  ]) ell(m,c,r);
  for (const s of [-1,1]) {
    ell(m,[s*.14,1.33,-.72],[.16,.22,.15]);
    // Front leg: shoulder, elbow, knee, cannon, fetlock, hoof.
    ell(m,[s*.24,1.27,.48],[.115,.3,.18]);
    cone(m,[s*.24,1.19,.5],[s*.26,.9,.39],.105,.073);
    cone(m,[s*.26,.9,.39],[s*.26,.55,.53],.075,.045);
    ell(m,[s*.26,.55,.53],[.057,.065,.055]);
    cone(m,[s*.26,.53,.53],[s*.26,.18,.52],.037,.04);
    cone(m,[s*.26,.18,.52],[s*.26,.09,.59],.046,.055);
    ell(m,[s*.26,.065,.6],[.076,.066,.095],0,'hoof',.018);
    // Rear leg: muscular thigh, forward stifle, rear hock, slim cannon.
    ell(m,[s*.24,1.18,-.59],[.15,.28,.22]);
    cone(m,[s*.25,1.17,-.61],[s*.27,.87,-.37],.14,.095);
    cone(m,[s*.27,.87,-.37],[s*.27,.53,-.73],.087,.045);
    ell(m,[s*.27,.53,-.73],[.055,.065,.056]);
    cone(m,[s*.27,.53,-.73],[s*.27,.17,-.65],.037,.038);
    cone(m,[s*.27,.17,-.65],[s*.27,.08,-.57],.043,.057);
    ell(m,[s*.27,.065,-.56],[.075,.066,.096],0,'hoof',.018);
  }
  // Same tapered, rising neck construction as upstream, with fewer sections.
  for (const [c,r] of [
    [[0,1.4,.64],[.22,.28,.26]], [[0,1.62,.73],[.16,.26,.22]],
    [[0,1.82,.84],[.12,.23,.17]],
  ]) ell(m,c,r,1,'coat',.09,[0,.75,.6]);
  ell(m,[0,1.93,.99],[.135,.14,.18],2);
  ell(m,[0,1.79,1.15],[.092,.115,.22],2,'coat',.055,[0,-.7,1]);
  ell(m,[0,1.64,1.3],[.115,.095,.115],2,'muzzle',.05);
  for (const s of [-1,1]) {
    ell(m,[s*.075,1.82,1.02],[.075,.13,.115],2);
    m.ell({c:[s*.095,2.09,.91],r:[.045,.16,.038],bone:2,tag:'coat',k:.025,up:[s*.2,1,-.13]});
  }
  // Broad overlapping hair locks replace the upstream shell/fur renderer.
  for (let i=0;i<9;i++) {
    const t=i/8;
    ell(m,[-.105,1.57+t*.45,.43+t*.42],[.055,.15,.072],1,'mane',.02,[0,.9,.4]);
  }
  ell(m,[0,2.015,1.02],[.08,.055,.11],2,'mane',.022,[0,-.4,1]);
  return m;
}

function chickenSculpt() {
  const m = new SDFModel();
  // Adapted breast, keel, mantle, belly and cushion recipe (upstream adult hen),
  // doubled in scale, with a broader head and fewer feather layers.
  for (const [c,r] of [
    [[0,.368,.12],[.132,.156,.148]], [[0,.284,.072],[.108,.108,.128]],
    [[0,.472,-.024],[.128,.096,.216]], [[0,.272,-.11],[.128,.132,.172]],
    [[0,.492,-.216],[.104,.104,.124]], [[0,.33,-.256],[.104,.124,.104]],
  ]) ell(m,c,r,0,'coat',.045);
  ell(m,[0,.48,.16],[.084,.15,.092],1,'neck');
  ell(m,[0,.61,.19],[.075,.09,.083],2,'neck',.035);
  cone(m,[0,.595,.25],[0,.57,.36],.035,.003,2,'beak',.009);
  // Comb blade with five rounded points; separate wattles under the bill.
  ell(m,[0,.696,.18],[.015,.033,.08],2,'red',.012);
  for (let i=0;i<5;i++) ell(m,[0,.72+Math.sin(i*.7)*.012,.13+i*.027],[.014,.03,.018],2,'red',.009);
  for (const s of [-1,1]) ell(m,[s*.024,.53,.245],[.018,.048,.031],2,'red',.012);
  for (const s of [-1,1]) {
    ell(m,[s*.085,.22,-.06],[.054,.085,.065]);
    cone(m,[s*.085,.19,-.055],[s*.092,.055,-.01],.018,.014,0,'beak',.01);
    // Three forward toes plus a back toe, tips rounded and grounded.
    for (const d of [-1,0,1]) cone(m,[s*.092,.028,-.01],[s*.092+d*.042,.012,.085-Math.abs(d)*.015],.013,.007,0,'beak',.008);
    cone(m,[s*.092,.028,-.01],[s*.11,.011,-.065],.011,.007,0,'beak',.006);
  }
  return m;
}

function cowSculpt() {
  const m=new SDFModel();
  // Adapted upstream ribcage, girth, abdomen, flank and rump, softened into a
  // broad dairy silhouette. A short neck distinguishes cattle from the horse.
  for(const [c,r] of [
    [[0,1.04,.12],[.36,.4,.56]],[[0,1.02,.44],[.3,.33,.24]],
    [[0,1,-.22],[.39,.37,.36]],[[0,.84,-.08],[.32,.2,.42]],
    [[0,1.17,-.45],[.33,.24,.24]],[[0,1.25,-.68],[.3,.2,.28]],
    [[0,1.35,.04],[.22,.08,.42]],[[0,.83,.6],[.2,.17,.17]],
  ])ell(m,c,r,0,'coat',.085);
  for(const s of [-1,1]) {
    ell(m,[s*.27,1.08,.45],[.13,.27,.17]);
    cone(m,[s*.28,.99,.48],[s*.28,.57,.4],.09,.055);
    cone(m,[s*.28,.57,.4],[s*.28,.13,.45],.049,.04);
    ell(m,[s*.28,1.04,-.65],[.15,.28,.19]);
    cone(m,[s*.28,.92,-.57],[s*.3,.52,-.77],.085,.05);
    cone(m,[s*.3,.52,-.77],[s*.3,.13,-.67],.045,.039);
    // Cloven hoof halves remain visibly separate at the front.
    for(const [x,z]of [[s*.28,.5],[s*.3,-.61]])for(const d of [-1,1])
      ell(m,[x+d*.037,.066,z],[.033,.067,.09],0,'hoof',.006);
  }
  ell(m,[0,.65,-.4],[.18,.13,.2],0,'udder',.035);
  for(const s of [-1,1])for(const z of [-.48,-.32])cone(m,[s*.09,.6,z],[s*.09,.47,z],.028,.018,0,'udder',.01);
  ell(m,[0,1.16,.64],[.24,.27,.26],1,'coat',.1);
  ell(m,[0,1.26,.87],[.19,.21,.24],1,'coat',.08);
  ell(m,[0,1.38,1.04],[.17,.18,.19],2,'coat',.06);
  ell(m,[0,1.22,1.22],[.135,.17,.21],2,'coat',.055,[0,-.5,1]);
  ell(m,[0,1.08,1.39],[.18,.115,.12],2,'muzzle',.035);
  for(const s of [-1,1]) {
    ell(m,[s*.25,1.41,1.01],[.18,.055,.1],2,'coat',.025,[s,0,-.2]);
    cone(m,[s*.12,1.49,.96],[s*.22,1.62,.94],.045,.029,2,'horn',.012);
    cone(m,[s*.22,1.62,.94],[s*.21,1.75,.99],.029,.004,2,'horn',.009);
  }
  return m;
}

function template(species) {
  if (templates.has(species)) return templates.get(species);
  const horse=species==='horse',cow=species==='cow',large=horse||cow;
  const model=horse?horseSculpt():cow?cowSculpt():chickenSculpt();
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
  const result={geometry,tags};templates.set(species,result);return result;
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

function makeAnimal(species,{seed=7,coat}={}) {
  if(!Number.isInteger(seed))throw new RangeError('Animal seed must be an integer');
  const horse=species==='horse',cow=species==='cow',large=horse||cow,random=rng(seed);
  const coats=horse?{bay:0x995b38,palomino:0xc59b5b,grey:0xb7b2a4}:cow?{pinto:0xe8dcc2,brown:0xa57850}:{red:0xb85e31,cream:0xe5d8b9};
  const coatName=coat??Object.keys(coats)[Math.floor(random()*Object.keys(coats).length)];
  if(!Object.hasOwn(coats,coatName))throw new RangeError(`Unknown ${species} coat: ${coatName}`);
  const source=template(species),geometry=source.geometry.clone();
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
  const skin=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86}));
  skin.name='AnimalSkin';skin.castShadow=true;skin.receiveShadow=true;skin.add(root);shape.add(skin);
  const skeleton=new THREE.Skeleton([root,neck,head]);skin.bind(skeleton);
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
  const tail=new THREE.Group();tail.name='AnimalTail';tail.position.set(0,horse?1.48:cow?1.35:.49,large?-.82:-.27);shape.add(tail);
  if(large) {
    const curve=new THREE.CatmullRomCurve3([[0,0,0],[0,-.15,-.13],[.02,-.55,-.16],[.025,-.98,-.1]].map(v=>new THREE.Vector3(...v)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,10,cow?.025:.065,7,false),material(cow?base:hair));mesh.castShadow=true;tail.add(mesh);
    oval(tail,hair,[.025,-.9,-.1],[.078,.15,.065]);
  } else {
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
  group.userData.tick=(t=0)=>{
    if(!Number.isFinite(t))return;
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
  let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;skeleton.dispose();group.traverse(o=>o.material?.dispose());};
  // Frame the whole grazing envelope, independent of the sampled thumbnail pose.
  group.userData.previewBounds=horse?[[-.65,0,-1.12],[.65,2.3,2.08]]:cow?[[-.65,0,-1.12],[.65,1.8,1.85]]:[[-.25,0,-.5],[.25,.81,.64]];
  group.userData.tick(0);
  return group;
}

export function llaneroHorse(options){return makeAnimal('horse',options);}
export function yardChicken(options){return makeAnimal('chicken',options);}
export function hatoCow(options){return makeAnimal('cow',options);}
