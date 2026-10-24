import {THREE,instances,finish,clear,put} from './world-kit.js';
import { farGrove } from './far-grove.js';
import {landPatch,landPath,grove} from './landscape-kit.js';
import {ceiba} from '/engine/models/vegetation/ceiba.js';
import {palm} from '/engine/models/vegetation/palm.js';
import {reeds} from '/engine/models/vegetation/reeds.js';
import {ranchFence,hayBale,corralGate} from '/engine/models/props/ranch.js';
import {riverDistance,wetlandDistance,RIVER,WATER_Y} from './llanos-layout.js';

export function llanosLandscape(T,world,occupied) {
  const group=new THREE.Group(),fixed=new THREE.Group(),fences=[],hay=[];group.name='llanos-pastures-and-tree-lines';
  const groundAt=world.groundAt,dry=(x,z)=>riverDistance(x,z)>35&&wetlandDistance(x,z)>1.35;let gates=0;
  const free=(x,z)=>!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+8);
  const fields=[[-535,-390,-365,-95],[-505,235,-240,415],[355,-410,550,-265],[-135,75,-55,145]];
  for(const [i,[x0,z0,x1,z1]]of fields.entries()){
    fixed.add(landPatch(T,groundAt,{x:(x0+x1)/2,z:(z0+z1)/2,rx:(x1-x0)/2,rz:(z1-z0)/2,color:[0x8e994f,0xa2a55e,0xa69c57,0x7e944e][i],rect:true,step:5}));
    for(let x=x0+6;x<x1;x+=12)for(const z of [z0,z1])if(clear(T,x,z,8)&&dry(x,z))fences.push({x,z,y:groundAt(x,z),rot:0});
    for(let z=z0+6;z<z1;z+=12)for(const x of [x0,x1]){
      if(Math.abs(z-(z0+z1)/2)<13)continue;
      if(clear(T,x,z,8)&&dry(x,z))fences.push({x,z,y:groundAt(x,z),rot:Math.PI/2});
    }
    const gz=(z0+z1)/2;
    if(clear(T,x1,gz,10)&&dry(x1,gz)){put(fixed,corralGate({span:18,open:.6}),x1,gz,groundAt(x1,gz),Math.PI/2);gates++;}
    if(i<3)for(let row=0;row<6;row++){
      const z=z0+22+row*(z1-z0-44)/5;
      fixed.add(landPath(T,groundAt,[[x0+18,z],[x1-18,z+7]],{width:1.5,color:0xb5aa6b,raise:.12}));
      const x=x0+35+(row%3)*28;
      if(clear(T,x,z,3)&&dry(x,z))hay.push({x,z,y:groundAt(x,z),rot:row*.9,scale:1.8});
    }
  }
  for(const points of [[[-420,220],[-350,150],[-285,137]],[[-360,-85],[-300,-110],[-215,-132]],[[350,-260],[295,-245],[270,-230]]]){
    fixed.add(landPath(T,groundAt,points,{width:5,color:0xb6a06b}));
  }
  const centers=[[-445,-45,45,150,24],[-260,-355,150,40,26],[-470,190,50,70,18],[-150,330,160,45,28],
    [415,90,65,170,30],[390,-375,160,40,24],[245,350,100,70,20],[-90,-70,55,35,8],
    [-40,-465,185,30,30],[560,-230,30,180,24]];
  for(const [i,[x,z,rx,rz]]of centers.entries())fixed.add(landPatch(T,groundAt,{x,z,rx,rz,color:0x7d9253,seed:i,step:5}));
  const trees=grove(T,groundAt,centers,{seed:612,scale:1.8,margin:13,accept:(x,z)=>dry(x,z)&&free(x,z)});
  farGrove(T,group,()=>ceiba({seed:2,detail:'distant'}),trees,'llanos-gallery-woodland',260);
  const palms=[],banks=[];
  // Follow the river, rather than scattering isolated palms across the prairie.
  for(let i=1;i<RIVER.length-1;i++){
    const [cx,cz]=RIVER[i];
    for(const side of [-1,1])for(let j=0;j<5;j++){
      const x=cx+side*(32+j%2*12),z=cz-30+j*15,y=groundAt(x,z);
      if(y>WATER_Y+.25&&clear(T,x,z,9)&&free(x,z))palms.push({x,z,y,rot:i+j,scale:1.1+j%3*.18});
      const bx=cx+side*(18+j%2*4),by=groundAt(bx,z);
      if(by>-.5&&by<3&&clear(T,bx,z,4))banks.push({x:bx,z,y:by,rot:i+j,scale:2});
    }
  }
  farGrove(T,group,()=>palm({seed:13,h:12}),palms,'llanos-river-morichal',240);
  instances(group,reeds({seed:8}),banks,'llanos-riverbank-reeds',240);
  instances(group,ranchFence({span:11.9}),fences,'llanos-pasture-boundaries',220);
  instances(group,hayBale(),hay,'llanos-harvest-bales',220);
  group.add(finish(fixed,220));group.userData.surroundings={pastures:fields.length,fences:fences.length,trees:trees.length+palms.length,riverbankClumps:banks.length};
  group.userData.assetCounts={'ranch-fence':fences.length,'corral-gate':gates,'hay-bale':hay.length};
  return group;
}
