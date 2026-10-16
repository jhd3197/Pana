import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { reefFish } from '/engine/models/fauna/aquatic/reef-fish.js';

export function reefFishSchool({seed=7,count=6,radius=2.4}={}) {
  if(!Number.isInteger(seed)||!Number.isInteger(count)||count<1||count>16||!Number.isFinite(radius)||radius<1||radius>8)
    throw new RangeError('School requires integer seed, 1–16 fish and a 1–8 m radius');
  const group=new THREE.Group(),random=rng(seed),fish=[];
  for(let i=0;i<count;i++) {
    const object=reefFish({seed:seed+i*17}),phase=random()*Math.PI*2;
    const r=radius*(.55+random()*.3),depth=(random()-.5)*.3;
    object.scale.setScalar(.8+random()*.4);group.add(object);fish.push({object,phase,r,depth});
  }
  group.name='Cardumen costero';group.userData.assetId='reef-fish-school';
  group.userData.footprintRadius=radius+.65;
  group.userData.previewBounds=[[-radius-.65,-.6,-radius-.65],[radius+.65,.6,radius+.65]];
  group.userData.tick=(t=0)=>{
    if(!Number.isFinite(t))return;
    for(const {object,phase,r,depth} of fish) {
      const a=t*.22+phase;object.position.set(Math.cos(a)*r,depth+Math.sin(t*.6+phase)*.07,Math.sin(a)*r*.65);
      object.rotation.y=Math.atan2(-Math.sin(a),Math.cos(a)*.65);object.userData.tick(t);
    }
  };
  group.userData.tick(0);return group;
}
