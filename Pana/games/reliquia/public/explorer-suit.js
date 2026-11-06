// Dresses a built pana in the brass diving suit from suit-look.js: the fur body
// is hidden and the suit takes its place on the same bones, so every pose,
// squash and stagger still applies. Only the head stays, behind the porthole.
//
// Per suit: one merged mesh each for the torso, two arms, two legs and the
// helmet, plus the glass, the lamp's lens, its glow and its beam. Fewer draws
// than the meshes it hides, and everything is shared. A suit adds no light:
// real lamps are a small fixed pool the view lends out (headlamps.js).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { CLOTH, GLASS, HELMET, LAMP, PLAIN, SELF_GLOW, SHADE, SUIT_PARTS, TONES, lookKey, suitParts, suitTones } from './suit-look.js';

// A ball with its pole on the forward axis, starting `from` radians off it.
function shellGeometry(radius, from, widthSegments, heightSegments, inward) {
  const g = new THREE.SphereGeometry(radius, widthSegments, heightSegments, 0, Math.PI * 2, from, Math.PI - from);
  g.rotateX(Math.PI / 2); g.translate(...HELMET.center);
  if (inward) {
    const index = g.index.array, normal = g.attributes.normal.array;
    for (let i = 0; i < index.length; i += 3) { const a = index[i]; index[i] = index[i + 2]; index[i + 2] = a; }
    for (let i = 0; i < normal.length; i++) normal[i] = -normal[i];
  }
  return g;
}

function partGeometry(part) {
  let g;
  if (part.shape === 'tube') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(part.points.map(p => new THREE.Vector3(...p))), 6, part.radius, 5);
  if (part.shape === 'shell') return shellGeometry(part.radius, part.from, part.widthSegments, part.heightSegments, part.inward);
  if (part.shape === 'rivet') g = new THREE.SphereGeometry(part.radius, 5, 3);
  else if (part.shape === 'ball') { g = new THREE.SphereGeometry(1, 10, 7); g.scale(...part.size); }
  else if (part.shape === 'turned') {
    const profile = new THREE.SplineCurve(part.profile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(10);
    profile.forEach(p => { p.x = Math.max(0, p.x); });
    g = new THREE.LatheGeometry(profile, 14); g.scale(1, 1, part.squash);
  }
  else if (part.shape === 'ring') {
    g = new THREE.TorusGeometry(part.radius, part.tube, 6, 24);
    if (part.facing === 'y') g.rotateX(Math.PI / 2); else if (part.facing === 'x') g.rotateY(Math.PI / 2);
    g.scale(1, 1, part.squash);
  }
  else if (part.shape === 'box') g = new THREE.BoxGeometry(...part.size);
  else {
    g = new THREE.CylinderGeometry(part.radius, part.radius, part.height, 10);
    if (part.axis === 'z') g.rotateX(Math.PI / 2); else if (part.axis === 'x') g.rotateZ(Math.PI / 2);
  }
  g.translate(...part.at);
  return g;
}

export function mergedPart(parts, main, tones = TONES) {
  const pieces = parts.map(part => {
    const g = partGeometry(part), color = new THREE.Color(part.tone === 'main' || part.tone === 'shade' ? main : tones[part.tone]);
    if (part.tone === 'shade' || part.tone === 'main') color.multiplyScalar(CLOTH);
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

// Vertex-coloured, and faintly lit by its own colours so a diver out of the beam
// is still a colour in the dark. No extra light, and fog still takes it.
export function paintMaterial(options, glow) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, ...options });
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * ${glow.toFixed(3)};`);
  };
  material.customProgramCacheKey = () => `diver-paint-${glow}`;
  return material;
}

// The glass in the porthole: a cap of the helmet's own ball.
function glassGeometry() {
  const g = new THREE.SphereGeometry(HELMET.radius, 16, 5, 0, Math.PI * 2, 0, HELMET.port);
  g.deleteAttribute('uv'); g.rotateX(Math.PI / 2); g.translate(...HELMET.center);
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
          float light = max(crescent(r, a, 2.2, 0.72, 0.5, 0.05) * ${num(GLASS.streak)}, crescent(r, a, -0.85, 0.34, 0.56, 0.025) * ${num(GLASS.glint)});
          return vec4(mix(mix(${vec(GLASS.tint)}, ${vec(GLASS.edgeTint)}, edge), vec3(1.0), light), max(mix(${num(GLASS.clear)}, ${num(GLASS.edge)}, edge), light));
        }`)
      .replace('#include <color_fragment>', 'diffuseColor = glassColor();');
  };
  return material;
}

