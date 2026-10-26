// i18n-ignore-file: world signage and scene object names stay Spanish.
import * as THREE from 'three';
import {M,rng} from '/engine/models/core/primitives.js';
import {ranchCaney,chinchorro,saddleStand,hitchingRail,campfire,coffeeTable,riverCanoe,wetlandLanding,floodedFence,trailSign,termiteMound} from '/engine/models/props/llano-life.js';
import {driftwood} from '/engine/models/props/beach.js';
import {landingShelter} from '/engine/models/props/delta.js';
import {moriche} from '/engine/models/vegetation/moriche.js';
import {savannaGrass} from '/engine/models/vegetation/savanna-grass.js';
import {mangoTree} from '/engine/models/vegetation/mango-tree.js';
import {reeds} from '/engine/models/vegetation/reeds.js';
import {waterLily} from '/engine/models/vegetation/water-lily.js';
import {wildCapybara} from '/engine/models/fauna/capybara/wild-capybara.js';
import {at,nearest,LENGTH,groundAt,waterDepth,WATER_Y,WETLANDS,wetlandDistance} from './course.js';

// World dressing belongs here; reusable model geometry stays in the library.
export function addLandscape({group,add,plantInstances,reserved}) {
  add('ranch-caney',ranchCaney(),-28,37,0,1,5);
  add('chinchorro',chinchorro(),-29,36,0,1,3.2,true);
  add('coffee-table',coffeeTable(),-26,39,0,1,1.6);
  add('saddle-stand',saddleStand(),-36,25,.25,1,1.4);
  add('saddle-stand',saddleStand(),-39,24,-.2,1,1.4);
  add('hitching-rail',hitchingRail(),-33,32,0,1,2.6);
  add('campfire',campfire(),-14,34,0,1,1.2,true);
  add('coffee-table',coffeeTable(),-9,34,.65,1,1.6);
  add('llano-trail-sign',trailSign({label:'HATO PANA',secondary:'CAFÉ · SOMBRA · CHINCHORROS'}),-22,42,0,1,1.5);
  add('llano-trail-sign',trailSign(),37,66,-2.8,1,1.5);
  add('llano-trail-sign',trailSign({label:'CAÑO DEL MORICHAL',secondary:'ENTRE PALMAS Y AGUA'}),-91,-21,1.7,1,1.5);
  add('termite-mound',termiteMound({seed:8}),35,-53,0,1.3,1.3);
  add('termite-mound',termiteMound({seed:12}),4,-91,1,1,1.3);
  add('termite-mound',termiteMound({seed:16}),31,-76,2,1.5,1.6);
  // The landing reaches water from its northern dry bank. Its origin is the
  // foot of its piles; the canoe's origin is the keel, both explicit placements.
  const deck=add('wetland-landing',wetlandLanding({length:9}),87,45,.4,1,5);
  deck.position.y=.1;
  const shelter=add('landing-shelter',landingShelter({width:2.4,depth:3,deck:.95,height:2.6}),87,45,.4,1,2);
  shelter.position.y=.1;
  const canoe=add('river-canoe',riverCanoe(),84,47,.75,1,3.2);canoe.position.y=WATER_Y-.18;
  add('ranch-caney',ranchCaney(),102,49,.3,.85,4.5);
  add('coffee-table',coffeeTable(),102,49,.3,1,1.6);
  add('flooded-fence',floodedFence({span:10,seed:9}),106,58,.5,1,5.5);
  add('flooded-fence',floodedFence({span:7,seed:12}),-92,-47,1.1,1,4);
  add('driftwood',driftwood(),72,72,1.6,1.2,2.5);
  add('driftwood',driftwood(),-104,-30,-.4,1,2.2);
  for(const [i,x,z]of [[0,71,75],[1,68,76],[2,-89,-22]])add('wild-capybara',wildCapybara({seed:17+i}),x,z,i*1.7,1.1,1.5,true);

  // A lower, narrower footpath connects the hato buildings without inventing a
  // second race route. It uses the actual terrain and stops at the landing.
  const paths=[[[ -42,29],[-28,27],[-23,33],[-28,40]],[[78,25],[91,29],[99,42],[102,49]],[[99,42],[93,40],[85.25,40.85]]];
  for(const points of paths){
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))),ps=[],ix=[];
    for(let i=0;i<=60;i++){
      const p=curve.getPoint(i/60),t=curve.getTangent(i/60);
      for(const side of [-1,1]){const x=p.x+t.z*side*.95,z=p.z-t.x*side*.95;ps.push(x,groundAt(x,z)+.025,z);}
      if(i<60){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setIndex(ix);geo.computeVertexNormals();
    const path=new THREE.Mesh(geo,M(0xb3a16d,{side:THREE.DoubleSide,roughness:1,polygonOffset:true,polygonOffsetFactor:-1}));path.name='Ranch footpath';path.receiveShadow=true;group.add(path);
    for(let i=0;i<=20;i++){const p=curve.getPoint(i/20);reserved.push({x:p.x,z:p.z,r:2.1});}
  }

  const random=rng(441),clear=(x,z,r=0)=>nearest(x,z).distance>10+r&&!reserved.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r);
  const place=(x,z,scale=1)=>({x,z,y:groundAt(x,z),rot:random()*Math.PI*2,scale});
  const palms=[],shade=[],grass=[],gold=[],rushes=[],lilies=[];
  // Habitat-based groves: dense along the western creek, sparse on the lagoon,
  // and open grassland to the south. Reserve tree footprints before undergrowth.
  for(let i=0;i<240;i++){
    const west=i<170,x=west?-132+random()*84:65+random()*77,z=west?-115+random()*112:20+random()*82;
    const distance=wetlandDistance(WETLANDS[west?1:0],x,z);
    if(distance<.95||distance>2.35||!clear(x,z,4)||waterDepth(x,z)>.01)continue;
    palms.push(place(x,z,.8+random()*.5));reserved.push({x,z,r:3});
  }
  palms.push(place(94,74,.74));reserved.push({x:94,z:74,r:4});
  for(const [x,z]of [[-5,22],[16,11],[-24,-20],[-111,34],[31,-100],[98,-52],[-105,92],[29,98],[-152,-57]]){
    if(clear(x,z,5)){shade.push(place(x,z,1.5+random()*.45));reserved.push({x,z,r:5});}
  }
  // Fine shoreline sampling follows the signed bed, not an ellipse/ring stamp.
  for(let i=0;i<3800;i++){
    const x=-140+random()*285,z=-112+random()*220,depth=waterDepth(x,z),y=groundAt(x,z);
    if(!clear(x,z,1))continue;
    if(depth>.1&&depth<.48&&random()<.38)rushes.push(place(x,z,.8+random()*.65));
    else if(depth>.4&&random()<.1)lilies.push({...place(x,z,.7+random()*.6),y:WATER_Y+.017});
    else if(!depth&&y<1.12&&Math.min(...WETLANDS.map(w=>wetlandDistance(w,x,z)))<1.25&&random()<.27)rushes.push(place(x,z,.6+random()*.4));
  }
  // Dense islands of grass, with long clear vistas between them.
  for(let i=0;i<3500;i++){
    const x=-180+random()*360,z=-165+random()*325;
    if(waterDepth(x,z)>.02||!clear(x,z,.4))continue;
    if(Math.sin(x*.07+Math.cos(z*.09))*Math.cos(z*.075)<-.35)continue;
    const p=place(x,z,.65+random()*.9);(z<-15?gold:grass).push(p);
  }
  // Near-track tufts make galloping through the world read at riding height.
  for(let s=0;s<LENGTH;s+=2)for(const side of [-1,1]){
    const q=at(s,side*(11.7+random()*2));if(waterDepth(q.x,q.z)<.02&&clear(q.x,q.z,.5))(q.z<0?gold:grass).push(place(q.x,q.z,.8+random()*.5));
  }
  plantInstances(group,moriche({seed:8,h:10}),palms,'Moriche groves','moriche');
  plantInstances(group,mangoTree({seed:12,h:3.2,fruit:false}),shade,'Hato shade trees','mangoTree');
  plantInstances(group,savannaGrass({seed:4,height:1.1}),grass,'Green savanna','savanna-grass');
  plantInstances(group,savannaGrass({seed:17,height:1.35,dry:true}),gold,'Golden savanna','savanna-grass');
  plantInstances(group,reeds({seed:12}),rushes,'Living wetland banks','reeds');
  plantInstances(group,waterLily({seed:9}),lilies,'Lagoon plants','waterLily');

  // Join the exact terrain perimeter to flat distant country. No visible square
  // edge and no decorative mountain ring in the Llanos. Studio frames the course.
  const ps=[],ix=[],colors=[],extent=180,N=144;
  const terrainColors=group.getObjectByName('Wadeable savanna').geometry.attributes.color;
  const boundary=[];
  for(let i=0;i<N;i++)boundary.push([-extent+i*extent*2/N,-extent]);
  for(let i=0;i<N;i++)boundary.push([extent,-extent+i*extent*2/N]);
  for(let i=0;i<N;i++)boundary.push([extent-i*extent*2/N,extent]);
  for(let i=0;i<N;i++)boundary.push([-extent,extent-i*extent*2/N]);
  for(const [x,z]of boundary){
    ps.push(x,groundAt(x,z),z,x*7,1.15,z*7);
    const i=Math.round((x+extent)/(extent*2)*N),j=Math.round((z+extent)/(extent*2)*N),k=j*(N+1)+i;
    for(let copy=0;copy<2;copy++)colors.push(terrainColors.getX(k),terrainColors.getY(k),terrainColors.getZ(k));
  }
  for(let i=0;i<boundary.length;i++){const a=i*2,b=((i+1)%boundary.length)*2;ix.push(a,b,a+1,a+1,b,b+1);}
  const horizon=new THREE.BufferGeometry();horizon.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));horizon.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));horizon.setIndex(ix);horizon.computeVertexNormals();
  const backdrop=new THREE.Mesh(horizon,M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1}));backdrop.name='Endless Llanos horizon';group.add(backdrop);
}
