import { THREE,M,box,tube,mesh,put,finish,instances,clear,sign } from './world-kit.js';
import { shippingContainer,transitWarehouse,portBollard } from '/engine/models/props/port-cargo.js';
import { portCrane } from '/engine/models/props/port-crane.js';
import { cargoShip } from '/engine/models/props/cargo-ship.js';
import { fishingBoat,fishCrates,channelBuoy } from '/engine/models/props/coastal.js';
import { navigationBeacon } from '/engine/models/props/navigation-beacon.js';
import { fishAuctionCanopy } from '/engine/models/props/fish-auction-canopy.js';
import { DOCK,PIERS,CRANES } from './puerto-layout.js';
import { portSilos } from '/engine/models/props/port-silos.js';

export function puertoHarbor(T) {
  const group = new THREE.Group(), fixed = new THREE.Group(), live = [], placements = [];
  group.name = 'puerto-harbor';
  const concrete = M(0xbdbba8), edge = M(0xe7d9ad), ink = M(0x415158), yellow = M(0xe4bd55), white = M(0xf3e6bd);
  const top = DOCK.top;
  function quay(x,z,w,d,name) {
    if(name==='container-terminal-deck'){
      // Open the quay slab around the descending approach and tunnel exits.
      for(let px=x-w/2;px<x+w/2;px+=10)for(let pz=z-d/2;pz<z+d/2;pz+=10){
        const cx=px+5,cz=pz+5,s=T.paramOf(cx,cz);
        if(s<T.tunnel.s1+200&&Math.abs(T.offsetOf(cx,cz))<T.HW+12)continue;
        fixed.add(box(10,6,10,concrete,cx,top-3,cz));
      }
    }else{const deck=box(w,6,d,concrete,x,top-3,z);deck.name=name;group.add(deck);}
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
  quay(409.5,238.5,31,437,'eastern-breakwater');quay(202.5,449,445,28,'outer-breakwater');
  // Dense cargo blocks leave broad handling lanes between stacks, with aligned
  // corner castings at every level. Closer walls turn the race into a port canyon.
  const cargo=Array.from({length:6},()=>[]),colors=[0xc9553e,0x398c99,0xdfb647,0x496f8f,0xe2dbbf,0x779465];
  let n=0;
  const stacks=[];
  function stack(x,z,height,rot=Math.PI/2,scale=1.45,wall=false){
    if(!clear(T,x,z,11))return;
    for(let i=0;i<height;i++)cargo[(Math.imul(n+7,13)+i*5+Math.floor(n/5))%6].push({x,z,y:top+i*2.65*scale,rot,scale});
    placements.push({asset:'shipping-container',x,z,y:top,radius:10});
    stacks.push({x,z,height,scale,wall});n++;
  }
  for(const x of [-421,-401,-381,-331,-311,-291,-241,-221,-201])
    for(const z of [95,99.5,104,145,149.5,154,195,199.5,204,245,249.5,254])
      stack(x,z,3+Math.floor(n/3)%3);
  for(const x of [-590,-530])for(const z of [45,65,145,165,185,205])stack(x,z,4+n%2,0,1.5,true);
  for(const z of [90,110,130,150,170,190,210])stack(-121,z,4+n%2,0,1.5,true);
  const cargoDisposers=[];
  cargo.forEach((list,i)=>{const model=shippingContainer({color:colors[i]});cargoDisposers.push(model.userData.dispose);instances(group,model,list,`puerto-containers-${i}`,240);});
  group.userData.dispose=()=>cargoDisposers.forEach(dispose=>dispose?.());
  for(const z of [77,126,176,226,276]){
    fixed.add(box(315,.025,11,M(0x919791),-310,top+.02,z));
    for(let x=-454;x<-165;x+=18)fixed.add(box(7,.03,.18,yellow,x,top+.04,z));
  }
  for(const x of [-456,-355,-265,-175])fixed.add(box(.18,.03,213,white,x,top+.045,178));
  for(const {x,z,scale} of CRANES) {
    const crane=put(group,portCrane(),x,z,top,0,scale);placements.push({asset:'port-crane',x,z,y:top,radius:28});crane.userData.assetId='port-crane';
    for(const dz of [-15.3,15.3])fixed.add(box(90,.08,.2,ink,x,top+.04,z+dz));
  }
  const silos=put(group,portSilos(),-560,105,top,0,1.6);silos.name='puerto-silos';
  const ship=put(group,cargoShip(),-300,406,-2.8*1.75,Math.PI/2,1.75);ship.name='puerto-cargo-ship';
  for(const p of PIERS) {
    put(group,transitWarehouse(),p.x,p.z,top,0,.94);
    for(let z=p.z-p.d/2+12;z<p.z+p.d/2;z+=24)for(const side of [-1,1])put(fixed,portBollard(),p.x+side*(p.w/2-2),z,top);
  }
  // Warehouse row and service lane along the landward side of the terminal.
  for(const x of [-420,-310,-200])if(clear(T,x,42,24))put(group,transitWarehouse(),x,42,top,Math.PI/2,1.1);
  for(const [x,z,rot] of [[82,165,0],[82,194,0],[219,163,0],[219,195,.15]])put(group,fishingBoat({color:colors[n++%6]}),x,z,-.32,rot,1.7);
  put(group,fishAuctionCanopy(),292,43,top,Math.PI,1.5);
  for(const x of [275,287,304])put(group,fishCrates(),x,48,top);
  put(group,navigationBeacon(),-8,449,top,0,1.6);
  for(const [x,z]of[[12,315],[90,310]]) { const buoy=put(group,channelBuoy(),x,z,0);live.push(buoy); }
  // Light towers, mooring bollards and painted cargo lanes.
  for(const [x,z]of[[-428,92],[-428,235],[-86,95],[-86,245]]) {
    fixed.add(tube([x,top,z],[x,29,z],.22,ink),box(8,.4,1,ink,x,29,z));
    for(const dx of [-3,-1,1,3])fixed.add(box(1.2,.5,1.2,white,x+dx,28.6,z));
  }
  for(let x=-600;x<-80;x+=22) {put(fixed,portBollard(),x,360,top);fixed.add(box(.16,.025,20,white,x,top+.025,348));}
  const welcome=sign(['PUERTO','LA GUAIRA'],24,5,{background:'#2b6279'});welcome.position.set(-422,14,50);welcome.rotation.y=Math.PI/2;group.add(welcome);
  group.add(finish(fixed,400));group.userData.placements=placements;
  group.userData.containerCount=cargo.reduce((sum,list)=>sum+list.length,0);group.userData.stacks=stacks;
  group.userData.siloPassage={x:-560,z:105,width:2*T.HW+4,clearance:12.5};
  return {group,update:t=>live.forEach(o=>o.userData.tick?.(t))};
}
