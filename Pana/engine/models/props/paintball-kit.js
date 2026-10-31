import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bake } from '/engine/models/core/static-batch.js';
import { PAINT_WEAPONS, PAINT_MELEE, PAINT_CLASSES, PAINT_MOUNTS, PAINT_OPTICS, PAINT_KIT_BORE, classOf } from '../../play/paint-arsenal.js';
// Toy paintball markers, eighteen silhouettes you can tell apart in one glance:
// La Chispa a slim pistol with its air tank under the barrel, El Trueno a double-barrelled
// pump with a stick feed, Las Gemelas two drum-fed twins, El Cohetón a fat shoulder tube
// with a nose cone, La Lejana a long scoped rifle with a side feed, La Bazuca a slim
// launcher with its warhead showing, La Metra a stubby machine marker with a side stick,
// La Licuadora six spinning barrels fed by a hose of paintballs, La China a wrist-braced
// slingshot, El Tambor a six-shot revolving grenade launcher, La Corneta a brass
// trumpet-mouthed scattergun, La Fumigadora a pump sprayer with a long wand, El Llanero
// a long-barrelled six-shooter, La Pulga a tiny thumbhole PDW, La Parrandera a mil-sim
// carbine, El Tuqueque a bullpup, El Zamuro a marksman rifle on its bipod and La
// Culebrona a belt-fed machine marker. Attachments ('barrel', 'hopper', 'stock',
// 'optic') sit on each marker's own mounts (PAINT_MOUNTS); `userData.optic` is the
// kind of Mira fitted (PAINT_OPTICS), `userData.bore` the barrel axis height.
// `userData.sightX` is the sight line's sideways offset (side-mounted Miras).
// `userData.spin` (Licuadora, Tambor) is a group to turn around Z when firing.
// Origin at the grip, +Z down the barrel. `userData.tip` is the muzzle's z,
// `userData.sight` the height of the sight line. Every mesh carries a readable `name`.
// Bodies, frames and stocks are side profiles extruded across X, barrels and tubes are
// lathed along Z, and small repeated details (ports, rail teeth, paintballs) are merged
// into one mesh each, so a marker stays a few dozen draw calls.

// The shared kit of parts: every geometry and material is disposed with the model.
function parts(root) {
 const geometries=new Set(), materials=new Set(), ctx={parent:root,label:'Pieza'};
 const mat=(c,o={})=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:.42,...o});materials.add(m);return m;};
 // Geometry is re-centred on its own bounds so each piece rotates, scales and
 // separates around itself in the studio. Bake offsets into the geometry, never
 // rotate a mesh whose geometry was not built around the origin.
 const put=(geo,m,x=0,y=0,z=0)=>{
  geo.computeBoundingBox();const c=geo.boundingBox.getCenter(new THREE.Vector3());
  if(c.lengthSq()>1e-10)geo.translate(-c.x,-c.y,-c.z);
  geometries.add(geo);const o=new THREE.Mesh(geo,m);o.position.set(x+c.x,y+c.y,z+c.z);o.name=ctx.label;ctx.parent.add(o);return o;
 };
 const label=n=>{ctx.label=n;};
 const within=(g,fn)=>{const p=ctx.parent,l=ctx.label;ctx.parent=g;fn();ctx.parent=p;ctx.label=l;return g;};
 const holder=(x=0,y=0,z=0,name='')=>{const g=new THREE.Group();g.position.set(x,y,z);g.name=name;ctx.parent.add(g);return g;};
 const box=(w,h,d,m,x,y,z,r=.02)=>put(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/2,h/2,d/2)),m,x,y,z);
 // Cylinders lie along Z: `front` radius first, then `rear`.
 const tube=(front,rear,len,m,x,y,z,sides=20)=>{const g=new THREE.CylinderGeometry(front,rear,len,sides);g.rotateX(Math.PI/2);return put(g,m,x,y,z);};
 const post=(top,bottom,len,m,x,y,z,sides=18)=>put(new THREE.CylinderGeometry(top,bottom,len,sides),m,x,y,z);
 const blob=(r,m,x,y,z,sx=1,sy=1,sz=1,seg=18)=>{const g=new THREE.SphereGeometry(r,seg,Math.round(seg*.7));g.scale(sx,sy,sz);return put(g,m,x,y,z);};
 // A side profile [[z,y,cornerRadius?],…] traced into a 2D path with rounded corners.
 const trace=(pts,path)=>{const n=pts.length;for(let i=0;i<n;i++){const [x,y,r=0]=pts[i];
  if(!r){i?path.lineTo(x,y):path.moveTo(x,y);continue;}
  const [px,py]=pts[(i+n-1)%n],[nx,ny]=pts[(i+1)%n],d1=Math.hypot(px-x,py-y),d2=Math.hypot(nx-x,ny-y),k=Math.min(r,d1/2,d2/2);
  const ax=x+(px-x)/d1*k,ay=y+(py-y)/d1*k,bx=x+(nx-x)/d2*k,by=y+(ny-y)/d2*k;
  i?path.lineTo(ax,ay):path.moveTo(ax,ay);path.quadraticCurveTo(x,y,bx,by);}
  path.closePath();return path;};
 // Extrudes a side profile across X, `w` wide, centred on `x`, with softened edges.
 const slab=(pts,w,m,{x=0,holes=[],bevel=.01}={})=>{const s=trace(pts,new THREE.Shape());for(const h of holes)s.holes.push(trace(h,new THREE.Path()));
  const b=Math.min(bevel,w/3),geo=new THREE.ExtrudeGeometry(s,{depth:w-2*b,bevelEnabled:b>0,bevelThickness:b,bevelSize:b*.8,bevelSegments:2,curveSegments:6});
  geo.translate(0,0,-(w-2*b)/2);geo.rotateY(-Math.PI/2);geo.translate(x,0,0);return put(geo,m);};
 // A lathe along Z from [[radius,z],…]. Walk outer surfaces towards +Z so they face out.
 const turn=(profile,m,x=0,y=0,sides=28)=>{const g=new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(Math.max(r,1e-4),z)),sides);g.rotateX(Math.PI/2);g.translate(x,y,0);return put(g,m);};
 // The same lathe standing up along Y, for handles and heads: [[radius,y],...].
 const turnY=(profile,m,x=0,z=0,sides=28)=>{const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(Math.max(r,1e-4),y)),sides);g.translate(x,0,z);return put(g,m);};
 const capsule=(r,z0,z1,n=6)=>{const p=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI/2;p.push([r*Math.sin(a),z0+r*(1-Math.cos(a))]);}for(let i=0;i<=n;i++){const a=i/n*Math.PI/2;p.push([r*Math.cos(a),z1-r+r*Math.sin(a)]);}return p;};
 const hose=(pts,r,m)=>put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),40,r,8),m);
 // Loose geometry for merging into one mesh with `many`.
 const gbox=(w,h,d,x,y,z,rx=0,ry=0,rz=0)=>{const g=new THREE.BoxGeometry(w,h,d);g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);return g;};
 const gcyl=(r,h,x,y,z,axis='y',s=12)=>{const g=new THREE.CylinderGeometry(r,r,h,s);if(axis==='z')g.rotateX(Math.PI/2);if(axis==='x')g.rotateZ(Math.PI/2);g.translate(x,y,z);return g;};
 const gball=(r,x,y,z,sx=1,s=10)=>{const g=new THREE.SphereGeometry(r,s,Math.round(s*.75));g.scale(sx,1,1);g.translate(x,y,z);return g;};
 const many=(geos,m)=>{if(!geos.length)return null;const g=mergeGeometries(geos);geos.forEach(x=>x.dispose());return put(g,m);};
 let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
 return {mat,put,label,within,holder,box,tube,post,blob,slab,turn,turnY,capsule,hose,gbox,gcyl,gball,many,dispose};
}

// The trigger frame every marker shares, grip centred on the origin.
const FRAME=[[-.095,.075],[.235,.075],[.235,-.025,.04],[.19,-.105,.05],[.055,-.105,.01],[.005,-.335,.035],[-.125,-.335,.035],[-.12,-.06,.04],[-.095,.075]].slice(0,-1);
const GUARD=[[.065,.045],[.19,.045,.02],[.19,-.035,.035],[.155,-.075,.025],[.075,-.075,.02],[.06,-.02]];
const PANEL=[[.045,-.09],[.0,-.315,.02],[-.11,-.315,.02],[-.108,-.07,.03],[-.06,-.04,.02],[.03,-.04]];
const TRIGGER=[[.1,.05],[.13,.05],[.138,.0,.02],[.125,-.055,.012],[.108,-.055],[.115,.0,.02]];

// --- Camuflaje ---
// Camo is drawn in the shader from each point's position on the weapon (baked into a `camoPos`
// attribute at build time), so it wraps every part without UV seams and moves with the part.
// Four colours: the base, then three accents. Patterns: woodland blobs, digital pixels,
// tiger stripes along the barrel, and paint splats.
export const CAMO_PATTERNS={woodland:'Selva',digital:'Pixelado',tiger:'Rayas',splash:'Salpicado'};
export const PAINT_CAMOS={
 selva:{name:'Selva',pattern:'woodland',scale:1,colors:['#4b5b2c','#2f3a1e','#7a6a3a','#1b1f14']},
 medanos:{name:'Médanos de Coro',pattern:'digital',scale:1,colors:['#d8c49a','#b89a68','#8a6e48','#efe3c4']},
 bolivar:{name:'Pico Bolívar',pattern:'digital',scale:1,colors:['#eef2f3','#b9c4c9','#7f8d94','#4c5a61']},
 caracas:{name:'Concreto caraqueño',pattern:'digital',scale:1.2,colors:['#8d9293','#5f6566','#b9bdbd','#2f3436']},
 caribe:{name:'Caribe',pattern:'woodland',scale:1.1,colors:['#18b3b0','#0c6f8a','#f2e2b0','#ff6f61']},
 jaguar:{name:'Jaguar',pattern:'tiger',scale:1,colors:['#f28b42','#d9732c','#2a1d14','#120c08']},
 llanero:{name:'Atardecer llanero',pattern:'tiger',scale:.9,colors:['#ff7a2f','#ffb347','#c2185b','#3b1f4a']},
 rumba:{name:'Rumba neón',pattern:'digital',scale:.9,colors:['#1a1030','#ff2fd1','#26f0ff','#b7ff2a']},
 tricolor:{name:'Tricolor',pattern:'splash',scale:1,colors:['#ffcc00','#00247d','#cf142b','#ffffff']},
 pepazo:{name:'Pepazo',pattern:'splash',scale:1,colors:['#f8e9c9','#ff4b4b','#ffc629','#3fa7c4']}};
const CAMO_GLSL=`
uniform vec3 uC0,uC1,uC2,uC3;uniform float uScale;uniform int uPattern;varying vec3 vCamo;
float cHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float cNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(cHash(i),cHash(i+vec3(1,0,0)),f.x),mix(cHash(i+vec3(0,1,0)),cHash(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(cHash(i+vec3(0,0,1)),cHash(i+vec3(1,0,1)),f.x),mix(cHash(i+vec3(0,1,1)),cHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float cFbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*cNoise(p);p=p*2.03+17.1;a*=.5;}return s;}
vec3 camoColor(vec3 p){
 p*=uScale;
 if(uPattern==1){vec3 q=floor(p*26.)/26.;float n=cFbm(q*4.5),m=cFbm(q*4.5+40.);return n<.43?uC0:(n<.53?uC1:(m<.5?uC2:uC3));}
 if(uPattern==2){float w=cFbm(p*3.)*1.7,s=sin(p.z*14.+p.y*6.+p.x*4.+w*6.),t=cFbm(p*6.+9.);return s>.6?uC3:(s>.3?uC2:(t<.5?uC0:uC1));}
 if(uPattern==3){vec3 c=p*8.5,i=floor(c);float best=9.,id=0.;
  for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){vec3 g=i+vec3(x,y,z),o=vec3(cHash(g),cHash(g+7.),cHash(g+13.));
   float d=length(c-g-o)+(cFbm(c*2.3+g)-.5)*.7;if(d<best){best=d;id=cHash(g+3.);}}
  if(best<.34)return id<.33?uC1:(id<.66?uC2:uC3);return uC0;}
 float a=cFbm(p*6.),b=cFbm(p*6.+23.);return a<.42?uC0:(a<.55?uC1:(b<.48?uC2:uC3));
}`;
// Every camo material compiles the same shader (pattern and colours are uniforms), so
// they share one program under this fixed key; Three.js still runs onBeforeCompile
// once per material, which is where each one gets its own uniforms.
const camoKey=()=>'pana-camo';
function camoCompile(shader){
 const c=this.userData.camo;
 Object.assign(shader.uniforms,{uC0:{value:new THREE.Color(c.colors[0])},uC1:{value:new THREE.Color(c.colors[1])},uC2:{value:new THREE.Color(c.colors[2])},uC3:{value:new THREE.Color(c.colors[3])},
  uScale:{value:c.scale||1},uPattern:{value:Math.max(0,Object.keys(CAMO_PATTERNS).indexOf(c.pattern))}});
 shader.vertexShader='attribute vec3 camoPos;\nvarying vec3 vCamo;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vCamo=camoPos;');
 shader.fragmentShader=CAMO_GLSL+'\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb=camoColor(vCamo);');
}
// Turns camo on for a material. Call it again after cloning one (clones drop shader hooks;
// the settings ride along in `userData.camo`).
export function applyCamo(material,camo=material.userData.camo){
 if(!camo)return material;
 material.userData.camo={colors:[...camo.colors],pattern:camo.pattern,scale:camo.scale||1};
 material.onBeforeCompile=camoCompile;material.customProgramCacheKey=camoKey;material.needsUpdate=true;return material;
}
// `camo` is a preset id ('selva') or nothing; there are no free colours. Without it
// the marker is built exactly as before (no shader hook, no extra attribute).
export const resolveCamo=camo=>typeof camo==='string'&&Object.hasOwn(PAINT_CAMOS,camo)?PAINT_CAMOS[camo]:null;
// Stores each painted vertex's position on the weapon, so the camo is fixed to the marker.
function bakeCamo(root,material){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),v=new THREE.Vector3(),m=new THREE.Matrix4();
 root.traverse(o=>{if(!o.isMesh||o.material!==material)return;m.multiplyMatrices(inv,o.matrixWorld);
  const pos=o.geometry.attributes.position,out=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);out[i*3]=v.x;out[i*3+1]=v.y;out[i*3+2]=v.z;}
  o.geometry.setAttribute('camoPos',new THREE.BufferAttribute(out,3));});
}

