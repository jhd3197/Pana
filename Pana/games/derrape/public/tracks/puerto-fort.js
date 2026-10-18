import { THREE,M,mesh,put,box,finish,sign } from './world-kit.js';
import { sanCarlosFortress } from '/engine/models/props/san-carlos-fortress.js';
import { FORT,isFort } from './puerto-layout.js';

export function puertoFort(T){
  const group=new THREE.Group(),trim=new THREE.Group();group.name='puerto-san-carlos';
  const model=sanCarlosFortress({scale:FORT.scale,heightScale:FORT.heightScale,terrace:14,
    clearance:(x,z,y,r)=>Math.abs(T.offsetOf(x+FORT.x,z+FORT.z,y+FORT.y))>T.HW+r+2});
  put(group,model,FORT.x,FORT.z,FORT.y);model.name='puerto-hilltop-fort';
  const stone=model.children.find(o=>o.material?.map?.name==='san-carlos-stone').material;
  const positions=[],uv=[],top=FORT.y+FORT.wall+.2;
  function sideWall(a,b,y0,u0,u1){
    positions.push(a.x,y0,a.z,a.x,a.y,a.z,b.x,b.y,b.z,a.x,y0,a.z,b.x,b.y,b.z,b.x,y0,b.z);
    uv.push(u0,0,u0,(a.y-y0)/24,u1,(b.y-y0)/24,u0,0,u1,(b.y-y0)/24,u1,0);
  }
  for(let s=0;s<T.TOTAL;s+=2){
    const p=T.pointAt(s),q=T.pointAt(s+2);if(!isFort(p.x,p.y)||T.gapAt(s))continue;
    const y=T.groundAt(p.x,p.y,T.heightAtS(s)),y2=T.groundAt(q.x,q.y,T.heightAtS(s+2)),h=Math.atan2(q.x-p.x,q.y-p.y);
    if(y<FORT.y+.8)continue;
    const curb=M(Math.floor(s/5)%2?0xc5bda9:0xe9dcc0);
    for(const side of [-1,1]){
      const off=side*(T.HW+.65),x=p.x-Math.cos(h)*off,z=p.y+Math.sin(h)*off;
      const band=box(1.2,.24,2.15,curb,x,y+.12,z);band.rotation.y=h;trim.add(band);
      // Continuous iron guards protect the elevated circuit and the climb.
      const nextOff=side*(T.HW+.65),x2=q.x-Math.cos(h)*nextOff,z2=q.y+Math.sin(h)*nextOff;
      const iron=M(0x3d4543,{metalness:.55,roughness:.65});
      if(Math.floor(s/2)%2===0)trim.add(box(.16,1.9,.16,iron,x,y+.95,z));
      for(const lift of [.6,1.2,1.85]){
        const a=new THREE.Vector3(x,y+lift,z),b=new THREE.Vector3(x2,y2+lift,z2),mid=a.clone().add(b).multiplyScalar(.5);
        const bar=box(.13,.13,a.distanceTo(b),iron,mid.x,mid.y,mid.z);bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),b.sub(a).normalize());trim.add(bar);
      }
      if(y<top-.2||y>top+.5){
        const x2=q.x-Math.cos(h)*off,z2=q.y+Math.sin(h)*off,base=y>top?top-.2:FORT.y;
        sideWall({x,y,z},{x:x2,y:y2,z:z2},base,s/28,(s+2)/28);
        const rail=box(.65,1.4,2.15,M(0xe9dcc0),x,y+.7,z);rail.rotation.y=h;trim.add(rail);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const walls=mesh(geo,stone);walls.name='san-carlos-ramp-viaduct';group.add(walls);
  const r=T.ramps[0],s=r.s0+8,p=T.pointAt(s),q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y),y=T.groundAt(p.x,p.y,top);
  const banner=sign(['¡SALTO!'],21,3.8,{background:'#38454a'});banner.position.set(p.x,y+10,p.y);banner.rotation.y=h+Math.PI;group.add(banner);
  for(const off of [-13,13])trim.add(box(.45,12,.45,M(0x26282c),p.x-Math.cos(h)*off,y+6,p.y+Math.sin(h)*off));
  group.add(finish(trim,Infinity));return group;
}
