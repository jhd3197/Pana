import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const wood = ['#a76b37', '#bf8348', '#d59a58'].map(color =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
const iron = new THREE.MeshStandardMaterial({ color: '#403b36', roughness: 0.6, metalness: 0.3 });
const gold = new THREE.MeshStandardMaterial({ color: '#ffc83e', roughness: 0.35, metalness: 0.5, emissive: '#5b3000', flatShading: true });
const face = new THREE.MeshStandardMaterial({ color: '#ffe999', roughness: 0.45, metalness: 0.25, emissive: '#4a2800', flatShading: true });

// Vertex colours preserve wood/paint contrast in one draw per crate. The
// individual boards stay separate only in the short-lived fracture template.
const crateFinish = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 });
export function crateArt() {
  const pieces = new THREE.Group(), surfaces = [];
  function board(w,h,d,x,y,z,material){
    const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    part.position.set(x,y,z);part.castShadow=part.receiveShadow=true;pieces.add(part);
  }
  for(const side of [-1,1])for(let i=0;i<3;i++){
    board(1.6,.45,.11,0,-.49+i*.49,side*.75,wood[i]);
    board(.11,.45,1.4,side*.75,-.49+i*.49,0,wood[(i+1)%3]);
  }
  for(const x of [-.74,.74])for(const z of [-.74,.74])board(.14,1.6,.14,x,0,z,iron);
  for(let i=0;i<3;i++)board(.5,.1,1.6,-.52+i*.52,.77,0,wood[i]);
  pieces.updateMatrixWorld(true);
  function surface(geometry,color,matrix){
    const g=geometry.clone();
    if(matrix)g.applyMatrix4(matrix);
    const c=new THREE.Color(color),values=new Uint8Array(g.attributes.position.count*3);
    for(let i=0;i<values.length;i+=3){values[i]=Math.round(c.r*255);values[i+1]=Math.round(c.g*255);values[i+2]=Math.round(c.b*255);}
    g.deleteAttribute('uv'); // painted geometry has no texture coordinates to sample
    g.setAttribute('color',new THREE.BufferAttribute(values,3,true));surfaces.push(g);
  }
  for(const part of pieces.children)surface(part.geometry,part.material.color,part.matrix);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Matrix4();
  function badge(geo,color,y,z,angle){
    matrix.makeTranslation(0,y,z);rotation.makeRotationY(angle);matrix.premultiply(rotation);
    surface(geo,color,matrix);geo.dispose();
  }
  const polygon=points=>new THREE.ShapeGeometry(new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y))));
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
    // Painted fruit follows its own silhouette: no paper label over the wood.
    const mango=[[-.04,.31],[-.25,.20],[-.34,-.03],[-.28,-.24],[-.10,-.38],[.13,-.35],[.31,-.17],[.35,.06],[.23,.27]];
    badge(polygon(mango.map(([x,y])=>[x*1.16,y*1.12])),0x56361e,0,.813,angle);
    badge(polygon(mango),0xffb925,0,.817,angle);
    badge(polygon([[.23,.24],[.35,.06],[.31,-.17],[.13,-.35],[-.10,-.38],[.03,-.25],[.17,-.07]]),0xe77b1b,0,.820,angle);
    badge(polygon([[-.08,.22],[-.25,-.06],[-.17,-.16]]),0xffdb59,0,.823,angle);
    badge(polygon([[-.02,.28],[.07,.46],[.34,.48],[.23,.31],[.08,.27]]),0x285d30,0,.826,angle);
  }
  const geometry=mergeGeometries(surfaces,false);surfaces.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(geometry,crateFinish);mesh.castShadow=mesh.receiveShadow=true;
  const visual=new THREE.Group();visual.add(mesh);visual.name='wooden-item-crate';
  return {visual,pieces};
}

export function coinArt() {
  const g = new THREE.Group();
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.16, 12), gold);
  edge.rotation.x = Math.PI / 2;
  g.add(edge);
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 4, 12), face);
    ring.position.z = side * 0.09;
    g.add(ring);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.46, 0.025), face);
    mark.position.z = side * 0.09;
    g.add(mark);
  }
  g.name = 'collectible-coin';
  return g;
}
