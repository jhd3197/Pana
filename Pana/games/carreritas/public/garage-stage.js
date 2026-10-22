// Studio lighting for the garage turntable, its car cards and portraits: a
// procedural PMREM room (dark violet floor, soft light boxes) so paint and
// chrome have something to reflect, plus a warm key and violet/cyan rims.
// The race scenes never use this environment, so race lighting is unchanged.
import * as THREE from 'three';

const cache = new WeakMap();
export function studioEnvironment(renderer) {
  if (cache.has(renderer)) return cache.get(renderer);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; gl_FragColor = vec4(mix(vec3(0.05, 0.03, 0.09), vec3(0.32, 0.28, 0.42), smoothstep(-0.2, 0.9, h)), 1.0); }',
  })));
  const panel = (color, w, h, at) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 2, 0);
    room.add(m);
  };
  panel(0x9c98a8, 30, 8, [0, 22, 0]);
  panel(0x8a7fa6, 6, 18, [-24, 6, 6]);
  panel(0x6e98a6, 6, 18, [22, 6, -10]);
  panel(0xa08890, 18, 3, [0, 4, 26]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  room.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  cache.set(renderer, texture);
  return texture;
}

// Warm key from the front, violet and cyan rims behind: added to a scene.
export function studioRims(scene, scale = 1) {
  const violet = new THREE.DirectionalLight(0xa58bff, 1.1 * scale);
  violet.position.set(-8, 3, -5);
  const cyan = new THREE.DirectionalLight(0x56d8ff, 0.8 * scale);
  cyan.position.set(8, 2, -6);
  scene.add(violet, cyan);
  return [violet, cyan];
}

// Showroom paint: the turntable car's body panels get a clearcoat (garage
// only; race cars keep their plain shared materials).
const clearcoats = new Map();
export function showroomPaint(car) {
  const hex = car.paint?.color.getHex();
  if (hex == null) return car;
  const skip = new Set();
  car.driver?.group.traverse(o => skip.add(o));
  car.root.traverse(o => {
    const m = o.material;
    if (!o.isMesh || skip.has(o) || !m?.isMeshStandardMaterial || m.isMeshPhysicalMaterial) return;
    if (m.color.getHex() !== hex && m !== car.paint) return;
    if (!clearcoats.has(m.uuid)) {
      const coat = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(coat, m);
      coat.clearcoat = m.roughness > 0.7 ? 0.1 : 0.75;
      coat.clearcoatRoughness = 0.12;
      clearcoats.set(m.uuid, coat);
    }
    o.material = clearcoats.get(m.uuid);
  });
  return car;
}

// Cached paints are shared, but each showroom model owns its meshes and decals.
export function releaseShowroom(car) {
  car.root.removeFromParent();
  const geometry=new Set(),materials=new Set();
  car.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of [].concat(o.material||[]))if(m.userData.ownedMap)materials.add(m);});
  car.driver?.dispose();geometry.forEach(g=>g.dispose());
  materials.forEach(m=>{m.map?.dispose();m.dispose();});
}
