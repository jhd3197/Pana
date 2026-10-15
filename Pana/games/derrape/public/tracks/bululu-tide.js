// One absolute-time shoreline drives both the visible wash and car response.
import { THREE,M,box,sign,put,smooth,mix,placeOnTrack } from './world-kit.js';
import { waterSurface } from '/engine/water-surface.js';

export const TIDE_PERIOD=28;
export const TIDE_START=.665,TIDE_END=.805;
export const tideZone=(x,z)=>(1-smooth(Math.abs(x-12),75,145))*(1-smooth(z,-223,-175));
export const tideLevel=t=>smooth(.5-.5*Math.cos(t/TIDE_PERIOD*Math.PI*2),.12,.92);
export function tideFront(s,t,zone=1){
  const level=tideLevel(t);
  return mix(12,10.8-5.8*level+.25*level*Math.sin(s*.09-t*1.4),zone);
}
export function tideWetness(T,x,z,t=0){
  if(x<-145||x>165||z>-175||z<-300)return 0;
  const s=T.paramOf(x,z),p=T.pointAt(s),zone=tideZone(p.x,p.y);
  if(!zone||s<TIDE_START*T.TOTAL||s>TIDE_END*T.TOTAL)return 0;
  return smooth(Math.abs(T.offsetOf(x,z))-tideFront(s,t,zone),.15,1.4);
}

export function tidalCrossing(T){
  const group=new THREE.Group();group.name='tidal-sandbar';
  const rows=100,columns=8,positions=[],depths=[],flow=[],masks=[],indices=[],samples=[];
  for(let i=0;i<=rows;i++){
    const s=mix(TIDE_START,TIDE_END,i/rows)*T.TOTAL,p=placeOnTrack(T,s);
    samples.push({...p,s,zone:tideZone(p.x,p.z)});
  }
  for(const side of [-1,1])for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++){
    positions.push(0,0,0);depths.push(.02+j/columns*3.5);flow.push(0,0);
    masks.push(smooth(samples[i].zone,.02,.8)*(1-smooth(j/columns,.35,1)));
    if(i<rows&&j<columns){const n=(side===-1?0:(rows+1)*(columns+1))+i*(columns+1)+j;indices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);
  geo.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geo.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flow,2));
  geo.setAttribute('waterMask',new THREE.Float32BufferAttribute(masks,1));
  const wash=waterSurface(geo,{color:0x6dcac1,depth:1,amplitude:0,opacity:.86});wash.name='tidal-wash';wash.renderOrder=1;
  // Its outline moves across the sand; conservative bounds cover the whole cycle.
  wash.frustumCulled=false;wash.raycast=()=>{};group.add(wash);
  const buoys=[];
  for(const u of [.68,.72,.76,.79])for(const side of [-1,1]){
    const p=placeOnTrack(T,u*T.TOTAL,side*27),buoy=new THREE.Group();
    buoy.add(new THREE.Mesh(new THREE.CylinderGeometry(.38,.65,.7,10),M(side<0?0xe28458:0xf4d586)),box(.1,1.8,.1,M(0xe8e2c9),0,1,0));
    buoy.position.set(p.x,.3,p.z);group.add(buoy);buoys.push(buoy);
  }
  for(const u of [.65,.81]){
    const p=placeOnTrack(T,u*T.TOTAL,13.5),panel=sign('MAREA VARIABLE',9,1.7,{background:'#286f7d'});
    put(group,panel,p.x,p.z,p.y+3.2,p.h+Math.PI);
    group.add(box(.22,3.2,.22,M(0x9d8461),p.x,p.y+1.6,p.z));
  }
  function update(t){
    const pos=geo.attributes.position,uv=geo.attributes.waterFlow;let index=0;
    for(const side of [-1,1])for(const p of samples){
      const front=tideFront(p.s,t,p.zone);
      for(let j=0;j<=columns;j++){
        const off=mix(front,33,j/columns),x=p.x-Math.cos(p.h)*off*side,z=p.z+Math.sin(p.h)*off*side;
        const y=mix(p.y+.17,.025,smooth(off,T.HW+1,32));
        pos.setXYZ(index,x,y,z);uv.setXY(index,x,z);index++;
      }
    }
    pos.needsUpdate=true;uv.needsUpdate=true;wash.userData.tick(t);
    buoys.forEach((b,i)=>{b.position.y=.3+Math.sin(t*1.2+i)*.1;b.rotation.z=Math.sin(t*.8+i)*.055;});
  }
  update(0);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  group.userData.tide={period:TIDE_PERIOD,start:TIDE_START,end:TIDE_END};
  wash.userData.columns=columns;
  return {group,update};
}
