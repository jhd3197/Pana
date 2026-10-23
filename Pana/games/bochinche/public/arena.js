// Scenery follows the imported collision surfaces; the fighting plane stays clear.
import * as THREE from 'three';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { rng } from '/engine/random.js';
import { getStageDefinition } from './combat/stages.js';
export function dressArena(root, scale) {
  const random = rng(33), clouds = [], falls = [];
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .9 });
  const stone = mat('#687e80'), rim = mat('#e4c795'), turf = mat('#8bb864'), path = mat('#c9d5a4');
  const water = mat('#78cfdb'), foam = mat('#d3f3ea');
  function mesh(geometry, material, x, y, z) {
    const m = new THREE.Mesh(geometry,material); m.position.set(x,y,z);
    m.castShadow=m.receiveShadow=true; root.add(m); return m;
  }
  function box(w,h,d,material,x,y,z) {const m=mesh(new THREE.BoxGeometry(w,h,d),material,x,y,z);m.castShadow=h>.3;return m;}
  for (const p of getStageDefinition('verdant-grove').platforms) {
    const w=p.width*scale, h=p.height*scale, x=p.x*scale, top=(p.y+p.height/2)*scale, depth=p.kind==='ground'?3.8:2.15;
    // Bevel only the underside: the collision's complete top edge remains visible.
    const profile = new THREE.Shape();
    profile.moveTo(-w/2,0);profile.lineTo(w/2,0);profile.lineTo(w/2-.14,-h*.5);
    profile.lineTo(w*.34,-h);profile.lineTo(-w*.37,-h);profile.lineTo(-w/2+.12,-h*.55);profile.closePath();
    const geo=new THREE.ExtrudeGeometry(profile,{depth,bevelEnabled:false});geo.translate(0,0,-depth/2);
    mesh(geo,stone,x,top-.12,0);
    box(w+.04,.13,depth+.05,rim,x,top-.075,0);
    box(w,.045,depth,turf,x,top-.022,0);
    // A quiet pale lane makes the character silhouette and feet easy to read.
    box(w-.12,.012,depth*.62,path,x,top+.003,.12);
    if(p.kind==='ground') {
      for(let i=-8;i<=8;i++) box(.035,.015,1.9,rim,i,top+.012,.12);
      for(let i=-6;i<=6;i+=3) {
        const shard=mesh(new THREE.DodecahedronGeometry(.9,0),stone,i,-2.6-random()*.7,0);
        shard.scale.set(1.6,1.8,1.4);shard.rotation.z=random()*.35;
      }
      for(const side of [-1,1]) {
        box(.24,.08,depth,rim,side*(w/2-.16),top+.03,0);
        for(let i=0;i<3;i++) {
          const fall=box(.11+i*.025,7.5, .12, i===1?foam:water,side*7.1+i*.12,-5.4,-1.9);
          falls.push(fall);
        }
      }
    } else {
      for(const dx of [-w*.33,w*.33]) box(.12,.14,depth*.85,rim,x+dx,top-.23,0);
    }
  }
  const tree=mangoTree({seed:8,h:1.9,detail:'game'});tree.position.set(-8.9,0,-2.3);root.add(tree);
  const coconut=palm({seed:22,h:4.1,detail:'game'});coconut.position.set(8.6,0,-2.3);root.add(coconut);
  // Muted mountain layers sit behind the gameplay silhouettes.
  for(let layer=0;layer<3;layer++) for(let i=0;i<7;i++) {
    const hill=mesh(new THREE.SphereGeometry(1,12,8),mat(['#94bdad','#accdc0','#c0ddd2'][layer]),(i-3)*11+layer*4,-9-layer*2,-19-layer*14);
    hill.scale.set(8+random()*4,5+random()*5,5);hill.castShadow=false;
  }
  const cloudMat=new THREE.MeshBasicMaterial({color:'#f2f7ee',transparent:true,opacity:.8,depthWrite:false});
  for(let i=0;i<7;i++) {
    const c=mesh(new THREE.SphereGeometry(1,12,8),cloudMat,(i-3)*12,9+random()*5,-25-random()*14);
    c.scale.set(2.6+random()*2,1+random()*.6,1.5);c.castShadow=false;clouds.push({mesh:c,x:c.position.x});
  }
  return time=>{
    clouds.forEach((c,i)=>{c.mesh.position.x=c.x+Math.sin(time*.035+i)*1.8;});
    falls.forEach((m,i)=>{m.scale.x=.85+Math.sin(time*4+i)*.15;});
  };
}
