// Local-only repeatable strike. Uses combat's hit resolution and 60 Hz hit-stop.
import { Bash } from './rules.js';
import { createEmptyInput } from './combat/engine.js';
export const LIGHTNING_DEFAULTS = { lightning:true, flash:true, stop:true, shake:true, stopFrames:5, shakeStrength:0.12, slow:false };
export class LightningTrial {
  constructor(avatar = {}) {
    this.avatar=avatar; this.settings={...LIGHTNING_DEFAULTS}; this.round=0; this.casts=0; this.impacts=0;
    this.reset();
  }
  reset() {
    this.bash=new Bash(91); this.bash.configure({seats:2,items:false,seconds:300});
    this.bash.addPlayer('you','Tu pana',this.avatar); this.bash.start();
    this.combat=this.bash.combat; this.combat.phase='playing'; this.combat.countdownFrames=0;
    this.combat.fighters.forEach((f,i)=>{
      f.position={x:i?125:-125,y:f.definition.size.height/2};
      f.velocity={x:0,y:0}; f.launchVelocity={x:0,y:0}; f.facing=i?-1:1;
      f.state='idle'; f.grounded=true; f.invulnerableFrames=0; f.respawnFrames=0;
    });
    this.phase='ready'; this.age=0; this.accumulator=0; this.impact=null; this.round++;
  }
  cast() {
    if(this.phase==='charge'||this.phase==='impact')return false;
    this.reset(); this.active={...this.settings}; this.phase='charge'; this.casts++; return true;
  }
  step(dt) {
    if(this.phase==='ready'||this.phase==='done')return;
    this.accumulator+=Math.max(0,Math.min(.1,dt))*(this.active.slow?.25:1);
    while(this.accumulator+1e-9>=1/60) {
      this.accumulator-=1/60; this.age+=1/60;
      if(this.phase==='charge'&&this.age>=.25) {
        const [a,b]=this.combat.fighters;
        const move={...a.definition.attacks.jab,damage:12,hitstop:this.active.stop?this.active.stopFrames:0};
        this.combat.resolveAttackHit(a,b,move,'jab',createEmptyInput(),1,'projectile');
        // The engine adds a defender frame; zero really means zero in this lab.
        if(!this.active.stop)a.hitstopFrames=b.hitstopFrames=0;
        this.impact={from:{...a.position},to:{...b.position},id:++this.impacts};
        this.phase='impact'; this.age=0;
      } else if(this.phase!=='charge') {
        this.combat.step([createEmptyInput(),createEmptyInput()]);
        if(this.age>=1.15)this.phase='done';
      }
      if(this.phase==='done'){this.accumulator=0;break;}
    }
  }
  get frozen(){return this.combat.fighters.some(f=>f.hitstopFrames>0);}
  snapshot() {
    const fight=this.combat.getSnapshot(); fight.events=[];
    // Presentation pose only: no melee action/hitbox is spawned during charge.
    if(this.phase==='charge')Object.assign(fight.fighters[0],{currentMove:'neutral-special',moveFrame:Math.min(8,this.age*30)});
    return {players:this.bash.players,round:this.round,fight};
  }
}
