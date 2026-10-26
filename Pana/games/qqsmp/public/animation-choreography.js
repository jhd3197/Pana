// Choreography adapted from the user's quiz workbench, rendered on real avatars.
import * as THREE from 'three';
import { rng, hash2, clamp as clamp01, smoothstep as smooth, lerp } from '/engine/random.js';
import { makeMango } from '/engine/models/props/mango.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { VARIANTS } from './animation-catalog.js';
import { loc } from '/engine/i18n.js';

export function createQuizChoreography(parent, host, slots, onCue = () => {}) {
const scene=new THREE.Group();scene.name='Quiz comedy props';scene.visible=false;parent.add(scene);
const colors=['#ff4b4b','#2ad1b2','#ffc629','#3d7bf2','#ff8a1f','#8e4de8'],SC=1;
let cast=[],C,N,selected=0,neighbor=-1,action='think',curVar='classic',progress=0,duration=4;
const HOST={pos:host.group.position.clone(),ry:host.group.rotation.y};
let cueKey='',previousProgress=0,cuesEnabled=false;
const cue=(name,at)=>{if(cuesEnabled&&at>previousProgress&&at<=progress)onCue(name);};
const mic=new THREE.Group();
const micHandle=new THREE.Mesh(new THREE.CylinderGeometry(.06,.04,.42,12),new THREE.MeshStandardMaterial({color:'#202028',metalness:.6}));
const micHead=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),new THREE.MeshStandardMaterial({color:'#9aa0a8',metalness:.8,roughness:.35}));
micHead.position.y=.3;mic.add(micHandle,micHead);mic.position.set(0,-.86,.05);mic.rotation.x=-.4;host.armR.add(mic);
const buzzers=slots.map((slot,i)=>{
 const b=new THREE.Group(),m=new THREE.MeshPhysicalMaterial({color:colors[i],roughness:.25,clearcoat:1,emissive:colors[i],emissiveIntensity:.25});
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.05,16),new THREE.MeshStandardMaterial({color:'#222',metalness:.5}));b.add(base);
 const dome=new THREE.Mesh(new THREE.SphereGeometry(.11,16,10,0,Math.PI*2,0,Math.PI/2),m);dome.position.y=.02;b.add(dome);
 b.position.set(.35,1.09,.5);slot.podium.userData.top.add(b);return {b,dome,m};
});
const buzzerMat=buzzers.map(b=>b.m);
const V3=THREE.Vector3;
// ---------- helpers ----------
const easeOut=x=>1-Math.pow(1-clamp01(x),3),easeIn=x=>{x=clamp01(x);return x*x*x;};
const elasticOut=x=>{x=clamp01(x);return x===0?0:x===1?1:Math.pow(2,-10*x)*Math.sin((x*10-.75)*2*Math.PI/3)+1;},backOut=x=>{x=clamp01(x);const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
const pulse=(t,a,b,c)=>t<b?smooth((t-a)/(b-a)):1-smooth((t-b)/(c-b)),hsh=n=>hash2(n,1);
const rnd=rng(5);
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const soft=canvasTex(64,64,(x,w)=>{const g=x.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,w);});
const starTex=canvasTex(128,128,(x)=>{x.beginPath();for(let i=0;i<10;i++){const r=i%2?24:56,a=-Math.PI/2+i*Math.PI/5;x.lineTo(64+Math.cos(a)*r,66+Math.sin(a)*r);}x.closePath();x.lineJoin='round';x.lineWidth=9;x.strokeStyle='#2b2030';x.stroke();x.fillStyle='#fff';x.fill();});
const heartTex=canvasTex(128,128,(x)=>{x.beginPath();x.moveTo(64,110);x.bezierCurveTo(10,70,10,20,40,20);x.bezierCurveTo(55,20,64,32,64,40);x.bezierCurveTo(64,32,73,20,88,20);x.bezierCurveTo(118,20,118,70,64,110);x.lineWidth=9;x.strokeStyle='#2b2030';x.stroke();x.fillStyle='#fff';x.fill();});
const flashTex=canvasTex(256,256,(x)=>{x.beginPath();for(let i=0;i<28;i++){const r=i%2?50+rnd()*20:105+rnd()*20,a=i*Math.PI/14;x.lineTo(128+Math.cos(a)*r,128+Math.sin(a)*r);}x.closePath();x.fillStyle='#fff6c9';x.fill();x.lineWidth=6;x.strokeStyle='#ffd23f';x.stroke();});
const texCache=new Map();
function textTex(str,fill){const key=str+fill;if(texCache.has(key))return texCache.get(key);const t=canvasTex(512,256,(x)=>{let fs=150;const font=s=>`900 ${s}px "Luckiest Guy",Nunito,"Arial Black","Segoe UI",system-ui,sans-serif`;x.font=font(fs);const w=x.measureText(str).width;if(w>440){fs*=440/w;x.font=font(fs);}x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';x.lineWidth=28;x.strokeStyle='rgba(20,10,40,.35)';x.strokeText(str,264,142);x.lineWidth=22;x.strokeStyle='#1b1033';x.strokeText(str,256,128);x.fillStyle=fill;x.fillText(str,256,128);x.save();x.beginPath();x.rect(0,0,512,116);x.clip();x.fillStyle='rgba(255,255,255,.3)';x.fillText(str,256,128);x.restore();});t.name=str;texCache.set(key,t);return t;}

const std=(c,r=.5,e={})=>new THREE.MeshStandardMaterial({color:c,roughness:r,...e});
const goldMango=makeMango({gold:true});goldMango.scale.setScalar(.65);scene.add(goldMango);
const mangoRain=Array.from({length:22},()=>{const m=makeMango({});m.scale.setScalar(.5);m.visible=false;scene.add(m);return m;});
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.9,1.4,12,32,1,true),new THREE.MeshBasicMaterial({color:'#ffd84a',transparent:true,opacity:.0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));scene.add(beam);
const disco=new THREE.Mesh(new THREE.IcosahedronGeometry(.7,2),new THREE.MeshStandardMaterial({color:'#dfe6f2',metalness:.35,roughness:.2,flatShading:true,emissive:'#6a7088',emissiveIntensity:.6}));disco.visible=false;scene.add(disco);
const phone=new THREE.Group();{const red=new THREE.MeshPhysicalMaterial({color:'#e8323c',roughness:.3,clearcoat:1});const b=new THREE.Mesh(new THREE.BoxGeometry(.42,.16,.34),red);phone.add(b);const dial=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.03,20),std('#fff6e2'));dial.position.set(0,.09,.03);phone.add(dial);phone.visible=false;scene.add(phone);}
const handset=new THREE.Group();{const red=new THREE.MeshPhysicalMaterial({color:'#e8323c',roughness:.3,clearcoat:1});const bar=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.42,10),red);handset.add(bar);for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.07,12,8),red);e.scale.set(1,.7,1);e.position.y=s*.21;handset.add(e);}handset.visible=false;scene.add(handset);}
const card=new THREE.Mesh(new THREE.PlaneGeometry(.32,.45),std('#e8212f',.4,{side:THREE.DoubleSide}));card.visible=false;scene.add(card);
const fanCards=new THREE.Mesh(new THREE.PlaneGeometry(.55,.38),std('#fff6e2',.6,{side:THREE.DoubleSide}));fanCards.visible=false;scene.add(fanCards);
const hole=new THREE.Mesh(new THREE.CircleGeometry(.85,32),new THREE.MeshBasicMaterial({color:'#05030a'}));hole.rotation.x=-Math.PI/2;hole.visible=false;scene.add(hole);
class Helix extends THREE.Curve{getPoint(u,o=new V3()){return o.set(Math.cos(u*Math.PI*12)*.22,u*.6,Math.sin(u*Math.PI*12)*.22);}}
const spring=new THREE.Mesh(new THREE.TubeGeometry(new Helix(),160,.03,6),new THREE.MeshPhysicalMaterial({color:'#c9d3de',metalness:.8,roughness:.25,clearcoat:1}));spring.visible=false;scene.add(spring);
const tumble=new THREE.Mesh(new THREE.IcosahedronGeometry(.35,1),new THREE.MeshBasicMaterial({color:'#b08a52',wireframe:true}));tumble.visible=false;scene.add(tumble);
const shades=new THREE.Group();{const m=std('#111',.2,{metalness:.6});for(const s of [-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.03),m);l.position.x=s*.14;shades.add(l);}const br=new THREE.Mesh(new THREE.BoxGeometry(.08,.025,.02),m);shades.add(br);shades.visible=false;scene.add(shades);}
const cloud=new THREE.Group();{const m=std('#7d7690',.9);[[0,0,0,.3],[.28,-.04,0,.22],[-.28,-.03,0,.23],[.1,.14,0,.2]].forEach(([x,y,z,r])=>{const s=new THREE.Mesh(new THREE.SphereGeometry(r,16,10),m);s.position.set(x,y,z);cloud.add(s);});cloud.visible=false;scene.add(cloud);}
const fx=(()=>{const root=new THREE.Group();scene.add(root);let on=true;const pools=[];
 function pool(n,make){const p={items:[],i:0};for(let k=0;k<n;k++){const o=make(k);o.visible=false;root.add(o);p.items.push(o);}pools.push(p);return ()=>{if(!on||p.i>=n)return null;const o=p.items[p.i++];o.visible=true;return o;};}
 const sprite=(map,o={})=>new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,...o}));
 const palette=[...colors,'#ffffff','#ff8fd0','#8dff8a'],confGeo=new THREE.PlaneGeometry(.09,.16);
 const takeDust=pool(200,()=>sprite(soft)),takeStar=pool(120,()=>sprite(starTex)),takeHeart=pool(30,()=>sprite(heartTex)),takeFlash=pool(4,()=>{const s=sprite(flashTex,{depthTest:false});s.renderOrder=9;return s;});
 const takeConf=pool(260,k=>new THREE.Mesh(confGeo,new THREE.MeshStandardMaterial({color:palette[k%palette.length],side:THREE.DoubleSide,roughness:.4,emissive:palette[k%palette.length],emissiveIntensity:.25})));
 const takeLabel=pool(20,()=>{const s=sprite(null,{depthTest:false,fog:false});s.renderOrder=10;return s;});
 const api={begin(e){on=e;pools.forEach(p=>p.i=0);},end(){pools.forEach(p=>{for(let k=p.i;k<p.items.length;k++)p.items[k].visible=false;});},
  puff(p,size,opacity,color='#fffaf0'){const s=takeDust();if(!s)return;s.position.copy(p);s.scale.setScalar(size);s.material.opacity=opacity;s.material.color.set(color);},
  dust(p,age,o={}){const life=o.life??.6;if(age<0||age>=life)return;const n=o.count??8,q=age/life,e=1-Math.pow(1-q,3),seed=o.seed??0;for(let k=0;k<n;k++){const r=hsh(seed+k*5.3),a=k/n*Math.PI*2+r,rad=(o.spread??.6)*e*(.7+.5*r);api.puff(new V3(p.x+Math.cos(a)*rad,p.y+.05+e*.25*(.5+r),p.z+Math.sin(a)*rad),(o.size??.3)*(.5+e*.9),(1-q)*.8,o.color??'#e8def5');}},
  burst(p,age,o={}){const life=o.life??.75;if(age<0||age>=life)return;const n=o.count??10,q=age/life,e=1-Math.pow(1-q,2.5),seed=o.seed??0,take=o.hearts?takeHeart:takeStar;for(let k=0;k<n;k++){const s=take();if(!s)return;const r=hsh(seed+k*9.1),r2=hsh(seed+k*2.7),a=k/n*Math.PI*2+r*.4,el=-.3+r2*1.6,rad=(o.radius??1)*e;s.position.set(p.x+Math.cos(a)*Math.cos(el)*rad,p.y+Math.sin(el)*rad-q*q*.4,p.z+Math.sin(a)*Math.cos(el)*rad);s.scale.setScalar((o.size??.22)*(q<.12?q/.12:1-(q-.12)*.85));s.material.rotation=o.hearts?0:age*6+k;s.material.opacity=1-q*q;s.material.color.set(o.color??(o.multi?palette[k%palette.length]:'#ffd23f'));}},
  star(p,size,rot,opacity,color='#ffd23f'){const s=takeStar();if(!s)return;s.position.copy(p);s.scale.setScalar(size);s.material.rotation=rot;s.material.opacity=opacity;s.material.color.set(color);},
  flash(p,age,size=1.4,life=.24){if(age<0||age>=life)return;const s=takeFlash();if(!s)return;const q=age/life;s.position.copy(p);s.scale.setScalar(size*(.6+q*.8));s.material.opacity=1-q*q;s.material.rotation=q*.6;},
  confetti(p,age,o={}){if(age<0)return;const n=o.count??60,seed=o.seed??0,pw=o.power??1,kd=1.6,g=3,e=(1-Math.exp(-kd*age))/kd;for(let k=0;k<n;k++){const m=takeConf();if(!m)return;const r1=hsh(seed+k*3.1),r2=hsh(seed+k*7.7),r3=hsh(seed+k*1.3),a=r1*Math.PI*2,hs=(1+r2*4)*pw,vy=(3+r3*4)*pw;
   let y=p.y+(vy+g/kd)*e-(g/kd)*age;const x=p.x+Math.cos(a)*hs*e+Math.sin(age*3+k)*.15*Math.min(age,1),z=p.z+Math.sin(a)*hs*e,gr=Math.hypot(x,z)<9?.32:-.01;if(y<gr){y=gr+r1*.01;m.rotation.set(-Math.PI/2,0,a*3);}else m.rotation.set(age*(6+r2*8)+k,age*(4+r3*6),age*3+k);m.position.set(x,y,z);m.scale.setScalar(Math.min(1,age*8));}},
  label(tex,p,age,o={}){const life=o.life??1.2;if(age<0||(!o.hold&&age>=life))return;const s=takeLabel();if(!s)return;if(s.material.map!==tex){s.material.map=tex;s.material.needsUpdate=true;}const pop=age<.45?elasticOut(age/.45):1,fade=o.hold?1:clamp01((life-age)/.25),rise=o.hold?0:Math.max(0,age-.35)*.3,sz=(o.size??1)*.5;s.scale.set(2*sz*pop,sz*pop,1);s.position.set(p.x,p.y+rise,p.z);s.material.opacity=fade;s.material.rotation=(o.tilt??-.06)+Math.sin(age*8)*.06*Math.max(0,1-age);},
  text(str,color,p,age,o={}){api.label(textTex(str,color),p,age,o);}};return {...api, root};})();

