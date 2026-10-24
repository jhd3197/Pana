import * as THREE from 'three';

// Distant objects as baked billboards (impostors). A prototype is rendered
// once from FRAMES directions around its vertical axis into an albedo atlas
// and an object-space normal atlas; every placement then draws one
// camera-facing quad showing the two nearest directions blended, lit by the
// scene's own sun, sky, shadows and fog. Two triangles per tree and one draw
// per cell instead of thousands of leaves. See docs/knowledge/impostors.md.
const FRAMES = 8, COLS = 4, ROWS = 2, MAX_LOD = 3, TILE = 256, ELEVATION = THREE.MathUtils.degToRad(8);
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

// Fill transparent texels from opaque neighbours so mipmaps and bilinear
// filtering never pull the cleared black into a crown's edge.
function dilate(data, width, height, passes) {
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  for (let pass = 0; pass < passes; pass++) {
    const next = alpha.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x; if (alpha[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx; if (!alpha[j]) continue;
        r += data[j * 4]; g += data[j * 4 + 1]; b += data[j * 4 + 2]; n++;
      }
      if (n) { data[i * 4] = r / n; data[i * 4 + 1] = g / n; data[i * 4 + 2] = b / n; next[i] = 1; }
    }
    alpha.set(next);
  }
}

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
    // Only detailed leaf crowns: a low-poly hull keeps its own facets.
    const triangles = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    const normal = normalBake.clone(), leaf = m.side === THREE.DoubleSide && triangles > 300;
    normal.uniforms.crown.value.set(0, frame.crownY, 0, leaf ? .7 : 0);
    mesh.userData.albedo = o.material; mesh.userData.normal = normal; scene.add(mesh); materials.push(normal);
  });
  const tileSize = record.tile, width = tileSize * COLS, height = tileSize * ROWS;
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI); scene.add(ambient);
  const targets = { albedo: new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, colorSpace: THREE.SRGBColorSpace }),
    normal: new THREE.WebGLRenderTarget(width, height, { depthBuffer: true }) };
  const camera = new THREE.OrthographicCamera(-frame.half, frame.half, frame.half, -frame.half, .1, frame.half * 8);
  const previous = { target: renderer.getRenderTarget(), color: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(),
    autoClear: renderer.autoClear, shadows: renderer.shadowMap.autoUpdate, scissor: renderer.getScissorTest() };
  const viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4());
  const read = pass => {
    const target = targets[pass];
    scene.children.forEach(mesh => { if (mesh.isMesh) mesh.material = mesh.userData[pass]; });
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0); renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
    renderer.setScissorTest(false); renderer.clear(true, true, true); renderer.setScissorTest(true);
    for (let f = 0; f < FRAMES; f++) {
      const angle = f / FRAMES * Math.PI * 2, distance = frame.half * 4;
      const up = record.elevation;
      camera.position.set(Math.sin(angle) * Math.cos(up) * distance, frame.centerY + Math.sin(up) * distance, Math.cos(angle) * Math.cos(up) * distance);
      camera.lookAt(0, frame.centerY, 0); camera.updateMatrixWorld(true);
      const x = (f % COLS) * tileSize, y = Math.floor(f / COLS) * tileSize;
      // The renderer reads a target's viewport only when it is bound.
      target.viewport.set(x, y, tileSize, tileSize); target.scissor.set(x, y, tileSize, tileSize); renderer.setRenderTarget(target);
      renderer.render(scene, camera);
    }
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    dilate(pixels, width, height, 8);
    const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
    texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4; texture.colorSpace = pass === 'albedo' ? THREE.SRGBColorSpace : THREE.NoColorSpace; texture.needsUpdate = true;
    return texture;
  };
  // Emissive glow stays on the billboard's own material, not in the photo.
  const glowing = new Map();
  scene.traverse(o => { for (const m of [].concat(o.material || [])) if (m.emissive && !glowing.has(m)) glowing.set(m, m.emissive.clone()); });
  try {
    glowing.forEach((_, m) => m.emissive.set(0));
    try { record.uniforms.impAlbedo.value = read('albedo'); } finally { glowing.forEach((color, m) => m.emissive.copy(color)); }
    record.uniforms.impNormal.value = read('normal');
  } finally {
    renderer.setRenderTarget(previous.target); renderer.setClearColor(previous.color, previous.alpha);
    renderer.autoClear = previous.autoClear; renderer.shadowMap.autoUpdate = previous.shadows; renderer.setScissorTest(previous.scissor);
    renderer.setViewport(viewport); renderer.setScissor(scissor);
    targets.albedo.dispose(); targets.normal.dispose(); materials.forEach(m => m.dispose());
    const used = new Set(); source.traverse(o => { if (o.geometry) used.add(o.geometry); }); used.forEach(g => g.dispose());
  }
  record.baked = true;
}

