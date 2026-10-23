import { meadow } from './festive.js';
import { THREE, terrain, put, foundation, finish, instances, scatter, clear } from './world-kit.js';
import { waterGrid } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { crossing } from './country-details.js';
import { baseHeight, riverAt, VILLAGE, LAGOON, lagoonR } from './delta-layout.js';
import { fishermen, boatLoop } from './lagoon-life.js';
import { palafitoHouse, landingShelter } from '/engine/models/props/delta.js';
import { wetlandLanding, riverCanoe } from '/engine/models/props/llano-life.js';
import { fishingBoat, fishCrates, fishingNetRack, channelBuoy } from '/engine/models/props/coastal.js';
import { fishAuctionCanopy } from '/engine/models/props/fish-auction-canopy.js';
import { mangrove } from '/engine/models/vegetation/mangrove.js';
import { reeds } from '/engine/models/vegetation/reeds.js';
import { palm } from '/engine/models/vegetation/palm.js';
export function deltaWorld(T) {
  // Under the laguna the road is gone (course-rules.js floats the boats).
  T.gaps=wetRuns(T);
  const group=new THREE.Group(),world=terrain(T,{bounds:[-510,-460,510,460],base:baseHeight,step:5,
    cut:(x,z,h)=>riverAt(x,z).distance<24?Math.min(h,-3.5):h,
    color:(x,z,y)=>y<.5?0x5f9e62:meadow(x,z,0x78b852)});
  group.add(world.land,waterGrid(T,world,{bounds:[-510,-460,510,460],sample:(x,z)=>({...riverAt(x,z),height:0}),color:0x4e9d95,name:'delta-channels'}));
  group.add(crossing(T,p=>riverAt(p.x,p.z).distance<45&&lagoonR(p.x,p.z)>1.3,{name:'delta-timber-causeways',wood:true,color:0x9d8261}));
  // The laguna: two boats of chigüires fishing off the line, and two curiaras
  // going round the islets.
  group.add(fishermen(T,[[70,248,.7],[-40,262,-1]]),boatLoop(T,[[100,275],[40,302],[-35,290],[-70,250],[-55,212],[10,195],[80,210],[125,250]],{count:2,speed:10}));
  const village=new THREE.Group(),occupied=[],assetCounts={palafitoHouse:0,landingShelter:0};
  const colors=[0xc58357,0x689e98,0xcfb570,0x7e9a73];
  for(const [i,[x,z,h]]of VILLAGE.entries()){
    if(!clear(T,x,z,13))continue;
    put(village,palafitoHouse({variant:i,color:colors[i%4]}),x,z,0,h);
    assetCounts.palafitoHouse++;
    const dock=wetlandLanding({length:12});put(village,dock,x+Math.sin(h)*12,z+Math.cos(h)*12,1.4,h);
    put(village,fishCrates(),x+3,z+3,3.4,h);occupied.push([x,z,22]);
  }
  for(const [x,z,h]of [[-105,45,.4],[125,-115,-.6],[-210,-145,0]])if(clear(T,x,z,11)){
    put(village,landingShelter({width:8,depth:7,deck:3.1}),x,z,0,h);
    assetCounts.landingShelter++;
    put(village,fishingNetRack(),x+7,z,world.groundAt(x+7,z),h);occupied.push([x,z,15]);
  }
  for(const [i,x,z]of [[0,0,-105],[1,50,50],[2,-120,35],[3,170,-55]]){
    if(!clear(T,x,z,5)||world.groundAt(x,z)>-.7)continue;
    put(village,i%2?fishingBoat():riverCanoe(),x,z,-.18,i*.6);
    put(village,channelBuoy(),x+6,z+4,-.2);
  }
  const auction=foundation(group,fishAuctionCanopy(),-155,135,world.groundAt,{rotation:-0.4,scale:1.25,radius:7,color:0x8a795d});
  auction.userData.footprintRadius=7;auction.userData.support='delta-landing';occupied.push([-155,135,18]);
  group.add(finish(village));
  const plantsOk=(x,z)=>!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
  instances(group,mangrove({seed:5}),scatter(T,world.groundAt,{seed:571,count:90,bounds:[-430,-390,430,390],minY:-.6,margin:8,
    accept:(x,z)=>plantsOk(x,z)&&riverAt(x,z).distance>31&&riverAt(x,z).distance<62}),'delta-mangles',190);
  instances(group,reeds({seed:7}),scatter(T,world.groundAt,{seed:572,count:85,bounds:[-430,-390,430,390],minY:-.5,margin:4,
    accept:(x,z)=>plantsOk(x,z)&&riverAt(x,z).distance>25&&riverAt(x,z).distance<40}),'delta-reeds',190);
  // Three mangroves on each of the laguna's islets (the shore already has
  // the caño's); placed by hand, the islets are too small to scatter onto.
  instances(group,mangrove({seed:9}),LAGOON.islets.flatMap(([ix,iz,r],k)=>[0,1,2].map(j=>{
    const a=j*2.1+k,x=ix+Math.cos(a)*r*.35,z=iz+Math.sin(a)*r*.35;
    return {x,z,y:world.groundAt(x,z),rot:a*1.7,scale:.9+.1*j};
  })),'delta-laguna-mangles',190);
  instances(group,palm({seed:6,h:9}),scatter(T,world.groundAt,{seed:573,count:45,bounds:[-430,-390,430,390],margin:9,
    accept:(x,z)=>plantsOk(x,z)&&riverAt(x,z).distance>65}),'delta-island-palms',190);
  group.userData.assetCounts=assetCounts;
  return {group,groundAt:world.groundAt,update:waterAnimator(group)};
}

// Stretches of route at the laguna's waterline or under it: no road drawn.
function wetRuns(T){
  const runs=[];let from=null;
  for(let s=0;s<=T.TOTAL;s+=2){
    const wet=s<T.TOTAL&&T.heightAtS(s)<.2;
    if(wet&&from==null)from=s;
    if(!wet&&from!=null){runs.push({s0:from,len:s-from});from=null;}
  }
  return runs;
}
