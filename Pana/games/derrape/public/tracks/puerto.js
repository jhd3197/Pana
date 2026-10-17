import { TRACK_DEFINITIONS } from '../track-definitions.js';
import { THREE,M,box,terrain,sea,finish,instances,scatter,edges,boulder } from './world-kit.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { ROUTE,FORT,baseHeight,roadHeight,coast,harborLand,townSites,townTerraces } from './puerto-layout.js';
import { puertoHarbor } from './puerto-harbor.js';
import { puertoTown } from './puerto-town.js';

export default {
  ...TRACK_DEFINITIONS.find(t=>t.id==='puerto'),points:ROUTE,rounded:true,hw:10,lineU:.025,elevation:roadHeight,
  previewBounds:[[-470,-5,-440],[450,115,435]],walls:false,chevrons:true,
  sectors:[[0,'Patio de contenedores'],[.16,'Las grúas'],[.3,'Avenida del mar'],[.44,'Subida del fortín'],[.6,'Mirador de La Guaira'],[.76,'Casco colonial'],[.9,'Los almacenes']],
  items:{boxes:[.06,.21,.35,.49,.62,.76,.9],boxLanes:[-6,-2,2,6],pads:[{u:.12,off:0},{u:.34,off:-4},{u:.53,off:0},{u:.71,off:4},{u:.94,off:0}]},
  palette:{skySeed:71,cloudCover:.3,horizon:0xb1e3ed,skyTop:0x389fd6,hemiSky:0xe4f5ff,hemiGround:0x75985d,hemiInt:1.7,sun:0xffefcc,sunInt:2.4,ground:0x7ea45e,track:0x727e80,dune:0,fog:[600,2200]},
  environment(T) {
    const sites=townSites(T),group=new THREE.Group(),world=terrain(T,{bounds:[-560,-560,520,470],base:baseHeight,step:4,
      // Fort terrace stays flat, but never replaces the separate road surface.
      cut:(x,z,h)=>Math.hypot(x-FORT.x,z-FORT.z)<43?FORT.y-.25:Math.abs(T.offsetOf(x,z))<T.HW+5?h:townTerraces(x,z,h,sites),
      color:(x,z,y)=>harborLand(x,z)?0xaaa991:z>coast(x)-14?0xd1bf8a:y>80?0x749264:
        new THREE.Color(0x83a85d).lerp(new THREE.Color(0xabc374),.5+.5*Math.sin(x*.025)*Math.cos(z*.018))});
    group.add(world.land,sea(world.groundAt,{size:2400}));
    const harbor=puertoHarbor(T);group.add(harbor.group,puertoTown(T,world,sites));
    const forest=scatter(T,world.groundAt,{seed:713,count:260,bounds:[-600,-720,560,-350],margin:19,scale:2.8,
      accept:(x,z)=>Math.hypot(x-FORT.x,z-FORT.z)>85});
    instances(group,ceiba({seed:71,detail:'distant'}),forest,'puerto-mountain-forest',220);
    // Rock revetments trace the coast instead of scattering props in the bay.
    const rocks=[];
    for(let x=-540;x<490;x+=11) {
      const z=coast(x)+5;if(harborLand(x,z)||!((x>-55&&x<390)||x<-470))continue;
      rocks.push({x,z,y:-.9,rot:x*.2,scale:1.2});
    }
    for(let z=70;z<410;z+=13)rocks.push({x:431,z,y:-.9,rot:z,scale:1.3});
    for(let x=45;x<425;x+=13)rocks.push({x,z:420,y:-1,rot:x,scale:1.4});
    instances(group,boulder(0xa8a691),rocks,'puerto-coastal-rocks',160);
    const retaining=new THREE.Group();
    for(let s=0;s<T.TOTAL;s+=5) {
      const p=T.pointAt(s);if(p.y>-180)continue;
      const q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y);
      for(const side of [-1,1]) {const x=p.x-Math.cos(h)*side*(T.HW+1.6),z=p.y+Math.sin(h)*side*(T.HW+1.6),y=T.surfaceAt(x,z);const wall=box(.7,3.5,5.3,M(0xa7a38c),x,y-1.8,z);wall.rotation.y=h;retaining.add(wall);}
    }
    group.add(finish(retaining));const animateWater=waterAnimator(group);
    return {group,groundAt:world.groundAt,update:t=>{animateWater(t);harbor.update(t);}};
  },
  scenery(group,kit,T) {edges(group,kit,T,{style:'kerb',step:5});edges(group,kit,T,{style:'steel',step:8,skip:s=>T.pointAt(s).y>-175});},
};
