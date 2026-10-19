import {nearest, angle, wrap, clamp, LENGTH, HALF_WIDTH, waterDepth} from './course.js';
import { applyRoomOptions } from '../../../engine/room-options-rules.js';
import { FIELDS, cleanOptions, direction, routeAt, raceJumps, distanceAhead } from './options.js';
import { rng } from '../../../engine/random.js';
export const COATS = ['bay','palomino','grey'];
const BOT_NAMES=['Marisela','El Catire','Florentino','Luz','Cimarrón','Rosalía','Simón'];
export function cleanInput(input={}) {
  return {throttle:clamp(Number(input.throttle)||0,-1,1),steer:clamp(Number(input.steer)||0,-1,1),sprint:!!input.sprint,jump:!!input.jump,reset:!!input.reset};
}
// Recover to earned progress; neither a shortcut nor an extra checkpoint.
export function resetRider(p,options) {
  const q=routeAt(p.progress,0,options);Object.assign(p,{x:q.x,z:q.z,h:q.h,s:q.s,speed:0,jumpY:0,vy:0,stun:.2,resetCooldown:2});
}

// One rider's step for dt (input already cleaned): the host's race, and a
// guest's prediction of its own horse (engine/predict.js). It writes only p;
// `race` is the Race or a snapshot of it (options, time, the other riders).
export function stepRider(p,i,dt,race) {
  p.resetCooldown=Math.max(0,p.resetCooldown-dt);
  if(i.reset&&!p.resetHeld&&p.resetCooldown===0)resetRider(p,race.options);
  p.resetHeld=i.reset;
  if(race.options.jumpHelp&&p.speed>2&&raceJumps(race.options).some(j=>distanceAhead(p.s,j.s,race.options)<Math.max(3,p.speed*.4)))i.jump=true;
  if(i.jump&&!p.jumpHeld&&p.jumpY===0&&p.stamina>8){p.vy=race.options.jumps==='crazy'?7.4:5.9;p.stamina-=8;}
  p.jumpHeld=i.jump;
  if(p.jumpY>0||p.vy>0){p.vy-=14*dt;p.jumpY=Math.max(0,p.jumpY+p.vy*dt);if(!p.jumpY)p.vy=0;}
  const oldS=p.s,road=nearest(p.x,p.z);
  p.water=waterDepth(p.x,p.z);
  if(p.stamina<1)p.exhausted=true;
  if(p.stamina>25)p.exhausted=false;
  const sprint=i.sprint&&!p.exhausted&&i.throttle>0&&p.water<.12;
  p.stamina=clamp(p.stamina+(sprint?-24:13)*dt,0,100);
  p.stun=Math.max(0,p.stun-dt);
  let top=sprint?18:12;
  top*=1-.54*clamp(p.water/.5,0,1);
  if(road.distance>HALF_WIDTH&&!race.options.shortcuts)top*=.62;
  top*=race.options.weather==='storm'?.82:race.options.weather==='rain'?.92:1;
  const ahead=race.players.some(o=>o.id!==p.id&&!o.spectator&&o.finish===null&&distanceAhead(p.s,o.s,race.options)>1&&distanceAhead(p.s,o.s,race.options)<9&&Math.hypot(o.x-p.x,o.z-p.z)<10);
  p.drafting=!!(race.options.drafting&&ahead);if(p.drafting)top*=1.15;
  if(p.stun>0)top*=.2;
  const target=i.throttle>0?top:i.throttle<0?0:0;
  const acceleration=i.throttle<0?23:i.throttle>0?8:5;
  p.speed+=clamp(target-p.speed,-acceleration*dt,acceleration*dt);
  if(race.options.weather==='storm')p.h+=Math.sin(race.time*2+p.s*.04)*.12*dt;
  p.h+=i.steer*(1.65-clamp(p.speed/28,0,.6))*dt*clamp(p.speed/2,.2,1);
  p.x+=Math.sin(p.h)*p.speed*dt;p.z+=Math.cos(p.h)*p.speed*dt;
  let next=nearest(p.x,p.z);
  // Soft corridor keeps horses clear of the actual ranch buildings and trees.
  if(next.distance>9){p.x=next.x+(p.x-next.x)*9/next.distance;p.z=next.z+(p.z-next.z)*9/next.distance;p.speed*=.94;next=nearest(p.x,p.z);}
  const delta=(wrap(next.s-oldS+LENGTH/2,LENGTH)-LENGTH/2)*direction(race.options);p.s=next.s;
  if(Math.abs(delta)<5){
    for(const j of raceJumps(race.options))if(delta>0&&distanceAhead(oldS,j.s,race.options)<=delta&&p.jumpY<j.height){p.stun=.85;p.speed*=.28;p.hits++;}
    p.progress+=delta;
  }
  // Gates every eighth of the route, in order; reverse crossings never add laps.
  const gate=p.checkpoint*LENGTH/8;
  if(p.progress>=gate&&p.progress<gate+LENGTH/8&&next.distance<8)p.checkpoint++;
  if(p.progress>=race.options.laps*LENGTH&&p.checkpoint>=race.options.laps*8+1){p.finish=race.time;p.speed=0;}
}

