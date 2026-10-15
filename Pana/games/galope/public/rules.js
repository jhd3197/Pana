import {at, nearest, angle, wrap, clamp, LENGTH, LAPS, HALF_WIDTH, JUMPS, waterDepth} from './course.js';
export const COATS = ['bay','palomino','grey'];
const BOT_NAMES=['Marisela','El Catire','Florentino','Luz','Cimarrón','Rosalía','Simón'];
export function cleanInput(input={}) {
  return {throttle:clamp(Number(input.throttle)||0,-1,1),steer:clamp(Number(input.steer)||0,-1,1),sprint:!!input.sprint,jump:!!input.jump,reset:!!input.reset};
}
export class Race {
  constructor(){this.phase='lobby';this.time=0;this.countdown=3;this.players=[];this.finishGrace=null;this.raceId=0;}
  addPlayer(id,name,avatar={},coat='bay') {
    let p=this.players.find(p=>p.id===id);
    if(p){p.avatar=avatar;p.coat=COATS.includes(coat)?coat:'bay';return p;}
    // Late arrivals wait for the next start so no one receives a shortened race.
    p={id,name:String(name||'pana').slice(0,16),avatar,coat:COATS.includes(coat)?coat:'bay',bot:false,spectator:this.phase!=='lobby'&&this.phase!=='finished'};
    this.players.push(p);this.grid(p,this.players.length-1);return p;
  }
  grid(p,i) {
    const start=-5-Math.floor(i/3)*3.4,q=at(start,(i%3-1)*2.6);
    Object.assign(p,{x:q.x,z:q.z,h:q.h,s:wrap(start,LENGTH),progress:start,checkpoint:0,speed:0,stamina:100,exhausted:false,jumpY:0,vy:0,jumpHeld:false,resetHeld:false,resetCooldown:0,stun:0,hits:0,finish:null,water:0});
  }
  removePlayer(id){this.players=this.players.filter(p=>p.id!==id);}
  start(bots=true) {
    this.players=this.players.filter(p=>!p.bot);
    if(bots)while(this.players.length<6){const i=this.players.length;this.players.push({id:`bot-${i}`,name:BOT_NAMES[i%7],avatar:{hat:'llanero',hatColor:'#e6c691',outfitColor:['#d66c49','#578c85','#e3b349'][i%3]},coat:COATS[i%3],bot:true});}
    this.players.forEach((p,i)=>{p.spectator=false;this.grid(p,i);});
    this.phase='countdown';this.countdown=3;this.time=0;this.finishGrace=null;this.raceId++;
  }
  botInput(p) {
    const lane=Number(String(p.id).split('-').at(-1))||0;
    const q=at(p.s+5+p.speed*.35,Math.sin(lane)*1.8),target=Math.atan2(q.x-p.x,q.z-p.z);
    const nextLog=JUMPS.some(j=>wrap(j.s-p.s,LENGTH)<Math.max(3,p.speed*.37));
    return {throttle:1,steer:clamp(angle(target-p.h)*2.4,-1,1),sprint:p.stamina>35&&Math.abs(angle(target-p.h))<.3&&p.water<.1,jump:nextLog};
  }
  reset(p) {
    // Recover to earned progress; neither a shortcut nor an extra checkpoint.
    const q=at(p.progress);Object.assign(p,{x:q.x,z:q.z,h:q.h,s:q.s,speed:0,jumpY:0,vy:0,stun:.2,resetCooldown:2});
  }
  update(dt,inputs=new Map()) {
    dt=clamp(dt,0,.05);
    if(this.phase==='countdown'){this.countdown-=dt;if(this.countdown<=0){this.phase='racing';this.countdown=0;}return;}
    if(this.phase!=='racing')return;
    this.time+=dt;
    for(const p of this.players){
      if(p.spectator||p.finish!==null)continue;
      const i=cleanInput(p.bot?this.botInput(p):inputs.get(p.id));
      p.resetCooldown=Math.max(0,p.resetCooldown-dt);
      if(i.reset&&!p.resetHeld&&p.resetCooldown===0)this.reset(p);
      p.resetHeld=i.reset;
      if(i.jump&&!p.jumpHeld&&p.jumpY===0&&p.stamina>8){p.vy=5.9;p.stamina-=8;}
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
      if(road.distance>HALF_WIDTH)top*=.62;
      if(p.stun>0)top*=.2;
      const target=i.throttle>0?top:i.throttle<0?0:0;
      const acceleration=i.throttle<0?23:i.throttle>0?8:5;
      p.speed+=clamp(target-p.speed,-acceleration*dt,acceleration*dt);
      p.h+=i.steer*(1.65-clamp(p.speed/28,0,.6))*dt*clamp(p.speed/2,.2,1);
      p.x+=Math.sin(p.h)*p.speed*dt;p.z+=Math.cos(p.h)*p.speed*dt;
      let next=nearest(p.x,p.z);
      // Soft corridor keeps horses clear of the actual ranch buildings and trees.
      if(next.distance>9){p.x=next.x+(p.x-next.x)*9/next.distance;p.z=next.z+(p.z-next.z)*9/next.distance;p.speed*=.94;next=nearest(p.x,p.z);}
      const delta=wrap(next.s-oldS+LENGTH/2,LENGTH)-LENGTH/2;p.s=next.s;
      if(Math.abs(delta)<5){
        for(const j of JUMPS)if(delta>0&&wrap(j.s-oldS,LENGTH)<=delta&&p.jumpY<j.height){p.stun=.85;p.speed*=.28;p.hits++;}
        p.progress+=delta;
      }
      // Gates every eighth of the route, in order; reverse crossings never add laps.
      const gate=p.checkpoint*LENGTH/8;
      if(p.progress>=gate&&p.progress<gate+LENGTH/8&&next.distance<8)p.checkpoint++;
      if(p.progress>=LAPS*LENGTH&&p.checkpoint>=LAPS*8+1){p.finish=this.time;p.speed=0;}
    }
    const racers=this.players.filter(p=>!p.spectator),humans=racers.filter(p=>!p.bot);
    if(racers.some(p=>p.finish!==null)&&this.finishGrace===null)this.finishGrace=this.time+45;
    if((humans.length&&humans.every(p=>p.finish!==null))||racers.every(p=>p.finish!==null)||(this.finishGrace!==null&&this.time>=this.finishGrace)||this.time>=240)this.phase='finished';
  }
  snapshot(){return JSON.parse(JSON.stringify({phase:this.phase,time:this.time,countdown:this.countdown,players:this.players,finishGrace:this.finishGrace,raceId:this.raceId}));}
  static restore(snapshot,members){const race=new Race();Object.assign(race,JSON.parse(JSON.stringify(snapshot)));race.players=race.players.filter(p=>p.bot||members.has(p.id));return race;}
}
export function standings(state){return state.players.filter(p=>!p.spectator).slice().sort((a,b)=>(a.finish??Infinity)-(b.finish??Infinity)||b.progress-a.progress);}
