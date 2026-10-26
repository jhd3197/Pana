import { attackTheme } from './artifact-attacks.js';
// A bounded particle pool. Effects consume authoritative events exactly once.
import * as THREE from 'three';
import { rng } from '/engine/random.js';
const COLORS=['#ffc629','#2ad1b2','#fa7467','#a798e8', '#77b8ff', '#f5a552'];
export function createImpactEffects(root, scale) {
  const geometry=new THREE.OctahedronGeometry(1), particles=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  for(let i=0;i<56;i++) {
    const material=new THREE.MeshBasicMaterial({color:'#fff2cf',transparent:true,depthWrite:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;root.add(mesh);
    particles.push({mesh,life:0,max:1,vx:0,vy:0});
  }
  let cursor=0,lastFrame=-1,round=-1,shake=0,time=0, bursts=0;
  let fighters=[];
  function burst(event) {
    if(!event.position)return;
    const big=event.type==='ko', shield=event.type==='shield-hit', jump=['jump','land','double-jump'].includes(event.type);
    const count=reduced.matches?3:big?24:jump?5:12;
    const random=rng(event.frame*31+(event.slot??0)*13+count);
    const x=Math.max(-16,Math.min(16,event.position.x*scale)),y=Math.max(-4,Math.min(10,event.position.y*scale));
    for(let i=0;i<count;i++) {
      const p=particles[cursor++%particles.length], angle=i/count*Math.PI*2;
      p.max=p.life=big?.8:jump?.3:.38;
      p.mesh.visible=true;p.mesh.position.set(x,y,.6);
      p.mesh.material.color.set(attackTheme(fighters[event.slot]?.fighter,event.move)?.color ?? (shield?COLORS[event.slot??0]:big?COLORS[event.slot??0]:i%3?'#fff4cc':'#ff9d3c'));
      p.size=big?.2:jump?.07:.11;
      const speed=big?4:jump?1.3:2.5+random()*2;
      p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed+(jump?.7:0);
    }
    if(!reduced.matches&&!jump)shake=Math.max(shake,big?.18:.05+Math.min(.06,(event.damage??4)*.003));
    bursts++;
  }
  return {
    update(state) {
      if(state.round!==round){round=state.round;lastFrame=-1;particles.forEach(p=>{p.life=0;p.mesh.visible=false;});shake=0;}
      const fight=state.fight;if(!fight||fight.frame<=lastFrame)return;fighters=fight.fighters;
      for(const event of fight.events)if(event.frame>lastFrame&&['hit','shield-hit','ko','jump','double-jump','land'].includes(event.type))burst(event);
      lastFrame=fight.frame;
    },
    frame(dt,camera) {
      time+=dt;shake*=Math.exp(-dt*15);
      if(shake>.001&&!reduced.matches){camera.position.x+=Math.sin(time*110)*shake;camera.position.y+=Math.cos(time*83)*shake*.6;camera.updateMatrixWorld();}
      for(const p of particles){if(p.life<=0)continue;p.life-=dt;p.mesh.visible=p.life>0;
        p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.vy-=3*dt;
        p.mesh.rotation.z+=dt*5;p.mesh.scale.setScalar(p.size*Math.max(0,p.life/p.max));p.mesh.material.opacity=Math.min(1,p.life/p.max*2);
      }
    },
    get bursts(){return bursts;},
  };
}
