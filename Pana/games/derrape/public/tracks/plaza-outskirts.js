import {THREE,instances,finish,pathDistance,clear,put,placeOnTrack} from './world-kit.js';
import {landPatch,landPath,grove} from './landscape-kit.js';
import {ceiba} from '/engine/models/vegetation/ceiba.js';
import {palm} from '/engine/models/vegetation/palm.js';
import {bench} from '/engine/models/props/plaza.js';
import {BLOCKS,streetDistance} from './plaza-layout.js';

// A ring of residential lanes connects the arterial roads before the landscape
// becomes countryside. The town no longer stops at a cut-off road on a rectangle.
export function plazaOutskirts(T,groundAt,building,occupied) {
  const group=new THREE.Group(),fixed=new THREE.Group();group.name='plaza-neighborhoods-and-gardens';
  const lanes=[
    [[-590,-200],[-590,-360],[-540,-420],[-300,-420],[0,-420],[195,-420],[470,-420],[660,-420],[710,-360],[710,-200],[710,60],[650,190],[540,220],[405,220]],
    [[-590,-200],[-590,60],[-590,320],[-550,480],[-300,480],[0,480],[155,480],[195,430],[195,325]],
  ];
  for(const points of lanes)fixed.add(landPath(T,groundAt,points,{width:19.2,color:0x8b958c,step:3,raise:.23}));
  const distances=lanes.map(points=>pathDistance(new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))).getSpacedPoints(180).map(p=>[p.x,p.z])));
  const laneDistance=(x,z)=>Math.min(...distances.map(distance=>distance(x,z)));
  let houses=0;
  const home=(x,z,turn,seed)=>{if(laneDistance(x,z)<22)return;const before=occupied.length;building(x,z,turn,seed,.92);houses+=occupied.length-before;};
  for(const [i,x]of [-470,-440,-350,-230,-120,-30,50,330,360,460,490,595,625].entries()){
    home(x,-451,0,300+i);home(x,-389,Math.PI,320+i);
  }
  for(const [i,z]of [-285,-255,-125,-95,130,230,325].entries()){
    home(-621,z,Math.PI/2,350+i);home(-559,z,-Math.PI/2,370+i);
  }
  for(const [i,x]of [-470,-440,-320,-250,-160,-120,-30,45].entries()){
    home(x,449,Math.PI,400+i);home(x,511,0,420+i);
  }
  // Private courtyards are planted, with a narrow route through each garden.
  let gardens=0;
  for(const b of BLOCKS.filter(b=>b.kind==='homes')){
    const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,rx=(b.x1-b.x0)/2-36,rz=(b.z1-b.z0)/2-34;
    if(rx<8||rz<8)continue;
    fixed.add(landPatch(T,groundAt,{x,z,rx,rz,color:gardens%2?0x779d65:0x83a86b,rect:true,step:2,raise:.54}));
    fixed.add(landPath(T,groundAt,[[x-rx,z+rz*.45],[x,z],[x+rx,z-rz*.45]],{width:2.4,raise:.59}));
    if(clear(T,x+6,z+5,3))put(fixed,bench(),x+6,z+5,groundAt(x+6,z+5)+.57,.5,1.4);
    gardens++;
  }
  const centers=[[-445,-320,90,50,15],[-450,80,55,100,16],[-400,360,110,35,18],[-185,-530,170,65,22],
    [420,-550,180,65,24],[590,-265,55,95,18],[605,125,65,50,17],[115,365,45,40,10],[-450,-580,160,50,16]];
  const acceptable=(x,z)=>streetDistance(x,z)>23&&laneDistance(x,z)>22&&!occupied.some(p=>Math.hypot(x-p.x,z-p.z)<16)&&!(x>265&&z>275);
  for(const [i,[x,z,rx,rz]]of centers.entries())fixed.add(landPatch(T,groundAt,{x,z,rx,rz,color:i%2?0x819e6c:0x779164,seed:i,step:5}));
  const trees=grove(T,groundAt,centers,{seed:431,scale:2.2,accept:acceptable,margin:12,minY:-.4});
  instances(group,ceiba({seed:6,detail:'distant'}),trees,'plaza-outer-groves',250);
  const palms=grove(T,groundAt,[[620,245,55,24,15],[239,355,14,80,8]],{seed:57,scale:1.35,margin:10,minY:-.4,accept:acceptable});
  let promenadePalms=0;
  // The rising eastern bridge approach has a narrow dry embankment. Plant its
  // shoulders explicitly; broad-area scatter would miss this entire sight line.
  for(let u=.39;u<.55;u+=.01)for(const side of [-1,1]){
    const p=placeOnTrack(T,u*T.TOTAL,side*23),y=groundAt(p.x,p.z);
    if(y<.4||!clear(T,p.x,p.z,6))continue;
    palms.push({x:p.x,z:p.z,y,rot:u*40,scale:1.2});promenadePalms++;
  }
  instances(group,palm({seed:7,h:11}),palms,'plaza-coastal-palms',250);
  group.add(finish(fixed,250));
  group.userData.surroundings={houses,gardens,trees:trees.length+palms.length,promenadePalms,connectedLanes:lanes.length};
  return group;
}
