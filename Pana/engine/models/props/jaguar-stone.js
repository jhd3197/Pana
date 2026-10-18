// Temple carvings of the jaguar: a seated statue on a stepped plinth and a
// low-relief lintel panel. Small and weathered on purpose; a temple gets one
// quiet carving among its ruins, never a giant glowing-eyed gate. Metres, +Y
// up, origin on the ground (statue) or at the slab's bottom centre (relief).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';
import { jaguarForm, sitPose } from '/engine/models/fauna/jaguar.js';

const at = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
function painted(geometry, matrix, colour) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, colors = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { colour(c, n.getX(i), n.getY(i), n.getZ(i), p.getY(i)); colors.set([c.r, c.g, c.b], i * 3); }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry.applyMatrix4(matrix);
}

// Weathered stone: darker in the hollows, a little moss on what faces the sky.
function stonePainter(stone, moss, random) {
  const base = new THREE.Color(stone), deep = base.clone().multiplyScalar(.72), green = new THREE.Color(0x5d7a3e);
  return (c, nx, ny, nz, y) => {
    c.copy(base).lerp(deep, Math.max(0, -ny) * .6 + random() * .12);
    if (moss && ny > .45) c.lerp(green, (ny - .45) * random() * 1.3);
  };
}

// A seated jaguar carved in stone on a stepped plinth, about 1.7 m tall in all.
// Jade inlay eyes, no glow. Static: no tick.
export function jaguarStatue({ seed = 11, stone = 0x948b74, moss = true, scale = .8, plinth = true } = {}) {
  const random = rng(seed), colour = stonePainter(stone, moss, random);
  const rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const jade = new THREE.MeshStandardMaterial({ color: 0x3f9b78, roughness: .35 });
  const skin = { coat: rock, limbs: rock, head: rock, dark: rock, eye: jade, colour };
  const cat = jaguarForm(skin, seed);
  sitPose(cat, 0); cat.head.rotation.y = 0; cat.head.rotation.x = .3;
  const group = new THREE.Group(); group.name = 'Jaguar de piedra';
  const geometries = [...cat.geometries], base = plinth ? .62 : 0;
  cat.group.scale.setScalar(scale); cat.group.position.y = base; group.add(cat.group);
  if (plinth) {
    const parts = [[new THREE.BoxGeometry(1.25, .3, 1.5), at(0, .15, -.2)], [new THREE.BoxGeometry(1.05, .32, 1.3), at(0, .46, -.2)],
      // A plain carved band and step-fret blocks round the upper step.
      ...Array.from({ length: 6 }, (_, i) => [new THREE.BoxGeometry(.1, .08, .04), at(-.42 + i * .17, .46, .46)])];
    const merged = mergeGeometries(parts.map(([g, m]) => painted(g.toNonIndexed(), m, colour)));
    parts.forEach(([g]) => g.dispose()); geometries.push(merged);
    const m = new THREE.Mesh(merged, rock); m.castShadow = m.receiveShadow = true; group.add(m);
  }
  group.userData = { assetId: 'jaguar-statue', footprintRadius: .9, previewBounds: [[-.7, 0, -1.1], [.7, base + 1.15 * scale + .2, .8]] };
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; geometries.forEach(g => g.dispose()); rock.dispose(); jade.dispose(); };
  return group;
}

// Side view of a walking jaguar, nose at +x, paws on y = 0, about 1 × .47:
// heavy shoulders, big head, short legs and a tail curling up at the tip.
const PROFILE = [
  [-.5, .42], [-.47, .45], [-.44, .42], [-.42, .33], [-.38, .3], [-.3, .33], [-.12, .35], [.1, .37], [.2, .36],
  [.24, .41], [.26, .45], [.285, .47], [.3, .44], [.36, .43], [.42, .4], [.47, .36], [.48, .33], [.46, .3],
  [.42, .29], [.4, .26], [.33, .25], [.27, .24], [.22, .2], [.24, .08], [.27, .04], [.31, .02], [.31, 0],
  [.19, 0], [.16, .06], [.14, .15], [0, .16], [-.15, .16], [-.2, .17], [-.16, .08], [-.14, .04], [-.11, .02],
  [-.11, 0], [-.24, 0], [-.27, .07], [-.33, .18], [-.36, .26], [-.4, .27], [-.45, .36], [-.49, .39],
];
const ROSETTES = [[-.27, .27], [-.17, .28], [-.06, .29], [.05, .3], [.14, .3], [-.22, .21], [-.11, .21], [0, .22], [.1, .23]];

