import * as THREE from 'three';
import { getSettings } from '/engine/settings.js';

// Distant objects as baked billboards (impostors). A prototype is rendered
// once from FRAMES directions around its vertical axis, at a low and a high
// camera angle, into an albedo atlas and an object-space normal atlas; every
// placement then draws one camera-facing quad blending the nearest views,
// lit by the scene's own sun, sky, shadows and fog. Two triangles per tree
// and one draw per cell instead of thousands of leaves. See
// docs/knowledge/impostors.md.
const FRAMES = 8, COLS = 4, ROWS = 4, MAX_LOD = 3, TILE = 192;
// From below a hillside a crown shows its shaded underside, from a mountain
// road its lit top: views at both angles, blended by the camera's.
const ELEVATIONS = [-14, 16].map(THREE.MathUtils.degToRad);
const pending = new Set();
// Metres from the route beyond which a map's trees are drawn as impostors:
// far enough that passing cars never see a card turn.
export const IMPOSTOR_FROM = 45;

// Bake every impostor created since the last call. Called while a race loads;
// any impostor drawn before that bakes them all from its first onBeforeRender.
export function prepareImpostors(renderer) {
  for (const record of [...pending]) bakeRecord(renderer, record);
}

const normalBake = new THREE.ShaderMaterial({
  uniforms: { crown: { value: new THREE.Vector4() } },
  vertexShader: /* glsl */`
    uniform vec4 crown; varying vec3 vObjectNormal; varying vec3 vView;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0); vView = cameraPosition - world.xyz;
      vObjectNormal = normalize(mat3(modelMatrix) * normal);
      // Leaf cards take most of their normal from the crown's sphere, so a
      // distant canopy shades as one rounded mass, as the 3D crowns read.
      if (crown.w > 0.0) vObjectNormal = normalize(mix(vObjectNormal, normalize(world.xyz - crown.xyz), crown.w));
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */`
    uniform vec4 crown; varying vec3 vObjectNormal; varying vec3 vView;
    void main() {
      vec3 n = normalize(vObjectNormal);
      // Leaves are double-sided cards: light the face the camera sees.
      if (dot(n, vView) < 0.0 && crown.w < .5) n = -n;
      gl_FragColor = vec4(n * .5 + .5, 1.0);
    }`,
  side: THREE.DoubleSide,
});

function bakeRecord(renderer, record) {
  pending.delete(record);
  const { source, frame } = record, scene = new THREE.Scene(), materials = [];
  source.updateMatrixWorld(true);
  source.traverse(o => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const m = [].concat(o.material)[0];
    // The albedo pass draws the real material (maps, vertex colours, prints)
    // under flat ambient light of intensity π, which returns its base colour.
    const mesh = new THREE.Mesh(o.geometry, o.material); mesh.matrixAutoUpdate = false; mesh.matrix.copy(o.matrixWorld);
    // Only detailed leaf crowns (game tier and up): the clustered middle
    // crowns and far hulls keep their own facets, as they shade in 3D.
    const triangles = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    const normal = normalBake.clone(), leaf = m.side === THREE.DoubleSide && triangles > 1500;
    normal.uniforms.crown.value.set(0, frame.crownY, 0, leaf ? .7 : 0);
    mesh.userData.albedo = o.material; mesh.userData.normal = normal; scene.add(mesh); materials.push(normal);
  });
  const tileSize = record.tile, width = tileSize * COLS, height = tileSize * ROWS;
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI); scene.add(ambient);
  // The targets are the atlases: mipmapped on the GPU, never read back. Views
  // render over a clear (0,0,0,0) with normal blending, so texels hold
  // premultiplied colour and the shader divides by the filtered alpha: edges
  // never darken at any mip level, with no dilation pass.
  const atlas = colorSpace => new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, colorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, anisotropy: 4 });
  const targets = { albedo: atlas(THREE.SRGBColorSpace), normal: atlas(THREE.NoColorSpace) };
  const camera = new THREE.OrthographicCamera(-frame.half, frame.half, frame.half, -frame.half, .1, frame.half * 8);
  const previous = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate, scissor: renderer.getScissorTest() };
  const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
  const read = pass => {
    const target = targets[pass];
    scene.children.forEach(mesh => { if (mesh.isMesh) mesh.material = mesh.userData[pass]; });
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
    renderer.setScissorTest(false); renderer.clear(true, true, true); renderer.setScissorTest(true);
    for (let view = 0; view < FRAMES * 2; view++) {
      const angle = view % FRAMES / FRAMES * Math.PI * 2, distance = frame.half * 4;
      const up = record.elevations[Math.floor(view / FRAMES)];
      camera.position.set(Math.sin(angle) * Math.cos(up) * distance, frame.centerY + Math.sin(up) * distance, Math.cos(angle) * Math.cos(up) * distance);
      camera.lookAt(0, frame.centerY, 0); camera.updateMatrixWorld(true);
      const x = (view % COLS) * tileSize, y = Math.floor(view / COLS) * tileSize;
      // The renderer reads a target's viewport only when it is bound.
      target.viewport.set(x, y, tileSize, tileSize); target.scissor.set(x, y, tileSize, tileSize); renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    }
    return target.texture;
  };
  // Emissive glow stays on the billboard's own material, not in the photo.
  const glowing = new Map();
  scene.traverse(o => { for (const m of [].concat(o.material || [])) if (m.emissive && !glowing.has(m)) glowing.set(m, m.emissive.clone()); });
  record.targets = targets;
  try {
    glowing.forEach((_, m) => m.emissive.set(0));
    try { record.uniforms.impAlbedo.value = read('albedo'); } finally { glowing.forEach((color, m) => m.emissive.copy(color)); }
    record.uniforms.impNormal.value = read('normal');
  } finally {
    renderer.setRenderTarget(previous.target); renderer.setClearColor(previous.color, previous.alpha);
    renderer.autoClear = previous.autoClear; renderer.shadowMap.autoUpdate = previous.shadows; renderer.setScissorTest(previous.scissor);
    renderer.setViewport(viewport); renderer.setScissor(scissor);
    materials.forEach(m => m.dispose());
    const used = new Set(); source.traverse(o => { if (o.geometry) used.add(o.geometry); }); used.forEach(g => g.dispose());
  }
  record.baked = true;
}

// A static copy of what `root` shows right now: every visible mesh, skinned
// or morphed surfaces frozen in their current pose, in the space of `frame`
// (default: root itself). Materials are shared; geometry is new, for a bake.
export function snapshot(root, frame = root) {
  frame.updateMatrixWorld(true);
  const toFrame = frame.matrixWorld.clone().invert(), local = new THREE.Matrix4(), point = new THREE.Vector3(), out = new THREE.Group();
  root.traverse(o => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== root.parent; p = p.parent) if (!p.visible) return;
    const geometry = new THREE.BufferGeometry(), from = o.geometry.attributes.position, positions = new Float32Array(from.count * 3);
    for (let i = 0; i < from.count; i++) { o.getVertexPosition(i, point); point.toArray(positions, i * 3); }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (o.geometry.attributes.color) geometry.setAttribute('color', o.geometry.attributes.color.clone());
    if (o.geometry.index) geometry.setIndex(o.geometry.index.clone());
    geometry.computeVertexNormals();
    geometry.applyMatrix4(local.multiplyMatrices(toFrame, o.matrixWorld));
    out.add(new THREE.Mesh(geometry, o.material));
  });
  return out;
}

// Wraps a placed model in a THREE.LOD: the real model within `distance` of
// the camera, its baked card beyond. The renderer picks the level each frame;
// a hidden model's own animation can skip while `object.visible` is false.
export function impostorLOD(object, distance, options = {}) {
  const lod = new THREE.LOD(), { tick, ...meta } = object.userData;
  lod.name = `${object.name || 'model'}-lod`; lod.userData = meta;   // placement checks read footprint and species
  object.updateMatrix(); object.matrix.decompose(lod.position, lod.quaternion, lod.scale);
  object.parent?.add(lod);
  object.position.set(0, 0, 0); object.quaternion.identity(); object.scale.set(1, 1, 1);
  const card = new THREE.Group();
  impostorPlacements(card, snapshot(object), [{ x: 0, y: 0, z: 0 }], { tile: 128, ...options });
  lod.addLevel(object, 0); lod.addLevel(card, distance);
  return lod;
}

const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
function impostorMaterial(uniforms, { roughness = .85, emissive = 0x000000 } = {}) {
  const material = new THREE.MeshStandardMaterial({ roughness, metalness: 0, emissive, alphaTest: .5 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 iOffset; attribute vec2 iParams;
        uniform float impHalf, impCenterY; uniform vec2 impElevations;
        varying vec2 vImpUvA, vImpUvB, vImpUvC, vImpUvD, vImpRot; varying float vImpBlend, vImpRise;
        vec2 impTile(float view, vec2 uv) { return (vec2(mod(view, ${COLS}.0), floor(view / ${COLS}.0)) + uv) / vec2(${COLS}.0, ${ROWS}.0); }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 impCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        vec2 impToCamera = impCamera.xz - iOffset.xz;
        vec2 impD = impToCamera / max(length(impToCamera), 1e-4);
        float impAngle = atan(impCamera.y - iOffset.y - impCenterY * iParams.x, length(impToCamera));
        vImpRise = clamp((impAngle - impElevations.x) / (impElevations.y - impElevations.x), 0.0, 1.0);
        float impFrame = fract((atan(impD.x, impD.y) - iParams.y) / 6.2831853) * ${FRAMES}.0;
        float impF0 = floor(impFrame);
        vImpBlend = impFrame - impF0;
        vec2 impUv = position.xy * .5 + .5;
        float impF1 = mod(impF0 + 1.0, ${FRAMES}.0);
        vImpUvA = impTile(impF0, impUv); vImpUvB = impTile(impF1, impUv);
        vImpUvC = impTile(impF0 + ${FRAMES}.0, impUv); vImpUvD = impTile(impF1 + ${FRAMES}.0, impUv);
        vImpRot = vec2(cos(iParams.y), sin(iParams.y));
        vec3 objectNormal = vec3(impD.x, 0.0, impD.y);`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = iOffset + (vec3(impD.y, 0.0, -impD.x) * position.x * impHalf + vec3(0.0, impCenterY + position.y * impHalf, 0.0)) * iParams.x;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D impAlbedo, impNormal;
        varying vec2 vImpUvA, vImpUvB, vImpUvC, vImpUvD, vImpRot; varying float vImpBlend, vImpRise;
        // Neighbouring frames share the atlas: cap the mip level before a
        // tile's texels would average with the next tile's.
        float impLod(vec2 uv) {
          vec2 texels = uv * vec2(textureSize(impAlbedo, 0));
          return clamp(.5 * log2(max(dot(dFdx(texels), dFdx(texels)), dot(dFdy(texels), dFdy(texels)))), 0.0, ${MAX_LOD}.0);
        }
        vec4 impSample(sampler2D atlas, float lod) {
          vec4 low = mix(textureLod(atlas, vImpUvA, lod), textureLod(atlas, vImpUvB, lod), vImpBlend);
          vec4 high = mix(textureLod(atlas, vImpUvC, lod), textureLod(atlas, vImpUvD, lod), vImpBlend);
          return mix(low, high, vImpRise);
        }`)
      .replace('#include <map_fragment>', `
        float impMip = impLod(vImpUvA);
        vec4 impColor = impSample(impAlbedo, impMip);
        diffuseColor *= vec4(impColor.rgb / max(impColor.a, 1e-4), impColor.a);`)
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = 1.0;
        vec4 impNormalTexel = impSample(impNormal, impMip);
        vec3 impN = impNormalTexel.rgb / max(impNormalTexel.a, 1e-4) * 2.0 - 1.0;
        impN = vec3(impN.x * vImpRot.x + impN.z * vImpRot.y, impN.y, -impN.x * vImpRot.y + impN.z * vImpRot.x);
        vec3 normal = normalize((viewMatrix * vec4(impN, 0.0)).xyz);
        vec3 nonPerturbedNormal = normal;`);
  };
  material.customProgramCacheKey = () => 'pana-impostor';
  // A copy (the racers' ghost look clones every material) keeps the billboard.
  material.clone = function () {
    const copy = THREE.MeshStandardMaterial.prototype.clone.call(this);
    copy.onBeforeCompile = this.onBeforeCompile; copy.customProgramCacheKey = this.customProgramCacheKey; copy.clone = this.clone;
    return copy;
  };
  return material;
}