const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
function impostorMaterial(uniforms, { roughness = .85, emissive = 0x000000 } = {}) {
  const material = new THREE.MeshStandardMaterial({ roughness, metalness: 0, emissive, alphaTest: .5 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 iOffset; attribute vec2 iParams;
        uniform float impHalf, impCenterY;
        varying vec2 vImpUvA, vImpUvB, vImpRot; varying float vImpBlend;
        vec2 impTile(float f, vec2 uv) { return (vec2(mod(f, ${COLS}.0), floor(f / ${COLS}.0)) + uv) / vec2(${COLS}.0, ${ROWS}.0); }`)
      .replace('#include <beginnormal_vertex>', `
        vec2 impToCamera = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xz - iOffset.xz;
        vec2 impD = impToCamera / max(length(impToCamera), 1e-4);
        float impFrame = fract((atan(impD.x, impD.y) - iParams.y) / 6.2831853) * ${FRAMES}.0;
        float impF0 = floor(impFrame);
        vImpBlend = impFrame - impF0;
        vec2 impUv = position.xy * .5 + .5;
        vImpUvA = impTile(impF0, impUv); vImpUvB = impTile(mod(impF0 + 1.0, ${FRAMES}.0), impUv);
        vImpRot = vec2(cos(iParams.y), sin(iParams.y));
        vec3 objectNormal = vec3(impD.x, 0.0, impD.y);`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = iOffset + (vec3(impD.y, 0.0, -impD.x) * position.x * impHalf + vec3(0.0, impCenterY + position.y * impHalf, 0.0)) * iParams.x;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D impAlbedo, impNormal;
        varying vec2 vImpUvA, vImpUvB, vImpRot; varying float vImpBlend;
        // Neighbouring frames share the atlas: cap the mip level before a
        // tile's texels would average with the next tile's.
        float impLod(vec2 uv) {
          vec2 texels = uv * vec2(textureSize(impAlbedo, 0));
          return clamp(.5 * log2(max(dot(dFdx(texels), dFdx(texels)), dot(dFdy(texels), dFdy(texels)))), 0.0, ${MAX_LOD}.0);
        }
        vec4 impSample(sampler2D atlas, float lod) {
          return mix(textureLod(atlas, vImpUvA, lod), textureLod(atlas, vImpUvB, lod), vImpBlend);
        }`)
      .replace('#include <map_fragment>', `
        float impMip = impLod(vImpUvA);
        diffuseColor *= impSample(impAlbedo, impMip);`)
      .replace('#include <normal_fragment_begin>', `
        float faceDirection = 1.0;
        vec3 impN = impSample(impNormal, impMip).xyz * 2.0 - 1.0;
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
// size, `elevation` the camera's angle above the horizon while baking.
export function impostorPlacements(parent, source, placements, { name = source.name, cellSize = 240, tile = TILE, elevation = ELEVATION } = {}) {
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
  const half = Math.max(radius, (maxY - minY) / 2) * 1.12;
  const uniforms = { impAlbedo: { value: blank }, impNormal: { value: blank }, impHalf: { value: half }, impCenterY: { value: (minY + maxY) / 2 } };
  const record = { source, uniforms, frame: { half, centerY: (minY + maxY) / 2, crownY: minY + (maxY - minY) * .62 }, baked: false, users: 0, tile, elevation };
  pending.add(record);
  const material = impostorMaterial(uniforms, { roughness, emissive });
  const quad = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
  const cells = new Map(), out = [];
  for (const p of placements) { const key = `${Math.floor(p.x / cellSize)},${Math.floor(p.z / cellSize)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(p); }
  const release = () => {
    if (--record.users > 0) return;
    pending.delete(record); material.dispose();
    if (record.baked) { uniforms.impAlbedo.value.dispose(); uniforms.impNormal.value.dispose(); }
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
    mesh.userData.impostorCount = points.length; mesh.userData.atlas = uniforms;   // suites check the bake
    mesh.onBeforeRender = renderer => { if (!record.baked) prepareImpostors(renderer); };
    record.users++; parent.add(mesh); out.push(mesh);
  }
  return out;
}
