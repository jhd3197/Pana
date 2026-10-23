// Geometry and canvas materials ported from Juan's Gran Premio San Carlos.html.
// The gate vault, star walls, garitas, casemates, well and cannons are preserved.
import * as THREE from 'three';
import { rng } from '../core/primitives.js';
import { finishPrototype } from './puerto-prototype-kit.js';
export function sanCarlosFortress({scale=1,heightScale=scale,terrace=0,clearance=()=>true}={}){
const PI=Math.PI,rand=rng(2026),R=(a,b)=>a+(b-a)*rand(),pick=a=>a[Math.floor(rand()*a.length)],maxAniso=4;
const scene=new THREE.Group();
function canvasTex(w,h,draw,rep){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');draw(g,w,h);const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=maxAniso;if(rep)t.repeat.set(rep,rep);t._c=c;return t;}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function drawStone(g,w,h){
  g.fillStyle='#b0a48c';g.fillRect(0,0,w,h);
  let hs=[],tot=0;while(tot<512){const v=28+rand()*26;hs.push(v);tot+=v;}hs=hs.map(v=>v*512/tot);
  let y=0;
  for(const rh of hs){let x=-rand()*80;
    while(x<512){const sw=48+rand()*72,s=rand();
      const r=Math.round(118+s*38+R(-6,8)),gg=Math.round(104+s*30+R(-4,4)),b=Math.round(86+s*24+R(-8,4));
      for(const off of [0,512,-512]){const X=x+off,p=3;rr(g,X+p,y+p,sw-2*p,rh-2*p,8);g.fillStyle=`rgb(${r},${gg},${b})`;g.fill();
        g.fillStyle='rgba(255,248,230,.17)';g.fillRect(X+p+5,y+p+2,sw-2*p-10,3);g.fillStyle='rgba(30,20,10,.17)';g.fillRect(X+p+5,y+rh-p-5,sw-2*p-10,3);}
      x+=sw;}
    y+=rh;}
  for(let i=0;i<5000;i++){g.fillStyle=rand()<.5?'rgba(0,0,0,.07)':'rgba(255,255,255,.06)';g.fillRect(rand()*w,rand()*h,2,2);}
  for(let i=0;i<16;i++){g.fillStyle='rgba(70,100,50,.10)';g.beginPath();g.ellipse(rand()*w,rand()*h,22+rand()*30,8+rand()*12,0,0,2*PI);g.fill();}
}
const stoneTex=canvasTex(512,512,drawStone);
stoneTex.name='san-carlos-stone';
const stoneTexW=canvasTex(512,512,drawStone,1/7);
const paverTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#9a8d77';g.fillRect(0,0,w,h);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){const s=rand(),c=Math.round(178+s*26);g.fillStyle=`rgb(${c},${c-10},${c-26})`;rr(g,x*64+2,y*64+2,60,60,6);g.fill();}
  for(let i=0;i<50;i++){g.fillStyle='rgba(90,120,60,.25)';g.fillRect(rand()*w,rand()*h,3,8);}},1/8);
const brickTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#dcc6a3';g.fillRect(0,0,w,h);
  for(let row=0;row<16;row++){const off=(row%2)*16;for(let x=-32;x<w+32;x+=32){const s=rand();g.fillStyle=`rgb(${(168+s*42)|0},${(80+s*30)|0},${(54+s*20)|0})`;g.fillRect(x+off+1.5,row*16+1.5,29,13);}}},1/6);
const tileTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#c9a882';g.fillRect(0,0,w,h);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){const s=rand();g.fillStyle=`rgb(${(176+s*30)|0},${(86+s*24)|0},${(58+s*16)|0})`;g.fillRect(x*32+1.5,y*32+1.5,29,29);}},0.3);
const doorTex=canvasTex(128,256,(g,w,h)=>{g.fillStyle='#7b4529';g.fillRect(0,0,w,h);g.strokeStyle='rgba(30,15,8,.5)';g.lineWidth=3;
  for(let x=16;x<w;x+=16){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  g.fillStyle='#1b1b1d';for(let y=30;y<h;y+=46)for(let x=12;x<w;x+=26){g.beginPath();g.arc(x,y,3,0,2*PI);g.fill();}
  g.fillRect(0,40,w,6);g.fillRect(0,h-50,w,6);});
doorTex.wrapS=doorTex.wrapT=THREE.ClampToEdgeWrapping;
function textTex(w,h,draw){const t=canvasTex(w,h,draw);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t._draw=draw;return t;}
const plaqueDraw=(g,w,h)=>{g.fillStyle='#f4ecda';g.fillRect(0,0,w,h);g.strokeStyle='#1f5aa6';g.lineWidth=8;g.strokeRect(8,8,w-16,h-16);g.strokeStyle='#c49a2c';g.lineWidth=3;g.strokeRect(20,20,w-40,h-40);
  g.fillStyle='#24384d';g.textAlign='center';g.textBaseline='middle';g.font='800 50px "Alegreya SC", Georgia, serif';g.fillText('FVERTE SAN CARLOS',w/2,h/2+2,w-60);};
const plaqueTex=textTex(560,120,plaqueDraw);
const M=(o)=>new THREE.MeshStandardMaterial(Object.assign({roughness:.92},o));
const stoneMat=M({map:stoneTex,side:THREE.DoubleSide});
const stoneMatW=M({map:stoneTexW,side:THREE.DoubleSide});
const stuccoMat=M({color:0xf6f1e4});
const creamMat=M({color:0xe9dcc0,side:THREE.DoubleSide});
const trimMat=M({color:0xd5c4a0});
const paverMat=M({map:paverTex});
const brickMat=M({map:brickTex});
const tileMat=M({map:tileTex});
const darkMat=M({color:0x2a201b,roughness:1,side:THREE.DoubleSide});
const ironMat=M({color:0x26282c,roughness:.45,metalness:.55});
const woodMat=M({color:0x6e4a2c});
const ruinMat=M({color:0x8f8170,roughness:1});
const glassMat=new THREE.MeshLambertMaterial({color:0xf3d58c,emissive:0xffa940,emissiveIntensity:.5});
const lc={};const lam=c=>lc[c]||(lc[c]=new THREE.MeshLambertMaterial({color:c}));
function mesh(geo,mat,cast=true,recv=true){const m=new THREE.Mesh(geo,mat);m.castShadow=cast;m.receiveShadow=recv;return m;}

/* ================= helpers ================= */
function polyArea(p){let a=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;a+=p[i][0]*p[j][1]-p[j][0]*p[i][1];}return a/2;}
function offsetPoly(pts,d){const ccw=polyArea(pts)>0,n=pts.length,out=[];
  for(let i=0;i<n;i++){const a=pts[(i-1+n)%n],b=pts[i],c=pts[(i+1)%n];
    let e1=[b[0]-a[0],b[1]-a[1]],e2=[c[0]-b[0],c[1]-b[1]];const l1=Math.hypot(...e1),l2=Math.hypot(...e2);e1=[e1[0]/l1,e1[1]/l1];e2=[e2[0]/l2,e2[1]/l2];
    const n1=ccw?[-e1[1],e1[0]]:[e1[1],-e1[0]],n2=ccw?[-e2[1],e2[0]]:[e2[1],-e2[0]];let m=[n1[0]+n2[0],n1[1]+n2[1]];const ml=Math.hypot(...m);m=[m[0]/ml,m[1]/ml];
    const s=d/(m[0]*n1[0]+m[1]*n1[1]);out.push([b[0]+m[0]*s,b[1]+m[1]*s]);}
  return out;}
