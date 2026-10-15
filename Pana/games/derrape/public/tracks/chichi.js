// Chi Chi: a mountain-to-sea lap inspired by Chichiriviche de la Costa.
import { THREE,M,box,sign,terrain,sea,stream,finish,put,foundation,scatter,instances,clear,boat,edges,boulder } from './world-kit.js';
import { palm,mangoTree,ceiba } from '/engine/flora.js';
import { colonialHouse,streetFoodKiosk } from '/engine/pueblo-props.js';
import { mountainSignpost } from '/engine/mountain-props.js';
import { divingSchool,coastalFort } from './world-landmarks.js';
import { ROUTE,roadHeight,baseHeight,RIVER,riverDistance,coast } from './chichi-layout.js';
export default {
  id:'chichi',name:'Chi Chi',
  blurb:'Baja en zigzag, dobla por el bosque y la escuela de buceo; bordea la bahía y remonta el río.',
  points:ROUTE,rounded:true,hw:8.5,lineU:.025,elevation:roadHeight,
  previewBounds:[[-430,0,-410],[420,230,330]],
  sectors:[[0,'Zigzag de la montaña'],[.28,'El bosque'],[.43,'Escuela de buceo'],[.56,'Bahía Chi Chi'],[.73,'Subida del río'],[.9,'Mirador de la costa']],
  items:{boxes:[.13,.31,.49,.68,.87],boxLanes:[-6,-2,2,6],pads:[{u:.21,off:0},{u:.5,off:4},{u:.7,off:-4},{u:.95,off:0}]},
  walls:false,chevrons:true,
  palette:{horizon:0xb8dce0,skyTop:0x6caed0,hemiSky:0xe1f4f0,hemiGround:0x58835b,hemiInt:1.8,sun:0xffe1ae,sunInt:2.5,ground:0x5a8859,track:0x94978b,dune:0,fog:[320,1400]},
  environment(T){
    const group=new THREE.Group(),world=terrain(T,{bounds:[-620,-590,610,640],base:baseHeight,
      color:(x,z,y)=>z>coast(x)-30?0xcfbd8d:y>160?0x658374:y>80?0x60835c:0x6c985c});
    group.add(sea(world.height),world.land);
    const river=stream(RIVER,8,(x,z)=>Math.max(.1,roadHeight(x,z)-3.3));river.name='chichi-river';group.add(river);
    const school=foundation(group,divingSchool(),-25,140,world.groundAt,{radius:11,rotation:0});school.name='diving-school';
    const fort=foundation(group,coastalFort(),-280,-150,world.groundAt,{radius:12,rotation:-.4});fort.name='coastal-lookout';
    const occupied=[[-25,140,23],[-280,-150,25]],colors=[0xe7bf83,0x92b4ac,0xdba28c,0xede0b5,0x81a4bc];
    let n=0;
    for(const [x,z] of [[-130,193],[-105,208],[-75,215],[-42,219],[-10,225],[28,225],[63,219],[165,200],[190,185]]){
      if(!clear(T,x,z,11))continue;
      foundation(group,colonialHouse({seed:13+n,color:colors[n%5]}),x,z,world.groundAt,{scale:1.5,radius:7});occupied.push([x,z,16]);n++;
    }
    foundation(group,streetFoodKiosk(),-125,122,world.groundAt,{scale:1.6,radius:6,rotation:-.7});
    const fixed=new THREE.Group();
    for(let i=0;i<12;i++){const x=-145+i*27,z=coast(x)+38+(i%3)*10;put(fixed,boat(colors[i%5]),x,z,.1,.6+Math.sin(i)*.7);}
    const jettyX=-28,jettyZ=coast(jettyX)+20;
    fixed.add(box(3.2,.35,35,M(0x9c8261),jettyX,.75,jettyZ));
    for(let i=0;i<5;i++)for(const x of [-1.4,1.4])fixed.add(box(.3,3,.3,M(0x6a5e47),jettyX+x,-.4,jettyZ-16+i*8));
    put(group,sign('BIENVENIDOS A CHI CHI',17,2,{background:'#2d7777'}),-25,152,11);
    group.add(finish(fixed));
    const accept=(x,z)=>z<coast(x)-35&&riverDistance(x,z)>12&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
    instances(group,mangoTree({seed:21,h:7,fruit:false}),scatter(T,world.groundAt,{seed:789,count:190,bounds:[-430,-350,390,190],margin:11,scale:2.1,accept}),'chichi-forest');
    instances(group,ceiba({seed:7}),scatter(T,world.groundAt,{seed:799,count:70,bounds:[-390,-300,360,190],margin:15,scale:2.5,accept}),'chichi-canopy');
    instances(group,boulder(0x718778),scatter(T,world.groundAt,{seed:834,count:80,bounds:[-380,-300,330,180],margin:8,scale:1.5,accept}),'chichi-boulders');
    instances(group,palm({seed:4,h:11}),scatter(T,world.groundAt,{seed:749,count:43,bounds:[-240,125,255,235],margin:8,accept:(x,z,y)=>y<25&&accept(x,z)}),'chichi-coast-palms');
    return {group,groundAt:world.groundAt};
  },
  scenery(group,kit,T){
    edges(group,kit,T,{style:'steel',step:6,skip:s=>{const p=T.pointAt(s);return p.y>140;}});
    for(const u of [.15,.31,.73,.91]){const p=kit.placeOnTrack(T,u*T.TOTAL,T.HW+5);kit.at(group,mountainSignpost(),p,p.h);}
  },
};
