// Rivals drawn by distance: their pana as a photographed card, and far away
// their whole car as one merged mesh. Loaded with import() at startup so the
// impostor baker stays out of the first load; racers made before it lands
// simply stay fully detailed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { impostorPlacements, snapshot } from '/engine/models/core/impostor.js';

export const DRIVER_CARD_FROM = 14;   // metres from a camera: closer, the real pana
export const CAR_FAR_FROM = 35;       // metres from every camera: farther, one mesh
const FAR_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 });

// A rival's pana is a photographed card: its seated pose from eight sides,
// one quad riding the seat instead of ~30 meshes and ~39k triangles. The
// player's own pana stays real. The hidden group keeps its rig for disposal.
export function cardDriver(car) {
  const group = car.driver?.group, parent = group?.parent;
  if (!parent) return car;
  const source = snapshot(group, parent);
  if (!source.children.length) return car;
  const center = new THREE.Box3().setFromObject(source).getCenter(new THREE.Vector3());
  source.children.forEach(m => m.geometry.translate(-center.x, 0, -center.z));
  const [card] = impostorPlacements(parent, source, [{ x: center.x, y: 0, z: center.z, rot: 0, scale: 1 }],
    { name: 'driver-card', tile: 128, elevations: [0, 35].map(THREE.MathUtils.degToRad) });
  group.visible = false; car.driverCard = card;
  return car;
}

// A pana-shaped stand-in for a rival's lancha or avioneta: the car's card,
// re-hung so the vessel's own seat position and scale apply, with no second
// pana sculpted (~300 ms each). The card's atlas belongs to the car.
export function cardStandIn(car) {
  const card = car.driverCard, seat = car.driver?.group;
  if (!card || !seat) return null;
  const group = new THREE.Group(), frame = new THREE.Group();
  seat.updateMatrix(); frame.matrixAutoUpdate = false; frame.matrix.copy(seat.matrix).invert();
  frame.add(new THREE.Mesh(card.geometry, card.material)); group.add(frame);
  return { group, arms: null, update() {}, dispose() {} };
}

// A distant rival's body and wheels as one vertex-coloured mesh in their
// resting pose: one draw and one shadow instead of 60–130. It hangs on the
// tumble's inner group so flips carry it. The pana's card, detachable parts,
// danglers, the flag and transparent glass stay as they are.
export function farCar(car) {
  const inner = car.tumble?.children[0];
  if (!inner) return car;
  const skip = new Set(), parts = [], geometries = [], tint = new THREE.Color(), glow = new THREE.Color(), local = new THREE.Matrix4();
  for (const kept of [car.driver?.group, car.driverCard, car.flag, ...car.detachables, ...car.danglers]) kept?.traverse(o => skip.add(o));
  car.root.updateMatrixWorld(true);
  const toInner = inner.matrixWorld.clone().invert();
  inner.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || skip.has(o)) return;
    for (let p = o; p && p !== inner; p = p.parent) if (!p.visible) return;
    const m = [].concat(o.material)[0];
    if (m.transparent) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.morphAttributes = {};
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    // Exact linear colours per vertex, as batchRacer stores them; lamps keep
    // their glow as brightness since the merged mesh has no emissive.
    const source = m.vertexColors ? g.attributes.color : null, count = g.attributes.position.count, values = new Float32Array(count * 3);
    tint.set(1, 1, 1); if (m.color) tint.copy(m.color);
    glow.set(0, 0, 0); if (m.emissive) glow.copy(m.emissive).multiplyScalar(m.emissiveIntensity ?? 1);
    for (let i = 0; i < count; i++) {
      values[i * 3] = tint.r * (source ? source.getX(i) : 1) + glow.r;
      values[i * 3 + 1] = tint.g * (source ? source.getY(i) : 1) + glow.g;
      values[i * 3 + 2] = tint.b * (source ? source.getZ(i) : 1) + glow.b;
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(values, 3));
    geometries.push(g.applyMatrix4(local.multiplyMatrices(toInner, o.matrixWorld))); parts.push(o);
  });
  const merged = geometries.length && mergeGeometries(geometries, false);
  geometries.forEach(g => g.dispose());
  if (!merged) return car;
  const mesh = new THREE.Mesh(merged, FAR_MATERIAL);
  mesh.name = 'rival-far'; mesh.castShadow = mesh.receiveShadow = true; mesh.visible = false;
  inner.add(mesh);
  car.far = { mesh, parts, on: false };
  return car;
}

// Every drawn frame, for a rival: the real pana near any camera and the card
// beyond; the merged car once every camera is far and it is on wheels.
// Returns whether the real pana shows (and so needs animating).
export function showRival(car, c, cameras) {
  let nearest = Infinity;
  for (const cam of cameras) if (cam) nearest = Math.min(nearest, (cam.position.x - c.x) ** 2 + (cam.position.z - c.z) ** 2);
  const near = nearest < DRIVER_CARD_FROM ** 2;
  if (car.driverCard) { car.driverCard.visible = !near; car.driver.group.visible = near; }
  const far = !!car.far && nearest > CAR_FAR_FROM ** 2 && !c.boat && !c.plane;
  if (car.far && far !== car.far.on) {
    car.far.on = far; car.far.mesh.visible = far;
    for (const part of car.far.parts) part.visible = !far;
  }
  return near || !car.driverCard;
}