const ambient={clock:0};let shake=0;
const cfg=()=>({D:duration,J:1});
function setMouth(ch,m){if(ch._m===m)return;const hx=ch.head.rotation.x;ch.setExpression(m,{immediate:true});ch.head.rotation.x=hx;ch._m=m;}
function face(ch,{open=1,size=1,mouth='natural',noBlink=false,spin=0}={}){const bl=noBlink?1:(((ambient.clock+ch.seed*1.7)%3.7)<.12?.08:1);setMouth(ch,mouth);ch.eyes.forEach((e,i)=>{e.scale.set(size,size*Math.max(.06,open*bl),size);e.rotation.z=(i?-.15:.15)+spin*(i?-1:1);});}
const talk=(ch,speed=16)=>Math.sin(ambient.clock*speed+ch.seed*5)>0?'talk':'natural';
const headTop=(ch,y=1.25)=>ch.head.localToWorld(new V3(0,y,0));
const up=(p,y)=>p.clone().add(new V3(0,y,0));
function squash(ch,s){ch.group.scale.set(SC*(1+s*.5),SC*(1-s),SC*(1+s*.5));}
function dizzy(ch,n=3,color='#ffd23f'){const c=headTop(ch,1.15);for(let k=0;k<n;k++){const an=ambient.clock*4+k*Math.PI*2/n;fx.star(c.clone().add(new V3(Math.cos(an)*.38,Math.sin(an*2)*.04,Math.sin(an)*.38)),.16,an,1,color);}}
const pose2={clap(r,amt=1){const k=Math.abs(Math.sin(ambient.clock*14+r.seed));r.arms.forEach((a,i)=>a.rotation.set(-1.25,0,(i?1:-1)*lerp(-.15,.45,k)*amt));},
 up(r){r.arms.forEach((a,i)=>a.rotation.set(-2.9+Math.sin(ambient.clock*10+i)*.15,0,i?-.25:.25));},
 gasp(r){r.arms.forEach((a,i)=>a.rotation.set(-2.25,0,i?.38:-.38));},
 ears(r){r.arms.forEach((a,i)=>a.rotation.set(-2.5,0,i?-1.05:1.05));},
 chin(r){r.armR.rotation.set(-2.05,0,.4);r.head.rotation.z=.15;},
 shrug(r,k=1){r.arms.forEach((a,i)=>a.rotation.set(-.6*k,0,(i?-1:1)*(.4+.9*k)));r.head.rotation.z=.15*k;}};
function runCycle(ch,ph,amp=1){ch.legs.forEach((l,i)=>l.rotation.x=Math.sin(ph+i*Math.PI)*.8*amp);ch.arms.forEach((a,i)=>a.rotation.set(-Math.sin(ph+i*Math.PI)*.9*amp,0,i?-.35:.35));ch.body.position.y=Math.abs(Math.sin(ph))*.09*amp;ch.body.rotation.x=.12*amp;}
function travel(ch,from,to,t0,t1,t){if(t<t0)return 0;const q=clamp01((t-t0)/(t1-t0));ch.group.position.copy(from).lerp(to,smooth(q));if(q<1){ch.group.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);runCycle(ch,ambient.clock*14);fx.puff(ch.group.position.clone().setY(.4),.25,.35,'#d8ccf5');}return q;}
function resetRig(r,pos,ry){r.resetPose();r.neck.rotation.set(0,0,0);r.body.scale.set(1,1,1);r.group.visible=true;r.group.position.copy(pos);r.group.rotation.set(0,ry,0);r.group.scale.setScalar(SC);r.arms.forEach(a=>a.scale.set(1,1,1));r.eyes.forEach((e,i)=>{e.scale.setScalar(1);e.rotation.z=i?-.15:.15;});}
const tipR=ch=>ch.armR.localToWorld(new V3(0,-.86,0)),tipL=ch=>ch.armL.localToWorld(new V3(0,-.86,0));
function lookAt(ch,target,amt=1){ch.group.updateMatrixWorld(true);const l=ch.group.worldToLocal(target.clone());ch.head.rotation.y=THREE.MathUtils.clamp(Math.atan2(l.x,l.z),-1.2,1.2)*amt;}

const bulb=new THREE.Group();{const g=new THREE.Mesh(new THREE.SphereGeometry(.22,18,14),new THREE.MeshStandardMaterial({color:'#fff6a8',emissive:'#ffd84a',emissiveIntensity:1.5,roughness:.2}));g.scale.y=1.15;bulb.add(g);const b=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.16,12),new THREE.MeshStandardMaterial({color:'#9aa0a8',metalness:.7,roughness:.3}));b.position.y=-.3;bulb.add(b);bulb.visible=false;scene.add(bulb);}
const STONE=new THREE.Color('#8d8a93'),ANGRY=new THREE.Color('#ff3b2e'),tinted=new Set();
const tintMaterials=new Map(),originalMaterials=new WeakMap();
function tint(r,color,k){r.group.traverse(o=>{
 if(!o.isMesh||!o.material||Array.isArray(o.material)||!o.material.color)return;
 const original=originalMaterials.get(o)||o.material;
 if(k===0){o.material=original;return;}
 originalMaterials.set(o,original);
 if(!tintMaterials.has(original))tintMaterials.set(original,original.clone());
 o.material=tintMaterials.get(original);o.material.color.copy(original.color).lerp(color,k);
});}

