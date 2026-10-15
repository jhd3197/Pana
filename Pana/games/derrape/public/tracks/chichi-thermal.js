// Upper-mountain thermal sanctuary. Animated objects stay outside static batches.
import { THREE,M,mesh,box,sign,put,foundation,finish,placeOnTrack } from './world-kit.js';
import { hotSpringPool,steamVent,mineralTerraces,thermalBathhouse,thermalLookout } from '/engine/thermal-props.js';
import { steamField } from '/engine/thermal-steam.js';
import { wetnessAt } from './chichi-layout.js';

export function thermalSanctuary(T,world){
  const group=new THREE.Group(),fixed=new THREE.Group(),updates=[];group.name='aguas-del-cielo';
  const add=(object,x,z,scale=1,radius=5)=>{
    const placed=foundation(group,object,x,z,world.groundAt,{scale,radius,color:0xb6ae90});
    if(object.userData.tick)updates.push(t=>object.userData.tick(t));return placed;
  };
  add(hotSpringPool({radius:12,seed:81}),70,-400,1.35,18);
  add(hotSpringPool({radius:7,seed:83}),111,-410,1.3,11);
  add(mineralTerraces({seed:86}),21,-397,1.8,15);
  add(thermalBathhouse(),55,-433,1.6,10);
  for(const [i,[x,z]] of [[50,-374],[103,-431],[5,-425],[112,-370]].entries())add(steamVent({seed:90+i}),x,z,1.5,2.7);
  // Raised footpaths frame the pools, with posts tied to the sampled terrain.
  const wood=M(0x988465),iron=M(0x62756c);
  for(const [x,z,length,rotation] of [[65,-427,38,Math.PI/2],[43,-395,55,0],[82,-369,68,Math.PI/2]]){
    const deck=new THREE.Group(),y=world.groundAt(x,z)+1.2;
    for(let i=-length/2;i<length/2;i+=.7)deck.add(box(3,.15,.65,wood,0,0,i));
    for(let i=-length/2;i<=length/2;i+=4)for(const side of [-1,1]){
      deck.add(box(.15,2.3,.15,wood,side*1.4,.05,i));
      if(i<length/2)deck.add(box(.09,.1,4,iron,side*1.4,1.1,i+2));
    }put(fixed,deck,x,z,y,rotation);
  }
  const entry=placeOnTrack(T,T.paramOf(120,-460),T.HW+5);
  const marker=sign(['AGUAS DEL CIELO','TERMAS · PISO MOJADO'],10,2.5,{background:'#427a70'});
  put(fixed,marker,entry.x,entry.z,entry.y+4,entry.h+Math.PI);
  for(const side of [-1,1]){const p=placeOnTrack(T,T.paramOf(120,-460),T.HW+5+side*4.5);fixed.add(box(.18,4.8,.18,wood,p.x,p.y+2.4,p.z));}
  const lookout=add(thermalLookout(),-182,-550,1.9,12);lookout.name='ridge-lookout';
  // A few low plumes drift over the wet road; the rest stay over the pools.
  const roadClouds=[[157,-434],[160,-303],[53,-329]].map(([x,z])=>[x,T.surfaceAt(x,z)+.5,z]);
  const mist=steamField(roadClouds,{seed:127,count:10,radius:6,rise:8,opacity:.18,drift:5});mist.name='road-mist';group.add(mist);updates.push(t=>mist.userData.tick(t));
  const valley=steamField([[-240,105,-120],[-130,85,-30]],{seed:129,count:7,radius:18,rise:15,opacity:.12,drift:8});valley.name='forest-mist';group.add(valley);updates.push(t=>valley.userData.tick(t));

  // Thin road-following puddles communicate the exact opt-in grip zone.
  const wet=M(0x446e70,{roughness:.2,metalness:.12,transparent:true,opacity:.29,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  for(let s=0;s<T.TOTAL;s+=13){
    const p=placeOnTrack(T,s);if(wetnessAt(p.x,p.z)<.25||Math.sin(s*.07)<-.35)continue;
    const geo=new THREE.CircleGeometry(1,18),pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const angle=Math.atan2(pos.getY(i),pos.getX(i)),irregular=1+.16*Math.sin(angle*5+s)+.12*Math.cos(angle*3-s);
      const side=pos.getX(i)*(2.8+Math.sin(s)*1.2)*irregular,along=pos.getY(i)*(3.7+2*Math.cos(s*.4))*irregular;
      const q=placeOnTrack(T,s+along,side+Math.sin(s*.1)*2);
      pos.setXYZ(i,q.x,T.surfaceAt(q.x,q.z)+.145,q.z);
    }geo.computeVertexNormals();const patch=mesh(geo,wet);patch.name='wet-road';patch.castShadow=false;group.add(patch);
  }
  group.add(finish(fixed));
  return {group,update:t=>updates.forEach(fn=>fn(t))};
}
