import {THREE,M,box,mesh,finish,sign} from './world-kit.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {reefFishSchool} from '/engine/models/fauna/aquatic/reef-fish-school.js';

// A submerged quay tunnel: continuous clear driving envelope, glazed sea walls,
// structural ribs and a real view of the sea surface and harbor piles outside.
export function puertoTunnel(T){
  const group=new THREE.Group(),solid=new THREE.Group(),windows=new THREE.Group();
  group.name='puerto-harbor-tunnel';
  const concrete=M(0x608e9e),trim=M(0x234c68,{metalness:.4}),light=M(0xc9f9ff,{emissive:0x48cbff,emissiveIntensity:1.1});
  const glazing=new THREE.MeshStandardMaterial({color:0x43bde5,emissive:0x126584,emissiveIntensity:.3,transparent:true,opacity:.28,roughness:.18,metalness:.1,side:THREE.DoubleSide,depthWrite:false});
  const half=T.HW+2,height=12.5,step=4;
  let windowCount=0;
  function slab(w,h,d,mat,x,y,z,heading){const o=box(w,h,d,mat,x,y,z);o.rotation.y=heading;solid.add(o);return o;}
  // Adjacent sections share their exact edge vertices. Rotated boxes left
  // triangular openings in the roof and windows on the tunnel's curves.
  function corners(p,q,h,k,y,y2,left,right,bottom,top){
    const at=(v,a,base,off,lift)=>[v.x+Math.cos(a)*off,base+lift,v.y-Math.sin(a)*off];
    return [at(p,h,y,left,bottom),at(p,h,y,right,bottom),at(q,k,y2,left,bottom),at(q,k,y2,right,bottom),
      at(p,h,y,left,top),at(p,h,y,right,top),at(q,k,y2,left,top),at(q,k,y2,right,top)];
  }
  function block(vertices,mat){
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));
    geo.setIndex([0,1,2,1,3,2,4,6,5,5,6,7,0,2,4,2,6,4,1,5,3,3,5,7,0,4,1,1,4,5,2,3,6,3,7,6]);
    geo.computeVertexNormals();solid.add(mesh(geo,mat));
  }
  for(let s=T.tunnel.s0;s<T.tunnel.s1;s+=step){
    const end=Math.min(s+step,T.tunnel.s1),p=T.pointAt(s),q=T.pointAt(end),a=T.pointAt(s+.1),b=T.pointAt(end+.1),
      h=Math.atan2(a.x-p.x,a.y-p.y),k=Math.atan2(b.x-q.x,b.y-q.y),y=T.heightAtS(s),y2=T.heightAtS(end);
    const section=(left,right,bottom,top,mat)=>block(corners(p,q,h,k,y,y2,left,right,bottom,top),mat);
    const glazed=p.x<-622;
    if(glazed){
      const vertices=corners(p,q,h,k,y,y2,-half,half,height,height);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices.slice(0,4).flat(),3));
      geo.setIndex([0,2,1,1,2,3]);geo.computeVertexNormals();windows.add(mesh(geo,glazing));
    }else section(-half-.5,half+.5,height,height+.8,concrete);
    // A chamfered rib frames the view without entering the driving envelope.
    if(Math.floor((s-T.tunnel.s0)/step)%3===0){
      const profile=[[-half+.4,5],[-half+.4,9.5],[-9.5,12.3],[9.5,12.3],[half-.4,9.5],[half-.4,5]];
      for(let i=1;i<profile.length;i++){
        const at=([off,lift])=>new THREE.Vector3(p.x+Math.cos(h)*off,y+lift,p.y-Math.sin(h)*off);
        const a=at(profile[i-1]),b=at(profile[i]),mid=a.clone().add(b).multiplyScalar(.5);
        const rib=box(.26,.26,a.distanceTo(b),light,mid.x,mid.y,mid.z);
        rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),b.sub(a).normalize());solid.add(rib);
      }
    }
    for(const side of [-1,1]){
      const edge=side*half;
      section(edge-.325,edge+.325,0,glazed?2.2:height,concrete);
      if(glazed){
        section(edge-.325,edge+.325,height-2,height,concrete);
        const vertices=corners(p,q,h,k,y,y2,edge,edge,2.2,height-2),geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute([vertices[0],vertices[2],vertices[4],vertices[6]].flat(),3));
        geo.setIndex([0,1,2,1,3,2]);geo.computeVertexNormals();windows.add(mesh(geo,glazing));windowCount++;
      }
      if(Math.floor((s-T.tunnel.s0)/step)%3===0)slab(.45,height,.45,trim,p.x+Math.cos(h)*side*(half-.4),y+height/2,p.y-Math.sin(h)*side*(half-.4),h);
      const inset=side*(half-.7);
      section(inset-.075,inset+.075,height-1.66,height-1.54,light);
      section(inset-.35,inset+.35,0,.45,trim);
      section(inset-.10,inset+.10,.46,.56,light);
    }
    if(glazed&&Math.floor(s/step)%5===0){
      const side=1,x=p.x-Math.cos(h)*side*(half+12),z=p.y+Math.sin(h)*side*(half+12);
      solid.add(mesh(new THREE.CylinderGeometry(1.2,1.5,27,10),M(0x738e82),x,-12,z));
      const footing=box(6,1.2,6,M(0x82978c),x,-24,z);solid.add(footing);
    }
  }
  const signs=[];
  // Flush wall boards are visible from inside; ordinary roadside posts are
  // farther out than the shell and become half-buried in the concrete.
  for(const u of [.008,.021,.038])for(const ds of [-9,0,9]){
    const s=u*T.TOTAL+ds,p=T.pointAt(s),q=T.pointAt(s+.5),prev=T.pointAt(s-6),next=T.pointAt(s+6);
    const h=Math.atan2(q.x-p.x,q.y-p.y),turn=(p.x-prev.x)*(next.y-p.y)-(p.y-prev.y)*(next.x-p.x);
    const side=turn>0?1:-1,off=side*(half-.75),board=new THREE.Group();
    board.position.set(p.x+Math.cos(h)*off,T.heightAtS(s)+3.1,p.y-Math.sin(h)*off);
    board.rotation.y=h-side*Math.PI/2;
    board.add(box(3.5,1.5,.08,trim,0,0,0));
    const shape=new THREE.Shape([[-.65,-.5],[0,-.5],[.65,0],[0,.5],[-.65,.5],[0,0]].map(([x,y])=>new THREE.Vector2(x,y)));
    // Local +X follows the road on one wall and opposes it on the other.
    const arrow=mesh(new THREE.ShapeGeometry(shape),M(0xffd65a,{emissive:0x9c610b,emissiveIntensity:.4,side:THREE.DoubleSide}),0,0,.06);
    arrow.scale.x=side;board.add(arrow);solid.add(board);
    signs.push({s,side,x:board.position.x,y:board.position.y,z:board.position.z});
  }
  group.userData.wallSigns=signs;
  for(const [s,label]of[[T.tunnel.s0,'TÚNEL DEL PUERTO'],[T.tunnel.s1,'TERMINAL · LA GUAIRA']]){
    const p=T.pointAt(s),q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y),y=T.heightAtS(s);
    for(const side of [-1,1])slab(2,height+2,2,trim,p.x-Math.cos(h)*side*(half+1),y+(height+2)/2,p.y+Math.sin(h)*side*(half+1),h);
    slab(half*2+4,2.2,2,trim,p.x,y+height+1,p.y,h);
    const name=sign([label],21,1.8,{background:'#304e54'});name.position.set(p.x,y+height+1,p.y);name.rotation.y=h+Math.PI;group.add(name);
  }
  windows.updateMatrixWorld(true);
  const panes=windows.children.map(o=>{const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);o.geometry.dispose();return geo;});
  const glass=new THREE.Mesh(mergeGeometries(panes,false),glazing);glass.name='harbor-tunnel-sea-windows';panes.forEach(g=>g.dispose());
  const schools=[];
  for(const [x,z,seed]of[[-690,215,75],[-638,252,76]]){
    const school=reefFishSchool({seed,count:4,radius:3.5});school.position.set(x,-9,z);school.scale.setScalar(2.4);group.add(school);schools.push(school);
  }
  group.add(finish(solid,Infinity),glass);group.userData.windows=windowCount;group.userData.length=T.tunnel.s1-T.tunnel.s0;
  group.userData.tick=t=>schools.forEach(s=>s.userData.tick(t));
  group.userData.dispose=()=>glazing.dispose();return group;
}
