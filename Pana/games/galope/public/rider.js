import * as THREE from 'three';
import { llaneroHorse } from '/engine/models/fauna/farm/llanero-horse.js';
import { buildCharacter } from '/engine/character.js';
import { box, tube } from '/engine/models/core/primitives.js';
const M=color=>new THREE.MeshStandardMaterial({color,roughness:.85});

export function createRider(avatar,coat='bay',seed=7){
  const group=new THREE.Group(),horse=llaneroHorse({coat,seed,locomotion:true});group.add(horse);
  const saddle=new THREE.Group();saddle.name='Riding tack';
  saddle.add(box(.7,.09,.72,M(0x466e61),0,1.58,-.05),box(.48,.1,.5,M(0x603f2c),0,1.67,-.06));
  for(const s of [-1,1]){
    saddle.add(tube([s*.29,1.58,.08],[s*.4,.91,.04],.022,M(0x68472f)));
    saddle.add(tube([s*.4,.91,-.05],[s*.4,.91,.13],.022,M(0xc4b897)));
    saddle.add(tube([s*.16,1.92,.89],[s*.29,2.1,.13],.012,M(0x513b2d)));
  }
  group.add(saddle);
  const rider=buildCharacter(avatar,{seated:true});rider.group.scale.setScalar(.7);rider.group.position.set(0,1.65,-.12);group.add(rider.group);
  let phase=0,disposed=false;
  return {group,horse,rider,
    update(dt,p){
      phase+=dt*(p.speed>1?5+p.speed*.5:0);
      horse.userData.gallop(phase,p.speed,p.jumpY);
      rider.update(dt,{look:0});
      // A mounted pose: legs straddle the horse, hands hold the reins.
      rider.legs.forEach((leg,i)=>leg.rotation.set(-.2,0,(i?1:-1)*.35));
      rider.arms.forEach((arm,i)=>arm.rotation.set(-.85,0,(i?-1:1)*.12));
      rider.group.position.y=1.65+Math.abs(Math.sin(phase))*.065*Math.min(1,p.speed/5);
      rider.group.rotation.x=p.jumpY>0?-.12:p.speed>13?-.16:0;
      saddle.position.y=Math.abs(Math.sin(phase))*.035*Math.min(1,p.speed/5);
    },
    dispose(){if(disposed)return;disposed=true;horse.userData.dispose();rider.dispose();const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());group.removeFromParent();}
  };
}
