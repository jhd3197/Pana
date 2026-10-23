// Small game-local pieces shared by the ranch and canyon journeys.
import {THREE,M,mesh,box,tube,sign,finish,put,placeOnTrack} from './world-kit.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { reflectorPost } from '/engine/models/props/wood-sign.js';

export function grassTuft(color=0xb2ad61){
  const vertices=[],colors=[],c=new THREE.Color(color),dark=c.clone().multiplyScalar(.72);
  for(let i=0;i<7;i++){
    const a=i*2.4,x=Math.sin(a)*.45,z=Math.cos(a)*.45,h=.55+(i%3)*.19,dx=Math.cos(a)*.13,dz=-Math.sin(a)*.13;
    vertices.push(x-dx,0,z-dz,x+dx,0,z+dz,x+Math.sin(a)*.26,h,z+Math.cos(a)*.26);
    for(const col of [dark,dark,c])colors.push(col.r,col.g,col.b);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  return mesh(geo,M(0xffffff,{vertexColors:true,side:THREE.DoubleSide,roughness:1}));
}

export function entrance(T,s,text,{color='#6d5940',width=T.HW*2+4}={}){
  const root=new THREE.Group(),wood=M(0x69543d),stone=M(0xc5b393),p=placeOnTrack(T,s);
  for(const x of [-width/2,width/2]){root.add(box(.45,7,.45,wood,x,3.5,0),box(.9,.6,.9,stone,x,.3,0));root.add(tube([x,5,0],[x-Math.sign(x)*1.7,7,0],.11,wood));}
  root.add(box(width+1,.32,.38,wood,0,7,0));const panel=sign(text,width*.65,1.6,{background:color});panel.rotation.y=Math.PI;panel.position.set(0,6.7,-.22);root.add(panel);
  const back=sign(text,width*.65,1.6,{background:color});back.position.set(0,6.7,.22);root.add(back);
  return put(new THREE.Group(),finish(root),p.x,p.z,p.y,p.h);
}

// Author a swept deck under the physical road, with side rails outside the lanes.
export function crossing(T,accept,{name='country-bridge',color=0xa49c82,wood=false}={}){
  const root=new THREE.Group(),deck=M(color),rail=M(wood?0x78634c:0xc6c2a6),posts=M(wood?0x574c3a:0x797c73);
  for(let s=0;s<T.TOTAL;s+=2.5){
    const p=placeOnTrack(T,s);if(!accept(p,s))continue;
    const slab=box(T.HW*2+2.2,.65,2.75,deck,p.x,p.y-.36,p.z);slab.rotation.y=p.h;root.add(slab);
    for(const side of [-1,1]){
      const a=placeOnTrack(T,s,side*(T.HW+1)),b=placeOnTrack(T,s+2.5,side*(T.HW+1));
      for(const y of [.5,1.05])root.add(tube([a.x,a.y+y,a.z],[b.x,b.y+y,b.z],wood?.065:.09,rail));
      if(Math.floor(s/2.5)%2===0)root.add(box(.22,1.25,.22,posts,a.x,a.y+.6,a.z));
      if(Math.floor(s/2.5)%4===0)root.add(box(.65,8,.65,posts,a.x,a.y-4.15,a.z));
    }
  }
  const out=finish(root);out.name=name;return out;
}

// Library delineators (reflector-post), instanced along both verges.
export function vergePosts(T,{skip=()=>false,color=0xe5d7a5,step=16}={}){
  const root=new THREE.Group(),points=[];root.name='verge-posts';
  for(let s=0;s<T.TOTAL;s+=step){if(skip(s))continue;for(const side of [-1,1]){
    const p=placeOnTrack(T,s,side*(T.HW+1.6));points.push({x:p.x,y:p.y,z:p.z,rot:p.h});
  }}
  instancePlacements(root,reflectorPost({body:color,band:0xb26442}),points,{name:'verge-posts',cellSize:Infinity});
  return root;
}

// The same authored road receives sand/gravel shoulders. Its wheel ruts are
// painted into the road texture (road-material.js).
// All detail stays below the tested car clearance and follows elevation exactly.
export function dirtVerge(T,{shoulder=0xbd995d,skip=()=>false}={}){
  const root=new THREE.Group();
  for(const [lo,hi,color]of [[-T.HW-2,-T.HW,shoulder],[T.HW,T.HW+2,shoulder]]){
    const vertices=[],indices=[],n=Math.ceil(T.TOTAL/3);
    for(let i=0;i<=n;i++){const s=i/n*T.TOTAL,wiggle=Math.sin(s*.13)*.08;
      for(const off of [lo+wiggle,hi+wiggle]){const q=placeOnTrack(T,s,off);vertices.push(q.x,q.y+.135,q.z);}
      if(i<n&&!skip(s)){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();root.add(mesh(geo,M(color,{roughness:1,side:THREE.DoubleSide})));
  }const out=finish(root);out.name='country-road-shoulders';return out;
}