function pointInPoly(x,z,p){let ins=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],zi=p[i][1],xj=p[j][0],zj=p[j][1];if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))ins=!ins;}return ins;}
// quads between two closed polylines; parts(i) lets an edge be split (for the gate slot)
function loft(bot,top,y0,y1,uvScale=8,parts){
  const pos=[],uv=[],n=bot.length;let acc=0;
  for(let i=0;i<n;i++){const j=(i+1)%n;const len=Math.hypot(top[j][0]-top[i][0],top[j][1]-top[i][1]);
    const ranges=parts?parts(i):[[0,1]];
    for(const [u0,u1] of ranges){
      const L=(p,q,u)=>[p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u];
      const a=L(bot[i],bot[j],u0),b=L(bot[i],bot[j],u1),c=L(top[i],top[j],u1),d=L(top[i],top[j],u0);
      const U0=(acc+len*u0)/uvScale,U1=(acc+len*u1)/uvScale,V0=y0/uvScale,V1=y1/uvScale;
      pos.push(a[0],y0,a[1],b[0],y0,b[1],c[0],y1,c[1],a[0],y0,a[1],c[0],y1,c[1],d[0],y1,d[1]);
      uv.push(U0,V0,U1,V0,U1,V1,U0,V0,U1,V1,U0,V1);}
    acc+=len;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();return geo;}
function wallQuad(a,b,y0,y1,mat,uvScale=8){const len=Math.hypot(b[0]-a[0],b[1]-a[1]);const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute([a[0],y0,a[1],b[0],y0,b[1],b[0],y1,b[1],a[0],y0,a[1],b[0],y1,b[1],a[0],y1,a[1]],3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,y0/uvScale,len/uvScale,y0/uvScale,len/uvScale,y1/uvScale,0,y0/uvScale,len/uvScale,y1/uvScale,0,y1/uvScale],2));geo.computeVertexNormals();return mesh(geo,mat);}
function capMesh(outer,hole,y,mat){const s=new THREE.Shape();outer.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));
  if(hole){const h=new THREE.Path();hole.forEach(([x,z],i)=>i?h.lineTo(x,-z):h.moveTo(x,-z));s.holes.push(h);}
  const geo=new THREE.ShapeGeometry(s);geo.rotateX(-PI/2);const m=mesh(geo,mat,false,true);m.position.y=y;return m;}
function archShape(w,h){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h);s.absarc(0,h,w/2,0,PI,false);s.lineTo(-w/2,0);return s;}
// a block with an arched passage cut through it (U-shaped outline, no holes)
function archBlockShape(W,Hb,a,spring){const s=new THREE.Shape();s.moveTo(-W/2,0);s.lineTo(-a/2,0);s.lineTo(-a/2,spring);s.absarc(0,spring,a/2,PI,0,true);s.lineTo(a/2,0);s.lineTo(W/2,0);s.lineTo(W/2,Hb);s.lineTo(-W/2,Hb);s.lineTo(-W/2,0);return s;}
function archRingShape(outer,inner,spring){const s=new THREE.Shape();s.moveTo(-outer/2,0);s.lineTo(-inner/2,0);s.lineTo(-inner/2,spring);s.absarc(0,spring,inner/2,PI,0,true);s.lineTo(inner/2,0);s.lineTo(outer/2,0);s.lineTo(outer/2,spring);s.absarc(0,spring,outer/2,0,PI,false);s.lineTo(-outer/2,0);return s;}
function beam(a,b,r,mat,seg=8){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b);const m=mesh(new THREE.CylinderGeometry(r,r,A.distanceTo(B),seg),mat);m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());return m;}
function mergeGeos(list){const pos=[],nor=[];for(const g0 of list){const g=g0.index?g0.toNonIndexed():g0;pos.push(...g.attributes.position.array);nor.push(...g.attributes.normal.array);}const o=new THREE.BufferGeometry();o.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));o.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));return o;}