// A carved stone panel: a jaguar in low relief inside a raised frame,
// rosettes as shallow drilled rings, a step-fret band below. Origin at the
// bottom centre of the slab, carving facing +Z. Set it in a wall or across
// two pillars as a lintel.
export function jaguarRelief({ width = 2.4, height = 1.1, depth = .4, seed = 13, stone = 0x9a907a, moss = true } = {}) {
  const random = rng(seed), carved = stonePainter(stone, moss, random);
  // The recessed field reads darker than the carving standing out of it.
  const field = stonePainter(new THREE.Color(stone).multiplyScalar(.8).getHex(), false, random);
  const rock = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const parts = [];
  const add = (geometry, matrix, paint = carved) => parts.push([geometry.index ? geometry.toNonIndexed() : geometry, matrix, paint]);
  const face = depth / 2, rim = .08, band = height * .2, raised = .05;
  add(new THREE.BoxGeometry(width, height, depth), at(0, height / 2, 0), field);
  // Raised frame round the carving.
  add(new THREE.BoxGeometry(width, rim, raised), at(0, height - rim / 2, face + raised / 2));
  add(new THREE.BoxGeometry(width, rim, raised), at(0, band + rim / 2, face + raised / 2));
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(rim, height - band - rim * 2, raised), at(s * (width - rim) / 2, (height + band) / 2, face + raised / 2));
  // Step-fret band under the frame.
  const frets = Math.max(4, Math.round(width / .3)), pitch = width / frets;
  for (let i = 0; i < frets; i++) {
    const x = -width / 2 + (i + .5) * pitch;
    add(new THREE.BoxGeometry(pitch * .62, band * .32, .04), at(x, band * .3, face + .02));
    add(new THREE.BoxGeometry(pitch * .24, band * .3, .04), at(x + pitch * .19, band * .62, face + .02));
  }
  // The jaguar, fitted into the field.
  const fieldW = width - rim * 2 - .12, fieldH = height - band - rim * 2 - .06;
  const k = Math.min(fieldW, fieldH / .47), base = band + rim + (fieldH - .47 * k) / 2 + .03;
  const shape = new THREE.Shape(PROFILE.map(([x, y]) => new THREE.Vector2(x * k, y * k)));
  add(new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: true, bevelThickness: .02, bevelSize: .012, bevelSegments: 1 }), at(0, base, face));
  for (const [x, y] of ROSETTES) add(new THREE.TorusGeometry(.024 * k, .006 * k, 4, 10), at((x + (random() - .5) * .02) * k, base + y * k, face + .072));
  add(new THREE.SphereGeometry(.014 * k, 6, 4), at(.39 * k, base + .385 * k, face + .07));
  const merged = mergeGeometries(parts.map(([g, m, paint]) => painted(g, m, paint)));
  parts.forEach(([g]) => g.dispose());
  const group = new THREE.Group(); group.name = 'Relieve del jaguar';
  const m = new THREE.Mesh(merged, rock); m.castShadow = m.receiveShadow = true; group.add(m);
  group.userData = { assetId: 'jaguar-relief', previewBounds: [[-width / 2, 0, -depth / 2], [width / 2, height, depth / 2 + .15]] };
  let disposed = false;
  group.userData.dispose = () => { if (disposed) return; disposed = true; merged.dispose(); rock.dispose(); };
  return group;
}
