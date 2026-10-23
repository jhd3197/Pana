// Poses express the engine's startup, active and recovery frames; they never
// move the authoritative body or change a hitbox.
import { clamp } from '../../../engine/random.js';
import { getFighterDefinition } from './combat/roster.js';
export function animateFighter(entry, fighter, dt, time) {
  const c=entry.character,f=fighter,walking=f.grounded&&Math.abs(f.velocity.x)>20;
  c.update(dt,{walk:walking?1:0,run:true,dizzy:f.state==='hitstun'});
  const armL=c.armL,armR=c.armR;
  c.group.rotation.z=0;c.group.position.y=0;
  if(f.state==='shield') {
    armL.rotation.x=armR.rotation.x=-1.45;armL.rotation.z=.45;armR.rotation.z=-.45;
    c.group.position.y=-.06;
  } else if(f.currentMove) {
    const move=getFighterDefinition(f.fighter).attacks[f.currentMove];
    const frame=f.moveFrame+(entry.poseTime??0)*60;
    const wind=clamp(frame/Math.max(1,move.startup)),strike=clamp((frame-move.startup)/Math.max(1,move.active));
    const recovery=clamp((frame-move.startup-move.active)/Math.max(1,move.recovery));
    const drive=frame<move.startup?-.35*wind:Math.sin((.18+strike*.32)*Math.PI)*(1-recovery);
    const up=f.currentMove.startsWith('up-'),down=f.currentMove.startsWith('down-'),spin=f.currentMove==='neutral-air';
    armL.rotation.x=-.5-drive*(up?2.3:1.3);armR.rotation.x=up?armL.rotation.x:-.7-drive*.55;
    armL.rotation.z=down?.8:up?.2:.12;armR.rotation.z=-.2;
    c.group.rotation.z=f.facing*(down?.2:-.12)*drive;
    c.group.position.y=down?-.12*Math.abs(drive):Math.max(0,drive)*.035;
    if(spin)c.group.rotation.z=f.facing*strike*Math.PI*2;
    c.legs[0].rotation.x=down?-1.2*drive:-.2;
    c.legs[1].rotation.x=.18;
  } else if(f.state==='hitstun') {
    c.group.rotation.z=-f.facing*.4;armL.rotation.x=armR.rotation.x=-2;
    c.legs[0].rotation.x=.5;c.legs[1].rotation.x=-.45;
  } else if(f.state==='ledge') {
    armL.rotation.x=armR.rotation.x=-2.8;c.legs[0].rotation.x=.3;c.legs[1].rotation.x=-.25;
  } else if(!f.grounded) {
    armL.rotation.x=armR.rotation.x=f.velocity.y>0?-.85:-1.8;
    c.legs[0].rotation.x=-.65;c.legs[1].rotation.x=.4;
  } else if(!walking) {
    const bob=Math.sin(time*3.5)*.04;
    armL.rotation.x=-.8+bob;armR.rotation.x=-1-bob;
    armL.rotation.z=.2;armR.rotation.z=-.2;
    if(f.state==='victory'){armL.rotation.x=-2.7;armR.rotation.x=-2.7;c.group.position.y=Math.abs(Math.sin(time*5))*.12;}
  }
  c.group.visible=!(f.invulnerableFrames>0&&Math.floor(time*12)%3===0);
}
