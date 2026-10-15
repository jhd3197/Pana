// Chi Chi: a long coastal mountain journey, with fictional thermal springs.
import { THREE,M,box,terrain,sea,stream,finish,put,foundation,scatter,instances,edges,boulder,smooth } from './world-kit.js';
import { palm,mangoTree,ceiba,fern } from '/engine/flora.js';
import { mountainSignpost } from '/engine/mountain-props.js';
import { waterfallRocks } from '/engine/jungle-props.js';
import { coastalFort } from './world-landmarks.js';
import { thermalSanctuary } from './chichi-thermal.js';
import { beachVillage,riverBridges } from './chichi-village.js';
import { ROUTE,roadHeight,baseHeight,RIVER,riverDistance,coast,THERMAL,gripAt } from './chichi-layout.js';
export default {
  id:'chichi',name:'Chi Chi',
  blurb:'De las termas entre nubes al pueblo de buceo: curvas de montaña, bosque húmedo, playa y una larga subida junto al río.',
  points:ROUTE,rounded:true,hw:8.5,lineU:.025,elevation:roadHeight,gripAt,
  previewBounds:[[-620,0,-790],[650,370,650]],
  sectors:[[0,'Mirador de las nubes'],[.08,'Aguas del Cielo'],[.22,'Las siete curvas'],[.4,'Bosque de la quebrada'],[.53,'Pueblo de buceo'],[.63,'Bahía Chi Chi'],[.73,'Puentes del río'],[.86,'Subida al mirador']],
  items:{boxes:[.1,.23,.36,.49,.62,.75,.9],boxLanes:[-6,-2,2,6],pads:[{u:.035,off:0},{u:.36,off:4},{u:.57,off:4},{u:.7,off:-4},{u:.81,off:0},{u:.96,off:0}]},
  walls:false,chevrons:true,
  palette:{horizon:0xc4e1df,skyTop:0x76adc4,hemiSky:0xe1f4f0,hemiGround:0x58835b,hemiInt:1.8,sun:0xffe1ae,sunInt:2.5,ground:0x5a8859,track:0x94978b,dune:0,fog:[420,1750]},
  environment(T){
    const group=new THREE.Group(),world=terrain(T,{bounds:[-800,-900,800,950],base:baseHeight,step:6,
      // Preserve the channel under road bridges after the usual road carving.
      cut:(x,z,h)=>{
        const flat=(1-smooth(Math.hypot(x-THERMAL.x,z-THERMAL.z),60,85))*smooth(Math.abs(T.offsetOf(x,z)),T.HW+7,T.HW+22);
        h=h*(1-flat)+THERMAL.y*flat;
        const d=riverDistance(x,z);return h*smooth(d,8,22)+Math.min(h,roadHeight(x,z)-7)*(1-smooth(d,8,22));
      },
      color:(x,z,y)=>z>coast(x)-30?0xcfbd8d:Math.hypot(x-THERMAL.x,z-THERMAL.z)<66?0xb6b69a:y>235?0x7d9381:y>150?0x658374:y>80?0x60835c:0x6c985c});
    group.add(sea(world.height,{size:3400}),world.land);
    const river=stream(RIVER,10,(x,z)=>Math.max(.1,roadHeight(x,z)-5.8),0x4c9b99);river.name='chichi-river';group.add(river,riverBridges(T));
    const springs=thermalSanctuary(T,world),village=beachVillage(T,world);group.add(springs.group,village.group);
    const fort=foundation(group,coastalFort(),-290,-550,world.groundAt,{radius:13,rotation:Math.PI*.1,scale:1.4});fort.name='coastal-lookout';
    const falls=put(group,waterfallRocks({seed:137}),-245,-8,world.groundAt(-245,-8)-.2,-.45,3.6);falls.name='forest-waterfall';
    const occupied=[...village.occupied,[-290,-550,29],[-182,-550,27],[-245,-8,27]];
    const accept=(x,z)=>z<coast(x)-30&&riverDistance(x,z)>19&&Math.hypot(x-THERMAL.x,z-THERMAL.z)>94&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
    instances(group,mangoTree({seed:21,h:7,fruit:false}),scatter(T,world.groundAt,{seed:789,count:280,bounds:[-450,-460,430,270],margin:14,scale:2.7,accept}),'chichi-forest',220);
    instances(group,ceiba({seed:7}),scatter(T,world.groundAt,{seed:799,count:95,bounds:[-360,-240,260,240],margin:20,scale:3.3,accept}),'chichi-canopy',220);
    instances(group,fern({seed:32}),scatter(T,world.groundAt,{seed:824,count:90,bounds:[-360,-280,350,200],margin:9,scale:2.5,accept}),'chichi-undergrowth',220);
    const rocks=scatter(T,world.groundAt,{seed:834,count:105,bounds:[-540,-680,500,240],margin:9,scale:1.7,
      accept:(x,z)=>accept(x,z)&&Math.abs(world.groundAt(x+4,z)-world.groundAt(x-4,z))<4&&Math.abs(world.groundAt(x,z+4)-world.groundAt(x,z-4))<4});
    instances(group,boulder(0x718778),rocks.map(p=>({...p,y:p.y-p.scale*.9})),'chichi-boulders',220);
    instances(group,palm({seed:4,h:11}),scatter(T,world.groundAt,{seed:749,count:65,bounds:[-330,210,370,430],margin:9,accept:(x,z,y)=>y<33&&accept(x,z)}),'chichi-coast-palms',220);
    // Stone retaining toes reveal the stacked mountain road in the valley view.
    const retaining=new THREE.Group(),stone=M(0x7e8b7c);
    for(let s=0;s<T.TOTAL;s+=8){
      const p=T.pointAt(s);if(p.x>50||p.y<-370||p.y>190)continue;
      for(const side of [-1,1]){
        const a=T.pointAt(s+.5),h=Math.atan2(a.x-p.x,a.y-p.y),x=p.x-Math.cos(h)*side*(T.HW+1),z=p.y+Math.sin(h)*side*(T.HW+1),y=T.surfaceAt(x,z);
        const wall=box(.8,4,8.3,stone,x,y-2.1,z);wall.rotation.y=h;retaining.add(wall);
      }
    }group.add(finish(retaining));
    return {group,groundAt:world.groundAt,update:t=>{springs.update(t);falls.userData.tick(t);}};
  },
  scenery(group,kit,T){
    edges(group,kit,T,{style:'steel',step:6,skip:s=>{const p=T.pointAt(s);return riverDistance(p.x,p.y)<25;}});
    for(const u of [.07,.21,.4,.52,.7,.84,.95]){const p=kit.placeOnTrack(T,u*T.TOTAL,T.HW+5);kit.at(group,mountainSignpost(),p,p.h);}
  },
};
