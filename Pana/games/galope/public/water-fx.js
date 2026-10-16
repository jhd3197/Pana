import * as THREE from 'three';
import {waterDepthMap} from '/engine/models/effects/water-surface.js';

// Two shared draws for the whole field: surface crests and airborne spray.
// Fixed particle pools, no reflection pass and no per-horse materials.
// Events stay in world space after the horse has moved on.
export const WATER_FX_BUDGET=Object.freeze({surface:128,spray:192,riders:8,distance:45});
const TAU=Math.PI*2,HOOVES=[[-.26,.6,.5],[.26,.6,0],[-.26,-.56,2.6],[.26,-.56,2.1]];
const vertex=`
  attribute vec3 effect; attribute vec3 velocity;
  varying vec2 vUv; varying vec3 vEffect; varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main(){
    vUv=uv*2.-1.;vEffect=effect;
    #ifdef SPRAY
      vec4 world=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
      vec4 mvPosition=viewMatrix*world;
      vec2 axis=normalize((viewMatrix*vec4(velocity,0.)).xy+vec2(.00001,0.));
      mvPosition.xy+=vec2(axis.y,-axis.x)*position.x*length(instanceMatrix[0].xyz)
        +axis*position.y*length(instanceMatrix[1].xyz);
    #else
      vec4 world=modelMatrix*instanceMatrix*vec4(position.x,0.,position.y,1.);
      vec4 mvPosition=viewMatrix*world;
    #endif
    vWorld=world.xyz;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }`;
