// Cheap point-cloud air life: fireflies, motes, glints, leaves and embers. One
// draw per effect, CPU positions from absolute time, origin on the ground at the
// centre of the volume. Additive kinds read best against dark scenes.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

// Soft round sprite so points read as glows rather than squares.
function softDot(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
  const x=canvas.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.4,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,32,32);
  return new THREE.CanvasTexture(canvas);
}
function cloud(name,count,{color=0xffffff,size=.15,opacity=1,additive=true,soft=true,vertexColors=false}={}){
  const positions=new Float32Array(count*3),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  let colors=null;
  if(vertexColors){colors=new Float32Array(count*3);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));}
  const map=soft?softDot():null;
  const material=new THREE.PointsMaterial({color:vertexColors?0xffffff:color,size,map,transparent:true,opacity,depthWrite:false,vertexColors,
    blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,alphaTest:additive?0:.35});
  const points=new THREE.Points(geometry,material);points.name=name;points.frustumCulled=false;points.raycast=()=>{};
  const group=new THREE.Group();group.name=name;group.add(points);
  let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;geometry.dispose();material.dispose();map?.dispose();};
  return {group,points,geometry,positions,colors,material};
}
const flag=attribute=>{attribute.needsUpdate=true;};

// Glow bugs bobbing above undergrowth. `anchors` are optional [x,y,z] hover spots
// (e.g. fern positions); otherwise they fill a disc of `radius`.
export function fireflies({count=120,radius=6,height=2.4,color=0xd8f27a,size=.22,anchors=null,seed=3}={}){
  const random=rng(seed),fx=cloud('fireflies',count,{color,size:size*1.6,opacity:.9}),base=new Float32Array(count*4);
  for(let i=0;i<count;i++){
    let x,y=0,z;
    if(anchors?.length){[x,y,z]=anchors[(random()*anchors.length)|0];x+=(random()-.5)*3;z+=(random()-.5)*3;}
    else{const a=random()*Math.PI*2,d=Math.sqrt(random())*radius;x=Math.cos(a)*d;z=Math.sin(a)*d;}
    base.set([x,y+.6+random()*(height-.6),z,random()*10],i*4);
  }
  const {positions,geometry,group}=fx;
  group.userData.tick=t=>{
    for(let i=0;i<count;i++){const b=i*4,phase=base[b+3];
      positions[i*3]=base[b]+Math.sin(t*.7+phase)*.6;positions[i*3+1]=base[b+1]+Math.sin(t*1.3+phase*2)*.35;positions[i*3+2]=base[b+2]+Math.cos(t*.6+phase)*.6;}
    flag(geometry.attributes.position);fx.points.material.opacity=.75+.15*Math.sin(t*2.1);
  };
  group.userData.tick(0);
  group.userData.previewBounds=[[-radius-1,0,-radius-1],[radius+1,height+.5,radius+1]];
  return group;
}

const MOTES={
  pollen:{color:0xfff6c8,size:.12,opacity:.85,sway:[2,.7,2],speed:[.25,.4,.2]},
  dust:{color:0xf2d9a6,size:.12,opacity:.55,sway:[1.5,.8,1.5],speed:[.2,.3,.15]},
  sparkle:{color:0xfff3b0,size:.32,opacity:1,sway:[0,.03,0],speed:[0,2,0]},
};
// Pollen and dust drift in a box; sparkles hold still and pulse in two out-of-phase
// halves like glints on an ore seam. `points` overrides the random box placement.
export function floatingMotes({count=300,width=12,height=6,depth=12,kind='pollen',color,size,points=null,seed=11}={}){
  const preset=MOTES[kind]??MOTES.pollen,random=rng(seed),n=points?.length??count;
  const fx=cloud(`motes-${kind}`,n,{color:color??preset.color,size:(size??preset.size)*1.5,opacity:preset.opacity,vertexColors:kind==='sparkle'});
  const base=new Float32Array(n*4),[sx,sy,sz]=preset.sway,[vx,vy,vz]=preset.speed,tint=new THREE.Color(color??preset.color);
  for(let i=0;i<n;i++){
    const p=points?.[i]??[(random()-.5)*width,random()*height,(random()-.5)*depth];
    base.set([p[0],p[1],p[2],random()*10],i*4);
  }
  const {positions,colors,geometry,group}=fx;
  group.userData.tick=t=>{
    for(let i=0;i<n;i++){const b=i*4,phase=base[b+3];
      positions[i*3]=base[b]+Math.sin(t*vx+phase)*sx;positions[i*3+1]=base[b+1]+Math.sin(t*vy+phase*2)*sy;positions[i*3+2]=base[b+2]+Math.cos(t*vz+phase)*sz;
      if(colors){const k=.35+.65*Math.max(0,Math.sin(t*2.3+(i%2?Math.PI:0)+phase*.2));colors[i*3]=tint.r*k;colors[i*3+1]=tint.g*k;colors[i*3+2]=tint.b*k;}}
    flag(geometry.attributes.position);if(colors)flag(geometry.attributes.color);
  };
  group.userData.tick(0);
  group.userData.previewBounds=[[-width/2-sx,0,-depth/2-sz],[width/2+sx,height+sy,depth/2+sz]];
  return group;
}

