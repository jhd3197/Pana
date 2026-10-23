import { THREE,M,mesh,put,box,finish,sign } from './world-kit.js';
import { sanCarlosFortress } from '/engine/models/props/san-carlos-fortress.js';
import { FORT,isFort } from './puerto-layout.js';

export function puertoFort(T){
  const group=new THREE.Group(),trim=new THREE.Group();group.name='puerto-san-carlos';
  const model=sanCarlosFortress({scale:FORT.scale,heightScale:FORT.heightScale,terrace:14,
    clearance:(x,z,y,r)=>Math.abs(T.offsetOf(x+FORT.x,z+FORT.z,y+FORT.y))>T.HW+r+2});
  put(group,model,FORT.x,FORT.z,FORT.y);model.name='puerto-hilltop-fort';
  const stone=model.children.find(o=>o.material?.map?.name==='san-carlos-stone').material;
  T.ramps[0].material=stone;
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
      const length=Math.hypot(q.x-p.x,q.y-p.y,y2-y);
      const slope=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(q.x-p.x,y2-y,q.y-p.y).normalize());
      const band=box(1.2,.24,length+.04,curb,(x+q.x-Math.cos(h)*off)/2,(y+y2)/2+.12,(z+q.y+Math.sin(h)*off)/2);band.quaternion.copy(slope);trim.add(band);
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
        const rail=box(.65,1.4,length+.04,M(0xe9dcc0),(x+x2)/2,(y+y2)/2+.7,(z+z2)/2);rail.quaternion.copy(slope);trim.add(rail);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const walls=mesh(geo,stone);walls.name='san-carlos-ramp-viaduct';group.add(walls);
  const r=T.ramps[0],s=r.s0+8,p=T.pointAt(s),q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y),y=T.groundAt(p.x,p.y,top);
  const banner=sign(['¡AL CAÑÓN!'],21,3.8,{background:'#38454a'});banner.position.set(p.x,y+10,p.y);banner.rotation.y=h+Math.PI;group.add(banner);
  for(const off of [-13,13])trim.add(box(.45,12,.45,M(0x26282c),p.x-Math.cos(h)*off,y+6,p.y+Math.sin(h)*off));
  // Open fortress cannon: the existing road launches the car through its bore.
  // The bore clears the entire driving width and chase camera, without a teleport.
  const launch=new THREE.Group(),cs=r.s0+r.len-14,cp=T.pointAt(cs),cq=T.pointAt(cs+1);
  const cy=T.groundAt(cp.x,cp.y,T.heightAtS(cs)),ny=T.groundAt(cq.x,cq.y,T.heightAtS(cs+1));
  launch.name='fort-launch-cannon';launch.position.set(cp.x,cy,cp.y);
  launch.rotation.set(-Math.atan2(ny-cy,Math.hypot(cq.x-cp.x,cq.y-cp.y)),Math.atan2(cq.x-cp.x,cq.y-cp.y),0,'YXZ');
  const gunmetal=M(0x344b4c,{metalness:.55,roughness:.48,side:THREE.DoubleSide}),brass=M(0xd4ae5b,{metalness:.5,roughness:.45});
  const barrel=mesh(new THREE.CylinderGeometry(16,16,24,32,1,true),gunmetal,0,11,0);barrel.rotation.x=Math.PI/2;launch.add(barrel);
  for(const z of [-12,-7,9,12]){
    const ring=mesh(new THREE.TorusGeometry(16,.48,6,32),brass,0,11,z);launch.add(ring);
  }
  const light=M(0xa7e9d8,{emissive:0x59bda4,emissiveIntensity:.8});
  for(const z of [-10,0,10])for(const side of [-1,1]){
    const lamp=box(.32,2.8,.6,light,side*14,17,z);lamp.rotation.z=side*.45;launch.add(lamp);
  }
  for(const side of [-1,1]){
    launch.add(box(2.2,7,18,M(0x895d3b),side*16.8,-1,0));
    for(const z of [-6,6]){const wheel=mesh(new THREE.CylinderGeometry(4.5,4.5,1.2,16),gunmetal,side*18.5,-1,z);wheel.rotation.z=Math.PI/2;launch.add(wheel);}
  }
  group.add(launch);
  // Painted launch chevrons and a landing threshold sit flush with the surface.
  const paint=[],gold=M(0xf7d56a,{side:THREE.DoubleSide});
  function mark(s0,len,w){
    const shape=[[-w,0],[-w,1.2],[0,len],[w,1.2],[w,0],[0,len-1.2]];
    const vertices=shape.map(([off,ds])=>{const s=s0+ds,p=T.pointAt(s),q=T.pointAt(s+.1),h=Math.atan2(q.x-p.x,q.y-p.y),x=p.x-Math.cos(h)*off,z=p.y+Math.sin(h)*off;return [x,T.groundAt(x,z,T.heightAtS(s))+.06,z];});
    for(const i of [0,1,2,0,2,5,5,2,3,5,3,4])paint.push(...vertices[i]);
  }
  for(const ds of [22,38,54,70])mark(r.s0+ds,5,3.2);
  const landing=T.gaps[0].s0+T.gaps[0].len;
  for(const ds of [7,17])mark(landing+ds,4,4.5);
  const markings=new THREE.BufferGeometry();markings.setAttribute('position',new THREE.Float32BufferAttribute(paint,3));markings.computeVertexNormals();
  const guide=mesh(markings,gold);guide.name='fort-jump-guidance';group.add(guide);
  group.add(finish(trim,Infinity));return group;
}
