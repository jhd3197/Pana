import { THREE,M,box,sign,put,foundation,finish,clear,boat,placeOnTrack } from './world-kit.js';
import { colonialHouse, streetFoodKiosk, parkBench } from '/engine/models/props/pueblo.js';
import { divingSchool } from './world-landmarks.js';
import { coast,riverDistance } from './chichi-layout.js';

export function beachVillage(T,world){
  const group=new THREE.Group(),fixed=new THREE.Group(),occupied=[],colors=[0xe7bf83,0x92b4ac,0xdba28c,0xede0b5,0x81a4bc];group.name='chichi-beach-village';
  const add=(model,x,z,scale,radius,rotation=0)=>{occupied.push([x,z,radius+7]);return foundation(fixed,model,x,z,world.groundAt,{scale,radius,rotation});};
  const school=foundation(group,divingSchool(),-62,245,world.groundAt,{scale:1.65,radius:15});school.name='diving-school';occupied.push([-62,245,25]);
  for(let i=0;i<22;i++){
    const x=-210+i*20,z=coast(x)-(i%2?24:48);
    if(!clear(T,x,z,11)||riverDistance(x,z)<22)continue;
    add(colonialHouse({seed:13+i,color:colors[i%5]}),x,z,1.5,8,i%2?Math.PI:0);
  }
  for(const [x,z,rot] of [[-157,235,-.3],[-25,332,Math.PI],[224,255,1.1]]){
    if(clear(T,x,z,9))add(streetFoodKiosk(),x,z,1.6,7,rot);
  }
  for(let i=0;i<24;i++){
    const x=-230+i*20,z=coast(x)+30+(i%3)*16;
    put(fixed,boat(colors[i%5],{cabin:i%6===0}),x,z,.1,.6+Math.sin(i)*.7,i%6===0?1.5:1);
  }
  const wood=M(0x9c8261),dark=M(0x6a5e47);
  for(const x of [-92,28,205]){
    const z=coast(x)+7;fixed.add(box(4,.35,49,wood,x,1,z));
    for(let i=0;i<7;i++)for(const side of [-1.8,1.8])fixed.add(box(.3,4,.3,dark,x+side,-.7,z-23+i*8));
  }
  // Beach walk, shade sails and benches are on the sand, clear of the race line.
  for(let i=0;i<8;i++){
    const x=-150+i*39,z=coast(x)-8,y=world.groundAt(x,z);
    const shade=new THREE.Group(),roof=box(8,.14,6,M(i%2?0xe0c38d:0x709f9a),0,3.5,0);roof.rotation.z=.08;shade.add(roof);
    for(const a of [-3.6,3.6])for(const b of [-2.6,2.6])shade.add(box(.14,3.5,.14,dark,a,1.75,b));
    put(fixed,shade,x,z,y);put(fixed,parkBench(),x,z+1,y,Math.PI,1.4);
  }
  const p=placeOnTrack(T,T.paramOf(-120,275),-T.HW-5);
  put(fixed,sign(['CHI CHI','PLAYA · BUCEO · PESCADORES'],12,2.6,{background:'#297c83'}),p.x,p.z,p.y+3.6,p.h+Math.PI);
  for(const dx of [-5.5,5.5]){const a=placeOnTrack(T,T.paramOf(-120,275),-T.HW-5+dx);fixed.add(box(.18,4.8,.18,dark,a.x,a.y+2.4,a.z));}
  group.add(finish(fixed,180));return {group,occupied};
}

// Follow the curved road across the incised river, rather than burying the stream.
export function riverBridges(T){
  const g=new THREE.Group(),stone=M(0xaca993),cap=M(0xdbceb0);
  for(let s=0;s<T.TOTAL;s+=2.5){
    const p=placeOnTrack(T,s);if(riverDistance(p.x,p.z)>24)continue;
    const slab=box(T.HW*2+2,.7,2.7,stone,p.x,p.y-.4,p.z);slab.rotation.y=p.h;g.add(slab);
    for(const side of [-1,1]){
      const q=placeOnTrack(T,s,side*(T.HW+1));
      for(const [h,thickness,mat] of [[.45,.9,stone],[.95,.16,cap]]){
        const rail=box(.65,thickness,2.65,mat,q.x,q.y+h,q.z);rail.rotation.y=q.h;g.add(rail);
      }
      if(Math.round(s/2.5)%4===0)g.add(box(.8,7,.8,stone,q.x,q.y-3.5,q.z));
    }
  }const group=finish(g);group.name='chichi-river-bridges';return group;
}
