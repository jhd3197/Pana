// The two fields, dressed from the shared model library: the barrio street
// (house fronts, the parked car, the lamp post, the señora's window, a kiosk
// and superbloques on the hills) and the block's blue court (chain-link,
// sponsors, bleachers and the towers around it). Both put the scoring
// objects exactly where field.js says they are; the scene adds the panas.
import * as THREE from 'three';
import { house } from '/engine/models/props/plaza-buildings.js';
import { streetlightPole, streetFoodKiosk, rooftopWaterTank, parkBench } from '/engine/models/props/pueblo.js';
import { iceCreamCart } from '/engine/models/props/ice-cream-cart.js';
import { streetMural } from '/engine/models/props/street-mural.js';
import { buntingLine } from '/engine/models/props/fiesta.js';
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { BASES, FIELD } from './field.js';
import { createStreetGround, createBlockCourt, createSenoraWindow, createChainFence, createBleachers, createSuperbloque, createAlcantarilla } from './studio-set.js';

// Where the jugadas happen: the storm drain by the right curb and the door
// a pana runs home through when the señora calls them to eat.
export const DRAIN = { x: 2.9, z: -3.2 }, DOOR = { x: -4.3, z: 2.2 };

const COLORS = [0xf2a65a, 0x7cc6a4, 0xf28bb0, 0xffd166, 0x8ecae6, 0xe76f51, 0xb5a1e0, 0xf4e285];
const wallZ = -FIELD.wall;

function placed(parent, object, x, z, angle = 0, y = 0) {
  object.position.set(x, y, z); object.rotation.y = angle; parent.add(object); return object;
}
// Scale a model so its height is `h` (a mural standing in for a 4 m wall).
function fitHeight(object, h) {
  const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3());
  if (size.y > 0) object.scale.multiplyScalar(h / size.y);
  return object;
}
// A house whose front stands exactly on a line: the model's own depth decides.
function frontAt(parent, object, x, z, angle) {
  object.rotation.y = angle; object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.set(x, 0, z);
  if (angle === 0) object.position.z = z - box.max.z;
  else if (angle > 0) object.position.x = x - box.max.x;
  else object.position.x = x - box.min.x;
  parent.add(object); return object;
}
function parkedCar(id, seed) {
  const car = CAR_BUILDERS[id](randomAvatar(rng(seed)));
  car.driver?.group && (car.driver.group.visible = false);
  return car;
}

// One field; the scene adds the panas, the señora included, at field.senora.
export function createField(map = 'calle') {
  const group = new THREE.Group(); group.name = map === 'cancha' ? 'La cancha del bloque' : 'La calle del barrio';
  const animated = [], random = rng(map === 'cancha' ? 77 : 41);
  const window = FIELD.window, windowX = (window.x0 + window.x1) / 2;
  if (map === 'cancha') buildCourt(group, animated, random); else buildStreet(group, animated, random);
  // Shared by both: the scoring car and lamp post, the señora's window.
  const c = FIELD.car, car = parkedCar('familiar', 9);
  car.root.rotation.y = Math.PI / 2; car.root.updateMatrixWorld(true);
  const carBox = new THREE.Box3().setFromObject(car.root), carSize = carBox.getSize(new THREE.Vector3());
  car.root.scale.setScalar(Math.min((c.x1 - c.x0) / carSize.x, c.h / carSize.y));
  placed(group, car.root, (c.x0 + c.x1) / 2, -(c.d0 + c.d1) / 2, Math.PI / 2);
  placed(group, streetlightPole(), FIELD.post.x, -FIELD.post.d, Math.PI);
  const win = createSenoraWindow(); win.position.set(windowX, window.y0 - 1.35, wallZ + .02); group.add(win);
  placed(group, createAlcantarilla(), DRAIN.x, DRAIN.z, 0, .005);
  // Superbloques on the hills behind, the Caracas skyline of the reel.
  [[-34, -78, .2], [6, -92, -.1], [42, -74, -.35], [-62, -48, .9], [64, -40, -1]].forEach(([x, z, a], i) => {
    placed(group, createSuperbloque({ floors: 10 + i % 3 * 2 }), x, z, a, 4 + i % 2 * 3);
  });
  // A chalk diamond on the street: home → 1st → 2nd → 3rd → home, the bases
  // as square bags turned on their corner, each with its number beside it.
  const chalk = new THREE.MeshBasicMaterial({ color: '#fffaf0', transparent: true, opacity: .8, depthWrite: false });
  const diamond = new THREE.Group(); diamond.name = 'Diamante de tiza'; group.add(diamond);
  const corners = [{ x: 0, z: 0 }, ...BASES, { x: 0, z: 0 }];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[i + 1], length = Math.hypot(b.x - a.x, b.z - a.z);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(.09, length), chalk);
    line.rotation.set(-Math.PI / 2, 0, Math.atan2(b.x - a.x, -(b.z - a.z)) * -1);
    line.position.set((a.x + b.x) / 2, .045, (a.z + b.z) / 2); line.renderOrder = 1; diamond.add(line);
  }
  const bases = BASES.map((spot, i) => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(.62, .06, .62), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 1 }));
    marker.name = `base-${i + 1}`; marker.position.set(spot.x, spot.y + .03, spot.z); marker.rotation.y = Math.PI / 4; group.add(marker);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#0e0b24'; ctx.lineWidth = 12; ctx.font = 'bold 92px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(String(i + 1), 64, 68); ctx.fillText(String(i + 1), 64, 68);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.75, .75), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    // The number sits on the street just inside the diamond, read from behind the plate.
    label.rotation.x = -Math.PI / 2; label.position.set(spot.x * .7, .05, spot.z + (i === 1 ? 1.15 : .3)); label.renderOrder = 1; diamond.add(label);
    return marker;
  });
  return {
    group, animated, bases, diamond,
    senora: { x: windowX, z: wallZ + .4, y: .25 },
    update(t) { for (const a of animated) a(t); },
    dispose() {
      // Models remove themselves when disposed: collect first, then free.
      const owned = []; group.traverse(o => { if (o !== group && o.userData.dispose) owned.push(o.userData.dispose); });
      owned.forEach(d => d()); disposeModel(group);
    },
  };
}