const fort=new THREE.Group();scene.add(fort);
const S=42+terrace,G=17,F=12,T=24,H=16,Q=24,C=S-G;
const base=[[S,S-G],[S+F,S-G],[S+T,S+T],[S-G,S+F],[S-G,S]];
const outline=[];for(let k=0;k<4;k++){const c=Math.round(Math.cos(k*PI/2)),s=Math.round(Math.sin(k*PI/2));for(const [x,z] of base)outline.push([x*c-z*s,x*s+z*c]);}
const ccw=polyArea(outline)>0;
const escarpBase=offsetPoly(outline,-3.2);
const parapetIn=offsetPoly(outline,1.8);
const innerRect=[[Q,-Q],[Q,Q],[-Q,Q],[-Q,-Q]];
const TUN_W=26,TUN_A=14,TUN_S=6.5,TUN_D=S-Q+8; // tunnel block width, arch width, arch spring
// north curtain is edge 4 -> 5 ((25,42) to (-25,42)); leave a slot for the gate
const slot=i=>i===4?[[0,(C-TUN_W/2)/(2*C)],[(C+TUN_W/2)/(2*C),1]]:[[0,1]];
fort.add(mesh(loft(escarpBase,outline,0,H,8,slot),stoneMat));
// Cut the parapet itself wherever a race approach/exit crosses it. Keeping
// a complete cap here leaves a solid stone bar across the jump even if props
// are moved away. Table/Studio versions retain their complete parapet.
const parapetSlots=outline.map((a,i)=>{
  const b=outline[(i+1)%outline.length],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])),ranges=[];
  for(let j=0;j<n;j++){
    const u=(j+.5)/n,x=a[0]+(b[0]-a[0])*u,z=a[1]+(b[1]-a[1])*u;
    if(clearance(x*scale,z*scale,(H+1.3)*heightScale,2.3*scale))ranges.push([j/n,(j+1)/n]);
  }return ranges;
});
fort.add(mesh(loft(outline,outline,H,H+2.6,8,i=>parapetSlots[i]),stoneMat));
fort.add(mesh(loft(parapetIn,parapetIn,H,H+2.6,8,i=>parapetSlots[i]),stoneMat));
for(let i=0;i<outline.length;i++)for(const [u,v]of parapetSlots[i]){
  const next=(i+1)%outline.length,lerp=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];
  fort.add(capMesh([lerp(outline[i],outline[next],u),lerp(outline[i],outline[next],v),lerp(parapetIn[i],parapetIn[next],v),lerp(parapetIn[i],parapetIn[next],u)],null,H+2.6,creamMat));
}
fort.add(capMesh(outline,innerRect,H,paverMat));
fort.add(capMesh(innerRect,null,0.03,brickMat));
// inner courtyard walls (north one split around the tunnel)
fort.add(wallQuad([Q,-Q],[Q,Q],0,H,stoneMat));fort.add(wallQuad([-Q,Q],[-Q,-Q],0,H,stoneMat));fort.add(wallQuad([-Q,-Q],[Q,-Q],0,H,stoneMat));
fort.add(wallQuad([Q,Q],[TUN_W/2,Q],0,H,stoneMat));fort.add(wallQuad([-TUN_W/2,Q],[-Q,Q],0,H,stoneMat));
// cordón moulding
{const cord=offsetPoly(outline,-0.3),cm=M({color:0xc9bba0});
  for(let i=0;i<cord.length;i++){const a=cord[i],b=cord[(i+1)%cord.length];
    if(i===4){const k1=(C-TUN_W/2-1)/(2*C),k2=(C+TUN_W/2+1)/(2*C);const p1=[a[0]+(b[0]-a[0])*k1,a[1]+(b[1]-a[1])*k1],p2=[a[0]+(b[0]-a[0])*k2,a[1]+(b[1]-a[1])*k2];
      fort.add(beam([a[0],H-0.4,a[1]],[p1[0],H-0.4,p1[1]],0.5,cm));fort.add(beam([p2[0],H-0.4,p2[1]],[b[0],H-0.4,b[1]],0.5,cm));}
    else fort.add(beam([a[0],H-0.4,a[1]],[b[0],H-0.4,b[1]],0.5,cm,10));
    const sp=mesh(new THREE.SphereGeometry(0.5,10,8),cm);sp.position.set(a[0],H-0.4,a[1]);fort.add(sp);}}

