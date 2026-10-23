import * as THREE from 'three';
import { updateDrivingEffects } from './driving-effects.js';
import { cameraGuidance } from './camera-guidance.js';

const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const query=new URLSearchParams(location.search);
const prototype=query.has('debug')?query.get('camera'):null;

export function createChaseCamera(race,track,random,preference=()=> 'dinamica') {
  const want=new THREE.Vector3(),guides=new Map();
  return function followCam(cam,key,p,look,dt){
    const T=track(),comfort=preference()==='suave'||reducedMotion.matches;
    const legacy=prototype==='legacy';
    let state=guides.get(key);
    if(!state||!race[key]){state={};guides.set(key,state);}
    const guide=legacy?{heading:p.h,rise:0,roll:0}:cameraGuidance(T,p,state,dt,
      {look,comfort:comfort||prototype==='anticipation',disabled:race.mode==='battle'});
    const fx=Math.sin(guide.heading),fz=Math.cos(guide.heading),back=look?-1:1;
    const dist=p.boost>0?12.1:11,py=p.y+(p.flyLift||0);
    const height=THREE.MathUtils.clamp(T.def.cameraHeight??5,4,6);
    want.set(p.x-fx*dist*back,T.def.layered?py+height:Math.max(height,py+height),p.z-fz*dist*back);
    // A respawn or teleport should establish a new view, not fly through the
    // intervening scenery. Each split-screen driver owns a separate state.
    if(!race[key]||look!==race[key+'Look']||(!legacy&&race[key].distanceTo(want)>45))race[key]=want.clone();
    race[key+'Look']=look;
    race[key].lerp(want,Math.min(1,dt*(p.boost>0?5.5:4)));
    const sh=p.isPlayer&&!comfort?race.shake*.6:0;
    const mx=race.mirror?-1:1,at=race[key],lead=p.boost>0?5.2:4;
    // Keep the random draws even at zero shake so a camera comparison does
    // not change the seeded race's hazards or opponent decisions.
    cam.position.set(mx*at.x+random(-sh,sh),at.y+random(-sh,sh),at.z+random(-sh,sh));
    cam.up.set(0,1,0);
    cam.lookAt(mx*(p.x+fx*lead*back),py+1.4+guide.rise,p.z+fz*lead*back);
    if(!legacy)cam.rotateZ(guide.roll*mx);
    const fov=comfort?60:(p.boost>0?74:60)-(p.isPlayer?race.slowMo.punch:0);
    if(Math.abs(cam.fov-fov)>.05){cam.fov+=(fov-cam.fov)*Math.min(1,dt*5);cam.updateProjectionMatrix();}
    updateDrivingEffects(T,cam,p,race,comfort,look,dt);
  };
}
