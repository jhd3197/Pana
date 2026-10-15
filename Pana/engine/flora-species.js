// Additional vegetation for the shared library. Each factory owns its geometry,
// uses a deterministic seed, sits on y=0 and returns static material batches.
import * as THREE from 'three';
import { M, mesh, rng } from './props.js';
import { leafBlade, taperedStem } from './botanical-shapes.js';
import { bake } from './static-batch.js';

const leafMaterial=M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,flatShading:false,roughness:1});
const bark=M(0x8b7350,{flatShading:false,roughness:1});
const stemMaterial=M(0x527d39,{flatShading:false,roughness:1});
const TAU=Math.PI*2;

function finish(root,name) {
  const result=bake(root);result.name=name;
  const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
  return result;
}
function stem(group,points,radius,tip,material=stemMaterial,segments=8) {
  group.add(mesh(taperedStem(points,radius,tip,segments,6),material));
}
function leaf(group,length,width,position,rotation,tint=0x619e48,bend=0.15,segments=6) {
  const m=mesh(leafBlade(length,width,bend,tint,segments),leafMaterial,...position);
  m.rotation.set(...rotation);group.add(m);return m;
}
function cushion(group,position,size,tint,seed,small=false) {
  const geo=new THREE.SphereGeometry(1,small?8:14,small?6:10),p=geo.attributes.position,colors=[];
  const light=new THREE.Color(tint),dark=light.clone().multiplyScalar(0.55);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+0.1*Math.sin(x*6+seed)*Math.sin(z*5-seed)+0.05*Math.cos(y*7+seed);
    p.setXYZ(i,x*r,y*r,z*r);
    const c=dark.clone().lerp(light,0.62+y*0.3);colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const m=mesh(geo,leafMaterial,...position);m.scale.set(...size);group.add(m);
}

