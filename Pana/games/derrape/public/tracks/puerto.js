import { TRACK_DEFINITIONS } from '../track-definitions.js';
import { lajaRock } from '/engine/models/props/amazonas.js';
import { THREE,M,box,terrain,sea,finish,instances,scatter,edges } from './world-kit.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { ROUTE,FORT,CASA,baseHeight,coast,harborLand,townSites,townTerraces,isFort,isMountain,roadStyle } from './puerto-layout.js';
import { puertoHarbor } from './puerto-harbor.js';
import { puertoTown } from './puerto-town.js';
import { puertoFort } from './puerto-fort.js';
import { puertoTunnel } from './puerto-tunnel.js';
import { festive, meadow } from './festive.js';

export default {
  ...TRACK_DEFINITIONS.find(t=>t.id==='puerto'),points:ROUTE,rounded:true,layered:true,hw:11.5,lineU:.085,roadStyle,
  gripAt:(x,z)=>roadStyle(x,z)==='mud' ? .76 : 1,
  previewBounds:[[-700,-26,-1250],[600,290,510]],walls:false,chevrons:true,
  sectors:[[0,'Túnel del puerto'],[.07,'Las tres grúas'],[.12,'Patio de contenedores'],[.17,'Casa Guipuzcoana'],[.29,'Camino de barro'],[.39,'Mirador del Caribe'],[.47,'Puerta de San Carlos'],[.53,'Rampa del patio'],[.57,'Vuelta a los baluartes'],[.75,'Salto del castillo'],[.86,'Bajada del pueblo']],
  items:{boxes:[.045,.17,.28,.4,.52,.65,.71,.87,.95],boxLanes:[-6,-2,2,6],pads:[{u:.09,off:0},{u:.26,off:-4},{u:.46,off:0},{u:.6,off:4},{u:.91,off:0}]},
  palette:{skySeed:71,cloudCover:.3,horizon:0xc3f1ec,skyTop:0x1592ee,halo:1,hemiSky:0xd2e6ff,hemiGround:0x7fae55,hemiInt:1.7,sun:0xffd79a,sunInt:2.6,ground:0x8cbc5c,track:0x736b78,dune:0,fog:[900,2900]},
  environment(T){
    const lip=T.paramOf(-346,-1076,190.2),landing=T.paramOf(-420,-1148,170);
    T.gaps=[{s0:lip,len:landing-lip-8}];
    T.ramps=[{s0:lip-55,len:55,h:35,hw:11.3,followRoad:true}];
    T.tunnel={s0:T.paramOf(-560,60,-10),s1:T.paramOf(-570,318,-1)};
    const sites=townSites(T),group=new THREE.Group(),world=terrain(T,{bounds:[-760,-1250,600,510],base:baseHeight,step:4,
      cut:(x,z,h)=>{
        if(x<-620&&z>120&&z<320)return Math.min(h,-25);
        if(T.gapAt(T.paramOf(x,z))&&Math.abs(T.offsetOf(x,z))<T.HW+30)return Math.min(h,FORT.y-8);
        if(isFort(x,z))return FORT.y-.65;
        const d=Math.max(Math.abs(x-CASA.x)/80,Math.abs(z-CASA.z)/58);
        if(d<1)return CASA.y-.35;
        const off=Math.abs(T.offsetOf(x,z));return off<T.HW+2?h:townTerraces(x,z,h,sites,off);
      },
      color:(x,z,y)=>y<-15?0x417f89:isFort(x,z)?0xa99470:harborLand(x,z)?0xd6c6a2:z>coast(x)-14?0xd1bf8a:isMountain(x,z)&&Math.abs(T.offsetOf(x,z))<25?0xa48558:
        meadow(x,z,0x7fb85a,{bloom:0xff9fd0})});
    const tunnel=puertoTunnel(T);
    group.add(world.land,sea((x,z)=>harborLand(x,z)?Math.max(4.2,world.groundAt(x,z)):world.groundAt(x,z),{size:3000}),tunnel);
    const harbor=puertoHarbor(T);group.add(harbor.group,puertoTown(T,world,sites),puertoFort(T));
    const forest=scatter(T,world.groundAt,{seed:713,count:150,bounds:[-680,-1130,580,-350],margin:20,scale:3.2,accept:(x,z)=>!isFort(x,z)&&!sites.some(s=>Math.hypot(s.x-x,s.z-z)<27)&&!(x>-245&&x<270&&z>-490&&z<-245)});
    instances(group,ceiba({seed:71,detail:'distant'}),forest,'puerto-mountain-forest',260);
    const rocks=[];
    for(let x=-680;x<490;x+=11){const z=coast(x)+5;if(harborLand(x,z)||!((x>-55&&x<390)||x<-640))continue;rocks.push({x,z,y:-.9,rot:x*.2,scale:1.2});}
    for(let z=70;z<460;z+=13)rocks.push({x:431,z,y:-.9,rot:z,scale:1.3});
    for(let x=-20;x<425;x+=13)rocks.push({x,z:470,y:-1,rot:x,scale:1.4});
    instances(group,lajaRock({seed:71,radius:2.4,color:0x8a8478}),rocks,'puerto-coastal-rocks',180);
    const retaining=new THREE.Group();
    for(let s=0;s<T.TOTAL;s+=5){const p=T.pointAt(s);if(p.y>-250||isFort(p.x,p.y))continue;
      if(T.gapAt(s))continue;const q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y);
      for(const side of [-1,1]){const x=p.x-Math.cos(h)*side*(T.HW+1.6),z=p.y+Math.sin(h)*side*(T.HW+1.6),y=T.surfaceAt(x,z),wall=box(.7,3.5,5.3,M(0xa7a38c),x,y-1.8,z);wall.rotation.y=h;retaining.add(wall);}
    }
    group.add(finish(retaining));const animateWater=waterAnimator(group);
    return {group,groundAt:world.groundAt,update:t=>{animateWater(t);harbor.update(t);tunnel.userData.tick(t);}};
  },
  scenery(group,kit,T){
    edges(group,kit,T,{style:'kerb',step:5,cellSize:220,colors:[0xff4f5e,0xfffaf0,0x3ec1ff,0xfffaf0],skip:s=>{const p=T.pointAt(s);return roadStyle(p.x,p.y)!=='asphalt';}});
    edges(group,kit,T,{style:'rope',step:6,cellSize:220,skip:s=>{const p=T.pointAt(s);return !isMountain(p.x,p.y)||isFort(p.x,p.y);}});
    edges(group,kit,T,{style:'steel',step:8,cellSize:220,skip:s=>{const p=T.pointAt(s);return T.gapAt(s)||p.y>-175||isFort(p.x,p.y)||isMountain(p.x,p.y);}});
    // Port festival: harbour bunting, kiosks, balloons and gulls; flowering
    // trees up the mountain road.
    festive(group,T,{seed:71,cell:1400,minY:.6,skip:s=>{const p=T.pointAt(s);return isFort(p.x,p.y);},stands:300,banners:420,bunting:180,balloons:140,flags:220,butterflies:24,
      trees:[['apamate',14,[1,18]],['araguaney',12,[1,18]],['palm',14,[0,14]],['bucare',8,[1,18]]],
      plants:[['hibiscus',30],['bromeliad',30,[0,6]],['trinitaria',10,[0,8],.8]],
      birds:[{kind:'macaw',flocks:1,size:4},{kind:'ibis',flocks:1,size:5,height:[16,28]}],
      vista:{shape:'peak',radius:1700,hills:22,height:[220,380],colors:[0x5fa585,0x6cb092,0x7aa9b8],balloons:5}});
  },
};
