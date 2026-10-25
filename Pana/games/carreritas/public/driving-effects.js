import * as THREE from 'three';
import { getSettings } from '/engine/settings.js';

// One transparent draw per viewport, no render targets or full-scene bloom.
// The centre remains clear. State belongs to each camera, including split view.
const states=new WeakMap(),forward=new THREE.Vector3(),sun=new THREE.Vector3(),projected=new THREE.Vector3();
const ray=new THREE.Raycaster();
function create(T){
  const uniforms={time:{value:0},speed:{value:0},sun:{value:new THREE.Vector2()},glare:{value:0},aspect:{value:1},density:{value:28}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float time,speed,glare,aspect,density;uniform vec2 sun;
      void main(){
        vec2 p=(vUv-.5)*vec2(aspect,1.);float radius=length(p);
        float angle=atan(p.y,p.x),lane=floor((angle+3.141593)*density);
        float seed=fract(sin(lane*127.1)*43758.5453);
        float strand=pow(max(0.,cos((angle+3.141593)*density*6.283185)),18.);
        float travel=fract(radius*1.15-time*(.9+seed*.8)+seed);
        float edge=smoothstep(.33,.58,radius)*(1.-smoothstep(.85,1.15,radius));
        float streak=strand*smoothstep(.52,.8,travel)*edge*speed*.52;
        float d=length((vUv-sun)*vec2(aspect,1.));
        float glow=(exp(-d*d*90.)*.17+exp(-d*d*12.)*.055)*glare;
        float alpha=min(.3,streak+glow);
        gl_FragColor=vec4(mix(vec3(1.,.91,.72),vec3(.88,.97,1.),streak/max(.0001,streak+glow)),alpha);
      }`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  mesh.name='bululu-driving-effects';mesh.frustumCulled=false;mesh.renderOrder=10000;
  mesh.onBeforeRender=(_renderer,_scene,cam)=>{
    const s=states.get(cam);
    uniforms.speed.value=s?.T===T?s.speed:0;uniforms.glare.value=s?.T===T?s.glare:0;
    uniforms.time.value=s?.time||0;uniforms.aspect.value=cam.aspect;
    uniforms.density.value=getSettings().detail==='baja'?3:5;
    if(s)uniforms.sun.value.copy(s.sun);
  };
  T.group.add(mesh);return mesh;
}

export function updateDrivingEffects(T,cam,p,race,comfort,look,dt){
  if(!T.def.drivingEffects)return;
  if(!T.group.getObjectByName('bululu-driving-effects'))create(T);
  let s=states.get(cam);
  if(!s||s.T!==T){s={T,time:0,speed:0,glare:0,sun:new THREE.Vector2(),timer:0,blocked:false};states.set(cam,s);}
  s.time+=dt;
  const enabled=!comfort&&!look&&race.mode!=='battle';
  const velocity=Math.abs(p.vf||0),fast=THREE.MathUtils.smoothstep(velocity,28,64);
  const target=enabled?(p.boost>0?Math.max(fast,.72)*THREE.MathUtils.smoothstep(velocity,8,24):fast*.38):0;
  s.speed=enabled?THREE.MathUtils.lerp(s.speed,target,Math.min(1,dt*8)):0;
  cam.updateMatrixWorld();cam.getWorldDirection(forward);
  sun.copy(T.def.palette.sunDirection);if(race.mirror)sun.x*=-1;
  projected.copy(cam.position).addScaledVector(sun,800).project(cam);
  s.sun.set(projected.x*.5+.5,projected.y*.5+.5);
  const facing=forward.dot(sun),inView=facing>0&&Math.abs(projected.x)<1.35&&Math.abs(projected.y)<1.35;
  s.timer-=dt;
  if(inView&&s.timer<=0){
    // The scene matrices already include the mirror; ray and sun use world space.
    ray.set(cam.position,sun);ray.near=.5;ray.far=1200;
    T.group.updateMatrixWorld(true);
    const blockers=['world-terrain','track-road'].map(n=>T.group.getObjectByName(n)).filter(Boolean);
    s.blocked=ray.intersectObjects(blockers,false).length>0;s.timer=.12;
  }
  const glow=enabled&&inView&&!s.blocked?THREE.MathUtils.smoothstep(facing,.65,.96):0;
  s.glare=enabled?THREE.MathUtils.lerp(s.glare,glow,Math.min(1,dt*9)):0;
  cam.userData.drivingEffects={speed:s.speed,glare:s.glare,blocked:s.blocked};
}