// Broad golden flowering crown with visible forks and individual trumpet blooms.
export function araguaney({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.6+r()*0.5;
  stem(g,[[0,0,0],[0.09,1.6,0.04],[-0.12,h,0]],0.36,0.12,bark,12);
  for(let i=0;i<5;i++) {
    const a=i*TAU/5+0.3,reach=1.7+r()*0.7,x=Math.cos(a)*reach,z=Math.sin(a)*reach,y=h+0.5+r()*0.6;
    stem(g,[[0,1.4,0],[x*0.25,h-0.55,z*0.25],[x,y,z]],0.19,0.045,bark);
    cushion(g,[x,y+0.23,z],[1.3+r()*0.25,0.75,1.12],[0xeec338,0xf7cf42,0xe3b42e][i%3],seed+i);
    for(let k=0;k<8;k++) {
      const angle=k*TAU/8+r()*0.2,flower=new THREE.Group();
      cushion(g,[x+Math.cos(angle)*1.0,y+0.16+r()*0.15,z+Math.sin(angle)*0.91],
        [0.4,0.32,0.38],k%2?0xf4ce45:0xeec338,seed+k,true);
      flower.position.set(x+Math.cos(angle)*1.08,y+0.62+r()*0.25,z+Math.sin(angle)*0.97);
      flower.rotation.set(Math.sin(angle)*0.5,r()*TAU,Math.cos(angle)*0.5);
      for(let j=0;j<5;j++)leaf(flower,0.27,0.15,[0,0,0],[0,j*TAU/5,0.16],0xffdc4c,0.08,4);
      const core=mesh(new THREE.ConeGeometry(0.085,0.08,7),M(0xcf8e22,{roughness:1}),0,0.04,0);flower.add(core);g.add(flower);
    }
    for(let k=0;k<3;k++)leaf(g,0.5,0.13,[x,y-0.27,z],[0.1,a+k*0.8,0.24],0x5d873f);
  }
  cushion(g,[-0.1,h+1,0],[1.65,0.8,1.48],0xf5ce39,seed+16);
  return finish(g,'araguaney');
}

// A grove, rather than a single pole: different-height culms, joints and sprays.
export function bamboo({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),green=M(0x729d48,{roughness:1,flatShading:false}),joint=M(0xbed08a,{roughness:1,flatShading:false});
  for(let i=0;i<7;i++) {
    const a=i*2.4,spread=i?0.4+r()*0.6:0,x=Math.cos(a)*spread,z=Math.sin(a)*spread,h=3.3+r()*2.9;
    const dx=(r()-0.5)*0.55,dz=(r()-0.5)*0.55,radius=0.11+r()*0.035;
    const culm=new THREE.Group();culm.position.set(x,0,z);g.add(culm);
    stem(culm,[[0,0,0],[dx*0.4,h*0.5,dz*0.4],[dx,h,dz]],radius,radius*0.72,green,10);
    for(let y=0.12;y<h;y+=0.65) {
      const t=y/h,band=mesh(new THREE.TorusGeometry(radius*(1-t*0.28)+0.006,0.018,4,9),joint,dx*t,y,dz*t);
      band.rotation.x=Math.PI/2;culm.add(band);
    }
    for(let j=0;j<3;j++) {
      const y=h*(0.57+j*0.18),angle=a+j*2.2,branch=new THREE.Group();branch.position.set(dx*y/h,y,dz*y/h);branch.rotation.y=angle;
      stem(branch,[[0,0,0],[0.45,0.18,0],[1.05,0.3,0]],0.024,0.006,green,6);
      for(let k=1;k<=5;k++)for(const side of [-1,1])leaf(branch,0.55+(5-k)*0.055,0.075,[k*0.18,k*0.052,0],[0,side*(0.7+k*0.05),0.18-k*0.07],k%2?0x709d4c:0x4b823f,0.08,4);
      culm.add(branch);
    }
  }
  return finish(g,'bamboo');
}

// Arching feathered fronds and two young curled fiddleheads.
export function fern({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group();
  for(let i=0;i<9;i++) {
    const frond=new THREE.Group(),length=1.15+r()*0.65,rise=0.6+r()*0.2;
    frond.position.y=0.06;frond.rotation.y=i*TAU/9+r()*0.23;g.add(frond);
    const y=t=>Math.sin(t*Math.PI*0.8)*rise;
    stem(frond,[[0,0,0],[length*0.4,y(0.4),0],[length,y(1),0]],0.021,0.004,stemMaterial,12);
    for(let k=1;k<12;k++) {
      const t=k/12,reach=0.09+Math.sin(t*Math.PI)*0.37;
      for(const side of [-1,1])leaf(frond,reach,reach*0.2,[t*length,y(t),0],[0,side*1.03,0.05],i%2?0x68a84b:0x438b46,0.045,4);
    }
  }
  for(let i=0;i<2;i++) {
    const points=[[i*0.15,0,0],[i*0.15-0.1,0.5,0],[i*0.15,0.95,0],[i*0.15+0.2,0.94,0],[i*0.15+0.2,0.77,0],[i*0.15+0.08,0.78,0]];
    stem(g,points,0.025,0.013,M(0x8baa59,{roughness:1}),22);
  }
  return finish(g,'fern');
}

function splitLeaf(length,tint) {
  // Deep perimeter splits and real holes survive silhouettes and wireframe view.
  const edge=[[0,0],[0.06,0.24],[0.2,0.48],[0.31,0.54],[0.38,0.23],[0.44,0.59],[0.54,0.6],
    [0.59,0.25],[0.65,0.53],[0.73,0.46],[0.78,0.18],[0.84,0.31],[0.94,0.16],[1,0]];
  const outline=[...edge,...edge.slice(1,-1).reverse().map(([x,y])=>[x,-y])];
  const shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
  for(const side of [-1,1])for(const x of [0.23,0.49]) {
    const hole=new THREE.Path();hole.absellipse(x,side*0.15,0.047,0.075,0,TAU,true,0.3*side);shape.holes.push(hole);
  }
  const outlineGeometry=new THREE.ShapeGeometry(shape,8),vertices=Array.from(outlineGeometry.attributes.position.array),indices=[],midpoints=new Map();
  // Add interior vertices before bending, preserving shared edges and leaf holes.
  // Bending the outline alone creates long, sharply folded triangles.
  const midpoint=(a,b)=>{
    const key=[Math.min(a,b),Math.max(a,b)].join(':');if(midpoints.has(key))return midpoints.get(key);
    const index=vertices.length/3;for(let i=0;i<3;i++)vertices.push((vertices[a*3+i]+vertices[b*3+i])/2);midpoints.set(key,index);return index;
  };
  const source=outlineGeometry.index.array;
  for(let i=0;i<source.length;i+=3) {
    const a=source[i],b=source[i+1],c=source[i+2],ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
    indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);outlineGeometry.dispose();
  const p=geo.attributes.position,colors=[],light=new THREE.Color(tint),dark=new THREE.Color(0x205c42);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getY(i),y=Math.sin(x*Math.PI)*0.15-x*x*0.14-Math.abs(z)*0.16;
    p.setXYZ(i,x*length,y*length,z*length);
    const c=dark.clone().lerp(light,0.55+x*0.24+(1-Math.abs(z))*0.15);colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

export function monstera({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group();
  for(let i=0;i<5;i++) {
    const a=i*2.4,reach=0.22+r()*0.32,h=1.35+r()*0.7,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[0,0,0],[x*0.3,h*0.6,z*0.3],[x,h,z]],0.035,0.018,stemMaterial);
    const length=0.9+r()*0.5,blade=mesh(splitLeaf(length,i%2?0x39875a:0x4d9b62),leafMaterial,x,h,z);
    blade.rotation.set(0,-a,-0.4-r()*0.4);g.add(blade);
    // Midrib follows the leaf's local curve without sealing its fenestrations.
    const midrib=mesh(taperedStem([[0,0.012,0],[length*0.5,length*0.115+0.012,0],[length,-length*0.14+0.012,0]],0.012,0.003,9,5),stemMaterial);
    midrib.position.copy(blade.position);midrib.rotation.copy(blade.rotation);g.add(midrib);
  }
  return finish(g,'monstera');
}

// Upright red bracts with golden tips and large folded tropical leaves.
export function heliconia({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),red=M(0xd84c32,{roughness:0.85,flatShading:false});
  for(let i=0;i<5;i++) {
    const a=i*2.4,x=Math.cos(a)*0.35,z=Math.sin(a)*0.35,h=1.45+r()*0.65;
    stem(g,[[x,0,z],[x,h*0.5,z],[x+0.05,h,z]],0.035,0.022,stemMaterial);
    for(let j=0;j<5;j++) {
      const side=j%2?-1:1,y=h-0.67+j*0.17,bract=new THREE.Group();bract.position.set(x,y,z);bract.rotation.y=a;g.add(bract);
      const points=[[0,0,0],[side*0.19,0.02,0],[side*0.36,0.23,0]];
      stem(bract,points,0.085,0.015,red,6);
      stem(bract,[[side*0.29,0.13,0],[side*0.36,0.23,0],[side*0.37,0.27,0]],0.03,0.003,M(0xf5be38,{roughness:1}),4);
    }
    const leaves=new THREE.Group();leaves.position.set(x,0.5+i*0.12,z);leaves.rotation.y=a;
    leaf(leaves,1.3+r()*0.35,0.27,[0,0,0],[0,0,0.65],i%2?0x559c4c:0x327d49,0.23,10);g.add(leaves);
  }
  return finish(g,'heliconia');
}

function cactusColumn(points,radius,material) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const geo=new THREE.TubeGeometry(curve,20,1,20,false),p=geo.attributes.position,colors=[];
  const dark=new THREE.Color(0x3c7b61),light=new THREE.Color(0x82ab74);
  for(let i=0;i<=20;i++) {
    const t=i/20,center=curve.getPointAt(t),cap=t<0.85?1:Math.sqrt(Math.max(0.002,1-((t-0.85)/0.15)**2));
    for(let j=0;j<=20;j++) {
      const k=i*21+j,a=j*TAU/20,rib=0.88+0.12*Math.cos(a*10),rr=radius*rib*cap;
      p.setXYZ(k,center.x+(p.getX(k)-center.x)*rr,center.y+(p.getY(k)-center.y)*rr,center.z+(p.getZ(k)-center.z)*rr);
      const c=dark.clone().lerp(light,0.4+0.38*Math.cos(a*10));colors.push(c.r,c.g,c.b);
    }
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return mesh(geo,material);
}

export function cactus({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.5+r()*0.7,mat=M(0xffffff,{vertexColors:true,roughness:1,flatShading:false});
  g.add(cactusColumn([[0,0,0],[0.03,h*0.6,0],[0.08,h,0]],0.34,mat));
  for(const side of [-1,1]) {
    const y=1.3+(side===1?0.35:0),x=side*(0.85+r()*0.2),top=y+0.95+r()*0.5;
    g.add(cactusColumn([[0,y,0],[x*0.75,y+0.1,0],[x,y+0.45,0],[x,top,0]],0.23,mat));
  }
  const cream=M(0xd6cda4,{roughness:1});
  for(let row=0;row<12;row++)for(let j=0;j<5;j++) {
    const a=j*TAU/5+row%2*0.3,x=Math.cos(a)*0.335,z=Math.sin(a)*0.335,y=0.25+row*0.24;
    const dot=mesh(new THREE.SphereGeometry(0.028,5,3),cream,x,y,z);g.add(dot);
  }
  const flower=new THREE.Group();flower.position.set(0.08,h,0);flower.rotation.x=0.3;
  for(let j=0;j<6;j++)leaf(flower,0.25,0.11,[0,0,0],[0,j*TAU/6,0.6],0xef947c,0.06,5);
  flower.add(mesh(new THREE.SphereGeometry(0.07,7,5),M(0xf3cc61,{roughness:1}),0,0.08,0));g.add(flower);
  return finish(g,'cactus');
}

// Exposed stilt roots keep the shoreline silhouette open below the canopy.
export function mangrove({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),wood=M(0x827563,{roughness:1,flatShading:false}),h=3.5+r()*0.45;
  stem(g,[[0,0,0],[-0.18,1.5,0.12],[0.12,h,0]],0.29,0.09,wood,12);
  for(let i=0;i<8;i++) {
    const a=i*TAU/8+r()*0.15,reach=1.3+r()*0.6,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[x,0.02,z],[x*0.86,0.65,z*0.86],[x*0.45,1.55,z*0.45],[0,2.1+r()*0.3,0]],0.075,0.15,wood,12);
    if(i%2===0)stem(g,[[x*1.1,0.01,z-0.35],[x*0.9,0.6,z-0.14],[x*0.65,1.1,z*0.65]],0.04,0.075,wood);
  }
  for(let i=0;i<6;i++) {
    const a=i*TAU/6,reach=1.1+r()*0.55,x=Math.cos(a)*reach,z=Math.sin(a)*reach,y=h+r()*0.55;
    stem(g,[[0,1.9,0],[x*0.5,y-0.55,z*0.5],[x,y,z]],0.14,0.025,wood);
    cushion(g,[x,y,z],[1.04,0.52,0.93],i%2?0x477c45:0x5a8c48,seed+i);
    for(let j=0;j<7;j++) {
      const b=j*TAU/7,pos=[x+Math.cos(b)*0.88,y-0.1,z+Math.sin(b)*0.8];
      if(j%2===0)cushion(g,[pos[0],y+0.06,pos[2]],[0.4,0.3,0.38],0x568947,seed+i+j,true);
      leaf(g,0.46,0.17,pos,[0,-b,-0.18],0x6c9d54,0.1);
      if(j===2||j===5)stem(g,[pos,[pos[0],y-0.52,pos[2]]],0.025,0.008,stemMaterial,4);
    }
  }
  cushion(g,[0,h+0.48,0],[1.35,0.6,1.15],0x568947,seed+20);
  return finish(g,'mangrove');
}

function papayaLeaf(length,tint) {
  // Seven deep lobes radiate from a raised center, each with a shallow side tooth.
  const vertices=[0,0.1,0],colors=[],indices=[],color=new THREE.Color(tint);
  for(let i=0;i<7;i++)for(let j=0;j<6;j++) {
    const a=(i+j/6)*TAU/7,reach=[0.28,0.58,0.5,1,0.5,0.58][j]*(i===0?0.8:1);
    vertices.push(Math.cos(a)*reach*length,(0.08-reach*reach*0.14)*length,Math.sin(a)*reach*length);
  }
  for(let i=1;i<=42;i++)indices.push(0,i,i%42+1);
  for(let i=0;i<vertices.length/3;i++) {const c=color.clone().multiplyScalar(i===0?1.1:0.8+(i%6)*0.025);colors.push(c.r,c.g,c.b);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function papaya({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.4+r()*0.5,wood=M(0xa5a075,{roughness:1,flatShading:false});
  stem(g,[[0,0,0],[0.05,h*0.5,0],[-0.08,h,0.03]],0.19,0.1,wood,14);
  for(let i=0;i<13;i++) {
    const scar=mesh(new THREE.TorusGeometry(0.18-i*0.005,0.011,3,9),wood,0.02,i*0.23+0.15,0);
    scar.rotation.set(Math.PI/2,0.06,0);g.add(scar);
  }
  for(let i=0;i<10;i++) {
    const a=i*2.4,reach=1.05+r()*0.55,y=h-0.12+r()*0.8,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[-0.08,h-0.18,0.03],[x*0.55,y+0.12,z*0.55],[x,y,z]],0.035,0.015,stemMaterial);
    const blade=mesh(papayaLeaf(0.65+r()*0.25,i%2?0x50994e:0x6aab4d),leafMaterial,x,y,z);
    blade.rotation.set(Math.sin(a)*0.15,-a,Math.cos(a)*0.15);g.add(blade);
  }
  for(let j=0;j<7;j++)leaf(g,0.18,0.045,[-0.08,h+0.05,0.03],[0,j*TAU/7,0.7],0x7bac51,0.02,3);
  for(let i=0;i<9;i++) {
    const a=i*2.4,y=h-0.55-(i%3)*0.21,x=Math.cos(a)*0.29,z=Math.sin(a)*0.29;
    stem(g,[[0,y+0.23,0],[x,y+0.14,z]],0.02,0.012,stemMaterial,4);
    cushion(g,[x,y-0.07,z],[0.18,0.38+r()*0.06,0.18],i<3?0xefa637:0x85a847,seed+i);
  }
  return finish(g,'papaya');
}

function succulentBlade(length,width,rise) {
  const vertices=[],colors=[],indices=[],green=new THREE.Color(0x68a395),cream=new THREE.Color(0xc6d6a0);
  for(let i=0;i<=12;i++) {
    const t=i/12,w=Math.sin(Math.PI*t)**0.8*width,y=rise*(1-(1-t)**2),thickness=w*0.26;
    for(const [z,offset,edge] of [[-w,0,1],[0,thickness,0],[w,0,1],[0,-thickness,0]]) {
      vertices.push(t*length,y+offset,z);const c=(edge?cream:green).clone().multiplyScalar(0.72+t*0.28);colors.push(c.r,c.g,c.b);
    }
    if(i<12)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4;indices.push(a,b,a+4,b,b+4,a+4);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function agave({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group();
  for(let layer=0;layer<3;layer++)for(let i=0;i<9-layer*2;i++) {
    const length=1.65-layer*0.48+r()*0.2,rise=0.35+layer*0.5+r()*0.12;
    const blade=mesh(succulentBlade(length,0.23-layer*0.035,rise),leafMaterial,0,0.06,0);
    blade.rotation.y=i*TAU/(9-layer*2)+layer*0.44+r()*0.12;g.add(blade);
  }
  return finish(g,'agave');
}

// The root marks the water surface; no pond disk or water plane is baked in.
export function waterLily({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),padMaterial=M(0x568c59,{roughness:0.8,flatShading:false});
  for(let i=0;i<4;i++) {
    const a=i*2.4,radius=0.55+r()*0.23,x=i?Math.cos(a)*0.92:0,z=i?Math.sin(a)*0.92:0,shape=new THREE.Shape();
    shape.moveTo(0,0);shape.lineTo(Math.cos(0.18)*radius,Math.sin(0.18)*radius);
    shape.absarc(0,0,radius,0.18,TAU-0.18,false);shape.lineTo(0,0);
    const pad=mesh(new THREE.ExtrudeGeometry(shape,{depth:0.025,bevelEnabled:true,bevelSegments:1,bevelSize:0.012,bevelThickness:0.008,steps:1,curveSegments:16}),padMaterial,x,0.04+i*0.012,z);
    pad.rotation.set(-Math.PI/2,0,a);g.add(pad);
    for(let j=0;j<7;j++) {
      const b=a+0.38+j*(TAU-0.76)/6;
      stem(g,[[x,0.08+i*0.012,z],[x+Math.cos(b)*radius*0.48,0.085+i*0.012,z+Math.sin(b)*radius*0.48],[x+Math.cos(b)*radius*0.91,0.08+i*0.012,z+Math.sin(b)*radius*0.91]],0.008,0.003,stemMaterial,4);
    }
  }
  g.add(mesh(new THREE.SphereGeometry(0.09,8,6),stemMaterial,0,0.09,0));
  const flower=new THREE.Group();flower.position.set(0,0.13,0);g.add(flower);
  for(let layer=0;layer<3;layer++)for(let i=0;i<9-layer*2;i++) {
    leaf(flower,0.62-layer*0.1,0.16-layer*0.025,[0,0,0],[0,i*TAU/(9-layer*2)+layer*0.4,0.32+layer*0.34],layer===0?0xe77c9d:0xf0a1be,0.13,9);
  }
  const gold=M(0xf0c34d,{roughness:0.85,flatShading:false});
  flower.add(mesh(new THREE.SphereGeometry(0.095,10,7),gold,0,0.2,0));
  for(let i=0;i<12;i++) {const a=i*TAU/12;stem(flower,[[Math.cos(a)*0.075,0.17,Math.sin(a)*0.075],[Math.cos(a)*0.1,0.3,Math.sin(a)*0.1]],0.012,0.005,gold,3);}
  return finish(g,'waterLily');
}

export function hibiscus({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),gold=M(0xf3c443,{roughness:0.85,flatShading:false});
  stem(g,[[0,0,0],[0.06,0.6,0],[0,1.55,0]],0.09,0.025,bark);
  for(let i=0;i<10;i++) {
    const a=i*2.4,reach=0.6+r()*0.45,y=0.9+r()*1.1,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[0,0.35,0],[x*0.4,y*0.8,z*0.4],[x,y,z]],0.035,0.012,bark);
    for(let j=0;j<10;j++) {
      const t=0.28+j*0.07,pos=[x*t,y*(0.35+t*0.65),z*t];
      leaf(g,0.5+r()*0.18,0.23,pos,[0,-a+(j%2?1.5:-1.5),0.08+(j%3)*0.14],i%2?0x2c6b39:0x43813b,0.09,7);
    }
    if(i>=7)continue;
    const flower=new THREE.Group();flower.position.set(x,y,z);
    flower.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0.45,Math.sin(a)).normalize());g.add(flower);
    for(let j=0;j<5;j++)leaf(flower,0.4,0.22,[0,0,0],[0,j*TAU/5,0.12],i%2?0xe85c55:0xd94345,0.11,10);
    stem(flower,[[0,0,0],[0.03,0.21,0],[0.08,0.38,0]],0.021,0.012,gold,6);
    for(let j=0;j<7;j++) {
      const b=j*TAU/7;flower.add(mesh(new THREE.SphereGeometry(0.026,6,4),gold,0.07+Math.cos(b)*0.04,0.32+j%2*0.04,Math.sin(b)*0.04));
    }
  }
  return finish(g,'hibiscus');
}

export function reeds({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),brown=M(0x775136,{roughness:1,flatShading:false});
  for(let i=0;i<13;i++) {
    const a=i*2.4,spread=0.15+r()*0.5,x=Math.cos(a)*spread,z=Math.sin(a)*spread,h=1.45+r()*1.15,dx=(r()-0.5)*0.3,dz=(r()-0.5)*0.3;
    stem(g,[[x,0,z],[x+dx*0.35,h*0.55,z+dz*0.35],[x+dx,h,z+dz]],0.025,0.012,stemMaterial,8);
    if(i%3!==0) {
      const head=mesh(new THREE.CapsuleGeometry(0.073,0.32+r()*0.17,4,8),brown,x+dx,h-0.2,z+dz);g.add(head);
      stem(g,[[x+dx,h,z+dz],[x+dx,h+0.14,z+dz]],0.009,0.003,brown,3);
    }
    for(let j=0;j<3;j++) {
      const blade=leaf(g,0.9+r()*0.55,0.055,[x,0.04+j*0.13,z],[0,a+j*2,0.6+r()*0.5],i%2?0x6d974d:0x8aa555,0.23,10);
      // Narrow blades stay attached at the clump, then arch away from each culm.
      blade.rotation.x=(r()-0.5)*0.2;
    }
  }
  return finish(g,'reeds');
}

// Emergent rainforest giant: plank buttresses, a tall fluted bole, tiered
// umbrella crown, hanging lianas and red bromeliads perched on the limbs.
export function jungleGiant({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=11.5+r()*1.5;
  const trunk=new THREE.CylinderGeometry(1,1,1,22,16),p=trunk.attributes.position,colors=[];
  const low=new THREE.Color(0x66563b),high=new THREE.Color(0xa69771);
  for(let i=0;i<p.count;i++) {
    const t=p.getY(i)+0.5,x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x);
    const ridge=Math.pow(Math.max(0,Math.cos(a*6+seed)),3);
    const radius=0.92-t*0.42+Math.pow(1-t,5)*(0.45+ridge*0.55)+ridge*0.05;
    p.setXYZ(i,x*radius+Math.sin(t*Math.PI*0.8)*0.3,t*h,z*radius);
    const c=low.clone().lerp(high,THREE.MathUtils.clamp(0.3+t*0.45+ridge*0.12+Math.sin(t*40+a*3)*0.04,0,1));colors.push(c.r,c.g,c.b);
  }
  trunk.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));trunk.computeVertexNormals();
  g.add(mesh(trunk,M(0xffffff,{vertexColors:true,flatShading:false,roughness:1})));
  // Thin plank buttresses fan out from the base like the walls of a room.
  const fin=M(0x7a6646,{flatShading:false,roughness:1});
  for(let i=0;i<6;i++) {
    const a=i*TAU/6+r()*0.4,reach=2.4+r()*1.1,rise=2.6+r()*1.2,shape=new THREE.Shape();
    shape.moveTo(0.45,0);shape.lineTo(reach,0);shape.quadraticCurveTo(1.1,0.35,0.55,rise);shape.lineTo(0.35,rise);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:0.22,bevelEnabled:true,bevelSize:0.04,bevelThickness:0.04,bevelSegments:1,curveSegments:8});geo.translate(0,0,-0.11);
    const m=mesh(geo,fin);m.rotation.y=-a;g.add(m);
  }
  const tints=[0x4f8d3e,0x5f9a45,0x3f7d3a],vine=M(0x5d6b3a,{flatShading:false,roughness:1});
  for(let i=0;i<5;i++) {
    const a=i*TAU/5+r()*0.5,reach=3.4+r()*1.4,y=h+1.2+r()*1.6,x=Math.cos(a)*reach,z=Math.sin(a)*reach,tint=tints[i%3];
    stem(g,[[0.25,h*0.82,0],[x*0.45,h+0.4,z*0.45],[x,y,z]],0.42,0.12,fin,10);
    cushion(g,[x,y+0.55,z],[2.35+r()*0.5,1.25,2.2+r()*0.4],tint,seed+i);
    cushion(g,[x*1.3,y+0.1,z*1.3],[1.4,0.7,1.3],tints[(i+1)%3],seed+i+9,true);
    for(let j=0;j<7;j++) {
      const angle=j*TAU/7+a,tx=x+Math.cos(angle)*2.05,tz=z+Math.sin(angle)*1.95,ty=y+0.3+r()*0.65;
      cushion(g,[tx,ty,tz],[0.65+r()*0.2,0.48+r()*0.15,0.6+r()*0.2],tints[(i+j)%3],seed+i*7+j,true);
      for(let k=0;k<3;k++)leaf(g,0.48,0.16,[tx,ty+0.3,tz],[0.3,-angle+k*0.5,0.3],k===0?0x8bae51:tint,0.1,5);
    }
    // Lianas drop from each limb; leaves alternate along their length.
    for(let k=0;k<2;k++) {
      const sx=x*(0.55+k*0.4),sz=z*(0.55+k*0.4),len=4+r()*4.5,top=y-0.2;
      const pts=Array.from({length:6},(_,j)=>[sx+Math.sin(j*1.1+seed+k)*0.25,top-len*j/5,sz+Math.cos(j*0.9+i)*0.2]);
      stem(g,pts,0.05,0.03,vine,12);
      for(let j=1;j<6;j++)leaf(g,0.36,0.13,[pts[j][0],pts[j][1]+len*0.08,pts[j][2]],[0,j*2.1+i,-1.1],0x4f8d3e,0.05,4);
    }
    // Bromeliad rosette in the fork.
    const bx=x*0.45,by=h+0.55,bz=z*0.45;
    for(let j=0;j<7;j++)leaf(g,0.55,0.12,[bx,by,bz],[0,j*TAU/7,0.8],j%2?0xc0473a:0x6a9a3f,0.12,5);
  }
  cushion(g,[0.4,h+3.2,0],[3.4,1.5,3.2],0x5a9743,seed+40);
  for(let i=0;i<6;i++) {const a=i*TAU/6+0.5,x=Math.cos(a)*2.4,z=Math.sin(a)*2.4;cushion(g,[x,h+2.2+r()*0.8,z],[2.0,0.95,1.9],tints[i%3],seed+50+i);}
  cushion(g,[-1.2,h+2.4,1.4],[2.2,1.0,2.0],0x4f8d3e,seed+41);
  return finish(g,'jungleGiant');
}

