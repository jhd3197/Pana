import * as THREE from 'three';
import { getFighterDefinition } from './combat/roster.js';
import { ATTACK_THEMES } from './artifact-attacks.js';
// Bounded, reusable meshes for the authored charge / release / impact language.
export function createAttackEffects(root) {
  const pool=Array.from({length:6},()=>{
    const group=new THREE.Group();root.add(group);
    const glow=new THREE.MeshBasicMaterial({color:'#ffc629',transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.035,6,36),glow);group.add(ring);
    const boltGroup=new THREE.Group();group.add(boltGroup);
    const core=new THREE.MeshBasicMaterial({color:'#fff6cf',toneMapped:false});
    for(let i=0;i<9;i++) {
      const a=new THREE.Vector3((i%2?-.13:.13),i*.32,0),b=new THREE.Vector3((i%2?.13:-.13),(i+1)*.32,0);
      const m=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,a.distanceTo(b),5),core);
      m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());boltGroup.add(m);
    }
    const ice=new THREE.Mesh(new THREE.IcosahedronGeometry(.85,0),new THREE.MeshPhysicalMaterial({color:'#5ad2ff',transparent:true,opacity:.4,roughness:.15,metalness:.15,depthWrite:false}));group.add(ice);
    const bat=new THREE.Mesh(new THREE.CylinderGeometry(.12,.055,1.6,10),new THREE.MeshStandardMaterial({color:'#ad703c',roughness:.65}));group.add(bat);
    const flames=Array.from({length:7},(_,i)=>{
      const m=new THREE.Mesh(new THREE.ConeGeometry(.14,.65,5),new THREE.MeshBasicMaterial({color:i%2?'#ff6a2a':'#ffd268',transparent:true,depthWrite:false,toneMapped:false}));group.add(m);return m;
    });
    return {group,ring,boltGroup,ice,bat,flames};
  });
  return {
    update(fighters,time) {
      pool.forEach((e,i)=>{
        const f=fighters[i],theme=ATTACK_THEMES[f?.currentMove],frozen=f?.statusEffect==='freeze';
        e.group.visible=!!f&&f.stocks>0&&(!!theme||frozen);if(!e.group.visible)return;
        const move=theme?getFighterDefinition(f.fighter).attacks[f.currentMove]:null;
        const active=move&&f.moveFrame>=move.startup&&f.moveFrame<move.startup+move.active+5;
        const charge=move?Math.min(1,f.moveFrame/Math.max(1,move.startup)):1;
        e.group.position.set(f.position.x*.014,f.position.y*.014,.65);
        e.ring.visible=!!theme;e.ring.material.color.set(theme?.color??'#5ad2ff');
        e.ring.scale.setScalar(.3+charge*.7);e.ring.rotation.z=time*3;
        e.boltGroup.visible=f.currentMove==='neutral-special'&&active;e.boltGroup.position.x=f.facing*1.4;
        e.ice.visible=frozen||f.currentMove==='down-special';e.ice.rotation.y=time*.8;e.ice.scale.setScalar(frozen?1:.4+charge*.6);
        e.bat.visible=f.currentMove==='forward-smash';e.bat.position.set(f.facing*.65,.45,0);e.bat.rotation.z=f.facing*(active?-1.5:.4+charge*.6);
        e.flames.forEach((m,k)=>{m.visible=f.currentMove==='side-special';const a=k/7*Math.PI*2+time*4;m.position.set(f.facing*.7+Math.cos(a)*.35,Math.sin(a)*.35,0);m.scale.y=.6+.4*Math.sin(time*12+k);});
      });
    },
  };
}
