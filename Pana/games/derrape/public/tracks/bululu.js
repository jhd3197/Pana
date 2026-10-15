// Los Roques-inspired racing island. The Bululú board-game world stays independent.
import { THREE,M,box,sign,smooth,hill,terrain,sea,put,foundation,scatter,instances,clear,finish,boat,edges } from './world-kit.js';
import { palm,mangrove } from '/engine/flora.js';
import { colonialHouse,colonialChurch,streetFoodKiosk } from '/engine/pueblo-props.js';
const SCALE=1.23;
const ROUTE=[[-260,80],[-260,155],[-170,210],[-70,220],[10,170],[15,100],[65,60],[140,75],[220,130],[300,110],[335,35],[300,-35],[230,-70],[170,-130],[90,-195],[-5,-215],[-90,-175],[-120,-100],[-185,-65],[-255,-20]].map(([x,z])=>[x*SCALE,z*SCALE]);
const roadHeight=(x,z)=>3.2+hill(x,z,-270,-120,120,95,7);
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
export default {
  id:'bululu',name:'Isla Bululú',
  blurb:'Inspirada en Los Roques: pueblo costero, lagunas turquesa, cayos y curvas sobre arena blanca.',
  points:ROUTE,rounded:true,hw:9,lineU:.025,elevation:roadHeight,
  previewBounds:[[-420,0,-400],[590,75,340]],
  sectors:[[0,'Pueblo del faro'],[.23,'Playa Pana'],[.43,'Cayo de los panas'],[.65,'Lengua de arena'],[.84,'Puerto de colores']],
  items:{boxes:[.1,.29,.48,.67,.87],boxLanes:[-6,-2,2,6],pads:[{u:.18,off:0},{u:.37,off:-4},{u:.59,off:4},{u:.79,off:0},{u:.95,off:-4}]},
  walls:false,chevrons:true,
  palette:{horizon:0xc1e6ea,skyTop:0x65b9df,hemiSky:0xe9faff,hemiGround:0xc6be92,hemiInt:1.9,sun:0xffefd1,sunInt:2.7,ground:0xf1e3b7,track:0xddcca3,dune:0,fog:[550,1800]},
  environment(T){
    const group=new THREE.Group(),world=terrain(T,{bounds:[-650,-550,750,500],base:baseHeight,step:5,
      color:(x,z,y)=>y<.8?0xe9dfbd:y<5?0xf3e7c6:y<15?0xb3ae7d:0x979d88});
    group.add(sea(world.height),world.land);
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
    const fixed=new THREE.Group();
    // Low jetties and peñeros populate the harbor without filling the beach.
    for(let i=0;i<6;i++){
      const z=-6+i*24,x=-151+Math.sin(i)*5;
      if(clear(T,x,z,7)){
        fixed.add(box(22,.4,2.6,M(0x9d8461),x+7,1,z));
        for(const dx of [-3,5,13,19])fixed.add(box(.3,3,.3,M(0x685b49),x+dx,-.2,z));
        put(fixed,boat(colors[i%5]),x+14,z+6,.1,Math.PI/2);
      }
    }
    // Painted lighthouse on the dry rocky crest.
    const lx=-294,lz=-155,ly=world.groundAt(lx,lz);
    fixed.add(new THREE.Mesh(new THREE.CylinderGeometry(2,2.7,13,12),M(0xf2e4c6)));
    const tower=fixed.children[fixed.children.length-1];tower.position.set(lx,ly+6.5,lz);
    fixed.add(box(4.8,.4,4.8,M(0x397b85),lx,ly+13,lz),box(3.2,2,3.2,M(0x579ca7),lx,ly+14,lz));
    put(group,sign('ISLA BULULÚ',16,2.4,{background:'#317c82'}),-235,187,6.7,Math.PI);
    group.add(finish(fixed));
    instances(group,palm({seed:32,h:10}),scatter(T,world.groundAt,{seed:1032,count:58,bounds:[-350,-210,420,240],margin:9,minY:1,accept:(x,z,y)=>y<9&&!occupied.some(([a,b])=>Math.hypot(x-a,z-b)<14)}),'island-palms');
    instances(group,mangrove({seed:17}),scatter(T,world.groundAt,{seed:701,count:35,bounds:[-145,-45,0,150],margin:6,minY:-1.5,accept:(x,z,y)=>y<3}),'lagoon-mangroves');
    return {group,groundAt:world.groundAt};
  },
  scenery(group,kit,T){edges(group,kit,T,{style:'rope',step:7,skip:(s)=>{const p=T.pointAt(s);return Math.abs(p.x)<100&&p.y<0;}});},
};