// Same contract as static-batch.js instancePlacements: one prototype drawn at
// placements ({x, y, z, rot, scale}) bucketed into cells. `source` is consumed
// once baked; its materials are only borrowed. `tile` is each view's pixel
// size (Rápida bakes 128 px views: under half the memory, for phones),
// `elevations` the low and high camera angles (radians) of the views.
export function impostorPlacements(parent, source, placements, { name = source.name, cellSize = 240, tile = getSettings().quality === 'baja' ? 128 : TILE, elevations = ELEVATIONS } = {}) {
  if (!placements.length) return [];
  source.updateMatrixWorld(true);
  let radius = 0, minY = Infinity, maxY = -Infinity, roughness = .85, emissive = 0x000000;
  const point = new THREE.Vector3();
  source.traverse(o => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, m = [].concat(o.material)[0];
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      radius = Math.max(radius, Math.hypot(point.x, point.z)); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    // Leaves carry the crown's look; the trunk barely shows from afar.
    if (m.side === THREE.DoubleSide) { roughness = m.roughness ?? roughness; emissive = m.emissive?.getHex() ?? emissive; }
  });
  // The bounding sphere fits the prototype from any view angle; the margin
  // keeps a tile's edge clear for mip filtering.
  const half = Math.hypot(radius, (maxY - minY) / 2) * 1.04;
  const uniforms = { impAlbedo: { value: blank }, impNormal: { value: blank }, impHalf: { value: half }, impCenterY: { value: (minY + maxY) / 2 }, impElevations: { value: new THREE.Vector2(...elevations) } };
  const record = { source, uniforms, frame: { half, centerY: (minY + maxY) / 2, crownY: minY + (maxY - minY) * .62 }, baked: false, users: 0, tile, elevations };
  pending.add(record);
  const material = impostorMaterial(uniforms, { roughness, emissive });
  const quad = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
  const cells = new Map(), out = [];
  for (const p of placements) { const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.z / cellSize)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(p); }
  const release = () => {
    if (--record.users > 0) return;
    pending.delete(record); material.dispose();
    if (record.baked) { record.targets.albedo.dispose(); record.targets.normal.dispose(); }
    else { const used = new Set(); source.traverse(o => { if (o.geometry) used.add(o.geometry); }); used.forEach(g => g.dispose()); }
  };
  for (const points of cells.values()) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const offsets = new Float32Array(points.length * 3), params = new Float32Array(points.length * 2), box = new THREE.Box3();
    points.forEach((p, i) => {
      const scale = p.scale || 1;
      offsets.set([p.x, p.y, p.z], i * 3); params.set([scale, p.rot || 0], i * 2);
      box.expandByPoint(point.set(p.x - half * scale, p.y + (minY - .5) * scale, p.z - half * scale));
      box.expandByPoint(point.set(p.x + half * scale, p.y + (maxY + .5) * scale, p.z + half * scale));
    });
    geometry.setAttribute('iOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('iParams', new THREE.InstancedBufferAttribute(params, 2));
    geometry.instanceCount = points.length;
    geometry.boundingBox = box; geometry.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    geometry.addEventListener('dispose', release);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = false;
    mesh.userData.impostorCount = points.length; mesh.userData.atlas = record;   // suites read the baked targets
    mesh.onBeforeRender = renderer => { if (!record.baked) prepareImpostors(renderer); };
    record.users++; parent.add(mesh); out.push(mesh);
  }
  return out;
}