const fragment=`
  uniform vec3 crest; uniform vec3 trough; uniform sampler2D bed;
  varying vec2 vUv; varying vec3 vEffect; varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main(){
    vec3 color=crest;float alpha;
    #ifdef SPRAY
      // A soft tapered streak, oriented along each droplet's projected velocity.
      float width=.62-.24*vUv.y;
      float shape=length(vec2(vUv.x/width,vUv.y));
      alpha=(1.-smoothstep(.55,1.,shape))*vEffect.x;
      color=mix(trough,crest,smoothstep(-.7,.6,vUv.y)*.65+.35);
    #else
      vec2 encoded=texture2D(bed,vWorld.xz/360.+.5).rg;
      float depth=(encoded.r*65280.+encoded.g*255.)/65535.*96.-32.;
      if(depth<.035)discard;
      float a=atan(vUv.y,vUv.x),r=length(vUv);
      float edge=.76+.018*sin(a*5.+vEffect.z*6.);
      float width=mix(.022,.009,vEffect.z);
      float foam=1.-smoothstep(width,width+.018,abs(r-edge));
      float lip=1.-smoothstep(.02,.04,abs(r-edge-.045));
      float inner=(1.-smoothstep(.008,.022,abs(r-edge*.71)))*.18;
      float broken=.65+.35*sin(a*7.+vEffect.z*4.);
      // Wake ellipses retain only the trailing arms, leaving the horse's bow open.
      float arc=vEffect.y>.5?1.-smoothstep(.02,.6,vUv.y):1.;
      alpha=(foam*broken+lip*.3+inner)*arc*vEffect.x*smoothstep(.035,.2,depth);
      color=mix(trough,crest,clamp(foam+inner,0.,1.));
    #endif
    if(alpha<.008)discard;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export function createHorseWaterFX({waterY,depthAt}){
  const group=new THREE.Group();group.name='Horse ripples, wake and hoof spray';
  const bed=waterDepthMap((x,z)=>waterY-depthAt(x,z),{size:360,y:waterY,resolution:256});
  const matrix=new THREE.Object3D(),history=new Map();let lastTime=-1,serial=0,disposed=false;
  function batch(capacity,spray){
    const geometry=new THREE.PlaneGeometry(2,2),effect=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3),velocity=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);
    effect.setUsage(THREE.DynamicDrawUsage);velocity.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('effect',effect);geometry.setAttribute('velocity',velocity);
    const material=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,
      defines:spray?{SPRAY:1}:{},transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
      uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),bed:{value:bed},crest:{value:new THREE.Color(0xd2fff5)},trough:{value:new THREE.Color(0x208a9b)}}});
    const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.name=spray?'Ballistic hoof spray':'Expanding ripples and wake';mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=spray?3:2;group.add(mesh);
    return {mesh,effect,velocity,cursor:0,pool:Array.from({length:capacity},()=>({birth:-100,life:0}))};
  }
  const surface=batch(WATER_FX_BUDGET.surface,false),spray=batch(WATER_FX_BUDGET.spray,true);
  const random=()=>{const n=Math.sin(++serial*127.1+311.7)*43758.5453;return n-Math.floor(n);};
  function ring(t,x,z,h,power,wake=false){
    if(depthAt(x,z)<.035)return;
    Object.assign(surface.pool[surface.cursor++%surface.pool.length],{birth:t,life:(wake?1.35:1.2)+random()*.16,x,z,h,power:power*(.9+random()*.2),wake});
  }
  function splash(t,x,z,h,speed,power){
    if(depthAt(x,z)<.04)return;
    ring(t,x,z,h,power);
    const forward=Math.sin(h),along=Math.cos(h);
    for(let i=0,n=speed>4?6:3;i<n;i++){
      const angle=random()*TAU,out=.45+random()*1.2;
      Object.assign(spray.pool[spray.cursor++%spray.pool.length],{birth:t,life:.34+random()*.25,x,z,
        vx:Math.cos(angle)*out+forward*speed*.13,vz:Math.sin(angle)*out+along*speed*.13,
        vy:(1.05+random()*1.25)*power,size:.02+random()*.018,power});
    }
  }
  function update(t,people,riders,focus){
    if(disposed||t===lastTime)return;
    if(t<lastTime)reset();
    lastTime=t;const seen=new Set();let count=0;
    for(const p of people){
      const rider=riders.get(p.id);if(!rider||p.spectator)continue;
      const q=rider.group.position,h=rider.group.rotation.y;
      if(Math.hypot(q.x-focus.x,q.z-focus.z)>WATER_FX_BUDGET.distance||count++>=WATER_FX_BUDGET.riders)continue;
      seen.add(p.id);
      const phase=rider.stridePhase,depth=depthAt(q.x,q.z),wet=depth>.055&&(p.jumpY||0)<depth+.025;
      let prev=history.get(p.id);
      if(!prev){prev={x:q.x,z:q.z,phase,wet:false,distance:0};history.set(p.id,prev);}
      const moved=Math.hypot(q.x-prev.x,q.z-prev.z),teleported=moved>6;
      if(wet&&!teleported){
        const power=THREE.MathUtils.clamp(.45+(p.speed||0)*.055,.5,1.15);
        if(!prev.wet)splash(t,q.x,q.z,h,p.speed||0,power*1.25);
        if(p.speed>.7)for(const [side,fore,offset]of HOOVES){
          if(Math.floor((phase+offset-Math.PI)/TAU)>Math.floor((prev.phase+offset-Math.PI)/TAU)){
            const x=q.x+Math.cos(h)*side+Math.sin(h)*fore,z=q.z-Math.sin(h)*side+Math.cos(h)*fore;
            splash(t,x,z,h,p.speed,power);
          }
        }
        prev.distance+=moved;
        if(p.speed>1.5&&prev.distance>.65){
          ring(t,q.x-Math.sin(h)*.15,q.z-Math.cos(h)*.15,h,power,true);prev.distance%=.65;
        }
      }else prev.distance=0;
      Object.assign(prev,{x:q.x,z:q.z,phase,wet});
    }
    for(const id of history.keys())if(!seen.has(id))history.delete(id);
    for(const b of [surface,spray]){
      let n=0;
      for(const p of b.pool){
        const age=t-p.birth,u=age/p.life;if(age<0||u>=1||p.life===0)continue;
        if(b===surface){
          const radius=(p.wake?.48:.16)+age*(p.wake?.95:.85)*p.power;
          matrix.position.set(p.x,waterY+.026,p.z);matrix.rotation.set(0,p.h,0);matrix.scale.set(radius,1,radius*(p.wake?1.7:.85));
          b.effect.setXYZ(n,(p.wake?.24:.46)*(1-u)**1.4*Math.min(1,age*30),p.wake?1:0,u);
        }else{
          const y=age*p.vy-3.4*age*age;if(y<-.015)continue;
          matrix.position.set(p.x+p.vx*age,waterY+.035+y,p.z+p.vz*age);matrix.rotation.set(0,0,0);matrix.scale.set(p.size,p.size*(1.8+Math.abs(p.vy-6.8*age)*.4),1);
          b.effect.setXYZ(n,.8*(1-u*u),0,u);b.velocity.setXYZ(n,p.vx,p.vy-6.8*age,p.vz);
        }
        matrix.updateMatrix();b.mesh.setMatrixAt(n++,matrix.matrix);
      }
      b.mesh.count=n;b.mesh.visible=n>0;b.mesh.instanceMatrix.needsUpdate=true;b.effect.needsUpdate=true;if(b===spray)b.velocity.needsUpdate=true;
    }
  }
  function reset(){history.clear();lastTime=-1;serial=0;for(const b of [surface,spray]){b.pool.forEach(p=>p.life=0);b.cursor=0;b.mesh.count=0;}}
  return {group,update,reset,get stats(){return {surface:surface.mesh.count,spray:spray.mesh.count,riders:history.size,draws:Number(surface.mesh.count>0)+Number(spray.mesh.count>0)};},
    dispose(){if(disposed)return;disposed=true;history.clear();for(const b of [surface,spray]){b.mesh.dispose();b.mesh.geometry.dispose();b.mesh.material.dispose();}bed.dispose();group.removeFromParent();}
  };
}
