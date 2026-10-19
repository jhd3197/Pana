import {Race,cleanInput,stepRider} from './rules.js';
import {LiveRoom} from '/engine/live-room.js';

// Host simulation on the shared live room (engine/live-room.js), with snapshot migration.
export class RaceRoom extends LiveRoom {
  constructor({coat,...options}){
    super({...options,game:'galope',protocol:'galope-v2',texts:{
      connecting:'Conectando con el hato…',full:'Sala llena. Abre una carrera local.',
      lost:'Se perdió la conexión. Reconectando…',offline:'Sin conexión. Puedes correr en local.'}},{valid:state=>Array.isArray(state?.players),
      // Your own horse answers at once; the host corrects it.
      predict:{
        body:(state,id)=>state.phase==='racing'?state.players.find(p=>p.id===id&&!p.spectator&&p.finish===null):null,
        step:(p,input,dt,state)=>stepRider(p,cleanInput(input),dt,state),
      }});
    this.coat=coat;this.state=new Race().snapshot();
  }
  cleanInput(raw){return cleanInput(raw);}
  hello(){return {coat:this.coat};}
  statusText(){return `${this.members.size}/8 panas · ${this.isHost?'tú das la salida':'el anfitrión da la salida'}`;}
  takeOver(previous){
    super.takeOver(previous);
    this.game=Race.restore(this.state,this.members);
    for(const m of this.members.values())if(!this.game.players.some(p=>p.id===m.id))this.game.addPlayer(m.id,m.name,m.avatar||{},m.coat);
    this.publish();
  }
  memberJoined(m){if(this.isHost){this.game.addPlayer(m.id,m.name,m.avatar,m.coat);this.publish();}}
  memberLeft(id){super.memberLeft(id);if(this.isHost)this.game.removePlayer(id);}
  memberHello(id,m){if(this.isHost){this.game.addPlayer(id,m.name,m.avatar,m.coat);this.publish();}}
  choose(coat){this.coat=coat;const m=this.members.get(this.id);if(m)m.coat=coat;if(this.isHost){this.game.addPlayer(this.id,this.name,this.avatar,coat);this.publish();}else this.send({kind:'hello',avatar:this.avatar,coat});}
  configure(patch){if(this.isHost&&this.game?.configure(patch))this.publish();}
  start(bots=true){if(this.isHost&&this.connected&&['lobby','finished'].includes(this.game.phase)){this.game.start(bots);this.publish();}}
  practice(){const local=new Race();local.configure(this.state.options);this.state=local.snapshot();super.practice('Carrera local · tú y los jinetes');}
}
