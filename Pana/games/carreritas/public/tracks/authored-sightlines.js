import { THREE, M, box, clear, finish } from './world-kit.js';
import { SIGHTLINE_SITES } from './sightline-sites.js';
import { streetDistance, STREET_HALF } from './plaza-layout.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { mountainPine } from '/engine/models/vegetation/mountain-pine.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { frailejon } from '/engine/models/vegetation/frailejon.js';
import { trinitaria } from '/engine/models/vegetation/trinitaria.js';
import { hibiscus } from '/engine/models/vegetation/hibiscus.js';
import { beachShade, beachHut, driftwood } from '/engine/models/props/beach.js';
import { fishingBoat, fishingNetRack } from '/engine/models/props/coastal.js';
import { rockyCliff } from '/engine/models/props/mountain.js';

// Roadside variants retain the library silhouettes. Individual flower petals
// and branches hidden inside opaque pine tiers cannot be read at race speed.
// Only these fresh instances are reduced; shared model factories stay intact.
function roadsidePine(seed,h) {
  const model=mountainPine({seed,h}),remove=[];
  model.traverse(o=>{if(o.isMesh&&o.material.color?.getHex()===0x79624b)remove.push(o);});
  for(const o of remove){o.removeFromParent();o.geometry.dispose();}
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.045,.27,h,8),M(0x79624b));
  trunk.position.y=h/2;trunk.castShadow=true;trunk.receiveShadow=true;model.add(trunk);
  return model;
}
function roadsideFrailejon(seed,h) {
  const model=frailejon({seed,h}),remove=[];
  model.traverse(o=>{
    if(o.isMesh&&o.material.color?.getHex()===0xe6ba42)remove.push(o);
    // The retained centres become the small yellow flower silhouettes.
    if(o.isMesh&&o.material.color?.getHex()===0x846738)o.material=M(0xe6ba42);
  });
  for(const o of remove){o.removeFromParent();o.geometry.dispose();}
  return model;
}

// Explicit opt-in keeps these authored places out of other circuits and games.
export function withSightlines(def) {
  return { ...def, scenery(group, kit, T) {
    def.scenery?.(group, kit, T);
    group.add(authoredSightlines(T));
  } };
}