function buildStreet(group, animated, random) {
  group.add(createStreetGround({ acera: FIELD.acera, wall: FIELD.wall, side: FIELD.sideStreet }));
  // The house fronts closing the street, azotea roofs at the wall's height.
  [-14, -7, 0, 7, 14].forEach((x, i) => {
    const h = house({ w: 7, h: 4.3, seed: 11 + i * 3, color: COLORS[i], style: i % 2 ? 'terraza' : 'balcon' });
    fitHeight(h, FIELD.wallTop + .3); frontAt(group, h, x, wallZ, 0);
  });
  // The near street's houses, fronts on its sidewalks.
  for (const s of [-1, 1]) [2.2, -5].forEach((z, i) => {
    const h = house({ w: 7, h: 6.4, seed: 30 + i + (s > 0 ? 5 : 0), color: COLORS[(i * 2 + (s > 0 ? 3 : 0)) % COLORS.length], style: ['tienda', 'tejas', 'balcon', 'terraza'][(i + (s > 0 ? 2 : 0)) % 4] });
    frontAt(group, h, s * FIELD.sideStreet, z, s < 0 ? Math.PI / 2 : -Math.PI / 2);
  });
  // The cross street's corners and a back row for the skyline.
  for (const s of [-1, 1]) {
    const corner = house({ w: 7, h: 5.2, seed: 50 + s, color: COLORS[s > 0 ? 6 : 7], style: 'tienda', label: s > 0 ? 'ABASTO LA ESQUINA' : '' });
    frontAt(group, corner, s * 13.6, -18, s < 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  [-17.5, -6, 5.5, 17].forEach((x, i) => placed(group, house({ w: 8, h: 8.4, seed: 70 + i, color: COLORS[(i + 3) % COLORS.length], style: 'balcon' }), x, wallZ - 12));
  [-10.5, 3.5, 12].forEach((x, i) => placed(group, rooftopWaterTank(), x, wallZ - 3 - i % 2, i, FIELD.wallTop + .3));
  placed(group, streetFoodKiosk(), -9.6, -14.8, Math.PI / 2);
  placed(group, iceCreamCart(), 8.2, -13.6, -Math.PI / 2 + .3);
  placed(group, parkBench(), 6.6, -11.9, Math.PI);
  for (const z of [-3, -8]) { const line = buntingLine({ span: FIELD.sideStreet * 2, seed: Math.floor(random() * 99), height: 5 }); line.position.set(0, 0, z); line.rotation.y = Math.PI / 2; group.add(line); }
}

function buildCourt(group, animated, random) {
  group.add(createBlockCourt({ acera: FIELD.acera, wall: FIELD.wall, width: FIELD.crossStreet * 2 }));
  // Chain-link down both sides with sponsors, and the back wall: a painted
  // mural at the wall's height (over it is a jonrón).
  for (const s of [-1, 1]) {
    const fence = createChainFence({ length: 30, banners: 4, seed: s > 0 ? 2 : 0 });
    placed(group, fence, s * (FIELD.crossStreet + .2), -11, s < 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  [-8, 0, 8].forEach(x => { const mural = fitHeight(streetMural(), FIELD.wallTop); frontAt(group, mural, x, wallZ, 0); });
  const back = createChainFence({ length: 26, height: 3, banners: 3, seed: 1 }); placed(group, back, 0, 5.5, Math.PI);
  // The towers around the court, red and white like the reel.
  placed(group, createSuperbloque({ floors: 12 }), 0, -46);
  placed(group, createSuperbloque({ floors: 10 }), -30, -14, Math.PI / 2);
  placed(group, createSuperbloque({ floors: 11 }), 30, -16, -Math.PI / 2);
  // Bleachers on the left for the crowd.
  const stands = createBleachers({ length: 10 }); placed(group, stands, -12.4, -9, Math.PI / 2); group.userData.stands = stands;
  placed(group, iceCreamCart(), 11.6, -3, -Math.PI / 2);
  placed(group, streetFoodKiosk(), 12, -20, -Math.PI / 2);
  random();
}

// Seat points for the crowd: the bleachers on the court, the sidewalk corners
// on the street. [x, y, z, angle, seated]
export function crowdSpots(field, map) {
  const stands = field.group.userData.stands;
  if (map === 'cancha' && stands) {
    stands.updateMatrixWorld(true);
    return stands.userData.seats.filter((_, i) => i % 2 === 0).slice(0, 6).map(([x, y, z]) => {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(stands.matrixWorld); return [v.x, v.y, v.z, Math.PI / 2, true];
    });
  }
  return [[6.1, .76, -11.6, Math.PI, true], [7.1, .76, -11.6, Math.PI, true], [-7.4, 0, -12, Math.PI * .8, false], [-6.6, 0, -24.9, 0, false], [9.5, 0, -24.8, -.2, false]];
}
