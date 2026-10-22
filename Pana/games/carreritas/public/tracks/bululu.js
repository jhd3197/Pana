import { withSightlines } from './authored-sightlines.js';
import { TRACK_DEFINITIONS } from '../track-definitions.js';
import { libraryForest } from './library-forest.js';
import { groundPaint } from './ground-paint.js';
// Los Roques-inspired racing island. The Bululú board-game world stays independent.
import { THREE,M,box,sign,smooth,hill,terrain,sea,put,foundation,scatter,instances,clear,finish,edges } from './world-kit.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mangrove } from '/engine/models/vegetation/mangrove.js';
import { colonialHouse, colonialChurch, streetFoodKiosk } from '/engine/models/props/pueblo.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { tideZone,tideWetness,tidalCrossing } from './bululu-tide.js';
import { beachShade, beachHut, driftwood } from '/engine/models/props/beach.js';
import { placeReefSchools } from '/engine/placement/reef-schools.js';
import { souvenirKiosk } from '/engine/models/props/monuments.js';
import { festive, meadow } from './festive.js';
import { fishingBoat, coastalLighthouse, lifeguardTower, beachVolleyball, beachShower, rescueRingStand, fishingNetRack, fishCrates, channelBuoy } from '/engine/models/props/coastal.js';
import { beachCrab } from '/engine/models/fauna/beach-crab.js';
import { groundBeachCrab } from '/engine/placement/beach-crab.js';
import { boatRepairYard } from '/engine/models/props/boat-yard.js';
import { iceCreamCart } from '/engine/models/props/ice-cream-cart.js';
import { laundryCourtyard } from '/engine/models/props/laundry-courtyard.js';
import { navigationBeacon } from '/engine/models/props/navigation-beacon.js';
import { cargoHandcart } from '/engine/models/props/cargo-handcart.js';
const SCALE=1.23;
const ROUTE=[[-260,80],[-260,155],[-170,210],[-70,220],[10,170],[15,100],[65,60],[140,75],[220,130],[300,110],[335,35],[300,-35],[230,-70],[170,-130],[90,-195],[-5,-215],[-90,-175],[-120,-100],[-185,-65],[-255,-20]].map(([x,z])=>[x*SCALE,z*SCALE]);
const roadHeight=(x,z)=>(3.2+hill(x,z,-270,-120,120,95,7))*(1-tideZone(x,z))+.48*tideZone(x,z);
function baseHeight(x,z){
  x/=SCALE;z/=SCALE;
  const a=Math.hypot((x+195)/140,(z-35)/205),b=Math.hypot((x-215)/157,(z-35)/117),c=Math.hypot((x+5)/150,(z+180)/72);
  const coast=Math.min(a,b,c);
  let h=3.4-18*smooth(coast,.77,1.23)+hill(x,z,-245,-115,50,60,36);
  // A sheltered harbor behind the village, mangrove lagoons and outlying cays.
  const lagoon=Math.hypot((x+95)/49,(z-40)/63);
  h=h*smooth(lagoon,.7,1.2)-4*(1-smooth(lagoon,.7,1.2));
  for(const [cx,cz,rx,rz] of [[250,235,90,18],[420,-50,60,25],[30,-300,120,15]])h=Math.max(h,1.4-15*smooth(Math.hypot((x-cx)/rx,(z-cz)/rz),.65,1.3));
  return h;
}
export default withSightlines({
  ...TRACK_DEFINITIONS.find(track => track.id === 'bululu'),
  points:ROUTE,rounded:true,hw:9,lineU:.025,elevation:roadHeight,
  waterAt:(x,z,t,T)=>tideWetness(T,x,z,t),
  previewBounds:[[-420,0,-400],[590,75,340]],
  sectors:[[0,'Pueblo del faro'],[.23,'Playa Pana'],[.43,'Cayo de los panas'],[.65,'Lengua de arena'],[.84,'Puerto de colores']],
  items:{boxes:[.1,.29,.48,.67,.87],boxLanes:[-6,-2,2,6],pads:[{u:.18,off:0},{u:.37,off:-4},{u:.59,off:4},{u:.79,off:0},{u:.95,off:-4}]},
  walls:false,chevrons:true,
  palette:{skySeed:31,cloudCover:0.28,horizon:0xbff4ee,skyTop:0x0f95f2,halo:1.1,hemiSky:0xd0e8ff,hemiGround:0xe0c27e,hemiInt:1.6,sun:0xffd99c,sunInt:2.7,ground:0xfbe2a0,track:0xf0c88e,dune:0,fog:[600,2200]},
  // Coconut palms on the far cays, mangroves at the waterline, shade trees inland.
  forest:{plant:libraryForest,bounds:[-640,-540,740,490],count:1100,spacing:10,edge:62,minY:.4,clump:.55,seed:353,
    accept:(x,z)=>tideZone(x,z)<.2,
    species:[{name:'palm',weight:4,scale:[.85,1.3],where:(x,z,y)=>y<14?1.4:.3},{name:'mangrove',weight:2,where:(x,z,y)=>y<2.2?3:0},{name:'mango',weight:1,where:(x,z,y)=>y>9?2:0}]},
  environment(T){
    const group=new THREE.Group(),world=terrain(T,{bounds:[-650,-550,750,500],base:baseHeight,step:5,
      cut:(x,z,h)=>{
        const zone=tideZone(x,z),off=Math.abs(T.offsetOf(x,z));
        const sand=zone*(1-smooth(off,T.HW+1,T.HW+5));h=h*(1-sand)+(T.surfaceAt(x,z)-.14)*sand;
        const channel=zone*smooth(off,T.HW+2,T.HW+19);return h*(1-channel)-3*channel;
      },
      color:(x,z,y)=>y<.8?0xf2e2b4:y<5?0xfbe9c4:y<15?meadow(x,z,0x93c45e):meadow(x,z,0x6fb065),
      paint:groundPaint({tone:.09,moss:.2,keep:(x,z,y)=>y<5.5})});
    group.add(sea(world.groundAt,{opacity:.68}),world.land);
    const village=new THREE.Group(),occupied=[];
    const colors=[0x55a7a5,0xd88b75,0xe2bc60,0x82a9c3,0xd5d1aa];
    let n=0;
    for(const x of [-270,-240,-210])for(const z of [-5,28,61,94,127]){
      if(!clear(T,x,z,13)||world.groundAt(x,z)<1)continue;
      foundation(village,colonialHouse({seed:11+n,color:colors[n%colors.length]}),x,z,world.groundAt,{scale:1.65,radius:7,rotation:Math.PI/2});occupied.push([x,z]);n++;
    }
    foundation(village,colonialChurch(),-211,166,world.groundAt,{radius:10,scale:1.8,rotation:Math.PI});
    for(const [x,z] of [[-173,52],[-174,93]])if(clear(T,x,z,10))foundation(village,streetFoodKiosk(),x,z,world.groundAt,{radius:6,scale:1.6,rotation:Math.PI/2});
    group.add(village);village.name='roques-village';
    const details=new THREE.Group();details.name='roques-beach-details';group.add(details);
    const detail=(id,factory,x,z,radius,rotation=0)=>{
      if(!clear(T,x,z,radius)||world.groundAt(x,z)<.6||occupied.some(([a,b])=>Math.hypot(x-a,z-b)<radius+10))return;
      const object=foundation(details,factory(),x,z,world.groundAt,{radius,rotation});
      object.userData.assetId=id;object.userData.footprintRadius=radius;occupied.push([x,z]);return object;
    };
    for(const [i,[x,z]]of [[255,50],[280,45],[270,75],[245,80]].entries())detail('beachShade',()=>beachShade(i%2?0xe77950:0x48a9aa),x,z,3);
    detail('beachHut',beachHut,295,65,5,Math.PI);
    const kiosk=detail('souvenir-kiosk',souvenirKiosk,-180,135,4,Math.PI/2);
    for(const [x,z]of [[225,165],[290,150]])detail('driftwood',driftwood,x,z,3,.4);
    const coast=new THREE.Group();coast.name='roques-coastal-props';group.add(coast);
    const coastLand=(factory,x,z,radius,rotation=0)=>{
      if(!clear(T,x,z,radius)||world.groundAt(x,z)<.6||occupied.some(([a,b])=>Math.hypot(x-a,z-b)<radius+10))return;
      const object=foundation(coast,factory(),x,z,world.groundAt,{radius,rotation,color:0xd6c6a2});
      object.userData.footprintRadius=radius;occupied.push([x,z]);return object;
    };
    coastLand(coastalLighthouse,-294,-155,2.7);
    coastLand(lifeguardTower,285,110,3.5,Math.PI);
    coastLand(beachVolleyball,260,20,10);
    coastLand(beachShower,230,60,1.4);
    coastLand(rescueRingStand,250,110,1.1,Math.PI);
    coastLand(fishingNetRack,-185,10,2.5,Math.PI/2);
    coastLand(boatRepairYard,-185,-33,9,Math.PI/2);
    coastLand(iceCreamCart,232,35,2.5,0.4);
    coastLand(laundryCourtyard,-182,73,4.5,Math.PI/2);
    coastLand(navigationBeacon,-185,-52,3.5,0);
    coastLand(cargoHandcart,-185,-12,2.5,0.6);
    const coastAt=(factory,x,z,y,radius,rotation=0)=>{
      const object=put(coast,factory(),x,z,y,rotation);object.userData.footprintRadius=radius;return object;
    };
    for(const [x,z] of [[-105,-8],[-88,85]])if(clear(T,x,z,1)&&world.groundAt(x,z)<-1)coastAt(channelBuoy,x,z,-.12,1);
    for(const [i,[x,z]]of [[222,85],[224,87],[247,101],[249,99]].entries())if(clear(T,x,z,1.1)){
      const crab=coastAt(beachCrab,x,z,world.groundAt(x,z),1.1);groundBeachCrab(crab,world.groundAt,i*1.7);
    }
    const schools=placeReefSchools(group,{spots:[[-120,0],[-113,32],[-105,65],[-88,94],[175,20],[210,-5]],groundAt:world.groundAt,clearance:(x,z,r)=>clear(T,x,z,r)});
    const fixed=new THREE.Group();
    // Low jetties and peñeros populate the harbor without filling the beach.
    for(let i=0;i<6;i++){
      const z=-6+i*24,x=-151+Math.sin(i)*5;
      if(clear(T,x,z,7)){
        fixed.add(box(22,.4,2.6,M(0x9d8461),x+7,1,z));
        for(const dx of [-3,5,13,19])fixed.add(box(.3,3,.3,M(0x685b49),x+dx,-.2,z));
        const bx=x+14,bz=z+6;
        if([-4,0,4].every(dx=>[-4,0,4].every(dz=>world.groundAt(bx+dx,bz+dz)<-.8)))coastAt(()=>fishingBoat({color:colors[i%5]}),bx,bz,-.32,4,Math.PI/2);
        if(i===1||i===3)coastAt(fishCrates,x+4,z,1.2,1.3);
      }
    }
    put(group,sign('ISLA BULULÚ',16,2.4,{background:'#317c82'}),-235,187,6.7,Math.PI);
    group.add(finish(fixed));
    instances(group,palm({seed:32,h:10}),scatter(T,world.groundAt,{seed:1032,count:58,bounds:[-350,-210,420,240],margin:9,minY:1,accept:(x,z,y)=>y<9&&!occupied.some(([a,b])=>Math.hypot(x-a,z-b)<14)}),'island-palms');
    instances(group,mangrove({seed:17}),scatter(T,world.groundAt,{seed:701,count:35,bounds:[-145,-45,0,150],margin:6,minY:-1.5,accept:(x,z,y)=>y<3}),'lagoon-mangroves');
    const animateWater=waterAnimator(group),tide=tidalCrossing(T);group.add(tide.group);
    const coastalTicks=coast.children.filter(o=>o.userData.tick);
    return {group,groundAt:world.groundAt,update:t=>{animateWater(t);tide.update(t);kiosk?.userData.tick(t);schools.forEach(o=>o.userData.tick(t));coastalTicks.forEach(o=>o.userData.tick(t));}};
  },
  scenery(group,kit,T){
    edges(group,kit,T,{style:'rope',step:7,skip:(s)=>{const p=T.pointAt(s);return tideZone(p.x,p.y)>.01;}});
    // Beach carnival: toy palms, kiosks with striped umbrellas, balloons,
    // gull flocks and far green cays on the turquoise sea.
    festive(group,T,{seed:31,minY:1,accept:(x,z)=>tideZone(x,z)<.01,stand:'shade',stands:160,banners:420,bunting:200,balloons:120,flags:200,butterflies:16,
      trees:[['palm',36,[0,16]],['bucare',6,[2,16]]],
      plants:[['trinitaria',10,[1,12],.8],['hibiscus',20],['bromeliad',20,[0,6]]],
      birds:[{kind:'macaw',flocks:1,size:4},{kind:'ibis',flocks:1,size:5,height:[14,24]}],
      vista:{shape:'hill',hills:16,height:[40,110],colors:[0x58b86a,0x6fc46a,0x4fae7a],y:-6,balloons:4}});
  },
});
