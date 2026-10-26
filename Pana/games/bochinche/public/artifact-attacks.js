import { locKey } from '../../../engine/i18n.js';
import { PANAS, fighterId, panaOfFighter } from './panas.js';
// Match adaptation of Prueba de golpes. Timings use simulation frames, not
// the cinematic prototype's seconds-long freezes. Up-special retains recovery.
// Names are locKey() source, shown through loc() by the fight HUD.
export const ATTACK_THEMES = {
  'neutral-special': {name:locKey('Rayo'),color:'#ffc629'},
  'side-special': {name:locKey('Candela'),color:'#ff6a2a'},
  'down-special': {name:locKey('Hielo'),color:'#5ad2ff'},
  'forward-smash': {name:locKey('Jonrón'),color:'#8e4de8'},
};
// The neutral special is the fighter's own poder; the others are shared.
export const attackTheme = (fighter, move) => move === 'neutral-special' && String(fighter ?? '').includes(':')
  ? {name:panaOfFighter(fighter).poder,color:panaOfFighter(fighter).color} : ATTACK_THEMES[move];
export function applyArtifactAttacks(roster) {
  for(const fighter of Object.values(roster)) {
    const a=fighter.attacks, base=a.jab;
    const make=(label,damage,angle,startup,recovery,radius,extra={})=>({...base,label,damage,angle,startup,active:4,recovery,radius,
      offset:{x:65,y:4},baseKnockback:45,knockbackGrowth:.8,hitstop:6,hitstun:20,shieldDamage:damage*.7,...extra});
    a['neutral-special']=make('Rayo',14,72,18,28,65,{offset:{x:100,y:20}});
    a['side-special']=make('Candela',12,34,16,26,55,{projectile:{kind:'fireball',speed:440,gravity:0,lifetimeFrames:60,radius:24,absorbable:true}});
    a['down-special']=make('Hielo',10,18,20,30,85,{statusEffect:'freeze',statusFrames:38});
    // make()'s first argument is an internal move label, never shown.
    a['forward-smash']=make('Jonrón',fighter.id==='yeti'?34:fighter.id==='platformer'?26:30,40,28,42,72,{baseKnockback:62,knockbackGrowth:1.2,hitstop:10,hitstun:28,chargeable:true,maxChargeFrames:40}); // i18n-ignore
  }
  // One fighter per style and pana: the style's body and moves, the pana's poder.
  for(const fighter of Object.values(roster)) {
    if(String(fighter.id).includes(':'))continue;
    const special=fighter.attacks['neutral-special'];
    for(const pana of PANAS) {
      const id=fighterId(fighter.id,pana.id),{damage,...poder}=pana.move;
      roster[id]={...fighter,id,attacks:{...fighter.attacks,'neutral-special':{...special,offset:{x:65,y:4},active:4,...poder,
        label:pana.id,damage,shieldDamage:damage*.7}}};
    }
  }
}
