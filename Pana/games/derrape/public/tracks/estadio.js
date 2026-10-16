import { TRACK_DEFINITIONS } from '../track-definitions.js';
// Stadium Grand Prix: braking zones, opposing chicanes and an infield return.
import { THREE,M,box,tube,sign,terrain,finish,put,instances,scatter,edges,clear } from './world-kit.js';
import { grandstand } from './world-landmarks.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { cornerBodega, streetFoodKiosk, basketballHoop, rooftopWaterTank } from '/engine/models/props/pueblo.js';
import { trophyMonument } from '/engine/models/props/monuments.js';
import { stadiumGrounds } from './stadium-grounds.js';

export default {
  ...TRACK_DEFINITIONS.find(track => track.id === 'estadio'),
  points:[[-235,150],[-130,150],[-30,150],[70,150],[150,150],[200,110],[200,35],[140,20],[85,40],[25,5],[50,-65],[130,-85],[205,-90],[235,-110],[240,-200],[165,-245],[80,-215],[45,-155],[-15,-145],[-50,-195],[-115,-220],[-220,-210],[-265,-150],[-250,-80],[-180,-50],[-120,-85],[-65,-65],[-65,0],[-130,40],[-220,35],[-275,85]],
  rounded:true,hw:8,lineU:.045,elevation:()=>1.65,
  previewBounds:[[-430,0,-400],[515,55,475]],
  sectors:[[0,'Recta principal'],[.24,'Chicana del marcador'],[.43,'Horquilla del paddock'],[.63,'Doble cambio'],[.82,'Curva de la hinchada']],
  shortcuts:[{from:[.2338,5.5],to:[.3579,5.5]}],
  items:{boxes:[.12,.32,.49,.69,.9],boxLanes:[-5.5,-1.8,1.8,5.5],pads:[{u:.055,off:0},{u:.37,off:-3},{u:.73,off:3}]},
  walls:false,chevrons:true,
  palette:{skySeed:23,cloudCover:0.28,horizon:0xb6def1,skyTop:0x278dd1,hemiSky:0xe4f3ff,hemiGround:0x5e8650,hemiInt:1.55,sun:0xfff2dd,sunInt:2.5,ground:0x60a34e,track:0x626e75,dune:0,fog:[350,1050]},
  environment(T){
    const group=new THREE.Group(),world=terrain(T,{bounds:[-620,-570,620,520],base:()=>1,color:(x,z)=>Math.abs(T.offsetOf(x,z))<22?0xc5bfa8:0x62a849,step:7});group.add(world.land);
    const fixed=new THREE.Group(),white=M(0xefe8cf);
    for(let i=0;i<10;i++)fixed.add(box(13,.12,60,M(i%2?0x4f956b:0x5aa376),-63.5+i*13,1.17,90));
    for(const z of [60,120])fixed.add(box(130,.04,.25,white,-5,1.25,z));
    for(const x of [-70,-5,60])fixed.add(box(.25,.04,60,white,x,1.25,90));
    const ring=new THREE.Mesh(new THREE.RingGeometry(9,9.25,64),white);ring.rotation.x=-Math.PI/2;ring.position.set(-5,1.26,90);fixed.add(ring);
    for(const x of [-70,60]){
      for(const z of [84,96])fixed.add(tube([x,1.25,z],[x,4.2,z],.1,white));fixed.add(tube([x,4.2,84],[x,4.2,96],.1,white));
      for(const z of [78,102])fixed.add(box(16,.04,.25,white,x+(x<0?8:-8),1.25,z));fixed.add(box(.25,.04,24,white,x+(x<0?16:-16),1.25,90));
    }
    put(group,grandstand({length:125,rows:11}),-75,184,1,Math.PI);
    put(group,grandstand({length:95,rows:8,color:0x5a969f}),-5,45,1);
    put(group,grandstand({length:78,rows:9}),-307,-110,1,Math.PI/2);
    put(group,grandstand({length:55,rows:9,color:0xbd594d}),-100,90,1,Math.PI/2);
    put(group,grandstand({length:55,rows:9,color:0xbd594d}),95,90,1,-Math.PI/2);
    put(group,grandstand({length:100,rows:7,color:0x507c95}),120,-280,1);
    // Service aprons, marked pit lane and spectator paths make a continuous venue.
    fixed.add(box(285,.08,58,M(0x8d9996),-65,1.08,222),box(145,.08,20,M(0xc9c5ac),-5,1.08,132));
    for(let x=-205;x<65;x+=12)fixed.add(box(6,.06,.3,white,x,1.17,200));
    for(let x=-200;x<60;x+=18)fixed.add(box(.2,.06,13,white,x,1.17,242));
    const banners=new THREE.Group();
    for(const [x,z,turn] of [[-75,172,Math.PI],[120,-260,0],[-290,-110,Math.PI/2]]){
      const panel=sign('PANA  ·  DALE OTRA VUELTA',42,2.3,{background:'#316873'});put(banners,panel,x,z,4,turn);
    }
    group.add(finish(banners));
    // Pit garages and equipment face the long starting straight.
    for(let i=0;i<8;i++){
      const x=-200+i*18;fixed.add(box(16,7,14,M(0xe6d7b8),x,4.5,220),box(14,4,.15,M(i%2?0x447d88:0xb95e43),x,3.2,212.9),box(17,.4,16,M(0x44565e),x,8.2,220));
      put(group,sign(String(i+1).padStart(2,'0'),2,1,{background:'#243e48'}),x,212.7,6.3,Math.PI);
    }
    for(const [x,z] of [[-105,135],[90,95],[-85,47],[80,47]]){
      if(!clear(T,x,z,4))continue;
      fixed.add(tube([x,1,z],[x,31,z],.32,M(0x657b7d)),box(7,2,.8,M(0x344b55),x,31,z));
      for(let i=-2;i<=2;i++)fixed.add(box(.9,1.2,.15,M(0xfef4cb,{emissive:0x675737}),x+i*1.2,31,z+.5));
    }
    const score=new THREE.Group();score.add(box(25,11,1,M(0x213c48),0,17,0));
    for(const x of [-9,9])score.add(box(.65,18,.65,M(0x5d7479),x,9,0));
    put(score,sign('PANA  02 : 01  PANAS',22,3,{background:'#173844',color:'#fff2b8'}),0,.6,18);
    put(score,sign('EL ESTADIO · GRAN PREMIO',22,1.5,{background:'#173844'}),0,.6,14.5);
    put(group,finish(score),123,-6,1,.25);
    for(const [x,z] of [[-200,255],[-170,255],[160,210]])if(clear(T,x,z,12))put(group,streetFoodKiosk(),x,z,1,Math.PI,2);
    put(group,cornerBodega(),-305,170,1,1.5,2);
    const details=new THREE.Group();details.name='stadium-library-details';group.add(details);
    const detail=(id,object,x,z,y,rotation=0,radius=3)=>{
      if(!clear(T,x,z,radius))return;
      put(details,object,x,z,y,rotation);object.userData.assetId=id;object.userData.footprintRadius=radius;
    };
    detail('trophy-monument',trophyMonument(),105,220,1,Math.PI,5);
    for(const x of [-200,-92])detail('rooftop-water-tank',rooftopWaterTank(),x,223,8.4);
    // A community half-court beside the spectator entrance, away from the lap.
    fixed.add(box(15,.08,24,M(0xb57b5e),180,1.08,232));
    for(const z of [221,243])fixed.add(box(13,.03,.12,white,180,1.14,z));
    for(const x of [173.5,186.5])fixed.add(box(.12,.03,22,white,x,1.14,232));
    for(const [z,rot]of [[221,0],[243,Math.PI]])detail('basketball-hoop',basketballHoop(),180,z,1.12,rot);
    group.add(finish(fixed));
    instances(group,palm({seed:9,h:11}),scatter(T,world.groundAt,{seed:137,count:38,bounds:[-365,-300,310,285],margin:12,accept:(x,z)=>Math.abs(x)>280||z<-265||z>250}),'stadium-palms');
    const grounds=stadiumGrounds(T,world.groundAt);group.add(grounds);group.userData.surroundings=grounds.userData.surroundings;
    return {group,groundAt:world.groundAt};
  },
  scenery(group,kit,T){edges(group,kit,T,{style:'kerb',step:3});},
};
