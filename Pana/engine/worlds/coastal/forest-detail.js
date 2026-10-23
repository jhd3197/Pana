import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Distances are world metres from the nearest driveable route, not the
// current camera. Fixed planting zones avoid popping as racers pass bends.
export function forestZone(roadDistance, roadHalfWidth=8) {
  const near=roadHalfWidth*2.75, far=Math.max(70,near*2);
  return roadDistance <= near ? 'near' : roadDistance <= far ? 'middle' : 'far';
}

// Only dense stands hide their stems. Keep a cheap trunk on isolated trees
// so a distant crown never appears to float above an otherwise empty slope.
export function denseForest(placements, radius=20) {
  const cells=new Map(), dense=new Set();
  for(const p of placements){
    const key=`${Math.floor(p.x/radius)},${Math.floor(p.z/radius)}`;
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);
  }
  for(const p of placements){
    const x=Math.floor(p.x/radius),z=Math.floor(p.z/radius);let neighbors=0;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
      for(const q of cells.get(`${x+dx},${z+dz}`)||[])
        if(q!==p&&(q.x-p.x)**2+(q.z-p.z)**2<radius*radius)neighbors++;
    if(neighbors>=3)dense.add(p);
  }
  return dense;
}

// The far forest keeps the native crown's outline and colors, but replaces
// individual leaves with a solid hull. Hidden trunks contribute no geometry.
// Twenty-six extreme points bound the cost independently of leaf count.
function crownSilhouette(model, keepTrunk) {
  const remove = [], directions = [];
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
    if(x||y||z)directions.push(new THREE.Vector3(x,y,z).normalize());
  model.traverse(o => {
    if(!o.isMesh)return;
    const source=o.geometry, p=source.attributes.position, mask=source.attributes.natureSurface;
    const colors=source.attributes.color, extremes=directions.map(()=>({dot:-Infinity,index:-1}));
    for(let i=0;i<p.count;i++) {
      const kind=mask?.getX(i)??0;
      if(kind<.6||kind>.75)continue;
      for(let j=0;j<directions.length;j++) {
        const d=directions[j], dot=p.getX(i)*d.x+p.getY(i)*d.y+p.getZ(i)*d.z;
        if(dot>extremes[j].dot)extremes[j]={dot,index:i};
      }
    }
    const ids=[...new Set(extremes.map(e=>e.index))].filter(i=>i>=0);
    if(ids.length<4){
      if(keepTrunk&&mask&&Array.from(mask.array).some(v=>v>0))simplifyCanopy(o,2,.3);
      else remove.push(o);
      return;
    }
    const points=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
    const geometry=new ConvexGeometry(points), out=geometry.attributes.position, tint=[];
    const point=new THREE.Vector3();
    for(let i=0;i<out.count;i++) {
      point.fromBufferAttribute(out,i);
      let nearest=0, distance=Infinity;
      points.forEach((v,j)=>{const d=v.distanceToSquared(point);if(d<distance){distance=d;nearest=j;}});
      const n=ids[nearest];
      tint.push(colors?.getX(n)??1,colors?.getY(n)??1,colors?.getZ(n)??1);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(tint,3));
    geometry.setAttribute('natureSurface',new THREE.BufferAttribute(new Uint8Array(out.count).fill(170),1,true));
    geometry.deleteAttribute('normal');
    const smooth=mergeVertices(geometry);smooth.computeVertexNormals();geometry.dispose();
    source.dispose();o.geometry=smooth;
  });
  for(const o of remove){o.geometry.dispose();o.removeFromParent();}
  return model;
}

export function prepareForestModel(model, zone, {fronds=false, pine=false, dense=true}={}) {
  if(zone==='near')return model;
  if(zone==='middle')return simplifyCanopy(model,1.05,.12);
  // A lone palm's trunk and separated fronds remain part of its silhouette.
  // Pines retain their tiered outline rather than becoming one broad crown.
  if(fronds||pine)return simplifyCanopy(model,pine?2:1.5,.3);
  return crownSilhouette(model,!dense);
}

// Vertex clustering reduces the existing library mesh, retaining its crown
// outline and colors. Far hills need silhouettes, not thousands of leaflets.
export function simplifyCanopy(model, cell = 1.05, trunkCell = .12) {
  model.traverse(o => {
    if (!o.isMesh) return;
    const source=o.geometry, p=source.attributes.position, color=source.attributes.color, surface=source.attributes.natureSurface;
    const clusters=new Map(), mapping=[], vertices=[], colors=[], surfaces=[], index=[];
    for(let i=0;i<p.count;i++) {
      // Keep a narrow trunk's cross-section: coarse foliage cells would
      // otherwise collapse a distant palm trunk into an invisible line.
      const kind=surface?.getX(i)||0, radial=kind>.99?Math.min(cell,trunkCell):cell;
      const key=[Math.round(p.getX(i)/radial),Math.round(p.getY(i)/cell),Math.round(p.getZ(i)/radial),kind].join(',');
      if(!clusters.has(key)) {
        clusters.set(key,vertices.length/3);
        vertices.push(p.getX(i),p.getY(i),p.getZ(i));
        surfaces.push(kind);
        if(color)colors.push(color.getX(i),color.getY(i),color.getZ(i));
      }
      mapping.push(clusters.get(key));
    }
    const count=source.index?.count??p.count, faces=new Set();
    for(let i=0;i<count;i+=3){
      const a=mapping[source.index?source.index.getX(i):i],b=mapping[source.index?source.index.getX(i+1):i+1],c=mapping[source.index?source.index.getX(i+2):i+2];
      if(a!==b&&a!==c&&b!==c){
        const face=[a,b,c].sort((x,y)=>x-y).join(',');
        if(!faces.has(face)){faces.add(face);index.push(a,b,c);}
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    if(color)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    if(surface)geometry.setAttribute('natureSurface',new THREE.Float32BufferAttribute(surfaces,1));
    geometry.setIndex(index);geometry.computeVertexNormals();source.dispose();o.geometry=geometry;
  });
  return model;
}

