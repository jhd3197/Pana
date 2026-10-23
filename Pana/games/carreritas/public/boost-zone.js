import * as THREE from 'three';

// Roadside arrows face approaching drivers; the playable strip owns the boost.
// Keep the luminous silhouette at low quality without expensive bloom passes.
export function boostZone(T,a,w,l){
  const group=new THREE.Group();group.name='featured-boost-zone';
  const mat=new THREE.MeshBasicMaterial({color:0xa0ffb9,side:THREE.DoubleSide});
  const shape=new THREE.Shape();
  shape.moveTo(-.65,0);shape.lineTo(.1,0);shape.lineTo(1.2,1.2);shape.lineTo(.1,2.4);shape.lineTo(-.65,2.4);shape.lineTo(.45,1.2);shape.closePath();
  const geo=new THREE.ShapeGeometry(shape);
  const haloMat=new THREE.MeshBasicMaterial({color:0x54ff99,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide});
  for(const side of [-1,1])for(const along of [-l/2,0,l/2]){
    const x=a.x+Math.sin(a.h)*along+Math.cos(a.h)*side*(w/2+2.1);
    const z=a.z+Math.cos(a.h)*along-Math.sin(a.h)*side*(w/2+2.1);
    const arrow=new THREE.Mesh(geo,mat);arrow.position.set(x,T.groundAt(x,z)+.6,z);
    // Inward-pointing chevrons frame the lane from the approach.
    arrow.rotation.y=a.h+(side<0?0:Math.PI);
    const halo=new THREE.Mesh(geo,haloMat);halo.scale.setScalar(1.24);halo.position.set(-.05,-.25,-.03);arrow.add(halo);group.add(arrow);
  }
  group.userData.dispose=()=>{geo.dispose();mat.dispose();haloMat.dispose();};
  return group;
}