// Names, classes, mounts and optic kinds are plain data in engine/play/paint-arsenal.js, so
// game rules can read them without Three.js.
export { PAINT_WEAPONS, PAINT_MELEE, PAINT_CLASSES, PAINT_MOUNTS, PAINT_OPTICS, PAINT_KIT_BORE, classOf };
export function createPaintKit({color='#f28b42',weapon='pistol',attachments=[],charm='none',pattern='splat',camo=null}={}) {
 // An unknown id draws La Chispa rather than failing a whole scene.
 if(!Object.hasOwn(PAINT_WEAPONS,weapon)&&!Object.hasOwn(PAINT_MELEE,weapon))weapon='pistol';
 if(!Array.isArray(attachments))attachments=[];
 const group=new THREE.Group(),K=parts(group);
 const {mat,put,label,within,holder,box,tube,post,blob,slab,turn,turnY,capsule,hose,gbox,gcyl,gball,many,dispose}=K;
 const has=id=>attachments.includes(id);
 const paint=mat(color,{metalness:.25,roughness:.36}),dark=mat('#2f3d3c',{roughness:.55}),rubber=mat('#1e2524',{roughness:.92}),
  cream=mat('#f8e9c9',{roughness:.5}),steel=mat('#b3c3c3',{metalness:.75,roughness:.28}),ink=mat('#16161a',{roughness:.6}),
  coral=mat('#ff4b4b',{roughness:.4}),wood=mat('#8b5e3c',{roughness:.68}),woodDark=mat('#6b452b',{roughness:.7}),
  line=mat('#3fa7c4',{roughness:.6}),brass=mat('#d9a441',{metalness:.7,roughness:.3}),glass=mat('#9eeaff',{emissive:'#1b6f8a',emissiveIntensity:.4,roughness:.05,transparent:true,opacity:.45,depthWrite:false}),leather=mat('#4a3626',{roughness:.85}),ball=mat('#ffc629',{roughness:.3}),
  smoke=mat('#cfe6ea',{roughness:.05,metalness:.2,transparent:true,opacity:.42,depthWrite:false});
 const lens=()=>mat('#5fd8ff',{emissive:'#1b6f8a',roughness:.1,metalness:.3});
 const range=(a,b,step)=>{const r=[];for(let v=a;v<=b+1e-6;v+=step)r.push(v);return r;};
 // Dimple rows on a barrel: dark dots set into the surface at angles from the top.
 const ports=(x,y,z0,z1,r,step,angles,size=.009)=>range(z0,z1,step).flatMap(z=>angles.map(a=>{const g=new THREE.CylinderGeometry(size,size,.012,8);g.rotateZ(-a);g.translate(x+r*Math.sin(a),y+r*Math.cos(a),z);return g;}));

 function frame(w=.12,grip=rubber) {
  label('Armazón');slab(FRAME,w,dark,{holes:[GUARD]});
  label('Empuñadura');slab(PANEL,w+.018,grip,{bevel:.012});
  many([-.13,-.175,-.22,-.265].map(y=>{const f=.045+(y+.09)*.2,b=-.108;return gbox(w+.026,.009,(f-b)*.8,0,y,(f+b)/2);}),ink);
  label('Gatillo');slab(TRIGGER,.024,steel,{bevel:.006});
  label('Tornillos');many([[.2,.035],[-.07,.035],[-.06,-.29]].map(([z,y])=>gcyl(.011,w+.03,0,y,z,'x',10)),steel);
 }
 function gauge(x,y,z,axis='x',dir=1) {
  label('Manómetro');
  const s=axis==='x'?dir:0,f=axis==='z'?dir:0;
  put(gcyl(.025,.024,x,y,z,axis,18),dark);
  put(gcyl(.02,.004,x+s*.013,y,z+f*.013,axis,18),cream);
  const n=new THREE.BoxGeometry(s?.003:.016,.003,f?.003:.016);n.rotateZ(f?.6:0);n.rotateX(s?.6:0);n.translate(x+s*.0155,y+.003,z+f*.0155);put(n,coral);
 }
 // A vertical feedneck with its clamp; returns the mount on top of it.
 function neck(h=.05) {
  label('Cuello de alimentación');
  post(.045,.05,h,dark,0,h/2,0);
  post(.057,.057,.022,steel,0,h-.014,0);
  box(.03,.016,.03,steel,.065,h-.014,0,.006);
  return holder(0,h,0);
 }
 // A big see-through loader full of paintballs, sitting on the feedneck mount.
 function loader(s=1,br=.031) {
  const g=holder(0,0,0,'loader');g.scale.setScalar(s);
  within(g,()=>{
   const rx=.16,ry=.15,rz=.25,cy=.17,cz=-.03;
   label('Tolva · base');
   const hull=new THREE.SphereGeometry(1,32,10,0,Math.PI*2,Math.PI*.6,Math.PI*.4);hull.scale(rx*1.03,ry*1.03,rz*1.03);hull.translate(0,cy,cz);put(hull,paint);
   post(.05,.056,.07,dark,0,.035,0);
   label('Tolva · bolas');
   // Launchers carry fat paint rounds: same loader, bigger balls, fewer of them.
   const step=br*2,m=br+.003,pos=[];let row=0;
   for(let y=cy-ry+m+.004;y<cy+.03;y+=br*1.74,row++)for(let x=-rx;x<=rx;x+=step)for(let z=cz-rz;z<=cz+rz;z+=step){
    const xx=x+(row%2)*br*.5,q=(xx/(rx-m))**2+((y-cy)/(ry-m))**2+((z-cz)/(rz-m))**2;if(q<1)pos.push(gball(br,xx,y,z,1,br>.04?12:8));}
   many(pos,ball);
   label('Tolva · carcasa');
   const shell=new THREE.SphereGeometry(1,32,20);shell.scale(rx,ry,rz);shell.translate(0,cy,cz);put(shell,smoke);
   label('Tolva · aro');
   const rim=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2;rim.push(new THREE.Vector3(Math.sin(a)*rx*.97,cy-ry*.3,cz+Math.cos(a)*rz*.97));}
   put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim,true),64,.011,6,true),cream);
   label('Tolva · lomo');
   const spine=[];for(let i=0;i<=24;i++){const a=-1.25+i/24*2.5;spine.push(new THREE.Vector3(0,cy+Math.cos(a)*ry*1.005,cz+Math.sin(a)*rz*1.005));}
   put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spine),48,.016,8),paint);
   label('Tolva · tapa');
   const lid=new THREE.SphereGeometry(1,24,8,0,Math.PI*2,0,Math.PI/2);lid.scale(.1,.032,.11);lid.translate(0,cy+ry*.96,cz+.07);put(lid,cream);
   post(.012,.012,.07,cream,0,cy+ry*.98,cz-.035).rotation.z=Math.PI/2;
   label('Tolva · botón');
   box(.07,.034,.02,coral,0,cy-.035,cz-rz*1.0,.008);
  });
  return g;
 }
 // A short clear tube of paintballs: the stock feed on pumps and the sniper.
 function stick(L=.32) {
  label('Alimentador');
  post(.054,.054,.03,dark,0,.015,0);
  many(range(.06,L-.04,.064).map(y=>gball(.032,0,y,0,1,8)),ball);
  post(.043,.043,L,smoke,0,L/2,0);
  post(.052,.052,.035,cream,0,L+.012,0);
  post(.018,.018,.02,coral,0,L+.038,0);
 }
  // A clear hose full of paintballs, for feeds that come from off the marker.
 function ballHose(pts,r=.045) {
  label('Alimentador · manguera de bolas');
  const curve=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),n=Math.floor(curve.getLength()/.068);
  many(curve.getSpacedPoints(n).slice(1,-1).map(p=>gball(.032,p.x,p.y,p.z,1,8)),ball);
  put(new THREE.TubeGeometry(curve,48,r,12),smoke);
  const [a]=pts,b=pts[pts.length-1];put(gcyl(r+.01,.04,...a,'x',16),dark);blob(r+.008,cream,...b);
 }
 // A box magazine with a clear window onto the paintballs (mil-sim style). `along` is
 // [z0,y0,z1,y1], the line the stacked balls follow inside the window.
 function clip(pts,win,along,n,w=.1) {
  label('Cargador');slab(pts,w,dark,{holes:[win]});
  const [z0,y0,z1,y1]=along;many(range(0,n-1,1).map(i=>{const t=n>1?i/(n-1):0;return gball(.027,0,y0+(y1-y0)*t,z0+(z1-z0)*t,1,8);}),ball);
  label('Cargador · ventana');slab(win,w-.008,smoke,{bevel:.002});
 }
 // The twins' little drum: painted base, clear window, a ring of paintballs, domed lid.
 function drum() {
  label('Tambor');
  post(.13,.12,.05,paint,0,.025,0);
  post(.133,.133,.012,cream,0,.054,0);
  const b=[];for(let i=0;i<11;i++){const a=i/11*Math.PI*2;b.push(gball(.03,Math.sin(a)*.088,.085,Math.cos(a)*.088,1,8));}for(let i=0;i<4;i++){const a=i/4*Math.PI*2+.4;b.push(gball(.03,Math.sin(a)*.032,.085,Math.cos(a)*.032,1,8));}
  many(b,ball);
  post(.125,.125,.065,smoke,0,.093,0);
  const lid=new THREE.SphereGeometry(1,28,8,0,Math.PI*2,0,Math.PI/2);lid.scale(.13,.05,.13);lid.translate(0,.125,0);put(lid,paint);
  post(.024,.024,.022,coral,0,.18,0);
 }

 // --- Attachments, each fitted to the weapon's own mounts. ---
 function tune(m) {
  // Cañón afinado: a ported extension with a coral muzzle brake, slid onto the barrel end.
  label('Accesorio · cañón afinado');
  const r=m.r,L=r>.12?.22:.3,z=m.z;
  for(const x of m.xs){
   turn([[r*.7,z-.03],[r+.012,z-.03],[r+.014,z+.05],[r*.86,z+.075],[r*.86,z+L-.08],[r*.7,z+L-.08]],m.mat||dark,x,m.y);
   turn([[r*.7,z+L-.085],[r+.018,z+L-.085],[r+.018,z+L],[r*.68,z+L],[r*.68,z+L-.03]],r>.12?m.mat||dark:coral,x,m.y);
   if(r>.12)put(gcyl(r+.022,.02,x,m.y,z+L-.05,'z',40),coral);
   many([...ports(x,m.y,z+.11,z+L-.11,r*.86,r>.12?.05:.04,[0,-.8,.8],r>.12?.016:.009),
    ...[-1,1].map(s=>gbox(.012,r*.5,.03,x+s*(r+.016),m.y,z+L-.042))],ink);
  }
  return z+L;
 }
 function skeleton(m) {
  // Culata ligera on rifles and pistols: an open skeleton stock with a cheek pad.
  label('Accesorio · culata ligera');
  const z=m.z,y=m.y,P=pts=>pts.map(([a,b,r])=>[z+a,y+b,r]);
  slab(P([[.02,.04],[-.5,.05,.02],[-.54,.085,.02],[-.57,.085,.02],[-.57,-.22,.02],[-.52,-.22,.02],[-.46,-.14,.03],[.02,-.075,.02]]),.07,dark,{holes:[P([[-.06,.0,.02],[-.44,.01,.02],[-.42,-.1,.03],[-.08,-.035,.02]])]});
  slab(P([[-.57,.095],[-.605,.095,.015],[-.605,-.235,.015],[-.57,-.235]]),.11,rubber);
  slab(P([[-.12,.04],[-.42,.045],[-.42,.085,.02],[-.12,.075,.02]]),.09,cream);
  tube(.03,.03,.24,steel,0,y-.012,z-.1);
 }
 function rods(m) {
  // Culata ligera on the launchers: twin sliding rods and a shoulder pad.
  label('Accesorio · culata ligera');
  slab([[m.z+.06,m.top],[m.z-.1,m.top],[m.z-.1,m.y-.035,.02],[m.z+.06,m.y-.035,.02]],.11,dark);
  many([-.035,.035].map(x=>gcyl(.014,.62,x,m.y,m.z-.36,'z',12)),steel);
  slab([[m.z-.64,m.y+.09],[m.z-.69,m.y+.09,.02],[m.z-.69,m.y-.13,.02],[m.z-.64,m.y-.13]],.14,rubber);
  box(.12,.03,.05,cream,0,m.y,m.z-.62,.01);
 }
 // A feed set off to one side on an elbow, leaning out, so the top stays clear for sights.
 // `x` picks the side (negative is the left), `tilt` how far it leans out.
 function sideMount(f,fn) {
  const dir=Math.sign(f.x||0);
  if(dir&&f.elbow!==false)put(gcyl(.042,.07,f.x-dir*.02,f.y,f.z,'x',16),dark);
  const g=holder(f.x||0,f.y,f.z,'feed');g.rotation.z=-dir*(f.tilt||0);g.rotation.x=f.lean||0;
  within(g,fn);return g;
 }
 function feeder(f,s=1) {
  label('Accesorio · tolva grande');
  const g=sideMount(f,()=>{const top=neck(f.neck||.05);within(top,()=>{label('Accesorio · tolva grande');loader(s,f.ball);});});
  // Every piece of the loader keeps the attachment's name, even inside its own group.
  g.traverse(o=>{if(o.isMesh)o.name='Accesorio · tolva grande · '+o.name.replace('Tolva · ','').replace('Cuello de alimentación','cuello');});
 }