function pose(fromPlay=false){
 const t=progress,{D,J}=cfg(),clock=ambient.clock,sel=selected,eff=true,ans=0;C=cast[sel];N=cast[neighbor>=0?neighbor:(sel+1)%cast.length];
 fx.begin(eff);shake=0;
 [goldMango,disco,phone,handset,card,fanCards,hole,spring,tumble,shades,cloud,...mangoRain].forEach(o=>o.visible=false);beam.material.opacity=0;
 host.setGlasses('sun');
 cast.forEach(c=>{c.height=c.slot.height;c.light='off';c.dy=0;c.free=false;resetRig(c.rig,new V3(c.x,.3+c.height+.08,c.z),c.ry);c.podium.position.set(c.x,.3,c.z);c.dome.position.y=.02;c.dome.scale.setScalar(1);});buzzerMat.forEach(m=>m.emissiveIntensity=.25);shades.scale.setScalar(1);bulb.visible=false;for(const r of tinted)tint(r,null,0);tinted.clear();
 resetRig(host,HOST.pos,HOST.ry);host.armR.rotation.set(-1.45,0,.3);
 // idle life: sway, look around, blink, the host bounces on his toes
 cast.forEach((c,i)=>{const r=c.rig;r.body.rotation.z=Math.sin(clock*1.3+i)*.03;r.head.rotation.y=Math.sin(clock*.7+i*2)*.25;face(r);});
 host.body.position.y=Math.abs(Math.sin(clock*3))*.03;host.head.rotation.z=Math.sin(clock*1.7)*.05;face(host,{mouth:'smile'});
 const S={opts:Array(4).fill('normal'),footer:'',timer:null,overlay:null,k:1};
 let spot=null,spotPower=1,sweep=1;
 const A=C.rig,watchAll=(target,except=[])=>cast.forEach(c=>{if(!except.includes(c))lookAt(c.rig,target);});
 const revealAt=.48,ra=(t-revealAt)*D,revealed=t>=revealAt;
 const hostSay=(s,at,o={})=>fx.text(s,o.color||'#ffd23f',up(headTop(host),.25),(t-at)*D,{life:o.life??1.2,size:o.size??.9,hold:o.hold});
 const say=(c,s,at,o={})=>fx.text(s,o.color||'#ffffff',up(headTop(c.rig),.25),(t-at)*D,{life:o.life??1.2,size:o.size??.85,hold:o.hold,tilt:o.tilt});
 const banner=(s,color,at,o={})=>fx.text(s,color,new V3(o.x??C.x,o.y??4.3,(o.z??C.z)+.6),(t-at)*D,{hold:o.hold??true,size:o.size??2,life:o.life});
 const sweat=(r,amt=1)=>{for(let k=0;k<2;k++){const ag=((clock*1.4+k*.5+r.seed)%1),s=k?1:-1;fx.puff(headTop(r,.9).add(new V3(s*(.25+ag*.2),-ag*.35,.15)),.07,(1-ag)*amt,'#7cc7ff');}};
 const suspenseBody=(r,k)=>{r.group.position.x+=Math.sin(clock*80)*.008*k*J;sweat(r,k);face(r,{open:1+.4*k,size:1+.15*k,mouth:'natural',noBlink:true});};
 const correctFX=()=>{cue('ding',revealAt);cue('applause',revealAt+.02);S.opts[ans]='right';S.overlay=ra<1.2?'check':null;S.k=elasticOut(ra/.5);C.light='right';fx.flash(headTop(A,.5),ra,1.4);fx.burst(headTop(A,.4),ra,{count:14,radius:1.4,multi:true});if(ra<.5)shake+=.05*J*Math.exp(-ra*8);
  if(true)fx.confetti(new V3(C.x,6,C.z),ra,{count:90,power:.7,seed:sel});};
 const othersClap=()=>cast.forEach(c=>{if(c!==C){pose2.clap(c.rig);face(c.rig,{open:.4,mouth:'smile',noBlink:true});}});
 // ---------- variants for the moments that repeat every round ----------
 let handled=false;const vr=VARIANTS[action]?curVar:null;
 const lockFX=(at,o={})=>{if(t<at)return false;const a=(t-at)*D;C.light='locked';S.opts[ans]=Math.floor(clock*4)%2?'locked':'lockedDim';C.dome.scale.y=a<.2?.4:1;fx.flash(C.buzzer.getWorldPosition(new V3()),a,o.flash??.7);if(o.shake&&a<.4)shake+=o.shake*J*Math.exp(-a*10);cue(o.sound??'slam',at);return true;};
 const pre=()=>{cue('drum',.02);spot=up(C.rig.group.position,1);if(!revealed){S.opts[ans]=Math.floor(clock*10)%2?'locked':'lockedDim';C.light='locked';suspenseBody(A,smooth(t/.3));A.armR.rotation.set(-2.3,0,.38);sweep=2.5;return false;}return true;};
 const rightFX=()=>{correctFX();banner(loc('¡CORRECTO!'),'#3ef08a',revealAt+.02,{size:2.2});pose2.up(host);face(host,{open:.4,mouth:'laugh',noBlink:true});};
 const wrongFX=()=>{cue('buzzer',revealAt);S.opts[ans]='wrong';S.opts[(ans+1)%4]='right';S.overlay=ra<1.4?'x':null;S.k=elasticOut(ra/.4);C.light='wrong';fx.flash(headTop(A,.5),ra,1.2);if(ra<.5)shake+=.06*J*Math.exp(-ra*8);banner(loc('¡INCORRECTO!'),'#ff3b4e',revealAt+.02,{size:2});cast.forEach(c=>{if(c!==C){pose2.gasp(c.rig);face(c.rig,{open:1.3,size:1.1,noBlink:true});}});pose2.shrug(host,smooth(ra/.4));face(host,{open:.7,mouth:'talk'});};
 const eyeW=(i)=>A.eyes[i].getWorldPosition(new V3());
 if(vr&&vr!=='classic'){handled=true;switch(action+':'+vr){
  // ----- locking an answer -----
  case 'lock:finger':{spot=up(C.rig.group.position,1);const aim=pulse(t,.05,.15,.7);A.arms.forEach((a,i)=>a.rotation.set(-2.05*aim-.2,0,(i?1:-1)*.12));A.head.rotation.z=-.1*aim;face(A,{open:.7,mouth:'smile'});if(t>.2)A.eyes[0].scale.y=.06;
   cue('pop',.28);cue('pop',.34);if(t>.28&&t<.4)fx.puff(tipR(A),.12,.8,'#ffffff');say(C,loc('¡Esa es!'),.22,{color:'#ffc629'});
   if(t>.55){A.armR.rotation.set(-2.2,0,.42);fx.puff(up(tipR(A),.15+((clock*.8)%1)*.3),.08,.6*(1-((clock*.8)%1)));}lockFX(.36,{sound:'pop'});break;}
  case 'lock:shy':{spot=up(C.rig.group.position,1);const reach=smooth((t-.1)/.35);A.armR.rotation.set(-.3-.65*reach,0,-.25+.55*reach);A.head.rotation.y=.9*smooth(t/.15);face(A,{open:.15,mouth:'natural',noBlink:true});say(C,loc('¿Seguro…?'),.12,{size:.75});
   if(t>=.45){const q=(t-.45)/.08;if(q<1)c_dy(C,t,.45);face(A,{open:1.5,size:1.25,mouth:'smile',noBlink:true});A.head.rotation.y=0;say(C,loc('¡Ay!'),.46,{life:.8,color:'#ff8fd0'});A.armR.rotation.set(-2.6,0,-.2);}lockFX(.45,{sound:'pop',flash:.5});break;}
  case 'lock:drama':{cue('heart',.05);spot=up(C.rig.group.position,1);if(t<.42){A.armR.rotation.set(-1.15,0,1.05);A.armL.rotation.set(-1.15,0,-1.05);A.head.rotation.x=-.3;face(A,{open:.08,mouth:'natural',noBlink:true});say(C,loc('¡Lo juro por mi abuela!'),.08,{life:1.6,size:.8});spotPower=.5;}
   else{const s=t<.47?smooth((t-.42)/.05):1;A.arms.forEach((a,i)=>a.rotation.set(t<.47?-3*s:-.95,0,(i?1:-1)*.3));face(A,{open:.5,mouth:'smile',noBlink:true});}if(lockFX(.47,{shake:.07,flash:1}))banner(loc('¡RESPUESTA FINAL!'),'#ffc629',.48,{size:1.6,hold:false,life:1.8,y:3.6});break;}
  case 'lock:drum':{spot=up(C.rig.group.position,1);for(let k=0;k<12;k++)cue('tick',.05+k*.03);const fast=t<.4;if(fast){A.arms.forEach((a,i)=>a.rotation.set(-.95+Math.sin(clock*30+i*Math.PI)*.28,0,(i?1:-1)*.35));A.body.rotation.z=Math.sin(clock*15)*.04;face(A,{open:.5,mouth:'smile',noBlink:true});fx.text('tun tun tun','#ffffff',up(C.buzzer.getWorldPosition(new V3()),.6),(t-.08)*D,{life:1,size:.6,tilt:Math.sin(clock*9)*.15});}
   else if(t<.46){A.arms.forEach((a,i)=>a.rotation.set(-2.9,0,(i?1:-1)*.2));}else{A.arms.forEach((a,i)=>a.rotation.set(-.95,0,(i?1:-1)*.35));face(A,{open:.4,mouth:'laugh',noBlink:true});}
   if(lockFX(.46,{shake:.08,flash:1}))fx.text(loc('¡BUM!'),'#ffc629',up(C.buzzer.getWorldPosition(new V3()),.7),(t-.46)*D,{life:1,size:1});break;}
  case 'lock:chill':{spot=up(C.rig.group.position,1);A.body.rotation.x=-.14;const tap=pulse(t,.46,.5,.56);A.arms.forEach((a,i)=>a.rotation.set(-2.75,0,(i?1:-1)*-1.2));if(tap>0)A.armR.rotation.set(lerp(-2.75,-.95,tap),0,lerp(1.2,.35,tap));face(A,{open:.5,mouth:'smile'});
   if(t>.12){shades.visible=true;const s=elasticOut((t-.12)*D/.5);shades.scale.setScalar(.75*s);A.head.updateMatrixWorld(true);shades.position.copy(A.head.localToWorld(new V3(0,.28,1.15)));shades.quaternion.copy(A.head.getWorldQuaternion(new THREE.Quaternion()));cue('pop',.12);}
   say(C,loc('Fácil.'),.2,{life:1.2});for(let k=0;k<3;k++){const ag=((clock*.8+k/3)%1);fx.text('mmm','#ffd23f',headTop(A,.8).add(new V3(Math.sin(k*2+ag*4)*.4,ag*.8,0)),ag*1.5,{life:1.5,size:.45});}lockFX(.5,{sound:'pop'});break;}
  // ----- correct answer -----
  case 'right:robot':{if(pre()){rightFX();const q=Math.floor(clock*6.5);A.armL.rotation.set(q%2?-1.57:-2.9,0,q%4<2?.2:1.3);A.armR.rotation.set(q%2?-2.9:-1.57,0,q%4<2?-.2:-1.3);A.head.rotation.y=((q%3)-1)*.45;A.body.rotation.y=((q%4)-1.5)*.2;A.eyes.forEach(e=>e.scale.set(1.3,.6,1.3));setMouth(A,'smile');
   for(let k=0;k<6;k++)cue('pop',revealAt+.04+k*.07);fx.text(loc('¡BIP BOP!'),'#7cd8ff',up(headTop(A),.25),ra-.15,{hold:true,size:.9});othersClap();}break;}
  case 'right:tears':{if(pre()){rightFX();pose2.gasp(A);const sob=Math.abs(Math.sin(clock*9));squash(A,.04*sob);face(A,{open:.12,mouth:'laugh',noBlink:true});
   for(const i of [0,1]){const e=eyeW(i);for(let k=0;k<5;k++){const ag=((clock*1.3+k*.2+i*.1)%1);fx.puff(e.clone().add(new V3((i?-1:1)*(.08+ag*.25),-ag*.7+ag*ag*.1,.12)),.06,1-ag,'#6ec3ff');}}
   say(C,loc('¡Mamá, lo logré!'),.6,{hold:true,size:.85});cast.forEach(c=>{if(c!==C){pose2.clap(c.rig,.6);face(c.rig,{open:.5,mouth:'smile'});}});}break;}
  case 'right:flip':{if(pre()){rightFX();cue('boing',.56);cue('land',.74);const cr=pulse(t,.49,.54,.57),fq=clamp01((t-.56)/.18);squash(A,.18*cr*J);if(fq>0&&fq<1){C.dy=4*1.4*J*fq*(1-fq);A.group.rotation.x=-Math.PI*2*easeOut(fq)*(J>=.4?1:0);pose2.up(A);}
   if(t>=.74){const a=(t-.74)*D;squash(A,.15*J*Math.exp(-a*6)*Math.cos(a*20));pose2.up(A);fx.burst(headTop(A,.4),a,{count:12,radius:1.2,multi:true});cast.forEach(c=>{if(c!==C){c.rig.armR.rotation.set(-2.9,0,-.2);fx.text('10','#ffd23f',up(headTop(c.rig),.35),a-.1-c.i*.03,{hold:true,size:.7,tilt:0});face(c.rig,{open:.4,mouth:'smile',noBlink:true});}});banner(loc('¡PERFECTO!'),'#ffd23f',.76,{size:1.5,y:5.4});}
   face(A,{open:.4,mouth:'laugh',noBlink:true});}break;}
  case 'right:kiss':{if(pre()){rightFX();cue('pop',.66);const b=pulse(t,.52,.64,.76),bz=C.buzzer.getWorldPosition(new V3());A.body.rotation.x=.75*b;A.arms.forEach((a,i)=>a.rotation.set(-1.1*b,0,(i?1:-1)*(.3+.4*b)));face(A,{open:.15,mouth:'natural',noBlink:true});
   const ka=(t-.64)*D;if(ka>=0){C.dome.scale.setScalar(1+.4*Math.exp(-ka*5));buzzerMat[C.i].emissiveIntensity=.25+2*Math.exp(-ka*3);fx.burst(up(bz,.2),ka,{count:10,radius:.9,hearts:true,color:'#ff8fd0',size:.22,life:1});fx.text(loc('¡MUAK!'),'#ff8fd0',up(bz,.6),ka,{life:1,size:.9});}
   if(t>.76){pose2.up(A);face(A,{open:.35,mouth:'laugh',noBlink:true});say(C,loc('¡Te amo, botón!'),.78,{hold:true,size:.85});}othersClap();}break;}
  case 'right:flex':{if(pre()){rightFX();const p=Math.max(0,Math.sin(clock*10));A.arms.forEach((a,i)=>a.rotation.set(-.5,0,(i?-1:1)*(2.2+.25*p)));squash(A,-.06*p*J);face(A,{open:.45,mouth:'smile',noBlink:true});
   shades.visible=true;A.head.updateMatrixWorld(true);shades.scale.setScalar(.75*elasticOut(ra/.5));shades.position.copy(A.head.localToWorld(new V3(0,.28,1.15)));shades.quaternion.copy(A.head.getWorldQuaternion(new THREE.Quaternion()));
   for(let k=0;k<5;k++){const an=clock*3+k*1.25;fx.star(headTop(A,.4).add(new V3(Math.cos(an)*.6,Math.sin(an*1.7)*.3,Math.sin(an)*.25)),.13,an,Math.abs(Math.sin(clock*5+k)),'#ffe08a');}say(C,loc('¡SOY UN GENIO!'),.56,{hold:true,size:.85,color:'#ffd23f'});othersClap();}break;}
  // ----- wrong answer -----
  case 'wrong:melt':{cue('wahwah',.55);if(pre()){wrongFX();const m=smooth(ra/1.4);A.group.scale.set(SC*(1+.3*m),SC*(1-.62*m),SC);C.free=true;A.group.position.set(C.x,.75-.1*m,C.z-.15*m);A.head.rotation.x=.3*m;A.arms.forEach((a,i)=>a.rotation.set(0,0,(i?-1:1)*(.4+1.1*m)));face(A,{open:.4-.3*m,mouth:'natural',noBlink:true});
   const fr=C.podium.userData.top.localToWorld(new V3(0,1.05,.7));for(let k=0;k<6;k++){const ag=((clock*.9+k/6)%1),x=(hsh(k)-.5)*.9;fx.puff(fr.clone().add(new V3(x,-ag*1.4,0)),.09+ag*.05,(1-ag)*m,'#ffb04a');}say(C,'nooo…',.62,{hold:true,size:.7,color:'#ffb04a'});}break;}
  case 'wrong:stone':{cue('wahwah',.6);cue('bonk',.82);if(pre()){wrongFX();const k=smooth(ra/.5);tint(A,STONE,k);tinted.add(A);face(A,{open:1,size:1.1,mouth:'natural',noBlink:true});A.body.rotation.set(0,0,0);A.head.rotation.set(0,0,0);
   if(t>.62){fx.text('crack','#c8c4d0',up(headTop(A),.1),(t-.62)*D,{life:.8,size:.6,tilt:.2});fx.burst(headTop(A,.6),(t-.62)*D,{count:8,radius:.5,color:'#9a96a3',size:.12});}if(t>.82){fx.burst(headTop(A,.9),(t-.82)*D,{count:12,radius:.8,color:'#8d8a93',size:.16});fx.dust(up(C.rig.group.position,.2),(t-.82)*D,{count:8,size:.3,color:'#a7a3b0',seed:3});}
   say(C,'…',.7,{hold:true,size:.8});}break;}
  case 'wrong:tantrum':{if(pre()){wrongFX();cue('bonk',.6);cue('bonk',.7);cue('bonk',.8);const a=ra;C.dy=Math.abs(Math.sin(clock*14))*.14*J;A.arms.forEach((ar,i)=>ar.rotation.set(-1.4+Math.sin(clock*14+i*Math.PI)*.8,0,(i?-1:1)*.4));A.head.rotation.y=Math.sin(clock*18)*.35;tint(A,ANGRY,.25*smooth(a/.4));tinted.add(A);face(A,{open:.3,mouth:'smile',noBlink:true});
   for(let k=0;k<4;k++){const ag=((clock*1.5+k/4)%1);fx.puff(headTop(A,.6).add(new V3((k-1.5)*.15,ag*.9,0)),.12+ag*.2,(1-ag)*.7,'#ffffff');}say(C,loc('¡NO ES JUSTO!'),.56,{hold:true,size:.9,color:'#ff5a3c'});}break;}
  case 'wrong:faceplant':{cue('wahwah',.75);cue('bonk',.66);if(pre()){wrongFX();const d=easeIn((t-.52)/.14);A.body.rotation.x=.72*d;A.arms.forEach((a,i)=>a.rotation.set(-.8*d,0,(i?-1:1)*(.4+.5*d)));face(A,{open:.1,mouth:'natural',noBlink:true});
   if(t>.66){const a=(t-.66)*D;fx.burst(C.buzzer.getWorldPosition(new V3()).add(new V3(-.35,.25,0)),a,{count:8,radius:.6});fx.text('pum','#ffffff',up(C.buzzer.getWorldPosition(new V3()),.6),a,{life:.8,size:.6});if(a<.3)shake+=.03*J;say(C,'…',.75,{hold:true,size:.8});}}break;}
  case 'wrong:shrug':{cue('pop',.6);if(pre()){wrongFX();pose2.shrug(A,smooth(ra/.3));face(A,{open:.5,mouth:'smile'});if(t>.75){A.arms.forEach(a=>a.rotation.set(.6,0,0));A.head.rotation.set(-.2,.3,0);setMouth(A,'talk');for(let k=0;k<3;k++){const ag=((clock*.8+k/3)%1);fx.text('mmm','#ffd23f',headTop(A,.8).add(new V3(Math.sin(k*2+ag*4)*.4,ag*.8,0)),ag*1.5,{life:1.5,size:.45});}}
   say(C,loc('Ni modo…'),.6,{hold:true,size:.8});}break;}
  // ----- thinking -----
  case 'think:count':{S.timer=1-t*.7;for(let k=0;k<20;k++)cue('tick',k*.05);spot=up(C.rig.group.position,1);const beats=[.15,.35,.55];A.armR.rotation.set(-1.9+beats.reduce((s,b)=>s+pulse(t,b-.04,b,b+.06)*.3,0),0,.25);A.head.rotation.x=.12;face(A,{open:.8});
   beats.forEach((b,k)=>{fx.text(['1…','2…','3…'][k],'#ffffff',headTop(A,.6).add(new V3(.5+k*.25,0,0)),(t-b)*D,{life:.7,size:.6,tilt:0});cue('pop',b);});if(t>.72){pose2.shrug(A,smooth((t-.72)/.08));face(A,{open:1.2,mouth:'natural',noBlink:true});say(C,loc('¿Eran cuatro?'),.74,{hold:true,size:.8});}break;}
  case 'think:bulb':{S.timer=1-t*.7;cue('ding',.56);spot=up(C.rig.group.position,1);if(t<.56){A.armR.rotation.set(-2.75+Math.sin(clock*20)*.15,0,-.65);A.head.rotation.z=.15;face(A,{open:.7});for(let k=0;k<3;k++){const an=clock*2+k*2.1;fx.text('?','#ffffff',headTop(A,.5).add(new V3(Math.cos(an)*.5,0,Math.sin(an)*.3)),(t-.08-k*.08)*D,{hold:true,size:.45,tilt:0});}}
   else{const a=(t-.56)*D;bulb.visible=true;bulb.position.copy(headTop(A,.95));bulb.scale.setScalar(Math.max(.01,elasticOut(a/.5)));bulb.children[0].material.emissiveIntensity=1.5+Math.sin(clock*12)*.6;fx.burst(bulb.position,a,{count:10,radius:.7,color:'#fff36b'});pose2.up(A);face(A,{open:1.3,mouth:'smile',noBlink:true});say(C,loc('¡IDEA!'),.58,{hold:true,color:'#fff36b'});c_dy(C,t,.57);}break;}
  case 'think:scratch':{S.timer=1-t*.7;spot=up(C.rig.group.position,1);A.armR.rotation.set(-2.7+Math.sin(clock*22)*.12,0,-.75);A.head.rotation.z=Math.sin(clock*1.5)*.18;A.head.rotation.x=-.15;face(A,{open:.85});
   for(let k=0;k<3;k++){const an=clock*1.6+k*2.1;fx.text('?',['#ffd23f','#7cd8ff','#ff8fd0'][k],headTop(A,.55).add(new V3(Math.cos(an)*.55,Math.sin(an*2)*.08,Math.sin(an)*.35)),(t-.1-k*.12)*D,{hold:true,size:.45+k*.08,tilt:0});}sweat(A,.6);break;}
  case 'think:tinmarin':{S.timer=1-t*.7;spot=up(C.rig.group.position,1);const syl=[.1,.28,.46,.64],k=syl.filter(s=>t>=s).length,side=k%2?1:-1;A.armR.rotation.set(-1.6,0,side*.35+.1);A.head.rotation.y=side*.2;face(A,{open:.7,mouth:talk(A,10)});
   [loc('¡De tin!'),loc('¡Marín!'),loc('¡De do!'),loc('¡Pingüé!')].forEach((s,i)=>{fx.text(s,['#ffd23f','#ff8fd0','#7cd8ff','#8dff8a'][i],headTop(A,.5).add(new V3(i%2?.5:-.5,0,0)),(t-syl[i])*D,{life:.6,size:.65});cue('pop',syl[i]);});
   if(t>.82){S.opts[ans]='locked';pose2.up(A);face(A,{open:.4,mouth:'laugh',noBlink:true});say(C,loc('¡Esta!'),.83,{hold:true,color:'#8dff8a'});cue('tada',.83);}break;}
 }}
 if(!handled)switch(action){
  case 'welcome':{cue('fanfare',.02);cue('applause',.36);const center=new V3(0,.3,3.4);S.overlay='title';S.k=elasticOut(t*D/.8);spot=host.group.position.clone();
   if(t<.34){travel(host,HOST.pos,center,.02,.32,t);face(host,{mouth:'smile'});}
   else{host.group.position.copy(center);const sp=smooth((t-.34)/.1);host.group.rotation.y=Math.PI*2*sp;if(t<.46)pose2.up(host);else if(t<.8){host.armL.rotation.set(-1.6,0,1.3+Math.sin(clock*3)*.3);host.armR.rotation.set(-2.2,0,.1);}else{const b=smooth((t-.8)/.08);host.body.rotation.x=.45*b;host.armL.rotation.set(-.5,0,.9);}face(host,{open:.4,mouth:t<.8?talk(host,14):'smile',noBlink:true});
    banner(loc('¡BIENVENIDOS!'),'#ffd23f',.36,{x:0,y:4.2,z:3,size:2.4,hold:false,life:1.6});if(eff&&true)fx.confetti(new V3(0,6,3),(t-.36)*D,{count:60,power:.6,seed:2});}
   cast.forEach((c,i)=>{lookAt(c.rig,up(host.group.position,1.4));const w0=.48+i*.05,q=(t-w0)/.12;if(q>0&&q<1){c.dy=Math.sin(q*Math.PI)*.35*J;pose2.up(c.rig);face(c.rig,{open:.4,mouth:'smile',noBlink:true});cue('pop',w0);}else if(q>=1)face(c.rig,{mouth:'smile'});});
   break;}
  case 'think':{S.timer=1-t*.7;for(let k=0;k<20;k++)cue('tick',k*.05);spot=up(C.rig.group.position,1);
   pose2.chin(A);A.body.rotation.z=Math.sin(clock*1.6)*.05;A.head.rotation.y=Math.sin(clock*1.1)*.35;face(A,{open:.75,mouth:'natural'});sweat(A,smooth(t/.5)*.8);
   say(C,loc('¿La A?'),.12,{tilt:.1});say(C,loc('¿O la C…?'),.38,{tilt:-.1});say(C,'Mmm…',.62);say(C,loc('¡Ya sé!'),.85,{color:'#8dff8a'});if(t>.85){pose2.up(A);c_dy(C,t,.85);face(A,{open:.4,mouth:'smile',noBlink:true});}
   host.body.rotation.x=.12;lookAt(host,up(C.rig.group.position,1.4));host.armL.rotation.set(-1.2,0,.2);host.head.rotation.z=.18;face(host,{open:.6,mouth:'natural'});
   break;}
  case 'lock':{cue('slam',.3);spot=up(C.rig.group.position,1);const wind=smooth(t/.25),slam=t>.3?1:0;
   if(t<.3){A.armR.rotation.set(-2.8*wind,0,-.3);A.body.rotation.x=-.12*wind;face(A,{open:.45,mouth:'natural',noBlink:true});}
   else{const a=(t-.3)*D;A.armR.rotation.set(-.95,0,.35);A.body.rotation.x=.15;C.dome.scale.y=a<.25?.4:1;squash(A,.12*J*Math.exp(-a*6)*Math.cos(a*20));C.light='locked';S.opts[ans]=Math.floor(clock*4)%2?'locked':'lockedDim';
    fx.flash(C.buzzer.getWorldPosition(new V3()),a,.9);if(a<.4)shake+=.06*J*Math.exp(-a*10);banner(loc('¡RESPUESTA FINAL!'),'#ffc629',.32,{size:1.6,hold:false,life:1.8,y:3.6});face(A,{open:.6,mouth:'natural',noBlink:true});}
   if(t>.48){host.body.rotation.x=.2;lookAt(host,up(C.rig.group.position,1.4));face(host,{open:.5,mouth:talk(host)});hostSay(loc('¿Segura?'),.5,{life:1.1});}
   if(t>.66){A.head.rotation.x=Math.sin(clock*14)*.25;say(C,loc('¡SEGURÍSIMA!'),.78,{hold:true,color:'#ffc629'});face(A,{open:.5,mouth:'smile',noBlink:true});}
   break;}
  case 'suspense':{cue('drum',.02);cue('heart',.1);sweep=3;spot=up(C.rig.group.position,1);const k=smooth(t/.3);C.light=Math.floor(clock*6)%2?'locked':'off';S.opts[ans]=Math.floor(clock*(4+t*14))%2?'locked':'lockedDim';
   A.armR.rotation.set(-2.3,0,.38);suspenseBody(A,k);squash(A,.04*J*Math.max(0,Math.sin(clock*9)));
   cast.forEach(c=>{if(c!==C){pose2.gasp(c.rig);lookAt(c.rig,up(C.rig.group.position,1.4));face(c.rig,{open:1.2,mouth:'natural',noBlink:true});}});
   const lean=smooth((t-.3)/.6);host.body.rotation.x=.3*lean;lookAt(host,up(C.rig.group.position,1.4));host.armL.rotation.set(-1.4,0,-.2);face(host,{open:.5,mouth:'natural'});hostSay(loc('La respuesta correcta es…'),.35,{life:1.8,size:.8});
   spotPower=.4+Math.abs(Math.sin(clock*15))*.6;break;}
  case 'right':{cue('drum',.02);spot=up(C.rig.group.position,1);if(!revealed){S.opts[ans]=Math.floor(clock*10)%2?'locked':'lockedDim';C.light='locked';suspenseBody(A,smooth(t/.3));A.armR.rotation.set(-2.3,0,.38);sweep=2.5;}
   else{correctFX();const h=(ra*2.2)%1;if(ra<2)C.dy=Math.sin(h*Math.PI)*.35*J;pose2.up(A);A.body.rotation.y=Math.floor(ra*2.2)%2?Math.PI*2*smooth(h):0;face(A,{open:.35,mouth:'laugh',noBlink:true});othersClap();pose2.up(host);host.group.position.y+=Math.abs(Math.sin(clock*8))*.1;face(host,{open:.4,mouth:'laugh',noBlink:true});
    banner(loc('¡CORRECTO!'),'#3ef08a',revealAt+.02,{size:2.2});}
   break;}
  case 'wrong':{cue('drum',.02);cue('buzzer',revealAt);cue('wahwah',.6);spot=up(C.rig.group.position,1);if(!revealed){S.opts[ans]=Math.floor(clock*10)%2?'locked':'lockedDim';C.light='locked';suspenseBody(A,smooth(t/.3));A.armR.rotation.set(-2.3,0,.38);sweep=2.5;}
   else{S.opts[ans]='wrong';S.opts[(ans+1)%4]='right';S.overlay=ra<1.4?'x':null;S.k=elasticOut(ra/.4);C.light='wrong';fx.flash(headTop(A,.5),ra,1.2);if(ra<.5)shake+=.06*J*Math.exp(-ra*8);
    const d=smooth(ra/.5);squash(A,.16*d*J);A.head.rotation.x=.4*d;A.arms.forEach((a,i)=>a.rotation.set(.1,0,(i?-1:1)*.15));face(A,{open:.45,mouth:'natural',noBlink:true});
    if(ra>.5){const cp=headTop(A,1.5);cloud.visible=true;cloud.position.copy(cp);cloud.scale.setScalar(.8*elasticOut((ra-.5)/.5));for(let k=0;k<10;k++){const ph=(clock*1.6+hsh(k))%1;fx.puff(cp.clone().add(new V3((hsh(k*3)-.5)*.6,-.15-ph*1.1,(hsh(k*7)-.5)*.3)),.05,.85,'#6ec3ff');}}
    cast.forEach(c=>{if(c!==C){pose2.gasp(c.rig);face(c.rig,{open:1.3,size:1.1,mouth:'natural',noBlink:true});}});pose2.shrug(host,smooth(ra/.4));face(host,{open:.7,mouth:'talk'});hostSay(loc('¡Uy!'),revealAt+.08);
    banner(loc('¡INCORRECTO!'),'#ff3b4e',revealAt+.02,{size:2});}
   break;}
  case 'win':{cue('drum',.02);cue('fanfare',revealAt);cue('applause',.6);spot=up(C.rig.group.position,1);if(!revealed){C.light='locked';suspenseBody(A,smooth(t/.3));A.armR.rotation.set(-2.3,0,.38);sweep=2.5;S.opts[ans]=Math.floor(clock*10)%2?'locked':'lockedDim';}
   else{S.opts[ans]='right';S.overlay='mango';S.k=elasticOut(ra/.6);C.light='gold';beam.material.opacity=.22*smooth(ra/.3);beam.position.set(C.x,6.3,C.z);
    const mq=clamp01((t-.5)/.2),hands=headTop(A,1.6);goldMango.visible=true;goldMango.position.copy(new V3(C.x,10,C.z).lerp(hands,easeOut(mq)));goldMango.rotation.y=clock*4;if(mq>=1){pose2.up(A);goldMango.position.copy(headTop(A,1.5));}else{A.arms.forEach((a,i)=>a.rotation.set(-2.4,0,i?-.5:.5));}
    for(let k=0;k<6;k++){const an=clock*2+k;fx.star(goldMango.position.clone().add(new V3(Math.cos(an)*.5,Math.sin(an*1.3)*.4,Math.sin(an)*.5)),.15,an,.9,'#ffe08a');}
    face(A,{open:mq>=1?.35:1.4,size:1.1,mouth:mq>=1?'laugh':'smile',noBlink:true});othersClap();pose2.up(host);face(host,{open:.4,mouth:'laugh',noBlink:true});
    if(true)fx.confetti(new V3(C.x,7,C.z),ra-.3,{count:120,power:.9,seed:7});[[.4,-3,6,0],[.9,3,6.5,-1],[1.4,0,7,-2]].forEach(([ts,x,y,z],k)=>fx.burst(new V3(x,y,z),ra-ts,{count:18,radius:2.2,color:['#ffd84a','#ff8fd0','#7cd8ff'][k],seed:k*20,life:1.1,size:.35}));banner(loc('¡MANGO DE ORO!'),'#ffd84a',.55,{size:2.2,y:5.4});}
   break;}
  case 'group':{cue('beat',.05);cue('applause',.5);const dq=smooth((t-.05)/.2);disco.visible=true;disco.position.set(0,lerp(11,7.4,easeOut(dq)),1);disco.rotation.y=clock*1.5;for(let k=0;k<8;k++){const an=clock*2+k*.8;fx.star(disco.position.clone().add(new V3(Math.cos(an)*.75,Math.sin(k*1.3)*.5,Math.sin(an)*.75)),.18,an,Math.abs(Math.sin(clock*6+k)),'#ffffff');}
   for(let k=0;k<26;k++){const an=clock*.8+k*2.4,r=1.5+hsh(k)*6.5;fx.puff(new V3(Math.cos(an)*r,.33,Math.sin(an)*r*.7+1),.35,.55*dq,colors[k%6]);}
   cast.forEach((c,i)=>{const b=t*D*2.4+i*.25,r=c.rig;c.dy=Math.abs(Math.sin(b*Math.PI))*.15*J;r.body.rotation.z=Math.sin(b*Math.PI)*.18*J;r.arms.forEach((a,j)=>a.rotation.set(-2.6-Math.sin(b*Math.PI+j*Math.PI)*.5,0,j?-.4:.4));face(r,{open:.35,mouth:'smile',noBlink:true});});
   const center=new V3(0,.3,3.2);travel(host,HOST.pos,center,.02,.25,t);if(t>.25){host.group.position.copy(center);host.group.rotation.y=Math.floor(t*D*1.2)%3===2?Math.PI*2*smooth((t*D*1.2)%1):0;host.body.rotation.z=Math.sin(t*D*2.4*Math.PI)*.2;pose2.up(host);face(host,{open:.35,mouth:'laugh',noBlink:true});}
   if(true)fx.confetti(new V3(0,7,0),(t-.3)*D,{count:140,power:1,seed:3});banner(loc('¡FIESTA!'),'#ff8fd0',.3,{x:0,y:4.4,z:2,size:2.4});break;}

  // ---------- comedy scenes ----------
  case 'fifty':{cue('pop',.1);cue('tick',.3);cue('poof',.42);cue('tada',.48);const wrong=[0,1,2,3].filter(i=>i!==ans).slice(0,2),pq=clamp01((t-.42)/.12);
   if(t>.08&&t<.3){S.overlay='fifty';S.k=elasticOut((t-.08)*D/.5);}
   wrong.forEach(i=>{S.opts[i]=t<.25?'normal':t<.42?(Math.floor(clock*12)%2?'wrong':'normal'):pq<1?'poof':'gone';});S.poof=pq;
   host.armL.rotation.set(-2.7,0,.2);face(host,{open:.45,mouth:talk(host)});hostSay(loc('¡Comodín 50:50!'),.08,{size:.9});spot=up(host.group.position,1);
   if(t>.55){face(A,{open:.35,mouth:'smile',noBlink:true});A.armR.rotation.set(-2.7,0,.75);say(C,loc('¡Uf, menos mal!'),.6,{color:'#8dff8a'});}else lookAt(A,new V3(0,5,-5));
   break;}
  case 'phone':{cue('ring',.06);cue('ring',.16);cue('pop',.3);cue('hangup',.78);const pq=elasticOut((t-.03)*D/.5),deskTop=C.podium.userData.top.localToWorld(new V3(-.3,1.18,.55));
   phone.visible=true;phone.position.copy(deskTop);phone.rotation.y=C.ry;phone.scale.setScalar(Math.max(.01,pq));if(t<.3){phone.position.x+=Math.sin(clock*60)*.02;phone.rotation.z=Math.sin(clock*50)*.08;fx.text(loc('¡RING!'),'#ff4b4b',up(deskTop,.5),((t-.06)*D)%.6,{life:.6,size:.6,tilt:Math.sin(clock*9)*.2});face(A,{open:1.2,size:1.1,noBlink:true});lookAt(A,deskTop);}
   if(t>=.3){S.overlay='phone';S.call=(t-.3)*D*4;S.ended=t>.78;A.armR.rotation.set(-2.55,0,.85);handset.visible=t<.92;scene.updateMatrixWorld(true);handset.position.copy(A.head.localToWorld(new V3(-1.05,-.1,.25)));handset.rotation.set(0,C.ry,.25);
    say(C,loc('¿Aló? ¿Tía?'),.33,{life:.75});fx.text(loc('¿QUIÉN HABLA?'),'#2ad1b2',new V3(0,7.4,-4.6),(t-.43)*D,{life:1,size:1.6});say(C,loc('¡Soy yo! ¿La A o la D?'),.55,{life:1.1,size:.75});fx.text(loc('¡Ay mijo, se me quema el arroz!'),'#ff8fd0',new V3(0,7.4,-4.6),(t-.66)*D,{life:1.1,size:1.6});
    face(A,{open:t>.78?.25:.8,mouth:t>.78?'natural':talk(A,16),noBlink:t>.78});if(t>.8){say(C,'…',.82,{hold:true,size:1});A.head.rotation.x=.25;host.group.position.y+=Math.abs(Math.sin(clock*12))*.04;face(host,{open:.3,mouth:'laugh',noBlink:true});}}
   break;}
  case 'audience':{cue('ooh',.2);cue('tick',.5);cue('wahwah',.8);host.group.rotation.y=.25;pose2.shrug(host,1);host.armR.rotation.set(-1.45,0,.3);face(host,{open:.5,mouth:talk(host)});hostSay(loc('¡Se vienen las apuestas!'),.05,{size:.9});
   if(t>.17){S.overlay='chart';const k=smooth((t-.17)/.5);S.bars=[0,1,2,3].map(i=>t<.72?clamp01(.25+Math.sin(clock*7+i*2)*.2*(1-k*.4)+(hsh(i+Math.floor(clock*5))-.5)*.15):.25);S.tie=t>.75;}
   if(t>.78){A.armR.rotation.set(-2.25,0,.45);A.head.rotation.x=.35;face(A,{open:.2,mouth:'natural',noBlink:true});say(C,loc('¡No puede ser!'),.82,{hold:true});}
   break;}
  case 'blank':{cue('cricket',.2);cue('cricket',.5);cue('boing',.86);spot=up(C.rig.group.position,1);S.timer=t<.6?1-t*.8:Math.max(0,.52-(t-.6)*4);if(t>.62&&t<.86)S.overlay='zero';
   if(t<.86){A.body.rotation.z=0;A.head.rotation.set(0,0,0);A.eyes.forEach(e=>e.scale.set(.45,.45,.45));setMouth(A,'talk');say(C,'…',.12,{life:1});say(C,'…',.38,{life:1});sweat(A,.5);}
   else{const q=(t-.86)/.05;C.dy=Math.sin(clamp01(q)*Math.PI)*.4*J;face(A,{open:1.5,size:1.3,mouth:'smile',noBlink:true});say(C,loc('¿Ah? ¿Qué?'),.88,{hold:true});}
   const tq=clamp01((t-.28)/.42);tumble.visible=tq>0&&tq<1;tumble.position.set(lerp(-9,9,tq),.65+Math.abs(Math.sin(tq*Math.PI*6))*.4,3.6);tumble.rotation.set(0,0,-tq*40);
   if(t>.44){host.armL.rotation.set(-1.7,0,-.3);host.head.rotation.x=.3;host.armR.rotation.set(-1.45+Math.sin(clock*14)*.2,0,.3);face(host,{open:.5,mouth:'natural'});hostSay(loc('¿Hola? ¿Tierra llamando?'),.46,{life:1.6,size:.8});}
   break;}
  case 'cheat':{cue('whistle',.44);const dir=Math.sign(N.x-C.x),lean=pulse(t,.04,.25,.6);
   A.body.rotation.z=-dir*.35*lean;C.dx=dir*.35*lean;A.head.rotation.y=dir*.6*lean;A.body.rotation.y=dir*.25*lean;face(A,{open:.45,mouth:'natural',noBlink:true});
   const Nr=N.rig;if(t>.28){lookAt(Nr,up(C.rig.group.position,1.4));Nr.body.rotation.y=-dir*.5;Nr.arms.forEach((a,i)=>a.rotation.set(-1.0,0,i?.55:-.55));face(Nr,{open:.35,mouth:'natural',noBlink:true});say(N,loc('¡OYE!'),.3,{life:1.1,color:'#ff5a3c'});}
   if(t>.42){host.armR.rotation.set(-2.8,0,.2);card.visible=true;scene.updateMatrixWorld(true);card.position.copy(tipR(host)).add(new V3(0,.2,0));card.rotation.set(0,HOST.ry,0);hostSay(loc('¡PRRRT! ¡TE VI!'),.44,{life:1.6,color:'#ff3b4e'});face(host,{open:.6,mouth:'talk',noBlink:true});}
   if(t>.6){A.arms.forEach(a=>a.rotation.set(.6,0,0));A.head.rotation.set(-.25,-dir*.4,0);face(A,{open:.6,mouth:'talk',noBlink:true});for(let k=0;k<3;k++){const ag=((clock*.8+k/3)%1);fx.text('mmm','#ffd23f',headTop(A,.8).add(new V3(Math.sin(k*2+ag*4)*.4,ag*.8,0)),ag*1.5,{life:1.5,size:.45});}say(C,loc('Yo no fui…'),.66,{hold:true,size:.8});}
   break;}
  case 'trap':{cue('buzzer',.12);cue('fall',.31);cue('boing',.62);cue('land',.79);S.opts[ans]=t>.12?'wrong':'locked';if(t>.12&&t<.3){S.overlay='x';S.k=elasticOut((t-.12)*D/.4);}C.light=t>.12?'wrong':'locked';
   const hq=backOut((t-.27)/.05);if(t>.27&&t<.9){hole.visible=true;hole.position.set(C.x,.315,C.z);hole.scale.setScalar(Math.max(.01,t<.86?hq:1-smooth((t-.86)/.04)));}
   if(t>.3)C.podium.position.y=.3-2.6*easeIn((t-.3)/.05)+(t>.7?2.6*backOut((t-.7)/.12):0);
   C.free=true;const base=new V3(C.x,.75,C.z);
   if(t<.3){A.group.position.copy(base);A.head.rotation.x=.3*smooth((t-.18)/.06);face(A,{open:1.2,mouth:'natural',noBlink:true});if(t>.2)say(C,loc('¿Eh?'),.2,{life:.6});}
   else if(t<.62){A.group.position.copy(base);A.group.position.y-=3*easeIn((t-.3)/.07);A.arms.forEach((a,i)=>a.rotation.set(-2.9,0,i?-.4:.4));face(A,{open:1.5,mouth:'smile',noBlink:true});fx.text(loc('¡CHAO!'),'#ff8fd0',new V3(C.x,2.8,C.z+.6),(t-.31)*D,{life:1.2,size:1.3});}
   else{const land=new V3(C.x,.3,C.z+1.9);if(t<.79){const q=(t-.62)/.17,p=new V3(C.x,-1.5,C.z).lerp(land,q);p.y+=4*3.4*J*q*(1-q)*1.2;A.group.position.copy(p);A.group.rotation.set(Math.PI*4*q*(J>=.4?1:0),C.ry,0);face(A,{open:1.4,mouth:'smile',noBlink:true});spring.visible=t<.7;spring.position.set(C.x,.3,C.z);spring.scale.set(1,Math.max(.01,lerp(.1,3,easeOut((t-.62)/.04))),1);}
    else{const a=(t-.79)*D;A.group.position.copy(land);squash(A,.2*J*Math.exp(-a*5)*Math.cos(a*18));dizzy(A);face(A,{open:.9,spin:clock*7,mouth:'talk',noBlink:true});fx.dust(land,a,{count:12,size:.4,spread:.9,seed:4});}
    fx.text(loc('¡BOING!'),'#7cd8ff',new V3(C.x,3.4,C.z+.8),(t-.62)*D,{life:1.2,size:1.3});}
   if(t>.36&&t<.6){host.group.position.y+=Math.abs(Math.sin(clock*12))*.05;face(host,{open:.3,mouth:'laugh',noBlink:true});hostSay('jajaja',.4,{life:1.3});}
   if(t>.8)cast.forEach(c=>{if(c!==C){c.dy=Math.abs(Math.sin(clock*10+c.i))*.05;face(c.rig,{open:.35,mouth:'laugh',noBlink:true});}});
   break;}
  case 'mangos':{cue('fanfare',.05);cue('bonk',.72);pose2.up(host);face(host,{open:.4,mouth:'laugh',noBlink:true});hostSay(loc('¡Mangos para todos!'),.04,{size:.9});spot=new V3(0,1,0);
   mangoRain.forEach((m,k)=>{const t0=.12+hsh(k)*.45,q=(t-t0)/.16;if(q<=0)return;m.visible=true;const x=k<cast.length?cast[k].x:(hsh(k*3)-.5)*16,z=k<cast.length?cast[k].z:(hsh(k*7)-.5)*6+1;
    if(k<cast.length){const c=cast[k],hp=headTop(c.rig,1.6);if(q<1)m.position.set(x,lerp(11,hp.y,easeIn(q)),z);else{pose2.up(c.rig);m.position.copy(headTop(c.rig,1.55));face(c.rig,{open:.35,mouth:'laugh',noBlink:true});if(q<1.6)fx.burst(hp,(q-1)*.16*D,{count:6,radius:.5,size:.14});}}
    else{const p=new V3(x,lerp(11,.55,Math.min(1,easeIn(q))),z);if(q>1){const a=(q-1)*.16*D;p.y=.55+Math.abs(Math.sin(a*7))*.6*Math.exp(-a*3);}m.position.copy(p);}m.rotation.set(t*12+k,t*7,0);});
   const hq=(t-.6)/.12,hm=mangoRain[21];if(hq>0){hm.visible=true;const hp=headTop(host,.9);if(hq<1){hm.position.set(hp.x,lerp(11,hp.y,easeIn(hq)),hp.z);}else{const a=(hq-1)*.12*D;hm.position.copy(hp).add(new V3(a*1.2,.4+a*2-a*a*4,0));dizzy(host);face(host,{open:.9,spin:clock*7,mouth:'talk',noBlink:true});host.body.rotation.z=Math.sin(clock*5)*.12;fx.text(loc('¡AUCH!'),'#ff5a3c',up(hp,.6),a,{life:1.2,size:1});host.armR.rotation.set(-1.45,0,.3);}}
   break;}
  case 'faint':{cue('ding',revealAt);cue('fall',.58);cue('land',.66);cue('tada',.9);spot=up(C.rig.group.position,1);if(revealed){S.opts[ans]='right';C.light='right';fx.burst(headTop(A,.4),ra,{count:10,radius:1.1,multi:true});}
   if(revealed&&t<.58){face(A,{open:1.6,size:1.3,mouth:'smile',noBlink:true});say(C,loc('¿¡GANÉ!?'),.5,{life:1});}
   C.free=true;const top=new V3(C.x,.75,C.z),fallen=new V3(C.x,.55,C.z-.95);A.group.position.copy(top);
   if(t>=.58&&t<.88){const q=smooth((t-.58)/.08);A.group.position.copy(top).lerp(fallen,q);A.group.rotation.set(-1.45*q,C.ry,0);A.arms.forEach((a,i)=>a.rotation.set(-.3,0,(i?-1:1)*1.4*q));face(A,{open:.08,mouth:'natural',noBlink:true});if(q>=1){dizzy(A,3);fx.dust(fallen,(t-.66)*D,{count:10,size:.35,seed:9});}
    const spotH=new V3(C.x+.9,.3,C.z-1.3);travel(host,HOST.pos,spotH,.6,.72,t);if(t>=.72){host.group.position.copy(spotH);host.group.rotation.y=-Math.PI/2-.4;host.armR.rotation.set(-1.6+Math.sin(clock*18)*.45,0,.3);fanCards.visible=true;scene.updateMatrixWorld(true);fanCards.position.copy(tipR(host));fanCards.rotation.set(0,host.group.rotation.y,Math.sin(clock*18)*.6);face(host,{open:.9,mouth:talk(host,20),noBlink:true});hostSay(loc('¡Aire, aire!'),.74,{life:1.4});}}
   if(t>=.88){const q=(t-.88)/.06;A.group.position.copy(fallen).lerp(top,smooth(q));A.group.position.y+=Math.sin(clamp01(q)*Math.PI)*.6;A.group.rotation.set(-1.45*(1-smooth(q)),C.ry,0);pose2.up(A);face(A,{open:.35,mouth:'laugh',noBlink:true});say(C,loc('¡GANÉ!'),.9,{hold:true,color:'#3ef08a'});host.group.position.set(C.x+.9,.3,C.z-1.3);pose2.up(host);}
   break;}
  case 'feedback':{cue('screech',.2);cue('tick',.55);cue('pop',.75);const sc=pulse(t,.18,.22,.66);face(host,{open:.5,mouth:t<.2?talk(host):'smile',noBlink:true});if(t<.2)hostSay(loc('Y ahora, la siguiente…'),.02,{life:1.2,size:.8});
   if(sc>.05){cast.forEach(c=>{pose2.ears(c.rig);squash(c.rig,.1*sc*J);face(c.rig,{open:.15,mouth:'smile',noBlink:true});});pose2.ears(host);host.armR.rotation.set(-2.5,0,-1.05);face(host,{open:.15,mouth:'smile',noBlink:true});shake+=.05*sc*J;
    banner(loc('¡IIIIIIII!'),'#ff8fd0',.2,{x:0,y:4.6,z:2,size:2.6,hold:false,life:1.4});S.overlay='glitch';spotPower=Math.floor(clock*20)%2?1:.1;}
   if(t>.55){host.armR.rotation.set(-1.45+Math.sin(clock*20)*.25,0,.3);hostSay(loc('¿Se escucha?'),.55,{life:1});hostSay(loc('¡Perdón!'),.76,{hold:true});face(host,{open:.6,mouth:'talk',noBlink:true});}
   break;}
  case 'hug':{cue('boing',.1);cue('land',.2);cue('pop',.5);cue('tada',.52);C.free=true;const top=new V3(C.x,.75,C.z),front=new V3(C.x,.3,C.z+1.6),hp=HOST.pos,dir=new V3(hp.x-front.x,0,hp.z-front.z).normalize(),meet=hp.clone().addScaledVector(dir,-.75);
   A.group.position.copy(top);if(t<.1){face(A,{open:1.3,mouth:'smile',noBlink:true});pose2.up(A);say(C,loc('¡GRACIAS!'),.02,{life:1});}
   else if(t<.2){const q=(t-.1)/.1,p=top.clone().lerp(front,q);p.y+=Math.sin(q*Math.PI)*.8;A.group.position.copy(p);pose2.up(A);}
   else if(t<.5){travel(A,front,meet,.2,.48,t);face(A,{open:.4,mouth:'laugh',noBlink:true});if(t>.48)A.group.position.copy(meet);}
   if(t>=.38&&t<.5){lookAt(host,up(A.group.position,1.4));host.arms.forEach((a,i)=>a.rotation.set(-1.0,0,(i?-1:1)*1.0));face(host,{open:1.4,size:1.2,mouth:'smile',noBlink:true});hostSay(loc('¡Epa!'),.4,{life:.9});}
   if(t>=.5){const mid=meet.clone().lerp(hp,.5),sp=t<.76?Math.PI*2*smooth((t-.5)/.24)*1.5:0,ang=Math.atan2(dir.x,dir.z)+sp,off=new V3(Math.sin(ang),0,Math.cos(ang)).multiplyScalar(.36);
    A.group.position.copy(mid).addScaledVector(off,-1);host.group.position.copy(mid).add(off);A.group.rotation.set(0,ang,0);host.group.rotation.set(0,ang+Math.PI,0);if(t<.76){A.group.position.y+=.25;host.group.position.y+=.05;}
    for(const r of [A,host])r.arms.forEach((a,i)=>a.rotation.set(-1.25,0,(i?1:-1)*.55));face(A,{open:.15,mouth:'smile',noBlink:true});
    host.setGlasses('none');face(host,{open:1.3,size:1.15,mouth:'smile',noBlink:true});
    const gq=clamp01((t-.52)/.25);if(gq<1){shades.visible=true;const p=up(hp,2.2).lerp(up(hp,.4).add(new V3(1.6,0,1.2)),gq);p.y+=Math.sin(gq*Math.PI)*1.6;shades.position.copy(p);shades.rotation.set(gq*14,gq*9,0);}else{shades.visible=true;shades.position.copy(up(hp,.36).add(new V3(1.6,0,1.2)));shades.rotation.set(-Math.PI/2,0,.4);}
    fx.burst(up(mid,1.6),(t-.5)*D,{count:12,radius:1.2,hearts:true,color:'#ff8fd0',size:.3,life:1});fx.text(loc('¡TE QUIERO, PANA!'),'#ff8fd0',up(mid,2.4),(t-.53)*D,{hold:true,size:1.1});}
   break;}
 }
 // Keep actual ladder heights and never paint fictional answers or scores.
 cast.forEach(c=>{
   if(!c.free)c.rig.group.position.set(c.x+(c.dx||0),.3+c.height+.08+c.dy,c.z);
   else c.rig.group.position.y+=c.height-.45;
   c.dx=0;
 });
 fx.end();
}
function c_dy(c,t,t0){const q=(t-t0)/.08;if(q>0&&q<1)c.dy=Math.sin(q*Math.PI)*.3;}

