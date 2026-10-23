import {THREE,M,box,tube,sign,put,finish,instances,clear} from './world-kit.js';
import {landPatch,landPath,grove} from './landscape-kit.js';
import {grandstand} from './world-landmarks.js';
import {ceiba} from '/engine/models/vegetation/ceiba.js';
import {palm} from '/engine/models/vegetation/palm.js';
import {parkBench,streetFoodKiosk,busStopShelter} from '/engine/models/props/pueblo.js';
import {CARS} from '../cars.js';
import {DEFAULT_AVATAR} from '/engine/avatar.js';

export function stadiumGrounds(T,groundAt) {
  const group=new THREE.Group(),fixed=new THREE.Group(),white=M(0xe5dec8,{polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),teal=M(0x466d70),concrete=M(0xb9b59e);group.name='stadium-venue-grounds';
  const perimeter=[[-355,-275],[-310,-320],[260,-320],[335,-255],[335,215],[270,290],[-290,290],[-355,210],[-355,-275]];
  fixed.add(landPath(T,groundAt,perimeter,{width:22,color:0xcbbf9f,step:4}));
  // A low masonry base and open railings enclose the venue. Gates align with
  // the parking aisles; sight lines still reach trees and hills beyond the wall.
  const curve=new THREE.CatmullRomCurve3(perimeter.map(([x,z])=>new THREE.Vector3(x,0,z))),length=curve.getLength();
  let fencePanels=0;
  for(let s=0;s<length;s+=7){
    const p=curve.getPointAt(s/length),q=curve.getPointAt(Math.min(1,(s+7)/length));
    if(p.z>275&&Math.abs(p.x)<23||p.x>320&&p.z>40&&p.z<75)continue;
    const x=(p.x+q.x)/2,z=(p.z+q.z)/2,angle=Math.atan2(q.x-p.x,q.z-p.z),h=groundAt(x,z);
    const wall=box(.65,1.5,p.distanceTo(q)+.1,concrete,x,h+.75,z);wall.rotation.y=angle;fixed.add(wall);
    fixed.add(box(.7,3.7,.7,teal,p.x,groundAt(p.x,p.z)+1.85,p.z));
    for(const y of [2,3.4])fixed.add(tube([p.x,groundAt(p.x,p.z)+y,p.z],[q.x,groundAt(q.x,q.z)+y,q.z],.07,teal));
    fencePanels++;
  }
  for(const x of [-22,22])fixed.add(box(2.4,11,2.4,teal,x,6.5,294));
  fixed.add(box(48,3.5,2.2,teal,0,10,294));
  put(group,sign('ESTADIO PANA',42,2.3,{background:'#366368'}),0,295.15,10,0);
  put(group,sign('ENTRADA · TRIBUNA PRINCIPAL',27,1.3,{background:'#ad6547'}),0,295.2,7.6,0);
  // Planted parking islands, marked bays and actual garage vehicles.
  fixed.add(landPatch(T,groundAt,{x:-5,z:362,rx:240,rz:54,color:0x7b8584,rect:true,step:6}));
  fixed.add(landPatch(T,groundAt,{x:408,z:5,rx:48,rz:210,color:0x7b8584,rect:true,step:6}));
  fixed.add(landPath(T,groundAt,[[0,290],[0,320],[0,410],[80,460],[310,460],[408,390],[408,170]],{width:14,color:0x89918a}));
  fixed.add(landPath(T,groundAt,[[335,58],[360,58],[408,58]],{width:14,color:0x89918a}));
  const cars=[[],[]];let bays=0;
  for(let i=0;i<46;i++){
    const x=-232+i*10;if(Math.abs(x)<22)continue;
    for(const z of [334,391]){
      fixed.add(box(.2,.05,13,white,x,1.15,z));bays++;
      if((i+(z===334?0:2))%5===0)cars[i%2].push({x:x+4.5,z,y:1.1,rot:z===334?Math.PI:0,scale:1.25});
    }
  }
  for(let i=0;i<25;i++)for(const x of [376,441]){
    const z=-185+i*15;if(z>40&&z<80)continue;
    fixed.add(box(13,.05,.2,white,x,1.15,z));bays++;
    if(i%6===0)cars[i%2].push({x,z:z+6,y:1.1,rot:x===376?Math.PI/2:-Math.PI/2,scale:1.25});
  }
  for(const [i,id]of ['chamo','lancha'].entries()){
    const car=CARS.find(c=>c.id===id).build(DEFAULT_AVATAR);car.driver.group.removeFromParent();car.driver.dispose();
    // Preserve the real car silhouette/decals, but color-batch its opaque trim
    // before repeating parked copies. These cars have no live driver or rig.
    const paint=M(0xffffff,{vertexColors:true,roughness:.7,metalness:.1});
    car.root.traverse(o=>{
      if(!o.isMesh||o.material.transparent||o.material.map||Array.isArray(o.material))return;
      const p=o.geometry.attributes.position,old=o.geometry.attributes.color,colors=[],c=new THREE.Color();
      for(let j=0;j<p.count;j++){
        c.copy(o.material.color);if(old&&o.material.vertexColors)c.multiply(new THREE.Color().fromBufferAttribute(old,j));colors.push(c.r,c.g,c.b);
      }
      o.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));o.material=paint;
    });
    instances(group,car.root,cars[i],`stadium-parked-${id}`,420);
  }
  // Two additional stands complete the northern and eastern race sectors.
  put(group,grandstand({length:90,rows:8,color:0x609a91}),-135,-272,1);
  put(group,grandstand({length:75,rows:8,color:0xc47b52}),287,-170,1,-Math.PI/2);
  const gardens=[[-184,93,48,32,10],[-172,-132,43,31,10],[150,-164,44,29,10],[-5,-91,27,21,5]];
  for(const [i,[x,z,rx,rz]]of gardens.entries()){
    fixed.add(landPatch(T,groundAt,{x,z,rx,rz,color:0x729b68,seed:i,step:3}));
    fixed.add(landPath(T,groundAt,[[x-rx*.7,z],[x,z+rz*.45],[x+rx*.7,z]],{width:4,color:0xc7b797}));
    for(const side of [-1,1])if(clear(T,x+side*12,z+10,4))put(fixed,parkBench(),x+side*12,z+10,groundAt(x+side*12,z+10)+.1,Math.PI,1.6);
  }
  const trees=grove(T,groundAt,[...gardens,[-405,-100,30,230,26],[40,-370,240,30,32],[-100,445,200,22,22],[490,-25,30,240,26]],
    {seed:921,scale:1.9,margin:13,accept:(x,z)=>Math.abs(x)>350||z<-335||z>425||gardens.some(([cx,cz,rx,rz])=>Math.hypot((x-cx)/rx,(z-cz)/rz)<.7)});
  instances(group,ceiba({seed:8,detail:'distant'}),trees,'stadium-shade-groves',220);
  const palms=[];
  for(let x=-230;x<=230;x+=30)if(Math.abs(x)>24){fixed.add(box(12,.3,5,concrete,x,1.2,362));palms.push({x,z:362,y:1.35,scale:1.2});}
  for(let z=-180;z<195;z+=35)if(z<40||z>80){fixed.add(box(5,.3,13,concrete,408,1.2,z));palms.push({x:408,z,y:1.35,scale:1.1});}
  instances(group,palm({seed:3,h:10}),palms,'stadium-parking-palms',260);
  // Picnic/concession court ties the existing kiosks and basketball court to entry.
  fixed.add(landPatch(T,groundAt,{x:150,z:260,rx:100,rz:25,color:0xcab793,rect:true,step:5}));
  for(const x of [85,115,145,205]){
    put(fixed,parkBench(),x,260,1.2,Math.PI,1.7);put(fixed,parkBench(),x,274,1.2,0,1.7);
    if(x<145)put(fixed,streetFoodKiosk(),x,247,1.2,0,1.4);
  }
  put(group,busStopShelter(),42,316,1.1,Math.PI,2);
  for(const [x,z]of [[-310,240],[290,235],[-315,-280],[280,-280]]){
    fixed.add(box(.7,27,.7,teal,x,14.5,z),box(8,2,1,teal,x,28,z));
    for(let i=-2;i<=2;i++)fixed.add(box(1,1.3,.2,M(0xffedba),x+i*1.4,28,z+.6));
  }
  group.add(finish(fixed,220));group.userData.surroundings={gates:2,parkingBays:bays,parkedCars:cars.flat().length,gardens:gardens.length,trees:trees.length+palms.length,fencePanels,grandstands:8};
  return group;
}
