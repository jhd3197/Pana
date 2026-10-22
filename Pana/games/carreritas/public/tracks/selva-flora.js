// Game-local planting composition. Every shape comes from the Studio library.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import * as flora from '/engine/models/vegetation/index.js';
import { bake } from '/engine/models/core/static-batch.js';
import { placeOnTrack } from '../track-kit.js';
import { RIVER_SAMPLES, riverDistance, TUNNEL, tunnelContains, jaguarCaveContains, legacyU as L } from './selva-layout.js';
import { tunnelRoofHeight } from './selva-temple.js';

const TAU=Math.PI*2;
export const JUNGLE_ADDITIONS=['araguaney','bamboo','fern','monstera','heliconia','cactus',
  'mangrove','papaya','agave','waterLily','hibiscus','reeds','jungleGiant','tropicalBush',
  'yagrumo','zancona','manaca','treeFern','cacao'];

export function jungleFlora(T,groundAt,reservations) {
  const r=rng(5721),source=new THREE.Group(),placements=[],templates=new Map();
  for(const kind of ['ceiba','palm','banana','bush',...JUNGLE_ADDITIONS]) {
    templates.set(kind,Array.from({length:kind==='ceiba'?3:2},(_,i)=>{
      // the canopy ceibas stay narrow-crowned so the valley keeps its density
      const root=flora[kind]({seed:17+i*19,h:9+i*2,...kind==='ceiba'?{scale:0.5}:{}}),bounds=new THREE.Box3().setFromObject(root);
      const radius=Math.hypot(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z)));
      return {root,radius};
    }));
  }
  function add(kind,x,z,scale,zone,{water=false,roof=false,y}={}) {
    const variants=templates.get(kind),template=variants[Math.floor(r()*variants.length)],radius=template.radius*scale;
    if(!roof) {
      if(Math.abs(T.offsetOf(x,z))<T.HW+radius+1.6||tunnelContains(T,x,z,radius+6)||jaguarCaveContains(T,x,z,radius+8))return false;
      if(reservations.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+radius))return false;
      if(!water&&riverDistance(x,z)<12+radius)return false;
    }
    const object=template.root.clone(true),height=y??groundAt(x,z)-0.12;
    object.position.set(x,height,z);object.scale.setScalar(scale);object.rotation.y=r()*TAU;
    source.add(object);placements.push({kind,zone,x,z,y:height,scale,radius});return true;
  }
  // A continuous tall canopy across the valley, with a few gold crowns on sunny slopes.
  for(let z=-320;z<=560;z+=28)for(let x=-255;x<=520;x+=28) {
    const px=x+(r()-0.5)*17,pz=z+(r()-0.5)*17;
    // The original valley keeps its dense canopy; the northern hills are sparser.
    if(r()<(z>125||x>390?0.86:0.09))continue;
    const golden=(px>275||pz>45)&&r()<0.13;
    const giant=!golden&&r()<.05;
    add(golden?'araguaney':giant?'jungleGiant':'ceiba',px,pz,golden?2.1+r()*0.6:giant?1:1.9+r()*1.1,'canopy');
  }
  // Broken, overlapping patches read as understory, not evenly spaced roadside props.
  // Taller bamboo occupies the cool western half; flowering plants mark clearings.
  for(let s=5;s<T.TOTAL;s+=17)for(const side of [-1,1]) {
    const u=s/T.TOTAL,shaded=u>L(0.57)&&u<L(0.92);
    // The new northern climb, plateau and ledge get a lighter understory.
    if(u<L(0)&&r()<0.45)continue;
    const kinds=shaded?['fern','monstera','bamboo','tropicalBush']:['heliconia','monstera','fern','hibiscus'];
    const kind=kinds[Math.floor(r()*kinds.length)],p=placeOnTrack(T,s,side*(T.HW+6+r()*6));
    const scale=kind==='bamboo'?1.3+r()*0.35:kind==='fern'?1.6+r()*0.6:1.25+r()*0.55;
    if(!add(kind,p.x,p.z,scale,shaded?'understory':'flowering-edge'))continue;
    const companion=kind==='bamboo'?'fern':kind==='fern'?'monstera':'fern';
    add(companion,p.x+side*(3+r()*3),p.z+(r()-0.5)*7,1.25+r()*0.5,'understory');
  }
  // Small palm, fruit and banana groves fill openings behind the low forest edge.
  for(let i=0;i<70;i++) {
    const s=r()*T.TOTAL,p=placeOnTrack(T,s,(r()<0.5?-1:1)*(23+r()*24));
    const kind=['palm','papaya','banana','bush','papaya'][i%5];
    add(kind,p.x,p.z,kind==='papaya'?1.5+r()*0.5:1.2+r()*0.6,'grove');
  }
  // Plant along the river's own centerline, not along the racing loop. The lilies
  // use the actual water height, while stilt roots and reed stems start in the bed.
  for(let i=8;i<RIVER_SAMPLES.length-9;i+=5) {
    const p=RIVER_SAMPLES[i],next=RIVER_SAMPLES[i+1],dx=next.x-p.x,dz=next.z-p.z,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
    for(const side of [-1,1]) {
      const offset=side*(8.7+r()*1.4),x=p.x+nx*offset,z=p.z+nz*offset;
      add(i%3?'reeds':'mangrove',x,z,i%3?1.45+r()*0.2:1.5+r()*0.4,'riverbank',{water:true});
      if(i%2===0)add('waterLily',p.x+nx*side*(4+r()),p.z+nz*side*(4+r()),1.3+r()*0.2,'water',{water:true,y:0.3});
    }
  }
  // Authored groves make each section recognizable from the car, including a
  // bamboo gateway after the waterfall and sunny fruit/flower clearings.
  for(const [u,side,kind,count,scale] of [[L(0.84),-1,'bamboo',8,1.65],[L(0.68),1,'bamboo',7,1.5],
    [L(0.16),1,'papaya',5,1.7],[L(0.19),-1,'araguaney',4,1.7],[L(0.32),1,'hibiscus',7,1.6],
    [0.012,1,'heliconia',6,1.65],[L(0.88),1,'monstera',6,1.65],
    [0.2,1,'heliconia',8,1.7],[0.25,-1,'hibiscus',8,1.6],[0.29,1,'araguaney',4,1.8],[0.52,-1,'papaya',5,1.6]]) {
    for(let i=0;i<count;i++) {
      const p=placeOnTrack(T,(u*T.TOTAL)+(i-count/2)*4.3,side*(19+(i%3)*4.5));
      add(kind,p.x,p.z,scale*(0.88+r()*0.24),'landmark-grove');
    }
  }
  // Succulents belong to the exposed rocky shoulder of the eastern ruins.
  for(let i=0;i<17;i++) {
    const p=placeOnTrack(T,L(0.33+i*0.004)*T.TOTAL,25+r()*12);
    add(i%4?'agave':'cactus',p.x,p.z,i%4?1.1+r()*0.35:1.35+r()*0.25,'dry-ruins');
  }
  // Roof foliage samples the shell rather than the excavated driving surface.
  for(let s=TUNNEL.from*T.TOTAL+12;s<TUNNEL.to*T.TOTAL-8;s+=12)for(const side of [-1,1]) {
    const offset=side*(18+r()*4),p=placeOnTrack(T,s,offset),y=T.heightAtS(s)+tunnelRoofHeight(offset)-0.25;
    add(side===1?'bamboo':'monstera',p.x,p.z,side===1?1.3:2.2,'roof',{roof:true,y});
    add('fern',p.x+side*2,p.z,1.8,'roof',{roof:true,y:y-0.6});
  }
  // Understorey trees: cacao and tree ferns in the shade, yagrumos in the
  // clearings, stilt and clump palms along the forest edge.
  for(let i=0;i<36;i++) {
    const s=r()*T.TOTAL,p=placeOnTrack(T,s,(r()<0.5?-1:1)*(20+r()*26));
    const kind=['cacao','treeFern','yagrumo','zancona','manaca','cacao'][i%6];
    add(kind,p.x,p.z,0.9+r()*0.35,'understorey-trees');
  }
  // Merge into spatial material batches; release all temporary/template geometry.
  const group=bake(source,{cellSize:140}),owned=new Set();
  for(const variants of templates.values())for(const {root} of variants)root.traverse(o=>{if(o.geometry)owned.add(o.geometry);});
  owned.forEach(g=>g.dispose());group.name='selva-forest';
  return {group,placements};
}