/* gate: tunnel block, stucco portal, open doors */
{
  const tb=mesh(new THREE.ExtrudeGeometry(archBlockShape(TUN_W,H-0.1,TUN_A,TUN_S),{depth:TUN_D,bevelEnabled:false}),stoneMatW);tb.position.set(0,0,Q);fort.add(tb);
  // After the X rotation, the negative-Z half forms the ceiling above the spring.
  const vault=mesh(new THREE.CylinderGeometry(TUN_A/2-0.05,TUN_A/2-0.05,TUN_D,24,1,true,PI/2,PI),M({color:0xcfc2a6,side:THREE.BackSide}),false);
  vault.rotation.x=PI/2;vault.position.set(0,TUN_S,Q+TUN_D/2);fort.add(vault);
  const pz=Q+TUN_D; // portal front starts here
  const portal=mesh(new THREE.ExtrudeGeometry(archBlockShape(34,H+3,TUN_A,TUN_S),{depth:4,bevelEnabled:false}),stuccoMat);portal.position.set(0,0,pz-1);fort.add(portal);
  const ring=mesh(new THREE.ExtrudeGeometry(archRingShape(TUN_A+4,TUN_A,TUN_S),{depth:0.6,bevelEnabled:false}),trimMat);ring.position.set(0,0,pz+3);fort.add(ring);
  const key=mesh(new THREE.BoxGeometry(1.6,2.2,0.9),trimMat);key.position.set(0,TUN_S+TUN_A/2+1.3,pz+3.2);fort.add(key);
  for(const sx of [-15.5,-10.5,10.5,15.5]){const p=mesh(new THREE.BoxGeometry(1.8,H+3,0.8),trimMat);p.position.set(sx,(H+3)/2,pz+3.3);fort.add(p);
    const cap=mesh(new THREE.BoxGeometry(2.4,0.7,1.2),trimMat);cap.position.set(sx,H+2.6,pz+3.3);fort.add(cap);}
  const corn=mesh(new THREE.BoxGeometry(36,1.1,5.6),trimMat);corn.position.set(0,H+3.5,pz+1);fort.add(corn);
  const cs=new THREE.Shape();cs.moveTo(6,0);cs.absarc(0,0,6,0,PI,false);cs.lineTo(6,0);
  const crest=mesh(new THREE.ExtrudeGeometry(cs,{depth:1.6,bevelEnabled:false}),stuccoMat);crest.position.set(0,H+4,pz+1.2);fort.add(crest);
  const crestRim=mesh(new THREE.TorusGeometry(6,0.35,6,24,PI),trimMat);crestRim.position.set(0,H+4,pz+2.85);fort.add(crestRim);
  for(const sx of [-16,16,0]){const b=mesh(new THREE.SphereGeometry(sx?0.9:1,14,10),trimMat);b.position.set(sx,sx?H+4.9:H+10.6,pz+2.4);fort.add(b);}
  const plq=mesh(new THREE.PlaneGeometry(13,2.8),new THREE.MeshLambertMaterial({map:plaqueTex}),false);plq.position.set(0,H+1.1,pz+3.05);fort.add(plq);
  // doors swung open against the tunnel walls
  for(const sx of [-1,1]){const d=mesh(new THREE.BoxGeometry(0.5,TUN_S+2.2,6.6),new THREE.MeshLambertMaterial({map:doorTex}));d.position.set(sx*(TUN_A/2-0.35),(TUN_S+2.2)/2,pz-4.4);fort.add(d);}
  const step=mesh(new THREE.BoxGeometry(TUN_A+6,0.3,6),paverMat,false,true);step.position.set(0,-0.15,pz+5);fort.add(step);
}