// Large tropical bush: a dense core with broad elephant-ear leaves, a few
// variegated croton blades and red ginger flower spikes.
export function tropicalBush({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),red=M(0xd8333b,{roughness:0.8,flatShading:false});
  for(let i=0;i<3;i++) {const a=i*TAU/3+r();cushion(g,[Math.cos(a)*0.4,0.4,Math.sin(a)*0.4],[0.55,0.35,0.5],0x2e6139,seed+i);}
  for(let i=0;i<30;i++) {
    const a=i*2.4+r()*0.3,tier=i%3,reach=0.45+tier*0.25,y=0.55+tier*0.45+r()*0.2,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[x*0.3,0.2,z*0.3],[x*0.7,y*0.8,z*0.7],[x,y,z]],0.03,0.015);
    const tint=i%6===0?0xc0a648:i%2?0x286c42:0x50974b;
    const blade=leaf(g,0.85+r()*0.35,0.3+r()*0.12,[x,y,z],[0.15*Math.sin(a),-a,0.3-tier*0.32],tint,0.28,12);
    const p=blade.geometry.attributes.position,c=blade.geometry.attributes.color;
    for(let j=0;j<p.count;j++) {
      const t=Math.floor(j/3)/12,edge=j%3!==1;
      p.setY(j,p.getY(j)+(edge?Math.sin(t*Math.PI*4)*0.035:0));
      if(!edge || (i%6===0 && Math.floor(t*12)%3===0))c.setXYZ(j,0.48,0.61,0.23);
    }
    blade.geometry.computeVertexNormals();
  }
  for(let i=0;i<4;i++) {
    const a=i*TAU/4+0.6,x=Math.cos(a)*0.75,z=Math.sin(a)*0.75,top=1.6+r()*0.4;
    stem(g,[[x*0.4,0.3,z*0.4],[x*0.8,top*0.7,z*0.8],[x,top,z]],0.025,0.015);
    for(let j=0;j<6;j++) for(let k=0;k<3;k++) {
      const a=k*TAU/3+j*1.1,radius=0.1*(1-j*0.1);
      const bract=mesh(new THREE.SphereGeometry(1,8,6),red,x+Math.cos(a)*radius,top+j*0.085,z+Math.sin(a)*radius);
      bract.scale.set(0.07*(1-j*0.08),0.12,0.07);bract.rotation.z=Math.cos(a)*0.35;g.add(bract);
    }
  }
  return finish(g,'tropicalBush');
}