export class Race {
  constructor(){this.options=cleanOptions();this.phase='lobby';this.time=0;this.countdown=3;this.players=[];this.finishGrace=null;this.raceId=0;}
  configure(patch={}){if(!['lobby','finished'].includes(this.phase))return false;const next=applyRoomOptions(FIELDS,this.options,patch);if(!next)return false;this.options=next;this.players.forEach((p,i)=>this.grid(p,i));return true;}
  addPlayer(id,name,avatar={},coat='bay') {
    let p=this.players.find(p=>p.id===id);
    if(p){p.avatar=avatar;if(['lobby','finished'].includes(this.phase)||p.spectator)p.coat=COATS.includes(coat)?coat:'bay';return p;}
    // Late arrivals wait for the next start so no one receives a shortened race.
    p={id,name:String(name||'pana').slice(0,16),avatar,coat:COATS.includes(coat)?coat:'bay',bot:false,spectator:this.phase!=='lobby'&&this.phase!=='finished'};
    this.players.push(p);this.grid(p,this.players.length-1);return p;
  }
  grid(p,i) {
    const start=-5-Math.floor(i/3)*3.4,q=routeAt(start,(i%3-1)*2.6,this.options);
    Object.assign(p,{x:q.x,z:q.z,h:q.h,s:q.s,progress:start,checkpoint:0,speed:0,stamina:100,exhausted:false,jumpY:0,vy:0,jumpHeld:false,resetHeld:false,resetCooldown:0,stun:0,hits:0,finish:null,water:0});
  }
  removePlayer(id){this.players=this.players.filter(p=>p.id!==id);}
  start(bots=true,seed=this.raceId+1) {
    this.players=this.players.filter(p=>!p.bot);
    if(bots)while(this.players.length<6){const i=this.players.length;this.players.push({id:`bot-${i}`,name:BOT_NAMES[i%7],avatar:{hat:'llanero',hatColor:'#e6c691',outfitColor:['#d66c49','#578c85','#e3b349'][i%3]},coat:COATS[i%3],bot:true});}
    const random=rng(seed);this.players.forEach((p,i)=>{p.spectator=false;if(this.options.horse==='random')p.coat=COATS[Math.floor(random()*COATS.length)];this.grid(p,i);});
    this.phase='countdown';this.countdown=3;this.time=0;this.finishGrace=null;this.raceId++;
  }
  botInput(p) {
    const lane=Number(String(p.id).split('-').at(-1))||0;
    const q=routeAt(p.progress+5+p.speed*.35,Math.sin(lane)*1.8,this.options),target=Math.atan2(q.x-p.x,q.z-p.z);
    const nextLog=raceJumps(this.options).some(j=>distanceAhead(p.s,j.s,this.options)<Math.max(3,p.speed*(this.options.jumps==='crazy'?.43:.37)));
    return {throttle:1,steer:clamp(angle(target-p.h)*2.4,-1,1),sprint:p.stamina>35&&Math.abs(angle(target-p.h))<.3&&p.water<.1,jump:nextLog};
  }
  reset(p) { resetRider(p,this.options); }
  update(dt,inputs=new Map()) {
    dt=clamp(dt,0,.05);
    if(this.phase==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.phase='racing';this.countdown=0;}return;}
    if(this.phase!=='racing')return;
    this.time+=dt;
    for(const p of this.players){
      if(p.spectator||p.finish!==null)continue;
      const i=cleanInput(p.bot?this.botInput(p):inputs.get(p.id));
      stepRider(p,i,dt,this);
    }
    const racers=this.players.filter(p=>!p.spectator),humans=racers.filter(p=>!p.bot);
    if(racers.some(p=>p.finish!==null)&&this.finishGrace===null)this.finishGrace=this.time+45;
    if((humans.length&&humans.every(p=>p.finish!==null))||racers.every(p=>p.finish!==null)||(this.finishGrace!==null&&this.time>=this.finishGrace)||this.time>=this.options.laps*120)this.phase='finished';
  }
  snapshot(){return JSON.parse(JSON.stringify({options:this.options,phase:this.phase,time:this.time,countdown:this.countdown,players:this.players,finishGrace:this.finishGrace,raceId:this.raceId}));}
  static restore(snapshot,members){const race=new Race();Object.assign(race,JSON.parse(JSON.stringify(snapshot)));race.options=cleanOptions(race.options);race.players=race.players.filter(p=>p.bot||members.has(p.id));return race;}
}
export function standings(state){return state.players.filter(p=>!p.spectator).slice().sort((a,b)=>(a.finish??Infinity)-(b.finish??Infinity)||b.progress-a.progress);}
