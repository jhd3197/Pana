import {Race,cleanInput} from './rules.js';
import {HostRoom} from '/engine/net.js';

// Host simulation on the shared host room (engine/net.js), with snapshot migration.
export class RaceRoom extends HostRoom {
  constructor({code,name,avatar,coat,onState=()=>{},onStatus=()=>{}}){
    super({game:'galope',protocol:'galope-v1',code,name,avatar,onState,onStatus,texts:{
      connecting:'Conectando con el hato…',full:'Sala llena. Abre una carrera local.',
      lost:'Se perdió la conexión. Reconectando…',offline:'Sin conexión. Puedes correr en local.'}});
    this.coat=coat;this.inputs=new Map();this.state=new Race().snapshot();
  }
  hello(){return {coat:this.coat};}
  statusText(){return `${this.members.size}/8 panas · ${this.isHost?'tú das la salida':'el anfitrión da la salida'}`;}
  takeOver(){
    this.game=Race.restore(this.state,this.members);
    for(const m of this.members.values())if(!this.game.players.some(p=>p.id===m.id))this.game.addPlayer(m.id,m.name,m.avatar||{},m.coat);
    this.publish();
  }
  memberJoined(m){if(this.isHost){this.game.addPlayer(m.id,m.name,m.avatar,m.coat);this.publish();}}
  memberLeft(id){this.inputs.delete(id);if(this.isHost)this.game.removePlayer(id);}
  memberHello(id,m){if(this.isHost){this.game.addPlayer(id,m.name,m.avatar,m.coat);this.publish();}}
  receive(id,data){
    if(data.kind==='snapshot'&&id===this.hostId&&!this.isHost&&Array.isArray(data.state?.players)){
      this.state=data.state;this.onState(this.state);
    }else if(data.kind==='input'&&this.isHost)this.inputs.set(id,{...cleanInput(data.input),at:performance.now()});
  }
  choose(coat){this.coat=coat;const m=this.members.get(this.id);if(m)m.coat=coat;if(this.isHost){this.game.addPlayer(this.id,this.name,this.avatar,coat);this.publish();}else this.send({kind:'hello',avatar:this.avatar,coat});}
  start(bots=true){if(this.isHost&&this.connected&&['lobby','finished'].includes(this.game.phase)){this.game.start(bots);this.publish();}}
  publish(){this.state=this.game.snapshot();this.onState(this.state);this.send({kind:'snapshot',state:this.state});}
  tick(dt,input,paused=false){
    if(!this.connected)return;
    if(this.isHost){
      this.inputs.set(this.id,cleanInput(input));
      for(const [id,i]of this.inputs)if(id!==this.id&&performance.now()-i.at>600)this.inputs.delete(id);
      // Catch up fixed physics steps when rendering delays a network tick.
      // Publish one snapshot per tick, not one for each catch-up step.
      if(!paused)for(let left=Math.min(1,dt);left>1e-6;left-=.05)this.game.update(Math.min(.05,left),this.inputs);
      this.publish();
    }else this.send({kind:'input',input:cleanInput(input)});
  }
  practice(){this.state=new Race().snapshot();this.inputs.clear();super.practice('Carrera local · tú y los jinetes');}
}