/* lanterns */
const lampLights=[];
function lantern(s=1){const g=new THREE.Group();
  const arm=mesh(new THREE.BoxGeometry(0.06,0.06,0.42),ironMat,false);arm.position.set(0,0.42,-0.16);g.add(arm);
  const back=mesh(new THREE.BoxGeometry(0.16,0.5,0.05),ironMat,false);back.position.set(0,0.3,-0.36);g.add(back);
  g.add(mesh(new THREE.BoxGeometry(0.3,0.42,0.3),glassMat,false));
  for(const sx of [-0.16,0.16])for(const sz of [-0.16,0.16]){const b=mesh(new THREE.BoxGeometry(0.045,0.48,0.045),ironMat,false);b.position.set(sx,0,sz);g.add(b);}
  const cap=mesh(new THREE.ConeGeometry(0.3,0.24,4),ironMat,false);cap.rotation.y=PI/4;cap.position.y=0.34;g.add(cap);
  const fin=mesh(new THREE.SphereGeometry(0.05,8,6),ironMat,false);fin.position.y=0.5;g.add(fin);
  const bot=mesh(new THREE.BoxGeometry(0.38,0.06,0.38),ironMat,false);bot.position.y=-0.23;g.add(bot);
  g.scale.setScalar(s);return g;}
for(const sx of [-12.5,12.5]){const l=lantern(3);l.position.set(sx,9.5,Q+29.9);fort.add(l);}
for(const sz of [Q+6,Q+18])for(const sx of [-1,1]){const l=lantern(2.4);l.position.set(sx*(TUN_A/2-1),5.2,sz);l.rotation.y=-sx*PI/2;fort.add(l);}
{const p=new THREE.PointLight(0xffb45a,1.1,26,2);p.position.set(0,6,Q+12);fort.add(p);lampLights.push(p);}

/* garitas */
function garita(){const g=new THREE.Group();
  const corb=mesh(new THREE.ConeGeometry(1.0,1.8,20),stuccoMat);corb.rotation.x=PI;corb.position.y=-0.9;g.add(corb);
  for(const [y,r] of [[-0.35,0.9],[-0.8,0.68]]){const ring=mesh(new THREE.TorusGeometry(r,0.07,6,24),trimMat);ring.rotation.x=PI/2;ring.position.y=y;g.add(ring);}
  const b0=mesh(new THREE.CylinderGeometry(1.0,1.0,0.25,24),trimMat);b0.position.y=0.12;g.add(b0);
  const body=mesh(new THREE.CylinderGeometry(0.76,0.8,2.1,24),stuccoMat);body.position.y=1.3;g.add(body);
  const b1=mesh(new THREE.CylinderGeometry(0.9,0.9,0.2,24),trimMat);b1.position.y=2.45;g.add(b1);
  const dome=mesh(new THREE.SphereGeometry(0.84,24,12,0,2*PI,0,PI/2),stuccoMat);dome.position.y=2.55;g.add(dome);
  const neck=mesh(new THREE.CylinderGeometry(0.08,0.12,0.22,10),trimMat);neck.position.y=3.45;g.add(neck);
  const knob=mesh(new THREE.SphereGeometry(0.15,12,10),stuccoMat);knob.position.y=3.62;g.add(knob);
  for(const a of [-0.9,0,0.9]){const sl=mesh(new THREE.BoxGeometry(0.11,0.6,0.14),darkMat,false);sl.position.set(Math.sin(a)*0.75,1.55,Math.cos(a)*0.75);sl.rotation.y=a;g.add(sl);}
  const door=mesh(new THREE.ShapeGeometry(archShape(0.6,1.05)),darkMat,false);door.position.set(0,0.25,-0.81);door.rotation.y=PI;g.add(door);
  g.scale.setScalar(3.4);return g;}