// Mira: the sight accessory. Each kind returns the sight line it creates.
 function optic(o) {
  label('Accesorio · mira');
  let x=o.x||0;const y=o.y,z=o.z,k=o.kind||'dot';
  if(o.arm!==undefined){// a side bracket from the body out to the optic
   const a=o.arm;box(Math.abs(a-x)+.03,.024,.07,dark,(x+a)/2,y-.012,z,.006);box(.03,.05,.07,dark,x,y-.03,z,.006);x=a;}
  if(k==='laser'){box(.044,.05,.15,dark,x,y,z,.01);put(gcyl(.016,.006,x,y,z+.077,'z',14),mat('#ff4b4b',{emissive:'#ff2020',emissiveIntensity:2}));
   box(.012,.02,.03,coral,x+.026,y+.008,z-.03,.004);box(.05,.02,.04,dark,x,y+.03,z,.004);return null;}
  if(k==='dot'){box(.05,.022,.075,dark,x,y+.011,z,.006);const ay=y+.055;
   put(new THREE.TorusGeometry(.03,.009,8,22).translate(x,ay,z+.012),dark);put(gcyl(.024,.004,x,ay,z+.012,'z',18),glass);blob(.006,coral,x,ay,z+.014);
   box(.012,.016,.02,steel,x+.035,ay,z,.004);return {x,y:ay};}
  if(k==='holo'){box(.064,.02,.12,dark,x,y+.01,z,.006);box(.074,.034,.1,dark,x,y+.037,z+.005,.01);const ay=y+.085;
   many([gbox(.078,.012,.022,x,ay+.033,z+.035),gbox(.012,.072,.022,x-.033,ay,z+.035),gbox(.012,.072,.022,x+.033,ay,z+.035)],dark);
   put(gbox(.056,.056,.003,x,ay,z+.035),glass);put(new THREE.TorusGeometry(.01,.0018,6,16).translate(x,ay,z+.037),mat('#ff4b4b',{emissive:'#ff2020',emissiveIntensity:1.5}));
   box(.03,.012,.03,coral,x,y+.06,z-.035,.004);return {x,y:ay};}
  if(k==='scope'){const m=o.mat||ink,ay=y+.05,L=o.len||.4;
   for(const dz of [.08,L-.1])box(.03,.04,.03,o.mat||dark,x,y+.02,z+dz,.006);
   turn([[0,z-.02],[.03,z-.02],[.032,z+.04],[.022,z+.07],[.022,z+L-.1],[.034,z+L-.03],[.036,z+L],[0,z+L]],m,x,ay,24);
   put(gcyl(.03,.005,x,ay,z+L+.002,'z',18),lens());if(o.mat)many([z+.12,z+L-.14].map(zz=>gcyl(.026,.012,x,ay,zz,'z',18)),coral);
   return {x,y:ay};}
 }
 function decorate(d) {
  if(!d)return;
  if(d.face){// a flat striking face looking down +Z (La Chancleta's sole)
   const yAt=t=>d.y0+(d.y1-d.y0)*t,z=d.z;
   if(pattern==='stripe'){label('Detalle · rayas');many([.3,.5,.7].map(t=>gbox(d.w,.022,.006,0,yAt(t),z)),cream);}
   else if(pattern==='dots'){label('Detalle · puntos');many(range(0,4,1).map(i=>{const g=new THREE.SphereGeometry(.017,10,8);g.scale(1,1,.35);g.translate(i%2?.03:-.03,yAt(.15+i*.23),z);return g;}),coral);}
   else {label('Detalle · mancha de fábrica');const ym=yAt(.5),p=[gcyl(.042,.006,0,ym,z,'z',18)];
    for(const [a,dd,rr] of [[.4,.042,.02],[2.1,.044,.018],[3.7,.04,.022],[5.1,.046,.016],[1.2,.072,.008],[2.9,.074,.01],[4.4,.07,.008],[5.8,.076,.009]])p.push(gcyl(rr,.006,Math.cos(a)*dd*.8,ym+Math.sin(a)*dd,z,'z',12));
    many(p,cream);}
   return;}
  if(d.axis==='y'){const ym=(d.y0+d.y1)/2,x0=d.x||0,rr=y=>d.rAt?d.rAt(y):d.r;
   if(pattern==='stripe'){label('Detalle · rayas');many([.25,.5,.75].map(t=>{const y=d.y0+(d.y1-d.y0)*t;if(!d.rAt)return gcyl(d.r+.006,.03,x0,y,d.z,'y',24);const g=new THREE.TorusGeometry(rr(y)+.002,.009,8,40);g.rotateX(Math.PI/2);g.translate(x0,y,d.z);return g;}),cream);}
   else if(pattern==='dots'){label('Detalle · puntos');many([-1,1].flatMap(s=>range(0,3,1).map(i=>{const y=d.y0+(d.y1-d.y0)*(.15+i*.23);return gball(.014,x0+s*(rr(y)+.003),y,d.z,.45,10);})),coral);}
   else {label('Detalle · mancha de fábrica');const hw=rr(ym)+.003,p=[];for(const s of [-1,1]){p.push(gcyl(.026,.01,x0+s*hw,ym,d.z,'x',16));
    for(const [a,dd,r2] of [[.5,.03,.013],[2.4,.03,.012],[4.2,.032,.011],[1.4,.05,.006],[3.4,.052,.007],[5.4,.05,.006]])p.push(gcyl(r2,.01,x0+s*hw,ym+Math.sin(a)*dd,d.z+Math.cos(a)*dd*.6,'x',10));}
    many(p,cream);}
   return;}
  const hw=d.r?d.r+.003:d.w/2+.002,side=s=>s*hw;
  if(pattern==='stripe'){label('Detalle · rayas');const zs=[.25,.5,.75].map(t=>d.z0+(d.z1-d.z0)*t);
   many(zs.map(z=>d.r?gcyl(d.r+.006,.032,0,d.y,z,'z',36):gbox(d.w+.012,d.h+.012,.032,0,d.y,z)),cream);}
  else if(pattern==='dots'){label('Detalle · puntos');
   many([-1,1].flatMap(s=>range(0,4,1).map(i=>gball(.018,side(s),d.y,d.z0+(d.z1-d.z0)*(.12+i*.19),.45,10))),coral);}
  else {label('Detalle · mancha de fábrica');const zc=(d.z0+d.z1)/2,t=d.r?.012:.006,parts=[];
   for(const s of [-1,1]){const x=side(s);parts.push(gcyl(.042,t,x,d.y,zc,'x',18));
    for(const [a,dd,rr] of [[.4,.04,.022],[2.1,.042,.02],[3.7,.038,.024],[5.1,.044,.018],[1.2,.07,.009],[2.9,.072,.011],[4.4,.068,.008],[5.8,.075,.01]])
     parts.push(gcyl(rr,t,x,d.y+Math.sin(a)*dd*(d.h?Math.min(1,d.h/.16):1),zc+Math.cos(a)*dd,'x',12));}
   many(parts,cream);}
 }
 // --- Melee accessories ---
 // Cinta de agarre: a black tape wrap spiralling up the handle, cream ends.
 function tapeWrap(G) {
  label('Accesorio · cinta de agarre');
  if(G.bands){many(G.bands.map(([y,w,d])=>gbox(w,.026,d,0,y,G.z||0)),ink);many(G.bands.map(([y,w,d])=>gbox(w+.004,.006,d+.004,0,y+.014,G.z||0)),cream);return;}
  const turns=(G.y1-G.y0)/.03,n=Math.round(turns*16),pts=[];
  for(let i=0;i<=n;i++){const t=i/n,a=t*turns*Math.PI*2;pts.push(new THREE.Vector3(Math.sin(a)*(G.r+.004),G.y0+t*(G.y1-G.y0),Math.cos(a)*(G.r+.004)));}
  put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),n,.009,5),ink);
  many([G.y0,G.y1].map(y=>gcyl(G.r+.009,.016,0,y,0,'y',20)),cream);
 }
 // Pintura fresca: runs of wet paint hanging off the head, each ending in a drop.
 function drips(pts,len=.06) {
  label('Accesorio · pintura fresca');const g=[];
  pts.forEach(([x,y,z],i)=>{const l=len*(.55+((i*37)%10)/14),a=new THREE.SphereGeometry(.012,8,6);a.scale(1,l/.024,1);a.translate(x,y-l/2,z);g.push(a,gball(.016,x,y-l,z,1,8));});
  many(g,paint);
 }
 const ring=(y,r,n,phase=0)=>range(0,n-1,1).map(i=>{const a=phase+i/n*Math.PI*2;return [Math.sin(a)*r,y,Math.cos(a)*r];});
 // Muñequera: a paracord wrist loop from the pommel with a cream slider bead.
 function lanyard(p) {
  label('Accesorio · muñequera');const y=p.y,z=p.z||0;
  const loop=[[0,y,z],[0,y-.05,z+.045],[0,y-.15,z+.04],[0,y-.19,z],[0,y-.15,z-.04],[0,y-.05,z-.045]].map(v=>new THREE.Vector3(...v));
  put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop,true),48,.0075,6,true),line);
  blob(.016,cream,0,y-.028,z,1,1.3,1);
 }
 function trinket(parent,at={y:-.375,z:-.1}) {
  if(charm==='none')return;
  if(at.x)within(parent,()=>{parent=holder(at.x,0,0,'charm');});
  within(parent,()=>{
   label('Llavero');
   const Y=at.y,Z=at.z,links=[];const add=(y,rot)=>{const g=new THREE.TorusGeometry(.014,.0045,6,14);g.rotateY(rot);g.translate(0,y,Z);links.push(g);};
   add(Y,Math.PI/2);add(Y-.023,0);add(Y-.045,Math.PI/2);add(Y-.067,0);
   many(links,steel);
   if(charm==='mango'){blob(.052,mat('#ffc629',{roughness:.45}),0,Y-.13,Z,.95,1.25,.9);
    const blush=new THREE.SphereGeometry(.03,12,8);blush.scale(.6,1,1);blush.translate(.03,Y-.115,Z);put(blush,coral);
    post(.004,.006,.024,woodDark,0,Y-.075,Z);const leaf=new THREE.SphereGeometry(.02,10,6);leaf.scale(1.6,.35,.8);leaf.rotateZ(.5);leaf.translate(.018,Y-.077,Z);put(leaf,mat('#5c9e3a'));}
   else {blob(.055,mat(color,{roughness:.3}),0,Y-.135,Z);
    const seam=new THREE.TorusGeometry(.055,.004,6,24);seam.rotateY(Math.PI/2);seam.translate(0,Y-.135,Z);put(seam,cream);}
  });
 }

 let tip=1.05,sight=.28,sightX=0,mounts=[],charmAt,meleeSpec=null,optic_=null;
 if(weapon==='pistol') {
  tip=1.05;sight=.31;
  frame(.12);
  label('Cargador');slab([[.014,-.325],[-.134,-.325],[-.14,-.37,.012],[.022,-.37,.012]],.13,ink);
  label('Cuerpo');slab([[-.115,.075],[-.115,.2,.03],[-.075,.275,.04],[.62,.275,.03],[.7,.235,.03],[.7,.075]],.15,paint);
  label('Guardapolvo');slab([[.2,.085],[.7,.085],[.7,.04,.02],[.25,.03,.02]],.13,dark);
  label('Estrías');many([...range(-.09,.05,.028).map(z=>gbox(.158,.13,.009,0,.19,z)),...range(.5,.6,.028).map(z=>gbox(.158,.1,.009,0,.2,z))],ink);
  label('Tapas de ojo');put(gcyl(.022,.162,0,.205,.17,'x',18),dark);
  label('Riel');slab([[.04,.27],[.56,.27],[.56,.3,.005],[.04,.3,.005]],.06,dark,{bevel:.005});many(range(.07,.53,.04).map(z=>gbox(.068,.012,.018,0,.305,z)),dark);
  label('Miras');many([gbox(.022,.04,.03,-.03,.293,-.065),gbox(.022,.04,.03,.03,.293,-.065),gbox(.018,.045,.03,0,.3,.6)],ink);blob(.009,coral,0,.32,.588);
  label('Martillo');box(.06,.05,.045,steel,0,.235,-.13,.012);
  label('Cañón');turn([[0,.69],[.05,.69],[.05,.74],[.043,.765],[.041,1.0],[0,1.0]],steel,0,.17);
  many(ports(0,.17,.84,.97,.041,.032,[0,-.9,.9]),ink);
  if(!has('barrel')){label('Boca');turn([[.03,.99],[.054,.99],[.056,1.05],[.03,1.05],[.03,1.04],[0,1.04]],coral,0,.17);}
  label('Tanque');turn(capsule(.048,.27,.74),steel,0,-.015);
  many([.37,.62].map(z=>gcyl(.053,.022,0,-.015,z,'z',24)),cream);
  many([.37,.62].map(z=>gbox(.03,.04,.02,0,.028,z)),dark);
  label('Regulador');turn([[0,.73],[.05,.73],[.052,.78],[.04,.805],[0,.805]],dark,0,-.015);
  gauge(.06,-.015,.765);
  label('Manguera');hose([[0,-.05,.79],[0,-.12,.75],[0,-.18,.55],[0,-.245,.3],[0,-.29,.12],[0,-.3,.04]],.012,line);
  many([gcyl(.017,.03,0,-.06,.785,'y',10),gcyl(.017,.03,0,-.3,.03,'z',10)],steel);
  mounts=[{parent:group,muzzle:{xs:[0],y:.17,z:1.0,r:.043},feed:{x:-.085,y:.2,z:.26,tilt:.55,neck:.09},size:.78,optic:{kind:'dot',y:.3,z:.12},stock:{y:.22,z:-.115},deco:{y:.175,h:.2,w:.15,z0:.22,z1:.5}}];
 } else if(weapon==='scatter') {
  tip=1.55;sight=.3;
  frame(.13);
  label('Cuerpo');slab([[-.16,.075],[-.16,.25,.03],[-.1,.31,.04],[.42,.31,.03],[.5,.27,.03],[.5,.075]],.22,paint);
  label('Placa lateral');slab([[-.06,.12],[.36,.12],[.36,.25,.03],[-.06,.25,.03]],.228,dark,{bevel:.004});
  label('Tornillos');many([[-.03,.14],[-.03,.23],[.33,.14],[.33,.23]].map(([z,y])=>gcyl(.009,.236,0,y,z,'x',8)),steel);
  label('Cañones');for(const x of [-.062,.062])turn([[0,.48],[.06,.48],[.06,.58],[.052,.6],[.052,1.42],[0,1.42]],steel,x,.225);
  slab([[.5,.19],[1.4,.19],[1.4,.255],[.5,.255]],.07,dark,{bevel:.005});
  slab([[.5,.27],[1.4,.27],[1.4,.29,.005],[.5,.29,.005]],.04,dark,{bevel:.004});blob(.012,cream,0,.3,1.37);
  many([-.062,.062].flatMap(x=>ports(x,.225,1.14,1.38,.052,.04,[0,x<0?-.85:.85])),ink);
  if(!has('barrel')){label('Boca');for(const x of [-.062,.062]){turn([[.045,1.4],[.06,1.4],[.086,1.53],[.088,1.55],[.045,1.55],[.045,1.53]],coral,x,.225);put(gcyl(.045,.004,x,.225,1.535,'z',20),ink);}}
  label('Tanque');turn(capsule(.045,.46,1.2),steel,0,.085);
  label('Regulador');turn([[0,1.19],[.05,1.19],[.052,1.25],[.04,1.27],[0,1.27]],dark,0,.085);gauge(0,.085,1.27,'z');
  label('Bomba');slab([[.62,.03],[.62,.15,.02],[.66,.168,.01],[1.0,.168,.01],[1.04,.15,.02],[1.04,.03,.03],[.98,.0,.03],[.68,.0,.03]],.15,wood);
  many(range(.7,.96,.045).map(z=>gbox(.156,.11,.012,0,.085,z)),woodDark);
  label('Varillas');many([-.055,.055].map(x=>gcyl(.012,.16,x,.135,.56,'z',10)),steel);
  if(!has('stock')){label('Culata');slab([[-.12,.29],[-.12,.08],[-.3,.04,.03],[-.83,-.1,.03],[-.86,-.1],[-.86,.24],[-.83,.26,.02],[-.32,.27,.04]],.17,wood);
   slab([[-.86,-.105],[-.86,.245],[-.9,.245,.02],[-.9,-.105,.02]],.175,rubber);
   many([gcyl(.012,.18,0,.07,-.6,'x',10)],steel);}
  const SF={x:-.12,y:.23,z:.15,tilt:.5,neck:.1};if(!has('hopper')){label('Alimentador');sideMount(SF,()=>stick(.34));}
  mounts=[{parent:group,muzzle:{xs:[-.062,.062],y:.225,z:1.42,r:.052},feed:SF,size:1,optic:{kind:'holo',y:.31,z:.05},stock:{y:.24,z:-.16},deco:{y:.19,h:.235,w:.232,z0:-.04,z1:.4}}];
 } else if(weapon==='rapid') {
  tip=.98;sight=.46;
  const hands=[-1,1].map(side=>{
   const hand=holder(side*.3,0,0,side<0?'Mano izquierda':'Mano derecha');
   within(hand,()=>{
    frame(.12);
    label('Cuerpo');slab([[-.1,.075],[-.1,.22,.03],[-.05,.27,.04],[.42,.27,.03],[.47,.23,.03],[.47,.075]],.14,paint);
    label('Tapas de ojo');put(gcyl(.02,.152,0,.2,.12,'x',16),dark);
    label('Funda del cañón');turn([[0,.45],[.062,.45],[.066,.47],[.066,.9],[.058,.92],[0,.92]],dark,0,.17);
    many([.58,.7,.82].map(z=>gcyl(.071,.026,0,.17,z,'z',24)),cream);
    many(ports(0,.17,.52,.88,.066,.06,[-Math.PI/2,Math.PI/2,0],.011),ink);
    label('Cañón');turn([[0,.9],[.042,.9],[.042,.935],[0,.935]],steel,0,.17);
    if(!has('barrel')){label('Boca');turn([[.03,.93],[.053,.93],[.055,.98],[.03,.98],[.03,.97],[0,.97]],coral,0,.17);}
    label('Cartucho');const c=holder(0,.07,.34,'cartridge');c.rotation.x=-.12;
    within(c,()=>{label('Cartucho');post(.042,.042,.04,dark,0,-.015,0);post(.032,.032,.22,steel,0,-.13,0);post(.038,.038,.12,rubber,0,-.11,0);post(.036,.03,.035,cream,0,-.255,0);});
    if(!has('hopper')){const top=holder(0,.27,.16,'feed');within(top,()=>{const n=neck(.035);within(n,drum);});}
   });
   return hand;
  });
  group.userData.hands=hands;
  mounts=hands.map(hand=>({parent:hand,muzzle:{xs:[0],y:.17,z:.935,r:.045},feed:{y:.27,z:.16,neck:.035},size:.78,optic:{kind:'laser',y:.075,z:.6},stock:{y:.2,z:-.1},deco:{y:.17,h:.195,w:.14,z0:.0,z1:.4}}));
 } else if(weapon==='rocket') {
  tip=1.44;sight=.49;const Y=.22,R=.195;
  label('Tubo');turn([[0,-.3],[R-.012,-.3],[R,-.288],[R,1.07],[R-.01,1.08],[0,1.08]],paint,0,Y,44);
  many([.05,.62].map(z=>gcyl(R+.01,.07,0,Y,z,'z',44)),cream);
  label('Campana');turn([[0,-.33],[R-.02,-.33],[.28,-.49],[.305,-.5],[.31,-.48],[R+.004,-.28]],dark,0,Y,44);
  put(gcyl(.07,.02,0,Y,-.32,'z',20),coral);
  label('Ojiva');turn([[0,1.06],[R-.006,1.06],[R-.012,1.12],[.17,1.22],[.12,1.33],[.06,1.405],[0,1.44]],coral,0,Y,40);
  put(gcyl(R-.004,.03,0,Y,1.1,'z',40),cream);
  frame(.13);
  label('Empuñadura delantera');slab([[.62,.06],[.75,.06],[.73,-.2,.025],[.62,-.2,.025]],.1,dark);
  many([-.06,-.1,-.14].map(y=>gbox(.112,.012,.1,0,y,.68)),rubber);
  label('Riel');slab([[-.12,.405],[.42,.405],[.42,.43,.005],[-.12,.43,.005]],.07,dark,{bevel:.005});many(range(-.09,.4,.04).map(z=>gbox(.076,.012,.018,0,.435,z)),dark);
  if(!has('optic')){label('Miras');box(.05,.05,.04,dark,0,.455,-.05,.01);put(new THREE.TorusGeometry(.018,.006,8,18).translate(0,.495,-.05),cream);
  box(.014,.06,.02,dark,0,.46,.38,.004);put(new THREE.TorusGeometry(.032,.006,8,20).translate(0,.47,.38),cream);}
  label('Rejilla');many([-1,1].flatMap(s=>[Math.PI/2-.35,Math.PI/2,Math.PI/2+.35].flatMap(t=>range(.72,1.0,.07).map(z=>gbox(.01,.024,.05,s*R*Math.sin(t),Y+R*Math.cos(t),z,0,0,s*(Math.PI/2-t))))),ink);
  if(!has('hopper')){label('Escotilla');box(.14,.04,.2,dark,0,.425,.85,.015);put(gcyl(.012,.13,0,.43,.745,'x',10),steel);box(.04,.02,.03,coral,0,.448,.95,.006);}
  if(!has('stock')){label('Almohadilla');slab([[-.05,.07],[-.32,.07],[-.32,-.05,.03],[-.12,-.02,.03]],.14,rubber);}
  mounts=[{parent:group,muzzle:{xs:[0],y:Y,z:1.06,r:R},feed:{x:-.18,y:.3,z:.78,tilt:.6,neck:.09,ball:.045},size:1.1,optic:{kind:'holo',y:.43,z:.16},rods:{y:-.13,z:-.02,top:.06},deco:{y:Y,r:R,z0:.12,z1:.58}}];
 } else if(weapon==='bazooka') {
  tip=1.645;sight=.325;const Y=.24,R=.13;
  label('Tubo');turn([[0,-.62],[R-.01,-.62],[R,-.61],[R,1.15],[R-.01,1.16],[0,1.16]],paint,0,Y,40);
  many([.85,-.4].map(z=>gcyl(R+.007,.06,0,Y,z,'z',40)),cream);
  many([.92,-.47].map(z=>gcyl(R+.004,.012,0,Y,z,'z',40)),ink);
  label('Collarín');turn([[0,1.12],[.15,1.12],[.165,1.15],[.165,1.24],[.15,1.26],[0,1.26]],dark,0,Y,36);
  label('Ojiva');turn([[0,1.2],[.11,1.2],[.125,1.27],[.13,1.33],[.12,1.42],[.09,1.5],[.05,1.55],[0,1.56]],coral,0,Y,32);
  label('Espoleta');turn([[0,1.54],[.042,1.54],[.026,1.62],[.008,1.645],[0,1.645]],cream,0,Y,20);
  label('Campana');turn([[0,-.66],[R-.02,-.66],[.2,-.96],[.226,-.97],[.228,-.95],[R+.006,-.6]],dark,0,Y,40);
  label('Soporte');slab([[-.45,.07],[.22,.07],[.22,.16],[-.45,.16]],.1,dark,{bevel:.012});
  frame(.12);
  label('Empuñadura delantera');slab([[.5,.14],[.62,.14],[.6,-.16,.025],[.5,-.16,.025]],.1,dark);
  many([-.02,-.06,-.1].map(y=>gbox(.112,.012,.1,0,y,.555)),rubber);
  label('Visor');box(.08,.035,.07,dark,-.135,.31,.3,.01);
  slab([[.18,.27],[.4,.27],[.44,.31,.02],[.4,.38,.02],[.2,.38,.02],[.18,.35]],.08,dark,{x:-.2});
  put(gcyl(.03,.012,-.2,.325,.43,'z',20),lens());put(gcyl(.032,.05,-.2,.325,.165,'z',20),rubber);
  label('Miras');many([gbox(.014,.05,.02,0,.395,.98),gbox(.05,.03,.025,0,.385,.05)],ink);
  if(!has('stock')){label('Almohadilla');slab([[-.3,.13],[-.6,.13],[-.6,.07,.025],[-.32,.08,.025]],.12,rubber);}
  mounts=[{parent:group,muzzle:{xs:[0],y:Y,z:1.26,r:.165},feed:{y:.37,z:-.3,neck:.04,ball:.05},size:.95,optic:{kind:'holo',x:.125,arm:.21,y:.27,z:.32},rods:{y:-.02,z:-.4,top:.12},deco:{y:Y,r:R,z0:.45,z1:.8}}];
 } else if(weapon==='sniper') {
  tip=1.78;sight=.38;
  frame(.12);
  label('Cuerpo');slab([[-.16,.075],[-.16,.25,.03],[-.12,.275,.03],[.56,.275,.02],[.6,.25,.02],[.6,.075]],.15,paint);
  label('Cerrojo');box(.004,.018,.2,ink,.077,.205,.05,.002);post(.018,.018,.15,steel,.1,.205,.02).rotation.z=Math.PI/2;blob(.035,ink,.18,.205,.02);
  label('Riel');slab([[-.12,.275],[.54,.275],[.54,.3,.005],[-.12,.3,.005]],.07,dark,{bevel:.005});many(range(-.1,.52,.04).map(z=>gbox(.076,.012,.018,0,.305,z)),dark);
  // With the Mira the stock scope gives way to a long-range one: fatter, longer, sunshade and flip caps.
  const big=has('optic');if(big)sight=.405;const tr=big?.054:.043;
  label(big?'Accesorio · mira':'Monturas');for(const z of [.02,.4]){box(.06,big?.075:.05,.05,dark,0,big?.335:.322,z,.01);put(new THREE.TorusGeometry(tr+.009,.012,8,24).translate(0,sight,z),dark);}
  label(big?'Accesorio · mira':'Mira telescópica');
  turn(big?[[0,-.25],[.058,-.25],[.07,-.22],[.07,-.11],[.054,-.06],[.054,.5],[.086,.62],[.09,.9],[0,.9]]:[[0,-.17],[.05,-.17],[.058,-.15],[.058,-.07],[.044,-.03],[.043,.5],[.068,.6],[.07,.7],[0,.7]],ink,0,sight,32);
  const back=big?-.251:-.171,front=big?.901:.701;
  put(gcyl(big?.058:.048,.006,0,sight,back,'z',24),mat('#1b4a5a',{roughness:.1,metalness:.4}));
  put(gcyl(big?.08:.062,.01,0,sight,front,'z',28),lens());
  post(.024,.024,.05,ink,0,sight+tr+.021,.22);post(.026,.026,.012,cream,0,sight+tr+.05,.22);
  put(gcyl(.022,.05,tr+.021,sight,.22,'x',16),ink);put(gcyl(.024,.012,tr+.05,sight,.22,'x',16),cream);
  if(big){put(gcyl(.092,.02,0,sight,.84,'z',28),cream);post(.016,.016,.04,ink,-tr-.02,sight,.22).rotation.z=Math.PI/2;
   const cap=new THREE.CylinderGeometry(.068,.068,.012,24);cap.rotateZ(Math.PI/2);cap.translate(.082,sight+.02,-.29);put(cap,cream);box(.03,.012,.03,cream,.07,sight+.035,-.255,.004);}
  label('Guardamano');slab([[.56,.09],[.56,.24,.02],[1.02,.24,.03],[1.02,.09,.03]],.13,dark,{holes:range(0,4,1).map(i=>[[.62+i*.08,.13,.015],[.67+i*.08,.13,.015],[.67+i*.08,.2,.015],[.62+i*.08,.2,.015]])});
  label('Cañón');turn([[0,.56],[.046,.56],[.042,.62],[.04,1.62],[0,1.62]],steel,0,.17);
  many(ports(0,.17,1.32,1.56,.04,.04,[0,-.85,.85]),ink);
  if(!has('barrel')){label('Boca');turn([[0,1.585],[.066,1.585],[.066,1.615],[.062,1.62],[.062,1.77],[.03,1.77],[.03,1.76],[0,1.76]],dark,0,.17);
   put(gcyl(.069,.026,0,.17,1.6,'z',24),coral);many([-1,1].flatMap(s=>[1.66,1.71].map(z=>gbox(.012,.06,.025,s*.064,.17,z))),ink);}
  label('Bípode');box(.1,.035,.06,dark,0,.07,.99,.01);many([-.04,.04].map(x=>gcyl(.013,.38,x,.065,.8,'z',10)),steel);many([-.04,.04].map(x=>gball(.018,x,.065,.6)),rubber);
  if(!has('stock')){label('Culata');slab([[-.14,.25],[-.14,.08],[-.24,.0,.04],[-.72,-.06,.02],[-.76,-.06],[-.76,.23],[-.72,.245,.02],[-.36,.245,.03],[-.3,.265,.03]],.13,wood);
   slab([[-.34,.24],[-.64,.24],[-.62,.3,.02],[-.36,.3,.02]],.09,woodDark);
   slab([[-.76,-.065],[-.76,.235],[-.8,.235,.015],[-.8,-.065,.015]],.15,rubber);}
  // The scope owns the top, so ammo comes in from an elbow on the left.
  label('Codo de alimentación');tube(.05,.05,.07,dark,-.09,.2,.24).rotation.set(0,Math.PI/2,0);
  if(!has('hopper')){const g=holder(-.1,.21,.24,'feed');g.rotation.z=.6;within(g,()=>stick(.34));}
  mounts=[{parent:group,muzzle:{xs:[0],y:.17,z:1.62,r:.042},feed:{x:-.1,y:.21,z:.24,tilt:.55,neck:.1,elbow:false},size:.85,stock:{y:.22,z:-.16},deco:{y:.175,h:.2,w:.15,z0:.3,z1:.56}}];
 } else if(weapon==='smg') {
  // La Metra: a stubby boxy machine marker, side stick feed like an old Sten, red dot on top.
  tip=1.13;sight=.375;
  frame(.12);
  label('Cuerpo');slab([[-.2,.075],[-.2,.25,.03],[-.14,.29,.04],[.5,.29,.03],[.58,.24,.03],[.58,.075]],.15,paint);
  label('Bloque inferior');slab([[.24,.08],[.6,.08],[.57,-.05,.03],[.34,-.05,.03]],.13,dark);
  label('Empuñadura delantera');slab([[.4,-.03],[.5,-.03],[.49,-.25,.02],[.41,-.25,.02]],.085,dark);
  many([-.1,-.15,-.2].map(y=>gbox(.097,.012,.1,0,y,.45)),rubber);
  label('Tapas de ojo');put(gcyl(.02,.162,0,.21,.1,'x',16),dark);
  label('Funda del cañón');turn([[0,.56],[.058,.56],[.06,.58],[.06,.95],[.052,.97],[0,.97]],dark,0,.18);
  many(ports(0,.18,.62,.92,.06,.05,[0,-Math.PI/2,Math.PI/2],.012),ink);
  label('Cañón');turn([[0,.96],[.04,.96],[.04,1.08],[0,1.08]],steel,0,.18);
  if(!has('barrel')){label('Boca');turn([[.028,1.07],[.05,1.07],[.052,1.13],[.028,1.13],[.028,1.12],[0,1.12]],coral,0,.18);}
  label('Riel');slab([[-.17,.285],[.48,.285],[.48,.31,.005],[-.17,.31,.005]],.06,dark,{bevel:.005});many(range(-.14,.46,.04).map(z=>gbox(.068,.012,.018,0,.314,z)),dark);
  if(!has('optic')){label('Mira de punto rojo');box(.07,.03,.09,dark,0,.33,-.06,.008);put(new THREE.TorusGeometry(.032,.01,8,20).translate(0,sight,-.04),dark);
  put(gcyl(.026,.004,0,sight,-.04,'z',18),lens());blob(.006,coral,0,sight,-.037);}
  label('Palanca de carga');box(.04,.03,.07,steel,0,.31,-.17,.008);put(gcyl(.012,.06,.1,.24,.3,'x',10),steel);
  label('Manguera');hose([[0,-.31,.03],[0,-.37,.12],[0,-.37,.32],[0,-.27,.44]],.012,line);many([gcyl(.017,.03,0,-.3,.03,'z',10),gcyl(.017,.03,0,-.26,.44,'y',10)],steel);
  if(!has('hopper')){const g=holder(-.075,.19,.2,'feed');g.rotation.z=Math.PI/2;within(g,()=>stick(.3));}
  mounts=[{parent:group,muzzle:{xs:[0],y:.18,z:1.08,r:.04},feed:{x:-.085,y:.2,z:.24,tilt:.55,neck:.09},size:.8,optic:{kind:'holo',y:.31,z:-.04},stock:{y:.2,z:-.2},deco:{y:.18,h:.215,w:.15,z0:-.12,z1:.34}}];
 } else if(weapon==='minigun') {
  // La Licuadora: six spinning barrels on a fat motor, fed by a hose of paintballs.
  tip=1.43;sight=.44;const Y=.2;
  frame(.13);
  label('Motor');turn([[0,-.28],[.12,-.28],[.145,-.25],[.145,.42],[.12,.46],[0,.46]],paint,0,Y,40);
  many([-.12,.32].map(z=>gcyl(.153,.04,0,Y,z,'z',40)),cream);
  label('Tapa trasera');turn([[0,-.35],[.07,-.35],[.1,-.32],[.115,-.27],[0,-.27]],dark,0,Y,28);put(gcyl(.025,.012,0,Y,-.355,'z',14),coral);
  const spin=holder(0,Y,0,'barrels');
  within(spin,()=>{
   label('Cañones giratorios');turn([[0,.44],[.05,.44],[.05,1.42],[0,1.42]],dark,0,0,16);
   many(range(0,5,1).map(i=>{const a=i/6*Math.PI*2;return gcyl(.024,.97,Math.sin(a)*.07,Math.cos(a)*.07,.925,'z',12);}),steel);
   label('Abrazaderas');many([.72,1.3].map(z=>gcyl(.105,.03,0,0,z,'z',30)),dark);
   if(!has('barrel')){label('Bocas');many(range(0,5,1).map(i=>{const a=i/6*Math.PI*2;return gcyl(.031,.04,Math.sin(a)*.07,Math.cos(a)*.07,1.41,'z',12);}),coral);
    many(range(0,5,1).map(i=>{const a=i/6*Math.PI*2;return gcyl(.015,.004,Math.sin(a)*.07,Math.cos(a)*.07,1.431,'z',10);}),ink);}
  });
  group.userData.spin=spin;
  label('Asa');slab([[.14,.33],[.14,.43,.04],[.44,.43,.04],[.44,.33],[.38,.33],[.38,.385,.02],[.2,.385,.02],[.2,.33]],.05,dark);
  label('Batería');box(.07,.12,.24,dark,.165,Y,.1,.02);box(.008,.02,.03,coral,.2,Y+.035,.18,.003);
  label('Empuñadura delantera');slab([[.26,.08],[.38,.08],[.36,-.18,.025],[.26,-.18,.025]],.1,dark);
  many([-.05,-.09,-.13].map(y=>gbox(.112,.012,.1,0,y,.315)),rubber);
  if(!has('hopper'))ballHose([[-.15,Y,.06],[-.25,Y-.02,.04],[-.33,.0,-.05],[-.35,-.28,-.2],[-.34,-.52,-.34]]);
  mounts=[{parent:group,muzzle:{xs:[0],y:Y,z:1.42,r:.1},feed:{x:-.13,y:.26,z:-.02,tilt:.5,neck:.07},size:.9,optic:{kind:'dot',y:.43,z:.29},stock:{y:.24,z:-.3},deco:{y:Y,r:.145,z0:-.08,z1:.26}}];
 } else if(weapon==='slingshot') {
  // La China: a wrist-braced paintball slingshot. No trigger, the pouch is the muzzle.
  tip=.12;sight=.3;charmAt={y:-.37,z:0};
  label('Mango');post(.036,.032,.34,rubber,0,-.17,0);many(range(-.3,-.06,.055).map(y=>gcyl(.039,.012,0,y,0,'y',18)),ink);
  label('Remate');post(.042,.042,.03,dark,0,-.35,0);post(.03,.03,.012,coral,0,-.333,0);
  label('Horqueta');blob(.048,paint,0,.01,0);
  for(const s of [-1,1])hose([[0,.0,0],[s*.04,.08,.005],[s*.1,.18,.012],[s*.14,.3,.02]],.03,paint);
  label('Puntas');many([-1,1].map(s=>gball(.036,s*.142,.31,.02,1,14)),cream);
  label('Muñequera');hose([[0,-.02,-.03],[0,-.05,-.14],[0,-.1,-.25],[0,-.16,-.31]],.022,steel);box(.13,.035,.12,rubber,0,-.18,-.34,.015);
  label('Ligas');for(const s of [-1,1])hose([[s*.142,.31,.035],[s*.1,.3,-.04],[s*.045,.29,-.105]],.011,coral);
  label('Bolsa');blob(.04,leather,0,.288,-.12,1.5,.85,.6);blob(.031,ball,0,.29,-.1);
  if(has('barrel')){label('Accesorio · cañón afinado');put(gcyl(.016,.29,0,.31,.02,'x',12),steel);}
  // Mira on La China: a hunter's pin sight hung from the right fork, three bright pins to aim by.
  if(has('optic')){label('Accesorio · mira');box(.03,.05,.03,dark,.128,.26,.03,.006);put(gcyl(.009,.09,.07,.262,.03,'x',10),steel);
   const pin=c=>mat(c,{emissive:c,emissiveIntensity:.6});[['#d4f786',.04],['#ffc629',.065],['#ff4b4b',.09]].forEach(([c,x])=>{post(.0035,.0035,.035,steel,x,.242,.03);blob(.007,pin(c),x,.224,.03);});sight=.224;}
  mounts=[{parent:group,muzzle:{xs:[0],y:.31,z:.02,r:.03},feed:{y:-.075,z:-.15,neck:.035},size:.55,stock:{y:-.13,z:-.38},deco:{axis:'y',x:0,z:0,y0:-.3,y1:-.05,r:.036}}];
 } else if(weapon==='revolver') {
  // El Tambor: a six-shot revolving paint-grenade launcher with a folding stock.
  tip=1.12;sight=.47;const A=.21,T=A+.095;
  frame(.13);
  label('Cuerpo');slab([[-.16,.075],[-.16,.33,.03],[-.1,.39,.03],[.06,.39],[.06,.075]],.16,paint);
  slab([[.42,.075],[.42,.39],[.58,.39,.03],[.6,.3,.03],[.58,.075,.03]],.15,paint);
  label('Puente');slab([[.0,.37],[.5,.37],[.5,.415,.01],[.0,.415,.01]],.07,dark,{bevel:.006});
  label('Eje');put(gcyl(.022,.2,0,A,.52,'z',14),steel);
  const cyl=holder(0,A,0,'cylinder');
  within(cyl,()=>{
   label('Tambor');turn([[0,.07],[.15,.07],[.165,.09],[.165,.39],[.15,.41],[0,.41]],paint,0,0,40);
   const ring=(r,z,t,i0=0)=>range(0,5,1).map(i=>{const a=(i+i0)/6*Math.PI*2;return gcyl(r,t,Math.sin(a)*.095,Math.cos(a)*.095,z,'z',18);});
   label('Recámaras');many(ring(.046,.413,.008),ink);many(ring(.035,.418,.008),coral);
   label('Estrías del tambor');many(range(0,5,1).map(i=>{const a=(i+.5)/6*Math.PI*2;return gbox(.022,.014,.24,Math.sin(a)*.163,Math.cos(a)*.163,.24,0,0,-a);}),ink);
  });
  group.userData.spin=cyl;
  label('Cañón');turn([[0,.58],[.072,.58],[.07,.62],[.062,.64],[.062,1.06],[0,1.06]],dark,0,T);
  many(ports(0,T,.7,1.0,.062,.06,[0,-Math.PI/2,Math.PI/2],.012),ink);
  if(!has('barrel')){label('Boca');turn([[.04,1.05],[.075,1.05],[.078,1.12],[.04,1.12],[.04,1.1],[0,1.1]],coral,0,T);}
  label('Guardamano');slab([[.64,.1],[.98,.12],[.98,.255,.02],[.64,.255,.02]],.13,wood);many(range(.7,.92,.05).map(z=>gbox(.136,.09,.012,0,.17,z)),woodDark);
  label('Miras');box(.05,.06,.03,dark,0,.44,.12,.006);put(new THREE.TorusGeometry(.02,.006,8,18).translate(0,.48,.12),cream);box(.014,.05,.02,ink,0,.385,.98,.004);
  if(!has('stock')){label('Culata plegable');many([gcyl(.022,.48,0,.33,-.38,'z',12),gcyl(.022,.48,0,.12,-.38,'z',12)],steel);
   slab([[-.6,.37],[-.66,.37,.02],[-.66,.08,.02],[-.6,.08]],.12,rubber);put(gcyl(.016,.24,0,.225,-.6,'y',10),steel);}
  mounts=[{parent:group,muzzle:{xs:[0],y:T,z:1.06,r:.065},feed:{x:-.085,y:.28,z:-.05,tilt:.55,neck:.09},size:.85,optic:{kind:'holo',y:.415,z:.3},stock:{y:.3,z:-.16},deco:{y:.23,h:.3,w:.16,z0:-.14,z1:.05}}];
 } else if(weapon==='blunderbuss') {
  // La Corneta: an old trumpet-mouthed scattergun with brass, wood and a modern trigger.
  tip=1.36;sight=.27;
  frame(.12);
  label('Llave');slab([[-.15,.08],[-.15,.23,.03],[.3,.23,.03],[.32,.08]],.14,paint);
  label('Cañón');turn([[0,.22],[.056,.22],[.058,.3],[.05,.34],[.048,.78],[.058,.96],[.085,1.14],[.13,1.27],[.17,1.33],[.172,1.36],[.15,1.36],[.11,1.27],[.06,1.16],[.04,1.15],[0,1.15]],brass,0,.2,36);
  put(gcyl(.04,.004,0,.2,1.153,'z',18),ink);
  label('Aros');many([.42,.72].map(z=>gcyl(.06,.025,0,.2,z,'z',24)),coral);
  label('Caja');slab([[.28,.09],[.96,.135,.02],[.96,.17],[.28,.17]],.1,wood);
  label('Baqueta');put(gcyl(.008,.64,0,.105,.62,'z',8),steel);
  label('Martillo');slab([[-.12,.22],[-.07,.22],[-.04,.31,.02],[-.08,.33,.02],[-.11,.29]],.025,steel,{x:.035,bevel:.006});box(.025,.06,.03,steel,.035,.26,.05,.006);
  gauge(-.078,.15,.12,'x',-1);
  if(!has('stock')){label('Culata');slab([[-.13,.23],[-.13,.08],[-.28,.03,.04],[-.74,-.12,.03],[-.8,-.13],[-.82,.17,.03],[-.76,.2],[-.36,.21,.08]],.13,wood);
   slab([[-.8,-.135],[-.82,.175],[-.85,.175,.01],[-.84,-.135,.01]],.135,brass,{bevel:.006});}
  mounts=[{parent:group,muzzle:{xs:[0],y:.2,z:1.36,r:.17,mat:brass},feed:{x:-.075,y:.17,z:.05,tilt:.55,neck:.09},size:.85,optic:{kind:'scope',y:.25,z:.02,len:.46,mat:brass},stock:{y:.21,z:-.13},deco:{y:.155,h:.15,w:.14,z0:-.1,z1:.28}}];
 } else if(weapon==='sprayer') {
  // La Fumigadora: a garden pump sprayer turned paint hose. Fat tank on top, long wand, fan nozzle.
  tip=1.3;sight=.25;
  frame(.12);
  label('Válvula');slab([[-.1,.075],[-.1,.2,.03],[-.06,.23,.03],[.3,.23,.03],[.34,.19,.03],[.34,.075]],.13,paint);
  label('Lanza');turn([[0,.33],[.024,.33],[.022,1.14],[0,1.14]],steel,0,.15,14);
  label('Puño de lanza');put(gcyl(.036,.18,0,.15,.62,'z',18),rubber);many([.55,.62,.69].map(z=>gcyl(.039,.01,0,.15,z,'z',18)),ink);
  if(!has('barrel')){label('Boquilla');turn([[0,1.13],[.032,1.13],[.04,1.2],[.03,1.24],[0,1.24]],dark,0,.15,18);blob(.035,coral,0,.15,1.265,1.7,.35,.7);}
  label('Tanque');turn(capsule(.13,-.4,.24,8),paint,0,.38,36);many([-.25,.1].map(z=>gcyl(.136,.03,0,.38,z,'z',36)),cream);
  label('Montura');many([-.05,.22].map(z=>gbox(.1,.06,.05,0,.235,z)),dark);
  label('Bomba');put(gcyl(.014,.18,0,.38,-.48,'z',10),steel);put(gcyl(.022,.18,0,.38,-.57,'x',14),cream);turn([[0,-.43],[.04,-.43],[.04,-.39],[0,-.39]],dark,0,.38,16);
  gauge(.128,.43,.15);
  label('Manguera');hose([[.04,.3,.24],[.12,.28,.34],[.1,.2,.44],[.035,.16,.42]],.014,line);many([gcyl(.02,.03,.04,.3,.235,'y',10),gcyl(.02,.03,.03,.16,.41,'x',10)],steel);
  mounts=[{parent:group,muzzle:{xs:[0],y:.15,z:1.14,r:.03},feed:{y:.505,z:-.06,neck:.03},size:.8,optic:{kind:'dot',x:.065,arm:.13,y:.2,z:.18},stock:{y:.17,z:-.1},deco:{y:.38,r:.13,z0:-.3,z1:.18}}];
 } else if(weapon==='sixshooter') {
  // El Llanero: a long-barrelled cowboy six-shooter, wood grips and a fluted cylinder that turns.
  tip=1.16;sight=.33;const A=.17,T=A+.062;
  frame(.12,woodDark);
  label('Cuerpo');slab([[-.13,.075],[-.13,.24,.03],[-.07,.29,.03],[.06,.29],[.06,.075]],.13,paint);
  slab([[.33,.075],[.33,.29],[.43,.29,.02],[.45,.2,.02],[.43,.075,.02]],.12,paint);
  label('Puente');slab([[.0,.275],[.36,.275],[.36,.3,.006],[.0,.3,.006]],.05,dark,{bevel:.005});
  label('Martillo');slab([[-.12,.26],[-.07,.26],[-.1,.34,.012],[-.15,.33,.012]],.03,steel,{bevel:.005});
  const cyl=holder(0,A,0,'cylinder');
  within(cyl,()=>{
   label('Tambor');turn([[0,.07],[.1,.07],[.11,.085],[.11,.32],[.1,.335],[0,.335]],steel,0,0,32);
   const at=(r,z,t,i0=0)=>range(0,5,1).map(i=>{const a=(i+i0)/6*Math.PI*2;return gcyl(r,t,Math.sin(a)*.062,Math.cos(a)*.062,z,'z',16);});
   label('Recámaras');many(at(.026,.337,.006),ink);many(at(.019,.341,.006),coral);
   label('Estrías del tambor');many(range(0,5,1).map(i=>{const a=(i+.5)/6*Math.PI*2;return gbox(.016,.012,.18,Math.sin(a)*.107,Math.cos(a)*.107,.2,0,0,-a);}),ink);
  });
  group.userData.spin=cyl;
  label('Cañón');turn([[0,.43],[.04,.43],[.036,.46],[.034,1.1],[0,1.1]],steel,0,T);
  slab([[.45,T+.028],[1.1,T+.028],[1.1,T+.044],[.45,T+.044]],.02,dark,{bevel:.004});box(.008,.03,.03,ink,0,T+.058,1.07,.003);
  label('Varilla');put(gcyl(.012,.4,0,T-.055,.66,'z',10),steel);box(.03,.03,.06,dark,0,T-.05,.88,.006);
  if(!has('barrel')){label('Boca');turn([[.026,1.1],[.044,1.1],[.046,1.16],[.026,1.16],[.026,1.15],[0,1.15]],coral,0,T);}
  label('Cartucho');put(gcyl(.034,.02,0,-.343,-.06,'y',16),coral);
  mounts=[{parent:group,muzzle:{xs:[0],y:T,z:1.1,r:.036},feed:{x:-.07,y:.2,z:-.05,tilt:.55,neck:.09},size:.7,optic:{kind:'dot',y:.3,z:.2},stock:{y:.22,z:-.13},deco:{y:.18,h:.2,w:.13,z0:-.12,z1:.05}}];
 } else if(weapon==='pdw') {
  // La Pulga: a tiny thumbhole PDW, its clear magazine lying along the top full of paintballs.
  tip=.76;sight=.37;
  frame(.12);
  label('Cuerpo');slab([[-.34,-.1,.04],[-.34,.22,.05],[-.28,.27,.02],[.36,.27,.02],[.44,.2,.04],[.44,.075],[.24,.075],[-.1,.075],[-.14,-.02,.03],[-.2,-.1,.03]],.15,paint,{holes:[[[-.3,-.06,.03],[-.21,-.06,.03],[-.18,.03,.03],[-.29,.05,.03]]]});
  label('Cantonera');slab([[-.34,-.11],[-.37,-.11,.01],[-.37,.23,.01],[-.34,.23]],.155,rubber);
  label('Empuñadura delantera');slab([[.26,.075],[.38,.075],[.36,-.07,.02],[.28,-.07,.02]],.09,dark);
  label('Funda del cañón');turn([[0,.43],[.05,.43],[.052,.45],[.052,.6],[.045,.62],[0,.62]],dark,0,.175);many(ports(0,.175,.48,.58,.052,.05,[-Math.PI/2,Math.PI/2],.011),ink);
  label('Cañón');turn([[0,.6],[.03,.6],[.03,.71],[0,.71]],steel,0,.175);
  if(!has('barrel')){label('Boca');turn([[.022,.705],[.04,.705],[.042,.76],[.022,.76],[.022,.75],[0,.75]],coral,0,.175);}
  if(!has('hopper')){label('Cargador');many(range(-.18,.26,.055).flatMap(z=>[-.024,.024].map(x=>gball(.025,x,.305,z,1,8))),ball);
   put(gbox(.1,.065,.5,0,.305,.04),smoke);many([gbox(.104,.072,.04,0,.305,-.22),gbox(.104,.072,.05,0,.305,.3)],dark);
   if(!has('optic')){label('Miras');many([gbox(.03,.03,.02,0,.352,-.2),gbox(.012,.035,.02,0,.355,.29)],ink);}}
  mounts=[{parent:group,muzzle:{xs:[0],y:.175,z:.71,r:.03},feed:{x:-.085,y:.19,z:-.06,tilt:.55,neck:.09},size:.75,optic:{kind:'dot',y:has('hopper')?.27:.338,z:.02},stock:{y:.2,z:-.37},deco:{y:.17,h:.19,w:.15,z0:.0,z1:.3}}];
 } else if(weapon==='carbine') {
  // La Parrandera: a mil-sim carbine on a rail, its curved magazine has a window onto the balls.
  tip=1.05;sight=.34;
  frame(.12);
  label('Cuerpo');slab([[-.2,.075],[-.2,.25,.03],[-.16,.27,.02],[.42,.27,.02],[.42,.075]],.14,paint);
  label('Tapas de ojo');put(gcyl(.02,.146,0,.2,.1,'x',16),dark);
  label('Palanca de carga');box(.07,.016,.03,steel,0,.28,-.2,.006);
  label('Riel');slab([[-.16,.265],[.82,.265],[.82,.29,.004],[-.16,.29,.004]],.06,dark,{bevel:.004});many(range(-.13,.8,.04).map(z=>gbox(.066,.012,.018,0,.296,z)),dark);
  label('Guardamano');slab([[.42,.085],[.42,.265],[.82,.265,.02],[.82,.085,.03]],.13,dark,{holes:range(0,3,1).map(i=>[[.47+i*.11,.13,.015],[.54+i*.11,.13,.015],[.54+i*.11,.22,.015],[.47+i*.11,.22,.015]])});
  label('Cañón');turn([[0,.4],[.04,.4],[.036,.45],[.034,.93],[0,.93]],steel,0,.175);
  if(!has('barrel')){label('Bocacha');turn([[0,.925],[.042,.925],[.042,1.0],[.03,1.0],[0,1.0]],dark,0,.175);many([-1,1].map(s=>gbox(.01,.04,.04,s*.042,.175,.965)),ink);
   turn([[.028,.995],[.045,.995],[.047,1.05],[.028,1.05],[.028,1.04],[0,1.04]],coral,0,.175);}
  label('Miras');slab([[.74,.29],[.8,.29],[.785,.36,.005],[.755,.36,.005]],.03,dark,{bevel:.004});blob(.007,coral,0,.36,.77);
  if(!has('optic'))box(.04,.04,.04,dark,0,.31,-.1,.008);
  if(!has('hopper'))clip([[.26,.08],[.38,.08],[.41,-.06,.02],[.44,-.22,.03],[.32,-.25,.03],[.29,-.08,.02]],[[.31,.02,.01],[.36,.02,.01],[.39,-.14,.01],[.35,-.17,.01]],[.335,-.005,.37,-.15],4);
  if(!has('stock')){label('Culata');tube(.028,.028,.3,steel,0,.2,-.35);
   slab([[-.32,.24],[-.6,.24,.02],[-.62,.04,.02],[-.56,.04],[-.4,.15,.03],[-.32,.15]],.09,dark);
   slab([[-.6,.245],[-.64,.245,.01],[-.64,.035,.01],[-.6,.035]],.1,rubber);}
  mounts=[{parent:group,muzzle:{xs:[0],y:.175,z:.93,r:.036},feed:{x:-.08,y:.19,z:.02,tilt:.55,neck:.09},size:.82,optic:{kind:'holo',y:.29,z:.05},stock:{y:.21,z:-.2},deco:{y:.17,h:.195,w:.14,z0:-.17,z1:.2}}];
 } else if(weapon==='bullpup') {
  // El Tuqueque: a bullpup, the magazine tucked behind the grip, all body and a short barrel.
  tip=.98;sight=.36;
  frame(.12);
  label('Cuerpo');slab([[-.54,-.06,.03],[-.54,.22,.04],[-.46,.28,.03],[.36,.28,.03],[.46,.2,.05],[.46,.075],[.24,.075],[-.11,.075],[-.15,.0,.03],[-.2,-.06,.02]],.15,paint);
  label('Cantonera');slab([[-.54,-.07],[-.58,-.07,.015],[-.58,.23,.015],[-.54,.23]],.155,rubber);
  label('Carrillera');slab([[-.46,.27],[-.2,.275],[-.2,.3,.01],[-.45,.295,.01]],.1,cream);
  label('Ventana de expulsión');box(.006,.06,.12,ink,.077,.17,-.3,.002);
  label('Riel');slab([[-.15,.275],[.36,.275],[.36,.3,.004],[-.15,.3,.004]],.06,dark,{bevel:.004});many(range(-.12,.34,.04).map(z=>gbox(.066,.012,.018,0,.306,z)),dark);
  label('Miras');box(.012,.04,.02,ink,0,.32,.34,.003);
  label('Empuñadura delantera');slab([[.3,.075],[.4,.075],[.38,-.08,.02],[.31,-.08,.02]],.1,dark);
  label('Cañón');turn([[0,.44],[.034,.44],[.034,.9],[0,.9]],steel,0,.175);
  if(!has('barrel')){label('Bocacha');turn([[0,.895],[.04,.895],[.04,.95],[0,.95]],dark,0,.175);turn([[.026,.945],[.043,.945],[.045,.98],[.026,.98],[.026,.97],[0,.97]],coral,0,.175);}
  if(!has('hopper'))clip([[-.4,-.04],[-.26,-.04],[-.24,-.2,.03],[-.36,-.22,.03]],[[-.36,-.07,.01],[-.29,-.07,.01],[-.28,-.17,.01],[-.35,-.18,.01]],[-.325,-.095,-.317,-.155],2);
  mounts=[{parent:group,muzzle:{xs:[0],y:.175,z:.9,r:.034},feed:{x:-.085,y:.2,z:-.3,tilt:.55,neck:.09},size:.8,optic:{kind:'holo',y:.3,z:.02},stock:{y:.2,z:-.58},deco:{y:.17,h:.19,w:.15,z0:.0,z1:.3}}];
 } else if(weapon==='marksman') {
  // El Zamuro: a heavy marksman rifle that perches on its bipod and waits. Fluted barrel, big brake.
  tip=1.95;sight=.42;
  frame(.12);
  label('Cuerpo');slab([[-.22,.075],[-.22,.25,.03],[-.18,.27,.02],[.62,.27,.02],[.62,.075]],.15,paint);
  label('Riel');slab([[-.18,.27],[.95,.27],[.95,.295,.004],[-.18,.295,.004]],.06,dark,{bevel:.004});many(range(-.15,.93,.04).map(z=>gbox(.066,.012,.018,0,.3,z)),dark);
  label('Guardamano');slab([[.62,.08],[.62,.27],[1.12,.27,.02],[1.12,.08,.03]],.14,dark,{holes:range(0,3,1).map(i=>[[.68+i*.13,.12,.015],[.77+i*.13,.12,.015],[.77+i*.13,.22,.015],[.68+i*.13,.22,.015]])});
  label('Cañón');turn([[0,.6],[.05,.6],[.046,.66],[.044,1.75],[0,1.75]],steel,0,.175);
  many([0,Math.PI/2,Math.PI,-Math.PI/2].map(a=>gbox(.012,.012,.5,Math.sin(a)*.044,.175+Math.cos(a)*.044,1.4,0,0,-a)),ink);
  if(!has('barrel')){label('Freno de boca');turn([[0,1.73],[.07,1.73],[.072,1.76],[.072,1.92],[.05,1.95],[.03,1.95],[0,1.94]],dark,0,.175);
   many([-1,1].flatMap(s=>[1.79,1.84,1.89].map(z=>gbox(.012,.08,.03,s*.072,.175,z))),ink);put(gcyl(.075,.02,0,.175,1.75,'z',24),coral);}
  label('Mira telescópica');for(const z of [.05,.45]){box(.06,.08,.05,dark,0,.335,z,.01);put(new THREE.TorusGeometry(.061,.012,8,24).translate(0,sight,z),dark);}
  turn([[0,-.22],[.06,-.22],[.072,-.19],[.072,-.08],[.052,-.04],[.052,.58],[.1,.72],[.105,.95],[0,.95]],ink,0,sight,32);
  put(gcyl(.095,.01,0,sight,.951,'z',28),lens());put(gcyl(.056,.006,0,sight,-.221,'z',24),mat('#1b4a5a',{roughness:.1,metalness:.4}));
  post(.026,.026,.05,ink,0,sight+.075,.25);post(.028,.028,.012,cream,0,sight+.104,.25);put(gcyl(.11,.02,0,sight,.88,'z',28),cream);
  label('Bípode');box(.1,.04,.06,dark,0,.06,1.05,.01);for(const s of [-1,1])hose([[s*.03,.05,1.05],[s*.08,-.2,1.1],[s*.14,-.45,1.15],[s*.16,-.55,1.17]],.014,steel);
  many([-1,1].map(s=>gball(.026,s*.16,-.57,1.17,1,10)),rubber);
  if(!has('stock')){label('Culata');slab([[-.2,.27],[-.62,.27,.02],[-.66,.3,.02],[-.74,.3,.02],[-.76,-.06,.02],[-.68,-.08,.02],[-.5,.02,.03],[-.3,.08,.03],[-.2,.08]],.08,dark,{holes:[[[-.32,.13,.03],[-.56,.14,.03],[-.6,.22,.03],[-.32,.22,.03]]]});
   slab([[-.4,.27],[-.62,.27],[-.62,.31,.015],[-.4,.31,.015]],.07,cream);slab([[-.74,.31],[-.78,.31,.01],[-.79,-.07,.01],[-.75,-.07]],.1,rubber);}
  if(!has('hopper'))clip([[.26,.08],[.4,.08],[.4,-.14,.02],[.27,-.14,.02]],[[.3,.03,.01],[.36,.03,.01],[.36,-.1,.01],[.3,-.1,.01]],[.33,.0,.33,-.07],2);
  mounts=[{parent:group,muzzle:{xs:[0],y:.175,z:1.73,r:.046},feed:{x:-.085,y:.19,z:.3,tilt:.55,neck:.1},size:.85,optic:{kind:'dot',x:.075,arm:.11,y:.25,z:.25},stock:{y:.22,z:-.22},deco:{y:.17,h:.195,w:.15,z0:.38,z1:.6}}];
 } else if(weapon==='lmg') {
  // La Culebrona: a belt-fed machine marker. The "snake" is a belt of paintballs from the ammo box.
  tip=1.5;sight=.41;
  frame(.13);
  label('Cuerpo');slab([[-.22,.075],[-.22,.3,.03],[-.17,.33,.03],[.55,.33,.03],[.6,.28,.03],[.6,.075]],.17,paint);
  label('Tapa de alimentación');slab([[-.05,.33],[.4,.33],[.4,.36,.01],[-.02,.36,.01]],.15,dark,{bevel:.006});put(gcyl(.012,.16,0,.345,-.05,'x',10),steel);
  label('Funda del cañón');turn([[0,.58],[.065,.58],[.068,.6],[.068,1.2],[.06,1.22],[0,1.22]],dark,0,.2);many(ports(0,.2,.66,1.14,.068,.06,[0,-1.2,1.2,-Math.PI/2,Math.PI/2],.013),ink);
  label('Cañón');turn([[0,1.2],[.04,1.2],[.038,1.42],[0,1.42]],steel,0,.2);
  if(!has('barrel')){label('Bocacha');turn([[0,1.415],[.05,1.415],[.05,1.47],[.035,1.47],[0,1.46]],dark,0,.2);put(gcyl(.053,.03,0,.2,1.485,'z',20),coral);}
  label('Asa');slab([[.7,.26],[.7,.37,.03],[.95,.37,.03],[.95,.26],[.9,.26],[.9,.325,.015],[.75,.325,.015],[.75,.26]],.04,dark,{bevel:.006});
  label('Bípode');box(.1,.035,.05,dark,0,.12,1.12,.008);many([-.04,.04].map(x=>gcyl(.012,.36,x,.12,.93,'z',10)),steel);many([-.04,.04].map(x=>gball(.017,x,.12,.74)),rubber);
  if(!has('optic')){label('Miras');box(.04,.05,.03,dark,0,.385,.0,.006);}box(.012,.06,.02,dark,0,.29,1.18,.003);
  if(!has('stock')){label('Culata');slab([[-.2,.3],[-.66,.27,.02],[-.68,.27],[-.68,.04],[-.62,.04],[-.36,.13,.04],[-.2,.12]],.1,dark);
   slab([[-.68,.275],[-.72,.275,.01],[-.72,.035,.01],[-.68,.035]],.11,rubber);}
  if(!has('hopper')){
   label('Caja de munición');const olive=mat('#5a6b4a',{roughness:.7});box(.16,.2,.24,olive,-.02,-.04,.42,.02);box(.004,.03,.2,cream,-.101,-.04,.42,.002);box(.03,.03,.04,coral,-.02,-.15,.42,.006);
   label('Cinta de bolas');const belt=new THREE.CatmullRomCurve3([[-.08,.06,.42],[-.17,.1,.38],[-.19,.19,.3],[-.15,.28,.22],[-.095,.315,.17]].map(v=>new THREE.Vector3(...v)));
   const pts=belt.getSpacedPoints(Math.floor(belt.getLength()/.064));many(pts.map(p=>gball(.03,p.x,p.y,p.z,1,8)),ball);
   many(pts.slice(0,-1).map((p,i)=>{const q=pts[i+1],g=new THREE.BoxGeometry(.012,.07,.012);g.translate((p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2);return g;}),steel);
   box(.03,.06,.09,dark,-.09,.31,.17,.008);}
  mounts=[{parent:group,muzzle:{xs:[0],y:.2,z:1.42,r:.04},feed:{x:-.095,y:.22,z:.15,tilt:.55,neck:.09},size:.95,optic:{kind:'dot',y:.36,z:.0},stock:{y:.24,z:-.22},deco:{y:.2,h:.255,w:.17,z0:-.18,z1:.05}}];

 } else if(weapon==='bat') {
  // El Bate: a wooden bat with its head dipped in paint, uneven edge and all.
  tip=.865;
  label('Bate');turnY([[0,-.22],[.045,-.22],[.05,-.205],[.045,-.185],[.024,-.17],[.024,.2],[.032,.35],[.05,.52],[.06,.62],[.062,.8],[.055,.845],[.03,.862],[0,.865]],wood,0,0,32);
  label('Pintura');turnY([[.0615,.62],[.0635,.8],[.0565,.846],[.031,.864],[0,.868]],paint,0,0,32);
  many(ring(.62,.06,11,.3).map(([x,y,z],i)=>{const g=new THREE.SphereGeometry(.014,8,6);g.scale(1,1.6+(i%3)*.5,1);g.translate(x*1.02,y-.004-(i%3)*.006,z*1.02);return g;}),paint);
  label('Pomo');put(gcyl(.047,.01,0,-.2,0,'y',28),cream);
  label('Etiqueta');put(gcyl(.0395,.05,0,.43,0,'y',28),cream);
  meleeSpec={grip:{y0:-.165,y1:.17,r:.024},drip:ring(.62,.063,7,.6),pommel:{y:-.222},hit:{y:.72,r:.08},
   deco:{axis:'y',x:0,z:0,y0:.47,y1:.6,rAt:y=>y<.52?.032+(y-.35)/.17*.018:.05+(y-.52)/.1*.01}};
  charmAt={y:-.235,z:0};
 } else if(weapon==='sandal') {
  // La Chancleta: a giant flip-flop held by the heel. Painted footbed and strap face +Z,
  // the dark rubber sole is the back (-Z): swing it either way.
  tip=.41;
  const foot=[[-.055,-.065,.05],[.055,-.065,.05],[.07,.12,.06],[.088,.28,.06],[.062,.395,.06],[-.04,.405,.07],[-.088,.28,.06],[-.066,.12,.05]];
  const layer=(depth,m,z,grow=0)=>{const sh=new THREE.Shape(),n=foot.length;
   foot.forEach(([x,y,r],i)=>{const [px,py]=foot[(i+n-1)%n],[nx,ny]=foot[(i+1)%n],d1=Math.hypot(px-x,py-y),d2=Math.hypot(nx-x,ny-y),k=Math.min(r,d1/2,d2/2);
    const ax=x+(px-x)/d1*k,ay=y+(py-y)/d1*k;i?sh.lineTo(ax,ay):sh.moveTo(ax,ay);sh.quadraticCurveTo(x,y,x+(nx-x)/d2*k,y+(ny-y)/d2*k);});
   const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:true,bevelThickness:.004,bevelSize:.004+grow,bevelSegments:2,curveSegments:6});g.translate(0,0,z);return put(g,m);};
  label('Suela');layer(.026,dark,-.03);
  label('Plantilla');layer(.012,paint,-.002,-.001);
  label('Huella');many([.0,.05,.1,.15,.2,.25,.3,.35].flatMap((y,i)=>[-1,1].map(s=>gbox(.05,.005,.003,s*.03,y+.005*s,-.0355,0,0,s*(i%2?.45:-.45)))),rubber);
  label('Tira');for(const s of [-1,1])hose([[-.01,.3,.016],[s*.012-.01,.292,.048],[s*.05,.24,.058],[s*.078,.16,.03],[s*.082,.14,.012]],.012,cream);
  put(gcyl(.013,.022,-.01,.3,.02,'z',12),cream);many([-1,1].map(s=>gcyl(.014,.012,s*.082,.14,.012,'z',12)),cream);
  meleeSpec={grip:{bands:[[-.02,.135,.05],[.03,.142,.05]],z:-.01},drip:[[-.06,.35,.016],[-.025,.37,.017],[.015,.375,.017],[.05,.355,.016],[.07,.31,.016]],pommel:{y:-.07,z:-.01},hit:{y:.2,r:.2},
   deco:{face:true,z:.016,y0:.0,y1:.13,w:.1}};
  charmAt={y:-.085,z:-.01};
 } else if(weapon==='roller') {
  // El Rodillo: a paint roller on a short pole, its fuzzy sleeve soaked in paint.
  tip=.85;
  label('Mango');turnY([[0,-.21],[.034,-.21],[.036,-.19],[.03,-.17],[.032,-.05],[.034,.06],[.028,.1],[.016,.13],[0,.13]],rubber,0,0,24);
  many(range(-.15,.04,.038).map(y=>gcyl(.0345,.008,0,y,0,'y',20)),ink);
  label('Vara');put(gcyl(.018,.34,0,.29,0,'y',14),wood);put(gcyl(.022,.03,0,.125,0,'y',14),steel);
  label('Armazón');hose([[0,.45,0],[0,.6,0],[-.04,.665,0],[-.15,.69,0],[-.185,.74,0],[-.19,.78,0]],.009,steel);put(gcyl(.016,.04,0,.45,0,'y',12),steel);
  label('Rodillo');put(gcyl(.066,.3,0,.78,0,'x',32),mat(color,{roughness:.95}));
  many(range(-.12,.12,.03).map(x=>gcyl(.0675,.006,x,.78,0,'x',32)),paint);
  label('Tapas');many([-1,1].map(s=>gcyl(.046,.016,s*.157,.78,0,'x',20)),dark);put(gcyl(.008,.34,0,.78,0,'x',8),steel);
  meleeSpec={grip:{y0:-.165,y1:.09,r:.033},drip:range(-.12,.12,.06).map((x,i)=>[x,.716,(i%2?.012:-.012)]),pommel:{y:-.212},hit:{y:.78,r:.17},
   deco:{axis:'y',x:0,z:0,y0:.18,y1:.42,r:.018}};
  charmAt={y:-.225,z:0};
 } else if(weapon==='brush') {
  // La Brocha: a giant flat paintbrush, bristles dipped, a hole in the handle for hanging.
  tip=.57;
  label('Mango');turnY([[0,-.27],[.022,-.27],[.03,-.245],[.03,-.2],[.024,-.12],[.026,.05],[.034,.15],[.04,.225],[0,.225]],wood,0,0,24);
  put(gcyl(.009,.064,0,-.235,0,'z',12),ink);
  label('Virola');box(.21,.11,.062,steel,0,.275,0,.018);many([.245,.305].map(y=>gbox(.214,.008,.066,0,y,0)),dark);
  label('Cerdas');slab([[-.1,.33],[.1,.33],[.105,.48],[-.105,.48]],.05,mat('#d9c7a1',{roughness:.9}),{bevel:.006}).rotation.y=-Math.PI/2;
  label('Pintura');slab([[-.106,.47],[.106,.47],[.09,.565,.012],[-.09,.565,.012]],.055,paint,{bevel:.008}).rotation.y=-Math.PI/2;
  label('Cerdas');many(range(-.08,.08,.02).map(x=>gbox(.003,.13,.054,x,.405,0)),woodDark);
  meleeSpec={grip:{y0:-.19,y1:.08,r:.026},drip:range(-.08,.08,.04).flatMap(x=>[[x,.475,.029],[x+.02,.475,-.029]]),pommel:{y:-.272},hit:{y:.48,r:.15},
   deco:{axis:'y',x:0,z:0,y0:-.1,y1:.12,r:.026}};
  charmAt={y:-.25,z:0};
 } else if(weapon==='bucket') {
  // El Tobo: a paint bucket on a chain, caught mid-swing: bottom out, mouth back towards you,
  // the paint held in by the spin.
  tip=.86;
  label('Mango');turnY([[0,-.23],[.04,-.23],[.042,-.2],[.03,-.17],[.03,.12],[.036,.14],[.036,.16],[0,.16]],wood,0,0,24);
  label('Cadena');put(new THREE.TorusGeometry(.02,.006,8,16).rotateY(Math.PI/2).translate(0,.183,0),steel);
  many(range(0,7,1).map(i=>{const g=new THREE.TorusGeometry(.016,.0045,6,14);g.scale(1,1.4,1);if(i%2)g.rotateY(Math.PI/2);g.translate(0,.225+i*.036,0);return g;}),steel);
  label('Asa');const bail=new THREE.TorusGeometry(.124,.006,6,28,Math.PI);bail.rotateZ(Math.PI);bail.translate(0,.62,0);put(bail,steel);many([-1,1].map(s=>gball(.012,s*.124,.62,0)),steel);
  label('Tobo');turnY([[.112,.625],[.124,.62],[.128,.635],[.106,.855],[.09,.862],[0,.862]],paint,0,0,36);
  turnY([[0,.85],[.1,.85],[.119,.628]],dark,0,0,36);
  put(gcyl(.115,.005,0,.645,0,'y',32),mat(color,{roughness:.15,metalness:.1}));
  many([.7,.8].map(y=>gcyl(.128-(y-.62)*.1,.016,0,y,0,'y',36)),cream);
  meleeSpec={grip:{y0:-.165,y1:.11,r:.03},drip:ring(.62,.118,8,.2),pommel:{y:-.232},hit:{y:.74,r:.16},
   deco:{axis:'y',x:0,z:0,y0:.66,y1:.84,rAt:y=>.128-(y-.62)*.1}};
  charmAt={y:-.245,z:0};
 } else if(weapon==='maraca') {
  // La Maraca: an oversized joropo maraca, painted gourd on a turned handle.
  tip=.555;
  label('Mango');turnY([[0,-.24],[.03,-.24],[.034,-.22],[.024,-.19],[.022,.1],[.03,.16],[.045,.2],[.045,.24],[0,.24]],wood,0,0,24);
  label('Cabeza');blob(.14,paint,0,.36,0,1,1.2,1,32);
  const eq=new THREE.TorusGeometry(.141,.01,8,40);eq.rotateX(Math.PI/2);eq.translate(0,.36,0);put(eq,cream);
  many(range(0,11,1).map(i=>{const a=i/12*Math.PI*2;return gball(.011,Math.sin(a)*.141,.36+(i%2?.032:-.032),Math.cos(a)*.141,1,8);}),coral);
  label('Remate');turnY([[0,.52],[.03,.52],[.026,.545],[.012,.556],[0,.556]],wood,0,0,18);
  const rAt=y=>.14*Math.sqrt(Math.max(0,1-((y-.36)/.168)**2));
  meleeSpec={grip:{y0:-.185,y1:.08,r:.023},drip:ring(.29,rAt(.29),8,.1).map(([x,y,z])=>[x*1.04,y,z*1.04]),pommel:{y:-.242},hit:{y:.36,r:.15},
   deco:{axis:'y',x:0,z:0,y0:.4,y1:.47,rAt}};
  charmAt={y:-.255,z:0};
 } else throw new Error('Marcadora desconocida: '+weapon);

 for(const m of mounts) within(m.parent,()=>{
  if(has('barrel'))tip=Math.max(tip,tune(m.muzzle));
  if(has('hopper'))feeder(m.feed,m.size);
  if(has('optic')&&m.optic){const r=optic(m.optic);optic_=m.optic.kind;if(r){sight=r.y;sightX=r.x;}}
  if(has('stock'))m.rods?rods(m.rods):skeleton(m.stock);
  decorate(m.deco);
 });
 if(meleeSpec){const M=meleeSpec;
  if(has('tape'))tapeWrap(M.grip);
  if(has('drip'))drips(M.drip);
  if(has('strap')){lanyard(M.pommel);if(charmAt)charmAt={...charmAt,x:.045};}
  decorate(M.deco);
  group.userData.hit=M.hit;}
 group.userData.kind=meleeSpec?'melee':'marker';group.userData.class=classOf(weapon)?.id;
 trinket(weapon==='rapid'?group.userData.hands[1]:group,charmAt);
 group.userData.tip=tip;group.userData.sight=sight;group.userData.sightX=sightX;
 // La Lejana and La China draw their Mira in their own branch (no `optic` mount entry).
 if(has('optic')&&!optic_&&PAINT_OPTICS[weapon])optic_=PAINT_OPTICS[weapon];
 group.userData.optic=optic_;group.userData.bore=mounts[0]?.muzzle.y??null;
 group.name=PAINT_WEAPONS[weapon]||PAINT_MELEE[weapon];
 // Camo goes on the painted body: matte it down a little so the pattern reads.
 const camoSpec=resolveCamo(camo);
 if(camoSpec){paint.roughness=.6;paint.metalness=.05;applyCamo(paint,camoSpec);bakeCamo(group,paint);group.userData.camo=camoSpec;}
 group.userData.dispose=dispose;return group;
}
// The same marker batched into a few draws (one per surface finish instead of
// one per part), for scenes that show several held at once in third person.
// Same shapes and colours (finishes folded to matte, glossy and metal) and the same
// `userData.tip`/`sight`/`sightX`/`optic`, plus `bore`;
// geometry is new and owned, so clones (`.clone()`) share it. A camo body keeps
// its shader and its `camoPos` attribute through the batch. `userData.dispose` frees it.
export function bakePaintKit(options={}) {
 const kit=createPaintKit(options), u=kit.userData;
 // Held at a distance a dozen finishes read as three: matte, glossy and metal. Folding
 // them first makes each finish one draw (a camo body, lenses and glass keep their own).
 const folded=new Set();
 kit.traverse(o=>{const m=o.material;if(!o.isMesh||!m?.isMeshStandardMaterial||m.transparent||m.userData.camo||folded.has(m))return;folded.add(m);
  if(m.metalness>=.5)Object.assign(m,{metalness:.7,roughness:.3});else Object.assign(m,m.roughness<.45?{metalness:.15,roughness:.38}:{metalness:0,roughness:.65});});
 const out=bake(kit,{tint:true});
 out.name=kit.name; Object.assign(out.userData,{tip:u.tip,sight:u.sight,sightX:u.sightX,optic:u.optic,class:u.class,kind:u.kind,camo:u.camo,bore:u.bore??PAINT_KIT_BORE[options.weapon]??PAINT_KIT_BORE.pistol});
 const tinted=out.userData.tinted;
 out.userData.dispose=()=>{out.traverse(o=>{if(o.isMesh)o.geometry.dispose();});tinted.forEach(m=>m.dispose());u.dispose();};
 return out;
}
// Pepazo's paint grenade, about 30 cm tall so it reads mid-flight: a round body in
// the thrower's colour with a cream band, a dark cap, the spoon lever down one side,
// the pin's ring and a small fuse lamp on top. `userData.light` is that lamp's
// material: raise its emissiveIntensity to blink it.
export function createPaintGrenade({color='#f28b42'}={}) {
 const group=new THREE.Group(),{mat,put,label,box,blob,dispose}=parts(group);
 const paint=mat(color,{roughness:.35}),cream=mat('#f8e9c9'),dark=mat('#344847',{roughness:.55}),steel=mat('#a9bfc0',{metalness:.6,roughness:.3});
 const lamp=mat('#ff4b4b',{emissive:'#ff2a1a',emissiveIntensity:0});
 label('Cuerpo');blob(.11,paint,0,0,0,1,1.12,1);
 label('Banda');const band=new THREE.TorusGeometry(.111,.02,8,28);band.rotateX(Math.PI/2);put(band,cream);
 label('Aros');for(const y of [-.06,.06]){const ring=new THREE.TorusGeometry(.094,.008,6,24);ring.rotateX(Math.PI/2);put(ring,dark,0,y,0);}
 label('Tapa');put(new THREE.CylinderGeometry(.045,.05,.05,14),dark,0,.135,0);
 put(new THREE.CylinderGeometry(.022,.022,.02,10),steel,0,.168,0);
 label('Luz');put(new THREE.SphereGeometry(.018,10,8),lamp,0,.182,0);
 label('Palanca');const lever=box(.034,.15,.012,steel,.072,.08,0,.004);lever.rotation.z=-.42;
 label('Anilla');const pin=new THREE.TorusGeometry(.03,.006,6,16);pin.rotateY(Math.PI/2);put(pin,steel,-.075,.14,0);
 group.name='Granada de pintura';
 group.userData.light=lamp; group.userData.dispose=dispose; return group;
}
// La Bazuca's rocket in flight: painted body, coral warhead with a cream fuse, four fins
// and a glowing motor at the back. Centred, +Z is the nose; about 0.75 m long.
export function createPaintRocket({color='#f28b42'}={}) {
 const group=new THREE.Group(),{mat,put,label,turn,gcyl,many,dispose}=parts(group);
 const paint=mat(color,{metalness:.25,roughness:.36}),coral=mat('#ff4b4b'),cream=mat('#f8e9c9'),dark=mat('#2f3d3c',{roughness:.55});
 label('Cuerpo');turn([[0,-.21],[.075,-.21],[.075,.2],[0,.2]],paint,0,0,20);
 label('Ojiva');turn([[0,.19],[.075,.19],[.078,.25],[.06,.33],[.03,.37],[0,.38]],coral,0,0,20);
 label('Espoleta');turn([[0,.37],[.026,.37],[.012,.42],[0,.425]],cream,0,0,12);
 put(gcyl(.079,.04,0,0,.12,'z',20),cream);
 label('Motor');turn([[.04,-.31],[.065,-.31],[.08,-.21],[0,-.2]],dark,0,0,20);
 label('Aletas');const fins=[];for(let i=0;i<4;i++){const g=new THREE.BoxGeometry(.012,.12,.14);g.translate(0,.1,-.17);g.rotateZ(i*Math.PI/2);fins.push(g);}many(fins,dark);
 label('Llama');const flame=new THREE.ConeGeometry(.055,.2,12,1,true);flame.rotateX(-Math.PI/2);flame.translate(0,0,-.4);
 put(flame,mat('#ffb347',{emissive:'#ff7a1a',emissiveIntensity:2.5,transparent:true,opacity:.85,side:THREE.DoubleSide}));
 group.name='Cohete de La Bazuca';
 group.userData.dispose=dispose;return group;
}
export function createPaintVest() {
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:'#344847',roughness:.85}),geometry=new THREE.BoxGeometry(.58,.55,.13);
 for(const z of [-.2,.2]) {const pad=new THREE.Mesh(geometry,material);pad.position.set(0,1.08,z);group.add(pad);}
 for(const x of [-.18,.18]) {const pad=new THREE.Mesh(geometry,material);pad.scale.set(.3,.6,1.2);pad.position.set(x,1.06,.29);group.add(pad);}
 group.name='El Acolchado'; group.userData.dispose=()=>{geometry.dispose();material.dispose();};return group;
}
