// Dresses a built pana in the explorer suit from suit-look.js: the fur body is
// hidden and the suit takes its place on the same bones, so every pose, squash
// and stagger still applies. Only the head stays, inside a glass dome.
//
// Per suit: one merged mesh each for the torso, two arms, two legs and the
// helmet's hard parts, plus the glass and the lamp's lens. Fewer draws than the
// meshes it hides. No lights: the headlamp and the light pool stay as they are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOME, SHADE, SUIT_PARTS, TONES } from './suit-look.js';

function partGeometry(part) {
  let g;
  if (part.shape === 'tube') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(part.points.map(p => new THREE.Vector3(...p))), 10, part.radius, 6);
  if (part.shape === 'ball') { g = new THREE.SphereGeometry(1, 14, 10); g.scale(...part.size); }
  else if (part.shape === 'ring') { g = new THREE.TorusGeometry(part.radius, part.tube, 8, 28); g.rotateX(Math.PI / 2); g.scale(1, 1, part.squash); }
  else if (part.shape === 'box') g = new THREE.BoxGeometry(...part.size);
  else { g = new THREE.CylinderGeometry(part.radius, part.radius, part.height, 12); if (part.axis === 'z') g.rotateX(Math.PI / 2); }
  g.translate(...part.at);
  return g;
}

function mergedPart(parts, main) {
  const pieces = parts.map(part => {
    const g = partGeometry(part), color = new THREE.Color(part.tone === 'main' || part.tone === 'shade' ? main : TONES[part.tone]);
    if (part.tone === 'shade') color.multiplyScalar(SHADE);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach(g => g.dispose());
  return merged;
}

// The glass is mostly clear; the alpha rises towards the rim and in one soft
// highlight, so the dome reads as a dome even in a room with no light on it.
function domeGeometry() {
  const { center, radius, openAt } = DOME;
  const g = new THREE.SphereGeometry(radius, 26, 18, 0, Math.PI * 2, 0, Math.acos((openAt - center[1]) / radius));
  const n = g.attributes.normal, colors = new Float32Array(n.count * 4), shine = new THREE.Vector3(-.5, .62, .6).normalize(), v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    const spot = THREE.MathUtils.smoothstep(v.dot(shine), .86, .985), low = THREE.MathUtils.smoothstep(-v.y, .25, .75);
    colors.set([.78 + spot * .22, .9 + spot * .1, 1, .13 + low * .12 + spot * .42], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 4)); g.deleteAttribute('uv');
  g.translate(...center);
  return g;
}

// Shared by every suit in the view, and geometry by colour, so eight panas cost
// eight sets of buffers at most and three materials.
let shared = null;
const stitched = new Map();
function kit() {
  shared ||= {
    suit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .03 }),
    glass: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: .12, emissive: 0x223344, emissiveIntensity: .35 }),
    lens: new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    dome: domeGeometry(),
    lensShape: mergedPart(SUIT_PARTS.lens, '#ffffff'),
  };
  return shared;
}
function geometriesFor(main) {
  let set = stitched.get(main);
  if (!set) { set = Object.fromEntries(['torso', 'arm', 'leg', 'helmet'].map(id => [id, mergedPart(SUIT_PARTS[id], main)])); stitched.set(main, set); }
  return set;
}

function isInside(object, ancestor) {
  for (let o = object; o; o = o.parent) if (o === ancestor) return true;
  return false;
}

// character: what buildCharacter returns, built from suitedAvatar(). The
// returned remove() must run before character.dispose(), which would otherwise
// free the shared buffers with the rest of that pana's meshes.
export function dressExplorer(character, color) {
  const { suit: suitMaterial, glass, lens, dome, lensShape } = kit(), parts = geometriesFor(color), meshes = [];
  character.body.traverse(o => { if ((o.isMesh || o.isLine) && !isInside(o, character.neck)) o.visible = false; });
  const wear = (bone, geometry, material = suitMaterial, shadow = true) => {
    const m = new THREE.Mesh(geometry, material); m.castShadow = shadow; m.receiveShadow = shadow;
    m.name = 'Explorer suit'; bone.add(m); meshes.push(m); return m;
  };
  wear(character.body, parts.torso);
  character.arms.forEach(arm => wear(arm, parts.arm));
  character.legs.forEach(leg => wear(leg, parts.leg));
  wear(character.head, parts.helmet);
  wear(character.head, lensShape, lens, false);
  wear(character.head, dome, glass, false).renderOrder = 1;   // after a sunglasses pane inside it
  return { meshes, remove() { meshes.forEach(m => m.removeFromParent()); } };
}

export function disposeSuits() {
  for (const set of stitched.values()) Object.values(set).forEach(g => g.dispose());
  stitched.clear();
  if (shared) { Object.values(shared).forEach(item => item.dispose()); shared = null; }
}
