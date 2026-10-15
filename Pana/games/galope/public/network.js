import {Race,cleanInput} from './rules.js';

// Host simulation over the existing game-scoped relay, with snapshot migration.
export class RaceRoom {
  constructor({code,name,avatar,coat,onState=()=>{},onStatus=()=>{}}){
    Object.assign(this,{code,name,avatar,coat,onState,onStatus});
    this.members=new Map();this.inputs=new Map();this.state=new Race().snapshot();this.id=null;this.hostId=null;this.connected=false;this.offline=false;this.attempts=0;
  }
  get isHost(){return this.id!==null&&this.id===this.hostId;}
  connect(){
    this.stopped=false;this.onStatus('Conectando con el hato…');
    const ws=this.socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
    ws.onopen=()=>ws.send(JSON.stringify({t:'join',game:'galope',room:this.code,name:this.name}));
    ws.onmessage=e=>{
      let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.t==='full'){this.stopped=true;this.connected=false;this.onStatus('Sala llena. Abre una carrera local.',true);ws.close();return;}
      if(m.t==='welcome'){
        this.id=m.id;this.connected=true;this.attempts=0;
        this.members=new Map([...m.players,{id:m.id,name:this.name,avatar:this.avatar,coat:this.coat}].map(p=>[p.id,p]));
        this.elect();this.send({kind:'hello',avatar:this.avatar,coat:this.coat});this.status();
      }else if(m.t==='joined'){
        this.members.set(m.id,{id:m.id,name:m.name});
        if(this.isHost){this.game.addPlayer(m.id,m.name);this.publish();}
        this.send({kind:'hello',avatar:this.avatar,coat:this.coat});this.status();
      }else if(m.t==='left'){
        this.members.delete(m.id);this.inputs.delete(m.id);
        if(this.isHost)this.game.removePlayer(m.id);
        this.elect();this.status();
      }else if(m.t==='state'&&m.v?.game==='galope-v1'&&this.members.has(m.id))this.receive(m.id,m.v);
    };
    ws.onerror=()=>{};
    ws.onclose=()=>{
      if(this.stopped)return;
      this.connected=false;this.onStatus('Se perdió la conexión. Reconectando…',true);
      if(++this.attempts<=3)this.retry=setTimeout(()=>this.connect(),1500);
      else this.onStatus('Sin conexión. Puedes correr en local.',true);
    };
  }
  elect(){
    const previous=this.hostId;this.hostId=Math.min(...this.members.keys());
    if(this.isHost&&previous!==this.hostId){
      this.game=Race.restore(this.state,this.members);
      for(const m of this.members.values())if(!this.game.players.some(p=>p.id===m.id))this.game.addPlayer(m.id,m.name,m.avatar||{},m.coat);
      this.publish();
    }
  }
  status(){this.onStatus(this.offline?'Carrera local · tú y los jinetes':`${this.members.size}/8 panas · ${this.isHost?'tú das la salida':'el anfitrión da la salida'}`);}
  send(v){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify({t:'state',v:{game:'galope-v1',...v}}));}
  receive(id,data){
    if(data.kind==='hello'){
      const m=this.members.get(id);m.avatar=data.avatar||{};m.coat=data.coat;
      if(this.isHost){this.game.addPlayer(id,m.name,m.avatar,m.coat);this.publish();}
    }else if(data.kind==='snapshot'&&id===this.hostId&&!this.isHost&&Array.isArray(data.state?.players)){
      this.state=data.state;this.onState(this.state);
    }else if(data.kind==='input'&&this.isHost)this.inputs.set(id,{...cleanInput(data.input),at:performance.now()});
  }
  choose(coat){this.coat=coat;const m=this.members.get(this.id);if(m)m.coat=coat;if(this.isHost){this.game.addPlayer(this.id,this.name,this.avatar,coat);this.publish();}else this.send({kind:'hello',avatar:this.avatar,coat});}
  start(bots=true){if(this.isHost&&this.connected&&['lobby','finished'].includes(this.game.phase)){this.game.start(bots);this.publish();}}
  publish(){this.state=this.game.snapshot();this.onState(this.state);if(!this.offline)this.send({kind:'snapshot',state:this.state});}
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
  practice(){this.stopped=true;this.offline=true;clearTimeout(this.retry);this.socket?.close();this.id=1;this.hostId=null;this.state=new Race().snapshot();this.inputs.clear();this.members=new Map([[1,{id:1,name:this.name,avatar:this.avatar,coat:this.coat}]]);this.connected=true;this.elect();this.status();}
  dispose(){this.stopped=true;clearTimeout(this.retry);this.socket?.close();}
}
