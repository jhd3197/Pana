// A llanero horse with riding tack and the player's pana in the saddle.
// Shared by Galope and Bululú's ¡Coleo! minigame. Faces +Z, metres.
import * as THREE from 'three';
import { llaneroHorse } from '/engine/models/fauna/farm/llanero-horse.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { box, tube } from '/engine/models/core/primitives.js';
import { TAU, blendGait, newGait, strideRate } from '/engine/models/animation/quadruped-gait.js';
const M=color=>new THREE.MeshStandardMaterial({color,roughness:.85});
const SEAT_Y=1.65,SEAT_Z=-.12,HAND_UP=.45,HAND_AHEAD=.25,BIT_X=.16,HAND_X=.29;
const UP=new THREE.Vector3(0,1,0),direction=new THREE.Vector3();
// The gait may ease into a sudden change in speed (a log, the finish line).
const GAIN=12,LOSS=12;

// A stable integer seed for a player or bot id, so a field is not in lockstep.
export function riderSeed(id){let seed=7;for(const ch of String(id))seed=(Math.imul(seed,31)+ch.charCodeAt(0))|0;return seed;}

export function createRider(avatar,coat='bay',seed=7){
  const group=new THREE.Group(),horse=llaneroHorse({coat,seed,locomotion:true});group.add(horse);
  const saddle=new THREE.Group();saddle.name='Riding tack';
  saddle.add(box(.7,.09,.72,M(0x466e61),0,1.58,-.05),box(.48,.1,.5,M(0x603f2c),0,1.67,-.06));
  const reins=[];
  for(const s of [-1,1]){
    saddle.add(tube([s*.29,1.58,.08],[s*.4,.91,.04],.022,M(0x68472f)));
    saddle.add(tube([s*.4,.91,-.05],[s*.4,.91,.13],.022,M(0xc4b897)));
    // Between the moving bit and the moving hand: redrawn every frame.
    const rein=tube([0,0,0],[0,1,0],.012,M(0x513b2d));rein.geometry.translate(0,.5,0);rein.position.set(0,0,0);rein.quaternion.identity();
    rein.userData.side=s;reins.push(rein);group.add(rein);
  }
  group.add(saddle);
  const rider=buildCharacter(avatar,{seated:true});rider.group.scale.setScalar(.7);rider.group.position.set(0,SEAT_Y,SEAT_Z);group.add(rider.group);
  const {gait:{pose,variation}}=horse.userData,gait=newGait();
  let phase=variation.phase,speed=0,lastJump=0,climb=0,seat=0,seatVelocity=0,disposed=false;
  return {group,horse,rider,get stridePhase(){return phase;},get gaitSpeed(){return speed;},
    update(dt,p){
      const wanted=Math.max(0,p.speed||0),jumpY=p.jumpY||0;
      speed+=Math.min(GAIN*dt,Math.max(-LOSS*dt,wanted-speed));
      if(speed<.03&&!wanted)speed=0;
      if(dt>0)climb=jumpY>0?(jumpY-lastJump)/dt:0;
      lastJump=jumpY;
      // Feet stay planted because the stride follows the ground. Airborne, it holds.
      if(!(jumpY>0))phase+=dt*TAU*strideRate(speed,blendGait(speed,gait,variation));
      horse.userData.gallop(phase,speed,jumpY,climb);
      rider.update(dt,{look:0});
      // A mounted pose: legs straddle the horse, hands hold the reins and give
      // with the head, the body folds forward as the horse opens up.
      rider.legs.forEach((leg,i)=>leg.rotation.set(-.2,0,(i?1:-1)*.35));
      rider.arms.forEach((arm,i)=>arm.rotation.set(-.85-pose.lean-pose.armNod,0,(i?-1:1)*.12));
      // A sprung rider, a beat behind the saddle: y here follows the seat point.
      const c=Math.cos(pose.pitch),s=Math.sin(pose.pitch),seatY=SEAT_Y*c-SEAT_Z*s+pose.bob-SEAT_Y;
      if(dt>0){seatVelocity+=(220*(seatY-seat)-24*seatVelocity)*Math.min(dt,.04);seat+=seatVelocity*Math.min(dt,.04);}
      else if(!seat&&!seatVelocity)seat=seatY;
      const tilt=pose.pitch*.6+pose.lean,riderZ=SEAT_Y*s+SEAT_Z*c;
      rider.group.position.set(0,SEAT_Y+seat,riderZ);rider.group.rotation.x=tilt;
      saddle.position.y=pose.bob;saddle.rotation.x=pose.pitch;
      const handY=SEAT_Y+seat+HAND_UP*Math.cos(tilt)-HAND_AHEAD*Math.sin(tilt),handZ=riderZ+HAND_UP*Math.sin(tilt)+HAND_AHEAD*Math.cos(tilt);
      for(const rein of reins){
        const side=rein.userData.side;
        direction.set(side*(HAND_X-BIT_X),handY-pose.bitY,handZ-pose.bitZ);
        rein.scale.y=direction.length();rein.position.set(side*BIT_X,pose.bitY,pose.bitZ);
        rein.quaternion.setFromUnitVectors(UP,direction.normalize());
      }
    },
    dispose(){if(disposed)return;disposed=true;horse.userData.dispose();rider.dispose();const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());group.removeFromParent();}
  };
}