for(const k of [0,2,3]){const tip=outline[k*5+2],d=new THREE.Vector2(tip[0],tip[1]).normalize();
  const g=garita();g.position.set(tip[0]-d.x*1.7,H+2.4,tip[1]-d.y*1.7);g.rotation.y=Math.atan2(d.x,d.y);fort.add(g);}

/* courtyard: casemate arches, ruins, well, plants */
function archDoor(w,h){const g=new THREE.Group();
  g.add(mesh(new THREE.ExtrudeGeometry(archShape(w+1.2,h),{depth:0.2,bevelEnabled:false}),creamMat,false));
  const op=mesh(new THREE.ShapeGeometry(archShape(w,h)),darkMat,false);op.position.z=0.21;g.add(op);return g;}
for(const [x,z,ry] of [[Q,-10,-PI/2],[Q,2,-PI/2],[Q,14,-PI/2],[-Q,4,PI/2],[-Q,16,PI/2],[18.5,Q,PI],[-18.5,Q,PI]]){
  const a=archDoor(3.2,3.6);a.position.set(x-Math.sin(ry)*0.02,0,z-Math.cos(ry)*0.02);a.rotation.y=ry;fort.add(a);}
function wallSeg(x1,z1,x2,z2,h,th=0.9){const len=Math.hypot(x2-x1,z2-z1),ang=-Math.atan2(z2-z1,x2-x1);
  const w=mesh(new THREE.BoxGeometry(len+th,h,th),ruinMat);w.position.set((x1+x2)/2,h/2,(z1+z2)/2);w.rotation.y=ang;fort.add(w);
  const c=mesh(new THREE.BoxGeometry(len+th+0.1,0.22,th+0.16),creamMat);c.position.set((x1+x2)/2,h+0.11,(z1+z2)/2);c.rotation.y=ang;fort.add(c);}
// ruined rooms west of the racing line
wallSeg(-22,-6,-12,-6,3.2);wallSeg(-22,-6,-22,12,2.6);wallSeg(-12,-6,-12,1,3.0);wallSeg(-12,5,-12,12,2.2);
wallSeg(-22,12,-19,12,2.8);wallSeg(-15,12,-12,12,2.4);wallSeg(-22,3,-15.5,3,2.0);
for(const [cx,cz,w,d] of [[-17,-1.5,9,8.5],[-17,7.5,9,8.5]]){const f=mesh(new THREE.PlaneGeometry(w,d),tileMat,false,true);f.rotation.x=-PI/2;f.position.set(cx,0.08,cz);fort.add(f);}
{const w=new THREE.Group();
  const ring=mesh(new THREE.CylinderGeometry(1.8,1.9,1.5,22,1,true),ruinMat);ring.position.y=0.75;w.add(ring);
  const lip=mesh(new THREE.TorusGeometry(1.82,0.2,6,22),creamMat);lip.rotation.x=PI/2;lip.position.y=1.5;w.add(lip);
  const water=mesh(new THREE.CircleGeometry(1.7,22),darkMat,false);water.rotation.x=-PI/2;water.position.y=1.0;w.add(water);
  for(const sx of [-1.7,1.7]){const p=mesh(new THREE.BoxGeometry(0.25,3.4,0.25),woodMat);p.position.set(sx,2.4,0);w.add(p);}
  const bar=mesh(new THREE.CylinderGeometry(0.12,0.12,3.8,8),woodMat);bar.rotation.z=PI/2;bar.position.y=3.9;w.add(bar);
  const bucket=mesh(new THREE.CylinderGeometry(0.34,0.28,0.5,10),woodMat);bucket.position.y=2.6;w.add(bucket);
  w.position.set(-17,0,19);fort.add(w);}
