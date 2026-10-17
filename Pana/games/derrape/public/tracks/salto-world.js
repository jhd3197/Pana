import { THREE, M, box, terrain, stream, put, finish, instances, scatter, clear } from './world-kit.js';
import { waterGrid, hollowGallery } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { crossing } from './country-details.js';
import { baseHeight, riverAt, GALLERY } from './salto-layout.js';
import { waterfall } from '/engine/models/effects/waterfall.js';
import { rockyCliff, mountainTent } from '/engine/models/props/mountain.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { fern } from '/engine/models/vegetation/fern.js';
import { monstera } from '/engine/models/vegetation/monstera.js';
import { getSettings } from '/engine/settings.js';
export function saltoWorld(T) {
  const group=new THREE.Group(),world=terrain(T,{bounds:[-540,-520,540,560],base:baseHeight,step:5,
    cut:(x,z,h)=>{const r=riverAt(x,z);return r.distance<18?Math.min(h,r.height-4):h;},
    color:(x,z,y)=>y>70?0x7e8d6b:y<10?0x768577:0x66835c});
  group.add(world.land,waterGrid(T,world,{bounds:[-130,-100,220,560],sample:(x,z)=>({...riverAt(x,z),visible:riverAt(x,z).distance<43}),name:'salto-outlet'}));
  group.add(crossing(T,p=>riverAt(p.x,p.z).distance<42,{name:'salto-outlet-bridge',color:0xa99576}));
  group.add(hollowGallery(T,{...GALLERY,openSide:-1,width:27,height:34,name:'salto-gallery'}));
  const geology=new THREE.Group();
  // The high source terrace is a roof above the open gallery, never a ground
  // query. Its river flows over the lip into the same downstream pool/outlet.
  geology.add(box(190,8,135,M(0x747f69),0,142,-67.5));
  for(const [x,z,w]of [[-48,-112,75],[40,-112,75],[-120,0,65],[120,0,65]]){
    if(!clear(T,x,z,w*.45))continue;
    const cliff=rockyCliff({width:10,height:12,depth:5,seed:56+x});
    cliff.scale.set(w/10,10,7);cliff.position.set(x,24,z);geology.add(cliff);
  }
  group.add(finish(geology));
  const source=stream([[0,-125],[0,-65],[0,0]],120,(x,z)=>146-z*.012,0x65ada4);
  source.name='salto-source';
  const depths=source.geometry.attributes.waterDepth;for(let i=0;i<depths.count;i++)depths.setX(i,1.1);
  group.add(source);
  const fall=waterfall({width:120,height:139,seed:56});fall.position.set(0,7,0);group.add(fall);
  const vegetationOk=(x,z)=>riverAt(x,z).distance>40&&!(Math.abs(x)<145&&z>-155&&z<45);
  instances(group,ceiba({seed:56,detail:'distant'}),scatter(T,world.groundAt,{seed:561,count:190,bounds:[-500,-450,500,420],margin:10,accept:vegetationOk}),'salto-canopy',110);
  instances(group,palm({seed:5,h:10}),scatter(T,world.groundAt,{seed:562,count:55,bounds:[-420,-340,420,400],margin:9,accept:vegetationOk}),'salto-palms',110);
  instances(group,fern({seed:4}),scatter(T,world.groundAt,{seed:563,count:110,bounds:[-420,-360,420,400],margin:5,accept:vegetationOk}),'salto-ferns',110);
  instances(group,monstera({seed:9}),scatter(T,world.groundAt,{seed:564,count:65,bounds:[-420,-360,420,400],margin:6,accept:vegetationOk}),'salto-understory',110);
  const camp=new THREE.Group();
  for(const [i,x,z]of [[0,-220,-300],[1,-198,-294],[2,-175,-288]])if(clear(T,x,z,8))put(camp,mountainTent({color:i%2?0xc99b55:0xa2654c}),x,z,world.groundAt(x,z),-.3);
  group.add(finish(camp));
  group.userData.assetCounts={waterfall:1,rockyCliff:geology.children.length-1,mountainTent:camp.children.length};
  const animate=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:t=>{animate(t);fall.userData.setReduced(getSettings().quality==='baja');fall.userData.tick(t);}};
}
