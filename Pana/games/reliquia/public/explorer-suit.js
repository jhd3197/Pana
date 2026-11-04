// Dresses a built pana in the explorer suit from suit-look.js: the fur body is
// hidden and the suit takes its place on the same bones, so every pose, squash
// and stagger still applies. Only the head stays, inside a glass dome.
//
// Per suit: one merged mesh each for the torso, two arms, two legs and the
// helmet's hard parts, plus the glass and the lamp's lens. Fewer draws than the
// meshes it hides. No lights: the headlamp and the light pool stay as they are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DOME, GLASS, SHADE, SUIT_PARTS, TONES } from './suit-look.js';

function partGeometry(part) {
  let g;
  if (part.shape === 'tube') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(part.points.map(p => new THREE.Vector3(...p))), 10, part.radius, 6);
  if (part.shape === 'ball') { g = new THREE.SphereGeometry(1, 14, 10); g.scale(...part.size); }
  else if (part.shape === 'turned') {
    const profile = new THREE.SplineCurve(part.profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(18);
    profile.forEach(p => { p.x = Math.max(0, p.x); });
    g = new THREE.LatheGeometry(profile, 18); g.scale(1, 1, part.squash);
  }
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

function domeGeometry() {
  const { center, radius, openAt } = DOME;
  const g = new THREE.SphereGeometry(radius, 26, 18, 0, Math.PI * 2, 0, Math.acos((openAt - center[1]) / radius));
  g.deleteAttribute('uv'); g.translate(...center);
  return g;
}

// Unlit, with no refraction or environment map: the look comes from the view
// direction alone, so the glass reads from any side and in any room. The streak
// and glint are crescents drawn in view space, like the reflection of a window
// that follows the eye. Fog still swallows it far away. Same cost as a plain fill.
function glassMaterial() {
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  const vec = hex => `vec3(${new THREE.Color(hex).toArray().map(v => v.toFixed(3)).join(',')})`, num = v => v.toFixed(3);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlassNormal;\nvarying vec3 vGlassEye;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGlassNormal = normalMatrix * normal;\nvGlassEye = -mvPosition.xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGlassNormal;
        varying vec3 vGlassEye;
        float crescent(float r, float a, float at, float reach, float mid, float width) {
          float along = clamp(abs(a - at) / reach, 0.0, 1.0), half_ = width * (1.0 - along * along);
          return (1.0 - smoothstep(half_ - 0.008, half_ + 0.008, abs(r - mid))) * (1.0 - smoothstep(0.92, 1.0, along));
        }
        vec4 glassColor() {
          vec3 n = normalize(vGlassNormal);
          float edge = pow(1.0 - clamp(dot(n, normalize(vGlassEye)), 0.0, 1.0), ${num(GLASS.edgePower)});
          float r = length(n.xy), a = atan(n.y, n.x);
          float light = max(crescent(r, a, 2.2, 0.72, 0.76, 0.075) * ${num(GLASS.streak)}, crescent(r, a, -0.85, 0.34, 0.84, 0.035) * ${num(GLASS.glint)});
          return vec4(mix(mix(${vec(GLASS.tint)}, ${vec(GLASS.edgeTint)}, edge), vec3(1.0), light), max(mix(${num(GLASS.clear)}, ${num(GLASS.edge)}, edge), light));
        }`)
      .replace('#include <color_fragment>', 'diffuseColor = glassColor();');
  };
  return material;
}

// Shared by every suit in the view, and geometry by colour, so eight panas cost
// eight sets of buffers at most and three materials.
let shared = null;
const stitched = new Map();
function kit() {
  shared ||= {
    suit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: .03 }),
    glass: glassMaterial(),
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