// The light you can see: a cone with its apex on the lens, fading out along its
// length (black adds nothing), so it reads in the dark and costs one draw. The
// shader softens what would be hard wedges: the surface fades as it turns edge
// on, and close to the eye, so standing in someone's beam never paints the screen.
function beamMaterial() {
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: LAMP.beam, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBeamNormal;\nvarying vec3 vBeamEye;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBeamNormal = normalMatrix * normal;\nvBeamEye = -mvPosition.xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBeamNormal;\nvarying vec3 vBeamEye;')
      .replace('#include <opaque_fragment>', `float beamFacing = abs(dot(normalize(vBeamNormal), normalize(vBeamEye)));
        diffuseColor.a *= smoothstep(.15, .85, beamFacing) * smoothstep(1., 4., length(vBeamEye));
        #include <opaque_fragment>`);
  };
  return material;
}
function beamGeometry() {
  const { beamLength: length, beamRadius: radius, at, tilt } = LAMP;
  const g = new THREE.ConeGeometry(radius, length, 10, 1, true);
  g.deleteAttribute('uv');
  const position = g.attributes.position, colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) { const k = position.getY(i) > 0 ? 1 : 0; colors.set([k, k * .94, k * .78], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.translate(0, -length / 2, 0); g.rotateX(-Math.PI / 2 + tilt); g.translate(...at);
  return g;
}

// Shared by every suit in the view, and geometry by colour and look, so eight panas
// cost eight sets of buffers at most and a handful of materials.
let shared = null;
const stitched = new Map();
function kit() {
  if (shared) return shared;
  const map = glowTexture();
  shared = {
    suit: paintMaterial({ roughness: .72, metalness: .02 }, SELF_GLOW.cloth),
    brass: paintMaterial({ roughness: .4, metalness: .42 }, SELF_GLOW.brass),
    glass: glassMaterial(),
    lens: new THREE.MeshBasicMaterial({ color: 0xfff4d6 }),
    glow: new THREE.SpriteMaterial({ map, color: 0xffe2a8, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }),
    beam: beamMaterial(),
    map,
    port: glassGeometry(),
    beamShape: beamGeometry(),
    lensShape: mergedPart(SUIT_PARTS.lens, '#ffffff'),
  };
  return shared;
}
function geometriesFor(main, look) {
  const key = `${main}|${lookKey(look)}`;
  let set = stitched.get(key);
  if (!set) {
    const parts = suitParts(look), tones = suitTones(look);
    set = Object.fromEntries(['torso', 'arm', 'leg', 'helmet'].map(id => [id, mergedPart(parts[id], main, tones)]));
    stitched.set(key, set);
  }
  return set;
}

function isInside(object, ancestor) {
  for (let o = object; o; o = o.parent) if (o === ancestor) return true;
  return false;
}

// character: what buildCharacter returns, built from suitedAvatar(). The
// returned remove() must run before character.dispose(), which would otherwise
// free the shared buffers with the rest of that pana's meshes. `lamp` is an
// anchor on the helmet for a borrowed SpotLight; lit(on) shows its glow and beam.
// look: lookFor() in suit-look.js, what this diver's rank has earned.
export function dressExplorer(character, color, look = PLAIN) {
  const { suit, brass, glass, lens, glow, beam, port, beamShape, lensShape } = kit(), parts = geometriesFor(color, look), meshes = [];
  character.body.traverse(o => { if ((o.isMesh || o.isLine) && !isInside(o, character.neck)) o.visible = false; });
  const wear = (bone, geometry, material = suit, shadow = true) => {
    const m = new THREE.Mesh(geometry, material); m.castShadow = shadow; m.receiveShadow = shadow;
    m.name = 'Diving suit'; bone.add(m); meshes.push(m); return m;
  };
  wear(character.body, parts.torso);
  character.arms.forEach(arm => wear(arm, parts.arm));
  character.legs.forEach(leg => wear(leg, parts.leg));
  wear(character.head, parts.helmet, brass);
  wear(character.head, lensShape, lens, false);
  wear(character.head, port, glass, false).renderOrder = 1;   // after a sunglasses pane inside it
  const ray = wear(character.head, beamShape, beam, false); ray.renderOrder = 2;
  const halo = new THREE.Sprite(glow); halo.position.set(...LAMP.at); halo.position.z += .06; halo.scale.setScalar(LAMP.glow); halo.renderOrder = 2; halo.name = 'Headlamp glow';
  const lamp = new THREE.Object3D(); lamp.position.set(...LAMP.at); lamp.name = 'Headlamp';
  character.head.add(halo, lamp); meshes.push(halo, lamp);
  return { meshes, lamp, lit(on) { ray.visible = on; halo.visible = on; }, remove() { meshes.forEach(m => m.removeFromParent()); } };
}

export function disposeSuits() {
  for (const set of stitched.values()) Object.values(set).forEach(g => g.dispose());
  stitched.clear();
  if (shared) { Object.values(shared).forEach(item => item.dispose()); shared = null; }
}
