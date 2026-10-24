// Rival panas as photographed cards. Loaded with import() at startup so the
// impostor baker stays out of the first load; racers made before it lands
// simply keep their real pana.
import * as THREE from 'three';
import { impostorPlacements } from '/engine/models/core/impostor.js';

export const DRIVER_CARD_FROM = 14;   // metres from a camera: closer, the real pana

// A rival's pana is a photographed card: its seated pose from eight sides,
// one quad riding the seat instead of ~30 meshes and ~39k triangles. The
// player's own pana stays real. The hidden group keeps its rig for disposal.
export function cardDriver(car) {
  const group = car.driver?.group, parent = group?.parent;
  if (!parent) return car;
  parent.updateMatrixWorld(true);
  const toParent = new THREE.Matrix4().copy(parent.matrixWorld).invert(), local = new THREE.Matrix4(), point = new THREE.Vector3();
  const source = new THREE.Group();
  group.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== parent; p = p.parent) if (!p.visible) return;
    const geometry = new THREE.BufferGeometry(), from = o.geometry.attributes.position, positions = new Float32Array(from.count * 3);
    // Freeze skinned or morphed surfaces in their current (seated) pose.
    for (let i = 0; i < from.count; i++) { o.getVertexPosition(i, point); point.toArray(positions, i * 3); }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (o.geometry.attributes.color) geometry.setAttribute('color', o.geometry.attributes.color.clone());
    if (o.geometry.index) geometry.setIndex(o.geometry.index.clone());
    geometry.computeVertexNormals();
    geometry.applyMatrix4(local.multiplyMatrices(toParent, o.matrixWorld));
    source.add(new THREE.Mesh(geometry, o.material));
  });
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

// Every drawn frame: the real pana near any camera, the card beyond. Returns
// whether the real one shows (and so needs animating).
export function showDriver(car, c, cameras) {
  const near = cameras.some(cam => cam && (cam.position.x - c.x) ** 2 + (cam.position.z - c.z) ** 2 < DRIVER_CARD_FROM ** 2);
  car.driverCard.visible = !near; car.driver.group.visible = near;
  return near;
}
