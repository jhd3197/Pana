// Preserve the supplied prototypes' UVs, materials and every instance while
// combining static geometry. The ordinary paint batcher discards textured UVs
// and cannot expand an InstancedMesh, so it is unsuitable for these models.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function finishPrototype(root,name){
  root.updateMatrixWorld(true);
  const buckets=new Map(),originalGeometry=new Set(),originalMaterials=new Set();
  root.traverse(o=>{
    if(!o.isMesh)return;
    const material=o.material;
    if(Array.isArray(material))throw new Error('Prototype meshes must have one material');
    originalGeometry.add(o.geometry);originalMaterials.add(material);
    const textured=!!material.map;
    const key=[material.type,textured?material.map.uuid:'color',material.side,material.roughness,material.metalness,material.emissive?.getHex(),material.emissiveIntensity,material.transparent,material.opacity].join('|');
    if(!buckets.has(key)){
      const mat=material.clone();if(!textured){mat.color.set(0xffffff);mat.vertexColors=true;}
      buckets.set(key,{material:mat,geometry:[]});
    }
    for(let i=0;i<(o.isInstancedMesh?o.count:1);i++){
      const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(),matrix=o.matrixWorld.clone();
      if(o.isInstancedMesh){const instance=new THREE.Matrix4();o.getMatrixAt(i,instance);matrix.multiply(instance);}
      geo.applyMatrix4(matrix);
      for(const attr of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(attr))geo.deleteAttribute(attr);
      if(!geo.attributes.normal)geo.computeVertexNormals();
      if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
      if(!textured){
        const colors=new Float32Array(geo.attributes.position.count*3),color=material.color;
        for(let j=0;j<colors.length;j+=3){colors[j]=color.r;colors[j+1]=color.g;colors[j+2]=color.b;}
        geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
      }
      buckets.get(key).geometry.push(geo);
    }
  });
  const group=new THREE.Group(),textures=new Set(),materials=new Set();group.name=name;
  for(const {material,geometry}of buckets.values()){
    const object=new THREE.Mesh(mergeGeometries(geometry,false),material);object.castShadow=object.receiveShadow=true;group.add(object);
    geometry.forEach(g=>g.dispose());materials.add(material);if(material.map)textures.add(material.map);
  }
  originalGeometry.forEach(g=>g.dispose());originalMaterials.forEach(m=>m.dispose());
  let disposed=false;group.userData.prototype=true;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());};
  return group;
}