// 051 · Frailejón: a felted silver rosette, shaggy skirt and yellow flower sprays.
export function frailejon({seed=51,h=1.5}={}) {
  if(!Number.isFinite(h)||h<0.8||h>3.5)throw new RangeError('Frailejón height must be between 0.8 and 3.5');
  const r=rng(seed),g=new THREE.Group(),dead=M(0x8c8064,{roughness:1,flatShading:false});
  g.add(mesh(new THREE.CylinderGeometry(0.15,0.23,h,12,5),dead,0,h/2,0));
  for(let i=0;i<48;i++) {
    const a=i*2.4, y=0.48+r()*Math.max(0.05,h-0.6);
    leaf(g,0.28+r()*0.18,0.07,[Math.cos(a)*0.15,y,Math.sin(a)*0.15],[0,-a,-1.25],i%2?0x8a8067:0xa39877,0.03,5);
  }
  for(let tier=0;tier<3;tier++)for(let i=0;i<11;i++) {
    const a=i*TAU/11+tier*0.33, length=0.92-tier*0.2+r()*0.15;
    const blade=leaf(g,length,0.16-tier*0.025,[0,h-0.12+tier*0.12,0],[0,-a,-0.15+tier*0.52],i%3?0xa5b7a0:0xc1c7aa,0.18,12);
    const colors=blade.geometry.attributes.color;
    for(let j=0;j<colors.count;j++) {
      const mottling=0.94+r()*0.08;
      colors.setXYZ(j,colors.getX(j)*mottling,colors.getY(j)*mottling,colors.getZ(j)*mottling);
    }
  }
  const flower=M(0xe6ba42,{roughness:1,flatShading:false}),heart=M(0x846738,{roughness:1});
  for(let i=0;i<3;i++) {
    const a=i*TAU/3+0.5,x=Math.cos(a)*0.42,z=Math.sin(a)*0.42,y=h+0.6+r()*0.3;
    stem(g,[[0,h*0.6,0],[x*0.5,h+0.1,z*0.5],[x,y,z]],0.035,0.018,dead,10);
    for(let j=0;j<3;j++) {
      const b=j*TAU/3,fx=x+Math.cos(b)*0.16,fz=z+Math.sin(b)*0.16;
      stem(g,[[x,y-0.16,z],[fx,y+0.08,fz]],0.015,0.009,dead,3);
      g.add(mesh(new THREE.SphereGeometry(0.06,8,6),heart,fx,y+0.1,fz));
      for(let k=0;k<9;k++) {
        const angle=k*TAU/9,petal=mesh(new THREE.SphereGeometry(1,6,4),flower,fx+Math.cos(angle)*0.08,y+0.1,fz+Math.sin(angle)*0.08);
        petal.scale.set(0.075,0.018,0.033);petal.rotation.y=-angle;g.add(petal);
      }
    }
  }
  return finish(g,'frailejon');
}