function authoredSightlines(T) {
  const source=new THREE.Group(), records=[], occupied=[], colliders=[];
  const environment=T.group.getObjectByName('track-environment');
  const town=environment?.userData.town;
  for(const b of town?.buildings||[])occupied.push({x:b.x,z:b.z,r:Math.hypot(b.width,b.depth)/2,w:b.width,d:b.depth,turn:b.turn});
  for(const p of environment?.userData.jungle?.colliders||[])occupied.push({x:p.x,z:p.z,r:p.radius});
  T.group.updateMatrixWorld(true);
  environment?.traverse(o=>{
    if(!o.userData.footprintRadius)return;
    const p=o.getWorldPosition(new THREE.Vector3());
    occupied.push({x:p.x,z:p.z,r:o.userData.footprintRadius});
  });
  for(const [index,site] of SIGHTLINE_SITES.filter(s=>s.track===T.id).entries()) {
    const record={id:site.id,u:site.u,placements:[]};records.push(record);
    const seed=1800+index*31;
    // Asset extents are measured, not guessed: leafy crowns also stay outside
    // the driving corridor. Footprint overlap checks use ground-level radii.
    function put(factory,ds,off,scale=1,turn=0,solid=true) {
      const model=factory(), bounds=new THREE.Box3().setFromObject(model);
      const radius=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.z),Math.abs(bounds.max.z))*scale;
      const foot=Math.min(radius,solid?radius:1.2);
      let spot;
      // Small deterministic shifts find actual planting pockets between
      // buildings, without silently dropping an entire authored site.
      for(const shift of [0,4,-4,8,-8,12]) {
        const s=site.u*T.TOTAL+ds+shift,a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y);
        const offset=site.side*(T.HW+off+radius);
        const x=a.x-Math.cos(h)*offset,z=a.y+Math.sin(h)*offset,y=T.terrainAt(x,z);
        const near=occupied.some(p=>{
          if(!p.w)return Math.hypot(x-p.x,z-p.z)<p.r+foot+1;
          const dx=x-p.x,dz=z-p.z,c=Math.cos(p.turn),sn=Math.sin(p.turn);
          return Math.abs(c*dx-sn*dz)<p.w/2+foot+1&&Math.abs(sn*dx+c*dz)<p.d/2+foot+1;
        });
        const samples=[[0,0],[-foot,0],[foot,0],[0,-foot],[0,foot]].map(([dx,dz])=>T.terrainAt(x+dx,z+dz));
        const spread=Math.max(...samples)-Math.min(...samples);
        if(!Number.isFinite(y)||y<(T.id==='plaza'?-.4:.1)||spread>(site.kind==='cliff'?16:solid?3.5:8)||!clear(T,x,z,radius)||near
          ||(T.id==='plaza'&&streetDistance(x,z)<STREET_HALF+radius+1)
          ||(T.def.waterAt?.(x,z,0,T)||0)>.05||T.openWater?.surfaceAt(x,z)!=null)continue;
        spot={x,z,y,h,samples,spread};break;
      }
      if(!spot) {
        model.traverse(o=>o.geometry?.dispose());return false;
      }
      const {x,z,y,h,samples,spread}=spot;
      // Sink stones into their support; flat-bottom furniture needs a small
      // matching plinth so it never balances above a slope.
      const isRock=['cliff','moss','granite','alpine-rock','jasper','sandstone','marker','ruin','shore'].includes(site.kind)&&solid;
      const base=isRock?Math.min(...samples)-bounds.min.y*scale-.2:y;
      model.position.set(x,base,z);model.scale.setScalar(scale);model.rotation.y=h+turn;
      source.add(model);
      if(solid&&!isRock&&spread>.25){
        const top=Math.max(...samples),bottom=Math.min(...samples)-.1;
        const pad=box(foot*2,top-bottom,foot*2,M(T.id==='bululu'?0xd9c79b:0x9b9984),x,(top+bottom)/2,z);
        source.add(pad);model.position.y=top;
      }
      occupied.push({x,z,r:foot});
      const placement={x,z,y:model.position.y,radius,roadDistance:Math.abs(T.offsetOf(x,z)),height:(bounds.max.y-bounds.min.y)*scale};
      record.placements.push(placement);
      if(T.def.offroad)colliders.push({x,z,r:solid?radius:.65,base:model.position.y,top:model.position.y+placement.height});
      return true;
    }
    const rock=(i,color,size,moss=true)=>()=>mossRock({seed:seed+i,size,color,moss});
    const tree=(i,type='mango')=>()=>type==='gold'?araguaney({seed:seed+i,detail:'low',scale:.85}):type==='pine'?roadsidePine(seed+i,11+i%3):type==='moriche'?moriche({seed:seed+i,h:9+i%3,detail:'low',fruit:false}):type==='palm'?palm({seed:seed+i,h:11+i%3,detail:'low'}):mangoTree({seed:seed+i,h:(T.id==='plaza'?4.5:8)+i%3,fruit:false,detail:'low'});
    // An authored grove may vary spacing, setback and height without changing
    // its species or tree count. Full crown/road and footprint checks still run.
    const grove=type=>{
      const places=site.grove||Array.from({length:6},(_,i)=>[15+i*12,7+(i%2)*5,1]);
      places.forEach(([along,setback,scale],i)=>put(tree(i,type),along,setback,scale,i*.63,false));
    };
    if(['mango','gold','jungle','pines','moriche','palms'].includes(site.kind)) {
      grove(({gold:'gold',pines:'pine',moriche:'moriche',palms:'palm'})[site.kind]||'mango');
      if(site.kind==='jungle')for(let i=0;i<4;i++)put(()=>hibiscus({seed:seed+i,detail:'low'}),24+i*13,7,1.8,0,false);
    }
    if(['moss','granite','alpine-rock','jasper','sandstone','marker'].includes(site.kind)) {
      const color=({granite:0x8f999d,'alpine-rock':0x9c9d99,jasper:0xa85333,sandstone:0x9a7354,marker:0x99785b})[site.kind];
      for(let i=0;i<7;i++)put(rock(i,color,(site.kind==='marker'?5.5:4.2)-i*.28,site.kind==='moss'),18+i*9,7+(i%3)*2,1,(i%3)*.7);
    }
    if(site.kind==='alpine')for(let i=0;i<4;i++)put(()=>roadsideFrailejon(seed+i,3.1+(i%2)*.3),14+i*8,6+(i%2)*2,1,0,false);
    if(site.kind==='garden') {
      for(let i=0;i<7;i++)put(()=>trinitaria({seed:seed+i,height:3.8,detail:'low'}),18+i*8,7,1,0,false);
      for(let i=0;i<10;i++)put(()=>box(1.1,.8,3.5,M(0xd2bc94),0,.4,0),16+i*5,6,1,0);
    }
    if(site.kind==='flowers')for(let i=0;i<10;i++)put(()=>hibiscus({seed:seed+i,detail:'low'}),24+i*5,5.2,2.2,0,false);
    if(site.kind==='cliff')for(let i=0;i<3;i++)put(()=>rockyCliff({seed:seed+i,width:10,height:10-i*2,depth:6}),18+i*20,6,1,site.side*Math.PI/2);
    if(site.kind==='ruin') {
      for(let i=0;i<5;i++)put(rock(i,0x747f67,3.4-i*.3),20+i*10,8,1,i*.4);
      for(let i=0;i<3;i++)put(()=>trinitaria({seed:seed+i,height:3.2,detail:'low'}),25+i*16,13,1,0,false);
    }
    if(site.kind==='beach') {
      put(()=>beachShade(0xe5a949),26,8,1.6);put(()=>beachShade(0x45a9ae),48,10,1.4);
      for(let i=0;i<3;i++)put(tree(i,'palm'),16+i*22,13,1,i,false);
    }
    if(site.kind==='shore') {
      for(let i=0;i<5;i++)put(driftwood,20+i*9,7,1.6,i*.7);
      for(let i=0;i<3;i++)put(rock(i,0xbcb4a0,2.2,false),26+i*15,10);
      put(tree(8,'palm'),62,12,1,1,false);
    }
    if(site.kind==='fishing') {
      put(beachHut,32,10,1.5,Math.PI);put(()=>fishingBoat({color:0x3a9d9a}),54,7,1.4,1.1);
      put(fishingNetRack,17,8,1.5);put(tree(5,'palm'),65,13,1,2,false);
    }
  }
  const root=finish(source,Infinity);root.name='authored-sightlines';root.userData.sites=records;root.userData.colliders=colliders;
  // Selva permits free off-road driving. Keep the new trunks and rocks solid,
  // chaining its existing boundary rules and allowing escape from overlaps.
  if(colliders.length) {
    const previousConstraint=T.constrainMotion;
    T.constrainMotion=(car,previous)=>{
      previousConstraint?.(car,previous);
      for(const p of colliders) {
        if(car.y>p.top||car.y+3<p.base)continue;
        const d=Math.hypot(car.x-p.x,car.z-p.z),old=Math.hypot(previous.x-p.x,previous.z-p.z);
        if(d<p.r+1.5&&d<old){car.x=previous.x;car.z=previous.z;car.vx=0;car.vz=0;break;}
      }
    };
  }
  return root;
}
