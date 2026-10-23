import { THREE,M,placeOnTrack,clear,finish,instances,boulder } from './world-kit.js';
import { palm } from '/engine/models/vegetation/palm.js';

// Short, separated groups leave deliberate ocean windows between chapters.
// The same library palm and stone shapes are repeated at readable scales.
export function coastalComposition(T,groundAt,occupied){
  const group=new THREE.Group(),fixed=new THREE.Group(),records=[];
  group.name='bululu-coastal-composition';
  const source=palm({seed:84,h:11,detail:'low'}),bounds=new THREE.Box3().setFromObject(source);
  const radius=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z));
  const palms=[];
  for(const [u,side] of [[.055,-1],[.18,-1],[.28,1],[.43,-1],[.855,1],[.94,1]]){
    for(const [i,ds] of [-34,-16,0,23,43].entries()){
      const scale=[.9,1.12,1,.86,1.06][i],r=radius*scale;
      const p=placeOnTrack(T,u*T.TOTAL+ds,side*(T.HW+8+r+(i%2)*5)),y=groundAt(p.x,p.z);
      const samples=[[-r,0],[r,0],[0,-r],[0,r]].map(([x,z])=>groundAt(p.x+x,p.z+z));
      if(y<.7||Math.max(...samples)-Math.min(...samples)>4||!clear(T,p.x,p.z,r)
        ||occupied.some(([x,z])=>Math.hypot(x-p.x,z-p.z)<r+8))continue;
      palms.push({x:p.x,z:p.z,y,rot:i*1.7+u*9,scale});occupied.push([p.x,p.z]);
      records.push({kind:'palm',u,x:p.x,z:p.z,y,r});
    }
  }
  instances(group,source,palms,'bululu-reveal-palms',100);
  // Low stone parapets belong only to the raised coastal lookouts. Open
  // beach and tidal sections keep their existing rope posts and open views.
  for(const [from,to,side] of [[.105,.205,1],[.395,.505,1]]){
    const vertices=[],indices=[],n=Math.ceil((to-from)*T.TOTAL/3);
    for(let i=0;i<=n;i++){
      const s=(from+(to-from)*i/n)*T.TOTAL;
      for(const off of [T.HW+1.6,T.HW+2.4]){
        const p=placeOnTrack(T,s,side*off),bottom=Math.min(groundAt(p.x,p.z),p.y)-.2;
        vertices.push(p.x,bottom,p.z,p.x,p.y+.7,p.z);
      }
      if(i<n)for(const [a,b] of [[0,1],[1,3],[3,2]]){
        const k=i*4;indices.push(k+a,k+b,k+a+4,k+b,k+b+4,k+a+4);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    fixed.add(new THREE.Mesh(geometry,M(0xe3d6b8,{side:THREE.DoubleSide})));
  }
  // A few embedded limestone masses screen the inside, never the lane.
  for(const [u,side] of [[.195,-1],[.205,-1],[.415,-1],[.44,-1]]){
    const p=placeOnTrack(T,u*T.TOTAL,side*(T.HW+17)),y=groundAt(p.x,p.z);
    if(y<1||!clear(T,p.x,p.z,5)||occupied.some(([x,z])=>Math.hypot(x-p.x,z-p.z)<10))continue;
    const rock=boulder(0xbaaa8e);rock.scale.set(1.2,1.6,1.2);rock.position.set(p.x,y-1,p.z);rock.rotation.y=p.h;fixed.add(rock);
    records.push({kind:'rock',u,x:p.x,z:p.z,y,r:5});
  }
  group.add(finish(fixed));group.userData.placements=records;
  return group;
}