// Leaves spiralling down through a box and wrapping back to the top.
export function fallingLeaves({count=160,width=20,height=14,depth=20,colors=[0x9cc04a,0xd9a440,0xb06a32],size=.2,fall=.7,seed=13}={}){
  const random=rng(seed),fx=cloud('falling-leaves',count,{size:size*1.6,opacity:1,additive:false,soft:false,vertexColors:true}),base=new Float32Array(count*4);
  const palette=colors.map(c=>new THREE.Color(c));
  for(let i=0;i<count;i++){
    base.set([(random()-.5)*width,random()*height,(random()-.5)*depth,random()*10],i*4);
    const c=palette[(random()*palette.length)|0];fx.colors.set([c.r,c.g,c.b],i*3);
  }
  const {positions,geometry,group}=fx;
  group.userData.tick=t=>{
    for(let i=0;i<count;i++){const b=i*4,phase=base[b+3];
      positions[i*3]=base[b]+Math.sin(t*.9+phase)*1.2;positions[i*3+1]=((base[b+1]-t*fall*(.8+phase*.04))%height+height)%height;positions[i*3+2]=base[b+2]+Math.cos(t*.7+phase)*1.2;}
    flag(geometry.attributes.position);
  };
  group.userData.tick(0);
  group.userData.previewBounds=[[-width/2-1.2,0,-depth/2-1.2],[width/2+1.2,height,depth/2+1.2]];
  return group;
}

// Sparks lifting off a fire and cooling to nothing. Origin at the fire bed; the
// additive colour ramp doubles as the fade so no per-point opacity is needed.
export function emberPlume({count=90,radius=.45,rise=5,speed=1.5,color=0xffb050,size=.09,seed=5}={}){
  const random=rng(seed),fx=cloud('ember-plume',count,{size:size*2,vertexColors:true}),base=new Float32Array(count*3);
  for(let i=0;i<count;i++)base.set([(random()-.5)*radius*2,random()*rise,(random()-.5)*radius*2],i*3);
  const hot=new THREE.Color(color),{positions,colors,geometry,group}=fx;
  group.userData.tick=t=>{
    for(let i=0;i<count;i++){const b=i*3,life=(base[b+1]+t*speed)%rise,k=life/rise,spread=1+life*.4,heat=Math.pow(1-k,1.6);
      positions[b]=base[b]*spread+Math.sin(t*2+i)*.15;positions[b+1]=.4+life;positions[b+2]=base[b+2]*spread+Math.cos(t*2+i)*.15;
      colors[b]=hot.r*heat;colors[b+1]=hot.g*heat*heat;colors[b+2]=hot.b*heat*heat*heat;}
    flag(geometry.attributes.position);flag(geometry.attributes.color);
  };
  group.userData.tick(0);
  const reach=radius*(1+rise*.4)+.2;
  group.userData.previewBounds=[[-reach,0,-reach],[reach,rise+.6,reach]];
  return group;
}