function reset() {
 for(const r of tinted)tint(r,null,0);tinted.clear();
 for(const slot of slots){slot.podium.position.y=.3;const r=slot.character;if(!r)continue;
   r.resetPose();r.neck.rotation.set(0,0,0);r.body.scale.set(1,1,1);r.group.scale.setScalar(1);r.group.rotation.set(0,slot.podium.rotation.y,0);
   r.arms.forEach(a=>a.scale.setScalar(1));r.eyes.forEach((e,i)=>{e.scale.setScalar(1);e.rotation.z=i?-.15:.15;});
   r.setExpression(({feliz:'smile',lengua:'talk',wow:'laugh'})[r.avatar.face]||'natural',{immediate:true});delete r._m;
   r.group.position.copy(slot.podium.position);r.group.position.y+=slot.height+.08;
 }
 host.resetPose();host.neck.rotation.set(0,0,0);host.body.scale.setScalar(1);host.arms.forEach(a=>a.scale.setScalar(1));host.eyes.forEach((e,i)=>{e.scale.setScalar(1);e.rotation.z=i?-.15:.15;});
 host.group.position.copy(HOST.pos);host.group.rotation.set(0,HOST.ry,0);host.group.scale.setScalar(1);host.setGlasses('sun');host.setExpression('laugh',{immediate:true});delete host._m;
 buzzers.forEach(({dome,m})=>{dome.scale.setScalar(1);m.emissiveIntensity=.25;});
 scene.visible=false;
}
return {
 render(event,age,state,audible=true) {
   cast=state.players.filter(p=>slots[p.seat].podium.visible&&slots[p.seat].character).map(p=>{
     const slot=slots[p.seat],b=buzzers[p.seat];slot.character.seed=p.seat*1.7+.3;
     return {i:p.seat,name:p.name,slot,podium:slot.podium,rig:slot.character,x:slot.podium.position.x,z:slot.podium.position.z,ry:slot.podium.rotation.y,buzzer:b.b,dome:b.dome};
   });
   selected=cast.findIndex(c=>c.i===event.seat);if(selected<0){reset();return;}
   neighbor=cast.findIndex(c=>c.i===state.players[event.seat]?.copy);
   scene.visible=true;action=event.action;curVar=event.variant||'classic';duration=event.duration||4;
   const nextProgress=Math.min(1,age/duration);
   previousProgress=cueKey===event.key?progress:nextProgress;cueKey=event.key;
   progress=nextProgress;cuesEnabled=audible&&!event.key.startsWith('preview:');ambient.clock=age;host.seed=9.1;
   pose();
 }, reset,
 dispose(){reset();disposeModel(mic);buzzers.forEach(({b})=>disposeModel(b));disposeModel(scene);
   for(const texture of [soft,starTex,heartTex,flashTex,...texCache.values()])texture.dispose();texCache.clear();
   for(const material of tintMaterials.values())material.dispose();tintMaterials.clear();
 },
 get root(){return scene;}
};
}