// 057 · A branching mountain pine, separate from the compact existing map pine.
export function mountainPine({seed=57,h=7}={}) {
  if(!Number.isFinite(h)||h<3||h>14)throw new RangeError('Mountain pine height must be between 3 and 14');
  const r=rng(seed),g=new THREE.Group(),wood=M(0x79624b,{roughness:1,flatShading:false});
  stem(g,[[0,0,0],[-0.1,h*0.45,0.04],[0.12,h,0]],0.27,0.045,wood,16);
  const greens=[0x315b4c,0x416e57,0x527961];
  for(let tier=0;tier<7;tier++) {
    const y=h*(0.15+tier*0.115),reach=(1-tier*0.135)*h*0.32,phase=r()*TAU;
    for(let i=0;i<7;i++) {
      const a=i*TAU/7+phase,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
      stem(g,[[0,y+0.2,0],[x*0.55,y-0.04,z*0.55],[x*.88,y+0.06,z*.88]],0.065*(1-tier*.12),0.012,wood,6);
    }
    // Broad drooping boughs form a continuous crown with irregular seven-lobed
    // edges. Dark undersides keep the overlapping branch tiers readable.
    const positions=[],colors=[],indices=[],segments=28,lift=h*(.235-tier*.012);
    const profile=[[0,.14],[.09,1],[.34,.88],[.68,.48],[1,.015]];
    const base=new THREE.Color(greens[tier%3]),shadow=base.clone().multiplyScalar(.55);
    profile.forEach(([up,width],j)=>{
      for(let i=0;i<segments;i++){
        const a=i*TAU/segments+phase,lobes=.84+.16*Math.cos((a-phase)*7);
        const radius=reach*width*lobes*(1+Math.sin(a*11+seed+tier)*.035);
        const droop=(j===1||j===2)?-.14*h/7*Math.cos((a-phase)*7):0;
        positions.push(Math.cos(a)*radius,y+up*lift+droop,Math.sin(a)*radius);
        colors.push(...shadow.clone().lerp(base,j===0?.05:.48+up*.48+(Math.sin(a*5+seed)+1)*.035).toArray());
        if(j<profile.length-1){const n=j*segments+i,next=j*segments+(i+1)%segments;indices.push(n,n+segments,next,next,n+segments,next+segments);}
      }
    });
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    g.add(mesh(geo,leafMaterial));
  }
  g.add(mesh(new THREE.ConeGeometry(h*.048,h*.22,9),M(0x416e57,{roughness:1}),0.12,h*.94,0));
  return finish(g,'mountainPine');
}
