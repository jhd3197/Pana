import * as THREE from 'three';
import { rng, clamp, lerp, smoothstep } from '/engine/random.js';
import { panaOfFighter } from './panas.js';
import { getFighterDefinition } from './combat/roster.js';
import { createLightningEffects } from './lightning-effects.js';
// Each pana's poder (the neutral special) as short, bounded match effects:
// a charge over startup, the signature over the active frames, an impact on
// the authoritative hit event and a look on the target while a status lasts.
// Adapted from the cinematic Prueba de golpes timelines: no freezes, no cuts.
const S=.014, TAU=Math.PI*2, MOVE='neutral-special';
// Projectile kinds drawn here; the scene's generic sphere skips them.
export const POWER_PROJECTILES=new Set(['raspado','gust']);
const col=hex=>new THREE.Color(hex);
const C={
  white:col('#ffffff'),yellow:col('#ffe14a'),gold:col('#ffd23a'),blue:col('#7ac8ff'),ice:col('#bff0ff'),
  orange:col('#ff8020'),fire:col('#ff3010'),purple:col('#8b4fe0'),pink:col('#ff7ab0'),cyan:col('#5ae0ff'),
  rope:col('#c8a060'),crumb:col('#f2deb0'),dust:col('#d8ccb0'),green:col('#3ab04a'),red:col('#e0263a'),
  royal:col('#3d7bf2'),coffee:col('#6b3e26'),mist:col('#2a3350'),pale:col('#9ad8ff'),sea:col('#1f8fd0'),
  foam:col('#eaf8ff'),marble:col('#d8d4c8'),cream:col('#ffd8a0'),horn:col('#ff7a4a'),venom:col('#7aff6a'),stone:col('#a8a49c'),smoke:col('#4a403a'),dirt:col('#7a5a3a'),
};
function canvasTexture(w,h,draw) {
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function radial(ctx,w,stops) {
  const g=ctx.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);for(const [o,c] of stops)g.addColorStop(o,c);
  ctx.fillStyle=g;ctx.fillRect(0,0,w,w);
}
export function createPoderEffects(root) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), rand=rng(4127), group=new THREE.Group();root.add(group);
  const clear='rgba(255,255,255,0)';
  const T={
    soft:canvasTexture(64,64,(c,w)=>radial(c,w,[[0,'#fff'],[.25,'rgba(255,255,255,.75)'],[1,clear]])),
    ring:canvasTexture(128,128,(c,w)=>radial(c,w,[[0,clear],[.6,clear],[.8,'#fff'],[1,clear]])),
    star:canvasTexture(128,128,(c,w)=>{
      radial(c,w,[[0,'rgba(255,255,255,.9)'],[.45,'rgba(255,255,255,.2)'],[1,clear]]);
      c.translate(w/2,w/2);c.fillStyle='#fff';c.beginPath();
      for(let k=0;k<16;k++){const a=k/16*TAU,r=k%2?w*.1:w*.48;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.fill();
    }),
    ribbon:canvasTexture(64,16,(c,w,h)=>{
      const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,clear);g.addColorStop(.75,'#fff');g.addColorStop(1,clear);
      c.fillStyle=g;c.fillRect(0,0,w,h);c.globalCompositeOperation='destination-in';
      const v=c.createLinearGradient(0,0,0,h);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(.5,'#000');v.addColorStop(1,'rgba(0,0,0,0)');
      c.fillStyle=v;c.fillRect(0,0,w,h);
    }),
    streak:canvasTexture(128,32,(c,w,h)=>{
      const r=rng(11);
      for(let k=0;k<9;k++){c.strokeStyle=`rgba(255,255,255,${.4+r()*.5})`;c.lineWidth=2+r()*4;const y=4+r()*(h-8);
        c.beginPath();c.moveTo(r()*w*.3,y);c.lineTo(w*.6+r()*w*.4,y+(r()-.5)*6);c.stroke();}
    }),
    z:canvasTexture(64,64,(c,w)=>{
      c.font='bold 54px sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=7;c.strokeStyle='#22305a';
      c.strokeText('Z',w/2,w/2+3);c.fillStyle='#fff';c.fillText('Z',w/2,w/2+3);
    }),
    note:canvasTexture(64,64,c=>{
      c.fillStyle='#fff';c.beginPath();c.ellipse(22,47,11,8,-.4,0,TAU);c.fill();c.fillRect(29,10,5,37);
      c.beginPath();c.moveTo(34,10);c.quadraticCurveTo(54,18,48,36);c.quadraticCurveTo(46,24,34,22);c.fill();
    }),
    arepa:canvasTexture(128,128,(c,w)=>{
      radial(c,w,[[0,'#f3d58e'],[.8,'#e2b763'],[1,'#c48a3c']]);const r=rng(5);c.fillStyle='rgba(120,70,25,.55)';
      for(let k=0;k<26;k++){const a=r()*TAU,d=r()*w*.42;c.beginPath();c.ellipse(w/2+Math.cos(a)*d,w/2+Math.sin(a)*d,2+r()*6,2+r()*4,r()*3,0,TAU);c.fill();}
    }),
  };
  T.streak.wrapS=THREE.RepeatWrapping;
  // Shared geometry, created on first use and disposed once.
  const geo={}, G=(key,make)=>geo[key]??=make();
  const basic=(color,o={})=>new THREE.MeshBasicMaterial({color,transparent:true,depthWrite:false,toneMapped:false,...o});
  const standard=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:.7,...o});
  const mesh=(geometry,material,parent)=>{const m=new THREE.Mesh(geometry,material);parent.add(m);return m;};
  // A unit cylinder stretched between two points in the stage plane.
  function stretch(m,ax,ay,bx,by,z,r) {
    const dx=bx-ax,dy=by-ay;m.position.set((ax+bx)/2,(ay+by)/2,z);
    m.rotation.set(0,0,Math.atan2(dy,dx)-Math.PI/2);m.scale.set(r,Math.max(.001,Math.hypot(dx,dy)),r);
  }

  // One point-sprite particle pool, sized in world units from the drawing buffer.
  const PARTICLES=reduced.matches?240:560;
  const parts=(()=>{
    const n=PARTICLES, f=k=>new Float32Array(n*k);
    const pos=f(3),rgb=f(3),size=f(1),alpha=f(1),vel=f(3),life=f(1),max=f(1).fill(1),c0=f(3),c1=f(3),s0=f(1),s1=f(1),drag=f(1),grav=f(1),a0=f(1);
    const geometry=new THREE.BufferGeometry();
    for(const [name,arr,k] of [['position',pos,3],['aColor',rgb,3],['aSize',size,1],['aAlpha',alpha,1]])
      geometry.setAttribute(name,new THREE.BufferAttribute(arr,k).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uMap:{value:T.soft},uScale:{value:500}},
      vertexShader:`attribute vec3 aColor;attribute float aSize;attribute float aAlpha;uniform float uScale;varying vec3 vC;varying float vA;
        void main(){vC=aColor;vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=aAlpha>0.0?aSize*uScale/-mv.z:0.0;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform sampler2D uMap;varying vec3 vC;varying float vA;
        void main(){float a=texture2D(uMap,gl_PointCoord).a*vA;if(a<.004)discard;gl_FragColor=vec4(vC,a);}`});
    const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.renderOrder=7;group.add(points);
    const buffer=new THREE.Vector2();
    points.onBeforeRender=(renderer,scene,camera)=>{renderer.getDrawingBufferSize(buffer);material.uniforms.uScale.value=buffer.y/(2*Math.tan((camera.fov??50)*Math.PI/360));};
    let next=0,dirty=false;
    return {
      spawn(p,x,y,z,vx,vy,vz,tint) {
        const i=next;next=(next+1)%n;const j=i*3,a=tint??(p.c0.length?p.c0[(rand()*p.c0.length)|0]:p.c0),b=p.c1??a;
        pos[j]=x;pos[j+1]=y;pos[j+2]=z;vel[j]=vx;vel[j+1]=vy;vel[j+2]=vz;
        c0[j]=a.r;c0[j+1]=a.g;c0[j+2]=a.b;c1[j]=b.r;c1[j+1]=b.g;c1[j+2]=b.b;
        life[i]=max[i]=p.life*(.75+rand()*.5);s0[i]=p.s0;s1[i]=p.s1;drag[i]=p.drag;grav[i]=p.grav;a0[i]=p.a;dirty=true;
      },
      update(dt) {
        if(!dirty)return;let any=false;
        for(let i=0;i<n;i++) {
          if(life[i]<=0){alpha[i]=0;continue;}
          any=true;life[i]-=dt;const u=1-Math.max(0,life[i])/max[i],d=Math.exp(-drag[i]*dt),j=i*3;
          vel[j]*=d;vel[j+1]=vel[j+1]*d-grav[i]*dt;vel[j+2]*=d;
          pos[j]+=vel[j]*dt;pos[j+1]+=vel[j+1]*dt;pos[j+2]+=vel[j+2]*dt;
          for(let k=0;k<3;k++)rgb[j+k]=c0[j+k]+(c1[j+k]-c0[j+k])*u;
          size[i]=s0[i]+(s1[i]-s0[i])*u;alpha[i]=life[i]>0?a0[i]*(1-u)*Math.min(1,u*12):0;
        }
        for(const k of ['position','aColor','aSize','aAlpha'])geometry.attributes[k].needsUpdate=true;
        dirty=any;
      },
      clear(){life.fill(0);dirty=true;},
      dispose(){geometry.dispose();material.dispose();},
    };
  })();
  // Particle presets: sizes are world-unit diameters, a pana is about 1.3 tall.
  const P={
    spark:{life:.4,s0:.16,s1:0,c0:[C.white,C.yellow],drag:3,grav:4,a:1},
    fire:{life:.35,s0:.3,s1:.05,c0:[col('#fff0a0'),col('#ffc040')],c1:C.fire,drag:3,grav:-3,a:1},
    smoke:{life:1,s0:.35,s1:1,c0:C.smoke,drag:2,grav:-1.2,a:.5},
    snow:{life:.45,s0:.16,s1:.03,c0:[C.white,col('#cfefff'),col('#a8dcff')],drag:2,grav:0,a:.95},
    dust:{life:.7,s0:.25,s1:.7,c0:C.dust,drag:2.5,grav:-.4,a:.6},
    steam:{life:.9,s0:.1,s1:.42,c0:C.white,drag:1,grav:-.6,a:.5},
    coffee:{life:.45,s0:.13,s1:.06,c0:[C.coffee,col('#4a2a14'),col('#8a5a34')],drag:1,grav:9,a:1},
    feather:{life:.8,s0:.14,s1:.1,c0:[C.red,C.gold,C.royal,C.green],drag:2.5,grav:1.5,a:1},
    mist:{life:.9,s0:.4,s1:1.1,c0:C.mist,drag:3,grav:-.3,a:.6},
    water:{life:.5,s0:.14,s1:.02,c0:[C.cyan,C.white,C.sea],drag:1.5,grav:6,a:.9},
    foam:{life:.45,s0:.16,s1:.42,c0:C.foam,drag:2,grav:2,a:.9},
    venom:{life:.4,s0:.11,s1:0,c0:C.venom,drag:2,grav:-1,a:1},
    stone:{life:.7,s0:.14,s1:.36,c0:C.stone,drag:2,grav:3,a:.8},
    crumb:{life:.6,s0:.3,s1:.7,c0:C.crumb,drag:3,grav:1,a:.85},
    bone:{life:.55,s0:.12,s1:.06,c0:[C.white,col('#f2ead8')],drag:1.5,grav:9,a:1},
  };
  const count=n=>reduced.matches?Math.ceil(n*.4):n;
  // Stochastic per-frame count for a per-second rate.
  const rate=(perSecond,dt)=>{const k=perSecond*dt*(reduced.matches?.5:1);return Math.floor(k)+(rand()<k%1?1:0);};
  function burst(p,x,y,z,n,v0,v1,up=0,tint) {
    for(let k=count(n);k>0;k--) {
      const u=rand()*2-1,a=rand()*TAU,r=Math.sqrt(1-u*u),sp=v0+rand()*(v1-v0);
      parts.spawn(p,x,y,z,r*Math.cos(a)*sp,(u+up)*sp,r*Math.sin(a)*sp*.5,tint);
    }
  }

  // Billboards and ground rings: a fixed ring of quads, reused oldest first.
  const quad=new THREE.PlaneGeometry(1,1), flashes=Array.from({length:24},()=>{
    const m=mesh(quad,basic('#fff',{map:T.soft,side:THREE.DoubleSide}),group);m.visible=false;m.renderOrder=8;
    return {m,t:0,life:0,s0:0,s1:0,spin:0,vy:0,flat:false,a:1};
  });
  let nextFlash=0;
  // mode 0 faces the camera, 1 lies on the floor; vy lifts it (notes), spin turns it.
  function flash(map,color,x,y,s0,s1,life,mode=0,vy=0,spin=0,strong=false) {
    const e=flashes[nextFlash];nextFlash=(nextFlash+1)%flashes.length;
    e.m.material.map=map;e.m.material.color.copy(color);e.m.position.set(x,y,mode===1?.35:.7);e.m.visible=true;
    e.t=0;e.life=life;e.s0=s0;e.s1=s1;e.spin=spin;e.vy=vy;e.flat=mode===1;e.a=strong&&reduced.matches?.45:1;
  }

  // ----- Signature kits, one per fighter, built for that fighter's pana -----
  const once=(k,c,bit)=>{if(k.act!==c.act){k.act=c.act;k.done=0;}if(k.done&bit)return false;k.done|=bit;return true;};
  const hitNow=(k,c,window=.35)=>k.hitAct===c.act&&time-k.hitAt<window;
  const fade=(materials,o)=>{for(const m of materials)m.opacity=o;};
  let time=0, shake=0;
  const KITS={
    // Rayo: crackle on the raised hammer, the sky strikes it, then it jumps to the target.
    trueno() {
      const L=createLightningEffects(group), pos={x:0,y:0};
      const trial={phase:'idle',age:0,casts:0,active:{lightning:true,flash:true,shake:false,shakeStrength:0},
        combat:{fighters:[{position:pos}]},impact:{from:{x:0,y:0},to:{x:0,y:0}}};
      // lightning-effects offsets a "hand" point by (.48, .26); undo it so points land where meant.
      const put=(p,x,y,hand)=>{p.x=(x-(hand?.48:0))/S;p.y=(y-(hand?.26:0))/S;};
      return {
        tick(c,k,camera) {
          trial.phase='idle';
          if(c.phase) {
            const hx=c.hx,hy=c.y+c.H*.42,u=c.t/c.su;
            if(c.phase==='charge'&&u<.55) {
              trial.phase='charge';trial.age=c.t/60;put(pos,hx,hy,true);
              for(let n=rate(40,c.dt);n>0;n--)parts.spawn(P.spark,hx,hy,.75,(rand()-.5)*3,(rand()-.5)*3,0,rand()<.5?C.yellow:C.blue);
            } else if(c.phase==='charge') {
              if(once(k,c,1))trial.casts++;
              trial.phase='impact';trial.age=(c.t-c.su*.55)/60;put(trial.impact.from,hx+c.fc*.3,c.y+6,true);put(trial.impact.to,hx,hy,false);
            } else if(c.at<14) {
              if(once(k,c,2))trial.casts++;
              trial.phase='impact';trial.age=c.at/60;put(trial.impact.from,hx+c.fc*.15,c.y+c.H*.2,true);
              if(hitNow(k,c,.3))put(trial.impact.to,k.tx,k.ty,false);
              else put(trial.impact.to,c.x+c.fc*c.move.offset.x*S,c.y+c.move.offset.y*S,false);
            }
          }
          // Skip the buffer upload while nothing is drawn.
          if(trial.phase!=='idle'||k.drawn)L.frame(trial,camera,reduced.matches);
          k.drawn=trial.phase!=='idle';
        },
        hit(k,x,y,feet) {
          burst(P.spark,x,y,.75,26,2,6,.2);burst(P.spark,x,y,.75,10,1,4,0,C.blue);
          flash(T.star,C.yellow,x,y,.4,2,.3,0,0,2,true);flash(T.ring,C.yellow,x,feet,.4,2.6,.45,1);shake=Math.max(shake,.1);
        },
        dispose(){L.dispose();},
      };
    },
    // Candela: fists catch fire, a flame streak trails the lunge.
    boxeador() {
      const g=new THREE.Group();group.add(g);
      const streak=mesh(quad,basic(C.orange,{map:T.ribbon,side:THREE.DoubleSide}),g);streak.renderOrder=7;
      return {
        tick(c) {
          g.visible=false;if(!c.phase)return;
          if(c.phase==='charge') {
            for(let n=rate(60,c.dt);n>0;n--){const back=rand()<.5;
              parts.spawn(P.fire,(back?c.x-c.fc*c.W*.2:c.hx)+(rand()-.5)*.15,c.hy+(rand()-.5)*.12,.7,(rand()-.5)*.4,1+rand()*1.5,0);}
          } else if(c.at<c.ac+6) {
            g.visible=true;const o=1-c.at/(c.ac+6);
            streak.position.set(c.hx-c.fc*.75,c.hy,.65);streak.scale.set(1.6*c.fc,.45,1);streak.material.opacity=o;
            for(let n=rate(140,c.dt);n>0;n--)parts.spawn(P.fire,c.hx+(rand()-.5)*.2,c.hy+(rand()-.5)*.2,.7,-c.fc*(3+rand()*4),rand()*.8,0);
          }
        },
        hit(k,x,y,feet) {
          burst(P.fire,x,y,.75,30,1.5,5,.1);burst(P.smoke,x,y,.6,8,.5,1.8,.3);
          flash(T.soft,C.orange,x,y,.5,2,.3,0,0,0,true);flash(T.ring,C.orange,x,feet,.4,2.4,.4,1);
        },
      };
    },
    // Hielo: cold gathers in the hand; the raspado itself is drawn with the projectiles.
    raspadero() {
      return {
        tick(c,k) {
          if(c.phase==='charge')for(let n=rate(70,c.dt);n>0;n--) {
            const a=rand()*TAU,r=.4+rand()*.3,x=c.hx+Math.cos(a)*r,y=c.hy+Math.sin(a)*r;
            parts.spawn(P.snow,x,y,.7,(c.hx-x)*2.6,(c.hy-y)*2.6,0);
          }
          if(c.phase==='active'&&once(k,c,1))burst(P.snow,c.hx,c.hy,.7,10,1,2.5);
        },
        hit(k,x,y,feet) {
          burst(P.snow,x,y,.75,24,1.2,4);burst(P.spark,x,y,.75,10,1.5,4,0,C.ice);
          flash(T.soft,C.ice,x,y,.5,2,.3,0,0,0,true);flash(T.ring,C.ice,x,feet,.4,2.4,.45,1);
        },
      };
    },
    // Jonrón: a called-shot glint, then a wide swing arc and a star on contact.
    pelotero() {
      const g=new THREE.Group();group.add(g);
      const arc=mesh(G('arc',()=>new THREE.RingGeometry(.55,1,28,1,0,Math.PI*1.15)),basic(C.purple,{side:THREE.DoubleSide}),g);
      const edge=mesh(G('arcEdge',()=>new THREE.RingGeometry(.9,1.02,28,1,0,Math.PI*1.15)),basic(C.white,{side:THREE.DoubleSide}),g);
      return {
        tick(c,k) {
          g.visible=false;if(!c.phase)return;
          if(c.phase==='charge') {
            if(c.t/c.su>.3&&once(k,c,1))flash(T.star,C.gold,c.x-c.fc*.25,c.y+c.H*.7,.15,.8,.4,0,0,6);
            for(let n=rate(20,c.dt);n>0;n--)parts.spawn(P.spark,c.x-c.fc*.25+(rand()-.5)*.3,c.y+c.H*.5,.7,0,.8,0,C.purple);
          } else if(c.at<c.ac+10) {
            const u=c.at/(c.ac+10);g.visible=true;
            g.position.set(c.x+c.fc*.2,c.hy,.65);g.scale.set(c.fc*c.move.radius*S*1.3,c.move.radius*S*1.3,1);
            g.rotation.z=c.fc*lerp(.9,-1.7,smoothstep(Math.min(1,c.at/(c.ac+2))));
            fade([arc.material,edge.material],(1-u)*.85);
          }
        },
        hit(k,x,y,feet) {
          flash(T.star,C.gold,x,y,.4,2,.4,0,0,2,true);flash(T.soft,C.white,x,y,.6,2.4,.25,0,0,0,true);
          for(const t of [C.white,C.gold,C.pink,C.cyan])burst(P.spark,x,y,.75,9,3,8,.1,t);
          flash(T.ring,C.purple,x,feet,.4,2.8,.45,1);shake=Math.max(shake,.14);
        },
      };
    },
    // Lazo: the loop twirls overhead, flies along the hitbox reach, tightens on a catch.
    llanero() {
      const g=new THREE.Group();group.add(g);const m=standard(C.rope,{roughness:.9});
      const loop=mesh(G('loop',()=>new THREE.TorusGeometry(1,.09,6,28)),m,g), rope=mesh(G('rope',()=>new THREE.CylinderGeometry(1,1,1,5)),m,g);
      return {
        tick(c,k) {
          g.visible=!!c.phase;if(!c.phase)return;
          const ax=c.x+c.fc*.25,ay=c.y+c.H*.3;let lx,ly,s=.32,tilt=0;
          if(c.phase==='charge') {
            const a=time*15;lx=c.x+c.fc*.1+Math.cos(a)*.12;ly=c.y+c.H*.62+Math.sin(a)*.03;tilt=Math.PI/2-.35;s=.28;
            if(rand()<c.dt*6)parts.spawn(P.dust,c.x+(rand()-.5),c.feet+.05,.6,(rand()-.5)*1.5,.6,0);
          } else if(hitNow(k,c)) {
            lx=k.tx;ly=k.ty;s=lerp(.42,.26,Math.min(1,(time-k.hitAt)/.12));tilt=Math.PI/2-.2;
          } else if(c.at<=c.ac) {
            const p=clamp(c.at/6),off=lerp(40,165,p);lx=c.x+c.fc*off*S;ly=c.y+12*S;s=.36;
          } else {
            const r=clamp((c.at-c.ac)/10);if(r>=1){g.visible=false;return;}
            lx=lerp(c.x+c.fc*165*S,ax,r);ly=lerp(c.y+12*S,ay,r);s=lerp(.36,.15,r);
          }
          loop.position.set(lx,ly,.65);loop.rotation.set(tilt,0,0);loop.scale.setScalar(s);
          stretch(rope,ax,ay,lx-c.fc*s,ly,.65,.022);
        },
        hit(k,x,y,feet) {
          burst(P.dust,x,feet+.1,.6,10,.8,2,.5);burst(P.spark,x,y,.75,10,2,5,0,C.gold);flash(T.star,C.white,x,y+.3,.2,1,.3,0,0,4);
        },
      };
    },
    // Arepazo: the arepa flips up, grows over the hitbox and slams flat.
    arepero() {
      const g=new THREE.Group();group.add(g);
      const mats=[standard('#c8903c',{transparent:true}),standard('#ffffff',{map:T.arepa,transparent:true}),standard('#b07a34',{transparent:true})];
      const disc=mesh(G('disc',()=>new THREE.CylinderGeometry(1,1,.18,28)),mats,g);
      const shadeMat=basic('#1a140c',{opacity:0}), shade=mesh(G('shade',()=>new THREE.CircleGeometry(1,24)),shadeMat,g);shade.rotation.x=-Math.PI/2;
      const R=.95;
      return {
        tick(c,k) {
          g.visible=!!c.phase;if(!c.phase)return;
          if(once(k,c,1)){k.x0=c.x+c.fc*c.move.offset.x*S;k.floor=c.feet;}
          const top=c.y+c.H*1.7;let x=k.x0,y,s=R,spin=0,squash=1,o=1;
          if(c.phase==='charge') {
            const u=c.t/c.su,e=smoothstep(u);x=lerp(c.hx,k.x0,e);y=lerp(c.hy,top,Math.sin(Math.min(1,u*1.3)*Math.PI/2));
            s=lerp(.15,R,e);spin=-c.fc*u*TAU*1.5;shadeMat.opacity=.35*u;
            if(rand()<c.dt*20)parts.spawn(P.steam,x+(rand()-.5)*s,y+.1,.6,0,.8,0);
          } else if(c.at<c.ac) {
            const p=clamp((c.at+1)/c.ac);y=lerp(top,k.floor+.09,p*p);shadeMat.opacity=.35;
          } else {
            if(once(k,c,2)) {
              burst(P.crumb,k.x0,k.floor+.15,.6,20,1.5,4,.3);burst(P.spark,k.x0,k.floor+.3,.7,10,2,5,.6,C.gold);
              flash(T.ring,C.gold,k.x0,k.floor,.6,3.4,.5,1);shake=Math.max(shake,.12);
            }
            const r=clamp((c.at-c.ac)/Math.max(1,c.re));squash=1-Math.sin(c.at*.9)*.12*(1-r);
            o=1-smoothstep((r-.55)/.45);y=k.floor+.09*squash;shadeMat.opacity=.35*o;
          }
          // Tilted toward the low match camera so its toasted face reads, not its rim.
          disc.position.set(x,y,.35);disc.rotation.set(c.phase==='charge'?.55:.3,0,spin);disc.scale.set(s*(2-squash),s*squash,s*(2-squash)*.7);
          shade.position.set(k.x0,k.floor+.015,.35);shade.scale.setScalar(R*(c.phase==='charge'?.3+c.t/c.su*.7:1));fade(mats,o);
        },
        hit(k,x,y) {flash(T.star,C.gold,x,y,.3,1.4,.3,0,0,3,true);burst(P.crumb,x,y,.7,8,1,2.5,.3);},
      };
    },
    // Tambor: each beat of the active window sends a ring out of the drum, the fourth one gold.
    tamborero() {
      const tints=[C.white,C.green,C.red,C.gold];
      return {
        tick(c,k) {
          if(!c.phase)return;const dx=c.x+c.fc*c.W*.55,dy=c.y-c.H*.05;
          if(c.phase==='charge'){for(let n=rate(20,c.dt);n>0;n--)parts.spawn(P.spark,dx+(rand()-.5)*.3,dy,.7,0,1,0,C.green);return;}
          if(c.phase!=='active')return;
          const b=Math.min(3,Math.floor(c.at/Math.max(1,c.ac/4))),big=b===3;
          if(!once(k,c,1<<b))return;
          flash(T.ring,tints[b],dx,dy+.1,.4,big?3.2:1.6+b*.35,big?.55:.4);flash(T.ring,C.green,dx,c.feet,.4,big?3.6:1.8+b*.35,.45,1);
          for(const t of [C.gold,C.green,C.red,C.royal])burst(P.spark,dx,dy+.2,.7,big?6:2,1.5,big?6:3.5,.8,t);
          flash(T.note,tints[(b+1)%4],dx+(rand()-.5)*.4,dy+.4,.3,.36,.7,0,1.2);
          if(big){flash(T.note,C.gold,dx-.3,dy+.5,.3,.36,.8,0,1.5);shake=Math.max(shake,.06);}
        },
        hit(k,x,y) {flash(T.star,C.white,x,y,.2,.9,.22,0,0,3);},
      };
    },
    // Ventarrón: feathers off the wings, one flap ring; the gust is drawn with the projectiles.
    guacamayo() {
      return {
        tick(c,k) {
          if(c.phase!=='charge')return;
          for(let n=rate(30,c.dt);n>0;n--)parts.spawn(P.feather,c.x+(rand()-.5)*.8,c.y+rand()*c.H*.4,.6,(rand()-.5)*2,-.3+rand(),0);
          if(c.t/c.su>.8&&once(k,c,1)){flash(T.ring,C.white,c.x+c.fc*.3,c.y,.4,1.8,.35);burst(P.feather,c.x,c.y,.6,10,1.5,3.5);}
        },
        hit(k,x,y,feet) {burst(P.feather,x,y,.7,18,1.5,4.5,.3);flash(T.ring,C.white,x,feet,.4,2.2,.4,1);flash(T.star,C.white,x,y,.2,1,.25,0,0,4);},
      };
    },
    // Cafecito: a door grows out of the floor at the reach and creaks open; coffee flies.
    manguangua() {
      const g=new THREE.Group();group.add(g);
      const wood=standard('#5a3a22'), panel=standard('#8a5a34'), brass=standard('#ffc629',{metalness:.4,roughness:.4});
      const box=G('box',()=>new THREE.BoxGeometry(1,1,1));
      const post=x=>{const m=mesh(box,wood,g);m.position.set(x,.85,0);m.scale.set(.08,1.7,.12);};post(-.46);post(.46);
      const lintel=mesh(box,wood,g);lintel.position.set(0,1.7,0);lintel.scale.set(1,.08,.12);
      const hinge=new THREE.Group();hinge.position.x=-.42;g.add(hinge);
      const leaf=mesh(box,panel,hinge);leaf.position.set(.42,.81,0);leaf.scale.set(.84,1.62,.06);
      const knob=mesh(G('knob',()=>new THREE.SphereGeometry(.045,8,6)),brass,hinge);knob.position.set(.74,.8,.05);
      return {
        tick(c,k) {
          g.visible=!!c.phase;if(!c.phase)return;
          if(once(k,c,1)){k.x0=c.x+c.fc*c.move.offset.x*S;k.floor=c.feet;k.fc=c.fc;}
          let rise=1,open=1;
          if(c.phase==='charge') {
            const u=c.t/c.su;rise=smoothstep(u/.6);open=smoothstep((u-.6)/.4);
            if(rand()<c.dt*12)parts.spawn(P.steam,c.hx,c.hy+.15,.65,(rand()-.5)*.2,.9,0);
          } else if(c.phase==='active') {
            for(let n=rate(90,c.dt);n>0;n--)parts.spawn(P.coffee,c.hx,c.hy+.1,.7,c.fc*(3+rand()*2.5),1.5+rand()*2,(rand()-.5));
          } else {
            const r=clamp((c.at-c.ac)/Math.max(1,c.re));open=1-smoothstep(r/.4);rise=1-smoothstep((r-.5)/.5);
          }
          g.position.set(k.x0,k.floor,-.35);g.scale.set(-k.fc,Math.max(.01,rise),1);hinge.rotation.y=-1.7*open;
        },
        hit(k,x,y) {
          burst(P.coffee,x,y+.2,.75,18,1.5,4,.5);burst(P.steam,x,y+.3,.7,6,.3,1,1);flash(T.star,C.cream,x,y,.2,1.1,.25,0,0,3);
        },
      };
    },
    // Silbido: whistle rings and night mist on startup, a dark shadow trail across the stage.
    silbon() {
      return {
        tick(c,k) {
          if(!c.phase)return;
          if(c.phase==='charge') {
            for(let n=rate(18,c.dt);n>0;n--)parts.spawn(P.mist,c.x+(rand()-.5),c.feet+rand()*c.H*.6,.5,(rand()-.5)*.6,.2,0);
            const beat=Math.floor(c.t/7);if(once(k,c,1<<Math.min(6,beat)))flash(T.ring,C.pale,c.x+c.fc*.15,c.y+c.H*.35,.15,.9,.45);
          } else if(c.at<c.ac+8) {
            if(once(k,c,1<<7))burst(P.mist,c.x,c.y,.5,12,.5,1.5);
            for(let n=rate(110,c.dt);n>0;n--)parts.spawn(P.mist,c.x-c.fc*rand()*.4,c.y+(rand()-.5)*c.H*.8,.45,-c.fc*rand(),(rand()-.5)*.4,0);
            for(let n=rate(30,c.dt);n>0;n--)parts.spawn(P.spark,c.x,c.y+(rand()-.5)*c.H*.6,.7,-c.fc*2,0,0,C.pale);
          }
        },
        hit(k,x,y) {flash(T.ring,C.pale,x,y,.3,2,.45);burst(P.bone,x,y,.75,14,2,5,.6);burst(P.spark,x,y,.75,10,1.5,4,0,C.pale);},
      };
    },
    // Maremoto: water spirals up, the trident strikes the floor and a wave sweeps the reach.
    poseidon() {
      const g=new THREE.Group();group.add(g);
      const wave=mesh(G('wave',()=>{
        const s=new THREE.Shape();s.moveTo(-1.6,0);s.lineTo(1.9,0);s.bezierCurveTo(1.9,.7,2,1.5,1.4,1.7);
        s.bezierCurveTo(1,1.82,.75,1.5,1.05,1.3);s.bezierCurveTo(.6,1.2,-.4,.6,-1.6,0);
        return new THREE.ExtrudeGeometry(s,{depth:.8,bevelEnabled:false}).translate(0,0,-.4);
      }),standard(C.sea,{transparent:true,opacity:.85,roughness:.25,emissive:'#0a3a5a',side:THREE.DoubleSide}),g);
      const reach=c=>{const h=c.move.hitboxes?.[0];return h?[h.offset.x,h.endOffset?.x??h.offset.x,h.offset.y]:[c.move.offset.x,c.move.offset.x,c.move.offset.y];};
      return {
        tick(c,k) {
          g.visible=false;if(!c.phase)return;
          if(c.phase==='charge') {
            for(let n=rate(60,c.dt);n>0;n--){const a=rand()*TAU;
              parts.spawn(P.water,c.x+Math.cos(a)*.5,c.feet+rand()*.3,.4+Math.sin(a)*.25,-Math.sin(a)*1.5,3+rand()*2,Math.cos(a));}
            for(let n=rate(15,c.dt);n>0;n--)parts.spawn(P.spark,c.hx,c.y+c.H*.5,.7,(rand()-.5),(rand()-.5),0,C.cyan);
            return;
          }
          const [x0,x1]=reach(c), sweep=Math.max(1,c.ac-1);
          if(once(k,c,1)){flash(T.ring,C.cyan,c.hx,c.feet,.4,2.4,.45,1);burst(P.water,c.hx,c.feet+.2,.6,14,1.5,4,1);k.floor=c.feet;}
          const r=c.at<c.ac?0:clamp((c.at-c.ac)/12);if(r>=1)return;
          const wx=c.x+c.fc*lerp(x0,x1,clamp(c.at/sweep))*S, sw=.75, rise=smoothstep(c.at/5)*(1-smoothstep(r));
          g.visible=true;g.position.set(wx-c.fc*1.5*sw,k.floor,.1);g.scale.set(c.fc*sw,Math.max(.01,sw*rise),1);
          wave.material.opacity=.85*(1-r);
          if(rise>.5)for(let n=rate(60,c.dt);n>0;n--)parts.spawn(P.foam,wx+(rand()-.5)*.3,k.floor+1.25*sw*rise,.6+(rand()-.5)*.6,c.fc*rand()*2,rand()*1.5,0);
        },
        hit(k,x,y,feet) {burst(P.water,x,y,.75,18,2,5,.6);burst(P.foam,x,y,.7,10,1,3,.4);flash(T.ring,C.cyan,x,feet,.4,2.4,.45,1);},
      };
    },
    // Embestida: dust pawed up and nose steam in startup, speed streaks on the charge.
    minotauro() {
      const g=new THREE.Group();group.add(g);
      const streaks=Array.from({length:4},()=>{const m=mesh(quad,basic(C.white,{map:T.ribbon,side:THREE.DoubleSide}),g);m.renderOrder=7;return m;});
      return {
        tick(c,k) {
          g.visible=false;if(!c.phase)return;
          if(c.phase==='charge') {
            for(let n=rate(25,c.dt);n>0;n--)parts.spawn(P.dust,c.x-c.fc*.35+(rand()-.5)*.2,c.feet+.05,.6,-c.fc*rand()*2,.5+rand()*1.5,0);
            const u=c.t/c.su;if((u>.2&&once(k,c,1))||(u>.6&&once(k,c,2)))
              for(let j=count(6);j>0;j--)parts.spawn(P.steam,c.x+c.fc*.45,c.y+c.H*.2,.7,c.fc*(2+rand()*2),(rand()-.3)*.8,(rand()-.5));
          } else if(c.at<c.ac+6) {
            g.visible=true;const o=.8*(1-Math.max(0,c.at-c.ac)/6);
            streaks.forEach((m,i)=>{m.position.set(c.x-c.fc*(.95+(i%2)*.35),c.y+(i-1.5)*c.H*.22,.6);m.scale.set(1.7*c.fc,.09,1);m.material.opacity=o;});
            for(let n=rate(60,c.dt);n>0;n--)parts.spawn(P.dust,c.x-c.fc*.4,c.feet+.05,.6,-c.fc*(1+rand()*3),.5+rand()*2,0);
          }
        },
        hit(k,x,y) {
          flash(T.star,C.white,x,y,.3,1.6,.3,0,0,3,true);
          for(const t of [C.white,C.gold,C.horn])burst(P.spark,x,y,.75,9,2.5,6,.1,t);
          burst(P.dust,x,y-.3,.6,8,.8,2);shake=Math.max(shake,.12);
        },
      };
    },
    // Mirada: snakes glint, the eyes light green and two beams reach out.
    medusa() {
      const g=new THREE.Group();group.add(g);
      const eyes=[0,1].map(()=>{const m=mesh(quad,basic(C.venom,{map:T.soft}),g);m.renderOrder=8;return m;});
      const beamMat=basic(C.venom), beams=[0,1].map(()=>mesh(G('rope',()=>new THREE.CylinderGeometry(1,1,1,5)),beamMat,g));
      return {
        tick(c,k,camera) {
          g.visible=false;if(!c.phase)return;
          const u=c.phase==='charge'?c.t/c.su:1;
          if(c.phase==='charge')for(let n=rate(25,c.dt);n>0;n--)parts.spawn(P.venom,c.x+(rand()-.5)*.6,c.y+c.H*.45,.7,(rand()-.5),.5+rand(),0);
          if(u<.55||(c.phase!=='charge'&&c.at>=c.ac+10))return;
          g.visible=true;
          const ex=c.x+c.fc*.22,ey=c.y+c.H*.28,beam=c.phase!=='charge';
          const tx=hitNow(k,c)?k.tx:c.x+c.fc*c.move.offset.x*S, ty=hitNow(k,c)?k.ty:c.y+c.move.offset.y*S;
          eyes.forEach((m,i)=>{m.position.set(ex+c.fc*i*.08,ey+i*.02,.75);m.quaternion.copy(camera.quaternion);m.scale.setScalar(.2+.08*Math.sin(time*30+i));});
          beams.forEach((m,i)=>{m.visible=beam;if(beam)stretch(m,ex+c.fc*i*.08,ey+i*.02,tx,ty,.72,.025);});
          beamMat.opacity=beam?1-Math.max(0,c.at)/(c.ac+10):0;
        },
        hit(k,x,y) {flash(T.soft,C.marble,x,y,.6,2,.35,0,0,0,true);burst(P.stone,x,y,.7,14,1,3,.2);burst(P.venom,x,y,.75,8,1.5,3.5);},
      };
    },
  };

  // ----- Status looks on the target, per fighter -----
  function statusKit() {
    const g=new THREE.Group();group.add(g);
    const iceMat=standard('#bfe8ff',{transparent:true,opacity:.55,roughness:.1,emissive:'#4a9ad8',emissiveIntensity:.35,depthWrite:false});
    const ice=new THREE.Group();g.add(ice);mesh(G('ice',()=>new THREE.IcosahedronGeometry(1,1)),iceMat,ice);
    for(let k=0;k<4;k++){const s=mesh(G('spike',()=>new THREE.OctahedronGeometry(1,0)),iceMat,ice);const a=k/4*TAU+.4;
      s.position.set(Math.cos(a)*.9,-.2+k*.25,Math.sin(a)*.6);s.scale.set(.22,.5,.22);s.rotation.set(.3*k,a,.5);}
    const stone=mesh(G('capsule',()=>new THREE.CapsuleGeometry(.5,1,4,12)),standard('#8f8b82',{roughness:1,transparent:true,opacity:.82}),g);
    const mound=mesh(G('mound',()=>new THREE.SphereGeometry(1,16,6,0,TAU,0,Math.PI/2)),standard(C.dirt,{roughness:1}),g);
    const zs=[0,1,2].map(()=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:T.z,transparent:true,depthWrite:false,color:'#dfe6ff'}));g.add(s);return s;});
    let last=null;
    return {
      tick(c,status) {
        g.visible=!!status;
        if(status!==last&&status) {
          if(status==='freeze'){burst(P.snow,c.x,c.y,.7,16,1,3);flash(T.ring,C.ice,c.x,c.feet,.4,2,.4,1);}
          if(status==='stone'){flash(T.soft,C.marble,c.x,c.y,.5,1.8,.3,0,0,0,true);burst(P.stone,c.x,c.y,.7,12,.8,2.5);}
          if(status==='sleep')burst(P.steam,c.x,c.y+c.H*.4,.7,8,.3,1,1);
          if(status==='bury'){burst(P.dust,c.x,c.feet+.1,.6,14,1,3,.3);flash(T.ring,C.dirt,c.x,c.feet,.4,2.2,.45,1);}
        }
        last=status;if(!status)return;
        ice.visible=status==='freeze';stone.visible=status==='stone';mound.visible=status==='bury';
        if(ice.visible){ice.position.set(c.x,c.y,.3);ice.scale.set(c.W*.85,c.H*.62,.75);ice.rotation.y=Math.sin(time*.6)*.15;}
        if(stone.visible) {
          stone.position.set(c.x,c.y,.3);stone.scale.set(c.W*1.05,c.H*.53,.8);
          if(rand()<c.dt*6)parts.spawn(P.stone,c.x+(rand()-.5)*c.W,c.y+(rand()-.5)*c.H,.7,0,-.3,0);
        }
        if(mound.visible){mound.position.set(c.x,c.feet,.3);mound.scale.set(c.W*.85,c.H*.3,.55);}
        zs.forEach((s,i)=>{
          s.visible=status==='sleep';if(!s.visible)return;
          const p=(time*.6+i/3)%1;s.position.set(c.x+c.fc*(.15+p*.35),c.y+c.H*.45+p*.7,.75);s.scale.setScalar(.16+p*.18);s.material.opacity=Math.sin(p*Math.PI);
        });
        if(status==='sleep'&&rand()<c.dt*5)parts.spawn(P.steam,c.x+c.fc*.15,c.y+c.H*.4,.7,0,.6,0);
      },
      reset(){last=null;},
    };
  }

  // ----- Projectiles: the raspado cup and the gust spiral -----
  function projectileMesh(kind) {
    const g=new THREE.Group();group.add(g);g.visible=false;
    if(kind==='raspado') {
      const cup=mesh(G('cup',()=>new THREE.ConeGeometry(.5,1,12,1,true)),standard('#f6f2e8',{side:THREE.DoubleSide}),g);cup.rotation.x=Math.PI;cup.position.y=-.35;
      mesh(G('ball',()=>new THREE.SphereGeometry(.55,14,10)),standard('#eef9ff',{roughness:.5}),g).position.y=.2;
      mesh(G('syrup',()=>new THREE.SphereGeometry(.565,14,6,0,TAU,0,Math.PI*.35)),standard('#ff5fa2',{roughness:.35}),g).position.y=.2;
    } else {
      const streakMat=(color,o)=>basic(color,{map:T.streak,opacity:o,side:THREE.DoubleSide});
      mesh(G('funnel',()=>new THREE.CylinderGeometry(1,.25,2,20,1,true)),streakMat('#dfe9f5',.85),g);
      mesh(G('funnelIn',()=>new THREE.CylinderGeometry(.7,.18,1.9,16,1,true)),streakMat('#8aa4c4',.7),g);
      for(const y of [-.3,.4]){const r=mesh(G('gustRing',()=>new THREE.TorusGeometry(.7,.05,5,24)),basic('#ffffff',{opacity:.8}),g);r.rotation.x=Math.PI/2;r.position.y=y;}
    }
    return {g,kind,id:-1,seen:false,x:0,y:0,vx:0,vy:0,r:0,age:0};
  }
  const shots=[...Array.from({length:4},()=>projectileMesh('raspado')),...Array.from({length:4},()=>projectileMesh('gust'))];
  function findShot(id,kind){for(const s of shots)if(s.id===id&&s.kind===kind)return s;return null;}
  function trackProjectiles(list) {
    for(const s of shots)s.seen=false;
    if(list)for(const p of list) {
      if(!POWER_PROJECTILES.has(p.kind))continue;
      let e=findShot(p.id,p.kind);
      if(!e){e=findShot(-1,p.kind);if(!e)continue;e.id=p.id;e.x=p.position.x*S;e.y=p.position.y*S;}
      e.seen=true;e.tx=p.position.x*S;e.ty=p.position.y*S;e.vx=(p.velocity?.x??0)*S;e.vy=(p.velocity?.y??0)*S;e.r=p.radius*S;e.age=0;
    }
    for(const s of shots)if(!s.seen){s.id=-1;s.g.visible=false;}
  }
  function drawProjectiles(dt) {
    for(const s of shots) {
      if(s.id===-1)continue;
      s.age=Math.min(.06,s.age+dt);const k=1-Math.exp(-dt*30);
      s.x+=(s.tx+s.vx*s.age-s.x)*k;s.y+=(s.ty+s.vy*s.age-s.y)*k;
      s.g.visible=true;s.g.position.set(s.x,s.y,.6);
      if(s.kind==='raspado') {
        s.g.scale.setScalar(s.r*1.5);s.g.rotation.z-=Math.sign(s.vx||1)*dt*5;
        for(let n=rate(40,dt);n>0;n--)parts.spawn(P.snow,s.x,s.y,.6,-s.vx*.2+(rand()-.5),(rand()-.5),0);
      } else {
        s.g.scale.setScalar(s.r*1.4);s.g.rotation.y+=dt*9;
        for(let n=rate(30,dt);n>0;n--){const a=rand()*TAU;
          parts.spawn(rand()<.5?P.feather:P.foam,s.x+Math.cos(a)*s.r,s.y+(rand()-.5)*s.r*2,.6+Math.sin(a)*.3,-Math.sin(a)*3,1+rand(),Math.cos(a));}
      }
    }
    T.streak.offset.x=(T.streak.offset.x+dt*2.2)%1;
  }

  // ----- Per-fighter tracking -----
  const slots=Array.from({length:6},()=>({init:false,x:0,y:0,sub:0,act:0,lastFrame:-1,lastMove:null,fid:null,move:null,pana:null,kit:null,k:{act:-1,done:0,hitAct:-1,hitAt:0,tx:0,ty:0},status:null}));
  const ctx={};
  let fighters=[], lastFrame=-1, round=-1;
  function ensure(s,f) {
    if(s.fid!==f.fighter) {s.fid=f.fighter;s.move=getFighterDefinition(f.fighter)?.attacks[MOVE]??null;}
    // A plain style id falls back to the first pana: its neutral special is still Rayo.
    const id=panaOfFighter(f.fighter).id;
    if(s.pana!==id) {
      if(s.kit)disposeKit(s.kit);
      s.pana=id;s.kit=buildKit(id);
    }
  }
  // A kit owns the top-level objects it added; geometry is shared and freed once.
  function buildKit(id) {
    const make=KITS[id];if(!make)return null;
    const first=group.children.length, kit=make();kit.owned=group.children.slice(first);return kit;
  }
  const disposeMaterials=o=>o.traverse(n=>{const m=n.material;if(Array.isArray(m))m.forEach(x=>x.dispose());else m?.dispose?.();});
  function disposeKit(kit){kit.dispose?.();for(const o of kit.owned){disposeMaterials(o);o.removeFromParent();}}
  const showKit=(kit,on)=>{for(const o of kit.owned)o.visible=on;};

  function update(state) {
    if(state.round!==round) {
      round=state.round;lastFrame=-1;parts.clear();shake=0;
      for(const e of flashes)e.m.visible=false;
      for(const s of slots){s.init=false;s.act++;s.lastFrame=-1;s.lastMove=null;s.k.hitAct=-1;s.status?.reset();}
      for(const s of shots){s.id=-1;s.g.visible=false;}
    }
    const fight=state.fight;fighters=fight?.fighters??[];
    for(let i=0;i<fighters.length&&i<slots.length;i++) {
      const s=slots[i],f=fighters[i];if(!f)continue;ensure(s,f);
      if(f.currentMove===MOVE&&(s.lastMove!==MOVE||f.moveFrame<s.lastFrame))s.act++;
      if(f.moveFrame!==s.lastFrame||f.currentMove!==s.lastMove)s.sub=0;
      s.lastFrame=f.moveFrame;s.lastMove=f.currentMove;
    }
    trackProjectiles(fight?.projectiles);
    if(!fight||fight.frame<=lastFrame)return;
    for(const e of fight.events) {
      if(e.frame<=lastFrame||e.type!=='hit'||e.move!==MOVE||!e.position)continue;
      const s=slots[e.slot],a=fighters[e.slot];if(!s||!a)continue;ensure(s,a);
      const t=fighters[e.target],x=e.position.x*S,y=e.position.y*S,feet=t?(t.position.y-t.size.height/2)*S:y-.65;
      Object.assign(s.k,{hitAct:s.act,hitAt:time,tx:x,ty:y});
      s.kit?.hit?.(s.k,x,y,feet);
    }
    lastFrame=fight.frame;
  }

  function frame(dt,camera) {
    time+=dt;
    for(let i=0;i<slots.length;i++) {
      const s=slots[i],f=fighters[i],out=!f||f.stocks<=0||f.state==='ko';
      if(out) {
        if(s.kit)showKit(s.kit,false);if(s.status)s.status.tick(ctx,null);s.init=false;continue;
      }
      const tx=f.position.x*S,ty=f.position.y*S;
      if(!s.init||f.state==='respawn'){s.x=tx;s.y=ty;s.init=true;}
      else{const k=1-Math.exp(-dt*22);s.x+=(tx-s.x)*k;s.y+=(ty-s.y)*k;}
      s.sub+=dt;
      const c=ctx, m=f.currentMove===MOVE?s.move:null;
      c.dt=dt;c.act=s.act;c.fc=f.facing||1;c.x=s.x;c.y=s.y;c.H=f.size.height*S;c.W=f.size.width*S;c.feet=c.y-c.H/2;
      c.hx=c.x+c.fc*c.W*.55;c.hy=c.y+c.H*.05;c.move=m;c.phase=null;
      if(m) {
        c.t=f.moveFrame+Math.min(3,s.sub*60);c.su=Math.max(1,m.startup);c.ac=Math.max(1,m.active??4);c.re=m.recovery??20;c.at=c.t-c.su;
        c.phase=c.t<c.su?'charge':c.at<c.ac?'active':'rest';
      }
      // Kits hide their own pieces when idle; this only undoes a knock-out hide.
      if(s.kit){showKit(s.kit,true);s.kit.tick(c,s.k,camera);}
      if(f.statusEffect||s.status){s.status??=statusKit();s.status.tick(c,f.statusEffect);}
    }
    drawProjectiles(dt);
    for(const e of flashes) {
      if(!e.m.visible)continue;e.t+=dt;const u=Math.min(1,e.t/e.life);
      if(u>=1){e.m.visible=false;continue;}
      if(e.flat)e.m.rotation.set(-Math.PI/2,0,0);else{e.m.quaternion.copy(camera.quaternion);e.m.rotateZ(e.spin*e.t);}
      e.m.position.y+=e.vy*dt;e.m.scale.setScalar(e.s0+(e.s1-e.s0)*(1-Math.pow(1-u,3)));e.m.material.opacity=e.a*(1-u);
    }
    parts.update(dt);
    shake*=Math.exp(-dt*15);
    if(shake>.001&&!reduced.matches){camera.position.x+=Math.sin(time*97)*shake;camera.position.y+=Math.cos(time*71)*shake*.6;camera.updateMatrixWorld();}
  }

  function dispose() {
    for(const s of slots)if(s.kit)disposeKit(s.kit);
    parts.dispose();disposeMaterials(group);Object.values(geo).forEach(g=>g.dispose());quad.dispose();
    Object.values(T).forEach(t=>t.dispose());group.removeFromParent();
  }
  return {update,frame,dispose,POWER_PROJECTILES};
}
