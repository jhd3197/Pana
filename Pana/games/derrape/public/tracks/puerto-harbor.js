import { THREE,M,box,tube,mesh,put,finish,instances,clear,sign } from './world-kit.js';
import { shippingContainer,transitWarehouse,portBollard } from '/engine/models/props/port-cargo.js';
import { portCrane } from '/engine/models/props/port-crane.js';
import { cargoShip } from '/engine/models/props/cargo-ship.js';
import { fishingBoat,fishCrates,channelBuoy } from '/engine/models/props/coastal.js';
import { navigationBeacon } from '/engine/models/props/navigation-beacon.js';
import { fishAuctionCanopy } from '/engine/models/props/fish-auction-canopy.js';
import { DOCK,PIERS } from './puerto-layout.js';

export function puertoHarbor(T) {
  const group = new THREE.Group(), fixed = new THREE.Group(), live = [], placements = [];
  group.name = 'puerto-harbor';
  const concrete = M(0xbdbba8), edge = M(0xe7d9ad), ink = M(0x415158), yellow = M(0xe4bd55), white = M(0xf3e6bd);
  const top = DOCK.top;
  function quay(x,z,w,d,name) {
    const deck = box(w,6,d,concrete,x,top-3,z); deck.name = name; group.add(deck);
    // Edging stays outside the racing road, including rounded terminal corners.
    for(const side of [-1,1]) for(let a=-w/2+3;a<w/2;a+=6) {
      const px=x+a,pz=z+side*d/2;if(!clear(T,px,pz,1))continue;
      fixed.add(box(5.8,.3,.7,Math.round(a/6)%2?yellow:ink,px,top+.15,pz));
      if(Math.round(a/6)%3===0) { const tire=mesh(new THREE.TorusGeometry(.8,.25,6,12),ink,px,2.3,pz+side*.4); fixed.add(tire); }
    }
    for(const side of [-1,1]) for(let a=-d/2+3;a<d/2;a+=6) {
      const px=x+side*w/2,pz=z+a;if(!clear(T,px,pz,1))continue;
      fixed.add(box(.7,.3,5.8,Math.round(a/6)%2?yellow:ink,px,top+.15,pz));
    }
  }
  quay((DOCK.x0+DOCK.x1)/2,(DOCK.z0+DOCK.z1)/2,DOCK.x1-DOCK.x0,DOCK.z1-DOCK.z0,'container-terminal-deck');
  for(const p of PIERS)quay(p.x,p.z,p.w,p.d,'finger-pier');
  quay(409.5,213.5,31,387,'eastern-breakwater');quay(236.5,399,377,28,'outer-breakwater');
  // Repeated containers use six prototypes and spatial instances, never hundreds of independent draws.
  const cargo = Array.from({length:6},()=>[]), colors=[0xc9553e,0x398c99,0xdfb647,0x496f8f,0xe2dbbf,0x779465];
  let n=0;
  for(const x of [-326,-306,-286,-266,-246,-226,-206,-186])for(const row of [97,126,155,184,213])for(const lane of [-1,0,1]) {
    const z=row+lane*3.1;
    if(!clear(T,x,z,12))continue;
    const height=1+(n%3);
    for(let i=0;i<height;i++) cargo[(n+i)%6].push({x,z,y:top+i*2.65,rot:Math.PI/2,scale:1});
    placements.push({asset:'shipping-container',x,z,y:top,radius:7});n++;
    if(lane===-1)fixed.add(box(18,.035,.16,yellow,x,top+.025,z-2));
  }
  cargo.forEach((list,i)=>instances(group,shippingContainer({color:colors[i]}),list,`puerto-containers-${i}`,150));
  for(const [x,z] of [[-360,312],[-250,312],[-140,312]]) {
    const crane=put(group,portCrane(),x,z,top);placements.push({asset:'port-crane',x,z,y:top,radius:17});crane.userData.assetId='port-crane';
    for(const dx of [-13,13])fixed.add(box(.2,.08,44,ink,x+dx,top+.04,z-4));
  }
  const ship=put(group,cargoShip(),-252,363,-2.8*1.35,Math.PI/2,1.35);ship.name='puerto-cargo-ship';
  for(const p of PIERS) {
    put(group,transitWarehouse(),p.x,p.z,top,0,.94);
    for(let z=p.z-p.d/2+12;z<p.z+p.d/2;z+=24)for(const side of [-1,1])put(fixed,portBollard(),p.x+side*(p.w/2-2),z,top);
  }
  // Warehouse row and service lane along the landward side of the terminal.
  for(const x of [-420,-310,-200])if(clear(T,x,42,24))put(group,transitWarehouse(),x,42,top,Math.PI/2,1.1);
  for(const [x,z,rot] of [[82,165,0],[82,194,0],[219,163,0],[219,195,.15]])put(group,fishingBoat({color:colors[n++%6]}),x,z,-.32,rot,1.7);
  put(group,fishAuctionCanopy(),292,43,top,Math.PI,1.5);
  for(const x of [275,287,304])put(group,fishCrates(),x,48,top);
  put(group,navigationBeacon(),58,399,top,0,1.6);
  for(const [x,z]of[[12,315],[90,310]]) { const buoy=put(group,channelBuoy(),x,z,0);live.push(buoy); }
  // Light towers, mooring bollards and painted cargo lanes.
  for(const [x,z]of[[-428,92],[-428,235],[-86,95],[-86,245]]) {
    fixed.add(tube([x,top,z],[x,29,z],.22,ink),box(8,.4,1,ink,x,29,z));
    for(const dx of [-3,-1,1,3])fixed.add(box(1.2,.5,1.2,white,x+dx,28.6,z));
  }
  for(let x=-420;x<-80;x+=22) {put(fixed,portBollard(),x,330,top);fixed.add(box(.16,.025,30,white,x,top+.025,300));}
  const welcome=sign(['PUERTO','LA GUAIRA'],24,5,{background:'#2b6279'});welcome.position.set(-422,14,50);welcome.rotation.y=Math.PI/2;group.add(welcome);
  group.add(finish(fixed));group.userData.placements=placements;
  group.userData.containerCount=cargo.reduce((sum,list)=>sum+list.length,0);
  return {group,update:t=>live.forEach(o=>o.userData.tick?.(t))};
}
