// The playable grids stay untouched. Their exact boundary vertices join a
// coarser landscape beyond the longest race fog distance, without a skirt wall.
import * as THREE from 'three';
import { natureSurface } from '/engine/models/core/nature-surface.js';

function perimeter(nx,nz) {
  const edge=[];
  for(let x=0;x<=nx;x++)edge.push(x);
  for(let z=1;z<=nz;z++)edge.push(z*(nx+1)+nx);
  for(let x=nx-1;x>=0;x--)edge.push(nz*(nx+1)+x);
  for(let z=nz-1;z>0;z--)edge.push(z*(nx+1));
  return edge;
}

export function extendTerrain(land,{bounds,nx,nz,height,color,biome}) {
  const [x0,z0,x1,z1]=bounds,cx=(x0+x1)/2,cz=(z0+z1)/2;
  const edge=perimeter(nx,nz),bands=[0,45,110,230,440,800,1400,2400,3800];
  const source=land.geometry.attributes.position,sourceColors=land.geometry.attributes.color;
  const positions=[],colors=[],indices=[],c=new THREE.Color();
  for(const [layer,d]of bands.entries())for(const [i,index]of edge.entries()) {
    const sx=source.getX(index),sz=source.getZ(index),sy=source.getY(index);
    const length=Math.hypot(sx-cx,sz-cz),x=sx+(sx-cx)/length*d,z=sz+(sz-cz)/length*d;
    const rise=biome==='llanos'?8:biome==='plaza'?24:biome==='estadio'?34:0;
    // The savanna stays broad and low; no mountain wall around Los Llanos.
    const base=height(x,z),rolling=base>1?rise*(.5+.5*Math.sin(x*.0031+Math.cos(z*.0027)))*(.5+.5*Math.cos(z*.0041)):0;
    const blend=THREE.MathUtils.smoothstep(d,0,230),y=THREE.MathUtils.lerp(sy,base+rolling,blend);
    positions.push(x,layer?y:sy,z);
    if(!layer&&sourceColors)c.fromBufferAttribute(sourceColors,index);else c.set(color(x,z,y));
    colors.push(c.r,c.g,c.b);
    if(layer){const a=(layer-1)*edge.length+i,b=(layer-1)*edge.length+(i+1)%edge.length,n=edge.length;indices.push(a,b,a+n,b,b+n,a+n);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Copy the inner normals too: the coarse outer strip should not outline the grid.
  const normals=geometry.attributes.normal,innerNormals=land.geometry.attributes.normal;
  edge.forEach((index,i)=>normals.setXYZ(i,innerNormals.getX(index),innerNormals.getY(index),innerNormals.getZ(index)));
  if(land.geometry.attributes.natureSurface)natureSurface(geometry,'grass');
  const continuation=new THREE.Mesh(geometry,land.material);continuation.name=`${biome}-outer-landscape`;continuation.receiveShadow=true;
  continuation.userData.worldContinuation={edgeIndices:edge,bands:bands.length,bounds,reach:3800};
  // Locate a radial strip, then interpolate its real triangles. Placement and
  // water-depth queries must agree with the coarse mesh outside the old grid.
  // This is at most sixteen triangle checks, independent of the map's size.
  continuation.heightAt=(x,z)=>{
    const dx=x-cx,dz=z-cz,hx=(x1-x0)/2,hz=(z1-z0)/2;
    const sx=Math.abs(dx)/hx,sz=Math.abs(dz)/hz;if(Math.max(sx,sz)<1)return null;
    const t=1/Math.max(sx,sz),gx=(cx+dx*t-x0)/(x1-x0)*nx,gz=(cz+dz*t-z0)/(z1-z0)*nz;
    const u=sz>=sx?(dz<0?gx:nx+nz+nx-gx):(dx>0?nx+gz:2*nx+2*nz-gz);
    const n=edge.length,i=(Math.floor(u)%n+n)%n,j=(i+1)%n,p=geometry.attributes.position;
    const sample=(a,b,c)=>{
      const ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
      const wa=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,wb=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,wc=1-wa-wb;
      return wa>=-1e-5&&wb>=-1e-5&&wc>=-1e-5?wa*p.getY(a)+wb*p.getY(b)+wc*p.getY(c):null;
    };
    for(let layer=1;layer<bands.length;layer++){
      const a=(layer-1)*n+i,b=(layer-1)*n+j;
      const first=sample(a,b,a+n);if(first!==null)return first;
      const second=sample(b,b+n,a+n);if(second!==null)return second;
    }
    return null;
  };
  land.add(continuation);return continuation;
}

// Append far water without enlarging the coast's wave grid or depth texture.
// Identical edge positions and the same world-space shader keep the join quiet.
export function extendWaterPlane(geometry,{nx,nz,bounds}) {
  const edge=perimeter(nx,nz),p=geometry.attributes.position,positions=Array.from(p.array),indices=Array.from(geometry.index.array);
  geometry.computeBoundingBox();const {min,max}=geometry.boundingBox,n=p.count;
  for(const index of edge)positions.push(
    THREE.MathUtils.lerp(bounds[0],bounds[2],(p.getX(index)-min.x)/(max.x-min.x)),0,
    THREE.MathUtils.lerp(bounds[1],bounds[3],(p.getZ(index)-min.z)/(max.z-min.z)));
  for(let i=0;i<edge.length;i++){
    const j=(i+1)%edge.length,a=edge[i],b=edge[j];indices.push(a,b,n+i,b,n+j,n+i);
  }
  // Water shaders only need position/normal; old UV buffers have a shorter count.
  geometry.deleteAttribute('uv');geometry.deleteAttribute('normal');
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
