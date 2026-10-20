import * as THREE from 'three';

// A narrow, sloping verge seats the ribbon in the terrain instead of ending
// abruptly above the grass. Never fill the air below a bridge or cave deck.
export function roadShoulders(T) {
  let positions = [], colors = [];
  const count = Math.ceil(T.TOTAL / 4), group = new THREE.Group();
  group.name = 'road-shoulders';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
  function flush() {
    if(!positions.length)return;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);
    positions=[];colors=[];
  }
  const dust = new THREE.Color(T.def.palette.track).lerp(new THREE.Color(0xb3a080), .48);
  function edge(s, side, outside) {
    const p = T.pointAt(s), q = T.pointAt(s+.3), heading = Math.atan2(q.x-p.x,q.y-p.y);
    const off = side * (T.HW + (outside ? 2.4 : 0));
    const x = p.x-Math.cos(heading)*off, z = p.y+Math.sin(heading)*off;
    const surface = T.surfaceAt(x,z,T.heightAtS(s)), ground = T.terrainAt(x,z);
    if (Math.abs(ground-surface) > 2 || T.gapAt(s) || T.tagAt(s) !== 'g') return null;
    return [x, outside ? Math.min(surface-.15,ground+.04) : surface+.10, z];
  }
  for (let i=0;i<count;i++) for (const side of [-1,1]) {
    if(side===-1&&i%24===0)flush();
    const s=i/count*T.TOTAL, next=(i+1)/count*T.TOTAL;
    const a=edge(s,side,false),b=edge(s,side,true),c=edge(next,side,false),d=edge(next,side,true);
    if (![a,b,c,d].every(Boolean)) continue;
    for (const p of [a,b,c,b,d,c]) {
      positions.push(...p);
      const tint=dust.clone().multiplyScalar(.94+.06*Math.sin(s*.73));
      colors.push(tint.r,tint.g,tint.b);
    }
  }
  flush();
  group.userData.dispose=()=>material.dispose();
  return group;
}