function plant(scale=1){const g=new THREE.Group();
  const pot=mesh(new THREE.CylinderGeometry(0.24,0.17,0.38,12),lam('#c4683f'));pot.position.y=0.19;g.add(pot);
  const rim=mesh(new THREE.CylinderGeometry(0.27,0.27,0.07,12),lam('#d27a4f'));rim.position.y=0.38;g.add(rim);
  for(let i=0;i<7;i++){const l=mesh(new THREE.ConeGeometry(0.07,0.75,4),lam(i%2?'#3f9a4a':'#5bb256'));const a=i/7*2*PI;l.position.set(Math.cos(a)*0.08,0.68,Math.sin(a)*0.08);l.rotation.set(Math.sin(a)*0.6,0,-Math.cos(a)*0.6);g.add(l);}
  g.scale.setScalar(scale);return g;}
for(const [x,z] of [[-10.5,Q+31],[10.5,Q+31],[-21,-20],[21,20],[-9,14],[21,-21]]){const p=plant(2.6);p.position.set(x,0,z);fort.add(p);}

/* cannons and shot */
function cannon(){const g=new THREE.Group();
  const plat=mesh(new THREE.BoxGeometry(1.7,0.5,2.3),paverMat);plat.position.y=0.25;g.add(plat);
  const car=mesh(new THREE.BoxGeometry(0.62,0.42,1.3),woodMat);car.position.set(0,0.98,-0.05);g.add(car);
  for(const sx of [-0.42,0.42])for(const sz of [-0.42,0.38]){const w=mesh(new THREE.CylinderGeometry(0.28,0.28,0.12,14),woodMat);w.rotation.z=PI/2;w.position.set(sx,0.78,sz);g.add(w);}
  const barrel=mesh(new THREE.CylinderGeometry(0.11,0.18,1.9,14),ironMat);barrel.rotation.x=PI/2;barrel.position.set(0,1.42,0.45);g.add(barrel);
  const ring=mesh(new THREE.TorusGeometry(0.13,0.04,6,14),ironMat);ring.position.set(0,1.42,1.36);g.add(ring);
  const casc=mesh(new THREE.SphereGeometry(0.13,10,8),ironMat);casc.position.set(0,1.42,-0.55);g.add(casc);
  g.scale.setScalar(2.6);return g;}
function ballStack(x,y,z){const g=new THREE.Group(),r=0.42;
  for(let l=0;l<3;l++){const n=3-l;for(let i=0;i<n;i++)for(let j=0;j<n;j++){const b=mesh(new THREE.SphereGeometry(r,10,8),ironMat);b.position.set((i-(n-1)/2)*2*r,r+l*r*1.42,(j-(n-1)/2)*2*r);g.add(b);}}
  g.position.set(x,y,z);fort.add(g);}

// cannons on the bastions, kept clear of the racing line
const trackClear=(x,y,z,r)=>clearance(x*scale,z*scale,y*heightScale,r*scale);
for(let k=0;k<4;k++){const i=k*5;
  for(const [a,b] of [[outline[i+1],outline[i+2]],[outline[i+2],outline[i+3]],[outline[i+4],outline[(i+5)%20]]]){
    const e=[b[0]-a[0],b[1]-a[1]],l=Math.hypot(...e),u=[e[0]/l,e[1]/l],nIn=ccw?[-u[1],u[0]]:[u[1],-u[0]];
    for(const f of [0.3,0.62]){const x=a[0]+e[0]*f+nIn[0]*5,z=a[1]+e[1]*f+nIn[1]*5;
      if(!trackClear(x,H,z,9.5))continue;const c=cannon();c.position.set(x,H,z);c.rotation.y=Math.atan2(-nIn[0],-nIn[1]);fort.add(c);}}}
for(const [x,z] of [[-50,-44],[44,-50],[56,44]]){if(trackClear(x,H,z,8))ballStack(x,H,z);}


fort.scale.set(scale,heightScale,scale);
const out=finishPrototype(scene,'san-carlos-fortress');out.userData.foundationDepth=0.45;out.userData.source='Gran Premio San Carlos.html';return out;
}
